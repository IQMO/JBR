#!/usr/bin/env npx tsx

/**
 * 🎼 SCRIPTS ORCHESTRATOR
 * 
 * Central Script Management System (Task 53.8)
 * 
 * The command center for all project automation and quality assurance.
 * Coordinates analysis, monitoring, testing, and utilities with intelligent
 * workflow chains and comprehensive reporting.
 * 
 * USAGE:
 *   npx tsx scripts/orchestrator.ts [COMMAND] [OPTIONS]
 * 
 * EXAMPLES:
 *   # Run comprehensive analysis workflow
 *   npx tsx scripts/orchestrator.ts analyze --full
 * 
 *   # Monitor production readiness
 *   npx tsx scripts/orchestrator.ts monitor --production
 * 
 *   # Execute testing suite
 *   npx tsx scripts/orchestrator.ts test --integration
 * 
 *   # Run complete workflow chain
 *   npx tsx scripts/orchestrator.ts workflow --production-ready
 * 
 * @author Scripts Infrastructure Team
 * @version 1.0.0
 * @since 2025-07-05
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawn } from 'child_process';
import { performance } from 'perf_hooks';

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

interface ScriptConfig {
  name: string;
  path: string;
  category: 'analysis' | 'monitoring' | 'testing' | 'utilities';
  description: string;
  dependencies?: string[];
  tags?: string[];
  estimatedDuration?: number; // in seconds
}

interface WorkflowStep {
  script: string;
  args?: string[];
  condition?: () => boolean;
  onSuccess?: string[];
  onFailure?: string[];
}

interface ExecutionResult {
  script: string;
  success: boolean;
  duration: number;
  output?: string;
  error?: string;
  reportPath?: string;
}

interface WorkflowResult {
  name: string;
  totalDuration: number;
  steps: ExecutionResult[];
  success: boolean;
  summary: string;
}

// ============================================================================
// SCRIPT REGISTRY
// ============================================================================

class ScriptRegistry {
  private scripts: Map<string, ScriptConfig> = new Map();
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.registerScripts();
  }

  private registerScripts(): void {
    // Analysis Scripts
    this.register({
      name: 'architectural-analyzer',
      path: 'scripts/analysis/architectural-analyzer.ts',
      category: 'analysis',
      description: 'Comprehensive architectural analysis and optimization (Task 54)',
      tags: ['architecture', 'optimization', 'heart-script'],
      estimatedDuration: 30
    });

    this.register({
      name: 'analyze',
      path: 'scripts/analysis/analyze.ts',
      category: 'analysis',
      description: 'Comprehensive quality analysis coordinator',
      dependencies: ['architectural-analyzer'],
      tags: ['quality', 'coordinator'],
      estimatedDuration: 45
    });

    this.register({
      name: 'duplicate-detector',
      path: 'scripts/analysis/duplicate-method-detector.ts',
      category: 'analysis',
      description: 'Advanced duplicate method detection',
      tags: ['duplication', 'methods'],
      estimatedDuration: 20
    });

    this.register({
      name: 'duplication-analyzer',
      path: 'scripts/analysis/duplication-analyzer.ts',
      category: 'analysis',
      description: 'Legacy duplication detection (has false positives)',
      tags: ['duplication', 'legacy'],
      estimatedDuration: 15
    });

    this.register({
      name: 'manual-duplication-reviewer',
      path: 'scripts/analysis/manual-duplication-reviewer.ts',
      category: 'analysis',
      description: 'Safe read-only duplication review',
      tags: ['duplication', 'manual', 'safe'],
      estimatedDuration: 10
    });

    // Monitoring Scripts
    this.register({
      name: 'doc-validator',
      path: 'scripts/monitoring/comprehensive-doc-validator.ts',
      category: 'monitoring',
      description: 'Advanced documentation validation',
      tags: ['documentation', 'validation'],
      estimatedDuration: 25
    });

    this.register({
      name: 'production-violations',
      path: 'scripts/monitoring/production-violations-analyzer.ts',
      category: 'monitoring',
      description: 'Production readiness analysis',
      tags: ['production', 'violations'],
      estimatedDuration: 30
    });

    this.register({
      name: 'post-implementation-check',
      path: 'scripts/monitoring/post-implementation-check.ts',
      category: 'monitoring',
      description: 'Post-deployment validation',
      tags: ['implementation', 'validation'],
      estimatedDuration: 15
    });

    this.register({
      name: 'post-implementation-validator',
      path: 'scripts/monitoring/post-implementation-validator.ts',
      category: 'monitoring',
      description: 'Implementation verification',
      tags: ['implementation', 'verification'],
      estimatedDuration: 20
    });

    this.register({
      name: 'validate-docs',
      path: 'scripts/monitoring/validate-documentation.ts',
      category: 'monitoring',
      description: 'Basic documentation validation',
      tags: ['documentation', 'basic'],
      estimatedDuration: 10
    });

    // Testing Scripts
    this.register({
      name: 'performance-analyzer',
      path: 'scripts/testing/performance/performance-analyzer.ts',
      category: 'testing',
      description: 'Performance analysis and bottleneck detection',
      tags: ['performance', 'analysis'],
      estimatedDuration: 25
    });

    this.register({
      name: 'sma-backtest',
      path: 'scripts/testing/backtest/sma-backtest.ts',
      category: 'testing',
      description: 'SMA strategy backtesting',
      tags: ['backtest', 'sma', 'strategy'],
      estimatedDuration: 30
    });

    this.register({
      name: 'fixed-sma-backtest',
      path: 'scripts/testing/backtest/fixed-sma-backtest.ts',
      category: 'testing',
      description: 'Fixed SMA strategy backtesting',
      tags: ['backtest', 'sma', 'strategy', 'fixed'],
      estimatedDuration: 30
    });

    this.register({
      name: 'database-health-check',
      path: 'scripts/testing/validation/database-health-check.ts',
      category: 'testing',
      description: 'Database connectivity and health validation',
      tags: ['database', 'health', 'validation'],
      estimatedDuration: 10
    });

    this.register({
      name: 'production-readiness-validation',
      path: 'scripts/testing/validation/production-readiness-validation.ts',
      category: 'testing',
      description: 'Production readiness validation suite',
      tags: ['production', 'readiness', 'validation'],
      estimatedDuration: 35
    });

    this.register({
      name: 'frontend-comprehensive-test',
      path: 'scripts/testing/validation/frontend-comprehensive-test.ts',
      category: 'testing',
      description: 'Comprehensive frontend testing and analysis suite',
      tags: ['frontend', 'components', 'dependencies', 'analysis'],
      estimatedDuration: 45
    });

    // Utilities
    this.register({
      name: 'naming-validator',
      path: 'scripts/utilities/naming-validator.ts',
      category: 'utilities',
      description: 'Code naming convention validation',
      tags: ['naming', 'conventions'],
      estimatedDuration: 15
    });
  }

  private register(config: ScriptConfig): void {
    this.scripts.set(config.name, config);
  }

  public getScript(name: string): ScriptConfig | undefined {
    return this.scripts.get(name);
  }

  public getAllScripts(): ScriptConfig[] {
    return Array.from(this.scripts.values());
  }

  public getScriptsByCategory(category: ScriptConfig['category']): ScriptConfig[] {
    return this.getAllScripts().filter(script => script.category === category);
  }

  public getScriptsByTag(tag: string): ScriptConfig[] {
    return this.getAllScripts().filter(script => script.tags?.includes(tag));
  }
}

// ============================================================================
// WORKFLOW DEFINITIONS
// ============================================================================

class WorkflowManager {
  private registry: ScriptRegistry;

  constructor(registry: ScriptRegistry) {
    this.registry = registry;
  }

  public getWorkflow(name: string): WorkflowStep[] {
    switch (name) {
      case 'comprehensive-analysis':
        return [
          { script: 'architectural-analyzer' },
          { script: 'analyze' },
          { script: 'duplicate-detector' },
          { script: 'duplication-analyzer' }
        ];

      case 'production-ready':
        return [
          { script: 'architectural-analyzer' },
          { script: 'production-violations' },
          { script: 'doc-validator' },
          { script: 'naming-validator' },
          { script: 'post-implementation-check' }
        ];

      case 'quick-health':
        return [
          { script: 'architectural-analyzer' },
          { script: 'production-violations' },
          { script: 'production-readiness-validation' }
        ];

      case 'documentation':
        return [
          { script: 'doc-validator' },
          { script: 'validate-docs' }
        ];

      case 'code-quality':
        return [
          { script: 'duplicate-detector' },
          { script: 'naming-validator' },
          { script: 'manual-duplication-reviewer' }
        ];

      case 'system-testing':
        return [
          { script: 'database-health-check' },
          { script: 'production-readiness-validation' },
          { script: 'frontend-comprehensive-test' },
          { script: 'performance-analyzer' }
        ];

      case 'strategy-testing':
        return [
          { script: 'sma-backtest' },
          { script: 'fixed-sma-backtest' }
        ];

      case 'full-validation':
        return [
          { script: 'architectural-analyzer' },
          { script: 'production-violations' },
          { script: 'doc-validator' },
          { script: 'database-health-check' },
          { script: 'production-readiness-validation' },
          { script: 'frontend-comprehensive-test' },
          { script: 'performance-analyzer' },
          { script: 'naming-validator' }
        ];

      default:
        throw new Error(`Unknown workflow: ${name}`);
    }
  }

  public getAvailableWorkflows(): string[] {
    return [
      'comprehensive-analysis',
      'production-ready', 
      'quick-health',
      'documentation',
      'code-quality',
      'system-testing',
      'strategy-testing',
      'full-validation'
    ];
  }
}

// ============================================================================
// SCRIPT EXECUTOR
// ============================================================================

class ScriptExecutor {
  private registry: ScriptRegistry;
  private projectRoot: string;

  constructor(registry: ScriptRegistry, projectRoot: string) {
    this.registry = registry;
    this.projectRoot = projectRoot;
  }

  public async executeScript(scriptName: string, args: string[] = []): Promise<ExecutionResult> {
    const script = this.registry.getScript(scriptName);
    if (!script) {
      throw new Error(`Script not found: ${scriptName}`);
    }

    const startTime = performance.now();
    
    console.log(`🎯 Script: ${script.name}`);
    console.log(`📝 Description: ${script.description}`);
    console.log(`📂 Category: ${script.category.toUpperCase()}`);
    if (script.estimatedDuration) {
      console.log(`⏱️  Estimated Duration: ~${script.estimatedDuration}s`);
    }
    if (args.length > 0) {
      console.log(`📋 Arguments: ${args.join(' ')}`);
    }
    console.log(`🚀 Executing...`);
    
    try {
      const scriptPath = path.join(this.projectRoot, script.path);
      const command = `npx tsx "${scriptPath}" ${args.join(' ')}`;
      
      const output = execSync(command, { 
        cwd: this.projectRoot,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });

      const duration = (performance.now() - startTime) / 1000;
      
      console.log(`✅ SUCCESS: ${script.name} completed in ${duration.toFixed(2)}s`);
      
      return {
        script: scriptName,
        success: true,
        duration,
        output: output.toString()
      };

    } catch (error: any) {
      const duration = (performance.now() - startTime) / 1000;
      
      console.log(`❌ FAILED: ${script.name} after ${duration.toFixed(2)}s`);
      console.log(`🚨 Error: ${error.message}`);
      
      return {
        script: scriptName,
        success: false,
        duration,
        error: error.message,
        output: error.stdout?.toString()
      };
    }
  }

  public async executeWorkflow(workflowName: string, continueOnError: boolean = true): Promise<WorkflowResult> {
    const workflowManager = new WorkflowManager(this.registry);
    const steps = workflowManager.getWorkflow(workflowName);
    
    console.log('\n' + '='.repeat(80));
    console.log(`🎼 WORKFLOW EXECUTION: ${workflowName.toUpperCase()}`);
    console.log('='.repeat(80));
    console.log(`📋 Total Steps: ${steps.length}`);
    console.log(`🔄 Continue on Error: ${continueOnError ? 'ENABLED ✅' : 'DISABLED ❌'}`);
    console.log(`⏰ Started: ${new Date().toLocaleTimeString()}`);
    console.log('='.repeat(80) + '\n');
    
    const startTime = performance.now();
    const results: ExecutionResult[] = [];
    let stepNumber = 1;
    
    for (const step of steps) {
      console.log(`\n📦 STEP ${stepNumber}/${steps.length}:`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🎯 Script: ${step.script}`);
      console.log(`🚀 Executing...`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      
      const result = await this.executeScript(step.script, step.args || []);
      results.push(result);
      
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      if (result.success) {
        console.log(`✅ STEP ${stepNumber} COMPLETED: ${step.script}`);
      } else {
        console.log(`❌ STEP ${stepNumber} FAILED: ${step.script}`);
        if (result.error) {
          console.log(`🚨 Error Details: ${result.error}`);
        }
      }
      console.log(`⏱️  Duration: ${result.duration.toFixed(2)}s`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      
      stepNumber++;
      
      if (!result.success && !continueOnError) {
        console.log(`🛑 WORKFLOW TERMINATED: Stopping due to failure in step ${stepNumber - 1}`);
        console.log(`📊 Reason: Continue-on-error is DISABLED\n`);
        break;
      } else if (!result.success && continueOnError) {
        console.log(`⚠️  CONTINUING: Step failed but continue-on-error is ENABLED\n`);
      }
    }
    
    const totalDuration = (performance.now() - startTime) / 1000;
    const successCount = results.filter(r => r.success).length;
    const failedCount = results.length - successCount;
    const success = successCount === steps.length;
    
    // Enhanced final summary
    console.log('\n' + '='.repeat(80));
    console.log(`🎯 WORKFLOW SUMMARY: ${workflowName.toUpperCase()}`);
    console.log('='.repeat(80));
    console.log(`⏰ Total Duration: ${totalDuration.toFixed(2)}s`);
    console.log(`📊 Overall Status: ${success ? '✅ SUCCESS' : '❌ PARTIAL/FAILED'}`);
    console.log(`📈 Success Rate: ${successCount}/${steps.length} (${((successCount/steps.length)*100).toFixed(1)}%)`);
    console.log(`✅ Successful Steps: ${successCount}`);
    console.log(`❌ Failed Steps: ${failedCount}`);
    console.log(`⏰ Completed: ${new Date().toLocaleTimeString()}`);
    console.log('='.repeat(80));
    
    if (failedCount > 0) {
      console.log(`\n🚨 FAILED STEPS DETAILS:`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      results.forEach((result, index) => {
        if (!result.success) {
          console.log(`❌ Step ${index + 1}: ${result.script} (${result.duration.toFixed(2)}s)`);
          if (result.error) {
            console.log(`   Error: ${result.error}`);
          }
        }
      });
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    }
    
    const summary = `Workflow ${workflowName}: ${successCount}/${steps.length} scripts succeeded (${totalDuration.toFixed(2)}s)`;
    
    return {
      name: workflowName,
      totalDuration,
      steps: results,
      success,
      summary
    };
  }
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

class OrchestratorCLI {
  private registry: ScriptRegistry;
  private executor: ScriptExecutor;
  private workflowManager: WorkflowManager;
  private projectRoot: string;

  constructor() {
    this.projectRoot = process.cwd();
    this.registry = new ScriptRegistry(this.projectRoot);
    this.executor = new ScriptExecutor(this.registry, this.projectRoot);
    this.workflowManager = new WorkflowManager(this.registry);
  }

  public async run(args: string[]): Promise<void> {
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
      this.showHelp();
      return;
    }

    const command = args[0];
    const options = args.slice(1);

    try {
      switch (command) {
        case 'list':
          this.listScripts(options);
          break;
        case 'run':
          await this.runScript(options);
          break;
        case 'workflow':
          await this.runWorkflow(options);
          break;
        case 'analyze':
          await this.runAnalysis(options);
          break;
        case 'monitor':
          await this.runMonitoring(options);
          break;
        case 'test':
          await this.runTesting(options);
          break;
        case 'status':
          await this.showStatus();
          break;
        default:
          console.log(`❌ Unknown command: ${command}`);
          this.showHelp();
          process.exit(1);
      }
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  }

  private showHelp(): void {
    console.log(`
🎼 Scripts Orchestrator - Central Script Management System

USAGE:
  npx tsx scripts/orchestrator.ts [COMMAND] [OPTIONS]

COMMANDS:
  list                          List all available scripts
  run <script> [args]           Run a specific script
  workflow <name>               Run a predefined workflow
  analyze [--full|--quick]      Run analysis workflows
  monitor [--production]        Run monitoring workflows  
  test [--integration]          Run testing workflows
  status                        Show system status
  
WORKFLOWS:
  comprehensive-analysis        Full code analysis suite
  production-ready             Production readiness check
  quick-health                 Fast health check
  documentation               Documentation validation
  code-quality                Code quality assessment
  system-testing              System validation and health checks
  strategy-testing            Trading strategy backtesting
  full-validation             Complete system validation

OPTIONS:
  --continue-on-error          Continue workflow even if steps fail
  --verbose                    Show detailed output
  --help, -h                  Show this help message

EXAMPLES:
  # List all available scripts
  npx tsx scripts/orchestrator.ts list

  # Run architectural analyzer
  npx tsx scripts/orchestrator.ts run architectural-analyzer

  # Run production readiness workflow
  npx tsx scripts/orchestrator.ts workflow production-ready

  # Quick analysis workflow
  npx tsx scripts/orchestrator.ts analyze --quick

  # Monitor with production settings
  npx tsx scripts/orchestrator.ts monitor --production
`);
  }

  private listScripts(options: string[]): void {
    const showDetails = options.includes('--verbose') || options.includes('-v');
    const categoryFilter = options.find(opt => opt.startsWith('--category='))?.split('=')[1];

    console.log('\n📋 Available Scripts:');
    console.log('=====================\n');

    const scripts = this.registry.getAllScripts();
    const categories = ['analysis', 'monitoring', 'testing', 'utilities'];

    for (const category of categories) {
      if (categoryFilter && category !== categoryFilter) continue;

      const categoryScripts = scripts.filter(s => s.category === category);
      if (categoryScripts.length === 0) continue;

      console.log(`\n📁 ${category.toUpperCase()}:`);
      categoryScripts.forEach(script => {
        console.log(`  ✓ ${script.name}`);
        if (showDetails) {
          console.log(`    📝 ${script.description}`);
          console.log(`    📄 ${script.path}`);
          if (script.dependencies && script.dependencies.length > 0) {
            console.log(`    🔗 Dependencies: ${script.dependencies.join(', ')}`);
          }
        }
      });
    }

    console.log('\n💡 Use --verbose for detailed information');
    console.log('💡 Use --category=<name> to filter by category\n');
  }

  private async runScript(options: string[]): Promise<void> {
    if (options.length === 0) {
      console.log('❌ Script name required. Use: run <script-name> [args]');
      return;
    }

    const scriptName = options[0];
    const scriptArgs = options.slice(1);

    console.log(`\n🚀 Running script: ${scriptName}`);
    if (scriptArgs.length > 0) {
      console.log(`📋 Arguments: ${scriptArgs.join(' ')}`);
    }

    const result = await this.executor.executeScript(scriptName, scriptArgs);
    
    if (result.success) {
      console.log(`\n✅ WORKFLOW COMPLETED SUCCESSFULLY in ${result.duration}ms`);
    } else {
      console.log(`\n❌ WORKFLOW HAD FAILURES after ${result.duration}ms`);
      if (result.error) {
        console.error(`🚨 Primary Error: ${result.error}`);
      }
      // Don't exit - continue on error is now default
    }
  }

  private async runWorkflow(options: string[]): Promise<void> {
    if (options.length === 0) {
      console.log('❌ Workflow name required. Available workflows:');
      const workflows = this.workflowManager.getAvailableWorkflows();
      workflows.forEach(name => console.log(`  • ${name}`));
      return;
    }

    const workflowName = options[0];
    const continueOnError = options.includes('--continue-on-error') || true; // Default to true
    const verbose = options.includes('--verbose');

    console.log(`\n🎼 Running workflow: ${workflowName}`);
    console.log(`🔄 Continue on error: ${continueOnError ? 'ENABLED ✅' : 'DISABLED ❌'}`);

    const result = await this.executor.executeWorkflow(workflowName, continueOnError);

    console.log(`\n📊 WORKFLOW FINAL SUMMARY:`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`⏰ Duration: ${result.totalDuration.toFixed(2)}s`);
    console.log(`📊 Status: ${result.success ? '✅ COMPLETE SUCCESS' : '⚠️  PARTIAL SUCCESS'}`);
    console.log(`📈 Steps: ${result.steps.length} total`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    if (verbose || !result.success) {
      console.log(`\n📋 DETAILED STEP RESULTS:`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      result.steps.forEach((step, index) => {
        const status = step.success ? '✅' : '❌';
        console.log(`  ${index + 1}. ${status} ${step.script} (${step.duration.toFixed(2)}s)`);
        if (!step.success && step.error) {
          console.log(`     🚨 Error: ${step.error}`);
        }
      });
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    }

    // Only exit with error code if explicitly requested to stop on error
    if (!result.success && options.includes('--exit-on-error')) {
      process.exit(1);
    }
  }

  private async runAnalysis(options: string[]): Promise<void> {
    const workflowName = options.includes('--quick') ? 'quick-health' : 'comprehensive-analysis';
    await this.runWorkflow([workflowName, ...options.filter(opt => !opt.startsWith('--quick'))]);
  }

  private async runMonitoring(options: string[]): Promise<void> {
    const workflowName = options.includes('--production') ? 'production-ready' : 'system-testing';
    await this.runWorkflow([workflowName, ...options.filter(opt => !opt.startsWith('--production'))]);
  }

  private async runTesting(options: string[]): Promise<void> {
    const workflowName = options.includes('--integration') ? 'system-testing' : 'strategy-testing';
    await this.runWorkflow([workflowName, ...options.filter(opt => !opt.startsWith('--integration'))]);
  }

  private async showStatus(): Promise<void> {
    console.log('\n📊 System Status:');
    console.log('==================\n');

    // Show available scripts count
    const scripts = this.registry.getAllScripts();
    console.log(`📋 Available Scripts: ${scripts.length}`);
    
    // Group by category
    const categories = scripts.reduce((acc, script) => {
      acc[script.category] = (acc[script.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(categories).forEach(([category, count]) => {
      console.log(`  • ${category}: ${count} scripts`);
    });

    // Show available workflows
    const workflows = this.workflowManager.getAvailableWorkflows();
    console.log(`\n🎼 Available Workflows: ${workflows.length}`);
    workflows.forEach(name => console.log(`  • ${name}`));

    console.log('\n💡 Use "list" command to see all scripts');
    console.log('💡 Use "workflow <name>" to run a workflow\n');
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main(): Promise<void> {
  const cli = new OrchestratorCLI();
  const args = process.argv.slice(2);
  await cli.run(args);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

export {
  ScriptRegistry,
  ScriptExecutor,
  WorkflowManager,
  OrchestratorCLI,
  type ScriptConfig,
  type ExecutionResult,
  type WorkflowResult
};
