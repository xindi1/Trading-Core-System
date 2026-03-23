const $ = (id) => document.getElementById(id);
const KEY = "trade-qualification-engine-v1";
const THEME_KEY = "trade-qualification-engine-theme-v1";

(function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "blue";
  document.documentElement.dataset.theme = saved === "light" ? "light" : "blue";

  const toggle = $("themeToggle");
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
})();

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function money(n) {
  if (!isFinite(n)) return "$—";
  return "$" + Math.round(n).toLocaleString();
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function tickClock() {
  $("clock").textContent = nowStamp();
}

const REGIMES = {
  GREEN: {
    name: "🟢 High-Catalyst",
    hint: "More gappers, momentum respected. Slightly lower volume threshold, more willingness to press.",
    volMin: 3.5,
    spreadMax: 5.0,
    floatMax: 20,
    pmPctMax: 150,
    stopPct: 12,
    sizePct: 0.95,
    scoreMin: 68
  },
  YELLOW: {
    name: "🟡 Normal",
    hint: "Selective day. You want clean VWAP + strong catalyst + real volume.",
    volMin: 5.0,
    spreadMax: 5.0,
    floatMax: 20,
    pmPctMax: 150,
    stopPct: 12,
    sizePct: 0.90,
    scoreMin: 72
  },
  ORANGE: {
    name: "🟠 Choppy",
    hint: "Thin/false moves. Require heavier volume & tighter spreads. Reduce size; be quicker.",
    volMin: 7.0,
    spreadMax: 4.0,
    floatMax: 15,
    pmPctMax: 120,
    stopPct: 10,
    sizePct: 0.75,
    scoreMin: 78
  },
  RED: {
    name: "🔴 Dead/Trap",
    hint: "Gate mostly closed. Only trade surprise news with exceptional volume + structure.",
    volMin: 10.0,
    spreadMax: 3.5,
    floatMax: 12,
    pmPctMax: 100,
    stopPct: 9,
    sizePct: 0.60,
    scoreMin: 88
  }
};

let activeRegime = "GREEN";
let earlyMode = false;

const EARLY_BASE = {
  "0715": 70000,
  "0745": 180000,
  "0830": 350000,
  "0915": 600000
};

function regimeMultForEarly(regime) {
  if (regime === "GREEN") return 0.85;
  if (regime === "YELLOW") return 1.0;
  if (regime === "ORANGE") return 1.15;
  return 1.35;
}

function floatMultForEarly(floatM) {
  if (!isFinite(floatM) || floatM <= 0) return 1.0;
  if (floatM <= 5) return 0.65;
  if (floatM <= 10) return 0.85;
  if (floatM <= 20) return 1.05;
  return 1.25;
}

function earlyRequiredShares(checkpoint, floatM, regime) {
  const base = EARLY_BASE[String(checkpoint)] ?? EARLY_BASE["0830"];
  return Math.round(base * floatMultForEarly(floatM) * regimeMultForEarly(regime));
}

function setRegime(regime) {
  activeRegime = regime;
  document.querySelectorAll(".regime-tabs button").forEach((button) => {
    button.classList.toggle("active", button.dataset.regime === regime);
  });

  $("regimeHint").textContent = REGIMES[regime].hint;
  renderThresholds();
  renderEarlyHint();
  evaluate(false);
  saveToStorage();
}

function setEarlyMode(on) {
  earlyMode = !!on;
  const sw = $("earlySwitch");
  sw.classList.toggle("on", earlyMode);
  sw.setAttribute("aria-checked", earlyMode ? "true" : "false");

  $("earlyBlock").hidden = !earlyMode;
  $("normalVolBlock").hidden = earlyMode;
  $("spreadAlways").hidden = !earlyMode;

  renderThresholds();
  renderEarlyHint();
  evaluate(false);
  saveToStorage();
}

function renderEarlyHint() {
  if (!earlyMode) {
    $("earlyHint").textContent = "Early Mode is off.";
    return;
  }

  const floatM = parseFloat($("floatM").value || "NaN");
  const checkpoint = $("checkpoint").value || "0830";
  const req = earlyRequiredShares(checkpoint, floatM, activeRegime);

  const label = checkpoint === "0715" ? "7:15" : checkpoint === "0745" ? "7:45" : checkpoint === "0830" ? "8:30" : "9:15";
  $("earlyHint").innerHTML = `Early Mode volume check: by <b>${label}</b> aim for ≥ <b>${req.toLocaleString()}</b> shares (adjusted for float + regime).`;
}

function renderThresholds() {
  const p = REGIMES[activeRegime];
  const earlyNote = earlyMode
    ? "Early Mode: uses <b>absolute share checkpoints</b> instead of vol× until data matures."
    : `Normal Mode: requires Volume ≥ <b>${p.volMin}×</b>.`;

  $("thresholdsNote").innerHTML = `Active regime: <b>${p.name}</b> · Spread ≤ <b>${p.spreadMax}%</b>, Float ≤ <b>${p.floatMax}M</b>, Premarket ≤ <b>${p.pmPctMax}%</b>. ${earlyNote}`;
}

function getConfidenceLabel(score, decision, hardFail, redExtraFail) {
  if (hardFail || redExtraFail) return "Low";
  if (decision === "GO" && score >= 85) return "High";
  if (decision === "GO" || decision === "TRACK") return "Moderate";
  if (decision === "WAIT") return "Developing";
  return "Low";
}

function renderChecks(checks) {
  const list = $("checksList");
  list.innerHTML = "";

  checks.forEach((check) => {
    const item = document.createElement("li");
    item.innerHTML = `<span class="check-icon">${check.pass ? "✅" : "❌"}</span><span>${check.text}</span>`;
    list.appendChild(item);
  });
}

function renderFailFast(flags) {
  const wrap = $("failFastList");
  if (!flags.length) {
    wrap.innerHTML = '<div class="empty-state">No fail-fast flags.</div>';
    return;
  }

  wrap.innerHTML = flags.map((flag) => `
    <div class="flag-item">
      <div class="flag-copy">${flag.text}</div>
      <div class="flag-badge ${flag.type === "hard" ? "flag-hard" : flag.type === "ok" ? "flag-ok" : "flag-caution"}">${flag.label}</div>
    </div>
  `).join("");
}

function renderDecisionState(decision, regimeName, earlyModeOn, why) {
  const box = $("statusBox");
  box.classList.remove("state-go", "state-track", "state-wait", "state-drop", "state-no-go");

  let stateClass = "state-no-go";
  if (decision === "GO") stateClass = "state-go";
  if (decision === "TRACK") stateClass = "state-track";
  if (decision === "WAIT") stateClass = "state-wait";
  if (decision === "DROP") stateClass = "state-drop";
  if (decision === "NO-GO") stateClass = "state-no-go";

  box.classList.add(stateClass);
  $("decisionLine").innerHTML = `${decision}<span class="badge-inline">${regimeName}</span>${earlyModeOn ? '<span class="badge-inline">Early Mode</span>' : ""}`;
  $("decisionWhy").textContent = why;
}

function buildDecisionNarrative({ decision, regimeName, hardFail, redExtraFail }) {
  if (decision === "GO") {
    return `The setup qualifies under ${regimeName}. Core structure is aligned, the catalyst and volume conditions are supportive, and execution can be planned within the existing stop and max-risk framework.`;
  }
  if (decision === "TRACK") {
    return "The setup is promising but not fully confirmed. Early Mode allows this to stay active on the board because core structure is present, but confirmation is still needed before it should be treated as full-go executable.";
  }
  if (decision === "WAIT") {
    return "The setup has some valid components, but the current picture is incomplete. This should stay in observation mode rather than entry mode until structure, spread, VWAP behavior, or range potential become more convincing.";
  }
  if (decision === "DROP") {
    return "The setup should be removed from active focus. A hard fail or strict regime filter is blocking qualification, which means attention is better deployed elsewhere.";
  }
  if (hardFail || redExtraFail) {
    return "The trade fails core qualification standards right now. One or more hard filters are breaking the setup, so the engine is intentionally disqualifying it before execution planning begins.";
  }
  return "The setup does not meet the minimum qualification threshold for execution. Conditions may improve later, but at this moment the engine does not support a trade.";
}

function buildExecutionStance(decision) {
  if (decision === "GO") return "Executable with discipline";
  if (decision === "TRACK") return "Monitor for confirmation";
  if (decision === "WAIT") return "Observe only";
  if (decision === "DROP") return "Remove from focus";
  return "Stand down";
}

function buildDecisionProfile(decision, score, regimeName, confidence) {
  return `${decision} • ${regimeName} • Score ${Math.round(score)} • ${confidence} confidence`;
}

function evaluate() {
  const p = REGIMES[activeRegime];

  const capital = parseFloat($("capital").value || "0");
  const ticker = ($("ticker").value || "").trim().toUpperCase();
  $("ticker").value = ticker;
  const catalystType = $("catalystType").value;
  const catalystFresh = $("catalystFresh").value;
  const floatM = parseFloat($("floatM").value || "NaN");
  const pmPct = parseFloat($("pmPct").value || "NaN");
  const spreadPct = earlyMode ? parseFloat(($("spreadPct2").value || "").trim() || "NaN") : parseFloat(($("spreadPct").value || "").trim() || "NaN");
  const volX = earlyMode ? parseFloat(($("volX2").value || "").trim() || "NaN") : parseFloat(($("volX").value || "").trim() || "NaN");
  const absVol = parseFloat(($("absVol").value || "").trim() || "NaN");
  const checkpoint = $("checkpoint").value || "0830";
  const vwap = $("vwap").value;
  const rangeExp = $("rangeExp").value;

  const checks = [];
  let score = 0;

  function addCheck(pass, text, weight) {
    checks.push({ pass, text, weight });
    if (pass) score += weight;
  }

  const catalystPass = catalystFresh === "FRESH" || catalystFresh === "RECENT";
  addCheck(catalystPass, "Catalyst is fresh/recent (not stale/none)", 18);
  addCheck(!!catalystType, "Catalyst type selected", 6);

  const floatPass = isFinite(floatM) && floatM > 0 && floatM <= p.floatMax;
  addCheck(floatPass, `Float ≤ ${p.floatMax}M`, 14);

  const pmPctPass = isFinite(pmPct) && pmPct >= 0 && pmPct <= p.pmPctMax;
  addCheck(pmPctPass, `Premarket % ≤ ${p.pmPctMax}% (avoid overly-extended)`, 10);

  const spreadPass = isFinite(spreadPct) && spreadPct > 0 && spreadPct <= p.spreadMax;
  addCheck(spreadPass, `Spread ≤ ${p.spreadMax}%`, 14);

  let volPass = false;
  if (earlyMode) {
    const req = earlyRequiredShares(checkpoint, floatM, activeRegime);
    volPass = isFinite(absVol) && absVol >= req;
    addCheck(volPass, `Premarket shares ≥ ${req.toLocaleString()} (Early Mode checkpoint)`, 14);
  } else {
    volPass = isFinite(volX) && volX >= p.volMin;
    addCheck(volPass, `Premarket volume ≥ ${p.volMin}× average`, 14);
  }

  const vwapPass = vwap === "ABOVE" || vwap === "RECLAIM";
  addCheck(vwapPass, "VWAP holding or reclaiming", 14);

  let rangePass = false;
  if (earlyMode && (rangeExp === "" || rangeExp === "MED")) {
    rangePass = rangeExp === "HIGH" || rangeExp === "EXT" || rangeExp === "MED" || rangeExp === "";
    addCheck(true, "Expected range (Early Mode: optional/soft)", 6);
  } else {
    rangePass = rangeExp === "HIGH" || rangeExp === "EXT";
    addCheck(rangePass, "Expected day range potential ≥ 50%", 10);
  }

  addCheck(!!ticker, "Ticker provided", 2);
  score = clamp(score, 0, 100);

  const hardFail = catalystFresh === "NONE" || catalystFresh === "STALE" || vwap === "BELOW" || !spreadPass || !volPass;
  const redExtraFail = activeRegime === "RED" && (!(catalystFresh === "FRESH") || !floatPass || !pmPctPass);

  let decision = "NO-GO";

  if (earlyMode) {
    if (hardFail || redExtraFail) {
      decision = "DROP";
    } else {
      const strongStructure = catalystPass && floatPass && spreadPass && vwapPass && volPass;
      const tooExtended = isFinite(pmPct) && pmPct > (p.pmPctMax * 0.80);
      decision = strongStructure && !tooExtended ? "TRACK" : "WAIT";

      const confirmedRange = rangeExp === "HIGH" || rangeExp === "EXT";
      const goEarly = strongStructure && pmPctPass && confirmedRange && (score >= Math.max(60, p.scoreMin - 8));
      if (goEarly) decision = "GO";
    }
  } else {
    const go = !hardFail && !redExtraFail && score >= p.scoreMin && rangePass;
    decision = go ? "GO" : "NO-GO";
  }

  let size = capital * p.sizePct;
  if (isFinite(spreadPct) && spreadPct > (p.spreadMax * 0.75)) size *= 0.85;
  if (vwap === "" || vwap === "NA") size *= 0.85;
  if (earlyMode && decision !== "GO") size *= 0.80;
  size = clamp(size, 0, capital);

  let stop = clamp(p.stopPct, 8, 15);
  const maxRisk = Math.min(150, size * (stop / 100));

  const session =
    decision === "DROP" || decision === "NO-GO" ? "Stand Down" :
    decision === "WAIT" ? "Watchlist Only (no entry yet)" :
    decision === "TRACK" ? "Premarket (re-eval soon) / Open Drive" :
    vwap === "RECLAIM" ? "Premarket VWAP Reclaim / Open Drive" : "Premarket / Opening Drive";

  const exitPlan =
    decision === "DROP" || decision === "NO-GO" ? "No trade. Preserve capital. Wait for a clean volatility expansion day." :
    earlyMode && decision !== "GO" ? "Do NOT enter yet. Re-evaluate at the next checkpoint. Enter only on VWAP reclaim + tightening spread + accelerating volume." :
    activeRegime === "ORANGE" || activeRegime === "RED" ? "Take 25% at +25%. Take another 25% at +40%. Keep 50% only if VWAP holds; trail under higher-lows." :
    "Take 20–25% at +30–40%. Hold core for +60–100% if VWAP holds and volume expands. Hard stop stays in place.";

  const confidence = getConfidenceLabel(score, decision, hardFail, redExtraFail);
  const failFastFlags = [];

  if (catalystFresh === "NONE" || catalystFresh === "STALE") {
    failFastFlags.push({ type: "hard", label: "HARD FAIL", text: "Catalyst freshness is stale or absent." });
  }
  if (vwap === "BELOW") {
    failFastFlags.push({ type: "hard", label: "HARD FAIL", text: "VWAP status is below / failing." });
  }
  if (!spreadPass) {
    failFastFlags.push({ type: "hard", label: "HARD FAIL", text: `Spread is wider than the active regime limit (${p.spreadMax}%).` });
  }
  if (!volPass) {
    failFastFlags.push({ type: "hard", label: "HARD FAIL", text: earlyMode ? "Premarket shares have not met the Early Mode checkpoint." : "Premarket volume has not met the regime requirement." });
  }
  if (redExtraFail) {
    failFastFlags.push({ type: "hard", label: "RED REGIME", text: "Dead / Trap regime requires fresh catalyst plus tighter float and extension discipline." });
  }
  if (isFinite(pmPct) && pmPct > (p.pmPctMax * 0.80) && decision !== "NO-GO" && decision !== "DROP") {
    failFastFlags.push({ type: "caution", label: "CAUTION", text: "Premarket extension is approaching the upper tolerance zone." });
  }
  if (vwap === "NA" || vwap === "") {
    failFastFlags.push({ type: "caution", label: "CAUTION", text: "VWAP context is incomplete or unknown." });
  }
  if (!failFastFlags.length) {
    failFastFlags.push({ type: "ok", label: "CLEAR", text: "No hard fail conditions are currently active." });
  }

  let decisionWhy = "Failed one or more hard rules or score threshold.";
  if (decision === "GO") decisionWhy = "Confirmed. You can plan an entry (still obey stop/max risk).";
  else if (decision === "TRACK") decisionWhy = "Eligible early. Needs confirmation (next checkpoint + VWAP + spread).";
  else if (decision === "WAIT") decisionWhy = "Some positives, but not clean enough yet. Do not enter—recheck soon.";
  else if (decision === "DROP") decisionWhy = "Hard fail conditions (or RED-regime strictness). Remove from focus.";

  renderDecisionState(decision, p.name, earlyMode, decisionWhy);
  $("scoreBadge").textContent = `Score: ${Math.round(score)}`;
  $("confidenceBadge").textContent = `Confidence: ${confidence}`;
  $("scoreMetric").textContent = Math.round(score);
  $("recSession").textContent = session;
  $("posSize").textContent = money(size);
  $("stopPct").textContent = decision === "GO" ? `${stop.toFixed(1)}%` : "—";
  $("maxRisk").textContent = decision === "GO" ? money(maxRisk) : "$—";
  $("decisionProfile").textContent = buildDecisionProfile(decision, score, p.name, confidence);
  $("executionStance").textContent = buildExecutionStance(decision);
  $("reasonNarrative").textContent = buildDecisionNarrative({ decision, regimeName: p.name, hardFail, redExtraFail });
  $("exitPlan").textContent = exitPlan;

  renderChecks(checks);
  renderFailFast(failFastFlags);

  window.__lastEval = {
    ts: nowStamp(),
    regime: p.name,
    earlyMode,
    checkpoint,
    absVol: isFinite(absVol) ? absVol : "",
    ticker,
    catalystType,
    catalystFresh,
    floatM: isFinite(floatM) ? floatM : "",
    pmPct: isFinite(pmPct) ? pmPct : "",
    volX: isFinite(volX) ? volX : "",
    spreadPct: isFinite(spreadPct) ? spreadPct : "",
    vwap,
    rangeExp,
    score: Math.round(score),
    decision,
    confidence,
    session,
    posSize: Math.round(size || 0),
    stopPct: decision === "GO" ? stop.toFixed(1) : "",
    maxRisk: decision === "GO" ? Math.round(maxRisk || 0) : "",
    notes: $("notes").value || ""
  };

  return window.__lastEval;
}

function getState() {
  return {
    activeRegime,
    earlyMode,
    capital: $("capital").value,
    ticker: $("ticker").value,
    catalystType: $("catalystType").value,
    catalystFresh: $("catalystFresh").value,
    floatM: $("floatM").value,
    pmPct: $("pmPct").value,
    volX: $("volX").value,
    spreadPct: $("spreadPct").value,
    absVol: $("absVol").value,
    checkpoint: $("checkpoint").value,
    spreadPct2: $("spreadPct2").value,
    volX2: $("volX2").value,
    vwap: $("vwap").value,
    rangeExp: $("rangeExp").value,
    notes: $("notes").value
  };
}

function setState(state) {
  if (!state) return;
  if (state.activeRegime && REGIMES[state.activeRegime]) setRegime(state.activeRegime);

  $("capital").value = state.capital ?? 1000;
  $("ticker").value = state.ticker ?? "";
  $("catalystType").value = state.catalystType ?? "";
  $("catalystFresh").value = state.catalystFresh ?? "";
  $("floatM").value = state.floatM ?? "";
  $("pmPct").value = state.pmPct ?? "";
  $("volX").value = state.volX ?? "";
  $("spreadPct").value = state.spreadPct ?? "";
  $("absVol").value = state.absVol ?? "";
  $("checkpoint").value = state.checkpoint ?? "0830";
  $("spreadPct2").value = state.spreadPct2 ?? "";
  $("volX2").value = state.volX2 ?? "";
  $("vwap").value = state.vwap ?? "";
  $("rangeExp").value = state.rangeExp ?? "";
  $("notes").value = state.notes ?? "";

  setEarlyMode(!!state.earlyMode);
}

function saveToStorage() {
  try {
    localStorage.setItem(KEY, JSON.stringify(getState()));
  } catch (error) {}
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    setState(JSON.parse(raw));
  } catch (error) {}
}

function toCSVRow(obj) {
  const cols = [
    "ts", "regime", "earlyMode", "checkpoint", "absVol", "ticker", "catalystType", "catalystFresh",
    "floatM", "pmPct", "volX", "spreadPct", "vwap", "rangeExp", "score", "decision", "confidence",
    "session", "posSize", "stopPct", "maxRisk", "notes"
  ];

  const esc = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  return cols.map((col) => esc(obj[col])).join(",");
}

function exportCSV() {
  const snap = window.__lastEval || evaluate();
  const header = [
    "ts", "regime", "earlyMode", "checkpoint", "absVol", "ticker", "catalystType", "catalystFresh",
    "floatM", "pmPct", "volX", "spreadPct", "vwap", "rangeExp", "score", "decision", "confidence",
    "session", "posSize", "stopPct", "maxRisk", "notes"
  ].join(",");

  const csv = `${header}\n${toCSVRow(snap)}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeTicker = (snap.ticker || "QUAL").replace(/[^A-Za-z0-9_-]/g, "");
  a.href = url;
  a.download = `trade-qualification-engine_${safeTicker}_${snap.ts.replace(/[: ]/g, "-")}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

document.querySelectorAll(".regime-tabs button").forEach((button) => {
  button.addEventListener("click", () => setRegime(button.dataset.regime));
});

function toggleEarly() {
  setEarlyMode(!earlyMode);
}

$("earlySwitch").addEventListener("click", toggleEarly);
$("earlySwitch").addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    toggleEarly();
  }
});

$("checkpoint").addEventListener("change", () => {
  renderEarlyHint();
  saveToStorage();
});
$("floatM").addEventListener("input", () => {
  renderEarlyHint();
  saveToStorage();
});

const autos = ["capital", "ticker", "catalystType", "catalystFresh", "floatM", "pmPct", "volX", "spreadPct", "absVol", "checkpoint", "spreadPct2", "volX2", "vwap", "rangeExp", "notes"];
autos.forEach((id) => {
  const el = $(id);
  if (!el) return;
  el.addEventListener("input", saveToStorage);
  el.addEventListener("change", saveToStorage);
});

$("evalBtn").addEventListener("click", () => {
  renderEarlyHint();
  evaluate();
  saveToStorage();
});

$("saveBtn").addEventListener("click", () => {
  saveToStorage();
  renderEarlyHint();
  evaluate();
});

$("exportBtn").addEventListener("click", exportCSV);

$("resetBtn").addEventListener("click", () => {
  localStorage.removeItem(KEY);

  $("capital").value = 1000;
  $("ticker").value = "";
  $("catalystType").value = "";
  $("catalystFresh").value = "";
  $("floatM").value = "";
  $("pmPct").value = "";
  $("volX").value = "";
  $("spreadPct").value = "";
  $("absVol").value = "";
  $("checkpoint").value = "0830";
  $("spreadPct2").value = "";
  $("volX2").value = "";
  $("vwap").value = "";
  $("rangeExp").value = "";
  $("notes").value = "";

  setEarlyMode(false);
  setRegime("GREEN");
  renderEarlyHint();
  evaluate();
  saveToStorage();
});

tickClock();
setInterval(tickClock, 1000);
loadFromStorage();
setRegime(activeRegime);
renderEarlyHint();
evaluate();
