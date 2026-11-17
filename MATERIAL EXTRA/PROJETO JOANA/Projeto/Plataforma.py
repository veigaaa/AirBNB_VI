import pandas as pd
import geopandas as gpd
import plotly.express as px
import plotly.graph_objects as go
import json
from dash import Dash, dcc, html, Input, Output

# --- Caminhos ---
excel_path = r"C:\Users\joana\Desktop\Eng_comp\Visualização de informação\Projeto\Incendios.xlsx"
shapefile_path = r"C:\Users\joana\Desktop\Eng_comp\Visualização de informação\Projeto\distritos.shp"

# --- Ler dados ---
df_total = pd.read_excel(excel_path, sheet_name="Estatisticas_PortugalContinent", usecols="A,B")
df_spider = pd.read_excel(excel_path, sheet_name="Estatisticas_PortugalContinent", usecols="A,O:T")
df_barras = pd.read_excel(excel_path, sheet_name="Estatisticas_PortugalContinent", usecols="A,C:E")
df_map = pd.read_excel(excel_path, sheet_name="Estatisticas_Distrito", usecols=["Distrito", "Ano", "Num_IncendiosRurais"])

# --- Pré-processar shapefile ---
gdf = gpd.read_file(shapefile_path)
gdf["NAME_1"] = gdf["NAME_1"].str.strip().str.lower()
gdf = gdf.to_crs(epsg=4326)
gdf["geometry"] = gdf["geometry"].simplify(tolerance=0.01, preserve_topology=True)
gdf_json = json.loads(gdf.to_json())

# Centroides (para nomes dos distritos)
gdf_centroids = gdf.copy()
gdf_centroids["centroid"] = gdf_centroids.representative_point()
gdf_centroids["lon"] = gdf_centroids["centroid"].x
gdf_centroids["lat"] = gdf_centroids["centroid"].y
centroids_dict = gdf_centroids.set_index("NAME_1")[["lon", "lat"]].to_dict("index")

# --- Dados agregados ---
anos_disponiveis = sorted(df_map["Ano"].unique())
barras_por_ano = {ano: df_barras[df_barras.iloc[:, 0] == ano].iloc[:, 1:].sum() for ano in anos_disponiveis}
spider_por_ano = {ano: df_spider[df_spider.iloc[:, 0] == ano].iloc[:, 1:].sum() for ano in anos_disponiveis}
map_por_ano = {ano: df_map[df_map["Ano"] == ano] for ano in anos_disponiveis}

# --- App ---
app = Dash(__name__)

# --- Navbar ---
navbar = html.Div(
    children=[
        dcc.Link("Homepage", href="/", style={'margin-right': '20px', 'color': 'white', 'font-size':'18px'}),
        dcc.Link("Datasets", href="/datasets", style={'margin-right': '20px', 'color': 'white', 'font-size':'18px'}),
        dcc.Link("Results", href="/results", style={'color': 'white', 'font-size':'18px'})
    ],
    style={
        'background-color': '#333',
        'padding': '10px',
        'text-align': 'center'
    }
)

# --- Homepage Layout ---
homepage_layout = html.Div(
    children=[
        navbar,
        html.Div(
            children=[
                html.H1("Welcome to the Fire Dashboard", style={'color': 'white', 'font-size': '48px', 'margin-bottom': '20px'}),
                html.P(
                    "This dashboard shows rural fires in Mainland Portugal. "
                    "Explore trends by year, district, and fire causes.",
                    style={'color': 'white', 'font-size': '20px', 'margin-bottom': '30px', 'max-width': '600px'}
                )
            ],
            style={'text-align':'center'}
        )
    ],
    style={
        'height': '100vh',
        'background-image': 'url("/assets/background_home.jpg")',
        'background-size': 'cover',
        'background-position': 'center',
        'background-repeat': 'no-repeat',
        'display': 'flex',
        'flex-direction': 'column',
        'justify-content': 'center',
        'align-items': 'center'
    }
)

# --- Datasets Layout (tabela simples) ---
datasets_layout = html.Div(
    children=[
        navbar,
        html.H2("Datasets Overview", style={'textAlign':'center', 'margin-top':'20px'}),
        html.Div([
            dcc.Dropdown(
                id='dataset-year-dropdown',
                options=[{'label': str(ano), 'value': ano} for ano in anos_disponiveis],
                value=2024
            ),
            html.Div(id='dataset-table', style={'margin':'20px'})
        ])
    ]
)

# --- Results Layout ---
fig_linhas = px.line(
    df_total,
    x=df_total.columns[0],
    y=df_total.columns[1],
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

dashboard_layout = html.Div(
    children=[
        navbar,
        html.H1("Portugal Fire Dashboard", style={'textAlign': 'center', 'color': 'white'}),
        html.Div(
            children=[
                html.P(
                    "Use the dropdown to filter by year and hover over districts to see details. "
                    "Graphs show burned area, causes, and total fires per year.",
                    style={'color': 'white', 'font-size': '18px', 'margin': '10px 20px'}
                )
            ]
        ),
        html.Div([
            html.Label("Select Year(s):", style={'color':'white'}),
            dcc.Dropdown(
                id='ano-dropdown',
                options=[{'label': str(ano), 'value': ano} for ano in anos_disponiveis],
                value=[2024],
                multi=True
            )
        ], style={'width':'35%', 'margin':'10px auto'}),
        html.Div([
            html.Div([
                dcc.Graph(id='mapa-incendios', style={'height': '600px', 'width':'100%'})
            ], style={'flex':'50%', 'padding':'5px'}),
            html.Div([
                html.Div([
                    dcc.Graph(id='linha-total', figure=fig_linhas, style={'height':'280px','width':'100%'})
                ], style={'margin-bottom':'10px'}),
                html.Div([
                    dcc.Graph(id='barras-areas', style={'height':'280px','width':'49%','display':'inline-block'}),
                    dcc.Graph(id='spider-causas', style={'height':'280px','width':'49%','display':'inline-block'})
                ])
            ], style={'flex':'50%','padding':'5px'})
        ], style={'display':'flex','justify-content':'space-between'})
    ],
    style={
        'background-image': 'url("/assets/background_results.jpg")',
        'background-size': 'cover',
        'background-position': 'center',
        'background-repeat': 'no-repeat',
        'min-height':'100vh',
        'padding-bottom':'20px'
    }
)

# --- Layout principal ---
app.layout = html.Div([
    dcc.Location(id='url', refresh=False),
    html.Div(id='page-content')
])

# --- Callback para mudar página ---
@app.callback(
    Output('page-content', 'children'),
    Input('url', 'pathname')
)
def display_page(pathname):
    if pathname == "/datasets":
        return datasets_layout
    elif pathname == "/results":
        return dashboard_layout
    else:
        return homepage_layout

# --- Callback para gráficos interativos ---
@app.callback(
    Output('mapa-incendios','figure'),
    Output('barras-areas','figure'),
    Output('spider-causas','figure'),
    Input('ano-dropdown','value'),
    Input('mapa-incendios','hoverData')
)
def update_graphs(selected_years, hoverData):
    if isinstance(selected_years, int):
        selected_years = [selected_years]
    selected_years = [ano for ano in selected_years if ano in map_por_ano]

    distrito_hover = None
    if hoverData:
        point = hoverData['points'][0]
        distrito_hover = point.get('location') or point.get('customdata')
        if distrito_hover:
            distrito_hover = str(distrito_hover).lower()

    anos_texto = ", ".join(map(str, selected_years)) if selected_years else "N/A"

    # --- Mapa ---
    if selected_years:
        df_map_filtered = pd.concat([map_por_ano[ano] for ano in selected_years])
        df_map_filtered = df_map_filtered.groupby("Distrito", as_index=False)["Num_IncendiosRurais"].sum()
    else:
        df_map_filtered = pd.DataFrame(columns=["Distrito","Num_IncendiosRurais"])

    df_map_filtered["Distrito"] = df_map_filtered["Distrito"].str.lower()
    df_map_filtered["lon"] = df_map_filtered["Distrito"].map(lambda x: centroids_dict.get(x, {}).get("lon"))
    df_map_filtered["lat"] = df_map_filtered["Distrito"].map(lambda x: centroids_dict.get(x, {}).get("lat"))
    df_map_filtered["Nome"] = df_map_filtered["Distrito"].str.capitalize()
    df_map_filtered = df_map_filtered.rename(columns={"Num_IncendiosRurais": "Number of Fires"})

    mapa_fig = px.choropleth_mapbox(
        df_map_filtered,
        geojson=gdf_json,
        locations="Distrito",
        featureidkey="properties.NAME_1",
        color="Number of Fires",
        color_continuous_scale="Reds",
        hover_name="Nome",
        hover_data={"Number of Fires": True, "Distrito": False},
        mapbox_style="open-street-map",
        center={"lat": 39.5, "lon": -8.2},
        zoom=5.8,
        opacity=0.7,
        title=f"Rural Fires by District — {anos_texto}"
    )

    # --- Centroid labels ---
    mapa_fig.add_trace(go.Scattermapbox(
        lon=df_map_filtered["lon"],
        lat=df_map_filtered["lat"],
        mode="text",
        text=df_map_filtered["Nome"],
        textfont=dict(size=11, color="black", family="Arial Black"),
        hoverinfo="none",
        showlegend=False
    ))

    mapa_fig.update_layout(
        margin={"r":0,"t":40,"l":0,"b":0},
        coloraxis_colorbar=dict(title="Number of Fires")
    )

    # --- Barras ---
    soma_areas = pd.concat([barras_por_ano[ano] for ano in selected_years], axis=1).sum(axis=1).round(0) if selected_years else pd.Series([0,0,0])
    barras_fig = go.Figure(go.Bar(
        x=["Scrubland","Forest","Agricultural"],
        y=soma_areas.values,
        marker_color=['darkred','orangered','gold'],
        marker_line_color='black',
        marker_line_width=1.5,
        text=soma_areas.astype(int).values,
        textposition='auto'
    ))
    barras_fig.update_layout(
        title=f"Burned Area by Fire Type<br>— {anos_texto}",
        yaxis_title="Burned Area (ha)",
        font=dict(size=11)
    )

    # --- Spider ---
    soma_causas = pd.concat([spider_por_ano[ano] for ano in selected_years], axis=1).sum(axis=1).round(0) if selected_years else pd.Series([0]*6)
    spider_fig = go.Figure(go.Scatterpolar(
        r=soma_causas.values.astype(int),
        theta=["Natural","Negligent","Intentional","Rekindle","Unknown","Not Investigated"],
        fill='toself',
        name='Causes'
    ))
    spider_fig.update_layout(
        polar=dict(radialaxis=dict(visible=True)),
        title=f"Fire Causes — {anos_texto}",
        font=dict(size=11)
    )

    return mapa_fig, barras_fig, spider_fig

# --- Callback para Datasets page ---
@app.callback(
    Output('dataset-table','children'),
    Input('dataset-year-dropdown','value')
)
def update_dataset_table(selected_year):
    df_filtered = df_map[df_map['Ano']==selected_year]
    return html.Table(
        # Header
        [html.Tr([html.Th(col) for col in df_filtered.columns])] +
        # Body
        [html.Tr([html.Td(df_filtered.iloc[i][col]) for col in df_filtered.columns]) for i in range(len(df_filtered))]
    )

if __name__ == '__main__':
    app.run(debug=True)
