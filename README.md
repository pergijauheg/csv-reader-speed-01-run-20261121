# csv-reader-speed-01 — a faster drop-in for csv-reader 1.0.0

[![make.fun](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/pergijauheg/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/pergijauheg/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)

Entry for the make.fun bounty [Read broken CSV files faster, 21 November 2026](https://make.fun/bounty/csv-reader-speed-01-run-20261121).

make.fun entry for **csv-reader-speed-01-run-20261121** ("Read broken CSV files
faster, 21 November 2026").

`solve.js` returns exactly what csv-reader 1.0.0's `readCsv` returns for every
input `{text, header}` — the JSON value `{columns, rows, errors}` — but faster.
`main.ts` is the house baseline's driver, with one change to the V8 flags it
sets before importing `solve.js` (the rules let an entry tune V8's flags this
way): `--no-opt` next to `--no-incremental-marking`. The heat runs every entry
in a fresh one-CPU container, so each timed run is a cold start, and TurboFan's
optimizing compile costs more CPU on that single run than the optimized code
then saves.

## How it is faster

The reference walks the text one character at a time and grows every field a
character at a time. This one finds each field's end with native `indexOf`
scans and takes the field with one `slice`, so a plain field costs a few
native scans instead of a JS loop over its characters. The rare broken shapes
— a stray CR inside a field, a quote that never closes, junk after a closing
quote, a CR inside quotes — fall back to a small character loop that follows
the reference step for step. Pure: no clock, no randomness, no locale, nothing
kept from one call to the next, so two runs write the same bytes.

## Local verification (practice set, 6 cases, ~10.2 MB of CSV)

- Scorer: **6/6 cases passed**; answers **byte-identical** to the house
  baseline's output.
- Differential fuzz: **16,000 random broken-CSV inputs + 43 hand-picked edge
  cases, 0 mismatches** against csv-reader 1.0.0's `readCsv`.
- Determinism: two runs write byte-identical `answers.json`.
- Speed, cold pipeline (whole `main.ts`, user+sys CPU, median of 5 fresh
  runs on this machine): **baseline ~2.00 s, this entry ~0.90 s — about
  2.2x faster**. Warm `run()` alone: ~0.18 s vs the baseline's ~0.68 s.

## Files

- `solve.js` — the entry: dependency-free ES module, `run(input)`.
- `main.ts` — the driver: reads `/input/cases.json`, answers each case with
  `run`, writes `/output/answers.json`.
- `package.json` — `{"type": "module"}`.
- `LICENSE` — MIT.
