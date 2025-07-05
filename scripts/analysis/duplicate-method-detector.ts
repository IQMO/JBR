#!/usr/bin/env tsx

/**
 * Duplicate Method Detection Script
 * 
 * This script analyzes the codebase to identify methods with identical or very similar code.
 * It provides a detailed report of duplicate methods, including their location and code comparison.
 * 
 * Features:
 * - Detects exact duplicate methods
 * - Identifies similar methods with configurable similarity threshold
 * - Provides detailed reports with code comparisons
 * - Supports refactoring suggestions
 * - Works with TypeScript and JavaScript files
 * 
 * Usage:
 *   npx tsx scripts/analysis/duplicate-method-detector.ts
 *   npm run detect:duplicates
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

// Types and interfaces
interface MethodInfo {
  name: string;
  signature: string;
  body: string;
  normalizedBody: string;
  hash: string;
  filePath: string;
  startLine: number;
  endLine: number;
  className?: string;
  isStatic: boolean;
  isAsync: boolean;
  parameters: string[];
  returnType?: string;
}

interface DuplicateGroup {
  hash: string;
  methods: MethodInfo[];
  type: 'exact' | 'similar';
  similarityScore?: number;
}

interface DetectionOptions {
  minMethodLength: number;
  similarityThreshold: number;
  includePrivateMethods: boolean;
  includeGettersSetters: boolean;
  excludePatterns: string[];
  maxFileSize: number;
}

interface DetectionResult {
  totalMethods: number;
  totalFiles: number;
  duplicateGroups: DuplicateGroup[];
  exactDuplicates: number;
  similarDuplicates: number;
  potentialSavings: {
    linesOfCode: number;
    duplicateFiles: number;
  };
}

// Default configuration
const DEFAULT_OPTIONS: DetectionOptions = {
  minMethodLength: 3, // Minimum lines of code in method body
  similarityThreshold: 0.85, // 85% similarity threshold
  includePrivateMethods: true,
  includeGettersSetters: false,
  excludePatterns: [
    'test',
    'spec',
    '.d.ts',
    'node_modules',
    'dist',
    'build'
  ],
  maxFileSize: 50000 // 50KB max file size
};

// Utility functions
class MethodExtractor {
  private static readonly METHOD_PATTERNS = [
    // Regular function declarations
    /(?:^|\n)\s*((?:export\s+)?(?:async\s+)?(?:static\s+)?(?:private\s+|public\s+|protected\s+)?(?:abstract\s+)?(?:readonly\s+)?(?:get\s+|set\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{)/gm,
    // Arrow functions as class properties
    /(?:^|\n)\s*((?:private\s+|public\s+|protected\s+)?(?:static\s+)?(?:readonly\s+)?(\w+)\s*[:=]\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>\s*\{)/gm,
    // Method definitions in objects
    /(?:^|\n)\s*((\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{)/gm
  ];

  static extractMethods(content: string, filePath: string): MethodInfo[] {
    const methods: MethodInfo[] = [];
    const lines = content.split('\n');

    for (const pattern of this.METHOD_PATTERNS) {
      let match;
      pattern.lastIndex = 0; // Reset regex state

      while ((match = pattern.exec(content)) !== null) {
        try {
          const methodInfo = this.parseMethodFromMatch(match, content, filePath, lines);
          if (methodInfo && this.isValidMethod(methodInfo)) {
            methods.push(methodInfo);
          }
        } catch (error) {
          // Skip malformed methods
          continue;
        }
      }
    }

    return this.deduplicateMethods(methods);
  }

  private static parseMethodFromMatch(
    match: RegExpExecArray,
    content: string,
    filePath: string,
    lines: string[]
  ): MethodInfo | null {
    const fullMatch = match[1];
    const methodName = match[2] || this.extractMethodName(fullMatch);
    
    if (!methodName || methodName.length < 2) return null;

    const startIndex = match.index!;
    const startLine = content.substring(0, startIndex).split('\n').length;
    
    // Find method body using brace matching
    const methodBody = this.extractMethodBody(content, startIndex + fullMatch.length - 1);
    if (!methodBody) return null;

    const endLine = startLine + methodBody.split('\n').length - 1;
    const normalizedBody = this.normalizeMethodBody(methodBody);
    
    return {
      name: methodName,
      signature: this.extractSignature(fullMatch),
      body: methodBody,
      normalizedBody,
      hash: this.generateMethodHash(normalizedBody),
      filePath,
      startLine,
      endLine,
      className: this.extractClassName(content, startIndex),
      isStatic: fullMatch.includes('static'),
      isAsync: fullMatch.includes('async'),
      parameters: this.extractParameters(fullMatch),
      returnType: this.extractReturnType(fullMatch)
    };
  }

  private static extractMethodName(signature: string): string {
    const nameMatch = signature.match(/(\w+)\s*\(/);
    return nameMatch ? nameMatch[1] : '';
  }

  private static extractMethodBody(content: string, startIndex: number): string | null {
    let braceCount = 0;
    let currentIndex = startIndex;
    let foundFirstBrace = false;
    
    while (currentIndex < content.length) {
      const char = content[currentIndex];
      
      if (char === '{') {
        braceCount++;
        foundFirstBrace = true;
      } else if (char === '}') {
        braceCount--;
        if (foundFirstBrace && braceCount === 0) {
          return content.substring(startIndex, currentIndex + 1);
        }
      }
      
      currentIndex++;
    }
    
    return null;
  }

  private static normalizeMethodBody(body: string): string {
    return body
      // Remove comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      // Remove unnecessary semicolons
      .replace(/;\s*}/g, '}')
      // Normalize string literals (basic)
      .replace(/"[^"]*"/g, '""')
      .replace(/'[^']*'/g, "''")
      .replace(/`[^`]*`/g, '``')
      // Remove trailing/leading spaces
      .trim();
  }

  private static generateMethodHash(normalizedBody: string): string {
    return createHash('md5').update(normalizedBody).digest('hex');
  }

  private static extractSignature(fullMatch: string): string {
    const signatureMatch = fullMatch.match(/(\w+\s*\([^)]*\)(?:\s*:\s*[^{]+)?)/);
    return signatureMatch ? signatureMatch[1].trim() : fullMatch.trim();
  }

  private static extractClassName(content: string, methodIndex: number): string | undefined {
    const beforeMethod = content.substring(0, methodIndex);
    const classMatch = beforeMethod.match(/class\s+(\w+)/g);
    if (classMatch && classMatch.length > 0) {
      const lastClass = classMatch[classMatch.length - 1];
      const nameMatch = lastClass.match(/class\s+(\w+)/);
      return nameMatch ? nameMatch[1] : undefined;
    }
    return undefined;
  }

  private static extractParameters(signature: string): string[] {
    const paramMatch = signature.match(/\(([^)]*)\)/);
    if (!paramMatch || !paramMatch[1].trim()) return [];
    
    return paramMatch[1]
      .split(',')
      .map(param => param.trim().split(':')[0].trim())
      .filter(param => param.length > 0);
  }

  private static extractReturnType(signature: string): string | undefined {
    const returnMatch = signature.match(/\):\s*([^{]+)/);
    return returnMatch ? returnMatch[1].trim() : undefined;
  }

  private static isValidMethod(method: MethodInfo): boolean {
    // Filter out very short methods
    const bodyLines = method.body.split('\n').length;
    if (bodyLines < DEFAULT_OPTIONS.minMethodLength) return false;
    
    // Filter out getters/setters if configured
    if (!DEFAULT_OPTIONS.includeGettersSetters && 
        (method.signature.includes('get ') || method.signature.includes('set '))) {
      return false;
    }
    
    // Filter out private methods if configured
    if (!DEFAULT_OPTIONS.includePrivateMethods && method.signature.includes('private')) {
      return false;
    }
    
    // Filter out common trivial methods
    const trivialPatterns = [
      /^{\s*return\s+\w+;\s*}$/,
      /^{\s*this\.\w+\s*=\s*\w+;\s*}$/,
      /^{\s*}$/
    ];
    
    return !trivialPatterns.some(pattern => pattern.test(method.normalizedBody));
  }

  private static deduplicateMethods(methods: MethodInfo[]): MethodInfo[] {
    const seen = new Set<string>();
    return methods.filter(method => {
      const key = `${method.filePath}:${method.startLine}:${method.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

// Main duplicate method detector class
class DuplicateMethodDetector {
  private options: DetectionOptions;

  constructor(options: Partial<DetectionOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async detectDuplicates(rootPath: string = process.cwd()): Promise<DetectionResult> {
    console.log('🔍 Starting duplicate method detection...');
    console.log(`📁 Scanning directory: ${rootPath}`);
    
    const files = this.findTypeScriptFiles(rootPath);
    console.log(`📄 Found ${files.length} TypeScript files to analyze`);
    
    const allMethods: MethodInfo[] = [];
    let processedFiles = 0;

    for (const file of files) {
      try {
        const methods = await this.extractMethodsFromFile(file);
        allMethods.push(...methods);
        processedFiles++;
        
        if (processedFiles % 50 === 0) {
          console.log(`⏳ Processed ${processedFiles}/${files.length} files...`);
        }
      } catch (error) {
        console.warn(`⚠️ Could not process file ${file}: ${error}`);
      }
    }

    console.log(`✅ Extracted ${allMethods.length} methods from ${processedFiles} files`);
    
    const duplicateGroups = this.findDuplicateGroups(allMethods);
    
    return this.buildResult(allMethods, processedFiles, duplicateGroups);
  }

  private findTypeScriptFiles(rootPath: string): string[] {
    const files: string[] = [];
    
    const scanDirectory = (dirPath: string): void => {
      try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          
          if (entry.isDirectory()) {
            // Skip excluded directories
            if (this.shouldExcludePath(entry.name)) continue;
            scanDirectory(fullPath);
          } else if (entry.isFile()) {
            // Include TypeScript files
            if (this.isTypeScriptFile(entry.name) && !this.shouldExcludePath(fullPath)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    scanDirectory(rootPath);
    return files;
  }

  private shouldExcludePath(filePath: string): boolean {
    return this.options.excludePatterns.some(pattern => 
      filePath.includes(pattern)
    );
  }

  private isTypeScriptFile(fileName: string): boolean {
    return /\.(ts|tsx|js|jsx)$/.test(fileName) && !fileName.endsWith('.d.ts');
  }

  private async extractMethodsFromFile(filePath: string): Promise<MethodInfo[]> {
    try {
      const stats = fs.statSync(filePath);
      if (stats.size > this.options.maxFileSize) {
        console.warn(`⚠️ Skipping large file: ${filePath} (${stats.size} bytes)`);
        return [];
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      return MethodExtractor.extractMethods(content, filePath);
    } catch (error) {
      console.warn(`⚠️ Error reading file ${filePath}: ${error}`);
      return [];
    }
  }

  private findDuplicateGroups(methods: MethodInfo[]): DuplicateGroup[] {
    const groups: DuplicateGroup[] = [];
    const methodsByHash = new Map<string, MethodInfo[]>();

    // Group methods by their normalized hash
    for (const method of methods) {
      if (!methodsByHash.has(method.hash)) {
        methodsByHash.set(method.hash, []);
      }
      methodsByHash.get(method.hash)!.push(method);
    }

    // Find exact duplicates
    for (const [hash, groupMethods] of methodsByHash) {
      if (groupMethods.length > 1) {
        groups.push({
          hash,
          methods: groupMethods,
          type: 'exact'
        });
      }
    }

    // Find similar methods (cross-compare remaining methods)
    const singleMethods = Array.from(methodsByHash.values())
      .filter(group => group.length === 1)
      .map(group => group[0]);

    const similarGroups = this.findSimilarMethods(singleMethods);
    groups.push(...similarGroups);

    return groups;
  }

  private findSimilarMethods(methods: MethodInfo[]): DuplicateGroup[] {
    const similarGroups: DuplicateGroup[] = [];
    const processed = new Set<number>();

    for (let i = 0; i < methods.length; i++) {
      if (processed.has(i)) continue;

      const similarMethods: MethodInfo[] = [methods[i]];
      
      for (let j = i + 1; j < methods.length; j++) {
        if (processed.has(j)) continue;

        const similarity = this.calculateSimilarity(methods[i], methods[j]);
        if (similarity >= this.options.similarityThreshold) {
          similarMethods.push(methods[j]);
          processed.add(j);
        }
      }

      if (similarMethods.length > 1) {
        similarGroups.push({
          hash: methods[i].hash,
          methods: similarMethods,
          type: 'similar',
          similarityScore: this.calculateGroupSimilarity(similarMethods)
        });
      }

      processed.add(i);
    }

    return similarGroups;
  }

  private calculateSimilarity(method1: MethodInfo, method2: MethodInfo): number {
    // Use Levenshtein distance for similarity calculation
    const normalized1 = method1.normalizedBody;
    const normalized2 = method2.normalizedBody;
    
    if (normalized1 === normalized2) return 1.0;
    
    const distance = this.levenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);
    
    return maxLength > 0 ? 1 - (distance / maxLength) : 0;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private calculateGroupSimilarity(methods: MethodInfo[]): number {
    if (methods.length < 2) return 1.0;
    
    let totalSimilarity = 0;
    let comparisons = 0;
    
    for (let i = 0; i < methods.length; i++) {
      for (let j = i + 1; j < methods.length; j++) {
        totalSimilarity += this.calculateSimilarity(methods[i], methods[j]);
        comparisons++;
      }
    }
    
    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  private buildResult(
    allMethods: MethodInfo[],
    processedFiles: number,
    duplicateGroups: DuplicateGroup[]
  ): DetectionResult {
    const exactDuplicates = duplicateGroups.filter(g => g.type === 'exact').length;
    const similarDuplicates = duplicateGroups.filter(g => g.type === 'similar').length;
    
    const potentialSavings = this.calculatePotentialSavings(duplicateGroups);
    
    return {
      totalMethods: allMethods.length,
      totalFiles: processedFiles,
      duplicateGroups,
      exactDuplicates,
      similarDuplicates,
      potentialSavings
    };
  }

  private calculatePotentialSavings(groups: DuplicateGroup[]): { linesOfCode: number; duplicateFiles: number } {
    let linesOfCode = 0;
    const duplicateFiles = new Set<string>();
    
    for (const group of groups) {
      if (group.methods.length > 1) {
        // Calculate potential savings (keep one, remove others)
        const duplicateMethodsCount = group.methods.length - 1;
        const avgLinesPerMethod = group.methods.reduce((sum, method) => 
          sum + (method.endLine - method.startLine + 1), 0) / group.methods.length;
        
        linesOfCode += Math.round(duplicateMethodsCount * avgLinesPerMethod);
        
        group.methods.forEach(method => duplicateFiles.add(method.filePath));
      }
    }
    
    return {
      linesOfCode,
      duplicateFiles: duplicateFiles.size
    };
  }
}

// Report generator class
class DuplicateMethodReporter {
  static generateReport(result: DetectionResult): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 DUPLICATE METHOD DETECTION REPORT');
    console.log('='.repeat(80));
    
    this.printSummary(result);
    this.printDuplicateGroups(result.duplicateGroups);
    this.printRecommendations(result);
    
    console.log('\n' + '='.repeat(80));
  }

  private static printSummary(result: DetectionResult): void {
    console.log('\n📈 SUMMARY:');
    console.log(`   Total Methods Analyzed: ${result.totalMethods}`);
    console.log(`   Total Files Processed: ${result.totalFiles}`);
    console.log(`   Exact Duplicate Groups: ${result.exactDuplicates}`);
    console.log(`   Similar Method Groups: ${result.similarDuplicates}`);
    console.log(`   Potential Lines Saved: ${result.potentialSavings.linesOfCode}`);
    console.log(`   Files with Duplicates: ${result.potentialSavings.duplicateFiles}`);
  }

  private static printDuplicateGroups(groups: DuplicateGroup[]): void {
    if (groups.length === 0) {
      console.log('\n✅ No duplicate methods found!');
      return;
    }

    console.log('\n🔍 DUPLICATE GROUPS:');
    
    groups.forEach((group, index) => {
      console.log(`\n${index + 1}. ${group.type.toUpperCase()} DUPLICATES (${group.methods.length} methods)`);
      
      if (group.type === 'similar' && group.similarityScore) {
        console.log(`   Similarity Score: ${(group.similarityScore * 100).toFixed(1)}%`);
      }
      
      group.methods.forEach((method, methodIndex) => {
        const relativePath = method.filePath.replace(process.cwd(), '.');
        console.log(`   ${methodIndex + 1}. ${method.name}() in ${relativePath}:${method.startLine}`);
        
        if (method.className) {
          console.log(`      Class: ${method.className}`);
        }
        
        console.log(`      Signature: ${method.signature}`);
        console.log(`      Lines: ${method.startLine}-${method.endLine} (${method.endLine - method.startLine + 1} lines)`);
      });
      
      // Show code comparison for exact duplicates
      if (group.type === 'exact' && group.methods.length === 2) {
        console.log('   \n📝 Code Preview:');
        const previewLines = group.methods[0].body.split('\n').slice(0, 5);
        previewLines.forEach(line => console.log(`      ${line}`));
        if (group.methods[0].body.split('\n').length > 5) {
          console.log('      ...');
        }
      }
    });
  }

  private static printRecommendations(result: DetectionResult): void {
    console.log('\n💡 RECOMMENDATIONS:');
    
    if (result.exactDuplicates > 0) {
      console.log('   1. Extract exact duplicate methods into utility functions');
      console.log('   2. Create shared base classes or mixins for common functionality');
      console.log('   3. Consider using composition over inheritance where appropriate');
    }
    
    if (result.similarDuplicates > 0) {
      console.log('   4. Review similar methods for potential refactoring opportunities');
      console.log('   5. Consider parameterizing similar methods to reduce duplication');
      console.log('   6. Look for opportunities to create template methods or strategy patterns');
    }
    
    if (result.potentialSavings.linesOfCode > 100) {
      console.log('   7. HIGH IMPACT: Consider prioritizing duplicate removal');
      console.log(`      Potential savings: ${result.potentialSavings.linesOfCode} lines of code`);
    }
    
    console.log('   8. Run this analysis regularly as part of code review process');
    console.log('   9. Consider adding duplicate detection to CI/CD pipeline');
  }

  static saveReportToFile(result: DetectionResult, outputPath: string): void {
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalMethods: result.totalMethods,
        totalFiles: result.totalFiles,
        exactDuplicates: result.exactDuplicates,
        similarDuplicates: result.similarDuplicates,
        potentialSavings: result.potentialSavings
      },
      duplicateGroups: result.duplicateGroups.map(group => ({
        type: group.type,
        methodCount: group.methods.length,
        similarityScore: group.similarityScore,
        methods: group.methods.map(method => ({
          name: method.name,
          filePath: method.filePath.replace(process.cwd(), '.'),
          startLine: method.startLine,
          endLine: method.endLine,
          className: method.className,
          signature: method.signature
        }))
      }))
    };

    fs.writeFileSync(outputPath, JSON.stringify(reportData, null, 2));
    console.log(`\n💾 Report saved to: ${outputPath}`);
  }
}

// Main execution
async function main(): Promise<void> {
  const startTime = Date.now();
  
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const helpFlag = args.includes('--help') || args.includes('-h');
    
    if (helpFlag) {
      printUsage();
      return;
    }

    const options: Partial<DetectionOptions> = {};
    
    // Parse options
    const thresholdIndex = args.indexOf('--threshold');
    if (thresholdIndex !== -1 && args[thresholdIndex + 1]) {
      options.similarityThreshold = parseFloat(args[thresholdIndex + 1]);
    }
    
    const minLengthIndex = args.indexOf('--min-length');
    if (minLengthIndex !== -1 && args[minLengthIndex + 1]) {
      options.minMethodLength = parseInt(args[minLengthIndex + 1]);
    }
    
    const includePrivateFlag = args.includes('--include-private');
    if (includePrivateFlag) {
      options.includePrivateMethods = true;
    }
    
    const includeGettersSettersFlag = args.includes('--include-getters-setters');
    if (includeGettersSettersFlag) {
      options.includeGettersSetters = true;
    }

    // Get target directory (last non-option argument)
    let targetDir = process.cwd();
    for (let i = args.length - 1; i >= 0; i--) {
      if (!args[i].startsWith('-') && !args[i].match(/^\d+(\.\d+)?$/)) {
        targetDir = path.resolve(args[i]);
        break;
      }
    }
    
    console.log('🚀 Duplicate Method Detector');
    console.log(`⚙️ Configuration:`);
    console.log(`   Similarity Threshold: ${options.similarityThreshold || DEFAULT_OPTIONS.similarityThreshold}`);
    console.log(`   Minimum Method Length: ${options.minMethodLength || DEFAULT_OPTIONS.minMethodLength} lines`);
    console.log(`   Include Private Methods: ${options.includePrivateMethods ?? DEFAULT_OPTIONS.includePrivateMethods}`);
    console.log(`   Include Getters/Setters: ${options.includeGettersSetters ?? DEFAULT_OPTIONS.includeGettersSetters}`);
    
    // Run detection
    const detector = new DuplicateMethodDetector(options);
    const result = await detector.detectDuplicates(targetDir);
    
    // Generate report
    DuplicateMethodReporter.generateReport(result);
    
    // Save detailed report
    const reportsDir = path.join(process.cwd(), 'reports', 'quality');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().split('T')[0];
    const reportPath = path.join(reportsDir, `duplicate-methods-${timestamp}.json`);
    DuplicateMethodReporter.saveReportToFile(result, reportPath);
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`\n⏱️ Analysis completed in ${duration} seconds`);
    
    // Exit with appropriate code
    const hasDuplicates = result.exactDuplicates > 0 || result.similarDuplicates > 0;
    process.exit(hasDuplicates ? 1 : 0);
    
  } catch (error) {
    console.error('❌ Error during duplicate method detection:', error);
    process.exit(1);
  }
}

function printUsage(): void {
  console.log(`
🔍 Duplicate Method Detector

USAGE:
  npx tsx scripts/analysis/duplicate-method-detector.ts [OPTIONS] [DIRECTORY]

OPTIONS:
  --threshold <number>          Similarity threshold (0.0-1.0, default: 0.85)
  --min-length <number>         Minimum method length in lines (default: 3)
  --include-private             Include private methods in analysis
  --include-getters-setters     Include getter/setter methods
  --help, -h                    Show this help message

EXAMPLES:
  # Analyze current directory with default settings
  npx tsx scripts/analysis/duplicate-method-detector.ts
  
  # Analyze specific directory with custom threshold
  npx tsx scripts/analysis/duplicate-method-detector.ts --threshold 0.9 ./src
  
  # Include private methods and getters/setters
  npx tsx scripts/analysis/duplicate-method-detector.ts --include-private --include-getters-setters

OUTPUT:
  - Console report with detailed findings
  - JSON report saved to scripts/analysis/reports/quality/duplicate-methods-YYYY-MM-DD.json
  - Exit code 0 if no duplicates found, 1 if duplicates detected
`);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
