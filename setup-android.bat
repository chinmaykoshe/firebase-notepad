@echo off
REM ==========================================
REM  Firebase Notepad - Full Android Setup
REM ==========================================
REM  Run this script from the project root:
REM    cd c:\Users\Chinmay\Desktop\PROJECTs\txtviewer
REM    setup-android.bat
REM ==========================================

echo.
echo  ========================================
echo   Firebase Notepad - Android App Builder
echo  ========================================
echo.

REM Step 1: Install Capacitor
echo [1/6] Installing Capacitor packages...
call npm install @capacitor/core @capacitor/cli @capacitor/android
if %errorlevel% neq 0 (
    echo ERROR: npm install failed. Check your internet connection.
    pause
    exit /b 1
)
echo Done!

REM Step 2: Build web app
echo.
echo [2/6] Building web app (Vite)...
call npm run build
if %errorlevel% neq 0 (
    echo WARNING: Build may have failed. Checking if dist/ exists...
    if not exist "dist\index.html" (
        echo ERROR: No dist/index.html found. Build failed!
        pause
        exit /b 1
    )
    echo Using existing dist/ folder.
)
echo Done!

REM Step 3: Copy SVG assets to dist (if not already bundled)
echo.
echo [3/6] Copying static assets to dist...
if exist "collapse.svg" copy /Y "collapse.svg" "dist\collapse.svg" >nul 2>&1
if exist "expand.svg" copy /Y "expand.svg" "dist\expand.svg" >nul 2>&1
if exist "notepad.png" copy /Y "notepad.png" "dist\notepad.png" >nul 2>&1
echo Done!

REM Step 4: Add Android platform
echo.
echo [4/6] Adding Android platform...
call npx cap add android
if %errorlevel% neq 0 (
    echo NOTE: Android platform may already exist, trying sync...
)
echo Done!

REM Step 5: Sync web assets
echo.
echo [5/6] Syncing web assets to Android project...
call npx cap sync android
if %errorlevel% neq 0 (
    echo ERROR: Sync failed!
    pause
    exit /b 1
)
echo Done!

REM Step 6: Copy app icons
echo.
echo [6/6] Setting up app icon...
if exist "app-icon.png" (
    call node setup-icons.mjs
) else if exist "notepad.png" (
    echo app-icon.png not found, using notepad.png as icon...
    copy /Y "notepad.png" "app-icon.png" >nul 2>&1
    call node setup-icons.mjs
) else (
    echo WARNING: No icon file found. Using default Capacitor icon.
    echo To set a custom icon later, place app-icon.png in the project root
    echo and run: node setup-icons.mjs
)
echo Done!

echo.
echo  ==========================================
echo   SUCCESS! Android project created.
echo  ==========================================
echo.
echo  Your Android project is at: android\
echo.
echo  NEXT STEPS:
echo.
echo  Option A - Open in Android Studio:
echo    npx cap open android
echo    Then click "Build ^> Build APK" in Android Studio
echo.
echo  Option B - Build APK from command line:
echo    cd android
echo    gradlew.bat assembleDebug
echo    (APK at: android\app\build\outputs\apk\debug\app-debug.apk)
echo.
echo  AFTER CODE CHANGES:
echo    npm run android:build
echo.
pause
