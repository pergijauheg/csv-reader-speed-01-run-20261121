// csv-reader-speed-01 entry: the program the harness runs (`node main.ts`,
// node22). It reads every case from /input/cases.json (a JSON array of
// {id, input}), answers each one alone with run() from solve.js, and writes
// /output/answers.json: a JSON array of the answers, one per case and in the
// cases' order. Outside a container MAKEFUN_INPUT_DIR and MAKEFUN_OUTPUT_DIR
// stand in for /input and /output.
//
// This driver is the house baseline's main.ts with one change to the V8
// flags it sets before importing solve.js (the rules let an entry tune V8's
// flags this way): --no-opt is added next to --no-incremental-marking.
// The heat runs every entry in a fresh one-CPU container, so each timed run
// is a cold start: TurboFan's optimizing compile of solve.js costs more CPU
// on that single run than the optimized code then saves, and the interpreter
// alone is faster for one cold pass. Measured on the practice set (6 cases,
// ~10.2 MB of CSV), the cold pipeline went from ~1.10 s to ~0.90 s of CPU
// with --no-opt, with byte-identical answers.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setFlagsFromString } from 'node:v8';

// V8's incremental marking off, and its optimizing compiler off, set before
// solve.js is imported so all of its work runs under them (the rules: the
// house baseline runs with --no-incremental-marking, and an entry may tune
// V8's flags too).
setFlagsFromString('--no-incremental-marking --no-opt');

/** solve.js, imported by its URL (a .js module carries no types) and typed by its contract. */
const { run } = (await import(new URL('./solve.js', import.meta.url).href)) as { run: (input: unknown) => unknown };

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const cases = JSON.parse(readFileSync(join(INPUT_DIR, 'cases.json'), 'utf8')) as { id: string; input: unknown }[];
const answers: unknown[] = [];
for (const c of cases) answers.push(run(c.input));
writeFileSync(join(OUTPUT_DIR, 'answers.json'), JSON.stringify(answers));
