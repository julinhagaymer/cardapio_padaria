"use strict";

/* Carrinho de compras — compartilhado por index.html e produto.html.

   Guardado só na sessionStorage (aba atual): some sozinho ao fechar o
   navegador, e também se ficar 15 minutos sem nenhuma interação (soma um
   item, remove, abre o carrinho...). É "temporário" de propósito — este
   cardápio não pede login nem e-mail do cliente, então não há onde guardar
   um carrinho ligado a uma pessoa entre visitas.

   Os dados pessoais (nome/telefone/endereço) NÃO ficam guardados aqui: só
   passam pelo navegador na hora de finalizar e vão direto pro servidor
   (site/pedido.php), que os grava em dados/pedidos.json — fora da pasta
   pública, acessível só pelo painel com login (ver lib/pedidos.php). */

var CARRINHO_CHAVE = "carrinho_itens";
var CARRINHO_ATIV_CHAVE = "carrinho_atividade";
var CARRINHO_VALIDADE_MS = 15 * 60 * 1000;

function carrinhoExpirado() {
    try {
        var t = parseInt(sessionStorage.getItem(CARRINHO_ATIV_CHAVE), 10);
        return !t || (Date.now() - t) > CARRINHO_VALIDADE_MS;
    } catch (e) {
        return false;
    }
}

function carrinhoTocar() {
    try { sessionStorage.setItem(CARRINHO_ATIV_CHAVE, String(Date.now())); } catch (e) {}
}

function carrinhoLer() {
    try {
        if (carrinhoExpirado()) { carrinhoLimpar(); return []; }
        var bruto = sessionStorage.getItem(CARRINHO_CHAVE);
        var lista = bruto ? JSON.parse(bruto) : [];
        return Array.isArray(lista) ? lista : [];
    } catch (e) {
        return [];
    }
}

function carrinhoGravar(lista) {
    try {
        sessionStorage.setItem(CARRINHO_CHAVE, JSON.stringify(lista));
        carrinhoTocar();
    } catch (e) {}
}

function carrinhoLimpar() {
    try {
        sessionStorage.removeItem(CARRINHO_CHAVE);
        sessionStorage.removeItem(CARRINHO_ATIV_CHAVE);
    } catch (e) {}
}

function carrinhoAdicionar(item) {
    var lista = carrinhoLer();
    lista.push(item);
    carrinhoGravar(lista);
    return lista;
}

function carrinhoRemover(indice) {
    var lista = carrinhoLer();
    lista.splice(indice, 1);
    carrinhoGravar(lista);
    return lista;
}

// Preço/nome aqui são só para MOSTRAR ao cliente antes de enviar — o
// servidor recalcula tudo de novo a partir do cardápio ao vivo e nunca
// confia no que veio do navegador (ver pedido_criar_do_cliente).
function carrinhoPrecoItem(item) {
    var produto = buscarProduto(item.produtoId);
    if (!produto) return 0;
    var unit = 0;
    if (produto.tipo === "pizza") {
        var t = TAMANHOS.filter(function (x) { return x.rotulo === item.tamanho; })[0];
        var b = BORDAS.filter(function (x) { return x.rotulo === item.borda; })[0];
        if (t) unit += Number(t.preco) || 0;
        if (b) unit += Number(b.preco) || 0;
    } else {
        unit += Number(produto.preco) || 0;
    }
    (item.adicionais || []).forEach(function (rot) {
        var a = ADICIONAIS.filter(function (x) { return x.rotulo === rot; })[0];
        if (a) unit += Number(a.preco) || 0;
    });
    return unit;
}

function carrinhoNomeItem(item) {
    var produto = buscarProduto(item.produtoId);
    var nome = produto ? produto.nome : "Item";
    if (produto && produto.tipo === "pizza") {
        return "Pizza " + nome + (item.tamanho ? " (" + item.tamanho + ")" : "");
    }
    return nome;
}

function carrinhoAtualizarBadge() {
    var badge = document.getElementById("carrinhoContagem");
    if (!badge) return;
    var qtdTotal = carrinhoLer().reduce(function (s, it) { return s + (Number(it.qtd) || 0); }, 0);
    badge.textContent = String(qtdTotal);
    badge.hidden = qtdTotal === 0;
}

(function () {
    var $ = function (id) { return document.getElementById(id); };
    function el(tag, cls, txt) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (txt != null) e.textContent = txt;
        return e;
    }
    function abrirModal(id) { var m = $(id); if (m) m.hidden = false; }
    function fecharModal(id) { var m = $(id); if (m) m.hidden = true; }

    var btnCarrinho = $("btnCarrinho");
    if (!btnCarrinho) return; // página sem carrinho (não deveria acontecer, mas evita erro)

    function renderizarCarrinho() {
        var lista = carrinhoLer();
        var caixa = $("carrinhoLista");
        var vazio = $("carrinhoVazio");
        var btnFin = $("btnFinalizarCarrinho");
        caixa.textContent = "";
        vazio.hidden = lista.length > 0;
        btnFin.disabled = lista.length === 0;

        var total = 0;
        lista.forEach(function (item, indice) {
            var subtotal = carrinhoPrecoItem(item) * item.qtd;
            total += subtotal;

            var linha = el("div", "carrinho-item");
            var info = el("div", "carrinho-item-info");
            info.appendChild(el("div", "carrinho-item-nome", item.qtd + "× " + carrinhoNomeItem(item)));
            (item.adicionais || []).forEach(function (a) { info.appendChild(el("div", "carrinho-item-adic", "+ " + a)); });
            if (item.obs) info.appendChild(el("div", "carrinho-item-adic", "obs: " + item.obs));
            linha.appendChild(info);

            var direita = el("div", "carrinho-item-direita");
            direita.appendChild(el("div", "carrinho-item-preco", formatarMoeda(subtotal)));
            var btnX = el("button", "carrinho-item-remover", "✕");
            btnX.type = "button";
            btnX.setAttribute("aria-label", "Remover item");
            btnX.addEventListener("click", function () {
                carrinhoRemover(indice);
                renderizarCarrinho();
                carrinhoAtualizarBadge();
            });
            direita.appendChild(btnX);
            linha.appendChild(direita);

            caixa.appendChild(linha);
        });
        $("carrinhoTotalValor").textContent = formatarMoeda(total);
    }

    btnCarrinho.addEventListener("click", function () {
        renderizarCarrinho();
        abrirModal("modalCarrinho");
    });
    $("fecharCarrinho").addEventListener("click", function () { fecharModal("modalCarrinho"); });
    $("modalCarrinho").addEventListener("click", function (e) { if (e.target === this) fecharModal("modalCarrinho"); });

    // -------- "item adicionado": pergunta a cada item colocado no carrinho --------
    function mostrarConfirmacaoItemAdicionado() {
        carrinhoAtualizarBadge();
        abrirModal("modalItemAdicionado");
    }
    window.carrinhoConfirmarAdicao = mostrarConfirmacaoItemAdicionado;

    $("btnContinuarComprando").addEventListener("click", function () { fecharModal("modalItemAdicionado"); });
    $("btnIrFinalizar").addEventListener("click", function () {
        fecharModal("modalItemAdicionado");
        abrirFinalizar();
    });
    $("btnFinalizarCarrinho").addEventListener("click", function () {
        fecharModal("modalCarrinho");
        abrirFinalizar();
    });

    // -------- finalizar: dados do cliente (mesa ou entrega) --------
    var estadoEndereco = { cidade: "", bairro: "", rua: "", numero: "", complemento: "" };
    var modoEntregaAtual = null; // "receber" | "retirar" | null (mesa não usa isto)

    function abrirFinalizar() {
        if (!carrinhoLer().length) return;
        var ehMesa = MESA_ATUAL !== null && MESA_ATUAL > 0;
        $("finalizarTitulo").textContent = ehMesa ? "Seu pedido" : "Seus dados para entrega";
        $("finalMesaInfo").hidden = !ehMesa;
        if (ehMesa) $("finalMesaValor").textContent = "Mesa " + MESA_ATUAL;
        $("finalTelefoneWrap").hidden = ehMesa;
        $("finalEntregaWrap").hidden = ehMesa;

        if (!ehMesa) {
            // Recomeça do zero a cada abertura — evita confusão de manter
            // a escolha de um pedido anterior sem o cliente notar.
            modoEntregaAtual = null;
            estadoEndereco = { cidade: "", bairro: "", rua: "", numero: "", complemento: "" };
            $("radioReceber").checked = false;
            $("radioRetirar").checked = false;
            $("optReceber").classList.remove("selecionada");
            $("optRetirar").classList.remove("selecionada");
            $("resumoEndereco").textContent = "Informe seu endereço";
            $("enderecoLojaTxt").textContent = ENDERECO_LOJA;
        }

        $("erroFinalizar").classList.remove("ativo");
        $("avisoEnvioFalhou").hidden = true;
        abrirModal("modalFinalizar");
    }
    $("fecharFinalizar").addEventListener("click", function () { fecharModal("modalFinalizar"); });
    $("modalFinalizar").addEventListener("click", function (e) { if (e.target === this) fecharModal("modalFinalizar"); });

    // -------- opções de entrega: Receber no endereço x Retirar na loja --------
    function selecionarModoEntrega(modo) {
        modoEntregaAtual = modo;
        $("radioReceber").checked = modo === "receber";
        $("radioRetirar").checked = modo === "retirar";
        $("optReceber").classList.toggle("selecionada", modo === "receber");
        $("optRetirar").classList.toggle("selecionada", modo === "retirar");
        $("erroFinalizar").classList.remove("ativo");
    }
    $("radioReceber").addEventListener("change", function () { if (this.checked) selecionarModoEntrega("receber"); });
    $("radioRetirar").addEventListener("change", function () { if (this.checked) selecionarModoEntrega("retirar"); });

    // -------- listas de escolha (Cidade/Bairro): modal nosso, com "✓" no
    // item selecionado — em vez do <select> nativo, que muda de aparência
    // (e de usabilidade) de aparelho pra aparelho (roda no iPhone, lista no
    // Android...). Mesmo padrão visual do resto do site em qualquer tela. --------
    function abrirListaEscolha(titulo, opcoes, valorAtual, aoEscolher) {
        $("listaEscolhaTitulo").textContent = titulo;
        var corpo = $("listaEscolhaCorpo");
        corpo.textContent = "";
        opcoes.forEach(function (opcao) {
            var item = el("button", "item-lista-escolha" + (opcao === valorAtual ? " selecionado" : ""));
            item.type = "button";
            item.appendChild(el("span", null, opcao));
            item.appendChild(el("span", "item-lista-escolha-check", "✓"));
            item.addEventListener("click", function () {
                fecharModal("modalListaEscolha");
                aoEscolher(opcao);
            });
            corpo.appendChild(item);
        });
        abrirModal("modalListaEscolha");
    }
    $("fecharListaEscolha").addEventListener("click", function () { fecharModal("modalListaEscolha"); });
    $("modalListaEscolha").addEventListener("click", function (e) { if (e.target === this) fecharModal("modalListaEscolha"); });

    // -------- modal de endereço: cidade -> bairro (só habilita depois da
    // cidade escolhida) -> rua/número -> complemento (opcional) --------
    var rascunhoEndereco = { cidade: "", bairro: "" };

    $("btnCidade").addEventListener("click", function () {
        abrirListaEscolha("Selecione a cidade", CIDADES, rascunhoEndereco.cidade, function (cidade) {
            rascunhoEndereco.cidade = cidade;
            rascunhoEndereco.bairro = ""; // troca de cidade reseta o bairro
            $("cidadeTxt").textContent = cidade;
            $("bairroTxt").textContent = "Bairro";
            $("btnBairro").disabled = false;
        });
    });
    $("btnBairro").addEventListener("click", function () {
        var bairros = (BAIRROS_POR_CIDADE[rascunhoEndereco.cidade] || []).slice().sort();
        abrirListaEscolha("Selecione o bairro", bairros, rascunhoEndereco.bairro, function (bairro) {
            rascunhoEndereco.bairro = bairro;
            $("bairroTxt").textContent = bairro;
        });
    });

    function abrirModalEndereco() {
        selecionarModoEntrega("receber");
        rascunhoEndereco = { cidade: estadoEndereco.cidade, bairro: estadoEndereco.bairro };
        $("cidadeTxt").textContent = estadoEndereco.cidade || "Cidade";
        $("bairroTxt").textContent = estadoEndereco.bairro || "Bairro";
        $("btnBairro").disabled = !estadoEndereco.cidade;
        $("endRua").value = estadoEndereco.rua;
        $("endNumero").value = estadoEndereco.numero;
        $("endComplemento").value = estadoEndereco.complemento;
        $("erroEndereco").classList.remove("ativo");
        abrirModal("modalEndereco");
    }
    $("btnInformarEndereco").addEventListener("click", abrirModalEndereco);
    $("fecharEndereco").addEventListener("click", function () { fecharModal("modalEndereco"); });
    $("modalEndereco").addEventListener("click", function (e) { if (e.target === this) fecharModal("modalEndereco"); });

    $("btnSalvarEndereco").addEventListener("click", function () {
        var cidade = rascunhoEndereco.cidade;
        var bairro = rascunhoEndereco.bairro;
        var rua = $("endRua").value.trim();
        var numero = $("endNumero").value.trim();
        var complemento = $("endComplemento").value.trim();

        if (!cidade || !bairro || !rua || !numero) {
            $("erroEndereco").classList.add("ativo");
            return;
        }
        $("erroEndereco").classList.remove("ativo");

        estadoEndereco = { cidade: cidade, bairro: bairro, rua: rua, numero: numero, complemento: complemento };
        $("resumoEndereco").textContent = rua + ", " + numero + " - " + bairro;
        fecharModal("modalEndereco");
    });

    var ultimoPayloadPedido = null;

    function registrarPedidoNoPainel(corpo) {
        ultimoPayloadPedido = corpo;
        var btnConfirmar = $("btnConfirmarPedido");
        var btnRetry = $("btnTentarNovamenteEnvio");
        if (btnConfirmar) btnConfirmar.disabled = true;
        if (btnRetry) btnRetry.disabled = true;

        fetch("pedido.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(corpo)
        })
            .then(function (r) { return r.json().catch(function () { return {}; }); })
            .then(function (j) {
                if (j && j.ok) {
                    carrinhoLimpar();
                    carrinhoAtualizarBadge();
                    fecharModal("modalFinalizar");
                    $("sucessoTexto").textContent = "Pedido nº " + j.numero + " enviado pelo WhatsApp e já está no sistema da padaria.";
                    abrirModal("modalSucesso");
                } else {
                    $("avisoEnvioFalhou").hidden = false;
                }
            })
            .catch(function () { $("avisoEnvioFalhou").hidden = false; })
            .finally(function () {
                if (btnConfirmar) btnConfirmar.disabled = false;
                if (btnRetry) btnRetry.disabled = false;
            });
    }

    function enderecoResumoCompleto() {
        var l = estadoEndereco.rua + ", " + estadoEndereco.numero;
        if (estadoEndereco.complemento) l += " (" + estadoEndereco.complemento + ")";
        l += " - " + estadoEndereco.bairro + ", " + estadoEndereco.cidade;
        return l;
    }

    function finalizarPedido() {
        var nome = $("finalNome").value.trim();
        var ehMesa = MESA_ATUAL !== null && MESA_ATUAL > 0;
        var telefone = $("finalTelefone").value.trim();

        var enderecoOk = modoEntregaAtual === "retirar" ||
            (modoEntregaAtual === "receber" && estadoEndereco.rua && estadoEndereco.numero && estadoEndereco.bairro && estadoEndereco.cidade);
        var valido = nome !== "" && (ehMesa || (telefone !== "" && enderecoOk));
        if (!valido) {
            $("erroFinalizar").classList.add("ativo");
            if (!ehMesa && telefone !== "" && !enderecoOk) {
                // Já escolheu "receber" mas não preencheu o endereço: abre
                // o formulário direto, em vez de só apontar o erro.
                if (modoEntregaAtual === "receber") {
                    abrirModalEndereco();
                } else {
                    $("finalEntregaWrap").scrollIntoView({ behavior: "smooth", block: "center" });
                }
            }
            return;
        }
        $("erroFinalizar").classList.remove("ativo");

        var lista = carrinhoLer();
        if (!lista.length) { fecharModal("modalFinalizar"); return; }

        var linhas = ["Olá! Gostaria de fazer um pedido:", "", "*Nome:* " + nome];
        if (ehMesa) {
            linhas.push("*Mesa:* " + MESA_ATUAL);
        } else {
            linhas.push("*Telefone:* " + telefone);
            if (modoEntregaAtual === "retirar") {
                linhas.push("*Retirada na loja:* " + ENDERECO_LOJA);
            } else {
                linhas.push("*Endereço de entrega:* " + enderecoResumoCompleto());
            }
        }
        linhas.push("");

        var totalGeral = 0;
        lista.forEach(function (item) {
            var subtotal = carrinhoPrecoItem(item) * item.qtd;
            totalGeral += subtotal;
            linhas.push("*Item:* " + carrinhoNomeItem(item) + " (Qtd: " + item.qtd + ")");
            if (item.adicionais && item.adicionais.length) {
                linhas.push("*Adicionais:* " + item.adicionais.join(", "));
            }
            if (item.obs) linhas.push("*Observação:* " + item.obs);
            linhas.push("*Subtotal:* " + formatarMoeda(subtotal));
            linhas.push("");
        });
        linhas.push("*Total: " + formatarMoeda(totalGeral) + "*");

        // Abre o WhatsApp já (síncrono com o clique, senão o navegador
        // bloqueia o popup); o registro no sistema roda depois, em paralelo.
        var url = "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(linhas.join("\n"));
        window.open(url, "_blank", "noopener");

        var corpo = {
            origem: ehMesa ? "mesa" : "entrega",
            mesa: ehMesa ? MESA_ATUAL : undefined,
            cliente: nome,
            telefone: ehMesa ? undefined : telefone,
            modoEntrega: ehMesa ? undefined : modoEntregaAtual,
            observacao: "",
            itens: lista.map(function (item) {
                return {
                    produtoId: item.produtoId, qtd: item.qtd,
                    tamanho: item.tamanho || "", borda: item.borda || "",
                    adicionais: item.adicionais || [], obs: item.obs || ""
                };
            })
        };
        if (!ehMesa && modoEntregaAtual === "receber") {
            corpo.cidade = estadoEndereco.cidade;
            corpo.bairro = estadoEndereco.bairro;
            corpo.rua = estadoEndereco.rua;
            corpo.numero = estadoEndereco.numero;
            corpo.complemento = estadoEndereco.complemento;
        }
        registrarPedidoNoPainel(corpo);
    }

    $("btnConfirmarPedido").addEventListener("click", finalizarPedido);
    $("btnTentarNovamenteEnvio").addEventListener("click", function () {
        if (ultimoPayloadPedido) registrarPedidoNoPainel(ultimoPayloadPedido);
    });

    $("btnFecharSucesso").addEventListener("click", function () { fecharModal("modalSucesso"); });

    document.addEventListener("keydown", function (e) {
        if (e.key !== "Escape") return;
        ["modalCarrinho", "modalItemAdicionado", "modalFinalizar", "modalEndereco", "modalListaEscolha", "modalSucesso"].forEach(function (id) {
            var m = $(id);
            if (m && !m.hidden) fecharModal(id);
        });
    });

    carrinhoAtualizarBadge();
})();
