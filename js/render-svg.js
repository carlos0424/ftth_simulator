// render-svg.js
// Dibuja el árbol (un PON) en el <svg>, dejando el manejo de estado y layout a otros módulos.

import { toPercent, splitterLoss, MIN_POWER, CONNECTOR_LOSS, SPLICE_LOSS } from './calc-loss.js';
import { createLine, createCircle, createText, drawRect, drawSplitterPolygon } from './utils.js';

/**
 * Renderiza un PON en SVG.
 * @param {Object} cfg
 * @param {SVGSVGElement} cfg.svg
 * @param {number} cfg.ponIndex
 * @param {Array}  cfg.tree                // nodos de ese PON
 * @param {Map}    cfg.positions           // nodeId -> {x,y,depth}
 * @param {Object} cfg.opts                // flags y parámetros de potencia
 * @param {Function} cfg.onNodeGroupReady  // callback para registrar conexiones (drag)
 * @param {Function} cfg.addLossRow        // callback para tabla de pérdidas
 */
export function renderSVG({ svg, ponIndex, tree, positions, opts, onNodeGroupReady, addLossRow }) {
  // Limpieza parcial: el caller puede limpiar todo el SVG si quiere.
  // Aquí solo dibujamos el contenido de este PON.
  const {
    startX = 250,
    laneMid = 400,
    hubX = 210,
    oltX = 20,
    txPower = 3,
    capNAP = 8,
    showPowerLabels = true,
    showPortNumbers = true,
    showUnusedPorts = true
  } = opts || {};

  // Hub (etiqueta PON)
  drawRect(svg, hubX - 36, laneMid - 12, 60, 24, 6, 'var(--hub)', `PON${ponIndex + 1}`);

  // Conexiones por nodo para que drag.js las actualice
  // Estructura: key "pon{idx}-node{id}" -> { inputLine, outputLines[], unusedPorts[], powerLabel, portLabel }
  const connectionLines = {};

  // Map rápido de hijos por padre
  const childrenByParent = new Map();
  tree.forEach(n => {
    if (n.parentId != null) {
      const lst = childrenByParent.get(n.parentId) || [];
      lst.push(n);
      childrenByParent.set(n.parentId, lst);
    }
  });

  // Renderizar raíces
  tree.filter(n => n.parentId == null).forEach(root => {
    drawNodeRecursive({
      node: root,
      parentX: hubX + 24,
      parentY: laneMid,
      depth: 0,
      powerIn: txPower,
      connectionLines,
    });
  });

  // ——— funciones locales ———

  function drawNodeRecursive({ node, parentX, parentY, depth, powerIn, connectionLines }) {
    const pos = positions.get(node.id) || { x: startX + depth * 250, y: laneMid };
    const nodeKey = `pon${ponIndex}-node${node.id}`;

    // Grupo contenedor (para drag)
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', `group-${nodeKey}`);
    g.setAttribute('data-draggable', 'true');
    g.setAttribute('data-node-id', nodeKey);
    g.setAttribute('transform', `translate(${pos.x},${pos.y})`);
    g.style.cursor = 'grab';
    svg.appendChild(g);

    // Linea de entrada desde el padre
    const inLine = createLine(parentX, parentY, pos.x, pos.y + 12);
    svg.appendChild(inLine);

    // Etiqueta del puerto padre (si aplica)
    let portLbl = null;
    if (showPortNumbers && node.parentPort) {
      const midX = (parentX + pos.x) / 2;
      const midY = (parentY + pos.y + 12) / 2;
      portLbl = createText(midX, midY - 5, `P${node.parentPort}`, '#6366f1', 8);
      portLbl.setAttribute('data-start-x', parentX);
      portLbl.setAttribute('data-start-y', parentY);
      svg.appendChild(portLbl);
    }

    // Inicializa estructura para este nodo
    connectionLines[nodeKey] = { inputLine: inLine, outputLines: [], unusedPorts: [], powerLabel: null, portLabel: portLbl };

    if (node.type === 'splitter') {
      // Pérdidas del splitter
      const loss = splitterLoss(node.ratio);
      const powerOut = powerIn - loss - SPLICE_LOSS;

      // Dibujo del triángulo y etiquetas
      drawSplitterPolygon(g, 0, 0, `1:${node.ratio}`, node.name);

      if (showPowerLabels) {
        const pcent = toPercent(powerOut);
        const lbl = createText(40, 12, `${powerOut.toFixed(1)}dBm (${pcent}%)`, '#059669', 9);
        g.appendChild(lbl);
        connectionLines[nodeKey].powerLabel = lbl;
      }

      // Registrar en tabla de pérdidas
      addLossRow?.(ponIndex + 1, `${node.name}`, powerOut, toPercent(powerOut), depth);

      // Puertos del splitter
      const portSpacing = 25;
      const startPortY = 12 - ((node.ratio - 1) * portSpacing) / 2;

      const kids = childrenByParent.get(node.id) || [];
      for (let i = 1; i <= node.ratio; i++) {
        const portY = startPortY + (i - 1) * portSpacing;
        const portX = 50;

        const child = kids.find(k => k.parentPort === i);
        if (child) {
          // Línea corta de salida y recursión con el hijo
          const outLine = createLine(pos.x + 50, pos.y + portY, pos.x + portX, pos.y + portY);
          svg.appendChild(outLine);
          connectionLines[nodeKey].outputLines.push({ line: outLine, portOffset: portY });

          drawNodeRecursive({
            node: child,
            parentX: pos.x + portX,
            parentY: pos.y + portY,
            depth: depth + 1,
            powerIn: powerOut,
            connectionLines
          });
        } else if (showUnusedPorts) {
          // Puerto sin usar (línea corta + círculo y opcional etiqueta P#)
          const uLine = createLine(pos.x + 50, pos.y + portY, pos.x + portX + 20, pos.y + portY);
          const uCircle = createCircle(pos.x + portX + 20, pos.y + portY, 3, '#ef4444', '#dc2626', 1.5);
          svg.appendChild(uLine);
          svg.appendChild(uCircle);

          const info = { line: uLine, circle: uCircle, portOffset: portY };
          if (showPortNumbers) {
            const t = createText(pos.x + portX + 35, pos.y + portY + 4, `P${i}`, '#dc2626', 8);
            svg.appendChild(t);
            info.text = t;
          }
          connectionLines[nodeKey].unusedPorts.push(info);
        }
      }

      // Notificar al manejador (drag.js) para registrar este grupo/nodo
      onNodeGroupReady?.(node, g, connectionLines[nodeKey]);

    } else {
      // NAP: tratamos ratio como número de ONTs “dist”
      const loss = splitterLoss(node.ratio);
      const powerONT = powerIn - loss - CONNECTOR_LOSS;

      drawSplitterPolygon(g, 0, 0, `1:${node.ratio}`, 'Dist');

      const powerColor = powerONT < MIN_POWER ? '#dc2626' : (powerONT < -20 ? '#f59e0b' : '#059669');
      const pcent = toPercent(powerONT);

      if (showPowerLabels) {
        const lbl = createText(40, 12, `${powerONT.toFixed(1)}dBm (${pcent}%)`, powerColor, 9);
        g.appendChild(lbl);
        connectionLines[nodeKey].powerLabel = lbl;
      }

      // Pintar NAP(s) y ONTs adyacentes
      drawNAPandONTs(svg, pos.x + 130, pos.y + 12, node.ratio, capNAP, node.name);

      addLossRow?.(ponIndex + 1, `${node.name} → ${node.ratio} ONTs`, powerONT, pcent, depth);

      onNodeGroupReady?.(node, g, connectionLines[nodeKey]);
    }
  }
}

/** Dibuja NAPs y ONTs a la derecha del nodo actual */
function drawNAPandONTs(svg, x, yMid, count, cap, napLabel) {
  const h = 22;
  let rest = count, y = yMid - (count * h) / 2;
  let napIndex = 1;

  while (rest > 0) {
    const enNAP = Math.min(cap, rest);
    const napY = y + (enNAP * h) / 2 - 12;

    drawRect(svg, x - 90, napY, 80, 24, 6, 'var(--nap)', `${napLabel} #${napIndex}`);

    for (let i = 0; i < enNAP; i++) {
      const oy = y + i * h + h / 2;
      svg.appendChild(createLine(x - 10, napY + 12, x - 10, oy));
      svg.appendChild(createLine(x - 10, oy, x - 4, oy));

      // cajitas ONT
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(x + 8));
      rect.setAttribute('y', String(oy - 7));
      rect.setAttribute('width', '46');
      rect.setAttribute('height', '14');
      rect.setAttribute('rx', '3');
      rect.setAttribute('fill', 'var(--ont)');
      svg.appendChild(rect);

      const label = createText(x + 31, oy + 3, 'ONT', '#fff', 8);
      label.setAttribute('text-anchor', 'middle');
      svg.appendChild(label);
    }

    y += enNAP * h + 10;
    rest -= enNAP;
    napIndex++;
  }
}
