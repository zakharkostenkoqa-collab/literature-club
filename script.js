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

function initials(name) {
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

/* ---------- Учасники (у шапці) ---------- */
async function renderHeaderParticipants() {
  const data = await loadJSON('data/participants.json');
  const box = document.getElementById('header-participants');
  box.innerHTML = data.members.map(m => `
    <div class="mini-avatar">
      ${m.photo
        ? `<img class="mini-avatar-img" src="${m.photo}" alt="${m.name}" title="${m.name}">`
        : `<div class="mini-avatar-img mini-avatar-initials" title="${m.name}">${initials(m.name)}</div>`}
      <span class="mini-avatar-name">${m.name}</span>
    </div>`).join('');
}

/* ---------- Статистика (у шапці) ---------- */
async function renderHeaderStats() {
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
    { label: 'зустрічей', value: totalMeetings },
    { label: 'балів разом', value: totalPoints },
    { label: 'питань', value: totalQuestions }
  ];

  const allCards = [...autoCards, ...manualStats.manual];

  const box = document.getElementById('header-stats');
  box.innerHTML = allCards.map(c => `
    <div class="mini-stat">
      <span class="mini-stat-value">${c.value}</span>
      <span class="mini-stat-label">${c.label}</span>
    </div>`).join('');
}

/* ---------- Вікторина (по одному питанню) ---------- */
async function renderQuiz() {
  const data = await loadJSON('data/quiz.json');
  const box = document.getElementById('quiz-content');
  const resultBox = document.getElementById('quiz-result');
  resultBox.style.display = 'none';

  let current = 0;
  let score = 0;

  function renderQuestion() {
    const q = data.questions[current];
    box.innerHTML = '';

    const progress = el('div', 'quiz-progress', `Питання ${current + 1} з ${data.questions.length}`);
    box.appendChild(progress);

    const qDiv = el('div', 'quiz-q');
    qDiv.appendChild(el('p', 'q-text', q.q));

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

        if (current < data.questions.length - 1) {
          const nextBtn = el('button', 'reset-btn next-q-btn', 'Наступне питання →');
          nextBtn.type = 'button';
          nextBtn.addEventListener('click', () => {
            current++;
            renderQuestion();
          });
          box.appendChild(nextBtn);
        } else {
          resultBox.style.display = 'block';
          resultBox.textContent = `Ваш результат: ${score} / ${data.questions.length}. Повідомте цей бал ведучому для рейтингу.`;
        }
      });
      qDiv.appendChild(btn);
    });

    box.appendChild(qDiv);
  }

  renderQuestion();

  document.getElementById('quiz-reset').addEventListener('click', () => {
    current = 0;
    score = 0;
    resultBox.style.display = 'none';
    renderQuestion();
  });
}

/* ---------- Хронологія ---------- */
async function renderTimeline() {
  const data = await loadJSON('data/timeline.json');
  const box = document.getElementById('timeline-content');

  box.innerHTML = data.eras.map(e => `
    <div class="timeline-item">
      <div class="timeline-dot"></div>
      <div class="timeline-body">
        <div class="timeline-period">${e.period}</div>
        ${e.link
          ? `<a href="${e.link}" class="timeline-title-link"><h3>${e.title}</h3></a>`
          : `<h3>${e.title}</h3>`}
        <p>${e.note || ''}</p>
      </div>
    </div>`).join('');
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

/* ---------- Постаті (карусель) ---------- */
async function renderFigures() {
  const data = await loadJSON('data/figures.json');
  const track = document.getElementById('figures-content');
  const dotsBox = document.getElementById('figures-dots');
  let current = 0;

  track.innerHTML = data.figures.map(f => `
    <div class="figure-card accent-${f.accent}">
      ${f.image
        ? `<img class="figure-avatar figure-avatar-photo" src="${f.image}" alt="${f.name}">`
        : `<div class="figure-avatar">${f.initials}</div>`}
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
  return data;
}

/* ---------- Мапа письменників ---------- */
async function renderWritersMap(figuresData) {
  const data = figuresData || await loadJSON('data/figures.json');
  const pointsBox = document.getElementById('writers-map-points');
  const infoBox = document.getElementById('writers-map-info');

  pointsBox.innerHTML = data.figures.map((f, i) => `
    <button class="map-point" data-i="${i}"
      style="left:${f.mapX}%; top:${f.mapY}%;"
      aria-label="${f.name}"></button>`).join('');

  function showInfo(f) {
    infoBox.innerHTML = `
      <strong class="map-info-name">${f.name}</strong> <span class="map-info-years">${f.years}</span><br>
      <span class="map-info-place">${f.place || ''}</span>
      <p>${f.note}</p>`;
  }

  pointsBox.querySelectorAll('.map-point').forEach(btn => {
    btn.addEventListener('click', () => {
      pointsBox.querySelectorAll('.map-point').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showInfo(data.figures[parseInt(btn.dataset.i, 10)]);
    });
  });
}

/* ---------- Init ---------- */
window.addEventListener('DOMContentLoaded', () => {
  renderHeaderParticipants().catch(e => console.error(e));
  renderHeaderStats().catch(e => console.error(e));
  renderQuiz().catch(e => console.error(e));
  renderTimeline().catch(e => console.error(e));
  renderNextTopic().catch(e => console.error(e));
  renderArchive().catch(e => console.error(e));
  renderFigures().then(data => renderWritersMap(data)).catch(e => console.error(e));
});
