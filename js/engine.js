// Čistá logika aplikace (bez práce s DOM) – testuje se v Node, v prohlížeči běží jako window.Engine.
(function (root) {
  const STORAGE_KEY = 'anglictina-v1';
  const MAX_BOX = 5;
  const XP_PER_CORRECT = 10;
  const XP_LESSON_BONUS = 20;
  const DAILY_GOALS = [10, 20, 30, 50];
  const DEFAULT_DAILY_GOAL = 20;
  const LESSON_LENGTH_SECOND_PASS = 6;
  const TYPES = ['translate', 'listenChoose', 'listenType'];
  const REVIEW_SIZE = 12;
  const PRACTICE_SIZE = 10;
  const PRACTICE_KINDS = ['mistakes', 'falseFriends', 'pairs', 'sentences', 'matching'];
  const SENTENCE_COUNT = 8;
  const SENTENCE_MIN_TOKENS = 3;
  const MATCHING_ROUNDS = 3;
  const MATCHING_SIZE = 5;
  const XP_PER_CLEAN_PAIR = 5;
  const DAY_MS = 24 * 60 * 60 * 1000;
  // Za kolik dní se slovo vrátí podle krabičky (1 = právě chybovalo, hned k opakování).
  const REVIEW_INTERVAL_DAYS = { 1: 0, 2: 1, 3: 3, 4: 7, 5: 14 };

  const CONTRACTIONS = {
    "i'm": 'i am', "you're": 'you are', "he's": 'he is', "she's": 'she is', "it's": 'it is',
    "we're": 'we are', "they're": 'they are', "isn't": 'is not', "aren't": 'are not',
    "don't": 'do not', "doesn't": 'does not', "can't": 'cannot', "i'll": 'i will',
  };

  // ---------- náhoda ----------

  function shuffle(items, rng = Math.random) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  // ---------- kontrola odpovědí ----------

  function normalize(text) {
    let t = String(text)
      .toLowerCase()
      .replace(/[’‘`´]/g, "'")
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9' ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    t = t.split(' ').map((w) => CONTRACTIONS[w] || w).join(' ');
    return t.replace(/'/g, '');
  }

  function levenshtein(a, b) {
    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let diag = prev[0];
      prev[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const tmp = prev[j];
        prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
        diag = tmp;
      }
    }
    return prev[b.length];
  }

  // 'correct' = přesně, 'typo' = překlep (uznáno), 'wrong' = špatně.
  // Překlep tolerujeme jen u delších slov, aby třeba three/tree nebo right/night prošlo jako chyba.
  function checkTyped(answer, expected) {
    const a = normalize(answer);
    const e = normalize(expected);
    if (!a) return 'wrong';
    if (a === e) return 'correct';
    if (e.length >= 6 && levenshtein(a, e) === 1) return 'typo';
    return 'wrong';
  }

  // ---------- sestavení lekce ----------

  function pickDistractors(word, pool, count, rng = Math.random) {
    const candidates = pool.filter((w) => w.id !== word.id && w.cs !== word.cs);
    return shuffle(candidates, rng).slice(0, count);
  }

  function makeExercise(type, word, pool, rng) {
    const distractors = pickDistractors(word, pool, 3, rng);
    const exercise = { type, wordId: word.id, retry: false };
    if (type === 'listenType') return exercise;
    exercise.options = shuffle([word, ...distractors], rng).map((w) => ({ id: w.id, text: w.cs }));
    return exercise;
  }

  // Každé slovo dostane jedno cvičení (typy se střídají), pak ještě několik slov s jiným typem.
  function buildLesson(lesson, rng = Math.random) {
    const words = shuffle(lesson.words, rng);
    const exercises = words.map((w, i) => makeExercise(TYPES[i % TYPES.length], w, lesson.words, rng));
    words.slice(0, LESSON_LENGTH_SECOND_PASS).forEach((w, i) => {
      exercises.push(makeExercise(TYPES[(i + 1) % TYPES.length], w, lesson.words, rng));
    });
    return exercises;
  }

  // Špatně zodpovězené cvičení se zařadí na konec ještě jednou (opakovaný pokus se už znovu nezařazuje).
  function requeue(queue, exercise) {
    if (exercise.retry) return queue;
    return queue.concat([Object.assign({}, exercise, { retry: true })]);
  }

  // ---------- procvičování (chyby Čechů, falešní přátelé, minimální páry) ----------

  // Společný tvar cvičení: options[{text, correct}], explanation (po odpovědi), audioNow (před odpovědí), audioAfter.
  function practiceExercise(kind, item, allItems, rng) {
    const base = { type: 'practice', kind, itemId: item.id, retry: false };
    if (kind === 'mistakes') {
      return Object.assign(base, {
        prompt: 'Která věta je správně?',
        options: shuffle([{ text: item.right, correct: true }, { text: item.wrong, correct: false }], rng),
        explanation: item.explanation,
        audioAfter: item.id,
        speakAfter: item.right,
      });
    }
    if (kind === 'falseFriends') {
      const others = shuffle(allItems.filter((o) => o.id !== item.id), rng).map((o) => o.means);
      const texts = [item.means, item.notMeans];
      others.forEach((t) => { if (texts.length < 4 && !texts.includes(t)) texts.push(t); });
      return Object.assign(base, {
        prompt: 'Co znamená toto slovo?',
        big: item.en,
        audioNow: item.id,
        speakNow: item.en,
        options: shuffle(texts.map((t) => ({ text: t, correct: t === item.means })), rng),
        explanation: `${item.en} = ${item.means} (ne ${item.notMeans})`,
        afterText: `${item.sentenceEn} – ${item.sentenceCs}`,
        audioAfter: item.id + '-s',
        speakAfter: item.sentenceEn,
      });
    }
    const heard = rng() < 0.5 ? item.a : item.b;
    return Object.assign(base, {
      prompt: 'Které slovo slyšíš?',
      audioNow: heard.id,
      speakNow: heard.en,
      options: shuffle([item.a, item.b].map((w) => ({ text: w.en, correct: w === heard })), rng),
      explanation: `${item.a.en} = ${item.a.cs}, ${item.b.en} = ${item.b.cs}` + (item.note ? ` (${item.note})` : ''),
    });
  }

  function buildPractice(kind, items, rng = Math.random, size = PRACTICE_SIZE) {
    return shuffle(items, rng).slice(0, size).map((item) => practiceExercise(kind, item, items, rng));
  }

  // ---------- skládání vět a přiřazování dvojic ----------

  function tokenize(sentence) {
    return sentence.split(' ').filter(Boolean);
  }

  // Věty z lekcí rozsekané na slova; pořadí karet se vždy zamíchá jinak než ve správné větě.
  function buildSentences(allWords, rng = Math.random, size = SENTENCE_COUNT) {
    const usable = allWords.filter((w) => tokenize(w.sentenceEn).length >= SENTENCE_MIN_TOKENS);
    return shuffle(usable, rng).slice(0, size).map((w) => {
      const tokens = tokenize(w.sentenceEn);
      let tiles = shuffle(tokens, rng);
      for (let attempt = 0; attempt < 10 && tiles.join(' ') === tokens.join(' '); attempt++) tiles = shuffle(tokens, rng);
      return {
        type: 'sentence', kind: 'sentences', itemId: w.id, retry: false,
        cs: w.sentenceCs, tokens: tiles, answer: w.sentenceEn,
        audioAfter: w.id + '-s', speakAfter: w.sentenceEn,
      };
    });
  }

  function checkSentence(chosen, answer) {
    return normalize(chosen.join(' ')) === normalize(answer);
  }

  // Kola přiřazování: v každém kole několik různých slov s různými překlady.
  function buildMatching(allWords, rng = Math.random, rounds = MATCHING_ROUNDS, size = MATCHING_SIZE) {
    const usedCs = new Set();
    const picked = [];
    for (const w of shuffle(allWords, rng)) {
      if (picked.length === rounds * size) break;
      if (usedCs.has(w.cs)) continue;
      usedCs.add(w.cs);
      picked.push({ id: w.id, en: w.en, cs: w.cs });
    }
    const result = [];
    for (let i = 0; i + size <= picked.length; i += size) result.push({ pairs: picked.slice(i, i + size) });
    return result;
  }

  function completePractice(progress, kind, accuracy, now = new Date()) {
    const previous = progress.practice[kind];
    progress.practice[kind] = {
      best: Math.max(previous ? previous.best : 0, accuracy),
      plays: (previous ? previous.plays : 0) + 1,
      completedAt: now.getTime(),
    };
    updateStreak(progress, now);
    return progress;
  }

  // ---------- postup ----------

  function defaultProgress() {
    return {
      version: 1, xp: 0, streak: { count: 0, lastDay: '' }, lessons: {}, words: {}, practice: {},
      daily: { day: '', xp: 0 }, settings: { dailyGoal: DEFAULT_DAILY_GOAL },
    };
  }

  function dayKey(date) {
    const p = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
  }

  function updateStreak(progress, now = new Date()) {
    const today = dayKey(now);
    const last = progress.streak.lastDay;
    if (last === today) return progress;
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    progress.streak.count = last === dayKey(yesterday) ? progress.streak.count + 1 : 1;
    progress.streak.lastDay = today;
    return progress;
  }

  // Leitnerovy krabičky: správně = o krabičku výš, špatně = zpět do první.
  function recordAnswer(progress, wordId, correct, now = new Date()) {
    const w = progress.words[wordId] || { box: 1, correct: 0, wrong: 0, last: 0 };
    if (correct) {
      w.correct += 1;
      w.box = Math.min(w.box + 1, MAX_BOX);
    } else {
      w.wrong += 1;
      w.box = 1;
    }
    w.last = now.getTime();
    progress.words[wordId] = w;
    return progress;
  }

  // Body se počítají celkem i za dnešní den (denní cíl); o půlnoci se denní počítadlo samo vynuluje.
  function addXp(progress, amount, now = new Date()) {
    progress.xp += amount;
    const today = dayKey(now);
    if (progress.daily.day !== today) progress.daily = { day: today, xp: 0 };
    progress.daily.xp += amount;
    return progress;
  }

  function dailyStatus(progress, now = new Date()) {
    const xp = progress.daily.day === dayKey(now) ? progress.daily.xp : 0;
    const goal = progress.settings.dailyGoal;
    return { xp, goal, done: xp >= goal, ratio: Math.min(1, xp / goal) };
  }

  function setDailyGoal(progress, goal) {
    if (DAILY_GOALS.includes(goal)) progress.settings.dailyGoal = goal;
    return progress;
  }

  function completeLesson(progress, lessonId, accuracy, now = new Date()) {
    const previous = progress.lessons[lessonId];
    const firstTime = !previous || !previous.done;
    progress.lessons[lessonId] = {
      done: true,
      best: Math.max(previous ? previous.best : 0, accuracy),
      completedAt: now.getTime(),
    };
    addXp(progress, firstTime ? XP_LESSON_BONUS : 0, now);
    updateStreak(progress, now);
    return progress;
  }

  // ---------- opakování a statistiky ----------

  function isDue(stat, now = new Date()) {
    return stat.last + REVIEW_INTERVAL_DAYS[stat.box] * DAY_MS <= now.getTime();
  }

  // Slova k opakování (jen ta, která už uživatel viděl), nejdéle zpožděná první.
  function dueWords(progress, allWords, now = new Date()) {
    return allWords
      .filter((w) => progress.words[w.id] && isDue(progress.words[w.id], now))
      .map((w) => ({ word: w, overdue: now.getTime() - progress.words[w.id].last - REVIEW_INTERVAL_DAYS[progress.words[w.id].box] * DAY_MS }))
      .sort((a, b) => b.overdue - a.overdue)
      .map((x) => x.word);
  }

  // Opakování: pro každé slovo jedno cvičení, typy se střídají, špatné možnosti z celé slovní zásoby.
  function buildReview(due, allWords, rng = Math.random, size = REVIEW_SIZE) {
    return shuffle(due.slice(0, size), rng).map((w, i) => makeExercise(TYPES[i % TYPES.length], w, allWords, rng));
  }

  function stats(progress, allWords) {
    const seen = allWords.filter((w) => progress.words[w.id]);
    const known = seen.filter((w) => progress.words[w.id].box >= 3).length;
    let correct = 0;
    let wrong = 0;
    seen.forEach((w) => {
      correct += progress.words[w.id].correct;
      wrong += progress.words[w.id].wrong;
    });
    const weak = seen
      .filter((w) => progress.words[w.id].wrong > 0)
      .map((w) => ({ word: w, ...progress.words[w.id] }))
      .sort((a, b) => b.wrong / (b.correct + b.wrong) - a.wrong / (a.correct + a.wrong) || b.wrong - a.wrong)
      .slice(0, 5);
    return {
      total: allWords.length,
      seen: seen.length,
      known,
      learning: seen.length - known,
      accuracy: correct + wrong ? correct / (correct + wrong) : null,
      weak,
    };
  }

  // Smaže veškerý postup (body, sérii, lekce, statistiky); zachová jen nastavený denní cíl.
  function resetProgress(progress) {
    const fresh = defaultProgress();
    fresh.settings.dailyGoal = progress.settings.dailyGoal;
    return fresh;
  }

  function isLessonUnlocked(progress, lessons, index) {
    if (index === 0) return true;
    const previous = progress.lessons[lessons[index - 1].id];
    return Boolean(previous && previous.done);
  }

  function knownWords(progress) {
    return Object.values(progress.words).filter((w) => w.box >= 3).length;
  }

  // ---------- ukládání a záloha ----------

  const num = (v, min, max) => (typeof v === 'number' && isFinite(v) ? Math.min(max, Math.max(min, v)) : null);
  const isDay = (v) => typeof v === 'string' && (v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v));
  const isId = (v) => typeof v === 'string' && /^[a-z0-9-]{1,64}$/.test(v);

  // Přijme libovolný objekt (např. načtený ze souboru) a vrátí čistý postup, nebo null, když je neplatný.
  function sanitizeProgress(raw) {
    if (!raw || typeof raw !== 'object' || raw.version !== 1) return null;
    const xp = num(raw.xp, 0, 1e9);
    const streak = raw.streak && typeof raw.streak === 'object' ? raw.streak : null;
    const count = streak ? num(streak.count, 0, 1e5) : null;
    if (xp === null || count === null || !isDay(streak.lastDay)) return null;
    const clean = defaultProgress();
    clean.xp = Math.floor(xp);
    clean.streak = { count: Math.floor(count), lastDay: streak.lastDay };
    for (const [id, l] of Object.entries(raw.lessons && typeof raw.lessons === 'object' ? raw.lessons : {})) {
      if (!isId(id) || !l || typeof l !== 'object') continue;
      clean.lessons[id] = {
        done: l.done === true,
        best: num(l.best, 0, 1) ?? 0,
        completedAt: num(l.completedAt, 0, 1e15) ?? 0,
      };
    }
    for (const [id, w] of Object.entries(raw.words && typeof raw.words === 'object' ? raw.words : {})) {
      if (!isId(id) || !w || typeof w !== 'object') continue;
      clean.words[id] = {
        box: Math.floor(num(w.box, 1, MAX_BOX) ?? 1),
        correct: Math.floor(num(w.correct, 0, 1e6) ?? 0),
        wrong: Math.floor(num(w.wrong, 0, 1e6) ?? 0),
        last: num(w.last, 0, 1e15) ?? 0,
      };
    }
    const daily = raw.daily && typeof raw.daily === 'object' ? raw.daily : null;
    if (daily && isDay(daily.day)) clean.daily = { day: daily.day, xp: Math.floor(num(daily.xp, 0, 1e6) ?? 0) };
    const goal = raw.settings && typeof raw.settings === 'object' ? raw.settings.dailyGoal : null;
    if (DAILY_GOALS.includes(goal)) clean.settings.dailyGoal = goal;
    for (const kind of PRACTICE_KINDS) {
      const pr = raw.practice && typeof raw.practice === 'object' ? raw.practice[kind] : null;
      if (!pr || typeof pr !== 'object') continue;
      clean.practice[kind] = {
        best: num(pr.best, 0, 1) ?? 0,
        plays: Math.floor(num(pr.plays, 0, 1e6) ?? 0),
        completedAt: num(pr.completedAt, 0, 1e15) ?? 0,
      };
    }
    return clean;
  }

  function exportProgress(progress) {
    return JSON.stringify({ app: 'anglictina', exportedAt: new Date().toISOString(), progress }, null, 2);
  }

  function importProgress(text) {
    try {
      const data = JSON.parse(text);
      return data && data.app === 'anglictina' ? sanitizeProgress(data.progress) : null;
    } catch (e) {
      return null;
    }
  }

  function loadProgress(storage) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw) return sanitizeProgress(JSON.parse(raw)) || defaultProgress();
    } catch (e) { /* poškozená nebo nedostupná data – začneme znovu */ }
    return defaultProgress();
  }

  function saveProgress(storage, progress) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(progress));
      return true;
    } catch (e) {
      return false;
    }
  }

  const Engine = {
    STORAGE_KEY, XP_PER_CORRECT, XP_LESSON_BONUS, DAILY_GOALS, dailyStatus, setDailyGoal, resetProgress,
    shuffle, normalize, levenshtein, checkTyped,
    pickDistractors, buildLesson, requeue,
    defaultProgress, dayKey, updateStreak, recordAnswer, addXp, completeLesson,
    PRACTICE_KINDS, XP_PER_CLEAN_PAIR, buildPractice, completePractice,
    tokenize, buildSentences, checkSentence, buildMatching,
    isLessonUnlocked, knownWords, isDue, dueWords, buildReview, stats,
    sanitizeProgress, exportProgress, importProgress, loadProgress, saveProgress,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
  else root.Engine = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
