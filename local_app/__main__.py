import sys

from local_app.main import YuLawApp, main


def self_test_full() -> None:
    # Construct and inspect the real application so packaged-resource and UI
    # wiring failures cannot hide behind a Tk-only smoke test.
    app = YuLawApp()
    app.withdraw()
    app.update_idletasks()
    if app.title() != "Yu Law 本地 AI 工作台":
        raise RuntimeError("unexpected application title")
    if len(app.tabs.tabs()) != 3:
        raise RuntimeError("expected three desktop tabs")
    if len(app.tools) != 20:
        raise RuntimeError("expected twenty legal tools")
    app.destroy()


if __name__ == "__main__":
    if "--self-test-full" in sys.argv or "--self-test" in sys.argv:
        self_test_full()
    else:
        main()
