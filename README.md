# Lobby

Meu site pessoal, feito com [Hugo](https://gohugo.io/) e publicado em [guesant.net](https://guesant.net/).

## Desenvolvimento

Requer [Docker](https://docs.docker.com/get-started/get-docker/) e [just](https://just.systems/man/en/). Também pode ser aberto em um [Dev Container](https://containers.dev/).

```sh
just dev
just check
just build
```

`just dev` abre o servidor em [localhost:4173](http://localhost:4173/). `just build` gera `.local/build/site/`. Use `just` para listar os comandos.

O desenvolvimento e o CI usam o mesmo [Dockerfile](.config/container/Dockerfile). Nenhuma ferramenta de build precisa ser instalada na máquina.

## Arquivos

- [Conteúdo](src/data/links.yaml)
- [Estatísticas](src/data/statistics.yaml)
- [Templates e assets](src/)
- [Configuração](.config/)
- [Publicação](.github/workflows/pages.yml)
- [Créditos e licenças](src/data/credits.yaml)

O site é publicado no GitHub Pages. As estatísticas só são substituídas quando a atualização dá certo.

O gate de acessibilidade mantém WCAG 2 AA e limiar zero para erros confirmados. Resultados que o axe classifica como inconclusivos sobre imagens ficam como avisos de revisão. O teste de layout calcula separadamente o contraste dos textos sobre todos os pixels das texturas e exige ao menos 4,5:1, sem desativar as regras de contraste.

[Licença MIT](LICENSE)
