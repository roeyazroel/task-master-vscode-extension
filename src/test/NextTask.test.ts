import * as assert from "assert";
import { parseNextTaskOutput } from "../utils/outputParser";
import { TestCLIService } from "./TestCLIService";
import {
  getCLIService,
  isTaskMasterAvailable,
  readTasksFile,
} from "./TestHelpers";

/**
 * Next Task Tests
 * Verifies that the next task command works and output can be parsed
 */
describe("Next Task Tests", () => {
  let cliService: TestCLIService;

  before("Setup test environment", function () {
    // Skip all tests if task-master CLI is not available
    if (!isTaskMasterAvailable()) {
      console.log("Skipping CLI tests: task-master not found on PATH");
      this.skip();
    }

    cliService = getCLIService();
  });

  describe("Next Task Command", () => {
    it("should execute next command without errors", async function () {
      this.timeout(10000);

      try {
        const rawOutput = await cliService.getNextTaskFromCLI();

        // Should return a string (even if empty when no next task)
        assert.strictEqual(
          typeof rawOutput,
          "string",
          "Next task output should be a string"
        );

        console.log(
          "Next task raw output:",
          rawOutput.substring(0, 200) + (rawOutput.length > 200 ? "..." : "")
        );
      } catch (error) {
        // If we get an error, it should be informative
        assert.fail(`Next task command failed: ${error}`);
      }
    });

    it("should return parsable output when next task exists", async function () {
      this.timeout(10000);

      // First check if we have any pending tasks
      const localTasks = readTasksFile();
      const pendingTasks = localTasks.filter(
        (task) =>
          task.status === "pending" &&
          (!task.dependencies || task.dependencies.length === 0)
      );

      if (pendingTasks.length === 0) {
        console.log(
          "No pending tasks available - skipping next task parsing test"
        );
        this.skip();
      }

      const rawOutput = await cliService.getNextTaskFromCLI();

      if (!rawOutput || rawOutput.trim().length === 0) {
        console.log("No next task output - skipping parsing test");
        this.skip();
      }

      // Parse the output
      const parsed = parseNextTaskOutput(rawOutput);

      console.log("Parsed next task:", JSON.stringify(parsed, null, 2));

      if (parsed.success && parsed.id) {
        // Verify ID is either number or string (for subtasks)
        assert.ok(
          typeof parsed.id === "number" || typeof parsed.id === "string",
          "Task ID should be number or string"
        );
        // If subtask, id should contain a dot
        if (parsed.isSubtask) {
          assert.ok(
            typeof parsed.id === "string" && parsed.id.includes("."),
            "Subtask ID should be a string with a dot"
          );
        } else {
          assert.ok(
            typeof parsed.id === "number",
            "Main task ID should be a number"
          );
        }
        console.log(
          `Successfully parsed next task: (ID: ${parsed.id}, isSubtask: ${parsed.isSubtask})`
        );
      } else {
        console.log("Next task parsing indicated no task available");
        // This is okay - might mean all tasks are done or blocked
      }
    });

    it("should handle case when no next task is available", async function () {
      this.timeout(10000);

      // This test always runs - we want to verify graceful handling regardless of task state
      const rawOutput = await cliService.getNextTaskFromCLI();
      const parsed = parseNextTaskOutput(rawOutput);

      // Should always get a parse result, even if no task is available
      assert.ok(typeof parsed === "object", "Parser should return an object");
      assert.ok(
        typeof parsed.success === "boolean",
        "Parser should indicate success/failure"
      );

      if (!parsed.success) {
        // If no next task, should have a message
        assert.ok(
          parsed.message,
          "Should have a message when no next task available"
        );
        console.log("No next task message:", parsed.message);
      } else if (parsed.id) {
        console.log("Next task available:", parsed.id);
      }
    });
  });

  describe("Next Task Data Consistency", () => {
    it("should return task that exists in local file when next task is available", async function () {
      this.timeout(10000);

      const rawOutput = await cliService.getNextTaskFromCLI();
      const parsed = parseNextTaskOutput(rawOutput);

      // Skip if no next task
      if (!parsed.success || !parsed.id) {
        console.log("No next task to verify against local file");
        this.skip();
      }

      const localTasks = readTasksFile();
      const taskId = parsed.id;

      if (typeof taskId === "number") {
        // Regular task - should exist in local file
        const localTask = localTasks.find((task) => task.id === taskId);
        assert.ok(
          localTask,
          `Next task ${taskId} should exist in local tasks file`
        );
      } else if (typeof taskId === "string" && taskId.includes(".")) {
        // Subtask - verify parent task exists
        const [parentIdStr, subtaskIdStr] = taskId.split(".");
        const parentId = parseInt(parentIdStr);
        const parentTask = localTasks.find((task) => task.id === parentId);
        assert.ok(
          parentTask,
          `Parent task ${parentId} should exist for subtask ${taskId}`
        );
        // Verify subtask exists in parent (match by string)
        const subtask = parentTask?.subtasks?.find(
          (sub) => String(sub.id) === subtaskIdStr || String(sub.id) === taskId
        );
        assert.ok(
          subtask,
          `Subtask ${taskId} should exist in parent task ${parentId}`
        );
      } else {
        assert.fail(`Unexpected task ID format: ${taskId}`);
      }
    });
  });
});
