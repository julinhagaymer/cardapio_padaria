@echo off
setlocal
cd /d "%~dp0"

set "PHP=%~dp0php\php.exe"

if not exist "%PHP%" (
    echo.
    echo   [ERRO] Nao encontrei o PHP aqui:
    echo          %PHP%
    echo.
    echo   A pasta "php" nao esta no lugar. Restaure/baixe o PHP portatil
    echo   e coloque em:  %~dp0php\
    echo.
    pause
    exit /b 1
)

echo.
echo   ================================================
echo    Cardapio - Com Carinho   (servidor local)
echo   ================================================
echo.
echo    Cardapio:  http://127.0.0.1:8000/site/
echo    Painel:    http://127.0.0.1:8000/admin/admin.html
echo.
echo    Use o endereco com 127.0.0.1 (NAO "localhost"): neste PC o
echo    "localhost" tenta IPv6 primeiro e trava ~2s a cada pagina.
echo.
echo    NAO FECHE esta janela enquanto estiver usando.
echo    Para parar: feche a janela ou aperte Ctrl + C.
echo.

"%PHP%" -S 127.0.0.1:8000 -t "%~dp0."

echo.
echo   ------------------------------------------------------------
echo    O servidor parou.
echo    Se fechou sozinho na hora: a porta 8000 ja estava em uso
echo    (feche o outro programa) ou o Windows bloqueou o php.exe.
echo   ------------------------------------------------------------
pause
