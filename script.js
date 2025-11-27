document.addEventListener("DOMContentLoaded", () => {
    // -------------------------
    // MAPA NA BYDGOSZCZ
    // -------------------------
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

    // -------------------------
    // ZAPIS / ODCZYT
    // -------------------------
    function saveAll() {
        localStorage.setItem('markers', JSON.stringify(markers));
        localStorage.setItem('markerCount', markerCount);
        localStorage.setItem('homePoint', JSON.stringify(homePoint));
        localStorage.setItem('totalPoints', totalPoints);
        document.getElementById('count').textContent = markerCount;
        document.getElementById("points").textContent = totalPoints;
    }

    function loadAll() {
        const saved = JSON.parse(localStorage.getItem('markers')) || [];
        const savedHome = JSON.parse(localStorage.getItem('homePoint'));

        if (savedHome) {
            homePoint = savedHome;
            homeMarker = L.marker([homePoint.lat, homePoint.lon], { icon: redIcon })
                .addTo(map)
                .bindPopup("<b>Punkt startowy</b>");
        }

        markerCount = saved.length;

        saved.forEach(obj => {
            const marker = L.marker(obj.coords, { icon: blueIcon }).addTo(map);
            marker.bindPopup(`
                <b>${obj.desc}</b><br><br>
                <button onclick="deleteMarker(${obj.id})">Usuń pinezkę</button>
            `);
            markers.push(obj);
        });

        document.getElementById('count').textContent = markerCount;
    }

    // -------------------------
    // FUNKCJE LOGOWANIA I REJESTRACJI
    // -------------------------
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

    async function register() {
        const username = prompt("Wybierz unikalny nick:");
        if (!username) return;

        const userRef = db.ref('users/' + username);
        userRef.get().then(snapshot => {
            if (snapshot.exists()) {
                alert("Taki użytkownik już istnieje!");
            } else {
                // Rejestracja użytkownika
                userRef.set({
                    username: username, // Zapisywanie nazwy użytkownika w bazie
                    points: 0,
                    homePoint: null
                });
                alert("Konto zostało utworzone!");
                currentUser = username;
                toggleLoginUI(false); // Ukrycie przycisków po rejestracji
            }
        });
    }

    async function login() {
        const username = prompt("Podaj swój nick:");
        if (!username) return;

        const userRef = db.ref('users/' + username);
        userRef.get().then(snapshot => {
            if (snapshot.exists()) {
                currentUser = username;
                const userData = snapshot.val();
                totalPoints = userData.points;
                homePoint = userData.homePoint;
                loadAll();
                alert("Zalogowano pomyślnie!");
                toggleLoginUI(false); // Ukrycie przycisków po zalogowaniu
                showLeaderboard();
            } else {
                alert("Brak konta o takim nicku.");
            }
        });
    }

    function saveScore() {
        if (!currentUser) return;
        const ref = db.ref('users/' + currentUser);
        ref.update({
            points: totalPoints,
            homePoint: homePoint
        });
    }

    function toggleLoginUI(isLoggedIn) {
        // Ukrywanie przycisków logowania i rejestracji
        const loginBtn = document.getElementById("loginBtn");
        const registerBtn = document.getElementById("registerBtn");
        const leaderboardBtn = document.getElementById("leaderboardBtn");
        const logoutBtn = document.getElementById("logoutBtn");
        
        if (isLoggedIn) {
            loginBtn.style.display = 'none';
            registerBtn.style.display = 'none';
            leaderboardBtn.style.display = 'block';
            logoutBtn.style.display = 'block';
        } else {
            loginBtn.style.display = 'block';
            registerBtn.style.display = 'block';
            leaderboardBtn.style.display = 'none';
            logoutBtn.style.display = 'none';
        }
    }

    function logout() {
        currentUser = null;
        totalPoints = 0;
        homePoint = null;
        saveAll();
        saveScore();
        toggleLoginUI(true); // Pokazanie przycisków logowania po wylogowaniu
        alert("Wylogowano pomyślnie!");
    }

    document.getElementById("loginBtn").onclick = login;
    document.getElementById("registerBtn").onclick = register;
    document.getElementById("logoutBtn").onclick = logout;

    // -------------------------
    // LEADERBOARD
    // -------------------------
    function showLeaderboard() {
        const leaderboardDiv = document.getElementById('leaderboard');
        leaderboardDiv.style.display = 'block';
        leaderboardDiv.innerHTML = "<b>Leaderboard:</b><br>";

        db.ref('users').orderByChild('points').limitToLast(10).once('value', snapshot => {
            const data = [];
            snapshot.forEach(child => {
                const entry = child.val();
                entry.username = child.key; // Dodajemy username z klucza
                data.push(entry);
            });
            data.sort((a, b) => b.points - a.points);
            data.forEach(entry => {
                leaderboardDiv.innerHTML += `${entry.username}: ${entry.points} pkt<br>`;
            });
        });
    }

    // -------------------------
    // FUNKCJA OBLICZANIA ODLEGŁOŚCI (metry)
    // -------------------------
    function distance(lat1, lon1, lat2, lon2) {
        const R = 6371000; 
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
    // KLIK W MAPĘ
    // -------------------------
    map.on("click", (e) => {
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
        const pts = Math.floor(dist * 0.1); // 100m = 10 pkt
        totalPoints += pts;

        document.getElementById("distance").textContent = dist + " m";
        document.getElementById("points").textContent = totalPoints;

        saveAll();
    });

    // -------------------------
    // USUWANIE PINEZKI
    // -------------------------
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
        saveAll();

        document.getElementById("distance").textContent = "0 m";
    };

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

    loadAll();  // Załadowanie zapisanych danych
});
