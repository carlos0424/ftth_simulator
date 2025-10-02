// calc-loss.js
// Cálculo de pérdidas y utilidades de potencia.

export const SPLITTER_LOSS_MAP = { 2: 3.5, 4: 7.0, 8: 10.5, 16: 13.5, 32: 16.5, 64: 19.0 };
export const SPLICE_LOSS = 0.1;
export const CONNECTOR_LOSS = 0.3;
export const MIN_POWER = -28;
export const MAX_POWER = 3;

export function splitterLoss(ratio) {
  return SPLITTER_LOSS_MAP[ratio] ?? 0;
}

export function toPercent(powerDBm) {
  const percent = ((powerDBm - MIN_POWER) / (MAX_POWER - MIN_POWER)) * 100;
  return Math.max(0, Math.min(100, Math.round(percent)));
}
