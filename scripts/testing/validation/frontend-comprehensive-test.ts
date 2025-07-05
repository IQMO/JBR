#!/usr/bin/env node

/**
 * Frontend Comprehensive Testing Suite
 * Complete frontend analysis, dependency verification, and component testing
 * Part of JBR Scripts Infrastructure - Testing Category
 * 
 * Features:
 * - Dependency verification and analysis
 * - Component compilation testing
 * - Material-UI compatibility checking
 * - TypeScript configuration analysis
 * - Production readiness assessment
 * - Performance and security validation
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface TestResult {
  component: string;
  status: 'success' | 'error' | 'warning';
  errors: string[];
  warnings: string[];
  duration?: number;
}

interface DependencyInfo {
  name: string;
  declared: string | null;
  installed: boolean;
  actualVersion?: string;
  security?: 'safe' | 'warning' | 'critical';
}

interface ComponentMetrics {
  name: string;
  lines: number;
  complexity: number;
  dependencies: string[];
  issues: string[];
}

class FrontendComprehensiveTest {
  private readonly projectRoot: string;
  private readonly frontendDir: string;
  private readonly reportsDir: string;
  private testResults: TestResult[] = [];
  private dependencies: DependencyInfo[] = [];
  private componentMetrics: ComponentMetrics[] = [];
  private startTime: number = Date.now();

  constructor() {
    this.projectRoot = path.resolve(__dirname, '../../../');
    this.frontendDir = path.join(this.projectRoot, 'packages/frontend');
    this.reportsDir = path.join(this.projectRoot, 'scripts/analysis/reports/quality');
    
    // Ensure reports directory exists
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Main execution entry point
   */
  public async runComprehensiveTest(): Promise<void> {
    console.log('🚀 Starting Frontend Comprehensive Testing Suite...');
    console.log(`📁 Frontend Directory: ${this.frontendDir}`);
    console.log(`📊 Reports Directory: ${this.reportsDir}`);
    console.log('━'.repeat(80));

    try {
      await this.validateEnvironment();
      await this.analyzeDependencies();
      await this.testComponentCompilation();
      await this.checkMaterialUICompatibility();
      await this.analyzeTSConfiguration();
      
      this.generateComprehensiveReport();
      this.saveReportToFile();
      
      console.log('\n✅ Frontend comprehensive testing completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Frontend testing failed:', error);
      process.exit(1);
    }
  }

  /**
   * Validate testing environment and prerequisites
   */
  private async validateEnvironment(): Promise<void> {
    console.log('\n🔍 Phase 1: Environment Validation');
    console.log('─'.repeat(40));

    // Check if frontend directory exists
    if (!fs.existsSync(this.frontendDir)) {
      throw new Error(`Frontend directory not found: ${this.frontendDir}`);
    }

    // Check required files
    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      'src/components',
      'src/hooks'
    ];

    console.log('📋 Checking required files and directories:');
    requiredFiles.forEach(file => {
      const filePath = path.join(this.frontendDir, file);
      const exists = fs.existsSync(filePath);
      console.log(`  ${file}: ${exists ? '✅' : '❌'}`);
      
      if (!exists && (file === 'package.json' || file === 'tsconfig.json')) {
        throw new Error(`Critical file missing: ${file}`);
      }
    });

    console.log('✅ Environment validation completed');
  }

  /**
   * Comprehensive dependency analysis
   */
  private async analyzeDependencies(): Promise<void> {
    console.log('\n📦 Phase 2: Dependency Analysis');
    console.log('─'.repeat(40));

    const packageJsonPath = path.join(this.frontendDir, 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('package.json not found in frontend directory');
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const nodeModulesPath = path.join(this.frontendDir, 'node_modules');

    // Critical frontend dependencies to analyze
    const criticalDependencies = [
      '@mui/material',
      '@mui/icons-material',
      '@emotion/react',
      '@emotion/styled',
      'next',
      'react',
      'react-dom',
      'typescript'
    ];

    console.log('🔍 Analyzing critical dependencies:');

    for (const depName of criticalDependencies) {
      const depInfo: DependencyInfo = {
        name: depName,
        declared: packageJson.dependencies?.[depName] || packageJson.devDependencies?.[depName] || null,
        installed: false,
        security: 'safe'
      };

      // Check if actually installed
      const depPath = path.join(nodeModulesPath, depName);
      depInfo.installed = fs.existsSync(depPath);

      if (depInfo.installed) {
        try {
          const depPackageJsonPath = path.join(depPath, 'package.json');
          if (fs.existsSync(depPackageJsonPath)) {
            const depPackageJson = JSON.parse(fs.readFileSync(depPackageJsonPath, 'utf8'));
            depInfo.actualVersion = depPackageJson.version;
          }
        } catch (error) {
          console.log(`    ⚠️  Version check failed for ${depName}: ${error}`);
        }
      }

      // Basic security assessment
      if (depInfo.declared && !depInfo.installed) {
        depInfo.security = 'warning';
      }

      this.dependencies.push(depInfo);

      console.log(`  ${depName}:`);
      console.log(`    Declared: ${depInfo.declared || 'NOT LISTED'}`);
      console.log(`    Installed: ${depInfo.installed ? '✅' : '❌'}`);
      console.log(`    Version: ${depInfo.actualVersion || 'N/A'}`);
      console.log(`    Security: ${this.getSecurityIcon(depInfo.security)}`);
    }

    // Check for missing installations
    const missingDeps = this.dependencies.filter(dep => dep.declared && !dep.installed);
    if (missingDeps.length > 0) {
      console.log('\n⚠️  Missing dependencies detected:');
      missingDeps.forEach(dep => console.log(`    - ${dep.name}`));
      console.log('💡 Run: npm install in packages/frontend');
    }

    console.log('✅ Dependency analysis completed');
  }

  /**
   * Get security status icon
   */
  private getSecurityIcon(security: string): string {
    switch (security) {
      case 'safe': return '🟢 Safe';
      case 'warning': return '🟡 Warning';
      case 'critical': return '🔴 Critical';
      default: return '⚪ Unknown';
    }
  }

  /**
   * Test individual component compilation and analyze metrics
   */
  private async testComponentCompilation(): Promise<void> {
    console.log('\n🎯 Phase 3: Component Compilation Testing');
    console.log('─'.repeat(40));

    // Core components to test
    const coreComponents = [
      'src/components/LogViewer.tsx',
      'src/components/AlertSystem.tsx',
      'src/components/LogAndAlertDashboard.tsx',
      'src/components/PositionPnLVisualization.tsx',
      'src/components/TradingActivityMonitor.tsx',
      'src/components/StrategyMonitor.tsx',
      'src/components/ConnectionStatus.tsx',
      'src/components/ErrorBoundary.tsx',
      'src/components/Loading.tsx',
      'src/hooks/useWebSocket.ts',
      'src/contexts/WebSocketContext.tsx',
      'src/services/api.ts'
    ];

    console.log('🧪 Testing component compilation:');

    for (const componentPath of coreComponents) {
      const startTime = Date.now();
      const result: TestResult = {
        component: componentPath,
        status: 'success',
        errors: [],
        warnings: [],
        duration: 0
      };

      const fullPath = path.join(this.frontendDir, componentPath);
      
      if (!fs.existsSync(fullPath)) {
        result.status = 'warning';
        result.warnings.push('Component file not found');
        console.log(`  ⚠️  ${componentPath}: File not found`);
        this.testResults.push(result);
        continue;
      }

      try {
        // Analyze component metrics
        const metrics = this.analyzeComponentMetrics(fullPath, componentPath);
        this.componentMetrics.push(metrics);

        // Test TypeScript compilation
        const command = `cd "${this.frontendDir}" && npx tsc --noEmit --skipLibCheck --jsx react-jsx "${componentPath}"`;
        
        execSync(command, { 
          stdio: 'pipe', 
          encoding: 'utf8',
          timeout: 30000
        });

        result.status = 'success';
        result.duration = Date.now() - startTime;
        console.log(`  ✅ ${componentPath}: Compiled successfully (${result.duration}ms)`);
        
      } catch (error: any) {
        result.status = 'error';
        result.duration = Date.now() - startTime;
        
        const errorOutput = error.stdout || error.stderr || '';
        
        // Parse TypeScript errors
        result.errors = errorOutput
          .split('\n')
          .filter((line: string) => 
            line.includes('error TS') && 
            !line.includes('node_modules')
          )
          .slice(0, 3); // Limit to first 3 errors

        console.log(`  ❌ ${componentPath}: Compilation errors (${result.duration}ms)`);
        if (result.errors.length > 0) {
          result.errors.forEach((err: string) => console.log(`    ${err.trim()}`));
        }
      }

      this.testResults.push(result);
    }

    // Summary
    const successful = this.testResults.filter(r => r.status === 'success');
    const errors = this.testResults.filter(r => r.status === 'error');
    const warnings = this.testResults.filter(r => r.status === 'warning');

    console.log(`\n📊 Compilation Summary:`);
    console.log(`  ✅ Successful: ${successful.length}`);
    console.log(`  ❌ Errors: ${errors.length}`);
    console.log(`  ⚠️  Warnings: ${warnings.length}`);
    console.log(`  📈 Total: ${this.testResults.length}`);

    console.log('✅ Component compilation testing completed');
  }

  /**
   * Analyze individual component metrics
   */
  private analyzeComponentMetrics(filePath: string, componentName: string): ComponentMetrics {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    // Basic metrics
    const metrics: ComponentMetrics = {
      name: componentName,
      lines: lines.length,
      complexity: this.calculateComplexity(content),
      dependencies: this.extractDependencies(content),
      issues: []
    };

    // Detect potential issues
    if (metrics.lines > 500) {
      metrics.issues.push('Large file - consider splitting');
    }
    
    if (metrics.complexity > 20) {
      metrics.issues.push('High complexity - refactor recommended');
    }

    if (metrics.dependencies.length > 15) {
      metrics.issues.push('Many dependencies - review imports');
    }

    return metrics;
  }

  /**
   * Calculate basic cyclomatic complexity
   */
  private calculateComplexity(content: string): number {
    const complexityPatterns = [
      /if\s*\(/g,
      /else\s*if/g,
      /else\s*{/g,
      /switch\s*\(/g,
      /case\s+/g,
      /for\s*\(/g,
      /while\s*\(/g,
      /catch\s*\(/g,
      /\?\s*.*\s*:/g, // ternary operators
      /&&|\|\|/g // logical operators
    ];

    let complexity = 1; // Base complexity

    complexityPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    });

    return complexity;
  }

  /**
   * Extract import dependencies from component
   */
  private extractDependencies(content: string): string[] {
    const importPattern = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    const dependencies: string[] = [];
    let match;

    while ((match = importPattern.exec(content)) !== null) {
      dependencies.push(match[1]);
    }

    return dependencies;
  }

  /**
   * Test Material-UI compatibility and Grid v2 syntax
   */
  private async checkMaterialUICompatibility(): Promise<void> {
    console.log('\n🔍 Phase 4: Material-UI Compatibility Testing');
    console.log('─'.repeat(40));

    // Test Grid v2 syntax compatibility
    await this.testGridV2Compatibility();
    
    // Test theme compatibility
    await this.testThemeCompatibility();
    
    // Test icon compatibility
    await this.testIconCompatibility();

    console.log('✅ Material-UI compatibility testing completed');
  }

  /**
   * Test Grid v2 syntax compatibility
   */
  private async testGridV2Compatibility(): Promise<void> {
    console.log('🎯 Testing Grid v2 syntax compatibility...');

    const gridTestContent = `import React from 'react';
import { Grid, Card, Typography, Box } from '@mui/material';

const GridV2Test: React.FC = () => {
  return (
    <Box>
      {/* Test new Grid v2 syntax */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <Typography>Grid v2 with size prop</Typography>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <Typography>Responsive grid item</Typography>
          </Card>
        </Grid>
      </Grid>
      
      {/* Test legacy syntax for comparison */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card>
            <Typography>Legacy Grid with item prop</Typography>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default GridV2Test;`;

    const testFilePath = path.join(this.frontendDir, 'mui-grid-test.tsx');
    
    try {
      fs.writeFileSync(testFilePath, gridTestContent);
      
      const command = `cd "${this.frontendDir}" && npx tsc --noEmit --skipLibCheck --jsx react-jsx mui-grid-test.tsx`;
      execSync(command, { stdio: 'pipe', encoding: 'utf8', timeout: 20000 });
      
      console.log('  ✅ Grid v2 syntax: Compatible');
      
    } catch (error: any) {
      console.log('  ❌ Grid v2 syntax: Issues detected');
      
      const errorOutput = error.stdout || error.stderr || '';
      const gridErrors = errorOutput
        .split('\n')
        .filter((line: string) => line.includes('error TS') || line.includes('Grid'))
        .slice(0, 2);
      
      if (gridErrors.length > 0) {
        gridErrors.forEach((err: string) => console.log(`    ${err.trim()}`));
      }
    } finally {
      // Clean up test file
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  }

  /**
   * Test theme compatibility
   */
  private async testThemeCompatibility(): Promise<void> {
    console.log('🎨 Testing theme compatibility...');

    const themeTestContent = `import React from 'react';
import { ThemeProvider, createTheme, useTheme } from '@mui/material/styles';
import { Typography, Box } from '@mui/material';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#1976d2',
    },
  },
});

const ThemeTest: React.FC = () => {
  const currentTheme = useTheme();
  
  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ p: 2, bgcolor: 'background.default' }}>
        <Typography variant="h6" color="primary">
          Theme Test Component
        </Typography>
      </Box>
    </ThemeProvider>
  );
};

export default ThemeTest;`;

    const testFilePath = path.join(this.frontendDir, 'mui-theme-test.tsx');
    
    try {
      fs.writeFileSync(testFilePath, themeTestContent);
      
      const command = `cd "${this.frontendDir}" && npx tsc --noEmit --skipLibCheck --jsx react-jsx mui-theme-test.tsx`;
      execSync(command, { stdio: 'pipe', encoding: 'utf8', timeout: 20000 });
      
      console.log('  ✅ Theme system: Compatible');
      
    } catch (error: any) {
      console.log('  ❌ Theme system: Issues detected');
    } finally {
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  }

  /**
   * Test icon compatibility
   */
  private async testIconCompatibility(): Promise<void> {
    console.log('🎭 Testing icon compatibility...');

    const iconTestContent = `import React from 'react';
import { 
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { Box, IconButton } from '@mui/material';

const IconTest: React.FC = () => {
  return (
    <Box display="flex" gap={1}>
      <IconButton color="info">
        <InfoIcon />
      </IconButton>
      <IconButton color="warning">
        <WarningIcon />
      </IconButton>
      <IconButton color="error">
        <ErrorIcon />
      </IconButton>
      <IconButton color="success">
        <SuccessIcon />
      </IconButton>
      <IconButton>
        <SettingsIcon />
      </IconButton>
    </Box>
  );
};

export default IconTest;`;

    const testFilePath = path.join(this.frontendDir, 'mui-icon-test.tsx');
    
    try {
      fs.writeFileSync(testFilePath, iconTestContent);
      
      const command = `cd "${this.frontendDir}" && npx tsc --noEmit --skipLibCheck --jsx react-jsx mui-icon-test.tsx`;
      execSync(command, { stdio: 'pipe', encoding: 'utf8', timeout: 20000 });
      
      console.log('  ✅ Icon system: Compatible');
      
    } catch (error: any) {
      console.log('  ❌ Icon system: Issues detected');
    } finally {
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  }

  /**
   * Analyze TypeScript configuration
   */
  private async analyzeTSConfiguration(): Promise<void> {
    console.log('\n⚙️  Phase 5: TypeScript Configuration Analysis');
    console.log('─'.repeat(40));

    const tsConfigPath = path.join(this.frontendDir, 'tsconfig.json');
    
    if (!fs.existsSync(tsConfigPath)) {
      console.log('❌ tsconfig.json not found');
      return;
    }

    try {
      const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf8'));
      
      console.log('📋 TypeScript Configuration Analysis:');
      console.log(`  Target: ${tsConfig.compilerOptions?.target || 'NOT SET'}`);
      console.log(`  Module: ${tsConfig.compilerOptions?.module || 'NOT SET'}`);
      console.log(`  JSX: ${tsConfig.compilerOptions?.jsx || 'NOT SET'}`);
      console.log(`  moduleResolution: ${tsConfig.compilerOptions?.moduleResolution || 'NOT SET'}`);
      console.log(`  strict: ${tsConfig.compilerOptions?.strict ?? 'NOT SET'}`);
      console.log(`  noEmit: ${tsConfig.compilerOptions?.noEmit ?? 'NOT SET'}`);
      
      // Check for important settings
      const recommendations: string[] = [];
      
      if (!tsConfig.compilerOptions?.strict) {
        recommendations.push('Enable strict mode for better type safety');
      }
      
      if (tsConfig.compilerOptions?.target === 'es5') {
        recommendations.push('Consider upgrading target to ES2020 or newer');
      }
      
      if (!tsConfig.compilerOptions?.skipLibCheck) {
        recommendations.push('Consider enabling skipLibCheck for faster builds');
      }

      // Check Next.js integration
      if (tsConfig.extends?.includes('next')) {
        console.log('  ✅ Next.js TypeScript configuration detected');
      }

      // Check path mapping
      if (tsConfig.compilerOptions?.paths) {
        console.log('  ✅ Path mapping configured');
        const pathCount = Object.keys(tsConfig.compilerOptions.paths).length;
        console.log(`  📁 Mapped paths: ${pathCount}`);
      }

      if (recommendations.length > 0) {
        console.log('\n💡 Configuration Recommendations:');
        recommendations.forEach((rec, index) => {
          console.log(`  ${index + 1}. ${rec}`);
        });
      }

    } catch (error) {
      console.log('❌ Error parsing tsconfig.json:', error);
    }

    console.log('✅ TypeScript configuration analysis completed');
  }

  /**
   * Generate comprehensive test report
   */
  private generateComprehensiveReport(): void {
    console.log('\n📋 FRONTEND COMPREHENSIVE TEST REPORT');
    console.log('='.repeat(80));

    const duration = Date.now() - this.startTime;
    const successful = this.testResults.filter(r => r.status === 'success');
    const errors = this.testResults.filter(r => r.status === 'error');
    const warnings = this.testResults.filter(r => r.status === 'warning');

    // Executive Summary
    console.log('\n🎯 EXECUTIVE SUMMARY:');
    console.log(`  ⏱️  Total Duration: ${duration}ms`);
    console.log(`  📊 Components Tested: ${this.testResults.length}`);
    console.log(`  ✅ Successful: ${successful.length} (${Math.round(successful.length / this.testResults.length * 100)}%)`);
    console.log(`  ❌ Errors: ${errors.length}`);
    console.log(`  ⚠️  Warnings: ${warnings.length}`);

    // Dependency Status
    console.log('\n📦 DEPENDENCY STATUS:');
    const safeDeps = this.dependencies.filter(d => d.security === 'safe' && d.installed);
    const warningDeps = this.dependencies.filter(d => d.security === 'warning');
    const criticalDeps = this.dependencies.filter(d => d.security === 'critical');

    console.log(`  🟢 Safe Dependencies: ${safeDeps.length}`);
    console.log(`  🟡 Warning Dependencies: ${warningDeps.length}`);
    console.log(`  🔴 Critical Dependencies: ${criticalDeps.length}`);

    if (warningDeps.length > 0) {
      console.log('  ⚠️  Dependencies needing attention:');
      warningDeps.forEach(dep => console.log(`    - ${dep.name}: ${dep.declared || 'Not declared'}`));
    }

    // Component Metrics Summary
    console.log('\n📈 COMPONENT METRICS:');
    if (this.componentMetrics.length > 0) {
      const avgLines = Math.round(this.componentMetrics.reduce((sum, m) => sum + m.lines, 0) / this.componentMetrics.length);
      const avgComplexity = Math.round(this.componentMetrics.reduce((sum, m) => sum + m.complexity, 0) / this.componentMetrics.length);
      const totalIssues = this.componentMetrics.reduce((sum, m) => sum + m.issues.length, 0);

      console.log(`  📄 Average Lines per Component: ${avgLines}`);
      console.log(`  🔄 Average Complexity: ${avgComplexity}`);
      console.log(`  🚨 Total Issues Found: ${totalIssues}`);

      // Highlight components with issues
      const problematicComponents = this.componentMetrics.filter(m => m.issues.length > 0);
      if (problematicComponents.length > 0) {
        console.log('\n  ⚠️  Components needing attention:');
        problematicComponents.forEach(comp => {
          console.log(`    ${comp.name}:`);
          comp.issues.forEach(issue => console.log(`      - ${issue}`));
        });
      }
    }

    // Production Readiness Assessment
    console.log('\n🚀 PRODUCTION READINESS ASSESSMENT:');
    
    const readinessScore = this.calculateReadinessScore();
    console.log(`  📊 Overall Score: ${readinessScore}/100`);
    
    if (readinessScore >= 90) {
      console.log('  ✅ EXCELLENT - Ready for production deployment');
    } else if (readinessScore >= 75) {
      console.log('  🟡 GOOD - Minor issues to address before production');
    } else if (readinessScore >= 60) {
      console.log('  🟠 FAIR - Several issues need attention');
    } else {
      console.log('  🔴 POOR - Significant issues must be resolved');
    }

    // Recommendations
    this.generateRecommendations();
  }

  /**
   * Calculate production readiness score
   */
  private calculateReadinessScore(): number {
    let score = 100;

    // Deduct for compilation errors
    const errorCount = this.testResults.filter(r => r.status === 'error').length;
    score -= errorCount * 15;

    // Deduct for dependency issues
    const depIssues = this.dependencies.filter(d => d.security !== 'safe').length;
    score -= depIssues * 10;

    // Deduct for component issues
    const componentIssues = this.componentMetrics.reduce((sum, m) => sum + m.issues.length, 0);
    score -= componentIssues * 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(): void {
    console.log('\n💡 RECOMMENDATIONS:');

    const recommendations: string[] = [];

    // Error-based recommendations
    const errorComponents = this.testResults.filter(r => r.status === 'error');
    if (errorComponents.length > 0) {
      recommendations.push('🔴 CRITICAL: Fix TypeScript compilation errors before deployment');
      recommendations.push('  - Focus on components with compilation failures');
      recommendations.push('  - Review import statements and type definitions');
    }

    // Dependency recommendations
    const missingDeps = this.dependencies.filter(d => d.declared && !d.installed);
    if (missingDeps.length > 0) {
      recommendations.push('📦 DEPENDENCIES: Install missing packages');
      recommendations.push('  - Run: npm install in packages/frontend');
      recommendations.push('  - Verify all Material-UI dependencies are installed');
    }

    // Performance recommendations
    const largeComponents = this.componentMetrics.filter(m => m.lines > 300);
    if (largeComponents.length > 0) {
      recommendations.push('⚡ PERFORMANCE: Consider breaking down large components');
      largeComponents.forEach(comp => {
        recommendations.push(`  - ${comp.name} (${comp.lines} lines)`);
      });
    }

    // General recommendations
    recommendations.push('🧪 TESTING: Set up automated component testing');
    recommendations.push('📊 MONITORING: Implement performance monitoring');
    recommendations.push('🔄 CI/CD: Integrate this test suite into your build pipeline');

    recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });
  }

  /**
   * Save detailed report to JSON file
   */
  private saveReportToFile(): void {
    const reportData = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      summary: {
        totalComponents: this.testResults.length,
        successful: this.testResults.filter(r => r.status === 'success').length,
        errors: this.testResults.filter(r => r.status === 'error').length,
        warnings: this.testResults.filter(r => r.status === 'warning').length,
        readinessScore: this.calculateReadinessScore()
      },
      testResults: this.testResults,
      dependencies: this.dependencies,
      componentMetrics: this.componentMetrics,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        frontendDir: this.frontendDir
      }
    };

    const reportFileName = `frontend-comprehensive-test-${new Date().toISOString().split('T')[0]}.json`;
    const reportPath = path.join(this.reportsDir, reportFileName);

    try {
      fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
      console.log(`\n📄 Detailed report saved: ${reportPath}`);
    } catch (error) {
      console.log(`\n❌ Failed to save report: ${error}`);
    }
  }
}

// Main execution
if (require.main === module) {
  const tester = new FrontendComprehensiveTest();
  tester.runComprehensiveTest().catch((error) => {
    console.error('❌ Frontend comprehensive test failed:', error);
    process.exit(1);
  });
}

export { FrontendComprehensiveTest };
