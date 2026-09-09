"use strict";

(function () {
    const $ = function (id) { return document.getElementById(id); };
    const clonar = function (o) { return JSON.parse(JSON.stringify(o)); };

    const CHAVE_SENHA = "adminSenha";

    let modelo = null;
    let salvo = true;
    let senha = "";
    try { senha = sessionStorage.getItem(CHAVE_SENHA) || ""; } catch (e) {}

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
        });

        m.tamanhos = m.tamanhos.map(function (t) { return { rotulo: String(t.rotulo || "").trim() || "Tamanho", preco: num(t.preco) }; });
        m.bordas = m.bordas.map(function (b) { return { rotulo: String(b.rotulo || "").trim() || "Borda", preco: num(b.preco) }; });
        m.adicionais = m.adicionais.map(function (a) { return { rotulo: String(a.rotulo || "").trim() || "Adicional", preco: num(a.preco) }; });

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
        fetch("catalogo.php?json=1", { cache: "no-store" })
            .then(function (r) {
                if (!r.ok) throw new Error("HTTP " + r.status);
                return r.json();
            })
            .then(function (dados) {
                modelo = normalizar(dados);
                salvo = true;
                renderTudo();
            })
            .catch(function (e) {
                $("estado").textContent = "Sem conexão com o servidor";
                $("estado").className = "estado pendente";

                let dica;
                if (location.protocol === "file:") {
                    dica = "Você abriu o arquivo direto (endereço começa com <b>file://</b>). " +
                        "É preciso abrir pelo servidor PHP: rode o <b>servidor.bat</b> e acesse " +
                        "<b>http://localhost:8000/admin.html</b> no navegador (Chrome/Edge).";
                } else {
                    dica = "O endereço parece certo, mas o <b>catalogo.php</b> não respondeu. " +
                        "Confira se o servidor PHP está rodando (janela do <b>servidor.bat</b> aberta) " +
                        "e se a hospedagem tem PHP. Não use o \"Live Preview\" do editor — ele não executa PHP.";
                }

                const cx = $("erroCarregar");
                cx.innerHTML = "<strong>Não consegui carregar o cardápio do servidor.</strong><br>" +
                    dica + "<br><span style=\"opacity:.7\">Detalhe técnico: " + String(e.message) + "</span>";
                cx.hidden = false;
                cx.scrollIntoView({ behavior: "smooth", block: "center" });
            });
    }

    function salvar() {
        if (!modelo) return;
        if (!senha) {
            senha = window.prompt("Senha de administração (para publicar):") || "";
            if (!senha) return;
        }
        normalizar(modelo);

        const btn = $("btnSalvar");
        btn.disabled = true;
        btn.textContent = "Publicando...";

        fetch("catalogo.php", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Senha": senha },
            body: JSON.stringify(modelo)
        })
            .then(function (r) {
                return r.json().catch(function () { return {}; }).then(function (j) {
                    return { status: r.status, ok: r.ok, corpo: j };
                });
            })
            .then(function (res) {
                if (res.status === 401) {
                    senha = "";
                    try { sessionStorage.removeItem(CHAVE_SENHA); } catch (e) {}
                    alert("Senha incorreta. Tente novamente.");
                    return;
                }
                if (!res.ok || !res.corpo.ok) {
                    throw new Error(res.corpo.erro || ("HTTP " + res.status));
                }
                try { sessionStorage.setItem(CHAVE_SENHA, senha); } catch (e) {}
                if (res.corpo.catalogo) {
                    modelo = normalizar(res.corpo.catalogo);
                    renderTudo();
                }
                salvo = true;
                renderEstado();
                piscarBotao(btn, "Publicado!");
            })
            .catch(function (e) {
                alert("Não consegui publicar: " + e.message);
            })
            .finally(function () {
                btn.disabled = false;
                if (btn.textContent === "Publicando...") btn.textContent = "Salvar e publicar";
            });
    }

    function piscarBotao(btn, texto) {
        btn.textContent = texto;
        setTimeout(function () { btn.textContent = "Salvar e publicar"; }, 1600);
    }

    // =========================================================================
    // Render
    // =========================================================================
    function renderTudo() {
        renderSecoes();
        renderProdutos();
        renderOpcoes("listaAdicionais", modelo.adicionais);
        renderOpcoes("listaTamanhos", modelo.tamanhos);
        renderOpcoes("listaBordas", modelo.bordas);
        $("campoWhatsapp").value = modelo.whatsapp || "";
        renderEstado();
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

    // ---- Seções ----
    function renderSecoes() {
        const box = $("listaSecoes");
        box.textContent = "";
        modelo.categorias.forEach(function (cat, i) {
            const linha = document.createElement("div");
            linha.className = "linha-item";

            const inp = document.createElement("input");
            inp.type = "text";
            inp.value = cat.nome;
            inp.placeholder = "Nome da seção";
            inp.addEventListener("input", function () { cat.nome = inp.value; marcarNaoSalvo(); });
            linha.appendChild(inp);

            linha.appendChild(botaoIcone("↑", "Subir", function () {
                if (mover(modelo.categorias, i, -1)) { marcarNaoSalvo(); renderSecoes(); renderProdutos(); }
            }));
            linha.appendChild(botaoIcone("↓", "Descer", function () {
                if (mover(modelo.categorias, i, 1)) { marcarNaoSalvo(); renderSecoes(); renderProdutos(); }
            }));
            linha.appendChild(botaoIcone("✕", "Excluir seção", function () {
                const qtd = modelo.produtos.filter(function (p) { return p.categoria === cat.id; }).length;
                let msg = "Excluir a seção \"" + cat.nome + "\"?";
                if (qtd) msg += "\nOs " + qtd + " produto(s) dela vão para a primeira seção.";
                if (!confirm(msg)) return;
                modelo.categorias.splice(i, 1);
                normalizar(modelo);
                marcarNaoSalvo();
                renderTudo();
            }));

            box.appendChild(linha);
        });
    }

    // ---- Produtos ----
    function renderProdutos() {
        const box = $("listaProdutos");
        box.textContent = "";
        modelo.categorias.forEach(function (cat) {
            const grupo = document.createElement("div");
            grupo.className = "grupo-cat";

            const h = document.createElement("h3");
            h.textContent = cat.nome;
            grupo.appendChild(h);

            modelo.produtos
                .filter(function (p) { return p.categoria === cat.id; })
                .forEach(function (prod) { grupo.appendChild(cardProduto(prod)); });

            const add = document.createElement("button");
            add.type = "button";
            add.className = "btn btn-mini";
            add.textContent = "+ Adicionar produto em " + cat.nome;
            add.addEventListener("click", function () {
                const novo = {
                    id: idUnico("novo produto", modelo.produtos.map(function (p) { return p.id; })),
                    categoria: cat.id, tipo: "simples",
                    nome: "Novo produto", descricao: "", preco: 0, imagem: ""
                };
                modelo.produtos.push(novo);
                marcarNaoSalvo();
                renderProdutos();
                const el = document.querySelector('[data-prod="' + novo.id + '"]');
                if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); }
            });
            grupo.appendChild(add);

            box.appendChild(grupo);
        });
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

    function cardProduto(prod) {
        const card = document.createElement("div");
        card.className = "card-produto";
        card.setAttribute("data-prod", prod.id);

        // ----- coluna da foto -----
        const colFoto = document.createElement("div");

        const foto = document.createElement("div");
        foto.className = "foto-box";
        atualizarFoto(foto, prod.imagem);
        colFoto.appendChild(foto);

        const inpUrl = document.createElement("input");
        inpUrl.type = "text";
        inpUrl.placeholder = "Link da imagem";
        inpUrl.style.marginTop = "6px";
        inpUrl.style.fontSize = "11px";
        inpUrl.value = /^data:/.test(prod.imagem || "") ? "(foto enviada)" : (prod.imagem || "");
        inpUrl.addEventListener("focus", function () {
            if (inpUrl.value === "(foto enviada)") inpUrl.value = "";
        });
        inpUrl.addEventListener("input", function () {
            prod.imagem = inpUrl.value.trim();
            atualizarFoto(foto, prod.imagem);
            marcarNaoSalvo();
        });

        const fotoAcoes = document.createElement("div");
        fotoAcoes.className = "foto-acoes";

        const lblEnviar = document.createElement("label");
        lblEnviar.className = "btn btn-mini";
        lblEnviar.textContent = "Enviar foto";
        const inpArq = document.createElement("input");
        inpArq.type = "file";
        inpArq.accept = "image/*";
        inpArq.hidden = true;
        inpArq.addEventListener("change", function () {
            const f = inpArq.files && inpArq.files[0];
            inpArq.value = "";
            if (!f) return;
            processarFoto(f, function (dataUri) {
                prod.imagem = dataUri;
                atualizarFoto(foto, dataUri);
                inpUrl.value = "(foto enviada)";
                marcarNaoSalvo();
            });
        });
        lblEnviar.appendChild(inpArq);
        fotoAcoes.appendChild(lblEnviar);

        const btnLimpar = document.createElement("button");
        btnLimpar.type = "button";
        btnLimpar.className = "btn btn-mini";
        btnLimpar.textContent = "Remover";
        btnLimpar.addEventListener("click", function () {
            prod.imagem = "";
            atualizarFoto(foto, "");
            inpUrl.value = "";
            marcarNaoSalvo();
        });
        fotoAcoes.appendChild(btnLimpar);

        colFoto.appendChild(fotoAcoes);
        colFoto.appendChild(inpUrl);
        card.appendChild(colFoto);

        // ----- coluna dos campos -----
        const campos = document.createElement("div");
        campos.className = "campos-produto";

        const inpNome = document.createElement("input");
        inpNome.type = "text";
        inpNome.value = prod.nome;
        inpNome.placeholder = "Nome do produto";
        inpNome.addEventListener("input", function () { prod.nome = inpNome.value; marcarNaoSalvo(); });
        campos.appendChild(inpNome);

        const inpDesc = document.createElement("textarea");
        inpDesc.value = prod.descricao || "";
        inpDesc.rows = 2;
        inpDesc.placeholder = "Descrição / ingredientes";
        inpDesc.addEventListener("input", function () { prod.descricao = inpDesc.value; marcarNaoSalvo(); });
        campos.appendChild(inpDesc);

        const duas = document.createElement("div");
        duas.className = "duas";

        const selTipo = document.createElement("select");
        [["simples", "Simples (preço fixo)"], ["pizza", "Pizza (tamanho/borda)"]].forEach(function (o) {
            const op = document.createElement("option");
            op.value = o[0]; op.textContent = o[1];
            if (prod.tipo === o[0]) op.selected = true;
            selTipo.appendChild(op);
        });
        selTipo.addEventListener("change", function () {
            prod.tipo = selTipo.value;
            if (prod.tipo === "pizza") delete prod.preco;
            else if (typeof prod.preco !== "number") prod.preco = 0;
            marcarNaoSalvo();
            const novo = cardProduto(prod);
            card.parentNode.replaceChild(novo, card);
        });
        duas.appendChild(selTipo);

        if (prod.tipo !== "pizza") {
            const inpPreco = document.createElement("input");
            inpPreco.type = "number";
            inpPreco.step = "0.01";
            inpPreco.min = "0";
            inpPreco.placeholder = "Preço (R$)";
            inpPreco.value = (prod.preco != null ? prod.preco : 0);
            inpPreco.addEventListener("input", function () { prod.preco = num(inpPreco.value); marcarNaoSalvo(); });
            duas.appendChild(inpPreco);
        }
        campos.appendChild(duas);

        const selCat = document.createElement("select");
        modelo.categorias.forEach(function (c) {
            const op = document.createElement("option");
            op.value = c.id; op.textContent = c.nome;
            if (c.id === prod.categoria) op.selected = true;
            selCat.appendChild(op);
        });
        selCat.addEventListener("change", function () {
            prod.categoria = selCat.value;
            marcarNaoSalvo();
            renderProdutos();
        });
        campos.appendChild(selCat);

        card.appendChild(campos);

        // ----- ações -----
        const acoes = document.createElement("div");
        acoes.className = "acoes-produto";
        acoes.appendChild(botaoIcone("↑", "Subir na seção", function () {
            if (reordenarProduto(prod, -1)) { marcarNaoSalvo(); renderProdutos(); }
        }));
        acoes.appendChild(botaoIcone("↓", "Descer na seção", function () {
            if (reordenarProduto(prod, 1)) { marcarNaoSalvo(); renderProdutos(); }
        }));
        const del = document.createElement("button");
        del.type = "button";
        del.className = "btn btn-mini btn-perigo";
        del.textContent = "Excluir";
        del.addEventListener("click", function () {
            if (!confirm("Excluir \"" + prod.nome + "\"?")) return;
            const idx = modelo.produtos.indexOf(prod);
            if (idx !== -1) modelo.produtos.splice(idx, 1);
            marcarNaoSalvo();
            renderProdutos();
        });
        acoes.appendChild(del);
        card.appendChild(acoes);

        return card;
    }

    // ---- Adicionais / tamanhos / bordas ----
    function renderOpcoes(idBox, lista) {
        const box = $(idBox);
        box.textContent = "";
        lista.forEach(function (item, i) {
            const linha = document.createElement("div");
            linha.className = "linha-item";

            const inpNome = document.createElement("input");
            inpNome.type = "text";
            inpNome.value = item.rotulo;
            inpNome.placeholder = "Nome";
            inpNome.addEventListener("input", function () { item.rotulo = inpNome.value; marcarNaoSalvo(); });
            linha.appendChild(inpNome);

            const inpPreco = document.createElement("input");
            inpPreco.type = "number";
            inpPreco.step = "0.01";
            inpPreco.min = "0";
            inpPreco.className = "preco-inp";
            inpPreco.value = item.preco;
            inpPreco.placeholder = "R$";
            inpPreco.addEventListener("input", function () { item.preco = num(inpPreco.value); marcarNaoSalvo(); });
            linha.appendChild(inpPreco);

            linha.appendChild(botaoIcone("↑", "Subir", function () {
                if (mover(lista, i, -1)) { marcarNaoSalvo(); renderOpcoes(idBox, lista); }
            }));
            linha.appendChild(botaoIcone("↓", "Descer", function () {
                if (mover(lista, i, 1)) { marcarNaoSalvo(); renderOpcoes(idBox, lista); }
            }));
            linha.appendChild(botaoIcone("✕", "Excluir", function () {
                lista.splice(i, 1); marcarNaoSalvo(); renderOpcoes(idBox, lista);
            }));

            box.appendChild(linha);
        });
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
    // Ligações da interface
    // =========================================================================
    $("btnSalvar").addEventListener("click", salvar);

    $("btnAddSecao").addEventListener("click", function () {
        modelo.categorias.push({
            id: idUnico("nova secao", modelo.categorias.map(function (c) { return c.id; })),
            nome: "Nova seção"
        });
        marcarNaoSalvo();
        renderSecoes();
        renderProdutos();
    });
    $("btnAddAdicional").addEventListener("click", function () {
        modelo.adicionais.push({ rotulo: "Novo adicional", preco: 0 });
        marcarNaoSalvo();
        renderOpcoes("listaAdicionais", modelo.adicionais);
    });
    $("btnAddTamanho").addEventListener("click", function () {
        modelo.tamanhos.push({ rotulo: "Novo tamanho", preco: 0 });
        marcarNaoSalvo();
        renderOpcoes("listaTamanhos", modelo.tamanhos);
    });
    $("btnAddBorda").addEventListener("click", function () {
        modelo.bordas.push({ rotulo: "Nova borda", preco: 0 });
        marcarNaoSalvo();
        renderOpcoes("listaBordas", modelo.bordas);
    });

    $("campoWhatsapp").addEventListener("input", function () {
        modelo.whatsapp = $("campoWhatsapp").value.replace(/\D/g, "");
        marcarNaoSalvo();
    });

    window.addEventListener("beforeunload", function (e) {
        if (!salvo) { e.preventDefault(); e.returnValue = ""; }
    });

    carregar();
})();
