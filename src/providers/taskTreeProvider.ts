import * as vscode from "vscode";
import { Subtask, Task } from "../types";

/**
 * Tree item representing a task or subtask in the tree view
 */
export class TaskTreeItem extends vscode.TreeItem {
  constructor(
    public readonly task: Task | null,
    public readonly subtask: Subtask | null,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly isSubtask: boolean = false,
    private readonly allTasks: Task[] = []
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
            (subtask) => subtask.id === id.toString()
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
    label?: string
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
  implements vscode.TreeDataProvider<TaskTreeItem | TaskInfoTreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    TaskTreeItem | TaskInfoTreeItem | undefined | null | void
  > = new vscode.EventEmitter<
    TaskTreeItem | TaskInfoTreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData: vscode.Event<
    TaskTreeItem | TaskInfoTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private tasks: Task[] = [];
  private currentTask: Task | null = null;
  private nextTask: Task | null = null;

  /**
   * Update the tasks and refresh the tree view
   */
  public updateTasks(tasks: Task[]): void {
    this.tasks = tasks;
    this._onDidChangeTreeData.fire();
  }

  /**
   * Update current and next task information
   */
  public updateCurrentAndNextTasks(
    currentTask: Task | null,
    nextTask: Task | null
  ): void {
    this.currentTask = currentTask;
    this.nextTask = nextTask;
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get tree item representation
   */
  getTreeItem(element: TaskTreeItem | TaskInfoTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children of a tree item
   */
  getChildren(
    element?: TaskTreeItem | TaskInfoTreeItem
  ): Thenable<(TaskTreeItem | TaskInfoTreeItem)[]> {
    if (!element) {
      // Root level - return task info items followed by tasks
      const items: (TaskTreeItem | TaskInfoTreeItem)[] = [];

      // Add current task info
      if (this.currentTask) {
        items.push(
          new TaskInfoTreeItem("current", {
            id: this.currentTask.id,
            title: this.currentTask.title,
            status: this.currentTask.status,
          })
        );
      } else {
        items.push(new TaskInfoTreeItem("current"));
      }

      // Add next task info
      if (this.nextTask) {
        items.push(
          new TaskInfoTreeItem("next", {
            id: this.nextTask.id,
            title: this.nextTask.title,
            status: this.nextTask.status,
          })
        );
      } else {
        items.push(new TaskInfoTreeItem("next"));
      }

      // Add separator if we have any tasks
      if (this.tasks.length > 0) {
        items.push(new TaskInfoTreeItem("separator"));
      }

      // Add all tasks
      items.push(...this.getTaskTreeItems());

      return Promise.resolve(items);
    } else if (
      element instanceof TaskTreeItem &&
      element.task &&
      element.task.subtasks &&
      element.task.subtasks.length > 0
    ) {
      // Task with subtasks - return subtask items
      return Promise.resolve(this.getSubtaskTreeItems(element.task));
    } else {
      // No children
      return Promise.resolve([]);
    }
  }

  /**
   * Get tree items for tasks
   */
  private getTaskTreeItems(): TaskTreeItem[] {
    if (!this.tasks || this.tasks.length === 0) {
      return [];
    }

    return this.tasks.map((task) => {
      const hasSubtasks = task.subtasks && task.subtasks.length > 0;
      const collapsibleState = hasSubtasks
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None;

      return new TaskTreeItem(task, null, collapsibleState, false, this.tasks);
    });
  }

  /**
   * Get tree items for subtasks of a given task
   */
  private getSubtaskTreeItems(task: Task): TaskTreeItem[] {
    if (!task.subtasks || task.subtasks.length === 0) {
      return [];
    }

    return task.subtasks.map((subtask) => {
      // Ensure parentId is set correctly
      const subtaskWithParentId = {
        ...subtask,
        parentId: Number(task.id),
      };

      return new TaskTreeItem(
        null,
        subtaskWithParentId,
        vscode.TreeItemCollapsibleState.None,
        true,
        this.tasks
      );
    });
  }

  /**
   * Refresh the tree view
   */
  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get parent of a tree item (required for tree view)
   */
  getParent(
    element: TaskTreeItem | TaskInfoTreeItem
  ): vscode.ProviderResult<TaskTreeItem | TaskInfoTreeItem> {
    // TaskInfoTreeItem instances have no parents (they are at root level)
    if (element instanceof TaskInfoTreeItem) {
      return null;
    }

    // For subtasks, find the parent task
    if (element.isSubtask && element.subtask) {
      const parentTask = this.tasks.find((task) =>
        task.subtasks?.some((subtask) => subtask.id === element.subtask?.id)
      );

      if (parentTask) {
        return new TaskTreeItem(
          parentTask,
          null,
          vscode.TreeItemCollapsibleState.Expanded,
          false,
          this.tasks
        );
      }
    }

    // Tasks don't have parents (they are root level)
    return null;
  }
}
