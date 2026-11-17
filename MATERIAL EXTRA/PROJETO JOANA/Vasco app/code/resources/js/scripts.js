
function initializeHistogram() {
    const container = d3.select("#histogram");

    function getDimensions() {
        const containerWidth = container.node().getBoundingClientRect().width;
        const containerHeight = container.node().getBoundingClientRect().height;
    
        const margin = {
            top: containerHeight * 0.15,    
            right: containerWidth * 0.05,   
            bottom: containerHeight * 0.3,  
            left: containerWidth * 0.07      
        };
    
        const width = containerWidth - margin.left - margin.right;
        const height = containerHeight - margin.top - margin.bottom;
    
        return { margin, width, height };
    }

    const svg = container
        .append("svg")
        .attr("class", "chart-svg")
        .append("g");

    fetch('resources/data/data.xlsx')
        .then(response => response.arrayBuffer())
        .then(data => {
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets['Estatisticas_Distrito'];
            const jsonData = XLSX.utils.sheet_to_json(sheet);

            const years = Array.from(new Set(jsonData.map(row => row.Ano))).sort((a, b) => a - b);
            const yearSelect = document.getElementById("yearSelect");

            yearSelect.addEventListener("change", (event) => {
                const selectedYear = parseInt(event.target.value);
                updateChart(selectedYear);
            });

            function updateChart(year) {
                const { margin, width, height } = getDimensions();
            
                
                const svgContainer = d3.select(".chart-svg")
                    .attr("width", width + margin.left + margin.right)
                    .attr("height", height + margin.top + margin.bottom);
            
                svg.attr("transform", `translate(${margin.left},${margin.top})`);
            
                
                svg.selectAll("*").remove();
            
                
                const columns = year >= 2017
                    ? ['AreaArdPov_NoDistrito', 'AreaArdMato_NoDistrito', 'AreaArdAgric_NoDistrito']
                    : ['AreaArdPov_IncendioInicioDist', 'AreaArdMato_IncendioInicioDist', 'AreaArdAgric_IncendioInicioDist'];
            
                const dataForYear = jsonData.filter(row => row.Ano === year);
                const districtData = dataForYear.map(row => ({
                    district: row.Distrito,
                    pov: row[columns[0]] || 0,
                    mato: row[columns[1]] || 0,
                    agric: row[columns[2]] || 0
                }));
            
                districtData.sort((a, b) => (b.pov + b.mato + b.agric) - (a.pov + a.mato + a.agric));
            
                const subgroups = ['pov', 'mato', 'agric'];
                const groups = districtData.map(d => d.district);
            
            
                
                const x = d3.scaleBand()
                    .domain(groups)
                    .range([0, width])
                    .padding(0.2);
            
                svg.append("g")
                    .attr("transform", `translate(0,${height})`)
                    .call(d3.axisBottom(x).tickSizeOuter(0))
                    .selectAll("text")
                    .style("text-anchor", "end")
                    .attr("dx", "-.8em")
                    .attr("dy", ".15em")
                    .attr("transform", "rotate(-65)");
            
                
                const maxArea = d3.max(districtData, d => d.pov + d.mato + d.agric);
                const y = d3.scaleLinear()
                    .domain([0, maxArea])
                    .nice()
                    .range([height, 0]);
            
                svg.append("g").call(d3.axisLeft(y));
            
                
                const color = d3.scaleOrdinal()
                    .domain(subgroups)
                    .range(['red', 'orange', 'yellow']);
            
                
                const stackedData = d3.stack()
                    .keys(subgroups)(districtData);
            
                
                const subgroupNameMapping = {
                    pov: "Forest",
                    mato: "Scrubland",
                    agr: "Agricultural"
                };

                svg.append("g")
                    .selectAll("g")
                    .data(stackedData)
                    .enter().append("g")
                    .attr("fill", d => color(d.key))
                    .selectAll("rect")
                    .data(d => d)
                    .enter().append("rect")
                    .attr("x", d => x(d.data.district))
                    .attr("y", d => y(d[1]))
                    .attr("height", d => y(d[0]) - y(d[1]))
                    .attr("width", x.bandwidth())
                    .on("mouseover", (event, d) => {
                        const subgroupKey = d3.select(event.target.parentNode).datum().key;
                        const subgroupName = subgroupNameMapping[subgroupKey] || subgroupKey; 
                        const district = d.data.district;
                        const value = (d[1] - d[0]).toFixed(2); 

                        globalTooltip
                            .style("visibility", "visible")
                            .html(
                                `<strong>District:</strong> ${district}<br>` +
                                `<strong>Type:</strong> ${subgroupName}<br>` +
                                `<strong>Burnt Area:</strong> ${value} ha`
                            );
                    })
                    .on("mousemove", (event) => {
                        globalTooltip
                            .style("left", `${event.pageX + 10}px`)
                            .style("top", `${event.pageY - 10}px`);
                    })
                    .on("mouseout", () => {
                        globalTooltip.style("visibility", "hidden");
                    });

            
                
                svg.append("text")
                    .attr("class", "y-axis-label")
                    .attr("transform", "rotate(-90)")
                    .attr("y", -margin.left + 15)
                    .attr("x", -height / 2)
                    .attr("text-anchor", "middle")
                    .attr("font-size", "12px")
                    .text("Total Area Burned (ha)");
            
                svg.append("text")
                    .attr("class", "x-axis-label")
                    .attr("x", width / 2)
                    .attr("y", height + margin.bottom - 40)
                    .attr("text-anchor", "middle")
                    .attr("font-size", "12px")
                    .text("Districts");
            
                
                const legend = svg.append("g")
                    .attr("class", "legend")
                    .attr("transform", `translate(0, -30)`);
            
                const legendItems = [
                    { color: 'red', label: 'Forest' },
                    { color: 'orange', label: 'Scrubland' },
                    { color: 'yellow', label: 'Agricultural' }
                ];
            
                legend.selectAll("g")
                    .data(legendItems)
                    .enter()
                    .append("g")
                    .attr("transform", (d, i) => `translate(${i * (width / legendItems.length)}, 0)`)
                    .each(function(d) {
                        d3.select(this).append("rect")
                            .attr("x", 0)
                            .attr("y", 0)
                            .attr("width", 15)
                            .attr("height", 15)
                            .style("fill", d.color);
            
                        d3.select(this).append("text")
                            .attr("x", 20)
                            .attr("y", 12)
                            .text(d.label)
                            .style("font-size", "12px");
                    });
            }
            

            
            updateChart(years[0]);

            
            window.addEventListener("resize", () => {
                const selectedYear = parseInt(yearSelect.value || years[0]);
                updateChart(selectedYear);
            });
        })
        .catch(error => console.error("Error loading Excel file:", error));
}

function initializeNormalizedHistogram() {
    const container = d3.select("#normalized-histogram");

    function getDimensions() {
        const containerWidth = container.node().getBoundingClientRect().width;
        const containerHeight = container.node().getBoundingClientRect().height;
    
        const margin = {
            top: containerHeight * 0.15,    
            right: containerWidth * 0.05,   
            bottom: containerHeight * 0.3,  
            left: containerWidth * 0.07      
        };
    
        const width = containerWidth - margin.left - margin.right;
        const height = containerHeight - margin.top - margin.bottom;
    
        return { margin, width, height };
    }
    const svgContainer = container.append("svg").attr("class", "chart-svg");
    const svg = svgContainer.append("g");



    fetch('resources/data/data.xlsx')
        .then(response => response.arrayBuffer())
        .then(data => {
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets['Estatisticas_Distrito'];
            const jsonData = XLSX.utils.sheet_to_json(sheet);

            const years = Array.from(new Set(jsonData.map(row => row.Ano))).sort((a, b) => a - b);
            const yearSelect = document.getElementById("yearSelect");

            const rangeMinInput = document.querySelector(".range-input .min");
            const rangeMaxInput = document.querySelector(".range-input .max");
            const rangeSelected = document.querySelector(".range-selected");

            yearSelect.addEventListener("change", (event) => {
                const selectedYear = parseInt(event.target.value);
                updateChart(selectedYear);

                
                rangeMinInput.value = 0;
                rangeMaxInput.value = 1;

                
                updateZoom();
            });

            const normalizationCheckbox = document.getElementById("normalizationCheckbox");
            normalizationCheckbox.addEventListener("change", () => {
                const selectedYear = parseInt(yearSelect.value || years[0]);
                updateChart(selectedYear);
            });

            function updateChart(year) {
                const { margin, width, height } = getDimensions();
            
                svgContainer
                    .attr("width", width + margin.left + margin.right)
                    .attr("height", height + margin.top + margin.bottom);
            
                svg.attr("transform", `translate(${margin.left},${margin.top})`);
                svg.selectAll("*").remove();
            
                const fireColumns = ['NIncRur_0_1ha', 'NIncRur_1_10ha', 'NIncRur_10_20ha', 'NIncRur_20_50ha', 'NIncRur_50_100ha',
                                     'NIncRur_100_500ha', 'NIncRur_500_1000ha', 'NIncRur_1000_n_ha'];
            
                const orderColumns = year >= 2017
                    ? ['AreaArdPov_NoDistrito', 'AreaArdMato_NoDistrito', 'AreaArdAgric_NoDistrito']
                    : ['AreaArdPov_IncendioInicioDist', 'AreaArdMato_IncendioInicioDist', 'AreaArdAgric_IncendioInicioDist'];
            
                const dataForYear = jsonData.filter(row => row.Ano === year);
                const isNormalized = document.getElementById("normalizationCheckbox").checked;
            
                const districtData = dataForYear.map(row => {
                    const totalBurntArea = orderColumns.reduce((sum, col) => sum + (row[col] || 0), 0);
                    const totalFires = fireColumns.reduce((sum, col) => sum + (row[col] || 0), 0);
            
                    const normalizedData = totalBurntArea === 0
                        ? fireColumns.map(() => 0)
                        : fireColumns.map(col => (row[col] || 0) / totalFires);
            
                    return {
                        district: row.Distrito,
                        n0_1: isNormalized ? normalizedData[0] : (row[fireColumns[0]] || 0),
                        n1_10: isNormalized ? normalizedData[1] : (row[fireColumns[1]] || 0),
                        n10_20: isNormalized ? normalizedData[2] : (row[fireColumns[2]] || 0),
                        n20_50: isNormalized ? normalizedData[3] : (row[fireColumns[3]] || 0),
                        n50_100: isNormalized ? normalizedData[4] : (row[fireColumns[4]] || 0),
                        n100_500: isNormalized ? normalizedData[5] : (row[fireColumns[5]] || 0),
                        n500_1000: isNormalized ? normalizedData[6] : (row[fireColumns[6]] || 0),
                        n1000_n: isNormalized ? normalizedData[7] : (row[fireColumns[7]] || 0),
                        total: totalBurntArea
                    };
                });
            
                districtData.sort((a, b) => b.total - a.total);
                const subgroups = ['n0_1', 'n1_10', 'n10_20', 'n20_50', 'n50_100', 'n100_500', 'n500_1000', 'n1000_n'];
                const maxValue = d3.max(districtData, d => d3.max(subgroups.map(key => d[key])));
            
                rangeMaxInput.max = maxValue;
                rangeMinInput.max = maxValue;
                rangeMaxInput.value = maxValue;
                rangeMinInput.value = 0;
            
                const x = d3.scaleBand()
                    .domain(districtData.map(d => d.district))
                    .range([0, width])
                    .padding(0.2);
            
                const y = d3.scaleLinear()
                    .domain([0, isNormalized ? 1 : maxValue])
                    .nice()
                    .range([height, 0]);
            
                svg.append("g")
                    .attr("transform", `translate(0,${height})`)
                    .call(d3.axisBottom(x))
                    .selectAll("text")
                    .attr("transform", "rotate(-45)")
                    .style("text-anchor", "end");
            
                const yAxis = svg.append("g").call(d3.axisLeft(y));
            
                const color = d3.scaleOrdinal()
                    .domain(subgroups)
                    .range(['#FF4500', '#FF6347', '#FF7F50', '#FF8C00', '#FFA500', '#FFD700', '#FFFF00', '#FFFFE0']);
                const stackedData = d3.stack().keys(subgroups)(districtData);
            
                svg.append("defs").append("clipPath")
                    .attr("id", "clip-path")
                    .append("rect")
                    .attr("width", width)
                    .attr("height", height);
            
                const bars = svg.selectAll(".bar")
                    .data(stackedData)
                    .enter()
                    .append("g")
                    .attr("class", "bar")
                    .attr("fill", d => color(d.key))
                    .attr("clip-path", "url(#clip-path)");
                
                bars.selectAll("rect")
                    .data(d => d)
                    .enter()
                    .append("rect")
                    .attr("x", d => x(d.data.district))
                    .attr("y", d => y(d[1]))
                    .attr("height", d => y(d[0]) - y(d[1]))
                    .attr("width", x.bandwidth())
                    .on("mouseover", function (event, d) {
                        
                        const rawCategory = this.parentNode.__data__.key; 
                        const formattedCategory = rawCategory
                            .replace("n", "") 
                            .replace("_", " and ") 
                            .replace("_", " ") + " ha";  
                
                        const value = d[1] - d[0]; 
                
                        
                        const message = isNormalized
                            ? `<strong>District:</strong> ${d.data.district}<br>
                               <strong>Percentage of fires with areas between ${formattedCategory}:</strong> ${value.toFixed(2)}%`
                            : `<strong>District:</strong> ${d.data.district}<br>
                               <strong>Number of fires with areas between ${formattedCategory}:</strong> ${value.toFixed(2)}`;
                
                        globalTooltip
                            .style("visibility", "visible")
                            .html(message);
                    })
                    .on("mousemove", function (event) {
                        globalTooltip
                            .style("left", `${Math.min(event.pageX + 10, window.innerWidth - globalTooltip.node().offsetWidth - 10)}px`)
                            .style("top", `${Math.min(event.pageY - 28, window.innerHeight - globalTooltip.node().offsetHeight - 10)}px`);
                    })
                    .on("mouseout", function () {
                        globalTooltip.style("visibility", "hidden");
                    });
                
                
                
                        

            
                svg.append("text")
                    .attr("x", width / 2)
                    .attr("y", height + margin.bottom - 40)
                    .attr("text-anchor", "middle")
                    .style("font-size", "14px")
                    .text("Districts");
            
                svg.append("text")
                    .attr("x", -(height / 2))
                    .attr("y", -margin.left + 20)
                    .attr("text-anchor", "middle")
                    .attr("transform", "rotate(-90)")
                    .style("font-size", "14px")
                    .text(isNormalized ? "Normalized Fire Count" : "Fire Count");
            
                    const legend = svg.append("g")
                    .attr("transform", `translate(0, -30)`)
                    .attr("class", "legend");
                
                const legendSpacing = 5; 
                const legendItemWidth = 100; 
                const legendRowLimit = Math.floor(width / legendItemWidth); 
                const legendHeight = 20; 
                
                subgroups.forEach((key, index) => {
                    const row = Math.floor(index / legendRowLimit);
                    const col = index % legendRowLimit;
                
                    legend.append("rect")
                        .attr("x", col * legendItemWidth)
                        .attr("y", row * legendHeight)
                        .attr("width", 15)
                        .attr("height", 15)
                        .attr("fill", color(key));
                
                    legend.append("text")
                        .attr("x", col * legendItemWidth + 20)
                        .attr("y", row * legendHeight + 12)
                        .style("font-size", "12px")
                        .text(key.replace("n", "").replace("_", " to ").replace("_", " "));
                });
                
                

            
                function updateZoom() {
                    const minZoom = parseFloat(rangeMinInput.value);
                    const maxZoom = parseFloat(rangeMaxInput.value);
                    const minValuePercent = (minZoom - rangeMinInput.min) / (rangeMaxInput.max - rangeMinInput.min) * 100;
                    const maxValuePercent = (maxZoom - rangeMinInput.min) / (rangeMaxInput.max - rangeMinInput.min) * 100;
            
                    rangeSelected.style.left = `${minValuePercent}%`;
                    rangeSelected.style.width = `${maxValuePercent - minValuePercent}%`;
            
                    y.domain([minZoom, maxZoom]);
            
                    yAxis.transition().duration(500).call(d3.axisLeft(y));
                    bars.selectAll("rect")
                        .transition().duration(500)
                        .attr("y", d => y(d[1]))
                        .attr("height", d => y(d[0]) - y(d[1]));
                }
            
                rangeMinInput.addEventListener("input", updateZoom);
                rangeMaxInput.addEventListener("input", updateZoom);
            }
            
                        
            window.addEventListener("resize", () => {
                const selectedYear = parseInt(yearSelect.value || years[0]);
                updateChart(selectedYear);
            });

            updateChart(years[0]);
        });
}


function initializeMap() {
    let svg, projection, path;
    let globalMinValue = Infinity;
    let globalMaxValue = -Infinity;
    let areLabelsVisible = true; 

    const container = d3.select("#map");
    const fixColorbarCheckbox = d3.select("#fixColorbarCheckbox");
    const toggleLabelsButton = d3.select("#toggleLabelsButton"); 

    function getDimensions() {
        const containerWidth = container.node().getBoundingClientRect().width;
        const containerHeight = container.node().getBoundingClientRect().height;
        return { width: containerWidth, height: containerHeight };
    }

    function createSvg(width, height) {
        svg?.remove(); 
        svg = container.append("svg")
            .attr("width", width)
            .attr("height", height);
    }

    function createProjection(width, height) {
        const scale = Math.min(width, height) * 11; 
        projection = d3.geoMercator()
            .center([-8, 39.3])
            .scale(scale)
            .translate([width / 2, height / 2]);
        path = d3.geoPath().projection(projection);
    }

    
    function updateMap(selectedYear, geoData, burnedAreaData) {
        const { width, height } = getDimensions();
        createSvg(width, height);
        createProjection(width, height);
    
        const areaColumn = selectedYear >= 2017 ? 'AreaArdTotal_NoDistrito' : 'AreaArdTotal_IncendioInicioDist';
        const dataForYear = burnedAreaData.filter(d => d.Ano === selectedYear);
    
        
        const isFixed = fixColorbarCheckbox.property("checked");
        const globalValues = burnedAreaData.flatMap(d => [
            +d['AreaArdTotal_NoDistrito'] || 0,
            +d['AreaArdTotal_IncendioInicioDist'] || 0
        ]);
        const globalMax = Math.max(...globalValues);
        const globalMin = Math.min(...globalValues);
    
        
        const minValue = isFixed ? globalMin : d3.min(dataForYear, d => +d[areaColumn]) || 0;
        const maxValue = isFixed ? globalMax : d3.max(dataForYear, d => +d[areaColumn]) || 0;
        
        
        const colorScale = d3.scaleSequential(d3.interpolateReds)
            .domain([minValue, maxValue]);
    
        geoData.features.forEach(feature => {
            const districtName = feature.properties.name.toUpperCase();
            const burnedData = dataForYear.find(d => d.Distrito === districtName);
    
            if (burnedData) {
                const areaBurned = +burnedData[areaColumn] || 0;
                const numberOfFires = +burnedData['Num_IncendiosRurais'] || 0; 
                feature.properties.burnedArea = areaBurned;
                feature.properties.numberOfFires = numberOfFires; 
                feature.properties.fillColor = colorScale(areaBurned);
            } else {
                feature.properties.fillColor = "#ccc";
            }
        });
    
        
        svg.selectAll("path")
        .data(geoData.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", d => d.properties.fillColor)
        .attr("stroke", "black")
        .attr("stroke-width", 1)
        .on("mouseover", function(event, d) {
            
            const districtName = d.properties.name;
            const burnedArea = d.properties.burnedArea ? d.properties.burnedArea.toFixed(2) : "N/A";
            const numberOfFires = d.properties.numberOfFires !== undefined ? d.properties.numberOfFires : "N/A";
            
            
            const tableBody = d3.select("#district-info-table tbody");
            
            
            tableBody.html("");
            
            
            tableBody.append("tr")
                .html(`
                    <td>${districtName}</td>
                    <td>${burnedArea} ha</td>
                    <td>${numberOfFires}</td>
                `);

            
            d3.select(this)
                .attr("stroke", "yellow")
                .attr("stroke-width", 3)  
                .raise();  

            
            svg.selectAll("text")
                .filter(t => t.properties.name === districtName) 
                .raise();  
        })
        .on("mouseout", function() {
            
            d3.select(this)
                .attr("stroke", "black")
                .attr("stroke-width", 1);  

            
            const tableBody = d3.select("#district-info-table tbody");
            tableBody.html(""); 
        });

        
        svg.selectAll("text").remove();  
        if (areLabelsVisible) {
        svg.selectAll("text")
            .data(geoData.features)
            .enter()
            .append("text")
            .attr("transform", d => {
                const centroid = path.centroid(d); 
                return `translate(${centroid[0]}, ${centroid[1]})`; 
            })
            .attr("dy", ".35em") 
            .attr("text-anchor", "middle") 
            .style("font-size", "14px") 
            .style("font-weight", "bold") 
            .style("fill", "black")
            .text(d => d.properties.name); 
        }


    
        
        updateLegend(colorScale, dataForYear, areaColumn, width, isFixed);
    }
    

    
    function updateLegend(colorScale, burnedAreaData, areaColumns, mapWidth, isFixed) {
        const legendWidth = 20; 
        const legendHeight = 220; 
    
        
        d3.select("#legend").remove();
    
        
        const legend = container.append("svg")
            .attr("id", "legend")
            .attr("width", legendWidth + 60) 
            .attr("height", legendHeight + 60) 
            .style("position", "absolute")
            .style("right", "5px") 
            .style("top", "5px");
    
        
        d3.select("defs #gradient").remove();
    
        const defs = legend.append("defs");
        const gradient = defs.append("linearGradient")
            .attr("id", "gradient")
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "0%")
            .attr("y2", "100%"); 
    
        
        const minValue = colorScale.domain()[0];
        const maxValue = colorScale.domain()[1];
    
        
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", colorScale(maxValue));
    
        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", colorScale(minValue));
    
        
        legend.append("rect")
            .attr("x", 20) 
            .attr("y", 30) 
            .attr("width", legendWidth)
            .attr("height", legendHeight)
            .style("fill", "url(#gradient)");
    
        
        legend.append("text")
            .attr("x", legendWidth / 2 + 20) 
            .attr("y", 20) 
            .attr("text-anchor", "middle")
            .style("font-size", "12px")
            .style("font-weight", isFixed ? "bold" : "normal") 
            .text(maxValue.toFixed(0) + " ha"); 
    
        
        legend.append("text")
            .attr("x", legendWidth / 2 + 20) 
            .attr("y", legendHeight + 50) 
            .attr("text-anchor", "middle")
            .style("font-size", "12px")
            .style("font-weight", isFixed ? "bold" : "normal") 
            .text(minValue.toFixed(0) + " ha"); 
    }
    

    
    d3.json("resources/data/portugal.geojson")
        .then(geoData => {
            fetch("resources/data/data.xlsx")
                .then(response => response.arrayBuffer())
                .then(data => {
                    const workbook = XLSX.read(data, { type: "array" });
                    const sheet = workbook.Sheets["Estatisticas_Distrito"];
                    const burnedAreaData = XLSX.utils.sheet_to_json(sheet);

                    const yearSelect = document.getElementById("yearSelect");
                    const initialYear = parseInt(yearSelect.value);

                    yearSelect.addEventListener("change", (event) => {
                        const selectedYear = parseInt(event.target.value);
                        updateMap(selectedYear, geoData, burnedAreaData);
                    });

                    fixColorbarCheckbox.on("change", () => {
                        const selectedYear = parseInt(yearSelect.value || initialYear);
                        updateMap(selectedYear, geoData, burnedAreaData);
                    });

                    
                    toggleLabelsButton.on("click", () => {
                        areLabelsVisible = !areLabelsVisible; 
                        toggleLabelsButton.text(areLabelsVisible ? "Hide District Names" : "Show District Names"); 
                        const selectedYear = parseInt(yearSelect.value || initialYear);
                        updateMap(selectedYear, geoData, burnedAreaData);
                    });
                    

                    updateMap(initialYear, geoData, burnedAreaData);

                    
                    window.addEventListener("resize", () => {
                        const selectedYear = parseInt(yearSelect.value || initialYear);
                        updateMap(selectedYear, geoData, burnedAreaData);
                    });
                })
                .catch(error => console.error("Error reading Excel file:", error));
        })
        .catch(error => console.error("Error loading GeoJSON data:", error));
}


function initializeDotPlot() {
    const url = "resources/data/data.xlsx";
    const container = d3.select("#dotplot");

    function getDimensions(labels = []) {
        const containerWidth = container.node().getBoundingClientRect().width;
        const containerHeight = container.node().getBoundingClientRect().height;
    
        
        const tempSVG = d3.select("body")
            .append("svg")
            .attr("class", "temp-svg")
            .style("position", "absolute")
            .style("visibility", "hidden");
    
        const tempText = tempSVG.append("g")
            .selectAll("text")
            .data(labels)
            .enter()
            .append("text")
            .attr("font-size", "12px") 
            .text(d => d);
    
        const maxLabelWidth = Math.max(...tempText.nodes().map(node => node.getBBox().width));
    
        tempSVG.remove(); 
    
        const margin = { 
            top: 40, 
            right: 40, 
            bottom: 80, 
            left: Math.max(100, maxLabelWidth + 20) 
        };
        const width = containerWidth - margin.left - margin.right;
        const height = containerHeight - margin.top - margin.bottom;
    
        return { margin, width, height };
    }
    
    const svgContainer = container
        .append("svg")
        .attr("class", "chart-svg");

    const svg = svgContainer.append("g");

    
    function loadSheetData(sheetName) {
        return fetch(url)
            .then(response => response.arrayBuffer())
            .then(data => {
                const workbook = XLSX.read(data, { type: "array" });
                const sheet = workbook.Sheets[sheetName];
                return XLSX.utils.sheet_to_json(sheet);
            });
    }

    
    function loadDataForYears() {
        return loadSheetData("Estatisticas_PortugalContinent");
    }

    
    function loadDataForAllDistricts() {
        return loadSheetData("Estatisticas_Distrito");
    }

    
    function loadDataForDistrictConcelhos(selectedDistrito) {
        return loadSheetData("Estatisticas_Concelho").then(concelhosData => {
            return concelhosData.filter(d => d.Distrito.toUpperCase() === selectedDistrito.toUpperCase());
        });
    }

    
    const filterTypeSelect = document.getElementById("filterTypeSelect");
    const orderSelect = document.getElementById("orderSelect");
    const distritoSelect = document.getElementById("distritoSelect");

    
    const toggleDistritoSelect = enabled => distritoSelect.disabled = !enabled;

    
    function processAndSortData(data, filterKey, sortOrder, selectedDistrito) {
        if (selectedDistrito && selectedDistrito !== "All") {
            data.forEach(d => d.Concelho = d.Concelho.toUpperCase());
        }

        const groupedData = data.reduce((acc, d) => {
            const key = d[filterKey];
            if (!acc[key]) {
                acc[key] = { key, ...Object.fromEntries(Object.keys(d).filter(k => k.startsWith("NInc")).map(k => [k, 0])) };
            }

            Object.keys(acc[key]).forEach(field => {
                if (field !== "key") acc[key][field] += d[field] || 0;
            });

            return acc;
        }, {});

        const processedData = Object.values(groupedData).map(d => {
        const totalIncidents = Object.keys(d).filter(k => k.startsWith("NInc")).reduce((sum, k) => sum + d[k], 0);

            return {
                key: d.key,
                causes: [
                    { name: "Natural", percentage: totalIncidents > 0 ? (d.NInc_Natural / totalIncidents) * 100 : 0, count: d.NInc_Natural },
                    { name: "Intencionais", percentage: totalIncidents > 0 ? (d.NInc_Intencionais / totalIncidents) * 100 : 0, count: d.NInc_Intencionais },
                    { name: "Negligente", percentage: totalIncidents > 0 ? (d.NInc_Negligente / totalIncidents) * 100 : 0, count: d.NInc_Negligente },
                    { name: "Reacendimentos", percentage: totalIncidents > 0 ? (d.NInc_Reacendimentos / totalIncidents) * 100 : 0, count: d.NInc_Reacendimentos },
                    { name: "Desconhecida", percentage: totalIncidents > 0 ? (d.NInc_Desconhecida / totalIncidents) * 100 : 0, count: d.NInc_Desconhecida },
                    { name: "Não Investigados", percentage: totalIncidents > 0 ? (d.NInc_NaoInvestigados / totalIncidents) * 100 : 0, count: d.NInc_NaoInvestigados }
                ]
            };
        
        });

        console.log(processedData);
        console.log(sortOrder);

        return processedData.sort((a, b) => {
            const causeA = a.causes.find(c => c.name === sortOrder);
            const causeB = b.causes.find(c => c.name === sortOrder);
            console.log(causeB ? causeB.percentage : 0) - (causeA ? causeA.percentage : 0);
            return (causeB ? causeB.percentage : 0) - (causeA ? causeA.percentage : 0);

        });
    }



    
    const causeTranslations = {
        "Natural": "Natural",
        "Intencionais": "Intentional",
        "Negligente": "Negligent",
        "Reacendimentos": "Reignitions",
        "Desconhecida": "Unknown",
        "Não Investigados": "Not Investigated"
    };


    
    function renderDotPlot(dataWithPercentages,orderType) {
        const { margin, width, height } = getDimensions(dataWithPercentages.map(d => d.key));

        
        const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background-color", "white")
        .style("border", "1px solid black")
        .style("padding", "10px")
        .style("border-radius", "4px")
        .style("visibility", "hidden")
        .style("font-size", "12px");

    
        
        svgContainer
            .attr("width", width + margin.left + margin.right) 
            .attr("height", height + margin.top + margin.bottom); 
    
        svg.attr("transform", `translate(${margin.left},${margin.top})`);
        svg.selectAll("*").remove();
    
        
        const xScale = d3.scaleLinear()
            .domain([0, 100])
            .range([0, width]);
    
        const yScale = d3.scalePoint()
            .domain(dataWithPercentages.map(d => d.key))
            .range([0, height])
            .padding(1);
    
        const colorScale = d3.scaleOrdinal()
            .domain(['Natural', 'Intencionais', 'Negligente', 'Reacendimentos', 'Desconhecida', 'Não Investigados'])
            .range(['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b']);

        
        dataWithPercentages.forEach(d => {
            const lineGenerator = d3.line()
                .x(cause => xScale(cause.percentage))
                .y(() => yScale(d.key));

            const lineData = d.causes.map(cause => ({
                x: xScale(cause.percentage),
                y: yScale(d.key)
            }));

            svg.selectAll(`.line-${d.key}`)
                .data([lineData])
                .join(
                    enter => enter.append('path')
                        .attr('class', `line-${d.key}`)
                        .attr('fill', 'none')
                        .attr('stroke', 'black')
                        .attr('stroke-width', 1)
                        .attr('d', lineGenerator(d.causes))
                        .call(enter => enter.transition().duration(1000)
                            .attr('d', lineGenerator(d.causes))),
                    update => update
                        .transition().duration(1000)
                        .attrTween('d', function() {
                            const previous = d3.select(this).attr('d');
                            const current = lineGenerator(d.causes);
                            return d3.interpolatePath(previous, current);
                        })
                );
        });
    
        
        svg.selectAll(".key-label")
            .data(dataWithPercentages)
            .join("text")
            .attr("class", "key-label")
            .attr("x", -10)
            .attr("y", d => yScale(d.key))
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .attr("font-size", "12px")
            .text(d => d.key);
        
        
        for (let i = 0; i <= 100; i += 10) {
            svg.append("line")
                .attr("x1", xScale(i))
                .attr("x2", xScale(i))
                .attr("y1", 0)
                .attr("y2", height)
                .attr("stroke", "black")
                .attr("stroke-width", 0.5);
    
            svg.append("text")
                .attr("x", xScale(i))
                .attr("y", -5)
                .attr("text-anchor", "middle")
                .attr("font-size", "10px")
                .text(i + "%");
        }
        

        
        svg.selectAll("circle")
        .data(dataWithPercentages.flatMap(d => d.causes.map(cause => ({ ...cause, key: d.key, causes: d.causes }))))
        .join("circle")
        .attr("cx", d => xScale(d.percentage))
        .attr("cy", d => yScale(d.key))
        .attr("r", 5)
        .attr("fill", d => colorScale(d.name))
        .attr("stroke", "black")
        .attr("stroke-width", 0.5)
        .on("mouseover", (event, d) => {
            
            svg.selectAll("circle")
                .filter(circle => circle.key === d.key)
                .transition().duration(300)
                .attr("r", 8)
                .attr("stroke", "red");

            
            svg.selectAll(`path.line-${d.key}`)
                .transition().duration(300)
                .attr("stroke", "red")
                .attr("stroke-width", 2);

            
            const causesTable = d.causes.map(cause => 
                `<tr>
                    <td><strong>${causeTranslations[cause.name] || cause.name}</strong></td>
                    <td>${cause.count}</td>
                </tr>`
            ).join("");

            tooltip.html(
                `<strong>Category:</strong> ${d.key}<br>
                <table style="margin-top: 5px;">
                    <thead>
                        <tr>
                            <th>Cause</th>
                            <th>Number of Fires</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${causesTable}
                    </tbody>
                </table>`
            )
            .style("visibility", "visible");
        })
        .on("mousemove", (event) => {
            tooltip
                .style("top", (event.pageY + 10) + "px")
                .style("left", (event.pageX + 10) + "px");
        })
        .on("mouseout", () => {
            tooltip.style("visibility", "hidden");

            
            svg.selectAll("circle")
                .transition().duration(300)
                .attr("r", 5)
                .attr("stroke", "black");

            
            svg.selectAll("path")
                .transition().duration(300)
                .attr("stroke", "black")
                .attr("stroke-width", 1);
        });


        const selectedCause = orderType;


        
        const lineGenerator = d3.line()
        .x(d => xScale(d.percentage))
        .y(d => yScale(d.key));

        const lineData = dataWithPercentages.map(d => {
            const cause = d.causes.find(c => c.name === selectedCause);
            return { key: d.key, percentage: cause ? cause.percentage : 0 };
        });

        svg.append("path")
            .datum(lineData)
            .attr("fill", "none")
            .attr("stroke", colorScale(selectedCause))
            .attr("stroke-width", 2)
            .attr("d", lineGenerator);





        
        const legend = svg.selectAll('.legend')
        .data(colorScale.domain())
        .enter().append('g')
        .attr('class', 'legend')
        .attr('transform', (d, i) => {
            
            if (i % 2 === 0) {
                return `translate(${margin.left + i * 80 - 180}, ${height - 5})`;
            } else {
                return `translate(${margin.left + i * 80 - 80 - 180}, ${height + 15})`;
            }
        });

    legend.append('rect')
        .attr('width', 18)
        .attr('height', 18)
        .style('fill', colorScale);

    legend.append('text')
        .attr('x', 24)
        .attr('y', 9)
        .attr('dy', '.35em')
        .style('text-anchor', 'start')
        .text(d => causeTranslations[d] || d); 
        }

    function updateData() {
        const filterType = filterTypeSelect.value;
        const orderType = orderSelect.value;

        if (filterType === "Anos") {
            loadDataForYears().then(data => {
                const processedData = processAndSortData(data, "Ano", orderType);
                renderDotPlot(processedData,orderType);
            });
        } else if (filterType === "Distritos") {
            toggleDistritoSelect(true);

            if (distritoSelect.value === "All") {
                loadDataForAllDistricts().then(data => {
                    const processedData = processAndSortData(data, "Distrito", orderType);
                    renderDotPlot(processedData,orderType);
                });
            } else {
                const selectedDistrito = distritoSelect.value;
                loadDataForDistrictConcelhos(selectedDistrito).then(data => {
                    const processedData = processAndSortData(data, "Concelho", orderType, selectedDistrito);
                    renderDotPlot(processedData,orderType);
                });
            }
        } else {
            toggleDistritoSelect(false);
        }
    }

    filterTypeSelect.addEventListener("change", updateData);
    orderSelect.addEventListener("change", updateData);
    distritoSelect.addEventListener("change", updateData);

    updateData();

    
    window.addEventListener("resize", updateData);
}


function initializeSpiderChart() {
    const container = d3.select("#spiderchart");

    const svgContainer = container
        .append("svg")
        .attr("class", "chart-svg")
        .attr("width", "100%")
        .attr("height", "100%");

    const svg = svgContainer.append("g");

    
    const yearDropdownButton = document.getElementById("yearDropdownButtonCauses");
    const yearDropdown = document.getElementById("yearDropdownCauses");
    const districtDropdownButton = document.getElementById("districtDropdownButtonCauses");
    const districtDropdown = document.getElementById("districtDropdownCauses");
    const councilDropdownButton = document.getElementById("councilDropdownButtonCauses");
    const councilDropdown = document.getElementById("councilDropdownCauses");

    
    configureDropdowns();
    initializeSVG();

    
    updateChart();
    window.addEventListener("resize", updateChart);

    
    function configureDropdowns() {
        [yearDropdownButton, districtDropdownButton, councilDropdownButton].forEach((btn, i) => {
            const dropdown = [yearDropdown, districtDropdown, councilDropdown][i];
            btn.addEventListener("click", () => dropdown.classList.toggle("show"));
        });

        
        document.addEventListener("click", event => {
            if (!yearDropdownButton.contains(event.target) && !yearDropdown.contains(event.target)) yearDropdown.classList.remove("show");
            if (!districtDropdownButton.contains(event.target) && !districtDropdown.contains(event.target)) districtDropdown.classList.remove("show");
            if (!councilDropdownButton.contains(event.target) && !councilDropdown.contains(event.target)) councilDropdown.classList.remove("show");
        });

        
        yearDropdown.addEventListener('change', updateChart);
        districtDropdown.addEventListener('change', updateChart);
        councilDropdown.addEventListener('change', updateChart);
    }

    
    function initializeSVG() {
        const svgContainer = container.append("svg").attr("class", "chart-svg");
        svgContainer.append("g");
    }

    
    function updateChart() {
        
        const anos = getSelectedCheckboxValues(yearDropdown);
        const distritos = getSelectedCheckboxValues(districtDropdown);
        const concelhos = getSelectedCheckboxValues(councilDropdown);

        if (anos.length) {
            if (concelhos.length) {
                fetchData('resources/data/data.xlsx', 'Estatisticas_Concelho', anos, distritos, concelhos, filterByCouncil);
            } else if (distritos.length) {
                fetchData('resources/data/data.xlsx', 'Estatisticas_Distrito', anos, distritos, null, filterByDistrict);
            } else {
                fetchData('resources/data/data.xlsx', 'Estatisticas_PortugalContinent', anos, null, null, filterByYear);
            }
        } else {
            drawDefaultChart(); 
        }
    }

    
    function drawDefaultChart() {
        const defaultData = {
            label: "No selection",
            data: [
                { cause: "Natural", value: 0 },
                { cause: "Negligent", value: 0 },
                { cause: "Intentional", value: 0 },
                { cause: "Reignitions", value: 0 },
                { cause: "Unknown", value: 0 },
                { cause: "Not Investigated", value: 0 }
            ]
        };
        drawSpiderChart([defaultData]);
    }

    
    function getSelectedCheckboxValues(dropdownElement) {
        const selectedCheckboxes = dropdownElement.querySelectorAll("input[type='checkbox']:checked");
        return Array.from(selectedCheckboxes).map(checkbox => checkbox.value);
    }

    
    function fetchData(file, sheetName, anos, distritos, concelhos, filterFunction) {
        fetch(file)
            .then(response => response.ok ? response.arrayBuffer() : Promise.reject('Failed to load the file'))
            .then(data => {
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[sheetName];
                if (!sheet) return console.error('Sheet not found.');
                const jsonData = XLSX.utils.sheet_to_json(sheet);
                if (jsonData.length === 0) return console.error('No data found.');
                const plotData = filterFunction(jsonData, anos, distritos, concelhos);
                drawSpiderChart(plotData);
            })
            .catch(error => console.error('Error:', error));
    }

    
    function getSelectedCheckboxValues(dropdownElement) {
        const selectedCheckboxes = dropdownElement.querySelectorAll("input[type='checkbox']:checked");
        return Array.from(selectedCheckboxes).map(checkbox => checkbox.value);
    }

    
    function filterByYear(data, anos) {
        return anos.map(ano => {
            const filtered = data.find(d => d.Ano == ano);
            return preparePlotData(filtered, ano);
        }).filter(Boolean);
    }

    function filterByDistrict(data, anos, distritos) {
        return distritos.flatMap(distrito =>
            anos.map(ano => {
                const filtered = data.find(d => d.Ano == ano && d.Distrito === distrito);
                return preparePlotData(filtered, `${distrito} (${ano})`);
            })
        ).filter(Boolean);
    }

    function filterByCouncil(data, anos, distritos, concelhos) {
        console.log(data)
        return concelhos.flatMap(concelho =>
            anos.map(ano => {
                const filtered = data.find(d => d.Ano == ano && d.Concelho.toUpperCase() === concelho.toUpperCase());
                console.log(filtered);
                return preparePlotData(filtered, `${concelho} (${ano})`);
            })
        ).filter(Boolean);
    }

    
    function preparePlotData(filteredData, label) {
        if (!filteredData) return null;
        const total = Object.entries(filteredData)
            .filter(([key]) => key.startsWith('NInc_'))
            .reduce((sum, [, val]) => sum + (+val || 0), 0);
        if (total === 0) return null;
        return {
            label,
            data: Object.entries(filteredData)
                .filter(([key]) => key.startsWith('NInc_'))
                .map(([cause, value]) => ({
                    cause: cause.replace('NInc_', ''),
                    value: (+value || 0) / total * 100
                }))
        };
    }

    
    function drawSpiderChart(dataSets) {
        console.log(dataSets);
        const { margin, width, height } = getDimensions();
    
        const newWidth = width;  
        const newHeight = height; 
        const radius = Math.min(newWidth, newHeight) / 2 - 50; 
        const center = { x: newWidth / 2, y: newHeight / 2 }; 
    
        const svgContainerWidth = newWidth + margin.left + margin.right;
        const svgContainerHeight = newHeight + margin.top + margin.bottom; 
    
        
        svgContainer
            .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
            .attr("preserveAspectRatio", "xMidYMid meet")
            .style("background-color", "#dddddd") 
            .style("border-radius","15px")
    
        svg.attr("transform", `translate(${margin.left}, ${margin.top})`);
    
        const causes = dataSets[0].data.map(d => d.cause);
        const numAxes = causes.length;
    
        const angleScale = d3.scaleLinear()
            .domain([0, numAxes]) 
            .range([0, 2 * Math.PI]); 
    
        const maxValue = 100; 
        const radialScale = d3.scaleLinear().domain([0, maxValue]).range([0, radius]);
    
        const radarLine = d3.lineRadial()
            .radius(d => radialScale(d.value))
            .angle((_, i) => angleScale(i)) 
            .curve(d3.curveCardinalClosed);
    
        const colors = d3.scaleOrdinal(d3.schemeCategory10);
    
        
        svg.selectAll("*").remove();
    
        
        const radialLevels = d3.range(0, maxValue + 1, 20); 
        svg.selectAll(".radial-level")
            .data(radialLevels)
            .join("circle")
            .attr("class", "radial-level")
            .attr("cx", center.x)
            .attr("cy", center.y)
            .attr("r", d => radialScale(d))
            .attr("fill", "none")
            .attr("stroke", "black")
            .attr("stroke-dasharray", "4,4");
    
        svg.selectAll(".radial-label")
            .data(radialLevels)
            .join("text")
            .attr("class", "radial-label")
            .attr("x", center.x)
            .attr("y", d => center.y - radialScale(d))
            .attr("dy", "-0.3em")
            .text(d => `${d}%`)
            .attr("fill", "black")
            .attr("font-size", "10px")
            .attr("text-anchor", "middle");
    
        
        const axis = svg.selectAll(".axis")
            .data(causes)
            .join("g")
            .attr("class", "axis");
    
            axis.append("line")
            .attr("x1", center.x)
            .attr("y1", center.y)
            .attr("x2", (_, i) => center.x + Math.cos(angleScale(i) - Math.PI / 2) * radius)
            .attr("y2", (_, i) => center.y + Math.sin(angleScale(i) - Math.PI / 2) * radius)
            .attr("stroke", "black");
        
        axis.append("text")
            .attr("x", (_, i) => center.x + Math.cos(angleScale(i) - Math.PI / 2) * (radius + 20))
            .attr("y", (_, i) => center.y + Math.sin(angleScale(i) - Math.PI / 2) * (radius + 20))
            .attr("text-anchor", (_, i) => {
                const angle = angleScale(i);
                return angle === 0 || angle === Math.PI ? "middle" : angle < Math.PI ? "start" : "end";
            })
            .text((cause) => {
                
                const translations = {
                    "Natural": "Natural",
                    "Negligente": "Negligent",
                    "Intencionais": "Intentional",
                    "Reacendimentos": "Reignitions",
                    "Desconhecida": "Unknown",
                    "NaoInvestigados": "Not Investigated"
                };
                return translations[cause] || cause; 
            })
            .attr("fill", "black")
            .attr("font-size", "12px");
        
        
        svg.selectAll(".radar-area")
            .data(dataSets)
            .join("path")
            .attr("class", "radar-area")
            .attr("d", d => radarLine(d.data))
            .attr("transform", `translate(${center.x}, ${center.y})`)
            .attr("fill", (d, i) => colors(i))
            .attr("opacity", 0.5)
            .attr("stroke", (d, i) => colors(i))
            .attr("stroke-width", 2);
    
        
        svgContainer.selectAll(".legend-row").remove();
    
        
        const legendGroup = svgContainer.append("g").attr("class", "legend-group");
    
        legendGroup.selectAll(".legend-row")
            .data(dataSets)
            .join("g")
            .attr("class", "legend-row")
            .attr("transform", (_, i) => `translate(${margin.left}, ${newHeight + margin.bottom + i * 20 - 100})`)
            .each(function (d, i) {
                const row = d3.select(this);
                row.append("rect")
                    .attr("width", 15)
                    .attr("height", 15)
                    .attr("fill", colors(i));
                row.append("text")
                    .attr("x", 20)
                    .attr("y", 12)
                    .text(`${d.label}`)
                    .attr("fill", "black")
                    .attr("font-size", "12px");
            });
    }
    


    
    

    
    function getDimensions() {
        const containerWidth = container.node().getBoundingClientRect().width;
        const containerHeight = container.node().getBoundingClientRect().height;
        const margin = { top: 40, right: 40, bottom: 80, left: 40 };
        const width = containerWidth - margin.left - margin.right;
        const height = containerHeight - margin.top - margin.bottom;

        return { margin, width, height };
    }
    
}

function initializeLinePlot() {
    const container = d3.select("#linePlotContainer");

    
    function getDimensions() {
        const containerWidth = container.node().getBoundingClientRect().width;
        const containerHeight = container.node().getBoundingClientRect().height;

        const margin = {
            top: containerHeight * 0.2,
            right: containerWidth * 0.03,
            bottom: containerHeight * 0.15,
            left: containerWidth * 0.06
        };

        const width = containerWidth - margin.left - margin.right;
        const height = containerHeight - margin.top - margin.bottom;

        return { margin, width, height };
    }

    const svgContainer = container
        .append("svg")
        .attr("class", "chart-svg");

    const svg = svgContainer.append("g");

    fetch('resources/data/data.xlsx')
        .then(response => response.arrayBuffer())
        .then(data => {
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets['Estatisticas_Distrito'];
            const jsonData = XLSX.utils.sheet_to_json(sheet);

            const years = [...new Set(jsonData.map(d => d.Ano))].sort();
            const districts = [...new Set(jsonData.map(d => d.Distrito))].sort();

            const districtSelect = d3.select("#districtSelect")
                .on("change", updatePlot);

            d3.select("#povCheckbox").on("change", updatePlot);
            d3.select("#agricCheckbox").on("change", updatePlot);
            d3.select("#matoCheckbox").on("change", updatePlot);
            d3.select("#totalCheckbox").on("change", updatePlot);
            d3.select("#highlightMaxCheckbox").on("change", updatePlot);
            d3.select("#highlightMinCheckbox").on("change", updatePlot);

            const startYearSelect = d3.select("#startYearSelect")
                .on("change", function() {
                    updateDropdowns('start');  
                    updatePlot();  
                });
            const endYearSelect = d3.select("#endYearSelect")
                .on("change", function() {
                    updateDropdowns('end');  
                    updatePlot();  
                });
        

            startYearSelect.node().value = "2001";
            endYearSelect.node().value = "2023";

            let prevEndYear = parseInt(endYearSelect.node().value);  
            let prevStartYear = parseInt(startYearSelect.node().value);  

            
            function updateDropdowns(trigger) {
                const selectedStartYear = parseInt(startYearSelect.node().value);
                const selectedEndYear = parseInt(endYearSelect.node().value);

                if (trigger === 'start') {
                    
                    prevEndYear = selectedEndYear;

                    
                    const filteredEndYears = years.filter(year => year >= selectedStartYear);

                    
                    endYearSelect.selectAll("option").remove();
                    filteredEndYears.forEach(year => {
                        endYearSelect.append("option")
                            .attr("value", year)
                            .text(year);
                    });

                    
                    if (prevEndYear >= selectedStartYear) {
                        endYearSelect.node().value = prevEndYear;  
                    } else {
                        
                        endYearSelect.node().value = filteredEndYears[filteredEndYears.length - 1];
                    }
                } else if (trigger === 'end') {
                    
                    prevStartYear = selectedStartYear;

                    
                    const filteredStartYears = years.filter(year => year < selectedEndYear);

                    
                    startYearSelect.selectAll("option").remove();
                    filteredStartYears.forEach(year => {
                        startYearSelect.append("option")
                            .attr("value", year)
                            .text(year);
                    });

                    
                    if (prevStartYear < selectedEndYear) {
                        startYearSelect.node().value = prevStartYear;  
                    } else {
                        
                        startYearSelect.node().value = filteredStartYears[filteredStartYears.length - 1];
                    }
                }
            }

            
            updateDropdowns('start');

            function updatePlot() {
                
                const { margin, width, height } = getDimensions();
                svgContainer
                    .attr("width", width + margin.left + margin.right)
                    .attr("height", height + margin.top + margin.bottom);

                svg.attr("transform", `translate(${margin.left},${margin.top})`);

                const selectedDistrict = districtSelect.node().value;
                const startYear = parseInt(startYearSelect.node().value);
                const endYear = parseInt(endYearSelect.node().value);

                const filteredData = jsonData.filter(d => {
                    return (selectedDistrict === "All" || d.Distrito === selectedDistrict) &&
                            d.Ano >= startYear && d.Ano <= endYear;
                });

                const plotData = [];
                filteredData.forEach(d => {
                    const yearIndex = plotData.findIndex(item => item.year === d.Ano);
                    const columns = d.Ano >= 2017
                        ? ['AreaArdPov_NoDistrito', 'AreaArdMato_NoDistrito', 'AreaArdAgric_NoDistrito']
                        : ['AreaArdPov_IncendioInicioDist', 'AreaArdMato_IncendioInicioDist', 'AreaArdAgric_IncendioInicioDist'];

                    if (yearIndex === -1) {
                        plotData.push({
                            year: d.Ano,
                            AreaArdPov: +d[columns[0]] || 0,
                            AreaArdMato: +d[columns[1]] || 0,
                            AreaArdAgric: +d[columns[2]] || 0
                        });
                    } else {
                        plotData[yearIndex].AreaArdPov += +d[columns[0]] || 0;
                        plotData[yearIndex].AreaArdMato += +d[columns[1]] || 0;
                        plotData[yearIndex].AreaArdAgric += +d[columns[2]] || 0;
                    }
                });

                plotData.forEach(d => {
                    d.TotalBurntArea = d.AreaArdPov + d.AreaArdMato + d.AreaArdAgric;
                });

                const xScale = d3.scaleLinear()
                    .domain([d3.min(plotData, d => d.year), d3.max(plotData, d => d.year)])
                    .range([0, width - 20]);

                
                const xAxis = d3.axisBottom(xScale).ticks(d3.max(plotData, d => d.year) - d3.min(plotData, d => d.year))
                   .tickFormat(d3.format("d")); 

                const yScale = d3.scaleLinear()
                    .domain([0, d3.max(plotData, d => Math.max(d.AreaArdPov, d.AreaArdMato, d.AreaArdAgric, d.TotalBurntArea))])
                    .range([height - 20, 0]);

                const linePov = d3.line()
                    .x(d => xScale(d.year))
                    .y(d => yScale(d.AreaArdPov));

                const lineMato = d3.line()
                    .x(d => xScale(d.year))
                    .y(d => yScale(d.AreaArdMato));

                const lineAgric = d3.line()
                    .x(d => xScale(d.year))
                    .y(d => yScale(d.AreaArdAgric));

                const lineTotal = d3.line()
                    .x(d => xScale(d.year))
                    .y(d => yScale(d.TotalBurntArea));

                svg.selectAll("*").remove();

                
                svg.selectAll(".grid")
                    .data(yScale.ticks(5))
                    .enter().append("line")
                    .attr("class", "grid")
                    .attr("x1", 0)
                    .attr("x2", width - 20)
                    .attr("y1", d => yScale(d))
                    .attr("y2", d => yScale(d))
                    .attr("stroke", "#ddd")
                    .attr("stroke-dasharray", "2,2");

                svg.selectAll(".grid")
                    .data(xScale.ticks(5))
                    .enter().append("line")
                    .attr("class", "grid")
                    .attr("x1", d => xScale(d))
                    .attr("x2", d => xScale(d))
                    .attr("y1", 0)
                    .attr("y2", height - 20)
                    .attr("stroke", "#ddd")
                    .attr("stroke-dasharray", "2,2");

                
                svg.append("g")
                .attr("transform", "translate(20," + (height - 20) + ")")
                .call(xAxis);

                svg.append("g")
                    .attr("transform", "translate(20, 0)")
                    .call(d3.axisLeft(yScale));




                svg.selectAll(".x-label").remove();
                svg.append("text")
                    .attr("class", "x-label")
                    .attr("x", width / 2)
                    .attr("y", height + 50)
                    .style("text-anchor", "middle")
                    .style("font-size", "14px")
                    .text("Year");

                svg.selectAll(".y-label").remove();
                svg.append("text")
                    .attr("class", "y-label")
                    .attr("transform", "rotate(-90)")
                    .attr("y", -60)
                    .attr("x", -(height / 2))
                    .style("text-anchor", "middle")
                    .style("font-size", "14px")
                    .text("Burnt Area (hectares)");

                
                function drawLineAndHighlight(line, data, lineClass, strokeColor, label) {
                    
                    svg.append("path")
                        .data([data])
                        .attr("class", lineClass)
                        .attr("d", line)
                        .attr("stroke", strokeColor)
                        .attr("stroke-width", 2.5)
                        .attr("stroke-dasharray", "6,3") 
                        .attr("fill", "none")
                        .attr("transform", "translate(20, 0)");
                
                    
                    svg.selectAll(`.${lineClass}-points`)
                    .data(data)
                    .enter()
                    .append("circle")
                    .attr("class", `${lineClass}-points`)
                    .attr("cx", d => xScale(d.year) + 20)
                    .attr("cy", d => yScale(d[lineClass]))
                    .attr("r", 6) 
                    .attr("fill", strokeColor)
                    .on("mouseover", function(event, d) {
                        
                        globalTooltip.style("visibility", "visible")
                            .html(`
                                <strong>District:</strong>: ${selectedDistrict}<br>
                                <strong>Year</strong>: ${d.year}<br>
                                <strong>Burnt Area</strong>: ${d[lineClass].toFixed(2)} ha<br>
                                <strong>Category</strong>: ${label}`)
                            .style("left", (event.pageX + 10) + "px")
                            .style("top", (event.pageY - 25) + "px");
                    })
                    .on("mousemove", function(event) {
                        
                        globalTooltip.style("left", (event.pageX + 10) + "px")
                            .style("top", (event.pageY - 25) + "px");
                    })
                    .on("mouseout", function() {
                        
                        globalTooltip.style("visibility", "hidden");
                    });
                
                    
                    const highlightMax = d3.select("#highlightMaxCheckbox").property("checked");
                    const highlightMin = d3.select("#highlightMinCheckbox").property("checked");
                
                    if (highlightMax) {
                        const maxValue = d3.max(data, d => d[lineClass]);
                        const maxPoint = data.find(d => d[lineClass] === maxValue);
                
                        
                        svg.append("circle")
                            .attr("cx", xScale(maxPoint.year) + 20)
                            .attr("cy", yScale(maxPoint[lineClass]))
                            .attr("r", 10) 
                            .attr("fill", strokeColor)
                            .attr("stroke", "black") 
                            .attr("stroke-width", 2);
                
                        
                        const textGroup = svg.append("g")
                            .attr("class", "highlight-label");
                
                        const textX = xScale(maxPoint.year) + 25;
                        const textY = yScale(maxPoint[lineClass]) - 10;
                        const textContent = `Max: ${maxValue.toFixed(2)}`; 
                
                        
                        const textElement = textGroup.append("text")
                            .attr("x", textX)
                            .attr("y", textY)
                            .attr("fill", strokeColor)
                            .text(textContent)
                            .style("font-size", "12px");
                
                        
                        const textBBox = textElement.node().getBBox();
                        textGroup.insert("rect", "text")
                            .attr("x", textBBox.x - 5) 
                            .attr("y", textBBox.y - 2)
                            .attr("width", textBBox.width + 10) 
                            .attr("height", textBBox.height + 4)
                            .attr("fill", "lightgray")  
                            .attr("stroke", strokeColor)
                            .attr("stroke-width", 0.5)
                            .attr("rx", 3); 
                    }
                
                    if (highlightMin) {
                        const minValue = d3.min(data, d => d[lineClass]);
                        const minPoint = data.find(d => d[lineClass] === minValue);
                
                        
                        svg.append("circle")
                            .attr("cx", xScale(minPoint.year) + 20)
                            .attr("cy", yScale(minPoint[lineClass]))
                            .attr("r", 8) 
                            .attr("fill", strokeColor)
                            .attr("stroke", "black") 
                            .attr("stroke-width", 2);
                
                        
                        const textGroup = svg.append("g")
                            .attr("class", "highlight-label");
                
                        const textX = xScale(minPoint.year) + 25;
                        const textY = yScale(minPoint[lineClass]) - 10;
                        const textContent = `Min: ${minValue.toFixed(2)}`; 
                
                        
                        const textElement = textGroup.append("text")
                            .attr("x", textX)
                            .attr("y", textY)
                            .attr("fill", strokeColor)
                            .text(textContent)
                            .style("font-size", "12px");
                
                        
                        const textBBox = textElement.node().getBBox();
                        textGroup.insert("rect", "text")
                            .attr("x", textBBox.x - 5) 
                            .attr("y", textBBox.y - 2)
                            .attr("width", textBBox.width + 10) 
                            .attr("height", textBBox.height + 4)
                            .attr("fill", "lightgray")  
                            .attr("stroke", strokeColor)
                            .attr("stroke-width", 0.5)
                            .attr("rx", 3); 
                    }
                }
                
                
                
                
                

                if (d3.select("#povCheckbox").property("checked")) {
                    drawLineAndHighlight(linePov, plotData, "AreaArdPov", "red", "Forest");
                }
                if (d3.select("#matoCheckbox").property("checked")) {
                    drawLineAndHighlight(lineMato, plotData, "AreaArdMato", "orange", "Scrubland");
                }
                if (d3.select("#agricCheckbox").property("checked")) {
                    drawLineAndHighlight(lineAgric, plotData, "AreaArdAgric", "yellow", "Agriculutral");
                }
                if (d3.select("#totalCheckbox").property("checked")) {
                    drawLineAndHighlight(lineTotal, plotData, "TotalBurntArea", "black", "Total Burnt Area");
                }
            }

            updatePlot();

            
            window.addEventListener("resize", updatePlot);
        })
        .catch(error => console.error(error));
}


function initializeScatterPlot() {
    const container = d3.select("#scatterPlot");

    
    const districtDropdownButton = document.getElementById("districtDropdownButton");
    const districtDropdown = document.getElementById("districtDropdown");

    
    districtDropdownButton.addEventListener("click", function() {
        districtDropdown.classList.toggle("show");
    });

    
    document.addEventListener("click", function(event) {
        if (!districtDropdownButton.contains(event.target) && !districtDropdown.contains(event.target)) {
            districtDropdown.classList.remove("show");
        }
        if (!yearDropdownButton.contains(event.target) && !yearDropdown.contains(event.target)) {
            yearDropdown.classList.remove("show");
        }
    });

    
    const yearDropdownButton = document.getElementById("yearDropdownButton");
    const yearDropdown = document.getElementById("yearDropdown");

    
    yearDropdownButton.addEventListener("click", function() {
        yearDropdown.classList.toggle("show");
    });

    
    const districtAllCheckbox = document.getElementById("districtAll");
    const yearAllCheckbox = document.getElementById("yearAll");

    
    function handleDistrictCheckboxChange() {
        const districtCheckboxes = document.querySelectorAll("#districtDropdown input[type='checkbox']:not(#districtAll)");

        
        const allChecked = Array.from(districtCheckboxes).every(checkbox => checkbox.checked);
        
        
        districtAllCheckbox.checked = allChecked;
        districtAllCheckbox.indeterminate = !allChecked && Array.from(districtCheckboxes).some(checkbox => checkbox.checked);  
    }

    
    function handleYearCheckboxChange() {
        const yearCheckboxes = document.querySelectorAll("#yearDropdown input[type='checkbox']:not(#yearAll)");

        
        const allChecked = Array.from(yearCheckboxes).every(checkbox => checkbox.checked);
        
        
        yearAllCheckbox.checked = allChecked;
        yearAllCheckbox.indeterminate = !allChecked && Array.from(yearCheckboxes).some(checkbox => checkbox.checked);  
    }

    
    document.querySelectorAll("#districtDropdown input[type='checkbox']").forEach(checkbox => {
        checkbox.addEventListener("change", handleDistrictCheckboxChange);
    });

    document.querySelectorAll("#yearDropdown input[type='checkbox']").forEach(checkbox => {
        checkbox.addEventListener("change", handleYearCheckboxChange);
    });

    
    districtAllCheckbox.addEventListener("change", function() {
        const districtCheckboxes = document.querySelectorAll("#districtDropdown input[type='checkbox']:not(#districtAll)");
        
        districtCheckboxes.forEach(checkbox => {
            checkbox.checked = districtAllCheckbox.checked; 
        });

        
        handleDistrictCheckboxChange(); 
    });

    yearAllCheckbox.addEventListener("change", function() {
        const yearCheckboxes = document.querySelectorAll("#yearDropdown input[type='checkbox']:not(#yearAll)");
        
        yearCheckboxes.forEach(checkbox => {
            checkbox.checked = yearAllCheckbox.checked; 
        });

        
        handleYearCheckboxChange(); 
    });

    
    districtAllCheckbox.addEventListener("click", function() {
        const districtCheckboxes = document.querySelectorAll("#districtDropdown input[type='checkbox']:not(#districtAll)");
        districtCheckboxes.forEach(checkbox => {
            checkbox.checked = districtAllCheckbox.checked; 
        });
        handleDistrictCheckboxChange(); 
    });

    yearAllCheckbox.addEventListener("click", function() {
        const yearCheckboxes = document.querySelectorAll("#yearDropdown input[type='checkbox']:not(#yearAll)");
        yearCheckboxes.forEach(checkbox => {
            checkbox.checked = yearAllCheckbox.checked; 
        });
        handleYearCheckboxChange(); 
    });



    
    function getDimensions() {
        const containerWidth = container.node().getBoundingClientRect().width;
        const containerHeight = container.node().getBoundingClientRect().height;

        const margin = {
            top: containerHeight * 0.05,
            right: containerWidth * 0.03,
            bottom: containerHeight * 0.15,
            left: containerWidth * 0.06
        };

        const width = containerWidth - margin.left - margin.right;
        const height = containerHeight - margin.top - margin.bottom;

        return { margin, width, height };
    }

    
    const svgContainer = container
        .append("svg")
        .attr("class", "chart-svg");

    const svg = svgContainer.append("g");

    
    fetch('resources/data/data.xlsx')
        .then(response => response.arrayBuffer())
        .then(data => {
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets['Estatisticas_Distrito'];
            const jsonData = XLSX.utils.sheet_to_json(sheet);

            const scatterData = jsonData.map(row => {
                const year = row.Ano;
                const burntArea = year >= 2017 ? row.AreaArdTotal_NoDistrito : row.AreaArdTotal_IncendioInicioDist;
                return {
                    district: row.Distrito,
                    year: year,
                    burntArea: +burntArea,
                    totalFires: +row.Num_IncendiosRurais
                };
            });

            
            const districts = [...new Set(scatterData.map(d => d.district))].sort();
            const colorScale = d3.scaleOrdinal()
                .domain(districts)
                .range([
                    "#FF6347", "#FFD700", "#ADFF2F", "#7FFF00", "#40E0D0", 
                    "#8A2BE2", "#FF69B4", "#00CED1", "#32CD32", "#FF4500", 
                    "#DC143C", "#00FF00", "#FFD700", "#FF8C00", "#D2691E", 
                    "#00BFFF", "#FF1493", "#C71585", "#9ACD32", "#B22222" 
                ]);  


            
            let hideNonHighlighted = false; 

            
            const toggleButton = document.getElementById("toggleHideButton");
            toggleButton.addEventListener("click", function () {
                hideNonHighlighted = !hideNonHighlighted; 

                
                if (hideNonHighlighted) {
                    toggleButton.textContent = "Show Non-Highlighted Points"; 
                } else {
                    toggleButton.textContent = "Hide Non-Highlighted Points"; 
                }

                updateChart(); 
            });

            
            function updateChart() {
                const { margin, width, height } = getDimensions();

                
                svgContainer
                    .attr("width", width + margin.left + margin.right)
                    .attr("height", height + margin.top + margin.bottom);

                svg.attr("transform", `translate(${margin.left},${margin.top})`);

                
                const xScale = d3.scaleLinear()
                    .domain([0, d3.max(scatterData, d => d.burntArea)])
                    .range([0, width]);

                const yScale = d3.scaleLinear()
                    .domain([0, d3.max(scatterData, d => d.totalFires)])
                    .range([height, 0]);

                
                const xGrid = d3.axisBottom(xScale)
                    .tickSize(-height)
                    .tickFormat(''); 

                const yGrid = d3.axisLeft(yScale)
                    .tickSize(-width)
                    .tickFormat(''); 

                
                svg.selectAll(".x-grid").remove();
                svg.append("g")
                    .attr("class", "x-grid")
                    .attr("transform", `translate(0,${height})`)
                    .call(xGrid)
                    .selectAll("line")
                    .style("stroke", "#e0e0e0") 
                    .style("stroke-dasharray", "2,2"); 

                svg.selectAll(".x-grid path").remove(); 

                
                svg.selectAll(".y-grid").remove();
                svg.append("g")
                    .attr("class", "y-grid")
                    .call(yGrid)
                    .selectAll("line")
                    .style("stroke", "#e0e0e0") 
                    .style("stroke-dasharray", "2,2"); 

                svg.selectAll(".y-grid path").remove(); 

                
                svg.selectAll(".x-axis").remove();
                svg.append("g")
                    .attr("class", "x-axis")
                    .attr("transform", `translate(0,${height})`)
                    .call(d3.axisBottom(xScale));

                svg.selectAll(".y-axis").remove();
                svg.append("g")
                    .attr("class", "y-axis")
                    .call(d3.axisLeft(yScale));

                
                svg.selectAll(".x-label").remove();
                svg.append("text")
                    .attr("class", "x-label")
                    .attr("x", width / 2)
                    .attr("y", height + 50)
                    .style("text-anchor", "middle")
                    .style("font-size", "14px")
                    .text("Area Burnt (in hectares)");

                svg.selectAll(".y-label").remove();
                svg.append("text")
                    .attr("class", "y-label")
                    .attr("transform", "rotate(-90)")
                    .attr("y", -60)
                    .attr("x", -(height / 2))
                    .style("text-anchor", "middle")
                    .style("font-size", "14px")
                    .text("Number of Rural Fires");

                
                const selectedYears = Array.from(document.getElementById("yearDropdown")
                    ? document.getElementById("yearDropdown").querySelectorAll('input[type="checkbox"]:checked')
                    : [])
                    .map(input => input.value);

                
                const selectedDistricts = Array.from(document.getElementById("districtDropdown")
                    ? document.getElementById("districtDropdown").querySelectorAll('input[type="checkbox"]:checked')
                    : [])
                    .map(input => input.value);

                
                const yearMatchFilter = (selectedYears.includes("All") || selectedYears.length === 0)
                    ? scatterData 
                    : scatterData.filter(d => selectedYears.includes(d.year.toString()));

                const filteredData = yearMatchFilter.filter(d => {
                    const district = d.district.trim().toLowerCase();
                    const normalizedSelectedDistricts = selectedDistricts.map(district => district.trim().toLowerCase());
                    return (normalizedSelectedDistricts.length === 0 || normalizedSelectedDistricts.includes(district));
                });

                const nonSelectedCircles = svg.selectAll(".non-selected-point")
                    .data(scatterData.filter(d => !filteredData.includes(d)), d => `${d.district}-${d.year}`);

                nonSelectedCircles.enter()
                    .append("circle")
                    .attr("class", "non-selected-point")
                    .merge(nonSelectedCircles)
                    .transition()
                    .duration(500)
                    .attr("cx", d => xScale(d.burntArea))
                    .attr("cy", d => yScale(d.totalFires))
                    .attr("r", hideNonHighlighted ? 0 : 4) 
                    .attr("fill", "gray") 
                    .style("opacity", hideNonHighlighted ? 0 : 1); 

                nonSelectedCircles.exit().remove();

                
                const selectedCircles = svg.selectAll(".selected-point")
                    .data(filteredData, d => `${d.district}-${d.year}`);

                const selectedEnter = selectedCircles.enter()
                    .append("circle")
                    .attr("class", "selected-point");

                selectedEnter.merge(selectedCircles)
                    .transition()
                    .duration(500)
                    .attr("cx", d => xScale(d.burntArea))
                    .attr("cy", d => yScale(d.totalFires))
                    .attr("r", 8) 
                    .attr("fill", d => colorScale(d.district)) 
                    .style("opacity", 1);

                selectedCircles.exit().remove();

                
                svg.selectAll(".selected-point").each(function () {
                    this.parentNode.appendChild(this);
                });

                
                svg.selectAll("circle")
                    .on("mouseover", function (event, d) {
                        globalTooltip
                            .style("visibility", "visible")
                            .html(`
                                <strong>District:</strong> ${d.district}<br>
                                <strong>Year:</strong> ${d.year}<br>
                                <strong>Total Fires:</strong> ${d.totalFires}<br>
                                <strong>Burnt Area:</strong> ${d.burntArea.toLocaleString()} hectares
                            `);
                    })
                    .on("mousemove", function (event) {
                        globalTooltip
                            .style("left", `${Math.min(event.pageX + 10, window.innerWidth - globalTooltip.node().offsetWidth - 10)}px`)
                            .style("top", `${Math.min(event.pageY - 28, window.innerHeight - globalTooltip.node().offsetHeight - 10)}px`);
                    })
                    .on("mouseout", function () {
                        globalTooltip.style("visibility", "hidden");
                    });



            }


            
            document.getElementById("yearDropdown").addEventListener("change", updateChart);
            document.getElementById("districtDropdown").addEventListener("change", updateChart);

            
            updateChart();

            
            window.addEventListener("resize", updateChart);
        })
        .catch(error => console.error("Error loading Excel file:", error));
}



function fillDropdown() {
    
    fetch('resources/data/data.xlsx')
        .then(response => response.arrayBuffer())
        .then(data => {
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets['Estatisticas_Distrito'];
            const jsonData = XLSX.utils.sheet_to_json(sheet);

            const years = Array.from(new Set(jsonData.map(row => row.Ano))).sort((a, b) => a - b);
            const districts = Array.from(new Set(jsonData.map(row => row.Distrito))).sort();

            
            const yearSelect = document.getElementById("yearSelect");

            years.forEach(year => {
                const option = document.createElement("option");
                option.value = year;
                option.text = year;
                yearSelect.add(option);
            });

            
            const yearDropdown = document.getElementById("yearDropdown");
            yearDropdown.innerHTML = ""; 

            
            const allYearsLabel = document.createElement("label");
            allYearsLabel.innerHTML = `<input type="checkbox" id="yearAll" value="All"> All`;
            yearDropdown.appendChild(allYearsLabel);
            yearDropdown.appendChild(document.createElement("br"));

            
            years.forEach(year => {
                const label = document.createElement("label");
                label.innerHTML = `<input type="checkbox" value="${year}" checked> ${year}`;
                yearDropdown.appendChild(label);
                yearDropdown.appendChild(document.createElement("br"));
            });

            
            const districtDropdown = document.getElementById("districtDropdown");
            districtDropdown.innerHTML = ""; 

            
            const allDistrictsLabel = document.createElement("label");
            allDistrictsLabel.innerHTML = `<input type="checkbox" id="districtAll" value="All"> All`;
            districtDropdown.appendChild(allDistrictsLabel);
            districtDropdown.appendChild(document.createElement("br"));

            
            districts.forEach(district => {
                const label = document.createElement("label");
                label.innerHTML = `<input type="checkbox" value="${district}" checked> ${district}`;
                districtDropdown.appendChild(label);
                districtDropdown.appendChild(document.createElement("br"));
            });

            
            const districtSelect = document.getElementById("districtSelect");
            districtSelect.innerHTML = ""; 

            
            const allDistrictOption = document.createElement("option");
            allDistrictOption.value = "All";
            allDistrictOption.text = "All";
            districtSelect.appendChild(allDistrictOption);

            
            districts.forEach(district => {
                const option = document.createElement("option");
                option.value = district;
                option.text = district;
                districtSelect.appendChild(option);
            });

            
            const startYearSelect = document.getElementById("startYearSelect");
            const endYearSelect = document.getElementById("endYearSelect");

            startYearSelect.innerHTML = ""; 
            endYearSelect.innerHTML = ""; 

            
            years.forEach(year => {
                const startOption = document.createElement("option");
                startOption.value = year;
                startOption.text = year;
                startYearSelect.add(startOption);

                const endOption = document.createElement("option");
                endOption.value = year;
                endOption.text = year;
                endYearSelect.add(endOption);
            });

            
            if (years.length > 0) {
                startYearSelect.value = years[0];
                endYearSelect.value = years[years.length - 1];
            }
        })
        .catch(error => console.error("Error loading Excel file:", error));
}

function fillDropdownCauses() {
    
    fetch('resources/data/data.xlsx')
        .then(response => response.arrayBuffer())
        .then(data => {
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetDistrict = workbook.Sheets['Estatisticas_Distrito'];
            const jsonDataDistrict = XLSX.utils.sheet_to_json(sheetDistrict);

            const sheetCouncil = workbook.Sheets['Estatisticas_Concelho'];
            const jsonDataCouncil = XLSX.utils.sheet_to_json(sheetCouncil);

            const years = Array.from(new Set(jsonDataDistrict.map(row => row.Ano))).sort((a, b) => a - b);
            const districts = Array.from(new Set(jsonDataDistrict.map(row => row.Distrito))).sort();

            
            const councilsByDistrict = {};
            jsonDataCouncil.forEach(row => {
                const district = row.Distrito.trim();
                const council = row.Concelho.trim();

                if (!councilsByDistrict[district]) {
                    councilsByDistrict[district] = new Set();
                }
                councilsByDistrict[district].add(council);
            });

            
            function enforceMaxSelection(container, max) {
                const checkboxes = container.querySelectorAll("input[type=checkbox]");
                checkboxes.forEach(checkbox => {
                    checkbox.addEventListener("change", function () {
                        const selectedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
                        if (selectedCount > max) {
                            checkbox.checked = false;
                            console.warn(`You can select up to ${max} options only.`);
                        }
                    });
                });
            }

            
            const yearDropdown = document.getElementById("yearDropdownCauses");
            yearDropdown.innerHTML = ""; 

            years.forEach(year => {
                const label = document.createElement("label");
                label.innerHTML = `<input type="checkbox" value="${year}"> ${year}`;
                yearDropdown.appendChild(label);
                yearDropdown.appendChild(document.createElement("br"));
            });

            
            enforceMaxSelection(yearDropdown, 3);

            
            const districtDropdownButton = document.getElementById("districtDropdownButtonCauses");
            districtDropdownButton.disabled = true; 
            districtDropdownButton.style.backgroundColor = "grey";

            
            const councilDropdownButton = document.getElementById("councilDropdownButtonCauses");
            councilDropdownButton.disabled = true; 
            councilDropdownButton.style.backgroundColor = "grey";

            
            yearDropdown.addEventListener("change", function () {
                const selectedYears = Array.from(yearDropdown.querySelectorAll("input[type=checkbox]:checked"))
                    .map(checkbox => checkbox.value);

                if (selectedYears.length === 1) {
                    districtDropdownButton.disabled = false;
                    districtDropdownButton.style.backgroundColor = "#4CAF50";
                } else {
                    districtDropdownButton.disabled = true;
                    districtDropdownButton.style.backgroundColor = "grey";
                }
            });

            
            const districtDropdown = document.getElementById("districtDropdownCauses");
            districtDropdown.innerHTML = ""; 

            districts.forEach(district => {
                const label = document.createElement("label");
                label.innerHTML = `<input type="checkbox" value="${district}"> ${district}`;
                districtDropdown.appendChild(label);
                districtDropdown.appendChild(document.createElement("br"));
            });

            
            enforceMaxSelection(districtDropdown, 3);

            
            const councilDropdown = document.getElementById("councilDropdownCauses");
            councilDropdown.innerHTML = ""; 

            
            districtDropdown.addEventListener("change", function () {
                const selectedDistricts = Array.from(districtDropdown.querySelectorAll("input[type=checkbox]:checked"))
                    .map(checkbox => checkbox.value);

                if (selectedDistricts.length === 1) {
                    const selectedDistrict = selectedDistricts[0];

                    councilDropdownButton.disabled = false;
                    councilDropdownButton.style.backgroundColor = "#4CAF50";

                    const councils = Array.from(councilsByDistrict[selectedDistrict] || []);
                    councilDropdown.innerHTML = ""; 

                    councils.forEach(council => {
                        const label = document.createElement("label");
                        label.innerHTML = `<input type="checkbox" value="${council}"> ${council}`;
                        councilDropdown.appendChild(label);
                        councilDropdown.appendChild(document.createElement("br"));
                    });

                    
                    enforceMaxSelection(councilDropdown, 3);
                } else {
                    councilDropdownButton.disabled = true;
                    councilDropdownButton.style.backgroundColor = "grey";
                    councilDropdown.innerHTML = ""; 
                }
            });
        })
        .catch(error => console.error("Error loading Excel file:", error));
}



const globalTooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("background-color", "white")
    .style("border", "1px solid #ccc")
    .style("padding", "10px")
    .style("border-radius", "4px")
    .style("font-size", "12px")
    .style("visibility", "hidden")
    .style("pointer-events", "none");


document.addEventListener("DOMContentLoaded", () => {
    let isBurntAreaInitialized = false; 
    let isTemporalAnalysisInitialized = false; 
    let isCausesInitialized = false; 
    
    
    function updateSidebarContent(view) {
        const sidebarText = document.querySelector('.sidebar-text');
        
        
        sidebarText.innerHTML = ''; 

        if (view === 'Burnt Area') {
            sidebarText.innerHTML = `
                <h2>Burnt Area</h2>
                <p>The Burnt Area tab provides a yearly analysis of the areas affected by rural fires in Portugal. It allows users to explore the spatial distribution and extent of burnt areas across different regions on a yearly basis.</p>
                <ul>
                    <li><strong>Map</strong>: Visualizes the burnt area in each district, with color intensity representing the extent of the burnt area.</li>
                    <li><strong>Histogram</strong>: Displays the distribution of burnt area by land type (forest, scrubland, agricultural) across different years.</li>
                    <li><strong>Normalized Histogram</strong>: Shows the number of fires within different area categories, with an option to toggle between raw and normalized data.</li>
                </ul>
                <div style="background-color: rgba(0, 0, 0, 0.1); border-radius: 15px; padding: 10px; display: inline-block;">
                    <img src="resources/images/portugal_fire.jpeg" alt="Portugal Fire Map" style="width: 100%; max-width: 400px; margin-top: 20px; border-radius: 15px; object-fit: cover;">
                </div>
            `;
        } else if (view === 'Temporal Analysis') {
            sidebarText.innerHTML = `
                <h2>Temporal Analysis</h2>
                <p>The Temporal Analysis tab focuses on examining how fire activity has changed over time. It explores the relationship between the number of fires and the total burnt area, helping to reveal trends, correlations, and shifts in fire intensity over the years.</p>
                <ul>
                    <li><strong>Scatter Plot</strong>: Analyzes the relationship between the number of fires and the total burnt area across years for each district. Points on the plot represent districts, with color coding to track changes over time.</li>
                    <li><strong>Line Plot</strong>: Visualizes trends in burnt areas for different land categories (forest, scrubland, agricultural) and the total burnt area, helping to compare changes in fire activity across multiple years.</li>
                </ul>
                <div style="background-color: rgba(0, 0, 0, 0.1); border-radius: 15px; padding: 10px; display: inline-block;">
                    <img src="resources/images/portugal_fire2.jpg" alt="Portugal Fire Map" style="width: 100%; max-width: 400px; margin-top: 20px; border-radius: 15px; object-fit: cover;">
                </div>
            `;
        } else if (view === 'Causes') {
            sidebarText.innerHTML = `
                <h2>Causes of Fires</h2>
                <p>The Causes tab delves into the underlying factors behind rural fires in Portugal. It categorizes the causes into six distinct groups: natural, negligent, intentional, reignition, undetermined, and not investigated. This tab aims to help users understand the primary drivers of fire occurrences.</p>
                <ul>
                    <li><strong>Dot Plot</strong>: Visualizes the distribution of various causes of fires in percentage.</li>
                    <li><strong>Spider Chart</strong>: Allows you to compare data on the various causes of fire from different years, districts and counties.</li>
                </ul>
                <div style="background-color: rgba(0, 0, 0, 0.1); border-radius: 15px; padding: 10px; display: inline-block;">
                    <img src="resources/images/portugal_fire3.jpeg" alt="Portugal Fire Causes" style="width: 100%; max-width: 400px; margin-top: 20px; border-radius: 15px; object-fit: cover;">
                </div>
            `;
        } else {
            
            sidebarText.innerHTML = `
                <h2>Dataset Description</h2>
                <p>This dataset provides statistics on rural fires in Portugal, categorized by national, district, and municipality levels. It includes data on the number of fires, burned area (in hectares), fire causes, and fire duration (with a focus on fires lasting over 24 hours).</p>
                <ul>
                    <li><strong>Num_IncendiosRurais:</strong> Total number of rural fires.</li>
                    <li><strong>AreaArdPov:</strong> Burnt area in forest plantations (ha).</li>
                    <li><strong>AreaArdMato:</strong> Burnt area in shrubland (ha).</li>
                    <li><strong>AreaArdAgric:</strong> Burnt area in agriculture (ha).</li>
                    <li><strong>AreaArdTotal:</strong> Total burnt area (ha).</li>
                    <li><strong>NIncRur_0_1ha to NIncRur_1000_n_ha:</strong> Fires by burnt area size (from <1 ha to ≥1000 ha).</li>
                    <li><strong>Fire Causes:</strong> Natural, negligent, intentional, reignition, undetermined, or not investigated.</li>
                    <li><strong>Ninc_Sup24h:</strong> Fires lasting more than 24 hours.</li>
                </ul>
                <p><strong>Available at:</strong></p>
                <a href="https:
                    <img src="resources/images/icnf_logo.png" alt="ICNF Logo" class="sidebar-image">
                </a>
            `;
        }
    }

    
    function showView(viewId, buttonId) {
        const buttons = document.querySelectorAll('.navbar button');
        buttons.forEach(button => button.classList.remove('active'));
        document.getElementById(buttonId).classList.add('active');
    
        
        document.querySelectorAll('.content-container').forEach(container => {
            container.classList.remove('active');
        });
    
        
        document.getElementById(viewId).classList.add('active');
    
        const burnedAreaContainer = document.getElementById('burnedAreaContainer');
        const causesContainer = document.getElementById('causesContainer');
        const temporalAnalysisContainer = document.getElementById('temporalAnalysisContainer');
        const mainPageContainer = document.getElementById('mainPageContainer');

        
        if (viewId === 'burnedAreaContainer') {
            burnedAreaContainer.style.display = 'flex';  
            causesContainer.style.display = 'none';
            temporalAnalysisContainer.style.display = 'none';
            mainPageContainer.style.display = 'none';
            updateSidebarContent('Burnt Area');

            
            if (!isBurntAreaInitialized) {
                initializeBurntAreaView();
                isBurntAreaInitialized = true; 
            }
        } else if (viewId === 'temporalAnalysisContainer') {
            burnedAreaContainer.style.display = 'none';
            causesContainer.style.display = 'none';
            temporalAnalysisContainer.style.display = 'flex';
            mainPageContainer.style.display = 'none';
            updateSidebarContent('Temporal Analysis');

            
            if (!isTemporalAnalysisInitialized) {
                initializeTemporalAnalysisView();
                isTemporalAnalysisInitialized = true; 
            }
        } else if (viewId === 'causesContainer') {
            burnedAreaContainer.style.display = 'none';
            causesContainer.style.display = 'flex';
            temporalAnalysisContainer.style.display = 'none';
            mainPageContainer.style.display = 'none';
            updateSidebarContent('Causes');

            
            if (!isCausesInitialized) {
                initializeCausesView();
                isCausesInitialized = true; 
            }
        } else {
            burnedAreaContainer.style.display = 'none';
            causesContainer.style.display = 'none';
            temporalAnalysisContainer.style.display = 'none';
            mainPageContainer.style.display = 'flex';
            updateSidebarContent('Main Page');
        }
    }

    
    document.getElementById('mainPageBtn').addEventListener('click', () => {
        showView('mainPageContainer', 'mainPageBtn');
    });

    document.getElementById('burntAreaBtn').addEventListener('click', () => {
        showView('burnedAreaContainer', 'burntAreaBtn');
    });
    document.getElementById('causesBtn').addEventListener('click', () => {
        showView('causesContainer', 'causesBtn');
    });
    document.getElementById('temporalAnalysisBtn').addEventListener('click', () => {
        showView('temporalAnalysisContainer', 'temporalAnalysisBtn');
    });

    
    document.getElementById('burntAreaColumn').addEventListener('click', () => {
        showView('burnedAreaContainer', 'burntAreaBtn');
    });
    document.getElementById('causesColumn').addEventListener('click', () => {
        showView('causesContainer', 'causesBtn');
    });
    document.getElementById('temporalAnalysisColumn').addEventListener('click', () => {
        showView('temporalAnalysisContainer', 'temporalAnalysisBtn');
    });

    
    fillDropdown();

    fillDropdownCauses();

    
    function initializeBurntAreaView() {
        initializeMap();
        initializeHistogram();
        initializeNormalizedHistogram();
    }

    function initializeTemporalAnalysisView() {
        initializeScatterPlot();
        initializeLinePlot();
        
    }

    function initializeCausesView() {
        initializeDotPlot();
        initializeSpiderChart();
    }
});

    