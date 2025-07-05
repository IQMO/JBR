#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

/**
 * Naming Convention Validator
 * Enforces consistent naming conventions across the TypeScript codebase
 * Part of Task 53.5 - Implement Naming Validation Scripts
 */

interface NamingRule {
  id: string;
  name: string;
  pattern: RegExp;
  description: string;
  severity: 'error' | 'warning';
  applies: (element: CodeElement) => boolean;
}

interface CodeElement {
  type: 'variable' | 'function' | 'class' | 'interface' | 'enum' | 'type' | 'property' | 'method' | 'parameter';
  name: string;
  file: string;
  line: number;
  context?: string;
}

interface NamingViolation {
  rule: NamingRule;
  element: CodeElement;
  message: string;
  suggestion?: string;
}

interface NamingReport {
  timestamp: string;
  project: string;
  task: string;
  summary: {
    filesScanned: number;
    elementsChecked: number;
    violations: number;
    errors: number;
    warnings: number;
  };
  violations: NamingViolation[];
  overallStatus: 'PASS' | 'FAIL' | 'WARNING';
}

class NamingConventionValidator {
  private projectRoot: string;
  private reportDir: string;
  private timestamp: string;
  private rules: NamingRule[];

  constructor() {
    this.projectRoot = process.cwd();
    this.reportDir = path.join(this.projectRoot, 'scripts', 'analysis', 'reports', 'quality');
    this.timestamp = new Date().toISOString().split('T')[0];
    
    // Ensure reports directory exists
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }

    this.rules = this.defineNamingRules();
  }

  /**
   * Define naming convention rules
   */
  private defineNamingRules(): NamingRule[] {
    return [
      {
        id: 'camelCase-variables',
        name: 'Variable camelCase',
        pattern: /^[a-z][a-zA-Z0-9]*$/,
        description: 'Variables should use camelCase naming',
        severity: 'error',
        applies: (element) => element.type === 'variable' && !element.name.startsWith('_')
      },
      {
        id: 'camelCase-functions',
        name: 'Function camelCase', 
        pattern: /^[a-z][a-zA-Z0-9]*$/,
        description: 'Functions should use camelCase naming',
        severity: 'error',
        applies: (element) => element.type === 'function'
      },
      {
        id: 'PascalCase-classes',
        name: 'Class PascalCase',
        pattern: /^[A-Z][a-zA-Z0-9]*$/,
        description: 'Classes should use PascalCase naming',
        severity: 'error',
        applies: (element) => element.type === 'class'
      },
      {
        id: 'PascalCase-interfaces',
        name: 'Interface PascalCase',
        pattern: /^I?[A-Z][a-zA-Z0-9]*$/,
        description: 'Interfaces should use PascalCase naming (optionally prefixed with I)',
        severity: 'error',
        applies: (element) => element.type === 'interface'
      },
      {
        id: 'PascalCase-types',
        name: 'Type PascalCase',
        pattern: /^[A-Z][a-zA-Z0-9]*$/,
        description: 'Type aliases should use PascalCase naming',
        severity: 'error',
        applies: (element) => element.type === 'type'
      },
      {
        id: 'UPPER_SNAKE_CASE-enums',
        name: 'Enum UPPER_SNAKE_CASE',
        pattern: /^[A-Z][A-Z0-9_]*$/,
        description: 'Enum values should use UPPER_SNAKE_CASE naming',
        severity: 'warning',
        applies: (element) => element.type === 'enum'
      },
      {
        id: 'camelCase-methods',
        name: 'Method camelCase',
        pattern: /^[a-z][a-zA-Z0-9]*$/,
        description: 'Methods should use camelCase naming',
        severity: 'error',
        applies: (element) => element.type === 'method'
      },
      {
        id: 'camelCase-properties',
        name: 'Property camelCase',
        pattern: /^[a-z][a-zA-Z0-9]*$/,
        description: 'Properties should use camelCase naming',
        severity: 'warning',
        applies: (element) => element.type === 'property' && !element.name.startsWith('_')
      }
    ];
  }

  /**
   * Parse TypeScript file and extract code elements
   */
  private parseCodeElements(filePath: string): CodeElement[] {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      const elements: CodeElement[] = [];
      const relativePath = path.relative(this.projectRoot, filePath);

      // Extract variables (const, let, var)
      const variableRegex = /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
      let match;
      while ((match = variableRegex.exec(content)) !== null) {
        const lineNumber = this.getLineNumber(content, match.index);
        elements.push({
          type: 'variable',
          name: match[1],
          file: relativePath,
          line: lineNumber,
          context: lines[lineNumber - 1]?.trim()
        });
      }

      // Extract functions
      const functionRegex = /(?:function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|(?:const|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>)/g;
      while ((match = functionRegex.exec(content)) !== null) {
        const funcName = match[1] || match[2];
        if (funcName) {
          const lineNumber = this.getLineNumber(content, match.index);
          elements.push({
            type: 'function',
            name: funcName,
            file: relativePath,
            line: lineNumber,
            context: lines[lineNumber - 1]?.trim()
          });
        }
      }

      // Extract classes
      const classRegex = /class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
      while ((match = classRegex.exec(content)) !== null) {
        const lineNumber = this.getLineNumber(content, match.index);
        elements.push({
          type: 'class',
          name: match[1],
          file: relativePath,
          line: lineNumber,
          context: lines[lineNumber - 1]?.trim()
        });
      }

      // Extract interfaces
      const interfaceRegex = /interface\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
      while ((match = interfaceRegex.exec(content)) !== null) {
        const lineNumber = this.getLineNumber(content, match.index);
        elements.push({
          type: 'interface',
          name: match[1],
          file: relativePath,
          line: lineNumber,
          context: lines[lineNumber - 1]?.trim()
        });
      }

      // Extract type aliases
      const typeRegex = /type\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
      while ((match = typeRegex.exec(content)) !== null) {
        const lineNumber = this.getLineNumber(content, match.index);
        elements.push({
          type: 'type',
          name: match[1],
          file: relativePath,
          line: lineNumber,
          context: lines[lineNumber - 1]?.trim()
        });
      }

      // Extract enum values
      const enumRegex = /enum\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*\{([^}]+)\}/g;
      while ((match = enumRegex.exec(content)) !== null) {
        const enumBody = match[1];
        const enumValueRegex = /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:=|,|\})/g;
        let enumMatch;
        while ((enumMatch = enumValueRegex.exec(enumBody)) !== null) {
          const lineNumber = this.getLineNumber(content, match.index + enumMatch.index);
          elements.push({
            type: 'enum',
            name: enumMatch[1],
            file: relativePath,
            line: lineNumber,
            context: lines[lineNumber - 1]?.trim()
          });
        }
      }

      // Extract methods (within classes)
      const methodRegex = /(?:public|private|protected)?\s*(?:static\s+)?(?:async\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/g;
      while ((match = methodRegex.exec(content)) !== null) {
        const lineNumber = this.getLineNumber(content, match.index);
        // Only count as method if inside a class
        if (this.isInsideClass(content, match.index)) {
          elements.push({
            type: 'method',
            name: match[1],
            file: relativePath,
            line: lineNumber,
            context: lines[lineNumber - 1]?.trim()
          });
        }
      }

      return elements;
    } catch (error) {
      console.warn(`⚠️  Could not parse file: ${filePath}`);
      return [];
    }
  }

  /**
   * Get line number from character index
   */
  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * Check if position is inside a class definition
   */
  private isInsideClass(content: string, index: number): boolean {
    const beforeIndex = content.substring(0, index);
    const classMatches = beforeIndex.match(/class\s+[a-zA-Z_$][a-zA-Z0-9_$]*/g) || [];
    const braceMatches = beforeIndex.match(/[{}]/g) || [];
    
    let braceCount = 0;
    let inClass = false;
    
    for (const brace of braceMatches) {
      if (brace === '{') {
        braceCount++;
        if (classMatches.length > 0 && braceCount === 1) {
          inClass = true;
        }
      } else {
        braceCount--;
        if (braceCount === 0) {
          inClass = false;
        }
      }
    }
    
    return inClass;
  }

  /**
   * Get all source files recursively
   */
  private getSourceFiles(dirs: string[], extensions: string[] = ['.ts', '.tsx']): string[] {
    const files: string[] = [];
    
    const scanDirectory = (currentDir: string) => {
      if (!fs.existsSync(currentDir)) return;
      
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
    
    for (const dir of dirs) {
      scanDirectory(dir);
    }
    return files;
  }

  /**
   * Validate naming conventions
   */
  async validate(): Promise<NamingReport> {
    console.log('🚀 Starting naming convention validation...');
    console.log('📁 Project:', this.projectRoot);
    console.log('');

    const sourceFiles = this.getSourceFiles([
      path.join(this.projectRoot, 'packages'),
      path.join(this.projectRoot, 'scripts')
    ]);

    console.log(`📋 Scanning ${sourceFiles.length} TypeScript files...`);

    const violations: NamingViolation[] = [];
    let totalElements = 0;

    for (const file of sourceFiles) {
      console.log(`🔍 Analyzing: ${path.relative(this.projectRoot, file)}`);
      const elements = this.parseCodeElements(file);
      totalElements += elements.length;

      for (const element of elements) {
        for (const rule of this.rules) {
          if (rule.applies(element) && !rule.pattern.test(element.name)) {
            violations.push({
              rule,
              element,
              message: `${rule.description}: "${element.name}" violates ${rule.name}`,
              suggestion: this.generateSuggestion(element.name, rule)
            });
          }
        }
      }
    }

    const errors = violations.filter(v => v.rule.severity === 'error').length;
    const warnings = violations.filter(v => v.rule.severity === 'warning').length;
    const overallStatus = errors > 0 ? 'FAIL' : warnings > 0 ? 'WARNING' : 'PASS';

    const report: NamingReport = {
      timestamp: new Date().toISOString(),
      project: 'JBR Trading Platform',
      task: 'Task 53.5 - Naming Convention Validation',
      summary: {
        filesScanned: sourceFiles.length,
        elementsChecked: totalElements,
        violations: violations.length,
        errors,
        warnings
      },
      violations,
      overallStatus
    };

    // Save report
    const reportPath = path.join(this.reportDir, `naming-validation-${this.timestamp}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Display summary
    console.log('');
    console.log('🎯 NAMING CONVENTION VALIDATION SUMMARY:');
    console.log(`📊 Overall Status: ${overallStatus}`);
    console.log(`📁 Files Scanned: ${sourceFiles.length}`);
    console.log(`🔍 Elements Checked: ${totalElements}`);
    console.log(`❌ Violations Found: ${violations.length}`);
    console.log(`🚨 Errors: ${errors}`);
    console.log(`⚠️  Warnings: ${warnings}`);
    console.log('');

    if (violations.length > 0) {
      console.log('❌ NAMING VIOLATIONS:');
      // Group violations by file
      const violationsByFile = new Map<string, NamingViolation[]>();
      for (const violation of violations) {
        const file = violation.element.file;
        if (!violationsByFile.has(file)) {
          violationsByFile.set(file, []);
        }
        violationsByFile.get(file)!.push(violation);
      }

      for (const [file, fileViolations] of violationsByFile.entries()) {
        console.log(`📄 ${file}:`);
        for (const violation of fileViolations.slice(0, 5)) { // Limit output
          const severity = violation.rule.severity === 'error' ? '❌' : '⚠️ ';
          console.log(`   ${severity} Line ${violation.element.line}: ${violation.message}`);
          if (violation.suggestion) {
            console.log(`     💡 Suggestion: ${violation.suggestion}`);
          }
        }
        if (fileViolations.length > 5) {
          console.log(`     ... and ${fileViolations.length - 5} more violations`);
        }
        console.log('');
      }
    }

    console.log(`📋 Full report saved: ${reportPath}`);
    return report;
  }

  /**
   * Generate naming suggestion based on rule
   */
  private generateSuggestion(name: string, rule: NamingRule): string {
    switch (rule.id) {
      case 'camelCase-variables':
      case 'camelCase-functions':
      case 'camelCase-methods':
      case 'camelCase-properties':
        return this.toCamelCase(name);
      case 'PascalCase-classes':
      case 'PascalCase-interfaces':
      case 'PascalCase-types':
        return this.toPascalCase(name);
      case 'UPPER_SNAKE_CASE-enums':
        return this.toUpperSnakeCase(name);
      default:
        return 'Follow the naming convention for this element type';
    }
  }

  /**
   * Convert string to camelCase
   */
  private toCamelCase(str: string): string {
    return str
      .replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '')
      .replace(/^[A-Z]/, char => char.toLowerCase());
  }

  /**
   * Convert string to PascalCase
   */
  private toPascalCase(str: string): string {
    return str
      .replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '')
      .replace(/^[a-z]/, char => char.toUpperCase());
  }

  /**
   * Convert string to UPPER_SNAKE_CASE
   */
  private toUpperSnakeCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[-\s]+/g, '_')
      .toUpperCase();
  }
}

// Run validation if called directly
async function main() {
  const validator = new NamingConventionValidator();
  try {
    const report = await validator.validate();
    process.exit(report.overallStatus === 'FAIL' ? 1 : 0);
  } catch (error: any) {
    console.error('❌ Naming validation failed:', error.message);
    process.exit(1);
  }
}

// Execute if this file is run directly
if (require.main === module || process.argv[1] === __filename) {
  main();
}

export { NamingConventionValidator, NamingReport, NamingViolation, NamingRule };
