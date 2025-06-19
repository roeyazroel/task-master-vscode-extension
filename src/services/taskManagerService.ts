import { EventEmitter } from "events";
import * as vscode from "vscode";
import {
  Subtask,
  TagInfo,
  TagServiceResponse,
  Task,
  TaskComplexityReport,
  TaskMasterConfig,
  TaskMasterResponse,
  TaskOrSubtask,
  TaskStatus,
} from "../types";
import { log } from "../utils/logger";
import { parseNextTaskOutput } from "../utils/outputParser";
import {
  setCurrentSelectedTag,
  taskFilterManager,
} from "../utils/taskFilterUtils";
import { CLIManagementService } from "./cliManagementService";
import { CLIService } from "./cliService";
import { ConfigService } from "./configService";
import { FileWatcherService } from "./fileWatcherService";
import { TaskCacheService } from "./taskCacheService";
import { TaskOperationsService } from "./taskOperationsService";

/**
 * Main service for managing Task Master integration
 * Orchestrates CLI operations, caching, and event handling with tag filtering
 */
export class TaskManagerService extends EventEmitter {
  private cliService: CLIService;
  private configService: ConfigService;
  private taskCacheService: TaskCacheService;
  private taskOperationsService: TaskOperationsService;
  private cliManagementService: CLIManagementService;
  private fileWatcherService: FileWatcherService;
  private configChangeListener?: vscode.Disposable;
  private isInitialized: boolean = false;

  constructor() {
    super();
    const config = ConfigService.getConfig();
    this.cliService = new CLIService(config);
    this.configService = ConfigService;
    this.taskCacheService = new TaskCacheService();
    this.taskOperationsService = new TaskOperationsService(this.cliService);
    this.cliManagementService = new CLIManagementService();
    this.fileWatcherService = new FileWatcherService();
    this.setupEventHandlers();
  }

  /**
   * Initialize the service and start polling if configured
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Check CLI availability but don't block initialization
      const isAvailable = await this.checkCLIAvailability();
      if (!isAvailable) {
        // Show warning but continue initialization since we can read from files
        console.warn(
          "Task Master CLI not available, but continuing with file-based operations"
        );
        this.emit("cliNotAvailable");
      }

      // Setup configuration change listener
      this.configChangeListener = ConfigService.onConfigurationChanged(
        (config) => {
          this.handleConfigurationChange(config);
        }
      );

      // Setup file watchers for tasks and complexity files
      await this.fileWatcherService.setupFileWatchers(async () => {
        await this.refreshTasks();
      });

      // Auto-load current tag on startup
      await this.loadCurrentTagOnStartup();

      this.isInitialized = true;
      this.emit("initialized");
    } catch (error) {
      console.error("Failed to initialize TaskManagerService:", error);
      this.emit("initializationError", error);
    }
  }

  /**
   * Auto-load current tag on startup by detecting from config and setting filter
   */
  private async loadCurrentTagOnStartup(): Promise<void> {
    try {
      console.log("Loading current tag on startup...");

      // Get current tag from TagService (reads from config.json)
      const currentTag = this.getCurrentTag();
      console.log(`Current tag detected: ${currentTag}`);

      // Update filter manager to use the current tag
      setCurrentSelectedTag(currentTag);
      console.log(`Filter manager updated to tag: ${currentTag}`);

      // Load tasks with current tag filtering
      await this.refreshTasks();
      console.log(`Tasks refreshed for tag: ${currentTag}`);

      // Emit tag change event to update UI components
      this.emit("currentTagChanged", {
        oldTag: "master", // Default from filter manager
        newTag: currentTag,
      });
    } catch (error) {
      console.error("Failed to load current tag on startup:", error);
      // Don't fail initialization, just use default behavior
    }
  }

  /**
   * Setup event handlers for CLI service and other services
   */
  private setupEventHandlers(): void {
    this.cliService.on("outputReceived", (output: string) => {
      this.emit("cliOutput", output);
    });

    this.taskCacheService.on("tasksUpdated", (tasks: Task[]) => {
      this.emit("tasksUpdated", tasks);
    });

    this.taskCacheService.on("refreshError", (error: any) => {
      this.emit("refreshError", error);
    });

    // Add tag-related event handlers
    this.taskCacheService.on("currentTagChanged", ({ oldTag, newTag }) => {
      // Update the filter manager when tag changes
      setCurrentSelectedTag(newTag);
      this.emit("currentTagChanged", { oldTag, newTag });
    });

    this.taskCacheService.on("tagsUpdated", (tags: TagInfo[]) => {
      this.emit("tagsUpdated", tags);
    });

    this.taskCacheService.on("tagError", (error: any) => {
      this.emit("tagError", error);
    });
  }

  /**
   * Handle configuration changes
   */
  private handleConfigurationChange(config: TaskMasterConfig): void {
    this.cliService.updateConfig(config);
    this.emit("configurationChanged", config);
  }

  /**
   * Check if CLI is available and prompt user if not
   */
  public async checkCLIAvailability(): Promise<boolean> {
    const isAvailable = await this.cliService.checkCLIAvailability();
    if (!isAvailable) {
      this.emit("cliNotAvailable");
      await this.cliManagementService.handleCLINotAvailable();
    }
    return isAvailable;
  }

  /**
   * Refresh tasks manually
   */
  public async refreshTasks(): Promise<TaskMasterResponse | null> {
    return await this.taskCacheService.refreshTasksFromFile();
  }

  /**
   * Get cached tasks
   */
  public getTasks(): Task[] {
    return this.taskCacheService.getTasks();
  }

  /**
   * Get cached response with metadata
   */
  public getResponse(): TaskMasterResponse | null {
    return this.taskCacheService.getResponse();
  }

  /**
   * Get tasks filtered by status
   */
  public getTasksByStatus(status: TaskStatus): Task[] {
    return this.taskCacheService.getTasksByStatus(status);
  }

  /**
   * Get a specific task by ID
   */
  public getTask(id: number): Task | undefined {
    return this.taskCacheService.getTask(id);
  }

  /**
   * Execute a task command (mark complete, etc.) with security validation
   */
  public async executeTaskCommand(
    command: string,
    taskId: number,
    status?: string
  ): Promise<boolean> {
    const result = await this.taskOperationsService.executeTaskCommand(
      command,
      taskId,
      status
    );
    if (result) {
      await this.refreshTasks();
    }
    return result;
  }

  /**
   * Get next actionable task or subtask
   */
  public async getNextTaskOrSubtask(): Promise<TaskOrSubtask | null> {
    try {
      // Use the CLI next command directly (bypass file reading)
      const rawOutput = await this.cliService.getNextTaskFromCLI();
      if (rawOutput) {
        const parsed = parseNextTaskOutput(rawOutput);
        if (parsed.id) {
          if (parsed.isSubtask && typeof parsed.id === "string") {
            // Find the subtask and its parent task in our cached tasks
            const parentId = parsed.id.split(".")[0];
            const subtaskId = parsed.id.split(".")[1];
            const subtask = this.findSubtaskById(parseInt(parentId), subtaskId);

            if (parsed.isSubtask) {
              return {
                type: "subtask",
                subtask: subtask!,
              };
            }
          } else {
            // Regular task - find it in our cached tasks
            const task = this.getTask(parsed.id as number);
            if (task) {
              return {
                type: "task",
                task,
              };
            }
          }
        }
      }

      // Fallback to cache service if CLI parsing fails
      const fallbackTask = this.taskCacheService.getNextTask();
      if (fallbackTask) {
        log("fallbackTask");
        return {
          type: "task",
          task: fallbackTask,
        };
      }

      log("null");
      return null;
    } catch (error) {
      console.error("Failed to get next task from CLI:", error);
      // Fallback: use cache service
      const fallbackTask = this.taskCacheService.getNextTask();
      if (fallbackTask) {
        return {
          type: "task",
          task: fallbackTask,
        };
      }
      return null;
    }
  }

  /**
   * Get next actionable task (legacy method for compatibility)
   */
  public async getNextTask(): Promise<Task | null> {
    const result = await this.getNextTaskOrSubtask();
    if (result) {
      if (result.type === "task") {
        return result.task;
      } else {
        // For subtasks, return a Task-like object for backward compatibility
        return {
          id: `${result.subtask.parentId}.${result.subtask.id}`, // Keep string ID for subtasks
          title: result.subtask.title,
          description: result.subtask.description || "",
          status: result.subtask.status,
          priority: "medium", // Default priority for subtasks
          dependencies: result.subtask.dependencies || [],
          subtasks: [],
          details: "",
          testStrategy: "",
        } as Task;
      }
    }
    return null;
  }

  /**
   * Find a subtask by its ID (format: "parentId.subtaskId") in the cached tasks
   */
  /**
   * Find a subtask by its parent task ID and subtask ID
   * @param parentId - ID of the parent task
   * @param subtaskId - ID of the subtask (can be just the ID or parentId.subtaskId format)
   * @returns The matching subtask or null if not found
   */
  private findSubtaskById(parentId: number, subtaskId: string): Subtask | null {
    const tasks = this.getTasks();

    // Find the parent task
    const parentTask = tasks.find((task) => task.id === parentId);
    if (!parentTask?.subtasks) {
      return null;
    }

    // Check both possible subtask ID formats:
    // 1. Just the subtask ID number
    // 2. Full format: "parentId.subtaskId"
    const subtask = parentTask.subtasks.find(
      (subtask) =>
        subtask.id === parseInt(subtaskId) ||
        subtask.id === `${parentId}.${subtaskId}`
    );

    if (subtask) {
      return {
        ...subtask,
        parentId: parentId,
      };
    } else {
      return null;
    }
  }

  /**
   * Get current task (first in-progress task, or fallback to first pending)
   */
  public getCurrentTask(): Task | null {
    const tasks = this.getTasks();

    // First, look for an in-progress task
    const inProgressTask = tasks.find((task) => task.status === "in-progress");
    if (inProgressTask) {
      return inProgressTask;
    }

    // Fallback: get first pending task
    const pendingTask = tasks.find((task) => task.status === "pending");
    return pendingTask || null;
  }

  /**
   * Check if service is currently refreshing
   */
  public isRefreshing(): boolean {
    return this.cliService.isRefreshing();
  }

  /**
   * Get last refresh time
   */
  public getLastRefreshTime(): number {
    return this.cliService.getLastRefreshTime();
  }

  /**
   * Start auto-refresh polling
   * Note: We use file watchers instead of CLI polling
   */
  public startPolling(): void {
    // No-op: We use file watchers instead of CLI polling
  }

  /**
   * Stop auto-refresh polling
   * Note: We use file watchers instead of CLI polling
   */
  public stopPolling(): void {
    // No-op: We use file watchers instead of CLI polling
  }

  /**
   * Get complexity report
   */
  public async getComplexityReport(): Promise<TaskComplexityReport | null> {
    return await this.taskOperationsService.getComplexityReport();
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    this.cliService.dispose();
    if (this.configChangeListener) {
      this.configChangeListener.dispose();
    }
    this.fileWatcherService.dispose();
    this.taskCacheService.clearCache();
    this.removeAllListeners();
    this.isInitialized = false;
  }

  /**
   * Add a new task by prompting the user for details and invoking the CLI (AI-powered)
   */
  public async addTask(): Promise<void> {
    return this.taskOperationsService.addTask(async () => {
      await this.refreshTasks();
    });
  }

  /**
   * Delete a task by ID, handling dependencies and confirmation
   */
  public async deleteTask(taskId?: number): Promise<void> {
    return this.taskOperationsService.deleteTask(taskId, async () => {
      await this.refreshTasks();
    });
  }

  /**
   * Add a dependency to a task
   */
  public async addDependency(srcId?: number, depId?: number): Promise<void> {
    return this.taskOperationsService.addDependency(srcId, depId, async () => {
      await this.refreshTasks();
    });
  }

  /**
   * Remove a dependency from a task
   */
  public async removeDependency(srcId?: number, depId?: number): Promise<void> {
    return this.taskOperationsService.removeDependency(
      srcId,
      depId,
      async () => {
        await this.refreshTasks();
      }
    );
  }

  /**
   * Validate dependencies for all tasks
   */
  public async validateDependencies(): Promise<void> {
    return this.taskOperationsService.validateDependencies();
  }

  /**
   * Fix dependencies for all tasks
   */
  public async fixDependencies(): Promise<void> {
    return this.taskOperationsService.fixDependencies(async () => {
      await this.refreshTasks();
    });
  }

  /**
   * Show task details in a VS Code editor tab using the CLI
   */
  public async showTaskDetails(taskId?: number): Promise<void> {
    return this.taskOperationsService.showTaskDetails(taskId);
  }

  /**
   * Expand a task into subtasks using the CLI
   */
  public async expandTask(taskId?: number): Promise<void> {
    return this.taskOperationsService.expandTask(taskId, async () => {
      await this.refreshTasks();
    });
  }

  /**
   * Expand all pending tasks into subtasks using the CLI
   */
  public async expandAllTasks(): Promise<void> {
    return this.taskOperationsService.expandAllTasks(async () => {
      await this.refreshTasks();
    });
  }

  /**
   * Get all available tags with metadata
   */
  public async getAllTags(): Promise<TagInfo[]> {
    return await this.taskCacheService.getAllTags();
  }

  /**
   * Get tasks for a specific tag
   */
  public async getTasksByTag(tagId: string): Promise<Task[]> {
    return await this.taskCacheService.getTasksByTag(tagId);
  }

  /**
   * Get current tag information with metadata
   */
  public async getCurrentTagInfo(): Promise<TagServiceResponse> {
    return await this.taskCacheService.getCurrentTagInfo();
  }

  /**
   * Set the current active tag with filter synchronization
   */
  public async setCurrentTag(tagId: string): Promise<boolean> {
    const success = await this.taskCacheService.setCurrentTag(tagId);
    if (success) {
      // Update the filter manager
      setCurrentSelectedTag(tagId);
      // Refresh tasks after tag change
      await this.refreshTasks();
    }
    return success;
  }

  /**
   * Get current active tag name
   */
  public getCurrentTag(): string {
    return this.taskCacheService.getCurrentTag();
  }

  /**
   * Get filtered tasks for the current tag
   * Uses client-side filtering logic for optimization
   */
  public getFilteredTasks(): Task[] {
    const allTasks = this.getTasks();
    return taskFilterManager.filterTasksByTag(allTasks);
  }

  /**
   * Get filtered tasks for a specific tag
   * Note: This requires switching tags to get accurate results in CLI-based approach
   */
  public async getFilteredTasksForTag(tagId: string): Promise<Task[]> {
    if (tagId === this.getCurrentTag()) {
      return this.getFilteredTasks();
    }

    // For different tag, we need to get tasks using TagService
    return await this.getTasksByTag(tagId);
  }

  /**
   * Get filter statistics for debugging
   */
  public getFilterStats(): {
    currentTag: string;
    cachedTasksCount: number;
    lastFilterTime: number;
    cacheAge: number;
    isValid: boolean;
  } {
    return taskFilterManager.getFilterStats();
  }

  /**
   * Update an existing task by prompting the user for new details
   */
  public async updateTask(taskId?: number): Promise<void> {
    return this.taskOperationsService.updateTask(taskId, async () => {
      await this.refreshTasks();
    });
  }

  /**
   * Analyze task complexity using AI to provide recommendations for task expansion
   */
  public async analyzeComplexity(): Promise<void> {
    return this.taskOperationsService.analyzeComplexity(async () => {
      await this.refreshTasks();
    });
  }

  /**
   * Show complexity analysis report
   */
  public async showComplexityReport(): Promise<void> {
    return this.taskOperationsService.showComplexityReport();
  }

  // ===== SUBTASK MANAGEMENT METHODS =====

  /**
   * Update a subtask by appending timestamped information
   */
  public async updateSubtask(
    subtaskId: string,
    updateText: string
  ): Promise<void> {
    return this.taskOperationsService.updateSubtask(
      subtaskId,
      updateText,
      async () => {
        await this.refreshTasks();
      }
    );
  }

  /**
   * Set the status of a subtask
   */
  public async setSubtaskStatus(
    subtaskId: string,
    status: string
  ): Promise<void> {
    return this.taskOperationsService.setSubtaskStatus(
      subtaskId,
      status,
      async () => {
        await this.refreshTasks();
      }
    );
  }

  /**
   * Remove a subtask from its parent task
   */
  public async removeSubtask(subtaskId: string): Promise<void> {
    return this.taskOperationsService.removeSubtask(subtaskId, async () => {
      await this.refreshTasks();
    });
  }
}
