const GRID_SIZE = 100;
const CELL_DEGREE_SIZE = 0.004491556;
const TOTAL_ROWS = 42000;

const gridContainer = document.getElementById("grid-container");
const cellIdDisplay = document.getElementById("cell-id");
const cellXYDisplay = document.getElementById("cell-xy");
const lobbyIdDisplay = document.getElementById("lobby-id");
const dbPathDisplay = document.getElementById("db-path");
const zoomedLobby = document.getElementById("zoomed-lobby");

// Clear grid and recreate
function createGrid() {
    gridContainer.innerHTML = "";
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const cell = document.createElement("div");
            cell.classList.add("cell");
            cell.dataset.x = x;
            cell.dataset.y = y;
            gridContainer.appendChild(cell);
        }
    }
}

// function latLonToCell(lat, lon) {
//     const col = Math.floor((lon + 180) / CELL_DEGREE_SIZE);
//     // const row = Math.floor((90 - lat) / CELL_DEGREE_SIZE);
//     const EARTH_HEIGHT_METERS = 20000000;
//     const CELL_SIZE_METERS = 500;
//     const yMeters = (EARTH_HEIGHT_METERS / 2) - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * (EARTH_HEIGHT_METERS / (2 * Math.PI));
//     const row = Math.floor(yMeters / CELL_SIZE_METERS);
//     const cellId = row + col * TOTAL_ROWS;
//     return { row, col, cellId };
// }

function latLonToCell(lat, lon) {
    // MinMax99 official constants
    const EARTH_WIDTH_METERS = 40075000;
    const EARTH_HEIGHT_METERS = 20000000;
    const CELL_SIZE_METERS = 500;
    const NUM_ROWS = 42000;

    // Longitude to meters
    const xMeters = (lon + 180) * (EARTH_WIDTH_METERS / 360);
    // Latitude to meters (Mercator)
    const yMeters = (EARTH_HEIGHT_METERS / 2) -
        Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 360))) * (EARTH_HEIGHT_METERS / (2 * Math.PI));

    // To cell indices
    const col = Math.floor(xMeters / CELL_SIZE_METERS);
    const row = Math.floor(yMeters / CELL_SIZE_METERS);

    // Cell ID (column-major order)
    const cellId = col * NUM_ROWS + row;

    return { row, col, cellId };
}

function getLobbyId(row, col) {
    const lobbyRow = Math.floor(row / 20);
    const lobbyCol = Math.floor(col / 20);
    return `L-${lobbyCol}-${lobbyRow}`;
}

function highlightGrid(row, col) {
    const localX = col % GRID_SIZE;
    const localY = row % GRID_SIZE;

    // Clear all highlights
    document.querySelectorAll(".cell").forEach(cell => {
        cell.classList.remove("center", "surrounding", "lobby", "lobby-border");
    });

    // Highlight center cell
    document.querySelector(`.cell[data-x="${localX}"][data-y="${localY}"]`)
        ?.classList.add("center");

    // Surrounding 8 cells
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const x = localX + dx;
            const y = localY + dy;
            if (dx === 0 && dy === 0) continue;
            const cell = document.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
            if (cell) cell.classList.add("surrounding");
        }
    }

    // Lobby grid (3x3)
    const lobbyCol = Math.floor(col / 20);
    const lobbyRow = Math.floor(row / 20);

    for (let dRow = -1; dRow <= 1; dRow++) {
        for (let dCol = -1; dCol <= 1; dCol++) {
            const lCol = lobbyCol + dCol;
            const lRow = lobbyRow + dRow;

            const startX = (lCol * 20) % GRID_SIZE;
            const startY = (lRow * 20) % GRID_SIZE;

            const lobbyClass = `lobby-${dRow + 1}-${dCol + 1}`;

            for (let y = startY; y < startY + 20; y++) {
                for (let x = startX; x < startX + 20; x++) {
                    const cell = document.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
                    if (cell) cell.classList.add(lobbyClass);
                }
            }
        }
    }
}

function updateInfo({ cellId, row, col }) {
    const lobbyId = getLobbyId(row, col);
    cellIdDisplay.textContent = cellId;
    cellXYDisplay.textContent = `${col}, ${row}`;
    lobbyIdDisplay.textContent = lobbyId;
    dbPathDisplay.textContent = `cells/${col}/${row}`;
}

function renderZoomedLobby(centerRow, centerCol) {
    const lobbyRow = Math.floor(centerRow / 20);
    const lobbyCol = Math.floor(centerCol / 20);

    const startRow = lobbyRow * 20;
    const startCol = lobbyCol * 20;

    zoomedLobby.innerHTML = "";

    for (let y = 0; y < 20; y++) {
        for (let x = 0; x < 20; x++) {
            const row = startRow + y;
            const col = startCol + x;
            const cellId = row + col * TOTAL_ROWS;

            const div = document.createElement("div");
            div.className = "zoom-cell";
            div.textContent = cellId;
            zoomedLobby.appendChild(div);
        }
    }
}

// Setup
createGrid();

document.getElementById("use-location").addEventListener("click", () => {
    navigator.geolocation.getCurrentPosition((position) => {
        document.getElementById("latitude").value = position.coords.latitude;
        document.getElementById("longitude").value = position.coords.longitude;
    }, () => {
        alert("Unable to get location.");
    });
});

document.getElementById("submit-coords").addEventListener("click", () => {
    const lat = parseFloat(document.getElementById("latitude").value);
    const lon = parseFloat(document.getElementById("longitude").value);

    if (isNaN(lat) || isNaN(lon)) {
        alert("Please enter valid coordinates.");
        return;
    }

    const { row, col, cellId } = latLonToCell(lat, lon);
    highlightGrid(row, col);
    updateInfo({ row, col, cellId });
    renderZoomedLobby(row, col);
});
