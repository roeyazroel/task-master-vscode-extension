import { spawn } from "child_process";
import { EventEmitter } from "events";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import {
  CLIExecutionOptions,
  Task,
  TaskMasterConfig,
  TaskMasterResponse,
  TasksFileStructure,
  TaskStats,
} from "../types";

/**
 * Service for interacting with Task Master CLI
 * Handles command execution, output parsing, and polling
 * Uses hybrid approach: CLI for operations, direct JSON file reading for data retrieval
 */
export class CLIService extends EventEmitter {
  private config: TaskMasterConfig;
  private lastRefreshTime: number = 0;
  private isExecuting: boolean = false;
  private workspaceFolderFsPath: string;

  constructor(config: TaskMasterConfig, workspaceFolderUri?: string) {
    super();
    this.config = config;

    if (workspaceFolderUri) {
      this.workspaceFolderFsPath = vscode.Uri.parse(workspaceFolderUri).fsPath;
    } else if (
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders.length > 0
    ) {
      // Fallback to the first workspace folder if no specific URI is provided
      this.workspaceFolderFsPath =
        vscode.workspace.workspaceFolders[0].uri.fsPath;
      console.warn(
        `CLIService initialized without specific workspaceFolderUri, falling back to ${this.workspaceFolderFsPath}`
      );
    } else {
      // If no workspace is open, CLI commands might operate globally or fail.
      // Setting to process.cwd() as a last resort.
      this.workspaceFolderFsPath = process.cwd();
      console.warn(
        "CLIService initialized without a workspace folder, using process.cwd(). Some commands may not work as expected."
      );
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(config: TaskMasterConfig): void {
    this.config = config;
  }

  /**
   * Execute task-master list command and return parsed results
   * Now reads JSON file directly instead of parsing CLI output
   */
  public async refreshTasks(
    options: CLIExecutionOptions = {}
  ): Promise<TaskMasterResponse | string | null> {
    if (this.isExecuting) {
      console.log("CLI execution already in progress, skipping...");
      return null;
    }

    try {
      this.isExecuting = true;
      this.emit("refreshStarted");

      // For list operations, read the JSON file directly
      if (options.readFromFile !== false) {
        const fileResult = await this.readTasksFromFile(options);
        if (fileResult) {
          this.lastRefreshTime = Date.now();
          this.emit("refreshCompleted", fileResult);
          return fileResult;
        }
      }

      // Fallback to CLI execution for operations that modify data
      const result = await this.executeCommand("list", options);
      this.lastRefreshTime = Date.now();
      this.emit("refreshCompleted", result);
      // Only return TaskMasterResponse, ignore string output for list
      if (typeof result === "string") {
        return null;
      }
      return result;
    } catch (error) {
      console.error("Error refreshing tasks:", error);
      this.emit("refreshError", error);
      return null;
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Read tasks directly from JSON file
   * This avoids the issue of parsing formatted CLI output
   */
  private async readTasksFromFile(
    options: CLIExecutionOptions = {}
  ): Promise<TaskMasterResponse | null> {
    try {
      // Use the class member workspaceFolderFsPath
      if (!this.workspaceFolderFsPath) {
        console.log(
          "Workspace folder path not set in CLIService, cannot read tasks file"
        );
        return null;
      }

      const tasksFilePath = path.join(
        this.workspaceFolderFsPath,
        ".taskmaster",
        "tasks",
        "tasks.json"
      );

      if (!fs.existsSync(tasksFilePath)) {
        console.log("Tasks file does not exist:", tasksFilePath);
        return null;
      }

      const tasksContent = fs.readFileSync(tasksFilePath, "utf8");
      const tasksData = JSON.parse(tasksContent) as TasksFileStructure;

      // Convert tasks file structure to expected response format
      const currentTag = this.getCurrentTag(tasksData);
      const allTasks = this.getAllTasksFromTags(tasksData);

      // Apply filtering if status option is provided
      let filteredTasks = allTasks;
      if (options.status) {
        filteredTasks = allTasks.filter((task) => {
          if (task.status !== options.status) {
            return false;
          }

          // Also filter subtasks if withSubtasks is true
          if (options.withSubtasks && task.subtasks) {
            task.subtasks = task.subtasks.filter(
              (subtask) => subtask.status === options.status
            );
          }

          return true;
        });
      }

      // Calculate stats
      const stats = this.calculateTaskStats(filteredTasks);

      // Build response structure
      const response: TaskMasterResponse = {
        data: {
          tasks: filteredTasks,
          filter: options.status || "all",
          stats: stats,
        },
        version: {
          version: tasksData.metadata.version,
          name: "Task Master",
        },
        tag: {
          currentTag: currentTag,
          availableTags: Object.keys(tasksData.tags),
        },
      };

      console.log("Successfully read tasks from file:", tasksFilePath);
      return response;
    } catch (error) {
      console.error("Error reading tasks from file:", error);
      return null;
    }
  }

  /**
   * Get the current tag from the tasks file structure
   */
  private getCurrentTag(tasksData: TasksFileStructure): string {
    for (const tagName in tasksData.tags) {
      if (tasksData.tags[tagName].current) {
        return tagName;
      }
    }
    return Object.keys(tasksData.tags)[0] || "master";
  }

  /**
   * Get all tasks from all tags (or just current tag if needed)
   */
  private getAllTasksFromTags(tasksData: TasksFileStructure): Task[] {
    const currentTag = this.getCurrentTag(tasksData);
    return tasksData.tags[currentTag]?.tasks || [];
  }

  /**
   * Calculate task statistics
   */
  private calculateTaskStats(tasks: Task[]): TaskStats {
    const stats = {
      total: tasks.length,
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
        task.subtasks.forEach((subtask) => {
          stats.subtasks.total++;
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

    // Calculate completion percentages
    if (stats.total > 0) {
      stats.completionPercentage = Math.round(
        (stats.completed / stats.total) * 100
      );
    }
    if (stats.subtasks.total > 0) {
      stats.subtasks.completionPercentage = Math.round(
        (stats.subtasks.completed / stats.subtasks.total) * 100
      );
    }

    return stats;
  }

  /**
   * Execute a specific Task Master CLI command
   * For data retrieval operations, consider using readTasksFromFile instead
   */
  public async executeCommand(
    command: string,
    options: CLIExecutionOptions = {}
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = this.buildCommandArgs(command, options);
      const childProcess = spawn(this.config.cliPath, args, {
        cwd: this.workspaceFolderFsPath || process.cwd(), // Use specific folder or fallback
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      const timeout = options.timeout || 300000; // 5 minute default timeout

      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        childProcess.kill("SIGTERM");
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);

      // Handle stdout data streaming
      childProcess.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
        this.emit("outputReceived", data.toString());
      });

      // Handle stderr
      childProcess.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      // Handle process completion
      childProcess.on("close", (code: number | null) => {
        clearTimeout(timeoutHandle);

        if (code === 0) {
          resolve(stdout);
        } else {
          // Include both stderr and stdout in error message for better debugging
          const errorOutput =
            stderr.trim() || stdout.trim() || "No error output";
          reject(
            new Error(`CLI command failed with code ${code}: ${errorOutput}`)
          );
        }
      });

      // Handle process errors
      childProcess.on("error", (error: Error) => {
        clearTimeout(timeoutHandle);
        reject(new Error(`Failed to spawn CLI process: ${error.message}`));
      });
    });
  }

  /**
   * Build command line arguments based on options
   */
  private buildCommandArgs(
    command: string,
    options: CLIExecutionOptions
  ): string[] {
    const args = [command];

    if (options.withSubtasks) {
      args.push("--with-subtasks");
    }

    if (options.status) {
      args.push("--status", options.status);
    }

    // Add extra arguments if provided
    if (options.extraArgs && options.extraArgs.length > 0) {
      args.push(...options.extraArgs);
    }

    // Note: task-master CLI outputs JSON by default for list commands

    return args;
  }

  /**
   * Check if CLI is available and accessible
   */
  public async checkCLIAvailability(): Promise<boolean> {
    try {
      await this.executeCommand("--version", {
        timeout: 5000,
        format: "text", // Version output is typically text, not JSON
      });
      return true;
    } catch (error) {
      console.error("CLI not available:", error);
      return false;
    }
  }

  /**
   * Get the CLI version and compare against minimum requirement
   * @returns Object with version info and validation result
   */
  public async checkCLIVersion(): Promise<{
    isValid: boolean;
    currentVersion?: string;
    minRequiredVersion: string;
    error?: string;
  }> {
    const minRequiredVersion = "17";

    try {
      const versionOutput = await this.executeCommand("--version", {
        timeout: 5000,
        format: "text",
      });

      // Parse version from output (expecting format like "task-master-ai/0.17.1" or "0.17.1")
      // For Task Master CLI, the format is 0.X.Y where X is the actual version number
      const versionMatch = versionOutput.match(/(\d+)\.(\d+)\.(\d+)/);

      if (!versionMatch) {
        return {
          isValid: false,
          minRequiredVersion,
          error: "Could not parse CLI version from output",
        };
      }

      const currentVersion = versionMatch[0];
      // For Task Master CLI versioning (0.X.Y), the meaningful version is the second number (X)
      const actualVersion = parseInt(versionMatch[2], 10);
      const minRequired = parseInt(minRequiredVersion, 10);

      const isValid = actualVersion >= minRequired;

      return {
        isValid,
        currentVersion,
        minRequiredVersion,
        error: isValid
          ? undefined
          : `CLI version ${currentVersion} is below minimum required version ${minRequiredVersion}`,
      };
    } catch (error) {
      return {
        isValid: false,
        minRequiredVersion,
        error: `Failed to check CLI version: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * Get the time of the last successful refresh
   */
  public getLastRefreshTime(): number {
    return this.lastRefreshTime;
  }

  /**
   * Check if currently executing a command
   */
  public isRefreshing(): boolean {
    return this.isExecuting;
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.removeAllListeners();
  }

  /**
   * Get next task data directly from CLI (bypasses file reading)
   * This is specifically for the "next" command which needs CLI logic
   */
  public async getNextTaskFromCLI(): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = ["next"];
      const childProcess = spawn(this.config.cliPath, args, {
        cwd: this.workspaceFolderFsPath || process.cwd(), // Use specific folder or fallback
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      const timeout = 30000; // 30 second timeout for next command

      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        childProcess.kill("SIGTERM");
        reject(new Error(`Next command timed out after ${timeout}ms`));
      }, timeout);

      // Handle stdout data streaming
      childProcess.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
        this.emit("outputReceived", data.toString());
      });

      // Handle stderr
      childProcess.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      // Handle process completion
      childProcess.on("close", (code: number | null) => {
        clearTimeout(timeoutHandle);

        if (code === 0) {
          resolve(stdout);
        } else {
          // Include both stderr and stdout in error message for better debugging
          const errorOutput =
            stderr.trim() || stdout.trim() || "No error output";
          reject(
            new Error(`Next command failed with code ${code}: ${errorOutput}`)
          );
        }
      });

      // Handle process errors
      childProcess.on("error", (error: Error) => {
        clearTimeout(timeoutHandle);
        reject(new Error(`Failed to spawn next CLI process: ${error.message}`));
      });
    });
  }

  /**
   * Execute parse-prd command with specified file and options
   */
  public async executeParsePRD(options: {
    filePath: string;
    numTasks?: number;
    force?: boolean;
    research?: boolean;
  }): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = ["parse-prd"];

      // Add the input file path
      args.push("--input", options.filePath);

      // Add number of tasks if specified
      if (options.numTasks) {
        args.push("--num-tasks", options.numTasks.toString());
      }

      // Add force flag if specified
      if (options.force) {
        args.push("--force");
      }

      // Add research flag if specified
      if (options.research) {
        args.push("--research");
      }

      const childProcess = spawn(this.config.cliPath, args, {
        cwd: this.workspaceFolderFsPath || process.cwd(), // Use specific folder or fallback
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      const timeout = 300000; // 5 minute timeout for parse-prd

      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        childProcess.kill("SIGTERM");
        reject(new Error(`Parse-PRD command timed out after ${timeout}ms`));
      }, timeout);

      // Handle stdout data streaming
      childProcess.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
        this.emit("outputReceived", data.toString());
      });

      // Handle stderr
      childProcess.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      // Handle process completion
      childProcess.on("close", (code: number | null) => {
        clearTimeout(timeoutHandle);

        if (code === 0) {
          resolve(stdout);
        } else {
          // Include both stderr and stdout in error message for better debugging
          const errorOutput =
            stderr.trim() || stdout.trim() || "No error output";
          reject(
            new Error(
              `Parse-PRD command failed with code ${code}: ${errorOutput}`
            )
          );
        }
      });

      // Handle process errors
      childProcess.on("error", (error: Error) => {
        clearTimeout(timeoutHandle);
        reject(
          new Error(`Failed to spawn parse-prd CLI process: ${error.message}`)
        );
      });
    });
  }
}
