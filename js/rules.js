// rules.js
// Reglas de negocio (capacidad, conteos, validaciones simples)

export const MAX_ONTS_PER_PON_DEFAULT = 128;
export const MAX_SPLIT_DEPTH_DEFAULT = 3;

/**
 * Cuenta elementos globales.
 * Devuelve { totalONTs, totalNAPs, totalSplitters, totalPorts, usedPorts }
 */
export function summarize(ponConfigs, capNAP = 8) {
  let totalONTs = 0,
      totalNAPs = 0,
      totalSplitters = 0,
      totalPorts = 0,
      usedPorts = 0;

  Object.values(ponConfigs).forEach(cfg => {
    (cfg?.nodes || []).forEach(n => {
      if (n.type === 'splitter') {
        totalSplitters++;
        totalPorts += n.ratio;
        usedPorts += Object.values(n.ports || {}).filter(p => p.used).length;
      } else {
        // NAP: usamos ratio como cantidad de ONTs
        totalONTs += n.ratio;
        totalNAPs += Math.ceil(n.ratio / capNAP);
      }
    });
  });

  return { totalONTs, totalNAPs, totalSplitters, totalPorts, usedPorts };
}

/**
 * Valida límite de ONTs y niveles por PON.
 * Devuelve:
 * {
 *   perPon: number[],        // cantidad de ONTs por PON
 *   perDepth: number[],      // profundidad máxima encontrada en cada PON
 *   limitONTs,               // límite de ONTs
 *   limitDepth,              // límite de profundidad
 *   okGlobal: boolean
 * }
 */
export function validateOntsPerPon(
  ponConfigs,
  limitONTs = MAX_ONTS_PER_PON_DEFAULT,
  limitDepth = MAX_SPLIT_DEPTH_DEFAULT
) {
  const perPon = [];
  const perDepth = [];
  let okGlobal = true;

  Object.keys(ponConfigs).forEach(ponIdx => {
    const cfg = ponConfigs[ponIdx];
    let countONTs = 0;

    (cfg?.nodes || []).forEach(n => {
      if (n.type !== 'splitter') countONTs += n.ratio;
    });

    // calcular profundidad máxima del PON
    const maxDepth = countDepth(cfg?.nodes || []);
    perPon[ponIdx] = countONTs;
    perDepth[ponIdx] = maxDepth;

    if (countONTs > limitONTs || maxDepth > limitDepth) {
      okGlobal = false;
    }
  });

  return { perPon, perDepth, limitONTs, limitDepth, okGlobal };
}

/**
 * Calcula la profundidad máxima de un conjunto de nodos
 */
function countDepth(nodes) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const childrenByParent = new Map();
  nodes.forEach(n => {
    if (n.parentId != null) {
      const arr = childrenByParent.get(n.parentId) || [];
      arr.push(n);
      childrenByParent.set(n.parentId, arr);
    }
  });

  function depth(nodeId) {
    const kids = childrenByParent.get(nodeId) || [];
    if (kids.length === 0) return 1;
    return 1 + Math.max(...kids.map(k => depth(k.id)));
  }

  // buscar raíces
  const roots = nodes.filter(n => n.parentId == null);
  let max = 0;
  roots.forEach(r => { max = Math.max(max, depth(r.id)); });
  return max;
}
