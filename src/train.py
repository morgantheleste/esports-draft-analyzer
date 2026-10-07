import os
import sqlite3
import pandas as pd
from sklearn.model_selection import train_test_split
import xgboost as xgb
from sklearn.metrics import accuracy_score
import joblib

print("1. Chargement des données massives...")
db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "matches.db")
conn = sqlite3.connect(db_path)
df = pd.read_sql("SELECT * FROM match_participants", conn)
conn.close()

print(f"--> {len(df)} lignes de joueurs chargées.")

print("2. Feature Engineering...")
y = df["win"].astype(int)
X = pd.get_dummies(df[["champion_name", "position"]])

print("3. Séparation Train/Test...")
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

print("4. Entraînement du modèle XGBoost...")
# Paramètres optimisés pour éviter le sur-apprentissage (Overfitting)
model = xgb.XGBClassifier(
    n_estimators=200,        # Nombre d'arbres
    learning_rate=0.05,      # Vitesse d'apprentissage
    max_depth=4,             # Profondeur des arbres (faible pour éviter d'apprendre par coeur)
    subsample=0.8,           # Utilise 80% des données par arbre
    random_state=42
)
model.fit(X_train, y_train)

print("5. Évaluation...")
predictions = model.predict(X_test)
accuracy = accuracy_score(y_test, predictions)

print("-" * 30)
print(f"Précision (Accuracy) XGBoost : {accuracy * 100:.2f}%")
print("-" * 30)

# Sauvegarde
models_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")
joblib.dump(model, os.path.join(models_dir, "xgb_model.joblib")) # Nouveau nom !
joblib.dump(X.columns.tolist(), os.path.join(models_dir, "model_columns.joblib"))
print("Modèle XGBoost sauvegardé dans models/xgb_model.joblib")