const STORAGE_KEY = "lift-sheet-531-v1";
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
    };
  } catch {
    return null;
  }
}

const state = loadState() ?? { unit: "kg", maxesKg: {}, trainingMaxPercent: 90, theme: systemTheme };
let activeWeek = 0;

const inputs = [...document.querySelectorAll("[data-lift]")];
const unitButtons = [...document.querySelectorAll("[data-unit]")];
const weekSelect = document.getElementById("week-select");
const themeButtons = [...document.querySelectorAll("[data-theme-choice]")];
const viewButtons = [...document.querySelectorAll("[data-view]")];
const liftList = document.getElementById("lift-list");
const saveStatus = document.getElementById("save-status");
const percentInput = document.getElementById("training-percent");

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
}

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
  weekSelect.value = String(activeWeek);
  document.getElementById("empty-hint").hidden = Object.keys(state.maxesKg).length > 0;

  liftList.innerHTML = LIFTS.map((lift) => {
    const maxKg = state.maxesKg[lift.id];
    const tmKg = maxKg ? maxKg * state.trainingMaxPercent / 100 : null;
    const sets = WEEKS[activeWeek].map(([percent, reps]) => {
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

weekSelect.addEventListener("change", () => {
  activeWeek = Number(weekSelect.value);
  renderResults();
});

themeButtons.forEach((button) => button.addEventListener("click", () => {
  state.theme = button.dataset.themeChoice;
  renderTheme();
  save();
}));

renderSettings();
renderTheme();
renderResults();
