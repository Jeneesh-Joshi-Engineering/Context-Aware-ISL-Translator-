import test from 'node:test';
import assert from 'node:assert/strict';
import { phoneOrigin, counterLink } from '../isl-translator/frontend/js/phoneAccess.js';
import { createAudioRecorder } from '../isl-translator/frontend/js/audioRecorder.js';

test('phone QR never claims localhost or LAN HTTP is usable and uses the supplied HTTPS origin', () => {
  for (const base of ['http://localhost:8080', 'http://192.168.1.5:8080', 'https://127.0.0.1']) {
    assert.equal(counterLink('CTR-ABCD', base + '/official.html').phoneReady, false);
    assert.throws(() => phoneOrigin(base));
  }
  assert.deepEqual(counterLink('CTR-ABCD', 'http://localhost:8080/official.html', 'https://bridge.example.org'), {
    url: 'https://bridge.example.org/index.html?counter=CTR-ABCD', phoneReady: true
  });
  assert.throws(() => phoneOrigin('https://user:secret@example.org'));
  assert.throws(() => phoneOrigin('https://example.org/official.html'));
  assert.throws(() => phoneOrigin('javascript:alert(1)'));
});

function harness(overrides = {}) {
  let draft = 'Existing reply.', state, message, sent, stopped = 0, instance;
  const timers = new Map(); let timerId = 0;
  const stream = { getTracks: () => [{ stop: () => stopped++ }] };
  class Recorder {
    static isTypeSupported(type) { return type === 'audio/webm;codecs=opus'; }
    constructor(s, options) { assert.equal(s, stream); this.mimeType = options.mimeType; instance = this; }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; this.ondataavailable({ data: new Blob(['audio'], {type:this.mimeType}) }); this.work = this.onstop(); }
  }
  const recorder = createAudioRecorder({ Recorder, getUserMedia: async () => stream,
    transcribe: async (clip, language) => { sent = {clip,language}; return 'कृपया यहाँ प्रतीक्षा करें।'; },
    getDraft: () => draft, onDraft: value => draft=value, onState: (s,m) => {state=s;message=m;},
    schedule: fn => {timers.set(++timerId,fn);return timerId;}, cancel: id => timers.delete(id), secure: () => true, ...overrides });
  return {recorder,stream,timers,get draft(){return draft;},get instance(){return instance;},get state(){return state;},get message(){return message;},get sent(){return sent;},get stopped(){return stopped;}};
}

test('audio stops microphone, transcribes Hindi, preserves draft and never publishes chat', async () => {
  const h=harness(); await h.recorder.start('hi-IN'); assert.equal(h.state,'listening');
  h.recorder.stop(); assert.equal(h.state,'transcribing'); await h.instance.work;
  assert.equal(h.sent.language,'hi-IN'); assert.equal(h.sent.clip.type,'audio/webm;codecs=opus');
  assert.equal(h.draft,'Existing reply. कृपया यहाँ प्रतीक्षा करें।'); assert.equal(h.state,'idle'); assert.equal(h.stopped,1); assert.equal(h.timers.size,0);
});

test('ending a session during transcription discards stale results', async () => {
  let complete; const h=harness({transcribe:()=>new Promise(resolve=>complete=resolve)});
  await h.recorder.start('en-IN');h.recorder.stop();h.recorder.abort();complete('Old transcript');await h.instance.work;
  assert.equal(h.draft,'Existing reply.');assert.equal(h.state,'idle');assert.equal(h.stopped,1);
});

test('late microphone permission releases tracks after cancel and never records', async () => {
  let grant;const h=harness({getUserMedia:()=>new Promise(resolve=>grant=resolve)});
  const pending=h.recorder.start('en-IN');h.recorder.abort();grant(h.stream);await pending;
  assert.equal(h.instance,undefined);assert.equal(h.stopped,1);assert.equal(h.recorder.active,false);
});

test('provider error and denied or insecure capture retain draft with actionable feedback', async () => {
  const h=harness({transcribe:async()=>{throw new Error('Quota exceeded');}});
  await h.recorder.start('en-IN');h.recorder.stop();await h.instance.work;
  assert.equal(h.draft,'Existing reply.');assert.match(h.message,/Quota/);assert.equal(h.recorder.active,false);
  const insecure=harness({secure:()=>false});await insecure.recorder.start('en-IN');assert.match(insecure.message,/HTTPS/);
  const denied=harness({getUserMedia:async()=>{throw Object.assign(new Error(),{name:'NotAllowedError'});}});
  await denied.recorder.start('en-IN');assert.match(denied.message,/blocked/);assert.equal(denied.timers.size,0);
});
