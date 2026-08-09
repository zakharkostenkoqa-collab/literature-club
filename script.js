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

/* ---------- Відмінювання слова «шаг» ---------- */
function pluralShah(n) {
  const abs = Math.abs(n);
  const last = abs % 10;
  const lastTwo = abs % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return 'шагів';
  if (last === 1) return 'шаг';
  if (last >= 2 && last <= 4) return 'шаги';
  return 'шагів';
}

/* Мінімалістична монетка (шаг — староукраїнська монета) */
const COIN_SVG = `<svg class="coin-icon" viewBox="0 0 12 12" aria-hidden="true">
  <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" stroke-width="1.2"/>
  <circle cx="6" cy="6" r="1.6" fill="currentColor"/>
</svg>`;

/* ---------- Учасники (у шапці) ---------- */
async function renderHeaderParticipants() {
  const data = await loadJSON('data/participants.json');
  const box = document.getElementById('header-participants');
  box.innerHTML = data.members.map(m => {
    const score = m.rating ?? 0;
    return `
    <div class="mini-avatar">
      ${m.photo
        ? `<img class="mini-avatar-img" src="${m.photo}" alt="${m.name}" title="${m.name}">`
        : `<div class="mini-avatar-img mini-avatar-initials" title="${m.name}">${initials(m.name)}</div>`}
      <span class="mini-avatar-name">${m.name}</span>
      <span class="mini-avatar-ratinglabel">рейтинг</span>
      <span class="mini-avatar-rating">${COIN_SVG}${score} ${pluralShah(score)}</span>
    </div>`;
  }).join('');
}

/* ---------- Статистика (у шапці) ---------- */
async function renderHeaderStats() {
  const [archive, manualStats] = await Promise.all([
    loadJSON('data/archive.json'),
    loadJSON('data/stats.json')
  ]);

  const totalMeetings = archive.meetings.length;

  const CLUB_FOUNDED = new Date('2026-08-01T00:00:00');
  const today = new Date();
  const daysSinceFounded = Math.max(0, Math.floor((today - CLUB_FOUNDED) / (1000 * 60 * 60 * 24)));

  const autoCards = [
    { label: 'зустрічей', value: totalMeetings },
    { label: 'днів існує клуб', value: daysSinceFounded }
  ];

  const allCards = [...autoCards, ...manualStats.manual];

  const box = document.getElementById('header-stats');
  box.innerHTML = allCards.map(c => `
    <div class="mini-stat">
      <span class="mini-stat-value">${c.value}</span>
      <span class="mini-stat-label">${c.label}</span>
    </div>`).join('');
}

/* ---------- Хронологія (горизонтально) ---------- */
async function renderTimeline() {
  const data = await loadJSON('data/timeline.json');
  const box = document.getElementById('timeline-content');

  box.innerHTML = data.eras.map(e => `
    <div class="timeline-h-item">
      <div class="timeline-h-dot"></div>
      <div class="timeline-h-period">${e.period}</div>
      ${e.link
        ? `<a href="${e.link}" class="timeline-title-link"><h3>${e.title}</h3></a>`
        : `<h3>${e.title}</h3>`}
      <p>${e.note || ''}</p>
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
}

/* ---------- Вікторина «Перевірка на тигролова» ---------- */
const POINTS_PER_CORRECT = 8;

function getTitleForScore(correctCount) {
  if (correctCount <= 5) return { name: 'Мишолов', emoji: '🐭' };
  if (correctCount <= 8) return { name: 'Тигреня', emoji: '🐯' };
  return { name: 'Приборкувач драконів', emoji: '🐉' };
}

async function renderQuiz() {
  const data = await loadJSON('data/quiz.json');
  const box = document.getElementById('quiz-content');
  const resultBox = document.getElementById('quiz-result');
  resultBox.style.display = 'none';
  resultBox.className = '';

  let current = 0;
  let correctCount = 0;

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
          correctCount++;
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
          const points = correctCount * POINTS_PER_CORRECT;
          const title = getTitleForScore(correctCount);
          resultBox.style.display = 'block';
          resultBox.classList.add('quiz-title-result');
          resultBox.innerHTML = `
            <div class="quiz-title-emoji">${title.emoji}</div>
            <div class="quiz-title-name">${title.name}</div>
            <div class="quiz-title-score">Правильних відповідей: ${correctCount} з ${data.questions.length} · ${points} шагів</div>
            <div class="quiz-title-hint">Повідомте цей результат ведучому для рейтингу.</div>`;
        }
      });
      qDiv.appendChild(btn);
    });

    box.appendChild(qDiv);
  }

  renderQuestion();

  document.getElementById('quiz-reset').addEventListener('click', () => {
    current = 0;
    correctCount = 0;
    resultBox.style.display = 'none';
    renderQuestion();
  });
}

/* ---------- Наступна зустріч ---------- */
async function renderNextTopic() {
  const data = await loadJSON('data/next-topic.json');
  const box = document.getElementById('next-topic-content');

  if (!data.title) {
    box.innerHTML = `<div class="card card-next-empty"><p class="empty-note">Тему ще не визначено.</p></div>`;
    return;
  }

  const blocksHTML = data.blocks ? data.blocks.map(b => `
    <div class="block-row">
      <span class="block-num">${b.num}</span>
      <span class="block-period">${b.period}</span>
      <span class="block-title">${b.title}</span>
      ${b.map
        ? `<button class="map-btn" onclick="openMapModal('${b.map}', '${b.title}')" title="Переглянути карту">🗺</button>`
        : `<span class="map-btn-empty" title="Карта готується">···</span>`}
    </div>`).join('') : '';

  box.innerHTML = `
    <div class="card next-topic-card">
      <div class="stamp stamp-next">${data.status || 'ОЧІКУЄМО'}</div>
      <div class="meta-row">Засідання № ${data.meetingNumber} · ${data.date}</div>
      <h3>${data.title}</h3>
      <p class="subtitle">${data.subtitle || ''}</p>
      <p class="next-intro">${data.intro || ''}</p>
      ${blocksHTML ? `<div class="blocks-list">${blocksHTML}</div>` : ''}
    </div>`;
}

/* ---------- Модальне вікно карти ---------- */
function openMapModal(mapPath, title) {
  const existing = document.getElementById('map-modal');
  if (existing) existing.remove();

  // Розпізнаємо тип файлу: зображення показуємо через <img>, решту — в <iframe>
  const isImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(mapPath);

  const body = isImage
    ? `<div class="modal-imgwrap"><img class="modal-img" src="${mapPath}" alt="${title}"></div>`
    : `<iframe class="modal-iframe" src="${mapPath}" title="${title}"></iframe>`;

  const modal = document.createElement('div');
  modal.id = 'map-modal';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="closeMapModal()"></div>
    <div class="modal-box">
      <div class="modal-header">
        <span class="modal-title">${title}</span>
        <a class="modal-open-new" href="${mapPath}" target="_blank" rel="noopener" title="Відкрити в новій вкладці">↗</a>
        <button class="modal-close" onclick="closeMapModal()" title="Закрити">✕</button>
      </div>
      ${body}
    </div>`;
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
}

function closeMapModal() {
  const modal = document.getElementById('map-modal');
  if (modal) modal.remove();
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeMapModal();
});

/* ---------- Init ---------- */
window.addEventListener('DOMContentLoaded', () => {
  renderHeaderParticipants().catch(e => console.error(e));
  renderHeaderStats().catch(e => console.error(e));
  renderTimeline().catch(e => console.error(e));
  renderFigures().catch(e => console.error(e));
  renderQuiz().catch(e => console.error(e));
  renderNextTopic().catch(e => console.error(e));
});
