export function classifyQueueHealth(counts = {}) {
  const normalized = {
    waiting: Number(counts.waiting || 0),
    active: Number(counts.active || 0),
    delayed: Number(counts.delayed || 0),
    failed: Number(counts.failed || 0),
  };

  return {
    status: normalized.failed > 0 ? "attention" : "healthy",
    counts: normalized,
    detail: `${normalized.waiting} esperando, ${normalized.active} activos, ${normalized.delayed} demorados, ${normalized.failed} fallidos`,
  };
}
