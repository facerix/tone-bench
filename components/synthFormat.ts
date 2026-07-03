// Shared readout formatters for the control panels, ported verbatim from
// the prototype's refreshReadouts(). Kept in one place so all 4 panels
// format Hz/%/seconds/Q the same way.

export const fmtHz = (n: number): string => `${Math.round(n)} Hz`;
export const fmtPct = (n0to1: number): string => `${Math.round(n0to1 * 100)}%`;
export const fmtSecs = (n: number, decimals: number): string => `${n.toFixed(decimals)} s`;
export const fmtQ = (n: number): string => n.toFixed(1);
export const fmtCount = (n: number): string => `${Math.round(n)}%`;
