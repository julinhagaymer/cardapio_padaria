<?php
declare(strict_types=1);

/* =====================================================================
   Gerenciamento de PEDIDOS da padaria.

   Guarda em  dados/pedidos.json  (fora da pasta pública). Ainda NÃO há
   entrada de pedidos pelo cliente — na primeira vez o arquivo é semeado
   com exemplos coerentes com o cardápio atual, só para a tela funcionar.
   A estrutura já está pronta para, depois, receber pedidos de verdade:
   basta o cliente/entrega gravar um objeto no mesmo formato de
   normalizar_pedido() e o painel passa a mostrá-lo.

   O painel de Pedidos é DIÁRIO: número do pedido e as contagens reiniciam
   sozinhos a cada novo dia (calculados a partir de "hoje", não guardados
   à parte).

   PRIVACIDADE: como um pedido carrega dados de quem comprou (nome,
   telefone, endereço), o arquivo AO VIVO (dados/pedidos.json) só guarda
   isso por pouco tempo — pedidos_retencao_completa_dias (padrão 2 dias:
   hoje + ontem, o suficiente pro painel e pra um backup de curtíssimo
   prazo, ver lib/backup.php). Passado esse prazo, cada pedido vira um
   registro ANÔNIMO (data, valor total, produtos e modo de compra — sem
   nada que identifique o comprador) em dados/pedidos_historico.json, que
   aí sim fica guardado por pedidos_retencao_dias (padrão 3 meses / 92
   dias) para uma futura tela de histórico/relatório.
   ===================================================================== */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/entrada.php';
require_once __DIR__ . '/backup.php';
require_once __DIR__ . '/enderecos.php';

const ARQ_PEDIDOS   = __DIR__ . '/../dados/pedidos.json';
const ARQ_HISTORICO = __DIR__ . '/../dados/pedidos_historico.json';
/* Sem fase "pronto": ao aceitar o pedido ele vai para "preparando" e, ao
   marcar como pronto, já vai direto para "concluido". */
const STATUS_PEDIDO = ['novo', 'preparando', 'concluido'];

/* Início (00:00) do dia que contém $quando, no fuso do servidor. */
function inicio_do_dia(?int $quando = null): int
{
    return (int) strtotime('midnight', $quando ?? time());
}

/* Tira do arquivo AO VIVO os pedidos mais velhos que
   pedidos_retencao_completa_dias — antes de descartar os dados completos
   (nome, telefone, endereço...), arquiva uma versão anônima de cada um em
   pedidos_historico.json (ver historico_registrar_varios). */
function pedidos_podar(array $lista): array
{
    $dias = max(1, (int) config('pedidos_retencao_completa_dias', 2));
    $limite = time() - $dias * 86400;

    $mantidos = [];
    $expirados = [];
    foreach ($lista as $p) {
        if ((int) ($p['criado_em'] ?? 0) >= $limite) {
            $mantidos[] = $p;
        } else {
            $expirados[] = $p;
        }
    }
    if ($expirados) {
        historico_registrar_varios($expirados);
    }
    return $mantidos;
}

/* ---- Histórico anônimo (3 meses, sem dados de quem comprou) ---- */

function historico_carregar(): array
{
    if (!is_file(ARQ_HISTORICO)) { return []; }
    $d = json_decode((string) @file_get_contents(ARQ_HISTORICO), true);
    return is_array($d) ? $d : [];
}

function historico_gravar(array $lista): bool
{
    $dir = dirname(ARQ_HISTORICO);
    if (!is_dir($dir)) { @mkdir($dir, 0775, true); }

    $json = json_encode(array_values($lista), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    if ($json === false) { return false; }

    $tmp = ARQ_HISTORICO . '.tmp' . getmypid();
    if (@file_put_contents($tmp, $json, LOCK_EX) === false || !@rename($tmp, ARQ_HISTORICO)) {
        @unlink($tmp);
        return false;
    }
    return true;
}

/* Só o essencial pra estatística — nada que identifique o comprador: sem
   nome, telefone, endereço ou nº de mesa. */
function historico_anonimizar(array $p): array
{
    return [
        'data'   => (int) ($p['criado_em'] ?? time()),
        'origem' => (($p['origem'] ?? '') === 'mesa') ? 'mesa' : 'entrega',
        'total'  => round((float) ($p['total'] ?? 0), 2),
        'itens'  => array_map(function ($it) {
            return [
                'nome' => (string) ($it['nome'] ?? 'Item'),
                'qtd'  => (int) ($it['qtd'] ?? 1),
            ];
        }, is_array($p['itens'] ?? null) ? $p['itens'] : []),
    ];
}

function historico_podar(array $lista): array
{
    $dias = max(1, (int) config('pedidos_retencao_dias', 92));
    $limite = time() - $dias * 86400;
    return array_values(array_filter($lista, function ($h) use ($limite) {
        return (int) ($h['data'] ?? 0) >= $limite;
    }));
}

function historico_registrar_varios(array $pedidos): void
{
    if (!$pedidos) { return; }
    $lista = historico_carregar();
    foreach ($pedidos as $p) {
        $lista[] = historico_anonimizar($p);
    }
    historico_gravar(historico_podar($lista));
}

/* ---- Armazenamento ---- */

function pedidos_carregar(): array
{
    if (is_file(ARQ_PEDIDOS)) {
        $txt = @file_get_contents(ARQ_PEDIDOS);
        $d = $txt !== false ? json_decode($txt, true) : null;
        if (is_array($d)) {
            $out = [];
            foreach ($d as $p) {
                if (is_array($p)) { $out[] = normalizar_pedido($p); }
            }
            $podado = pedidos_podar($out);
            if (count($podado) !== count($out)) {
                pedidos_gravar($podado); // limpa do arquivo o que já passou da retenção
            }
            // Confere a expiração do backup diário a cada carregamento (não só
            // quando algo é gravado) — o painel recarrega sozinho a cada 15s
            // enquanto está aberto, então isso garante que uma cópia com dado
            // de comprador nunca fique esquecida além do prazo mesmo em dias
            // parados (sem pedido novo, sem mudança de status).
            backup_expirar_por_idade(DIR_BACKUPS . '/pedidos', (int) config('backup_pedidos_validade_dias', 2));
            return $podado;
        }
    }
    $seed = pedidos_exemplo();
    pedidos_gravar($seed);
    return $seed;
}

function pedidos_gravar(array $lista): bool
{
    $dir = dirname(ARQ_PEDIDOS);
    if (!is_dir($dir)) { @mkdir($dir, 0775, true); }

    $json = json_encode(array_values($lista), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    if ($json === false) { return false; }

    $tmp = ARQ_PEDIDOS . '.tmp' . getmypid();
    if (@file_put_contents($tmp, $json, LOCK_EX) === false || !@rename($tmp, ARQ_PEDIDOS)) {
        @unlink($tmp);
        return false;
    }

    backup_pedidos(ARQ_PEDIDOS);
    return true;
}

/* ---- Validação / formato ---- */

function normalizar_pedido($p): array
{
    $origem = (($p['origem'] ?? '') === 'mesa') ? 'mesa' : 'entrega';

    $mesa = null;
    if ($origem === 'mesa') {
        $m = (int) ($p['mesa'] ?? 0);
        $mesa = $m > 0 ? $m : 1;
    }

    $itens = [];
    foreach (is_array($p['itens'] ?? null) ? $p['itens'] : [] as $it) {
        if (!is_array($it)) { continue; }
        $nome = trim((string) ($it['nome'] ?? ''));
        if ($nome === '') { $nome = 'Item'; }
        $adic = [];
        foreach (is_array($it['adicionais'] ?? null) ? $it['adicionais'] : [] as $a) {
            $a = trim((string) $a);
            if ($a !== '') { $adic[] = $a; }
        }
        $itens[] = [
            'nome'       => $nome,
            'qtd'        => max(1, (int) ($it['qtd'] ?? 1)),
            'preco'      => round((float) ($it['preco'] ?? 0), 2),
            'adicionais' => $adic,
            'obs'        => trim((string) ($it['obs'] ?? '')),
        ];
    }

    // Migração: pedidos salvos quando a fase "pronto" ainda existia viram
    // "concluido" (era o passo seguinte a "pronto" e agora acontece junto).
    $statusIn = (string) ($p['status'] ?? '');
    if ($statusIn === 'pronto') { $statusIn = 'concluido'; }
    $status = in_array($statusIn, STATUS_PEDIDO, true) ? $statusIn : 'novo';

    $criado = (int) ($p['criado_em'] ?? time());
    $cliente = trim((string) ($p['cliente'] ?? ''));
    $telefone = trim((string) ($p['telefone'] ?? ''));
    $endereco = trim((string) ($p['endereco'] ?? ''));
    $modoEntregaIn = ($p['modo_entrega'] ?? null);
    $modoEntrega = in_array($modoEntregaIn, ['receber', 'retirar'], true) ? $modoEntregaIn : null;

    $concluidoEm = !empty($p['concluido_em']) ? (int) $p['concluido_em'] : null;
    if ($status === 'concluido' && $concluidoEm === null) {
        $concluidoEm = (int) ($p['atualizado_em'] ?? $criado);
    }

    return [
        'id'            => (int) ($p['id'] ?? $criado),
        'numero'        => (int) ($p['numero'] ?? ($p['id'] ?? 0)),
        'origem'        => $origem,
        'mesa'          => $mesa,
        'cliente'       => $cliente !== '' ? $cliente : null,
        'telefone'      => $telefone !== '' ? $telefone : null,
        'endereco'      => $endereco !== '' ? $endereco : null,
        'modo_entrega'  => $modoEntrega,
        'status'        => $status,
        'criado_em'     => $criado,
        'atualizado_em' => (int) ($p['atualizado_em'] ?? $criado),
        'concluido_em'  => $concluidoEm,
        'itens'         => $itens,
        'observacao'    => trim((string) ($p['observacao'] ?? '')),
        'total'         => round((float) ($p['total'] ?? 0), 2),
    ];
}

/* Muda o status de um pedido (avançar ou voltar um passo). Devolve o
   pedido atualizado, ou null se o id não existe / status inválido. */
function pedido_mudar_status(int $id, string $novo): ?array
{
    if (!in_array($novo, STATUS_PEDIDO, true)) { return null; }

    $lista = pedidos_carregar();
    $atualizado = null;
    foreach ($lista as $i => $p) {
        if ((int) $p['id'] === $id) {
            $lista[$i]['status']        = $novo;
            $lista[$i]['atualizado_em'] = time();
            $lista[$i]['concluido_em']  = $novo === 'concluido' ? time() : null;
            $atualizado = $lista[$i];
            break;
        }
    }
    if ($atualizado === null) { return null; }

    pedidos_gravar($lista);
    return $atualizado;
}

/* ---- Exemplos / simulação (enquanto não há entrada real de pedidos) ---- */

function _preco_adicional(string $rotulo, array $catAdic): float
{
    foreach ($catAdic as $a) {
        if (($a['rotulo'] ?? '') === $rotulo) { return (float) ($a['preco'] ?? 0); }
    }
    return 0.0;
}

function _produtos_do_cardapio(): array
{
    $cat = function_exists('carregar_catalogo') ? carregar_catalogo() : [];
    $prods = [];
    foreach (is_array($cat['produtos'] ?? null) ? $cat['produtos'] : [] as $p) {
        if (($p['tipo'] ?? 'simples') !== 'pizza' && isset($p['preco'])) {
            $prods[] = ['nome' => (string) $p['nome'], 'preco' => (float) $p['preco']];
        }
    }
    if (!$prods) {
        $prods = [
            ['nome' => 'Pão de Queijo', 'preco' => 4.5],
            ['nome' => 'Coxinha de Frango', 'preco' => 8.5],
            ['nome' => 'Fatia Torta de Chocolate', 'preco' => 14.0],
            ['nome' => 'Empada de Frango', 'preco' => 7.5],
            ['nome' => 'Broa de Fubá', 'preco' => 14.5],
        ];
    }
    $catAdic = is_array($cat['adicionais'] ?? null) ? $cat['adicionais'] : [];
    if (!$catAdic) {
        $catAdic = [['rotulo' => 'Catupiry', 'preco' => 8], ['rotulo' => 'Cheddar', 'preco' => 8], ['rotulo' => 'Bacon', 'preco' => 7]];
    }
    return [$prods, $catAdic];
}

function pedidos_exemplo(): array
{
    list($prods, $catAdic) = _produtos_do_cardapio();
    $adicNomes = array_map(function ($a) { return (string) $a['rotulo']; }, $catAdic);
    $P = function (int $i) use ($prods) { return $prods[$i % count($prods)]; };
    $ag = time();

    /* [min_atrás, status, origem, mesa, cliente, [[idxProd, qtd, [idxAdic...]], ...], observação] */
    $defs = [
        [3,   'novo',       'mesa',   7, null,     [[0, 2, [0, 2]], [2, 1, []]],  'Sem açúcar no café'],
        [7,   'novo',       'entrega', 0, 'Marina', [[1, 3, [1]], [4, 1, []]],     ''],
        [12,  'novo',       'mesa',   3, null,     [[3, 2, []]],                  'Bem quentinho, por favor'],
        [19,  'preparando', 'mesa',   5, null,     [[0, 4, [0]], [1, 1, [2]]],    ''],
        [26,  'preparando', 'entrega', 0, 'Jorge',  [[2, 1, []], [4, 2, []]],      'Entregar na portaria'],
        [41,  'concluido',  'mesa',   1, null,     [[1, 2, [0, 2]]],              ''],
        [55,  'concluido',  'entrega', 0, 'Bia',    [[3, 1, []], [0, 6, []]],      ''],
        [95,  'concluido',  'mesa',   2, null,     [[4, 1, []], [2, 1, []]],      ''],
        [150, 'concluido',  'entrega', 0, 'Rafael', [[0, 3, [0, 1]]],             'Troco para R$ 50'],
        [1600,'concluido',  'mesa',   6, null,     [[1, 2, []]],                  ''],
    ];

    // Monta em ordem cronológica pra numerar como na vida real: o contador
    // reinicia sozinho a cada dia (mesma regra do pedido_simular()).
    $itensDef = [];
    foreach ($defs as $d) {
        list($min, $status, $origem, $mesa, $cliente, $its, $obs) = $d;
        $itensDef[] = [
            'criado' => $ag - $min * 60, 'status' => $status, 'origem' => $origem,
            'mesa' => $mesa, 'cliente' => $cliente, 'its' => $its, 'obs' => $obs,
        ];
    }
    usort($itensDef, function ($a, $b) { return $a['criado'] <=> $b['criado']; });

    $lista = [];
    $contadores = [];
    foreach ($itensDef as $d) {
        $diaChave = date('Y-m-d', $d['criado']);
        $contadores[$diaChave] = ($contadores[$diaChave] ?? 0) + 1;

        $itens = [];
        $total = 0.0;
        foreach ($d['its'] as $it) {
            $pr = $P($it[0]);
            $adics = [];
            foreach ($it[2] as $ai) {
                $rot = $adicNomes ? $adicNomes[$ai % count($adicNomes)] : 'Adicional';
                $adics[] = $rot;
                $total += $it[1] * _preco_adicional($rot, $catAdic);
            }
            $total += $it[1] * (float) $pr['preco'];
            $itens[] = [
                'nome' => $pr['nome'], 'qtd' => $it[1], 'preco' => round((float) $pr['preco'], 2),
                'adicionais' => $adics, 'obs' => '',
            ];
        }

        $lista[] = normalizar_pedido([
            'id'            => $d['criado'],
            'numero'        => $contadores[$diaChave],
            'origem'        => $d['origem'],
            'mesa'          => $d['mesa'],
            'cliente'       => $d['cliente'],
            'status'        => $d['status'],
            'criado_em'     => $d['criado'],
            'atualizado_em' => $d['criado'] + 60,
            'concluido_em'  => $d['status'] === 'concluido' ? $d['criado'] + 1200 : null,
            'itens'         => $itens,
            'observacao'    => $d['obs'],
            'total'         => round($total, 2),
        ]);
    }
    return $lista;
}

/* Cria um pedido NOVO aleatório e grava — botão "Simular pedido (teste)".
   Some quando a entrada real de pedidos estiver conectada. */
function pedido_simular(): array
{
    list($prods, $catAdic) = _produtos_do_cardapio();
    $adicNomes = array_map(function ($a) { return (string) $a['rotulo']; }, $catAdic);

    $lista = pedidos_carregar();
    $id = time();
    $usados = array_map(function ($p) { return (int) $p['id']; }, $lista);
    while (in_array($id, $usados, true)) { $id++; }

    // Numeração reinicia sozinha a cada dia: olha só os pedidos de hoje.
    $hoje = inicio_do_dia();
    $maxNum = 0;
    foreach ($lista as $p) {
        if ((int) ($p['criado_em'] ?? 0) >= $hoje) {
            $maxNum = max($maxNum, (int) $p['numero']);
        }
    }

    $itens = [];
    $total = 0.0;
    $qtdItens = random_int(1, 3);
    for ($k = 0; $k < $qtdItens; $k++) {
        $pr = $prods[random_int(0, count($prods) - 1)];
        $qtd = random_int(1, 4);
        $adics = [];
        if ($adicNomes && random_int(0, 2) === 0) {
            $adics[] = $adicNomes[random_int(0, count($adicNomes) - 1)];
        }
        foreach ($adics as $rot) { $total += $qtd * _preco_adicional($rot, $catAdic); }
        $total += $qtd * (float) $pr['preco'];
        $itens[] = ['nome' => $pr['nome'], 'qtd' => $qtd, 'preco' => round((float) $pr['preco'], 2), 'adicionais' => $adics, 'obs' => ''];
    }

    $online = random_int(0, 1) === 1;
    $nomes = ['Ana', 'Leo', 'Cris', 'Dani', 'Pedro', 'Sofia'];

    $novo = normalizar_pedido([
        'id'         => $id,
        'numero'     => $maxNum + 1,
        'origem'     => $online ? 'entrega' : 'mesa',
        'mesa'       => $online ? 0 : random_int(1, 12),
        'cliente'    => $online ? $nomes[random_int(0, count($nomes) - 1)] : null,
        'status'     => 'novo',
        'criado_em'  => time(),
        'itens'      => $itens,
        'observacao' => random_int(0, 3) === 0 ? 'Caprichar no ponto' : '',
        'total'      => round($total, 2),
    ]);

    $lista[] = $novo;
    pedidos_gravar($lista);
    return $novo;
}

/* ---- Pedido de verdade, feito pelo cliente no site (mesa/QR ou entrega) ---- */

/* Cria um pedido a partir do CARRINHO que o cliente montou no cardápio
   (carrinho.js manda tudo de uma vez pro site/pedido.php, que chama esta
   função) — um pedido só, com todos os itens juntos, mesmo que sejam de
   produtos diferentes. Vem de uma página pública, sem login — então NADA
   de preço/nome do navegador é usado direto: cada item é reconferido aqui,
   um a um, a partir do cardápio ao vivo.

   origem vem do cliente ('mesa', do QR Code da mesa, ou 'entrega', pedido
   para delivery) — cada uma exige dados diferentes: mesa pede nome e nº da
   mesa; entrega pede nome, telefone e endereço.
   Devolve ['ok'=>bool, 'pedido'=>array] ou ['ok'=>false,'erro'=>string,'status'=>int]. */
function pedido_criar_do_cliente(array $body): array
{
    $cat = function_exists('carregar_catalogo') ? carregar_catalogo() : null;
    if (!is_array($cat) || !is_array($cat['produtos'] ?? null)) {
        return ['ok' => false, 'erro' => 'Cardápio indisponível no momento.', 'status' => 500];
    }

    $limiteObs = (int) ($cat['limiteObservacao'] ?? 500);
    $observacao = ler_texto($body, 'observacao', $limiteObs);

    $cliente = ler_texto($body, 'cliente', 60);
    if ($cliente === '') {
        return ['ok' => false, 'erro' => 'Informe seu nome.', 'status' => 400];
    }

    $origem = ler_opcao($body, 'origem', ['mesa', 'entrega'], 'entrega');
    $mesa = null;
    $telefone = '';
    $endereco = '';
    $modoEntrega = null;
    if ($origem === 'mesa') {
        $mesa = ler_inteiro($body, 'mesa', 1, 999, 0);
        if ($mesa <= 0) {
            return ['ok' => false, 'erro' => 'Número da mesa inválido. Escaneie o QR Code da sua mesa de novo.', 'status' => 400];
        }
    } else {
        $telefone = ler_texto($body, 'telefone', 20);
        if ($telefone === '') {
            return ['ok' => false, 'erro' => 'Informe seu telefone.', 'status' => 400];
        }

        $modoEntrega = ler_opcao($body, 'modoEntrega', ['receber', 'retirar'], 'receber');
        if ($modoEntrega === 'retirar') {
            // Retirada na loja: sem endereço nenhum do cliente pra guardar.
            $endereco = '';
        } else {
            $cidade = ler_texto($body, 'cidade', 60);
            $bairro = ler_texto($body, 'bairro', 80);
            $rua = ler_texto($body, 'rua', 150);
            $numero = ler_texto($body, 'numero', 10);
            $complemento = ler_texto($body, 'complemento', 100); // opcional, sem checar vazio

            if (!in_array($cidade, cidades_atendidas(), true)) {
                return ['ok' => false, 'erro' => 'Cidade de entrega não disponível.', 'status' => 400];
            }
            if (!in_array($bairro, bairros_de($cidade), true)) {
                return ['ok' => false, 'erro' => 'Selecione um bairro válido da lista.', 'status' => 400];
            }
            if ($rua === '' || $numero === '') {
                return ['ok' => false, 'erro' => 'Informe rua e número do endereço.', 'status' => 400];
            }

            $endereco = $rua . ', ' . $numero;
            if ($complemento !== '') { $endereco .= ' (' . $complemento . ')'; }
            $endereco .= ' - ' . $bairro . ', ' . $cidade;
        }
    }

    $itensBrutos = is_array($body['itens'] ?? null) ? $body['itens'] : [];
    if (!$itensBrutos) {
        return ['ok' => false, 'erro' => 'Carrinho vazio.', 'status' => 400];
    }
    if (count($itensBrutos) > 40) {
        return ['ok' => false, 'erro' => 'Carrinho com itens demais. Finalize em partes menores.', 'status' => 400];
    }

    $itensFinal = [];
    $total = 0.0;

    foreach ($itensBrutos as $itemBruto) {
        if (!is_array($itemBruto)) { continue; }

        $produtoId = ler_texto($itemBruto, 'produtoId', 120);
        $produto = null;
        foreach ($cat['produtos'] as $p) {
            if (($p['id'] ?? null) === $produtoId) { $produto = $p; break; }
        }
        if ($produto === null) {
            return ['ok' => false, 'erro' => 'Um item do carrinho não foi encontrado. Recarregue o cardápio e tente de novo.', 'status' => 404];
        }

        $qtd = ler_inteiro($itemBruto, 'qtd', 1, 50, 1);
        $obsItem = ler_texto($itemBruto, 'obs', $limiteObs);
        $ehPizza = ($produto['tipo'] ?? 'simples') === 'pizza';
        $unit = 0.0;
        $nomeItem = (string) $produto['nome'];

        if ($ehPizza) {
            $tamRot = ler_texto($itemBruto, 'tamanho', 80);
            $bordaRot = ler_texto($itemBruto, 'borda', 80);
            $tam = null;
            $borda = null;
            foreach (is_array($cat['tamanhos'] ?? null) ? $cat['tamanhos'] : [] as $t) {
                if (($t['rotulo'] ?? null) === $tamRot) { $tam = $t; break; }
            }
            foreach (is_array($cat['bordas'] ?? null) ? $cat['bordas'] : [] as $b) {
                if (($b['rotulo'] ?? null) === $bordaRot) { $borda = $b; break; }
            }
            if ($tam === null || $borda === null) {
                return ['ok' => false, 'erro' => 'Escolha o tamanho e a borda de cada pizza no carrinho.', 'status' => 400];
            }
            $unit += (float) $tam['preco'] + (float) $borda['preco'];
            $nomeItem = 'Pizza ' . $produto['nome'] . ' (' . $tam['rotulo'] . ')';
        } else {
            $unit += (float) ($produto['preco'] ?? 0);
        }

        // Só aceita adicionais que este produto realmente oferece (mesma
        // regra que o cardápio já usa pra decidir o que mostrar ao cliente).
        $idsPermitidos = is_array($produto['adicionais'] ?? null) ? $produto['adicionais'] : [];
        $adicEnviados = is_array($itemBruto['adicionais'] ?? null) ? $itemBruto['adicionais'] : [];
        $adicSelecionados = [];
        foreach ($adicEnviados as $rotBruto) {
            $rot = is_string($rotBruto) ? trim($rotBruto) : '';
            if ($rot === '' || in_array($rot, $adicSelecionados, true)) { continue; }
            foreach (is_array($cat['adicionais'] ?? null) ? $cat['adicionais'] : [] as $a) {
                if (($a['rotulo'] ?? null) === $rot && in_array($a['id'] ?? null, $idsPermitidos, true)) {
                    $adicSelecionados[] = $rot;
                    $unit += (float) $a['preco'];
                    break;
                }
            }
        }

        $itensFinal[] = [
            'nome' => $nomeItem, 'qtd' => $qtd, 'preco' => round($unit, 2),
            'adicionais' => $adicSelecionados, 'obs' => $obsItem,
        ];
        $total += $unit * $qtd;
    }

    if (!$itensFinal) {
        return ['ok' => false, 'erro' => 'Nenhum item válido no carrinho.', 'status' => 400];
    }

    $agora = time();
    $lista = pedidos_carregar();

    $id = $agora;
    $usados = array_map(function ($p) { return (int) $p['id']; }, $lista);
    while (in_array($id, $usados, true)) { $id++; }

    // Numeração diária, igual ao resto do sistema.
    $hoje = inicio_do_dia($agora);
    $maxNum = 0;
    foreach ($lista as $p) {
        if ((int) ($p['criado_em'] ?? 0) >= $hoje) { $maxNum = max($maxNum, (int) $p['numero']); }
    }

    $pedido = normalizar_pedido([
        'id'         => $id,
        'numero'     => $maxNum + 1,
        'origem'     => $origem,
        'mesa'       => $mesa,
        'cliente'    => $cliente,
        'telefone'   => $telefone,
        'endereco'   => $endereco,
        'modo_entrega' => $modoEntrega,
        'status'     => 'novo',
        'criado_em'  => $agora,
        'itens'      => $itensFinal,
        'observacao' => $observacao,
        'total'      => round($total, 2),
    ]);

    $lista[] = $pedido;
    pedidos_gravar($lista);

    return ['ok' => true, 'pedido' => $pedido];
}

/* ---- Trava anti-spam por IP no envio de pedido (endpoint público) ---- */

const ARQ_PEDIDO_LIMITE = __DIR__ . '/../dados/pedido_limite.json';

function pedido_ip_ler(): array
{
    if (!is_file(ARQ_PEDIDO_LIMITE)) { return []; }
    $d = json_decode((string) @file_get_contents(ARQ_PEDIDO_LIMITE), true);
    return is_array($d) ? $d : [];
}

/* Este IP pode enviar mais um pedido agora?  ['ok'=>bool, 'espera'=>segundos] */
function pedido_ip_pode_enviar(string $ip): array
{
    $janela = (int) config('pedido_ip_janela_seg', 600);
    $max = (int) config('pedido_ip_max', 8);
    $e = pedido_ip_ler()[$ip] ?? null;
    if (!$e) { return ['ok' => true, 'espera' => 0]; }

    $decorrido = time() - (int) ($e['inicio'] ?? 0);
    if ($decorrido > $janela) { return ['ok' => true, 'espera' => 0]; }
    if ((int) ($e['n'] ?? 0) >= $max) {
        return ['ok' => false, 'espera' => max(1, $janela - $decorrido)];
    }
    return ['ok' => true, 'espera' => 0];
}

/* Conta mais um envio deste IP na janela atual. */
function pedido_ip_registrar(string $ip): void
{
    $janela = (int) config('pedido_ip_janela_seg', 600);
    $agora = time();
    $d = pedido_ip_ler();

    $e = $d[$ip] ?? null;
    if (!$e || ($agora - (int) ($e['inicio'] ?? 0)) > $janela) {
        $d[$ip] = ['inicio' => $agora, 'n' => 1];
    } else {
        $d[$ip]['n'] = (int) $e['n'] + 1;
    }

    // poda entradas já bem fora da janela, pra não crescer sem parar
    foreach ($d as $chave => $v) {
        if (($agora - (int) ($v['inicio'] ?? 0)) > $janela * 6) { unset($d[$chave]); }
    }

    @file_put_contents(ARQ_PEDIDO_LIMITE, json_encode($d), LOCK_EX);
}
