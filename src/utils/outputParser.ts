/**
 * Utility functions for parsing and cleaning CLI output
 * Removes ANSI codes, emojis, and box drawing characters to provide clean messages
 */

/**
 * Clean raw CLI output by removing ANSI codes, emojis, and formatting
 */
export function cleanCliOutput(rawOutput: string): string {
  if (!rawOutput) {
    return "";
  }

  let cleaned = rawOutput;

  // Remove ANSI escape codes
  cleaned = cleaned.replace(/\x1b\[[0-9;]*m/g, "");

  // Remove box drawing characters and borders
  cleaned = cleaned.replace(/[╭╮╰╯│─┌┐└┘├┤┬┴┼╰╮╯]/g, "");

  // Remove emojis and special symbols
  cleaned = cleaned.replace(/[🏷️✅❌⚠️📋🔍]/g, "");

  // Remove multiple spaces and clean up whitespace
  cleaned = cleaned.replace(/\s+/g, " ");

  // Remove leading/trailing whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Extract key information from fix-dependencies CLI output
 */
export function parseDependencyFixOutput(rawOutput: string): {
  success: boolean;
  message: string;
  details?: string;
} {
  const cleaned = cleanCliOutput(rawOutput);

  // Check for success indicators
  if (
    cleaned.includes("No dependency issues found") ||
    cleaned.includes("All Dependencies Are Valid") ||
    cleaned.includes("No changes needed")
  ) {
    return {
      success: true,
      message: "All dependencies are valid - no fixes needed",
    };
  }

  // Check for fixes made
  if (cleaned.includes("Dependencies fixed") || cleaned.includes("Fixed")) {
    const taskMatch = cleaned.match(/Tasks checked: (\d+)/);
    const depMatch = cleaned.match(/dependencies verified: (\d+)/);

    let details = "";
    if (taskMatch) {
      details += `${taskMatch[1]} tasks checked`;
    }
    if (depMatch) {
      details += details
        ? `, ${depMatch[1]} dependencies verified`
        : `${depMatch[1]} dependencies verified`;
    }

    return {
      success: true,
      message: "Dependencies have been fixed successfully",
      details,
    };
  }

  // Default case
  return {
    success: false,
    message: "Dependency fix completed",
    details: cleaned,
  };
}

/**
 * Extract key information from validate-dependencies CLI output
 */
export function parseDependencyValidationOutput(rawOutput: string): {
  success: boolean;
  message: string;
  details?: string;
} {
  const cleaned = cleanCliOutput(rawOutput);

  // Check for validation success
  if (
    cleaned.includes("No dependency issues found") ||
    cleaned.includes("All Dependencies Are Valid")
  ) {
    return {
      success: true,
      message: "All dependencies are valid",
    };
  }

  // Check for errors
  if (
    cleaned.includes("error") ||
    cleaned.includes("invalid") ||
    cleaned.includes("circular")
  ) {
    return {
      success: false,
      message: "Dependency validation found issues",
      details: cleaned,
    };
  }

  // Default case
  return {
    success: true,
    message: "Dependency validation completed",
    details: cleaned,
  };
}

/**
 * Extract key information from task deletion CLI output
 */
export function parseTaskDeletionOutput(rawOutput: string): {
  success: boolean;
  message: string;
  taskId?: number;
} {
  const cleaned = cleanCliOutput(rawOutput);

  // Extract task ID if present
  const taskIdMatch = cleaned.match(/task (\d+)/i);
  const taskId = taskIdMatch ? parseInt(taskIdMatch[1]) : undefined;

  if (cleaned.includes("removed") || cleaned.includes("deleted")) {
    return {
      success: true,
      message: taskId
        ? `Task ${taskId} has been deleted`
        : "Task has been deleted",
      taskId,
    };
  }

  if (cleaned.includes("not found") || cleaned.includes("does not exist")) {
    return {
      success: false,
      message: taskId ? `Task ${taskId} was not found` : "Task was not found",
      taskId,
    };
  }

  return {
    success: false,
    message: "Failed to delete task",
    taskId,
  };
}

/**
 * Extract key information from task creation CLI output
 */
export function parseTaskCreationOutput(rawOutput: string): {
  success: boolean;
  message: string;
  taskId?: number;
} {
  const cleaned = cleanCliOutput(rawOutput);

  // Extract task ID if present
  const taskIdMatch =
    cleaned.match(/task (\d+)/i) || cleaned.match(/ID: (\d+)/i);
  const taskId = taskIdMatch ? parseInt(taskIdMatch[1]) : undefined;

  if (cleaned.includes("created") || cleaned.includes("added")) {
    return {
      success: true,
      message: taskId
        ? `Task ${taskId} has been created`
        : "Task has been created",
      taskId,
    };
  }

  return {
    success: false,
    message: "Failed to create task",
    taskId,
  };
}

/**
 * Parse the next task command output to extract only the task ID and subtask status
 */
export function parseNextTaskOutput(rawOutput: string): {
  success: boolean;
  id?: number | string; // Can be number for task or string for subtask
  isSubtask?: boolean;
  message?: string;
} {
  if (!rawOutput) {
    return { success: false, message: "No output received" };
  }

  // Look for "Next Task: #ID - Title" pattern (handles both "123" and "123.4" format)
  const nextTaskMatch = rawOutput.match(
    /Next Task: #([\d.]+) -/ // Only care about the ID
  );

  if (!nextTaskMatch) {
    return { success: false, message: "No next task found" };
  }

  const taskIdStr = nextTaskMatch[1];

  // Determine if this is a subtask (contains a dot) or main task
  const isSubtask = taskIdStr.includes(".");
  const id = isSubtask ? taskIdStr : parseInt(taskIdStr);

  return {
    success: true,
    id,
    isSubtask,
  };
}

/**
 * Extract key information from task status change CLI output
 */
export function parseStatusChangeOutput(rawOutput: string): {
  success: boolean;
  message: string;
  taskId?: number;
  oldStatus?: string;
  newStatus?: string;
} {
  const cleaned = cleanCliOutput(rawOutput);

  // Extract task ID
  const taskIdMatch = cleaned.match(/task (\d+)/i);
  const taskId = taskIdMatch ? parseInt(taskIdMatch[1]) : undefined;

  // Extract status information
  const fromMatch = cleaned.match(/From: (\w+)/i);
  const toMatch = cleaned.match(/To: (\w+)/i);
  const oldStatus = fromMatch ? fromMatch[1] : undefined;
  const newStatus = toMatch ? toMatch[1] : undefined;

  // Alternative status extraction
  if (!oldStatus || !newStatus) {
    const statusUpdateMatch = cleaned.match(
      /Updated task \d+ status from '(\w+)' to '(\w+)'/i
    );
    if (statusUpdateMatch) {
      return {
        success: true,
        message:
          taskId && statusUpdateMatch[1] && statusUpdateMatch[2]
            ? `Task ${taskId} status changed from '${statusUpdateMatch[1]}' to '${statusUpdateMatch[2]}'`
            : "Task status updated successfully",
        taskId,
        oldStatus: statusUpdateMatch[1],
        newStatus: statusUpdateMatch[2],
      };
    }
  }

  if (
    cleaned.includes("Successfully updated") ||
    cleaned.includes("status updated")
  ) {
    const message =
      taskId && oldStatus && newStatus
        ? `Task ${taskId} status changed from '${oldStatus}' to '${newStatus}'`
        : taskId && newStatus
        ? `Task ${taskId} status changed to '${newStatus}'`
        : "Task status updated successfully";

    return {
      success: true,
      message,
      taskId,
      oldStatus,
      newStatus,
    };
  }

  // Check for errors
  if (
    cleaned.includes("error") ||
    cleaned.includes("failed") ||
    cleaned.includes("not found")
  ) {
    return {
      success: false,
      message: taskId
        ? `Failed to update task ${taskId} status`
        : "Failed to update task status",
      taskId,
    };
  }

  return {
    success: true,
    message: "Task status updated",
    taskId,
  };
}
