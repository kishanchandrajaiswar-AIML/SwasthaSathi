import os
import subprocess
import time

edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

targets = [
    ("view_home.png", "http://localhost:8080/#home"),
    ("view_triage.png", "http://localhost:8080/#triage"),
    ("view_facilities.png", "http://localhost:8080/#facilities"),
]

for filename, url in targets:
    if os.path.exists(filename):
        os.remove(filename)
    cmd = [
        edge_path,
        "--headless=old",
        "--disable-gpu",
        f"--screenshot={os.path.abspath(filename)}",
        "--window-size=430,932",
        url
    ]
    subprocess.run(cmd, capture_output=True)
    print(f"{filename} created:", os.path.exists(filename))
