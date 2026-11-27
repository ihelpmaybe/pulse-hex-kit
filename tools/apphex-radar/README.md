# appHEX Radar (kit copy)

**Hub Pages = showcase peek.** Live swap feed opens without Connect. Do **not** treat github.io as a wallet front end.

Radar does not send transactions. The optional **APPHEX** token gate only runs when you serve this HTML on localhost (or any non-`*.github.io` host).

## Peek on hub

https://ihelpmaybe.github.io/pulse-apphex-radar/

## Run local (optional APPHEX gate)

1. From this folder: `npx --yes serve -l 5179 .` (any static server is fine).
2. Open `http://localhost:5179/` — Connect if you want the gate; feed still works without it once past gate.
3. Or open the hub Pages link above for look-only (no gate).

Force peek mode anywhere: `?showcase=1`.
