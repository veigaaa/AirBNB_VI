import pandas as pd
import geopandas as gpd
import json
import os

# ============================
#  FORÇAR CAMINHO DA MESMA PASTA DO SCRIPT
# ============================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

excel_path = os.path.join(BASE_DIR, "Incendios.xlsx")
shapefile_path = os.path.join(BASE_DIR, "distritos.shp")

# ============================
#  LER EXCEL
# ============================

df_total = pd.read_excel(
    excel_path,
    sheet_name="Estatisticas_PortugalContinent",
    usecols="A,B"
)

df_map = pd.read_excel(
    excel_path,
    sheet_name="Estatisticas_Distrito",
    usecols=[
        "Distrito", "Ano", "Num_IncendiosRurais",
        "AreaArdPov_NoDistrito", "AreaArdMato_NoDistrito", "AreaArdAgric_NoDistrito",
        "NInc_Natural", "NInc_Negligente", "NInc_Intencionais",
        "NInc_Reacendimentos", "NInc_Desconhecida", "NInc_NaoInvestigados"
    ]
)

# ============================
#  LER E PROCESSAR SHAPEFILE
# ============================

gdf = gpd.read_file(shapefile_path)

# Normalizar o nome do distrito no shapefile
gdf["NAME_1"] = gdf["NAME_1"].str.strip().str.lower()

# Converter para WGS84 (obrigatório para Plotly)
gdf = gdf.to_crs(epsg=4326)

# Simplificar geometria (mais leve para web)
gdf["geometry"] = gdf["geometry"].simplify(tolerance=0.01, preserve_topology=True)

# ============================
#  CENTRÓIDES PARA TÍTULOS NO MAPA
# ============================

gdf_centroids = gdf.copy()
gdf_centroids["centroid"] = gdf_centroids.representative_point()
gdf_centroids["lon"] = gdf_centroids["centroid"].x
gdf_centroids["lat"] = gdf_centroids["centroid"].y

centroids_list = []
for _, row in gdf_centroids.iterrows():
    centroids_list.append({
        "distrito": row["NAME_1"],
        "lon": row["lon"],
        "lat": row["lat"]
    })

# ============================
#  GUARDAR TUDO NA MESMA PASTA
# ============================

df_total.to_json(os.path.join(BASE_DIR, "df_total.json"), orient="records", force_ascii=False)
df_map.to_json(os.path.join(BASE_DIR, "df_map.json"), orient="records", force_ascii=False)

gdf.to_file(os.path.join(BASE_DIR, "distritos_simplificados.geojson"), driver="GeoJSON")

with open(os.path.join(BASE_DIR, "centroids.json"), "w", encoding="utf-8") as f:
    json.dump(centroids_list, f, ensure_ascii=False, indent=2)

print("\n====================================================")
print(" EXPORTAÇÃO CONCLUÍDA COM SUCESSO!")
print(" Os seguintes ficheiros foram criados na MESMA pasta:")
print("  - df_total.json")
print("  - df_map.json")
print("  - distritos_simplificados.geojson")
print("  - centroids.json")
print("====================================================\n")
