// docs/infoPanel.js
// Info Panel module for MinMax99 UI

export function initInfoPanel() {
    // Create sidebar panel if not present
    if (!document.getElementById('info-panel')) {
        const panel = document.createElement('div');
        panel.id = 'info-panel';
        panel.innerHTML = `
            <h3>Cell Information</h3>
            <div class="info-row"><span>Cell ID:</span> <span id="info-cell-id"></span> <button class="copy-btn" data-copy="info-cell-id">Copy</button></div>
            <div class="info-row"><span>Col/Row:</span> <span id="info-cell-xy"></span> <button class="copy-btn" data-copy="info-cell-xy">Copy</button></div>
            <div class="info-row"><span>Geo Coords:</span> <span id="info-geo-coords"></span> <button class="copy-btn" data-copy="info-geo-coords">Copy</button></div>
            <div class="info-row"><span>Lobby:</span> <span id="info-lobby-id"></span> <button class="copy-btn" data-copy="info-lobby-id">Copy</button></div>
            <div class="info-row"><span>DB Path:</span> <span id="info-db-path"></span> <button class="copy-btn" data-copy="info-db-path">Copy</button></div>
        `;
        document.body.appendChild(panel);
    }
    // Add copy event listeners
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.onclick = function() {
            const targetId = btn.getAttribute('data-copy');
            const text = document.getElementById(targetId).textContent;
            navigator.clipboard.writeText(text);
            btn.textContent = 'Copied!';
            setTimeout(() => btn.textContent = 'Copy', 1000);
        };
    });
}

export function updateInfoPanel({ cellId, row, col, lat, lon, lobbyId, dbPath }) {
    document.getElementById('info-cell-id').textContent = cellId;
    document.getElementById('info-cell-xy').textContent = `${col}, ${row}`;
    document.getElementById('info-geo-coords').textContent = (lat !== undefined && lon !== undefined)
        ? `${parseFloat(lat).toFixed(6)}, ${parseFloat(lon).toFixed(6)}` : 'N/A';
    document.getElementById('info-lobby-id').textContent = lobbyId;
    document.getElementById('info-db-path').textContent = dbPath;
}
