// ---------- Persistência local ----------
const STORAGE_KEYS = {
  apiKey: 'treinoia_api_key',
  history: 'treinoia_history',
  current: 'treinoia_current',
};

const load = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));

// ---------- Ícones locais por grupo muscular ----------
const ICONS = {
  peito: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><rect x="20" y="20" width="8" height="8" rx="2"/><path d="M20 24H10a4 4 0 0 1-4-4v-4"/><path d="M28 24h10a4 4 0 0 0 4-4v-4"/><path d="M8 12v4M40 12v4"/></svg>',
  costas: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h36"/><path d="M12 12v-4M36 12v-4"/><path d="M24 12v24"/><path d="M24 20l-8 16M24 20l8 16"/></svg>',
  pernas: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="10" r="4"/><path d="M24 14v10"/><path d="M24 24l-8 14M24 24l8 14"/><path d="M14 40h4M30 40h4"/></svg>',
  ombros: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><circle cx="14" cy="14" r="4"/><circle cx="34" cy="14" r="4"/><path d="M14 18v8M34 18v8"/><path d="M8 26h12M28 26h12"/></svg>',
  biceps: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M10 30c0-10 6-16 14-16 6 0 8 4 8 8s-4 6-8 6"/><circle cx="34" cy="30" r="6"/><path d="M6 30h6M6 26h6M6 34h6"/></svg>',
  triceps: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12v6M8 34v6M8 15v22"/><rect x="14" y="19" width="6" height="10" rx="2"/><rect x="28" y="19" width="6" height="10" rx="2"/><path d="M40 12v6M40 34v6M40 15v22"/></svg>',
  abdomen: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><rect x="16" y="8" width="16" height="32" rx="6"/><path d="M16 16h16M16 24h16M16 32h16"/></svg>',
  cardio: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 26h8l4-10 6 18 4-14 3 6h11"/></svg>',
  corpo_todo: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="8" r="4"/><path d="M24 12v14"/><path d="M14 20h20"/><path d="M24 26l-8 14M24 26l8 14"/><path d="M14 20l-4 10M34 20l4 10"/></svg>',
};
const iconFor = (group) => ICONS[group] || ICONS.corpo_todo;

// ---------- Schema estruturado para o Gemini ----------
const WORKOUT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    nomeTreino: { type: 'STRING' },
    duracaoEstimadaMin: { type: 'INTEGER' },
    exercicios: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          nome: { type: 'STRING' },
          grupoMuscular: {
            type: 'STRING',
            enum: ['peito', 'costas', 'pernas', 'ombros', 'biceps', 'triceps', 'abdomen', 'cardio', 'corpo_todo'],
          },
          series: { type: 'INTEGER' },
          repeticoes: { type: 'STRING' },
          descansoSegundos: { type: 'INTEGER' },
          descricao: { type: 'STRING' },
        },
        required: ['nome', 'grupoMuscular', 'series', 'repeticoes', 'descansoSegundos', 'descricao'],
      },
    },
  },
  required: ['nomeTreino', 'duracaoEstimadaMin', 'exercicios'],
};

async function generateWorkout(userPrompt, apiKey) {
  const model = 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const prompt = `Você é um personal trainer. Monte um treino de academia em português a partir do pedido do usuário abaixo.
Para cada exercício, escreva em "descricao" um texto descritivo curto (2 a 3 frases) explicando como executar o movimento corretamente e pontos de atenção.
Defina "descansoSegundos" com um tempo de descanso realista entre séries (normalmente 30 a 90 segundos).
Escolha "grupoMuscular" apenas dentre os valores permitidos pelo schema.
Pedido do usuário: "${userPrompt}"`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: WORKOUT_SCHEMA,
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    const msg = errBody?.error?.message || `Erro HTTP ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('A IA não retornou um treino válido. Tente novamente.');

  const workout = JSON.parse(text);
  workout.id = `w_${Date.now()}`;
  workout.createdAt = new Date().toISOString();
  workout.exercicios = workout.exercicios.map((ex) => ({ ...ex, completedSets: 0 }));
  return workout;
}

// ---------- Navegação de telas ----------
const screens = {
  settings: document.getElementById('screenSettings'),
  history: document.getElementById('screenHistory'),
  generate: document.getElementById('screenGenerate'),
  loading: document.getElementById('screenLoading'),
  workout: document.getElementById('screenWorkout'),
};

function showScreen(name) {
  Object.values(screens).forEach((el) => el.classList.add('hidden'));
  screens[name].classList.remove('hidden');
}

// ---------- Configurações (chave API) ----------
const apiKeyInput = document.getElementById('apiKeyInput');
const keyStatus = document.getElementById('keyStatus');

function refreshKeyStatus() {
  const key = load(STORAGE_KEYS.apiKey, '');
  keyStatus.textContent = key ? 'Chave salva neste celular.' : 'Nenhuma chave configurada ainda.';
}

document.getElementById('btnSettings').addEventListener('click', () => {
  apiKeyInput.value = load(STORAGE_KEYS.apiKey, '');
  refreshKeyStatus();
  showScreen('settings');
});
document.getElementById('btnCloseSettings').addEventListener('click', () => renderCurrentOrGenerate());
document.getElementById('btnSaveKey').addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  save(STORAGE_KEYS.apiKey, key);
  refreshKeyStatus();
});

// ---------- Histórico ----------
document.getElementById('btnHistory').addEventListener('click', () => {
  renderHistory();
  showScreen('history');
});
document.getElementById('btnCloseHistory').addEventListener('click', () => renderCurrentOrGenerate());

function renderHistory() {
  const history = load(STORAGE_KEYS.history, []);
  const list = document.getElementById('historyList');
  const empty = document.getElementById('historyEmpty');
  list.innerHTML = '';
  empty.classList.toggle('hidden', history.length > 0);

  history
    .slice()
    .reverse()
    .forEach((w) => {
      const btn = document.createElement('button');
      btn.className = 'history-item';
      const date = new Date(w.createdAt);
      btn.innerHTML = `<b>${escapeHtml(w.nomeTreino)}</b><span>${date.toLocaleDateString('pt-BR')} · ${w.exercicios.length} exercícios · ~${w.duracaoEstimadaMin} min</span>`;
      btn.addEventListener('click', () => {
        save(STORAGE_KEYS.current, w);
        renderWorkout(w);
        showScreen('workout');
      });
      list.appendChild(btn);
    });
}

// ---------- Geração de treino ----------
const promptInput = document.getElementById('workoutPrompt');
const generateError = document.getElementById('generateError');

document.getElementById('btnGenerate').addEventListener('click', async () => {
  const userPrompt = promptInput.value.trim();
  generateError.classList.add('hidden');

  if (!userPrompt) {
    showError('Descreva o treino que você quer antes de gerar.');
    return;
  }
  const apiKey = load(STORAGE_KEYS.apiKey, '');
  if (!apiKey) {
    showError('Configure sua chave gratuita do Gemini em ⚙️ Configurações antes de gerar um treino.');
    return;
  }

  showScreen('loading');
  try {
    const workout = await generateWorkout(userPrompt, apiKey);
    save(STORAGE_KEYS.current, workout);
    const history = load(STORAGE_KEYS.history, []);
    history.push(workout);
    save(STORAGE_KEYS.history, history);
    renderWorkout(workout);
    showScreen('workout');
  } catch (err) {
    showScreen('generate');
    showError(`Não foi possível gerar o treino: ${err.message}`);
  }
});

document.getElementById('btnNewWorkout').addEventListener('click', () => {
  promptInput.value = '';
  generateError.classList.add('hidden');
  showScreen('generate');
});

function showError(msg) {
  generateError.textContent = msg;
  generateError.classList.remove('hidden');
  showScreen('generate');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// ---------- Renderização do treino ----------
function renderWorkout(workout) {
  document.getElementById('workoutTitle').textContent = workout.nomeTreino;
  document.getElementById('workoutMeta').textContent = `${workout.exercicios.length} exercícios · ~${workout.duracaoEstimadaMin} min`;

  const list = document.getElementById('exerciseList');
  list.innerHTML = '';

  workout.exercicios.forEach((ex, idx) => {
    const card = document.createElement('div');
    card.className = 'exercise-card' + (ex.completedSets >= ex.series ? ' done' : '');

    const setsRow = Array.from({ length: ex.series }, (_, i) => {
      const filled = i < ex.completedSets;
      return `<button class="check-btn set-btn${filled ? ' checked' : ''}" data-idx="${idx}" data-set="${i}">${filled ? '✓' : i + 1}ª série</button>`;
    }).join('');

    card.innerHTML = `
      <div class="ex-icon">${iconFor(ex.grupoMuscular)}</div>
      <div class="ex-body">
        <p class="ex-name">${escapeHtml(ex.nome)}</p>
        <p class="ex-sets">${ex.series} séries × ${escapeHtml(ex.repeticoes)} · descanso ${ex.descansoSegundos}s</p>
        <p class="ex-desc">${escapeHtml(ex.descricao)}</p>
        <div class="ex-actions">${setsRow}</div>
      </div>
    `;
    list.appendChild(card);
  });

  list.querySelectorAll('.set-btn').forEach((btn) => {
    btn.addEventListener('click', () => onSetClick(Number(btn.dataset.idx), Number(btn.dataset.set)));
  });

  updateProgress(workout);
}

function updateProgress(workout) {
  const total = workout.exercicios.reduce((sum, ex) => sum + ex.series, 0);
  const done = workout.exercicios.reduce((sum, ex) => sum + ex.completedSets, 0);
  const pct = total ? Math.round((done / total) * 100) : 0;
  document.getElementById('progressFill').style.width = `${pct}%`;
}

function onSetClick(exIdx, setIdx) {
  const workout = load(STORAGE_KEYS.current, null);
  if (!workout) return;
  const ex = workout.exercicios[exIdx];

  const alreadyDone = setIdx < ex.completedSets;
  if (alreadyDone) {
    // Desmarcar essa série e todas as posteriores dela
    ex.completedSets = setIdx;
  } else {
    ex.completedSets = setIdx + 1;
    const isLastSetOfExercise = ex.completedSets >= ex.series;
    save(STORAGE_KEYS.current, workout);
    renderWorkout(workout);
    if (!isLastSetOfExercise) {
      startRestTimer(ex.descansoSegundos, ex.nome);
    }
    return;
  }
  save(STORAGE_KEYS.current, workout);
  renderWorkout(workout);
}

// ---------- Cronômetro de descanso ----------
const timerOverlay = document.getElementById('timerOverlay');
const timerDisplay = document.getElementById('timerDisplay');
const timerNextExercise = document.getElementById('timerNextExercise');

let timerInterval = null;
let timerRemaining = 0;

function formatTime(s) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = Math.max(0, s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

function startRestTimer(seconds, exerciseName) {
  clearInterval(timerInterval);
  timerRemaining = seconds;
  timerDisplay.textContent = formatTime(timerRemaining);
  timerNextExercise.textContent = `Próxima série: ${exerciseName}`;
  timerOverlay.classList.remove('hidden');

  timerInterval = setInterval(() => {
    timerRemaining -= 1;
    if (timerRemaining <= 0) {
      finishRestTimer();
      return;
    }
    timerDisplay.textContent = formatTime(timerRemaining);
  }, 1000);
}

function finishRestTimer() {
  clearInterval(timerInterval);
  timerDisplay.textContent = '00:00';
  playBeep();
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  setTimeout(() => timerOverlay.classList.add('hidden'), 600);
}

document.getElementById('btnTimerSkip').addEventListener('click', () => {
  clearInterval(timerInterval);
  timerOverlay.classList.add('hidden');
});
document.getElementById('btnTimerPlus').addEventListener('click', () => {
  timerRemaining += 10;
  timerDisplay.textContent = formatTime(timerRemaining);
});
document.getElementById('btnTimerMinus').addEventListener('click', () => {
  timerRemaining = Math.max(0, timerRemaining - 10);
  timerDisplay.textContent = formatTime(timerRemaining);
});

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.55);
  } catch {
    /* dispositivos sem suporte a Web Audio ignoram o beep */
  }
}

// ---------- Inicialização ----------
function renderCurrentOrGenerate() {
  const current = load(STORAGE_KEYS.current, null);
  if (current) {
    renderWorkout(current);
    showScreen('workout');
  } else {
    showScreen('generate');
  }
}

renderCurrentOrGenerate();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
