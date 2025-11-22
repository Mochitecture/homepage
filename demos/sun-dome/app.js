/**
 * /demos/sun-dome/app.js
 * Pattern: Demo JS Pattern
 * Structure: config → state → DOM → util → render → events → init
 */

(() => {
  // ------------------------------------------------------------
  // 1. Config
  // ------------------------------------------------------------
  const CONFIG = {
    refreshIntervalMs: 60 * 1000, // 1分ごとに再描画
    dome: {
      cx: 100,
      cy: 110,
      r: 90
    }
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

  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;

  const pad2 = (n) => String(n).padStart(2, '0');

  function formatTime(date) {
    if (!date) return '--:--';
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  function dayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff =
      date - start +
      (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * 太陽赤緯の簡易近似（単純なサインカーブモデル）
   * δ ≈ 23.45° * sin(360° * (284 + n) / 365)
   */
  function solarDeclinationDeg(date) {
    const n = dayOfYear(date);
    const gamma = (2 * Math.PI * (n - 1)) / 365; // 0〜2π
    const decl =
      (180 / Math.PI) *
      (0.006918 -
        0.399912 * Math.cos(gamma) +
        0.070257 * Math.sin(gamma) -
        0.006758 * Math.cos(2 * gamma) +
        0.000907 * Math.sin(2 * gamma) -
        0.002697 * Math.cos(3 * gamma) +
        0.00148 * Math.sin(3 * gamma));
    return decl;
  }

  /**
   * 簡易的な太陽高度・方位角計算
   * - ローカル時刻を「太陽時」と近似（経度や均時差は無視）
   * - 方位角は南を基準として東西に展開（デモ用途）
   */
  function computeSolarPosition(latDeg, lonDeg, date) {
    const lat = toRad(latDeg);
    const declDeg = solarDeclinationDeg(date);
    const decl = toRad(declDeg);

    // ローカル時刻（0〜24h）
    const hours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;

    // 太陽時と近似し、12時を南中
    const hourAngleDeg = (hours - 12) * 15; // 1h = 15°
    const H = toRad(hourAngleDeg);

    // 太陽高度
    const sinH = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(H);
    const elevationRad = Math.asin(sinH);
    const elevationDeg = toDeg(elevationRad);

    // 太陽方位角（南基準）
    // cosA = (sinδ − sinh·sinφ) / (cosh·cosφ)
    let azimuthDeg;
    const cosAz =
      (Math.sin(decl) - Math.sin(elevationRad) * Math.sin(lat)) /
      (Math.cos(elevationRad) * Math.cos(lat));

    // 数値誤差のクリップ
    const cosAzClamped = Math.max(-1, Math.min(1, cosAz));
    let az = Math.acos(cosAzClamped); // 0〜π

    // H の符号で東西を判定
    if (H > 0) {
      // 午後 → 西側
      az = Math.PI + (Math.PI - az);
    } else {
      // 午前 → 東側
      az = Math.PI - az;
    }

    // 結果を 0〜360° に
    azimuthDeg = (toDeg(az) + 360) % 360;

    return {
      elevationDeg,
      azimuthDeg,
      declinationDeg: declDeg,
      hourAngleDeg
    };
  }

  /**
   * 日の出・日の入り時刻（簡易）
   * - cosH0 = -tanφ·tanδ から時角 H0 を求める
   * - H0 を ± に振り、12時±のローカル時刻とみなす
   */
  function computeSunriseSunset(latDeg, lonDeg, date) {
    const lat = toRad(latDeg);
    const declDeg = solarDeclinationDeg(date);
    const decl = toRad(declDeg);

    const cosH0 = -Math.tan(lat) * Math.tan(decl);

    if (cosH0 < -1 || cosH0 > 1) {
      // 終日昇っている or 終日沈んでいる
      return { sunrise: null, sunset: null };
    }

    const H0 = Math.acos(cosH0); // ラジアン
    const H0deg = toDeg(H0);

    const day = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      0,
      0,
      0,
      0
    );

    const tSolarNoon = 12; // 簡易：ローカル12時が南中
    const deltaHours = H0deg / 15; // 15° = 1h

    const sunriseHours = tSolarNoon - deltaHours;
    const sunsetHours = tSolarNoon + deltaHours;

    const sunrise = new Date(day.getTime() + sunriseHours * 3600 * 1000);
    const sunset = new Date(day.getTime() + sunsetHours * 3600 * 1000);

    return { sunrise, sunset };
  }

  /**
   * 半球ドーム上の座標へ変換
   * - altitude: 0〜90°
   * - azimuth: 0〜360° （南基準／前面）
   * ここでは：
   *   - 南 = 上（頂点）方向
   *   - 東西で左右に振る
   */
  function projectToDome(elevationDeg, azimuthDeg) {
    const { cx, cy, r } = CONFIG.dome;

    const elev = Math.max(-5, Math.min(90, elevationDeg)); // 少しだけ下も許容
    const altRad = toRad(elev);

    // 南基準に変換（南=0°）
    const azFromSouthDeg = (azimuthDeg - 180 + 360) % 360;
    const az = toRad(azFromSouthDeg);

    // 簡易投影：高さは alt、水平は cos(alt) * sin/cos(az)
    const horizontalRadius = r * Math.cos(altRad);
    const x = cx + horizontalRadius * Math.sin(az);
    const y = cy - r * Math.sin(altRad);

    return { x, y };
  }

  /**
   * 日の出〜日の入りの軌道を SVG Path で描く
   * - N=32程度のサンプル
   */
  function buildSunPath(latDeg, lonDeg, date, sunrise, sunset) {
    if (!sunrise || !sunset) return '';

    const N = 32;
    const parts = [];

    for (let i = 0; i <= N; i++) {
      const t =
        sunrise.getTime() +
        ((sunset.getTime() - sunrise.getTime()) * i) / N;
      const d = new Date(t);

      const pos = computeSolarPosition(latDeg, lonDeg, d);
      const { x, y } = projectToDome(pos.elevationDeg, pos.azimuthDeg);

      const cmd = i === 0 ? 'M' : 'L';
      parts.push(`${cmd} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }

    return parts.join(' ');
  }

  // ------------------------------------------------------------
  // 5. Render
  // ------------------------------------------------------------

  function renderNow(date = new Date()) {
    // 時刻
    dom.localTime.textContent = formatTime(date);

    if (state.lat == null || state.lon == null) {
      dom.location.textContent = '位置情報を取得できていません';
      dom.elevation.textContent = '-- °';
      dom.azimuth.textContent = '-- °';
      dom.sunrise.textContent = '--:--';
      dom.sunset.textContent = '--:--';
      dom.message.textContent =
        state.lastError ||
        'ブラウザの位置情報許可をオンにすると現在地ベースで描画します。';
      return;
    }

    // 位置
    dom.location.textContent = `${state.lat.toFixed(4)}°, ${state.lon.toFixed(
      4
    )}°`;

    // 太陽位置
    const pos = computeSolarPosition(state.lat, state.lon, date);
    state.elevationDeg = pos.elevationDeg;
    state.azimuthDeg = pos.azimuthDeg;

    dom.elevation.textContent = `${pos.elevationDeg.toFixed(1)} °`;
    dom.azimuth.textContent = `${pos.azimuthDeg.toFixed(1)} °`;

    // 日の出・日の入り
    const ss = computeSunriseSunset(state.lat, state.lon, date);
    state.sunrise = ss.sunrise;
    state.sunset = ss.sunset;

    dom.sunrise.textContent = formatTime(ss.sunrise);
    dom.sunset.textContent = formatTime(ss.sunset);

    // ドーム上の現在位置
    const dotPos = projectToDome(pos.elevationDeg, pos.azimuthDeg);
    dom.sunDot.setAttribute('cx', dotPos.x.toFixed(2));
    dom.sunDot.setAttribute('cy', dotPos.y.toFixed(2));

    // 軌道パス
    const path = buildSunPath(
      state.lat,
      state.lon,
      date,
      ss.sunrise,
      ss.sunset
    );
    dom.sunPath.setAttribute('d', path);

    dom.message.textContent =
      '※ 計算は簡易モデルのため、数分〜十数分程度の誤差があります。';
  }

  // ------------------------------------------------------------
  // 6. Events
  // ------------------------------------------------------------

  function setupEvents() {
    if (dom.refreshBtn) {
      dom.refreshBtn.addEventListener('click', () => {
        requestLocation();
      });
    }
  }

  function requestLocation() {
    if (!navigator.geolocation) {
      state.lastError = 'このブラウザでは位置情報 API を利用できません。';
      renderNow();
      return;
    }

    dom.message.textContent = '位置情報を取得中...';

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        state.lat = latitude;
        state.lon = longitude;
        state.lastError = null;
        renderNow();
      },
      (err) => {
        state.lastError = `位置情報を取得できませんでした（${err.code}）`;
        renderNow();
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 60 * 1000
      }
    );
  }

  // ------------------------------------------------------------
  // 7. Init
  // ------------------------------------------------------------

  function init() {
    setupEvents();
    renderNow();

    // 初回位置情報取得
    requestLocation();

    // 1分ごとに再描画（時刻と太陽位置の更新）
    setInterval(() => {
      renderNow();
    }, CONFIG.refreshIntervalMs);
  }

  // DOM 解析後に開始（defer指定なのでそのまま）
  init();
})();
