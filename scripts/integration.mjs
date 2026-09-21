import assert from 'node:assert/strict';
import { Client } from '@stomp/stompjs';
import { loadBrowserInference, recordedSamples } from './model-runtime.mjs';
import { createSpeechController } from '../isl-translator/frontend/js/speech.js';
const base = process.env.ISL_BACKEND || 'http://localhost:8080';
async function api(path, method='GET', body) {
  const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body&&JSON.stringify(body)});
  assert.ok(response.ok,`${method} ${path}: ${response.status}`); return response.json();
}
async function until(condition, message) {
  const end=Date.now()+45000;
  while(Date.now()<end) {if(condition()) return; await new Promise(r=>setTimeout(r,25));}
  throw new Error('Timed out: '+message);
}
async function socket() {
  const messages=[];
  const client=new Client({brokerURL:base.replace(/^http/,'ws')+'/ws/websocket',reconnectDelay:0});
  client.activate(); await until(()=>client.connected,'STOMP connection');
  return {client,messages, subscribe(topic){client.subscribe(topic,m=>messages.push(JSON.parse(m.body)));},
    send(id,role,route,type,payload={}){client.publish({destination:`/app/session/${id}/${route}`,body:JSON.stringify({type,sessionId:id,sender:role,payload,timestamp:new Date().toISOString()})});}};
}
const model=await loadBrowserInference(); const a=await socket(), b=await socket();
let counter,id;
try {
  const health=await api('/api/health'); console.log('Translation mode:',health.translationMode);
  assert.deepEqual(health.vocabulary,model.labels.filter(label=>label!=='No_Gesture'),'backend vocabulary must match deployed model');
  const deployed=await api('/model/model_metadata.json');
  assert.deepEqual(deployed.output_classes,model.labels,'server must serve the current model metadata');
  counter=await api('/api/counters','POST',{label:'Automated integration check'});
  a.subscribe(`/topic/counter/${counter.counterId}`);
  // Barrier: a round trip after SUBSCRIBE lets the broker register the counter observer.
  await new Promise(r=>setTimeout(r,100));
  id=(await api(`/api/counters/${counter.counterId}/sessions`,'POST')).sessionId;
  await until(()=>a.messages.some(m=>m.type==='SESSION_STARTED'&&m.sessionId===id),'official auto-join notification');
  assert.equal((await fetch(`${base}/api/counters/${counter.counterId}/sessions`,{method:'POST'})).status,409);
  a.subscribe(`/topic/session/${id}`);b.subscribe(`/topic/session/${id}`);
  a.send(id,'OFFICIAL','join','SESSION_STATUS'); b.send(id,'SIGNER','join','SESSION_STATUS');
  await until(()=>a.messages.some(m=>m.type==='SESSION_STATUS'&&m.payload.signerConnected&&m.payload.officialConnected),'both roles present');
  const samples=await recordedSamples();
  const sentences={Help:'I need help, please.',Ticket:'I need help with my ticket.',Train:'I need information about the train.'};
  const activeLabels=model.labels.filter(label=>label!=='No_Gesture');
  for(const label of activeLabels) {
    const prediction=await model.predictSequence(samples.find(s=>s.label===label).frames);
    assert.equal(prediction.label,label);
    const before=b.messages.filter(m=>m.type==='TRANSLATED_MESSAGE').length;
    b.send(id,'SIGNER','keyword','KEYWORD_INPUT',{keyword:prediction.label,confidence:prediction.confidence});
    await until(()=>b.messages.filter(m=>m.type==='TRANSLATED_MESSAGE').length>before,'predicted gloss returned as sentence');
    const message=b.messages.filter(m=>m.type==='TRANSLATED_MESSAGE').at(-1);
    assert.equal(message.payload.originRole,'SIGNER'); assert.ok(message.payload.englishText.trim().length>0);
    assert.match(message.payload.hindiText, /[\u0900-\u097f]/);
    if(health.translationMode==='template-fallback' && sentences[label]) assert.equal(message.payload.englishText,sentences[label]);
    await until(()=>a.messages.some(m=>m.type==='TRANSLATED_MESSAGE'&&m.payload.englishText===message.payload.englishText),'official receives sentence');
    console.log(`${prediction.label} (${(prediction.confidence*100).toFixed(2)}%) -> ${message.payload.englishText}`);
  }
  // Exercise the production speech accumulator with simulated recognition events.
  // This checks transport/lifecycle, not a physical microphone or speech provider.
  let draft='', recognizer, restart;
  class RecordedSpeechEvents {
    constructor(){recognizer=this;} start(){this.onstart();} stop(){this.onend();} abort(){}
    final(text){this.onresult({results:[Object.assign([{transcript:text}],{isFinal:true})]});}
  }
  const speech=createSpeechController({Recognition:RecordedSpeechEvents,getDraft:()=>'',onDraft:text=>draft=text,onState:()=>{},schedule:fn=>{restart=fn;return 1;},cancel:()=>{}});
  speech.start('en-IN');recognizer.final('Please go');recognizer.onend();restart();recognizer.final('to platform three.');speech.stop();
  assert.equal(draft,'Please go to platform three.');
  for(let i=0;i<2;i++) a.send(id,'OFFICIAL','transcript','SPEECH_TRANSCRIPT',{text:draft,language:'en-IN'});
  await until(()=>b.messages.filter(m=>m.type==='TRANSLATED_MESSAGE'&&m.payload.originRole==='OFFICIAL').length===2,'identical official replies');
  for(const m of b.messages.filter(m=>m.type==='TRANSLATED_MESSAGE'&&m.payload.originRole==='OFFICIAL')) {
    assert.match(m.payload.hindiText,/[\u0900-\u097f]/); assert.ok(m.payload.englishText);
  }
  a.send(id,'OFFICIAL','transcript','SPEECH_TRANSCRIPT',{text:'कृपया यहाँ प्रतीक्षा करें।',language:'hi-IN'});
  await until(()=>b.messages.filter(m=>m.type==='TRANSLATED_MESSAGE'&&m.payload.originRole==='OFFICIAL').length===3,'Hindi reply translated');
  const translated=b.messages.filter(m=>m.type==='TRANSLATED_MESSAGE').at(-1).payload;
  assert.ok(translated.englishText);assert.match(translated.hindiText,/[\u0900-\u097f]/);
  await until(()=>a.messages.filter(m=>m.type==='TRANSLATED_MESSAGE').length===activeLabels.length+3,'both devices received all bilingual messages');
  assert.deepEqual(a.messages.filter(m=>m.type==='TRANSLATED_MESSAGE').map(m=>m.payload),b.messages.filter(m=>m.type==='TRANSLATED_MESSAGE').map(m=>m.payload));
  assert.equal((await api(`/api/sessions/${id}/history`)).messages.length,activeLabels.length+3);
  await api(`/api/sessions/${id}/end`,'POST');
  await until(()=>b.messages.some(m=>m.type==='SESSION_ENDED'),'signer end notification');
  assert.equal((await api(`/api/counters/${counter.counterId}`)).currentSessionId,null);
  const second=(await api(`/api/counters/${counter.counterId}/sessions`,'POST')).sessionId;
  assert.notEqual(second,id); await api(`/api/counters/${counter.counterId}/sessions/${second}/end`,'POST');
  const manual=await api('/api/sessions','POST');await api(`/api/sessions/${manual.sessionId}/end`,'POST');
  console.log('PASS: real BiLSTM -> gloss -> backend -> both clients; busy, replies, end, next signer, manual session.');
} finally { await a.client.deactivate();await b.client.deactivate();model.dispose(); }
