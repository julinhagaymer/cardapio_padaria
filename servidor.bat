@echo off
rem Inicia o site com o PHP desta pasta. Depois abra: http://localhost:8000
cd /d "%~dp0"
echo.
echo   Cardapio - Com Carinho
echo   Site:  
echo   Admin: http://localhost:8000/admin.html
echo   (feche esta janela ou Ctrl+C para parar)
echo.
"%~dp0php\php.exe" -S localhost:8000 -t "%~dp0"
