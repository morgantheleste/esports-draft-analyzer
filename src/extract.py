import os
import time
import requests
import pandas as pd
import sqlite3
from dotenv import load_dotenv

# 1. Configuration et Sécurité
load_dotenv()
API_KEY = os.getenv("RIOT_API_KEY")
HEADERS = {"X-Riot-Token": API_KEY}

RIOT_ID = "idjaz"
TAGLINE = "lzd"
REGION_EUROPE = "europe" # Utilisé pour le compte et la liste des matchs
REGION_EUW = "euw1"      # Riot utilise parfois des sous-régions selon les endpoints

def get_puuid():
    """Convertit le Riot ID en PUUID."""
    url = f"https://{REGION_EUROPE}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{RIOT_ID}/{TAGLINE}"
    response = requests.get(url, headers=HEADERS)
    if response.status_code == 200:
        return response.json()["puuid"]
    print(f"Erreur PUUID: {response.status_code}")
    return None

def get_recent_matches(puuid, count=100):
    """Récupère la liste des derniers identifiants de matchs."""
    # Riot limite cette requête à 100 matchs maximum d'un coup
    count = min(count, 100)
        
    url = f"https://{REGION_EUROPE}.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids?start=0&count={count}"
    response = requests.get(url, headers=HEADERS)
    
    # Si Riot nous bloque dès cette étape, on attend !
    if response.status_code == 429:
        print("Limite API atteinte pour lister les matchs, pause de 10s...")
        time.sleep(10)
        return get_recent_matches(puuid, count)
        
    if response.status_code == 200:
        return response.json()
        
    print(f"Erreur liste matchs: {response.status_code}")
    return []

def get_match_details(match_id):
    """Récupère les détails d'un match et extrait les stats des 10 joueurs."""
    url = f"https://{REGION_EUROPE}.api.riotgames.com/lol/match/v5/matches/{match_id}"
    response = requests.get(url, headers=HEADERS)
    
    if response.status_code == 429:
        print("Limite API atteinte, pause de 10s...")
        time.sleep(10)
        return get_match_details(match_id)
        
    if response.status_code != 200:
        print(f"Erreur détails match {match_id}: {response.status_code}")
        return None

    data = response.json()
    participants = data["info"]["participants"]
    match_data = []
    
    for player in participants:
        match_data.append({
            "match_id": match_id,
            "team_id": player["teamId"],
            "champion_name": player["championName"],
            "position": player["teamPosition"],
            "win": player["win"]
        })
    return match_data

if __name__ == "__main__":
    print(f"Démarrage du pipeline pour {RIOT_ID}#{TAGLINE}...")
    
    # Étape A : Trouver le PUUID
    puuid = get_puuid()
    if not puuid:
        exit("Impossible de trouver le compte.")
        
    # Étape B : Lister les matchs
    match_ids = get_recent_matches(puuid, count=200) # On prend 200 matchs pour avoir un dataset plus conséquent
    print(f"{len(match_ids)} matchs trouvés. Début de l'extraction...")
    
    # Étape C : Extraire les détails
    all_matches_data = []
    for match_id in match_ids:
        print(f"Extraction des données pour {match_id}...")
        details = get_match_details(match_id)
        if details:
            all_matches_data.extend(details)
        time.sleep(1.2) # Rate limiting de sécurité (max 20 requêtes/sec et 100/2min chez Riot)

    if all_matches_data:
        # Étape D : Sauvegarde SQL via Pandas
        df = pd.DataFrame(all_matches_data)
        os.makedirs("../data", exist_ok=True)
        # Attention au chemin si tu lances le script depuis le dossier src ou la racine
        # On va le forcer dans un dossier data à la racine du projet
        db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "matches.db")
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        
        conn = sqlite3.connect(db_path)
        df.to_sql("match_participants", conn, if_exists="append", index=False)
        conn.close()
        
        print("\nPipeline terminé ! Les données sont dans data/matches.db")
        print(df.head())
    else:
        print("Aucune donnée extraite.")