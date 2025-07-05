#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * Post-Implementation Validation Script
 * Runs comprehensive checks after code changes to ensure quality and compliance
 * Part of Task 53.4 - Create New Post-Implementation Check Scripts
 */

interface ValidationRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  check: () => Promise<ValidationResult>;
}

interface ValidationResult {
  passed: boolean;
  message: string;
  details?: string[];
  suggestions?: string[];
}

interface ValidationReport {
  timestamp: string;
  project: string;
  task: string;
  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
    errors: number;
  };
  results: Array<{
    rule: ValidationRule;
    result: ValidationResult;
  }>;
  overallStatus: 'PASS' | 'FAIL' | 'WARNING';
}

class PostImplementationValidator {
  private projectRoot: string;
  private reportDir: string;
  private timestamp: string;
  private rules: ValidationRule[];

  constructor() {
    this.projectRoot = process.cwd();
    this.reportDir = path.join(this.projectRoot, 'scripts', 'analysis', 'reports', 'quality');
    this.timestamp = new Date().toISOString().split('T')[0];
    
    // Ensure reports directory exists
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }

    this.rules = this.defineValidationRules();
  }

  /**
   * Define all validation rules for post-implementation checks
   */
  private defineValidationRules(): ValidationRule[] {
    return [
      {
        id: 'typescript-compilation',
        name: 'TypeScript Compilation',
        description: 'Verify that all TypeScript code compiles without errors',
        severity: 'error',
        check: async () => this.checkTypeScriptCompilation()
      },
      {
        id: 'test-execution',
        name: 'Test Execution',
        description: 'Ensure all tests pass after implementation changes',
        severity: 'error',
        check: async () => this.checkTestExecution()
      },
      {
        id: 'lint-compliance',
        name: 'Lint Compliance',
        description: 'Verify code follows linting rules and standards',
        severity: 'warning',
        check: async () => this.checkLintCompliance()
      },
      {
        id: 'import-resolution',
        name: 'Import Resolution',
        description: 'Check that all imports resolve correctly across workspaces',
        severity: 'error',
        check: async () => this.checkImportResolution()
      },
      {
        id: 'documentation-sync',
        name: 'Documentation Synchronization',
        description: 'Ensure documentation is updated and synchronized with code changes',
        severity: 'warning',
        check: async () => this.checkDocumentationSync()
      },
      {
        id: 'security-compliance',
        name: 'Security Compliance',
        description: 'Verify no new security vulnerabilities are introduced',
        severity: 'error',
        check: async () => this.checkSecurityCompliance()
      }
    ];
  }

  /**
   * Check TypeScript compilation across all workspaces
   */
  private async checkTypeScriptCompilation(): Promise<ValidationResult> {
    try {
      console.log('🔧 Checking TypeScript compilation...');
      
      const workspaces = ['packages/backend', 'packages/frontend', 'packages/shared'];
      const errors: string[] = [];
      
      for (const workspace of workspaces) {
        try {
          const output = execSync(`npm run build --workspace=${workspace}`, {
            stdio: 'pipe',
            encoding: 'utf8',
            cwd: this.projectRoot
          });
        } catch (error: any) {
          errors.push(`${workspace}: ${error.message}`);
        }
      }
      
      if (errors.length === 0) {
        return {
          passed: true,
          message: 'All TypeScript code compiles successfully',
          details: [`Checked ${workspaces.length} workspaces`]
        };
      } else {
        return {
          passed: false,
          message: `TypeScript compilation failed in ${errors.length} workspace(s)`,
          details: errors,
          suggestions: [
            'Run npm run build in each failed workspace to see detailed errors',
            'Check for missing dependencies or type definitions',
            'Verify import paths are correct'
          ]
        };
      }
    } catch (error: any) {
      return {
        passed: false,
        message: 'Failed to check TypeScript compilation',
        details: [error.message]
      };
    }
  }

  /**
   * Check test execution across all workspaces
   */
  private async checkTestExecution(): Promise<ValidationResult> {
    try {
      console.log('🧪 Checking test execution...');
      
      const testResults: string[] = [];
      const errors: string[] = [];
      
      try {
        const output = execSync('npm run test:unit', {
          stdio: 'pipe',
          encoding: 'utf8',
          cwd: this.projectRoot
        });
        testResults.push('Unit tests: PASSED');
      } catch (error: any) {
        errors.push(`Unit tests: ${error.message}`);
      }
      
      if (errors.length === 0) {
        return {
          passed: true,
          message: 'All tests pass successfully',
          details: testResults
        };
      } else {
        return {
          passed: false,
          message: `Test execution failed`,
          details: errors,
          suggestions: [
            'Run npm run test:unit to see detailed test failures',
            'Check for breaking changes in implementation',
            'Update tests if API changes are intentional'
          ]
        };
      }
    } catch (error: any) {
      return {
        passed: false,
        message: 'Failed to execute tests',
        details: [error.message]
      };
    }
  }
  /**
   * Check lint compliance
   */
  private async checkLintCompliance(): Promise<ValidationResult> {
    try {
      console.log('📋 Checking lint compliance...');
      
      const output = execSync('npm run lint:root', {
        stdio: 'pipe',
        encoding: 'utf8',
        cwd: this.projectRoot
      });
      
      return {
        passed: true,
        message: 'Code passes all linting rules',
        details: ['No linting errors found']
      };
    } catch (error: any) {
      const errorOutput = error.stdout || error.message;
      const warningCount = (errorOutput.match(/warning/gi) || []).length;
      const errorCount = (errorOutput.match(/error/gi) || []).length;
      
      return {
        passed: errorCount === 0,
        message: `Linting found ${errorCount} errors and ${warningCount} warnings`,
        details: [errorOutput],
        suggestions: [
          'Run npm run lint:fix to automatically fix some issues',
          'Review and fix remaining linting errors manually'
        ]
      };
    }
  }

  /**
   * Check import resolution across workspaces
   */
  private async checkImportResolution(): Promise<ValidationResult> {
    try {
      console.log('🔗 Checking import resolution...');
      
      const sourceFiles = this.getSourceFiles([
        path.join(this.projectRoot, 'packages'),
        path.join(this.projectRoot, 'scripts')
      ]);
      
      const unresolvedImports: string[] = [];
      
      for (const file of sourceFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const imports = content.match(/^import.*from\s+['"][^'"]+['"];?$/gm) || [];
        
        for (const importStatement of imports) {
          const match = importStatement.match(/from\s+['"]([^'"]+)['"];?$/);
          if (match) {
            const importPath = match[1];
            if (importPath.startsWith('.') || importPath.startsWith('@jabbr/')) {
              // Check relative and workspace imports
              const resolvedPath = this.resolveImportPath(file, importPath);
              if (!resolvedPath) {
                unresolvedImports.push(`${path.relative(this.projectRoot, file)}: ${importPath}`);
              }
            }
          }
        }
      }
      
      if (unresolvedImports.length === 0) {
        return {
          passed: true,
          message: 'All imports resolve correctly',
          details: [`Checked ${sourceFiles.length} files`]
        };
      } else {
        return {
          passed: false,
          message: `Found ${unresolvedImports.length} unresolved imports`,
          details: unresolvedImports.slice(0, 10), // Limit output
          suggestions: [
            'Check file paths and ensure referenced files exist',
            'Verify workspace package configurations',
            'Update import paths if files were moved'
          ]
        };
      }
    } catch (error: any) {
      return {
        passed: false,
        message: 'Failed to check import resolution',
        details: [error.message]
      };
    }
  }

  /**
   * Check documentation synchronization
   */
  private async checkDocumentationSync(): Promise<ValidationResult> {
    try {
      console.log('📖 Checking documentation synchronization...');
      
      const output = execSync('npx tsx scripts/validate-documentation-precise.ts', {
        stdio: 'pipe',
        encoding: 'utf8',
        cwd: this.projectRoot
      });
      
      return {
        passed: true,
        message: 'Documentation is synchronized and up-to-date',
        details: ['All documentation validation checks passed']
      };
    } catch (error: any) {
      const errorOutput = error.stdout || error.message;
      const criticalIssues = (errorOutput.match(/critical issue/gi) || []).length;
      
      return {
        passed: criticalIssues === 0,
        message: `Documentation validation found ${criticalIssues} critical issues`,
        details: [errorOutput],
        suggestions: [
          'Update documentation to reflect recent code changes',
          'Check date stamps and version numbers',
          'Ensure all referenced files exist'
        ]
      };
    }
  }

  /**
   * Check security compliance
   */
  private async checkSecurityCompliance(): Promise<ValidationResult> {
    try {
      console.log('🔒 Checking security compliance...');
      
      const output = execSync('npm run security:check', {
        stdio: 'pipe',
        encoding: 'utf8',
        cwd: this.projectRoot
      });
      
      return {
        passed: true,
        message: 'No security violations detected',
        details: ['Security checks passed']
      };
    } catch (error: any) {
      const errorOutput = error.stdout || error.message;
      const errorCount = (errorOutput.match(/error/gi) || []).length;
      
      return {
        passed: errorCount === 0,
        message: `Security check found ${errorCount} issues`,
        details: [errorOutput],
        suggestions: [
          'Review and fix security violations',
          'Consider using safer alternatives for flagged patterns',
          'Add security exceptions if issues are false positives'
        ]
      };
    }
  }
  /**
   * Get all source files recursively
   */
  private getSourceFiles(dirs: string[], extensions: string[] = ['.ts', '.tsx', '.js', '.jsx']): string[] {
    const files: string[] = [];
    
    const scanDirectory = (currentDir: string) => {
      if (!fs.existsSync(currentDir)) return;
      
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          // Skip node_modules, dist, build, etc.
          if (['node_modules', 'dist', 'build', 'coverage', '.next', 'out'].includes(entry.name)) {
            continue;
          }
          scanDirectory(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    };
    
    for (const dir of dirs) {
      scanDirectory(dir);
    }
    return files;
  }

  /**
   * Resolve import path to actual file
   */
  private resolveImportPath(fromFile: string, importPath: string): string | null {
    try {
      if (importPath.startsWith('@jabbr/')) {
        // Workspace import
        const workspaceName = importPath.split('/')[1];
        const workspacePath = path.join(this.projectRoot, 'packages', workspaceName);
        const packageJson = path.join(workspacePath, 'package.json');
        
        if (fs.existsSync(packageJson)) {
          const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
          const mainFile = pkg.main || 'dist/index.js';
          return path.join(workspacePath, mainFile);
        }
        return null;
      } else if (importPath.startsWith('.')) {
        // Relative import
        const basePath = path.dirname(fromFile);
        const fullPath = path.resolve(basePath, importPath);
        
        // Try different extensions
        const possibleFiles = [
          fullPath,
          fullPath + '.ts',
          fullPath + '.tsx',
          fullPath + '.js',
          fullPath + '.jsx',
          path.join(fullPath, 'index.ts'),
          path.join(fullPath, 'index.tsx'),
          path.join(fullPath, 'index.js'),
          path.join(fullPath, 'index.jsx')
        ];
        
        for (const file of possibleFiles) {
          if (fs.existsSync(file)) {
            return file;
          }
        }
        return null;
      }
      
      return null; // External packages are not checked
    } catch {
      return null;
    }
  }

  /**
   * Run all validation checks
   */
  async validate(): Promise<ValidationReport> {
    console.log('🚀 Starting post-implementation validation...');
    console.log('📁 Project:', this.projectRoot);
    console.log('');
    
    const results: Array<{ rule: ValidationRule; result: ValidationResult }> = [];
    let passed = 0;
    let failed = 0;
    let warnings = 0;
    let errors = 0;
    
    for (const rule of this.rules) {
      console.log(`🔍 Running: ${rule.name}...`);
      const result = await rule.check();
      results.push({ rule, result });
      
      if (result.passed) {
        passed++;
        console.log(`✅ ${rule.name}: PASSED`);
      } else {
        failed++;
        if (rule.severity === 'error') {
          errors++;
          console.log(`❌ ${rule.name}: FAILED (ERROR)`);
        } else {
          warnings++;
          console.log(`⚠️  ${rule.name}: FAILED (WARNING)`);
        }
      }
      console.log('');
    }
    
    const overallStatus = errors > 0 ? 'FAIL' : warnings > 0 ? 'WARNING' : 'PASS';
    
    const report: ValidationReport = {
      timestamp: new Date().toISOString(),
      project: 'JBR Trading Platform',
      task: 'Task 53.4 - Post-Implementation Validation',
      summary: {
        totalChecks: this.rules.length,
        passed,
        failed,
        warnings,
        errors
      },
      results,
      overallStatus
    };
    
    // Save report
    const reportPath = path.join(this.reportDir, `post-implementation-${this.timestamp}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Display summary
    console.log('🎯 POST-IMPLEMENTATION VALIDATION SUMMARY:');
    console.log(`📊 Overall Status: ${overallStatus}`);
    console.log(`✅ Passed: ${passed}/${this.rules.length}`);
    console.log(`❌ Failed: ${failed}/${this.rules.length}`);
    console.log(`🚨 Errors: ${errors}`);
    console.log(`⚠️  Warnings: ${warnings}`);
    console.log('');
    
    if (failed > 0) {
      console.log('❌ FAILED CHECKS:');
      for (const { rule, result } of results) {
        if (!result.passed) {
          console.log(`   ${rule.name}: ${result.message}`);
          if (result.suggestions) {
            result.suggestions.forEach(suggestion => {
              console.log(`     💡 ${suggestion}`);
            });
          }
        }
      }
    }
    
    console.log(`📋 Full report saved: ${reportPath}`);
    
    return report;
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new PostImplementationValidator();
  validator.validate()
    .then(report => {
      process.exit(report.overallStatus === 'FAIL' ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    });
}

export { PostImplementationValidator, ValidationReport, ValidationResult, ValidationRule };
