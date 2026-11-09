const cities = {
  Lisboa: { folder: 'Lisboa', suffix: 'lis', municipality: 'Lisboa' },
  Porto: { folder: 'Porto', suffix: 'por', municipality: 'PORTO' }
};
const cityButtons = document.querySelectorAll('.city');
const mapSection = document.getElementById('map-section');
const mapStatus = document.getElementById('map-status');
const parishName = document.getElementById('parish-name');
const clearButton = document.getElementById('clear-selection');
const resultCount = document.getElementById('result-count');
const listingList = document.getElementById('listing-list');
const mapElement = document.getElementById('map');
const resetButton = document.getElementById('reset-view');
const zoomInButton = document.getElementById('zoom-in');
const zoomOutButton = document.getElementById('zoom-out');
const previousButton = document.getElementById('previous-page');
const nextButton = document.getElementById('next-page');
const pageLabel = document.getElementById('page-label');
const listingScroll = document.getElementById('listing-scroll');
const densityLegend = document.getElementById('density-legend');
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

// NFC uniformiza acentos compostos/decompostos sem alterar os dados originais.
function nameKey(name) {
  return (name || '').normalize('NFC').trim();
}

function displayParish(name) {
  const key = nameKey(name);
  return parishNames[key] || key;
}

function sameName(a, b) {
  return nameKey(a) === nameKey(b);
}
const roomTypes = {
  'Entire home/apt': 'Alojamento inteiro',
  'Private room': 'Quarto privado',
  'Shared room': 'Quarto partilhado',
  'Hotel room': 'Quarto de hotel'
};
const pageSize = 10;
let selectedCity = null;
let selectedParish = null;
let listings = [];
let requestId = 0;
let filteredListings = [];
let currentPage = 0;
let currentGeoData = null;
let mapZoom = null;
let densityScale = null;

function prepareDensity(geoData) {
  const municipality = cities[selectedCity].municipality;
  const counts = d3.rollup(
    listings.filter(d => sameName(d.neighbourhood_group, municipality)),
    rows => rows.length,
    d => nameKey(d.neighbourhood)
  );
  geoData.features.forEach(function (feature) {
    // geoArea devolve esterradianos; R² converte para km², sem usar pixels Mercator.
    // Áreas verificadas independentemente: Lisboa ~99,96 km²; Porto ~41,36 km².
    const areaKm2 = d3.geoArea(feature) * 6371.0088 ** 2;
    if (!Number.isFinite(areaKm2) || areaKm2 <= 0 || areaKm2 > 1000) {
      throw new Error('Área inválida para ' + displayParish(feature.properties.neighbourhood));
    }
    const count = counts.get(nameKey(feature.properties.neighbourhood)) || 0;
    feature.metrics = { areaKm2: areaKm2, count: count, density: count / areaKm2 };
  });
  const extent = d3.extent(geoData.features, d => d.metrics.density);
  // A escala usa o mínimo e máximo da cidade atual e não muda ao selecionar.
  const domain = extent[0] === extent[1] ? [0, extent[1] || 1] : extent;
  densityScale = d3.scaleSequential()
    .domain(domain)
    .interpolator(d3.piecewise(d3.interpolateRgb, densityColors))
    .clamp(true);
  renderDensityLegend();
}

function renderDensityLegend() {
  const [min, max] = densityScale.domain();
  document.getElementById('legend-title').textContent = 'Densidade de anúncios · ' + selectedCity;
  document.getElementById('legend-gradient').style.background =
    'linear-gradient(to right, ' + densityColors.join(', ') + ')';
  const labels = document.getElementById('legend-values');
  labels.replaceChildren();
  densityColors.forEach(function (color, i) {
    const label = document.createElement('span');
    label.textContent = densityFormat.format(min + (max - min) * i / 3);
    labels.appendChild(label);
  });
  densityLegend.hidden = false;
}

function parishDescription(feature) {
  return displayParish(feature.properties.neighbourhood) + ' · ' +
    feature.metrics.count.toLocaleString('pt-PT') + ' anúncios · ' +
    densityFormat.format(feature.metrics.density) + ' anúncios/km²';
}

// O mesmo estado atualiza o destaque do mapa e os anúncios, como na aula 6.
function updateSelection() {
  d3.select('#map').selectAll('.parish')
    .classed('selected', d => sameName(d.properties.neighbourhood, selectedParish))
    .attr('aria-pressed', d => String(sameName(d.properties.neighbourhood, selectedParish)));
  d3.select('#map').selectAll('.parish.selected').raise();
  clearButton.disabled = selectedParish === null;
  const municipality = cities[selectedCity].municipality;
  filteredListings = listings.filter(d =>
    sameName(d.neighbourhood_group, municipality) &&
    (selectedParish === null || sameName(d.neighbourhood, selectedParish))
  );
  currentPage = 0;
  renderListings();
}

// Cada página contém, no máximo, dez cartões, mesmo com milhares de resultados.
function renderListings() {
  const area = selectedParish === null ? selectedCity : displayParish(selectedParish) + ' (' + selectedCity + ')';
  resultCount.textContent = filteredListings.length.toLocaleString('pt-PT') +
    ' anúncios encontrados em ' + area + '.';
  listingList.replaceChildren();
  const start = currentPage * pageSize;
  filteredListings.slice(start, start + pageSize).forEach(function (listing) {
    const item = document.createElement('li');
    item.className = 'listing-card';
    const name = document.createElement('h3');
    name.textContent = listing.name || 'Anúncio sem nome';
    const priceElement = document.createElement('p');
    priceElement.className = 'price';
    const price = Number.isFinite(listing.price) ? currency.format(listing.price) + ' / noite' : 'Preço indisponível';
    priceElement.textContent = price;
    const type = document.createElement('p');
    type.textContent = roomTypes[listing.room_type] || listing.room_type || 'Tipo indisponível';
    const parish = document.createElement('p');
    parish.textContent = 'Freguesia: ' + (displayParish(listing.neighbourhood) || 'Indisponível');
    item.append(name, priceElement, type, parish);
    listingList.appendChild(item);
  });
  if (filteredListings.length === 0) {
    const empty = document.createElement('li');
    empty.textContent = 'Não foram encontrados anúncios nesta freguesia.';
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
  updateSelection();
}

// Desenha apenas as freguesias do município escolhido, como na aula 4.
function drawMap(geoData) {
  const canvas = document.querySelector('.map-canvas');
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const margin = 24;
  const projection = d3.geoMercator().fitSize([width - margin * 2, height - margin * 2], geoData);
  const path = d3.geoPath().projection(projection);
  const svg = d3.select('#map');
  svg.attr('viewBox', '0 0 ' + width + ' ' + height);
  svg.selectAll('*').remove();
  const zoomLayer = svg.append('g');
  zoomLayer.append('g').attr('transform', 'translate(' + margin + ',' + margin + ')')
    .selectAll('path')
    .data(geoData.features)
    .join('path')
    .attr('class', 'parish')
    .style('--parish-color', d => densityScale(d.metrics.density))
    .attr('d', path)
    .attr('tabindex', 0)
    .attr('role', 'button')
    .attr('aria-label', parishDescription)
    .on('mouseenter focus', function (event, d) {
      parishName.textContent = parishDescription(d);
    })
    .on('mouseleave blur', function () {
      parishName.textContent = 'Passe o rato sobre uma freguesia para ver o nome. Clique para selecionar.';
    })
    .on('click', function (event, d) { selectParish(d); })
    .on('keydown', function (event, d) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectParish(d);
      }
    })
    .append('title').text(parishDescription);

  // O zoom transforma o grupo, mantendo as fronteiras com espessura constante.
  mapZoom = d3.zoom()
    .extent([[0, 0], [width, height]])
    .scaleExtent([1, 8])
    .translateExtent([[-width / 2, -height / 2], [width * 1.5, height * 1.5]])
    .on('zoom', function (event) {
      zoomLayer.attr('transform', event.transform);
    });
  svg.call(mapZoom).call(mapZoom.transform, d3.zoomIdentity);
}

function resetView() {
  if (mapZoom) d3.select('#map').call(mapZoom.transform, d3.zoomIdentity);
}

async function loadCity(city) {
  const currentRequest = ++requestId;
  selectedCity = city;
  selectedParish = null;
  listings = [];
  filteredListings = [];
  currentGeoData = null;
  densityScale = null;
  densityLegend.hidden = true;
  mapZoom = null;
  currentPage = 0;
  cityButtons.forEach(function (button) {
    button.setAttribute('aria-pressed', String(button.dataset.city === city));
  });
  mapSection.hidden = false;
  document.body.classList.add('has-dashboard');
  mapElement.setAttribute('hidden', '');
  mapElement.style.display = 'none';
  clearButton.disabled = true;
  resetButton.disabled = true;
  zoomInButton.disabled = true;
  zoomOutButton.disabled = true;
  previousButton.disabled = true;
  nextButton.disabled = true;
  pageLabel.textContent = '';
  resultCount.textContent = '';
  listingList.replaceChildren();
  parishName.textContent = 'Passe o rato sobre uma freguesia para ver o nome. Clique para selecionar.';
  document.getElementById('map-title').textContent = 'Freguesias de ' + city;
  mapStatus.textContent = 'A carregar mapa e anúncios…';
  mapSection.setAttribute('aria-busy', 'true');
  try {
    if (typeof d3 === 'undefined') throw new Error('Não foi possível carregar D3.js.');
    const config = cities[city];
    const base = '../dados/' + config.folder + '/';
    const [geoData, rows] = await Promise.all([
      d3.json(base + 'neighbourhoods-' + config.suffix + '.geojson'),
      d3.csv(base + 'listings-' + config.suffix + '.csv', function (d) {
        d.price = d.price.trim() === '' ? null : Number(d.price.replace(/[$,]/g, ''));
        d.latitude = d.latitude.trim() === '' ? null : Number(d.latitude);
        d.longitude = d.longitude.trim() === '' ? null : Number(d.longitude);
        return d;
      })
    ]);
    // Ignora respostas antigas se o utilizador mudar rapidamente de cidade.
    if (currentRequest !== requestId) return;
    const cityGeoData = {
      type: 'FeatureCollection',
      features: geoData.features.filter(d => sameName(d.properties.neighbourhood_group, config.municipality))
    };
    if (cityGeoData.features.length === 0) throw new Error('Município sem freguesias.');
    listings = rows;
    prepareDensity(cityGeoData);
    currentGeoData = cityGeoData;
    drawMap(cityGeoData);
    mapElement.removeAttribute('hidden');
    mapElement.style.display = 'block';
    mapElement.setAttribute('aria-label', 'Freguesias do concelho de ' + city);
    mapStatus.textContent = 'Selecione uma freguesia para filtrar os anúncios.';
    resetButton.disabled = false;
    zoomInButton.disabled = false;
    zoomOutButton.disabled = false;
    updateSelection();
  } catch (error) {
    if (currentRequest !== requestId) return;
    mapStatus.textContent = 'Não foi possível carregar os dados. Abra a página através de um servidor HTTP na pasta do projeto e verifique a ligação à Internet.';
    console.error(error);
  } finally {
    if (currentRequest === requestId) mapSection.setAttribute('aria-busy', 'false');
  }
}

cityButtons.forEach(function (button) {
  button.addEventListener('click', function () { loadCity(button.dataset.city); });
});
clearButton.addEventListener('click', function () {
  selectedParish = null;
  updateSelection();
  resetView();
});
resetButton.addEventListener('click', resetView);
zoomInButton.addEventListener('click', function () {
  if (mapZoom) d3.select('#map').call(mapZoom.scaleBy, 1.5);
});
zoomOutButton.addEventListener('click', function () {
  if (mapZoom) d3.select('#map').call(mapZoom.scaleBy, 1 / 1.5);
});
previousButton.addEventListener('click', function () {
  if (currentPage > 0) { currentPage--; renderListings(); }
});
nextButton.addEventListener('click', function () {
  if ((currentPage + 1) * pageSize < filteredListings.length) {
    currentPage++;
    renderListings();
  }
});

// Reajusta a projeção à área disponível ao redimensionar a janela.
new ResizeObserver(function () {
  if (currentGeoData) {
    drawMap(currentGeoData);
    d3.select('#map').selectAll('.parish')
      .classed('selected', d => sameName(d.properties.neighbourhood, selectedParish))
      .attr('aria-pressed', d => String(sameName(d.properties.neighbourhood, selectedParish)));
    d3.select('#map').selectAll('.parish.selected').raise();
  }
}).observe(document.querySelector('.map-canvas'));
