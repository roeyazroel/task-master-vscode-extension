import * as vscode from "vscode";
import { Subtask, Task } from "../types";

/**
 * Tree item representing a repository in a multi-root workspace.
 */
export class RepositoryTreeItem extends vscode.TreeItem {
  constructor(
    public readonly workspaceFolder: vscode.WorkspaceFolder,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode
      .TreeItemCollapsibleState.Expanded
  ) {
    super(workspaceFolder.name, collapsibleState);
    this.tooltip = `${workspaceFolder.uri.fsPath}`;
    this.iconPath = new vscode.ThemeIcon("repo");
    this.contextValue = "repository";
  }
}

/**
 * Tree item representing a task or subtask in the tree view
 */
export class TaskTreeItem extends vscode.TreeItem {
  constructor(
    public readonly task: Task | null,
    public readonly subtask: Subtask | null,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly isSubtask: boolean = false,
    private readonly allTasks: Task[] = [], // Represents tasks for the current context (repo or global)
    public readonly workspaceFolder?: vscode.WorkspaceFolder // Optional: for multi-root context
  ) {
    const label = task?.title || subtask?.title || "Unknown";
    super(label, collapsibleState);

    this.tooltip = this.getTooltip();
    this.description = this.getDescription();
    this.iconPath = this.getIconPath();
    this.contextValue = this.getContextValue();
    // this.command = this.getCommand();
  }

  /**
   * Get the tooltip text for the tree item
   */
  private getTooltip(): string {
    if (this.task) {
      const dependencies =
        this.task.dependencies && this.task.dependencies.length > 0
          ? `\nDependencies:\n${this.formatTaskDependencies(
              this.task.dependencies
            )}`
          : "\nDependencies: None";

      return `Task ${this.task.id}: ${this.task.title}\nStatus: ${
        this.task.status
      }\nPriority: ${this.task.priority}\nComplexity: ${
        this.task.complexityScore || "N/A"
      }${dependencies}\n\n${this.task.description}`;
    } else if (this.subtask) {
      const dependencies =
        this.subtask.dependencies && this.subtask.dependencies.length > 0
          ? `\nDependencies:\n${this.formatSubtaskDependencies(
              this.subtask.dependencies
            )}`
          : "\nDependencies: None";

      return `Subtask ${this.subtask.id}: ${this.subtask.title}\nStatus: ${
        this.subtask.status
      }${dependencies}\n\n${this.subtask.description || ""}`;
    }
    return "";
  }

  /**
   * Format task dependencies as bullet points with titles
   */
  private formatTaskDependencies(dependencyIds: number[]): string {
    return dependencyIds
      .map((id) => {
        const dependentTask = this.allTasks.find((task) => task.id === id);
        const title = dependentTask ? dependentTask.title : `Task ${id}`;
        return `  • ${title}`;
      })
      .join("\n");
  }

  /**
   * Format subtask dependencies as bullet points with titles
   */
  private formatSubtaskDependencies(dependencyIds: number[]): string {
    return dependencyIds
      .map((id) => {
        // For subtask dependencies, we need to find the subtask by ID
        // This could be across all tasks' subtasks
        let dependentSubtask = null;
        for (const task of this.allTasks) {
          dependentSubtask = task.subtasks?.find(
            (subtask) => subtask.id === id
          );
          if (dependentSubtask) {
            break;
          }
        }
        const title = dependentSubtask
          ? dependentSubtask.title
          : `Subtask ${id}`;
        return `  • ${title}`;
      })
      .join("\n");
  }

  /**
   * Get the description text (shown next to the label)
   */
  private getDescription(): string {
    const status = this.task?.status || this.subtask?.status || "";
    const id = this.task?.id?.toString() || this.subtask?.id || "";

    // Add dependency count indicator
    let dependencyInfo = "";
    if (this.task?.dependencies && this.task.dependencies.length > 0) {
      dependencyInfo = ` • deps: ${this.task.dependencies.join(",")}`;
    } else if (
      this.subtask?.dependencies &&
      this.subtask.dependencies.length > 0
    ) {
      dependencyInfo = ` • deps: ${this.subtask.dependencies.join(",")}`;
    }

    return `[${id}] ${status}${dependencyInfo}`;
  }

  /**
   * Get the icon path based on task status
   */
  private getIconPath(): vscode.ThemeIcon {
    const status = this.task?.status || this.subtask?.status || "";

    switch (status) {
      case "done":
        return new vscode.ThemeIcon(
          "check",
          new vscode.ThemeColor("charts.green")
        );
      case "in-progress":
        return new vscode.ThemeIcon(
          "sync",
          new vscode.ThemeColor("charts.blue")
        );
      case "blocked":
        return new vscode.ThemeIcon(
          "error",
          new vscode.ThemeColor("charts.red")
        );
      case "review":
        return new vscode.ThemeIcon(
          "eye",
          new vscode.ThemeColor("charts.orange")
        );
      case "deferred":
        return new vscode.ThemeIcon(
          "clock",
          new vscode.ThemeColor("charts.yellow")
        );
      case "cancelled":
        return new vscode.ThemeIcon("x", new vscode.ThemeColor("charts.red"));
      case "pending":
      default:
        return new vscode.ThemeIcon(
          "circle-outline",
          new vscode.ThemeColor("charts.foreground")
        );
    }
  }

  /**
   * Get the context value for context menu commands
   */
  private getContextValue(): string {
    if (this.task) {
      const hasDeps =
        this.task.dependencies && this.task.dependencies.length > 0;
      return `task-${this.task.status}${hasDeps ? "-with-deps" : ""}`;
    } else if (this.subtask) {
      const hasDeps =
        this.subtask.dependencies && this.subtask.dependencies.length > 0;
      return `subtask-${this.subtask.status}${hasDeps ? "-with-deps" : ""}`;
    }
    return "unknown";
  }
}

/**
 * Special tree item for showing current/next task info
 */
export class TaskInfoTreeItem extends vscode.TreeItem {
  constructor(
    public readonly type: "current" | "next" | "separator",
    public readonly taskInfo?: {
      id: number | string;
      title: string;
      status: string;
    },
    label?: string,
    public readonly workspaceFolder?: vscode.WorkspaceFolder // Optional: for multi-root context
  ) {
    super(label || "", vscode.TreeItemCollapsibleState.None);

    if (type === "separator") {
      this.label = "─────────────────────────";
      this.description = "";
      this.iconPath = undefined;
      this.contextValue = "separator";
    } else if (taskInfo) {
      this.label = type === "current" ? "🎯 Current Task" : "⏭️ Next Task";
      this.description = `[${taskInfo.id}] ${taskInfo.title}`;
      this.tooltip = `${type === "current" ? "Current" : "Next"} task: ${
        taskInfo.title
      } (Status: ${taskInfo.status})`;
      this.iconPath =
        type === "current"
          ? new vscode.ThemeIcon("target", new vscode.ThemeColor("charts.blue"))
          : new vscode.ThemeIcon(
              "arrow-right",
              new vscode.ThemeColor("charts.green")
            );
      this.contextValue = `info-${type}`;
    } else {
      this.label =
        type === "current" ? "🎯 No Current Task" : "⏭️ No Next Task";
      this.description = "";
      this.tooltip = `No ${type} task available`;
      this.iconPath = new vscode.ThemeIcon(
        "circle-slash",
        new vscode.ThemeColor("charts.gray")
      );
      this.contextValue = `info-${type}-empty`;
    }
  }
}

/**
 * Tree data provider for Task Master tasks
 */
export class TaskTreeProvider
  implements
    vscode.TreeDataProvider<
      TaskTreeItem | TaskInfoTreeItem | RepositoryTreeItem
    >
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    TaskTreeItem | TaskInfoTreeItem | RepositoryTreeItem | undefined | null | void
  > = new vscode.EventEmitter<
    | TaskTreeItem
    | TaskInfoTreeItem
    | RepositoryTreeItem
    | undefined
    | null
    | void
  >();
  readonly onDidChangeTreeData: vscode.Event<
    TaskTreeItem | TaskInfoTreeItem | RepositoryTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private tasksByFolder: Map<string, Task[]> = new Map();
  private currentTaskByFolder: Map<string, Task | null> = new Map();
  private nextTaskByFolder: Map<string, Task | null> = new Map();
  private taskManagerService: any; // TODO: Import and use TaskManagerService type

  // TODO: This is a temporary solution. TaskManagerService should be properly injected or accessed.
  public setTaskManagerService(taskManagerService: any) {
    this.taskManagerService = taskManagerService;
  }

  /**
   * Refresh data for a specific folder URI or all if URI is undefined.
   * This will trigger re-fetching from TaskManagerService.
   */
  public async refresh(element?: TaskTreeItem | TaskInfoTreeItem | RepositoryTreeItem | string): Promise<void> {
    let folderToRefresh: string | undefined = undefined;
    if (typeof element === 'string') {
      folderToRefresh = element;
    } else if (element instanceof RepositoryTreeItem) {
      folderToRefresh = element.workspaceFolder.uri.toString();
    } else if (element instanceof TaskTreeItem && element.workspaceFolder) {
      folderToRefresh = element.workspaceFolder.uri.toString();
    } else if (element instanceof TaskInfoTreeItem && element.workspaceFolder) {
      folderToRefresh = element.workspaceFolder.uri.toString();
    }

    if (folderToRefresh && this.taskManagerService) {
      // Fetch and update data for the specific folder
      const tasks = this.taskManagerService.getTasks(folderToRefresh);
      this.tasksByFolder.set(folderToRefresh, tasks || []);

      const currentTask = this.taskManagerService.getCurrentTask(folderToRefresh);
      this.currentTaskByFolder.set(folderToRefresh, currentTask);

      const nextTask = await this.taskManagerService.getNextTask(folderToRefresh);
      this.nextTaskByFolder.set(folderToRefresh, nextTask);

      this._onDidChangeTreeData.fire(folderToRefresh ? undefined : element); // Refresh specific part if possible
    } else {
      // Full refresh - might need to iterate all known folders from taskManagerService
      // For now, just a general refresh signal
      this._onDidChangeTreeData.fire();
    }
  }

  /**
   * Called by TaskManagerService when tasks for a specific folder are updated.
   * @param workspaceFolderUri URI of the folder whose tasks were updated.
   * @param tasks The new list of tasks for that folder.
   */
  public handleTasksUpdated(workspaceFolderUri: string, tasks: Task[]): void {
    this.tasksByFolder.set(workspaceFolderUri, tasks);
    this.refresh(workspaceFolderUri); // Trigger a targeted refresh
  }

  /**
   * Called by TaskManagerService when current/next tasks for a folder are updated.
   * @param workspaceFolderUri URI of the folder.
   * @param currentTask The current task.
   * @param nextTask The next task.
   */
  public handleCurrentNextUpdated(workspaceFolderUri: string, currentTask: Task | null, nextTask: Task | null): void {
    this.currentTaskByFolder.set(workspaceFolderUri, currentTask);
    this.nextTaskByFolder.set(workspaceFolderUri, nextTask);
    this.refresh(workspaceFolderUri); // Trigger a targeted refresh
  }

  /**
   * Get tree item representation
   */
  getTreeItem(
    element: TaskTreeItem | TaskInfoTreeItem | RepositoryTreeItem
  ): vscode.TreeItem {
    return element;
  }

  /**
   * Get children of a tree item
   */
  async getChildren(
    element?: TaskTreeItem | TaskInfoTreeItem | RepositoryTreeItem
  ): Promise<(TaskTreeItem | TaskInfoTreeItem | RepositoryTreeItem)[]> {
    if (!element) {
      // Root level
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (workspaceFolders && workspaceFolders.length > 1) {
          // Multi-root workspace: show repository nodes for managed TaskMaster projects
          if (!this.taskManagerService) { // Guard against taskManagerService not being set yet
            return [];
          }
          const managedUris = this.taskManagerService.getManagedFolderUris ? this.taskManagerService.getManagedFolderUris() : [];
          const managedTaskMasterFolders = workspaceFolders.filter(folder =>
            managedUris.includes(folder.uri.toString())
        );

          if (managedTaskMasterFolders.length > 1) { // Only show individual repo nodes if more than one TM project
            return managedTaskMasterFolders.map(
              (folder) => new RepositoryTreeItem(folder)
            );
          } else if (managedTaskMasterFolders.length === 1) {
            // If only one TaskMaster project in a multi-folder workspace, show its tasks directly
            return this.getRootTaskItems(managedTaskMasterFolders[0]);
          } else {
            // No TaskMaster projects found in the multi-folder workspace
            // Optionally, return a message item: new vscode.TreeItem("No TaskMaster projects found.");
            return [];
          }
        } else if (workspaceFolders && workspaceFolders.length === 1) {
          // Single folder workspace: show tasks directly if it's a TM project
          if (!this.taskManagerService) return [];
          const folderUri = workspaceFolders[0].uri.toString();
          if (this.taskManagerService.getManagedFolderUris && this.taskManagerService.getManagedFolderUris().includes(folderUri)) {
            return this.getRootTaskItems(workspaceFolders[0]);
          }
          return []; // Not a TM project
      } else {
          // No workspace open
          return [];
      }
    } else if (element instanceof RepositoryTreeItem) {
      // Children of a repository node: show tasks for this repository
        // This now correctly uses the per-folder data via getRootTaskItems
      return this.getRootTaskItems(element.workspaceFolder);
    } else if (
      element instanceof TaskTreeItem &&
      element.task &&
      element.task.subtasks &&
      element.task.subtasks.length > 0
    ) {
      // Task with subtasks - return subtask items
      return this.getSubtaskTreeItems(element.task);
    } else {
      // No children for TaskInfoTreeItem or tasks without subtasks
      return [];
    }
  }

  /**
   * Helper to get root items (TaskInfo and Tasks) for a given workspace folder or globally.
   * @param workspaceFolder Optional. If provided, tasks should be filtered for this folder.
   */
  private getRootTaskItems(
    workspaceFolder?: vscode.WorkspaceFolder
  ): (TaskTreeItem | TaskInfoTreeItem)[] {
    const folderUriString = workspaceFolder?.uri.toString();
    const items: (TaskTreeItem | TaskInfoTreeItem)[] = [];

    const currentTasks = folderUriString
      ? this.tasksByFolder.get(folderUriString) || []
      : []; // Or handle no-folder case differently
    const currentTask = folderUriString
      ? this.currentTaskByFolder.get(folderUriString)
      : null;
    const nextTask = folderUriString
      ? this.nextTaskByFolder.get(folderUriString)
      : null;

    // Add current task info
    if (currentTask) {
      items.push(
        new TaskInfoTreeItem(
          "current",
          {
            id: currentTask.id,
            title: currentTask.title,
            status: currentTask.status,
          },
          undefined,
          workspaceFolder
        )
      );
    } else {
      items.push(new TaskInfoTreeItem("current", undefined, undefined, workspaceFolder));
    }

    // Add next task info
    if (nextTask) {
      items.push(
        new TaskInfoTreeItem(
          "next",
          {
            id: nextTask.id,
            title: nextTask.title,
            status: nextTask.status,
          },
          undefined,
          workspaceFolder
        )
      );
    } else {
      items.push(new TaskInfoTreeItem("next", undefined, undefined, workspaceFolder));
    }

    // Add separator if we have any tasks for this folder
    if (currentTasks.length > 0) {
      items.push(new TaskInfoTreeItem("separator", undefined, undefined, workspaceFolder));
    }

    items.push(...this.getTaskTreeItems(currentTasks, workspaceFolder));

    return items;
  }

  /**
   * Get tree items for tasks for a specific folder.
   * @param tasksForFolder Tasks for the specific folder.
   * @param workspaceFolder Workspace folder context.
   */
  private getTaskTreeItems(
    tasksForFolder: Task[],
    workspaceFolder?: vscode.WorkspaceFolder
  ): TaskTreeItem[] {
    if (!tasksForFolder || tasksForFolder.length === 0) {
      return [];
    }

    return tasksForFolder.map((task) => {
      const hasSubtasks = task.subtasks && task.subtasks.length > 0;
      const collapsibleState = hasSubtasks
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None;

      // Pass allTasks for this folder context for dependency display
      return new TaskTreeItem(
        task,
        null,
        collapsibleState,
        false,
        tasksForFolder,
        workspaceFolder
      );
    });
  }

  /**
   * Get tree items for subtasks of a given task.
   * @param task The parent task.
   * @param workspaceFolder Workspace folder context for the parent task.
   */
  private getSubtaskTreeItems(
    task: Task,
    workspaceFolder?: vscode.WorkspaceFolder
  ): TaskTreeItem[] {
    if (!task.subtasks || task.subtasks.length === 0) {
      return [];
    }

    // Get all tasks for the current folder to resolve subtask dependencies
    const allTasksForFolder = workspaceFolder
      ? this.tasksByFolder.get(workspaceFolder.uri.toString()) || []
      : [];

    return task.subtasks.map((subtask) => {
      const subtaskWithParentId = {
        ...subtask,
        parentId: Number(task.id),
      };

      return new TaskTreeItem(
        null,
        subtaskWithParentId,
        vscode.TreeItemCollapsibleState.None,
        true,
        allTasksForFolder, // Pass all tasks from the same folder for context
        workspaceFolder
      );
    });
  }

  // refresh method already updated to be context-aware or global

  /**
   * Get parent of a tree item (required for tree view)
   */
  getParent(
    element: TaskTreeItem | TaskInfoTreeItem | RepositoryTreeItem
  ): vscode.ProviderResult<
    TaskTreeItem | TaskInfoTreeItem | RepositoryTreeItem
  > {
    // RepositoryTreeItems are root elements, so they have no parent.
    if (element instanceof RepositoryTreeItem) {
      return null;
    }

    // For TaskTreeItem (tasks) and TaskInfoTreeItem (current/next info),
    // their parent could be a RepositoryTreeItem if in a multi-root workspace.
    if (element.workspaceFolder) {
      // If workspaceFolder is defined, this item belongs to a repository.
      return new RepositoryTreeItem(element.workspaceFolder);
    }

    // If it's a subtask, its parent is a TaskTreeItem.
    // This logic needs to ensure the parent task is also associated with the correct workspaceFolder if applicable.
    if (
      element instanceof TaskTreeItem &&
      element.isSubtask &&
      element.subtask &&
      element.workspaceFolder // Subtasks should have a workspaceFolder context
    ) {
      const tasksInFolder =
        this.tasksByFolder.get(element.workspaceFolder.uri.toString()) || [];
      const parentTask = tasksInFolder.find((task) =>
        task.subtasks?.some(
          (subtask) => subtask.id === element.subtask?.id
        )
      );

      if (parentTask) {
        return new TaskTreeItem(
          parentTask,
          null,
          vscode.TreeItemCollapsibleState.Expanded, // Parent should be expanded to show this subtask
          false,
          tasksInFolder, // Context for this task's dependencies
          element.workspaceFolder // Propagate workspaceFolder context
        );
      }
    }

    // If none of the above, it's a root-level item (e.g., task in single-folder view, or info item in single-folder view)
    return null;
  }
}
