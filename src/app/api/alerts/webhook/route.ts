import { rollbackManager } from '@/lib/rollback-manager';
import { supabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Webhook endpoint for production alerts
 * Can be triggered by monitoring services like Vercel, DataDog, etc.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const authHeader = request.headers.get('authorization');
    const webhookSecret = process.env.ALERT_WEBHOOK_SECRET;
    
    // 環境変数未設定なら必ず拒否
    if (!webhookSecret) {
      return NextResponse.json(
        { error: 'Unauthorized: webhook secret not set' },
        { status: 401 }
      );
    }
    // constant-time比較
    const expected = `Bearer ${webhookSecret}`;
    if (!authHeader || !timingSafeEqualStr(authHeader, expected)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const alert = await request.json();
    
    // Log alert
    await logAlert(alert);
    
    // Process alert based on severity
    const response = await processAlert(alert);
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('[Alert Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process alert' },
      { status: 500 }
    );
  }
}

/**
 * Process different types of alerts
 */
async function processAlert(alert: AlertPayload): Promise<AlertResponse> {
  const { type, severity, metric, value, threshold, source } = alert;
  
  console.log(`[Alert] ${severity.toUpperCase()} - ${type}: ${metric} = ${value} (threshold: ${threshold})`);
  
  let action: string = 'logged';
  let automated = false;
  
  switch (severity) {
    case 'critical':
      // Critical alerts may trigger automatic actions
      if (type === 'error_rate' && value > threshold * 2) {
        // Error rate is double the threshold - emergency shutdown
        await rollbackManager.emergencyShutdown();
        action = 'emergency_shutdown';
        automated = true;
      } else if (type === 'response_time' && value > 5000) {
        // Response time > 5 seconds - disable new features
        const { featureFlags } = await import('@/lib/feature-flags');
        featureFlags.updateFlags({
          USE_NEW_EMBEDDINGS: false,
          NEW_EMBEDDINGS_PERCENTAGE: 0,
        });
        action = 'disabled_new_features';
        automated = true;
      }
      break;
      
    case 'warning':
      // Warnings are logged but don't trigger automatic actions
      if (type === 'cache_hit_rate' && value < 0.5) {
        // Low cache hit rate - send notification
        await sendNotification({
          channel: 'engineering',
          message: `⚠️ Cache hit rate is low: ${(value * 100).toFixed(2)}%`,
        });
        action = 'notification_sent';
      }
      break;
      
    case 'info':
      // Info alerts are just logged
      break;
  }
  
  // Check if we need to create a snapshot
  if (severity === 'critical' && !automated) {
    const snapshotId = await rollbackManager.createSnapshot(
      `alert-${type}-${Date.now()}`,
      { alert }
    );
    action = `snapshot_created:${snapshotId}`;
  }
  
  return {
    received: true,
    alert_id: alert.id || `alert-${Date.now()}`,
    action,
    automated,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Log alert to database
 */
async function logAlert(alert: AlertPayload): Promise<void> {
  try {
    await supabaseAdmin
      .from('production_alerts')
      .insert({
        type: alert.type,
        severity: alert.severity,
        metric: alert.metric,
        value: alert.value,
        threshold: alert.threshold,
        source: alert.source,
        metadata: alert.metadata,
        created_at: new Date().toISOString(),
      });
  } catch (error) {
    console.error('[Alert Webhook] Failed to log alert:', error);
  }
}

/**
 * Send notification (placeholder - implement based on your notification service)
 */
async function sendNotification(notification: {
  channel: string;
  message: string;
}): Promise<void> {
  // In production, this would send to Slack, Discord, email, etc.
  console.log(`[Notification] ${notification.channel}: ${notification.message}`);
  
  // Example: Send to Slack webhook
  if (process.env.SLACK_WEBHOOK_URL) {
    try {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: notification.message,
          channel: `#${notification.channel}`,
        }),
      });
    } catch (error) {
      console.error('[Notification] Failed to send Slack notification:', error);
    }
  }
}

// GET endpoint to retrieve recent alerts
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const severity = url.searchParams.get('severity');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    
    let query = supabaseAdmin
      .from('production_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (severity) {
      query = query.eq('severity', severity);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return NextResponse.json({
      alerts: data || [],
      count: data?.length || 0,
    });
    
  } catch (error) {
    console.error('[Alert Webhook] Error fetching alerts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}

// Type definitions
interface AlertPayload {
  id?: string;
  type: 'error_rate' | 'response_time' | 'cache_hit_rate' | 'api_failure' | 'memory_usage';
  severity: 'info' | 'warning' | 'critical';
  metric: string;
  value: number;
  threshold: number;
  source: string;
  metadata?: Record<string, any>;
}

interface AlertResponse {
  received: boolean;
  alert_id: string;
  action: string;
  automated: boolean;
  timestamp: string;
}

// constant-time string comparison
function timingSafeEqualStr(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}