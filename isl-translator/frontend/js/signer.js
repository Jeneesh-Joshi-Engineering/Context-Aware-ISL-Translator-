import { setupShared, request, connectSession, showPanel, showError, checkHealth } from './shared.js';
import { startCamera, stopCamera, describeCameraError } from './camera.js';
import { createInference } from './inference.js';

const $ = id => document.getElementById(id);
let ws, sessionId, counterId, stream, inference, modelPromise, landmarker, trackingModule;
let ended = false, captureStarting = false, captureVersion = 0, frameId, lastVideoTime = -1, lastFrameAt = 0;
let waitTimer, joinVersion = 0, modelLoading = false;
setupShared({ chatLog: $('chatLog'), statusStrip: $('statusStrip'), reconnecting: $('reconnecting'), role: 'SIGNER' });
function state(id, text, kind = '') { $(id).textContent = text; $(id).dataset.state = kind; }
const error = e => showError('appError', e);

async function prepareModel() {
  if (inference) return inference;
  if (modelLoading) return modelPromise;
  modelLoading = true;
  state('modelState', 'Loading BiLSTM…'); $('modelError').hidden = true; $('retryModel').hidden = true;
  modelPromise = createInference({
    onScores: p => { $('predictionDetail').textContent = `${p.label.replaceAll('_', ' ')} · ${(100*p.confidence).toFixed(0)}% confidence · ${p.latencyMs.toFixed(0)} ms`; },
    onPrediction: p => {
      if (ended) return;
      $('prediction').textContent = p.label.toUpperCase();
      if (ws?.sendKeyword(p.label, p.confidence)) $('translationState').textContent = `Translating ${p.label.toUpperCase()}…`;
      else { $('translationState').textContent = 'Connection interrupted. Repeat your sign once connected.'; inference?.reset(); }
    },
    onNoGesture: () => { $('prediction').textContent = 'Ready for your next sign'; },
    onLowConfidence: () => { $('prediction').textContent = 'Hold your sign steadily'; },
    onError: e => { state('modelState', 'Inference error', 'error'); showError('modelError', e); },
  }).then(result => {
    if (ended) { result.dispose(); return; }
    inference = result; state('modelState', 'BiLSTM ready', 'ready'); return result;
  }).catch(e => {
    state('modelState', 'Load failed', 'error'); showError('modelError', e); $('retryModel').hidden = false;
    throw e;
  }).finally(() => { modelLoading = false; });
  return modelPromise;
}

async function startCapture() {
  if (captureStarting || ended) return;
  captureStarting = true; const version = ++captureVersion;
  $('retryCamera').disabled = true; $('cameraError').hidden = true;
  cancelAnimationFrame(frameId); stopCamera($('video')); stream = null;
  state('cameraState', 'Waiting for permission…'); $('cameraHint').textContent = 'Allow camera access in your browser.'; $('cameraOverlay').hidden = false;
  try {
    stream = await startCamera($('video'));
    if (ended || version !== captureVersion) { stream.getTracks().forEach(t => t.stop()); return; }
    state('cameraState', 'Camera live', 'ready'); state('captureBadge', 'Camera live', 'ready'); $('cameraOverlay').hidden = true;
    $('cameraHint').textContent = 'Starting hand tracking…';
  } catch (e) {
    state('cameraState', 'Camera blocked', 'error'); state('captureBadge', 'Camera off');
    showError('cameraError', describeCameraError(e)); $('cameraHint').textContent = 'Camera unavailable. Use Start / retry camera below.';
    captureStarting = false; $('retryCamera').disabled = false; return;
  }
  try {
    // Dynamic import keeps a failed tracker dependency from disabling counter/session controls.
    trackingModule ||= await import('./landmarker.js');
    if (!landmarker) landmarker = (await trackingModule.createHandLandmarker()).instance;
    await prepareModel();
    if (ended || version !== captureVersion) return;
    state('cameraState', 'Hands tracked locally', 'ready'); lastVideoTime = -1; lastFrameAt = 0;
    inference?.reset(); frameId = requestAnimationFrame(processFrame);
  } catch (e) {
    showError('modelError', `Recognition could not start: ${e.message}`); $('retryModel').hidden = false;
    state('modelState', 'Recognition unavailable', 'error');
  } finally { captureStarting = false; $('retryCamera').disabled = false; }
}

function processFrame(now) {
  if (ended || !stream?.active) return;
  const video = $('video'), overlay = $('overlay');
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime && now - lastFrameAt >= 30) {
    lastVideoTime = video.currentTime; lastFrameAt = now;
    if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) { overlay.width = video.videoWidth; overlay.height = video.videoHeight; }
    try {
      const result = landmarker.detectForVideo(video, now);
      const observation = trackingModule.interpretHandLandmarkerResult(result);
      trackingModule.drawHandOverlay(overlay.getContext('2d'), observation.visibleHands, overlay.width, overlay.height);
      if (observation.visibleHands.length) inference?.pushFrame(observation.frameVector);
      else { inference?.reset(); $('prediction').textContent = 'Waiting for hands'; $('predictionDetail').textContent = 'Bring your hands into the frame.'; }
    } catch (e) { showError('modelError', `Hand tracking stopped: ${e.message}`); $('retryModel').hidden = false; return; }
  }
  frameId = requestAnimationFrame(processFrame);
}

async function openConversation(id, counter) {
  ended = false; sessionId = id; counterId = counter || null;
  ws = await connectSession(id, 'SIGNER');
  if (counter) { showPanel('translate'); startCapture(); }
}
async function joinCounter(code, version = ++joinVersion) {
  const normalized = code.trim().toUpperCase();
  if (!/^CTR-[A-HJ-NP-Z2-9]{4}$/.test(normalized)) { showPanel('landing'); return error('Enter a valid counter code, for example CTR-4F2A.'); }
  clearTimeout(waitTimer); $('appError').hidden = true; showPanel('loading');
  try {
    const counter = await request(`/api/counters/${normalized}`);
    const key = `isl.signer.${normalized}`;
    let id = sessionStorage.getItem(key);
    if (id !== counter.currentSessionId) { id = null; sessionStorage.removeItem(key); }
    if (!id) id = (await request(`/api/counters/${normalized}/sessions`, { method: 'POST' })).sessionId;
    if (version !== joinVersion) return;
    sessionStorage.setItem(key, id); await openConversation(id, normalized);
  } catch (e) {
    if (version !== joinVersion) return;
    if (e.status === 409) {
      showPanel('busy'); $('busyCounter').textContent = normalized;
      waitTimer = setTimeout(() => joinCounter(normalized, version), 3000);
    } else { showPanel('landing'); error(e); }
  }
}
async function manualSession() {
  $('startSession').disabled = true; $('appError').hidden = true; showPanel('loading');
  try {
    const created = await request('/api/sessions', { method: 'POST' });
    $('sessionCode').textContent = created.sessionId;
    const url = new URL(`official.html?session=${created.sessionId}`, location.href).href;
    $('qrcode').replaceChildren(); new QRCode($('qrcode'), { text: url, width: 208, height: 208 });
    $('officialLink').href = url; showPanel('invite'); await openConversation(created.sessionId);
  } catch (e) { showPanel('landing'); error(e); }
  finally { $('startSession').disabled = false; }
}
function cleanup() {
  ended = true; captureVersion++; cancelAnimationFrame(frameId); clearTimeout(waitTimer);
  stopCamera($('video')); stream = null; landmarker?.close(); landmarker = null; inference?.dispose(); inference = null; ws?.close();
}
function finish() {
  cleanup(); if (counterId) sessionStorage.removeItem(`isl.signer.${counterId}`);
  showPanel('ended'); $('appError').hidden = true;
}
async function endSession() {
  try { await request(`/api/sessions/${sessionId}/end`, { method: 'POST' }); finish(); }
  catch (e) { if (e.status === 404) finish(); else error(e); }
}
$('counterForm').onsubmit = e => { e.preventDefault(); joinCounter($('counterInput').value); };
$('startSession').onclick = manualSession;
$('retryCamera').onclick = startCapture;
$('retryModel').onclick = async () => { inference?.dispose(); inference = null; await prepareModel().catch(() => {}); if (stream?.active) startCapture(); };
$('endSession').onclick = endSession; $('cancelInvite').onclick = endSession;
$('cancelWait').onclick = () => { joinVersion++; clearTimeout(waitTimer); showPanel('landing'); };
window.addEventListener('isl-status', e => { if (!ended && sessionId && !counterId && e.detail.officialConnected && !$('invite').hidden) { showPanel('translate'); startCapture(); } });
window.addEventListener('isl-connection', e => { state('connectionState', e.detail.connected ? 'Connected' : 'Reconnecting…', e.detail.connected ? 'ready' : ''); if (e.detail.connected) inference?.reset(); });
window.addEventListener('isl-message', e => { if (e.detail.originRole === 'SIGNER') $('translationState').textContent = 'Translation delivered to both devices.'; });
window.addEventListener('isl-error', e => error(e.detail));
window.addEventListener('isl-ended', finish); window.addEventListener('pagehide', cleanup);
checkHealth().catch(error); prepareModel().catch(() => {});
const initialCounter = new URLSearchParams(location.search).get('counter');
if (initialCounter) joinCounter(initialCounter);
