import os
import subprocess

edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

tests = [
    ("screen_desktop_1280.png", "1280,800", "http://localhost:8080/#home"),
    ("screen_mobile_375.png", "375,812", "http://localhost:8080/#home"),
    ("screen_profile.png", "1280,800", "http://localhost:8080/#profile"),
    ("screen_triage_rec.png", "1280,800", "http://localhost:8080/#triage"),
]

for filename, size, url in tests:
    if os.path.exists(filename):
        os.remove(filename)
    cmd = [
        edge_path,
        "--headless=old",
        "--disable-gpu",
        f"--screenshot={os.path.abspath(filename)}",
        f"--window-size={size}",
        url
    ]
    subprocess.run(cmd, capture_output=True)
    print(f"{filename} created:", os.path.exists(filename))
