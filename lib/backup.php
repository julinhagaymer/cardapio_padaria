<?php
declare(strict_types=1);

/* =====================================================================
   Cópias de segurança automáticas dos arquivos de dados (catálogo e
   pedidos), guardadas em dados/backups/ — fora da pasta pública, com a
   mesma proteção de dados/ (.htaccess nega tudo pela web).

   O objetivo é simples: se o arquivo principal sumir ou for sobrescrito
   por engano (upload errado, edição direta no servidor, falha de disco...),
   sempre existe uma cópia recente para restaurar — em vez de perder tudo e
   voltar ao catálogo de fábrica. Restaurar é feito por
   ferramentas/restaurar-backup.php.
   ===================================================================== */

const DIR_BACKUPS = __DIR__ . '/../dados/backups';

/* Copia $arquivo para dados/backups/<subpasta>/<nome>-AAAAMMDD-HHMMSS.json
   e apaga as cópias mais antigas, mantendo só as últimas $manter. Falha
   silenciosamente (backup nunca pode derrubar um "Salvar" de verdade). */
function backup_criar(string $arquivo, string $subpasta, int $manter): void
{
    if (!is_file($arquivo) || $manter <= 0) {
        return;
    }

    $dir = DIR_BACKUPS . '/' . $subpasta;
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        return;
    }

    $nome = pathinfo($arquivo, PATHINFO_FILENAME);
    $destino = $dir . '/' . $nome . '-' . date('Ymd-His') . '.json';
    @copy($arquivo, $destino);

    backup_podar($dir, $manter);
}

/* Mantém só os $manter arquivos mais recentes de uma pasta de backup. */
function backup_podar(string $dir, int $manter): void
{
    $arquivos = glob($dir . '/*.json');
    if (!is_array($arquivos) || count($arquivos) <= $manter) {
        return;
    }
    sort($arquivos); // o nome já começa com AAAAMMDD-HHMMSS: ordem alfabética = ordem cronológica
    $excedente = count($arquivos) - $manter;
    for ($i = 0; $i < $excedente; $i++) {
        @unlink($arquivos[$i]);
    }
}

/* Apaga, de uma pasta de backup, os arquivos com mais de $dias — usado
   quando o que importa é HÁ QUANTO TEMPO a cópia existe (dados sensíveis
   que não podem se acumular), e não quantas cópias existem. */
function backup_expirar_por_idade(string $dir, int $dias): void
{
    if ($dias <= 0 || !is_dir($dir)) {
        return;
    }
    $limite = time() - $dias * 86400;
    $arquivos = glob($dir . '/*.json');
    if (!is_array($arquivos)) {
        return;
    }
    foreach ($arquivos as $arq) {
        if ((int) @filemtime($arq) < $limite) {
            @unlink($arq);
        }
    }
}

/* Backup do catálogo: uma cópia a cada "Salvar" do admin (são raros e cada
   edição importa, e não tem dado de comprador nenhum), guardando as
   últimas N. */
function backup_catalogo(string $arquivo): void
{
    backup_criar($arquivo, 'catalogo', (int) config('backup_catalogo_manter', 30));
}

/* Backup dos pedidos: guarda no máximo 1 cópia por dia (o arquivo muda o
   tempo todo — copiar a cada escrita geraria arquivos demais). Diferente
   do catálogo, este arquivo tem dados de quem comprou (nome, telefone,
   endereço), então a cópia não pode se acumular por muito tempo: existe só
   como uma rede de segurança de curtíssimo prazo (o vendedor conferir se
   ontem deu algum problema) e expira sozinha por IDADE, não por contagem —
   ver backup_pedidos_validade_dias (padrão 2 dias: cobre "hoje" e "ontem",
   ou seja, até ~24h depois de o painel reiniciar a contagem do dia). */
function backup_pedidos(string $arquivo): void
{
    if (!is_file($arquivo)) {
        return;
    }
    $dir = DIR_BACKUPS . '/pedidos';
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        return;
    }

    $hoje = date('Ymd');
    $jaTemHoje = glob($dir . '/pedidos-' . $hoje . '-*.json');
    if (!(is_array($jaTemHoje) && $jaTemHoje)) {
        $nome = pathinfo($arquivo, PATHINFO_FILENAME);
        @copy($arquivo, $dir . '/' . $nome . '-' . date('Ymd-His') . '.json');
    }

    backup_expirar_por_idade($dir, (int) config('backup_pedidos_validade_dias', 2));
}
