@echo off
rem Inicia o site (cardapio) usando o PHP embutido nesta pasta.
rem Depois de rodar, abra no navegador: http://localhost:8000
cd /d "%~dp0"
echo.
echo   Cardapio - Com Carinho
echo   Servidor em http://localhost:8000   (Ctrl+C para parar)
echo.
"%~dp0php\php.exe" -S localhost:8000 -t "%~dp0"
