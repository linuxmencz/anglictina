// Rozložení klikaté mapy cesty lekcemi (čisté funkce bez DOM) – testuje se v Node, v prohlížeči běží jako window.PathMap.
(function (root) {
  const DEFAULTS = { width: 320, rowHeight: 100, amplitude: 80, top: 50 };
  const TURN = 0.4; // délka úchytu Bézierovy křivky; menší = ostřejší zatáčka
  const BOTTOM = 90; // místo pod posledním bodem pro jeho popisek

  const round2 = (n) => Math.round(n * 100) / 100; // bez float šumu z Math.sin

  const opts = (o) => Object.assign({}, DEFAULTS, o || {});

  // Souřadnice bodů: začátek uprostřed, pak střídavě vpravo a vlevo (jako oblouky lyžaře na svahu)
  function layout(count, options) {
    if (!(count > 0)) return [];
    const { width, rowHeight, amplitude, top } = opts(options);
    const points = [];
    for (let i = 0; i < count; i++) {
      points.push({
        x: round2(width / 2 + (i === 0 ? 0 : (i % 2 ? 1 : -1) * amplitude)),
        y: round2(top + i * rowHeight),
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
    const { rowHeight, top } = opts(options);
    return top + (count - 1) * rowHeight + BOTTOM;
  }

  const PathMap = { layout, curve, height };

  if (typeof module !== 'undefined' && module.exports) module.exports = PathMap;
  else root.PathMap = PathMap;
})(typeof window !== 'undefined' ? window : globalThis);
