"use strict";

(function () {
    const $ = function (id) { return document.getElementById(id); };
    const clonar = function (o) { return JSON.parse(JSON.stringify(o)); };

    // Escapa texto antes de colocá-lo em HTML (equivale ao htmlspecialchars do PHP).
    const escaparHtml = function (s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    };

    let modelo = null;
    let salvo = true;
    let filtroProduto = "";
    let modoOrdem = false;
    let modoOrdemSecoes = false;
    let modoOrdemAdicionais = false;
    let modalConfirmar = null;
    // navLateral() troca isto pela função real assim que monta a barra lateral;
    // esconderLogin() chama para acertar o item ativo assim que o painel aparece.
    let atualizarNavAtiva = function () {};

    // =========================================================================
    // Utilidades
    // =========================================================================
    function slug(txt) {
        return String(txt || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
            .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
    }
    function idUnico(base, usados) {
        const s = slug(base);
        let tent = s, n = 2;
        while (usados.indexOf(tent) !== -1) { tent = s + "-" + n; n++; }
        return tent;
    }
    function num(v) {
        const n = parseFloat(String(v).replace(",", "."));
        return isFinite(n) && n >= 0 ? n : 0;
    }
    function mover(arr, i, dir) {
        const j = i + dir;
        if (j < 0 || j >= arr.length) return false;
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        return true;
    }
    function moeda(v) { return "R$ " + (Number(v) || 0).toFixed(2).replace(".", ","); }
    function formatarNum(v) { return (Number(v) || 0).toFixed(2).replace(".", ","); }

    // Campo de preço com "R$" fixo na frente. aoMudar recebe o número.
    function campoPreco(valorInicial, aoMudar) {
        const wrap = document.createElement("div");
        wrap.className = "campo-preco";
        const rs = document.createElement("span");
        rs.className = "prefixo-rs";
        rs.textContent = "R$";
        const inp = document.createElement("input");
        inp.type = "text";
        inp.inputMode = "numeric";
        inp.autocomplete = "off";
        inp.value = formatarNum(valorInicial);

        // Só aceita números; a vírgula se posiciona sozinha, tratando o que foi
        // digitado como centavos: 5 -> 0,05 | 125 -> 1,25 | 1250 -> 12,50.
        function mascarar() {
            const dig = inp.value.replace(/\D/g, "").slice(0, 12);
            const centavos = dig === "" ? 0 : parseInt(dig, 10);
            inp.value = dig === "" ? "" : formatarNum(centavos / 100);
            aoMudar(centavos / 100);
        }

        // Ao focar num campo ainda zerado, limpa o "0,00" para o dono já digitar
        // sem precisar apagar; num campo com valor, seleciona tudo para substituir.
        inp.addEventListener("focus", function () {
            if (num(inp.value) === 0) inp.value = "";
            else inp.select();
        });
        inp.addEventListener("input", mascarar);
        inp.addEventListener("blur", function () { inp.value = formatarNum(num(inp.value)); });
        wrap.appendChild(rs);
        wrap.appendChild(inp);
        return wrap;
    }
    function resumoPreco(prod) {
        if (prod.tipo === "pizza") {
            if (!modelo.tamanhos.length) return "—";
            let menor = Infinity;
            modelo.tamanhos.forEach(function (t) { const x = Number(t.preco) || 0; if (x < menor) menor = x; });
            return "A partir de " + moeda(menor === Infinity ? 0 : menor);
        }
        return moeda(prod.preco);
    }

    // Limpeza local só para a tela ficar consistente enquanto edita.
    // A validação que vale é a do servidor (dados.php).
    function normalizar(m) {
        m = m || {};
        m.categorias = Array.isArray(m.categorias) ? m.categorias : [];
        m.produtos = Array.isArray(m.produtos) ? m.produtos : [];
        m.tamanhos = Array.isArray(m.tamanhos) ? m.tamanhos : [];
        m.bordas = Array.isArray(m.bordas) ? m.bordas : [];
        m.adicionais = Array.isArray(m.adicionais) ? m.adicionais : [];

        const idsCat = [];
        m.categorias.forEach(function (c) {
            c.nome = String(c.nome || "").trim() || "Seção";
            if (!c.id || idsCat.indexOf(c.id) !== -1) c.id = idUnico(c.nome, idsCat);
            idsCat.push(c.id);
        });
        if (!m.categorias.length) { m.categorias.push({ id: "geral", nome: "Geral" }); idsCat.push("geral"); }

        m.tamanhos = m.tamanhos.map(function (t) { return { rotulo: String(t.rotulo || "").trim() || "Tamanho", preco: num(t.preco) }; });
        m.bordas = m.bordas.map(function (b) { return { rotulo: String(b.rotulo || "").trim() || "Borda", preco: num(b.preco) }; });

        const idsAdd = [];
        m.adicionais = m.adicionais.map(function (a) {
            const rot = String(a.rotulo || "").trim() || "Adicional";
            let id = String(a.id || "");
            if (!id || idsAdd.indexOf(id) !== -1) id = idUnico(rot, idsAdd);
            idsAdd.push(id);
            return { id: id, rotulo: rot, preco: num(a.preco) };
        });

        const idsProd = [];
        m.produtos.forEach(function (p) {
            p.nome = String(p.nome || "").trim() || "Produto";
            p.descricao = String(p.descricao || "").trim();
            if (!p.id || idsProd.indexOf(p.id) !== -1) p.id = idUnico(p.nome, idsProd);
            idsProd.push(p.id);
            p.tipo = p.tipo === "pizza" ? "pizza" : "simples";
            if (p.tipo === "pizza") { delete p.preco; }
            else { p.preco = num(p.preco); }
            if (idsCat.indexOf(p.categoria) === -1) p.categoria = idsCat[0];
            p.imagem = imagemOk(p.imagem || "");
            const base = Array.isArray(p.adicionais) ? p.adicionais : (p.tipo === "pizza" ? idsAdd.slice() : []);
            p.adicionais = base.filter(function (x, i) { return idsAdd.indexOf(x) !== -1 && base.indexOf(x) === i; });
        });

        m.whatsapp = String(m.whatsapp || "").replace(/\D/g, "");
        m.limiteObservacao = num(m.limiteObservacao) || 500;
        return m;
    }

    function imagemOk(url) {
        if (typeof url !== "string" || url === "") return "";
        if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(url)) return url;
        try {
            const u = new URL(url, location.href);
            if (u.protocol === "https:" && u.hostname === "images.unsplash.com") return u.href;
        } catch (e) {}
        return "";
    }

    function marcarNaoSalvo() { salvo = false; renderEstado(); }
    function renderEstado() {
        const el = $("estado");
        el.textContent = salvo ? "Publicado" : "Alterações não salvas";
        el.className = "estado " + (salvo ? "ok" : "pendente");
    }

    // =========================================================================
    // Carregar / salvar (servidor)
    // =========================================================================
    function carregar() {
        fetch("api.php", { cache: "no-store", credentials: "same-origin" })
            .then(function (r) {
                if (r.status === 401 || r.status === 403) { mostrarLogin(); return null; }
                if (!r.ok) throw new Error("HTTP " + r.status);
                return r.json();
            })
            .then(function (dados) {
                if (!dados) return; // precisa entrar
                esconderLogin();
                modelo = normalizar(dados);
                salvo = true;
                try {
                    renderTudo();
                } catch (err) {
                    atualizarStats();
                    const cx = $("erroCarregar");
                    cx.innerHTML = "<strong>Os dados carregaram, mas houve um erro ao montar a tela.</strong>" +
                        "<br><span style=\"opacity:.7\">" + escaparHtml(err && err.message) + "</span>";
                    cx.hidden = false;
                    if (window.console) console.error(err);
                }
            })
            .catch(function (e) {
                document.body.classList.remove("bloqueado");
                $("estado").textContent = "Sem conexão com o servidor";
                $("estado").className = "estado pendente";

                let dica;
                if (location.protocol === "file:") {
                    dica = "Você abriu o arquivo direto (endereço começa com <b>file://</b>). " +
                        "É preciso abrir pelo servidor PHP: rode o <b>servidor.bat</b> e acesse " +
                        "<b>http://localhost:8000/admin/admin.html</b> no navegador (Chrome/Edge).";
                } else {
                    dica = "O endereço parece certo, mas o <b>api.php</b> não respondeu. " +
                        "Confira se o servidor PHP está rodando (janela do <b>servidor.bat</b> aberta) " +
                        "e se a hospedagem tem PHP. Não use o \"Live Preview\" do editor — ele não executa PHP.";
                }

                const cx = $("erroCarregar");
                cx.innerHTML = "<strong>Não consegui carregar o cardápio do servidor.</strong><br>" +
                    dica + "<br><span style=\"opacity:.7\">Detalhe técnico: " + escaparHtml(e.message) + "</span>";
                cx.hidden = false;
                cx.scrollIntoView({ behavior: "smooth", block: "center" });
            });
    }

    function salvar() {
        if (!modelo) return;
        normalizar(modelo);

        const btns = [$("btnSalvar"), $("btnSalvarFim")].filter(Boolean);
        const btn = btns[0];
        btns.forEach(function (b) { b.disabled = true; b.textContent = "Publicando..."; });

        fetch("api.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify(modelo)
        })
            .then(function (r) {
                return r.json().catch(function () { return {}; }).then(function (j) {
                    return { status: r.status, ok: r.ok, corpo: j };
                });
            })
            .then(function (res) {
                if (res.status === 401 || res.status === 403) {
                    mostrarLogin();
                    return;
                }
                if (!res.ok || !res.corpo.ok) {
                    throw new Error(res.corpo.erro || ("HTTP " + res.status));
                }
                if (res.corpo.catalogo) {
                    modelo = normalizar(res.corpo.catalogo);
                    renderTudo();
                }
                salvo = true;
                renderEstado();
                modalSucesso();
            })
            .catch(function (e) {
                alert("Não consegui publicar: " + e.message);
            })
            .finally(function () {
                btns.forEach(function (b) {
                    b.disabled = false;
                    if (b.textContent === "Publicando...") b.textContent = "Salvar e publicar";
                });
            });
    }

    // Círculo verde com um "check" branco (SVG embutido, sem imagem externa).
    function iconeSucesso() {
        const ns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(ns, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("width", "58");
        svg.setAttribute("height", "58");
        svg.setAttribute("aria-hidden", "true");
        const c = document.createElementNS(ns, "circle");
        c.setAttribute("cx", "12");
        c.setAttribute("cy", "12");
        c.setAttribute("r", "12");
        c.setAttribute("fill", "#43a047");
        const p = document.createElementNS(ns, "path");
        p.setAttribute("d", "M6.3 12.5l3.8 3.8 7.6-8");
        p.setAttribute("fill", "none");
        p.setAttribute("stroke", "#ffffff");
        p.setAttribute("stroke-width", "2.4");
        p.setAttribute("stroke-linecap", "round");
        p.setAttribute("stroke-linejoin", "round");
        svg.appendChild(c);
        svg.appendChild(p);
        return svg;
    }

    // Aviso de "deu certo" depois de publicar, com atalhos.
    function modalSucesso() {
        abrirModal("", function (corpo) {
            const bloco = document.createElement("div");
            bloco.className = "modal-sucesso";
            const ic = document.createElement("div");
            ic.className = "ok-emoji";
            ic.appendChild(iconeSucesso());
            const tx = document.createElement("div");
            tx.className = "ok-texto";
            tx.textContent = "Alterações salvas com sucesso";
            bloco.appendChild(ic);
            bloco.appendChild(tx);
            corpo.appendChild(bloco);
            return null;
        }, [
            { texto: "Ver cardápio", acao: function () {
                window.open("../site/", "_blank", "noopener");
                fecharModal();
            } },
            { texto: "Continuar editando", primario: true, acao: fecharModal }
        ], "sucesso");
    }

    // =========================================================================
    // Login (a senha fica só no servidor, em dados.php)
    // =========================================================================
    function mostrarLogin() {
        document.body.classList.add("bloqueado");
        $("estado").textContent = "Bloqueado";
        $("estado").className = "estado pendente";
        const inp = $("senhaLogin");
        if (inp) { inp.value = ""; setTimeout(function () { inp.focus(); }, 50); }
    }
    function esconderLogin() {
        document.body.classList.remove("bloqueado");
        $("erroLogin").hidden = true;
        atualizarNavAtiva();
    }
    let contagemRegressiva = null;
    function bloquearBotao(segundos) {
        const btn = $("btnEntrar");
        const rotulo = "Entrar";
        clearInterval(contagemRegressiva);
        let resta = Math.max(0, Math.floor(segundos));
        btn.disabled = true;
        const tick = function () {
            if (resta <= 0) {
                clearInterval(contagemRegressiva);
                contagemRegressiva = null;
                btn.disabled = false;
                btn.textContent = rotulo;
                return;
            }
            const m = Math.floor(resta / 60), s = resta % 60;
            btn.textContent = "Aguarde " + (m > 0 ? m + "m " : "") + s + "s";
            resta--;
        };
        tick();
        contagemRegressiva = setInterval(tick, 1000);
    }

    function entrar() {
        const inp = $("senhaLogin");
        const erro = $("erroLogin");
        if ($("btnEntrar").disabled) return; // em contagem regressiva de bloqueio
        const val = inp.value.trim(); // tira espaço/quebra-de-linha que vem ao colar
        if (!val) { inp.focus(); return; }
        $("btnEntrar").disabled = true;
        fetch("api.php?acao=entrar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ senha: val })
        })
            .then(function (r) { return r.json().catch(function () { return {}; }); })
            .then(function (j) {
                if (j.ok) { erro.hidden = true; carregar(); return; }
                erro.textContent = j.erro || "Senha incorreta.";
                erro.hidden = false;
                inp.select();
                if (j.espera) {
                    bloquearBotao(j.espera);
                } else {
                    $("btnEntrar").disabled = false;
                }
            })
            .catch(function () {
                erro.textContent = "Falha de conexão com o servidor.";
                erro.hidden = false;
                $("btnEntrar").disabled = false;
            });
    }
    function sair() {
        fetch("api.php?acao=sair", { method: "POST", credentials: "same-origin" })
            .finally(function () { location.reload(); });
    }

    // =========================================================================
    // Render
    // =========================================================================
    function renderTudo() {
        atualizarStats();
        renderEstado();
        renderSecoes();
        renderProdutos();
        renderOpcoes("listaAdicionais", modelo.adicionais);
        renderOpcoes("listaTamanhos", modelo.tamanhos);
        renderOpcoes("listaBordas", modelo.bordas);
    }

    function campoRotulado(rotulo, el) {
        const w = document.createElement("div");
        w.className = "campo-rot";
        const t = document.createElement("div");
        t.className = "campo-rot-txt";
        t.textContent = rotulo;
        w.appendChild(t);
        w.appendChild(el);
        return w;
    }

    function atualizarStats() {
        if (!modelo) return;
        $("statProdutos").textContent = String((modelo.produtos || []).length);
        $("statSecoes").textContent = String((modelo.categorias || []).length);
        $("statAdicionais").textContent = String((modelo.adicionais || []).length);
    }

    function botaoIcone(txt, titulo, aoClicar) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn-icone";
        b.textContent = txt;
        b.title = titulo;
        b.addEventListener("click", aoClicar);
        return b;
    }

    // ---- Helpers compartilhados: linha compacta com "Editar", linha de ordenação ----
    function avisoOrdem(html) {
        const d = document.createElement("div");
        d.className = "sub";
        d.style.margin = "0 0 12px";
        d.innerHTML = html;
        return d;
    }
    function textoVazio(t) {
        const d = document.createElement("div");
        d.className = "sub";
        d.style.margin = "0";
        d.textContent = t;
        return d;
    }
    function linhaOrdem(texto, primeiro, ultimo, onUp, onDown) {
        const linha = document.createElement("div");
        linha.className = "ordem-linha";
        const n = document.createElement("span");
        n.className = "ordem-nome";
        n.textContent = texto;
        linha.appendChild(n);
        const bU = document.createElement("button");
        bU.type = "button"; bU.className = "btn btn-mini"; bU.textContent = "↑ Subir";
        bU.disabled = primeiro;
        bU.addEventListener("click", onUp);
        linha.appendChild(bU);
        const bD = document.createElement("button");
        bD.type = "button"; bD.className = "btn btn-mini"; bD.textContent = "↓ Descer";
        bD.disabled = ultimo;
        bD.addEventListener("click", onDown);
        linha.appendChild(bD);
        return linha;
    }

    // Linha só de leitura + botão "Editar" que abre os campos ali mesmo.
    // opts: { rotulo:fn, detalhe:fn|null, montarCampos:fn->el, aoConcluir:fn|null, aoExcluir:fn|null }
    function itemEditavel(opts) {
        const wrap = document.createElement("div");

        function verCompacto() {
            wrap.className = "item-linha";
            wrap.textContent = "";
            const r = document.createElement("span");
            r.className = "item-rotulo";
            r.textContent = opts.rotulo();
            wrap.appendChild(r);
            if (opts.detalhe) {
                const d = document.createElement("span");
                d.className = "item-detalhe";
                d.textContent = opts.detalhe();
                wrap.appendChild(d);
            }
            const b = document.createElement("button");
            b.type = "button"; b.className = "btn btn-mini"; b.textContent = "Editar";
            b.addEventListener("click", verEdicao);
            wrap.appendChild(b);
        }

        function verEdicao() {
            wrap.className = "item-edit";
            wrap.textContent = "";
            wrap.appendChild(opts.montarCampos());
            const acoes = document.createElement("div");
            acoes.className = "item-edit-acoes";
            const bOk = document.createElement("button");
            bOk.type = "button"; bOk.className = "btn btn-mini"; bOk.textContent = "Concluir";
            bOk.addEventListener("click", function () {
                verCompacto();
                if (opts.aoConcluir) opts.aoConcluir();
            });
            acoes.appendChild(bOk);
            if (opts.aoExcluir) {
                const bDel = document.createElement("button");
                bDel.type = "button"; bDel.className = "btn btn-mini btn-perigo"; bDel.textContent = "Excluir";
                bDel.addEventListener("click", function () { opts.aoExcluir(); });
                acoes.appendChild(bDel);
            }
            wrap.appendChild(acoes);
        }

        verCompacto();
        return wrap;
    }

    // ---- Seções ----
    function renderSecoes() {
        const box = $("listaSecoes");
        box.textContent = "";

        if (modoOrdemSecoes) {
            box.appendChild(avisoOrdem("Use <b>Subir</b> e <b>Descer</b> para mudar a ordem das seções no cardápio."));
            modelo.categorias.forEach(function (cat, i) {
                box.appendChild(linhaOrdem(
                    (i + 1) + ". " + cat.nome,
                    i === 0, i === modelo.categorias.length - 1,
                    function () { if (mover(modelo.categorias, i, -1)) { marcarNaoSalvo(); renderSecoes(); renderProdutos(); } },
                    function () { if (mover(modelo.categorias, i, 1)) { marcarNaoSalvo(); renderSecoes(); renderProdutos(); } }
                ));
            });
            if (!modelo.categorias.length) box.appendChild(textoVazio("Nenhuma seção."));
            return;
        }

        modelo.categorias.forEach(function (cat) {
            box.appendChild(itemEditavel({
                rotulo: function () { return cat.nome; },
                montarCampos: function () {
                    const inp = document.createElement("input");
                    inp.type = "text";
                    inp.value = cat.nome;
                    inp.placeholder = "Nome da seção";
                    inp.addEventListener("input", function () { cat.nome = inp.value; marcarNaoSalvo(); });
                    return campoRotulado("Nome da seção", inp);
                },
                aoConcluir: function () { renderProdutos(); },
                aoExcluir: function () {
                    const qtd = modelo.produtos.filter(function (p) { return p.categoria === cat.id; }).length;
                    let msg = "Excluir a seção \"" + cat.nome + "\"?";
                    if (qtd) msg += "\nOs " + qtd + " produto(s) dela vão para a primeira seção.";
                    if (!confirm(msg)) return;
                    modelo.categorias.splice(modelo.categorias.indexOf(cat), 1);
                    normalizar(modelo);
                    marcarNaoSalvo();
                    renderTudo();
                }
            }));
        });
        if (!modelo.categorias.length) box.appendChild(textoVazio("Nenhuma seção ainda. Clique em “+ Adicionar Seção”."));
    }

    // ---- Produtos ----
    function renderProdutos() {
        const box = $("listaProdutos");
        box.textContent = "";

        if (modoOrdem) { renderOrdenacao(box); return; }

        const q = filtroProduto.trim().toLowerCase();

        modelo.categorias.forEach(function (cat) {
            const doGrupo = modelo.produtos.filter(function (p) {
                return p.categoria === cat.id &&
                    (!q || (p.nome || "").toLowerCase().indexOf(q) !== -1);
            });
            if (q && !doGrupo.length) return;

            const grupo = document.createElement("div");
            grupo.className = "grupo-cat";

            const cab = document.createElement("div");
            cab.className = "grupo-cat-cab";
            const h = document.createElement("h3");
            h.textContent = cat.nome;
            cab.appendChild(h);
            if (doGrupo.length) {
                const bDup = document.createElement("button");
                bDup.type = "button";
                bDup.className = "btn btn-mini";
                bDup.textContent = "Duplicar produto";
                bDup.title = "Escolher um produto desta seção para copiar";
                bDup.addEventListener("click", function () { modalEscolherDuplicar(cat, doGrupo); });
                cab.appendChild(bDup);
            }
            grupo.appendChild(cab);

            if (doGrupo.length) {
                const grade = document.createElement("div");
                grade.className = "grid-produtos";
                doGrupo.forEach(function (prod) { grade.appendChild(cardProduto(prod)); });
                grupo.appendChild(grade);
            } else {
                grupo.appendChild(textoVazio("Nenhum produto nesta seção."));
            }

            box.appendChild(grupo);
        });

        if (!box.children.length) {
            box.appendChild(textoVazio(q ? "Nenhum produto encontrado." : "Nenhum produto ainda."));
        }
    }

    // Modo "Editar ordem": lista simples com Subir / Descer por produto, dentro de cada seção.
    function renderOrdenacao(box) {
        box.appendChild(avisoOrdem(
            "Use <b>Subir</b> e <b>Descer</b> para mudar a posição de cada produto na sua seção. " +
            "Essa é a ordem em que eles aparecem no cardápio."
        ));

        let algum = false;
        modelo.categorias.forEach(function (cat) {
            const doGrupo = modelo.produtos.filter(function (p) { return p.categoria === cat.id; });
            if (!doGrupo.length) return;
            algum = true;

            const grupo = document.createElement("div");
            grupo.className = "grupo-cat";
            const h = document.createElement("h3");
            h.textContent = cat.nome;
            grupo.appendChild(h);

            doGrupo.forEach(function (prod, iLocal) {
                grupo.appendChild(linhaOrdem(
                    (iLocal + 1) + ". " + prod.nome,
                    iLocal === 0, iLocal === doGrupo.length - 1,
                    function () { if (reordenarProduto(prod, -1)) { marcarNaoSalvo(); renderProdutos(); } },
                    function () { if (reordenarProduto(prod, 1)) { marcarNaoSalvo(); renderProdutos(); } }
                ));
            });

            box.appendChild(grupo);
        });

        if (!algum) box.appendChild(textoVazio("Nenhum produto para ordenar."));
    }

    function reordenarProduto(prod, dir) {
        const mesma = [];
        modelo.produtos.forEach(function (p, idx) {
            if (p.categoria === prod.categoria) mesma.push(idx);
        });
        const pos = mesma.indexOf(modelo.produtos.indexOf(prod));
        if (pos === -1 || pos + dir < 0 || pos + dir >= mesma.length) return false;
        const i = mesma[pos], j = mesma[pos + dir];
        const t = modelo.produtos[i]; modelo.produtos[i] = modelo.produtos[j]; modelo.produtos[j] = t;
        return true;
    }

    function atualizarFoto(box, url) {
        const ok = imagemOk(url || "");
        if (ok) {
            box.style.backgroundImage = 'url("' + ok.replace(/"/g, "%22") + '")';
            box.textContent = "";
        } else {
            box.style.backgroundImage = "";
            box.textContent = "sem foto";
        }
    }

    // Card compacto na lista (2 por fileira no desktop). "Editar" abre a tela.
    function cardProduto(prod) {
        const card = document.createElement("div");
        card.className = "card-produto";
        card.setAttribute("data-prod", prod.id);

        const row = document.createElement("div");
        row.className = "prod-compacto";

        const mini = document.createElement("div");
        mini.className = "prod-mini";
        const u = imagemOk(prod.imagem || "");
        if (u) mini.style.backgroundImage = 'url("' + u.replace(/"/g, "%22") + '")';
        row.appendChild(mini);

        const info = document.createElement("div");
        info.className = "prod-info";
        const n = document.createElement("div"); n.className = "prod-nome"; n.textContent = prod.nome;
        const p = document.createElement("div"); p.className = "prod-preco"; p.textContent = resumoPreco(prod);
        info.appendChild(n); info.appendChild(p);
        row.appendChild(info);

        const bEditar = document.createElement("button");
        bEditar.type = "button";
        bEditar.className = "btn btn-mini";
        bEditar.textContent = "Editar";
        bEditar.addEventListener("click", function () { abrirModalEditarProduto(prod); });
        row.appendChild(bEditar);

        card.appendChild(row);
        return card;
    }

    function selecaoCategorias(atual, aoMudar) {
        const sel = document.createElement("select");
        modelo.categorias.forEach(function (c) {
            const o = document.createElement("option");
            o.value = c.id; o.textContent = c.nome;
            if (c.id === atual) o.selected = true;
            sel.appendChild(o);
        });
        sel.addEventListener("change", function () { aoMudar(sel.value); });
        return sel;
    }

    // Bloco de foto: prévia + "enviar do dispositivo" + link. Serve para editar
    // um produto e para criar um novo. getUrl/setUrl leem e gravam o valor.
    function blocoFoto(getUrl, setUrl) {
        const wrap = document.createElement("div");
        wrap.className = "bloco-foto";

        const foto = document.createElement("div");
        foto.className = "editor-foto";
        atualizarFoto(foto, getUrl());
        wrap.appendChild(foto);

        const inpUrl = document.createElement("input");
        inpUrl.type = "text";
        inpUrl.placeholder = "ou cole um link de imagem (https)";
        const atual = getUrl() || "";
        inpUrl.value = /^data:/.test(atual) ? "(foto enviada)" : atual;
        inpUrl.addEventListener("focus", function () { if (inpUrl.value === "(foto enviada)") inpUrl.value = ""; });
        inpUrl.addEventListener("input", function () {
            setUrl(inpUrl.value.trim());
            atualizarFoto(foto, inpUrl.value.trim());
        });

        const acoes = document.createElement("div");
        acoes.className = "foto-acoes";

        const lblEnviar = document.createElement("label");
        lblEnviar.className = "btn btn-mini";
        lblEnviar.textContent = "Enviar foto do dispositivo";
        const inpArq = document.createElement("input");
        inpArq.type = "file";
        inpArq.accept = "image/*";
        inpArq.hidden = true;
        inpArq.addEventListener("change", function () {
            const f = inpArq.files && inpArq.files[0];
            inpArq.value = "";
            if (!f) return;
            processarFoto(f, function (dataUri) {
                setUrl(dataUri);
                atualizarFoto(foto, dataUri);
                inpUrl.value = "(foto enviada)";
            });
        });
        lblEnviar.appendChild(inpArq);
        acoes.appendChild(lblEnviar);

        const btnLimpar = document.createElement("button");
        btnLimpar.type = "button";
        btnLimpar.className = "btn btn-mini";
        btnLimpar.textContent = "Remover foto";
        btnLimpar.addEventListener("click", function () {
            setUrl("");
            atualizarFoto(foto, "");
            inpUrl.value = "";
        });
        acoes.appendChild(btnLimpar);

        wrap.appendChild(acoes);
        wrap.appendChild(campoModal("Link da imagem", inpUrl));
        return wrap;
    }

    // Caixa de seleção dos adicionais que este produto exibe para o cliente.
    function blocoAdicionaisProduto(prod) {
        const box = document.createElement("div");
        box.className = "check-adicionais";
        if (!Array.isArray(prod.adicionais)) prod.adicionais = [];

        if (!modelo.adicionais.length) {
            const vazio = document.createElement("div");
            vazio.className = "sub";
            vazio.style.margin = "0";
            vazio.textContent = "Nenhum adicional cadastrado. Cadastre em “Adicionais e opções de pizza”.";
            box.appendChild(vazio);
            return box;
        }

        modelo.adicionais.forEach(function (a) {
            const linha = document.createElement("label");
            linha.className = "check-linha";
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = prod.adicionais.indexOf(a.id) !== -1;
            cb.addEventListener("change", function () {
                const i = prod.adicionais.indexOf(a.id);
                if (cb.checked && i === -1) prod.adicionais.push(a.id);
                else if (!cb.checked && i !== -1) prod.adicionais.splice(i, 1);
                marcarNaoSalvo();
            });
            const tx = document.createElement("span");
            tx.textContent = a.rotulo + (a.preco ? "  (+ " + moeda(a.preco) + ")" : "");
            linha.appendChild(cb);
            linha.appendChild(tx);
            box.appendChild(linha);
        });
        return box;
    }

    // Formulário completo do produto (usado dentro do modal de edição).
    function montarEditorProduto(prod) {
        const box = document.createElement("div");
        box.className = "editor-produto";

        const cap = document.createElement("div");
        cap.className = "campo-rot-txt";
        cap.textContent = "Imagem do produto";
        box.appendChild(cap);
        box.appendChild(blocoFoto(
            function () { return prod.imagem; },
            function (v) { prod.imagem = v; marcarNaoSalvo(); }
        ));

        const inpNome = document.createElement("input");
        inpNome.type = "text";
        inpNome.value = prod.nome;
        inpNome.addEventListener("input", function () { prod.nome = inpNome.value; marcarNaoSalvo(); });
        box.appendChild(campoModal("Nome do produto", inpNome));

        const inpDesc = document.createElement("textarea");
        inpDesc.rows = 3;
        inpDesc.value = prod.descricao || "";
        inpDesc.addEventListener("input", function () { prod.descricao = inpDesc.value; marcarNaoSalvo(); });
        box.appendChild(campoModal("Descrição", inpDesc));

        const selTipo = document.createElement("select");
        [["simples", "Simples (preço fixo)"], ["pizza", "Pizza (tamanho/borda)"]].forEach(function (o) {
            const op = document.createElement("option");
            op.value = o[0]; op.textContent = o[1];
            if (prod.tipo === o[0]) op.selected = true;
            selTipo.appendChild(op);
        });
        box.appendChild(campoModal("Tipo", selTipo));

        const campoDoPreco = campoModal("Preço", campoPreco(prod.preco, function (v) { prod.preco = v; marcarNaoSalvo(); }));
        campoDoPreco.style.display = prod.tipo === "pizza" ? "none" : "";
        box.appendChild(campoDoPreco);

        selTipo.addEventListener("change", function () {
            prod.tipo = selTipo.value;
            if (prod.tipo === "pizza") { delete prod.preco; }
            else if (typeof prod.preco !== "number") { prod.preco = 0; }
            campoDoPreco.style.display = prod.tipo === "pizza" ? "none" : "";
            marcarNaoSalvo();
        });

        box.appendChild(campoModal("Seção", selecaoCategorias(prod.categoria, function (v) {
            prod.categoria = v;
            marcarNaoSalvo();
        })));

        box.appendChild(campoModal("Adicionais que aparecem neste produto", blocoAdicionaisProduto(prod)));

        return box;
    }

    function abrirModalEditarProduto(prod) {
        abrirModal("Editar produto", function (corpo) {
            corpo.appendChild(montarEditorProduto(prod));
            const primeiro = corpo.querySelector("input[type='text'], textarea");
            return primeiro;
        }, [
            { texto: "Excluir produto", perigo: true, acao: function () {
                if (!confirm("Excluir \"" + prod.nome + "\"?")) return;
                const idx = modelo.produtos.indexOf(prod);
                if (idx !== -1) modelo.produtos.splice(idx, 1);
                marcarNaoSalvo();
                renderProdutos();
                atualizarStats();
                fecharModal();
            } },
            { texto: "Concluir", primario: true, acao: function () {
                renderProdutos();
                fecharModal();
            } }
        ]);
    }

    // ---- Adicionais / tamanhos / bordas ----
    function renderOpcoes(idBox, lista) {
        const box = $(idBox);
        box.textContent = "";

        if (modoOrdemAdicionais) {
            lista.forEach(function (item, i) {
                box.appendChild(linhaOrdem(
                    (i + 1) + ". " + item.rotulo,
                    i === 0, i === lista.length - 1,
                    function () { if (mover(lista, i, -1)) { marcarNaoSalvo(); renderOpcoes(idBox, lista); } },
                    function () { if (mover(lista, i, 1)) { marcarNaoSalvo(); renderOpcoes(idBox, lista); } }
                ));
            });
            if (!lista.length) box.appendChild(textoVazio("Vazio."));
            return;
        }

        lista.forEach(function (item) {
            box.appendChild(itemEditavel({
                rotulo: function () { return item.rotulo; },
                detalhe: function () { return moeda(item.preco); },
                montarCampos: function () {
                    const campos = document.createElement("div");
                    campos.className = "item-edit-campos";
                    const inpNome = document.createElement("input");
                    inpNome.type = "text";
                    inpNome.value = item.rotulo;
                    inpNome.placeholder = "Nome";
                    inpNome.addEventListener("input", function () { item.rotulo = inpNome.value; marcarNaoSalvo(); });
                    campos.appendChild(campoRotulado("Nome", inpNome));
                    campos.appendChild(campoRotulado("Preço", campoPreco(item.preco, function (v) { item.preco = v; marcarNaoSalvo(); })));
                    return campos;
                },
                aoExcluir: function () {
                    if (!confirm("Excluir \"" + item.rotulo + "\"?")) return;
                    lista.splice(lista.indexOf(item), 1);
                    marcarNaoSalvo();
                    renderOpcoes(idBox, lista);
                    atualizarStats();
                }
            }));
        });
        if (!lista.length) box.appendChild(textoVazio("Nenhum item ainda."));
    }

    // =========================================================================
    // Foto: reduz para no máx. 700px e converte em JPEG (data URI)
    // =========================================================================
    function processarFoto(file, aoPronto) {
        if (!/^image\//.test(file.type)) { alert("Escolha um arquivo de imagem."); return; }
        const fr = new FileReader();
        fr.onerror = function () { alert("Não consegui ler o arquivo."); };
        fr.onload = function () {
            const img = new Image();
            img.onerror = function () { alert("Não consegui abrir essa imagem."); };
            img.onload = function () {
                const MAX = 700;
                let w = img.naturalWidth || img.width;
                let h = img.naturalHeight || img.height;
                if (w > MAX || h > MAX) {
                    if (w >= h) { h = Math.round(h * MAX / w); w = MAX; }
                    else { w = Math.round(w * MAX / h); h = MAX; }
                }
                const c = document.createElement("canvas");
                c.width = w; c.height = h;
                c.getContext("2d").drawImage(img, 0, 0, w, h);
                let saida;
                try { saida = c.toDataURL("image/jpeg", 0.82); }
                catch (e) { saida = String(fr.result); }
                if (!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(saida)) {
                    alert("Formato de imagem não suportado. Tente PNG ou JPG.");
                    return;
                }
                aoPronto(saida);
            };
            img.src = String(fr.result);
        };
        fr.readAsDataURL(file);
    }

    // =========================================================================
    // Modal de "Adicionar"
    // =========================================================================
    function campoModal(rotulo, el) {
        const w = document.createElement("div");
        w.className = "modal-corpo-campo";
        const t = document.createElement("div");
        t.className = "campo-rot-txt";
        t.textContent = rotulo;
        w.appendChild(t);
        w.appendChild(el);
        return w;
    }
    function inputTexto(placeholder, aoMudar) {
        const i = document.createElement("input");
        i.type = "text";
        if (placeholder) i.placeholder = placeholder;
        i.addEventListener("input", function () { aoMudar(i.value); });
        return i;
    }
    // abrirModal(titulo, montarCorpo -> elFoco, botoes[])
    //   botao: { texto, primario?, perigo?, acao }
    function abrirModal(titulo, montarCorpo, botoes, variante) {
        $("modalTitulo").textContent = titulo;
        const caixa = document.querySelector("#modal .modal-caixa");
        caixa.className = "modal-caixa" + (variante ? " modal-caixa--" + variante : "");
        const corpo = $("modalCorpo");
        corpo.textContent = "";
        const foco = montarCorpo(corpo);

        const rod = $("modalRodape");
        rod.textContent = "";
        (botoes || [{ texto: "Fechar", primario: true, acao: fecharModal }]).forEach(function (b) {
            const el = document.createElement("button");
            el.type = "button";
            el.className = "btn" + (b.primario ? " btn-primario" : "") + (b.perigo ? " btn-perigo" : "");
            el.textContent = b.texto;
            if (b.primario) el.setAttribute("data-primario", "1");
            el.addEventListener("click", b.acao);
            rod.appendChild(el);
        });

        $("modal").hidden = false;
        setTimeout(function () { if (foco && foco.focus) foco.focus(); }, 30);
    }
    function fecharModal() { $("modal").hidden = true; }

    $("modalX").addEventListener("click", fecharModal);
    $("modal").addEventListener("click", function (e) { if (e.target === this) fecharModal(); });
    $("modal").addEventListener("keydown", function (e) {
        if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
            const prim = $("modalRodape").querySelector('[data-primario="1"]');
            if (prim) { e.preventDefault(); prim.click(); }
        }
    });
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && !$("modal").hidden) fecharModal();
    });

    // Grava um produto novo a partir do rascunho `novo`. Devolve true se deu certo.
    function salvarNovo(novo) {
        novo.nome = (novo.nome || "").trim();
        if (!novo.nome) { alert("Dê um nome ao produto."); return false; }
        const prod = {
            id: idUnico(novo.nome, modelo.produtos.map(function (p) { return p.id; })),
            categoria: novo.categoria,
            tipo: novo.tipo,
            nome: novo.nome,
            descricao: (novo.descricao || "").trim(),
            imagem: imagemOk(novo.imagem),
            adicionais: (novo.adicionais || []).slice()
        };
        if (novo.tipo !== "pizza") prod.preco = num(novo.preco);
        modelo.produtos.push(prod);
        marcarNaoSalvo();
        filtroProduto = "";
        $("buscaProduto").value = "";
        renderProdutos();
        atualizarStats();
        return true;
    }

    // preset opcional: pré-preenche campos (usado por "duplicar" e por
    // "adicionar e continuar", que reabre o modal mantendo seção/tipo).
    function modalNovoProduto(preset) {
        if (!modelo || !modelo.categorias.length) return;
        preset = preset || {};
        const temCat = modelo.categorias.some(function (c) { return c.id === preset.categoria; });
        const novo = {
            nome: preset.nome || "",
            descricao: preset.descricao || "",
            imagem: preset.imagem || "",
            preco: typeof preset.preco === "number" ? preset.preco : 0,
            tipo: preset.tipo === "pizza" ? "pizza" : "simples",
            categoria: temCat ? preset.categoria : modelo.categorias[0].id,
            adicionais: Array.isArray(preset.adicionais) ? preset.adicionais.slice() : []
        };
        const jaAdicionados = preset.contador || 0;

        abrirModal(preset.titulo || "Adicionar produto", function (corpo) {
            if (jaAdicionados > 0) {
                const info = document.createElement("div");
                info.className = "sub";
                info.style.margin = "0 0 4px";
                info.textContent = jaAdicionados + (jaAdicionados === 1 ? " produto adicionado" : " produtos adicionados") +
                    " agora — seção e tipo continuam iguais. Preencha o próximo.";
                corpo.appendChild(info);
            }

            const inpNome = document.createElement("input");
            inpNome.type = "text";
            inpNome.placeholder = "Ex.: Coca-Cola 350ml";
            inpNome.value = novo.nome;
            inpNome.addEventListener("input", function () { novo.nome = inpNome.value; });
            corpo.appendChild(campoModal("Nome do produto", inpNome));

            corpo.appendChild(campoModal("Seção", selecaoCategorias(novo.categoria, function (v) { novo.categoria = v; })));

            const selTipo = document.createElement("select");
            [["simples", "Simples (preço fixo)"], ["pizza", "Pizza (tamanho/borda)"]].forEach(function (o) {
                const op = document.createElement("option");
                op.value = o[0]; op.textContent = o[1];
                if (novo.tipo === o[0]) op.selected = true;
                selTipo.appendChild(op);
            });
            corpo.appendChild(campoModal("Tipo", selTipo));

            const campoDoPreco = campoModal("Preço", campoPreco(novo.preco, function (v) { novo.preco = v; }));
            campoDoPreco.style.display = novo.tipo === "pizza" ? "none" : "";
            corpo.appendChild(campoDoPreco);
            selTipo.addEventListener("change", function () {
                novo.tipo = selTipo.value;
                campoDoPreco.style.display = novo.tipo === "pizza" ? "none" : "";
            });

            const ta = document.createElement("textarea");
            ta.rows = 2;
            ta.placeholder = "Ingredientes / detalhes (opcional)";
            ta.value = novo.descricao;
            ta.addEventListener("input", function () { novo.descricao = ta.value; });
            corpo.appendChild(campoModal("Descrição", ta));

            const capFoto = document.createElement("div");
            capFoto.className = "campo-rot-txt";
            capFoto.textContent = "Imagem do produto";
            corpo.appendChild(capFoto);
            corpo.appendChild(blocoFoto(
                function () { return novo.imagem; },
                function (v) { novo.imagem = v; }
            ));

            corpo.appendChild(campoModal("Adicionais que aparecem neste produto", blocoAdicionaisProduto(novo)));

            return inpNome;
        }, [
            { texto: "Adicionar e continuar", acao: function () {
                if (!salvarNovo(novo)) return;
                modalNovoProduto({
                    categoria: novo.categoria,
                    tipo: novo.tipo,
                    adicionais: novo.adicionais,
                    contador: jaAdicionados + 1
                });
            } },
            { texto: "Adicionar e fechar", primario: true, acao: function () {
                if (salvarNovo(novo)) fecharModal();
            } }
        ]);
    }

    // Um único botão "Duplicar produto" por seção (em vez de um em cada
    // produto, fácil de clicar sem querer): o vendedor escolhe aqui qual
    // produto vai servir de modelo, e só depois abre o formulário de cópia.
    function modalEscolherDuplicar(cat, doGrupo) {
        abrirModal("Duplicar produto — " + cat.nome, function (corpo) {
            const info = document.createElement("div");
            info.className = "sub";
            info.textContent = "Escolha o produto que vai servir de modelo para a cópia.";
            corpo.appendChild(info);

            const lista = document.createElement("div");
            lista.className = "lista-escolher";
            doGrupo.forEach(function (prod) {
                const item = document.createElement("button");
                item.type = "button";
                item.className = "item-escolher";
                const nome = document.createElement("span");
                nome.className = "item-escolher-nome";
                nome.textContent = prod.nome;
                const preco = document.createElement("span");
                preco.className = "item-escolher-preco";
                preco.textContent = resumoPreco(prod);
                item.appendChild(nome);
                item.appendChild(preco);
                item.addEventListener("click", function () { modalDuplicarProduto(prod); });
                lista.appendChild(item);
            });
            corpo.appendChild(lista);
        }, [
            { texto: "Cancelar", acao: fecharModal }
        ]);
    }

    function modalDuplicarProduto(orig) {
        modalNovoProduto({
            titulo: "Duplicar produto",
            nome: orig.nome + " (cópia)",
            descricao: orig.descricao || "",
            imagem: orig.imagem || "",
            preco: typeof orig.preco === "number" ? orig.preco : 0,
            tipo: orig.tipo,
            categoria: orig.categoria,
            adicionais: Array.isArray(orig.adicionais) ? orig.adicionais : []
        });
    }

    // Lê "Nome; 6,00" | "Nome - 6,00" | "Nome | 6" | "Nome 6,00" | "Nome" -> {nome, preco}
    function parseLinhaLote(linha) {
        const s = (linha || "").trim();
        if (!s) return null;
        let nome, precoTxt = "";
        let m = s.match(/^(.*\S)\s*(?:;|\||\t|\s[-–—]\s)\s*(.+)$/);
        if (m) {
            nome = m[1]; precoTxt = m[2];
        } else {
            m = s.match(/^(.*?\S)\s+R?\$?\s*(\d{1,7}(?:[.,]\d{1,2})?)\s*$/i);
            if (m) { nome = m[1]; precoTxt = m[2]; }
            else { nome = s; }
        }
        nome = nome.replace(/\s+/g, " ").trim();
        if (!nome) return null;
        return { nome: nome, preco: num(precoTxt.replace(/[r$\s]/gi, "")) };
    }

    function modalAdicionarLote() {
        if (!modelo || !modelo.categorias.length) return;
        const est = { categoria: modelo.categorias[0].id };
        const linhas = [{ nome: "", preco: 0 }, { nome: "", preco: 0 }, { nome: "", preco: 0 }];
        let boxLinhas = null;

        function contarValidas() {
            return linhas.filter(function (l) { return (l.nome || "").trim() !== ""; }).length;
        }
        function atualizarBotao() {
            const b = $("modalRodape").querySelector('[data-primario="1"]');
            if (!b) return;
            const n = contarValidas();
            b.textContent = n > 0 ? ("Adicionar " + n + (n === 1 ? " produto" : " produtos")) : "Adicionar produtos";
            b.disabled = n === 0;
        }
        function focarLinha(i) {
            const row = boxLinhas.children[i];
            const inp = row && row.querySelector("input[type='text']");
            if (inp) inp.focus();
        }
        function renderLinhas() {
            boxLinhas.textContent = "";
            linhas.forEach(function (l, i) {
                const row = document.createElement("div");
                row.className = "lote-linha";

                const inNome = document.createElement("input");
                inNome.type = "text";
                inNome.placeholder = "Nome do produto";
                inNome.value = l.nome;
                inNome.addEventListener("input", function () { l.nome = inNome.value; atualizarBotao(); });
                inNome.addEventListener("keydown", function (e) {
                    if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); row.querySelector(".campo-preco input").focus(); }
                });

                const cp = campoPreco(l.preco, function (v) { l.preco = v; });
                cp.querySelector("input").addEventListener("keydown", function (e) {
                    if (e.key !== "Enter") return;
                    e.preventDefault(); e.stopPropagation();
                    if (i === linhas.length - 1) { linhas.push({ nome: "", preco: 0 }); renderLinhas(); }
                    focarLinha(i + 1);
                });

                const bx = document.createElement("button");
                bx.type = "button";
                bx.className = "btn-icone";
                bx.textContent = "✕";
                bx.title = "Remover linha";
                bx.addEventListener("click", function () {
                    linhas.splice(i, 1);
                    if (!linhas.length) linhas.push({ nome: "", preco: 0 });
                    renderLinhas();
                    atualizarBotao();
                });

                row.appendChild(inNome);
                row.appendChild(cp);
                row.appendChild(bx);
                boxLinhas.appendChild(row);
            });
        }

        abrirModal("Adicionar vários produtos", function (corpo) {
            const aviso = document.createElement("div");
            aviso.className = "sub";
            aviso.style.margin = "0 0 8px";
            aviso.textContent = "Rápido para lançar uma seção inteira. Entram como “Simples”; foto e descrição você ajusta depois no Editar.";
            corpo.appendChild(aviso);

            corpo.appendChild(campoModal("Seção de todos", selecaoCategorias(est.categoria, function (v) { est.categoria = v; })));

            const ta = document.createElement("textarea");
            ta.rows = 3;
            ta.placeholder = "Colar lista — um por linha. Ex.:\nCoca-Cola 350ml; 6,00\nGuaraná 2L - 12\nÁgua sem gás";
            const wrapColar = campoModal("Colar lista (opcional)", ta);
            const bColar = document.createElement("button");
            bColar.type = "button";
            bColar.className = "btn btn-mini";
            bColar.textContent = "Preencher da lista";
            bColar.style.marginTop = "6px";
            bColar.addEventListener("click", function () {
                const novas = ta.value.split(/\r?\n/).map(parseLinhaLote).filter(Boolean);
                if (!novas.length) return;
                for (let k = linhas.length - 1; k >= 0; k--) {
                    if ((linhas[k].nome || "").trim() === "" && !linhas[k].preco) linhas.splice(k, 1);
                }
                novas.forEach(function (n) { linhas.push(n); });
                ta.value = "";
                renderLinhas();
                atualizarBotao();
            });
            wrapColar.appendChild(bColar);
            corpo.appendChild(wrapColar);

            const cap = document.createElement("div");
            cap.className = "campo-rot-txt";
            cap.textContent = "Produtos";
            corpo.appendChild(cap);

            boxLinhas = document.createElement("div");
            corpo.appendChild(boxLinhas);

            const bMais = document.createElement("button");
            bMais.type = "button";
            bMais.className = "btn btn-mini";
            bMais.textContent = "+ Linha";
            bMais.style.marginTop = "6px";
            bMais.addEventListener("click", function () {
                linhas.push({ nome: "", preco: 0 });
                renderLinhas();
                focarLinha(linhas.length - 1);
                atualizarBotao();
            });
            corpo.appendChild(bMais);

            renderLinhas();
            return boxLinhas.querySelector("input[type='text']");
        }, [
            { texto: "Adicionar produtos", primario: true, acao: function () {
                const validas = linhas.filter(function (l) { return (l.nome || "").trim() !== ""; });
                if (!validas.length) { alert("Preencha ao menos um nome."); return; }
                const usados = modelo.produtos.map(function (p) { return p.id; });
                validas.forEach(function (l) {
                    const nome = l.nome.trim();
                    const id = idUnico(nome, usados);
                    usados.push(id);
                    modelo.produtos.push({
                        id: id, categoria: est.categoria, tipo: "simples", nome: nome,
                        descricao: "", imagem: "", adicionais: [], preco: num(l.preco)
                    });
                });
                marcarNaoSalvo();
                filtroProduto = "";
                $("buscaProduto").value = "";
                renderProdutos();
                atualizarStats();
                fecharModal();
            } }
        ], "lote");

        atualizarBotao();
    }

    function modalNovaSecao() {
        if (!modelo) return;
        let nome = "";
        abrirModal("Adicionar seção", function (corpo) {
            const c = campoModal("Nome da seção", inputTexto("Ex.: Bebidas", function (v) { nome = v; }));
            corpo.appendChild(c);
            return c.querySelector("input");
        }, [
            { texto: "Cancelar", acao: fecharModal },
            { texto: "Adicionar", primario: true, acao: function () {
                nome = nome.trim();
                if (!nome) { alert("Dê um nome à seção."); return; }
                modelo.categorias.push({
                    id: idUnico(nome, modelo.categorias.map(function (c) { return c.id; })),
                    nome: nome
                });
                marcarNaoSalvo();
                renderSecoes();
                renderProdutos();
                atualizarStats();
                fecharModal();
            } }
        ]);
    }

    function modalNovaOpcao(titulo, chave, idBox) {
        if (!modelo) return;
        let rotulo = "", preco = 0;
        abrirModal(titulo, function (corpo) {
            const c = campoModal("Nome", inputTexto("", function (v) { rotulo = v; }));
            corpo.appendChild(c);
            corpo.appendChild(campoModal("Preço", campoPreco(0, function (v) { preco = v; })));
            return c.querySelector("input");
        }, [
            { texto: "Cancelar", acao: fecharModal },
            { texto: "Adicionar", primario: true, acao: function () {
                rotulo = rotulo.trim();
                if (!rotulo) { alert("Dê um nome."); return; }
                const item = { rotulo: rotulo, preco: num(preco) };
                if (chave === "adicionais") {
                    item.id = idUnico(rotulo, modelo.adicionais.map(function (a) { return a.id; }));
                }
                modelo[chave].push(item);
                marcarNaoSalvo();
                renderOpcoes(idBox, modelo[chave]);
                atualizarStats();
                fecharModal();
            } }
        ]);
    }

    // =========================================================================
    // Ligações da interface
    // =========================================================================
    $("btnSalvar").addEventListener("click", salvar);
    $("btnSalvarFim").addEventListener("click", salvar);

    $("btnAddSecao").addEventListener("click", modalNovaSecao);
    $("btnAddAdicional").addEventListener("click", function () { modalNovaOpcao("Adicionar adicional", "adicionais", "listaAdicionais"); });
    $("btnAddTamanho").addEventListener("click", function () { modalNovaOpcao("Adicionar tamanho de pizza", "tamanhos", "listaTamanhos"); });
    $("btnAddBorda").addEventListener("click", function () { modalNovaOpcao("Adicionar borda de pizza", "bordas", "listaBordas"); });

    $("btnAddProduto").addEventListener("click", function () { modalNovoProduto(); });
    $("btnAddVarios").addEventListener("click", modalAdicionarLote);

    $("buscaProduto").addEventListener("input", function () {
        filtroProduto = this.value;
        renderProdutos();
    });

    $("btnEditarOrdem").addEventListener("click", function () {
        modoOrdem = !modoOrdem;
        this.textContent = modoOrdem ? "✓ Concluir ordem" : "↕ Editar ordem";
        this.classList.toggle("ativo", modoOrdem);
        $("painelProdutos").classList.toggle("ordenando", modoOrdem);
        renderProdutos();
    });

    $("btnOrdemSecoes").addEventListener("click", function () {
        modoOrdemSecoes = !modoOrdemSecoes;
        this.textContent = modoOrdemSecoes ? "✓ Concluir ordem" : "↕ Editar ordem";
        this.classList.toggle("ativo", modoOrdemSecoes);
        $("painelSecoes").classList.toggle("ordenando", modoOrdemSecoes);
        renderSecoes();
    });

    $("btnOrdemAdicionais").addEventListener("click", function () {
        modoOrdemAdicionais = !modoOrdemAdicionais;
        this.textContent = modoOrdemAdicionais ? "✓ Concluir ordem" : "↕ Editar ordem";
        this.classList.toggle("ativo", modoOrdemAdicionais);
        $("painelAdicionais").classList.toggle("ordenando", modoOrdemAdicionais);
        renderOpcoes("listaAdicionais", modelo.adicionais);
        renderOpcoes("listaTamanhos", modelo.tamanhos);
        renderOpcoes("listaBordas", modelo.bordas);
    });

    // Navegação da barra lateral: clica para ir, e o realce acompanha a rolagem.
    (function navLateral() {
        const links = Array.prototype.slice.call(document.querySelectorAll(".nav a[data-alvo]"));
        if (!links.length) return;
        let travaAte = 0;

        function marcar(id) {
            links.forEach(function (a) {
                a.classList.toggle("ativo", a.getAttribute("data-alvo") === id);
            });
        }

        links.forEach(function (a) {
            a.addEventListener("click", function (e) {
                e.preventDefault();
                const id = a.getAttribute("data-alvo");
                const alvo = document.getElementById(id);
                if (alvo) alvo.scrollIntoView({ behavior: "smooth", block: "start" });
                marcar(id);
                travaAte = Date.now() + 700; // não deixa a rolagem "roubar" o realce
            });
        });

        function aoRolar() {
            // Com a tela de login em cima, o layout fica "display:none" e todo
            // elemento mede 0 de altura — sem isto, o cálculo abaixo acaba
            // marcando o último item da lista (Adicionais) como ativo.
            if (document.body.classList.contains("bloqueado")) return;
            if (Date.now() < travaAte) return;
            const linha = 140;
            let atual = links[0].getAttribute("data-alvo");
            links.forEach(function (a) {
                const el = document.getElementById(a.getAttribute("data-alvo"));
                if (el && el.getBoundingClientRect().top - linha <= 0) {
                    atual = a.getAttribute("data-alvo");
                }
            });
            const fim = window.innerHeight + window.pageYOffset >= document.body.scrollHeight - 4;
            if (fim) atual = links[links.length - 1].getAttribute("data-alvo");
            marcar(atual);
        }

        let agendado = false;
        window.addEventListener("scroll", function () {
            if (agendado) return;
            agendado = true;
            requestAnimationFrame(function () { aoRolar(); agendado = false; });
        }, { passive: true });
        window.addEventListener("resize", aoRolar);
        atualizarNavAtiva = aoRolar;
        aoRolar();
    })();

    $("btnEntrar").addEventListener("click", entrar);
    $("senhaLogin").addEventListener("keydown", function (e) {
        if (e.key === "Enter") entrar();
    });
    $("verSenha").addEventListener("click", function () {
        const i = $("senhaLogin");
        const oculta = i.type === "password";
        i.type = oculta ? "text" : "password";
        this.textContent = oculta ? "ocultar" : "ver";
        i.focus();
    });
    $("btnSair").addEventListener("click", sair);

    window.addEventListener("beforeunload", function (e) {
        if (!salvo && !document.body.classList.contains("bloqueado")) {
            e.preventDefault();
            e.returnValue = "";
        }
    });

    // Toda visita ao painel pede a senha de novo — recarregar a página ou
    // vir de outra seção (Pedidos) sempre passa pela tela de login. Só entra
    // de fato depois de digitar a senha (entrar() chama carregar()).
    mostrarLogin();
})();
