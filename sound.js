/* Habit Tracker UI sounds.
   Every sound is synthesised with Web Audio at the moment it plays: no audio files to download or cache,
   and nothing plays until the first tap (browsers only allow audio after a user gesture).
   HTSound.play(name)   tap | check | uncheck | step | allDone
   HTSound.on() / HTSound.toggle()   the on/off choice is kept per device in localStorage ("ht-sound"). */
(function () {
  const KEY = "ht-sound";
  let ctx = null, out = null, noise = null, lastTap = -1;

  const on = () => { try { return localStorage.getItem(KEY) !== "off" } catch (e) { return true } };

  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC({ latencyHint: "interactive" }) } catch (e) { return null }
    out = ctx.createGain(); out.gain.value = 0.6;
    const comp = ctx.createDynamicsCompressor(); // fast taps stack without getting loud or clipping
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.002; comp.release.value = 0.09;
    out.connect(comp).connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 0.04); // 40 ms of decaying noise, reused for every click edge
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
    return ctx;
  }

  function env(g, t, peak, a, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  // a pitched body: sine with an optional downward glide, like a small wooden or glass key
  function tone(t, f0, f1, peak, a, dec) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + a + dec * 0.5);
    env(g, t, peak, a, dec); o.connect(g).connect(out);
    o.start(t); o.stop(t + a + dec + 0.03);
  }
  // the crisp edge of a click: band-passed noise, a few milliseconds long
  function edge(t, freq, peak, dec) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; f.type = "bandpass"; f.frequency.value = freq; f.Q.value = 1.1;
    env(g, t, peak, 0.0008, dec); s.connect(f).connect(g).connect(out);
    s.start(t); s.stop(t + dec + 0.03);
  }
  // a soft chime note: fundamental plus a quiet octave, for the rewarding sounds
  const chime = (t, f, peak, dec) => { tone(t, f, f, peak, 0.004, dec); tone(t, f * 2, f * 2, peak * 0.18, 0.002, dec * 0.45) };

  const SOUNDS = {
    // general tap: a short, soft "tock" with a crisp edge, quiet enough to hear hundreds of times
    tap(t) { edge(t, 4200, 0.30, 0.012); tone(t, 1180, 760, 0.12, 0.0015, 0.04) },
    // ticking a habit: a quick rising fifth (C6 → G6) that feels like a reward
    check(t) { edge(t, 5200, 0.18, 0.01); chime(t, 1046.5, 0.11, 0.14); chime(t + 0.06, 1568, 0.10, 0.26) },
    // unticking: a lower, muted tock that falls in pitch
    uncheck(t) { edge(t, 2600, 0.20, 0.014); tone(t, 660, 420, 0.12, 0.002, 0.07) },
    // one more toward a weekly goal that isn't reached yet
    step(t) { edge(t, 4800, 0.18, 0.01); chime(t, 1318.5, 0.09, 0.12) },
    // the last habit of the day: a bright four-note arpeggio, C6 E6 G6 C7
    allDone(t) { edge(t, 5200, 0.18, 0.01); [1046.5, 1318.5, 1568, 2093].forEach((f, i) => chime(t + i * 0.07, f, 0.09, 0.22 + i * 0.08)) },
  };

  function play(name) {
    if (!on()) return;
    const c = init(); if (!c) return;
    if (c.state === "suspended") c.resume();
    const t = c.currentTime;
    if (name === "tap" && t - lastTap < 0.04) return; // a label and its input fire two clicks for one tap
    if (name === "tap") lastTap = t;
    try { (SOUNDS[name] || SOUNDS.tap)(t + 0.004) } catch (e) { }
  }

  function toggle() {
    const next = !on();
    try { localStorage.setItem(KEY, next ? "on" : "off") } catch (e) { }
    return next;
  }

  /* every tappable thing gets the tap sound; elements listed in OWN play their own sound from the app's handlers */
  const OWN = 'td.c[data-h],.tk[data-h],.wrow[data-w],.tk[data-w],[data-act="tdone"],[data-act="sound"]';
  const TAP = 'button,a[href],select,summary,label,[data-act],[role="button"],input[type="checkbox"],input[type="radio"],' +
    'input[type="date"],input[type="time"],input[type="submit"],input[type="file"]';
  document.addEventListener("click", e => {
    const el = e.target.closest && e.target.closest(OWN + "," + TAP);
    if (!el || el.matches(OWN) || el.disabled) return;
    play("tap");
  }, true);

  window.HTSound = { play, on, toggle };
})();
