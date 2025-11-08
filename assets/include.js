<!-- どのページでも body の最後で読み込む -->
<script>
document.addEventListener('DOMContentLoaded', async () => {
  const targets = document.querySelectorAll('[data-include]');
  for (const el of targets) {
    const url = el.getAttribute('data-include');
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Fetch failed: ${url}`);
      const html = await res.text();
      el.outerHTML = html; // プレースホルダごと置換
    } catch (e) {
      console.error(e);
    }
  }
});
</script>
