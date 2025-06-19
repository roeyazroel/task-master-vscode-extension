import * as vscode from "vscode";
import { CLIService } from "../services/cliService";
import {
  parseDependencyFixOutput,
  parseDependencyValidationOutput,
} from "../utils/outputParser";

/**
 * Command handlers for dependency operations
 */

/**
 * Add a dependency to a task
 */
export async function addDependency(
  srcId: number | undefined,
  depId: number | undefined,
  cliService: CLIService,
  onRefreshTasks: () => Promise<void>
): Promise<void> {
  try {
    let sourceTaskId: number;
    let dependencyTaskId: number;

    // Get source task ID if not provided or invalid
    if (!srcId || isNaN(srcId)) {
      const sourceInput = await vscode.window.showInputBox({
        prompt: "Enter the ID of the task that will depend on another task",
        placeHolder: "e.g., 5",
        validateInput: (value) => {
          const num = parseInt(value);
          return isNaN(num) || num <= 0 ? "Please enter a valid task ID" : null;
        },
      });
      if (!sourceInput) {
        vscode.window.showInformationMessage("Add dependency cancelled");
        return;
      }
      sourceTaskId = parseInt(sourceInput);
    } else {
      sourceTaskId = srcId;
    }

    // Get dependency task ID if not provided or invalid
    if (!depId || isNaN(depId)) {
      const depInput = await vscode.window.showInputBox({
        prompt: `Enter the ID of the task that task ${sourceTaskId} should depend on`,
        placeHolder: "e.g., 3",
        validateInput: (value) => {
          const num = parseInt(value);
          return isNaN(num) || num <= 0 ? "Please enter a valid task ID" : null;
        },
      });
      if (!depInput) {
        vscode.window.showInformationMessage("Add dependency cancelled");
        return;
      }
      dependencyTaskId = parseInt(depInput);
    } else {
      dependencyTaskId = depId;
    }

    // Validate that source and dependency are different
    if (sourceTaskId === dependencyTaskId) {
      vscode.window.showErrorMessage("A task cannot depend on itself");
      return;
    }

    // Debug: log the command being executed
    console.log(
      `Executing: add-dependency --id=${sourceTaskId} --depends-on=${dependencyTaskId}`
    );

    // Ensure we pass numeric values (not strings) to CLI
    await cliService.executeCommand("add-dependency", {
      extraArgs: [
        `--id=${Number(sourceTaskId)}`,
        `--depends-on=${Number(dependencyTaskId)}`,
      ],
      format: "text",
    });
    await onRefreshTasks();
    vscode.window.showInformationMessage(
      `Dependency added: Task ${sourceTaskId} now depends on task ${dependencyTaskId}`
    );
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to add dependency: ${error}`);
  }
}

/**
 * Remove a dependency from a task
 */
export async function removeDependency(
  srcId: number | undefined,
  depId: number | undefined,
  cliService: CLIService,
  onRefreshTasks: () => Promise<void>
): Promise<void> {
  try {
    let sourceTaskId: number;
    let dependencyTaskId: number;

    // Get source task ID if not provided or invalid
    if (!srcId || isNaN(srcId)) {
      const sourceInput = await vscode.window.showInputBox({
        prompt: "Enter the ID of the task to remove dependency from",
        placeHolder: "e.g., 5",
        validateInput: (value) => {
          const num = parseInt(value);
          return isNaN(num) || num <= 0 ? "Please enter a valid task ID" : null;
        },
      });
      if (!sourceInput) {
        vscode.window.showInformationMessage("Remove dependency cancelled");
        return;
      }
      sourceTaskId = parseInt(sourceInput);
    } else {
      sourceTaskId = srcId;
    }

    // Always show current dependencies and prompt for which one to remove
    try {
      const taskResult = await cliService.executeCommand("show", {
        extraArgs: [`--id=${sourceTaskId}`],
        format: "text",
      });
      // Just show the output as information, since we can't parse dependencies from text
      if (
        taskResult &&
        typeof taskResult === "string" &&
        taskResult.trim().length > 0
      ) {
        vscode.window.showInformationMessage(
          `Task ${sourceTaskId} details:\n${taskResult.trim()}`
        );
      } else {
        vscode.window.showWarningMessage(
          `No details found for task ${sourceTaskId}`
        );
        return;
      }
    } catch (error) {
      console.log("Could not fetch task details for dependency info:", error);
    }

    // Get dependency task ID if not provided or invalid
    if (!depId || isNaN(depId)) {
      const depInput = await vscode.window.showInputBox({
        prompt: `Enter the ID of the dependency to remove from task ${sourceTaskId}`,
        placeHolder: "e.g., 3",
        validateInput: (value) => {
          const num = parseInt(value);
          return isNaN(num) || num <= 0 ? "Please enter a valid task ID" : null;
        },
      });
      if (!depInput) {
        vscode.window.showInformationMessage("Remove dependency cancelled");
        return;
      }
      dependencyTaskId = parseInt(depInput);
    } else {
      dependencyTaskId = depId;
    }

    // Debug: log the command being executed
    console.log(
      `Executing: remove-dependency --id=${sourceTaskId} --depends-on=${dependencyTaskId}`
    );

    // Ensure we pass numeric values (not strings) to CLI
    const result = await cliService.executeCommand("remove-dependency", {
      extraArgs: [
        `--id=${Number(sourceTaskId)}`,
        `--depends-on=${Number(dependencyTaskId)}`,
      ],
      format: "text",
    });

    // Debug: log the result
    console.log("Remove dependency result:", result);

    await onRefreshTasks();
    vscode.window.showInformationMessage(
      `Dependency removed: Task ${sourceTaskId} no longer depends on task ${dependencyTaskId}`
    );
  } catch (error) {
    // Enhanced error handling with more details
    console.error("Remove dependency error:", error);

    // Try to extract more meaningful error info
    let errorMessage = `Failed to remove dependency: ${error}`;
    if (
      error instanceof Error &&
      error.message.includes("CLI command failed")
    ) {
      // Extract task IDs from error for better messaging
      const taskIdMatch = error.message.match(/--id=(\d+)/);
      const depIdMatch = error.message.match(/--depends-on=(\d+)/);
      const taskId = taskIdMatch ? taskIdMatch[1] : "unknown";
      const depId = depIdMatch ? depIdMatch[1] : "unknown";

      errorMessage += `\n\nThis could be due to:
- Task ${taskId} doesn't exist
- Task ${depId} doesn't exist
- Task ${taskId} doesn't actually depend on task ${depId}
- CLI communication issue

Try running 'task-master show --id=${taskId}' in terminal to verify the task and its dependencies.`;
    }

    vscode.window.showErrorMessage(errorMessage);
  }
}

/**
 * Validate dependencies for all tasks
 */
export async function validateDependencies(
  cliService: CLIService
): Promise<void> {
  try {
    const result = await cliService.executeCommand("validate-dependencies", {
      format: "text",
    });

    // Parse the CLI output for clean user messages
    if (result && result.toString().trim()) {
      const resultText = result.toString().trim();
      const parsed = parseDependencyValidationOutput(resultText);

      if (parsed.success) {
        vscode.window.showInformationMessage(parsed.message);
      } else {
        const message = parsed.details
          ? `${parsed.message}: ${parsed.details}`
          : parsed.message;
        vscode.window.showWarningMessage(message);
      }
    } else {
      vscode.window.showInformationMessage(
        "Dependencies validated - no issues found"
      );
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to validate dependencies: ${error}`);
  }
}

/**
 * Fix dependencies for all tasks
 */
export async function fixDependencies(
  cliService: CLIService,
  onRefreshTasks: () => Promise<void>
): Promise<void> {
  try {
    const confirm = await vscode.window.showWarningMessage(
      "This will automatically fix invalid dependencies. Continue?",
      { modal: true },
      "Yes",
      "No"
    );

    if (confirm !== "Yes") {
      vscode.window.showInformationMessage("Fix dependencies cancelled");
      return;
    }

    const result = await cliService.executeCommand("fix-dependencies", {
      format: "text",
    });
    await onRefreshTasks();

    // Parse the CLI output for clean user messages
    if (result && result.toString().trim()) {
      const resultText = result.toString().trim();
      const parsed = parseDependencyFixOutput(resultText);

      if (parsed.success) {
        const message = parsed.details
          ? `${parsed.message} (${parsed.details})`
          : parsed.message;
        vscode.window.showInformationMessage(message);
      } else {
        vscode.window.showWarningMessage(parsed.message);
      }
    } else {
      vscode.window.showInformationMessage(
        "Dependencies fixed successfully - no changes needed"
      );
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to fix dependencies: ${error}`);
  }
}
