# Task Master VS Code Extension

A powerful VS Code extension that provides seamless integration with [Claude Task Master](https://github.com/eyaltoledano/claude-task-master.git), an AI-powered task management system. This extension brings task management directly into your development environment with rich tree views, status bar integration, and comprehensive task operations.

## Overview

The Task Master VS Code Extension wraps the Claude Task Master CLI to provide:

- **Interactive Task Tree View** - Visualize tasks and subtasks in VS Code's sidebar
- **Status Bar Integration** - Quick access to next tasks and progress tracking
- **Tag Management** - Organize tasks by context and switch between different tag views
- **Dependency Management** - Handle task dependencies with visual indicators
- **AI-Powered Operations** - Leverage AI for task expansion, complexity analysis, and updates

## Features

### 🌳 Task Tree View

- Hierarchical display of tasks and subtasks
- Status indicators with color-coded icons
- Dependency information in tooltips
- Context menus for quick actions
- Current and next task highlighting

### 📊 Status Bar Integration

- Next actionable task display
- Progress tracking with completion percentages
- Dependency status overview
- Priority breakdown
- Clickable cycling through different views

### 🏷️ Tag Management

- Multiple tag contexts for organizing tasks
- Quick tag switching via command palette
- Tag-specific task filtering
- Tag creation and deletion

### 🔗 Dependency Management

- Add and remove task dependencies
- Dependency validation and automatic fixing
- Visual dependency indicators
- Blocked task identification

### 🤖 AI-Powered Features

- Task expansion into subtasks
- Complexity analysis and recommendations
- AI-powered task updates and creation
- Research-backed task generation

### 📄 PRD Integration

- Right-click context menu for .txt files in VS Code Explorer
- "Generate Tasks from PRD" option with interactive prompts
- Configurable task quantity (1-100) and research mode
- Real-time progress tracking and error handling
- Automatic task refresh after generation

## Installation

### Prerequisites

1. **Install Claude Task Master CLI**:

   ```bash
   npm install -g task-master-ai
   ```

2. **Verify Installation**:
   ```bash
   task-master --version
   ```

### Extension Installation

1. **From VS Code Marketplace** (when published):

   - Search for "Task Master" in VS Code Extensions
   - Click Install

2. **From Github Artifact**:

   - Go for the latest release https://github.com/roeyazroel/task-master-vscode-extension/releases
   - Download the vsix, and install the file

3. **From Source**:
   ```bash
   git clone https://github.com/roeyazroel/task-master-vscode-extension.git
   cd task-master-vscode-extension
   npm install
   npm run compile
   ```

## Quick Start

1. **Initialize Task Master in your project**:

   ```bash
   task-master init
   ```

2. **Set up AI models** (optional but recommended):

   ```bash
   task-master models --setup
   ```

3. **Create a PRD file** (optional):

   - Create `.taskmaster/docs/prd.txt` with your project requirements

4. **Generate initial tasks** (choose one method):

   **Option A - CLI:**

   ```bash
   task-master parse-prd --input=.taskmaster/docs/prd.txt
   ```

   **Option B - VS Code Extension:**

   - Open VS Code and right-click your PRD `.txt` file in Explorer
   - Select "Generate Tasks from PRD" from context menu
   - Follow the interactive prompts

5. **Open VS Code** and enjoy the integrated task management!

## Usage

### Command Palette Commands

Access these commands via `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac):

- `Task Master: Refresh Tasks` - Reload task data
- `Task Master: Show Next Task` - Display the next actionable task
- `Task Master: Add Task` - Create a new task with AI assistance
- `Task Master: Filter by Status` - Filter tasks by completion status
- `Task Master: Select Tag` - Switch between tag contexts
- `Task Master: Analyze Complexity` - Run AI complexity analysis
- `Task Master: Expand All Tasks` - Break down all tasks into subtasks
- `Task Master: Generate Tasks from PRD` - Generate tasks from a PRD file

### Tree View Operations

Right-click on tasks in the Task Master tree view for context menus:

**Task Operations:**

- Mark as Complete/In Progress/Blocked
- Show Details
- Update Task
- Expand into Subtasks
- Delete Task
- Add/Remove Dependencies

**Subtask Operations:**

- Update Subtask
- Change Status
- Remove Subtask

### Status Bar

Click the status bar item to cycle through different views:

1. **Next Task** - Shows the next actionable task
2. **Progress** - Overall completion percentage
3. **Dependencies** - Ready vs blocked task counts
4. **Priority** - High/medium/low priority breakdown

### PRD File Integration

The extension provides seamless integration with PRD (Product Requirements Document) files:

**Right-Click Context Menu:**

1. Right-click any `.txt` file in VS Code Explorer
2. Select "Generate Tasks from PRD" from the context menu
3. Configure task generation options:
   - **Task Quantity**: Choose how many tasks to generate (1-100, default: 10)
   - **Research Mode**: Enable AI research-backed task generation (requires API key)
4. Monitor real-time progress with built-in progress indicators
5. View generated tasks automatically refreshed in the task tree

**Features:**

- **Security**: File extension validation and path sanitization
- **User Experience**: Interactive prompts with validation
- **Progress Tracking**: Real-time feedback during task generation
- **Error Handling**: Graceful failure with informative error messages
- **Integration**: Seamless workflow with existing Task Master features

**Command Palette Alternative:**
Use `Ctrl+Shift+P` → "Task Master: Generate Tasks from PRD" to select a file manually.

## Configuration

### VS Code Settings

Configure the extension through VS Code settings:

```json
{
  "taskMaster.cliPath": "task-master"
}
```

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/roeyazroel/task-master-vscode-extension.git
cd task-master-vscode-extension

# Install dependencies
npm install

# Compile TypeScript
npm run compile
```

### Running Tests

```bash
# Run all tests
npm test
```

## Troubleshooting

### CLI Not Found

```bash
# Check if CLI is in PATH
which task-master

# Install globally if missing
npm install -g task-master-ai

# Or set custom path in VS Code settings
```

### Permission Issues

- Ensure workspace is trusted (`Ctrl+Shift+P` → "Trust Workspace")
- Check CLI executable permissions
- Verify API keys are properly configured

### Task Sync Issues

- Use "Refresh Tasks" command
- Check `.taskmaster/tasks/tasks.json` file permissions
- Verify CLI and extension are using same task file

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Related Projects

- [Claude Task Master CLI](https://github.com/eyaltoledano/claude-task-master.git) - The underlying CLI tool
- [Task Master Documentation](https://task-master.dev) - Comprehensive documentation

## Support

- 🐛 [Report Issues](https://github.com/roeyazroel/task-master-vscode-extension/issues)
- 💬 [Discussions](https://github.com/roeyazroel/task-master-vscode-extension/discussions)
- 📚 [Documentation](https://task-master.dev)

---

**Made with ❤️ for developers who love organized, AI-powered task management**
