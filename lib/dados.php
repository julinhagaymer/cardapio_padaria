<?php
declare(strict_types=1);

/* =====================================================================
   Backend do cardápio. Guarda tudo em catalogo.dados.json (criado no
   primeiro "Salvar"). Antes disso, usa os valores de fábrica abaixo.

   A SENHA do painel NÃO fica aqui. Ela é guardada como hash (password_hash)
   em  config/senha.local.php , que não vai para o versionamento.
   Para definir/trocar:   php ferramentas/definir-senha.php
   ===================================================================== */

/* Erros do PHP: nada na tela, tudo no log privado (dados/php-erros.log). */
require_once __DIR__ . '/bootstrap.php';

/* Funções de limpeza/validação de entrada (ler_texto, ler_email, ler_inteiro,
   ler_numero, ler_digitos, ler_opcao...). */
require_once __DIR__ . '/entrada.php';

/* Trava de tentativas de login por IP. */
require_once __DIR__ . '/limite_login.php';

/* Cópia de segurança automática a cada "Salvar" (ver responder_post). */
require_once __DIR__ . '/backup.php';

/* Fica FORA da pasta pública (public/), em dados/ — o servidor web não alcança. */
const ARQ_DADOS = __DIR__ . '/../dados/catalogo.dados.json';

/* Tamanho máximo do POST do painel (bytes). Vem da config central. */
defined('LIMITE_BYTES') || define('LIMITE_BYTES', (int) config('limite_bytes', 6 * 1024 * 1024));

/* Lê o hash da senha do painel de um arquivo fora do código-fonte.
   Primeiro tenta o caminho da config central; depois os lugares de sempre. */
function senha_hash_painel(): string
{
    $candidatos = [];
    $doConfig = config('senha_arquivo');
    if (is_string($doConfig) && $doConfig !== '') {
        $candidatos[] = $doConfig;
    }
    $candidatos[] = __DIR__ . '/../config/senha.local.php'; // padrão: config/ ao lado de lib/
    $candidatos[] = __DIR__ . '/config/senha.local.php';
    $candidatos[] = __DIR__ . '/senha.local.php';

    foreach ($candidatos as $arq) {
        if (is_file($arq)) {
            $h = include $arq;
            if (is_string($h) && $h !== '') {
                return $h;
            }
        }
    }
    return '';
}

/* ---- Sessão do painel ---- */

/* A conexão está em HTTPS? Considera também proxy reverso (a hospedagem quase
   sempre coloca um na frente e o PHP não vê $_SERVER['HTTPS']). */
function conexao_https(): bool
{
    if (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') {
        return true;
    }
    if ((string) ($_SERVER['SERVER_PORT'] ?? '') === '443') {
        return true;
    }
    if (strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https') {
        return true;
    }
    if (strtolower((string) ($_SERVER['HTTP_X_FORWARDED_SSL'] ?? '')) === 'on') {
        return true;
    }
    return false;
}

function iniciar_sessao(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    /* Endurecimento — precisa vir ANTES de session_start(): */
    ini_set('session.use_strict_mode', '1');  // recusa ID de sessão que não foi o PHP que gerou (anti session fixation)
    ini_set('session.use_only_cookies', '1'); // nunca aceita o ID da sessão pela URL
    ini_set('session.use_trans_sid', '0');    // nunca cola o ID em links

    session_name('painel_sid');               // não usa o nome padrão "PHPSESSID"

    session_set_cookie_params([
        'lifetime' => 0,                 // cookie de sessão: expira ao fechar o navegador
        'path'     => '/',
        'domain'   => '',                // host-only: não vaza para subdomínios
        'secure'   => conexao_https(),   // em HTTPS, o cookie só trafega criptografado
        'httponly' => true,              // JavaScript não consegue ler o cookie (anti-roubo via XSS)
        'samesite' => 'Lax',             // o cookie não acompanha requisições vindas de outros sites (anti-CSRF)
    ]);

    session_start();
}

function sessao_valida(): bool
{
    return !empty($_SESSION['painel_ok']);
}

function responder_entrar(): void
{
    header('Content-Type: application/json; charset=utf-8');

    $ip = ip_cliente();

    // 1) Este IP está de castigo? Nem chega a checar a senha.
    $trava = login_pode_tentar($ip);
    if (!$trava['ok']) {
        $min = (int) ceil($trava['espera'] / 60);
        http_response_code(429);
        header('Retry-After: ' . $trava['espera']);
        echo json_encode([
            'ok'     => false,
            'erro'   => 'Muitas tentativas. Aguarde ' . $min . ' min e tente de novo.',
            'espera' => $trava['espera'],
        ]);
        return;
    }

    $body = json_decode((string) file_get_contents('php://input'), true);
    $senha = ler_texto(is_array($body) ? $body : [], 'senha', 200);

    $hash = senha_hash_painel();
    if ($hash === '' || !password_verify($senha, $hash)) {
        // 2) Registra a falha e, se estourou o limite, informa o bloqueio.
        $bloqueio = login_registrar_falha($ip);
        usleep(500000);
        http_response_code($bloqueio > 0 ? 429 : 401);

        if ($hash === '') {
            $erro = 'Nenhuma senha definida no servidor. Rode: php ferramentas/definir-senha.php';
        } elseif ($bloqueio > 0) {
            $erro = 'Muitas tentativas erradas. Painel bloqueado por ' . (int) ceil($bloqueio / 60) . ' min.';
            header('Retry-After: ' . $bloqueio);
        } else {
            $erro = 'Senha incorreta.';
        }

        $resp = ['ok' => false, 'erro' => $erro];
        if ($bloqueio > 0) {
            $resp['espera'] = $bloqueio;
        }
        echo json_encode($resp);
        return;
    }

    // 3) Entrou: limpa a contagem deste IP e renova a sessão.
    login_registrar_sucesso($ip);
    session_regenerate_id(true);
    $_SESSION['painel_ok'] = true;
    echo json_encode(['ok' => true]);
}

function responder_sair(): void
{
    header('Content-Type: application/json; charset=utf-8');
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires'  => time() - 42000,
            'path'     => $p['path'],
            'domain'   => $p['domain'],
            'secure'   => (bool) $p['secure'],
            'httponly' => (bool) $p['httponly'],
            'samesite' => $p['samesite'] ?: 'Lax',
        ]);
    }
    session_destroy();
    echo json_encode(['ok' => true]);
}

function catalogo_padrao(): array
{
    return [
        'whatsapp' => (string) config('whatsapp_padrao', '553138354125'),
        'limiteObservacao' => 500,
        'categorias' => [
            ['id' => 'paes',     'nome' => 'Pães'],
            ['id' => 'salgados', 'nome' => 'Salgados'],
            ['id' => 'tortas',   'nome' => 'Tortas'],
            ['id' => 'pizzas',   'nome' => 'Pizzas'],
            ['id' => 'assados',  'nome' => 'Serviço de Assados'],
        ],
        'produtos' => [
            ['id' => 'pao-frances', 'categoria' => 'paes', 'tipo' => 'simples', 'nome' => 'Pão Francês (kg)', 'descricao' => 'Pãozinho tradicional quentinho e crocante.', 'preco' => 18.9, 'imagem' => 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600'],
            ['id' => 'pao-de-queijo', 'categoria' => 'paes', 'tipo' => 'simples', 'nome' => 'Pão de Queijo', 'descricao' => 'Feito com queijo canastra legítimo.', 'preco' => 4.5, 'imagem' => 'https://images.unsplash.com/photo-1598373182133-52452f7691ef?w=600'],
            ['id' => 'pao-integral', 'categoria' => 'paes', 'tipo' => 'simples', 'nome' => 'Pão Integral (kg)', 'descricao' => 'Massa com farinha integral e mix de grãos, mais leve.', 'preco' => 22.9, 'imagem' => 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600'],
            ['id' => 'pao-de-forma', 'categoria' => 'paes', 'tipo' => 'simples', 'nome' => 'Pão de Forma Caseiro', 'descricao' => 'Fatiado, bem macio e sem conservantes.', 'preco' => 16, 'imagem' => 'https://images.unsplash.com/photo-1598373182133-52452f7691ef?w=600'],
            ['id' => 'broa-de-fuba', 'categoria' => 'paes', 'tipo' => 'simples', 'nome' => 'Broa de Fubá', 'descricao' => 'Fofinha, com erva-doce, receita mineira.', 'preco' => 14.5, 'imagem' => 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600'],
            ['id' => 'pao-doce', 'categoria' => 'paes', 'tipo' => 'simples', 'nome' => 'Pão Doce Trançado', 'descricao' => 'Massa fofa levemente adocicada com açúcar cristal por cima.', 'preco' => 12, 'imagem' => 'https://images.unsplash.com/photo-1598373182133-52452f7691ef?w=600'],
            ['id' => 'baguete', 'categoria' => 'paes', 'tipo' => 'simples', 'nome' => 'Baguete Francesa', 'descricao' => 'Casca crocante e miolo aerado, assada no dia.', 'preco' => 9.9, 'imagem' => 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600'],
            ['id' => 'coxinha-frango', 'categoria' => 'salgados', 'tipo' => 'simples', 'nome' => 'Coxinha de Frango', 'descricao' => 'Com catupiry original e massa de batata.', 'preco' => 8.5, 'imagem' => 'https://images.unsplash.com/photo-1626844131082-256783844137?w=600'],
            ['id' => 'empada-frango', 'categoria' => 'salgados', 'tipo' => 'simples', 'nome' => 'Empada de Frango', 'descricao' => 'Massa amanteigada que desmancha na boca.', 'preco' => 7.5, 'imagem' => 'https://images.unsplash.com/photo-1626844131082-256783844137?w=600'],
            ['id' => 'pastel-carne', 'categoria' => 'salgados', 'tipo' => 'simples', 'nome' => 'Pastel de Carne', 'descricao' => 'Frito na hora, recheio suculento e temperado.', 'preco' => 8, 'imagem' => 'https://images.unsplash.com/photo-1626844131082-256783844137?w=600'],
            ['id' => 'enroladinho-salsicha', 'categoria' => 'salgados', 'tipo' => 'simples', 'nome' => 'Enroladinho de Salsicha', 'descricao' => 'Massa de pão macia com salsicha e queijo.', 'preco' => 6.5, 'imagem' => 'https://images.unsplash.com/photo-1626844131082-256783844137?w=600'],
            ['id' => 'kibe', 'categoria' => 'salgados', 'tipo' => 'simples', 'nome' => 'Kibe', 'descricao' => 'Trigo com carne e hortelã, bem temperado.', 'preco' => 7, 'imagem' => 'https://images.unsplash.com/photo-1626844131082-256783844137?w=600'],
            ['id' => 'torta-frango', 'categoria' => 'tortas', 'tipo' => 'simples', 'nome' => 'Fatia Torta de Frango', 'descricao' => 'Recheio cremoso e bem temperado.', 'preco' => 12, 'imagem' => 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600'],
            ['id' => 'torta-palmito', 'categoria' => 'tortas', 'tipo' => 'simples', 'nome' => 'Fatia Torta de Palmito', 'descricao' => 'Recheio cremoso de palmito com azeitona.', 'preco' => 12, 'imagem' => 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600'],
            ['id' => 'torta-limao', 'categoria' => 'tortas', 'tipo' => 'simples', 'nome' => 'Fatia Torta de Limão', 'descricao' => 'Base crocante, creme de limão e merengue maçaricado.', 'preco' => 13, 'imagem' => 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600'],
            ['id' => 'torta-morango', 'categoria' => 'tortas', 'tipo' => 'simples', 'nome' => 'Fatia Torta de Morango', 'descricao' => 'Chantilly, morangos frescos e massa amanteigada.', 'preco' => 15, 'imagem' => 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600'],
            ['id' => 'torta-chocolate', 'categoria' => 'tortas', 'tipo' => 'simples', 'nome' => 'Fatia Torta de Chocolate', 'descricao' => 'Camadas de brigadeiro cremoso e ganache meio amargo.', 'preco' => 14, 'imagem' => 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600'],
            ['id' => 'pizza-portuguesa', 'categoria' => 'pizzas', 'tipo' => 'pizza', 'nome' => 'Portuguesa', 'descricao' => 'Mussarela, presunto, calabresa, molho de tomate, ovo, bacon, azeitona, cebola, pimentão, tomate, palmito e orégano.', 'imagem' => 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600'],
            ['id' => 'pizza-presunto-mussarela', 'categoria' => 'pizzas', 'tipo' => 'pizza', 'nome' => 'Presunto e Mussarela', 'descricao' => 'Mussarela, molho de tomate, presunto, cebola, pimentão, azeitona, tomate e orégano.', 'imagem' => 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600'],
            ['id' => 'pizza-frango-catupiry', 'categoria' => 'pizzas', 'tipo' => 'pizza', 'nome' => 'Frango Catupiry', 'descricao' => 'Mussarela, molho de tomate, peito de frango desfiado, catupiry, azeitona, cebola, pimentão, tomate e orégano.', 'imagem' => 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600'],
            ['id' => 'pizza-calabresa', 'categoria' => 'pizzas', 'tipo' => 'pizza', 'nome' => 'Calabresa', 'descricao' => 'Mussarela, molho de tomate, calabresa, azeitona, cebola, pimentão, tomate e orégano.', 'imagem' => 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=600'],
            ['id' => 'pizza-frango-bacon', 'categoria' => 'pizzas', 'tipo' => 'pizza', 'nome' => 'Frango com Bacon', 'descricao' => 'Mussarela, molho de tomate, bacon, tomate, azeitona, cebola, pimentão e orégano.', 'imagem' => 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=600'],
            ['id' => 'assado-lombo', 'categoria' => 'assados', 'tipo' => 'simples', 'nome' => 'Lombo', 'descricao' => 'Serviço de assar (a carne é por conta do cliente).', 'preco' => 50, 'imagem' => 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600'],
            ['id' => 'assado-pernil', 'categoria' => 'assados', 'tipo' => 'simples', 'nome' => 'Pernil', 'descricao' => 'Serviço de assar (a carne é por conta do cliente).', 'preco' => 130, 'imagem' => 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=600'],
            ['id' => 'assado-chester', 'categoria' => 'assados', 'tipo' => 'simples', 'nome' => 'Chester', 'descricao' => 'Serviço de assar (a carne é por conta do cliente).', 'preco' => 50, 'imagem' => 'https://images.unsplash.com/photo-1574672280600-4accfa5b6f98?w=600'],
            ['id' => 'assado-peru', 'categoria' => 'assados', 'tipo' => 'simples', 'nome' => 'Peru', 'descricao' => 'Serviço de assar (a carne é por conta do cliente).', 'preco' => 50, 'imagem' => 'https://images.unsplash.com/photo-1574672280600-4accfa5b6f98?w=600'],
            ['id' => 'assado-leitoa', 'categoria' => 'assados', 'tipo' => 'simples', 'nome' => 'Leitoa', 'descricao' => 'Serviço de assar (a carne é por conta do cliente).', 'preco' => 150, 'imagem' => 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600'],
        ],
        'tamanhos' => [
            ['rotulo' => '25 cm — 4 pedaços', 'preco' => 49.9],
            ['rotulo' => '30 cm — 8 pedaços', 'preco' => 59.9],
        ],
        'bordas' => [
            ['rotulo' => 'Sem borda', 'preco' => 0],
            ['rotulo' => 'Com borda', 'preco' => 10],
        ],
        'adicionais' => [
            ['rotulo' => 'Catupiry', 'preco' => 8],
            ['rotulo' => 'Cheddar', 'preco' => 8],
            ['rotulo' => 'Bacon', 'preco' => 7],
            ['rotulo' => 'Palmito', 'preco' => 10],
        ],
    ];
}

function carregar_catalogo(): array
{
    if (is_file(ARQ_DADOS)) {
        $txt = @file_get_contents(ARQ_DADOS);
        $d = $txt !== false ? json_decode($txt, true) : null;
        if (is_array($d) && isset($d['categorias'], $d['produtos'])
            && is_array($d['categorias']) && is_array($d['produtos'])) {
            return normalizar_catalogo($d);
        }
    }
    return normalizar_catalogo(catalogo_padrao());
}

function slugificar(string $t): string
{
    $de = ['á','à','â','ã','ä','é','è','ê','ë','í','ì','î','ï','ó','ò','ô','õ','ö','ú','ù','û','ü','ç','ñ',
           'Á','À','Â','Ã','Ä','É','È','Ê','Ë','Í','Ì','Î','Ï','Ó','Ò','Ô','Õ','Ö','Ú','Ù','Û','Ü','Ç','Ñ'];
    $para = ['a','a','a','a','a','e','e','e','e','i','i','i','i','o','o','o','o','o','u','u','u','u','c','n',
             'a','a','a','a','a','e','e','e','e','i','i','i','i','o','o','o','o','o','u','u','u','u','c','n'];
    $t = str_replace($de, $para, $t);
    $t = strtolower($t);
    $t = preg_replace('/[^a-z0-9]+/', '-', $t) ?? '';
    $t = trim($t, '-');
    return $t !== '' ? $t : 'item';
}

function id_unico(string $base, array $usados): string
{
    $t = $base;
    $n = 2;
    while (in_array($t, $usados, true)) {
        $t = $base . '-' . $n;
        $n++;
    }
    return $t;
}

/* Só aceita foto enviada (data:image raster) ou https de domínio conhecido. */
function imagem_segura($url): string
{
    if (!is_string($url) || $url === '') {
        return '';
    }
    if (preg_match('#^data:image/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$#i', $url)) {
        return $url;
    }
    $p = parse_url($url);
    if ($p && ($p['scheme'] ?? '') === 'https' && ($p['host'] ?? '') === 'images.unsplash.com') {
        return $url;
    }
    return '';
}

/* Autoridade de verdade: limpa e valida o que vier do admin. */
function normalizar_catalogo(array $e): array
{
    $wpp = ler_digitos($e, 'whatsapp', 20);
    if ($wpp === '') {
        $wpp = preg_replace('/\D+/', '', (string) config('whatsapp_padrao', '553138354125')) ?: '553138354125';
    }
    $lim = ler_inteiro($e, 'limiteObservacao', 1, 5000, 500);

    $out = [
        'whatsapp' => $wpp,
        'limiteObservacao' => $lim,
        'categorias' => [],
        'produtos' => [],
        'tamanhos' => [],
        'bordas' => [],
        'adicionais' => [],
    ];

    $idsCat = [];
    foreach (is_array($e['categorias'] ?? null) ? $e['categorias'] : [] as $c) {
        if (!is_array($c)) {
            continue;
        }
        $nome = ler_texto($c, 'nome', 60);
        if ($nome === '') {
            $nome = 'Seção';
        }
        $id = limpar_texto($c['id'] ?? '', 60);
        if ($id === '' || in_array($id, $idsCat, true)) {
            $id = id_unico(slugificar($nome), $idsCat);
        }
        $idsCat[] = $id;
        $out['categorias'][] = ['id' => $id, 'nome' => $nome];
    }
    if (!$out['categorias']) {
        $out['categorias'][] = ['id' => 'geral', 'nome' => 'Geral'];
        $idsCat[] = 'geral';
    }

    /* Opções primeiro: cada produto referencia adicionais pelo id deles. */
    foreach (['tamanhos', 'bordas'] as $chave) {
        foreach (is_array($e[$chave] ?? null) ? $e[$chave] : [] as $o) {
            if (!is_array($o)) {
                continue;
            }
            $rot = ler_texto($o, 'rotulo', 60);
            $out[$chave][] = ['rotulo' => $rot !== '' ? $rot : 'Item', 'preco' => ler_numero($o, 'preco', 0.0, 1000000.0)];
        }
    }

    $idsAdd = [];
    foreach (is_array($e['adicionais'] ?? null) ? $e['adicionais'] : [] as $o) {
        if (!is_array($o)) {
            continue;
        }
        $rot = ler_texto($o, 'rotulo', 60);
        if ($rot === '') {
            $rot = 'Adicional';
        }
        $aid = limpar_texto($o['id'] ?? '', 60);
        if ($aid === '' || in_array($aid, $idsAdd, true)) {
            $aid = id_unico(slugificar($rot), $idsAdd);
        }
        $idsAdd[] = $aid;
        $out['adicionais'][] = ['id' => $aid, 'rotulo' => $rot, 'preco' => ler_numero($o, 'preco', 0.0, 1000000.0)];
    }

    $idsProd = [];
    foreach (is_array($e['produtos'] ?? null) ? $e['produtos'] : [] as $p) {
        if (!is_array($p)) {
            continue;
        }
        $nome = ler_texto($p, 'nome', 80);
        if ($nome === '') {
            $nome = 'Produto';
        }
        $id = limpar_texto($p['id'] ?? '', 80);
        if ($id === '' || in_array($id, $idsProd, true)) {
            $id = id_unico(slugificar($nome), $idsProd);
        }
        $idsProd[] = $id;

        $tipo = (($p['tipo'] ?? '') === 'pizza') ? 'pizza' : 'simples';
        $cat = in_array($p['categoria'] ?? '', $idsCat, true) ? (string) $p['categoria'] : $idsCat[0];

        $item = [
            'id' => $id,
            'categoria' => $cat,
            'tipo' => $tipo,
            'nome' => $nome,
            'descricao' => ler_texto($p, 'descricao', 1000),
            'imagem' => imagem_segura($p['imagem'] ?? ''),
        ];
        if ($tipo !== 'pizza') {
            $item['preco'] = ler_numero($p, 'preco', 0.0, 1000000.0);
        }

        if (array_key_exists('adicionais', $p) && is_array($p['adicionais'])) {
            $sel = [];
            foreach ($p['adicionais'] as $aid) {
                $aid = (string) $aid;
                if (in_array($aid, $idsAdd, true) && !in_array($aid, $sel, true)) {
                    $sel[] = $aid;
                }
            }
            $item['adicionais'] = $sel;
        } else {
            /* Compatibilidade: pizza sem lista definida mostra todos os adicionais. */
            $item['adicionais'] = $tipo === 'pizza' ? $idsAdd : [];
        }

        $out['produtos'][] = $item;
    }

    return $out;
}

/* Trata o POST do admin: normaliza e grava. (O acesso já foi checado no api.php.) */
function responder_post(): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');

    if (!sessao_valida()) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'erro' => 'Sessão expirada. Entre novamente.']);
        return;
    }

    $bruto = file_get_contents('php://input');
    if ($bruto === false || strlen($bruto) > LIMITE_BYTES) {
        http_response_code(413);
        echo json_encode(['ok' => false, 'erro' => 'Dados grandes demais. Use fotos menores.']);
        return;
    }

    $dados = json_decode($bruto, true);
    if (!is_array($dados)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'erro' => 'Formato inválido.']);
        return;
    }

    $limpo = normalizar_catalogo($dados);
    $json = json_encode($limpo, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'erro' => 'Não consegui converter os dados.']);
        return;
    }

    $dir = dirname(ARQ_DADOS);
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }

    $tmp = ARQ_DADOS . '.tmp' . getmypid();
    if (file_put_contents($tmp, $json, LOCK_EX) === false || !rename($tmp, ARQ_DADOS)) {
        @unlink($tmp);
        http_response_code(500);
        echo json_encode(['ok' => false, 'erro' => 'Não consegui gravar. A pasta do site precisa ter permissão de escrita.']);
        return;
    }

    backup_catalogo(ARQ_DADOS);

    echo json_encode(['ok' => true, 'catalogo' => $limpo]);
}
