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

## Visualização

O seletor de visualização alterna as listagens da Home e das seções entre compacto e detalhado. A preferência é compartilhada entre páginas e idiomas e salva neste navegador. Sem escolha anterior ou sem JavaScript, as listas usam o modo compacto. Os detalhes permanecem disponíveis ao ativar o modo detalhado, sem alterar os destinos dos links.

Os dois modos usam controles de ícone alinhados à direita. GitHub, Créditos e Configurações formam um grupo centralizado no footer. Os controles mantêm nomes acessíveis, foco visível e dicas ao passar o ponteiro ou usar o teclado; Escape dispensa as dicas. Commit e workflow aparecem como links textuais em um parágrafo separado e centralizado, com os dados reais da publicação.

Uma faixa única reúne Início, os atalhos e o seletor de seções, separados por divisórias de madeira. Em telas menores, os atalhos ocupam as linhas inferiores sem esconder destinos. O menu apresenta todos os destinos e separa Agora das categorias temáticas. A mesma navegação aparece como links textuais no footer de todas as páginas. Os links e a abertura do menu funcionam sem JavaScript; com JavaScript, Escape, clique externo e saída do foco também fecham a lista, que ajusta sua altura ao espaço disponível.

## Conteúdo Federado

Blog e Resume continuam sendo as fontes editoriais de escrita, cases, projetos, carreira e skills. Seus builds publicam `lobby.json`, com contrato de versão 1 e campos públicos explícitos. O Lobby importa esses índices antes do build e mantém a última cópia válida em `.cache/federation/`. Não extrai HTML nem consulta os sites de origem durante a visita. Os resultados levam ao texto completo na origem.

Falhas de rede usam cache válido com aviso; ausência de cache interrompe o build. Respostas com contrato inválido também interrompem o build. Uma origem sem publicações pode fornecer uma lista vazia. Atualizações entram no próximo build, sem sincronização agendada.

Antes de publicar os índices nas origens, gere os sites de Blog e Resume e use arquivos locais. No container do Lobby, os diretórios irmãos são montados como `/sources/blog` e `/sources/resume`:

```sh
LOBBY_BLOG_FEED=/sources/blog/lobby.json LOBBY_RESUME_FEED=/sources/resume/lobby.json just build
```

As mesmas variáveis funcionam com `just dev`. Quando os índices estiverem publicados, omita as variáveis para usar as URLs em `.config/federation.yaml`. Nenhum índice importado deve ser editado para corrigir conteúdo; altere o repositório de origem.

## Conteúdo Pessoal

`src/data/editorial.yaml` contém os rótulos dos seis idiomas, as listas de Interesses, Uses, Biblioteca e Curiosidades e Coleções e os campos opcionais de Agora. Cada item usa `id` estável e `labels` por idioma com `title` e `description`; pode ter `url`, `tags`, `group`, `status` e `updated`. Sem URL, o item é informativo, não um botão. `public: false`, `enabled: false`, `private: true` ou `draft: true` excluem o item das páginas e da busca. Itens sem tradução usam o conteúdo disponível com indicação de idioma.

As listas começam vazias, sem fatos ou equipamentos inventados. O estado vazio mantém acesso a links relacionados. Em Agora, `working`, `building`, `studying`, `reading`, `listening` e `watching` são opcionais; `updated` deve ser uma data editorial real, não a data do build. As quatro partes e âncoras anteriores permanecem disponíveis. O futuro Atlas ainda não participa da integração.

## Busca e Interfaces

A busca, acessível pelo footer ou Ctrl/Cmd+K, usa um índice estático local por idioma. Inclui páginas, links e dados editoriais públicos, com agrupamento, origem e idioma. A leitura completa de posts e cases permanece no site original. A navegação continua disponível sem JavaScript.

Interface e aparência são preferências separadas: Minecraft ou Terminal, combinados com Sistema, Claro ou Escuro. Entrar no Terminal mostra a BIOS por aproximadamente dois segundos, com opção de pular. Navegação e recargas normais não repetem a sequência. Reboot recarrega a URL atual, conservando parâmetros, âncora, idioma e interface, e solicita uma única passagem pela BIOS. Movimento reduzido elimina a espera. Não há shell real, CRT ou modo Vim.

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
