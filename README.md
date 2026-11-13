# moneycoach-ai

**Oiva** is a mobile-first AI financial coach concept for the S-Bank Junction hackathon challenge. It turns a synthetic personal banking profile into a calm, conversational experience for understanding spending, building confidence, and making better everyday decisions.

## What is included

- **Safe to spend**: a transparent weekly number with the bills, savings goal, and buffer behind it.
- **Conversational coach**: try natural-language questions about taxis, spender patterns, or dining-out savings.
- **Three spending baskets**: home and bills, everyday spending, and fun and extras.
- **MyData-style exploration**: tap any category or transaction to ask Oiva about it.
- **Mobile-first UI**: responsive layout designed to embed cleanly in a banking app.
- **Junction data ready**: the Activity view accepts `tx_junction_transactions.csv`, strips the UTF-8 BOM, and uses the transaction schema for live taxi queries.

## Run locally

This is a dependency-free static prototype. Open `index.html` directly, or serve the folder with any static server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Product direction

The current responses are deterministic demo data so the prototype works without API keys. The next integration step is to replace `responseMap` in `app.js` with a backend tool-calling layer that queries the supplied transaction dataset, calculates answers from source transactions, and returns both the answer and an auditable breakdown.

The mortgage files from the challenge repository are intentionally out of scope for this version. The app only works with the customer and transaction files, and does not expose mortgage recommendations.
