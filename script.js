document.addEventListener("DOMContentLoaded", () => {

    // -------------------------
    // MAPA
    // -------------------------
    const map = L.map('map').setView([53.126, 18.010], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    const redIcon = L.icon({ iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png", iconSize: [38,38] });
    const blueIcon = L.icon({ iconUrl: "https://cdn-icons-png.flaticon.com/512/8277/8277628.png", iconSize: [30,30] });

    let markers = [], markerCount = 0, homePoint = null, homeMarker = null, selectingHome = false;
    let totalPoints = 0, currentUser = null;

    // -------------------------
    // FUNKCJA ODLEGŁOŚCI
    // -------------------------
    function distance(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const toRad = x => x * Math.PI / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
        return Math.round(R*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
    }

    // -------------------------
    // GEOKODOWANIE ADRESU
    // -------------------------
    async function geocodeAddress(address) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=pl`;
        const response = await fetch(url);
        const data = await response.json();
        if(!data.length) return null;
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
    // ZAPIS / ODCZYT
    // -------------------------
    function saveAll(){
        localStorage.setItem('markers', JSON.stringify(markers));
        localStorage.setItem('markerCount', markerCount);
        localStorage.setItem('homePoint', JSON.stringify(homePoint));
        localStorage.setItem('totalPoints', totalPoints);

        document.getElementById('count').textContent = markerCount;
        document.getElementById("points").textContent = totalPoints;

        if(currentUser){
            db.ref('users/' + currentUser).update({
                points: totalPoints,
                homePoint: homePoint
            });
        }
    }

    function rebuildMap(){
        map.eachLayer(layer => { if(layer instanceof L.Marker) map.removeLayer(layer); });
        if(homePoint){
            homeMarker = L.marker([homePoint.lat, homePoint.lon], {icon:redIcon}).addTo(map).bindPopup("<b>Punkt startowy</b>");
        }
        markers.forEach(obj => {
            const m = L.marker(obj.coords, {icon:blueIcon}).addTo(map);
            m.bindPopup(`<b>${obj.desc}</b><br><br><button onclick="deleteMarker(${obj.id})">Usuń pinezkę</button>`);
        });
        document.getElementById('count').textContent = markerCount;
        document.getElementById("points").textContent = totalPoints;
    }

    // -------------------------
    // KLIK W MAPĘ
    // -------------------------
    map.on("click", (e) => {
        if(selectingHome){
            selectingHome=false;
            homePoint={lat:e.latlng.lat, lon:e.latlng.lng};
            if(homeMarker) homeMarker.remove();
            homeMarker=L.marker([homePoint.lat,homePoint.lon],{icon:redIcon}).addTo(map).bindPopup("<b>Punkt startowy</b>");
            saveAll();
            return;
        }

        if(!homePoint){ alert("Najpierw ustaw punkt startowy!"); return; }

        const coords=[e.latlng.lat,e.latlng.lng];
        const desc=prompt("Podaj opis pinezki:") || "Brak opisu";
        const id=Date.now();
        L.marker(coords,{icon:blueIcon}).addTo(map).bindPopup(`<b>${desc}</b><br><br><button onclick="deleteMarker(${id})">Usuń pinezkę</button>`);
        markers.push({id,coords,desc}); markerCount++;

        const dist = distance(homePoint.lat,homePoint.lon,coords[0],coords[1]);
        const pts = Math.floor(dist*0.1); // 100m=10pkt
        totalPoints += pts;

        document.getElementById("distance").textContent=dist+" m";
        document.getElementById("points").textContent=totalPoints;
        saveAll();
    });

    window.deleteMarker=function(id){
        const pin = markers.find(m=>m.id===id);
        if(pin && homePoint){
            const dist = distance(homePoint.lat,homePoint.lon,pin.coords[0],pin.coords[1]);
            const pts = Math.floor(dist*0.1);
            totalPoints -= pts;
            if(totalPoints<0) totalPoints=0;
        }
        markers=markers.filter(m=>m.id!==id);
        markerCount=markers.length;
        rebuildMap();
        saveAll();
        document.getElementById("distance").textContent="0 m";
    };

    // -------------------------
    // RESET PUNKTÓW
    // -------------------------
    document.getElementById("resetPoints").onclick=()=>{
        if(!confirm("Na pewno chcesz zresetować wszystkie punkty?")) return;
        totalPoints=0;
        saveAll();
    };

    // -------------------------
    // ADRES / PUNKT DOMU
    // -------------------------
    document.getElementById("changeAddress").onclick=async()=>{
        const address=prompt("Podaj adres lub kod pocztowy:");
        if(!address) return;
        const res = await geocodeAddress(address);
        if(!res){ alert("Nie znaleziono lokalizacji."); return; }
        homePoint={lat:res.lat,lon:res.lon};
        if(homeMarker) homeMarker.remove();
        homeMarker=L.marker([homePoint.lat,homePoint.lon],{icon:redIcon}).addTo(map).bindPopup("<b>Punkt startowy</b>");
        map.setView([homePoint.lat,homePoint.lon],15);
        saveAll();
    };

    document.getElementById("setHomeOnMap").onclick=()=>{ selectingHome=true; alert("Kliknij na mapie aby ustawić punkt startowy"); };

    // -------------------------
    // LOGOWANIE / REJESTRACJA
    // -------------------------
    document.getElementById("createAccountBtn").onclick=()=>{
        const username=document.getElementById("usernameInput").value.trim();
        const password=document.getElementById("passwordInput").value.trim();
        const msgDiv=document.getElementById("loginMessage");
        if(!username||!password){ msgDiv.textContent="Wypełnij wszystkie pola!"; return; }
        const userRef=db.ref('users/'+username);
        userRef.get().then(snap=>{
            if(snap.exists()){ msgDiv.textContent="Użytkownik już istnieje!"; }
            else{
                userRef.set({ password, points:0, homePoint:null }).then(()=>{ msgDiv.style.color="green"; msgDiv.textContent="Konto utworzone! Możesz się zalogować."; });
            }
        });
    };

    document.getElementById("loginBtn").onclick=()=>{
        const username=document.getElementById("usernameInput").value.trim();
        const password=document.getElementById("passwordInput").value.trim();
        const msgDiv=document.getElementById("loginMessage");
        if(!username||!password){ msgDiv.textContent="Wypełnij wszystkie pola!"; return; }
        const userRef=db.ref('users/'+username);
        userRef.get().then(snap=>{
            if(!snap.exists()){ msgDiv.textContent="Użytkownik nie istnieje!"; }
            else{
                const data=snap.val();
                if(data.password!==password){ msgDiv.textContent="Błędne hasło!"; }
                else{
                    currentUser=username;
                    msgDiv.textContent="";
                    document.getElementById("loginPanel").style.display="none";
                    document.getElementById("statsPanel").style.display="block";
                    document.getElementById("leaderboardPanel").style.display="block";
                    totalPoints=data.points||0;
                    document.getElementById("points").textContent=totalPoints;
                    if(data.homePoint){
                        homePoint=data.homePoint;
                        if(homeMarker) homeMarker.remove();
                        homeMarker=L.marker([homePoint.lat,homePoint.lon],{icon:redIcon}).addTo(map).bindPopup("<b>Punkt startowy</b>");
                        map.setView([homePoint.lat,homePoint.lon],15);
                    }
                    saveAll();
                    showLeaderboard();
                }
            }
        });
    };

    // -------------------------
    // LEADERBOARD
    // -------------------------
    function showLeaderboard(){
        const leaderboardDiv=document.getElementById('leaderboard');
        leaderboardDiv.innerHTML="";
        db.ref('users').orderByChild('points').limitToLast(10).get().then(snapshot=>{
            const arr=[];
            snapshot.forEach(child=>{ arr.push(child.val()); });
            arr.sort((a,b)=>b.points-a.points);
            arr.forEach(user=>{ leaderboardDiv.innerHTML += `${user.user||'Anonim'}: ${user.points} pkt<br>`; });
        });
    }

});
