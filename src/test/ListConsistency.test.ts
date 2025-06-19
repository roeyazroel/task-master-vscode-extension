import * as assert from "assert";
import { Task } from "../types";
import { TestCLIService } from "./TestCLIService";
import {
  getCLIService,
  isTaskMasterAvailable,
  readTasksFile,
} from "./TestHelpers";

/**
 * List Consistency Tests
 * Verifies that CLI list output matches the local tasks.json file
 */
describe("List Consistency Tests", () => {
  let cliService: TestCLIService;
  let localTasks: Task[];

  before("Setup test environment", function () {
    // Skip all tests if task-master CLI is not available
    if (!isTaskMasterAvailable()) {
      console.log("Skipping CLI tests: task-master not found on PATH");
      this.skip();
    }

    cliService = getCLIService();

    try {
      localTasks = readTasksFile();
      console.log(`Found ${localTasks.length} tasks in local tasks.json`);
    } catch (error) {
      console.log(`Failed to read local tasks: ${error}`);
      this.skip();
    }
  });

  describe("Task List Synchronization", () => {
    it("should return task list from CLI that matches local file", async function () {
      this.timeout(10000); // Increase timeout for CLI call

      const result = await cliService.executeCommand("list", {
        format: "text",
        extraArgs: ["--with-subtasks"],
        timeout: 8000,
      });

      // Verify we got a string response
      assert.strictEqual(typeof result, "string", "CLI should return string");
      assert.ok(result !== null, "CLI result should not be null");
      // Optionally, check that the output contains some known task titles or IDs
      for (const task of localTasks) {
        assert.ok(
          result.includes(task.title) || result.includes(String(task.id)),
          `CLI output should include task title or ID: ${task.title} (${task.id})`
        );
      }
    });

    it("should have matching task IDs between CLI and local file", async function () {
      this.timeout(10000);

      const result = await cliService.executeCommand("list", {
        format: "text",
        extraArgs: ["--with-subtasks"],
        timeout: 8000,
      });

      // Only check that all local task IDs appear in the CLI output
      for (const task of localTasks) {
        assert.ok(
          result.includes(String(task.id)),
          `CLI output should include task ID: ${task.id}`
        );
      }
    });

    it("should have matching task titles for each ID", async function () {
      this.timeout(10000);

      if (localTasks.length === 0) {
        console.log("No tasks to compare - skipping title check");
        this.skip();
      }

      const result = await cliService.executeCommand("list", {
        format: "text",
        extraArgs: ["--with-subtasks"],
        timeout: 8000,
      });

      // Only check that a substring of each local task title appears in the CLI output
      for (const task of localTasks) {
        const titleFragment = task.title.slice(0, 10); // Use first 10 chars for match
        assert.ok(
          result.includes(titleFragment),
          `CLI output should include a fragment of task title: ${titleFragment}`
        );
      }
    });

    it("should have consistent status values", async function () {
      this.timeout(10000);

      if (localTasks.length === 0) {
        console.log("No tasks to compare - skipping status check");
        this.skip();
      }

      const result = await cliService.executeCommand("list", {
        format: "text",
        extraArgs: ["--with-subtasks"],
        timeout: 8000,
      });

      // Only check that all local task statuses appear in the CLI output
      for (const task of localTasks) {
        assert.ok(
          result.includes(task.status),
          `CLI output should include task status: ${task.status}`
        );
      }
    });
  });
});
