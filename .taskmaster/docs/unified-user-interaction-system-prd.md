# Technical PRD: Unified User Interaction System for Task Master VSCode Extension

## Executive Summary

The Task Master VSCode extension currently suffers from inconsistent and fragmented user interaction patterns across alerts, loading indicators, dialogs, and user flows. This PRD outlines the design and implementation of a unified utility system to standardize all user interactions, providing consistent UX and maintainable code architecture.

## Current State Analysis

### Existing Patterns Identified

#### 1. **Alert/Notification Systems**

**Current Implementation:**

- 47+ instances of `vscode.window.showInformationMessage()`
- 26+ instances of `vscode.window.showErrorMessage()`
- 25+ instances of `vscode.window.showWarningMessage()`

**Warning Message Usage Patterns:**

- **Validation warnings**: "No task ID provided", "No subtask selected" (12+ instances)
- **Confirmation dialogs**: Modal warnings for destructive actions (8+ instances)
- **System warnings**: "CLI not available", "No tags available" (5+ instances)

**Issues:**

- Inconsistent message formatting and styling
- No centralized error categorization
- Manual string building scattered across files
- No standard success/error/warning patterns
- No action button standardization
- Mixed usage of warnings for both notifications and confirmations
- Inconsistent modal vs non-modal warning patterns

#### 2. **Loading Indicators**

**Current Implementation:**

- 2 instances of `vscode.window.withProgress()` (in `taskManagerService.ts` and `taskCommands.ts`)
- Manual timeout handling with `setTimeout`/`clearTimeout` in `cliService.ts`
- Status bar updates for different states

**Issues:**

- Inconsistent progress reporting
- No standardized long-running operation handling
- No cancellation support
- Mixed progress indication methods (status bar vs notifications)

#### 3. **Interactive Dialogs**

**Current Implementation:**

- 15+ instances of `vscode.window.showQuickPick()`
- 10+ instances of `vscode.window.showInputBox()`
- 5 instances of modal dialogs (`{ modal: true }`)

**Issues:**

- Repetitive prompt creation logic
- Inconsistent validation patterns
- No standardized multi-step workflows
- Manual cancellation handling

#### 4. **Error Handling**

**Current Implementation:**

- 40+ try-catch blocks across the codebase
- Manual error message construction
- Inconsistent error logging
- No error categorization or recovery flows

**Issues:**

- No centralized error handling strategy
- Inconsistent user-facing error messages
- No automated error reporting or analytics
- Mixed error handling patterns

### Current File Distribution

- **Commands**: `taskCommands.ts`, `tagCommands.ts`, `dependencyCommands.ts`
- **Services**: `taskManagerService.ts`, `cliService.ts`, `statusBarService.ts`
- **Main**: `extension.ts`
- **Utilities**: `outputParser.ts` (for CLI result parsing)

## Problem Statement

The current fragmented approach to user interactions leads to:

1. **Poor User Experience**: Inconsistent messaging, formatting, and interaction patterns
2. **Development Inefficiency**: Repetitive code for common interaction patterns
3. **Maintenance Burden**: Updates to interaction styles require changes across 15+ files
4. **Testing Challenges**: No standardized way to test user interaction flows
5. **Accessibility Issues**: No consistent support for screen readers or keyboard navigation

## Solution Architecture

### Core Components

#### 1. **InteractionManager** (Central Orchestrator)

```typescript
interface InteractionManager {
  // Notifications
  notify: NotificationService;

  // Dialogs & Input
  dialog: DialogService;

  // Progress & Loading
  progress: ProgressService;

  // Error Handling
  error: ErrorService;

  // Workflows
  workflow: WorkflowService;
}
```

#### 2. **NotificationService** (Standardized Alerts)

```typescript
interface NotificationService {
  success(
    message: string,
    actions?: NotificationAction[]
  ): Promise<string | undefined>;
  warning(
    message: string,
    actions?: NotificationAction[]
  ): Promise<string | undefined>;
  error(
    message: string,
    actions?: NotificationAction[]
  ): Promise<string | undefined>;
  info(
    message: string,
    actions?: NotificationAction[]
  ): Promise<string | undefined>;

  // Specialized warning types identified in current codebase
  validationWarning(message: string): Promise<void>; // "No task ID provided"
  systemWarning(
    message: string,
    actions?: NotificationAction[]
  ): Promise<string | undefined>; // "CLI not available"

  // Task-specific notifications
  taskSuccess(taskId: number, operation: string): Promise<void>;
  taskError(taskId: number, operation: string, error: Error): Promise<void>;
  taskValidationError(context: string): Promise<void>; // Standardized validation messages
}
```

#### 3. **ProgressService** (Loading & Long Operations)

```typescript
interface ProgressService {
  withProgress<T>(
    config: ProgressConfig,
    operation: (progress: ProgressReporter) => Promise<T>
  ): Promise<T>;

  showIndeterminate(title: string, cancellable?: boolean): ProgressHandle;
  showDeterminate(title: string, total: number): ProgressHandle;

  // CLI-specific progress patterns
  withCLIProgress<T>(
    command: string,
    operation: () => Promise<T>,
    config?: CLIProgressConfig
  ): Promise<T>;
}
```

#### 4. **DialogService** (Input & Confirmation)

```typescript
interface DialogService {
  // Quick Picks
  quickPick<T>(
    items: QuickPickItem<T>[],
    config?: QuickPickConfig
  ): Promise<T | undefined>;

  // Input Boxes
  input(config: InputConfig): Promise<string | undefined>;
  multiInput(
    configs: InputConfig[]
  ): Promise<Record<string, string> | undefined>;

  // Confirmations
  confirm(message: string, options?: ConfirmOptions): Promise<boolean>;
  confirmDangerous(message: string, confirmText?: string): Promise<boolean>;

  // Warning-based confirmations (identified pattern in current codebase)
  confirmWarning(
    message: string,
    options?: { modal?: boolean }
  ): Promise<boolean>;

  // Task-specific dialogs
  taskSelector(
    tasks: Task[],
    config?: TaskSelectorConfig
  ): Promise<Task | undefined>;
  prioritySelector(): Promise<Priority | undefined>;
  statusSelector(currentStatus?: TaskStatus): Promise<TaskStatus | undefined>;
}
```

#### 5. **ErrorService** (Centralized Error Handling)

```typescript
interface ErrorService {
  handle(error: Error, context?: ErrorContext): Promise<void>;
  handleCLIError(error: CLIError, command: string): Promise<void>;

  // Error categorization
  categorize(error: Error): ErrorCategory;

  // User-friendly error messages
  formatUserMessage(error: Error): string;

  // Recovery suggestions
  getSuggestions(error: Error): ErrorSuggestion[];
}
```

#### 6. **WorkflowService** (Multi-Step Flows)

```typescript
interface WorkflowService {
  create(config: WorkflowConfig): WorkflowBuilder;

  // Pre-built workflows
  addTaskWorkflow(): Promise<AddTaskResult | undefined>;
  expandTaskWorkflow(taskId: number): Promise<ExpandTaskResult | undefined>;
  dependencyWorkflow(
    type: "add" | "remove"
  ): Promise<DependencyResult | undefined>;
}
```

## Detailed Design

### File Structure

```
src/
├── interactions/
│   ├── InteractionManager.ts         # Main entry point
│   ├── services/
│   │   ├── NotificationService.ts    # Alert management
│   │   ├── ProgressService.ts        # Loading indicators
│   │   ├── DialogService.ts          # Input dialogs
│   │   ├── ErrorService.ts           # Error handling
│   │   └── WorkflowService.ts        # Multi-step flows
│   ├── types/
│   │   ├── NotificationTypes.ts      # Notification interfaces
│   │   ├── ProgressTypes.ts          # Progress interfaces
│   │   ├── DialogTypes.ts            # Dialog interfaces
│   │   ├── ErrorTypes.ts             # Error interfaces
│   │   └── WorkflowTypes.ts          # Workflow interfaces
│   ├── builders/
│   │   ├── WorkflowBuilder.ts        # Fluent workflow API
│   │   └── DialogBuilder.ts          # Complex dialog builder
│   └── utils/
│       ├── MessageFormatter.ts       # Message standardization
│       ├── IconProvider.ts           # Consistent iconography
│       └── ThemeProvider.ts          # Theme-aware styling
```

### Key Features

#### 1. **Consistent Theming & Iconography**

- Standardized icon usage across all interactions
- Theme-aware color schemes for success/warning/error states
- Consistent typography and spacing

#### 2. **Smart CLI Integration**

- Automatic progress indication for CLI operations
- CLI timeout handling with user feedback
- CLI error parsing and user-friendly message conversion

#### 3. **Task-Aware Interactions**

- Pre-built dialogs for common task operations
- Contextual suggestions based on task state
- Dependency-aware confirmations

#### 4. **Accessibility & Keyboard Navigation**

- Screen reader compatible messaging
- Keyboard shortcuts for common actions
- Focus management in multi-step workflows

#### 5. **Testing Infrastructure**

- Mock interaction providers for unit tests
- Interaction recording for integration tests
- Visual regression testing for dialog layouts

### Implementation Phases

#### Phase 1: Foundation (Week 1-2)

- [ ] Create base `InteractionManager` and service interfaces
- [ ] Implement `NotificationService` with current message patterns
- [ ] Migrate 10 most common notification use cases
- [ ] Basic error categorization in `ErrorService`

#### Phase 2: Progress & Dialogs (Week 3-4)

- [ ] Implement `ProgressService` with CLI integration
- [ ] Migrate `withProgress` usage in `taskManagerService` and `taskCommands`
- [ ] Implement `DialogService` with basic input/quickpick patterns
- [ ] Migrate task addition and expansion dialogs

#### Phase 3: Workflows & Error Handling (Week 5-6)

- [ ] Implement `WorkflowService` with fluent API
- [ ] Create pre-built workflows for common operations
- [ ] Complete `ErrorService` with recovery suggestions
- [ ] Migrate all try-catch blocks to use centralized error handling

#### Phase 4: Polish & Testing (Week 7-8)

- [ ] Theme integration and visual consistency
- [ ] Accessibility improvements
- [ ] Comprehensive testing infrastructure
- [ ] Documentation and examples

## Success Metrics

### User Experience

- **Consistency**: 100% of user interactions follow unified patterns
- **Response Time**: Progress indication for all operations >2 seconds
- **Error Recovery**: 90% of errors provide actionable recovery steps

### Developer Experience

- **Code Reduction**: 60% reduction in interaction-related boilerplate
- **Maintenance**: Single source of truth for interaction styling
- **Testing**: 100% test coverage for interaction flows

### Performance

- **Load Time**: No impact on extension activation time
- **Memory**: <5MB additional memory usage
- **Responsiveness**: All interactions complete within 500ms (excluding CLI operations)

## Implementation Details

### Service Integration Pattern

```typescript
// Before (scattered across files)
vscode.window.showInformationMessage("Task created successfully");
vscode.window.showErrorMessage(`Failed to add task: ${error}`);
vscode.window.showWarningMessage("No task ID provided");
const confirm = await vscode.window.showWarningMessage(
  "Are you sure you want to delete this task?",
  { modal: true },
  "Yes",
  "No"
);

// After (unified pattern)
const interaction = InteractionManager.getInstance();
await interaction.notify.taskSuccess(taskId, "created");
await interaction.error.handle(error, { context: "task_creation", taskId });
await interaction.notify.validationWarning("task_id_required");
const confirmed = await interaction.dialog.confirmWarning(
  "Are you sure you want to delete this task?",
  { modal: true }
);
```

### Warning Message Pattern Analysis

**Current Inconsistent Patterns:**

```typescript
// Pattern 1: Simple validation warnings (12+ instances)
vscode.window.showWarningMessage("No task ID provided");
vscode.window.showWarningMessage("No subtask selected");

// Pattern 2: Modal confirmation warnings (8+ instances)
const confirm = await vscode.window.showWarningMessage(
  "This will delete the task. Continue?",
  { modal: true },
  "Yes",
  "No"
);

// Pattern 3: System state warnings (5+ instances)
vscode.window.showWarningMessage("Task Master CLI is not available");
vscode.window.showWarningMessage("No tags available");
```

**Unified Patterns:**

```typescript
// Validation warnings → standardized messages
await interaction.notify.validationWarning("task_id_required");
await interaction.notify.validationWarning("subtask_selection_required");

// Modal confirmations → dedicated confirmation service
const confirmed = await interaction.dialog.confirmWarning(
  "delete_task_confirmation"
);

// System warnings → contextual system notifications
await interaction.notify.systemWarning("cli_unavailable", [
  "Install CLI",
  "Learn More",
]);
```

### Workflow Example

```typescript
// Complex multi-step flow made simple
const result = await interaction.workflow
  .create("add_task")
  .step("prompt", {
    title: "Task Description",
    placeholder: "Describe what needs to be done...",
  })
  .step("priority", {
    type: "quickpick",
    items: priorities,
  })
  .step("dependencies", {
    type: "multi_select",
    items: availableTasks,
    optional: true,
  })
  .onCancel(() => interaction.notify.info("Task creation cancelled"))
  .execute();
```

## Risk Assessment

### Technical Risks

- **Migration Complexity**: Large refactoring across many files
  - _Mitigation_: Gradual migration with backward compatibility
- **Performance Impact**: Additional abstraction layers
  - _Mitigation_: Lazy loading and efficient caching

### User Experience Risks

- **Breaking Changes**: Users accustomed to current patterns
  - _Mitigation_: Visual consistency with improved functionality
- **Learning Curve**: New patterns for contributors
  - _Mitigation_: Comprehensive documentation and examples

## Conclusion

The unified user interaction system will transform the Task Master extension from a collection of inconsistent interaction patterns into a polished, professional tool with exceptional user experience. The investment in this infrastructure will pay dividends in reduced maintenance overhead, improved user satisfaction, and accelerated feature development.

The phased approach ensures minimal disruption while providing immediate benefits as each phase completes. The system's extensible design will support future interaction requirements and maintain consistency as the extension evolves.
