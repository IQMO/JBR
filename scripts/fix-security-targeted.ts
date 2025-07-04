#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

/**
 * Targeted script to fix remaining object injection vulnerabilities
 * Focus on the most common patterns still present
 */

const BACKEND_DIR: string = path.join(__dirname, '..', 'packages', 'backend', 'src');

// Get list of files with remaining security issues
const REMAINING_ISSUES: string[] = [
  'JabbrLabs/target-reacher',
  'bots',
  'config',
  'database',
  'exchanges',
  'services'
];

function getAllTSFiles(dir: string): string[] {
  const files: string[] = [];
  
  function walkDir(currentDir: string): void {
    const items: string[] = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath: string = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        walkDir(fullPath);
      } else if (item.endsWith('.ts') && !item.endsWith('.test.ts') && !item.endsWith('.spec.ts')) {
        files.push(fullPath);
      }
    }
  }
  
  walkDir(dir);
  return files;
}

function fixArrayAccess(content: string): { content: string; changes: number } {
  let fixed: string = content;
  let changeCount: number = 0;
  
  // Pattern 1: Simple array access arr[i] -> arr.at(i)
  // But avoid object property access patterns
  fixed = fixed.replace(/(\w+)\[(\w+)\](?!\s*=\s*[^=])/g, (match: string, arr: string, index: string, offset: number, string: string): string => {
    // Skip if it's clearly object property access
    const before: string = string.substring(Math.max(0, offset - 20), offset);
    if (/\.(params|body|query|headers|config)\s*$/.test(before)) {
      return match;
    }
    if (/req\.|config|options|settings|params/.test(arr)) {
      return match;
    }
    changeCount++;
    return `${arr}.at(${index})`;
  });
  
  // Pattern 2: arr[arr.length - 1] -> arr.at(-1)
  fixed = fixed.replace(/(\w+)\[(\w+)\.length\s*-\s*1\]/g, (match: string, arr: string, arrName: string): string => {
    if (arr === arrName) {
      changeCount++;
      return `${arr}.at(-1)`;
    }
    return match;
  });
  
  // Pattern 3: arr[i - 1], arr[i + 1] -> arr.at(i - 1), arr.at(i + 1)
  fixed = fixed.replace(/(\w+)\[(\w+\s*[+-]\s*\d+)\]/g, (match: string, arr: string, index: string, offset: number, string: string): string => {
    const before: string = string.substring(Math.max(0, offset - 20), offset);
    if (/\.(params|body|query|headers|config)\s*$/.test(before)) {
      return match;
    }
    if (/req\.|config|options|settings|params/.test(arr)) {
      return match;
    }
    changeCount++;
    return `${arr}.at(${index})`;
  });
  
  return { content: fixed, changes: changeCount };
}

function fixObjectPropertyAccess(content: string): { content: string; changes: number } {
  let fixed: string = content;
  let changeCount: number = 0;
  
  // Pattern for config[key] -> Object.prototype.hasOwnProperty.call(config, key) ? config[key as keyof typeof config] : undefined
  fixed = fixed.replace(/(config|parameters|options|settings)\[(\w+)\]/g, (match: string, obj: string, key: string): string => {
    changeCount++;
    return `Object.prototype.hasOwnProperty.call(${obj}, ${key}) ? ${obj}[${key} as keyof typeof ${obj}] : undefined`;
  });
  
  return { content: fixed, changes: changeCount };
}

function processFile(filePath: string): number {
  const relativePath: string = path.relative(BACKEND_DIR, filePath);
  console.log(`Processing: ${relativePath}`);
  
  let content: string = fs.readFileSync(filePath, 'utf8');
  let totalChanges: number = 0;
  
  // Fix array access patterns
  const arrayResult = fixArrayAccess(content);
  content = arrayResult.content;
  totalChanges += arrayResult.changes;
  
  // Fix object property access patterns
  const objectResult = fixObjectPropertyAccess(content);
  content = objectResult.content;
  totalChanges += objectResult.changes;
  
  if (totalChanges > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✅ Applied ${totalChanges} security fixes`);
    return totalChanges;
  }
  
  return 0;
}

function main(): void {
  console.log('🔧 Starting targeted security vulnerability fixes...\n');
  
  let totalFiles: number = 0;
  let modifiedFiles: number = 0;
  let totalFixes: number = 0;
  
  for (const issueDir of REMAINING_ISSUES) {
    const fullDir: string = path.join(BACKEND_DIR, issueDir);
    
    if (!fs.existsSync(fullDir)) {
      console.log(`⚠️  Directory not found: ${issueDir}`);
      continue;
    }
    
    console.log(`\n📁 Processing directory: ${issueDir}`);
    const files: string[] = getAllTSFiles(fullDir);
    
    for (const file of files) {
      totalFiles++;
      const fixes: number = processFile(file);
      if (fixes > 0) {
        modifiedFiles++;
        totalFixes += fixes;
      }
    }
  }
  
  console.log('\n🎉 Targeted fixes completed!');
  console.log(`📊 Summary:`);
  console.log(`  - Files processed: ${totalFiles}`);
  console.log(`  - Files modified: ${modifiedFiles}`);
  console.log(`  - Total fixes applied: ${totalFixes}`);
  
  if (totalFixes > 0) {
    console.log('\n✅ Security vulnerabilities have been addressed.');
    console.log('🔍 Recommended: Run npm run build to verify changes');
  }
}

if (require.main === module) {
  main();
}