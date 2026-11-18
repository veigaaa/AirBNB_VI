# Airbnb Explorer

O Airbnb Explorer permite explorar a concorrência no mercado de alojamento local nos concelhos de Lisboa e Porto. Ajuda a conhecer a concentração de anúncios, os preços por noite e as características dos alojamentos, e a comparar imóveis semelhantes.

## Público-alvo

Destina-se a potenciais investidores imobiliários e proprietários que procuram compreender o mercado. A persona do projeto é Charles, 59 anos, interessado em analisar a oferta antes de tomar decisões.

## Visualizações

- **Mapa:** mostra a densidade de anúncios por freguesia e permite explorar a localização dos alojamentos.
- **Histograma:** apresenta a distribuição dos preços por noite e permite selecionar um intervalo de preços.
- **Scatterplot:** relaciona o preço com a capacidade, o número de quartos, a avaliação ou o número de avaliações.

## Principais funcionalidades

- Escolher Lisboa ou Porto e explorar freguesias com zoom no mapa.
- Filtrar por localização, preço, tipo de alojamento e outras características.
- Explorar uma lista ordenável, consultar detalhes e acompanhar a seleção entre visualizações.
- Comparar dois ou três alojamentos lado a lado.

## Fonte dos dados

Os dados são provenientes do [Inside Airbnb](https://insideairbnb.com/get-the-data/) e incluem anúncios, características dos alojamentos e limites das freguesias. A aplicação utiliza uma recolha guardada localmente, sem atualização automática. A informação metodológica está disponível na própria aplicação.

## Tecnologias

HTML, CSS, JavaScript, SVG e D3.js v7. Não é necessário instalar dependências.

## Como executar localmente

Com Python 3 instalado, executar na raiz do repositório:

```sh
python -m http.server 8888
```

Endereço previsto para a entrega, após a reorganização dos ficheiros:

**http://localhost:8888/Projeto/index.html**

Essa reorganização ainda não foi realizada; o endereço indicado ainda não corresponde à aplicação mais recente. É necessária ligação à Internet para carregar D3.js.

## Limitações importantes

- Os preços são valores anunciados e podem variar; não representam transações confirmadas.
- O número de avaliações e a disponibilidade não medem diretamente reservas ou ocupação.
- As localizações podem ser aproximadas e alguns atributos podem estar em falta.
- A análise depende da data e da cobertura dos dados. As escalas iniciais dos gráficos limitam os extremos, que continuam disponíveis na lista.
- A aplicação apoia a análise do mercado, sem recomendar investimentos. As seleções não são guardadas ao recarregar a página.

## Créditos e referências

Projeto desenvolvido no âmbito da disciplina de Visualização de Informação.

- [Inside Airbnb](https://insideairbnb.com/get-the-data/): dados e [pressupostos de utilização](https://insideairbnb.com/data-assumptions/).
- [D3.js](https://d3js.org/): biblioteca de visualização, disponibilizada sob [licença ISC](https://github.com/d3/d3/blob/main/LICENSE).
- Codex: apoio à revisão do código, à documentação e às verificações técnicas.
