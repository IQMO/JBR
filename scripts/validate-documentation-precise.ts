#!/usr/bin/env node

/**
 * Improved Documentation Validation Script
 * More precise validation of documentation consistency
 */

import * as fs from 'fs';
import * as path from 'path';

// Expected values for consistency checking
interface ExpectedValues {
  version: string;
  lastUpdated: string;
  totalTasks: number;
  completedTasks: number;
  completionPercentage: number;
}

const EXPECTED_VALUES: ExpectedValues = {
  version: '1.0.0',
  lastUpdated: 'July 3, 2025',
  totalTasks: 37,
  completedTasks: 20,
  completionPercentage: 54
};

// Files to validate with specific checks
const VALIDATION_CONFIG: { [key: string]: string[] } = {
  'README.md': ['version', 'lastUpdated'],
  'PROJECT_STATUS.md': ['lastUpdated', 'taskCount', 'completionPercentage'],
  'PROJECT_STATUS_UPDATE.md': ['taskCount', 'completionPercentage'],
  'PRODUCTION_GUIDE.md': ['version', 'lastUpdated'],
  'CONFIGURATION_GUIDE.md': ['lastUpdated'],
  'docs/TASK_STATUS_REPORT.md': ['lastUpdated', 'taskCount', 'completionPercentage'],
  'packages/backend/tests/README.md': ['lastUpdated'],
  'packages/backend/tests/TESTING_GUIDELINES.md': ['lastUpdated']
};

class DocumentationValidator {
  private issues: string[] = [];
  private warnings: string[] = [];

  validateFile(filePath: string, checks: string[]): void {
    console.log(`Validating: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      this.issues.push(`File not found: ${filePath}`);
      return;
    }

    const content: string = fs.readFileSync(filePath, 'utf8');
    this.validateContent(filePath, content, checks);
  }

  private validateContent(filePath: string, content: string, checks: string[]): void {
    // Check version consistency
    if (checks.includes('version')) {
      const versionPattern: RegExp = /Version:?\s*([0-9]+\.[0-9]+\.[0-9]+)/gi;
      const matches: RegExpMatchArray | null = content.match(versionPattern);
      if (matches) {
        matches.forEach(match => {
          if (!match.includes(EXPECTED_VALUES.version)) {
            this.issues.push(`${filePath}: Version mismatch: ${match.trim()} (expected: ${EXPECTED_VALUES.version})`);
          }
        });
      }
    }

    // Check last updated dates
    if (checks.includes('lastUpdated')) {
      const datePattern: RegExp = /\*?Last Updated:?\*?\s*([A-Za-z]+ \d{1,2}, \d{4})/gi;
      const matches: RegExpMatchArray[] = [...content.matchAll(datePattern)];
      matches.forEach(match => {
        const dateFound: string = match[1].trim();
        if (dateFound !== EXPECTED_VALUES.lastUpdated) {
          this.issues.push(`${filePath}: Date mismatch: "Last Updated: ${dateFound}" (expected: ${EXPECTED_VALUES.lastUpdated})`);
        }
      });
    }

    // Check task count consistency
    if (checks.includes('taskCount')) {
      const taskPattern: RegExp = /(\d+)\s*of\s*(\d+)\s*(?:core\s+)?tasks?/gi;
      const matches: RegExpMatchArray[] = [...content.matchAll(taskPattern)];
      matches.forEach(match => {
        const completed: number = parseInt(match[1]);
        const total: number = parseInt(match[2]);
        
        if (completed !== EXPECTED_VALUES.completedTasks || total !== EXPECTED_VALUES.totalTasks) {
          this.issues.push(`${filePath}: Task count mismatch: ${match[0]} (expected: ${EXPECTED_VALUES.completedTasks} of ${EXPECTED_VALUES.totalTasks})`);
        }
      });
    }

    // Check completion percentage (exclude phase completion percentages)
    if (checks.includes('completionPercentage')) {
      // Look for overall project completion percentage, not phase completion
      const percentPattern: RegExp = /(\d+)%\s*(?:of\s+project\s+tasks?\s+|completion?\s+|\(|\s+Complete?\s*\)|complete?\s*\()/gi;
      const matches: RegExpMatchArray[] = [...content.matchAll(percentPattern)];
      matches.forEach(match => {
        const percentage: number = parseInt(match[1]);
        // Skip if this is clearly a phase completion (100%)
        if (percentage === 100 && match[0].includes('Complete)')) {
          return; // Skip phase completion percentages
        }
        if (percentage !== EXPECTED_VALUES.completionPercentage && percentage !== 100) {
          this.issues.push(`${filePath}: Completion percentage mismatch: ${match[0]} (expected: ${EXPECTED_VALUES.completionPercentage}%)`);
        }
      });
    }

    // Check for future dates (warning)
    if (content.includes('2026')) {
      this.warnings.push(`${filePath}: Contains future dates (2026) that should be reviewed`);
    }
  }

  generateReport(): boolean {
    console.log('\n=== DOCUMENTATION VALIDATION REPORT ===\n');

    if (this.issues.length === 0 && this.warnings.length === 0) {
      console.log('✅ All documentation appears consistent and valid!');
      console.log('\n📊 Validation Summary:');
      console.log(`  - Files checked: ${Object.keys(VALIDATION_CONFIG).length}`);
      console.log(`  - Expected version: ${EXPECTED_VALUES.version}`);
      console.log(`  - Expected last updated: ${EXPECTED_VALUES.lastUpdated}`);
      console.log(`  - Expected task completion: ${EXPECTED_VALUES.completedTasks}/${EXPECTED_VALUES.totalTasks} (${EXPECTED_VALUES.completionPercentage}%)`);
     return true;
   }

   if (this.issues.length > 0) {
     console.log(`❌ Found ${this.issues.length} critical issue(s):`);
     this.issues.forEach(issue => console.log(`  - ${issue}`));
     console.log('');
   }

   if (this.warnings.length > 0) {
     console.log(`⚠️  Found ${this.warnings.length} warning(s):`);
     this.warnings.forEach(warning => console.log(`  - ${warning}`));
     console.log('');
   }

   console.log('📊 Validation Summary:');
   console.log(`  - Files checked: ${Object.keys(VALIDATION_CONFIG).length}`);
   console.log(`  - Issues found: ${this.issues.length}`);
   console.log(`  - Warnings: ${this.warnings.length}`);
   
   return this.issues.length === 0;
 }

 validateAll(): boolean {
   console.log('Starting precise documentation validation...\n');
   
   Object.entries(VALIDATION_CONFIG).forEach(([file, checks]) => {
     this.validateFile(file, checks);
   });

   return this.generateReport();
 }
}

// Run validation
const validator = new DocumentationValidator();
const isValid: boolean = validator.validateAll();

// Exit with appropriate code
process.exit(isValid ? 0 : 1);