// Odznaky za milníky (čistá logika bez DOM) – testuje se v Node, v prohlížeči běží jako window.Badges.
(function (root) {
  const doneLessons = (progress) => Object.values(progress.lessons || {}).filter((l) => l && l.done === true).length;
  const streakCount = (progress) => (progress.streak && progress.streak.count) || 0;
  const challengeCount = (progress) => {
    const c = progress && progress.challenges;
    return c !== null && typeof c === 'object' && !Array.isArray(c) ? Object.keys(c).length : 0;
  };
  // Všechny lekce úrovně (id z ctx.levels) jsou hotové; úroveň, kterou ctx neobsahuje, se nepočítá.
  // level.end je PLNÝ (neoříznutý) konec úrovně: dokud v datech nejsou všechny její lekce
  // (lessonIds.length < end), úroveň není kompletní a odznak se neuděluje (např. B1 při 55 z 70 lekcí).
  const levelDone = (progress, ctx, levelId) => {
    const level = (ctx.levels || []).find((l) => l.id === levelId);
    if (!level || !Array.isArray(ctx.lessonIds) || ctx.lessonIds.length < level.end) return false;
    const ids = ctx.lessonIds.slice(level.start, level.end);
    return ids.length > 0 && ids.every((id) => progress.lessons && progress.lessons[id] && progress.lessons[id].done === true);
  };
  const plays = (progress, kind) => (progress.practice && progress.practice[kind] && progress.practice[kind].plays) || 0;

  // Každý odznak má podmínku test(progress, ctx); ctx = { knownWords, lessonsTotal, dialogsTotal, lessonIds, levels }.
  const CATALOG = [
    { id: 'lesson-1', icon: '🌱', title: 'První krok', hint: 'Dokonči první lekci.', area: 'lekce', test: (p) => doneLessons(p) >= 1 },
    { id: 'lesson-5', icon: '🚀', title: 'Rozjezd', hint: 'Dokonči 5 lekcí.', area: 'lekce', test: (p) => doneLessons(p) >= 5 },
    {
      id: 'lesson-half', icon: '🧭', title: 'Půlka cesty', hint: 'Dokonči polovinu lekcí.', area: 'lekce',
      test: (p, ctx) => ctx.lessonsTotal > 0 && doneLessons(p) >= Math.ceil(ctx.lessonsTotal / 2),
    },
    {
      id: 'lesson-all', icon: '🎓', title: 'Absolvent', hint: 'Dokonči všechny lekce všech úrovní.', area: 'lekce',
      test: (p, ctx) => ctx.lessonsTotal > 0 && doneLessons(p) >= ctx.lessonsTotal,
    },
    { id: 'level-a1', icon: '🥉', title: 'A1 hotovo', hint: 'Dokonči všechny lekce úrovně A1.', area: 'lekce', test: (p, ctx) => levelDone(p, ctx, 'A1') },
    { id: 'level-a2', icon: '🥈', title: 'A2 hotovo', hint: 'Dokonči všechny lekce úrovně A2.', area: 'lekce', test: (p, ctx) => levelDone(p, ctx, 'A2') },
    { id: 'level-b1', icon: '🥇', title: 'B1 hotovo', hint: 'Dokonči všechny lekce úrovně B1.', area: 'lekce', test: (p, ctx) => levelDone(p, ctx, 'B1') },
    {
      id: 'perfect', icon: '🎯', title: 'Bez chyby', hint: 'Dokonči lekci na 100 %.', area: 'přesnost',
      test: (p) => Object.values(p.lessons || {}).some((l) => l && l.done === true && l.best >= 1),
    },
    { id: 'streak-3', icon: '🔥', title: 'Tři dny v řadě', hint: 'Uč se 3 dny za sebou.', area: 'série', test: (p) => streakCount(p) >= 3 },
    { id: 'streak-7', icon: '⚡', title: 'Týden v řadě', hint: 'Uč se 7 dní za sebou.', area: 'série', test: (p) => streakCount(p) >= 7 },
    { id: 'streak-30', icon: '🏆', title: 'Měsíc v řadě', hint: 'Uč se 30 dní za sebou.', area: 'série', test: (p) => streakCount(p) >= 30 },
    { id: 'words-50', icon: '📘', title: '50 slov', hint: 'Nauč se 50 slov.', area: 'slovíčka', test: (p, ctx) => ctx.knownWords >= 50 },
    { id: 'words-150', icon: '📗', title: '150 slov', hint: 'Nauč se 150 slov.', area: 'slovíčka', test: (p, ctx) => ctx.knownWords >= 150 },
    { id: 'words-300', icon: '📚', title: '300 slov', hint: 'Nauč se 300 slov.', area: 'slovíčka', test: (p, ctx) => ctx.knownWords >= 300 },
    { id: 'xp-1000', icon: '⭐', title: '1000 bodů', hint: 'Získej 1000 bodů.', area: 'body', test: (p) => (p.xp || 0) >= 1000 },
    { id: 'dialog-1', icon: '💬', title: 'První dialog', hint: 'Dokonči první dialog.', area: 'dialogy', test: (p) => Object.keys(p.dialogs || {}).length >= 1 },
    {
      id: 'dialog-all', icon: '🗣️', title: 'Všechny dialogy', hint: 'Dokonči všechny dialogy.', area: 'dialogy',
      test: (p, ctx) => ctx.dialogsTotal > 0 && Object.keys(p.dialogs || {}).length >= ctx.dialogsTotal,
    },
    { id: 'grammar-tenses', icon: '⏳', title: 'Čas pod kontrolou', hint: 'Dokonči kvíz Present Perfect.', area: 'gramatika', test: (p) => plays(p, 'tenses') >= 1 },
    { id: 'grammar-prepositions', icon: '📍', title: 'Správná předložka', hint: 'Dokonči kvíz předložek místa.', area: 'gramatika', test: (p) => plays(p, 'prepositions') >= 1 },
    { id: 'challenge-1', icon: '🎯', title: 'Týdenní výzva', hint: 'Splň týdenní výzvu.', area: 'výzvy', test: (p) => challengeCount(p) >= 1 },
    { id: 'challenge-5', icon: '🏅', title: 'Pět výzev', hint: 'Splň 5 týdenních výzev.', area: 'výzvy', test: (p) => challengeCount(p) >= 5 },
    { id: 'challenge-10', icon: '🥇', title: 'Deset výzev', hint: 'Splň 10 týdenních výzev.', area: 'výzvy', test: (p) => challengeCount(p) >= 10 },
  ];

  function byId(id) {
    return CATALOG.find((b) => b.id === id);
  }

  // Udělí všechny odznaky, jejichž podmínka platí a které ještě nejsou v postupu; vrátí jen nově získané (v pořadí katalogu).
  function award(progress, ctx, now = new Date()) {
    if (!progress.badges || typeof progress.badges !== 'object') progress.badges = {};
    const gained = [];
    for (const badge of CATALOG) {
      if (progress.badges[badge.id] !== undefined) continue;
      if (!badge.test(progress, ctx)) continue;
      progress.badges[badge.id] = now.getTime();
      gained.push(badge);
    }
    return gained;
  }

  const Badges = { CATALOG, award, byId };

  if (typeof module !== 'undefined' && module.exports) module.exports = Badges;
  else root.Badges = Badges;
})(typeof window !== 'undefined' ? window : globalThis);
