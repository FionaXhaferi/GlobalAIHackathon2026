@echo off
echo Starting AI Scientist Backend...
cd /d "%~dp0backend"
C:\Users\fiona\anaconda3\envs\kddm_env\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
pause
