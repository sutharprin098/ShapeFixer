import requests
import os

url = "http://localhost:8000/api/upload"
file_path = r"D:\Terra ai\test2\Pune_district.zip"

if not os.path.exists(file_path):
    print(f"File not found: {file_path}")
else:
    with open(file_path, "rb") as f:
        r = requests.post(url, files={"file": f})
        print(f"Status: {r.status_code}")
        print(f"Body: {r.text}")
