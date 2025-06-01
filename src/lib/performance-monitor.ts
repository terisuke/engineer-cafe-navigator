const measurements: Map<string, number> = new Map();

export function startPerformance(label: string): void {
  measurements.set(label, Date.now());
}

export function endPerformance(label: string): number {
  const startTime = measurements.get(label);
  if (!startTime) {
    console.warn(`[Performance] No start time found for label: ${label}`);
    return 0;
  }
  const duration = Date.now() - startTime;
  console.log(`[Performance] ${label}: ${duration}ms`);
  measurements.delete(label);
  return duration;
}

export async function measurePerformance<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    console.log(`[Performance] ${label}: ${duration}ms`);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`[Performance] ${label} failed after ${duration}ms`, error);
    throw error;
  }
}

export function logPerformanceSummary(steps: Record<string, number>): void {
  const total = Object.values(steps).reduce((sum, time) => sum + time, 0);
  console.log('[Performance Summary]');
  Object.entries(steps).forEach(([step, time]) => {
    const percentage = ((time / total) * 100).toFixed(1);
    console.log(`  ${step}: ${time}ms (${percentage}%)`);
  });
  console.log(`  Total: ${total}ms`);
}