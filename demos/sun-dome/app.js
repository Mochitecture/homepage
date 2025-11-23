/**
 * /demos/sun-dome/app.js
 * NOW スナップショット ＋ 24h 太陽軌道（方位角×高度角 + tooltip）。
 */
(() => {
  const API_BASE = 'https://mochitecture-sun-api.onrender.com';

  const CONFIG = {
    refreshIntervalMs: 60 * 1000,
    sunpathStepMinutes: 5
  };

  const state = {
    lat: null,
    lon: null,
    // sunpath: {
    //   date, stepMinutes, points: [{ minutes, elevation, azimuth }],
    //   screenPoints: [{ minutes, elevation, azimuth, x, y }]
    // }
    sunpath: null
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

  function formatTimeFromMinutes(minutes) {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${pad2(h)}:${pad2(m)}`;
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

  function findNearestByMinutes(points, minutesNow) {
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

  function findNearestByScreen(points, x, y) {
    if (!points || points.length === 0) return null;
    let best = points[0];
    let bestDist = (points[0].x - x) ** 2 + (points[0].y - y) ** 2;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - x;
      const dy = points[i].y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist) {
        bestDist = d2;
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
    const margin = { top: 16, right: 40, bottom: 26, left: 32 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Elevation range（0° ラインが必ず入るように）
    let minElev = Math.min(...points.map(p => p.elevation));
    let maxElev = Math.max(...points.map(p => p.elevation));

    minElev = Math.min(minElev, -5); // 少し下に余裕
    maxElev = Math.max(maxElev, 10); // 少し上に余裕
    const elevRange = maxElev - minElev || 1;

    const azToX = (az) =>
      margin.left + (az / 360) * innerWidth;
    const elevToY = (e) =>
      margin.top + (1 - (e - minElev) / elevRange) * innerHeight;

    // 画面座標付きのポイント
    const screenPoints = points.map((p) => {
      const x = azToX(p.azimuth);
      const y = elevToY(p.elevation);
      return { ...p, x, y };
    });
    state.sunpath.screenPoints = screenPoints;

    // Path string（方位角×高度角の軌道）
    let dPath = '';
    screenPoints.forEach((p, i) => {
      dPath += (i === 0 ? 'M' : 'L') + p.x + ',' + p.y;
    });

    // 現在時刻に最も近い点
    const minutesNow =
      now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    const nearestNow = findNearestByMinutes(screenPoints, minutesNow);
    const nowDot = nearestNow
      ? `<circle class="sun-chart-now-dot" cx="${nearestNow.x}" cy="${nearestNow.y}" r="3" />`
      : '';

    // X軸（方位角 0,90,180,270,360）
    const azTicks = [0, 90, 180, 270, 360];

    // Y軸（高度角 0° ラインを強調）
    const yTicks = [];
    const tickCount = 4;
    for (let i = 0; i <= tickCount; i++) {
      const v = minElev + (elevRange * i) / tickCount;
      yTicks.push(v);
    }

    const svg = `
      <svg viewBox="0 0 ${width} ${height}" class="sun-chart-svg" aria-hidden="true">
        <rect x="0" y="0" width="${width}" height="${height}" fill="none" />

        <!-- グリッド: 横（高度角） -->
        <g>
          ${yTicks
            .map(v => {
              const y = elevToY(v);
              const isZero = Math.abs(v) < 0.01;
              const cls = isZero
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

        <!-- グリッド: 縦（方位角） -->
        <g>
          ${azTicks
            .map(az => {
              const x = azToX(az);
              const cls = (az === 0 || az === 180 || az === 360)
                ? 'sun-chart-grid-line sun-chart-grid-line--bold'
                : 'sun-chart-grid-line';
              return `
                <line class="${cls}" x1="${x}" y1="${margin.top}" x2="${x}" y2="${margin.top + innerHeight}" />
                <text class="sun-chart-axis-text" x="${x}" y="${margin.top + innerHeight + 16}" text-anchor="middle">
                  ${az}°
                </text>
              `;
            })
            .join('')}
        </g>

        <!-- 太陽軌道ライン -->
        <path class="sun-chart-line-elev" d="${dPath}" />

        <!-- 現在時刻の点 -->
        ${nowDot}
      </svg>
    `;

    const captionText = nearestNow
      ? `現在時刻 ${formatTimeFromMinutes(nearestNow.minutes)} ｜ 高度角 ${nearestNow.elevation.toFixed(1)}° ／ 方位角 ${nearestNow.azimuth.toFixed(1)}°`
      : '現在時刻の位置を赤い点で表示しています。';

    const caption = `
      <div class="sun-chart-legend">
        <span><span class="sun-legend-dot sun-legend-dot--elev"></span>太陽軌道（横軸：太陽方位角／縦軸：太陽高度角）</span>
        <span>赤い点：現在時刻の位置</span>
      </div>
      <p class="sun-chart-caption">
        ${captionText}
      </p>
      <div class="sun-chart-tooltip" id="sun-chart-tooltip"></div>
    `;

    container.innerHTML = svg + caption;

    // Tooltip 用イベント
    const svgEl = container.querySelector('svg');
    const tooltipEl = container.querySelector('#sun-chart-tooltip');

    if (!svgEl || !tooltipEl) return;

    function handleMove(evt) {
      const rectSvg = svgEl.getBoundingClientRect();
      const mouseX = evt.clientX - rectSvg.left;
      const mouseY = evt.clientY - rectSvg.top;

      const sp = state.sunpath && state.sunpath.screenPoints;
      if (!sp || sp.length === 0) return;

      const nearest = findNearestByScreen(sp, mouseX, mouseY);
      if (!nearest) return;

      tooltipEl.textContent =
        `${formatTimeFromMinutes(nearest.minutes)} ｜ 高度角 ${nearest.elevation.toFixed(1)}° ／ 方位角 ${nearest.azimuth.toFixed(1)}°`;

      const rectContainer = container.getBoundingClientRect();
      const globalX = rectSvg.left + nearest.x;
      const globalY = rectSvg.top + nearest.y;

      const relX = globalX - rectContainer.left;
      const relY = globalY - rectContainer.top;

      tooltipEl.style.left = `${relX}px`;
      tooltipEl.style.top = `${relY}px`;
      tooltipEl.style.opacity = '1';
    }

    function handleLeave() {
      tooltipEl.style.opacity = '0';
    }

    svgEl.addEventListener('mousemove', handleMove);
    svgEl.addEventListener('mouseleave', handleLeave);
  }

  async function ensureSunpath(now) {
    if (state.lat == null || state.lon == null) return;

    const dateStr = formatDate(now);

    // 同じ日付なら再フェッチせず、描画だけ更新
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
        const d = new Date(p.dt);
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
        points: pts,
        screenPoints: []
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
      return;
    }

    try {
      const sun = await apiSun(state.lat, state.lon, now);
      dom.elev.textContent = `${sun.elevation.toFixed(1)} °`;
      dom.az.textContent = `${sun.azimuth.toFixed(1)} °`;

      const ss = await apiSunriseSunset(state.lat, state.lon, now);
      const sunrise = ss.sunrise ? new Date(ss.sunrise) : null;
      const sunset = ss.sunset ? new Date(ss.sunset) : null;

      dom.sunrise.textContent = formatTime(sunrise);
      dom.sunset.textContent = formatTime(sunset);

      dom.message.textContent =
        'Sun API から取得した太陽高度角・太陽方位角と日の出／日の入の近似値を表示しています。';

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
    renderNow();

    setInterval(() => {
      renderNow();
    }, CONFIG.refreshIntervalMs);
  }

  init();
})();
