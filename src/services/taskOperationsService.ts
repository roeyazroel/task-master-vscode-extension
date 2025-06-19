import * as vscode from "vscode";
import {
  addDependency,
  fixDependencies,
  removeDependency,
  validateDependencies,
} from "../commands/dependencyCommands";
import {
  addTask,
  analyzeComplexity,
  deleteTask,
  expandAllTasks,
  expandTask,
  listTasks,
  showComplexityReport,
  showTaskDetails,
  updateTask,
} from "../commands/taskCommands";
import { TaskComplexityReport } from "../types";
import { readComplexityReport } from "../utils/taskUtils";
import { CLIService } from "./cliService";

/**
 * Service for handling task-related operations and CLI command execution
 */
export class TaskOperationsService {
  constructor(private cliService: CLIService) {}

  /**
   * Execute a task command (mark complete, etc.) with security validation
   */
  public async executeTaskCommand(
    command: string,
    taskId: number,
    status?: string
  ): Promise<boolean> {
    try {
      // Validate inputs
      if (!command || typeof command !== "string") {
        throw new Error("Invalid command provided");
      }

      if (!taskId || typeof taskId !== "number" || taskId < 1) {
        throw new Error("Invalid task ID provided");
      }

      // Check workspace trust for command execution
      if (!vscode.workspace.isTrusted) {
        throw new Error(
          "Task command execution is not allowed in untrusted workspaces"
        );
      }

      let extraArgs = ["--id=" + taskId];
      if (command === "set-status" && status) {
        extraArgs.push(`--status=${status}`);
      }

      const output = await this.cliService.executeCommand(command, {
        format: "text",
        extraArgs,
      });

      return true;
    } catch (error) {
      console.error(`Failed to execute task command ${command}:`, error);
      return false;
    }
  }

  /**
   * Add a new task by prompting the user for details and invoking the CLI (AI-powered)
   */
  public async addTask(onRefresh: () => Promise<void>): Promise<void> {
    return addTask(this.cliService, onRefresh);
  }

  /**
   * Delete a task by ID, handling dependencies and confirmation
   */
  public async deleteTask(
    taskId: number | undefined,
    onRefresh: () => Promise<void>
  ): Promise<void> {
    return deleteTask(taskId, this.cliService, onRefresh);
  }

  /**
   * Add a dependency to a task
   */
  public async addDependency(
    srcId: number | undefined,
    depId: number | undefined,
    onRefresh: () => Promise<void>
  ): Promise<void> {
    return addDependency(srcId, depId, this.cliService, onRefresh);
  }

  /**
   * Remove a dependency from a task
   */
  public async removeDependency(
    srcId: number | undefined,
    depId: number | undefined,
    onRefresh: () => Promise<void>
  ): Promise<void> {
    return removeDependency(srcId, depId, this.cliService, onRefresh);
  }

  /**
   * Validate dependencies for all tasks
   */
  public async validateDependencies(): Promise<void> {
    return validateDependencies(this.cliService);
  }

  /**
   * Fix dependencies for all tasks
   */
  public async fixDependencies(onRefresh: () => Promise<void>): Promise<void> {
    return fixDependencies(this.cliService, onRefresh);
  }

  /**
   * Show task details in a VS Code editor tab using the CLI
   */
  public async showTaskDetails(taskId: number | undefined): Promise<void> {
    return showTaskDetails(taskId, this.cliService);
  }

  /**
   * Expand a task into subtasks using the CLI
   */
  public async expandTask(
    taskId: number | undefined,
    onRefresh: () => Promise<void>
  ): Promise<void> {
    return expandTask(taskId, this.cliService, onRefresh);
  }

  /**
   * List all tasks using the CLI
   */
  public async listTasks(): Promise<string> {
    return await listTasks(this.cliService);
  }

  /**
   * Expand all pending tasks into subtasks using the CLI
   */
  public async expandAllTasks(onRefresh: () => Promise<void>): Promise<void> {
    return expandAllTasks(this.cliService, onRefresh);
  }

  /**
   * Get complexity report
   */
  public async getComplexityReport(): Promise<TaskComplexityReport | null> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      return null;
    }
    return await readComplexityReport(workspaceRoot);
  }

  /**
   * Update an existing task by prompting the user for new details
   */
  public async updateTask(
    taskId: number | undefined,
    onRefresh: () => Promise<void>
  ): Promise<void> {
    return updateTask(taskId, this.cliService, onRefresh);
  }

  /**
   * Analyze complexity of tasks
   */
  public async analyzeComplexity(
    onRefresh: () => Promise<void>
  ): Promise<void> {
    return analyzeComplexity(this.cliService, onRefresh);
  }

  /**
   * Show complexity report
   */
  public async showComplexityReport(): Promise<void> {
    return showComplexityReport(this.cliService);
  }

  // ===== SUBTASK OPERATIONS =====

  /**
   * Update a subtask by appending timestamped information
   */
  public async updateSubtask(
    subtaskId: string,
    updateText: string,
    onRefresh: () => Promise<void>
  ): Promise<void> {
    try {
      // Validate inputs
      if (!subtaskId || typeof subtaskId !== "string") {
        throw new Error("Invalid subtask ID provided");
      }

      if (!updateText || typeof updateText !== "string") {
        throw new Error("Invalid update text provided");
      }

      // Check workspace trust for command execution
      if (!vscode.workspace.isTrusted) {
        throw new Error(
          "Subtask update is not allowed in untrusted workspaces"
        );
      }

      const extraArgs = [`--id=${subtaskId}`, `--prompt="${updateText}"`];

      await this.cliService.executeCommand("update-subtask", {
        format: "text",
        extraArgs,
      });

      await onRefresh();
      vscode.window.showInformationMessage(
        `Subtask ${subtaskId} updated successfully`
      );
    } catch (error) {
      console.error(`Failed to update subtask ${subtaskId}:`, error);
      vscode.window.showErrorMessage(
        `Failed to update subtask ${subtaskId}: ${error}`
      );
    }
  }

  /**
   * Set the status of a subtask
   */
  public async setSubtaskStatus(
    subtaskId: string,
    status: string,
    onRefresh: () => Promise<void>
  ): Promise<void> {
    try {
      // Validate inputs
      if (!subtaskId || typeof subtaskId !== "string") {
        throw new Error("Invalid subtask ID provided");
      }

      if (!status || typeof status !== "string") {
        throw new Error("Invalid status provided");
      }

      // Check workspace trust for command execution
      if (!vscode.workspace.isTrusted) {
        throw new Error(
          "Subtask status change is not allowed in untrusted workspaces"
        );
      }

      let extraArgs = [`--id=${subtaskId}`, `--status=${status}`];

      try {
        // First attempt: try with original subtaskId
        await this.cliService.executeCommand("set-status", {
          format: "text",
          extraArgs,
        });
      } catch (firstError) {
        // If first attempt fails, try with parentId.subtaskId format
        console.log(`First attempt failed for subtask ${subtaskId}, trying with parentId.subtaskId format`);

        // Extract parent ID from subtaskId (assuming format like "4.1" where "4" is parent)
        const parts = subtaskId.split('.');
        if (parts.length >= 2) {
          const parentId = parts[0];
          const formattedId = `${parentId}.${subtaskId}`;
          extraArgs = [`--id=${formattedId}`, `--status=${status}`];

          await this.cliService.executeCommand("set-status", {
            format: "text",
            extraArgs,
          });
        } else {
          // If we can't parse the subtaskId format, rethrow the original error
          throw firstError;
        }
      }

      await onRefresh();
      vscode.window.showInformationMessage(
        `Subtask ${subtaskId} status changed to ${status}`
      );
    } catch (error) {
      console.error(`Failed to change status for subtask ${subtaskId}:`, error);
      vscode.window.showErrorMessage(
        `Failed to change status for subtask ${subtaskId}: ${error}`
      );
    }
  }

  /**
   * Remove a subtask from its parent task
   */
  public async removeSubtask(
    subtaskId: string,
    onRefresh: () => Promise<void>
  ): Promise<void> {
    try {
      // Validate inputs
      if (!subtaskId || typeof subtaskId !== "string") {
        throw new Error("Invalid subtask ID provided");
      }

      // Check workspace trust for command execution
      if (!vscode.workspace.isTrusted) {
        throw new Error(
          "Subtask removal is not allowed in untrusted workspaces"
        );
      }

      const extraArgs = [`--id=${subtaskId}`];

      await this.cliService.executeCommand("remove-subtask", {
        format: "text",
        extraArgs,
      });

      await onRefresh();
      vscode.window.showInformationMessage(
        `Subtask ${subtaskId} removed successfully`
      );
    } catch (error) {
      console.error(`Failed to remove subtask ${subtaskId}:`, error);
      vscode.window.showErrorMessage(
        `Failed to remove subtask ${subtaskId}: ${error}`
      );
    }
  }
}
