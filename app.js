const STORAGE_KEY = "lift-sheet-531-v1";
const BACKUP_FORMAT = "531-lift-sheet";
const KG_PER_LB = 0.45359237;
const LIFTS = [
  { id: "squat", name: "Squat" },
  { id: "bench", name: "Bench" },
  { id: "deadlift", name: "Deadlift" },
  { id: "press", name: "Press" },
];
const WEEKS = [
  [[65, "5"], [75, "5"], [85, "5+"]],
  [[70, "3"], [80, "3"], [90, "3+"]],
  [[75, "5"], [85, "3"], [95, "1+"]],
  [[40, "5"], [50, "5"], [60, "5"]],
];

const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

function isValidWeek(value) { return Number.isInteger(value) && value >= 0 && value < WEEKS.length; }

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") return null;
    const maxesKg = {};
    for (const lift of LIFTS) {
      const value = saved.maxesKg?.[lift.id];
      if (typeof value === "number" && Number.isFinite(value) && value > 0) maxesKg[lift.id] = value;
    }
    return {
      unit: saved.unit === "lb" ? "lb" : "kg",
      maxesKg,
      trainingMaxPercent: Number.isFinite(saved.trainingMaxPercent) && saved.trainingMaxPercent > 0 && saved.trainingMaxPercent <= 100 ? saved.trainingMaxPercent : 90,
      theme: saved.theme === "light" || saved.theme === "dark" ? saved.theme : systemTheme,
      activeWeek: isValidWeek(saved.activeWeek) ? saved.activeWeek : 0,
    };
  } catch {
    return null;
  }
}

const state = loadState() ?? { unit: "kg", maxesKg: {}, trainingMaxPercent: 90, theme: systemTheme, activeWeek: 0 };

const inputs = [...document.querySelectorAll("[data-lift]")];
const unitButtons = [...document.querySelectorAll("[data-unit]")];
const weekButtons = [...document.querySelectorAll("[data-week]")];
const themeButtons = [...document.querySelectorAll("[data-theme-choice]")];
const viewButtons = [...document.querySelectorAll("[data-view]")];
const liftList = document.getElementById("lift-list");
const saveStatus = document.getElementById("save-status");
const percentInput = document.getElementById("training-percent");
const backupStatus = document.getElementById("backup-status");
const importFile = document.getElementById("import-file");
const estimateWeight = document.getElementById("estimate-weight");
const estimateReps = document.getElementById("estimate-reps");
const estimateLift = document.getElementById("estimate-lift");
const useEstimate = document.getElementById("use-estimate");
const estimateStatus = document.getElementById("estimate-status");
let calculatorUnit = state.unit;

function inCurrentUnit(kg) { return state.unit === "kg" ? kg : kg / KG_PER_LB; }
function inKg(value) { return state.unit === "kg" ? value : value * KG_PER_LB; }
function format(value) { return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, ""); }
function displayMax(kg) { return format(Math.round(inCurrentUnit(kg) * 10) / 10); }
function workingWeight(kg) {
  const increment = state.unit === "kg" ? 2.5 : 5;
  return Math.round(inCurrentUnit(kg) / increment) * increment;
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saveStatus.textContent = "Saved on this device";
  } catch {
    saveStatus.textContent = "Local saving unavailable";
  }
}

function backupData() {
  return {
    format: BACKUP_FORMAT,
    version: 1,
    unit: state.unit,
    maxesKg: { ...state.maxesKg },
    trainingMaxPercent: state.trainingMaxPercent,
    theme: state.theme,
    activeWeek: state.activeWeek,
  };
}

function parseBackup(data) {
  if (!data || typeof data !== "object" || Array.isArray(data) || data.format !== BACKUP_FORMAT || data.version !== 1) throw new Error("Invalid backup");
  if (data.unit !== "kg" && data.unit !== "lb") throw new Error("Invalid unit");
  if (data.theme !== "light" && data.theme !== "dark") throw new Error("Invalid theme");
  if (Object.hasOwn(data, "activeWeek") && !isValidWeek(data.activeWeek)) throw new Error("Invalid week");
  if (!Number.isFinite(data.trainingMaxPercent) || data.trainingMaxPercent <= 0 || data.trainingMaxPercent > 100) throw new Error("Invalid training max");
  if (!data.maxesKg || typeof data.maxesKg !== "object" || Array.isArray(data.maxesKg)) throw new Error("Invalid maxes");
  const maxesKg = {};
  for (const lift of LIFTS) {
    if (!Object.hasOwn(data.maxesKg, lift.id)) continue;
    const value = data.maxesKg[lift.id];
    if (!Number.isFinite(value) || value <= 0) throw new Error("Invalid max");
    maxesKg[lift.id] = value;
  }
  return { unit: data.unit, maxesKg, trainingMaxPercent: data.trainingMaxPercent, theme: data.theme, activeWeek: data.activeWeek ?? state.activeWeek };
}

function setBackupStatus(message, error = false) {
  backupStatus.textContent = message;
  backupStatus.dataset.error = String(error);
  backupStatus.hidden = false;
}

function setView(view) {
  for (const button of viewButtons) {
    const selected = button.dataset.view === view;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
    document.getElementById(`${button.dataset.view}-panel`).hidden = !selected;
  }
}

function renderSettings() {
  for (const input of inputs) {
    const kg = state.maxesKg[input.dataset.lift];
    input.value = kg ? displayMax(kg) : "";
    input.removeAttribute("aria-invalid");
  }
  document.querySelectorAll(".field-unit").forEach((el) => { el.textContent = state.unit; });
  unitButtons.forEach((button) => {
    const selected = button.dataset.unit === state.unit;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  percentInput.value = format(state.trainingMaxPercent);
  document.getElementById("display-unit").textContent = state.unit;
  renderCalculator();
}

function estimatedMax() {
  const weight = Number(estimateWeight.value.trim().replace(",", "."));
  const reps = Number(estimateReps.value.trim());
  if (!Number.isFinite(weight) || weight <= 0 || !Number.isInteger(reps) || reps < 1 || reps > 10) return null;
  const max = Math.round((reps === 1 ? weight : weight * (1 + reps / 30)) * 10) / 10;
  return Number.isFinite(max) && max > 0 ? max : null;
}

function renderCalculator() {
  const rawWeight = estimateWeight.value.trim().replace(",", ".");
  const weight = Number(rawWeight);
  if (calculatorUnit !== state.unit) {
    if (Number.isFinite(weight) && weight > 0) {
      estimateWeight.value = displayMax(calculatorUnit === "kg" ? weight : weight * KG_PER_LB);
    }
    calculatorUnit = state.unit;
  }
  const rawReps = estimateReps.value.trim();
  const reps = Number(rawReps);
  estimateWeight.setAttribute("aria-invalid", String(rawWeight !== "" && (!Number.isFinite(weight) || weight <= 0)));
  estimateReps.setAttribute("aria-invalid", String(rawReps !== "" && (!Number.isInteger(reps) || reps < 1 || reps > 10)));
  const max = estimatedMax();
  document.getElementById("estimate-result").textContent = max === null ? "—" : `${format(max)} ${state.unit}`;
  useEstimate.disabled = max === null;
  estimateStatus.hidden = true;
}

[estimateWeight, estimateReps].forEach((input) => input.addEventListener("input", renderCalculator));
estimateLift.addEventListener("change", () => { estimateStatus.hidden = true; });
useEstimate.addEventListener("click", () => {
  const max = estimatedMax();
  if (max === null) return;
  const lift = LIFTS.find((lift) => lift.id === estimateLift.value);
  if (!lift) return;
  state.maxesKg[lift.id] = inKg(max);
  renderSettings();
  renderResults();
  save();
  estimateStatus.textContent = `Used ${format(max)} ${state.unit} as ${lift.name} max.`;
  estimateStatus.hidden = false;
});

function renderTheme() {
  document.documentElement.dataset.theme = state.theme;
  document.querySelector('meta[name="theme-color"]').content = state.theme === "dark" ? "#1b201c" : "#f4f4f1";
  themeButtons.forEach((button) => {
    const selected = button.dataset.themeChoice === state.theme;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function renderResults() {
  weekButtons.forEach((button) => {
    const selected = Number(button.dataset.week) === state.activeWeek;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (selected) document.getElementById("week-panel").setAttribute("aria-labelledby", button.id);
  });
  document.getElementById("empty-hint").hidden = Object.keys(state.maxesKg).length > 0;

  liftList.innerHTML = LIFTS.map((lift) => {
    const maxKg = state.maxesKg[lift.id];
    const tmKg = maxKg ? maxKg * state.trainingMaxPercent / 100 : null;
    const sets = WEEKS[state.activeWeek].map(([percent, reps]) => {
      const weight = tmKg ? format(workingWeight(tmKg * percent / 100)) : "—";
      return `<div class="set-cell"><span class="set-weight">${weight}</span><span class="set-meta">×${reps}</span></div>`;
    }).join("");
    return `<article class="lift-row" aria-label="${lift.name}"><div class="lift-info"><span class="lift-name">${lift.name}</span></div>${sets}</article>`;
  }).join("");
}

viewButtons.forEach((button, index) => {
  button.addEventListener("click", () => setView(button.dataset.view));
  button.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const next = viewButtons[(index + direction + viewButtons.length) % viewButtons.length];
    next.focus();
    setView(next.dataset.view);
  });
});
document.querySelector("[data-open-settings]").addEventListener("click", () => setView("settings"));

inputs.forEach((input) => input.addEventListener("input", () => {
  const raw = input.value.trim().replace(",", ".");
  const value = Number(raw);
  const valid = raw !== "" && Number.isFinite(value) && value > 0;
  if (valid) state.maxesKg[input.dataset.lift] = inKg(value);
  else delete state.maxesKg[input.dataset.lift];
  input.setAttribute("aria-invalid", String(raw !== "" && !valid));
  save();
  renderResults();
}));

unitButtons.forEach((button) => button.addEventListener("click", () => {
  if (state.unit === button.dataset.unit) return;
  state.unit = button.dataset.unit;
  renderSettings();
  renderResults();
  save();
}));

percentInput.addEventListener("input", () => {
  const raw = percentInput.value.trim().replace(",", ".");
  const value = Number(raw);
  const valid = raw !== "" && Number.isFinite(value) && value > 0 && value <= 100;
  percentInput.setAttribute("aria-invalid", String(!valid));
  if (!valid) return;
  state.trainingMaxPercent = value;
  save();
  renderResults();
});
percentInput.addEventListener("blur", () => {
  if (percentInput.getAttribute("aria-invalid") === "true") percentInput.value = format(state.trainingMaxPercent);
  percentInput.removeAttribute("aria-invalid");
});

function setWeek(week) {
  state.activeWeek = week;
  renderResults();
  save();
}

weekButtons.forEach((button, index) => {
  button.addEventListener("click", () => setWeek(Number(button.dataset.week)));
  button.addEventListener("keydown", (event) => {
    let nextIndex;
    if (event.key === "ArrowLeft") nextIndex = (index + weekButtons.length - 1) % weekButtons.length;
    else if (event.key === "ArrowRight") nextIndex = (index + 1) % weekButtons.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = weekButtons.length - 1;
    else return;
    event.preventDefault();
    const next = weekButtons[nextIndex];
    next.focus();
    setWeek(Number(next.dataset.week));
  });
});

themeButtons.forEach((button) => button.addEventListener("click", () => {
  state.theme = button.dataset.themeChoice;
  renderTheme();
  save();
}));

document.getElementById("export-button").addEventListener("click", () => {
  try {
    const blob = new Blob([JSON.stringify(backupData(), null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `531-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setBackupStatus("Backup downloaded.");
  } catch {
    setBackupStatus("Could not export backup.", true);
  }
});

document.getElementById("import-button").addEventListener("click", () => importFile.click());
importFile.addEventListener("change", async () => {
  const file = importFile.files?.[0];
  if (!file) return;
  try {
    if (file.size > 100_000) throw new Error("File too large");
    const imported = parseBackup(JSON.parse(await file.text()));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(imported));
    Object.assign(state, imported);
    renderSettings();
    renderTheme();
    renderResults();
    saveStatus.textContent = "Saved on this device";
    setBackupStatus("Backup imported.");
  } catch {
    setBackupStatus("Could not import this backup.", true);
  } finally {
    importFile.value = "";
  }
});

renderSettings();
renderTheme();
renderResults();
