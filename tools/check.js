// Checks every pack in public/packs/: each colour has two dots, the solver
// finds exactly one way to join them all and fill every square, and it's
// the solution stored with the level; ids run 1, 2, 3...
// Run: node tools/check.js
const fs = require('fs');
const path = require('path');
const { solve } = require('./solver');

global.window = {};
const dir = path.join(__dirname, '..', 'public', 'packs');
fs.readdirSync(dir).filter((f) => f.endsWith('.js')).forEach((f) => require(path.join(dir, f)));

let bad = 0, total = 0;
for (const pack of window.CONDUIT_PACKS) {
  pack.levels.forEach((l, i) => {
    total++;
    const fail = (why) => { bad++; console.log(`${pack.id} ${l.id}: ${why}`); };
    if (l.id !== i + 1) fail(`id should be ${i + 1}`);
    const { w, h } = l, grid = l.grid.join(''), sol = l.solution.join('');
    if (l.grid.length !== h || l.grid.some((r) => r.length !== w) || sol.length !== w * h) return fail('wrong size');
    const ends = {};
    [...grid].forEach((ch, c) => { if (ch !== '.') (ends[ch] = ends[ch] || []).push(c); });
    const letters = Object.keys(ends).sort();
    if (letters.some((ch) => ends[ch].length !== 2)) fail('a colour without exactly two dots');
    if ([...sol].some((s) => !letters.includes(s.toUpperCase()))) fail('a square nobody fills');
    const r = solve({ w, h, dots: letters.map((ch) => ends[ch]) }, 2, 2e6);
    if (r.count !== 1) return fail(r.count === -1 ? 'solver ran out of budget' : `${r.count} solutions`);
    const found = r.first.map((c) => letters[c].toLowerCase()).join('');
    if (found !== sol) fail("the stored solution isn't the one the solver finds");
  });
}
console.log(bad ? `${bad} problems` : `${total} levels ok: one solution each, and it fills the board`);
process.exit(bad ? 1 : 0);
