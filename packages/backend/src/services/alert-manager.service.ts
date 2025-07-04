/**
 * Alert Manager Service
 * 
 * Centralized alerting system that aggregates alerts from all monitoring services
 * and provides notification mechanisms for critical issues.
 */

import { EventEmitter } from 'events';

import { CONSTANTS } from '@jabbr/shared';

import type { JabbrWebSocketServer } from '../websocket/websocket-server';

import logger from './logging.service';

export interface Alert {
  id: string;
  type: 'system' | 'application' | 'trading' | 'security' | 'custom';
  category: string; // cpu, memory, response_time, error_rate, etc.
  level: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  source: string; // which service generated the alert
  value?: number;
  threshold?: number;
  metadata?: any;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolved: boolean;
  resolvedAt?: Date;
  escalated: boolean;
  escalatedAt?: Date;
  notificationsSent: string[]; // channels where notifications were sent
}

export interface AlertRule {
  id: string;
  name: string;
  type: Alert['type'];
  category: string;
  condition: string; // expression to evaluate
  threshold: number;
  level: Alert['level'];
  enabled: boolean;
  cooldownPeriod: number; // milliseconds
  escalationDelay: number; // milliseconds
  notificationChannels: string[];
  lastTriggered?: Date;
}

export interface NotificationChannel {
  id: string;
  name: string;
  type: 'websocket' | 'email' | 'webhook' | 'console';
  config: any;
  enabled: boolean;
  lastUsed?: Date;
}

export interface AlertStats {
  total: number;
  byLevel: Record<Alert['level'], number>;
  byType: Record<Alert['type'], number>;
  byCategory: Record<string, number>;
  acknowledged: number;
  resolved: number;
  active: number;
  escalated: number;
}

export class AlertManagerService extends EventEmitter {
  private alerts: Map<string, Alert> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private notificationChannels: Map<string, NotificationChannel> = new Map();
  private wsServer?: JabbrWebSocketServer;
  private alertHistory: Alert[] = [];
  private readonly MAX_HISTORY = 1000;
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
  private cleanupInterval?: NodeJS.Timeout;

  constructor(wsServer?: JabbrWebSocketServer) {
    super();
    this.wsServer = wsServer;
    
    // Setup default notification channels
    this.setupDefaultChannels();
    
    // Setup default alert rules
    this.setupDefaultRules();
    
    // Start cleanup routine
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldAlerts();
    }, this.CLEANUP_INTERVAL);

    logger.info('Alert Manager Service initialized');
  }

  /**
   * Create a new alert
   */
  public createAlert(alertData: Omit<Alert, 'id' | 'timestamp' | 'acknowledged' | 'resolved' | 'escalated' | 'notificationsSent'>): Alert {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      acknowledged: false,
      resolved: false,
      escalated: false,
      notificationsSent: [],
      ...alertData
    };

    // Check for duplicates or similar alerts
    const similarAlert = this.findSimilarAlert(alert);
    if (similarAlert && !similarAlert.resolved) {
      // Update existing alert instead of creating duplicate
      logger.debug('Similar alert found, updating existing', {
        existingId: similarAlert.id,
        newAlert: alert.title
      });
      return this.updateAlert(similarAlert.id, {
        message: alert.message,
        value: alert.value,
        timestamp: alert.timestamp,
        metadata: { ...similarAlert.metadata, ...alert.metadata }
      });
    }

    // Store the alert
    this.alerts.set(alert.id, alert);
    this.alertHistory.push({ ...alert });

    // Trim history if needed
    if (this.alertHistory.length > this.MAX_HISTORY) {
      this.alertHistory = this.alertHistory.slice(-this.MAX_HISTORY / 2);
    }

    logger.info('Alert created', {
      id: alert.id,
      type: alert.type,
      level: alert.level,
      title: alert.title
    });

    // Send notifications
    this.sendNotifications(alert);

    // Schedule escalation if needed
    this.scheduleEscalation(alert);

    // Emit alert event
    this.emit('alert', alert);

    return alert;
  }

  /**
   * Update an existing alert
   */
  public updateAlert(alertId: string, updates: Partial<Alert>): Alert {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    const updatedAlert = { ...alert, ...updates };
    this.alerts.set(alertId, updatedAlert);

    logger.debug('Alert updated', {
      id: alertId,
      updates: Object.keys(updates)
    });

    this.emit('alertUpdated', updatedAlert);
    return updatedAlert;
  }

  /**
   * Acknowledge an alert
   */
  public acknowledgeAlert(alertId: string, acknowledgedBy: string): Alert {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    const updatedAlert = {
      ...alert,
      acknowledged: true,
      acknowledgedBy,
      acknowledgedAt: new Date()
    };

    this.alerts.set(alertId, updatedAlert);

    logger.info('Alert acknowledged', {
      id: alertId,
      acknowledgedBy,
      title: alert.title
    });

    // Send acknowledgment notification
    this.sendAcknowledgmentNotification(updatedAlert);

    this.emit('alertAcknowledged', updatedAlert);
    return updatedAlert;
  }

  /**
   * Resolve an alert
   */
  public resolveAlert(alertId: string): Alert {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    const updatedAlert = {
      ...alert,
      resolved: true,
      resolvedAt: new Date()
    };

    this.alerts.set(alertId, updatedAlert);

    logger.info('Alert resolved', {
      id: alertId,
      title: alert.title,
      duration: Date.now() - alert.timestamp.getTime()
    });

    // Send resolution notification
    this.sendResolutionNotification(updatedAlert);

    this.emit('alertResolved', updatedAlert);
    return updatedAlert;
  }

  /**
   * Escalate an alert
   */
  public escalateAlert(alertId: string): Alert {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    if (alert.escalated) {
      logger.warn('Alert already escalated', { id: alertId });
      return alert;
    }

    const updatedAlert = {
      ...alert,
      escalated: true,
      escalatedAt: new Date(),
      level: 'critical' as const
    };

    this.alerts.set(alertId, updatedAlert);

    logger.warn('Alert escalated', {
      id: alertId,
      title: alert.title,
      originalLevel: alert.level
    });

    // Send escalation notification
    this.sendEscalationNotification(updatedAlert);

    this.emit('alertEscalated', updatedAlert);
    return updatedAlert;
  }

  /**
   * Get all active alerts
   */
  public getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Get all alerts (including resolved)
   */
  public getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Get alerts by criteria
   */
  public getAlerts(criteria: {
    type?: Alert['type'];
    level?: Alert['level'];
    category?: string;
    acknowledged?: boolean;
    resolved?: boolean;
    escalated?: boolean;
    since?: Date;
  }): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => {
      if (criteria.type && alert.type !== criteria.type) {return false;}
      if (criteria.level && alert.level !== criteria.level) {return false;}
      if (criteria.category && alert.category !== criteria.category) {return false;}
      if (criteria.acknowledged !== undefined && alert.acknowledged !== criteria.acknowledged) {return false;}
      if (criteria.resolved !== undefined && alert.resolved !== criteria.resolved) {return false;}
      if (criteria.escalated !== undefined && alert.escalated !== criteria.escalated) {return false;}
      if (criteria.since && alert.timestamp < criteria.since) {return false;}
      return true;
    });
  }

  /**
   * Get alert statistics
   */
  public getAlertStats(): AlertStats {
    const alerts = Array.from(this.alerts.values());
    
    const stats: AlertStats = {
      total: alerts.length,
      byLevel: { info: 0, warning: 0, error: 0, critical: 0 },
      byType: { system: 0, application: 0, trading: 0, security: 0, custom: 0 },
      byCategory: {},
      acknowledged: 0,
      resolved: 0,
      active: 0,
      escalated: 0
    };

    for (const alert of alerts) {
      stats.byLevel[alert.level]++;
      stats.byType[alert.type]++;
      stats.byCategory[alert.category] = (stats.byCategory[alert.category] || 0) + 1;
      
      if (alert.acknowledged) {stats.acknowledged++;}
      if (alert.resolved) {stats.resolved++;}
      if (!alert.resolved) {stats.active++;}
      if (alert.escalated) {stats.escalated++;}
    }

    return stats;
  }

  /**
   * Add a notification channel
   */
  public addNotificationChannel(channel: NotificationChannel): void {
    this.notificationChannels.set(channel.id, channel);
    logger.info('Notification channel added', {
      id: channel.id,
      name: channel.name,
      type: channel.type
    });
  }

  /**
   * Add an alert rule
   */
  public addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    logger.info('Alert rule added', {
      id: rule.id,
      name: rule.name,
      condition: rule.condition
    });
  }

  /**
   * Process incoming system alert
   */
  public processSystemAlert(alertData: {
    category: string;
    message: string;
    value?: number;
    threshold?: number;
    level: Alert['level'];
    source: string;
    metadata?: any;
  }): Alert {
    return this.createAlert({
      type: 'system',
      category: alertData.category,
      title: `System Alert: ${alertData.category}`,
      message: alertData.message,
      source: alertData.source,
      value: alertData.value,
      threshold: alertData.threshold,
      level: alertData.level,
      metadata: alertData.metadata
    });
  }

  /**
   * Process incoming application alert
   */
  public processApplicationAlert(alertData: {
    category: string;
    message: string;
    value?: number;
    threshold?: number;
    level: Alert['level'];
    source: string;
    metadata?: any;
  }): Alert {
    return this.createAlert({
      type: 'application',
      category: alertData.category,
      title: `Application Alert: ${alertData.category}`,
      message: alertData.message,
      source: alertData.source,
      value: alertData.value,
      threshold: alertData.threshold,
      level: alertData.level,
      metadata: alertData.metadata
    });
  }

  /**
   * Process incoming trading alert
   */
  public processTradingAlert(alertData: {
    category: string;
    message: string;
    value?: number;
    threshold?: number;
    level: Alert['level'];
    source: string;
    metadata?: any;
  }): Alert {
    return this.createAlert({
      type: 'trading',
      category: alertData.category,
      title: `Trading Alert: ${alertData.category}`,
      message: alertData.message,
      source: alertData.source,
      value: alertData.value,
      threshold: alertData.threshold,
      level: alertData.level,
      metadata: alertData.metadata
    });
  }

  /**
   * Find similar alerts to prevent duplicates
   */
  private findSimilarAlert(newAlert: Alert): Alert | undefined {
    const recentCutoff = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes
    
    return Array.from(this.alerts.values()).find(alert => 
      alert.type === newAlert.type &&
      alert.category === newAlert.category &&
      alert.source === newAlert.source &&
      alert.timestamp >= recentCutoff &&
      !alert.resolved
    );
  }

  /**
   * Send notifications for an alert
   */
  private async sendNotifications(alert: Alert): Promise<void> {
    const channels = Array.from(this.notificationChannels.values())
      .filter(channel => channel.enabled);

    for (const channel of channels) {
      try {
        await this.sendNotificationToChannel(alert, channel);
        alert.notificationsSent.push(channel.id);
        channel.lastUsed = new Date();
      } catch (error) {
        logger.error('Failed to send notification', {
          alertId: alert.id,
          channelId: channel.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Send notification to a specific channel
   */
  private async sendNotificationToChannel(alert: Alert, channel: NotificationChannel): Promise<void> {
    switch (channel.type) {
      case 'websocket':
        if (this.wsServer) {
          this.wsServer.broadcast(CONSTANTS.WS_CHANNELS.ALERTS, {
            type: 'alert',
            data: alert,
            timestamp: new Date().toISOString()
          });
        }
        break;

      case 'console':
        const icon = this.getAlertIcon(alert.level);
        console.log(`${icon} [${alert.level.toUpperCase()}] ${alert.title}: ${alert.message}`);
        break;

      case 'email':
        // Email implementation would go here
        logger.debug('Email notification not implemented', { alertId: alert.id });
        break;

      case 'webhook':
        // Webhook implementation would go here
        logger.debug('Webhook notification not implemented', { alertId: alert.id });
        break;

      default:
        logger.warn('Unknown notification channel type', { 
          channelType: channel.type,
          alertId: alert.id 
        });
    }
  }

  /**
   * Send acknowledgment notification
   */
  private async sendAcknowledgmentNotification(alert: Alert): Promise<void> {
    if (this.wsServer) {
      this.wsServer.broadcast(CONSTANTS.WS_CHANNELS.ALERTS, {
        type: 'alert_acknowledged',
        data: {
          alertId: alert.id,
          acknowledgedBy: alert.acknowledgedBy,
          acknowledgedAt: alert.acknowledgedAt
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Send resolution notification
   */
  private async sendResolutionNotification(alert: Alert): Promise<void> {
    if (this.wsServer) {
      this.wsServer.broadcast(CONSTANTS.WS_CHANNELS.ALERTS, {
        type: 'alert_resolved',
        data: {
          alertId: alert.id,
          resolvedAt: alert.resolvedAt,
          duration: alert.resolvedAt ? alert.resolvedAt.getTime() - alert.timestamp.getTime() : 0
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Send escalation notification
   */
  private async sendEscalationNotification(alert: Alert): Promise<void> {
    if (this.wsServer) {
      this.wsServer.broadcast(CONSTANTS.WS_CHANNELS.ALERTS, {
        type: 'alert_escalated',
        data: {
          alertId: alert.id,
          escalatedAt: alert.escalatedAt,
          previousLevel: 'warning', // This could be tracked better
          newLevel: alert.level
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Schedule escalation for an alert
   */
  private scheduleEscalation(alert: Alert): void {
    // Find applicable rule
    const rule = Array.from(this.alertRules.values()).find(r => 
      r.type === alert.type && 
      r.category === alert.category && 
      r.enabled
    );

    if (!rule || rule.escalationDelay <= 0) {
      return;
    }

    setTimeout(() => {
      const currentAlert = this.alerts.get(alert.id);
      if (currentAlert && !currentAlert.acknowledged && !currentAlert.resolved && !currentAlert.escalated) {
        this.escalateAlert(alert.id);
      }
    }, rule.escalationDelay);
  }

  /**
   * Get alert icon for console output
   */
  private getAlertIcon(level: Alert['level']): string {
    switch (level) {
      case 'info': return 'ℹ️';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'critical': return '🚨';
      default: return '📢';
    }
  }

  /**
   * Setup default notification channels
   */
  private setupDefaultChannels(): void {
    // WebSocket channel
    this.addNotificationChannel({
      id: 'websocket',
      name: 'WebSocket Broadcast',
      type: 'websocket',
      config: {},
      enabled: true
    });

    // Console channel
    this.addNotificationChannel({
      id: 'console',
      name: 'Console Output',
      type: 'console',
      config: {},
      enabled: true
    });
  }

  /**
   * Setup default alert rules
   */
  private setupDefaultRules(): void {
    const defaultRules: Omit<AlertRule, 'id'>[] = [
      {
        name: 'Critical CPU Usage',
        type: 'system',
        category: 'cpu',
        condition: 'cpu_usage > 90',
        threshold: 90,
        level: 'critical',
        enabled: true,
        cooldownPeriod: 5 * 60 * 1000, // 5 minutes
        escalationDelay: 10 * 60 * 1000, // 10 minutes
        notificationChannels: ['websocket', 'console']
      },
      {
        name: 'High Memory Usage',
        type: 'system',
        category: 'memory',
        condition: 'memory_usage > 85',
        threshold: 85,
        level: 'warning',
        enabled: true,
        cooldownPeriod: 5 * 60 * 1000,
        escalationDelay: 15 * 60 * 1000,
        notificationChannels: ['websocket', 'console']
      },
      {
        name: 'High Error Rate',
        type: 'application',
        category: 'error_rate',
        condition: 'error_rate > 10',
        threshold: 10,
        level: 'error',
        enabled: true,
        cooldownPeriod: 2 * 60 * 1000,
        escalationDelay: 5 * 60 * 1000,
        notificationChannels: ['websocket', 'console']
      }
    ];

    for (const rule of defaultRules) {
      this.addAlertRule({
        id: `rule_${rule.name.toLowerCase().replace(/\s+/g, '_')}`,
        ...rule
      });
    }
  }

  /**
   * Clean up old resolved alerts
   */
  private cleanupOldAlerts(): void {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
    const initialCount = this.alerts.size;
    
    for (const [id, alert] of this.alerts) {
      if (alert.resolved && alert.resolvedAt && alert.resolvedAt < cutoff) {
        this.alerts.delete(id);
      }
    }
    
    const removed = initialCount - this.alerts.size;
    if (removed > 0) {
      logger.debug(`Cleaned up ${removed} old resolved alerts`);
    }
  }

  /**
   * Get alert summary for dashboard
   */
  public getAlertSummary(): {
    criticalCount: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
    totalActive: number;
    recentAlerts: Alert[];
  } {
    const activeAlerts = this.getActiveAlerts();
    const recentAlerts = [...activeAlerts]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 5);

    return {
      criticalCount: activeAlerts.filter(a => a.level === 'critical').length,
      errorCount: activeAlerts.filter(a => a.level === 'error').length,
      warningCount: activeAlerts.filter(a => a.level === 'warning').length,
      infoCount: activeAlerts.filter(a => a.level === 'info').length,
      totalActive: activeAlerts.length,
      recentAlerts
    };
  }

  /**
   * Shutdown the alert manager
   */
  public shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    // Resolve all active alerts
    for (const alert of this.getActiveAlerts()) {
      this.resolveAlert(alert.id);
    }

    this.alerts.clear();
    this.alertRules.clear();
    this.notificationChannels.clear();
    this.alertHistory = [];
    this.removeAllListeners();
    
    logger.info('Alert Manager shut down');
  }
}

export default AlertManagerService;
