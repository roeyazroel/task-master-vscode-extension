import { strict as assert } from "assert";
import { parseNextTaskOutput } from "../utils/outputParser";

/**
 * Unit tests for parseNextTaskOutput
 * These tests use static CLI output samples to ensure robust parsing
 */
describe("parseNextTaskOutput", () => {
  it("parses a typical subtask output", () => {
    const rawOutput = `\n\n\uD83C\uDFF7\uFE0F tag: master\n\n\u256D\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E\n│ Next Task: #13.2 - Display pre-filled editable form for selected task │\n\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F\n┌───────────────┬────────────────────────────────────────────────────────────┐\n│ ID:           │ 13.2                                                       │\n│ Title:        │ Display pre-filled editable form for selected task         │\n│ Priority:     │ high                                                       │\n│ Dependencies: │ 13.1                                                       │\n│ Complexity:   │ N/A                                                        │\n│ Description:  │                                                            │\n└───────────────┴────────────────────────────────────────────────────────────┘\n`;
    const result = parseNextTaskOutput(rawOutput);
    assert.equal(result.success, true);
    assert.deepEqual(result, {
      success: true,
      id: "13.2",
      isSubtask: true,
    });
  });

  it("parses a main task with multiple dependencies and description", () => {
    const rawOutput = `\n\n\u256D\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E\n│ Next Task: #13 - Add Update Task Option to Task Menu │\n\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F\n┌───────────────┬────────────────────────────────────────────────────────────┐\n│ ID:           │ 13                                                         │\n│ Title:        │ Add Update Task Option to Task Menu                        │\n│ Priority:     │ high                                                       │\n│ Dependencies: │ 6, 11                                                      │\n│ Complexity:   │ N/A                                                        │\n│ Description:  │ Integrate an option in the task menu to update existing    │\n│               │ tasks.                                                     │\n└───────────────┴────────────────────────────────────────────────────────────┘\n`;
    const result = parseNextTaskOutput(rawOutput);
    assert.equal(result.success, true);
    assert.deepEqual(result, {
      success: true,
      id: 13,
      isSubtask: false,
    });
  });

  it("returns failure when no next task is present", () => {
    const rawOutput = "No next task found.";
    const result = parseNextTaskOutput(rawOutput);
    assert.equal(result.success, false);
    assert.ok(result.message);
  });

  it("handles malformed output gracefully", () => {
    const rawOutput = "garbage output with no recognizable task";
    const result = parseNextTaskOutput(rawOutput);
    assert.equal(result.success, false);
    assert.ok(result.message);
  });

  it("parses a task with no dependencies", () => {
    const rawOutput = `\n\n│ Next Task: #14 - Add Analyze Complexity Button │\n┌───────────────┬────────────────────────────────────────────────────────────┐\n│ ID:           │ 14                                                         │\n│ Title:        │ Add Analyze Complexity Button                              │\n│ Priority:     │ high                                                       │\n│ Dependencies: │ None                                                       │\n│ Complexity:   │ N/A                                                        │\n│ Description:  │ Integrate a button to run the analyze-complexity function  │\n│               │ next to the add task button in the task management         │\n│               │ interface.                                                 │\n└───────────────┴────────────────────────────────────────────────────────────┘\n`;
    const result = parseNextTaskOutput(rawOutput);
    assert.equal(result.success, true);
    assert.deepEqual(result, {
      success: true,
      id: 14,
      isSubtask: false,
    });
  });

  it("parses a subtask with no dependencies", () => {
    const rawOutput = `\n\n│ Next Task: #14.1 - Add Analyze Complexity Button │\n┌───────────────┬────────────────────────────────────────────────────────────┐\n│ ID:           │ 14                                                         │\n│ Title:        │ Add Analyze Complexity Button                              │\n│ Priority:     │ high                                                       │\n│ Dependencies: │ None                                                       │\n│ Complexity:   │ N/A                                                        │\n│ Description:  │ Integrate a button to run the analyze-complexity function  │\n│               │ next to the add task button in the task management         │\n│               │ interface.                                                 │\n└───────────────┴────────────────────────────────────────────────────────────┘\n`;
    const result = parseNextTaskOutput(rawOutput);
    assert.equal(result.success, true);
    assert.deepEqual(result, {
      success: true,
      id: "14.1",
      isSubtask: true,
    });
  });
});
