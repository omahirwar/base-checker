const state = {
  activity: null,
  address: "",
};

const elements = {
  form: document.querySelector("#wallet-form"),
  address: document.querySelector("#wallet-address"),
  button: document.querySelector("#check-button"),
  fdv: document.querySelector("#fdv"),
  supply: document.querySelector("#supply"),
  pool: document.querySelector("#pool"),
  recipients: document.querySelector("#recipients"),
  statusCard: document.querySelector("#status-card"),
  statusText: document.querySelector("#status-text"),
  tier: document.querySelector("#tier-badge"),
  tokens: document.querySelector("#token-output"),
  usd: document.querySelector("#usd-output"),
  price: document.querySelector("#price-output"),
  average: document.querySelector("#average-output"),
  score: document.querySelector("#score-output"),
  multiplier: document.querySelector("#multiplier-output"),
  txCount: document.querySelector("#tx-count"),
  activeDays: document.querySelector("#active-days"),
  contractsCount: document.querySelector("#contracts-count"),
  balance: document.querySelector("#balance"),
  links: document.querySelector("#outbound-links"),
  results: document.querySelector(".results"),
};

const formatNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const formatToken = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const formatUsdt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCompactUsd(value) {
  if (value >= 1_000_000_000) return `$${value / 1_000_000_000}B`;
  return `$${formatUsdt.format(value)}`;
}

function setStatus(message, variant = "") {
  elements.statusText.textContent = message;
  elements.statusCard.className = `status-card ${variant}`.trim();
  replayClass(elements.statusCard, "message-update");
}

function replayClass(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function settings() {
  return {
    fdv: Number(elements.fdv.value),
    supply: Number(elements.supply.value),
    pool: Number(elements.pool.value),
    recipients: Number(elements.recipients.value),
  };
}

function getTier(score) {
  if (score === 0) return { label: "No sampled activity", className: "neutral" };
  if (score < 28) return { label: "Starter", className: "starter" };
  if (score < 58) return { label: "Explorer", className: "active" };
  if (score < 82) return { label: "Active", className: "active" };
  return { label: "Power user", className: "power" };
}

function scoreActivity(activity) {
  const txPoints = Math.min(40, Math.round(Math.log10(activity.transactionCount + 1) * 16));
  const dayPoints = Math.min(25, activity.activeDays * 5);
  const contractPoints = Math.min(20, activity.uniqueContracts * 3);
  const balancePoints = activity.balanceEth > 0 ? 5 : 0;
  const bridgePoints = activity.bridgeSignals > 0 ? 10 : 0;
  return Math.min(100, txPoints + dayPoints + contractPoints + balancePoints + bridgePoints);
}

function modelWeight(activity, score) {
  if (!activity || score === 0) return 0;
  const signalDetail =
    ((activity.transactionCount % 97) + activity.activeDays * 11 + activity.uniqueContracts * 7 + activity.bridgeSignals * 13) %
    71;
  return Math.min(1.18, 0.18 + score * 0.009 + signalDetail / 1000);
}

function renderEstimate() {
  const model = settings();
  const tokenPrice = model.fdv / model.supply;
  const averageTokens = (model.supply * model.pool) / model.recipients;
  const score = state.activity ? scoreActivity(state.activity) : null;
  const tier = getTier(score ?? 0);
  const weight = state.activity ? modelWeight(state.activity, score) : null;
  const comparableL2Ceiling = 10250;
  const allocation = weight === null ? null : Math.round(Math.min(averageTokens * weight, comparableL2Ceiling));
  const usdtValue = allocation === null ? null : allocation * tokenPrice;

  elements.price.textContent = `${formatUsdt.format(tokenPrice)} USDT`;
  elements.average.textContent = `${formatToken.format(averageTokens)} BASE`;
  elements.score.textContent = score === null ? "--" : `${score}/100`;
  elements.multiplier.textContent = weight === null ? "--" : `${weight.toFixed(3)}x`;
  elements.tier.textContent = state.activity ? tier.label : "Waiting";
  elements.tier.className = `tier ${state.activity ? tier.className : "neutral"}`;
  elements.tokens.textContent = allocation === null ? "-- BASE" : `${formatToken.format(allocation)} BASE`;
  elements.usd.textContent =
    allocation === null
      ? "Estimated value: -- USDT"
      : `Estimated value: ${formatUsdt.format(usdtValue)} USDT at ${formatCompactUsd(model.fdv)} FDV`;
  if (state.activity) replayClass(elements.results, "updating");
}

function renderActivity(activity) {
  elements.txCount.textContent = formatNumber.format(activity.transactionCount);
  elements.activeDays.textContent = formatNumber.format(activity.activeDays);
  elements.contractsCount.textContent = formatNumber.format(activity.uniqueContracts);
  elements.balance.textContent = `${activity.balanceEth.toFixed(4)} ETH`;

  const encoded = encodeURIComponent(state.address);
  elements.links.innerHTML = `
    <a href="https://basescan.org/address/${encoded}" target="_blank" rel="noopener noreferrer">BaseScan ↗</a>
    <a href="https://layerhub.xyz/search?p=basetransation&address=${encoded}" target="_blank" rel="noopener noreferrer">LayerHub ↗</a>
  `;
}

function isValidAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function apiUrl(address) {
  const localStatic = ["localhost", "127.0.0.1", ""].includes(window.location.hostname);
  if (localStatic) {
    return `https://base.blockscout.com/api/v2/addresses/${encodeURIComponent(address)}/counters`;
  }
  return `/api/activity?address=${encodeURIComponent(address)}`;
}

async function getLocalPreviewActivity(address) {
  const base = "https://base.blockscout.com/api/v2";
  const [countersResponse, addressResponse, transactionsResponse] = await Promise.all([
    fetch(`${base}/addresses/${address}/counters`),
    fetch(`${base}/addresses/${address}`),
    fetch(`${base}/addresses/${address}/transactions`),
  ]);
  if (!countersResponse.ok || !addressResponse.ok || !transactionsResponse.ok) {
    throw new Error("Explorer request failed");
  }
  const [counters, addressData, transactions] = await Promise.all([
    countersResponse.json(),
    addressResponse.json(),
    transactionsResponse.json(),
  ]);
  return normalizeActivity(counters, addressData, transactions.items || []);
}

function normalizeActivity(counters, addressData, transactions) {
  const dates = new Set();
  const contracts = new Set();
  let bridgeSignals = 0;
  transactions.forEach((tx) => {
    if (tx.timestamp) dates.add(tx.timestamp.slice(0, 10));
    const target = tx.to && (tx.to.hash || tx.to);
    if (target) contracts.add(String(target).toLowerCase());
    const haystack = JSON.stringify(tx).toLowerCase();
    if (haystack.includes("bridge") || haystack.includes("deposit")) bridgeSignals += 1;
  });
  const wei = Number(addressData.coin_balance || addressData.coinBalance || 0);
  return {
    transactionCount: Number(counters.transactions_count || counters.transactionsCount || transactions.length || 0),
    activeDays: dates.size,
    uniqueContracts: contracts.size,
    bridgeSignals,
    balanceEth: Number.isFinite(wei) ? wei / 1e18 : 0,
  };
}

async function fetchActivity(address) {
  if (["localhost", "127.0.0.1", ""].includes(window.location.hostname)) {
    return getLocalPreviewActivity(address);
  }
  const response = await fetch(apiUrl(address));
  if (!response.ok) {
    const issue = await response.json().catch(() => ({}));
    throw new Error(issue.error || "Unable to read this wallet right now.");
  }
  return response.json();
}

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const address = elements.address.value.trim();
  if (!isValidAddress(address)) {
    setStatus("Please enter a valid EVM address beginning with 0x.", "error");
    return;
  }

  state.address = address;
  elements.button.disabled = true;
  elements.button.textContent = "Checking...";
  elements.button.classList.add("loading");
  setStatus("Reading public Base activity and preparing your estimate...");

  try {
    state.activity = await fetchActivity(address);
    renderActivity(state.activity);
    renderEstimate();
    setStatus("Estimate ready. This is a model, not official eligibility or a claimable allocation.", "success");
  } catch (error) {
    state.activity = null;
    renderEstimate();
    setStatus(error.message || "Unable to read activity right now. Please try again.", "error");
  } finally {
    elements.button.disabled = false;
    elements.button.textContent = "Check estimate";
    elements.button.classList.remove("loading");
  }
});

[elements.fdv, elements.supply, elements.pool, elements.recipients].forEach((control) => {
  control.addEventListener("change", renderEstimate);
});

renderEstimate();
