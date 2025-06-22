import * as vscode from "vscode";
import { TagCommands } from "./commands/tagCommands";
import { TaskTreeItem, TaskTreeProvider } from "./providers/taskTreeProvider";
import { SecurityService } from "./services/securityService";
import { StatusBarService } from "./services/statusBarService";
import { TaskManagerService } from "./services/taskManagerService";
import { initializeLogging, log } from "./utils/logger";

let taskManagerService: TaskManagerService;
let taskTreeProvider: TaskTreeProvider;
let securityService: SecurityService;
let statusBarService: StatusBarService;
let tagCommands: TagCommands;

/**
 * Helper function to extract task ID from different invocation sources
 */
function extractTaskId(
  taskIdOrTreeItem?: number | TaskTreeItem,
  taskId?: number
): number | undefined {
  if (typeof taskIdOrTreeItem === "number") {
    return taskIdOrTreeItem;
  } else if (taskIdOrTreeItem && "task" in taskIdOrTreeItem) {
    return Number(taskIdOrTreeItem.task?.id);
  } else if (taskId) {
    return taskId;
  }
  return undefined;
}

/**
 * Helper function to extract subtask ID from TreeItem invocation
 * Returns the full format "parentId.subtaskId" as expected by the CLI
 */
function extractSubtaskId(taskTreeItem?: TaskTreeItem): string | undefined {
  if (taskTreeItem && taskTreeItem.isSubtask && taskTreeItem.subtask) {
    const parentId = taskTreeItem.subtask.parentId;
    const subtaskId = taskTreeItem.subtask.id;
    return `${parentId}.${subtaskId}`;
  }
  return undefined;
}

/**
 * This method is called when your extension is activated
 * Your extension is activated the very first time the command is executed
 */
export function activate(context: vscode.ExtensionContext) {
  initializeLogging(context);
  console.log("Task Master extension is now active!");

  // Initialize Security Service
  securityService = SecurityService.getInstance();

  // Check workspace trust and show warning if needed
  securityService
    .showUntrustedWorkspaceWarning()
    .then(async (shouldContinue) => {
      if (!shouldContinue) {
        console.log("User chose not to continue with untrusted workspace");
        return;
      }

      // Check CLI version before proceeding with initialization
      await validateCLIVersion(context);
    });

  // The rest of the initialization will be handled after CLI version validation
}

/**
 * Validate that the Task Master CLI meets minimum version requirements
 */
async function validateCLIVersion(
  context: vscode.ExtensionContext
): Promise<void> {
  try {
    // Initialize Task Manager Service to access CLI service
    taskManagerService = new TaskManagerService();

    // Check CLI version
    const versionCheck = await taskManagerService.checkCLIVersion();

    if (!versionCheck.isValid) {
      const errorMessage = versionCheck.error || "CLI version check failed";
      const updateInstructions =
        "Please update Task Master CLI to version 17 or higher using: npm install -g task-master-ai@latest";

      vscode.window
        .showErrorMessage(
          `Task Master CLI Error: ${errorMessage}. ${updateInstructions}`,
          "Open Documentation"
        )
        .then((selection) => {
          if (selection === "Open Documentation") {
            vscode.env.openExternal(
              vscode.Uri.parse(
                "https://github.com/eyaltoledano/claude-task-master.git"
              )
            );
          }
        });

      console.error(`CLI version validation failed: ${errorMessage}`);
      return; // Stop initialization
    }

    console.log(
      `CLI version validation passed: ${versionCheck.currentVersion}`
    );

    // Continue with normal initialization after version check passes
    await initializeExtensionServices(context);
  } catch (error) {
    const errorMessage = `Failed to validate CLI version: ${
      error instanceof Error ? error.message : "Unknown error"
    }`;

    vscode.window
      .showErrorMessage(
        `Task Master CLI Error: ${errorMessage}. Please ensure Task Master CLI is installed and accessible.`,
        "Install CLI"
      )
      .then((selection) => {
        if (selection === "Install CLI") {
          vscode.env.openExternal(
            vscode.Uri.parse(
              "https://github.com/eyaltoledano/claude-task-master.git"
            )
          );
        }
      });

    console.error(errorMessage);
  }
}

/**
 * Initialize extension services after CLI validation passes
 */
async function initializeExtensionServices(
  context: vscode.ExtensionContext
): Promise<void> {
  // Set context to indicate Task Master is enabled
  vscode.commands.executeCommand("setContext", "taskMaster.enabled", true);

  // Set security context
  const securityContext = securityService.getSecurityContext();
  vscode.commands.executeCommand(
    "setContext",
    "taskMaster.workspaceTrusted",
    securityContext.isWorkspaceTrusted
  );
  vscode.commands.executeCommand(
    "setContext",
    "taskMaster.cliAllowed",
    securityContext.allowCliExecution
  );

  // Initialize Status Bar Service
  statusBarService = new StatusBarService(taskManagerService, context);

  // Initialize Task Tree Provider
  taskTreeProvider = new TaskTreeProvider();

  // Initialize Tag Commands
  tagCommands = TagCommands.registerCommands(context, taskManagerService);

  // Register tree view
  const treeView = vscode.window.createTreeView("taskMaster.taskView", {
    treeDataProvider: taskTreeProvider,
    showCollapseAll: true,
    canSelectMany: false,
  });

  // Register all commands
  registerCommands(context, treeView);

  // Set up event handlers
  setupEventHandlers(context, treeView);

  console.log("Task Master extension initialization completed successfully");
}

/**
 * Register all extension commands
 */
function registerCommands(
  context: vscode.ExtensionContext,
  treeView: vscode.TreeView<any>
): void {
  // Register commands with actual functionality
  const disposables = [
    vscode.commands.registerCommand("taskMaster.refreshTasks", async () => {
      try {
        await taskManagerService.refreshTasks();
        vscode.window.showInformationMessage("Tasks refreshed successfully");
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to refresh tasks: ${error}`);
      }
    }),

    vscode.commands.registerCommand("taskMaster.showNextTask", async () => {
      try {
        const nextTask = await taskManagerService.getNextTask();
        if (nextTask) {
          log("nextTask", nextTask);
          vscode.window.showInformationMessage(
            `Next task: ${nextTask.title} (ID: ${nextTask.id})`
          );
        } else {
          vscode.window.showInformationMessage("No next task available");
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to get next task: ${error}`);
      }
    }),

    vscode.commands.registerCommand("taskMaster.filterByStatus", async () => {
      const statusOptions = [
        { label: "Pending", value: "pending" },
        { label: "In Progress", value: "in-progress" },
        { label: "Done", value: "done" },
        { label: "Blocked", value: "blocked" },
        { label: "Deferred", value: "deferred" },
        { label: "Review", value: "review" },
      ];

      const selected = await vscode.window.showQuickPick(statusOptions, {
        placeHolder: "Select task status to filter by",
      });

      if (selected) {
        const tasks = taskManagerService.getTasksByStatus(
          selected.value as any
        );
        vscode.window.showInformationMessage(
          `Found ${tasks.length} tasks with status: ${selected.label}`
        );
      }
    }),

    vscode.commands.registerCommand(
      "taskMaster.showInTerminal",
      async (taskIdOrTreeItem?: number | TaskTreeItem, taskId?: number) => {
        const actualTaskId = extractTaskId(taskIdOrTreeItem, taskId);

        if (actualTaskId) {
          const terminal = vscode.window.createTerminal("Task Master");
          terminal.sendText(`task-master show ${actualTaskId}`);
          terminal.show();
        } else {
          vscode.window.showWarningMessage("No task ID provided");
        }
      }
    ),

    vscode.commands.registerCommand(
      "taskMaster.markComplete",
      async (taskIdOrTreeItem?: number | TaskTreeItem, taskId?: number) => {
        const actualTaskId = extractTaskId(taskIdOrTreeItem, taskId);

        if (actualTaskId) {
          try {
            await taskManagerService.executeTaskCommand(
              "set-status",
              actualTaskId,
              "done"
            );
          } catch (error) {
            vscode.window.showErrorMessage(`Error completing task: ${error}`);
          }
        } else {
          vscode.window.showWarningMessage("No task ID provided");
        }
      }
    ),

    // New command for checking CLI availability
    vscode.commands.registerCommand("taskMaster.checkCLI", async () => {
      const isAvailable = await taskManagerService.checkCLIAvailability();
      if (isAvailable) {
        vscode.window.showInformationMessage(
          "Task Master CLI is available and working"
        );
      } else {
        vscode.window.showWarningMessage("Task Master CLI is not available");
      }
    }),

    // Command for opening settings
    vscode.commands.registerCommand("taskMaster.openSettings", () => {
      vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "taskMaster"
      );
    }),

    // Command for opening task files from tree view
    vscode.commands.registerCommand(
      "taskMaster.openTaskFile",
      async (filePath: string) => {
        try {
          const uri = vscode.Uri.file(filePath);
          await vscode.window.showTextDocument(uri);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to open file: ${error}`);
        }
      }
    ),

    // Command for refreshing tree view
    vscode.commands.registerCommand("taskMaster.refreshTreeView", () => {
      taskTreeProvider.refresh();
    }),

    // Command for refreshing status bar
    vscode.commands.registerCommand("taskMaster.refreshStatusBar", () => {
      if (statusBarService) {
        statusBarService.refresh();
      }
    }),

    // Command for cycling status bar views
    vscode.commands.registerCommand("taskMaster.cycleStatusBarView", () => {
      statusBarService.cycleView();
    }),

    // Add Task
    vscode.commands.registerCommand("taskMaster.addTask", async () => {
      // TODO: Implement add task flow (input box, CLI call, refresh tree)
      await taskManagerService.addTask();
    }),

    // Expand Task
    vscode.commands.registerCommand(
      "taskMaster.expandTask",
      async (taskIdOrTreeItem?: number | TaskTreeItem, taskId?: number) => {
        const actualTaskId = extractTaskId(taskIdOrTreeItem, taskId);
        await taskManagerService.expandTask(actualTaskId);
      }
    ),

    // Expand All Tasks
    vscode.commands.registerCommand("taskMaster.expandAllTasks", async () => {
      await taskManagerService.expandAllTasks();
    }),

    // Delete Task
    vscode.commands.registerCommand(
      "taskMaster.deleteTask",
      async (taskIdOrTreeItem?: number | TaskTreeItem, taskId?: number) => {
        const actualTaskId = extractTaskId(taskIdOrTreeItem, taskId);
        await taskManagerService.deleteTask(actualTaskId);
      }
    ),

    // Add Dependency
    vscode.commands.registerCommand(
      "taskMaster.addDependency",
      async (taskIdOrTreeItem?: number | TaskTreeItem, taskId?: number) => {
        const actualTaskId = extractTaskId(taskIdOrTreeItem, taskId);
        await taskManagerService.addDependency(actualTaskId);
      }
    ),

    // Remove Dependency
    vscode.commands.registerCommand(
      "taskMaster.removeDependency",
      async (taskIdOrTreeItem?: number | TaskTreeItem, taskId?: number) => {
        const actualTaskId = extractTaskId(taskIdOrTreeItem, taskId);
        await taskManagerService.removeDependency(actualTaskId);
      }
    ),

    // Validate Dependencies
    vscode.commands.registerCommand(
      "taskMaster.validateDependencies",
      async () => {
        // TODO: Implement validate dependencies flow (CLI call, show result)
        await taskManagerService.validateDependencies();
      }
    ),

    // Fix Dependencies
    vscode.commands.registerCommand("taskMaster.fixDependencies", async () => {
      // TODO: Implement fix dependencies flow (CLI call, show result, refresh tree)
      await taskManagerService.fixDependencies();
    }),

    // Change Task Status
    vscode.commands.registerCommand(
      "taskMaster.changeStatus",
      async (taskIdOrTreeItem?: number | TaskTreeItem, taskId?: number) => {
        const actualTaskId = extractTaskId(taskIdOrTreeItem, taskId);

        if (!actualTaskId) {
          vscode.window.showWarningMessage("No task ID provided");
          return;
        }

        const statusOptions = [
          { label: "Pending", value: "pending" },
          { label: "In Progress", value: "in-progress" },
          { label: "Done", value: "done" },
          { label: "Review", value: "review" },
          { label: "Deferred", value: "deferred" },
          { label: "Cancelled", value: "cancelled" },
        ];

        const selected = await vscode.window.showQuickPick(statusOptions, {
          placeHolder: "Select new status for the task",
        });

        if (!selected) {
          vscode.window.showInformationMessage("Task status change cancelled");
          return;
        }

        const success = await taskManagerService.executeTaskCommand(
          "set-status",
          actualTaskId,
          selected.value
        );
        if (success) {
          vscode.window.showInformationMessage(
            `Task ${actualTaskId} status changed to '${selected.label}'`
          );
        } else {
          vscode.window.showErrorMessage(
            `Failed to change status for task ${actualTaskId}`
          );
        }
      }
    ),

    // Update Task
    vscode.commands.registerCommand(
      "taskMaster.updateTask",
      async (taskIdOrTreeItem?: number | TaskTreeItem, taskId?: number) => {
        const actualTaskId = extractTaskId(taskIdOrTreeItem, taskId);
        await taskManagerService.updateTask(actualTaskId);
      }
    ),

    // Analyze Complexity
    vscode.commands.registerCommand(
      "taskMaster.analyzeComplexity",
      async () => {
        try {
          await taskManagerService.analyzeComplexity();
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to analyze complexity: ${error}`
          );
        }
      }
    ),

    // Show Complexity Report
    vscode.commands.registerCommand(
      "taskMaster.showComplexityReport",
      async () => {
        try {
          await taskManagerService.showComplexityReport();
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to show complexity report: ${error}`
          );
        }
      }
    ),

    // ===== SUBTASK COMMANDS =====

    // Update Subtask
    vscode.commands.registerCommand(
      "taskMaster.updateSubtask",
      async (taskTreeItem?: TaskTreeItem) => {
        const subtaskId = extractSubtaskId(taskTreeItem);

        if (!subtaskId) {
          vscode.window.showWarningMessage("No subtask selected");
          return;
        }

        // Prompt for update information
        const updateText = await vscode.window.showInputBox({
          prompt: `Enter update information for subtask ${subtaskId}`,
          placeHolder: "Describe what you want to update...",
          ignoreFocusOut: true,
        });

        if (!updateText) {
          vscode.window.showInformationMessage("Subtask update cancelled");
          return;
        }

        try {
          await taskManagerService.updateSubtask(subtaskId, updateText);
          vscode.window.showInformationMessage(
            `Subtask ${subtaskId} updated successfully`
          );
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to update subtask ${subtaskId}: ${error}`
          );
        }
      }
    ),

    // Change Subtask Status
    vscode.commands.registerCommand(
      "taskMaster.changeSubtaskStatus",
      async (taskTreeItem?: TaskTreeItem) => {
        const subtaskId = extractSubtaskId(taskTreeItem);

        if (!subtaskId) {
          vscode.window.showWarningMessage("No subtask selected");
          return;
        }

        const statusOptions = [
          { label: "Pending", value: "pending" },
          { label: "In Progress", value: "in-progress" },
          { label: "Done", value: "done" },
          { label: "Review", value: "review" },
          { label: "Deferred", value: "deferred" },
          { label: "Cancelled", value: "cancelled" },
        ];

        const selected = await vscode.window.showQuickPick(statusOptions, {
          placeHolder: `Select new status for subtask ${subtaskId}`,
        });

        if (!selected) {
          vscode.window.showInformationMessage(
            "Subtask status change cancelled"
          );
          return;
        }

        try {
          await taskManagerService.setSubtaskStatus(subtaskId, selected.value);
          vscode.window.showInformationMessage(
            `Subtask ${subtaskId} status changed to '${selected.label}'`
          );
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to change status for subtask ${subtaskId}: ${error}`
          );
        }
      }
    ),

    // Remove Subtask
    vscode.commands.registerCommand(
      "taskMaster.removeSubtask",
      async (taskTreeItem?: TaskTreeItem) => {
        const subtaskId = extractSubtaskId(taskTreeItem);

        if (!subtaskId) {
          vscode.window.showWarningMessage("No subtask selected");
          return;
        }

        // Confirm deletion
        const confirmation = await vscode.window.showWarningMessage(
          `Are you sure you want to remove subtask ${subtaskId}?`,
          { modal: true },
          "Remove",
          "Cancel"
        );

        if (confirmation !== "Remove") {
          vscode.window.showInformationMessage("Subtask removal cancelled");
          return;
        }

        try {
          await taskManagerService.removeSubtask(subtaskId);
          vscode.window.showInformationMessage(
            `Subtask ${subtaskId} removed successfully`
          );
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to remove subtask ${subtaskId}: ${error}`
          );
        }
      }
    ),

    // Parse PRD from File
    vscode.commands.registerCommand(
      "taskMaster.parsePRDFromFile",
      async (uri?: vscode.Uri) => {
        try {
          let filePath: string;

          if (uri) {
            // Called from context menu with file URI
            filePath = uri.fsPath;
          } else {
            // Called from command palette, prompt for file
            const fileUri = await vscode.window.showOpenDialog({
              canSelectMany: false,
              openLabel: "Select PRD File",
              filters: {
                "Text files": ["txt"],
                "Markdown files": ["md"],
                "All files": ["*"],
              },
            });

            if (!fileUri || fileUri.length === 0) {
              vscode.window.showInformationMessage("No file selected");
              return;
            }

            filePath = fileUri[0].fsPath;
          }

          await taskManagerService.parsePRDFromFile(filePath);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to execute parse-prd: ${error}`
          );
        }
      }
    ),
  ];

  // Add all disposables to context
  disposables.forEach((disposable) => context.subscriptions.push(disposable));

  // Add tree view to disposables
  context.subscriptions.push(treeView);

  // Add workspace trust change listener
  const trustChangeListener = vscode.workspace.onDidGrantWorkspaceTrust(() => {
    console.log("Workspace trust granted");
    const securityContext = securityService.getSecurityContext();
    vscode.commands.executeCommand(
      "setContext",
      "taskMaster.workspaceTrusted",
      securityContext.isWorkspaceTrusted
    );
    vscode.commands.executeCommand(
      "setContext",
      "taskMaster.cliAllowed",
      securityContext.allowCliExecution
    );
    vscode.window.showInformationMessage(
      "Task Master now has full functionality with workspace trust granted"
    );
  });
  context.subscriptions.push(trustChangeListener);

  // Add status bar to subscriptions for proper cleanup
  context.subscriptions.push(statusBarService);

  // Initialize Task Manager Service and start polling
  taskManagerService.initialize().then(() => {
    console.log("Task Manager Service initialized");
  });

  console.log("Task Master extension activated successfully");
}

/**
 * Setup event handlers for cross-service communication
 */
function setupEventHandlers(
  context: vscode.ExtensionContext,
  treeView: vscode.TreeView<any>
) {
  // Handle task updates
  taskManagerService.on("tasksUpdated", async (tasks) => {
    taskTreeProvider.updateTasks(tasks);

    // Also update current and next task information
    const currentTask = taskManagerService.getCurrentTask();
    const nextTask = await taskManagerService.getNextTask();
    taskTreeProvider.updateCurrentAndNextTasks(currentTask, nextTask);
  });

  // Handle tag changes - refresh everything
  taskManagerService.on("currentTagChanged", async ({ oldTag, newTag }) => {
    console.log(`Tag changed from ${oldTag} to ${newTag}`);

    // Refresh tree view to show tasks for new tag
    taskTreeProvider.refresh();

    // Update current and next task information after tag change
    const currentTask = taskManagerService.getCurrentTask();
    const nextTask = await taskManagerService.getNextTask();
    taskTreeProvider.updateCurrentAndNextTasks(currentTask, nextTask);

    // Update status bar
    statusBarService.refresh();

    // Show notification
    vscode.window.showInformationMessage(`Switched to tag: ${newTag}`);
  });

  // Handle tag errors
  taskManagerService.on("tagError", (error) => {
    console.error("Tag error:", error);
    vscode.window.showErrorMessage(`Tag operation failed: ${error}`);
  });

  // Handle CLI availability
  taskManagerService.on("cliNotAvailable", () => {
    vscode.window.showWarningMessage(
      "Task Master CLI is not available. Some features may be limited."
    );
  });

  // Handle initialization errors
  taskManagerService.on("initializationError", (error) => {
    console.error("Task Manager initialization error:", error);
    vscode.window.showErrorMessage(
      `Failed to initialize Task Master: ${error}`
    );
  });
}

/**
 * This method is called when your extension is deactivated
 */
export function deactivate() {
  console.log("Task Master extension is now deactivated");
  if (taskManagerService) {
    taskManagerService.dispose();
  }
  if (statusBarService) {
    statusBarService.dispose();
  }
  if (securityService) {
    securityService.dispose();
  }
}
