function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

const params = new URLSearchParams(location.search);
const id = params.get('id');
const view = document.getElementById('case-view');

if (!id) {
  view.innerHTML = '<p class="error" style="text-align:center">Кейс не указан. <a href="/">Вернуться на главную</a></p>';
} else {
  try {
    const res = await fetch(`/api/cases/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error('not found');
    const c = await res.json();
    
    document.title = `${c.title} — Co-op Case Room`;
    
    // Рендерим страницу
    view.innerHTML = `
      <header class="case-hero animate-fade-up">
        <div class="case-meta">
          <span class="card-role">${esc(c.role || 'Проект')}</span>
        </div>
        <h1>${esc(c.title)}</h1>
        <p class="lead">${esc(c.summary)}</p>
      </header>

      <div class="solo-grid animate-fade-up delay-1">
        <section class="solo-block problem-block">
          <h3>Проблема</h3>
          <p>${esc(c.solo?.problem || '')}</p>
        </section>
        <section class="solo-block solution-block">
          <h3>Решение</h3>
          <p>${esc(c.solo?.solution || '')}</p>
        </section>
        <section class="solo-block result-block">
          <h3>Результат</h3>
          <p>${esc(c.solo?.result || '')}</p>
        </section>
        <section class="solo-block stack-block">
          <h3>Стек</h3>
          <ul class="chips">
            ${(c.solo?.stack || []).map(s => `<li>${esc(s)}</li>`).join('')}
          </ul>
        </section>
      </div>

      <div class="coop-cta animate-fade-up delay-2">
        <div class="coop-cta-content">
          <h3>Хотите узнать детали?</h3>
          <p class="muted">В соло-версии видны только факты. Нажмите кнопку, чтобы открыть кооп-комнату. Вы получите одну половину контекста, ваш партнёр — другую. Вместе вы соберёте полный Decision Log.</p>
        </div>
        <a class="btn primary btn-large" href="/room.html?case=${encodeURIComponent(c.id)}">
          Разобрать вдвоём →
        </a>
      </div>
    `;
  } catch (err) {
    view.innerHTML = '<p class="error" style="text-align:center; padding: 40px 0;">Кейс не найден или произошла ошибка. <br><br><a href="/" class="btn">Вернуться на главную</a></p>';
  }
}