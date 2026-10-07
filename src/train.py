import os
import sqlite3
import pandas as pd
from sklearn.model_selection import train_test_split
import xgboost as xgb
from sklearn.metrics import accuracy_score
import joblib

print("1. Chargement des données (Matchups + Macro)...")
project_root = os.path.dirname(os.path.dirname(__file__))
db_path = os.path.join(project_root, "data", "matches.db")

conn = sqlite3.connect(db_path)
df = pd.read_sql("SELECT * FROM match_participants", conn)
conn.close()

print(f"--> {len(df)} duels chargés.")

print("2. Feature Engineering Avancé (Mixte)...")
y = df["win"].astype(int)

# A. On isole les variables catégorielles (Textes) et on applique le One-Hot Encoding
categorical_cols = ["champion_name", "enemy_champion", "position"]
X_categorical = pd.get_dummies(df[categorical_cols], dtype=int)

# B. On isole les variables numériques (Déjà prêtes pour le modèle)
numerical_cols = ["ally_tanks", "enemy_tanks", "ally_mages", "enemy_mages"]
X_numerical = df[numerical_cols]

# C. On concatène (fusionne) les deux tableaux côte à côte
X = pd.concat([X_categorical, X_numerical], axis=1)

print("3. Séparation Train/Test...")
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

print("4. Entraînement du modèle XGBoost...")
model = xgb.XGBClassifier(
    n_estimators=500,   # On augmente le nombre de tentatives (arbres)
    learning_rate=0.1,  # On le rend plus réactif
    max_depth=15,       # Des arbres TRES profonds pour creuser jusqu'aux noms des champions 
    min_child_weight=1, # CRUCIAL : l'autorise à retenir un matchup vu 1 seule fois
    random_state=42     
)
model.fit(X_train, y_train)

print("5. Évaluation...")
predictions = model.predict(X_test)
accuracy = accuracy_score(y_test, predictions)

print("-" * 30)
print(f"Précision (Accuracy) avec Macro : {accuracy * 100:.2f}%")
print("-" * 30)

# Sauvegarde
models_dir = os.path.join(project_root, "models")
os.makedirs(models_dir, exist_ok=True)
joblib.dump(model, os.path.join(models_dir, "xgb_model.joblib"))
joblib.dump(X.columns.tolist(), os.path.join(models_dir, "model_columns.joblib"))
print("Modèle sauvegardé avec l'ensemble des features.")