const STORAGE_KEY = "topset.workouts.v1";
const TOPWEIGHT_STORAGE_KEY = "topweight.workouts.v1";
const LEGACY_STORAGE_KEY = "repkeep.workouts.v1";
const SPLIT_DAYS = [
  { id: "chest_back", label: "Chest + Back", shortLabel: "C/B" },
  { id: "arms", label: "Arms", shortLabel: "Arms" },
  { id: "legs", label: "Legs", shortLabel: "Legs" },
  { id: "rest", label: "Rest", shortLabel: "Rest" }
];

const state = {
  workouts: loadWorkouts(),
  chartMetric: "volume"
};

const els = {
  weekVolume: document.querySelector("#weekVolume"),
  weekDelta: document.querySelector("#weekDelta"),
  streakDays: document.querySelector("#streakDays"),
  totalWorkouts: document.querySelector("#totalWorkouts"),
  bestSet: document.querySelector("#bestSet"),
  workoutForm: document.querySelector("#workoutForm"),
  workoutDate: document.querySelector("#workoutDate"),
  workoutSplit: document.querySelector("#workoutSplit"),
  setBlock: document.querySelector("#setBlock"),
  movementsContainer: document.querySelector("#movementsContainer"),
  workoutNotes: document.querySelector("#workoutNotes"),
  formError: document.querySelector("#formError"),
  addMovementButton: document.querySelector("#addMovementButton"),
  loadLastButton: document.querySelector("#loadLastButton"),
  lastSessionView: document.querySelector("#lastSessionView"),
  useTodayButton: document.querySelector("#useTodayButton"),
  metricSelect: document.querySelector("#metricSelect"),
  progressChart: document.querySelector("#progressChart"),
  splitBoard: document.querySelector("#splitBoard"),
  historyList: document.querySelector("#historyList"),
  exportButton: document.querySelector("#exportButton"),
  importInput: document.querySelector("#importInput"),
  clearButton: document.querySelector("#clearButton"),
  installHelpButton: document.querySelector("#installHelpButton"),
  installDialog: document.querySelector("#installDialog")
};

function todayISO() {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 10);
}

function normalizeWorkout(workout) {
  const split = workout.split || "chest_back";
  const legacyMovement = workout.exercise
    ? [{ name: workout.exercise, sets: Array.isArray(workout.sets) ? workout.sets : [] }]
    : [];

  return {
    ...workout,
    split,
    exercise: workout.exercise || (split === "rest" ? "Rest" : "Session"),
    movements: Array.isArray(workout.movements) ? workout.movements : legacyMovement,
    sets: Array.isArray(workout.sets) ? workout.sets : []
  };
}

function loadWorkouts() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(TOPWEIGHT_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || "[]";
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.map(normalizeWorkout) : [];
  } catch {
    return [];
  }
}

function saveWorkouts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.workouts));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatDate(dateISO) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${dateISO}T12:00:00`));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getSplit(splitId) {
  return SPLIT_DAYS.find((split) => split.id === splitId) || SPLIT_DAYS[0];
}

function getWorkoutVolume(workout) {
  return (workout.movements || []).reduce((sessionTotal, movement) => {
    return sessionTotal + (movement.sets || []).reduce((movementTotal, set) => movementTotal + set.reps * set.weight, 0);
  }, 0);
}

function getWeekStart(date = new Date()) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function isInCurrentWeek(dateISO) {
  const date = new Date(`${dateISO}T12:00:00`);
  return date >= getWeekStart() && date <= new Date();
}

function getPreviousWeekBounds() {
  const currentStart = getWeekStart();
  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - 7);
  const previousEnd = new Date(currentStart);
  previousEnd.setDate(previousEnd.getDate() - 1);
  return { previousStart, previousEnd };
}

function getStreak() {
  const dates = new Set(state.workouts.map((workout) => workout.date));
  let cursor = new Date(`${todayISO()}T12:00:00`);
  let streak = 0;

  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function getBestSet() {
  const best = state.workouts
    .flatMap((workout) => (workout.movements || []).flatMap((movement) => (movement.sets || []).map((set) => ({ ...set, movement: movement.name }))))
    .sort((a, b) => b.weight - a.weight || b.reps - a.reps)[0];

  return best ? `${best.weight} x ${best.reps}` : "-";
}

function getNextSplitId() {
  const latest = [...state.workouts].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0];
  if (!latest) return SPLIT_DAYS[0].id;
  const currentIndex = Math.max(0, SPLIT_DAYS.findIndex((split) => split.id === latest.split));
  return SPLIT_DAYS[(currentIndex + 1) % SPLIT_DAYS.length].id;
}

function getLastSession(splitId) {
  return [...state.workouts]
    .filter((workout) => workout.split === splitId && workout.split !== "rest" && (workout.movements || []).length)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0];
}

function addSetRow(setsContainer, values = {}) {
  const row = document.createElement("div");
  const setNumber = setsContainer.querySelectorAll(".set-row").length + 1;
  row.className = "set-row";
  row.innerHTML = `
    <div class="set-number">${setNumber}</div>
    <label>
      <span>Reps</span>
      <input class="set-reps" inputmode="numeric" min="0" type="number" placeholder="8" />
    </label>
    <label>
      <span>Weight</span>
      <input class="set-weight" inputmode="decimal" min="0" step="0.5" type="number" placeholder="135" />
    </label>
    <button class="icon-button remove-set" type="button" data-action="remove-set" aria-label="Remove set">x</button>
  `;
  row.querySelector(".set-reps").value = values.reps ?? "";
  row.querySelector(".set-weight").value = values.weight ?? "";
  setsContainer.append(row);
}

function renumberSets(setsContainer) {
  [...setsContainer.querySelectorAll(".set-number")].forEach((node, index) => {
    node.textContent = String(index + 1);
  });
}

function addMovementCard(template = null) {
  const movementNumber = els.movementsContainer.querySelectorAll(".movement-card").length + 1;
  const card = document.createElement("article");
  card.className = "movement-card";
  card.innerHTML = `
    <div class="movement-heading">
      <label>
        <span>Movement ${movementNumber}</span>
        <input class="movement-name" type="text" placeholder="Type any movement" required />
      </label>
      <div class="movement-actions">
        <button class="ghost-button compact" type="button" data-action="add-set">Add set</button>
        <button class="ghost-button compact danger" type="button" data-action="remove-movement">Remove</button>
      </div>
    </div>
    <div class="sets-container"></div>
  `;
  els.movementsContainer.append(card);
  card.querySelector(".movement-name").value = template?.name || "";
  const setsContainer = card.querySelector(".sets-container");
  const setCount = Math.max(1, template?.sets?.length || 3);
  for (let index = 0; index < setCount; index += 1) {
    addSetRow(setsContainer);
  }
}

function renumberMovements() {
  [...els.movementsContainer.querySelectorAll(".movement-card")].forEach((card, index) => {
    card.querySelector("label span").textContent = `Movement ${index + 1}`;
  });
}

function resetMovements() {
  els.movementsContainer.innerHTML = "";
  addMovementCard();
}

function loadLastSessionIntoForm() {
  const lastSession = getLastSession(els.workoutSplit.value);
  if (!lastSession) return;
  els.movementsContainer.innerHTML = "";
  lastSession.movements.forEach((movement) => addMovementCard(movement));
  applySplitMode();
}

function applySplitMode() {
  const isRest = els.workoutSplit.value === "rest";
  els.setBlock.hidden = isRest;
  els.loadLastButton.hidden = isRest;
  [...els.movementsContainer.querySelectorAll(".movement-name")].forEach((input) => {
    input.required = !isRest;
  });
}

function collectMovements() {
  return [...els.movementsContainer.querySelectorAll(".movement-card")]
    .map((card) => {
      const name = card.querySelector(".movement-name").value.trim();
      const sets = [...card.querySelectorAll(".set-row")]
        .map((row) => ({
          reps: Number(row.querySelector(".set-reps").value),
          weight: Number(row.querySelector(".set-weight").value)
        }))
        .filter((set) => set.reps > 0 && set.weight >= 0);

      return { name, sets };
    })
    .filter((movement) => movement.name && movement.sets.length);
}

function renderSummary() {
  const trainingWorkouts = state.workouts.filter((workout) => workout.split !== "rest");
  const currentWeekVolume = state.workouts.filter((workout) => isInCurrentWeek(workout.date)).reduce((total, workout) => total + getWorkoutVolume(workout), 0);
  const { previousStart, previousEnd } = getPreviousWeekBounds();
  const previousWeekVolume = state.workouts
    .filter((workout) => {
      const date = new Date(`${workout.date}T12:00:00`);
      return date >= previousStart && date <= previousEnd;
    })
    .reduce((total, workout) => total + getWorkoutVolume(workout), 0);

  els.weekVolume.textContent = `${formatNumber(currentWeekVolume)} lb`;
  els.streakDays.textContent = `${getStreak()}d`;
  els.totalWorkouts.textContent = String(trainingWorkouts.length);
  els.bestSet.textContent = getBestSet();

  if (!state.workouts.length) {
    els.weekDelta.textContent = "Add every movement from the session before saving.";
  } else if (previousWeekVolume === 0) {
    els.weekDelta.textContent = `${getSplit(getNextSplitId()).label} is up next in your rotation.`;
  } else {
    const diff = Math.round(((currentWeekVolume - previousWeekVolume) / previousWeekVolume) * 100);
    els.weekDelta.textContent = diff >= 0 ? `Up ${diff}% from last week.` : `Down ${Math.abs(diff)}% from last week.`;
  }
}

function renderSplitBoard() {
  const nextSplitId = getNextSplitId();
  const selectedSplitId = els.workoutSplit.value || nextSplitId;
  els.splitBoard.innerHTML = SPLIT_DAYS.map((split, index) => {
    const splitWorkouts = state.workouts.filter((workout) => workout.split === split.id);
    const last = [...splitWorkouts].sort((a, b) => b.date.localeCompare(a.date))[0];
    const volume = splitWorkouts.reduce((total, workout) => total + getWorkoutVolume(workout), 0);
    const meta = split.id === "rest" ? `${splitWorkouts.length} logged` : `${formatNumber(volume)} lb`;
    const status = split.id === selectedSplitId ? "Selected" : split.id === nextSplitId ? "Up next" : last ? formatDate(last.date) : "Not logged";

    return `
      <button class="split-card ${split.id === nextSplitId ? "is-next" : ""} ${split.id === selectedSplitId ? "is-selected" : ""}" type="button" data-split="${split.id}">
        <span class="split-index">${index + 1}</span>
        <strong>${split.label}</strong>
        <p>${status}</p>
        <em>${meta}</em>
      </button>
    `;
  }).join("");
}

function renderLastSession() {
  if (els.workoutSplit.value === "rest") {
    els.lastSessionView.innerHTML = `<div class="history-empty">Rest day selected. Nothing to compare.</div>`;
    return;
  }

  const lastSession = getLastSession(els.workoutSplit.value);
  if (!lastSession) {
    els.lastSessionView.innerHTML = `<div class="history-empty">No previous ${escapeHtml(getSplit(els.workoutSplit.value).label)} session yet.</div>`;
    return;
  }

  els.lastSessionView.innerHTML = `
    <div class="last-session-meta">
      <span>${formatDate(lastSession.date)}</span>
      <strong>${formatNumber(getWorkoutVolume(lastSession))} lb</strong>
    </div>
    <div class="last-movement-list">
      ${lastSession.movements.map((movement, index) => `
        <article class="last-movement">
          <div class="last-movement-title">
            <span>${index + 1}</span>
            <strong>${escapeHtml(movement.name)}</strong>
          </div>
          <div class="set-chips">
            ${(movement.sets || []).map((set) => `<span class="set-chip">${set.reps} x ${set.weight}</span>`).join("")}
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function getEightWeekBuckets() {
  const buckets = [];
  const start = getWeekStart();
  start.setDate(start.getDate() - 49);

  for (let i = 0; i < 8; i += 1) {
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() + i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const workouts = state.workouts.filter((workout) => {
      const date = new Date(`${workout.date}T12:00:00`);
      return date >= weekStart && date <= weekEnd;
    });

    buckets.push({
      label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
      volume: workouts.reduce((total, workout) => total + getWorkoutVolume(workout), 0),
      workouts: workouts.filter((workout) => workout.split !== "rest").length
    });
  }

  return buckets;
}

function renderChart() {
  const canvas = els.progressChart;
  const ctx = canvas.getContext("2d");
  const buckets = getEightWeekBuckets();
  const values = buckets.map((bucket) => bucket[state.chartMetric]);
  const maxValue = Math.max(...values, 1);
  const width = canvas.width;
  const height = canvas.height;
  const padding = { top: 28, right: 24, bottom: 50, left: 54 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#081018";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(88, 178, 255, 0.26)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();

  ctx.fillStyle = "#8ea7b8";
  ctx.font = "24px Cascadia Mono, Consolas, monospace";
  ctx.textAlign = "right";
  ctx.fillText(formatNumber(maxValue), padding.left - 10, padding.top + 8);
  ctx.fillText("0", padding.left - 10, height - padding.bottom + 8);

  const barGap = 14;
  const barWidth = Math.max(24, chartWidth / values.length - barGap);

  values.forEach((value, index) => {
    const barHeight = Math.round((value / maxValue) * chartHeight);
    const x = padding.left + index * (chartWidth / values.length) + barGap / 2;
    const y = height - padding.bottom - barHeight;

    ctx.fillStyle = "#22a7ff";
    roundRect(ctx, x, y, barWidth, barHeight || 4, 8);
    ctx.fill();

    ctx.fillStyle = "#8ea7b8";
    ctx.font = "22px Aptos, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(buckets[index].label, x + barWidth / 2, height - 16);
  });
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function renderHistory() {
  if (!state.workouts.length) {
    els.historyList.innerHTML = `<div class="history-empty">No workouts logged yet. Save your first session and it will appear here.</div>`;
    return;
  }

  const sorted = [...state.workouts].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  els.historyList.innerHTML = sorted
    .map((workout) => {
      const split = getSplit(workout.split);
      const volume = workout.split === "rest" ? "rest day" : `${formatNumber(getWorkoutVolume(workout))} lb`;
      const movementSummary = (workout.movements || []).map((movement) => {
        const sets = (movement.sets || []).map((set) => `<span class="set-chip">${set.reps} x ${set.weight}</span>`).join("");
        return `
          <div class="movement-summary">
            <strong>${escapeHtml(movement.name)}</strong>
            <div class="set-chips">${sets}</div>
          </div>
        `;
      }).join("");
      const notes = workout.notes ? `<p class="history-notes">${escapeHtml(workout.notes)}</p>` : "";

      return `
        <article class="history-item">
          <div class="history-topline">
            <div>
              <span class="split-pill">${split.shortLabel}</span>
              <strong>${split.label}</strong>
            </div>
            <span>${formatDate(workout.date)} - ${volume}</span>
          </div>
          ${movementSummary}
          ${notes}
        </article>
      `;
    })
    .join("");
}

function renderAll() {
  renderSummary();
  renderSplitBoard();
  renderLastSession();
  renderChart();
  renderHistory();
}

function resetForm() {
  els.workoutNotes.value = "";
  els.workoutSplit.value = getNextSplitId();
  resetMovements();
  applySplitMode();
  renderSplitBoard();
  renderLastSession();
}

els.workoutForm.addEventListener("submit", (event) => {
  event.preventDefault();
  els.formError.textContent = "";

  const date = els.workoutDate.value;
  const split = els.workoutSplit.value;
  const movements = collectMovements();

  if (!date || !split || (split !== "rest" && !movements.length)) {
    els.formError.textContent = "Add a date, workout day, and at least one movement with completed sets.";
    return;
  }

  state.workouts.push({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    date,
    split,
    exercise: split === "rest" ? "Rest" : `${movements.length} movement session`,
    movements: split === "rest" ? [] : movements,
    sets: [],
    notes: els.workoutNotes.value.trim()
  });
  saveWorkouts();
  resetForm();
  renderAll();
});

els.addMovementButton.addEventListener("click", () => {
  addMovementCard();
});

els.loadLastButton.addEventListener("click", loadLastSessionIntoForm);

els.movementsContainer.addEventListener("click", (event) => {
  const action = event.target.dataset.action;
  if (!action) return;

  const card = event.target.closest(".movement-card");
  if (action === "add-set") {
    addSetRow(card.querySelector(".sets-container"));
  }

  if (action === "remove-set") {
    const setsContainer = event.target.closest(".sets-container");
    if (setsContainer.querySelectorAll(".set-row").length > 1) {
      event.target.closest(".set-row").remove();
      renumberSets(setsContainer);
    }
  }

  if (action === "remove-movement" && els.movementsContainer.querySelectorAll(".movement-card").length > 1) {
    card.remove();
    renumberMovements();
  }
});

els.useTodayButton.addEventListener("click", () => {
  els.workoutDate.value = todayISO();
});

els.workoutSplit.addEventListener("change", () => {
  applySplitMode();
  renderSplitBoard();
  renderLastSession();
});

els.splitBoard.addEventListener("click", (event) => {
  const card = event.target.closest("[data-split]");
  if (!card) return;
  els.workoutSplit.value = card.dataset.split;
  applySplitMode();
  renderSplitBoard();
  renderLastSession();
});

els.metricSelect.addEventListener("change", () => {
  state.chartMetric = els.metricSelect.value;
  renderChart();
});

els.exportButton.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), workouts: state.workouts }, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `topset-backup-${todayISO()}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

els.importInput.addEventListener("change", async () => {
  const file = els.importInput.files?.[0];
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());
    const workouts = Array.isArray(parsed) ? parsed : parsed.workouts;
    if (!Array.isArray(workouts)) throw new Error("Invalid backup");
    state.workouts = workouts.map(normalizeWorkout);
    saveWorkouts();
    renderAll();
  } catch {
    alert("That backup file could not be imported.");
  } finally {
    els.importInput.value = "";
  }
});

els.clearButton.addEventListener("click", () => {
  if (state.workouts.length && confirm("Clear every logged workout from this phone?")) {
    state.workouts = [];
    saveWorkouts();
    renderAll();
    resetForm();
  }
});

els.installHelpButton.addEventListener("click", () => {
  els.installDialog.showModal();
});

window.addEventListener("resize", renderChart);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js");
  });
}

els.workoutDate.value = todayISO();
els.workoutSplit.value = getNextSplitId();
resetMovements();
applySplitMode();
renderAll();
