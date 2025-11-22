/**
 * /demos/sun-dome/app.js
 * Pattern: Demo JS Pattern
 * Structure: config → state → DOM → util → API → render → location → init
 */

(() => {
  // ------------------------------------------------------------
  // 1. Config
  // ------------------------------------------------------------
  const API_BASE = 'https://mochitecture-sun-api.onrender.com';

  const CONFIG = {
    refreshIntervalMs: 60 * 1000, // 1分ごとに再取得
    dome: { cx: 100, cy: 110, r: 90 }
  };

  // ------------------------------------------------------------
  // 2. State
  // ------------------------------------------------------------
  const state = {
    lat: null,
    lon: null,
    elevationDeg: null,
    azimuthDeg: null,
    sunrise: null,
    sunset: null,
    lastError: null
  };

  // ------------------------------------------------------------
  // 3. DOM references
  // ------------------------------------------------------------
  const dom = {
    location: document.getElementById('sunLocation'),
    localTime: document.getElementById('sunLocalTime'),
    localDate: document.getElementById('sunLocalDate'),
    elevation: document.getElementById('sunElevation'),
    azimuth: document.getElementById('sunAzimuth'),
    sunrise: document.getElementById('sunSunrise'),
    sunset: document.getElementById('sunSunset'),
    message: document.getElementById('sunMessage'),
    refreshBtn: document.getElementById('sunRefreshBtn'),
    sunDot: document.getElementById('sunDot'),
    sunPath: document.getElementById('sunPath')
  };

  // ------------------------------------------------------------
  // 4. Utilities
  // ------------------------------------------------------------
  const pad2 = (n) => String(n).padStart(2, '0');

  const toRad = (deg) => (deg * Math.PI) / 180;

  function formatTime(date) {
    if (!date) return '--:--';
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  function formatDate(date) {
    if (!date) return '--------';
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
      date.getDate()
    )}`;
  }

  // 16 方位に丸めて日本語の方角にする
  function azimuthToDirection(azDeg) {
    if (azDeg == null || isNaN(azDeg)) return '--';

    const dirs = [
      '北', '北北東', '北東', '東北東',
      '東', '東南東', '南東', '南南東',
      '南', '南南西', '南西', '西南西',
      '西', '西北西', '北西', '北北西'
    ];

    const normalized = ((azDeg % 360) + 360) % 360;
    const index = Math.round(normalized / 22.5) % 16;
    return dirs[index];
  }

  // ローカル日付 → "YYYY-MM-DD"
  function toLocalDateStr(date) {
    return [
      date.getFullYear(),
      pad2(date.getMonth() + 1),
      pad2(date.getDate())
    ].join('-');
  }

  // ------------------------------------------------------------
  // 5. API calls
  // ------------------------------------------------------------

  // クライアント側タイムゾーン（例: Asia/Tokyo）
  const CLIENT_TZ =
    (Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo');

  async function apiGet(path, params) {
    const query = new URLSearchParams(params);
    const url = `${API_BASE}${path}?${query.toString()}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`API ${path} failed: ${res.status}`);
    }
    return res.json();
  }

  function apiSun(lat, lon, localDate) {
    // localDate の瞬間を ISO（UTC）で送り、tz でローカルを伝える
    return apiGet('/sun', {
      lat,
      lon,
      dt: localDate.toISOString(),
      tz: CLIENT_TZ
    });
  }

  function apiSunriseSunset(lat, lon, localDate) {
    return apiGet('/sunrise_sunset', {
      lat,
      lon,
      date: toLocalDateStr(localDate),
      tz: CLIENT_TZ
    });
  }

  function apiSunpath(lat, lon, localDate) {
    return apiGet('/sunpath', {
      lat,
      lon,
      date: toLocalDateStr(localDate),
      tz: CLIENT_TZ,
      step_minutes: 10
    });
  }

  // ------------------------------------------------------------
  // 6. SVG projection
  // ------------------------------------------------------------

  function projectToDome(elevDeg, azDeg) {
    const { cx, cy, r } = CONFIG.dome;

    const elev = Math.max(-5, Math.min(90, elevDeg));
    const elevRad = toRad(elev);

    // 南を基準にした方位角（0° = 南）
    const azFromSouthDeg = (azDeg - 180 + 360) % 360;
    const az = toRad(azFromSouthDeg);

    const horizontalR = r * Math.cos(elevRad);

    return {
      x: cx + horizontalR * Math.sin(az),
      y: cy - r * Math.sin(elevRad)
    };
  }

  function buildPath(points) {
    if (!points || points.length === 0) return '';

    return points
      .map((p, i) => {
        const pos = projectToDome(p.elevation, p.azimuth);
        const cmd = i === 0 ? 'M' : 'L';
        return `${cmd} ${pos.x.toFixed(1)} ${pos.y.toFixed(1)}`;
      })
      .join(' ');
  }

  // ------------------------------------------------------------
  // 7. Render
  // ------------------------------------------------------------

  function renderStatic(date) {
    // 日付・時刻は常に更新
    if (dom.localTime) dom.localTime.textContent = formatTime(date);
    if (dom.localDate) dom.localDate.textContent = formatDate(date);

    if (state.lat == null || state.lon == null) {
      if (dom.location) dom.location.textContent = '位置情報を取得できていません';
      if (dom.elevation) dom.elevation.textContent = '-- °';
      if (dom.azimuth) dom.azimuth.textContent = '-- °';
      if (dom.sunrise) dom.sunrise.textContent = '--:--';
      if (dom.sunset) dom.sunset.textContent = '--:--';
      if (dom.message) {
        dom.message.textContent =
          state.lastError ||
          'ブラウザの位置情報許可をオンにすると、現在地ベースで描画します。';
      }
      return false;
    }

    if (dom.location) {
      dom.location.textContent = `${state.lat.toFixed(4)}°, ${state.lon.toFixed(
        4
      )}°`;
    }

    return true;
  }

  async function updateAndRender(date = new Date()) {
    const canRender = renderStatic(date);
    if (!canRender) return;

    try {
      const [sun, ss, path] = await Promise.all([
        apiSun(state.lat, state.lon, date),
        apiSunriseSunset(state.lat, state.lon, date),
        apiSunpath(state.lat, state.lon, date)
      ]);

      // 太陽位置
      state.elevationDeg = sun.elevation;
      state.azimuthDeg = sun.azimuth;

      if (dom.elevation) {
        dom.elevation.textContent = `${sun.elevation.toFixed(1)} °`;
      }

      if (dom.azimuth) {
        const dir = azimuthToDirection(sun.azimuth);
        dom.azimuth.textContent = `${sun.azimuth.toFixed(1)} °（${dir}）`;
      }

      // 日の出・日の入り
      state.sunrise = ss.sunrise ? new Date(ss.sunrise) : null;
      state.sunset = ss.sunset ? new Date(ss.sunset) : null;

      if (dom.sunrise) dom.sunrise.textContent = formatTime(state.sunrise);
      if (dom.sunset) dom.sunset.textContent = formatTime(state.sunset);

      // ドーム上の現在位置
      const dot = projectToDome(sun.elevation, sun.azimuth);
      if (dom.sunDot) {
        dom.sunDot.setAttribute('cx', dot.x.toFixed(2));
        dom.sunDot.setAttribute('cy', dot.y.toFixed(2));
      }

      // 軌道
      if (dom.sunPath) {
        dom.sunPath.setAttribute('d', buildPath(path.points));
      }

      if (dom.message) {
        dom.message.textContent =
          'SPA ベースの Sun API から取得した太陽位置を表示しています。';
      }

      state.lastError = null;
    } catch (err) {
      console.error(err);
      state.lastError = '太陽データの取得に失敗しました。少し時間をおいて再度お試しください。';
      if (dom.message) dom.message.textContent = state.lastError;
    }
  }

  // ------------------------------------------------------------
  // 8. Location
  // ------------------------------------------------------------

  function requestLocation() {
    if (!navigator.geolocation) {
      state.lastError = 'このブラウザでは位置情報 API を利用できません。';
      if (dom.message) dom.message.textContent = state.lastError;
      return;
    }

    if (dom.message) dom.message.textContent = '位置情報を取得中...';

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.lat = pos.coords.latitude;
        state.lon = pos.coords.longitude;
        state.lastError = null;
        updateAndRender();
      },
      (err) => {
        console.error(err);
        state.lastError = '位置情報を取得できませんでした。';
        if (dom.message) dom.message.textContent = state.lastError;
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 60 * 1000
      }
    );
  }

  // ------------------------------------------------------------
  // 9. Init
  // ------------------------------------------------------------

  function init() {
    if (dom.refreshBtn) {
      dom.refreshBtn.addEventListener('click', requestLocation);
    }

    // 初期描画（位置情報未取得でも日付・時刻だけ表示）
    renderStatic(new Date());

    // 位置情報取得 → 取得できたら太陽データもまとめて更新
    requestLocation();

    // 一定間隔で更新（setInterval に直接 async 関数を渡さない）
    setInterval(() => {
      updateAndRender();
    }, CONFIG.refreshIntervalMs);
  }

  init();
})();
