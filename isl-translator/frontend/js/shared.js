export const backend = window.ISL_BACKEND || (["5500", "5501"].includes(location.port)
  ? `${location.protocol}//${location.hostname}:8080` : location.origin);
let ui = {}, active;
const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));
export function setupShared(options) { ui = options; }
export async function request(path, options = {}) {
  let response;
  try { response = await fetch(`${backend}${path}`, { ...options, signal: options.signal || AbortSignal.timeout(12000) }); }
  catch { throw new Error(`Cannot reach the server at ${backend}. Start ISL Bridge and retry.`); }
  if (!response.ok) {
    const messages = {404: "That code was not found or the conversation has ended.", 409: "This counter is helping someone. Please wait."};
    const error = new Error(messages[response.status] || `Server request failed (${response.status}). Please retry.`);
    error.status = response.status; throw error;
  }
  return response.json();
}
export function showPanel(id) { document.querySelectorAll('[data-view]').forEach(el => { el.hidden = el.id !== id; }); }
export function showError(id, error) { const el = document.getElementById(id); el.textContent = error?.message || String(error); el.hidden = false; }
export function renderMessage(payload) {
  if (!payload?.englishText || !ui.chatLog) return;
  const card = document.createElement('article'); card.className = `message ${payload.originRole === 'SIGNER' ? 'signer' : 'official'}`;
  const who = document.createElement('span'); who.className = 'message-role'; who.textContent = payload.originRole === 'SIGNER' ? 'Signer' : 'Official';
  const text = document.createElement('p'); text.textContent = payload.englishText; card.append(who, text);
  if (payload.hindiText) { const hindi = document.createElement('p'); hindi.textContent = payload.hindiText; card.append(hindi); }
  ui.chatLog.append(card); ui.chatLog.scrollTop = ui.chatLog.scrollHeight;
}
export async function connectSession(id, role) {
  await active?.close(); ui.chatLog?.replaceChildren();
  let closed = false, count = 0, historyWork = Promise.resolve();
  const sessionId = id.toUpperCase();
  const client = new StompJs.Client({ webSocketFactory: () => new SockJS(`${backend}/ws`), reconnectDelay: 1500, heartbeatIncoming: 10000, heartbeatOutgoing: 10000 });
  const envelope = (type, payload) => JSON.stringify({ type, sessionId, sender: role, payload, timestamp: new Date().toISOString() });
  const state = connected => { if (closed) return; if (ui.reconnecting) ui.reconnecting.hidden = connected; emit('isl-connection', { connected, sessionId }); };
  const finish = () => { if (!closed) { emit('isl-ended', { sessionId }); api.close(); } };
  const history = () => {
    historyWork = historyWork.catch(() => {}).then(async () => {
      const data = await request(`/api/sessions/${sessionId}/history`);
      if (closed) return;
      data.messages.slice(count).forEach(message => { renderMessage(message); emit('isl-message', message); }); count = data.messages.length;
    }).catch(error => { if (error.status === 404) finish(); else if (!closed) emit('isl-error', error); });
    return historyWork;
  };
  client.onConnect = async () => {
    if (closed) return;
    client.subscribe(`/topic/session/${sessionId}`, message => {
      if (closed) return;
      const data = JSON.parse(message.body);
      if (data.type === 'TRANSLATED_MESSAGE') history();
      if (data.type === 'SESSION_ENDED') finish();
      if (data.type === 'SESSION_STATUS') {
        const other = role === 'SIGNER' ? data.payload.officialConnected : data.payload.signerConnected;
        if (ui.statusStrip) ui.statusStrip.textContent = `Session ${sessionId} · ${other ? (role === 'SIGNER' ? 'Official' : 'Signer') + ' connected' : 'Waiting for the other device'}`;
        emit('isl-status', data.payload);
      }
    });
    try {
      await request(`/api/sessions/${sessionId}/status`);
      if (closed) return;
      client.publish({ destination: `/app/session/${sessionId}/join`, body: envelope('SESSION_STATUS', {}) }); state(true); await history();
    } catch (error) { if (error.status === 404) finish(); else emit('isl-error', error); }
  };
  client.onWebSocketClose = () => state(false);
  client.onStompError = frame => { state(false); emit('isl-error', new Error(frame.headers.message || 'Conversation connection failed.')); };
  function send(route, type, payload) {
    if (closed || !client.connected) return false;
    client.publish({ destination: `/app/session/${sessionId}/${route}`, body: envelope(type, payload) }); return true;
  }
  const api = { sessionId, get connected() { return !closed && client.connected; },
    sendKeyword: (keyword, confidence) => send('keyword', 'KEYWORD_INPUT', { keyword, confidence }),
    sendTranscript: text => send('transcript', 'SPEECH_TRANSCRIPT', { text }),
    close: async () => { if (closed) return; closed = true; await client.deactivate(); },
  };
  active = api; state(false); client.activate(); return api;
}
export async function checkHealth() {
  const health = await request('/api/health');
  document.querySelectorAll('[data-server]').forEach(el => { el.textContent = health.translationMode === 'template-fallback' ? 'Server online · offline sentences' : 'Server online · Gemini enabled'; el.dataset.state = 'ready'; });
  return health;
}
