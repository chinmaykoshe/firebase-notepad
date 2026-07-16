@echo off
echo ==========================================
echo   Building Android APK (Local)
echo ==========================================
echo.

REM Step 0: Stop stale Gradle daemons
echo [0/4] Stopping Gradle daemons and clearing stale locks...
set GRADLE_EXIT_CONSOLE=
pushd app\android
call .\gradlew.bat --stop
popd

REM Delete the known problematic locked jar file
set LOCKED_JAR=app\node_modules\expo-modules-autolinking\android\expo-gradle-plugin\expo-autolinking-plugin-shared\build\libs\expo-autolinking-plugin-shared-1.0.jar
if exist "%LOCKED_JAR%" (
    del /F /Q "%LOCKED_JAR%"
    echo Cleared stale jar lock.
)

REM Clean Gradle build outputs to fix corrupted cache
echo Cleaning previous build outputs...
set GRADLE_EXIT_CONSOLE=
pushd app\android
call .\gradlew.bat clean
popd
echo Done!

echo.
echo [1/4] Running local build script in app directory...
cd app
call npm run build:android:local
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Build failed.
    cd ..
    pause
    exit /b 1
)

echo.
echo [2/4] Copying APK to project root...
cd ..
if exist "app\android\app\build\outputs\apk\release\app-release.apk" (
    copy /Y "app\android\app\build\outputs\apk\release\app-release.apk" "firebase-notepad-release.apk"
    echo Copied Release APK to: firebase-notepad-release.apk
) else if exist "app\android\app\build\outputs\apk\debug\app-debug.apk" (
    copy /Y "app\android\app\build\outputs\apk\debug\app-debug.apk" "firebase-notepad-debug.apk"
    echo Copied Debug APK to: firebase-notepad-debug.apk
) else (
    echo WARNING: Could not find the generated APK file!
)

echo.
echo [3/4] Done!
echo ==========================================
pause
