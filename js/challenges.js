// Týdenní výzva (čistá logika bez DOM) – testuje se v Node, v prohlížeči běží jako window.Challenges.
(function (root) {
  // Cíle výzev (jedna pojmenovaná konstanta pro každý typ).
  const GOAL_XP = 150;
  const GOAL_DAYS = 5;
  const GOAL_PARTS = 6;

  // Typy výzev se střídají podle indexu týdne v tomto pořadí.
  const TYPES = [
    { id: 'xp', title: 'Týdenní body', hint: 'Získej 150 bodů tento týden.', goal: GOAL_XP },
    { id: 'days', title: 'Aktivní dny', hint: 'Uč se alespoň 5 dní tento týden.', goal: GOAL_DAYS },
    { id: 'parts', title: 'Dokončené části', hint: 'Dokonči 6 různých lekcí, procvičování nebo dialogů tento týden.', goal: GOAL_PARTS },
  ];

  // Stejný formát jako dayKey v engine.js (místní čas, YYYY-MM-DD).
  function dayKey(date) {
    const p = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
  }

  // Pondělí 00:00 místního času týdne, do kterého datum patří (počítá se po kalendářních dnech).
  function weekStart(date) {
    const back = (date.getDay() + 6) % 7;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() - back);
  }

  // Index týdne z místních složek pondělí přes UTC, takže letní čas nic neposune.
  function weekIndex(date) {
    const m = weekStart(date);
    return Math.floor(Date.UTC(m.getFullYear(), m.getMonth(), m.getDate()) / 86400000 / 7);
  }

  // ISO 8601: týden patří do roku svého čtvrtka.
  function weekKey(date) {
    const m = weekStart(date);
    const thu = Date.UTC(m.getFullYear(), m.getMonth(), m.getDate() + 3);
    const year = new Date(thu).getUTCFullYear();
    const dayOfYear = (thu - Date.UTC(year, 0, 1)) / 86400000;
    const week = Math.floor(dayOfYear / 7) + 1;
    return `${year}-W${String(week).padStart(2, '0')}`;
  }

  const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

  function countParts(progress, start) {
    const from = start.getTime();
    // Konec týdne = další pondělí podle kalendáře (ne +7×24 h).
    const to = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7).getTime();
    let count = 0;
    // Dialog zapisuje i practice.dialogs, ale počítá se jen přes progress.dialogs[id] (jinak by se započítal dvakrát).
    const practice = Object.fromEntries(Object.entries(progress.practice || {}).filter(([kind]) => kind !== 'dialogs'));
    for (const group of [progress.lessons, practice, progress.dialogs]) {
      for (const item of Object.values(group || {})) {
        const t = item && item.completedAt;
        if (typeof t === 'number' && Number.isFinite(t) && t >= from && t < to) count++;
      }
    }
    return count;
  }

  function current(progress, now = new Date()) {
    const start = weekStart(now);
    const key = weekKey(now);
    const type = TYPES[weekIndex(now) % TYPES.length];
    const history = progress.history || {};
    let raw = 0;
    if (type.id === 'parts') {
      raw = countParts(progress, start);
    } else {
      for (let i = 0; i < 7; i++) {
        const v = history[dayKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))];
        const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
        if (type.id === 'xp') raw += n;
        else if (n > 0) raw += 1;
      }
    }
    const stored = isPlainObject(progress.challenges) && progress.challenges[key] !== undefined;
    // Splněný týden (uložený nebo právě dosažený) ukazuje vždy cíl / cíl, i když se data později zhoršila.
    const done = raw >= type.goal || stored;
    const value = done ? type.goal : raw;
    return {
      key, type: type.id, title: type.title, hint: type.hint, goal: type.goal, value,
      done,
      daysLeft: 7 - ((now.getDay() + 6) % 7),
    };
  }

  // Zapíše splnění týdne (jednou); vrátí true jen při prvním zápisu.
  function complete(progress, now = new Date()) {
    if (!isPlainObject(progress.challenges)) progress.challenges = {};
    const c = current(progress, now);
    if (!c.done || progress.challenges[c.key] !== undefined) return false;
    progress.challenges[c.key] = now.getTime();
    return true;
  }

  const Challenges = { TYPES, weekStart, weekKey, weekIndex, current, complete };

  if (typeof module !== 'undefined' && module.exports) module.exports = Challenges;
  else root.Challenges = Challenges;
})(typeof window !== 'undefined' ? window : globalThis);
