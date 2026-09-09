<?php
declare(strict_types=1);
require __DIR__ . '/catalogo.php';
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https://images.unsplash.com; base-uri 'none'; form-action 'none'">
    <meta name="referrer" content="no-referrer">
    <title>Cardápio - Com Carinho</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        html { scroll-behavior: smooth; }
        body {
            background-color: #f6f4f2;
            color: #333;
            padding-bottom: 20px;
            -webkit-tap-highlight-color: transparent;
        }

        .fixed-top {
            position: sticky;
            top: 0;
            background-color: #ffffff;
            z-index: 100;
            box-shadow: 0 1px 0 rgba(0,0,0,0.05), 0 6px 18px rgba(0,0,0,0.05);
        }

        header {
            padding: 12px 14px 9px;
            text-align: center;
        }
        header .titulo {
            font-size: 21px;
            font-weight: 700;
            color: #8c2a2a;
            letter-spacing: 0.2px;
        }
        header .subtitulo {
            font-size: 14px;
            font-weight: 600;
            font-style: italic;
            color: #8c2a2a;
            letter-spacing: 0.3px;
            margin-top: 2px;
        }

        .categorias-bar {
            position: relative;
            display: flex;
            gap: 2px;
            overflow-x: auto;
            white-space: nowrap;
            background: #fff;
            border-top: 1px solid #f0ece9;
            padding: 3px 10px 0;
            -webkit-overflow-scrolling: touch;
            user-select: none;
            -webkit-user-select: none;
        }
        .categorias-bar::-webkit-scrollbar { display: none; }

        .cat-btn {
            background: none;
            border: none;
            padding: 10px 14px;
            font-size: 14px;
            font-weight: 500;
            color: #8a8a8a;
            cursor: pointer;
            border-bottom: 3px solid transparent;
            transition: color 0.25s ease;
            outline: none;
        }

        .cat-btn.active {
            color: #8c2a2a;
            font-weight: 700;
        }

        .cat-indicador {
            position: absolute;
            left: 0;
            bottom: 0;
            width: 0;
            height: 3px;
            border-radius: 3px;
            background-color: #8c2a2a;
            transform: translateX(0);
            transition: transform 0.08s linear, width 0.08s linear;
            pointer-events: none;
            will-change: transform, width;
        }

        .container { max-width: 560px; margin: 0 auto; padding: 10px 14px 0; }

        .categoria-secao { scroll-margin-top: var(--desloc, 112px); }

        .categoria-titulo {
            font-size: 17px;
            font-weight: 700;
            color: #2a2a2a;
            text-align: center;
            letter-spacing: 0.3px;
            margin: 26px 0 15px;
            padding-bottom: 9px;
            position: relative;
        }
        .categoria-titulo::after {
            content: "";
            position: absolute;
            left: 50%;
            bottom: 0;
            transform: translateX(-50%);
            width: 34px;
            height: 3px;
            border-radius: 3px;
            background-color: #8c2a2a;
        }
        .categoria-secao:first-child .categoria-titulo { margin-top: 6px; }

        .categoria-titulo.anima {
            opacity: 0;
            transform: translateY(8px);
            transition: opacity 0.4s ease, transform 0.4s ease;
        }
        .categoria-titulo.anima::after {
            transition: opacity 0.4s ease 0.08s, width 0.4s ease 0.08s;
            opacity: 0;
            width: 0;
        }
        .categoria-titulo.anima.visivel {
            opacity: 1;
            transform: translateY(0);
        }
        .categoria-titulo.anima.visivel::after {
            opacity: 1;
            width: 34px;
        }

        .item-card {
            background-color: #ffffff;
            border-radius: 14px;
            padding: 12px;
            margin-bottom: 10px;
            display: flex;
            gap: 12px;
            align-items: center;
            cursor: pointer;
            border: 1px solid #eee7e3;
            box-shadow: 0 1px 3px rgba(0,0,0,0.04);
            transition: transform 0.12s ease, box-shadow 0.12s ease;
        }
        .item-card:active {
            transform: scale(0.985);
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        .item-info { flex: 1; min-width: 0; }
        .item-titulo { font-size: 15px; font-weight: 700; color: #1f1f1f; margin-bottom: 3px; }
        .item-descricao {
            font-size: 12.5px;
            color: #8a8a8a;
            line-height: 1.35;
            margin-bottom: 8px;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
        .item-preco { font-size: 14px; font-weight: 700; color: #8c2a2a; }
        .item-imagem {
            width: 88px;
            height: 88px;
            border-radius: 12px;
            object-fit: cover;
            background-color: #eee;
            flex-shrink: 0;
        }

        .rodape-info {
            max-width: 560px;
            margin: 34px auto 0;
            padding: 18px 16px 4px;
            text-align: center;
            font-size: 12.5px;
            line-height: 1.6;
            color: #9a9a9a;
            border-top: 1px solid #ece7e3;
        }
        .rodape-info a { color: #8c2a2a; text-decoration: none; font-weight: 600; }
    </style>
</head>
<body>

    <div class="fixed-top">
        <header>
            <div class="titulo">Cardápio</div>
            <div class="subtitulo">Com Carinho</div>
        </header>
        <div class="categorias-bar" id="categoriasBar">
<?php foreach ($CATEGORIAS as $i => $cat): ?>
            <button type="button" class="cat-btn<?= $i === 0 ? ' active' : '' ?>" data-secao="<?= h($cat['id']) ?>">- <?= h($cat['nome']) ?></button>
<?php endforeach; ?>
        </div>
    </div>

    <main class="container" id="cardapio">
<?php foreach ($CATEGORIAS as $cat): ?>
        <section id="<?= h($cat['id']) ?>" class="categoria-secao">
            <div class="categoria-titulo"><?= h($cat['nome']) ?></div>
<?php
        foreach ($PRODUTOS as $produto):
            if ($produto['categoria'] !== $cat['id']) {
                continue;
            }
            $img = imagem_segura($produto['imagem'] ?? '');
?>
            <div class="item-card" data-id="<?= h($produto['id']) ?>">
                <div class="item-info">
                    <div class="item-titulo"><?= h($produto['nome']) ?></div>
                    <div class="item-descricao"><?= h($produto['descricao']) ?></div>
                    <div class="item-preco"><?= h(preco_resumo($produto)) ?></div>
                </div>
<?php if ($img !== ''): ?>
                <img class="item-imagem" src="<?= h($img) ?>" alt="<?= h($produto['nome']) ?>" loading="lazy">
<?php endif; ?>
            </div>
<?php endforeach; ?>
        </section>
<?php endforeach; ?>
    </main>

    <footer class="rodape-info">
        <div>Rua Dona Fiota, 233 &ndash; Santa Ruth, Itabira/MG</div>
        <div>Contato: <a href="tel:+553138354125">(31) 3835-4125</a></div>
    </footer>

    <script src="cardapio.js"></script>
</body>
</html>
