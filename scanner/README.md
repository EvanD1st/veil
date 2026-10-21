# VEIL testnet payment scanner

This bridge performs read-only RPC calls to a locally running Zallet receiving/viewing wallet and Zebra testnet node. It sends no transactions and does not upload wallet keys. Use a recent Zallet version that returns the documented sync and transaction fields. Import the receiving account's viewing capability using Zallet's own documented workflow; verify its sync and receiving address yourself.

1. Generate a scanner signing key on the scanner machine:

   ```sh
   node scanner/scan.mjs keygen /private/path/veil-scanner.pem
   ```

   The key file is created exclusively with mode 0600. Keep it secret. Configure the printed `VEIL_SCANNER_PUBLIC_KEY` value in the Site's environment. This is the only scanner setting required on the hosted app.

2. Configure these environment variables locally through your secret manager or shell session:

   | Variable | Purpose |
   | --- | --- |
   | `VEIL_SCANNER_KEY_FILE` | Path to the Ed25519 signing private key |
   | `ZALLET_RPC_URL` | Local loopback HTTP RPC endpoint |
   | `ZALLET_COOKIE_FILE` | Zallet cookie file, preferred authentication |
   | `ZALLET_RPC_AUTH` | Alternative local `username:password` |
   | `ZEBRA_RPC_URL` | Local loopback HTTP Zebra testnet RPC endpoint |
   | `ZEBRA_RPC_AUTH` | Optional local `username:password` |

   Never paste these credentials or the private/viewing key into VEIL. Remote RPC endpoints are intentionally rejected. RPC timeouts and errors do not create a confirmation.

3. Download the invoice from the auction result. Pay its exact testnet amount and memo to its address using a compatible wallet. This script never pays for you.
4. Obtain the transaction ID and Sapling output index from the wallet. After at least three confirmations:

   ```sh
   node scanner/scan.mjs scan invoice.json TRANSACTION_ID OUTPUT_INDEX report.json
   ```

5. Within five minutes, import `report.json` in the auction's payment section as seller or winner. The app verifies the configured signature and exact invoice. The report contains payment metadata; do not share it publicly.
6. Rescan and import a new report to refresh or revoke confirmation. A changed active block or insufficient confirmations yields `not-confirmed` if the exact wallet output remains observable. If the wallet cannot view the transaction, or is resyncing, scanning fails; the previous report expires rather than remaining current. There is no background poller.

Each invoice tracks one exact incoming output. Split payments, overpayments, alternate outputs, mainnet and Unified Addresses are not supported. This implementation was tested with RPC fixtures, not a connected live testnet wallet. Complete a real testnet transfer before claiming end-to-end settlement.
