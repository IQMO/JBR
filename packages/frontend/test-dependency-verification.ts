/**
 * Dependency Verification Test
 * Verifies Material-UI installation and creates isolated component tests
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

class DependencyVerifier {
  private readonly frontendDir: string;

  constructor() {
    this.frontendDir = __dirname; // Current directory is already packages/frontend
  }

  public async runVerification(): Promise<void> {
    console.log('🔍 Dependency Verification Test\n');

    await this.checkActualInstallation();
    await this.createIsolatedComponentTest();
    await this.testWebSocketHookIsolated();
  }

  /**
   * Check if dependencies are actually installed
   */
  private async checkActualInstallation(): Promise<void> {
    console.log('📦 Checking actual Material-UI installation...\n');

    const nodeModulesPath = path.join(this.frontendDir, 'node_modules');
    
    const requiredPackages = [
      '@mui/material',
      '@mui/icons-material', 
      '@emotion/react',
      '@emotion/styled'
    ];

    requiredPackages.forEach(pkg => {
      const pkgPath = path.join(nodeModulesPath, pkg.replace('/', path.sep));
      const exists = fs.existsSync(pkgPath);
      
      console.log(`${pkg}: ${exists ? '✅' : '❌'}`);
      
      if (exists) {
        try {
          const packageJsonPath = path.join(pkgPath, 'package.json');
          if (fs.existsSync(packageJsonPath)) {
            const pkgInfo = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            console.log(`  Version: ${pkgInfo.version}`);
          }
        } catch (error) {
          console.log(`  Version check failed: ${error}`);
        }
      }
    });
  }

  /**
   * Create minimal isolated component test
   */
  private async createIsolatedComponentTest(): Promise<void> {
    console.log('\n🧪 Creating isolated component test...\n');

    const testComponentContent = `import React from 'react';
import { 
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  Button
} from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';

// Minimal test component using our required Material-UI elements
const TestLogViewerCore: React.FC = () => {
  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1}>
          <InfoIcon color="primary" />
          <Typography variant="h6">
            Log Viewer Test Component
          </Typography>
        </Box>
        
        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid item xs={12} md={6}>
            <Typography variant="body2">
              Testing Grid v5 syntax with item prop
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Button variant="outlined" fullWidth>
              Test Button
            </Button>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default TestLogViewerCore;`;

    const testFilePath = path.join(this.frontendDir, 'test-component.tsx');
    
    try {
      fs.writeFileSync(testFilePath, testComponentContent);
      console.log('✅ Test component created');

      // Try to compile it
      const command = `cd "${this.frontendDir}" && npx tsc --noEmit --skipLibCheck --jsx react-jsx test-component.tsx`;
      
      try {
        execSync(command, { stdio: 'pipe', encoding: 'utf8' });
        console.log('✅ Isolated component compiles successfully');
      } catch (error: any) {
        console.log('❌ Compilation errors in isolated component:');
        const errorOutput = error.stdout || error.stderr || '';
        const errors = errorOutput.split('\n').filter((line: string) => 
          line.includes('error TS')
        ).slice(0, 3);
        
        errors.forEach((err: string) => console.log(`  ${err.trim()}`));
      }

    } catch (error) {
      console.log('❌ Failed to create test component:', error);
    } finally {
      // Clean up
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  }

  /**
   * Test WebSocket hook in isolation
   */
  private async testWebSocketHookIsolated(): Promise<void> {
    console.log('\n🔌 Testing WebSocket hook in isolation...\n');

    try {
      const command = `cd "${this.frontendDir}" && npx tsc --noEmit --skipLibCheck --jsx react-jsx src/hooks/useWebSocket.ts`;
      execSync(command, { stdio: 'pipe', encoding: 'utf8' });
      console.log('✅ WebSocket hook compiles successfully');
      console.log('✅ Our TypeScript implementation is solid');
    } catch (error: any) {
      console.log('❌ WebSocket hook compilation errors:');
      const errorOutput = error.stdout || error.stderr || '';
      console.log(errorOutput.split('\n').slice(0, 5).join('\n'));
    }
  }
}

// Run the verification
const verifier = new DependencyVerifier();
verifier.runVerification().catch(console.error);
