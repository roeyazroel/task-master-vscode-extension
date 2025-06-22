import { EventEmitter } from "events";
import fs from "fs";
import * as vscode from "vscode";
import {
  TagInfo,
  TagServiceResponse,
  Task,
  TaskMasterResponse,
  TaskStatus,
} from "../types";
import { log } from "../utils/logger";
import {
  calculateStats,
  fixStringDependencies,
  fixSubtaskIds,
  mergeComplexityScores,
  readComplexityReport,
} from "../utils/taskUtils";
import { TagService } from "./tagService";

/**
 * Service for managing task caching and file reading operations
 * Enhanced with tag functionality, supporting multi-root workspaces.
 */
export class TaskCacheService extends EventEmitter {
  private cachedTasksPerFolder: Map<string, Task[]> = new Map();
  private cachedResponsePerFolder: Map<string, TaskMasterResponse | null> =
    new Map();
  private tagServicePerFolder: Map<string, TagService> = new Map();

  constructor() {
    super();
    // Initialization of TagService instances will be done on-demand
    // when a workspace folder is first accessed.
  }

  /**
   * Get or create a TagService instance for a given workspace folder.
   * @param workspaceFolderUri The URI of the workspace folder.
   */
  private getTagService(workspaceFolderUri: string): TagService {
    if (!this.tagServicePerFolder.has(workspaceFolderUri)) {
      const newTagService = new TagService(workspaceFolderUri);
      this.tagServicePerFolder.set(workspaceFolderUri, newTagService);
      this.setupTagServiceEventHandlers(newTagService, workspaceFolderUri);
    }
    return this.tagServicePerFolder.get(workspaceFolderUri)!;
  }

  /**
   * Setup event handlers for a specific tag service instance.
   * @param tagService The TagService instance.
   * @param workspaceFolderUri The URI of the workspace folder for context.
   */
  private setupTagServiceEventHandlers(
    tagService: TagService,
    workspaceFolderUri: string
  ): void {
    tagService.on(
      "currentTagChanged",
      async ({ oldTag, newTag }: { oldTag: string; newTag: string }) => {
        // Refresh tasks when tag changes for this specific folder
        await this.refreshTasksFromFile(workspaceFolderUri);
        this.emit("currentTagChanged", {
          oldTag,
          newTag,
          workspaceFolderUri,
        });
      }
    );

    tagService.on("tagError", (error: Error) => {
      this.emit("tagError", { error, workspaceFolderUri });
    });

    tagService.on("tagsUpdated", (tags: TagInfo[]) => {
      this.emit("tagsUpdated", { tags, workspaceFolderUri });
    });
  }

  /**
   * Read tasks directly from the tasks.json file for a specific workspace folder.
   * @param workspaceFolderUri The URI of the workspace folder.
   */
  public async refreshTasksFromFile(
    workspaceFolderUri: string
  ): Promise<TaskMasterResponse | null> {
    try {
      if (!workspaceFolderUri) {
        throw new Error("Workspace folder URI not provided");
      }
      const tagService = this.getTagService(workspaceFolderUri);

      // Use TagService to get current tag info (uses CLI)
      const tagInfo = await tagService.getCurrentTagInfo();
      const currentTag = tagInfo.currentTag;

      // Get tasks for current tag using TagService (uses CLI with caching)
      const tasks = await tagService.getTasksByTag(currentTag);

      // Fix string dependencies (workaround for CLI bug)
      const fixedTasks = fixStringDependencies(tasks);

      // Fix subtask IDs and check if changes were made
      const subtaskFixResult = fixSubtaskIds(fixedTasks);
      log(`Subtask fix result: ${subtaskFixResult}`);
      let finalTasks = subtaskFixResult.tasks;

      // If subtask IDs were fixed, we need to trigger a file update via CLI
      if (subtaskFixResult.hasChanges) {
        log(
          `Fixed subtask IDs in tasks: ${subtaskFixResult.changedTasks.join(
            ", "
          )}. File will be updated.`
        );

        const currentTag = this.tagService.getCurrentTag();
        const currentTasksFilePath = `${workspaceRoot}/.taskmaster/tasks/tasks.json`;
        log(`Current tasks file path: ${currentTasksFilePath}`);
        const currentTasksFileContent = fs.readFileSync(
          currentTasksFilePath,
          "utf8"
        );
        const currentTasksFileData = JSON.parse(currentTasksFileContent);
        currentTasksFileData[currentTag].tasks = finalTasks;
        fs.writeFileSync(
          currentTasksFilePath,
          JSON.stringify(currentTasksFileData, null, 2)
        );
        finalTasks = subtaskFixResult.tasks;
      }

      // Read complexity report and merge scores into tasks
      const complexityReport = await readComplexityReport(workspaceRoot);
      const tasksWithComplexity = mergeComplexityScores(
        finalTasks,
        complexityReport
      );

      // Create a TaskMasterResponse-like structure
      const response: TaskMasterResponse = {
        data: {
          tasks: tasksWithComplexity,
          filter: "all",
          stats: calculateStats(tasksWithComplexity),
        },
        version: {
          version: "0.17.0",
          name: "task-master-ai",
        },
        tag: {
          currentTag: currentTag,
          availableTags: tagInfo.availableTags.map((tag) => tag.name),
        },
      };

      this.cachedResponse = response;
      this.cachedTasks = response.data.tasks;
      this.emit("tasksUpdated", response.data.tasks);
      return response;
    } catch (error) {
      log(`Error refreshing tasks:`, error, true);
      this.emit("refreshError", error);
      return null;
    }
  }

  /**
   * Get all available tags with metadata
   */
  public async getAllTags(): Promise<TagInfo[]> {
    return await this.tagService.getAllTags();
  }

  /**
   * Get tasks for a specific tag
   */
  public async getTasksByTag(tagId: string): Promise<Task[]> {
    return await this.tagService.getTasksByTag(tagId);
  }

  /**
   * Get current tag information
   */
  public async getCurrentTagInfo(): Promise<TagServiceResponse> {
    return await this.tagService.getCurrentTagInfo();
  }

  /**
   * Set the current active tag
   */
  public async setCurrentTag(tagId: string): Promise<boolean> {
    return await this.tagService.setCurrentTag(tagId);
  }

  /**
   * Get current tag name
   */
  public getCurrentTag(): string {
    return this.tagService.getCurrentTag();
  }

  /**
   * Get cached tasks
   */
  public getTasks(): Task[] {
    return [...this.cachedTasks];
  }

  /**
   * Get cached response with metadata
   */
  public getResponse(): TaskMasterResponse | null {
    return this.cachedResponse;
  }

  /**
   * Get tasks filtered by status
   */
  public getTasksByStatus(status: TaskStatus): Task[] {
    return this.cachedTasks.filter((task) => task.status === status);
  }

  /**
   * Get a specific task by ID
   */
  public getTask(id: number): Task | undefined {
    return this.cachedTasks.find((task) => task.id === id);
  }

  /**
   * Get next actionable task (fallback implementation)
   */
  public getNextTask(): Task | null {
    return (
      this.cachedTasks.find(
        (task) =>
          task.status === "pending" &&
          task.dependencies &&
          task.dependencies.length === 0
      ) || null
    );
  }

  /**
   * Clear cached data for a specific folder or all folders.
   * @param workspaceFolderUri If provided, clears cache only for this folder. Otherwise, clears all.
   */
  public clearCache(workspaceFolderUri?: string): void {
    if (workspaceFolderUri) {
      this.cachedTasksPerFolder.delete(workspaceFolderUri);
      this.cachedResponsePerFolder.delete(workspaceFolderUri);
      const tagService = this.tagServicePerFolder.get(workspaceFolderUri);
      if (tagService) {
        // If TagService had its own cache or disposables, call them here.
        // For now, just removing it from map.
        this.tagServicePerFolder.delete(workspaceFolderUri);
      }
    } else {
      this.cachedTasksPerFolder.clear();
      this.cachedResponsePerFolder.clear();
      // Dispose all managed TagService instances if they have disposables.
      this.tagServicePerFolder.forEach(service => { /* service.dispose() if it exists */ });
      this.tagServicePerFolder.clear();
    }
  }
}
