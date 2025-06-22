import * as vscode from "vscode";
import { setupFileWatchersForFolder } from "../utils/fileUtils"; // Renamed import

/**
 * Service for managing file system watchers for tasks and complexity files
 * across multiple workspace folders.
 */
export class FileWatcherService {
  // Store watchers per workspace folder URI
  private watchersMap: Map<
    string,
    {
      tasksFileWatcher?: vscode.FileSystemWatcher;
      complexityFileWatcher?: vscode.FileSystemWatcher;
    }
  > = new Map();

  /**
   * Setup file system watchers for a specific workspace folder.
   * @param workspaceFolderUri The URI of the workspace folder.
   * @param onTasksChanged Callback to execute when tasks or complexity files change.
   *                       It receives the workspaceFolderUri as an argument.
   */
  public async setupWatchersForWorkspaceFolder(
    workspaceFolderUri: string,
    onTasksChanged: (uri: string) => Promise<void>
  ): Promise<void> {
    // Dispose existing watchers for this folder, if any
    this.disposeWatchersForFolder(workspaceFolderUri);

    // TODO: Add a check here or in TaskManagerService to only setup watchers
    // if a .taskmaster directory exists in workspaceFolderUri.

    const watchers = await setupFileWatchersForFolder(
      workspaceFolderUri,
      onTasksChanged
    );

    if (watchers.tasksFileWatcher || watchers.complexityFileWatcher) {
      this.watchersMap.set(workspaceFolderUri, watchers);
    }
  }

  /**
   * Dispose of file watchers for a specific workspace folder.
   * @param workspaceFolderUri The URI of the workspace folder.
   */
  private disposeWatchersForFolder(workspaceFolderUri: string): void {
    const existingWatchers = this.watchersMap.get(workspaceFolderUri);
    if (existingWatchers) {
      existingWatchers.tasksFileWatcher?.dispose();
      existingWatchers.complexityFileWatcher?.dispose();
      this.watchersMap.delete(workspaceFolderUri);
    }
  }

  /**
   * Dispose of all file watchers managed by this service.
   */
  public dispose(): void {
    for (const workspaceFolderUri of this.watchersMap.keys()) {
      this.disposeWatchersForFolder(workspaceFolderUri);
    }
    this.watchersMap.clear();
    // Note: If FileWatcherService was an EventEmitter, you'd call removeAllListeners here.
    // As it stands, it doesn't extend EventEmitter directly.
  }
}
