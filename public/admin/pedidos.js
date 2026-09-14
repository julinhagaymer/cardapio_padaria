"use strict";

/* Painel de PEDIDOS — Kanban. Usa a MESMA sessão de admin.html e não tem
   tela de senha própria: se não houver sessão válida, manda para lá (é o
   único lugar onde a senha é pedida). Enquanto não houver entrada real de
   pedidos, trabalha com os exemplos que o servidor semeia (lib/pedidos.php).
   Trocar por dados reais é só o servidor passar a gravar pedidos no mesmo
   formato. */

(function () {
    var API = "pedidos-api.php";

    var $ = function (id) { return document.getElementById(id); };
    function el(tag, cls, txt) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (txt != null) e.textContent = txt;
        return e;
    }

    // -------- estado --------
    var estado = {
        pedidos: [],
        agora: 0,          // hora do servidor no último carregamento (segundos)
        buscadoEm: 0,      // Date.now()/1000 nesse momento
        filtro: "todos",
        busca: "",
        auto: true,
        som: false,
        primeira: true
    };

    // Tela dividida ao meio: Mesa de um lado, Entrega do outro. Dentro de cada
    // metade, Novos e Em preparação. Não existe fase "Pronto": ao marcar como
    // pronto, o pedido já vai direto para Concluídos — que fica separado
    // embaixo, também dividido Mesa | Entrega na mesma proporção.
    var ORIGENS = [["mesa", "🪑 Mesa"], ["entrega", "🛵 Entrega"]];
    var STATUS_COLS = [
        ["novo", "Novos pedidos"],
        ["preparando", "Em preparação"]
    ];
    var STATUS_LISTA = ["novo", "preparando", "concluido"];
    var ROT_STATUS = { novo: "Novo", preparando: "Em preparação", concluido: "Concluído" };
    var ACOES = {
        novo:       { prox: "preparando", texto: "Aceitar pedido" },
        preparando: { prox: "concluido",  texto: "Marcar como pronto" }
    };
    var ANTERIOR = { preparando: "novo", concluido: "preparando" };
    var FILTROS = [
        ["todos", "Todos"], ["mesa", "Mesa"], ["entrega", "Entrega"],
        ["novo", "Novos"], ["preparando", "Em preparação"], ["concluido", "Concluídos"]
    ];

    // -------- utilidades --------
    function moeda(v) { return "R$ " + (Number(v) || 0).toFixed(2).replace(".", ","); }
    function doisD(n) { n = String(n == null ? "" : n); return n.length < 2 ? "0" + n : n; }
    function agoraServidor() { return estado.agora + (Date.now() / 1000 - estado.buscadoEm); }

    function horaDe(ts) {
        var d = new Date((ts || 0) * 1000);
        return doisD(d.getHours()) + ":" + doisD(d.getMinutes());
    }
    function dataHora(ts) {
        var d = new Date((ts || 0) * 1000);
        return doisD(d.getDate()) + "/" + doisD(d.getMonth() + 1) + " " + doisD(d.getHours()) + ":" + doisD(d.getMinutes());
    }
    function tempoRelativo(seg) {
        seg = Math.max(0, Math.floor(seg));
        if (seg < 60) return "agora";
        var min = Math.floor(seg / 60);
        if (min < 60) return "há " + min + " min";
        var h = Math.floor(min / 60), m = min % 60;
        if (h < 24) return "há " + h + "h" + (m ? " " + m + "min" : "");
        var dias = Math.floor(h / 24);
        return "há " + dias + (dias === 1 ? " dia" : " dias");
    }
    function inicioHoje() {
        var d = new Date(); d.setHours(0, 0, 0, 0);
        return Math.floor(d.getTime() / 1000);
    }
    function lsGet(k, def) { try { var v = localStorage.getItem(k); return v === null ? def : v; } catch (e) { return def; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

    // -------- som (WebAudio, sem arquivo externo) --------
    var audioCtx = null;
    function garantirAudio() {
        try {
            var Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return null;
            if (!audioCtx) audioCtx = new Ctx();
            if (audioCtx.state === "suspended" && audioCtx.resume) audioCtx.resume();
            return audioCtx;
        } catch (e) { return null; }
    }
    function beep() {
        var ctx = garantirAudio();
        if (!ctx) return;
        try {
            var t0 = ctx.currentTime;
            [880, 1245].forEach(function (freq, i) {
                var o = ctx.createOscillator(), g = ctx.createGain();
                var t = t0 + i * 0.15;
                o.type = "sine";
                o.frequency.value = freq;
                g.gain.setValueAtTime(0.0001, t);
                g.gain.exponentialRampToValueAtTime(0.13, t + 0.02);
                g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
                o.connect(g); g.connect(ctx.destination);
                o.start(t); o.stop(t + 0.16);
            });
        } catch (e) {}
    }

    // -------- sessão --------
    // Pedidos não tem tela de senha própria: a única senha é a de admin.html.
    // Sem sessão válida, manda para lá em vez de perguntar de novo aqui.
    function irParaLogin() {
        location.href = "admin.html";
    }
    function sair() {
        fetch(API + "?acao=sair", { method: "POST", credentials: "same-origin" })
            .finally(function () { location.href = "admin.html"; });
    }

    // -------- carregar / aplicar --------
    function carregar() {
        fetch(API, { cache: "no-store", credentials: "same-origin" })
            .then(function (r) {
                if (r.status === 401 || r.status === 403) { irParaLogin(); return null; }
                if (!r.ok) throw new Error("HTTP " + r.status);
                return r.json();
            })
            .then(function (j) {
                if (!j) return;
                document.body.classList.remove("bloqueado");
                $("erroCarregar").hidden = true;
                aplicar(j);
            })
            .catch(function (e) {
                var cx = $("erroCarregar");
                cx.textContent = "Não consegui carregar os pedidos do servidor (" + e.message +
                    "). Confira se o servidor PHP está rodando.";
                cx.hidden = false;
            });
    }

    function aplicar(j) {
        var antes = {};
        estado.pedidos.forEach(function (p) { antes[p.id] = true; });

        estado.agora = j.agora || Math.floor(Date.now() / 1000);
        estado.buscadoEm = Date.now() / 1000;
        estado.pedidos = Array.isArray(j.pedidos) ? j.pedidos : [];

        var novos = 0;
        estado.pedidos.forEach(function (p) {
            if (p.status === "novo" && !antes[p.id]) novos++;
        });
        if (!estado.primeira && novos > 0) {
            piscarPill();
            if (estado.som) beep();
        }
        estado.primeira = false;
        render();
    }

    function piscarPill() {
        var pill = $("pillNovos");
        pill.classList.add("piscou");
        setTimeout(function () { pill.classList.remove("piscou"); }, 1400);
    }

    // -------- diário: contagens, quadro e numeração reiniciam sozinhos à
    // meia-noite, porque tudo é recalculado a partir de "hoje" — nada fica
    // guardado à parte. O servidor mantém os pedidos por mais tempo (ver
    // lib/pedidos.php), só o painel é que só mostra o dia atual.
    function pedidosDeHoje() {
        var hoje = inicioHoje();
        return estado.pedidos.filter(function (p) { return (p.criado_em || 0) >= hoje; });
    }

    // -------- filtro / busca --------
    function pedidosFiltrados() {
        var q = estado.busca.trim().toLowerCase();
        var f = estado.filtro;
        return pedidosDeHoje().filter(function (p) {
            if (f === "mesa" && p.origem !== "mesa") return false;
            if (f === "entrega" && p.origem !== "entrega") return false;
            if (STATUS_LISTA.indexOf(f) !== -1 && p.status !== f) return false;
            if (q) {
                var alvo = String(p.numero) + " " + (p.origem === "mesa" ? "mesa " + p.mesa : "entrega " + (p.cliente || ""));
                if (alvo.toLowerCase().indexOf(q) === -1) return false;
            }
            return true;
        });
    }

    // -------- render --------
    function render() {
        var hojeList = pedidosDeHoje();
        $("stNovos").textContent = hojeList.filter(function (p) { return p.status === "novo"; }).length;
        $("stPrep").textContent = hojeList.filter(function (p) { return p.status === "preparando"; }).length;
        $("stHoje").textContent = hojeList.filter(function (p) { return p.status === "concluido"; }).length;

        var nNovos = Number($("stNovos").textContent);
        var pill = $("pillNovos");
        pill.textContent = nNovos + (nNovos === 1 ? " novo pedido" : " novos pedidos");
        pill.classList.toggle("tem", nNovos > 0);

        var lista = pedidosFiltrados(); // já é só de hoje
        var statusUnico = STATUS_LISTA.indexOf(estado.filtro) !== -1 ? estado.filtro : null;
        var origemUnica = (estado.filtro === "mesa" || estado.filtro === "entrega") ? estado.filtro : null;
        var origens = origemUnica ? ORIGENS.filter(function (o) { return o[0] === origemUnica; }) : ORIGENS;

        // "Concluídos" filtro -> só o quadro de concluídos. "Novos"/"Em
        // preparação" -> só o quadro principal. Sem filtro de status (ou
        // Todos/Mesa/Entrega) -> os dois, na mesma proporção Mesa | Entrega.
        var mostrarPrincipal = statusUnico !== "concluido";
        var mostrarConcluidos = statusUnico === null || statusUnico === "concluido";

        var quadro = $("quadro");
        quadro.hidden = !mostrarPrincipal;
        quadro.className = "metades" + (origemUnica ? " uma-metade" : "");
        quadro.textContent = "";
        if (mostrarPrincipal) {
            var cols = statusUnico ? STATUS_COLS.filter(function (c) { return c[0] === statusUnico; }) : STATUS_COLS;
            origens.forEach(function (o) {
                var doOrigem = lista.filter(function (p) { return p.origem === o[0]; });
                quadro.appendChild(montarMetade(o[0], o[1], doOrigem, cols));
            });
        }

        $("quadroConcluidos").hidden = !mostrarConcluidos;
        var grade = $("gradeConcluidos");
        grade.className = "metades" + (origemUnica ? " uma-metade" : "");
        grade.textContent = "";
        if (mostrarConcluidos) {
            origens.forEach(function (o) {
                var doOrigem = lista.filter(function (p) {
                    return p.origem === o[0] && p.status === "concluido";
                }).sort(function (a, b) { return (b.concluido_em || b.atualizado_em) - (a.concluido_em || a.atualizado_em); });
                grade.appendChild(montarMetadeConcluidos(o[0], o[1], doOrigem));
            });
        }
    }

    function montarMetade(chaveOrigem, titulo, itens, cols) {
        var sec = el("section", "metade");
        var cab = el("div", "metade-cab");
        cab.appendChild(el("h2", null, titulo));
        cab.appendChild(el("span", "metade-cont", String(itens.length)));
        sec.appendChild(cab);

        cols.forEach(function (c) {
            var doStatus = itens.filter(function (p) { return p.status === c[0]; })
                .sort(function (a, b) { return a.criado_em - b.criado_em; });
            sec.appendChild(montarSecaoStatus(c[0], c[1], doStatus));
        });
        return sec;
    }

    // Concluídos de hoje: um cartão por origem, sem sub-seção de status
    // (só existe um status aqui), cortado nos mais recentes.
    function montarMetadeConcluidos(chaveOrigem, titulo, itens) {
        var sec = el("section", "metade metade-concluidos");
        var cab = el("div", "metade-cab");
        cab.appendChild(el("h2", null, titulo));
        cab.appendChild(el("span", "metade-cont", String(itens.length)));
        sec.appendChild(cab);

        var mostrar = itens.slice(0, 18);
        if (mostrar.length) {
            var grade = el("div", "grade-pedidos");
            mostrar.forEach(function (p) { grade.appendChild(cardPedido(p)); });
            sec.appendChild(grade);
            if (itens.length > mostrar.length) {
                sec.appendChild(el("div", "coluna-vazio", "+ " + (itens.length - mostrar.length) + " mais — veja no Histórico."));
            }
        } else {
            sec.appendChild(el("div", "coluna-vazio", "Nada concluído ainda hoje."));
        }
        return sec;
    }

    function montarSecaoStatus(chave, titulo, itens) {
        var s = el("div", "secao-status");
        var cab = el("div", "secao-status-cab");
        cab.appendChild(el("h3", null, titulo));
        cab.appendChild(el("span", "secao-status-cont", String(itens.length)));
        s.appendChild(cab);

        if (itens.length) {
            var grade = el("div", "grade-pedidos");
            itens.forEach(function (p) { grade.appendChild(cardPedido(p)); });
            s.appendChild(grade);
        } else {
            s.appendChild(el("div", "coluna-vazio", "Nada aqui."));
        }
        return s;
    }

    function seloOrigem(p) {
        var s = el("span", "card-ped-origem " + (p.origem === "mesa" ? "origem-mesa" : "origem-entrega"));
        s.textContent = p.origem === "mesa" ? ("🪑 Mesa " + doisD(p.mesa)) : "🛵 Entrega";
        return s;
    }

    function cardPedido(p) {
        var card = el("div", "card-pedido card-pedido--" + p.status);
        card.addEventListener("click", function () { abrirDetalhe(p.id); });

        var topo = el("div", "card-ped-topo");
        topo.appendChild(el("span", "card-ped-num", "#" + p.numero));
        topo.appendChild(seloOrigem(p));
        card.appendChild(topo);

        card.appendChild(el("div", "card-ped-hora",
            horaDe(p.criado_em) + " • " + tempoRelativo(agoraServidor() - p.criado_em)));

        var its = el("div", "card-ped-itens");
        p.itens.forEach(function (it) {
            var linha = el("div");
            linha.appendChild(el("span", "it-nome", it.qtd + "× " + it.nome));
            its.appendChild(linha);
            it.adicionais.forEach(function (a) { its.appendChild(el("div", "it-adic", "+ " + a)); });
        });
        card.appendChild(its);

        if (p.observacao) card.appendChild(el("div", "card-ped-obs", "“" + p.observacao + "”"));

        var rod = el("div", "card-ped-rodape");
        rod.appendChild(el("span", "card-ped-total", moeda(p.total)));

        var acoes = el("div", "card-ped-acoes");
        var btnInfo = el("button", "btn btn-mini", "👤 Dados");
        btnInfo.type = "button";
        btnInfo.title = "Nome, telefone e endereço informados pelo cliente";
        btnInfo.addEventListener("click", function (ev) { ev.stopPropagation(); abrirDadosPessoais(p.id); });
        acoes.appendChild(btnInfo);

        var acao = ACOES[p.status];
        if (acao) {
            var classeAcao = "btn btn-mini " + (p.status === "preparando" ? "btn-sucesso" : "btn-primario");
            var b = el("button", classeAcao, acao.texto);
            b.type = "button";
            b.addEventListener("click", function (ev) { ev.stopPropagation(); mudarStatus(p.id, acao.prox); });
            acoes.appendChild(b);
        } else {
            acoes.appendChild(el("span", "card-ped-hora", "às " + horaDe(p.concluido_em || p.atualizado_em)));
        }
        rod.appendChild(acoes);
        card.appendChild(rod);
        return card;
    }

    // -------- detalhe --------
    function pedidoPorId(id) {
        for (var i = 0; i < estado.pedidos.length; i++) {
            if (estado.pedidos[i].id === id) return estado.pedidos[i];
        }
        return null;
    }

    function linhaDet(rot, valor, forte) {
        var l = el("div", "det-linha" + (forte ? " forte" : ""));
        l.appendChild(el("span", "det-rot", rot));
        l.appendChild(el("span", null, valor));
        return l;
    }

    // Igual a linhaDet, mas o valor é um elemento pronto (ex.: um link) em
    // vez de texto simples.
    function linhaDetNo(rot, noh) {
        var l = el("div", "det-linha");
        l.appendChild(el("span", "det-rot", rot));
        var valor = el("span");
        valor.appendChild(noh);
        l.appendChild(valor);
        return l;
    }

    // -------- notificar cliente pelo WhatsApp --------
    // Não existe envio automático de verdade sem a API oficial do WhatsApp
    // Business (exige conta comercial verificada no Meta e, em geral,
    // modelo de mensagem aprovado). Enquanto isso não existir, isto abre o
    // WhatsApp com o aviso do status atual já escrito pro número do
    // cliente — só falta a atendente apertar enviar.
    function mensagemStatusCliente(p) {
        var saud = "Olá" + (p.cliente ? ", " + p.cliente : "") + "!";
        if (p.status === "novo") {
            return saud + " Recebemos seu pedido #" + p.numero + " na Com Carinho 🥖. " +
                "Aguarde a confirmação — o prazo é de até 10 minutos.";
        }
        if (p.status === "preparando") {
            return "Seu pedido #" + p.numero + " foi confirmado e já está em produção! 👩‍🍳";
        }
        if (p.status === "concluido") {
            return p.modo_entrega === "retirar"
                ? "Seu pedido #" + p.numero + " está pronto! Pode vir retirar na loja. 🏬"
                : "Seu pedido #" + p.numero + " está pronto e já vai sair para entrega! 🛵";
        }
        return "";
    }

    function notificarCliente(p) {
        var msg = mensagemStatusCliente(p);
        if (!p.telefone || !msg) return;
        var numero = p.telefone.replace(/[^\d+]/g, "");
        var url = "https://wa.me/" + numero + "?text=" + encodeURIComponent(msg);
        window.open(url, "_blank", "noopener");
    }

    // -------- dados pessoais (nome/telefone/endereço) — atalho rápido pro
    // vendedor conferir entrega ou ligar pro cliente, sem abrir o pedido
    // inteiro. Mesmo dado que já aparece em "Ver pedido", só que em foco. --------
    function abrirDadosPessoais(id) {
        var p = pedidoPorId(id);
        if (!p) return;

        $("modalTitulo").textContent = "Dados do cliente — Pedido #" + p.numero;
        var corpo = $("modalCorpo");
        corpo.textContent = "";

        corpo.appendChild(linhaDet("Origem", p.origem === "mesa" ? ("🪑 Mesa " + doisD(p.mesa)) : "🛵 Entrega"));
        corpo.appendChild(linhaDet("Nome", p.cliente || "Não informado"));

        if (p.origem === "entrega") {
            if (p.telefone) {
                var link = el("a", null, p.telefone);
                link.href = "tel:" + p.telefone.replace(/[^\d+]/g, "");
                corpo.appendChild(linhaDetNo("Telefone", link));
            } else {
                corpo.appendChild(linhaDet("Telefone", "Não informado"));
            }
            corpo.appendChild(linhaDet(
                "Endereço",
                p.modo_entrega === "retirar" ? "🏬 Retirada na loja" : (p.endereco || "Não informado")
            ));
        }

        var rod = $("modalRodape");
        rod.textContent = "";
        if (p.origem === "entrega" && p.telefone) {
            var notif = el("button", "btn btn-mini", "📲 Notificar sobre o status");
            notif.type = "button";
            notif.title = "Abre o WhatsApp com o aviso do status atual já escrito pro cliente";
            notif.addEventListener("click", function () { notificarCliente(p); });
            rod.appendChild(notif);
        }
        var fc = el("button", "btn btn-primario", "Fechar");
        fc.type = "button";
        fc.setAttribute("data-primario", "1");
        fc.addEventListener("click", fecharModal);
        rod.appendChild(fc);

        $("modal").hidden = false;
    }

    function abrirDetalhe(id) {
        var p = pedidoPorId(id);
        if (!p) return;

        $("modalTitulo").textContent = "Pedido #" + p.numero;
        var corpo = $("modalCorpo");
        corpo.textContent = "";

        corpo.appendChild(linhaDet("Origem", p.origem === "mesa" ? ("🪑 Mesa " + doisD(p.mesa)) : "🛵 Pedido para entrega"));
        if (p.cliente) corpo.appendChild(linhaDet("Cliente", p.cliente));
        if (p.telefone) corpo.appendChild(linhaDet("Telefone", p.telefone));
        if (p.origem === "entrega" && p.modo_entrega === "retirar") {
            corpo.appendChild(linhaDet("Entrega", "🏬 Retirada na loja"));
        } else if (p.endereco) {
            corpo.appendChild(linhaDet("Endereço", p.endereco));
        }
        corpo.appendChild(linhaDet("Horário", horaDe(p.criado_em) + "  ·  " + tempoRelativo(agoraServidor() - p.criado_em)));
        corpo.appendChild(linhaDet("Status atual", ROT_STATUS[p.status] || p.status));

        corpo.appendChild(el("div", "campo-rot-txt", "Itens"));
        var box = el("div", "det-itens");
        p.itens.forEach(function (it) {
            var row = el("div", "det-item");
            var esq = el("div");
            esq.appendChild(el("div", "it-nome", it.qtd + "× " + it.nome));
            it.adicionais.forEach(function (a) { esq.appendChild(el("div", "it-adic", "+ " + a)); });
            if (it.obs) esq.appendChild(el("div", "it-adic", "obs: " + it.obs));
            row.appendChild(esq);
            row.appendChild(el("div", "det-item-preco", moeda(it.qtd * it.preco)));
            box.appendChild(row);
        });
        corpo.appendChild(box);

        if (p.observacao) {
            corpo.appendChild(el("div", "campo-rot-txt", "Observação do cliente"));
            corpo.appendChild(el("div", "card-ped-obs", "“" + p.observacao + "”"));
        }

        corpo.appendChild(linhaDet("Total", moeda(p.total), true));

        var rod = $("modalRodape");
        rod.textContent = "";
        if (ANTERIOR[p.status]) {
            var volta = el("button", "btn btn-mini", "← Voltar status");
            volta.type = "button";
            volta.addEventListener("click", function () { mudarStatus(p.id, ANTERIOR[p.status]); });
            rod.appendChild(volta);
        }
        if (p.origem === "entrega" && p.telefone) {
            var notif = el("button", "btn btn-mini", "📲 Notificar cliente");
            notif.type = "button";
            notif.title = "Abre o WhatsApp com o aviso do status atual já escrito pro cliente";
            notif.addEventListener("click", function () { notificarCliente(p); });
            rod.appendChild(notif);
        }
        var acao = ACOES[p.status];
        if (acao) {
            var classeAcaoModal = "btn " + (p.status === "preparando" ? "btn-sucesso" : "btn-primario");
            var av = el("button", classeAcaoModal, acao.texto);
            av.type = "button";
            av.setAttribute("data-primario", "1");
            av.addEventListener("click", function () { mudarStatus(p.id, acao.prox); });
            rod.appendChild(av);
        } else {
            var fc = el("button", "btn btn-primario", "Fechar");
            fc.type = "button";
            fc.setAttribute("data-primario", "1");
            fc.addEventListener("click", fecharModal);
            rod.appendChild(fc);
        }

        $("modal").hidden = false;
    }

    // -------- histórico (de hoje — o painel é diário) --------
    function abrirHistorico() {
        $("modalTitulo").textContent = "Concluídos hoje — lista completa";
        var corpo = $("modalCorpo");
        corpo.textContent = "";

        corpo.appendChild(el("div", "sub",
            "Pedidos de dias anteriores ficam com os dados completos (nome, telefone, " +
            "endereço) só por 2 dias, por privacidade. Depois disso viram um registro " +
            "anônimo (valor, produtos, mesa ou entrega — sem dado de quem comprou), " +
            "guardado por até 3 meses para uma futura tela de histórico/relatório."));

        var busca = el("input", "busca");
        busca.type = "text";
        busca.placeholder = "Filtrar por nº ou mesa...";
        busca.style.marginTop = "10px";
        corpo.appendChild(busca);

        var lista = el("div", "hist-lista");
        corpo.appendChild(lista);

        function pinta() {
            lista.textContent = "";
            var q = busca.value.trim().toLowerCase();
            var conc = pedidosDeHoje().filter(function (p) { return p.status === "concluido"; })
                .sort(function (a, b) { return (b.concluido_em || b.atualizado_em) - (a.concluido_em || a.atualizado_em); });
            conc.filter(function (p) {
                if (!q) return true;
                var alvo = String(p.numero) + " " + (p.origem === "mesa" ? "mesa " + p.mesa : "entrega " + (p.cliente || ""));
                return alvo.toLowerCase().indexOf(q) !== -1;
            }).forEach(function (p) {
                var row = el("div", "hist-row");
                row.addEventListener("click", function () { abrirDetalhe(p.id); });
                row.appendChild(el("span", "hist-num", "#" + p.numero));
                row.appendChild(el("span", "hist-org", p.origem === "mesa" ? ("Mesa " + doisD(p.mesa)) : "Entrega"));
                row.appendChild(el("span", "hist-data", dataHora(p.concluido_em || p.atualizado_em)));
                row.appendChild(el("span", "hist-total", moeda(p.total)));
                lista.appendChild(row);
            });
            if (!lista.children.length) lista.appendChild(el("div", "sub", "Nenhum pedido concluído ainda."));
        }
        busca.addEventListener("input", pinta);
        pinta();

        var rod = $("modalRodape");
        rod.textContent = "";
        var b = el("button", "btn btn-primario", "Fechar");
        b.type = "button";
        b.setAttribute("data-primario", "1");
        b.addEventListener("click", fecharModal);
        rod.appendChild(b);

        $("modal").hidden = false;
    }

    // -------- mudar status --------
    function mudarStatus(id, novo) {
        fetch(API + "?acao=status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ id: id, status: novo })
        })
            .then(function (r) {
                if (r.status === 401 || r.status === 403) { irParaLogin(); return null; }
                return r.json().catch(function () { return {}; });
            })
            .then(function (j) {
                if (!j) return;
                if (!j.ok) { alert(j.erro || "Não consegui atualizar o pedido."); return; }
                for (var i = 0; i < estado.pedidos.length; i++) {
                    if (estado.pedidos[i].id === j.pedido.id) { estado.pedidos[i] = j.pedido; break; }
                }
                if (j.agora) { estado.agora = j.agora; estado.buscadoEm = Date.now() / 1000; }
                var modalAberto = !$("modal").hidden;
                render();
                if (modalAberto) abrirDetalhe(j.pedido.id);
            })
            .catch(function (e) { alert("Falha de conexão: " + e.message); });
    }

    // -------- modal helpers --------
    function fecharModal() { $("modal").hidden = true; }
    $("modalX").addEventListener("click", fecharModal);
    $("modal").addEventListener("click", function (e) { if (e.target === this) fecharModal(); });
    $("modal").addEventListener("keydown", function (e) {
        if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
            var prim = $("modalRodape").querySelector('[data-primario="1"]');
            if (prim) { e.preventDefault(); prim.click(); }
        }
    });
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && !$("modal").hidden) fecharModal();
    });

    // -------- chips de filtro --------
    (function montarChips() {
        var box = $("chips");
        FILTROS.forEach(function (f) {
            var c = el("button", "chip" + (f[0] === estado.filtro ? " ativo" : ""), f[1]);
            c.type = "button";
            c.setAttribute("data-f", f[0]);
            c.addEventListener("click", function () {
                estado.filtro = f[0];
                [].forEach.call(box.children, function (x) {
                    x.classList.toggle("ativo", x.getAttribute("data-f") === f[0]);
                });
                render();
            });
            box.appendChild(c);
        });
    })();

    // -------- ligações --------
    $("busca").addEventListener("input", function () { estado.busca = this.value; render(); });
    $("btnHistorico").addEventListener("click", abrirHistorico);

    $("btnSimular").addEventListener("click", function () {
        var b = this;
        b.disabled = true;
        fetch(API + "?acao=simular", { method: "POST", credentials: "same-origin" })
            .then(function (r) { return r.json().catch(function () { return {}; }); })
            .then(function (j) { if (j && j.ok) carregar(); })
            .catch(function () {})
            .finally(function () { b.disabled = false; });
    });

    estado.auto = lsGet("ped_auto", "1") === "1";
    estado.som = lsGet("ped_som", "0") === "1";
    $("tgAuto").checked = estado.auto;
    $("tgSom").checked = estado.som;
    $("tgAuto").addEventListener("change", function () {
        estado.auto = this.checked; lsSet("ped_auto", this.checked ? "1" : "0");
    });
    $("tgSom").addEventListener("change", function () {
        estado.som = this.checked; lsSet("ped_som", this.checked ? "1" : "0");
        if (this.checked) { garantirAudio(); beep(); }
    });

    $("btnSair").addEventListener("click", sair);

    // -------- laços --------
    setInterval(function () {
        if (estado.auto && !document.hidden && $("modal").hidden) carregar();
    }, 15000);
    setInterval(function () {
        if ($("modal").hidden && !document.body.classList.contains("bloqueado")) render();
    }, 45000);

    // Sem tela de senha própria: só confere a sessão que já veio de
    // admin.html. Se não houver, carregar() manda para lá.
    carregar();
})();
