# MinMax99 Spatial Explorer

The MinMax99 Spatial Explorer is an interactive webpage designed to help users visualize and understand the MinMax99 global addressing scheme. Users can input geographic coordinates (latitude and longitude) to identify the corresponding MinMax99 cell, its parent lobby, and related information.

## Core Features

### 1. Coordinate Input
*   **Manual Entry:** Input fields for precise Latitude and Longitude values.
*   **Use My Location:** A button (📍) to automatically fetch the user's current GPS location (requires browser permission).

### 2. Interactive Grid (Abstract View)
The primary display is a dynamic 100x100 grid of MinMax99 cells, representing a 50km x 50km area.
*   **Centering:** The grid automatically centers on the MinMax99 cell corresponding to the submitted coordinates.
*   **Cell Highlighting:**
    *   **Target Cell:** The selected cell is highlighted in **green**.
    *   **Surrounding Cells:** The 8 immediate neighbors of the target cell are highlighted in **light blue**.
    *   **Current Lobby Outline:** The 20x20 cell lobby (10km x 10km) containing the target cell is outlined in **red**.
    *   **3x3 Lobby Zone:** The larger 3x3 zone of lobbies (60x60 cells or 30km x 30km) centered around the target's lobby is given a subtle background tint for context.
*   **Tooltips:** Hovering over any cell in the grid displays a tooltip with:
    *   Global Cell ID (calculated based on selected order)
    *   Cell's Absolute Column and Row in the MinMax99 system
    *   Lobby ID (e.g., `L-X-Y`)
    *   Firebase-style Database Path (e.g., `/lobby/X_Y/cell_...`)

### 3. Information Panel
Below the grid, an information panel provides detailed data for the target cell:
*   **Cell ID:** Global identifier.
*   **Cell X,Y:** Absolute column and row.
*   **Geo (Lat, Lon):** The input coordinates.
*   **Lobby ID:** Identifier of the 20x20 cell lobby.
*   **DB Path:** Formatted path for potential database lookups.

### 4. Zoomed Lobby View
A separate section displays a 20x20 grid representing the current lobby, with each cell showing its global Cell ID. This view is hidden when the Leaflet Map View is active.

## Advanced Features

### 1. Cell ID Order Toggle
*   A dropdown menu allows switching the Cell ID calculation method between:
    *   **Column-Major:** (Default) `cellId = col * TOTAL_ROWS + row`
    *   **Row-Major:** `cellId = row * NUM_COLS + col`
*   All Cell ID displays (Info Panel, Tooltips, Zoomed Lobby) update according to the selected order.

### 2. Test Case Presets
*   A series of buttons for famous cities and locations (e.g., Los Angeles, New York, Paris, Tokyo, Sydney, Null Island).
*   Clicking a preset populates the latitude/longitude fields and automatically submits them.

### 3. Leaflet Map View
*   **Toggle:** A checkbox allows switching from the abstract grid view to a real-world map view powered by Leaflet and OpenStreetMap.
*   **Map Display:**
    *   The map centers on the submitted coordinates.
    *   The target MinMax99 cell, its 8 neighbors, and the outline of its 20x20 lobby are drawn as vector graphics directly onto the map.
    *   The map automatically zooms to best fit the current lobby.

## How to Use
1.  Enter Latitude and Longitude values in the input fields.
2.  Alternatively, click "📍 Use My Location" to use your browser's GPS.
3.  Click "Submit".
4.  Explore the grid: hover over cells for tooltips, observe highlighting.
5.  Review details in the Info Panel and Zoomed Lobby View.
6.  Optionally, switch Cell ID order, try preset locations, or toggle the Leaflet Map View for a different perspective.
7.  Use the status messages at the top for feedback on actions.

## Technical Notes
*   **MinMax99 Cell Size:** Approximately 500m x 500m.
*   **Lobby Size:** 20x20 cells (10km x 10km).
*   **3x3 Lobby Zone:** A 3x3 arrangement of lobbies, covering 60x60 cells (30km x 30km).

---
This README provides a good overview for users and developers interacting with this enhanced MinMax99 Explorer.
