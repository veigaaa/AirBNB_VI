import pandas as pd
import geopandas as gpd
import plotly.express as px
import json
import os

# --- 1. Carregar shapefile ---
shapefile_path = r"C:\Users\joana\Desktop\Eng_comp\Visualização de informação\Projeto\distritos.shp"
gdf = gpd.read_file(shapefile_path)

# Normalizar nomes e simplificar geometria para reduzir tamanho
gdf["NAME_1"] = gdf["NAME_1"].str.strip().str.lower()
gdf["geometry"] = gdf["geometry"].simplify(tolerance=0.01, preserve_topology=True)

col_distrito = "NAME_1"

# --- 2. Carregar dados de incêndios ---
excel_path = r"C:\Users\joana\Desktop\Eng_comp\Visualização de informação\Projeto\Incêndios.xlsx"
df = pd.read_excel(
    excel_path,
    sheet_name="Estatisticas_Distrito",
    usecols=["Distrito", "Ano", "Num_IncendiosRurais"]
)
df["Distrito"] = df["Distrito"].str.strip().str.lower()

# --- 3. Filtrar ano específico ---
ano = 2024
df_ano = df[df["Ano"] == ano]

# --- 4. Converter GeoDataFrame para GeoJSON ---
gdf_json = json.loads(gdf.to_json())

# --- 5. Criar mapa Plotly ---
fig = px.choropleth(
    df_ano,
    geojson=gdf_json,
    locations="Distrito",
    featureidkey=f"properties.{col_distrito}",
    color="Num_IncendiosRurais",
    color_continuous_scale="Reds",
    title=f"Incêndios Rurais por Distrito em {ano}"
)

# --- 6. Layout compacto e mapa maior ---
fig.update_geos(fitbounds="locations", visible=False)
fig.update_layout(
    title={
        'text': f"Incêndios Rurais por Distrito em {ano}",
        'x': 0.5,
        'xanchor': 'center',
        'yanchor': 'top',
        'pad': {'b': 5, 't': 5}
    },
    margin=dict(l=5, r=5, t=40, b=5),
    height=700
)

# --- 7. Salvar HTML ---
desktop_path = os.path.join(os.path.expanduser("~"), "Desktop")
html_file = os.path.join(desktop_path, "mapa_incendios.html")
fig.write_html(html_file)
print(f"✅ HTML criado: {html_file}")

# --- 8. Salvar PNG (precisa do kaleido) ---
png_file = os.path.join(desktop_path, "mapa_incendios.png")
fig.write_image(png_file)  # exige: pip install -U kaleido
print(f"✅ PNG criado: {png_file}")

# --- 9. Mostrar mapa interativo ---
fig.show()

# Mostrar mapa interativo
fig.show()