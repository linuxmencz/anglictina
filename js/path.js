// Rozložení klikaté mapy cesty lekcemi (čisté funkce bez DOM) – testuje se v Node, v prohlížeči běží jako window.PathMap.
(function (root) {
  const DEFAULTS = { width: 320, rowHeight: 100, amplitude: 80, top: 50, sectionGap: 90, sectionStarts: [] };
  // Úseky cesty: začátek = index první lekce úseku (úsek mimo počet lekcí se ignoruje).
  const SECTIONS = [
    { title: 'Základy', start: 0 },
    { title: 'Každý den', start: 5 },
    { title: 'Člověk a svět', start: 10 },
    { title: 'Do života', start: 15 },
    { title: 'Dál a výš', start: 20 },
  ];
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

  const PathMap = { layout, curve, height, bannerY, SECTIONS };

  if (typeof module !== 'undefined' && module.exports) module.exports = PathMap;
  else root.PathMap = PathMap;
})(typeof window !== 'undefined' ? window : globalThis);
