# guesant.net links

Página pessoal de links de Gabriel R. Antunes, gerada como site estático pelo Hugo e publicada no GitHub Pages.

O projeto não possui backend, banco de dados, painel administrativo ou JavaScript obrigatório. Todo o conteúdo público vive no arquivo data/links.yaml, e o workflow de publicação executa o build dentro da imagem oficial do Hugo Extended.

## Pré-requisitos

A versão usada pelo projeto é Hugo Extended 0.168.0. Para manter o ambiente local igual ao CI, use Docker:

    docker build --tag guesant-links .
    docker run --rm --volume "$PWD/public:/src/public" guesant-links --minify --cleanDestinationDir

Para desenvolvimento, use a mesma imagem construída localmente:

    docker run --rm --interactive --tty --publish 1313:1313 --volume "$PWD:/src" --workdir /src guesant-links server --bind 0.0.0.0

O endereço local será http://localhost:1313/.

## Configuração

Edite somente data/links.yaml para alterar o conteúdo. As seções e os links são renderizados na ordem em que aparecem no YAML.

Cada link precisa de title e url. O campo enabled é opcional e vale como true quando omitido. Use enabled: false para retirar uma seção ou um link do HTML gerado.

Campos disponíveis para links:

- id, identificador editorial opcional;
- title, texto obrigatório;
- url, endereço http, https, mailto, tel, caminho local ou âncora;
- description, descrição opcional;
- icon, nome de um SVG local;
- badge, selo textual opcional;
- featured, destaque visual opcional;
- target, _blank por padrão ou _self quando uma exceção for necessária.

Links em nova aba recebem rel="noopener noreferrer". Protocolos inseguros, como javascript:, são rejeitados durante o build.

É possível repetir o mesmo ícone em vários links. O exemplo usa github tanto para o perfil quanto para a listagem de repositórios. Para adicionar uma rede social, copie um link, troque o título e a URL e mantenha o ícone correspondente.

Os ícones disponíveis são academic, code, document, education, email, github, gitlab, link, linkedin, website e youtube. Os SVGs ficam em static/icons.

As propriedades theme.preset, theme.appearance e theme.background estão no YAML para manter a preferência visual declarativa. O preset atual é minecraft, com aparência escura e fundo CSS próprio. A fonte pixelada é local e não depende de CDN.

## Publicação

O workflow .github/workflows/pages.yml roda em todo push para main e também pode ser iniciado manualmente. Ele constrói a imagem definida no Dockerfile, valida o YAML, executa hugo --minify --cleanDestinationDir dentro dela e publica o diretório public usando as Actions oficiais do GitHub Pages.

No repositório, configure GitHub Pages com a origem GitHub Actions. A primeira publicação usa o endereço padrão https://guesant.github.io/links/.

Depois da validação visual, o domínio personalizado poderá ser configurado separadamente para https://guesant.net/. O blog será servido em https://blog.guesant.net/.

## Estrutura

- data/links.yaml, fonte declarativa de perfil, seções e links;
- layouts/, templates Go do Hugo;
- assets/css/reset.css, reset mínimo;
- assets/css/main.css, tokens, layout e estética;
- static/icons, ícones locais;
- static/favicon.svg, favicon original;
- .github/workflows/pages.yml, build e publicação;
- Dockerfile, imagem única usada para o build local e pelo CI;
- LICENSES, atribuições dos assets externos.

## Licenciamento

O código deste projeto está sob a licença MIT. Os ícones locais são Font Awesome Free e seguem a atribuição registrada em LICENSES/FONT-AWESOME.txt. O favicon, o CSS e os templates são originais deste projeto.
