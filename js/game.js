// ─── VIEWPORT HEIGHT FIX (mobile browsers) ───────────────────────────────────
function setVH() {
  document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
}
setVH();
window.addEventListener('resize', setVH);

// ─── HAPTIC ─────────────────────────────────────────────────────────────────
function haptic(type) {
  try {
    const hf = window.Telegram?.WebApp?.HapticFeedback;
    if (!hf) return;
    if      (type === 'error')   hf.notificationOccurred('error');
    else if (type === 'success') hf.notificationOccurred('success');
    else if (type === 'select')  hf.impactOccurred('light');
    else if (type === 'input')   hf.impactOccurred('light');
    else if (type === 'hint')    hf.impactOccurred('medium');
    else if (type === 'blocked') {
      hf.impactOccurred('light');
      setTimeout(() => hf.impactOccurred('light'), 80);
    }
  } catch(e) {}
}

// ─── PUZZLE ──────────────────────────────────────────────────────────────────
// Medium, 32 данных клетки (сгенерировано js/generator.js)
const PUZZLE = [
  0,0,3, 0,0,0, 2,0,0,
  8,0,1, 0,0,0, 0,0,9,
  0,6,7, 8,5,0, 3,0,0,

  0,0,0, 0,0,0, 0,0,1,
  0,0,6, 0,7,0, 0,0,0,
  0,8,0, 0,0,0, 0,2,0,

  7,5,0, 9,6,0, 1,0,0,
  6,0,8, 0,0,7, 0,9,3,
  3,1,9, 4,0,2, 6,5,0,
];

const SOLUTION = [
  5,9,3, 7,4,1, 2,6,8,
  8,4,1, 3,2,6, 5,7,9,
  2,6,7, 8,5,9, 3,1,4,

  4,7,2, 6,9,5, 8,3,1,
  1,3,6, 2,7,8, 9,4,5,
  9,8,5, 1,3,4, 7,2,6,

  7,5,4, 9,6,3, 1,8,2,
  6,2,8, 5,1,7, 4,9,3,
  3,1,9, 4,8,2, 6,5,7,
];

const DIFFICULTY = { name: 'Medium', lives: 4, hints: 2 };

// ─── STATE ───────────────────────────────────────────────────────────────────
let grid        = [...PUZZLE];
const given     = PUZZLE.map(v => v !== 0);
let selectedCell = -1;   // -1 = нет
let selectedNum  =  0;   //  0 = нет
let lives        = DIFFICULTY.lives;
let hints        = DIFFICULTY.hints;
let errorCell    = -1;
let errorTimer   = null;
const history    = [];   // [{idx, prev}] для undo
let notesMode        = false;
let lastSelectTime   = 0;   // защита от двойного срабатывания click
const notes        = Array.from({length: 81}, () => new Set());

// ─── TIMER ───────────────────────────────────────────────────────────────────
let seconds  = 0;
let timerOn  = false;
let timerRef = null;

function startTimer() {
  if (timerOn) return;
  timerOn = true;
  timerRef = setInterval(() => { seconds++; renderTimer(); }, 1000);
}

function renderTimer() {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  document.getElementById('header-timer').textContent =
    `${m}:${s.toString().padStart(2,'0')}`;
}

// ─── GRID HELPERS ─────────────────────────────────────────────────────────────
const row = i => Math.floor(i / 9);
const col = i => i % 9;
const box = i => Math.floor(row(i) / 3) * 3 + Math.floor(col(i) / 3);

function getHighlights() {
  const hl    = new Set(); // строка/столбец/квадрат выбранной клетки
  const hlNum = new Set(); // все клетки с выбранной цифрой

  if (selectedCell >= 0) {
    const r = row(selectedCell), c = col(selectedCell), b = box(selectedCell);
    for (let i = 0; i < 81; i++) {
      if (i !== selectedCell && (row(i) === r || col(i) === c || box(i) === b))
        hl.add(i);
    }
  }

  if (selectedNum > 0) {
    for (let i = 0; i < 81; i++) {
      if (grid[i] === selectedNum) hlNum.add(i);
    }
  }

  return { hl, hlNum };
}

// ─── RENDER ──────────────────────────────────────────────────────────────────
function renderGrid() {
  const { hl, hlNum } = getHighlights();
  document.querySelectorAll('.cell').forEach(el => {
    const idx = +el.dataset.idx;
    const val = grid[idx];

    el.className = 'cell';
    if (given[idx]) el.classList.add('given');

    if (idx === errorCell)    el.classList.add('error');
    else if (idx === selectedCell) el.classList.add('selected');
    else if (hlNum.has(idx))  el.classList.add('highlighted-num');
    else if (hl.has(idx))     el.classList.add('highlighted');

    if (val === 0 && notes[idx].size > 0) {
      const notesHtml = [1,2,3,4,5,6,7,8,9]
        .map(n => `<span class="note-digit${(selectedNum > 0 && n !== selectedNum) ? ' dim' : ''}">${notes[idx].has(n) ? n : ''}</span>`)
        .join('');
      el.innerHTML = `<div class="cell-inner"><div class="notes-grid">${notesHtml}</div></div>`;
    } else {
      el.innerHTML = `<div class="cell-inner">${val > 0 ? val : ''}</div>`;
    }
  });
}

function renderLives() {
  const el = document.getElementById('lives-display');
  el.innerHTML = '';
  for (let i = 0; i < DIFFICULTY.lives; i++) {
    const d = document.createElement('div');
    d.className = 'life-dot' + (i < lives ? '' : ' lost');
    el.appendChild(d);
  }
}

function renderHints() {
  const el = document.getElementById('hints-display');
  el.innerHTML = '';
  for (let i = 0; i < DIFFICULTY.hints; i++) {
    const d = document.createElement('div');
    d.className = 'hint-dot' + (i < hints ? '' : ' used');
    el.appendChild(d);
  }
}

function renderNumpad() {
  const np = document.getElementById('numpad');
  np.innerHTML = '';

  // Первая строка: 1–5
  const row1 = document.createElement('div');
  row1.className = 'numpad-row';
  [1,2,3,4,5].forEach(n => {
    const btn = document.createElement('button');
    const done = grid.filter(v => v === n).length === 9;
    btn.className = 'num-btn' + (selectedNum === n ? ' selected' : '') + (done ? ' done' : '');
    btn.textContent = n;
    btn.disabled = done;
    btn.addEventListener('click', () => onNumClick(n));
    row1.appendChild(btn);
  });
  np.appendChild(row1);

  // Вторая строка: 6–9 + карандаш
  const row2 = document.createElement('div');
  row2.className = 'numpad-row';
  [6,7,8,9].forEach(n => {
    const btn = document.createElement('button');
    const done = grid.filter(v => v === n).length === 9;
    btn.className = 'num-btn' + (selectedNum === n ? ' selected' : '') + (done ? ' done' : '');
    btn.textContent = n;
    btn.disabled = done;
    btn.addEventListener('click', () => onNumClick(n));
    row2.appendChild(btn);
  });

  const pencilBtn = document.createElement('button');
  pencilBtn.className = 'num-btn' + (notesMode ? ' notes-active' : '');
  pencilBtn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`;
  pencilBtn.addEventListener('click', () => {
    notesMode = !notesMode;
    haptic('select');
    if (!notesMode) {
      selectedCell = -1;
      selectedNum  = 0;
      renderGrid();
    }
    renderNumpad();
  });
  row2.appendChild(pencilBtn);
  np.appendChild(row2);
}

// ─── BUILD DOM ────────────────────────────────────────────────────────────────
function buildGrid() {
  const gridEl = document.getElementById('grid');
  gridEl.innerHTML = '';
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const box = document.createElement('div');
      box.className = 'box';
      for (let cr = 0; cr < 3; cr++) {
        for (let cc = 0; cc < 3; cc++) {
          const idx = (br * 3 + cr) * 9 + (bc * 3 + cc);
          const cell = document.createElement('div');
          cell.className = 'cell';
          cell.dataset.idx = idx;
          cell.addEventListener('click', () => onCellClick(idx));
          box.appendChild(cell);
        }
      }
      gridEl.appendChild(box);
    }
  }
}

// ─── INTERACTION ─────────────────────────────────────────────────────────────
function onCellClick(idx) {
  if (!timerOn) startTimer();

  // Любая заполненная клетка (данная или введённая) — не трогаем
  if (grid[idx] > 0) { haptic('blocked'); return; }

  // Повторный тап → снять выбор (игнорируем если только что выбрали)
  if (selectedCell === idx) {
    if (Date.now() - lastSelectTime < 500) return;
    selectedCell = -1;
    renderGrid();
    return;
  }

  selectedCell = idx;
  lastSelectTime = Date.now();
  haptic('select');

  // Если цифра уже выбрана — вводим (или ставим заметку)
  if (selectedNum > 0) {
    if (notesMode) {
      tryNote(idx, selectedNum);
    } else {
      tryInput(idx, selectedNum);
    }
    return;
  }

  // Если в клетке уже что-то есть — подсветим эту цифру в нампаде
  if (grid[idx] > 0) selectedNum = grid[idx];

  renderGrid();
  renderNumpad();
}

function onNumClick(num) {
  if (!timerOn && num > 0) startTimer();

  // Стереть
  if (num === 0) {
    if (selectedCell >= 0 && !given[selectedCell] && grid[selectedCell] > 0) {
      history.push({ idx: selectedCell, prev: grid[selectedCell] });
      grid[selectedCell] = 0;
      haptic('input');
    }
    selectedNum = 0;
    renderGrid();
    renderNumpad();
    return;
  }

  // Режим заметок
  if (notesMode) {
    selectedNum = num;
    haptic('select');
    if (selectedNum > 0 && selectedCell >= 0 && !given[selectedCell] && grid[selectedCell] === 0) {
      tryNote(selectedCell, selectedNum);
    }
    renderNumpad();
    return;
  }

  // Повторный тап на цифру → снять выбор
  if (selectedNum === num) {
    selectedNum = 0;
    renderGrid();
    renderNumpad();
    return;
  }

  selectedNum = num;
  haptic('select');

  // Если клетка уже выбрана и редактируема — вводим
  if (selectedCell >= 0 && !given[selectedCell]) {
    tryInput(selectedCell, num);
    return;
  }

  renderGrid();
  renderNumpad();
}

function tryNote(idx, num) {
  const r = row(idx), c = col(idx), b = box(idx);
  const conflicts = [];
  for (let i = 0; i < 81; i++) {
    if (i !== idx && grid[i] === num &&
        (row(i) === r || col(i) === c || box(i) === b)) {
      conflicts.push(i);
    }
  }
  if (conflicts.length > 0) {
    haptic('select');
    conflicts.forEach(i => {
      const el = document.querySelector(`.cell[data-idx="${i}"]`);
      if (!el) return;
      el.classList.add('bounce');
      el.addEventListener('animationend', () => el.classList.remove('bounce'), { once: true });
    });
  } else {
    if (notes[idx].has(num)) {
      notes[idx].delete(num);
    } else {
      notes[idx].add(num);
    }
    haptic('input');
    renderGrid();
  }
}

function tryInput(idx, num) {
  if (given[idx]) return;

  if (SOLUTION[idx] === num) {
    // Верно
    history.push({ idx, prev: grid[idx] });
    grid[idx]    = num;
    notes[idx].clear();
    const r = row(idx), c = col(idx), b = box(idx);
    for (let i = 0; i < 81; i++) {
      if (i !== idx && (row(i) === r || col(i) === c || box(i) === b))
        notes[i].delete(num);
    }
    selectedCell = -1;
    const numDone = grid.filter(v => v === num).length === 9;
    selectedNum  = numDone ? 0 : num;
    if (numDone) {
      const allCells = [];
      for (let i = 0; i < 81; i++) if (grid[i] === num) allCells.push(i);
      rippleGroup(allCells, idx);
    }
    haptic('input');
    renderGrid();
    renderNumpad();
    const cellEl = document.querySelector(`.cell[data-idx="${idx}"]`);
    if (cellEl) {
      cellEl.classList.add('popin');
      cellEl.addEventListener('animationend', () => cellEl.classList.remove('popin'), { once: true });
    }
    checkGroups(idx);
    checkWin();
  } else {
    // Неверно
    lives--;
    haptic('error');
    errorCell = idx;
    renderGrid();
    renderLives();
    if (errorTimer) clearTimeout(errorTimer);
    errorTimer = setTimeout(() => {
      errorCell = -1;
      renderGrid();
    }, 650);
    if (lives <= 0) setTimeout(gameOver, 750);
  }
}

function onUndo() {
  if (!history.length) return;
  const { idx, prev } = history.pop();
  grid[idx] = prev;
  haptic('select');
  renderGrid();
}

// ─── WIN / LOSE ───────────────────────────────────────────────────────────────
function rippleGroup(indices, fromIdx) {
  const fromR = row(fromIdx), fromC = col(fromIdx);
  haptic('select');
  setTimeout(() => haptic('hint'),   100);
  setTimeout(() => { try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('heavy'); } catch(e){} }, 220);
  indices.forEach(i => {
    if (i === fromIdx) return;
    const dist = Math.abs(row(i) - fromR) + Math.abs(col(i) - fromC);
    const el = document.querySelector(`.cell[data-idx="${i}"]`);
    if (!el) return;
    setTimeout(() => {
      el.classList.add('ripple');
      setTimeout(() => el.classList.remove('ripple'), 600);
    }, dist * 60);
  });
}

function checkGroups(idx) {
  const r = row(idx), c = col(idx), b = box(idx);

  // строка
  const rowCells = Array.from({length: 9}, (_, i) => r * 9 + i);
  if (rowCells.every(i => grid[i] > 0)) rippleGroup(rowCells, idx);

  // квадрат
  const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
  const boxCells = [];
  for (let dr = 0; dr < 3; dr++)
    for (let dc = 0; dc < 3; dc++)
      boxCells.push((br + dr) * 9 + (bc + dc));
  if (boxCells.every(i => grid[i] > 0)) rippleGroup(boxCells, idx);
}

function showConfetti() {
  const colors = ['#f0589e', '#fbbf24', '#a855f7', '#34d399', '#60a5fa', '#fb923c'];
  const W = window.innerWidth, H = window.innerHeight;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:200;';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const particles = [];
  const gravity = 0.28;

  function spawnPopper(x, dirX) {
    for (let i = 0; i < 60; i++) {
      const deg   = 45 + Math.random() * 55;
      const rad   = deg * Math.PI / 180;
      const speed = 12 + Math.random() * 10;
      particles.push({
        x, y: H * 0.75,
        vx: dirX * Math.cos(rad) * speed,
        vy: -Math.sin(rad) * speed,
        color: colors[Math.floor(Math.random() * colors.length)],
        w: 5 + Math.random() * 6,
        h: 3 + Math.random() * 4,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.28,
        shape: ['circle','rect','triangle','strip'][Math.floor(Math.random() * 4)],
      });
    }
    haptic('hint');
  }

  // Первая хлопушка — сразу
  spawnPopper(0, 1);
  // Вторая — с задержкой
  setTimeout(() => spawnPopper(W, -1), 150);

  function animate() {
    ctx.clearRect(0, 0, W, H);
    let alive = false;
    for (const p of particles) {
      p.vx *= 0.97;
      p.vy += (p.gravity ?? gravity);
      p.x  += p.vx;
      p.y  += p.vy;
      p.rot += p.rotSpeed;
      if (p.y < H + 20) {
        alive = true;
        const alpha = Math.max(0, Math.min(1, 1 - (p.y - H * 0.55) / (H * 0.6)));
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'rect') {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        } else if (p.shape === 'triangle') {
          const r = p.w / 2;
          ctx.beginPath();
          ctx.moveTo(0, -r);
          ctx.lineTo(r, r * 0.7);
          ctx.lineTo(-r, r * 0.7);
          ctx.closePath();
          ctx.fill();
        } else {
          // strip — тонкая длинная полоска
          ctx.fillRect(-p.w, -p.h * 0.3, p.w * 2, p.h * 0.6);
        }
        ctx.restore();
      }
    }
    if (alive) requestAnimationFrame(animate);
    else canvas.remove();
  }

  requestAnimationFrame(animate);

  // Вторая волна: сверху вниз, когда первые начинают падать
  setTimeout(() => {
    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * W,
        y: -(10 + Math.random() * H),
        vx: (Math.random() - 0.5) * 3,
        vy: 2 + Math.random() * 2,
        gravity: 0.06,
        color: colors[Math.floor(Math.random() * colors.length)],
        w: 5 + Math.random() * 6,
        h: 3 + Math.random() * 4,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.28,
        shape: ['circle','rect','triangle','strip'][Math.floor(Math.random() * 4)],
      });
    }
  }, 900);
}

function showResult() {
  const dateStr = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  document.getElementById('result-date').textContent = dateStr;
  document.getElementById('result-time').textContent = document.getElementById('header-timer').textContent;
  document.getElementById('result-perfect').textContent = lives === DIFFICULTY.lives ? '✦ PERFECT ✦' : '';
  document.getElementById('result-difficulty').textContent = DIFFICULTY.name;

  document.querySelector('.screen').classList.add('result-shown');
  document.getElementById('result-overlay').classList.add('visible');
}

function checkWin() {
  if (grid.every((v, i) => v === SOLUTION[i])) {
    clearInterval(timerRef);
    haptic('success');
    setTimeout(showConfetti, 1000);
    setTimeout(showResult, 2500);
  }
}

function gameOver() {
  clearInterval(timerRef);
  // TODO: экран проигрыша
  alert('Жизни закончились!');
}

// ─── INIT ────────────────────────────────────────────────────────────────────
function init() {
  // Дата
  const dateStr = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  document.getElementById('header-date').textContent = dateStr;
  document.getElementById('difficulty-label').textContent = DIFFICULTY.name;

  buildGrid();
  renderGrid();
  renderLives();
  renderHints();
  renderNumpad();

  document.getElementById('btn-undo').addEventListener('click', onUndo);
  document.getElementById('btn-hint').addEventListener('click', () => haptic('hint'));

  // Telegram тема
  if (window.Telegram?.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    if (tg.colorScheme === 'dark') document.body.dataset.theme = 'dark';
  }
}

init();
