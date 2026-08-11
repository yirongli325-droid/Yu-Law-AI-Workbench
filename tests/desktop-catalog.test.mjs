import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("desktop shell exposes the complete catalog with runtime-derived status", async () => {
  const [records, core, shell] = await Promise.all([
    readFile(new URL("../data/tools.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../local_app/core.py", import.meta.url), "utf8"),
    readFile(new URL("../local_app/main.py", import.meta.url), "utf8"),
  ]);
  assert.equal(records.length, 20);
  assert.equal(new Set(records.map(({ id }) => id)).size, records.length);
  assert.match(core, /runtime_tool_status/);
  assert.match(core, /127\.0\.0\.1/);
  assert.match(core, /\.codex.*skills/);
  assert.match(shell, /法律工具目录/);
  assert.match(shell, /本机状态/);
  assert.match(shell, /输入：/);
  assert.match(shell, /输出：/);
  assert.match(shell, /步骤：/);
  assert.match(shell, /来源：/);
  assert.match(shell, /提示：/);
});
