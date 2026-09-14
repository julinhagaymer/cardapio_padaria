<?php
declare(strict_types=1);

/* =====================================================================
   Trava de tentativas de login por IP.

   Guarda um contador por IP num arquivo em  dados/  (fora da pasta
   pública). Depois de LOGIN_MAX_FALHAS erros dentro da janela, o IP fica
   bloqueado por um tempo que DOBRA a cada reincidência (teto de 8x).
   Um login certo zera o contador daquele IP.

   Para liberar manualmente:  php ferramentas/liberar-login.php

   Os números (tentativas / janela / bloqueio) vêm da config central
   (config/config.local.php), com os padrões abaixo.
   ===================================================================== */

require_once __DIR__ . '/config.php';

defined('LOGIN_MAX_FALHAS')   || define('LOGIN_MAX_FALHAS',   (int) config('login_max_falhas', 5));      // erros seguidos antes de bloquear
defined('LOGIN_JANELA_SEG')   || define('LOGIN_JANELA_SEG',   (int) config('login_janela_seg', 900));    // fora disso a contagem zera sozinha
defined('LOGIN_BLOQUEIO_SEG') || define('LOGIN_BLOQUEIO_SEG', (int) config('login_bloqueio_seg', 900));  // 1ª punição (x2, x3... até x8)

function login_arquivo_limite(): string
{
    return __DIR__ . '/../dados/login_tentativas.json';
}

/* IP de quem está chamando. Se o servidor estiver atrás de um proxy local
   (REMOTE_ADDR privado/loopback), usa o 1º IP do X-Forwarded-For. */
function ip_cliente(): string
{
    $remoto = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    $publico = filter_var(
        $remoto,
        FILTER_VALIDATE_IP,
        FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
    );
    if ($publico === false && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $primeiro = trim(explode(',', (string) $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
        if (filter_var($primeiro, FILTER_VALIDATE_IP) !== false) {
            return $primeiro;
        }
    }
    return $remoto !== '' ? $remoto : 'desconhecido';
}

function login_ler(): array
{
    $arq = login_arquivo_limite();
    if (!is_file($arq)) {
        return [];
    }
    $txt = @file_get_contents($arq);
    $d = $txt !== false ? json_decode($txt, true) : null;
    return is_array($d) ? $d : [];
}

function login_gravar(array $d): void
{
    $arq = login_arquivo_limite();
    $dir = dirname($arq);
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    $tmp = $arq . '.tmp' . getmypid();
    if (@file_put_contents($tmp, json_encode($d, JSON_PRETTY_PRINT), LOCK_EX) !== false) {
        @rename($tmp, $arq);
    } else {
        @unlink($tmp);
    }
}

/* Tira entradas velhas (sem bloqueio ativo e sem atividade há muito tempo). */
function login_podar(array $tudo): array
{
    $agora = time();
    $limite = max(LOGIN_JANELA_SEG, LOGIN_BLOQUEIO_SEG * 8);
    foreach ($tudo as $ip => $e) {
        $bloqueado = ($e['bloqueado_ate'] ?? 0) > $agora;
        $ativo = ($agora - ($e['visto'] ?? 0)) < $limite;
        if (!$bloqueado && !$ativo) {
            unset($tudo[$ip]);
        }
    }
    return $tudo;
}

/* Este IP pode tentar agora?  ['ok' => bool, 'espera' => segundos] */
function login_pode_tentar(string $ip): array
{
    $e = login_ler()[$ip] ?? null;
    $resta = (int) (($e['bloqueado_ate'] ?? 0) - time());
    return $resta > 0 ? ['ok' => false, 'espera' => $resta] : ['ok' => true, 'espera' => 0];
}

/* Registra UMA falha deste IP. Devolve os segundos de bloqueio se acabou de
   bloquear (0 se ainda não). */
function login_registrar_falha(string $ip): int
{
    $tudo = login_podar(login_ler());
    $agora = time();
    $e = $tudo[$ip] ?? ['falhas' => 0, 'visto' => 0, 'bloqueado_ate' => 0, 'nivel' => 0];

    // Passou da janela e não está bloqueado -> recomeça a contagem.
    if (($e['bloqueado_ate'] ?? 0) <= $agora && ($agora - ($e['visto'] ?? 0)) > LOGIN_JANELA_SEG) {
        $e['falhas'] = 0;
    }

    $e['falhas'] = (int) $e['falhas'] + 1;
    $e['visto'] = $agora;
    $bloqueio = 0;

    if ($e['falhas'] >= LOGIN_MAX_FALHAS) {
        $e['nivel'] = min((int) ($e['nivel'] ?? 0) + 1, 8);
        $bloqueio = LOGIN_BLOQUEIO_SEG * $e['nivel'];
        $e['bloqueado_ate'] = $agora + $bloqueio;
        $e['falhas'] = 0;
    }

    $tudo[$ip] = $e;
    login_gravar($tudo);
    return $bloqueio;
}

function login_registrar_sucesso(string $ip): void
{
    $tudo = login_podar(login_ler());
    unset($tudo[$ip]);
    login_gravar($tudo);
}
