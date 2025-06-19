/**
 * Task status enumeration based on Task Master CLI
 */
export type TaskStatus =
  | "pending"
  | "in-progress"
  | "done"
  | "blocked"
  | "deferred"
  | "cancelled"
  | "review";

/**
 * Task priority levels
 */
export type TaskPriority = "high" | "medium" | "low";

/**
 * Union type for representing either a task or subtask in current/next task contexts
 */
export type TaskOrSubtask =
  | { type: "task"; task: Task }
  | { type: "subtask"; subtask: Subtask };

/**
 * Subtask structure
 */
export interface Subtask {
  id: string | number;
  title: string;
  description?: string;
  status: TaskStatus;
  dependencies?: number[];
  parentId: number;
}

/**
 * Main task structure from Task Master CLI
 */
export interface Task {
  id: number | string;
  title: string;
  description: string;
  details?: string;
  priority: TaskPriority;
  status: TaskStatus;
  dependencies?: number[];
  subtasks?: Subtask[];
  complexityScore?: number;
  filePath?: string;
}

/**
 * Task Master CLI response structure
 */
export interface TaskMasterResponse {
  data: {
    tasks: Task[];
    filter: string;
    stats: TaskStats;
  };
  version: {
    version: string;
    name: string;
  };
  tag: {
    currentTag: string;
    availableTags: string[];
  };
}

/**
 * Tasks.json file structure (actual file format)
 */
export interface TasksFileStructure {
  metadata: {
    version: string;
    created: string;
    lastModified: string;
  };
  tags: {
    [tagName: string]: {
      name: string;
      description: string;
      current: boolean;
      tasks: Task[];
    };
  };
}

/**
 * Task statistics from CLI
 */
export interface TaskStats {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  blocked: number;
  deferred: number;
  cancelled: number;
  review: number;
  completionPercentage: number;
  subtasks: {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    blocked: number;
    deferred: number;
    cancelled: number;
    completionPercentage: number;
  };
}

/**
 * CLI command execution options
 */
export interface CLIExecutionOptions {
  withSubtasks?: boolean;
  status?: TaskStatus;
  format?: "text";
  timeout?: number;
  extraArgs?: string[];
  readFromFile?: boolean; // New option to force reading from file vs CLI
}

/**
 * Configuration for the Task Master extension
 */
export interface TaskMasterConfig {
  cliPath: string;
}

/**
 * Task complexity analysis from complexity report
 */
export interface TaskComplexityAnalysis {
  taskId: number;
  taskTitle: string;
  complexityScore: number;
  recommendedSubtasks: number;
  expansionPrompt: string;
  reasoning: string;
}

/**
 * Task complexity report structure
 */
export interface TaskComplexityReport {
  meta: {
    generatedAt: string;
    tasksAnalyzed: number;
    totalTasks: number;
    analysisCount: number;
    thresholdScore: number;
    projectName: string;
    usedResearch: boolean;
  };
  complexityAnalysis: TaskComplexityAnalysis[];
}

/**
 * Enhanced tag information structure
 */
export interface TagInfo {
  name: string;
  taskCount: number;
  description?: string;
  metadata?: {
    createdAt?: string;
    lastModified?: string;
    [key: string]: any;
  };
}

/**
 * Tag service response structure
 */
export interface TagServiceResponse {
  currentTag: string;
  availableTags: TagInfo[];
  totalTasks: number;
}

/**
 * Tag cache entry structure for performance optimization
 */
export interface TagCacheEntry {
  tag: string;
  tasks: Task[];
  lastUpdated: number;
  stats: TaskStats;
}
