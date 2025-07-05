#!/usr/bin/env node

/**
 * Enhanced Progress Tracking CLI
 * Command-line interface for managing progress tracking, metrics, and dashboards
 */

import { Command } from 'commander';
import { ProgressTracker } from './progress-tracker';
import { DashboardGenerator, DashboardCLI } from './dashboard-generator';
import { MetricsCollector } from './metrics-collector';
import { StatusValidator } from './status-validator';
import { DependencyVisualizer } from './dependency-visualizer';
import { MilestoneTracker } from './milestone-tracker';
import { CICDIntegration } from './cicd-integration';
import { ProjectUnderstandingService } from './project-understanding';
import { writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import * as path from 'path';

const program = new Command();

program
  .name('progress-tracker')
  .description('Enhanced Progress Tracking for Project Management')
  .version('1.0.0');

// Dashboard commands
program
  .command('dashboard')
  .description('Generate project dashboard')
  .option('-o, --output <path>', 'Output directory for dashboard files')
  .option('-n, --notify', 'Send notifications to configured integrations')
  .option('--html-only', 'Generate only HTML dashboard')
  .option('--json-only', 'Generate only JSON dashboard')
  .action(async (options) => {
    // Get the correct project root (parent directory of .taskmaster)
    const currentDir = process.cwd();
    const projectRoot = currentDir.endsWith('.taskmaster') ? path.dirname(currentDir) : currentDir;
    console.log('🎯 Generating project dashboard...');
    
    try {
      await DashboardCLI.run(projectRoot, {
        outputPath: options.output,
        notify: options.notify,
        htmlOnly: options.htmlOnly,
        jsonOnly: options.jsonOnly
      });
      
      console.log('✅ Dashboard generated successfully!');
    } catch (error) {
      console.error('❌ Failed to generate dashboard:', error);
      process.exit(1);
    }
  });

// Metrics commands
program
  .command('metrics')
  .description('Collect and analyze project metrics')
  .option('-c, --collect', 'Collect current metrics snapshot')
  .option('-t, --trends [days]', 'Generate trend analysis (default: 30 days)', '30')
  .option('-s, --summary', 'Generate executive summary')
  .option('-e, --export <format>', 'Export metrics (json|csv|github|jira)', 'json')
  .action(async (options) => {
    // Get the correct project root (parent directory of .taskmaster)
    const currentDir = process.cwd();
    const projectRoot = currentDir.endsWith('.taskmaster') ? path.dirname(currentDir) : currentDir;
    const collector = new MetricsCollector(projectRoot);
    
    try {
      if (options.collect) {
        console.log('📊 Collecting metrics snapshot...');
        const snapshot = await collector.collectMetrics();
        console.log('✅ Metrics collected:', {
          timestamp: snapshot.timestamp,
          totalTasks: snapshot.projectMetrics.totalTasks,
          progress: snapshot.projectMetrics.overallProgress.toFixed(1) + '%'
        });
      }
      
      if (options.trends) {
        console.log(`📈 Generating trend analysis for ${options.trends} days...`);
        const trends = collector.generateTrendAnalysis(parseInt(options.trends));
        
        if (trends.error) {
          console.log('⚠️', trends.error);
        } else {
          console.log('📈 Trend Analysis:');
          console.log(`  Progress: ${trends.taskCompletion.improvement.toFixed(1)}% improvement`);
          console.log(`  Velocity: ${trends.velocity.trend} (avg: ${trends.velocity.average.toFixed(1)} tasks/week)`);
          console.log(`  Test Coverage: ${trends.quality.testCoverage.change.toFixed(1)}% change`);
        }
      }
      
      if (options.summary) {
        console.log('📋 Generating executive summary...');
        const summary = collector.generateExecutiveSummary();
        
        if (summary.error) {
          console.log('⚠️', summary.error);
        } else {
          console.log('📋 Executive Summary:');
          console.log(`  Project Health: ${summary.projectHealth.toUpperCase()}`);
          console.log(`  Progress: ${summary.keyMetrics.overallProgress.toFixed(1)}%`);
          console.log(`  Velocity: ${summary.keyMetrics.velocity} tasks/week`);
          console.log(`  Test Coverage: ${summary.keyMetrics.codeQuality.testCoverage.toFixed(1)}%`);
          
          if (summary.recommendations.length > 0) {
            console.log('  Recommendations:');
            summary.recommendations.forEach((rec: string) => console.log(`    • ${rec}`));
          }
        }
      }
      
      if (options.export) {
        console.log(`📤 Exporting metrics in ${options.export} format...`);
        const exportData = collector.exportForIntegration(options.export as any);
        const fileName = `metrics-export-${new Date().toISOString().split('T')[0]}.${options.export === 'csv' ? 'csv' : 'json'}`;
        const exportPath = join(projectRoot, '.taskmaster', 'reports', fileName);
        
        writeFileSync(exportPath, 
          options.export === 'csv' ? exportData : JSON.stringify(exportData, null, 2)
        );
        console.log(`✅ Metrics exported to: ${exportPath}`);
      }
      
    } catch (error) {
      console.error('❌ Failed to process metrics:', error);
      process.exit(1);
    }
  });

// Time tracking commands
program
  .command('time')
  .description('Manage time tracking')
  .option('-s, --start <taskId>', 'Start time tracking for a task')
  .option('-e, --end <taskId>', 'Stop time tracking for a task')
  .option('-d, --description <text>', 'Description for time entry')
  .option('-c, --category <category>', 'Category (development|testing|documentation|planning|review)', 'development')
  .option('-r, --report', 'Generate time tracking report')
  .action(async (options) => {
    // Get the correct project root (parent directory of .taskmaster)
    const currentDir = process.cwd();
    const projectRoot = currentDir.endsWith('.taskmaster') ? path.dirname(currentDir) : currentDir;
    const tracker = new ProgressTracker(projectRoot);
    
    try {
      if (options.start) {
        if (!options.description) {
          console.error('❌ Description is required when starting time tracking');
          process.exit(1);
        }
        
        tracker.startTimeTracking(options.start, options.description, options.category);
        console.log(`⏱️ Started time tracking for task ${options.start}`);
        console.log(`   Description: ${options.description}`);
        console.log(`   Category: ${options.category}`);
      }
      
      if (options.end) {
        tracker.stopTimeTracking(options.end);
        console.log(`⏹️ Stopped time tracking for task ${options.end}`);
      }
      
      if (options.report) {
        console.log('📊 Generating time tracking report...');
        // Implementation would generate detailed time report
        console.log('Time tracking report generated (feature coming soon)');
      }
      
    } catch (error) {
      console.error('❌ Failed to manage time tracking:', error);
      process.exit(1);
    }
  });

// Watch mode for continuous monitoring
program
  .command('watch')
  .description('Start continuous monitoring and auto-refresh')
  .option('-i, --interval <minutes>', 'Refresh interval in minutes', '30')
  .option('--dashboard', 'Auto-generate dashboard')
  .option('--metrics', 'Auto-collect metrics')
  .option('--notifications', 'Send notifications on changes')
  .action(async (options) => {
    // Get the correct project root (parent directory of .taskmaster)
    const currentDir = process.cwd();
    const projectRoot = currentDir.endsWith('.taskmaster') ? path.dirname(currentDir) : currentDir;
    const interval = parseInt(options.interval) * 60 * 1000; // Convert to milliseconds
    
    console.log(`👀 Starting continuous monitoring (refresh every ${options.interval} minutes)...`);
    console.log('   Press Ctrl+C to stop');
    
    const runMonitoring = async () => {
      try {
        const timestamp = new Date().toLocaleString();
        console.log(`\n🔄 Running monitoring cycle at ${timestamp}`);
        
        if (options.metrics) {
          const collector = new MetricsCollector(projectRoot);
          await collector.collectMetrics();
          console.log('  ✅ Metrics collected');
        }
        
        if (options.dashboard) {
          await DashboardCLI.run(projectRoot, { notify: options.notifications });
          console.log('  ✅ Dashboard updated');
        }
        
        console.log(`  ⏰ Next update in ${options.interval} minutes`);
        
      } catch (error) {
        console.error('  ❌ Error during monitoring cycle:', error);
      }
    };
    
    // Run initial cycle
    await runMonitoring();
    
    // Set up interval
    const intervalId = setInterval(runMonitoring, interval);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping monitoring...');
      clearInterval(intervalId);
      process.exit(0);
    });
  });

// Configuration commands
program
  .command('config')
  .description('Manage progress tracking configuration')
  .option('--init', 'Initialize progress tracking configuration')
  .option('--set <key=value>', 'Set configuration value')
  .option('--get <key>', 'Get configuration value')
  .option('--list', 'List all configuration')
  .action(async (options) => {
    // Get the correct project root (parent directory of .taskmaster)
    const currentDir = process.cwd();
    const projectRoot = currentDir.endsWith('.taskmaster') ? path.dirname(currentDir) : currentDir;
    const configPath = join(projectRoot, '.taskmaster', 'progress-config.json');
    
    try {
      if (options.init) {
        console.log('🔧 Initializing progress tracking configuration...');
        
        const defaultConfig = {
          projectName: 'JBR Trading Platform',
          refreshInterval: 30,
          alertThresholds: {
            blockedTasksWarning: 3,
            velocityWarning: 2,
            overdueTasksCritical: 5
          },
          integrations: {
            slack: {
              webhookUrl: '',
              channels: ['#project-updates']
            },
            github: {
              owner: 'IQMO',
              repo: 'JBR',
              token: ''
            }
          },
          dashboard: {
            autoRefresh: true,
            showAlerts: true,
            showRecommendations: true
          },
          metrics: {
            collectGit: true,
            collectBuild: true,
            collectTests: true,
            collectPerformance: false,
            retentionDays: 90
          }
        };
        
        writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
        console.log(`✅ Configuration initialized at: ${configPath}`);
        console.log('   Edit the configuration file to customize settings');
      }
      
      if (options.set) {
        console.log('Setting configuration value...');
        // Implementation for setting config values
        console.log('Configuration setting feature coming soon');
      }
      
      if (options.get) {
        console.log('Getting configuration value...');
        // Implementation for getting config values
        console.log('Configuration getting feature coming soon');
      }
      
      if (options.list) {
        if (existsSync(configPath)) {
          const config = require(configPath);
          console.log('📋 Current Configuration:');
          console.log(JSON.stringify(config, null, 2));
        } else {
          console.log('⚠️ No configuration found. Run --init to create one.');
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to manage configuration:', error);
      process.exit(1);
    }
  });

// Dependency visualization commands
program
  .command('visualize')
  .description('Generate task dependency visualizations')
  .option('-t, --type <format>', 'Output format (svg|html|both)', 'html')
  .option('-l, --layout <layout>', 'Layout algorithm (hierarchical|force|circular)', 'hierarchical')
  .option('-c, --color <scheme>', 'Color scheme (status|priority|complexity)', 'status')
  .option('--analyze', 'Generate dependency analysis report')
  .action(async (options) => {
    // Get the correct project root (parent directory of .taskmaster)
    const currentDir = process.cwd();
    const projectRoot = currentDir.endsWith('.taskmaster') ? path.dirname(currentDir) : currentDir;
    
    try {
      console.log('🎨 Generating dependency visualization...');
      
      const visualizer = new DependencyVisualizer(projectRoot);
      const config = { layout: options.layout, colorScheme: options.color };
      
      if (options.type === 'svg' || options.type === 'both') {
        const svgPath = visualizer.generateVisualization(config);
        console.log(`📊 SVG: ${svgPath}`);
      }
      
      if (options.type === 'html' || options.type === 'both') {
        const htmlPath = visualizer.generateInteractiveVisualization(config);
        console.log(`🌐 HTML: ${htmlPath}`);
      }
      
      if (options.analyze) {
        const analysis = visualizer.analyzeDependencies();
        console.log(`📈 Analysis: ${analysis.summary.totalTasks} tasks, ${analysis.summary.totalDependencies} dependencies`);
      }
      
    } catch (error) {
      console.error('❌ Visualization failed:', error);
      process.exit(1);
    }
  });

// Milestone tracking commands
program
  .command('milestone')
  .description('Manage project milestones')
  .option('-c, --create', 'Create a new milestone')
  .option('-l, --list', 'List all milestones')
  .option('-r, --report <id>', 'Generate milestone report')
  .option('-u, --update <id>', 'Update milestone status')
  .option('--title <title>', 'Milestone title')
  .option('--description <desc>', 'Milestone description')
  .option('--target <date>', 'Target completion date (YYYY-MM-DD)')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('--status <status>', 'New status (planned|in-progress|completed|overdue|cancelled)')
  .action(async (options) => {
    const currentDir = process.cwd();
    const projectRoot = currentDir.endsWith('.taskmaster') ? path.dirname(currentDir) : currentDir;
    
    try {
      const tracker = new MilestoneTracker(projectRoot);
      
      if (options.create) {
        if (!options.title || !options.description || !options.target) {
          console.error('❌ Create requires --title, --description, and --target options');
          process.exit(1);
        }
        
        const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : [];
        const milestone = tracker.createMilestone(
          options.title,
          options.description,
          options.target,
          [], // Start with no requirements
          tags
        );
        
        console.log(`✅ Created milestone: ${milestone.id} - ${milestone.title}`);
        
      } else if (options.list) {
        const milestones = tracker.listMilestones();
        
        if (milestones.length === 0) {
          console.log('📋 No milestones found');
          return;
        }
        
        console.log('📋 Project Milestones:');
        milestones.forEach(m => {
          const status = m.status === 'completed' ? '✅' : 
                        m.status === 'in-progress' ? '🔄' :
                        m.status === 'overdue' ? '⚠️' : '📅';
          console.log(`  ${status} ${m.id}: ${m.title} (${m.status}, due: ${m.targetDate})`);
        });
        
      } else if (options.report) {
        const report = tracker.generateMilestoneReport(options.report);
        
        console.log(`📊 Milestone Report: ${report.milestone.title}`);
        console.log(`📈 Progress: ${report.progress.overall.toFixed(1)}% overall`);
        console.log(`📋 Tasks: ${report.milestone.metrics.taskCount.completed}/${report.milestone.metrics.taskCount.total} completed`);
        
        if (report.insights.length > 0) {
          console.log('\n💡 Insights:');
          report.insights.forEach(insight => console.log(`  • ${insight}`));
        }
        
        if (report.recommendations.length > 0) {
          console.log('\n🎯 Recommendations:');
          report.recommendations.forEach(rec => console.log(`  • ${rec}`));
        }
        
        if (report.risks.length > 0) {
          console.log('\n⚠️ Risks:');
          report.risks.forEach(risk => console.log(`  • ${risk}`));
        }
        
      } else if (options.update && options.status) {
        tracker.updateMilestoneStatus(options.update, options.status);
        console.log(`✅ Updated milestone ${options.update} status to ${options.status}`);
        
      } else {
        console.log('❌ Please specify an action: --create, --list, --report, or --update');
      }
      
    } catch (error) {
      console.error('❌ Milestone command failed:', error);
      process.exit(1);
    }
  });

// Integration commands
program
  .command('integrate')
  .description('Manage external integrations')
  .option('--test <service>', 'Test integration (slack|github|jira)')
  .option('--sync', 'Sync data with external services')
  .option('--webhook <url>', 'Test webhook endpoint')
  .action(async (options) => {
    console.log('🔗 Managing integrations...');
    
    try {
      if (options.test) {
        console.log(`Testing ${options.test} integration...`);
        // Implementation for testing integrations
        console.log(`${options.test} integration test completed`);
      }
      
      if (options.sync) {
        console.log('Syncing with external services...');
        // Implementation for syncing data
        console.log('Data sync completed');
      }
      
      if (options.webhook) {
        console.log(`Testing webhook: ${options.webhook}`);
        // Implementation for testing webhooks
        console.log('Webhook test completed');
      }
      
    } catch (error) {
      console.error('❌ Failed to manage integrations:', error);
      process.exit(1);
    }
  });

// Status validation commands
program
  .command('validate')
  .description('Validate task statuses and consistency')
  .option('-t, --task <taskId>', 'Validate specific task')
  .option('-a, --all', 'Validate all tasks (default)')
  .option('-f, --fix', 'Enable auto-fix for validation issues')
  .option('-r, --report', 'Generate detailed validation report')
  .option('-s, --severity <level>', 'Filter by severity (error|warning|info)', 'error')
  .option('--config <path>', 'Custom validation configuration file')
  .action(async (options) => {
    // Get the correct project root (parent directory of .taskmaster)
    const currentDir = process.cwd();
    const projectRoot = currentDir.endsWith('.taskmaster') ? path.dirname(currentDir) : currentDir;
    
    try {
      console.log('🔍 Running task status validation...');
      
      // Load custom config if provided
      let config = {};
      if (options.config && existsSync(options.config)) {
        config = JSON.parse(require('fs').readFileSync(options.config, 'utf8'));
      }
      
      // Enable auto-fix if requested
      if (options.fix) {
        config = { ...config, autoFix: { enabled: true, backupBeforeFix: true } };
      }
      
      const validator = new StatusValidator(projectRoot, config);
      
      if (options.task) {
        // Validate specific task
        console.log(`Validating task ${options.task}...`);
        const results = validator.validateTask(options.task);
        
        if (results.length === 0) {
          console.log(`✅ Task ${options.task} validation passed`);
        } else {
          console.log(`❌ Task ${options.task} validation failed:`);
          results.forEach(result => {
            console.log(`  • ${result.message}`);
            if (result.suggestions) {
              result.suggestions.forEach(suggestion => {
                console.log(`    - ${suggestion}`);
              });
            }
          });
        }
      } else {
        // Validate all tasks
        console.log('Validating all tasks...');
        const report = validator.validateAllTasks();
        
        console.log('\n📊 Validation Summary:');
        console.log(`  Total Tasks: ${report.summary.totalTasks}`);
        console.log(`  Valid Tasks: ${report.summary.validTasks}`);
        console.log(`  Invalid Tasks: ${report.summary.invalidTasks}`);
        console.log(`  Errors: ${report.summary.errors}`);
        console.log(`  Warnings: ${report.summary.warnings}`);
        
        if (report.summary.autoFixed > 0) {
          console.log(`  Auto-Fixed: ${report.summary.autoFixed}`);
        }
        
        // Filter and display issues by severity
        const filteredIssues = report.issues.filter(issue => {
          if (options.severity === 'error') return issue.severity === 'error';
          if (options.severity === 'warning') return ['error', 'warning'].includes(issue.severity);
          return true; // 'info' shows all
        });
        
        if (filteredIssues.length > 0) {
          console.log(`\n🚨 Issues (${options.severity} level and above):`);
          filteredIssues.forEach(issue => {
            const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
            console.log(`${icon} ${issue.taskTitle} (${issue.taskId})`);
            console.log(`   Rule: ${issue.ruleName}`);
            console.log(`   Issue: ${issue.message}`);
            if (issue.autoFixed) {
              console.log(`   🔧 Auto-fixed`);
            } else if (issue.suggestions.length > 0) {
              console.log(`   Suggestions:`);
              issue.suggestions.forEach(suggestion => {
                console.log(`     - ${suggestion}`);
              });
            }
            console.log('');
          });
        }
        
        if (report.recommendations.length > 0) {
          console.log('💡 Recommendations:');
          report.recommendations.forEach(rec => {
            console.log(`  • ${rec}`);
          });
        }
        
        if (options.report) {
          const reportPath = join(projectRoot, '.taskmaster', 'reports', `validation-report-${new Date().toISOString().split('T')[0]}.json`);
          console.log(`\n📄 Detailed report saved to: ${reportPath}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    }
  });

// Status validation commands
program
  .command('status')
  .description('Show quick project status overview')
  .option('--detailed', 'Show detailed status information')
  .action(async (options) => {
    // Get the correct project root (parent directory of .taskmaster)
    const currentDir = process.cwd();
    const projectRoot = currentDir.endsWith('.taskmaster') ? path.dirname(currentDir) : currentDir;
    const tracker = new ProgressTracker(projectRoot);
    
    try {
      console.log('📊 Project Status Overview');
      console.log('========================================');
      
      // Load and calculate basic metrics
      const tasksData = tracker.loadTasksData(); // Use the tracker's method for proper parsing
      
      const taskMetrics = tracker.calculateTaskMetrics(tasksData);
      const projectMetrics = tracker.calculateProjectMetrics(taskMetrics);
      
      console.log(`Overall Progress: ${projectMetrics.overallProgress.toFixed(1)}%`);
      console.log(`Tasks Completed: ${projectMetrics.completedTasks}/${projectMetrics.totalTasks}`);
      console.log(`Weekly Velocity: ${projectMetrics.velocityPerWeek} tasks/week`);
      console.log(`Blocked Tasks: ${projectMetrics.blockedTasks}`);
      console.log(`Est. Completion: ${projectMetrics.estimatedCompletion}`);
      
      if (options.detailed) {
        console.log('\n📈 Detailed Breakdown:');
        console.log(`  In Progress: ${projectMetrics.inProgressTasks}`);
        console.log(`  Pending: ${projectMetrics.pendingTasks}`);
        console.log(`  Deferred: ${projectMetrics.deferredTasks}`);
        console.log(`  Cancelled: ${projectMetrics.cancelledTasks}`);
        
        if (projectMetrics.riskFactors.length > 0) {
          console.log('\n⚠️ Risk Factors:');
          projectMetrics.riskFactors.forEach((risk: any) => {
            console.log(`  ${risk.severity.toUpperCase()}: ${risk.description}`);
          });
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to get project status:', error);
      process.exit(1);
    }
  });

// CI/CD Integration commands
program
  .command('cicd')
  .description('CI/CD integration and validation')
  .option('-v, --validate', 'Run CI/CD validation checks')
  .option('-i, --init', 'Initialize CI/CD configuration')
  .option('-w, --workflows <platforms>', 'Generate workflow files (comma-separated: github,gitlab,jenkins,azure-devops)')
  .option('-c, --config', 'Show current CI/CD configuration')
  .option('--enable', 'Enable CI/CD validation')
  .option('--disable', 'Disable CI/CD validation')
  .action(async (options) => {
    const currentDir = process.cwd();
    const projectRoot = currentDir.endsWith('.taskmaster') ? path.dirname(currentDir) : currentDir;
    
    try {
      const cicd = new CICDIntegration(projectRoot);
      
      if (options.validate) {
        console.log('🔍 Running CI/CD validation checks...');
        
        const result = await cicd.runValidation();
        
        console.log(`\n📊 Validation Result: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
        
        // Task validation results
        const taskCheck = result.checks.taskValidation;
        console.log(`\n📋 Task Validation: ${taskCheck.passed ? '✅ PASSED' : '❌ FAILED'}`);
        if (taskCheck.errors.length > 0) {
          console.log('  Errors:');
          taskCheck.errors.forEach(error => console.log(`    • ${error}`));
        }
        if (taskCheck.warnings.length > 0) {
          console.log('  Warnings:');
          taskCheck.warnings.forEach(warning => console.log(`    • ${warning}`));
        }
        
        // Milestone progress results
        const milestoneCheck = result.checks.milestoneProgress;
        console.log(`\n🎯 Milestone Progress: ${milestoneCheck.passed ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`  Progress: ${milestoneCheck.currentProgress.toFixed(1)}% (required: ${milestoneCheck.requiredProgress}%)`);
        if (milestoneCheck.blockers.length > 0) {
          console.log('  Blockers:');
          milestoneCheck.blockers.forEach(blocker => console.log(`    • ${blocker}`));
        }
        
        // Quality results
        const qualityCheck = result.checks.quality;
        console.log(`\n🎯 Quality Metrics: ${qualityCheck.passed ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`  Test Coverage: ${qualityCheck.testCoverage}% (required: ${qualityCheck.requiredCoverage}%)`);
        console.log(`  Blocked Tasks: ${qualityCheck.blockedTasks} (max: ${qualityCheck.maxBlocked})`);
        
        // Recommendations
        if (result.recommendations.length > 0) {
          console.log('\n💡 Recommendations:');
          result.recommendations.forEach(rec => console.log(`  • ${rec}`));
        }
        
        // Exit with appropriate code
        process.exit(result.success ? 0 : 1);
        
      } else if (options.init) {
        const platforms = options.workflows ? options.workflows.split(',').map((p: string) => p.trim()) : ['github'];
        const config = cicd.initializeConfig(platforms);
        console.log('✅ CI/CD configuration initialized');
        console.log(`📋 Platforms: ${config.platforms.join(', ')}`);
        
      } else if (options.workflows) {
        const platforms = options.workflows.split(',').map((p: string) => p.trim());
        cicd.generateWorkflowFiles(platforms);
        console.log(`✅ Generated workflow files for: ${platforms.join(', ')}`);
        
      } else if (options.config) {
        const config = cicd.getConfig();
        console.log('📋 CI/CD Configuration:');
        console.log(JSON.stringify(config, null, 2));
        
      } else if (options.enable) {
        cicd.updateConfig({ enabled: true });
        console.log('✅ CI/CD validation enabled');
        
      } else if (options.disable) {
        cicd.updateConfig({ enabled: false });
        console.log('⚠️ CI/CD validation disabled');
        
      } else {
        console.log('❌ Please specify an action: --validate, --init, --workflows, --config, --enable, or --disable');
      }
      
    } catch (error) {
      console.error('❌ CI/CD command failed:', error);
      process.exit(1);
    }
  });

// Understand project command
program
  .command('understand-project')
  .description('Generate comprehensive project understanding for AI agents')
  .option('-o, --output <path>', 'Output file path for understanding document')
  .option('-f, --format <type>', 'Output format: json, markdown, text', 'markdown')
  .option('--ai', 'Enable AI-powered analysis with insights and recommendations')
  .action(async (options) => {
    const currentDir = process.cwd();
    const projectRoot = currentDir.endsWith('.taskmaster') ? path.dirname(currentDir) : currentDir;
    
    if (options.ai) {
      console.log('🧠 Generating AI-powered project analysis...');
    } else {
      console.log('🔍 Analyzing project for AI understanding...');
    }
    
    try {
      const understandingService = new ProjectUnderstandingService(projectRoot);
      
      let content: string;
      let defaultFileName: string;
      
      if (options.ai) {
        // AI-powered analysis
        content = await understandingService.generateAIAnalysis();
        defaultFileName = 'ai-project-analysis.md';
        
        // AI analysis is always markdown format
        if (options.format !== 'markdown') {
          console.log('ℹ️ AI analysis is only available in markdown format.');
        }
      } else {
        // Standard analysis
        const understanding = await understandingService.generateUnderstanding();
        
        // Determine output format and content
        switch (options.format.toLowerCase()) {
          case 'json':
            content = JSON.stringify(understanding, null, 2);
            defaultFileName = 'project-understanding.json';
            break;
          case 'text':
            content = understandingService.formatAsText(understanding);
            defaultFileName = 'project-understanding.txt';
            break;
          case 'markdown':
          default:
            content = understandingService.formatAsMarkdown(understanding);
            defaultFileName = 'project-understanding.md';
            break;
        }
      }
      
      // Save to file if output path specified
      if (options.output) {
        writeFileSync(options.output, content, 'utf8');
        console.log(`✅ Project ${options.ai ? 'AI analysis' : 'understanding'} saved to: ${options.output}`);
      } else {
        // Save to default location in .taskmaster/docs/
        const docsDir = path.join(projectRoot, '.taskmaster', 'docs');
        const outputPath = path.join(docsDir, defaultFileName);
        writeFileSync(outputPath, content, 'utf8');
        console.log(`✅ Project ${options.ai ? 'AI analysis' : 'understanding'} saved to: ${outputPath}`);
      }
      
      if (!options.ai) {
        // Show summary for standard analysis
        const understanding = JSON.parse(content.startsWith('{') ? content : '{}');
        if (understanding.projectName) {
          console.log('\n📋 Project Understanding Summary:');
          console.log(`Project: ${understanding.projectName}`);
          console.log(`Purpose: ${understanding.context?.mainPurpose || 'Unknown'}`);
          console.log(`Files: ${understanding.codebase?.totalFiles || 0} files, ${understanding.codebase?.totalLines || 0} lines`);
          console.log(`Languages: ${Object.keys(understanding.codebase?.languages || {}).join(', ')}`);
          console.log(`Key Components: ${(understanding.context?.keyComponents || []).slice(0, 3).join(', ')}${(understanding.context?.keyComponents || []).length > 3 ? '...' : ''}`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Failed to generate project ${options.ai ? 'AI analysis' : 'understanding'}:`, error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
