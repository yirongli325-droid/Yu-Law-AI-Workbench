import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { AI_DRAFT_NOTICE, assertSafeDesktopPreferences, buildProviderInvocation, confirmTaskPreview, createDisclosure, createTaskPreview, labelAiDraft, validateContainedPath, validateExistingContainedPath, validateIpcEnvelope, validateTaskRequest, writeAiDraftResult } from "../desktop/security-boundary.mjs";
import { scanText } from "../desktop/credential-scan.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "yu-law-task-"));
fs.mkdirSync(path.join(root, "成果"));
fs.writeFileSync(path.join(root, "合同 $(x).docx"), "fixture");
const valid = { provider: "codex", skillId: "contract-review", instruction: "审阅合同；$(touch /tmp/no)", inputFiles: [path.join(root, "合同 $(x).docx")], outputDirectory: path.join(root, "成果"), confirmed: true };
process.on("exit", () => fs.rmSync(root, { recursive: true, force: true }));

test("renderer is sandboxed and IPC messages have an exact schema", () => {
  assert.equal(assertSafeDesktopPreferences({ nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true }), true);
  assert.throws(() => assertSafeDesktopPreferences({ nodeIntegration: true, contextIsolation: true, sandbox: true }));
  assert.equal(validateIpcEnvelope({ version: 1, requestId: "12345678-1234-1234", action: "task.preview", payload: valid }, [root]).action, "task.preview");
  assert.throws(() => validateIpcEnvelope({ version: 1, requestId: "12345678-1234-1234", action: "task.preview", payload: valid }));
  assert.throws(() => validateIpcEnvelope({ version: 1, requestId: "12345678-1234-1234", action: "shell.exec", payload: {} }));
  assert.throws(() => validateIpcEnvelope({ version: 1, requestId: "12345678-1234-1234", action: "task.run", payload: { ...valid, outputDirectory: path.resolve(root, "../escape") } }, [root]));
});

test("task schema and approved roots reject traversal, relative paths, unknown keys, and missing consent", () => {
  assert.equal(validateTaskRequest(valid, [root]).provider, "codex");
  assert.throws(() => validateContainedPath(path.resolve(root, "../secret"), [root]));
  assert.throws(() => validateContainedPath("relative/file", [root]));
  assert.throws(() => validateTaskRequest({ ...valid, confirmed: false }, [root]));
  assert.throws(() => validateTaskRequest({ ...valid, command: "npm install" }, [root]));
  assert.throws(() => validateTaskRequest({ ...valid, skillId: "download-and-run" }, [root]));
});

test("existing-path validation rejects a symlink escape", (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "yu-law-security-"));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const approved = path.join(temporary, "approved");
  const outside = path.join(temporary, "outside");
  fs.mkdirSync(approved);
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, "secret.txt"), "not a credential");
  fs.symlinkSync(path.join(outside, "secret.txt"), path.join(approved, "linked.txt"));
  assert.throws(() => validateExistingContainedPath(path.join(approved, "linked.txt"), [approved]));
});

test("only official provider executables use fixed argv and never a shell", () => {
  const payload = { ...valid };
  delete payload.confirmed;
  const secret = "server-owned-confirmation-secret-123456";
  const invocation = buildProviderInvocation(confirmTaskPreview(payload, [root], secret, createTaskPreview(payload, [root], secret).token));
  assert.deepEqual({ executable: invocation.executable, shell: invocation.shell }, { executable: "codex", shell: false });
  assert.equal(invocation.args.includes("sh"), false);
  assert.match(invocation.args.at(-1), /\$\(touch \/tmp\/no\)/);
  assert.throws(() => buildProviderInvocation(validateTaskRequest(valid, [root])));
  assert.throws(() => buildProviderInvocation({ ...valid }));
  assert.throws(() => buildProviderInvocation({ ...valid, provider: "not-allowed" }));
  assert.throws(() => validateTaskRequest({ ...valid, provider: "npm" }, [root]));
});

test("disclosure names provider and files and every result receives the legal draft label", () => {
  const disclosure = createDisclosure(validateTaskRequest(valid, [root]));
  assert.equal(disclosure.provider, "OpenAI Codex CLI");
  assert.deepEqual(disclosure.filesToSend, [valid.inputFiles[0]]);
  assert.equal(disclosure.requiresExplicitConfirmation, true);
  assert.ok(labelAiDraft("分析").startsWith(AI_DRAFT_NOTICE));
  const result = writeAiDraftResult(path.join(root, "成果", "result.md"), "分析", [root]);
  assert.ok(fs.readFileSync(result, "utf8").startsWith(AI_DRAFT_NOTICE));
});

test("server token binds confirmation to the exact preview", () => {
  const secret = "server-owned-confirmation-secret-123456";
  const payload = { ...valid };
  delete payload.confirmed;
  const preview = createTaskPreview(payload, [root], secret);
  assert.deepEqual(preview.disclosure.filesToSend, valid.inputFiles);
  assert.equal(confirmTaskPreview(payload, [root], secret, preview.token).confirmed, true);
  assert.throws(() => confirmTaskPreview({ ...payload, provider: "claude" }, [root], secret, preview.token));
});

test("credential detector covers tokens, cookies, passwords, and private keys", () => {
  assert.deepEqual(scanText("normal legal text"), []);
  assert.deepEqual(scanText("const inputTypes={password:!0,range:!0}"), []);
  assert.ok(scanText(["Authorization", "Bearer", "abcdefghijklmnopqrstuvwxyz"].join(": ").replace(": Bearer:", ": Bearer")).includes("authorization bearer"));
  assert.ok(scanText(["Cookie", "auth", "abcdefghijklmnop"].join(":").replace(":auth:", ": auth=")).includes("session cookie"));
  assert.ok(scanText(["pass", "word", "hunter12345"].join("").replace("wordhunter", "word=hunter")).includes("account password"));
  assert.ok(scanText(["-----BEGIN RSA ", "PRIVATE KEY-----"].join("")).includes("private key"));
  assert.ok(scanText(["sk-", "abcdefghijklmnopqrstuvwxyz"].join("")).includes("provider token"));
  assert.ok(scanText(["refresh", "token", "1//abcdefghijklmnopqrstuvwxyz"].join("_").replace("_1//", "=1//")).includes("oauth token"));
  assert.ok(scanText(["oauth", "token", "abcdefghijklmnopqrstuvwxyz"].join("_").replace("_abcdefghijklmnopqrstuvwxyz", "=abcdefghijklmnopqrstuvwxyz")).includes("oauth token"));
  assert.ok(scanText(["Coo", "kie: JSESSION", "ID=abcdefghijklmnop"].join("")).includes("session cookie"));
});
