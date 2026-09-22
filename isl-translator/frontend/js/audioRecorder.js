// Explicit alternative to browser dictation: Stop sends a short clip to Gemini.
// Audio is never saved by this client; only the reviewed text enters the chat.
export function createAudioRecorder({ getUserMedia, Recorder, transcribe, getDraft, onDraft, onState,
  schedule = setTimeout, cancel = clearTimeout, secure = () => globalThis.isSecureContext }) {
  let generation = 0, active = false, recorder, stream, timer, controller;
  const release = () => { stream?.getTracks().forEach(track => track.stop()); stream = null; cancel(timer); };
  const idle = message => { release(); active = false; recorder = null; onState('idle', message); };
  return {
    get active() { return active; },
    async start(language) {
      if (active) return;
      if (!secure()) return onState('idle', 'Microphone access needs trusted HTTPS or localhost. Open the secure phone link.');
      if (!Recorder || !getUserMedia) return onState('idle', 'Recording is unavailable. Use browser dictation or type your reply.');
      const token = ++generation, base = getDraft().trim();
      active = true; onState('starting', 'Allow microphone access. Record up to 45 seconds, then press Stop.');
      timer = schedule(() => {
        if (token !== generation) return;
        ++generation; idle('Microphone permission timed out. Allow access in site settings and retry.');
      }, 20000);
      try {
        const acquired = await getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
        if (token !== generation) { acquired.getTracks().forEach(track => track.stop()); return; }
        cancel(timer); stream = acquired;
        const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => Recorder.isTypeSupported(type));
        if (!mimeType) throw new Error('No supported recording format. Choose browser dictation instead.');
        const current = recorder = new Recorder(stream, { mimeType, audioBitsPerSecond: 64000 });
        const chunks = []; let size = 0;
        current.ondataavailable = event => {
          if (token !== generation || !event.data?.size) return;
          chunks.push(event.data); size += event.data.size;
          if (size > 4 * 1024 * 1024) {
            ++generation; current.stop(); idle('Recording is too large. Please record a shorter reply.');
          }
        };
        current.onerror = () => { if (token === generation) { ++generation; if (current.state !== 'inactive') current.stop(); idle('Recording failed. Check your microphone or use browser dictation.'); } };
        current.onstop = async () => {
          if (token !== generation) return;
          release(); recorder = null;
          const clip = new Blob(chunks, { type: current.mimeType || mimeType });
          if (!clip.size) return idle('No audio was recorded. Try again.');
          onState('transcribing', 'Transcribing your recording… please wait before sending.');
          controller = new AbortController();
          timer = schedule(() => controller?.abort(), 35000);
          try {
            const text = await transcribe(clip, language, controller.signal);
            if (token !== generation) return;
            onDraft([base, text].filter(Boolean).join(' '));
            idle('Transcription ready. Check names, numbers and meaning, then press Send.');
          } catch (error) { if (token === generation) idle(error.name === 'AbortError' ? 'Transcription timed out. Try browser dictation or type your reply.' : error.message); }
        };
        current.start(1000); onState('listening', 'Recording… tap Stop when finished (45 seconds maximum).');
        timer = schedule(() => { if (token === generation && current.state !== 'inactive') { onState('stopping', 'Finishing your recording…'); current.stop(); } }, 45000);
      } catch (error) {
        if (token === generation) idle(error.name === 'NotAllowedError' ? 'Microphone access is blocked. Allow it in site settings or type your reply.' : error.message);
      }
    },
    stop() {
      if (recorder?.state === 'recording') { cancel(timer); onState('stopping', 'Finishing your recording…'); recorder.stop(); }
      else if (active) this.abort();
    },
    abort() {
      ++generation; controller?.abort(); controller = null;
      const old = recorder; recorder = null;
      if (old && old.state !== 'inactive') old.stop();
      idle('Voice capture stopped. Your existing draft is preserved.');
    }
  };
}
