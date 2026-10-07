# E-Sports Draft & Matchup Analyzer (MLOps Pipeline)

Ce projet est une preuve de concept d'un pipeline de Machine Learning de bout en bout appliqué à l'e-sport (League of Legends). De l'extraction des données via l'API Riot jusqu'au déploiement d'une API de prédiction en temps réel.

## Architecture Technique
- **Data Engineering :** Extraction automatisée (Python/Requests) avec gestion du Rate Limiting.
- **Base de données :** Stockage local structuré (SQLite & Pandas).
- **Machine Learning :** Modèle XGBoost entraîné sur les historiques de matchs (Scikit-learn/XGBoost).
- **Déploiement (MLOps) :** API REST (FastAPI) couplée à un Frontend asynchrone (Vanilla JS/HTML/CSS).

## Comment lancer le projet localement ?

1. **Cloner le dépôt et installer les dépendances :**

bash:

git clone https://github.com/TON_NOM/esports-draft-analyzer.git
cd esports-draft-analyzer
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

2. **Configuration :**
Créez un fichier `.env` à la racine et ajoutez votre clé Riot API :
`RIOT_API_KEY=RGAPI-votre-cle-ici`

3. **Générer les données et le modèle :**

bash:

python src/extract.py
python src/train.py

4. **Lancer l'API en production :**

bash:

python -m uvicorn api:app --reload

Puis ouvrez `frontend/index.html` dans votre navigateur.