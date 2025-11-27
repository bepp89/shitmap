document.addEventListener("DOMContentLoaded", () => {

    // ------------------- LOGOWANIE -------------------
    let currentUser = localStorage.getItem("currentUser") || null;
    let totalPoints = 0;

    function login() {
        const nick = prompt("Podaj swój nick:");
        if (!nick) return;
        currentUser = nick;
        localStorage.setItem("currentUser", currentUser);
        alert("Zalogowano jako: " + currentUser);

        if (localStorage.getItem("points_" + currentUser) === null) {
            localStorage.setItem("points_" + currentUser, "0");
        }

        totalPoints = Number(localStorage.getItem("points_" + currentUser));
        document.getElementById("points").textContent = totalPoints;
    }

    function savePoints() {
        if(currentUser) localStorage.setItem("points_" + currentUser, totalPoints);
    }

    function showLeaderboard() {
        let table = "Leaderboard:\n\n";
        for (let key in localStorage) {
            if(key.startsWith("points_")) {
                const user = key.replace("points_", "");
                const pts = localStorage.getItem(key);
                table += user + ": " + pts + " pkt\n";
            }
        }
        alert(table);
    }

    document.getElementById("loginBtn").onclick = login;
    document.getElementById("leaderboardBtn").onclick = showLeaderboard;

    // ------------------- MAPA -------------------
    const map = L.map('map').setView([53.126, 18.010], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19 }).addTo(map);

    let markers = [];
    let markerCount = 0;
    let homePoint = null;
    let homeMarker = null;
    let selectingHome = false;

    const redIcon = L.icon({
        iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
        iconSize: [38,38]
    });

    const blueIcon = L.icon({
        iconUrl: "https://cdn-icons-png.flaticon.com/512/8277/8277628.png",
        iconSize: [30,30]
    });

    // ------------------- FUNKCJA ODLEGŁOŚCI -------------------
    function distance(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const toRad = x => x * Math.PI / 180;
        const dLat = toRad(lat2-lat1);
        const dLon = toRad(lon2-lon1);
        const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
        return Math.round(R*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
    }

    // ------------------- GEOKODOWANIE ADRESU / KODU -------------------
    async function geocodeAddress(address) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=pl`;
        const response = await fetch(url);
        const data = await response.json();
        if(data.length === 0) return null;
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }

    async function askForAddress() {
        const address = prompt("Podaj adres lub kod pocztowy:");
        if(!address) return;
        const result = await geocodeAddress(address);
        if(!result){ alert("Nie znaleziono lokalizacji."); return; }

        homePoint = { lat: result.lat, lon: result.lon };
        saveAll();

        if(homeMarker) homeMarker.remove();
        homeMarker = L.marker([homePoint.lat, homePoint.lon], { icon:redIcon }).addTo(map).bindPopup("<b>Punkt startowy</b>");
        map.setView([homePoint.lat, homePoint.lon], 15);
    }

    document.getElementById("changeAddress").onclick = askForAddress;

    document.getElementById("setHomeOnMap").onclick = () => {
        selectingHome = true;
        alert("Kliknij na mapie, aby ustawić punkt startowy.");
    };

    // ------------------- KLIK NA MAPIE -------------------
    map.on("click", (e)=>{
        if(selectingHome){
            selectingHome=false;
            homePoint = { lat:e.latlng.lat, lon:e.latlng.lng };
            if(homeMarker) homeMarker.remove();
            homeMarker = L.marker([homePoint.lat, homePoint.lon], { icon:redIcon }).addTo(map).bindPopup("<b>Punkt startowy</b>");
            saveAll();
            return;
        }
        if(!homePoint){ alert("Najpierw ustaw punkt startowy!"); return; }
        if(!currentUser){ alert("Najpierw zaloguj się!"); return; }

        const coords = [e.latlng.lat, e.latlng.lng];
        const desc = prompt("Podaj opis pinezki:") || "Brak opisu";
        const id = Date.now();

        const marker = L.marker(coords, { icon:blueIcon }).addTo(map);
        marker.bindPopup(`<b>${desc}</b><br><br><button onclick="deleteMarker(${id})">Usuń pinezkę</button>`);

        markers.push({ id, coords, desc });
        markerCount++;

        const dist = distance(homePoint.lat, homePoint.lon, coords[0], coords[1]);
        const pts = Math.floor(dist*0.1); // 100m=10 pkt
        totalPoints += pts;
        savePoints();

        document.getElementById("distance").textContent = dist + " m";
        document.getElementById("points").textContent = totalPoints;

        saveAll();
    });

    // ------------------- USUWANIE PINEZKI -------------------
    window.deleteMarker = function(id){
        const pin = markers.find(m=>m.id===id);
        if(pin && homePoint){
            const dist = distance(homePoint.lat, homePoint.lon, pin.coords[0], pin.coords[1]);
            const pts = Math.floor(dist*0.1);
            totalPoints -= pts;
            if(totalPoints<0) totalPoints=0;
            savePoints();
        }
        markers = markers.filter(m=>m.id!==id);
        markerCount = markers.length;
        rebuildMap();
        saveAll();
        document.getElementById("distance").textContent = "0 m";
    };

    function rebuildMap(){
        map.eachLayer(layer=>{ if(layer instanceof L.Marker) map.removeLayer(layer); });
        if(homePoint) homeMarker=L.marker([homePoint.lat, homePoint.lon],{icon:redIcon}).addTo(map).bindPopup("<b>Punkt startowy</b>");
        markers.forEach(obj=>{
            const m = L.marker(obj.coords,{icon:blueIcon}).addTo(map);
            m.bindPopup(`<b>${obj.desc}</b><br><br><button onclick="deleteMarker(${obj.id})">Usuń pinezkę</button>`);
        });
        document.getElementById('count').textContent = markerCount;
        document.getElementById("points").textContent = totalPoints;
    }

    // ------------------- RESET PUNKTÓW -------------------
    document.getElementById("resetPoints").onclick = () => {
        if(!currentUser){ alert("Zaloguj się najpierw!"); return; }
        if(confirm("Na pewno chcesz zresetować wszystkie punkty?")){
            totalPoints=0;
            savePoints();
            document.getElementById("points").textContent = totalPoints;
        }
    };

    // ------------------- ZAPIS / ODCZYT -------------------
    function saveAll(){
        localStorage.setItem('markers', JSON.stringify(markers));
        localStorage.setItem('markerCount', markerCount);
        localStorage.setItem('homePoint', JSON.stringify(homePoint));
        savePoints();
        document.getElementById('count').textContent = markerCount;
        document.getElementById("points").textContent = totalPoints;
    }

    function loadAll(){
        const saved = JSON.parse(localStorage.getItem('markers')) || [];
        const savedHome = JSON.parse(localStorage.getItem('homePoint'));
        if(savedHome){
            homePoint=savedHome;
            homeMarker = L.marker([homePoint.lat,homePoint.lon],{icon:redIcon}).addTo(map).bindPopup("<b>Punkt startowy</b>");
        }
        markerCount = saved.length;
        saved.forEach(obj=>{
            const marker = L.marker(obj.coords,{icon:blueIcon}).addTo(map);
            marker.bindPopup(`<b>${obj.desc}</b><br><br><button onclick="deleteMarker(${obj.id})">Usuń pinezkę</button>`);
            markers.push(obj);
        });

        document.getElementById('count').textContent = markerCount;

        if(currentUser){
            totalPoints=Number(localStorage.getItem("points_"+currentUser))||0;
            document.getElementById("points").textContent = totalPoints;
        }
    }

    loadAll();
});
