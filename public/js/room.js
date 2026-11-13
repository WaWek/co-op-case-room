function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

function generateRoomId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function showToast(message, type = 'default') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hiding');
    toast.addEventListener('animationend', () => toast.remove());
  }, 3000);
}

(async () => {
  const params = new URLSearchParams(location.search);
  const caseId = params.get('case');
  let roomId = params.get('room');
  let role = params.get('role');

  const view = document.getElementById('room-view');

  if (!caseId) {
    view.innerHTML = '<p class="error">Не указан кейс.</p>';
    return;
  }

  if (!roomId) {
    roomId = generateRoomId();
    role = 'A';
    location.replace(
      `/room.html?case=${encodeURIComponent(caseId)}&room=${encodeURIComponent(roomId)}&role=A`
    );
    return;
  }

  if (!role || !['A', 'B'].includes(role)) role = 'A';

  let caseData;
  try {
    const res = await fetch(`/api/cases/${encodeURIComponent(caseId)}`);
    if (!res.ok) throw new Error('not found');
    caseData = await res.json();
  } catch {
    view.innerHTML = '<p class="error">Кейс не найден.</p>';
    return;
  }

  const partnerRole = role === 'A' ? 'B' : 'A';
  const myLabel = role === 'A' ? caseData.roleALabel : caseData.roleBLabel;
  const partnerLabel = partnerRole === 'A' ? caseData.roleALabel : caseData.roleBLabel;

  const myPairs = caseData.pairs.map(p => ({
    id: p.id,
    mine: role === 'A' ? p.a : p.b,
    partner: role === 'A' ? p.b : p.a,
    insight: p.insight
  }));

  view.innerHTML = `
    <div class="connection-status hidden" id="connection-status">
      <span class="dot" style="background: var(--danger); box-shadow: 0 0 8px var(--danger);"></span>
      Соединение потеряно. Пытаемся переподключиться...
    </div>

    <div class="room-header animate-fade-up">
      <div>
        <div class="room-badges">
          <span class="badge role-badge role-${role}">Роль: ${esc(myLabel)} (Ты)</span>
          <span class="badge partner-badge" id="partner-badge">Ждём партнёра...</span>
        </div>
        <h1>${esc(caseData.title)}</h1>
      </div>
    </div>

    <div class="share animate-fade-up delay-1">
      <div class="share-content">
        <h3>Пригласите партнёра</h3>
        <p class="muted small">Отправьте эту ссылку коллеге. Как только он откроет её, вы увидите это здесь.</p>
      </div>
      <div class="share-row">
        <input id="share-link" readonly />
        <button id="copy-link" class="btn primary" type="button">Скопировать ссылку</button>
      </div>
    </div>

    <div class="progress animate-fade-up delay-1">
      <div class="progress-bar"><div id="progress-fill"></div></div>
      <span id="progress-text">0 / ${myPairs.length}</span>
    </div>

    <div class="room-grid animate-fade-up delay-2" id="pairs"></div>

    <section class="questions animate-fade-up delay-2">
      <h2>Вопросы для обсуждения</h2>
      <div id="questions"></div>
    </section>

    <section class="decision-log hidden" id="decision-log">
      <div class="log-header">
        <div class="success-icon">✓</div>
        <h2>Разбор завершён</h2>
        <p class="muted">Вы собрали полную картину кейса. Скопируйте результат или вернитесь к другим проектам.</p>
      </div>
      <div id="log" class="log-content"></div>
      
      <div class="log-actions">
        <button id="copy-log" class="btn primary" type="button">Скопировать полный разбор</button>
        <a href="/" class="btn">Вернуться на главную</a>
      </div>
    </section>
  `;

  document.body.classList.add(`my-role-${role}`);

  const shareLink = document.getElementById('share-link');
  shareLink.value = `${location.origin}/room.html?case=${encodeURIComponent(caseId)}&room=${encodeURIComponent(roomId)}&role=${partnerRole}`;

  const copyBtn = document.getElementById('copy-link');
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareLink.value);
      showToast('Ссылка скопирована в буфер обмена', 'success');
    } catch {
      shareLink.select();
      document.execCommand('copy');
      showToast('Ссылка скопирована', 'success');
    }
  });

  const copyLogBtn = document.getElementById('copy-log');
  copyLogBtn.addEventListener('click', async () => {
    let text = `# Разбор кейса: ${caseData.title}\n\n`;
    myPairs.forEach(p => {
      text += `### ${p.mine.title} ↔ ${p.partner.title}\n`;
      text += `**${myLabel}:** ${p.mine.text}\n`;
      text += `**${partnerLabel}:** ${p.partner.text}\n`;
      text += `**Инсайт:** ${p.insight}\n\n`;
    });
    try {
      await navigator.clipboard.writeText(text);
      showToast('Полный разбор скопирован (Markdown)', 'success');
    } catch {
      showToast('Не удалось скопировать', 'error');
    }
  });

  const pairsEl = document.getElementById('pairs');
  myPairs.forEach(p => {
    const card = document.createElement('article');
    card.className = 'pair-card';
    card.dataset.pairId = p.id;
    card.innerHTML = `
      <div class="pair-side mine">
        <span class="side-label">${esc(myLabel)} (Ты)</span>
        <h3>${esc(p.mine.title)}</h3>
        <p>${esc(p.mine.text)}</p>
      </div>
      <div class="pair-side partner">
        <span class="side-label">${esc(partnerLabel)} (Партнёр)</span>
        <div class="partner-content"><p class="muted">Скрыто до обсуждения</p></div>
      </div>
      <label class="discuss-toggle">
        <input type="checkbox" data-pair-id="${esc(p.id)}" />
        <span>Отметить как обсуждённое</span>
      </label>
    `;
    pairsEl.appendChild(card);
  });

  const questionsEl = document.getElementById('questions');
  caseData.questions.forEach((q, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'question';
    wrap.innerHTML = `
      <label>${esc(q)}</label>
      <textarea data-q-index="${i}" rows="3" maxlength="500" placeholder="Твой ответ (до 500 символов)"></textarea>
      <div class="partner-answer muted small" data-q-partner="${i}">Партнёр пока не ответил</div>
    `;
    questionsEl.appendChild(wrap);
  });

  let ws;
  let reconnectAttempts = 0;
  let partnerWasPresent = false;
  let previouslyDiscussed = new Set();
  
  const maxReconnectAttempts = 5;
  const statusEl = document.getElementById('connection-status');
  const partnerBadge = document.getElementById('partner-badge');

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${proto}://${location.host}/ws?room=${encodeURIComponent(roomId)}&role=${role}&case=${encodeURIComponent(caseId)}`;
    ws = new WebSocket(wsUrl);

    ws.addEventListener('open', () => {
      statusEl.classList.add('hidden');
      reconnectAttempts = 0;
      if (reconnectAttempts > 0) showToast('Соединение восстановлено', 'success');
    });

    ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === 'state') applyState(msg.state);
    });

    ws.addEventListener('close', () => {
      statusEl.classList.remove('hidden');
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        setTimeout(connect, 2000 * reconnectAttempts);
      } else {
        statusEl.innerHTML = '<span class="dot" style="background: var(--danger);"></span> Соединение потеряно. Обновите страницу.';
      }
    });
    
    ws.addEventListener('error', () => ws.close());
  }

  connect();

  const answerTimers = {};
  pairsEl.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('input[type="checkbox"][data-pair-id]')) {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'toggle-discuss', pairId: t.dataset.pairId }));
      }
    }
  });

  questionsEl.addEventListener('input', (e) => {
    const t = e.target;
    if (!t.matches('textarea[data-q-index]')) return;
    const i = Number(t.dataset.qIndex);
    clearTimeout(answerTimers[i]);
    answerTimers[i] = setTimeout(() => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'answer', qIndex: i, text: t.value }));
      }
    }, 300);
  });

  function applyState(s) {
    if (!s) return;

    // Проверяем статус партнёра
    const isPartnerPresent = !!s.present[partnerRole];
    if (isPartnerPresent && !partnerWasPresent) {
      partnerBadge.innerHTML = `🟢 Партнёр в сети (${esc(partnerLabel)})`;
      partnerBadge.classList.add('online');
      if (partnerWasPresent !== null) showToast('Партнёр подключился к комнате!', 'success');
    } else if (!isPartnerPresent && partnerWasPresent) {
      partnerBadge.innerHTML = '🔴 Партнёр отключился';
      partnerBadge.classList.remove('online');
    }
    partnerWasPresent = isPartnerPresent;

    // Обновляем прогресс
    const total = myPairs.length;
    const done = myPairs.filter(p => s.discussed.includes(p.id)).length;
    document.getElementById('progress-text').textContent = `${done} / ${total}`;
    document.getElementById('progress-fill').style.width = total ? `${(done / total) * 100}%` : '0%';

    // Обновляем карточки
    document.querySelectorAll('.pair-card').forEach(card => {
      const pid = card.dataset.pairId;
      const isDone = s.discussed.includes(pid);
      
      // Уведомление, если партнёр только что отметил карточку
      if (isDone && !previouslyDiscussed.has(pid) && !card.querySelector('input').matches(':checked')) {
         showToast(`Партнёр отметил: ${myPairs.find(p=>p.id===pid).mine.title}`, 'success');
      }
      
      card.classList.toggle('discussed', isDone);
      const cb = card.querySelector('input[type="checkbox"]');
      if (cb) cb.checked = isDone;

      const p = myPairs.find(x => x.id === pid);
      if (!p) return;
      const partnerBox = card.querySelector('.partner-content');
      if (isDone) {
        // Если текст ещё не вставлен, вставляем его с анимацией
        if (!partnerBox.dataset.revealed) {
          partnerBox.innerHTML = `<h3>${esc(p.partner.title)}</h3><p class="reveal-text">${esc(p.partner.text)}</p>`;
          partnerBox.dataset.revealed = "true";
        }
      } else {
        partnerBox.innerHTML = '<p class="muted">Скрыто до обсуждения</p>';
        delete partnerBox.dataset.revealed;
      }
    });
    previouslyDiscussed = new Set(s.discussed);

    // Обновляем ответы на вопросы
    document.querySelectorAll('textarea[data-q-index]').forEach(t => {
      if (document.activeElement === t) return;
      const i = t.dataset.qIndex;
      const myVal = role === 'A' ? s.answers.A?.[i] : s.answers.B?.[i];
      if (myVal !== undefined && t.value !== myVal) t.value = myVal;
    });

    document.querySelectorAll('.partner-answer').forEach(el => {
      const i = el.dataset.qPartner;
      const partnerVal = partnerRole === 'A' ? s.answers.A?.[i] : s.answers.B?.[i];
      if (partnerVal) {
        el.innerHTML = `<strong>Партнёр:</strong> ${esc(partnerVal)}`;
        el.style.color = "var(--text)";
      } else {
        el.textContent = 'Партнёр пока не ответил';
        el.style.color = "var(--muted)";
      }
    });

    // Показываем Decision Log
    const allDone = total > 0 && done === total;
    const logSection = document.getElementById('decision-log');
    logSection.classList.toggle('hidden', !allDone);
    
    if (allDone) {
      const log = document.getElementById('log');
      log.innerHTML = myPairs.map(p => `
        <div class="log-item animate-fade-up">
          <h4>${esc(p.mine.title)} <span style="color:var(--muted)">↔</span> ${esc(p.partner.title)}</h4>
          <p><strong>${esc(myLabel)}:</strong> ${esc(p.mine.text)}</p>
          <p><strong>${esc(partnerLabel)}:</strong> ${esc(p.partner.text)}</p>
          <p class="insight"><strong>Инсайт:</strong> ${esc(p.insight)}</p>
        </div>
      `).join('');
      
      // Скролл к логу, если он только что появился
      if (!logSection.dataset.seen) {
        setTimeout(() => logSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
        logSection.dataset.seen = "true";
      }
    }
  }
})();