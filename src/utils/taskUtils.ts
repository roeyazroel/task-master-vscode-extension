import * as vscode from "vscode";
import { Task, TaskComplexityAnalysis, TaskComplexityReport } from "../types";
import { log } from "../utils/logger";
/**
 * Utility functions for task data manipulation and processing
 */

/**
 * Fix string dependencies (workaround for CLI bug)
 * Converts any string dependencies to numbers
 */
export function fixStringDependencies(tasks: Task[]): Task[] {
  return tasks.map((task) => {
    const fixedTask = { ...task };

    // Fix task dependencies
    if (fixedTask.dependencies && Array.isArray(fixedTask.dependencies)) {
      fixedTask.dependencies = fixedTask.dependencies.map((dep) => {
        // Only convert string dependencies that are pure integers to numbers
        if (typeof dep === "string" && /^\d+$/.test(dep)) {
          const numDep = parseInt(dep, 10);
          console.warn(
            `Fixed string dependency "${dep}" to number ${numDep} in task ${task.id}`
          );
          return numDep;
        }
        // Leave subtask references (e.g., "61.23") as strings
        return dep;
      });
    }

    // Fix subtask dependencies
    if (fixedTask.subtasks && Array.isArray(fixedTask.subtasks)) {
      fixedTask.subtasks = fixedTask.subtasks.map((subtask) => {
        const fixedSubtask = { ...subtask };
        if (
          fixedSubtask.dependencies &&
          Array.isArray(fixedSubtask.dependencies)
        ) {
          fixedSubtask.dependencies = fixedSubtask.dependencies.map((dep) => {
            // Only convert string dependencies that are pure integers to numbers
            if (typeof dep === "string" && /^\d+$/.test(dep)) {
              const numDep = parseInt(dep, 10);
              console.warn(
                `Fixed string dependency "${dep}" to number ${numDep} in subtask ${subtask.id}`
              );
              return numDep;
            }
            // Leave subtask references (e.g., "61.23") as strings
            return dep;
          });
        }
        return fixedSubtask;
      });
    }

    return fixedTask;
  });
}

/**
 * Fix subtask IDs by converting from "parentId.subtaskId" format to simple numeric IDs
 * This is done automatically when tasks are loaded to maintain data consistency
 */
export function fixSubtaskIds(tasks: Task[]): {
  tasks: Task[];
  hasChanges: boolean;
  changedTasks: number[];
} {
  let hasChanges = false;
  const changedTasks: number[] = [];

  const fixedTasks = tasks.map((task) => {
    const fixedTask = { ...task };
    let taskChanged = false;

    // Process subtasks if they exist
    if (fixedTask.subtasks && Array.isArray(fixedTask.subtasks)) {
      fixedTask.subtasks = fixedTask.subtasks.map((subtask, index) => {
        const fixedSubtask = { ...subtask };

        // Check if subtask ID is in "parentId.subtaskId" format
        if (
          typeof fixedSubtask.id === "string" &&
          fixedSubtask.id.includes(".")
        ) {
          const parts = fixedSubtask.id.split(".");
          log(`Subtask ID: ${fixedSubtask.id}, Parts: ${parts}, Task ID: ${task.id}`);
          if (parts.length === 2 && parts[0] === String(task.id)) {
            // Convert to simple numeric ID (use index + 1 for 1-based numbering)
            const newId = index + 1;
            console.log(
              `Fixed subtask ID "${fixedSubtask.id}" to ${newId} in task ${task.id}`
            );
            fixedSubtask.id = newId;
            log(`Fixed subtask ID: ${fixedSubtask.id}`);
            hasChanges = true;
            taskChanged = true;
          }
        }

        return fixedSubtask;
      });
    }

    if (taskChanged) {
      changedTasks.push(Number(task.id));
    }

    return fixedTask;
  });

  log(`Fixed subtasks: ${fixedTasks}`);

  return {
    tasks: fixedTasks,
    hasChanges,
    changedTasks,
  };
}

/**
 * Merge complexity scores into tasks
 */
export function mergeComplexityScores(
  tasks: Task[],
  complexityReport: TaskComplexityReport | null
): Task[] {
  if (!complexityReport) {
    return tasks;
  }

  const complexityMap = new Map<number, TaskComplexityAnalysis>();
  complexityReport.complexityAnalysis.forEach((analysis) => {
    complexityMap.set(analysis.taskId, analysis);
  });

  return tasks.map((task) => {
    const complexity = complexityMap.get(Number(task.id));
    if (complexity) {
      return {
        ...task,
        complexityScore: complexity.complexityScore,
      };
    }
    return task;
  });
}

/**
 * Calculate task statistics
 */
export function calculateStats(tasks: Task[]): any {
  const total = tasks.length;
  const stats = {
    total,
    completed: 0,
    inProgress: 0,
    pending: 0,
    blocked: 0,
    deferred: 0,
    cancelled: 0,
    review: 0,
    completionPercentage: 0,
    subtasks: {
      total: 0,
      completed: 0,
      inProgress: 0,
      pending: 0,
      blocked: 0,
      deferred: 0,
      cancelled: 0,
      completionPercentage: 0,
    },
  };

  tasks.forEach((task) => {
    switch (task.status) {
      case "done":
        stats.completed++;
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

    // Count subtasks
    if (task.subtasks) {
      stats.subtasks.total += task.subtasks.length;
      task.subtasks.forEach((subtask) => {
        switch (subtask.status) {
          case "done":
            stats.subtasks.completed++;
            break;
          case "in-progress":
            stats.subtasks.inProgress++;
            break;
          case "pending":
            stats.subtasks.pending++;
            break;
          case "blocked":
            stats.subtasks.blocked++;
            break;
          case "deferred":
            stats.subtasks.deferred++;
            break;
          case "cancelled":
            stats.subtasks.cancelled++;
            break;
        }
      });
    }
  });

  stats.completionPercentage = total > 0 ? (stats.completed / total) * 100 : 0;
  stats.subtasks.completionPercentage =
    stats.subtasks.total > 0
      ? (stats.subtasks.completed / stats.subtasks.total) * 100
      : 0;

  return stats;
}

/**
 * Read and parse the complexity report from the fixed path
 */
export async function readComplexityReport(
  workspaceRoot: string
): Promise<TaskComplexityReport | null> {
  try {
    const complexityReportPath = `${workspaceRoot}/.taskmaster/reports/task-complexity-report.json`;
    const complexityUri = vscode.Uri.file(complexityReportPath);
    const complexityContent = await vscode.workspace.fs.readFile(complexityUri);
    const complexityData: TaskComplexityReport = JSON.parse(
      Buffer.from(complexityContent).toString()
    );
    return complexityData;
  } catch (error) {
    console.warn("Could not read complexity report:", error);
    return null;
  }
}

/**
 * Find a task by ID from an array of tasks
 */
export function findTaskById(tasks: Task[], taskId: number): Task | null {
  return tasks.find((task) => Number(task.id) === taskId) || null;
}

/**
 * Helper to find dependents of a task from validation result
 * Expects validationResult to have a structure with tasks and their dependencies
 */
export function findDependents(
  taskId: number,
  validationResult: any
): string[] {
  // Defensive: if no data, return empty
  if (
    !validationResult ||
    !validationResult.data ||
    !Array.isArray(validationResult.data.tasks)
  ) {
    return [];
  }
  const dependents: string[] = [];
  // For each task, check if its dependencies include the given taskId
  for (const task of validationResult.data.tasks) {
    if (
      Array.isArray(task.dependencies) &&
      task.dependencies.includes(taskId)
    ) {
      dependents.push(task.id.toString());
    }
  }
  return dependents;
}
