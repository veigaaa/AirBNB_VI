const cities = {
  Lisboa: { folder: 'Lisboa', suffix: 'lis', municipality: 'Lisboa' },
  Porto: { folder: 'Porto', suffix: 'por', municipality: 'PORTO' }
};
const currency = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });
const densityFormat = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 });
const ratingFormat = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 });
const densityColors = ['#27964b', '#80bf59', '#c4d96a', '#f5d547', '#f5a23a', '#e96a32', '#cf3435'];
// As 31 freguesias vão de 9,5 a 1439,4 anúncios/km²; 24 ficam abaixo de 300.
// Os mesmos limiares distinguem melhor os valores baixos nas duas cidades.
const densityThresholds = [25, 50, 100, 250, 500, 1000];
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
let histogram = null;

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
  densityScale = d3.scaleThreshold().domain(densityThresholds).range(densityColors);
  renderDensityLegend();
}

function renderDensityLegend() {
  document.getElementById('legend-title').textContent = 'Densidade de alojamentos · anúncios/km²';
  const labels = document.getElementById('legend-values');
  labels.replaceChildren();
  densityColors.forEach(function (color) {
    const [lower, upper] = densityScale.invertExtent(color);
    const item = document.createElement('li');
    const swatch = document.createElement('span');
    swatch.className = 'legend-swatch';
    swatch.style.backgroundColor = color;
    swatch.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.textContent = upper === undefined ? densityFormat.format(lower) + ' ou mais' :
      densityFormat.format(lower ?? 0) + ' a menos de ' + densityFormat.format(upper);
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
  d3.select('#map').selectAll('.parish.selected').raise();
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
function updateSelection(keepHistogram = false) {
  hideTooltip();
  document.getElementById('selection-status').textContent = '';
  const base = keepHistogram && histogram ? histogram.base : baseListings();
  filteredListings = base.filter(d => priceRange === null ||
    (Number.isFinite(d.price) && d.price >= priceRange[0] && d.price <= priceRange[1]));
  if (selectedListing && !filteredListings.some(d => d.id === selectedListing.id)) {
    selectedListing = null;
    document.getElementById('selection-status').textContent = 'O alojamento selecionado deixou de cumprir os filtros. A seleção foi removida.';
  }
  sortListings();
  currentPage = selectedListing ? Math.floor(filteredListings.findIndex(d => d.id === selectedListing.id) / pageSize) : 0;
  highlightParish();
  renderListings();
  drawListingPoints();
  if (keepHistogram && histogram) {
    updateHistogramSelection();
    renderScatterplot(chartMaximum);
  } else {
    renderCharts(base);
  }
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
  selectListing(listing);
  showView('dashboard');
  document.getElementById('map-section').scrollIntoView({ block: 'start' });
}

function selectListing(listing) {
  const feature = currentGeoData.features.find(d => sameName(d.properties.neighbourhood, listing.neighbourhood));
  if (!feature || !filteredListings.some(d => d.id === listing.id)) return;
  const parishChanged = !sameName(selectedParish, feature.properties.neighbourhood);
  selectedListing = listing;
  document.getElementById('selection-status').textContent = '';
  if (parishChanged) {
    selectedParish = feature.properties.neighbourhood;
    updateSelection();
    zoomToParish(feature);
  } else {
    currentPage = Math.floor(filteredListings.findIndex(d => d.id === listing.id) / pageSize);
    renderListings();
    highlightListing();
    renderSelectedSummary();
    renderHistogramMarks();
  }
  const card = listingList.querySelector('.selected');
  if (card) listingScroll.scrollTop = Math.max(0, card.offsetTop - listingList.offsetTop);
}

function clearListing() {
  selectedListing = null;
  document.getElementById('selection-status').textContent = 'Seleção do alojamento removida.';
  renderListings();
  highlightListing();
  renderSelectedSummary();
  renderHistogramMarks();
}

function selectParish(feature) {
  selectedParish = feature.properties.neighbourhood;
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
    .on('click', function (event, d) { event.stopPropagation(); selectListing(d); });
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
    .attr('r', scatterRadius);
  d3.select('#scatterplot').selectAll('.scatter-point.compared').raise();
  d3.select('#scatterplot').selectAll('.scatter-point.selected').raise();
  resizePoints(d3.zoomTransform(mapElement).k);
}

function resetView() {
  if (!currentGeoData) return;
  selectedParish = null;
  selectedListing = null;
  document.getElementById('selection-status').textContent = '';
  updateSelection();
  d3.select('#map').call(mapZoom.transform, d3.zoomIdentity);
}

function openListing(listing) {
  selectListing(listing);
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

function listingTooltip(d, field) {
  const description = (d.name || 'Anúncio sem nome') + '\n' + listingPrice(d) + '\n' +
    (roomTypes[d.room_type] || d.room_type) + ' · ' + displayParish(d.neighbourhood) + '\n';
  if (field) return description + scatterVariables[field] + ': ' +
    (field === 'review_scores_rating' ? ratingText(d) : (d[field] ?? 'Indisponível')) + '\nClique para selecionar.';
  return description +
    'Capacidade: ' + (d.accommodates ?? 'Indisponível') + ' · Quartos: ' + (d.bedrooms ?? 'Indisponível') + '\n' +
    'Avaliação: ' + ratingText(d) + ' · ' + (d.number_of_reviews ?? 'Indisponível') + ' avaliações\nClique para selecionar.';
}

function comparisonEntry(listing) {
  return comparedListings.find(d => d.listing.id === listing.id && d.listing.city === listing.city);
}

function updateComparisonButtons() {
  const count = comparedListings.length;
  const open = document.getElementById('compare-open');
  open.textContent = 'Comparar (' + count + ')';
  open.disabled = count < 2;
  open.title = count < 2 ? 'Selecione pelo menos dois alojamentos para comparar.' : 'Comparar os alojamentos selecionados';
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
    ' de 3 alojamentos selecionados para comparação.' + (comparedListings.length === 1 ? ' Selecione mais um para comparar.' : '');
  updateComparisonButtons();
  highlightListing();
  renderHistogramMarks();
  if (currentView === 'comparison') {
    renderComparison();
    if (comparedListings.length < 2) showView('dashboard');
  }
}

function renderComparison() {
  const grid = document.getElementById('comparison-grid');
  grid.replaceChildren();
  document.getElementById('comparison-empty').textContent = comparedListings.length < 2 ?
    'Regresse ao dashboard e selecione pelo menos dois alojamentos para comparar.' : '';
  if (comparedListings.length < 2) return;
  const lowestPrice = d3.min(comparedListings.filter(d => Number.isFinite(d.listing.price)), d => d.listing.price);
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
      const row = document.createElement('div');
      row.className = 'comparison-field';
      const label = document.createElement('dt');
      const value = document.createElement('dd');
      label.textContent = field[0];
      value.textContent = field[1] == null || field[1] === '' ? 'Indisponível' : field[1];
      if (field[0] === 'Preço por noite' && Number.isFinite(d.price) && d.price === lowestPrice) {
        value.className = 'lowest-price';
        const badge = document.createElement('span');
        badge.className = 'lowest-price-label';
        badge.textContent = 'Menor preço disponível';
        value.appendChild(badge);
      }
      row.append(label, value);
      fields.appendChild(row);
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
  histogram = null;
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
  document.getElementById('selection-status').textContent = '';
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
        d3.csv(base + 'listings-' + config.suffix + '.csv', prepareListing),
        d3.csv('../teste2/atributos-' + config.suffix + '.csv')
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
  renderHistogram(chartMaximum, base);
  renderScatterplot(chartMaximum);
}

function renderHistogram(maximum, base) {
  // As barras usam os filtros anteriores ao brush, preservando a referência.
  const valid = base.filter(d => Number.isFinite(d.price));
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
  emptyChart(frame, visible.length === 0);
  const missing = base.length - valid.length;
  const outside = valid.length - visible.length;
  document.getElementById('histogram-note').textContent =
    'Referência antes do intervalo: ' + visible.length.toLocaleString('pt-PT') + ' anúncios representados · ' + missing.toLocaleString('pt-PT') +
    ' sem preço · ' + outside.toLocaleString('pt-PT') + ' acima de ' + currency.format(maximum) +
    '. Os valores fora da escala continuam na lista e no mapa. ' +
    (document.getElementById('show-extremes').checked ? 'Escala com todos os preços.' : 'Limite visual baseado no percentil 95.') +
    ' As percentagens referem-se aos anúncios representados nas barras.';
  const brush = d3.brushX()
    .extent([[frame.margin.left, frame.margin.top], [frame.width - frame.margin.right, frame.height - frame.margin.bottom]])
    .on('end', function (event) {
      if (!event.sourceEvent) return;
      priceRange = event.selection && event.selection[1] - event.selection[0] >= 2 ? event.selection.map(x.invert) : null;
      updateSelection(true);
    });
  const brushLayer = frame.svg.selectAll('.brush').data([null]).join('g').attr('class', 'brush').call(brush);
  brushLayer.raise();
  histogram = { frame: frame, x: x, maximum: maximum, brush: brush, base: base };
  updateHistogramSelection();
  frame.svg.on('mousemove', function (event) {
    const position = d3.pointer(event, this);
    if (position[0] < frame.margin.left || position[0] > frame.width - frame.margin.right ||
      position[1] < frame.margin.top || position[1] > frame.height - frame.margin.bottom) { hideTooltip(); return; }
    const value = x.invert(position[0]);
    const bin = bins.find(d => value >= d.x0 && (value < d.x1 || (value === d.x1 && d.x1 === maximum)));
    if (bin) showTooltip(event, currency.format(bin.x0) + ' a ' + currency.format(bin.x1) +
      (bin.x1 === maximum ? ' (inclusive)' : ' (limite superior exclusivo)') + '\n' + bin.length.toLocaleString('pt-PT') + ' anúncios\n' +
      densityFormat.format(visible.length ? 100 * bin.length / visible.length : 0) + '% dos anúncios representados');
  }).on('mouseleave', hideTooltip);
}

function updateHistogramSelection() {
  if (!histogram) return;
  const { frame, x, maximum, brush } = histogram;
  frame.svg.selectAll('.histogram-bar').classed('outside-range', d => priceRange !== null &&
    !(d.x1 > priceRange[0] && d.x0 <= priceRange[1]) && !(d.x1 === maximum && d.x1 === priceRange[0]));
  const median = d3.median(filteredListings.filter(d => Number.isFinite(d.price)), d => d.price);
  const medianVisible = Number.isFinite(median) && median <= maximum;
  frame.svg.selectAll('.median-line').data(medianVisible ? [median] : []).join('line')
    .attr('class', 'median-line').attr('x1', d => x(d)).attr('x2', d => x(d))
    .attr('y1', frame.margin.top).attr('y2', frame.height - frame.margin.bottom);
  frame.svg.selectAll('.median-annotation').data(medianVisible ? [median] : []).join('text')
    .attr('class', 'median-annotation').attr('x', d => x(d)).attr('y', 14)
    .attr('text-anchor', medianVisible && x(median) > frame.width / 2 ? 'end' : 'start')
    .text(d => 'Mediana: ' + currency.format(d));
  document.getElementById('histogram-median').textContent = Number.isFinite(median) ?
    'Mediana dos anúncios filtrados: ' + currency.format(median) + (median > maximum ? ' (fora da escala).' : ' · linha tracejada.') :
    'Mediana indisponível: não existem preços para estes filtros.';
  frame.svg.select('.brush').call(brush.move, priceRange ? priceRange.map(value => x(Math.max(0, Math.min(maximum, value)))) : null);
  renderHistogramMarks();
}

function renderHistogramMarks() {
  if (!histogram) return;
  const { frame, x, maximum } = histogram;
  renderComparisonMarks(frame, x, maximum);
  const listing = selectedListing;
  const visible = listing !== null && Number.isFinite(listing.price) && listing.price <= maximum;
  frame.svg.selectAll('.selection-price-mark').data(visible ? [listing] : []).join('line')
    .attr('class', 'selection-price-mark').style('stroke', d => comparisonEntry(d)?.color || '#b7472d')
    .attr('x1', d => x(d.price)).attr('x2', d => x(d.price))
    .attr('y1', frame.margin.top).attr('y2', frame.height - frame.margin.bottom);
  const label = document.getElementById('histogram-selection');
  label.hidden = listing === null;
  label.style.color = listing ? (comparisonEntry(listing)?.color || '#943f2b') : '';
  label.textContent = listing ? 'Selecionado: ' + (listing.name || 'Anúncio sem nome') + ' · ' + listingPrice(listing) +
    (listing.price > maximum ? ' (fora da escala)' : '') : '';
  frame.svg.select('.brush').raise();
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
  const discrete = field === 'accommodates' || field === 'bedrooms';
  const jitter = discrete ? Math.min(6, (x(1) - x(0)) * 0.12) : 0;
  document.getElementById('scatter-help').textContent =
    (field === 'number_of_reviews' ? 'O número de avaliações não representa diretamente reservas ou ocupação. ' : '') +
    (discrete ? 'Pequenos desvios horizontais separam os pontos; os valores reais aparecem no tooltip. ' : '') +
    'Clique num ponto para o selecionar no mapa e na lista.';
  frame.svg.selectAll('.scatter-layer').data([null]).join('g').attr('class', 'scatter-layer')
    .selectAll('circle').data(visible, d => d.id).join('circle')
    .attr('class', 'scatter-point').attr('r', scatterRadius)
    .style('fill', d => roomColors[d.room_type] || '#646b70')
    .attr('cx', function (d) {
      const position = x(d[field]);
      return discrete ? Math.max(frame.margin.left + 2, Math.min(frame.width - frame.margin.right - 2,
        position + scatterJitter(d.id) * jitter)) : position;
    }).attr('cy', d => y(d.price))
    .on('mouseenter', function () { d3.select(this).classed('hovered', true).attr('r', 5).raise(); })
    .on('mousemove', function (event, d) {
      showTooltip(event, listingTooltip(d, field));
    }).on('mouseleave', function () {
      d3.select(this).classed('hovered', false).attr('r', scatterRadius);
      hideTooltip();
    }).on('click', function (event, d) { selectListing(d); });
  emptyChart(frame, visible.length === 0);
  document.getElementById('scatterplot-note').textContent = visible.length.toLocaleString('pt-PT') +
    ' anúncios no gráfico · ' + (filteredListings.length - valid.length).toLocaleString('pt-PT') +
    ' sem preço ou característica selecionada · ' + (valid.length - visible.length).toLocaleString('pt-PT') +
    ' fora da escala. Preço até ' + currency.format(maximum) + '; eixo X até ' + densityFormat.format(xMaximum) +
    (showAll ? '.' : ' (limites baseados nos percentis 95 do preço e 99 da característica; avaliação de 0 a 5).') +
    ' Os anúncios fora da escala mantêm-se na lista.';
  const types = Object.keys(roomTypes).filter(type => listings.some(d => d.room_type === type));
  const legend = d3.select('#room-legend').selectAll('li').data(types).join('li');
  legend.selectAll('.legend-swatch').data(type => [type]).join('span').attr('class', 'legend-swatch')
    .style('background-color', type => roomColors[type]).attr('aria-hidden', 'true');
  legend.selectAll('.legend-label').data(type => [type]).join('span').attr('class', 'legend-label')
    .text(type => roomTypes[type]);
  highlightListing();
}

function scatterRadius(d) {
  return selectedListing && d.id === selectedListing.id ? 5 : (comparisonEntry(d) ? 3 : 2);
}

function scatterJitter(id) {
  // O id mantém o desvio visual estável, sem modificar os dados do anúncio.
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return ((hash % 1001) / 1000 - 0.5) * 2;
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
  updateSelection();
  if (selectedParish) zoomToParish(selectedFeature());
  else d3.select('#map').call(mapZoom.transform, d3.zoomIdentity);
});
document.getElementById('clear-filters').addEventListener('click', clearFilters);
document.getElementById('listing-sort').addEventListener('change', function () {
  sortListings();
  currentPage = selectedListing ? Math.floor(filteredListings.findIndex(d => d.id === selectedListing.id) / pageSize) : 0;
  renderListings();
});
document.getElementById('scatter-variable').addEventListener('change', function () { hideTooltip(); renderScatterplot(chartMaximum); });
document.getElementById('show-extremes').addEventListener('change', function () { renderCharts(baseListings()); });
document.getElementById('clear-price-range').addEventListener('click', function () { priceRange = null; updateSelection(true); });
document.getElementById('compare-open').addEventListener('click', function () {
  if (comparedListings.length < 2) return;
  renderComparison();
  showView('comparison');
});
document.getElementById('comparison-back').addEventListener('click', function () { showView('dashboard'); });
document.getElementById('selected-details').addEventListener('click', function () { if (selectedListing) openListing(selectedListing); });
document.getElementById('clear-listing').addEventListener('click', clearListing);
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
  const width = Math.max(260, document.getElementById('histogram').clientWidth);
  if (!histogram || histogram.frame.width !== width) renderCharts(baseListings());
}).observe(document.getElementById('dashboard-view'));

// Abre a informação sem perder os filtros nem a seleção atual.
document.getElementById('about-data').addEventListener('click', function (event) {
  event.preventDefault();
  const info = document.getElementById('data-info');
  info.open = true;
  info.querySelector('summary').focus();
  info.scrollIntoView({ block: 'start' });
});
