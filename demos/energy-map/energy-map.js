// ===== energy-map.js =====

(function () {
  const state = {
    date: null,
    timeIndex: 0, // 0-47 (30min 刻み)
    area: null, // 'hokkaido' 等
    areaLabel: null,
    market: 'eprx', // 'eprx' | 'jepx'
    menu: null,
    view: 'graph', // 'graph' | 'table'
  };

  const MARKET_MENUS = {
    eprx: [
      { value: 'primary', label: '一次調整力' },
      { value: 'secondary1', label: '二次調整力①' },
      { value: 'secondary2', label: '二次調整力②' },
      { value: 'tertiary1', label: '三次調整力①' },
      { value: 'tertiary2', label: '三次調整力②' },
    ],
    jepx: [
      { value: 'spot', label: 'スポット市場' },
      { value: 'intraday', label: '時間前市場' },
    ],
  };

  document.addEventListener('DOMContentLoaded', () => {
    setupDateTimeControls();
    setupAreaMap();
    setupMarketPanel();
    refreshAll();
  });

  // ===== Date / Time =====
  function setupDateTimeControls() {
    const dateInput = document.getElementById('dateInput');
    const range = document.getElementById('timeRange');
    const label = document.getElementById('timeLabel');
    const nowBtn = document.getElementById('timeNowBtn');

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    state.date = todayStr;
    dateInput.value = todayStr;

    // デフォルトは 0:00
    state.timeIndex = 0;
    range.value = '0';
    updateTimeLabel(label, state.timeIndex);

    dateInput.addEventListener('change', () => {
      state.date = dateInput.value || todayStr;
      refreshSnapshot();
      refreshMarketMeta();
    });

    range.addEventListener('input', () => {
      state.timeIndex = Number(range.value);
      updateTimeLabel(label, state.timeIndex);
      refreshSnapshot();
      refreshMarketMeta();
    });

    nowBtn.addEventListener('click', () => {
      const now = new Date();
      const idx = now.getHours() * 2 + (now.getMinutes() >= 30 ? 1 : 0);
      state.timeIndex = idx;
      range.value = String(idx);
      updateTimeLabel(label, idx);

      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const nowStr = `${y}-${m}-${d}`;
      state.date = nowStr;
      dateInput.value = nowStr;

      refreshSnapshot();
      refreshMarketMeta();
    });
  }

  function updateTimeLabel(el, idx) {
    const h = Math.floor(idx / 2);
    const m = idx % 2 === 0 ? '00' : '30';
    el.textContent = `${String(h).padStart(2, '0')}:${m}`;
  }

  // ===== Area Map =====
  function setupAreaMap() {
    const svg = document.getElementById('japanMap');
    if (!svg) return;

    const blocks = Array.from(svg.querySelectorAll('.area-block'));
    const labelEl = document.getElementById('selectedAreaLabel');

    blocks.forEach((g) => {
      g.addEventListener('click', () => {
        const area = g.getAttribute('data-area');
        const label = g.getAttribute('data-label');

        state.area = area;
        state.areaLabel = label;

        blocks.forEach((b) => b.classList.remove('is-active'));
        g.classList.add('is-active');

        if (labelEl) labelEl.textContent = label;
        refreshSnapshot();
        refreshMarketMeta();
      });
    });

    // デフォルトで東北を選択
    const defaultBlock = svg.querySelector('[data-area="tohoku"]');
    if (defaultBlock) {
      defaultBlock.dispatchEvent(new Event('click'));
    }
  }

  // ===== Market Panel =====
  function setupMarketPanel() {
    const marketSelect = document.getElementById('marketSelect');
    const menuSelect = document.getElementById('menuSelect');
    const viewButtons = document.querySelectorAll('.market-view-toggle .btn-switch');

    if (!marketSelect || !menuSelect) return;

    // 初期メニュー
    state.market = marketSelect.value || 'eprx';
    populateMenuOptions(state.market);

    marketSelect.addEventListener('change', () => {
      state.market = marketSelect.value;
      populateMenuOptions(state.market);
      refreshMarketMeta();
      refreshMarketPlaceholder();
    });

    menuSelect.addEventListener('change', () => {
      state.menu = menuSelect.value;
      refreshMarketMeta();
      refreshMarketPlaceholder();
    });

    viewButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (!view) return;

        state.view = view;
        viewButtons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        refreshMarketPlaceholder();
      });
    });
  }

  function populateMenuOptions(market) {
    const menuSelect = document.getElementById('menuSelect');
    if (!menuSelect) return;

    const menus = MARKET_MENUS[market] || [];
    menuSelect.innerHTML = '';

    menus.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.value;
      opt.textContent = m.label;
      menuSelect.appendChild(opt);
    });

    if (menus.length > 0) {
      state.menu = menus[0].value;
    } else {
      state.menu = null;
    }
  }

  function refreshMarketMeta() {
    const metaEl = document.getElementById('marketMeta');
    if (!metaEl) return;

    const areaLabel = state.areaLabel || '--エリア';
    const timeStr = timeIndexToLabel(state.timeIndex);
    const dateStr = state.date || '--/--/--';

    const marketLabel =
      state.market === 'jepx' ? '卸電力市場（JEPX）' : '需給調整市場（EPRX）';

    const menuObj = (MARKET_MENUS[state.market] || []).find(
      (m) => m.value === state.menu,
    );
    const menuLabel = menuObj ? menuObj.label : 'メニュー未選択';

    metaEl.textContent = `${areaLabel} / ${dateStr} ${timeStr}  ｜  ${marketLabel}・${menuLabel}`;
  }

  function refreshMarketPlaceholder() {
    const el = document.getElementById('marketPlaceholder');
    if (!el) return;

    const menuObj = (MARKET_MENUS[state.market] || []).find(
      (m) => m.value === state.menu,
    );
    const menuLabel = menuObj ? menuObj.label : 'メニュー未選択';

    if (state.market === 'jepx') {
      // JEPX は枠だけ（データは使わない）
      const isGraph = state.view === 'graph';
      el.innerHTML = [
        'Frame only / JEPX',
        '<br>',
        '卸電力市場（JEPX）の価格などの実データは、利用条件に従いこのビューでは表示しません。',
        'ここでは、<strong>',
        menuLabel,
        '</strong> に対してグラフ／テーブルの構成だけを検討するステップとしています。',
        isGraph
          ? '<br>ビューモード：Graph（架空データを後から差し替える想定）'
          : '<br>ビューモード：Table（列構成のみ先に設計）',
      ].join('');
    } else {
      // EPRX：実データを将来的に入れる前提
      const isGraph = state.view === 'graph';
      el.innerHTML = [
        'Frame only / EPRX',
        '<br>',
        '需給調整市場（EPRX）の <strong>',
        menuLabel,
        '</strong> に関する指標を、',
        isGraph ? '時系列グラフ' : 'テーブル',
        'で眺めるためのビュー。',
        '今はまだダミーの枠のみを実装し、データの差し込み方や指標セットを検討する段階。',
      ].join('');
    }
  }

  // ===== Snapshot（ダミー） =====
  function refreshSnapshot() {
    const metaEl = document.getElementById('snapshotMeta');
    const reserveEl = document.getElementById('snapshotReserve');
    const demandEl = document.getElementById('snapshotDemand');
    const weatherEl = document.getElementById('snapshotWeather');
    const tempEl = document.getElementById('snapshotTemp');

    const areaLabel = state.areaLabel || '--エリア';
    const date = state.date || '--/--/--';
    const time = timeIndexToLabel(state.timeIndex);

    if (metaEl) {
      metaEl.textContent = `${areaLabel} / ${date} ${time}（ダミー値）`;
    }

    // ざっくりしたダミー計算：エリアと時間から少しだけ変化させる
    const hash = hashString(`${state.area || 'x'}-${state.timeIndex}`);
    const reserve = 5 + (hash % 20); // 5〜24%
    const demand = 1000 + (hash % 8000); // 1,000〜8,999 MW
    const temp = 5 + (hash % 25); // 5〜29 ℃
    const weatherList = ['晴れ', 'くもり', '雨', '雪'];
    const weather = weatherList[hash % weatherList.length];

    if (reserveEl) reserveEl.textContent = `${reserve.toFixed(0)} %`;
    if (demandEl) demandEl.textContent = `${demand.toLocaleString()} MW`;
    if (tempEl) tempEl.textContent = `${temp.toFixed(1)} ℃`;
    if (weatherEl) weatherEl.textContent = weather;
  }

  function timeIndexToLabel(idx) {
    const h = Math.floor(idx / 2);
    const m = idx % 2 === 0 ? '00' : '30';
    return `${String(h).padStart(2, '0')}:${m}`;
  }

  function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  function refreshAll() {
    refreshSnapshot();
    refreshMarketMeta();
    refreshMarketPlaceholder();
  }
})();
