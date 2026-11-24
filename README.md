# Clara Nobre

Blog pessoal em português, baseado no BentASCII. Usa Astro para gerar as páginas estáticas e Three.js para renderizar a flor da página inicial em ASCII.

## Rodar localmente

Use a versão do Node indicada em `.nvmrc`.

```sh
npm ci
npm run dev
```

`npm run check` verifica os tipos. `npm run build` gera o site estático em `dist/`.

Os textos em `src/content/blog/` são arquivos Markdown ou MDX. O nome, a descrição e o idioma estão em `src/site.config.ts`. `.env.example` reúne as variáveis de domínio e de subdiretório.

## Fundos ASCII

Os cabeçalhos de artigos, o destaque da home e as imagens de compartilhamento usam a mesma arte para um mesmo título.

- Cada composição tem de uma a três formas entre a flor inteira de cerejeira e a pétala solta. Quando há três, os dois tipos aparecem.
- O título determina a composição, o tom rosa ou roxo e as variações de posição, tamanho, rotação e preenchimento.
- A cobertura das formas vira caracteres em uma grade de 60 colunas por 18 linhas. O fundo fica à direita e perde intensidade perto do texto e em telas estreitas.
- Cada artigo publicado tem um PNG de 1200 × 630 em `/og/<id-do-artigo>.png`. Configure `SITE_URL` para que os metadados de compartilhamento apontem para o domínio publicado.

## Créditos

- A marca original do blog está em [cerejeira.svg](public/cerejeira.svg).
- O modelo [Flower Petal, de Quaternius](https://poly.pizza/m/tzG4JcqYWs), é disponibilizado sob [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). O GLB local conserva a malha, com material rosa e sem a textura do arquivo original. A flor de cerejeira principal é gerada por código.
- O BentASCII e seu aviso de licença MIT estão registrados em [LICENSE](LICENSE).
