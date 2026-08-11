from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import threading
import urllib.parse
import urllib.request
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

DRAFT_NOTICE = "AI 草稿—须由经办律师复核，不构成最终法律意见"
PROVIDERS = {
    "Codex": ("codex", ("exec", "--sandbox", "workspace-write", "--")),
    "Claude": ("claude", ("--print", "--permission-mode", "acceptEdits", "--")),
}
PROVIDER_LOGIN_ARGS = {"Codex": ("login",), "Claude": ("auth", "login")}
SECRET_PATTERNS = (
    re.compile(r"\b(?:sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._~+/-]{16,})\b", re.IGNORECASE),
    re.compile(r"\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password)\s*[:=]\s*[^\s]+", re.IGNORECASE),
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----"),
)
MAX_INPUT_FILES = 50
MAX_INSTRUCTION_LENGTH = 20_000
SENSITIVE_ENV_NAME = re.compile(r"(?:API[_-]?KEY|ACCESS[_-]?TOKEN|REFRESH[_-]?TOKEN|PASSWORD|COOKIE|SECRET)", re.IGNORECASE)


@dataclass(frozen=True)
class TaskRequest:
    provider: str
    instruction: str
    input_files: tuple[str, ...]
    output_directory: str
    tool_id: str = "basic-work-skills"


@dataclass(frozen=True)
class CatalogTool:
    id: str
    name: str
    category: str
    declared_status: str
    runtime_status: str
    summary: str
    version: str
    repository: str | None
    local_url: str | None
    inputs: tuple[str, ...]
    outputs: tuple[str, ...]
    steps: tuple[str, ...]
    notice: str


def _skill_roots(home: Path) -> tuple[Path, ...]:
    return (home / ".codex" / "skills", home / ".claude" / "skills")


def redact_sensitive(value: object) -> str:
    text = str(value).replace("\0", "")
    for pattern in SECRET_PATTERNS:
        text = pattern.sub("[已隐藏敏感信息]", text)
    return text


def provider_environment(source: dict[str, str] | None = None) -> dict[str, str]:
    """Pass normal desktop context to the official CLI without ambient secrets."""
    return {key: value for key, value in (source or os.environ).items()
            if not SENSITIVE_ENV_NAME.search(key)}


def skill_file(tool_id: str, provider: str, *, home: Path | None = None) -> Path | None:
    base = home or Path.home()
    preferred = base / (".codex" if provider == "Codex" else ".claude") / "skills" / tool_id / "SKILL.md"
    if preferred.is_file():
        return preferred.resolve()
    return next((candidate.resolve() for root in _skill_roots(base)
                 if (candidate := root / tool_id / "SKILL.md").is_file()), None)


def _local_url_reachable(url: str, opener: Callable[..., object] = urllib.request.urlopen) -> bool:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "http" or parsed.hostname != "127.0.0.1" or not parsed.port:
        return False
    try:
        response = opener(url, timeout=0.35)
        close = getattr(response, "close", None)
        if close: close()
        return True
    except Exception:
        return False


def runtime_tool_status(record: dict, *, home: Path | None = None,
                        opener: Callable[..., object] = urllib.request.urlopen) -> str:
    declared = record["status"]
    if declared == "local-skill":
        skill_id = record["id"]
        return "ready" if any((root / skill_id / "SKILL.md").is_file()
                              for root in _skill_roots(home or Path.home())) else "not-installed"
    if record.get("localUrl"):
        return "ready" if _local_url_reachable(record["localUrl"], opener) else "unreachable"
    return "not-installed" if declared == "installable" else "planned"


def load_tool_catalog(data_path: Path | None = None, *, home: Path | None = None,
                      opener: Callable[..., object] = urllib.request.urlopen) -> tuple[CatalogTool, ...]:
    bundle_root = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parents[1]))
    source = data_path or bundle_root / "data" / "tools.json"
    records = json.loads(source.read_text(encoding="utf-8"))
    if not isinstance(records, list):
        raise ValueError("工具目录必须是数组")
    tools: list[CatalogTool] = []
    for record in records:
        required = ("id", "name", "category", "status", "summary", "version",
                    "inputs", "outputs", "steps", "notice")
        if not isinstance(record, dict) or any(key not in record for key in required):
            raise ValueError("工具目录记录不完整")
        tools.append(CatalogTool(
            id=str(record["id"]), name=str(record["name"]), category=str(record["category"]),
            declared_status=str(record["status"]),
            runtime_status=runtime_tool_status(record, home=home, opener=opener),
            summary=str(record["summary"]), version=str(record["version"]),
            repository=record.get("repository"), local_url=record.get("localUrl"),
            inputs=tuple(record["inputs"]), outputs=tuple(record["outputs"]),
            steps=tuple(record["steps"]), notice=str(record["notice"]),
        ))
    if len({tool.id for tool in tools}) != len(tools):
        raise ValueError("工具目录包含重复 ID")
    return tuple(tools)


def validate_request(request: TaskRequest) -> TaskRequest:
    if request.provider not in PROVIDERS:
        raise ValueError("请选择 Codex 或 Claude")
    if not request.instruction.strip() or len(request.instruction) > MAX_INSTRUCTION_LENGTH or "\0" in request.instruction:
        raise ValueError("请输入任务说明")
    if not request.input_files or len(request.input_files) > MAX_INPUT_FILES:
        raise ValueError(f"请选择 1–{MAX_INPUT_FILES} 个输入文件")
    known_tools = {record["id"] for record in _catalog_records()}
    if request.tool_id not in known_tools:
        raise ValueError("请选择已审核的法律工具")
    files = tuple(str(Path(item).resolve(strict=True)) for item in request.input_files)
    if any(not Path(item).is_file() for item in files):
        raise ValueError("输入必须是普通文件")
    output = Path(request.output_directory).resolve()
    if output == Path(output.anchor):
        raise ValueError("成果目录不能是磁盘根目录")
    output.mkdir(parents=True, exist_ok=True)
    return TaskRequest(request.provider, request.instruction.strip(), files, str(output), request.tool_id)


def disclosure(request: TaskRequest) -> str:
    checked = validate_request(request)
    files = "\n".join(f"  • {item}" for item in checked.input_files)
    return (f"提供商：{checked.provider}（使用官方 CLI 已登录账号）\n"
            f"将发送的文件：\n{files}\n输出目录：{checked.output_directory}\n\n"
            "工作台不会读取或保存账号密码、Cookie、Token。确认后才会执行。")


def _catalog_records() -> list[dict]:
    source = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parents[1])) / "data" / "tools.json"
    records = json.loads(source.read_text(encoding="utf-8"))
    if not isinstance(records, list):
        raise ValueError("工具目录必须是数组")
    return records


def provider_command(request: TaskRequest, *, home: Path | None = None) -> tuple[str, list[str]]:
    checked = validate_request(request)
    executable, prefix = PROVIDERS[checked.provider]
    tool = next(record for record in _catalog_records() if record["id"] == checked.tool_id)
    installed_skill = skill_file(checked.tool_id, checked.provider, home=home)
    workflow = (f"请使用本机已安装的法律 Skill `{checked.tool_id}`，先读取并严格遵循：{installed_skill}"
                if installed_skill else
                f"法律工具：{tool['name']}（{checked.tool_id}）。建议步骤：{'；'.join(tool['steps'])}")
    prompt = (f"{workflow}\n\n{checked.instruction}\n\n请读取以下文件：\n" + "\n".join(checked.input_files)
              + f"\n\n请将最终成果写入目录：{checked.output_directory}\n{DRAFT_NOTICE}")
    return executable, [*prefix, prompt]


def provider_login_command(provider: str) -> tuple[str, list[str]]:
    if provider not in PROVIDERS:
        raise ValueError("请选择 Codex 或 Claude")
    return PROVIDERS[provider][0], list(PROVIDER_LOGIN_ARGS[provider])


class TaskRunner:
    def __init__(self, history_path: Path | None = None, *, timeout_seconds: float = 1800) -> None:
        data = Path(os.environ.get("LOCALAPPDATA", Path.home() / ".yu-law")) / "YuLaw"
        self.history_path = history_path or data / "history.json"
        if timeout_seconds <= 0 or timeout_seconds > 86_400:
            raise ValueError("超时时间无效")
        self.timeout_seconds = timeout_seconds
        self._process: subprocess.Popen[str] | None = None
        self._stop_reason: str | None = None
        self._timer: threading.Timer | None = None
        self._kill_timer: threading.Timer | None = None
        self._lock = threading.Lock()

    def provider_available(self, provider: str) -> bool:
        return provider in PROVIDERS and shutil.which(PROVIDERS[provider][0]) is not None

    def launch_login(self, provider: str) -> None:
        executable, argv = provider_login_command(provider)
        if shutil.which(executable) is None:
            raise FileNotFoundError(f"未找到官方 {executable} CLI，请先安装")
        flags = subprocess.CREATE_NEW_CONSOLE if os.name == "nt" else 0
        subprocess.Popen([executable, *argv], shell=False, env=provider_environment(), creationflags=flags)

    def run(self, request: TaskRequest, on_log: Callable[[str], None] = lambda _: None) -> dict:
        checked = validate_request(request)
        executable, argv = provider_command(checked)
        if shutil.which(executable) is None:
            raise FileNotFoundError(f"未找到官方 {executable} CLI；请先安装并登录")
        with self._lock:
            if self._process is not None:
                raise RuntimeError("已有任务正在运行")
            self._process = subprocess.Popen(
                [executable, *argv], cwd=checked.output_directory, shell=False,
                stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace",
                env=provider_environment(),
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
            self._stop_reason = None
            process = self._process
            self._timer = threading.Timer(self.timeout_seconds, self._stop, args=("timed_out", process))
            self._timer.daemon = True
            self._timer.start()
        lines: list[str] = []
        assert self._process.stdout is not None
        for line in self._process.stdout:
            safe = redact_sensitive(line)
            lines.append(safe); on_log(safe)
        code = self._process.wait()
        with self._lock:
            stop_reason = self._stop_reason
            if self._timer: self._timer.cancel()
            if self._kill_timer: self._kill_timer.cancel()
            self._timer = None; self._kill_timer = None; self._process = None; self._stop_reason = None
        status = "completed" if code == 0 and not stop_reason else stop_reason or "failed"
        safe_instruction = redact_sensitive(checked.instruction)
        error_summary = ({"cancelled": "任务已由用户取消", "timed_out": "任务超过时限，已安全终止"}.get(status, "")
                         or ("" if status == "completed" else f"官方 CLI 退出码 {code}"))
        record = {"id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc).isoformat(),
                  **asdict(checked), "instruction": safe_instruction,
                  "input_file_names": [Path(item).name for item in checked.input_files],
                  "status": status, "exit_code": code,
                  "log_summary": "".join(lines[-20:])[-4000:],
                  "error_summary": error_summary,
                  "draft_notice": DRAFT_NOTICE}
        self._append_history(record)
        if status != "completed":
            raise RuntimeError(error_summary or f"官方 CLI 执行失败（退出码 {code}），请检查登录状态后重试")
        return record

    def cancel(self) -> bool:
        with self._lock:
            if self._process is None: return False
            self._stop_reason = "cancelled"
            process = self._process
            process.terminate(); self._arm_force_kill(process); return True

    def _stop(self, reason: str, process: subprocess.Popen[str]) -> None:
        with self._lock:
            if self._process is not process or process.poll() is not None:
                return
            self._stop_reason = reason
            process.terminate()
            self._arm_force_kill(process)

    def _arm_force_kill(self, process: subprocess.Popen[str]) -> None:
        self._kill_timer = threading.Timer(2, self._force_kill, args=(process,))
        self._kill_timer.daemon = True
        self._kill_timer.start()

    def _force_kill(self, process: subprocess.Popen[str]) -> None:
        with self._lock:
            if self._process is process and process.poll() is None:
                process.kill()

    def history(self) -> list[dict]:
        if not self.history_path.exists(): return []
        try:
            value = json.loads(self.history_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return []
        return value if isinstance(value, list) else []

    def filtered_history(self, query: str = "", status: str | None = None) -> list[dict]:
        keyword=query.strip().casefold()
        return [record for record in self.history()
                if (not status or record.get("status")==status)
                and (not keyword or keyword in " ".join((str(record.get("tool_id","")),
                    str(record.get("provider",""))," ".join(record.get("input_file_names",[])),
                    str(record.get("error_summary","")))).casefold())]

    def history_record(self, record_id: str) -> dict:
        record=next((item for item in self.history() if item.get("id")==record_id),None)
        if record is None: raise KeyError("未找到任务记录")
        return record

    def result_directory(self, record_id: str) -> Path:
        target=Path(self.history_record(record_id)["output_directory"]).resolve()
        if not target.is_dir(): raise FileNotFoundError("成果目录不存在")
        return target

    def retry_request(self, record_id: str) -> TaskRequest:
        record=self.history_record(record_id)
        return validate_request(TaskRequest(record["provider"],record["instruction"],
            tuple(record["input_files"]),record["output_directory"],record.get("tool_id","basic-work-skills")))

    def delete_history(self, record_id: str) -> dict:
        records=self.history(); target=next((item for item in records if item.get("id")==record_id),None)
        if target is None: raise KeyError("未找到任务记录")
        self._write_history([item for item in records if item.get("id")!=record_id])
        return {"deleted_record_id":record_id,"files_deleted":False,
                "output_directory":target.get("output_directory")}

    def _append_history(self, record: dict) -> None:
        records = self.history(); records.insert(0, record)
        self._write_history(records)

    def _write_history(self, records: list[dict]) -> None:
        self.history_path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.history_path.with_suffix(".tmp")
        temporary.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
        if os.name != "nt": os.chmod(temporary, 0o600)
        os.replace(temporary, self.history_path)
