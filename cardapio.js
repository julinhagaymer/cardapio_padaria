"use strict";

/* Comportamento do cardápio (o HTML é gerado pelo PHP):
   - menu de categorias que acompanha a rolagem, com traço deslizante
   - arrastar a barra de categorias com o mouse (inércia ao soltar)
   - animação dos títulos ao entrar/sair da tela
   - abrir a página do produto guardando a posição de rolagem */

(function () {
    const barra = document.getElementById("categoriasBar");
    const fixedTop = document.querySelector(".fixed-top");

    const botoes = Array.prototype.slice.call(document.querySelectorAll(".cat-btn"));
    const idsSecoes = botoes.map(function (b) { return b.getAttribute("data-secao"); });
    const titulos = Array.prototype.slice.call(document.querySelectorAll(".categoria-titulo"));

    if (!barra || botoes.length === 0) return;

    let arrastou = false;

    // Mesma medida usada para (a) categoria ativa, (b) posição do traço e
    // (c) destino da rolagem ao clicar num botão — assim tudo bate certinho.
    const MARGEM_TOPO = 6;
    function deslocamento() {
        return fixedTop.offsetHeight + MARGEM_TOPO;
    }

    // ---- Abrir produto guardando a posição atual ----
    document.querySelectorAll(".item-card").forEach(function (card) {
        card.addEventListener("click", function () {
            try { sessionStorage.setItem("cardapioY", String(window.pageYOffset)); } catch (e) {}
            location.href = "produto.php?id=" + encodeURIComponent(card.getAttribute("data-id"));
        });
    });

    // ---- Voltar à posição de antes (sem animação) ----
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

    window.addEventListener("pageshow", function (e) {
        if (e.persisted) {
            try { sessionStorage.removeItem("cardapioY"); } catch (err) {}
        }
    });

    // ---- Traço deslizante sob a categoria ativa ----
    const indicador = document.createElement("span");
    indicador.className = "cat-indicador";
    barra.appendChild(indicador);

    // Onde estamos no menu: categoria i, com fração f (0 a 1) rumo à seguinte.
    // O traço e a cor vermelha saem daqui, então nunca discordam.
    function posicaoNoMenu() {
        const base = deslocamento();
        const y = window.pageYOffset;
        const tops = idsSecoes.map(function (id) {
            const el = document.getElementById(id);
            return (el ? el.getBoundingClientRect().top : 0) + y - base;
        });

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

    // ---- Arrastar a barra com o mouse (só vira arraste após um limiar,
    //      então um clique simples continua funcionando) ----
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

    // ---- Menu que acompanha a rolagem ----
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

    botoes.forEach(function (botao) {
        botao.addEventListener("click", function () {
            if (arrastou) { arrastou = false; return; }
            irParaSecao(botao.getAttribute("data-secao"), botao);
        });
    });

    // ---- Animação dos títulos ao entrar/sair da tela ----
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

    // ---- Sincronização com a rolagem ----
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

    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", recalcular);
    window.addEventListener("load", recalcular);
    recalcular();
})();
