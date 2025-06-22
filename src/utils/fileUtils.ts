import { EventEmitter } from "events";
import * as vscode from "vscode";

/**
 * Utility functions for file system operations and watching
 */

/**
 * Setup file system watchers for tasks and complexity files for a specific workspace folder.
 * @param workspaceFolderUri The URI of the workspace folder.
 * @param onRefreshTasks Callback to trigger when a relevant file changes.
 */
export async function setupFileWatchersForFolder(
  workspaceFolderUri: string,
  onRefreshTasks: (uri: string) => Promise<void> // Pass URI to callback
): Promise<{
  tasksFileWatcher?: vscode.FileSystemWatcher;
  complexityFileWatcher?: vscode.FileSystemWatcher;
}> {
  const folderPath = vscode.Uri.parse(workspaceFolderUri).fsPath;
  if (!folderPath) {
    console.warn(
      `Invalid workspace folder URI ${workspaceFolderUri}, cannot setup file watchers.`
    );
    return {};
  }

  // Check if .taskmaster directory exists
  // TODO: This check might be better placed in TaskManagerService before calling this.
  // For now, assume we only call this for folders known to have .taskmaster.

  // Setup tasks file watcher
  const tasksFilePattern = new vscode.RelativePattern(
    vscode.Uri.parse(workspaceFolderUri), // Use Uri object for RelativePattern
    ".taskmaster/tasks/tasks.json"
  );

  const tasksFileWatcher = vscode.workspace.createFileSystemWatcher(
    tasksFilePattern,
    false, // Don't ignore create events
    false, // Don't ignore change events
    true // Ignore delete events
  );

  tasksFileWatcher.onDidCreate(() => {
    console.log(
      `Tasks file created in ${workspaceFolderUri}, refreshing...`
    );
    onRefreshTasks(workspaceFolderUri);
  });

  tasksFileWatcher.onDidChange(() => {
    console.log(
      `Tasks file changed in ${workspaceFolderUri}, refreshing...`
    );
    onRefreshTasks(workspaceFolderUri);
  });

  // Setup complexity file watcher
  const complexityFilePattern = new vscode.RelativePattern(
    vscode.Uri.parse(workspaceFolderUri), // Use Uri object
    ".taskmaster/reports/task-complexity-report.json"
  );

  const complexityFileWatcher = vscode.workspace.createFileSystemWatcher(
    complexityFilePattern,
    false, // Don't ignore create events
    false, // Don't ignore change events
    true // Ignore delete events
  );

  complexityFileWatcher.onDidCreate(() => {
    console.log(
      `Complexity report created in ${workspaceFolderUri}, refreshing...`
    );
    onRefreshTasks(workspaceFolderUri);
  });

  complexityFileWatcher.onDidChange(() => {
    console.log(
      `Complexity report changed in ${workspaceFolderUri}, refreshing...`
    );
    onRefreshTasks(workspaceFolderUri);
  });

  console.log(
    `File watchers setup for tasks and complexity files in ${workspaceFolderUri}`
  );

  return {
    tasksFileWatcher,
    complexityFileWatcher,
  };
}
