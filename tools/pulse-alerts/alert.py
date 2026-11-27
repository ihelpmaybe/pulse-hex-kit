#!/usr/bin/env python3
"""
Pulse / HEX Telegram alerts — MIT, stdlib only.

Job: ping a chat when a PulseX swap clears MIN_USD (optional HEX-only filter).
Public PulseX subgraph + Telegram Bot API.

  1. Copy config.example.env → config.env  (BOT_TOKEN + CHAT_ID)
  2. python alert.py --dry-run --once   # print matches, no Telegram
  3. python alert.py                    # live loop
  4. python alert.py --chat-id          # list chats (message the bot first)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STATE_PATH = ROOT / ".alert-state.json"
CONFIG_PATH = ROOT / "config.env"
DEFAULT_SUBGRAPH = "https://graph.pulsechain.com/subgraphs/name/pulsechain/pulsexv2"
PHEX = "0x2b591e99afe9f32eaa6214f7b7629768c40eeb39"

SWAPS_QUERY = """
query RecentSwaps($first: Int!) {
  swaps(first: $first, orderBy: timestamp, orderDirection: desc) {
    id
    timestamp
    amountUSD
    transaction { id }
    pair {
      token0 { id symbol }
      token1 { id symbol }
    }
  }
}
"""


def load_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


ENV = load_env(CONFIG_PATH)


def cfg(key: str, default: str = "") -> str:
    return os.environ.get(key) or ENV.get(key) or default


def http_json(url: str, payload: dict | None = None, timeout: float = 30) -> dict:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", "User-Agent": "pulse-alerts/1.0"},
        method="GET" if data is None else "POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def tg_api(method: str, token: str, params: dict) -> dict:
    url = f"https://api.telegram.org/bot{token}/{method}"
    body = urllib.parse.urlencode(params).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def load_state() -> dict:
    if STATE_PATH.is_file():
        try:
            return json.loads(STATE_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass
    return {"seen": []}


def save_state(state: dict) -> None:
    state["seen"] = (state.get("seen") or [])[-500:]
    STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")


def fetch_swaps(subgraph: str, first: int = 50) -> list[dict]:
    raw = http_json(subgraph, {"query": SWAPS_QUERY, "variables": {"first": first}})
    if raw.get("errors"):
        raise RuntimeError(raw["errors"])
    return (raw.get("data") or {}).get("swaps") or []


def is_hex_pair(swap: dict) -> bool:
    pair = swap.get("pair") or {}
    for side in ("token0", "token1"):
        t = pair.get(side) or {}
        addr = (t.get("id") or "").lower()
        sym = (t.get("symbol") or "").upper()
        if addr == PHEX or sym in ("HEX", "EHEX", "PHEX"):
            return True
    return False


def fmt_usd(n: float) -> str:
    if n >= 1_000_000:
        return f"${n / 1_000_000:.2f}M"
    if n >= 1_000:
        return f"${n:,.0f}"
    return f"${n:,.2f}"


def print_chat_ids(token: str) -> None:
    try:
        data = tg_api("getUpdates", token, {"limit": 20})
    except urllib.error.HTTPError as e:
        print(f"Telegram error: {e}", file=sys.stderr)
        sys.exit(1)
    if not data.get("ok"):
        print(data, file=sys.stderr)
        sys.exit(1)
    chats: dict[int, str] = {}
    for upd in data.get("result") or []:
        msg = upd.get("message") or upd.get("channel_post") or {}
        chat = msg.get("chat") or {}
        cid = chat.get("id")
        if cid is not None:
            chats[cid] = (
                chat.get("title")
                or chat.get("username")
                or chat.get("first_name")
                or ""
            )
    if not chats:
        print("No chats yet. Open Telegram → message your bot → run this again.")
        return
    print("CHAT_ID options:")
    for cid, name in chats.items():
        print(f"  {cid}  ({name})")


def notify(token: str, chat_id: str, text: str, dry: bool) -> None:
    if dry:
        print("[dry-run]", text.replace("\n", " | "))
        return
    tg_api(
        "sendMessage",
        token,
        {"chat_id": chat_id, "text": text, "disable_web_page_preview": "true"},
    )


def poll(
    *,
    subgraph: str,
    min_usd: float,
    hex_only: bool,
    token: str,
    chat_id: str,
    dry: bool,
    bootstrap: bool,
) -> int:
    state = load_state()
    seen = set(state.get("seen") or [])
    swaps = fetch_swaps(subgraph)
    hits: list[dict] = []

    for s in swaps:
        sid = s.get("id") or ""
        if not sid:
            continue
        if sid in seen:
            continue
        usd = float(s.get("amountUSD") or 0)
        if usd < min_usd or (hex_only and not is_hex_pair(s)):
            seen.add(sid)
            continue
        hits.append(s)
        seen.add(sid)

    state["seen"] = list(seen)
    save_state(state)

    if bootstrap:
        print(f"Bootstrapped {len(seen)} ids (no alerts). Future polls only send new ones.")
        return 0

    for s in reversed(hits):
        pair = s.get("pair") or {}
        t0 = (pair.get("token0") or {}).get("symbol") or "?"
        t1 = (pair.get("token1") or {}).get("symbol") or "?"
        usd = float(s.get("amountUSD") or 0)
        tx = (s.get("transaction") or {}).get("id") or ""
        link = f"https://scan.pulsechain.com/tx/{tx}" if tx else ""
        text = f"PulseX swap {fmt_usd(usd)}\n{t0} / {t1}\n{link}".strip()
        notify(token, chat_id, text, dry)
        print(f"{fmt_usd(usd)}  {t0}/{t1}")

    if not hits:
        suffix = ", HEX pairs only" if hex_only else ""
        print(f"No new alerts (min ${min_usd:g}{suffix})")
    return len(hits)


def main() -> int:
    ap = argparse.ArgumentParser(description="Cloneable Pulse/HEX Telegram swap alerts")
    ap.add_argument("--dry-run", action="store_true", help="Print; do not call Telegram")
    ap.add_argument("--chat-id", action="store_true", help="List chat ids from getUpdates")
    ap.add_argument("--once", action="store_true", help="Single poll then exit")
    ap.add_argument("--bootstrap", action="store_true", help="Mark current swaps seen; exit")
    args = ap.parse_args()

    token = cfg("BOT_TOKEN")
    chat_id = cfg("CHAT_ID")
    subgraph = cfg("SUBGRAPH", DEFAULT_SUBGRAPH)
    min_usd = float(cfg("MIN_USD", "1000"))
    hex_only = cfg("HEX_ONLY", "1").lower() in ("1", "true", "yes")
    poll_sec = max(5, int(cfg("POLL_SEC", "30")))
    dry = args.dry_run or cfg("DRY_RUN", "").lower() in ("1", "true", "yes")

    if args.chat_id:
        if not token:
            print("Set BOT_TOKEN in config.env first.", file=sys.stderr)
            return 1
        print_chat_ids(token)
        return 0

    if not dry and not args.bootstrap and (not token or not chat_id):
        print(
            "Missing BOT_TOKEN or CHAT_ID.\n"
            "Copy config.example.env → config.env, or use --dry-run.\n"
            "After messaging the bot: python alert.py --chat-id",
            file=sys.stderr,
        )
        return 1

    common = dict(
        subgraph=subgraph,
        min_usd=min_usd,
        hex_only=hex_only,
        token=token or "x",
        chat_id=chat_id or "0",
        dry=dry,
    )

    if args.bootstrap or not STATE_PATH.is_file():
        poll(**common, bootstrap=True)
        if args.bootstrap:
            return 0

    def tick() -> None:
        poll(**common, bootstrap=False)

    if args.once:
        tick()
        return 0

    mode = "DRY-RUN" if dry else "LIVE"
    print(f"pulse-alerts {mode} · min ${min_usd:g} · HEX_ONLY={hex_only} · every {poll_sec}s")
    while True:
        try:
            tick()
        except Exception as e:
            print(f"poll error: {e}", file=sys.stderr)
        time.sleep(poll_sec)


if __name__ == "__main__":
    raise SystemExit(main())
