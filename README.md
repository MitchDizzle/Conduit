# Conduit

Join each pair of dots with a pipe. Pipes can't cross, and every square needs
one. Played at [mtch.tech/conduit/](https://mtch.tech/conduit/).

Plain HTML, CSS and JavaScript in `public/`, no build. To try it locally:
`python -m http.server -d public`, then open the address it prints.

## How it plays

- Drag from a dot to draw its pipe. Drag back over it to shorten it. Start a
  drag on the middle of a pipe to carry on from there.
- Crossing another colour's pipe cuts it. Drag back off it in the same move
  and it comes back; let go and the cut stays.
- Solved when every pair is joined **and every square is filled**.
- **✓** solved. **★** flawless: solved in the fewest moves, one per colour.
- **A move** is a drag that changes the board, unless it's the same colour as
  the move before (so finishing a pipe in two drags is still one move). Undo
  doesn't take a move back, and the drag after an Undo always counts.
- Levels open three at a time past the furthest one solved, so one hard
  level never blocks the rest.

## Packs and levels

Levels come in packs: `public/packs/<id>.js`, each a list of levels with its
dots and its solution. **Basics** (60 levels) is the plain game. Later packs
add new mechanics.

Basics is made by `node tools/make-pack.js`:

- A walk through every square of the grid is shuffled, then cut into one
  pipe per colour. A pipe ends where it would touch itself, so no pipe runs
  alongside itself, and no pipe has its dots side by side.
- **A level is kept only if it has exactly one solution** (`tools/solver.js`
  counts them). So the answer always fills every square, and a ★ always
  means one move per colour.
- Within a size, levels go from least to most searching for the solver.

| Levels | Grid | Colours |
| --- | --- | --- |
| 1 | 2×2 | 1: the only thing to learn on 2×2 is going the long way round |
| 2 | 3×2 | 1 |
| 3–6 | 3×3 | 2, then 3 |
| 7–13 | 4×4 | 3, then 4 |
| 14–24 | 5×5 | 4, then 5 |
| 25–36 | 6×6 | 5, then 6 |
| 37–48 | 7×7 | 7 or 8 |
| 49–60 | 8×8 | 8 or 9 |

`node tools/check.js` checks every pack: two dots per colour, exactly one
solution, and it's the one stored. Every push runs it.

**A published pack never changes.** Saves keep results by pack id and level
id, so levels are never reordered, edited or removed; new ones go on the
end, or into a new pack. `make-pack.js` is seeded, so running it again gives
the same Basics.

## Sound and music

Like Order Up: made in the browser (Web Audio, `public/sound.js`), no files.
Sound and Music are each Off, Low, Medium or High, **both off until the
player turns them up**, through one limiter.

- **Sounds:** a note in each pipe's colour when it's picked up, quiet ticks
  as it's drawn, a chord when it reaches its dot, a soft cut when a pipe is
  crossed, a rising run when a level is solved and a longer one with a
  sparkle for a ★.
- **Music:** a slow, calm loop made as it plays (Cmaj9, Am9, Fmaj7, G6 at 66
  beats a minute): a soft pad, a low note, and a few bell notes with an
  echo. Never the same twice; quiet while the page is hidden.

## Settings

Sound, Music, Vibration, **Letters on the dots** (for telling colours
apart), **Add to Home Screen**, **Save code**, and Start over.

- **Home screen:** `manifest.webmanifest`, the icons (drawn in
  `art/icon.svg`, made by `node tools/make-icons.js`, which needs Chrome or
  Edge) and `sw.js`, a service worker that does nothing but let Android offer
  the install (it caches nothing, so it never serves an old game). Android
  gets a button; an iPhone is told Safari's Share → Add to Home Screen;
  Facebook's and Instagram's browsers are told to open it in the phone's
  browser first.
- **Save code:** `CN1.<data>.<check>`, the ✓ and ★ as one line. Loading only
  adds (the better result for each level wins). On an iPhone the home-screen
  game keeps its own progress, so the install note says to copy the code
  first.

## Save

`localStorage` key `conduit.v1` (never change it):
`{ v: 2, sfx, music, buzz, letters, done: { pack: { id: { r, m } } }, at }`,
where `r` is 1 for ✓ and 2 for ★ and `m` the fewest moves. A new field gets a
default in `fresh()`; a change in what a field means gets a step in
`migrate()` and a higher `SAVE_VER`. v1 (the first build, levels made from
their number) had nothing worth keeping.

## Deploy

This repo has no deploy and no secrets. mtch.tech serves the commit named by
`ref` in its `src/_data/games.json`, uploading `public/` to
`mtch.tech/conduit/`. To release, push here, then in the mtch.tech repo:

```powershell
node tools/release-game.js conduit
git commit -am "Release Conduit <sha>: <what changed>"
git push
```

That deploy uploads only this game; the site isn't rebuilt. mtch.tech's
`docs/hosting-other-repos.md` has the setup.

## Next

- Pack 2 and on: new mechanics (bridges, walls, warps) as their own packs.
- A hint (the stored solution makes one easy: show one pipe).
- Nobody has heard the sound or music on a phone speaker yet.
