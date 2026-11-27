/* Conduit: join each pair of dots with a pipe, and fill every square.
 *
 * Screens: home, levels (a pack's levels with ✓ and ★), play, settings.
 * Levels come from packs (packs/*.js, made by tools/make-pack.js). Every
 * level has exactly one solution and it fills the board, so the fewest moves
 * is one per colour.
 *
 * Moves are counted the usual way for this kind of puzzle: a drag that
 * changes the board is a move unless it's the same colour as the move
 * before. Solved = ✓. Solved in one move per colour = ★ (flawless).
 */
(function () {
  'use strict';

  const SAVE_KEY = 'conduit.v1'; // never change: it would wipe every save
  const SAVE_VER = 2;
  const COLORS = ['#e5484d', '#3e8ef7', '#30a46c', '#f5d90a', '#f76b15', '#a875e0', '#00c2d7', '#e93d82', '#b08d6e'];
  const LETTERS = 'ABCDEFGHI';
  const OPEN_AHEAD = 3; // levels open past the furthest one solved
  const { Sfx, setVolumes, VOL_NAMES } = window.ConduitSound;
  const PACKS = window.CONDUIT_PACKS || [];

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---- save ---------------------------------------------------------------
  // { v, sfx, music, buzz, letters, done: { pack: { id: { r, m } } }, at }
  // r: 1 solved, 2 flawless. m: fewest moves. at: the level last opened.

  const save = load();
  function fresh() {
    return { v: SAVE_VER, sfx: 0, music: 0, buzz: true, letters: false, done: {}, at: { pack: PACKS[0] && PACKS[0].id, level: 1 } };
  }
  function load() {
    let got = null;
    try { got = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { /* none, or bad */ }
    return migrate(got);
  }
  // Each step walks an old save up one version.
  function migrate(got) {
    if (!got || typeof got !== 'object') return fresh();
    // v1 (2026-11-27, the first build): levels were made from their number
    // and are gone; nothing in it carries over.
    if (got.v === 1) got = fresh();
    return Object.assign(fresh(), got, { v: SAVE_VER });
  }
  function store() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* private mode */ }
  }

  const packById = (id) => PACKS.find((p) => p.id === id) || PACKS[0];
  const doneIn = (pack) => save.done[pack.id] || (save.done[pack.id] = {});
  function furthest(pack) {
    const d = doneIn(pack);
    return pack.levels.reduce((m, l) => (d[l.id] ? Math.max(m, l.id) : m), 0);
  }
  const isOpen = (pack, id) => id <= furthest(pack) + OPEN_AHEAD;
  function counts(pack) {
    const d = doneIn(pack);
    let solved = 0, stars = 0;
    pack.levels.forEach((l) => { if (d[l.id]) { solved++; if (d[l.id].r === 2) stars++; } });
    return { solved, stars, total: pack.levels.length };
  }

  // ---- screens ------------------------------------------------------------

  let screen = 'home';
  function show(name, push = true) {
    screen = name;
    document.querySelectorAll('.screen').forEach((el) => { el.hidden = el.id !== 'screen-' + name; });
    if (name === 'home') drawHome();
    if (name === 'levels') drawLevels();
    if (name === 'settings') drawSettings();
    if (name === 'play') requestAnimationFrame(() => update());
    if (push) history.pushState({ screen: name }, '');
    window.scrollTo(0, 0);
  }
  window.addEventListener('popstate', (e) => show((e.state && e.state.screen) || 'home', false));

  function drawHome() {
    const pack = packById(save.at.pack);
    const c = counts(pack);
    const next = pack.levels.find((l) => !doneIn(pack)[l.id] && isOpen(pack, l.id)) || pack.levels[pack.levels.length - 1];
    $('#home-go').textContent = c.solved ? `Play level ${next.id}` : 'Play';
    $('#home-go').dataset.level = next.id;
    $('#home-count').textContent = c.solved ? `✓ ${c.solved} of ${c.total} · ★ ${c.stars}` : `${c.total} levels`;
  }

  function drawLevels() {
    const pack = packById(save.at.pack);
    const c = counts(pack), d = doneIn(pack);
    $('#levels-title').textContent = pack.name;
    $('#levels-blurb').textContent = pack.blurb;
    $('#levels-count').textContent = `✓ ${c.solved} of ${c.total} · ★ ${c.stars} of ${c.total}`;
    let html = '', size = '';
    pack.levels.forEach((l) => {
      const s = `${l.w}×${l.h}`;
      if (s !== size) { size = s; html += `<h3 class="size">${s}</h3>`; }
      const r = d[l.id] ? d[l.id].r : 0, open = isOpen(pack, l.id);
      const mark = r === 2 ? '★' : r === 1 ? '✓' : '';
      const label = `Level ${l.id}${r === 2 ? ', flawless' : r === 1 ? ', solved' : open ? '' : ', locked'}`;
      html += `<button class="lvl${r === 2 ? ' is-star' : r ? ' is-done' : ''}${l.id === save.at.level ? ' is-at' : ''}" data-level="${l.id}" ${open ? '' : 'disabled'} aria-label="${label}">` +
        `<span class="n">${l.id}</span><span class="mark">${mark}</span></button>`;
    });
    $('#levels-grid').innerHTML = html;
    const at = $('#levels-grid .is-at');
    if (at) at.scrollIntoView({ block: 'center' });
  }

  function drawSettings() {
    const vol = (key) => VOL_NAMES.map((n, i) =>
      `<button type="button" class="seg${save[key] === i ? ' is-on' : ''}" data-set="${key}" data-val="${i}" aria-pressed="${save[key] === i}">${n}</button>`).join('');
    const onOff = (key) => [['On', true], ['Off', false]].map(([n, v]) =>
      `<button type="button" class="seg${save[key] === v ? ' is-on' : ''}" data-set="${key}" data-val="${v}" aria-pressed="${save[key] === v}">${n}</button>`).join('');
    $('#settings-body').innerHTML =
      `<div class="set"><span class="label">Sound</span><div class="segs">${vol('sfx')}</div></div>` +
      `<div class="set"><span class="label">Music</span><div class="segs">${vol('music')}</div></div>` +
      (navigator.vibrate ? `<div class="set"><span class="label">Vibration</span><div class="segs">${onOff('buzz')}</div></div>` : '') +
      `<div class="set"><span class="label">Letters on the dots</span><div class="segs">${onOff('letters')}</div>` +
      `<p class="fine">For telling colours apart.</p></div>` +
      `<div class="set"><span class="label">On your home screen</span>${installHtml()}</div>` +
      `<div class="set"><span class="label">Save code</span>` +
      `<p class="fine">Your ✓ and ★ as one line of text, to move them to another phone or browser.</p>` +
      `<div class="row"><button type="button" class="btn" data-act="copy-code">Copy my code</button></div>` +
      `<div class="row"><input id="code-in" type="text" placeholder="Paste a code" autocomplete="off" spellcheck="false">` +
      `<button type="button" class="btn" data-act="load-code">Load</button></div><p class="fine" id="code-msg" aria-live="polite"></p></div>` +
      `<div class="set"><span class="label">Start over</span>` +
      `<p class="fine">Clears every ✓ and ★ on this phone. Settings stay.</p>` +
      `<div class="row"><button type="button" class="btn btn--warn" data-act="wipe">Clear my progress</button></div></div>`;
  }

  // ---- home screen install (as in Order Up) --------------------------------
  // Android and desktop Chrome offer an install prompt a button can show;
  // iPhones only from Safari's Share menu; in-app browsers (Facebook,
  // Instagram) can't at all.

  let installEvt = null;
  const UA = navigator.userAgent || '';
  const inApp = /FBAN|FBAV|FB_IAB/.test(UA) ? 'Facebook' : /Instagram/.test(UA) ? 'Instagram' : /\bLine\//.test(UA) ? 'Line' : '';
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; if (screen === 'settings') drawSettings(); });
  window.addEventListener('appinstalled', () => { installEvt = null; if (screen === 'settings') drawSettings(); });
  try { if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js'); } catch (e) { /* no matter */ }
  function installHtml() {
    const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
    const ios = /iPhone|iPad|iPod/.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1);
    const keep = ' Copy your save code first: on an iPhone the home-screen game keeps its own progress.';
    if (standalone) return '<p class="fine">You’re playing from your home screen.</p>';
    if (inApp) return `<p class="fine">${esc(inApp)}’s own browser can’t do it. Open the ⋯ menu, choose <b>Open in browser</b>, then come back to Settings.</p>`;
    if (installEvt) return '<div class="row"><button type="button" class="btn" data-act="install">Add to Home Screen</button></div>';
    if (ios) return `<p class="fine">In Safari, tap the <b>Share</b> button, then <b>Add to Home Screen</b>.${keep}</p>`;
    return '<p class="fine">Open your browser’s menu and choose <b>Add to Home screen</b> or <b>Install app</b>.</p>';
  }

  // ---- save code -----------------------------------------------------------
  // CN1.<base64 of { pack: [[id, r, m], ...] }>.<check>. Loading only adds:
  // the better result of each level wins.

  function sum(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h.toString(36); }
  function makeCode() {
    const data = {};
    Object.keys(save.done).forEach((p) => { data[p] = Object.keys(save.done[p]).map((id) => [+id, save.done[p][id].r, save.done[p][id].m]); });
    const body = btoa(JSON.stringify(data)).replace(/=+$/, '');
    return `CN1.${body}.${sum(body)}`;
  }
  function loadCode(code) {
    const m = /^CN1\.([A-Za-z0-9+/]+)\.([a-z0-9]+)$/.exec(code.trim());
    if (!m || sum(m[1]) !== m[2]) return 'That code isn’t right. Copy it again, all of it.';
    let data;
    try { data = JSON.parse(atob(m[1])); } catch (e) { return 'That code isn’t right. Copy it again, all of it.'; }
    let added = 0;
    Object.keys(data).forEach((p) => {
      const d = save.done[p] || (save.done[p] = {});
      data[p].forEach(([id, r, mv]) => {
        const had = d[id];
        if (!had || r > had.r || (r === had.r && mv < had.m)) { d[id] = { r, m: had ? Math.min(had.m, mv) : mv }; added++; }
      });
    });
    store();
    return added ? `Loaded. ${added} level${added === 1 ? '' : 's'} added or improved.` : 'Loaded: nothing new in it for this phone.';
  }

  // ---- play state ---------------------------------------------------------

  const canvas = $('#board');
  const g = canvas.getContext('2d');
  let pack, level;      // the pack and the level being played
  let w, h, N, K;       // width, height, squares, colours
  let dots;             // [[a, b], ...] per colour
  let dotColor;         // square -> colour of the dot there, or -1
  let base, pipes;      // pipes before the drag, and as drawn now
  let drag = null;      // { color, path } while a finger is down
  let pointer = null;
  let undo = [];        // boards before each change
  let moves = 0, lastColor = -1;
  let solved = false, result = 0;

  function open(packId, id) {
    pack = packById(packId);
    level = pack.levels.find((l) => l.id === id) || pack.levels[0];
    save.at = { pack: pack.id, level: level.id };
    store();
    w = level.w; h = level.h; N = w * h;
    const found = {};
    level.grid.join('').split('').forEach((ch, i) => { if (ch !== '.') (found[ch] = found[ch] || []).push(i); });
    dots = Object.keys(found).sort().map((ch) => found[ch]);
    K = dots.length;
    dotColor = new Array(N).fill(-1);
    dots.forEach(([a, b], c) => { dotColor[a] = c; dotColor[b] = c; });
    restart();
    $('#play-title').textContent = `Level ${level.id}`;
    $('#play-sub').textContent = `${w}×${h} · ★ in ${K} move${K === 1 ? '' : 's'}`;
    canvas.style.setProperty('--ratio', `${w} / ${h}`);
    canvas.style.setProperty('--w', w);
    canvas.style.setProperty('--h', h);
    const best = doneIn(pack)[level.id];
    $('#play-best').textContent = best ? (best.r === 2 ? 'Flawless before ★' : `Solved before ✓ · best ${best.m} moves`) : '';
    $('#help').hidden = level.id > 3;
    $('#help').textContent = level.id === 1
      ? 'Drag from a dot to the other dot. Every square needs a pipe, so go the long way round.'
      : 'Join each pair of dots. Pipes can’t cross, and every square needs one.';
  }

  function restart() {
    base = dots.map(() => []);
    pipes = base.map((p) => p.slice());
    undo = [];
    drag = null; moves = 0; lastColor = -1; solved = false; result = 0;
    $('#result').hidden = true;
    update();
  }

  // ---- rules --------------------------------------------------------------

  const adjacent = (a, b) =>
    (Math.abs(a - b) === w && a % w === b % w) ||
    (Math.abs(a - b) === 1 && Math.floor(a / w) === Math.floor(b / w));

  function joined(c, path = pipes[c]) {
    if (path.length < 2) return false;
    const [a, b] = dots[c], first = path[0], last = path[path.length - 1];
    return (first === a && last === b) || (first === b && last === a);
  }

  // The drag's pipe wins: other pipes are cut where it crosses them, and
  // come back if it moves off again before the finger lifts.
  function compose() {
    const taken = new Set(drag.path);
    pipes = base.map((p, c) => {
      if (c === drag.color) return drag.path.slice();
      const i = p.findIndex((cell) => taken.has(cell));
      return i < 0 ? p.slice() : p.slice(0, i);
    });
  }

  function owner() {
    const o = new Array(N).fill(-1);
    pipes.forEach((p, c) => p.forEach((cell) => { o[cell] = c; }));
    return o;
  }

  const same = (a, b) => a.length === b.length && a.every((p, c) => p.length === b[c].length && p.every((x, i) => x === b[c][i]));

  function begin(cell) {
    const o = owner();
    const c = dotColor[cell] >= 0 ? dotColor[cell] : o[cell];
    if (c < 0) return;
    base = pipes.map((p) => p.slice());
    if (dotColor[cell] === c) drag = { color: c, path: [cell] };
    else drag = { color: c, path: base[c].slice(0, base[c].indexOf(cell) + 1) };
    Sfx.pick(c);
    compose();
    update();
  }

  function step(cell) {
    const path = drag.path, last = path[path.length - 1];
    if (cell === last || !adjacent(last, cell)) return false;
    const back = path.indexOf(cell);
    if (back >= 0) { path.length = back + 1; return true; }
    if (joined(drag.color, path)) return false;
    const d = dotColor[cell];
    if (d >= 0 && d !== drag.color) return false;
    path.push(cell);
    if (d === drag.color) { Sfx.join(drag.color); buzz(12); }
    else Sfx.step(drag.color, path.length);
    return true;
  }

  // Fast moves skip squares: walk there one square at a time.
  function moveTo(cell) {
    if (!drag) return;
    const others = () => pipes.reduce((n, p, c) => (c === drag.color ? n : n + p.length), 0);
    const before = others();
    for (let guard = w + h; guard > 0; guard--) {
      const last = drag.path[drag.path.length - 1];
      if (last === cell) break;
      const lr = Math.floor(last / w), lc = last % w, tr = Math.floor(cell / w), tc = cell % w;
      const next = Math.abs(tr - lr) >= Math.abs(tc - lc) ? last + Math.sign(tr - lr) * w : last + Math.sign(tc - lc);
      if (!step(next)) break;
    }
    compose();
    if (others() < before) Sfx.cut();
    update();
  }

  function end() {
    if (!drag) return;
    const c = drag.color;
    drag = null;
    const before = base;
    if (!same(before, pipes)) {
      undo.push(before);
      if (c !== lastColor) { moves++; lastColor = c; }
    }
    base = pipes.map((p) => p.slice());
    check();
  }

  function doUndo() {
    if (!undo.length || solved) return;
    base = undo.pop();
    pipes = base.map((p) => p.slice());
    lastColor = -1; // the next drag counts as a move, whatever its colour
    Sfx.undo();
    update();
  }

  function check() {
    const allJoined = pipes.every((_, c) => joined(c));
    const filled = owner().every((c) => c >= 0);
    if (allJoined && filled && !solved) {
      solved = true;
      result = moves <= K ? 2 : 1;
      const d = doneIn(pack), had = d[level.id];
      d[level.id] = { r: Math.max(result, had ? had.r : 0), m: had ? Math.min(had.m, moves) : moves };
      store();
      if (result === 2) Sfx.flawless(); else Sfx.solved();
      buzz(result === 2 ? [20, 60, 20, 60, 40] : 30);
      showResult();
    }
    update();
  }

  function showResult() {
    const next = pack.levels.find((l) => l.id === level.id + 1);
    $('#result-mark').textContent = result === 2 ? '★' : '✓';
    $('#result-mark').className = 'result-mark' + (result === 2 ? ' is-star' : '');
    $('#result-title').textContent = result === 2 ? 'Flawless' : 'Solved';
    $('#result-text').textContent = result === 2
      ? `${moves} move${moves === 1 ? '' : 's'}, one per colour.`
      : `${moves} moves. A ★ takes ${K}: one per colour, each drawn in one go.`;
    $('#result-next').hidden = !next;
    $('#result-again').textContent = result === 2 ? 'Play again' : 'Try for ★';
    $('#result').hidden = false;
  }

  // ---- drawing ------------------------------------------------------------

  function update() {
    if (!pack || screen !== 'play') return;
    const o = owner();
    const joinedCount = pipes.filter((_, c) => joined(c)).length;
    const filled = o.filter((c) => c >= 0).length;
    let text = `Moves ${moves} · Pipes ${joinedCount}/${K} · Filled ${Math.round((filled / N) * 100)}%`;
    if (!solved && joinedCount === K && filled < N) text = 'All joined. Every square needs a pipe.';
    $('#status').textContent = text;
    $('#undo').disabled = !undo.length || solved;
    draw(o);
  }

  function draw(o) {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
    if (!cssW) return;
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }
    const cell = canvas.width / w;
    g.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < N; i++) {
      if (o[i] < 0) continue;
      g.fillStyle = COLORS[o[i]] + (solved ? '48' : '28');
      g.fillRect((i % w) * cell, Math.floor(i / w) * cell, cell, cell);
    }

    g.strokeStyle = 'rgba(255,255,255,0.13)';
    g.lineWidth = Math.max(1, dpr);
    g.beginPath();
    for (let k = 0; k <= w; k++) { const x = Math.round(k * cell) + 0.5; g.moveTo(x, 0); g.lineTo(x, canvas.height); }
    for (let k = 0; k <= h; k++) { const y = Math.round(k * cell) + 0.5; g.moveTo(0, y); g.lineTo(canvas.width, y); }
    g.stroke();

    const centre = (i) => [(i % w + 0.5) * cell, (Math.floor(i / w) + 0.5) * cell];
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.lineWidth = cell * 0.34;
    pipes.forEach((p, c) => {
      if (p.length < 2) return;
      g.strokeStyle = COLORS[c];
      g.beginPath();
      p.forEach((i, k) => { const [x, y] = centre(i); if (k) g.lineTo(x, y); else g.moveTo(x, y); });
      g.stroke();
    });

    dots.forEach(([a, b], c) => {
      for (const i of [a, b]) {
        const [x, y] = centre(i);
        g.fillStyle = COLORS[c];
        g.beginPath(); g.arc(x, y, cell * 0.33, 0, Math.PI * 2); g.fill();
        if (joined(c)) {
          g.strokeStyle = 'rgba(255,255,255,0.85)';
          g.lineWidth = Math.max(2, cell * 0.04);
          g.stroke();
        }
        if (save.letters) {
          g.fillStyle = 'rgba(0,0,0,0.72)';
          g.font = `700 ${Math.round(cell * 0.34)}px system-ui, sans-serif`;
          g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(LETTERS[c], x, y + cell * 0.02);
        }
      }
    });

    if (drag && pointer) {
      g.fillStyle = COLORS[drag.color] + '55';
      g.beginPath(); g.arc(pointer.x * dpr, pointer.y * dpr, cell * 0.45, 0, Math.PI * 2); g.fill();
    }
  }

  function buzz(pattern) {
    if (save.buzz && navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) { /* no matter */ } }
  }

  // ---- input --------------------------------------------------------------

  function cellAt(e) {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    pointer = { x, y };
    const c = Math.floor((x / r.width) * w), row = Math.floor((y / r.height) * h);
    return c < 0 || row < 0 || c >= w || row >= h ? -1 : row * w + c;
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (solved) return;
    const cell = cellAt(e);
    if (cell < 0) return;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
    begin(cell);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const cell = cellAt(e);
    if (cell >= 0) moveTo(cell); else update();
  });
  canvas.addEventListener('pointerup', () => { pointer = null; end(); });
  canvas.addEventListener('pointercancel', () => { pointer = null; end(); });
  window.addEventListener('resize', () => update());

  // Every button on every screen.
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button, [data-go]');
    if (!b) return;
    const lvl = b.closest('#levels-grid .lvl');
    if (lvl) { Sfx.tap(); open(save.at.pack, +lvl.dataset.level); show('play'); return; }
    if (b.dataset.go) { Sfx.tap(); if (b.dataset.go === 'back') history.back(); else show(b.dataset.go); return; }
    if (b.dataset.set) {
      const key = b.dataset.set, raw = b.dataset.val;
      save[key] = raw === 'true' ? true : raw === 'false' ? false : +raw;
      store();
      setVolumes(save.sfx, save.music);
      Sfx.tap();
      drawSettings();
      return;
    }
    switch (b.id || b.dataset.act) {
      case 'home-go': Sfx.tap(); open(save.at.pack, +b.dataset.level); show('play'); break;
      case 'undo': doUndo(); break;
      case 'restart': Sfx.tap(); restart(); break;
      case 'result-again': Sfx.tap(); restart(); break;
      case 'result-next': Sfx.tap(); open(pack.id, level.id + 1); update(); break;
      case 'install':
        if (installEvt) { installEvt.prompt(); installEvt.userChoice.finally(() => { installEvt = null; drawSettings(); }); }
        break;
      case 'copy-code': {
        const code = makeCode();
        const msg = $('#code-msg');
        (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject())
          .then(() => { msg.textContent = 'Copied. Paste it into Settings on the other phone.'; })
          .catch(() => { $('#code-in').value = code; $('#code-in').select(); msg.textContent = 'Copy the code from the box.'; });
        break;
      }
      case 'load-code': $('#code-msg').textContent = loadCode($('#code-in').value); break;
      case 'wipe':
        if (b.dataset.sure) { save.done = {}; save.at.level = 1; store(); drawSettings(); $('#code-msg').textContent = ''; }
        else { b.dataset.sure = '1'; b.textContent = 'Tap again to clear everything'; }
        break;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (screen !== 'play') return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); doUndo(); }
  });

  // ---- start --------------------------------------------------------------
  setVolumes(save.sfx, save.music);
  open(save.at.pack, save.at.level);
  history.replaceState({ screen: 'home' }, '');
  show('home', false);
})();
