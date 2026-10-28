#!/bin/sh
# Stop only this optional trial; preserve encrypted wallets and all live services.
set -eu
test "$(id -u)" = 0
if test "$(systemctl show veil-zingolib-trial.service -p LoadState --value)" != not-found; then
  systemctl stop veil-zingolib-trial.service
fi
systemctl stop veil-lightwallet-trial.service
for unit in veil-zebra.service veil-zallet@receiver-v2.service veil-scanner.service; do
  systemctl is-active --quiet "$unit"
done
printf '%s\n' 'Trial stopped. Encrypted trial wallets retained. Node, receiver and scanner remain active.'
