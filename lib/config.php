<?php
declare(strict_types=1);

/* =====================================================================
   Configuração central do projeto — o "arquivo de ambiente".

   Os valores REAIS ficam em  config/config.local.php  (fora da pasta
   pública e fora do Git). Se esse arquivo não existir, valem os padrões
   abaixo. Assim nada sensível/específico de ambiente fica espalhado no
   código.

   Modelo comentado:  config/config.exemplo.php
   ===================================================================== */

/* Lê uma chave da configuração. Ex.:  config('login_max_falhas', 5)  */
function config(string $chave, $padrao = null)
{
    static $cfg = null;

    if ($cfg === null) {
        // Padrões (usados quando config.local.php não existe ou não traz a chave).
        $cfg = [
            // Caminho do arquivo com o HASH da senha do painel.
            // null = usa a busca automática de senha_hash_painel().
            'senha_arquivo'      => null,

            // WhatsApp padrão (só um fallback, enquanto ninguém definiu no painel).
            'whatsapp_padrao'    => '553138354125',

            // Trava de login por IP.
            'login_max_falhas'   => 5,
            'login_janela_seg'   => 900,
            'login_bloqueio_seg' => 900,

            // Tamanho máximo do POST do painel, em bytes (trava fotos pesadas).
            'limite_bytes'       => 6 * 1024 * 1024,

            // Pedidos guardam dados de quem comprou (nome, telefone,
            // endereço) — por privacidade, isso fica completo no arquivo
            // "ao vivo" só por pouco tempo: hoje + ontem, o suficiente pro
            // painel diário e pra conferir problemas do dia anterior.
            'pedidos_retencao_completa_dias' => 2,

            // Depois disso, cada pedido vira um registro ANÔNIMO (data,
            // valor, produtos, modo de compra — sem dado nenhum do
            // comprador) guardado por até 3 meses, para uma futura tela de
            // histórico/relatório.
            'pedidos_retencao_dias' => 92, // ~3 meses

            // Trava anti-spam do pedido feito pelo cliente no site (público,
            // sem login): no máximo tantos pedidos por IP dentro da janela.
            'pedido_ip_max'         => 8,
            'pedido_ip_janela_seg'  => 600,

            // Cópias de segurança automáticas (dados/backups/). Catálogo:
            // não tem dado de comprador, guarda as últimas N cópias (1 por
            // "Salvar" do admin). Pedidos: TEM dado de comprador, então em
            // vez de "quantas guardar" é "por quantos dias" — expira
            // sozinho (padrão 2 dias: hoje + ontem).
            'backup_catalogo_manter'        => 30,
            'backup_pedidos_validade_dias'  => 2,
        ];

        foreach ([__DIR__ . '/../config/config.local.php', __DIR__ . '/config/config.local.php'] as $arq) {
            if (is_file($arq)) {
                $local = include $arq;
                if (is_array($local)) {
                    $cfg = array_merge($cfg, $local);
                }
                break;
            }
        }
    }

    return array_key_exists($chave, $cfg) ? $cfg[$chave] : $padrao;
}
