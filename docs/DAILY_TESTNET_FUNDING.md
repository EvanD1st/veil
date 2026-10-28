# Daily testnet funding

Approved policy: 20,000,000 zatoshis (0.2 TAZ) per backed-up native account, requested manually at most once per rolling 86,400,000 milliseconds. Keep the existing ten-wallet capacity. The fee allowance remains 20,000 zatoshis (0.0002 TAZ). Count full fee allowances and every retained grant against both the rolling 201,000,000-zatoshi (2.01 TAZ) daily cap and the 201,000,000-zatoshi overall stop-and-review cap. Existing grants consume this budget too. Do not add treasury funds or automatically issue grants.

Private service policy fields:

```json
{"grant":"20000000","maxFee":"20000","daily":"201000000","total":"201000000","maxUsers":10,"grantIntervalMs":86400000}
```

Preserve the existing treasury account, signer hash, validation evidence, wallet roots and transfer records. Before enabling, stop the managed service gracefully, verify a consistent private-journal backup, stage the tested service source, then select the approved policy and restart. The website displays the policy and next request time; the backend is authoritative. No automatically manufactured live validation payment is needed or authorized.

The private journal adds a nullable requested_at field and replaces the once-only grant index with a per-account/day uniqueness guard. The transactionally checked rolling interval is stricter than that UTC-day guard. Existing transfers with no exact request timestamp conservatively wait from the end of their recorded UTC day; never backdate them or discard broadcast counts. Pending or uncertain grants block a new grant indefinitely until reconciled. Confirmed history is retained and a new grant obtains a new immutable intent only after cooldown and budget checks.

Before live preparation, refresh the treasury and require sufficient synchronized confirmed funds for the amount plus fee allowance. Insufficient funds leave the same request queued and never sign/broadcast. The daily allowance is a cap, not a claim that the treasury has that balance.

Rollback: pause funding with the managed kill switch, preserving Pay/reconciliation as appropriate to the existing service controls, or select the same compatible service code with a closed budget. Keep all accepted grants, signed bytes, broadcast counts, wallet state and payment records. Do not restore an old private journal or start an older once-only-index binary after multiple grants exist for an account. Restore UI/source separately only if the retained journal remains compatible. Purchases still need explicit Pay approval; scanner output verification alone grants downloads.

Keep the wallet API on loopback port 19070 and the separate reverse website tunnel on 19071. The selector callback is fixed to http://127.0.0.1:19071/api/judging/managed/selector; the same path on 19070 reaches the wallet service itself and returns 404. Test the actual tunnel with an invalid empty selector (400, without submitting any valid payment selector), and retain durable outbox retries.

Funding responses explicitly distinguish a newly created queued intent (`created: true`, HTTP 202) from a retained request (`created: false`, HTTP 200). A prior confirmed transaction is not evidence of a new grant. The UI displays a blocked reason and next eligibility, and stale enabled buttons still receive a no-new-funds response. Neither cooldown nor funding amount is changed by this feedback fix.
