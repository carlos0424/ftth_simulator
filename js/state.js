// state.js
// Estado global y mutaciones centralizadas

// ======== ESTADO =========
export let currentPON = 0;
export const ponConfigs = {}; // { [ponIndex]: { nodes: Node[] } }
export let nextNodeId = 0;

// Drag / render
export const nodePositions = {};   // key "pon{i}-node{id}" -> {x,y}
export const connectionLines = {}; // referencias a líneas y labels (rellenado por renderer)

// ======== HELPERS =========
export function ensurePon(i) {
  if (!ponConfigs[i]) ponConfigs[i] = { nodes: [] };
}

/** Reinicia todo el estado global */
export function resetState() {
  currentPON = 0;
  nextNodeId = 0;
  for (const key in ponConfigs) delete ponConfigs[key];
  for (const key in nodePositions) delete nodePositions[key];
  for (const key in connectionLines) delete connectionLines[key];
}

/** Devuelve un snapshot profundo del estado (para debug/export) */
export function cloneState() {
  return JSON.parse(JSON.stringify({
    currentPON,
    nextNodeId,
    ponConfigs
  }));
}

// ======== MUTACIONES =========
export function addNode(ponIndex, parentId, parentPort, config) {
  ensurePon(ponIndex);
  const nodeId = nextNodeId++;
  const node = {
    id: nodeId,
    parentId,
    parentPort,
    type: config.type || 'splitter', // 'splitter' | 'nap'
    ratio: config.ratio || 2,
    name: config.name || `Nodo ${nodeId}`,
    ports: {}
  };

  // Si es splitter, inicializar puertos
  if (node.type === 'splitter') {
    for (let i = 1; i <= node.ratio; i++) {
      node.ports[i] = { used: false, connection: null };
    }
  }

  ponConfigs[ponIndex].nodes.push(node);

  // Marcar puerto del padre como usado
  if (parentId !== null) {
    const parent = ponConfigs[ponIndex].nodes.find(n => n.id === parentId);
    if (parent && parent.ports[parentPort]) {
      parent.ports[parentPort].used = true;
      parent.ports[parentPort].connection = nodeId;
    }
  }
  return nodeId;
}

export function deleteNode(ponIndex, nodeId) {
  const node = ponConfigs[ponIndex].nodes.find(n => n.id === nodeId);
  if (!node) return;

  // Liberar puerto en el padre
  if (node.parentId !== null) {
    const parent = ponConfigs[ponIndex].nodes.find(n => n.id === node.parentId);
    if (parent && parent.ports[node.parentPort]) {
      parent.ports[node.parentPort].used = false;
      parent.ports[node.parentPort].connection = null;
    }
  }

  // Borrar nodo y sus hijos
  const toDelete = [nodeId];
  for (let i = 0; i < toDelete.length; i++) {
    const children = ponConfigs[ponIndex].nodes.filter(n => n.parentId === toDelete[i]);
    toDelete.push(...children.map(n => n.id));
  }
  ponConfigs[ponIndex].nodes = ponConfigs[ponIndex].nodes.filter(n => !toDelete.includes(n.id));

  // Limpiar referencias en posiciones y conexiones
  Object.keys(nodePositions).forEach(k => {
    if (toDelete.some(id => k.endsWith(`node${id}`))) delete nodePositions[k];
  });
  Object.keys(connectionLines).forEach(k => {
    if (toDelete.some(id => k.endsWith(`node${id}`))) delete connectionLines[k];
  });
}

export function setNodeRatio(ponIndex, nodeId, newRatio) {
  const node = ponConfigs[ponIndex].nodes.find(n => n.id === nodeId);
  if (!node) return;

  node.ratio = newRatio;
  if (node.type === 'splitter') {
    const old = { ...node.ports };
    node.ports = {};
    for (let i = 1; i <= newRatio; i++) {
      node.ports[i] = old[i] || { used: false, connection: null };
    }
  }
}

export function getNodeDepth(ponIndex, nodeId) {
  const nodes = ponConfigs[ponIndex].nodes;
  const node = nodes.find(n => n.id === nodeId);
  if (!node || node.parentId === null) return 0;
  return 1 + getNodeDepth(ponIndex, node.parentId);
}
