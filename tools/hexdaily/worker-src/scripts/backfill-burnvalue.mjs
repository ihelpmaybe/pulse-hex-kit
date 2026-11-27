#!/usr/bin/env node
// One-time backfill of the burn-address value history (run locally, Node 18+).
//
// Writes data/burnvalue.json: one row per UTC day, newest-first, the shape the
// Worker serves at /burnvalue. Uses the Worker's own code (src/burnvalue.js),
// so a backfilled day and a cron-collected day are computed the same way.
//
//   node scripts/backfill-burnvalue.mjs [--from=2023-05-13] [--to=YYYY-MM-DD]
//
// Upload with:
//   wrangler kv key put burnvalue.json --binding FEED --path data/burnvalue.json --remote
//
// Cost: about eight block-header reads and one archive eth_call per day (~1,300
// days from PulseChain's launch), plus a few dozen subgraph pages. Resumable:
// days already in data/burnvalue.json are skipped.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import {
  DAY, utcDayStart, isoDay, blockAtTimeViaRpc, readBurnBalances, fetchDailyPrices, composeRow,
} from "../src/burnvalue.js";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);

// PulseChain mainnet went live on 13 May 2023; earlier state is Ethereum's copy.
const from = Date.parse((args.from ?? "2023-05-13") + "T00:00:00Z") / 1000;
const to = args.to
  ? Date.parse(args.to + "T00:00:00Z") / 1000
  : utcDayStart(Date.now() / 1000) - DAY;
const OUT = new URL("../data/burnvalue.json", import.meta.url);
const CONCURRENCY = 6;

async function retry(fn, label, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= tries) throw new Error(`${label}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

let rows = [];
try {
  rows = JSON.parse(await readFile(OUT, "utf8"));
} catch {}
const have = new Set(rows.map((r) => r.date));

const days = [];
for (let d = from; d <= to; d += DAY) if (!have.has(isoDay(d))) days.push(d);
console.log(`${days.length} days to fetch (${rows.length} already stored)`);

console.log("prices...");
const prices = await retry(() => fetchDailyPrices(from, to), "prices");

let done = 0;
const failed = [];
async function worker(queue) {
  for (;;) {
    const d = queue.shift();
    if (d === undefined) return;
    try {
      const block = (await retry(() => blockAtTimeViaRpc(d + DAY), `block ${isoDay(d)}`)) - 1;
      const balances = await retry(() => readBurnBalances(block), `balances ${isoDay(d)}`);
      const row = composeRow(d, balances, prices);
      // Same rule as the cron: no PLS price means no row, not a zero.
      if (row.skipped?.includes("PLS")) throw new Error(`no PLS price for ${row.date}`);
      rows.push({ ...row, block });
    } catch (e) {
      failed.push(isoDay(d));
      console.error(e.message);
    }
    if (++done % 25 === 0) {
      console.log(`${done}/${days.length}`);
      await save();
    }
  }
}

async function save() {
  rows.sort((a, b) => (a.date < b.date ? 1 : -1));
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(OUT, JSON.stringify(rows));
}

const queue = [...days];
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));
await save();
console.log(`done: ${rows.length} rows, ${failed.length} failed${failed.length ? ": " + failed.join(", ") : ""}`);
if (rows.length) console.log("newest", rows[0], "\noldest", rows[rows.length - 1]);
