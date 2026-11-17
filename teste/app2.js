const cities = {
  Lisboa: { folder: 'Lisboa', suffix: 'lis', municipality: 'Lisboa' },
  Porto: { folder: 'Porto', suffix: 'por', municipality: 'PORTO' }
};
const currency = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });
const densityFormat = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 });
const densityColors = ['#35A853', '#F5D547', '#F28C28', '#D93432'];
const parishNames = {
  'Belm': 'Belém',
  'Alcntara': 'Alcântara',
  'Misericrdia': 'Misericórdia',
  'So Vicente': 'São Vicente',
  'Parque das Naes': 'Parque das Nações',
  'Penha de Frana': 'Penha de França',
  'So Domingos de Benfica': 'São Domingos de Benfica',
  'Santo Antnio': 'Santo António'
};
const roomTypes = {
  'Entire home/apt': 'Alojamento inteiro',
  'Private room': 'Quarto privado',
  'Shared room': 'Quarto partilhado',
  'Hotel room': 'Quarto de hotel'
};
const mapElement = document.getElementById('map');
const mapStatus = document.getElementById('map-status');
const parishName = document.getElementById('parish-name');
const resultCount = document.getElementById('result-count');
const listingList = document.getElementById('listing-list');
const listingScroll = document.getElementById('listing-scroll');
const resetButton = document.getElementById('reset-view');
const previousButton = document.getElementById('previous-page');
const nextButton = document.getElementById('next-page');
const pageLabel = document.getElementById('page-label');
const roomInput = document.getElementById('room-type');
const priceInput = document.getElementById('max-price');
const tooltip = document.getElementById('tooltip');
const pageSize = 10;
const cityCache = {};
let selectedCity = null;
let selectedParish = null;
let selectedListing = null;
let listings = [];
let filteredListings = [];
let currentPage = 0;
let currentGeoData = null;
let requestId = 0;
let mapZoom = null;
let projection = null;
let mapPath = null;
let densityScale = null;
let priceRange = null;
let currentView = 'home';
let mapWidth = 0;
let mapHeight = 0;

function displayParish(name) {
  const key = (name || '').normalize('NFC').trim();
  return parishNames[key] || key;
}

function nameKey(name) {
  return displayParish(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function sameName(a, b) {
  return nameKey(a) === nameKey(b);
}

function parseNumber(value) {
  if (value == null || String(value).trim() === '') return null;
  const number = Number(String(value).replace(/[$,]/g, ''));
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function parseCoordinate(value, limit) {
  if (value == null || value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

function prepareListing(d) {
  d.price = parseNumber(d.price);
  d.latitude = parseCoordinate(d.latitude, 90);
  d.longitude = parseCoordinate(d.longitude, 180);
  d.number_of_reviews = parseNumber(d.number_of_reviews);
  return d;
}

function validCoordinates(d) {
  return Number.isFinite(d.latitude) && Number.isFinite(d.longitude);
}

function listingPrice(d) {
  return Number.isFinite(d.price) ? currency.format(d.price) + ' / noite' : 'Preço indisponível';
}

function showTooltip(event, text) {
  tooltip.textContent = text;
  tooltip.hidden = false;
  const x = event.clientX || 12;
  const y = event.clientY || 12;
  tooltip.style.left = Math.max(12, Math.min(x + 14, innerWidth - tooltip.offsetWidth - 12)) + 'px';
  tooltip.style.top = Math.max(12, Math.min(y + 14, innerHeight - tooltip.offsetHeight - 12)) + 'px';
}

function hideTooltip() {
  tooltip.hidden = true;
}

function showView(view) {
  currentView = view;
  ['home', 'dashboard', 'details'].forEach(function (name) {
    document.getElementById(name + '-view').hidden = name !== view;
  });
  document.body.classList.toggle('has-dashboard', view !== 'home');
  document.getElementById('go-home').hidden = view === 'home';
  hideTooltip();
  if (view === 'dashboard') document.getElementById('dashboard-title').focus();
  if (view === 'details') document.getElementById('details-title').focus();
  window.scrollTo(0, 0);
}

function prepareDensity(geoData) {
  const counts = d3.rollup(listings, rows => rows.length, d => nameKey(d.neighbourhood));
  geoData.features.forEach(function (feature) {
    // geoArea mede esterradianos; R² converte a área para km².
    const areaKm2 = d3.geoArea(feature) * 6371.0088 ** 2;
    if (!Number.isFinite(areaKm2) || areaKm2 <= 0 || areaKm2 > 1000) {
      throw new Error('Área inválida para ' + displayParish(feature.properties.neighbourhood));
    }
    const count = counts.get(nameKey(feature.properties.neighbourhood)) || 0;
    feature.metrics = { areaKm2: areaKm2, count: count, density: count / areaKm2 };
  });
  const maximum = Math.max(100, Math.ceil(d3.max(geoData.features, d => d.metrics.density) / 100) * 100);
  densityScale = d3.scaleQuantize().domain([0, maximum]).range(densityColors);
  renderDensityLegend();
}

function renderDensityLegend() {
  const levels = ['Baixa', 'Moderada', 'Elevada', 'Muito elevada'];
  document.getElementById('legend-title').textContent = 'Densidade · ' + selectedCity + ' · anúncios/km²';
  const labels = document.getElementById('legend-values');
  labels.replaceChildren();
  densityColors.forEach(function (color, i) {
    const interval = densityScale.invertExtent(color);
    const item = document.createElement('li');
    const swatch = document.createElement('span');
    swatch.className = 'legend-swatch';
    swatch.style.backgroundColor = color;
    swatch.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.textContent = densityFormat.format(interval[0]) + ' a ' + (i < 3 ? '< ' : '') +
      densityFormat.format(interval[1]) + ' · ' + levels[i];
    item.append(swatch, label);
    labels.appendChild(item);
  });
  document.getElementById('density-legend').hidden = false;
}

function parishDescription(feature) {
  return displayParish(feature.properties.neighbourhood) + ' · ' +
    feature.metrics.count.toLocaleString('pt-PT') + ' anúncios · ' +
    densityFormat.format(feature.metrics.density) + ' anúncios/km²';
}

function selectedFeature() {
  return currentGeoData.features.find(d => sameName(d.properties.neighbourhood, selectedParish));
}

function highlightParish() {
  d3.select('#map').selectAll('.parish')
    .classed('selected', d => sameName(d.properties.neighbourhood, selectedParish))
    .classed('muted', d => selectedParish !== null && !sameName(d.properties.neighbourhood, selectedParish))
    .attr('aria-pressed', d => String(sameName(d.properties.neighbourhood, selectedParish)));
}

function baseListings() {
  const maxPrice = priceInput.validity.valid ? parseNumber(priceInput.value) : null;
  return listings.filter(d =>
    (selectedParish === null || sameName(d.neighbourhood, selectedParish)) &&
    (roomInput.value === '' || d.room_type === roomInput.value) &&
    (maxPrice === null || (Number.isFinite(d.price) && d.price <= maxPrice))
  );
}

// O mesmo conjunto filtrado alimenta a lista, o mapa e os dois gráficos.
function updateSelection() {
  hideTooltip();
  const base = baseListings();
  filteredListings = base.filter(d => priceRange === null ||
    (Number.isFinite(d.price) && d.price >= priceRange[0] && d.price <= priceRange[1]));
  if (selectedListing && !filteredListings.some(d => d.id === selectedListing.id)) selectedListing = null;
  currentPage = 0;
  highlightParish();
  renderListings();
  drawListingPoints();
  renderCharts(base);
  document.getElementById('active-parish').textContent = selectedParish === null ?
    'Todas · selecione no mapa' : displayParish(selectedParish);
  document.getElementById('clear-price-range').disabled = priceRange === null;
  const feature = selectedParish === null ? null : selectedFeature();
  parishName.textContent = feature ? parishDescription(feature) :
    'Passe o rato sobre uma freguesia para ver os valores. Clique para selecionar.';
  const missingCoordinates = filteredListings.filter(d => !validCoordinates(d)).length;
  mapStatus.textContent = selectedParish === null ?
    'Vista de densidade. Selecione uma freguesia para mostrar os alojamentos.' :
    filteredListings.length.toLocaleString('pt-PT') + ' anúncios na seleção · ' +
    (filteredListings.length - missingCoordinates).toLocaleString('pt-PT') + ' pontos com coordenadas válidas.';
  document.getElementById('filter-summary').textContent =
    'Concelho de ' + selectedCity + ' · ' + listings.length.toLocaleString('pt-PT') + ' anúncios no total.' +
    (priceRange ? ' Intervalo selecionado: ' + currency.format(priceRange[0]) + ' a ' + currency.format(priceRange[1]) + '.' : '') +
    ((priceInput.value !== '' || priceRange) ? ' Os anúncios sem preço são excluídos pelos filtros de preço.' : ' Os anúncios sem preço continuam na lista e no mapa.');
}

function renderListings() {
  const area = selectedParish === null ? selectedCity : displayParish(selectedParish) + ' (' + selectedCity + ')';
  resultCount.textContent = filteredListings.length.toLocaleString('pt-PT') + ' anúncios encontrados em ' + area + '.';
  listingList.replaceChildren();
  const start = currentPage * pageSize;
  filteredListings.slice(start, start + pageSize).forEach(function (listing) {
    const item = document.createElement('li');
    item.className = 'listing-card';
    item.classList.toggle('selected', selectedListing !== null && listing.id === selectedListing.id);
    const name = document.createElement('h3');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'listing-open';
    button.textContent = listing.name || 'Anúncio sem nome';
    button.addEventListener('click', function () { openListing(listing); });
    name.appendChild(button);
    const price = document.createElement('p');
    price.className = 'price';
    price.textContent = listingPrice(listing);
    const type = document.createElement('p');
    type.textContent = roomTypes[listing.room_type] || listing.room_type || 'Tipo indisponível';
    const parish = document.createElement('p');
    parish.textContent = 'Freguesia: ' + (displayParish(listing.neighbourhood) || 'Indisponível');
    item.append(name, price, type, parish);
    listingList.appendChild(item);
  });
  if (filteredListings.length === 0) {
    const empty = document.createElement('li');
    empty.textContent = 'Não existem anúncios para estes filtros. Experimente limpar os filtros.';
    listingList.appendChild(empty);
  }
  const pages = Math.ceil(filteredListings.length / pageSize);
  pageLabel.textContent = pages === 0 ? 'Sem resultados' :
    (start + 1) + '–' + Math.min(start + pageSize, filteredListings.length) +
    ' · Página ' + (currentPage + 1) + ' de ' + pages;
  previousButton.disabled = currentPage === 0;
  nextButton.disabled = currentPage + 1 >= pages;
  listingScroll.scrollTop = 0;
}

function selectParish(feature) {
  selectedParish = feature.properties.neighbourhood;
  selectedListing = null;
  updateSelection();
  zoomToParish(feature);
}

function zoomToParish(feature) {
  const bounds = mapPath.bounds(feature);
  const dx = bounds[1][0] - bounds[0][0];
  const dy = bounds[1][1] - bounds[0][1];
  const scale = Math.max(1, Math.min(16, 0.85 / Math.max(dx / mapWidth, dy / mapHeight)));
  const x = (bounds[0][0] + bounds[1][0]) / 2;
  const y = (bounds[0][1] + bounds[1][1]) / 2;
  const transform = d3.zoomIdentity.translate(mapWidth / 2, mapHeight / 2).scale(scale).translate(-x, -y);
  d3.select('#map').call(mapZoom.transform, transform);
}

function drawMap(geoData) {
  const canvas = document.querySelector('.map-canvas');
  mapWidth = canvas.clientWidth;
  mapHeight = canvas.clientHeight;
  projection = d3.geoMercator().fitExtent([[24, 24], [mapWidth - 24, mapHeight - 24]], geoData);
  mapPath = d3.geoPath().projection(projection);
  const svg = d3.select('#map').attr('viewBox', '0 0 ' + mapWidth + ' ' + mapHeight);
  svg.selectAll('*').remove();
  const zoomLayer = svg.append('g').attr('class', 'zoom-layer');
  zoomLayer.append('g').attr('class', 'parish-layer').selectAll('path')
    .data(geoData.features).join('path')
    .attr('class', 'parish')
    .style('--parish-color', d => densityScale(d.metrics.density))
    .attr('d', mapPath)
    .attr('tabindex', 0).attr('role', 'button')
    .attr('aria-label', parishDescription)
    .on('mouseenter focus', function (event, d) { parishName.textContent = parishDescription(d); })
    .on('mousemove', function (event, d) { showTooltip(event, parishDescription(d)); })
    .on('mouseleave blur', hideTooltip)
    .on('click', function (event, d) { selectParish(d); })
    .on('keydown', function (event, d) {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectParish(d); }
    });
  zoomLayer.append('g').attr('class', 'point-layer');
  mapZoom = d3.zoom().extent([[0, 0], [mapWidth, mapHeight]]).scaleExtent([1, 16])
    .translateExtent([[-mapWidth / 2, -mapHeight / 2], [mapWidth * 1.5, mapHeight * 1.5]])
    .on('zoom', function (event) {
      zoomLayer.attr('transform', event.transform);
      resizePoints(event.transform.k);
      hideTooltip();
    });
  svg.call(mapZoom).call(mapZoom.transform, d3.zoomIdentity);
  highlightParish();
  drawListingPoints();
  if (selectedParish !== null) zoomToParish(selectedFeature());
}

function resizePoints(scale) {
  d3.select('#map').selectAll('.listing-point')
    .attr('r', d => (selectedListing && d.id === selectedListing.id ? 5 : 2.7) / scale);
}

function drawListingPoints() {
  if (!projection) return;
  // Só cria pontos da freguesia escolhida; a lista mantém a paginação original.
  const points = selectedParish === null ? [] : filteredListings.filter(validCoordinates);
  d3.select('#map .point-layer').selectAll('circle')
    .data(points, d => d.id).join('circle')
    .attr('class', 'listing-point')
    .attr('cx', d => projection([d.longitude, d.latitude])[0])
    .attr('cy', d => projection([d.longitude, d.latitude])[1])
    .on('mousemove', function (event, d) { showTooltip(event, (d.name || 'Anúncio sem nome') + '\n' + listingPrice(d)); })
    .on('mouseleave', hideTooltip)
    .on('click', function (event, d) { event.stopPropagation(); openListing(d); });
  highlightListing();
}

function highlightListing() {
  d3.select('#map').selectAll('.listing-point')
    .classed('selected', d => selectedListing !== null && d.id === selectedListing.id);
  d3.select('#map').selectAll('.listing-point.selected').raise();
  d3.select('#scatterplot').selectAll('.scatter-point')
    .classed('selected', d => selectedListing !== null && d.id === selectedListing.id);
  resizePoints(d3.zoomTransform(mapElement).k);
}

function resetView() {
  if (!currentGeoData) return;
  selectedParish = null;
  selectedListing = null;
  updateSelection();
  d3.select('#map').call(mapZoom.transform, d3.zoomIdentity);
}

function openListing(listing) {
  selectedListing = listing;
  const index = filteredListings.findIndex(d => d.id === listing.id);
  currentPage = Math.max(0, Math.floor(index / pageSize));
  renderListings();
  highlightListing();
  document.getElementById('details-title').textContent = listing.name || 'Anúncio sem nome';
  document.getElementById('details-price').textContent = listingPrice(listing);
  document.getElementById('details-context').textContent = selectedCity + ' · ' + displayParish(listing.neighbourhood);
  const fields = document.getElementById('details-fields');
  fields.replaceChildren();
  const details = [
    ['Identificador do anúncio', listing.id],
    ['Tipo de alojamento', roomTypes[listing.room_type] || listing.room_type],
    ['Freguesia', displayParish(listing.neighbourhood)],
    ['Anfitrião', listing.host_name],
    ['Número de avaliações', listing.number_of_reviews],
    ['Última avaliação', listing.last_review],
    ['Avaliações por mês', parseNumber(listing.reviews_per_month)],
    ['Estadia mínima (noites)', parseNumber(listing.minimum_nights)],
    ['Dias disponíveis nos próximos 365 dias', parseNumber(listing.availability_365)],
    ['Anúncios do anfitrião no dataset', parseNumber(listing.calculated_host_listings_count)],
    ['Licença (valor do dataset)', listing.license],
    ['Latitude', listing.latitude],
    ['Longitude', listing.longitude]
  ];
  details.forEach(function (field) {
    const label = document.createElement('dt');
    const value = document.createElement('dd');
    label.textContent = field[0];
    value.textContent = field[1] == null || field[1] === '' ? 'Indisponível' : field[1];
    fields.append(label, value);
  });
  showView('details');
}

function setLoading(loading) {
  document.getElementById('map-section').setAttribute('aria-busy', String(loading));
  [resetButton, document.getElementById('zoom-in'), document.getElementById('zoom-out'),
    roomInput, priceInput, document.getElementById('clear-filters')].forEach(function (control) {
    control.disabled = loading;
  });
}

async function loadCity(city) {
  showView('dashboard');
  document.getElementById('city-select').value = city;
  if (selectedCity === city && currentGeoData) return;
  const currentRequest = ++requestId;
  selectedCity = city;
  selectedParish = null;
  selectedListing = null;
  priceRange = null;
  listings = [];
  filteredListings = [];
  currentGeoData = null;
  projection = null;
  mapZoom = null;
  mapWidth = 0;
  mapHeight = 0;
  currentPage = 0;
  roomInput.value = '';
  priceInput.value = '';
  document.getElementById('show-extremes').checked = false;
  document.getElementById('active-parish').textContent = 'Todas · selecione no mapa';
  document.getElementById('filter-summary').textContent = '';
  document.getElementById('density-legend').hidden = true;
  document.getElementById('charts-section').hidden = true;
  mapElement.setAttribute('hidden', '');
  listingList.replaceChildren();
  resultCount.textContent = '';
  pageLabel.textContent = '';
  previousButton.disabled = true;
  nextButton.disabled = true;
  document.getElementById('map-title').textContent = 'Freguesias de ' + city;
  mapStatus.textContent = 'A carregar mapa e anúncios…';
  setLoading(true);
  try {
    if (typeof d3 === 'undefined') throw new Error('Não foi possível carregar D3.js. Verifique a ligação à Internet.');
    const config = cities[city];
    const base = '../dados/' + config.folder + '/';
    // Guarda a promessa para reutilizar também carregamentos ainda em curso.
    if (!cityCache[city]) {
      cityCache[city] = Promise.all([
        d3.json(base + 'neighbourhoods-' + config.suffix + '.geojson'),
        d3.csv(base + 'listings-' + config.suffix + '.csv', prepareListing)
      ]).catch(function (error) { delete cityCache[city]; throw error; });
    }
    const [geoData, rows] = await cityCache[city];
    if (currentRequest !== requestId) return;
    const cityGeoData = {
      type: 'FeatureCollection',
      features: geoData.features.filter(d => sameName(d.properties.neighbourhood_group, config.municipality))
    };
    if (cityGeoData.features.length === 0) throw new Error('Município sem freguesias.');
    listings = rows.filter(d => sameName(d.neighbourhood_group, config.municipality));
    const types = Array.from(new Set(listings.map(d => d.room_type))).sort();
    roomInput.replaceChildren(new Option('Todos os tipos', ''));
    types.forEach(function (type) { roomInput.add(new Option(roomTypes[type] || type, type)); });
    prepareDensity(cityGeoData);
    currentGeoData = cityGeoData;
    mapElement.removeAttribute('hidden');
    mapElement.setAttribute('aria-label', 'Freguesias do concelho de ' + city);
    if (currentView === 'dashboard') drawMap(cityGeoData);
    document.getElementById('charts-section').hidden = false;
    updateSelection();
    setLoading(false);
  } catch (error) {
    if (currentRequest !== requestId) return;
    currentGeoData = null;
    mapElement.setAttribute('hidden', '');
    mapStatus.textContent = 'Não foi possível carregar os dados. Use o servidor HTTP local. ' + error.message;
    document.getElementById('map-section').setAttribute('aria-busy', 'false');
    console.error(error);
  }
}

function chartFrame(id, x, y, xLabel, yLabel) {
  const svg = d3.select('#' + id);
  const width = Math.max(260, svg.node().clientWidth);
  const height = 320;
  const margin = { top: 22, right: 18, bottom: 56, left: 65 };
  svg.attr('viewBox', '0 0 ' + width + ' ' + height).attr('height', height);
  x.range([margin.left, width - margin.right]);
  y.range([height - margin.bottom, margin.top]);
  svg.selectAll('.x-axis').data([null]).join('g').attr('class', 'axis x-axis')
    .attr('transform', 'translate(0,' + (height - margin.bottom) + ')')
    .call(d3.axisBottom(x).ticks(width < 400 ? 4 : 6).tickFormat(d3.format('~s')));
  svg.selectAll('.y-axis').data([null]).join('g').attr('class', 'axis y-axis')
    .attr('transform', 'translate(' + margin.left + ',0)')
    .call(d3.axisLeft(y).ticks(5).tickFormat(function (value) {
      return Number.isInteger(value) ? value.toLocaleString('pt-PT') : '';
    }));
  svg.selectAll('.x-label').data([null]).join('text').attr('class', 'axis-label x-label')
    .attr('x', (margin.left + width - margin.right) / 2).attr('y', height - 12)
    .attr('text-anchor', 'middle').text(xLabel);
  svg.selectAll('.y-label').data([null]).join('text').attr('class', 'axis-label y-label')
    .attr('transform', 'translate(17,' + ((margin.top + height - margin.bottom) / 2) + ') rotate(-90)')
    .attr('text-anchor', 'middle').text(yLabel);
  return { svg: svg, width: width, height: height, margin: margin };
}

function emptyChart(frame, empty) {
  frame.svg.selectAll('.empty-chart').data(empty ? [null] : []).join('text')
    .attr('class', 'empty-chart')
    .attr('x', (frame.margin.left + frame.width - frame.margin.right) / 2)
    .attr('y', frame.height / 2).text('Sem dados para estes filtros');
}

function renderCharts(base) {
  const prices = base.filter(d => Number.isFinite(d.price)).map(d => d.price).sort(d3.ascending);
  const showAll = document.getElementById('show-extremes').checked;
  // O percentil 95 evita que poucos preços extremos comprimam a distribuição.
  const limit = prices.length ? (showAll ? d3.max(prices) : d3.quantileSorted(prices, 0.95)) : 1;
  const maximum = d3.scaleLinear().domain([0, Math.max(1, limit)]).nice().domain()[1];
  renderHistogram(maximum);
  renderScatterplot(maximum);
}

function renderHistogram(maximum) {
  const valid = filteredListings.filter(d => Number.isFinite(d.price));
  const visible = valid.filter(d => d.price <= maximum);
  const x = d3.scaleLinear().domain([0, maximum]);
  const bins = d3.bin().value(d => d.price).domain(x.domain()).thresholds(x.ticks(18))(visible);
  const y = d3.scaleLinear().domain([0, Math.max(1, d3.max(bins, d => d.length))]).nice();
  const frame = chartFrame('histogram', x, y, 'Preço por noite (€)', 'Número de anúncios');
  frame.svg.selectAll('.bar-layer').data([null]).join('g').attr('class', 'bar-layer')
    .selectAll('rect').data(bins).join('rect').attr('class', 'histogram-bar')
    .attr('x', d => x(d.x0) + 1).attr('y', d => y(d.length))
    .attr('width', d => Math.max(0, x(d.x1) - x(d.x0) - 1))
    .attr('height', d => y(0) - y(d.length));
  emptyChart(frame, visible.length === 0);
  const missing = filteredListings.length - valid.length;
  const outside = valid.length - visible.length;
  document.getElementById('histogram-note').textContent =
    visible.length.toLocaleString('pt-PT') + ' anúncios no gráfico · ' + missing.toLocaleString('pt-PT') +
    ' sem preço · ' + outside.toLocaleString('pt-PT') + ' acima de ' + currency.format(maximum) +
    '. Os valores fora da escala continuam na lista e no mapa. ' +
    (document.getElementById('show-extremes').checked ? 'Escala com todos os preços.' : 'Limite visual baseado no percentil 95.') +
    ' A escala é calculada antes do intervalo selecionado.';
  const brush = d3.brushX()
    .extent([[frame.margin.left, frame.margin.top], [frame.width - frame.margin.right, frame.height - frame.margin.bottom]])
    .on('end', function (event) {
      if (!event.sourceEvent) return;
      priceRange = event.selection && event.selection[1] - event.selection[0] >= 2 ? event.selection.map(x.invert) : null;
      updateSelection();
    });
  const brushLayer = frame.svg.selectAll('.brush').data([null]).join('g').attr('class', 'brush').call(brush);
  brushLayer.call(brush.move, priceRange ? priceRange.map(value => x(Math.max(0, Math.min(maximum, value)))) : null);
  frame.svg.on('mousemove', function (event) {
    const position = d3.pointer(event, this);
    if (position[0] < frame.margin.left || position[0] > frame.width - frame.margin.right ||
      position[1] < frame.margin.top || position[1] > frame.height - frame.margin.bottom) { hideTooltip(); return; }
    const value = x.invert(position[0]);
    const bin = bins.find(d => value >= d.x0 && (value < d.x1 || (value === d.x1 && d.x1 === maximum)));
    if (bin) showTooltip(event, currency.format(bin.x0) + ' a ' + currency.format(bin.x1) +
      (bin.x1 === maximum ? ' (inclusive)' : ' (limite superior exclusivo)') + '\n' + bin.length.toLocaleString('pt-PT') + ' anúncios');
  }).on('mouseleave', hideTooltip);
}

function renderScatterplot(maximum) {
  const valid = filteredListings.filter(d => Number.isFinite(d.price) && Number.isFinite(d.number_of_reviews));
  const visible = valid.filter(d => d.price <= maximum);
  const x = d3.scaleLinear().domain([0, Math.max(1, d3.max(visible, d => d.number_of_reviews) || 0)]).nice();
  const y = d3.scaleLinear().domain([0, maximum]);
  const frame = chartFrame('scatterplot', x, y, 'Número de avaliações', 'Preço por noite (€)');
  frame.svg.selectAll('.scatter-layer').data([null]).join('g').attr('class', 'scatter-layer')
    .selectAll('circle').data(visible, d => d.id).join('circle')
    .attr('class', 'scatter-point').attr('r', 3)
    .attr('cx', d => x(d.number_of_reviews)).attr('cy', d => y(d.price))
    .on('mousemove', function (event, d) {
      showTooltip(event, (d.name || 'Anúncio sem nome') + '\n' + listingPrice(d) + '\n' +
        d.number_of_reviews.toLocaleString('pt-PT') + ' avaliações · ' + displayParish(d.neighbourhood));
    }).on('mouseleave', hideTooltip);
  emptyChart(frame, visible.length === 0);
  document.getElementById('scatterplot-note').textContent = visible.length.toLocaleString('pt-PT') +
    ' anúncios no gráfico · ' + (filteredListings.length - valid.length).toLocaleString('pt-PT') +
    ' sem preço ou avaliações · ' + (valid.length - visible.length).toLocaleString('pt-PT') +
    ' acima de ' + currency.format(maximum) + '. Cada ponto representa um anúncio.';
  highlightListing();
}

document.querySelectorAll('.city').forEach(function (button) {
  button.addEventListener('click', function () { loadCity(button.dataset.city); });
});
document.getElementById('city-select').addEventListener('change', function () { loadCity(this.value); });
document.getElementById('go-home').addEventListener('click', function () { showView('home'); });
document.getElementById('back-dashboard').addEventListener('click', function () { showView('dashboard'); });
document.getElementById('filters').addEventListener('submit', function (event) { event.preventDefault(); });
roomInput.addEventListener('change', function () { priceRange = null; updateSelection(); });
priceInput.addEventListener('input', function () {
  if (priceInput.validity.valid) { priceRange = null; updateSelection(); }
});
document.getElementById('clear-filters').addEventListener('click', function () {
  roomInput.value = '';
  priceInput.value = '';
  priceRange = null;
  resetView();
});
document.getElementById('show-extremes').addEventListener('change', function () { renderCharts(baseListings()); });
document.getElementById('clear-price-range').addEventListener('click', function () { priceRange = null; updateSelection(); });
resetButton.addEventListener('click', resetView);
document.getElementById('zoom-in').addEventListener('click', function () {
  if (mapZoom) d3.select('#map').call(mapZoom.scaleBy, 1.5);
});
document.getElementById('zoom-out').addEventListener('click', function () {
  if (mapZoom) d3.select('#map').call(mapZoom.scaleBy, 1 / 1.5);
});
previousButton.addEventListener('click', function () {
  if (currentPage > 0) { currentPage--; renderListings(); }
});
nextButton.addEventListener('click', function () {
  if ((currentPage + 1) * pageSize < filteredListings.length) { currentPage++; renderListings(); }
});

new ResizeObserver(function () {
  if (!currentGeoData || currentView !== 'dashboard') return;
  const canvas = document.querySelector('.map-canvas');
  if (canvas.clientWidth !== mapWidth || canvas.clientHeight !== mapHeight) drawMap(currentGeoData);
  renderCharts(baseListings());
}).observe(document.getElementById('dashboard-view'));
