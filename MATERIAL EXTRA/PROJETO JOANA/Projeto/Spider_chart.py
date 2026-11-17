import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
import os

# --- Caminho do ficheiro ---
ficheiro = r"C:\Users\joana\Desktop\Eng_comp\Visualização de informação\Projeto\Incendios.xlsx"

# --- Ler Excel ---
df = pd.read_excel(
    ficheiro,
    sheet_name="Estatisticas_PortugalContinent",
    usecols="A, O:T"  # A = Ano, O a T = causas
)

# --- Escolher os anos a somar ---
anos_escolhidos = [2015, 2016, 2017, 2018]

# --- Filtrar e somar ---
df_filtrado = df[df.iloc[:, 0].isin(anos_escolhidos)]
soma_causas = df_filtrado.iloc[:, 1:].sum()

# --- Etiquetas em inglês ---
labels = [
    "Natural", "Negligent", "Intentional",
    "Reignition", "Unknown", "Not investigated"
]

# --- Valores e ângulos para radar chart ---
valores = soma_causas.values
valores = np.append(valores, valores[0])  # fechar o gráfico
num_vars = len(labels)
angles = np.linspace(0, 2 * np.pi, num_vars, endpoint=False).tolist()
angles += angles[:1]

# --- Notação científica ---
scientific_labels = [f"{v/10**np.floor(np.log10(v)):.1f}×10^{int(np.floor(np.log10(v)))}" for v in soma_causas.values]

# --- Criar gráfico ---
plt.figure(figsize=(8, 8))
ax = plt.subplot(111, polar=True)
ax.plot(angles, valores, color='firebrick', linewidth=2)
ax.fill(angles, valores, color='salmon', alpha=0.4)

# --- Personalizar eixos ---
ax.set_xticks(angles[:-1])
ax.set_xticklabels(labels, fontsize=11)
ax.set_yticklabels([])

# --- Título com anos ---
anos_texto = ", ".join(map(str, anos_escolhidos))
plt.title(f"Fire Causes in Portugal ({anos_texto})", size=16, y=1.1)

# --- Legenda 3 em cima + 3 em baixo, acima do radar chart ---
top_labels = scientific_labels[:3]
bottom_labels = scientific_labels[3:]

top_text = "   ".join([f"{label}: {val};" for label, val in zip(labels[:3], top_labels)])
bottom_text = "   ".join([f"{label}: {val};" for label, val in zip(labels[3:], bottom_labels)])

# Coordenadas em figura (0 a 1)
plt.gcf().text(0.5, 0.92, top_text, fontsize=10, va='top', ha='center', color='grey')
plt.gcf().text(0.5, 0.9, bottom_text, fontsize=10, va='top', ha='center', color='grey')

plt.tight_layout()

# --- Guardar imagem ---
pasta = os.path.dirname(ficheiro)
nome_ficheiro = f"fire_causes_portugal_{'_'.join(map(str, anos_escolhidos))}.png"
caminho_imagem = os.path.join(pasta, nome_ficheiro)
plt.savefig(caminho_imagem, dpi=300, bbox_inches='tight')
plt.close()

print(f"✅ Radar chart saved at: {caminho_imagem}")
