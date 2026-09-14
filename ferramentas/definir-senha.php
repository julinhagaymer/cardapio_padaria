<?php
declare(strict_types=1);

/* Define ou troca a senha do painel administrativo.
   Grava só o HASH (password_hash) em config/senha.local.php — a senha em si
   nunca fica salva em lugar nenhum.

   Uso:
       php ferramentas/definir-senha.php                (pergunta a senha)
       php ferramentas/definir-senha.php "suaSenhaForte" (direto)
*/

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este script só roda pela linha de comando.\n");
}

const MIN_CARACTERES = 8;

$destino = __DIR__ . '/../config/senha.local.php';

$nova = $argv[1] ?? null;

if ($nova === null) {
    fwrite(STDOUT, "Nova senha do painel (mín. " . MIN_CARACTERES . " caracteres): ");
    $nova = rtrim((string) fgets(STDIN), "\r\n");
    fwrite(STDOUT, "Repita a senha: ");
    $conf = rtrim((string) fgets(STDIN), "\r\n");
    if ($nova !== $conf) {
        fwrite(STDERR, "As senhas não conferem. Nada foi alterado.\n");
        exit(1);
    }
}

$nova = trim($nova);

if (strlen($nova) < MIN_CARACTERES) {
    fwrite(STDERR, "Muito curta. Use pelo menos " . MIN_CARACTERES . " caracteres.\n");
    exit(1);
}
if (strtolower($nova) === $nova || preg_match('/^[a-z0-9]+$/i', $nova)) {
    fwrite(STDOUT, "Aviso: senha só com letras/números. Considere incluir símbolos.\n");
}

$hash = password_hash($nova, PASSWORD_DEFAULT);
if (!is_string($hash) || $hash === '') {
    fwrite(STDERR, "Falha ao gerar o hash.\n");
    exit(1);
}

$conteudo = "<?php\n"
    . "/* Senha do painel (hash). NÃO versionar. Gerado por ferramentas/definir-senha.php */\n"
    . "return " . var_export($hash, true) . ";\n";

$dir = dirname($destino);
if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
    fwrite(STDERR, "Não consegui criar a pasta $dir\n");
    exit(1);
}

$tmp = $destino . '.tmp' . getmypid();
if (file_put_contents($tmp, $conteudo, LOCK_EX) === false || !rename($tmp, $destino)) {
    @unlink($tmp);
    fwrite(STDERR, "Não consegui gravar $destino\n");
    exit(1);
}
@chmod($destino, 0600); // só o dono do arquivo lê (efeito real em Linux)

fwrite(STDOUT, "OK! Senha atualizada em config/senha.local.php\n");
