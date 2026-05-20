/**
 * Minimal markdown renderer.
 * Supports: ## h2, ### h3, **bold**, *italic*, - lists, paragraph breaks.
 * API is stable — swap internals here if richer markdown is ever needed.
 * @param {string} str
 * @returns {string} HTML string
 */
export function renderMarkdown(str) {
  if (!str) return '';

  const lines = str.split('\n');
  let html = '';
  let inList = false;

  for (const line of lines) {
    if (line.startsWith('### ')) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<h3>${inline(line.slice(4))}</h3>`;
    } else if (line.startsWith('## ')) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<h2>${inline(line.slice(3))}</h2>`;
    } else if (line.startsWith('- ')) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inline(line.slice(2))}</li>`;
    } else if (line.trim() === '') {
      if (inList) { html += '</ul>'; inList = false; }
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<p>${inline(line)}</p>`;
    }
  }

  if (inList) html += '</ul>';
  return html;
}

function inline(str) {
  return str
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}
