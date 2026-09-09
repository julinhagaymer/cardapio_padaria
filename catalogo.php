<?php
declare(strict_types=1);

/* Fonte única de verdade do cardápio.
   As páginas recebem só o "id" do produto pela URL e buscam o resto aqui,
   então preço, nome e descrição não podem ser adulterados por um link. */

const WHATSAPP = '553138354125';
const LIMITE_OBSERVACAO = 500;

$CATEGORIAS = [
    ['id' => 'paes',     'nome' => 'Pães'],
    ['id' => 'salgados', 'nome' => 'Salgados'],
    ['id' => 'tortas',   'nome' => 'Tortas'],
    ['id' => 'pizzas',   'nome' => 'Pizzas'],
    ['id' => 'assados',  'nome' => 'Serviço de Assados'],
];

$PRODUTOS = [
    [
        'id' => 'pao-frances', 'categoria' => 'paes', 'tipo' => 'simples',
        'nome' => 'Pão Francês (kg)',
        'descricao' => 'Pãozinho tradicional quentinho e crocante.',
        'preco' => 18.90,
        'imagem' => 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600',
    ],
    [
        'id' => 'pao-de-queijo', 'categoria' => 'paes', 'tipo' => 'simples',
        'nome' => 'Pão de Queijo',
        'descricao' => 'Feito com queijo canastra legítimo.',
        'preco' => 4.50,
        'imagem' => 'https://images.unsplash.com/photo-1598373182133-52452f7691ef?w=600',
    ],
    [
        'id' => 'pao-integral', 'categoria' => 'paes', 'tipo' => 'simples',
        'nome' => 'Pão Integral (kg)',
        'descricao' => 'Massa com farinha integral e mix de grãos, mais leve.',
        'preco' => 22.90,
        'imagem' => 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600',
    ],
    [
        'id' => 'pao-de-forma', 'categoria' => 'paes', 'tipo' => 'simples',
        'nome' => 'Pão de Forma Caseiro',
        'descricao' => 'Fatiado, bem macio e sem conservantes.',
        'preco' => 16.00,
        'imagem' => 'https://images.unsplash.com/photo-1598373182133-52452f7691ef?w=600',
    ],
    [
        'id' => 'broa-de-fuba', 'categoria' => 'paes', 'tipo' => 'simples',
        'nome' => 'Broa de Fubá',
        'descricao' => 'Fofinha, com erva-doce, receita mineira.',
        'preco' => 14.50,
        'imagem' => 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600',
    ],
    [
        'id' => 'pao-doce', 'categoria' => 'paes', 'tipo' => 'simples',
        'nome' => 'Pão Doce Trançado',
        'descricao' => 'Massa fofa levemente adocicada com açúcar cristal por cima.',
        'preco' => 12.00,
        'imagem' => 'https://images.unsplash.com/photo-1598373182133-52452f7691ef?w=600',
    ],
    [
        'id' => 'baguete', 'categoria' => 'paes', 'tipo' => 'simples',
        'nome' => 'Baguete Francesa',
        'descricao' => 'Casca crocante e miolo aerado, assada no dia.',
        'preco' => 9.90,
        'imagem' => 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600',
    ],
    [
        'id' => 'coxinha-frango', 'categoria' => 'salgados', 'tipo' => 'simples',
        'nome' => 'Coxinha de Frango',
        'descricao' => 'Com catupiry original e massa de batata.',
        'preco' => 8.50,
        'imagem' => 'https://images.unsplash.com/photo-1626844131082-256783844137?w=600',
    ],
    [
        'id' => 'empada-frango', 'categoria' => 'salgados', 'tipo' => 'simples',
        'nome' => 'Empada de Frango',
        'descricao' => 'Massa amanteigada que desmancha na boca.',
        'preco' => 7.50,
        'imagem' => 'https://images.unsplash.com/photo-1626844131082-256783844137?w=600',
    ],
    [
        'id' => 'pastel-carne', 'categoria' => 'salgados', 'tipo' => 'simples',
        'nome' => 'Pastel de Carne',
        'descricao' => 'Frito na hora, recheio suculento e temperado.',
        'preco' => 8.00,
        'imagem' => 'https://images.unsplash.com/photo-1626844131082-256783844137?w=600',
    ],
    [
        'id' => 'enroladinho-salsicha', 'categoria' => 'salgados', 'tipo' => 'simples',
        'nome' => 'Enroladinho de Salsicha',
        'descricao' => 'Massa de pão macia com salsicha e queijo.',
        'preco' => 6.50,
        'imagem' => 'https://images.unsplash.com/photo-1626844131082-256783844137?w=600',
    ],
    [
        'id' => 'kibe', 'categoria' => 'salgados', 'tipo' => 'simples',
        'nome' => 'Kibe',
        'descricao' => 'Trigo com carne e hortelã, bem temperado.',
        'preco' => 7.00,
        'imagem' => 'https://images.unsplash.com/photo-1626844131082-256783844137?w=600',
    ],
    [
        'id' => 'torta-frango', 'categoria' => 'tortas', 'tipo' => 'simples',
        'nome' => 'Fatia Torta de Frango',
        'descricao' => 'Recheio cremoso e bem temperado.',
        'preco' => 12.00,
        'imagem' => 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600',
    ],
    [
        'id' => 'torta-palmito', 'categoria' => 'tortas', 'tipo' => 'simples',
        'nome' => 'Fatia Torta de Palmito',
        'descricao' => 'Recheio cremoso de palmito com azeitona.',
        'preco' => 12.00,
        'imagem' => 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600',
    ],
    [
        'id' => 'torta-limao', 'categoria' => 'tortas', 'tipo' => 'simples',
        'nome' => 'Fatia Torta de Limão',
        'descricao' => 'Base crocante, creme de limão e merengue maçaricado.',
        'preco' => 13.00,
        'imagem' => 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600',
    ],
    [
        'id' => 'torta-morango', 'categoria' => 'tortas', 'tipo' => 'simples',
        'nome' => 'Fatia Torta de Morango',
        'descricao' => 'Chantilly, morangos frescos e massa amanteigada.',
        'preco' => 15.00,
        'imagem' => 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600',
    ],
    [
        'id' => 'torta-chocolate', 'categoria' => 'tortas', 'tipo' => 'simples',
        'nome' => 'Fatia Torta de Chocolate',
        'descricao' => 'Camadas de brigadeiro cremoso e ganache meio amargo.',
        'preco' => 14.00,
        'imagem' => 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600',
    ],
    [
        'id' => 'pizza-portuguesa', 'categoria' => 'pizzas', 'tipo' => 'pizza',
        'nome' => 'Portuguesa',
        'descricao' => 'Mussarela, presunto, calabresa, molho de tomate, ovo, bacon, azeitona, cebola, pimentão, tomate, palmito e orégano.',
        'imagem' => 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600',
    ],
    [
        'id' => 'pizza-presunto-mussarela', 'categoria' => 'pizzas', 'tipo' => 'pizza',
        'nome' => 'Presunto e Mussarela',
        'descricao' => 'Mussarela, molho de tomate, presunto, cebola, pimentão, azeitona, tomate e orégano.',
        'imagem' => 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600',
    ],
    [
        'id' => 'pizza-frango-catupiry', 'categoria' => 'pizzas', 'tipo' => 'pizza',
        'nome' => 'Frango Catupiry',
        'descricao' => 'Mussarela, molho de tomate, peito de frango desfiado, catupiry, azeitona, cebola, pimentão, tomate e orégano.',
        'imagem' => 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600',
    ],
    [
        'id' => 'pizza-calabresa', 'categoria' => 'pizzas', 'tipo' => 'pizza',
        'nome' => 'Calabresa',
        'descricao' => 'Mussarela, molho de tomate, calabresa, azeitona, cebola, pimentão, tomate e orégano.',
        'imagem' => 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=600',
    ],
    [
        'id' => 'pizza-frango-bacon', 'categoria' => 'pizzas', 'tipo' => 'pizza',
        'nome' => 'Frango com Bacon',
        'descricao' => 'Mussarela, molho de tomate, bacon, tomate, azeitona, cebola, pimentão e orégano.',
        'imagem' => 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=600',
    ],
    [
        'id' => 'assado-lombo', 'categoria' => 'assados', 'tipo' => 'simples',
        'nome' => 'Lombo',
        'descricao' => 'Serviço de assar (a carne é por conta do cliente).',
        'preco' => 50,
        'imagem' => 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600',
    ],
    [
        'id' => 'assado-pernil', 'categoria' => 'assados', 'tipo' => 'simples',
        'nome' => 'Pernil',
        'descricao' => 'Serviço de assar (a carne é por conta do cliente).',
        'preco' => 130,
        'imagem' => 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=600',
    ],
    [
        'id' => 'assado-chester', 'categoria' => 'assados', 'tipo' => 'simples',
        'nome' => 'Chester',
        'descricao' => 'Serviço de assar (a carne é por conta do cliente).',
        'preco' => 50,
        'imagem' => 'https://images.unsplash.com/photo-1574672280600-4accfa5b6f98?w=600',
    ],
    [
        'id' => 'assado-peru', 'categoria' => 'assados', 'tipo' => 'simples',
        'nome' => 'Peru',
        'descricao' => 'Serviço de assar (a carne é por conta do cliente).',
        'preco' => 50,
        'imagem' => 'https://images.unsplash.com/photo-1574672280600-4accfa5b6f98?w=600',
    ],
    [
        'id' => 'assado-leitoa', 'categoria' => 'assados', 'tipo' => 'simples',
        'nome' => 'Leitoa',
        'descricao' => 'Serviço de assar (a carne é por conta do cliente).',
        'preco' => 150,
        'imagem' => 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600',
    ],
];

$TAMANHOS = [
    ['rotulo' => '25 cm — 4 pedaços', 'preco' => 49.90],
    ['rotulo' => '30 cm — 8 pedaços', 'preco' => 59.90],
];

$BORDAS = [
    ['rotulo' => 'Sem borda', 'preco' => 0],
    ['rotulo' => 'Com borda', 'preco' => 10],
];

$ADICIONAIS = [
    ['rotulo' => 'Catupiry', 'preco' => 8],
    ['rotulo' => 'Cheddar', 'preco' => 8],
    ['rotulo' => 'Bacon', 'preco' => 7],
    ['rotulo' => 'Palmito', 'preco' => 10],
];

$DOMINIOS_IMAGEM = ['images.unsplash.com'];

/** Escapa texto para uso seguro em HTML. */
function h($valor): string
{
    return htmlspecialchars((string) $valor, ENT_QUOTES, 'UTF-8');
}

/** "R$ 1234,50" — mesmo formato do site original (sem separador de milhar). */
function formatar_moeda($valor): string
{
    return 'R$ ' . number_format((float) $valor, 2, ',', '');
}

/** Só aceita imagem https de um domínio conhecido; senão devolve "". */
function imagem_segura($url): string
{
    global $DOMINIOS_IMAGEM;
    if (!is_string($url) || $url === '') {
        return '';
    }
    $partes = parse_url($url);
    if (!$partes || ($partes['scheme'] ?? '') !== 'https') {
        return '';
    }
    if (!in_array($partes['host'] ?? '', $DOMINIOS_IMAGEM, true)) {
        return '';
    }
    return $url;
}

/** Busca um produto pelo id. */
function buscar_produto($id): ?array
{
    global $PRODUTOS;
    foreach ($PRODUTOS as $produto) {
        if ($produto['id'] === $id) {
            return $produto;
        }
    }
    return null;
}

/** Texto de preço mostrado no card da lista. */
function preco_resumo(array $produto): string
{
    global $TAMANHOS;
    if (($produto['tipo'] ?? '') === 'pizza') {
        $menor = null;
        foreach ($TAMANHOS as $t) {
            if ($menor === null || $t['preco'] < $menor) {
                $menor = $t['preco'];
            }
        }
        return 'A partir de ' . formatar_moeda($menor);
    }
    return formatar_moeda($produto['preco']);
}
