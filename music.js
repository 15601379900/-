/* Original electronic miniature: Dusk at the Drum Tower.
 * Pentatonic plucked-string, distant bell and soft drum timbres.
 * Newly composed for this experience; no recordings or sampled songs.
 */
(() => {
  'use strict';
  const bar = document.createElement('aside');
  bar.id = 'soundscape';
  bar.innerHTML = `<div class="soundscape-inner"><button type="button" id="music-toggle" aria-pressed="false"><svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M9 17V5l11-2v12M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/></svg><span></span></button><span class="music-title"></span><label class="music-volume"><span></span><input type="range" min="0" max="100" step="1" value="35"></label><span class="music-status" role="status"></span></div>`;
  document.querySelector('#header').after(bar);
  const button = bar.querySelector('button');
  const slider = bar.querySelector('input');
  let context, master, source, bufferPromise;
  let playing = false, loading = false, failed = false, offset = 0, started = 0, generation = 0;
  let volume = .35;
  try { const saved = localStorage.getItem('incense-music-volume'); if (saved !== null && Number.isFinite(Number(saved))) volume = Math.max(0, Math.min(1, Number(saved))); } catch {}
  slider.value = Math.round(volume * 100);
  const text = (zh, en) => document.documentElement.lang.startsWith('zh') ? zh : en;
  function labels() {
    bar.setAttribute('aria-label', text('鼓楼背景音乐', 'Drum Tower background music'));
    button.querySelector('span').textContent = loading ? text('备好琴声…', 'Preparing music…') : playing ? text('暂停音乐', 'Pause music') : text('听见鼓楼', 'Listen to Gulou');
    button.setAttribute('aria-pressed', String(playing));
    button.disabled = loading;
    bar.classList.toggle('is-playing', playing);
    bar.querySelector('.music-title').textContent = text('鼓楼暮声 · 原创意境配乐', 'Dusk at the Drum Tower · Original soundscape');
    bar.querySelector('.music-volume span').textContent = text('音量', 'Volume');
    slider.setAttribute('aria-label', text('背景音乐音量', 'Background music volume'));
    bar.querySelector('.music-status').textContent = failed ? text('音乐暂不可用，请再试一次。', 'Music is unavailable. Please try again.') : '';
  }
  const hz = midi => 440 * Math.pow(2, (midi - 69) / 12);
  async function compose() {
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Offline) throw new Error('Offline audio unavailable');
    const rate = 22050, duration = 64;
    const studio = new Offline(2, rate * (duration + 6), rate);
    const tone = studio.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 3400; tone.Q.value = .35;
    tone.connect(studio.destination);
    const echo = studio.createDelay(1), wet = studio.createGain(), feedback = studio.createGain();
    echo.delayTime.value = .31; wet.gain.value = .16; feedback.gain.value = .18;
    tone.connect(echo); echo.connect(wet); wet.connect(studio.destination); echo.connect(feedback); feedback.connect(echo);
    function voice(time, frequency, amplitude, decay, pan = 0, ratio = 1) {
      const osc = studio.createOscillator(), envelope = studio.createGain(), position = studio.createStereoPanner();
      osc.type = 'sine'; osc.frequency.value = frequency * ratio; position.pan.value = pan;
      const end = Math.min(time + decay * 5, duration + 6);
      envelope.gain.setValueAtTime(0, time);
      envelope.gain.linearRampToValueAtTime(amplitude, time + .012);
      envelope.gain.exponentialRampToValueAtTime(.00001, end);
      osc.connect(envelope); envelope.connect(position); position.connect(tone);
      osc.start(time); osc.stop(end + .01);
    }
    function pluck(time, note, strength = 1, pan = -.15) {
      [1, 2, 3, 4, 6].forEach((ratio, i) => voice(time, hz(note), strength * [.13,.032,.014,.007,.003][i], 1.1 / (1 + i * .48), pan, ratio));
    }
    // Sixteen slow four-beat bars, with space between the phrases.
    const melody = [[0,62],[1.5,66],[3,69],[5,71],[6.5,69],[8,66],[10,64],[12,62],[14.5,57],
      [16,62],[17.5,64],[19,66],[21,69],[22.5,66],[24,64],[26,62],[28,57],
      [32,66],[33.5,69],[35,74],[37,71],[38.5,69],[40,66],[42,64],[44,66],[46,69],
      [48,71],[49.5,69],[51,66],[53,64],[55,62],[58,57],[60,62]];
    melody.forEach(([beat,note],i) => pluck(beat + .12, note, .78 + (i % 3) * .07, -.23));
    [50,57,54,57,50,54,52,57,54,57,59,57,54,52,57,50].forEach((note,i) => pluck(i * 4 + .18, note - 12, .42, .22));
    [[7,78],[15,74],[23,78],[31,81],[39,78],[47,81],[55,78],[61.5,74]].forEach(([time,note]) => pluck(time, note, .19, .38));
    // Bell and drum are compositional images, not historical signal patterns.
    [0,32].forEach(time => [1,2.76,5.4].forEach((ratio,i) => voice(time + .04, hz(50), [.024,.01,.003][i], [1.5,.9,.5][i], .12, ratio)));
    [0,16,32,48].forEach(time => {
      const drum = studio.createOscillator(), envelope = studio.createGain();
      drum.frequency.setValueAtTime(100,time); drum.frequency.exponentialRampToValueAtTime(45,time+.24);
      envelope.gain.setValueAtTime(0,time); envelope.gain.linearRampToValueAtTime(.065,time+.016); envelope.gain.exponentialRampToValueAtTime(.00001,time+.8);
      drum.connect(envelope); envelope.connect(tone); drum.start(time); drum.stop(time+.85);
    });
    const rendered = await studio.startRendering();
    const loop = context.createBuffer(2, rate * duration, rate);
    // Fold the last reverberation into the opening for a continuous loop.
    for (let channel=0; channel<2; channel++) {
      const input = rendered.getChannelData(channel), output = loop.getChannelData(channel);
      output.set(input.subarray(0, output.length));
      for (let i=output.length; i<input.length; i++) output[i-output.length] += input[i];
    }
    return loop;
  }
  async function start() {
    const turn = ++generation;
    failed = false; loading = true; labels();
    try {
      if (!context) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) throw new Error('Audio unavailable');
        context = new Audio(); master = context.createGain(); master.gain.value = 0; master.connect(context.destination);
      }
      // Resume inside the click gesture for mobile browser playback policies.
      const resumed = context.resume();
      if (!bufferPromise) bufferPromise = compose().catch(error => { bufferPromise = null; throw error; });
      const [buffer] = await Promise.all([bufferPromise, resumed]);
      if (turn !== generation || document.hidden) { loading = false; labels(); return; }
      source = context.createBufferSource(); source.buffer = buffer; source.loop = true; source.connect(master);
      offset %= buffer.duration; started = context.currentTime;
      master.gain.cancelScheduledValues(started); master.gain.setValueAtTime(0, started); master.gain.linearRampToValueAtTime(volume, started + .7);
      source.start(0, offset); playing = true;
    } catch { failed = true; }
    loading = false; labels();
  }
  function pause() {
    generation++; loading = false;
    if (source) {
      offset += context.currentTime - started;
      const oldSource = source; source = null;
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setTargetAtTime(0, context.currentTime, .045);
      oldSource.stop(context.currentTime + .22);
      oldSource.onended = () => { oldSource.disconnect(); if (!playing && !loading) context.suspend().catch(() => {}); };
    }
    playing = false; labels();
  }
  button.addEventListener('click', () => playing ? pause() : start());
  slider.addEventListener('input', () => {
    volume = Number(slider.value) / 100;
    if (playing) { master.gain.cancelScheduledValues(context.currentTime); master.gain.setTargetAtTime(volume, context.currentTime, .06); }
    try { localStorage.setItem('incense-music-volume', String(volume)); } catch {}
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && (playing || loading)) pause(); });
  window.addEventListener('pagehide', pause);
  new MutationObserver(labels).observe(document.documentElement, {attributes:true, attributeFilter:['lang']});
  labels();
})();
