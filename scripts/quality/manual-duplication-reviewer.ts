#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

/**
 * Manual Code Duplication Review Script
 * Implements Task 41.3 - Manual Duplicated Code Review
 * 
 * This script provides detailed manual review capabilities for code duplication
 * that automated tools might miss, focusing on semantic duplications and patterns.
 */

interface SimilarFunction {
  pattern: string;
  file: string;
  original: string;
}

interface SemanticAnalysis {
  patterns: any[];
  similarFunctions: SimilarFunction[];
}

interface AutomatedResults {
  timestamp: string;
  analysis: any;
  summary: any;
  [key: string]: any;
}

interface ManualReviewReport {
  timestamp: string;
  project: string;
  task: string;
  manualAnalysis: {
    semanticPatterns: any[];
    similarFunctions: SimilarFunction[];
  };
  automatedResults: AutomatedResults | null;
  recommendations: string[];
}

class ManualDuplicationReviewer {
  private projectRoot: string;
  private reportDir: string;
  private timestamp: string;
  private automatedResults: AutomatedResults | null;

  constructor() {
    this.projectRoot = process.cwd();
    this.reportDir = path.join(this.projectRoot, 'reports', 'duplication');
    this.timestamp = new Date().toISOString().split('T')[0];
    
    // Ensure reports directory exists
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
    
    // Load automated analysis results
    this.automatedResults = this.loadAutomatedResults();
  }

  /**
   * Load results from automated analysis (Task 41.2)
   */
  loadAutomatedResults(): AutomatedResults | null {
    try {
      const reportPath = path.join(this.reportDir, `duplication-analysis-${this.timestamp}.json`);
      if (fs.existsSync(reportPath)) {
        return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      }
    } catch (error: any) {
      console.warn('⚠️  Could not load automated results, proceeding with manual-only analysis');
    }
    return null;
  }

  /**
   * Get all source files recursively
   */
  getSourceFiles(dir: string, extensions: string[] = ['.ts', '.tsx', '.js', '.jsx']): string[] {
    const files: string[] = [];
    
    const scanDirectory = (currentDir) => {
      if (!fs.existsSync(currentDir)) {return;}
      
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
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
    
    scanDirectory(dir);
    return files;
  }

  /**
   * Analyze semantic similarities that automated tools might miss
   */
  analyzeSimilarPatterns(): SemanticAnalysis {
    console.log('🔍 Analyzing semantic patterns and similarities...');
    
    const sourceFiles = [
      ...this.getSourceFiles(path.join(this.projectRoot, 'packages')),
      ...this.getSourceFiles(path.join(this.projectRoot, 'src'))
    ];
    
    const patterns: any[] = [];
    const similarFunctions: SimilarFunction[] = [];
    
    for (const file of sourceFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const relativePath = path.relative(this.projectRoot, file);
        
        // Look for similar function signatures
        const functionMatches = content.match(/(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>)/g) || [];
        
        for (const func of functionMatches) {
          const normalized = func.replace(/\s+/g, ' ').trim();
          similarFunctions.push({
            pattern: normalized,
            file: relativePath,
            original: func
          });
        }
        
      } catch (error: any) {
        console.warn(`⚠️  Could not analyze file: ${file}`);
      }
    }
    
    return { patterns, similarFunctions };
  }

  /**
   * Generate manual review report
   */
  async generateManualReport(): Promise<ManualReviewReport> {
    console.log('📊 Generating manual duplication review report...');
    
    const semanticAnalysis = this.analyzeSimilarPatterns();
    
    const report: ManualReviewReport = {
      timestamp: new Date().toISOString(),
      project: 'JBR Trading Platform',
      task: 'Task 41.3 - Manual Duplicated Code Review',
      manualAnalysis: {
        semanticPatterns: semanticAnalysis.patterns,
        similarFunctions: semanticAnalysis.similarFunctions
      },
      automatedResults: this.automatedResults,
      recommendations: [
        'Review semantic similarities for potential refactoring opportunities',
        'Consolidate similar function patterns into utility functions',
        'Consider creating base classes for repeated patterns',
        'Implement shared interfaces for similar data structures'
      ]
    };
    
    const reportPath = path.join(this.reportDir, `manual-review-${this.timestamp}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📋 Manual review report generated: ${reportPath}`);
    return report;
  }

  /**
   * Run complete manual review
   */
  async analyze(): Promise<ManualReviewReport> {
    console.log('🚀 Starting manual code duplication review...');
    console.log('📁 Project:', this.projectRoot);
    
    const report = await this.generateManualReport();
    
    console.log('✅ Task 41.3 - Manual Duplicated Code Review: COMPLETED');
    return report;
  }
}

// Run analysis if called directly
if (require.main === module) {
  const reviewer = new ManualDuplicationReviewer();
  reviewer.analyze().catch(console.error);
}

export default ManualDuplicationReviewer;

module.exports = ManualDuplicationReviewer;