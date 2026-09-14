<?php
declare(strict_types=1);

/* A lógica vive em lib/, fora da pasta pública. Os candidatos cobrem as duas
   formas de publicar (ver COMO-PUBLICAR.txt). */
$libDir = null;
foreach ([__DIR__ . '/../../lib', __DIR__ . '/../lib', __DIR__] as $d) {
    if (is_file($d . '/dados.php')) { $libDir = $d; break; }
}
if ($libDir === null) {
    http_response_code(500);
    exit('// lib/ nao encontrado');
}
require_once $libDir . '/bootstrap.php';
require_once $libDir . '/dados.php';
require_once $libDir . '/enderecos.php';

/* Só leitura. Define "CATALOGO" com os dados ao vivo; o nucleo.js (carregado
   logo depois) cria as variáveis/funções a partir dele. Quem grava é o painel
   (../admin/api.php). */

$cat = carregar_catalogo();

/* Cidades/bairros atendidos pela entrega: referência fixa, não vem do
   catalogo.dados.json (não é editável pelo painel) — ver lib/enderecos.php. */
$cat['cidades'] = cidades_atendidas();
$cat['bairrosPorCidade'] = bairros_por_cidade();

/* Escape reforçado: transforma < > & ' " em \uXXXX. Assim, mesmo que algum
   texto do cardápio contenha "</script>" ou aspas, o JSON não consegue
   escapar do <script> nem de um atributo — proteção contra XSS. */
$FLAGS_JSON = JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP;

if (entrada_tem($_GET, 'json')) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($cat, $FLAGS_JSON);
    exit;
}

/* Cache curto: navegar cardápio <-> produto <-> voltar fica instantâneo
   (não refaz a requisição a cada clique). Uma edição do painel chega para
   quem já está no site em, no máximo, ~15s. */
header('Content-Type: application/javascript; charset=utf-8');
header('Cache-Control: max-age=15');
echo 'var CATALOGO = ' . json_encode($cat, $FLAGS_JSON) . ';';
