import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

export const AI_DRAFT_NOTICE = "AI 草稿—须由经办律师复核，不构成最终法律意见";
export const ALLOWED_PROVIDERS = Object.freeze(["codex", "claude"]);
export const APPROVED_SKILLS = Object.freeze(["contract-review", "legal-memo"]);
const confirmedRequests = new WeakSet();

function plainRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError(`${label} 必须是普通对象`);
  return value;
}

function exactKeys(value, allowed, label) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new TypeError(`${label} 含未知字段: ${unknown.join(", ")}`);
}

function nonEmptyString(value, label, max = 4096) {
  if (typeof value !== "string" || !value.trim() || value.length > max || value.includes("\0")) throw new TypeError(`${label} 无效`);
  return value;
}

export function validateContainedPath(candidate, approvedRoots) {
  nonEmptyString(candidate, "路径");
  if (!path.isAbsolute(candidate)) throw new TypeError("路径必须为绝对路径");
  if (!Array.isArray(approvedRoots) || approvedRoots.length === 0) throw new TypeError("缺少批准的根目录");
  const resolved = path.resolve(candidate);
  const permitted = approvedRoots.some((root) => {
    const normalizedRoot = path.resolve(nonEmptyString(root, "根目录"));
    const relative = path.relative(normalizedRoot, resolved);
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  });
  if (!permitted) throw new RangeError("路径超出批准的本地目录");
  return resolved;
}

export function validateExistingContainedPath(candidate, approvedRoots) {
  const lexicalPath = validateContainedPath(candidate, approvedRoots);
  const realCandidate = fs.realpathSync(lexicalPath);
  const realRoots = approvedRoots.map((root) => fs.realpathSync(path.resolve(root)));
  return validateContainedPath(realCandidate, realRoots);
}

function validateCreationPath(candidate, approvedRoots) {
  const lexicalPath = validateContainedPath(candidate, approvedRoots);
  let ancestor = lexicalPath;
  while (!fs.existsSync(ancestor)) {
    const parent = path.dirname(ancestor);
    if (parent === ancestor) throw new RangeError("找不到可验证的父目录");
    ancestor = parent;
  }
  validateExistingContainedPath(ancestor, approvedRoots);
  return lexicalPath;
}

export function validateTaskRequest(payload, approvedRoots) {
  const request = plainRecord(payload, "任务请求");
  exactKeys(request, ["provider", "skillId", "instruction", "inputFiles", "outputDirectory", "confirmed"], "任务请求");
  if (!ALLOWED_PROVIDERS.includes(request.provider)) throw new TypeError("不支持的提供商");
  if (!APPROVED_SKILLS.includes(nonEmptyString(request.skillId, "Skill ID", 64))) throw new TypeError("Skill 未经审核或不在允许列表");
  nonEmptyString(request.instruction, "任务说明", 20000);
  if (!Array.isArray(request.inputFiles) || request.inputFiles.length === 0 || request.inputFiles.length > 50) throw new TypeError("输入文件无效");
  if (request.confirmed !== true) throw new TypeError("模型调用必须由用户明确确认");
  const inputFiles = request.inputFiles.map((file) => {
    const safePath = validateExistingContainedPath(file, approvedRoots);
    if (!fs.statSync(safePath).isFile()) throw new TypeError("输入必须是已存在的普通文件");
    return safePath;
  });
  const validated = Object.freeze({ ...request, inputFiles: Object.freeze(inputFiles), outputDirectory: validateCreationPath(request.outputDirectory, approvedRoots) });
  return validated;
}

export function createDisclosure(request) {
  return Object.freeze({ skillId: request.skillId, provider: request.provider === "codex" ? "OpenAI Codex CLI" : "Anthropic Claude Code CLI", filesToSend: Object.freeze([...request.inputFiles]), outputDirectory: request.outputDirectory, privacyNotice: "以下文件将发送给所选提供商处理；请先确认不含无关的客户秘密。", requiresExplicitConfirmation: true });
}

export function labelAiDraft(content) {
  const body = typeof content === "string" ? content : JSON.stringify(content, null, 2);
  return `${AI_DRAFT_NOTICE}\n\n${body}`;
}

export function writeAiDraftResult(file, content, approvedRoots) {
  const target = validateCreationPath(file, approvedRoots);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, labelAiDraft(content), { encoding: "utf8", flag: "wx" });
  return target;
}

export function createTaskPreview(payload, approvedRoots, serverSecret) {
  if (typeof serverSecret !== "string" || serverSecret.length < 32) throw new TypeError("服务端确认密钥无效");
  const request = validateTaskRequest({ ...payload, confirmed: true }, approvedRoots);
  const canonical = JSON.stringify(request);
  return Object.freeze({ disclosure: createDisclosure(request), token: crypto.createHmac("sha256", serverSecret).update(canonical).digest("hex") });
}

export function confirmTaskPreview(payload, approvedRoots, serverSecret, token) {
  const request = validateTaskRequest({ ...payload, confirmed: true }, approvedRoots);
  const expected = crypto.createHmac("sha256", serverSecret).update(JSON.stringify(request)).digest("hex");
  if (typeof token !== "string" || token.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) throw new TypeError("确认内容已变更，请重新预览");
  confirmedRequests.add(request);
  return request;
}

export function buildProviderInvocation(request) {
  if (!confirmedRequests.has(request) || request.confirmed !== true) throw new TypeError("只能执行已预览、校验并明确确认的任务请求");
  const prompt = `${request.instruction}\n\n输入文件：\n${request.inputFiles.join("\n")}\n输出目录：${request.outputDirectory}`;
  if (request.provider === "codex") return Object.freeze({ executable: "codex", args: Object.freeze(["exec", "--sandbox", "read-only", "--", prompt]), cwd: request.outputDirectory, shell: false });
  return Object.freeze({ executable: "claude", args: Object.freeze(["--print", "--tools", "", "--permission-mode", "plan", "--", prompt]), cwd: request.outputDirectory, shell: false });
}

export function assertSafeDesktopPreferences(preferences) {
  const prefs = plainRecord(preferences, "webPreferences");
  if (prefs.nodeIntegration !== false || prefs.contextIsolation !== true || prefs.sandbox !== true || prefs.webSecurity === false) throw new TypeError("桌面窗口必须启用隔离与沙箱，且不得向页面暴露 Node.js");
  return true;
}

export function validateIpcEnvelope(envelope, approvedRoots) {
  const value = plainRecord(envelope, "IPC 消息");
  exactKeys(value, ["version", "requestId", "action", "payload"], "IPC 消息");
  if (value.version !== 1) throw new TypeError("IPC 版本无效");
  if (!/^[a-f0-9-]{16,64}$/i.test(nonEmptyString(value.requestId, "requestId", 64))) throw new TypeError("requestId 无效");
  if (value.action !== "task.preview" && value.action !== "task.run") throw new TypeError("IPC action 不在允许列表");
  if (!Array.isArray(approvedRoots) || approvedRoots.length === 0) throw new TypeError("IPC 校验必须提供批准的根目录");
  plainRecord(value.payload, "IPC payload");
  validateTaskRequest(value.payload, approvedRoots);
  return value;
}
