const clamp01 = (p: number) => Math.max(0, Math.min(1, p));

// Abramowitz & Stegun 7.1.26 approximation for erf
const erf = (x: number): number => {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);

  const t = 1 / (1 + 0.3275911 * ax);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;

  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) *
      Math.exp(-ax * ax);

  return sign * y;
};

export const normalCdf = (x: number): number => {
  // Phi(x) = 0.5 * (1 + erf(x / sqrt(2)))
  const z = x / Math.SQRT2;
  return clamp01(0.5 * (1 + erf(z)));
};
