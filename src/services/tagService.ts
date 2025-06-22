import { EventEmitter } from "events";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { TagInfo, TagServiceResponse, Task, TaskMasterConfig } from "../types";
import { CLIService } from "./cliService";
import { ConfigService } from "./configService";

/**
 * Service for managing tag operations
 * Reads tag data from tasks.json and config.json files
 * Uses CLI commands only for operations: add-tag, use-tag, delete-tag
 */
export class TagService extends EventEmitter {
  private cliService: CLIService;
  private currentTag: string = "master"; // Default, will be updated from config
  private taskMasterRoot: string;
  private workspaceFolderUri: string;

  constructor(workspaceFolderUri: string) {
    super();
    if (!workspaceFolderUri) {
      throw new Error(
        "TagService requires a workspaceFolderUri upon construction."
      );
    }
    this.workspaceFolderUri = workspaceFolderUri;
    // TODO: ConfigService.getConfig() might need to accept workspaceFolderUri
    // For now, assuming it provides a general config, CLIService might need folder-specific later.
    const config = ConfigService.getConfig(this.workspaceFolderUri);
    this.cliService = new CLIService(config, this.workspaceFolderUri);
    this.taskMasterRoot = this.findTaskMasterRoot(this.workspaceFolderUri);

    // Initialize currentTag by reading from config asynchronously
    this.initializeCurrentTag();
  }

  private async initializeCurrentTag(): Promise<void> {
    try {
      this.currentTag = await this.getCurrentTagFromConfig();
    } catch (error) {
      console.error(
        `Error initializing current tag for ${this.workspaceFolderUri}:`,
        error
      );
      // Keep default 'master' or handle error as appropriate
    }
  }

  /**
   * Find the .taskmaster directory in the specified workspace folder.
   * @param workspaceFolderUri URI of the workspace folder.
   */
  private findTaskMasterRoot(workspaceFolderUri: string): string {
    const folderPath = vscode.Uri.parse(workspaceFolderUri).fsPath;
    if (!folderPath) {
      throw new Error(
        `Invalid workspace folder URI: ${workspaceFolderUri}`
      );
    }
    const taskMasterPath = path.join(folderPath, ".taskmaster");
    return taskMasterPath;
  }

  /**
   * Get all available tags by parsing tasks.json file
   */
  public async getAllTags(): Promise<TagInfo[]> {
    try {
      // Read tasks.json file directly
      const tasksJsonPath = path.join(
        this.taskMasterRoot,
        "tasks",
        "tasks.json"
      );

      if (!fs.existsSync(tasksJsonPath)) {
        console.warn(`Tasks file not found: ${tasksJsonPath}`);
        return [];
      }

      const tasksContent = fs.readFileSync(tasksJsonPath, "utf-8");
      const tasksData = JSON.parse(tasksContent);

      // Get current tag from config.json
      const currentTag = await this.getCurrentTagFromConfig();
      this.currentTag = currentTag;

      // Extract tags from top-level keys
      const tagInfos: TagInfo[] = [];
      for (const [tagName, tagData] of Object.entries(tasksData)) {
        if (
          typeof tagData === "object" &&
          tagData !== null &&
          "tasks" in tagData
        ) {
          const tasks = (tagData as any).tasks || [];
          const metadata = (tagData as any).metadata || {};

          const tagInfo: TagInfo = {
            name: tagName,
            taskCount: tasks.length,
            description: metadata.description || `Tasks in ${tagName} tag`,
            metadata: {
              lastModified:
                metadata.updated ||
                metadata.created ||
                new Date().toISOString(),
            },
          };
          tagInfos.push(tagInfo);
        }
      }

      this.emit("tagsUpdated", tagInfos);
      return tagInfos;
    } catch (error) {
      console.error("Error getting all tags:", error);
      this.emit("tagError", error);
      return [];
    }
  }

  /**
   * Get current tag from config.json
   */
  private async getCurrentTagFromConfig(): Promise<string> {
    try {
      const configPath = path.join(this.taskMasterRoot, "config.json");

      if (!fs.existsSync(configPath)) {
        console.warn(`Config file not found: ${configPath}`);
        return "master";
      }

      const configContent = fs.readFileSync(configPath, "utf-8");
      const configData = JSON.parse(configContent);

      return configData.global?.defaultTag || "master";
    } catch (error) {
      console.error("Error reading current tag from config:", error);
      return "master";
    }
  }

  /**
   * Get tasks for a specific tag by parsing tasks.json
   */
  public async getTasksByTag(tagId: string): Promise<Task[]> {
    try {
      // Read tasks.json file directly
      const tasksJsonPath = path.join(
        this.taskMasterRoot,
        "tasks",
        "tasks.json"
      );

      if (!fs.existsSync(tasksJsonPath)) {
        console.warn(`Tasks file not found: ${tasksJsonPath}`);
        return [];
      }

      const tasksContent = fs.readFileSync(tasksJsonPath, "utf-8");
      const tasksData = JSON.parse(tasksContent);

      // Extract tasks for the specific tag
      const tagData = tasksData[tagId];
      if (!tagData || typeof tagData !== "object" || !("tasks" in tagData)) {
        console.warn(`Tag ${tagId} not found in tasks.json`);
        return [];
      }

      const tasks: Task[] = tagData.tasks || [];

      this.emit("tasksByTagUpdated", { tag: tagId, tasks });
      return tasks;
    } catch (error) {
      console.error(`Error getting tasks for tag ${tagId}:`, error);
      this.emit("tagError", error);
      return [];
    }
  }

  /**
   * Get current tag information with full metadata
   */
  public async getCurrentTagInfo(): Promise<TagServiceResponse> {
    const allTags = await this.getAllTags();
    const currentTagTasks = await this.getTasksByTag(this.currentTag);

    return {
      currentTag: this.currentTag,
      availableTags: allTags,
      totalTasks: currentTagTasks.length,
    };
  }

  /**
   * Set the current active tag using CLI 'use-tag' command
   */
  public async setCurrentTag(tagId: string): Promise<boolean> {
    try {
      // Execute 'use-tag <tagName>' CLI command
      const result = await this.cliService.executeCommand("use-tag", {
        extraArgs: [tagId],
        format: "text",
      });

      if (typeof result !== "string") {
        throw new Error("Expected text response from use-tag command");
      }

      // Check if the operation was successful
      const isSuccess =
        result.toLowerCase().includes("switched to tag") ||
        result.toLowerCase().includes("now using tag") ||
        result.toLowerCase().includes(tagId);

      if (isSuccess) {
        const oldTag = this.currentTag;
        this.currentTag = tagId;

        this.emit("tagChanged", { oldTag, newTag: tagId });
        return true;
      } else {
        console.error(
          `Failed to switch to tag ${tagId}. CLI response:`,
          result
        );
        return false;
      }
    } catch (error) {
      console.error(`Error setting current tag to ${tagId}:`, error);
      this.emit("tagError", error);
      return false;
    }
  }

  /**
   * Add a new tag using CLI 'add-tag' command
   */
  public async addTag(
    tagName: string,
    options?: {
      copyFromCurrent?: boolean;
      copyFrom?: string;
      description?: string;
    }
  ): Promise<boolean> {
    try {
      const args = [tagName];

      if (options?.copyFromCurrent) {
        args.push("--copy-from-current");
      }

      if (options?.copyFrom) {
        args.push(`--copy-from=${options.copyFrom}`);
      }

      if (options?.description) {
        args.push(`-d="${options.description}"`);
      }

      const result = await this.cliService.executeCommand("add-tag", {
        extraArgs: args,
        format: "text",
      });

      if (typeof result !== "string") {
        throw new Error("Expected text response from add-tag command");
      }

      // Check if the operation was successful
      const isSuccess =
        result.toLowerCase().includes("created") ||
        result.toLowerCase().includes("added") ||
        result.toLowerCase().includes(tagName);

      if (isSuccess) {
        this.emit("tagAdded", tagName);
        return true;
      } else {
        console.error(`Failed to add tag ${tagName}. CLI response:`, result);
        return false;
      }
    } catch (error) {
      console.error(`Error adding tag ${tagName}:`, error);
      this.emit("tagError", error);
      return false;
    }
  }

  /**
   * Delete a tag using CLI 'delete-tag' command
   */
  public async deleteTag(
    tagName: string,
    force: boolean = false
  ): Promise<boolean> {
    try {
      const args = [tagName];

      if (force) {
        args.push("--yes");
      }

      const result = await this.cliService.executeCommand("delete-tag", {
        extraArgs: args,
        format: "text",
      });

      if (typeof result !== "string") {
        throw new Error("Expected text response from delete-tag command");
      }

      // Check if the operation was successful
      const isSuccess =
        result.toLowerCase().includes("deleted") ||
        result.toLowerCase().includes("removed") ||
        (result.toLowerCase().includes(tagName) &&
          result.toLowerCase().includes("success"));

      if (isSuccess) {
        // If we deleted the current tag, switch to master
        if (tagName === this.currentTag) {
          this.currentTag = "master";
        }

        this.emit("tagDeleted", tagName);
        return true;
      } else {
        console.error(`Failed to delete tag ${tagName}. CLI response:`, result);
        return false;
      }
    } catch (error) {
      console.error(`Error deleting tag ${tagName}:`, error);
      this.emit("tagError", error);
      return false;
    }
  }

  /**
   * Get the current tag name
   */
  public getCurrentTag(): string {
    return this.currentTag;
  }

  /**
   * Update configuration (called when CLI config changes)
   */
  public updateConfig(config: TaskMasterConfig): void {
    this.cliService = new CLIService(config);
  }
}
