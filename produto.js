"use strict";

/* Comportamento da página do produto (o HTML é gerado pelo PHP):
   escolha de tamanho/borda/adicionais, quantidade, total e envio pelo WhatsApp. */

(function () {
    const raiz = document.querySelector(".container[data-tipo]");
    if (!raiz) return; // página de "produto não encontrado"

    const ehPizza = raiz.getAttribute("data-tipo") === "pizza";
    const nome = raiz.getAttribute("data-nome") || "";
    const descricao = raiz.getAttribute("data-descricao") || "";
    const precoBase = parseFloat(raiz.getAttribute("data-preco")) || 0;
    const whatsapp = raiz.getAttribute("data-whatsapp") || "";

    let qtd = 1;

    function formatarMoeda(valor) {
        return "R$ " + Number(valor).toFixed(2).replace(".", ",");
    }

    function dadosLinha(input) {
        const linha = input.closest(".linha");
        const nomeEl = linha ? linha.querySelector(".linha-nome") : null;
        return {
            rotulo: nomeEl ? nomeEl.textContent : "",
            preco: parseFloat(input.getAttribute("data-preco")) || 0,
        };
    }

    function radioSelecionado(grupo) {
        const el = document.querySelector('input[name="' + grupo + '"]:checked');
        return el ? dadosLinha(el) : null;
    }
    function tamanhoSelecionado() { return radioSelecionado("tamanho"); }
    function bordaSelecionada() { return radioSelecionado("borda"); }
    function adicionaisSelecionados() {
        const marcados = document.querySelectorAll("#listaAdicionais input:checked");
        return Array.prototype.map.call(marcados, dadosLinha);
    }

    function calcular() {
        let unitario = 0;
        if (ehPizza) {
            const t = tamanhoSelecionado();
            const b = bordaSelecionada();
            if (t) unitario += t.preco;
            if (b) unitario += b.preco;
            adicionaisSelecionados().forEach(function (a) { unitario += a.preco; });
        } else {
            unitario = precoBase;
        }
        document.getElementById("totalValor").textContent = formatarMoeda(unitario * qtd);
    }

    function mudarQtd(delta) {
        qtd = Math.max(1, qtd + delta);
        document.getElementById("qtdNum").textContent = String(qtd);
        calcular();
    }

    // ---- Observação: contador + limite ----
    const observacao = document.getElementById("observacao");
    const contador = document.getElementById("contadorObs");
    const limite = parseInt(observacao.getAttribute("maxlength"), 10) || 500;
    observacao.addEventListener("input", function () {
        if (observacao.value.length > limite) {
            observacao.value = observacao.value.slice(0, limite);
        }
        contador.textContent = String(observacao.value.length);
    });

    // ---- Recalcula ao mudar qualquer opção ----
    document.querySelectorAll(".linha input").forEach(function (input) {
        input.addEventListener("change", calcular);
    });

    function enviarPedido() {
        if (ehPizza) {
            const semTamanho = !tamanhoSelecionado();
            const semBorda = !bordaSelecionada();
            document.getElementById("erroTamanho").classList.toggle("ativo", semTamanho);
            document.getElementById("erroBorda").classList.toggle("ativo", semBorda);
            if (semTamanho || semBorda) {
                document.getElementById(semTamanho ? "secaoTamanho" : "secaoBorda")
                    .scrollIntoView({ behavior: "smooth", block: "center" });
                return;
            }
        }

        const linhas = ["Olá! Gostaria de fazer um pedido:", ""];

        if (ehPizza) {
            const t = tamanhoSelecionado();
            const b = bordaSelecionada();
            const adicionais = adicionaisSelecionados();
            linhas.push("*Item:* Pizza " + nome + " (Qtd: " + qtd + ")");
            linhas.push("*Ingredientes:* " + descricao);
            linhas.push("*Tamanho:* " + t.rotulo);
            linhas.push("*Borda:* " + b.rotulo + (b.preco ? " (+ " + formatarMoeda(b.preco) + ")" : ""));
            if (adicionais.length) {
                linhas.push("*Adicionais:* " + adicionais.map(function (a) { return a.rotulo; }).join(", "));
            }
        } else {
            linhas.push("*Item:* " + nome + " (Qtd: " + qtd + ")");
            linhas.push("*Descrição:* " + descricao);
        }

        const obs = observacao.value.trim();
        if (obs) linhas.push("*Observação:* " + obs);

        linhas.push("");
        linhas.push("*Total: " + document.getElementById("totalValor").textContent + "*");

        const url = "https://wa.me/" + whatsapp + "?text=" + encodeURIComponent(linhas.join("\n"));
        window.open(url, "_blank", "noopener");
    }

    document.getElementById("btnMenos").addEventListener("click", function () { mudarQtd(-1); });
    document.getElementById("btnMais").addEventListener("click", function () { mudarQtd(1); });
    document.getElementById("btnPedir").addEventListener("click", enviarPedido);

    calcular();
})();
