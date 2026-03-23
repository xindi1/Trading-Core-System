const STORAGE_KEYS = {
  decisions: "trade-execution-journal-v1",
  counter: "trade-execution-journal-counter-v1",
  draft: "trade-execution-journal-draft-v1",
  lock: "trade-execution-journal-lock-v1",
  lastDuration: "trade-execution-journal-last-duration-v1",
  theme: "trade-execution-journal-theme-v1"
};

const el = {
  decisionNo: document.getElementById("decisionNo"),
  lockDecision: document.getElementById("lockDecision"),
  date: document.getElementById("date"),
  ticker: document.getElementById("ticker"),
  qualificationDecision: document.getElementById("qualificationDecision"),
  qualificationScore: document.getElementById("qualificationScore"),
  plannedSession: document.getElementById("plannedSession"),
  riskPlanReference: document.getElementById("riskPlanReference"),
  session: document.getElementById("session"),
  catalyst: document.getElementById("catalyst"),
  marketState: document.getElementById("marketState"),
  thesis: document.getElementById("thesis"),
  outcomeNotes: document.getElementById("outcomeNotes"),
  followedPlan: document.getElementById("followedPlan"),
  passCorrect: document.getElementById("passCorrect"),
  invalidationValid: document.getElementById("invalidationValid"),
  timingQuality: document.getElementById("timingQuality"),
  emotionInterference: document.getElementById("emotionInterference"),
  takeAgain: document.getElementById("takeAgain"),
  plannedEntry: document.getElementById("plannedEntry"),
  plannedStop: document.getElementById("plannedStop"),
  plannedTarget: document.getElementById("plannedTarget"),
  maxRisk: document.getElementById("maxRisk"),
  timerClock: document.getElementById("timerClock"),
  timerStatus: document.getElementById("timerStatus"),
  stopDistance: document.getElementById("stopDistance"),
  targetDistance: document.getElementById("targetDistance"),
  roughR: document.getElementById("roughR"),
  charCounter: document.getElementById("charCounter"),
  historyList: document.getElementById("historyList"),
  statSaved: document.getElementById("statSaved"),
  statLastDur: document.getElementById("statLastDur"),
  statTaken: document.getElementById("statTaken"),
  statPassed: document.getElementById("statPassed"),
  statInvalid: document.getElementById("statInvalid")
};

const timer = { running: false, startTs: 0, elapsedMs: 0, tickId: null, touched: false };

initTheme();
wireDisabledNav();
wireActions();
wireForm();
ensureSeedData();
loadDraftOrInitialize();
setNotesLocked(true);
renderTimer();
updateDerivedMetrics();
updateStats();
renderHistory();

function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEYS.theme) || "blue";
  document.documentElement.dataset.theme = saved === "light" ? "light" : "blue";
  const buttons = document.querySelectorAll("#themeToggle button");
  setThemeActive(document.documentElement.dataset.theme);
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      document.documentElement.dataset.theme = button.dataset.theme;
      localStorage.setItem(STORAGE_KEYS.theme, button.dataset.theme);
      setThemeActive(button.dataset.theme);
    });
  });
}
function setThemeActive(mode) {
  document.querySelectorAll("#themeToggle button").forEach((button) => button.classList.toggle("active", button.dataset.theme === mode));
}
function wireDisabledNav() {
  document.querySelectorAll(".top-nav-link.is-disabled").forEach((link) => link.addEventListener("click", (event) => event.preventDefault()));
}
function ensureSeedData() {
  if (!Array.isArray(readJSON(STORAGE_KEYS.decisions, null))) writeJSON(STORAGE_KEYS.decisions, []);
}
function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function toast(message) {
  const toastEl = document.getElementById("toast");
  toastEl.textContent = message;
  toastEl.style.opacity = "1";
  clearTimeout(toast._tm);
  toast._tm = setTimeout(() => { toastEl.style.opacity = "0"; }, 1700);
}
function nowLocalISODate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function pad(n, width = 4) { return String(n).padStart(width, "0"); }
function normalizeDecisionNo(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits ? (digits.length >= 4 ? digits : digits.padStart(4, "0")) : "";
}
function inferSession() {
  const d = new Date();
  const hh = d.getHours() + d.getMinutes() / 60;
  if (hh < 9.5) return "Premarket";
  if (hh < 10.5) return "Open (9:30–10:30)";
  if (hh < 15) return "Midday";
  if (hh < 16) return "Power Hour";
  return "After Hours";
}
function getCounter() {
  const n = parseInt(localStorage.getItem(STORAGE_KEYS.counter) || "0", 10);
  return Number.isFinite(n) ? n : 0;
}
function setCounter(n) { localStorage.setItem(STORAGE_KEYS.counter, String(n)); }
function nextDecisionNumber() {
  const n = getCounter() + 1;
  setCounter(n);
  return pad(n, 4);
}
function msToHMS(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}
function wireActions() {
  document.getElementById("btnSave").addEventListener("click", saveDecision);
  document.getElementById("btnNew").addEventListener("click", newDecision);
  document.getElementById("btnHistory").addEventListener("click", showHistoryPrompt);
  document.getElementById("btnCopy").addEventListener("click", copyDecision);
  document.getElementById("btnExportCSV").addEventListener("click", exportCSV);
  document.getElementById("btnExportJSON").addEventListener("click", exportJSON);
  document.getElementById("btnDelete").addEventListener("click", deleteCurrentDecision);
  document.getElementById("btnClearAll").addEventListener("click", clearAll);
  document.getElementById("btnResetCounter").addEventListener("click", resetAutoCounter);
  document.getElementById("btnTimerStart").addEventListener("click", timerStart);
  document.getElementById("btnTimerPause").addEventListener("click", timerPause);
  document.getElementById("btnTimerReset").addEventListener("click", () => timerReset(false));
}
function wireForm() {
  el.lockDecision.addEventListener("change", () => {
    setDecisionEditable(!el.lockDecision.checked);
    syncLockPill();
    localStorage.setItem(STORAGE_KEYS.lock, el.lockDecision.checked ? "1" : "0");
    saveDraft();
  });
  [
    el.date, el.ticker, el.qualificationDecision, el.qualificationScore, el.plannedSession, el.riskPlanReference,
    el.session, el.catalyst, el.marketState, el.thesis, el.followedPlan, el.passCorrect, el.invalidationValid,
    el.timingQuality, el.emotionInterference, el.takeAgain, el.plannedEntry, el.plannedStop, el.plannedTarget, el.maxRisk
  ].forEach((node) => {
    node.addEventListener("input", onMutableChange);
    node.addEventListener("change", onMutableChange);
  });
  el.outcomeNotes.addEventListener("input", saveDraft);
  el.decisionNo.addEventListener("blur", () => {
    if (!el.decisionNo.readOnly) el.decisionNo.value = normalizeDecisionNo(el.decisionNo.value);
    saveDraft();
    markTouched();
  });
  el.ticker.addEventListener("input", () => {
    el.ticker.value = el.ticker.value.toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
  });
  document.querySelectorAll(".outcome-card").forEach((card) => {
    card.addEventListener("click", () => {
      setOutcome(card.dataset.val);
      saveDraft();
      markTouched();
    });
  });
}
function onMutableChange() {
  updateCharCounter();
  updateDerivedMetrics();
  saveDraft();
  markTouched();
}
function syncLockPill() {
  const pill = document.querySelector(".lock-pill");
  pill.classList.toggle("is-active", el.lockDecision.checked);
}
function updateCharCounter() { el.charCounter.textContent = `${(el.thesis.value || "").length} / 240`; }
function setDecisionEditable(isEditable) {
  el.decisionNo.readOnly = !isEditable;
  el.decisionNo.style.opacity = isEditable ? "1" : ".82";
}
function setOutcome(value) {
  document.querySelectorAll('input[name="outcome"]').forEach((input) => { input.checked = input.value === value; });
  document.querySelectorAll(".outcome-card").forEach((card) => card.classList.toggle("is-active", card.dataset.val === value));
}
function getOutcome() {
  const checked = document.querySelector('input[name="outcome"]:checked');
  return checked ? checked.value : "";
}
function setNotesLocked(locked) {
  el.outcomeNotes.disabled = locked;
  el.outcomeNotes.style.opacity = locked ? ".7" : "1";
}
function timerStart() {
  if (timer.running) return;
  timer.running = true;
  timer.startTs = Date.now();
  timer.tickId = setInterval(() => {
    const delta = Date.now() - timer.startTs;
    timer.elapsedMs += delta;
    timer.startTs = Date.now();
    renderTimer();
  }, 250);
  renderTimer();
}
function timerPause() {
  if (!timer.running) return;
  clearInterval(timer.tickId);
  timer.tickId = null;
  timer.running = false;
  renderTimer();
}
function timerReset(autoStart = false) {
  clearInterval(timer.tickId);
  timer.tickId = null;
  timer.running = false;
  timer.startTs = 0;
  timer.elapsedMs = 0;
  timer.touched = false;
  renderTimer();
  if (autoStart) timerStart();
}
function renderTimer() {
  el.timerClock.textContent = msToHMS(timer.elapsedMs);
  el.timerStatus.textContent = timer.running ? "Running" : (timer.elapsedMs ? "Paused" : "Ready");
}
function markTouched() {
  if (!timer.touched) {
    timer.touched = true;
    if (!timer.running && timer.elapsedMs === 0) timerStart();
  }
}
function timerStopAndReturn() {
  if (timer.running) timerPause();
  const hms = msToHMS(timer.elapsedMs);
  localStorage.setItem(STORAGE_KEYS.lastDuration, hms);
  return { seconds: Math.round(timer.elapsedMs / 1000), hms };
}
function currentFormData() {
  return {
    decisionNo: normalizeDecisionNo(el.decisionNo.value),
    date: el.date.value,
    ticker: (el.ticker.value || "").trim().toUpperCase(),
    qualificationDecision: el.qualificationDecision.value,
    qualificationScore: (el.qualificationScore.value || "").trim(),
    plannedSession: el.plannedSession.value,
    riskPlanReference: (el.riskPlanReference.value || "").trim(),
    session: el.session.value,
    catalyst: el.catalyst.value,
    marketState: el.marketState.value,
    thesis: (el.thesis.value || "").trim(),
    outcome: getOutcome(),
    outcomeNotes: (el.outcomeNotes.value || "").trim(),
    followedPlan: el.followedPlan.value,
    passCorrect: el.passCorrect.value,
    invalidationValid: el.invalidationValid.value,
    timingQuality: el.timingQuality.value,
    emotionInterference: el.emotionInterference.value,
    takeAgain: el.takeAgain.value,
    plannedEntry: numericOrBlank(el.plannedEntry.value),
    plannedStop: numericOrBlank(el.plannedStop.value),
    plannedTarget: numericOrBlank(el.plannedTarget.value),
    maxRisk: numericOrBlank(el.maxRisk.value)
  };
}
function numericOrBlank(value) {
  return value === "" ? "" : Number(value);
}
function hasMeaningfulContent(data) {
  return Boolean(data.ticker || data.thesis || data.outcome || data.qualificationDecision || data.riskPlanReference || data.plannedEntry !== "" || data.plannedStop !== "" || data.plannedTarget !== "" || data.maxRisk !== "");
}
function saveDraft() {
  writeJSON(STORAGE_KEYS.draft, {
    ...currentFormData(),
    lockDecision: !!el.lockDecision.checked,
    timer: { elapsedMs: timer.elapsedMs, touched: timer.touched }
  });
}
function loadDraftOrInitialize() {
  const draft = readJSON(STORAGE_KEYS.draft, null);
  const locked = localStorage.getItem(STORAGE_KEYS.lock) === "1";
  el.lockDecision.checked = locked;
  setDecisionEditable(!locked);
  syncLockPill();
  updateCharCounter();

  if (!draft) {
    if (!localStorage.getItem(STORAGE_KEYS.counter)) setCounter(0);
    seedFreshDecision();
    return;
  }

  applyRecordToForm(draft, true);
  setNotesLocked(true);
  if (draft.timer && typeof draft.timer.elapsedMs === "number") {
    timer.elapsedMs = Math.max(0, draft.timer.elapsedMs);
    timer.touched = !!draft.timer.touched;
  }
  renderTimer();
}
function seedFreshDecision() {
  el.decisionNo.value = nextDecisionNumber();
  el.date.value = nowLocalISODate();
  el.session.value = inferSession();
  el.catalyst.value = "Operational Update";
  el.marketState.value = "Unclear";
  el.maxRisk.value = "50";
  updateCharCounter();
  updateDerivedMetrics();
  saveDraft();
}
function applyRecordToForm(record, fromDraft = false) {
  el.decisionNo.value = record.decisionNo || el.decisionNo.value || nextDecisionNumber();
  el.date.value = record.date || nowLocalISODate();
  el.ticker.value = record.ticker || "";
  el.qualificationDecision.value = record.qualificationDecision || "";
  el.qualificationScore.value = record.qualificationScore || "";
  el.plannedSession.value = record.plannedSession || "";
  el.riskPlanReference.value = record.riskPlanReference || "";
  el.session.value = record.session || inferSession();
  el.catalyst.value = record.catalyst || "Operational Update";
  el.marketState.value = record.marketState || "Unclear";
  el.thesis.value = record.thesis || "";
  setOutcome(record.outcome || "");
  el.outcomeNotes.value = record.outcomeNotes || "";
  el.followedPlan.value = record.followedPlan || "";
  el.passCorrect.value = record.passCorrect || "";
  el.invalidationValid.value = record.invalidationValid || "";
  el.timingQuality.value = record.timingQuality || "";
  el.emotionInterference.value = record.emotionInterference || "";
  el.takeAgain.value = record.takeAgain || "";
  el.plannedEntry.value = record.plannedEntry === "" || record.plannedEntry === undefined ? "" : String(record.plannedEntry);
  el.plannedStop.value = record.plannedStop === "" || record.plannedStop === undefined ? "" : String(record.plannedStop);
  el.plannedTarget.value = record.plannedTarget === "" || record.plannedTarget === undefined ? "" : String(record.plannedTarget);
  el.maxRisk.value = record.maxRisk === "" || record.maxRisk === undefined ? "50" : String(record.maxRisk);
  updateCharCounter();
  updateDerivedMetrics();
  if (!fromDraft) {
    setNotesLocked(false);
    el.lockDecision.checked = true;
    localStorage.setItem(STORAGE_KEYS.lock, "1");
    setDecisionEditable(false);
    syncLockPill();
  }
}
function validateBeforeSave(data) {
  if (!data.ticker) return "Ticker is required.";
  if (!data.outcome) return "Outcome is required (Taken / Passed / Invalidated).";
  return "";
}
function saveDecision() {
  const decisions = readJSON(STORAGE_KEYS.decisions, []);
  const data = currentFormData();
  const error = validateBeforeSave(data);
  if (error) return alert(error);
  if (!data.decisionNo) {
    data.decisionNo = nextDecisionNumber();
    el.decisionNo.value = data.decisionNo;
  }
  if (!data.date) {
    data.date = nowLocalISODate();
    el.date.value = data.date;
  }
  if (!data.session) {
    data.session = inferSession();
    el.session.value = data.session;
  }
  const existingIndex = decisions.findIndex((item) => item.decisionNo === data.decisionNo);
  if (existingIndex >= 0 && !confirm(`Decision #${data.decisionNo} already exists. Overwrite it?`)) return;

  const duration = timerStopAndReturn();
  const record = { ...data, savedAt: new Date().toISOString(), decisionDurationSeconds: duration.seconds, decisionDurationHms: duration.hms };
  if (existingIndex >= 0) decisions[existingIndex] = record;
  else decisions.unshift(record);
  writeJSON(STORAGE_KEYS.decisions, decisions);

  el.lockDecision.checked = true;
  setDecisionEditable(false);
  syncLockPill();
  localStorage.setItem(STORAGE_KEYS.lock, "1");
  setNotesLocked(false);
  saveDraft();
  updateStats();
  renderHistory();
  toast(`Saved #${record.decisionNo} · ${record.ticker} · ${record.outcome}`);
}
function newDecision() {
  clearInterval(timer.tickId);
  timerReset(true);
  el.lockDecision.checked = false;
  localStorage.setItem(STORAGE_KEYS.lock, "0");
  setDecisionEditable(true);
  syncLockPill();
  [
    el.ticker, el.qualificationScore, el.riskPlanReference, el.thesis, el.outcomeNotes,
    el.plannedEntry, el.plannedStop, el.plannedTarget
  ].forEach((node) => node.value = "");
  [el.qualificationDecision, el.plannedSession, el.followedPlan, el.passCorrect, el.invalidationValid, el.timingQuality, el.emotionInterference, el.takeAgain].forEach((node) => node.value = "");
  el.decisionNo.value = nextDecisionNumber();
  el.date.value = nowLocalISODate();
  el.session.value = inferSession();
  el.catalyst.value = "Operational Update";
  el.marketState.value = "Unclear";
  el.maxRisk.value = "50";
  setOutcome("");
  setNotesLocked(true);
  updateCharCounter();
  updateDerivedMetrics();
  saveDraft();
  toast(`New Decision #${el.decisionNo.value}`);
}
function deleteCurrentDecision() {
  const decisionNo = normalizeDecisionNo(el.decisionNo.value);
  if (!decisionNo) return alert("No Decision # to delete.");
  const decisions = readJSON(STORAGE_KEYS.decisions, []);
  const index = decisions.findIndex((item) => item.decisionNo === decisionNo);
  if (index < 0) return alert(`Decision #${decisionNo} not found.`);
  if (!confirm(`Delete Decision #${decisionNo}?`)) return;
  decisions.splice(index, 1);
  writeJSON(STORAGE_KEYS.decisions, decisions);
  if (decisions.length) applyRecordToForm(decisions[0]);
  else newDecision();
  updateStats();
  renderHistory();
  toast(`Deleted #${decisionNo}`);
}
function clearAll() {
  if (!confirm("Clear all saved decisions, draft, and counter?")) return;
  Object.values(STORAGE_KEYS).forEach((key) => {
    if (key !== STORAGE_KEYS.theme) localStorage.removeItem(key);
  });
  ensureSeedData();
  setCounter(0);
  timerReset(false);
  el.lockDecision.checked = false;
  setDecisionEditable(true);
  syncLockPill();
  seedFreshDecision();
  updateStats();
  renderHistory();
  setNotesLocked(true);
  toast("Cleared everything");
}
function resetAutoCounter() {
  const decisions = readJSON(STORAGE_KEYS.decisions, []);
  const maxSaved = decisions.reduce((max, item) => {
    const n = parseInt(normalizeDecisionNo(item.decisionNo), 10);
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
  const choice = prompt(`Reset Auto Decision #\n\nType A to auto-sync to highest saved decision (${pad(maxSaved, 4)})\nType M to manually set the next decision #.`);
  if (!choice) return;
  if (choice.trim().toUpperCase() === "A") {
    setCounter(maxSaved);
    if (!el.lockDecision.checked) el.decisionNo.value = pad(getCounter() + 1, 4);
    saveDraft();
    return toast(`Auto # synced to ${pad(maxSaved, 4)}`);
  }
  if (choice.trim().toUpperCase() === "M") {
    const raw = prompt("Enter the NEXT decision # you want (e.g. 0001 or 12):");
    if (!raw) return;
    const next = parseInt(normalizeDecisionNo(raw), 10);
    if (!Number.isFinite(next) || next <= 0) return alert("Invalid number.");
    setCounter(next - 1);
    if (!el.lockDecision.checked) el.decisionNo.value = pad(next, 4);
    saveDraft();
    return toast(`Next auto # set to ${pad(next, 4)}`);
  }
  alert("Please enter A or M.");
}
function updateDerivedMetrics() {
  const entry = parseFloat(el.plannedEntry.value);
  const stop = parseFloat(el.plannedStop.value);
  const target = parseFloat(el.plannedTarget.value);
  const stopDistance = Number.isFinite(entry) && Number.isFinite(stop) ? Math.abs(entry - stop) : NaN;
  const targetDistance = Number.isFinite(entry) && Number.isFinite(target) ? Math.abs(target - entry) : NaN;
  const roughR = Number.isFinite(stopDistance) && stopDistance > 0 && Number.isFinite(targetDistance) ? targetDistance / stopDistance : NaN;
  el.stopDistance.textContent = Number.isFinite(stopDistance) ? stopDistance.toFixed(4) : "—";
  el.targetDistance.textContent = Number.isFinite(targetDistance) ? targetDistance.toFixed(4) : "—";
  el.roughR.textContent = Number.isFinite(roughR) ? roughR.toFixed(2) : "—";
}
function updateStats() {
  const decisions = readJSON(STORAGE_KEYS.decisions, []);
  el.statSaved.textContent = String(decisions.length);
  el.statLastDur.textContent = localStorage.getItem(STORAGE_KEYS.lastDuration) || "—";
  let taken = 0, passed = 0, invalid = 0;
  decisions.forEach((item) => {
    if (item.outcome === "Taken") taken += 1;
    else if (item.outcome === "Passed") passed += 1;
    else if (item.outcome === "Invalidated") invalid += 1;
  });
  el.statTaken.textContent = String(taken);
  el.statPassed.textContent = String(passed);
  el.statInvalid.textContent = String(invalid);
}
function reviewSignal(record) {
  if (record.followedPlan === "No" || record.emotionInterference === "High") return "Review needed";
  if (record.followedPlan === "Yes" && record.takeAgain === "Yes") return "High quality";
  if (record.timingQuality) return `Timing: ${record.timingQuality}`;
  return record.outcome || "No review";
}
function renderHistory() {
  const decisions = readJSON(STORAGE_KEYS.decisions, []);
  if (!decisions.length) {
    el.historyList.innerHTML = `<article class="history-item"><div class="history-title">No saved decisions yet.</div><div class="history-meta"><span>Use Save to create your first archive entry.</span></div></article>`;
    return;
  }
  el.historyList.innerHTML = decisions.slice(0, 24).map((record) => `
    <article class="history-item" data-decision="${record.decisionNo}">
      <div class="history-top">
        <div class="history-title">#${record.decisionNo} · ${record.ticker || "—"}</div>
        <span class="history-chip ${String(record.outcome || "").toLowerCase()}">${record.outcome || "—"}</span>
      </div>
      <div class="history-meta">
        <span>${record.date || "—"}</span>
        <span>${record.decisionDurationHms || "—"}</span>
        <span>${reviewSignal(record)}</span>
      </div>
    </article>
  `).join("");
  el.historyList.querySelectorAll(".history-item[data-decision]").forEach((item) => {
    item.addEventListener("click", () => {
      const found = decisions.find((record) => record.decisionNo === item.dataset.decision);
      if (found) {
        applyRecordToForm(found);
        saveDraft();
        updateDerivedMetrics();
        toast(`Loaded Decision #${found.decisionNo}`);
      }
    });
  });
}
function showHistoryPrompt() {
  const decisions = readJSON(STORAGE_KEYS.decisions, []);
  if (!decisions.length) return alert("No saved decisions yet.");
  const lines = decisions.slice(0, 35).map((record) => `#${record.decisionNo} | ${record.date || ""} | ${(record.ticker || "").padEnd(6, " ")} | ${record.outcome || ""} | ${record.decisionDurationHms || "—"} | ${reviewSignal(record)}`);
  const pick = prompt(`History (most recent first)\n\n${lines.join("\n")}\n\nEnter Decision # to load:`);
  if (!pick) return;
  const decisionNo = normalizeDecisionNo(pick);
  const found = decisions.find((record) => record.decisionNo === decisionNo);
  if (!found) return alert("Decision not found.");
  applyRecordToForm(found);
  saveDraft();
  renderHistory();
}
function buildCopyText(data) {
  const duration = localStorage.getItem(STORAGE_KEYS.lastDuration) || "";
  return [
    "Trade Execution Journal",
    "",
    `Decision #: ${data.decisionNo || ""}`,
    `Date: ${data.date || ""}`,
    `Ticker: ${data.ticker || ""}`,
    `Qualification: ${data.qualificationDecision || ""}`,
    data.qualificationScore ? `Qualification Score: ${data.qualificationScore}` : "",
    data.riskPlanReference ? `Risk Plan Ref: ${data.riskPlanReference}` : "",
    `Session: ${data.session || ""}`,
    `Catalyst: ${data.catalyst || ""}`,
    `Market Context: ${data.marketState || ""}`,
    `Outcome: ${data.outcome || ""}`,
    `Thesis: ${data.thesis || ""}`,
    data.outcomeNotes ? `Review Notes: ${data.outcomeNotes}` : "",
    data.followedPlan ? `Followed Plan: ${data.followedPlan}` : "",
    data.timingQuality ? `Timing Quality: ${data.timingQuality}` : "",
    data.emotionInterference ? `Emotion Interference: ${data.emotionInterference}` : "",
    data.takeAgain ? `Take Again: ${data.takeAgain}` : "",
    duration ? `Decision Duration: ${duration}` : ""
  ].filter(Boolean).join("\n");
}
async function copyDecision() {
  try {
    await navigator.clipboard.writeText(buildCopyText(currentFormData()));
    toast("Copied");
  } catch {
    alert("Copy failed. Clipboard access may be blocked.");
  }
}
function ensureCurrentDecisionSaved() {
  const decisions = readJSON(STORAGE_KEYS.decisions, []);
  const data = currentFormData();
  if (!hasMeaningfulContent(data)) return;
  if (!data.decisionNo) {
    data.decisionNo = nextDecisionNumber();
    el.decisionNo.value = data.decisionNo;
  }
  if (!data.date) {
    data.date = nowLocalISODate();
    el.date.value = data.date;
  }
  if (!data.session) {
    data.session = inferSession();
    el.session.value = data.session;
  }
  const duration = timerStopAndReturn();
  const record = { ...data, savedAt: new Date().toISOString(), decisionDurationSeconds: duration.seconds, decisionDurationHms: duration.hms };
  const index = decisions.findIndex((item) => item.decisionNo === record.decisionNo);
  if (index >= 0) decisions[index] = record;
  else decisions.unshift(record);
  writeJSON(STORAGE_KEYS.decisions, decisions);
  updateStats();
  renderHistory();
}
function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
function exportJSON() {
  ensureCurrentDecisionSaved();
  const payload = { exportedAt: new Date().toISOString(), decisions: readJSON(STORAGE_KEYS.decisions, []) };
  download(`trade_execution_journal_${nowLocalISODate()}.json`, JSON.stringify(payload, null, 2), "application/json");
}
function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function exportCSV() {
  ensureCurrentDecisionSaved();
  const decisions = readJSON(STORAGE_KEYS.decisions, []);
  const headers = ["decisionNo","date","ticker","qualificationDecision","qualificationScore","plannedSession","riskPlanReference","session","catalyst","marketState","thesis","outcome","outcomeNotes","followedPlan","passCorrect","invalidationValid","timingQuality","emotionInterference","takeAgain","plannedEntry","plannedStop","plannedTarget","maxRisk","decisionDurationSeconds","decisionDurationHms","savedAt"];
  const rows = [headers.join(",")];
  decisions.forEach((record) => {
    rows.push(headers.map((header) => csvEscape(record[header])).join(","));
  });
  download(`trade_execution_journal_${nowLocalISODate()}.csv`, rows.join("\n"), "text/csv");
}
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
