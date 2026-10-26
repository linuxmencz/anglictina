// Rozložení klikaté mapy cesty lekcemi (čisté funkce bez DOM) – testuje se v Node, v prohlížeči běží jako window.PathMap.
(function (root) {
  const DEFAULTS = { width: 320, rowHeight: 100, amplitude: 80, top: 50, sectionGap: 90, sectionStarts: [] };
  // Úrovně cesty: start/end = rozsah indexů lekcí (end výlučně); start úseku je relativní k začátku úrovně.
  const LEVELS = [
    {
      id: 'A1', title: 'A1', start: 0, end: 26,
      sections: [
        { title: 'Základy', start: 0 },
        { title: 'Každý den', start: 5 },
        { title: 'Člověk a svět', start: 10 },
        { title: 'Do života', start: 15 },
        { title: 'Dál a výš', start: 20 },
      ],
    },
    {
      id: 'A2', title: 'A2', start: 26, end: 40,
      sections: [
        { title: 'Každodenní život', start: 0 },
        { title: 'Lidé a svět', start: 5 },
        { title: 'Plány a zážitky', start: 10 },
      ],
    },
    {
      id: 'B1', title: 'B1', start: 40, end: 70,
      sections: [
        { title: 'Praktický svět', start: 0 },
        { title: 'Lidé a názory', start: 5 },
        { title: 'Společnost a svět', start: 10 },
        { title: 'Pravidla a poznání', start: 15 },
        { title: 'Domov a cesty', start: 20 },
        { title: 'Cíl na dohled', start: 25 },
      ],
    },
  ];
  // Úseky úrovně A1 (zpětná kompatibilita)
  const SECTIONS = LEVELS[0].sections;
  const TURN = 0.4; // délka úchytu Bézierovy křivky; menší = ostřejší zatáčka
  const BOTTOM = 90; // místo pod posledním bodem pro jeho popisek

  const round2 = (n) => Math.round(n * 100) / 100; // bez float šumu z Math.sin

  const opts = (o) => Object.assign({}, DEFAULTS, o || {});

  // Platné začátky úseků (v rozsahu lekcí, bez duplicit, vzestupně).
  const validStarts = (starts, count) => [...new Set(starts)].filter((s) => s >= 0 && s < count).sort((a, b) => a - b);

  // Souřadnice bodů: začátek uprostřed, pak střídavě vpravo a vlevo (jako oblouky lyžaře na svahu)
  function layout(count, options) {
    if (!(count > 0)) return [];
    const { width, rowHeight, amplitude, top, sectionGap, sectionStarts } = opts(options);
    const starts = validStarts(sectionStarts, count);
    const points = [];
    for (let i = 0; i < count; i++) {
      const gaps = starts.filter((s) => s <= i).length; // mezery pro pruhy úseků nad touto lekcí
      points.push({
        x: round2(width / 2 + (i === 0 ? 0 : (i % 2 ? 1 : -1) * amplitude)),
        y: round2(top + i * rowHeight + gaps * sectionGap),
      });
    }
    return points;
  }

  // Data SVG křivky procházející všemi body (kubické segmenty se svislými tečnami).
  // Krátké úchyty (TURN × výška řádku) dělají obrat těsný a mezi body strmou plynulou diagonálu.
  function curve(points) {
    if (!points.length) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const p = points[i - 1];
      const q = points[i];
      const h = round2((q.y - p.y) * TURN);
      d += ` C ${p.x} ${p.y + h}, ${q.x} ${q.y - h}, ${q.x} ${q.y}`;
    }
    return d;
  }

  // Výška plochy cesty včetně místa pro popisek posledního bodu.
  function height(count, options) {
    if (!(count > 0)) return 0;
    const { rowHeight, top, sectionGap, sectionStarts } = opts(options);
    return top + (count - 1) * rowHeight + validStarts(sectionStarts, count).length * sectionGap + BOTTOM;
  }

  // Svislý střed pruhu úseku: uprostřed mezery nad první lekcí úseku (points z layout se stejnými options).
  function bannerY(points, index, options) {
    const { rowHeight, sectionGap } = opts(options);
    return round2(points[index].y - (rowHeight + sectionGap) / 2);
  }

  // Úrovně načtené při daném počtu lekcí (jen ty, které už začaly; end oříznut na count).
  function visibleLevels(count) {
    return LEVELS.filter((l) => l.start < count).map((l) => Object.assign({}, l, { end: Math.min(l.end, count) }));
  }

  // Id úrovně, do které patří lekce s daným indexem.
  function levelIdFor(index) {
    const l = LEVELS.find((x) => index >= x.start && index < x.end);
    return l ? l.id : undefined;
  }

  const PathMap = { layout, curve, height, bannerY, SECTIONS, LEVELS, visibleLevels, levelIdFor };

  if (typeof module !== 'undefined' && module.exports) module.exports = PathMap;
  else root.PathMap = PathMap;
})(typeof window !== 'undefined' ? window : globalThis);
