import * as vscode from "vscode";
import { ConfigService } from "./configService";

/**
 * Service for managing CLI availability, installation, and setup
 */
export class CLIManagementService {
  /**
   * Handle CLI not being available with security considerations
   */
  public async handleCLINotAvailable(): Promise<void> {
    // Check workspace trust before offering installation options
    const workspaceTrust = vscode.workspace.isTrusted;

    let actions = ["Learn More"];
    let message = "Task Master CLI not found.";

    if (workspaceTrust) {
      message += " Please install it to use this extension.";
      actions = ["Install Globally", "Set Custom Path", "Learn More"];
    } else {
      message += " CLI installation is restricted in untrusted workspaces.";
    }

    const action = await vscode.window.showWarningMessage(message, ...actions);

    switch (action) {
      case "Install Globally":
        if (workspaceTrust) {
          await this.installCLIGlobally();
        }
        break;
      case "Set Custom Path":
        if (workspaceTrust) {
          await this.promptForCustomCLIPath();
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
   */
  private async promptForCustomCLIPath(): Promise<void> {
    const customPath = await vscode.window.showInputBox({
      prompt: "Enter the path to Task Master CLI executable",
      value: await ConfigService.autoDetectCliPath(),
      validateInput: async (value) => {
        if (!value) {
          return "Path cannot be empty";
        }
        const isValid = await ConfigService.validateCliPath(value);
        return isValid ? null : "Invalid CLI path or CLI not accessible";
      },
    });

    if (customPath) {
      await ConfigService.updateConfig("cliPath", customPath);
      vscode.window.showInformationMessage("CLI path updated successfully");
      return;
    }
  }
}
