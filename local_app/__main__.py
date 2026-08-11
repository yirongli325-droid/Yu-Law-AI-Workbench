import sys
import tkinter as tk

from local_app.main import main


def self_test() -> None:
    root = tk.Tk()
    root.withdraw()
    root.update_idletasks()
    root.destroy()


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        self_test()
    else:
        main()
