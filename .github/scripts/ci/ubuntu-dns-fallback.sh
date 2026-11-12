#!/usr/bin/env bash
# Add only missing Ubuntu mirror records, resolved over authenticated HTTPS.
set -euo pipefail
hosts_file="${ATUS_HOSTS_FILE:-/etc/hosts}"
for host in archive.ubuntu.com security.ubuntu.com; do
  if getent ahostsv4 "$host" >/dev/null; then continue; fi
  response="$(curl --fail --silent --show-error --max-time 15 --resolve cloudflare-dns.com:443:1.1.1.1 -H 'accept: application/dns-json' "https://cloudflare-dns.com/dns-query?name=$host&type=A")"
  address="$(printf '%s' "$response" | python3 -c 'import ipaddress,json,sys; d=json.load(sys.stdin); assert d.get("Status")==0; print(next(str(ipaddress.IPv4Address(a["data"])) for a in d.get("Answer",[]) if a.get("type")==1))')"
  printf '%s %s # atus-ci-dns\n' "$address" "$host" >> "$hosts_file"
done
