import { RUSSIAN_CITIES, City } from './data/russianCities';
import './style.css';

export type GameMode = 'practice' | 'challenge';
export type ScreenState = 'menu' | 'playing' | 'stats';

interface HistoryEntry {
  cyrillic: string;
  expected: string;
  userAnswer: string;
  isCorrect: boolean;
  skipped: boolean;
}

interface GameStats {
  correct: number;
  incorrect: number;
  skipped: number;
  startTime: number;
  endTime: number | null;
  history: HistoryEntry[];
}

interface GameState {
  screen: ScreenState;
  mode: GameMode;
  lives: number;
  maxLives: number;
  remainingCities: City[];
  currentCity: City | null;
  lastCityId: number | null;
  stats: GameStats;
  feedback: {
    type: 'correct' | 'incorrect' | null;
    message: string;
  };
  showReferenceTable: boolean;
  timerInterval: number | null;
  elapsedSeconds: number;
}

// Global state instance
const state: GameState = {
  screen: 'menu',
  mode: 'practice',
  lives: 5,
  maxLives: 5,
  remainingCities: [...RUSSIAN_CITIES],
  currentCity: null,
  lastCityId: null,
  stats: {
    correct: 0,
    incorrect: 0,
    skipped: 0,
    startTime: 0,
    endTime: null,
    history: [],
  },
  feedback: {
    type: null,
    message: '',
  },
  showReferenceTable: false,
  timerInterval: null,
  elapsedSeconds: 0,
};

// Cyrillic to English Transliteration reference data
const TRANSLITERATION_MAP = [
  { cyr: 'А а', lat: 'A' }, { cyr: 'Б б', lat: 'B' }, { cyr: 'В в', lat: 'V' },
  { cyr: 'Г г', lat: 'G' }, { cyr: 'Д д', lat: 'D' }, { cyr: 'Е е', lat: 'E / Ye' },
  { cyr: 'Ё ё', lat: 'Yo' }, { cyr: 'Ж ж', lat: 'Zh' }, { cyr: 'З з', lat: 'Z' },
  { cyr: 'И и', lat: 'I' }, { cyr: 'Й й', lat: 'Y' }, { cyr: 'К к', lat: 'K' },
  { cyr: 'Л л', lat: 'L' }, { cyr: 'М м', lat: 'M' }, { cyr: 'Н н', lat: 'N' },
  { cyr: 'О о', lat: 'O' }, { cyr: 'П п', lat: 'P' }, { cyr: 'Р р', lat: 'R' },
  { cyr: 'С с', lat: 'S' }, { cyr: 'Т т', lat: 'T' }, { cyr: 'У у', lat: 'U' },
  { cyr: 'Ф ф', lat: 'F' }, { cyr: 'Х х', lat: 'Kh' }, { cyr: 'Ц ц', lat: 'Ts' },
  { cyr: 'Ч ч', lat: 'Ch' }, { cyr: 'Ш ш', lat: 'Sh' }, { cyr: 'Щ щ', lat: 'Shch' },
  { cyr: 'Ъ ъ', lat: '—' }, { cyr: 'Ы ы', lat: 'Y' }, { cyr: 'Ь ь', lat: '—' },
  { cyr: 'Э э', lat: 'E' }, { cyr: 'Ю ю', lat: 'Yu' }, { cyr: 'Я я', lat: 'Ya' },
];

/**
 * Normalizes text for lenient matching (casing, diacritics, spaces, hyphens)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Checks if user answer matches target Latin name or any valid aliases
 */
function isAnswerCorrect(userAnswer: string, city: City): boolean {
  const normalizedUser = normalizeText(userAnswer);
  if (!normalizedUser) return false;

  const validTargets = [city.latin, ...(city.aliases || [])];
  return validTargets.some(target => normalizeText(target) === normalizedUser);
}

/**
 * Starts a new game session
 */
function startGame(mode: GameMode, previousCityId?: number | null) {
  state.mode = mode;
  state.screen = 'playing';
  state.lives = mode === 'challenge' ? 5 : 999;
  state.maxLives = 5;
  state.remainingCities = [...RUSSIAN_CITIES];
  state.stats = {
    correct: 0,
    incorrect: 0,
    skipped: 0,
    startTime: Date.now(),
    endTime: null,
    history: [],
  };
  state.feedback = { type: null, message: '' };
  state.elapsedSeconds = 0;

  if (state.timerInterval) {
    clearInterval(state.timerInterval);
  }

  state.timerInterval = window.setInterval(() => {
    state.elapsedSeconds++;
    updateTimerDisplay();
  }, 1000);

  pickNextCity(previousCityId);
  render();
}

/**
 * Picks a random city from remaining pool avoiding specified or last city
 */
function pickNextCity(excludeId?: number | null) {
  if (state.remainingCities.length === 0) {
    endGame();
    return;
  }

  const forbidId = excludeId !== undefined ? excludeId : state.lastCityId;
  let candidates = state.remainingCities;
  if (candidates.length > 1 && forbidId !== null) {
    candidates = candidates.filter(c => c.id !== forbidId);
  }

  const randomIndex = Math.floor(Math.random() * candidates.length);
  state.currentCity = candidates[randomIndex];
  state.lastCityId = state.currentCity.id;
}

/**
 * Submits and validates current user input
 */
function submitAnswer(userAnswer: string) {
  if (!state.currentCity) return;

  const current = state.currentCity;
  const correct = isAnswerCorrect(userAnswer, current);

  if (correct) {
    state.stats.correct++;
    state.feedback = {
      type: 'correct',
      message: `¡Correcto! ${current.cyrillic} = ${current.latin}`,
    };
  } else {
    state.stats.incorrect++;
    if (state.mode === 'challenge') {
      state.lives--;
    }
    state.feedback = {
      type: 'incorrect',
      message: `Incorrecto. ${current.cyrillic} es "${current.latin}"`,
    };
  }

  state.stats.history.push({
    cyrillic: current.cyrillic,
    expected: current.latin,
    userAnswer: userAnswer.trim() || '(Vacío)',
    isCorrect: correct,
    skipped: false,
  });

  // Remove city from pool in this session
  state.remainingCities = state.remainingCities.filter(c => c.id !== current.id);

  if (state.mode === 'challenge' && state.lives <= 0) {
    endGame();
  } else if (state.remainingCities.length === 0) {
    endGame();
  } else {
    pickNextCity();
    render();
  }
}

/**
 * Skips current city
 */
function skipCity() {
  if (!state.currentCity) return;

  const current = state.currentCity;
  state.stats.skipped++;
  if (state.mode === 'challenge') {
    state.lives--;
  }

  state.feedback = {
    type: 'incorrect',
    message: `Saltada. ${current.cyrillic} es "${current.latin}"`,
  };

  state.stats.history.push({
    cyrillic: current.cyrillic,
    expected: current.latin,
    userAnswer: '(Saltada)',
    isCorrect: false,
    skipped: true,
  });

  state.remainingCities = state.remainingCities.filter(c => c.id !== current.id);

  if (state.mode === 'challenge' && state.lives <= 0) {
    endGame();
  } else if (state.remainingCities.length === 0) {
    endGame();
  } else {
    pickNextCity();
    render();
  }
}

/**
 * Ends game session and transitions to stats screen
 */
function endGame() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
  state.stats.endTime = Date.now();
  state.screen = 'stats';
  render();
}

/**
 * Formats seconds into MM:SS format
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Updates timer text live without re-rendering entire app DOM
 */
function updateTimerDisplay() {
  const timerEl = document.getElementById('timer-display');
  if (timerEl) {
    timerEl.textContent = formatTime(state.elapsedSeconds);
  }
}

/**
 * Main render function
 */
function render() {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  if (state.screen === 'menu') {
    appContainer.innerHTML = renderMenuScreen();
    attachMenuEvents();
  } else if (state.screen === 'playing') {
    appContainer.innerHTML = renderPlayingScreen();
    attachPlayingEvents();
  } else if (state.screen === 'stats') {
    appContainer.innerHTML = renderStatsScreen();
    attachStatsEvents();
  }
}

/**
 * Render Menu Screen
 */
function renderMenuScreen(): string {
  return `
    <main class="w-full max-w-2xl sm:max-w-3xl mx-auto game-card p-8 sm:p-12 space-y-8">
      <header class="text-center space-y-3 border-b border-neutral-200 pb-8">
        <span class="text-xs sm:text-sm font-semibold uppercase tracking-widest text-neutral-500">Aprende Ruso</span>
        <h1 class="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight">Minijuego Ruso-Latin</h1>
        <p class="text-base text-neutral-600 max-w-lg mx-auto">
          Practica la transliteración del alfabeto cirílico al latino (estándar internacional de mapas) con las 100 ciudades más grandes de Rusia.
        </p>
      </header>

      <section class="space-y-4">
        <h2 class="text-xs sm:text-sm font-bold uppercase tracking-wider text-neutral-500 mb-3">Selecciona un Modo de Juego</h2>
        
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <button id="btn-mode-practice" class="p-6 text-left border border-neutral-300 rounded-xl hover:border-neutral-900 hover:bg-neutral-50 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-neutral-900">
            <div class="flex items-center justify-between mb-3">
              <span class="font-semibold text-neutral-900 text-xl">Práctica</span>
              <span class="text-xs bg-neutral-100 text-neutral-700 px-2.5 py-1 rounded-md font-mono">Infinito</span>
            </div>
            <p class="text-sm text-neutral-600 leading-relaxed">
              Sin límite de vidas. Recorre las 100 ciudades rusas a tu propio ritmo. Ideal para aprender sin presión.
            </p>
          </button>

          <button id="btn-mode-challenge" class="p-6 text-left border border-neutral-300 rounded-xl hover:border-neutral-900 hover:bg-neutral-50 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-neutral-900">
            <div class="flex items-center justify-between mb-3">
              <span class="font-semibold text-neutral-900 text-xl">Desafío</span>
              <span class="text-xs bg-neutral-900 text-white px-2.5 py-1 rounded-md font-mono">5 Vidas</span>
            </div>
            <p class="text-sm text-neutral-600 leading-relaxed">
              Comienzas con 5 vidas. Cada respuesta incorrecta o salto descuenta 1 vida. ¿Hasta dónde llegarás?
            </p>
          </button>
        </div>
      </section>

      <div class="border-t border-neutral-200 pt-6 text-center">
        <button id="btn-toggle-ref" class="text-sm font-medium text-neutral-600 hover:text-neutral-900 underline underline-offset-4 cursor-pointer">
          ${state.showReferenceTable ? 'Ocultar Guía de Transliteración' : 'Ver Guía de Transliteración (Cirílico → Latino)'}
        </button>

        ${state.showReferenceTable ? renderReferenceTable() : ''}
      </div>
    </main>
  `;
}

/**
 * Render Transliteration Reference Table
 */
function renderReferenceTable(): string {
  return `
    <div class="mt-5 text-left border border-neutral-200 rounded-lg p-5 bg-neutral-50 text-xs sm:text-sm">
      <h3 class="font-bold text-neutral-800 mb-3 border-b border-neutral-200 pb-2">Equivalencias Principales Cirílico a Inglés</h3>
      <div class="grid grid-cols-3 sm:grid-cols-4 gap-2.5 font-mono">
        ${TRANSLITERATION_MAP.map(item => `
          <div class="p-2 bg-white border border-neutral-200 rounded flex justify-between">
            <span class="font-semibold text-neutral-900">${item.cyr}</span>
            <span class="text-neutral-500">${item.lat}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Attach events for menu screen
 */
function attachMenuEvents() {
  document.getElementById('btn-mode-practice')?.addEventListener('click', () => startGame('practice'));
  document.getElementById('btn-mode-challenge')?.addEventListener('click', () => startGame('challenge'));
  document.getElementById('btn-toggle-ref')?.addEventListener('click', () => {
    state.showReferenceTable = !state.showReferenceTable;
    render();
  });
}

/**
 * Helper to calculate font size class based on city name length to prevent layout shifts
 */
function getCyrillicFontSizeClass(text: string): string {
  const len = text.length;
  if (len <= 8) return 'text-5xl sm:text-6xl md:text-7xl';
  if (len <= 14) return 'text-3xl sm:text-4xl md:text-5xl';
  return 'text-2xl sm:text-3xl md:text-4xl';
}

/**
 * Render Main Game Screen
 */
function renderPlayingScreen(): string {
  const current = state.currentCity;
  if (!current) return '<div>No hay más ciudades.</div>';

  const totalAnswered = state.stats.correct + state.stats.incorrect + state.stats.skipped;
  const progressText = `Ciudad ${totalAnswered + 1} de ${RUSSIAN_CITIES.length}`;

  // Lives display for challenge mode
  let livesHTML = '';
  if (state.mode === 'challenge') {
    const hearts = '♥'.repeat(state.lives) + '♡'.repeat(state.maxLives - state.lives);
    livesHTML = `
      <div class="text-base font-mono tracking-widest text-neutral-900 flex items-center gap-1.5" title="Vidas restantes">
        <span class="text-xs sm:text-sm uppercase font-sans font-semibold text-neutral-500 mr-1">Vidas:</span>
        <span class="text-lg font-bold">${hearts}</span>
      </div>
    `;
  } else {
    livesHTML = `
      <div class="text-xs sm:text-sm font-mono bg-neutral-100 border border-neutral-300 text-neutral-700 px-3 py-1 rounded-md">
        Modo Práctica
      </div>
    `;
  }

  const feedbackClass = state.feedback.type === 'correct' 
    ? 'text-green-700 bg-green-50 border-green-200' 
    : state.feedback.type === 'incorrect' 
    ? 'text-red-700 bg-red-50 border-red-200' 
    : 'hidden';

  return `
    <main class="w-full max-w-2xl sm:max-w-3xl mx-auto game-card p-8 sm:p-10 flex flex-col justify-between min-h-[640px] space-y-6">
      <div class="space-y-6">
        <!-- Header bar with Progress, Timer and Lives -->
        <header class="flex items-center justify-between pb-5 border-b border-neutral-200 text-xs sm:text-sm text-neutral-600">
          <div class="flex items-center gap-3">
            <button type="button" id="btn-home-header" class="px-2.5 py-1 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded-md transition-all flex items-center gap-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-neutral-900" title="Volver al menú principal">
              <span>←</span>
              <span>Menú</span>
            </button>
            <span class="font-medium text-neutral-900 text-sm sm:text-base">${progressText}</span>
          </div>
          
          <div class="flex items-center gap-4 sm:gap-5">
            <div class="font-mono text-base font-semibold text-neutral-800 flex items-center gap-1.5">
              <span class="text-neutral-400">⏱</span>
              <span id="timer-display">${formatTime(state.elapsedSeconds)}</span>
            </div>
            ${livesHTML}
          </div>
        </header>

        <!-- Feedback Banner Area (Fixed Height Slot to Prevent Layout Shift) -->
        <div id="feedback-banner" class="h-12 flex items-center justify-center">
          ${state.feedback.message ? `
            <div class="w-full p-3 border rounded-lg text-sm font-medium text-center ${feedbackClass}">
              ${state.feedback.message}
            </div>
          ` : ''}
        </div>

        <!-- Main Game Question Card (Fixed Height Slot for City Display) -->
        <section class="text-center space-y-2">
          <span class="text-xs sm:text-sm uppercase tracking-widest font-semibold text-neutral-400">Ciudad en Cirílico</span>
          <div class="h-36 sm:h-44 flex items-center justify-center px-4">
            <div class="${getCyrillicFontSizeClass(current.cyrillic)} font-extrabold text-neutral-900 tracking-wide font-sans leading-tight break-words text-center">
              ${current.cyrillic}
            </div>
          </div>
        </section>

        <!-- Input Form -->
        <form id="game-form" class="space-y-5" autocomplete="off">
          <div>
            <label for="latin-input" class="block text-sm font-medium text-neutral-700 mb-2">
              Escribe el nombre en alfabeto latino (inglés):
            </label>
            <input
              id="latin-input"
              type="text"
              class="input-field"
              placeholder="ej: Moscow"
              autofocus
              required
            />
          </div>

          <div class="flex flex-col sm:flex-row gap-3 pt-1">
            <button type="submit" class="btn-primary flex-1">
              Comprobar
            </button>
            <button type="button" id="btn-skip" class="btn-secondary">
              Saltar
            </button>
            <button type="button" id="btn-restart" class="btn-secondary text-neutral-500 hover:text-neutral-900">
              Reiniciar
            </button>
          </div>
        </form>
      </div>

      <!-- Quick Reference Collapsible -->
      <footer class="border-t border-neutral-200 pt-4 text-center mt-auto">
        <button id="btn-toggle-ref-playing" class="text-sm text-neutral-500 hover:text-neutral-900 underline underline-offset-4">
          ${state.showReferenceTable ? 'Ocultar Guía' : 'Ver Tabla de Transliteración'}
        </button>
        ${state.showReferenceTable ? renderReferenceTable() : ''}
      </footer>
    </main>
  `;
}

/**
 * Stops current game and returns to home/menu screen
 */
function goToMenu() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
  state.screen = 'menu';
  render();
}

/**
 * Attach events for main game screen
 */
function attachPlayingEvents() {
  const form = document.getElementById('game-form') as HTMLFormElement | null;
  const input = document.getElementById('latin-input') as HTMLInputElement | null;
  const skipBtn = document.getElementById('btn-skip');
  const restartBtn = document.getElementById('btn-restart');
  const homeHeaderBtn = document.getElementById('btn-home-header');
  const refBtn = document.getElementById('btn-toggle-ref-playing');

  // Focus input automatically
  input?.focus();

  // Clear previous feedback message when user starts typing new answer
  input?.addEventListener('input', () => {
    if (state.feedback.message) {
      state.feedback = { type: null, message: '' };
      const banner = document.getElementById('feedback-banner');
      if (banner) banner.innerHTML = '';
    }
  });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input) {
      submitAnswer(input.value);
    }
  });

  skipBtn?.addEventListener('click', () => {
    skipCity();
  });

  restartBtn?.addEventListener('click', () => {
    const currentId = state.currentCity?.id ?? null;
    startGame(state.mode, currentId);
  });

  homeHeaderBtn?.addEventListener('click', goToMenu);

  refBtn?.addEventListener('click', () => {
    state.showReferenceTable = !state.showReferenceTable;
    render();
  });
}

/**
 * Render Final Statistics Screen
 */
function renderStatsScreen(): string {
  const totalAnswered = state.stats.correct + state.stats.incorrect + state.stats.skipped;
  const accuracy = totalAnswered > 0 ? Math.round((state.stats.correct / totalAnswered) * 100) : 0;
  const totalTimeText = formatTime(state.elapsedSeconds);

  let titleMessage = '¡Partida Completada!';
  if (state.mode === 'challenge' && state.lives <= 0) {
    titleMessage = 'Fin del Juego (Sin Vidas)';
  }

  return `
    <main class="w-full max-w-2xl sm:max-w-3xl mx-auto game-card p-8 sm:p-12 space-y-8">
      <header class="text-center border-b border-neutral-200 pb-6 space-y-2">
        <span class="text-xs sm:text-sm font-semibold uppercase tracking-widest text-neutral-500">Estadísticas Finales</span>
        <h1 class="text-3xl sm:text-4xl font-bold text-neutral-900">${titleMessage}</h1>
        <p class="text-sm text-neutral-600">
          Modo: <strong class="text-neutral-900 uppercase">${state.mode}</strong>
        </p>
      </header>

      <!-- Key Metrics Grid -->
      <section class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div class="p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
          <span class="block text-2xl font-bold text-neutral-900">${state.stats.correct}</span>
          <span class="text-xs text-neutral-500 font-medium">Aciertos</span>
        </div>

        <div class="p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
          <span class="block text-2xl font-bold text-neutral-900">${state.stats.incorrect}</span>
          <span class="text-xs text-neutral-500 font-medium">Errores</span>
        </div>

        <div class="p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
          <span class="block text-2xl font-bold text-neutral-900">${accuracy}%</span>
          <span class="text-xs text-neutral-500 font-medium">Precisión</span>
        </div>

        <div class="p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
          <span class="block text-2xl font-bold font-mono text-neutral-900">${totalTimeText}</span>
          <span class="text-xs text-neutral-500 font-medium">Tiempo Total</span>
        </div>
      </section>

      <!-- Summary Details -->
      <section class="border border-neutral-200 rounded-lg p-4 space-y-2 text-xs text-neutral-700">
        <div class="flex justify-between py-1 border-b border-neutral-100">
          <span>Ciudades intentadas:</span>
          <strong class="text-neutral-900 font-mono">${totalAnswered} / ${RUSSIAN_CITIES.length}</strong>
        </div>
        <div class="flex justify-between py-1 border-b border-neutral-100">
          <span>Ciudades saltadas:</span>
          <strong class="text-neutral-900 font-mono">${state.stats.skipped}</strong>
        </div>
        <div class="flex justify-between py-1">
          <span>Promedio por ciudad:</span>
          <strong class="text-neutral-900 font-mono">
            ${totalAnswered > 0 ? (state.elapsedSeconds / totalAnswered).toFixed(1) : '0'}s
          </strong>
        </div>
      </section>

      <!-- Detailed History Accordion/List -->
      ${state.stats.history.length > 0 ? `
        <section class="space-y-2">
          <h3 class="text-xs font-bold uppercase tracking-wider text-neutral-500">Historial de Respuestas</h3>
          <div class="max-h-52 overflow-y-auto border border-neutral-200 rounded-lg divide-y divide-neutral-200 text-xs">
            ${state.stats.history.map(item => `
              <div class="p-2.5 flex items-center justify-between bg-white">
                <div>
                  <span class="font-bold text-neutral-900 mr-2">${item.cyrillic}</span>
                  <span class="text-neutral-500">→ ${item.expected}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="font-mono text-neutral-600">${item.userAnswer}</span>
                  ${item.isCorrect 
                    ? '<span class="text-green-600 font-bold">✓</span>' 
                    : '<span class="text-red-600 font-bold">✕</span>'}
                </div>
              </div>
            `).join('')}
          </div>
        </section>
      ` : ''}

      <!-- Action Buttons -->
      <footer class="flex flex-col sm:flex-row gap-3 pt-2">
        <button id="btn-replay" class="btn-primary flex-1">
          Jugar de Nuevo (${state.mode === 'practice' ? 'Práctica' : 'Desafío'})
        </button>
        <button id="btn-menu" class="btn-secondary flex-1">
          Cambiar de Modo / Menú
        </button>
      </footer>
    </main>
  `;
}

/**
 * Attach events for stats screen
 */
function attachStatsEvents() {
  document.getElementById('btn-replay')?.addEventListener('click', () => {
    startGame(state.mode);
  });

  document.getElementById('btn-menu')?.addEventListener('click', () => {
    state.screen = 'menu';
    render();
  });
}

// Initial App Mount
render();
