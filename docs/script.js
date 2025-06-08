const GRID_SIZE = 100; // The display grid will be 100x100

// MinMax99 Global Constants for Cell Calculation
const EARTH_WIDTH_METERS = 40075000; // Earth's approximate circumference at the equator
const EARTH_HEIGHT_METERS = 20000000; // Approx. half circumference (pole to pole along a meridian, used for Mercator)
const CELL_SIZE_METERS = 500;
const TOTAL_ROWS = 42000; // Corresponds to NUM_ROWS in MinMax99
const NUM_COLS = Math.floor(EARTH_WIDTH_METERS / CELL_SIZE_METERS);


// Create Tooltip Element
const tooltip = document.createElement("div");
tooltip.id = "tooltip";
tooltip.style.position = "absolute";
tooltip.style.display = "none";
tooltip.style.background = "white";
tooltip.style.border = "1px solid black";
tooltip.style.padding = "5px";
tooltip.style.zIndex = "1000";
tooltip.style.pointerEvents = "none"; // Important: allows clicks to pass through to elements underneath
document.body.appendChild(tooltip);

const gridContainer = document.getElementById("grid-container");
const cellIdDisplay = document.getElementById("cell-id");
const cellXYDisplay = document.getElementById("cell-xy");
const geoCoordsDisplay = document.getElementById("geo-coords");
const lobbyIdDisplay = document.getElementById("lobby-id");
const dbPathDisplay = document.getElementById("db-path");
const zoomedLobby = document.getElementById("zoomed-lobby");
const orderSelect = document.getElementById("order-select");
const statusMessageDisplay = document.getElementById("status-message"); // Added

// Input and button elements for presets
const latitudeInput = document.getElementById("latitude");
const longitudeInput = document.getElementById("longitude");
const submitCoordsButton = document.getElementById("submit-coords");

// Leaflet integration variables
let leafletMap = null;
let leafletCellLayers = []; // To store drawn cell features for easy removal
const mapToggle = document.getElementById("map-toggle");
// const gridContainer = document.getElementById("grid-container"); // Already defined
const leafletMapContainer = document.getElementById("leaflet-map-container");
const zoomedLobbyHeader = document.getElementById("zoomed-lobby-header");


// Clear grid and recreate centered at a specific absolute cell
function createGrid(centerCol, centerRow) {
    gridContainer.innerHTML = "";
    const startCol = centerCol - Math.floor(GRID_SIZE / 2);
    const startRow = centerRow - Math.floor(GRID_SIZE / 2);

    for (let y = 0; y < GRID_SIZE; y++) { // y is for visual row in the 100x100 grid
        for (let x = 0; x < GRID_SIZE; x++) { // x is for visual col in the 100x100 grid
            const cell = document.createElement("div");
            cell.classList.add("cell");
            const currentAbsoluteCol = startCol + x;
            const currentAbsoluteRow = startRow + y;
            cell.dataset.col = currentAbsoluteCol; // Absolute MinMax99 column
            cell.dataset.row = currentAbsoluteRow; // Absolute MinMax99 row

            // Tooltip event listeners
            cell.addEventListener("mouseover", (event) => {
                const col = parseInt(cell.dataset.col);
                const row = parseInt(cell.dataset.row);

                let tooltipCellId;
                const selectedOrder = orderSelect.value;
                if (selectedOrder === "row-major") {
                    tooltipCellId = row * NUM_COLS + col;
                } else { // col-major
                    tooltipCellId = col * TOTAL_ROWS + row; // TOTAL_ROWS is NUM_ROWS
                }

                const currentLobbyId = getLobbyId(row, col); // e.g., L-1-3
                const lobbyPathId = currentLobbyId.replace('L-', '').replace('-', '_'); // e.g., 1_3
                // DB Path in tooltip should reflect the currently selected Cell ID calculation method
                const dbPath = `/lobby/${lobbyPathId}/cell_${tooltipCellId}`;

                tooltip.innerHTML = `
                    Cell ID: ${tooltipCellId}<br>
                    Col/Row: ${col}, ${row}<br>
                    Lobby: ${currentLobbyId}<br>
                    DB Path: ${dbPath}
                `;
                tooltip.style.display = "block";
            });

            cell.addEventListener("mousemove", (event) => {
                tooltip.style.left = (event.pageX + 10) + 'px';
                tooltip.style.top = (event.pageY + 10) + 'px';
            });

            cell.addEventListener("mouseout", () => {
                tooltip.style.display = "none";
            });

            gridContainer.appendChild(cell);
        }
    }
}

// MinMax99 official: meter-based cell calculation
function latLonToCell(lat, lon) {
    // EARTH_WIDTH_METERS, EARTH_HEIGHT_METERS, CELL_SIZE_METERS, TOTAL_ROWS, NUM_COLS are global

    // Longitude to meters (X)
    const xMeters = (lon + 180) * (EARTH_WIDTH_METERS / 360);
    // Latitude to meters (Y) using Mercator projection
    const yMeters = (EARTH_HEIGHT_METERS / 2) -
        Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 360))) *
        (EARTH_HEIGHT_METERS / (2 * Math.PI));

    // Calculate cell indices
    let col = Math.floor(xMeters / CELL_SIZE_METERS);
    let row = Math.floor(yMeters / CELL_SIZE_METERS);

    // Clamp col to be within [0, NUM_COLS - 1] and row to be within [0, TOTAL_ROWS - 1]
    col = Math.max(0, Math.min(col, NUM_COLS - 1));
    row = Math.max(0, Math.min(row, TOTAL_ROWS - 1));

    let cellId;
    const selectedOrder = orderSelect.value;
    if (selectedOrder === "row-major") {
        cellId = row * NUM_COLS + col;
    } else { // col-major (default)
        cellId = col * TOTAL_ROWS + row; // TOTAL_ROWS is equivalent to NUM_ROWS for MinMax99
    }

    return { row, col, cellId };
}

function showStatusMessage(message, type = "info") { // type can be 'info', 'success', 'error'
    statusMessageDisplay.textContent = message;
    statusMessageDisplay.className = ''; // Clear existing classes
    if (type === "error") {
        statusMessageDisplay.classList.add("error");
    } else if (type === "success") {
        statusMessageDisplay.classList.add("success");
    }
    // Message will persist until next message or manual clear
}

// Helper function to convert MinMax99 meter coordinates back to Lat/Lon
function metersToLatLon(xMeters, yMeters) {
    // Convert X meter to longitude
    const lon = (xMeters / (EARTH_WIDTH_METERS / 360)) - 180;

    // Convert Y meter to latitude (reversing the Mercator projection formula)
    // The term (EARTH_HEIGHT_METERS / (2 * Math.PI)) is the rMajor / (2 * PI) * (2 * PI) = rMajor factor
    // Or, more directly, it's the scaling factor used in the forward projection.
    // y = R * ln(tan(PI/4 + lat_rad/2)) -> lat_rad = 2 * (atan(exp(y/R)) - PI/4)
    // Our yMeters is measured from top-left, so it's effectively (EARTH_HEIGHT_METERS / 2) - projected_y_from_equator
    // projected_y_from_equator = (EARTH_HEIGHT_METERS / 2) - yMeters
    const projectedYFromEquator = (EARTH_HEIGHT_METERS / 2) - yMeters;
    const lat_rad = Math.atan(Math.sinh(projectedYFromEquator / (EARTH_HEIGHT_METERS / (2 * Math.PI))));
    const lat = lat_rad * (180 / Math.PI);
    return { lat, lon };
}


// Helper function to get Leaflet LatLngBounds for a given MinMax99 cell
function getCellBounds(row, col) {
    const xMinMeters = col * CELL_SIZE_METERS;
    const xMaxMeters = (col + 1) * CELL_SIZE_METERS;
    // In MinMax99's meter system, smaller yMeters are more North
    const yMinMetersNorth = row * CELL_SIZE_METERS; // Top edge of cell (North)
    const yMaxMetersSouth = (row + 1) * CELL_SIZE_METERS; // Bottom edge of cell (South)

    // South-West corner: uses yMaxMetersSouth for latitude, xMinMeters for longitude
    const sw = metersToLatLon(xMinMeters, yMaxMetersSouth);
    // North-East corner: uses yMinMetersNorth for latitude, xMaxMeters for longitude
    const ne = metersToLatLon(xMaxMeters, yMinMetersNorth);

    return L.latLngBounds([sw.lat, sw.lon], [ne.lat, ne.lon]);
}


function getLobbyId(row, col) {
    const lobbyRow = Math.floor(row / 20);
    const lobbyCol = Math.floor(col / 20);
    return `L-${lobbyCol}-${lobbyRow}`;
}

// Highlights cells based on absolute MinMax99 coordinates
function highlightGrid(targetCol, targetRow) {
    // Clear all previous highlights from all cells in the current view
    gridContainer.querySelectorAll(".cell").forEach(cell => {
        cell.classList.remove(
            "center",
            "surrounding",
            // "lobby-zone-cell", // This class will be handled differently or removed
            "surrounding-lobby-cell", // Add new class for clearing
            "lobby-border-left",
            "lobby-border-right",
            "lobby-border-top",
            "lobby-border-bottom"
        );
    });

    // Determine the lobby containing the target cell (center lobby)
    const centerLobbyCol = Math.floor(targetCol / 20);
    const centerLobbyRow = Math.floor(targetRow / 20);

    // 3x3 Lobby Zone Highlighting
    for (let lobbyYOffset = -1; lobbyYOffset <= 1; lobbyYOffset++) {
        for (let lobbyXOffset = -1; lobbyXOffset <= 1; lobbyXOffset++) {
            const currentZoneLobbyCol = centerLobbyCol + lobbyXOffset;
            const currentZoneLobbyRow = centerLobbyRow + lobbyYOffset;

            const zoneLobbyStartCol = currentZoneLobbyCol * 20;
            const zoneLobbyStartRow = currentZoneLobbyRow * 20;

            const isCenterLobbyZone = lobbyXOffset === 0 && lobbyYOffset === 0;

            for (let r = 0; r < 20; r++) { // Cells within the current lobby of the zone
                for (let c = 0; c < 20; c++) { // Cells within the current lobby of the zone
                    const absCol = zoneLobbyStartCol + c;
                    const absRow = zoneLobbyStartRow + r;

                    const cellElement = document.querySelector(`.cell[data-col="${absCol}"][data-row="${absRow}"]`);
                    if (cellElement) {
                        if (!isCenterLobbyZone) {
                            cellElement.classList.add("surrounding-lobby-cell");
                        }
                        // For the center lobby zone, specific borders are applied below.
                        // No general background like "lobby-zone-cell" needed if differentiating.
                    }
                }
            }
        }
    }

    // Current Lobby Border Highlighting (center lobby in the 3x3 zone)
    // This uses centerLobbyCol and centerLobbyRow determined above.
    // These borders will apply to the actual center lobby.
    const lobbyStartCol = centerLobbyCol * 20;
    const lobbyStartRow = centerLobbyRow * 20;

    for (let r = 0; r < 20; r++) { // r is row index within the lobby (0-19)
        for (let c = 0; c < 20; c++) { // c is col index within the lobby (0-19)
            const currentCellAbsCol = lobbyStartCol + c;
            const currentCellAbsRow = lobbyStartRow + r;

            const cellElement = document.querySelector(`.cell[data-col="${currentCellAbsCol}"][data-row="${currentCellAbsRow}"]`);

            if (cellElement) {
                if (c === 0) cellElement.classList.add("lobby-border-left");
                if (c === 19) cellElement.classList.add("lobby-border-right");
                if (r === 0) cellElement.classList.add("lobby-border-top");
                if (r === 19) cellElement.classList.add("lobby-border-bottom");
            }
        }
    }

    // Highlight the new center cell (target cell)
    const centerCell = document.querySelector(`.cell[data-col="${targetCol}"][data-row="${targetRow}"]`);
    if (centerCell) {
        centerCell.classList.add("center");
    }

    // Highlight the 8 surrounding cells
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue; // Skip the center cell itself

            const absoluteNeighborCol = targetCol + dx;
            const absoluteNeighborRow = targetRow + dy;

            const neighborCell = document.querySelector(`.cell[data-col="${absoluteNeighborCol}"][data-row="${absoluteNeighborRow}"]`);
            if (neighborCell) {
                neighborCell.classList.add("surrounding");
            }
        }
    }

}

function initOrUpdateLeafletMap(centerLat, centerLon) {
    if (!leafletMap) {
        leafletMap = L.map(leafletMapContainer).setView([centerLat, centerLon], 13); // Zoom level 13 as a start
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(leafletMap);
    } else {
        leafletMap.setView([centerLat, centerLon]);
    }
}

function drawMinMaxOnLeaflet(targetRow, targetCol, targetLat, targetLon) {
    initOrUpdateLeafletMap(targetLat, targetLon);
    leafletCellLayers.forEach(layer => layer.remove()); // Clear previous cells
    leafletCellLayers = [];

    // 1. Target cell
    const targetBounds = getCellBounds(targetRow, targetCol);
    const targetRect = L.rectangle(targetBounds, { color: "#4caf50", weight: 2, fillColor: "#4caf50", fillOpacity: 0.3 }).addTo(leafletMap);
    leafletCellLayers.push(targetRect);
    targetRect.bindTooltip(`Target Cell: ${targetCol}, ${targetRow}`);

    // 2. Surrounding 8 cells
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const R = targetRow + dr;
            const C = targetCol + dc;
            const bounds = getCellBounds(R, C);
            const rect = L.rectangle(bounds, { color: "#ADD8E6", weight: 1, fillColor: "#ADD8E6", fillOpacity: 0.2 }).addTo(leafletMap);
            leafletCellLayers.push(rect);
        }
    }

    // 3. Lobby Outline (20x20 cells for the target cell's lobby)
    const lobbyR = Math.floor(targetRow / 20);
    const lobbyC = Math.floor(targetCol / 20);
    const lobbyStartRow = lobbyR * 20;
    const lobbyStartCol = lobbyC * 20;

    // Get bounds for the entire lobby
    // SW corner of the cell at (lobbyStartRow + 19, lobbyStartCol)
    // NE corner of the cell at (lobbyStartRow, lobbyStartCol + 19)
    const lobbySW_coord = getCellBounds(lobbyStartRow + 19, lobbyStartCol).getSouthWest();
    const lobbyNE_coord = getCellBounds(lobbyStartRow, lobbyStartCol + 19).getNorthEast();
    const lobbyBoundsOverall = L.latLngBounds(lobbySW_coord, lobbyNE_coord);

    const lobbyRect = L.rectangle(lobbyBoundsOverall, { color: "red", weight: 2, fill: false }).addTo(leafletMap);
    leafletCellLayers.push(lobbyRect);

    // Zoom map to fit target cell's lobby
    if (leafletMap && lobbyRect) {
        leafletMap.fitBounds(lobbyRect.getBounds().pad(0.1)); // Pad slightly
    }
}


function updateInfo({ cellId, row, col, lat, lon }) {
    const lobbyId = getLobbyId(row, col);
    cellIdDisplay.textContent = cellId;
    cellXYDisplay.textContent = `${col}, ${row}`; // These are absolute col, row
    lobbyIdDisplay.textContent = lobbyId;

    if (lat !== undefined && lon !== undefined) {
        geoCoordsDisplay.textContent = `${parseFloat(lat).toFixed(6)}, ${parseFloat(lon).toFixed(6)}`;
    } else {
        geoCoordsDisplay.textContent = "N/A";
    }

    // Calculate LEVEL1, LEVEL2, and LEVEL3 based on cellId
    const LEVEL1 = Math.floor(cellId / 1000000);
    const LEVEL2 = Math.floor((cellId / 1000) % 1000);
    const LEVEL3 = cellId % 1000;

    // Construct the new dbPath
    const newDbPath = `${LEVEL1}/${LEVEL2}/${LEVEL3}/store_data`;
    dbPathDisplay.textContent = newDbPath;
}

function renderZoomedLobby(centerRow, centerCol) { // centerRow, centerCol are absolute
    const lobbyRow = Math.floor(centerRow / 20); // absolute lobby row index
    const lobbyCol = Math.floor(centerCol / 20); // absolute lobby col index

    const startAbsoluteRowInLobby = lobbyRow * 20;
    const startAbsoluteColInLobby = lobbyCol * 20;

    zoomedLobby.innerHTML = "";

    for (let y = 0; y < 20; y++) { // y is visual offset within the lobby
        for (let x = 0; x < 20; x++) { // x is visual offset within the lobby
            // const currentAbsoluteRow = startAbsoluteRowInLobby + y;
            const currentAbsoluteCol = startAbsoluteColInLobby + x; // This is the absolute col
            const currentAbsoluteRow = startAbsoluteRowInLobby + y; // This is the absolute row

            let zoomedCellId;
            const selectedOrder = orderSelect.value;
            if (selectedOrder === "row-major") {
                zoomedCellId = currentAbsoluteRow * NUM_COLS + currentAbsoluteCol;
            } else { // col-major
                zoomedCellId = currentAbsoluteCol * TOTAL_ROWS + currentAbsoluteRow;
            }

            const div = document.createElement("div");
            div.className = "zoom-cell"; // Base class
            div.textContent = zoomedCellId; // Displaying the calculated cell ID

            // Highlight the target cell and its neighbors
            if (currentAbsoluteCol === centerCol && currentAbsoluteRow === centerRow) {
                div.classList.add("zoomed-target-cell");
            } else if (Math.abs(currentAbsoluteCol - centerCol) <= 1 && Math.abs(currentAbsoluteRow - centerRow) <= 1) {
                div.classList.add("zoomed-neighbor-cell");
            }

            // Optionally, add data attributes for absolute row/col if needed for styling/interaction
            // div.dataset.col = currentAbsoluteCol;
            // div.dataset.row = currentAbsoluteRow;
            zoomedLobby.appendChild(div);
        }
    }
}

// Initial grid creation is removed. Grid will be created on first coordinate submission.

document.getElementById("use-location").addEventListener("click", () => {
    navigator.geolocation.getCurrentPosition((position) => {
        latitudeInput.value = position.coords.latitude;
        longitudeInput.value = position.coords.longitude;
        showStatusMessage("Location fetched: " + position.coords.latitude.toFixed(4) + ", " + position.coords.longitude.toFixed(4) + ". Click Submit.", "success");
    }, () => {
        showStatusMessage("Unable to get your location. Please check browser permissions or enter manually.", "error");
    });
});

document.getElementById("submit-coords").addEventListener("click", () => {
    const lat = parseFloat(latitudeInput.value);
    const lon = parseFloat(longitudeInput.value);

    if (isNaN(lat) || isNaN(lon)) {
        showStatusMessage("Please enter valid latitude and longitude values.", "error");
        return;
    }

    const { row, col, cellId } = latLonToCell(lat, lon); // row and col are absolute here

    if (mapToggle.checked) {
        drawMinMaxOnLeaflet(row, col, lat, lon);
        gridContainer.style.display = "none";
        leafletMapContainer.style.display = "block";
        if (leafletMap) leafletMap.invalidateSize();
        if(zoomedLobbyHeader) zoomedLobbyHeader.style.display = 'none';
        if(zoomedLobby) zoomedLobby.style.display = 'none';
    } else {
        createGrid(col, row);
        highlightGrid(col, row);
        gridContainer.style.display = "grid";
        leafletMapContainer.style.display = "none";
        if(zoomedLobbyHeader) zoomedLobbyHeader.style.display = 'block';
        if(zoomedLobby) zoomedLobby.style.display = 'grid';
    }

    // These are common regardless of view
    updateInfo({ row, col, cellId, lat, lon });
    renderZoomedLobby(row, col); // This is for the abstract view, still updates but might be hidden
    showStatusMessage("Grid and information updated for the submitted coordinates.", "success");
});

orderSelect.addEventListener("change", () => {
    const latInput = document.getElementById("latitude").value;
    const lonInput = document.getElementById("longitude").value;

    if (latInput && lonInput) { // Only if there are values to process
        const lat = parseFloat(latInput);
        const lon = parseFloat(lonInput);

        if (!isNaN(lat) && !isNaN(lon)) {
            // Recalculate cell data with new order
            const { row, col, cellId } = latLonToCell(lat, lon);
            // Update info panel (this will show new cellId and potentially new dbPath)
            updateInfo({ row, col, cellId, lat, lon });
            // Re-render zoomed lobby (Cell IDs displayed there will change)
            renderZoomedLobby(row, col);
            // Tooltips will automatically update on next mouseover due to direct reading of orderSelect.value
            // No need to call createGrid() or highlightGrid() as the visual grid display (colors, borders) doesn't change based on cell ID calculation method.
        }
    }
});

document.querySelectorAll(".preset-btn").forEach(button => {
    button.addEventListener("click", () => {
        const lat = button.dataset.lat;
        const lon = button.dataset.lon;

        latitudeInput.value = lat;
        longitudeInput.value = lon;

        // Programmatically click the main submit button
        // This ensures all existing logic (validation, grid update, info update) is triggered
        submitCoordsButton.click();
    });
});

mapToggle.addEventListener("change", function() {
    if (this.checked) {
        gridContainer.style.display = "none";
        zoomedLobbyHeader.style.display = "none";
        zoomedLobby.style.display = "none";
        leafletMapContainer.style.display = "block";
        if (leafletMap) { // If map was already initialized
            leafletMap.invalidateSize(); // Refresh map size
        }
        // If there are current coordinates, draw on map
        const lat = parseFloat(latitudeInput.value);
        const lon = parseFloat(longitudeInput.value);
        if (!isNaN(lat) && !isNaN(lon)) {
            const { row, col } = latLonToCell(lat, lon); // Recalculate row/col
            drawMinMaxOnLeaflet(row, col, lat, lon); // This will also init map if not already
        } else {
            // No valid coords, maybe init map to a default view if desired, or do nothing
            // For now, map will only appear/update if valid coords are submitted or already present
        }
    } else {
        gridContainer.style.display = "grid"; // Or its original display type e.g. "block"
        zoomedLobbyHeader.style.display = "block"; // Or its original display type
        zoomedLobby.style.display = "grid"; // Or its original display type
        leafletMapContainer.style.display = "none";
    }
});
