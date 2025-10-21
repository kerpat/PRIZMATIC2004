@echo off
echo ========================================
echo PRIZMATIC APK Builder
echo ========================================
echo.

echo [1/5] Checking Node.js...
node --version
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found! Install from https://nodejs.org/
    pause
    exit /b 1
)

echo [2/5] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: npm install failed!
    pause
    exit /b 1
)

echo [3/5] Adding Android platform...
call npx cap add android
if %errorlevel% neq 0 (
    echo WARNING: Android platform already exists or failed to add
)

echo [4/5] Syncing web files...
call npx cap sync android
if %errorlevel% neq 0 (
    echo ERROR: Sync failed!
    pause
    exit /b 1
)

echo [5/5] Opening Android Studio...
call npx cap open android

echo.
echo ========================================
echo Next steps in Android Studio:
echo 1. Build -^> Generate Signed Bundle / APK
echo 2. Select APK
echo 3. Choose your keystore
echo 4. Select release
echo 5. APK will be in android/app/release/
echo ========================================
pause
