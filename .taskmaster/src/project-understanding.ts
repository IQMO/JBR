/**
 * Project Understanding Module for TaskMaster
 * Helps AI agents understand project structure and context
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative, extname, basename } from 'path';
import { UnifiedProjectAnalyzer } from './unified-analyzer';
import { AIProjectAnalyzer } from './ai-project-analyzer';
import { AIReportGenerator } from './ai-report-generator';

export interface ProjectUnderstanding {
  projectRoot: string;
  projectName: string;
  timestamp: string;
  overview: {
    description: string;
    architecture: string;
    technologies: string[];
    structure: ProjectStructure;
  };
  codebase: {
    totalFiles: number;
    totalLines: number;
    languages: { [key: string]: number };
    mainDirectories: DirectoryInfo[];
  };
  context: {
    packageType: string;
    mainPurpose: string;
    keyComponents: string[];
    entryPoints: string[];
    configFiles: string[];
  };
  aiContext: {
    workflowSummary: string;
    keyFiles: string[];
    commonPatterns: string[];
    nextSteps: string[];
  };
}

export interface ProjectStructure {
  type: 'monorepo' | 'single-package' | 'multi-service';
  packages: PackageInfo[];
  rootFiles: string[];
}

export interface PackageInfo {
  name: string;
  path: string;
  type: string;
  technologies: string[];
  mainFiles: string[];
}

export interface DirectoryInfo {
  name: string;
  path: string;
  fileCount: number;
  purpose: string;
}

export class ProjectUnderstandingService {
  private projectRoot: string;
  private analyzer: UnifiedProjectAnalyzer;
  private aiAnalyzer: AIProjectAnalyzer;
  private reportGenerator: AIReportGenerator;
  private projectFiles: string[] = [];

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.analyzer = new UnifiedProjectAnalyzer(projectRoot);
    this.aiAnalyzer = new AIProjectAnalyzer(projectRoot);
    this.reportGenerator = new AIReportGenerator();
  }

  /**
   * Generate AI-powered comprehensive analysis with insights and recommendations
   */
  public async generateAIAnalysis(): Promise<string> {
    console.log('🧠 Starting AI-powered project analysis...');

    // First generate basic understanding
    const understanding = await this.generateUnderstanding();

    // Then perform AI analysis
    const aiAnalysis = await this.aiAnalyzer.analyzeProject(understanding);

    // Generate comprehensive report
    const report = this.reportGenerator.generateMarkdownReport(aiAnalysis);

    console.log('✅ AI analysis complete!');
    console.log(`📊 Analysis Summary:`);
    console.log(`   Code Quality: ${aiAnalysis.codeQuality.overallScore}/100`);
    console.log(`   Issues Found: ${aiAnalysis.issues.length}`);
    console.log(`   Recommendations: ${aiAnalysis.recommendations.length}`);

    return report;
  }

  /**
   * Scan project files and cache the result
   */
  private async scanProjectFiles(): Promise<string[]> {
    if (this.projectFiles.length > 0) {
      return this.projectFiles;
    }

    const files: string[] = [];
    const excludePatterns = [
      'node_modules',
      '.git',
      'dist',
      'build',
      'coverage',
      '.next',
      '.nuxt',
      'vendor',
      '__pycache__',
      '.pytest_cache'
    ];

    const scanDirectory = (dirPath: string) => {
      try {
        const items = readdirSync(dirPath, { withFileTypes: true });
        
        for (const item of items) {
          const fullPath = join(dirPath, item.name);
          const relativePath = relative(this.projectRoot, fullPath);
          
          // Skip excluded directories
          if (excludePatterns.some(pattern => relativePath.includes(pattern))) {
            continue;
          }
          
          if (item.isDirectory()) {
            scanDirectory(fullPath);
          } else if (item.isFile()) {
            const stats = statSync(fullPath);
            if (stats.size < 1024 * 1024) { // Skip files larger than 1MB
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    scanDirectory(this.projectRoot);
    this.projectFiles = files;
    return files;
  }

  /**
   * Generate comprehensive project understanding for AI agents
   */
  public async generateUnderstanding(): Promise<ProjectUnderstanding> {
    console.log('🔍 Analyzing project for AI agent understanding...');

    // Run the unified analyzer with correct method name
    const analysis = await this.analyzer.runCompleteAnalysis({ 
      depth: 'comprehensive',
      includeCache: true 
    });

    // Scan project files to get additional data the analyzer doesn't provide
    const files = await this.scanProjectFiles();
    
    // Calculate total lines by reading files
    let totalLines = 0;
    const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.c', '.cpp', '.h', '.cs', '.php', '.rb', '.go', '.rs', '.kt'];
    
    for (const file of files) {
      const ext = extname(file).toLowerCase();
      if (codeExtensions.includes(ext)) {
        try {
          const content = readFileSync(file, 'utf-8');
          totalLines += content.split('\n').length;
        } catch (error) {
          // Skip files we can't read
        }
      }
    }

    // Extract key information for AI context
    const understanding: ProjectUnderstanding = {
      projectRoot: this.projectRoot,
      projectName: this.getProjectName(),
      timestamp: new Date().toISOString(),
      overview: {
        description: this.generateProjectDescription(analysis),
        architecture: this.describeArchitecture(analysis),
        technologies: this.extractTechnologies(analysis),
        structure: this.analyzeStructure(analysis, files)
      },
      codebase: {
        totalFiles: analysis.metrics?.project?.totalFiles || files.length,
        totalLines: totalLines,
        languages: analysis.metrics?.project?.languages || {},
        mainDirectories: this.getMainDirectories(analysis, files)
      },
      context: {
        packageType: this.determinePackageType(analysis),
        mainPurpose: this.determinePurpose(analysis),
        keyComponents: this.extractKeyComponents(analysis, files),
        entryPoints: this.findEntryPoints(analysis, files),
        configFiles: this.findConfigFiles(analysis, files)
      },
      aiContext: {
        workflowSummary: this.generateWorkflowSummary(analysis),
        keyFiles: this.identifyKeyFiles(analysis, files),
        commonPatterns: this.identifyPatterns(analysis),
        nextSteps: this.suggestNextSteps(analysis)
      }
    };

    return understanding;
  }

  /**
   * Save understanding to TaskMaster's understanding directory
   */
  public async saveUnderstanding(understanding: ProjectUnderstanding): Promise<string> {
    const outputPath = join(this.projectRoot, '.taskmaster', 'understanding', 'project-context.json');
    
    // Ensure directory exists
    const dir = dirname(outputPath);
    if (!existsSync(dir)) {
      const fs = require('fs');
      fs.mkdirSync(dir, { recursive: true });
    }

    // Save understanding
    writeFileSync(outputPath, JSON.stringify(understanding, null, 2));
    
    console.log(`✅ Project understanding saved to: ${relative(this.projectRoot, outputPath)}`);
    return outputPath;
  }

  /**
   * Load existing understanding if available
   */
  public loadExistingUnderstanding(): ProjectUnderstanding | null {
    const path = join(this.projectRoot, '.taskmaster', 'understanding', 'project-context.json');
    
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, 'utf-8');
        return JSON.parse(content);
      } catch (error) {
        console.warn('⚠️ Could not load existing understanding:', error);
      }
    }
    
    return null;
  }

  /**
   * Generate a concise summary for AI agents
   */
  public generateAISummary(understanding: ProjectUnderstanding): string {
    return `# ${understanding.projectName} - Project Context

## Overview
${understanding.overview.description}

## Architecture
${understanding.overview.architecture}

## Key Technologies
${understanding.overview.technologies.join(', ')}

## Project Structure
- **Type**: ${understanding.context.packageType}
- **Purpose**: ${understanding.context.mainPurpose}
- **Total Files**: ${understanding.codebase.totalFiles}
- **Main Languages**: ${Object.keys(understanding.codebase.languages).join(', ')}

## Key Components
${understanding.context.keyComponents.map(c => `- ${c}`).join('\n')}

## Entry Points
${understanding.context.entryPoints.map(e => `- ${e}`).join('\n')}

## Workflow Summary
${understanding.aiContext.workflowSummary}

## Important Files to Know
${understanding.aiContext.keyFiles.map(f => `- ${f}`).join('\n')}

## Common Patterns
${understanding.aiContext.commonPatterns.map(p => `- ${p}`).join('\n')}

---
*Generated: ${understanding.timestamp}*
*Use this context to understand the project structure and help with development tasks.*`;
  }

  // Private helper methods
  private getProjectName(): string {
    try {
      const packageJson = join(this.projectRoot, 'package.json');
      if (existsSync(packageJson)) {
        const pkg = JSON.parse(readFileSync(packageJson, 'utf-8'));
        return pkg.name || 'Unknown Project';
      }
    } catch (error) {
      // Ignore
    }
    
    return 'Unknown Project';
  }

  private generateProjectDescription(analysis: any): string {
    // Generate smart description based on analysis
    const frameworks = analysis.metrics?.project?.frameworks || [];
    const languages = analysis.metrics?.project?.languages || {};
    
    if (frameworks.includes('Next.js') && frameworks.includes('Express')) {
      return 'Full-stack TypeScript application with Next.js frontend and Express backend';
    } else if (frameworks.includes('Next.js')) {
      return 'Next.js React application with TypeScript';
    } else if (frameworks.includes('Express')) {
      return 'Express.js backend application with TypeScript';
    } else if (languages.TypeScript > 0) {
      return 'TypeScript-based application with modern development stack';
    }
    
    return 'Software development project';
  }

  private describeArchitecture(analysis: any): string {
    const { architecture } = analysis;
    
    if (architecture?.patterns?.includes('monorepo')) {
      return 'Monorepo architecture with multiple packages (backend, frontend, shared)';
    } else if (architecture?.patterns?.includes('microservices')) {
      return 'Microservices architecture with distributed services';
    } else if (architecture?.patterns?.includes('mvc')) {
      return 'Model-View-Controller (MVC) architecture pattern';
    }
    
    return 'Standard application architecture';
  }

  private extractTechnologies(analysis: any): string[] {
    const technologies = new Set<string>();
    
    // Add languages
    if (analysis.metrics?.project?.languages) {
      Object.keys(analysis.metrics.project.languages).forEach(lang => {
        technologies.add(lang);
      });
    }
    
    // Add frameworks
    if (analysis.metrics?.project?.frameworks) {
      analysis.metrics.project.frameworks.forEach((fw: string) => {
        technologies.add(fw);
      });
    }
    
    return Array.from(technologies);
  }

  private analyzeStructure(analysis: any, files: string[]): ProjectStructure {
    const { codebase } = analysis;
    
    // Determine if it's a monorepo
    const isMonorepo = codebase?.packages && codebase.packages.length > 1;
    
    return {
      type: isMonorepo ? 'monorepo' : 'single-package',
      packages: codebase?.packages || [],
      rootFiles: codebase?.rootFiles || []
    };
  }

  private getMainDirectories(analysis: any, files: string[]): DirectoryInfo[] {
    // Analyze directory structure from files
    const dirCounts: { [key: string]: number } = {};
    
    files.forEach(file => {
      const relativePath = relative(this.projectRoot, file);
      const parts = relativePath.split(/[/\\]/);
      
      // Count files in each directory (first level only for main directories)
      if (parts.length > 1) {
        const mainDir = parts[0];
        dirCounts[mainDir] = (dirCounts[mainDir] || 0) + 1;
      }
    });
    
    // Convert to DirectoryInfo objects and sort by file count
    return Object.entries(dirCounts)
      .filter(([dir, count]) => count > 3) // Only significant directories
      .sort(([, a], [, b]) => b - a) // Sort by file count descending
      .slice(0, 10) // Top 10
      .map(([dir, count]) => ({
        name: dir,
        path: dir,
        fileCount: count,
        purpose: this.guessPurpose(dir)
      }));
  }

  private guessPurpose(dirName: string): string {
    const purposes: { [key: string]: string } = {
      'src': 'Source code',
      'components': 'React components',
      'pages': 'Application pages',
      'api': 'API endpoints',
      'utils': 'Utility functions',
      'types': 'TypeScript type definitions',
      'styles': 'Styling files',
      'public': 'Static assets',
      'tests': 'Test files',
      'docs': 'Documentation',
      'config': 'Configuration files',
      'scripts': 'Build/utility scripts'
    };
    
    return purposes[dirName.toLowerCase()] || 'Application code';
  }

  private determinePackageType(analysis: any): string {
    const { codebase } = analysis;
    
    if (codebase?.packages?.length > 1) {
      return 'Monorepo with multiple packages';
    } else if (analysis.metrics?.project?.frameworks?.includes('Next.js')) {
      return 'Next.js application';
    } else if (analysis.metrics?.project?.frameworks?.includes('Express')) {
      return 'Express.js backend';
    }
    
    return 'Standard TypeScript project';
  }

  private determinePurpose(analysis: any): string {
    // Analyze package.json and file structure to determine purpose
    if (analysis.metrics?.project?.frameworks?.includes('trading')) {
      return 'Trading bot platform';
    } else if (analysis.metrics?.project?.frameworks?.includes('Next.js')) {
      return 'Web application';
    } else if (analysis.metrics?.project?.frameworks?.includes('Express')) {
      return 'Backend API service';
    }
    
    return 'Software application';
  }

  private extractKeyComponents(analysis: any, files: string[]): string[] {
    const components: string[] = [];
    
    // Extract from architecture analysis
    if (analysis.findings?.architectural?.components) {
      components.push(...analysis.findings.architectural.components.slice(0, 8));
    }
    
    // Add key directories as components
    const dirCounts: { [key: string]: number } = {};
    
    files.forEach(file => {
      const relativePath = relative(this.projectRoot, file);
      const parts = relativePath.split(/[/\\]/);
      
      if (parts.length > 1) {
        const mainDir = parts[0];
        dirCounts[mainDir] = (dirCounts[mainDir] || 0) + 1;
      }
    });
    
    // Add significant directories as components
    Object.entries(dirCounts)
      .filter(([dir, count]) => count > 5 && !['node_modules', '.git', 'dist', 'build'].includes(dir))
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .forEach(([dir]) => {
        if (!components.includes(dir)) {
          components.push(dir);
        }
      });
    
    // Add important package.json based components
    const packageJsonPath = join(this.projectRoot, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        if (pkg.scripts) {
          if (pkg.scripts.build) components.push('Build System');
          if (pkg.scripts.test) components.push('Test Suite');
          if (pkg.scripts.dev || pkg.scripts.start) components.push('Development Server');
        }
      } catch (error) {
        // Skip invalid package.json
      }
    }
    
    return components.slice(0, 10);
  }

  private findEntryPoints(analysis: any, files: string[]): string[] {
    const entryPoints: string[] = [];
    
    // Common entry point patterns
    const commonEntries = [
      'src/index.ts',
      'src/main.ts', 
      'src/app.ts',
      'pages/index.tsx',
      'app/page.tsx',
      'index.js',
      'main.js',
      'server.ts',
      'server.js'
    ];
    
    // Check which entry points exist in our files
    commonEntries.forEach(entry => {
      if (files.some(file => file.endsWith(entry) || relative(this.projectRoot, file) === entry)) {
        entryPoints.push(entry);
      }
    });
    
    // Also check package.json main field
    const packageJsonPath = join(this.projectRoot, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        if (pkg.main && !entryPoints.includes(pkg.main)) {
          entryPoints.push(pkg.main);
        }
      } catch (error) {
        // Skip invalid package.json
      }
    }
    
    return entryPoints;
  }

  private findConfigFiles(analysis: any, files: string[]): string[] {
    const configFiles: string[] = [];
    
    const configPatterns = [
      'package.json',
      'tsconfig.json',
      'next.config.js',
      'next.config.ts',
      '.env',
      '.env.local',
      'docker-compose.yml',
      'Dockerfile',
      'README.md',
      'jest.config.js',
      'jest.config.ts',
      'babel.config.json',
      '.gitignore'
    ];
    
    // Check which config files exist
    configPatterns.forEach(config => {
      if (files.some(file => basename(file) === config || file.endsWith(config))) {
        configFiles.push(config);
      }
    });
    
    return configFiles;
  }

  private generateWorkflowSummary(analysis: any): string {
    // Generate workflow summary based on project type
    if (analysis.metrics?.project?.frameworks?.includes('Next.js')) {
      return 'Next.js development workflow with TypeScript, component-based architecture, and API routes';
    } else if (analysis.metrics?.project?.frameworks?.includes('Express')) {
      return 'Express.js backend development with TypeScript, RESTful APIs, and middleware architecture';
    }
    
    return 'TypeScript development with modern tooling and build processes';
  }

  private identifyKeyFiles(analysis: any, files: string[]): string[] {
    const keyFiles: string[] = [];
    
    // Priority files for AI agents to understand
    const priorityPatterns = [
      'README.md',
      'package.json',
      'tsconfig.json',
      'src/index.ts',
      'src/app.ts',
      'src/main.ts',
      'pages/index.tsx',
      'server.ts',
      'app.js'
    ];
    
    // Find priority files that exist
    priorityPatterns.forEach(pattern => {
      const found = files.find(file => file.endsWith(pattern) || basename(file) === pattern);
      if (found) {
        keyFiles.push(relative(this.projectRoot, found));
      }
    });
    
    // Add some important TypeScript/JavaScript files
    const codeFiles = files
      .filter(file => {
        const ext = extname(file);
        return ['.ts', '.tsx', '.js', '.jsx'].includes(ext) && 
               !file.includes('node_modules') && 
               !file.includes('dist') && 
               !file.includes('build');
      })
      .map(file => relative(this.projectRoot, file))
      .slice(0, 5); // Top 5 code files
    
    keyFiles.push(...codeFiles);
    
    return [...new Set(keyFiles)].slice(0, 10); // Remove duplicates and limit
  }

  private identifyPatterns(analysis: any): string[] {
    const patterns: string[] = [];
    
    // Common patterns based on analysis
    if (analysis.architecture?.patterns) {
      patterns.push(...analysis.architecture.patterns);
    }
    
    // Add technology-specific patterns
    if (analysis.metrics?.project?.frameworks?.includes('TypeScript')) {
      patterns.push('Strong typing with TypeScript');
    }
    
    if (analysis.metrics?.project?.frameworks?.includes('Next.js')) {
      patterns.push('React component architecture', 'Server-side rendering');
    }
    
    if (analysis.metrics?.project?.frameworks?.includes('Express')) {
      patterns.push('RESTful API design', 'Middleware pattern');
    }
    
    return patterns.slice(0, 8);
  }

  private suggestNextSteps(analysis: any): string[] {
    const steps: string[] = [];
    
    // Generic helpful next steps for AI agents
    steps.push(
      'Review README.md for project setup instructions',
      'Check package.json for available scripts',
      'Examine main entry points and application structure',
      'Review TypeScript configuration and build process'
    );
    
    return steps;
  }
  
  /**
   * Format understanding as markdown for documentation
   */
  formatAsMarkdown(understanding: ProjectUnderstanding): string {
    return `# Project Understanding: ${understanding.projectName}

## Overview
- **Purpose**: ${understanding.context.mainPurpose}
- **Type**: ${understanding.context.packageType}
- **Architecture**: ${understanding.overview.architecture}

## Codebase Statistics
- **Total Files**: ${understanding.codebase.totalFiles}
- **Total Lines**: ${understanding.codebase.totalLines}
- **Languages**: ${Object.entries(understanding.codebase.languages).map(([lang, count]) => `${lang} (${count})`).join(', ')}

## Technologies
${understanding.overview.technologies.map(tech => `- ${tech}`).join('\n')}

## Key Components
${understanding.context.keyComponents.map(comp => `- ${comp}`).join('\n')}

## Entry Points
${understanding.context.entryPoints.map(entry => `- ${entry}`).join('\n')}

## Configuration Files
${understanding.context.configFiles.map(config => `- ${config}`).join('\n')}

## Project Structure
- **Type**: ${understanding.overview.structure.type === 'monorepo' ? 'Monorepo' : 'Single Package'}
- **Packages**: ${understanding.overview.structure.packages.map(pkg => pkg.name).join(', ')}

## Main Directories
${understanding.codebase.mainDirectories.map(dir => `- **${dir.name}**: ${dir.purpose} (${dir.fileCount} files)`).join('\n')}

## AI Context
### Workflow Summary
${understanding.aiContext.workflowSummary}

### Key Files for Understanding
${understanding.aiContext.keyFiles.map(file => `- ${file}`).join('\n')}

### Common Patterns
${understanding.aiContext.commonPatterns.map(pattern => `- ${pattern}`).join('\n')}

### Recommended Next Steps
${understanding.aiContext.nextSteps.map(step => `- ${step}`).join('\n')}

---
*Generated on: ${understanding.timestamp}*
`;
  }
  
  /**
   * Format understanding as plain text
   */
  formatAsText(understanding: ProjectUnderstanding): string {
    return `PROJECT UNDERSTANDING: ${understanding.projectName}
${'='.repeat(50)}

OVERVIEW:
Purpose: ${understanding.context.mainPurpose}
Type: ${understanding.context.packageType}
Architecture: ${understanding.overview.architecture}

CODEBASE STATISTICS:
Total Files: ${understanding.codebase.totalFiles}
Total Lines: ${understanding.codebase.totalLines}
Languages: ${Object.entries(understanding.codebase.languages).map(([lang, count]) => `${lang} (${count})`).join(', ')}

TECHNOLOGIES:
${understanding.overview.technologies.map(tech => `- ${tech}`).join('\n')}

KEY COMPONENTS:
${understanding.context.keyComponents.map(comp => `- ${comp}`).join('\n')}

ENTRY POINTS:
${understanding.context.entryPoints.map(entry => `- ${entry}`).join('\n')}

CONFIGURATION FILES:
${understanding.context.configFiles.map(config => `- ${config}`).join('\n')}

PROJECT STRUCTURE:
Type: ${understanding.overview.structure.type === 'monorepo' ? 'Monorepo' : 'Single Package'}
Packages: ${understanding.overview.structure.packages.map(pkg => pkg.name).join(', ')}

MAIN DIRECTORIES:
${understanding.codebase.mainDirectories.map(dir => `- ${dir.name}: ${dir.purpose} (${dir.fileCount} files)`).join('\n')}

AI CONTEXT:
Workflow Summary: ${understanding.aiContext.workflowSummary}

Key Files for Understanding:
${understanding.aiContext.keyFiles.map(file => `- ${file}`).join('\n')}

Common Patterns:
${understanding.aiContext.commonPatterns.map(pattern => `- ${pattern}`).join('\n')}

Recommended Next Steps:
${understanding.aiContext.nextSteps.map(step => `- ${step}`).join('\n')}

Generated on: ${understanding.timestamp}
`;
  }
}
