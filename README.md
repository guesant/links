# guesant.net links

Página pessoal de links e apresentação de Gabriel R. Antunes, gerada como site estático pelo Hugo e publicada no GitHub Pages.

O projeto não possui backend, banco de dados, painel administrativo ou JavaScript obrigatório. Todo o conteúdo público vive no arquivo data/links.yaml, incluindo a apresentação em inglês e português. O workflow de publicação executa o build dentro da imagem oficial do Hugo Extended.

Quando a CDN estiver disponível, o SweetAlert2 pergunta se o link deve ser aberto na página atual, em uma nova página ou cancelado. Sem JavaScript ou sem a CDN, os links continuam funcionando como links HTML comuns e abrem em nova aba.

## Pré-requisitos

O projeto usa Hugo Extended em uma imagem Docker compartilhada pelo ambiente local e pelo CI:

    docker build --file .config/container/Dockerfile --tag guesant-links .
    docker run --rm --volume "$PWD/public:/src/public" guesant-links --minify --cleanDestinationDir

Para desenvolvimento, use a mesma imagem construída localmente:

    docker run --rm --interactive --tty --publish 1313:1313 --volume "$PWD:/src" --workdir /src guesant-links server --bind 0.0.0.0

O endereço local será http://localhost:1313/.

## Configuração

Edite somente data/links.yaml para alterar o conteúdo. O perfil fica em profile, os textos gerais por idioma ficam em locales.en e locales.pt-br, e a apresentação fica em presentation. As seções e os links são definidos uma única vez em sections. Cada seção e cada link possui labels.en e labels.pt-br para os textos localizados. As seções e os links são renderizados na ordem em que aparecem no YAML.

A versão em inglês é publicada na raiz. A versão em português é publicada em /pt-br/. O seletor de idioma usa links HTML comuns e funciona sem JavaScript.

A apresentação usa blocos curtos e links declarativos. O conteúdo detalhado permanece nos destinos correspondentes, sem duplicar o conteúdo de outros projetos nesta página.

Cada link precisa de url e de um título em labels.en e labels.pt-br. Os campos estruturais, como url, icon, enabled, featured e target, ficam fora de labels e são compartilhados pelos idiomas. O campo enabled é opcional e vale como true quando omitido. Use enabled: false para retirar uma seção ou um link do HTML gerado.

Campos disponíveis para links:

- id, identificador editorial opcional;
- labels, textos localizados com title obrigatório, description e badge opcionais;
- url, endereço http, https, mailto, tel, caminho local ou âncora;
- icon, nome de um ícone Font Awesome suportado pelo template;
- featured, destaque visual opcional;
- target, _blank por padrão ou _self quando uma exceção for necessária.

Links em nova aba recebem rel="noopener noreferrer". Protocolos inseguros, como javascript:, são rejeitados durante o build.

É possível repetir o mesmo ícone em vários links. Para adicionar uma rede social, copie um link, troque a URL e mantenha as variantes textuais em labels.en e labels.pt-br. Os textos localizados de cada seção e link devem ser mantidos nas duas chaves de idioma quando a informação existir em inglês e português.

Os ícones disponíveis são academic, code, document, education, email, github, gitlab, link, linkedin, website e youtube. Eles são renderizados pelo Font Awesome Free, carregado do cdnjs com SRI.

As propriedades theme.preset, theme.appearance e theme.background estão no YAML para manter a preferência visual declarativa. O preset atual é minecraft, com aparência escura e fundo CSS próprio. A fonte pixelada Press Start 2P e a fonte de corpo Roboto Slab são carregadas pelo Google Fonts com display=swap, sem fontes vendorizadas no repositório.

## Publicação

O workflow .github/workflows/pages.yml roda em todo push para main e também pode ser iniciado manualmente. Ele constrói a imagem definida em .config/container/Dockerfile, valida o YAML, executa hugo --minify --cleanDestinationDir dentro dela e publica o diretório public usando as Actions oficiais do GitHub Pages.

Antes da publicação, o workflow executa três gates independentes. O dead-link checker usa Lychee para verificar os links produzidos no HTML. O gate de acessibilidade usa Pa11y CI com os runners axe e HTML_CodeSniffer nas duas localidades. O gate de Lighthouse executa as auditorias de acessibilidade, boas práticas, performance e SEO, com limites configurados em .lighthouserc.json. Todos esses validadores rodam dentro do estágio quality do Dockerfile, sem instalar ferramentas na máquina ou adicionar dependências de execução ao site.

O deploy depende do build e dos três gates. Em pull requests, o build e as validações são executados, mas o deploy é omitido. Os relatórios do Lighthouse são preservados como artefato do workflow.

No repositório, configure GitHub Pages com a origem GitHub Actions. A primeira publicação usa o endereço padrão https://guesant.github.io/links/.

Depois da validação visual, o domínio personalizado poderá ser configurado separadamente para https://guesant.net/. O blog será servido em https://blog.guesant.net/.

## Estrutura

- data/links.yaml, fonte declarativa de perfil, seções e links;
- layouts/, templates Go do Hugo;
- assets/css/reset.css, reset mínimo;
- assets/css/main.css, tokens, layout e estética;
- static/favicon.svg, favicon original;
- .github/workflows/pages.yml, build e publicação;
- .config/container/Dockerfile, imagem única usada para o build local e pelo CI;
- LICENSES, atribuições dos assets externos;
- Font Awesome Free, folha de estilos e fontes carregadas do cdnjs em runtime.
- SweetAlert2, confirmação opcional carregada do jsDelivr em runtime.

## Licenciamento

O código deste projeto está sob a licença MIT. Os ícones são Font Awesome Free, carregados do cdnjs, e seguem a atribuição registrada em LICENSES/FONT-AWESOME.txt. O favicon, o CSS e os templates são originais deste projeto.
