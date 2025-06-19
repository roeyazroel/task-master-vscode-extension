import * as vscode from "vscode";
import { TaskMasterConfig } from "../types";

/**
 * Service for managing Task Master extension configuration
 * Reads from VS Code settings and provides typed configuration
 */
export class ConfigService {
  private static readonly CONFIG_SECTION = "taskMaster";

  /**
   * Get current configuration from VS Code settings
   */
  public static getConfig(): TaskMasterConfig {
    const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);

    return {
      cliPath: config.get<string>("cliPath") || "task-master",
    };
  }

  /**
   * Update a specific configuration value
   */
  public static async updateConfig(
    key: keyof TaskMasterConfig,
    value: any
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
    await config.update(key, value, vscode.ConfigurationTarget.Workspace);
  }

  /**
   * Register configuration change listener
   */
  public static onConfigurationChanged(
    callback: (config: TaskMasterConfig) => void
  ): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(this.CONFIG_SECTION)) {
        callback(this.getConfig());
      }
    });
  }

  /**
   * Validate CLI path accessibility
   */
  public static async validateCliPath(cliPath: string): Promise<boolean> {
    try {
      const { spawn } = await import("child_process");
      return new Promise((resolve) => {
        const process = spawn(cliPath, ["--version"], { stdio: "ignore" });
        process.on("close", (code) => {
          resolve(code === 0);
        });
        process.on("error", () => {
          resolve(false);
        });

        // Timeout after 5 seconds
        setTimeout(() => {
          process.kill();
          resolve(false);
        }, 5000);
      });
    } catch (error) {
      return false;
    }
  }

  /**
   * Get workspace-specific CLI path (check node_modules first)
   */
  public static getWorkspaceCliPath(): string {
    const workspaceRoot = vscode.workspace.rootPath;
    if (workspaceRoot) {
      const localCliPath = `${workspaceRoot}/node_modules/.bin/task-master`;
      return localCliPath;
    }
    return "task-master";
  }

  /**
   * Auto-detect and suggest CLI path
   */
  public static async autoDetectCliPath(): Promise<string> {
    // Try workspace local first
    const workspacePath = this.getWorkspaceCliPath();
    if (await this.validateCliPath(workspacePath)) {
      return workspacePath;
    }

    // Try global installation
    if (await this.validateCliPath("task-master")) {
      return "task-master";
    }

    // Try common global paths
    const commonPaths = [
      "/usr/local/bin/task-master",
      "/usr/bin/task-master",
      `${process.env.HOME}/.npm-global/bin/task-master`,
      `${process.env.HOME}/.local/bin/task-master`,
    ];

    for (const path of commonPaths) {
      if (await this.validateCliPath(path)) {
        return path;
      }
    }

    // Default fallback
    return "task-master";
  }
}
