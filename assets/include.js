// /assets/include.js
async function injectPartials() {
  const nodes = document.querySelectorAll('[data-include]');
  for (const el of nodes) {
    const url = el.getAttribute('data-include');
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Fetch failed: ${url}`);
      const html = await res.text();
      const tmp = document.createElement('div');
      tmp.innerHTML = html;

      // (任意) 内部scriptも実行したい場合の処理
      const scripts = tmp.querySelectorAll('script');
      scripts.forEach(s => {
        const ns = document.createElement('script');
        if (s.src) ns.src = s.src; else ns.textContent = s.textContent;
        s.replaceWith(ns);
      });

      el.replaceWith(...Array.from(tmp.childNodes)); // 安全に展開
    } catch (e) {
      console.error('include error:', url, e);
    }
  }

  // 年号（footer内の #y に代入）
  const y = document.getElementById('y');
  if (y) y.textContent = new Date().getFullYear();

  // ▼ 追加：現在ページに応じて nav.active を付与
  const path = location.pathname.replace(/\/$/, '') || '/';
  document.querySelectorAll('a.nav').forEach(a => {
    const href = a.getAttribute('href');
    // トップ（/）は完全一致、それ以外は前方一致で判定
    const match = (href === '/' && path === '/') || (href !== '/' && path.startsWith(href));
    if (match) a.classList.add('active');
  });
}
document.addEventListener('DOMContentLoaded', injectPartials);
