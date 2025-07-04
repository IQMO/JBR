#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

// Files that need object access fixes
const targetFiles: string[] = [
  'packages/backend/src/JabbrLabs/bot-orchestration/orchestration-manager.ts',
  'packages/backend/src/JabbrLabs/exchange-api/bybit/bybit-websocket.ts',
  'packages/backend/src/JabbrLabs/exchange-api/bybit/bybit-utils.ts',
  'packages/backend/src/JabbrLabs/bot-orchestration/cycle-executor.ts',
  'packages/backend/src/JabbrLabs/authentication/middleware.ts',
  'packages/backend/src/JabbrLabs/core/config-loader.ts',
  'packages/backend/src/JabbrLabs/core/strategy-factory.ts',
  'packages/backend/src/JabbrLabs/core/plugin-manager.ts',
  'packages/backend/src/JabbrLabs/monitoring/health-check.ts',
  'packages/backend/src/JabbrLabs/monitoring/strategy-monitor.ts',
  'packages/backend/src/JabbrLabs/exchange-api/bybit/bybit-auth.ts',
  'packages/backend/src/JabbrLabs/bot-orchestration/condition-checker.ts',
  'packages/backend/src/JabbrLabs/performance/performance-analyzer.ts',
  'packages/backend/src/JabbrLabs/exchange-api/bybit/bybit-api.ts',
  'packages/backend/src/JabbrLabs/reliability/recovery-service.ts',
  'packages/backend/src/JabbrLabs/metrics/metrics-collector.ts'
];

console.log('🔧 Fixing incorrect .at() usage in object property access...\n');

let totalFiles: number = 0;
let totalFixes: number = 0;

function isObjectPropertyAccess(line: string, matchStart: number): boolean {
  // Check context before the match to determine if it's object property access
  const beforeMatch: string = line.substring(0, matchStart);
  
  // Look for patterns that indicate object property access:
  // 1. obj.at(field) - where obj is not an array
  // 2. config.at(key) - configuration objects
  // 3. data.at(property) - data objects
  // 4. logger.at(level) - logger objects
  // 5. metadata.at(field) - metadata objects
  
  const objectPatterns: RegExp[] = [
    /\b(config|data|obj|object|metadata|options|params|settings|props)\s*\.\s*at\s*\(/,
    /\b[a-zA-Z_$][a-zA-Z0-9_$]*\s*\.\s*at\s*\(/
  ];
  
  return objectPatterns.some(pattern => pattern.test(beforeMatch + '.at('));
}

function fixObjectPropertyAccess(content: string): { content: string; fixes: number } {
  let fixes: number = 0;
  const lines: string[] = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line: string = lines[i];
    
    // Find .at( patterns
    const atMatches: RegExpMatchArray[] = [...line.matchAll(/\.at\s*\(/g)];
    
    for (const match of atMatches) {
      const matchStart: number = match.index!;
      
      if (isObjectPropertyAccess(line, matchStart)) {
        // Replace .at( with [
        const beforeAt: string = line.substring(0, matchStart);
        const afterAt: string = line.substring(matchStart + match[0].length);
        
        // Find the closing parenthesis
        let parenCount: number = 1;
        let endIndex: number = 0;
        
        for (let j = 0; j < afterAt.length; j++) {
          if (afterAt[j] === '(') parenCount++;
          else if (afterAt[j] === ')') {
            parenCount--;
            if (parenCount === 0) {
              endIndex = j;
              break;
            }
          }
        }
        
        if (endIndex > 0) {
          const propertyAccess: string = afterAt.substring(0, endIndex);
          const afterProperty: string = afterAt.substring(endIndex + 1);
          
          lines[i] = beforeAt + '[' + propertyAccess + ']' + afterProperty;
          fixes++;
        }
      }
    }
  }
  
  return { content: lines.join('\n'), fixes };
}

// Process each file
for (const filePath of targetFiles) {
  const fullPath: string = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    continue;
  }
  
  try {
    const content: string = fs.readFileSync(fullPath, 'utf8');
    const result = fixObjectPropertyAccess(content);
    
    if (result.fixes > 0) {
      fs.writeFileSync(fullPath, result.content, 'utf8');
      console.log(`✅ ${filePath}: Fixed ${result.fixes} object property access patterns`);
      totalFiles++;
      totalFixes += result.fixes;
    } else {
      console.log(`✓  ${filePath}: No object property access fixes needed`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, (error as Error).message);
  }
}

console.log(`\n🎯 Summary:`);
console.log(`   Files modified: ${totalFiles}`);
console.log(`   Total fixes applied: ${totalFixes}`);
console.log(`\n✨ Object property access patterns fixed!`);