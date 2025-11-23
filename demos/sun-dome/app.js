/**
 * /demos/sun-dome/app.js
 * NOW スナップショット ＋ 24時間グラフ（/sunpath 使用）。
 */
(() => {
  const API_BASE = 'https://mochitecture-sun-api.onrender.com';

  const CONFIG = {
    refreshIntervalMs: 60 * 1000, // NOW 行・縦線更新
    sunpathStepMinutes: 5         // グラフ解像度
  };

  const state = {
    lat: null,
    lon: null,
    sunpath: null // { date: 'YYYY-MM-DD', stepMinutes, points: [{ minutes, elevation, azimuth }] }
  };

  const dom = {
    metaText: document.getElementById('sun-meta-text'),
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
      `緯度 ${state.lat.toFixed(4)}°, 経度 ${state.lon.toFixed(4)}°`;
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
    const dateStr = formatDate(date);
    const url = `${API_BASE}/sunrise_sunset?lat=${lat}&lon=${lon}&date=${dateStr}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('/sunrise_sunset error');
    return r.json();
  }

  async function apiSunpath(lat, lon, dateStr, stepMinutes) {
    const url =
      `${API_BASE}/sunpath?lat=${lat}&lon=${lon}` +
      `&date=${dateStr}&step_minutes=${stepMinutes}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('/sunpath error');
    return r.json();
  }

  // -----------------------------
  // Sunpath handling / Chart
  // -----------------------------

  function findNearestPoint(points, minutesNow) {
    if (!points || points.length === 0) return null;
    let best = points[0];
    let bestDiff = Math.abs(points[0].minutes - minutesNow);
    for (let i = 1; i < points.length; i++) {
      const d = Math.abs(points[i].minutes - minutesNow);
      if (d < bestDiff) {
        bestDiff = d;
        best = points[i];
      }
    }
    return best;
  }

  function renderSunChart(now) {
    if (!dom.chart) return;

    const container = dom.chart;
    const sunpath = state.sunpath;

    if (!sunpath || !sunpath.points || sunpath.points.length === 0) {
      container.innerHTML = `
        <p class="sun-chart-placeholder">
          位置情報が許可されると、その地点の 24時間分の太陽軌道をここに表示します。
        </p>
      `;
      return;
    }

    const points = sunpath.points;

    // Chart dimensions
    const width = 800;
    const height = 220;
    const margin = { top: 16, right: 40, bottom: 22, left: 32 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Elevation range（0°を少し下げてベースラインにする）
    let minElev = Math.min(...points.map(p => p.elevation));
    let maxElev = Math.max(...points.map(p => p.elevation));

    // ベースラインとして 0° を必ず含める
    minElev = Math.min(minElev, -5);
    maxElev = Math.max(maxElev, 10);
    const elevRange = maxElev - minElev || 1;

    const minutesToX = (m) =>
      margin.left + (m / (24 * 60)) * innerWidth;
    const elevToY = (e) =>
      margin.top + (1 - (e - minElev) / elevRange) * innerHeight;
    const azToY = (az) =>
      margin.top + (1 - (az / 360)) * innerHeight; // 0° = 下 / 360° = 上

    // Path strings
    let dElev = '';
    let dAz = '';
    points.forEach((p, i) => {
      const x = minutesToX(p.minutes);
      const yElev = elevToY(p.elevation);
      const yAz = azToY(p.azimuth);
      dElev += (i === 0 ? 'M' : 'L') + x + ',' + yElev;
      dAz += (i === 0 ? 'M' : 'L') + x + ',' + yAz;
    });

    // NOW 縦線位置
    const minutesNow =
      now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    const xNow = minutesToX(minutesNow);

    // 現在に最も近いポイント
    const nearest = findNearestPoint(points, minutesNow);

    // X軸グリッド（0, 6, 12, 18, 24 時）
    const xTicksHours = [0, 6, 12, 18, 24];

    // Y軸（高度角）グリッド（ざっくり 4分割）
    const yTicks = [];
    const tickCount = 4;
    for (let i = 0; i <= tickCount; i++) {
      const v = minElev + (elevRange * i) / tickCount;
      yTicks.push(v);
    }

    // SVG 構築
    const svg = `
      <svg viewBox="0 0 ${width} ${height}" class="sun-chart-svg" aria-hidden="true">
        <!-- 背景 -->
        <rect x="0" y="0" width="${width}" height="${height}" fill="none" />

        <!-- グリッド: 縦 -->
        <g>
          ${xTicksHours
            .map(h => {
              const m = h * 60;
              const x = minutesToX(m);
              const cls = (h === 0 || h === 12 || h === 24)
                ? 'sun-chart-grid-line sun-chart-grid-line--bold'
                : 'sun-chart-grid-line';
              return `
                <line class="${cls}" x1="${x}" y1="${margin.top}" x2="${x}" y2="${margin.top + innerHeight}" />
                <text class="sun-chart-axis-text" x="${x}" y="${margin.top + innerHeight + 14}" text-anchor="middle">
                  ${pad2(h)}:00
                </text>
              `;
            })
            .join('')}
        </g>

        <!-- グリッド: 横（高度角） -->
        <g>
          ${yTicks
            .map(v => {
              const y = elevToY(v);
              const cls = Math.abs(v) < 0.01
                ? 'sun-chart-grid-line sun-chart-grid-line--bold'
                : 'sun-chart-grid-line';
              return `
                <line class="${cls}" x1="${margin.left}" y1="${y}" x2="${margin.left + innerWidth}" y2="${y}" />
                <text class="sun-chart-axis-text" x="${margin.left - 4}" y="${y + 3}" text-anchor="end">
                  ${v.toFixed(0)}°
                </text>
              `;
            })
            .join('')}
        </g>

        <!-- 方位角 0°/180°/360° 目安 -->
        <g>
          ${[0, 90, 180, 270, 360]
            .map(v => {
              const y = azToY(v);
              return `
                <text class="sun-chart-axis-text" x="${margin.left + innerWidth + 4}" y="${y + 3}">
                  ${v}°
                </text>
              `;
            })
            .join('')}
        </g>

        <!-- 太陽高度角ライン -->
        <path class="sun-chart-line-elev" d="${dElev}" />

        <!-- 太陽方位角ライン（0–360° を縦方向にマッピング） -->
        <path class="sun-chart-line-az" d="${dAz}" />

        <!-- NOW 縦線 -->
        <line class="sun-chart-now-line"
          x1="${xNow}"
          y1="${margin.top}"
          x2="${xNow}"
          y2="${margin.top + innerHeight}" />
      </svg>
    `;

    const caption = nearest
      ? `
        <div class="sun-chart-legend">
          <span><span class="sun-legend-dot sun-legend-dot--elev"></span>太陽高度角（左軸）</span>
          <span><span class="sun-legend-dot sun-legend-dot--az"></span>太陽方位角（右側ラベル / 0–360°を縦方向にマッピング）</span>
          <span>赤い点線：現在時刻（NOW）</span>
        </div>
        <p class="sun-chart-caption">
          現在時刻 ${formatTime(now)} ｜ 高度角 ${nearest.elevation.toFixed(1)}° ／ 方位角 ${nearest.azimuth.toFixed(1)}°
        </p>
      `
      : `
        <div class="sun-chart-legend">
          <span><span class="sun-legend-dot sun-legend-dot--elev"></span>太陽高度角（左軸）</span>
          <span><span class="sun-legend-dot sun-legend-dot--az"></span>太陽方位角（右側ラベル）</span>
        </div>
      `;

    container.innerHTML = svg + caption;
  }

  async function ensureSunpath(now) {
    if (state.lat == null || state.lon == null) return;

    const dateStr = formatDate(now);

    // 同じ日付なら再フェッチせず、NOW 縦線だけ更新
    if (state.sunpath && state.sunpath.date === dateStr) {
      renderSunChart(now);
      return;
    }

    try {
      if (dom.chart) {
        dom.chart.classList.add('sun-chart-loading');
      }

      const data = await apiSunpath(
        state.lat,
        state.lon,
        dateStr,
        CONFIG.sunpathStepMinutes
      );

      const ptsRaw = data.points || [];
      const pts = ptsRaw.map((p) => {
        const d = new Date(p.dt); // ローカルタイムゾーン付き ISO
        const minutes = d.getHours() * 60 + d.getMinutes();
        return {
          minutes,
          elevation: p.elevation,
          azimuth: p.azimuth
        };
      });

      state.sunpath = {
        date: dateStr,
        stepMinutes: data.step_minutes || CONFIG.sunpathStepMinutes,
        points: pts
      };

      renderSunChart(now);
    } catch (e) {
      console.error(e);
      if (dom.chart) {
        dom.chart.innerHTML = `
          <p class="sun-chart-placeholder">
            太陽軌道データを取得できませんでした。
          </p>
        `;
      }
    } finally {
      if (dom.chart) {
        dom.chart.classList.remove('sun-chart-loading');
      }
    }
  }

  // -----------------------------
  // Render NOW snapshot
  // -----------------------------

  async function renderNow() {
    const now = new Date();
    updateMeta(now);

    if (state.lat == null || state.lon == null) {
      dom.elev.textContent = '-- °';
      dom.az.textContent = '-- °';
      dom.sunrise.textContent = '--:--';
      dom.sunset.textContent = '--:--';
      dom.message.textContent =
        'ブラウザの位置情報許可をオンにすると、現在地ベースで太陽位置を取得します。';
      // chart はロケーション前は何もしない（プレースホルダのまま）
      return;
    }

    try {
      // 太陽位置（太陽高度角・太陽方位角）
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
        'Sun API から取得した太陽高度角・太陽方位角と日の出／日の入の近似値を表示しています。';

      // 24時間グラフ（/sunpath）も確保
      await ensureSunpath(now);
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
        // 位置がとれたら NOW & グラフを更新
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
    // 初期描画（位置取得前でも NOW 行だけ更新）
    renderNow();

    setInterval(() => {
      renderNow();
    }, CONFIG.refreshIntervalMs);
  }

  init();
})();
