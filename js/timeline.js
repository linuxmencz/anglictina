// Vykreslení časové osy jako SVG (bez práce s globálním DOM) – testuje se v Node, v prohlížeči běží jako window.Timeline.
// Veškerý text se vkládá přes textContent, nikdy jako HTML.
(function (root) {
  const NS = 'http://www.w3.org/2000/svg';
  const WIDTH = 600; // šířka viewBoxu; pozice 0–100 se přepočítá na 0–WIDTH
  const NOW = 60; // pozice značky TEĎ

  const x = (position) => (position / 100) * WIDTH;

  function el(doc, name, attrs = {}, text) {
    const node = doc.createElementNS(NS, name);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, String(v)));
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // Popisek u okraje osy se zarovná dovnitř, aby se nepřeřízl.
  function anchor(px) {
    return px < 90 ? 'start' : px > WIDTH - 90 ? 'end' : 'middle';
  }

  function label(doc, px, y, text) {
    return el(doc, 'text', { x: px, y, 'text-anchor': anchor(px), class: 'tl-label' }, text);
  }

  function drawEvent(doc, event, axisY, mini, labelY) {
    const g = el(doc, 'g', { 'data-event': event.id, class: 'tl-' + event.type });
    const from = x(event.from);
    const to = x(event.to);
    if (event.type === 'bod') {
      g.append(el(doc, 'text', { x: from, y: axisY + 8, 'text-anchor': 'middle', class: 'tl-mark' }, '✕'));
      if (!mini) g.append(label(doc, from, labelY, event.label));
    } else if (event.type === 'úsek') {
      g.append(el(doc, 'rect', { x: from, y: axisY - 7, width: to - from, height: 14, rx: 7, 'data-span': '', 'data-width': to - from, class: 'tl-bar' }));
      if (!mini) g.append(label(doc, (from + to) / 2, labelY, event.label));
    } else if (event.type === 'výsledek') {
      const y = axisY + 22;
      g.append(
        el(doc, 'line', { x1: from, y1: y, x2: to - 10, y2: y, 'stroke-dasharray': '8 6', class: 'tl-arrow-line' }),
        el(doc, 'polygon', { points: `${to},${y} ${to - 12},${y - 7} ${to - 12},${y + 7}`, class: 'tl-arrow-head' }),
      );
      if (!mini) g.append(label(doc, (from + to) / 2, labelY, event.label));
    } else {
      g.append(el(doc, 'rect', { x: from, y: axisY - 36, width: to - from, height: 72, rx: 10, 'data-span': '', 'data-width': to - from, class: 'tl-frame' }));
      if (!mini) g.append(label(doc, (from + to) / 2, labelY, event.label));
    }
    return g;
  }

  const LANE = 26; // svislý rozestup řádků popisků
  const CHAR_WIDTH = 10; // odhad šířky znaku popisku ve viewBoxu

  // Popisky nad a pod osou se řadí do řádků tak, aby se vodorovně nepřekrývaly.
  // Vrací { lanes: Map(id -> {side, lane}), above: počet řádků nad osou, below: počet řádků pod osou }.
  function placeLabels(events) {
    const lanes = new Map();
    const used = { above: [], below: [] };
    events.forEach((e) => {
      const side = e.type === 'bod' || e.type === 'úsek' ? 'above' : 'below';
      const centre = e.type === 'bod' ? x(e.from) : (x(e.from) + x(e.to)) / 2;
      const width = e.label.length * CHAR_WIDTH;
      const a = anchor(centre);
      const start = a === 'start' ? centre : a === 'end' ? centre - width : centre - width / 2;
      const span = [start - 6, start + width + 6];
      let lane = 0;
      while ((used[side][lane] || []).some(([s, t]) => span[0] < t && span[1] > s)) lane += 1;
      (used[side][lane] = used[side][lane] || []).push(span);
      lanes.set(e.id, { side, lane });
    });
    return { lanes, above: Math.max(1, used.above.length), below: Math.max(1, used.below.length) };
  }

  // options: { mini: bool (menší schéma bez popisků událostí), label: text pro čtečky obrazovky }
  function svg(doc, scene, visibleIds, options = {}) {
    const mini = Boolean(options.mini);
    const visible = scene.events.filter((e) => visibleIds.includes(e.id));
    const placed = placeLabels(visible);
    const axisY = mini ? 40 : 76 + (placed.above - 1) * LANE;
    const height = mini ? 90 : axisY + 62 + (placed.below - 1) * LANE + 20;
    const root_ = el(doc, 'svg', {
      viewBox: `0 0 ${WIDTH} ${height}`, role: 'img', class: 'timeline' + (mini ? ' timeline-mini' : ''),
      'aria-label': options.label || '',
    });
    root_.append(el(doc, 'line', { x1: 0, y1: axisY, x2: WIDTH - 14, y2: axisY, class: 'tl-axis' }));
    root_.append(el(doc, 'polygon', { points: `${WIDTH},${axisY} ${WIDTH - 14},${axisY - 6} ${WIDTH - 14},${axisY + 6}`, class: 'tl-axis-head' }));
    if (!mini) {
      root_.append(
        el(doc, 'text', { x: 2, y: axisY + 28, class: 'tl-side', 'text-anchor': 'start' }, 'minulost'),
        el(doc, 'text', { x: WIDTH - 4, y: axisY + 28, class: 'tl-side', 'text-anchor': 'end' }, 'budoucnost'),
      );
    }
    const now = el(doc, 'g', { 'data-now': '', 'data-x': x(NOW), class: 'tl-now' });
    now.append(
      el(doc, 'line', { x1: x(NOW), y1: mini ? axisY - 18 : 20, x2: x(NOW), y2: axisY + (mini ? 18 : 40) }),
      el(doc, 'text', { x: x(NOW), y: mini ? axisY - 22 : 14, 'text-anchor': 'middle' }, 'TEĎ'),
    );
    root_.append(now);
    visible.forEach((e) => {
      const { side, lane } = placed.lanes.get(e.id);
      const labelY = side === 'above' ? axisY - 24 - lane * LANE : axisY + 52 + lane * LANE;
      root_.append(drawEvent(doc, e, axisY, mini, labelY));
    });
    return root_;
  }

  const Timeline = { svg, WIDTH, NOW };

  if (typeof module !== 'undefined' && module.exports) module.exports = Timeline;
  else root.Timeline = Timeline;
})(typeof window !== 'undefined' ? window : globalThis);
