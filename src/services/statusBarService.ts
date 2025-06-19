import * as vscode from "vscode";
import { Task } from "../types";
import { TaskManagerService } from "./taskManagerService";

/**
 * Service for managing the VS Code status bar integration
 * Shows next actionable task, task information, and tag information
 */
export class StatusBarService {
  private statusBarItem: vscode.StatusBarItem;
  private taskManagerService: TaskManagerService;
  private context: vscode.ExtensionContext;
  private updateInterval: NodeJS.Timeout | undefined;
  private isDisposed: boolean = false;
  private currentView: number = 0;
  private maxViews: number = 4;
  private static readonly CURRENT_VIEW_KEY = "taskMaster.currentView";

  constructor(
    taskManagerService: TaskManagerService,
    context: vscode.ExtensionContext
  ) {
    this.taskManagerService = taskManagerService;
    this.context = context;

    // Restore the saved view preference
    this.currentView = this.context.globalState.get(
      StatusBarService.CURRENT_VIEW_KEY,
      0
    );

    // Create status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );

    // Set up click handler to cycle through views
    this.statusBarItem.command = "taskMaster.cycleStatusBarView";
    this.statusBarItem.tooltip = "Click to cycle through Task Master views";

    // Initialize the status bar
    this.updateStatusBar();

    // Set up event listeners
    this.setupEventListeners();

    // Start periodic updates
    this.startPeriodicUpdates();

    // Show the status bar item
    this.statusBarItem.show();
  }

  /**
   * Set up event listeners for task updates
   */
  private setupEventListeners(): void {
    this.taskManagerService.on("tasksUpdated", () => {
      this.updateStatusBar();
    });

    this.taskManagerService.on("initialized", () => {
      this.updateStatusBar();
    });

    this.taskManagerService.on("cliNotAvailable", () => {
      this.showCLINotAvailableStatus();
    });
  }

  /**
   * Update the status bar with current information
   */
  private async updateStatusBar(): Promise<void> {
    if (this.isDisposed) {
      return;
    }

    try {
      const tasks = this.taskManagerService.getTasks();
      const response = this.taskManagerService.getResponse();

      if (tasks.length === 0) {
        this.showNoTasksStatus();
        return;
      }

      switch (this.currentView) {
        case 0:
          await this.showNextTaskView();
          break;
        case 1:
          this.showProgressView(tasks, response);
          break;
        case 2:
          this.showDependencyView(tasks);
          break;
        case 3:
          this.showPriorityView(tasks);
          break;
        default:
          this.currentView = 0;
          await this.showNextTaskView();
      }
    } catch (error) {
      console.error("Error updating status bar:", error);
      this.showErrorStatus();
    }
  }

  /**
   * Show next task view
   */
  private async showNextTaskView(): Promise<void> {
    try {
      const nextTask = await this.taskManagerService.getNextTask();
      if (nextTask) {
        const taskText = `$(checklist) Next: ${nextTask.title} (#${nextTask.id})`;
        this.statusBarItem.text = taskText;
        this.statusBarItem.tooltip = `Next Task: ${nextTask.title}\nID: ${nextTask.id}\nStatus: ${nextTask.status}\nPriority: ${nextTask.priority}\n\nClick to cycle views`;
        this.statusBarItem.backgroundColor = undefined;
      } else {
        this.statusBarItem.text = `$(check) All tasks complete!`;
        this.statusBarItem.tooltip =
          "No pending tasks available\n\nClick to cycle views";
        this.statusBarItem.backgroundColor = new vscode.ThemeColor(
          "statusBarItem.prominentBackground"
        );
      }
    } catch (error) {
      this.showErrorStatus();
    }
  }

  /**
   * Show progress overview
   */
  private showProgressView(tasks: Task[], response: any): void {
    const stats = this.calculateTaskStats(tasks);
    const completionPercentage = Math.round((stats.done / stats.total) * 100);

    this.statusBarItem.text = `$(graph) Progress: ${completionPercentage}% (${stats.done}/${stats.total})`;
    this.statusBarItem.tooltip = `Task Progress:\n• Done: ${stats.done}\n• In Progress: ${stats.inProgress}\n• Pending: ${stats.pending}\n• Blocked: ${stats.blocked}\n\nClick to cycle views`;
    this.statusBarItem.backgroundColor = undefined;
  }

  /**
   * Show dependency information
   */
  private showDependencyView(tasks: Task[]): void {
    const depStats = this.calculateDependencyStats(tasks);

    this.statusBarItem.text = `$(git-branch) Ready: ${depStats.readyToWork} | Blocked: ${depStats.blocked}`;
    this.statusBarItem.tooltip = `Dependency Status:\n• Ready to work: ${depStats.readyToWork}\n• Blocked by deps: ${depStats.blocked}\n• No dependencies: ${depStats.noDependencies}\n\nClick to cycle views`;
    this.statusBarItem.backgroundColor = undefined;
  }

  /**
   * Show priority breakdown
   */
  private showPriorityView(tasks: Task[]): void {
    const priorityStats = this.calculatePriorityStats(tasks);

    this.statusBarItem.text = `$(flame) High: ${priorityStats.high} | Med: ${priorityStats.medium} | Low: ${priorityStats.low}`;
    this.statusBarItem.tooltip = `Priority Breakdown:\n• High priority: ${priorityStats.high}\n• Medium priority: ${priorityStats.medium}\n• Low priority: ${priorityStats.low}\n\nClick to cycle views`;
    this.statusBarItem.backgroundColor = undefined;
  }

  /**
   * Show no tasks available status
   */
  private showNoTasksStatus(): void {
    this.statusBarItem.text = `$(check) All tasks complete!`;
    this.statusBarItem.tooltip = "No pending tasks available";
    this.statusBarItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.prominentBackground"
    );
  }

  /**
   * Show CLI not available status
   */
  private showCLINotAvailableStatus(): void {
    this.statusBarItem.text = "$(warning) Task Master CLI not available";
    this.statusBarItem.tooltip =
      "Task Master CLI is not installed or not in PATH. Click to show help.";
    this.statusBarItem.command = "taskMaster.checkCLI";
    this.statusBarItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground"
    );
  }

  /**
   * Show error status
   */
  private showErrorStatus(): void {
    this.statusBarItem.text = "$(error) Task Master Error";
    this.statusBarItem.tooltip = "Error loading tasks. Click to refresh.";
    this.statusBarItem.command = "taskMaster.refreshTasks";
    this.statusBarItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.errorBackground"
    );
  }

  /**
   * Start periodic updates of the status bar
   */
  private startPeriodicUpdates(): void {
    // Update every 30 seconds by default
    const updateIntervalMs = 30000;

    this.updateInterval = setInterval(() => {
      this.updateStatusBar();
    }, updateIntervalMs);
  }

  /**
   * Stop periodic updates
   */
  private stopPeriodicUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
  }

  /**
   * Calculate task statistics
   */
  private calculateTaskStats(tasks: Task[]) {
    const stats = {
      total: tasks.length,
      done: 0,
      inProgress: 0,
      pending: 0,
      blocked: 0,
      deferred: 0,
      cancelled: 0,
      review: 0,
    };

    tasks.forEach((task) => {
      switch (task.status) {
        case "done":
          stats.done++;
          break;
        case "in-progress":
          stats.inProgress++;
          break;
        case "pending":
          stats.pending++;
          break;
        case "blocked":
          stats.blocked++;
          break;
        case "deferred":
          stats.deferred++;
          break;
        case "cancelled":
          stats.cancelled++;
          break;
        case "review":
          stats.review++;
          break;
      }
    });

    return stats;
  }

  /**
   * Calculate dependency statistics
   */
  private calculateDependencyStats(tasks: Task[]) {
    const completedTaskIds = new Set(
      tasks.filter((t) => t.status === "done").map((t) => t.id)
    );

    let noDependencies = 0;
    let readyToWork = 0;
    let blocked = 0;

    tasks.forEach((task) => {
      if (task.status === "done") {
        return;
      }

      if (!task.dependencies || task.dependencies.length === 0) {
        noDependencies++;
        if (task.status === "pending") {
          readyToWork++;
        }
      } else {
        const allDepsCompleted = task.dependencies.every((depId) =>
          completedTaskIds.has(depId)
        );

        if (allDepsCompleted && task.status === "pending") {
          readyToWork++;
        } else if (!allDepsCompleted) {
          blocked++;
        }
      }
    });

    return { noDependencies, readyToWork, blocked };
  }

  /**
   * Calculate priority statistics
   */
  private calculatePriorityStats(tasks: Task[]) {
    const stats = { high: 0, medium: 0, low: 0 };

    tasks.forEach((task) => {
      switch (task.priority) {
        case "high":
          stats.high++;
          break;
        case "medium":
          stats.medium++;
          break;
        case "low":
          stats.low++;
          break;
      }
    });

    return stats;
  }

  /**
   * Cycle to next view
   */
  public cycleView(): void {
    this.currentView = (this.currentView + 1) % this.maxViews;
    this.context.globalState.update(
      StatusBarService.CURRENT_VIEW_KEY,
      this.currentView
    );
    this.updateStatusBar();
  }

  /**
   * Force refresh the status bar
   */
  public refresh(): void {
    this.updateStatusBar();
  }

  /**
   * Dispose of the status bar service
   */
  public dispose(): void {
    this.isDisposed = true;
    this.stopPeriodicUpdates();
    this.statusBarItem.dispose();
  }
}
