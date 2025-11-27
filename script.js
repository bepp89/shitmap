document.addEventListener("DOMContentLoaded", () => {
    // -------------------------
    // MAPA NA BYDGOSZCZ
    // -------------------------
    const map = L.map('map').setView([53.126, 18.010], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

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
    // GEOKODOWANIE ADRESU / KODU
    // -------------------------
    async function geocodeAddress(address) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=pl`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.length === 0) return null;
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }

    // -------------------------
    // FIREBASE
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
    function saveHomePoint() {
    if (!currentUser || !homePoint) return;

    db.ref("users/" + currentUser + "/homePoint").set({
        lat: homePoint.lat,
        lon: homePoint.lon
    });
}
function loadHomePoint() {
    if (!currentUser) return;

    db.ref("users/" + currentUser + "/homePoint").once("value", snapshot => {
        if (!snapshot.exists()) return;

        const hp = snapshot.val();
        homePoint = { lat: hp.lat, lon: hp.lon };

        if (homeMarker) homeMarker.remove();

        homeMarker = L.marker([hp.lat, hp.lon], { icon: redIcon })
            .addTo(map)
            .bindPopup("<b>Punkt startowy</b>");

        map.setView([hp.lat, hp.lon], 15);
    });
}


    function saveScore() {
        if (!currentUser) return;
        db.ref('users/' + currentUser).set({ points: totalPoints });
        updateLeaderboard();
    }

    function updateLeaderboard() {
        const leaderboardDiv = document.getElementById('leaderboard');
        leaderboardDiv.innerHTML = "";
        db.ref('users').orderByChild('points').once('value', snapshot => {
            const data = [];
            snapshot.forEach(child => {
                data.push({ user: child.key, points: child.val().points || 0 });
            });
            data.sort((a,b) => b.points - a.points);
            data.forEach(entry => {
                leaderboardDiv.innerHTML += `${entry.user}: ${entry.points} pkt<br>`;
            });
        });
    }

    // -------------------------
    // LOGOWANIE / REJESTRACJA
    // -------------------------
    const loginPanel = document.getElementById("loginPanel");
    const statsPanel = document.getElementById("statsPanel");
    const leaderboardPanel = document.getElementById("leaderboardPanel");
    const loginMessage = document.getElementById("loginMessage");

    document.getElementById("loginBtn").onclick = () => {
        const username = document.getElementById("usernameInput").value.trim();
        const password = document.getElementById("passwordInput").value.trim();
        if (!username || !password) { loginMessage.textContent = "Podaj login i hasło!"; return; }

        db.ref('users/' + username).once('value', snapshot => {
            if (snapshot.exists()) {
                const stored = snapshot.val();
                if (stored.password !== password) { loginMessage.textContent = "Nieprawidłowe hasło!"; return; }
                // zalogowano
                loginUser(username, stored.points || 0);
            } else { loginMessage.textContent = "Nie znaleziono użytkownika!"; }
        });
    };

    document.getElementById("createAccountBtn").onclick = () => {
        const username = document.getElementById("usernameInput").value.trim();
        const password = document.getElementById("passwordInput").value.trim();
        if (!username || !password) { loginMessage.textContent = "Podaj login i hasło!"; return; }

        db.ref('users/' + username).once('value', snapshot => {
            if (snapshot.exists()) { loginMessage.textContent = "Użytkownik już istnieje!"; return; }
            // utwórz konto
            db.ref('users/' + username).set({ password: password, points: 0 });
            loginUser(username, 0);
        });
    };

    function loginUser(username, points) {
        currentUser = username;
        totalPoints = points;
        loginPanel.style.display = "none";
        statsPanel.style.display = "block";
        leaderboardPanel.style.display = "block";
        document.getElementById("points").textContent = totalPoints;
        updateLeaderboard();
        loadHomePoint();
    }

    // -------------------------
    // MAPA - KLIK
    // -------------------------
    document.getElementById("setHomeOnMap").onclick = () => { selectingHome = true; alert("Kliknij na mapie, aby ustawić punkt startowy."); };
    document.getElementById("changeAddress").onclick = async () => {
        const address = prompt("Podaj adres lub kod pocztowy:");
        if (!address) return;
        const result = await geocodeAddress(address);
        if (!result) { alert("Nie znaleziono lokalizacji."); return; }
        homePoint = { lat: result.lat, lon: result.lon };
        saveHomePoint();
        if (homeMarker) homeMarker.remove();
        homeMarker = L.marker([homePoint.lat, homePoint.lon], { icon: redIcon }).addTo(map).bindPopup("<b>Punkt startowy</b>");
        map.setView([homePoint.lat, homePoint.lon], 15);
    };

    map.on("click", (e) => {
        if (!currentUser) { alert("Najpierw zaloguj się!"); return; }
        if (selectingHome) {
            selectingHome = false;
            homePoint = { lat: e.latlng.lat, lon: e.latlng.lng };
            saveHomePoint();
            if (homeMarker) homeMarker.remove();
            homeMarker = L.marker([homePoint.lat, homePoint.lon], { icon: redIcon }).addTo(map).bindPopup("<b>Punkt startowy</b>");
            return;
        }
        if (!homePoint) { alert("Najpierw ustaw punkt startowy!"); return; }

        const coords = [e.latlng.lat, e.latlng.lng];
        const desc = prompt("Podaj opis pinezki:") || "Brak opisu";
        const id = Date.now();
        L.marker(coords, { icon: blueIcon }).addTo(map).bindPopup(`<b>${desc}</b><br><br><button onclick="deleteMarker(${id})">Usuń pinezkę</button>`);

        markers.push({ id, coords, desc });
        markerCount++;
        const dist = distance(homePoint.lat, homePoint.lon, coords[0], coords[1]);
        const pts = Math.floor(dist * 0.1); // 100m=10pkt
        totalPoints += pts;

        document.getElementById("count").textContent = markerCount;
        document.getElementById("distance").textContent = dist + " m";
        document.getElementById("points").textContent = totalPoints;

        saveScore();
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
            saveScore();
        }
        markers = markers.filter(m => m.id !== id);
        markerCount = markers.length;
        rebuildMap();
        document.getElementById("distance").textContent = "0 m";
    };

    function rebuildMap() {
        map.eachLayer(layer => { if (layer instanceof L.Marker) map.removeLayer(layer); });
        if (homePoint) homeMarker = L.marker([homePoint.lat, homePoint.lon], { icon: redIcon }).addTo(map).bindPopup("<b>Punkt startowy</b>");
        markers.forEach(obj => {
            const m = L.marker(obj.coords, { icon: blueIcon }).addTo(map);
            m.bindPopup(`<b>${obj.desc}</b><br><br><button onclick="deleteMarker(${obj.id})">Usuń pinezkę</button>`);
        });
        document.getElementById('count').textContent = markerCount;
        document.getElementById("points").textContent = totalPoints;
    }

    // -------------------------
    // RESET PUNKTÓW
    // -------------------------
    document.getElementById("resetPoints").onclick = () => {
        if (!confirm("Na pewno chcesz zresetować wszystkie punkty?")) return;
        totalPoints = 0;
        document.getElementById("points").textContent = totalPoints;
        saveScore();
    };
});
