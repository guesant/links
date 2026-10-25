# Links

Meu site pessoal, feito com [Hugo](https://gohugo.io/) e publicado em [guesant.net](https://guesant.net/).

## Desenvolvimento

Requer [Docker](https://docs.docker.com/get-started/get-docker/) e [just](https://just.systems/man/en/). Também pode ser aberto em um [Dev Container](https://containers.dev/).

```sh
just dev
just check
just build
```

`just dev` abre o servidor em [localhost:4173](http://localhost:4173/). `just build` gera `public/`. Use `just` para listar os comandos.

O desenvolvimento e o CI usam o mesmo [Dockerfile](.config/container/Dockerfile). Nenhuma ferramenta de build precisa ser instalada na máquina.

## Arquivos

- [Conteúdo](src/data/links.yaml)
- [Estatísticas](src/data/statistics.yaml)
- [Templates e assets](src/)
- [Configuração](.config/)
- [Publicação](.github/workflows/pages.yml)
- [Créditos e licenças](src/data/credits.yaml)

O GitHub Pages usa GitHub Actions como origem. A coleta de estatísticas roda separadamente; uma falha mantém os últimos dados válidos.

[Licença MIT](LICENSE)
