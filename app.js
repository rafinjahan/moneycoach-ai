const views = ["home", "chat", "activity"];
let transactionData = [];
const responseMap = [
  { matches: ["taxi", "taxis", "cab"], html: "<strong>You spent €46.80 on taxis last month.</strong><div class='answer-breakdown'><div><span>5 trips</span><b>€46.80</b></div><div><span>Average trip</span><b>€9.36</b></div></div><div class='answer-note'>That’s 18% less than February. Your biggest trip was €14.20 on 22 February.</div>" },
  { matches: ["safe", "spend", "week"], html: "<strong>€184.20 is safe for you to spend this week.</strong><div class='answer-breakdown'><div><span>Money available</span><b>€420.00</b></div><div><span>Upcoming bills</span><b>− €95.80</b></div><div><span>Weekly savings goal</span><b>− €140.00</b></div><div><span>Safe to spend</span><b>€184.20</b></div></div><div class='answer-note'>I leave a small buffer so surprises don’t become stress.</div>" },
  { matches: ["spender", "spending", "kind"], html: "<strong>You’re a steady builder.</strong> Your essentials are predictable, and you regularly move money to savings before spending. The one place that slips through is <strong>small everyday treats</strong> — coffee and quick food make up 11% of your outgoings.<div class='answer-note'>No label is a verdict. It’s just a useful pattern to work with.</div>" },
  { matches: ["dining", "restaurant", "20%", "save"], html: "<strong>Reducing dining out by 20% could save you €38.40 per month.</strong><div class='answer-breakdown'><div><span>Typical dining out</span><b>€192.00 / mo</b></div><div><span>20% reduction</span><b>€38.40 / mo</b></div><div><span>Over a year</span><b>€460.80</b></div></div><div class='answer-note'>That’s enough for a weekend train trip or 5 months of your streaming subscriptions.</div>" }
];
function showView(view) { views.forEach((name) => document.getElementById(`${name}-view`).classList.toggle("active-view", name === view)); document.querySelectorAll("[data-view]").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view)); window.scrollTo({ top: 0, behavior: "smooth" }); }
function answerFor(question) {
  const lower = question.toLowerCase();
  if (transactionData.length && lower.includes("tax")) {
    const taxis = transactionData.filter((row) => `${row.category} ${row.merchant_id} ${row.mcc_code}`.toLowerCase().includes("tax"));
    const total = taxis.reduce((sum, row) => sum + Math.abs(Number(row.tx_amount_eur) || 0), 0);
    return `<strong>Your loaded data shows €${total.toFixed(2)} in taxi spending.</strong><div class='answer-breakdown'><div><span>Matching transactions</span><b>${taxis.length}</b></div><div><span>Source</span><b>your CSV</b></div></div><div class='answer-note'>Calculated from category, merchant and MCC fields in the uploaded transaction file.</div>`;
  }
  return responseMap.find((response) => response.matches.some((word) => lower.includes(word)))?.html || "<strong>Here’s what I can help with:</strong> spending patterns, safe-to-spend, savings scenarios, or a specific transaction. Try asking “What did I spend on taxis last month?”";
}
function addMessage(content, type) { const message = document.createElement("div"); message.className = `message ${type}`; message.innerHTML = content; document.getElementById("chat-messages").appendChild(message); message.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
function ask(question) { const trimmed = question.trim(); if (!trimmed) return; addMessage(trimmed, "user"); window.setTimeout(() => addMessage(answerFor(trimmed), "ai"), 300); }
document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
document.querySelectorAll("[data-view-target]").forEach((button) => button.addEventListener("click", () => { showView(button.dataset.viewTarget); if (button.dataset.prompt) ask(button.dataset.prompt); }));
document.querySelectorAll("[data-prompt]").forEach((button) => button.addEventListener("click", () => ask(button.dataset.prompt)));
document.querySelectorAll(".category-row").forEach((button) => button.addEventListener("click", () => { showView("chat"); ask(`Tell me about my ${button.dataset.category} spending`); }));
document.getElementById("chat-form").addEventListener("submit", (event) => { event.preventDefault(); const input = document.getElementById("chat-input"); ask(input.value); input.value = ""; });
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i], next = text[i + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && next === "\n") i += 1; row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const headers = rows.shift().map((header) => header.replace(/^\uFEFF/, "").trim());
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}
document.getElementById("load-data-button").addEventListener("click", () => document.getElementById("csv-input").click());
document.getElementById("csv-input").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const rows = parseCsv(String(reader.result));
    transactionData = rows.filter((row) => row.customer_id && row.tx_amount_eur);
    document.getElementById("data-status").innerHTML = `<span class="status-dot"></span> Connected · ${transactionData.length.toLocaleString()} transactions loaded · mortgage data excluded`;
  };
  reader.readAsText(file, "utf-8");
});
showView("home");
