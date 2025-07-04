/**
 * Task Dependency Visualization System
 * Creates interactive visualizations of task dependencies and relationships
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface TaskNode {
  id: string;
  title: string;
  status: 'pending' | 'in-progress' | 'done' | 'blocked' | 'deferred' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  complexity?: number;
  estimatedHours?: number;
  actualHours?: number;
  startDate?: string;
  endDate?: string;
  assignee?: string;
  tags?: string[];
  parentId?: string;
  isSubtask: boolean;
}

export interface DependencyEdge {
  source: string;
  target: string;
  type: 'dependency' | 'blocks' | 'subtask';
  weight?: number;
  label?: string;
}

export interface DependencyGraph {
  nodes: TaskNode[];
  edges: DependencyEdge[];
  metadata: {
    totalTasks: number;
    totalDependencies: number;
    criticalPath: string[];
    cycles: string[][];
    orphanTasks: string[];
    complexity: number;
  };
}

export interface VisualizationConfig {
  layout: 'hierarchical' | 'force' | 'circular' | 'tree';
  colorScheme: 'status' | 'priority' | 'complexity' | 'assignee';
  showLabels: boolean;
  showProgress: boolean;
  filterByStatus: string[];
  filterByPriority: string[];
  groupByAssignee: boolean;
  highlightCriticalPath: boolean;
  showSubtasks: boolean;
}

export class DependencyGraphBuilder {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * Build dependency graph from tasks data
   */
  public buildGraph(): DependencyGraph {
    const tasksData = this.loadTasksData();
    const nodes: TaskNode[] = [];
    const edges: DependencyEdge[] = [];

    if (!tasksData.tasks) {
      return this.createEmptyGraph();
    }

    // Extract nodes (tasks and subtasks)
    for (const task of tasksData.tasks) {
      // Add main task
      nodes.push(this.createTaskNode(task, false));

      // Add subtasks if they exist
      if (task.subtasks && task.subtasks.length > 0) {
        for (const subtask of task.subtasks) {
          nodes.push(this.createTaskNode(subtask, true, task.id.toString()));
          
          // Add parent-child edge
          edges.push({
            source: task.id.toString(),
            target: `${task.id}.${subtask.id}`,
            type: 'subtask',
            label: 'contains'
          });
        }
      }

      // Add dependency edges
      if (task.dependencies && task.dependencies.length > 0) {
        for (const depId of task.dependencies) {
          edges.push({
            source: depId.toString(),
            target: task.id.toString(),
            type: 'dependency',
            weight: this.calculateDependencyWeight(task, depId),
            label: 'depends on'
          });
        }
      }

      // Add blocking edges
      if (task.blockers && task.blockers.length > 0) {
        for (const blockerId of task.blockers) {
          edges.push({
            source: blockerId.toString(),
            target: task.id.toString(),
            type: 'blocks',
            label: 'blocks'
          });
        }
      }
    }

    // Calculate metadata
    const metadata = this.calculateGraphMetadata(nodes, edges);

    return {
      nodes,
      edges,
      metadata
    };
  }

  /**
   * Create task node from task data
   */
  private createTaskNode(task: any, isSubtask: boolean, parentId?: string): TaskNode {
    const nodeId = isSubtask ? `${parentId}.${task.id}` : task.id.toString();
    
    return {
      id: nodeId,
      title: task.title || 'Untitled Task',
      status: task.status || 'pending',
      priority: task.priority || 'medium',
      complexity: task.complexity || 5,
      estimatedHours: task.estimatedHours || 8,
      actualHours: task.actualHours || 0,
      startDate: task.startDate,
      endDate: task.endDate,
      assignee: task.assignee,
      tags: task.tags || [],
      parentId: parentId,
      isSubtask
    };
  }

  /**
   * Calculate dependency weight based on task properties
   */
  private calculateDependencyWeight(task: any, depId: string): number {
    // Higher weight for high priority tasks or complex tasks
    let weight = 1;
    
    if (task.priority === 'critical') weight += 3;
    else if (task.priority === 'high') weight += 2;
    else if (task.priority === 'medium') weight += 1;
    
    if (task.complexity && task.complexity > 7) weight += 2;
    else if (task.complexity && task.complexity > 5) weight += 1;
    
    return weight;
  }

  /**
   * Calculate graph metadata including critical path and cycles
   */
  private calculateGraphMetadata(nodes: TaskNode[], edges: DependencyEdge[]): DependencyGraph['metadata'] {
    const totalTasks = nodes.length;
    const totalDependencies = edges.filter(e => e.type === 'dependency').length;
    
    // Find critical path (simplified implementation)
    const criticalPath = this.findCriticalPath(nodes, edges);
    
    // Detect cycles
    const cycles = this.detectCycles(nodes, edges);
    
    // Find orphan tasks (no dependencies or dependents)
    const orphanTasks = this.findOrphanTasks(nodes, edges);
    
    // Calculate overall complexity
    const complexity = this.calculateGraphComplexity(nodes, edges);

    return {
      totalTasks,
      totalDependencies,
      criticalPath,
      cycles,
      orphanTasks,
      complexity
    };
  }

  /**
   * Find critical path through the dependency graph
   */
  private findCriticalPath(nodes: TaskNode[], edges: DependencyEdge[]): string[] {
    // Simplified critical path: longest chain of high-priority dependencies
    const dependencyEdges = edges.filter(e => e.type === 'dependency');
    const highPriorityNodes = nodes.filter(n => n.priority === 'critical' || n.priority === 'high');
    
    if (highPriorityNodes.length === 0) return [];
    
    // Find the longest chain starting from high-priority nodes
    let longestPath: string[] = [];
    
    for (const node of highPriorityNodes) {
      const path = this.findLongestPathFrom(node.id, dependencyEdges, []);
      if (path.length > longestPath.length) {
        longestPath = path;
      }
    }
    
    return longestPath;
  }

  /**
   * Find longest path from a starting node
   */
  private findLongestPathFrom(nodeId: string, edges: DependencyEdge[], visited: string[]): string[] {
    if (visited.includes(nodeId)) return []; // Avoid cycles
    
    const newVisited = [...visited, nodeId];
    const outgoingEdges = edges.filter(e => e.source === nodeId);
    
    if (outgoingEdges.length === 0) return [nodeId];
    
    let longestPath = [nodeId];
    
    for (const edge of outgoingEdges) {
      const path = this.findLongestPathFrom(edge.target, edges, newVisited);
      const fullPath = [nodeId, ...path];
      
      if (fullPath.length > longestPath.length) {
        longestPath = fullPath;
      }
    }
    
    return longestPath;
  }

  /**
   * Detect cycles in the dependency graph
   */
  private detectCycles(nodes: TaskNode[], edges: DependencyEdge[]): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const dependencyEdges = edges.filter(e => e.type === 'dependency');
    
    const dfs = (nodeId: string, path: string[]): void => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle
        const cycleStart = path.indexOf(nodeId);
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart));
        }
        return;
      }
      
      if (visited.has(nodeId)) return;
      
      visited.add(nodeId);
      recursionStack.add(nodeId);
      
      const outgoingEdges = dependencyEdges.filter(e => e.source === nodeId);
      for (const edge of outgoingEdges) {
        dfs(edge.target, [...path, nodeId]);
      }
      
      recursionStack.delete(nodeId);
    };
    
    for (const node of nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    }
    
    return cycles;
  }

  /**
   * Find orphan tasks (no dependencies or dependents)
   */
  private findOrphanTasks(nodes: TaskNode[], edges: DependencyEdge[]): string[] {
    const dependencyEdges = edges.filter(e => e.type === 'dependency');
    const connectedNodes = new Set<string>();
    
    for (const edge of dependencyEdges) {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    }
    
    return nodes
      .filter(node => !connectedNodes.has(node.id) && !node.isSubtask)
      .map(node => node.id);
  }

  /**
   * Calculate overall graph complexity
   */
  private calculateGraphComplexity(nodes: TaskNode[], edges: DependencyEdge[]): number {
    const nodeCount = nodes.length;
    const edgeCount = edges.length;
    const avgComplexity = nodes.reduce((sum, node) => sum + (node.complexity || 5), 0) / nodeCount;
    
    // Complexity formula: combination of node count, edge count, and average task complexity
    return Math.round((nodeCount * 0.3 + edgeCount * 0.5 + avgComplexity * 0.2) * 10) / 10;
  }

  private createEmptyGraph(): DependencyGraph {
    return {
      nodes: [],
      edges: [],
      metadata: {
        totalTasks: 0,
        totalDependencies: 0,
        criticalPath: [],
        cycles: [],
        orphanTasks: [],
        complexity: 0
      }
    };
  }

  private loadTasksData(): any {
    const tasksPath = join(this.projectRoot, '.taskmaster', 'tasks', 'tasks.json');
    if (existsSync(tasksPath)) {
      const data = JSON.parse(readFileSync(tasksPath, 'utf8'));
      // Handle Task Master format with tags (e.g., { master: { tasks: [] } })
      if (data.master && data.master.tasks) {
        return { tasks: data.master.tasks };
      }
      // Handle direct format (e.g., { tasks: [] })
      if (data.tasks) {
        return data;
      }
      // Fallback: treat the entire object as tasks array if it's an array
      if (Array.isArray(data)) {
        return { tasks: data };
      }
    }
    return { tasks: [] };
  }
}

export class SVGVisualizationGenerator {
  private config: VisualizationConfig;
  
  constructor(config: Partial<VisualizationConfig> = {}) {
    this.config = {
      layout: 'hierarchical',
      colorScheme: 'status',
      showLabels: true,
      showProgress: true,
      filterByStatus: [],
      filterByPriority: [],
      groupByAssignee: false,
      highlightCriticalPath: true,
      showSubtasks: true,
      ...config
    };
  }

  /**
   * Generate SVG visualization of the dependency graph
   */
  public generateSVG(graph: DependencyGraph, width: number = 1200, height: number = 800): string {
    const filteredGraph = this.applyFilters(graph);
    const layout = this.calculateLayout(filteredGraph, width, height);
    
    return this.createSVGDocument(filteredGraph, layout, width, height);
  }

  /**
   * Apply filters to the graph based on configuration
   */
  private applyFilters(graph: DependencyGraph): DependencyGraph {
    let nodes = [...graph.nodes];
    let edges = [...graph.edges];

    // Filter by status
    if (this.config.filterByStatus.length > 0) {
      nodes = nodes.filter(node => this.config.filterByStatus.includes(node.status));
      const nodeIds = new Set(nodes.map(n => n.id));
      edges = edges.filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target));
    }

    // Filter by priority
    if (this.config.filterByPriority.length > 0) {
      nodes = nodes.filter(node => this.config.filterByPriority.includes(node.priority));
      const nodeIds = new Set(nodes.map(n => n.id));
      edges = edges.filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target));
    }

    // Filter subtasks if disabled
    if (!this.config.showSubtasks) {
      nodes = nodes.filter(node => !node.isSubtask);
      edges = edges.filter(edge => edge.type !== 'subtask');
    }

    return {
      ...graph,
      nodes,
      edges
    };
  }

  /**
   * Calculate node positions based on layout algorithm
   */
  private calculateLayout(graph: DependencyGraph, width: number, height: number): Map<string, { x: number; y: number }> {
    const layout = new Map<string, { x: number; y: number }>();
    
    switch (this.config.layout) {
      case 'hierarchical':
        return this.calculateHierarchicalLayout(graph, width, height);
      case 'force':
        return this.calculateForceLayout(graph, width, height);
      case 'circular':
        return this.calculateCircularLayout(graph, width, height);
      case 'tree':
        return this.calculateTreeLayout(graph, width, height);
      default:
        return this.calculateHierarchicalLayout(graph, width, height);
    }
  }

  /**
   * Calculate hierarchical layout (top-down dependency flow)
   */
  private calculateHierarchicalLayout(graph: DependencyGraph, width: number, height: number): Map<string, { x: number; y: number }> {
    const layout = new Map<string, { x: number; y: number }>();
    const dependencyEdges = graph.edges.filter(e => e.type === 'dependency');
    
    // Calculate levels (depth from root nodes)
    const levels = this.calculateNodeLevels(graph.nodes, dependencyEdges);
    const maxLevel = Math.max(...Array.from(levels.values()));
    
    // Group nodes by level
    const nodesByLevel = new Map<number, string[]>();
    for (const [nodeId, level] of levels) {
      if (!nodesByLevel.has(level)) {
        nodesByLevel.set(level, []);
      }
      nodesByLevel.get(level)!.push(nodeId);
    }
    
    // Position nodes
    const levelHeight = height / (maxLevel + 1);
    
    for (let level = 0; level <= maxLevel; level++) {
      const nodesAtLevel = nodesByLevel.get(level) || [];
      const nodeWidth = width / (nodesAtLevel.length + 1);
      
      nodesAtLevel.forEach((nodeId, index) => {
        layout.set(nodeId, {
          x: nodeWidth * (index + 1),
          y: levelHeight * level + 50
        });
      });
    }
    
    return layout;
  }

  /**
   * Calculate node levels for hierarchical layout
   */
  private calculateNodeLevels(nodes: TaskNode[], edges: DependencyEdge[]): Map<string, number> {
    const levels = new Map<string, number>();
    const visited = new Set<string>();
    
    // Find root nodes (no incoming dependencies)
    const rootNodes = nodes.filter(node => 
      !edges.some(edge => edge.target === node.id)
    );
    
    // BFS to assign levels
    const queue = rootNodes.map(node => ({ id: node.id, level: 0 }));
    
    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      
      if (visited.has(id)) continue;
      visited.add(id);
      levels.set(id, level);
      
      // Add dependent nodes to queue
      const dependents = edges
        .filter(edge => edge.source === id)
        .map(edge => ({ id: edge.target, level: level + 1 }));
      
      queue.push(...dependents);
    }
    
    // Assign level 0 to any unvisited nodes
    for (const node of nodes) {
      if (!levels.has(node.id)) {
        levels.set(node.id, 0);
      }
    }
    
    return levels;
  }

  /**
   * Simple force-directed layout
   */
  private calculateForceLayout(graph: DependencyGraph, width: number, height: number): Map<string, { x: number; y: number }> {
    const layout = new Map<string, { x: number; y: number }>();
    
    // Initialize random positions
    graph.nodes.forEach(node => {
      layout.set(node.id, {
        x: Math.random() * (width - 100) + 50,
        y: Math.random() * (height - 100) + 50
      });
    });
    
    // Simple force simulation (simplified)
    for (let iteration = 0; iteration < 50; iteration++) {
      const forces = new Map<string, { fx: number; fy: number }>();
      
      // Initialize forces
      graph.nodes.forEach(node => {
        forces.set(node.id, { fx: 0, fy: 0 });
      });
      
      // Repulsive forces between all nodes
      for (let i = 0; i < graph.nodes.length; i++) {
        for (let j = i + 1; j < graph.nodes.length; j++) {
          const node1 = graph.nodes[i];
          const node2 = graph.nodes[j];
          const pos1 = layout.get(node1.id)!;
          const pos2 = layout.get(node2.id)!;
          
          const dx = pos1.x - pos2.x;
          const dy = pos1.y - pos2.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          const force = 1000 / (distance * distance);
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          
          forces.get(node1.id)!.fx += fx;
          forces.get(node1.id)!.fy += fy;
          forces.get(node2.id)!.fx -= fx;
          forces.get(node2.id)!.fy -= fy;
        }
      }
      
      // Attractive forces for connected nodes
      graph.edges.forEach(edge => {
        const pos1 = layout.get(edge.source)!;
        const pos2 = layout.get(edge.target)!;
        
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        
        const force = distance * 0.01;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        
        forces.get(edge.source)!.fx += fx;
        forces.get(edge.source)!.fy += fy;
        forces.get(edge.target)!.fx -= fx;
        forces.get(edge.target)!.fy -= fy;
      });
      
      // Apply forces
      graph.nodes.forEach(node => {
        const pos = layout.get(node.id)!;
        const force = forces.get(node.id)!;
        
        pos.x += force.fx * 0.1;
        pos.y += force.fy * 0.1;
        
        // Keep within bounds
        pos.x = Math.max(50, Math.min(width - 50, pos.x));
        pos.y = Math.max(50, Math.min(height - 50, pos.y));
      });
    }
    
    return layout;
  }

  /**
   * Circular layout
   */
  private calculateCircularLayout(graph: DependencyGraph, width: number, height: number): Map<string, { x: number; y: number }> {
    const layout = new Map<string, { x: number; y: number }>();
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.4;
    
    graph.nodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / graph.nodes.length;
      layout.set(node.id, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      });
    });
    
    return layout;
  }

  /**
   * Tree layout (simplified)
   */
  private calculateTreeLayout(graph: DependencyGraph, width: number, height: number): Map<string, { x: number; y: number }> {
    // For now, use hierarchical layout as tree layout
    return this.calculateHierarchicalLayout(graph, width, height);
  }

  /**
   * Create SVG document with nodes and edges
   */
  private createSVGDocument(graph: DependencyGraph, layout: Map<string, { x: number; y: number }>, width: number, height: number): string {
    const svg = [];
    
    // SVG header
    svg.push(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`);
    svg.push('<defs>');
    svg.push(this.createArrowMarkers());
    svg.push(this.createGradients());
    svg.push('</defs>');
    
    // Background
    svg.push(`<rect width="${width}" height="${height}" fill="#f8f9fa" stroke="#e9ecef" stroke-width="1"/>`);
    
    // Title
    svg.push(`<text x="${width/2}" y="30" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#495057">Task Dependency Visualization</text>`);
    
    // Draw edges first (so they appear behind nodes)
    svg.push(this.drawEdges(graph.edges, layout));
    
    // Draw nodes
    svg.push(this.drawNodes(graph.nodes, layout));
    
    // Draw legend
    svg.push(this.drawLegend(width, height));
    
    // Statistics
    svg.push(this.drawStatistics(graph, width));
    
    svg.push('</svg>');
    
    return svg.join('\n');
  }

  /**
   * Create arrow markers for edges
   */
  private createArrowMarkers(): string {
    return `
      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#6c757d" />
      </marker>
      <marker id="arrowhead-critical" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#dc3545" />
      </marker>
    `;
  }

  /**
   * Create gradients for visual effects
   */
  private createGradients(): string {
    return `
      <linearGradient id="nodeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="1" />
        <stop offset="100%" stop-color="#f8f9fa" stop-opacity="1" />
      </linearGradient>
    `;
  }

  /**
   * Draw all edges
   */
  private drawEdges(edges: DependencyEdge[], layout: Map<string, { x: number; y: number }>): string {
    const edgeElements = [];
    
    for (const edge of edges) {
      const sourcePos = layout.get(edge.source);
      const targetPos = layout.get(edge.target);
      
      if (!sourcePos || !targetPos) continue;
      
      const isCritical = this.config.highlightCriticalPath; // Simplified for now
      const strokeColor = this.getEdgeColor(edge);
      const strokeWidth = this.getEdgeWidth(edge);
      const marker = isCritical ? 'url(#arrowhead-critical)' : 'url(#arrowhead)';
      
      edgeElements.push(`
        <line x1="${sourcePos.x}" y1="${sourcePos.y}" 
              x2="${targetPos.x}" y2="${targetPos.y}"
              stroke="${strokeColor}" stroke-width="${strokeWidth}"
              marker-end="${marker}" opacity="0.7">
          <title>${edge.label || edge.type}: ${edge.source} → ${edge.target}</title>
        </line>
      `);
      
      // Add edge label if needed
      if (this.config.showLabels && edge.label) {
        const midX = (sourcePos.x + targetPos.x) / 2;
        const midY = (sourcePos.y + targetPos.y) / 2;
        
        edgeElements.push(`
          <text x="${midX}" y="${midY}" text-anchor="middle" 
                font-family="Arial, sans-serif" font-size="10" 
                fill="#6c757d" opacity="0.8">
            ${edge.label}
          </text>
        `);
      }
    }
    
    return edgeElements.join('\n');
  }

  /**
   * Draw all nodes
   */
  private drawNodes(nodes: TaskNode[], layout: Map<string, { x: number; y: number }>): string {
    const nodeElements = [];
    
    for (const node of nodes) {
      const pos = layout.get(node.id);
      if (!pos) continue;
      
      const fillColor = this.getNodeColor(node);
      const strokeColor = this.getNodeStrokeColor(node);
      const radius = this.getNodeRadius(node);
      
      // Node circle
      nodeElements.push(`
        <circle cx="${pos.x}" cy="${pos.y}" r="${radius}"
                fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"
                opacity="0.9">
          <title>${node.title} (${node.id})\nStatus: ${node.status}\nPriority: ${node.priority}</title>
        </circle>
      `);
      
      // Progress indicator (if enabled)
      if (this.config.showProgress && node.status !== 'pending') {
        const progressAngle = this.getProgressAngle(node);
        nodeElements.push(`
          <path d="M ${pos.x} ${pos.y - radius} A ${radius} ${radius} 0 ${progressAngle > 180 ? 1 : 0} 1 ${pos.x + radius * Math.sin(progressAngle * Math.PI / 180)} ${pos.y - radius * Math.cos(progressAngle * Math.PI / 180)}"
                stroke="#28a745" stroke-width="3" fill="none" opacity="0.8" />
        `);
      }
      
      // Node label
      if (this.config.showLabels) {
        const labelText = node.title.length > 15 ? node.title.substring(0, 12) + '...' : node.title;
        nodeElements.push(`
          <text x="${pos.x}" y="${pos.y + radius + 15}" text-anchor="middle"
                font-family="Arial, sans-serif" font-size="11" fill="#495057">
            ${labelText}
          </text>
        `);
        
        // Node ID
        nodeElements.push(`
          <text x="${pos.x}" y="${pos.y + 3}" text-anchor="middle"
                font-family="Arial, sans-serif" font-size="9" font-weight="bold" fill="#ffffff">
            ${node.id}
          </text>
        `);
      }
    }
    
    return nodeElements.join('\n');
  }

  /**
   * Get node color based on color scheme
   */
  private getNodeColor(node: TaskNode): string {
    switch (this.config.colorScheme) {
      case 'status':
        return this.getStatusColor(node.status);
      case 'priority':
        return this.getPriorityColor(node.priority);
      case 'complexity':
        return this.getComplexityColor(node.complexity || 5);
      default:
        return this.getStatusColor(node.status);
    }
  }

  private getStatusColor(status: string): string {
    const colors = {
      'pending': '#6c757d',
      'in-progress': '#007bff',
      'done': '#28a745',
      'blocked': '#dc3545',
      'deferred': '#ffc107',
      'cancelled': '#343a40'
    };
    return colors[status as keyof typeof colors] || '#6c757d';
  }

  private getPriorityColor(priority: string): string {
    const colors = {
      'low': '#28a745',
      'medium': '#ffc107',
      'high': '#fd7e14',
      'critical': '#dc3545'
    };
    return colors[priority as keyof typeof colors] || '#6c757d';
  }

  private getComplexityColor(complexity: number): string {
    if (complexity <= 3) return '#28a745';
    if (complexity <= 6) return '#ffc107';
    if (complexity <= 8) return '#fd7e14';
    return '#dc3545';
  }

  private getNodeStrokeColor(node: TaskNode): string {
    if (node.isSubtask) return '#6f42c1';
    if (node.priority === 'critical') return '#dc3545';
    return '#495057';
  }

  private getNodeRadius(node: TaskNode): number {
    if (node.isSubtask) return 15;
    if (node.priority === 'critical') return 25;
    if (node.priority === 'high') return 22;
    return 20;
  }

  private getEdgeColor(edge: DependencyEdge): string {
    const colors = {
      'dependency': '#6c757d',
      'blocks': '#dc3545',
      'subtask': '#6f42c1'
    };
    return colors[edge.type] || '#6c757d';
  }

  private getEdgeWidth(edge: DependencyEdge): number {
    if (edge.type === 'blocks') return 3;
    if (edge.weight && edge.weight > 3) return 2.5;
    return 2;
  }

  private getProgressAngle(node: TaskNode): number {
    if (node.status === 'done') return 360;
    if (node.status === 'in-progress') return 180;
    if (node.status === 'blocked') return 90;
    return 0;
  }

  /**
   * Draw legend
   */
  private drawLegend(width: number, height: number): string {
    const legend = [];
    const startX = width - 200;
    const startY = 80;
    
    legend.push(`<rect x="${startX - 10}" y="${startY - 10}" width="180" height="120" fill="white" stroke="#dee2e6" stroke-width="1" opacity="0.9" rx="5"/>`);
    legend.push(`<text x="${startX}" y="${startY + 5}" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#495057">Legend</text>`);
    
    // Status colors
    const statuses = [
      { status: 'pending', color: '#6c757d', label: 'Pending' },
      { status: 'in-progress', color: '#007bff', label: 'In Progress' },
      { status: 'done', color: '#28a745', label: 'Done' },
      { status: 'blocked', color: '#dc3545', label: 'Blocked' }
    ];
    
    statuses.forEach((item, index) => {
      const y = startY + 20 + (index * 20);
      legend.push(`<circle cx="${startX + 10}" cy="${y}" r="6" fill="${item.color}"/>`);
      legend.push(`<text x="${startX + 25}" y="${y + 4}" font-family="Arial, sans-serif" font-size="10" fill="#495057">${item.label}</text>`);
    });
    
    return legend.join('\n');
  }

  /**
   * Draw statistics panel
   */
  private drawStatistics(graph: DependencyGraph, width: number): string {
    const stats = [];
    const startX = 20;
    const startY = 80;
    
    stats.push(`<rect x="${startX - 10}" y="${startY - 10}" width="200" height="100" fill="white" stroke="#dee2e6" stroke-width="1" opacity="0.9" rx="5"/>`);
    stats.push(`<text x="${startX}" y="${startY + 5}" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#495057">Statistics</text>`);
    
    const statsData = [
      `Total Tasks: ${graph.metadata.totalTasks}`,
      `Dependencies: ${graph.metadata.totalDependencies}`,
      `Complexity: ${graph.metadata.complexity}`,
      `Orphan Tasks: ${graph.metadata.orphanTasks.length}`,
      `Cycles: ${graph.metadata.cycles.length}`
    ];
    
    statsData.forEach((stat, index) => {
      const y = startY + 20 + (index * 15);
      stats.push(`<text x="${startX}" y="${y}" font-family="Arial, sans-serif" font-size="10" fill="#495057">${stat}</text>`);
    });
    
    return stats.join('\n');
  }
}

export class DependencyVisualizer {
  private projectRoot: string;
  private graphBuilder: DependencyGraphBuilder;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.graphBuilder = new DependencyGraphBuilder(projectRoot);
  }

  /**
   * Generate and save dependency visualization
   */
  public generateVisualization(config: Partial<VisualizationConfig> = {}): string {
    const graph = this.graphBuilder.buildGraph();
    const svgGenerator = new SVGVisualizationGenerator(config);
    const svg = svgGenerator.generateSVG(graph);
    
    // Save to file
    const outputPath = join(this.projectRoot, '.taskmaster', 'reports', 'dependency-graph.svg');
    writeFileSync(outputPath, svg);
    
    console.log(`Dependency visualization saved to: ${outputPath}`);
    return outputPath;
  }

  /**
   * Generate interactive HTML visualization
   */
  public generateInteractiveVisualization(config: Partial<VisualizationConfig> = {}): string {
    const graph = this.graphBuilder.buildGraph();
    const html = this.createInteractiveHTML(graph, config);
    
    // Save to file
    const outputPath = join(this.projectRoot, '.taskmaster', 'reports', 'dependency-graph.html');
    writeFileSync(outputPath, html);
    
    console.log(`Interactive dependency visualization saved to: ${outputPath}`);
    return outputPath;
  }

  /**
   * Get dependency graph data
   */
  public getGraph(): DependencyGraph {
    return this.graphBuilder.buildGraph();
  }

  /**
   * Analyze dependency graph for issues
   */
  public analyzeDependencies(): any {
    const graph = this.graphBuilder.buildGraph();
    
    return {
      summary: {
        totalTasks: graph.metadata.totalTasks,
        totalDependencies: graph.metadata.totalDependencies,
        complexity: graph.metadata.complexity
      },
      issues: {
        cycles: graph.metadata.cycles.length > 0 ? {
          count: graph.metadata.cycles.length,
          cycles: graph.metadata.cycles,
          recommendation: 'Remove circular dependencies to prevent deadlocks'
        } : null,
        orphanTasks: graph.metadata.orphanTasks.length > 0 ? {
          count: graph.metadata.orphanTasks.length,
          tasks: graph.metadata.orphanTasks,
          recommendation: 'Review orphan tasks for proper integration into workflow'
        } : null,
        highComplexity: graph.metadata.complexity > 7 ? {
          complexity: graph.metadata.complexity,
          recommendation: 'Consider simplifying task dependencies to reduce complexity'
        } : null
      },
      insights: {
        criticalPath: graph.metadata.criticalPath,
        recommendations: this.generateRecommendations(graph)
      }
    };
  }

  /**
   * Create interactive HTML visualization
   */
  private createInteractiveHTML(graph: DependencyGraph, config: Partial<VisualizationConfig>): string {
    const svgGenerator = new SVGVisualizationGenerator(config);
    const svg = svgGenerator.generateSVG(graph, 1400, 900);
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Task Dependency Visualization - JBR Trading Platform</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f8f9fa; }
        .container { max-width: 1600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2rem; border-radius: 10px; margin-bottom: 2rem; }
        .controls { background: white; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .control-group { display: inline-block; margin-right: 2rem; }
        .control-group label { display: block; font-weight: bold; margin-bottom: 0.5rem; }
        .control-group select, .control-group input { padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; }
        .visualization { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden; }
        .stats-panel { background: white; padding: 1rem; border-radius: 8px; margin-top: 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
        .stat-item { text-align: center; padding: 1rem; background: #f8f9fa; border-radius: 6px; }
        .stat-value { font-size: 2rem; font-weight: bold; color: #667eea; }
        .stat-label { color: #6c757d; font-size: 0.9rem; }
        .analysis-panel { background: white; padding: 1rem; border-radius: 8px; margin-top: 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .issue { padding: 1rem; margin: 0.5rem 0; border-left: 4px solid #dc3545; background: #f8d7da; border-radius: 4px; }
        .recommendation { padding: 1rem; margin: 0.5rem 0; border-left: 4px solid #28a745; background: #d4edda; border-radius: 4px; }
        svg { width: 100%; height: auto; display: block; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Task Dependency Visualization</h1>
            <p>Interactive view of project task dependencies and relationships</p>
        </div>

        <div class="controls">
            <div class="control-group">
                <label>Layout:</label>
                <select id="layoutSelect" onchange="updateVisualization()">
                    <option value="hierarchical">Hierarchical</option>
                    <option value="force">Force-Directed</option>
                    <option value="circular">Circular</option>
                </select>
            </div>
            <div class="control-group">
                <label>Color Scheme:</label>
                <select id="colorSelect" onchange="updateVisualization()">
                    <option value="status">By Status</option>
                    <option value="priority">By Priority</option>
                    <option value="complexity">By Complexity</option>
                </select>
            </div>
            <div class="control-group">
                <label>Show:</label>
                <input type="checkbox" id="showLabels" onchange="updateVisualization()" checked> Labels
                <input type="checkbox" id="showSubtasks" onchange="updateVisualization()" checked> Subtasks
                <input type="checkbox" id="showProgress" onchange="updateVisualization()" checked> Progress
            </div>
        </div>

        <div class="visualization">
            ${svg}
        </div>

        <div class="stats-panel">
            <h3>Project Statistics</h3>
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-value">${graph.metadata.totalTasks}</div>
                    <div class="stat-label">Total Tasks</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${graph.metadata.totalDependencies}</div>
                    <div class="stat-label">Dependencies</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${graph.metadata.complexity}</div>
                    <div class="stat-label">Complexity Score</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${graph.metadata.orphanTasks.length}</div>
                    <div class="stat-label">Orphan Tasks</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${graph.metadata.cycles.length}</div>
                    <div class="stat-label">Circular Dependencies</div>
                </div>
            </div>
        </div>

        <div class="analysis-panel">
            <h3>Dependency Analysis</h3>
            ${graph.metadata.cycles.length > 0 ? `
                <div class="issue">
                    <strong>Circular Dependencies Detected:</strong> ${graph.metadata.cycles.length} cycles found.
                    These can cause deadlocks and should be resolved.
                </div>
            ` : ''}
            ${graph.metadata.orphanTasks.length > 0 ? `
                <div class="issue">
                    <strong>Orphan Tasks:</strong> ${graph.metadata.orphanTasks.length} tasks have no dependencies or dependents.
                    Consider integrating them into the main workflow.
                </div>
            ` : ''}
            ${graph.metadata.criticalPath.length > 0 ? `
                <div class="recommendation">
                    <strong>Critical Path:</strong> Focus on tasks ${graph.metadata.criticalPath.join(' → ')} 
                    as they are on the critical path for project completion.
                </div>
            ` : ''}
        </div>
    </div>

    <script>
        function updateVisualization() {
            // This would typically make an AJAX call to regenerate the visualization
            // For now, we'll just show that the controls are interactive
            console.log('Visualization update requested');
            
            const layout = document.getElementById('layoutSelect').value;
            const colorScheme = document.getElementById('colorSelect').value;
            const showLabels = document.getElementById('showLabels').checked;
            const showSubtasks = document.getElementById('showSubtasks').checked;
            const showProgress = document.getElementById('showProgress').checked;
            
            console.log('Config:', { layout, colorScheme, showLabels, showSubtasks, showProgress });
        }

        // Add zoom and pan functionality
        document.addEventListener('DOMContentLoaded', function() {
            const svg = document.querySelector('svg');
            let isPanning = false;
            let startPoint = { x: 0, y: 0 };
            let endPoint = { x: 0, y: 0 };
            let scale = 1;

            svg.addEventListener('wheel', function(e) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                scale *= delta;
                scale = Math.max(0.1, Math.min(3, scale));
                svg.style.transform = \`scale(\${scale})\`;
            });

            svg.addEventListener('mousedown', function(e) {
                isPanning = true;
                startPoint = { x: e.clientX, y: e.clientY };
                svg.style.cursor = 'grabbing';
            });

            document.addEventListener('mousemove', function(e) {
                if (isPanning) {
                    const dx = e.clientX - startPoint.x;
                    const dy = e.clientY - startPoint.y;
                    svg.style.transform = \`scale(\${scale}) translate(\${dx}px, \${dy}px)\`;
                }
            });

            document.addEventListener('mouseup', function() {
                isPanning = false;
                svg.style.cursor = 'grab';
            });
        });
    </script>
</body>
</html>`;
  }

  /**
   * Generate recommendations based on graph analysis
   */
  private generateRecommendations(graph: DependencyGraph): string[] {
    const recommendations: string[] = [];

    if (graph.metadata.cycles.length > 0) {
      recommendations.push('Resolve circular dependencies to prevent task deadlocks');
    }

    if (graph.metadata.orphanTasks.length > 0) {
      recommendations.push('Review orphan tasks and integrate them into the main workflow');
    }

    if (graph.metadata.complexity > 7) {
      recommendations.push('Consider simplifying task dependencies to reduce project complexity');
    }

    const highPriorityNodes = graph.nodes.filter(n => n.priority === 'critical' || n.priority === 'high');
    const blockedHighPriority = highPriorityNodes.filter(n => n.status === 'blocked');
    
    if (blockedHighPriority.length > 0) {
      recommendations.push('Prioritize unblocking high-priority tasks to maintain project momentum');
    }

    if (graph.metadata.criticalPath.length > 5) {
      recommendations.push('Critical path is long - consider parallel execution or task breakdown');
    }

    return recommendations;
  }
}
