import * as vscode from "vscode";
import { TaskMasterConfig } from "../types";

/**
 * Service for managing Task Master extension configuration
 * Reads from VS Code settings and provides typed configuration
 */
export class ConfigService {
  private static readonly CONFIG_SECTION = "taskMaster";

  /**
   * Get current configuration from VS Code settings for a specific scope.
   * @param scopeUri Optional URI for the scope (e.g., workspace folder).
   */
  public static getConfig(scopeUri?: string): TaskMasterConfig {
    const scope = scopeUri ? vscode.Uri.parse(scopeUri) : undefined;
    const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION, scope);

    return {
      cliPath: config.get<string>("cliPath") || "task-master",
      // Add other config properties here if any
    };
  }

  /**
   * Update a specific configuration value
   */
  public static async updateConfig(
    key: keyof TaskMasterConfig,
    value: any,
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace,
    scopeUri?: vscode.Uri
  ): Promise<void> {
    // When setting WorkspaceFolder configuration, the scopeUri must be provided.
    // For Global or Workspace, scopeUri should be undefined.
    const config = vscode.workspace.getConfiguration(
      this.CONFIG_SECTION,
      target === vscode.ConfigurationTarget.WorkspaceFolder ? scopeUri : undefined
    );
    await config.update(key, value, target);
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
   * Get workspace-specific CLI path (check node_modules first) for a given workspace folder.
   * @param workspaceFolderUri Optional URI of the workspace folder.
   */
  public static getWorkspaceCliPath(workspaceFolderUri?: string): string {
    let folderPath: string | undefined;
    if (workspaceFolderUri) {
      folderPath = vscode.Uri.parse(workspaceFolderUri).fsPath;
    } else if (
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders.length > 0
    ) {
      folderPath = vscode.workspace.workspaceFolders[0].uri.fsPath; // Fallback to first folder
    }

    if (folderPath) {
      const localCliPath = path.join(
        folderPath,
        "node_modules",
        ".bin",
        "task-master"
      );
      return localCliPath;
    }
    return "task-master"; // Default if no folder context
  }

  /**
   * Auto-detect and suggest CLI path, prioritizing the given workspace folder.
   * @param workspaceFolderUri Optional URI of the workspace folder to check first.
   */
  public static async autoDetectCliPath(
    workspaceFolderUri?: string
  ): Promise<string> {
    // Try workspace local first for the given folder
    const workspacePath = this.getWorkspaceCliPath(workspaceFolderUri);
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
