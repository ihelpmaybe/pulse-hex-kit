// What the PulseChain burn addresses hold, in dollars, per day.
//
// Two addresses take burns by convention: the zero address and 0x...0369.
// Neither can send, so whatever lands there is gone, and its dollar value is a
// running measure of how much has been thrown away. This is NOT the /burns
// feed: that one counts supply-reducing burns (PLSX Transfer events to 0x0, and
// the EIP-1559 base fee), which never show up as a balance anywhere. This one
// reads balances.
//
// Only a fixed list of tokens is counted. 0x...0369 holds about 2,550 tokens
// and nearly all are spam whose thin pools quote absurd prices: one, "MAFIA",
// would value its 980M tokens at $675M against $111k of liquidity. The list was
// chosen on 2026-11-26 by a rule, not by taste: every token in a PulseX pair
// with at least $20k of reserves (2,984 tokens) was checked at both addresses,
// and kept if its deepest pool held at least $50k AND the burned amount was
// worth no more than 10x that pool AND at least $1k. PLS (native and wrapped),
// HEX and INC are kept regardless, as the chain's own coins. To revisit the
// list, re-run that check; new tokens burned later are not picked up by
// themselves.
//
// The same 10x rule runs again every day against that day's liquidity, so a
// token whose pool was thin earlier in its life does not spike the history.
//
// Prices are PulseX's own daily closes (tokenDayDatas.priceUSD) from both the
// V1 and V2 subgraphs, taking the side with more liquidity that day. Balances
// are read at the last block of each UTC day through Multicall3, which needs an
// archive node for past days: rpc.pulsechain.com and thirdweb serve one.
//
// The history is backfilled offline by scripts/backfill-burnvalue.mjs, which
// imports this file, and uploaded to KV. The hourly cron appends each completed
// day.

export const KEY = "burnvalue.json";

export const BURN_ADDRESSES = [
  "0x0000000000000000000000000000000000000000",
  "0x0000000000000000000000000000000000000369",
];

// Native PLS is valued at the WPLS price.
const WPLS = "0xa1077a294dde1b09bb078844df40758a5d0f9a27";

/// The tracked tokens. `symbol` is what the chart labels them; the address is
/// what is read and priced.
export const BURN_VALUE_TOKENS = [
  { symbol: "PLSX", address: "0x95b303987a60c71504d99aa1b13b4da07b0790ab", decimals: 18 },
  { symbol: "HEX", address: "0x2b591e99afe9f32eaa6214f7b7629768c40eeb39", decimals: 8 },
  { symbol: "INC", address: "0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d", decimals: 18 },
  { symbol: "WPLS", address: WPLS, decimals: 18 },
  { symbol: "pDAI", address: "0x6b175474e89094c44da98b954eedeac495271d0f", decimals: 18 },
  { symbol: "ZERØ", address: "0xf6703dbff070f231eed966d33b1b6d7ef5207d26", decimals: 18 },
  { symbol: "pTGC", address: "0x94534eeee131840b1c0f61847c572228bdfdde93", decimals: 18 },
  { symbol: "ATROPA", address: "0xcc78a0acdf847a2c1714d2a925bb4477df5d48a6", decimals: 18 },
  { symbol: "Liquid", address: "0x21ee884c6c2e83e6837c77f7ff617ba947f0afe7", decimals: 18 },
];

/// A token's burned value may not exceed this multiple of its pool liquidity
/// on the same day; above it the price is not one anybody could sell at.
const MAX_VALUE_TO_LIQUIDITY = 10;

const MULTICALL3 = "0xca11bde05977b3631167028862be2a173976ca11";
const ARCHIVE_RPCS = ["https://rpc.pulsechain.com", "https://369.rpc.thirdweb.com"];
const SCANS = ["https://api.scan.pulsechain.com", "https://scan.pulsefusion.io"];
const SUBGRAPHS = [
  "https://graph.pulsechain.com/subgraphs/name/pulsechain/pulsex",
  "https://graph.pulsechain.com/subgraphs/name/pulsechain/pulsexv2",
];

// Every upstream call gives up after this, so one hung explorer cannot hold the
// cron (or the backfill) open.
const TIMEOUT_MS = 20_000;

export const DAY = 86400;
export const utcDayStart = (unix) => Math.floor(unix / DAY) * DAY;
export const isoDay = (unix) => new Date(unix * 1000).toISOString().slice(0, 10);

// ---- Multicall3 aggregate3 (allowFailure on every call) ----

const word = (n) => BigInt(n).toString(16).padStart(64, "0");
const pad = (hexNoPrefix) => hexNoPrefix.padEnd(Math.ceil(hexNoPrefix.length / 64) * 64, "0");

function encodeAggregate3(calls) {
  // aggregate3((address target, bool allowFailure, bytes callData)[])
  const heads = [];
  const tails = [];
  let offset = calls.length * 32;
  for (const { target, data } of calls) {
    const body = data.replace(/^0x/, "");
    const tuple =
      word(BigInt(target)) + word(1) + word(96) + word(body.length / 2) + pad(body);
    heads.push(word(offset));
    tails.push(tuple);
    offset += tuple.length / 2;
  }
  return "0x82ad56cb" + word(32) + word(calls.length) + heads.join("") + tails.join("");
}

/// Decode aggregate3's (bool success, bytes returnData)[] into BigInt values
/// (the first word of each return), or null for a failed call.
function decodeAggregate3(hex) {
  const h = hex.replace(/^0x/, "");
  const at = (byte) => BigInt("0x" + h.slice(byte * 2, byte * 2 + 64));
  const arrayStart = Number(at(0));
  const count = Number(at(arrayStart));
  const out = [];
  for (let i = 0; i < count; i++) {
    const tupleStart = arrayStart + 32 + Number(at(arrayStart + 32 + i * 32));
    const success = at(tupleStart) === 1n;
    const bytesStart = tupleStart + Number(at(tupleStart + 32));
    const length = Number(at(bytesStart));
    if (!success || length < 32) {
      out.push(null);
      continue;
    }
    out.push(at(bytesStart + 32));
  }
  return out;
}

async function rpcCall(url, method, params) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  // A 502 page instead of JSON is a failure like any other: try the next node.
  const body = JSON.parse(await res.text());
  if (body.error) throw new Error(body.error.message ?? "rpc error");
  return body.result;
}

/// Balances of every tracked token, and native PLS, at both addresses at
/// `block`. Returns { SYMBOL: tokens } with "PLS" for the native coin.
export async function readBurnBalances(block) {
  const calls = [];
  const labels = [];
  for (const holder of BURN_ADDRESSES) {
    const arg = holder.slice(2).padStart(64, "0");
    calls.push({ target: MULTICALL3, data: "0x4d2301cc" + arg }); // getEthBalance
    labels.push({ symbol: "PLS", decimals: 18 });
    for (const t of BURN_VALUE_TOKENS) {
      calls.push({ target: t.address, data: "0x70a08231" + arg }); // balanceOf
      labels.push(t);
    }
  }
  const data = encodeAggregate3(calls);
  const tag = "0x" + block.toString(16);
  let lastError;
  for (const url of ARCHIVE_RPCS) {
    try {
      const raw = await rpcCall(url, "eth_call", [{ to: MULTICALL3, data }, tag]);
      const values = decodeAggregate3(raw);
      if (values.length !== calls.length) throw new Error("short multicall result");
      const totals = {};
      values.forEach((v, i) => {
        const { symbol, decimals } = labels[i];
        totals[symbol] = (totals[symbol] ?? 0) + (v == null ? 0 : Number(v) / 10 ** decimals);
      });
      return totals;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new Error("no archive RPC answered");
}

export async function blockAtTime(unix) {
  let lastError;
  for (const base of SCANS) {
    try {
      const res = await fetch(
        `${base}/api?module=block&action=getblocknobytime&timestamp=${unix}&closest=after`,
        {
          headers: {
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Dest": "empty",
            "User-Agent": "hex-stats/1.0",
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        }
      );
      const body = JSON.parse(await res.text());
      // PulseScan answers {result: {blockNumber}}, FusionScan {result: "123"}.
      const n = Number(body?.result?.blockNumber ?? body?.result);
      if (Number.isFinite(n) && n > 0) return n;
      lastError = new Error(`${base}: no block for timestamp`);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

/// First block at or after `unix`, from block timestamps alone (no explorer).
/// Interpolates between two known blocks and narrows in; about six RPC calls.
/// The backfill uses this: the explorer lookup is one call but often times out,
/// and a thousand of them took hours.
export async function blockAtTimeViaRpc(unix) {
  const ts = async (n) => Number(BigInt((await rpcCall(ARCHIVE_RPCS[0], "eth_getBlockByNumber", ["0x" + n.toString(16), false])).timestamp));
  let hi = Number(BigInt(await rpcCall(ARCHIVE_RPCS[0], "eth_blockNumber", [])));
  let hiT = await ts(hi);
  // PulseChain's first block after the fork; nothing earlier is asked for.
  let lo = 17233000;
  let loT = await ts(lo);
  if (unix <= loT) return lo;
  if (unix > hiT) throw new Error("timestamp is in the future");
  while (hi - lo > 1) {
    // Interpolate, but never land on an end, so the range always shrinks.
    let mid = lo + Math.round(((unix - loT) / (hiT - loT)) * (hi - lo));
    mid = Math.min(hi - 1, Math.max(lo + 1, mid));
    const t = await ts(mid);
    if (t < unix) {
      lo = mid; loT = t;
      // Step a little past the guess so the next interpolation brackets tightly.
      const probe = Math.min(hi - 1, mid + 30);
      if (probe > lo) { const pt = await ts(probe); if (pt >= unix) { hi = probe; hiT = pt; } else { lo = probe; loT = pt; } }
    } else {
      hi = mid; hiT = t;
      const probe = Math.max(lo + 1, mid - 30);
      if (probe < hi) { const pt = await ts(probe); if (pt < unix) { lo = probe; loT = pt; } else { hi = probe; hiT = pt; } }
    }
  }
  return hi;
}

/// PulseX daily price and liquidity for every tracked token on the UTC days in
/// [fromDay, toDay], as { address: { dayUnix: { price, liquidity } } }. Of the
/// two subgraphs, the one with more liquidity in the token that day wins.
export async function fetchDailyPrices(fromDay, toDay) {
  const addresses = BURN_VALUE_TOKENS.map((t) => t.address);
  const out = {};
  for (const url of SUBGRAPHS) {
    let after = fromDay - 1;
    for (;;) {
      const query = `{ tokenDayDatas(first: 1000, orderBy: date, orderDirection: asc,
        where: { token_in: ${JSON.stringify(addresses)}, date_gt: ${after}, date_lte: ${toDay} })
        { date priceUSD totalLiquidityUSD token { id } } }`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(TIMEOUT_MS * 2),
      });
      const body = await res.json();
      const rows = body?.data?.tokenDayDatas;
      if (!Array.isArray(rows)) throw new Error(`subgraph: ${JSON.stringify(body?.errors ?? body).slice(0, 200)}`);
      for (const r of rows) {
        const address = r.token.id.toLowerCase();
        const price = Number(r.priceUSD);
        const liquidity = Number(r.totalLiquidityUSD);
        if (!(price > 0) || !isFinite(price)) continue;
        const byDay = (out[address] ??= {});
        const seen = byDay[r.date];
        if (!seen || liquidity > seen.liquidity) byDay[r.date] = { price, liquidity };
      }
      if (rows.length < 1000) break;
      after = Number(rows[rows.length - 1].date);
      // Several tokens share a date, so the page may end mid-day: back up one
      // day and let the liquidity comparison above absorb the repeats.
      after -= DAY;
    }
  }
  return out;
}

/// One day's row from balances and that day's prices. Tokens with no price
/// that day, or over the liquidity cap, count as zero and are listed under
/// `skipped` so the gap can be explained.
export function composeRow(dayUnix, balances, prices) {
  const usd = {};
  const skipped = [];
  let total = 0;
  const priceOf = (address) => prices[address]?.[dayUnix];
  for (const symbol of Object.keys(balances)) {
    const qty = balances[symbol];
    if (!(qty > 0)) continue;
    const token = symbol === "PLS" ? { address: WPLS } : BURN_VALUE_TOKENS.find((t) => t.symbol === symbol);
    const p = priceOf(token.address);
    if (!p) {
      skipped.push(symbol);
      continue;
    }
    const value = qty * p.price;
    // PLS is the chain's own coin: its WPLS pools are not its whole market.
    if (symbol !== "PLS" && symbol !== "WPLS" && value > p.liquidity * MAX_VALUE_TO_LIQUIDITY) {
      skipped.push(symbol);
      continue;
    }
    usd[symbol] = Math.round(value * 100) / 100;
    total += value;
  }
  const row = { date: isoDay(dayUnix), usd: Math.round(total * 100) / 100, tokens: usd };
  if (skipped.length) row.skipped = skipped;
  return row;
}

/// Collect one completed UTC day. Returns null if that day is already stored.
export async function collectBurnValueDay(env, dayStartUnix) {
  const stored = (await env.FEED.get(KEY, { type: "json" })) ?? [];
  const date = isoDay(dayStartUnix);
  if (stored.some((r) => r.date === date)) return null;

  const lastBlock = (await blockAtTime(dayStartUnix + DAY)) - 1;
  const [balances, prices] = await Promise.all([
    readBurnBalances(lastBlock),
    fetchDailyPrices(dayStartUnix, dayStartUnix),
  ]);
  const row = composeRow(dayStartUnix, balances, prices);
  // PLS is most of the value: a row without it would draw as a crash to zero.
  // Leave the day for the next hourly run instead.
  if (row.skipped?.includes("PLS")) throw new Error(`no PLS price for ${date} yet`);

  const merged = [row, ...stored.filter((r) => r.date !== date)].sort((a, b) =>
    a.date < b.date ? 1 : -1
  );
  await env.FEED.put(KEY, JSON.stringify(merged));
  return row;
}

/// Cron entry: fill in yesterday, if it is not already there. PulseX writes a
/// day's tokenDayData as trades happen, so yesterday's close is final by now.
export async function runBurnValueCollection(env) {
  const yesterday = utcDayStart(Math.floor(Date.now() / 1000)) - DAY;
  const row = await collectBurnValueDay(env, yesterday);
  return row ? { collected: row.date, usd: row.usd } : { skipped: "already collected" };
}

/// GET /burnvalue: the daily series, newest-first.
export async function serveBurnValue(env, url) {
  const rows = (await env.FEED.get(KEY, { type: "json" })) ?? [];
  if (!rows.length) return { error: "no burn-address history collected yet", status: 503 };
  const days = Math.min(
    rows.length,
    Math.max(1, parseInt(url.searchParams.get("days") || String(rows.length), 10) || rows.length)
  );
  return {
    updatedAt: new Date().toISOString(),
    addresses: BURN_ADDRESSES,
    tokens: ["PLS", ...BURN_VALUE_TOKENS.map((t) => t.symbol)],
    note:
      "Dollar value of what the zero address and 0x...0369 hold, at each day's PulseX close. " +
      "PLS and a fixed list of tokens with real liquidity only; spam tokens sent there are left out.",
    days,
    series: rows.slice(0, days),
  };
}
