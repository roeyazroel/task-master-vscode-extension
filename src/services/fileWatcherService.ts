import { EventEmitter } from "events";
import * as vscode from "vscode";
import { setupFileWatchers } from "../utils/fileUtils";

/**
 * Service for managing file system watchers for tasks and complexity files
 */
export class FileWatcherService extends EventEmitter {
  private tasksFileWatcher?: vscode.FileSystemWatcher;
  private complexityFileWatcher?: vscode.FileSystemWatcher;

  /**
   * Setup file system watchers for tasks and complexity files
   */
  public async setupFileWatchers(
    onTasksChanged: () => Promise<void>
  ): Promise<void> {
    const watchers = await setupFileWatchers(this, onTasksChanged);
    this.tasksFileWatcher = watchers.tasksFileWatcher;
    this.complexityFileWatcher = watchers.complexityFileWatcher;
  }

  /**
   * Dispose of all file watchers
   */
  public dispose(): void {
    if (this.tasksFileWatcher) {
      this.tasksFileWatcher.dispose();
    }
    if (this.complexityFileWatcher) {
      this.complexityFileWatcher.dispose();
    }
    this.removeAllListeners();
  }
}
