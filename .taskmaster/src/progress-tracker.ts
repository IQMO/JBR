/**
 * Enhanced Progress Tracking System
 * Provides granular metrics, dashboard integration, and project management capabilities
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface TaskMetrics {
  id: string;
  title: string;
  status: 'pending' | 'in-progress' | 'done' | 'blocked' | 'deferred' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
  complexity: number; // 1-10 scale
  estimatedHours: number;
  actualHours: number;
  completionPercentage: number;
  dependencies: string[];
  blockers: string[];
  assignee?: string;
  startDate?: string;
  endDate?: string;
  lastUpdated: string;
  tags: string[];
  subtaskProgress?: {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
  };
}

export interface ProjectMetrics {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  blockedTasks: number;
  deferredTasks: number;
  cancelledTasks: number;
  overallProgress: number;
  estimatedCompletion: string;
  velocityPerWeek: number;
  burndownData: Array<{
    date: string;
    remaining: number;
    completed: number;
  }>;
  criticalPath: string[];
  riskFactors: Array<{
    type: 'dependency' | 'resource' | 'timeline' | 'technical';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    tasks: string[];
  }>;
}

export interface TimeTrackingEntry {
  taskId: string;
  startTime: string;
  endTime?: string;
  duration?: number; // in minutes
  description: string;
  category: 'development' | 'testing' | 'documentation' | 'planning' | 'review';
}

export class ProgressTracker {
  private projectRoot: string;
  private metricsPath: string;
  private timeTrackingPath: string;
  private dashboardPath: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.metricsPath = join(projectRoot, '.taskmaster', 'reports', 'metrics.json');
    this.timeTrackingPath = join(projectRoot, '.taskmaster', 'reports', 'time-tracking.json');
    this.dashboardPath = join(projectRoot, '.taskmaster', 'reports', 'dashboard.json');
  }

  /**
   * Calculate comprehensive task metrics from tasks.json
   */
  public calculateTaskMetrics(tasksData: any): TaskMetrics[] {
    const metrics: TaskMetrics[] = [];
    
    if (!tasksData.tasks) return metrics;

    for (const task of tasksData.tasks) {
      const taskMetric: TaskMetrics = {
        id: task.id.toString(),
        title: task.title,
        status: task.status || 'pending',
        priority: task.priority || 'medium',
        complexity: task.complexity || 5,
        estimatedHours: task.estimatedHours || 8,
        actualHours: this.getActualHours(task.id.toString()),
        completionPercentage: this.calculateCompletionPercentage(task),
        dependencies: task.dependencies || [],
        blockers: task.blockers || [],
        assignee: task.assignee,
        startDate: task.startDate,
        endDate: task.endDate,
        lastUpdated: task.lastUpdated || new Date().toISOString(),
        tags: task.tags || [],
        subtaskProgress: task.subtasks ? this.calculateSubtaskProgress(task.subtasks) : undefined
      };

      metrics.push(taskMetric);
    }

    return metrics;
  }

  /**
   * Calculate project-wide metrics
   */
  public calculateProjectMetrics(taskMetrics: TaskMetrics[]): ProjectMetrics {
    const totalTasks = taskMetrics.length;
    const completedTasks = taskMetrics.filter(t => t.status === 'done').length;
    const inProgressTasks = taskMetrics.filter(t => t.status === 'in-progress').length;
    const pendingTasks = taskMetrics.filter(t => t.status === 'pending').length;
    const blockedTasks = taskMetrics.filter(t => t.status === 'blocked').length;
    const deferredTasks = taskMetrics.filter(t => t.status === 'deferred').length;
    const cancelledTasks = taskMetrics.filter(t => t.status === 'cancelled').length;

    const overallProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    
    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      pendingTasks,
      blockedTasks,
      deferredTasks,
      cancelledTasks,
      overallProgress,
      estimatedCompletion: this.calculateEstimatedCompletion(taskMetrics),
      velocityPerWeek: this.calculateVelocity(taskMetrics),
      burndownData: this.generateBurndownData(taskMetrics),
      criticalPath: this.calculateCriticalPath(taskMetrics),
      riskFactors: this.identifyRiskFactors(taskMetrics)
    };
  }

  /**
   * Generate dashboard data for visualization
   */
  public generateDashboard(projectMetrics: ProjectMetrics, taskMetrics: TaskMetrics[]): any {
    return {
      summary: {
        overallProgress: projectMetrics.overallProgress,
        tasksCompleted: projectMetrics.completedTasks,
        tasksRemaining: projectMetrics.totalTasks - projectMetrics.completedTasks,
        estimatedCompletion: projectMetrics.estimatedCompletion,
        velocity: projectMetrics.velocityPerWeek
      },
      charts: {
        statusDistribution: {
          completed: projectMetrics.completedTasks,
          inProgress: projectMetrics.inProgressTasks,
          pending: projectMetrics.pendingTasks,
          blocked: projectMetrics.blockedTasks,
          deferred: projectMetrics.deferredTasks,
          cancelled: projectMetrics.cancelledTasks
        },
        priorityBreakdown: this.calculatePriorityBreakdown(taskMetrics),
        complexityDistribution: this.calculateComplexityDistribution(taskMetrics),
        burndown: projectMetrics.burndownData,
        velocity: this.calculateVelocityTrend(taskMetrics)
      },
      alerts: {
        blockedTasks: taskMetrics.filter(t => t.status === 'blocked'),
        overdueTasks: this.getOverdueTasks(taskMetrics),
        highRiskTasks: projectMetrics.riskFactors.filter(r => r.severity === 'high' || r.severity === 'critical'),
        dependencyIssues: this.getDependencyIssues(taskMetrics)
      },
      recommendations: this.generateRecommendations(projectMetrics, taskMetrics)
    };
  }

  /**
   * Start time tracking for a task
   */
  public startTimeTracking(taskId: string, description: string, category: string): void {
    const entry: TimeTrackingEntry = {
      taskId,
      startTime: new Date().toISOString(),
      description,
      category: category as any
    };

    const timeData = this.loadTimeTrackingData();
    timeData.push(entry);
    this.saveTimeTrackingData(timeData);
  }

  /**
   * Stop time tracking for a task
   */
  public stopTimeTracking(taskId: string): void {
    const timeData = this.loadTimeTrackingData();
    const activeEntry = timeData.find(entry => 
      entry.taskId === taskId && !entry.endTime
    );

    if (activeEntry) {
      const endTime = new Date();
      const startTime = new Date(activeEntry.startTime);
      activeEntry.endTime = endTime.toISOString();
      activeEntry.duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
      
      this.saveTimeTrackingData(timeData);
    }
  }

  /**
   * Export metrics for external integrations
   */
  public exportMetrics(format: 'json' | 'csv' | 'xlsx' = 'json'): string {
    const tasksData = this.loadTasksData();
    const taskMetrics = this.calculateTaskMetrics(tasksData);
    const projectMetrics = this.calculateProjectMetrics(taskMetrics);
    
    const exportData = {
      timestamp: new Date().toISOString(),
      project: projectMetrics,
      tasks: taskMetrics,
      timeTracking: this.loadTimeTrackingData()
    };

    switch (format) {
      case 'json':
        return JSON.stringify(exportData, null, 2);
      case 'csv':
        return this.convertToCSV(taskMetrics);
      case 'xlsx':
        // Would require additional library for Excel export
        throw new Error('XLSX export not implemented yet');
      default:
        return JSON.stringify(exportData, null, 2);
    }
  }

  // Private helper methods

  private calculateCompletionPercentage(task: any): number {
    if (task.status === 'done') return 100;
    if (task.status === 'cancelled') return 0;
    
    if (task.subtasks && task.subtasks.length > 0) {
      const completed = task.subtasks.filter((st: any) => st.status === 'done').length;
      return Math.round((completed / task.subtasks.length) * 100);
    }
    
    if (task.status === 'in-progress') return 50;
    return 0;
  }

  private calculateSubtaskProgress(subtasks: any[]): any {
    return {
      total: subtasks.length,
      completed: subtasks.filter(st => st.status === 'done').length,
      inProgress: subtasks.filter(st => st.status === 'in-progress').length,
      pending: subtasks.filter(st => st.status === 'pending').length
    };
  }

  private getActualHours(taskId: string): number {
    const timeData = this.loadTimeTrackingData();
    const taskEntries = timeData.filter(entry => entry.taskId === taskId && entry.duration);
    return taskEntries.reduce((total, entry) => total + (entry.duration || 0), 0) / 60; // Convert minutes to hours
  }

  private calculateEstimatedCompletion(taskMetrics: TaskMetrics[]): string {
    const remainingHours = taskMetrics
      .filter(t => t.status !== 'done' && t.status !== 'cancelled')
      .reduce((total, task) => total + (task.estimatedHours - task.actualHours), 0);
    
    const velocity = this.calculateVelocity(taskMetrics);
    const weeksRemaining = velocity > 0 ? Math.ceil(remainingHours / velocity) : 0;
    
    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + (weeksRemaining * 7));
    
    return estimatedDate.toISOString().split('T')[0];
  }

  private calculateVelocity(taskMetrics: TaskMetrics[]): number {
    // Calculate tasks completed per week based on recent history
    const completedTasks = taskMetrics.filter(t => t.status === 'done' && t.endDate);
    if (completedTasks.length === 0) return 0;
    
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const recentlyCompleted = completedTasks.filter(t => 
      new Date(t.endDate!) > oneWeekAgo
    );
    
    return recentlyCompleted.length;
  }

  private generateBurndownData(taskMetrics: TaskMetrics[]): Array<{ date: string; remaining: number; completed: number }> {
    // Generate burndown chart data for the last 30 days
    const data: Array<{ date: string; remaining: number; completed: number }> = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const completedByDate = taskMetrics.filter(t => 
        t.status === 'done' && t.endDate && t.endDate <= dateStr
      ).length;
      
      data.push({
        date: dateStr,
        remaining: taskMetrics.length - completedByDate,
        completed: completedByDate
      });
    }
    
    return data;
  }

  private calculateCriticalPath(taskMetrics: TaskMetrics[]): string[] {
    // Simplified critical path calculation based on dependencies
    const criticalTasks = taskMetrics
      .filter(t => t.dependencies.length > 0 || 
                  taskMetrics.some(other => other.dependencies.includes(t.id)))
      .sort((a, b) => b.complexity - a.complexity)
      .slice(0, 10)
      .map(t => t.id);
    
    return criticalTasks;
  }

  private identifyRiskFactors(taskMetrics: TaskMetrics[]): ProjectMetrics['riskFactors'] {
    const risks: ProjectMetrics['riskFactors'] = [];
    
    // Dependency risks
    const tasksWithManyDeps = taskMetrics.filter(t => t.dependencies.length > 3);
    if (tasksWithManyDeps.length > 0) {
      risks.push({
        type: 'dependency',
        severity: 'medium',
        description: 'Tasks with complex dependency chains',
        tasks: tasksWithManyDeps.map(t => t.id)
      });
    }
    
    // Timeline risks
    const overdueTasks = this.getOverdueTasks(taskMetrics);
    if (overdueTasks.length > 0) {
      risks.push({
        type: 'timeline',
        severity: 'high',
        description: 'Overdue tasks affecting project timeline',
        tasks: overdueTasks.map(t => t.id)
      });
    }
    
    // Blocked tasks risk
    const blockedTasks = taskMetrics.filter(t => t.status === 'blocked');
    if (blockedTasks.length > 0) {
      risks.push({
        type: 'resource',
        severity: 'high',
        description: 'Blocked tasks requiring attention',
        tasks: blockedTasks.map(t => t.id)
      });
    }
    
    return risks;
  }

  private calculatePriorityBreakdown(taskMetrics: TaskMetrics[]): any {
    return {
      high: taskMetrics.filter(t => t.priority === 'high').length,
      medium: taskMetrics.filter(t => t.priority === 'medium').length,
      low: taskMetrics.filter(t => t.priority === 'low').length
    };
  }

  private calculateComplexityDistribution(taskMetrics: TaskMetrics[]): any {
    const distribution: { [key: string]: number } = {};
    taskMetrics.forEach(task => {
      const complexity = Math.ceil(task.complexity / 2) * 2; // Round to nearest even number
      const key = `${complexity-1}-${complexity}`;
      distribution[key] = (distribution[key] || 0) + 1;
    });
    return distribution;
  }

  private calculateVelocityTrend(taskMetrics: TaskMetrics[]): Array<{ week: string; completed: number; date: string }> {
    // Calculate velocity trend over the last 8 weeks
    const weeks: Array<{ week: string; completed: number; date: string }> = [];
    const today = new Date();
    
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - (i * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const completed = taskMetrics.filter(t => 
        t.status === 'done' && t.endDate &&
        new Date(t.endDate) >= weekStart && new Date(t.endDate) <= weekEnd
      ).length;
      
      weeks.push({
        week: `Week ${8-i}`,
        completed,
        date: weekStart.toISOString().split('T')[0]
      });
    }
    
    return weeks;
  }

  private getOverdueTasks(taskMetrics: TaskMetrics[]): TaskMetrics[] {
    const today = new Date();
    return taskMetrics.filter(t => 
      t.endDate && new Date(t.endDate) < today && t.status !== 'done'
    );
  }

  private getDependencyIssues(taskMetrics: TaskMetrics[]): Array<{ taskId: string; issue: string; dependencyId: string }> {
    const issues: Array<{ taskId: string; issue: string; dependencyId: string }> = [];
    
    taskMetrics.forEach(task => {
      task.dependencies.forEach(depId => {
        const dependency = taskMetrics.find(t => t.id === depId);
        if (!dependency) {
          issues.push({
            taskId: task.id,
            issue: 'Missing dependency',
            dependencyId: depId
          });
        } else if (dependency.status === 'blocked') {
          issues.push({
            taskId: task.id,
            issue: 'Dependency is blocked',
            dependencyId: depId
          });
        }
      });
    });
    
    return issues;
  }

  private generateRecommendations(projectMetrics: ProjectMetrics, taskMetrics: TaskMetrics[]): string[] {
    const recommendations: string[] = [];
    
    if (projectMetrics.blockedTasks > 0) {
      recommendations.push(`Address ${projectMetrics.blockedTasks} blocked tasks to improve project flow`);
    }
    
    if (projectMetrics.velocityPerWeek < 2) {
      recommendations.push('Consider reviewing task complexity or resource allocation to improve velocity');
    }
    
    const highComplexityTasks = taskMetrics.filter(t => t.complexity > 7 && t.status === 'pending');
    if (highComplexityTasks.length > 0) {
      recommendations.push('Break down high-complexity tasks into smaller subtasks');
    }
    
    if (projectMetrics.overallProgress < 20) {
      recommendations.push('Focus on completing foundational tasks to build momentum');
    }
    
    return recommendations;
  }

  /**
   * Load tasks data with proper format handling
   */
  public loadTasksData(): any {
    const tasksPath = join(this.projectRoot, '.taskmaster', 'tasks', 'tasks.json');
    if (existsSync(tasksPath)) {
      const data = JSON.parse(readFileSync(tasksPath, 'utf8'));
      // Handle Task Master format with tags (e.g., { master: { tasks: [] } })
      if (data.master && data.master.tasks) {
        return { tasks: data.master.tasks };
      }
      // Handle direct format (e.g., { tasks: [] })
      if (data.tasks) {
        return data;
      }
      // Fallback: treat the entire object as tasks array if it's an array
      if (Array.isArray(data)) {
        return { tasks: data };
      }
    }
    return { tasks: [] };
  }

  private loadTimeTrackingData(): TimeTrackingEntry[] {
    if (existsSync(this.timeTrackingPath)) {
      return JSON.parse(readFileSync(this.timeTrackingPath, 'utf8'));
    }
    return [];
  }

  private saveTimeTrackingData(data: TimeTrackingEntry[]): void {
    writeFileSync(this.timeTrackingPath, JSON.stringify(data, null, 2));
  }

  private convertToCSV(taskMetrics: TaskMetrics[]): string {
    const headers = ['ID', 'Title', 'Status', 'Priority', 'Complexity', 'Estimated Hours', 'Actual Hours', 'Completion %'];
    const rows = taskMetrics.map(task => [
      task.id,
      task.title,
      task.status,
      task.priority,
      task.complexity,
      task.estimatedHours,
      task.actualHours,
      task.completionPercentage
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}
