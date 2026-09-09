<?php
declare(strict_types=1);
require __DIR__ . '/dados.php';

/* POST  -> admin salvando (valida senha, grava, devolve JSON)
   GET ?json=1 -> devolve o catálogo em JSON (usado pelo admin ao abrir)
   GET  -> devolve JavaScript que o cardápio carrega via <script src> */

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    responder_post();
    exit;
}

$cat = carregar_catalogo();

if (isset($_GET['json'])) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($cat, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

header('Content-Type: application/javascript; charset=utf-8');
header('Cache-Control: no-store');

echo '"use strict";' . "\n";
echo 'const CATALOGO = ' . json_encode($cat, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . ";\n";

echo <<<'JS'
const WHATSAPP = CATALOGO.whatsapp;
const LIMITE_OBSERVACAO = CATALOGO.limiteObservacao;
const CATEGORIAS = CATALOGO.categorias;
const PRODUTOS = CATALOGO.produtos;
const TAMANHOS = CATALOGO.tamanhos;
const BORDAS = CATALOGO.bordas;
const ADICIONAIS = CATALOGO.adicionais;

function formatarMoeda(valor) {
    return "R$ " + Number(valor).toFixed(2).replace(".", ",");
}

const DOMINIOS_IMAGEM = ["images.unsplash.com"];

function imagemSegura(url) {
    if (typeof url !== "string" || url === "") return "";
    if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(url)) return url;
    try {
        const u = new URL(url, location.href);
        if (u.protocol === "https:" && DOMINIOS_IMAGEM.indexOf(u.hostname) !== -1) {
            return u.href;
        }
    } catch (e) {
        /* URL inválida */
    }
    return "";
}

function buscarProduto(id) {
    return PRODUTOS.find(function (p) { return p.id === id; }) || null;
}

function precoResumo(produto) {
    if (produto.tipo === "pizza") {
        if (!TAMANHOS.length) return formatarMoeda(0);
        const menor = Math.min.apply(null, TAMANHOS.map(function (t) { return Number(t.preco) || 0; }));
        return "A partir de " + formatarMoeda(menor);
    }
    return formatarMoeda(produto.preco);
}
JS;
