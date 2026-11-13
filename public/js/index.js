const listEl = document.getElementById('cases');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

try {
  const res = await fetch('/api/cases');
  const cases = await res.json();
  
  if (!cases.length) {
    listEl.innerHTML = '<li class="empty">Пока нет кейсов.</li>';
  } else {
    listEl.innerHTML = cases.map((c, index) => `
      <li class="case-card" style="animation-delay: ${0.3 + (index * 0.1)}s">
        <a href="/case.html?id=${encodeURIComponent(c.id)}">
          <div class="card-header">
            <span class="card-role">${esc(c.role || 'Проект')}</span>
          </div>
          <h2>${esc(c.title)}</h2>
          <p>${esc(c.summary)}</p>
          <div class="card-footer">
            <ul class="tags">
              ${(c.tags || []).map(t => `<li>${esc(t)}</li>`).join('')}
            </ul>
            <span class="cta">Открыть →</span>
          </div>
        </a>
      </li>
    `).join('');
  }
} catch (e) {
  listEl.innerHTML = '<li class="empty">Не удалось загрузить кейсы.</li>';
}