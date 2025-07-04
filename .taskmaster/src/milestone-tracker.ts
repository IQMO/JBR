import fs from 'fs';
import path from 'path';

/**
 * Represents a project milestone
 */
export interface Milestone {
  id: string;
  title: string;
  description: string;
  targetDate: string;
  completionDate?: string;
  status: 'planned' | 'in-progress' | 'completed' | 'overdue' | 'cancelled';
  requirements: MilestoneRequirement[];
  metrics: MilestoneMetrics;
  tags: string[];
}

/**
 * Requirements that must be met for milestone completion
 */
export interface MilestoneRequirement {
  id: string;
  description: string;
  type: 'task_completion' | 'code_coverage' | 'performance' | 'quality' | 'documentation';
  criteria: any; // Flexible criteria based on type
  status: 'pending' | 'met' | 'failed';
  evidence?: string; // Path to evidence or description
}

/**
 * Metrics associated with milestone completion
 */
export interface MilestoneMetrics {
  completionPercentage: number;
  taskCount: {
    total: number;
    completed: number;
    inProgress: number;
    blocked: number;
  };
  quality: {
    codeReviews: number;
    testsPassRate: number;
    coveragePercentage: number;
    bugs: number;
  };
  timeline: {
    startDate: string;
    targetDate: string;
    actualDate?: string;
    daysRemaining: number;
    isOnTrack: boolean;
  };
}

/**
 * Progress report for milestone tracking
 */
export interface MilestoneReport {
  milestone: Milestone;
  progress: {
    overall: number;
    requirements: number;
    tasks: number;
    quality: number;
  };
  insights: string[];
  recommendations: string[];
  risks: string[];
  nextSteps: string[];
}

/**
 * Milestone Tracker - Tracks project completion milestones
 */
export class MilestoneTracker {
  private projectRoot: string;
  private milestonesPath: string;
  private tasksPath: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.milestonesPath = path.join(projectRoot, '.taskmaster', 'milestones.json');
    this.tasksPath = path.join(projectRoot, '.taskmaster', 'tasks', 'tasks.json');
  }

  /**
   * Load milestones from file
   */
  private loadMilestones(): Milestone[] {
    try {
      if (!fs.existsSync(this.milestonesPath)) {
        return [];
      }
      const content = fs.readFileSync(this.milestonesPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.warn('Failed to load milestones:', error);
      return [];
    }
  }

  /**
   * Save milestones to file
   */
  private saveMilestones(milestones: Milestone[]): void {
    try {
      const dir = path.dirname(this.milestonesPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.milestonesPath, JSON.stringify(milestones, null, 2));
    } catch (error) {
      throw new Error(`Failed to save milestones: ${error}`);
    }
  }

  /**
   * Load tasks data
   */
  private loadTasks(): any {
    try {
      if (!fs.existsSync(this.tasksPath)) {
        return { tasks: [] };
      }
      const content = fs.readFileSync(this.tasksPath, 'utf-8');
      const data = JSON.parse(content);
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
      return { tasks: [] };
    } catch (error) {
      console.warn('Failed to load tasks:', error);
      return { tasks: [] };
    }
  }

  /**
   * Create a new milestone
   */
  createMilestone(
    title: string,
    description: string,
    targetDate: string,
    requirements: Omit<MilestoneRequirement, 'id' | 'status'>[],
    tags: string[] = []
  ): Milestone {
    const milestones = this.loadMilestones();
    const id = `ms-${Date.now()}`;
    
    const milestone: Milestone = {
      id,
      title,
      description,
      targetDate,
      status: 'planned',
      requirements: requirements.map((req, index) => ({
        ...req,
        id: `${id}-req-${index}`,
        status: 'pending'
      })),
      metrics: this.initializeMetrics(targetDate),
      tags
    };

    milestones.push(milestone);
    this.saveMilestones(milestones);
    return milestone;
  }

  /**
   * Update milestone status
   */
  updateMilestoneStatus(milestoneId: string, status: Milestone['status']): void {
    const milestones = this.loadMilestones();
    const milestone = milestones.find(m => m.id === milestoneId);
    
    if (!milestone) {
      throw new Error(`Milestone ${milestoneId} not found`);
    }

    milestone.status = status;
    if (status === 'completed') {
      milestone.completionDate = new Date().toISOString();
    }

    this.saveMilestones(milestones);
  }

  /**
   * Update milestone requirement status
   */
  updateRequirement(
    milestoneId: string,
    requirementId: string,
    status: MilestoneRequirement['status'],
    evidence?: string
  ): void {
    const milestones = this.loadMilestones();
    const milestone = milestones.find(m => m.id === milestoneId);
    
    if (!milestone) {
      throw new Error(`Milestone ${milestoneId} not found`);
    }

    const requirement = milestone.requirements.find(r => r.id === requirementId);
    if (!requirement) {
      throw new Error(`Requirement ${requirementId} not found`);
    }

    requirement.status = status;
    if (evidence) {
      requirement.evidence = evidence;
    }

    this.saveMilestones(milestones);
  }

  /**
   * Initialize milestone metrics
   */
  private initializeMetrics(targetDate: string): MilestoneMetrics {
    const now = new Date();
    const target = new Date(targetDate);
    const daysRemaining = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      completionPercentage: 0,
      taskCount: {
        total: 0,
        completed: 0,
        inProgress: 0,
        blocked: 0
      },
      quality: {
        codeReviews: 0,
        testsPassRate: 0,
        coveragePercentage: 0,
        bugs: 0
      },
      timeline: {
        startDate: now.toISOString(),
        targetDate,
        daysRemaining,
        isOnTrack: daysRemaining > 0
      }
    };
  }

  /**
   * Generate milestone progress report
   */
  generateMilestoneReport(milestoneId: string): MilestoneReport {
    const milestones = this.loadMilestones();
    const milestone = milestones.find(m => m.id === milestoneId);
    
    if (!milestone) {
      throw new Error(`Milestone ${milestoneId} not found`);
    }

    // Update metrics before generating report
    this.updateMilestoneMetrics(milestone);

    const progress = this.calculateProgress(milestone);
    const insights = this.generateInsights(milestone, progress);
    const recommendations = this.generateRecommendations(milestone, progress);
    const risks = this.identifyRisks(milestone, progress);
    const nextSteps = this.generateNextSteps(milestone, progress);

    return {
      milestone,
      progress,
      insights,
      recommendations,
      risks,
      nextSteps
    };
  }

  /**
   * Update milestone metrics based on current task status
   */
  private updateMilestoneMetrics(milestone: Milestone): void {
    const tasksData = this.loadTasks();
    const tasks = tasksData.tasks || [];

    // Filter tasks related to this milestone (by tags or date range)
    const milestoneTasks = this.getMilestoneTasks(milestone, tasks);

    // Update task counts
    milestone.metrics.taskCount = {
      total: milestoneTasks.length,
      completed: milestoneTasks.filter(t => t.status === 'done').length,
      inProgress: milestoneTasks.filter(t => t.status === 'in-progress').length,
      blocked: milestoneTasks.filter(t => t.status === 'blocked').length
    };

    // Update completion percentage
    milestone.metrics.completionPercentage = milestoneTasks.length > 0
      ? (milestone.metrics.taskCount.completed / milestone.metrics.taskCount.total) * 100
      : 0;

    // Update timeline
    const now = new Date();
    const target = new Date(milestone.targetDate);
    milestone.metrics.timeline.daysRemaining = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    milestone.metrics.timeline.isOnTrack = this.isOnTrack(milestone);
  }

  /**
   * Get tasks associated with a milestone
   */
  private getMilestoneTasks(milestone: Milestone, tasks: any[]): any[] {
    // Match by tags or other criteria
    return tasks.filter(task => {
      // Check if task tags overlap with milestone tags
      const taskTags = task.tags || [];
      return milestone.tags.some(tag => taskTags.includes(tag)) ||
             // Or check if task is within milestone timeframe
             this.isTaskInMilestoneTimeframe(task, milestone);
    });
  }

  /**
   * Check if task falls within milestone timeframe
   */
  private isTaskInMilestoneTimeframe(task: any, milestone: Milestone): boolean {
    // Simple heuristic - could be enhanced with actual task dates
    return task.priority === 'high' || task.status !== 'deferred';
  }

  /**
   * Calculate overall progress scores
   */
  private calculateProgress(milestone: Milestone): MilestoneReport['progress'] {
    const requirementsMet = milestone.requirements.filter(r => r.status === 'met').length;
    const requirementsTotal = milestone.requirements.length;
    
    return {
      overall: milestone.metrics.completionPercentage,
      requirements: requirementsTotal > 0 ? (requirementsMet / requirementsTotal) * 100 : 0,
      tasks: milestone.metrics.completionPercentage,
      quality: this.calculateQualityScore(milestone)
    };
  }

  /**
   * Calculate quality score based on metrics
   */
  private calculateQualityScore(milestone: Milestone): number {
    const metrics = milestone.metrics.quality;
    // Simple quality score calculation
    const coverageScore = metrics.coveragePercentage;
    const testScore = metrics.testsPassRate;
    const bugPenalty = Math.max(0, 100 - (metrics.bugs * 10));
    
    return (coverageScore + testScore + bugPenalty) / 3;
  }

  /**
   * Check if milestone is on track
   */
  private isOnTrack(milestone: Milestone): boolean {
    const timeProgress = this.getTimeProgress(milestone);
    const completionProgress = milestone.metrics.completionPercentage;
    
    // Consider on track if completion is within 20% of time progress
    return completionProgress >= (timeProgress - 20);
  }

  /**
   * Get time progress percentage
   */
  private getTimeProgress(milestone: Milestone): number {
    const start = new Date(milestone.metrics.timeline.startDate);
    const target = new Date(milestone.targetDate);
    const now = new Date();
    
    const totalTime = target.getTime() - start.getTime();
    const elapsedTime = now.getTime() - start.getTime();
    
    return Math.min(100, Math.max(0, (elapsedTime / totalTime) * 100));
  }

  /**
   * Generate insights about milestone progress
   */
  private generateInsights(milestone: Milestone, progress: MilestoneReport['progress']): string[] {
    const insights: string[] = [];
    
    if (progress.overall > 80) {
      insights.push('Milestone is nearing completion with strong progress');
    } else if (progress.overall > 50) {
      insights.push('Milestone is progressing steadily');
    } else if (progress.overall > 20) {
      insights.push('Milestone has moderate progress but needs acceleration');
    } else {
      insights.push('Milestone requires immediate attention and focus');
    }

    if (milestone.metrics.timeline.daysRemaining < 0) {
      insights.push('Milestone is overdue and requires immediate action');
    } else if (milestone.metrics.timeline.daysRemaining < 7) {
      insights.push('Milestone deadline is approaching within a week');
    }

    if (progress.quality < 60) {
      insights.push('Quality metrics are below acceptable thresholds');
    }

    const completedReqs = milestone.requirements.filter(r => r.status === 'met').length;
    if (completedReqs === 0) {
      insights.push('No requirements have been completed yet');
    } else if (completedReqs === milestone.requirements.length) {
      insights.push('All requirements have been successfully met');
    }

    return insights;
  }

  /**
   * Generate recommendations for milestone completion
   */
  private generateRecommendations(milestone: Milestone, progress: MilestoneReport['progress']): string[] {
    const recommendations: string[] = [];
    
    if (progress.overall < 50 && milestone.metrics.timeline.daysRemaining < 14) {
      recommendations.push('Consider extending timeline or reducing scope');
      recommendations.push('Allocate additional resources to critical tasks');
    }

    if (milestone.metrics.taskCount.blocked > 0) {
      recommendations.push('Prioritize unblocking blocked tasks');
    }

    if (progress.quality < 70) {
      recommendations.push('Increase focus on code review and testing');
      recommendations.push('Consider implementing quality gates');
    }

    const pendingReqs = milestone.requirements.filter(r => r.status === 'pending').length;
    if (pendingReqs > 0) {
      recommendations.push('Review and address pending requirements');
    }

    if (milestone.metrics.taskCount.inProgress > milestone.metrics.taskCount.completed) {
      recommendations.push('Focus on completing in-progress tasks before starting new ones');
    }

    return recommendations;
  }

  /**
   * Identify risks to milestone completion
   */
  private identifyRisks(milestone: Milestone, progress: MilestoneReport['progress']): string[] {
    const risks: string[] = [];
    
    if (!milestone.metrics.timeline.isOnTrack) {
      risks.push('Schedule risk: Progress is behind timeline expectations');
    }

    if (milestone.metrics.taskCount.blocked > milestone.metrics.taskCount.completed / 2) {
      risks.push('Dependency risk: High number of blocked tasks');
    }

    if (progress.quality < 50) {
      risks.push('Quality risk: Low quality metrics may impact delivery');
    }

    const failedReqs = milestone.requirements.filter(r => r.status === 'failed').length;
    if (failedReqs > 0) {
      risks.push('Scope risk: Some requirements have failed validation');
    }

    if (milestone.metrics.timeline.daysRemaining < 0) {
      risks.push('Critical risk: Milestone is already overdue');
    }

    return risks;
  }

  /**
   * Generate next steps for milestone progress
   */
  private generateNextSteps(milestone: Milestone, progress: MilestoneReport['progress']): string[] {
    const nextSteps: string[] = [];
    
    // Prioritize based on current status
    if (milestone.metrics.taskCount.blocked > 0) {
      nextSteps.push('Unblock highest priority blocked tasks');
    }

    const pendingReqs = milestone.requirements.filter(r => r.status === 'pending');
    if (pendingReqs.length > 0) {
      nextSteps.push(`Address pending requirements: ${pendingReqs.slice(0, 3).map(r => r.description).join(', ')}`);
    }

    if (progress.overall < 80) {
      nextSteps.push('Complete remaining in-progress tasks');
    }

    if (progress.quality < 70) {
      nextSteps.push('Conduct code reviews and improve test coverage');
    }

    if (milestone.status === 'planned') {
      nextSteps.push('Mark milestone as in-progress to begin tracking');
    }

    if (progress.overall > 90 && progress.requirements > 90) {
      nextSteps.push('Prepare for milestone completion and review');
    }

    return nextSteps;
  }

  /**
   * List all milestones
   */
  listMilestones(): Milestone[] {
    return this.loadMilestones();
  }

  /**
   * Get milestone by ID
   */
  getMilestone(milestoneId: string): Milestone | undefined {
    const milestones = this.loadMilestones();
    return milestones.find(m => m.id === milestoneId);
  }

  /**
   * Delete milestone
   */
  deleteMilestone(milestoneId: string): void {
    const milestones = this.loadMilestones();
    const filteredMilestones = milestones.filter(m => m.id !== milestoneId);
    
    if (filteredMilestones.length === milestones.length) {
      throw new Error(`Milestone ${milestoneId} not found`);
    }

    this.saveMilestones(filteredMilestones);
  }
}
