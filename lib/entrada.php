<?php
declare(strict_types=1);

/* =====================================================================
   Leitura segura de entrada (GET / POST / corpo JSON já decodificado).

   Nada é usado "cru". Cada função recebe uma FONTE (um array como
   $_GET, $_POST ou o JSON decodificado) e uma CHAVE, limpa o valor e o
   valida no formato esperado. Se não bater, devolve o $padrao.

   Exemplos:
       $email = ler_email($_POST, 'email');            // '' se não for e-mail
       $qtd   = ler_inteiro($_POST, 'qtd', 1, 99, 1);  // inteiro entre 1 e 99
       $preco = ler_numero($_POST, 'preco', 0);        // número >= 0
       $tel   = ler_digitos($_POST, 'telefone', 15);   // só dígitos
       $acao  = ler_opcao($_GET, 'acao', ['ver','salvar'], 'ver');
   ===================================================================== */

/* Valor bruto de uma fonte pela chave (null se não existir). */
function entrada_bruto($fonte, string $chave)
{
    return (is_array($fonte) && array_key_exists($chave, $fonte)) ? $fonte[$chave] : null;
}

/* Corta a string em no máx. $max BYTES sem partir um caractere UTF-8. */
function cortar_utf8(string $s, int $max): string
{
    if ($max <= 0) {
        return '';
    }
    if (strlen($s) <= $max) {
        return $s;
    }
    $s = substr($s, 0, $max);
    // remove bytes de continuação (10xxxxxx) presos no fim
    while ($s !== '' && (ord($s[strlen($s) - 1]) & 0xC0) === 0x80) {
        $s = substr($s, 0, -1);
    }
    // se o último byte inicia uma sequência multibyte incompleta, tira-o
    if ($s !== '' && ord($s[strlen($s) - 1]) >= 0xC0) {
        $s = substr($s, 0, -1);
    }
    return $s;
}

/* Tira byte nulo e caracteres de controle (mantém \t \n \r), apara pontas
   e limita o tamanho. Não mexe no conteúdo legítimo do texto. */
function limpar_texto($valor, int $max = 2000): string
{
    if (is_array($valor) || is_object($valor) || is_bool($valor) || $valor === null) {
        return '';
    }
    $s = (string) $valor;
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $s) ?? '';
    $s = trim($s);
    return cortar_utf8($s, $max);
}

/* Texto de uma fonte. */
function ler_texto($fonte, string $chave, int $max = 2000, string $padrao = ''): string
{
    $v = entrada_bruto($fonte, $chave);
    if ($v === null) {
        return $padrao;
    }
    $limpo = limpar_texto($v, $max);
    return $limpo === '' ? $padrao : $limpo;
}

/* Só um dos valores permitidos (lista branca). */
function ler_opcao($fonte, string $chave, array $permitidas, string $padrao = ''): string
{
    $v = limpar_texto(entrada_bruto($fonte, $chave), 100);
    return in_array($v, $permitidas, true) ? $v : $padrao;
}

/* E-mail válido (validação do próprio PHP) em minúsculas. '' se inválido. */
function ler_email($fonte, string $chave, string $padrao = ''): string
{
    $v = strtolower(limpar_texto(entrada_bruto($fonte, $chave), 254));
    $ok = filter_var($v, FILTER_VALIDATE_EMAIL);
    return is_string($ok) ? $ok : $padrao;
}

/* Inteiro. Aceita int/float inteiro/string "12"; rejeita "12x", "1.5", "". */
function ler_inteiro($fonte, string $chave, ?int $min = null, ?int $max = null, int $padrao = 0): int
{
    $v = entrada_bruto($fonte, $chave);

    if (is_int($v)) {
        $n = $v;
    } elseif (is_float($v) && is_finite($v) && floor($v) === $v) {
        $n = (int) $v;
    } else {
        $n = filter_var(is_string($v) ? trim($v) : $v, FILTER_VALIDATE_INT);
        if ($n === false || $n === null) {
            return $padrao;
        }
    }
    if ($min !== null && $n < $min) {
        $n = $min;
    }
    if ($max !== null && $n > $max) {
        $n = $max;
    }
    return $n;
}

/* Número decimal (aceita vírgula ou ponto). Arredonda a 2 casas. */
function ler_numero($fonte, string $chave, float $min = 0.0, ?float $max = null, float $padrao = 0.0): float
{
    $v = entrada_bruto($fonte, $chave);

    if (is_int($v) || is_float($v)) {
        $n = (float) $v;
    } elseif (is_string($v)) {
        $n = filter_var(str_replace(',', '.', trim($v)), FILTER_VALIDATE_FLOAT);
    } else {
        return $padrao;
    }
    if ($n === false || $n === null || !is_finite($n)) {
        return $padrao;
    }
    if ($n < $min) {
        $n = $min;
    }
    if ($max !== null && $n > $max) {
        $n = $max;
    }
    return round($n, 2);
}

/* Só os dígitos do valor (telefone, WhatsApp, CEP...). */
function ler_digitos($fonte, string $chave, int $max = 20, string $padrao = ''): string
{
    $v = entrada_bruto($fonte, $chave);
    $base = (is_string($v) || is_int($v)) ? (string) $v : '';
    $s = preg_replace('/\D+/', '', $base) ?? '';
    return $s === '' ? $padrao : substr($s, 0, $max);
}

/* Booleano tolerante: "1"/"true"/"on"/"sim" => true. */
function ler_booleano($fonte, string $chave, bool $padrao = false): bool
{
    $v = entrada_bruto($fonte, $chave);
    if ($v === null) {
        return $padrao;
    }
    if (is_bool($v)) {
        return $v;
    }
    $s = strtolower(trim((string) $v));
    if (in_array($s, ['1', 'true', 'on', 'sim', 'yes'], true)) {
        return true;
    }
    if (in_array($s, ['0', 'false', 'off', 'nao', 'não', 'no', ''], true)) {
        return false;
    }
    return $padrao;
}

/* A chave existe na fonte? (para flags do tipo ?json). */
function entrada_tem($fonte, string $chave): bool
{
    return is_array($fonte) && array_key_exists($chave, $fonte);
}

/* -----------------------------------------------------------------
   SAÍDA: proteção contra XSS.

   Use esc() SEMPRE que for imprimir um valor (que veio do formulário,
   do JSON do cardápio ou de qualquer lugar) dentro de HTML gerado por
   PHP. Ex.:   <h1><?= esc($produto['nome']) ?></h1>

   ENT_QUOTES escapa aspas simples e duplas; ENT_SUBSTITUTE troca bytes
   UTF-8 inválidos por U+FFFD em vez de devolver string vazia.
   ----------------------------------------------------------------- */
function esc($valor): string
{
    return htmlspecialchars((string) $valor, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/* Igual a esc(), mas para valores dentro de atributo entre aspas duplas
   (mesmo resultado; nome separado deixa a intenção clara no template). */
function esc_attr($valor): string
{
    return htmlspecialchars((string) $valor, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
