const rewire = require('rewire');
// require('./mocks/tiled');
rewire('./mocks/tiled');
const bulkAnimationEditor = require('./helpers/bulk-animation-editor');
const tilesetHelpers = require('./helpers/tileset-helpers');

describe('Bulk Animation Editor', () => {
    it('should initialize', () => {
        expect(bulkAnimationEditor.title).toBe('Bulk Animation Editor');
    });

    describe('isSelectionRectangular', () => {
        it('should return true if selection is rectangular', () => {
            // Arrange
            const tileset = tilesetHelpers.createMockTileset({
                tileWidth: 32,
                tileHeight: 32,
                numRows: 6,
                numCols: 6,
            });
            tileset.selectedTiles = tilesetHelpers.setSelectedTileIds(tileset, [0, 1, 2, 6, 7, 8]);
            tiled.activeAsset = tileset;

            // Act
            const result = bulkAnimationEditor.isSelectionRectangular();

            // Assert
            expect(result).toBe(true);
        });
    })
});
