/**
 * /assets/include.js
 *
 * Pattern:
 *   - 共通レイアウトインクルード + nav.active + 年号の自動挿入
 * Usage:
 *   - 各ページで <script src="/assets/include.js" defer></script> を読み込む
 *   - <div data-include="/partials/header.html"></div> のような要素に HTML を挿入する
 *
 * Notes:
 *   - 1ページ内に複数の data-include があっても問題ない
 *   - 読み込み後に nav.active と フッター年号 (#y) をセットする
 */

document.addEventListener('DOMContentLoaded', () => {
  const includeTargets = document.querySelectorAll('[data-include]');
  if (!includeTargets.length) {
    applyNavActive();
    applyFooterYear();
    return;
  }

  let loadedCount = 0;

  includeTargets.forEach(el => {
    const url = el.getAttribute('data-include');
    if (!url) {
      onIncluded();
      return;
    }

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`include failed: ${url} (${res.status})`);
        return res.text();
      })
      .then(html => {
        el.innerHTML = html;
      })
      .catch(err => {
        console.error('[include.js] include error:', err);
        el.innerHTML = '<!-- include error -->';
      })
      .finally(onIncluded);
  });

  function onIncluded() {
    loadedCount++;
    if (loadedCount >= includeTargets.length) {
      // すべての partial 挿入が終わってから nav.active / 年号をセット
      applyNavActive();
      applyFooterYear();
    }
  }
});

/**
 * 現在のパスに応じて header/footer の .nav に .active を付与
 */
function applyNavActive() {
  const path = window.location.pathname || '/';
  const navLinks = document.querySelectorAll('a.nav');

  navLinks.forEach(a => {
    const href = a.getAttribute('href') || '';
    // ルートは完全一致、それ以外は前方一致でざっくり判定
    const isRoot = href === '/' && path === '/';
    const isMatch = !isRoot && href !== '/' && path.startsWith(href);

    if (isRoot || isMatch) {
      a.classList.add('active');
    } else {
      a.classList.remove('active');
    }
  });
}

/**
 * フッターの年号 (#y) を現在年で埋める
 */
function applyFooterYear() {
  const el = document.getElementById('y');
  if (!el) return;
  const year = new Date().getFullYear();
  el.textContent = year;
}
