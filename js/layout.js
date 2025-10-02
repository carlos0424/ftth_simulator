// layout.js
// Calcula posiciones (x,y) para cada nodo de un PON en función de su profundidad.
// Respeta posiciones personalizadas si existen en nodePositions por PON:
// clave: "pon{ponIndex}-node{nodeId}"

export function getNodeDepth(tree, nodeId) {
  const n = tree.find(x => x.id === nodeId);
  if (!n || n.parentId == null) return 0;
  return 1 + getNodeDepth(tree, n.parentId);
}

/**
 * Devuelve un Map nodeId -> {x,y,depth}
 * @param {number} ponIndex                Índice del PON (para namespacing)
 * @param {Array}  tree                    Nodos del PON
 * @param {Object} nodePositions           { "pon{i}-node{id}": {x,y} } (opcional)
 * @param {Object} opts                    { startX, laneTop, padX }
 */
export function computeLayout(ponIndex, tree, nodePositions = {}, opts = {}) {
  const startX = opts.startX ?? 250;
  const laneTop = opts.laneTop ?? 40;
  const padX = opts.padX ?? 250;

  // hijos agrupados por padre
  const childrenByParent = new Map();
  tree.forEach(n => {
    if (n.parentId != null) {
      const list = childrenByParent.get(n.parentId) || [];
      list.push(n);
      childrenByParent.set(n.parentId, list);
    }
  });

  let yCursor = laneTop + 60;
  const positions = new Map();

  // raíces
  const roots = tree.filter(n => n.parentId == null);
  roots.forEach(root => placeSubtree(root));

  return positions;

  function placeSubtree(node, depth = getNodeDepth(tree, node.id)) {
    const key = `pon${ponIndex}-node${node.id}`;
    const custom = nodePositions[key];

    if (custom && Number.isFinite(custom.x) && Number.isFinite(custom.y)) {
      positions.set(node.id, { x: custom.x, y: custom.y, depth });
    } else {
      const x = startX + depth * padX;
      const y = yCursor;
      positions.set(node.id, { x, y, depth });
      yCursor += 80;
    }

    const kids = childrenByParent.get(node.id) || [];
    kids.forEach(k => placeSubtree(k, depth + 1));
  }
}
