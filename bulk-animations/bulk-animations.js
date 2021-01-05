class BulkAnimationEditor {
    constructor() {
        this.title = "Bulk Animation Editor";
        this.version = "1.2";

        const createAnimations = tiled.registerAction('BulkAnimationEditor_CreateFromSelection',
            action => this.beginCreateAnimations());
        createAnimations.text = "Create Bulk Animations From Selection";
        createAnimations.icon = "icon-create.png";

        const clearAnimations = tiled.registerAction('BulkAnimationEditor_ClearSelection',
            action => this.beginClearAnimations());
        clearAnimations.text = "Clear Animations In Selection";
        clearAnimations.icon = "icon-clear.png";
    }

    beginCreateAnimations() {
        const tileset = tiled.activeAsset;
        const config = this.promptInputs();
        if (!config) {
            tiled.alert("Aborting operation.", this.title);
            return;
        }
        this.execute(() => this.createAnimations(config), "Create Animations", config);
    }

    createAnimations(config) {
        const tileset = tiled.activeAsset;
        const { selectedTiles, direction, stride, strideR, strideD, frames, duration } = config;
        for (const tile of selectedTiles) {
            // HACK: Loop over all tiles to work around an issue with some tiles being occasionally null in the
            // tileset.tiles array. Not sure why the issue occurs - likely has something to do with the fact that
            // we're modifying the tiles while still iterating over them, or making too many modifications too
            // quickly. In any case, the simple act of looping over the tiles seems to make the issue go away. In
            // case there are any null tiles, display an alert and abort.
            const nullTiles = tileset.tiles.filter(t => t === null);
            if (nullTiles.length) {
                tiled.alert("An error occurred performing the operation: " + nullTiles.length + " tile(s) failed "
                    + "to load while attempting to create the animation for tile ID " + tile.id + ".\n\nPlease try "
                    + "again, and if the problem persists, please submit an issue.", this.title);
            }

            tile.frames = this.getFrames(tile, direction, stride, strideR, strideD, frames, duration);
        }
    }

    beginClearAnimations() {
        const tileset = tiled.activeAsset;

        // Ensure a region is selected
        if (!tileset.selectedTiles || !tileset.selectedTiles.length) {
            tiled.alert("No tiles are selected. Please select a region containing the animations you would like to "
                + "clear.", this.title);
            return;
        }

        // If no animations exist in selected region, let user know and abort
        const animatedTiles = tileset.selectedTiles.filter(tile => tile.frames && tile.frames.length > 0);
        if (!animatedTiles.length) {
            tiled.alert("No animations are present on any of the tiles in the selected region.", this.title);
            return;
        }

        // Confirm before clearing animations
        const response = tiled.confirm(animatedTiles.length + " tile(s) will have their animations removed. Are "
            + "you sure you want to continue?", this.title);
        if (!response) return;

        // Clear the animations
        this.execute(() => this.clearAnimations(animatedTiles), "Create Animations", null);
    }

    clearAnimations(animatedTiles) {
        for (const tile of animatedTiles) {
            tile.frames = [];
        }
    }

    execute(action, name) {
        try {
            action();
        } catch (e) {
            tiled.alert("An error occurred performing the operation. The error was logged to the Console (View → Views "
                + "and Toolbars → Console).\n\nPlease try again, and if the error persists, please submit an issue for "
                + "this extension with the error output from the console and (if possible) the tileset you are using.",
                this.title);
            const errorOutput = this.formatError(e, name);
            console.error(errorOutput);
        }
    }

    promptInputs() {
        const tileset = tiled.activeAsset;

        // Ensure a region is selected
        if (!tileset.selectedTiles || !tileset.selectedTiles.length) {
            tiled.alert("No tiles are selected. Please select the tiles containing the first animation frame of the "
                + "tiles you would like to animate.", this.title);
            return null;
        }

        // Get the selected tiles, sorted in order of tile id
        const selectedTiles = this.getSelectedTiles();

        // If any of the selected tiles have existing animations, prompt the user if they want to clear them
        const proceed = this.checkExistingAnimations();
        if (!proceed) {
            return;
        }

        // Get the selection extent
        const extent = this.getSelectionExtent();
        if (!extent) {
            return;
        }

        // Prompt which direction (right, down or both) the animation continues
        const direction = this.promptDirection();
        if (direction === null) {
            return;
        }

        let strideR = "0", strideD = "0", stride = "0";
        if (direction === 'b' && !this.isSelectionSquare()) {
            // Prompt for both strides separately (number of tiles between each consecutive animation frame in both directions)
            strideR = this.promptStride('r');
            if (strideR === null) {
                return;
            }
            stride = strideR;
            strideD = this.promptStride('d');
            if (strideD === null) {
                return;
            }
        } else {
            // Prompt the stride (number of tiles between each consecutive animation frame)
            stride = this.promptStride(direction);
            if (stride === null) {
                return;
            }
            if (direction === 'b') {
                strideR = stride;
                strideD = stride;
            }
        }

        // Prompt max number of frames to use for each animation
        const frames = this.promptFrames(extent, stride, strideR, strideD, direction);
        if (frames === null) {
            return;
        }

        // Prompt default duration (ms) for each animation frame
        const duration = this.promptDuration();
        if (duration === null) {
            return;
        }

        // Return config
        return {
            selectedTiles,
            extent,
            direction,
            stride,
            strideR,
            strideD,
            frames,
            duration
        };
    }

    checkExistingAnimations() {
        const tileset = tiled.activeAsset;
        const animatedTiles = tileset.selectedTiles.filter(tile => tile.frames && tile.frames.length > 0);
        if (animatedTiles.length) {
            const response = tiled.confirm(animatedTiles.length + " tile(s) already have animations. These existing "
                + "animations will be cleared. Are you sure you want to continue?", this.title);
            if (!response) return false;
        }
        return true;
    }

    promptDirection() {
        const tileset = tiled.activeAsset;
        while (true) {
            let defaultDirection = tileset.imageWidth >= tileset.imageHeight ? 'r' : 'd';
            let direction = tiled.prompt("Enter \"r\" if the remainder of the animation is located to the right of the "
                + "selected region.\nEnter \"d\" if the remainder of the animation is located beneath the selected region."
                + "\nOr enter \"b\" if the remainder of the animation is both to the right and down (left to right, downwards).",
                defaultDirection, this.title);
            if (!direction) return null;
            direction = direction.toLowerCase()[0];
            if (direction === 'r' || direction === 'd' || direction === 'b') {
                return direction;
            }
            tiled.alert("Invalid selection. Please enter either \"r\" or \"d\" (without quotes), or press Cancel to "
                + "abort.", this.title);
        }
    }

    promptStride(direction) {
        const defaultStride = this.getDefaultStride(direction);
        const maxStride = this.getMaxStride(direction);
        while (true) {
            const input = tiled.prompt("Enter the stride. This represents the number of tiles to advance between each animation "
                + "frame (in the direction specified in the previous step).\n"
                + "The value defaulted below is a best guess based on the selection, but may require adjustment depending on how "
                + "the tileset is laid out.", defaultStride, this.title);
            if (!input) return null;
            const stride = +input;
            if (isNaN(stride)) {
                tiled.alert("Invalid stride. Try again or press Cancel to abort.", this.title);
                continue;
            }
            if (stride <= 0) {
                tiled.alert("Stride should be greater than zero.", this.title);
                continue;
            }
            if (stride > maxStride) {
                tiled.alert("Invalid stride. Based on the size of the tileset and the specified direction, the maximum stride is: "
                    + maxStride + ".\n\nPlease try again, or press Cancel to abort.", this.title);
                continue;
            }
            return stride;
        }
    }

    getDefaultStride(direction) {
        if (!this.isSelectionRectangular()) {
            return 1;
        }
        const extent = this.getSelectionExtent();
        return direction === 'd' ? extent.height : extent.width;
    }

    getMaxStride(direction) {
        const tileset = tiled.activeAsset;
        const extent = this.getSelectionExtent();
        if (direction === 'r' || direction === 'b') {
            const numCols = this.getNumCols();
            const extentR = extent.x + extent.width;
            return numCols - extentR;
        } else {
            const numRows = this.getNumRows();
            const extentB = extent.y + extent.height;
            return numRows - extentB;
        }
    }

    promptFrames(extent, stride, strideR, strideD, direction) {
        const maxFrames = this.getMaxFrames(extent, stride, strideR, strideD, direction);
        while (true) {
            const input = tiled.prompt("Enter the number of frames in each animation. Enter 0 if the animation continues\n"
                + "for the remainder of the tileset.", "0", this.title);
            if (!input) return null;
            const frames = +input;
            if (isNaN(frames) || frames < 0) {
                tiled.alert("Invalid number of frames. Try again or press Cancel to abort.", this.title);
                continue;
            }
            if (frames !== 0 && frames > maxFrames) {
                tiled.alert("Invalid number of frames. Based on the size of the tileset, the maximum number of frames is: "
                    + maxFrames + ".\n\nPlease try again, or press Cancel to abort.", this.title);
                continue;
            }
            return frames === 0 ? maxFrames : frames;
        }
    }

    getMaxFrames(extent, stride, strideR, strideD, direction) {
        const tileset = tiled.activeAsset;
        if (direction === 'r') {
            const numCols = this.getNumCols();
            const extentR = extent.x + extent.width;
            return 1 + Math.floor((numCols - extentR) / stride);
        }
        if (direction === 'b') {
            const numCols = this.getNumCols();
            const extentR = extent.x + extent.width;
            const numRows = this.getNumRows();
            const extentB = extent.y + extent.height;
            return (1 + Math.floor((numCols - extentR) / strideR))*(1 + Math.floor((numRows - extentB) / strideD));
        }
        if (direction === 'd') {
            const numRows = this.getNumRows();
            const extentB = extent.y + extent.height;
            return 1 + Math.floor((numRows - extentB) / stride);
        }
    }

    promptDuration() {
        while (true) {
            const input = tiled.prompt("Enter the default duration to use for each animation frame (in milliseconds):", "100", this.title);
            if (!input) return null;
            const duration = +input;
            if (isNaN(duration) || duration <= 0) {
                tiled.alert("Invalid duration. Please enter a value greater than 0, or press Cancel to abort.", this.title);
                continue;
            }
            return duration;
        }
    }

    getNumRows() {
        const tileset = tiled.activeAsset;
        const H = tileset.imageHeight;
        const h = tileset.tileHeight;
        const p = tileset.tileSpacing;
        const m = tileset.margin;
        return Math.floor((H + p - 2*m) / (h + p));
    }

    getNumCols() {
        const tileset = tiled.activeAsset;
        const W = tileset.imageWidth;
        const w = tileset.tileWidth;
        const p = tileset.tileSpacing;
        const m = tileset.margin;
        return Math.floor((W + p - 2*m) / (w + p));
    }

    getTileCoord(tile) {
        const tileset = tiled.activeAsset;
        const numCols = this.getNumCols();
        const index = tileset.tiles.indexOf(tile);
        if (index < 0) {
            throw new Error("Tile not found in tileset: " + tile);
        }
        const x = index % numCols;
        const y = Math.floor(index / numCols);
        return Qt.point(x, y);
    }

    getSelectedTiles() {
        const tileset = tiled.activeAsset;
        if (!tileset.selectedTiles) {
            return [];
        }
        return tileset.selectedTiles.sort((a, b) => a.id - b.id);
    }

    getSelectionExtent() {
        const tileset = tiled.activeAsset;
        if (!tileset.selectedTiles || !tileset.selectedTiles.length) {
            return null;
        }
        const selectedTiles = this.getSelectedTiles();
        let top = null;
        let right = null;
        let bottom = null;
        let left = null;
        for (const tile of selectedTiles) {
            const coord = this.getTileCoord(tile);
            if (top === null || coord.y < top) {
                top = coord.y;
            }
            if (right === null || coord.x > right) {
                right = coord.x;
            }
            if (bottom === null || coord.y > bottom) {
                bottom = coord.y;
            }
            if (left === null || coord.x < left) {
                left = coord.x;
            }
        }
        const width = right - left + 1;
        const height = bottom - top + 1;
        return Qt.rect(left, top, width, height);
    }

    isSelectionRectangular() {
        const extent = this.getSelectionExtent();
        if (!extent) {
            return null;
        }
        const tileset = tiled.activeAsset;
        const selectedTiles = tileset.selectedTiles.sort((a, b) => a.id - b.id);
        const numCols = this.getNumCols();
        for (let r = extent.y, i = 0; r < extent.y + extent.height; r++) {
            for (let c = extent.x; c < extent.x + extent.width; c++, i++) {
                if (i >= selectedTiles.length) {
                    return false;
                }
                const id = r * numCols + c;
                const tile = selectedTiles[i];
                if (tile.id !== id) {
                    return false;
                }
            }
        }
        return true;
    }

    isSelectionSquare() {
        const extent = this.getSelectionExtent();
        if (!extent) {
            return null;
        }
        return (extent.width == extent.height);
    }

    getFrames(tile, direction, stride, strideR, strideD, maxFrames, duration) {
        const frames = [];
        const tileset = tiled.activeAsset;
        const numCols = this.getNumCols();
        const idStride = direction === 'd' ? numCols * stride : stride;
        const extent = this.getSelectionExtent();
        let tileIndex = tileset.tiles.indexOf(tile);
        if (tileIndex < 0) {
            throw new Error("Tile not found in tileset");
        }
        for (let i = 0; i < maxFrames; i++) {
            const frameTile = tileset.tiles[tileIndex];
            frames.push({
                tileId: frameTile.id,
                duration
            });
            if (direction === 'b' && frames.length % (1 + Math.floor((numCols - (extent.x + extent.width)) / strideR)) === 0) {
                tileIndex += (numCols * strideD) - (numCols-strideR);
            } else {
                tileIndex += idStride;
            }
        }
        return frames;
    }

    formatError(e, name, config) {
        const tileset = tiled.activeAsset;

        let result = 'Error output from Bulk Animations extension (please copy everything below if submitting an issue):\n'
            + '----------------------------------------\n'
            + e.toString() + "\n\n"
            + "Action: " + name + "\n\n"
            + "Stack Trace:\n"
            + e.stack + '\n\n'
            + "Extension Version: " + this.version + "\n\n";

        if (config) {
            result += "Config:\n" + JSON.stringify(config) +"\n\n";
        }

        result += "Tileset Information:\n"
            + "Image width: " + tileset.imageWidth + "\n"
            + "Image height: " + tileset.imageHeight + "\n"
            + "Tile width: " + tileset.tileWidth + "\n"
            + "Tile height: " + tileset.tileHeight + "\n"
            + "Tile spacing: " + tileset.tileSpacing + "\n"
            + "Margin: " + tileset.margin + "\n\n"
            + '----------------------------------------\n';

        return result;
    }
}

const bulkAnimationEditor = new BulkAnimationEditor();

tiled.extendMenu("Tileset", [
    { action: 'BulkAnimationEditor_CreateFromSelection', before: 'AddTiles' },
    { action: 'BulkAnimationEditor_ClearSelection' },
    { separator: true }
]);
