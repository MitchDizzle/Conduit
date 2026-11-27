# Conduit

Join each pair of dots with a pipe. Pipes can't cross, and every square needs
one. Played at [mtch.tech/conduit/](https://mtch.tech/conduit/).

Plain HTML, CSS and JavaScript in `public/`. No build: open
`public/index.html` through any local server (`python -m http.server -d public`).

## How it plays

- Drag from a dot to draw its pipe. Drag back over it to shorten it.
- Start a drag on the middle of a pipe to carry on from there.
- Crossing another colour's pipe cuts it. Drag back off it in the same move
  and it comes back; let go and the cut stays.
- A level is solved when every pair is joined and every square is filled.
  Solving one opens the next. Restart clears the board.

## Levels

Made from the level number by `public/levels.js`, so nothing is stored and
everyone gets the same level 12. It walks the grid through every square,
shuffles the walk, and cuts it into one piece per colour. The dots are each
piece's ends, so every level can be solved and the solution fills the grid.

| Levels | Grid | Colours |
| --- | --- | --- |
| 1 | 2×2 | 1 (teaches "fill every square") |
| 2–3 | 2×2 | 2 |
| 4–8 | 3×3 | 2, then 3 |
| 9–15 | 4×4 | 3, then 4 |
| 16–25 | 5×5 | 4, then 5 |
| 26–40 | 6×6 | 5, then 6 |
| 41–60 | 7×7 | 6, then 7 |
| 61–85 | 8×8 | 7, then 8 |
| 86+ | 9×9 | 9 |

A level never repeats the one before it. `node tools/check.js` checks the
first 120 (the deploy runs it too).

Changing the generator changes every level for everyone. Saves only hold
level numbers, so nobody loses progress, but the puzzles behind the numbers
change.

## Save

`localStorage` key `conduit.v1`: `{ v: 1, level, unlocked }`. Never change
the key; a new field gets a default in `load()`.

## Deploy

A push to `main` that changes `public/` uploads it to `mtch.tech/conduit/`
(`.github/workflows/deploy.yml`). The FTP secrets are the shared mtch.tech
set, put on this repo with `tools/connect-repo.ps1 MitchDizzle/Conduit` from
the mtch.tech repo; see its `docs/hosting-other-repos.md`. Until they're set,
the upload is skipped with a warning.

## Next

- Colour-blind help: a letter or shape on each dot.
- A level picker once there are enough to want one.
- Bigger boards may want a hint button.
