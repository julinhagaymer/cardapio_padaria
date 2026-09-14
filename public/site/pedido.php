<?php
declare(strict_types=1);

/* Recebe o pedido (mesa, via QR Code, ou entrega) que o cliente faz no
   cardápio (produto.js) e grava no mesmo lugar que o painel de Pedidos lê —
   assim o pedido chega lá além de ir pelo WhatsApp. Página pública, sem
   login: por isso nome e preço nunca são os que o navegador manda, são
   sempre recalculados aqui a partir do cardápio ao vivo (ver
   pedido_criar_do_cliente em lib/pedidos.php). */

$libDir = null;
foreach ([__DIR__ . '/../../lib', __DIR__ . '/../lib', __DIR__] as $d) {
    if (is_file($d . '/dados.php')) { $libDir = $d; break; }
}
if ($libDir === null) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'erro' => 'Serviço indisponível.']);
    exit;
}
require_once $libDir . '/bootstrap.php';
require_once $libDir . '/dados.php';   // entrada.php, ip_cliente()...
require_once $libDir . '/pedidos.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'erro' => 'Método não permitido.']);
    exit;
}

$ip = ip_cliente();
$trava = pedido_ip_pode_enviar($ip);
if (!$trava['ok']) {
    http_response_code(429);
    header('Retry-After: ' . $trava['espera']);
    echo json_encode(['ok' => false, 'erro' => 'Muitos pedidos em pouco tempo. Aguarde um instante e tente de novo.']);
    exit;
}

$body = json_decode((string) file_get_contents('php://input'), true);
$body = is_array($body) ? $body : [];

$resultado = pedido_criar_do_cliente($body);
pedido_ip_registrar($ip); // conta a tentativa mesmo se inválida, pra não facilitar abuso

if (!$resultado['ok']) {
    http_response_code($resultado['status'] ?? 400);
    echo json_encode(['ok' => false, 'erro' => $resultado['erro']]);
    exit;
}

echo json_encode(
    ['ok' => true, 'numero' => $resultado['pedido']['numero']],
    JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP
);
