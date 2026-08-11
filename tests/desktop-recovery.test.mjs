import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { confirmTaskPreview, createTaskPreview } from "../desktop/security-boundary.mjs";
import { ControlledTaskRunner } from "../desktop/task-runner.mjs";

function confirmed(root) {
  fs.mkdirSync(path.join(root, "out")); fs.writeFileSync(path.join(root, "input.txt"), "x");
  const payload = { provider: "claude", skillId: "legal-memo", instruction: "分析", inputFiles: [path.join(root, "input.txt")], outputDirectory: path.join(root, "out") };
  const secret = "recovery-test-secret-at-least-32-characters";
  return confirmTaskPreview(payload, [root], secret, createTaskPreview(payload, [root], secret).token);
}

function controlledSpawn() {
  const children = [];
  const spawn = () => { const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.kill = (signal) => { queueMicrotask(() => child.emit("close", null, signal)); return true; }; children.push(child); return child; };
  return { spawn, children };
}

test("cancels a running task and permits retry", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "runner-cancel-")); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fake = controlledSpawn(); const runner = new ControlledTaskRunner({ spawn: fake.spawn });
  const pending = runner.run(confirmed(root)); assert.equal(runner.cancel(), true);
  const cancelled = await pending; assert.equal(cancelled.state, "cancelled"); assert.equal(runner.canRetry, true);
  const retry = runner.retry(); queueMicrotask(() => fake.children[1].emit("close", 0, null));
  assert.equal((await retry).state, "succeeded");
});

test("times out and returns an actionable diagnostic", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "runner-timeout-")); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fake = controlledSpawn(); const runner = new ControlledTaskRunner({ spawn: fake.spawn });
  const result = await runner.run(confirmed(root), { timeoutMs: 5 });
  assert.equal(result.state, "timed_out"); assert.match(result.diagnostic, /超过时限/);
});

test("a synchronous spawn failure is diagnosable and retryable", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "runner-spawn-error-")); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runner = new ControlledTaskRunner({ spawn: () => { const error = new Error("ENOENT: codex not found"); error.code = "ENOENT"; throw error; } });
  const result = await runner.run(confirmed(root));
  assert.equal(result.state, "failed"); assert.equal(runner.canRetry, true); assert.match(result.diagnostic, /未找到官方 CLI/);
});
