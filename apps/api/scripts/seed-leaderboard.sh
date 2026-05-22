#!/usr/bin/env bash
#
# Seed the public leaderboard with a curated set of well-known Shopify /
# Hydrogen storefronts so the board is alive and cite-able from day one.
#
# Each domain is scanned through the *production* /scan endpoint, so the
# persisted score is exactly what a user sees. The X-Zephyr-Internal header
# carries INTERNAL_SECRET to bypass per-IP rate limiting (otherwise we'd trip
# the 10/hour cap after ten domains).
#
# Usage:
#   INTERNAL_SECRET=xxxx bash apps/api/scripts/seed-leaderboard.sh
#
# Optional:
#   API_BASE   override the scanner base URL (default https://api.zephyr.build)
#   DELAY      seconds between scans, to stay polite to targets (default 2)
#
set -euo pipefail

API_BASE="${API_BASE:-https://api.zephyr.build}"
DELAY="${DELAY:-2}"

if [[ -z "${INTERNAL_SECRET:-}" ]]; then
  echo "error: INTERNAL_SECRET must be set in the environment" >&2
  exit 1
fi

# Curated, public, well-known Shopify-powered DTC brands. Mix of Hydrogen/
# headless and classic Online Store. Edit freely — the loop is dumb on purpose.
DOMAINS=(
  allbirds.com
  gymshark.com
  kith.com
  fashionnova.com
  chubbiesshorts.com
  mejuri.com
  rothys.com
  brooklinen.com
  ruggable.com
  bombas.com
  mvmt.com
  puravidabracelets.com
  drinkolipop.com
  liquiddeath.com
  deathwishcoffee.com
  colourpop.com
  jeffreestarcosmetics.com
  hellotushy.com
  drsquatch.com
  magicspoon.com
  knix.com
  taylorstitch.com
  vuoriclothing.com
  skims.com
  kyliecosmetics.com
  untuckit.com
  hauslabs.com
  glossier.com
  spigen.com
  redbullshopus.com
  tecovas.com
  caraway.com
  outdoorvoices.com
  nakd.com
  beardbrand.com
)

total=${#DOMAINS[@]}
echo "Seeding $total domains via $API_BASE ..."
i=0
for domain in "${DOMAINS[@]}"; do
  i=$((i + 1))
  line=$(curl -s -G "$API_BASE/scan" \
    --data-urlencode "url=https://$domain" \
    -H "X-Zephyr-Internal: $INTERNAL_SECRET" \
    | python3 -c "import sys,json
try:
    d=json.load(sys.stdin); s=d['score']
    print(f\"{s['grade']} {s['overall']}\")
except Exception as e:
    print(f'ERR {e}')" 2>/dev/null || echo "ERR curl")
  printf "  [%2d/%2d] %-26s %s\n" "$i" "$total" "$domain" "$line"
  sleep "$DELAY"
done
echo "Done. Check $API_BASE/leaderboard?period=all"
