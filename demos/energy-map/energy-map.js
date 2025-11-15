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
  // SVG の data-area="kyusyu" に合わせる
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
  date: null,              // Market Panel用に選択された日付
  snapshotDate: null,      // ページ読込時の実際の日付
  snapshotTimeLabel: null, // ページ読込時の実際の時刻
  market: 'eprx',
  menu: 'primary',
  view: 'graph'
};

const EM_DEBUG = false; // 必要なら true に

document.addEventListener('DOMContentLoaded', () => {
  const dateInput    = document.getElementById('em-date');

  const areaLabel    = document.getElementById('em-area-label');
  const snapshotMeta = document.getElementById('em-snapshot-meta');
  const marketMeta   = document.getElementById('em-market-meta');

  const marketSelect = document.getElementById('em-market-select');
  const menuSelect   = document.getElementById('em-menu-select');

  const viewButtons  = document.querySelectorAll('.seg-btn');
  const viewTitle    = document.getElementById('em-market-view-title');
  const viewBody     = document.getElementById('em-market-view-body');

  if (EM_DEBUG) console.log('[EnergyMap] DOMContentLoaded');

  // ★ 「現在時刻」のスナップショット情報を保持
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const snapshotDate = `${yyyy}-${mm}-${dd}`;
  const snapshotSlot = Math.floor(now.getHours() * 2 + now.getMinutes() / 30);

  state.snapshotDate = snapshotDate;
  state.snapshotTimeLabel = slotToLabel(snapshotSlot);

  // Market Panel 用の日付（初期値は「今日」）
  dateInput.value = snapshotDate;
  state.date = dateInput.value;

  // ===== SVG ファイルを fetch してインライン挿入 =====
  const mapContainer = document.getElementById('em-map-inline');
  if (mapContainer) {
    fetch('/demos/energy-map/JP-EnergyAreas.svg')
      .then(res => {
        if (!res.ok) throw new Error('SVG fetch failed: ' + res.status);
        return res.text();
      })
      .then(svgText => {
        // 中身をそのまま挿入
        mapContainer.innerHTML = svgText;
  
        // ルート <svg> を取得してクラスを付加（サイズ指定用）
        const svgEl = mapContainer.querySelector('svg');
        if (svgEl) {
          svgEl.classList.add('jp-energy-map');
          // ★ SVG 内の <title> 要素をすべて削除（ブラウザのツールチップを消す）
          svgEl.querySelectorAll('title').forEach(t => t.remove());
        }
  
        const areaElems = mapContainer.querySelectorAll('.jp-area');
        // 念のため title 属性も消す
        areaElems.forEach(el => el.removeAttribute('title'));
  
        if (EM_DEBUG) console.log('[EnergyMap] .jp-area count:', areaElems.length);
  
        wireAreaEvents(
          areaElems,
          areaLabel,
          snapshotMeta,
          marketMeta,
          viewTitle,
          viewBody
        );
      })
      .catch(err => {
        console.error('[EnergyMap] SVG load error:', err);
      });
  }


  // 日付変更（Market Panel 用）
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

      if (marketView) {
        marketView.classList.toggle('is-graph', view === 'graph');
        marketView.classList.toggle('is-table', view === 'table');
      }

      updateMarketPlaceholder(viewTitle, viewBody);
    });
  });

  // 初期メニューセット
  populateMenu(menuSelect, state.market);
  state.menu = menuSelect.value;

  // 初期ビュー状態
  if (marketView) {
    marketView.classList.add('is-graph');
  }

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

    // ★ ここで付けていた tabindex / role / aria-label / keypress を削除
    //    → マウス（タップ）専用のインタラクションにする
    // node.setAttribute('tabindex', '0');
    // node.setAttribute('role', 'button');
    // if (id) {
    //   node.setAttribute('aria-label', getAreaLabel(id));
    // }

    node.addEventListener('mouseenter', () => {
      if (EM_DEBUG) console.log('[EnergyMap] mouseenter:', id);
    });

    const handleSelect = () => {
      if (!id) return;
      if (EM_DEBUG) console.log('[EnergyMap] select area:', id);
      state.area = id;
      updateActiveArea(areaNodes, id);
      updateMeta(areaLabel, snapshotMeta, marketMeta);
      updateMarketPlaceholder(viewTitle, viewBody);
    };

    node.addEventListener('click', handleSelect);
  });
}

function updateActiveArea(nodes, activeId){
  nodes.forEach(p => {
    const id = p.dataset.area || p.id;
    p.classList.toggle('is-active', id === activeId);
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

  // Area ラベル（カード右上）
  if (areaLabelEl) {
    areaLabelEl.textContent = areaText;
  }

  // Now Snapshot メタ
  if (snapshotMetaEl) {
    const textEl = snapshotMetaEl.querySelector('.em-meta-text') || snapshotMetaEl;
    if (state.snapshotDate && state.snapshotTimeLabel) {
      textEl.textContent =
        `${areaText} ｜ ${state.snapshotDate} ${state.snapshotTimeLabel} 現在のスナップショット（ダミー値）`;
    } else {
      textEl.textContent =
        `${areaText} ｜ 現在時刻のスナップショット（ダミー値）`;
    }
  }

  // Market Panel メタ（時間表現は出さない）
  if (marketMetaEl) {
    const textEl = marketMetaEl.querySelector('.em-meta-text') || marketMetaEl;

    const marketText = state.market === 'eprx'
      ? '需給調整市場（EPRX）'
      : '卸電力市場（JEPX）';

    const menuText = (menusByMarket[state.market] || [])
      .find(m => m.value === state.menu)?.label || '';

    const dateText = state.date || '-';

    textEl.textContent =
      `${areaText} ｜ ${dateText} ｜ ${marketText} - ${menuText}`;
  }
}
