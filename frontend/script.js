/* ============================================================================
   SCRIPT.JS — Logique principale du Draft Analyzer
   ============================================================================
   Ce fichier contient toute la logique JavaScript de l'application.
   Il fait 3 choses :
     1. Charger la liste des champions depuis l'API Riot (Data Dragon)
     2. Gérer le formulaire et envoyer les données à mon API FastAPI
     3. Afficher le résultat avec les animations
   
   En bonus, il y a aussi le système de particules animées en fond.
   ============================================================================ */


// ==========================================================================
// NOTE : Pas de fond animé (particules, etc.)
// ==========================================================================
// J'ai choisi un style neumorphique sobre. Le fond est uni, sans animation.
// Si un jour je veux remettre un fond animé, il faudra ajouter un <canvas>
// dans le HTML et remettre le code de particules ici.



// ==========================================================================
// 2. CHARGEMENT DYNAMIQUE DE LA LISTE DES CHAMPIONS
// ==========================================================================
// Ici je vais chercher la liste de TOUS les champions de LoL via l'API 
// publique de Riot Games (Data Dragon). C'est une API gratuite qui ne 
// nécessite pas de clé API.
//
// Étapes :
//   a) Récupérer la dernière version du jeu (ex: "14.20.1")
//   b) Avec cette version, récupérer le JSON de tous les champions
//   c) Remplir le <datalist> du HTML pour l'autocomplétion
//
// J'utilise async/await parce que les appels réseau sont asynchrones
// (ils prennent du temps et je ne veux pas bloquer l'interface).

async function loadChampions() {
    try {
        // Étape a) : récupérer le numéro de la dernière version du jeu
        const versionResponse = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
        const versions = await versionResponse.json();
        // versions[0] = la version la plus récente (c'est toujours la première)
        const latestVersion = versions[0];

        // Étape b) : récupérer la liste des champions avec cette version
        // J'utilise fr_FR pour avoir les noms en français
        const champResponse = await fetch(
            `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/fr_FR/champion.json`
        );
        const champData = await champResponse.json();

        // Étape c) : remplir le datalist HTML pour l'autocomplétion
        const datalist = document.getElementById('champ-list');
        
        // Object.keys() me donne un tableau avec tous les noms de champions
        // Je les trie par ordre alphabétique pour que ce soit plus facile à chercher
        const championNames = Object.keys(champData.data).sort();
        
        championNames.forEach(champ => {
            const option = document.createElement('option');
            option.value = champ;   // La valeur envoyée à l'API (ex: "Yasuo", "Ahri")
            datalist.appendChild(option);
        });

        console.log(`${championNames.length} champions charges (patch ${latestVersion})`);

    } catch (error) {
        // Si l'API Riot ne répond pas (pas de connexion internet, etc.)
        console.error("Impossible de charger la liste des champions :", error);
    }
}

// Lancer le chargement dès que la page s'ouvre
loadChampions();


// ==========================================================================
// 3. GESTION DES BOUTONS +/- POUR LES COMPTEURS
// ==========================================================================
// Au lieu d'utiliser les flèches par défaut du <input type="number">
// (qui sont petites et moches), j'ai créé mes propres boutons + et -.
// 
// Chaque bouton a un attribut "data-target" qui contient l'ID du champ
// qu'il contrôle (ex: data-target="ally_tanks").

document.querySelectorAll('.number-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Récupérer le champ cible via l'attribut data-target
        const targetId = btn.getAttribute('data-target');
        const input = document.getElementById(targetId);
        
        // Lire les valeurs actuelles et les limites min/max
        let currentValue = parseInt(input.value) || 0;
        const minValue = parseInt(input.min) || 0;
        const maxValue = parseInt(input.max) || 5;

        // Si c'est le bouton +, on incrémente (sans dépasser le max)
        if (btn.classList.contains('plus') && currentValue < maxValue) {
            input.value = currentValue + 1;
        }
        // Si c'est le bouton -, on décrémente (sans descendre sous le min)
        if (btn.classList.contains('minus') && currentValue > minValue) {
            input.value = currentValue - 1;
        }
    });
});


// ==========================================================================
// 4. GESTION DU MENU DÉROULANT PERSONNALISÉ (RÔLES)
// ==========================================================================
// Comme le vrai <select> est caché, on gère les clics sur notre faux menu.
// Quand on clique sur une option, on met à jour le texte affiché et on
// change la valeur du vrai <select> caché en arrière-plan.

const customSelect = document.getElementById('custom-role-select');
if (customSelect) {
    const trigger = customSelect.querySelector('.custom-select-trigger');
    const options = customSelect.querySelectorAll('.custom-option');
    const hiddenSelect = document.getElementById('position');
    const triggerValue = customSelect.querySelector('.custom-select-value');

    // Ouvrir/Fermer le menu au clic
    trigger.addEventListener('click', function() {
        customSelect.classList.toggle('open');
    });

    // Fermer le menu si on clique n'importe où ailleurs sur la page
    window.addEventListener('click', function(e) {
        if (!customSelect.contains(e.target)) {
            customSelect.classList.remove('open');
        }
    });

    // Quand on choisit un rôle dans la liste
    options.forEach(option => {
        option.addEventListener('click', function() {
            // 1. Mettre à jour le vrai select (caché)
            const value = this.getAttribute('data-value');
            hiddenSelect.value = value;
            
            // 2. Mettre à jour l'affichage principal (avec l'image et le texte)
            triggerValue.innerHTML = this.innerHTML;
            
            // 3. Déplacer la classe "selected" sur la bonne option
            options.forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            
            // 4. Fermer le menu
            customSelect.classList.remove('open');
        });
    });
}


// ==========================================================================
// 5. LOGIQUE PRINCIPALE — ENVOI À L'API ET AFFICHAGE DU RÉSULTAT
// ==========================================================================
// Quand l'utilisateur clique sur "Analyser le Duel", on :
//   1. Récupère toutes les valeurs du formulaire
//   2. Valide les données (vérification métier)
//   3. Envoie une requête POST à mon API FastAPI
//   4. Affiche le résultat avec les bonnes couleurs et animations

// Récupérer les éléments du DOM dont j'ai besoin
const predictBtn = document.getElementById('predict-btn');
const resultContainer = document.getElementById('result-container');
const resultText = document.getElementById('result-text');
const resultMessage = document.getElementById('result-message');
const progressBar = document.getElementById('progress-bar');

// Le texte et le loader du bouton (pour alterner pendant le chargement)
const btnTextEl = predictBtn.querySelector('.btn-text');
const btnLoaderEl = predictBtn.querySelector('.btn-loader');

predictBtn.addEventListener('click', async () => {

    // ----- ÉTAPE 1 : Récupérer les valeurs du formulaire -----
    const champion = document.getElementById('champion').value.trim();
    const enemyChampion = document.getElementById('enemy_champion').value.trim();
    const position = document.getElementById('position').value;

    // parseInt convertit le texte en nombre. Le "|| 0" gère le cas où c'est vide.
    const allyTanks = parseInt(document.getElementById('ally_tanks').value) || 0;
    const enemyTanks = parseInt(document.getElementById('enemy_tanks').value) || 0;
    const allyMages = parseInt(document.getElementById('ally_mages').value) || 0;
    const enemyMages = parseInt(document.getElementById('enemy_mages').value) || 0;
    
    const allyAssassins = parseInt(document.getElementById('ally_assassins').value) || 0;
    const enemyAssassins = parseInt(document.getElementById('enemy_assassins').value) || 0;
    const allyFighters = parseInt(document.getElementById('ally_fighters').value) || 0;
    const enemyFighters = parseInt(document.getElementById('enemy_fighters').value) || 0;
    const allyMarksmen = parseInt(document.getElementById('ally_marksmen').value) || 0;
    const enemyMarksmen = parseInt(document.getElementById('enemy_marksmen').value) || 0;
    const allySupports = parseInt(document.getElementById('ally_supports').value) || 0;
    const enemySupports = parseInt(document.getElementById('enemy_supports').value) || 0;

    // ----- ÉTAPE 2 : Validation métier -----
    // Je vérifie que les données sont cohérentes avant d'envoyer à l'IA

    // Vérif 1 : Les deux champions doivent être remplis
    if (!champion || !enemyChampion) {
        alert("N'oublie pas de choisir les deux champions.");
        return;   // On arrête tout, on n'envoie rien à l'API
    }

    // Vérif 2 : L'équipe alliée ne peut pas avoir plus de 4 autres joueurs
    // (puisque MOI j'occupe déjà 1 des 5 places)
    const totalAllies = allyTanks + allyMages + allyAssassins + allyFighters + allyMarksmen + allySupports;
    if (totalAllies > 4) {
        alert("Equipe invalide : tu occupes deja 1 place, il reste max 4 places pour tes allies.");
        return;
    }

    // Vérif 3 : L'équipe ennemie ne peut pas avoir plus de 5 joueurs au total
    const totalEnemies = enemyTanks + enemyMages + enemyAssassins + enemyFighters + enemyMarksmen + enemySupports;
    if (totalEnemies > 5) {
        alert("Equipe invalide : l'equipe adverse ne peut avoir que 5 joueurs max.");
        return;
    }

    // ----- ÉTAPE 3 : Afficher l'état de chargement -----
    // On enlève les anciens résultats et on montre le spinner
    resultContainer.classList.remove('victory', 'defeat');
    resultContainer.classList.add('hidden');
    resultText.innerText = "...";
    resultMessage.innerText = "L'IA analyse la draft...";
    resultMessage.style.color = "";   // Reset la couleur
    progressBar.style.width = "0%";

    // Basculer le bouton en mode "loading"
    btnTextEl.classList.add('hidden');
    btnLoaderEl.classList.remove('hidden');
    predictBtn.disabled = true;        // Empêcher de re-cliquer pendant le calcul
    predictBtn.style.opacity = "0.7";

    try {
        // ----- ÉTAPE 4 : Appel à l'API FastAPI -----
        // Mon API tourne sur http://127.0.0.1:8000 (en local)
        // Elle attend un POST avec un JSON contenant toutes les infos du matchup
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
                enemy_mages: enemyMages,
                ally_assassins: allyAssassins,
                enemy_assassins: enemyAssassins,
                ally_fighters: allyFighters,
                enemy_fighters: enemyFighters,
                ally_marksmen: allyMarksmen,
                enemy_marksmen: enemyMarksmen,
                ally_supports: allySupports,
                enemy_supports: enemySupports
            })
        });

        // Si l'API renvoie une erreur HTTP (400, 500, etc.)
        if (!response.ok) {
            throw new Error(`Erreur serveur (code ${response.status})`);
        }

        // Lire la réponse JSON de l'API
        const data = await response.json();

        // ----- ÉTAPE 5 : Afficher le résultat -----
        // On force 2 décimales pour un affichage propre (ex: "67.34" au lieu de "67.3421...")
        const winChance = Number(data.win_chance).toFixed(2);

        // Faire apparaître la carte résultat avec une petite tempo
        // (le setTimeout donne le temps au navigateur de faire l'animation)
        setTimeout(() => {
            resultContainer.classList.remove('hidden');
        }, 100);

        // Afficher le pourcentage
        resultText.innerText = `${winChance}%`;

        // Remplir la barre de progression proportionnellement
        setTimeout(() => {
            progressBar.style.width = `${Math.min(winChance, 100)}%`;
        }, 300);

        // Appliquer le thème victoire ou défaite selon le pourcentage
        if (winChance > 50) {
            resultContainer.classList.add('victory');
            resultMessage.innerText = "Matchup et composition favorables.";
        } else {
            resultContainer.classList.add('defeat');
            resultMessage.innerText = "Attention, draft statistiquement desavantagee.";
        }

    } catch (error) {
        // ----- EN CAS D'ERREUR -----
        // Si l'API n'est pas lancée ou s'il y a un problème réseau
        console.error("Erreur lors de l'appel API :", error);

        setTimeout(() => {
            resultContainer.classList.remove('hidden');
        }, 100);

        resultText.innerText = "Erreur";
        resultMessage.innerText = "Impossible de joindre l'IA. FastAPI est-il lance ? (uvicorn api:app --reload)";
        resultMessage.style.color = "#f87171";   // Rouge pour l'erreur

    } finally {
        // ----- DANS TOUS LES CAS -----
        // Remettre le bouton en état normal (que ça ait marché ou pas)
        btnTextEl.classList.remove('hidden');
        btnLoaderEl.classList.add('hidden');
        predictBtn.disabled = false;
        predictBtn.style.opacity = "1";
    }
});