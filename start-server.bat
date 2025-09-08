@echo off
echo Starting Life Savers Donors Local Server...
echo.

REM Check if Python is available
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo Using Python server...
    python simple-server.py
) else (
    echo Python not found. Trying Node.js...
    node --version >nul 2>&1
    if %errorlevel% == 0 (
        echo Using Node.js server...
        node server.js
    ) else (
        echo Neither Python nor Node.js found.
        echo Please install Python or Node.js to run the local server.
        echo.
        echo Alternative: Use a simple HTTP server:
        echo python -m http.server 8000
        pause
    )
)
