"use strict";

/* Funções compartilhadas pelo cardápio + um catálogo de RESERVA.

   Fluxo normal: catalogo.php (PHP) roda antes e define "CATALOGO" com os
   dados ao vivo. Aí o bloco abaixo é ignorado.

   Se a página for aberta SEM o PHP (abrir o arquivo direto, "Live Preview"
   etc.), catalogo.php não roda e "CATALOGO" fica indefinido — então usamos
   estes valores de reserva só para a página não ficar em branco. Eles podem
   estar desatualizados; o que vale é o servidor. */
if (typeof CATALOGO === "undefined") {
    var CATALOGO = {
        whatsapp: "553138354125",
        limiteObservacao: 500,
        categorias: [
            { id: "paes", nome: "Pães" },
            { id: "salgados", nome: "Salgados" },
            { id: "tortas", nome: "Tortas" },
            { id: "pizzas", nome: "Pizzas" },
            { id: "assados", nome: "Serviço de Assados" }
        ],
        produtos: [
            { id: "pao-frances", categoria: "paes", tipo: "simples", nome: "Pão Francês (kg)", descricao: "Pãozinho tradicional quentinho e crocante.", preco: 18.9, imagem: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600" },
            { id: "pao-de-queijo", categoria: "paes", tipo: "simples", nome: "Pão de Queijo", descricao: "Feito com queijo canastra legítimo.", preco: 4.5, imagem: "https://images.unsplash.com/photo-1598373182133-52452f7691ef?w=600" },
            { id: "pao-integral", categoria: "paes", tipo: "simples", nome: "Pão Integral (kg)", descricao: "Massa com farinha integral e mix de grãos, mais leve.", preco: 22.9, imagem: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600" },
            { id: "pao-de-forma", categoria: "paes", tipo: "simples", nome: "Pão de Forma Caseiro", descricao: "Fatiado, bem macio e sem conservantes.", preco: 16, imagem: "https://images.unsplash.com/photo-1598373182133-52452f7691ef?w=600" },
            { id: "broa-de-fuba", categoria: "paes", tipo: "simples", nome: "Broa de Fubá", descricao: "Fofinha, com erva-doce, receita mineira.", preco: 14.5, imagem: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600" },
            { id: "pao-doce", categoria: "paes", tipo: "simples", nome: "Pão Doce Trançado", descricao: "Massa fofa levemente adocicada com açúcar cristal por cima.", preco: 12, imagem: "https://images.unsplash.com/photo-1598373182133-52452f7691ef?w=600" },
            { id: "baguete", categoria: "paes", tipo: "simples", nome: "Baguete Francesa", descricao: "Casca crocante e miolo aerado, assada no dia.", preco: 9.9, imagem: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600" },
            { id: "coxinha-frango", categoria: "salgados", tipo: "simples", nome: "Coxinha de Frango", descricao: "Com catupiry original e massa de batata.", preco: 8.5, imagem: "https://images.unsplash.com/photo-1626844131082-256783844137?w=600" },
            { id: "empada-frango", categoria: "salgados", tipo: "simples", nome: "Empada de Frango", descricao: "Massa amanteigada que desmancha na boca.", preco: 7.5, imagem: "https://images.unsplash.com/photo-1626844131082-256783844137?w=600" },
            { id: "pastel-carne", categoria: "salgados", tipo: "simples", nome: "Pastel de Carne", descricao: "Frito na hora, recheio suculento e temperado.", preco: 8, imagem: "https://images.unsplash.com/photo-1626844131082-256783844137?w=600" },
            { id: "enroladinho-salsicha", categoria: "salgados", tipo: "simples", nome: "Enroladinho de Salsicha", descricao: "Massa de pão macia com salsicha e queijo.", preco: 6.5, imagem: "https://images.unsplash.com/photo-1626844131082-256783844137?w=600" },
            { id: "kibe", categoria: "salgados", tipo: "simples", nome: "Kibe", descricao: "Trigo com carne e hortelã, bem temperado.", preco: 7, imagem: "https://images.unsplash.com/photo-1626844131082-256783844137?w=600" },
            { id: "torta-frango", categoria: "tortas", tipo: "simples", nome: "Fatia Torta de Frango", descricao: "Recheio cremoso e bem temperado.", preco: 12, imagem: "https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600" },
            { id: "torta-palmito", categoria: "tortas", tipo: "simples", nome: "Fatia Torta de Palmito", descricao: "Recheio cremoso de palmito com azeitona.", preco: 12, imagem: "https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600" },
            { id: "torta-limao", categoria: "tortas", tipo: "simples", nome: "Fatia Torta de Limão", descricao: "Base crocante, creme de limão e merengue maçaricado.", preco: 13, imagem: "https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600" },
            { id: "torta-morango", categoria: "tortas", tipo: "simples", nome: "Fatia Torta de Morango", descricao: "Chantilly, morangos frescos e massa amanteigada.", preco: 15, imagem: "https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600" },
            { id: "torta-chocolate", categoria: "tortas", tipo: "simples", nome: "Fatia Torta de Chocolate", descricao: "Camadas de brigadeiro cremoso e ganache meio amargo.", preco: 14, imagem: "https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600" },
            { id: "pizza-portuguesa", categoria: "pizzas", tipo: "pizza", nome: "Portuguesa", descricao: "Mussarela, presunto, calabresa, molho de tomate, ovo, bacon, azeitona, cebola, pimentão, tomate, palmito e orégano.", imagem: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600" },
            { id: "pizza-presunto-mussarela", categoria: "pizzas", tipo: "pizza", nome: "Presunto e Mussarela", descricao: "Mussarela, molho de tomate, presunto, cebola, pimentão, azeitona, tomate e orégano.", imagem: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600" },
            { id: "pizza-frango-catupiry", categoria: "pizzas", tipo: "pizza", nome: "Frango Catupiry", descricao: "Mussarela, molho de tomate, peito de frango desfiado, catupiry, azeitona, cebola, pimentão, tomate e orégano.", imagem: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600" },
            { id: "pizza-calabresa", categoria: "pizzas", tipo: "pizza", nome: "Calabresa", descricao: "Mussarela, molho de tomate, calabresa, azeitona, cebola, pimentão, tomate e orégano.", imagem: "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=600" },
            { id: "pizza-frango-bacon", categoria: "pizzas", tipo: "pizza", nome: "Frango com Bacon", descricao: "Mussarela, molho de tomate, bacon, tomate, azeitona, cebola, pimentão e orégano.", imagem: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=600" },
            { id: "assado-lombo", categoria: "assados", tipo: "simples", nome: "Lombo", descricao: "Serviço de assar (a carne é por conta do cliente).", preco: 50, imagem: "https://images.unsplash.com/photo-1544025162-d76694265947?w=600" },
            { id: "assado-pernil", categoria: "assados", tipo: "simples", nome: "Pernil", descricao: "Serviço de assar (a carne é por conta do cliente).", preco: 130, imagem: "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=600" },
            { id: "assado-chester", categoria: "assados", tipo: "simples", nome: "Chester", descricao: "Serviço de assar (a carne é por conta do cliente).", preco: 50, imagem: "https://images.unsplash.com/photo-1574672280600-4accfa5b6f98?w=600" },
            { id: "assado-peru", categoria: "assados", tipo: "simples", nome: "Peru", descricao: "Serviço de assar (a carne é por conta do cliente).", preco: 50, imagem: "https://images.unsplash.com/photo-1574672280600-4accfa5b6f98?w=600" },
            { id: "assado-leitoa", categoria: "assados", tipo: "simples", nome: "Leitoa", descricao: "Serviço de assar (a carne é por conta do cliente).", preco: 150, imagem: "https://images.unsplash.com/photo-1544025162-d76694265947?w=600" }
        ],
        tamanhos: [
            { rotulo: "25 cm — 4 pedaços", preco: 49.9 },
            { rotulo: "30 cm — 8 pedaços", preco: 59.9 }
        ],
        bordas: [
            { rotulo: "Sem borda", preco: 0 },
            { rotulo: "Com borda", preco: 10 }
        ],
        adicionais: [
            { id: "catupiry", rotulo: "Catupiry", preco: 8 },
            { id: "cheddar", rotulo: "Cheddar", preco: 8 },
            { id: "bacon", rotulo: "Bacon", preco: 7 },
            { id: "palmito", rotulo: "Palmito", preco: 10 }
        ],
        cidades: ["Itabira"],
        bairrosPorCidade: { "Itabira": ["Centro", "Santa Ruth"] }
    };
}

var WHATSAPP = CATALOGO.whatsapp;
var LIMITE_OBSERVACAO = CATALOGO.limiteObservacao;
var CATEGORIAS = CATALOGO.categorias;
var PRODUTOS = CATALOGO.produtos;
var TAMANHOS = CATALOGO.tamanhos;
var BORDAS = CATALOGO.bordas;
var ADICIONAIS = CATALOGO.adicionais;
var CIDADES = CATALOGO.cidades || ["Itabira"];
var BAIRROS_POR_CIDADE = CATALOGO.bairrosPorCidade || {};

// Endereço fixo da loja, pra opção "Retire na loja" — mesmo endereço do
// rodapé do cardápio (index.html).
var ENDERECO_LOJA = "Rua Dona Fiota, 233 – Santa Ruth, Itabira/MG";

function formatarMoeda(valor) {
    return "R$ " + Number(valor).toFixed(2).replace(".", ",");
}

var DOMINIOS_IMAGEM = ["images.unsplash.com"];

function imagemSegura(url) {
    if (typeof url !== "string" || url === "") return "";
    if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(url)) return url;
    try {
        var u = new URL(url, location.href);
        if (u.protocol === "https:" && DOMINIOS_IMAGEM.indexOf(u.hostname) !== -1) {
            return u.href;
        }
    } catch (e) {
        /* URL inválida */
    }
    return "";
}

/* Origem do pedido: MESA (QR Code de uma mesa da lanchonete) ou ENTREGA
   (acesso normal ao site, delivery). O QR de cada mesa aponta para
   "index.html?mesa=N"; guardamos o número na sessionStorage para persistir
   enquanto o cliente navega até produto.html, sem depender do link carregar
   o parâmetro toda vez. Sem "?mesa=" (e sem nada guardado ainda nesta
   aba), o pedido é tratado como entrega — esse é o padrão. */
var MESA_ATUAL = (function () {
    try {
        var daUrl = new URLSearchParams(location.search).get("mesa");
        if (daUrl !== null) {
            var n = parseInt(daUrl, 10);
            if (n > 0 && n <= 999) {
                sessionStorage.setItem("pedido_mesa", String(n));
                return n;
            }
            // "mesa" presente mas inválido/zero (ex.: ?mesa=0): sai do modo
            // mesa explicitamente, mesmo que uma visita anterior nesta aba
            // tivesse guardado um número — sem isto, quem voltasse pro link
            // de entrega continuaria preso no modo mesa.
            sessionStorage.removeItem("pedido_mesa");
            return null;
        }
        var guardado = parseInt(sessionStorage.getItem("pedido_mesa"), 10);
        return guardado > 0 ? guardado : null;
    } catch (e) {
        return null;
    }
})();

function buscarProduto(id) {
    return PRODUTOS.find(function (p) { return p.id === id; }) || null;
}

function precoResumo(produto) {
    if (produto.tipo === "pizza") {
        if (!TAMANHOS.length) return formatarMoeda(0);
        var menor = Math.min.apply(null, TAMANHOS.map(function (t) { return Number(t.preco) || 0; }));
        return "A partir de " + formatarMoeda(menor);
    }
    return formatarMoeda(produto.preco);
}
