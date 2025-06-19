import * as assert from "assert";
import { TestCLIService } from "./TestCLIService";
import { getCLIService, isTaskMasterAvailable } from "./TestHelpers";

/**
 * CLI Sanity Tests
 * Verifies that the task-master CLI is available and basic commands work
 */
describe("CLI Sanity Tests", () => {
  let cliService: TestCLIService;

  before("Check CLI availability", function () {
    // Skip all tests if task-master CLI is not available
    if (!isTaskMasterAvailable()) {
      console.log("Skipping CLI tests: task-master not found on PATH");
      this.skip();
    }

    cliService = getCLIService();
  });

  describe("CLI Availability", () => {
    it("should detect that CLI is available", async () => {
      const isAvailable = await cliService.checkCLIAvailability();
      assert.strictEqual(isAvailable, true, "CLI should be available");
    });

    it("should execute --version command successfully", async () => {
      const result = await cliService.executeCommand("--version", {
        format: "text",
        timeout: 5000,
      });

      assert.strictEqual(
        typeof result,
        "string",
        "Version output should be a string"
      );
      const resultStr = result as string;
      assert.ok(resultStr.length > 0, "Version output should not be empty");

      // Basic sanity check - should contain version-like content
      assert.ok(
        resultStr.includes("task-master") || resultStr.match(/\d+\.\d+\.\d+/),
        "Version output should contain 'task-master' or version number"
      );
    });
  });

  describe("CLI Configuration", () => {
    it("should use the correct CLI path", () => {
      // Access the private config property via casting
      const config = (cliService as any).config;
      assert.strictEqual(
        config.cliPath,
        "task-master",
        "Should use global task-master binary"
      );
    });
  });
});
