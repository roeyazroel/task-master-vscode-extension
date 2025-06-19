// Detect if we're in a test environment
const isTestEnvironment =
  process.env.NODE_ENV === "test" ||
  process.argv.some((arg) => arg.includes("mocha")) ||
  process.argv.some((arg) => arg.includes("test"));

// Conditionally import vscode only when not in test environment
let vscode: any;
if (!isTestEnvironment) {
  try {
    vscode = require("vscode");
  } catch {
    // vscode not available, probably in test environment
  }
}

let outputChannel: any | undefined;

export function initializeLogging(context?: any): void {
  if (isTestEnvironment || !vscode) {
    // Skip initialization in test environment
    return;
  }

  try {
    outputChannel = vscode.window.createOutputChannel("Task Master");
    context?.subscriptions.push(outputChannel);
    log("[Initialization] Output channel created successfully");
  } catch {
    log("[Critical] Failed to create output channel", true);
    throw new Error("Failed to initialize logging system");
  }
}

export function log(message: string, data?: any, error: boolean = false): void {
  if (isTestEnvironment) {
    // In test environment, just use console
    const timestamp = new Date().toISOString();
    const logLevel = error ? "ERROR" : "INFO";
    let logMessage = `[${timestamp}] [${logLevel}] ${message}`;

    if (data !== undefined) {
      try {
        const dataString =
          typeof data === "object"
            ? "\n" + JSON.stringify(data, null, 2)
            : " " + data.toString();
        logMessage += dataString;
      } catch {
        logMessage += " [Error stringifying data]";
      }
    }

    if (error) {
      console.error(logMessage);
    } else {
      console.log(logMessage);
    }
    return;
  }

  if (!vscode) {
    // vscode not available, fallback to console
    console.log(message, data);
    return;
  }

  const config = vscode.workspace.getConfiguration("taskMaster");
  const loggingEnabled = config.get("enableLogging", false) as boolean;

  const shouldLog = error || loggingEnabled;

  if (shouldLog) {
    safeLog(message, data, error);
  }
}

function safeLog(message: string, data?: any, isError: boolean = false): void {
  const timestamp = new Date().toISOString();
  const logLevel = isError ? "ERROR" : "INFO";
  let logMessage = `[${timestamp}] [${logLevel}] ${message}`;

  // Add data if provided
  if (data !== undefined) {
    try {
      const dataString =
        typeof data === "object"
          ? "\n" + JSON.stringify(data, null, 2)
          : " " + data.toString();
      logMessage += dataString;
    } catch {
      logMessage += " [Error stringifying data]";
    }
  }

  // Always log to console
  if (isError) {
    console.error(logMessage);
  } else {
    console.log(logMessage);
  }

  // Try to log to output channel if it exists and vscode is available
  if (vscode && outputChannel) {
    try {
      outputChannel.appendLine(logMessage);
    } catch {
      console.error("Failed to write to output channel");
    }
  }

  // Show error messages in the UI for critical issues (only if vscode is available)
  if (isError && message.includes("[Critical]") && vscode) {
    try {
      vscode.window.showErrorMessage(`Cursor Stats: ${message}`);
    } catch {
      console.error("Failed to show error message in UI");
    }
  }
}

export function disposeLogger(): void {
  if (outputChannel) {
    outputChannel.dispose();
    outputChannel = undefined;
  }
}
