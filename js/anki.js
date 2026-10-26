// Export slovíček do Anki (čistá logika bez DOM) – v Node přes module.exports, v prohlížeči jako window.Anki.
// Nesahá na postup ani localStorage; data dostává jako parametry.
(function (root) {
  const HEADER = ['#separator:tab', '#html:true', '#notetype:Basic'];

  // HTML escape obsahu pole (Anki má zapnuté #html:true).
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Pole s tabulátorem, odřádkováním nebo uvozovkou uzavřeme do uvozovek a vnitřní uvozovky zdvojíme.
  const field = (s) => (/[\t\n\r"]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);

  // Tagy oddělené mezerou: úroveň, id lekce, případně druh položky.
  const tagFor = (levelId, lessonId, word) => {
    const tags = [levelId, lessonId];
    if (word.kind === 'phrasal' || word.kind === 'collocation') tags.push(word.kind);
    return tags.join(' ');
  };

  // Lekce s úrovní, do které patří; end je výlučný a ořízne se na počet lekcí.
  const selectLessons = (lessons, levels, levelId) => {
    const chosen = levelId === 'all' ? levels : levels.filter((l) => l.id === levelId);
    if (!chosen.length) throw new Error('Neznámá úroveň: ' + levelId);
    return chosen.flatMap((lv) => lessons
      .slice(lv.start, Math.min(lv.end, lessons.length))
      .map((lesson) => ({ levelId: lv.id, lesson })));
  };

  const back = (w) => [esc(w.cs), w.pron ? '<i>' + esc(w.pron) + '</i>' : null, esc(w.sentenceEn), esc(w.sentenceCs)]
    .filter((p) => p !== null).join('<br>');

  const tsv = (lessons, levels, levelId) => {
    const items = selectLessons(lessons, levels, levelId);
    const deck = levelId === 'all' ? 'Angličtina' : 'Angličtina ' + levelId;
    const lines = HEADER.concat('#deck:' + deck, '#tags column:3');
    for (const { levelId: lv, lesson } of items) {
      for (const w of (lesson && lesson.words) || []) {
        lines.push([field(esc(w.en)), field(back(w)), field(tagFor(lv, lesson.id, w))].join('\t'));
      }
    }
    return lines.join('\n');
  };

  const fileName = (levelId) => 'anglictina-anki-' + (levelId === 'all' ? 'vse' : levelId) + '.txt';

  const api = { tsv, fileName };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Anki = api;
})(typeof window !== 'undefined' ? window : globalThis);
