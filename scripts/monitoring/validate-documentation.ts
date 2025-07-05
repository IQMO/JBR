#!/usr/bin/env node

/**
 * Documentation Validation Script
 * Validates consistency across all project documentation files
 */

import * as fs from 'fs';
import * as path from 'path';

// Expected values for consistency checking
interface ExpectedValues {
  version: string;
  lastUpdated: string;
  totalTasks: number;
  completedTasks: number;
  completionPercentage: string;
}

const EXPECTED_VALUES: ExpectedValues = {  // check mcp get_tasks actuall tasks etc.
  version: '1.0.0',
  lastUpdated: 'July 3, 2025',
  totalTasks: 37,
  completedTasks: 20,
  completionPercentage: '54%'
};

// Files to validate
const DOCS_TO_VALIDATE: string[] = [
  'README.md',
  'PROJECT_STATUS.md', 
  'PROJECT_STATUS_UPDATE.md',
  'PRODUCTION_GUIDE.md',
  'CONFIGURATION_GUIDE.md',
  'docs/TASK_STATUS_REPORT.md',
  'docs/DOCUMENTATION_MAINTENANCE.md',
  'packages/backend/tests/README.md',
  'packages/backend/tests/TESTING_GUIDELINES.md'
];

class DocumentationValidator {
  private issues: string[] = [];
  private warnings: string[] = [];

  validateFile(filePath: string): void {
    console.log(`Validating: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      this.issues.push(`File not found: ${filePath}`);
      return;
    }

    const content: string = fs.readFileSync(filePath, 'utf8');
    this.validateContent(filePath, content);
  }

  private validateContent(filePath: string, content: string): void {
    // Check for version consistency
    const versionMatches: RegExpMatchArray | null = content.match(/Version:?\s*([^\s\n]+)/gi);
    if (versionMatches) {
      versionMatches.forEach(match => {
        if (!match.includes(EXPECTED_VALUES.version)) {
          this.issues.push(`${filePath}: Inconsistent version found: ${match}`);
        }
      });
    }

    // Check for date consistency
    const dateMatches: RegExpMatchArray | null = content.match(/Last Updated:?\s*([^\n]+)/gi);
    if (dateMatches) {
      dateMatches.forEach(match => {
        if (!match.includes(EXPECTED_VALUES.lastUpdated)) {
          this.issues.push(`${filePath}: Inconsistent date found: ${match}`);
        }
      });
    }

    // Check for task completion consistency
    const taskMatches: RegExpMatchArray | null = content.match(/(\d+)\s*of\s*(\d+)\s*tasks?/gi);
    if (taskMatches) {
      taskMatches.forEach(match => {
        const numbers: RegExpMatchArray | null = match.match(/(\d+)/g);
        if (numbers && numbers.length >= 2) {
          const completed: number = parseInt(numbers[0]);
          const total: number = parseInt(numbers[1]);
          
          if (completed !== EXPECTED_VALUES.completedTasks || total !== EXPECTED_VALUES.totalTasks) {
            this.issues.push(`${filePath}: Inconsistent task count: ${match} (expected: ${EXPECTED_VALUES.completedTasks} of ${EXPECTED_VALUES.totalTasks})`);
          }
        }
      });
    }

    // Check for completion percentage consistency
    const percentMatches: RegExpMatchArray | null = content.match(/(\d+)%\s*complet/gi);
    if (percentMatches) {
      percentMatches.forEach(match => {
        if (!match.includes('54%')) {
          this.issues.push(`${filePath}: Inconsistent completion percentage: ${match} (expected: 54%)`);
        }
      });
    }

    // Check for future dates (warning)
    if (content.includes('2026') || content.includes('January 2025')) {
      this.warnings.push(`${filePath}: Contains future dates that may need review`);
    }

    // Check for broken links (basic check)
    const linkMatches: RegExpMatchArray | null = content.match(/\[([^\]]+)\]\(([^)]+)\)/g);
    if (linkMatches) {
      linkMatches.forEach(link => {
        const urlMatch: RegExpMatchArray | null = link.match(/\]\(([^)]+)\)/);
        if (urlMatch) {
          const url: string = urlMatch[1];
          if (url.startsWith('./') || url.startsWith('../') || !url.startsWith('http')) {
            const linkPath: string = path.resolve(path.dirname(filePath), url);
            if (!fs.existsSync(linkPath)) {
              this.warnings.push(`${filePath}: Potentially broken link: ${url}`);
            }
          }
        }
      });
    }
  }

  generateReport(): boolean {
    console.log('\n=== DOCUMENTATION VALIDATION REPORT ===\n');

    if (this.issues.length === 0 && this.warnings.length === 0) {
      console.log('✅ All documentation appears consistent and valid!');
      return true;
    }

    if (this.issues.length > 0) {
      console.log(`❌ Found ${this.issues.length} issue(s):`);
      this.issues.forEach(issue => console.log(`  - ${issue}`));
      console.log('');
    }

    if (this.warnings.length > 0) {
      console.log(`⚠️  Found ${this.warnings.length} warning(s):`);
      this.warnings.forEach(warning => console.log(`  - ${warning}`));
      console.log('');
    }

    return this.issues.length === 0;
  }

  validateAll(): boolean {
    console.log('Starting documentation validation...\n');
    
    DOCS_TO_VALIDATE.forEach(file => {
      this.validateFile(file);
    });

    return this.generateReport();
  }
}

// Run validation
const validator = new DocumentationValidator();
const isValid: boolean = validator.validateAll();

// Exit with appropriate code
process.exit(isValid ? 0 : 1);