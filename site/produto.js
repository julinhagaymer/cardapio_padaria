"use strict";

(function () {
    const params = new URLSearchParams(location.search);
    const produto = buscarProduto(params.get("id"));

    const elFoto = document.getElementById("produtoFoto");
    const elNome = document.getElementById("produtoNome");
    const elDesc = document.getElementById("produtoDesc");
    const elPreco = document.getElementById("produtoPreco");
    const container = document.querySelector(".container");
    const rodape = document.querySelector(".rodape");

    if (!produto) {
        elFoto.remove();
        elNome.textContent = "Produto não encontrado";
        elDesc.textContent = "Volte ao cardápio e escolha um item.";
        document.querySelectorAll(".secao").forEach(function (s) { s.remove(); });
        if (rodape) rodape.remove();
        return;
    }

    const ehPizza = produto.tipo === "pizza";
    let qtd = 1;

    elNome.textContent = ehPizza ? "Pizza " + produto.nome : produto.nome;
    elDesc.textContent = produto.descricao;

    const urlImagem = imagemSegura(produto.imagem);
    if (urlImagem) {
        elFoto.style.backgroundImage = 'url("' + urlImagem + '")';
    }

    const secaoTamanho = document.getElementById("secaoTamanho");
    const secaoBorda = document.getElementById("secaoBorda");
    const secaoAdicionais = document.getElementById("secaoAdicionais");

    // Adicionais que este produto mostra (pizza ou não). Sem lista definida,
    // uma pizza mostra todos — comportamento antigo.
    function adicionaisDoProduto(prod) {
        const ids = Array.isArray(prod.adicionais) ? prod.adicionais : null;
        if (!ids) return prod.tipo === "pizza" ? ADICIONAIS.slice() : [];
        return ADICIONAIS.filter(function (a) { return ids.indexOf(a.id) !== -1; });
    }
    const listaAdicionais = adicionaisDoProduto(produto);

    if (ehPizza) {
        preencherOpcoes(document.getElementById("listaTamanhos"), TAMANHOS, "radio", "tamanho");
        preencherOpcoes(document.getElementById("listaBordas"), BORDAS, "radio", "borda");
    } else {
        secaoTamanho.remove();
        secaoBorda.remove();
        container.classList.add("simples");
        elPreco.textContent = formatarMoeda(produto.preco);
        elPreco.hidden = false;
    }

    if (listaAdicionais.length) {
        preencherOpcoes(document.getElementById("listaAdicionais"), listaAdicionais, "checkbox", "adicional");
    } else {
        secaoAdicionais.remove();
    }

    function preencherOpcoes(alvo, itens, tipoInput, grupo) {
        itens.forEach(function (item, indice) {
            const label = document.createElement("label");
            label.className = "linha";

            const nome = document.createElement("span");
            nome.className = "linha-nome";
            nome.textContent = item.rotulo;
            label.appendChild(nome);

            if (item.preco) {
                const preco = document.createElement("span");
                preco.className = "linha-preco";
                // Tamanho é uma escolha (preço cheio); borda e adicionais somam ao valor.
                preco.textContent = (grupo === "tamanho" ? "" : "+ ") + formatarMoeda(item.preco);
                label.appendChild(preco);
            }

            const input = document.createElement("input");
            input.type = tipoInput;
            input.value = String(indice);
            if (tipoInput === "radio") input.name = grupo;
            input.addEventListener("change", calcular);
            label.appendChild(input);

            alvo.appendChild(label);
        });
    }

    const observacao = document.getElementById("observacao");
    const contador = document.getElementById("contadorObs");
    observacao.setAttribute("maxlength", String(LIMITE_OBSERVACAO));
    observacao.addEventListener("input", function () {
        if (observacao.value.length > LIMITE_OBSERVACAO) {
            observacao.value = observacao.value.slice(0, LIMITE_OBSERVACAO);
        }
        contador.textContent = String(observacao.value.length);
    });

    function selecionadoRadio(grupo, lista) {
        const el = document.querySelector('input[name="' + grupo + '"]:checked');
        return el ? lista[Number(el.value)] : null;
    }
    function tamanhoSelecionado() { return selecionadoRadio("tamanho", TAMANHOS); }
    function bordaSelecionada() { return selecionadoRadio("borda", BORDAS); }
    function adicionaisSelecionados() {
        const marcados = document.querySelectorAll("#listaAdicionais input:checked");
        return Array.prototype.map.call(marcados, function (el) {
            return listaAdicionais[Number(el.value)];
        });
    }

    function calcular() {
        let unitario = 0;
        if (ehPizza) {
            const t = tamanhoSelecionado();
            const b = bordaSelecionada();
            if (t) unitario += t.preco;
            if (b) unitario += b.preco;
        } else {
            unitario = produto.preco;
        }
        adicionaisSelecionados().forEach(function (a) { unitario += a.preco; });
        document.getElementById("totalValor").textContent = formatarMoeda(unitario * qtd);
    }

    function mudarQtd(delta) {
        qtd = Math.max(1, qtd + delta);
        document.getElementById("qtdNum").textContent = String(qtd);
        calcular();
    }

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
            linhas.push("*Item:* Pizza " + produto.nome + " (Qtd: " + qtd + ")");
            linhas.push("*Ingredientes:* " + produto.descricao);
            linhas.push("*Tamanho:* " + t.rotulo);
            linhas.push("*Borda:* " + b.rotulo + (b.preco ? " (+ " + formatarMoeda(b.preco) + ")" : ""));
            if (adicionais.length) {
                linhas.push("*Adicionais:* " + adicionais.map(function (a) { return a.rotulo; }).join(", "));
            }
        } else {
            linhas.push("*Item:* " + produto.nome + " (Qtd: " + qtd + ")");
            linhas.push("*Descrição:* " + produto.descricao);
            const adc = adicionaisSelecionados();
            if (adc.length) {
                linhas.push("*Adicionais:* " + adc.map(function (a) { return a.rotulo; }).join(", "));
            }
        }

        const obs = observacao.value.trim();
        if (obs) linhas.push("*Observação:* " + obs);

        linhas.push("");
        linhas.push("*Total: " + document.getElementById("totalValor").textContent + "*");

        const url = "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(linhas.join("\n"));
        window.open(url, "_blank", "noopener");
    }

    document.getElementById("btnMenos").addEventListener("click", function () { mudarQtd(-1); });
    document.getElementById("btnMais").addEventListener("click", function () { mudarQtd(1); });
    document.getElementById("btnPedir").addEventListener("click", enviarPedido);

    calcular();
})();
