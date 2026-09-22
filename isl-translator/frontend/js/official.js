import { setupShared, request, connectSession, showPanel, showError, checkHealth, backend } from './shared.js';
import { createSpeechController } from './speech.js';
import { createAudioRecorder } from './audioRecorder.js';
import { counterLink, phoneOrigin } from './phoneAccess.js';
const $ = id => document.getElementById(id);
let counter, counterClient, ws, sessionId, syncing = false, counterVersion = 0;
let voiceChoiceChanged = false;
function voiceState(state, message) {
    const active = state !== 'idle';
    $('micButton').classList.toggle('listening', active);
    $('micButton').setAttribute('aria-pressed', String(active));
    $('micButton').setAttribute('aria-label', active ? 'Stop voice response' : 'Start voice response');
    $('micLabel').textContent = state === 'transcribing' ? 'Cancel' : active ? 'Stop' : 'Listen';
    $('speechLanguage').disabled = active; $('speechEngine').disabled = active;
    $('sendText').disabled = active; $('textInput').readOnly = active;
    $('micState').textContent = message;
}
const recognition = createSpeechController({
  Recognition: window.SpeechRecognition || window.webkitSpeechRecognition,
  getDraft: () => $('textInput').value,
  onDraft: text => { $('textInput').value = text; },
  onState: voiceState
});
const recording = createAudioRecorder({
  Recorder: window.MediaRecorder, getUserMedia: navigator.mediaDevices?.getUserMedia.bind(navigator.mediaDevices),
  getDraft: () => $('textInput').value, onDraft: text => { $('textInput').value = text; }, onState: voiceState,
  transcribe: async (clip, language, signal) => {
    const id = sessionId;
    const response = await fetch(`${backend}/api/sessions/${id}/transcribe?language=${encodeURIComponent(language)}`, {
      method: 'POST', headers: { 'Content-Type': clip.type }, body: clip, signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `Transcription failed (${response.status}). Your draft is preserved.`);
    if (id !== sessionId) throw new Error('This conversation has ended.');
    return data.transcript;
  }
});
const stopVoice = () => { recognition.abort(); recording.abort(); };
const voice = () => $('speechEngine').value === 'gemini' ? recording : recognition;
setupShared({ chatLog: $('chatLog'), statusStrip: $('statusStrip'), reconnecting: $('reconnecting'), role: 'OFFICIAL' });
const error = e => showError('appError', e);
function badge(text, ready = false) { $('officialState').textContent = text; $('officialState').dataset.state = ready ? 'ready' : ''; }
async function openSession(id) {
  if (sessionId === id) return;
  stopVoice(); sessionId = id; $('textInput').value = ''; $('appError').hidden = true;
  $('micState').textContent = 'Choose your language. Listen, stop, review, then send.';
  showPanel('conversation'); badge('Conversation live', true);
  $('conversation').classList.remove('attention'); void $('conversation').offsetWidth; $('conversation').classList.add('attention');
  ws = await connectSession(id, 'OFFICIAL');
}
async function ready() {
  stopVoice(); sessionId = null; const closing = ws; ws = null;
  $('appError').hidden = true;
  if (counter) { showPanel('ready'); badge('Ready', true); }
  else { showPanel('setup'); badge('Setup'); }
  // Finish the visible transition before awaiting the old socket: a waiting
  // visitor can open the next conversation while that socket is closing.
  await closing?.close();
}
async function syncCounter() {
  if (!counter || syncing || !counterClient?.connected) return;
  syncing = true; const version = counterVersion;
  try {
    const current = await request(`/api/counters/${counter.counterId}`);
    if (version !== counterVersion) return;
    if (current.currentSessionId) await openSession(current.currentSessionId);
    else if (sessionId) await ready();
    $('counterConnection').textContent = 'Connected · listening for visitors'; $('counterConnection').dataset.state = 'ready';
  } catch (e) { error(e); } finally { syncing = false; }
}
async function activateCounter(value) {
  counterVersion++; await counterClient?.deactivate(); counter = value;
  const page = new URL(location.href); page.searchParams.delete('session'); history.replaceState(null, '', page);
  localStorage.setItem('isl.counterId', counter.counterId);
  $('counterNav').textContent = counter.label || counter.counterId; $('counterTitle').textContent = counter.label || 'Service counter'; $('counterCode').textContent = counter.counterId;
  renderCounterLink();
  $('returnReady').hidden = false; await ready();
  const version = counterVersion;
  const client = counterClient = new StompJs.Client({ webSocketFactory: () => new SockJS(`${backend}/ws`), reconnectDelay: 1500 });
  client.onConnect = () => {
    if (version !== counterVersion) return;
    client.subscribe(`/topic/counter/${counter.counterId}`, () => syncCounter()); syncCounter();
  };
  client.onWebSocketClose = () => { if (version === counterVersion) { $('counterConnection').textContent = 'Reconnecting to server…'; $('counterConnection').dataset.state = ''; } };
  client.onStompError = () => error('Could not subscribe to this counter. Please retry.'); client.activate();
}
function renderCounterLink() {
  if (!counter) return;
  const shared = sessionStorage.getItem('isl.phoneOrigin') || '';
  const {url, phoneReady} = counterLink(counter.counterId, location.href, shared);
  $('signerLink').href = url; $('counterQr').replaceChildren();
  $('counterQr').hidden = !phoneReady;
  if (phoneReady) new QRCode($('counterQr'), {text: url, width: 232, height: 232});
  $('phoneStatus').textContent = phoneReady ? 'Phone link ready. Scan with your camera and open in Chrome (Android) or Safari (iPhone).' : 'This desktop address cannot start a phone camera. Start Phone Access below to create a secure QR.';
  $('phoneUrl').value = shared;
  $('printSign').disabled = !phoneReady;
}
$('phoneForm').onsubmit = event => {
  event.preventDefault();
  try {
    const value = $('phoneUrl').value.trim();
    if (value) sessionStorage.setItem('isl.phoneOrigin', phoneOrigin(value));
    else sessionStorage.removeItem('isl.phoneOrigin');
    renderCounterLink(); $('appError').hidden = true;
  } catch (e) { error(e); }
};
function explainVoice() {
  $('voicePrivacy').textContent = $('speechEngine').value === 'gemini'
    ? 'On Stop, up to 45 seconds of microphone audio is sent through this server to Gemini. Review the transcript before Send.'
    : 'Browser dictation may send microphone audio to your browser’s speech service. Review the transcript before Send.';
}
$('speechEngine').onchange = () => { voiceChoiceChanged = true; explainVoice(); };
async function formAction(form, action) {
  const buttons = [...form.querySelectorAll('button')]; buttons.forEach(b => b.disabled = true); $('appError').hidden = true;
  try { await action(); } catch (e) { error(e); } finally { buttons.forEach(b => b.disabled = false); }
}
$('createForm').onsubmit = e => { e.preventDefault(); formAction(e.currentTarget, async () => activateCounter(await request('/api/counters', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({label:$('counterLabel').value.trim()})}))); };
$('reclaimForm').onsubmit = e => { e.preventDefault(); formAction(e.currentTarget, async () => activateCounter(await request(`/api/counters/${encodeURIComponent($('counterInput').value.trim().toUpperCase())}`))); };
async function joinManual() {
  const id = $('sessionInput').value.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(id)) throw new Error('Enter the six-character session code.');
  await request(`/api/sessions/${id}/status`); counterVersion++; await counterClient?.deactivate(); counterClient = null; counter = null; await openSession(id);
  const page = new URL(location.href); page.searchParams.set('session', id); history.replaceState(null, '', page);
}
$('joinForm').onsubmit = e => { e.preventDefault(); formAction(e.currentTarget, joinManual); };
$('setupButton').onclick = () => { if (sessionId) return error('End the conversation before changing counters.'); showPanel('setup'); badge('Setup'); };
$('returnReady').onclick = () => { showPanel('ready'); badge('Ready', true); syncCounter(); };
$('printSign').onclick = () => window.print();
$('endSession').onclick = async () => {
  const ending = sessionId; $('endSession').disabled = true;
  try { await request(`/api/sessions/${ending}/end`, {method:'POST'}); if (sessionId === ending) await ready(); }
  catch (e) { if (e.status === 404) await ready(); else error(e); }
  finally { $('endSession').disabled = false; }
};
function sendText(text) {
  const value = text.trim(); if (!value) return;
  if (value.length > 1000) return error('Please keep each reply within 1,000 characters. Your draft is preserved.');
  if (recognition.active || recording.active) return;
  if (!ws?.sendTranscript(value, $('speechLanguage').value)) return error('Still reconnecting. Your reply is kept here; press Send when connected.');
  $('textInput').value = ''; $('micState').textContent = 'Reply submitted. Preparing both languages…';
}
$('replyForm').onsubmit = e => { e.preventDefault(); sendText($('textInput').value); };
$('micButton').onclick = () => {
  if (voice().active) voice().stop();
  else if (sessionId && ws?.connected) voice().start($('speechLanguage').value);
  else error('Wait until the conversation is connected before recording.');
};
window.addEventListener('isl-message', e => { if (e.detail.originRole === 'OFFICIAL' && !voice().active) $('micState').textContent = e.detail.translationMode === 'unavailable' ? 'Original delivered, but translation failed. Check the Gemini key, quota and connection, or use a supported offline phrase.' : 'Both languages delivered to the shared conversation.'; });
window.addEventListener('isl-ended', e => { if (e.detail.sessionId === sessionId) ready(); });
window.addEventListener('isl-error', e => error(e.detail));
window.addEventListener('pagehide', () => { stopVoice(); ws?.close(); counterClient?.deactivate(); });
setInterval(syncCounter, 3000);
checkHealth().then(health => {
  $('geminiVoiceOption').disabled = !health.audioTranscriptionConfigured;
  if (health.audioTranscriptionConfigured && !voiceChoiceChanged && !voice().active) $('speechEngine').value = 'gemini';
  explainVoice();
}).catch(error);
const manual = new URLSearchParams(location.search).get('session');
if (manual) { $('sessionInput').value = manual; $('manualDetails').open = true; joinManual().catch(error); }
else {
  const stored = localStorage.getItem('isl.counterId');
  if (stored) request(`/api/counters/${stored}`).then(activateCounter).catch(e => { if (e.status === 404) localStorage.removeItem('isl.counterId'); error(e); });
}
