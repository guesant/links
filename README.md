# Lobby

Meu site pessoal, feito com [SvelteKit](https://kit.svelte.dev/) e publicado em [guesant.net](https://guesant.net/).

## Desenvolvimento

Requer [Docker](https://docs.docker.com/get-started/get-docker/) e [just](https://just.systems/man/en/). Também pode ser aberto em um [Dev Container](https://containers.dev/). Dependências e comandos do projeto rodam no container, sem instalar Node, SvelteKit ou ferramentas de qualidade na máquina.

```sh
just dev
just lint
just typecheck
just check
just build
```

`just dev` abre o servidor em [localhost:4173](http://localhost:4173/). `just build` pré-renderiza as páginas em `.local/build/site/`. `just check` inclui os linters, checagem Svelte, testes e validações do site. Use `just` para listar os comandos.

O desenvolvimento e o CI usam o mesmo [Dockerfile](.config/container/Dockerfile). A saída estática inclui navegação client-side e cada rota também funciona aberta diretamente no GitHub Pages.

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
