// /assets/include.js  ← <script>タグは不要
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
      // script要素も実行されるように差し替え処理
      const scripts = tmp.querySelectorAll('script');
      scripts.forEach(s => {
        const ns = document.createElement('script');
        if (s.src) ns.src = s.src; else ns.textContent = s.textContent;
        s.replaceWith(ns);
      });
      el.replaceWith(...tmp.childNodes);
    } catch (e) {
      console.error('include error:', url, e);
    }
  }

  // activeハイライト
  const path = location.pathname.replace(/\/+$/, '') || '/';
  document.querySelectorAll('a.nav').forEach(a => {
    const href = a.getAttribute('href');
    const normalized = (href === '/index' ? '/' : href);
    if (normalized === path) a.classList.add('active');
  });

  // 年号（footer内の #y に代入）
  const y = document.getElementById('y');
  if (y) y.textContent = new Date().getFullYear();
}

document.addEventListener('DOMContentLoaded', injectPartials);
