# Pulse HEX launch kit (copy-paste)

**Live (each tool has its own site on the hub):** [ihelpmaybe.github.io](https://ihelpmaybe.github.io/)  
- [HEX daily](https://ihelpmaybe.github.io/pulse-hex-daily/) · [Δ Discounts](https://ihelpmaybe.github.io/pulse-delta-discounts/) · [HSA](https://ihelpmaybe.github.io/pulse-hex-stake-analyzer/) · [HEXmob](https://ihelpmaybe.github.io/pulse-hexmob/) · [Radar](https://ihelpmaybe.github.io/pulse-apphex-radar/) · [SQ](https://ihelpmaybe.github.io/pulse-apphex-sq/)  
**Source / zip kit:** [github.com/ihelpmaybe/pulse-hex-kit](https://github.com/ihelpmaybe/pulse-hex-kit)

**Hub Pages = showcase.** Look in the browser. Do **not** treat github.io as a wallet front end.

**Anyone offline:** zip this folder → unzip anywhere → double-click `START.cmd` → hub opens in the browser.

No LookIntoHex / LookIntoMaxi / PulseStats. Those sites use private indexers you can’t honestly “clone.” This kit ships **open substitutes** anyone can run.

### HEXmob — run local to stake

Hub `/pulse-hexmob/` and `tools/hexmob/` are **look-only** (no Connect).

1. Clone [gruvin/hexmob.win](https://github.com/gruvin/hexmob.win)
2. Free Reown project at [cloud.reown.com](https://cloud.reown.com) — allowlist **`http://localhost:5173`** only (not `*.github.io`)
3. `.env.local` → `VITE_REOWN_APPKIT_ID=<your id>`
4. `pnpm install` → `pnpm exec vite` → Connect on localhost

See `tools/hexmob/README.md`.

### appHEX Radar — open clone

Hub `/pulse-apphex-radar/` and `tools/apphex-radar/` are the live swap feed with the APPHEX wallet gate **stripped**. See `tools/apphex-radar/README.md`.

## What’s inside

| Open this | Job | Instead of |
|-----------|-----|------------|
| HEX Stake Analyzer | Paste wallets → stakes / HSI / HTT | LookIntoHex portfolio views |
| HEXmob / TShare | Stake UI (showcase on hub; wallet = run local) | go.hex.com downtime |
| Δ Discounts | Maximus Δ + majors on Pulse | LookIntoMaxi paid Δ |
| HEX daily stats | Pulse day history + live mirror button | HEXDailyStats / hexstats.today |
| appHEX Radar | Live Pulse swap feed (open — no APPHEX gate) | apphex.win Radar |

HEX daily also includes `tools/hexdaily/worker-src/` — Cloudflare Worker clone of the feed ([mrmcgit/hex-stats](https://github.com/mrmcgit/hex-stats)). See `tools/hexdaily/DEPLOY.md`.

## Needs
- Browser
- Internet (public Pulse/ETH RPC + DexScreener)
- Python optional (for `START.cmd` local server). Without Python, open `index.html` or `tools/*/index.html` directly — some tools prefer `http://` over `file://`.

## Desktop portfolios (sibling folders)
Not bundled here (large exes):
- `../lunagray/pulsechain-dashboard-2.0.0-win.exe`
- `../exodus-pulsechain-dashboard/PulseChain.Dashboard.2.4.3.Portable.exe`

## Share
Zip `pulse-hex-kit` only (~10 MB). Keep licenses with HSA.

## Not this kit
Full LookIntoHex dual-chain chart farm · PulseStats command center · paid Maxi OA pages. Use public RPC + these UIs, or self-host official `hex-server` / `pulsex-server` if you want the RH front ends.
