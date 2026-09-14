<?php
declare(strict_types=1);

/* Porta de entrada do painel de Pedidos. Diferente de pedidos.html (que era
   estático), isto roda no servidor: confere a sessão do painel ANTES de
   mandar qualquer HTML. Sem sessão válida, nem chega a existir página —
   só um redirecionamento para admin.html (onde é a única tela de senha).
   Assim, "acessar pedidos.html direto sem login" deixa de ser possível:
   o JS de pedidos.js continua conferindo de novo (defesa em profundidade),
   mas a barreira de verdade agora é esta aqui. */

$libDir = null;
foreach ([__DIR__ . '/../../lib', __DIR__ . '/../lib', __DIR__] as $d) {
    if (is_file($d . '/dados.php')) { $libDir = $d; break; }
}
if ($libDir === null) {
    http_response_code(500);
    exit('Serviço indisponível.');
}
require_once $libDir . '/bootstrap.php';
require_once $libDir . '/dados.php';

iniciar_sessao();
header('Cache-Control: no-store');

if (!sessao_valida()) {
    header('Location: admin.html');
    exit;
}
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https://images.unsplash.com data:; connect-src 'self'; base-uri 'none'; form-action 'none'">
    <meta name="referrer" content="no-referrer">
    <meta name="robots" content="noindex, nofollow">
    <title>Pedidos — Com Carinho</title>
    <style>
        /* Sem isto, elementos com display:flex/grid ignoram o atributo "hidden"
           quando um seletor do autor (ex.: .campo{display:flex}) tem a mesma
           especificidade da regra padrão do navegador — e o do autor vence. */
        [hidden] { display: none !important; }
        :root {
            --sidebar: #2a1a12;
            --bg: #efe8dd;
            --card: #fbf8f3;
            --card2: #f4ede2;
            --linha: #e7dcca;
            --marrom: #7d5648;
            --marrom-forte: #5b3a2e;
            --escuro: #2a1a12;
            --txt: #3a2a20;
            --txt-fraco: #9c8b7c;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body { background: var(--bg); color: var(--txt); }

        /* Pedidos não tem tela de senha própria (só admin.html tem). Enquanto
           confere a sessão, fica só isto escondido — sem "flash" de login. */
        body.bloqueado .layout { display: none; }

        /* ---------- Layout / barra lateral ---------- */
        .layout { display: flex; min-height: 100vh; }
        .barra-lateral {
            width: 248px; flex: none; background: var(--sidebar); color: #e4d7c8;
            display: flex; flex-direction: column; justify-content: space-between;
            padding: 24px 16px; position: sticky; top: 0; align-self: flex-start; height: 100vh;
        }
        .marca { text-align: center; padding: 0 8px 10px; }
        .marca-logo { font-size: 30px; }
        .marca-nome { font-family: Georgia, "Times New Roman", serif; font-style: italic; font-size: 27px; color: #f2e6d7; margin-top: 2px; }
        .marca-slogan { font-size: 11px; color: #b39c88; letter-spacing: .3px; margin-top: 2px; }
        .nav { width: 100%; display: flex; flex-direction: column; gap: 10px; }
        .nav a {
            display: flex; align-items: center; gap: 14px; padding: 15px 16px; border-radius: 12px;
            color: #d3c1af; font-size: 14px; text-decoration: none; cursor: pointer;
            white-space: nowrap; letter-spacing: .2px;
        }
        .nav a:hover { background: rgba(255,255,255,.06); }
        .nav a.ativo { background: rgba(255,255,255,.11); color: #fff; }
        .nav a .ic { width: 24px; flex: none; text-align: center; font-size: 16px; line-height: 1; }
        .btn-sair {
            display: flex; align-items: center; gap: 10px; justify-content: center;
            background: none; border: 1px solid rgba(255,255,255,.16); color: #d3c1af;
            border-radius: 12px; padding: 11px 14px; font-size: 14px; font-weight: 600; cursor: pointer;
        }
        .btn-sair:hover { background: rgba(255,255,255,.06); }

        /* ---------- Área principal ---------- */
        .principal { flex: 1; min-width: 0; padding: 26px 30px 70px; }
        .principal-conteudo { max-width: 1400px; margin: 0 auto; }
        .cabecalho { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; flex-wrap: wrap; margin-bottom: 20px; }
        .cabecalho h1 { font-size: 26px; font-weight: 800; color: var(--txt); }
        .cabecalho p { font-size: 14px; color: var(--txt-fraco); margin-top: 4px; }
        .btn-vercardapio {
            background: var(--escuro); color: #f3e9dd; text-decoration: none;
            padding: 11px 22px; border-radius: 11px; font-size: 13px; font-weight: 700;
            letter-spacing: .3px; align-self: flex-start; white-space: nowrap;
        }
        .btn-vercardapio:hover { background: #3a271c; }
        .erro-carregar {
            background: #fdecea; border: 1px solid #f0c4c0; color: #8a2a22;
            border-radius: 14px; padding: 14px 16px; font-size: 13px; line-height: 1.5; margin-bottom: 18px;
        }
        .rodape-admin { text-align: center; font-size: 11px; color: #a89887; margin-top: 26px; }
        .sub { font-size: 12px; color: var(--txt-fraco); }

        /* ---------- Botões ---------- */
        .btn {
            border: 1px solid #d9cdbb; background: #fff; color: var(--txt);
            padding: 9px 14px; border-radius: 11px; font-size: 13px; font-weight: 600;
            cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;
        }
        .btn:hover { background: #f6efe4; }
        .btn:disabled { opacity: .5; cursor: default; }
        .btn-primario { background: var(--escuro); border-color: var(--escuro); color: #f3e9dd; }
        .btn-primario:hover { background: #3a271c; }
        /* Botão de concluir o pedido: verde, para destacar a ação final. */
        .btn-sucesso { background: #2e7d43; border-color: #2e7d43; color: #fff; }
        .btn-sucesso:hover { background: #256538; border-color: #256538; }
        .btn-mini { padding: 6px 10px; font-size: 12px; border-radius: 9px; }
        .btn-icone {
            border: 1px solid #d9cdbb; background: #fff; width: 30px; height: 30px;
            border-radius: 8px; cursor: pointer; font-size: 13px; color: #6f5d4e; flex: none;
        }
        .btn-icone:hover { background: #f2ebdf; }

        /* ---------- Cartões de número ---------- */
        .cards-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 16px; }
        .card-stat {
            background: var(--card); border: 1px solid var(--linha); border-radius: 18px;
            padding: 18px; display: flex; align-items: center; gap: 14px;
        }
        .badge {
            width: 46px; height: 46px; border-radius: 50%; flex: none;
            background: var(--marrom); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px;
        }
        .card-stat .rot { font-size: 12px; color: var(--txt-fraco); }
        .card-stat .num { font-size: 24px; font-weight: 800; color: var(--txt); }

        /* ---------- Barra de ferramentas ---------- */
        .busca {
            width: 100%; border: 1px solid #d8ccba; background: #fff;
            border-radius: 10px; padding: 9px 12px; font-size: 13px;
        }
        .barra-ferramentas { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 16px; }
        .chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .chip {
            border: 1px solid var(--linha); background: var(--card); color: var(--txt);
            border-radius: 999px; padding: 6px 12px; font-size: 12px; font-weight: 700; cursor: pointer;
        }
        .chip:hover { background: #f6efe4; }
        .chip.ativo { background: var(--escuro); border-color: var(--escuro); color: #f3e9dd; }
        .barra-ferramentas .busca { width: auto; flex: 1; min-width: 170px; }
        .toggle-linha { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: var(--txt-fraco); cursor: pointer; user-select: none; }
        .toggle-linha input { width: auto; }
        .pill-novos {
            font-size: 12px; font-weight: 800; border-radius: 999px; padding: 5px 12px;
            background: var(--card); border: 1px solid var(--linha); color: var(--txt-fraco);
            transition: background .3s ease, color .3s ease, border-color .3s ease;
        }
        .pill-novos.tem { background: #fdf0dd; border-color: #eac89b; color: #9a5b16; }
        .pill-novos.piscou { background: #f4cf98; }

        /* ---------- Metades: Mesa | Entrega — cada uma com Novos + Em preparação ---------- */
        .metades { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
        .metades.uma-metade { grid-template-columns: 1fr; max-width: 900px; margin: 0 auto; }
        .metade { background: var(--card2); border: 1px solid var(--linha); border-radius: 18px; padding: 16px; min-width: 0; }
        .metade-concluidos { background: var(--bg); }
        .metade-cab {
            display: flex; align-items: center; justify-content: space-between; gap: 8px;
            margin-bottom: 14px; padding-bottom: 12px; border-bottom: 2px solid var(--linha);
        }
        .metade-cab h2 { font-size: 16px; font-weight: 800; color: var(--marrom-forte); }
        .metade-cont {
            font-size: 12px; font-weight: 800; background: var(--card); border: 1px solid var(--linha);
            border-radius: 999px; padding: 3px 11px; color: var(--marrom-forte);
        }

        .secao-status { margin-top: 20px; }
        .secao-status:first-child { margin-top: 0; }
        .secao-status-cab { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
        .secao-status-cab h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .6px; color: #7c6b5c; }
        .secao-status-cont {
            font-size: 11px; font-weight: 800; background: var(--card); border: 1px solid var(--linha);
            border-radius: 999px; padding: 2px 9px; color: var(--marrom-forte);
        }
        .coluna-vazio { font-size: 12px; color: var(--txt-fraco); padding: 4px 2px 2px; }

        /* grade de cards: larga o quanto couber, nunca espremida */
        .grade-pedidos { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 14px; }

        /* ---------- Concluídos: separado embaixo, mesma proporção Mesa | Entrega ---------- */
        .secao-concluidos { margin-top: 30px; }
        .secao-concluidos-cab { margin-bottom: 14px; }
        .secao-concluidos-cab h2 { font-size: 15px; font-weight: 800; color: var(--marrom-forte); }

        /* ---------- Card de pedido ---------- */
        .card-pedido {
            background: var(--card); border: 1px solid var(--linha); border-left: 4px solid var(--linha);
            border-radius: 14px; padding: 16px; cursor: pointer;
            transition: box-shadow .12s ease, border-color .12s ease;
        }
        .card-pedido:hover { box-shadow: 0 3px 14px rgba(42,26,18,.10); }
        /* Semáforo do status: vermelho = ainda não aceito, amarelo = em preparação, verde = concluído. */
        .card-pedido--novo { border-left-color: #c0392b; background: #fdecea; }
        .card-pedido--preparando { border-left-color: #c98a1a; background: #fdf6e3; }
        .card-pedido--concluido { border-left-color: #2e7d43; opacity: .85; }
        .card-ped-topo { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
        .card-ped-num { font-size: 15px; font-weight: 800; color: var(--txt); }
        .card-ped-origem {
            font-size: 11px; font-weight: 800; letter-spacing: .2px; padding: 3px 9px;
            border-radius: 999px; white-space: nowrap;
        }
        .origem-mesa { background: #efe6d3; color: var(--marrom-forte); }
        .origem-entrega { background: #e3ecec; color: #3d5a5a; }
        .card-ped-hora { font-size: 12px; color: var(--txt-fraco); margin-top: 4px; }
        .card-ped-itens { margin: 12px 0 10px; font-size: 13px; line-height: 1.6; }
        .card-ped-itens .it-nome { font-weight: 700; color: var(--txt); }
        .card-ped-itens .it-adic { color: var(--txt-fraco); font-size: 12px; padding-left: 14px; }
        .card-ped-obs {
            font-size: 12px; font-style: italic; color: #6f5d4e;
            background: #f4ede2; border-radius: 9px; padding: 8px 11px; margin-bottom: 10px;
        }
        .card-ped-rodape { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 4px; flex-wrap: wrap; }
        .card-ped-total { font-size: 14px; font-weight: 800; color: var(--marrom-forte); }
        .card-ped-acoes { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }

        /* ---------- Modal de dados do cliente ---------- */
        .det-linha a { color: var(--marrom-forte); text-decoration: none; font-weight: 700; }
        .det-linha a:hover { text-decoration: underline; }

        /* ---------- Modal ---------- */
        .modal {
            position: fixed; inset: 0; z-index: 200; display: flex; align-items: center; justify-content: center;
            padding: 20px; background: rgba(30,18,12,.55);
        }
        .modal[hidden] { display: none; }
        body.bloqueado .modal { display: none !important; }
        .modal-caixa {
            background: var(--card); border: 1px solid var(--linha); border-radius: 18px;
            width: 100%; max-width: 480px; max-height: 90vh; overflow: auto;
            padding: 20px; box-shadow: 0 24px 70px rgba(0,0,0,.4);
        }
        .modal-cab { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .modal-cab h3 { font-size: 16px; font-weight: 700; color: var(--marrom-forte); margin: 0; }
        .modal-rodape { display: flex; gap: 8px; justify-content: flex-end; margin-top: 18px; flex-wrap: wrap; }
        .campo-rot-txt { font-size: 10px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; color: #8a7869; margin: 12px 0 4px; }
        .det-linha { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; padding: 5px 0; border-bottom: 1px solid var(--linha); }
        .det-linha:last-child { border-bottom: none; }
        .det-linha .det-rot { color: var(--txt-fraco); }
        .det-linha.forte { font-size: 15px; font-weight: 800; color: var(--marrom-forte); border-bottom: none; padding-top: 10px; }
        .det-itens { border: 1px solid var(--linha); border-radius: 10px; background: #fff; padding: 4px 12px; }
        .det-item { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--linha); }
        .det-item:last-child { border-bottom: none; }
        .det-item .it-nome { font-weight: 700; font-size: 13px; }
        .det-item .it-adic { font-size: 12px; color: var(--txt-fraco); padding-left: 12px; }
        .det-item-preco { font-size: 13px; font-weight: 700; white-space: nowrap; }
        .hist-lista { margin-top: 10px; display: flex; flex-direction: column; }
        .hist-row {
            display: grid; grid-template-columns: 62px 1fr auto auto; gap: 8px; align-items: center;
            font-size: 13px; padding: 9px 4px; border-bottom: 1px solid var(--linha); cursor: pointer;
        }
        .hist-row:hover { background: #f6efe4; }
        .hist-num { font-weight: 800; }
        .hist-org { color: var(--txt-fraco); }
        .hist-data { color: var(--txt-fraco); font-size: 12px; }
        .hist-total { font-weight: 700; color: var(--marrom-forte); }

        /* ---------- Mobile ---------- */
        @media (max-width: 900px) {
            .layout { flex-direction: column; }
            .barra-lateral { width: 100%; height: auto; position: static; align-self: stretch; padding: 16px; }
            .nav { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 14px; }
            .nav a {
                justify-content: center; text-align: center; padding: 12px 10px; font-size: 13px;
                background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.14);
            }
            .nav a.ativo { background: rgba(255,255,255,.16); border-color: rgba(255,255,255,.30); }
            .nav a .ic { display: none; }
            .btn-sair { margin-top: 12px; }
            .principal { padding: 18px 14px 60px; }
            .cabecalho { flex-direction: column; align-items: stretch; }
            .cards-stats { grid-template-columns: 1fr 1fr; }
            .metades { grid-template-columns: 1fr; }
            .grade-pedidos { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body class="bloqueado">

    <div class="layout">
        <aside class="barra-lateral">
            <div class="marca">
                <div class="marca-logo">🥖</div>
                <div class="marca-nome">Com Carinho</div>
                <div class="marca-slogan">Sabor em cada detalhe</div>
            </div>
            <nav class="nav">
                <a href="admin.html"><span class="ic">🏠</span> Início</a>
                <a href="admin.html#painelProdutos"><span class="ic">📦</span> Produtos</a>
                <a href="admin.html#painelSecoes"><span class="ic">🗂️</span> Categorias / Seções</a>
                <a href="admin.html#painelAdicionais"><span class="ic">🏷️</span> Adicionais</a>
                <a class="ativo" href="pedidos.php"><span class="ic">🧾</span> Pedidos</a>
            </nav>
            <button id="btnSair" class="btn-sair"><span>↩</span> Sair</button>
        </aside>

        <main class="principal">
            <div class="principal-conteudo">

                <div class="cabecalho">
                    <div>
                        <h1>Pedidos</h1>
                        <p>Acompanhe e movimente os pedidos durante o atendimento.</p>
                    </div>
                    <a class="btn-vercardapio" href="../site/" target="_blank" rel="noopener">Ver cardápio</a>
                </div>

                <div id="erroCarregar" class="erro-carregar" hidden></div>

                <div class="cards-stats">
                    <div class="card-stat"><div class="badge">🔔</div><div><div class="rot">Novos pedidos</div><div class="num" id="stNovos">0</div></div></div>
                    <div class="card-stat"><div class="badge">🍳</div><div><div class="rot">Em preparação</div><div class="num" id="stPrep">0</div></div></div>
                    <div class="card-stat"><div class="badge">✅</div><div><div class="rot">Concluídos hoje</div><div class="num" id="stHoje">0</div></div></div>
                </div>

                <div class="barra-ferramentas">
                    <div class="chips" id="chips"></div>
                    <input type="text" id="busca" class="busca" placeholder="Buscar nº do pedido ou mesa...">
                    <span class="pill-novos" id="pillNovos">0 novos</span>
                    <label class="toggle-linha"><input type="checkbox" id="tgAuto"> atualização automática</label>
                    <label class="toggle-linha"><input type="checkbox" id="tgSom"> aviso sonoro</label>
                    <button id="btnHistorico" class="btn btn-mini">Histórico</button>
                    <button id="btnSimular" class="btn btn-mini" title="Só enquanto não há entrada real de pedidos">Simular pedido (teste)</button>
                </div>

                <div id="quadro" class="metades"></div>

                <div id="quadroConcluidos" class="secao-concluidos">
                    <div class="secao-concluidos-cab"><h2>✅ Concluídos hoje</h2></div>
                    <div id="gradeConcluidos" class="metades"></div>
                </div>

                <p class="rodape-admin">Com Carinho · Pedidos — dados de exemplo até conectar a entrada real dos pedidos.</p>

            </div>
        </main>
    </div>

    <div id="modal" class="modal" hidden>
        <div class="modal-caixa">
            <div class="modal-cab">
                <h3 id="modalTitulo">Pedido</h3>
                <button id="modalX" class="btn-icone" type="button" aria-label="Fechar">✕</button>
            </div>
            <div id="modalCorpo"></div>
            <div class="modal-rodape" id="modalRodape"></div>
        </div>
    </div>

    <script src="pedidos.js?v=12"></script>
</body>
</html>
