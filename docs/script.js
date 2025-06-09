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
const loadingSpinner = document.getElementById("loading-spinner"); // New line

// Input and button elements for presets
const latitudeInput = document.getElementById("latitude");
const longitudeInput = document.getElementById("longitude");
const submitCoordsButton = document.getElementById("submit-coords");
const cellIdInput = document.getElementById("cell-id-input"); // Added
const submitCellIdButton = document.getElementById("submit-cell-id"); // Added
const lobbyZoneToggle = document.getElementById("toggle-lobby-zone-highlight"); // Added
const neighborToggle = document.getElementById("toggle-neighbor-highlight"); // Added
const visibleLobbiesListDisplay = document.getElementById("visible-lobbies-list"); // Added


// Leaflet integration variables
let leafletMap = null;
let leafletCellLayers = []; // To store drawn cell features for easy removal
const mapToggle = document.getElementById("map-toggle");
// const gridContainer = document.getElementById("grid-container"); // Already defined
const leafletMapContainer = document.getElementById("leaflet-map-container");
const zoomedLobbyHeader = document.getElementById("zoomed-lobby-header");

// Global states for highlight toggles
let showLobbyZoneHighlight = lobbyZoneToggle.checked;
let showNeighborHighlight = neighborToggle.checked;

// Global store for last target cell for highlight refreshes
let lastTargetCol = null;
let lastTargetRow = null;

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

    // Display Lobby IDs
    const centerLobbyCol = Math.floor(centerCol / 20);
    const centerLobbyRow = Math.floor(centerRow / 20);

    for (let lobbyYOffset = -1; lobbyYOffset <= 1; lobbyYOffset++) {
        for (let lobbyXOffset = -1; lobbyXOffset <= 1; lobbyXOffset++) {
            const currentDisplayLobbyCol = centerLobbyCol + lobbyXOffset;
            const currentDisplayLobbyRow = centerLobbyRow + lobbyYOffset;
            const lobbyIdString = `L-${currentDisplayLobbyCol}-${currentDisplayLobbyRow}`;

            // Determine the top-left cell of this lobby
            // These are absolute MinMax99 cell coordinates
            const lobbyTopLeftCol = currentDisplayLobbyCol * 20;
            const lobbyTopLeftRow = currentDisplayLobbyRow * 20;

            // Find the cell element that corresponds to the top-left of this lobby, if it's visible
            const cellElement = document.querySelector(`.cell[data-col="${lobbyTopLeftCol}"][data-row="${lobbyTopLeftRow}"]`);

            if (cellElement) {
                const lobbyIdDiv = document.createElement("div");
                lobbyIdDiv.classList.add("lobby-id-overlay");
                lobbyIdDiv.textContent = lobbyIdString;
                cellElement.appendChild(lobbyIdDiv);
            }
        }
    }
}

// Function to convert Cell ID to absolute coordinates
function cellIdToCoordinates(cellId, order) {
    let row, col;
    if (order === "col-major") {
        col = Math.floor(cellId / TOTAL_ROWS);
        row = cellId % TOTAL_ROWS;
    } else { // row-major
        row = Math.floor(cellId / NUM_COLS);
        col = cellId % NUM_COLS;
    }
    return { row, col };
}

// Function to convert absolute cell coordinates to Lat/Lon (center of cell)
function absoluteCellToLatLon(col, row) {
    const xMeters = (col + 0.5) * CELL_SIZE_METERS;
    const yMeters = (row + 0.5) * CELL_SIZE_METERS;
    return metersToLatLon(xMeters, yMeters); // metersToLatLon is already defined
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

    return { lat, lon, xMeters, yMeters, row, col, cellId, order: selectedOrder }; // Added more return values
}

function displayAlgorithmSteps({ lat, lon, xMeters, yMeters, row, col, cellId, order }) {
    document.getElementById('algo-val-latlon').textContent = `${parseFloat(lat).toFixed(6)}, ${parseFloat(lon).toFixed(6)}`;
    document.getElementById('algo-val-xmeters').textContent = parseFloat(xMeters).toFixed(2);
    document.getElementById('algo-val-ymeters').textContent = parseFloat(yMeters).toFixed(2);
    document.getElementById('algo-val-colrow').textContent = `${col}, ${row}`;
    document.getElementById('algo-val-order').textContent = order;
    document.getElementById('algo-val-finalcellid').textContent = cellId;
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

    // Update visible lobbies list
    const visibleLobbyIds = [];
    for (let lobbyYOffset = -1; lobbyYOffset <= 1; lobbyYOffset++) {
        for (let lobbyXOffset = -1; lobbyXOffset <= 1; lobbyXOffset++) {
            const currentZoneLobbyCol = centerLobbyCol + lobbyXOffset;
            const currentZoneLobbyRow = centerLobbyRow + lobbyYOffset;
            visibleLobbyIds.push(`L-${currentZoneLobbyCol}-${currentZoneLobbyRow}`);
        }
    }
    if (visibleLobbiesListDisplay) {
        visibleLobbiesListDisplay.textContent = visibleLobbyIds.join(", ");
    }

    if (showLobbyZoneHighlight) {
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
                        }
                    }
                }
            }
        }

        // Current Lobby Border Highlighting (center lobby in the 3x3 zone)
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
    }

    // Highlight the new center cell (target cell) - Always active
    const centerCell = document.querySelector(`.cell[data-col="${targetCol}"][data-row="${targetRow}"]`);
    if (centerCell) {
        centerCell.classList.add("center");
    }

    // Highlight the 8 surrounding cells
    if (showNeighborHighlight) {
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
    if (loadingSpinner) loadingSpinner.style.display = "block"; // Show spinner

    const lat = parseFloat(latitudeInput.value);
    const lon = parseFloat(longitudeInput.value);

    if (isNaN(lat) || isNaN(lon)) {
        showStatusMessage("Please enter valid latitude and longitude values.", "error");
        if (loadingSpinner) loadingSpinner.style.display = "none"; // Hide spinner on error
        return;
    }

    const cellData = latLonToCell(lat, lon); // New call, gets all data

    // Store for re-highlighting on toggle change
    lastTargetCol = cellData.col;
    lastTargetRow = cellData.row;

    if (mapToggle.checked) {
        drawMinMaxOnLeaflet(cellData.row, cellData.col, cellData.lat, cellData.lon);
        gridContainer.style.display = "none";
        leafletMapContainer.style.display = "block";
        if (leafletMap) leafletMap.invalidateSize();
        if(zoomedLobbyHeader) zoomedLobbyHeader.style.display = 'none';
        if(zoomedLobby) zoomedLobby.style.display = 'none';
        if (visibleLobbiesListDisplay) visibleLobbiesListDisplay.textContent = "N/A (Map View)"; // Update info panel
    } else {
        createGrid(cellData.col, cellData.row);
        highlightGrid(cellData.col, cellData.row); // This will update visibleLobbiesListDisplay
        gridContainer.style.display = "grid";
        leafletMapContainer.style.display = "none";
        if(zoomedLobbyHeader) zoomedLobbyHeader.style.display = 'block';
        if(zoomedLobby) zoomedLobby.style.display = 'grid';
    }

    // These are common regardless of view
    updateInfo({ row: cellData.row, col: cellData.col, cellId: cellData.cellId, lat: cellData.lat, lon: cellData.lon });
    renderZoomedLobby(cellData.row, cellData.col); // This is for the abstract view, still updates but might be hidden
    displayAlgorithmSteps(cellData); // New call to display algorithm steps
    showStatusMessage("Grid and information updated for the submitted coordinates.", "success");

    if (loadingSpinner) loadingSpinner.style.display = "none"; // Hide spinner at the end
});

orderSelect.addEventListener("change", () => {
    const latInputVal = latitudeInput.value; // Renamed to avoid conflict
    const lonInputVal = longitudeInput.value; // Renamed to avoid conflict

    if (latInputVal && lonInputVal) { // Only if there are values to process
        const lat = parseFloat(latInputVal);
        const lon = parseFloat(lonInputVal);

        if (!isNaN(lat) && !isNaN(lon)) {
            // Recalculate cell data with new order
            const cellData = latLonToCell(lat, lon); // Gets all data including new cellId and order

            updateInfo({ row: cellData.row, col: cellData.col, cellId: cellData.cellId, lat: cellData.lat, lon: cellData.lon });
            renderZoomedLobby(cellData.row, cellData.col);
            displayAlgorithmSteps(cellData); // Update algorithm steps display
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
    if (loadingSpinner) loadingSpinner.style.display = "block"; // Show spinner

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
        if (visibleLobbiesListDisplay) visibleLobbiesListDisplay.textContent = "N/A (Map View)";
    } else { // Switched to Grid View
        gridContainer.style.display = "grid";
        zoomedLobbyHeader.style.display = "block";
        zoomedLobby.style.display = "grid";
        leafletMapContainer.style.display = "none";
        if (lastTargetCol !== null && lastTargetRow !== null) {
            highlightGrid(lastTargetCol, lastTargetRow); // This will update the visible lobbies list
        } else {
            if (visibleLobbiesListDisplay) visibleLobbiesListDisplay.textContent = "N/A (Grid not yet loaded)";
        }
    }
    if (loadingSpinner) loadingSpinner.style.display = "none"; // Hide spinner at the end
});

// Event listener for the new "Go to Cell ID" button
submitCellIdButton.addEventListener("click", () => {
    const cellIdString = cellIdInput.value;
    if (!cellIdString) {
        showStatusMessage("Please enter a Cell ID.", "error");
        return;
    }
    const parsedCellId = parseInt(cellIdString);

    if (isNaN(parsedCellId) || parsedCellId < 0) {
        showStatusMessage("Invalid Cell ID. Please enter a non-negative number.", "error");
        return;
    }

    const selectedOrder = orderSelect.value;
    const { row, col } = cellIdToCoordinates(parsedCellId, selectedOrder);

    // Validate row and col against map boundaries
    const maxCellIdColMajor = NUM_COLS * TOTAL_ROWS - 1;
    const maxCellIdRowMajor = TOTAL_ROWS * NUM_COLS - 1; // Same value, but for clarity

    if (selectedOrder === "col-major" && parsedCellId > maxCellIdColMajor) {
        showStatusMessage(`Cell ID ${parsedCellId} is too large for column-major order. Max is ${maxCellIdColMajor}.`, "error");
        return;
    } else if (selectedOrder === "row-major" && parsedCellId > maxCellIdRowMajor) {
        showStatusMessage(`Cell ID ${parsedCellId} is too large for row-major order. Max is ${maxCellIdRowMajor}.`, "error");
        return;
    }

    if (row < 0 || row >= TOTAL_ROWS || col < 0 || col >= NUM_COLS) {
        showStatusMessage(`Calculated coordinates (Row: ${row}, Col: ${col}) are out of bounds. Max Row: ${TOTAL_ROWS -1}, Max Col: ${NUM_COLS -1}. Check Cell ID and order.`, "error");
        return;
    }

    const { lat, lon } = absoluteCellToLatLon(col, row);

    latitudeInput.value = lat.toFixed(6);
    longitudeInput.value = lon.toFixed(6);

    // Simulate click on the main submit button to update grid and info
    submitCoordsButton.click();
    showStatusMessage("Map updated to Cell ID: " + parsedCellId, "success");
});

// Event listeners for highlight toggles
lobbyZoneToggle.addEventListener("change", function() {
    showLobbyZoneHighlight = this.checked;
    if (lastTargetCol !== null && lastTargetRow !== null && !mapToggle.checked) {
        highlightGrid(lastTargetCol, lastTargetRow);
    }
});

neighborToggle.addEventListener("change", function() {
    showNeighborHighlight = this.checked;
    if (lastTargetCol !== null && lastTargetRow !== null && !mapToggle.checked) {
        highlightGrid(lastTargetCol, lastTargetRow);
    }
});
