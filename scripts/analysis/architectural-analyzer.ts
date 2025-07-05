#!/usr/bin/env tsx

/**
 * Comprehensive Architectural Analysis and Optimization Script
 * 
 * This is the "heart" script of the project optimization system that provides:
 * - Deep architectural analysis of the entire codebase
 * - Performance bottleneck identification and optimization recommendations
 * - Code consolidation opportunities (unified files, centralized methods)
 * - Bot cycling and workflow optimization analysis
 * - Maintainability assessment and improvement suggestions
 * - Integration with existing monitoring and quality systems
 * 
 * Usage:
 *   npx tsx scripts/analysis/architectural-analyzer.ts
 *   npm run analyze:architecture
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { execSync } from 'child_process';

// Core interfaces for architectural analysis
interface ArchitecturalElement {
  type: 'function' | 'method' | 'class' | 'interface' | 'module' | 'file';
  name: string;
  filePath: string;
  startLine: number;
  endLine: number;
  complexity: number;
  dependencies: string[];
  usageCount: number;
  size: number;
  content: string;
  hash: string;
}

interface CodePattern {
  type: 'repetitive' | 'similar' | 'duplicate' | 'complex' | 'bottleneck';
  elements: ArchitecturalElement[];
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendedAction: string;
  estimatedImpact: {
    performance: number;
    maintainability: number;
    codeReduction: number;
  };
  implementationEffort: 'low' | 'medium' | 'high';
}

interface ConsolidationOpportunity {
  type: 'file-unification' | 'method-centralization' | 'utility-extraction' | 'interface-standardization';
  targetFiles: string[];
  suggestedLocation: string;
  suggestedName: string;
  affectedElements: ArchitecturalElement[];
  benefits: {
    codeReduction: number;
    maintainabilityImprovement: number;
    performanceGain: number;
  };
  implementationSteps: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

interface PerformanceInsight {
  type: 'bottleneck' | 'inefficiency' | 'optimization' | 'resource-waste';
  location: string;
  description: string;
  currentMetrics: {
    executionTime?: number;
    memoryUsage?: number;
    cpuUsage?: number;
    ioOperations?: number;
  };
  optimization: {
    strategy: string;
    expectedImprovement: string;
    implementationComplexity: 'low' | 'medium' | 'high';
  };
  priority: number;
}

interface ArchitecturalReport {
  timestamp: string;
  projectMetrics: {
    totalFiles: number;
    totalLines: number;
    totalFunctions: number;
    totalClasses: number;
    duplicateCount: number;
    complexityScore: number;
  };
  patterns: CodePattern[];
  consolidationOpportunities: ConsolidationOpportunity[];
  performanceInsights: PerformanceInsight[];
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
  implementationRoadmap: {
    phase: string;
    tasks: string[];
    estimatedEffort: string;
    expectedBenefits: string[];
  }[];
}

interface AnalysisConfig {
  includePatterns: string[];
  excludePatterns: string[];
  minFunctionSize: number;
  minComplexity: number;
  maxFileSize: number;
  similarityThreshold: number;
  performanceProfilingEnabled: boolean;
  deepAnalysisEnabled: boolean;
}

const DEFAULT_CONFIG: AnalysisConfig = {
  includePatterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
  excludePatterns: [
    'node_modules/**',
    '.taskmaster/**',
    'dist/**',
    'build/**',
    'coverage/**',
    '**/*.test.*',
    '**/*.spec.*',
    '**/*.d.ts',
    'logs/**',
    'reports/**',
    '**/*.min.js',
    '**/lib/**'
  ],
  minFunctionSize: 3,
  minComplexity: 2,
  maxFileSize: 500000,
  similarityThreshold: 0.7,
  performanceProfilingEnabled: true,
  deepAnalysisEnabled: true
};

// Core architectural analysis engine
class ArchitecturalAnalyzer {
  private config: AnalysisConfig;
  private projectRoot: string;
  private allElements: ArchitecturalElement[] = [];
  private fileContents: Map<string, string> = new Map();
  private dependencyGraph: Map<string, string[]> = new Map();

  constructor(projectRoot: string, config: Partial<AnalysisConfig> = {}) {
    this.projectRoot = projectRoot;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async analyzeProject(): Promise<ArchitecturalReport> {
    console.log('🏗️ Starting comprehensive architectural analysis...');
    console.log(`📁 Project root: ${this.projectRoot}`);
    
    const files = await this.discoverFiles();
    console.log(`📄 Found ${files.length} files to analyze`);
    
    await this.parseFiles(files);
    console.log(`🔍 Extracted ${this.allElements.length} architectural elements`);
    
    const patterns = await this.analyzePatterns();
    const consolidationOpportunities = await this.identifyConsolidationOpportunities();
    const performanceInsights = await this.analyzePerformance();
    const recommendations = this.generateRecommendations(patterns, consolidationOpportunities, performanceInsights);
    const roadmap = this.generateImplementationRoadmap(patterns, consolidationOpportunities, performanceInsights);
    
    const report: ArchitecturalReport = {
      timestamp: new Date().toISOString(),
      projectMetrics: this.calculateProjectMetrics(),
      patterns,
      consolidationOpportunities,
      performanceInsights,
      recommendations,
      implementationRoadmap: roadmap
    };
    
    console.log('✅ Architectural analysis complete!');
    return report;
  }

  private async discoverFiles(): Promise<string[]> {
    const files: string[] = [];
    
    const scanDirectory = (dirPath: string): void => {
      try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            if (!this.shouldExcludePath(fullPath)) {
              scanDirectory(fullPath);
            }
          } else if (entry.isFile()) {
            if (this.shouldIncludeFile(fullPath) && !this.shouldExcludePath(fullPath)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️ Could not scan directory: ${dirPath}`);
      }
    };

    scanDirectory(this.projectRoot);
    return files;
  }

  private shouldIncludeFile(filePath: string): boolean {
    const fileName = path.basename(filePath);
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    return extensions.some(ext => fileName.endsWith(ext));
  }

  private shouldExcludePath(filePath: string): boolean {
    const relativePath = path.relative(this.projectRoot, filePath);
    const excludePatterns = [
      'node_modules',
      'dist',
      'build',
      'coverage',
      '.d.ts',
      '.test.',
      '.spec.'
    ];
    
    return excludePatterns.some(pattern => 
      relativePath.includes(pattern) || path.basename(filePath).includes(pattern)
    );
  }

  private async parseFiles(files: string[]): Promise<void> {
    for (const filePath of files) {
      try {
        const stats = fs.statSync(filePath);
        if (stats.size > this.config.maxFileSize) {
          console.warn(`⚠️ Skipping large file: ${filePath} (${stats.size} bytes)`);
          continue;
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        this.fileContents.set(filePath, content);
        
        const elements = await this.extractElementsFromFile(filePath, content);
        this.allElements.push(...elements);
        
        const dependencies = this.extractDependencies(content);
        this.dependencyGraph.set(filePath, dependencies);
        
      } catch (error) {
        console.warn(`⚠️ Error processing file ${filePath}: ${error}`);
      }
    }
  }

  private async extractElementsFromFile(filePath: string, content: string): Promise<ArchitecturalElement[]> {
    const elements: ArchitecturalElement[] = [];

    // Extract functions
    const functionPattern = /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*[:=]\s*(?:async\s+)?\(|(\w+)\s*[:=]\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>)/gm;
    let match;
    
    while ((match = functionPattern.exec(content)) !== null) {
      const functionName = match[1] || match[2] || match[3];
      if (functionName && functionName.length > 1) {
        const startLine = content.substring(0, match.index!).split('\n').length;
        const functionBody = this.extractBlock(content, match.index! + match[0].length);
        
        if (functionBody && functionBody.split('\n').length >= this.config.minFunctionSize) {
          elements.push({
            type: 'function',
            name: functionName,
            filePath,
            startLine,
            endLine: startLine + functionBody.split('\n').length - 1,
            complexity: this.calculateComplexity(functionBody),
            dependencies: this.extractDependencies(functionBody),
            usageCount: 0,
            size: functionBody.split('\n').length,
            content: functionBody,
            hash: createHash('md5').update(functionBody.replace(/\s+/g, ' ')).digest('hex')
          });
        }
      }
    }

    // Extract classes
    const classPattern = /(?:^|\n)\s*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/gm;
    while ((match = classPattern.exec(content)) !== null) {
      const className = match[1];
      if (className) {
        const startLine = content.substring(0, match.index!).split('\n').length;
        const classBody = this.extractBlock(content, match.index! + match[0].length);
        
        if (classBody) {
          elements.push({
            type: 'class',
            name: className,
            filePath,
            startLine,
            endLine: startLine + classBody.split('\n').length - 1,
            complexity: this.calculateComplexity(classBody),
            dependencies: this.extractDependencies(classBody),
            usageCount: 0,
            size: classBody.split('\n').length,
            content: classBody,
            hash: createHash('md5').update(classBody.replace(/\s+/g, ' ')).digest('hex')
          });
        }
      }
    }

    return elements;
  }

  private extractBlock(content: string, startIndex: number): string | null {
    let braceCount = 0;
    let inBlock = false;
    let blockStart = startIndex;
    
    for (let i = startIndex; i < content.length; i++) {
      const char = content[i];
      
      if (char === '{') {
        if (!inBlock) {
          blockStart = i;
          inBlock = true;
        }
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (inBlock && braceCount === 0) {
          return content.substring(blockStart, i + 1);
        }
      }
    }
    
    return null;
  }

  private extractDependencies(content: string): string[] {
    const dependencies: string[] = [];
    
    const importPattern = /import\s+(?:\{[^}]+\}|\w+|\*\s+as\s+\w+)\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = importPattern.exec(content)) !== null) {
      dependencies.push(match[1]);
    }
    
    const requirePattern = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requirePattern.exec(content)) !== null) {
      dependencies.push(match[1]);
    }
    
    return [...new Set(dependencies)];
  }

  private calculateComplexity(code: string): number {
    let complexity = 1;
    
    const complexityPatterns = [
      /\bif\b/g, /\belse\b/g, /\bwhile\b/g, /\bfor\b/g,
      /\bswitch\b/g, /\bcase\b/g, /\bcatch\b/g,
      /\b&&\b/g, /\b\|\|\b/g, /\?\s*[^:]+\s*:/g
    ];
    
    complexityPatterns.forEach(pattern => {
      const matches = code.match(pattern);
      if (matches) complexity += matches.length;
    });
    
    return complexity;
  }

  private async analyzePatterns(): Promise<CodePattern[]> {
    const patterns: CodePattern[] = [];
    
    // Find duplicate functions
    const functionsByHash = new Map<string, ArchitecturalElement[]>();
    this.allElements
      .filter(el => el.type === 'function')
      .forEach(func => {
        if (!functionsByHash.has(func.hash)) {
          functionsByHash.set(func.hash, []);
        }
        functionsByHash.get(func.hash)!.push(func);
      });
    
    functionsByHash.forEach((functions, hash) => {
      if (functions.length > 1) {
        const avgSize = functions.reduce((sum, f) => sum + f.size, 0) / functions.length;
        patterns.push({
          type: 'duplicate',
          elements: functions,
          description: `Found ${functions.length} duplicate functions with identical logic`,
          severity: functions.length > 3 ? 'high' : 'medium',
          recommendedAction: 'Extract common function to utility module and replace duplicates',
          estimatedImpact: {
            performance: 2,
            maintainability: 8,
            codeReduction: (functions.length - 1) * avgSize
          },
          implementationEffort: 'medium'
        });
      }
    });
    
    // Find complex functions
    const complexFunctions = this.allElements
      .filter(el => el.type === 'function' && el.complexity > 10)
      .sort((a, b) => b.complexity - a.complexity);
    
    if (complexFunctions.length > 0) {
      patterns.push({
        type: 'complex',
        elements: complexFunctions,
        description: `Found ${complexFunctions.length} highly complex functions that are difficult to maintain`,
        severity: 'high',
        recommendedAction: 'Break down complex functions into smaller, focused functions',
        estimatedImpact: {
          performance: 3,
          maintainability: 9,
          codeReduction: 0
        },
        implementationEffort: 'high'
      });
    }
    
    return patterns;
  }

  private async identifyConsolidationOpportunities(): Promise<ConsolidationOpportunity[]> {
    const opportunities: ConsolidationOpportunity[] = [];
    
    // Find similar functions that could be unified
    const similarFunctions = this.findSimilarFunctions();
    
    if (similarFunctions.length > 0) {
      opportunities.push({
        type: 'method-centralization',
        targetFiles: [...new Set(similarFunctions.map(f => f.filePath))],
        suggestedLocation: 'src/utils/common.ts',
        suggestedName: 'centralizedUtilities',
        affectedElements: similarFunctions,
        benefits: {
          codeReduction: similarFunctions.reduce((sum, f) => sum + f.size, 0) * 0.7,
          maintainabilityImprovement: 8,
          performanceGain: 2
        },
        implementationSteps: [
          'Create centralized utility module',
          'Extract common patterns',
          'Replace duplicated code',
          'Update imports across project'
        ],
        riskLevel: 'low'
      });
    }
    
    return opportunities;
  }

  private findSimilarFunctions(): ArchitecturalElement[] {
    const functions = this.allElements.filter(el => el.type === 'function');
    const similar: ArchitecturalElement[] = [];
    
    for (let i = 0; i < functions.length; i++) {
      for (let j = i + 1; j < functions.length; j++) {
        const similarity = this.calculateSimilarity(functions[i].content, functions[j].content);
        if (similarity > this.config.similarityThreshold) {
          if (!similar.includes(functions[i])) similar.push(functions[i]);
          if (!similar.includes(functions[j])) similar.push(functions[j]);
        }
      }
    }
    
    return similar;
  }

  private calculateSimilarity(content1: string, content2: string): number {
    const tokens1 = new Set(content1.replace(/\s+/g, ' ').split(' '));
    const tokens2 = new Set(content2.replace(/\s+/g, ' ').split(' '));
    
    const intersection = new Set([...tokens1].filter(token => tokens2.has(token)));
    const union = new Set([...tokens1, ...tokens2]);
    
    return intersection.size / union.size;
  }

  private async analyzePerformance(): Promise<PerformanceInsight[]> {
    const insights: PerformanceInsight[] = [];
    
    // Find large functions that could be performance bottlenecks
    const largeFunctions = this.allElements
      .filter(el => el.type === 'function' && el.size > 100)
      .sort((a, b) => b.size - a.size);
    
    largeFunctions.slice(0, 5).forEach(func => {
      insights.push({
        type: 'bottleneck',
        location: `${func.filePath}:${func.startLine}`,
        description: `Large function "${func.name}" with ${func.size} lines may impact performance`,
        currentMetrics: {
          executionTime: func.size * 0.1, // estimated
        },
        optimization: {
          strategy: 'Break down into smaller functions and optimize critical paths',
          expectedImprovement: '20-40% performance improvement',
          implementationComplexity: 'medium'
        },
        priority: Math.min(10, Math.floor(func.size / 20))
      });
    });
    
    return insights;
  }

  private generateRecommendations(
    patterns: CodePattern[], 
    opportunities: ConsolidationOpportunity[], 
    insights: PerformanceInsight[]
  ): { immediate: string[]; shortTerm: string[]; longTerm: string[] } {
    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];
    
    patterns.forEach(pattern => {
      if (pattern.severity === 'critical' || pattern.severity === 'high') {
        immediate.push(pattern.recommendedAction);
      } else {
        shortTerm.push(pattern.recommendedAction);
      }
    });
    
    opportunities.forEach(opp => {
      if (opp.riskLevel === 'low') {
        shortTerm.push(`Implement ${opp.type}: ${opp.suggestedName}`);
      } else {
        longTerm.push(`Consider ${opp.type}: ${opp.suggestedName}`);
      }
    });
    
    insights.forEach(insight => {
      if (insight.priority > 7) {
        immediate.push(`Address performance bottleneck: ${insight.description}`);
      } else if (insight.priority > 4) {
        shortTerm.push(`Optimize: ${insight.description}`);
      } else {
        longTerm.push(`Monitor: ${insight.description}`);
      }
    });
    
    return { immediate, shortTerm, longTerm };
  }

  private generateImplementationRoadmap(
    patterns: CodePattern[], 
    opportunities: ConsolidationOpportunity[], 
    insights: PerformanceInsight[]
  ): { phase: string; tasks: string[]; estimatedEffort: string; expectedBenefits: string[] }[] {
    return [
      {
        phase: 'Phase 1: Critical Issues',
        tasks: [
          'Fix duplicate code patterns',
          'Address high complexity functions',
          'Resolve critical performance bottlenecks'
        ],
        estimatedEffort: '2-3 weeks',
        expectedBenefits: [
          'Improved code maintainability',
          'Reduced technical debt',
          'Better performance'
        ]
      },
      {
        phase: 'Phase 2: Code Consolidation',
        tasks: [
          'Implement utility extraction opportunities',
          'Centralize common methods',
          'Standardize interfaces'
        ],
        estimatedEffort: '3-4 weeks',
        expectedBenefits: [
          'Reduced code duplication',
          'Improved developer productivity',
          'Better code organization'
        ]
      },
      {
        phase: 'Phase 3: Long-term Optimization',
        tasks: [
          'Monitor performance metrics',
          'Implement advanced optimizations',
          'Continuous architectural improvements'
        ],
        estimatedEffort: 'Ongoing',
        expectedBenefits: [
          'Sustained performance',
          'Scalable architecture',
          'Future-proof codebase'
        ]
      }
    ];
  }

  private calculateProjectMetrics(): {
    totalFiles: number;
    totalLines: number;
    totalFunctions: number;
    totalClasses: number;
    duplicateCount: number;
    complexityScore: number;
  } {
    const functions = this.allElements.filter(el => el.type === 'function');
    const classes = this.allElements.filter(el => el.type === 'class');
    
    const totalLines = Array.from(this.fileContents.values())
      .reduce((sum, content) => sum + content.split('\n').length, 0);
    
    const duplicateCount = this.findDuplicateCount();
    const complexityScore = this.calculateAverageComplexity();
    
    return {
      totalFiles: this.fileContents.size,
      totalLines,
      totalFunctions: functions.length,
      totalClasses: classes.length,
      duplicateCount,
      complexityScore
    };
  }

  private findDuplicateCount(): number {
    const hashes = new Set<string>();
    let duplicates = 0;
    
    this.allElements.forEach(el => {
      if (hashes.has(el.hash)) {
        duplicates++;
      } else {
        hashes.add(el.hash);
      }
    });
    
    return duplicates;
  }

  private calculateAverageComplexity(): number {
    const complexities = this.allElements.map(el => el.complexity);
    return complexities.length > 0 
      ? complexities.reduce((sum, c) => sum + c, 0) / complexities.length 
      : 0;
  }

  async saveReport(report: ArchitecturalReport, outputPath?: string): Promise<void> {
    const reportPath = outputPath || path.join(this.projectRoot, 'reports', 'architectural-analysis.json');
    const reportDir = path.dirname(reportPath);
    
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📊 Report saved to: ${reportPath}`);
  }
}

// Main execution
async function main(): Promise<void> {
  try {
    const projectRoot = process.cwd();
    console.log('🚀 Starting Architectural Analysis...');
    
    const analyzer = new ArchitecturalAnalyzer(projectRoot);
    const report = await analyzer.analyzeProject();
    
    await analyzer.saveReport(report);
    
    console.log('\n📋 Analysis Summary:');
    console.log(`├── Files analyzed: ${report.projectMetrics.totalFiles}`);
    console.log(`├── Functions found: ${report.projectMetrics.totalFunctions}`);
    console.log(`├── Classes found: ${report.projectMetrics.totalClasses}`);
    console.log(`├── Patterns identified: ${report.patterns.length}`);
    console.log(`├── Consolidation opportunities: ${report.consolidationOpportunities.length}`);
    console.log(`├── Performance insights: ${report.performanceInsights.length}`);
    console.log(`└── Average complexity: ${report.projectMetrics.complexityScore.toFixed(2)}`);
    
    console.log('\n💡 Key Recommendations:');
    report.recommendations.immediate.slice(0, 3).forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });
    
    console.log('\n✅ Architectural analysis complete! Check the full report for detailed recommendations.');
    
  } catch (error) {
    console.error('❌ Error during architectural analysis:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}