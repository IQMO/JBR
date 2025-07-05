/**
 * Comprehensive Frontend Production Readiness Test
 * Tests ALL components, ensures TypeScript compliance, and validates production standards
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface ComponentTestResult {
  component: string;
  compiles: boolean;
  errors: string[];
  warnings: string[];
  productionIssues: string[];
}

interface ProjectAnalysis {
  totalComponents: number;
  passingComponents: number;
  failingComponents: number;
  javascriptFiles: string[];
  productionViolations: string[];
  typeScriptCompliance: boolean;
}

class FrontendProductionReadinessValidator {
  private readonly frontendDir: string;
  private readonly srcDir: string;
  private results: ComponentTestResult[] = [];

  constructor() {
    this.frontendDir = __dirname;
    this.srcDir = path.join(this.frontendDir, 'src');
  }

  public async runFullValidation(): Promise<void> {
    console.log('🚀 Frontend Production Readiness Validation\n');
    console.log('====================================\n');

    // Step 1: Scan for JavaScript files (should be ZERO)
    await this.scanForJavaScriptFiles();

    // Step 2: Validate ALL TypeScript/TSX components
    await this.validateAllComponents();

    // Step 3: Check production-ready patterns
    await this.validateProductionPatterns();

    // Step 4: Test Material-UI integration
    await this.validateMaterialUIIntegration();

    // Step 5: Validate root configuration compliance
    await this.validateRootConfigCompliance();

    // Step 6: Generate final report
    await this.generateProductionReport();
  }

  /**
   * Scan for any JavaScript files that should be TypeScript
   */
  private async scanForJavaScriptFiles(): Promise<void> {
    console.log('🔍 Scanning for JavaScript files (should be ZERO)...\n');

    const javascriptFiles: string[] = [];

    const scanDirectory = (dir: string): void => {
      const entries = fs.readdirSync(dir);
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
          scanDirectory(fullPath);
        } else if (stat.isFile() && (entry.endsWith('.js') || entry.endsWith('.jsx'))) {
          // Check if it's a legitimate build file or should be TypeScript
          if (!fullPath.includes('node_modules') && 
              !fullPath.includes('.next') && 
              !fullPath.includes('dist') &&
              !fullPath.includes('build')) {
            javascriptFiles.push(fullPath.replace(this.frontendDir + path.sep, ''));
          }
        }
      }
    };

    scanDirectory(this.frontendDir);

    if (javascriptFiles.length === 0) {
      console.log('✅ No JavaScript files found - Pure TypeScript project confirmed\n');
    } else {
      console.log('❌ JavaScript files found that should be TypeScript:');
      javascriptFiles.forEach((file: string) => console.log(`  ${file}`));
      console.log('\n');
    }
  }

  /**
   * Validate ALL TypeScript/TSX components
   */
  private async validateAllComponents(): Promise<void> {
    console.log('📋 Validating ALL TypeScript/TSX components...\n');

    const componentFiles: string[] = [];

    const findComponents = (dir: string): void => {
      const entries = fs.readdirSync(dir);
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !entry.startsWith('.')) {
          findComponents(fullPath);
        } else if (stat.isFile() && (entry.endsWith('.ts') || entry.endsWith('.tsx'))) {
          componentFiles.push(fullPath);
        }
      }
    };

    findComponents(this.srcDir);

    console.log(`Found ${componentFiles.length} TypeScript files to validate\n`);

    for (const componentFile of componentFiles) {
      await this.validateSingleComponent(componentFile);
    }
  }

  /**
   * Validate a single component
   */
  private async validateSingleComponent(filePath: string): Promise<void> {
    const relativePath = path.relative(this.frontendDir, filePath);
    const result: ComponentTestResult = {
      component: relativePath,
      compiles: false,
      errors: [],
      warnings: [],
      productionIssues: []
    };

    console.log(`Testing: ${relativePath}`);

    try {
      // TypeScript compilation test
      const command = `npx tsc --noEmit --skipLibCheck --jsx react-jsx "${filePath}"`;
      execSync(command, { 
        stdio: 'pipe', 
        encoding: 'utf8',
        cwd: this.frontendDir 
      });
      
      result.compiles = true;
      console.log(`✅ ${relativePath}: Compiles successfully`);

      // Content analysis for production readiness
      const content = fs.readFileSync(filePath, 'utf8');
      this.analyzeContentForProductionIssues(content, result);

    } catch (error: any) {
      result.compiles = false;
      const errorOutput = error.stdout || error.stderr || '';
      
      // Parse TypeScript errors
      const lines = errorOutput.split('\n');
      const tsErrors = lines.filter((line: string) => line.includes('error TS'));
      
      result.errors = tsErrors.slice(0, 5); // Limit to first 5 errors
      
      console.log(`❌ ${relativePath}: Compilation errors`);
      if (tsErrors.length > 0) {
        console.log(`  ${tsErrors[0]}`);
        if (tsErrors.length > 1) {
          console.log(`  ... and ${tsErrors.length - 1} more errors`);
        }
      }
    }

    this.results.push(result);
  }

  /**
   * Analyze content for production readiness issues
   */
  private analyzeContentForProductionIssues(content: string, result: ComponentTestResult): void {
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmedLine = line.trim();

      // Check for console statements (should use proper logging)
      if (trimmedLine.includes('console.log') || 
          trimmedLine.includes('console.error') || 
          trimmedLine.includes('console.warn')) {
        result.productionIssues.push(`Line ${lineNumber}: Console statement found - should use proper logging`);
      }

      // Check for TODO/FIXME comments
      if (trimmedLine.includes('TODO') || trimmedLine.includes('FIXME')) {
        result.productionIssues.push(`Line ${lineNumber}: TODO/FIXME comment found`);
      }

      // Check for hardcoded values that should be environment variables
      if (trimmedLine.includes('localhost') && !trimmedLine.includes('process.env')) {
        result.productionIssues.push(`Line ${lineNumber}: Hardcoded localhost - should use environment variable`);
      }

      // Check for debug code
      if (trimmedLine.includes('debugger;')) {
        result.productionIssues.push(`Line ${lineNumber}: Debugger statement found`);
      }

      // Check for any/unknown types (TypeScript best practices)
      if (trimmedLine.includes(': any') && !trimmedLine.includes('// eslint-disable')) {
        result.warnings.push(`Line ${lineNumber}: 'any' type used - consider more specific typing`);
      }
    });
  }

  /**
   * Validate production patterns across the codebase
   */
  private async validateProductionPatterns(): Promise<void> {
    console.log('\n🏭 Validating production patterns...\n');

    // Check if error boundaries exist
    const errorBoundaryExists = fs.existsSync(path.join(this.srcDir, 'components', 'ErrorBoundary.tsx'));
    console.log(`Error Boundary: ${errorBoundaryExists ? '✅' : '❌'}`);

    // Check if loading components exist
    const loadingExists = fs.existsSync(path.join(this.srcDir, 'components', 'Loading.tsx'));
    console.log(`Loading Component: ${loadingExists ? '✅' : '❌'}`);

    // Check if environment configuration is proper
    const envConfigExists = fs.existsSync(path.join(this.frontendDir, '.env.local')) ||
                           fs.existsSync(path.join(this.frontendDir, '.env'));
    console.log(`Environment Config: ${envConfigExists ? '✅' : '❌'}`);

    // Check Next.js configuration
    const nextConfigExists = fs.existsSync(path.join(this.frontendDir, 'next.config.js')) ||
                             fs.existsSync(path.join(this.frontendDir, 'next.config.mjs')) ||
                             fs.existsSync(path.join(this.frontendDir, 'next.config.ts'));
    console.log(`Next.js Config: ${nextConfigExists ? '✅' : '❌'}`);

    // Check TypeScript configuration
    const tsConfigExists = fs.existsSync(path.join(this.frontendDir, 'tsconfig.json'));
    console.log(`TypeScript Config: ${tsConfigExists ? '✅' : '❌'}`);

    console.log('');
  }

  /**
   * Validate Material-UI integration
   */
  private async validateMaterialUIIntegration(): Promise<void> {
    console.log('🎨 Validating Material-UI integration...\n');

    // Check if Material-UI is properly installed
    const nodeModulesPath = path.join(this.frontendDir, 'node_modules');
    const muiPackages = ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'];

    muiPackages.forEach((pkg: string) => {
      const pkgPath = path.join(nodeModulesPath, pkg.replace('/', path.sep));
      const exists = fs.existsSync(pkgPath);
      console.log(`${pkg}: ${exists ? '✅' : '❌'}`);
    });

    // Test Material-UI Grid v5 syntax compatibility
    const testGridContent = `import React from 'react';
import { Grid, Card, Typography } from '@mui/material';

const GridTest: React.FC = () => (
  <Grid container spacing={2}>
    <Grid item xs={12} md={6}>
      <Card>
        <Typography>Test Grid v5 syntax</Typography>
      </Card>
    </Grid>
  </Grid>
);

export default GridTest;`;

    const testPath = path.join(this.frontendDir, 'mui-grid-test.tsx');
    
    try {
      fs.writeFileSync(testPath, testGridContent);
      
      const command = `npx tsc --noEmit --skipLibCheck --jsx react-jsx mui-grid-test.tsx`;
      execSync(command, { 
        stdio: 'pipe', 
        encoding: 'utf8',
        cwd: this.frontendDir 
      });
      
      console.log('Material-UI Grid Syntax: ✅');
    } catch (error) {
      console.log('Material-UI Grid Syntax: ❌');
    } finally {
      if (fs.existsSync(testPath)) {
        fs.unlinkSync(testPath);
      }
    }

    console.log('');
  }

  /**
   * Validate compliance with root-level configurations
   */
  private async validateRootConfigCompliance(): Promise<void> {
    console.log('📁 Validating root configuration compliance...\n');

    const rootDir = path.join(this.frontendDir, '..', '..');

    // Check root TypeScript config
    const rootTsConfig = path.join(rootDir, 'tsconfig.json');
    console.log(`Root tsconfig.json: ${fs.existsSync(rootTsConfig) ? '✅' : '❌'}`);

    // Check root package.json
    const rootPackageJson = path.join(rootDir, 'package.json');
    if (fs.existsSync(rootPackageJson)) {
      console.log('Root package.json: ✅');
      
      const rootPkg = JSON.parse(fs.readFileSync(rootPackageJson, 'utf8'));
      
      // Check if it's properly configured as TypeScript project
      if (rootPkg.devDependencies?.typescript) {
        console.log('Root TypeScript dependency: ✅');
      } else {
        console.log('Root TypeScript dependency: ❌');
      }
    } else {
      console.log('Root package.json: ❌');
    }

    // Check workspace configuration
    const frontendPkgJson = path.join(this.frontendDir, 'package.json');
    if (fs.existsSync(frontendPkgJson)) {
      const frontendPkg = JSON.parse(fs.readFileSync(frontendPkgJson, 'utf8'));
      
      console.log(`Frontend package name: ${frontendPkg.name || 'undefined'}`);
      console.log(`Frontend is private: ${frontendPkg.private ? '✅' : '❌'}`);
      
      // Check TypeScript scripts
      const hasTypeScriptScripts = frontendPkg.scripts?.build?.includes('tsc') || 
                                  frontendPkg.scripts?.['type-check'];
      console.log(`TypeScript build scripts: ${hasTypeScriptScripts ? '✅' : '❌'}`);
    }

    console.log('');
  }

  /**
   * Generate comprehensive production report
   */
  private async generateProductionReport(): Promise<void> {
    console.log('📊 Production Readiness Report\n');
    console.log('================================\n');

    const analysis: ProjectAnalysis = {
      totalComponents: this.results.length,
      passingComponents: this.results.filter(r => r.compiles).length,
      failingComponents: this.results.filter(r => !r.compiles).length,
      javascriptFiles: [],
      productionViolations: [],
      typeScriptCompliance: true
    };

    // Collect all production violations
    this.results.forEach((result: ComponentTestResult) => {
      analysis.productionViolations.push(...result.productionIssues);
    });

    console.log(`📈 Component Compilation:`);
    console.log(`  Total Components: ${analysis.totalComponents}`);
    console.log(`  Passing: ${analysis.passingComponents} ✅`);
    console.log(`  Failing: ${analysis.failingComponents} ${analysis.failingComponents === 0 ? '✅' : '❌'}`);
    console.log(`  Success Rate: ${((analysis.passingComponents / analysis.totalComponents) * 100).toFixed(1)}%`);

    console.log(`\n🔧 Production Issues Found: ${analysis.productionViolations.length}`);
    if (analysis.productionViolations.length > 0) {
      console.log('\nTop Production Issues:');
      analysis.productionViolations.slice(0, 10).forEach((issue: string) => {
        console.log(`  ⚠️  ${issue}`);
      });
      if (analysis.productionViolations.length > 10) {
        console.log(`  ... and ${analysis.productionViolations.length - 10} more issues`);
      }
    }

    // Show failing components
    const failingComponents = this.results.filter(r => !r.compiles);
    if (failingComponents.length > 0) {
      console.log(`\n❌ Components with compilation errors:`);
      failingComponents.forEach((comp: ComponentTestResult) => {
        console.log(`  ${comp.component}`);
        if (comp.errors.length > 0) {
          console.log(`    ${comp.errors[0]}`);
        }
      });
    }

    // Overall production readiness score
    const productionScore = (analysis.passingComponents / analysis.totalComponents) * 100;
    console.log(`\n🎯 Production Readiness Score: ${productionScore.toFixed(1)}%`);
    
    if (productionScore >= 95) {
      console.log('🚀 EXCELLENT - Ready for production deployment!');
    } else if (productionScore >= 85) {
      console.log('✅ GOOD - Minor issues to address before production');
    } else if (productionScore >= 70) {
      console.log('⚠️  NEEDS WORK - Several issues need fixing');
    } else {
      console.log('❌ NOT READY - Significant issues need resolution');
    }

    console.log('\n================================\n');
  }
}

// Execute the validation
const validator = new FrontendProductionReadinessValidator();
validator.runFullValidation().catch(console.error);
