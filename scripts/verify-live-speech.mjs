// Optional real-provider check. Sends only these sample phrases and an explicitly supplied audio file.
// Usage: node scripts/verify-live-speech.mjs [path-to-short-synthetic.wav] [en-IN|hi-IN]
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Client } from '@stomp/stompjs';
const base=process.env.ISL_BACKEND || 'http://localhost:8080';
async function api(path,options={}) {
  const r=await fetch(base+path,{...options,signal:AbortSignal.timeout(40000)});
  const data=await r.json();assert.ok(r.ok,`${r.status}: ${data.message || JSON.stringify(data)}`);return data;
}
async function until(condition) {
  const deadline=Date.now()+40000;
  while(!condition()){assert.ok(Date.now()<deadline,'Timed out waiting for the speech/translation result');await new Promise(r=>setTimeout(r,50));}
}
const {sessionId:id}=await api('/api/sessions',{method:'POST'});
const received=[[],[]];
const clients=received.map(messages=>new Client({brokerURL:base.replace(/^http/,'ws')+'/ws/websocket',reconnectDelay:0}));
try {
  for(let i=0;i<clients.length;i++) {
    const client=clients[i];client.activate();await until(()=>client.connected);
    client.subscribe(`/topic/session/${id}`,m=>received[i].push(JSON.parse(m.body)));
    client.publish({destination:`/app/session/${id}/join`,body:JSON.stringify({type:'SESSION_STATUS',sessionId:id,sender:i?'SIGNER':'OFFICIAL',payload:{}})});
  }
  await until(()=>received[0].some(m=>m.payload?.officialConnected&&m.payload?.signerConnected));
  const phrases=[['Do not go to platform 3. Please wait at counter 2.','en-IN'],['कृपया अपना टिकट दिखाएँ। ट्रेन दस मिनट में आएगी।','hi-IN']];
  if(process.argv[2]) {
    const language=process.argv[3] || 'en-IN';
    const clip=await readFile(process.argv[2]);
    const {transcript}=await api(`/api/sessions/${id}/transcribe?language=${language}`,{method:'POST',headers:{'Content-Type':'audio/wav'},body:clip});
    assert.ok(transcript.trim());console.log('ACTUAL AUDIO TRANSCRIPT:',transcript);phrases.push([transcript,language]);
  }
  for(const [source,language] of phrases) {
    const count=received[1].filter(m=>m.type==='TRANSLATED_MESSAGE').length;
    clients[0].publish({destination:`/app/session/${id}/transcript`,body:JSON.stringify({type:'SPEECH_TRANSCRIPT',sessionId:id,sender:'OFFICIAL',payload:{text:source,language}})});
    await until(()=>received.every(messages=>messages.filter(m=>m.type==='TRANSLATED_MESSAGE').length>count));
    const result=received[0].filter(m=>m.type==='TRANSLATED_MESSAGE').at(-1).payload;
    assert.deepEqual(result,received[1].filter(m=>m.type==='TRANSLATED_MESSAGE').at(-1).payload);
    console.log(JSON.stringify({source,...result}));
    assert.equal(result.translationMode,'gemini','Real provider did not succeed; do not count fallback as a provider pass');
    assert.equal(language==='hi-IN'?result.hindiText:result.englishText,source);
    assert.ok(result.englishText);assert.match(result.hindiText,/[\u0900-\u097f]/);
  }
  console.log('PASS: actual provider, original preserved, both clients agree. Audio source is the supplied recording, not a physical microphone test.');
} finally {
  await api(`/api/sessions/${id}/end`,{method:'POST'}).catch(()=>{});
  await Promise.all(clients.map(c=>c.deactivate()));
}
