import os
import time
import requests
import pandas as pd
import sqlite3
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("RIOT_API_KEY")
HEADERS = {"X-Riot-Token": API_KEY}

RIOT_ID = "idjaz"
TAGLINE = "lzd"
REGION_EUROPE = "europe"

# --- NOUVEAU : DATA DRAGON (Zéro limite d'API) ---
print("Initialisation du dictionnaire des champions (Data Dragon)...")
version_url = "https://ddragon.leagueoflegends.com/api/versions.json"
latest_version = requests.get(version_url).json()[0]
champ_url = f"http://ddragon.leagueoflegends.com/cdn/{latest_version}/data/en_US/champion.json"
champ_data = requests.get(champ_url).json()["data"]

# On crée un dictionnaire { "Singed": ["Fighter", "Tank"], "Viktor": ["Mage"] }
CHAMP_TAGS = {champ: data["tags"] for champ, data in champ_data.items()}
# ------------------------------------------------

def get_puuid():
    url = f"https://{REGION_EUROPE}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{RIOT_ID}/{TAGLINE}"
    response = requests.get(url, headers=HEADERS)
    if response.status_code == 200: return response.json()["puuid"]
    return None

def get_recent_matches(puuid, count=100):
    count = min(count, 100)
    url = f"https://{REGION_EUROPE}.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids?start=0&count={count}"
    response = requests.get(url, headers=HEADERS)
    
    if response.status_code == 429:
        print("Pause de 10s (Rate Limit)...")
        time.sleep(10)
        return get_recent_matches(puuid, count)
        
    if response.status_code == 200: return response.json()
    return []

def count_team_stats(team_participants):
    """Compte le nombre de rôles clés dans une équipe."""
    tanks = 0
    mages = 0
    for p in team_participants:
        tags = CHAMP_TAGS.get(p["championName"], [])
        if "Tank" in tags: tanks += 1
        if "Mage" in tags: mages += 1
    return tanks, mages

def get_match_details(match_id):
    url = f"https://{REGION_EUROPE}.api.riotgames.com/lol/match/v5/matches/{match_id}"
    response = requests.get(url, headers=HEADERS)
    
    if response.status_code == 429:
        print("Pause de 10s (Rate Limit)...")
        time.sleep(10)
        return get_match_details(match_id)
        
    if response.status_code != 200: return None

    participants = response.json()["info"]["participants"]
    match_data = []
    
    # Séparation des équipes et analyse globale de la composition
    team_100 = [p for p in participants if p["teamId"] == 100]
    team_200 = [p for p in participants if p["teamId"] == 200]
    
    tanks_100, mages_100 = count_team_stats(team_100)
    tanks_200, mages_200 = count_team_stats(team_200)

    # Mapping des positions pour les matchups
    opponents = {100: {}, 200: {}}
    for p in participants:
        if p["teamPosition"]: opponents[p["teamId"]][p["teamPosition"]] = p["championName"]

    for player in participants:
        pos = player["teamPosition"]
        my_team = player["teamId"]
        enemy_team = 200 if my_team == 100 else 100
        
        enemy_champ = opponents[enemy_team].get(pos, "Unknown")
        
        # Attribution des stats globales (Niveau 2)
        ally_tanks, ally_mages = (tanks_100, mages_100) if my_team == 100 else (tanks_200, mages_200)
        enemy_tanks, enemy_mages = (tanks_200, mages_200) if my_team == 100 else (tanks_100, mages_100)

        if pos and enemy_champ != "Unknown":
            match_data.append({
                "match_id": match_id,
                "champion_name": player["championName"],
                "enemy_champion": enemy_champ,
                "position": pos,
                "ally_tanks": ally_tanks,     # NOUVEAU
                "enemy_tanks": enemy_tanks,   # NOUVEAU
                "ally_mages": ally_mages,     # NOUVEAU
                "enemy_mages": enemy_mages,   # NOUVEAU
                "win": player["win"]
            })
    return match_data

if __name__ == "__main__":
    print(f"Démarrage du pipeline V2 pour {RIOT_ID}#{TAGLINE}...")
    puuid = get_puuid()
    if not puuid: exit()
    
    match_ids = get_recent_matches(puuid, count=100)
    all_matches_data = []
    
    for match_id in match_ids:
        print(f"Extraction du match {match_id}...")
        details = get_match_details(match_id)
        if details: all_matches_data.extend(details)
        time.sleep(1.2)

    if all_matches_data:
        df = pd.DataFrame(all_matches_data)
        db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "matches.db")
        conn = sqlite3.connect(db_path)
        # On remplace la table entière pour éviter les conflits de colonnes
        df.to_sql("match_participants", conn, if_exists="replace", index=False)
        conn.close()
        print("\nExtraction réussie ! Les stats globales d'équipes ont été ajoutées.")
        print(df.head())