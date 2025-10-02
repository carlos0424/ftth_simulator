// js/render-svg.js
// Dibuja el árbol (un PON) en el <svg>, dejando el manejo de estado y layout a otros módulos.

import { toPercent, splitterLoss, MIN_POWER, CONNECTOR_LOSS, SPLICE_LOSS } from './calc-loss.js';
import { createLine, createCircle, createText, drawRect, drawSplitterPolygon } from './utils.js';

/**
 * Renderiza un PON en SVG.
 * @param {Object} cfg
 * @param {SVGSVGElement} cfg.svg
 * @param {number} cfg.ponIndex
 * @param {Array}  cfg.tree
 * @param {Map}    cfg.positions           // nodeId -> {x,y,depth}
 * @param {Object} cfg.opts
 * @param {Function} cfg.onNodeGroupReady
 * @param {Function} cfg.addLossRow
 */
export function renderSVG({ svg, ponIndex, tree, positions, opts, onNodeGroupReady, addLossRow }) {
  const {
    startX = 250,
    laneMid = 400,
    hubX = 210,
    txPower = 3,
    capNAP = 8,
    showPowerLabels = true,
    showPortNumbers = true,
    showUnusedPorts = true,
    napCompact = { lineLen: 16, spacing: 12, offsetX: 90 }
  } = opts || {};

  // etiqueta PON (visual, no “hub”)
  drawRect(svg, hubX - 36, laneMid - 12, 60, 24, 6, 'var(--hub)', `PON${ponIndex + 1}`);

  // Conexiones por nodo: { inputLine, outputLines[], unusedPorts[], powerLabel, portLabel }
  const connectionLines = {};

  // hijos por padre
  const childrenByParent = new Map();
  tree.forEach(n => {
    if (n.parentId != null) {
      const lst = childrenByParent.get(n.parentId) || [];
      lst.push(n);
      childrenByParent.set(n.parentId, lst);
    }
  });

  // raíces
  tree.filter(n => n.parentId == null).forEach(root => {
    drawNodeRecursive({
      node: root,
      parentX: hubX + 24,
      parentY: laneMid,
      depth: 0,
      powerIn: txPower
    });
  });

  // ——— funciones locales ———

  function drawNodeRecursive({ node, parentX, parentY, depth, powerIn }) {
    const pos = positions.get(node.id) || { x: startX + depth * 250, y: laneMid };
    const nodeKey = `pon${ponIndex}-node${node.id}`;

    // Grupo contenedor
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', `group-${nodeKey}`);
    g.setAttribute('data-draggable', 'true');
    g.setAttribute('data-node-id', nodeKey);
    g.setAttribute('transform', `translate(${pos.x},${pos.y})`);
    g.style.cursor = 'grab';
    svg.appendChild(g);

    // Línea de entrada (recta, sin “codos” fijos)
    const inLine = createLine(parentX, parentY, pos.x, pos.y + 12);
    svg.appendChild(inLine);

    // Etiqueta de puerto padre
    let portLbl = null;
    if (showPortNumbers && node.parentPort) {
      const midX = (parentX + pos.x) / 2;
      const midY = (parentY + pos.y + 12) / 2;
      portLbl = createText(midX, midY - 5, `P${node.parentPort}`, '#6366f1', 8);
      portLbl.setAttribute('data-start-x', parentX);
      portLbl.setAttribute('data-start-y', parentY);
      svg.appendChild(portLbl);
    }

    // registrar referencias
    connectionLines[nodeKey] = { inputLine: inLine, outputLines: [], unusedPorts: [], powerLabel: null, portLabel: portLbl };

    if (node.type === 'splitter') {
      // pérdidas
      const loss = splitterLoss(node.ratio);
      const powerOut = powerIn - loss - SPLICE_LOSS;

      // triángulo + etiquetas
      drawSplitterPolygon(g, 0, 0, `1:${node.ratio}`, node.name);
      if (showPowerLabels) {
        const pcent = toPercent(powerOut);
        const lbl = createText(40, 12, `${powerOut.toFixed(1)}dBm (${pcent}%)`, '#059669', 9);
        g.appendChild(lbl);
        connectionLines[nodeKey].powerLabel = lbl;
      }
      addLossRow?.(ponIndex + 1, `${node.name}`, powerOut, toPercent(powerOut), depth);

      // puertos
      const portSpacing = 25;
      const startPortY = 12 - ((node.ratio - 1) * portSpacing) / 2;

      const kids = childrenByParent.get(node.id) || [];
      for (let i = 1; i <= node.ratio; i++) {
        const portY = startPortY + (i - 1) * portSpacing;

        const child = kids.find(k => k.parentPort === i);
        if (child) {
          // segmento corto de salida
          const outLine = createLine(pos.x + 50, pos.y + portY, pos.x + 70, pos.y + portY);
          svg.appendChild(outLine);

          connectionLines[nodeKey].outputLines.push({ line: outLine, portOffset: portY });
          // hijo
          drawNodeRecursive({
            node: child,
            parentX: pos.x + 70,
            parentY: pos.y + portY,
            depth: depth + 1,
            powerIn: powerOut
          });
        } else if (showUnusedPorts) {
          const uLine   = createLine(pos.x + 50, pos.y + portY, pos.x + 70, pos.y + portY);
          const uCircle = createCircle(pos.x + 70, pos.y + portY, 3, '#ef4444', '#dc2626', 1.5);
          svg.appendChild(uLine);
          svg.appendChild(uCircle);
          const info = { line: uLine, circle: uCircle, portOffset: portY };
          if (showPortNumbers) {
            const t = createText(pos.x + 85, pos.y + portY + 4, `P${i}`, '#dc2626', 8);
            svg.appendChild(t);
            info.text = t;
          }
          connectionLines[nodeKey].unusedPorts.push(info);
        }
      }

      onNodeGroupReady?.(node, g, connectionLines[nodeKey]);
    } else {
      // NAP compacta (sin iconos ONT)
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

      drawCompactNAP(g, pos.x + (napCompact.offsetX ?? 90), pos.y + 12, node.ratio, capNAP, napCompact, node.name);

      addLossRow?.(ponIndex + 1, `${node.name} → ${node.ratio} ONTs`, powerONT, pcent, depth);
      onNodeGroupReady?.(node, g, connectionLines[nodeKey]);
    }
  }
}

/** NAP compacta dentro del mismo <g> (se mueve toda junta) */
function drawCompactNAP(group, x, yMid, count, cap, conf, napLabel){
  const spacing = conf.spacing ?? 12;
  const lineLen = conf.lineLen ?? 16;

  let rest = count;
  let y = yMid - (count * spacing) / 2;
  let napIndex = 1;

  while (rest > 0){
    const enNAP = Math.min(cap, rest);
    const napY = y + (enNAP * spacing) / 2 - 12;

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(x - 70));
    rect.setAttribute('y', String(napY));
    rect.setAttribute('width', '60');
    rect.setAttribute('height', '24');
    rect.setAttribute('rx', '6');
    rect.setAttribute('fill', 'var(--nap)');
    group.appendChild(rect);

    const label = createText(x - 40, napY + 15, `${napLabel} #${napIndex}`, '#fff', 10);
    label.setAttribute('text-anchor', 'middle');
    group.appendChild(label);

    for (let i=0; i<enNAP; i++){
      const oy = y + i*spacing + spacing/2;
      group.appendChild(createLine(x - 10, napY + 12, x - 10, oy));
      group.appendChild(createLine(x - 10, oy, x - 10 + lineLen, oy));
    }

    y += enNAP * spacing + 10;
    rest -= enNAP;
    napIndex++;
  }
}
