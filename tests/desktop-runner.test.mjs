import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { confirmTaskPreview, createTaskPreview } from "../desktop/security-boundary.mjs";
import { ControlledTaskRunner, openableArtifacts, redactLog } from "../desktop/task-runner.mjs";

function request(root, provider = "codex") {
  fs.mkdirSync(path.join(root, "输出"), { recursive: true });
  fs.writeFileSync(path.join(root, "合同 $(别执行).txt"), "fixture");
  const payload = { provider, skillId: "contract-review", instruction: "中文；$(touch /tmp/不应执行) & 空格", inputFiles: [path.join(root, "合同 $(别执行).txt")], outputDirectory: path.join(root, "输出") };
  const secret = "runner-test-secret-at-least-32-characters";
  return confirmTaskPreview(payload, [root], secret, createTaskPreview(payload, [root], secret).token);
}

function fakeSpawn(handler) {
  return (executable, args, options) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = (signal) => { child.killedWith = signal; queueMicrotask(() => child.emit("close", null, signal)); return true; };
    queueMicrotask(() => handler({ child, executable, args, options }));
    return child;
  };
}

test("uses executable plus argv with shell disabled and preserves special characters", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "runner-contract-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  let observed;
  const runner = new ControlledTaskRunner({ spawn: fakeSpawn((call) => { observed = call; fs.writeFileSync(path.join(call.options.cwd, "成果.md"), "ok"); call.child.stdout.emit("data", "完成"); call.child.emit("close", 0, null); }) });
  const result = await runner.run(request(root));
  assert.equal(observed.options.shell, false);
  assert.equal(Array.isArray(observed.args), true);
  assert.match(observed.args.at(-1), /\$\(touch \/tmp\/不应执行\)/);
  assert.equal(result.state, "succeeded");
  assert.deepEqual(openableArtifacts(result), [path.join(root, "输出", "成果.md")]);
});

test("emits redacted live logs", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "runner-log-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const logs = [];
  const runner = new ControlledTaskRunner({ spawn: fakeSpawn(({ child }) => { child.stderr.emit("data", "api_key=abcdefghijklmnop secret context"); child.emit("close", 1, null); }) });
  runner.on("log", (event) => logs.push(event.text));
  const result = await runner.run(request(root));
  assert.equal(result.state, "failed");
  assert.equal(logs.join("").includes("abcdefghijklmnop"), false);
  assert.match(redactLog("Bearer abcdefghijklmnop"), /已隐藏/);
});
