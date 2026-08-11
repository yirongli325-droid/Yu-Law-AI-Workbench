import sys

from local_app.main import YuLawApp, main


def self_test() -> None:
    # Construct the real application so packaged-resource failures cannot hide
    # behind a Tk-only smoke test. Keep the window invisible for CI.
    app = YuLawApp()
    app.withdraw()
    app.update_idletasks()
    app.destroy()


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        self_test()
    else:
        main()
