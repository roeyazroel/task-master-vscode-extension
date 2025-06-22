# Task Master VS Code Extension: Multi-Root Workspace Support

## Technical Product Requirements Document (PRD)

**Version:** 1.0
**Date:** December 2024
**Priority:** High
**Status:** Draft

---

## Executive Summary

The Task Master VS Code extension currently only supports single-folder workspaces, severely limiting its utility in modern development environments where multi-root workspaces are increasingly common. This PRD outlines the technical requirements to implement comprehensive workspace support, enabling the extension to intelligently detect workspace types and provide repository-level task organization.

## Problem Statement

### Current Limitations

1. **Single-Folder Architecture**: The extension exclusively uses `vscode.workspace.workspaceFolders?.[0]?.uri.fsPath`, ignoring all other workspace folders
2. **Deprecated API Usage**: Uses deprecated `vscode.workspace.rootPath` in multiple services
3. **Global Task Tree**: All tasks are displayed in a flat hierarchy regardless of repository context
4. **Configuration Inflexibility**: No support for workspace-level configuration precedence
5. **Limited Scalability**: Cannot handle enterprise development scenarios with multiple repositories

### Impact Analysis

- **Developer Experience**: Poor UX for teams using multi-root workspaces
- **Adoption Barriers**: Cannot be used effectively in modern development workflows
- **Competitive Disadvantage**: Other task management extensions support multi-root workspaces
- **Technical Debt**: Using deprecated APIs that may be removed in future VS Code versions

## Solution Overview

Implement a comprehensive workspace detection and management system that:

1. **Automatically detects** single-folder vs multi-root workspace scenarios
2. **Provides repository-level grouping** in the task tree for multi-root workspaces
3. **Implements configuration hierarchy** with workspace-level precedence
4. **Maintains backward compatibility** for existing single-folder users
5. **Supports dynamic workspace changes** (folder addition/removal)

## Technical Requirements

### 1. Workspace Detection Service

**Requirement ID:** WS-001
**Priority:** High

Create a new `WorkspaceDetectionService` that can:

- Detect workspace type (single-folder vs multi-root) on extension activation
- Monitor workspace changes using `vscode.workspace.onDidChangeWorkspaceFolders`
- Provide workspace context to other services
- Handle edge cases (empty workspaces, virtual workspaces)

**Implementation Details:**

```typescript
interface WorkspaceContext {
  type: "single-folder" | "multi-root" | "empty";
  folders: WorkspaceFolderInfo[];
  workspaceFile?: string; // Path to .code-workspace file
}

interface WorkspaceFolderInfo {
  uri: vscode.Uri;
  name: string;
  index: number;
  hasTaskMaster: boolean;
  taskMasterPath?: string;
}
```

**Acceptance Criteria:**

- [ ] Correctly identifies single-folder workspaces
- [ ] Correctly identifies multi-root workspaces
- [ ] Handles workspace folder addition/removal dynamically
- [ ] Provides real-time workspace context updates
- [ ] Handles edge cases gracefully

### 2. Configuration Hierarchy Service

**Requirement ID:** WS-002
**Priority:** High

Implement a configuration resolution system with clear precedence:

1. **Workspace-level config** (`.code-workspace` directory or workspace root)
2. **Repository-level config** (individual folder `.taskmaster` directories)
3. **Extension defaults**

**Implementation Details:**

```typescript
interface ConfigurationResolver {
  resolveConfig(folder?: vscode.WorkspaceFolder): TaskMasterConfig;
  getWorkspaceConfig(): TaskMasterConfig | null;
  getRepositoryConfig(folder: vscode.WorkspaceFolder): TaskMasterConfig | null;
  watchConfigChanges(): void;
}
```

**Acceptance Criteria:**

- [ ] Workspace-level config overrides repository-level config
- [ ] Repository-level config overrides extension defaults
- [ ] Configuration changes are detected and applied dynamically
- [ ] Clear error messages for invalid configurations
- [ ] Backward compatibility with existing single-folder setups

### 3. Repository-Aware Task Tree Provider

**Requirement ID:** WS-003
**Priority:** High

Refactor `TaskTreeProvider` to support repository-level grouping:

**For Multi-Root Workspaces:**

```
📁 Repository: frontend (src/frontend)
  🎯 Current: Task #5 - Build Login Component
  ⏭️ Next: Task #7 - Implement Authentication
  📋 All Tasks (12)
    ✅ Task #1 - Setup Project Structure
    🔄 Task #5 - Build Login Component
    ⏳ Task #7 - Implement Authentication
    ...

📁 Repository: backend (src/backend)
  🎯 Current: Task #3 - Database Schema
  ⏭️ Next: Task #8 - API Endpoints
  📋 All Tasks (8)
    ✅ Task #1 - Setup Express Server
    🔄 Task #3 - Database Schema
    ⏳ Task #8 - API Endpoints
    ...
```

**For Single-Folder Workspaces:**

```
🎯 Current: Task #5 - Build Login Component
⏭️ Next: Task #7 - Implement Authentication
📋 All Tasks (12)
  ✅ Task #1 - Setup Project Structure
  🔄 Task #5 - Build Login Component
  ⏳ Task #7 - Implement Authentication
  ...
```

**Implementation Details:**

```typescript
class RepositoryTreeItem extends vscode.TreeItem {
  constructor(
    public readonly folder: vscode.WorkspaceFolder,
    public readonly taskContext: TaskContext
  );
}

class TaskContext {
  repository: vscode.WorkspaceFolder;
  tasks: Task[];
  currentTask?: Task;
  nextTask?: Task;
  config: TaskMasterConfig;
}
```

**Acceptance Criteria:**

- [ ] Repository nodes appear only in multi-root workspaces
- [ ] Each repository shows its own Current/Next/All Tasks
- [ ] Tasks are correctly filtered by repository
- [ ] Tree maintains collapse/expand state
- [ ] Performance remains acceptable with many repositories

### 4. Service Layer Refactoring

**Requirement ID:** WS-004
**Priority:** High

Update all services to work with multiple workspace folders:

**Files Requiring Updates:**

- `TagService.ts` - Remove hardcoded `workspaceFolders[0]` usage
- `CLIService.ts` - Support per-repository CLI execution
- `TaskCacheService.ts` - Handle multiple task file locations
- `TaskOperationsService.ts` - Repository-aware operations
- `ConfigService.ts` - Remove deprecated `workspace.rootPath`
- `FileWatcherService.ts` - Watch files in all workspace folders

**Implementation Pattern:**

```typescript
// Before (single-folder only)
const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

// After (multi-folder aware)
const workspaceFolders = vscode.workspace.workspaceFolders || [];
for (const folder of workspaceFolders) {
  const taskMasterPath = path.join(folder.uri.fsPath, ".taskmaster");
  // Process each folder...
}
```

**Acceptance Criteria:**

- [ ] All services handle multiple workspace folders
- [ ] No usage of deprecated `workspace.rootPath`
- [ ] No hardcoded `workspaceFolders[0]` access
- [ ] Proper error handling for folders without .taskmaster
- [ ] Consistent API across all services

### 5. Command System Enhancement

**Requirement ID:** WS-005
**Priority:** Medium

Update command system to work with repository context:

**New Commands:**

- `taskMaster.selectRepository` - Choose which repository to operate on
- `taskMaster.refreshRepository` - Refresh tasks for specific repository
- `taskMaster.openRepositorySettings` - Open repo-specific settings

**Enhanced Commands:**

- All existing commands work with repository context
- Commands executed from tree items use the repository context
- Global commands prompt for repository selection in multi-root scenarios

**Acceptance Criteria:**

- [ ] Commands respect repository context
- [ ] Clear repository selection in multi-root workspaces
- [ ] Commands work identically in single-folder workspaces
- [ ] Proper error messages for repository-specific operations

### 6. File Watching & Caching

**Requirement ID:** WS-006
**Priority:** Medium

Extend file watching to monitor all workspace folders:

```typescript
class WorkspaceFileWatcher {
  private watchers: Map<string, vscode.FileSystemWatcher> = new Map();

  setupWatchers(folders: vscode.WorkspaceFolder[]): void;
  addFolderWatcher(folder: vscode.WorkspaceFolder): void;
  removeFolderWatcher(folder: vscode.WorkspaceFolder): void;
  dispose(): void;
}
```

**Acceptance Criteria:**

- [ ] File watchers created for all workspace folders
- [ ] Dynamic watcher management for folder changes
- [ ] Proper cleanup on extension deactivation
- [ ] Performance optimization for many folders

## Implementation Plan

### Phase 1: Foundation (Weeks 1-2)

1. Create `WorkspaceDetectionService`
2. Implement configuration hierarchy resolution
3. Update deprecated API usage
4. Add comprehensive unit tests

### Phase 2: Core Functionality (Weeks 3-4)

1. Refactor `TaskTreeProvider` for repository grouping
2. Update all services for multi-folder support
3. Implement dynamic workspace change handling
4. Integration testing

### Phase 3: Enhancement & Polish (Weeks 5-6)

1. Enhance command system with repository context
2. Implement file watching improvements
3. Performance optimization
4. User experience refinements

### Phase 4: Testing & Documentation (Week 7)

1. Comprehensive testing across scenarios
2. Update documentation and screenshots
3. Migration guide for existing users
4. Release preparation

## Testing Strategy

### Unit Tests

- Workspace detection logic
- Configuration resolution precedence
- Service layer repository handling
- Tree provider hierarchy generation

### Integration Tests

- Single-folder to multi-root migration
- Dynamic workspace folder changes
- Configuration override scenarios
- Cross-repository operations

### Manual Testing Scenarios

1. **Single-folder workspace** - Verify no regression
2. **Multi-root workspace with workspace config** - Verify shared configuration
3. **Multi-root workspace with per-repo configs** - Verify individual configs
4. **Mixed configuration scenario** - Verify precedence rules
5. **Dynamic folder management** - Add/remove folders during runtime
6. **Performance with many repositories** - Test with 10+ folders

## Success Metrics

### Functional Metrics

- [ ] 100% backward compatibility with single-folder workspaces
- [ ] Support for 10+ repositories in multi-root workspaces
- [ ] Sub-second response time for tree refresh operations
- [ ] Zero deprecated API usage

### User Experience Metrics

- [ ] Clear visual distinction between repository contexts
- [ ] Intuitive repository selection workflows
- [ ] Consistent behavior across workspace types
- [ ] Comprehensive error messaging

## Risk Assessment

### High Risk

- **Breaking Changes**: Potential regression in single-folder scenarios
- **Performance**: Tree rendering performance with many repositories
- **Migration**: User confusion during transition

### Mitigation Strategies

- Extensive regression testing
- Performance benchmarking
- Clear migration documentation
- Feature flags for gradual rollout

## Dependencies

### Internal Dependencies

- Task Master CLI compatibility
- Existing task data format
- Current configuration schema

### External Dependencies

- VS Code API stability
- Node.js file system operations
- TypeScript compilation targets

## Future Considerations

### Potential Enhancements

- Repository-level task filtering
- Cross-repository task dependencies
- Workspace-level task aggregation views
- Integration with VS Code workspace trust

### Scalability Considerations

- Large monorepo support
- Performance with 50+ repositories
- Memory usage optimization
- Lazy loading strategies

---

## Appendix

### Current Architecture Gaps

**Files with single-folder assumptions:**

- `src/services/tagService.ts:29` - `workspaceFolders?.[0]?.uri.fsPath`
- `src/services/cliService.ts:88` - `workspaceFolders?.[0]?.uri.fsPath`
- `src/services/taskCacheService.ts:59` - `workspaceFolders?.[0]?.uri.fsPath`
- `src/services/taskOperationsService.ts:158` - `workspaceFolders?.[0]?.uri.fsPath`
- `src/utils/fileUtils.ts:17` - `workspaceFolders?.[0]?.uri.fsPath`
- `src/services/configService.ts:75` - `vscode.workspace.rootPath` (deprecated)
- `src/services/cliService.ts:285,462,542` - `vscode.workspace.rootPath` (deprecated)

### Reference Implementation

Task #21 in the existing task list provides the foundational requirements that this PRD builds upon and expands with comprehensive technical specifications.
