"use strict";

(function () {
    const barra = document.getElementById("categoriasBar");
    const lista = document.getElementById("cardapio");
    const fixedTop = document.querySelector(".fixed-top");

    const botoes = [];
    const idsSecoes = [];
    const titulos = [];
    let arrastou = false;

    // Quanto do topo fica coberto pelo cabeçalho fixo. É a MESMA medida usada
    // para (a) decidir qual categoria está ativa, (b) posicionar o traço e
    // (c) para onde rolar ao clicar num botão — assim tudo bate certinho.
    const MARGEM_TOPO = 6;
    function deslocamento() {
        return fixedTop.offsetHeight + MARGEM_TOPO;
    }

    CATEGORIAS.forEach(function (categoria, indice) {
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "cat-btn" + (indice === 0 ? " active" : "");
        botao.textContent = "- " + categoria.nome;
        botao.addEventListener("click", function () {
            if (arrastou) { arrastou = false; return; }
            irParaSecao(categoria.id, botao);
        });
        barra.appendChild(botao);
        botoes.push(botao);
        idsSecoes.push(categoria.id);

        const secao = document.createElement("section");
        secao.id = categoria.id;
        secao.className = "categoria-secao";

        const titulo = document.createElement("div");
        titulo.className = "categoria-titulo";
        titulo.textContent = categoria.nome;
        secao.appendChild(titulo);
        titulos.push(titulo);

        PRODUTOS
            .filter(function (p) { return p.categoria === categoria.id; })
            .forEach(function (produto) { secao.appendChild(montarCard(produto)); });

        lista.appendChild(secao);
    });

    // Assim que o cardápio existe na tela, volta para a posição em que o
    // usuário estava antes de abrir um produto — sem animação, para ele já
    // aparecer na seção certa (e não ver a página rolando do topo).
    try {
        const yGuardado = sessionStorage.getItem("cardapioY");
        if (yGuardado !== null) {
            sessionStorage.removeItem("cardapioY");
            const raiz = document.documentElement;
            const anterior = raiz.style.scrollBehavior;
            raiz.style.scrollBehavior = "auto";
            window.scrollTo(0, parseInt(yGuardado, 10) || 0);
            raiz.style.scrollBehavior = anterior;
        }
    } catch (e) {}

    // Traço sob a categoria ativa: a posição acompanha a rolagem em tempo real,
    // interpolando entre um botão e o próximo (sem depender de transição/atraso).
    const indicador = document.createElement("span");
    indicador.className = "cat-indicador";
    barra.appendChild(indicador);

    // Uma única fonte de verdade para "onde estamos no menu": categoria i,
    // com fração f (0 a 1) rumo à categoria seguinte. O traço e a cor vermelha
    // saem daqui, então nunca discordam — subindo ou descendo.
    function posicaoNoMenu() {
        const base = deslocamento();
        const y = window.pageYOffset;
        const tops = idsSecoes.map(function (id) {
            return document.getElementById(id).getBoundingClientRect().top + y - base;
        });

        // Chegou ao fim da página: a última seção pode ser curta demais para
        // encostar no topo, então força a última categoria.
        const alturaTotal = Math.max(
            document.documentElement.scrollHeight,
            document.body.scrollHeight
        );
        if (y + window.innerHeight >= alturaTotal - 2) {
            return { i: tops.length - 1, f: 0 };
        }

        let i = 0;
        while (i < tops.length - 1 && y >= tops[i + 1]) i++;

        let f = 0;
        if (i < tops.length - 1) {
            const intervalo = tops[i + 1] - tops[i];
            f = intervalo > 0 ? (y - tops[i]) / intervalo : 0;
            f = f < 0 ? 0 : (f > 1 ? 1 : f);
        }
        return { i: i, f: f };
    }

    function atualizarIndicador() {
        const p = posicaoNoMenu();
        const atual = botoes[p.i];
        let left = atual.offsetLeft;
        let width = atual.offsetWidth;

        const proximo = botoes[p.i + 1];
        if (proximo) {
            const suave = p.f * p.f * (3 - 2 * p.f);
            left += (proximo.offsetLeft - atual.offsetLeft) * suave;
            width += (proximo.offsetWidth - atual.offsetWidth) * suave;
        }

        indicador.style.transform = "translateX(" + left + "px)";
        indicador.style.width = width + "px";
    }

    function montarCard(produto) {
        const card = document.createElement("div");
        card.className = "item-card";
        card.addEventListener("click", function () {
            // guarda a posição para voltar exatamente aqui depois
            try { sessionStorage.setItem("cardapioY", String(window.pageYOffset)); } catch (e) {}
            location.href = "produto.html?id=" + encodeURIComponent(produto.id);
        });

        const info = document.createElement("div");
        info.className = "item-info";

        const titulo = document.createElement("div");
        titulo.className = "item-titulo";
        titulo.textContent = produto.nome;

        const descricao = document.createElement("div");
        descricao.className = "item-descricao";
        descricao.textContent = produto.descricao;

        const preco = document.createElement("div");
        preco.className = "item-preco";
        preco.textContent = precoResumo(produto);

        info.appendChild(titulo);
        info.appendChild(descricao);
        info.appendChild(preco);
        card.appendChild(info);

        const url = imagemSegura(produto.imagem);
        if (url) {
            const img = document.createElement("img");
            img.className = "item-imagem";
            img.src = url;
            img.alt = produto.nome;
            img.loading = "lazy";
            card.appendChild(img);
        }

        return card;
    }

    // Arrastar a barra de categorias com o mouse, com inércia ao soltar.
    // Só vira "arraste" (e captura o ponteiro) depois de passar de um limiar;
    // um clique simples nunca captura, então o botão continua clicável.
    // (No touch o próprio navegador já dá o deslize com inércia.)
    (function ativarArrasto() {
        let pressionado = false;
        let arrastando = false;
        let idPonteiro = null;
        let inicioX = 0;
        let scrollInicial = 0;
        let ultimoX = 0;
        let ultimoTempo = 0;
        let velocidade = 0;
        let animacao = 0;
        const LIMIAR = 6;

        barra.style.cursor = "grab";

        barra.addEventListener("pointerdown", function (e) {
            arrastou = false;
            if (e.pointerType === "touch" || e.button !== 0) return;
            pressionado = true;
            arrastando = false;
            idPonteiro = e.pointerId;
            inicioX = ultimoX = e.clientX;
            scrollInicial = barra.scrollLeft;
            ultimoTempo = e.timeStamp;
            velocidade = 0;
            cancelAnimationFrame(animacao);
        });

        barra.addEventListener("pointermove", function (e) {
            if (!pressionado || e.pointerId !== idPonteiro) return;
            const dx = e.clientX - inicioX;
            if (!arrastando) {
                if (Math.abs(dx) < LIMIAR) return;
                arrastando = true;
                arrastou = true;
                try { barra.setPointerCapture(idPonteiro); } catch (err) {}
                barra.style.cursor = "grabbing";
            }
            barra.scrollLeft = scrollInicial - dx;
            const dt = e.timeStamp - ultimoTempo;
            if (dt > 0) velocidade = (e.clientX - ultimoX) / dt;
            ultimoX = e.clientX;
            ultimoTempo = e.timeStamp;
        });

        function soltar(e) {
            if (!pressionado || e.pointerId !== idPonteiro) return;
            pressionado = false;
            const estavaArrastando = arrastando;
            arrastando = false;
            idPonteiro = null;
            if (!estavaArrastando) return;

            try { barra.releasePointerCapture(e.pointerId); } catch (err) {}
            barra.style.cursor = "grab";

            let v = velocidade * 16;
            (function desacelerar() {
                if (Math.abs(v) < 0.4) return;
                barra.scrollLeft -= v;
                v *= 0.94;
                animacao = requestAnimationFrame(desacelerar);
            })();
        }

        barra.addEventListener("pointerup", soltar);
        barra.addEventListener("pointercancel", soltar);
    })();

    let travaMenu = false;
    let travaMenuTimer;

    function centralizarBotao(botao) {
        const destino = botao.offsetLeft - (barra.clientWidth / 2) + (botao.clientWidth / 2);
        barra.scrollTo({ left: destino, behavior: "smooth" });
    }

    function ativarBotao(botao) {
        if (!botao || botao.classList.contains("active")) return;
        botoes.forEach(function (b) { b.classList.remove("active"); });
        botao.classList.add("active");
        centralizarBotao(botao);
    }

    function atualizarSecaoAtiva() {
        if (travaMenu) return;
        const p = posicaoNoMenu();
        const indiceAtivo = (p.f >= 0.5 && botoes[p.i + 1]) ? p.i + 1 : p.i;
        ativarBotao(botoes[indiceAtivo]);
    }

    function irParaSecao(idSecao, botao) {
        const el = document.getElementById(idSecao);
        if (el) {
            const alvo = el.getBoundingClientRect().top + window.pageYOffset - deslocamento();
            window.scrollTo({ top: alvo, behavior: "smooth" });
        }

        ativarBotao(botao);
        travaMenu = true;
        clearTimeout(travaMenuTimer);
        travaMenuTimer = setTimeout(function () {
            travaMenu = false;
            atualizarSecaoAtiva();
        }, 700);
    }

    // Anima cada título toda vez que ele entra na tela — descendo OU subindo.
    // Ao sair, volta ao estado escondido para animar de novo na próxima passagem.
    if ("IntersectionObserver" in window) {
        const observador = new IntersectionObserver(function (entradas) {
            entradas.forEach(function (entrada) {
                entrada.target.classList.toggle("visivel", entrada.isIntersecting);
            });
        }, { rootMargin: "0px 0px -12% 0px" });

        titulos.forEach(function (titulo) {
            titulo.classList.add("anima");
            observador.observe(titulo);
        });
    }

    let agendado = false;
    function aoRolar() {
        if (agendado) return;
        agendado = true;
        requestAnimationFrame(function () {
            atualizarSecaoAtiva();
            atualizarIndicador();
            agendado = false;
        });
    }

    function recalcular() {
        document.documentElement.style.setProperty("--desloc", deslocamento() + "px");
        atualizarSecaoAtiva();
        atualizarIndicador();
    }

    // Se a página voltou do cache do navegador (bfcache), ele já restaurou a
    // rolagem — só descartamos a marca para não interferir numa visita futura.
    window.addEventListener("pageshow", function (e) {
        if (e.persisted) {
            try { sessionStorage.removeItem("cardapioY"); } catch (err) {}
        }
    });

    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", recalcular);
    window.addEventListener("load", recalcular);
    recalcular();
})();
