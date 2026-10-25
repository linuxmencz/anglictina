// Vykreslení prostorových schémat (předložky místa a času) jako SVG – testuje se v Node, v prohlížeči běží jako window.Spatial.
// Veškerý text se vkládá přes textContent, nikdy jako HTML.
(function (root) {
  const NS = 'http://www.w3.org/2000/svg';
  const WIDTH = 600; // šířka viewBoxu
  const R = 14; // poloměr postavy
  const round2 = (n) => Math.round(n * 100) / 100;

  function el(doc, name, attrs = {}, text) {
    const node = doc.createElementNS(NS, name);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, String(v)));
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // Předmět: svislý kolík (bod), deska na podstavci (plocha), obrys prostoru, nebo časové předměty (hodiny, list dne, období).
  // Vrací { g, box } – box = {x, y, width, height} pro umístění postav.
  function drawLandmark(doc, item, cx, ground, colW, mini) {
    const g = el(doc, 'g', { 'data-element': item.id, class: 'sp-' + item.type });
    let box;
    if (item.type === 'bod') {
      box = { x: cx - 4, y: ground - 56, width: 8, height: 56 };
      g.append(el(doc, 'rect', { x: box.x, y: box.y, width: box.width, height: box.height, rx: 3, class: 'sp-peg' }));
    } else if (item.type === 'plocha') {
      const w = Math.min(colW - 16, 130);
      box = { x: cx - w / 2, y: ground - 52, width: w, height: 12 };
      g.append(
        el(doc, 'rect', { x: box.x, y: box.y, width: w, height: 12, rx: 3, class: 'sp-slab' }),
        el(doc, 'line', { x1: box.x + 12, y1: box.y + 12, x2: box.x + 12, y2: ground, class: 'sp-leg' }),
        el(doc, 'line', { x1: box.x + w - 12, y1: box.y + 12, x2: box.x + w - 12, y2: ground, class: 'sp-leg' }),
      );
    } else if (item.type === 'hodiny') {
      // Ciferník na stojanu; box je stojan (jako kolík), postava stojí vedle něj. Hodinová ručička ukazuje item.hour (výchozí pět).
      box = { x: cx - 4, y: ground - 56, width: 8, height: 56 };
      const r = mini ? 22 : 30; // v mini režimu menší, aby se ciferník vešel nad stojan
      const cy = box.y - r;
      const hour = (((item.hour || 5) % 12) * 30 * Math.PI) / 180; // výchozí pět hodin
      g.append(
        el(doc, 'rect', { x: box.x, y: box.y, width: box.width, height: box.height, rx: 3, class: 'sp-peg' }),
        el(doc, 'circle', { cx, cy, r, class: 'sp-clock' }),
        el(doc, 'line', { x1: cx, y1: cy, x2: cx, y2: round2(cy - 0.8 * r), class: 'sp-hand' }),
        el(doc, 'line', { x1: cx, y1: cy, x2: round2(cx + 0.53 * r * Math.sin(hour)), y2: round2(cy - 0.53 * r * Math.cos(hour)), class: 'sp-hand' }),
      );
    } else if (item.type === 'den') {
      // List kalendáře s hlavičkou; postava sedí na jeho horní hraně.
      const w = Math.min(colW - 16, 110);
      box = { x: cx - w / 2, y: ground - 80, width: w, height: 68 };
      g.append(
        el(doc, 'rect', { x: box.x, y: box.y, width: w, height: 68, rx: 6, class: 'sp-page' }),
        el(doc, 'rect', { x: box.x, y: box.y, width: w, height: 18, rx: 6, class: 'sp-pagehead' }),
        el(doc, 'line', { x1: box.x + 14, y1: box.y + 38, x2: box.x + w - 14, y2: box.y + 38, class: 'sp-leg' }),
        el(doc, 'line', { x1: box.x + 14, y1: box.y + 52, x2: box.x + w - 34, y2: box.y + 52, class: 'sp-leg' }),
      );
    } else if (item.type === 'obdobi') {
      // Rámeček s pruhem nahoře (úsek na ose); událost je uvnitř.
      const w = Math.min(colW - 16, 170);
      box = { x: cx - w / 2, y: ground - 100, width: w, height: 100 };
      g.append(
        el(doc, 'rect', { x: box.x, y: box.y, width: w, height: 100, rx: 14, class: 'sp-period' }),
        el(doc, 'rect', { x: box.x + 10, y: box.y + 10, width: w - 20, height: 10, rx: 5, class: 'sp-band' }),
      );
    } else {
      const w = Math.min(colW - 16, 170);
      box = { x: cx - w / 2, y: ground - 100, width: w, height: 100 };
      g.append(el(doc, 'rect', { x: box.x, y: box.y, width: w, height: 100, rx: 14, class: 'sp-room' }));
    }
    g.setAttribute('data-x', box.x);
    g.setAttribute('data-y', box.y);
    g.setAttribute('data-width', box.width);
    g.setAttribute('data-height', box.height);
    if (!mini) g.append(el(doc, 'text', { x: cx, y: ground + 26, 'text-anchor': 'middle', class: 'sp-label' }, item.label));
    return { g, box };
  }

  // k = pořadí postavy u stejného předmětu (další se odsazují, aby se nepřekrývaly).
  function drawFigure(doc, item, box, ground, k, mini) {
    const kind = item.relation.kind;
    const mid = box.x + box.width / 2;
    const side = k % 2 === 0 ? 1 : -1;
    let cx;
    let cy;
    if (kind === 'in') {
      cx = mid + side * Math.ceil(k / 2) * 2.4 * R * (k === 0 ? 0 : 1);
      cy = box.y + box.height / 2 + 10;
    } else if (kind === 'on') {
      cx = mid + side * Math.ceil(k / 2) * 2.4 * R * (k === 0 ? 0 : 1);
      cy = box.y - R;
    } else {
      cx = mid + side * (R + 4);
      cy = ground - R;
    }
    const g = el(doc, 'g', { 'data-element': item.id, 'data-relation': kind, class: 'sp-postava' });
    g.setAttribute('data-cx', cx);
    g.setAttribute('data-cy', cy);
    g.setAttribute('data-r', R);
    g.append(el(doc, 'circle', { cx, cy, r: R, class: 'sp-figure' }));
    // Celý popisek postavy (jen v plném režimu): u in/on nad kolečkem, u at vedle kolíku směrem od něj.
    if (!mini) {
      const label = item.label || '';
      if (kind === 'at') {
        g.append(el(doc, 'text', { x: cx + side * (R + 6), y: cy + 5, 'text-anchor': side > 0 ? 'start' : 'end', class: 'sp-figlabel' }, label));
      } else {
        g.append(el(doc, 'text', { x: cx, y: cy - R - 6, 'text-anchor': 'middle', class: 'sp-figlabel' }, label));
      }
    }
    return g;
  }

  // options: { mini: bool (menší schéma bez popisků), label: text pro čtečky obrazovky }
  function svg(doc, scene, visibleIds, options = {}) {
    const mini = Boolean(options.mini);
    const height = mini ? 130 : 190;
    const ground = mini ? 112 : 140;
    const root_ = el(doc, 'svg', {
      viewBox: `0 0 ${WIDTH} ${height}`, role: 'img', class: 'spatial' + (mini ? ' spatial-mini' : ''),
      'aria-label': options.label || '',
    });
    root_.append(el(doc, 'line', { x1: 0, y1: ground, x2: WIDTH, y2: ground, class: 'sp-ground' }));
    const visible = scene.elements.filter((e) => visibleIds.includes(e.id));
    const landmarks = visible.filter((e) => e.type !== 'postava');
    const colW = WIDTH / Math.max(1, landmarks.length);
    const boxes = new Map();
    landmarks.forEach((item, i) => {
      const { g, box } = drawLandmark(doc, item, colW * (i + 0.5), ground, colW, mini);
      boxes.set(item.id, box);
      root_.append(g);
    });
    const count = new Map();
    visible.filter((e) => e.type === 'postava').forEach((item) => {
      const target = item.relation && item.relation.target;
      if (!boxes.has(target)) return; // předmět postavy není vidět – postava se nekreslí
      const k = count.get(target) || 0;
      count.set(target, k + 1);
      root_.append(drawFigure(doc, item, boxes.get(target), ground, k, mini));
    });
    return root_;
  }

  const Spatial = { svg, WIDTH };

  if (typeof module !== 'undefined' && module.exports) module.exports = Spatial;
  else root.Spatial = Spatial;
})(typeof window !== 'undefined' ? window : globalThis);
