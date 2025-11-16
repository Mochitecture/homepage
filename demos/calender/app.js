/*
  File: /demos/calender/app.js
  Role:
    - Schedule – Week View デモの挙動
  Pattern:
    1. 設定
    2. 状態
    3. DOM 参照
    4. Utils
    5. Render
    6. Events
    7. Init
  Notes:
    - localStorage を使った「ON/OFF」の簡易スケジュール保存
    - まずは 1 週間固定（週送りなどは将来拡張で対応）
*/

//// 1. 設定 ------------------------------------------------------

// 30分刻み
const CAL_STEP_MIN = 30;
const CAL_SLOTS_PER_DAY = (24 * 60) / CAL_STEP_MIN; // 48
const CAL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CAL_LS_KEY = "mochitecture_cal_week_v1";


//// 2. 状態 ------------------------------------------------------

/**
 * 状態：
 * - busy[dayIndex] = Set(slotIndex)
 */
const calState = {
  busy: Array.from({ length: CAL_DAYS.length }, () => new Set()),
};


//// 3. DOM 参照 --------------------------------------------------

const calGridEl = document.getElementById("cal-grid");


//// 4. Utils ----------------------------------------------------

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(CAL_LS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.busy)) return;

    parsed.busy.forEach((slots, dayIdx) => {
      if (!Array.isArray(slots) || !calState.busy[dayIdx]) return;
      calState.busy[dayIdx] = new Set(slots);
    });
  } catch (e) {
    console.warn("[calender] failed to load state", e);
  }
}

function saveToStorage() {
  try {
    const serialized = {
      busy: calState.busy.map((set) => Array.from(set)),
    };
    localStorage.setItem(CAL_LS_KEY, JSON.stringify(serialized));
  } catch (e) {
    console.warn("[calender] failed to save state", e);
  }
}

function formatTimeLabel(slotIndex) {
  const minutes = slotIndex * CAL_STEP_MIN;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}


//// 5. Render ---------------------------------------------------

function renderGrid() {
  if (!calGridEl) return;

  const frag = document.createDocumentFragment();

  // ヘッダー行
  const headerRow = document.createElement("div");
  headerRow.className = "cal-row--header";

  const timeHead = document.createElement("div");
  timeHead.className = "cal-cell--time-head";
  timeHead.textContent = "Time";
  headerRow.appendChild(timeHead);

  CAL_DAYS.forEach((label) => {
    const dayHead = document.createElement("div");
    dayHead.className = "cal-cell--day-head";
    dayHead.textContent = label;
    headerRow.appendChild(dayHead);
  });

  frag.appendChild(headerRow);

  // 時間行（0:00〜23:30）
  for (let slot = 0; slot < CAL_SLOTS_PER_DAY; slot++) {
    const row = document.createElement("div");
    row.className = "cal-row";

    const timeCell = document.createElement("div");
    timeCell.className = "cal-cell--time";
    timeCell.textContent = formatTimeLabel(slot);
    row.appendChild(timeCell);

    for (let dayIdx = 0; dayIdx < CAL_DAYS.length; dayIdx++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cal-cell";
      cell.dataset.dayIndex = String(dayIdx);
      cell.dataset.slotIndex = String(slot);

      if (calState.busy[dayIdx]?.has(slot)) {
        cell.classList.add("is-busy");
      }

      row.appendChild(cell);
    }

    frag.appendChild(row);
  }

  calGridEl.innerHTML = "";
  calGridEl.appendChild(frag);
}


//// 6. Events ---------------------------------------------------

function handleCellClick(evt) {
  const target = evt.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.classList.contains("cal-cell")) return;

  const dayIndex = Number(target.dataset.dayIndex ?? "-1");
  const slotIndex = Number(target.dataset.slotIndex ?? "-1");
  if (
    Number.isNaN(dayIndex) ||
    Number.isNaN(slotIndex) ||
    !calState.busy[dayIndex]
  ) {
    return;
  }

  const set = calState.busy[dayIndex];
  if (set.has(slotIndex)) {
    set.delete(slotIndex);
    target.classList.remove("is-busy");
  } else {
    set.add(slotIndex);
    target.classList.add("is-busy");
  }

  saveToStorage();
}

function bindEvents() {
  if (calGridEl) {
    calGridEl.addEventListener("click", handleCellClick);
  }

  // もし既存コードでイベントがあればここに移植
  // TODO: 既存 calender のイベントハンドラがあればこの関数内に統合
}


//// 7. Init -----------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  loadFromStorage();
  renderGrid();
  bindEvents();
});
