/*
  File: /demos/energy-map/energy-map.js
  Role:
    - Energy Map デモの挙動
  Pattern:
    1. 設定
    2. 状態
    3. DOM 参照
    4. Utils
    5. Render
    6. Events
    7. Init
  Notes:
    - SVG のエリア hover / click と Market Panel の連動
    - 指標は当面ダミー値のまま（データ接続は将来フェーズ）
*/

//// 1. 設定 ------------------------------------------------------

const EM_DEFAULT_AREA = "tokyo"; // 例：デフォルトで東京エリアを選択


//// 2. 状態 ------------------------------------------------------

const emState = {
  selectedAreaId: EM_DEFAULT_AREA,
  // TODO: 必要ならここにダミーデータや設定を追加
};


//// 3. DOM 参照 --------------------------------------------------

let emMapObject;          // <object id="em-map">
let emMarketPanelEl;      // <div id="em-market-panel">
let emDataLicenseTableEl; // <div id="em-data-license-table">


//// 4. Utils ----------------------------------------------------

function getAreaLabel(areaId) {
  // TODO: 既存ロジックを移植（エリアID → 表示名）
  const mapping = {
    tokyo: "東京エリア",
    // ...
  };
  return mapping[areaId] || areaId;
}

function getDummyMetrics(areaId) {
  // TODO: 今はダミー指標。必要になったら既存の表現に差し替え
  return [
    { label: "Spot Price", value: "¥12.3 /kWh" },
    { label: "Demand", value: "12,345 MWh" },
    { label: "Weather", value: "曇り時々晴れ" },
  ];
}


//// 5. Render ---------------------------------------------------

function renderMarketPanel() {
  if (!emMarketPanelEl) return;
  const areaId = emState.selectedAreaId;

  const areaLabel = getAreaLabel(areaId);
  const metrics = getDummyMetrics(areaId);

  const frag = document.createDocumentFragment();

  const title = document.createElement("h3");
  title.textContent = areaLabel;
  title.className = "em-market-area-title";
  frag.appendChild(title);

  const list = document.createElement("dl");
  list.className = "em-market-metrics";

  metrics.forEach((m) => {
    const dt = document.createElement("dt");
    dt.textContent = m.label;

    const dd = document.createElement("dd");
    dd.textContent = m.value;

    list.appendChild(dt);
    list.appendChild(dd);
  });

  frag.appendChild(list);

  emMarketPanelEl.innerHTML = "";
  emMarketPanelEl.appendChild(frag);
}

function renderDataLicenseTable() {
  if (!emDataLicenseTableEl) return;

  // TODO: 実際の Data & License テーブル構造をここでレンダリング
  // ひとまずプレースホルダだけ置いておく
  const p = document.createElement("p");
  p.textContent = "Data & License テーブルは今後の検証結果に基づいて更新されます。";
  emDataLicenseTableEl.innerHTML = "";
  emDataLicenseTableEl.appendChild(p);
}


//// 6. Events ---------------------------------------------------

function handleAreaSelected(areaId) {
  emState.selectedAreaId = areaId;
  renderMarketPanel();
}

function bindSvgEvents(svgRoot) {
  if (!svgRoot) return;

  // TODO: 既存の hover / click ロジックをここに移植
  // 例：
  // const areas = svgRoot.querySelectorAll('[data-area-id]');
  // areas.forEach(el => {
  //   el.addEventListener('click', () => {
  //     handleAreaSelected(el.getAttribute('data-area-id'));
  //   });
  // });
}

function bindEvents() {
  if (emMapObject) {
    emMapObject.addEventListener("load", () => {
      const svgDoc = emMapObject.contentDocument;
      if (!svgDoc) return;
      const svgRoot = svgDoc.documentElement;
      bindSvgEvents(svgRoot);
    });
  }

  // TODO: Market Panel のメニュー（セレクトボックス等）があればここでバインド
}


//// 7. Init -----------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  emMapObject = document.getElementById("em-map");
  emMarketPanelEl = document.getElementById("em-market-panel");
  emDataLicenseTableEl = document.getElementById("em-data-license-table");

  renderMarketPanel();
  renderDataLicenseTable();
  bindEvents();
});
