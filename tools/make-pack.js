// Makes the Basics pack: public/packs/basics.js. Run: node tools/make-pack.js
//
// Each level comes from a walk through every square of the grid, shuffled
// with "backbite" moves (take an end of the walk, pick a square next to it
// that the walk reaches later, flip the part in between) and cut into one
// piece per colour. The pieces' ends are the dots. A level is kept only if:
//   - no pipe runs alongside itself (a pipe touching an earlier part of
//     itself has a shortcut, and looks wrong; the cut makes sure of it);
//   - no pipe longer than two squares has its dots side by side;
//   - it has the number of colours the plan asks for;
//   - the solver finds exactly one solution. So every level has one answer,
//     it fills every square, and the fewest moves is one per colour.
// Within a size, levels go from least to most searching for the solver.
//
// The output is fixed data: a published pack never changes, only grows at
// the end (saves keep results by level id). Changing SEED or PLAN here
// changes the levels, so only do it before a pack is published, or make a
// new pack.
'use strict';
const fs = require('fs');
const path = require('path');
const { solve } = require('./solver');

const PACK = { id: 'basics', name: 'Basics', blurb: 'Join the dots. Fill every square.' };
const SEED = 20261127;
// [width, height, fewest colours, most colours, how many]
const PLAN = [
  [2, 2, 1, 1, 1],
  [3, 2, 1, 1, 1],
  [3, 3, 2, 2, 2],
  [3, 3, 3, 3, 2],
  [4, 4, 3, 3, 3],
  [4, 4, 4, 4, 4],
  [5, 5, 4, 4, 5],
  [5, 5, 5, 5, 6],
  [6, 6, 5, 5, 6],
  [6, 6, 6, 6, 6],
  [7, 7, 6, 7, 6],
  [7, 7, 7, 8, 6],
  [8, 8, 7, 8, 6],
  [8, 8, 8, 9, 6],
];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function neighbours(i, w, h) {
  const r = Math.floor(i / w), c = i % w, out = [];
  if (r > 0) out.push(i - w);
  if (r < h - 1) out.push(i + w);
  if (c > 0) out.push(i - 1);
  if (c < w - 1) out.push(i + 1);
  return out;
}

function walk(w, h, rand) {
  const path = [];
  for (let r = 0; r < h; r++) for (let i = 0; i < w; i++) path.push(r * w + (r % 2 ? w - 1 - i : i));
  const at = new Array(path.length);
  const index = () => path.forEach((cell, i) => { at[cell] = i; });
  index();
  const steps = path.length * 40 + Math.floor(rand() * path.length);
  for (let s = 0; s < steps; s++) {
    const headEnd = rand() < 0.5;
    const end = headEnd ? path[0] : path[path.length - 1];
    const next = headEnd ? path[1] : path[path.length - 2];
    const options = neighbours(end, w, h).filter((x) => x !== next);
    if (!options.length) continue;
    const i = at[options[Math.floor(rand() * options.length)]];
    let a = headEnd ? 0 : i + 1, b = headEnd ? i - 1 : path.length - 1;
    while (a < b) { const t = path[a]; path[a] = path[b]; path[b] = t; a++; b--; }
    index();
  }
  return path;
}

// Cut the walk into pipes. A pipe ends where the next square would touch
// it anywhere but its last square (so no pipe runs alongside itself), or at
// a random length near the size wanted. Pipes shorter than `least` spoil the
// try. One pipe (k = 1) is the whole walk.
function cut(path, k, least, rand) {
  if (k === 1) return [path.slice()];
  const want = path.length / k;
  const pieces = [];
  let cur = [], inCur = new Set(), stop = 0;
  const begin = (cell) => { cur = [cell]; inCur = new Set([cell]); stop = Math.max(least, Math.round(want * (0.6 + rand() * 0.8))); };
  begin(path[0]);
  for (let i = 1; i < path.length; i++) {
    const x = path[i], last = cur[cur.length - 1];
    const touches = NB(x).some((n) => n !== last && inCur.has(n));
    if (touches || cur.length >= stop) { pieces.push(cur); begin(x); }
    else { cur.push(x); inCur.add(x); }
  }
  pieces.push(cur);
  return pieces.some((p) => p.length < least) ? null : pieces;
}
let NB = null;

function looksRight(pieces, w, h) {
  // One pipe on its own (the first levels) has to wind back on itself; the
  // solver alone decides those.
  if (pieces.length === 1) return true;
  for (const p of pieces) {
    if (p.length > 2 && neighbours(p[0], w, h).includes(p[p.length - 1])) return false;
    const at = new Map(p.map((c, i) => [c, i]));
    for (let i = 0; i < p.length; i++) {
      for (const n of neighbours(p[i], w, h)) {
        const j = at.get(n);
        if (j !== undefined && Math.abs(j - i) > 1) return false;
      }
    }
  }
  return true;
}

const LETTERS = 'ABCDEFGHI';
function rows(w, h, fill) {
  const out = [];
  for (let r = 0; r < h; r++) {
    let s = '';
    for (let c = 0; c < w; c++) s += fill(r * w + c);
    out.push(s);
  }
  return out;
}

const rand = rng(SEED);
const levels = [];
const seen = new Set();
for (const [w, h, kMin, kMax, count] of PLAN) {
  NB = (i) => neighbours(i, w, h);
  const found = [];
  let tries = 0;
  const started = Date.now();
  while (found.length < count) {
    if (++tries > 200000) throw new Error(`Gave up on ${w}x${h} with ${kMin}-${kMax} colours`);
    const k = kMin + Math.floor(rand() * (kMax - kMin + 1));
    const pieces = cut(walk(w, h, rand), k, w * h <= 4 ? 2 : 3, rand);
    if (!pieces || pieces.length < kMin || pieces.length > kMax || !looksRight(pieces, w, h)) continue;
    // Colours in reading order of their first dot, so A is always top-left-most.
    const dots = pieces.map((p) => (p[0] < p[p.length - 1] ? [p[0], p[p.length - 1]] : [p[p.length - 1], p[0]]));
    const order = dots.map((d, i) => i).sort((a, b) => dots[a][0] - dots[b][0]);
    const sorted = order.map((i) => dots[i]);
    const sortedPieces = order.map((i) => pieces[i]);
    const key = `${w}x${h}:${sorted.map((d) => d.join('-')).join(',')}`;
    if (seen.has(key)) continue;
    const result = solve({ w, h, dots: sorted }, 2, 3e5);
    if (result.count !== 1) continue;
    seen.add(key);
    const owner = new Array(w * h);
    sortedPieces.forEach((p, c) => p.forEach((cell) => { owner[cell] = c; }));
    const dotAt = new Map();
    sorted.forEach(([a, b], c) => { dotAt.set(a, c); dotAt.set(b, c); });
    found.push({
      w, h,
      grid: rows(w, h, (i) => (dotAt.has(i) ? LETTERS[dotAt.get(i)] : '.')),
      solution: rows(w, h, (i) => LETTERS[owner[i]].toLowerCase()),
      effort: result.nodes,
    });
  }
  found.sort((a, b) => a.effort - b.effort);
  levels.push(...found);
  console.log(`${w}x${h}, ${kMin}-${kMax} colours: ${count} levels from ${tries} tries in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

const pack = Object.assign({}, PACK, {
  levels: levels.map((l, i) => ({ id: i + 1, w: l.w, h: l.h, grid: l.grid, solution: l.solution })),
});
const out = path.join(__dirname, '..', 'public', 'packs', `${PACK.id}.js`);
fs.mkdirSync(path.dirname(out), { recursive: true });
const body = pack.levels.map((l) => '    ' + JSON.stringify(l)).join(',\n');
fs.writeFileSync(out,
  `// Made by tools/make-pack.js. Don't edit by hand: a published pack's levels\n` +
  `// never change (saves keep results by id); new levels go on the end.\n` +
  `// grid: dots as letters, one colour each. solution: who fills each square.\n` +
  `(window.CONDUIT_PACKS = window.CONDUIT_PACKS || []).push({\n` +
  `  id: ${JSON.stringify(pack.id)}, name: ${JSON.stringify(pack.name)}, blurb: ${JSON.stringify(pack.blurb)},\n` +
  `  levels: [\n${body}\n  ],\n});\n`);
console.log(`Wrote ${path.relative(process.cwd(), out)}: ${pack.levels.length} levels`);
