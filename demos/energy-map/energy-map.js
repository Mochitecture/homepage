// ===== Energy Map basic interactions =====

const state = {
  area: 'Tokyo',
  date: null,
  slot: 0, // 30分刻み 0〜47
  market: 'none',
  menu: 'none',
  view: 'graph'
};

function formatSlotToTime(slot) {
  const minutes = slot * 30;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${m === 0 ? '00' : '30'}`;
}

function setTodayAndNow() {
  const now = new Date();
  const dateInput = document.getElementById('dateInput');
  const timeSlider = document.getElementById('timeSlider');

  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  dateInput.value = `${yyyy}-${mm}-${dd}`;
  state.date = dateInput.value;

  const minutes = now.getHours() * 60 + now.getMinutes();
  const slot = Math.round(minutes / 30);
  const clamped = Math.max(0, Math.min(47, slot));
  timeSlider.value = clamped;
  state.slot = clamped;

  document.getElementById('timeLabel').textContent = formatSlotToTime(clamped);
}

function updateSnapshotMeta() {
  const label = document.getElementById('selectedAreaLabel').textContent;
  const timeStr = formatSlotToTime(state.slot);
  const dateStr = state.date || '(日付未選択)';
  const meta = document.getElementById('snapshotMeta');
  meta.textContent = `${label}・${dateStr} ${timeStr} 時点の代表値（ダミー表示中）`;
}

function updateMarketMeta() {
  const marketMeta = document.getElementById('marketMeta');
  if (state.market === 'none') {
    marketMeta.textContent =
      '表示する市場とメニューを選ぶと、この枠にグラフ／テーブルを配置予定。';
    return;
  }
  const marketName =
    document.querySelector('#marketSelect option:checked').textContent;
  const menuName =
    document.querySelector('#menuSelect option:checked')?.textContent || '';
  marketMeta.textContent = `${marketName} / ${
    menuName || 'メニュー未選択'
  } の可視化枠（UIのみ実装中）`;
}

function updateMarketPlaceholder() {
  const placeholder = document.getElementById('marketPlaceholder');

  if (state.market === 'none') {
    placeholder.innerHTML =
      '<strong>まだ市場が選択されていません。</strong>' +
      '<p>まずは「市場」プルダウンから EPRX などの市場を選択してください。</p>';
    return;
  }

  if (state.market === 'eprx') {
    const menuLabel =
      document.querySelector('#menuSelect option:checked')?.textContent || '';
    placeholder.innerHTML =
      `<strong>ビュー: ${
        state.view === 'graph' ? 'Graph' : 'Table'
      }（EPRX / ${menuLabel || 'メニュー未選択'}）</strong>` +
      '<p>ここには EPRX 公開データ（一次〜三次②）の時系列グラフや表を配置予定です。' +
      '現段階では、出典・ライセンス条件の整理が完了し次第、段階的にデータ連携を追加します。</p>';
  } else if (state.market.startsWith('jepx')) {
    placeholder.innerHTML =
      '<strong>JEPX データは枠のみ先に用意しています。</strong>' +
      '<p>価格・出来高などの数値は、JEPX の利用条件上ここでは表示しません。' +
      '必要に応じて公式サイトへのリンクやテキスト解説のみを配置する予定です。</p>';
  }
}

function populateMenuOptions() {
  const select = document.getElementById('menuSelect');
  select.innerHTML = '';
  select.disabled = state.market === 'none';

  if (state.market === 'none') {
    const opt = document.createElement('option');
    opt.value = 'none';
    opt.textContent = '（市場を先に選択）';
    select.appendChild(opt);
    state.menu = 'none';
    return;
  }

  const menusByMarket = {
    eprx: [
      { value: 'primary', label: '一次調整力' },
      { value: 'secondary1', label: '二次調整力①' },
      { value: 'secondary2', label: '二次調整力②' },
      { value: 'tertiary1', label: '三次調整力①' },
      { value: 'tertiary2', label: '三次調整力②' }
    ],
    'jepx-spot': [
      { value: 'system-price', label: 'システムプライス' },
      { value: 'area-price', label: 'エリア別価格' }
    ],
    'jepx-intraday': [
      { value: 'ohlc', label: '30分ごとのOHLC' },
      { value: 'volume', label: '約定量' }
    ]
  };

  const list = menusByMarket[state.market] || [];
  if (list.length === 0) {
    const opt = document.createElement('option');
    opt.value = 'none';
    opt.textContent = '（この市場のメニューは後日追加）';
    select.appendChild(opt);
    state.menu = 'none';
    return;
  }

  list.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.value;
    opt.textContent = item.label;
    select.appendChild(opt);
  });

  state.menu = list[0].value;
}

// ===== init =====
document.addEventListener('DOMContentLoaded', () => {
  setTodayAndNow();
  updateSnapshotMeta();
  updateMarketMeta();
  updateMarketPlaceholder();

  // エリア選択
  const areaGrid = document.getElementById('areaGrid');
  const areaLabel = document.getElementById('selectedAreaLabel');
  areaGrid.addEventListener('click', e => {
    const btn = e.target.closest('.energy-map-region');
    if (!btn) return;

    areaGrid
      .querySelectorAll('.energy-map-region')
      .forEach(el => el.classList.remove('is-active'));
    btn.classList.add('is-active');
    state.area = btn.dataset.area;
    const jp = btn.firstChild.textContent.trim();
    areaLabel.textContent = jp + 'エリア';
    updateSnapshotMeta();
  });

  // 日付
  document.getElementById('dateInput').addEventListener('change', e => {
    state.date = e.target.value || null;
    updateSnapshotMeta();
  });

  // 時刻スライダー
  document.getElementById('timeSlider').addEventListener('input', e => {
    const slot = Number(e.target.value);
    state.slot = slot;
    document.getElementById('timeLabel').textContent = formatSlotToTime(slot);
    updateSnapshotMeta();
  });

  // 現在時刻へ
  document.getElementById('btnNow').addEventListener('click', () => {
    setTodayAndNow();
    updateSnapshotMeta();
  });

  // 市場選択
  document.getElementById('marketSelect').addEventListener('change', e => {
    state.market = e.target.value;
    populateMenuOptions();
    updateMarketMeta();
    updateMarketPlaceholder();
  });

  // メニュー選択
  document.getElementById('menuSelect').addEventListener('change', e => {
    state.menu = e.target.value;
    updateMarketMeta();
    updateMarketPlaceholder();
  });

  // ビューモード
  document
    .querySelectorAll('.market-view-toggle button')
    .forEach(btn => {
      btn.addEventListener('click', () => {
        document
          .querySelectorAll('.market-view-toggle button')
          .forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        state.view = btn.dataset.view;
        updateMarketPlaceholder();
      });
    });
});
