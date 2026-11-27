// Counts the solutions of a Conduit puzzle, stopping at `limit` (2 is enough
// to know a puzzle has exactly one). Used by make-pack.js and check.js, never
// by the game.
//
// A puzzle: { w, h, dots: [[a, b], ...] } with cells numbered row by row.
// A solution joins every pair and fills every square.
//
// Search: each colour's pipe grows from one dot (its head) toward the other.
// At every step the colour with the fewest ways forward goes next, and a
// board is dropped as soon as it can't be finished:
//   - a head with nowhere to go;
//   - an empty square with fewer than two ways a pipe could pass through it;
//   - a colour whose head can no longer reach its other dot;
//   - a patch of empty squares that no unfinished colour can get into.
'use strict';

function solve(puzzle, limit = 2, budget = 2e6) {
  const { w, h, dots } = puzzle;
  const N = w * h, K = dots.length;
  const nb = [];
  for (let i = 0; i < N; i++) {
    const r = Math.floor(i / w), c = i % w, list = [];
    if (r > 0) list.push(i - w);
    if (r < h - 1) list.push(i + w);
    if (c > 0) list.push(i - 1);
    if (c < w - 1) list.push(i + 1);
    nb.push(list);
  }
  const color = new Int8Array(N).fill(-1);
  const head = [], target = [], done = new Array(K).fill(false);
  dots.forEach(([a, b], k) => { color[a] = k; color[b] = k; head.push(a); target.push(b); });
  let empty = N - 2 * K;
  let found = 0, nodes = 0, first = null;

  const isOpenFor = (cell, k) => color[cell] === -1 || (cell === target[k] && !done[k]);

  function movesOf(k) {
    const out = [];
    for (const n of nb[head[k]]) if (isOpenFor(n, k)) out.push(n);
    return out;
  }

  function stuck() {
    // Empty squares need two ways through.
    for (let i = 0; i < N; i++) {
      if (color[i] !== -1) continue;
      let ways = 0;
      for (const n of nb[i]) {
        const c = color[n];
        if (c === -1 || (!done[c] && (n === head[c] || n === target[c]))) ways++;
      }
      if (ways < 2) return true;
    }
    // Patches of empty squares, and which heads and targets touch each.
    const patch = new Int16Array(N).fill(-1);
    const touches = [];
    let count = 0;
    for (let i = 0; i < N; i++) {
      if (color[i] !== -1 || patch[i] !== -1) continue;
      const stack = [i], heads = new Set(), targets = new Set();
      patch[i] = count;
      while (stack.length) {
        const x = stack.pop();
        for (const n of nb[x]) {
          const c = color[n];
          if (c === -1) { if (patch[n] === -1) { patch[n] = count; stack.push(n); } }
          else if (!done[c]) { if (n === head[c]) heads.add(c); if (n === target[c]) targets.add(c); }
        }
      }
      touches.push({ heads, targets });
      count++;
    }
    // Every patch needs a colour that can come in and leave toward its dot.
    for (const t of touches) {
      let ok = false;
      for (const c of t.heads) if (t.targets.has(c)) { ok = true; break; }
      if (!ok) return true;
    }
    // Every unfinished colour must still reach its other dot.
    for (let k = 0; k < K; k++) {
      if (done[k]) continue;
      if (nb[head[k]].includes(target[k])) continue;
      let ok = false;
      const hp = new Set(), tp = new Set();
      for (const n of nb[head[k]]) if (color[n] === -1) hp.add(patch[n]);
      for (const n of nb[target[k]]) if (color[n] === -1) tp.add(patch[n]);
      for (const p of hp) if (tp.has(p)) { ok = true; break; }
      if (!ok) return true;
    }
    return false;
  }

  function search() {
    if (++nodes > budget) throw new Error('budget');
    let best = -1, bestMoves = null;
    for (let k = 0; k < K; k++) {
      if (done[k]) continue;
      const m = movesOf(k);
      if (!m.length) return;
      if (!bestMoves || m.length < bestMoves.length) { best = k; bestMoves = m; if (m.length === 1) break; }
    }
    if (best < 0) {
      if (empty === 0) { found++; if (!first) first = Array.from(color); }
      return;
    }
    const k = best, from = head[k];
    for (const n of bestMoves) {
      if (n === target[k]) {
        done[k] = true;
        if (!stuck()) search();
        done[k] = false;
      } else {
        color[n] = k; head[k] = n; empty--;
        if (!stuck()) search();
        color[n] = -1; head[k] = from; empty++;
      }
      if (found >= limit) return;
    }
  }

  try {
    if (!stuck()) search();
  } catch (e) {
    if (e.message === 'budget') return { count: -1, nodes, first };
    throw e;
  }
  return { count: found, nodes, first };
}

module.exports = { solve };
