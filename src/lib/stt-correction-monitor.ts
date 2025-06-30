/**
 * STT Correction Monitoring
 * 
 * This module tracks and reports on STT corrections applied in production
 * to help identify patterns and improve the correction rules over time.
 */

import { supabaseAdmin } from './supabase';

interface CorrectionEvent {
  original: string;
  corrected: string;
  language: string;
  confidence?: number;
  timestamp: string;
  corrections_applied: string[];
}

export class SttCorrectionMonitor {
  private static corrections: CorrectionEvent[] = [];
  private static readonly BATCH_SIZE = 10;
  private static readonly FLUSH_INTERVAL = 60000; // 1 minute
  private static flushTimer: NodeJS.Timeout | null = null;

  /**
   * Log a correction event
   */
  static logCorrection(
    original: string,
    corrected: string,
    language: string,
    confidence?: number,
    correctionsApplied?: string[]
  ) {
    // Only log if a correction was actually made
    if (original === corrected) return;

    const event: CorrectionEvent = {
      original,
      corrected,
      language,
      confidence,
      timestamp: new Date().toISOString(),
      corrections_applied: correctionsApplied || []
    };

    this.corrections.push(event);

    // Log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.log('[STT Monitor] Correction logged:', {
        from: original,
        to: corrected,
        corrections: correctionsApplied
      });
    }

    // Flush if we've reached the batch size
    if (this.corrections.length >= this.BATCH_SIZE) {
      this.flush();
    } else {
      // Schedule a flush if we haven't already
      this.scheduleFlush();
    }
  }

  /**
   * Schedule a flush of the correction events
   */
  private static scheduleFlush() {
    if (this.flushTimer) return;

    this.flushTimer = setTimeout(() => {
      this.flush();
    }, this.FLUSH_INTERVAL);
  }

  /**
   * Flush correction events to the database
   */
  private static async flush() {
    if (this.corrections.length === 0) return;

    // Clear the timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // Get corrections to flush
    const toFlush = [...this.corrections];
    this.corrections = [];

    try {
      // Store in a monitoring table (create if doesn't exist)
      const { error } = await supabaseAdmin
        .from('stt_correction_logs')
        .insert(toFlush.map(event => ({
          original_text: event.original,
          corrected_text: event.corrected,
          language: event.language,
          confidence: event.confidence,
          corrections_applied: event.corrections_applied,
          created_at: event.timestamp
        })));

      if (error) {
        console.error('[STT Monitor] Failed to store corrections:', error);
        // Put events back if storage failed
        this.corrections.unshift(...toFlush);
      } else {
        console.log(`[STT Monitor] Flushed ${toFlush.length} correction events`);
      }
    } catch (error) {
      console.error('[STT Monitor] Error flushing corrections:', error);
      // Put events back if storage failed
      this.corrections.unshift(...toFlush);
    }
  }

  /**
   * Get correction statistics
   */
  static async getStats(days: number = 7): Promise<{
    totalCorrections: number;
    correctionsByType: Record<string, number>;
    mostCommonMisrecognitions: Array<{ original: string; count: number }>;
    correctionRate: number;
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabaseAdmin
        .from('stt_correction_logs')
        .select('*')
        .gte('created_at', startDate.toISOString());

      if (error) {
        console.error('[STT Monitor] Failed to get stats:', error);
        return {
          totalCorrections: 0,
          correctionsByType: {},
          mostCommonMisrecognitions: [],
          correctionRate: 0
        };
      }

      // Analyze the data
      const correctionsByType: Record<string, number> = {};
      const misrecognitionCounts: Record<string, number> = {};

      for (const log of data || []) {
        // Count by correction type
        for (const correction of log.corrections_applied || []) {
          correctionsByType[correction] = (correctionsByType[correction] || 0) + 1;
        }

        // Count misrecognitions
        misrecognitionCounts[log.original_text] = (misrecognitionCounts[log.original_text] || 0) + 1;
      }

      // Get most common misrecognitions
      const mostCommonMisrecognitions = Object.entries(misrecognitionCounts)
        .map(([original, count]) => ({ original, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalCorrections: data?.length || 0,
        correctionsByType,
        mostCommonMisrecognitions,
        correctionRate: 0 // Would need total STT calls to calculate
      };
    } catch (error) {
      console.error('[STT Monitor] Error getting stats:', error);
      return {
        totalCorrections: 0,
        correctionsByType: {},
        mostCommonMisrecognitions: [],
        correctionRate: 0
      };
    }
  }

  /**
   * Force flush on shutdown
   */
  static async shutdown() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }
}

// Register shutdown handler
if (typeof process !== 'undefined') {
  process.on('SIGINT', () => SttCorrectionMonitor.shutdown());
  process.on('SIGTERM', () => SttCorrectionMonitor.shutdown());
}