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
  // No single cliService instance here. Scoped instances will be created as needed or managed.
  private configService: typeof ConfigService; // Static class
  private taskCacheService: TaskCacheService;
  private taskOperationsService: TaskOperationsService;
  private cliManagementService: CLIManagementService; // May also need context awareness if it runs CLI commands
  private fileWatcherService: FileWatcherService;
  private configChangeListener?: vscode.Disposable;
  private isInitialized: boolean = false;

  // To keep track of which folders have .taskmaster and are being managed
  private managedWorkspaceFolderUris: Set<string> = new Set();

  constructor() {
    super();
    // ConfigService is static, no instantiation.
    this.configService = ConfigService;
    this.taskCacheService = new TaskCacheService(); // Now multi-folder aware
    this.taskOperationsService = new TaskOperationsService(); // Now creates scoped CLIServices
    this.cliManagementService = new CLIManagementService(); // Review if it needs context
    this.fileWatcherService = new FileWatcherService(); // Now multi-folder aware
    this.setupEventHandlers();
  }

  /**
   * Returns a list of URIs for workspace folders that are managed TaskMaster projects.
   */
  public getManagedFolderUris(): string[] {
    return Array.from(this.managedWorkspaceFolderUris);
  }

  /**
   * Initialize the service and start polling if configured
   */
  private async isTaskMasterProject(folderUriString: string): Promise<boolean> {
    try {
      const tasksJsonPath = vscode.Uri.joinPath(
        vscode.Uri.parse(folderUriString),
        ".taskmaster",
        "tasks",
        "tasks.json"
      );
      await vscode.workspace.fs.stat(tasksJsonPath);
      return true;
    } catch {
      return false;
    }
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    this.managedWorkspaceFolderUris.clear();

    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (workspaceFolders) {
        for (const folder of workspaceFolders) {
          const folderUriString = folder.uri.toString();
          if (await this.isTaskMasterProject(folderUriString)) {
            console.log(
              `Initializing TaskMaster for project in ${folderUriString}`
            );
            this.managedWorkspaceFolderUris.add(folderUriString);

            // Check CLI availability for this specific folder
            // Note: checkCLIAvailability might need to become folder-specific if CLI path can vary
            const isAvailable = await this.checkCLIAvailability(
              folderUriString
            ); // Pass folder URI
            if (!isAvailable) {
              console.warn(
                `Task Master CLI not available for ${folderUriString}, but continuing with file-based operations`
              );
              this.emit("cliNotAvailable", { folderUriString }); // Add context
            }

            // Setup file watchers for this folder
            await this.fileWatcherService.setupWatchersForWorkspaceFolder(
              folderUriString,
              async (changedFolderUri) => {
                await this.refreshTasks(changedFolderUri);
              }
            );

            // Auto-load current tag on startup for this folder
            await this.loadCurrentTagForFolder(folderUriString);
          } else {
            console.log(
              `Folder ${folderUriString} is not a TaskMaster project, skipping.`
            );
          }
        }
      } else {
        console.log("No workspace folders open. TaskManagerService not fully initialized.");
        // Potentially handle single file open scenarios if desired, though less common for this extension type
      }

      // Setup global configuration change listener (might need refinement if configs are per-folder)
      this.configChangeListener = this.configService.onConfigurationChanged(
        (config) => { // config here is global, might need to re-check all managed folders
          this.handleConfigurationChange(config); // This method will need to iterate managed folders
        }
      );

      this.isInitialized = true;
      this.emit("initialized"); // Global initialized event
    } catch (error) {
      console.error("Failed to initialize TaskManagerService:", error);
      this.emit("initializationError", { error }); // Add context if possible, though this is global init error
    }
  }

  /**
   * Auto-load current tag on startup for a specific folder.
   * @param workspaceFolderUri The URI of the workspace folder.
   */
  private async loadCurrentTagForFolder(
    workspaceFolderUri: string
  ): Promise<void> {
    try {
      console.log(
        `Loading current tag on startup for ${workspaceFolderUri}...`
      );

      const currentTag = this.getCurrentTag(workspaceFolderUri); // Now takes URI
      console.log(
        `Current tag detected for ${workspaceFolderUri}: ${currentTag}`
      );

      // setCurrentSelectedTag is global from taskFilterUtils, this might need rethinking
      // if filters are per-repo. For now, assuming one global filter UI.
      // If the UI is global, which repo's tag should it show? The first one? Active one?
      // This is a UX question. For now, let's assume it reflects the first managed folder.
      if (
        this.managedWorkspaceFolderUris.size > 0 &&
        workspaceFolderUri ===
          this.managedWorkspaceFolderUris.values().next().value
      ) {
        setCurrentSelectedTag(currentTag);
        console.log(
          `Global filter manager updated to tag from ${workspaceFolderUri}: ${currentTag}`
        );
      }

      await this.refreshTasks(workspaceFolderUri); // Refresh tasks for this specific folder
      console.log(`Tasks refreshed for ${workspaceFolderUri}, tag: ${currentTag}`);

      // Emit tag change event to update UI components, with folder context
      this.emit("currentTagChanged", {
        oldTag: "master", // Placeholder, actual old tag might differ per folder
        newTag: currentTag,
        workspaceFolderUri,
      });
    } catch (error) {
      console.error(
        `Failed to load current tag for ${workspaceFolderUri}:`,
        error
      );
      // Don't fail initialization for other folders
    }
  }

  /**
   * Setup event handlers for CLI service and other services
   */
  private setupEventHandlers(): void {
    // CLIService events are tricky if we have multiple instances or a configurable one.
    // For now, assuming CLIService output is generic or TaskOperationsService handles its own.
    // this.cliService.on("outputReceived", (output: string) => { // This cliService is no longer a member
    //   this.emit("cliOutput", output);
    // });

    this.taskCacheService.on(
      "tasksUpdated",
      (payload: { tasks: Task[]; workspaceFolderUri: string }) => {
        this.emit("tasksUpdated", payload); // Pass along with context
      }
    );

    this.taskCacheService.on(
      "refreshError",
      (payload: { error: any; workspaceFolderUri: string }) => {
        this.emit("refreshError", payload); // Pass along with context
      }
    );

    // Add tag-related event handlers
    this.taskCacheService.on(
      "currentTagChanged",
      (payload: {
        oldTag: string;
        newTag: string;
        workspaceFolderUri: string;
      }) => {
        // setCurrentSelectedTag is global, update if this folder is the "primary" one for UI
        if (
          this.managedWorkspaceFolderUris.size > 0 &&
          payload.workspaceFolderUri ===
            this.managedWorkspaceFolderUris.values().next().value
        ) {
          setCurrentSelectedTag(payload.newTag);
        }
        this.emit("currentTagChanged", payload); // Pass along with context
      }
    );

    this.taskCacheService.on(
      "tagsUpdated",
      (payload: { tags: TagInfo[]; workspaceFolderUri: string }) => {
        this.emit("tagsUpdated", payload); // Pass along with context
      }
    );

    this.taskCacheService.on(
      "tagError",
      (payload: { error: any; workspaceFolderUri: string }) => {
        this.emit("tagError", payload); // Pass along with context
      }
    );
  }

  /**
   * Handle configuration changes
   */
  private handleConfigurationChange(config: TaskMasterConfig): void {
    this.cliService.updateConfig(config);
    this.emit("configurationChanged", config);
  }

  /**
   * Check if CLI is available for a specific workspace folder and prompt user if not.
   * @param workspaceFolderUri The URI of the workspace folder.
   */
  public async checkCLIAvailability(
    workspaceFolderUri: string
  ): Promise<boolean> {
    // Create a temporary scoped CLIService to check availability for this folder
    const scopedCliService = new CLIService(
      this.configService.getConfig(workspaceFolderUri),
      workspaceFolderUri
    );
    const isAvailable = await scopedCliService.checkCLIAvailability();
    if (!isAvailable) {
      // Emit with context, CLIManagementService might need to be context-aware too
      this.emit("cliNotAvailable", { workspaceFolderUri });
      // handleCLINotAvailable is global, might need adjustment or be called from UI layer
      await this.cliManagementService.handleCLINotAvailable(
        workspaceFolderUri
      );
    }
    return isAvailable;
  }

  /**
   * Check CLI version for a specific workspace folder.
   * @param workspaceFolderUri The URI of the workspace folder.
   */
  public async checkCLIVersion(
    workspaceFolderUri: string
  ): Promise<{
    isValid: boolean;
    currentVersion?: string;
    minRequiredVersion: string;
    error?: string;
  }> {
    const scopedCliService = new CLIService(
      this.configService.getConfig(workspaceFolderUri),
      workspaceFolderUri
    );
    return await scopedCliService.checkCLIVersion();
  }

  /**
   * Refresh tasks manually for a specific workspace folder.
   * @param workspaceFolderUri The URI of the workspace folder.
   */
  public async refreshTasks(
    workspaceFolderUri: string
  ): Promise<TaskMasterResponse | null> {
    if (!this.managedWorkspaceFolderUris.has(workspaceFolderUri)) {
      console.warn(
        `refreshTasks called for unmanaged folder: ${workspaceFolderUri}`
      );
      return null;
    }
    return await this.taskCacheService.refreshTasksFromFile(workspaceFolderUri);
  }

  /**
   * Get cached tasks for a specific workspace folder.
   * @param workspaceFolderUri The URI of the workspace folder.
   */
  public getTasks(workspaceFolderUri: string): Task[] {
    if (!this.managedWorkspaceFolderUris.has(workspaceFolderUri)) {
      return [];
    }
    return this.taskCacheService.getTasks(workspaceFolderUri);
  }

  /**
   * Get cached response with metadata for a specific workspace folder.
   * @param workspaceFolderUri The URI of the workspace folder.
   */
  public getResponse(
    workspaceFolderUri: string
  ): TaskMasterResponse | null {
    if (!this.managedWorkspaceFolderUris.has(workspaceFolderUri)) {
      return null;
    }
    return this.taskCacheService.getResponse(workspaceFolderUri);
  }

  /**
   * Get tasks filtered by status for a specific workspace folder.
   * @param workspaceFolderUri The URI of the workspace folder.
   */
  public getTasksByStatus(
    workspaceFolderUri: string,
    status: TaskStatus
  ): Task[] {
    if (!this.managedWorkspaceFolderUris.has(workspaceFolderUri)) {
      return [];
    }
    return this.taskCacheService.getTasksByStatus(workspaceFolderUri, status);
  }

  /**
   * Get a specific task by ID for a specific workspace folder.
   * @param workspaceFolderUri The URI of the workspace folder.
   */
  public getTask(
    workspaceFolderUri: string,
    id: number
  ): Task | undefined {
    if (!this.managedWorkspaceFolderUris.has(workspaceFolderUri)) {
      return undefined;
    }
    return this.taskCacheService.getTask(workspaceFolderUri, id);
  }

  /**
   * Execute a task command for a specific workspace folder.
   * @param workspaceFolderUri The URI of the workspace folder.
   */
  public async executeTaskCommand(
    workspaceFolderUri: string,
    command: string,
    taskId: number,
    status?: string
  ): Promise<boolean> {
    if (!this.managedWorkspaceFolderUris.has(workspaceFolderUri)) {
      console.warn(
        `executeTaskCommand called for unmanaged folder: ${workspaceFolderUri}`
      );
      return false;
    }
    const result = await this.taskOperationsService.executeTaskCommand(
      workspaceFolderUri,
      command,
      taskId,
      status
    );
    if (result) {
      // Refresh tasks for the specific folder where the command was executed
      await this.refreshTasks(workspaceFolderUri);
    }
    return result;
  }

  /**
   * Get next actionable task or subtask for a specific workspace folder.
   * @param workspaceFolderUri The URI of the workspace folder.
   */
  public async getNextTaskOrSubtask(
    workspaceFolderUri: string
  ): Promise<TaskOrSubtask | null> {
    if (!this.managedWorkspaceFolderUris.has(workspaceFolderUri)) {
      return null;
    }
    try {
      const scopedCliService = new CLIService(
        this.configService.getConfig(workspaceFolderUri),
        workspaceFolderUri
      );
      const rawOutput = await scopedCliService.getNextTaskFromCLI();

      if (rawOutput) {
        const parsed = parseNextTaskOutput(rawOutput); // parseNextTaskOutput is global
        if (parsed.id) {
          if (parsed.isSubtask && typeof parsed.id === "string") {
            const parentIdStr = parsed.id.split(".")[0];
            const subtaskIdStr = parsed.id.split(".")[1];
            const subtask = this.findSubtaskById(
              workspaceFolderUri,
              parseInt(parentIdStr),
              subtaskIdStr
            );

            if (subtask) { // Check if subtask is found
              return {
                type: "subtask",
                subtask: subtask, // Already includes parentId
              };
            }
          } else {
            const task = this.getTask(
              workspaceFolderUri,
              parsed.id as number
            );
            if (task) {
              return {
                type: "task",
                task,
              };
            }
          }
        }
      }

      // Fallback to cache service for the specific folder
      const fallbackTask = this.taskCacheService.getNextTask(
        workspaceFolderUri
      );
      if (fallbackTask) {
        log(`Fallback next task for ${workspaceFolderUri}:`, fallbackTask);
        return {
          type: "task",
          task: fallbackTask,
        };
      }

      log(`No next task for ${workspaceFolderUri}`);
      return null;
    } catch (error) {
      console.error(
        `Failed to get next task from CLI for ${workspaceFolderUri}:`,
        error
      );
      const fallbackTask = this.taskCacheService.getNextTask(
        workspaceFolderUri
      );
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
   * Get next actionable task for a specific workspace folder.
   * @param workspaceFolderUri The URI of the workspace folder.
   */
  public async getNextTask(
    workspaceFolderUri: string
  ): Promise<Task | null> {
    const result = await this.getNextTaskOrSubtask(workspaceFolderUri);
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
   * Find a subtask by its parent task ID and subtask ID for a specific workspace folder.
   * @param workspaceFolderUri The URI of the workspace folder.
   * @param parentId - ID of the parent task.
   * @param subtaskId - ID of the subtask (can be just the ID or parentId.subtaskId format).
   * @returns The matching subtask or null if not found.
   */
  private findSubtaskById(
    workspaceFolderUri: string,
    parentId: number,
    subtaskId: string
  ): Subtask | null {
    if (!this.managedWorkspaceFolderUris.has(workspaceFolderUri)) {
      return null;
    }
    const tasks = this.getTasks(workspaceFolderUri);

    const parentTask = tasks.find((task) => task.id === parentId);
    if (!parentTask?.subtasks) {
      return null;
    }

    const subtask = parentTask.subtasks.find(
      (st) =>
        st.id === parseInt(subtaskId) || st.id === `${parentId}.${subtaskId}`
    );

    if (subtask) {
      return {
        ...subtask,
        parentId: parentId, // Ensure parentId is part of the returned Subtask object
      };
    } else {
      return null;
    }
  }

  /**
   * Get current task (first in-progress task, or fallback to first pending) for a specific workspace folder.
   * @param workspaceFolderUri The URI of the workspace folder.
   */
  public getCurrentTask(workspaceFolderUri: string): Task | null {
    if (!this.managedWorkspaceFolderUris.has(workspaceFolderUri)) {
      return null;
    }
    const tasks = this.getTasks(workspaceFolderUri);

    const inProgressTask = tasks.find((task) => task.status === "in-progress");
    if (inProgressTask) {
      return inProgressTask;
    }

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

  /**
   * Execute parse-prd command on a .txt file with user-specified options
   */
  public async parsePRDFromFile(filePath: string): Promise<void> {
    try {
      // Validate that the file has a .txt extension
      if (!filePath.toLowerCase().endsWith(".txt")) {
        vscode.window.showErrorMessage(
          "Parse-PRD command only supports .txt files"
        );
        return;
      }

      // Prompt user for number of tasks to generate
      const numTasksInput = await vscode.window.showInputBox({
        prompt: "How many tasks should be generated?",
        value: "10",
        validateInput: (value) => {
          const num = parseInt(value, 10);
          if (isNaN(num) || num < 1 || num > 100) {
            return "Please enter a number between 1 and 100";
          }
          return null;
        },
        ignoreFocusOut: true,
      });

      if (!numTasksInput) {
        vscode.window.showInformationMessage("Parse-PRD cancelled");
        return;
      }

      const numTasks = parseInt(numTasksInput, 10);

      // Show options for research mode
      const useResearch = await vscode.window.showQuickPick(
        [
          {
            label: "No",
            value: false,
            description: "Use standard task generation",
          },
          {
            label: "Yes",
            value: true,
            description:
              "Use research-backed task generation (requires API key)",
          },
        ],
        {
          placeHolder:
            "Use research mode for potentially more informed task generation?",
          ignoreFocusOut: true,
        }
      );

      if (!useResearch) {
        vscode.window.showInformationMessage("Parse-PRD cancelled");
        return;
      }

      // Show progress indicator
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Generating tasks from PRD",
          cancellable: false,
        },
        async (progress, token) => {
          progress.report({ message: "Processing PRD file..." });

          try {
            const result = await this.cliService.executeParsePRD({
              filePath: filePath,
              numTasks: numTasks,
              research: useResearch.value,
              force: false, // Don't force overwrite, let user decide if prompted
            });

            progress.report({ message: "Tasks generated successfully!" });

            // Refresh tasks to show the new ones
            await this.refreshTasks();

            // Show success message with results
            vscode.window
              .showInformationMessage(
                `Successfully generated tasks from PRD file. Check the task list for new items.`,
                "View Tasks"
              )
              .then((selection) => {
                if (selection === "View Tasks") {
                  vscode.commands.executeCommand("taskMaster.refreshTreeView");
                }
              });

            // Log the result for debugging
            log("parsePRD", {
              filePath,
              numTasks,
              research: useResearch.value,
              result,
            });
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";
            vscode.window.showErrorMessage(
              `Failed to generate tasks from PRD: ${errorMessage}`
            );
            console.error("Parse-PRD error:", error);
            throw error;
          }
        }
      );
    } catch (error) {
      console.error("Failed to execute parse-prd:", error);
      throw error;
    }
  }
}
