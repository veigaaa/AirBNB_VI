
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
            const burnedData = dataForYear.find(d => d.Distrito.trim().toUpperCase() === districtName.trim().toUpperCase());
    
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

    // ---------------------- //
    //  HELPER: Layout calc   //
    // ---------------------- //
    function getDimensions(labels = []) {

        const containerWidth = container.node().getBoundingClientRect().width;
        const containerHeight = container.node().getBoundingClientRect().height;

        // Temporary SVG to measure label size
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

        const maxLabelWidth = Math.max(
            ...tempText.nodes().map(node => node.getBBox().width)
        );

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

    // SVG setup
    const svgContainer = container.append("svg").attr("class", "chart-svg");
    const svg = svgContainer.append("g");

    // ---------------------- //
    //     LOAD HELPERS       //
    // ---------------------- //

    function loadSheetData(sheetName) {
        return fetch(url)
            .then(resp => resp.arrayBuffer())
            .then(buf => {
                const wb = XLSX.read(buf, { type: "array" });
                const sheet = wb.Sheets[sheetName];
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
        return loadSheetData("Estatisticas_Concelho").then(all => {
            return all.filter(
                d => d.Distrito.toUpperCase() === selectedDistrito.toUpperCase()
            );
        });
    }

    // ---------------------- //
    //        HTML DOM        //
    // ---------------------- //

    const modeSelect = document.getElementById("dotplotMode");
    const primarySelect = document.getElementById("primarySelect");
    const secondarySelect = document.getElementById("secondarySelect");
    const primaryLabel = document.getElementById("primaryLabel");
    const secondaryLabel = document.getElementById("secondaryLabel");
    const orderSelect = document.getElementById("orderSelect");

    // Data storage
    let dotplotData = null;

    // ---------------------- //
    //  LOAD INITIAL DATA     //
    // ---------------------- //

    fetch(url)
        .then(r => r.arrayBuffer())
        .then(b => {
            const wb = XLSX.read(b, { type: "array" });
            const sheet = wb.Sheets["Estatisticas_Distrito"];
            dotplotData = XLSX.utils.sheet_to_json(sheet);

            fillDotplotDropdowns();
            // ⬇️ definir defaults
            modeSelect.value = "Years";        // Select: Years
            orderSelect.value = "Natural";     // Order By: Natural
            primarySelect.value = "All";       // Select Years: All
            secondarySelect.value = "All";     // Select Districts: All

            // desenhar pela primeira vez
            updateDotPlot();
        });

    // ---------------------- //
    //   DROPDOWN LOGIC       //
    // ---------------------- //

    modeSelect.addEventListener("change", () => {
        fillDotplotDropdowns();
        updateDotPlot();
    });

    primarySelect.addEventListener("change", updateDotPlot);
    secondarySelect.addEventListener("change", updateDotPlot);
    orderSelect.addEventListener("change", updateDotPlot);

    function fillDotplotDropdowns() {

        if (!dotplotData) return;

        primarySelect.innerHTML = "";
        secondarySelect.innerHTML = "";

        const mode = modeSelect.value;

        const anos = [...new Set(dotplotData.map(r => r.Ano))].sort((a, b) => b - a);
        const distritos = [...new Set(dotplotData.map(r => r.Distrito))].sort();

        const addOption = (select, value, label) => {
            const opt = document.createElement("option");
            opt.value = value;
            opt.textContent = label;
            select.appendChild(opt);
        };

        if (mode === "Years") {
            // 1ª opção = Years → 2º select = anos, 3º = distritos
            primaryLabel.textContent = "Year:";
            secondaryLabel.textContent = "District:";

            addOption(primarySelect, "All", "All");
            anos.forEach(a => addOption(primarySelect, String(a), String(a)));

            addOption(secondarySelect, "All", "All");
            distritos.forEach(d => addOption(secondarySelect, d, d));

            primarySelect.value = "All";
            secondarySelect.value = "All";

        } else {
            // 1ª opção = Districts → 2º select = distritos, 3º = anos
            primaryLabel.textContent = "District:";
            secondaryLabel.textContent = "Year:";

            addOption(primarySelect, "All", "All");
            distritos.forEach(d => addOption(primarySelect, d, d));

            addOption(secondarySelect, "All", "All");
            anos.forEach(a => addOption(secondarySelect, String(a), String(a)));

            primarySelect.value = "All";
            secondarySelect.value = "All";
        }
    }


    // ---------------------- //
    //   PROCESS RAW DATA     //
    // ---------------------- //

    function processAndSortData(data, filterKey, sortOrder) {

        const grouped = data.reduce((acc, d) => {
            const key = d[filterKey];
            if (!acc[key]) {
                acc[key] = {
                    key,
                    ...Object.fromEntries(
                        Object.keys(d)
                            .filter(k => k.startsWith("NInc"))
                            .map(k => [k, 0])
                    )
                };
            }

            Object.keys(acc[key]).forEach(field => {
                if (field !== "key") acc[key][field] += d[field] || 0;
            });

            return acc;
        }, {});

        const finalData = Object.values(grouped).map(d => {
            const total = Object.keys(d)
                .filter(k => k.startsWith("NInc"))
                .reduce((s, k) => s + d[k], 0);

            return {
                key: d.key,
                causes: [
                    { name: "Natural", percentage: total ? d.NInc_Natural / total * 100 : 0, count: d.NInc_Natural },
                    { name: "Intencionais", percentage: total ? d.NInc_Intencionais / total * 100 : 0, count: d.NInc_Intencionais },
                    { name: "Negligente", percentage: total ? d.NInc_Negligente / total * 100 : 0, count: d.NInc_Negligente },
                    { name: "Reacendimentos", percentage: total ? d.NInc_Reacendimentos / total * 100 : 0, count: d.NInc_Reacendimentos },
                    { name: "Desconhecida", percentage: total ? d.NInc_Desconhecida / total * 100 : 0, count: d.NInc_Desconhecida },
                    { name: "Não Investigados", percentage: total ? d.NInc_NaoInvestigados / total * 100 : 0, count: d.NInc_NaoInvestigados }
                ]
            };
        });

        // Sort by selected cause
        return finalData.sort((a, b) => {
            const cA = a.causes.find(c => c.name === sortOrder);
            const cB = b.causes.find(c => c.name === sortOrder);
            return (cB ? cB.percentage : 0) - (cA ? cA.percentage : 0);
        });
    }

    // ---------------------- //
    //    RENDER DOTPLOT      //
    // ---------------------- //

    const causeTranslations = {
        "Natural": "Natural",
        "Intencionais": "Intentional",
        "Negligente": "Negligent",
        "Reacendimentos": "Reignitions",
        "Desconhecida": "Unknown",
        "Não Investigados": "Not Investigated"
    };

    function renderDotPlot(data, orderType) {

        const { margin, width, height } = getDimensions(data.map(d => d.key));

        svgContainer
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom + 60);

        svg.attr("transform", `translate(${margin.left},${margin.top})`);
        svg.selectAll("*").remove();

        // Tooltip
        const tooltip = d3.select("body")
            .append("div")
            .attr("class", "tooltip")
            .style("position", "absolute")
            .style("background-color", "white")
            .style("border", "1px solid black")
            .style("padding", "10px")
            .style("border-radius", "4px")
            .style("visibility", "hidden")
            .style("font-size", "12px");

        // X and Y scales
        const xScale = d3.scaleLinear()
            .domain([0, 100])
            .range([0, width*0.90]);

        const yScale = d3.scalePoint()
            .domain(data.map(d => d.key))
            .range([0, height])
            .padding(1);

        // Colors
        const colorScale = d3.scaleOrdinal()
            .domain([
                "Natural",
                "Intencionais",
                "Negligente",
                "Reacendimentos",
                "Desconhecida",
                "Não Investigados"
            ])
            .range([
                "#1f77b4",
                "#ff7f0e",
                "#2ca02c",
                "#d62728",
                "#9467bd",
                "#8c564b"
            ]);

        // Draw lines
        data.forEach(d => {

            const lineData = d.causes.map(c => ({
                x: xScale(c.percentage),
                y: yScale(d.key)
            }));

            const lineGen = d3.line()
                .x(p => p.x)
                .y(p => p.y);

            svg.append("path")
                .datum(lineData)
                .attr("fill", "none")
                .attr("stroke", "black")
                .attr("stroke-width", 1)
                .attr("d", lineGen);
        });

        // Labels
        svg.selectAll(".y-label")
            .data(data)
            .enter()
            .append("text")
            .attr("class", "y-label")
            .attr("x", -10)
            .attr("y", d => yScale(d.key))
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .attr("font-size", "12px")
            .text(d => d.key);

        // Grid + ticks
        for (let i = 0; i <= 100; i += 10) {
            svg.append("line")
                .attr("x1", xScale(i))
                .attr("x2", xScale(i))
                .attr("y1", 0)
                .attr("y2", height)
                .attr("stroke", "black")
                .attr("stroke-width", 0.3);

            svg.append("text")
                .attr("x", xScale(i))
                .attr("y", -5)
                .attr("text-anchor", "middle")
                .attr("font-size", "10px")
                .text(i + "%");
        }
        data.forEach(d => {
            svg.append("line")
                .attr("x1", 0)
                .attr("x2", xScale(100))
                .attr("y1", yScale(d.key))
                .attr("y2", yScale(d.key))
                .attr("stroke", "black")
                .attr("stroke-width", 0.3);
        });

        // Draw circles
        svg.selectAll("circle")
            .data(
                data.flatMap(d =>
                    d.causes.map(c => ({
                        ...c,
                        key: d.key,
                        allCauses: d.causes
                    }))
                )
            )
            .enter()
            .append("circle")
            .attr("cx", d => xScale(d.percentage))
            .attr("cy", d => yScale(d.key))
            .attr("r", 5)
            .attr("fill", d => colorScale(d.name))
            .attr("stroke", "black")
            .attr("stroke-width", 0.5)
            .on("mouseover", (event, d) => {

                // Highlight row
                svg.selectAll("circle")
                    .filter(c => c.key === d.key)
                    .transition()
                    .duration(300)
                    .attr("r", 8)
                    .attr("stroke", "red");

                svg.selectAll("path")
                    .filter(p => p[0] && p[0].y === yScale(d.key))
                    .transition()
                    .duration(300)
                    .attr("stroke", "red")
                    .attr("stroke-width", 2);

                const tableRows = d.allCauses.map(c =>
                    `<tr>
                        <td><strong>${causeTranslations[c.name] || c.name}</strong></td>
                        <td>${c.count}</td>
                    </tr>`
                ).join("");

                tooltip.html(`
                    <strong>${d.key}</strong><br>
                    <table style="margin-top:5px;">
                        <thead>
                            <tr>
                                <th>Cause</th>
                                <th>Fires</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                `)
                    .style("visibility", "visible");
            })
            .on("mousemove", (event) => {
                tooltip
                    .style("top", event.pageY + 10 + "px")
                    .style("left", event.pageX + 10 + "px");
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
            // ---- Add Legend ---- //
            const legendData = [
                { name: "Natural", color: "#1f77b4" },
                { name: "Negligent", color: "#2ca02c" },
                { name: "Intentional", color: "#ff7f0e" },
                { name: "Reignitions", color: "#d62728" },
                { name: "Unknown", color: "#9467bd" },
                { name: "Not Investigated", color: "#8c564b" }
            ];

            // Remove old legend if exists
            svg.selectAll(".dotplot-legend").remove();
            // right margin for legend placement
            const legendX = width - 70;   // 120px from right side of plot
            const legendY = margin.top + 20;

            const legend = svg.append("g")
                .attr("class", "dotplot-legend")
                .attr("transform", `translate(${legendX}, ${legendY})`);

            legend.selectAll(".legend-item")
                .data(legendData)
                .enter()
                .append("g")
                .attr("class", "legend-item")
                .attr("transform", (d, i) => `translate(0, ${i * 20})`)
                .each(function(d) {

                    d3.select(this)
                        .append("rect")
                        .attr("width", 12)
                        .attr("height", 12)
                        .attr("fill", d.color);

                    d3.select(this)
                        .append("text")
                        .attr("x", 18)
                        .attr("y", 10)
                        .attr("font-size", "12px")
                        .text(d.name);
                });

    }

    // ---------------------- //
    //    MAIN UPDATE LOGIC   //
    // ---------------------- //

    function updateDotPlot() {

        if (!dotplotData) return;

        const mode = modeSelect.value;        // "Years" ou "Districts"
        const orderType = orderSelect.value;

        const primarySelected = [primarySelect.value];
        const secondarySelected = [secondarySelect.value];

        if (primarySelected.length === 0 || secondarySelected.length === 0) return;

        const allYears = [...new Set(dotplotData.map(r => String(r.Ano)))];
        const allDistricts = [...new Set(dotplotData.map(r => r.Distrito))];

        let yearsFilter, districtsFilter;

        if (mode === "Years") {
            // primary = anos, secondary = distritos
            yearsFilter = primarySelected.includes("All")
                ? allYears
               : primarySelected.map(String);

            districtsFilter = secondarySelected.includes("All")
                ? allDistricts
                : secondarySelected;
        } else {
            // mode = "Districts" → primary = distritos, secondary = anos
            districtsFilter = primarySelected.includes("All")
                ? allDistricts
                : primarySelected;

            yearsFilter = secondarySelected.includes("All")
                ? allYears
                : secondarySelected.map(String);
        }

        const filtered = dotplotData.filter(row =>
            yearsFilter.includes(String(row.Ano)) &&
            districtsFilter.includes(row.Distrito)
        );

        const filterKey = mode === "Years" ? "Ano" : "Distrito";
        const processed = processAndSortData(filtered, filterKey, orderType);

        if (!processed.length) {
            svg.selectAll("*").remove();
            return;
        }

        renderDotPlot(processed, orderType);
    }



    window.addEventListener("resize", updateDotPlot);
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
    

    
    configureDropdowns();
    initializeSVG();

    
    updateChart();
    window.addEventListener("resize", updateChart);

    
    function configureDropdowns() {
        [yearDropdownButton, districtDropdownButton].forEach((btn, i) => {
            const dropdown = [yearDropdown, districtDropdown][i];
            btn.addEventListener("click", () => dropdown.classList.toggle("show"));
        });

        
        document.addEventListener("click", event => {
            if (!yearDropdownButton.contains(event.target) && !yearDropdown.contains(event.target)) yearDropdown.classList.remove("show");
            if (!districtDropdownButton.contains(event.target) && !districtDropdown.contains(event.target)) districtDropdown.classList.remove("show");
            
        });

        
        yearDropdown.addEventListener('change', updateChart);
        districtDropdown.addEventListener('change', updateChart);
    }

    
    function initializeSVG() {
        const svgContainer = container.append("svg").attr("class", "chart-svg");
        svgContainer.append("g");
    }

    
    function updateChart() {
        
        const anos = getSelectedCheckboxValues(yearDropdown);
        const distritos = getSelectedCheckboxValues(districtDropdown);

        if (anos.length) {
            if (distritos.length) {
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
    
        
        
    
        svgContainer.selectAll(".legend-group").remove();
        svgContainer.selectAll(".legend-item").remove();

        const legendCols = 3; // número de colunas no grid
        const legendItemHeight = 20;
        const legendItemWidth = 160;

        const legendGroup = svgContainer.append("g")
            .attr("class", "legend-group")
            .attr("transform", `translate(${margin.left}, ${newHeight + margin.bottom - 80})`);

        legendGroup.selectAll(".legend-item")
            .data(dataSets)
            .join("g")
            .attr("class", "legend-item")
            .attr("transform", (_, i) => {
                const col = i % legendCols;
                const row = Math.floor(i / legendCols);
                return `translate(${col * legendItemWidth}, ${row * legendItemHeight})`;
            })
            .each(function (d, i) {
                const g = d3.select(this);

                g.append("rect")
                    .attr("width", 15)
                    .attr("height", 15)
                    .attr("fill", colors(i));

                g.append("text")
                    .attr("x", 20)
                    .attr("y", 12)
                    .text(d.label)
                    .attr("font-size", "12px")
                    .attr("fill", "black");
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
                const burntArea = year >= 2017;
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

            

            const years = Array.from(new Set(jsonDataDistrict.map(row => row.Ano))).sort((a, b) => a - b);
            const districts = Array.from(new Set(jsonDataDistrict.map(row => row.Distrito))).sort();


            
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
            districtDropdownButton.disabled = false; 
            districtDropdownButton.style.backgroundColor = "#4CAF50";

            
            /* yearDropdown.addEventListener("change", function () {
                const selectedYears = Array.from(yearDropdown.querySelectorAll("input[type=checkbox]:checked"))
                    .map(checkbox => checkbox.value);

                if (selectedYears.length === 1) {
                    districtDropdownButton.disabled = false;
                    districtDropdownButton.style.backgroundColor = "#4CAF50";
                } else {
                    districtDropdownButton.disabled = true;
                    districtDropdownButton.style.backgroundColor = "grey";
                }
            }); */

            
            const districtDropdown = document.getElementById("districtDropdownCauses");
            districtDropdown.innerHTML = ""; 

            districts.forEach(district => {
                const label = document.createElement("label");
                label.innerHTML = `<input type="checkbox" value="${district}"> ${district}`;
                districtDropdown.appendChild(label);
                districtDropdown.appendChild(document.createElement("br"));
            });

            
            enforceMaxSelection(districtDropdown, 3);

             

            
            districtDropdown.addEventListener("change", function () {
                const selectedDistricts = Array.from(districtDropdown.querySelectorAll("input[type=checkbox]:checked"))
                    .map(checkbox => checkbox.value);

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
    let isCausesInitialized = false; 
    
    
    function updateSidebarContent(view) {
        const sidebarText = document.querySelector('.sidebar-text');
        if (!sidebarText) return;  // <--- EVITA CRASH

        sidebarText.innerHTML = '';

        if (view === 'Burnt Area') {
            sidebarText.innerHTML = `<h2>Burnt Area</h2>`;
        }
        else if (view === 'Causes') {
            sidebarText.innerHTML = `<h2>Causes</h2>`;
        }
        else if (view === 'Data') {
            sidebarText.innerHTML = `<h2>Dataset</h2>`;
        }
        else if (view === 'About') {
            sidebarText.innerHTML = `<h2>About</h2>`;
        }
    }


    
    function showView(viewId, buttonId) {
        const buttons = document.querySelectorAll('.nav-btn');
        buttons.forEach(button => button.classList.remove('active'));
        document.getElementById(buttonId).classList.add('active');
    
        
        document.querySelectorAll('.content-container').forEach(container => {
            container.style.display = 'none';
            container.classList.remove('active');
        });
        const page = document.getElementById(viewId);
        page.style.display = 'block';
        page.classList.add('active');
    
        
        document.getElementById(viewId).classList.add('active');
    
        const burnedAreaContainer = document.getElementById('burnedAreaContainer');
        const causesContainer = document.getElementById('causesContainer');
        const aboutContainer = document.getElementById('aboutContainer');

        
        if (viewId === 'burnedAreaContainer') {
            burnedAreaContainer.style.display = 'flex';  
            causesContainer.style.display = 'none';
            aboutContainer.style.display = 'none';
            updateSidebarContent('Burnt Area');

            
            if (!isBurntAreaInitialized) {
                initializeBurntAreaView();
                isBurntAreaInitialized = true; 
            }
        } else if (viewId === 'causesContainer') {
            burnedAreaContainer.style.display = 'none';
            causesContainer.style.display = 'flex';
            aboutContainer.style.display = 'none';
            updateSidebarContent('Causes');

            
            if (!isCausesInitialized) {
                initializeCausesView();
                isCausesInitialized = true; 
            }

        }else if (viewId === "dataContainer") {
            burnedAreaContainer.style.display = 'none';
            causesContainer.style.display = 'none';
            aboutContainer.style.display = 'none';

            document.getElementById("dataContainer").style.display = "block";

            updateSidebarContent("Data");

        } else {
            burnedAreaContainer.style.display = 'none';
            causesContainer.style.display = 'none';
            aboutContainer.style.display = 'flex';
            updateSidebarContent('Main Page');
        }
    }

    
    

    document.getElementById('burntAreaBtn').addEventListener('click', () => {
        showView('burnedAreaContainer', 'burntAreaBtn');
    });
    document.getElementById('causesBtn').addEventListener('click', () => {
        showView('causesContainer', 'causesBtn');
    });
    document.getElementById('aboutBtn').addEventListener('click', () => {
        showView('aboutContainer', 'aboutBtn');
    });
    document.getElementById("dataBtn").addEventListener("click", () => {
        showView("dataContainer", "dataBtn");
        initializeDataPage();
    });
    

    
    document.getElementById('burntAreaColumn').addEventListener('click', () => {
        showView('burnedAreaContainer', 'burntAreaBtn');
    });
    document.getElementById('causesColumn').addEventListener('click', () => {
        showView('causesContainer', 'causesBtn');
    });
    

    
    fillDropdown();

    fillDropdownCauses();


    
    function initializeBurntAreaView() {
        initializeMap();
        initializeHistogram();
        initializeTemporalScatter();
    }

    function initializeCausesView() {
        initializeDotPlot();
        initializeSpiderChart();
    }
    function initializeTemporalScatter() {
    const container = d3.select("#temporal-scatter");

    // Margens e dimensões
    const margin = { top: 40, right: 30, bottom: 50, left: 70 };
    const width = container.node().clientWidth - margin.left - margin.right;
    const height = container.node().clientHeight - margin.top - margin.bottom;

    const svg = container
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Tooltip para os pontos
    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip temporal-tooltip")
        .style("position", "absolute")
        .style("background", "white")
        .style("border", "1px solid #ccc")
        .style("padding", "6px 8px")
        .style("border-radius", "4px")
        .style("pointer-events", "none")
        .style("font-size", "12px")
        .style("opacity", 0);

    // Dropdown de distrito
    const districtSelectEl = document.getElementById("temporalDistrictSelect");

    // Ler dados do Excel
    fetch("resources/data/data.xlsx")
        .then(res => res.arrayBuffer())
        .then(buffer => {
            const workbook = XLSX.read(buffer, { type: "array" });

            if (!workbook.Sheets["Estatisticas_Distrito"]) {
                console.error("Sheet 'Estatisticas_Distrito' not found");
                return;
            }

            const rawData = XLSX.utils.sheet_to_json(workbook.Sheets["Estatisticas_Distrito"]);

            // Normalizar dados
            const fullData = rawData.map(d => ({
                year: +d.Ano,
                district: d.Distrito,
                fires: +d.Num_IncendiosRurais
            })).filter(d => !isNaN(d.year) && !isNaN(d.fires));

            // ---- Preencher dropdown ----
            const districts = Array.from(new Set(fullData.map(d => d.district))).sort();

            // limpar opções anteriores
            districtSelectEl.innerHTML = "";

            // opção ALL
            const optAll = document.createElement("option");
            optAll.value = "All";
            optAll.textContent = "All";
            districtSelectEl.appendChild(optAll);

            // restantes distritos
            districts.forEach(dist => {
                const opt = document.createElement("option");
                opt.value = dist;
                opt.textContent = dist;
                districtSelectEl.appendChild(opt);
            });

            // valor inicial
            districtSelectEl.value = "All";

            // Quando o utilizador muda o dropdown
            districtSelectEl.addEventListener("change", () => {
                updatePlot(districtSelectEl.value);
            });

            // Ouvir eventos vindos do mapa (quando clicas num distrito)
            document.addEventListener("districtSelected", (e) => {
                const selected = e.detail || "All";  // e.detail deve ser o nome do distrito
                const exists = Array.from(districtSelectEl.options).some(o => o.value === selected);

                if (exists) {
                    districtSelectEl.value = selected;
                } else {
                    districtSelectEl.value = "All";
                }
                updatePlot(districtSelectEl.value);
            });

            // Desenhar inicialmente com ALL
            updatePlot("All");

            // ===== Função que desenha o gráfico =====
            function updatePlot(filterDistrict) {
                let data;

                if (filterDistrict === "All") {
                    // Agrupar todos os distritos por ano e somar nº de incêndios
                    const roll = d3.rollups(
                        fullData,
                        v => d3.sum(v, d => d.fires),
                        d => d.year
                    );
                    data = roll.map(([year, fires]) => ({ year, fires }));
                } else {
                    // Dados só do distrito escolhido
                    data = fullData
                        .filter(d => d.district === filterDistrict)
                        .map(d => ({ year: d.year, fires: d.fires }));
                }

                data.sort((a, b) => a.year - b.year);

                // Limpar o svg antes de redesenhar
                svg.selectAll("*").remove();

                if (data.length === 0) {
                    return;
                }

                // Escalas
                const years = data.map(d => d.year);
                const minYear = d3.min(years);
                const maxYear = d3.max(years);

                const maxFires = d3.max(data, d => d.fires);

                const x = d3.scaleLinear()
                    .domain([minYear, maxYear])
                    .range([0, width]);

                const y = d3.scaleLinear()
                    .domain([0, maxFires * 1.05])
                    .range([height, 0]);

                // Grelha vertical
                svg.append("g")
                    .attr("class", "grid")
                    .attr("transform", `translate(0, ${height})`)
                    .call(
                        d3.axisBottom(x)
                            .tickSize(-height)
                            .tickFormat("")
                    );

                // Grelha horizontal
                svg.append("g")
                    .attr("class", "grid")
                    .call(
                        d3.axisLeft(y)
                            .tickSize(-width)
                            .tickFormat("")
                    );

                // Eixo X
                svg.append("g")
                    .attr("transform", `translate(0, ${height})`)
                    .call(d3.axisBottom(x).tickFormat(d3.format("d")));

                // Eixo Y
                svg.append("g")
                    .call(d3.axisLeft(y));

                // Labels dos eixos
                svg.append("text")
                    .attr("x", width / 2)
                    .attr("y", height + 40)
                    .style("text-anchor", "middle")
                    .style("font-size", "12px")
                    .text("Year");

                svg.append("text")
                    .attr("transform", "rotate(-90)")
                    .attr("x", -height / 2)
                    .attr("y", -50)
                    .style("text-anchor", "middle")
                    .style("font-size", "12px")
                    .text("Number of Fires");

                // Linha
                const line = d3.line()
                    .x(d => x(d.year))
                    .y(d => y(d.fires));

                svg.append("path")
                    .datum(data)
                    .attr("fill", "none")
                    .attr("stroke", "#4A90E2")        // azul médio
                    .attr("stroke-width", 2)
                    .attr("d", line);

                // Pontos
                svg.selectAll(".point")
                    .data(data)
                    .enter()
                    .append("circle")
                    .attr("class", "point")
                    .attr("cx", d => x(d.year))
                    .attr("cy", d => y(d.fires))
                    .attr("r", 5)
                    .attr("fill", "#9BC5FF")          // azul claro
                    .on("mouseover", (event, d) => {
                        d3.select(event.target).attr("r", 7);
                        tooltip
                            .style("opacity", 1)
                            .html(
                                `<strong>Year:</strong> ${d.year}<br>` +
                                `<strong>Fires:</strong> ${d.fires}`
                            )
                            .style("left", (event.pageX + 10) + "px")
                            .style("top", (event.pageY - 20) + "px");
                    })
                    .on("mousemove", (event) => {
                        tooltip
                            .style("left", (event.pageX + 10) + "px")
                            .style("top", (event.pageY - 20) + "px");
                    })
                    .on("mouseout", (event) => {
                        d3.select(event.target).attr("r", 5);
                        tooltip.style("opacity", 0);
                    });
            }
        })
        .catch(err => console.error("Error loading Excel for temporal scatter:", err));
    }
    function initializeDataPage() {
    const container = document.getElementById("dataTableContainer");
    container.innerHTML = "<p>Loading data...</p>";

        fetch("resources/data/data.xlsx")
            .then(res => res.arrayBuffer())
            .then(buffer => {
                const workbook = XLSX.read(buffer, { type: "array" });

                const sheetSelect = document.getElementById("sheetSelect");

                // Preencher dropdown com os nomes das folhas
                workbook.SheetNames.forEach(name => {
                    const opt = document.createElement("option");
                    opt.value = name;
                    opt.textContent = name;
                    sheetSelect.appendChild(opt);
                });

                // Função que desenha a tabela
                function loadSheet(sheetName) {
                    const sheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                    let html = "<table class='data-table'>";

                    json.forEach((row, r) => {
                        html += "<tr>";
                        row.forEach(cell => {
                            if (r === 0) html += `<th>${cell || ""}</th>`;
                            else html += `<td>${cell || ""}</td>`;
                        });
                        html += "</tr>";
                    });

                    html += "</table>";
                    container.innerHTML = html;
                }

                // Carregar automaticamente a primeira folha
                loadSheet(workbook.SheetNames[0]);

                // Ao selecionar outra folha, atualizar tabela
                sheetSelect.addEventListener("change", () => {
                    loadSheet(sheetSelect.value);
                });
            })
            .catch(err => {
                container.innerHTML = "<p style='color:red;'>Failed to load dataset.</p>";
                console.error(err);
            });
    }
    
    showView('burnedAreaContainer', 'burntAreaBtn');
});

    