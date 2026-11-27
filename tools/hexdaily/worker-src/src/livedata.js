// /livedata synthesis.
//
// The original hexstats.today /livedata endpoint has been down for weeks; a
// contributing factor is that its gas source (beacon.pulsechain.com's gasnow
// API) now returns HTML. This rebuilds the snapshot from live sources:
//   - gas: eth_gasPrice on public PulseChain RPCs (the old feed used gasnow's
//     "fast"; eth_gasPrice is the node's current estimate — same magnitude)
//   - PLS/PLSX/INC/HEX prices: PulseX subgraph (same as the daily collector)
//   - per-chain HEX stats: the newest record of each daily feed (meta.prev)
// Fee formulas and their constants are copied verbatim from the original
// index.js so values stay drop-in compatible:
//   beat            = fast / 1e9
//   erc20transfer   = fast / 20000 / 1e9 * pricePLS
//   pulseXSwap      = fast /  4650 / 1e9 * pricePLS
//   addLiquidity    = fast /  3600 / 1e9 * pricePLS
// (validated against an archived snapshot: beat 644499 -> transfer $0.000227)

import { getPulseXPrice, TOKENS, PULSECHAIN_RPCS } from "./subgraph.js";
import { getEthereumHexPrice } from "./onchain.js";

// Snapshot fields the Ethereum collector attaches to the newest day only;
// a day whose RPC or price read failed has none of them.
const ETH_SNAPSHOT_KEYS = ["priceUV2UV3", "tshareRateHEX", "stakedHEX", "circulatingHEX"];

/// The newest record, with each snapshot field it lacks taken from the
/// newest older record that has one. Feed-day 2524 had no price and 2522
/// no snapshot at all; serving them as-is put zeros in /livedata.
function newestFilled(records) {
  const [head, ...older] = (records ?? []).filter(Boolean);
  if (!head) return null;
  const out = { ...head };
  for (const k of ETH_SNAPSHOT_KEYS) {
    if (!(out[k] > 0)) {
      const donor = older.find((r) => r[k] > 0);
      if (donor) out[k] = donor[k];
    }
  }
  return out;
}

async function getPulsechainGasWei() {
  for (const rpc of PULSECHAIN_RPCS) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_gasPrice", params: [] }),
      });
      const j = await res.json();
      if (j.result) return parseInt(j.result, 16);
    } catch { /* next rpc */ }
  }
  return undefined;
}

/// Map a chain's newest daily record onto livedata-style keys.
/// `suffix` is "_Pulsechain" or "" (Ethereum uses unsuffixed keys upstream).
/// `tshareFromPrice` values the T-share at `price` rather than the record's
/// daily tshareRateUSD, so a live price and its T-share price agree.
function statsKeys(rec, suffix, price, tshareFromPrice = false) {
  if (!rec) return {};
  const p = price ?? rec.pricePulseX ?? rec.priceUV2UV3 ?? 0;
  const out = {};
  out[`price${suffix}`] = p;
  out[`tsharePrice${suffix}`] = (tshareFromPrice ? undefined : rec.tshareRateUSD)
    ?? (rec.tshareRateHEX && p ? parseFloat((rec.tshareRateHEX * p).toFixed(4)) : 0);
  out[`tshareRateHEX${suffix}`] = rec.tshareRateHEX ?? 0;
  out[`payoutPerTshare${suffix}`] = rec.payoutPerTshareHEX ?? 0;
  out[`stakedHEX${suffix}`] = rec.stakedHEX ?? 0;
  out[`circulatingHEX${suffix}`] = rec.circulatingHEX ?? 0;
  out[`penaltiesHEX${suffix}`] = rec.penaltiesHEX ?? 0;
  return out;
}

/// Build the full livedata snapshot. `plsPrev` is the newest PulseChain daily
/// record; `ethRecent` the newest few Ethereum records, newest first (either
/// may be empty; their keys are then omitted). Ethereum HEX is priced live,
/// like pHEX, falling back to the newest stored day that has a price.
export async function buildLiveData(plsPrev, ethRecent) {
  const [gasWei, priceHEX, pricePLS, pricePLSX, priceINC, priceEHEX] = await Promise.all([
    getPulsechainGasWei(),
    getPulseXPrice(TOKENS.HEX),
    getPulseXPrice(TOKENS.WPLS),
    getPulseXPrice(TOKENS.PLSX),
    getPulseXPrice(TOKENS.INC),
    getEthereumHexPrice(),
  ]);

  const out = {
    generatedAt: new Date().toISOString(),
    _mirror: true,
    ...statsKeys(newestFilled(ethRecent), "", priceEHEX, true),
    ...statsKeys(plsPrev, "_Pulsechain", priceHEX),
  };

  if (pricePLS) out.pricePLS_Pulsechain = pricePLS;
  if (pricePLSX) out.pricePLSX_Pulsechain = pricePLSX;
  if (priceINC) out.priceINC_Pulsechain = priceINC;

  if (gasWei && pricePLS) {
    const fast = gasWei;
    out.beat = fast / 1e9;
    out.erc20transfer_Pulsechain = (fast / 20000 / 1e9) * pricePLS;
    out.pulseXSwap_Pulsechain = (fast / 4650 / 1e9) * pricePLS;
    out.addLiquidity_Pulsechain = (fast / 3600 / 1e9) * pricePLS;
  }

  return out;
}
