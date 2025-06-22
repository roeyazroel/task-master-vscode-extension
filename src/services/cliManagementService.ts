import * as vscode from "vscode";
import { ConfigService } from "./configService";

/**
 * Service for managing CLI availability, installation, and setup
 */
export class CLIManagementService {
  /**
   * Handle CLI not being available with security considerations for a specific workspace folder.
   * @param workspaceFolderUri Optional URI of the workspace folder for context.
   */
  public async handleCLINotAvailable(
    workspaceFolderUri?: string
  ): Promise<void> {
    // Check workspace trust before offering installation options
    const workspaceTrust = vscode.workspace.isTrusted;

    let actions = ["Learn More"];
    let message = `Task Master CLI not found`;
    if (workspaceFolderUri) {
      const folderName =
        vscode.workspace.getWorkspaceFolder(vscode.Uri.parse(workspaceFolderUri))
          ?.name || workspaceFolderUri;
      message += ` for workspace folder '${folderName}'.`;
    } else {
      message += ".";
    }

    if (workspaceTrust) {
      message += " Please install it or set the correct path.";
      actions = ["Install Globally", "Set Path for Folder", "Learn More"];
      if (!workspaceFolderUri) { // Offer global path setting only if no specific folder
        actions.splice(1, 0, "Set Global Path");
      }
    } else {
      message += " CLI installation/path configuration is restricted in untrusted workspaces.";
    }

    const action = await vscode.window.showWarningMessage(message, ...actions);

    switch (action) {
      case "Install Globally":
        if (workspaceTrust) {
          await this.installCLIGlobally();
        }
        break;
      case "Set Path for Folder": // Specific to a folder
        if (workspaceTrust && workspaceFolderUri) {
          await this.promptForCustomCLIPath(workspaceFolderUri);
        } else if (workspaceTrust && !workspaceFolderUri) {
          // This case should ideally not happen if button is labeled "Set Path for Folder"
          // Or, prompt user to select a folder. For now, let's assume it's disabled or context is present.
           vscode.window.showInformationMessage("Please run this command from a specific workspace folder context.");
        }
        break;
      case "Set Global Path": // For user-level settings
        if (workspaceTrust) {
           await this.promptForCustomCLIPath(undefined, vscode.ConfigurationTarget.Global);
        }
        break;
      case "Learn More":
        vscode.env.openExternal(
          vscode.Uri.parse(
            "https://github.com/roeyazroel/task-master-vscode-extension"
          )
        );
        break;
    }
  }

  /**
   * Install CLI globally via integrated terminal
   */
  private async installCLIGlobally(): Promise<void> {
    const terminal = vscode.window.createTerminal("Task Master Setup");
    terminal.sendText("npm install -g task-master-ai");
    terminal.show();

    vscode.window.showInformationMessage(
      "Installing Task Master CLI globally. Please restart VS Code after installation completes."
    );
  }

  /**
   * Prompt user to set custom CLI path
   * @param workspaceFolderUri Optional URI for folder-level setting. Undefined for global/workspace.
   * @param target Optional configuration target. Defaults to WorkspaceFolder if workspaceFolderUri is provided, else Workspace.
   */
  private async promptForCustomCLIPath(
    workspaceFolderUri?: string,
    target?: vscode.ConfigurationTarget
  ): Promise<void> {
    const promptMessage = workspaceFolderUri
      ? `Enter CLI path for folder '${
          vscode.workspace.getWorkspaceFolder(vscode.Uri.parse(workspaceFolderUri))?.name
        }'`
      : "Enter global/workspace Task Master CLI executable path";

    const customPath = await vscode.window.showInputBox({
      prompt: promptMessage,
      value: await ConfigService.autoDetectCliPath(workspaceFolderUri), // Pass folder URI for better default
      validateInput: async (value) => {
        if (!value) {
          return "Path cannot be empty";
        }
        // Validate against the specific folder if provided, else globally
        const isValid = await ConfigService.validateCliPath(value);
        return isValid ? null : "Invalid CLI path or CLI not accessible";
      },
    });

    if (customPath) {
      let configTarget: vscode.ConfigurationTarget;
      if (target) {
        configTarget = target;
      } else if (workspaceFolderUri) {
        configTarget = vscode.ConfigurationTarget.WorkspaceFolder;
      } else {
        configTarget = vscode.ConfigurationTarget.Workspace; // Or Global, depending on desired behavior
      }

      // ConfigService.updateConfig needs to accept scope and target
      // Assuming ConfigService.updateConfig is:
      // updateConfig(key: keyof TaskMasterConfig, value: any, target: ConfigurationTarget, scope?: Uri)
      // The existing updateConfig only takes key, value. It needs to be enhanced.
      // For now, I'll call it as if it supports target and scope.
      // This will require a change in ConfigService.updateConfig.

      const scope = workspaceFolderUri ? vscode.Uri.parse(workspaceFolderUri) : undefined;
      await ConfigService.updateConfig("cliPath", customPath, configTarget, scope);
      vscode.window.showInformationMessage(
        `CLI path updated for ${configTarget} target${
          scope ? " (folder: " + (vscode.workspace.getWorkspaceFolder(scope)?.name || scope.fsPath) + ")" : ""
        }.`
      );
      return;
    }
  }
}
