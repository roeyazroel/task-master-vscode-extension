import * as fs from "fs";
import * as path from "path";
import { Task, TaskMasterConfig, TasksFileStructure } from "../types";
import { TestCLIService } from "./TestCLIService";

/**
 * Test helper utilities for CLI integration tests
 * These helpers avoid VS Code dependencies for unit testing
 */

/**
 * Get a fresh TestCLIService instance configured to use the global task-master binary
 * Creates a minimal config without using ConfigService (which depends on VS Code)
 */
export function getCLIService(): TestCLIService {
  const testConfig: TaskMasterConfig = {
    cliPath: "task-master",
  };
  return new TestCLIService(testConfig);
}

/**
 * Read and parse the current tasks.json file from .taskmaster directory
 * Returns tasks from the current/master tag
 */
export function readTasksFile(): Task[] {
  try {
    // Get workspace root - in tests this should be the extension's root directory
    const workspaceRoot = process.cwd();
    const tasksFilePath = path.join(
      workspaceRoot,
      ".taskmaster",
      "tasks",
      "tasks.json"
    );

    if (!fs.existsSync(tasksFilePath)) {
      throw new Error(`Tasks file not found: ${tasksFilePath}`);
    }

    const tasksContent = fs.readFileSync(tasksFilePath, "utf8");
    const tasksData: TasksFileStructure = JSON.parse(tasksContent);

    // Find the current tag or default to master
    let currentTag = "master";
    for (const tagName in tasksData.tags || {}) {
      if (tasksData.tags[tagName].current) {
        currentTag = tagName;
        break;
      }
    }

    // Legacy format support - if no tags structure, check if data has master at root
    const legacyData = tasksData as any;
    if (legacyData.master && Array.isArray(legacyData.master.tasks)) {
      return legacyData.master.tasks;
    }

    // New format with tags
    if (tasksData.tags && tasksData.tags[currentTag]) {
      return tasksData.tags[currentTag].tasks || [];
    }

    throw new Error("No tasks found in tasks.json");
  } catch (error) {
    throw new Error(`Failed to read tasks file: ${error}`);
  }
}

/**
 * Get the workspace root directory for tests
 */
export function getWorkspaceRoot(): string {
  return process.cwd();
}

/**
 * Check if task-master CLI is available on the system
 * This is a synchronous check for use in test setup
 */
export function isTaskMasterAvailable(): boolean {
  try {
    const { execSync } = require("child_process");
    execSync("task-master --version", { stdio: "ignore", timeout: 5000 });
    return true;
  } catch (error) {
    return false;
  }
}
