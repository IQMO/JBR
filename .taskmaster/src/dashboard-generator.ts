/**
 * Dashboard Generator for Enhanced Progress Tracking
 * Creates interactive dashboards and reports for project management integration
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { ProgressTracker, TaskMetrics, ProjectMetrics } from './progress-tracker';

export interface DashboardConfig {
  projectName: string;
  refreshInterval: number; // in minutes
  alertThresholds: {
    blockedTasksWarning: number;
    velocityWarning: number;
    overdueTasksCritical: number;
  };
  integrations: {
    slack?: {
      webhookUrl: string;
      channels: string[];
    };
    jira?: {
      apiUrl: string;
      projectKey: string;
    };
    github?: {
      owner: string;
      repo: string;
      token: string;
    };
  };
}

export class DashboardGenerator {
  private projectRoot: string;
  private progressTracker: ProgressTracker;
  private config: DashboardConfig;

  constructor(projectRoot: string, config?: Partial<DashboardConfig>) {
    this.projectRoot = projectRoot;
    this.progressTracker = new ProgressTracker(projectRoot);
    this.config = {
      projectName: 'JBR Trading Platform',
      refreshInterval: 30,
      alertThresholds: {
        blockedTasksWarning: 3,
        velocityWarning: 2,
        overdueTasksCritical: 5
      },
      integrations: {},
      ...config
    };
  }

  /**
   * Generate comprehensive HTML dashboard
   */
  public generateHTMLDashboard(): string {
    const tasksData = this.loadTasksData();
    const taskMetrics = this.progressTracker.calculateTaskMetrics(tasksData);
    const projectMetrics = this.progressTracker.calculateProjectMetrics(taskMetrics);
    const dashboard = this.progressTracker.generateDashboard(projectMetrics, taskMetrics);

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.config.projectName} - Progress Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f7fa; }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2rem; border-radius: 10px; margin-bottom: 2rem; }
        .header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
        .header .subtitle { opacity: 0.9; font-size: 1.1rem; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
        .metric-card { background: white; padding: 1.5rem; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .metric-card h3 { color: #333; margin-bottom: 0.5rem; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; }
        .metric-value { font-size: 2.5rem; font-weight: bold; color: #667eea; }
        .metric-change { font-size: 0.9rem; margin-top: 0.5rem; }
        .positive { color: #27ae60; }
        .negative { color: #e74c3c; }
        .charts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 2rem; margin-bottom: 2rem; }
        .chart-container { background: white; padding: 1.5rem; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .alerts { background: white; padding: 1.5rem; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 2rem; }
        .alert { padding: 1rem; margin: 0.5rem 0; border-radius: 5px; border-left: 4px solid; }
        .alert-warning { background: #fff3cd; border-color: #f0ad4e; color: #856404; }
        .alert-danger { background: #f8d7da; border-color: #dc3545; color: #721c24; }
        .alert-info { background: #d1ecf1; border-color: #17a2b8; color: #0c5460; }
        .recommendations { background: white; padding: 1.5rem; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .recommendation { padding: 1rem; margin: 0.5rem 0; background: #f8f9ff; border-radius: 5px; border-left: 4px solid #667eea; }
        .timestamp { text-align: center; margin-top: 2rem; color: #666; font-size: 0.9rem; }
        .progress-bar { width: 100%; height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden; margin-top: 10px; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); transition: width 0.3s ease; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${this.config.projectName}</h1>
            <div class="subtitle">Project Progress Dashboard</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${dashboard.summary.overallProgress}%"></div>
            </div>
        </div>

        <div class="metrics-grid">
            <div class="metric-card">
                <h3>Overall Progress</h3>
                <div class="metric-value">${dashboard.summary.overallProgress.toFixed(1)}%</div>
                <div class="metric-change">Target: 100%</div>
            </div>
            <div class="metric-card">
                <h3>Tasks Completed</h3>
                <div class="metric-value">${dashboard.summary.tasksCompleted}</div>
                <div class="metric-change">${dashboard.summary.tasksRemaining} remaining</div>
            </div>
            <div class="metric-card">
                <h3>Weekly Velocity</h3>
                <div class="metric-value">${dashboard.summary.velocity}</div>
                <div class="metric-change">tasks/week</div>
            </div>
            <div class="metric-card">
                <h3>Est. Completion</h3>
                <div class="metric-value" style="font-size: 1.5rem;">${new Date(dashboard.summary.estimatedCompletion).toLocaleDateString()}</div>
                <div class="metric-change">Based on current velocity</div>
            </div>
        </div>

        <div class="charts-grid">
            <div class="chart-container">
                <h3>Task Status Distribution</h3>
                <canvas id="statusChart" width="400" height="300"></canvas>
            </div>
            <div class="chart-container">
                <h3>Priority Breakdown</h3>
                <canvas id="priorityChart" width="400" height="300"></canvas>
            </div>
            <div class="chart-container">
                <h3>Burndown Chart</h3>
                <canvas id="burndownChart" width="400" height="300"></canvas>
            </div>
            <div class="chart-container">
                <h3>Velocity Trend</h3>
                <canvas id="velocityChart" width="400" height="300"></canvas>
            </div>
        </div>

        ${this.generateAlertsSection(dashboard.alerts)}
        ${this.generateRecommendationsSection(dashboard.recommendations)}

        <div class="timestamp">
            Last updated: ${new Date().toLocaleString()}
            <br>
            Auto-refresh every ${this.config.refreshInterval} minutes
        </div>
    </div>

    <script>
        // Status Distribution Chart
        new Chart(document.getElementById('statusChart'), {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'In Progress', 'Pending', 'Blocked', 'Deferred'],
                datasets: [{
                    data: [
                        ${dashboard.charts.statusDistribution.completed},
                        ${dashboard.charts.statusDistribution.inProgress},
                        ${dashboard.charts.statusDistribution.pending},
                        ${dashboard.charts.statusDistribution.blocked},
                        ${dashboard.charts.statusDistribution.deferred}
                    ],
                    backgroundColor: ['#27ae60', '#f39c12', '#95a5a6', '#e74c3c', '#9b59b6']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

        // Priority Breakdown Chart
        new Chart(document.getElementById('priorityChart'), {
            type: 'bar',
            data: {
                labels: ['High', 'Medium', 'Low'],
                datasets: [{
                    label: 'Tasks',
                    data: [
                        ${dashboard.charts.priorityBreakdown.high},
                        ${dashboard.charts.priorityBreakdown.medium},
                        ${dashboard.charts.priorityBreakdown.low}
                    ],
                    backgroundColor: ['#e74c3c', '#f39c12', '#27ae60']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

        // Burndown Chart
        new Chart(document.getElementById('burndownChart'), {
            type: 'line',
            data: {
                labels: [${dashboard.charts.burndown.map((d: any) => `'${new Date(d.date).toLocaleDateString()}'`).join(',')}],
                datasets: [{
                    label: 'Remaining Tasks',
                    data: [${dashboard.charts.burndown.map((d: any) => d.remaining).join(',')}],
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    fill: true
                }, {
                    label: 'Completed Tasks',
                    data: [${dashboard.charts.burndown.map((d: any) => d.completed).join(',')}],
                    borderColor: '#27ae60',
                    backgroundColor: 'rgba(39, 174, 96, 0.1)',
                    fill: true
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });

        // Velocity Chart
        new Chart(document.getElementById('velocityChart'), {
            type: 'line',
            data: {
                labels: [${dashboard.charts.velocity.map((v: any) => `'${v.week}'`).join(',')}],
                datasets: [{
                    label: 'Tasks Completed',
                    data: [${dashboard.charts.velocity.map((v: any) => v.completed).join(',')}],
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    fill: true
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });

        // Auto-refresh
        setTimeout(() => {
            window.location.reload();
        }, ${this.config.refreshInterval * 60 * 1000});
    </script>
</body>
</html>`;

    return html;
  }

  /**
   * Generate alerts section HTML
   */
  private generateAlertsSection(alerts: any): string {
    let html = '<div class="alerts"><h2>Alerts & Issues</h2>';
    
    if (alerts.blockedTasks.length > 0) {
      html += `<div class="alert alert-danger">
        <strong>Blocked Tasks:</strong> ${alerts.blockedTasks.length} tasks are currently blocked
        <ul>${alerts.blockedTasks.map((task: any) => `<li>${task.title} (${task.id})</li>`).join('')}</ul>
      </div>`;
    }

    if (alerts.overdueTasks.length > 0) {
      html += `<div class="alert alert-warning">
        <strong>Overdue Tasks:</strong> ${alerts.overdueTasks.length} tasks are past their deadline
        <ul>${alerts.overdueTasks.map((task: any) => `<li>${task.title} (${task.id})</li>`).join('')}</ul>
      </div>`;
    }

    if (alerts.dependencyIssues.length > 0) {
      html += `<div class="alert alert-info">
        <strong>Dependency Issues:</strong> ${alerts.dependencyIssues.length} dependency-related problems detected
      </div>`;
    }

    if (alerts.highRiskTasks.length > 0) {
      html += `<div class="alert alert-danger">
        <strong>High Risk Areas:</strong> ${alerts.highRiskTasks.length} high-risk factors identified
      </div>`;
    }

    html += '</div>';
    return html;
  }

  /**
   * Generate recommendations section HTML
   */
  private generateRecommendationsSection(recommendations: string[]): string {
    let html = '<div class="recommendations"><h2>Recommendations</h2>';
    
    recommendations.forEach(rec => {
      html += `<div class="recommendation">${rec}</div>`;
    });

    html += '</div>';
    return html;
  }

  /**
   * Generate JSON dashboard data for API consumption
   */
  public generateJSONDashboard(): any {
    const tasksData = this.loadTasksData();
    const taskMetrics = this.progressTracker.calculateTaskMetrics(tasksData);
    const projectMetrics = this.progressTracker.calculateProjectMetrics(taskMetrics);
    const dashboard = this.progressTracker.generateDashboard(projectMetrics, taskMetrics);

    return {
      metadata: {
        projectName: this.config.projectName,
        lastUpdated: new Date().toISOString(),
        refreshInterval: this.config.refreshInterval
      },
      summary: dashboard.summary,
      charts: dashboard.charts,
      alerts: dashboard.alerts,
      recommendations: dashboard.recommendations,
      taskMetrics,
      projectMetrics
    };
  }

  /**
   * Generate Slack notification payload
   */
  public generateSlackNotification(): any {
    const dashboard = this.generateJSONDashboard();
    const alerts = dashboard.alerts;
    
    const color = alerts.blockedTasks.length > 0 || alerts.overdueTasks.length > 0 ? 'danger' : 'good';
    
    return {
      text: `${this.config.projectName} Progress Update`,
      attachments: [{
        color,
        fields: [
          {
            title: 'Overall Progress',
            value: `${dashboard.summary.overallProgress.toFixed(1)}%`,
            short: true
          },
          {
            title: 'Tasks Completed',
            value: `${dashboard.summary.tasksCompleted}/${dashboard.summary.tasksCompleted + dashboard.summary.tasksRemaining}`,
            short: true
          },
          {
            title: 'Weekly Velocity',
            value: `${dashboard.summary.velocity} tasks/week`,
            short: true
          },
          {
            title: 'Est. Completion',
            value: new Date(dashboard.summary.estimatedCompletion).toLocaleDateString(),
            short: true
          }
        ],
        footer: `Last updated: ${new Date().toLocaleString()}`
      }]
    };
  }

  /**
   * Generate GitHub issue for blocked tasks
   */
  public generateGitHubIssue(blockedTasks: TaskMetrics[]): any {
    if (blockedTasks.length === 0) return null;

    const body = `
## Blocked Tasks Report

The following tasks are currently blocked and require attention:

${blockedTasks.map(task => `
### Task ${task.id}: ${task.title}
- **Status:** ${task.status}
- **Priority:** ${task.priority}
- **Complexity:** ${task.complexity}/10
- **Blockers:** ${task.blockers.join(', ') || 'Not specified'}
- **Dependencies:** ${task.dependencies.join(', ') || 'None'}

`).join('')}

## Recommendations

1. Review and resolve blocking issues for each task
2. Update task dependencies if needed
3. Consider breaking down complex tasks into smaller subtasks
4. Escalate high-priority blocked tasks immediately

---
*This issue was automatically generated by the Progress Tracking System*
*Last updated: ${new Date().toLocaleString()}*
`;

    return {
      title: `🚫 Blocked Tasks Report - ${blockedTasks.length} tasks need attention`,
      body,
      labels: ['blocked', 'automated', 'progress-tracking'],
      assignees: []
    };
  }

  /**
   * Save dashboard files to disk
   */
  public saveDashboard(): void {
    const reportsDir = join(this.projectRoot, '.taskmaster', 'reports');
    const dashboardDir = join(reportsDir, 'dashboard');
    
    // Ensure directories exist
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true });
    }
    if (!existsSync(dashboardDir)) {
      mkdirSync(dashboardDir, { recursive: true });
    }

    // Generate and save HTML dashboard
    const htmlDashboard = this.generateHTMLDashboard();
    writeFileSync(join(dashboardDir, 'index.html'), htmlDashboard);

    // Generate and save JSON dashboard
    const jsonDashboard = this.generateJSONDashboard();
    writeFileSync(join(dashboardDir, 'dashboard.json'), JSON.stringify(jsonDashboard, null, 2));

    // Save individual metric files
    writeFileSync(join(reportsDir, 'task-metrics.json'), JSON.stringify(jsonDashboard.taskMetrics, null, 2));
    writeFileSync(join(reportsDir, 'project-metrics.json'), JSON.stringify(jsonDashboard.projectMetrics, null, 2));

    console.log(`Dashboard saved to: ${dashboardDir}/index.html`);
  }

  /**
   * Send notifications to configured integrations
   */
  public async sendNotifications(): Promise<void> {
    const dashboard = this.generateJSONDashboard();
    
    // Slack notifications
    if (this.config.integrations.slack?.webhookUrl) {
      const payload = this.generateSlackNotification();
      // Implementation would use fetch() or axios to send to Slack
      console.log('Slack notification ready:', payload);
    }

    // GitHub issue creation for blocked tasks
    if (this.config.integrations.github && dashboard.alerts.blockedTasks.length > 0) {
      const issue = this.generateGitHubIssue(dashboard.alerts.blockedTasks);
      // Implementation would use GitHub API to create issue
      console.log('GitHub issue ready:', issue);
    }
  }

  private loadTasksData(): any {
    const tasksPath = join(this.projectRoot, '.taskmaster', 'tasks', 'tasks.json');
    if (existsSync(tasksPath)) {
      return JSON.parse(readFileSync(tasksPath, 'utf8'));
    }
    return { tasks: [] };
  }
}

/**
 * CLI interface for dashboard generation
 */
export class DashboardCLI {
  static async run(projectRoot: string, options: any = {}): Promise<void> {
    const generator = new DashboardGenerator(projectRoot, options);
    
    // Generate and save dashboard
    generator.saveDashboard();
    
    // Send notifications if configured
    if (options.notify) {
      await generator.sendNotifications();
    }
    
    console.log('Dashboard generation complete!');
    console.log(`View dashboard at: ${join(projectRoot, '.taskmaster', 'reports', 'dashboard', 'index.html')}`);
  }
}
