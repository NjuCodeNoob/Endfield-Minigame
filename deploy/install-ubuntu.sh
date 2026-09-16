#!/usr/bin/env bash
set -euo pipefail
cd /tmp/endfield-upload
curl -fsS --retry 2 https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt -o SHASUMS256.txt
archive=$(awk '$2 ~ /linux-x64.tar.xz$/ {print $2}' SHASUMS256.txt)
test -n "$archive"
curl -fsS --retry 2 "https://nodejs.org/dist/latest-v22.x/$archive" -o "$archive"
awk -v name="$archive" '$2 == name' SHASUMS256.txt | sha256sum -c -
sudo mkdir -p /opt/endfield-node /opt/endfield-race
sudo tar -xJf "$archive" --strip-components=1 -C /opt/endfield-node
id endfield-race >/dev/null 2>&1 || sudo useradd --system --home /var/lib/endfield-race --shell /usr/sbin/nologin endfield-race
sudo tar -xf app.tar -C /opt/endfield-race
sudo install -m 644 endfield-race.service /etc/systemd/system/endfield-race.service
sudo systemctl daemon-reload
sudo systemctl enable --now endfield-race
sudo systemctl restart endfield-race
for i in {1..15}; do if curl -fsS http://127.0.0.1:5173/api/health; then break; fi; sleep 1; done
sudo systemctl is-active endfield-race
/opt/endfield-node/bin/node --version
