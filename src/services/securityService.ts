import * as path from "path";
import * as vscode from "vscode";

/**
 * Service for handling security-related operations
 * Ensures compliance with VS Code marketplace security requirements
 */
export class SecurityService {
  private static instance: SecurityService | null = null;

  private constructor() {}

  /**
   * Get singleton instance of SecurityService
   */
  public static getInstance(): SecurityService {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService();
    }
    return SecurityService.instance;
  }

  /**
   * Check if the current workspace is trusted
   * Returns false for untrusted workspaces to limit functionality
   */
  public isWorkspaceTrusted(): boolean {
    // Check workspace trust state
    const workspaceTrust = vscode.workspace.isTrusted;

    if (workspaceTrust === undefined) {
      // If trust state is undefined, assume untrusted for security
      return false;
    }

    return workspaceTrust;
  }

  /**
   * Validate CLI path for security concerns
   * Prevents execution of arbitrary binaries in untrusted workspaces
   */
  public validateCliPath(cliPath: string): {
    isValid: boolean;
    reason?: string;
  } {
    // In untrusted workspaces, only allow well-known CLI names
    if (!this.isWorkspaceTrusted()) {
      const allowedCliNames = ["task-master", "taskmaster"];
      const basename = path.basename(cliPath);

      if (!allowedCliNames.includes(basename)) {
        return {
          isValid: false,
          reason:
            "Custom CLI paths are not allowed in untrusted workspaces for security reasons",
        };
      }

      // Don't allow absolute paths in untrusted workspaces
      if (path.isAbsolute(cliPath) && cliPath !== basename) {
        return {
          isValid: false,
          reason: "Absolute CLI paths are not allowed in untrusted workspaces",
        };
      }
    }

    // Validate path doesn't contain dangerous characters
    const dangerousPatterns = [
      /\.\./, // Directory traversal
      /[;&|`$(){}[\]]/, // Shell injection characters
      /\s/, // Spaces that could break command execution
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(cliPath)) {
        return {
          isValid: false,
          reason: "CLI path contains potentially dangerous characters",
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Sanitize file paths to prevent directory traversal attacks
   */
  public sanitizeFilePath(
    filePath: string,
    workspaceRoot?: string
  ): string | null {
    try {
      // Resolve and normalize the path
      const normalizedPath = path.normalize(filePath);

      // If workspace root is provided, ensure the path is within it
      if (workspaceRoot) {
        const resolvedPath = path.resolve(workspaceRoot, normalizedPath);
        const resolvedWorkspaceRoot = path.resolve(workspaceRoot);

        // Check if the resolved path starts with the workspace root
        if (!resolvedPath.startsWith(resolvedWorkspaceRoot)) {
          return null; // Path is outside workspace
        }

        return resolvedPath;
      }

      return normalizedPath;
    } catch (error) {
      // Path resolution failed
      return null;
    }
  }

  /**
   * Validate command arguments to prevent injection attacks
   */
  public validateCommandArgs(args: string[]): {
    isValid: boolean;
    reason?: string;
  } {
    const dangerousPatterns = [
      /[;&|`$()]/, // Shell injection
      /\.\./, // Directory traversal
      /^-/, // Prevent option injection (should be handled by caller)
    ];

    for (const arg of args) {
      for (const pattern of dangerousPatterns) {
        if (pattern.test(arg)) {
          return {
            isValid: false,
            reason: `Argument contains potentially dangerous characters: ${arg}`,
          };
        }
      }
    }

    return { isValid: true };
  }

  /**
   * Get security context for the current workspace
   */
  public getSecurityContext(): {
    isWorkspaceTrusted: boolean;
    allowCliExecution: boolean;
    allowFileAccess: boolean;
    securityLevel: "high" | "medium" | "low";
  } {
    const isTrusted = this.isWorkspaceTrusted();

    return {
      isWorkspaceTrusted: isTrusted,
      allowCliExecution: isTrusted,
      allowFileAccess: true, // Always allow file access, but sanitize paths
      securityLevel: isTrusted ? "low" : "high",
    };
  }

  /**
   * Show security warning for untrusted workspaces
   */
  public async showUntrustedWorkspaceWarning(): Promise<boolean> {
    if (this.isWorkspaceTrusted()) {
      return true; // No warning needed
    }

    const result = await vscode.window.showWarningMessage(
      "Task Master has limited functionality in untrusted workspaces. Some features like CLI execution may be restricted for security.",
      "Trust Workspace",
      "Continue with Limited Features"
    );

    if (result === "Trust Workspace") {
      // Open workspace trust dialog
      await vscode.commands.executeCommand(
        "workbench.action.manageTrustedDomain"
      );
      return false; // User needs to manually trust
    }

    return result === "Continue with Limited Features";
  }

  /**
   * Dispose of the security service
   */
  public dispose(): void {
    SecurityService.instance = null;
  }
}
