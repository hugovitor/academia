// ---------- Persistência local ----------
const STORAGE_KEYS = {
  apiKey: 'treinoia_api_key',
  history: 'treinoia_history',
  current: 'treinoia_current',
  settings: 'treinoia_settings',
  weights: 'treinoia_weights',
  sessions: 'treinoia_sessions',
  profile: 'treinoia_profile',
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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// ---------- Configurações (tema, som, vibração) ----------
const DEFAULT_SETTINGS = { theme: 'dark', sound: true, vibration: true };

function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...load(STORAGE_KEYS.settings, {}) };
}

function applyTheme(theme) {
  document.body.classList.toggle('theme-light', theme === 'light');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f1f5f9' : '#0f172a');
}

applyTheme(loadSettings().theme);

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

// ---------- Imagens reais de execução (Wikimedia Commons, sem chave) ----------
const IMAGE_SEARCH_TERMS = {
  peito: 'bench press exercise gym',
  costas: 'lat pulldown machine gym',
  pernas: 'leg press machine gym',
  ombros: 'shoulder press machine gym',
  biceps: 'bicep curl dumbbell gym',
  triceps: 'triceps pushdown cable machine gym',
  abdomen: 'abdominal crunch machine gym',
  cardio: 'treadmill gym cardio',
  corpo_todo: 'gym weight equipment',
};
const IMAGE_CACHE_KEY = 'treinoia_img_cache';

async function fetchImageByTerm(term, width) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(term + ' filetype:bitmap')}&gsrlimit=1&gsrnamespace=6&prop=imageinfo&iiprop=url&iiurlwidth=${width}&format=json&origin=*`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const pages = data?.query?.pages;
  if (!pages) return null;
  const page = Object.values(pages)[0];
  return page?.imageinfo?.[0]?.thumburl || null;
}

async function getOrFetchImage(term) {
  const key = term.trim().toLowerCase();
  const cache = load(IMAGE_CACHE_KEY, {});
  if (cache[key]) return cache[key];
  const url = await fetchImageByTerm(term, 600);
  if (url) {
    cache[key] = url;
    save(IMAGE_CACHE_KEY, cache);
  }
  return url;
}

// ---------- Peso por exercício (lembra a última carga usada) ----------
const normalizeName = (nome) => nome.trim().toLowerCase();

function getLastWeight(nome) {
  const weights = load(STORAGE_KEYS.weights, {});
  return weights[normalizeName(nome)]?.last ?? null;
}
function saveWeight(nome, peso) {
  const weights = load(STORAGE_KEYS.weights, {});
  weights[normalizeName(nome)] = { last: peso, updatedAt: new Date().toISOString() };
  save(STORAGE_KEYS.weights, weights);
}

// ---------- Sessões treinadas (streak + calendário) ----------
function dateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function logSessionToday() {
  const sessions = load(STORAGE_KEYS.sessions, []);
  const today = dateStr();
  if (!sessions.includes(today)) {
    sessions.push(today);
    save(STORAGE_KEYS.sessions, sessions);
  }
}
function computeStreak(sessions) {
  const set = new Set(sessions);
  const cursor = new Date();
  if (!set.has(dateStr(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (set.has(dateStr(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// ---------- Geração via Groq (API compatível com OpenAI) ----------
const GROQ_GROUPS = ['peito', 'costas', 'pernas', 'ombros', 'biceps', 'triceps', 'abdomen', 'cardio', 'corpo_todo'];

function stripCodeFence(text) {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1] : trimmed;
}

function sanitizeExercicios(exerciciosRaw) {
  const groups = new Set(GROQ_GROUPS);
  return (Array.isArray(exerciciosRaw) ? exerciciosRaw : []).map((ex) => {
    const grupoMuscular = groups.has(ex?.grupoMuscular) ? ex.grupoMuscular : 'corpo_todo';
    const series = Number.isFinite(Number(ex?.series)) ? Math.max(1, Math.round(Number(ex.series))) : 3;
    return {
      nome: String(ex?.nome || 'Exercício'),
      grupoMuscular,
      series,
      repeticoes: String(ex?.repeticoes || '12'),
      descansoSegundos: Number.isFinite(Number(ex?.descansoSegundos)) ? Math.max(10, Math.round(Number(ex.descansoSegundos))) : 45,
      descricao: String(ex?.descricao || ''),
      buscaImagem: String(ex?.buscaImagem || IMAGE_SEARCH_TERMS[grupoMuscular]),
      sets: Array.from({ length: series }, () => ({ done: false, peso: null })),
    };
  });
}

function sanitizePlan(raw) {
  const diasRaw = Array.isArray(raw?.dias) && raw.dias.length ? raw.dias : [{ letra: 'A', foco: raw?.nomeTreino, duracaoEstimadaMin: raw?.duracaoEstimadaMin, exercicios: raw?.exercicios }];

  const dias = diasRaw.map((dia, idx) => {
    const exercicios = sanitizeExercicios(dia?.exercicios);
    return {
      letra: String(dia?.letra || String.fromCharCode(65 + idx)),
      foco: String(dia?.foco || ''),
      duracaoEstimadaMin: Number.isFinite(Number(dia?.duracaoEstimadaMin)) ? Math.round(Number(dia.duracaoEstimadaMin)) : 30,
      exercicios,
    };
  }).filter((dia) => dia.exercicios.length);

  if (!dias.length) throw new Error('A IA não retornou nenhum exercício. Tente descrever o treino de outra forma.');

  return {
    nomePlano: String(raw?.nomePlano || raw?.nomeTreino || 'Treino'),
    dias,
  };
}

async function generateWorkout(userPrompt, apiKey) {
  const model = 'llama-3.3-70b-versatile';
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const systemPrompt = `Você é um personal trainer. Responda APENAS com um JSON válido (sem markdown, sem texto fora do JSON) no formato exato:
{
  "nomePlano": string (nome geral do plano, ex: "Treino ABC - Hipertrofia"),
  "dias": [
    {
      "letra": string (ex: "A", "B", "C" — use apenas 1 dia com letra "A" se o pedido do usuário não indicar uma divisão em múltiplos dias),
      "foco": string (grupos musculares trabalhados nesse dia, ex: "Peito, Ombro e Tríceps"),
      "duracaoEstimadaMin": number,
      "exercicios": [
        {
          "nome": string,
          "grupoMuscular": um destes valores exatos: ${GROQ_GROUPS.map((g) => `"${g}"`).join(' | ')},
          "series": number,
          "repeticoes": string,
          "descansoSegundos": number entre 20 e 120,
          "descricao": string com 2 a 3 frases explicando como executar o movimento corretamente e pontos de atenção,
          "buscaImagem": string curta em inglês descrevendo o equipamento/movimento para busca de imagem (ex: "flat barbell bench press", "lat pulldown machine")
        }
      ]
    }
  ]
}
A frequência semanal informada no perfil da pessoa define quantos dias (letras) o plano deve ter: gere exatamente esse número de dias, cada um com foco muscular diferente e sem repetir os mesmos exercícios entre os dias. Se a frequência for de 1x por semana, gere apenas 1 dia com letra "A".
Leve em conta o perfil completo (objetivo, nível, altura, peso, se treina sozinho ou acompanhado, e principalmente dores/lesões relatadas) para ajustar séries, repetições e escolher exercícios seguros e adequados.`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Monte um treino de academia em português para esta pessoa:\n${userPrompt}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    const msg = errBody?.error?.message || `Erro HTTP ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('A IA não retornou um treino válido. Tente novamente.');

  const plan = sanitizePlan(JSON.parse(stripCodeFence(text)));
  plan.id = `w_${Date.now()}`;
  plan.createdAt = new Date().toISOString();
  plan.diaAtivo = 0;
  return plan;
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

// ---------- Configurações: chave API, tema, som e vibração ----------
const apiKeyInput = document.getElementById('apiKeyInput');
const keyStatus = document.getElementById('keyStatus');
const themeSegmented = document.getElementById('themeSegmented');
const soundToggle = document.getElementById('soundToggle');
const vibrationToggle = document.getElementById('vibrationToggle');

function refreshKeyStatus() {
  const key = load(STORAGE_KEYS.apiKey, '');
  keyStatus.textContent = key ? 'Chave salva neste celular.' : 'Nenhuma chave configurada ainda.';
}

function refreshSettingsUI() {
  const settings = loadSettings();
  themeSegmented.querySelectorAll('.segmented-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.theme === settings.theme);
  });
  soundToggle.checked = settings.sound;
  vibrationToggle.checked = settings.vibration;
}

document.getElementById('btnSettings').addEventListener('click', () => {
  apiKeyInput.value = load(STORAGE_KEYS.apiKey, '');
  refreshKeyStatus();
  refreshSettingsUI();
  showScreen('settings');
});
document.getElementById('btnCloseSettings').addEventListener('click', () => renderCurrentOrGenerate());
document.getElementById('btnSaveKey').addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  save(STORAGE_KEYS.apiKey, key);
  refreshKeyStatus();
});

themeSegmented.querySelectorAll('.segmented-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const settings = loadSettings();
    settings.theme = btn.dataset.theme;
    save(STORAGE_KEYS.settings, settings);
    applyTheme(settings.theme);
    refreshSettingsUI();
  });
});
soundToggle.addEventListener('change', () => {
  const settings = loadSettings();
  settings.sound = soundToggle.checked;
  save(STORAGE_KEYS.settings, settings);
});
vibrationToggle.addEventListener('change', () => {
  const settings = loadSettings();
  settings.vibration = vibrationToggle.checked;
  save(STORAGE_KEYS.settings, settings);
});

// ---------- Histórico: streak, calendário e planos ----------
let calendarViewDate = new Date();

document.getElementById('btnHistory').addEventListener('click', () => {
  calendarViewDate = new Date();
  renderStreak();
  renderCalendar();
  renderHistory();
  showScreen('history');
});
document.getElementById('btnCloseHistory').addEventListener('click', () => renderCurrentOrGenerate());

function renderStreak() {
  const sessions = load(STORAGE_KEYS.sessions, []);
  const streak = computeStreak(sessions);
  document.getElementById('streakCount').textContent = streak === 1 ? '1 dia seguido' : `${streak} dias seguidos`;
  document.getElementById('streakEmoji').textContent = streak > 0 ? '🔥' : '💤';
}

function renderCalendar() {
  const sessions = new Set(load(STORAGE_KEYS.sessions, []));
  const year = calendarViewDate.getFullYear();
  const month = calendarViewDate.getMonth();

  document.getElementById('calendarLabel').textContent = calendarViewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const weekdaysEl = document.getElementById('calendarWeekdays');
  weekdaysEl.innerHTML = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d) => `<span>${d}</span>`).join('');

  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = dateStr();

  const grid = document.getElementById('calendarGrid');
  grid.innerHTML = '';
  for (let i = 0; i < startOffset; i++) {
    grid.insertAdjacentHTML('beforeend', '<div class="calendar-day empty"></div>');
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const key = dateStr(new Date(year, month, day));
    const classes = ['calendar-day'];
    if (sessions.has(key)) classes.push('trained');
    if (key === todayKey) classes.push('today');
    grid.insertAdjacentHTML('beforeend', `<div class="${classes.join(' ')}">${day}</div>`);
  }
}

document.getElementById('btnCalPrev').addEventListener('click', () => {
  calendarViewDate.setMonth(calendarViewDate.getMonth() - 1);
  renderCalendar();
});
document.getElementById('btnCalNext').addEventListener('click', () => {
  calendarViewDate.setMonth(calendarViewDate.getMonth() + 1);
  renderCalendar();
});

function renderHistory() {
  const history = load(STORAGE_KEYS.history, []);
  const list = document.getElementById('historyList');
  const empty = document.getElementById('historyEmpty');
  list.innerHTML = '';
  empty.classList.toggle('hidden', history.length > 0);

  history
    .slice()
    .reverse()
    .forEach((plan) => {
      const btn = document.createElement('button');
      btn.className = 'history-item';
      const date = new Date(plan.createdAt);
      const totalExercicios = plan.dias.reduce((sum, d) => sum + d.exercicios.length, 0);
      const diasLabel = plan.dias.length > 1 ? `${plan.dias.length} dias (${plan.dias.map((d) => d.letra).join('/')})` : '1 dia';
      btn.innerHTML = `<b>${escapeHtml(plan.nomePlano)}</b><span>${date.toLocaleDateString('pt-BR')} · ${diasLabel} · ${totalExercicios} exercícios</span>`;
      btn.addEventListener('click', () => {
        plan.diaAtivo = 0;
        save(STORAGE_KEYS.current, plan);
        renderWorkout(plan);
        showScreen('workout');
      });
      list.appendChild(btn);
    });
}

// ---------- Formulário de perfil (substitui a descrição livre) ----------
const generateError = document.getElementById('generateError');

function setSegmentedActive(containerId, value) {
  document.querySelectorAll(`#${containerId} .segmented-btn`).forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.value === value);
  });
}
function selectedSegmentedValue(containerId) {
  return document.querySelector(`#${containerId} .segmented-btn.active`)?.dataset.value || null;
}
function wireSegmented(containerId) {
  document.querySelectorAll(`#${containerId} .segmented-btn`).forEach((btn) => {
    btn.addEventListener('click', () => setSegmentedActive(containerId, btn.dataset.value));
  });
}
wireSegmented('formNivel');
wireSegmented('formCompanhia');
wireSegmented('formParceiroNivel');

document.querySelectorAll('#formDores .checkbox-chip input, #formParceiroDores .checkbox-chip input').forEach((cb) => {
  cb.addEventListener('change', () => cb.closest('.checkbox-chip').classList.toggle('active', cb.checked));
});

const parceiroFields = document.getElementById('parceiroFields');
document.querySelectorAll('#formCompanhia .segmented-btn').forEach((btn) => {
  btn.addEventListener('click', () => parceiroFields.classList.toggle('hidden', btn.dataset.value !== 'dupla'));
});

const DOR_LABELS = {
  joelho: 'Joelho',
  ombro: 'Ombro',
  lombar: 'Lombar / coluna',
  punho: 'Punho',
  cotovelo: 'Cotovelo',
  tornozelo: 'Tornozelo',
  pescoco: 'Pescoço',
};

function readProfileFromForm() {
  const companhia = selectedSegmentedValue('formCompanhia') || 'sozinho';
  const profile = {
    objetivo: document.getElementById('formObjetivo').value,
    nivel: selectedSegmentedValue('formNivel') || 'iniciante',
    altura: document.getElementById('formAltura').value.trim(),
    peso: document.getElementById('formPeso').value.trim(),
    dias: document.getElementById('formDias').value,
    duracao: document.getElementById('formDuracao').value,
    companhia,
    dores: Array.from(document.querySelectorAll('#formDores input:checked')).map((cb) => cb.value),
    obs: document.getElementById('formObs').value.trim(),
  };
  if (companhia === 'dupla') {
    profile.parceiro = {
      objetivo: document.getElementById('formParceiroObjetivo').value,
      nivel: selectedSegmentedValue('formParceiroNivel') || 'iniciante',
      peso: document.getElementById('formParceiroPeso').value.trim(),
      dores: Array.from(document.querySelectorAll('#formParceiroDores input:checked')).map((cb) => cb.value),
    };
  }
  return profile;
}

function prefillForm() {
  const profile = load(STORAGE_KEYS.profile, {});
  document.getElementById('formObjetivo').value = profile.objetivo || 'hipertrofia';
  setSegmentedActive('formNivel', profile.nivel || 'iniciante');
  document.getElementById('formAltura').value = profile.altura || '';
  document.getElementById('formPeso').value = profile.peso || '';
  document.getElementById('formDias').value = profile.dias || '3';
  document.getElementById('formDuracao').value = profile.duracao || '45';
  const companhia = profile.companhia || 'sozinho';
  setSegmentedActive('formCompanhia', companhia);
  parceiroFields.classList.toggle('hidden', companhia !== 'dupla');
  const dores = new Set(profile.dores || []);
  document.querySelectorAll('#formDores .checkbox-chip input').forEach((cb) => {
    cb.checked = dores.has(cb.value);
    cb.closest('.checkbox-chip').classList.toggle('active', cb.checked);
  });
  document.getElementById('formObs').value = profile.obs || '';

  const parceiro = profile.parceiro || {};
  document.getElementById('formParceiroObjetivo').value = parceiro.objetivo || 'hipertrofia';
  setSegmentedActive('formParceiroNivel', parceiro.nivel || 'iniciante');
  document.getElementById('formParceiroPeso').value = parceiro.peso || '';
  const parceiroDores = new Set(parceiro.dores || []);
  document.querySelectorAll('#formParceiroDores .checkbox-chip input').forEach((cb) => {
    cb.checked = parceiroDores.has(cb.value);
    cb.closest('.checkbox-chip').classList.toggle('active', cb.checked);
  });
}

const OBJETIVO_LABELS = {
  hipertrofia: 'Hipertrofia (ganho de massa muscular)',
  emagrecimento: 'Emagrecimento',
  condicionamento: 'Condicionamento físico geral',
  forca: 'Ganho de força',
  definicao: 'Definição muscular',
};
const NIVEL_LABELS = { iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado' };
const DIAS_LABELS = {
  1: '1x por semana (treino único)',
  2: '2x por semana (divisão AB)',
  3: '3x por semana (divisão ABC)',
  4: '4x por semana (divisão ABCD)',
  5: '5x por semana (divisão ABCDE)',
  6: '6x por semana (divisão ABCDEF)',
};

function buildPromptFromProfile(profile) {
  const linhas = [
    `Objetivo: ${OBJETIVO_LABELS[profile.objetivo] || profile.objetivo}`,
    `Nível: ${NIVEL_LABELS[profile.nivel] || profile.nivel}`,
    `Frequência: ${DIAS_LABELS[profile.dias] || `${profile.dias}x por semana`}`,
    `Duração desejada por sessão: ~${profile.duracao} minutos`,
    `Vai treinar: ${profile.companhia === 'dupla' ? 'acompanhado(a) de outra pessoa' : 'sozinho(a)'}`,
  ];
  if (profile.altura) linhas.push(`Altura: ${profile.altura} cm`);
  if (profile.peso) linhas.push(`Peso: ${profile.peso} kg`);
  if (profile.dores.length) {
    const dorLabels = profile.dores.map((d) => DOR_LABELS[d] || d).join(', ');
    linhas.push(`Dores ou lesões relatadas: ${dorLabels}. Evite ou adapte exercícios que sobrecarreguem essas áreas e explique a adaptação na descrição quando relevante.`);
  } else {
    linhas.push('Sem dores ou lesões relatadas.');
  }
  if (profile.obs) linhas.push(`Observações adicionais: ${profile.obs}`);

  if (profile.companhia === 'dupla' && profile.parceiro) {
    const p = profile.parceiro;
    linhas.push('', '--- Dados da segunda pessoa (vão treinar juntos, na mesma sessão) ---');
    linhas.push(`Objetivo do parceiro(a): ${OBJETIVO_LABELS[p.objetivo] || p.objetivo}`);
    linhas.push(`Nível do parceiro(a): ${NIVEL_LABELS[p.nivel] || p.nivel}`);
    if (p.peso) linhas.push(`Peso do parceiro(a): ${p.peso} kg`);
    if (p.dores.length) {
      const dorLabels = p.dores.map((d) => DOR_LABELS[d] || d).join(', ');
      linhas.push(`Dores ou lesões do parceiro(a): ${dorLabels}. Evite ou adapte exercícios que sobrecarreguem essas áreas para essa pessoa também.`);
    } else {
      linhas.push('Parceiro(a) sem dores ou lesões relatadas.');
    }
    linhas.push('Monte UM ÚNICO plano para as duas pessoas seguirem juntas, nos mesmos exercícios/estações. Quando os níveis, pesos ou objetivos forem diferentes, inclua na "descricao" uma sugestão de ajuste de carga ou repetições para cada pessoa (ex: "Iniciante: use uma carga mais leve e foque na execução; Intermediário: aumente a carga mantendo a técnica").');
  }

  return linhas.join('\n');
}

document.getElementById('btnGenerate').addEventListener('click', async () => {
  generateError.classList.add('hidden');

  const apiKey = load(STORAGE_KEYS.apiKey, '');
  if (!apiKey) {
    showError('Configure sua chave gratuita da Groq em ⚙️ Configurações antes de gerar um treino.');
    return;
  }

  const profile = readProfileFromForm();
  save(STORAGE_KEYS.profile, profile);
  const userPrompt = buildPromptFromProfile(profile);

  showScreen('loading');
  try {
    const plan = await generateWorkout(userPrompt, apiKey);
    save(STORAGE_KEYS.current, plan);
    const history = load(STORAGE_KEYS.history, []);
    history.push(plan);
    save(STORAGE_KEYS.history, history);
    renderWorkout(plan);
    showScreen('workout');
  } catch (err) {
    showScreen('generate');
    showError(`Não foi possível gerar o treino: ${err.message}`);
  }
});

document.getElementById('btnNewWorkout').addEventListener('click', () => {
  generateError.classList.add('hidden');
  prefillForm();
  showScreen('generate');
});

function showError(msg) {
  generateError.textContent = msg;
  generateError.classList.remove('hidden');
  showScreen('generate');
}

function syncPlanToHistory(plan) {
  const history = load(STORAGE_KEYS.history, []);
  const idx = history.findIndex((p) => p.id === plan.id);
  if (idx !== -1) {
    history[idx] = plan;
    save(STORAGE_KEYS.history, history);
  }
}

// ---------- Renderização do treino ----------
function isDiaCompleto(dia) {
  return dia.exercicios.every((ex) => ex.sets.every((s) => s.done));
}

function renderWorkout(plan) {
  const diaIdx = plan.diaAtivo || 0;
  const dia = plan.dias[diaIdx];

  document.getElementById('workoutTitle').textContent = plan.nomePlano;

  const dayTabs = document.getElementById('dayTabs');
  dayTabs.innerHTML = '';
  if (plan.dias.length > 1) {
    dayTabs.classList.remove('hidden');
    plan.dias.forEach((d, idx) => {
      const tab = document.createElement('button');
      tab.className = 'day-tab' + (idx === diaIdx ? ' active' : '') + (isDiaCompleto(d) ? ' complete' : '');
      tab.textContent = `Treino ${d.letra}${isDiaCompleto(d) ? ' ✓' : ''}`;
      tab.addEventListener('click', () => {
        plan.diaAtivo = idx;
        save(STORAGE_KEYS.current, plan);
        renderWorkout(plan);
      });
      dayTabs.appendChild(tab);
    });
  } else {
    dayTabs.classList.add('hidden');
  }

  document.getElementById('workoutMeta').textContent = dia.foco
    ? `${dia.foco} · ${dia.exercicios.length} exercícios · ~${dia.duracaoEstimadaMin} min`
    : `${dia.exercicios.length} exercícios · ~${dia.duracaoEstimadaMin} min`;

  const list = document.getElementById('exerciseList');
  list.innerHTML = '';

  dia.exercicios.forEach((ex, idx) => {
    const card = document.createElement('div');
    card.className = 'exercise-card' + (ex.sets.every((s) => s.done) ? ' done' : '');

    const setsRow = ex.sets.map((s, i) => {
      const label = s.done ? (s.peso != null ? `✓ ${s.peso}kg` : '✓') : `${i + 1}ª série`;
      return `<button class="check-btn set-btn${s.done ? ' checked' : ''}" data-idx="${idx}" data-set="${i}">${label}</button>`;
    }).join('');

    card.innerHTML = `
      <div class="ex-icon">${iconFor(ex.grupoMuscular)}</div>
      <div class="ex-body">
        <div class="ex-card-head">
          <p class="ex-name">${escapeHtml(ex.nome)}</p>
          <div>
            <button class="ex-mini-btn edit-btn" data-idx="${idx}" aria-label="Editar">✏️</button>
            <button class="ex-mini-btn danger remove-btn" data-idx="${idx}" aria-label="Remover">🗑️</button>
          </div>
        </div>
        <p class="ex-sets">${ex.series} séries × ${escapeHtml(ex.repeticoes)} · descanso ${ex.descansoSegundos}s</p>
        <p class="ex-desc">${escapeHtml(ex.descricao)}</p>
        <div class="ex-actions">${setsRow}</div>
        <button class="exec-btn view-exec-btn" data-idx="${idx}">📷 Ver execução</button>
      </div>
    `;
    list.appendChild(card);
  });

  list.querySelectorAll('.set-btn').forEach((btn) => {
    btn.addEventListener('click', () => onSetClick(diaIdx, Number(btn.dataset.idx), Number(btn.dataset.set)));
  });
  list.querySelectorAll('.edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => openEditModal(diaIdx, Number(btn.dataset.idx)));
  });
  list.querySelectorAll('.remove-btn').forEach((btn) => {
    btn.addEventListener('click', () => removeExercise(diaIdx, Number(btn.dataset.idx)));
  });
  list.querySelectorAll('.view-exec-btn').forEach((btn) => {
    btn.addEventListener('click', () => openExerciseImage(dia.exercicios[Number(btn.dataset.idx)]));
  });

  updateProgress(dia);
}

function updateProgress(dia) {
  const total = dia.exercicios.reduce((sum, ex) => sum + ex.sets.length, 0);
  const done = dia.exercicios.reduce((sum, ex) => sum + ex.sets.filter((s) => s.done).length, 0);
  const pct = total ? Math.round((done / total) * 100) : 0;
  document.getElementById('progressFill').style.width = `${pct}%`;
}

// ---------- Marcar série (com registro de peso) ----------
let pendingSet = null;
const weightOverlay = document.getElementById('weightOverlay');
const weightInput = document.getElementById('weightInput');

function onSetClick(diaIdx, exIdx, setIdx) {
  const plan = load(STORAGE_KEYS.current, null);
  if (!plan) return;
  const ex = plan.dias[diaIdx].exercicios[exIdx];
  const set = ex.sets[setIdx];

  if (set.done) {
    ex.sets.forEach((s, i) => {
      if (i >= setIdx) {
        s.done = false;
        s.peso = null;
      }
    });
    save(STORAGE_KEYS.current, plan);
    renderWorkout(plan);
    return;
  }

  pendingSet = {
    diaIdx,
    exIdx,
    setIdx,
    nome: ex.nome,
    descansoSegundos: ex.descansoSegundos,
    isLast: setIdx + 1 >= ex.series,
  };
  document.getElementById('weightExerciseName').textContent = ex.nome;
  const lastWeight = getLastWeight(ex.nome);
  weightInput.value = lastWeight != null ? lastWeight : '';
  weightOverlay.classList.remove('hidden');
  weightInput.focus();
}

function completeSet(peso) {
  if (!pendingSet) return;
  const plan = load(STORAGE_KEYS.current, null);
  if (!plan) {
    pendingSet = null;
    return;
  }
  const ex = plan.dias[pendingSet.diaIdx].exercicios[pendingSet.exIdx];
  ex.sets[pendingSet.setIdx] = { done: true, peso };
  if (peso != null) saveWeight(ex.nome, peso);
  logSessionToday();
  save(STORAGE_KEYS.current, plan);

  weightOverlay.classList.add('hidden');
  const { descansoSegundos, nome, isLast } = pendingSet;
  pendingSet = null;
  renderWorkout(plan);
  if (!isLast) startRestTimer(descansoSegundos, nome);
}

document.getElementById('btnWeightConfirm').addEventListener('click', () => {
  const raw = weightInput.value.trim();
  const peso = raw ? Number(raw) : null;
  completeSet(Number.isFinite(peso) ? peso : null);
});
document.getElementById('btnWeightSkip').addEventListener('click', () => completeSet(null));
weightInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('btnWeightConfirm').click();
});

// ---------- Ver execução (foto real do exercício) ----------
const exerciseImageOverlay = document.getElementById('exerciseImageOverlay');

function openExerciseImage(ex) {
  document.getElementById('imageExerciseName').textContent = ex.nome;
  document.getElementById('imageExerciseDesc').textContent = ex.descricao;
  const body = document.getElementById('imageBody');
  body.innerHTML = '<div class="spinner"></div>';
  exerciseImageOverlay.classList.remove('hidden');

  const term = ex.buscaImagem || IMAGE_SEARCH_TERMS[ex.grupoMuscular];
  getOrFetchImage(term)
    .then((url) => {
      body.innerHTML = url
        ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(ex.nome)}">`
        : `<div class="image-fallback">${iconFor(ex.grupoMuscular)}<p class="muted small">Sem foto disponível para este exercício</p></div>`;
    })
    .catch(() => {
      body.innerHTML = `<div class="image-fallback">${iconFor(ex.grupoMuscular)}<p class="muted small">Não foi possível carregar a foto</p></div>`;
    });
}

document.getElementById('btnCloseImage').addEventListener('click', () => {
  exerciseImageOverlay.classList.add('hidden');
});

// ---------- Editar / adicionar / remover exercício ----------
let pendingEdit = null;
const editExerciseOverlay = document.getElementById('editExerciseOverlay');

function openEditModal(diaIdx, exIdx) {
  const plan = load(STORAGE_KEYS.current, null);
  if (!plan) return;
  const dia = plan.dias[diaIdx];
  const ex = exIdx != null ? dia.exercicios[exIdx] : null;
  pendingEdit = { diaIdx, exIdx };

  document.getElementById('editFormTitle').textContent = ex ? 'Editar exercício' : 'Adicionar exercício';
  document.getElementById('editNome').value = ex?.nome || '';
  document.getElementById('editGrupo').value = ex?.grupoMuscular || 'corpo_todo';
  document.getElementById('editSeries').value = ex?.series || 3;
  document.getElementById('editRepeticoes').value = ex?.repeticoes || '12';
  document.getElementById('editDescanso').value = ex?.descansoSegundos || 60;
  document.getElementById('editDescricao').value = ex?.descricao || '';

  editExerciseOverlay.classList.remove('hidden');
}

document.getElementById('btnEditCancel').addEventListener('click', () => {
  pendingEdit = null;
  editExerciseOverlay.classList.add('hidden');
});

document.getElementById('btnEditSave').addEventListener('click', () => {
  if (!pendingEdit) return;
  const nomeInput = document.getElementById('editNome');
  const nome = nomeInput.value.trim();
  if (!nome) {
    nomeInput.focus();
    return;
  }
  const grupoMuscular = document.getElementById('editGrupo').value;
  const series = Math.max(1, Math.round(Number(document.getElementById('editSeries').value) || 3));
  const repeticoes = document.getElementById('editRepeticoes').value.trim() || '12';
  const descansoSegundos = Math.max(10, Math.round(Number(document.getElementById('editDescanso').value) || 60));
  const descricao = document.getElementById('editDescricao').value.trim();

  const plan = load(STORAGE_KEYS.current, null);
  if (!plan) return;
  const dia = plan.dias[pendingEdit.diaIdx];
  const existing = pendingEdit.exIdx != null ? dia.exercicios[pendingEdit.exIdx] : null;

  const sets = Array.from({ length: series }, (_, i) => (existing?.sets[i]) || { done: false, peso: null });

  const novoEx = {
    nome,
    grupoMuscular,
    series,
    repeticoes,
    descansoSegundos,
    descricao,
    buscaImagem: existing?.buscaImagem || IMAGE_SEARCH_TERMS[grupoMuscular],
    sets,
  };

  if (pendingEdit.exIdx != null) {
    dia.exercicios[pendingEdit.exIdx] = novoEx;
  } else {
    dia.exercicios.push(novoEx);
  }

  save(STORAGE_KEYS.current, plan);
  syncPlanToHistory(plan);
  pendingEdit = null;
  editExerciseOverlay.classList.add('hidden');
  renderWorkout(plan);
});

document.getElementById('btnAddExercise').addEventListener('click', () => {
  const plan = load(STORAGE_KEYS.current, null);
  if (!plan) return;
  openEditModal(plan.diaAtivo || 0, null);
});

function removeExercise(diaIdx, exIdx) {
  const plan = load(STORAGE_KEYS.current, null);
  if (!plan) return;
  const dia = plan.dias[diaIdx];
  const ex = dia.exercicios[exIdx];
  if (!confirm(`Remover "${ex.nome}" deste treino?`)) return;

  dia.exercicios.splice(exIdx, 1);
  save(STORAGE_KEYS.current, plan);
  syncPlanToHistory(plan);
  renderWorkout(plan);
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
  const settings = loadSettings();
  if (settings.sound) playBeep();
  if (settings.vibration && navigator.vibrate) navigator.vibrate([200, 100, 200]);
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

// ---------- Compartilhar treino (treino a dois em celulares separados) ----------
function encodePlanForShare(plan) {
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(plan))));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodePlanFromShare(encoded) {
  let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return JSON.parse(decodeURIComponent(escape(atob(b64))));
}

async function sharePlan(plan) {
  const encoded = encodePlanForShare(plan);
  const url = `${location.origin}${location.pathname}?import=${encodeURIComponent(encoded)}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: 'Treino IA', text: `Treino "${plan.nomePlano}" pra treinarmos juntos:`, url });
    } catch {
      /* usuário cancelou o compartilhamento */
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    alert('Link do treino copiado! Envie para quem vai treinar com você.');
  } catch {
    prompt('Copie o link abaixo e envie para quem vai treinar com você:', url);
  }
}

document.getElementById('btnShareWorkout').addEventListener('click', () => {
  const plan = load(STORAGE_KEYS.current, null);
  if (plan) sharePlan(plan);
});

function tryImportFromUrl() {
  const params = new URLSearchParams(location.search);
  const encoded = params.get('import');
  if (!encoded) return false;
  window.history.replaceState({}, '', location.pathname);

  let plan;
  try {
    plan = sanitizePlan(decodePlanFromShare(encoded));
  } catch {
    alert('Não foi possível importar o treino compartilhado — o link pode estar corrompido.');
    return false;
  }

  const existing = load(STORAGE_KEYS.current, null);
  if (existing && !confirm(`Importar o treino compartilhado "${plan.nomePlano}"? Isso substitui o treino em andamento (seu histórico anterior continua salvo).`)) {
    return false;
  }

  plan.id = `w_${Date.now()}`;
  plan.createdAt = new Date().toISOString();
  plan.diaAtivo = 0;
  save(STORAGE_KEYS.current, plan);
  const history = load(STORAGE_KEYS.history, []);
  history.push(plan);
  save(STORAGE_KEYS.history, history);
  return true;
}

// ---------- Inicialização ----------
function renderCurrentOrGenerate() {
  const current = load(STORAGE_KEYS.current, null);
  if (current) {
    renderWorkout(current);
    showScreen('workout');
  } else {
    prefillForm();
    showScreen('generate');
  }
}

if (tryImportFromUrl()) {
  renderWorkout(load(STORAGE_KEYS.current, null));
  showScreen('workout');
} else {
  renderCurrentOrGenerate();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
