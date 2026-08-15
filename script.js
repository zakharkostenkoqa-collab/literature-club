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

/* Місця в рейтингу: однакова кількість шагів = однакове місце */
function buildRankMap(members) {
  const scores = [...new Set(members.map(m => m.rating ?? 0))]
    .filter(s => s > 0)
    .sort((a, b) => b - a);
  const map = new Map();
  scores.forEach((s, i) => map.set(s, i + 1));
  return map;
}

function medalClass(score, rankMap) {
  const rank = rankMap.get(score);
  if (rank === 1) return ' medal-gold';
  if (rank === 2) return ' medal-silver';
  if (rank === 3) return ' medal-bronze';
  return '';
}

/* ---------- Учасники (у шапці) ---------- */
async function renderHeaderParticipants() {
  const data = await loadJSON('data/participants.json');
  const box = document.getElementById('header-participants');
  const rankMap = buildRankMap(data.members);

  box.innerHTML = data.members.map(m => {
    const score = m.rating ?? 0;
    const medal = medalClass(score, rankMap);
    return `
    <div class="mini-avatar">
      ${m.photo
        ? `<img class="mini-avatar-img" src="${m.photo}" alt="${m.name}" title="${m.name}">`
        : `<div class="mini-avatar-img mini-avatar-initials" title="${m.name}">${initials(m.name)}</div>`}
      <span class="mini-avatar-name">${m.name}</span>
      <span class="mini-avatar-ratinglabel">рейтинг</span>
      <span class="mini-avatar-rating${medal}">${COIN_SVG}${score} ${pluralShah(score)}</span>
    </div>`;
  }).join('');
}

/* ---------- Таймер до зустрічі ---------- */
let countdownTimer = null;

function renderCountdown(cfg) {
  const box = document.getElementById('countdown');
  if (!box || !cfg || !cfg.target) return;

  const target = new Date(cfg.target);
  if (isNaN(target)) { console.error('Некоректна дата в countdown.target'); return; }

  function tick() {
    const diff = target - new Date();

    if (diff <= 0) {
      box.className = 'countdown countdown-reached';
      box.innerHTML = `<div class="countdown-reached-text">${cfg.reachedText || 'Час зустрітися!'}</div>`;
      if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
      return;
    }

    const d = Math.floor(diff / 86400000);
    const h = Math.floor(diff / 3600000) % 24;
    const m = Math.floor(diff / 60000) % 60;
    const s = Math.floor(diff / 1000) % 60;

    box.className = 'countdown';
    box.innerHTML = `
      <div class="countdown-units">
        <span class="cd-unit"><b>${d}</b><i>д</i></span>
        <span class="cd-sep">·</span>
        <span class="cd-unit"><b>${String(h).padStart(2,'0')}</b><i>год</i></span>
        <span class="cd-sep">·</span>
        <span class="cd-unit"><b>${String(m).padStart(2,'0')}</b><i>хв</i></span>
        <span class="cd-sep">·</span>
        <span class="cd-unit cd-secs"><b>${String(s).padStart(2,'0')}</b><i>с</i></span>
      </div>
      <div class="countdown-label">${cfg.label || ''}</div>`;
  }

  tick();
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(tick, 1000);
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

/* ---------- Хронологія (горизонтально, з панеллю книг) ---------- */
let timelineData = null;
let libraryData = null;
let figuresData = null;
let openEraIndex = null;

/* Книги певної епохи з бібліотеки */
function booksOfEra(eraTitle) {
  if (!libraryData) return [];
  return libraryData.books.filter(b => b.era === eraTitle);
}

/* Ім'я автора за id */
function authorName(authorId) {
  if (!figuresData) return authorId;
  const f = figuresData.figures.find(x => x.id === authorId);
  return f ? f.name : authorId;
}

function scoreClass(score) {
  if (score === null || score === undefined) return 'score-none';
  if (score >= 8) return 'score-high';
  if (score >= 6) return 'score-mid';
  return 'score-low';
}

/* Українською десятковий роздільник — кома: 9.4 → 9,4 */
function fmtScore(score) {
  return String(score).replace('.', ',');
}

function renderEraPanel(i) {
  const panel = document.getElementById('timeline-panel');
  const era = timelineData.eras[i];
  const books = booksOfEra(era.title);

  const booksHTML = books.map(b => {
    const hasScore = b.score !== null && b.score !== undefined;
    return `
      <div class="book-card">
        <div class="book-main">
          <div class="book-author">${authorName(b.authorId)}</div>
          <div class="book-title">«${b.title}»${b.year ? ` <span class="book-year">${b.year}</span>` : ''}</div>
          ${b.note ? `<div class="book-note">${b.note}</div>` : ''}
        </div>
        ${b.cover ? `<img class="book-cover" src="${b.cover}" alt="Обкладинка: ${b.title}" title="${b.title}">` : ''}
        <div class="book-meta">
          ${hasScore
            ? `<div class="book-score ${scoreClass(b.score)}"><span class="score-num">${fmtScore(b.score)}</span><span class="score-max">/10</span></div>
               <div class="book-score-label">оцінка клубу</div>`
            : `<div class="book-score score-none"><span class="score-num">—</span></div>
               <div class="book-score-label">ще не оцінено</div>`}
          ${b.meeting ? `<div class="book-meeting">засідання № ${b.meeting}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  panel.innerHTML = `
    <div class="panel-head">
      <div>
        <span class="panel-period">${era.period}</span>
        <span class="panel-title">${era.title}</span>
      </div>
      <button class="panel-close" onclick="closeEraPanel()" title="Згорнути">✕</button>
    </div>
    <div class="books-grid">${booksHTML}</div>`;
  panel.style.display = 'block';
}

function closeEraPanel() {
  const panel = document.getElementById('timeline-panel');
  panel.style.display = 'none';
  panel.innerHTML = '';
  openEraIndex = null;
  document.querySelectorAll('.timeline-h-item').forEach(el => el.classList.remove('era-open'));
}

function toggleEra(i) {
  if (openEraIndex === i) { closeEraPanel(); return; }
  openEraIndex = i;
  document.querySelectorAll('.timeline-h-item').forEach((el, idx) =>
    el.classList.toggle('era-open', idx === i));
  renderEraPanel(i);
}

async function renderTimeline() {
  const [tl, lib, figs] = await Promise.all([
    loadJSON('data/timeline.json'),
    loadJSON('data/library.json'),
    loadJSON('data/figures.json')
  ]);
  timelineData = tl;
  libraryData = lib;
  figuresData = figs;

  const box = document.getElementById('timeline-content');
  const eras = tl.eras;

  const doneCount = eras.filter(e => booksOfEra(e.title).length).length;
  const bookCount = lib.books.length;
  const pct = Math.round(doneCount / eras.length * 100);

  const progressBox = document.getElementById('timeline-progress');
  if (progressBox) {
    progressBox.innerHTML = `
      <div class="progress-row">
        <span class="progress-text">Пройдено ${doneCount} з ${eras.length} епох · ${bookCount} ${bookCount === 1 ? 'книга' : (bookCount >= 2 && bookCount <= 4 ? 'книги' : 'книг')}</span>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>`;
  }

  box.innerHTML = eras.map((e, i) => {
    const count = booksOfEra(e.title).length;
    const has = count > 0;
    return `
    <div class="timeline-h-item${has ? ' era-has-books' : ''}">
      <button class="timeline-h-dot${has ? ' dot-filled' : ' dot-empty'}"
        ${has ? `onclick="toggleEra(${i})" title="Показати прочитане"` : 'disabled title="Ще не читали"'}
        aria-label="${e.title}">${has && count > 1 ? `<span class="dot-count">${count}</span>` : ''}</button>
      <div class="timeline-h-period">${e.period}</div>
      ${e.link
        ? `<a href="${e.link}" class="timeline-title-link"><h3>${e.title}</h3></a>`
        : `<h3>${e.title}</h3>`}
      <p>${e.note || ''}</p>
    </div>`;
  }).join('');
}

/* ---------- Відомі українці (сітка з поступовим відкриттям) ---------- */
async function renderFigures() {
  const [figs, lib, tl] = await Promise.all([
    loadJSON('data/figures.json'),
    loadJSON('data/library.json'),
    loadJSON('data/timeline.json')
  ]);
  figuresData = figs;
  libraryData = lib;
  timelineData = timelineData || tl;

  const grid = document.getElementById('figures-grid');
  const progressBox = document.getElementById('figures-progress');

  // Книги, згруповані за автором
  const byAuthor = {};
  lib.books.forEach(b => {
    (byAuthor[b.authorId] = byAuthor[b.authorId] || []).push(b);
  });

  const total = figs.figures.length;
  const openedList = figs.figures.filter(f => byAuthor[f.id]);
  const opened = openedList.length;
  const pct = Math.round(opened / total * 100);

  // Поки відкритих мало — показуємо їх широкими картками, щоб не зяяли порожні колонки
  grid.className = 'figures-grid' + (opened > 0 && opened <= 2 ? ' figures-grid--few' : '');

  progressBox.innerHTML = `
    <div class="progress-row">
      <span class="progress-text">Відкрито ${opened} з ${total} постатей</span>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>`;

  grid.innerHTML = figs.figures.filter(f => byAuthor[f.id]).map(f => {
    const books = byAuthor[f.id];

    const booksHTML = books.map(b => {
      const hasScore = b.score !== null && b.score !== undefined;
      return `
        <div class="fig-book">
          ${b.cover ? `<img class="fig-book-cover" src="${b.cover}" alt="${b.title}">` : ''}
          <div class="fig-book-info">
            <div class="fig-book-title">«${b.title}»${b.year ? ` <span class="book-year">${b.year}</span>` : ''}</div>
            <div class="fig-book-meta">
              ${hasScore ? `<span class="fig-book-score ${scoreClass(b.score)}">${fmtScore(b.score)}<span class="fig-book-max">/10</span></span>` : '<span class="fig-book-score score-none">ще не оцінено</span>'}
              ${b.meeting ? `<span class="fig-book-meeting">засідання № ${b.meeting}</span>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="figure-card figure-open accent-${f.accent}" id="fig-${f.id}">
        ${f.image
          ? `<img class="figure-avatar figure-avatar-photo" src="${f.image}" alt="${f.name}">`
          : `<div class="figure-avatar">${f.initials}</div>`}
        <h3>${f.name}</h3>
        <div class="figure-years">${f.years} · ${f.category}</div>
        <div class="figure-era">${f.era}</div>
        <p class="figure-note">${f.note}</p>
        ${f.quote ? `<p class="figure-quote">«${f.quote}»</p>` : ''}
        <div class="fig-books">${booksHTML}</div>
      </div>`;
  }).join('');

  // Карта постатей за епохами: відкриті аватарами, закриті знаками питання
  const mapBox = document.getElementById('figures-locked');
  const eraOrder = timelineData
    ? timelineData.eras.map(e => e.title)
    : [...new Set(figs.figures.map(f => f.era))];

  const groups = eraOrder
    .map(era => ({ era, items: figs.figures.filter(f => f.era === era) }))
    .filter(g => g.items.length);

  mapBox.innerHTML = `
    <div class="locked-head">Постаті за епохами</div>
    <div class="locked-groups">
      ${groups.map(g => {
        const openedInEra = g.items.filter(f => byAuthor[f.id]).length;
        const marks = g.items.map(f => {
          if (!byAuthor[f.id]) {
            return '<i class="locked-dot" title="Ще не відкрито">?</i>';
          }
          const inner = f.image
            ? `<img src="${f.image}" alt="${f.name}">`
            : `<span>${f.initials}</span>`;
          return `<button class="opened-dot" onclick="scrollToFigure('${f.id}')" title="${f.name}">${inner}</button>`;
        }).join('');
        return `
          <div class="locked-group">
            <span class="locked-group-era">${g.era}</span>
            <span class="locked-group-dots">${marks}</span>
            <span class="locked-group-count${openedInEra ? ' has-opened' : ''}">${openedInEra}/${g.items.length}</span>
          </div>`;
      }).join('')}
    </div>`;
}

/* Перехід до картки постаті */
function scrollToFigure(id) {
  const card = document.getElementById('fig-' + id);
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.add('figure-flash');
  setTimeout(() => card.classList.remove('figure-flash'), 1200);
}

/* ---------- Вікторини (архів) ---------- */
let quizIndex = null;
let activeQuizId = null;

function getTier(correctCount, tiers) {
  const sorted = [...tiers].sort((a, b) => a.max - b.max);
  for (const t of sorted) if (correctCount <= t.max) return t;
  return sorted[sorted.length - 1];
}

async function renderQuizSelector() {
  const idx = await loadJSON('data/quizzes/index.json');
  quizIndex = idx;
  const bar = document.getElementById('quiz-selector');

  bar.innerHTML = idx.quizzes.map(q => `
    <button class="quiz-tab${q.status === 'soon' ? ' quiz-tab-soon' : ''}"
      data-id="${q.id}" onclick="selectQuiz('${q.id}')">
      ${q.label}${q.status === 'soon' ? '<span class="tab-soon-mark">у розробці</span>' : ''}
    </button>`).join('');

  // Відкриваємо першу готову вікторину, якщо такої немає — першу в списку
  const first = idx.quizzes.find(q => q.status === 'ready') || idx.quizzes[0];
  if (first) selectQuiz(first.id);
}

function selectQuiz(id) {
  activeQuizId = id;
  document.querySelectorAll('.quiz-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.id === id));

  const meta = quizIndex.quizzes.find(q => q.id === id);
  const head = document.getElementById('quiz-head');
  const box = document.getElementById('quiz-content');
  const resultBox = document.getElementById('quiz-result');
  const resetBtn = document.getElementById('quiz-reset');

  resultBox.style.display = 'none';
  resultBox.className = '';

  if (!meta || meta.status !== 'ready') {
    head.innerHTML = '';
    resetBtn.style.display = 'none';
    box.innerHTML = `
      <div class="quiz-soon">
        <div class="quiz-soon-icon">🚧</div>
        <div class="quiz-soon-title">${meta ? meta.title : 'Вікторина'}</div>
        <p class="quiz-soon-text">Вікторина у розробці — з'явиться після засідання${meta && meta.meeting ? ` № ${meta.meeting}` : ''}.</p>
      </div>`;
    return;
  }

  resetBtn.style.display = 'block';
  runQuiz(meta).catch(e => {
    console.error(e);
    box.innerHTML = '<p>Не вдалося завантажити вікторину.</p>';
  });
}

async function runQuiz(meta) {
  const data = await loadJSON(meta.file);
  const head = document.getElementById('quiz-head');
  const box = document.getElementById('quiz-content');
  const resultBox = document.getElementById('quiz-result');
  const resetBtn = document.getElementById('quiz-reset');

  const pts = data.pointsPerCorrect ?? 8;
  const tiers = data.tiers ?? [{ max: 999, name: 'Учасник', emoji: '📖' }];

  head.innerHTML = `
    <h3 class="quiz-title">${data.title}</h3>
    <div class="quiz-meta">
      ${data.author ? `${data.author} · ` : ''}${data.book ? `«${data.book}»` : ''}${meta.meeting ? ` · засідання № ${meta.meeting}` : ''}
    </div>
    <p class="quiz-lead">${data.questions.length} питань. Кожна правильна відповідь — ${pts} ${pluralShah(pts)}.</p>`;

  let current = 0;
  let correctCount = 0;

  function renderQuestion() {
    const q = data.questions[current];
    box.innerHTML = '';
    resultBox.style.display = 'none';

    box.appendChild(el('div', 'quiz-progress',
      `Питання ${current + 1} з ${data.questions.length}`));

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
          nextBtn.addEventListener('click', () => { current++; renderQuestion(); });
          box.appendChild(nextBtn);
        } else {
          const points = correctCount * pts;
          const tier = getTier(correctCount, tiers);
          resultBox.style.display = 'block';
          resultBox.className = 'quiz-title-result';
          resultBox.innerHTML = `
            <div class="quiz-title-emoji">${tier.emoji}</div>
            <div class="quiz-title-name">${tier.name}</div>
            <div class="quiz-title-score">Правильних відповідей: ${correctCount} з ${data.questions.length} · ${points} ${pluralShah(points)}</div>
            <div class="quiz-title-hint">Повідомте цей результат ведучому для рейтингу.</div>`;
        }
      });
      qDiv.appendChild(btn);
    });

    box.appendChild(qDiv);
  }

  renderQuestion();

  resetBtn.onclick = () => {
    current = 0;
    correctCount = 0;
    renderQuestion();
  };
}

/* Вбудовані емблеми типів зустрічі */
const MEETING_EMBLEMS = {
  history: {
    label: 'Історична зустріч',
    svg: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 6h14a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H9"/>
      <path d="M9 6a2 2 0 0 0-2 2v3h4"/>
      <path d="M9 28a2 2 0 0 1-2-2v-3h4"/>
      <path d="M13 13h8M13 17h8M13 21h5"/>
    </svg>`
  },
  literature: {
    label: 'Літературна зустріч',
    svg: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 9c-2.5-2-6-2.5-9-2v16c3-.5 6.5 0 9 2 2.5-2 6-2.5 9-2V7c-3-.5-6.5 0-9 2Z"/>
      <path d="M16 9v16"/>
    </svg>`
  }
};

function renderMeetingEmblem(cfg) {
  if (!cfg) return '';
  const preset = MEETING_EMBLEMS[cfg.type];
  if (!preset) return '';
  return `<span class="meeting-emblem" title="${cfg.label || preset.label}">${preset.svg}</span>`;
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

  const emblem = data.emblem || {};
  const hasImage = !!emblem.src;
  const hasIcon = !hasImage && !!MEETING_EMBLEMS[emblem.type];

  box.innerHTML = `
    <div class="card next-topic-card">
      <div class="next-topic-top${hasImage ? ' has-visual' : ''}">
        <div class="next-topic-info">
          <div class="stamp stamp-next">${data.status || 'ОЧІКУЄМО'}</div>
          <div class="meta-row meta-row-emblem">
            <span>Засідання № ${data.meetingNumber}${data.date ? ` · ${data.date}` : ''}</span>
            ${hasIcon ? renderMeetingEmblem(emblem) : ''}
          </div>
          <h3>${data.title}</h3>
          <p class="subtitle">${data.subtitle || ''}</p>
          ${data.intro ? `<p class="next-intro">${data.intro}</p>` : ''}
        </div>
        ${hasImage ? `
        <figure class="next-topic-visual">
          <img src="${emblem.src}" alt="${emblem.label || data.title}">
          ${emblem.label ? `<figcaption>${emblem.label}</figcaption>` : ''}
        </figure>` : ''}
      </div>
      ${data.countdown ? '<div id="countdown" class="countdown"></div>' : ''}
      ${blocksHTML ? `<div class="blocks-list">${blocksHTML}</div>` : ''}
      ${blocksHTML ? `<button class="presenter-launch" onclick="openPresenter()">▶ Режим доповідача</button>` : ''}
    </div>`;

  if (data.countdown) renderCountdown(data.countdown);
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
  renderQuizSelector().catch(e => console.error(e));
  renderNextTopic().catch(e => console.error(e));
});

/* ============================================================
   РЕЖИМ ДОПОВІДАЧА
   Клавіші: → / Space — далі, ← — назад, Q — питання,
            P — вказівка, T — пауза таймера блоку, Esc — вихід
   ============================================================ */
const presenter = {
  data: null, i: 0, el: null,
  blockLimit: 15 * 60,
  blockLeft: 0, blockRunning: false, blockTick: null,
  meetStart: null, meetTick: null,
  pointer: false, question: false,
  idleTimer: null
};

function pad2(n) { return String(Math.floor(Math.abs(n))).padStart(2, '0'); }

function fmtClock(sec) {
  const s = Math.abs(Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60;
  const ss = s % 60;
  return h ? `${h}:${pad2(m)}:${pad2(ss)}` : `${pad2(m)}:${pad2(ss)}`;
}

/* --- Таймер зустрічі (переживає перезавантаження) --- */
function meetStore(v) {
  try { v === null ? localStorage.removeItem('club_meet_start') : localStorage.setItem('club_meet_start', v); }
  catch (e) { /* приватний режим — просто тримаємо в пам'яті */ }
}
function meetRead() {
  try { return localStorage.getItem('club_meet_start'); } catch (e) { return null; }
}

function toggleMeeting() {
  if (presenter.meetStart) {
    const total = (Date.now() - presenter.meetStart) / 1000;
    presenter.meetStart = null;
    meetStore(null);
    clearInterval(presenter.meetTick);
    presenter.meetTick = null;
    showMeetingResult(total);
  } else {
    presenter.meetStart = Date.now();
    meetStore(String(presenter.meetStart));
    presenter.meetTick = setInterval(paintMeeting, 1000);
  }
  paintMeeting();
}

function paintMeeting() {
  const el = document.getElementById('pres-meet');
  if (!el) return;
  const running = !!presenter.meetStart;
  const sec = running ? (Date.now() - presenter.meetStart) / 1000 : 0;
  el.className = 'pres-meet' + (running ? ' running' : '');
  el.innerHTML = `<span class="pres-dot"></span>${running ? fmtClock(sec) : 'старт зустрічі'}`;
}

function showMeetingResult(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.round((totalSec % 3600) / 60);
  const text = h ? `${h} год ${m} хв` : `${m} хв`;
  const box = document.getElementById('pres-result');
  if (!box) return;
  box.innerHTML = `
    <div class="pres-result-inner">
      <div class="pres-result-label">Тривалість зустрічі</div>
      <div class="pres-result-value">${text}</div>
      <div class="pres-result-hint">Впишіть це значення в data/stats.json → «найдовша дискусія»</div>
      <div class="pres-result-actions">
        <button onclick="copyMeetingResult('${text}')">Скопіювати</button>
        <button onclick="document.getElementById('pres-result').innerHTML=''">Закрити</button>
      </div>
    </div>`;
}

function copyMeetingResult(text) {
  navigator.clipboard?.writeText(text).then(
    () => { const b = event.target; b.textContent = 'Скопійовано ✓'; },
    () => {}
  );
}

/* --- Таймер блоку --- */
function resetBlockTimer() {
  presenter.blockLeft = presenter.blockLimit;
  presenter.blockRunning = false;
  clearInterval(presenter.blockTick);
  presenter.blockTick = null;
  paintBlockTimer();
}

function toggleBlockTimer() {
  if (presenter.blockRunning) {
    clearInterval(presenter.blockTick);
    presenter.blockTick = null;
    presenter.blockRunning = false;
  } else {
    presenter.blockRunning = true;
    presenter.blockTick = setInterval(() => {
      presenter.blockLeft--;
      paintBlockTimer();
    }, 1000);
  }
  paintBlockTimer();
}

function paintBlockTimer() {
  const el = document.getElementById('pres-block-timer');
  if (!el) return;
  const left = presenter.blockLeft;
  let state = '';
  if (left < 0) state = ' over';
  else if (left <= 120) state = ' warn';
  el.className = 'pres-block-timer' + state + (presenter.blockRunning ? ' running' : '');
  el.textContent = (left < 0 ? '+' : '') + fmtClock(left);
}

/* --- Відкриття / закриття --- */
async function openPresenter() {
  const data = presenter.data || await loadJSON('data/next-topic.json');
  presenter.data = data;
  presenter.blockLimit = (data.blockMinutes || 15) * 60;
  presenter.i = 0;

  const wrap = document.createElement('div');
  wrap.id = 'presenter';
  wrap.innerHTML = `
    <div class="pres-bar">
      <span class="pres-counter" id="pres-counter"></span>
      <span class="pres-spacer"></span>
      <span class="pres-block-timer" id="pres-block-timer" onclick="toggleBlockTimer()" title="Клік або T — пуск/пауза"></span>
      <span class="pres-meet" id="pres-meet" onclick="toggleMeeting()" title="Клік — старт/стоп зустрічі"></span>
      <button class="pres-btn" onclick="togglePointer()" id="pres-ptr-btn" title="P — вказівка">◎</button>
      <button class="pres-btn" onclick="toggleQuestion()" title="Q — питання">?</button>
      <button class="pres-btn" onclick="closePresenter()" title="Esc — вихід">✕</button>
    </div>
    <div class="pres-stage" id="pres-stage"></div>
    <div class="pres-foot">
      <button class="pres-nav" onclick="presPrev()" title="←">‹</button>
      <div class="pres-info">
        <span class="pres-num" id="pres-num"></span>
        <span class="pres-period" id="pres-period"></span>
        <h2 class="pres-title" id="pres-title"></h2>
      </div>
      <button class="pres-nav" onclick="presNext()" title="→">›</button>
    </div>
    <div class="pres-question" id="pres-question" onclick="toggleQuestion()"></div>
    <div class="pres-pointer" id="pres-pointer"></div>
    <div class="pres-result" id="pres-result"></div>`;
  document.body.appendChild(wrap);
  presenter.el = wrap;
  document.body.style.overflow = 'hidden';

  // відновлюємо таймер зустрічі, якщо його запускали раніше
  const saved = meetRead();
  if (saved) {
    presenter.meetStart = Number(saved);
    presenter.meetTick = setInterval(paintMeeting, 1000);
  }
  paintMeeting();

  resetBlockTimer();
  renderPresBlock();

  document.addEventListener('keydown', presKeys);
  wrap.addEventListener('mousemove', presMouse);

  wrap.requestFullscreen?.().catch(() => {});
}

function closePresenter() {
  document.removeEventListener('keydown', presKeys);
  clearInterval(presenter.blockTick);
  presenter.blockTick = null;
  presenter.blockRunning = false;
  // таймер зустрічі навмисно НЕ зупиняємо — він може йти далі
  presenter.el?.remove();
  presenter.el = null;
  document.body.style.overflow = '';
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}

/* --- Рендер блоку --- */
function renderPresBlock() {
  const b = presenter.data.blocks[presenter.i];
  const total = presenter.data.blocks.length;

  document.getElementById('pres-counter').textContent = `Блок ${presenter.i + 1} з ${total}`;
  document.getElementById('pres-num').textContent = b.num;
  document.getElementById('pres-period').textContent = b.period || '';
  document.getElementById('pres-title').textContent = b.title;

  const stage = document.getElementById('pres-stage');
  if (!b.map) {
    stage.innerHTML = '<div class="pres-nomap">Карта для цього блоку ще не додана</div>';
  } else if (/\.(png|jpe?g|gif|webp|svg)$/i.test(b.map)) {
    stage.innerHTML = `<img class="pres-map" src="${b.map}" alt="${b.title}">`;
  } else {
    stage.innerHTML = `<iframe class="pres-map-frame" src="${b.map}" title="${b.title}"></iframe>`;
  }

  const q = document.getElementById('pres-question');
  q.innerHTML = b.question
    ? `<div class="pres-q-inner"><div class="pres-q-label">Питання на обговорення</div><p>${b.question}</p><div class="pres-q-hint">Q або клік — сховати</div></div>`
    : '<div class="pres-q-inner"><p>Питання для цього блоку ще не внесено.</p></div>';

  resetBlockTimer();
}

function presNext() {
  if (presenter.i < presenter.data.blocks.length - 1) { presenter.i++; renderPresBlock(); }
}
function presPrev() {
  if (presenter.i > 0) { presenter.i--; renderPresBlock(); }
}

/* --- Питання --- */
function toggleQuestion() {
  presenter.question = !presenter.question;
  document.getElementById('pres-question').classList.toggle('show', presenter.question);
}

/* --- Вказівка --- */
function togglePointer() {
  presenter.pointer = !presenter.pointer;
  presenter.el.classList.toggle('pointer-on', presenter.pointer);
  document.getElementById('pres-ptr-btn').classList.toggle('active', presenter.pointer);
}

function presMouse(e) {
  if (presenter.pointer) {
    const p = document.getElementById('pres-pointer');
    p.style.left = e.clientX + 'px';
    p.style.top = e.clientY + 'px';
  }
  presenter.el.classList.remove('idle');
  clearTimeout(presenter.idleTimer);
  presenter.idleTimer = setTimeout(() => presenter.el?.classList.add('idle'), 3000);
}

/* --- Клавіатура --- */
function presKeys(e) {
  switch (e.key) {
    case 'ArrowRight': case ' ': case 'PageDown': e.preventDefault(); presNext(); break;
    case 'ArrowLeft':  case 'PageUp':             e.preventDefault(); presPrev(); break;
    case 'q': case 'Q': case 'й': case 'Й':       toggleQuestion(); break;
    case 'p': case 'P': case 'з': case 'З':       togglePointer(); break;
    case 't': case 'T': case 'е': case 'Е':       toggleBlockTimer(); break;
    case 'Escape':
      if (presenter.question) toggleQuestion(); else closePresenter();
      break;
  }
}
