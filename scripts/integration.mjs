import assert from 'node:assert/strict';
import { Client } from '@stomp/stompjs';
import { loadBrowserInference, recordedSamples } from './model-runtime.mjs';
const base = process.env.ISL_BACKEND || 'http://localhost:8080';
async function api(path, method='GET', body) {
  const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body&&JSON.stringify(body)});
  assert.ok(response.ok,`${method} ${path}: ${response.status}`); return response.json();
}
async function until(condition, message) {
  const end=Date.now()+15000;
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
  for(const label of ['Help','Ticket','Train']) {
    const prediction=await model.predictSequence(samples.find(s=>s.label===label).frames);
    assert.equal(prediction.label,label);
    const before=b.messages.filter(m=>m.type==='TRANSLATED_MESSAGE').length;
    b.send(id,'SIGNER','keyword','KEYWORD_INPUT',{keyword:prediction.label,confidence:prediction.confidence});
    await until(()=>b.messages.filter(m=>m.type==='TRANSLATED_MESSAGE').length>before,'predicted gloss returned as sentence');
    const message=b.messages.filter(m=>m.type==='TRANSLATED_MESSAGE').at(-1);
    assert.equal(message.payload.originRole,'SIGNER'); assert.ok(message.payload.englishText.length>5);
    if(health.translationMode==='template-fallback') assert.equal(message.payload.englishText,sentences[label]);
    await until(()=>a.messages.some(m=>m.type==='TRANSLATED_MESSAGE'&&m.payload.englishText===message.payload.englishText),'official receives sentence');
    console.log(`${prediction.label} (${(prediction.confidence*100).toFixed(2)}%) -> ${message.payload.englishText}`);
  }
  for(let i=0;i<2;i++) a.send(id,'OFFICIAL','transcript','SPEECH_TRANSCRIPT',{text:'Please go to platform three.'});
  await until(()=>b.messages.filter(m=>m.type==='TRANSLATED_MESSAGE'&&m.payload.originRole==='OFFICIAL').length===2,'identical official replies');
  assert.equal((await api(`/api/sessions/${id}/history`)).messages.length,5);
  await api(`/api/sessions/${id}/end`,'POST');
  await until(()=>b.messages.some(m=>m.type==='SESSION_ENDED'),'signer end notification');
  assert.equal((await api(`/api/counters/${counter.counterId}`)).currentSessionId,null);
  const second=(await api(`/api/counters/${counter.counterId}/sessions`,'POST')).sessionId;
  assert.notEqual(second,id); await api(`/api/counters/${counter.counterId}/sessions/${second}/end`,'POST');
  const manual=await api('/api/sessions','POST');await api(`/api/sessions/${manual.sessionId}/end`,'POST');
  console.log('PASS: real BiLSTM -> gloss -> backend -> both clients; busy, replies, end, next signer, manual session.');
} finally { await a.client.deactivate();await b.client.deactivate();model.dispose(); }
