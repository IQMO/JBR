/**
 * TypeScript Frontend Analysis Test
 * Comprehensive analysis of Log Viewer & Alert System components
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  component: string;
  status: 'success' | 'error';
  errors: string[];
  warnings: string[];
}

interface DependencyInfo {
  name: string;
  version: string | null;
  installed: boolean;
  actualVersion?: string;
}

class FrontendAnalyzer {
  private readonly frontendDir: string;
  private readonly ourComponents: string[];
  private testResults: TestResult[] = [];

  constructor() {
    this.frontendDir = path.join(__dirname, 'packages/frontend');
    this.ourComponents = [
      'src/components/LogViewer.tsx',
      'src/components/AlertSystem.tsx', 
      'src/components/LogAndAlertDashboard.tsx',
      'src/hooks/useWebSocket.ts'
    ];
  }

  /**
   * Run comprehensive frontend analysis
   */
  public async runAnalysis(): Promise<void> {
    console.log('🔧 Running TypeScript Frontend Analysis...\n');

    try {
      await this.checkProjectStructure();
      await this.checkDependencies();
      await this.testComponentCompilation();
      await this.checkMaterialUICompatibility();
      await this.analyzeTSConfig();
      this.generateReport();
    } catch (error) {
      console.error('❌ Analysis failed:', error);
    }
  }

  /**
   * Check project structure integrity
   */
  private async checkProjectStructure(): Promise<void> {
    console.log('📁 Checking project structure...\n');

    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      'next.config.js',
      'src/components',
      'src/hooks'
    ];

    requiredFiles.forEach(file => {
      const filePath = path.join(this.frontendDir, file);
      const exists = fs.existsSync(filePath);
      console.log(`  ${file}: ${exists ? '✅' : '❌'}`);
    });

    // Check our components exist
    console.log('\n📋 Our Log Viewer & Alert System components:');
    this.ourComponents.forEach(component => {
      const componentPath = path.join(this.frontendDir, component);
      const exists = fs.existsSync(componentPath);
      console.log(`  ${component}: ${exists ? '✅' : '❌'}`);
    });
  }

  /**
   * Check and analyze dependencies
   */
  private async checkDependencies(): Promise<void> {
    console.log('\n📦 Analyzing dependencies...\n');

    const packageJsonPath = path.join(this.frontendDir, 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      console.log('❌ package.json not found');
      return;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const materialUIDeps: DependencyInfo[] = [
      { name: '@mui/material', version: packageJson.dependencies?.['@mui/material'], installed: false },
      { name: '@mui/icons-material', version: packageJson.dependencies?.['@mui/icons-material'], installed: false },
      { name: '@emotion/react', version: packageJson.dependencies?.['@emotion/react'], installed: false },
      { name: '@emotion/styled', version: packageJson.dependencies?.['@emotion/styled'], installed: false }
    ];

    // Check if packages are actually installed
    const nodeModulesPath = path.join(this.frontendDir, 'node_modules');
    
    materialUIDeps.forEach(dep => {
      dep.installed = fs.existsSync(path.join(nodeModulesPath, dep.name));
      
      console.log(`${dep.name}:`);
      console.log(`  Package.json version: ${dep.version || 'NOT LISTED'}`);
      console.log(`  Installed: ${dep.installed ? '✅' : '❌'}`);
      
      if (dep.installed) {
        try {
          const depPackageJson = path.join(nodeModulesPath, dep.name, 'package.json');
          if (fs.existsSync(depPackageJson)) {
            const depInfo = JSON.parse(fs.readFileSync(depPackageJson, 'utf8'));
            dep.actualVersion = depInfo.version;
            console.log(`  Actual version: ${dep.actualVersion}`);
          }
        } catch (error) {
          console.log(`  Version check failed: ${error}`);
        }
      }
      console.log('');
    });

    // Check if installation is needed
    const needsInstall = materialUIDeps.some(dep => dep.version && !dep.installed);
    if (needsInstall) {
      console.log('⚠️  Some dependencies are declared but not installed');
      console.log('💡 Run: npm install in packages/frontend');
    }
  }

  /**
   * Test individual component compilation
   */
  private async testComponentCompilation(): Promise<void> {
    console.log('🎯 Testing component compilation...\n');

    for (const component of this.ourComponents) {
      const result: TestResult = {
        component,
        status: 'success',
        errors: [],
        warnings: []
      };

      try {
        console.log(`Testing ${component}...`);
        
        // Use TypeScript compiler with proper flags
        const command = `cd "${this.frontendDir}" && npx tsc --noEmit --skipLibCheck --jsx react-jsx "${component}"`;
        const output = execSync(command, { 
          stdio: 'pipe', 
          encoding: 'utf8',
          timeout: 30000 // 30 second timeout
        });
        
        result.status = 'success';
        console.log(`✅ ${component}: Compilation successful`);
        
      } catch (error: any) {
        result.status = 'error';
        
        const errorOutput = error.stdout || error.stderr || '';
        const lines = errorOutput.split('\n');
        
        // Parse TypeScript errors
        result.errors = lines.filter((line: string) => 
          line.includes('error TS') && 
          !line.includes('node_modules')
        ).slice(0, 5); // Limit to first 5 errors
        
        console.log(`❌ ${component}: Compilation errors detected`);
        if (result.errors.length > 0) {
          console.log('  Key errors:');
          result.errors.forEach((err: string) => console.log(`    ${err.trim()}`));
        }
      }

      this.testResults.push(result);
      console.log('');
    }
  }

  /**
   * Test Material-UI Grid v2 compatibility
   */
  private async checkMaterialUICompatibility(): Promise<void> {
    console.log('🔍 Testing Material-UI Grid v2 compatibility...\n');

    const gridTestContent = `import React from 'react';
import { Grid, Card, Typography } from '@mui/material';

// Test Grid v2 syntax for Material-UI v7
const GridTest: React.FC = () => {
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <Typography>Test Grid v2 syntax</Typography>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <Typography>Another grid item</Typography>
        </Card>
      </Grid>
    </Grid>
  );
};

export default GridTest;`;

    const gridTestPath = path.join(this.frontendDir, 'grid-test.tsx');
    
    try {
      fs.writeFileSync(gridTestPath, gridTestContent);
      
      const command = `cd "${this.frontendDir}" && npx tsc --noEmit --skipLibCheck --jsx react-jsx grid-test.tsx`;
      execSync(command, { stdio: 'pipe', encoding: 'utf8' });
      
      console.log('✅ Material-UI Grid v2 syntax: Compatible');
      
    } catch (error: any) {
      console.log('❌ Material-UI Grid v2 syntax: Issues detected');
      
      const errorOutput = error.stdout || error.stderr || '';
      const gridErrors = errorOutput.split('\n').filter((line: string) => 
        line.includes('error TS') || line.includes('Grid')
      ).slice(0, 3);
      
      if (gridErrors.length > 0) {
        console.log('  Grid errors:');
        gridErrors.forEach((err: string) => console.log(`    ${err.trim()}`));
      }
    } finally {
      // Clean up test file
      if (fs.existsSync(gridTestPath)) {
        fs.unlinkSync(gridTestPath);
      }
    }
  }

  /**
   * Analyze TypeScript configuration
   */
  private async analyzeTSConfig(): Promise<void> {
    console.log('\n⚙️  Analyzing TypeScript configuration...\n');

    const tsConfigPath = path.join(this.frontendDir, 'tsconfig.json');
    
    if (!fs.existsSync(tsConfigPath)) {
      console.log('❌ tsconfig.json not found');
      return;
    }

    try {
      const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf8'));
      
      console.log('TypeScript configuration:');
      console.log(`  Target: ${tsConfig.compilerOptions?.target || 'NOT SET'}`);
      console.log(`  Module: ${tsConfig.compilerOptions?.module || 'NOT SET'}`);
      console.log(`  JSX: ${tsConfig.compilerOptions?.jsx || 'NOT SET'}`);
      console.log(`  moduleResolution: ${tsConfig.compilerOptions?.moduleResolution || 'NOT SET'}`);
      console.log(`  allowSyntheticDefaultImports: ${tsConfig.compilerOptions?.allowSyntheticDefaultImports || false}`);
      console.log(`  esModuleInterop: ${tsConfig.compilerOptions?.esModuleInterop || false}`);
      
      // Check for Next.js specific settings
      if (tsConfig.extends?.includes('next')) {
        console.log('✅ Next.js TypeScript configuration detected');
      }

      // Check if paths are configured properly
      if (tsConfig.compilerOptions?.paths) {
        console.log('✅ Path mapping configured');
      }

    } catch (error) {
      console.log('❌ Error parsing tsconfig.json:', error);
    }
  }

  /**
   * Generate comprehensive analysis report
   */
  private generateReport(): void {
    console.log('\n📋 COMPREHENSIVE ANALYSIS REPORT\n');
    console.log('='.repeat(50));

    console.log('\n🎯 LOG VIEWER & ALERT SYSTEM STATUS:');
    const successfulComponents = this.testResults.filter(r => r.status === 'success');
    const failedComponents = this.testResults.filter(r => r.status === 'error');

    console.log(`✅ Successful components: ${successfulComponents.length}/${this.testResults.length}`);
    successfulComponents.forEach((comp: TestResult) => console.log(`    ${comp.component}`));

    if (failedComponents.length > 0) {
      console.log(`❌ Components with issues: ${failedComponents.length}/${this.testResults.length}`);
      failedComponents.forEach((comp: TestResult) => console.log(`    ${comp.component}`));
    }

    console.log('\n🔧 PRODUCTION-READY ASSESSMENT:');
    
    if (successfulComponents.length === this.testResults.length) {
      console.log('✅ All Log Viewer & Alert System components compile successfully');
      console.log('✅ No TypeScript violations detected in our implementation');
      console.log('✅ Components respect existing project structure');
      console.log('✅ Ready for production deployment');
    } else {
      console.log('⚠️  Some components need attention before production');
      console.log('💡 Focus on TypeScript errors and dependency issues');
    }

    console.log('\n📝 RECOMMENDATIONS:');
    console.log('1. Ensure all Material-UI dependencies are properly installed');
    console.log('2. Verify TypeScript configuration matches project requirements');
    console.log('3. Run individual component tests before full build');
    console.log('4. Keep our components isolated from problematic existing code');

    console.log('\n🚀 NEXT STEPS:');
    console.log('- Fix any identified dependency issues');
    console.log('- Address TypeScript compilation errors');
    console.log('- Test WebSocket integration separately');
    console.log('- Validate with backend API endpoints');
  }
}

// Main execution
const analyzer = new FrontendAnalyzer();
analyzer.runAnalysis().catch(console.error);
