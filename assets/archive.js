/* 
  File: assets/archive.js
  Role: ARCHIVE_ITEMS から Archiveページ用のカードHTMLを生成して挿入する
  Pattern:
    1. 設定（なし）
    2. 状態（ARCHIVE_ITEMS をそのまま利用）
    3. DOM参照
    4. Utils（テンプレ生成）
    5. Render（一覧生成）
    6. Events（今はなし）
    7. Init（DOMContentLoaded）
*/

// 3. DOM参照
const archiveListEl = document.getElementById('archive-list');

/**
 * 4-1. カード1枚分のHTMLを生成
 * @param {object} item - ARCHIVE_ITEMS の1要素
 * @returns {string}   - <article>...</article> のHTML文字列
 */
function createArchiveCardHtml(item) {
  const {
    id,
    category,
    title,
    date,
    duration,
    status,
    lead,
    points,
    tags,
    link
  } = item;

  const timeDisplay = date || '';
  const datetimeAttr = date || '';

  const beforeText = points?.before || '';
  const howText = points?.how || '';
  const afterText = points?.after || '';

  const tagsHtml = (tags || [])
    .map(tag => `<span class="pill">${escapeHtml(tag)}</span>`)
    .join('');

  const linkHtml = link && link.href && link.label
    ? `
      <footer class="links">
        <a class="btn btn-primary" href="${encodeURI(link.href)}" target="_blank" rel="noopener">
          ${escapeHtml(link.label)}
        </a>
      </footer>
    `
    : '';

  return `
<article class="card-works" id="${escapeHtml(id)}">
  <header>
    <h3>［${escapeHtml(category)}］${escapeHtml(title)}</h3>
    <p class="meta">
      <time datetime="${escapeHtml(datetimeAttr)}">${escapeHtml(timeDisplay)}</time>
      <span>所要: ${escapeHtml(duration || '')}</span>
      <span>状態: ${escapeHtml(status || '')}</span>
    </p>
  </header>

  <p class="lead">
    ${escapeHtml(lead || '')}
  </p>

  <ul class="bullets">
    ${beforeText ? `<li>before：${escapeHtml(beforeText)}</li>` : ''}
    ${howText ? `<li>how：${escapeHtml(howText)}</li>` : ''}
    ${afterText ? `<li>after：${escapeHtml(afterText)}</li>` : ''}
  </ul>

  <p class="tags">
    ${tagsHtml}
  </p>
  ${linkHtml}
</article>`;
}

/**
 * 4-2. 簡易エスケープ関数
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 5. 一覧レンダリング
 */
function renderArchiveCards() {
  if (!archiveListEl || !Array.isArray(ARCHIVE_ITEMS)) return;

  // 必要ならここで date ソートなども可能
  const html = ARCHIVE_ITEMS
    // .slice().sort((a, b) => (a.date < b.date ? 1 : -1)) // 日付降順にしたい場合
    .map(createArchiveCardHtml)
    .join('\n\n');

  archiveListEl.innerHTML = html;
}

/**
 * 7. Init
 * （include.js とは別の DOMContentLoaded リスナーでOK）
 */
document.addEventListener('DOMContentLoaded', () => {
  renderArchiveCards();
});
