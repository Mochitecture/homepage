/**
 * /demos/sun-dome/app.js
 * Sun API を叩いて NOW スナップショットを更新するだけの軽量版。
 * グラフ本体の描画は次フェーズで追加する。
 */
(() => {
  const API_BASE = 'https://mochitecture-sun-api.onrender.com';

  const CONFIG = {
    refreshIntervalMs: 60 * 1000
  };

  const state = {
    lat: null,
    lon: null
  };

  const dom = {
    metaText: document.getElementById('sun-meta-text'),
    location: document.getElementById('sun-location'),
    date: document.getElementById('sun-date'),
    time: document.getElementById('sun-time'),
    elev: document.getElementById('sun-elevation'),
    az: document.getElementById('sun-azimuth'),
    sunrise: document.getElementById('sun-sunrise'),
    sunset: document.getElementById('sun-sunset'),
    message: document.getElementById('sun-message'),
    chart: document.getElementById('sun-chart')
  };

  const pad2 = (n) => String(n).padStart(2, '0');

  function formatTime(date) {
    if (!date) return '--:--';
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  function formatDate(date) {
    if (!date) return '--------';
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function updateMeta(now) {
    if (state.lat == null || state.lon == null) {
      dom.metaText.textContent = '現在地取得中…';
      return;
    }
    const dateStr = formatDate(now);
    const timeStr = formatTime(now);
    dom.metaText.textContent =
      `${dateStr} ${timeStr} 現在 ｜ ` +
      `${state.lat.toFixed(4)}°, ${state.lon.toFixed(4)}°`;
  }

  // -----------------------------
  // API calls
  // -----------------------------

  async function apiSun(lat, lon, date) {
    const dt = date.toISOString();
    const url = `${API_BASE}/sun?lat=${lat}&lon=${lon}&dt=${encodeURIComponent(dt)}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('/sun error');
    return r.json();
  }

  async function apiSunriseSunset(lat, lon, date) {
    const dateStr = date.toISOString().slice(0, 10);
    const url = `${API_BASE}/sunrise_sunset?lat=${lat}&lon=${lon}&date=${dateStr}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('/sunrise_sunset error');
    return r.json();
  }

  // -----------------------------
  // Render
  // -----------------------------

  async function renderNow() {
    const now = new Date();

    dom.date.textContent = formatDate(now);
    dom.time.textContent = formatTime(now);
    updateMeta(now);

    if (state.lat == null || state.lon == null) {
      dom.location.textContent = '--, --';
      dom.message.textContent =
        'ブラウザの位置情報許可をオンにすると、現在地ベースで太陽位置を取得します。';
      return;
    }

    dom.location.textContent =
      `${state.lat.toFixed(4)}°, ${state.lon.toFixed(4)}°`;

    try {
      // 太陽位置
      const sun = await apiSun(state.lat, state.lon, now);
      dom.elev.textContent = `${sun.elevation.toFixed(1)} °`;
      dom.az.textContent = `${sun.azimuth.toFixed(1)} °`;

      // 日の出・日の入
      const ss = await apiSunriseSunset(state.lat, state.lon, now);
      const sunrise = ss.sunrise ? new Date(ss.sunrise) : null;
      const sunset = ss.sunset ? new Date(ss.sunset) : null;

      dom.sunrise.textContent = formatTime(sunrise);
      dom.sunset.textContent = formatTime(sunset);

      dom.message.textContent =
        'Sun API から取得した近似値です。天文観測などの正確な用途には使わないでください。';
    } catch (e) {
      console.error(e);
      dom.message.textContent = 'Sun API からの取得に失敗しました。';
      dom.elev.textContent = '-- °';
      dom.az.textContent = '-- °';
      dom.sunrise.textContent = '--:--';
      dom.sunset.textContent = '--:--';
    }
  }

  // -----------------------------
  // Geolocation
  // -----------------------------

  function requestLocation() {
    if (!navigator.geolocation) {
      dom.message.textContent = 'このブラウザでは位置情報 API を利用できません。';
      return;
    }

    dom.message.textContent = '位置情報を取得中…';

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.lat = pos.coords.latitude;
        state.lon = pos.coords.longitude;
        renderNow();
      },
      (err) => {
        console.warn(err);
        dom.message.textContent =
          '位置情報を取得できませんでした。ブラウザの設定を確認してください。';
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 60 * 1000
      }
    );
  }

  // -----------------------------
  // Init
  // -----------------------------

  function init() {
    requestLocation();
    renderNow(); // 初期描画（位置情報取得前でもメタだけ更新）

    setInterval(() => {
      renderNow();
    }, CONFIG.refreshIntervalMs);
  }

  init();
})();
