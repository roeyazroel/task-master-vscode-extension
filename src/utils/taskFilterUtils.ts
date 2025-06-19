import { TagInfo, Task } from "../types";

/**
 * Utility functions for client-side task filtering by tag
 * Provides memoization and caching for optimal performance
 */

interface FilterState {
  currentSelectedTag: string;
  lastFilteredTasks: Task[];
  lastFilterTime: number;
  allTasks: Task[];
  allTasksTime: number;
}

class TaskFilterManager {
  private state: FilterState = {
    currentSelectedTag: "master",
    lastFilteredTasks: [],
    lastFilterTime: 0,
    allTasks: [],
    allTasksTime: 0,
  };

  private readonly CACHE_TTL = 5000; // 5 seconds for filter cache

  /**
   * Set the current selected tag
   */
  public setCurrentSelectedTag(tagId: string): void {
    if (this.state.currentSelectedTag !== tagId) {
      this.state.currentSelectedTag = tagId;
      // Clear cached filtered results since tag changed
      this.state.lastFilteredTasks = [];
      this.state.lastFilterTime = 0;
    }
  }

  /**
   * Get the current selected tag
   */
  public getCurrentSelectedTag(): string {
    return this.state.currentSelectedTag;
  }

  /**
   * Filter tasks by the currently selected tag with memoization
   * Returns empty array immediately if no tasks match, without throwing errors
   */
  public filterTasksByTag(allTasks: Task[], tagId?: string): Task[] {
    const targetTag = tagId || this.state.currentSelectedTag;
    const now = Date.now();

    // Check if we can use cached results
    if (
      targetTag === this.state.currentSelectedTag &&
      this.isFilterCacheValid() &&
      this.areTasksUnchanged(allTasks)
    ) {
      return [...this.state.lastFilteredTasks];
    }

    // Filter tasks - for now, return all tasks since CLI handles tag filtering
    // In the CLI-based approach, tasks are already filtered by the active tag
    const filteredTasks = [...allTasks];

    // Update cache
    this.state.lastFilteredTasks = filteredTasks;
    this.state.lastFilterTime = now;
    this.state.allTasks = [...allTasks];
    this.state.allTasksTime = now;

    return filteredTasks;
  }

  /**
   * Filter tasks by a specific tag (different from current selected tag)
   * This is useful for previewing other tags without switching
   */
  public filterTasksBySpecificTag(allTasks: Task[], tagId: string): Task[] {
    // Since we're using CLI-based approach, we would need to switch tags
    // For now, return empty array if it's not the current tag
    if (tagId === this.state.currentSelectedTag) {
      return this.filterTasksByTag(allTasks, tagId);
    }

    // For different tags, return empty array - would need CLI call to get those tasks
    return [];
  }

  /**
   * Get available tags from task data (utility function)
   */
  public extractTagsFromTasks(allTasks: Task[]): TagInfo[] {
    // In CLI-based approach, we should use TagService.getAllTags() instead
    // This is a fallback for cases where we only have task data
    const tagSet = new Set<string>();

    // For now, just return the current tag since CLI manages tags
    return [
      {
        name: this.state.currentSelectedTag,
        taskCount: allTasks.length,
        description: `Tasks in ${this.state.currentSelectedTag} tag`,
      },
    ];
  }

  /**
   * Check if filter cache is still valid
   */
  private isFilterCacheValid(): boolean {
    return Date.now() - this.state.lastFilterTime < this.CACHE_TTL;
  }

  /**
   * Check if the task list has changed since last filter
   */
  private areTasksUnchanged(allTasks: Task[]): boolean {
    if (allTasks.length !== this.state.allTasks.length) {
      return false;
    }

    // Quick check - compare first and last task IDs
    if (allTasks.length > 0 && this.state.allTasks.length > 0) {
      const firstChanged = allTasks[0].id !== this.state.allTasks[0].id;
      const lastChanged =
        allTasks[allTasks.length - 1].id !==
        this.state.allTasks[this.state.allTasks.length - 1].id;
      return !firstChanged && !lastChanged;
    }

    return true;
  }

  /**
   * Clear all cached filter data
   */
  public clearFilterCache(): void {
    this.state.lastFilteredTasks = [];
    this.state.lastFilterTime = 0;
    this.state.allTasks = [];
    this.state.allTasksTime = 0;
  }

  /**
   * Get filter statistics for debugging
   */
  public getFilterStats(): {
    currentTag: string;
    cachedTasksCount: number;
    lastFilterTime: number;
    cacheAge: number;
    isValid: boolean;
  } {
    return {
      currentTag: this.state.currentSelectedTag,
      cachedTasksCount: this.state.lastFilteredTasks.length,
      lastFilterTime: this.state.lastFilterTime,
      cacheAge: Date.now() - this.state.lastFilterTime,
      isValid: this.isFilterCacheValid(),
    };
  }
}

// Export singleton instance for use across the extension
export const taskFilterManager = new TaskFilterManager();

/**
 * Convenience functions for direct use
 */

/**
 * Filter tasks by tag with memoization
 * Returns empty array if no tasks match the specified tag
 */
export function filterTasksByTag(allTasks: Task[], tagId?: string): Task[] {
  return taskFilterManager.filterTasksByTag(allTasks, tagId);
}

/**
 * Set the current selected tag for filtering
 */
export function setCurrentSelectedTag(tagId: string): void {
  taskFilterManager.setCurrentSelectedTag(tagId);
}

/**
 * Get the current selected tag
 */
export function getCurrentSelectedTag(): string {
  return taskFilterManager.getCurrentSelectedTag();
}

/**
 * Clear filter cache
 */
export function clearFilterCache(): void {
  taskFilterManager.clearFilterCache();
}
