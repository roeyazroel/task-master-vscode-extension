import { EventEmitter } from "events";
import * as vscode from "vscode";

/**
 * Utility functions for file system operations and watching
 */

/**
 * Setup file system watchers for tasks and complexity files
 */
export async function setupFileWatchers(
  eventEmitter: EventEmitter,
  onRefreshTasks: () => Promise<void>
): Promise<{
  tasksFileWatcher?: vscode.FileSystemWatcher;
  complexityFileWatcher?: vscode.FileSystemWatcher;
}> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    console.warn("No workspace open, cannot setup file watchers");
    return {};
  }

  // Setup tasks file watcher
  const tasksFilePattern = new vscode.RelativePattern(
    workspaceRoot,
    ".taskmaster/tasks/tasks.json"
  );

  const tasksFileWatcher = vscode.workspace.createFileSystemWatcher(
    tasksFilePattern,
    false, // Don't ignore create events
    false, // Don't ignore change events
    true // Ignore delete events
  );

  tasksFileWatcher.onDidCreate(() => {
    console.log("Tasks file created, refreshing...");
    onRefreshTasks();
  });

  tasksFileWatcher.onDidChange(() => {
    console.log("Tasks file changed, refreshing...");
    onRefreshTasks();
  });

  // Setup complexity file watcher
  const complexityFilePattern = new vscode.RelativePattern(
    workspaceRoot,
    ".taskmaster/reports/task-complexity-report.json"
  );

  const complexityFileWatcher = vscode.workspace.createFileSystemWatcher(
    complexityFilePattern,
    false, // Don't ignore create events
    false, // Don't ignore change events
    true // Ignore delete events
  );

  complexityFileWatcher.onDidCreate(() => {
    console.log("Complexity report created, refreshing...");
    onRefreshTasks();
  });

  complexityFileWatcher.onDidChange(() => {
    console.log("Complexity report changed, refreshing...");
    onRefreshTasks();
  });

  console.log("File watchers setup for tasks and complexity files");

  return {
    tasksFileWatcher,
    complexityFileWatcher,
  };
}
