import { currentPON, ponConfigs, addNode, deleteNode, setNodeRatio } from './state.js';
import { $ } from './utils.js';

let _onGenerate = null;
let _onSwitchPon = null;

export function bindUI({onGenerate, onSwitchPon, onExportSVG, onExportPNG, onToggleSidebar, onToggleDrag, onResetPositions}){
  _onGenerate = onGenerate; _onSwitchPon = onSwitchPon;

  $('#toggleFab').onclick = onToggleSidebar;
  $('#puertos').addEventListener('change', initPONs);
  $('#generate').onclick = onGenerate;
  $('#expSVG').onclick = onExportSVG;
  $('#expPNG').onclick = onExportPNG;

  ['limitePON','capNAP','txPower','showPowerLabels','showPortNumbers','showUnusedPorts']
    .forEach(id=> document.getElementById(id).addEventListener('change', onGenerate));

  document.getElementById('enableDragging').addEventListener('change', onToggleDrag);
  document.getElementById('resetPositions').addEventListener('click', onResetPositions);
}

export function initPONs(){
  const numPON = Math.max(1, Math.min(8, +document.getElementById('puertos').value));
  const tabs = $('#ponTabs'); const contents = $('#ponContents');
  tabs.innerHTML = ''; contents.innerHTML = '';

  for(let i=0; i<numPON; i++){
    if(!ponConfigs[i]) ponConfigs[i] = {nodes:[]};

    const tab = document.createElement('button');
    tab.className = 'pon-tab' + (i===currentPON ? ' active' : '');
    tab.textContent = `PON ${i+1}`;
    tab.onclick = ()=> _onSwitchPon(i);
    tabs.appendChild(tab);

    const content = document.createElement('div');
    content.className = 'pon-content' + (i===currentPON ? ' active':'');
    content.dataset.pon = i;
    content.innerHTML = `
      <div style="margin-top:12px">
        <button class="btn-min add-root-btn" data-pon="${i}">➕ Agregar Splitter Raíz</button>
      </div>
      <div class="node-tree" data-pon="${i}"></div>`;
    contents.appendChild(content);

    content.querySelector('.add-root-btn').onclick = ()=>{
      addNode(i, null, 0, {type:'splitter', ratio:2, name:'Nuevo Splitter'});
      renderPON(i); _onGenerate();
    };
  }
  renderAllPONs();
}

export function switchPonUI(ponIndex){
  document.querySelectorAll('.pon-tab').forEach((tab,i)=> tab.classList.toggle('active', i===ponIndex));
  document.querySelectorAll('.pon-content').forEach((div,i)=> div.classList.toggle('active', i===ponIndex));
}

export function renderAllPONs(){
  Object.keys(ponConfigs).forEach(i=> renderPON(+i));
}

export function renderPON(ponIndex){
  const container = document.querySelector(`.node-tree[data-pon="${ponIndex}"]`);
  if(!container) return;
  container.innerHTML = '';
  const roots = ponConfigs[ponIndex].nodes.filter(n=>n.parentId===null);
  roots.forEach(root=> renderNodeTree(ponIndex, root, container, 0));
}

function renderNodeTree(ponIndex, node, container, depth){
  const nodeDiv = document.createElement('div');
  nodeDiv.className = 'node-item' + (depth>0?' child':'');
  nodeDiv.innerHTML = `
    <div class="node-header">
      <span class="node-title">${node.name}</span>
      <span class="node-badge">${node.type==='splitter'?'SPLIT':'NAP'} 1:${node.ratio}</span>
    </div>
    ${node.type==='splitter'?`
      <label>Nombre</label>
      <input class="node-name-input" value="${node.name}" data-node="${node.id}">
      <label>Tipo Splitter</label>
      <select class="node-ratio-select" data-node="${node.id}">
        ${[2,4,8,16,32,64].map(r=>`<option value="${r}" ${node.ratio===r?'selected':''}>1:${r}</option>`).join('')}
      </select>
      <label>Estado de Puertos</label>
      <div class="ports-grid" id="ports-${node.id}"></div>
      <label>Conectar en puerto disponible:</label>
      <div class="connection-opts">
        <select class="port-select" data-node="${node.id}" style="flex:1;min-width:120px"><option value="">Seleccionar...</option></select>
        <button class="btn-min connect-split" data-node="${node.id}" style="background:#e0f2fe;color:#0369a1;border-color:#7dd3fc">+ Split</button>
        <button class="btn-min connect-nap" data-node="${node.id}" style="background:#fef3c7;color:#92400e;border-color:#fcd34d">+ NAP</button>
      </div>`:`
      <label>Nombre</label>
      <input class="node-name-input" value="${node.name}" data-node="${node.id}">
      <label>ONTs en NAP</label>
      <select class="node-ratio-select" data-node="${node.id}">
        ${[2,4,8,16,32,64].map(r=>`<option value="${r}" ${node.ratio===r?'selected':''}>${r} ONTs</option>`).join('')}
      </select>`}
    <button class="btn-min delete-node-btn" style="margin-top:8px;width:100%;background:#fee;color:#c00;border-color:#fcc" data-node="${node.id}">🗑️ Eliminar</button>
  `;
  container.appendChild(nodeDiv);

  // Nombre
  nodeDiv.querySelector('.node-name-input').onchange = (e)=>{
    node.name = e.target.value.trim();
    renderPON(ponIndex);
  };

  // Ratio
  nodeDiv.querySelector('.node-ratio-select').onchange = (e)=>{
    setNodeRatio(ponIndex, node.id, +e.target.value);
    renderPON(ponIndex); _onGenerate();
  };

  // Eliminar
  nodeDiv.querySelector('.delete-node-btn').onclick = ()=>{
    deleteNode(ponIndex, node.id);
    renderPON(ponIndex); _onGenerate();
  };

  // Si es splitter: puertos y botones
  if(node.type==='splitter'){
    updatePortsDisplay(ponIndex, node);

    const portSelect = nodeDiv.querySelector('.port-select');
    nodeDiv.querySelector('.connect-split').onclick = ()=>{
      const port = +portSelect.value; if(!port) return alert('Selecciona un puerto disponible');
      addNode(ponIndex, node.id, port, {type:'splitter', ratio:2, name:`Split P${port}`});
      renderPON(ponIndex); _onGenerate();
    };
    nodeDiv.querySelector('.connect-nap').onclick = ()=>{
      const port = +portSelect.value; if(!port) return alert('Selecciona un puerto disponible');
      addNode(ponIndex, node.id, port, {type:'nap', ratio:8, name:`NAP P${port}`});
      renderPON(ponIndex); _onGenerate();
    };

    const children = ponConfigs[ponIndex].nodes.filter(n=>n.parentId===node.id);
    children.forEach(child=> renderNodeTree(ponIndex, child, container, depth+1));
  }
}

function updatePortsDisplay(ponIndex, node){
  const portsDiv = document.getElementById(`ports-${node.id}`);
  const portSelect = document.querySelector(`.port-select[data-node="${node.id}"]`);
  if(!portsDiv || !portSelect) return;

  portsDiv.innerHTML = '';
  portSelect.innerHTML = '<option value="">Seleccionar...</option>';

  for(let i=1; i<=node.ratio; i++){
    const port = node.ports[i];
    const slot = document.createElement('div');
    slot.className = 'port-slot ' + (port.used?'used':'available');
    slot.innerHTML = `<div class="port-num">P${i}</div><div style="font-size:9px">${port.used?'🟢 Usado':'🔴 Libre'}</div>`;
    portsDiv.appendChild(slot);
    if(!port.used){
      const opt = document.createElement('option');
      opt.value = i; opt.textContent = `Puerto ${i}`;
      portSelect.appendChild(opt);
    }
  }
}
