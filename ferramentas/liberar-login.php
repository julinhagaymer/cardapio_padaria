<?php
declare(strict_types=1);

/* Libera a trava de tentativas de login (apaga dados/login_tentativas.json).
   Use se você mesmo se bloqueou testando a senha.

   Uso:
       php ferramentas/liberar-login.php            (libera todos os IPs)
       php ferramentas/liberar-login.php 203.0.113.5 (libera só esse IP)
*/

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este script só roda pela linha de comando.\n");
}

$arq = __DIR__ . '/../dados/login_tentativas.json';

if (!is_file($arq)) {
    fwrite(STDOUT, "Nada a fazer: não há tentativas registradas.\n");
    exit(0);
}

$ipAlvo = $argv[1] ?? null;

if ($ipAlvo === null) {
    if (@unlink($arq)) {
        fwrite(STDOUT, "OK! Trava de login liberada para todos os IPs.\n");
        exit(0);
    }
    fwrite(STDERR, "Não consegui apagar $arq\n");
    exit(1);
}

$dados = json_decode((string) @file_get_contents($arq), true);
if (!is_array($dados) || !array_key_exists($ipAlvo, $dados)) {
    fwrite(STDOUT, "O IP $ipAlvo não está na lista. Nada mudou.\n");
    exit(0);
}
unset($dados[$ipAlvo]);
if (@file_put_contents($arq, json_encode($dados, JSON_PRETTY_PRINT), LOCK_EX) !== false) {
    fwrite(STDOUT, "OK! Trava liberada para o IP $ipAlvo.\n");
    exit(0);
}
fwrite(STDERR, "Não consegui gravar $arq\n");
exit(1);
