from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import joblib
import os

# 1. Initialisation de l'API
app = FastAPI(title="LoL Draft API")

# Autoriser n'importe quel site web (HTML/JS) à interroger notre API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # En production, on mettrait l'URL de ton site
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Chargement du modèle au démarrage
models_dir = os.path.join(os.path.dirname(__file__), "models")
model = joblib.load(os.path.join(models_dir, "rf_model.joblib"))
model_columns = joblib.load(os.path.join(models_dir, "model_columns.joblib"))

# 3. Définition du format attendu
class MatchupRequest(BaseModel):
    champion: str
    position: str

# 4. Le point d'entrée pour les requêtes web
@app.post("/predict")
def predict_matchup(request: MatchupRequest):
    # On prépare la ligne de 0 comme dans Streamlit
    input_data = pd.DataFrame(columns=model_columns)
    input_data.loc[0] = 0 
    
    champ_col = f"champion_name_{request.champion}"
    pos_col = f"position_{request.position}"
    
    if champ_col in input_data.columns: input_data.at[0, champ_col] = 1
    if pos_col in input_data.columns: input_data.at[0, pos_col] = 1

    # Prédiction
    prediction_proba = model.predict_proba(input_data)[0]
    win_chance = prediction_proba[1] * 100

    # L'API renvoie un simple dictionnaire (JSON)
    return {"win_chance": round(win_chance, 2)}