const chunks = [];
process.stdin.on('data', (d) => chunks.push(d));
process.stdin.on('end', () => {
  let data;
  try {
    data = JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    process.stdout.write('');
    return;
  }

  const model = data?.model?.display_name ?? 'Claude';
  const ctxPct = Math.round(data?.context_window?.used_percentage ?? 0);
  const fiveH = data?.rate_limits?.five_hour?.used_percentage;
  const sevenD = data?.rate_limits?.seven_day?.used_percentage;
  const fiveHReset = data?.rate_limits?.five_hour?.resets_at;
  const sevenDReset = data?.rate_limits?.seven_day?.resets_at;
  const cost = data?.cost?.total_cost_usd;

  const RED = '\x1b[31m';
  const YEL = '\x1b[33m';
  const GRN = '\x1b[32m';
  const DIM = '\x1b[2m';
  const RST = '\x1b[0m';

  function color(pct) {
    if (pct >= 80) return RED;
    if (pct >= 55) return YEL;
    return GRN;
  }

  function bar(pct, width = 10) {
    const filled = Math.round((pct / 100) * width);
    const empty = width - filled;
    const c = color(pct);
    return `${c}${'█'.repeat(filled)}${DIM}${'░'.repeat(empty)}${RST}`;
  }

  // Compact countdown until an epoch-seconds reset, e.g. "3d4h", "2h28m", "9s".
  function countdown(resetsAt) {
    if (resetsAt == null) return '';
    const secs = Math.floor(resetsAt - Date.now() / 1000);
    if (secs <= 0) return '';
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (d > 0) return `${d}d${h}h`;
    if (h > 0) return `${h}h${m}m`;
    if (m > 0) return `${m}m`;
    return `${secs}s`;
  }

  const parts = [];

  parts.push(model);
  parts.push(`${bar(ctxPct)} ${color(ctxPct)}${ctxPct}%${RST} ctx`);

  if (fiveH != null) {
    const v = Math.round(fiveH);
    const reset = countdown(fiveHReset);
    const resetTag = reset ? ` ${DIM}↻${reset}${RST}` : '';
    parts.push(`${bar(v)} ${color(v)}${v}%${RST} 5h${resetTag}`);
  }
  if (sevenD != null) {
    const v = Math.round(sevenD);
    const reset = countdown(sevenDReset);
    const resetTag = reset ? ` ${DIM}↻${reset}${RST}` : '';
    parts.push(`${bar(v)} ${color(v)}${v}%${RST} 7d${resetTag}`);
  }
  if (typeof cost === 'number' && cost > 0) {
    parts.push(`${DIM}$${cost.toFixed(2)}${RST}`);
  }

  process.stdout.write(parts.join('  ·  '));
});
