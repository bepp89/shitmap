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
    // FIREBASE CONFIG
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
                document.getElementById("loginPanel").style.display = "none";
                document.getElementById("statsPanel").style.display = "block";
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

    // Obsługuje kliknięcia przycisków
    document.getElementById("loginBtn").addEventListener("click", login);
    document.getElementById("createAccountBtn").addEventListener("click", register);

    // -------------------------
    // LOAD USER DATA
    // -------------------------
    function loadUserData() {
        document.getElementById("points").textContent = totalPoints;
        if (homePoint) {
            homeMarker = L.marker([homePoint.lat, homePoint.lon], { icon: redIcon })
                .addTo(map)
                .bindPopup("<b>Punkt startowy</b>");
            map.setView([homePoint.lat, homePoint.lon], 15);
        }
    }

    // -------------------------
    // SAVE USER DATA
    // -------------------------
    function saveUserData() {
        if (!currentUser) return;
        db.ref('users/' + currentUser).update({
            points: totalPoints,
            homePoint: homePoint
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

            saveAll();
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

        saveAll();
        showLeaderboard(); // aktualizujemy leaderboard
    });

    // -------------------------
    // LEADERBOARD
    // -------------------------
    function showLeaderboard() {
        const leaderboardDiv = document.getElementById('leaderboard');
        leaderboardDiv.style.display = 'block';
        leaderboardDiv.innerHTML = "<b>Leaderboard:</b><br>";

        db.ref('users').get().then(snapshot => {
            const arr = [];
            snapshot.forEach(child => {
                const data = child.val();
                arr.push({ username: child.key, points: data.points || 0 });
            });

            arr.sort((a,b) => b.points - a.points);
            arr.forEach(user => {
                leaderboardDiv.innerHTML += `${user.username}: ${user.points} pkt<br>`;
            });
        }).catch(err => {
            console.error("Błąd pobierania leaderboarda:", err);
            leaderboardDiv.innerHTML = "<b>Wystąpił błąd podczas ładowania leaderboarda.</b>";
        });
    }

    showLeaderboard(); // pokazujemy leaderboard od razu po wejściu

    // -------------------------
    // USTAWIENIE ADRESU / KODU
    // -------------------------
    async function askForAddress() {
        const address = prompt("Podaj adres lub kod pocztowy:");

        if (!address) return;

        const result = await geocodeAddress(address);
        if (!result) { alert("Nie znaleziono lokalizacji."); return; }

        homePoint = { lat: result.lat, lon: result.lon };
        saveAll();

        if (homeMarker) homeMarker.remove();

        homeMarker = L.marker([homePoint.lat, homePoint.lon], { icon: redIcon })
            .addTo(map)
            .bindPopup("<b>Punkt startowy</b>");

        map.setView([homePoint.lat, homePoint.lon], 15);
    }

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

    document.getElementById("changeAddress").onclick = askForAddress;
    document.getElementById("setHomeOnMap").onclick = () => {
        selectingHome = true;
        alert("Kliknij na mapie, aby ustawić punkt startowy.");
    };

});
