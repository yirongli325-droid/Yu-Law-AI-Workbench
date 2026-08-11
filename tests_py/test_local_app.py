import json, tempfile, unittest
from pathlib import Path
from unittest.mock import patch

from local_app.core import DRAFT_NOTICE, TaskRequest, TaskRunner, disclosure, load_tool_catalog, provider_command


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

    def test_history_is_local_json_and_contains_no_credentials(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d); runner=TaskRunner(root/"history.json"); request=self.request(root,"Claude")
            self.assertEqual([],runner.history()); self.assertFalse(runner.provider_available("unknown"))
            self.assertNotIn("secret-value",disclosure(request))

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
        self.assertIn("app = YuLawApp()", entrypoint)

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
