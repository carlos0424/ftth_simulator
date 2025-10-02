// calc-loss.js
// Cálculo de pérdidas ópticas y utilidades de potencia en dBm.

// Pérdida típica de cada tipo de splitter (valores promedio ITU-T G.671, dB)
export const SPLITTER_LOSS_MAP = { 
  2: 3.5, 
  4: 7.0, 
  8: 10.5, 
  16: 13.5, 
  32: 16.5, 
  64: 19.0 
};

// Pérdidas típicas adicionales
export const SPLICE_LOSS = 0.1;      // dB por empalme
export const CONNECTOR_LOSS = 0.3;   // dB por conector

// Rango de operación (valores típicos GPON/EPON en dBm)
export const MIN_POWER = -28;   // Sensibilidad mínima ONT
export const MAX_POWER = 3;     // Potencia máxima OLT

/**
 * Devuelve la pérdida típica de un splitter según su ratio.
 * Si el ratio no existe en la tabla, aproxima usando log2.
 */
export function splitterLoss(ratio) {
  if (SPLITTER_LOSS_MAP[ratio]) return SPLITTER_LOSS_MAP[ratio];

  // Si no está en el mapa, aproximamos: pérdida ~ 3.5 * log2(ratio)
  const approx = 3.5 * Math.log2(ratio);
  return Math.round(approx * 10) / 10; // redondeo a 0.1 dB
}

/**
 * Convierte un valor de potencia (dBm) a porcentaje relativo dentro del rango permitido.
 */
export function toPercent(powerDBm) {
  const percent = ((powerDBm - MIN_POWER) / (MAX_POWER - MIN_POWER)) * 100;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

/**
 * Calcula la pérdida total de un tramo óptico.
 * @param {Array} splitters - lista de ratios (ej: [2, 4, 8])
 * @param {number} splices - cantidad de empalmes
 * @param {number} connectors - cantidad de conectores
 * @returns {number} pérdida total en dB
 */
export function totalLoss({ splitters = [], splices = 0, connectors = 0 } = {}) {
  let loss = 0;
  splitters.forEach(r => loss += splitterLoss(r));
  loss += splices * SPLICE_LOSS;
  loss += connectors * CONNECTOR_LOSS;
  return Math.round(loss * 100) / 100; // 2 decimales
}
