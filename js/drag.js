// drag.js
// Habilita drag & drop sobre los <g[data-draggable]> y actualiza líneas asociadas.

/**
 * Activa el modo drag & drop para nodos SVG.
 * @param {SVGElement} svg - Elemento <svg> raíz.
 * @param {Object} opts - Opciones.
 * @param {Function} opts.onMove - Callback(nodeKey, x, y, conn) → actualizar posiciones.
 * @param {Function} opts.getConnByNodeKey - Callback para obtener conexiones de un nodo.
 */
export function enableDragging(svg, { onMove, getConnByNodeKey }) {
  let dragging = null;
  let offset = { x: 0, y: 0 };

  // Inicio de drag
  svg.addEventListener('mousedown', (e) => {
    const g = e.target.closest('g[data-draggable]');
    if (!g) return;
    dragging = g;

    const pt = toSvgPoint(svg, e.clientX, e.clientY);
    const m = (g.getAttribute('transform') || '').match(/translate\(([^,]+),([^)]+)\)/);
    const cx = m ? parseFloat(m[1]) : 0;
    const cy = m ? parseFloat(m[2]) : 0;

    offset.x = pt.x - cx;
    offset.y = pt.y - cy;

    g.style.cursor = 'grabbing';
    e.preventDefault();
  });

  // Movimiento
  svg.addEventListener('mousemove', (e) => {
    if (!dragging) return;

    const pt = toSvgPoint(svg, e.clientX, e.clientY);
    const nx = pt.x - offset.x;
    const ny = pt.y - offset.y;

    dragging.setAttribute('transform', `translate(${nx},${ny})`);

    const nodeKey = dragging.getAttribute('data-node-id');
    if (!nodeKey) return;

    const conn = getConnByNodeKey?.(nodeKey);
    onMove?.(nodeKey, nx, ny, conn);
  });

  // Fin del drag
  ['mouseup', 'mouseleave'].forEach(evt => {
    svg.addEventListener(evt, () => {
      if (dragging) dragging.style.cursor = 'grab';
      dragging = null;
    });
  });
}

/**
 * Convierte coordenadas de pantalla a coordenadas SVG.
 * @param {SVGElement} svg 
 * @param {number} cx - Coordenada X en pantalla
 * @param {number} cy - Coordenada Y en pantalla
 * @returns {SVGPoint} punto convertido en espacio SVG
 */
function toSvgPoint(svg, cx, cy) {
  const p = svg.createSVGPoint();
  p.x = cx;
  p.y = cy;
  return p.matrixTransform(svg.getScreenCTM().inverse());
}
