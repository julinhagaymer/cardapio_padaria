<?php
declare(strict_types=1);

/* =====================================================================
   Configuração de erros do PHP.

   Carregado ANTES de tudo pelos pontos de entrada (catalogo.php e
   api.php) e também pelo próprio dados.php.

   Regra: o usuário final NUNCA vê detalhe técnico de erro na tela.
   Tudo é registrado num arquivo de log privado, fora da pasta pública.
   ===================================================================== */

error_reporting(E_ALL);

ini_set('display_errors', '0');          // não imprime erro/aviso na resposta
ini_set('display_startup_errors', '0');
ini_set('log_errors', '1');              // registra em arquivo
ini_set('ignore_repeated_errors', '1');  // não repete a mesma linha em sequência

/* O log fica em dados/ — pasta fora de public/, negada por .htaccess e sem
   rota web. Nome com data ajuda a achar o que é recente. */
$dirLog = __DIR__ . '/../dados';
if (!is_dir($dirLog)) {
    @mkdir($dirLog, 0775, true);
}
ini_set('error_log', $dirLog . '/php-erros.log');

/* Configuração central (config()). Depois do log: se config.local.php tiver
   erro de sintaxe, ele vai para o log em vez da tela. */
require_once __DIR__ . '/config.php';
