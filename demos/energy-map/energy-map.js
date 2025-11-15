// ===== Energy Map JS =====

const areas = [
  { id: 'hokkaido', label: '北海道 / Hokkaido' },
  { id: 'tohoku',   label: '東北 / Tohoku' },
  { id: 'tokyo',    label: '東京 / Tokyo' },
  { id: 'hokuriku', label: '北陸 / Hokuriku' },
  { id: 'chubu',    label: '中部 / Chubu' },
  { id: 'kansai',   label: '関西 / Kansai' },
  { id: 'chugoku',  label: '中国 / Chugoku' },
  { id: 'shikoku',  label: '四国 / Shikoku' },
  // SVG の data-area="kyusyu" に合わせて id も kyusyu
  { id: 'kyusyu',   label: '九州 / Kyushu' }
];

const menusByMarket = {
  eprx: [
    { value: 'primary',    label: '一次調整力' },
    { value: 'secondary1', label: '二次調整力①' },
    { value: 'secondary2', label: '二次調整力②' },
    { value: 'tertiary1',  label: '三次調整力①' },
    { value: 'tertiary2',  label: '三次調整力②' }
  ],
  jepx: [
    { value: 'spot',     label: 'スポット市場' },
    { value: 'intraday', label: '時間前市場' }
  ]
};

const state = {
  area: 'hokuriku',
  date: null,
  slot: 0,
  market: 'eprx',
  menu: 'primary',
  view: 'graph'
};

// ログ ON/OFF 用
const EM_DEBUG = true;

// 外部 SVG 用に中へ注入するスタイル（同一オリジン想定）
const SVG_AREA_STYLE = `
  .jp-area {
    cursor: pointer;
  }

  .jp-area path,
  .jp-area polygon {
    stroke: rgba(0,0,0,.08);
    stroke-width: 2;
    transition: fill .15s ease, transform .12s ease, filter .12s ease;
  }

  .jp-area[data-area="hokkaido"] path { fill:#2f86d9; }
  .jp-area[data-area="tohoku"]  path { fill:#5675c7; }
  .jp-area[data-area="tokyo"]   path { fill:#3fb3d4; }
  .jp-area[data-area="hokuriku"] path { fill:#a6c930; }
  .jp-area[data-area="chubu"]   path { fill:#33a365; }
  .jp-area[data-area="kansai"]  path { fill:#f3b222; }
  .jp-area[data-area="chugoku"] path { fill:#f28a22; }
  .jp-area[data-area="shikoku"] path { fill:#f25b3f; }
  .jp-area[data-area="kyusyu"]  path { fill:#e1354f; }

  .jp-area:hover path,
  .jp-area:hover polygon {
    filter: brightness(1.05);
    transform: translateY(-2px);
  }

  .jp-area.is-active path,
  .jp-area.is-active polygon {
    stroke: #111827;
    stroke-width: 2.5;
    filter: brightness(1.12);
  }
`;

document.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('em-date');
  const timeSlider = document.getElementById('em-time-slider');
  const timeLabel  = document.getElementById('em-time-label');
  const nowBtn     = document.getElementById('em-now-btn');

  const areaLabel    = document.getElementById('em-area-label');
  const snapshotMeta = document.getElementById('em-snapshot-meta');
  const marketMeta   = document.getElementById('em-market-meta');

  const marketSelect = document.getElementById('em-market-select');
  const menuSelect   = document.getElementById('em-menu-select');

  const viewButtons  = document.querySelectorAll('.seg-btn');
  const viewTitle    = document.getElementById('em-market-view-title');
  const viewBody     = document.getElementById('em-market-view-body');

  if (EM_DEBUG) console.log('[EnergyMap] DOMContentLoaded');

  // 初期日付＆時間をセット
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  dateInput.value = `${yyyy}-${mm}-${dd}`;
  state.date = dateInput.value;

  const slot = Math.floor(now.getHours() * 2 + now.getMinutes() / 30);
  timeSlider.value = String(slot);
  state.slot = slot;
  timeLabel.textContent = slotToLabel(slot);

  // ===== エリア SVG クリック（外部 SVG / インライン両対応） =====
  const svgObject = document.getElementById('em-map-object');

  if (svgObject) {
    if (EM_DEBUG) console.log('[EnergyMap] <object id="em-map-object"> found');

    const bindSvg = () => {
      const svgDoc = svgObject.contentDocument;
      if (!svgDoc) {
        if (EM_DEBUG) console.warn('[EnergyMap] svgObject.contentDocument is null');
        return;
      }

      if (EM_DEBUG) {
        console.log('[EnergyMap] SVG loaded');
        console.log('[EnergyMap] svgDoc URL:', svgDoc.URL);
      }

      // スタイル注入
      const styleEl = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'style');
      styleEl.textContent = SVG_AREA_STYLE;

      const svgRoot = svgDoc.documentElement;
      if (svgRoot.firstChild) {
        svgRoot.insertBefore(styleEl, svgRoot.firstChild);
      } else {
        svgRoot.appendChild(styleEl);
      }

      const areaElems = svgDoc.querySelectorAll('.jp-area');
      if (EM_DEBUG) console.log('[EnergyMap] .jp-area count in SVG:', areaElems.length);

      wireAreaEvents(areaElems, areaLabel, snapshotMeta, marketMeta, viewTitle, viewBody);
    };

    if (svgObject.contentDocument) {
      // すでにロード済み
      bindSvg();
    } else {
      svgObject.addEventListener('load', () => {
        if (EM_DEBUG) console.log('[EnergyMap] <object> load event fired');
        bindSvg();
      });
    }
  } else {
    if (EM_DEBUG) console.warn('[EnergyMap] em-map-object not found, fallback to inline SVG');
    const areaElems = document.querySelectorAll('.jp-area');
    wireAreaEvents(areaElems, areaLabel, snapshotMeta, marketMeta, viewTitle, viewBody);
  }

  // 日付変更
  dateInput.addEventListener('change', () => {
    state.date = dateInput.value;
    updateMeta(areaLabel, snapshotMeta, marketMeta);
    updateMarketPlaceholder(viewTitle, viewBody);
  });

  // 時刻変更
  timeSlider.addEventListener('input', () => {
    const slot = Number(timeSlider.value);
    state.slot = slot;
    timeLabel.textContent = slotToLabel(slot);
    updateMeta(areaLabel, snapshotMeta, marketMeta);
    updateMarketPlaceholder(viewTitle, viewBody);
  });

  nowBtn.addEventListener('click', () => {
    const now = new Date();
    const slot = Math.floor(now.getHours() * 2 + now.getMinutes() / 30);
    timeSlider.value = String(slot);
    state.slot = slot;
    timeLabel.textContent = slotToLabel(slot);
    updateMeta(areaLabel, snapshotMeta, marketMeta);
    updateMarketPlaceholder(viewTitle, viewBody);
  });

  // 市場 / メニュー
  marketSelect.addEventListener('change', () => {
    state.market = marketSelect.value;
    populateMenu(menuSelect, state.market);
    state.menu = menuSelect.value;
    updateMeta(areaLabel, snapshotMeta, marketMeta);
    updateMarketPlaceholder(viewTitle, viewBody);
  });

  menuSelect.addEventListener('change', () => {
    state.menu = menuSelect.value;
    updateMeta(areaLabel, snapshotMeta, marketMeta);
    updateMarketPlaceholder(viewTitle, viewBody);
  });

  // ビュー切替
  viewButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      state.view = view;
      viewButtons.forEach(b => b.classList.toggle('is-active', b === btn));
      updateMarketPlaceholder(viewTitle, viewBody);
    });
  });

  // 初期メニューセット
  populateMenu(menuSelect, state.market);
  state.menu = menuSelect.value;
  updateMeta(areaLabel, snapshotMeta, marketMeta);
  updateMarketPlaceholder(viewTitle, viewBody);
});

/* ===== helpers ===== */

function slotToLabel(slot){
  const h = Math.floor(slot / 2);
  const m = (slot % 2) === 0 ? '00' : '30';
  return `${String(h).padStart(2,'0')}:${m}`;
}

function getAreaLabel(id){
  const found = areas.find(a => a.id === id);
  return found ? found.label : id;
}

// SVG 内のエリア要素に click / hover ハンドラをバインド
function wireAreaEvents(areaNodes, areaLabel, snapshotMeta, marketMeta, viewTitle, viewBody){
  if (!areaNodes || areaNodes.length === 0) {
    if (EM_DEBUG) console.warn('[EnergyMap] No .jp-area elements found');
    return;
  }

  if (EM_DEBUG) console.log('[EnergyMap] bind events to', areaNodes.length, 'jp-area nodes');

  // 初期状態の active を反映
  updateActiveArea(areaNodes, state.area);
  if (areaLabel) areaLabel.textContent = getAreaLabel(state.area);

  areaNodes.forEach(node => {
    const id = node.dataset.area || node.id;

    node.addEventListener('mouseenter', () => {
      if (EM_DEBUG) console.log('[EnergyMap] mouseenter:', id);
    });

    node.addEventListener('click', () => {
      if (!id) return;
      if (EM_DEBUG) console.log('[EnergyMap] click area:', id);
      state.area = id;
      updateActiveArea(areaNodes, id);
      updateMeta(areaLabel, snapshotMeta, marketMeta);
      updateMarketPlaceholder(viewTitle, viewBody);
    });
  });
}

function updateActiveArea(nodes, activeId){
  nodes.forEach(p => {
    p.classList.toggle('is-active', p.dataset.area === activeId);
  });
  const labelEl = document.getElementById('em-area-label');
  if (labelEl) labelEl.textContent = getAreaLabel(activeId);
}

function populateMenu(select, market){
  const options = menusByMarket[market] || [];
  select.innerHTML = '';
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    select.appendChild(o);
  });
}

function updateMeta(areaLabelEl, snapshotMetaEl, marketMetaEl){
  const areaText = getAreaLabel(state.area);
  const timeText = `${state.date} ${slotToLabel(state.slot)}`;

  areaLabelEl.textContent = areaText;
  snapshotMetaEl.textContent = `${areaText} / ${timeText}（ダミー値）`;

  const marketText = state.market === 'eprx'
    ? '需給調整市場（EPRX）'
    : '卸電力市場（JEPX）';

  const menuText = (menusByMarket[state.market] || [])
    .find(m => m.value === state.menu)?.label || '';

  marketMetaEl.textContent =
    `${areaText} / ${timeText}｜${marketText} - ${menuText}`;
}

function updateMarketPlaceholder(titleEl, bodyEl){
  const marketText = state.market === 'eprx'
    ? 'EPRX'
    : 'JEPX';

  const menuText = (menusByMarket[state.market] || [])
    .find(m => m.value === state.menu)?.label || '';

  const viewText = state.view === 'graph' ? '時系列グラフ' : 'テーブル';

  titleEl.textContent = `Frame only / ${marketText} - ${menuText}`;

  if (state.market === 'jepx') {
    bodyEl.textContent =
      `卸電力市場（JEPX）の「${menuText}」に関するビューの枠組みだけを先に用意している段階です。`
      + ` 実際の価格データは利用条件に従い、この画面では表示していません。`
      + ` 将来的には ${viewText} で指標を切り替えながら眺められる構成を想定しています。`;
  } else {
    bodyEl.textContent =
      `需給調整市場（EPRX）の「${menuText}」に関する指標を、${viewText} で眺めるためのビュー。`
      + ` いまはダミーの枠だけ実装し、後のフェーズで EPRX 公開データを読み込み、`
      + ` エリア別に比較できるインジケータ群を検討していきます。`;
  }
}
