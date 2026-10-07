// On cible nos éléments HTML
const predictBtn = document.getElementById('predict-btn');
const resultContainer = document.getElementById('result-container');
const resultText = document.getElementById('result-text');
const resultMessage = document.getElementById('result-message');

// On ajoute un écouteur d'événement sur le bouton
predictBtn.addEventListener('click', async () => {
    const champion = document.getElementById('champion').value;
    const position = document.getElementById('position').value;

    // Effet de chargement
    resultContainer.classList.remove('hidden', 'victory', 'defeat');
    resultText.innerText = "⏳";
    resultMessage.innerText = "Analyse en cours...";
    resultMessage.style.color = "#cbd5e1";

    try {
        // Requête vers l'API FastAPI
        const response = await fetch("http://127.0.0.1:8000/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ champion: champion, position: position })
        });

        if (!response.ok) throw new Error("Erreur serveur");

        const data = await response.json();
        const winChance = data.win_chance;

        // Mise à jour de l'interface en fonction du résultat
        resultText.innerText = `${winChance}%`;

        if (winChance > 50) {
            resultContainer.classList.add('victory');
            resultMessage.innerText = "Matchup favorable ! Prêt pour le LP.";
        } else {
            resultContainer.classList.add('defeat');
            resultMessage.innerText = "Attention, composition statistiquement risquée.";
        }

    } catch (error) {
        resultText.innerText = "❌";
        resultMessage.innerText = "Impossible de joindre l'IA. FastAPI est-il lancé ?";
    }
});