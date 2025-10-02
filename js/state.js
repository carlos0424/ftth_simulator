// Estado global y mutaciones
export let currentPON = 0;
export const ponConfigs = {}; // { [ponIndex]: { nodes: Node[] } }
export let nextNodeId = 0;

// Drag/pintura
export const nodePositions = {};     // key "pon{i}-node{id}" -> {x,y}
export const connectionLines = {};   // referencias a líneas y labels por nodo (renderer las llena)

export function ensurePon(i){
  if(!ponConfigs[i]) ponConfigs[i] = {nodes:[]};
}

export function addNode(ponIndex, parentId, parentPort, config){
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
  if(node.type === 'splitter'){
    for(let i=1; i<=node.ratio; i++){
      node.ports[i] = {used:false, connection:null};
    }
  }
  ponConfigs[ponIndex].nodes.push(node);

  if(parentId !== null){
    const parent = ponConfigs[ponIndex].nodes.find(n=>n.id===parentId);
    if(parent && parent.ports[parentPort]){
      parent.ports[parentPort].used = true;
      parent.ports[parentPort].connection = nodeId;
    }
  }
  return nodeId;
}

export function deleteNode(ponIndex, nodeId){
  const node = ponConfigs[ponIndex].nodes.find(n=>n.id===nodeId);
  if(!node) return;

  if(node.parentId !== null){
    const parent = ponConfigs[ponIndex].nodes.find(n=>n.id===node.parentId);
    if(parent && parent.ports[node.parentPort]){
      parent.ports[node.parentPort].used = false;
      parent.ports[node.parentPort].connection = null;
    }
  }

  const toDelete = [nodeId];
  for(let i=0; i<toDelete.length; i++){
    const children = ponConfigs[ponIndex].nodes.filter(n=>n.parentId===toDelete[i]);
    toDelete.push(...children.map(n=>n.id));
  }
  ponConfigs[ponIndex].nodes = ponConfigs[ponIndex].nodes.filter(n=>!toDelete.includes(n.id));
}

export function setNodeRatio(ponIndex, nodeId, newRatio){
  const node = ponConfigs[ponIndex].nodes.find(n=>n.id===nodeId);
  if(!node) return;
  node.ratio = newRatio;
  if(node.type==='splitter'){
    const old = {...node.ports};
    node.ports = {};
    for(let i=1;i<=newRatio;i++){
      node.ports[i] = old[i] || {used:false, connection:null};
    }
  }
}

export function getNodeDepth(ponIndex, nodeId){
  const nodes = ponConfigs[ponIndex].nodes;
  const node = nodes.find(n=>n.id===nodeId);
  if(!node || node.parentId===null) return 0;
  return 1 + getNodeDepth(ponIndex, node.parentId);
}
