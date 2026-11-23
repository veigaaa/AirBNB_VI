const cities = {
  Lisboa: { folder: 'Lisboa', suffix: 'lis', municipality: 'Lisboa' },
  Porto: { folder: 'Porto', suffix: 'por', municipality: 'PORTO' }
};
const currency = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });
const densityFormat = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 });
const ratingFormat = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 });
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
const roomColors = {
  'Entire home/apt': '#246887', 'Private room': '#9460a8',
  'Shared room': '#bb7621', 'Hotel room': '#218575'
};
const scatterVariables = {
  accommodates: 'Capacidade de hóspedes', bedrooms: 'Número de quartos',
  review_scores_rating: 'Avaliação do alojamento (0–5)', number_of_reviews: 'Número de avaliações'
};
const comparisonColors = ['#7543a8', '#007f86', '#c34822'];
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
const minPriceInput = document.getElementById('min-price');
const parishInput = document.getElementById('parish-filter');
const bedroomInput = document.getElementById('bedrooms-filter');
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
let activeFilters = readFilters();
let comparedListings = [];
let chartMaximum = 1;

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
  d.minimum_nights = parseNumber(d.minimum_nights);
  return d;
}

function readFilters() {
  return {
    roomType: roomInput.value,
    minPrice: parseNumber(minPriceInput.value), maxPrice: parseNumber(priceInput.value),
    bedrooms: parseNumber(bedroomInput.value),
    guests: parseNumber(document.getElementById('guests-filter').value),
    rating: parseNumber(document.getElementById('rating-filter').value),
    nights: parseNumber(document.getElementById('nights-filter').value)
  };
}

function changeFilters() {
  priceInput.setCustomValidity('');
  const values = readFilters();
  if (values.minPrice !== null && values.maxPrice !== null && values.minPrice > values.maxPrice) {
    priceInput.setCustomValidity('O preço máximo deve ser igual ou superior ao preço mínimo.');
  }
  const invalid = document.querySelector('#filters :invalid');
  const error = document.getElementById('filter-error');
  error.hidden = !invalid;
  error.textContent = invalid ? invalid.validationMessage + ' Mantêm-se os últimos filtros válidos.' : '';
  if (invalid || !currentGeoData) return;
  activeFilters = values;
  priceRange = null;
  updateSelection();
}

function clearFilters() {
  document.querySelectorAll('#filters input, #filters select').forEach(function (input) { input.value = ''; });
  priceInput.setCustomValidity('');
  document.getElementById('filter-error').hidden = true;
  activeFilters = readFilters();
  priceRange = null;
  resetView();
}

function ratingText(d) {
  return Number.isFinite(d.review_scores_rating) ? ratingFormat.format(d.review_scores_rating) + ' / 5' : 'Indisponível';
}

function validCoordinates(d) {
  return Number.isFinite(d.latitude) && Math.abs(d.latitude) < 90 && Number.isFinite(d.longitude);
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
  ['home', 'dashboard', 'details', 'comparison'].forEach(function (name) {
    document.getElementById(name + '-view').hidden = name !== view;
  });
  document.body.classList.toggle('has-dashboard', view !== 'home');
  document.getElementById('go-home').hidden = view === 'home';
  hideTooltip();
  if (view === 'dashboard') document.getElementById('dashboard-title').focus();
  if (view === 'details') document.getElementById('details-title').focus();
  if (view === 'comparison') document.getElementById('comparison-title').focus();
  if (view === 'dashboard' && selectedListing) {
    const card = listingList.querySelector('.selected');
    if (card) listingScroll.scrollTop = Math.max(0, card.offsetTop - listingList.offsetTop);
  }
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
  return listings.filter(d =>
    (selectedParish === null || sameName(d.neighbourhood, selectedParish)) &&
    (activeFilters.roomType === '' || d.room_type === activeFilters.roomType) &&
    (activeFilters.minPrice === null || (d.price !== null && d.price >= activeFilters.minPrice)) &&
    (activeFilters.maxPrice === null || (d.price !== null && d.price <= activeFilters.maxPrice)) &&
    (activeFilters.bedrooms === null || d.bedrooms === activeFilters.bedrooms) &&
    (activeFilters.guests === null || (d.accommodates !== null && d.accommodates >= activeFilters.guests)) &&
    (activeFilters.rating === null || (d.review_scores_rating !== null && d.review_scores_rating >= activeFilters.rating)) &&
    (activeFilters.nights === null || (d.minimum_nights !== null && d.minimum_nights >= activeFilters.nights))
  );
}

// O mesmo conjunto filtrado alimenta a lista, o mapa e os dois gráficos.
function updateSelection() {
  hideTooltip();
  const base = baseListings();
  filteredListings = base.filter(d => priceRange === null ||
    (Number.isFinite(d.price) && d.price >= priceRange[0] && d.price <= priceRange[1]));
  if (selectedListing && !filteredListings.some(d => d.id === selectedListing.id)) selectedListing = null;
  sortListings();
  currentPage = 0;
  highlightParish();
  renderListings();
  drawListingPoints();
  renderCharts(base);
  parishInput.value = selectedParish || '';
  renderActiveFilters();
  renderIndicators();
  renderSelectedSummary();
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
    ' Os filtros excluem anúncios sem o atributo necessário. A densidade representa o total da cidade.';
}

function sortListings() {
  const order = document.getElementById('listing-sort').value;
  const field = order === 'rating-desc' ? 'review_scores_rating' : 'price';
  filteredListings.sort(function (a, b) {
    if (a[field] === null && b[field] === null) return a.id.localeCompare(b.id);
    if (a[field] === null) return 1;
    if (b[field] === null) return -1;
    return (order === 'price-asc' ? a[field] - b[field] : b[field] - a[field]) || a.id.localeCompare(b.id);
  });
}

function renderIndicators() {
  const prices = filteredListings.filter(d => Number.isFinite(d.price)).map(d => d.price);
  document.getElementById('indicator-count').textContent = filteredListings.length.toLocaleString('pt-PT');
  document.getElementById('indicator-median').textContent = prices.length ? currency.format(d3.median(prices)) : 'Indisponível';
  document.getElementById('indicator-mean').textContent = prices.length ? currency.format(d3.mean(prices)) : 'Indisponível';
}

function renderActiveFilters() {
  const labels = ['Cidade: ' + selectedCity];
  if (selectedParish) labels.push('Freguesia: ' + displayParish(selectedParish));
  if (activeFilters.roomType) labels.push(roomTypes[activeFilters.roomType] || activeFilters.roomType);
  if (activeFilters.minPrice !== null) labels.push('Preço ≥ ' + currency.format(activeFilters.minPrice));
  if (activeFilters.maxPrice !== null) labels.push('Preço ≤ ' + currency.format(activeFilters.maxPrice));
  if (activeFilters.bedrooms !== null) labels.push('Quartos: ' + activeFilters.bedrooms);
  if (activeFilters.guests !== null) labels.push('Capacidade ≥ ' + activeFilters.guests);
  if (activeFilters.rating !== null) labels.push('Avaliação ≥ ' + densityFormat.format(activeFilters.rating));
  if (activeFilters.nights !== null) labels.push('Estadia mínima ≥ ' + activeFilters.nights + ' noites');
  if (priceRange) labels.push('Histograma: ' + currency.format(priceRange[0]) + ' a ' + currency.format(priceRange[1]));
  d3.select('#active-filters').selectAll('li').data(labels).join('li').text(d => d);
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
    const characteristics = document.createElement('p');
    characteristics.textContent = 'Capacidade: ' + (listing.accommodates ?? 'Indisponível') +
      ' · Quartos: ' + (listing.bedrooms ?? 'Indisponível') + ' · Avaliação: ' + ratingText(listing);
    const actions = document.createElement('div');
    actions.className = 'card-actions';
    const locate = document.createElement('button');
    locate.type = 'button';
    locate.className = 'secondary';
    locate.textContent = 'Destacar no mapa';
    locate.disabled = !validCoordinates(listing);
    locate.addEventListener('click', function () { focusListing(listing); });
    const compare = document.createElement('button');
    compare.type = 'button';
    compare.className = 'secondary compare-toggle';
    compare.dataset.id = listing.id;
    compare.dataset.city = listing.city;
    compare.addEventListener('click', function () { toggleComparison(listing); });
    actions.append(locate, compare);
    item.append(name, price, type, parish, characteristics, actions);
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
  updateComparisonButtons();
}

function renderSelectedSummary() {
  document.getElementById('selected-summary').hidden = selectedListing === null;
  document.getElementById('selected-name').textContent = selectedListing ?
    'Selecionado: ' + (selectedListing.name || 'Anúncio sem nome') + ' · ' + listingPrice(selectedListing) : '';
  updateComparisonButtons();
}

function focusListing(listing) {
  const feature = currentGeoData.features.find(d => sameName(d.properties.neighbourhood, listing.neighbourhood));
  if (!feature) return;
  selectedListing = listing;
  selectedParish = feature.properties.neighbourhood;
  updateSelection();
  const index = filteredListings.findIndex(d => d.id === listing.id);
  currentPage = Math.max(0, Math.floor(index / pageSize));
  renderListings();
  showView('dashboard');
  zoomToParish(feature);
  document.getElementById('map-section').scrollIntoView({ block: 'start' });
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
  listings.forEach(function (d) { d.mapPoint = validCoordinates(d) ? projection([d.longitude, d.latitude]) : null; });
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
    .attr('cx', d => d.mapPoint[0])
    .attr('cy', d => d.mapPoint[1])
    .on('mousemove', function (event, d) { showTooltip(event, listingTooltip(d)); })
    .on('mouseleave', hideTooltip)
    .on('click', function (event, d) { event.stopPropagation(); openListing(d); });
  highlightListing();
}

function highlightListing() {
  d3.select('#map').selectAll('.listing-point')
    .classed('selected', d => selectedListing !== null && d.id === selectedListing.id);
  d3.select('#map').selectAll('.listing-point.selected').raise();
  d3.selectAll('.listing-point, .scatter-point')
    .classed('compared', d => comparisonEntry(d) !== undefined)
    .style('--comparison-color', d => comparisonEntry(d)?.color || null);
  d3.select('#scatterplot').selectAll('.scatter-point')
    .classed('selected', d => selectedListing !== null && d.id === selectedListing.id)
    .attr('r', d => selectedListing !== null && d.id === selectedListing.id ? 5 : 2.7);
  d3.select('#scatterplot').selectAll('.scatter-point.selected').raise();
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
  if (selectedParish === null) focusListing(listing);
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
    ['Capacidade de hóspedes', listing.accommodates],
    ['Número de quartos', listing.bedrooms],
    ['Avaliação do alojamento', ratingText(listing)],
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
  document.getElementById('details-locate').disabled = !validCoordinates(listing);
  renderSelectedSummary();
  showView('details');
}

function listingTooltip(d) {
  return (d.name || 'Anúncio sem nome') + '\n' + listingPrice(d) + '\n' +
    (roomTypes[d.room_type] || d.room_type) + ' · ' + displayParish(d.neighbourhood) + '\n' +
    'Capacidade: ' + (d.accommodates ?? 'Indisponível') + ' · Quartos: ' + (d.bedrooms ?? 'Indisponível') + '\n' +
    'Avaliação: ' + ratingText(d) + ' · ' + (d.number_of_reviews ?? 'Indisponível') + ' avaliações\nClique para detalhes e comparação.';
}

function comparisonEntry(listing) {
  return comparedListings.find(d => d.listing.id === listing.id && d.listing.city === listing.city);
}

function updateComparisonButtons() {
  const count = comparedListings.length;
  const open = document.getElementById('compare-open');
  open.textContent = 'Comparar (' + count + ')';
  open.disabled = count === 0;
  document.querySelectorAll('.compare-toggle').forEach(function (button) {
    const entry = comparedListings.find(d => d.listing.id === button.dataset.id && d.listing.city === button.dataset.city);
    button.textContent = entry ? 'Remover da comparação' : 'Adicionar à comparação';
    button.disabled = !entry && count === 3;
    button.setAttribute('aria-pressed', String(Boolean(entry)));
  });
  ['selected-compare', 'details-compare'].forEach(function (id) {
    const button = document.getElementById(id);
    const entry = selectedListing ? comparisonEntry(selectedListing) : null;
    button.textContent = entry ? 'Remover da comparação' : 'Adicionar à comparação';
    button.disabled = !selectedListing || (!entry && count === 3);
    button.setAttribute('aria-pressed', String(Boolean(entry)));
  });
}

function toggleComparison(listing) {
  const entry = comparisonEntry(listing);
  if (entry) {
    comparedListings = comparedListings.filter(d => d !== entry);
  } else {
    if (comparedListings.length === 3) {
      document.getElementById('comparison-status').textContent = 'Pode comparar até três alojamentos. Remova um antes de adicionar outro.';
      return;
    }
    const color = comparisonColors.find(color => !comparedListings.some(d => d.color === color));
    comparedListings.push({ listing: listing, color: color });
  }
  document.getElementById('comparison-status').textContent = comparedListings.length +
    ' de 3 alojamentos selecionados para comparação.';
  updateComparisonButtons();
  highlightListing();
  if (currentGeoData) renderHistogram(chartMaximum);
  if (currentView === 'comparison') renderComparison();
}

function renderComparison() {
  const grid = document.getElementById('comparison-grid');
  grid.replaceChildren();
  document.getElementById('comparison-empty').textContent = comparedListings.length < 2 ?
    'Regresse ao dashboard e selecione pelo menos dois alojamentos para comparar.' : '';
  comparedListings.forEach(function (entry) {
    const d = entry.listing;
    const card = document.createElement('article');
    card.className = 'comparison-card';
    card.style.setProperty('--comparison-color', entry.color);
    const name = document.createElement('h2');
    name.textContent = d.name || 'Anúncio sem nome';
    const fields = document.createElement('dl');
    [
      ['Cidade', d.city], ['Preço por noite', Number.isFinite(d.price) ? currency.format(d.price) : null],
      ['Freguesia', displayParish(d.neighbourhood)], ['Tipo de alojamento', roomTypes[d.room_type] || d.room_type],
      ['Capacidade de hóspedes', d.accommodates], ['Número de quartos', d.bedrooms],
      ['Avaliação', ratingText(d)], ['Número de avaliações', d.number_of_reviews]
    ].forEach(function (field) {
      const label = document.createElement('dt');
      const value = document.createElement('dd');
      label.textContent = field[0];
      value.textContent = field[1] == null || field[1] === '' ? 'Indisponível' : field[1];
      fields.append(label, value);
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'secondary';
    remove.textContent = 'Remover da comparação';
    remove.addEventListener('click', function () { toggleComparison(d); });
    card.append(name, fields, remove);
    grid.appendChild(card);
  });
}

function setLoading(loading) {
  document.getElementById('map-section').setAttribute('aria-busy', String(loading));
  [resetButton, document.getElementById('zoom-in'), document.getElementById('zoom-out'),
    ...document.querySelectorAll('#filters input, #filters select, #filters button, #listing-sort')].forEach(function (control) {
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
  document.querySelectorAll('#filters input, #filters select').forEach(function (input) { input.value = ''; });
  priceInput.setCustomValidity('');
  activeFilters = readFilters();
  document.getElementById('filter-error').hidden = true;
  document.getElementById('listing-sort').value = 'price-asc';
  document.getElementById('scatter-variable').value = 'accommodates';
  document.getElementById('show-extremes').checked = false;
  document.getElementById('active-filters').replaceChildren();
  document.getElementById('selected-summary').hidden = true;
  ['indicator-count', 'indicator-median', 'indicator-mean'].forEach(function (id) {
    document.getElementById(id).textContent = '—';
  });
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
    const base = '../../dados/' + config.folder + '/';
    // Guarda a promessa para reutilizar também carregamentos ainda em curso.
    if (!cityCache[city]) {
      cityCache[city] = Promise.all([
        d3.json(base + 'neighbourhoods-' + config.suffix + '.geojson'),
        d3.csv(base + 'listings-' + config.suffix + '.csv', prepareListing),
        d3.csv(base + 'atributos-' + config.suffix + '.csv')
      ]).catch(function (error) { delete cityCache[city]; throw error; });
    }
    const [geoData, rows, attributes] = await cityCache[city];
    if (currentRequest !== requestId) return;
    const cityGeoData = {
      type: 'FeatureCollection',
      features: geoData.features.filter(d => sameName(d.properties.neighbourhood_group, config.municipality))
    };
    if (cityGeoData.features.length === 0) throw new Error('Município sem freguesias.');
    listings = rows.filter(d => sameName(d.neighbourhood_group, config.municipality));
    const extraById = new Map(attributes.map(d => [d.id, d]));
    listings.forEach(function (d) {
      const extra = extraById.get(d.id);
      d.city = city;
      d.accommodates = parseNumber(extra?.accommodates);
      d.bedrooms = parseNumber(extra?.bedrooms);
      d.review_scores_rating = parseNumber(extra?.review_scores_rating);
      if (d.review_scores_rating > 5) d.review_scores_rating = null;
    });
    const types = Array.from(new Set(listings.map(d => d.room_type))).sort();
    roomInput.replaceChildren(new Option('Todos os tipos', ''));
    types.forEach(function (type) { roomInput.add(new Option(roomTypes[type] || type, type)); });
    parishInput.replaceChildren(new Option('Todas as freguesias', ''));
    cityGeoData.features.slice().sort((a, b) => displayParish(a.properties.neighbourhood).localeCompare(displayParish(b.properties.neighbourhood), 'pt-PT'))
      .forEach(function (feature) {
        const name = feature.properties.neighbourhood;
        parishInput.add(new Option(displayParish(name), name));
      });
    bedroomInput.replaceChildren(new Option('Qualquer número', ''));
    Array.from(new Set(listings.map(d => d.bedrooms).filter(Number.isFinite))).sort(d3.ascending)
      .forEach(function (value) { bedroomInput.add(new Option(value === 0 ? '0 (estúdio)' : String(value), value)); });
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
    .call(d3.axisBottom(x).ticks(width < 400 ? 4 : 6).tickFormat(function (value) {
      const field = document.getElementById('scatter-variable').value;
      if (id === 'scatterplot' && field !== 'review_scores_rating' && !Number.isInteger(value)) return '';
      return densityFormat.format(value);
    }));
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
  chartMaximum = d3.scaleLinear().domain([0, Math.max(1, limit)]).nice().domain()[1];
  renderHistogram(chartMaximum);
  renderScatterplot(chartMaximum);
}

function renderHistogram(maximum) {
  const valid = filteredListings.filter(d => Number.isFinite(d.price));
  const visible = valid.filter(d => d.price <= maximum);
  const x = d3.scaleLinear().domain([0, maximum]);
  const thresholds = x.ticks(18).filter(value => value > 0 && value < maximum);
  const bins = d3.bin().value(d => d.price).domain(x.domain()).thresholds(thresholds)(visible);
  const y = d3.scaleLinear().domain([0, Math.max(1, d3.max(bins, d => d.length))]).nice();
  const frame = chartFrame('histogram', x, y, 'Preço por noite (€)', 'Número de anúncios');
  frame.svg.selectAll('.bar-layer').data([null]).join('g').attr('class', 'bar-layer')
    .selectAll('rect').data(bins).join('rect').attr('class', 'histogram-bar')
    .attr('x', d => x(d.x0) + 1).attr('y', d => y(d.length))
    .attr('width', d => Math.max(0, x(d.x1) - x(d.x0) - 1))
    .attr('height', d => y(0) - y(d.length));
  const median = d3.median(valid, d => d.price);
  frame.svg.selectAll('.median-line').data(Number.isFinite(median) && median <= maximum ? [median] : []).join('line')
    .attr('class', 'median-line').attr('x1', d => x(d)).attr('x2', d => x(d))
    .attr('y1', frame.margin.top).attr('y2', y(0));
  document.getElementById('histogram-median').textContent = Number.isFinite(median) ?
    'Mediana dos preços filtrados: ' + currency.format(median) + (median > maximum ? ' (fora da escala).' : ' · linha tracejada.') :
    'Mediana indisponível: não existem preços para estes filtros.';
  renderComparisonMarks(frame, x, maximum);
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
  brushLayer.raise();
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

function renderComparisonMarks(frame, x, maximum) {
  const entries = comparedListings.filter(d => d.listing.city === selectedCity);
  const marks = entries.filter(d => Number.isFinite(d.listing.price) && d.listing.price <= maximum);
  frame.svg.selectAll('.comparison-mark').data(marks, d => d.listing.id).join('line')
    .attr('class', 'comparison-mark').attr('stroke', d => d.color)
    .attr('x1', d => x(d.listing.price)).attr('x2', d => x(d.listing.price))
    .attr('y1', frame.height - frame.margin.bottom - 13).attr('y2', frame.height - frame.margin.bottom + 4);
  const legend = document.getElementById('comparison-marks');
  legend.replaceChildren();
  entries.forEach(function (entry) {
    const item = document.createElement('li');
    const swatch = document.createElement('span');
    swatch.className = 'legend-swatch';
    swatch.style.backgroundColor = entry.color;
    swatch.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.textContent = (entry.listing.name || 'Anúncio sem nome') + ' · ' + listingPrice(entry.listing) +
      (entry.listing.price > maximum ? ' (fora da escala)' : '') +
      (!filteredListings.some(d => d.id === entry.listing.id) ? ' · fora dos filtros' : '');
    item.append(swatch, text);
    legend.appendChild(item);
  });
}

function renderScatterplot(maximum) {
  const field = document.getElementById('scatter-variable').value;
  const valid = filteredListings.filter(d => Number.isFinite(d.price) && Number.isFinite(d[field]));
  const values = valid.map(d => d[field]).sort(d3.ascending);
  const showAll = document.getElementById('show-extremes').checked;
  const limit = values.length ? (showAll ? d3.max(values) : d3.quantileSorted(values, 0.99)) : 1;
  const xMaximum = field === 'review_scores_rating' ? 5 : d3.scaleLinear().domain([0, Math.max(1, limit)]).nice().domain()[1];
  const visible = valid.filter(d => d.price <= maximum && d[field] <= xMaximum);
  const x = d3.scaleLinear().domain([0, xMaximum]);
  const y = d3.scaleLinear().domain([0, maximum]);
  const frame = chartFrame('scatterplot', x, y, scatterVariables[field], 'Preço por noite (€)');
  frame.svg.attr('aria-label', 'Preço por noite e ' + scatterVariables[field]);
  document.getElementById('scatter-help').textContent =
    (field === 'number_of_reviews' ? 'O número de avaliações não representa diretamente reservas ou ocupação. ' : '') +
    'Clique num ponto para consultar detalhes e adicionar à comparação.';
  frame.svg.selectAll('.scatter-layer').data([null]).join('g').attr('class', 'scatter-layer')
    .selectAll('circle').data(visible, d => d.id).join('circle')
    .attr('class', 'scatter-point').attr('r', 2.7)
    .style('fill', d => roomColors[d.room_type] || '#646b70')
    .attr('cx', d => x(d[field])).attr('cy', d => y(d.price))
    .on('mousemove', function (event, d) {
      showTooltip(event, listingTooltip(d));
    }).on('mouseleave', hideTooltip)
    .on('click', function (event, d) { openListing(d); });
  emptyChart(frame, visible.length === 0);
  document.getElementById('scatterplot-note').textContent = visible.length.toLocaleString('pt-PT') +
    ' anúncios no gráfico · ' + (filteredListings.length - valid.length).toLocaleString('pt-PT') +
    ' sem preço ou característica selecionada · ' + (valid.length - visible.length).toLocaleString('pt-PT') +
    ' fora da escala. Preço até ' + currency.format(maximum) + '; eixo X até ' + densityFormat.format(xMaximum) +
    (showAll ? '.' : ' (limites baseados nos percentis 95 do preço e 99 da característica; avaliação de 0 a 5).') +
    ' Os anúncios fora da escala mantêm-se na lista.';
  const legend = document.getElementById('room-legend');
  legend.replaceChildren();
  Object.keys(roomTypes).filter(type => listings.some(d => d.room_type === type)).forEach(function (type) {
    const item = document.createElement('li');
    const swatch = document.createElement('span');
    swatch.className = 'legend-swatch';
    swatch.style.backgroundColor = roomColors[type];
    swatch.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.textContent = roomTypes[type];
    item.append(swatch, label);
    legend.appendChild(item);
  });
  highlightListing();
}

document.querySelectorAll('.city').forEach(function (button) {
  button.addEventListener('click', function () { loadCity(button.dataset.city); });
});
document.getElementById('city-select').addEventListener('change', function () { loadCity(this.value); });
document.getElementById('go-home').addEventListener('click', function () { showView('home'); });
document.getElementById('back-dashboard').addEventListener('click', function () { showView('dashboard'); });
document.getElementById('filters').addEventListener('submit', function (event) { event.preventDefault(); });
document.querySelectorAll('#filters input').forEach(function (input) { input.addEventListener('input', changeFilters); });
roomInput.addEventListener('change', changeFilters);
bedroomInput.addEventListener('change', changeFilters);
parishInput.addEventListener('change', function () {
  selectedParish = parishInput.value || null;
  selectedListing = null;
  updateSelection();
  if (selectedParish) zoomToParish(selectedFeature());
  else d3.select('#map').call(mapZoom.transform, d3.zoomIdentity);
});
document.getElementById('clear-filters').addEventListener('click', clearFilters);
document.getElementById('listing-sort').addEventListener('change', function () {
  sortListings();
  currentPage = 0;
  renderListings();
});
document.getElementById('scatter-variable').addEventListener('change', function () { hideTooltip(); renderScatterplot(chartMaximum); });
document.getElementById('show-extremes').addEventListener('change', function () { renderCharts(baseListings()); });
document.getElementById('clear-price-range').addEventListener('click', function () { priceRange = null; updateSelection(); });
document.getElementById('compare-open').addEventListener('click', function () { renderComparison(); showView('comparison'); });
document.getElementById('comparison-back').addEventListener('click', function () { showView('dashboard'); });
document.getElementById('selected-details').addEventListener('click', function () { if (selectedListing) openListing(selectedListing); });
document.getElementById('details-locate').addEventListener('click', function () { if (selectedListing) focusListing(selectedListing); });
['selected-compare', 'details-compare'].forEach(function (id) {
  document.getElementById(id).addEventListener('click', function () { if (selectedListing) toggleComparison(selectedListing); });
});
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
