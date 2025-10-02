// utils.js
// Helpers de SVG y DOM genéricos.

export function createLine(x1, y1, x2, y2) {
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', String(x1));
  line.setAttribute('y1', String(y1));
  line.setAttribute('x2', String(x2));
  line.setAttribute('y2', String(y2));
  line.setAttribute('stroke', 'var(--line)');
  line.setAttribute('stroke-width', '2.5');
  return line;
}

export function createCircle(cx, cy, r, fill, stroke, sw) {
  const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  c.setAttribute('cx', String(cx));
  c.setAttribute('cy', String(cy));
  c.setAttribute('r', String(r));
  c.setAttribute('fill', fill);
  c.setAttribute('stroke', stroke);
  c.setAttribute('stroke-width', String(sw));
  return c;
}

export function createText(x, y, text, color, size) {
  const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  t.setAttribute('x', String(x));
  t.setAttribute('y', String(y));
  t.setAttribute('text-anchor', 'start');
  t.setAttribute('fill', color);
  t.setAttribute('font-size', String(size));
  t.setAttribute('font-weight', '600');
  t.textContent = text;
  return t;
}

export function drawRect(svg, x, y, w, h, rx, fill, label) {
  const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  r.setAttribute('x', String(x));
  r.setAttribute('y', String(y));
  r.setAttribute('width', String(w));
  r.setAttribute('height', String(h));
  r.setAttribute('rx', String(rx));
  r.setAttribute('fill', fill);
  svg.appendChild(r);

  if (label) {
    const t = createText(x + w / 2, y + h / 2 + 4, label, '#fff', 11);
    t.setAttribute('text-anchor', 'middle');
    svg.appendChild(t);
  }
}

export function drawSplitterPolygon(group, x, y, ratioLabel, nameLabel) {
  const pts = `${x},${y + 12} ${x + 50},${y} ${x + 50},${y + 24}`;
  const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  poly.setAttribute('points', pts);
  poly.setAttribute('fill', 'var(--split)');
  poly.setAttribute('stroke', '#0a4d4d');
  poly.setAttribute('stroke-width', '1.5');
  group.appendChild(poly);

  const ratio = createText(x + 25, y + 10, ratioLabel, '#fff', 10);
  ratio.setAttribute('text-anchor', 'middle');
  group.appendChild(ratio);

  const name = createText(x + 25, y + 38, nameLabel, '#1f3b47', 9);
  name.setAttribute('text-anchor', 'middle');
  group.appendChild(name);
}

export function download(url, name) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
