import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.ticker import ScalarFormatter
import os

# --- Caminho do ficheiro ---
ficheiro = r"C:\Users\joana\Desktop\Eng_comp\Visualização de informação\Projeto\Incendios.xlsx"

# --- Caminho para guardar a imagem ---
imagem_saida = r"C:\Users\joana\Desktop\Eng_comp\Visualização de informação\Projeto\Total_incendios.png"

# --- Verificação ---
if not os.path.exists(ficheiro):
    raise FileNotFoundError(f"O ficheiro não foi encontrado: {ficheiro}")

# --- Ler Excel ---
df = pd.read_excel(
    ficheiro,
    sheet_name="Estatisticas_PortugalContinent",
    usecols=[0, 1]
)

# --- Criar gráfico ---
fig, ax = plt.subplots(figsize=(10,6))
ax.plot(df.iloc[:,0], df.iloc[:,1], marker='o', color='firebrick', linewidth=2)

# --- Mostrar todos os valores no eixo X e rodar ---
plt.xticks(df.iloc[:,0], rotation=45, ha='right')

# --- Notação científica em formato ×10ⁿ no eixo Y ---
formatter = ScalarFormatter(useMathText=True)
formatter.set_powerlimits((0, 0))
ax.yaxis.set_major_formatter(formatter)

# --- Personalizar gráfico ---
ax.set_title("Number of Fires in Mainland Portugal", fontsize=16)
ax.set_xlabel("Year", fontsize=12)
ax.set_ylabel("Number of fires", fontsize=12)
ax.grid(True)
plt.tight_layout()

# --- Guardar imagem em alta qualidade ---
plt.savefig(imagem_saida, dpi=300, bbox_inches='tight')
print(f"✅ Imagem guardada em: {imagem_saida}")

# --- Mostrar gráfico ---
plt.show()