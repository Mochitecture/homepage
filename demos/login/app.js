/**
 * /demos/login/app.js
 * Pattern: Demo JS Pattern
 * Structure: config → state → DOM → util → render → events → init
 */

(() => {
  // 1. Config（なし）

  // 2. State
  let currentView = 'signin';

  // 3. DOM
  const tabs = Array.from(document.querySelectorAll('.login-tab'));
  const panels = Array.from(document.querySelectorAll('.login-panel'));

  // 4. Utils
  function setActiveView(view) {
    currentView = view;

    // タブの状態
    tabs.forEach((tab) => {
      const isActive = tab.dataset.view === view;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    // パネルの状態
    panels.forEach((panel) => {
      const isActive = panel.dataset.view === view;
      panel.classList.toggle('is-active', isActive);
      panel.hidden = !isActive;
    });
  }

  // 5. Events
  function bindEvents() {
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

  // 6. Init
  function init() {
    if (!tabs.length || !panels.length) return;
    setActiveView(currentView);
    bindEvents();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
