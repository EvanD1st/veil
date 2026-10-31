"""Synthetic health inputs; no wallet credentials or live payment data."""
import importlib.util
import pathlib
import unittest
import contextlib
import io
import json
from types import SimpleNamespace
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('veil_monitor', pathlib.Path(__file__).resolve().parents[1] / 'backend/scanner/testnet/monitor.py')
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)


class HealthSnapshotTest(unittest.TestCase):
    def test_sender_failure_is_visible_without_rpc_or_private_data(self):
        output = io.StringIO()
        def state(name):
            return {'state': 'failed' if name == 'veil-zallet@sender.service' else 'active',
                    'result': 'oom-kill' if name == 'veil-zallet@sender.service' else 'success',
                    'NRestarts': 1, 'MemoryCurrent': None}
        with patch.object(monitor.sys, 'argv', ['monitor.py']), \
             patch.object(monitor.pathlib.Path, 'is_file', return_value=False), \
             patch.object(monitor.shutil, 'disk_usage', return_value=SimpleNamespace(free=20*1024**3)), \
             patch.object(monitor, 'unit', side_effect=state) as units, \
             contextlib.redirect_stdout(output):
            monitor.main()
        result = json.loads(output.getvalue())
        self.assertEqual(result['services']['veil-zallet@sender.service']['result'], 'oom-kill')
        self.assertEqual({call.args[0] for call in units.call_args_list}, set(monitor.MONITORED_UNITS))
        self.assertEqual(set(result), {'observedAt', 'diskFreeBytes', 'health', 'services'})

    def test_does_not_reflect_private_fields_or_untrusted_labels(self):
        result = monitor.health_summary({'observedAt': 1_000_000, 'ready': True,
            'height': 123, 'reason': 'private credential text', 'seed': 'must not appear',
            'address': 'private metadata'}, 1_000_001)
        self.assertEqual(set(result), {'observedAt', 'ready', 'stale', 'height', 'reason'})
        self.assertEqual(result['reason'], 'invalid-health')
        self.assertFalse(result['ready'])
        self.assertNotIn('must not appear', str(result))

    def test_stale_or_future_observation_never_claims_current_readiness(self):
        for observed in [0, 1_200_001, '1000000', True, None]:
            result = monitor.health_summary({'observedAt': observed, 'ready': True,
                'height': False, 'reason': 'ready'}, 1_000_000)
            self.assertFalse(result['ready'])
            self.assertTrue(result['stale'])
            self.assertIsNone(result['height'])


if __name__ == '__main__':
    unittest.main()
