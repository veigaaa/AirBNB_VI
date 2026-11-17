import pandas as pd
import geopandas as gpd
import plotly.express as px
import json
import os

# --- 1. Carregar shapefile ---
shapefile_path = r"C:\Users\joana\Desktop\Eng_comp\Visualização de informação\Projeto\distritos.shp"
gdf = gpd.read_file(shapefile_path)
gdf["NAME_1"] = gdf["NAME_1"].str.strip().str.lower()

# --- 1a. Simplificar geometria para acelerar renderização ---
# tolerance maior = menos pontos, mas mantém a forma geral
gdf["geometry"] = gdf["geometry"].simplify(tolerance=0.05, preserve_topology=True)
col_distrito = "NAME_1"

# --- 2. Carregar dados ---
excel_path = r"C:\Users\joana\Desktop\Eng_comp\Visualização de informação\Projeto\Incendios.xlsx"
df = pd.read_excel(
    excel_path,
    sheet_name="Estatisticas_Distrito",
    usecols=["Distrito", "Ano", "Num_IncendiosRurais"]
)
df["Distrito"] = df["Distrito"].str.strip().str.lower()

# --- 3. Filtrar ano ---
ano = 2024
df_ano = df[df["Ano"] == ano]

# --- 4. Converter GeoJSON ---
gdf_json = json.loads(gdf.to_json())

# --- 5. Criar mapa ---
fig = px.choropleth(
    df_ano,
    geojson=gdf_json,
    locations="Distrito",
    featureidkey=f"properties.{col_distrito}",
    color="Num_IncendiosRurais",
    color_continuous_scale="Reds",
    title=f"Wildfires by District in {ano}"
)

# --- 6. Layout: manter tamanhos originais ---
fig.update_geos(
    fitbounds="locations",
    visible=False
)

fig.update_layout(
    title={
        'text': f"Wildfires by District in {ano}",
        'x': 0.5,
        'xanchor': 'center',
        'y': 0.75,
        'yanchor': 'top'
    },
    margin=dict(l=10, r=10, t=60, b=10),
    height=700,
    coloraxis_colorbar=dict(
        title="Number of fires",
        x=0.75,
        xanchor="left",
        len=0.5,
        y=0.5
    ),
)

# --- 7. Guardar PNG mais rápido ---
desktop_path = os.path.join(os.path.expanduser("~"), "Desktop")
png_file = os.path.join(desktop_path, f"mapa_incendios_{ano}.png")
fig.write_image(png_file)  # exige: pip install -U kaleido
print(f"✅ PNG criado: {png_file}")

# --- 8. Mostrar mapa ---
fig.show()
