// Завантажує всі data/*.json файли і рендерить контент. Нічого не треба збирати —
// просто редагуйте JSON-файли в data/, і сторінка при наступному відкритті покаже нове.

async function loadJSON(path) {
  const res = await fetch(path + '?v=' + Date.now()); // уникаємо кешу застарілого файлу
  if (!res.ok) throw new Error('Не вдалося завантажити ' + path);
  return res.json();
}

function el(tag, className, html) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

/* ---------- Вікторина ---------- */
async function renderQuiz() {
  const data = await loadJSON('data/quiz.json');
  const box = document.getElementById('quiz-content');
  box.innerHTML = '';
  let score = 0;
  let answered = 0;

  data.questions.forEach((q, qi) => {
    const qDiv = el('div', 'quiz-q');
    qDiv.appendChild(el('p', 'q-text', `${qi + 1}. ${q.q}`));
    q.options.forEach((opt, oi) => {
      const btn = el('button', 'opt', opt);
      btn.type = 'button';
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        const allBtns = qDiv.querySelectorAll('.opt');
        allBtns.forEach(b => b.disabled = true);
        if (oi === q.correct) {
          btn.classList.add('correct');
          score++;
        } else {
          btn.classList.add('wrong');
          allBtns[q.correct].classList.add('correct');
        }
        answered++;
        if (answered === data.questions.length) showResult(score, data.questions.length);
      });
      qDiv.appendChild(btn);
    });
    box.appendChild(qDiv);
  });

  function showResult(score, total) {
    const resultBox = document.getElementById('quiz-result');
    resultBox.style.display = 'block';
    resultBox.textContent = `Ваш результат: ${score} / ${total}. Повідомте цей бал ведучому для рейтингу.`;
  }

  document.getElementById('quiz-reset').addEventListener('click', () => {
    document.getElementById('quiz-result').style.display = 'none';
    renderQuiz();
  });
}

/* ---------- Архів ---------- */
async function renderArchive() {
  const data = await loadJSON('data/archive.json');
  const box = document.getElementById('archive-content');
  box.innerHTML = '';
  data.meetings.forEach(m => {
    const row = el('div', 'archive-item');
    row.innerHTML = `
      <span class="num">№ ${m.number}</span>
      <span class="date">${m.date}</span>
      <a href="${m.link}" target="_blank" rel="noopener">${m.title}</a>`;
    box.appendChild(row);
  });
}

/* ---------- Рейтинг ---------- */
async function renderLeaderboard() {
  const data = await loadJSON('data/leaderboard.json');
  const box = document.getElementById('leaderboard-content');
  const totals = data.participants.map(() => 0);
  data.rounds.forEach(r => r.scores.forEach((s, i) => totals[i] += s));

  let rows = '';
  data.rounds.forEach(r => {
    rows += `<tr><td>Засідання № ${r.meetingNumber}</td>${r.scores.map(s => `<td>${s}</td>`).join('')}</tr>`;
  });

  box.innerHTML = `
    <table class="ledger">
      <thead>
        <tr><th>Зустріч</th>${data.participants.map(p => `<th>${p}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="total"><td>Всього</td>${totals.map(t => `<td>${t}</td>`).join('')}</tr>
      </tbody>
    </table>`;
}

/* ---------- Наступна зустріч ---------- */
async function renderNextTopic() {
  const data = await loadJSON('data/next-topic.json');
  const box = document.getElementById('next-topic-content');

  if (!data.title) {
    box.innerHTML = `
      <div class="card card-next-empty">
        <p class="empty-note">Тему ще не визначено. Впишіть її в data/next-topic.json, коли домовитесь.</p>
      </div>`;
    return;
  }

  box.innerHTML = `
    <div class="card">
      <div class="stamp stamp-next">${data.status || 'ОЧІКУЄМО'}</div>
      <div class="meta-row">Засідання № ${data.meetingNumber} · ${data.date}</div>
      <h3>${data.title}</h3>
      <p class="subtitle">${data.subtitle || ''}</p>
      <p>${data.intro || ''}</p>
    </div>`;
}

/* ---------- Статистика ---------- */
async function renderStats() {
  const [archive, quiz, leaderboard, manualStats] = await Promise.all([
    loadJSON('data/archive.json'),
    loadJSON('data/quiz.json'),
    loadJSON('data/leaderboard.json'),
    loadJSON('data/stats.json')
  ]);

  const totalMeetings = archive.meetings.length;
  const totalQuestions = leaderboard.rounds.length * quiz.questions.length;
  const totalPoints = leaderboard.rounds.reduce(
    (sum, r) => sum + r.scores.reduce((a, b) => a + b, 0), 0
  );

  const autoCards = [
    { label: 'Зустрічей проведено', value: totalMeetings },
    { label: 'Учасників клубу', value: leaderboard.participants.length },
    { label: 'Питань у вікторинах', value: totalQuestions },
    { label: 'Балів набрано разом', value: totalPoints }
  ];

  const allCards = [...autoCards, ...manualStats.manual];

  const box = document.getElementById('stats-content');
  box.innerHTML = allCards.map(c => `
    <div class="stat-card">
      <div class="stat-value">${c.value}</div>
      <div class="stat-label">${c.label}</div>
    </div>`).join('');
}

/* ---------- Постаті (карусель) ---------- */
async function renderFigures() {
  const data = await loadJSON('data/figures.json');
  const track = document.getElementById('figures-content');
  const dotsBox = document.getElementById('figures-dots');
  let current = 0;

  track.innerHTML = data.figures.map(f => `
    <div class="figure-card accent-${f.accent}">
      <div class="figure-avatar">${f.initials}</div>
      <h3>${f.name}</h3>
      <div class="figure-years">${f.years} · ${f.category}</div>
      <p class="figure-note">${f.note}</p>
      ${f.quote ? `<p class="figure-quote">«${f.quote}»</p>` : ''}
    </div>`).join('');

  dotsBox.innerHTML = data.figures.map((_, i) =>
    `<button class="dot" data-i="${i}" aria-label="Постать ${i + 1}"></button>`
  ).join('');

  const cards = track.querySelectorAll('.figure-card');
  const dots = dotsBox.querySelectorAll('.dot');

  function show(i) {
    current = (i + data.figures.length) % data.figures.length;
    cards.forEach((c, idx) => c.classList.toggle('active', idx === current));
    dots.forEach((d, idx) => d.classList.toggle('active', idx === current));
  }

  dots.forEach(d => d.addEventListener('click', () => show(parseInt(d.dataset.i, 10))));
  document.getElementById('fig-prev').addEventListener('click', () => show(current - 1));
  document.getElementById('fig-next').addEventListener('click', () => show(current + 1));

  show(0);
}

/* ---------- Матеріали ---------- */
async function renderMaterials() {
  const data = await loadJSON('data/materials.json');
  const box = document.getElementById('materials-content');
  box.innerHTML = '';
  data.groups.forEach(g => {
    const group = el('div', 'materials-group');
    group.appendChild(el('h3', null, g.heading));
    const ul = el('ul');
    g.items.forEach(item => {
      const li = el('li');
      li.innerHTML = `<a href="${item.link}" target="_blank" rel="noopener">${item.label}</a>`;
      ul.appendChild(li);
    });
    group.appendChild(ul);
    box.appendChild(group);
  });
}

/* ---------- Init ---------- */
window.addEventListener('DOMContentLoaded', () => {
  renderNextTopic().catch(e => console.error(e));
  renderStats().catch(e => console.error(e));
  renderQuiz().catch(e => console.error(e));
  renderFigures().catch(e => console.error(e));
  renderArchive().catch(e => console.error(e));
  renderLeaderboard().catch(e => console.error(e));
  renderMaterials().catch(e => console.error(e));
});
