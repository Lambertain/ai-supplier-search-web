@echo off
echo ================================
echo Local PostgreSQL Database Setup
echo ================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not running!
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo [1/4] Starting PostgreSQL container...
docker-compose up -d

echo.
echo [2/4] Waiting for PostgreSQL to be ready...
timeout /t 5 /nobreak >nul

echo.
echo [3/4] Running database migrations...
node src\db\migrate.js

echo.
echo [4/4] Setup complete!
echo.
echo Database is ready at: postgresql://supplier_admin:dev_password_change_in_prod@localhost:5432/supplier_search
echo.
echo To connect with pgAdmin or psql:
echo   Host: localhost
echo   Port: 5432
echo   Database: supplier_search
echo   User: supplier_admin
echo   Password: dev_password_change_in_prod
echo.
echo To stop the database: docker-compose down
echo To view logs: docker-compose logs -f postgres
echo.
pause
