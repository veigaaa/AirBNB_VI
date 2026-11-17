import pandas as pd
import json
import os

# Caminho ABSOLUTO do Excel
excel_path = r"C:\Users\joana\Desktop\Eng_comp\Visualização de informação\Projeto\Atual\Incendios.xlsx"

# Verificar se o ficheiro existe
if not os.path.exists(excel_path):
    raise FileNotFoundError(f"Ficheiro não encontrado: {excel_path}")

# Ler todas as sheets
xls = pd.ExcelFile(excel_path)

data = {}
for sheet in xls.sheet_names:
    df = xls.parse(sheet)
    df = df.fillna("")  # substituir NaN por vazio
    data[sheet] = df.to_dict(orient="records")

# Guardar o ficheiro JSON resultante
output_path = r"C:\Users\joana\Desktop\Eng_comp\Visualização de informação\Projeto\Atual\incendios_all.json"
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("JSON criado com sucesso:")
print(output_path)
