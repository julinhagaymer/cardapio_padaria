<?php
declare(strict_types=1);

/* API do painel administrativo (pasta pública public/admin/).
   A lógica de verdade vive em lib/, FORA da pasta pública. */

$libDir = null;
foreach ([__DIR__ . '/../../lib', __DIR__ . '/../lib', __DIR__] as $d) {
    if (is_file($d . '/dados.php')) { $libDir = $d; break; }
}
if ($libDir === null) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'erro' => 'lib/ não encontrado. Ajuste o caminho em public/admin/api.php.']);
    exit;
}
require_once $libDir . '/bootstrap.php';
require_once $libDir . '/dados.php';

iniciar_sessao();
header('Cache-Control: no-store');

$acao = ler_opcao($_GET, 'acao', ['entrar', 'sair'], '');

if ($acao === 'entrar') {
    responder_entrar();
    exit;
}
if ($acao === 'sair') {
    responder_sair();
    exit;
}

// Daqui pra baixo precisa estar logado.
if (!sessao_valida()) {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'erro' => 'login']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    responder_post();   // normaliza e grava catalogo.dados.json
    exit;
}

// GET -> devolve o catálogo atual em JSON (o painel lê isto ao abrir)
header('Content-Type: application/json; charset=utf-8');
echo json_encode(
    carregar_catalogo(),
    JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP
);
