// rules.js
// Reglas de negocio (capacidad, conteos, validaciones según teoría GPON)

export const MAX_ONTS_PER_PON_DEFAULT = 128;
export const MAX_SPLIT_DEPTH = 3; // Máximo 3 niveles de spliteo según teoría GPON

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
        totalONTs += n.ratio;
        totalNAPs += Math.ceil(n.ratio / capNAP);
      }
    });
  });

  return { totalONTs, totalNAPs, totalSplitters, totalPorts, usedPorts };
}

export function validateOntsPerPon(ponConfigs, limitONTs = MAX_ONTS_PER_PON_DEFAULT) {
  const perPon = [];
  const perDepth = [];
  let okGlobal = true;

  Object.keys(ponConfigs).forEach(ponIdx => {
    const cfg = ponConfigs[ponIdx];
    let countONTs = 0;

    (cfg?.nodes || []).forEach(n => {
      if (n.type !== 'splitter') countONTs += n.ratio;
    });

    const maxDepth = countDepth(cfg?.nodes || []);
    perPon[ponIdx] = countONTs;
    perDepth[ponIdx] = maxDepth;

    if (countONTs > limitONTs) {
      okGlobal = false;
    }
  });

  return { perPon, perDepth, limitONTs, okGlobal };
}

export function validateSplitDepth(ponConfigs, limit = MAX_SPLIT_DEPTH) {
  const violations = [];
  
  Object.keys(ponConfigs).forEach(ponIdx => {
    const cfg = ponConfigs[ponIdx];
    const maxDepth = countDepth(cfg?.nodes || []);
    
    if (maxDepth > limit) {
      violations.push({
        ponIndex: parseInt(ponIdx),
        maxDepth,
        limit
      });
    }
  });
  
  return {
    ok: violations.length === 0,
    violations
  };
}

function countDepth(nodes) {
  if (!nodes || nodes.length === 0) return 0;
  
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

  const roots = nodes.filter(n => n.parentId == null);
  if (roots.length === 0) return 0;
  
  let max = 0;
  roots.forEach(r => { max = Math.max(max, depth(r.id)); });
  return max;
}