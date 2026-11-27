(() => {
  const RPC = "https://rpc.pulsechain.com";
  const PHEX = "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39";
  const EHEX = "0x57fde0a71132198BBeC939B98976993d8D89D225";
  const WPLS = "0xA1077a294dDE1B09bB078844df40758a5D0f9a27";
  const PLSX = "0x95B303987A60C71504D99Aa1b13B4DA07b0790ab";
  const PRVX = "0xF6f8Db0aBa00007681F8fAF16A0FDa1c9B030b11";
  const DAI_BRIDGED = "0xefD766cCb38EaF1dfd701853BFCe31359239F305";
  const INC = "0x2fa878Ab3F87CC1C9737Fc071108F904c0B0C95d";
  const HDRN = "0x3819f64f282bf135d62168C1e513280dAF905e06";
  const ICSA = "0xfc4913214444aF5c715cc9F7b52655e788A569ed";
  const COM = "0x5A9780Bfe63f3ec57f01b087cD65BD656C9034A8";
  const HEART = 100000000n;
  const HEART_BITS = 72n;
  const HEART_MASK = (1n << HEART_BITS) - 1n;
  const CHUNK = 400;

  const POOLS = [
    { id: "pMAXI", tag: "15y", address: "0x0d86EB9f43C57f6FF3BC9E23D8F9d82503f0e84b", mintHex: 1 },
    { id: "pDECI", tag: "10y", address: "0x6b32022693210cD2Cfc466b9Ac0085DE8fC34eA6", mintHex: 1 },
    { id: "pLUCKY", tag: "7y", address: "0x6B0956258fF7bd7645aa35369B55B61b8e6d6140", mintHex: 1 },
    { id: "pTRIO", tag: "3y", address: "0xF55cD1e399e1cc3D95303048897a680be3313308", mintHex: 1 },
    { id: "pBASE", tag: "1y", address: "0xe9f84d418B008888A992Ff8c6D22389C2C3504e0", mintHex: 1 },
  ];

  /** Majors: kind = spot | parity (vs pHEX) | peg (vs $1) */
  const MAJORS = [
    { id: "pHEX", tag: "state-fork", address: PHEX, kind: "spot" },
    { id: "eHEX", tag: "vs pHEX", address: EHEX, kind: "parity" },
    { id: "PLSX", tag: "PulseX", address: PLSX, kind: "spot" },
    { id: "PRVX", tag: "ProveX", address: PRVX, kind: "spot" },
    { id: "DAI", tag: "bridged vs $1", address: DAI_BRIDGED, kind: "peg" },
    { id: "WPLS", tag: "gas", address: WPLS, kind: "spot" },
    { id: "INC", tag: "Incentive", address: INC, kind: "spot" },
    { id: "HDRN", tag: "Hedron", address: HDRN, kind: "spot" },
    { id: "ICSA", tag: "Icosa", address: ICSA, kind: "spot" },
    { id: "COM", tag: "Communis", address: COM, kind: "spot" },
  ];

  /** RH wallet first-wave pump.tires (address = identity) */
  const MEMES = [
    { id: "MOST", tag: "MostWanted", address: "0xe33a5AE21F93aceC5CfC0b7b0FDBB65A0f0Be5cC" },
    { id: "PUMP", tag: "pump.tires", address: "0xec4252e62C6dE3D655cA9Ce3AfC12E553ebBA274" },
    { id: "mHEX", tag: "meme HEX ≠ pHEX", address: "0x55C50875e890c7eE5621480baB02511C380E12C6" },
    { id: "PEPE", tag: "RH Pepe", address: "0x1B71505D95Ab3e7234ed2239b8EC7aa65b94ae7B" },
    { id: "TRUMP", tag: "RH Trump", address: "0x8cC6d99114Edd628249fAbc8a4d64F9A759a77Bf" },
  ];

  /** Skeleton rotate lanes — openPct null until wired. No fake hit-rates. */
  const ROTATES = [
    { from: "HEX", to: "PRVX", targetPct: 20 },
    { from: "HEX", to: "PLS", targetPct: 20 },
    { from: "HEX", to: "INC", targetPct: 20 },
    { from: "eHEX", to: "HEX", targetPct: 20 },
    { from: "eHEX", to: "PLS", targetPct: 20 },
    { from: "eHEX", to: "PLSX", targetPct: 20 },
    { from: "PLS", to: "INC", targetPct: 20 },
    { from: "PLS", to: "PLSX", targetPct: 20 },
    { from: "PLSX", to: "INC", targetPct: 20 },
  ];

  const SEL = {
    currentDay: "5c9302c9",
    stakeCount: "33060d90",
    stakeLists: "2607443b",
    dailyDataRange: "6a210a0e",
    totalSupply: "18160ddd",
  };

  let rpcId = 1;
  /** @type {Map<number, {payout: bigint, shares: bigint}>} */
  let dayCache = new Map();
  /** @type {Map<string, object>} best pair row by token lower */
  let pairByToken = new Map();

  const $ = (id) => document.getElementById(id);

  function pad32(hexNo0x) {
    return hexNo0x.replace(/^0x/i, "").toLowerCase().padStart(64, "0");
  }
  function encUint(n) {
    return BigInt(n).toString(16).padStart(64, "0");
  }
  function encAddr(a) {
    return pad32(a.toLowerCase());
  }

  async function rpc(method, params) {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: rpcId++, method, params }),
    });
    if (!res.ok) throw new Error("RPC HTTP " + res.status);
    const j = await res.json();
    if (j.error) throw new Error(j.error.message || "RPC error");
    return j.result;
  }

  async function ethCall(to, data) {
    return rpc("eth_call", [{ to, data }, "latest"]);
  }

  function decodeUint(hex) {
    return BigInt(hex || "0x0");
  }

  function decodeUintList(hex) {
    const h = (hex || "0x").replace(/^0x/i, "");
    if (h.length < 64) return [];
    const offset = Number(BigInt("0x" + h.slice(0, 64)));
    const start = offset * 2;
    const len = Number(BigInt("0x" + h.slice(start, start + 64)));
    const out = [];
    let p = start + 64;
    for (let i = 0; i < len; i++) {
      out.push(BigInt("0x" + h.slice(p, p + 64)));
      p += 64;
    }
    return out;
  }

  function decodeStakeTuple(hex) {
    const h = (hex || "0x").replace(/^0x/i, "").padStart(64 * 7, "0");
    const u = (i) => BigInt("0x" + h.slice(i * 64, i * 64 + 64));
    return {
      stakeId: u(0),
      stakedHearts: u(1),
      stakeShares: u(2),
      lockedDay: Number(u(3)),
      stakedDays: Number(u(4)),
      unlockedDay: Number(u(5)),
      isAutoStake: u(6) !== 0n,
    };
  }

  function decodeDay(packed) {
    return {
      payout: packed & HEART_MASK,
      shares: (packed >> HEART_BITS) & HEART_MASK,
    };
  }

  async function getCurrentDay() {
    return Number(decodeUint(await ethCall(PHEX, "0x" + SEL.currentDay)));
  }

  async function getStake(staker) {
    const count = Number(decodeUint(await ethCall(PHEX, "0x" + SEL.stakeCount + encAddr(staker))));
    if (!count) return null;
    let best = null;
    for (let i = 0; i < count; i++) {
      const st = decodeStakeTuple(
        await ethCall(PHEX, "0x" + SEL.stakeLists + encAddr(staker) + encUint(i))
      );
      st.index = i;
      if (st.unlockedDay === 0) return st;
      best = st;
    }
    return best;
  }

  async function getTotalSupply(token) {
    return decodeUint(await ethCall(token, "0x" + SEL.totalSupply));
  }

  async function ensureDayRange(beginDay, endDay) {
    if (beginDay >= endDay) return;
    let b = beginDay;
    while (b < endDay) {
      if (dayCache.has(b)) {
        b++;
        continue;
      }
      let e = b;
      while (e < endDay && e - b < CHUNK && !dayCache.has(e)) e++;
      const raw = await ethCall(
        PHEX,
        "0x" + SEL.dailyDataRange + encUint(b) + encUint(e)
      );
      const packed = decodeUintList(raw);
      for (let i = 0; i < packed.length; i++) dayCache.set(b + i, decodeDay(packed[i]));
      b = e;
    }
  }

  async function loadPayoutDays(beginDay, endDay) {
    await ensureDayRange(beginDay, endDay);
    const days = [];
    for (let d = beginDay; d < endDay; d++) {
      const row = dayCache.get(d);
      if (row) days.push(row);
    }
    return days;
  }

  function interestHearts(stakeShares, dayObjs) {
    let total = 0n;
    for (const d of dayObjs) {
      if (d.shares === 0n) continue;
      total += (stakeShares * d.payout) / d.shares;
    }
    return total;
  }

  /** numHearts / denHearts as float (HEX units cancel). */
  function heartsRatio(num, den) {
    if (den === 0n) return null;
    const scale = 1_000_000_000_000n;
    return Number((num * scale) / den) / Number(scale);
  }

  function pickBestPair(tokenAddr, pairs) {
    const t = tokenAddr.toLowerCase();
    const scored = (pairs || [])
      .filter((p) => p.chainId === "pulsechain")
      .map((p) => {
        const b = (p.baseToken?.address || "").toLowerCase();
        const q = (p.quoteToken?.address || "").toLowerCase();
        if (b !== t && q !== t) return null;
        const liq = Number(p.liquidity?.usd || 0);
        const usd = Number(p.priceUsd || 0);
        let hexPer = null;
        const h = PHEX.toLowerCase();
        if (b === t && q === h) hexPer = Number(p.priceNative);
        else if (q === t && b === h) {
          const n = Number(p.priceNative);
          hexPer = n > 0 ? 1 / n : null;
        }
        return {
          liq,
          usd: usd > 0 ? usd : null,
          hexPer,
          change24h: Number(p.priceChange?.h24),
          pairUrl: p.url || null,
          dexId: p.dexId || "",
          vol24: Number(p.volume?.h24 || 0),
          fdv: Number(p.fdv || p.marketCap || 0),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.liq - a.liq);
    return scored[0] || null;
  }

  async function loadDexChunk(chunk) {
    const url = "https://api.dexscreener.com/latest/dex/tokens/" + chunk.join(",");
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error("DexScreener HTTP " + res.status);
    const j = await res.json();
    const pairs = j.pairs || [];
    for (const addr of chunk) {
      const mine = pairs.filter((p) => {
        const b = (p.baseToken?.address || "").toLowerCase();
        const q = (p.quoteToken?.address || "").toLowerCase();
        return b === addr || q === addr;
      });
      const best = pickBestPair(addr, mine);
      if (best) pairByToken.set(addr, best);
    }
  }

  async function loadDexBatch(addresses) {
    const uniq = [...new Set(addresses.map((a) => a.toLowerCase()))];
    // Small chunks — big multi-token calls often drop Pulse pairs.
    for (let i = 0; i < uniq.length; i += 6) {
      await loadDexChunk(uniq.slice(i, i + 6));
    }
    // Retry misses one-by-one (Maximus needs HEX-quoted pairs).
    const miss = uniq.filter((a) => !pairByToken.has(a));
    for (const addr of miss) {
      try {
        await loadDexChunk([addr]);
      } catch (_) {
        /* keep going */
      }
    }
  }

  function quote(addr) {
    return pairByToken.get(addr.toLowerCase()) || null;
  }

  function fmtUsd(n) {
    if (n == null || !Number.isFinite(n)) return "—";
    if (n >= 1) return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 4 });
    if (n >= 0.01) return "$" + n.toFixed(4);
    return "$" + n.toPrecision(3);
  }

  function fmtHex(n, digits = 4) {
    if (n == null || !Number.isFinite(n)) return "—";
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: digits,
    });
  }

  function fmtPct(n) {
    if (n == null || !Number.isFinite(n)) return "—";
    const sign = n > 0 ? "+" : "";
    return sign + n.toFixed(1) + "%";
  }

  function fmtLiq(n) {
    if (!n) return "$0";
    if (n >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return "$" + Math.round(n / 1e3) + "k";
    return "$" + Math.round(n);
  }

  function deltaClass(disc) {
    if (disc == null || !Number.isFinite(disc)) return "flat";
    if (disc < -0.25) return "disc";
    if (disc > 0.25) return "prem";
    return "flat";
  }

  function deltaLabel(disc, mode) {
    if (disc == null || !Number.isFinite(disc)) return "—";
    if (Math.abs(disc) < 0.05) return "flat";
    if (mode === "chg") return fmtPct(disc) + " 24h";
    return disc < 0 ? fmtPct(disc) + " disc" : fmtPct(disc) + " prem";
  }

  function cardShell(id, tag, bodyHtml) {
    const el = document.createElement("article");
    el.className = "card";
    el.innerHTML =
      '<div class="head"><span class="sym">' +
      id +
      '</span><span class="yrs">' +
      (tag || "") +
      "</span></div>" +
      bodyHtml;
    return el;
  }

  function renderError(id, tag, err) {
    return cardShell(id, tag, '<div class="err">' + err + "</div>");
  }

  function renderMaxi(pool, row, hist) {
    if (row.error) return renderError(pool.id, pool.tag, row.error);
    const disc = row.deltaPct;
    return cardShell(
      pool.id,
      pool.tag + " · " + row.progressPct.toFixed(1) + "%",
      '<div class="delta ' +
        deltaClass(disc) +
        '">' +
        deltaLabel(disc) +
        "</div>" +
        '<div class="one">Mkt <b>' +
        fmtHex(row.marketHex) +
        "</b> · Back <b>" +
        fmtHex(row.backingHex) +
        "</b> HEX</div>" +
        '<div class="one">vs mint <b>' +
        fmtPct(row.mintDeltaPct) +
        "</b> · " +
        fmtLiq(row.liqUsd) +
        "</div>" +
        '<details class="more"><summary>Details</summary><dl>' +
        "<dt>Principal/t</dt><dd>" +
        fmtHex(row.principalHex) +
        "</dd>" +
        "<dt>Yield/t</dt><dd>" +
        fmtHex(row.yieldHex) +
        "</dd>" +
        "<dt>Days left</dt><dd>" +
        row.daysLeft +
        "</dd>" +
        histLine(hist, pool.id) +
        (row.pairUrl
          ? '<dt>Pair</dt><dd><a href="' +
            row.pairUrl +
            '" target="_blank" rel="noopener">dex</a></dd>'
          : "") +
        "</dl></details>"
    );
  }

  function renderMajor(item, row) {
    if (row.error) return renderError(item.id, item.tag, row.error);
    const mode = item.kind === "spot" && row.deltaPct == null ? "chg" : "disc";
    const big = row.deltaPct != null ? row.deltaPct : row.change24h;
    return cardShell(
      item.id,
      item.tag,
      '<div class="delta ' +
        deltaClass(big) +
        '">' +
        deltaLabel(big, mode) +
        "</div>" +
        '<div class="one"><b>' +
        fmtUsd(row.usd) +
        "</b>" +
        (row.hexPer != null ? " · " + fmtHex(row.hexPer, 3) + " HEX" : "") +
        "</div>" +
        '<div class="one">24h <b>' +
        fmtPct(row.change24h) +
        "</b> · " +
        fmtLiq(row.liqUsd) +
        "</div>" +
        '<details class="more"><summary>Details</summary><dl>' +
        "<dt>FDV</dt><dd>" +
        fmtLiq(row.fdv) +
        "</dd>" +
        "<dt>Vol 24h</dt><dd>" +
        fmtLiq(row.vol24) +
        "</dd>" +
        (row.note ? "<dt>Note</dt><dd>" + row.note + "</dd>" : "") +
        (row.pairUrl
          ? '<dt>Pair</dt><dd><a href="' +
            row.pairUrl +
            '" target="_blank" rel="noopener">dex</a></dd>'
          : "") +
        "</dl></details>"
    );
  }

  function renderMeme(item, row) {
    if (row.error) return renderError(item.id, item.tag, row.error);
    return cardShell(
      item.id,
      item.tag,
      '<div class="delta ' +
        deltaClass(row.change24h) +
        '">' +
        deltaLabel(row.change24h, "chg") +
        "</div>" +
        '<div class="one"><b>' +
        fmtUsd(row.usd) +
        "</b> · mcap " +
        fmtLiq(row.fdv) +
        "</div>" +
        '<div class="one">' +
        fmtLiq(row.liqUsd) +
        " liq · vol " +
        fmtLiq(row.vol24) +
        "</div>" +
        (row.pairUrl
          ? '<details class="more"><summary>Details</summary><dl><dt>Pair</dt><dd><a href="' +
            row.pairUrl +
            '" target="_blank" rel="noopener">dex</a></dd></dl></details>'
          : "")
    );
  }

  const ROTATE_KEY = "delta-rotates-v1";
  const HIST_KEY = "delta-maxi-hist-v1";

  /** Map symbol → USD from loaded quotes (best-effort). */
  function usdBySym() {
    const map = {
      HEX: quote(PHEX)?.usd,
      pHEX: quote(PHEX)?.usd,
      eHEX: quote(EHEX)?.usd,
      PLS: quote(WPLS)?.usd,
      WPLS: quote(WPLS)?.usd,
      PLSX: quote(PLSX)?.usd,
      PRVX: quote(PRVX)?.usd,
      INC: quote(INC)?.usd,
    };
    return map;
  }

  function loadRotateBaseline() {
    try {
      return JSON.parse(localStorage.getItem(ROTATE_KEY) || "{}") || {};
    } catch (_) {
      return {};
    }
  }

  function saveRotateBaseline(obj) {
    try {
      localStorage.setItem(ROTATE_KEY, JSON.stringify(obj));
    } catch (_) {}
  }

  function paintRotates() {
    const el = $("gridRotates");
    if (!el) return;
    el.innerHTML = "";
    const usd = usdBySym();
    const base = loadRotateBaseline();
    let dirty = false;
    for (const r of ROTATES) {
      const a = usd[r.from];
      const b = usd[r.to];
      let open = null;
      let tag = "need $";
      if (a != null && b != null && a > 0 && b > 0) {
        const ratio = b / a;
        const key = r.from + ">" + r.to;
        if (base[key] == null || !(base[key] > 0)) {
          base[key] = ratio;
          dirty = true;
          open = 0;
          tag = "baseline set";
        } else {
          open = ((ratio - base[key]) / base[key]) * 100;
          tag = "since board open";
        }
      }
      const card = document.createElement("div");
      card.className = "card rotate";
      card.innerHTML =
        '<div class="head"><span class="pair">' +
        r.from +
        " → " +
        r.to +
        '</span><span class="skel-tag">' +
        tag +
        "</span></div>" +
        '<div class="pct' +
        (open != null ? " live" : "") +
        '">' +
        (open != null ? fmtPct(open) : "—") +
        "</div>" +
        '<div class="meta">watch +' +
        r.targetPct +
        "% · vs hold " +
        r.from +
        "</div>";
      el.appendChild(card);
    }
    if (dirty) saveRotateBaseline(base);
  }

  function pushMaxiHist(rows) {
    try {
      const prev = JSON.parse(localStorage.getItem(HIST_KEY) || "[]") || [];
      const snap = {
        t: Date.now(),
        rows: POOLS.map((p, i) => ({
          id: p.id,
          d: rows[i]?.deltaPct ?? null,
          m: rows[i]?.marketHex ?? null,
          b: rows[i]?.backingHex ?? null,
        })),
      };
      const next = [...prev, snap].slice(-24);
      localStorage.setItem(HIST_KEY, JSON.stringify(next));
      return next;
    } catch (_) {
      return [];
    }
  }

  function histLine(hist, id) {
    if (!hist || hist.length < 2) return "";
    const series = hist
      .map((h) => h.rows.find((r) => r.id === id)?.d)
      .filter((x) => x != null && Number.isFinite(x));
    if (series.length < 2) return "";
    const first = series[0];
    const last = series[series.length - 1];
    return (
      "<dt>Δ since first snap</dt><dd>" + fmtPct(last - first) + " pts</dd>"
    );
  }

  async function computePool(pool, currentDay) {
    const [stake, supply] = await Promise.all([
      getStake(pool.address),
      getTotalSupply(pool.address),
    ]);
    if (!stake) throw new Error("No HEX stake on pool");
    if (supply === 0n) throw new Error("Zero supply");

    const begin = stake.lockedDay;
    const end = Math.min(currentDay, stake.lockedDay + stake.stakedDays);
    const dayObjs = await loadPayoutDays(begin, end);
    const payout = interestHearts(stake.stakeShares, dayObjs);
    const backingHearts = stake.stakedHearts + payout;
    const backingHex = heartsRatio(backingHearts, supply);
    const principalHex = heartsRatio(stake.stakedHearts, supply);
    const yieldHex = heartsRatio(payout, supply);
    const mkt = quote(pool.address);
    const marketHex = mkt?.hexPer ?? null;
    // Prefer HEX-quoted; else derive from USD / pHEX USD
    let hexPer = marketHex;
    if (hexPer == null && mkt?.usd != null) {
      const phex = quote(PHEX);
      if (phex?.usd) hexPer = mkt.usd / phex.usd;
    }
    const deltaPct =
      hexPer != null && backingHex > 0 ? ((hexPer - backingHex) / backingHex) * 100 : null;
    const mintDeltaPct =
      hexPer != null && pool.mintHex > 0
        ? ((hexPer - pool.mintHex) / pool.mintHex) * 100
        : null;
    const served = Math.max(0, Math.min(stake.stakedDays, currentDay - stake.lockedDay));
    return {
      marketHex: hexPer,
      backingHex,
      principalHex,
      yieldHex,
      deltaPct,
      mintDeltaPct,
      progressPct: (served / stake.stakedDays) * 100,
      daysLeft: Math.max(0, stake.stakedDays - served),
      liqUsd: mkt?.liq || 0,
      pairUrl: mkt?.pairUrl || null,
    };
  }

  function computeMajor(item) {
    const q = quote(item.address);
    if (!q || q.usd == null) throw new Error("No Pulse pair");
    let deltaPct = null;
    let note = "";
    if (item.kind === "parity") {
      const phex = quote(PHEX);
      if (!phex?.usd) throw new Error("Need pHEX price");
      deltaPct = ((q.usd - phex.usd) / phex.usd) * 100;
      note = "vs pHEX";
    } else if (item.kind === "peg") {
      deltaPct = ((q.usd - 1) / 1) * 100;
      note = "vs $1";
    }
    return {
      usd: q.usd,
      hexPer: q.hexPer,
      change24h: Number.isFinite(q.change24h) ? q.change24h : null,
      liqUsd: q.liq,
      vol24: q.vol24,
      fdv: q.fdv,
      pairUrl: q.pairUrl,
      deltaPct,
      note,
    };
  }

  function computeMeme(item) {
    const q = quote(item.address);
    if (!q || q.usd == null) throw new Error("No Pulse pair");
    return {
      usd: q.usd,
      change24h: Number.isFinite(q.change24h) ? q.change24h : null,
      liqUsd: q.liq,
      vol24: q.vol24,
      fdv: q.fdv,
      pairUrl: q.pairUrl,
    };
  }

  function fillGrid(el, items, rows, render) {
    el.innerHTML = "";
    const packed = items.map((item, i) => ({ item, row: rows[i], i }));
    packed.sort((a, b) => {
      if (a.row.error && !b.row.error) return 1;
      if (!a.row.error && b.row.error) return -1;
      const da =
        a.row.deltaPct != null
          ? a.row.deltaPct
          : a.row.change24h != null
            ? a.row.change24h
            : 999;
      const db =
        b.row.deltaPct != null
          ? b.row.deltaPct
          : b.row.change24h != null
            ? b.row.change24h
            : 999;
      // discounts / dumps first
      return da - db;
    });
    for (const { item, row } of packed) el.appendChild(render(item, row));
  }

  async function warmDaysForPools(currentDay) {
    const stakes = await Promise.all(POOLS.map((p) => getStake(p.address)));
    let begin = currentDay;
    let end = 0;
    for (const st of stakes) {
      if (!st) continue;
      begin = Math.min(begin, st.lockedDay);
      end = Math.max(end, Math.min(currentDay, st.lockedDay + st.stakedDays));
    }
    if (end > begin) await ensureDayRange(begin, end);
    return stakes;
  }

  async function refresh() {
    const btn = $("btnRefresh");
    btn.disabled = true;
    $("strip").textContent = "Fetching chain + DEX…";
    dayCache = new Map();
    pairByToken = new Map();

    try {
      const allAddrs = [
        ...POOLS.map((p) => p.address),
        ...MAJORS.map((p) => p.address),
        ...MEMES.map((p) => p.address),
      ];
      const [currentDay] = await Promise.all([getCurrentDay(), loadDexBatch(allAddrs)]);
      $("strip").textContent = "Warming HEX daily payouts…";
      await warmDaysForPools(currentDay);

      const maxiRows = await Promise.all(
        POOLS.map(async (pool) => {
          try {
            return await computePool(pool, currentDay);
          } catch (e) {
            return { error: String(e.message || e) };
          }
        })
      );

      const majorRows = MAJORS.map((m) => {
        try {
          return computeMajor(m);
        } catch (e) {
          return { error: String(e.message || e) };
        }
      });

      const memeRows = MEMES.map((m) => {
        try {
          return computeMeme(m);
        } catch (e) {
          return { error: String(e.message || e) };
        }
      });

      const hist = pushMaxiHist(maxiRows);
      const maxiEl = $("gridMaxi");
      maxiEl.innerHTML = "";
      const packed = POOLS.map((item, i) => ({ item, row: maxiRows[i] }));
      packed.sort((a, b) => {
        if (a.row.error && !b.row.error) return 1;
        if (!a.row.error && b.row.error) return -1;
        const da = a.row.deltaPct != null ? a.row.deltaPct : 999;
        const db = b.row.deltaPct != null ? b.row.deltaPct : 999;
        return da - db;
      });
      for (const { item, row } of packed) maxiEl.appendChild(renderMaxi(item, row, hist));

      fillGrid($("gridMajors"), MAJORS, majorRows, renderMajor);
      fillGrid($("gridMemes"), MEMES, memeRows, renderMeme);
      paintRotates();

      const ehex = majorRows[MAJORS.findIndex((m) => m.id === "eHEX")];
      const deep = maxiRows
        .map((r, i) => ({ id: POOLS[i].id, d: r.deltaPct }))
        .filter((x) => x.d != null)
        .sort((a, b) => a.d - b.d)[0];
      const okN = maxiRows.filter((r) => r.deltaPct != null).length;

      $("strip").innerHTML =
        "HEX day <b>" +
        currentDay +
        "</b> · Maximus <b>" +
        okN +
        "/" +
        POOLS.length +
        "</b>" +
        (deep ? " · deepest <b>" + deep.id + " " + fmtPct(deep.d) + "</b>" : "") +
        (ehex && ehex.deltaPct != null
          ? " · eHEX <b>" + fmtPct(ehex.deltaPct) + "</b> vs pHEX"
          : "") +
        " · " +
        new Date().toLocaleTimeString();
    } catch (e) {
      $("strip").innerHTML = '<span class="err">' + String(e.message || e) + "</span>";
    } finally {
      btn.disabled = false;
    }
  }

  $("btnRefresh").addEventListener("click", refresh);
  refresh();
})();
