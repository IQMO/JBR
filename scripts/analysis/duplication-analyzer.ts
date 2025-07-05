#!/usr/bin/env node

import { execSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Advanced Code Duplication Detection Script
 * Implements Task 41.2 - Automated Duplicated Code Detection
 */

interface DuplicateFile {
  type: 'exact_duplicate';
  files: string[];
  hash: string;
  size: number;
}

interface CodeBlock {
  type: 'function' | 'class' | 'interface';
  content: string;
  file: string;
  index: number;
  hash: string;
}

interface DuplicateCodeBlock {
  type: 'code_block_duplicate';
  hash: string;
  blockType: string;
  count: number;
  instances: Array<{ file: string; index: number }>;
  content: string;
}

interface JSCPDResult {
  report?: string;
  hasIssues?: boolean;
}

interface DuplicationAnalysisResult {
  exactFileDuplicates: {
    count: number;
    instances: DuplicateFile[];
  };
  codeBlockDuplicates: {
    count: number;
    instances: DuplicateCodeBlock[];
  };
  jscpd: JSCPDResult;
}

interface DuplicationReport {
  timestamp: string;
  project: string;
  task: string;
  analysis: DuplicationAnalysisResult;
  summary: {
    totalIssues: number;
    severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
    recommendations: string[];
  };
  toolsUsed: string[];
}

class DuplicationAnalyzer {
  private projectRoot: string;
  private reportDir: string;
  private timestamp: string;

  constructor() {
    this.projectRoot = process.cwd();
    this.reportDir = path.join(this.projectRoot, 'reports', 'duplication');
    this.timestamp = new Date().toISOString().split('T')[0];
    
    // Ensure reports directory exists
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
  }

  /**
   * Get all TypeScript and JavaScript files recursively
   */
  getSourceFiles(dir: string, extensions: string[] = ['.ts', '.tsx', '.js', '.jsx']): string[] {
    const files: string[] = [];
    
    const scanDirectory = (currentDir: string) => {
      if (!fs.existsSync(currentDir)) {return;}
      
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
    
    scanDirectory(dir);
    return files;
  }

  /**
   * Calculate file hash for comparison with better normalization
   */
  calculateFileHash(filePath: string): string | null {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Skip empty or near-empty files
      if (content.trim().length < 50) {
        return null;
      }
      
      // More conservative normalization that preserves meaningful structure
      const normalized = content
        // Normalize line endings
        .replace(/\r\n/g, '\n')
        // Normalize consecutive whitespace within lines but preserve line structure
        .replace(/[ \t]+/g, ' ')
        // Remove empty lines but preserve line structure
        .replace(/\n\s*\n/g, '\n')
        // Remove only single-line comments (preserve block comments as they may contain license info)
        .replace(/\/\/.*$/gm, '')
        // Trim each line
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n')
        .trim();
      
      // Don't hash if normalization resulted in very short content
      if (normalized.length < 100) {
        return null;
      }
      
      return crypto.createHash('md5').update(normalized).digest('hex');
    } catch (error: any) {
      return null;
    }
  }

  /**
   * Find exact file duplicates with proper grouping
   */
  findExactDuplicates(): DuplicateFile[] {
    console.log('🔍 Scanning for exact file duplicates...');
    
    const sourceFiles = [
      ...this.getSourceFiles(path.join(this.projectRoot, 'packages')),
      ...this.getSourceFiles(path.join(this.projectRoot, 'src'))
    ];
    
    // Group files by hash
    const hashGroups = new Map<string, string[]>();
    const duplicates: DuplicateFile[] = [];
    
    for (const file of sourceFiles) {
      const hash = this.calculateFileHash(file);
      if (!hash) { continue; }
      
      if (!hashGroups.has(hash)) {
        hashGroups.set(hash, []);
      }
      hashGroups.get(hash)!.push(file);
    }
    
    // Find groups with more than one file (actual duplicates)
    for (const [hash, files] of Array.from(hashGroups.entries())) {
      if (files.length > 1) {
        // Create one duplicate entry for each group
        duplicates.push({
          type: 'exact_duplicate',
          files: files,
          hash,
          size: fs.statSync(files[0]).size
        });
      }
    }
    
    console.log(`📋 Found ${duplicates.length} groups of exact file duplicates`);
    return duplicates;
  }

  /**
   * Analyze code blocks for duplication patterns with improved accuracy
   */
  analyzeCodeBlocks(): DuplicateCodeBlock[] {
    console.log('🔍 Analyzing code block patterns...');
    
    const sourceFiles = [
      ...this.getSourceFiles(path.join(this.projectRoot, 'packages')),
      ...this.getSourceFiles(path.join(this.projectRoot, 'src'))
    ];
    
    // More precise patterns that capture meaningful blocks
    const functionPattern = /(?:export\s+)?(?:async\s+)?(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>)\s*{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*}/g;
    const classPattern = /(?:export\s+)?(?:abstract\s+)?class\s+\w+(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*}/g;
    const interfacePattern = /(?:export\s+)?interface\s+\w+(?:\s+extends\s+[\w,\s]+)?\s*{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*}/g;
    
    const codeBlocks: CodeBlock[] = [];
    const duplicateBlocks: DuplicateCodeBlock[] = [];
    
    for (const file of sourceFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const relativePath = path.relative(this.projectRoot, file);
        
        // Extract functions
        const functions = content.match(functionPattern) || [];
        functions.forEach((func, index) => {
          // Better normalization that preserves semantic structure
          const normalized = func
            .replace(/\/\/.*$/gm, '') // Remove single-line comments
            .replace(/\s+/g, ' ')
            .replace(/\s*([{}();,])\s*/g, '$1') // Normalize around punctuation
            .trim();
            
          // Only consider substantial functions with meaningful content
          if (normalized.length > 150 && normalized.includes('{') && normalized.includes('}')) {
            codeBlocks.push({
              type: 'function',
              content: normalized,
              file: relativePath,
              index,
              hash: crypto.createHash('md5').update(normalized).digest('hex')
            });
          }
        });
        
        // Extract classes
        const classes = content.match(classPattern) || [];
        classes.forEach((cls, index) => {
          const normalized = cls
            .replace(/\/\/.*$/gm, '')
            .replace(/\s+/g, ' ')
            .replace(/\s*([{}();,])\s*/g, '$1')
            .trim();
            
          if (normalized.length > 200) {
            codeBlocks.push({
              type: 'class',
              content: normalized,
              file: relativePath,
              index,
              hash: crypto.createHash('md5').update(normalized).digest('hex')
            });
          }
        });
        
        // Extract interfaces
        const interfaces = content.match(interfacePattern) || [];
        interfaces.forEach((iface, index) => {
          const normalized = iface
            .replace(/\/\/.*$/gm, '')
            .replace(/\s+/g, ' ')
            .replace(/\s*([{}();,:])\s*/g, '$1')
            .trim();
            
          if (normalized.length > 100) {
            codeBlocks.push({
              type: 'interface',
              content: normalized,
              file: relativePath,
              index,
              hash: crypto.createHash('md5').update(normalized).digest('hex')
            });
          }
        });
        
      } catch (error) {
        console.warn(`⚠️  Could not analyze file: ${file}`);
      }
    }
    
    // Find duplicates by hash - proper grouping
    const hashGroups = new Map<string, CodeBlock[]>();
    for (const block of codeBlocks) {
      if (!hashGroups.has(block.hash)) {
        hashGroups.set(block.hash, []);
      }
      hashGroups.get(block.hash)!.push(block);
    }
    
    for (const [hash, blocks] of Array.from(hashGroups.entries())) {
      if (blocks.length > 1) {
        // Verify these are actually in different files (not just different indexes in same file)
        const uniqueFiles = new Set(blocks.map(b => b.file));
        if (uniqueFiles.size > 1) {
          duplicateBlocks.push({
            type: 'code_block_duplicate',
            hash,
            blockType: blocks[0].type,
            count: blocks.length,
            instances: blocks.map(b => ({ file: b.file, index: b.index })),
            content: `${blocks[0].content.substring(0, 200)}...`
          });
        }
      }
    }
    
    console.log(`📋 Found ${duplicateBlocks.length} code block duplications`);
    return duplicateBlocks;
  }

  /**
   * Run JSCPD with fallback analysis
   */
  runJSCPDAnalysis(): JSCPDResult {
    console.log('🔍 Running JSCPD analysis...');
    
    try {
      const outputPath = path.join(this.reportDir, `jscpd-${this.timestamp}.json`);
      execSync(`npx jscpd packages/ --threshold 10 --min-lines 3 --min-tokens 30 --output "${outputPath}" --format json`, {
        stdio: 'pipe'
      });
      
      if (fs.existsSync(outputPath)) {
        console.log('✅ JSCPD analysis completed');
        return { report: outputPath };
      }
    } catch (error: any) {
      console.log('⚠️  JSCPD analysis completed with findings or issues');
    }
    
    return { hasIssues: true };
  }

  /**
   * Generate comprehensive duplication report
   */
  async generateDuplicationReport(): Promise<DuplicationReport> {
    console.log('📊 Generating comprehensive duplication report...');
    
    const exactDuplicates = this.findExactDuplicates();
    const codeBlockDuplicates = this.analyzeCodeBlocks();
    const jscpdResults = this.runJSCPDAnalysis();
    
    const report = {
      timestamp: new Date().toISOString(),
      project: 'JBR Trading Platform',
      task: 'Task 41.2 - Automated Duplicated Code Detection',
      analysis: {
        exactFileDuplicates: {
          count: exactDuplicates.length,
          instances: exactDuplicates
        },
        codeBlockDuplicates: {
          count: codeBlockDuplicates.length,
          instances: codeBlockDuplicates
        },
        jscpd: jscpdResults
      },
      summary: {
        totalIssues: exactDuplicates.length + codeBlockDuplicates.length,
        severity: this.calculateSeverity(exactDuplicates.length + codeBlockDuplicates.length),
        recommendations: this.generateRecommendations(exactDuplicates, codeBlockDuplicates)
      },
      toolsUsed: [
        'Custom file hash comparison',
        'Regex-based code block extraction',
        'JSCPD static analysis tool',
        'Pattern matching algorithms'
      ]
    };
    
    const reportPath = path.join(this.reportDir, `duplication-analysis-${this.timestamp}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Generate HTML report
    this.generateHTMLReport(report);
    
    console.log(`📋 Duplication report generated: ${reportPath}`);
    return report;
  }

  /**
   * Calculate severity based on duplication count
   */
  calculateSeverity(count: number): 'none' | 'low' | 'medium' | 'high' | 'critical' {
    if (count === 0) { return 'none'; }
    if (count <= 5) { return 'low'; }
    if (count <= 15) { return 'medium'; }
    if (count <= 30) { return 'high'; }
    return 'critical';
  }

  /**
   * Generate recommendations based on findings
   */
  generateRecommendations(exactDuplicates: DuplicateFile[], codeBlockDuplicates: DuplicateCodeBlock[]): string[] {
    const recommendations: string[] = [];
    
    if (exactDuplicates.length > 0) {
      recommendations.push('Remove exact file duplicates - these are likely copy-paste errors');
      recommendations.push('Consolidate duplicate files into shared modules');
    }
    
    if (codeBlockDuplicates.length > 0) {
      recommendations.push('Extract duplicated functions into utility modules');
      recommendations.push('Create base classes for duplicated class patterns');
      recommendations.push('Consolidate similar interfaces into shared type definitions');
    }
    
    if (exactDuplicates.length === 0 && codeBlockDuplicates.length === 0) {
      recommendations.push('Code duplication levels are acceptable');
      recommendations.push('Continue monitoring with automated checks');
    }
    
    return recommendations;
  }

  /**
   * Generate HTML report for easy viewing
   */
  generateHTMLReport(report: DuplicationReport): void {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Duplication Analysis Report</title>
    <style>
        body { font-family: 'Segoe UI', sans-serif; margin: 20px; background: #f5f7fa; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .metric { display: inline-block; margin: 10px 20px; text-align: center; }
        .metric-value { font-size: 2rem; font-weight: bold; }
        .metric-label { font-size: 0.9rem; opacity: 0.9; }
        .section { margin: 30px 0; }
        .severity-${report.summary.severity} { color: ${this.getSeverityColor(report.summary.severity)}; font-weight: bold; }
        .instance { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #007bff; }
        .code-preview { background: #2d3748; color: #e2e8f0; padding: 10px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 0.85rem; overflow-x: auto; }
        .recommendation { background: #e8f5e8; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #28a745; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Code Duplication Analysis Report</h1>
            <p>Generated: ${report.timestamp}</p>
            <div class="metric">
                <div class="metric-value">${report.summary.totalIssues}</div>
                <div class="metric-label">Total Issues</div>
            </div>
            <div class="metric">
                <div class="metric-value severity-${report.summary.severity}">${report.summary.severity.toUpperCase()}</div>
                <div class="metric-label">Severity</div>
            </div>
            <div class="metric">
                <div class="metric-value">${report.analysis.exactFileDuplicates.count}</div>
                <div class="metric-label">File Duplicates</div>
            </div>
            <div class="metric">
                <div class="metric-value">${report.analysis.codeBlockDuplicates.count}</div>
                <div class="metric-label">Code Block Duplicates</div>
            </div>
        </div>

        <div class="section">
            <h2>Exact File Duplicates</h2>
            ${report.analysis.exactFileDuplicates.instances.map(dup => `
                <div class="instance">
                    <h4>Duplicate Files (${dup.size} bytes)</h4>
                    <ul>
                        ${dup.files.map(file => `<li>${path.relative(this.projectRoot, file)}</li>`).join('')}
                    </ul>
                    <p><strong>Hash:</strong> ${dup.hash}</p>
                </div>
            `).join('')}
            ${report.analysis.exactFileDuplicates.count === 0 ? '<p>✅ No exact file duplicates found</p>' : ''}
        </div>

        <div class="section">
            <h2>Code Block Duplicates</h2>
            ${report.analysis.codeBlockDuplicates.instances.map(dup => `
                <div class="instance">
                    <h4>${dup.blockType} Duplication (${dup.count} instances)</h4>
                    <p><strong>Found in:</strong></p>
                    <ul>
                        ${dup.instances.map(inst => `<li>${inst.file}</li>`).join('')}
                    </ul>
                    <p><strong>Preview:</strong></p>
                    <div class="code-preview">${dup.content}</div>
                </div>
            `).join('')}
            ${report.analysis.codeBlockDuplicates.count === 0 ? '<p>✅ No significant code block duplicates found</p>' : ''}
        </div>

        <div class="section">
            <h2>Recommendations</h2>
            ${report.summary.recommendations.map(rec => `
                <div class="recommendation">
                    <p>💡 ${rec}</p>
                </div>
            `).join('')}
        </div>

        <div class="section">
            <h2>Tools Used</h2>
            <ul>
                ${report.toolsUsed.map(tool => `<li>${tool}</li>`).join('')}
            </ul>
        </div>
    </div>
</body>
</html>`;

    const htmlPath = path.join(this.reportDir, `duplication-analysis-${this.timestamp}.html`);
    fs.writeFileSync(htmlPath, htmlContent);
    
    console.log(`📋 HTML report generated: ${htmlPath}`);
  }

  /**
   * Get color for severity level
   */
  getSeverityColor(severity: 'none' | 'low' | 'medium' | 'high' | 'critical'): string {
    const colors = {
      none: '#28a745',
      low: '#ffc107',
      medium: '#fd7e14',
      high: '#dc3545',
      critical: '#6f42c1'
    };
    return colors[severity] || '#6c757d';
  }

  /**
   * Run complete duplication analysis
   */
  async analyze(): Promise<DuplicationReport> {
    console.log('🚀 Starting comprehensive code duplication analysis...');
    console.log('📁 Project:', this.projectRoot);
    console.log('📊 Reports will be saved to:', this.reportDir);
    console.log('');

    const report = await this.generateDuplicationReport();
    
    console.log('');
    console.log('🎯 Analysis Summary:');
    console.log('📋 Total issues found:', report.summary.totalIssues);
    console.log('🚨 Severity level:', report.summary.severity);
    console.log('📦 Exact file duplicates:', report.analysis.exactFileDuplicates.count);
    console.log('🔍 Code block duplicates:', report.analysis.codeBlockDuplicates.count);
    console.log('💡 Recommendations:', report.summary.recommendations.length);
    console.log('');
    console.log('✅ Task 41.2 - Automated Duplicated Code Detection: COMPLETED');
    
    return report;
  }
}

// Run analysis if called directly
if (require.main === module) {
  const analyzer = new DuplicationAnalyzer();
  analyzer.analyze().catch(console.error);
}

export default DuplicationAnalyzer;
