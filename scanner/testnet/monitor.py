"""Fixed read-only SSH health snapshot. No arguments, wallet RPC, keys or payment data."""
import json
import pathlib
import shutil
import subprocess
import sys
import time

MONITORED_UNITS = ('veil-zebra.service', 'veil-zallet@receiver-v2.service',
                   'veil-zallet@sender.service', 'veil-build.service', 'veil-scanner.service')


def integer(value):
    return value if type(value) is int and 0 <= value < 2**63 else None


def health_summary(data, now):
    if not isinstance(data, dict):
        data = {}
    observed = integer(data.get('observedAt'))
    fresh = observed is not None and now - 600_000 <= observed <= now + 120_000
    reason = data.get('reason')
    if reason not in ['ready', 'low-disk', 'services-unavailable']:
        reason = 'invalid-health'
    return {'observedAt': observed, 'ready': data.get('ready') is True and fresh and reason == 'ready',
            'stale': not fresh, 'height': integer(data.get('height')), 'reason': reason}


def unit(name):
    result = subprocess.run(['/usr/bin/systemctl', 'show', name,
                             '--property=ActiveState,Result,NRestarts,MemoryCurrent'],
                            capture_output=True, text=True, timeout=5, check=True)
    fields = dict(line.split('=', 1) for line in result.stdout.splitlines() if '=' in line)
    active = fields.get('ActiveState')
    if active not in ['active', 'inactive', 'activating', 'deactivating', 'failed']:
        active = 'unknown'
    outcome = fields.get('Result')
    if outcome not in ['success', 'exit-code', 'timeout', 'oom-kill', 'signal',
                       'start-limit-hit', 'resources', 'core-dump', 'watchdog', 'protocol']:
        outcome = 'unknown'
    return {'state': active, 'result': outcome,
            **{key: int(fields[key]) if fields.get(key, '').isdigit() else None
               for key in ['NRestarts', 'MemoryCurrent']}}


def main():
    if len(sys.argv) != 1:
        raise ValueError('No arguments supported')
    root = pathlib.Path('/var/lib/veil-testnet')
    now = int(time.time() * 1000)
    path = root / 'health.json'
    data = {}
    try:
        if not path.is_symlink() and path.is_file() and path.stat().st_size <= 4096:
            data = json.loads(path.read_text())
    except (OSError, ValueError):
        pass
    disk = shutil.disk_usage(root)
    services = {name: unit(name) for name in MONITORED_UNITS}
    print(json.dumps({'observedAt': now, 'diskFreeBytes': disk.free,
                      'health': health_summary(data, now), 'services': services}))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('{"error":"health-snapshot-unavailable"}')
        sys.exit(1)
