/**
 * File: /demos/login/app.js
 * Pattern: Demo JS Pattern
 * Structure: config → state → DOM → util → render → events → init
 */

(() => {
  // 1. Config
  const SESSION_KEY = 'mochitectureLoginSession';
  const SESSION_EXPIRES_MINUTES = 30; // 通常セッション
  const REMEMBER_EXPIRES_DAYS = 7;    // Remember me の有効期間（デモ）

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // 2. State
  let currentView = 'signin';

  /** @type {{loggedIn: boolean, remember: boolean, expiresAt: number|null}} */
  let session = {
    loggedIn: false,
    remember: false,
    expiresAt: null
  };

  // 3. DOM 参照
  const tabs = Array.from(document.querySelectorAll('.login-tab'));
  const panels = Array.from(document.querySelectorAll('.login-panel'));

  const statusEls = Array.from(document.querySelectorAll('[data-login-status]'));

  const formSignin = document.querySelector('[data-form="signin"]');
  const formSignup = document.querySelector('[data-form="signup"]');
  const formForgot = document.querySelector('[data-form="forgot"]');
  const formReset = document.querySelector('[data-form="reset"]');
  const formChange = document.querySelector('[data-form="change"]');

  const logoutButtons = Array.from(document.querySelectorAll('.js-logout'));
  const goDevicesButtons = Array.from(document.querySelectorAll('.js-go-devices'));

  // 4. Utility 関数

  function getErrorEl(key) {
    return document.querySelector(`.login-error[data-error-for="${key}"]`);
  }

  function setError(key, message) {
    const el = getErrorEl(key);
    if (!el) return;
    el.textContent = message || '';
  }

  function computeExpires(remember) {
    const now = Date.now();
    if (remember) {
      return now + REMEMBER_EXPIRES_DAYS * 24 * 60 * 60 * 1000;
    }
    return now + SESSION_EXPIRES_MINUTES * 60 * 1000;
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;

      const stored = JSON.parse(raw);
      if (!stored || typeof stored.expiresAt !== 'number') {
        clearSession();
        return;
      }

      const now = Date.now();
      if (stored.expiresAt <= now) {
        // 期限切れ
        clearSession();
        return;
      }

      session = {
        loggedIn: !!stored.loggedIn,
        remember: !!stored.remember,
        expiresAt: stored.expiresAt
      };
    } catch {
      clearSession();
    }
  }

  function saveSession(remember) {
    const expiresAt = computeExpires(remember);
    session = {
      loggedIn: true,
      remember: !!remember,
      expiresAt
    };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      // localStorage が使えない場合は何もしない（デモなので無視）
    }
  }

  function clearSession() {
    session = { loggedIn: false, remember: false, expiresAt: null };
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // noop
    }
  }

  function ensureSessionValidity() {
    if (!session.loggedIn || !session.expiresAt) return;
    const now = Date.now();
    if (session.expiresAt <= now) {
      clearSession();
    }
  }

  function renderSessionStatus() {
    ensureSessionValidity();

    let text;
    if (!session.loggedIn) {
      text = '現在：ログインしていません（デモ）。';
    } else if (session.remember) {
      text = '現在：ログイン中（Remember me 有効／デモ）。';
    } else {
      text = '現在：ログイン中（このブラウザのみ／デモ）。';
    }

    statusEls.forEach((el) => {
      el.textContent = text;
    });
  }

  function setActiveView(view) {
    currentView = view;

    tabs.forEach((tab) => {
      const isActive = tab.dataset.view === view;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    panels.forEach((panel) => {
      const isActive = panel.dataset.view === view;
      panel.classList.toggle('is-active', isActive);
      panel.hidden = !isActive;
    });
  }

  function validateEmail(email) {
    if (!email) return 'メールアドレスを入力してください。';
    if (!EMAIL_REGEX.test(email)) return 'メールアドレスの形式を確認してください。';
    return '';
  }

  function validatePassword(password, opts = { min: 8 }) {
    if (!password) return 'パスワードを入力してください。';
    if (password.length < (opts.min || 8)) {
      return `パスワードは${opts.min || 8}文字以上を推奨しています。`;
    }
    return '';
  }

  // 5. Events

  function bindTabEvents() {
    // クリックでタブ切り替え
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const view = tab.dataset.view;
        if (view && view !== currentView) {
          setActiveView(view);
        }
      });

      // 矢印キーでタブ移動（簡易）
      tab.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

        const idx = tabs.indexOf(tab);
        if (idx === -1) return;

        const dir = e.key === 'ArrowRight' ? 1 : -1;
        const nextIndex = (idx + dir + tabs.length) % tabs.length;
        const nextTab = tabs[nextIndex];

        nextTab.focus();
        setActiveView(nextTab.dataset.view);
      });
    });

    // 「パスワード再設定」へのショートカット
    document.querySelectorAll('[data-switch="forgot"]').forEach((btn) => {
      btn.addEventListener('click', () => setActiveView('forgot'));
    });
  }

  function bindFormEvents() {
    // ① ログイン
    if (formSignin) {
      formSignin.addEventListener('submit', (e) => {
        e.preventDefault();
        setError('signin', '');

        const form = e.currentTarget;
        const email = form.email.value.trim();
        const password = form.password.value;
        const remember = form.remember.checked;

        let msg = validateEmail(email);
        if (!msg) {
          msg = validatePassword(password, { min: 8 });
        }

        if (msg) {
          setError('signin', msg);
          return;
        }

        // 擬似ログイン成功
        saveSession(remember);
        renderSessionStatus();

        // 入力欄を軽くリセット
        form.password.value = '';

        // アカウントタブへ遷移
        setActiveView('account');
      });
    }

    // ② 新規登録（入力チェックのみ）
    if (formSignup) {
      formSignup.addEventListener('submit', (e) => {
        e.preventDefault();
        setError('signup', '');

        const form = e.currentTarget;
        const email = form.email.value.trim();
        const password = form.password.value;
        const confirm = form.passwordConfirm.value;

        let msg = validateEmail(email);
        if (!msg) {
          msg = validatePassword(password, { min: 8 });
        }
        if (!msg && password !== confirm) {
          msg = 'パスワード（確認）が一致していません。';
        }

        if (msg) {
          setError('signup', msg);
          return;
        }

        // 実際のメール送信は行わないので、軽いフィードバックだけ
        setError('signup', '入力内容を確認しました。認証コード送信はデモのため行われません。');
      });
    }

    // ③ パスワード再設定（メール送信側）
    if (formForgot) {
      formForgot.addEventListener('submit', (e) => {
        e.preventDefault();
        setError('forgot', '');

        const form = e.currentTarget;
        const email = form.email.value.trim();

        const msg = validateEmail(email);
        if (msg) {
          setError('forgot', msg);
          return;
        }

        setError('forgot', '認証コード送信のイメージです（デモのため送信はされません）。');
      });
    }

    // ③-2 新しいパスワード設定
    if (formReset) {
      formReset.addEventListener('submit', (e) => {
        e.preventDefault();
        setError('reset', '');

        const form = e.currentTarget;
        const code = form.resetCode.value.trim();
        const password = form.newPassword.value;
        const confirm = form.newPasswordConfirm.value;

        let msg = '';
        if (!code) {
          msg = '認証コードを入力してください。';
        } else {
          msg = validatePassword(password, { min: 8 });
        }
        if (!msg && password !== confirm) {
          msg = 'パスワード（確認）が一致していません。';
        }

        if (msg) {
          setError('reset', msg);
          return;
        }

        setError('reset', 'パスワードを再設定しました（デモ）。');
      });
    }

    // ④ パスワード変更
    if (formChange) {
      formChange.addEventListener('submit', (e) => {
        e.preventDefault();
        setError('change', '');

        const form = e.currentTarget;
        const current = form.currentPassword.value;
        const next = form.newPassword.value;

        let msg = '';
        if (!current) {
          msg = '現在のパスワードを入力してください（デモ）。';
        } else {
          msg = validatePassword(next, { min: 8 });
        }

        if (msg) {
          setError('change', msg);
          return;
        }

        setError('change', 'パスワードを変更しました（デモ）。');
        form.currentPassword.value = '';
        form.newPassword.value = '';
      });
    }
  }

  function bindMiscEvents() {
    // ログアウトボタン（アカウント／デバイス共通）
    logoutButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        clearSession();
        renderSessionStatus();
        setActiveView('signin');
      });
    });

    // 「デバイス一覧へ」ボタン
    goDevicesButtons.forEach((btn) => {
      btn.addEventListener('click', () => setActiveView('devices'));
    });
  }

  // 6. Init

  function init() {
    if (!tabs.length || !panels.length) return;

    // 保存済みセッションを読み込み
    loadSession();
    ensureSessionValidity();
    renderSessionStatus();

    // 起動時のタブ（ログイン中であればアカウントへ）
    if (session.loggedIn) {
      currentView = 'account';
    } else {
      currentView = 'signin';
    }
    setActiveView(currentView);

    // イベント登録
    bindTabEvents();
    bindFormEvents();
    bindMiscEvents();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
