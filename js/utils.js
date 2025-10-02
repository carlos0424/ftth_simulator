// utils.js
// Helpers de SVG y DOM genéricos.

/** Selector corto (un solo elemento) */
export const $ = (sel, ctx = document) => ctx.querySelector(sel);
/** Selector corto (varios elementos) */
export const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

/** Crea un elemento SVG con atributos */
export function svgEl(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
  return el;
}

export function createLine(x1, y1, x2, y2) {
  return svgEl('line', {
    x1, y1, x2, y2,
    stroke: 'var(--line)',
    'stroke-width': 2.5
  });
}

export function createCircle(cx, cy, r, fill, stroke, sw) {
  return svgEl('circle', {
    cx, cy, r,
    fill, stroke,
    'stroke-width': sw
  });
}

export function createText(x, y, text, color, size) {
  const t = svgEl('text', {
    x, y,
    'text-anchor': 'start',
    fill: color,
    'font-size': size,
    'font-weight': '600'
  });
  t.textContent = text;
  return t;
}

export function drawRect(svg, x, y, w, h, rx, fill, label) {
  const r = svgEl('rect', { x, y, width: w, height: h, rx, fill });
  svg.appendChild(r);

  if (label) {
    const t = createText(x + w / 2, y + h / 2 + 4, label, '#fff', 11);
    t.setAttribute('text-anchor', 'middle');
    svg.appendChild(t);
  }
}

export function drawSplitterPolygon(group, x, y, ratioLabel, nameLabel) {
  const poly = svgEl('polygon', {
    points: `${x},${y + 12} ${x + 50},${y} ${x + 50},${y + 24}`,
    fill: 'var(--split)',
    stroke: '#0a4d4d',
    'stroke-width': 1.5
  });
  group.appendChild(poly);

  const ratio = createText(x + 25, y + 10, ratioLabel, '#fff', 10);
  ratio.setAttribute('text-anchor', 'middle');
  group.appendChild(ratio);

  const name = createText(x + 25, y + 38, nameLabel, '#1f3b47', 9);
  name.setAttribute('text-anchor', 'middle');
  group.appendChild(name);
}

/** Descarga un archivo dado un URL (Blob o recurso directo) */
export function download(url, name = 'file.txt') {
  try {
    const a = document.createElement('a');
    a.href = url instanceof Blob ? URL.createObjectURL(url) : url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (url instanceof Blob) {
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
  } catch (err) {
    console.error('Fallo en download()', err);
  }
}

/** Crea un grupo SVG <g> */
export function createGroup(attrs = {}) {
  return svgEl('g', attrs);
}

/** Limpia todos los hijos de un nodo */
export function clearChildren(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
