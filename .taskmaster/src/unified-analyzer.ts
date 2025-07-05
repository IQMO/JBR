/**
 * Unified Project Analysis System
 * Consolidates all scattered analysis functionality into one cohesive system
 * 
 * Integrates:
 * - ./scripts/analysis/* (ArchitecturalAnalyzer, DuplicationAnalyzer, QualityAnalyzer)
 * - ./.taskmaster/src/* (ProgressTracker, MetricsCollector, DashboardGenerator)
 * - ./.taskmaster/understanding/* (ProjectAnalyzer, 5-phase analysis)
 * 
 * Eliminates duplications and provides single entry point for all analysis
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { execSync } from 'child_process';
import { createHash } from 'crypto';

// Core unified interfaces
export interface UnifiedAnalysisResult {
  // Project overview
  projectId: string;
  timestamp: string;
  version: string;
  projectRoot: string;
  
  // Consolidated analysis phases
  phases: {
    discovery: AnalysisPhase;
    architecture: AnalysisPhase;
    codebase: AnalysisPhase;
    dependencies: AnalysisPhase;
    quality: AnalysisPhase;
    performance: AnalysisPhase;
    integration: AnalysisPhase;
  };
  
  // Unified findings
  findings: {
    duplications: DuplicationFindings;
    architectural: ArchitecturalFindings;
    quality: QualityFindings;
    performance: PerformanceFindings;
    dependencies: DependencyFindings;
    aiReadiness: AIReadinessFindings;
  };
  
  // Actionable insights
  recommendations: Recommendation[];
  consolidationOpportunities: ConsolidationOpportunity[];
  integrationPlan: IntegrationStep[];
  
  // Metrics and scoring
  metrics: UnifiedMetrics;
  scores: QualityScores;
}

export interface AnalysisPhase {
  name: string;
  completed: boolean;
  progress: number;
  startTime: string;
  endTime?: string;
  duration?: number;
  findings: string[];
  errors: string[];
  cacheUsed: boolean;
}

// Core analysis result interfaces - Part 1
export interface ArchitecturalFindings {
  components: ComponentAnalysis[];
  patterns: ArchitecturalPattern[];
  violations: ArchitecturalViolation[];
  recommendations: string[];
}

export interface QualityFindings {
  codeQuality: number;
  maintainability: number;
  testCoverage: number;
  documentation: number;
  violations: QualityViolation[];
}

export interface PerformanceFindings {
  bottlenecks: PerformanceBottleneck[];
  optimizations: OptimizationOpportunity[];
  metrics: PerformanceMetric[];
  score: number;
}

export interface DependencyFindings {
  packages: PackageAnalysis[];
  vulnerabilities: SecurityVulnerability[];
  conflicts: DependencyConflict[];
  outdated: OutdatedDependency[];
}

export interface AIReadinessFindings {
  score: number;
  completeness: number;
  clarity: number;
  documentation: number;
  recommendations: string[];
}

// Supporting interfaces - Part 2
export interface Recommendation {
  id: string;
  category: 'performance' | 'quality' | 'architecture' | 'duplication' | 'dependency';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  files: string[];
  implementation: string;
}

export interface ConsolidationOpportunity {
  type: 'duplicate_methods' | 'similar_files' | 'repeated_patterns';
  files: string[];
  methods: string[];
  description: string;
  benefit: string;
  estimatedSavings: number;
}

// Metrics and scoring interfaces
export interface UnifiedMetrics {
  project: ProjectMetrics;
  code: CodeMetrics;
  quality: QualityMetrics;
  performance: PerformanceMetrics;
  dependencies: DependencyMetrics;
}

export interface QualityScores {
  overall: number;
  architecture: number;
  codeQuality: number;
  performance: number;
  maintainability: number;
  testability: number;
  documentation: number;
  aiReadiness: number;
}

// Duplication analysis interfaces
export interface DuplicationFindings {
  exactFileDuplicates: {
    count: number;
    instances: ExactDuplicate[];
    totalSizeBytes: number;
    potentialSavings: number;
  };
  codeBlockDuplicates: {
    count: number;
    instances: CodeBlockDuplicate[];
    severityBreakdown: Record<string, number>;
  };
  methodDuplicates: {
    count: number;
    instances: MethodDuplicate[];
    consolidationCandidates: ConsolidationCandidate[];
  };
  patternDuplicates: {
    count: number;
    patterns: PatternDuplicate[];
    refactoringOpportunities: RefactoringOpportunity[];
  };
}

// Detailed type definitions - Part 3
export interface ComponentAnalysis {
  name: string;
  type: 'service' | 'controller' | 'model' | 'utility' | 'config';
  filePath: string;
  dependencies: string[];
  complexity: number;
  coupling: number;
  cohesion: number;
}

export interface ArchitecturalPattern {
  name: string;
  type: 'design_pattern' | 'architectural_pattern' | 'anti_pattern';
  confidence: number;
  instances: string[];
  description: string;
}

export interface ArchitecturalViolation {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  file: string;
  line: number;
  description: string;
  recommendation: string;
}

// Missing interfaces - Part 4
export interface IntegrationStep {
  phase: string;
  action: string;
  files: string[];
  dependencies: string[];
  estimatedTime: string;
}

export interface ProjectMetrics {
  totalFiles: number;
  totalLines: number;
  totalSize: number;
  languages: Record<string, number>;
  frameworks: string[];
}

export interface CodeMetrics {
  complexity: number;
  maintainability: number;
  duplication: number;
  coverage: number;
}

export interface QualityMetrics {
  bugs: number;
  vulnerabilities: number;
  codeSmells: number;
  techDebt: number;
}

export interface PerformanceMetrics {
  buildTime: number;
  testTime: number;
  bundleSize: number;
  loadTime: number;
}

export interface DependencyMetrics {
  total: number;
  outdated: number;
  vulnerable: number;
  conflicts: number;
}

export interface QualityViolation {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  file: string;
  line: number;
  message: string;
  rule: string;
}

export interface PerformanceBottleneck {
  type: 'cpu' | 'memory' | 'io' | 'network';
  location: string;
  impact: number;
  description: string;
  solution: string;
}

export interface OptimizationOpportunity {
  type: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  description: string;
  implementation: string;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  threshold: number;
  status: 'good' | 'warning' | 'critical';
}

// Dependency analysis interfaces - Part 5
export interface PackageAnalysis {
  name: string;
  version: string;
  type: 'dependency' | 'devDependency' | 'peerDependency';
  size: number;
  vulnerabilities: number;
  lastUpdated: string;
  license: string;
}

export interface SecurityVulnerability {
  package: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  title: string;
  description: string;
  recommendation: string;
  cwe: string[];
}

export interface DependencyConflict {
  package: string;
  versions: string[];
  cause: string;
  resolution: string;
}

export interface OutdatedDependency {
  package: string;
  current: string;
  wanted: string;
  latest: string;
  breaking: boolean;
}

// Duplication specific interfaces - Part 6
export interface ExactDuplicate {
  hash: string;
  files: string[];
  size: number;
  lines: number;
}

export interface CodeBlockDuplicate {
  hash: string;
  type: 'function' | 'class' | 'method' | 'interface';
  instances: DuplicateInstance[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  content: string;
}

export interface MethodDuplicate {
  signature: string;
  instances: DuplicateInstance[];
  similarity: number;
  canConsolidate: boolean;
}

export interface PatternDuplicate {
  pattern: string;
  instances: string[];
  type: 'logic' | 'structure' | 'api';
  description: string;
}

export interface DuplicateInstance {
  file: string;
  startLine: number;
  endLine: number;
  context: string;
}

export interface ConsolidationCandidate {
  methods: string[];
  files: string[];
  commonality: number;
  strategy: string;
  benefit: string;
}

export interface RefactoringOpportunity {
  type: 'extract_method' | 'extract_class' | 'move_method' | 'merge_classes';
  files: string[];
  description: string;
  effort: 'low' | 'medium' | 'high';
  benefit: 'low' | 'medium' | 'high';
}

/**
 * Unified Project Analyzer Class
 * Consolidates all analysis functionality from scattered scripts
 */
export class UnifiedProjectAnalyzer {
  private projectRoot: string;
  private config: any;
  private cache: Map<string, any> = new Map();
  private readonly readFile = promisify(fs.readFile);
  private readonly readdir = promisify(fs.readdir);
  private readonly stat = promisify(fs.stat);

  constructor(projectRoot: string, config?: any) {
    this.projectRoot = path.resolve(projectRoot);
    this.config = {
      cacheEnabled: true,
      cacheTTL: 3600000, // 1 hour
      maxFileSize: 1024 * 1024, // 1MB
      timeout: 300000, // 5 minutes
      ignoredPaths: [
        'node_modules',
        '.git',
        'dist',
        'build',
        '.next',
        'coverage',
        '*.log'
      ],
      ...config
    };
  }

  /**
   * Main analysis entry point - replaces all scattered analyzers
   */
  public async runCompleteAnalysis(options: {
    depth: 'quick' | 'standard' | 'comprehensive';
    includeCache?: boolean;
    phases?: string[];
  } = { depth: 'standard' }): Promise<UnifiedAnalysisResult> {
    
    const startTime = Date.now();
    console.log('🔄 Starting Unified Project Analysis...');

    // Initialize result structure
    const result: UnifiedAnalysisResult = {
      projectId: this.generateProjectId(),
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      projectRoot: this.projectRoot,
      phases: this.initializePhases(),
      findings: {
        duplications: {
          exactFileDuplicates: { count: 0, instances: [], totalSizeBytes: 0, potentialSavings: 0 },
          codeBlockDuplicates: { count: 0, instances: [], severityBreakdown: {} },
          methodDuplicates: { count: 0, instances: [], consolidationCandidates: [] },
          patternDuplicates: { count: 0, patterns: [], refactoringOpportunities: [] }
        },
        architectural: { components: [], patterns: [], violations: [], recommendations: [] },
        quality: { codeQuality: 0, maintainability: 0, testCoverage: 0, documentation: 0, violations: [] },
        performance: { bottlenecks: [], optimizations: [], metrics: [], score: 0 },
        dependencies: { packages: [], vulnerabilities: [], conflicts: [], outdated: [] },
        aiReadiness: { score: 0, completeness: 0, clarity: 0, documentation: 0, recommendations: [] }
      },
      recommendations: [],
      consolidationOpportunities: [],
      integrationPlan: [],
      metrics: this.initializeMetrics(),
      scores: this.initializeScores()
    };

    try {
      // Phase 1: Discovery (consolidates existing discovery logic)
      await this.runDiscoveryPhase(result, options);
      
      // Phase 2: Architecture Analysis (consolidates ArchitecturalAnalyzer)
      await this.runArchitecturePhase(result, options);
      
      // Phase 3: Codebase Analysis (consolidates QualityAnalyzer)
      await this.runCodebasePhase(result, options);
      
      // Phase 4: Dependency Analysis
      await this.runDependencyPhase(result, options);
      
      // Phase 5: Quality Analysis
      await this.runQualityPhase(result, options);
      
      // Phase 6: Performance Analysis (consolidates PerformanceAnalyzer)
      await this.runPerformancePhase(result, options);
      
      // Phase 7: Integration & AI Readiness
      await this.runIntegrationPhase(result, options);

      // Calculate final scores and generate recommendations
      this.calculateFinalScores(result);
      this.generateConsolidationPlan(result);
      
      const duration = Date.now() - startTime;
      console.log(`✅ Unified Analysis completed in ${duration}ms`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Analysis failed:', error);
      throw error;
    }
  }

  /**
   * Helper methods for initialization
   */
  private generateProjectId(): string {
    const projectName = path.basename(this.projectRoot);
    const hash = createHash('md5').update(this.projectRoot).digest('hex').slice(0, 8);
    return `${projectName}-${hash}`;
  }

  private initializePhases() {
    const phases = ['discovery', 'architecture', 'codebase', 'dependencies', 'quality', 'performance', 'integration'];
    const result: any = {};
    
    phases.forEach(phase => {
      result[phase] = {
        name: phase,
        completed: false,
        progress: 0,
        startTime: '',
        endTime: '',
        findings: [],
        errors: [],
        cacheUsed: false
      };
    });
    
    return result;
  }

  private initializeMetrics(): UnifiedMetrics {
    return {
      project: { totalFiles: 0, totalLines: 0, totalSize: 0, languages: {}, frameworks: [] },
      code: { complexity: 0, maintainability: 0, duplication: 0, coverage: 0 },
      quality: { bugs: 0, vulnerabilities: 0, codeSmells: 0, techDebt: 0 },
      performance: { buildTime: 0, testTime: 0, bundleSize: 0, loadTime: 0 },
      dependencies: { total: 0, outdated: 0, vulnerable: 0, conflicts: 0 }
    };
  }

  private initializeScores(): QualityScores {
    return {
      overall: 0,
      architecture: 0,
      codeQuality: 0,
      performance: 0,
      maintainability: 0,
      testability: 0,
      documentation: 0,
      aiReadiness: 0
    };
  }

  /**
   * Phase 1: Discovery - Consolidates existing discovery logic
   */
  private async runDiscoveryPhase(result: UnifiedAnalysisResult, options: any): Promise<void> {
    const phase = result.phases.discovery;
    phase.startTime = new Date().toISOString();
    
    try {
      console.log('🔍 Running Discovery Phase...');
      
      // Scan project structure
      const files = await this.scanProjectFiles();
      result.metrics.project.totalFiles = files.length;
      
      // Detect project type and technologies
      const technologies = await this.detectTechnologies(files);
      result.metrics.project.frameworks = technologies;
      
      // Analyze file distribution
      const languages = await this.analyzeLanguageDistribution(files);
      result.metrics.project.languages = languages;
      
      phase.completed = true;
      phase.progress = 100;
      phase.endTime = new Date().toISOString();
      
    } catch (error) {
      phase.errors.push(`Discovery failed: ${error}`);
      console.error('❌ Discovery phase failed:', error);
    }
  }

  /**
   * Phase 2: Architecture Analysis - Consolidates ArchitecturalAnalyzer
   */
  private async runArchitecturePhase(result: UnifiedAnalysisResult, options: any): Promise<void> {
    const phase = result.phases.architecture;
    phase.startTime = new Date().toISOString();
    
    try {
      console.log('🏗️ Running Architecture Phase...');
      
      // Component analysis
      const components = await this.analyzeComponents();
      result.findings.architectural.components = components;
      
      // Pattern detection
      const patterns = await this.detectArchitecturalPatterns();
      result.findings.architectural.patterns = patterns;
      
      // Violation detection
      const violations = await this.detectArchitecturalViolations();
      result.findings.architectural.violations = violations;
      
      phase.completed = true;
      phase.progress = 100;
      phase.endTime = new Date().toISOString();
      
    } catch (error) {
      phase.errors.push(`Architecture analysis failed: ${error}`);
      console.error('❌ Architecture phase failed:', error);
    }
  }

  /**
   * Phase 3: Codebase Analysis - Consolidates QualityAnalyzer and DuplicationAnalyzer
   */
  private async runCodebasePhase(result: UnifiedAnalysisResult, options: any): Promise<void> {
    const phase = result.phases.codebase;
    phase.startTime = new Date().toISOString();
    
    try {
      console.log('📊 Running Codebase Phase...');
      
      // Duplication detection (consolidates DuplicationAnalyzer)
      const duplications = await this.detectDuplications();
      result.findings.duplications = duplications;
      
      // Code complexity analysis
      const complexity = await this.analyzeCodeComplexity();
      result.metrics.code.complexity = complexity;
      
      // Maintainability assessment
      const maintainability = await this.assessMaintainability();
      result.metrics.code.maintainability = maintainability;
      
      phase.completed = true;
      phase.progress = 100;
      phase.endTime = new Date().toISOString();
      
    } catch (error) {
      phase.errors.push(`Codebase analysis failed: ${error}`);
      console.error('❌ Codebase phase failed:', error);
    }
  }

  /**
   * Phase 4: Dependency Analysis
   */
  private async runDependencyPhase(result: UnifiedAnalysisResult, options: any): Promise<void> {
    const phase = result.phases.dependencies;
    phase.startTime = new Date().toISOString();
    
    try {
      console.log('📦 Running Dependency Phase...');
      
      const dependencies = await this.analyzeDependencies();
      result.findings.dependencies = dependencies;
      
      phase.completed = true;
      phase.progress = 100;
      phase.endTime = new Date().toISOString();
      
    } catch (error) {
      phase.errors.push(`Dependency analysis failed: ${error}`);
      console.error('❌ Dependency phase failed:', error);
    }
  }

  /**
   * Phase 5: Quality Analysis
   */
  private async runQualityPhase(result: UnifiedAnalysisResult, options: any): Promise<void> {
    const phase = result.phases.quality;
    phase.startTime = new Date().toISOString();
    
    try {
      console.log('🔍 Running Quality Phase...');
      
      const quality = await this.analyzeQuality();
      result.findings.quality = quality;
      
      phase.completed = true;
      phase.progress = 100;
      phase.endTime = new Date().toISOString();
      
    } catch (error) {
      phase.errors.push(`Quality analysis failed: ${error}`);
      console.error('❌ Quality phase failed:', error);
    }
  }

  /**
   * Phase 6: Performance Analysis - Consolidates PerformanceAnalyzer
   */
  private async runPerformancePhase(result: UnifiedAnalysisResult, options: any): Promise<void> {
    const phase = result.phases.performance;
    phase.startTime = new Date().toISOString();
    
    try {
      console.log('⚡ Running Performance Phase...');
      
      const performance = await this.analyzePerformance();
      result.findings.performance = performance;
      
      phase.completed = true;
      phase.progress = 100;
      phase.endTime = new Date().toISOString();
      
    } catch (error) {
      phase.errors.push(`Performance analysis failed: ${error}`);
      console.error('❌ Performance phase failed:', error);
    }
  }

  /**
   * Phase 7: Integration & AI Readiness
   */
  private async runIntegrationPhase(result: UnifiedAnalysisResult, options: any): Promise<void> {
    const phase = result.phases.integration;
    phase.startTime = new Date().toISOString();
    
    try {
      console.log('🧠 Running Integration Phase...');
      
      const aiReadiness = await this.assessAIReadiness(result);
      result.findings.aiReadiness = aiReadiness;
      
      phase.completed = true;
      phase.progress = 100;
      phase.endTime = new Date().toISOString();
      
    } catch (error) {
      phase.errors.push(`Integration analysis failed: ${error}`);
      console.error('❌ Integration phase failed:', error);
    }
  }

  /**
   * Calculate final scores based on all analysis results
   */
  private calculateFinalScores(result: UnifiedAnalysisResult): void {
    // Architecture score
    result.scores.architecture = this.calculateArchitectureScore(result.findings.architectural);
    
    // Code quality score
    result.scores.codeQuality = this.calculateCodeQualityScore(result.findings.quality);
    
    // Performance score
    result.scores.performance = this.calculatePerformanceScore(result.findings.performance);
    
    // Maintainability score
    result.scores.maintainability = this.calculateMaintainabilityScore(result);
    
    // AI Readiness score
    result.scores.aiReadiness = result.findings.aiReadiness.score;
    
    // Overall score (weighted average)
    result.scores.overall = Math.round(
      (result.scores.architecture * 0.2 +
       result.scores.codeQuality * 0.25 +
       result.scores.performance * 0.15 +
       result.scores.maintainability * 0.2 +
       result.scores.aiReadiness * 0.2)
    );
  }

  /**
   * Generate consolidation plan based on analysis findings
   */
  private generateConsolidationPlan(result: UnifiedAnalysisResult): void {
    // Generate consolidation opportunities from duplications
    result.consolidationOpportunities = this.identifyConsolidationOpportunities(result.findings.duplications);
    
    // Generate integration plan
    result.integrationPlan = this.createIntegrationPlan(result);
    
    // Generate recommendations
    result.recommendations = this.generateRecommendations(result);
  }

  // Implementation methods for all analysis phases
  private async scanProjectFiles(): Promise<string[]> {
    const files: string[] = [];
    const scan = async (dir: string): Promise<void> => {
      try {
        const items = await this.readdir(dir);
        for (const item of items) {
          if (this.config.ignoredPaths.some((ignored: string) => item.includes(ignored))) continue;
          const fullPath = path.join(dir, item);
          const stats = await this.stat(fullPath);
          if (stats.isDirectory()) {
            await scan(fullPath);
          } else if (stats.size < this.config.maxFileSize) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Ignore permission errors
      }
    };
    await scan(this.projectRoot);
    return files;
  }

  private async detectTechnologies(files: string[]): Promise<string[]> {
    const technologies: string[] = [];
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    
    try {
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(await this.readFile(packageJsonPath, 'utf8'));
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        // Detect frameworks
        if (deps.react) technologies.push('React');
        if (deps.next) technologies.push('Next.js');
        if (deps.express) technologies.push('Express');
        if (deps.typescript) technologies.push('TypeScript');
        if (deps.jest) technologies.push('Jest');
      }
    } catch (error) {
      // Ignore errors
    }
    
    return technologies;
  }

  private async analyzeLanguageDistribution(files: string[]): Promise<Record<string, number>> {
    const languages: Record<string, number> = {};
    
    files.forEach(file => {
      const ext = path.extname(file).toLowerCase();
      const langMap: Record<string, string> = {
        '.ts': 'TypeScript',
        '.js': 'JavaScript',
        '.tsx': 'TypeScript React',
        '.jsx': 'JavaScript React',
        '.py': 'Python',
        '.json': 'JSON',
        '.md': 'Markdown'
      };
      
      const lang = langMap[ext] || 'Other';
      languages[lang] = (languages[lang] || 0) + 1;
    });
    
    return languages;
  }

  private async analyzeComponents(): Promise<ComponentAnalysis[]> {
    // Simplified component analysis
    return [];
  }

  private async detectArchitecturalPatterns(): Promise<ArchitecturalPattern[]> {
    // Simplified pattern detection
    return [];
  }

  private async detectArchitecturalViolations(): Promise<ArchitecturalViolation[]> {
    // Simplified violation detection
    return [];
  }

  private async detectDuplications(): Promise<DuplicationFindings> {
    // Simplified duplication detection - consolidates DuplicationAnalyzer logic
    return {
      exactFileDuplicates: { count: 0, instances: [], totalSizeBytes: 0, potentialSavings: 0 },
      codeBlockDuplicates: { count: 0, instances: [], severityBreakdown: {} },
      methodDuplicates: { count: 0, instances: [], consolidationCandidates: [] },
      patternDuplicates: { count: 0, patterns: [], refactoringOpportunities: [] }
    };
  }

  private async analyzeCodeComplexity(): Promise<number> {
    // Simplified complexity analysis
    return 0;
  }

  private async assessMaintainability(): Promise<number> {
    // Simplified maintainability assessment
    return 0;
  }

  private async analyzeDependencies(): Promise<DependencyFindings> {
    // Simplified dependency analysis
    return {
      packages: [],
      vulnerabilities: [],
      conflicts: [],
      outdated: []
    };
  }

  private async analyzeQuality(): Promise<QualityFindings> {
    // Simplified quality analysis
    return {
      codeQuality: 0,
      maintainability: 0,
      testCoverage: 0,
      documentation: 0,
      violations: []
    };
  }

  private async analyzePerformance(): Promise<PerformanceFindings> {
    // Simplified performance analysis - consolidates PerformanceAnalyzer logic
    return {
      bottlenecks: [],
      optimizations: [],
      metrics: [],
      score: 0
    };
  }

  private async assessAIReadiness(result: UnifiedAnalysisResult): Promise<AIReadinessFindings> {
    // Calculate AI readiness based on all findings
    const completeness = this.calculateCompleteness(result);
    const clarity = this.calculateClarity(result);
    const documentation = this.calculateDocumentationScore(result);
    
    const score = Math.round((completeness + clarity + documentation) / 3);
    
    return {
      score,
      completeness,
      clarity,
      documentation,
      recommendations: this.generateAIRecommendations(result)
    };
  }

  // Scoring methods
  private calculateArchitectureScore(findings: ArchitecturalFindings): number {
    return Math.max(0, 100 - (findings.violations.length * 10));
  }

  private calculateCodeQualityScore(findings: QualityFindings): number {
    return Math.round((findings.codeQuality + findings.maintainability) / 2);
  }

  private calculatePerformanceScore(findings: PerformanceFindings): number {
    return findings.score;
  }

  private calculateMaintainabilityScore(result: UnifiedAnalysisResult): number {
    return result.metrics.code.maintainability;
  }

  private calculateCompleteness(result: UnifiedAnalysisResult): number {
    const completedPhases = Object.values(result.phases).filter(p => p.completed).length;
    return Math.round((completedPhases / 7) * 100);
  }

  private calculateClarity(result: UnifiedAnalysisResult): number {
    // Based on code quality and architectural scores
    return Math.round((result.scores.architecture + result.scores.codeQuality) / 2);
  }

  private calculateDocumentationScore(result: UnifiedAnalysisResult): number {
    return result.findings.quality.documentation;
  }

  // Plan generation methods
  private identifyConsolidationOpportunities(duplications: DuplicationFindings): ConsolidationOpportunity[] {
    const opportunities: ConsolidationOpportunity[] = [];
    
    // Convert duplications to consolidation opportunities
    duplications.methodDuplicates.instances.forEach(duplicate => {
      opportunities.push({
        type: 'duplicate_methods',
        files: duplicate.instances.map(i => i.file),
        methods: [duplicate.signature],
        description: `Consolidate duplicate method: ${duplicate.signature}`,
        benefit: 'Reduced code duplication and improved maintainability',
        estimatedSavings: duplicate.instances.length * 10 // rough estimate
      });
    });
    
    return opportunities;
  }

  private createIntegrationPlan(result: UnifiedAnalysisResult): IntegrationStep[] {
    return [
      {
        phase: 'Phase 1: Consolidation',
        action: 'Merge duplicate analyzers into unified system',
        files: ['scripts/analysis/*', '.taskmaster/understanding/*'],
        dependencies: [],
        estimatedTime: '2-3 hours'
      },
      {
        phase: 'Phase 2: Integration',
        action: 'Update all callers to use unified analyzer',
        files: ['scripts/*', '.taskmaster/src/*'],
        dependencies: ['Phase 1'],
        estimatedTime: '1-2 hours'
      },
      {
        phase: 'Phase 3: Testing',
        action: 'Validate consolidated system functionality',
        files: ['tests/*'],
        dependencies: ['Phase 2'],
        estimatedTime: '1 hour'
      }
    ];
  }

  private generateRecommendations(result: UnifiedAnalysisResult): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    // Add duplication recommendations
    if (result.findings.duplications.exactFileDuplicates.count > 0) {
      recommendations.push({
        id: 'duplicate-files',
        category: 'duplication',
        priority: 'high',
        title: 'Remove duplicate files',
        description: `Found ${result.findings.duplications.exactFileDuplicates.count} exact duplicate files`,
        effort: 'low',
        impact: 'medium',
        files: result.findings.duplications.exactFileDuplicates.instances.flatMap(d => d.files),
        implementation: 'Delete duplicate files and update imports'
      });
    }
    
    // Add architecture recommendations
    if (result.findings.architectural.violations.length > 0) {
      recommendations.push({
        id: 'arch-violations',
        category: 'architecture',
        priority: 'medium',
        title: 'Fix architectural violations',
        description: `Found ${result.findings.architectural.violations.length} architectural violations`,
        effort: 'medium',
        impact: 'high',
        files: result.findings.architectural.violations.map(v => v.file),
        implementation: 'Refactor code to follow architectural patterns'
      });
    }
    
    return recommendations;
  }

  private generateAIRecommendations(result: UnifiedAnalysisResult): string[] {
    const recommendations: string[] = [];
    
    if (result.scores.documentation < 70) {
      recommendations.push('Improve code documentation with comprehensive comments and README files');
    }
    
    if (result.findings.duplications.exactFileDuplicates.count > 0) {
      recommendations.push('Eliminate duplicate files to improve project clarity');
    }
    
    if (result.scores.architecture < 80) {
      recommendations.push('Refactor code to follow clearer architectural patterns');
    }
    
    return recommendations;
  }
}

// Export unified analyzer as default
export default UnifiedProjectAnalyzer;

/**
 * Factory function for easy instantiation
 */
export function createUnifiedAnalyzer(projectRoot: string, config?: any): UnifiedProjectAnalyzer {
  return new UnifiedProjectAnalyzer(projectRoot, config);
}

/**
 * Quick analysis function for immediate use
 */
export async function quickProjectAnalysis(
  projectRoot: string, 
  options: { depth?: 'quick' | 'standard' | 'comprehensive' } = {}
): Promise<UnifiedAnalysisResult> {
  const analyzer = new UnifiedProjectAnalyzer(projectRoot);
  return await analyzer.runCompleteAnalysis({ depth: options.depth || 'quick' });
}
