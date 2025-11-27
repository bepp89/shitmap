document.addEventListener("DOMContentLoaded", () => {
    // Konfiguracja Firebase
    const firebaseConfig = {
        apiKey: "AIzaSyCFuKV9PLYejoUY8LZuX0ng22c_sQiidQw",
        authDomain: "shitmap-bda58.firebaseapp.com",
        databaseURL: "https://shitmap-bda58-default-rtdb.firebaseio.com",
        projectId: "shitmap-bda58",
        storageBucket: "shitmap-bda58.firebasestorage.app",
        messagingSenderId: "845888799744",
        appId: "1:845888799744:web:9b32c6c6dc99224e5604e5",
        measurementId: "G-H0M7FEWJZZ"
    };

    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.database();

    let user = null;
    let markers = [];
    let markerCount = 0;
    let homePoint = null;
    let homeMarker = null;
    let totalPoints = 0;

    // Inicjalizacja mapy
    const map = L.map('map').setView([53.126, 18.010], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    // Funkcja zapisu danych użytkownika do Firebase
    function saveUserData(user) {
        const userRef = db.ref('users/' + user.uid);
        userRef.set({
            points: totalPoints,
            homePoint: homePoint,
            markers: markers
        });
    }

    // Funkcja ładowania danych użytkownika z Firebase
    function loadUserData(user) {
        const userRef = db.ref('users/' + user.uid);
        userRef.once('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                totalPoints = data.points || 0;
                homePoint = data.homePoint || null;
                markers = data.markers || [];
                updateUI();
            }
        });
    }

    // Funkcja do aktualizacji interfejsu po zalogowaniu
    function updateUI() {
        if (user) {
            document.getElementById("authPanel").style.display = 'none';  // Ukrycie panelu logowania
            document.getElementById("leaderboardBtn").style.display = 'block';  // Pokazanie leaderboard
            document.getElementById("points").textContent = totalPoints;  // Wyświetlenie punktów
        }
    }

    // Funkcja wylogowywania użytkownika
    function signOutUser() {
        auth.signOut().then(() => {
            user = null;
            document.getElementById("authPanel").style.display = 'block';  // Pokazanie panelu logowania
            document.getElementById("leaderboardBtn").style.display = 'none';  // Ukrycie leaderboard
            document.getElementById("points").textContent = "0";  // Resetowanie punktów
        });
    }

    // Funkcja do obsługi kliknięcia na mapę
    map.on("click", (e) => {
        if (!user) return alert("Musisz być zalogowany, aby dodać pinezkę!");

        const coords = [e.latlng.lat, e.latlng.lng];
        const desc = prompt("Podaj opis pinezki:") || "Brak opisu";
        const id = Date.now();

        const marker = L.marker(coords).addTo(map);
        marker.bindPopup(`
            <b>${desc}</b><br><br>
            <button onclick="deleteMarker(${id})">Usuń pinezkę</button>
        `);

        markers.push({ id, coords, desc });
        markerCount++;

        // Zapisanie pinezki w Firebase
        saveUserData(user);
    });

    // Funkcja usuwania pinezki
    window.deleteMarker = function(id) {
        markers = markers.filter(m => m.id !== id);
        markerCount = markers.length;

        saveUserData(user);  // Zapisanie zmian w Firebase
        rebuildMap();  // Odtworzenie mapy
    };

    function rebuildMap() {
        map.eachLayer(layer => { if (layer instanceof L.Marker) map.removeLayer(layer); });
        markers.forEach(obj => {
            const m = L.marker(obj.coords).addTo(map);
            m.bindPopup(`
                <b>${obj.desc}</b><br><br>
                <button onclick="deleteMarker(${obj.id})">Usuń pinezkę</button>
            `);
        });
    }

    // Funkcje logowania i tworzenia konta
    document.getElementById("loginBtn").onclick = () => {
        const email = prompt("Podaj swój email:");
        const password = prompt("Podaj swoje hasło:");

        auth.signInWithEmailAndPassword(email, password).then((userCredential) => {
            user = userCredential.user;
            loadUserData(user);
            updateUI();
        }).catch((error) => {
            alert("Błąd logowania: " + error.message);
        });
    };

    document.getElementById("createAccountBtn").onclick = () => {
        const email = prompt("Podaj swój email:");
        const password = prompt("Podaj swoje hasło:");

        auth.createUserWithEmailAndPassword(email, password).then((userCredential) => {
            user = userCredential.user;
            saveUserData(user);  // Zapisz dane nowego użytkownika
            updateUI();
        }).catch((error) => {
            alert("Błąd tworzenia konta: " + error.message);
        });
    };

    // Funkcja do wyświetlania leaderboardu
    document.getElementById("leaderboardBtn").onclick = () => {
        const leaderboardDiv = document.getElementById('leaderboard');
        leaderboardDiv.style.display = 'block';
        leaderboardDiv.innerHTML = "<b>Leaderboard:</b><br>";

        db.ref('users').orderByChild('points').limitToLast(10).once('value', snapshot => {
            const data = [];
            snapshot.forEach(child => {
                data.push(child.val());
            });

            data.sort((a, b) => b.points - a.points);
            data.forEach(entry => {
                leaderboardDiv.innerHTML += `${entry.email || "Anonim"}: ${entry.points} pkt<br>`;
            });
        });
    };

    // Funkcja resetowania punktów
    document.getElementById("resetPoints").onclick = () => {
        if (!confirm("Na pewno chcesz zresetować wszystkie punkty?")) return;
        totalPoints = 0;
        saveUserData(user);  // Zapisz zmiany w Firebase
        document.getElementById("points").textContent = totalPoints;
    };

    // Załaduj dane użytkownika, jeśli jest zalogowany
    if (auth.currentUser) {
        user = auth.currentUser;
        loadUserData(user);
        updateUI();
    }
});
