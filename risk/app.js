const STORAGE_KEY = "trade-risk-target-v1";
const THEME_KEY = "trade-risk-target-theme-v1";

const inputIds = ["account", "riskPercent", "entry", "stop", "target"];
const inputs = inputIds.map((id) => document.getElementById(id));

initTheme();
wireDisabledNav();
inputs.forEach((input) => input.addEventListener("input", calculate));
loadState();

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "blue";
  document.documentElement.dataset.theme = saved === "light" ? "light" : "blue";

  const toggle = document.getElementById("themeToggle");
  const buttons = toggle.querySelectorAll("button");

  function setActive(mode) {
    buttons.forEach((button) => button.classList.toggle("active", button.dataset.theme === mode));
  }

  setActive(document.documentElement.dataset.theme);

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.theme;
      document.documentElement.dataset.theme = mode;
      localStorage.setItem(THEME_KEY, mode);
      setActive(mode);
    });
  });
}

function wireDisabledNav() {
  document.querySelectorAll(".top-nav-link.is-disabled").forEach((link) => {
    link.addEventListener("click", (event) => event.preventDefault());
  });
}

function formatMoney(value) {
  if (!Number.isFinite(value)) return "—";
  return `$${value.toFixed(2)}`;
}

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}%`;
}

function calculate() {
  const account = parseFloat(document.getElementById("account").value);
  const riskPercent = parseFloat(document.getElementById("riskPercent").value);
  const entry = parseFloat(document.getElementById("entry").value);
  const stop = parseFloat(document.getElementById("stop").value);
  const target = parseFloat(document.getElementById("target").value);

  if (!account || !riskPercent || !entry || !stop || !target || entry === stop) {
    resetOutputs();
    saveState();
    return;
  }

  const riskAmount = account * (riskPercent / 100);
  const riskPerShare = Math.abs(entry - stop);
  const shares = Math.floor(riskAmount / riskPerShare);

  const rewardPerShare = Math.abs(target - entry);
  const projectedProfit = shares * rewardPerShare;
  const rMultiple = rewardPerShare / riskPerShare;

  const stopPct = (Math.abs(entry - stop) / entry) * 100;
  const targetPct = (Math.abs(target - entry) / entry) * 100;

  document.getElementById("rMultiple").innerText = formatNumber(rMultiple);
  document.getElementById("shares").innerText = Number.isFinite(shares) ? shares : "—";
  document.getElementById("maxRisk").innerText = formatMoney(riskAmount);
  document.getElementById("profit").innerText = formatMoney(projectedProfit);
  document.getElementById("stopPct").innerText = formatPercent(stopPct);
  document.getElementById("targetPct").innerText = formatPercent(targetPct);

  const decisionBox = document.getElementById("decisionBox");
  const decisionSubtext = document.getElementById("decisionSubtext");

  if (rMultiple >= 1.5) {
    decisionBox.innerText = "Valid Trade";
    decisionBox.className = "decision decision-valid";
    decisionSubtext.innerText = "Reward profile clears minimum threshold.";
  } else if (rMultiple >= 1.0) {
    decisionBox.innerText = "Caution";
    decisionBox.className = "decision decision-caution";
    decisionSubtext.innerText = "Trade may be viable, but reward is thin.";
  } else {
    decisionBox.innerText = "Invalid Setup";
    decisionBox.className = "decision decision-invalid";
    decisionSubtext.innerText = "Reward does not justify the defined risk.";
  }

  saveState();
}

function resetOutputs() {
  document.getElementById("rMultiple").innerText = "—";
  document.getElementById("shares").innerText = "—";
  document.getElementById("maxRisk").innerText = "—";
  document.getElementById("profit").innerText = "—";
  document.getElementById("stopPct").innerText = "—";
  document.getElementById("targetPct").innerText = "—";

  const decisionBox = document.getElementById("decisionBox");
  const decisionSubtext = document.getElementById("decisionSubtext");

  decisionBox.innerText = "—";
  decisionBox.className = "decision decision-neutral";
  decisionSubtext.innerText = "Enter values to generate a decision.";
}

function saveState() {
  const data = {};
  inputs.forEach((input) => {
    data[input.id] = input.value;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const data = JSON.parse(raw);
    inputs.forEach((input) => {
      if (data[input.id] !== undefined) {
        input.value = data[input.id];
      }
    });
    calculate();
  } catch (error) {
    resetOutputs();
  }
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
