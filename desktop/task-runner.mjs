import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { spawn as nodeSpawn } from "node:child_process";
import { buildProviderInvocation } from "./security-boundary.mjs";

const SECRET_PATTERNS = [
  /\b(?:sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._~+\/-]{16,})\b/gi,
  /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password)\s*[:=]\s*[^\s]+/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

export function redactLog(value) {
  let text = String(value).replace(/\0/g, "");
  for (const pattern of SECRET_PATTERNS) text = text.replace(pattern, "[已隐藏敏感信息]");
  return text;
}

export function diagnoseFailure({ code, signal, timedOut, cancelled, stderr = "" }) {
  if (timedOut) return "任务超过时限，已安全终止；可增加时限后重试。";
  if (cancelled) return "任务已由用户取消，可检查输入后重试。";
  if (code === 127 || /(?:not found|ENOENT)/i.test(stderr)) return "未找到官方 CLI，请确认已安装并登录。";
  if (/(?:unauthorized|login|authentication|credential)/i.test(stderr)) return "提供商未登录或登录已失效，请先通过官方 CLI 登录。";
  return `提供商进程失败（退出码 ${code ?? "未知"}${signal ? `，信号 ${signal}` : ""}），请查看安全日志后重试。`;
}

function listFiles(root) {
  if (!fs.existsSync(root)) return [];
  const results = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile()) results.push(target);
    }
  };
  visit(root);
  return results.sort();
}

export class ControlledTaskRunner extends EventEmitter {
  #spawn;
  #child = null;
  #timer = null;
  #killTimer = null;
  #lastRequest = null;
  #state = "idle";

  constructor({ spawn = nodeSpawn } = {}) {
    super();
    if (typeof spawn !== "function") throw new TypeError("spawn 必须是函数");
    this.#spawn = spawn;
  }

  get state() { return this.#state; }
  get canRetry() { return this.#state === "failed" || this.#state === "cancelled" || this.#state === "timed_out"; }

  run(confirmedRequest, { timeoutMs = 300_000 } = {}) {
    if (this.#state === "running") throw new Error("已有任务正在执行");
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 86_400_000) throw new TypeError("超时时间无效");
    const invocation = buildProviderInvocation(confirmedRequest);
    fs.mkdirSync(invocation.cwd, { recursive: true });
    const before = new Set(listFiles(invocation.cwd));
    this.#lastRequest = confirmedRequest;
    this.#state = "running";
    this.emit("status", { state: "running", provider: confirmedRequest.provider, skillId: confirmedRequest.skillId });

    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      let settled = false;
      let stopCause = null;
      let child;
      try {
        child = this.#spawn(invocation.executable, [...invocation.args], {
          cwd: invocation.cwd,
          shell: false,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        });
      } catch (error) {
        this.#state = "failed";
        const safeError = redactLog(error?.message ?? error);
        const result = Object.freeze({ state: "failed", code: null, signal: null, stdout, stderr: safeError, artifacts: Object.freeze([]), diagnostic: diagnoseFailure({ code: null, stderr: safeError }) });
        this.emit("status", result);
        resolve(result);
        return;
      }
      this.#child = child;
      const log = (stream, chunk) => {
        const safe = redactLog(chunk);
        if (stream === "stdout") stdout += safe; else stderr += safe;
        this.emit("log", { stream, text: safe });
      };
      child.stdout?.on("data", (chunk) => log("stdout", chunk));
      child.stderr?.on("data", (chunk) => log("stderr", chunk));
      const onCancel = () => {
        if (settled || stopCause) return;
        stopCause = "cancelled";
        clearTimeout(this.#timer);
        child.kill("SIGTERM");
        this.#killTimer = setTimeout(() => { if (!settled) child.kill("SIGKILL"); }, 2_000);
        this.#killTimer.unref?.();
      };
      const finish = (code, signal, spawnError) => {
        if (settled) return;
        settled = true;
        clearTimeout(this.#timer);
        clearTimeout(this.#killTimer);
        this.#timer = null;
        this.#killTimer = null;
        this.#child = null;
        this.off("cancel-requested", onCancel);
        if (spawnError) stderr += redactLog(spawnError.message);
        const artifacts = listFiles(invocation.cwd).filter((file) => !before.has(file));
        const succeeded = !spawnError && code === 0 && !stopCause;
        this.#state = succeeded ? "succeeded" : stopCause ?? "failed";
        const result = Object.freeze({ state: this.#state, code, signal, stdout, stderr, artifacts: Object.freeze(artifacts), diagnostic: succeeded ? null : diagnoseFailure({ code, signal, timedOut: stopCause === "timed_out", cancelled: stopCause === "cancelled", stderr }) });
        this.emit("status", result);
        resolve(result);
      };
      child.once("error", (error) => finish(null, null, error));
      child.once("close", (code, signal) => finish(code, signal, null));
      this.#timer = setTimeout(() => {
        if (settled || stopCause) return;
        stopCause = "timed_out";
        child.kill("SIGTERM");
        this.#killTimer = setTimeout(() => { if (!settled) child.kill("SIGKILL"); }, 2_000);
        this.#killTimer.unref?.();
      }, timeoutMs);
      this.once("cancel-requested", onCancel);
    });
  }

  cancel() {
    if (this.#state !== "running" || !this.#child) return false;
    this.emit("cancel-requested");
    return true;
  }

  retry(options) {
    if (!this.canRetry || !this.#lastRequest) throw new Error("当前任务不可重试");
    return this.run(this.#lastRequest, options);
  }
}

export function openableArtifacts(result) {
  if (!result || result.state !== "succeeded" || !Array.isArray(result.artifacts)) return [];
  return result.artifacts.filter((file) => fs.existsSync(file) && fs.statSync(file).isFile());
}
