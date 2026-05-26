const BASE_EXPLORER_API = "https://base.blockscout.com/api/v2";

function isAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(value || "");
}

function normalizeActivity(counters, addressData, transactions) {
  const activeDays = new Set();
  const contracts = new Set();
  let bridgeSignals = 0;

  transactions.forEach((tx) => {
    if (tx.timestamp) activeDays.add(tx.timestamp.slice(0, 10));
    const target = tx.to && (tx.to.hash || tx.to);
    if (target) contracts.add(String(target).toLowerCase());
    const searchable = JSON.stringify(tx).toLowerCase();
    if (searchable.includes("bridge") || searchable.includes("deposit")) bridgeSignals += 1;
  });

  const balanceWei = Number(addressData.coin_balance || addressData.coinBalance || 0);
  return {
    transactionCount: Number(counters.transactions_count || counters.transactionsCount || transactions.length || 0),
    activeDays: activeDays.size,
    uniqueContracts: contracts.size,
    bridgeSignals,
    balanceEth: Number.isFinite(balanceWei) ? balanceWei / 1e18 : 0,
    sampledTransactions: transactions.length,
    source: "Base Blockscout public API",
  };
}

async function json(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Explorer request returned ${response.status}`);
  }
  return response.json();
}

module.exports = async function handler(request, response) {
  const address = String(request.query.address || "").trim();
  if (!isAddress(address)) {
    response.status(400).json({ error: "Please provide a valid 0x wallet address." });
    return;
  }

  try {
    const encoded = encodeURIComponent(address);
    const [counters, addressData, transactionsData] = await Promise.all([
      json(`${BASE_EXPLORER_API}/addresses/${encoded}/counters`),
      json(`${BASE_EXPLORER_API}/addresses/${encoded}`),
      json(`${BASE_EXPLORER_API}/addresses/${encoded}/transactions`),
    ]);

    response.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    response.status(200).json(normalizeActivity(counters, addressData, transactionsData.items || []));
  } catch (error) {
    response.status(502).json({
      error: "Base explorer activity is temporarily unavailable. Try again shortly.",
    });
  }
};
