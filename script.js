document.addEventListener("DOMContentLoaded", () => {
    const map = L.map('map').setView([53.126, 18.010], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
    }).addTo(map);

    let markers = [];
    let markerCount = 0;
    let homePoint = null;
    let homeMarker = null;
    let selectingHome = false;
    let totalPoints = 0;
    let currentUser = null;

    const redIcon = L.icon({
        iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
        iconSize: [38, 38],
    });

    const blueIcon = L.icon({
        iconUrl: "https://cdn-icons-png.flaticon.com/512/8277/8277628.png",
        iconSize: [30, 30],
    });

    // Firebase configuration
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
    const db = firebase.database();

    // -------------------------
    // LOGIN / REGISTER
    // -------------------------
    async function login() {
        let username = document.getElementById("usernameInput").value;
        let password = document.getElementById("passwordInput").value;

        if (!username || !password) {
            document.getElementById("loginMessage").textContent = "Wszystkie pola muszą być wypełnione!";
            return;
        }

        const snapshot = await db.ref('users/' + username).get();
        if (snapshot.exists()) {
            const data = snapshot.val();
            if (data.password === password) {
                alert("Zalogowano!");
                currentUser = username;
                totalPoints = data.points || 0;
                homePoint = data.homePoint || null;
                loadUserData();

                // Ukryj panel logowania, a pokaż panel z danymi
                document.getElementById("loginPanel").style.display = "none";
                document.getElementById("statsPanel").style.display = "block";
                document.getElementById("leaderboardPanel").style.display = "block";

                // Zaktualizuj leaderboard
                showLeaderboard(); 
            } else {
                document.getElementById("loginMessage").textContent = "Nieprawidłowe hasło!";
            }
        } else {
            document.getElementById("loginMessage").textContent = "Nie ma takiego użytkownika.";
        }
    }

    async function register() {
        let username = document.getElementById("usernameInput").value;
        let password = document.getElementById("passwordInput").value;

        if (!username || !password) {
            document.getElementById("loginMessage").textContent = "Wszystkie pola muszą być wypełnione!";
            return;
        }

        const snapshot = await db.ref('users/' + username).get();
        if (snapshot.exists()) {
            document.getElementById("loginMessage").textContent = "Taka nazwa już istnieje!";
            return;
        }

        await db.ref('users/' + username).set({
            password: password,
            points: 0,
            homePoint: null
        });
        alert("Konto utworzone! Zaloguj się.");
    }

    // Dodajemy event listener do przycisków logowania i rejestracji
    document.getElementById("loginBtn").addEventListener("click", login);
    document.getElementById("createAccountBtn").addEventListener("click", register);

    // -------------------------
    // ZAPIS DANYCH DO FIREBASE
    // -------------------------
    function saveUserData() {
        if (!currentUser) return;

        db.ref('users/' + currentUser).update({
            points: totalPoints,
            homePoint: homePoint
        }).catch(error => {
            console.error("Błąd zapisywania danych użytkownika:", error);
        });
    }

    // -------------------------
    // LEADERBOARD
    // -------------------------
    function showLeaderboard() {
        const leaderboardDiv = document.getElementById('leaderboard');
        leaderboardDiv.innerHTML = "<b>Leaderboard:</b><br>";

        db.ref('users').orderByChild('points').once('value')
            .then(snapshot => {
                const users = [];
                snapshot.forEach(childSnapshot => {
                    const username = childSnapshot.key;
                    const data = childSnapshot.val();
                    users.push({ username: username, points: data.points });
                });

                users.sort((a, b) => b.points - a.points);

                users.forEach(user => {
                    leaderboardDiv.innerHTML += `${user.username}: ${user.points} pkt<br>`;
                });

                leaderboardDiv.style.display = 'block';
            })
            .catch(error => {
                console.error("Błąd pobierania leaderboarda:", error);
                leaderboardDiv.innerHTML = "<b>Wystąpił błąd podczas ładowania leaderboarda.</b>";
            });
    }

    // -------------------------
    // KLIK W MAPĘ
    // -------------------------
    map.on("click", async (e) => {
        if (!currentUser) { alert("Zaloguj się!"); return; }

        if (selectingHome) {
            selectingHome = false;

            homePoint = { lat: e.latlng.lat, lon: e.latlng.lng };
            if (homeMarker) homeMarker.remove();

            homeMarker = L.marker([homePoint.lat, homePoint.lon], { icon: redIcon })
                .addTo(map)
                .bindPopup("<b>Punkt startowy</b>");

            saveUserData();
            return;
        }

        if (!homePoint) { alert("Najpierw ustaw punkt startowy!"); return; }

        const coords = [e.latlng.lat, e.latlng.lng];
        const desc = prompt("Podaj opis pinezki:") || "Brak opisu";
        const id = Date.now();

        const marker = L.marker(coords, { icon: blueIcon }).addTo(map);
        marker.bindPopup(`
            <b>${desc}</b><br><br>
            <button onclick="deleteMarker(${id})">Usuń pinezkę</button>
        `);

        markers.push({ id, coords, desc });
        markerCount++;

        const dist = distance(homePoint.lat, homePoint.lon, coords[0], coords[1]);
        const pts = Math.floor(dist * 0.1);
        totalPoints += pts;

        document.getElementById("distance").textContent = dist + " m";
        document.getElementById("points").textContent = totalPoints;

        saveUserData();
        showLeaderboard(); // Aktualizuj leaderboard po dodaniu punktu
    });

    // Funkcja usuwania pinezki
    window.deleteMarker = function(id) {
        const pin = markers.find(m => m.id === id);

        if (pin && homePoint) {
            const dist = distance(homePoint.lat, homePoint.lon, pin.coords[0], pin.coords[1]);
            const pts = Math.floor(dist * 0.1);
            totalPoints -= pts;
            if (totalPoints < 0) totalPoints = 0;
        }

        markers = markers.filter(m => m.id !== id);
        markerCount = markers.length;

        rebuildMap();
        saveUserData();

        document.getElementById("distance").textContent = "0 m";
    };

    // Funkcja odbudowująca mapę po usunięciu pinezki
    function rebuildMap() {
        map.eachLayer(layer => { if (layer instanceof L.Marker) map.removeLayer(layer); });

        if (homePoint) {
            homeMarker = L.marker([homePoint.lat, homePoint.lon], { icon: redIcon })
                .addTo(map)
                .bindPopup("<b>Punkt startowy</b>");
        }

        markers.forEach(obj => {
            const m = L.marker(obj.coords, { icon: blueIcon }).addTo(map);
            m.bindPopup(`
                <b>${obj.desc}</b><br><br>
                <button onclick="deleteMarker(${obj.id})">Usuń pinezkę</button>
            `);
        });

        document.getElementById('count').textContent = markerCount;
        document.getElementById("points").textContent = totalPoints;
    }

    // Funkcja obliczająca odległość (metry)
    function distance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Promień Ziemi w metrach
        const toRad = x => x * Math.PI / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);

        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;

        return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    }

    // -------------------------
    // RESET PUNKTÓW
    // -------------------------
    document.getElementById("resetPoints").onclick = () => {
        if (!confirm("Na pewno chcesz zresetować wszystkie punkty?")) return;

        totalPoints = 0;
        document.getElementById("points").textContent = totalPoints;
        saveUserData();
    };

    // -------------------------
    // USTAWIENIE ADRESU
    // -------------------------
    async function askForAddress() {
        const address = prompt("Podaj adres lub kod pocztowy:");

        if (!address) return;

        const result = await geocodeAddress(address);
        if (!result) { alert("Nie znaleziono lokalizacji."); return; }

        homePoint = { lat: result.lat, lon: result.lon };
        saveUserData();

        if (homeMarker) homeMarker.remove();

        homeMarker = L.marker([homePoint.lat, homePoint.lon], { icon: redIcon })
            .addTo(map)
            .bindPopup("<b>Punkt startowy</b>");

        map.setView([homePoint.lat, homePoint.lon], 15);
    }
    document.getElementById("changeAddress").onclick = askForAddress;
    document.getElementById("setHomeOnMap").onclick = () => {
        selectingHome = true;
        alert("Kliknij na mapie, aby ustawić punkt startowy.");
    };

    // -------------------------
    // GEOKODOWANIE ADRESU
    // -------------------------
    async function geocodeAddress(address) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=pl`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.length === 0) return null;

        return {
            lat: parseFloat(data[0].lat),
            lon: parseFloat(data[0].lon)
        };
    }
});
