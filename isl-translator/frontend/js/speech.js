// Toggle-to-talk controller. Final segments survive service restarts and pauses.
export function createSpeechController({ Recognition, onDraft, onState, getDraft,
  schedule = setTimeout, cancel = clearTimeout }) {
  let current, wanted = false, base = '', settled = '', interim = '', language, timer, stopTimer, generation = 0, restarts = 0;
  const messages = {
    'no-speech': 'No speech detected. Check your microphone and try again.',
    'audio-capture': 'No microphone is available. Check its connection and whether another app is using it.',
    'not-allowed': 'Microphone access is blocked. Allow microphone access for this site in your browser settings.',
    'service-not-allowed': 'Speech recognition is blocked by this browser or device policy. You can type your reply.',
    network: 'The speech service could not connect. Check your internet connection or type your reply.',
    'language-not-supported': 'This speech service does not support the selected language. Try another language or type your reply.',
    aborted: 'Listening stopped. Review your reply before sending.'
  };
  const draft = () => [base, settled, interim].filter(Boolean).join(' ').trim();
  function finish(message) {
    wanted = false; cancel(timer); cancel(stopTimer); current = null;
    onDraft(draft()); onState('idle', message || (draft() ? 'Review your reply, then press Send.' : 'No speech detected. Try again or type your reply.'));
  }
  function launch(token) {
    if (!wanted || token !== generation) return;
    const recognition = current = new Recognition();
    let finals = '', partial = '', hadResult = false, failure;
    recognition.lang = language; recognition.continuous = true; recognition.interimResults = true; recognition.maxAlternatives = 1;
    const valid = () => token === generation && current === recognition;
    recognition.onstart = () => { if (valid()) onState('listening', 'Listening… pauses are OK. Tap Stop when you finish.'); };
    recognition.onresult = event => {
      if (!valid()) return;
      const finalParts = [], interimParts = [];
      // Results are cumulative within one recognition run; rebuild to avoid duplicates.
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i], text = result[0]?.transcript?.trim();
        if (text) (result.isFinal ? finalParts : interimParts).push(text);
      }
      finals = finalParts.join(' '); partial = interimParts.join(' ');
      interim = [finals, partial].filter(Boolean).join(' '); hadResult = !!interim;
      if (hadResult) restarts = 0;
      onDraft(draft());
    };
    recognition.onerror = event => {
      if (!valid()) return;
      failure = messages[event.error] || 'Speech recognition could not finish. Review the captured text or type your reply.';
      wanted = false; onState('stopping', failure);
      stopTimer = schedule(() => { if (valid()) { recognition.abort(); finish(failure); } }, 1500);
    };
    recognition.onend = () => {
      if (!valid()) return;
      cancel(stopTimer); current = null;
      // Preserve even an unfinished segment for review; never send it automatically.
      settled = [settled, finals, partial].filter(Boolean).join(' '); interim = '';
      onDraft(draft());
      if (wanted && !failure && ++restarts <= 3) {
        onState('listening', 'Listening… continuing after a pause. Tap Stop when you finish.');
        timer = schedule(() => launch(token), 250);
      } else finish(failure || (!hadResult && !draft() ? messages['no-speech'] : undefined));
    };
    try { recognition.start(); } catch { finish('Could not start speech recognition. Check microphone permission or type your reply.'); }
  }
  return {
    get active() { return wanted || !!current; },
    start(lang) {
      if (wanted || current) return;
      if (!Recognition) return onState('idle', 'Voice input is unavailable in this browser. Open Chrome/Edge or type your reply.');
      base = getDraft().trim(); settled = interim = ''; language = lang; restarts = 0; wanted = true;
      onState('starting', 'Requesting microphone access… allow it in your browser.'); launch(++generation);
    },
    stop() {
      wanted = false; cancel(timer);
      if (!current) return finish();
      onState('stopping', 'Finishing transcription…');
      const pending = current;
      stopTimer = schedule(() => { if (current === pending) { pending.abort(); finish('Review the captured text before sending.'); } }, 2500);
      try { current.stop(); } catch { finish(); }
    },
    abort() {
      ++generation; wanted = false; cancel(timer); cancel(stopTimer);
      const old = current; current = null; old?.abort(); base = settled = interim = '';
      onState('idle', 'Choose your speaking language. Listen, stop, review, then send.');
    }
  };
}
