/* Conduit's sound and music. Made in the browser with Web Audio: no files,
 * nothing to license. Like Order Up: two volumes, each Off, Low, Medium or
 * High, both off until the player turns them up, everything through one
 * limiter so High doesn't crackle on a phone speaker.
 *
 * Music: a slow, calm loop made as it plays (Cmaj9, Am9, Fmaj7, G6 at 66
 * beats a minute, two bars each): a soft pad, a low note under each chord,
 * and a few bell notes from the pentatonic scale (it can't clash) with an
 * echo. It never plays the same way twice and stops while the page is
 * hidden.
 */
(function () {
  'use strict';

  const SFX_VOL = [0, 0.45, 1, 1.7];
  const MUSIC_VOL = [0, 0.25, 0.55, 0.9];
  let ac = null, out = null, fx = null, musicBus = null;
  let sfxLevel = 0, musicLevel = 0;

  function ctx() {
    try {
      if (!ac) {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        const lim = ac.createDynamicsCompressor();
        lim.threshold.value = -8; lim.knee.value = 6; lim.ratio.value = 12;
        lim.attack.value = 0.003; lim.release.value = 0.2;
        lim.connect(ac.destination);
        out = lim;
        fx = ac.createGain(); fx.gain.value = SFX_VOL[sfxLevel]; fx.connect(out);
        musicBus = ac.createGain(); musicBus.gain.value = MUSIC_VOL[musicLevel]; musicBus.connect(out);
      }
      if (ac.state === 'suspended' && !document.hidden) ac.resume();
      return ac;
    } catch (e) { return null; }
  }

  function setVolumes(sfx, music) {
    sfxLevel = sfx; musicLevel = music;
    if (ac) {
      fx.gain.setTargetAtTime(SFX_VOL[sfx], ac.currentTime, 0.03);
      musicBus.gain.setTargetAtTime(MUSIC_VOL[music], ac.currentTime, 0.1);
    }
    if (music && !Music.on) Music.start();
    if (!music && Music.on) Music.stop();
  }

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  // One note: a wave with a quick start and a fall.
  function tone(freq, dur, type, vol, delay = 0, slideTo = 0, dest = null) {
    if (!sfxLevel && !dest) return;
    const a = ctx(); if (!a) return;
    const t0 = a.currentTime + delay;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || fx);
    o.start(t0); o.stop(t0 + dur + 0.03);
  }

  // Each colour has its own note (C major pentatonic, up two octaves).
  const COLOR_NOTES = [72, 74, 76, 79, 81, 84, 86, 88, 91];

  const Sfx = {
    tap() { tone(900, 0.04, 'sine', 0.05); },
    pick(c) { tone(midi(COLOR_NOTES[c % 9] - 12), 0.09, 'triangle', 0.07); },
    step(c, n) { tone(midi(COLOR_NOTES[c % 9] - 12) * (1 + Math.min(n, 12) * 0.012), 0.035, 'sine', 0.025); },
    join(c) {
      const f = midi(COLOR_NOTES[c % 9]);
      tone(f, 0.22, 'triangle', 0.08);
      tone(f * 1.5, 0.3, 'sine', 0.04, 0.05);
    },
    cut() { tone(330, 0.12, 'square', 0.025, 0, 180); },
    undo() { tone(520, 0.08, 'triangle', 0.05, 0, 360); },
    nope() { tone(160, 0.12, 'triangle', 0.06); },
    solved() {
      [60, 64, 67, 72].forEach((n, i) => tone(midi(n + 12), 0.5, 'triangle', 0.07, i * 0.08));
    },
    flawless() {
      [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone(midi(n + 12), 0.6, 'triangle', 0.065, i * 0.07));
      [96, 100, 103].forEach((n, i) => tone(midi(n), 0.4, 'sine', 0.03, 0.5 + i * 0.06));
    },
  };

  // ---- music -------------------------------------------------------------

  const BPM = 66, BEAT = 60 / BPM, BAR = BEAT * 4;
  const CHORDS = [
    { root: 36, notes: [48, 52, 55, 59, 62] }, // Cmaj9
    { root: 45, notes: [45, 52, 55, 60, 59] }, // Am9
    { root: 41, notes: [48, 53, 57, 60, 64] }, // Fmaj7
    { root: 43, notes: [50, 55, 59, 62, 64] }, // G6
  ];
  const BELLS = [72, 74, 76, 79, 81, 84, 86, 88];

  const Music = {
    on: false, timer: null, next: 0, chord: 0, nodes: null,
    start() {
      const a = ctx(); if (!a || this.on) return;
      this.on = true;
      // The music's own chain: a gentle low-pass and an echo for the bells.
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; lp.Q.value = 0.4;
      const level = a.createGain(); level.gain.value = 0.0001;
      level.gain.linearRampToValueAtTime(1, a.currentTime + 2);
      lp.connect(level); level.connect(musicBus);
      const echo = a.createDelay(2); echo.delayTime.value = BEAT * 0.75;
      const fb = a.createGain(); fb.gain.value = 0.35;
      const wet = a.createGain(); wet.gain.value = 0.5;
      echo.connect(fb); fb.connect(echo); echo.connect(wet); wet.connect(lp);
      this.nodes = { lp, level, echo };
      this.next = a.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 200);
      this.schedule();
    },
    stop() {
      if (!this.on) return;
      this.on = false;
      clearInterval(this.timer);
      const n = this.nodes;
      if (ac && n) {
        n.level.gain.cancelScheduledValues(ac.currentTime);
        n.level.gain.setTargetAtTime(0.0001, ac.currentTime, 0.4);
        setTimeout(() => n.level.disconnect(), 3000);
      }
      this.nodes = null;
    },
    schedule() {
      if (!this.on || !ac) return;
      while (this.next < ac.currentTime + 1.5) {
        this.bars(this.next, CHORDS[this.chord]);
        this.next += BAR * 2;
        this.chord = (this.chord + 1) % CHORDS.length;
      }
    },
    // Two bars of one chord.
    bars(t, chord) {
      const { lp, echo } = this.nodes;
      const len = BAR * 2;
      // Pad: two soft waves a note, slow in and out.
      chord.notes.forEach((n, i) => {
        for (const [type, detune, vol] of [['triangle', -6, 0.018], ['sine', 7, 0.022]]) {
          const o = ac.createOscillator(), g = ac.createGain();
          o.type = type; o.frequency.value = midi(n); o.detune.value = detune;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(vol, t + 1.2 + i * 0.1);
          g.gain.setValueAtTime(vol, t + len - 1);
          g.gain.linearRampToValueAtTime(0.0001, t + len + 0.6);
          o.connect(g); g.connect(lp); o.start(t); o.stop(t + len + 0.7);
        }
      });
      // A low note on each bar.
      for (let b = 0; b < 2; b++) {
        const o = ac.createOscillator(), g = ac.createGain(), tb = t + b * BAR;
        o.type = 'sine'; o.frequency.value = midi(chord.root);
        g.gain.setValueAtTime(0.0001, tb);
        g.gain.linearRampToValueAtTime(0.07, tb + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, tb + BAR * 0.9);
        o.connect(g); g.connect(lp); o.start(tb); o.stop(tb + BAR);
      }
      // A few bells on the eighths, never two in a row.
      let last = -2;
      for (let e = 0; e < 16; e++) {
        if (e - last < 2 || Math.random() > 0.22) continue;
        last = e;
        const tb = t + e * BEAT / 2 + (e % 2 ? BEAT * 0.06 : 0);
        const n = BELLS[Math.floor(Math.random() * BELLS.length)];
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sine'; o.frequency.value = midi(n);
        g.gain.setValueAtTime(0.0001, tb);
        g.gain.linearRampToValueAtTime(0.035, tb + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, tb + 1.4);
        o.connect(g); g.connect(lp); g.connect(echo);
        o.start(tb); o.stop(tb + 1.5);
      }
    },
  };

  // Quiet while the page is hidden; back where it was when it's shown.
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) ac.suspend();
    else if (sfxLevel || musicLevel) ac.resume();
  });

  // Browsers only allow sound after a tap: wake the audio on the first one.
  window.addEventListener('pointerdown', () => { if (sfxLevel || musicLevel) { ctx(); if (musicLevel && !Music.on) Music.start(); } }, { capture: true });

  window.ConduitSound = { Sfx, setVolumes, VOL_NAMES: ['Off', 'Low', 'Medium', 'High'] };
})();
