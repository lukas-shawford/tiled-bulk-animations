class BulkAnimationEditor {
    constructor() {
        this.title = "Bulk Animation Editor";
        this.version = "1.0";

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
        const { extent, direction, frames, duration } = config;
        const stride = this.getStride(extent, direction);
        for (const id of this.getTileIdsInExtent(extent)) {
            const tile = tileset.tile(id);

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

            tile.frames = this.getFrames(tile, stride, frames, duration);
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
            tiled.alert("No tiles are selected. Please select a region containing the first animation frame of the "
                + "tiles you would like to animate.", this.title);
            return null;
        }

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

        // Prompt which direction (right or down) the animation continues
        const direction = this.promptDirection();
        if (direction === null) {
            return;
        }

        // Prompt max number of frames to use for each animation
        const frames = this.promptFrames(extent, direction);
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
            extent,
            direction,
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
                + "selected region.\nEnter \"d\" if the remainder of the animation is located beneath the selected region.",
                defaultDirection, this.title);
            if (!direction) return null;
            direction = direction.toLowerCase()[0];
            if (direction === 'r' || direction === 'd') {
                return direction;
            }
            tiled.alert("Invalid selection. Please enter either \"r\" or \"d\" (without quotes), or press Cancel to "
                + "abort.", this.title);
        }
    }

    promptFrames(extent, direction) {
        const maxFrames = this.getMaxFrames(extent, direction);
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

    getMaxFrames(extent, direction) {
        const tileset = tiled.activeAsset;
        if (direction === 'r') {
            const tilesX = tileset.imageWidth / tileset.tileWidth;
            const extentR = extent.x + extent.width;
            return 1 + Math.floor((tilesX - extentR) / extent.width);
        } else {
            const tilesY = tileset.imageHeight / tileset.tileHeight;
            const extentB = extent.y + extent.height;
            return 1 + Math.floor((tilesY - extentB) / extent.height);
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

    getTileCoord(tile) {
        const tileset = tiled.activeAsset;
        const tilesX = tileset.imageWidth / tileset.tileWidth;
        const index = tileset.tiles.indexOf(tile);
        if (index < 0) {
            throw new Error("Tile not found in tileset: " + tile);
        }
        const x = index % tilesX;
        const y = Math.floor(index / tilesX);
        return Qt.point(x, y);
    }

    getSelectionExtent() {
        const tileset = tiled.activeAsset;
        if (!tileset.selectedTiles || !tileset.selectedTiles.length) {
            return null;
        }
        const topLeft = tileset.selectedTiles[0];
        const topLeftCoord = this.getTileCoord(topLeft);
        const bottomRight = tileset.selectedTiles[tileset.selectedTiles.length - 1];
        const bottomRightCoord = this.getTileCoord(bottomRight);
        const selectionWidth = bottomRightCoord.x - topLeftCoord.x + 1;
        const selectionHeight = bottomRightCoord.y - topLeftCoord.y + 1;
        return Qt.rect(topLeftCoord.x, topLeftCoord.y, selectionWidth, selectionHeight);
    }

    getStride(extent, direction) {
        if (direction === 'r') {
            return extent.width;
        } else {
            const tileset = tiled.activeAsset;
            const tilesX = tileset.imageWidth / tileset.tileWidth;
            return tilesX * extent.height;
        }
    }

    *getTileIdsInExtent(extent) {
        const tileset = tiled.activeAsset;
        const width = tileset.imageWidth / tileset.tileWidth;
        for (let x = extent.x; x < extent.x + extent.width; x++) {
            for (let y = extent.y; y < extent.y + extent.height; y++) {
                const index = (y * width) + x;
                yield index;
            }
        }
    }

    createAnimation(tile, config) {
        const { extent, direction, frames, duration } = config;
    }

    getFrames(tile, stride, maxFrames, duration) {
        const frames = [];
        const tileset = tiled.activeAsset;
        const width = tileset.imageWidth / tileset.tileWidth;
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
            tileIndex += stride;
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
