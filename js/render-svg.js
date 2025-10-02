// js/render-svg.js
// Dibuja el árbol con ratios de división de potencia

import { toPercent, splitterLoss, MIN_POWER, CONNECTOR_LOSS, SPLICE_LOSS } from './calc-loss.js';
import { createLine, createCircle, createText, drawRect, drawSplitterPolygon } from './utils.js';

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
    napCompact = { lineLen: 14, spacing: 12, offsetX: 80 }
  } = opts || {};

  const connectionLines = {};

  const childrenByParent = new Map();
  tree.forEach(n => {
    if (n.parentId != null) {
      const lst = childrenByParent.get(n.parentId) || [];
      lst.push(n);
      childrenByParent.set(n.parentId, lst);
    }
  });

  tree.filter(n => n.parentId == null).forEach(root => {
    drawNodeRecursive({
      node: root,
      parentX: hubX + 24,
      parentY: laneMid,
      depth: 0,
      powerIn: txPower
    });
  });

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

    // Línea de entrada
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

    connectionLines[nodeKey] = { 
      inputLine: inLine, 
      outputLines: [], 
      unusedPorts: [], 
      powerLabel: null, 
      portLabel: portLbl 
    };

    if (node.type === 'splitter') {
      const loss = splitterLoss(node.ratio);
      const powerOut = powerIn - loss - SPLICE_LOSS;

      // Triángulo + etiquetas
      drawSplitterPolygon(g, 0, 0, `1:${node.ratio}`, node.name);
      
      // Etiqueta de potencia RELATIVA AL GRUPO (se mueve con el nodo)
      if (showPowerLabels) {
        const pcent = toPercent(powerOut);
        const lbl = createText(60, -8, `${powerOut.toFixed(1)}dBm (${pcent}%)`, '#059669', 9);
        lbl.setAttribute('font-weight', '700');
        g.appendChild(lbl); // ← DENTRO DEL GRUPO
        connectionLines[nodeKey].powerLabel = lbl;
      }
      
      addLossRow?.(ponIndex + 1, `${node.name}`, powerOut, toPercent(powerOut), depth);

      // Puertos con ratios de división
      const portSpacing = 25;
      const startPortY = 12 - ((node.ratio - 1) * portSpacing) / 2;
      const kids = childrenByParent.get(node.id) || [];
      
      // Calcular ratio de división de potencia (desbalanceado)
      const powerRatios = calculatePowerRatios(node.ratio, kids.length);

      for (let i = 1; i <= node.ratio; i++) {
        const portY = startPortY + (i - 1) * portSpacing;
        const child = kids.find(k => k.parentPort === i);
        
        if (child) {
          const outLine = createLine(pos.x + 50, pos.y + portY, pos.x + 70, pos.y + portY);
          svg.appendChild(outLine);

          const childKey = `pon${ponIndex}-node${child.id}`;
          
          // Etiqueta de ratio de potencia (ej: "90%" o "10%")
          let powerRatioLabel = null;
          if (powerRatios[i-1]) {
            powerRatioLabel = createText(
              pos.x + 60, 
              pos.y + portY - 5, 
              `${powerRatios[i-1]}%`, 
              '#f59e0b', 
              8
            );
            powerRatioLabel.setAttribute('font-weight', '700');
            svg.appendChild(powerRatioLabel);
          }

          connectionLines[nodeKey].outputLines.push({ 
            line: outLine, 
            portOffset: portY,
            childKey: childKey,
            powerRatioLabel: powerRatioLabel
          });

          drawNodeRecursive({
            node: child,
            parentX: pos.x + 70,
            parentY: pos.y + portY,
            depth: depth + 1,
            powerIn: powerOut * (powerRatios[i-1] / 100)
          });
        } else if (showUnusedPorts) {
          const uLine = createLine(pos.x + 50, pos.y + portY, pos.x + 70, pos.y + portY);
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
      // NAP
      const loss = splitterLoss(node.ratio);
      const powerONT = powerIn - loss - CONNECTOR_LOSS;

      drawSplitterPolygon(g, 0, 0, `1:${node.ratio}`, 'Dist');
      const powerColor = powerONT < MIN_POWER ? '#dc2626' : (powerONT < -20 ? '#f59e0b' : '#059669');
      const pcent = toPercent(powerONT);

      if (showPowerLabels) {
        const lbl = createText(60, -8, `${powerONT.toFixed(1)}dBm (${pcent}%)`, powerColor, 9);
        lbl.setAttribute('font-weight', '700');
        g.appendChild(lbl);
        connectionLines[nodeKey].powerLabel = lbl;
      }

      drawCompactNAP(g, pos.x + (napCompact.offsetX ?? 80), pos.y + 12, node.ratio, capNAP, napCompact, node.name);

      addLossRow?.(ponIndex + 1, `${node.name} → ${node.ratio} ONTs`, powerONT, pcent, depth);
      onNodeGroupReady?.(node, g, connectionLines[nodeKey]);
    }
  }
}

/**
 * Calcula ratios de división de potencia para redes desbalanceadas
 * Ejemplos:
 * - 1:2 con 2 hijos → [90, 10] (desbalanceado)
 * - 1:4 con 3 hijos → [70, 20, 10] (desbalanceado cascada)
 * - 1:8 con 4 hijos → [50, 25, 15, 10]
 */
function calculatePowerRatios(totalPorts, usedPorts) {
  const ratios = new Array(totalPorts).fill(0);
  
  if (usedPorts === 0) return ratios;
  
  // Distribución desbalanceada típica de FTTH
  if (usedPorts === 1) {
    ratios[0] = 100;
  } else if (usedPorts === 2) {
    ratios[0] = 90;
    ratios[1] = 10;
  } else if (usedPorts === 3) {
    ratios[0] = 70;
    ratios[1] = 20;
    ratios[2] = 10;
  } else if (usedPorts === 4) {
    ratios[0] = 50;
    ratios[1] = 25;
    ratios[2] = 15;
    ratios[3] = 10;
  } else {
    // Para más puertos, distribuir de forma decreciente
    let remaining = 100;
    for (let i = 0; i < usedPorts; i++) {
      const ratio = Math.floor(remaining / (usedPorts - i));
      ratios[i] = ratio;
      remaining -= ratio;
    }
  }
  
  return ratios;
}

function drawCompactNAP(group, x, yMid, count, cap, conf, napLabel) {
  const spacing = conf.spacing ?? 12;
  const lineLen = conf.lineLen ?? 14;

  let rest = count;
  let y = yMid - (count * spacing) / 2;
  let napIndex = 1;

  while (rest > 0) {
    const enNAP = Math.min(cap, rest);
    const napY = y + (enNAP * spacing) / 2 - 12;

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(x - 60));
    rect.setAttribute('y', String(napY));
    rect.setAttribute('width', '52');
    rect.setAttribute('height', '22');
    rect.setAttribute('rx', '5');
    rect.setAttribute('fill', 'var(--nap)');
    group.appendChild(rect);

    const label = createText(x - 34, napY + 14, `${napLabel.substring(0, 8)} #${napIndex}`, '#fff', 9);
    label.setAttribute('text-anchor', 'middle');
    group.appendChild(label);

    for (let i = 0; i < enNAP; i++) {
      const oy = y + i * spacing + spacing / 2;
      // Líneas relativas al grupo
      const vertLine = createLine(x - 8 - group.transform.baseVal.getItem(0).matrix.e, napY + 11, x - 8 - group.transform.baseVal.getItem(0).matrix.e, oy);
      const horizLine = createLine(x - 8 - group.transform.baseVal.getItem(0).matrix.e, oy, x - 8 + lineLen - group.transform.baseVal.getItem(0).matrix.e, oy);
      group.appendChild(vertLine);
      group.appendChild(horizLine);
      
      const ontCircle = createCircle(x - 8 + lineLen - group.transform.baseVal.getItem(0).matrix.e, oy, 2, '#10b981', '#059669', 1);
      group.appendChild(ontCircle);
    }

    y += enNAP * spacing + 14;
    rest -= enNAP;
    napIndex++;
  }
}