# guesant.net links

Página pessoal de links e apresentação de Gabriel R. Antunes, gerada como site estático pelo Hugo e publicada em https://guesant.net/ pelo GitHub Pages. O blog é servido separadamente em https://blog.guesant.net/.

O projeto não possui backend, banco de dados, painel administrativo ou JavaScript obrigatório. Todo o conteúdo público vive no arquivo src/data/links.yaml, incluindo a apresentação em inglês, português, francês, espanhol, italiano e mandarim. As quatro últimas localidades exibem um aviso de que o texto foi traduzido automaticamente por IA e pode conter imprecisões. O workflow de publicação executa o build dentro da imagem oficial do Hugo Extended.

Quando a CDN estiver disponível, o SweetAlert2 pergunta se o link deve ser aberto na página atual, em uma nova página ou cancelado. Sem JavaScript ou sem a CDN, os links continuam funcionando como links HTML comuns e abrem em nova aba.

## Pré-requisitos

O projeto usa Hugo Extended em uma imagem Docker compartilhada pelo ambiente local e pelo CI:

    docker build --file .config/container/Dockerfile --tag guesant-links .
    docker run --rm --volume "$PWD/public:/tmp/public" guesant-links --minify --cleanDestinationDir --destination /tmp/public

Para desenvolvimento, use a mesma imagem construída localmente:

    docker run --rm --interactive --tty --publish 1313:1313 --volume "$PWD/src:/workspace/src" --volume "$PWD/.config/hugo.toml:/workspace/.config/hugo.toml:ro" guesant-links server --bind 0.0.0.0

O endereço local será http://localhost:1313/.

## Configuração

Edite somente src/data/links.yaml para alterar o conteúdo. O perfil fica em profile, os idiomas e seus caminhos ficam em language_options, e os textos gerais por idioma ficam em locales.en, locales.pt-br, locales.fr, locales.es, locales.it e locales.zh. A apresentação fica em presentation. Os públicos ficam em audiences, com identificadores estáveis e rótulos localizados. As seções e os links são definidos uma única vez em sections. Cada seção e cada link possui labels para os seis idiomas. As seções, os públicos e os links são renderizados na ordem em que aparecem no YAML.

A versão em inglês é publicada na raiz. As versões em português, francês, espanhol, italiano e mandarim são publicadas em /pt-br/, /fr/, /es/, /it/ e /zh/. O seletor de idioma usa links HTML comuns e funciona sem JavaScript.

A apresentação usa blocos curtos e links declarativos. O conteúdo detalhado permanece nos destinos correspondentes, sem duplicar o conteúdo de outros projetos nesta página.

O perfil também pode exibir badges declarados em profile.badges. Eles são reservados para atividade pessoal e presença nas plataformas, como seguidores do GitHub, estrelas dos repositórios, o canal JipaCoding e participação em open source. Nenhum badge representa o repositório guesant/links.

Cada link precisa de url, de um título em cada idioma e de pelo menos um identificador em audiences. Os campos estruturais, como url, icon, audiences, enabled, featured e target, ficam fora de labels e são compartilhados pelos idiomas. O campo enabled é opcional e vale como true quando omitido. Use enabled: false para retirar uma seção ou um link do HTML gerado.

A home é organizada primeiro por público e depois pelas seções originais. Um mesmo link pode receber vários públicos, como developers e recruiters, mas é renderizado uma única vez para evitar duplicação visual. Os públicos são agrupamentos editoriais, não são perfis de acesso. Use public: false em uma seção ou link para mantê-lo fora do HTML público. A seção personal permanece desativada por esse mecanismo, enquanto blog, currículo, Atlas, GitHub, YouTube, contatos profissionais e perfis acadêmicos continuam públicos.

Campos disponíveis para links:

- id, identificador editorial opcional;
- public, exposição no HTML gerado, true por padrão;
- labels, textos localizados com title obrigatório, description e badge opcionais;
- url, endereço http, https, mailto, tel, caminho local ou âncora;
- icon, nome de um ícone local ou Font Awesome suportado pelo template;
- visual, imagem opcional do destino, com kind, src e alt localizado;
- featured, destaque visual opcional;
- target, _blank por padrão ou _self quando uma exceção for necessária.

Links em nova aba recebem rel="noopener noreferrer". Protocolos inseguros, como javascript:, são rejeitados durante o build.

É possível repetir o mesmo ícone em vários links. Para adicionar uma rede social, copie um link, troque a URL e mantenha as variantes textuais em labels para cada idioma publicado. Os textos localizados de cada seção e link devem ser mantidos nas seis chaves de idioma.

Imagens visuais podem ser associadas a LeetCode, PlayStation e Last.fm. Cada imagem declara width e height no YAML, portanto o navegador reserva seu espaço antes do carregamento lazy. O card do GitHub fica em src/static/images/cards/github-stats.svg e é atualizado por GitHub Actions. O workflow usa a Action gh-readme-card com commit fixado, grava o SVG no repositório e não depende de Vercel, CDN de geração ou serviço de renderização em tempo de execução. O Spotify permanece como link textual e não possui card.

Os ícones disponíveis são academic, code, document, education, email, github, gitlab, instagram, lastfm, leetcode, link, linkedin, minecraft, orcid, hyperskill, playstation, website, spotify, steam, xbox e youtube. LeetCode, Hyperskill e ORCID usam SVGs locais baseados no catálogo Simple Icons 16.35.0, fixado no repositório em src/assets/icons. Consulte o [repositório do Simple Icons](https://github.com/simple-icons/simple-icons) e seu [disclaimer de marcas](https://github.com/simple-icons/simple-icons/blob/develop/DISCLAIMER.md) para a origem e as condições de uso. Os demais ícones de marca usam Font Awesome Free, carregado do cdnjs com SRI.

O botão Credits no rodapé abre um modal com as dependências, fontes, ferramentas e projetos de referência usados no site. O catálogo fica em src/data/credits.yaml e cada entrada informa autores, licença reproduzida e URL oficial.

As propriedades theme.preset, theme.appearance e theme.background estão no YAML para manter a preferência visual declarativa. O preset atual é minecraft, com aparência system e fundo CSS próprio. A home oferece os temas system, dark e light em um grupo de botões. A escolha é preservada no navegador quando o JavaScript está disponível, enquanto o tema continua funcional por CSS nos navegadores compatíveis. A fonte pixelada Press Start 2P e a fonte de corpo Roboto Slab são carregadas pelo Google Fonts com display=swap, sem fontes vendorizadas no repositório.

## Publicação

O workflow .github/workflows/pages.yml roda em todo push para main e também pode ser iniciado manualmente. Ele constrói a imagem definida em .config/container/Dockerfile, valida o YAML, executa hugo --minify --cleanDestinationDir dentro dela e publica o diretório public usando as Actions oficiais do GitHub Pages.

Antes da publicação, o workflow executa três gates independentes. O dead-link checker usa Lychee para verificar os links produzidos no HTML. O gate de acessibilidade usa Pa11y CI com os runners axe e HTML_CodeSniffer nas seis localidades. O gate de Lighthouse executa as auditorias de acessibilidade, boas práticas, performance e SEO, com limites configurados em .config/lighthouserc.json. Todos esses validadores rodam dentro dos estágios do Dockerfile, sem instalar ferramentas na máquina ou adicionar dependências de execução ao site.

O deploy depende do build e dos três gates. Em pull requests, o build e as validações são executados, mas o deploy é omitido. Os relatórios do Lighthouse são preservados como artefato do workflow. Os gates de acessibilidade e Lighthouse percorrem as seis localidades. O Lighthouse exige no mínimo 0,96 em acessibilidade, boas práticas, performance e SEO, e o site atualmente alcança 1,0 nas quatro categorias.

No repositório, configure GitHub Pages com a origem GitHub Actions e o domínio personalizado guesant.net. O blog será servido em https://blog.guesant.net/.

## Estrutura

- src/data/links.yaml, fonte declarativa de perfil, seções e links;
- src/data/credits.yaml, catálogo declarativo de créditos e licenças;
- src/layouts/, templates Go do Hugo;
- src/assets/js/credits-dialog.js, comportamento do modal de créditos;
- src/assets/css/reset.css, reset mínimo;
- src/assets/css/main.css, tokens, layout e estética;
- src/static/favicon.svg, favicon original;
- .github/workflows/pages.yml, build e publicação;
- .config/container/Dockerfile, imagem única usada para o build local e pelo CI;
- src/static/images/cards/github-stats.svg, card estático atualizado pela Action de GitHub;
- .github/workflows/github-stats.yml, atualização periódica do card de GitHub;
- LICENSES, atribuições dos assets externos;
- Font Awesome Free, folha de estilos e fontes carregadas do cdnjs em runtime.
- SweetAlert2, confirmação opcional carregada do jsDelivr em runtime.

## Licenciamento

O código deste projeto está sob a licença MIT. As atribuições detalhadas das fontes, bibliotecas, ferramentas, dependências e referências estão disponíveis no botão Credits e em src/data/credits.yaml. Os ícones Font Awesome Free são carregados do cdnjs e seguem a atribuição registrada em LICENSES/FONT-AWESOME.txt. O favicon, o CSS e os templates são originais deste projeto.

Os cards externos de LeetCode, PlayStation e Last.fm são fornecidos pelos respectivos serviços. O card do GitHub é um SVG gravado neste repositório pela Action fixada em .github/workflows/github-stats.yml.
