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

/* ---------- Тема зустрічі ---------- */
async function renderTopic() {
  const data = await loadJSON('data/topic.json');
  const box = document.getElementById('topic-content');
  box.innerHTML = `
    <div class="card">
      <div class="stamp">${data.status || 'АКТУАЛЬНО'}</div>
      <div class="meta-row">Засідання № ${data.meetingNumber} · ${data.date}</div>
      <h3>${data.title}</h3>
      <p class="subtitle">${data.subtitle || ''}</p>
      <p>${data.intro || ''}</p>
    </div>`;
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
  renderTopic().catch(e => console.error(e));
  renderQuiz().catch(e => console.error(e));
  renderArchive().catch(e => console.error(e));
  renderLeaderboard().catch(e => console.error(e));
  renderMaterials().catch(e => console.error(e));
});
