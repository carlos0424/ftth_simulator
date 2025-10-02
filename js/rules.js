// rules.js
// Reglas de negocio (capacidad, conteos, validaciones simples)

export const MAX_ONTS_PER_PON_DEFAULT = 128;

/**
 * Cuenta elementos globales.
 * Devuelve { totalONTs, totalNAPs, totalSplitters, totalPorts, usedPorts }
 */
export function summarize(ponConfigs, capNAP = 8) {
  let totalONTs = 0, totalNAPs = 0, totalSplitters = 0, totalPorts = 0, usedPorts = 0;

  Object.values(ponConfigs).forEach(cfg => {
    (cfg?.nodes || []).forEach(n => {
      if (n.type === 'splitter') {
        totalSplitters++;
        totalPorts += n.ratio;
        usedPorts += Object.values(n.ports || {}).filter(p => p.used).length;
      } else {
        // NAP: usamos ratio como cantidad de ONTs "dist"
        totalONTs += n.ratio;
        totalNAPs += Math.ceil(n.ratio / capNAP);
      }
    });
  });

  return { totalONTs, totalNAPs, totalSplitters, totalPorts, usedPorts };
}

/**
 * Valida límite de ONTs por PON de manera individual.
 * Devuelve { perPon: number[], limit, okGlobal:boolean }
 */
export function validateOntsPerPon(ponConfigs, limit = MAX_ONTS_PER_PON_DEFAULT) {
  const perPon = [];
  let okGlobal = true;

  Object.keys(ponConfigs).forEach(ponIdx => {
    const cfg = ponConfigs[ponIdx];
    let count = 0;
    (cfg?.nodes || []).forEach(n => {
      if (n.type !== 'splitter') count += n.ratio;
    });
    perPon[ponIdx] = count;
    if (count > limit) okGlobal = false;
  });

  return { perPon, limit, okGlobal };
}
