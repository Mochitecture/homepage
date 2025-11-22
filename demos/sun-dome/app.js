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
  // 4. Utilities（NOAAベースの太陽位置計算）
  // ------------------------------------------------------------

  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;

  const pad2 = (n) => String(n).padStart(2, '0');

  function formatTime(date) {
    if (!date) return '--:--';
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  /**
   * ユリウス日（Julian Day）
   * dateUtc: UTC基準のDate
   */
  function calcJulianDay(dateUtc) {
    let year = dateUtc.getUTCFullYear();
    let month = dateUtc.getUTCMonth() + 1; // 1-12
    const day =
      dateUtc.getUTCDate() +
      (dateUtc.getUTCHours() +
        dateUtc.getUTCMinutes() / 60 +
        dateUtc.getUTCSeconds() / 3600) /
        24;

    if (month <= 2) {
      year -= 1;
      month += 12;
    }

    const A = Math.floor(year / 100);
    const B = 2 - A + Math.floor(A / 25);

    const JD =
      Math.floor(365.25 * (year + 4716)) +
      Math.floor(30.6001 * (month + 1)) +
      day +
      B -
      1524.5;

    return JD;
  }

  function calcJulianCentury(JD) {
    return (JD - 2451545.0) / 36525.0;
  }

  function geomMeanLongSun(T) {
    const L0 = 280.46646 + T * (36000.76983 + 0.0003032 * T);
    return ((L0 % 360) + 360) % 360;
  }

  function geomMeanAnomSun(T) {
    return 357.52911 + T * (35999.05029 - 0.0001537 * T);
  }

  function eccEarthOrbit(T) {
    return 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  }

  function sunEqOfCenter(T, Mdeg) {
    const Mrad = toRad(Mdeg);
    return (
      Math.sin(Mrad) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
      Math.sin(2 * Mrad) * (0.019993 - 0.000101 * T) +
      Math.sin(3 * Mrad) * 0.000289
    );
  }

  function sunTrueLong(L0deg, Cdeg) {
    return L0deg + Cdeg;
  }

  function sunAppLong(T, trueLongDeg) {
    const omega = 125.04 - 1934.136 * T;
    return (
      trueLongDeg -
      0.00569 -
      0.00478 * Math.sin(toRad(omega))
    );
  }

  function meanObliqEcliptic(T) {
    const seconds =
      21.448 -
      T * (46.815 + T * (0.00059 - 0.001813 * T));
    return 23 + (26 + seconds / 60) / 60;
  }

  function obliqCorr(T, e0deg) {
    const omega = 125.04 - 1934.136 * T;
    return e0deg + 0.00256 * Math.cos(toRad(omega));
  }

  function sunDeclination(epsDeg, lambdaDeg) {
    return toDeg(
      Math.asin(
        Math.sin(toRad(epsDeg)) * Math.sin(toRad(lambdaDeg))
      )
    );
  }

  /**
   * 均時差 Equation of Time [分]
   */
  function eqOfTimeMinutes(T, epsDeg, L0deg, Mdeg, ecc) {
    const eps = toRad(epsDeg);
    const L0 = toRad(L0deg);
    const M = toRad(Mdeg);

    const y = Math.tan(eps / 2) ** 2;

    const Etime =
      y * Math.sin(2 * L0) -
      2 * ecc * Math.sin(M) +
      4 * ecc * y * Math.sin(M) * Math.cos(2 * L0) -
      0.5 * y * y * Math.sin(4 * L0) -
      1.25 * ecc * ecc * Math.sin(2 * M);

    // radians → 分
    return toDeg(Etime) * 4;
  }

  /**
   * 太陽高度・方位角（NOAAアルゴリズム）
   * - latDeg, lonDeg: 緯度・経度（東経＋）
   * - date: ローカル時刻の Date
   */
  function computeSolarPosition(latDeg, lonDeg, date) {
    // JS の getTimezoneOffset(): local → UTC に足す分（分単位）
    const tzOffsetMin = date.getTimezoneOffset(); // 例: JST = -540
    const timezoneHours = -tzOffsetMin / 60;

    // UTC 日時
    const dateUtc = new Date(
      date.getTime() + tzOffsetMin * 60 * 1000
    );

    const JD = calcJulianDay(dateUtc);
    const T = calcJulianCentury(JD);
    const L0 = geomMeanLongSun(T);
    const M = geomMeanAnomSun(T);
    const ecc = eccEarthOrbit(T);
    const C = sunEqOfCenter(T, M);
    const trueLong = sunTrueLong(L0, C);
    const lambdaApp = sunAppLong(T, trueLong);
    const e0 = meanObliqEcliptic(T);
    const eps = obliqCorr(T, e0);
    const decl = sunDeclination(eps, lambdaApp);
    const eot = eqOfTimeMinutes(T, eps, L0, M, ecc); // 分

    const minutesLocal =
      date.getHours() * 60 +
      date.getMinutes() +
      date.getSeconds() / 60;

    // Time offset (NOAA)
    const timeOffset =
      eot + 4 * lonDeg - 60 * timezoneHours;

    // 真太陽時 [分]
    const tst = (minutesLocal + timeOffset + 1440) % 1440;

    // 時角 [度]
    let hourAngleDeg;
    if (tst / 4 < 0) {
      hourAngleDeg = tst / 4 + 180;
    } else {
      hourAngleDeg = tst / 4 - 180;
    }

    const haRad = toRad(hourAngleDeg);
    const latRad = toRad(latDeg);
    const declRad = toRad(decl);

    const cosZenith =
      Math.sin(latRad) * Math.sin(declRad) +
      Math.cos(latRad) *
        Math.cos(declRad) *
        Math.cos(haRad);
    const cosZClamped = Math.max(-1, Math.min(1, cosZenith));
    const zenithDeg = toDeg(Math.acos(cosZClamped));
    const elevationDeg = 90 - zenithDeg;

    // 大気差による簡易補正
    let refraction = 0;
    if (elevationDeg <= 85) {
      const te = Math.tan(toRad(elevationDeg));
      if (elevationDeg > 5) {
        refraction =
          58.1 / te -
          0.07 / (te ** 3) +
          0.000086 / (te ** 5);
      } else if (elevationDeg > -0.575) {
        refraction =
          1735 +
          elevationDeg *
            (-518.2 +
              elevationDeg *
                (103.4 +
                  elevationDeg *
                    (-12.79 + elevationDeg * 0.711)));
      } else {
        refraction = -20.774 / te;
      }
      refraction /= 3600; // 秒 → 度
    }

    const elevationCorr = elevationDeg + refraction;

    // 方位角（0° = 北, 時計回り）
    const zenithRad = toRad(zenithDeg);
    const azRad = Math.acos(
      (Math.sin(latRad) * Math.cos(zenithRad) -
        Math.sin(declRad)) /
        (Math.cos(latRad) * Math.sin(zenithRad))
    );

    let azDeg;
    if (hourAngleDeg > 0) {
      azDeg = (toDeg(azRad) + 180) % 360;
    } else {
      azDeg = (540 - toDeg(azRad)) % 360;
    }

    return {
      elevationDeg: elevationCorr,
      azimuthDeg: azDeg,
      declinationDeg: decl,
      hourAngleDeg,
      eqTimeMinutes: eot
    };
  }

  /**
   * 日の出・日の入り（NOAAアルゴリズム準拠）
   * Date はローカル日付。戻り値はローカル Date。
   */
    /**
   * 日の出・日の入り（数値探索版）
   * - その日の 0:00〜24:00 を stepMin 分刻みで走査し、
   *   太陽高度が altThreshold をまたぐタイミングを線形補間で求める。
   * - altThreshold = -0.833° は「地平線 + 太陽半径 + 大気差」に相当。
   * - 戻り値はローカル時刻の Date。
   */
  function computeSunriseSunset(latDeg, lonDeg, date) {
    const altThreshold = -0.833; // °（調整したければここをいじる）
    const stepMin = 1;           // 探索ステップ（1分刻み）

    const dayStart = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      0, 0, 0, 0
    );

    const minutesPerDay = 24 * 60;
    let sunrise = null;
    let sunset = null;

    let prevAlt = null;
    let prevTime = null;

    // 線形補間で「高度 = altThreshold」になる時刻を求める
    const interpolateTime = (t1, a1, t2, a2, targetAlt) => {
      if (a2 === a1) return t1;
      const ratio = (targetAlt - a1) / (a2 - a1);
      const t = t1.getTime() + (t2.getTime() - t1.getTime()) * ratio;
      return new Date(t);
    };

    for (let m = 0; m <= minutesPerDay; m += stepMin) {
      const t = new Date(dayStart.getTime() + m * 60 * 1000);
      const pos = computeSolarPosition(latDeg, lonDeg, t);
      const alt = pos.elevationDeg;

      if (prevAlt !== null) {
        // 夜（閾値未満）→ 昼（閾値以上）に切り替わる点 = 日の出
        if (prevAlt < altThreshold && alt >= altThreshold && !sunrise) {
          sunrise = interpolateTime(prevTime, prevAlt, t, alt, altThreshold);
        }
        // 昼（閾値以上）→ 夜（閾値未満）に切り替わる点 = 日の入り
        if (prevAlt >= altThreshold && alt < altThreshold) {
          sunset = interpolateTime(prevTime, prevAlt, t, alt, altThreshold);
        }
      }

      prevAlt = alt;
      prevTime = t;
    }

    return { sunrise, sunset };
  }


  /**
   * 半球ドームへの射影
   * - elevationDeg: 太陽高度
   * - azimuthDeg: 方位角（0°=北, 時計回り）
   *   → 南=180° を上方向とみなして配置
   */
  function projectToDome(elevationDeg, azimuthDeg) {
    const { cx, cy, r } = CONFIG.dome;

    const elev = Math.max(-5, Math.min(90, elevationDeg));
    const altRad = toRad(elev);

    // 南を0°とした角度に変換
    const azFromSouthDeg = (azimuthDeg - 180 + 360) % 360;
    const az = toRad(azFromSouthDeg);

    const horizontalRadius = r * Math.cos(altRad);
    const x = cx + horizontalRadius * Math.sin(az);
    const y = cy - r * Math.sin(altRad);

    return { x, y };
  }

  /**
   * 日の出〜日の入りの軌道を SVG Path で生成
   */
  function buildSunPath(latDeg, lonDeg, date, sunrise, sunset) {
    if (!sunrise || !sunset) return '';

    const N = 32;
    const parts = [];

    for (let i = 0; i <= N; i += 1) {
      const t =
        sunrise.getTime() +
        ((sunset.getTime() - sunrise.getTime()) * i) / N;
      const d = new Date(t);
      const pos = computeSolarPosition(latDeg, lonDeg, d);
      const { x, y } = projectToDome(
        pos.elevationDeg,
        pos.azimuthDeg
      );
      const cmd = i === 0 ? 'M' : 'L';
      parts.push(`${cmd} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }

    return parts.join(' ');
  }

  // ------------------------------------------------------------
  // 5. Render
  // ------------------------------------------------------------

  function renderNow(date = new Date()) {
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

    dom.location.textContent = `${state.lat.toFixed(
      4
    )}°, ${state.lon.toFixed(4)}°`;

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
    const dotPos = projectToDome(
      pos.elevationDeg,
      pos.azimuthDeg
    );
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
      '※ NOAA アルゴリズムに基づく近似値のため、数分〜十数分程度の誤差があります。';
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
      state.lastError =
        'このブラウザでは位置情報 API を利用できません。';
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
    requestLocation();

    // 1分ごとに時刻＆太陽位置を更新
    setInterval(() => {
      renderNow();
    }, CONFIG.refreshIntervalMs);
  }

  init();
})();
