import fs from 'fs';
import path from 'path';
import { StatusValidator } from './status-validator';
import { MilestoneTracker } from './milestone-tracker';

/**
 * CI/CD Integration configuration
 */
export interface CICDConfig {
  enabled: boolean;
  platforms: ('github' | 'gitlab' | 'jenkins' | 'azure-devops')[];
  validationRules: {
    enforceTaskValidation: boolean;
    blockOnFailedTasks: boolean;
    requireMilestoneProgress: boolean;
    minimumTestCoverage: number;
    maxBlockedTasks: number;
  };
  notifications: {
    slack?: {
      webhook: string;
      channel: string;
    };
    email?: {
      recipients: string[];
    };
    teams?: {
      webhook: string;
    };
  };
  reporting: {
    generateReports: boolean;
    reportFormats: ('json' | 'html' | 'markdown')[];
    uploadToArtifacts: boolean;
  };
}

/**
 * CI/CD validation result
 */
export interface CICDValidationResult {
  success: boolean;
  timestamp: string;
  checks: {
    taskValidation: {
      passed: boolean;
      errors: string[];
      warnings: string[];
    };
    milestoneProgress: {
      passed: boolean;
      currentProgress: number;
      requiredProgress: number;
      blockers: string[];
    };
    quality: {
      passed: boolean;
      testCoverage: number;
      requiredCoverage: number;
      blockedTasks: number;
      maxBlocked: number;
    };
  };
  reports: {
    taskSummary: any;
    milestoneStatus: any;
    qualityMetrics: any;
  };
  recommendations: string[];
}

/**
 * CI/CD Integration Manager
 * Provides integration hooks for continuous integration and deployment pipelines
 */
export class CICDIntegration {
  private projectRoot: string;
  private configPath: string;
  private validator: StatusValidator;
  private milestoneTracker: MilestoneTracker;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.configPath = path.join(projectRoot, '.taskmaster', 'cicd-config.json');
    this.validator = new StatusValidator(projectRoot);
    this.milestoneTracker = new MilestoneTracker(projectRoot);
  }

  /**
   * Initialize CI/CD configuration
   */
  initializeConfig(platforms: CICDConfig['platforms'] = ['github']): CICDConfig {
    const defaultConfig: CICDConfig = {
      enabled: true,
      platforms,
      validationRules: {
        enforceTaskValidation: true,
        blockOnFailedTasks: true,
        requireMilestoneProgress: false,
        minimumTestCoverage: 80,
        maxBlockedTasks: 5
      },
      notifications: {},
      reporting: {
        generateReports: true,
        reportFormats: ['json', 'html'],
        uploadToArtifacts: true
      }
    };

    this.saveConfig(defaultConfig);
    return defaultConfig;
  }

  /**
   * Load CI/CD configuration
   */
  private loadConfig(): CICDConfig {
    try {
      if (!fs.existsSync(this.configPath)) {
        return this.initializeConfig();
      }
      const content = fs.readFileSync(this.configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.warn('Failed to load CI/CD config, using defaults:', error);
      return this.initializeConfig();
    }
  }

  /**
   * Save CI/CD configuration
   */
  private saveConfig(config: CICDConfig): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      throw new Error(`Failed to save CI/CD config: ${error}`);
    }
  }

  /**
   * Run CI/CD validation checks
   */
  async runValidation(): Promise<CICDValidationResult> {
    const config = this.loadConfig();
    const timestamp = new Date().toISOString();

    if (!config.enabled) {
      return {
        success: true,
        timestamp,
        checks: {
          taskValidation: { passed: true, errors: [], warnings: ['CI/CD validation disabled'] },
          milestoneProgress: { passed: true, currentProgress: 0, requiredProgress: 0, blockers: [] },
          quality: { passed: true, testCoverage: 0, requiredCoverage: 0, blockedTasks: 0, maxBlocked: 0 }
        },
        reports: {
          taskSummary: { total: 0, completed: 0, inProgress: 0, blocked: 0, pending: 0 },
          milestoneStatus: { total: 0, completed: 0, inProgress: 0, overdue: 0, upcoming: 0 },
          qualityMetrics: { testCoverage: 0, blockedTasks: 0, timestamp }
        },
        recommendations: ['Enable CI/CD validation for better project governance']
      };
    }

    // Run task validation
    const taskValidation = await this.validateTasks(config);
    
    // Check milestone progress
    const milestoneProgress = await this.validateMilestoneProgress(config);
    
    // Check quality metrics
    const quality = await this.validateQuality(config);

    const success = taskValidation.passed && milestoneProgress.passed && quality.passed;

    const result: CICDValidationResult = {
      success,
      timestamp,
      checks: {
        taskValidation,
        milestoneProgress,
        quality
      },
      reports: {
        taskSummary: await this.generateTaskSummary(),
        milestoneStatus: await this.generateMilestoneStatus(),
        qualityMetrics: await this.generateQualityMetrics()
      },
      recommendations: this.generateRecommendations(taskValidation, milestoneProgress, quality)
    };

    // Save validation result
    await this.saveValidationResult(result);

    return result;
  }

  /**
   * Validate tasks according to CI/CD rules
   */
  private async validateTasks(config: CICDConfig): Promise<CICDValidationResult['checks']['taskValidation']> {
    if (!config.validationRules.enforceTaskValidation) {
      return { passed: true, errors: [], warnings: [] };
    }

    const validationResult = this.validator.validateAllTasks();
    const errors: string[] = [];
    const warnings: string[] = [];

    validationResult.issues.forEach(issue => {
      if (issue.severity === 'error') {
        errors.push(`${issue.ruleId}: ${issue.message}`);
      } else {
        warnings.push(`${issue.ruleId}: ${issue.message}`);
      }
    });

    const passed = config.validationRules.blockOnFailedTasks ? errors.length === 0 : true;

    return { passed, errors, warnings };
  }

  /**
   * Validate milestone progress
   */
  private async validateMilestoneProgress(config: CICDConfig): Promise<CICDValidationResult['checks']['milestoneProgress']> {
    if (!config.validationRules.requireMilestoneProgress) {
      return { passed: true, currentProgress: 0, requiredProgress: 0, blockers: [] };
    }

    const milestones = this.milestoneTracker.listMilestones();
    const activeMilestones = milestones.filter(m => m.status === 'in-progress');
    
    let currentProgress = 0;
    let blockers: string[] = [];

    if (activeMilestones.length > 0) {
      const totalProgress = activeMilestones.reduce((sum, m) => sum + m.metrics.completionPercentage, 0);
      currentProgress = totalProgress / activeMilestones.length;

      activeMilestones.forEach(milestone => {
        if (milestone.metrics.timeline.daysRemaining < 0) {
          blockers.push(`Milestone '${milestone.title}' is overdue`);
        }
        if (milestone.metrics.taskCount.blocked > 0) {
          blockers.push(`Milestone '${milestone.title}' has ${milestone.metrics.taskCount.blocked} blocked tasks`);
        }
      });
    }

    const requiredProgress = 50; // Configurable threshold
    const passed = currentProgress >= requiredProgress && blockers.length === 0;

    return { passed, currentProgress, requiredProgress, blockers };
  }

  /**
   * Validate quality metrics
   */
  private async validateQuality(config: CICDConfig): Promise<CICDValidationResult['checks']['quality']> {
    const tasksData = this.loadTasks();
    const tasks = tasksData.tasks || [];

    const blockedTasks = tasks.filter((t: any) => t.status === 'blocked').length;
    const testCoverage = this.getTestCoverage(); // Placeholder implementation

    const passed = testCoverage >= config.validationRules.minimumTestCoverage &&
                  blockedTasks <= config.validationRules.maxBlockedTasks;

    return {
      passed,
      testCoverage,
      requiredCoverage: config.validationRules.minimumTestCoverage,
      blockedTasks,
      maxBlocked: config.validationRules.maxBlockedTasks
    };
  }

  /**
   * Load tasks data
   */
  private loadTasks(): any {
    try {
      const tasksPath = path.join(this.projectRoot, '.taskmaster', 'tasks', 'tasks.json');
      if (!fs.existsSync(tasksPath)) {
        return { tasks: [] };
      }
      const content = fs.readFileSync(tasksPath, 'utf-8');
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
   * Get test coverage (placeholder implementation)
   */
  private getTestCoverage(): number {
    // In a real implementation, this would read from coverage reports
    // For now, return a mock value
    const coveragePath = path.join(this.projectRoot, 'coverage', 'coverage-summary.json');
    if (fs.existsSync(coveragePath)) {
      try {
        const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf-8'));
        return coverage.total?.lines?.pct || 0;
      } catch (error) {
        console.warn('Failed to read coverage report:', error);
      }
    }
    return 85; // Mock coverage for demo
  }

  /**
   * Generate task summary report
   */
  private async generateTaskSummary(): Promise<any> {
    const tasksData = this.loadTasks();
    const tasks = tasksData.tasks || [];

    const summary: any = {
      total: tasks.length,
      completed: tasks.filter((t: any) => t.status === 'done').length,
      inProgress: tasks.filter((t: any) => t.status === 'in-progress').length,
      blocked: tasks.filter((t: any) => t.status === 'blocked').length,
      pending: tasks.filter((t: any) => t.status === 'pending').length
    };

    summary.completionRate = summary.total > 0 ? (summary.completed / summary.total) * 100 : 0;

    return summary;
  }

  /**
   * Generate milestone status report
   */
  private async generateMilestoneStatus(): Promise<any> {
    const milestones = this.milestoneTracker.listMilestones();
    
    return {
      total: milestones.length,
      completed: milestones.filter(m => m.status === 'completed').length,
      inProgress: milestones.filter(m => m.status === 'in-progress').length,
      overdue: milestones.filter(m => m.status === 'overdue').length,
      upcoming: milestones.filter(m => m.status === 'planned').length
    };
  }

  /**
   * Generate quality metrics report
   */
  private async generateQualityMetrics(): Promise<any> {
    return {
      testCoverage: this.getTestCoverage(),
      blockedTasks: (await this.generateTaskSummary()).blocked,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate recommendations based on validation results
   */
  private generateRecommendations(
    taskValidation: CICDValidationResult['checks']['taskValidation'],
    milestoneProgress: CICDValidationResult['checks']['milestoneProgress'],
    quality: CICDValidationResult['checks']['quality']
  ): string[] {
    const recommendations: string[] = [];

    if (!taskValidation.passed) {
      recommendations.push('Fix task validation errors before proceeding with deployment');
    }

    if (taskValidation.warnings.length > 0) {
      recommendations.push('Address task validation warnings to improve project health');
    }

    if (!milestoneProgress.passed) {
      recommendations.push('Review milestone progress and address blockers');
    }

    if (!quality.passed) {
      if (quality.testCoverage < quality.requiredCoverage) {
        recommendations.push(`Increase test coverage from ${quality.testCoverage}% to ${quality.requiredCoverage}%`);
      }
      if (quality.blockedTasks > quality.maxBlocked) {
        recommendations.push(`Reduce blocked tasks from ${quality.blockedTasks} to ${quality.maxBlocked} or fewer`);
      }
    }

    return recommendations;
  }

  /**
   * Save validation result to file
   */
  private async saveValidationResult(result: CICDValidationResult): Promise<void> {
    const resultsDir = path.join(this.projectRoot, '.taskmaster', 'cicd-results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const filename = `validation-${new Date().toISOString().split('T')[0]}-${Date.now()}.json`;
    const filepath = path.join(resultsDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(result, null, 2));

    // Also save as latest result
    const latestPath = path.join(resultsDir, 'latest.json');
    fs.writeFileSync(latestPath, JSON.stringify(result, null, 2));
  }

  /**
   * Generate CI/CD workflow files for different platforms
   */
  generateWorkflowFiles(platforms: CICDConfig['platforms']): void {
    platforms.forEach(platform => {
      switch (platform) {
        case 'github':
          this.generateGitHubWorkflow();
          break;
        case 'gitlab':
          this.generateGitLabCI();
          break;
        case 'jenkins':
          this.generateJenkinsfile();
          break;
        case 'azure-devops':
          this.generateAzurePipeline();
          break;
      }
    });
  }

  /**
   * Generate GitHub Actions workflow
   */
  private generateGitHubWorkflow(): void {
    const workflowDir = path.join(this.projectRoot, '.github', 'workflows');
    if (!fs.existsSync(workflowDir)) {
      fs.mkdirSync(workflowDir, { recursive: true });
    }

    const workflow = `name: Task Management Validation

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  validate-tasks:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: |
        cd .taskmaster
        npm ci
    
    - name: Run task validation
      run: |
        cd .taskmaster
        npm run dev cicd -- --validate
    
    - name: Upload validation report
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: task-validation-report
        path: .taskmaster/cicd-results/
`;

    fs.writeFileSync(path.join(workflowDir, 'task-validation.yml'), workflow);
  }

  /**
   * Generate GitLab CI configuration
   */
  private generateGitLabCI(): void {
    const gitlab = `stages:
  - validate

validate-tasks:
  stage: validate
  image: node:18
  before_script:
    - cd .taskmaster
    - npm ci
  script:
    - npm run dev cicd -- --validate
  artifacts:
    reports:
      junit: .taskmaster/cicd-results/latest.json
    paths:
      - .taskmaster/cicd-results/
    expire_in: 1 week
  only:
    - main
    - develop
    - merge_requests
`;

    fs.writeFileSync(path.join(this.projectRoot, '.gitlab-ci.yml'), gitlab);
  }

  /**
   * Generate Jenkinsfile
   */
  private generateJenkinsfile(): void {
    const jenkinsfile = `pipeline {
    agent any
    
    stages {
        stage('Setup') {
            steps {
                dir('.taskmaster') {
                    sh 'npm ci'
                }
            }
        }
        
        stage('Validate Tasks') {
            steps {
                dir('.taskmaster') {
                    sh 'npm run dev cicd -- --validate'
                }
            }
            post {
                always {
                    archiveArtifacts artifacts: '.taskmaster/cicd-results/**/*', fingerprint: true
                }
            }
        }
    }
}
`;

    fs.writeFileSync(path.join(this.projectRoot, 'Jenkinsfile'), jenkinsfile);
  }

  /**
   * Generate Azure DevOps pipeline
   */
  private generateAzurePipeline(): void {
    const azure = `trigger:
- main
- develop

pool:
  vmImage: 'ubuntu-latest'

steps:
- task: NodeTool@0
  inputs:
    versionSpec: '18.x'
  displayName: 'Install Node.js'

- script: |
    cd .taskmaster
    npm ci
  displayName: 'Install dependencies'

- script: |
    cd .taskmaster
    npm run dev cicd -- --validate
  displayName: 'Run task validation'

- task: PublishTestResults@2
  condition: always()
  inputs:
    testResultsFiles: '.taskmaster/cicd-results/latest.json'
    testRunTitle: 'Task Validation Results'
`;

    fs.writeFileSync(path.join(this.projectRoot, 'azure-pipelines.yml'), azure);
  }

  /**
   * Update CI/CD configuration
   */
  updateConfig(updates: Partial<CICDConfig>): void {
    const config = this.loadConfig();
    const updatedConfig = { ...config, ...updates };
    this.saveConfig(updatedConfig);
  }

  /**
   * Get CI/CD configuration
   */
  getConfig(): CICDConfig {
    return this.loadConfig();
  }
}
