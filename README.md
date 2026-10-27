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

## Idiomas

Nos acessos sem prefixo, o site consulta as preferências de idioma do navegador e usa português quando nenhuma delas estiver disponível. Na primeira visita, um endereço com prefixo explícito conserva seu idioma. A escolha feita no menu é salva neste navegador e passa a prevalecer nas próximas aberturas, inclusive quando o endereço aponta para outro idioma.

Os redirecionamentos preservam a página equivalente, os parâmetros e as âncoras. Quando não há tradução, a detecção automática mantém o conteúdo atual. Se o navegador bloquear o armazenamento, a escolha manual permanece explícita no parâmetro `lang`. As rotas estáticas existentes continuam disponíveis sem JavaScript.

## Arquivos

- [Conteúdo](src/data/links.yaml)
- [Estatísticas](src/data/statistics.yaml)
- [Templates e assets](src/)
- [Configuração](.config/)
- [Publicação](.github/workflows/pages.yml)
- [Créditos e licenças](src/data/credits.yaml)

O site é publicado no GitHub Pages. As estatísticas só são substituídas quando a atualização dá certo.

[Licença MIT](LICENSE)
