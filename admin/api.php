<?php
declare(strict_types=1);

/* API do painel administrativo.
   Fica FORA da pasta do cardápio; só reaproveita a lógica e o arquivo de
   dados do site (dados.php + catalogo.dados.json, que moram junto do site). */

$candidatos = [
    __DIR__ . '/../site/dados.php',  // layout local: admin/ e site/ lado a lado
    __DIR__ . '/../dados.php',        // hospedagem: painel dentro da pasta do site
    __DIR__ . '/dados.php',           // dados.php copiado para cá
];
$achou = false;
foreach ($candidatos as $c) {
    if (is_file($c)) { require $c; $achou = true; break; }
}
if (!$achou) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'erro' => 'dados.php não encontrado. Ajuste o caminho em admin/api.php.']);
    exit;
}

iniciar_sessao();
header('Cache-Control: no-store');

$acao = $_GET['acao'] ?? '';

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
echo json_encode(carregar_catalogo(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
