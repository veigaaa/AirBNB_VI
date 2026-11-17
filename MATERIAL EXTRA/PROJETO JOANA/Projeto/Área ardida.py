import pandas as pd
import matplotlib.pyplot as plt
import os
from matplotlib.ticker import ScalarFormatter
import numpy as np

# --- 1. Caminho do ficheiro ---
ficheiro = r"C:\Users\joana\Desktop\Eng_comp\Visualização de informação\Projeto\Incendios.xlsx"

# --- 2. Ler Excel ---
df = pd.read_excel(
    ficheiro,
    sheet_name="Estatisticas_PortugalContinent",
    usecols="A,C:E"  # A = Ano, C-E = tipos de área ardida
)

# --- 3. Escolher o ano ---
ano = 2024  # <<< altera aqui o ano que quiseres
df_ano = df[df.iloc[:, 0] == ano]

# --- 4. Somar valores ---
soma_areas = df_ano.iloc[:, 1:].sum()

# --- 5. Labels em inglês ---
labels = ["Scrubland", "Forest", "Agricultural"]

# --- 6. Cores inspiradas no fogo ---
fire_colors = ['darkred', 'orangered', 'gold']

# --- 7. Criar gráfico de barras ---
plt.figure(figsize=(8,6))
bars = plt.bar(labels, soma_areas.values, color=fire_colors, edgecolor='black', linewidth=1.5)

# --- 8. Colocar os valores em cima das barras (notação científica) ---
for bar, valor in zip(bars, soma_areas.values):
    if valor == 0:
        plt.text(bar.get_x() + bar.get_width()/2, bar.get_height(), "0",
                 ha='center', va='bottom', fontsize=10)
        continue
    exponent = int(np.floor(np.log10(valor)))
    mantissa = valor / 10**exponent
    plt.text(
        bar.get_x() + bar.get_width()/2,
        bar.get_height(),
        f'{mantissa:.1f}×10^{exponent}',
        ha='center',
        va='bottom',
        fontsize=10
    )

# --- 9. Personalizar ---
plt.ylabel("Burned area (ha)", fontsize=12)
plt.xlabel("Fire type", fontsize=12)
plt.title(f"Burned area by fire type - Mainland {ano}", fontsize=16)
plt.grid(axis='y', linestyle='--', alpha=0.7)

# --- 10. Notação científica para eixo y ---
formatter = ScalarFormatter(useMathText=True)
formatter.set_powerlimits((0,0))
plt.gca().yaxis.set_major_formatter(formatter)

plt.tight_layout()

# --- 11. Guardar imagem ---
pasta = os.path.dirname(ficheiro)
nome_ficheiro = f"burned_area_fire_type_{ano}.png"
caminho_imagem = os.path.join(pasta, nome_ficheiro)
plt.savefig(caminho_imagem, dpi=300)
plt.close()

print(f"✅ Bar chart saved at: {caminho_imagem}")
