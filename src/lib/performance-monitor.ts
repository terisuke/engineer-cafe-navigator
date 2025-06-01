export class PerformanceMonitor {
  private static measurements: Map<string, number> = new Map();

  static start(label: string): void {
    this.measurements.set(label, Date.now());
  }

  static end(label: string): number {
    const startTime = this.measurements.get(label);
    if (!startTime) {
      console.warn(`[Performance] No start time found for label: ${label}`);
      return 0;
    }
    
    const duration = Date.now() - startTime;
    console.log(`[Performance] ${label}: ${duration}ms`);
    this.measurements.delete(label);
    return duration;
  }

  static async measure<T>(
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

  static logSummary(steps: Record<string, number>): void {
    const total = Object.values(steps).reduce((sum, time) => sum + time, 0);
    console.log('[Performance Summary]');
    Object.entries(steps).forEach(([step, time]) => {
      const percentage = ((time / total) * 100).toFixed(1);
      console.log(`  ${step}: ${time}ms (${percentage}%)`);
    });
    console.log(`  Total: ${total}ms`);
  }
}