(() => {
  const API_BASE = "https://mochitecture-sun-api.onrender.com";

  const CONFIG = {
    refreshIntervalMs: 60 * 1000,
    dome: { cx: 100, cy: 110, r: 90 }
  };

  const state = {
    lat: null,
    lon: null,
    elevationDeg: null,
    azimuthDeg: null,
    sunrise: null,
    sunset: null
  };

  const dom = {
    location: document.getElementById('sunLocation'),
    localTime: document.getElementById('sunLocalTime'),
    localDate: document.getElementById('sunLocalDate'), // ★追加
    elevation: document.getElementById('sunElevation'),
    azimuth: document.getElementById('sunAzimuth'),
    sunrise: document.getElementById('sunSunrise'),
    sunset: document.getElementById('sunSunset'),
    message: document.getElementById('sunMessage'),
    refreshBtn: document.getElementById('sunRefreshBtn'),
    sunDot: document.getElementById('sunDot'),
    sunPath: document.getElementById('sunPath')
  };

  const pad2 = (n) => String(n).padStart(2, '0');
  
  function formatTime(date) {
    if (!date) return '--:--';
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }
  
  function formatDate(date) {
    if (!date) return '----/--/--';
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
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

  // -----------------------------
  // API CALLS
  // -----------------------------

  async function apiSun(lat, lon, localDate) {
    const dt = localDate.toISOString();
    const url = `${API_BASE}/sun?lat=${lat}&lon=${lon}&dt=${dt}`;
    const r = await fetch(url);
    return r.json();
  }

  async function apiSunriseSunset(lat, lon, localDate) {
    const dateStr = localDate.toISOString().slice(0, 10);
    const url = `${API_BASE}/sunrise_sunset?lat=${lat}&lon=${lon}&date=${dateStr}`;
    const r = await fetch(url);
    return r.json();
  }

  async function apiSunpath(lat, lon, localDate) {
    const dateStr = localDate.toISOString().slice(0, 10);
    const url = `${API_BASE}/sunpath?lat=${lat}&lon=${lon}&date=${dateStr}&step_minutes=10`;
    const r = await fetch(url);
    return r.json();
  }

  // -----------------------------
  // SVG projection
  // -----------------------------

  function toRad(d) { return (d * Math.PI) / 180; }

  function projectToDome(elevDeg, azDeg) {
    const dome = CONFIG.dome;
    const elev = Math.max(-5, Math.min(90, elevDeg));
    const elevRad = toRad(elev);

    const azFromSouthDeg = (azDeg - 180 + 360) % 360;
    const az = toRad(azFromSouthDeg);

    const horizontalR = dome.r * Math.cos(elevRad);
    return {
      x: dome.cx + horizontalR * Math.sin(az),
      y: dome.cy - dome.r * Math.sin(elevRad)
    };
  }

  function buildPath(points) {
    if (!points || points.length === 0) return "";

    return points
      .map((p, i) => {
        const pos = projectToDome(p.elevation, p.azimuth);
        const cmd = i === 0 ? "M" : "L";
        return `${cmd} ${pos.x.toFixed(1)} ${pos.y.toFixed(1)}`;
      })
      .join(" ");
  }

  // -----------------------------
  // MAIN RENDER
  // -----------------------------

  async function renderNow(date = new Date()) {
    dom.localTime.textContent = formatTime(date);

    // 位置未取得
    if (state.lat == null) {
      dom.message.textContent = "位置情報を取得してください";
      return;
    }

    dom.location.textContent = `${state.lat.toFixed(4)}°, ${state.lon.toFixed(4)}°`;

    // 太陽位置
    const sun = await apiSun(state.lat, state.lon, date);
    state.elevationDeg = sun.elevation;
    state.azimuthDeg = sun.azimuth;

    dom.elevation.textContent = `${sun.elevation.toFixed(1)} °`;
    dom.azimuth.textContent = `${sun.azimuth.toFixed(1)} °`;

    // 日の出・日の入り
    const ss = await apiSunriseSunset(state.lat, state.lon, date);
    state.sunrise = ss.sunrise ? new Date(ss.sunrise) : null;
    state.sunset = ss.sunset ? new Date(ss.sunset) : null;

    dom.sunrise.textContent = formatTime(state.sunrise);
    dom.sunset.textContent = formatTime(state.sunset);

    // ドーム上の太陽位置
    const dot = projectToDome(sun.elevation, sun.azimuth);
    dom.sunDot.setAttribute("cx", dot.x.toFixed(2));
    dom.sunDot.setAttribute("cy", dot.y.toFixed(2));

    // 軌道
    const sunpath = await apiSunpath(state.lat, state.lon, date);
    dom.sunPath.setAttribute("d", buildPath(sunpath.points));

    dom.message.textContent = "SPA (pvlib) に基づく太陽位置計算を使用しています。";
  }

  // -----------------------------
  // LOCATION
  // -----------------------------

  function requestLocation() {
    if (!navigator.geolocation) {
      dom.message.textContent = "位置情報 API が使えません。";
      return;
    }

    dom.message.textContent = "位置情報を取得中...";

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.lat = pos.coords.latitude;
        state.lon = pos.coords.longitude;
        renderNow();
      },
      () => {
        dom.message.textContent = "位置情報を取得できませんでした。";
      }
    );
  }

  // -----------------------------
  // INIT
  // -----------------------------

  function init() {
    dom.refreshBtn.addEventListener("click", requestLocation);
    requestLocation();
    renderNow();

    setInterval(renderNow, CONFIG.refreshIntervalMs);
  }

  init();
})();
