/* Conduit: join each pair of dots with a pipe, and fill every square.
 *
 * Drag from a dot to draw its pipe. Drag back over a pipe to shorten it.
 * Crossing another colour's pipe cuts it; drag back off it in the same move
 * and it comes back. A pipe that reaches its other dot stops there.
 */
(function () {
  'use strict';

  const SAVE_KEY = 'conduit.v1'; // never change: it would wipe every save
  const COLORS = [
    '#e5484d', // red
    '#3e8ef7', // blue
    '#30a46c', // green
    '#f5d90a', // yellow
    '#f76b15', // orange
    '#a875e0', // purple
    '#00c2d7', // cyan
    '#e93d82', // pink
    '#b08d6e', // brown
  ];

  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const el = {
    title: document.getElementById('level-title'),
    status: document.getElementById('status'),
    prev: document.getElementById('prev'),
    next: document.getElementById('next'),
    restart: document.getElementById('restart'),
  };

  // ---- save ---------------------------------------------------------------

  const save = load();
  function load() {
    const fresh = { v: 1, level: 1, unlocked: 1 };
    try {
      const got = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (got && got.v === 1) return Object.assign(fresh, got);
    } catch (e) { /* no storage, or a bad save: start fresh */ }
    return fresh;
  }
  function store() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* private mode */ }
  }

  // ---- state --------------------------------------------------------------

  let puzzle;       // from ConduitLevels.make
  let n;            // grid size
  let dotColor;     // cell -> colour of the dot there, or -1
  let base;         // pipes before the current drag, one list of cells per colour
  let pipes;        // pipes as drawn right now
  let drag = null;  // { color, path } while a finger or mouse is down
  let pointer = null;
  let solved = false;

  function start(level) {
    puzzle = ConduitLevels.make(level);
    n = puzzle.size;
    dotColor = new Array(n * n).fill(-1);
    puzzle.dots.forEach(([a, b], c) => { dotColor[a] = c; dotColor[b] = c; });
    base = puzzle.dots.map(() => []);
    pipes = base.map((p) => p.slice());
    drag = null;
    solved = false;
    save.level = level;
    store();
    el.title.textContent = `Level ${level} · ${n}×${n}`;
    update();
  }

  // ---- rules --------------------------------------------------------------

  const adjacent = (a, b) =>
    (Math.abs(a - b) === n && a % n === b % n) ||
    (Math.abs(a - b) === 1 && Math.floor(a / n) === Math.floor(b / n));

  function joined(c, path = pipes[c]) {
    if (path.length < 2) return false;
    const [a, b] = puzzle.dots[c];
    const first = path[0], last = path[path.length - 1];
    return (first === a && last === b) || (first === b && last === a);
  }

  // The drag's pipe wins: every other pipe is cut where the drag crosses it.
  function compose() {
    const taken = new Set(drag.path);
    pipes = base.map((p, c) => {
      if (c === drag.color) return drag.path.slice();
      const i = p.findIndex((cell) => taken.has(cell));
      return i < 0 ? p.slice() : p.slice(0, i);
    });
  }

  function owner() {
    const out = new Array(n * n).fill(-1);
    pipes.forEach((p, c) => p.forEach((cell) => { out[cell] = c; }));
    return out;
  }

  function begin(cell) {
    const own = owner();
    const c = dotColor[cell] >= 0 ? dotColor[cell] : own[cell];
    if (c < 0) return;
    base = pipes.map((p) => p.slice());
    if (dotColor[cell] === c) {
      drag = { color: c, path: [cell] };       // from a dot: start this pipe over
    } else {
      const p = base[c];
      drag = { color: c, path: p.slice(0, p.indexOf(cell) + 1) }; // pick up mid pipe
    }
    compose();
    update();
  }

  function step(cell) {
    const path = drag.path;
    const last = path[path.length - 1];
    if (cell === last || !adjacent(last, cell)) return;
    const back = path.indexOf(cell);
    if (back >= 0) { path.length = back + 1; return; }  // shorten
    if (joined(drag.color, path)) return;              // already at its other dot
    const d = dotColor[cell];
    if (d >= 0 && d !== drag.color) return;            // someone else's dot
    path.push(cell);
    if (d === drag.color) buzz();
  }

  // Fast moves can skip squares: walk there one square at a time.
  function moveTo(cell) {
    if (!drag) return;
    let guard = n * 2;
    while (guard-- > 0) {
      const last = drag.path[drag.path.length - 1];
      if (last === cell) break;
      const lr = Math.floor(last / n), lc = last % n;
      const tr = Math.floor(cell / n), tc = cell % n;
      const dr = Math.sign(tr - lr), dc = Math.sign(tc - lc);
      const nextCell = Math.abs(tr - lr) >= Math.abs(tc - lc) ? last + dr * n : last + dc;
      const before = drag.path.length;
      step(nextCell);
      if (drag.path.length === before && drag.path[before - 1] === last) break; // blocked
    }
    compose();
    update();
  }

  function end() {
    if (!drag) return;
    drag = null;
    base = pipes.map((p) => p.slice());
    update();
    check();
  }

  function check() {
    const allJoined = pipes.every((_, c) => joined(c));
    const filled = owner().every((c) => c >= 0);
    if (allJoined && filled && !solved) {
      solved = true;
      if (save.unlocked <= save.level) save.unlocked = save.level + 1;
      store();
      buzz(30);
    }
    update();
  }

  // ---- screen -------------------------------------------------------------

  function update() {
    const joinedCount = pipes.filter((_, c) => joined(c)).length;
    const own = owner();
    const filled = own.filter((c) => c >= 0).length;
    const pct = Math.round((filled / (n * n)) * 100);
    if (solved) {
      el.status.textContent = 'Solved.';
    } else if (joinedCount === pipes.length && filled < n * n) {
      el.status.textContent = 'All joined. Every square needs a pipe.';
    } else {
      el.status.textContent = `Pipes ${joinedCount}/${pipes.length} · Filled ${pct}%`;
    }
    el.prev.disabled = save.level <= 1;
    el.next.disabled = save.level >= save.unlocked;
    el.next.classList.toggle('is-ready', solved);
    draw(own);
  }

  function draw(own) {
    const dpr = window.devicePixelRatio || 1;
    const px = canvas.clientWidth;
    if (canvas.width !== Math.round(px * dpr)) {
      canvas.width = canvas.height = Math.round(px * dpr);
    }
    const cell = canvas.width / n;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Squares with a pipe in them get a wash of its colour.
    for (let i = 0; i < n * n; i++) {
      if (own[i] < 0) continue;
      ctx.fillStyle = COLORS[own[i]] + (solved ? '40' : '26');
      ctx.fillRect((i % n) * cell, Math.floor(i / n) * cell, cell, cell);
    }

    // Grid.
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = Math.max(1, dpr);
    ctx.beginPath();
    for (let k = 0; k <= n; k++) {
      const x = Math.round(k * cell) + 0.5;
      ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height);
      ctx.moveTo(0, x); ctx.lineTo(canvas.width, x);
    }
    ctx.stroke();

    const centre = (i) => [(i % n + 0.5) * cell, (Math.floor(i / n) + 0.5) * cell];

    // Pipes.
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = cell * 0.34;
    pipes.forEach((p, c) => {
      if (p.length < 2) return;
      ctx.strokeStyle = COLORS[c];
      ctx.beginPath();
      p.forEach((i, k) => { const [x, y] = centre(i); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
    });

    // Dots (a ring on the ones whose pipe is joined).
    puzzle.dots.forEach(([a, b], c) => {
      for (const i of [a, b]) {
        const [x, y] = centre(i);
        ctx.fillStyle = COLORS[c];
        ctx.beginPath();
        ctx.arc(x, y, cell * 0.33, 0, Math.PI * 2);
        ctx.fill();
        if (joined(c)) {
          ctx.strokeStyle = 'rgba(255,255,255,0.85)';
          ctx.lineWidth = Math.max(2, cell * 0.04);
          ctx.stroke();
        }
      }
    });

    // Under the finger, so you can see what you're dragging.
    if (drag && pointer) {
      ctx.fillStyle = COLORS[drag.color] + '55';
      ctx.beginPath();
      ctx.arc(pointer.x * dpr, pointer.y * dpr, cell * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function buzz(ms = 8) {
    if (navigator.vibrate) navigator.vibrate(ms);
  }

  // ---- input --------------------------------------------------------------

  function cellAt(e) {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    pointer = { x, y };
    const c = Math.floor((x / r.width) * n), row = Math.floor((y / r.height) * n);
    if (c < 0 || row < 0 || c >= n || row >= n) return -1;
    return row * n + c;
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
    if (cell >= 0) moveTo(cell);
    else update();
  });
  canvas.addEventListener('pointerup', () => { pointer = null; end(); });
  canvas.addEventListener('pointercancel', () => { pointer = null; end(); });

  el.prev.addEventListener('click', () => start(save.level - 1));
  el.next.addEventListener('click', () => start(save.level + 1));
  el.restart.addEventListener('click', () => start(save.level));
  window.addEventListener('resize', () => update());

  start(Math.min(save.level, save.unlocked));
})();
