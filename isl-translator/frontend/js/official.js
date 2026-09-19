import { setupShared, request, connectSession, showPanel, showError, checkHealth, backend } from './shared.js';
const $ = id => document.getElementById(id);
let counter, counterClient, ws, sessionId, recognition, syncing = false, counterVersion = 0;
setupShared({ chatLog: $('chatLog'), statusStrip: $('statusStrip'), reconnecting: $('reconnecting'), role: 'OFFICIAL' });
const error = e => showError('appError', e);
function badge(text, ready = false) { $('officialState').textContent = text; $('officialState').dataset.state = ready ? 'ready' : ''; }
async function openSession(id) {
  if (sessionId === id) return;
  recognition?.abort(); sessionId = id; $('textInput').value = ''; $('appError').hidden = true;
  $('micState').textContent = 'Tap the microphone to speak, or type your reply.';
  showPanel('conversation'); badge('Conversation live', true);
  $('conversation').classList.remove('attention'); void $('conversation').offsetWidth; $('conversation').classList.add('attention');
  ws = await connectSession(id, 'OFFICIAL');
}
async function ready() {
  recognition?.abort(); sessionId = null; const closing = ws; ws = null;
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
  localStorage.setItem('isl.counterId', counter.counterId);
  $('counterNav').textContent = counter.label || counter.counterId; $('counterTitle').textContent = counter.label || 'Service counter'; $('counterCode').textContent = counter.counterId;
  const url = new URL(`index.html?counter=${counter.counterId}`, location.href).href;
  $('signerLink').href = url; $('counterQr').replaceChildren(); new QRCode($('counterQr'), {text: url, width: 232, height: 232});
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
  if (!ws?.sendTranscript(value)) return error('Still reconnecting. Your reply is kept here; press Send when connected.');
  $('textInput').value = ''; $('micState').textContent = 'Reply sent.';
}
$('replyForm').onsubmit = e => { e.preventDefault(); sendText($('textInput').value); };
$('micButton').onclick = () => {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) { $('micState').textContent = 'Voice input is unavailable in this browser. Type your reply or open Chrome/Edge.'; return; }
  if (recognition) { recognition.stop(); return; }
  const speakingSession = sessionId; recognition = new Recognition(); recognition.lang = 'en-IN'; recognition.interimResults = true;
  recognition.onstart = () => { $('micButton').classList.add('listening'); $('micState').textContent = 'Listening… tap the microphone to stop.'; };
  recognition.onresult = e => {
    const result = e.results[e.resultIndex]; $('textInput').value = result[0].transcript;
    if (result.isFinal && speakingSession === sessionId) sendText(result[0].transcript);
  };
  recognition.onerror = e => { $('micState').textContent = `Voice input: ${e.error}. You can type your reply.`; };
  recognition.onend = () => { recognition = null; $('micButton').classList.remove('listening'); };
  try { recognition.start(); } catch (e) { recognition = null; error(e); }
};
window.addEventListener('isl-ended', e => { if (e.detail.sessionId === sessionId) ready(); });
window.addEventListener('isl-error', e => error(e.detail));
window.addEventListener('pagehide', () => { recognition?.abort(); ws?.close(); counterClient?.deactivate(); });
setInterval(syncCounter, 3000);
checkHealth().catch(error);
const manual = new URLSearchParams(location.search).get('session');
if (manual) { $('sessionInput').value = manual; $('manualDetails').open = true; joinManual().catch(error); }
else {
  const stored = localStorage.getItem('isl.counterId');
  if (stored) request(`/api/counters/${stored}`).then(activateCounter).catch(e => { if (e.status === 404) localStorage.removeItem('isl.counterId'); error(e); });
}
