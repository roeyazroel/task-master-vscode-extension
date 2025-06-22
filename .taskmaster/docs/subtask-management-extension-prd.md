# Technical Product Requirements Document (PRD)

## Task Master VS Code Extension: Complete Subtask Management Support

### Document Information

- **Version**: 1.0
- **Created**: 2024-12-19
- **Status**: Draft
- **Priority**: High

---

## Executive Summary

The Task Master VS Code extension currently supports basic subtask operations (update, change status, remove) but lacks support for several key subtask management commands available in the task-master CLI. This PRD outlines the requirements for extending the extension to provide complete subtask management capabilities, including adding subtasks, clearing subtasks, converting tasks to subtasks, and moving subtasks.

---

## Problem Statement

### Current State Analysis

**✅ Currently Implemented Subtask Features:**

1. **Update Subtask** (`update-subtask`) - Append timestamped information to subtasks
2. **Change Subtask Status** (`set-status`) - Change subtask status (pending, done, etc.)
3. **Remove Subtask** (`remove-subtask`) - Remove individual subtasks
4. **Subtask Display** - Tree view with proper hierarchical display and context menus

**❌ Missing Subtask Features:**

1. **Add Subtask** (`add-subtask`) - Create new subtasks manually
2. **Convert Task to Subtask** (`add-subtask --task-id`) - Convert existing tasks into subtasks
3. **Clear Subtasks** (`clear-subtasks`) - Remove all subtasks from a task
4. **Move Subtasks** (`move`) - Reorganize subtask positioning
5. **Subtask Dependencies** - Add/remove dependencies for subtasks
6. **Convert Subtask to Task** (`remove-subtask --convert`) - Promote subtasks to standalone tasks

### Pain Points

- Users must switch between VS Code and terminal for complete subtask management
- Inconsistent UX - some subtask operations available in extension, others only via CLI
- Missing productivity features like bulk operations and task conversion
- Limited subtask creation capabilities within the IDE

---

## Solution Overview

Extend the Task Master VS Code extension to provide complete parity with task-master CLI subtask management capabilities through:

1. **New Command Implementations** - Add missing subtask management commands
2. **Enhanced Context Menus** - Expand subtask and task context menus with new options
3. **Improved User Flows** - Create intuitive workflows for subtask creation and management
4. **Command Palette Integration** - Expose all subtask commands through VS Code command palette
5. **Robust Error Handling** - Comprehensive validation and user feedback

---

## Detailed Requirements

### 1. Add Subtask Command (`add-subtask`)

**Functional Requirements:**

- **FR-1.1**: Support creating new subtasks with title, description, and optional dependencies
- **FR-1.2**: Support converting existing tasks into subtasks of another task
- **FR-1.3**: Validate parent task exists and is not itself a subtask
- **FR-1.4**: Auto-refresh tree view after subtask creation
- **FR-1.5**: Provide feedback on successful/failed subtask creation

**User Interface Requirements:**

- **UI-1.1**: Add "Add Subtask" to task context menu
- **UI-1.2**: Create multi-step input workflow for new subtask creation:
  - Step 1: Subtask title (required)
  - Step 2: Subtask description (optional)
  - Step 3: Dependencies selection (optional, multi-select from existing tasks/subtasks)
- **UI-1.3**: Add "Convert to Subtask" to task context menu
- **UI-1.4**: Create parent task selection dialog for task conversion

**Technical Requirements:**

- **TR-1.1**: Implement `addSubtask()` method in `TaskOperationsService`
- **TR-1.2**: Add command registration in `package.json`
- **TR-1.3**: Create command handler in `extension.ts`
- **TR-1.4**: Support both manual creation and task conversion modes
- **TR-1.5**: Integrate with existing CLI service for `add-subtask` command execution

### 2. Clear Subtasks Command (`clear-subtasks`)

**Functional Requirements:**

- **FR-2.1**: Remove all subtasks from a selected parent task
- **FR-2.2**: Support clearing subtasks from multiple tasks simultaneously
- **FR-2.3**: Provide confirmation dialog before bulk removal
- **FR-2.4**: Show count of subtasks to be removed in confirmation

**User Interface Requirements:**

- **UI-2.1**: Add "Clear All Subtasks" to task context menu (only for tasks with subtasks)
- **UI-2.2**: Add command to command palette for bulk operations
- **UI-2.3**: Create confirmation dialog with subtask count and impact summary
- **UI-2.4**: Support multi-select for clearing subtasks from multiple tasks

**Technical Requirements:**

- **TR-2.1**: Implement `clearSubtasks()` method in `TaskOperationsService`
- **TR-2.2**: Add support for single task and bulk operations
- **TR-2.3**: Integrate with CLI `clear-subtasks` command
- **TR-2.4**: Handle both `--id=<taskId>` and `--all` modes

### 3. Enhanced Subtask Removal (`remove-subtask --convert`)

**Functional Requirements:**

- **FR-3.1**: Extend existing remove subtask functionality to support conversion to standalone task
- **FR-3.2**: Provide user choice between deletion and conversion
- **FR-3.3**: Preserve subtask data when converting to task
- **FR-3.4**: Handle dependency relationships during conversion

**User Interface Requirements:**

- **UI-3.1**: Modify existing "Remove Subtask" context menu to show options:
  - "Delete Subtask"
  - "Convert to Standalone Task"
- **UI-3.2**: Add confirmation dialog explaining the difference between options
- **UI-3.3**: Show preview of where converted task will be placed

**Technical Requirements:**

- **TR-3.1**: Enhance existing `removeSubtask()` method to support conversion mode
- **TR-3.2**: Add `--convert` flag support to CLI integration
- **TR-3.3**: Update command registration and handling

### 4. Subtask Movement and Reorganization (`move`)

**Functional Requirements:**

- **FR-4.1**: Support moving subtasks between different parent tasks
- **FR-4.2**: Support reordering subtasks within the same parent
- **FR-4.3**: Support moving subtasks to become standalone tasks
- **FR-4.4**: Validate move operations to prevent circular dependencies

**User Interface Requirements:**

- **UI-4.1**: Add "Move Subtask" to subtask context menu
- **UI-4.2**: Create destination selection dialog:
  - Select target parent task
  - Option to convert to standalone task
  - Preview of new position
- **UI-4.3**: Support drag-and-drop for subtask reordering (future enhancement)

**Technical Requirements:**

- **TR-4.1**: Implement `moveSubtask()` method in `TaskOperationsService`
- **TR-4.2**: Integrate with CLI `move` command
- **TR-4.3**: Handle different move scenarios (between parents, to standalone, reordering)
- **TR-4.4**: Validate moves to prevent invalid operations

### 5. Subtask Dependency Management

**Functional Requirements:**

- **FR-5.1**: Support adding dependencies to subtasks
- **FR-5.2**: Support removing dependencies from subtasks
- **FR-5.3**: Validate dependency relationships (no circular dependencies)
- **FR-5.4**: Display dependency information in subtask tooltips

**User Interface Requirements:**

- **UI-5.1**: Add "Manage Dependencies" submenu to subtask context menu:
  - "Add Dependency"
  - "Remove Dependency"
- **UI-5.2**: Create dependency selection dialogs
- **UI-5.3**: Enhance subtask display to show dependency indicators
- **UI-5.4**: Update tooltips to include dependency information

**Technical Requirements:**

- **TR-5.1**: Extend existing dependency management to support subtasks
- **TR-5.2**: Update `TaskTreeProvider` to display subtask dependencies
- **TR-5.3**: Integrate with CLI dependency commands for subtasks

### 6. Command Palette Integration

**Functional Requirements:**

- **FR-6.1**: Expose all subtask commands through VS Code command palette
- **FR-6.2**: Provide intelligent context awareness for command availability
- **FR-6.3**: Support global operations (not requiring specific selection)

**User Interface Requirements:**

- **UI-6.1**: Add all new commands to command palette with descriptive names
- **UI-6.2**: Group subtask commands logically in palette
- **UI-6.3**: Provide task/subtask selection when commands are invoked globally

### 7. Enhanced Error Handling and Validation

**Functional Requirements:**

- **FR-7.1**: Validate all subtask operations before execution
- **FR-7.2**: Provide clear error messages for failed operations
- **FR-7.3**: Handle CLI command failures gracefully
- **FR-7.4**: Validate workspace trust for all subtask operations

**Technical Requirements:**

- **TR-7.1**: Implement comprehensive input validation
- **TR-7.2**: Add error handling patterns consistent with existing code
- **TR-7.3**: Create user-friendly error messages
- **TR-7.4**: Add logging for debugging subtask operations

---

## Implementation Strategy

### Phase 1: Core Subtask Creation (Week 1-2)

1. Implement `add-subtask` command for manual subtask creation
2. Add basic UI flows for subtask creation
3. Update context menus and command registration
4. Basic testing and validation

### Phase 2: Subtask Conversion and Management (Week 3-4)

1. Implement task-to-subtask conversion
2. Add clear subtasks functionality
3. Enhance remove subtask with conversion option
4. Extended testing

### Phase 3: Advanced Features (Week 5-6)

1. Implement subtask movement and reorganization
2. Add subtask dependency management
3. Command palette integration
4. Comprehensive testing and bug fixes

### Phase 4: Polish and Documentation (Week 7)

1. Error handling improvements
2. UI/UX refinements
3. Documentation updates
4. Final testing and release preparation

---

## Technical Architecture

### New Files to Create

```
src/commands/subtaskCommands.ts       // Dedicated subtask command handlers
src/utils/subtaskUtils.ts             // Subtask-specific utility functions
src/types/subtaskTypes.ts             // Additional subtask-related types
```

### Files to Modify

```
src/extension.ts                      // New command registrations
src/services/taskOperationsService.ts // New subtask methods
src/providers/taskTreeProvider.ts     // Enhanced context menus
package.json                          // New command definitions and menus
src/types.ts                         // Extended type definitions
```

### Command Registration Structure

```json
{
  "commands": [
    {
      "command": "taskMaster.addSubtask",
      "title": "Task Master: Add Subtask",
      "icon": "$(add)"
    },
    {
      "command": "taskMaster.addSubtaskFromTask",
      "title": "Task Master: Convert to Subtask"
    },
    {
      "command": "taskMaster.clearSubtasks",
      "title": "Task Master: Clear All Subtasks"
    },
    {
      "command": "taskMaster.moveSubtask",
      "title": "Task Master: Move Subtask"
    },
    {
      "command": "taskMaster.convertSubtaskToTask",
      "title": "Task Master: Convert to Standalone Task"
    },
    {
      "command": "taskMaster.addSubtaskDependency",
      "title": "Task Master: Add Subtask Dependency"
    },
    {
      "command": "taskMaster.removeSubtaskDependency",
      "title": "Task Master: Remove Subtask Dependency"
    }
  ]
}
```

### Context Menu Structure

```json
{
  "view/item/context": [
    {
      "command": "taskMaster.addSubtask",
      "when": "view == taskMaster.taskView && viewItem =~ /^task-/",
      "group": "subtask@1",
      "title": "Add Subtask"
    },
    {
      "command": "taskMaster.addSubtaskFromTask",
      "when": "view == taskMaster.taskView && viewItem =~ /^task-/",
      "group": "subtask@2",
      "title": "Convert to Subtask"
    },
    {
      "command": "taskMaster.clearSubtasks",
      "when": "view == taskMaster.taskView && viewItem =~ /^task-/ && viewItem =~ /with-subtasks/",
      "group": "subtask@3",
      "title": "Clear All Subtasks"
    },
    {
      "command": "taskMaster.moveSubtask",
      "when": "view == taskMaster.taskView && viewItem =~ /^subtask-/",
      "group": "subtask@1",
      "title": "Move Subtask"
    },
    {
      "command": "taskMaster.convertSubtaskToTask",
      "when": "view == taskMaster.taskView && viewItem =~ /^subtask-/",
      "group": "subtask@2",
      "title": "Convert to Task"
    }
  ]
}
```

---

## Testing Strategy

### Unit Tests

- Test all new command handlers
- Validate CLI command construction
- Test error handling scenarios
- Mock CLI responses for consistent testing

### Integration Tests

- Test complete workflows (create → modify → delete)
- Validate tree view updates
- Test command palette integration
- Cross-platform compatibility testing

### User Acceptance Tests

- Manual testing of all user flows
- Performance testing with large task lists
- Accessibility testing
- Edge case validation

---

## Success Criteria

### Functional Success Criteria

1. ✅ All task-master CLI subtask commands available in VS Code extension
2. ✅ Consistent user experience across all subtask operations
3. ✅ No data loss during subtask operations
4. ✅ Proper error handling and user feedback
5. ✅ Integration with existing task management workflows

### Technical Success Criteria

1. ✅ Code follows existing extension patterns and standards
2. ✅ Performance impact minimal (< 100ms for common operations)
3. ✅ Comprehensive test coverage (>80%)
4. ✅ No regressions in existing functionality
5. ✅ Cross-platform compatibility (Windows, macOS, Linux)

### User Experience Success Criteria

1. ✅ Intuitive command discovery through context menus
2. ✅ Clear visual feedback for all operations
3. ✅ Consistent with VS Code UI/UX patterns
4. ✅ Efficient workflows for common subtask operations
5. ✅ Comprehensive help and documentation

---

## Risk Assessment

### High Risk

- **CLI Command Compatibility**: Changes in task-master CLI could break integration
  - _Mitigation_: Version checking and graceful degradation
- **Data Integrity**: Subtask operations could corrupt task data
  - _Mitigation_: Comprehensive validation and atomic operations

### Medium Risk

- **Performance Impact**: Large task lists could slow down operations
  - _Mitigation_: Optimize CLI calls and implement caching
- **User Experience Complexity**: Too many options could overwhelm users
  - _Mitigation_: Progressive disclosure and intelligent defaults

### Low Risk

- **Cross-Platform Issues**: Different behavior on different operating systems
  - _Mitigation_: Comprehensive testing across platforms

---

## Dependencies

### External Dependencies

- Task Master CLI version >= 1.0.0
- VS Code API compatibility
- Node.js runtime environment

### Internal Dependencies

- Existing TaskOperationsService
- CLI service integration
- Tree view provider
- Command registration system

---

## Future Enhancements

### Post-MVP Features

1. **Drag and Drop Support**: Visual subtask reordering
2. **Bulk Operations**: Multi-select subtask operations
3. **Subtask Templates**: Predefined subtask sets for common patterns
4. **Advanced Filtering**: Filter tree view by subtask properties
5. **Subtask Statistics**: Dashboard showing subtask completion metrics
6. **Keyboard Shortcuts**: Hotkeys for common subtask operations

### Integration Opportunities

1. **GitHub Integration**: Link subtasks to GitHub issues/PRs
2. **Time Tracking**: Track time spent on individual subtasks
3. **Export/Import**: Backup and restore subtask configurations
4. **Team Collaboration**: Share subtask assignments and progress

---

## Conclusion

This PRD outlines a comprehensive approach to extending the Task Master VS Code extension with complete subtask management capabilities. The implementation will provide users with a seamless, integrated experience for managing subtasks without leaving their development environment, significantly improving productivity and workflow efficiency.

The phased approach ensures manageable development cycles while delivering incremental value. The focus on consistency with existing patterns and robust error handling will maintain the high quality standards of the current extension while expanding its capabilities to match the full power of the task-master CLI.
