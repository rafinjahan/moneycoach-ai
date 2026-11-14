// Oiva AI Financial Coach — S-Pankki Junction Implementation
// Powered by real customer & transaction dataset

const views = ["home", "chat", "activity"];

// State
let customerProfiles = new Map();
let allCustomersMap = new Map();
let currentCustomerId = "CUST00001";
let transactionData = []; // Active customer's transactions
let activeFilter = "all";
let isDataLoaded = false;

// Format currency
function formatEur(val, includeSign = false) {
  const num = Number(val) || 0;
  const abs = Math.abs(num);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  if (includeSign) {
    if (num > 0) return `+ €${formatted}`;
    if (num < 0) return `− €${formatted}`;
  }
  return `€${formatted}`;
}

// Map transaction to spending basket
// 1: Mandatory and regular (Housing, Utilities)
// 2: Mandatory and irregular (Health, Home & Tech)
// 3: Everyday spending (Groceries, Restaurants, Transportation, Entertainment, Lifestyle, Travel)
function getBasket(tx) {
  const cat = (tx.category || "").trim().toLowerCase();
  const type = (tx.transaction_type || "").trim().toLowerCase();

  // Mandatory & Regular (Regular essentials)
  if (cat === "housing" || type === "housing_payment" || cat === "utilities" || type === "utilities_payment") {
    return "mandatory_regular";
  }

  // Mandatory & Irregular (Unexpected necessities)
  if (cat === "health" || cat === "home & tech" || cat.includes("health") || cat.includes("tech")) {
    return "mandatory_irregular";
  }

  // Savings / Investments
  if (type === "investment_deposit" || type === "salary_sweep" || cat.includes("invest deposit") || cat.includes("salary sweep")) {
    return "savings";
  }

  // Inflows / Income
  if (type === "salary" || type === "other_income" || type === "investment_withdrawal" || cat === "salary" || cat === "other income" || cat.includes("invest withdraw") || tx.tx_amount_eur > 0) {
    return "income";
  }

  // Everyday spending
  return "everyday";
}

function getBasketMeta(basketKey) {
  switch (basketKey) {
    case "mandatory_regular":
      return {
        name: "Mandatory and regular",
        badge: "Regular essentials",
        icon: "⌂",
        color: "rose",
        desc: "Housing & utilities"
      };
    case "mandatory_irregular":
      return {
        name: "Mandatory and irregular",
        badge: "Unexpected necessities",
        icon: "🔧",
        color: "yellow",
        desc: "Health, repairs & home maintenance"
      };
    case "savings":
      return {
        name: "Savings & Investments",
        badge: "Savings",
        icon: "◌",
        color: "purple",
        desc: "Investment deposits & sweep"
      };
    case "income":
      return {
        name: "Inflows",
        badge: "Income",
        icon: "↗",
        color: "green",
        desc: "Salary & other income"
      };
    case "everyday":
    default:
      return {
        name: "Everyday spending",
        badge: "Everyday spending",
        icon: "☕",
        color: "blue",
        desc: "Groceries, dining, transit & lifestyle"
      };
  }
}

// Navigation
function showView(view) {
  views.forEach((name) => {
    const el = document.getElementById(`${name}-view`);
    if (el) el.classList.toggle("active-view", name === view);
  });
  document.querySelectorAll("[data-view]").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === view);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Chat UI
function addMessage(content, type) {
  const container = document.getElementById("chat-messages");
  const message = document.createElement("div");
  message.className = `message ${type}`;
  message.innerHTML = content;
  container.appendChild(message);
  message.scrollIntoView({ behavior: "smooth", block: "nearest" });
  return message;
}

async function ask(question) {
  const trimmed = question.trim();
  if (!trimmed) return;
  addMessage(trimmed, "user");

  let apiKey = "";
  try {
    apiKey = (localStorage.getItem("oiva_gemini_key") || "").trim();
  } catch (err) {
    apiKey = "";
  }

  // 4. Automatic fallback to local calculation cards when no key is saved
  if (!apiKey) {
    window.setTimeout(() => {
      addMessage(answerFor(trimmed), "ai");
    }, 250);
    return;
  }

  // Gemini API key found in localStorage under 'oiva_gemini_key'
  const loadingEl = addMessage('<span class="status-dot"></span> <em>Oiva is thinking...</em>', "ai");

  try {
    const aiResponse = await callGeminiCoach(trimmed, apiKey);
    loadingEl.innerHTML = aiResponse;
    loadingEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (err) {
    console.warn("Gemini API request failed, falling back to local calculation:", err);
    loadingEl.innerHTML = answerFor(trimmed);
    loadingEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

// --------------------------------------------------------------------------
// Real Financial Math & Analysis Functions
// --------------------------------------------------------------------------

function getCustomerMonths(txs) {
  const months = new Set();
  txs.forEach((t) => {
    if (t.tx_date && t.tx_date.length >= 7) {
      months.add(t.tx_date.substring(0, 7));
    }
  });
  return Array.from(months).sort();
}

// Safe to spend calculation
function calculateSafeToSpend(txs) {
  if (!txs || !txs.length) {
    return {
      weeklySafe: 0,
      weeklyIncome: 0,
      weeklyBills: 0,
      weeklySavings: 0,
      weeklyIrregularBuffer: 0,
      monthlyIncome: 0,
      monthlyBills: 0,
      monthlySavings: 0,
      monthlyIrregularBuffer: 0,
      latestBalance: 0,
      numMonths: 1
    };
  }

  const months = getCustomerMonths(txs);
  const numMonths = Math.max(1, months.length);

  let totalInflows = 0;
  let totalRegularBills = 0;
  let totalIrregularNecessities = 0;
  let totalSavings = 0;

  txs.forEach((t) => {
    const amt = t.tx_amount_eur;
    const basket = getBasket(t);
    if (amt > 0) {
      totalInflows += amt;
    } else if (amt < 0) {
      const outflow = Math.abs(amt);
      if (basket === "mandatory_regular") {
        totalRegularBills += outflow;
      } else if (basket === "mandatory_irregular") {
        totalIrregularNecessities += outflow;
      } else if (basket === "savings") {
        totalSavings += outflow;
      }
    }
  });

  const monthlyIncome = totalInflows / numMonths;
  const monthlyBills = totalRegularBills / numMonths;
  const monthlyIrregularBuffer = totalIrregularNecessities / numMonths;
  const monthlySavings = totalSavings / numMonths;

  // 52 weeks / 12 months = 4.333 weeks per month
  const weeksPerMonth = 4.333;
  const weeklyIncome = monthlyIncome / weeksPerMonth;
  const weeklyBills = monthlyBills / weeksPerMonth;
  const weeklySavings = monthlySavings / weeksPerMonth;
  const weeklyIrregularBuffer = monthlyIrregularBuffer / weeksPerMonth;

  let weeklySafe = weeklyIncome - weeklyBills - weeklySavings - weeklyIrregularBuffer;
  if (weeklySafe < 0) weeklySafe = 0;

  // Latest balance from last chronological transaction
  const sorted = [...txs].sort((a, b) => (a.tx_date + a.tx_timestamp).localeCompare(b.tx_date + b.tx_timestamp));
  const latestBalance = sorted[sorted.length - 1].balance_after_eur || 0;

  return {
    weeklySafe,
    weeklyIncome,
    weeklyBills,
    weeklySavings,
    weeklyIrregularBuffer,
    monthlyIncome,
    monthlyBills,
    monthlySavings,
    monthlyIrregularBuffer,
    latestBalance,
    numMonths
  };
}

// Spender Style analysis
function calculateSpenderStyle(txs, profile) {
  if (!txs || !txs.length) {
    return {
      archetype: "New Customer",
      title: "Analyzing your transactions",
      description: "Load or record transactions to uncover your spending pattern.",
      savingsRate: 0,
      breakdown: []
    };
  }

  const months = getCustomerMonths(txs);
  const numMonths = Math.max(1, months.length);

  let totalInflows = 0;
  let totalOutflows = 0;
  let regularSum = 0;
  let irregularSum = 0;
  let everydaySum = 0;
  let savingsSum = 0;
  const categoryTotals = {};

  txs.forEach((t) => {
    const amt = t.tx_amount_eur;
    const basket = getBasket(t);
    if (amt > 0) {
      totalInflows += amt;
    } else if (amt < 0) {
      const outflow = Math.abs(amt);
      totalOutflows += outflow;
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + outflow;

      if (basket === "mandatory_regular") regularSum += outflow;
      else if (basket === "mandatory_irregular") irregularSum += outflow;
      else if (basket === "savings") savingsSum += outflow;
      else everydaySum += outflow;
    }
  });

  const savingsRate = totalInflows > 0 ? (savingsSum / totalInflows) * 100 : 0;
  const regularRate = totalOutflows > 0 ? (regularSum / totalOutflows) * 100 : 0;
  const everydayRate = totalOutflows > 0 ? (everydaySum / totalOutflows) * 100 : 0;

  let archetype = "Balanced Realist";
  let title = "You’re a balanced realist.";
  let description = "You maintain steady essentials, cover your bills on time, and keep room for everyday living without overextending.";

  if (savingsRate >= 12) {
    archetype = "Steady Builder";
    title = "You’re a steady builder.";
    description = "Your essentials are predictable, and you systematically set aside money for savings before discretionary spending.";
  } else if (everydayRate > 55 || regularRate > 60) {
    archetype = "Everyday Balancer";
    title = "You’re an everyday balancer.";
    description = "A significant portion of your income flows into day-to-day lifestyle and essentials. Keeping small treats mindful gives you the best room to grow.";
  }

  // Find top everyday spending categories
  const everydayCats = Object.entries(categoryTotals)
    .filter(([cat]) => !["Housing", "Utilities", "Invest Deposit", "Salary Sweep"].includes(cat))
    .sort((a, b) => b[1] - a[1]);

  const topEveryday = everydayCats[0] ? { name: everydayCats[0][0], monthly: everydayCats[0][1] / numMonths } : null;

  return {
    archetype,
    title,
    description,
    savingsRate,
    regularSum: regularSum / numMonths,
    irregularSum: irregularSum / numMonths,
    everydaySum: everydaySum / numMonths,
    savingsSum: savingsSum / numMonths,
    topEveryday,
    profile
  };
}

// Spending totals & category queries
function calculateSpendingTotals(txs, categoryQuery = "") {
  if (!txs || !txs.length) return null;

  const months = getCustomerMonths(txs);
  const numMonths = Math.max(1, months.length);
  const latestMonth = months[months.length - 1];

  let filtered = txs.filter((t) => t.tx_amount_eur < 0);
  let label = "all spending";

  if (categoryQuery) {
    const q = categoryQuery.toLowerCase();
    if (q.includes("tax") || q.includes("cab")) {
      filtered = filtered.filter((t) => t.mcc_code === "4121" || `${t.category} ${t.merchant_id}`.toLowerCase().includes("tax"));
      label = "taxis";
    } else if (q.includes("grocer") || q.includes("market") || q.includes("supermarket")) {
      filtered = filtered.filter((t) => t.category.toLowerCase().includes("grocer"));
      label = "groceries";
    } else if (q.includes("rest") || q.includes("dining") || q.includes("eat") || q.includes("food") || q.includes("wolt")) {
      filtered = filtered.filter((t) => t.category.toLowerCase().includes("rest"));
      label = "restaurants & dining";
    } else if (q.includes("trans")) {
      filtered = filtered.filter((t) => t.category.toLowerCase().includes("trans"));
      label = "transportation";
    } else if (q.includes("entertain")) {
      filtered = filtered.filter((t) => t.category.toLowerCase().includes("entertain"));
      label = "entertainment";
    } else if (q.includes("health")) {
      filtered = filtered.filter((t) => t.category.toLowerCase().includes("health"));
      label = "health & pharmacy";
    } else if (q.includes("hous") || q.includes("rent")) {
      filtered = filtered.filter((t) => t.category.toLowerCase().includes("hous"));
      label = "housing & rent";
    } else if (q.includes("util") || q.includes("bill") || q.includes("power") || q.includes("electric")) {
      filtered = filtered.filter((t) => t.category.toLowerCase().includes("util"));
      label = "utilities";
    } else if (q.includes("travel")) {
      filtered = filtered.filter((t) => t.category.toLowerCase().includes("travel"));
      label = "travel";
    } else if (q.includes("life") || q.includes("shop")) {
      filtered = filtered.filter((t) => t.category.toLowerCase().includes("life"));
      label = "lifestyle & shopping";
    }
  }

  const totalSpent = filtered.reduce((sum, t) => sum + Math.abs(t.tx_amount_eur), 0);
  const count = filtered.length;
  const avgTx = count > 0 ? totalSpent / count : 0;
  const monthlyAvg = totalSpent / numMonths;

  // Latest month total
  const latestMonthTxs = filtered.filter((t) => t.tx_date.startsWith(latestMonth));
  const latestMonthTotal = latestMonthTxs.reduce((sum, t) => sum + Math.abs(t.tx_amount_eur), 0);

  // Highest transaction
  let maxTx = null;
  filtered.forEach((t) => {
    const val = Math.abs(t.tx_amount_eur);
    if (!maxTx || val > Math.abs(maxTx.tx_amount_eur)) {
      maxTx = t;
    }
  });

  return {
    label,
    totalSpent,
    count,
    avgTx,
    monthlyAvg,
    latestMonth,
    latestMonthTotal,
    maxTx,
    numMonths
  };
}

// What-if savings scenario calculation
function calculateWhatIfSavings(txs, query) {
  const months = getCustomerMonths(txs);
  const numMonths = Math.max(1, months.length);

  // Extract reduction percentage (default 20%)
  const percentMatch = query.match(/(\d+)%/);
  const percent = percentMatch ? parseInt(percentMatch[1], 10) : 20;

  // Target category
  const q = query.toLowerCase();
  let targetCat = "Restaurants";
  let label = "dining out";

  if (q.includes("grocer")) {
    targetCat = "Groceries";
    label = "groceries";
  } else if (q.includes("entertain")) {
    targetCat = "Entertainment";
    label = "entertainment";
  } else if (q.includes("taxi")) {
    targetCat = "Taxi";
    label = "taxis";
  } else if (q.includes("trans")) {
    targetCat = "Transportation";
    label = "transportation";
  } else if (q.includes("travel")) {
    targetCat = "Travel";
    label = "travel";
  }

  let matchingTxs = [];
  if (targetCat === "Taxi") {
    matchingTxs = txs.filter((t) => t.tx_amount_eur < 0 && (t.mcc_code === "4121" || `${t.category} ${t.merchant_id}`.toLowerCase().includes("tax")));
  } else {
    matchingTxs = txs.filter((t) => t.tx_amount_eur < 0 && t.category.toLowerCase().includes(targetCat.toLowerCase()));
  }

  const totalSpent = matchingTxs.reduce((sum, t) => sum + Math.abs(t.tx_amount_eur), 0);
  const monthlySpend = totalSpent / numMonths;
  const monthlySavings = monthlySpend * (percent / 100);
  const annualSavings = monthlySavings * 12;
  const threeYearSavings = annualSavings * 3;

  return {
    label,
    percent,
    monthlySpend,
    monthlySavings,
    annualSavings,
    threeYearSavings,
    txCount: matchingTxs.length
  };
}

// --------------------------------------------------------------------------
// Conversational Coach: Dynamic Response Generator
// --------------------------------------------------------------------------

function answerFor(question) {
  const lower = question.toLowerCase();
  const txs = transactionData;
  const profile = customerProfiles.get(currentCustomerId) || {
    customer_id: currentCustomerId,
    customer_postal_code: "00990",
    customer_age: 63
  };

  if (!txs || !txs.length) {
    return "<strong>No transaction data loaded yet.</strong> Please ensure the dataset is loaded or use the Load CSV button to explore your finances.";
  }

  // 1. Safe to Spend inquiry
  if (lower.includes("safe") || lower.includes("spend") && (lower.includes("week") || lower.includes("how did you get") || lower.includes("why is my"))) {
    const s = calculateSafeToSpend(txs);
    return `<strong>${formatEur(s.weeklySafe)} is safe for you to spend this week.</strong>
<div class='answer-breakdown'>
  <div><span>Weekly baseline income</span><b>${formatEur(s.weeklyIncome)}</b></div>
  <div><span>Upcoming mandatory bills</span><b>− ${formatEur(s.weeklyBills)}</b></div>
  <div><span>Weekly savings target</span><b>− ${formatEur(s.weeklySavings)}</b></div>
  <div><span>Buffer for unexpected necessities</span><b>− ${formatEur(s.weeklyIrregularBuffer)}</b></div>
  <div><span>Safe to spend per week</span><b>${formatEur(s.weeklySafe)}</b></div>
  <div><span>Current account balance</span><b>${formatEur(s.latestBalance)}</b></div>
</div>
<div class='answer-note'>Calculated across ${s.numMonths} months of real data. Leaving a buffer prevents unexpected costs from turning into stress.</div>`;
  }

  // 2. Spender Style inquiry
  if (lower.includes("spender") || lower.includes("kind") || lower.includes("style") || lower.includes("pattern") || lower.includes("habit") || lower.includes("who am i")) {
    const style = calculateSpenderStyle(txs, profile);
    const topNote = style.topEveryday
      ? `Your largest everyday spending area is <strong>${style.topEveryday.name}</strong>, averaging ${formatEur(style.topEveryday.monthly)} per month.`
      : "";
    return `<strong>${style.title}</strong> ${style.description} ${topNote}
<div class='answer-breakdown'>
  <div><span>Mandatory & Regular (bills)</span><b>${formatEur(style.regularSum)} / mo</b></div>
  <div><span>Mandatory & Irregular (health, repairs)</span><b>${formatEur(style.irregularSum)} / mo</b></div>
  <div><span>Everyday Spending</span><b>${formatEur(style.everydaySum)} / mo</b></div>
  <div><span>Savings & Investments</span><b>${formatEur(style.savingsSum)} / mo</b></div>
  <div><span>Active Savings Rate</span><b>${style.savingsRate.toFixed(1)}%</b></div>
</div>
<div class='answer-note'>Profile ${profile.customer_id} · Age ${profile.customer_age} · Postal ${profile.customer_postal_code}. No label is a verdict, just a clear baseline to build confidence.</div>`;
  }

  // 3. What-if savings scenarios
  if (lower.includes("save") && (lower.includes("reduc") || lower.includes("cut") || lower.includes("trim") || lower.includes("if i") || lower.includes("could i") || lower.includes("%"))) {
    const whatIf = calculateWhatIfSavings(txs, lower);
    return `<strong>Reducing ${whatIf.label} by ${whatIf.percent}% saves you ${formatEur(whatIf.monthlySavings)} per month.</strong>
<div class='answer-breakdown'>
  <div><span>Typical ${whatIf.label} spend</span><b>${formatEur(whatIf.monthlySpend)} / mo</b></div>
  <div><span>${whatIf.percent}% monthly reduction</span><b>${formatEur(whatIf.monthlySavings)} / mo</b></div>
  <div><span>Savings over 1 year</span><b>${formatEur(whatIf.annualSavings)} / yr</b></div>
  <div><span>Savings over 3 years</span><b>${formatEur(whatIf.threeYearSavings)}</b></div>
</div>
<div class='answer-note'>Based on ${whatIf.txCount} transactions in your dataset. Redirecting this into savings builds a resilient cushion without touching essential needs.</div>`;
  }

  // 4. Where did my money go / general spending breakdown
  if (lower.includes("where") || lower.includes("breakdown") || lower.includes("basket") || (lower.includes("money") && lower.includes("go"))) {
    const months = getCustomerMonths(txs);
    const numMonths = Math.max(1, months.length);
    let reg = 0, irreg = 0, every = 0, sav = 0;
    txs.forEach((t) => {
      const amt = t.tx_amount_eur;
      if (amt < 0) {
        const out = Math.abs(amt);
        const b = getBasket(t);
        if (b === "mandatory_regular") reg += out;
        else if (b === "mandatory_irregular") irreg += out;
        else if (b === "savings") sav += out;
        else every += out;
      }
    });
    const totalOut = reg + irreg + every + sav;
    return `<strong>Here is where your money goes across the 3 spending baskets:</strong>
<div class='answer-breakdown'>
  <div><span>🏠 Regular essentials (Housing & Utilities)</span><b>${formatEur(reg / numMonths)} / mo (${((reg / totalOut) * 100).toFixed(0)}%)</b></div>
  <div><span>🔧 Unexpected necessities (Health, repairs)</span><b>${formatEur(irreg / numMonths)} / mo (${((irreg / totalOut) * 100).toFixed(0)}%)</b></div>
  <div><span>☕ Everyday spending (Discretionary & living)</span><b>${formatEur(every / numMonths)} / mo (${((every / totalOut) * 100).toFixed(0)}%)</b></div>
  <div><span>◌ Savings & Investments</span><b>${formatEur(sav / numMonths)} / mo (${((sav / totalOut) * 100).toFixed(0)}%)</b></div>
</div>
<div class='answer-note'>Monthly average over ${numMonths} months. Tap any basket in Overview to drill down into individual categories.</div>`;
  }

  // 5. Taxi spending query
  if (lower.includes("tax") || lower.includes("cab") || lower.includes("uber")) {
    const t = calculateSpendingTotals(txs, "taxi");
    if (!t || t.count === 0) {
      return `<strong>You have no taxi transactions in your loaded records.</strong><div class='answer-note'>Searched for MCC 4121 and taxi merchants.</div>`;
    }
    const maxTrip = t.maxTx ? `${formatEur(Math.abs(t.maxTx.tx_amount_eur))} on ${t.maxTx.tx_date}` : "N/A";
    return `<strong>Your loaded data shows ${formatEur(t.totalSpent)} across ${t.count} taxi trips.</strong>
<div class='answer-breakdown'>
  <div><span>Total taxi spend</span><b>${formatEur(t.totalSpent)}</b></div>
  <div><span>Total taxi rides</span><b>${t.count} trips</b></div>
  <div><span>Average ride cost</span><b>${formatEur(t.avgTx)}</b></div>
  <div><span>Monthly average</span><b>${formatEur(t.monthlyAvg)} / mo</b></div>
  <div><span>Largest taxi ride</span><b>${maxTrip}</b></div>
</div>
<div class='answer-note'>Calculated from MCC 4121 and merchant IDs in your S-Pankki transaction records.</div>`;
  }

  // 6. Specific categories (Groceries, Restaurants, Health, Housing, Utilities, Transportation, Travel, Entertainment)
  const catKeywords = ["grocer", "restaur", "dining", "food", "transport", "entertain", "health", "hous", "rent", "utilit", "travel", "lifestyl", "shop"];
  const matched = catKeywords.find((k) => lower.includes(k));
  if (matched) {
    const c = calculateSpendingTotals(txs, matched);
    if (c && c.count > 0) {
      return `<strong>You spent ${formatEur(c.totalSpent)} on ${c.label} (${c.count} transactions).</strong>
<div class='answer-breakdown'>
  <div><span>Monthly average</span><b>${formatEur(c.monthlyAvg)} / mo</b></div>
  <div><span>Average transaction</span><b>${formatEur(c.avgTx)}</b></div>
  <div><span>Latest month (${c.latestMonth})</span><b>${formatEur(c.latestMonthTotal)}</b></div>
  <div><span>Highest single expense</span><b>${formatEur(Math.abs(c.maxTx.tx_amount_eur))} (${c.maxTx.tx_date})</b></div>
</div>
<div class='answer-note'>Real calculations from your connected transaction dataset.</div>`;
    }
  }

  // 7. Single transaction inquiry (from Activity tap)
  if (lower.includes("tell me about this transaction") || lower.includes("tell me about my")) {
    return `<strong>Let’s break down that spending:</strong>
<p style="margin:6px 0 0;">This transaction is categorized under your 3 core baskets to ensure your safe-to-spend limit stays balanced. Try asking “How much did I spend on ${lower.replace(/tell me about (my|this transaction:?)/i, '').trim() || 'this'}?” for a full auditable summary.</p>`;
  }

  // Default fallback
  return `<strong>Here’s what I can calculate from your real data:</strong>
<div class='answer-breakdown'>
  <div><span>Safe to spend</span><b>“What can I safely spend this week?”</b></div>
  <div><span>Spender style</span><b>“What kind of spender am I?”</b></div>
  <div><span>What-if savings</span><b>“How much could I save if I reduced dining out by 20%?”</b></div>
  <div><span>Category drilldown</span><b>“How much did I spend on taxis / groceries / health?”</b></div>
  <div><span>Cash flow breakdown</span><b>“Where did my money go?”</b></div>
</div>
<div class='answer-note'>All answers are computed live using your transaction data.</div>`;
}

// --------------------------------------------------------------------------
// Gemini REST API Integration & Context Gathering
// --------------------------------------------------------------------------

// 1. Gather verified financial metrics using existing local calculation functions
function gatherCustomerFinancialContext(question = "") {
  const txs = transactionData || [];
  const profile = customerProfiles.get(currentCustomerId) || {
    customer_id: currentCustomerId,
    customer_postal_code: "00990",
    customer_age: 63
  };

  // Run existing local calculation functions for active customer
  const safeData = calculateSafeToSpend(txs);
  const spenderStyle = calculateSpenderStyle(txs, profile);
  const months = getCustomerMonths(txs);
  const numMonths = Math.max(1, months.length);

  // Top spending categories aggregation
  const categoryTotals = {};
  txs.forEach((t) => {
    if (t.tx_amount_eur < 0) {
      const cat = t.category || "Uncategorized";
      categoryTotals[cat] = (categoryTotals[cat] || 0) + Math.abs(t.tx_amount_eur);
    }
  });

  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, total]) => ({
      category,
      monthlyAvg: total / numMonths,
      totalSpent: total
    }));

  // Contextual drilldowns if question touches categories or savings
  const lowerQ = (question || "").toLowerCase();
  const catKeywords = ["grocer", "restaur", "dining", "food", "transport", "entertain", "health", "hous", "rent", "utilit", "travel", "lifestyl", "shop", "tax", "cab", "uber"];
  const hasCatQuery = catKeywords.some((k) => lowerQ.includes(k));
  const categoryTotalsQuery = hasCatQuery ? calculateSpendingTotals(txs, question) : null;

  const hasWhatIfQuery = lowerQ.includes("save") || lowerQ.includes("reduc") || lowerQ.includes("cut") || lowerQ.includes("%");
  const whatIfSavings = hasWhatIfQuery ? calculateWhatIfSavings(txs, question) : null;

  return {
    customer: profile,
    safeData,
    spenderStyle,
    topCategories,
    numMonths,
    txCount: txs.length,
    categoryTotalsQuery,
    whatIfSavings
  };
}

// 3. Build Oiva coaching system instruction with verified numbers and calm S-Pankki coaching tone
function buildOivaSystemInstruction(ctx) {
  const topCategoriesList = ctx.topCategories
    .map((c) => `- ${c.category}: €${c.monthlyAvg.toFixed(2)}/mo (total: €${c.totalSpent.toFixed(2)})`)
    .join("\n");

  let specificDetails = "";
  if (ctx.categoryTotalsQuery && ctx.categoryTotalsQuery.count > 0) {
    specificDetails += `\n- Specific Query Category Analysis (${ctx.categoryTotalsQuery.label}):
  * Total spent: €${ctx.categoryTotalsQuery.totalSpent.toFixed(2)} across ${ctx.categoryTotalsQuery.count} transactions
  * Monthly average: €${ctx.categoryTotalsQuery.monthlyAvg.toFixed(2)}/mo
  * Average transaction: €${ctx.categoryTotalsQuery.avgTx.toFixed(2)}
  * Latest month total: €${ctx.categoryTotalsQuery.latestMonthTotal.toFixed(2)}`;
  }

  if (ctx.whatIfSavings && ctx.whatIfSavings.txCount > 0) {
    specificDetails += `\n- What-If Reduction Scenario (${ctx.whatIfSavings.label} by ${ctx.whatIfSavings.percent}%):
  * Current monthly spend: €${ctx.whatIfSavings.monthlySpend.toFixed(2)}/mo
  * Monthly savings: €${ctx.whatIfSavings.monthlySavings.toFixed(2)}/mo
  * 1-Year savings: €${ctx.whatIfSavings.annualSavings.toFixed(2)}
  * 3-Year savings: €${ctx.whatIfSavings.threeYearSavings.toFixed(2)}`;
  }

  return `You are Oiva, the financial coach from S-Pankki ("your money, made clear").
Tone & Persona:
- Calm, direct, supportive, and practical.
- Speak in clear, warm Finnish-banking coaching style: reassuring, transparent, and grounded in real customer data.
- Never judge, scold, or over-promise; help the customer feel confident and in control.
- CRITICAL GUARDRAIL: DO NOT make up or hallucinate numbers. All amounts, percentages, and timeframes MUST be strictly derived from the verified customer metrics below. If the customer asks for figures outside this dataset, calmly explain what is recorded.

VERIFIED CUSTOMER FINANCIAL METRICS (Active Profile: ${ctx.customer.customer_id}):
- Demographics: Age ${ctx.customer.customer_age || "—"}, Postal code ${ctx.customer.customer_postal_code || "00990"}
- Verified Weekly Safe-to-Spend: €${ctx.safeData.weeklySafe.toFixed(2)}
- Weekly Baseline Breakdown:
  * Weekly baseline income: €${ctx.safeData.weeklyIncome.toFixed(2)}
  * Mandatory regular bills: − €${ctx.safeData.weeklyBills.toFixed(2)}
  * Weekly savings target: − €${ctx.safeData.weeklySavings.toFixed(2)}
  * Unexpected necessity buffer: − €${ctx.safeData.weeklyIrregularBuffer.toFixed(2)}
  * Latest account balance: €${ctx.safeData.latestBalance.toFixed(2)}
  * Calculated across ${ctx.numMonths} months of transactions
- The 3 Spending Baskets (Monthly Averages):
  1. Mandatory and regular (Housing, Utilities): €${ctx.spenderStyle.regularSum.toFixed(2)}/mo
  2. Mandatory and irregular (Health, repairs, home & tech): €${ctx.spenderStyle.irregularSum.toFixed(2)}/mo
  3. Everyday spending (Groceries, dining, transit & lifestyle): €${ctx.spenderStyle.everydaySum.toFixed(2)}/mo
  * Savings & Investments: €${ctx.spenderStyle.savingsSum.toFixed(2)}/mo
- Active Savings Rate: ${ctx.spenderStyle.savingsRate.toFixed(1)}% of total inflows
- Spender Style Archetype: "${ctx.spenderStyle.archetype}"
  * Title: ${ctx.spenderStyle.title}
  * Summary: ${ctx.spenderStyle.description}
  * Top everyday spending area: ${ctx.spenderStyle.topEveryday ? `${ctx.spenderStyle.topEveryday.name} (€${ctx.spenderStyle.topEveryday.monthly.toFixed(2)}/mo)` : "None"}
- Top Spending Categories:
${topCategoriesList || "- None recorded"}${specificDetails}

COACHING RESPONSE FORMAT:
- Begin directly with the answer to the customer's question in bold (e.g. "<strong>...</strong>").
- Explain the logic clearly and calmly using the verified numbers above.
- You may use concise bullet points or HTML breakdown elements (<div class='answer-breakdown'><div><span>Label</span><b>€Value</b></div>...</div>) and coach notes (<div class='answer-note'>...</div>) where helpful.
- Keep the response concise, uncluttered, and friendly.`;
}

// Convert markdown/text returned by Gemini into cleanly styled HTML
function formatAiResponse(text) {
  if (!text) return "";
  let formatted = text.trim();

  // Convert markdown bold **text** to <strong>text</strong>
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Convert markdown italic *text* or _text_
  formatted = formatted.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");

  // Process blocks
  const rawBlocks = formatted.split(/\n\n+/);
  const renderedBlocks = [];

  rawBlocks.forEach((block) => {
    const trimmedBlock = block.trim();
    if (!trimmedBlock) return;

    // Preserve existing HTML blocks directly
    if (/^<(div|p|ul|ol|table|blockquote)/i.test(trimmedBlock)) {
      renderedBlocks.push(trimmedBlock);
      return;
    }

    const lines = trimmedBlock.split("\n");
    let listItems = [];
    let textLines = [];

    const flushList = () => {
      if (listItems.length) {
        renderedBlocks.push(`<ul style="margin: 6px 0 8px 18px; padding-left: 0;">${listItems.map((li) => `<li>${li}</li>`).join("")}</ul>`);
        listItems = [];
      }
    };

    const flushText = () => {
      if (textLines.length) {
        renderedBlocks.push(`<p style="margin: 0 0 8px 0;">${textLines.join("<br>")}</p>`);
        textLines = [];
      }
    };

    lines.forEach((line) => {
      const isListItem = /^\s*[-*•]\s+/.test(line);
      if (isListItem) {
        flushText();
        listItems.push(line.replace(/^\s*[-*•]\s+/, "").trim());
      } else {
        flushList();
        textLines.push(line);
      }
    });

    flushList();
    flushText();
  });

  return renderedBlocks.join("");
}

// 2. Send POST request to Gemini REST API with active customer context
async function callGeminiCoach(question, apiKey) {
  const txs = transactionData || [];
  if (!txs.length) {
    return answerFor(question);
  }

  // 1. Run local calculation functions to gather verified numbers
  const context = gatherCustomerFinancialContext(question);

  // 3. Pass verified numbers in systemInstruction
  const systemInstructionText = buildOivaSystemInstruction(context);

  // 2. Send POST request to https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=YOUR_KEY
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemInstructionText }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: question }]
        }
      ]
    })
  });

  if (!response.ok) {
    const errorDetails = await response.text().catch(() => "");
    throw new Error(`Gemini API HTTP ${response.status}: ${errorDetails}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("No text candidate returned by Gemini API");
  }

  return formatAiResponse(text);
}

// --------------------------------------------------------------------------
// UI Rendering Functions
// --------------------------------------------------------------------------

function renderApp() {
  const txs = transactionData;
  const profile = customerProfiles.get(currentCustomerId) || {
    customer_id: currentCustomerId,
    customer_postal_code: "00990",
    customer_age: 63
  };

  updateTopbar(profile);
  updateOverview(txs, profile);
  updateActivity(txs, profile);
}

function updateTopbar(profile) {
  const avatar = document.getElementById("user-avatar");
  if (avatar) {
    const cid = profile.customer_id || currentCustomerId;
    avatar.textContent = cid.replace("CUST", "C") || "C1";
  }

  const select = document.getElementById("customer-select");
  if (select && select.value !== currentCustomerId) {
    select.value = currentCustomerId;
  }
}

function updateOverview(txs, profile) {
  if (!txs || !txs.length) return;

  const months = getCustomerMonths(txs);
  const latestMonth = months[months.length - 1] || "2026-09";
  const sorted = [...txs].sort((a, b) => (a.tx_date + a.tx_timestamp).localeCompare(b.tx_date + b.tx_timestamp));
  const latestTx = sorted[sorted.length - 1];

  // Welcome Date & Name
  const welcomeDate = document.getElementById("welcome-date");
  if (welcomeDate && latestTx && latestTx.tx_date) {
    const d = new Date(latestTx.tx_date);
    if (!isNaN(d)) {
      welcomeDate.textContent = d.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    }
  }

  const welcomeName = document.getElementById("welcome-name");
  if (welcomeName) {
    welcomeName.textContent = profile.customer_id;
  }

  const customerDemo = document.getElementById("customer-demographics");
  if (customerDemo) {
    customerDemo.textContent = `Age ${profile.customer_age || "—"} · ${profile.customer_postal_code || "00990"}`;
  }

  // Safe to spend card
  const safeData = calculateSafeToSpend(txs);
  const safeAmountEl = document.getElementById("hero-safe-amount");
  if (safeAmountEl) {
    const [whole, dec] = safeData.weeklySafe.toFixed(2).split(".");
    safeAmountEl.innerHTML = `€${Number(whole).toLocaleString()}<span>.${dec}</span>`;
  }

  const explainBtn = document.getElementById("hero-explain-btn");
  if (explainBtn) {
    explainBtn.dataset.prompt = `Why is my safe-to-spend €${safeData.weeklySafe.toFixed(2)}?`;
  }

  const ringPercentEl = document.getElementById("hero-ring-percent");
  const progressRing = document.getElementById("hero-progress-ring");
  if (ringPercentEl && progressRing) {
    // Ring shows safe-to-spend ratio against weekly baseline
    const ratio = safeData.weeklyIncome > 0 ? Math.min(100, Math.round((safeData.weeklySafe / safeData.weeklyIncome) * 100)) : 68;
    ringPercentEl.textContent = `${ratio}%`;
    progressRing.style.background = `conic-gradient(#f5cf68 0 ${ratio}%, rgba(255,255,255,0.18) ${ratio}%)`;
  }

  // Monthly Overview & 3 Baskets (Latest month)
  const latestTxs = txs.filter((t) => t.tx_date.startsWith(latestMonth));
  let latestInflow = 0;
  let latestOutflow = 0;
  let regSum = 0;
  let irregSum = 0;
  let everydaySum = 0;

  latestTxs.forEach((t) => {
    const amt = t.tx_amount_eur;
    if (amt > 0) {
      latestInflow += amt;
    } else if (amt < 0) {
      const outflow = Math.abs(amt);
      latestOutflow += outflow;
      const b = getBasket(t);
      if (b === "mandatory_regular") regSum += outflow;
      else if (b === "mandatory_irregular") irregSum += outflow;
      else if (b === "everyday") everydaySum += outflow;
    }
  });

  const monthLabel = document.getElementById("spending-month-eyebrow");
  if (monthLabel) {
    const [y, m] = latestMonth.split("-");
    const monthName = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1).toLocaleString("en-US", { month: "long" }).toUpperCase();
    monthLabel.textContent = `${monthName} ${y} · LATEST MONTH`;
  }

  const totalSpentEl = document.getElementById("spending-total-amount");
  if (totalSpentEl) totalSpentEl.textContent = formatEur(latestOutflow);

  const planEl = document.getElementById("spending-plan-amount");
  if (planEl) {
    planEl.textContent = latestInflow > 0 ? `of ${formatEur(latestInflow)} monthly income` : `across ${latestTxs.length} transactions`;
  }

  const progressBar = document.getElementById("spending-progress-bar");
  if (progressBar) {
    const pct = latestInflow > 0 ? Math.min(100, Math.round((latestOutflow / latestInflow) * 100)) : 75;
    progressBar.style.width = `${pct}%`;
  }

  // The 3 spending baskets amounts
  const regAmountEl = document.getElementById("basket-regular-amount");
  if (regAmountEl) regAmountEl.textContent = formatEur(regSum);

  const irregAmountEl = document.getElementById("basket-irregular-amount");
  if (irregAmountEl) irregAmountEl.textContent = formatEur(irregSum);

  const everydayAmountEl = document.getElementById("basket-everyday-amount");
  if (everydayAmountEl) everydayAmountEl.textContent = formatEur(everydaySum);

  // Insight Card: Real 5-month everyday spending mini-bars
  renderInsightBars(txs, months);
}

function renderInsightBars(txs, months) {
  const barsContainer = document.getElementById("insight-bars");
  const insightText = document.getElementById("insight-text");
  if (!barsContainer) return;

  const recentMonths = months.slice(-5);
  if (recentMonths.length < 2) return;

  const monthlyEveryday = recentMonths.map((m) => {
    const mTxs = txs.filter((t) => t.tx_date.startsWith(m) && t.tx_amount_eur < 0 && getBasket(t) === "everyday");
    const total = mTxs.reduce((sum, t) => sum + Math.abs(t.tx_amount_eur), 0);
    return { month: m, total };
  });

  const maxVal = Math.max(...monthlyEveryday.map((m) => m.total), 1);
  const latest = monthlyEveryday[monthlyEveryday.length - 1];
  const prevMonths = monthlyEveryday.slice(0, -1);
  const avgPrev = prevMonths.reduce((sum, m) => sum + m.total, 0) / prevMonths.length;

  if (insightText) {
    const diff = latest.total - avgPrev;
    if (diff < -15) {
      insightText.innerHTML = `You spent <strong>${formatEur(Math.abs(diff))} less</strong> on everyday spending this month than your usual. That’s a quiet win worth noticing.`;
    } else if (diff > 15) {
      insightText.innerHTML = `Your everyday spending is <strong>${formatEur(diff)} higher</strong> this month than your usual. Check recent groceries or dining out to stay on track.`;
    } else {
      insightText.innerHTML = `Your everyday spending is <strong>on track</strong> with your typical monthly average. Essentials and discretionary costs are in balance.`;
    }
  }

  barsContainer.innerHTML = "";
  monthlyEveryday.forEach((item, index) => {
    const heightPct = Math.max(15, Math.round((item.total / maxVal) * 100));
    const isLatest = index === monthlyEveryday.length - 1;
    const [y, m] = item.month.split("-");
    const shortMonth = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1).toLocaleString("en-US", { month: "short" });

    const barItem = document.createElement("div");
    barItem.className = "bar-item";
    barItem.innerHTML = `
      <div class="bar ${isLatest ? 'bar-accent' : 'bar-muted'}" style="height: ${heightPct}%" title="${item.month}: ${formatEur(item.total)}"></div>
      <span>${isLatest ? 'this mo' : shortMonth}</span>
    `;
    barsContainer.appendChild(barItem);
  });
}

function updateActivity(txs, profile) {
  if (!txs || !txs.length) return;

  const months = getCustomerMonths(txs);
  const latestMonth = months[months.length - 1] || "2026-09";
  const [y, m] = latestMonth.split("-");
  const shortMonth = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1).toLocaleString("en-US", { month: "short" });

  const titleEl = document.getElementById("activity-title");
  if (titleEl) {
    titleEl.innerHTML = `Activity <span>· ${shortMonth} ${y}</span>`;
  }

  // Summary for latest month
  const latestTxs = txs.filter((t) => t.tx_date.startsWith(latestMonth));
  let inTotal = 0;
  let outTotal = 0;
  let savedTotal = 0;

  latestTxs.forEach((t) => {
    const amt = t.tx_amount_eur;
    if (amt > 0) {
      inTotal += amt;
    } else if (amt < 0) {
      const outflow = Math.abs(amt);
      outTotal += outflow;
      if (getBasket(t) === "savings") savedTotal += outflow;
    }
  });

  const inEl = document.getElementById("activity-in");
  if (inEl) inEl.textContent = formatEur(inTotal);

  const outEl = document.getElementById("activity-out");
  if (outEl) outEl.textContent = formatEur(outTotal);

  const savedEl = document.getElementById("activity-saved");
  if (savedEl) savedEl.textContent = formatEur(savedTotal);

  // Render transactions list
  renderActivityList(txs);
}

function renderActivityList(txs) {
  const container = document.getElementById("activity-list-container");
  if (!container) return;
  container.innerHTML = "";

  // Sort descending by date & timestamp
  const sorted = [...txs].sort((a, b) => (b.tx_date + b.tx_timestamp).localeCompare(a.tx_date + a.tx_timestamp));

  // Filter if selected
  let filtered = sorted;
  if (activeFilter !== "all") {
    filtered = sorted.filter((t) => getBasket(t) === activeFilter);
  }

  // Limit rendering to latest 100 for fast DOM performance
  const displayList = filtered.slice(0, 100);

  let lastDate = "";
  displayList.forEach((t) => {
    if (t.tx_date !== lastDate) {
      lastDate = t.tx_date;
      const label = document.createElement("p");
      label.className = "date-label";
      const d = new Date(t.tx_date);
      const dateStr = !isNaN(d) ? d.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" }).toUpperCase() : t.tx_date;
      label.textContent = dateStr;
      container.appendChild(label);
    }

    const basket = getBasket(t);
    const meta = getBasketMeta(basket);
    const amt = t.tx_amount_eur;
    const isIncome = amt > 0;
    const merchantOrCat = t.merchant_id || t.category;
    const mccDesc = t.mcc_code ? ` · MCC ${t.mcc_code}` : "";

    const txItem = document.createElement("div");
    txItem.className = "transaction";
    txItem.innerHTML = `
      <span class="transaction-icon ${meta.color}">${meta.icon}</span>
      <div>
        <strong>${merchantOrCat}</strong>
        <small>${t.category} · ${meta.badge}${mccDesc}</small>
      </div>
      <b class="${isIncome ? 'income' : ''}">${formatEur(amt, true)}</b>
    `;

    txItem.addEventListener("click", () => {
      showView("chat");
      ask(`Tell me about this transaction: ${merchantOrCat} on ${t.tx_date} for ${formatEur(amt, true)}`);
    });

    container.appendChild(txItem);
  });
}

// --------------------------------------------------------------------------
// Dataset Loaders (tx_junction_transactions.csv & tx_customers_junction.csv)
// --------------------------------------------------------------------------

// String interning cache to reduce RAM usage for 3.6M transactions
const stringCache = {};
function intern(s) {
  if (!s) return "";
  if (!stringCache[s]) stringCache[s] = s;
  return stringCache[s];
}

// Customer Profile CSV Loader
async function loadCustomerCsv() {
  try {
    const res = await fetch("tx_customers_junction.csv");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    parseCustomerText(text);
  } catch (err) {
    console.warn("Could not auto-fetch tx_customers_junction.csv:", err);
  }
}

function parseCustomerText(text) {
  // Strip UTF-8 BOM
  const clean = text.replace(/^\uFEFF/, "").trim();
  const lines = clean.split(/\r?\n/);
  if (!lines.length) return;

  const headerLine = lines.shift();
  const headers = headerLine.split(",").map((h) => h.trim());
  const idIdx = headers.indexOf("customer_id");
  const postIdx = headers.indexOf("customer_postal_code");
  const ageIdx = headers.indexOf("customer_age");

  lines.forEach((line) => {
    if (!line.trim()) return;
    const parts = line.split(",").map((p) => p.trim());
    const customer_id = parts[idIdx >= 0 ? idIdx : 0];
    // Keep postal code as text to preserve leading zeros (e.g., '00990')
    const customer_postal_code = String(parts[postIdx >= 0 ? postIdx : 1] || "");
    const customer_age = parseInt(parts[ageIdx >= 0 ? ageIdx : 2], 10) || 0;

    if (customer_id) {
      customerProfiles.set(customer_id, {
        customer_id,
        customer_postal_code,
        customer_age
      });
    }
  });

  populateCustomerDropdown();
}

function populateCustomerDropdown() {
  const select = document.getElementById("customer-select");
  if (!select) return;

  const existingVal = select.value || currentCustomerId;
  const fragment = document.createDocumentFragment();

  // Sort customer IDs
  const cids = Array.from(customerProfiles.keys()).sort();
  // If no customer profiles loaded yet, use customers found in transactions
  const finalCids = cids.length ? cids : Array.from(allCustomersMap.keys()).sort();

  finalCids.forEach((cid) => {
    const p = customerProfiles.get(cid);
    const opt = document.createElement("option");
    opt.value = cid;
    opt.textContent = p ? `${cid} (Age ${p.customer_age}, ${p.customer_postal_code})` : cid;
    fragment.appendChild(opt);
  });

  select.innerHTML = "";
  select.appendChild(fragment);

  if (finalCids.includes(existingVal)) {
    select.value = existingVal;
    currentCustomerId = existingVal;
  } else if (finalCids.length) {
    select.value = finalCids[0];
    currentCustomerId = finalCids[0];
  }
}

// Transaction CSV Loader (Streaming)
async function loadTransactionsCsv() {
  const statusEl = document.getElementById("data-status");
  try {
    const res = await fetch("tx_junction_transactions.csv");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    if (statusEl) {
      statusEl.innerHTML = `<span class="status-dot"></span> Streaming transaction dataset (tx_junction_transactions.csv)...`;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let remainder = "";
    let lineCount = 0;
    let initialRenderDone = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = remainder + decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");
      remainder = lines.pop();

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (lineCount === 0 && line.includes("customer_id")) {
          lineCount++;
          continue;
        }
        lineCount++;

        const parts = line.split(",");
        const cid = parts[0];
        if (!cid) continue;

        const tx = {
          customer_id: cid,
          bank_account_id: parts[1],
          tx_date: parts[2],
          tx_timestamp: parts[3],
          category: intern(parts[4]),
          tx_amount_eur: parseFloat(parts[5]) || 0,
          balance_after_eur: parseFloat(parts[6]) || 0,
          transaction_type: intern(parts[7]),
          merchant_id: parts[8] || "",
          mcc_code: parts[9] || ""
        };

        let list = allCustomersMap.get(cid);
        if (!list) {
          list = [];
          allCustomersMap.set(cid, list);
        }
        list.push(tx);
      }

      // Initial fast render as soon as CUST00001 has records
      if (!initialRenderDone && allCustomersMap.has(currentCustomerId) && (allCustomersMap.get(currentCustomerId) || []).length > 20) {
        transactionData = allCustomersMap.get(currentCustomerId);
        renderApp();
        initialRenderDone = true;
      }

      if (lineCount % 500000 === 0 && statusEl) {
        statusEl.innerHTML = `<span class="status-dot"></span> Loading real dataset... ${lineCount.toLocaleString()} transactions parsed`;
      }
    }

    // Finished
    isDataLoaded = true;
    transactionData = allCustomersMap.get(currentCustomerId) || [];
    populateCustomerDropdown();
    renderApp();

    if (statusEl) {
      statusEl.innerHTML = `<span class="status-dot"></span> Connected · ${lineCount.toLocaleString()} transactions loaded across ${allCustomersMap.size.toLocaleString()} customers · mortgage data excluded`;
    }
  } catch (err) {
    console.warn("Could not auto-fetch tx_junction_transactions.csv:", err);
    if (statusEl) {
      statusEl.innerHTML = `<span class="status-dot"></span> Ready · Open via local server (<code>python3 -m http.server 8000</code>) or click <strong>Load CSV</strong> to upload.`;
    }
  }
}

// Manual CSV Parser for user uploads
function parseManualCsv(text) {
  const clean = text.replace(/^\uFEFF/, "").trim();
  const lines = clean.split(/\r?\n/);
  if (!lines.length) return;

  const headerLine = lines.shift();
  const headers = headerLine.split(",").map((h) => h.trim());

  // Check if it's customer CSV
  if (headers.includes("customer_postal_code")) {
    parseCustomerText(text);
    const statusEl = document.getElementById("data-status");
    if (statusEl) {
      statusEl.innerHTML = `<span class="status-dot"></span> Connected · ${customerProfiles.size} customer profiles loaded`;
    }
    renderApp();
    return;
  }

  // Parse transaction CSV
  allCustomersMap.clear();
  let count = 0;

  lines.forEach((line) => {
    if (!line.trim()) return;
    const parts = line.split(",").map((p) => p.trim());
    const cid = parts[0];
    if (!cid || cid === "customer_id") return;

    count++;
    const tx = {
      customer_id: cid,
      bank_account_id: parts[1],
      tx_date: parts[2],
      tx_timestamp: parts[3],
      category: intern(parts[4]),
      tx_amount_eur: parseFloat(parts[5]) || 0,
      balance_after_eur: parseFloat(parts[6]) || 0,
      transaction_type: intern(parts[7]),
      merchant_id: parts[8] || "",
      mcc_code: parts[9] || ""
    };

    let list = allCustomersMap.get(cid);
    if (!list) {
      list = [];
      allCustomersMap.set(cid, list);
    }
    list.push(tx);
  });

  if (allCustomersMap.size > 0) {
    if (!allCustomersMap.has(currentCustomerId)) {
      currentCustomerId = Array.from(allCustomersMap.keys())[0];
    }
    transactionData = allCustomersMap.get(currentCustomerId) || [];
    populateCustomerDropdown();
    renderApp();

    const statusEl = document.getElementById("data-status");
    if (statusEl) {
      statusEl.innerHTML = `<span class="status-dot"></span> Connected · ${count.toLocaleString()} transactions loaded manually · mortgage data excluded`;
    }
  }
}

// Switch Active Customer
function switchCustomer(cid) {
  if (!cid) return;
  currentCustomerId = cid;
  transactionData = allCustomersMap.get(cid) || [];
  renderApp();

  const statusEl = document.getElementById("data-status");
  if (statusEl) {
    const prof = customerProfiles.get(cid);
    const demo = prof ? ` (Age ${prof.customer_age}, Postal ${prof.customer_postal_code})` : "";
    statusEl.innerHTML = `<span class="status-dot"></span> Connected · Profile <strong>${cid}</strong> active${demo} · ${transactionData.length} transactions`;
  }
}

// --------------------------------------------------------------------------
// Event Listeners & Initialization
// --------------------------------------------------------------------------

// Tab navigation
document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

// View target with optional prompt
document.querySelectorAll("[data-view-target]").forEach((button) => {
  button.addEventListener("click", () => {
    showView(button.dataset.viewTarget);
    if (button.dataset.prompt) ask(button.dataset.prompt);
  });
});

// Prompt buttons (suggestion chips)
document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => ask(button.dataset.prompt));
});

// Category basket rows tap -> Ask Oiva
document.querySelectorAll(".category-row").forEach((button) => {
  button.addEventListener("click", () => {
    const basket = button.dataset.basket;
    const meta = getBasketMeta(basket);
    showView("chat");
    ask(`Tell me about my ${meta.name} spending`);
  });
});

// Chat submit
document.getElementById("chat-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.getElementById("chat-input");
  ask(input.value);
  input.value = "";
});

// Customer Switcher change
const customerSelect = document.getElementById("customer-select");
if (customerSelect) {
  customerSelect.addEventListener("change", (e) => {
    switchCustomer(e.target.value);
  });
}

// Activity Filter change
const activityFilter = document.getElementById("activity-filter");
if (activityFilter) {
  activityFilter.addEventListener("change", (e) => {
    activeFilter = e.target.value;
    renderActivityList(transactionData);
  });
}

// Manual CSV upload
const loadBtn = document.getElementById("load-data-button");
const fileInput = document.getElementById("csv-input");

if (loadBtn && fileInput) {
  loadBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      parseManualCsv(String(reader.result));
    };
    reader.readAsText(file, "utf-8");
  });
}

// Initial boot
async function init() {
  showView("home");
  await loadCustomerCsv();
  await loadTransactionsCsv();
}

init();
