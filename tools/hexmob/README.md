# HEXmob (kit copy)

**Hub Pages + this folder = showcase only.** Look at the stake UI. Do **not** Connect a wallet here — github.io / the zip dist are not a wallet front end.

## Run local to stake (your machine)

1. Clone upstream source: [gruvin/hexmob.win](https://github.com/gruvin/hexmob.win) (GPLv3 / upstream).
2. Free Reown AppKit id: [cloud.reown.com](https://cloud.reown.com) → create a project → allowlist **`http://localhost:5173`** (and any other local ports you use). **Do not** allowlist `*.github.io` for staking.
3. Copy `.env` sample → `.env.local` with `VITE_REOWN_APPKIT_ID=…` (your id only).
4. `pnpm install` then `pnpm exec vite` (or `vite build` + `vite preview`).
5. Open the local URL, Connect, stake.

Kit zip `tools/hexmob/` is a prebuilt **look** mirror of the hub. Wallet signing stays on a host you control.
