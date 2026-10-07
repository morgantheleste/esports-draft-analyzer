// 1. Chargement dynamique de TOUS les champions via l'API Riot (Data Dragon)
async function loadChampions() {
    try {
        const verRes = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
        const versions = await verRes.json();
        const champRes = await fetch(`https://ddragon.leagueoflegends.com/cdn/${versions[0]}/data/fr_FR/champion.json`);
        const champData = await champRes.json();
        
        const datalist = document.getElementById('champ-list');
        Object.keys(champData.data).forEach(champ => {
            const option = document.createElement('option');
            option.value = champ;
            datalist.appendChild(option);
        });
    } catch (error) {
        console.error("Impossible de charger la liste des champions.");
    }
}
loadChampions();

// 2. Logique de l'interface et du calcul
const predictBtn = document.getElementById('predict-btn');
const resultContainer = document.getElementById('result-container');
const resultText = document.getElementById('result-text');
const resultMessage = document.getElementById('result-message');

predictBtn.addEventListener('click', async () => {
    const champion = document.getElementById('champion').value;
    const enemyChampion = document.getElementById('enemy_champion').value;
    const position = document.getElementById('position').value;
    
    const allyTanks = parseInt(document.getElementById('ally_tanks').value) || 0;
    const enemyTanks = parseInt(document.getElementById('enemy_tanks').value) || 0;
    const allyMages = parseInt(document.getElementById('ally_mages').value) || 0;
    const enemyMages = parseInt(document.getElementById('enemy_mages').value) || 0;

    // --- SÉCURITÉ : Vérification du nombre de joueurs (Validation Métier) ---
    if (!champion || !enemyChampion) {
        alert("N'oublie pas de choisir les deux champions !");
        return;
    }
    if (allyTanks + allyMages > 4) {
        alert("Équipe invalide : Tu occupes déjà 1 place, il ne reste que 4 places maximum pour tes alliés !");
        return; // On bloque l'envoi à l'IA
    }
    if (enemyTanks + enemyMages > 5) {
        alert("Équipe invalide : L'équipe adverse ne peut avoir que 5 joueurs maximum !");
        return;
    }
    // ------------------------------------------------------------------------

    resultContainer.classList.remove('hidden', 'victory', 'defeat');
    resultText.innerText = "⏳";
    resultMessage.innerText = "Calcul des probabilités du duel...";
    resultMessage.style.color = "#cbd5e1";

    try {
        const response = await fetch("http://127.0.0.1:8000/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                champion: champion, 
                enemy_champion: enemyChampion, 
                position: position,
                ally_tanks: allyTanks,
                enemy_tanks: enemyTanks,
                ally_mages: allyMages,
                enemy_mages: enemyMages
            })
        });

        if (!response.ok) throw new Error("Erreur serveur");

        const data = await response.json();
        
        // --- CORRECTION DES DÉCIMALES ---
        // On force mathématiquement l'affichage à 2 chiffres après la virgule
        const winChance = Number(data.win_chance).toFixed(2); 

        resultText.innerText = `${winChance}%`;

        if (winChance > 50) {
            resultContainer.classList.add('victory');
            resultMessage.innerText = "Matchup et composition favorables !";
        } else {
            resultContainer.classList.add('defeat');
            resultMessage.innerText = "Attention, draft statistiquement désavantagée.";
        }

    } catch (error) {
        resultText.innerText = "❌";
        resultMessage.innerText = "Impossible de joindre l'IA. FastAPI est-il lancé ?";
        resultMessage.style.color = "#f87171";
    }
});