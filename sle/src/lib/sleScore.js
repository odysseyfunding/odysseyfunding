// SLE scoring v1: 12 signals, each 0-5, normalized to 0-10
export function computeSleScore({
  depositsBand,
  timeInBiz,
  state,
  industry,
  partnerId,
  docsReceived,
  reviewVelocity = 0,
  hiringSpike = 0,
  uccRelease = 0,
  newRegistration = 0,
  adbBand = 0,
  timeInBizMonths = 0
}) {
  const signals = [];

  // Deposits band
  const bandScores = { '<25k': 1, '25-50k': 2, '50-100k': 4, '>100k': 5 };
  signals.push(bandScores[depositsBand] || 0);

  // Time in biz
  const tibScores = { '<6m': 1, '6-12m': 2, '1-2y': 3, '>2y': 5 };
  signals.push(tibScores[timeInBiz] || (timeInBizMonths >= 24 ? 5 : timeInBizMonths >= 12 ? 3 : 2));

  // State preference (example: prioritize CA, TX, FL, NY)
  const preferredStates = new Set(['CA','TX','FL','NY']);
  signals.push(preferredStates.has((state||'').toUpperCase()) ? 3 : 2);

  // Industry preference (example weights)
  const preferredIndustries = new Set(['HEALTHCARE','E-COMMERCE','CONSTRUCTION','SERVICES']);
  signals.push(preferredIndustries.has((industry||'').toUpperCase()) ? 4 : 2);

  // Partner sourced
  signals.push(partnerId ? 4 : 2);

  // Docs received
  signals.push(docsReceived ? 5 : 1);

  // Review velocity (0-5)
  signals.push(Math.max(0, Math.min(5, reviewVelocity)));

  // Hiring spike (0-5)
  signals.push(Math.max(0, Math.min(5, hiringSpike)));

  // UCC release signal (0 none / 5 strong)
  signals.push(Math.max(0, Math.min(5, uccRelease)));

  // New registration signal
  signals.push(Math.max(0, Math.min(5, newRegistration)));

  // Average daily balance band (0-5)
  signals.push(Math.max(0, Math.min(5, adbBand)));

  // Keep to 12 signals: pad if short
  while (signals.length < 12) signals.push(2);

  const raw = signals.reduce((a, b) => a + b, 0); // max 60
  const norm = Math.round((raw / 60) * 10 * 10) / 10; // 0-10, 0.1 steps
  return { raw, norm, signals };
}

