# Oiva Personal Economic Trainer for S-mobiili

**Live Demo:** [https://rafinjahan.github.io/moneycoach-ai/](https://rafinjahan.github.io/moneycoach-ai/)

**Oiva** ("your money, made clear") is a calm, mobile-first AI financial coach built for the **Junction 2026 S-Pankki Personal Economic Trainer** challenge. It transforms raw S-Bank transaction histories into transparent weekly Safe-to-Spend guidance, interactive savings simulations, and grounded conversational coaching ready to embed inside S-mobiili.

---

## Alignment with S-Pankki's Challenge & Judging Criteria

Oiva is engineered directly around S-Pankki's five judging pillars (20% weight each):

### 1. Impact on Financial Literacy & Pedagogical Three-Basket Model (20%)
- **Three-Basket Classification (`getBasket()` in `app.js`)**: Every outflow transaction is automatically sorted into three intuitive financial literacy baskets—separately from **Savings & Investments** (`investment_deposit`, `salary_sweep`) and **Inflows** (`salary`, `other_income`, `investment_withdrawal`):
  1. **Mandatory & Regular** (`Housing`, `Utilities`): Fixed monthly bills and essentials.
  2. **Mandatory & Irregular** (`Health`, `Home & Tech`): Unpredictable necessities buffered smoothly into weekly planning.
  3. **Everyday Spending** (`Groceries`, `Restaurants`, `Transportation`, `Entertainment`, `Lifestyle`, `Travel`): Flexible day-to-day choices where behavioral nudges have the biggest impact.
- **Plain-Language Safe-to-Spend Coaching**: Instead of overwhelming users with balance-sheet jargon, `calculateSafeToSpend()` divides monthly averages across `4.333` weeks/month (`weeklyIncome − weeklyBills − weeklySavings − weeklyIrregularBuffer`) to surface one clear weekly number alongside plain-language Safe-to-Save projections.

### 2. Originality of AI Integration (20%)
- **Zero-Hallucination Hybrid Architecture**: LLMs are never asked to add up raw ledger rows. Instead, `gatherCustomerFinancialContext()` executes verified deterministic math across the active customer's transactions first, then passes the audited figures inside `buildOivaSystemInstruction()` to **Gemini 3.8 Flash** (`gemini-3.8-flash`).
- **BYOK Gemini API + Automatic Deterministic Fallback**: Users can optionally paste their own Gemini API key via the header key modal (stored locally in `localStorage` under `oiva_gemini_key`). When no key is configured—or if an API call fails—`ask()` seamlessly routes to Oiva's built-in deterministic coaching engine (`answerFor()`), returning instant, auditable breakdowns offline.

### 3. Clarity of Mobile UX & S-mobiili Integration Potential (20%)
- **WebView-Ready Vanilla Stack**: Built strictly with dependency-free HTML, CSS, and JavaScript (`index.html`, `styles.css`, `app.js`) inside a `480px` mobile-first shell—zero frameworks, zero bundler overhead, and instant drop-in compatibility for an **S-mobiili** native WebView.
- **S-Bank Visual Identity & Mobile Ergonomics**: Styled in S-Pankki's signature forest green (`#2d7d4e` / `#1d5e3a`) and warm paper cream (`#f5f7f2`) palette. Includes fixed top navigation and bottom tab bar, `16px` input/select font rules to prevent iOS Safari auto-zoom, and automatic bottom-nav hiding (`keyboard-open`) while typing.

### 4. MyData Philosophy & Open Data Benchmarks (20%)
- **User-Controlled Exploration**: Rather than locking customers into static pie charts, Oiva treats financial data as an interactive MyData workspace—users can filter the **Activity** ledger by basket, tap any spending basket or individual transaction to ask Oiva about it, or inspect recurring deductions directly.
- **Statistics Finland (*Tilastokeskus*) Open Data Benchmarks (Live PxWeb API)**: On startup, `fetchLiveTilastokeskusBenchmarks()` queries Statistics Finland's live CORS-enabled **StatFin PxWeb API** (`pxdata.stat.fi`) in JSON-stat2 format for Household Budget Survey (*Kulutustutkimus*) tables **`14q4`** (by reference person's age: `17–24` through `85+`) and **`14q8`** (by major region: `SSS` Finland avg `€1,000/mo`, `SA1` Helsinki-Uusimaa `€1,081/mo` / `1.081x`, `SA5` Åland `€1,178/mo` / `1.178x`) measured in EUR/month per consumption unit (`kulukk_kt_hk_2_1`) across everyday COICOP categories (`01`, `02`, `03`, `072–073`, `09`, `11`, `13`). Verified 2022 StatFin figures (`TILASTOKESKUS_AGE_BENCHMARKS_2022`, `TILASTOKESKUS_REGION_FACTORS_2022`) serve as an instant offline fallback, and both the Overview benchmark pill and `Ask Oiva` cite the live survey results.
- **Optional Mortgage Event Awareness**: `tryLoadMortgageCsv()` and `getCustomerMortgageSummary()` detect optional mortgage records (`loan_amount`, `property_type`, `lending_decision`) so `Ask Oiva` can answer home-loan questions while keeping mortgage obligations strictly separate from weekly everyday Safe-to-Spend math.

### 5. Feasibility & Privacy-First Data Architecture (20%)
- **Two-Tier Data Strategy**:
  1. **Instant Mobile Boot**: The repository bundles `tx_customers_junction.csv` (5,100 customer demographic profiles) and `tx_junction_transactions.csv` containing a complete **24-month transaction history** (`2024-10-01` to `2026-09-30`, 6,079 rows) for the first 10 synthetic customers (`CUST00001`–`CUST00010`) for sub-second loading on mobile devices.
  2. **100% Client-Side Full Dataset Processing**: `loadTransactionsCsv()` uses a `ReadableStream` chunk parser with string interning (`intern()`), and the Activity tab's **Load CSV** button (`parseManualCsv()`) processes local CSV uploads—including the full 346 MB Junction synthetic dataset—entirely inside the browser. No transaction records are ever uploaded to an external backend.

---

## Key Interactive Features Implemented

- **Weekly Safe-to-Spend Hero Card & Recurring Bills Detector (`detectRecurringBills()`)**: Calculates weekly safe spending room after fixed essentials, savings sweeps, and irregular buffers, paired with an expandable **"Upcoming recurring bills"** drawer listing housing, utilities, and repeating monthly merchant IDs with weekly deductions.
- **Interactive "What-If" Savings Simulator (`calculateDiscretionaryWhatIf()`)**: A real-time `0%–50%` slider (default `20%`) on discretionary everyday spending (dining, entertainment, and lifestyle) that dynamically updates the weekly Safe-to-Spend boost (`+€X.XX/wk`) plus 1-year and 3-year cumulative savings, with a one-tap button to ask Oiva how to achieve that cut.
- **S-Bonus & S-Group Ecosystem Insights (`calculateSBonus()`, `getSBonusTierRate()`)**: Estimates the customer's progressive S-Bonus tier (`1.0%`–`5.0%`) across monthly groceries and everyday purchases, and projects 1-year compounded value if auto-invested monthly into an S-Pankki fund (modeled at an estimated `7% p.a.` return).
- **Statistics Finland (Tilastokeskus) Peer Benchmark Pill (`renderTilastokeskusBenchmark()`)**: Displays whether the active profile's everyday monthly spend sits above or below Finnish peers of the same age group and postal region, and feeds the exact comparison into Oiva's chat context.
- **Conversational "Ask Oiva" Coach (`callGeminiCoach()`, `answerFor()`)**: Features quick-prompt chips, tap-to-ask cards and transactions, a header **Gemini API Key** modal (`#api-key-modal`) with an active green status dot indicator, and transparent HTML breakdown cards powered by either `gemini-3.8-flash` or local verified math.
- **Activity Explorer & Basket Filter (`renderActivityList()`)**: Displays monthly `IN / OUT / SAVED` totals, a dropdown filter across all three baskets plus `Savings` and `Inflows`, tappable transaction rows with category/MCC badges, and a local **Load CSV** uploader supporting transaction, customer, and mortgage CSV files.

---

## Quick Start & Testing Guide for Judges

### Option A: Test Live on Mobile or Desktop (Recommended)
1. Open **[https://rafinjahan.github.io/moneycoach-ai/](https://rafinjahan.github.io/moneycoach-ai/)** in any mobile or desktop browser.
2. **Switch Customer Profiles**: Use the top-right dropdown (`CUST00001 · Age 63` through `CUST00010`) to compare different ages, postal regions (`00–02` Uusimaa vs. rest of Finland), savings habits, and Safe-to-Spend profiles across 24 months of synthetic history.
3. **Explore "Ask Oiva" (With or Without an API Key)**:
   - **Zero-config mode**: Tap **Ask Oiva** or any insight pill/basket immediately—Oiva answers instantly using its built-in deterministic calculation engine.
   - **Live LLM mode (optional)**: Tap the **key icon** next to the avatar pill in the top header, paste a Gemini API key (saved locally to `localStorage['oiva_gemini_key']` with a green indicator dot), and ask custom follow-up questions powered by `gemini-3.8-flash`.
4. **Load the Full External Dataset (Optional)**: Open the **Activity** tab, tap **Load CSV**, and select the full multi-million-row Junction synthetic transaction CSV (`tx_junction_transactions.csv`) from disk to parse and switch across all customers locally in your browser.

### Option B: Run Locally
This project has zero build steps. Serve the repository folder with any static HTTP server (needed so `fetch()` can stream the bundled CSV files):

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) (or run `npm start` to serve on port `3000`).

---

## Project Structure

- [`index.html`](index.html) — Mobile-first 3-tab app shell (Overview, Ask Oiva, Activity) and Gemini API key modal.
- [`styles.css`](styles.css) — S-Pankki green/cream visual system, sticky header/footer layout, and iOS keyboard-safe styling.
- [`app.js`](app.js) — Three-basket classifier, Safe-to-Spend & recurring bill detector, What-If simulator, S-Bonus estimator, Tilastokeskus benchmarks, streaming CSV parser, Gemini 3.8 Flash client, and deterministic fallback engine.
- [`tx_customers_junction.csv`](tx_customers_junction.csv) — Demographic metadata (`customer_id`, `customer_postal_code`, `customer_age`) for 5,100 synthetic profiles.
- [`tx_junction_transactions.csv`](tx_junction_transactions.csv) — Bundled 24-month synthetic transaction history (`2024-10-01` to `2026-09-30`, 6,079 transactions) for `CUST00001`–`CUST00010`.

---

## Future Roadmap

- **PSD2 Open Banking Multi-Bank View**: Extend `tx_junction_transactions.csv` ingestion to normalized PSD2 Account Information Service (AIS) feeds so customers can combine S-Pankki accounts with external Finnish bank cards and loans inside one unified Safe-to-Spend calculation.
- **Direct S-Pankki Verkkopankki Export Support**: Add a lightweight column mapper in `parseManualCsv()` so real S-Pankki online-bank CSV exports (*tapahtumaluettelo*) map directly into Oiva's three baskets for immediate personal use.
