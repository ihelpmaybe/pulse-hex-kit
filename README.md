# Pulse HEX launch kit (copy-paste)

**Live hub:** [ihelpmaybe.github.io/pulse-hex-kit](https://ihelpmaybe.github.io/pulse-hex-kit/)  
**Source:** [github.com/ihelpmaybe/pulse-hex-kit](https://github.com/ihelpmaybe/pulse-hex-kit)

**Anyone offline:** zip this folder → unzip anywhere → double-click `START.cmd` → hub opens in the browser.

No LookIntoHex / LookIntoMaxi / PulseStats. Those sites use private indexers you can’t honestly “clone.” This kit ships **open substitutes** anyone can run.

## What’s inside

| Open this | Job | Instead of |
|-----------|-----|------------|
| HEX Stake Analyzer | Paste wallets → stakes / HSI / HTT | LookIntoHex portfolio views |
| HEXmob / TShare | Stake UI (wallet connect) | go.hex.com downtime |
| Δ Discounts | Maximus Δ + majors on Pulse | LookIntoMaxi paid Δ |
| HEX daily stats | Pulse day history + live mirror button | HEXDailyStats / hexstats.today |

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
