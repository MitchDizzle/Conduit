/* Conduit levels.
 *
 * Every level is made from its number, so level 12 is the same puzzle for
 * everyone and nothing has to be stored. How one is made:
 *
 *   1. Walk the grid in rows (a snake through every square).
 *   2. Shuffle that walk with "backbite" moves: take an end of the walk, pick
 *      a square next to it that the walk reaches later, and flip the part in
 *      between. The walk still visits every square exactly once.
 *   3. Cut the walk into pieces. Each piece is one colour; its two ends are
 *      the dots.
 *
 * So every level can be solved (the cut walk is a solution), and a solution
 * fills every square. It may have other solutions too; any of them counts.
 *
 * Changing anything here changes every level for everyone. Saves only keep
 * level numbers, so nobody loses progress, but the puzzles they solved
 * become different ones. Bump GENERATOR in README's notes if you do.
 */
(function (root) {
  'use strict';

  // How big and how many colours, by level number (from 1).
  function shape(level) {
    if (level === 1) return { size: 2, colors: 1 };   // fill every square
    if (level <= 3) return { size: 2, colors: 2 };
    if (level <= 8) return { size: 3, colors: level <= 5 ? 2 : 3 };
    if (level <= 15) return { size: 4, colors: level <= 11 ? 3 : 4 };
    if (level <= 25) return { size: 5, colors: level <= 19 ? 4 : 5 };
    if (level <= 40) return { size: 6, colors: level <= 31 ? 5 : 6 };
    if (level <= 60) return { size: 7, colors: level <= 49 ? 6 : 7 };
    if (level <= 85) return { size: 8, colors: level <= 72 ? 7 : 8 };
    return { size: 9, colors: 9 };
  }

  // Small seeded random numbers (mulberry32).
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function neighbours(cell, n) {
    const r = Math.floor(cell / n), c = cell % n, out = [];
    if (r > 0) out.push(cell - n);
    if (r < n - 1) out.push(cell + n);
    if (c > 0) out.push(cell - 1);
    if (c < n - 1) out.push(cell + 1);
    return out;
  }

  function snake(n) {
    const walk = [];
    for (let r = 0; r < n; r++) {
      for (let i = 0; i < n; i++) walk.push(r * n + (r % 2 ? n - 1 - i : i));
    }
    return walk;
  }

  function backbite(walk, n, rand) {
    const at = new Array(walk.length);
    const index = () => walk.forEach((cell, i) => { at[cell] = i; });
    index();
    const steps = walk.length * 30 + Math.floor(rand() * walk.length); // odd or even: on 2x2 every move flips the layout
    for (let s = 0; s < steps; s++) {
      const head = rand() < 0.5;
      const end = head ? walk[0] : walk[walk.length - 1];
      const next = head ? walk[1] : walk[walk.length - 2];
      const options = neighbours(end, n).filter((x) => x !== next);
      if (!options.length) continue;
      const i = at[options[Math.floor(rand() * options.length)]];
      if (head) reverse(walk, 0, i - 1);
      else reverse(walk, i + 1, walk.length - 1);
      index();
    }
    return walk;
  }

  function reverse(list, from, to) {
    while (from < to) {
      const t = list[from]; list[from] = list[to]; list[to] = t;
      from++; to--;
    }
  }

  // Piece lengths: each at least `least`, adding up to `total`, in a random order.
  function lengths(total, count, least, rand) {
    const out = new Array(count).fill(least);
    for (let left = total - least * count; left > 0; left--) {
      out[Math.floor(rand() * count)]++;
    }
    return out;
  }

  // A level never repeats the one before it (2x2 has only a few layouts).
  const made = new Map();
  function make(level) {
    if (made.has(level)) return made.get(level);
    const before = level > 1 && shape(level - 1).size === shape(level).size
      ? layout(make(level - 1)) : null;
    let out;
    for (let salt = 0; salt < 50; salt++) {
      out = build(level, salt);
      if (layout(out) !== before) break;
    }
    made.set(level, out);
    return out;
  }

  // The same dots with the colours swapped is the same puzzle.
  const layout = (p) => p.dots.map((d) => d.slice().sort((a, b) => a - b).join('-')).sort().join();

  function build(level, salt) {
    const { size: n, colors } = shape(level);
    const rand = rng(level * 9973 + 17 + salt * 7919);
    const walk = backbite(snake(n), n, rand);
    const least = n <= 2 ? 2 : 3;
    const pieces = [];
    let from = 0;
    for (const len of lengths(n * n, colors, least, rand)) {
      pieces.push(walk.slice(from, from + len));
      from += len;
    }
    return {
      level,
      size: n,
      dots: pieces.map((p) => [p[0], p[p.length - 1]]),
      solution: pieces,
    };
  }

  const api = { make, shape, neighbours };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ConduitLevels = api;
})(this);
