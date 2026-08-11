import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { EventEmitter } from "node:events";
import { AI_DRAFT_NOTICE, buildProviderInvocation, confirmTaskPreview, createTaskPreview, writeAiDraftResult } from "../desktop/security-boundary.mjs";
import { ControlledTaskRunner, openableArtifacts } from "../desktop/task-runner.mjs";

test("lawyer previews the exact provider and files before a controlled first task", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "yu-law-e2e-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, "案情.pdf"), "fixture");
  const payload = { provider: "claude", skillId: "legal-memo", instruction: "形成备忘录", inputFiles: [path.join(root, "案情.pdf")], outputDirectory: path.join(root, "results") };
  const secret = "server-owned-confirmation-secret-123456";
  const preview = createTaskPreview(payload, [root], secret);
  assert.deepEqual(preview.disclosure.filesToSend, [path.join(root, "案情.pdf")]);
  const request = confirmTaskPreview(payload, [root], secret, preview.token);
  const command = buildProviderInvocation(request);
  assert.deepEqual([command.executable, command.shell], ["claude", false]);
  assert.deepEqual(command.args.slice(0, 5), ["--print", "--tools", "", "--permission-mode", "plan"]);
  const result = writeAiDraftResult(path.join(root, "results", "memo.md"), "初步分析", [root]);
  assert.match(fs.readFileSync(result, "utf8"), new RegExp(`^${AI_DRAFT_NOTICE}`));
});

for (const provider of ["codex", "claude"]) {
  test(`installed legal Skill completes through ${provider} and generates a local result`, async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `yu-law-${provider}-`));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.writeFileSync(path.join(root, "客户 材料.txt"), "fixture");
    const payload = { provider, skillId: "legal-memo", instruction: "生成法律备忘录", inputFiles: [path.join(root, "客户 材料.txt")], outputDirectory: path.join(root, "本地成果") };
    const secret = "e2e-provider-secret-at-least-32-characters";
    const preview = createTaskPreview(payload, [root], secret);
    assert.equal(preview.disclosure.skillId, "legal-memo");
    assert.match(preview.disclosure.privacyNotice, /发送给所选提供商/);
    const request = confirmTaskPreview(payload, [root], secret, preview.token);
    const spawn = (executable, args, options) => {
      const child = new EventEmitter();
      child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.kill = () => true;
      queueMicrotask(() => {
        assert.equal(executable, provider);
        assert.equal(options.shell, false);
        assert.equal(args.includes("生成法律备忘录"), false);
        writeAiDraftResult(path.join(options.cwd, `${provider}-memo.md`), "本地成果", [root]);
        child.emit("close", 0, null);
      });
      return child;
    };
    const result = await new ControlledTaskRunner({ spawn }).run(request);
    assert.equal(result.state, "succeeded");
    assert.deepEqual(openableArtifacts(result), [path.join(root, "本地成果", `${provider}-memo.md`)]);
    assert.match(fs.readFileSync(result.artifacts[0], "utf8"), new RegExp(`^${AI_DRAFT_NOTICE}`));
  });
}
