# Docão Kart

Corrida arcade de kart no navegador. O Docão, porquinho mascote, encara a pista da feira da fazenda contra o Milho, a Hortelã e a Jabuticaba.

A pista, os karts e os porquinhos são feitos no código. O repositório fica leve, sem modelos pesados.

## Como rodar

```bash
npm i
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173).

Para gerar a versão de produção e abrir ela localmente:

```bash
npm run build
npm run preview
```

O preview sobe em [http://localhost:4173](http://localhost:4173).

## Como jogar

No menu, escolha o visual do Docão e **Jogar** começa a corrida de 3 voltas. A escolha fica salva neste navegador. O focinho, as orelhas e os olhos não mudam: só a roupa. Os outros pilotos usam visuais diferentes.

- **W** ou **↑** acelera
- **S** ou **↓** freia e, segurando, dá ré
- **A D** ou **← →** viram
- **Espaço** derrapa. Segure numa curva e solte para ganhar um impulso
- **E** usa o item que você está carregando
- **Esc** pausa

Copos girando na pista sorteiam um item. O placar gira entre os nomes e só então o item pode ser usado. Cada piloto segura um por vez. No celular, o botão **Item** mostra o sorteio e faz o mesmo que a tecla **E**.

- **Pamonha** — arrancada curta
- **Casca** — fica no chão, atrás de quem soltou. Quem passa por cima escorrega e perde velocidade
- **Tomate** — sai para a frente e empurra o kart que acertar

O placar mostra a posição, a volta, o tempo, o item na mão e o minimapa. No celular a tela acompanha a janela, e botões de toque aparecem embaixo.

## Publicar na Vercel

O jogo é um site estático feito com Vite. Dá para conectar este repositório na Vercel com o build padrão:

- Framework: Vite
- Comando de build: `npm run build`
- Pasta de saída: `dist`

Não precisa de servidor nem de variáveis de ambiente.
