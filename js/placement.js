// Test úrovně (čistá logika bez DOM) – testuje se v Node, v prohlížeči běží jako window.Placement.
(function (root) {
  const BATCH_SIZE = 4;
  const MAX_QUESTIONS = 12;
  const UP_AT = 3;
  const DOWN_AT = 1;

  const start = () => ({
    levelIdx: 1, asked: 0, batchAsked: 0, batchCorrect: 0, askedIds: [],
    current: null, placed: 0, mastered: false, done: false,
  });

  // Fisher–Yates se zadaným generátorem (moduly na sobě nezávisejí).
  const shuffle = (arr, rng) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // Slova úrovně bez značky kind; end je výlučný a ořízne se na počet lekcí.
  const levelWords = (level, lessons) => {
    const end = Math.min(level.end, lessons.length);
    return lessons.slice(level.start, end)
      .flatMap((l) => (l && l.words) || [])
      .filter((w) => !w.kind);
  };

  const next = (state, lessons, levels, rng = Math.random) => {
    if (state.done) return null;
    if (state.current) return state.current;
    state.top = levels.length - 1;
    const level = levels[state.levelIdx];
    const pool = level ? levelWords(level, lessons) : [];
    const candidates = pool.filter((w) => !state.askedIds.includes(w.id));
    if (!candidates.length) { state.done = true; return null; }
    const word = candidates[Math.floor(rng() * candidates.length)];
    // Distraktory: jiná slova úrovně s navzájem různým významem.
    const used = new Set([word.cs]);
    const distractors = [];
    for (const w of shuffle(pool, rng)) {
      if (distractors.length === 3) break;
      if (w.id === word.id || used.has(w.cs)) continue;
      used.add(w.cs);
      distractors.push(w);
    }
    if (distractors.length < 3) { state.done = true; return null; }
    const options = shuffle([word, ...distractors], rng).map((w) => ({ id: w.id, text: w.cs }));
    state.current = { wordId: word.id, options };
    state.askedIds.push(word.id);
    return state.current;
  };

  // Vyhodnocení dávky na aktuální úrovni.
  const evalBatch = (state) => {
    const top = state.top;
    const L = state.levelIdx;
    const c = state.batchCorrect;
    if (c >= UP_AT) {
      state.placed = Math.max(state.placed, Math.min(L + 1, top));
      if (L === top) { state.mastered = true; state.done = true; } else state.levelIdx = L + 1;
    } else if (c <= DOWN_AT) {
      if (L === 0) state.done = true; else state.levelIdx = L - 1;
    } else {
      state.placed = Math.max(state.placed, L);
    }
    state.batchAsked = 0;
    state.batchCorrect = 0;
  };

  // Nejvyšší index úrovně (top) si stav pamatuje z next(), aby answer měl signaturu (state, chosenId).
  const answer = (state, chosenId) => {
    if (!state.current) return false;
    const ok = chosenId !== null && chosenId !== undefined && chosenId === state.current.wordId;
    state.current = null;
    state.asked += 1;
    state.batchAsked += 1;
    if (ok) state.batchCorrect += 1;
    if (state.batchAsked >= BATCH_SIZE) evalBatch(state);
    if (state.asked >= MAX_QUESTIONS) state.done = true;
    return ok;
  };

  const result = (state, levels) => {
    const level = levels[state.placed];
    return { levelIdx: state.placed, levelId: level.id, lessonNumber: level.start + 1, mastered: state.mastered };
  };

  const api = { BATCH_SIZE, MAX_QUESTIONS, UP_AT, DOWN_AT, start, next, answer, result };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Placement = api;
})(typeof window !== 'undefined' ? window : globalThis);
