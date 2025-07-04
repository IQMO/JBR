/**
 * Enhanced Progress Tracking System
 * Main entry point for all progress tracking functionality
 */

import { ProgressTracker } from './progress-tracker';
import type { TaskMetrics, ProjectMetrics, TimeTrackingEntry } from './progress-tracker';

import { DashboardGenerator, DashboardCLI } from './dashboard-generator';
import type { DashboardConfig } from './dashboard-generator';

import { MetricsCollector } from './metrics-collector';
import type { 
  MetricsSnapshot, 
  GitMetrics, 
  BuildMetrics, 
  TestMetrics, 
  PerformanceMetrics 
} from './metrics-collector';

// Export everything for external use
export { ProgressTracker } from './progress-tracker';
export type { TaskMetrics, ProjectMetrics, TimeTrackingEntry } from './progress-tracker';

export { DashboardGenerator, DashboardCLI } from './dashboard-generator';
export type { DashboardConfig } from './dashboard-generator';

export { MetricsCollector } from './metrics-collector';
export type { 
  MetricsSnapshot, 
  GitMetrics, 
  BuildMetrics, 
  TestMetrics, 
  PerformanceMetrics 
} from './metrics-collector';

/**
 * Main Progress Tracking System class that orchestrates all components
 */
export class ProgressTrackingSystem {
  private progressTracker: ProgressTracker;
  private dashboardGenerator: DashboardGenerator;
  private metricsCollector: MetricsCollector;
  private projectRoot: string;

  constructor(projectRoot: string, config?: Partial<DashboardConfig>) {
    this.projectRoot = projectRoot;
    this.progressTracker = new ProgressTracker(projectRoot);
    this.dashboardGenerator = new DashboardGenerator(projectRoot, config);
    this.metricsCollector = new MetricsCollector(projectRoot);
  }

  /**
   * Initialize the complete progress tracking system
   */
  public async initialize(): Promise<void> {
    console.log('🚀 Initializing Enhanced Progress Tracking System...');
    
    try {
      // Collect initial metrics
      await this.metricsCollector.collectMetrics();
      console.log('✅ Initial metrics collected');

      // Generate initial dashboard
      this.dashboardGenerator.saveDashboard();
      console.log('✅ Initial dashboard generated');

      console.log('🎯 Progress Tracking System initialized successfully!');
      console.log(`📊 Dashboard available at: ${this.projectRoot}/.taskmaster/reports/dashboard/index.html`);
      
    } catch (error) {
      console.error('❌ Failed to initialize Progress Tracking System:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive project status
   */
  public async getProjectStatus(): Promise<any> {
    const snapshot = await this.metricsCollector.collectMetrics();
    const dashboard = this.dashboardGenerator.generateJSONDashboard();
    
    return {
      timestamp: snapshot.timestamp,
      health: this.calculateProjectHealth(snapshot),
      summary: dashboard.summary,
      alerts: dashboard.alerts,
      recommendations: dashboard.recommendations,
      metrics: {
        project: snapshot.projectMetrics,
        tasks: snapshot.taskMetrics,
        git: snapshot.gitMetrics,
        build: snapshot.buildMetrics,
        test: snapshot.testMetrics,
        performance: snapshot.performanceMetrics
      }
    };
  }

  /**
   * Generate and update all tracking components
   */
  public async refresh(): Promise<void> {
    console.log('🔄 Refreshing progress tracking data...');
    
    // Collect latest metrics
    await this.metricsCollector.collectMetrics();
    
    // Update dashboard
    this.dashboardGenerator.saveDashboard();
    
    // Send notifications if configured
    await this.dashboardGenerator.sendNotifications();
    
    console.log('✅ Progress tracking data refreshed');
  }

  /**
   * Start continuous monitoring
   */
  public startMonitoring(intervalMinutes: number = 30): NodeJS.Timeout {
    console.log(`👀 Starting continuous monitoring (every ${intervalMinutes} minutes)`);
    
    return setInterval(async () => {
      try {
        await this.refresh();
        console.log(`🔄 Monitoring cycle completed at ${new Date().toLocaleString()}`);
      } catch (error) {
        console.error('❌ Error during monitoring cycle:', error);
      }
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Export all data for external integrations
   */
  public async exportData(format: 'json' | 'csv' | 'github' | 'jira' = 'json'): Promise<string> {
    const status = await this.getProjectStatus();
    
    switch (format) {
      case 'json':
        return JSON.stringify(status, null, 2);
      case 'csv':
        return this.progressTracker.exportMetrics('csv');
      case 'github':
      case 'jira':
        return JSON.stringify(this.metricsCollector.exportForIntegration(format), null, 2);
      default:
        return JSON.stringify(status, null, 2);
    }
  }

  // Getters for individual components
  public getProgressTracker(): ProgressTracker {
    return this.progressTracker;
  }

  public getDashboardGenerator(): DashboardGenerator {
    return this.dashboardGenerator;
  }

  public getMetricsCollector(): MetricsCollector {
    return this.metricsCollector;
  }

  private calculateProjectHealth(snapshot: MetricsSnapshot): 'excellent' | 'good' | 'warning' | 'critical' {
    const progress = snapshot.projectMetrics.overallProgress;
    const velocity = snapshot.projectMetrics.velocityPerWeek;
    const blockedTasks = snapshot.projectMetrics.blockedTasks;
    const testCoverage = snapshot.testMetrics?.testCoverage || 0;
    
    let score = 0;
    
    // Progress score (40% weight)
    if (progress > 80) score += 40;
    else if (progress > 60) score += 30;
    else if (progress > 40) score += 20;
    else score += 10;
    
    // Velocity score (30% weight)
    if (velocity > 5) score += 30;
    else if (velocity > 3) score += 20;
    else if (velocity > 1) score += 10;
    
    // Quality score (20% weight)
    if (testCoverage > 80) score += 20;
    else if (testCoverage > 60) score += 15;
    else if (testCoverage > 40) score += 10;
    
    // Risk score (10% weight) - negative impact
    if (blockedTasks === 0) score += 10;
    else if (blockedTasks < 3) score += 5;
    
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'warning';
    return 'critical';
  }
}
