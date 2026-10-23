"""Synthetic health inputs; no wallet credentials or live payment data."""
import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location('veil_monitor', pathlib.Path(__file__).resolve().parents[1] / 'scanner/testnet/monitor.py')
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)


class HealthSnapshotTest(unittest.TestCase):
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
