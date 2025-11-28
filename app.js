let provider, signer, contract;
const CONTRACT_ADDR = CONTRACT_ADDRESS; // Vient de config.js

// Éléments DOM
const loader = document.getElementById('loader-overlay');
const appContent = document.getElementById('app-content');
const connectSection = document.getElementById('connect-section');
const dashboard = document.getElementById('dashboard');
const connectBtn = document.getElementById('connectBtn');
const statusMsg = document.getElementById('status-msg');
const tableBody = document.getElementById('tableBody');

// --- 1. INITIALISATION & TIMER ---
window.onload = () => {
    // Gestion du thème précédent
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeBtnText(savedTheme);

    // Timer de 2.5 secondes pour "l'effet pro"
    setTimeout(() => {
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
            appContent.classList.remove('hidden');
            checkConnection();
        }, 500);
    }, 2500);
};

// --- 2. GESTION DU THÈME ---
function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const target = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', target);
    localStorage.setItem('theme', target);
    updateThemeBtnText(target);
}

function updateThemeBtnText(theme) {
    const btn = document.querySelector('.theme-toggle');
    btn.innerText = theme === 'dark' ? '☀ Mode Jour' : '☾ Mode Nuit';
}

// --- 3. CONNEXION METAMASK ---
async function checkConnection() {
    if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            initApp();
        }
    } else {
        document.getElementById('install-alert').classList.remove('hidden');
        connectBtn.style.display = 'none';
    }
}

connectBtn.addEventListener('click', async () => {
    if (!window.ethereum) return;
    try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        // Forcer Sepolia
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (chainId !== '0xaa36a7') {
             try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0xaa36a7' }],
                });
            } catch (e) { alert("Veuillez changer le réseau vers Sepolia."); return; }
        }
        initApp();
    } catch (err) { console.error(err); }
});

async function initApp() {
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    contract = new ethers.Contract(CONTRACT_ADDR, CONTRACT_ABI, signer);

    // Transition fluide
    connectSection.classList.add('hidden');
    dashboard.classList.remove('hidden');
    loadStudents();
}

// --- 4. AJOUT ÉTUDIANT & SAUVEGARDE HASH ---
async function addStudent() {
    const fName = document.getElementById('fName').value;
    const lName = document.getElementById('lName').value;
    const dob = document.getElementById('dob').value;
    const avg = document.getElementById('avg').value;

    if (!fName || !lName || !avg) return alert("Veuillez remplir tous les champs.");

    try {
        statusMsg.innerText = "Signature de la transaction en cours...";
        statusMsg.style.color = "var(--primary)";

        const tx = await contract.addStudent(fName, lName, dob, avg);
        
        statusMsg.innerText = "Envoi à la Blockchain... Veuillez patienter.";
        
        // Attendre la confirmation
        const receipt = await tx.wait();
        
        // --- ASTUCE PRO : On récupère l'ID du nouvel étudiant ---
        // Comme on ne peut pas lire le return value d'une transaction d'écriture facilement,
        // on va recharger la liste et déduire que le dernier est le nôtre, 
        // OU simplement stocker le hash pour le "prochain ID" si on suit le compteur local.
        // Méthode simple : On stocke le hash associé à ce moment précis.
        
        // On récupère le compteur actuel pour savoir quel ID a été attribué (approx)
        // Mais pour faire simple et fiable pour ton prof : 
        // On sauvegarde le TxHash. Au rechargement, on ne saura pas quel ID = quel Hash sans Event.
        // Solution : On associe ce Hash au "Dernier étudiant ajouté" dans le localStorage.
        
        // Pour ton besoin "Click hash -> See Data", le lien Etherscan suffit.
        // On va sauvegarder : Key="tx_hash_ID_X", Value="0x123..."
        
        // Recharger pour avoir le nouvel ID
        const students = await contract.getAllStudents();
        const newId = students[students.length - 1].id.toString(); // Le dernier ID
        
        // SAUVEGARDE DANS LE NAVIGATEUR
        localStorage.setItem(`hash_student_${newId}`, tx.hash);

        statusMsg.innerText = "Succès ! Étudiant ajouté au registre.";
        statusMsg.style.color = "#10b981"; // Vert
        
        // Reset
        document.getElementById('fName').value = "";
        document.getElementById('lName').value = "";
        
        loadStudents();

    } catch (error) {
        console.error(error);
        statusMsg.innerText = "Erreur ou Annulation.";
        statusMsg.style.color = "#ef4444";
    }
}

// --- 5. CHARGEMENT ET AFFICHAGE ---
async function loadStudents() {
    tableBody.innerHTML = "";
    try {
        const students = await contract.getAllStudents();

        students.forEach(s => {
            if (s.exists) {
                // Récupérer le hash stocké localement
                const storedHash = localStorage.getItem(`hash_student_${s.id}`);
                
                // Si on a le hash, on met le lien, sinon "Archivé" (pour les anciens)
                let hashDisplay;
                if (storedHash) {
                    hashDisplay = `<a href="https://sepolia.etherscan.io/tx/${storedHash}" target="_blank" class="hash-link">
                        ${storedHash.substring(0, 6)}...${storedHash.substring(62)} ↗
                    </a>`;
                } else {
                    hashDisplay = `<span style="color:var(--text-muted); font-size:0.8rem;">Non disponible</span>`;
                }

                const row = `
                    <tr>
                        <td><b>#${s.id}</b></td>
                        <td>${s.firstName} ${s.lastName}</td>
                        <td>${s.dob}</td>
                        <td><span style="font-weight:bold; color:var(--primary);">${s.average}/20</span></td>
                        <td>${hashDisplay}</td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            }
        });
    } catch (err) { console.error("Erreur chargement", err); }
}