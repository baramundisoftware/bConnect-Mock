#!/usr/bin/env bash
# show-running-mocks.sh — list all running bConnectMock instances with status

set -euo pipefail

MOCK_BINARY="bConnect-Mock/build/index.js"

echo "bConnectMock Instances"
echo "══════════════════════════════════════════════════════════"
printf "%-8s %-7s %-10s %-10s %-12s %s\n" "PID" "PORT" "BMS VER" "PROFILE" "REQUESTS" "UPTIME"
echo "──────────────────────────────────────────────────────────"

found=0

while IFS= read -r pid; do
  # Find the listening port for this PID
  port=$(ss -tlnp 2>/dev/null \
    | grep "pid=${pid}," \
    | grep -oP ':\K[0-9]+(?=\s)' \
    | head -1)

  if [[ -z "$port" ]]; then
    port="unknown"
  fi

  uptime_raw=""
  profile=""
  bms_ver=""
  requests=""

  if [[ "$port" != "unknown" ]]; then
    health=$(curl -sf --max-time 2 "http://localhost:${port}/health" 2>/dev/null || true)
    if [[ -n "$health" ]]; then
      profile=$(echo "$health"   | grep -oP '"profile"\s*:\s*"\K[^"]+' || echo "—")
      bms_ver=$(echo "$health"   | grep -oP '"bmsVersion"\s*:\s*"\K[^"]+' || echo "—")
      requests=$(echo "$health"  | grep -oP '"requestCount"\s*:\s*\K[0-9]+' || echo "—")
      uptime_s=$(echo "$health"  | grep -oP '"uptime"\s*:\s*\K[0-9]+' || echo "")
      if [[ -n "$uptime_s" ]]; then
        h=$(( uptime_s / 3600 ))
        m=$(( (uptime_s % 3600) / 60 ))
        s=$(( uptime_s % 60 ))
        uptime_raw=$(printf "%dh%02dm%02ds" "$h" "$m" "$s")
      else
        uptime_raw="—"
      fi
    fi
  fi

  printf "%-8s %-7s %-10s %-10s %-12s %s\n" \
    "$pid" "$port" "${bms_ver:-—}" "${profile:-—}" "${requests:-—}" "${uptime_raw:-—}"
  (( found++ )) || true

done < <(pgrep -f "$MOCK_BINARY" 2>/dev/null | xargs -r -I{} sh -c 'cat /proc/{}/comm 2>/dev/null | grep -q "^node$" && echo {}' || true)

echo "──────────────────────────────────────────────────────────"

if (( found == 0 )); then
  echo "No running bConnectMock instances found."
else
  echo "${found} instance(s) running."
fi
