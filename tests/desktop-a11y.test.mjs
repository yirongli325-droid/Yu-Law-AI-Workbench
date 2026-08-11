import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Windows shell exposes named keyboard-operable primary flows", async () => {
  const shell = await readFile(new URL("../local_app/main.py", import.meta.url), "utf8");
  for (const tab of ["新建任务", "法律工具目录", "任务历史"]) assert.match(shell, new RegExp(tab));
  for (const shortcut of ["<Alt-Key-1>", "<Alt-Key-2>", "<Alt-Key-3>", "<Control-o>", "<Control-Return>"]) {
    assert.match(shell, new RegExp(shortcut.replace(/[<>]/g, "\\$&")));
  }
  for (const label of ["提供商", "选择材料", "任务说明", "成果目录", "预览并确认执行", "取消任务"]) {
    assert.match(shell, new RegExp(label));
  }
  assert.match(shell, /for name in \("Codex","Claude"\)/);
  assert.match(shell, /'可用'.*'未安装'/);
  assert.match(shell, /messagebox\.askyesno\("发送前确认"/);
  assert.doesNotMatch(shell, /overrideredirect\(True\)|attributes\("-disabled"/);
});
