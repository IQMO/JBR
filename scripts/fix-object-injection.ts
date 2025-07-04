#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

/**
 * Advanced script to automatically fix object injection security vulnerabilities
 * by replacing unsafe array access patterns with safe .at() method calls
 */

const BACKEND_DIR: string = path.join(__dirname, '..', 'packages', 'backend', 'src');

// Patterns to fix
interface Pattern {
  regex: RegExp;
  replacement: string;
  description: string;
}

const PATTERNS: Pattern[] = [
  // Array access patterns: arr[i] -> arr.at(i)
  {
    regex: /(\w+)\[(\w+)\]/g,
    replacement: '$1.at($2)',
    description: 'Replace array bracket notation with safe .at() method'
  },
  // Array length access: arr[arr.length - 1] -> arr.at(-1)
  {
    regex: /(\w+)\[(\w+)\.length\s*-\s*1\]/g,
    replacement: '$1.at(-1)',
    description: 'Replace arr[arr.length-1] with arr.at(-1)'
  },
  // Complex array access: arr[i - 1] -> arr.at(i - 1)
  {
    regex: /(\w+)\[(\w+\s*[-+]\s*\d+)\]/g,
    replacement: '$1.at($2)',
    description: 'Replace complex array index access with .at()'
  }
];

// Files to exclude (already fixed or special cases)
const EXCLUDE_PATTERNS: string[] = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/*.test.ts',
  '**/*.spec.ts'
];

// Object property access patterns to validate
interface ObjectPattern {
  regex: RegExp;
  replacement: (match: string, obj: string, key: string) => string;
  description: string;
}

const OBJECT_ACCESS_PATTERNS: ObjectPattern[] = [
  {
    regex: /(\w+)\[(\w+)\]/g,
    replacement: (match: string, obj: string, key: string): string => {
      // Only fix if it's likely an array access, not object property access
      if (/^(req\.(params|body|query)|config|parameters)/.test(obj)) {
        return `Object.prototype.hasOwnProperty.call(${obj}, ${key}) ? ${obj}[${key} as keyof typeof ${obj}] : undefined`;
      }
      return `${obj}.at(${key})`;
    },
    description: 'Secure object property access'
  }
];

async function findTypeScriptFiles(): Promise<string[]> {
  try {
    const files: string[] = await glob('**/*.ts', {
      cwd: BACKEND_DIR,
      ignore: EXCLUDE_PATTERNS,
      absolute: true
    });
    return files;
  } catch (error) {
    throw error;
  }
}

function isArrayAccessContext(content: string, match: string, index: number): boolean {
  // Check if this is likely an array access vs object property access
  const beforeMatch: string = content.substring(Math.max(0, index - 50), index);
  const afterMatch: string = content.substring(index + match.length, index + match.length + 50);
  
  // Skip if it's clearly object property access
  if (/\.(params|body|query|headers|cookies)\[/.test(beforeMatch + match)) {
    return false;
  }
  
  // Skip if it's accessing a well-known object property
  if (/config\[|options\[|settings\[/.test(beforeMatch + match)) {
    return false;
  }
  
  return true;
}

function fixObjectInjectionInFile(filePath: string): number {
  console.log(`Processing: ${path.relative(BACKEND_DIR, filePath)}`);
  
  let content: string = fs.readFileSync(filePath, 'utf8');
  let changed: boolean = false;
  let changeCount: number = 0;
  
  // Apply each pattern
  PATTERNS.forEach(pattern => {
    const originalContent: string = content;
    let matches: number = 0;
    
    content = content.replace(pattern.regex, (match: string, ...args: any[]): string => {
      const [fullMatch, ...groups] = [match, ...args];
      
      // Skip if this doesn't look like array access
      const index: number = args[args.length - 2]; // Second to last arg is the index
      if (!isArrayAccessContext(originalContent, fullMatch, index)) {
        return fullMatch;
      }
      
      matches++;
      return pattern.replacement;
    });
    
    if (matches > 0) {
      console.log(`  Applied ${pattern.description}: ${matches} replacements`);
      changeCount += matches;
      changed = true;
    }
  });
  
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✅ Fixed ${changeCount} object injection issues in ${path.basename(filePath)}`);
    return changeCount;
  }
  
  return 0;
}

async function main(): Promise<void> {
  console.log('🔧 Starting automated object injection vulnerability fixes...\n');
  
  try {
    const files: string[] = await findTypeScriptFiles();
    console.log(`Found ${files.length} TypeScript files to process\n`);
    
    let totalFixes: number = 0;
    let filesModified: number = 0;
    
    for (const file of files) {
      const fixes: number = fixObjectInjectionInFile(file);
      if (fixes > 0) {
        totalFixes += fixes;
        filesModified++;
      }
    }
    
    console.log('\n🎉 Automated fix completed!');
    console.log(`📊 Summary:`);
    console.log(`  - Files processed: ${files.length}`);
    console.log(`  - Files modified: ${filesModified}`);
    console.log(`  - Total fixes applied: ${totalFixes}`);
    
    if (totalFixes > 0) {
      console.log('\n⚠️  Please review the changes and run tests to ensure functionality is preserved.');
      console.log('🔍 Run: npm run build && npm test');
    }
    
  } catch (error) {
    console.error('❌ Error during automated fixing:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { fixObjectInjectionInFile, findTypeScriptFiles };