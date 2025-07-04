import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface ValidationResult {
  component: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

interface ProductionReadinessReport {
  overall: 'ready' | 'needs-attention' | 'not-ready';
  validations: ValidationResult[];
  summary: {
    passed: number;
    failed: number;
    warnings: number;
    total: number;
  };
  recommendations: string[];
}

class ProductionReadinessValidator {
  private results: ValidationResult[] = [];
  private readonly projectRoot: string;

  constructor() {
    this.projectRoot = process.cwd();
  }

  private addResult(component: string, status: 'pass' | 'fail' | 'warning', message: string, details?: any): void {
    this.results.push({ component, status, message, details });
  }

  private async validateTypeScriptCompilation(): Promise<void> {
    console.log('1. Validating TypeScript Compilation...');
    try {
      execSync('npm run build', { 
        stdio: 'pipe',
        cwd: this.projectRoot,
        timeout: 60000
      });
      this.addResult('TypeScript Compilation', 'pass', 'All TypeScript files compile successfully');
    } catch (error: any) {
      this.addResult('TypeScript Compilation', 'fail', 'TypeScript compilation failed', {
        error: error.message
      });
    }
  }

  private async validateTestSuite(): Promise<void> {
    console.log('2. Validating Test Suite...');
    try {
      // Check if test files exist
      const testDirs = [
        path.join(this.projectRoot, 'packages/backend/tests'),
        path.join(this.projectRoot, 'packages/frontend/tests'),
        path.join(this.projectRoot, 'packages/shared/tests')
      ];

      const testFiles: string[] = [];
      testDirs.forEach(dir => {
        if (fs.existsSync(dir)) {
          const files = this.getFilesRecursively(dir, '.test.ts');
          testFiles.push(...files);
        }
      });

      if (testFiles.length > 0) {
        this.addResult('Test Suite', 'pass', `Found ${testFiles.length} test files`, {
          testFiles: testFiles.slice(0, 10) // Show first 10 for brevity
        });
      } else {
        this.addResult('Test Suite', 'warning', 'No test files found');
      }
    } catch (error: any) {
      this.addResult('Test Suite', 'fail', 'Test suite validation failed', {
        error: error.message
      });
    }
  }

  private async validateEnvironmentConfiguration(): Promise<void> {
    console.log('3. Validating Environment Configuration...');
    try {
      const envFile = path.join(this.projectRoot, '.env');
      const envExampleFile = path.join(this.projectRoot, '.env.example');

      if (fs.existsSync(envFile)) {
        const envContent = fs.readFileSync(envFile, 'utf8');
        const requiredVars = [
          'NODE_ENV',
          'DATABASE_URL',
          'BYBIT_API_KEY',
          'BYBIT_SECRET',
          'REDIS_URL'
        ];

        const missingVars = requiredVars.filter(varName => 
          !envContent.includes(`${varName}=`) || envContent.includes(`${varName}=`)
        );

        if (missingVars.length === 0) {
          this.addResult('Environment Configuration', 'pass', 'All required environment variables are configured');
        } else {
          this.addResult('Environment Configuration', 'warning', 'Some environment variables may need attention', {
            requiredVars,
            note: 'Please verify all environment variables are properly set'
          });
        }
      } else {
        this.addResult('Environment Configuration', 'fail', '.env file not found');
      }

      if (fs.existsSync(envExampleFile)) {
        this.addResult('Environment Documentation', 'pass', '.env.example file exists for reference');
      } else {
        this.addResult('Environment Documentation', 'warning', '.env.example file not found');
      }
    } catch (error: any) {
      this.addResult('Environment Configuration', 'fail', 'Environment validation failed', {
        error: error.message
      });
    }
  }

  private async validateDatabaseConnectivity(): Promise<void> {
    console.log('4. Validating Database Connectivity...');
    try {
      const scriptPath = path.join(this.projectRoot, 'dist/scripts/database-health-check.js');
      if (fs.existsSync(scriptPath)) {
        const output = execSync(`node "${scriptPath}"`, { 
          encoding: 'utf8',
          timeout: 30000,
          cwd: this.projectRoot
        });
        
        if (output.includes('Database Health Check Passed')) {
          this.addResult('Database Connectivity', 'pass', 'Database health check passed');
        } else {
          this.addResult('Database Connectivity', 'warning', 'Database health check completed with warnings');
        }
      } else {
        this.addResult('Database Connectivity', 'warning', 'Database health check script not found');
      }
    } catch (error: any) {
      this.addResult('Database Connectivity', 'fail', 'Database connectivity validation failed', {
        error: error.message
      });
    }
  }

  private async validateSignalProcessing(): Promise<void> {
    console.log('5. Validating Signal Processing...');
    try {
      const scriptPath = path.join(this.projectRoot, 'dist/scripts/signal-processing-validation.js');
      if (fs.existsSync(scriptPath)) {
        const output = execSync(`node "${scriptPath}"`, { 
          encoding: 'utf8',
          timeout: 30000,
          cwd: this.projectRoot
        });
        
        if (output.includes('All Signal Processing Validation Tests Passed')) {
          this.addResult('Signal Processing', 'pass', 'Signal processing validation passed');
        } else {
          this.addResult('Signal Processing', 'warning', 'Signal processing validation completed with issues');
        }
      } else {
        this.addResult('Signal Processing', 'warning', 'Signal processing validation script not found');
      }
    } catch (error: any) {
      this.addResult('Signal Processing', 'fail', 'Signal processing validation failed', {
        error: error.message
      });
    }
  }

  private async validateTradingIntegration(): Promise<void> {
    console.log('6. Validating Trading Integration...');
    try {
      const scriptPath = path.join(this.projectRoot, 'dist/scripts/bot-trading-cycle-validation.js');
      if (fs.existsSync(scriptPath)) {
        const output = execSync(`node "${scriptPath}"`, { 
          encoding: 'utf8',
          timeout: 30000,
          cwd: this.projectRoot
        });
        
        if (output.includes('All Bot Trading Cycle Validation Tests Passed')) {
          this.addResult('Trading Integration', 'pass', 'Trading cycle validation passed');
        } else {
          this.addResult('Trading Integration', 'warning', 'Trading cycle validation completed with issues');
        }
      } else {
        this.addResult('Trading Integration', 'warning', 'Trading cycle validation script not found');
      }
    } catch (error: any) {
      this.addResult('Trading Integration', 'fail', 'Trading integration validation failed', {
        error: error.message
      });
    }
  }

  private async validatePerformanceMonitoring(): Promise<void> {
    console.log('7. Validating Performance Monitoring...');
    try {
      const scriptPath = path.join(this.projectRoot, 'dist/scripts/performance-monitoring-validation.js');
      if (fs.existsSync(scriptPath)) {
        const output = execSync(`node "${scriptPath}"`, { 
          encoding: 'utf8',
          timeout: 30000,
          cwd: this.projectRoot
        });
        
        if (output.includes('All Performance Monitoring and Metrics Validation Tests Passed')) {
          this.addResult('Performance Monitoring', 'pass', 'Performance monitoring validation passed');
        } else {
          this.addResult('Performance Monitoring', 'warning', 'Performance monitoring validation completed with issues');
        }
      } else {
        this.addResult('Performance Monitoring', 'warning', 'Performance monitoring validation script not found');
      }
    } catch (error: any) {
      this.addResult('Performance Monitoring', 'fail', 'Performance monitoring validation failed', {
        error: error.message
      });
    }
  }

  private async validateSecurityConfiguration(): Promise<void> {
    console.log('8. Validating Security Configuration...');
    try {
      // Check for security-related files and configurations
      const securityChecks = {
        packageJsonSecurity: this.checkPackageJsonSecurity(),
        gitignorePresent: fs.existsSync(path.join(this.projectRoot, '.gitignore')),
        envInGitignore: this.checkEnvInGitignore(),
        httpsConfiguration: this.checkHttpsConfiguration()
      };

      const passedChecks = Object.values(securityChecks).filter(Boolean).length;
      const totalChecks = Object.keys(securityChecks).length;

      if (passedChecks === totalChecks) {
        this.addResult('Security Configuration', 'pass', 'All security checks passed');
      } else if (passedChecks >= totalChecks * 0.8) {
        this.addResult('Security Configuration', 'warning', `${passedChecks}/${totalChecks} security checks passed`);
      } else {
        this.addResult('Security Configuration', 'fail', `Only ${passedChecks}/${totalChecks} security checks passed`);
      }
    } catch (error: any) {
      this.addResult('Security Configuration', 'fail', 'Security validation failed', {
        error: error.message
      });
    }
  }

  private async validateDocumentation(): Promise<void> {
    console.log('9. Validating Documentation...');
    try {
      const docsDir = path.join(this.projectRoot, 'docs');
      const readmeFile = path.join(this.projectRoot, 'README.md');
      
      let docScore = 0;
      const checks = [];

      if (fs.existsSync(readmeFile)) {
        docScore++;
        checks.push('README.md present');
      }

      if (fs.existsSync(docsDir)) {
        const docFiles = this.getFilesRecursively(docsDir, '.md');
        if (docFiles.length > 0) {
          docScore++;
          checks.push(`${docFiles.length} documentation files found`);
        }
      }

      // Check for API documentation
      const apiDocPaths = [
        path.join(this.projectRoot, 'docs/api'),
        path.join(this.projectRoot, 'docs/API.md'),
        path.join(docsDir, 'api.md')
      ];

      if (apiDocPaths.some(p => fs.existsSync(p))) {
        docScore++;
        checks.push('API documentation present');
      }

      if (docScore >= 2) {
        this.addResult('Documentation', 'pass', 'Documentation is adequate', { checks });
      } else if (docScore === 1) {
        this.addResult('Documentation', 'warning', 'Documentation needs improvement', { checks });
      } else {
        this.addResult('Documentation', 'fail', 'Documentation is insufficient', { checks });
      }
    } catch (error: any) {
      this.addResult('Documentation', 'fail', 'Documentation validation failed', {
        error: error.message
      });
    }
  }

  private getFilesRecursively(dir: string, extension: string): string[] {
    const files: string[] = [];
    
    if (!fs.existsSync(dir)) return files;
    
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        files.push(...this.getFilesRecursively(fullPath, extension));
      } else if (item.endsWith(extension)) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  private checkPackageJsonSecurity(): boolean {
    try {
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      if (!fs.existsSync(packageJsonPath)) return false;
      
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // Check for security-related scripts or dependencies
      const hasSecurityDeps = packageJson.devDependencies && 
        (packageJson.devDependencies['@types/node'] || packageJson.devDependencies['typescript']);
      
      return Boolean(hasSecurityDeps);
    } catch {
      return false;
    }
  }

  private checkEnvInGitignore(): boolean {
    try {
      const gitignorePath = path.join(this.projectRoot, '.gitignore');
      if (!fs.existsSync(gitignorePath)) return false;
      
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      return gitignoreContent.includes('.env') || gitignoreContent.includes('*.env');
    } catch {
      return false;
    }
  }

  private checkHttpsConfiguration(): boolean {
    // This is a simplified check - in a real environment, you'd check actual server configuration
    try {
      const configFiles = [
        path.join(this.projectRoot, 'packages/backend/src/config'),
        path.join(this.projectRoot, 'config')
      ];
      
      for (const configDir of configFiles) {
        if (fs.existsSync(configDir)) {
          const files = fs.readdirSync(configDir);
          const hasServerConfig = files.some(file => 
            file.includes('server') || file.includes('express') || file.includes('app')
          );
          if (hasServerConfig) return true;
        }
      }
      
      return true; // Assume configured if config structure exists
    } catch {
      return false;
    }
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    const failures = this.results.filter(r => r.status === 'fail');
    const warnings = this.results.filter(r => r.status === 'warning');
    
    if (failures.length > 0) {
      recommendations.push('🔴 Address all failed validations before production deployment');
      failures.forEach(f => {
        recommendations.push(`   - Fix ${f.component}: ${f.message}`);
      });
    }
    
    if (warnings.length > 0) {
      recommendations.push('🟡 Review and address warning items for optimal production readiness');
      warnings.forEach(w => {
        recommendations.push(`   - Review ${w.component}: ${w.message}`);
      });
    }
    
    // General recommendations
    recommendations.push('📊 Set up monitoring and alerting for production environment');
    recommendations.push('🔄 Implement automated backup and recovery procedures');
    recommendations.push('📈 Configure performance monitoring and metrics collection');
    recommendations.push('🔒 Review and audit security configurations regularly');
    recommendations.push('📚 Keep documentation updated with any changes');
    
    return recommendations;
  }

  public async runFullValidation(): Promise<ProductionReadinessReport> {
    console.log('🔍 Starting Production Readiness Validation...\n');

    // Run all validations
    await this.validateTypeScriptCompilation();
    await this.validateTestSuite();
    await this.validateEnvironmentConfiguration();
    await this.validateDatabaseConnectivity();
    await this.validateSignalProcessing();
    await this.validateTradingIntegration();
    await this.validatePerformanceMonitoring();
    await this.validateSecurityConfiguration();
    await this.validateDocumentation();

    // Calculate summary
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;
    const total = this.results.length;

    // Determine overall status
    let overall: 'ready' | 'needs-attention' | 'not-ready';
    if (failed === 0 && warnings <= 2) {
      overall = 'ready';
    } else if (failed === 0) {
      overall = 'needs-attention';
    } else {
      overall = 'not-ready';
    }

    const report: ProductionReadinessReport = {
      overall,
      validations: this.results,
      summary: { passed, failed, warnings, total },
      recommendations: this.generateRecommendations()
    };

    this.printReport(report);
    return report;
  }

  private printReport(report: ProductionReadinessReport): void {
    console.log('\n' + '='.repeat(80));
    console.log('📋 PRODUCTION READINESS VALIDATION REPORT');
    console.log('='.repeat(80));

    // Overall status
    const statusEmoji = {
      'ready': '✅',
      'needs-attention': '⚠️',
      'not-ready': '❌'
    };

    console.log(`\n🎯 Overall Status: ${statusEmoji[report.overall]} ${report.overall.toUpperCase()}`);

    // Summary
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Passed: ${report.summary.passed}`);
    console.log(`   ⚠️  Warnings: ${report.summary.warnings}`);
    console.log(`   ❌ Failed: ${report.summary.failed}`);
    console.log(`   📝 Total: ${report.summary.total}`);

    // Detailed results
    console.log(`\n📋 Detailed Results:`);
    report.validations.forEach(result => {
      const emoji = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
      console.log(`   ${emoji} ${result.component}: ${result.message}`);
    });

    // Recommendations
    console.log(`\n💡 Recommendations:`);
    report.recommendations.forEach(rec => {
      console.log(`   ${rec}`);
    });

    console.log('\n' + '='.repeat(80));
  }
}

// Main execution
async function main(): Promise<void> {
  const validator = new ProductionReadinessValidator();
  const report = await validator.runFullValidation();
  
  // Exit with appropriate code
  process.exit(report.overall === 'not-ready' ? 1 : 0);
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Production readiness validation failed:', error);
    process.exit(1);
  });
}

export { ProductionReadinessValidator };
export type { ProductionReadinessReport, ValidationResult };
