<script>
document.addEventListener('DOMContentLoaded', async () => {
  const targets = document.querySelectorAll('[data-include]');
  for (const el of targets) {
    const url = el.getAttribute('data-include');
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Fetch failed: ${url}`);
      const html = await res.text();
      el.outerHTML = html;
    } catch (e) { console.error(e); }
  }

  // 置換後に実行されるよう、少し遅らせて active を付与
  setTimeout(() => {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    document.querySelectorAll('a.nav').forEach(a => {
      const href = a.getAttribute('href');
      // /index をトップ扱い
      const normalized = (href === '/index' ? '/' : href);
      if (normalized === path) a.classList.add('active');
    });
  }, 0);
});
</script>
