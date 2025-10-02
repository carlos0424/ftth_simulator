// main.js
// Orquestación: UI del panel, estado, layout y render del SVG.

import { computeLayout, getNodeDepth } from './layout.js';
import { renderSVG } from './render-svg.js';
import { enableDragging } from './drag.js';
import { exportSVG, exportPNG } from './export.js';
import { summarize, validateOntsPerPon, MAX_ONTS_PER_PON_DEFAULT } from './rules.js';
import { SPLICE_LOSS, CONNECTOR_LOSS, MIN_POWER, MAX_POWER } from './calc-loss.js';

// ======== ESTADO =========
let currentPON = 0;
let ponConfigs = {};        // { [ponIndex]: { nodes: Node[] } }
let nextNodeId = 0;
let nodePositions = {};     // { "pon{i}-node{id}": {x,y} }
let connections = {};       // { "pon{i}-node{id}": { inputLine, outputLines[], unusedPorts[], powerLabel, portLabel } }

// ======== REFS =========
const svg = document.getElementById('svg');
const ponTabs = document.getElementById('ponTabs');
const ponContents = document.getElementById('ponContents');
const lossBody = document.querySelector('#lossTable tbody');
const warn = document.getElementById('warn');
const summaryGrid = document.getElementById('summaryGrid');

// ======== EVENTOS GENERALES =========
document.getElementById('toggleFab').onclick = () => document.getElementById('sidebar').classList.toggle('collapsed');
document.getElementById('puertos').addEventListener('change', initPONs);
document.getElementById('generate').onclick = generateAll;
document.getElementById('expSVG').onclick = () => exportSVG(svg);
document.getElementById('expPNG').onclick = () => exportPNG(svg);

['limitePON', 'capNAP', 'txPower', 'showPowerLabels', 'showPortNumbers', 'showUnusedPorts']
  .forEach(id => document.getElementById(id).addEventListener('change', generateAll));

document.getElementById('enableDragging').addEventListener('change', (e) => {
  const enabled = e.target.checked;
  if (enabled && !dragEnabled) {
    attachDrag();
  } else if (!enabled && dragEnabled) {
    detachDrag();
  }
});
document.getElementById('resetPositions').addEventListener('click', () => {
  if (confirm('¿Resetear todas las posiciones personalizadas?')) {
    nodePositions = {};
    connections = {};
    generateAll();
  }
});

// ======== DRAG =========
let dragEnabled = false;
let dragDetachFn = null;

function attachDrag() {
  enableDragging(svg, {
    getConnByNodeKey: key => connections[key],
    onMove: (nodeKey, nx, ny, conn) => {
      nodePositions[nodeKey] = { x: nx, y: ny };
      // actualizar líneas vinculadas
      if (conn?.inputLine) {
        conn.inputLine.setAttribute('x2', nx);
        conn.inputLine.setAttribute('y2', ny + 12);
      }
      if (conn?.outputLines?.length) {
        conn.outputLines.forEach(info => {
          info.line.setAttribute('x1', nx + 50);
          info.line.setAttribute('y1', ny + info.portOffset);
        });
      }
      if (conn?.unusedPorts?.length) {
        conn.unusedPorts.forEach(p => {
          p.line.setAttribute('x1', nx + 50);
          p.line.setAttribute('y1', ny + p.portOffset);
          p.line.setAttribute('x2', nx + 70);
          p.line.setAttribute('y2', ny + p.portOffset);
          if (p.circle) { p.circle.setAttribute('cx', nx + 70); p.circle.setAttribute('cy', ny + p.portOffset); }
          if (p.text)   { p.text.setAttribute('x', nx + 85); p.text.setAttribute('y', ny + p.portOffset + 4); }
        });
      }
      if (conn?.powerLabel) {
        conn.powerLabel.setAttribute('x', nx + 40);
        conn.powerLabel.setAttribute('y', ny + 12);
      }
      if (conn?.portLabel) {
        const startX = parseFloat(conn.portLabel.getAttribute('data-start-x'));
        const startY = parseFloat(conn.portLabel.getAttribute('data-start-y'));
        conn.portLabel.setAttribute('x', (startX + nx) / 2);
        conn.portLabel.setAttribute('y', (startY + ny + 12) / 2 - 5);
      }
    }
  });
  dragEnabled = true;
}

function detachDrag() {
  // No hay un “remove” directo: basta con recargar el SVG y no volver a registrar eventos.
  svg.replaceWith(svg.cloneNode(true));
  const newSvg = document.getElementById('svg');
  Object.assign(svg, newSvg); // mantener ref local abstractamente
  dragEnabled = false;
}

// ======== INICIALIZACIÓN =========
window.addEventListener('load', () => {
  initPONs();

  // Bootstrap de ejemplo (igual a tu inline)
  const rootId = addNode(0, null, 0, { type: 'splitter', ratio: 4, name: 'Split Principal' });
  addNode(0, rootId, 1, { type: 'nap', ratio: 8, name: 'Zona A' });
  addNode(0, rootId, 2, { type: 'splitter', ratio: 2, name: 'Split Secundario' });

  const secId = ponConfigs[0].nodes.find(n => n.name === 'Split Secundario').id;
  addNode(0, secId, 1, { type: 'nap', ratio: 16, name: 'Zona B' });

  generateAll();
  if (document.getElementById('enableDragging').checked) attachDrag();
});

// ======== UI PON (tabs / árbol) =========
function initPONs() {
  const numPON = Math.max(1, Math.min(8, +val('puertos')));
  ponTabs.innerHTML = '';
  ponContents.innerHTML = '';

  for (let i = 0; i < numPON; i++) {
    if (!ponConfigs[i]) ponConfigs[i] = { nodes: [] };

    const tab = document.createElement('button');
    tab.className = 'pon-tab' + (i === currentPON ? ' active' : '');
    tab.textContent = `PON ${i + 1}`;
    tab.onclick = () => switchPON(i);
    ponTabs.appendChild(tab);

    const content = document.createElement('div');
    content.className = 'pon-content' + (i === currentPON ? ' active' : '');
    content.dataset.pon = i;
    content.innerHTML = `
      <div style="margin-top:12px">
        <button class="btn-min add-root-btn" data-pon="${i}">➕ Agregar Splitter Raíz</button>
      </div>
      <div class="node-tree" data-pon="${i}"></div>
    `;
    ponContents.appendChild(content);

    content.querySelector('.add-root-btn').onclick = () => {
      addNode(i, null, 0, { type: 'splitter', ratio: 2, name: 'Nuevo Splitter' });
      renderPON(i);
      generateAll();
    };
  }
  renderAllPONs();
}

function switchPON(ponIndex) {
  currentPON = ponIndex;
  document.querySelectorAll('.pon-tab').forEach((tab, i) => tab.classList.toggle('active', i === ponIndex));
  document.querySelectorAll('.pon-content').forEach((content, i) => content.classList.toggle('active', i === ponIndex));
}

function renderAllPONs() {
  Object.keys(ponConfigs).forEach(i => renderPON(+i));
}

function renderPON(ponIndex) {
  const container = document.querySelector(`.node-tree[data-pon="${ponIndex}"]`);
  if (!container) return;

  container.innerHTML = '';
  const roots = ponConfigs[ponIndex].nodes.filter(n => n.parentId === null);
  roots.forEach(root => renderNodeTree(ponIndex, root, container, 0));
}

function renderNodeTree(ponIndex, node, container, depth) {
  const nodeDiv = document.createElement('div');
  nodeDiv.className = 'node-item' + (depth > 0 ? ' child' : '');

  nodeDiv.innerHTML = `
    <div class="node-header">
      <span class="node-title">${node.name}</span>
      <span class="node-badge">${node.type === 'splitter' ? 'SPLIT' : 'NAP'} 1:${node.ratio}</span>
    </div>

    ${node.type === 'splitter' ? `
      <label>Nombre</label>
      <input class="node-name-input" value="${node.name}" data-node="${node.id}">

      <label>Tipo Splitter</label>
      <select class="node-ratio-select" data-node="${node.id}">
        ${[2,4,8,16,32,64].map(v => `<option value="${v}" ${node.ratio===v?'selected':''}>1:${v}</option>`).join('')}
      </select>

      <label>Estado de Puertos</label>
      <div class="ports-grid" id="ports-${node.id}"></div>

      <label>Conectar en puerto disponible:</label>
      <div class="connection-opts">
        <select class="port-select" data-node="${node.id}" style="flex:1;min-width:120px">
          <option value="">Seleccionar...</option>
        </select>
        <button class="btn-min connect-split" data-node="${node.id}" style="background:#e0f2fe;color:#0369a1;border-color:#7dd3fc">+ Split</button>
        <button class="btn-min connect-nap" data-node="${node.id}" style="background:#fef3c7;color:#92400e;border-color:#fcd34d">+ NAP</button>
      </div>
    ` : `
      <label>Nombre</label>
      <input class="node-name-input" value="${node.name}" data-node="${node.id}">

      <label>ONTs en NAP</label>
      <select class="node-ratio-select" data-node="${node.id}">
        ${[2,4,8,16,32,64].map(v => `<option value="${v}" ${node.ratio===v?'selected':''}>${v} ONTs</option>`).join('')}
      </select>
    `}

    <button class="btn-min delete-node-btn" style="margin-top:8px;width:100%;background:#fee;color:#c00;border-color:#fcc" data-node="${node.id}">🗑️ Eliminar</button>
  `;
  container.appendChild(nodeDiv);

  const nameInput = nodeDiv.querySelector('.node-name-input');
  nameInput.onchange = () => { node.name = nameInput.value.trim(); renderPON(ponIndex); };

  const ratioSelect = nodeDiv.querySelector('.node-ratio-select');
  ratioSelect.onchange = () => {
    const newRatio = +ratioSelect.value;
    node.ratio = newRatio;
    if (node.type === 'splitter') {
      const oldConn = { ...node.ports };
      node.ports = {};
      for (let i = 1; i <= newRatio; i++) node.ports[i] = oldConn[i] || { used: false, connection: null };
    }
    renderPON(ponIndex);
    generateAll();
  };

  nodeDiv.querySelector('.delete-node-btn').onclick = () => { deleteNode(ponIndex, node.id); };

  if (node.type === 'splitter') {
    updatePortsDisplay(ponIndex, node);

    const portSelect = nodeDiv.querySelector('.port-select');
    const connectSplit = nodeDiv.querySelector('.connect-split');
    const connectNap = nodeDiv.querySelector('.connect-nap');

    connectSplit.onclick = () => {
      const port = +portSelect.value;
      if (!port) return alert('Selecciona un puerto disponible');
      addNode(ponIndex, node.id, port, { type: 'splitter', ratio: 2, name: `Split P${port}` });
      renderPON(ponIndex);
      generateAll();
    };
    connectNap.onclick = () => {
      const port = +portSelect.value;
      if (!port) return alert('Selecciona un puerto disponible');
      addNode(ponIndex, node.id, port, { type: 'nap', ratio: 8, name: `NAP P${port}` });
      renderPON(ponIndex);
      generateAll();
    };

    const children = ponConfigs[ponIndex].nodes.filter(n => n.parentId === node.id);
    children.forEach(child => renderNodeTree(ponIndex, child, container, depth + 1));
  }
}

function updatePortsDisplay(ponIndex, node) {
  const portsDiv = document.getElementById(`ports-${node.id}`);
  const portSelect = document.querySelector(`.port-select[data-node="${node.id}"]`);
  if (!portsDiv || !portSelect) return;

  portsDiv.innerHTML = '';
  portSelect.innerHTML = '<option value="">Seleccionar...</option>';

  for (let i = 1; i <= node.ratio; i++) {
    const port = node.ports[i];
    const portSlot = document.createElement('div');
    portSlot.className = 'port-slot ' + (port.used ? 'used' : 'available');
    portSlot.innerHTML = `<div class="port-num">P${i}</div><div style="font-size:9px">${port.used ? '🟢 Usado' : '🔴 Libre'}</div>`;
    portsDiv.appendChild(portSlot);

    if (!port.used) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `Puerto ${i}`;
      portSelect.appendChild(opt);
    }
  }
}

// ======== MUTACIONES DE ESTADO =========
function addNode(ponIndex, parentId, parentPort, config) {
  const nodeId = nextNodeId++;
  const node = {
    id: nodeId,
    parentId,
    parentPort,
    type: config.type || 'splitter',
    ratio: config.ratio || 2,
    name: config.name || `Nodo ${nodeId}`,
    ports: {}
  };
  if (node.type === 'splitter') {
    for (let i = 1; i <= node.ratio; i++) node.ports[i] = { used: false, connection: null };
  }
  ponConfigs[ponIndex].nodes.push(node);

  if (parentId !== null) {
    const parent = ponConfigs[ponIndex].nodes.find(n => n.id === parentId);
    if (parent && parent.ports[parentPort]) {
      parent.ports[parentPort].used = true;
      parent.ports[parentPort].connection = nodeId;
    }
  }
  return nodeId;
}

function deleteNode(ponIndex, nodeId) {
  const node = ponConfigs[ponIndex].nodes.find(n => n.id === nodeId);
  if (!node) return;

  if (node.parentId !== null) {
    const parent = ponConfigs[ponIndex].nodes.find(n => n.id === node.parentId);
    if (parent?.ports[node.parentPort]) {
      parent.ports[node.parentPort].used = false;
      parent.ports[node.parentPort].connection = null;
    }
  }

  const toDelete = [nodeId];
  for (let i = 0; i < toDelete.length; i++) {
    const children = ponConfigs[ponIndex].nodes.filter(n => n.parentId === toDelete[i]);
    toDelete.push(...children.map(n => n.id));
  }
  ponConfigs[ponIndex].nodes = ponConfigs[ponIndex].nodes.filter(n => !toDelete.includes(n.id));
  renderPON(ponIndex);
  generateAll();
}

// ======== GENERACIÓN COMPLETA (todas las PON) =========
function generateAll() {
  const puertos = Math.max(1, Math.min(8, +val('puertos')));
  const txPower = +val('txPower');
  const capNAP = +val('capNAP');

  const showPowerLabels = document.getElementById('showPowerLabels').checked;
  const showPortNumbers = document.getElementById('showPortNumbers').checked;
  const showUnusedPorts = document.getElementById('showUnusedPorts').checked;

  svg.innerHTML = '';
  lossBody.innerHTML = '';
  connections = {}; // se vuelven a registrar con cada render

  const padX = 250;
  const laneH = 400;
  const xOLT = 90;
  const xHub = xOLT + 120;

  // tamaño dinámico
  let maxDepth = 0;
  for (let p = 0; p < puertos; p++) {
    if (ponConfigs[p]) {
      ponConfigs[p].nodes.forEach(n => {
        const d = getNodeDepth(ponConfigs[p].nodes, n.id);
        maxDepth = Math.max(maxDepth, d);
      });
    }
  }
  const width = Math.max(2000, xHub + padX * (maxDepth + 2) + 400);
  const height = Math.max(800, laneH * puertos + 80);
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);

  // OLT
  const oltH = Math.max(120, puertos * 40 + 40);
  const oltY = (height - oltH) / 2;
  svg.insertAdjacentHTML('beforeend',
    `<rect x="${xOLT - 70}" y="${oltY}" width="110" height="${oltH}" rx="14" fill="var(--olt)"/>
     <text x="${xOLT - 70 + 55}" y="${oltY + oltH / 2 + 4}" fill="#fff" text-anchor="middle" font-size="11">OLT</text>`);

  // render por PON
  for (let p = 0; p < puertos; p++) {
    const laneTop = 40 + p * laneH;
    const laneMid = laneTop + laneH / 2;
    const pinY = oltY + 30 + p * ((oltH - 60) / Math.max(1, puertos - 1));

    // línea OLT → hub
    svg.insertAdjacentHTML('beforeend', `<circle cx="${xOLT + 40}" cy="${pinY}" r="4" fill="#fff" stroke="#0b3d63" stroke-width="2"/>`);
    svg.insertAdjacentHTML('beforeend', `<line x1="${xOLT + 40}" y1="${pinY}" x2="${xHub - 18}" y2="${laneMid}" stroke="var(--line)" stroke-width="2.5"/>`);

    // Si no hay nodos en este PON, solo mostramos el hub
    svg.insertAdjacentHTML('beforeend',
      `<rect x="${xHub - 36}" y="${laneMid - 12}" width="60" height="24" rx="6" fill="var(--hub)"/>
       <text x="${xHub - 6}" y="${laneMid + 4}" fill="#fff" text-anchor="middle" font-size="10">PON${p + 1}</text>`);

    if (!ponConfigs[p] || ponConfigs[p].nodes.length === 0) continue;

    // Layout base (se ajusta más abajo con nodePositions si aplica)
    const layout = computeLayout(ponConfigs[p].nodes, nodePositions, { startX: xHub + 24, laneTop, padX });

    // callback para registrar referencias de líneas de cada nodo (drag)
    const onNodeGroupReady = (node, group, connRefs) => {
      const key = `pon${p}-node${node.id}`;
      connections[key] = connRefs;
      // si hay posición custom, aplicarla
      if (nodePositions[key]) {
        const { x, y } = nodePositions[key];
        group.setAttribute('transform', `translate(${x},${y})`);
      }
    };

    // callback para tabla de pérdidas
    const addLossRow = (ponNum, path, power, percent, level) => {
      const tr = document.createElement('tr');
      const color = power < MIN_POWER ? '#dc2626' : (power < -20 ? '#f59e0b' : '#16a34a');
      tr.innerHTML = `
        <td><b>PON${ponNum}</b></td>
        <td style="font-size:9px">${path}</td>
        <td style="color:${color}"><b>${power.toFixed(2)}</b></td>
        <td><b>${percent}%</b></td>
        <td><b>N${level}</b></td>
      `;
      lossBody.appendChild(tr);
    };

    // Render PON p
    renderSVG({
      svg,
      ponIndex: p,
      tree: ponConfigs[p].nodes,
      positions: layout,
      opts: {
        startX: xHub + 24,
        laneMid,
        hubX: xHub,
        oltX: xOLT,
        txPower,
        capNAP,
        showPowerLabels,
        showPortNumbers,
        showUnusedPorts
      },
      onNodeGroupReady,
      addLossRow
    });
  }

  // Resumen y validación
  const { totalONTs, totalNAPs, totalSplitters, totalPorts, usedPorts } = summarize(ponConfigs, capNAP);
  const utilPorts = totalPorts > 0 ? Math.round((usedPorts / totalPorts) * 100) : 0;
  const lim = +val('limitePON') || MAX_ONTS_PER_PON_DEFAULT;
  const { perPon, okGlobal } = validateOntsPerPon(ponConfigs, lim);

  // Mostrar advertencia si cualquier PON supera el límite
  const firstBad = perPon.find(v => v > lim);
  warn.style.display = firstBad ? 'block' : 'none';
  if (firstBad) {
    const badIndex = perPon.findIndex(v => v > lim) + 1;
    warn.textContent = `⚠️ PON${badIndex} excede ${lim} ONTs (actual: ${firstBad}).`;
  }

  summaryGrid.innerHTML = `
    <div>ONTs totales:</div><div><b>${totalONTs}</b></div>
    <div>NAPs totales:</div><div><b>${totalNAPs}</b></div>
    <div>Splitters:</div><div><b>${totalSplitters}</b></div>
    <div>Puertos totales:</div><div><b>${totalPorts}</b></div>
    <div>Puertos usados:</div><div><b>${usedPorts}</b> (${utilPorts}%)</div>
    <div>Puertos libres:</div><div><b style="color:#dc2626">${totalPorts - usedPorts}</b></div>
    <div style="border-top:1px dashed #d1d5db;padding-top:6px"></div><div style="border-top:1px dashed #d1d5db;padding-top:6px"></div>
    <div>PONs activos:</div><div><b>${Math.max(puertos, Object.keys(ponConfigs).length)}</b></div>
    <div>ONTs/PON:</div><div><b>${perPon.join(' | ') || 0}</b></div>
  `;
}

// ======== UTILS =========
function val(id) {
  return document.getElementById(id).value;
}
