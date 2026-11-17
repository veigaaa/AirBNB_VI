import pandas as pd
import geopandas as gpd
import plotly.express as px
import plotly.graph_objects as go
import json
from dash import Dash, dcc, html, Input, Output, State

# --- Caminhos ---
excel_path = r"C:\Users\joana\Desktop\Eng_comp\Visualização de informação\Projeto\Incendios.xlsx"
shapefile_path = r"C:\Users\joana\Desktop\Eng_comp\Visualização de informação\Projeto\distritos.shp"

# --- Ler dados ---
df_total = pd.read_excel(excel_path, sheet_name="Estatisticas_PortugalContinent", usecols="A,B")
df_map = pd.read_excel(
    excel_path, sheet_name="Estatisticas_Distrito",
    usecols=[
        "Distrito", "Ano", "Num_IncendiosRurais",
        "AreaArdPov_NoDistrito", "AreaArdMato_NoDistrito", "AreaArdAgric_NoDistrito",
        "NInc_Natural", "NInc_Negligente", "NInc_Intencionais",
        "NInc_Reacendimentos", "NInc_Desconhecida", "NInc_NaoInvestigados"
    ]
)

# --- Pré-processar shapefile ---
gdf = gpd.read_file(shapefile_path)
gdf["NAME_1"] = gdf["NAME_1"].str.strip().str.lower()
gdf = gdf.to_crs(epsg=4326)
gdf["geometry"] = gdf["geometry"].simplify(tolerance=0.01, preserve_topology=True)
gdf_json = json.loads(gdf.to_json())

# Centroides
gdf_centroids = gdf.copy()
gdf_centroids["centroid"] = gdf_centroids.representative_point()
gdf_centroids["lon"] = gdf_centroids["centroid"].x
gdf_centroids["lat"] = gdf_centroids["centroid"].y
centroids_dict = gdf_centroids.set_index("NAME_1")[["lon", "lat"]].to_dict("index")

# --- Dados agregados ---
anos_disponiveis = sorted(int(a) for a in df_map["Ano"].unique())
distritos_disponiveis = ["All Districts"] + sorted(df_map["Distrito"].unique())

# --- Função para estilo do botão da Navbar ---
def nav_style(active=False):
    style = {
        'background-color': '#FFA500', 'color': 'black', 'padding': '10px', 'margin': '5px',
        'border-radius': '15px', 'width': '100px', 'height': '40px', 'text-align': 'center',
        'font-weight': 'bold', 'cursor': 'pointer', 'box-shadow': '2px 2px 6px #333',
        'transition': 'all 0.2s ease'
    }
    if active:
        style.update({'transform': 'scale(1.2)', 'box-shadow': '4px 4px 12px #555'})
    return style

# --- App ---
app = Dash(__name__, suppress_callback_exceptions=True)

# --- Layout principal ---
app.layout = html.Div([
    dcc.Location(id='url', refresh=False),
    html.Div(id='navbar'),
    html.Div(id='page-content')
])

# --- Callback Navbar ---
@app.callback(
    Output('navbar', 'children'),
    Input('url', 'pathname')
)
def update_navbar(pathname):
    return html.Div([
        dcc.Link("Home", href="/", style=nav_style(active=pathname == "/")),
        dcc.Link("Datasets", href="/datasets", style=nav_style(active=pathname == "/datasets")),
        dcc.Link("Results", href="/results", style=nav_style(active=pathname == "/results")),
    ], style={'display': 'flex', 'justify-content': 'center', 'margin-bottom': '20px'})

# --- Layouts ---
home_layout = html.Div([
    html.Div([
        html.H1("Welcome to the Fire Dashboard", style={'color': 'white', 'font-size': '48px', 'margin-bottom': '20px'}),
        html.P("Explore rural fires in Mainland Portugal. Visualize trends by year, district and fire causes.",
               style={'color': 'white', 'font-size': '20px', 'margin-bottom': '30px'}),
        html.Div([
            # --- Datasets Info ---
            html.Div([
                html.H3("🔍 Datasets Info", style={'margin-bottom': '10px', 'color': '#1a1aff'}),
                html.P("Explore the raw data by year and district. Check trends and detailed statistics.",
                       style={'font-size': '14px', 'color': '#e6e6ff'}),
                html.P("Filter by year, see district-level numbers, and compare fire types.",
                       style={'font-size': '14px', 'color': '#e6e6ff'})
            ], style={'background-color': '#4da6ff', 'padding': '20px', 'border-radius': '15px',
                      'margin': '10px', 'text-align': 'center', 'cursor': 'pointer', 'width': '250px'}),

            # --- Results Overview ---
            html.Div([
                html.H3("📊 Results Overview", style={'margin-bottom': '10px', 'color': '#993300'}),
                html.P("Visualize interactive charts and maps to understand fire patterns and burned areas.",
                       style={'font-size': '14px', 'color': '#ffcc99'}),
                html.P("Compare total fires, burned areas, and causes across years and districts.",
                       style={'font-size': '14px', 'color': '#ffcc99'})
            ], style={'background-color': '#ff9966', 'padding': '20px', 'border-radius': '15px',
                      'margin': '10px', 'text-align': 'center', 'cursor': 'pointer', 'width': '250px'}),

            # --- About Fires ---
            html.Div([
            dcc.Link([
                html.H3("🌿 About Fires", style={'margin-bottom': '10px', 'color': '#006600'}),
                html.P("Learn about fire causes, types of vegetation affected, and key insights from the data.",
                    style={'font-size': '14px', 'color': '#ccffcc'}),
                html.P("Understand how natural, negligent, or intentional fires impact rural areas.",
                    style={'font-size': '14px', 'color': '#ccffcc'}),
                html.Div("➡️ Click to learn more", style={'margin-top': '10px', 'font-size': '16px', 'color': 'white'})
            ], href='/about-fires', style={'text-decoration': 'none'})
            ], style={'background-color': '#33cc33', 'padding': '20px', 'border-radius': '15px',
          'margin': '10px', 'text-align': 'center', 'cursor': 'pointer', 'width': '250px'})

        ], style={'display': 'flex', 'justify-content': 'center', 'flex-wrap': 'wrap'})
    ], style={'text-align': 'center', 'padding': '50px'}),
], style={'background-color': '#2b2b2b', 'min-height': '100vh'})

about_fires_layout = html.Div([
    html.H1("🔥 About Fires in Portugal", style={'color': 'white', 'text-align': 'center', 'margin-bottom': '30px'}),
    html.Div([
        html.P("Portugal experiences frequent rural fires every year, affecting forests, scrublands, and agricultural areas.",
               style={'color': 'white', 'font-size': '18px', 'margin-bottom': '10px'}),
        html.P("The main causes include natural events, human negligence, and sometimes intentional actions.",
               style={'color': 'white', 'font-size': '18px', 'margin-bottom': '10px'}),
        html.P("Understanding these patterns helps in planning prevention strategies and minimizing damage.",
               style={'color': 'white', 'font-size': '18px', 'margin-bottom': '10px'}),
        html.P("Visualizations in this dashboard show trends by year, district, and fire type to give a comprehensive view.",
               style={'color': 'white', 'font-size': '18px', 'margin-bottom': '10px'}),
    ], style={'max-width': '800px', 'margin': '0 auto', 'line-height': '1.6'}),
    html.Div(dcc.Link("⬅️ Back to Home", href='/', style={'color': '#FFA500', 'font-size': '18px', 'display': 'block', 'text-align': 'center', 'margin-top': '30px'}))
], style={'background-color': '#2b2b2b', 'min-height': '100vh', 'padding': '50px'})

# --- Layout Datasets ---
datasets_layout = html.Div([
    html.H2("Datasets Overview", style={'textAlign': 'center', 'margin-top': '20px', 'color': 'white'}),
    
    html.Div([
        html.Label("Select Year:", style={'color': 'white'}),
        dcc.Dropdown(
            id='dataset-year-dropdown',
            options=[{'label': str(ano), 'value': ano} for ano in anos_disponiveis],
            value=anos_disponiveis[-1]
        ),
    ], style={'width': '30%', 'margin': '10px auto'}),

    html.Div(id='dataset-table', style={'margin': '20px'})
], style={'background-color': '#2b2b2b', 'min-height': '100vh', 'padding': '20px'})

# --- Gráfico de linhas fixo ---
fig_linhas = px.line(
    df_total.rename(columns={df_total.columns[1]: "Number of Fires"}),
    x=df_total.columns[0],
    y="Number of Fires",
    title="Total Fires in Mainland Portugal",
    markers=True
)
fig_linhas.update_layout(
    xaxis_title="Year",
    yaxis_title="Number of Fires",
    xaxis=dict(tickmode='linear', tickangle=-45),
    title_x=0.5,
    font=dict(size=12)
)
# --- Layout Results ---
# --- Layout Results ---
results_layout = html.Div([

    # --- Filtros principais ---
    html.Div([
        html.Label("Select Year(s):", style={'color': 'black', 'font-weight': 'bold'}),
        html.Div([  # Contêiner para controlar largura e centralização
            dcc.RangeSlider(
    id='ano-slider',
    min=int(min(anos_disponiveis)),
    max=int(max(anos_disponiveis)),
    step=1,
    value=[int(min(anos_disponiveis)), int(max(anos_disponiveis))],
    marks={int(ano): str(int(ano)) for ano in anos_disponiveis if int(ano) % 2 == 0},  # só anos pares
    tooltip={"placement": "bottom", "always_visible": True},
    updatemode='drag'
)
        ], style={'width': '90%', 'margin': '20px auto'}),  # largura e centralização do slider

        html.Label("Select District:", style={'color': 'black', 'margin-top': '10px', 'font-weight': 'bold'}),
        dcc.Dropdown(
            id='distritos-filtro',
            options=[{'label': 'All Districts', 'value': 'All Districts'}] +
                    [{'label': dist, 'value': dist} for dist in sorted(df_map['Distrito'].unique())],
            value=['All Districts'],
            multi=True,
            style={
                'margin-bottom': '20px',
                'background-color': 'white',
                'color': 'black'
            }
        ),
    ], style={
        'width': '35%',
        'margin': '10px auto',
        'padding': '20px',
        'border-radius': '15px',
        'background-color': 'white',
        'box-shadow': '2px 2px 8px rgba(0,0,0,0.3)'
    }),

    # --- Secção de comparação entre distritos ---
    html.Div([
        html.Hr(style={'border-color': '#FFA500', 'margin': '40px 0'}),
        html.H3(
            "Compare Burned Areas and Fire Causes Across Districts",
            style={'color': 'white', 'text-align': 'center'}
        ),

        # Dropdown para selecionar distritos para comparação
        html.Div([
            html.Label("Select District(s):", style={'color': 'white'}),
            dcc.Dropdown(
                id='multi-distritos-dropdown',
                options=[{'label': 'All Districts', 'value': 'All Districts'}] +
                        [{'label': dist, 'value': dist} for dist in sorted(df_map['Distrito'].unique())],
                value=['All Districts'],
                multi=True,
                style={'margin-bottom': '30px'}
            )
        ], style={'width': '70%', 'margin': '0 auto'}),

        # Container para gráficos lado a lado
        html.Div([
            html.Div([
                dcc.Graph(id='barras-comparacao', style={'height': '400px'})
            ], style={'flex': '1', 'padding': '10px'}),

            html.Div([
                dcc.Checklist(
                    id='causas-checklist',
                    options=[
                        {"label": "Natural", "value": "Natural"},
                        {"label": "Negligent", "value": "Negligent"},
                        {"label": "Intentional", "value": "Intentional"},
                        {"label": "Rekindle", "value": "Rekindle"},
                        {"label": "Unknown", "value": "Unknown"},
                        {"label": "Not Investigated", "value": "Not Investigated"}
                    ],
                    value=["Natural", "Negligent", "Intentional", "Rekindle", "Unknown", "Not Investigated"],
                    inline=True,
                    inputStyle={"margin-right": "5px", "margin-left": "10px"},
                    labelStyle={"color": "white", "margin-right": "15px"},
                ),
                dcc.Graph(id='dotplot-causas', style={'height': '400px'})
            ], style={'flex': '1', 'padding': '10px'})
        ], style={'display': 'flex', 'justify-content': 'center', 'flex-wrap': 'wrap'}),

    ], style={'margin-bottom': '40px'}),

    # --- Secção principal de gráficos ---
    html.Div([
        html.Div([
            dcc.Graph(id='mapa-incendios', style={'height': '600px', 'width': '100%'})
        ], style={'flex': '50%', 'padding': '5px'}),

        html.Div([
            html.Div([
                dcc.Graph(id='linha-total', figure=fig_linhas, style={'height': '280px', 'width': '100%'})
            ], style={'margin-bottom': '10px'}),

            html.Div([
                dcc.Graph(id='barras-areas', style={'height': '280px', 'width': '49%', 'display': 'inline-block'}),
                dcc.Graph(id='spider-causas', style={'height': '280px', 'width': '49%', 'display': 'inline-block'})
            ])
        ], style={'flex': '50%', 'padding': '5px'})
    ], style={'display': 'flex', 'justify-content': 'space-between'}),

], style={
    'background-color': '#2b2b2b',
    'min-height': '100vh',
    'padding-bottom': '20px'
})

# --- Callback para mudar página ---
@app.callback(
    Output('page-content', 'children'),
    Input('url', 'pathname')
)
def display_page(pathname):
    if pathname == "/datasets":
        return datasets_layout
    elif pathname == "/results":
        return results_layout
    elif pathname == "/about-fires":
        return about_fires_layout
    else:
        return home_layout

# --- Callback atualizar gráficos ---
# --- Callback atualizar gráficos principais ---
@app.callback(
    Output('mapa-incendios', 'figure'),
    Output('barras-areas', 'figure'),
    Output('spider-causas', 'figure'),
    Input('ano-slider', 'value'),
    Input('distritos-filtro', 'value')
)
def update_graphs(selected_years, selected_distrito):
    # --- Garantir que selected_years é lista de inteiros ---
    if isinstance(selected_years, int):
        selected_years = [selected_years]
    else:
        selected_years = list(range(int(selected_years[0]), int(selected_years[1]) + 1))
    selected_years = [int(ano) for ano in selected_years if ano in anos_disponiveis]

    # --- Converter distritos selecionados para lowercase ---
    if not selected_distrito or "All Districts" in selected_distrito:
        selected_distrito_lower = ["all districts"]
    else:
        selected_distrito_lower = [d.lower() for d in selected_distrito]

    anos_texto = f"{min(selected_years)}–{max(selected_years)}" if selected_years else "N/A"
    distrito_texto = ", ".join([d.title() for d in selected_distrito_lower]) if "all districts" not in selected_distrito_lower else "All Districts"

    # --- Mapa ---
    if "all districts" in selected_distrito_lower:
        df_map_filtered = df_map[df_map["Ano"].isin(selected_years)].groupby("Distrito", as_index=False)["Num_IncendiosRurais"].sum()
    else:
        df_map_filtered = df_map[(df_map["Ano"].isin(selected_years)) &
                                 (df_map["Distrito"].str.lower().isin(selected_distrito_lower))]

    df_map_filtered["Distrito"] = df_map_filtered["Distrito"].str.lower()
    df_map_filtered["lon"] = df_map_filtered["Distrito"].map(lambda x: centroids_dict.get(x, {}).get("lon"))
    df_map_filtered["lat"] = df_map_filtered["Distrito"].map(lambda x: centroids_dict.get(x, {}).get("lat"))
    df_map_filtered["Nome"] = df_map_filtered["Distrito"].str.capitalize()
    df_map_filtered = df_map_filtered.rename(columns={"Num_IncendiosRurais": "Number of Fires"})

    mapa_fig = px.choropleth_mapbox(
        df_map_filtered, geojson=gdf_json, locations="Distrito",
        featureidkey="properties.NAME_1", color="Number of Fires",
        color_continuous_scale="Reds", hover_name="Nome",
        hover_data={"Number of Fires": True, "Distrito": False},
        mapbox_style="open-street-map", center={"lat": 39.5, "lon": -8.2}, zoom=5.8,
        opacity=0.7, title=f"Rural Fires by District — {anos_texto}"
    )
    mapa_fig.add_trace(go.Scattermapbox(
        lon=df_map_filtered["lon"], lat=df_map_filtered["lat"], mode="text", text=df_map_filtered["Nome"],
        textfont=dict(size=11, color="black", family="Arial Black"), hoverinfo="none", showlegend=False
    ))
    mapa_fig.update_layout(margin={"r": 0, "t": 40, "l": 0, "b": 0}, coloraxis_colorbar=dict(title="Number of Fires"))

    # --- Gráfico de barras ao lado do spider chart ---
    area_cols = ["AreaArdPov_NoDistrito", "AreaArdMato_NoDistrito", "AreaArdAgric_NoDistrito"]
    df_filtered = df_map[df_map["Ano"].isin(selected_years)]
    if "all districts" not in selected_distrito_lower:
        df_filtered = df_filtered[df_filtered["Distrito"].str.lower().isin(selected_distrito_lower)]
    # Forçar números, substituir não-numéricos por 0
    barras_vals = df_filtered[area_cols].apply(pd.to_numeric, errors='coerce').fillna(0).sum()
    
    barras_fig = go.Figure(go.Bar(
        x=["Forest", "Scrubland", "Agricultural"],
        y=barras_vals.values,
        marker_color=['darkred', 'orangered', 'gold'],
        marker_line_color='black',
        marker_line_width=1.5,
        text=barras_vals.astype(int).values,
        textposition='auto'
    ))
    barras_fig.update_layout(
        title_text=f"Burned Area by Fire Type — {distrito_texto}<br>({anos_texto})",
        title_x=0.5,
        title_font_size=14,
        title_pad=dict(t=10),
        margin=dict(t=100)
    )

    # --- Spider chart ---
    causas_cols = ["NInc_Natural", "NInc_Negligente", "NInc_Intencionais",
                   "NInc_Reacendimentos", "NInc_Desconhecida", "NInc_NaoInvestigados"]
    spider_vals = df_filtered[causas_cols].apply(pd.to_numeric, errors='coerce').fillna(0).sum()

    spider_fig = go.Figure(go.Scatterpolar(
        r=spider_vals.values,
        theta=["Natural", "Negligent", "Intentional", "Rekindle", "Unknown", "Not Investigated"],
        fill='toself', name='Causes'
    ))
    spider_fig.update_layout(
        polar=dict(radialaxis=dict(visible=True)),
        title=f"Fire Causes — {distrito_texto} <br>({anos_texto})",
        title_x=0.5, title_font=dict(size=14), title_pad=dict(t=10), margin=dict(t=100)
    )

    return mapa_fig, barras_fig, spider_fig


# --- Callback clique no mapa ---
@app.callback(
    Output('distritos-filtro', 'value'),
    Input('mapa-incendios', 'clickData'),
    State('distritos-filtro', 'value')
)
def update_distrito_dropdown(clickData, current_value):
    if clickData:
        distrito_click = clickData['points'][0].get('location', None)
        if distrito_click:
            distrito_click_title = distrito_click.title()
            
            # Garantir que current_value é sempre lista
            if isinstance(current_value, str):
                current_value = [current_value]

            # Se o distrito clicado já estiver selecionado, voltar para "All Districts"
            if distrito_click_title in current_value:
                return ["All Districts"]
            else:
                return [distrito_click_title]
    return current_value

# --- Callback atualizar tabelas ---
@app.callback(
    Output('dataset-table', 'children'),
    Input('dataset-year-dropdown', 'value')
)
def update_dataset_table(selected_year):
    # Sheet Distritos
    df_distrito_filtered = df_map[df_map['Ano'] == selected_year]
    table_distrito = html.Div([
        html.H4("Estatísticas por Distrito", style={'color': 'white', 'margin-bottom': '10px'}),
        html.Div(
            html.Table(
                [html.Tr([html.Th(col, style={'border': '1px solid white', 'padding': '5px'}) for col in df_distrito_filtered.columns])] +
                [html.Tr([html.Td(df_distrito_filtered.iloc[i][col], style={'border': '1px solid white', 'padding': '5px'}) for col in df_distrito_filtered.columns]) for i in range(len(df_distrito_filtered))],
                style={'color': 'white', 'border-collapse': 'collapse', 'width': '100%'}
            ),
            style={'overflowX': 'auto', 'padding-bottom': '20px'}
        )
    ])

    # Sheet Portugal Continental
    if 'Ano' in df_total.columns:
        df_portugal_filtered = df_total[df_total[df_total.columns[0]] == selected_year]
    else:
        df_portugal_filtered = df_total.copy()

    table_portugal = html.Div([
        html.H4("Estatísticas Portugal Continental", style={'color': 'white', 'margin-bottom': '10px'}),
        html.Div(
            html.Table(
                [html.Tr([html.Th(col, style={'border': '1px solid white', 'padding': '5px'}) for col in df_portugal_filtered.columns])] +
                [html.Tr([html.Td(df_portugal_filtered.iloc[i][col], style={'border': '1px solid white', 'padding': '5px'}) for col in df_portugal_filtered.columns]) for i in range(len(df_portugal_filtered))],
                style={'color': 'white', 'border-collapse': 'collapse', 'width': '100%'}
            ),
            style={'overflowX': 'auto'}
        )
    ])

    return html.Div([table_distrito, html.Hr(style={'border-color': 'white'}), table_portugal])
# --- Callback atualizar gráfico de comparação ---
@app.callback(
    Output('barras-comparacao', 'figure'),
    Input('multi-distritos-dropdown', 'value'),
    Input('ano-slider', 'value')
)
def update_comparacao_distritos(distritos, selected_years):
    # --- Garantir lista de anos ---
    if isinstance(selected_years, int):
        selected_years = [selected_years]
    else:
        selected_years = list(range(int(selected_years[0]), int(selected_years[1]) + 1))
    selected_years = [ano for ano in selected_years if ano in anos_disponiveis]
    anos_texto = f"{min(selected_years)}–{max(selected_years)}" if selected_years else "N/A"

    # --- Garantir que distritos é sempre lista ---
    if isinstance(distritos, str):
        distritos = [distritos]

    # --- Filtrar dados por anos ---
    df_filtrado = df_map[df_map["Ano"].isin(selected_years)]

    # --- Lógica dos distritos ---
    if not distritos or "All Districts" in distritos:
        df_agg = df_filtrado.copy()  # mostra todos os distritos individualmente
        distritos_texto = "All Districts"
    else:
        df_agg = df_filtrado[df_filtrado["Distrito"].isin(distritos)]
        distritos_texto = ", ".join(distritos)

    # --- Transformar para long format ---
    area_map = {
        "AreaArdPov_NoDistrito": "Forest",
        "AreaArdMato_NoDistrito": "Scrubland",
        "AreaArdAgric_NoDistrito": "Agricultural"
    }
    df_areas = df_agg.melt(id_vars=["Distrito", "Ano"], var_name="Tipo", value_name="Área Ardida")
    df_areas["Tipo"] = df_areas["Tipo"].map(area_map)

    # --- Criar gráfico ---
    fig = px.bar(
        df_areas,
        x="Distrito",
        y="Área Ardida",
        color="Tipo",
        barmode="group",
        hover_data={"Ano": True, "Área Ardida": True, "Tipo": True},
        color_discrete_map={"Forest": "darkred", "Scrubland": "orangered", "Agricultural": "gold"}
    )

    # --- Atualizar layout com título afastado do gráfico ---
    fig.update_layout(
        plot_bgcolor="#2b2b2b",
        paper_bgcolor="#2b2b2b",
        font_color="white",
        title={
            'text': f"Burned Area by Type per District <br> — {distritos_texto} <br>({anos_texto}) <br>",
            'x': 0.5,
            'xanchor': 'center',
            'yanchor': 'top',
            'pad': {'b': 20}  # distância entre título e gráfico
        },
        xaxis_title="District",
        yaxis_title="Burned Area (ha)",
        legend_title="Type",
        margin=dict(t=120, b=50)  # margem superior do gráfico
    )

    return fig


@app.callback(
    Output('dotplot-causas', 'figure'),
    Input('multi-distritos-dropdown', 'value'),  # id atualizado
    Input('ano-slider', 'value'),
    Input('causas-checklist', 'value')
)
def update_dotplot_causas(distritos, selected_years, causas_selecionadas):
    # --- Garantir lista de anos ---
    if isinstance(selected_years, int):
        selected_years = [selected_years]
    else:
        selected_years = list(range(int(selected_years[0]), int(selected_years[1]) + 1))
    selected_years = [ano for ano in selected_years if ano in anos_disponiveis]

    # --- Garantir que distritos é sempre lista ---
    if isinstance(distritos, str):
        distritos = [distritos]

    # --- Filtrar dados por anos ---
    df_filtrado = df_map[df_map["Ano"].isin(selected_years)]

    # --- Filtrar pelos distritos selecionados ---
    if not distritos or "All Districts" in distritos:
        df_agg = df_filtrado.copy()
        distritos_texto = "All Districts"
    else:
        df_agg = df_filtrado[df_filtrado["Distrito"].isin(distritos)]
        distritos_texto = ", ".join(distritos)

    # --- Colunas de causas ---
    causas_cols = ["NInc_Natural", "NInc_Negligente", "NInc_Intencionais",
                   "NInc_Reacendimentos", "NInc_Desconhecida", "NInc_NaoInvestigados"]

    df_causas = df_agg.melt(
        id_vars=["Distrito", "Ano"],
        value_vars=causas_cols,
        var_name="Cause",
        value_name="Number of Fires"
    )

    # Mapear nomes amigáveis
    cause_map = {
        "NInc_Natural": "Natural",
        "NInc_Negligente": "Negligent",
        "NInc_Intencionais": "Intentional",
        "NInc_Reacendimentos": "Rekindle",
        "NInc_Desconhecida": "Unknown",
        "NInc_NaoInvestigados": "Not Investigated"
    }
    df_causas["Cause"] = df_causas["Cause"].map(cause_map)

    # --- Filtrar pelas causas selecionadas ---
    if causas_selecionadas:
        df_causas = df_causas[df_causas["Cause"].isin(causas_selecionadas)]

    # --- Criar dot plot horizontal ---
    fig = px.scatter(
        df_causas,
        x="Number of Fires",
        y="Distrito",
        color="Cause",
        orientation='h',  # horizontal
        hover_data={"Ano": True, "Distrito": True, "Number of Fires": True},
        color_discrete_map={
            "Natural": "#2ca02c",       # verde escuro
            "Negligent": "#ff7f0e",     # laranja suave
            "Intentional": "#d62728",   # vermelho forte
            "Rekindle": "#9467bd",      # roxo
            "Unknown": "#7f7f7f",       # cinza
            "Not Investigated": "#8c564b" # marrom
        },
        title=f"Fire Causes Across Districts<br>{distritos_texto} ({min(selected_years)}–{max(selected_years)})"
    )

    # --- Layout personalizado ---
    fig.update_layout(
        plot_bgcolor="#2b2b2b",   # fundo do gráfico
        paper_bgcolor="#2b2b2b",  # fundo da área do gráfico
        font_color="white",
        xaxis_title="Number of Fires",
        yaxis_title="District",
        title_x=0.5,
        legend_title="Cause",
        margin=dict(t=80, b=50)
    )

    # --- Eixos e legendas em branco ---
    fig.update_yaxes(tickfont=dict(color='white'))
    fig.update_xaxes(tickfont=dict(color='white'))
    fig.update_layout(legend=dict(font=dict(color='white')))

    return fig


# --- Run app ---
if __name__ == '__main__':
    app.run(debug=True)
