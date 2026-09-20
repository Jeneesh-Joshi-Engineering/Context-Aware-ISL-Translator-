import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechController } from '../isl-translator/frontend/js/speech.js';

function harness() {
  let draft = '', state, message, instances = [], scheduled = new Map(), next = 0;
  class Recognition {
    constructor() { instances.push(this); }
    start() { this.onstart(); }
    stop() { this.stopped = true; }
    abort() { this.aborted = true; }
    result(...parts) { this.onresult({ resultIndex: 0, results: parts.map(([text, final]) => Object.assign([{transcript:text}], {isFinal:final})) }); }
  }
  const speech = createSpeechController({Recognition, getDraft:()=>draft, onDraft:x=>draft=x,
    onState:(s,m)=>{state=s;message=m;},schedule:fn=>{scheduled.set(++next,fn);return next;},cancel:id=>scheduled.delete(id)});
  return {speech,instances,get draft(){return draft;},get state(){return state;},get message(){return message;},
    tick(){const jobs=[...scheduled.values()];scheduled.clear();jobs.forEach(fn=>fn());}};
}
test('speech accumulates final segments, survives a natural pause, and waits for stop completion',()=>{
  const h=harness();h.speech.start('en-IN');const first=h.instances[0];
  assert.equal(first.continuous,true);assert.equal(first.interimResults,true);
  first.result(['Please go',true],['to platform',false]);
  first.result(['Please go',true],['to platform three.',true]);
  assert.equal(h.draft,'Please go to platform three.');
  first.onend();h.tick();const second=h.instances[1];
  second.result(['The train arrives soon.',false]);h.speech.stop();
  assert.equal(h.state,'stopping');assert.equal(second.stopped,true);
  second.result(['The train arrives soon.',true]);second.onend();
  assert.equal(h.draft,'Please go to platform three. The train arrives soon.');assert.equal(h.state,'idle');
});
test('Hindi selection, permission failure and late callbacks cannot leak into another conversation',()=>{
  const h=harness();h.speech.start('hi-IN');const r=h.instances[0];assert.equal(r.lang,'hi-IN');
  r.onerror({error:'not-allowed'});r.onend();assert.match(h.message,/access is blocked/);h.tick();assert.equal(h.instances.length,1);
  h.speech.start('hi-IN');const next=h.instances[1];h.speech.abort();next.result(['पुराना जवाब',true]);next.onend();
  assert.equal(h.draft,'');assert.equal(h.state,'idle');
});
test('no-speech and audio-capture are actionable and stopping without onend is bounded',()=>{
  for(const [error,expected] of [['no-speech',/No speech/],['audio-capture',/No microphone/],['network',/could not connect/]]){
    const h=harness();h.speech.start('en-IN');h.instances[0].onerror({error});h.instances[0].onend();assert.match(h.message,expected);
  }
  const h=harness();h.speech.start('en-IN');h.instances[0].result(['Keep this draft',false]);h.speech.stop();h.tick();
  assert.equal(h.state,'idle');assert.equal(h.draft,'Keep this draft');assert.equal(h.instances[0].aborted,true);
});
