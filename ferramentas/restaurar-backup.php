<?php
declare(strict_types=1);

/* Restaura o catálogo ou os pedidos a partir de uma cópia de segurança
   automática (ver lib/backup.php — uma cópia é feita sozinha a cada
   "Salvar" do catálogo, e no máximo 1 por dia para os pedidos).

   A versão atual (se existir) também vira uma cópia antes de ser
   sobrescrita, então restaurar a cópia errada continua sendo reversível:
   basta rodar de novo e escolher a mais recente.

   Uso:
       php ferramentas/restaurar-backup.php catalogo
       php ferramentas/restaurar-backup.php pedidos
*/

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este script só roda pela linha de comando.\n");
}

require_once __DIR__ . '/../lib/config.php';
require_once __DIR__ . '/../lib/backup.php';

$tipo = $argv[1] ?? '';
$alvos = [
    'catalogo' => __DIR__ . '/../dados/catalogo.dados.json',
    'pedidos'  => __DIR__ . '/../dados/pedidos.json',
];

if (!isset($alvos[$tipo])) {
    fwrite(STDERR, "Uso: php ferramentas/restaurar-backup.php catalogo|pedidos\n");
    exit(1);
}

$arquivoAtual = $alvos[$tipo];
$dirBackups = __DIR__ . '/../dados/backups/' . $tipo;

$arquivos = glob($dirBackups . '/*.json');
if (!is_array($arquivos) || !$arquivos) {
    fwrite(STDERR, "Nenhuma cópia de segurança encontrada em dados/backups/$tipo/\n");
    exit(1);
}
rsort($arquivos); // o nome começa com AAAAMMDD-HHMMSS: ordem alfabética reversa = mais recente primeiro

fwrite(STDOUT, "Cópias disponíveis de \"$tipo\" (mais recente primeiro):\n\n");
foreach ($arquivos as $i => $arq) {
    $quando = date('d/m/Y H:i:s', (int) filemtime($arq));
    $tamanho = round(filesize($arq) / 1024, 1);
    fwrite(STDOUT, "  [" . ($i + 1) . "] $quando  ({$tamanho} KB)\n");
}

fwrite(STDOUT, "\nQual número restaurar? (0 para cancelar): ");
$escolha = (int) trim((string) fgets(STDIN));

if ($escolha <= 0) {
    fwrite(STDOUT, "Cancelado. Nada foi alterado.\n");
    exit(0);
}
if (!isset($arquivos[$escolha - 1])) {
    fwrite(STDERR, "Número inválido.\n");
    exit(1);
}
$escolhido = $arquivos[$escolha - 1];

// A versão atual também vira uma cópia antes de ser sobrescrita, usando a
// MESMA regra de retenção que já vale pra esse tipo (catálogo: últimas N
// cópias; pedidos: expira por idade, já que carrega dados do comprador).
if (is_file($arquivoAtual)) {
    if ($tipo === 'catalogo') {
        backup_catalogo($arquivoAtual);
    } else {
        backup_pedidos($arquivoAtual);
    }
}

$dir = dirname($arquivoAtual);
if (!is_dir($dir)) {
    @mkdir($dir, 0775, true);
}

$tmp = $arquivoAtual . '.tmp' . getmypid();
if (!copy($escolhido, $tmp) || !rename($tmp, $arquivoAtual)) {
    @unlink($tmp);
    fwrite(STDERR, "Falha ao restaurar. Confira a permissão de escrita em dados/.\n");
    exit(1);
}

fwrite(STDOUT, "OK! \"$tipo\" restaurado a partir de " . basename($escolhido) . "\n");
