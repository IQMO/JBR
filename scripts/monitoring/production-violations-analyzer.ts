#!/usr/bin/env node

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
* Production Violations Analyzer
* Implements Task 41.4 - Identify and Categorize Production Violations
* 
* This script identifies and categorizes code violations that would prevent
* the application from being production-ready, prioritizing critical issues.
*/

interface ViolationCategories {
 CRITICAL: string;
 HIGH: string;
 MEDIUM: string;
 LOW: string;
 INFO: string;
}

interface TypeScriptViolation {
 file: string;
 line: number;
 column: number;
 code: string;
 message: string;
 severity: string;
}

interface ESLintViolation {
 file: string;
 line: number;
 column: number;
 level: string;
 message: string;
 rule: string;
 severity: string;
}

interface CheckResult {
 category: string;
 status: string;
 violations: (TypeScriptViolation | ESLintViolation)[];
 message: string;
}

interface CategoryStats {
 CRITICAL: number;
 HIGH: number;
 MEDIUM: number;
 LOW: number;
 INFO: number;
}

interface DuplicationResults {
 summary?: {
   totalIssues?: number;
   severity?: string;
 };
}

interface ProductionReport {
 timestamp: string;
 project: string;
 task: string;
 productionReadiness: string;
 checks: CheckResult[];
 violations: {
   total: number;
   byCategory: CategoryStats;
   details: any[];
 };
 duplicationIssues: {
   total: number;
   severity: string;
 } | null;
 recommendations: string[];
 blockers: number;
}

class ProductionViolationsAnalyzer {
 private projectRoot: string;
 private reportDir: string;
 private timestamp: string;
 private violationCategories: ViolationCategories;

 constructor() {
   this.projectRoot = process.cwd();
   this.reportDir = path.join(this.projectRoot, 'scripts', 'analysis', 'reports', 'quality');
   this.timestamp = new Date().toISOString().split('T')[0];
   
   // Ensure reports directory exists
   if (!fs.existsSync(this.reportDir)) {
     fs.mkdirSync(this.reportDir, { recursive: true });
   }
   
   // Production readiness categories
   this.violationCategories = {
     CRITICAL: 'Blocks production deployment',
     HIGH: 'Significant production risk',
     MEDIUM: 'Should be fixed before production',
     LOW: 'Improve before production',
     INFO: 'Consider for code quality'
   };
 }

 /**
  * Run TypeScript compilation check
  */
 checkTypeScriptCompilation(): CheckResult {
   console.log('🔍 Checking TypeScript compilation...');
   
   try {
     execSync('npx tsc --noEmit', { stdio: 'pipe' });
     return {
       category: 'typescript',
       status: 'pass',
       violations: [],
       message: 'TypeScript compilation successful'
     };
   } catch (error: any) {
     const output: string = error.stdout?.toString() || error.stderr?.toString() || '';
     const violations: TypeScriptViolation[] = this.parseTypeScriptErrors(output);
     
     return {
       category: 'typescript',
       status: 'fail',
       violations,
       message: `TypeScript compilation failed with ${violations.length} errors`
     };
   }
 }

 /**
  * Parse TypeScript compilation errors
  */
 parseTypeScriptErrors(output: string): TypeScriptViolation[] {
   const violations: TypeScriptViolation[] = [];
   const lines: string[] = output.split('\n');
   
   for (const line of lines) {
     if (line.includes('error TS')) {
       const match: RegExpMatchArray | null = line.match(/(.+)\((\d+),(\d+)\): error (TS\d+): (.+)/);
       if (match) {
         violations.push({
           file: match[1],
           line: parseInt(match[2]),
           column: parseInt(match[3]),
           code: match[4],
           message: match[5],
           severity: this.categorizeTypeScriptError(match[4])
         });
       }
     }
   }
   
   return violations;
 }

 /**
  * Categorize TypeScript errors by production impact
  */
 categorizeTypeScriptError(errorCode: string): string {
   const criticalErrors: string[] = ['TS2304', 'TS2339', 'TS2345', 'TS2322', 'TS2532'];
   const highErrors: string[] = ['TS2531', 'TS2538', 'TS2571', 'TS2749'];
   
   if (criticalErrors.includes(errorCode)) {return 'CRITICAL';}
   if (highErrors.includes(errorCode)) {return 'HIGH';}
   return 'MEDIUM';
 }

 /**
  * Check for security violations
  */
 checkSecurityViolations(): CheckResult {
   console.log('🔒 Checking security violations...');
   
   try {
     execSync('npm run security:check', { stdio: 'pipe' });
     return {
       category: 'security',
       status: 'pass',
       violations: [],
       message: 'No security violations found'
     };
   } catch (error: any) {
     const output: string = error.stdout?.toString() || error.stderr?.toString() || '';
     return {
       category: 'security',
       status: 'fail',
       violations: this.parseESLintOutput(output, 'security'),
       message: 'Security violations found'
     };
   }
 }

 /**
  * Check critical ESLint violations
  */
 checkESLintViolations(): CheckResult {
   console.log('📋 Checking ESLint violations...');
   
   try {
     // Use a simplified ESLint config to avoid dependency issues
     const simpleConfig: string = this.createSimpleESLintConfig();
     const tempConfigPath: string = path.join(this.reportDir, 'temp-eslint.js');
     fs.writeFileSync(tempConfigPath, simpleConfig);
     
     execSync(`npx eslint . --config "${tempConfigPath}" --ext .ts,.tsx,.js,.jsx`, { stdio: 'pipe' });
     
     // Clean up temp config
     fs.unlinkSync(tempConfigPath);
     
     return {
       category: 'eslint',
       status: 'pass',
       violations: [],
       message: 'No ESLint violations found'
     };
   } catch (error: any) {
     const output: string = error.stdout?.toString() || error.stderr?.toString() || '';
     
     // Clean up temp config if it exists
     const tempConfigPath: string = path.join(this.reportDir, 'temp-eslint.js');
     if (fs.existsSync(tempConfigPath)) {
       fs.unlinkSync(tempConfigPath);
     }
     
     return {
       category: 'eslint',
       status: 'fail',
       violations: this.parseESLintOutput(output, 'eslint'),
       message: 'ESLint violations found'
     };
   }
 }

 /**
  * Create a simple ESLint config for production checks
  */
 createSimpleESLintConfig(): string {
   return `
module.exports = {
 env: {
   node: true,
   es2022: true
 },
 extends: ['eslint:recommended'],
 parserOptions: {
   ecmaVersion: 2022,
   sourceType: 'module'
 },
 rules: {
   'no-console': 'warn',
   'no-debugger': 'error',
   'no-alert': 'error',
   'no-eval': 'error',
   'no-implied-eval': 'error',
   'no-new-func': 'error',
   'no-script-url': 'error',
   'no-throw-literal': 'error',
   'no-unused-vars': 'error',
   'no-undef': 'error'
 },
 ignorePatterns: [
   'dist/',
   'build/',
   'node_modules/',
   'coverage/',
   '*.d.ts'
 ]
};`;
 }

 /**
  * Parse ESLint output to extract violations
  */
 parseESLintOutput(output: string, type: string): ESLintViolation[] {
   const violations: ESLintViolation[] = [];
   const lines: string[] = output.split('\n');
   
   for (const line of lines) {
     if (line.includes('error') || line.includes('warning')) {
       const match: RegExpMatchArray | null = line.match(/(.+):(\d+):(\d+): (error|warning) (.+) (.+)/);
       if (match) {
         violations.push({
           file: match[1],
           line: parseInt(match[2]),
           column: parseInt(match[3]),
           level: match[4],
           message: match[5],
           rule: match[6],
           severity: this.categorizeESLintViolation(match[6], match[4])
         });
       }
     }
   }
   
   return violations;
 }

 /**
  * Categorize ESLint violations by production impact
  */
 categorizeESLintViolation(rule: string, level: string): string {
   const criticalRules: string[] = ['no-eval', 'no-implied-eval', 'no-new-func', 'security/'];
   const highRules: string[] = ['no-debugger', 'no-alert', 'no-unused-vars', 'no-undef'];
   
   if (level === 'error' && criticalRules.some(r => rule.includes(r))) {return 'CRITICAL';}
   if (level === 'error' && highRules.some(r => rule.includes(r))) {return 'HIGH';}
   if (level === 'error') {return 'MEDIUM';}
   return 'LOW';
 }

 /**
  * Generate comprehensive production violations report
  */
 async generateProductionReport(): Promise<ProductionReport> {
   console.log('📊 Generating comprehensive production violations report...');
   
   const checks: CheckResult[] = [
     this.checkTypeScriptCompilation(),
     this.checkSecurityViolations(),
     this.checkESLintViolations()
   ];
   
   // Analyze duplication results from previous tasks
   const duplicationResults: DuplicationResults | null = this.loadDuplicationResults();
   
   const allViolations: any[] = [];
   const categoryStats: CategoryStats = {
     CRITICAL: 0,
     HIGH: 0,
     MEDIUM: 0,
     LOW: 0,
     INFO: 0
   };
   
   // Process each check
   for (const check of checks) {
     for (const violation of check.violations || []) {
       allViolations.push({
         ...violation,
         category: check.category,
         checkStatus: check.status
       });
       
       // Type-safe severity handling
       const severity = violation.severity?.toUpperCase() as keyof CategoryStats;
       if (severity && severity in categoryStats) {
         categoryStats[severity]++;
       } else {
         // Default to MEDIUM for unknown severities
         categoryStats.MEDIUM++;
       }
     }
   }
   
   // Add duplication violations from Task 41.2
   if (duplicationResults && duplicationResults.summary) {
     const dupCount: number = duplicationResults.summary.totalIssues || 0;
     if (dupCount > 0) {
       categoryStats.HIGH += dupCount; // Duplication is HIGH severity for production
     }
   }
   
   const report: ProductionReport = {
     timestamp: new Date().toISOString(),
     project: 'JBR Trading Platform',
     task: 'Task 41.4 - Identify and Categorize Production Violations',
     productionReadiness: this.assessProductionReadiness(categoryStats),
     checks,
     violations: {
       total: allViolations.length,
       byCategory: categoryStats,
       details: allViolations
     },
     duplicationIssues: duplicationResults ? {
       total: duplicationResults.summary?.totalIssues || 0,
       severity: duplicationResults.summary?.severity || 'unknown'
     } : null,
     recommendations: this.generateRecommendations(categoryStats, allViolations),
     blockers: allViolations.filter(v => v.severity === 'CRITICAL').length
   };
   
   const reportPath: string = path.join(this.reportDir, `production-violations-${this.timestamp}.json`);
   fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
   
   // Generate HTML report
   this.generateHTMLReport(report);
   
   console.log(`📋 Production violations report generated: ${reportPath}`);
   return report;
 }

 /**
  * Load duplication results from Task 41.2
  */
 loadDuplicationResults(): DuplicationResults | null {
   try {
     const reportPath: string = path.join(this.reportDir.replace('quality', 'duplication'), `duplication-analysis-${this.timestamp}.json`);
     if (fs.existsSync(reportPath)) {
       return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
     }
   } catch (error) {
     console.warn('⚠️  Could not load duplication results');
   }
   return null;
 }

 /**
  * Assess overall production readiness
  */
 assessProductionReadiness(stats: CategoryStats): string {
   if (stats.CRITICAL > 0) {return 'NOT_READY';}
   if (stats.HIGH > 10) {return 'NOT_READY';}
   if (stats.HIGH > 0) {return 'NEEDS_ATTENTION';}
   if (stats.MEDIUM > 20) {return 'NEEDS_IMPROVEMENT';}
   return 'READY';
 }

 /**
  * Generate recommendations based on violations
  */
 generateRecommendations(stats: CategoryStats, violations: any[]): string[] {
   const recommendations: string[] = [];
   
   if (stats.CRITICAL > 0) {
     recommendations.push(`URGENT: Fix ${stats.CRITICAL} critical violations before any deployment`);
   }
   
   if (stats.HIGH > 0) {
     recommendations.push(`Address ${stats.HIGH} high-severity violations for production readiness`);
   }
   
   if (violations.some(v => v.category === 'typescript')) {
     recommendations.push('Fix TypeScript compilation errors for type safety');
   }
   
   if (violations.some(v => v.category === 'security')) {
     recommendations.push('Resolve security violations immediately - these pose production risks');
   }
   
   recommendations.push('Implement automated quality gates in CI/CD pipeline');
   recommendations.push('Establish code review process requiring violation-free code');
   
   return recommendations;
 }

 /**
  * Generate HTML report for easy viewing
  */
 generateHTMLReport(report: ProductionReport): void {
   const htmlContent: string = `
<!DOCTYPE html>
<html>
<head>
   <title>Production Violations Report</title>
   <style>
       body { font-family: Arial, sans-serif; margin: 20px; background: #f5f7fa; }
       .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; }
       .header { background: ${this.getReadinessColor(report.productionReadiness)}; color: white; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
       .status-${report.productionReadiness} { font-weight: bold; }
       .violation { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 5px; }
       .critical { border-left: 4px solid #dc3545; }
       .high { border-left: 4px solid #fd7e14; }
       .medium { border-left: 4px solid #ffc107; }
       .low { border-left: 4px solid #28a745; }
   </style>
</head>
<body>
   <div class="container">
       <div class="header">
           <h1>Production Violations Report</h1>
           <p>Status: <span class="status-${report.productionReadiness}">${report.productionReadiness}</span></p>
           <p>Generated: ${report.timestamp}</p>
           <p>Total Violations: ${report.violations.total}</p>
           <p>Critical Blockers: ${report.blockers}</p>
       </div>
       
       <h2>Violation Summary</h2>
       <ul>
           <li>Critical: ${report.violations.byCategory.CRITICAL}</li>
           <li>High: ${report.violations.byCategory.HIGH}</li>
           <li>Medium: ${report.violations.byCategory.MEDIUM}</li>
           <li>Low: ${report.violations.byCategory.LOW}</li>
       </ul>
       
       <h2>Recommendations</h2>
       ${report.recommendations.map(rec => `<p>💡 ${rec}</p>`).join('')}
   </div>
</body>
</html>`;
   const htmlPath: string = path.join(this.reportDir, `production-violations-${this.timestamp}.html`);
   fs.writeFileSync(htmlPath, htmlContent);
 }

 /**
  * Get color for readiness status
  */
 getReadinessColor(status: string): string {
   const colors: { [key: string]: string } = {
     READY: '#28a745',
     NEEDS_IMPROVEMENT: '#ffc107',
     NEEDS_ATTENTION: '#fd7e14',
     NOT_READY: '#dc3545'
   };
   return colors[status] || '#6c757d';
 }

 /**
  * Run complete production violations analysis
  */
 async analyze(): Promise<ProductionReport> {
   console.log('🚀 Starting production violations analysis...');
   console.log('📁 Project:', this.projectRoot);
   console.log('');
   const report: ProductionReport = await this.generateProductionReport();
   
   console.log('');
   console.log('🎯 Production Readiness Analysis:');
   console.log('📊 Overall Status:', report.productionReadiness);
   console.log('🚨 Critical Violations:', report.violations.byCategory.CRITICAL);
   console.log('⚠️  High Violations:', report.violations.byCategory.HIGH);
   console.log('📋 Total Violations:', report.violations.total);
   console.log('🚫 Production Blockers:', report.blockers);
   console.log('');
   
   if (report.blockers > 0) {
     console.log('❌ PRODUCTION DEPLOYMENT BLOCKED');
     console.log('🔧 Fix critical violations before deployment');
   } else if (report.productionReadiness === 'READY') {
     console.log('✅ PRODUCTION READY');
   } else {
     console.log('⚠️  PRODUCTION NEEDS ATTENTION');
   }
   
   console.log('');
   console.log('✅ Task 41.4 - Identify and Categorize Production Violations: COMPLETED');
   
   return report;
 }
}

// Run analysis if called directly
if (require.main === module) {
 const analyzer = new ProductionViolationsAnalyzer();
 analyzer.analyze().catch(console.error);
}

export default ProductionViolationsAnalyzer;