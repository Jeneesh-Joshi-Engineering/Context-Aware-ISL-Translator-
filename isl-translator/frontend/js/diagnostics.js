import { setupShared, checkHealth, request, connectSession } from './shared.js';
import { createInference } from './inference.js';
import { startCamera, stopCamera, describeCameraError } from './camera.js';
const $ = id => document.getElementById(id);
const log = line => { $('testOutput').textContent += `${line}\n`; };
let ws, model, testId, tracker, frame, running = false;
setupShared({chatLog:$('chatLog'),statusStrip:$('statusStrip'),reconnecting:$('reconnecting'),role:'SIGNER'});
checkHealth().catch(e => log(e.message));
const waitFor = async (condition, label, ms = 15000) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) { if (condition()) return; await new Promise(r => setTimeout(r, 50)); }
  throw new Error(`Timed out: ${label}`);
};
$('runCheck').onclick = async () => {
  $('runCheck').disabled = true; $('testOutput').textContent = ''; $('checkResult').hidden = true;
  try {
    if (testId) await request(`/api/sessions/${testId}/end`, {method:'POST'}).catch(() => {});
    const health = await checkHealth(); log(`Backend: ${health.status}; sentence engine: ${health.translationMode}`);
    const tracking = await import('./landmarker.js');
    const trackerCheck = await tracking.createHandLandmarker();
    try {
      const blank = document.createElement('canvas'); blank.width = 64; blank.height = 64;
      blank.getContext('2d').fillRect(0, 0, 64, 64);
      trackerCheck.instance.detectForVideo(blank, performance.now());
      log(`MediaPipe video API passed on a blank test frame (${trackerCheck.delegate}); this does not test the physical camera.`);
    } finally { trackerCheck.instance.close(); }
    model?.dispose(); model = await createInference(); log(`BiLSTM loaded: [30,126] → ${model.labels.join(', ')}`);
    const samples = await (await fetch('./fixtures/recorded-landmarks.json')).json();
    testId = (await request('/api/sessions', {method:'POST'})).sessionId;
    ws = await connectSession(testId, 'SIGNER'); await waitFor(() => ws.connected, 'WebSocket connection');
    $('officialLink').href = `./official.html?session=${testId}`; $('officialLink').hidden = false;
    $('endCheck').hidden = false; $('statusStrip').hidden = false;
    for (const expected of model.labels) {
      const sample = samples.find(s => s.label === expected);
      const result = await model.predictSequence(sample.frames);
      log(`${expected}: model predicted ${result.label}, confidence ${(result.confidence*100).toFixed(2)}%, ${result.latencyMs.toFixed(0)} ms`);
      if (result.label !== expected || result.confidence < model.confidenceThreshold) throw new Error(`Unexpected prediction for ${expected}`);
      if (result.label === 'No_Gesture') { log('Idle class correctly excluded from translation.'); continue; }
      const before = $('chatLog').children.length;
      if (!ws.sendKeyword(result.label, result.confidence)) throw new Error('WebSocket disconnected before gloss delivery');
      await waitFor(() => $('chatLog').children.length > before, `${result.label} sentence`);
      const card = $('chatLog').lastElementChild;
      const en = card.querySelector('[lang=en]'), hi = card.querySelector('[lang=hi]');
      if (!en || !hi) throw new Error(`Missing bilingual output for ${result.label}`);
      log(`  → ${en.textContent}\n  → ${hi.textContent}`);
    }
    log('PASS: actual model output → WebSocket → sentence generation → browser chat.');
    $('checkResult').textContent = 'Pipeline passed. Open the receiving official screen to see the same conversation.'; $('checkResult').hidden = false;
  } catch (e) { log(`FAIL: ${e.message}`); $('checkResult').textContent = e.message; $('checkResult').hidden = false; }
  finally { $('runCheck').disabled = false; }
};
$('endCheck').onclick = async () => { if (testId) await request(`/api/sessions/${testId}/end`,{method:'POST'}).catch(e => log(e.message)); await ws?.close(); testId = null; $('endCheck').hidden = true; };
$('checkCamera').onclick = async () => {
  $('checkCamera').disabled = true;
  try {
    $('cameraBox').hidden = false; await startCamera($('video')); running = true;
    const tracking = await import('./landmarker.js'); tracker ||= (await tracking.createHandLandmarker()).instance;
    log('PASS: camera opened and MediaPipe initialized. Show a hand to verify landmarks.');
    $('stopCamera').hidden = false; let last = -1, reported = false;
    const tick = () => {
      if (!running) return;
      const video = $('video'), overlay = $('overlay');
      if (video.readyState >= 2 && video.currentTime !== last) {
        last = video.currentTime; overlay.width = video.videoWidth; overlay.height = video.videoHeight;
        const observation = tracking.interpretHandLandmarkerResult(tracker.detectForVideo(video, performance.now()));
        tracking.drawHandOverlay(overlay.getContext('2d'), observation.visibleHands, overlay.width, overlay.height);
        if (observation.visibleHands.length && !reported) { log(`PASS: ${observation.visibleHands.length} hand(s) → ${observation.frameVector.length} normalized coordinates.`); reported = true; }
      }
      frame = requestAnimationFrame(tick);
    }; tick();
  } catch (e) { log(`CAMERA/TRACKING: ${describeCameraError(e)}`); stopCamera($('video')); running = false; }
  finally { $('checkCamera').disabled = false; }
};
$('stopCamera').onclick = () => { running = false; cancelAnimationFrame(frame); stopCamera($('video')); $('cameraBox').hidden = true; $('stopCamera').hidden = true; };
window.addEventListener('pagehide', () => { running = false; cancelAnimationFrame(frame); stopCamera($('video')); tracker?.close(); model?.dispose(); ws?.close(); });
