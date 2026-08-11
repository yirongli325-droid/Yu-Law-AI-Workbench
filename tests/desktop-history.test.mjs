import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("desktop history exposes the required safe actions", async () => {
  const [core, shell] = await Promise.all([
    readFile(new URL("../local_app/core.py", import.meta.url), "utf8"),
    readFile(new URL("../local_app/main.py", import.meta.url), "utf8"),
  ]);
  for (const method of ["filtered_history", "result_directory", "retry_request", "delete_history"]) {
    assert.match(core, new RegExp(`def ${method}\\(`));
  }
  assert.match(core, /"files_deleted":False/);
  for (const label of ["任务历史", "打开成果目录", "复制错误摘要", "重试", "删除记录", "不会删除原始文件或成果"]) {
    assert.match(shell, new RegExp(label));
  }
});
