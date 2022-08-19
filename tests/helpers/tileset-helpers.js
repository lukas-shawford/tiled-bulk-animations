function createMockTileset(config) {
    return {
        tileWidth: config.tileWidth,
        tileHeight: config.tileHeight,
        imageWidth: config.tileWidth * config.numCols,
        imageHeight: config.tileHeight * config.numRows,
        tileSpacing: config.tileSpacing ?? 0,
        margin: config.margin ?? 0,
        tiles: createTiles(config),
        selectedTiles: [],
    };
}

function createTiles(config) {
    const tiles = [];
    let id = 0;
    for (let r = 0; r < config.numRows; r++) {
        for (let c = 0; c < config.numCols; c++) {
            const tile = { id };
            tiles.push(tile);
        }
    }
    return tiles;
}

function setSelectedTileIds(tileset, ids) {
    const selectedTiles = [];
    for (const id of ids) {
        const tile = tileset.tiles.find(t => t.id === id);
        if (tile) {
            selectedTiles.push(tile);
        }
    }
    return selectedTiles;
}

module.exports = {
    createMockTileset,
    setSelectedTileIds,
};
