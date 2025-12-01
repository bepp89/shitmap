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
    let storedPassword = null;

    const redIcon = L.icon({
        iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
        iconSize: [38, 38],
    });
    const blueIcon = L.icon({
        iconUrl: "https://cdn-icons-png.flaticon.com/512/8277/8277628.png",
        iconSize: [30, 30],
    });

    // -------------------------
    // FUNKCJA OBLICZANIA ODLEGŁOŚCI
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
    // GEOKODOWANIE
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

    // -------------------------
    // ZAPIS / ODCZYT HOMEPOINT
    // -------------------------
    function saveHomePoint() {
        if (!currentUser || !homePoint) return;
        db.ref("users/" + currentUser).update({
            homePoint: homePoint
        });
    }
// Zapis pinezki do Firebase
function savePin(id, coords, desc) {
    if (!currentUser) return;
    db.ref("users/" + currentUser + "/pins/" + id).set({
        id: id,
        lat: coords[0],
        lng: coords[1],
        desc: desc
    });
}

// Usuwanie pinezki z Firebase
function deletePinFromDB(id) {
    if (!currentUser) return;
    db.ref("users/" + currentUser + "/pins/" + id).remove();
}

// Wczytanie wszystkich pinezek użytkownika
function loadPins() {
    if (!currentUser) return;

    db.ref("users/" + currentUser + "/pins").once("value", snapshot => {
        markers = [];
        markerCount = 0;

        snapshot.forEach(child => {
            const p = child.val();
            markers.push({
                id: p.id,
                coords: [p.lat, p.lng],
                desc: p.desc
            });
            markerCount++;
        });

        rebuildMap();
    });
}

    function loadHomePoint() {
        if (!currentUser) return;
        db.ref("users/" + currentUser + "/homePoint").once("value", snap => {
            if (!snap.exists()) return;

            homePoint = snap.val();

            if (homeMarker) homeMarker.remove();
            homeMarker = L.marker([homePoint.lat, homePoint.lon], { icon: redIcon })
                .addTo(map)
                .bindPopup("<b>Punkt startowy</b>");

            map.setView([homePoint.lat, homePoint.lon], 15);
        });
    }

    // -------------------------
    // ZAPIS PINEZEK DO FIREBASE
    // -------------------------
    function savePin(id, coords, desc) {
        if (!currentUser) return;

        db.ref("users/" + currentUser + "/pins/" + id).set({
            id: id,
            lat: coords[0],
            lng: coords[1],
            desc: desc
        });
    }

    // -------------------------
    // USUWANIE pinezek z Firebase
    // -------------------------
    function removePin(id) {
        if (!currentUser) return;
        db.ref("users/" + currentUser + "/pins/" + id).remove();
    }

    // -------------------------
    // WCZYTANIE pinezek użytkownika
    // -------------------------
    function loadPins() {
        if (!currentUser) return;

        db.ref("users/" + currentUser + "/pins").once("value", snap => {
            if (!snap.exists()) return;

            markers = [];
            markerCount = 0;

            snap.forEach(child => {
                const p = child.val();

                markers.push({
                    id: p.id,
                    coords: [p.lat, p.lng],
                    desc: p.desc
                });

                markerCount++;
            });

            rebuildMap();
        });
    }

    // -------------------------
    // ZAPIS PUNKTÓW
    // -------------------------
    function saveScore() {
        if (!currentUser) return;
        db.ref('users/' + currentUser).update({ points: totalPoints });
        updateLeaderboard();
    }
function updateLeaderboard() {
    const div = document.getElementById("leaderboard");
    div.innerHTML = "";

    db.ref('users').once("value", snap => {
        const arr = [];

        snap.forEach(c => {
            const val = c.val();
            arr.push({
                user: c.key,
                points: val.points !== undefined ? val.points : 0
            });
        });

        arr.sort((a, b) => b.points - a.points);

        arr.forEach(e => {
            div.innerHTML += `${e.user}: ${e.points} pkt<br>`;
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
        const user = usernameInput.value.trim();
        const pass = passwordInput.value.trim();
        if (!user || !pass) return loginMessage.textContent = "Podaj dane!";

        db.ref("users/" + user).once("value", snap => {
            if (!snap.exists()) return loginMessage.textContent = "Nie ma takiego użytkownika!";

            if (snap.val().password !== pass) return loginMessage.textContent = "Złe hasło!";

            loginUser(user, snap.val().points || 0);
        });
    };

    document.getElementById("createAccountBtn").onclick = () => {
        const user = usernameInput.value.trim();
        const pass = passwordInput.value.trim();
        if (!user || !pass) return loginMessage.textContent = "Podaj dane!";

        db.ref("users/" + user).once("value", snap => {
            if (snap.exists()) return loginMessage.textContent = "Użytkownik istnieje!";

            db.ref("users/" + user).set({ password: pass, points: 0 });
            loginUser(user, 0);
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
    loadPins();     // ⬅️ WAŻNE! Pinezki ładują się tutaj
}


    // -------------------------
    // KLIK NA MAPIE
    // -------------------------
    document.getElementById("setHomeOnMap").onclick = () => {
        selectingHome = true;
        alert("Kliknij na mapie, aby ustawić punkt startowy.");
    };

    document.getElementById("changeAddress").onclick = async () => {
        const address = prompt("Podaj adres:");
        if (!address) return;

        const result = await geocodeAddress(address);
        if (!result) return alert("Nie znaleziono!");

        homePoint = { lat: result.lat, lon: result.lon };
        saveHomePoint();

        if (homeMarker) homeMarker.remove();
        homeMarker = L.marker([homePoint.lat, homePoint.lon], { icon: redIcon }).addTo(map);
    };

    map.on("click", e => {
        if (!currentUser) return alert("Najpierw zaloguj się!");
        if (selectingHome) {
            selectingHome = false;
            homePoint = { lat: e.latlng.lat, lon: e.latlng.lng };
            saveHomePoint();

            if (homeMarker) homeMarker.remove();
            homeMarker = L.marker([homePoint.lat, homePoint.lon], { icon: redIcon }).addTo(map);
            return;
        }
        if (!homePoint) return alert("Najpierw ustaw punkt startowy!");

        const coords = [e.latlng.lat, e.latlng.lng];
        const desc = prompt("Opis:") || "Brak opisu";
        const id = Date.now();

        markers.push({ id, coords, desc });
        markerCount++;
        savePin(id, coords, desc);

        savePin(id, coords, desc);

        const dist = distance(homePoint.lat, homePoint.lon, coords[0], coords[1]);
        const pts = Math.floor(dist * 0.1);
        totalPoints += pts;

        document.getElementById("count").textContent = markerCount;
        document.getElementById("distance").textContent = dist + " m";
        document.getElementById("points").textContent = totalPoints;

        saveScore();
        rebuildMap();
    });

    // -------------------------
    // USUWANIE PINEZKI
    // -------------------------
    window.deleteMarker = id => {
        const pin = markers.find(m => m.id === id);
        if (pin && homePoint) {
            const dist = distance(homePoint.lat, homePoint.lon, pin.coords[0], pin.coords[1]);
            const pts = Math.floor(dist * 0.1);
            totalPoints = Math.max(0, totalPoints - pts);
            saveScore();
        }

        markers = markers.filter(m => m.id !== id);
        markerCount = markers.length;

        removePin(id);
        deletePinFromDB(id);
        rebuildMap();
    };

    // -------------------------
    // ODBUDOWA MAPY
    // -------------------------
    function rebuildMap() {
        map.eachLayer(l => { if (l instanceof L.Marker) map.removeLayer(l); });

        if (homePoint)
            homeMarker = L.marker([homePoint.lat, homePoint.lon], { icon: redIcon })
                .addTo(map)
                .bindPopup("<b>Punkt startowy</b>");

        markers.forEach(obj => {
            const m = L.marker(obj.coords, { icon: blueIcon }).addTo(map);
            m.bindPopup(`<b>${obj.desc}</b><br><br>
                <button onclick="deleteMarker(${obj.id})">Usuń pinezkę</button>`);
        });

        document.getElementById("count").textContent = markerCount;
        document.getElementById("points").textContent = totalPoints;
    }

    // -------------------------
    // RESET PUNKTÓW
    // -------------------------
    resetPoints.onclick = () => {
        if (!confirm("Na pewno?")) return;
        totalPoints = 0;
        points.textContent = 0;
        saveScore();
    };
});


