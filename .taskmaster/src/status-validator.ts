/**
 * Automated Status Validation System
 * Validates task statuses against business rules and dependency constraints
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  validator: (task: any, allTasks: any[], context: ValidationContext) => ValidationResult;
}

export interface ValidationResult {
  isValid: boolean;
  message: string;
  suggestions?: string[];
  autoFix?: () => void;
}

export interface ValidationContext {
  projectRoot: string;
  tasksData: any;
  validationConfig: ValidationConfig;
}

export interface ValidationConfig {
  rules: {
    enabled: string[];
    disabled: string[];
  };
  autoFix: {
    enabled: boolean;
    backupBeforeFix: boolean;
  };
  notifications: {
    onError: boolean;
    onWarning: boolean;
    onAutoFix: boolean;
  };
  scheduling: {
    enabled: boolean;
    interval: string; // cron format
  };
}

export interface ValidationReport {
  timestamp: string;
  summary: {
    totalTasks: number;
    validTasks: number;
    invalidTasks: number;
    warnings: number;
    errors: number;
    autoFixed: number;
  };
  issues: Array<{
    taskId: string;
    taskTitle: string;
    ruleId: string;
    ruleName: string;
    severity: string;
    message: string;
    suggestions: string[];
    autoFixed: boolean;
  }>;
  recommendations: string[];
}

export class StatusValidator {
  private projectRoot: string;
  private config: ValidationConfig;
  private rules: ValidationRule[];

  constructor(projectRoot: string, config?: Partial<ValidationConfig>) {
    this.projectRoot = projectRoot;
    this.config = {
      rules: {
        enabled: [
          'dependency-completion',
          'status-consistency',
          'blocking-validation',
          'completion-requirements',
          'parent-child-sync',
          'deadline-validation',
          'priority-consistency'
        ],
        disabled: []
      },
      autoFix: {
        enabled: true,
        backupBeforeFix: true
      },
      notifications: {
        onError: true,
        onWarning: false,
        onAutoFix: true
      },
      scheduling: {
        enabled: false,
        interval: '0 */6 * * *' // Every 6 hours
      },
      ...config
    };

    this.rules = this.initializeValidationRules();
  }

  /**
   * Validate all tasks against configured rules
   */
  public validateAllTasks(): ValidationReport {
    const tasksData = this.loadTasksData();
    const context: ValidationContext = {
      projectRoot: this.projectRoot,
      tasksData,
      validationConfig: this.config
    };

    const report: ValidationReport = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTasks: 0,
        validTasks: 0,
        invalidTasks: 0,
        warnings: 0,
        errors: 0,
        autoFixed: 0
      },
      issues: [],
      recommendations: []
    };

    if (!tasksData.tasks) {
      return report;
    }

    // Validate each task
    for (const task of tasksData.tasks) {
      report.summary.totalTasks++;
      let taskValid = true;

      // Run enabled validation rules
      for (const rule of this.rules) {
        if (!this.config.rules.enabled.includes(rule.id)) continue;
        if (this.config.rules.disabled.includes(rule.id)) continue;

        const result = rule.validator(task, tasksData.tasks, context);
        
        if (!result.isValid) {
          taskValid = false;
          
          const issue = {
            taskId: task.id.toString(),
            taskTitle: task.title,
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: result.message,
            suggestions: result.suggestions || [],
            autoFixed: false
          };

          // Attempt auto-fix if enabled
          if (this.config.autoFix.enabled && result.autoFix) {
            try {
              if (this.config.autoFix.backupBeforeFix) {
                this.createBackup();
              }
              
              result.autoFix();
              issue.autoFixed = true;
              report.summary.autoFixed++;
              
              if (this.config.notifications.onAutoFix) {
                console.log(`🔧 Auto-fixed: ${rule.name} for task ${task.id}`);
              }
            } catch (error) {
              console.error(`Failed to auto-fix ${rule.name} for task ${task.id}:`, error);
            }
          }

          report.issues.push(issue);
          
          if (rule.severity === 'error') {
            report.summary.errors++;
          } else if (rule.severity === 'warning') {
            report.summary.warnings++;
          }
        }
      }

      if (taskValid) {
        report.summary.validTasks++;
      } else {
        report.summary.invalidTasks++;
      }

      // Validate subtasks if they exist
      if (task.subtasks) {
        for (const subtask of task.subtasks) {
          report.summary.totalTasks++;
          let subtaskValid = true;

          for (const rule of this.rules) {
            if (!this.config.rules.enabled.includes(rule.id)) continue;
            if (this.config.rules.disabled.includes(rule.id)) continue;

            const result = rule.validator(subtask, tasksData.tasks, context);
            
            if (!result.isValid) {
              subtaskValid = false;
              
              const issue = {
                taskId: `${task.id}.${subtask.id}`,
                taskTitle: `${task.title} → ${subtask.title}`,
                ruleId: rule.id,
                ruleName: rule.name,
                severity: rule.severity,
                message: result.message,
                suggestions: result.suggestions || [],
                autoFixed: false
              };

              report.issues.push(issue);
              
              if (rule.severity === 'error') {
                report.summary.errors++;
              } else if (rule.severity === 'warning') {
                report.summary.warnings++;
              }
            }
          }

          if (subtaskValid) {
            report.summary.validTasks++;
          } else {
            report.summary.invalidTasks++;
          }
        }
      }
    }

    // Generate recommendations
    report.recommendations = this.generateRecommendations(report);

    // Save validation report
    this.saveValidationReport(report);

    return report;
  }

  /**
   * Validate a specific task
   */
  public validateTask(taskId: string): ValidationResult[] {
    const tasksData = this.loadTasksData();
    const context: ValidationContext = {
      projectRoot: this.projectRoot,
      tasksData,
      validationConfig: this.config
    };

    const task = this.findTask(tasksData.tasks, taskId);
    if (!task) {
      return [{
        isValid: false,
        message: `Task ${taskId} not found`
      }];
    }

    const results: ValidationResult[] = [];
    
    for (const rule of this.rules) {
      if (!this.config.rules.enabled.includes(rule.id)) continue;
      if (this.config.rules.disabled.includes(rule.id)) continue;

      const result = rule.validator(task, tasksData.tasks, context);
      if (!result.isValid) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Initialize validation rules
   */
  private initializeValidationRules(): ValidationRule[] {
    return [
      {
        id: 'dependency-completion',
        name: 'Dependency Completion Check',
        description: 'Ensures tasks cannot be marked as done if their dependencies are not completed',
        severity: 'error',
        validator: (task, allTasks, context) => {
          if (task.status !== 'done') {
            return { isValid: true, message: 'Task not marked as done' };
          }

          if (!task.dependencies || task.dependencies.length === 0) {
            return { isValid: true, message: 'No dependencies to check' };
          }

          const incompleteDeps = task.dependencies.filter((depId: string) => {
            const depTask = this.findTask(allTasks, depId);
            return !depTask || depTask.status !== 'done';
          });

          if (incompleteDeps.length > 0) {
            return {
              isValid: false,
              message: `Task ${task.id} is marked as done but has incomplete dependencies: ${incompleteDeps.join(', ')}`,
              suggestions: [
                'Complete dependency tasks first',
                'Remove invalid dependencies',
                'Change task status to in-progress or pending'
              ]
            };
          }

          return { isValid: true, message: 'All dependencies completed' };
        }
      },

      {
        id: 'status-consistency',
        name: 'Status Consistency Check',
        description: 'Validates that task statuses are consistent with their content and progress',
        severity: 'warning',
        validator: (task, allTasks, context) => {
          // Check if task has subtasks
          if (task.subtasks && task.subtasks.length > 0) {
            const completedSubtasks = task.subtasks.filter((st: any) => st.status === 'done').length;
            const totalSubtasks = task.subtasks.length;
            const completionRate = completedSubtasks / totalSubtasks;

            // Parent task status should reflect subtask completion
            if (completionRate === 1 && task.status !== 'done') {
              return {
                isValid: false,
                message: `Task ${task.id} has all subtasks completed but is not marked as done`,
                suggestions: ['Mark task as done', 'Review subtask completion'],
                autoFix: () => {
                  task.status = 'done';
                  this.saveTasksData(context.tasksData);
                }
              };
            }

            if (completionRate === 0 && task.status === 'done') {
              return {
                isValid: false,
                message: `Task ${task.id} is marked as done but has no completed subtasks`,
                suggestions: ['Review task status', 'Complete subtasks first']
              };
            }

            if (completionRate > 0 && completionRate < 1 && task.status === 'pending') {
              return {
                isValid: false,
                message: `Task ${task.id} has partially completed subtasks but is still marked as pending`,
                suggestions: ['Update status to in-progress'],
                autoFix: () => {
                  task.status = 'in-progress';
                  this.saveTasksData(context.tasksData);
                }
              };
            }
          }

          return { isValid: true, message: 'Status is consistent' };
        }
      },

      {
        id: 'blocking-validation',
        name: 'Blocking Task Validation',
        description: 'Ensures blocked tasks have valid blocking reasons and are not dependencies for done tasks',
        severity: 'error',
        validator: (task, allTasks, context) => {
          if (task.status !== 'blocked') {
            return { isValid: true, message: 'Task is not blocked' };
          }

          // Check if blocked task has blocking reasons
          if (!task.blockers || task.blockers.length === 0) {
            return {
              isValid: false,
              message: `Blocked task ${task.id} has no specified blockers`,
              suggestions: [
                'Add blocker details to task',
                'Change status if not actually blocked',
                'Create issues for blockers'
              ]
            };
          }

          // Check if any tasks depend on this blocked task and are marked as done
          const dependentTasks = allTasks.filter((t: any) => 
            t.dependencies && t.dependencies.includes(task.id.toString()) && t.status === 'done'
          );

          if (dependentTasks.length > 0) {
            return {
              isValid: false,
              message: `Blocked task ${task.id} has dependent tasks marked as done: ${dependentTasks.map((t: any) => t.id).join(', ')}`,
              suggestions: [
                'Resolve blocking issues',
                'Review dependent task statuses',
                'Update task dependencies'
              ]
            };
          }

          return { isValid: true, message: 'Blocking validation passed' };
        }
      },

      {
        id: 'completion-requirements',
        name: 'Completion Requirements Check',
        description: 'Validates that tasks marked as done meet their completion criteria',
        severity: 'error',
        validator: (task, allTasks, context) => {
          if (task.status !== 'done') {
            return { isValid: true, message: 'Task not marked as done' };
          }

          // Check if task has required fields when marked as done
          if (!task.details || task.details.trim().length < 10) {
            return {
              isValid: false,
              message: `Completed task ${task.id} lacks sufficient details`,
              suggestions: [
                'Add comprehensive task details',
                'Document completion steps',
                'Include verification information'
              ]
            };
          }

          // Check if test strategy is defined for completed tasks
          if (!task.testStrategy) {
            return {
              isValid: false,
              message: `Completed task ${task.id} has no test strategy defined`,
              suggestions: [
                'Define test strategy',
                'Add verification steps',
                'Document quality assurance process'
              ]
            };
          }

          return { isValid: true, message: 'Completion requirements met' };
        }
      },

      {
        id: 'parent-child-sync',
        name: 'Parent-Child Status Synchronization',
        description: 'Ensures parent task statuses are synchronized with their subtasks',
        severity: 'warning',
        validator: (task, allTasks, context) => {
          if (!task.subtasks || task.subtasks.length === 0) {
            return { isValid: true, message: 'No subtasks to synchronize' };
          }

          const subtaskStatuses = task.subtasks.map((st: any) => st.status);
          const uniqueStatuses = [...new Set(subtaskStatuses)];

          // If all subtasks are done, parent should be done or in review
          if (uniqueStatuses.length === 1 && uniqueStatuses[0] === 'done') {
            if (task.status !== 'done' && task.status !== 'review') {
              return {
                isValid: false,
                message: `Task ${task.id} has all subtasks completed but parent status is ${task.status}`,
                suggestions: ['Update parent status to done or review'],
                autoFix: () => {
                  task.status = 'review';
                  this.saveTasksData(context.tasksData);
                }
              };
            }
          }

          // If no subtasks are started, parent should be pending
          if (uniqueStatuses.length === 1 && uniqueStatuses[0] === 'pending') {
            if (task.status !== 'pending') {
              return {
                isValid: false,
                message: `Task ${task.id} has all subtasks pending but parent status is ${task.status}`,
                suggestions: ['Update parent status to pending'],
                autoFix: () => {
                  task.status = 'pending';
                  this.saveTasksData(context.tasksData);
                }
              };
            }
          }

          return { isValid: true, message: 'Parent-child status synchronized' };
        }
      },

      {
        id: 'deadline-validation',
        name: 'Deadline Validation',
        description: 'Validates task deadlines and identifies overdue tasks',
        severity: 'warning',
        validator: (task, allTasks, context) => {
          if (!task.endDate) {
            return { isValid: true, message: 'No deadline set' };
          }

          const deadline = new Date(task.endDate);
          const now = new Date();

          if (deadline < now && task.status !== 'done' && task.status !== 'cancelled') {
            return {
              isValid: false,
              message: `Task ${task.id} is overdue (deadline: ${deadline.toLocaleDateString()})`,
              suggestions: [
                'Update deadline if still relevant',
                'Complete task urgently',
                'Mark as cancelled if no longer needed',
                'Escalate to project manager'
              ]
            };
          }

          // Check if deadline is unrealistic (in the past for pending tasks)
          if (deadline < now && task.status === 'pending') {
            return {
              isValid: false,
              message: `Pending task ${task.id} has deadline in the past`,
              suggestions: [
                'Update deadline to realistic date',
                'Start task immediately',
                'Review task priority'
              ]
            };
          }

          return { isValid: true, message: 'Deadline validation passed' };
        }
      },

      {
        id: 'priority-consistency',
        name: 'Priority Consistency Check',
        description: 'Validates that task priorities are consistent with their urgency and dependencies',
        severity: 'info',
        validator: (task, allTasks, context) => {
          // High priority tasks shouldn't be pending for too long
          if (task.priority === 'high' && task.status === 'pending') {
            const lastUpdated = task.lastUpdated ? new Date(task.lastUpdated) : new Date();
            const daysSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);

            if (daysSinceUpdate > 3) {
              return {
                isValid: false,
                message: `High priority task ${task.id} has been pending for ${Math.floor(daysSinceUpdate)} days`,
                suggestions: [
                  'Start high priority task immediately',
                  'Reassign if resources unavailable',
                  'Review priority classification',
                  'Break down into smaller tasks'
                ]
              };
            }
          }

          // Critical priority tasks should have clear dependencies
          if (task.priority === 'critical') {
            const dependentTasks = allTasks.filter((t: any) => 
              t.dependencies && t.dependencies.includes(task.id.toString())
            );

            if (dependentTasks.length === 0) {
              return {
                isValid: false,
                message: `Critical priority task ${task.id} has no dependent tasks`,
                suggestions: [
                  'Review priority classification',
                  'Identify dependent tasks',
                  'Document critical path importance'
                ]
              };
            }
          }

          return { isValid: true, message: 'Priority consistency validated' };
        }
      }
    ];
  }

  private findTask(tasks: any[], taskId: string): any {
    for (const task of tasks) {
      if (task.id.toString() === taskId) {
        return task;
      }
      if (task.subtasks) {
        for (const subtask of task.subtasks) {
          if (`${task.id}.${subtask.id}` === taskId) {
            return subtask;
          }
        }
      }
    }
    return null;
  }

  private generateRecommendations(report: ValidationReport): string[] {
    const recommendations: string[] = [];

    if (report.summary.errors > 0) {
      recommendations.push(`Address ${report.summary.errors} critical errors immediately`);
    }

    if (report.summary.warnings > 5) {
      recommendations.push('Review warning-level issues to improve task quality');
    }

    if (report.summary.autoFixed > 0) {
      recommendations.push(`Review ${report.summary.autoFixed} auto-fixed issues for accuracy`);
    }

    const errorRate = report.summary.errors / report.summary.totalTasks;
    if (errorRate > 0.1) {
      recommendations.push('High error rate detected - consider team training on task management');
    }

    return recommendations;
  }

  private loadTasksData(): any {
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

  private saveTasksData(data: any): void {
    const tasksPath = join(this.projectRoot, '.taskmaster', 'tasks', 'tasks.json');
    writeFileSync(tasksPath, JSON.stringify(data, null, 2));
  }

  private saveValidationReport(report: ValidationReport): void {
    const reportsDir = join(this.projectRoot, '.taskmaster', 'reports');
    const reportPath = join(reportsDir, `validation-report-${new Date().toISOString().split('T')[0]}.json`);
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
  }

  private createBackup(): void {
    const tasksPath = join(this.projectRoot, '.taskmaster', 'tasks', 'tasks.json');
    const backupPath = join(this.projectRoot, '.taskmaster', 'backups', `tasks-backup-${Date.now()}.json`);
    
    if (existsSync(tasksPath)) {
      const data = readFileSync(tasksPath);
      writeFileSync(backupPath, data);
    }
  }
}
