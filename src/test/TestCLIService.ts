import { spawn } from "child_process";
import { EventEmitter } from "events";
import { TaskMasterConfig } from "../types";

/**
 * Test-specific CLI service that doesn't depend on VS Code APIs
 * Simplified version of CLIService for unit testing
 */
export class TestCLIService extends EventEmitter {
  private config: TaskMasterConfig;

  constructor(config: TaskMasterConfig) {
    super();
    this.config = config;
  }

  /**
   * Check if CLI is available and accessible
   */
  public async checkCLIAvailability(): Promise<boolean> {
    try {
      await this.executeCommand("--version", { timeout: 5000, format: "text" });
      return true;
    } catch (error) {
      console.error("CLI not available:", error);
      return false;
    }
  }

  /**
   * Execute a specific Task Master CLI command
   */
  public async executeCommand(
    command: string,
    options: {
      format?: "text";
      timeout?: number;
      extraArgs?: string[];
    } = {}
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [command, ...(options.extraArgs || [])];
      const childProcess = spawn(this.config.cliPath, args, {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      const timeout = options.timeout || 30000;

      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        childProcess.kill("SIGTERM");
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);

      // Handle stdout data streaming
      childProcess.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      // Handle stderr
      childProcess.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      // Handle process completion
      childProcess.on("close", (code: number | null) => {
        clearTimeout(timeoutHandle);

        if (code === 0) {
          resolve(stdout);
        } else {
          const errorOutput =
            stderr.trim() || stdout.trim() || "No error output";
          reject(
            new Error(`CLI command failed with code ${code}: ${errorOutput}`)
          );
        }
      });

      // Handle process errors
      childProcess.on("error", (error: Error) => {
        clearTimeout(timeoutHandle);
        reject(new Error(`Failed to spawn CLI process: ${error.message}`));
      });
    });
  }

  /**
   * Get next task data directly from CLI
   */
  public async getNextTaskFromCLI(): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = ["next"];
      const childProcess = spawn(this.config.cliPath, args, {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      const timeout = 30000;

      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        childProcess.kill("SIGTERM");
        reject(new Error(`Next command timed out after ${timeout}ms`));
      }, timeout);

      // Handle stdout data streaming
      childProcess.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      // Handle stderr
      childProcess.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      // Handle process completion
      childProcess.on("close", (code: number | null) => {
        clearTimeout(timeoutHandle);

        if (code === 0) {
          resolve(stdout);
        } else {
          const errorOutput =
            stderr.trim() || stdout.trim() || "No error output";
          reject(
            new Error(`Next command failed with code ${code}: ${errorOutput}`)
          );
        }
      });

      // Handle process errors
      childProcess.on("error", (error: Error) => {
        clearTimeout(timeoutHandle);
        reject(new Error(`Failed to spawn next CLI process: ${error.message}`));
      });
    });
  }
}
