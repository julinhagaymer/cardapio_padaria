<?php
declare(strict_types=1);

/* API do painel de PEDIDOS (pasta pública public/admin/).
   Mesma sessão/senha do painel principal. A lógica vive em lib/. */

$libDir = null;
foreach ([__DIR__ . '/../../lib', __DIR__ . '/../lib', __DIR__] as $d) {
    if (is_file($d . '/dados.php')) { $libDir = $d; break; }
}
if ($libDir === null) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'erro' => 'lib/ não encontrado.']);
    exit;
}
require_once $libDir . '/bootstrap.php';
require_once $libDir . '/dados.php';    // sessão + login (iniciar_sessao, responder_entrar...)
require_once $libDir . '/pedidos.php';

iniciar_sessao();
header('Cache-Control: no-store');
header('Content-Type: application/json; charset=utf-8');

const FLAGS_JSON_PEDIDOS = JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP;

$acao = ler_opcao($_GET, 'acao', ['entrar', 'sair', 'status', 'simular'], '');

if ($acao === 'entrar') { responder_entrar(); exit; }
if ($acao === 'sair')   { responder_sair();   exit; }

/* Daqui pra baixo precisa estar logado. */
if (!sessao_valida()) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'erro' => 'login']);
    exit;
}

$ehPost = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';

if ($ehPost && $acao === 'status') {
    $body = json_decode((string) file_get_contents('php://input'), true);
    $body = is_array($body) ? $body : [];
    $id   = ler_inteiro($body, 'id', 1, null, 0);
    $novo = ler_opcao($body, 'status', STATUS_PEDIDO, '');
    if ($id <= 0 || $novo === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'erro' => 'Dados inválidos.']);
        exit;
    }
    $p = pedido_mudar_status($id, $novo);
    if ($p === null) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'erro' => 'Pedido não encontrado.']);
        exit;
    }
    echo json_encode(['ok' => true, 'pedido' => $p, 'agora' => time()], FLAGS_JSON_PEDIDOS);
    exit;
}

if ($ehPost && $acao === 'simular') {
    $p = pedido_simular();
    echo json_encode(['ok' => true, 'pedido' => $p, 'agora' => time()], FLAGS_JSON_PEDIDOS);
    exit;
}

/* GET -> lista completa + hora do servidor (para os "há X min"). */
echo json_encode(
    ['ok' => true, 'agora' => time(), 'pedidos' => pedidos_carregar()],
    FLAGS_JSON_PEDIDOS
);
