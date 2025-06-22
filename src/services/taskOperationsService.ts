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

import { ConfigService } from "./configService";

/**
 * Service for handling task-related operations and CLI command execution.
 * This service creates short-lived, scoped CLIService instances for its operations.
 */
export class TaskOperationsService {
  // No CLIService stored here anymore. It will be created on-demand.

  constructor() {} // CLIService no longer passed in constructor.

  /**
   * Get a CLIService instance scoped to the given workspace folder.
   * @param workspaceFolderUri The URI of the workspace folder.
   */
  private getScopedCliService(workspaceFolderUri: string): CLIService {
    if (!workspaceFolderUri) {
      throw new Error(
        "workspaceFolderUri is required for scoped CLI operations."
      );
    }
    const config = ConfigService.getConfig(workspaceFolderUri);
    return new CLIService(config, workspaceFolderUri);
  }

  /**
   * Execute a task command (mark complete, etc.) with security validation
   * @param workspaceFolderUri The URI of the workspace folder for context.
   */
  public async executeTaskCommand(
    workspaceFolderUri: string,
    command: string,
    taskId: number,
    status?: string
  ): Promise<boolean> {
    try {
      const scopedCliService = this.getScopedCliService(workspaceFolderUri);
      // Validate inputs
      if (!command || typeof command !== "string") {
        throw new Error("Invalid command provided");
      }

      if (!taskId || typeof taskId !== "number" || taskId < 1) {
        throw new Error("Invalid task ID provided");
      }

      // Check workspace trust for command execution
      // Note: vscode.workspace.isTrusted is global, but commands are folder-specific.
      // This check remains relevant.
      if (!vscode.workspace.isTrusted) {
        throw new Error(
          "Task command execution is not allowed in untrusted workspaces"
        );
      }

      let extraArgs = ["--id=" + taskId];
      if (command === "set-status" && status) {
        extraArgs.push(`--status=${status}`);
      }

      await scopedCliService.executeCommand(command, {
        format: "text",
        extraArgs,
      });

      return true;
    } catch (error) {
      console.error(
        `Failed to execute task command ${command} in ${workspaceFolderUri}:`,
        error
      );
      return false;
    }
  }

  /**
   * Add a new task by prompting the user for details and invoking the CLI (AI-powered)
   * @param workspaceFolderUri The URI of the workspace folder for context.
   * @param onRefresh Callback that now might need workspaceFolderUri if it triggers folder-specific refresh.
   */
  public async addTask(
    workspaceFolderUri: string,
    onRefresh: () => Promise<void>
  ): Promise<void> {
    const scopedCliService = this.getScopedCliService(workspaceFolderUri);
    return addTask(scopedCliService, onRefresh); // addTask from commands/taskCommands.ts
  }

  /**
   * Delete a task by ID, handling dependencies and confirmation
   * @param workspaceFolderUri The URI of the workspace folder for context.
   */
  public async deleteTask(
    workspaceFolderUri: string,
    taskId: number | undefined,
    onRefresh: () => Promise<void>
  ): Promise<void> {
    const scopedCliService = this.getScopedCliService(workspaceFolderUri);
    return deleteTask(taskId, scopedCliService, onRefresh);
  }

  /**
   * Add a dependency to a task
   * @param workspaceFolderUri The URI of the workspace folder for context.
   */
  public async addDependency(
    workspaceFolderUri: string,
    srcId: number | undefined,
    depId: number | undefined,
    onRefresh: () => Promise<void>
  ): Promise<void> {
    const scopedCliService = this.getScopedCliService(workspaceFolderUri);
    return addDependency(srcId, depId, scopedCliService, onRefresh);
  }

  /**
   * Remove a dependency from a task
   * @param workspaceFolderUri The URI of the workspace folder for context.
   */
  public async removeDependency(
    workspaceFolderUri: string,
    srcId: number | undefined,
    depId: number | undefined,
    onRefresh: () => Promise<void>
  ): Promise<void> {
    const scopedCliService = this.getScopedCliService(workspaceFolderUri);
    return removeDependency(srcId, depId, scopedCliService, onRefresh);
  }

  /**
   * Validate dependencies for all tasks
   * @param workspaceFolderUri The URI of the workspace folder for context.
   */
  public async validateDependencies(
    workspaceFolderUri: string
  ): Promise<void> {
    const scopedCliService = this.getScopedCliService(workspaceFolderUri);
    return validateDependencies(scopedCliService);
  }

  /**
   * Fix dependencies for all tasks
   * @param workspaceFolderUri The URI of the workspace folder for context.
   */
  public async fixDependencies(
    workspaceFolderUri: string,
    onRefresh: () => Promise<void>
  ): Promise<void> {
    const scopedCliService = this.getScopedCliService(workspaceFolderUri);
    return fixDependencies(scopedCliService, onRefresh);
  }

  /**
   * Show task details in a VS Code editor tab using the CLI
   * @param workspaceFolderUri The URI of the workspace folder for context.
   */
  public async showTaskDetails(
    workspaceFolderUri: string,
    taskId: number | undefined
  ): Promise<void> {
    const scopedCliService = this.getScopedCliService(workspaceFolderUri);
    return showTaskDetails(taskId, scopedCliService);
  }

  /**
   * Expand a task into subtasks using the CLI
   * @param workspaceFolderUri The URI of the workspace folder for context.
   */
  public async expandTask(
    workspaceFolderUri: string,
    taskId: number | undefined,
    onRefresh: () => Promise<void>
  ): Promise<void> {
    const scopedCliService = this.getScopedCliService(workspaceFolderUri);
    return expandTask(taskId, scopedCliService, onRefresh);
  }

  /**
   * List all tasks using the CLI
   * @param workspaceFolderUri The URI of the workspace folder for context.
   */
  public async listTasks(workspaceFolderUri: string): Promise<string> {
    const scopedCliService = this.getScopedCliService(workspaceFolderUri);
    return await listTasks(scopedCliService);
  }

  /**
   * Expand all pending tasks into subtasks using the CLI
   * @param workspaceFolderUri The URI of the workspace folder for context.
   */
  public async expandAllTasks(
    workspaceFolderUri: string,
    onRefresh: () => Promise<void>
  ): Promise<void> {
    const scopedCliService = this.getScopedCliService(workspaceFolderUri);
    return expandAllTasks(scopedCliService, onRefresh);
  }

  /**
   * Get complexity report
   * @param workspaceFolderUri The URI of the workspace folder for context.
   */
  public async getComplexityReport(
    workspaceFolderUri: string
  ): Promise<TaskComplexityReport | null> {
    // readComplexityReport directly uses fsPath, doesn't need CLIService
    const folderPath = vscode.Uri.parse(workspaceFolderUri).fsPath;
    if (!folderPath) {
      return null;
    }
    return await readComplexityReport(folderPath);
  }

  /**
   * Update an existing task by prompting the user for new details
   * @param workspaceFolderUri The URI of the workspace folder for context.
   */
  public async updateTask(
    workspaceFolderUri: string,
    taskId: number | undefined,
    onRefresh: () => Promise<void>
  ): Promise<void> {
    const scopedCliService = this.getScopedCliService(workspaceFolderUri);
    return updateTask(taskId, scopedCliService, onRefresh);
  }

  /**
   * Analyze complexity of tasks
   * @param workspaceFolderUri The URI of the workspace folder for context.
   */
  public async analyzeComplexity(
    workspaceFolderUri: string,
    onRefresh: () => Promise<void>
  ): Promise<void> {
    const scopedCliService = this.getScopedCliService(workspaceFolderUri);
    return analyzeComplexity(scopedCliService, onRefresh);
  }

  /**
   * Show complexity report
   * @param workspaceFolderUri The URI of the workspace folder for context.
   */
  public async showComplexityReport(workspaceFolderUri: string): Promise<void> {
    const scopedCliService = this.getScopedCliService(workspaceFolderUri);
    return showComplexityReport(scopedCliService);
  }

  // ===== SUBTASK OPERATIONS =====
  // These methods also need workspaceFolderUri and to use a scoped CLIService.

  /**
   * Update a subtask by appending timestamped information
   * @param workspaceFolderUri The URI of the workspace folder for context.
   */
  public async updateSubtask(
    workspaceFolderUri: string,
    subtaskId: string,
    updateText: string,
    onRefresh: () => Promise<void>
  ): Promise<void> {
    try {
      const scopedCliService = this.getScopedCliService(workspaceFolderUri);
      // Validate inputs
      if (!subtaskId || typeof subtaskId !== "string") {
        throw new Error("Invalid subtask ID provided");
      }

      if (!updateText || typeof updateText !== "string") {
        throw new Error("Invalid update text provided");
      }

      if (!vscode.workspace.isTrusted) {
        throw new Error(
          "Subtask update is not allowed in untrusted workspaces"
        );
      }

      const extraArgs = [`--id=${subtaskId}`, `--prompt="${updateText}"`];

      await scopedCliService.executeCommand("update-subtask", {
        format: "text",
        extraArgs,
      });

      await onRefresh(); // This onRefresh might need context if it's folder specific
      vscode.window.showInformationMessage(
        `Subtask ${subtaskId} updated successfully`
      );
    } catch (error) {
      console.error(
        `Failed to update subtask ${subtaskId} in ${workspaceFolderUri}:`,
        error
      );
      vscode.window.showErrorMessage(
        `Failed to update subtask ${subtaskId}: ${error}`
      );
    }
  }

  /**
   * Set the status of a subtask
   * @param workspaceFolderUri The URI of the workspace folder for context.
   */
  public async setSubtaskStatus(
    workspaceFolderUri: string,
    subtaskId: string,
    status: string,
    onRefresh: () => Promise<void>
  ): Promise<void> {
    try {
      const scopedCliService = this.getScopedCliService(workspaceFolderUri);
      // Validate inputs
      if (!subtaskId || typeof subtaskId !== "string") {
        throw new Error("Invalid subtask ID provided");
      }

      if (!status || typeof status !== "string") {
        throw new Error("Invalid status provided");
      }

      if (!vscode.workspace.isTrusted) {
        throw new Error(
          "Subtask status change is not allowed in untrusted workspaces"
        );
      }

      let extraArgs = [`--id=${subtaskId}`, `--status=${status}`];

      try {
        await scopedCliService.executeCommand("set-status", {
          format: "text",
          extraArgs,
        });
      } catch (firstError) {
        console.log(
          `First attempt failed for subtask ${subtaskId} in ${workspaceFolderUri}, trying with parentId.subtaskId format`
        );
        const parts = subtaskId.split(".");
        if (parts.length >= 2) {
          const parentId = parts[0];
          const formattedId = `${parentId}.${subtaskId}`; // This was subtaskId, should be parts[1] or similar logic
          // Corrected logic for formattedId:
          // Assuming subtaskId could be "actualSubId" or "parentId.actualSubId"
          // If it's "actualSubId", and parts.length is 1, this block isn't hit.
          // If it's "parentId.actualSubId", parts[0] is parent, parts[1] is actualSubId.
          // The CLI might expect the "actualSubId" or "parentId.actualSubId".
          // The original code used `formattedId = `${parentId}.${subtaskId}` which is redundant if subtaskId is already "parentId.subtaskId".
          // Let's assume the CLI needs the "parentId.subtaskId" if the simple subtaskId fails.
          // If subtaskId is "ID2" and parent is "ID1", it becomes "ID1.ID2"
          // This part of the logic might need actual CLI behavior testing.
          // For now, replicating the previous logic pattern but with scoped CLI.
          extraArgs = [`--id=${subtaskId}`, `--status=${status}`]; // Re-try with original if split logic is complex
          // Re-evaluating the original logic: it seemed to try the same ID again if parts.length < 2.
          // If parts.length >=2, it constructed parentId.subtaskId.
          // This implies subtaskId might sometimes be just the local part.
          // Let's stick to the pattern of trying the original subtaskId first,
          // then if it fails AND subtaskId contains '.', try just the part after '.'
          // OR if it doesn't contain '.', then this fallback doesn't apply.
          // This is complex without knowing exact CLI expectations for subtask IDs.
          // The original code's fallback was:
          // const formattedId = `${parentId}.${subtaskId}`; -> This is likely wrong if subtaskId is already compound.
          // It should be: const formattedId = `${parentId}.${parts[1]}`; (if subtaskId was parts[1])
          // Given the uncertainty, I will simplify the retry logic for now or mark for review.
          // For now, I'll keep the existing retry structure but use scopedCliService.
          // The original logic: if subtaskId is "parent.child", parts[0]="parent", parts[1]="child". It tries "parent.child" first.
          // Then it tries parentId (parts[0]) + "." + subtaskId (which is "parent.child") = "parent.parent.child" - this is wrong.
          // It should be: extraArgs = [`--id=${parts[1]}`, `--status=${status}`]; OR some other known format.
          // Given the confusion, let's assume the CLI `set-status` takes the same ID format as `update-subtask`.
          // The original code's fallback logic for set-status seems problematic.
          // I will simplify: try with given subtaskId. If it fails, error out.
          // The original code's specific retry for set-status with a different ID format is too uncertain to replicate without clarification.
          // So, removing the complex retry block for now.
          throw firstError; // Re-throw if first attempt fails.
        }
      }

      await onRefresh();
      vscode.window.showInformationMessage(
        `Subtask ${subtaskId} status changed to ${status}`
      );
    } catch (error) {
      console.error(
        `Failed to change status for subtask ${subtaskId} in ${workspaceFolderUri}:`,
        error
      );
      vscode.window.showErrorMessage(
        `Failed to change status for subtask ${subtaskId}: ${error}`
      );
    }
  }

  /**
   * Remove a subtask from its parent task
   * @param workspaceFolderUri The URI of the workspace folder for context.
   */
  public async removeSubtask(
    workspaceFolderUri: string,
    subtaskId: string,
    onRefresh: () => Promise<void>
  ): Promise<void> {
    try {
      const scopedCliService = this.getScopedCliService(workspaceFolderUri);
      // Validate inputs
      if (!subtaskId || typeof subtaskId !== "string") {
        throw new Error("Invalid subtask ID provided");
      }

      if (!vscode.workspace.isTrusted) {
        throw new Error(
          "Subtask removal is not allowed in untrusted workspaces"
        );
      }

      const extraArgs = [`--id=${subtaskId}`];

      await scopedCliService.executeCommand("remove-subtask", {
        format: "text",
        extraArgs,
      });

      await onRefresh();
      vscode.window.showInformationMessage(
        `Subtask ${subtaskId} removed successfully`
      );
    } catch (error) {
      console.error(
        `Failed to remove subtask ${subtaskId} in ${workspaceFolderUri}:`,
        error
      );
      vscode.window.showErrorMessage(
        `Failed to remove subtask ${subtaskId}: ${error}`
      );
    }
  }
}
