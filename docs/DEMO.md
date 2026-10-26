# Current digital-goods demo

Use [the judge walkthrough and recording script](JUDGING.md) for the new candidate and its live-payment approval boundary. The walkthrough below is historical and does not demonstrate new protected delivery.

# Short hackathon demo script

For the complete separate-account auction and actual payment leg, use [LIVE_TESTNET.md](LIVE_TESTNET.md). It records pinned setup, upstream blockers, exact operator actions and a physical-device checklist. The payment leg remains pending; no transfer was made here.

1. Introduce the problem: an open auction reveals participants' bids; VEIL seals offers on the bidder's browser and proves the highest eligible offer against the recorded log.
2. Open **Try a sealed auction**. Submit an offer above the sample high bid, wait for the unlock signal, open as seller and show the actual download/proving/verification stages. Explain that the two sample bidders are locally simulated, while encryption and the proof are real.
3. Repeat with a tie: first acceptance wins. Show a real persisted auction in isolated seller and bidder browser contexts, then publish and independently verify its result.
4. Show the complete sealed log/export and explain its limitation: the host controls acceptance/order, and the proof covers the recorded log.
5. Show cancellation or an interrupted asset download. No successful result appears until every integrity check and proof verification passes.
6. Show the payment invoice, follow-up deadline and manual scanner import. State explicitly whether this run uses a live testnet receiving wallet; without one, payment is unverified. A payment QR is not a confirmation.
7. Close with the boundaries: seller sees losing bids after close and can refuse reveal; malformed accepted bids block tally; scanner attestation is trusted; there is no escrow, refund, delivery enforcement or security audit.

For a reproducible offline-timing demonstration, use the labelled quicknet-round-1000 setup in `LOCAL_TESTING.md`. It is different from live drand testing. Never describe viewport emulation as a physical-device test or fixture RPC responses as a live transfer.
