import json, tempfile, unittest
from pathlib import Path
from unittest.mock import patch

from local_app.core import DRAFT_NOTICE, TaskRequest, TaskRunner, disclosure, load_tool_catalog, provider_command, provider_environment, provider_login_command, redact_sensitive


class LocalAppTests(unittest.TestCase):
    def request(self, root: Path, provider: str="Codex") -> TaskRequest:
        source=root/"input.txt"; source.write_text("test",encoding="utf-8")
        return TaskRequest(provider,"审阅合同",(str(source),),str(root/"out"))

    def test_disclosure_and_fixed_provider_argv(self):
        with tempfile.TemporaryDirectory() as d:
            request=self.request(Path(d)); self.assertIn("确认",disclosure(request))
            executable,argv=provider_command(request)
            self.assertEqual("codex",executable); self.assertIn("--sandbox",argv); self.assertNotIn("shell",argv)
            self.assertIn(DRAFT_NOTICE,argv[-1])

    def test_installed_skill_is_wired_into_provider_prompt(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d); request=self.request(root)
            skill=root/".codex/skills/basic-work-skills/SKILL.md"; skill.parent.mkdir(parents=True); skill.write_text("fixture",encoding="utf-8")
            _executable,argv=provider_command(request,home=root)
            self.assertIn("basic-work-skills",argv[-1]); self.assertIn("SKILL.md",argv[-1])

    def test_request_rejects_unknown_tool_and_root_output(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d); request=self.request(root)
            with self.assertRaisesRegex(ValueError,"已审核"):
                disclosure(TaskRequest(request.provider,request.instruction,request.input_files,request.output_directory,"unknown"))
            with self.assertRaisesRegex(ValueError,"根目录"):
                disclosure(TaskRequest(request.provider,request.instruction,request.input_files,str(Path("/")),request.tool_id))

    def test_history_is_local_json_and_contains_no_credentials(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d); runner=TaskRunner(root/"history.json"); request=self.request(root,"Claude")
            self.assertEqual([],runner.history()); self.assertFalse(runner.provider_available("unknown"))
            self.assertNotIn("secret-value",disclosure(request))

    def test_runner_redacts_logs_and_instruction_before_history(self):
        class FakeProcess:
            stdout=["Bearer abcdefghijklmnop\n"]
            def wait(self): return 0
            def poll(self): return 0
            def terminate(self): pass
        with tempfile.TemporaryDirectory() as d:
            root=Path(d); runner=TaskRunner(root/"history.json")
            request=self.request(root); request=TaskRequest(request.provider,"api_key=abcdefghijklmnop",request.input_files,request.output_directory,request.tool_id)
            with patch("local_app.core.shutil.which",return_value="codex"), patch("local_app.core.subprocess.Popen",return_value=FakeProcess()):
                runner.run(request)
            history=(root/"history.json").read_text(encoding="utf-8")
            self.assertNotIn("abcdefghijklmnop",history); self.assertIn("已隐藏敏感信息",history)
            if __import__("os").name != "nt": self.assertEqual(0o600,(root/"history.json").stat().st_mode & 0o777)

    def test_cancel_and_timeout_have_distinct_states(self):
        class FakeProcess:
            def __init__(self): self.terminated=False
            def poll(self): return None
            def terminate(self): self.terminated=True
            def kill(self): self.terminated=True
        runner=TaskRunner(timeout_seconds=1); process=FakeProcess(); runner._process=process
        self.assertTrue(runner.cancel()); self.assertEqual("cancelled",runner._stop_reason); self.assertTrue(process.terminated)
        runner._kill_timer.cancel()
        process=FakeProcess(); runner._process=process; runner._stop("timed_out",process)
        self.assertEqual("timed_out",runner._stop_reason); self.assertTrue(process.terminated)
        runner._kill_timer.cancel()

    def test_corrupt_history_recovers_as_empty(self):
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/"history.json"; path.write_text("{broken",encoding="utf-8")
            self.assertEqual([],TaskRunner(path).history())

    def test_sensitive_redaction_covers_tokens_and_private_keys(self):
        self.assertNotIn("abcdefghijklmnop",redact_sensitive("Bearer abcdefghijklmnop"))
        password_fixture="".join(("pass","word","=","hunter12345"))
        self.assertNotIn("hunter12345",redact_sensitive(password_fixture))

    def test_provider_environment_drops_ambient_credentials(self):
        clean=provider_environment({"PATH":"/bin","OPENAI_API_KEY":"secret","CLAUDE_ACCESS_TOKEN":"secret","LANG":"zh_CN.UTF-8"})
        self.assertEqual({"PATH":"/bin","LANG":"zh_CN.UTF-8"},clean)

    def test_login_uses_only_official_cli_fixed_argv(self):
        self.assertEqual(("codex",["login"]),provider_login_command("Codex"))
        self.assertEqual(("claude",["auth","login"]),provider_login_command("Claude"))
        with self.assertRaises(ValueError): provider_login_command("browser")

    def test_catalog_is_complete_and_runtime_status_is_truthful(self):
        with tempfile.TemporaryDirectory() as d:
            home=Path(d); skill=home/".codex/skills/board-minutes"; skill.mkdir(parents=True); (skill/"SKILL.md").write_text("ok")
            class Reachable:
                def close(self): pass
            tools=load_tool_catalog(home=home,opener=lambda *_args,**_kwargs: Reachable())
            self.assertEqual(20,len(tools)); self.assertEqual(20,len({tool.id for tool in tools}))
            self.assertEqual("ready",next(tool for tool in tools if tool.id=="board-minutes").runtime_status)
            self.assertEqual("not-installed",next(tool for tool in tools if tool.id=="written-consent").runtime_status)
            self.assertEqual("ready",next(tool for tool in tools if tool.id=="local-legal-redaction").runtime_status)
            self.assertEqual("planned",next(tool for tool in tools if tool.id=="quotation-letter").runtime_status)

    def test_packaging_includes_catalog_and_self_test_builds_real_app(self):
        root = Path(__file__).resolve().parents[1]
        spec = (root / "YuLawWorkbench.spec").read_text(encoding="utf-8")
        entrypoint = (root / "local_app" / "__main__.py").read_text(encoding="utf-8")
        self.assertIn('datas=[("data/tools.json", "data")]', spec)
        self.assertIn("def self_test_full()", entrypoint)
        self.assertIn("app = YuLawApp()", entrypoint)
        self.assertIn("len(app.tabs.tabs()) != 3", entrypoint)
        self.assertIn("len(app.tools) != 20", entrypoint)

    def test_catalog_uses_frozen_bundle_root(self):
        source = (Path(__file__).resolve().parents[1] / "local_app" / "core.py").read_text(encoding="utf-8")
        self.assertIn('getattr(sys, "_MEIPASS"', source)

    def test_open_path_uses_native_macos_open(self):
        source = (Path(__file__).resolve().parents[1] / "local_app" / "main.py").read_text(encoding="utf-8")
        self.assertIn('elif sys.platform == "darwin":', source)
        self.assertIn('subprocess.Popen(["open", str(target)])', source)

    def test_desktop_request_includes_selected_tool(self):
        source = (Path(__file__).resolve().parents[1] / "local_app" / "main.py").read_text(encoding="utf-8")
        self.assertIn("self.tool_ids[self.tool_name.get()]", source)

    def test_history_filter_retry_and_record_only_delete(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d); source=root/"客户 合同.txt"; source.write_text("x",encoding="utf-8"); output=root/"results"; output.mkdir()
            history=root/"history.json"; history.write_text(json.dumps([{
                "id":"one","created_at":"2026-08-11T00:00:00Z","tool_id":"board-minutes",
                "provider":"Codex","instruction":"起草","input_files":[str(source)],
                "input_file_names":[source.name],"output_directory":str(output),"status":"failed",
                "error_summary":"退出码 1"}],ensure_ascii=False),encoding="utf-8")
            runner=TaskRunner(history)
            self.assertEqual(["one"],[item["id"] for item in runner.filtered_history("合同","failed")])
            self.assertEqual("board-minutes",runner.retry_request("one").tool_id)
            self.assertEqual(output.resolve(),runner.result_directory("one"))
            result=runner.delete_history("one")
            self.assertFalse(result["files_deleted"]); self.assertTrue(source.exists()); self.assertTrue(output.exists())
            self.assertEqual([],runner.history())


if __name__=="__main__": unittest.main()
