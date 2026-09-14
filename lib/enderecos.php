<?php
declare(strict_types=1);

/* =====================================================================
   Cidades e bairros atendidos pela entrega — lista FIXA de referência
   geográfica, não é conteúdo do cardápio (por isso não fica em
   catalogo.dados.json nem é editável pelo painel). Serve tanto para
   montar os campos "Cidade"/"Bairro" no site (via catalogo.php, que
   injeta isto no mesmo CATALOGO que o nucleo.js já lê) quanto para
   validar no servidor o que o cliente escolheu (nunca confiar só no que
   o navegador mandou — mesma regra do resto do pedido).

   Fonte dos bairros de Itabira: guiamais.com.br/bairros/itabira-mg.
   ===================================================================== */

function cidades_atendidas(): array
{
    return ['Itabira'];
}

function bairros_de(string $cidade): array
{
    $mapa = [
        'Itabira' => [
            'Água Fresca', 'Alto Pereira', 'Amazonas', 'Areão', 'Bela Vista',
            'Campestre', 'Campestre I', 'Centro', 'Distrito Industrial',
            'Doze de Março', 'Eldorado', 'Fênix', 'Fevereiro', 'Gabiroba',
            'Gianetti', 'João XXIII', 'José Elói', 'Juca Rosa', 'Machado',
            'Major Lage', 'Major Lage (Baixo)', 'Major Lage (Cima)',
            'Major Lage de Cima', 'Novo Amazonas', 'Pará', 'Penha', 'Praia',
            'Quatorze de Fevereiro', 'Quatorze Fevereiro', 'Santa Ruth',
            'São Pedro', 'Vila Piedade', 'Vila Santa Rosa', 'Vila São Joaquim',
            'Zona Rural',
        ],
    ];
    return $mapa[$cidade] ?? [];
}

/* Todas as cidades -> bairros de uma vez, pronto pra mandar pro cliente. */
function bairros_por_cidade(): array
{
    $out = [];
    foreach (cidades_atendidas() as $c) {
        $out[$c] = bairros_de($c);
    }
    return $out;
}
