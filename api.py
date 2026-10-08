from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import joblib
import os

app = FastAPI(title="LoL Draft API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

models_dir = os.path.join(os.path.dirname(__file__), "models")
model = joblib.load(os.path.join(models_dir, "xgb_model.joblib"))
model_columns = joblib.load(os.path.join(models_dir, "model_columns.joblib"))

# 1. On ajoute les variables entières (int) au format attendu
class MatchupRequest(BaseModel):
    champion: str
    enemy_champion: str
    position: str
    ally_tanks: int = 0
    enemy_tanks: int = 0
    ally_mages: int = 0
    enemy_mages: int = 0
    ally_assassins: int = 0
    enemy_assassins: int = 0
    ally_fighters: int = 0
    enemy_fighters: int = 0
    ally_marksmen: int = 0
    enemy_marksmen: int = 0
    ally_supports: int = 0
    enemy_supports: int = 0

@app.post("/predict")
def predict_matchup(request: MatchupRequest):
    input_data = pd.DataFrame(columns=model_columns)
    input_data.loc[0] = 0 
    
    champ_col = f"champion_name_{request.champion}"
    enemy_col = f"enemy_champion_{request.enemy_champion}"
    pos_col = f"position_{request.position}"
    
    if champ_col in input_data.columns: input_data.at[0, champ_col] = 1
    if enemy_col in input_data.columns: input_data.at[0, enemy_col] = 1
    if pos_col in input_data.columns: input_data.at[0, pos_col] = 1

    # 2. Injection des valeurs numériques
    features = [
        "ally_tanks", "enemy_tanks", "ally_mages", "enemy_mages",
        "ally_assassins", "enemy_assassins", "ally_fighters", "enemy_fighters",
        "ally_marksmen", "enemy_marksmen", "ally_supports", "enemy_supports"
    ]
    for feature in features:
        if feature in input_data.columns:
            input_data.at[0, feature] = getattr(request, feature)

    prediction_proba = model.predict_proba(input_data)[0]
    win_chance = prediction_proba[1] * 100

    return {"win_chance": float(round(win_chance, 2))}