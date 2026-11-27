// On-chain HEX reads for the Ethereum daily collector.
//
// The Graph's hosted service (which the original hexdailystats used for its
// Ethereum pipeline) is dead, so this collector reads the HEX contract
// directly over public JSON-RPC instead — fully keyless:
//   currentDay()                     0x5c9302c9
//   globalInfo()                     0xf04b5fa0  -> uint256[13]
//   dailyDataRange(begin, end)       0x6a210a0e  -> uint256[] (end exclusive)
// Selectors computed with keccak256 and validated against mainnet (day 2373's
// packed payout matches the historical feed record for feed-day 2374 exactly).
//
// DAY NUMBERING: the public feed's record N covers CONTRACT day N-1 (the
// subgraph the original used numbered hexDay = contract day + 1, and the feed
// inherited that). All functions here speak CONTRACT days; the collector
// translates at the edge.

export const HEX_CONTRACT = "0x2b591e99afe9f32eaa6214f7b7629768c40eeb39";
export const ETHEREUM_RPCS = [
  "https://ethereum-rpc.publicnode.com",
  "https://eth.llamarpc.com",
  "https://rpc.ankr.com/eth",
  "https://cloudflare-eth.com",
];

/// HEX launch: 2019-12-03 00:00 UTC. Contract day D spans
/// [LAUNCH + D*86400, LAUNCH + (D+1)*86400).
export const HEX_LAUNCH_TS = 1575331200;

const SEL_CURRENT_DAY = "0x5c9302c9";
const SEL_GLOBAL_INFO = "0xf04b5fa0";
const SEL_DAILY_DATA_RANGE = "0x6a210a0e";
const SEL_GET_RESERVES = "0x0902f1ac";

// Uniswap V2 pools for the on-chain price fallback, read 2026-10-31.
// HEX/WETH is DexScreener's deepest HEX pair ($343k); USDC/WETH prices WETH.
const UNIV2_HEX_WETH = "0x55d5c232d921b9eaa6b37b5845e439acd04b4dba";  // token0 HEX (8 dp), token1 WETH
const UNIV2_USDC_WETH = "0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc"; // token0 USDC (6 dp), token1 WETH

function pad32(n) {
  return BigInt(n).toString(16).padStart(64, "0");
}

function words(resultHex) {
  const s = resultHex.slice(2);
  const out = [];
  for (let i = 0; i < s.length; i += 64) out.push(BigInt("0x" + s.slice(i, i + 64)));
  return out;
}

async function ethCall(data, rpcs = ETHEREUM_RPCS, to = HEX_CONTRACT) {
  let lastErr;
  for (const rpc of rpcs) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1, method: "eth_call",
          params: [{ to, data }, "latest"],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${rpc}`);
      const j = await res.json();
      if (j.result) return j.result;
      lastErr = new Error(`RPC error from ${rpc}: ${JSON.stringify(j.error).slice(0, 150)}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/// Contract's current (in-progress) day.
export async function getContractCurrentDay() {
  return parseInt(await ethCall(SEL_CURRENT_DAY), 16);
}

/// Current global snapshot. Field layout validated on mainnet.
export async function getGlobalInfo() {
  const w = words(await ethCall(SEL_GLOBAL_INFO));
  return {
    stakedHEX: Number(w[0]) / 1e8,        // lockedHeartsTotal
    tshareRateHEX: Number(w[2]) / 10,     // shareRate (HEX per T-share = shareRate/10)
    dailyDataCount: Number(w[4]),
    circulatingHEX: Number(w[11]) / 1e8,  // totalSupply
  };
}

/// Payout + total T-shares for contract days [beginDay, endDay) — one call.
/// Each element packs sats(56) | shares(72) | payout(72); zero = not yet
/// lazily stored by the contract.
export async function getDailyDataRange(beginDay, endDay) {
  const data = SEL_DAILY_DATA_RANGE + pad32(beginDay) + pad32(endDay);
  const w = words(await ethCall(data));
  const len = Number(w[1]); // [0]=array offset, [1]=length
  const M72 = (1n << 72n) - 1n;
  const out = [];
  for (let k = 0; k < len; k++) {
    const v = w[2 + k];
    out.push({
      contractDay: beginDay + k,
      dailyPayoutHEX: Number(v & M72) / 1e8,
      totalTshares: Number((v >> 72n) & M72) / 1e12,
    });
  }
  return out;
}

/// Current HEX price on Ethereum: DexScreener, then the Uniswap V2 pools on
/// chain. DexScreener alone left feed-days 2520, 2522 and 2524 without a
/// price (one try per day at 00:15, and it refuses some Worker IPs), and
/// /livedata then served price 0 for Ethereum HEX.
export async function getEthereumHexPrice() {
  return (await getDexScreenerHexPrice()) ?? (await getUniswapV2HexPrice());
}

/// HEX/WETH reserves times WETH/USDC reserves. Matched DexScreener within
/// 0.2% on 2026-10-31 ($0.0005919 vs $0.0005912).
async function getUniswapV2HexPrice() {
  try {
    const [hexWeth, usdcWeth] = await Promise.all([
      ethCall(SEL_GET_RESERVES, ETHEREUM_RPCS, UNIV2_HEX_WETH),
      ethCall(SEL_GET_RESERVES, ETHEREUM_RPCS, UNIV2_USDC_WETH),
    ]);
    const [hexR, wethR] = words(hexWeth);
    const [usdcR, wethR2] = words(usdcWeth);
    const ethUsd = (Number(usdcR) / 1e6) / (Number(wethR2) / 1e18);
    const p = ((Number(wethR) / 1e18) / (Number(hexR) / 1e8)) * ethUsd;
    return Number.isFinite(p) && p > 0 ? p : undefined;
  } catch {
    return undefined;
  }
}

/// Highest-liquidity DexScreener pair's price (keyless).
async function getDexScreenerHexPrice() {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/tokens/v1/ethereum/${HEX_CONTRACT}`,
      { headers: { "User-Agent": "hex-stats/1.0" } }
    );
    if (!res.ok) return undefined;
    const pairs = await res.json();
    if (!Array.isArray(pairs) || pairs.length === 0) return undefined;
    const best = pairs.reduce((a, b) =>
      (b?.liquidity?.usd ?? 0) > (a?.liquidity?.usd ?? 0) ? b : a
    );
    const p = parseFloat(best?.priceUsd ?? "");
    return Number.isFinite(p) && p > 0 ? p : undefined;
  } catch {
    return undefined;
  }
}
