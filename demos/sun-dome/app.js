/**
 * /demos/sun-dome/app.js
 * Pattern: Demo JS Pattern
 */

(() => {
  // ------------------------------------------------------------
  // 1. Config
  // ------------------------------------------------------------
  const API_BASE = "https://mochitecture-sun-api.onrender.com";

  const CONFIG = {
    refreshIntervalMs: 60 * 1000, // 1分ごとに NOW を更新
    chart: {
      width: 420,
      height: 200,
      margin: { top: 16, right: 40, bottom: 26, left: 40 }
    }
  };

  // ------------------------------------------------------------
  // 2. State
  // ------------------------------------------------------------
  const state = {
    lat: null,
    lon: null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tokyo",
    pathData: [], // {dt: Date, elevation, azimuth}
    lastError: null
  };

  // ------------------------------------------------------------
  // 3. DOM references
  // ------------------------------------------------------------
  const dom = {
    location: document.getElementById("sunLocation"),
    localDate: document.getElementById("sunLocalDate"),
    localTime: document.getElementById("sunLocalTime"),
    elevation: document.getElementById("sunElevation"),
    azimuth: document.getElementById("sunAzimuth"),
    azimuthDir: document.getElementById("sunAzimuthDir"),
    sunrise: document.getElementById("sunSunrise"),
    sunset: document.getElementById("sunSunset"),
    message: document.getElementById("sunMessage"),
    caption: document.getElementById("sunInfoCaption"),
    refreshBtn: document.getElementById("sunRefreshBtn"),
    chartSvg: document.getElementById("sunChart"),
    tooltip: document.getElementById("sunTooltip"),
    tooltipTime: document.getElementById("sunTooltipTime"),
    tooltipElev: document.getElementById("sunTooltipElev"),
    tooltipAz: document.getElementById("sunTooltipAz"),
    tooltipDir: document.getElementById("sunTooltipDir")
  };

  // ------------------------------------------------------------
  // 4. Utility
  // ------------------------------------------------------------
  const pad2 = (n) => String(n).padStart(2, "0");

  const formatLocalDate = (d) =>
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  const formatLocalTime = (d) =>
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

  const formatLocalDateTime = (d) =>
    `${formatLocalDate(d)}T${formatLocalTime(d)}:00`;

  function azimuthToDirection(azDeg) {
    if (azDeg == null || Number.isNaN(azDeg)) return "--";

    const dirs = [
      "北",
      "北北東",
      "北東",
      "東北東",
      "東",
      "東南東",
      "南東",
      "南南東",
      "南",
      "南南西",
      "南西",
      "西南西",
      "西",
      "西北西",
      "北西",
      "北北西"
    ];
    const normalized = ((azDeg % 360) + 360) % 360;
    const index = Math.round(normalized / 22.5) % 16;
    return dirs[index];
  }

  const toRad = (deg) => (deg * Math.PI) / 180;

  // ------------------------------------------------------------
  // 5. API calls
  // ------------------------------------------------------------
  async function apiSun(lat, lon, date) {
    const dt = formatLocalDateTime(date);
    const url =
      `${API_BASE}/sun?lat=${lat}&lon=${lon}` +
      `&dt=${encodeURIComponent(dt)}` +
      `&tz=${encodeURIComponent(state.timezone)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`sun API error: ${res.status}`);
    return res.json();
  }

  async function apiSunriseSunset(lat, lon, date) {
    const dateStr = formatLocalDate(date);
    const url =
      `${API_BASE}/sunrise_sunset?lat=${lat}&lon=${lon}` +
      `&date=${encodeURIComponent(dateStr)}` +
      `&tz=${encodeURIComponent(state.timezone)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`sunrise_sunset API error: ${res.status}`);
    return res.json();
  }

  async function apiSunpath(lat, lon, date) {
    const dateStr = formatLocalDate(date);
    const url =
      `${API_BASE}/sunpath?lat=${lat}&lon=${lon}` +
      `&date=${encodeURIComponent(dateStr)}` +
      `&tz=${encodeURIComponent(state.timezone)}` +
      `&step_minutes=1`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`sunpath API error: ${res.status}`);
    return res.json();
  }

  // ------------------------------------------------------------
  // 6. Chart helpers
  // ------------------------------------------------------------
  function clearChart() {
    while (dom.chartSvg.firstChild) {
      dom.chartSvg.removeChild(dom.chartSvg.firstChild);
    }
  }

  function buildScales(data) {
    const { width, height, margin } = CONFIG.chart;
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    const n = data.length || 1;
    const xScale = (i) =>
      margin.left + (plotWidth * i) / Math.max(1, n - 1);

    // 高度は -10〜90 を固定レンジ
    const elevMin = -10;
    const elevMax = 90;

    // 方位は 0〜360
    const azMin = 0;
    const azMax = 360;

    const yElev = (val) => {
      const t = (val - elevMin) / (elevMax - elevMin);
      return margin.top + (1 - t) * plotHeight;
    };

    const yAz = (val) => {
      const t = (val - azMin) / (azMax - azMin);
      return margin.top + (1 - t) * plotHeight;
    };

    return {
      xScale,
      yElev,
      yAz,
      elevMin,
      elevMax,
      azMin,
      azMax,
      plotWidth,
      plotHeight
    };
  }

  function buildLinePath(data, xScale, yScale, key) {
    if (!data.length) return "";
    const parts = data.map((p, i) => {
      const x = xScale(i).toFixed(1);
      const y = yScale(p[key]).toFixed(1);
      const cmd = i === 0 ? "M" : "L";
      return `${cmd} ${x} ${y}`;
    });
    return parts.join(" ");
  }

  function drawAxes(scales) {
    const { width, height, margin, chart } = CONFIG;
    const svg = dom.chartSvg;

    const axisColor = "#d1d5db";
    const gridColor = "#e5e7eb";

    const ax = (x1, y1, x2, y2, className) => {
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );
      line.setAttribute("x1", x1);
      line.setAttribute("y1", y1);
      line.setAttribute("x2", x2);
      line.setAttribute("y2", y2);
      line.setAttribute("class", className);
      svg.appendChild(line);
    };

    const text = (x, y, content, options = {}) => {
      const t = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text"
      );
      t.textContent = content;
      t.setAttribute("x", x);
      t.setAttribute("y", y);
      t.setAttribute("fill", options.fill || "#6b7280");
      t.setAttribute("font-size", options.fontSize || "9px");
      t.setAttribute("text-anchor", options.anchor || "middle");
      if (options.dy) t.setAttribute("dy", options.dy);
      svg.appendChild(t);
    };

    // 軸
    const bottomY = height - margin.bottom;
    const topY = margin.top;
    const leftX = margin.left;
    const rightX = width - margin.right;

    ax(leftX, topY, leftX, bottomY, "sun-chart-axis");
    ax(leftX, bottomY, rightX, bottomY, "sun-chart-axis");

    // X 軸目盛り（0, 6, 12, 18, 24 時）
    const hours = [0, 6, 12, 18, 24];
    const n = state.pathData.length || 1;
    const idxFromHour = (h) => Math.round((h / 24) * (n - 1));

    hours.forEach((h) => {
      const i = idxFromHour(h);
      const x = scales.xScale(i);
      ax(x, bottomY, x, bottomY + 4, "sun-chart-axis");
      text(x, bottomY + 14, `${h}:00`, {
        anchor: "middle"
      });

      // 縦グリッド
      ax(x, topY, x, bottomY, "sun-chart-grid");
    });

    // Y 軸（左：高度）
    const elevTicks = [-10, 0, 30, 60, 90];
    elevTicks.forEach((val) => {
      const y = scales.yElev(val);
      ax(leftX - 4, y, leftX, y, "sun-chart-axis");
      text(leftX - 8, y + 3, `${val}`, {
        anchor: "end",
        fontSize: "9px"
      });
      ax(leftX, y, rightX, y, "sun-chart-grid");
    });

    text(leftX - 18, topY + 8, "高度", {
      anchor: "start",
      fontSize: "9px"
    });

    // Y 右軸：方位（0,90,180,270,360）
    const azTicks = [0, 90, 180, 270, 360];
    azTicks.forEach((val) => {
      const y = scales.yAz(val);
      ax(rightX, y, rightX + 4, y, "sun-chart-axis");
      text(rightX + 8, y + 3, `${val}`, {
        anchor: "start",
        fontSize: "9px"
      });
    });
    text(rightX + 14, topY + 8, "方位", {
      anchor: "start",
      fontSize: "9px"
    });
  }

  function drawChart() {
    clearChart();
    const data = state.pathData;
    if (!data.length) return;

    const { width, height, margin } = CONFIG.chart;
    dom.chartSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    const scales = buildScales(data);
    drawAxes(scales);

    const svg = dom.chartSvg;

    // 高度ライン
    const elevPath = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );
    elevPath.setAttribute(
      "d",
      buildLinePath(data, scales.xScale, scales.yElev, "elevation")
    );
    elevPath.setAttribute("class", "sun-chart-line-elev");
    svg.appendChild(elevPath);

    // 方位ライン
    const azPath = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );
    azPath.setAttribute(
      "d",
      buildLinePath(data, scales.xScale, scales.yAz, "azimuth")
    );
    azPath.setAttribute("class", "sun-chart-line-az");
    svg.appendChild(azPath);

    // カーソル線
    const cursor = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line"
    );
    cursor.setAttribute("id", "sunCursorLine");
    cursor.setAttribute("class", "sun-chart-cursor");
    cursor.setAttribute("x1", margin.left);
    cursor.setAttribute("x2", margin.left);
    cursor.setAttribute("y1", margin.top);
    cursor.setAttribute("y2", height - margin.bottom);
    cursor.setAttribute("opacity", "0");
    svg.appendChild(cursor);

    // ヒットエリア
    const hit = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect"
    );
    hit.setAttribute("x", margin.left);
    hit.setAttribute("y", margin.top);
    hit.setAttribute(
      "width",
      width - margin.left - margin.right
    );
    hit.setAttribute(
      "height",
      height - margin.top - margin.bottom
    );
    hit.setAttribute("fill", "transparent");
    svg.appendChild(hit);

    // マウスイベント
    hit.addEventListener("mousemove", (evt) => {
      const rect = svg.getBoundingClientRect();
      const x = evt.clientX - rect.left;
      const plotWidth =
        width - margin.left - margin.right;
      const t = (x - margin.left) / plotWidth;
      const idx = Math.max(
        0,
        Math.min(
          data.length - 1,
          Math.round(t * (data.length - 1))
        )
      );
      const point = data[idx];
      const cx = scales.xScale(idx);

      cursor.setAttribute("x1", cx);
      cursor.setAttribute("x2", cx);
      cursor.setAttribute("opacity", "1");

      // tooltip
      const tooltipX = cx * (rect.width / width);
      const tooltipY =
        (margin.top + (rect.height - margin.bottom)) / 2;

      dom.tooltip.style.left = `${tooltipX}px`;
      dom.tooltip.style.top = `${tooltipY}px`;
      dom.tooltip.hidden = false;

      dom.tooltipTime.textContent = formatLocalTime(point.dt);
      dom.tooltipElev.textContent = `${point.elevation.toFixed(
        1
      )} °`;
      dom.tooltipAz.textContent = `${point.azimuth.toFixed(
        1
      )} °`;
      dom.tooltipDir.textContent =
        azimuthToDirection(point.azimuth);
    });

    hit.addEventListener("mouseleave", () => {
      dom.tooltip.hidden = true;
      const cursorLine =
        document.getElementById("sunCursorLine");
      if (cursorLine) {
        cursorLine.setAttribute("opacity", "0");
      }
    });
  }

  // ------------------------------------------------------------
  // 7. Render & data loading
  // ------------------------------------------------------------
  function renderNowSummary(now) {
    dom.localDate.textContent = formatLocalDate(now);
    dom.localTime.textContent = formatLocalTime(now);

    if (state.lat == null || state.lon == null) {
      dom.location.textContent = "位置情報を取得できていません";
      dom.elevation.textContent = "-- °";
      dom.azimuth.textContent = "-- °";
      dom.azimuthDir.textContent = "";
      dom.sunrise.textContent = "--:--";
      dom.sunset.textContent = "--:--";
      dom.message.textContent =
        state.lastError ||
        "ブラウザの位置情報を許可すると、この場所の太陽位置を表示します。";
      return;
    }

    dom.location.textContent = `${state.lat.toFixed(
      4
    )}°, ${state.lon.toFixed(4)}°`;
  }

  async function loadAndRenderAll() {
    const now = new Date();
    renderNowSummary(now);

    if (state.lat == null || state.lon == null) return;

    try {
      const [sun, ss, path] = await Promise.all([
        apiSun(state.lat, state.lon, now),
        apiSunriseSunset(state.lat, state.lon, now),
        apiSunpath(state.lat, state.lon, now)
      ]);

      // NOW
      dom.elevation.textContent = `${sun.elevation.toFixed(
        1
      )} °`;
      dom.azimuth.textContent = `${sun.azimuth.toFixed(
        1
      )} °`;
      dom.azimuthDir.textContent =
        `（${azimuthToDirection(sun.azimuth)}）`;

      const sunriseDate = ss.sunrise ? new Date(ss.sunrise) : null;
      const sunsetDate = ss.sunset ? new Date(ss.sunset) : null;

      dom.sunrise.textContent = sunriseDate
        ? formatLocalTime(sunriseDate)
        : "--:--";
      dom.sunset.textContent = sunsetDate
        ? formatLocalTime(sunsetDate)
        : "--:--";

      dom.caption.textContent =
        "現在地とローカル日付を基準に、SPA ベースの Sun API から太陽位置を取得しています。";
      dom.message.textContent =
        "※ 数分程度の誤差を含む近似値です。実際の天文用途には利用しないでください。";

      // PATH
      state.pathData =
        (path.points || []).map((p) => ({
          dt: new Date(p.dt),
          elevation: Number(p.elevation),
          azimuth: Number(p.azimuth)
        })) || [];

      drawChart();
    } catch (err) {
      console.error(err);
      state.lastError = "Sun API からの取得に失敗しました。";
      dom.message.textContent = state.lastError;
    }
  }

  // ------------------------------------------------------------
  // 8. Location
  // ------------------------------------------------------------
  function requestLocation() {
    if (!navigator.geolocation) {
      state.lastError =
        "このブラウザでは位置情報 API を利用できません。";
      dom.message.textContent = state.lastError;
      renderNowSummary(new Date());
      return;
    }

    dom.message.textContent = "位置情報を取得中...";

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.lat = pos.coords.latitude;
        state.lon = pos.coords.longitude;
        state.lastError = null;
        loadAndRenderAll();
      },
      (err) => {
        state.lastError = `位置情報を取得できませんでした（${err.code}）`;
        dom.message.textContent = state.lastError;
        renderNowSummary(new Date());
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
      dom.refreshBtn.addEventListener("click", requestLocation);
    }

    renderNowSummary(new Date());
    requestLocation();

    // 1分ごとに NOW 情報だけ更新（パスは 1日単位で十分なので再取得しない）
    setInterval(() => {
      renderNowSummary(new Date());
    }, CONFIG.refreshIntervalMs);
  }

  init();
})();
