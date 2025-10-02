// layout.js
// Calcula posiciones (x,y) para cada nodo de un PON en función de su profundidad.
// Respeta posiciones personalizadas si existen en nodePositions.

export function getNodeDepth(tree, nodeId) {
  const n = tree.find(x => x.id === nodeId);
  if (!n || n.parentId == null) return 0;
  return 1 + getNodeDepth(tree, n.parentId);
}

/**
 * Devuelve un Map nodeId -> {x,y,depth}
 * @param {Array} tree           Nodos del PON
 * @param {Object} nodePositions Posiciones personalizadas { "pon{i}-node{id}": {x,y} } (opcional)
 * @param {Object} opts          { startX, laneTop, padX }
 */
export function computeLayout(tree, nodePositions = {}, opts = {}) {
  const startX = opts.startX ?? 250;
  const laneTop = opts.laneTop ?? 40;
  const padX = opts.padX ?? 250;

  // agrupamos hijos
  const childrenByParent = new Map();
  tree.forEach(n => {
    if (n.parentId != null) {
      const list = childrenByParent.get(n.parentId) || [];
      list.push(n);
      childrenByParent.set(n.parentId, list);
    }
  });

  // orden de y: vamos “reservando” slots verticales
  let yCursor = laneTop + 60;
  const positions = new Map();

  // raíces
  const roots = tree.filter(n => n.parentId == null);
  roots.forEach(root => placeSubtree(root));

  return positions;

  function placeSubtree(node, depth = getNodeDepth(tree, node.id)) {
    const key = `node${node.id}`; // clave local (nodePositions viene con prefijo de PON, el caller ajusta)
    // si hay posición personalizada, no la recalculamos
    const hasCustom = Object.values(nodePositions).some(p => p && typeof p.x === 'number');
    if (!hasCustom) {
      const x = startX + depth * padX;
      const y = yCursor;
      positions.set(node.id, { x, y, depth });
      yCursor += 80;
    } else {
      // el caller actualizará luego usando nodePositions reales
      const x = startX + depth * padX;
      const y = yCursor;
      positions.set(node.id, { x, y, depth });
      yCursor += 80;
    }

    const kids = childrenByParent.get(node.id) || [];
    kids.forEach(k => placeSubtree(k, depth + 1));
  }
}
