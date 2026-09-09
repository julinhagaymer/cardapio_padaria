<?php
declare(strict_types=1);
require __DIR__ . '/dados.php';

/* Só leitura. Define "CATALOGO" com os dados ao vivo; o nucleo.js (carregado
   logo depois) cria as variáveis/funções a partir dele. Quem grava é o painel
   (../admin/api.php). */

$cat = carregar_catalogo();

if (isset($_GET['json'])) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($cat, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/* Cache curto: navegar cardápio <-> produto <-> voltar fica instantâneo
   (não refaz a requisição a cada clique). Uma edição do painel chega para
   quem já está no site em, no máximo, ~15s. */
header('Content-Type: application/javascript; charset=utf-8');
header('Cache-Control: max-age=15');
echo 'var CATALOGO = ' . json_encode($cat, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . ';';
