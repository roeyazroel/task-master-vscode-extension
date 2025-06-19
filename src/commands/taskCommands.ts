import * as vscode from "vscode";
import { CLIService } from "../services/cliService";
import {
  parseTaskCreationOutput,
  parseTaskDeletionOutput,
} from "../utils/outputParser";
import { findDependents } from "../utils/taskUtils";

/**
 * Command handlers for basic task operations
 */

/**
 * Add a new task by prompting the user for details and invoking the CLI (AI-powered)
 */
export async function addTask(
  cliService: CLIService,
  onRefreshTasks: () => Promise<void>
): Promise<void> {
  // Prompt for task description/prompt (required)
  const prompt = await vscode.window.showInputBox({
    prompt: "Enter task description/prompt",
    placeHolder: "Describe what needs to be done...",
    ignoreFocusOut: true,
  });
  if (!prompt) {
    vscode.window.showInformationMessage(
      "Task creation cancelled (no description provided)"
    );
    return;
  }

  // Prompt for priority (optional)
  const priority = await vscode.window.showQuickPick(
    [
      { label: "Skip (use default)", value: "" },
      { label: "High", value: "high" },
      { label: "Medium", value: "medium" },
      { label: "Low", value: "low" },
    ],
    {
      placeHolder: "Select task priority (optional)",
      ignoreFocusOut: true,
    }
  );
  if (priority === undefined) {
    vscode.window.showInformationMessage(
      "Task creation cancelled (no priority selected)"
    );
    return;
  }

  // Prompt for dependencies (optional, comma-separated IDs)
  const depsInput = await vscode.window.showInputBox({
    prompt: "Enter dependency task IDs (comma-separated, optional)",
    placeHolder: "e.g. 1,2,3 or leave empty",
    ignoreFocusOut: true,
  });
  if (depsInput === undefined) {
    vscode.window.showInformationMessage(
      "Task creation cancelled (dependencies input cancelled)"
    );
    return;
  }

  // Build CLI args for add-task
  const args = ["add-task", `--prompt="${prompt}"`];

  if (priority.value) {
    args.push(`--priority=${priority.value}`);
  }

  if (depsInput && depsInput.trim() !== "") {
    // Parse and validate dependency IDs to ensure they are numbers
    const depIds = depsInput
      .replace(/\s+/g, "")
      .split(",")
      .map((id) => {
        const num = parseInt(id.trim());
        if (isNaN(num) || num <= 0) {
          throw new Error(`Invalid dependency ID: ${id}`);
        }
        return num;
      });

    // Pass as comma-separated numbers (not strings)
    args.push(`--dependencies=${depIds.join(",")}`);
  }

  try {
    // Execute the CLI command
    const output = await cliService.executeCommand("add-task", {
      extraArgs: args.slice(1),
      format: "text",
    } as any);

    // Refresh tasks
    await onRefreshTasks();

    // Parse the CLI output for clean user messages
    if (output && output.toString().trim()) {
      const resultText = output.toString().trim();
      const parsed = parseTaskCreationOutput(resultText);

      if (parsed.success) {
        const message = parsed.taskId
          ? `Task created successfully (ID: ${parsed.taskId})`
          : "Task created successfully";
        vscode.window.showInformationMessage(message);
      } else {
        vscode.window.showWarningMessage(parsed.message);
      }
    } else {
      vscode.window.showInformationMessage("Task added successfully");
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to add task: ${error}`);
  }
}

/**
 * Delete a task by ID, handling dependencies and confirmation
 */
export async function deleteTask(
  taskId: number | undefined,
  cliService: CLIService,
  onRefreshTasks: () => Promise<void>
): Promise<void> {
  if (!taskId) {
    vscode.window.showWarningMessage("No task ID provided for deletion");
    return;
  }
  try {
    // Validate dependencies first
    const validationResult = await cliService.executeCommand(
      "validate-dependencies",
      { format: "text" } as any
    );
    const dependents = findDependents(taskId, validationResult);
    if (dependents.length > 0) {
      const confirm = await vscode.window.showWarningMessage(
        `Task ${taskId} has dependents: ${dependents.join(
          ", "
        )}. Remove anyway? This will fix dependencies and delete the task.`,
        { modal: true },
        "Yes",
        "No"
      );
      if (confirm !== "Yes") {
        vscode.window.showInformationMessage("Task deletion cancelled");
        return;
      }
      // Fix dependencies before deletion
      await cliService.executeCommand("fix-dependencies", {
        format: "text",
      } as any);
    } else {
      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to permanently delete task ${taskId}?`,
        { modal: true },
        "Yes",
        "No"
      );
      if (confirm !== "Yes") {
        vscode.window.showInformationMessage("Task deletion cancelled");
        return;
      }
    }
    // Remove the task
    const output = await cliService.executeCommand("remove-task", {
      extraArgs: [`--id=${taskId}`, "-y"],
      format: "text",
    } as any);
    await onRefreshTasks();

    // Parse the CLI output for clean user messages
    if (output && output.toString().trim()) {
      const resultText = output.toString().trim();
      const parsed = parseTaskDeletionOutput(resultText);

      if (parsed.success) {
        vscode.window.showInformationMessage(parsed.message);
      } else {
        vscode.window.showWarningMessage(parsed.message);
      }
    } else {
      vscode.window.showInformationMessage(
        `Task ${taskId} deleted successfully`
      );
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to delete task: ${error}`);
  }
}

/**
 * List all tasks using the CLI
 */
export async function listTasks(cliService: CLIService): Promise<string> {
  const output = await cliService.executeCommand("list", {
    format: "text",
  } as any);
  return output as any as string;
}

/**
 * Show task details in a VS Code editor tab using the CLI
 */
/**
 * Expand a task into subtasks using the CLI
 */
export async function expandTask(
  taskId: number | undefined,
  cliService: CLIService,
  onRefreshTasks: () => Promise<void>
): Promise<void> {
  if (!taskId) {
    vscode.window.showWarningMessage("No task ID provided for expansion");
    return;
  }

  // Prompt for number of subtasks (optional)
  const numSubtasks = await vscode.window.showInputBox({
    prompt: "Number of subtasks to generate (optional, default: 5)",
    placeHolder: "5",
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (value && value.trim() !== "") {
        const num = parseInt(value.trim());
        if (isNaN(num) || num <= 0 || num > 50) {
          return "Please enter a valid number between 1 and 50";
        }
      }
      return null;
    },
  });
  if (numSubtasks === undefined) {
    vscode.window.showInformationMessage("Task expansion cancelled");
    return;
  }

  // Prompt for additional context (optional)
  const context = await vscode.window.showInputBox({
    prompt: "Additional context for subtask generation (optional)",
    placeHolder: "Provide any specific guidance for breaking down this task...",
    ignoreFocusOut: true,
  });
  if (context === undefined) {
    vscode.window.showInformationMessage("Task expansion cancelled");
    return;
  }

  // Prompt for research mode (optional)
  const useResearch = await vscode.window.showQuickPick(
    [
      { label: "No", value: false },
      { label: "Yes", value: true },
    ],
    {
      placeHolder: "Use research mode for enhanced subtask generation?",
      ignoreFocusOut: true,
    }
  );
  if (useResearch === undefined) {
    vscode.window.showInformationMessage("Task expansion cancelled");
    return;
  }

  try {
    // Build CLI args for expand
    const args = [`--id=${taskId}`];

    if (numSubtasks && numSubtasks.trim() !== "") {
      args.push(`--num=${numSubtasks.trim()}`);
    }

    if (context && context.trim() !== "") {
      args.push(`--prompt="${context.trim()}"`);
    }

    if (useResearch.value) {
      args.push("--research");
    }

    // Execute the CLI command
    vscode.window.showInformationMessage(`Expanding task ${taskId}...`);
    const output = await cliService.executeCommand("expand", {
      extraArgs: args,
      format: "text",
    } as any);

    // run the task-master list command to fix the tasks.json file
    await cliService.executeCommand("list", {
      format: "text",
    } as any);

    // Refresh tasks
    await onRefreshTasks();

    // Show success message
    if (output && output.toString().trim()) {
      const resultText = output.toString().trim();
      vscode.window.showInformationMessage(
        `Task ${taskId} expanded successfully`
      );
    } else {
      vscode.window.showInformationMessage(
        `Task ${taskId} expanded successfully`
      );
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to expand task: ${error}`);
  }
}

/**
 * Expand all pending tasks into subtasks using the CLI
 */
export async function expandAllTasks(
  cliService: CLIService,
  onRefreshTasks: () => Promise<void>
): Promise<void> {
  // Confirm with user
  const confirm = await vscode.window.showWarningMessage(
    "This will expand all pending tasks into subtasks. This may take some time. Continue?",
    { modal: true },
    "Yes",
    "No"
  );
  if (confirm !== "Yes") {
    vscode.window.showInformationMessage("Expand all tasks cancelled");
    return;
  }

  // Prompt for force mode (to regenerate existing subtasks)
  const useForce = await vscode.window.showQuickPick(
    [
      { label: "No - Only expand tasks without subtasks", value: false },
      { label: "Yes - Regenerate subtasks for all tasks", value: true },
    ],
    {
      placeHolder: "Force regeneration of existing subtasks?",
      ignoreFocusOut: true,
    }
  );
  if (useForce === undefined) {
    vscode.window.showInformationMessage("Expand all tasks cancelled");
    return;
  }

  // Prompt for research mode (optional)
  const useResearch = await vscode.window.showQuickPick(
    [
      { label: "No", value: false },
      { label: "Yes", value: true },
    ],
    {
      placeHolder: "Use research mode for enhanced subtask generation?",
      ignoreFocusOut: true,
    }
  );
  if (useResearch === undefined) {
    vscode.window.showInformationMessage("Expand all tasks cancelled");
    return;
  }

  try {
    // Build CLI args for expand --all
    const args = ["--all"];

    if (useForce.value) {
      args.push("--force");
    }

    if (useResearch.value) {
      args.push("--research");
    }

    // Execute the CLI command
    vscode.window.showInformationMessage("Expanding all pending tasks...");
    const output = await cliService.executeCommand("expand", {
      extraArgs: args,
      format: "text",
      timeout: 300000, // 5 minute timeout for potentially long operation
    } as any);

    // run the task-master list command to fix the tasks.json file
    await cliService.executeCommand("list", {
      format: "text",
    } as any);

    // Refresh tasks
    await onRefreshTasks();

    // Show success message
    if (output && output.toString().trim()) {
      const resultText = output.toString().trim();
      vscode.window.showInformationMessage(
        "All pending tasks expanded successfully"
      );
    } else {
      vscode.window.showInformationMessage(
        "All pending tasks expanded successfully"
      );
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to expand all tasks: ${error}`);
  }
}

export async function showTaskDetails(
  taskId: number | undefined,
  cliService: CLIService
): Promise<void> {
  if (!taskId) {
    vscode.window.showWarningMessage("No task ID provided for details");
    return;
  }
  try {
    // Call the CLI to get task details as plain text
    const result = await cliService.executeCommand("show", {
      extraArgs: ["--id=" + taskId],
      format: "text",
    } as any);
    // result is the raw text output
    const details = result as any as string;
    // Open in a new text document
    const doc = await vscode.workspace.openTextDocument({
      content: details,
      language: "markdown",
    });
    await vscode.window.showTextDocument(doc, { preview: false });
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to show task details: ${error}`);
  }
}

/**
 * Update an existing task by prompting the user for update context
 */
export async function updateTask(
  taskId: number | undefined,
  cliService: CLIService,
  onRefreshTasks: () => Promise<void>
): Promise<void> {
  if (!taskId) {
    vscode.window.showWarningMessage("No task ID provided for update");
    return;
  }

  // Prompt for update context/prompt (required)
  const prompt = await vscode.window.showInputBox({
    prompt: `Enter update context for task ${taskId}`,
    placeHolder:
      "Describe what needs to be updated (e.g., 'Change priority to high and add dependency on task 5')...",
    ignoreFocusOut: true,
  });

  if (!prompt) {
    vscode.window.showInformationMessage(
      "Task update cancelled (no context provided)"
    );
    return;
  }

  try {
    // Execute the CLI update command
    const output = await cliService.executeCommand("update-task", {
      extraArgs: [`--id=${taskId}`, `--prompt="${prompt}"`],
      format: "text",
    } as any);

    // Refresh tasks
    await onRefreshTasks();

    // Show success message
    vscode.window.showInformationMessage(`Task ${taskId} updated successfully`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to update task: ${error}`);
  }
}

/**
 * Provide research resources for task complexity analysis
 */
async function showResearchResources(): Promise<void> {
  const resources = [
    {
      label: "$(book) Task Management Best Practices",
      description: "Comprehensive guide to breaking down complex tasks",
      detail:
        "Learn effective strategies for task decomposition and complexity assessment",
    },
    {
      label: "$(globe) Agile Estimation Techniques",
      description: "Online resources for effort estimation",
      detail: "Planning poker, story points, and other estimation methods",
    },
    {
      label: "$(search-web) Research Task Dependencies",
      description: "Open dependency analysis tools and documentation",
      detail:
        "External tools for understanding task relationships and blockers",
    },
    {
      label: "$(lightbulb) Complexity Analysis Patterns",
      description: "Common patterns for identifying task complexity",
      detail: "Learn to recognize indicators of high-complexity tasks",
    },
  ];

  const selectedResource = await vscode.window.showQuickPick(resources, {
    placeHolder: "Select a resource to help with task complexity analysis",
    title: "Research Resources for Task Complexity",
  });

  if (selectedResource) {
    switch (selectedResource.label) {
      case "$(book) Task Management Best Practices":
        await vscode.env.openExternal(
          vscode.Uri.parse(
            "https://www.atlassian.com/agile/project-management/user-stories"
          )
        );
        break;
      case "$(globe) Agile Estimation Techniques":
        await vscode.env.openExternal(
          vscode.Uri.parse(
            "https://www.scrum.org/resources/blog/what-scrum-estimation"
          )
        );
        break;
      case "$(search-web) Research Task Dependencies":
        await vscode.env.openExternal(
          vscode.Uri.parse("https://asana.com/guide/help/premium/dependencies")
        );
        break;
      case "$(lightbulb) Complexity Analysis Patterns":
        // Show an information message with complexity indicators
        vscode.window.showInformationMessage(
          "High complexity indicators: Multiple dependencies, unclear requirements, new technology, cross-team coordination, external integrations, or estimated effort > 1 week.",
          "Got it"
        );
        break;
    }
  }
}

/**
 * Analyze task complexity using AI to provide recommendations for task expansion
 */
export async function analyzeComplexity(
  cliService: CLIService,
  onRefreshTasks: () => Promise<void>
): Promise<void> {
  try {
    // Prompt user for research option
    const useResearch = await vscode.window.showQuickPick(
      [
        {
          label: "$(search) Enhanced Analysis with Research",
          description:
            "Use AI research to provide more informed complexity analysis (recommended)",
          detail:
            "This may take longer but provides better insights and recommendations",
          value: true,
        },
        {
          label: "$(zap) Quick Analysis",
          description:
            "Standard complexity analysis without additional research",
          detail: "Faster execution using existing knowledge only",
          value: false,
        },
      ],
      {
        placeHolder: "Choose analysis type for task complexity evaluation",
        title: "Task Complexity Analysis Options",
      }
    );

    // If user cancels the prompt, abort the operation
    if (useResearch === undefined) {
      return;
    }

    // If user selected research option, offer to show research resources first
    if (useResearch.value) {
      const showResources = await vscode.window.showInformationMessage(
        "Would you like to view research resources to help understand task complexity before running the analysis?",
        "View Resources",
        "Skip to Analysis"
      );

      if (showResources === "View Resources") {
        await showResearchResources();
      }
    }

    // Show a progress message while analysis is running
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: useResearch.value
          ? "Analyzing task complexity with research..."
          : "Analyzing task complexity...",
        cancellable: false,
      },
      async (progress) => {
        progress.report({
          message: useResearch.value
            ? "Running enhanced complexity analysis with AI research..."
            : "Running complexity analysis...",
        });

        // Build command arguments conditionally
        const extraArgs = useResearch.value ? ["--research"] : [];

        // Execute the analyze-complexity CLI command
        const output = await cliService.executeCommand("analyze-complexity", {
          extraArgs,
          format: "text",
          timeout: useResearch.value ? 300000 : 180000, // 5 minutes for research, 3 minutes for standard
        } as any);

        progress.report({ message: "Processing results..." });

        // Refresh tasks to update any changes made by the analysis
        await onRefreshTasks();

        return output;
      }
    );

    // Show success message and offer to view the complexity report or additional resources
    const action = await vscode.window.showInformationMessage(
      "Task complexity analysis completed successfully!",
      "View Report",
      "Research Resources",
      "Close"
    );

    if (action === "View Report") {
      // Open the complexity report
      await showComplexityReport(cliService);
    } else if (action === "Research Resources") {
      await showResearchResources();
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to analyze complexity: ${error}`);
  }
}

/**
 * Display the complexity analysis report in a readable format
 */
export async function showComplexityReport(
  cliService: CLIService
): Promise<void> {
  try {
    // Call the CLI to get the complexity report
    const reportOutput = await cliService.executeCommand("complexity-report", {
      format: "text",
    } as any);

    if (!reportOutput) {
      vscode.window.showWarningMessage(
        "No complexity report found. Run 'Analyze Complexity' first."
      );
      return;
    }

    // Display the report in a new document
    const reportText =
      typeof reportOutput === "string" ? reportOutput : String(reportOutput);

    // Open in a new text document with markdown syntax highlighting
    const doc = await vscode.workspace.openTextDocument({
      content: reportText,
      language: "markdown",
    });

    await vscode.window.showTextDocument(doc, {
      preview: false,
      viewColumn: vscode.ViewColumn.Beside, // Open in side panel
    });
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to show complexity report: ${error}`
    );
  }
}
