// Checks the first 120 levels: every solution piece is a chain of
// neighbouring squares, together they fill the grid exactly once, and each
// colour's dots are its piece's two ends. Run: node tools/check.js
const { make, neighbours } = require('../public/levels.js');
let bad = 0;
for (let level = 1; level <= 120; level++) {
  const p = make(level), n = p.size, seen = new Array(n * n).fill(0);
  const fail = (why) => { bad++; console.log(`level ${level}: ${why}`); };
  p.solution.forEach((piece, c) => {
    if (piece.length < 2) fail(`colour ${c} has ${piece.length} square`);
    piece.forEach((cell, i) => {
      seen[cell]++;
      if (i && !neighbours(cell, n).includes(piece[i - 1])) fail(`colour ${c} jumps at ${i}`);
    });
    const [a, b] = p.dots[c];
    if (a !== piece[0] || b !== piece[piece.length - 1] || a === b) fail(`colour ${c} dots`);
  });
  if (seen.some((s) => s !== 1)) fail('grid not filled exactly once');
  if (make(level).dots.join() !== p.dots.join()) fail('not the same twice');
}
console.log(bad ? `${bad} problems` : 'levels 1-120 ok');
process.exit(bad ? 1 : 0);
