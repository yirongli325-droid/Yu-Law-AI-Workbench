from __future__ import annotations

import os
import subprocess
import sys
import threading
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

from .core import CatalogTool, DRAFT_NOTICE, TaskRequest, TaskRunner, disclosure, load_tool_catalog


class YuLawApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__(); self.title("Yu Law 本地 AI 工作台"); self.geometry("860x650"); self.minsize(720, 540)
        self.runner=TaskRunner(); self.files: list[str]=[]; self.tools=load_tool_catalog()
        self.provider=tk.StringVar(value="Codex"); self.output=tk.StringVar(value=str(Path.home()/"Documents"/"YuLaw"))
        self.tool_name=tk.StringVar(value=self.tools[0].name)
        self.tool_ids={tool.name:tool.id for tool in self.tools}
        self.status=tk.StringVar(value="就绪｜请先通过官方 Codex 或 Claude CLI 登录")
        self._build(); self._bind_shortcuts()

    def _build(self) -> None:
        root=ttk.Frame(self,padding=18); root.pack(fill="both",expand=True)
        ttk.Label(root,text="Yu Law 本地 AI 工作台",font=("Microsoft YaHei UI",20,"bold")).pack(anchor="w")
        ttk.Label(root,text="本地选择材料，明确确认后调用已登录的官方 CLI。不会保存账号凭据。",foreground="#475569").pack(anchor="w",pady=(4,16))
        self.tabs=ttk.Notebook(root); self.tabs.pack(fill="both",expand=True)
        task=ttk.Frame(self.tabs,padding=(0,12,0,0)); catalog=ttk.Frame(self.tabs,padding=(0,12,0,0)); history=ttk.Frame(self.tabs,padding=(0,12,0,0))
        self.tabs.add(task,text="新建任务"); self.tabs.add(catalog,text="法律工具目录"); self.tabs.add(history,text="任务历史")
        row=ttk.Frame(task); row.pack(fill="x"); ttk.Label(row,text="提供商").pack(side="left")
        ttk.Combobox(row,textvariable=self.provider,values=("Codex","Claude"),state="readonly",width=16).pack(side="left",padx=10)
        provider_state="｜".join(f"{name}: {'可用' if self.runner.provider_available(name) else '未安装'}" for name in ("Codex","Claude"))
        ttk.Label(row,text=provider_state).pack(side="left",padx=8)
        ttk.Button(row,text="登录",command=self._login).pack(side="left",padx=4)
        tool_row=ttk.Frame(task); tool_row.pack(fill="x",pady=(10,0)); ttk.Label(tool_row,text="法律工具").pack(side="left")
        ttk.Combobox(tool_row,textvariable=self.tool_name,values=tuple(self.tool_ids),state="readonly",width=28).pack(side="left",padx=10)
        ttk.Button(tool_row,text="选择材料",command=self._files).pack(side="left",padx=6)
        self.file_label=ttk.Label(tool_row,text="尚未选择"); self.file_label.pack(side="left",padx=8)
        ttk.Label(task,text="任务说明").pack(anchor="w",pady=(16,4)); self.instruction=tk.Text(task,height=8,wrap="word"); self.instruction.pack(fill="x")
        out=ttk.Frame(task); out.pack(fill="x",pady=12); ttk.Label(out,text="成果目录").pack(side="left")
        ttk.Entry(out,textvariable=self.output).pack(side="left",fill="x",expand=True,padx=10); ttk.Button(out,text="选择",command=self._output).pack(side="left")
        actions=ttk.Frame(task); actions.pack(fill="x"); ttk.Button(actions,text="预览并确认执行",command=self._confirm).pack(side="left")
        ttk.Button(actions,text="取消任务",command=self.runner.cancel).pack(side="left",padx=8); ttk.Button(actions,text="打开成果目录",command=self._open_output).pack(side="left")
        ttk.Label(task,textvariable=self.status).pack(anchor="w",pady=(14,4)); self.log=tk.Text(task,height=13,state="disabled",wrap="word"); self.log.pack(fill="both",expand=True)
        ttk.Label(task,text=DRAFT_NOTICE,foreground="#b45309").pack(anchor="w",pady=(10,0))
        self._build_catalog(catalog)
        self._build_history(history)

    def _bind_shortcuts(self) -> None:
        self.bind_all("<Alt-Key-1>",lambda _event:self.tabs.select(0))
        self.bind_all("<Alt-Key-2>",lambda _event:self.tabs.select(1))
        self.bind_all("<Alt-Key-3>",lambda _event:self.tabs.select(2))
        self.bind_all("<Control-o>",lambda _event:self._files())
        self.bind_all("<Control-Return>",lambda _event:self._confirm())

    def _build_catalog(self, parent: ttk.Frame) -> None:
        filters=ttk.Frame(parent); filters.pack(fill="x")
        ttk.Label(filters,text="分类 / 关键字").pack(side="left")
        self.catalog_query=tk.StringVar(); entry=ttk.Entry(filters,textvariable=self.catalog_query); entry.pack(side="left",fill="x",expand=True,padx=8)
        ttk.Button(filters,text="筛选",command=self._refresh_catalog).pack(side="left")
        columns=("category","status","version")
        self.catalog_tree=ttk.Treeview(parent,columns=columns,show="tree headings",height=12)
        self.catalog_tree.heading("#0",text="工具"); self.catalog_tree.heading("category",text="分类")
        self.catalog_tree.heading("status",text="本机状态"); self.catalog_tree.heading("version",text="版本")
        self.catalog_tree.pack(fill="both",expand=True,pady=8); self.catalog_tree.bind("<<TreeviewSelect>>",self._catalog_selected)
        self.catalog_detail=tk.Text(parent,height=9,state="disabled",wrap="word"); self.catalog_detail.pack(fill="x")
        self._refresh_catalog()

    def _refresh_catalog(self) -> None:
        query=self.catalog_query.get().strip().casefold()
        self.catalog_tree.delete(*self.catalog_tree.get_children())
        for tool in self.tools:
            haystack=" ".join((tool.name,tool.category,tool.summary,*tool.inputs,*tool.outputs)).casefold()
            if query and query not in haystack: continue
            self.catalog_tree.insert("", "end", iid=tool.id, text=tool.name,
                values=(tool.category,tool.runtime_status,tool.version))

    def _catalog_selected(self, _event: object) -> None:
        selected=self.catalog_tree.selection()
        if not selected: return
        tool=next(item for item in self.tools if item.id==selected[0])
        detail=(f"{tool.summary}\n\n输入：{'、'.join(tool.inputs)}\n输出：{'、'.join(tool.outputs)}\n"
                f"步骤：{'；'.join(tool.steps)}\n来源：{tool.repository or '本地规划'}\n提示：{tool.notice}")
        self.catalog_detail.config(state="normal"); self.catalog_detail.delete("1.0","end")
        self.catalog_detail.insert("1.0",detail); self.catalog_detail.config(state="disabled")

    def _build_history(self, parent: ttk.Frame) -> None:
        filters=ttk.Frame(parent); filters.pack(fill="x")
        self.history_query=tk.StringVar(); self.history_status=tk.StringVar(value="全部")
        ttk.Entry(filters,textvariable=self.history_query).pack(side="left",fill="x",expand=True)
        ttk.Combobox(filters,textvariable=self.history_status,values=("全部","completed","failed"),state="readonly",width=12).pack(side="left",padx=8)
        ttk.Button(filters,text="筛选",command=self._refresh_history).pack(side="left")
        self.history_tree=ttk.Treeview(parent,columns=("time","provider","status","files"),show="tree headings",height=14)
        for key,label in (("#0","工具"),("time","时间"),("provider","提供商"),("status","状态"),("files","输入文件")): self.history_tree.heading(key,text=label)
        self.history_tree.pack(fill="both",expand=True,pady=8)
        actions=ttk.Frame(parent); actions.pack(fill="x")
        ttk.Button(actions,text="打开成果目录",command=self._history_open).pack(side="left")
        ttk.Button(actions,text="复制错误摘要",command=self._history_copy_error).pack(side="left",padx=6)
        ttk.Button(actions,text="重试",command=self._history_retry).pack(side="left")
        ttk.Button(actions,text="删除记录",command=self._history_delete).pack(side="left",padx=6)
        ttk.Label(actions,text="删除记录不会删除原始文件或成果").pack(side="left",padx=8)
        self._refresh_history()

    def _selected_history_id(self) -> str:
        selected=self.history_tree.selection()
        if not selected: raise ValueError("请先选择一条任务记录")
        return selected[0]

    def _refresh_history(self) -> None:
        self.history_tree.delete(*self.history_tree.get_children())
        status=None if self.history_status.get()=="全部" else self.history_status.get()
        for record in self.runner.filtered_history(self.history_query.get(),status):
            self.history_tree.insert("","end",iid=record["id"],text=record.get("tool_id","法律任务"),
                values=(record.get("created_at",""),record.get("provider",""),record.get("status",""),"、".join(record.get("input_file_names",[]))))

    def _history_open(self) -> None:
        try: target=self.runner.result_directory(self._selected_history_id())
        except Exception as error: messagebox.showerror("无法打开",str(error)); return
        self._open_path(target)

    def _history_copy_error(self) -> None:
        try: summary=self.runner.history_record(self._selected_history_id()).get("error_summary","")
        except Exception as error: messagebox.showerror("无法复制",str(error)); return
        self.clipboard_clear(); self.clipboard_append(summary or "该任务没有错误摘要")

    def _history_retry(self) -> None:
        try: request=self.runner.retry_request(self._selected_history_id())
        except Exception as error: messagebox.showerror("无法重试",str(error)); return
        self.provider.set(request.provider); self.files=list(request.input_files); self.output.set(request.output_directory)
        self.instruction.delete("1.0","end"); self.instruction.insert("1.0",request.instruction)
        messagebox.showinfo("已恢复任务","任务参数已恢复到“新建任务”，请检查外发范围后再次确认。")

    def _history_delete(self) -> None:
        try: record_id=self._selected_history_id()
        except Exception as error: messagebox.showerror("无法删除",str(error)); return
        if not messagebox.askyesno("仅删除历史记录","只删除这条历史索引，不会删除原始文件或成果文件。是否继续？"): return
        self.runner.delete_history(record_id); self._refresh_history()

    def _files(self) -> None:
        self.files=list(filedialog.askopenfilenames(title="选择要交给 AI 处理的法律材料")); self.file_label.config(text=f"已选择 {len(self.files)} 个文件")
    def _login(self) -> None:
        try: self.runner.launch_login(self.provider.get())
        except Exception as error: messagebox.showerror("无法登录",str(error)); return
        messagebox.showinfo("登录已启动","请在官方登录窗口完成账号登录。工作台不会读取或保存凭据。")
    def _output(self) -> None:
        value=filedialog.askdirectory(title="选择成果目录");
        if value: self.output.set(value)
    def _request(self) -> TaskRequest:
        return TaskRequest(self.provider.get(),self.instruction.get("1.0","end"),tuple(self.files),self.output.get(),self.tool_ids[self.tool_name.get()])
    def _confirm(self) -> None:
        try: preview=disclosure(self._request())
        except Exception as error: messagebox.showerror("无法执行",str(error)); return
        if not messagebox.askyesno("发送前确认",preview): return
        self.status.set("执行中…可随时取消"); threading.Thread(target=self._run,daemon=True).start()
    def _run(self) -> None:
        try:
            result=self.runner.run(self._request(),lambda line:self.after(0,self._append,line))
            self.after(0,self.status.set,f"已完成｜成果目录：{result['output_directory']}")
        except Exception as error:
            self.after(0,self.status.set,"执行失败"); self.after(0,messagebox.showerror,"任务失败",str(error))
    def _append(self,text: str) -> None:
        self.log.config(state="normal"); self.log.insert("end",text); self.log.see("end"); self.log.config(state="disabled")
    def _open_output(self) -> None:
        target=Path(self.output.get()); target.mkdir(parents=True,exist_ok=True)
        self._open_path(target)

    @staticmethod
    def _open_path(target: Path) -> None:
        if os.name == "nt":
            os.startfile(target)  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.Popen(["open", str(target)])
        else:
            subprocess.Popen(["xdg-open", str(target)])


def main() -> None: YuLawApp().mainloop()

if __name__=="__main__": main()
