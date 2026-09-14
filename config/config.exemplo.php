<?php
/* MODELO — copie para  config/config.local.php  e ajuste o que quiser.

   config.local.php NÃO vai para o Git e fica fora da pasta pública. O código
   usa os padrões de lib/config.php quando alguma chave (ou o arquivo todo)
   não existe — então você só precisa colocar aqui o que for diferente.

   Não há credenciais de banco de dados: este projeto guarda tudo em
   dados/catalogo.dados.json. O único segredo é o hash da senha do painel,
   que continua em config/senha.local.php (aqui você só aponta o caminho).
*/

return [

    // Caminho do arquivo que devolve o HASH da senha do painel.
    // Deixe como está para usar config/senha.local.php ao lado deste arquivo.
    'senha_arquivo' => __DIR__ . '/senha.local.php',

    // WhatsApp que recebe os pedidos — só um fallback, enquanto ninguém
    // tiver salvo o número pelo painel. Somente dígitos (DDI + DDD + número).
    'whatsapp_padrao' => '553138354125',

    // Trava de tentativas de login por IP.
    'login_max_falhas'   => 5,    // erros seguidos antes de bloquear
    'login_janela_seg'   => 900,  // 15 min para acumular as falhas
    'login_bloqueio_seg' => 900,  // 15 min de bloqueio (dobra a cada reincidência)

    // Tamanho máximo do "Salvar" do painel, em bytes (trava fotos pesadas).
    'limite_bytes' => 6 * 1024 * 1024,

    // Pedidos guardam dados de quem comprou (nome, telefone, endereço) —
    // por privacidade, o arquivo "ao vivo" só mantém isso completo por
    // este tanto de dias (padrão: hoje + ontem). Depois vira um registro
    // ANÔNIMO (sem nenhum dado do comprador) na tela de histórico.
    'pedidos_retencao_completa_dias' => 2,

    // Quantos dias o registro ANÔNIMO (data, valor, produtos, modo de
    // compra — já sem dado de comprador) fica guardado, para uma futura
    // tela de histórico/relatório.
    'pedidos_retencao_dias' => 92, // ~3 meses

    // Trava anti-spam do pedido feito pelo cliente no site (endpoint
    // público, sem login): no máximo X pedidos por IP a cada Y segundos.
    'pedido_ip_max'        => 8,
    'pedido_ip_janela_seg' => 600,

    // Cópias de segurança automáticas, em dados/backups/ (protegida do
    // mesmo jeito que dados/). Catálogo: sem dado de comprador, guarda as
    // últimas N cópias (1 por "Salvar" do admin). Pedidos: TEM dado de
    // comprador, então não acumula por contagem — expira sozinho depois de
    // X dias (padrão 2: só serve pro vendedor conferir o dia anterior).
    'backup_catalogo_manter'       => 30,
    'backup_pedidos_validade_dias' => 2,
];
