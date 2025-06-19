import * as vscode from "vscode";
import { TaskManagerService } from "../services/taskManagerService";
import { TagInfo } from "../types";

/**
 * Commands for tag management and tag switching functionality
 */
export class TagCommands {
  constructor(private taskManagerService: TaskManagerService) {}

  /**
   * Show tag selector dropdown and switch to selected tag
   */
  public async selectTag(): Promise<void> {
    try {
      // Get all available tags
      const tagInfos: TagInfo[] = await this.taskManagerService.getAllTags();

      if (tagInfos.length === 0) {
        vscode.window.showWarningMessage("No tags available");
        return;
      }

      // Get current tag for pre-selection
      const currentTag = this.taskManagerService.getCurrentTag();

      // Create quick pick items
      const tagItems = tagInfos.map((tagInfo) => ({
        label: tagInfo.name,
        description: `${tagInfo.taskCount} tasks`,
        detail: tagInfo.description || `Tasks in ${tagInfo.name} tag`,
        tagName: tagInfo.name,
        picked: tagInfo.name === currentTag,
      }));

      // Show tag selector dropdown
      const selectedTag = await vscode.window.showQuickPick(tagItems, {
        placeHolder: `Select a tag (current: ${currentTag})`,
        title: "Switch Tag Context",
        matchOnDescription: true,
        matchOnDetail: true,
        canPickMany: false,
      });

      if (selectedTag && selectedTag.tagName !== currentTag) {
        // Switch to selected tag
        const success = await this.taskManagerService.setCurrentTag(
          selectedTag.tagName
        );

        if (success) {
          vscode.window.showInformationMessage(
            `Switched to tag: ${selectedTag.tagName} (${selectedTag.description})`
          );
        } else {
          vscode.window.showErrorMessage(
            `Failed to switch to tag: ${selectedTag.tagName}`
          );
        }
      } else if (selectedTag && selectedTag.tagName === currentTag) {
        vscode.window.showInformationMessage(
          `Already using tag: ${currentTag}`
        );
      }
    } catch (error) {
      console.error("Error in tag selector:", error);
      vscode.window.showErrorMessage(`Failed to show tag selector: ${error}`);
    }
  }

  /**
   * Show current tag information
   */
  public async showCurrentTagInfo(): Promise<void> {
    try {
      const tagInfo = await this.taskManagerService.getCurrentTagInfo();

      const message =
        `Current Tag: ${tagInfo.currentTag}\n` +
        `Total Tasks: ${tagInfo.totalTasks}\n` +
        `Available Tags: ${tagInfo.availableTags
          .map((t) => t.name)
          .join(", ")}`;

      vscode.window.showInformationMessage(message);
    } catch (error) {
      console.error("Error getting tag info:", error);
      vscode.window.showErrorMessage(`Failed to get tag info: ${error}`);
    }
  }

  /**
   * Quick switch to a specific tag by name (useful for keybindings)
   */
  public async quickSwitchTag(tagName?: string): Promise<void> {
    if (!tagName) {
      // Fall back to showing tag selector
      await this.selectTag();
      return;
    }

    try {
      const success = await this.taskManagerService.setCurrentTag(tagName);

      if (success) {
        vscode.window.showInformationMessage(`Switched to tag: ${tagName}`);
      } else {
        vscode.window.showErrorMessage(`Failed to switch to tag: ${tagName}`);
      }
    } catch (error) {
      console.error("Error switching tag:", error);
      vscode.window.showErrorMessage(`Failed to switch to tag: ${tagName}`);
    }
  }

  /**
   * Get tag selector status bar text
   */
  public async getTagStatusBarText(): Promise<string> {
    try {
      const tagInfo = await this.taskManagerService.getCurrentTagInfo();
      return `$(tag) ${tagInfo.currentTag} (${tagInfo.totalTasks})`;
    } catch (error) {
      console.error("Error getting tag status:", error);
      return "$(tag) master";
    }
  }

  /**
   * Register all tag-related commands
   */
  public static registerCommands(
    context: vscode.ExtensionContext,
    taskManagerService: TaskManagerService
  ): TagCommands {
    const tagCommands = new TagCommands(taskManagerService);

    // Register tag selector command
    const selectTagDisposable = vscode.commands.registerCommand(
      "taskMaster.selectTag",
      () => tagCommands.selectTag()
    );

    // Register show current tag info command
    const showTagInfoDisposable = vscode.commands.registerCommand(
      "taskMaster.showTagInfo",
      () => tagCommands.showCurrentTagInfo()
    );

    // Register quick switch command
    const quickSwitchDisposable = vscode.commands.registerCommand(
      "taskMaster.quickSwitchTag",
      (tagName?: string) => tagCommands.quickSwitchTag(tagName)
    );

    // Add disposables to context
    context.subscriptions.push(
      selectTagDisposable,
      showTagInfoDisposable,
      quickSwitchDisposable
    );

    return tagCommands;
  }
}
