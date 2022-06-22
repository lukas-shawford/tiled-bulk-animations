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
        this.dialog = new Dialog(this.title);
        this.dialog.minimumWidth =400;
        this.dialog.finished.connect((code)=>{
            this.dialog = undefined;
        });
        this.promptInputs(()=>{
            if (!this.config) {
                if(this.dialog){
                    this.dialog.reject();
                }
                tiled.alert("Aborting operation.", this.title);
                return;
            }
            this.execute(() => this.createAnimations(), "Create Animations", this.config);
        });

    }

    createAnimations() {
        const tileset = tiled.activeAsset;
        const { selectedTiles, direction, stride, strideR, strideD, frames, duration } = this.config;
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
        if (this.dialog){
            this.dialog.accept();
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
        this.execute(() => this.clearAnimations(animatedTiles), "Clear Animations", null);
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
            tiled.log(errorOutput);
        }
    }

    promptInputs(configCallback) {
        const tileset = tiled.activeAsset;

        this.config = {};
        // Ensure a region is selected
        if (!tileset.selectedTiles || !tileset.selectedTiles.length) {
            tiled.alert("No tiles are selected. Please select the tiles containing the first animation frame of the "
                + "tiles you would like to animate.", this.title);
            return null;
        }

        // Get the selected tiles, sorted in order of tile id
        this.config.selectedTiles = this.getSelectedTiles();

        // If any of the selected tiles have existing animations, prompt the user if they want to clear them
        const proceed = this.checkExistingAnimations();
        if (!proceed) {
            return;
        }

        // Get the selection extent
        this.config.extent = this.getSelectionExtent();
        if (!this.config.extent) {
            return;
        }

        // Add dialog components for which direction (right, down or both) the animation continues
        this.addDirectionInput();
        this.addStrideInput();
        // Add dialog components for max number of frames to use for each animation
        this.addFramesInput();
        // default duration (ms) for each animation frame
        this.addDurationInput();
        this.dialog.addSeparator();
        var okButton = this.dialog.addButton('OK');
        okButton.clicked.connect(()=>{
            if (!this.validateConfig()){
                return;
            }
            configCallback();
        });
        var cancelButton = this.dialog.addButton('Cancel');
        cancelButton.clicked.connect(()=>{
            this.dialog.reject();
        })
        this.dialog.show();
    }

    validateConfig(){

        const frames =  this.config.frames;
        if (isNaN(frames) || frames < 0) {
            tiled.alert(`Invalid number of frames '${this.config.frames}'. Try again or press Cancel to abort.`, this.title);
            return false;
        }
        if (frames !== 0 && frames > this.config.maxFrames) {
            tiled.alert(`Invalid number of frames. Based on the size of the tileset, the maximum number of frames is ${this.config.maxFrames}.`
                +".\n\nPlease try again, or press Cancel to abort.", this.title);
            return false;
        }

        const stride = this.config.direction == 'd'?  this.config.strideD: this.config.strideR;
        if (stride <= 0) {
            tiled.alert("Stride should be greater than zero.", this.title);
            return false;
        }
        if (this.config.stride > this.config.maxStride) {
            tiled.alert("Invalid stride. Based on the size of the tileset and the specified direction, the maximum stride is: "
                + this.config.maxStride + ".\n\nPlease try again, or press Cancel to abort.", this.title);
            return false;
        }
        return true;
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

    addDirectionInput() {
        const tileset = tiled.activeAsset;
        let defaultDirection = tileset.imageWidth >= tileset.imageHeight ? "r" : "d";
        const directionToHeading = {
            "r": "The remainder of the animation is located to the right of the selected region.",
            "d": 'The remainder of the animation is located beneath the selected region.',
            "b": 'The remainder of the animation is both to the right and down (left to right, downwards).'
        }
        this.config.direction = defaultDirection;
        this.dialog.addSeparator('Direction');
        this.directionHeading = this.dialog.addHeading(`Current Direction: ${(this.config.direction == "r"? "Right": "Down")}\n${directionToHeading[this.config.direction]}`, true);
        this.directionDropdown = this.dialog.addComboBox('', ['Right', 'Down', 'Both']);
        this.directionDropdown.currentTextChanged.connect(function(newText){
            switch (newText){
                case 'Right':
                    this.config.direction = "r";

                    break;
                case 'Down':
                    this.config.direction = "d";
                    break;
                case 'Both':
                    this.config.direction = "b";
                default:
            }
            this.directionHeading.text = `Current Direction: ${newText}\n${directionToHeading[this.config.direction]}`;
            this.config.defaultStride = this.getDefaultStride();
            this.config.maxStride = this.getMaxStride();
            this.updateStrideInputsEnabled();
        }.bind(this));
    }
    updateStrideInputsEnabled(){
        if (this.config.direction == "r"){
            this.downStrideInput.enabled = false;
            this.downStrideInput.toolTip = 'Disabled since the current direction is Right';
            this.rightStrideInput.enabled = true;
            this.rightStrideInput.value = this.getDefaultStride();
            this.downStrideInput.value = 1;
            this.rightStrideInput.toolTip = this.rightStrideLabel.text;
            this.config.strideR = this.rightStrideInput.value;
        } else if (this.config.direction == "d"){
            this.downStrideInput.enabled = true;
            this.rightStrideInput.value = 1;
            this.downStrideInput.value = this.getDefaultStride();
            this.rightStrideInput.enabled = false;
            this.rightStrideInput.toolTip = 'Disabled since the current direction is Down';
            this.config.strideD = this.downStrideInput.value;
            this.downStrideInput.toolTip = this.downStrideLabel.text;
        } else {
            if (this.rightStrideInput.value == 1){
                this.rightStrideInput.value = this.getDefaultStride();
            }
            if (this.downStrideInput.value == 1){
                this.downStrideInput.value = this.getDefaultStride();
            }
            this.downStrideInput.enabled = true;
            this.rightStrideInput.enabled = true;
            this.config.strideD = this.downStrideInput.value;
            this.config.strideR = this.rightStrideInput.value;
            this.rightStrideInput.toolTip = this.rightStrideLabel.text;
            this.downStrideInput.toolTip = this.downStrideLabel.text;
        }
    }
    addStrideInput() {
        this.defaultStride = this.getDefaultStride();
        this.config.maxStride = this.getMaxStride();
        this.config.stride = this.defaultStride;

        this.dialog.addHeading("Enter the stride. This represents the number of tiles to advance between each animation "
            + "frame (in the direction specified in the previous step).\n"
            + "The value defaulted below is a best guess based on the selection, but may require adjustment depending on how "
            + "the tileset is laid out.", true);
        this.rightStrideLabel = this.dialog.addLabel("Stride (Right)");
        this.rightStrideInput = this.dialog.addNumberInput("", this.defaultStride);
        this.rightStrideInput.minimum = 1;
        this.rightStrideInput.decimals = 0;
        this.rightStrideInput.maximum = this.config.maxStride;
        this.rightStrideInput.valueChanged.connect((newValue)=>{
            this.config.strideR = this.rightStrideInput.value;
        });
        this.config.strideR = this.rightStrideInput.value;
        this.downStrideLabel = this.dialog.addLabel("Stride (Down)");
        this.downStrideInput = this.dialog.addNumberInput("", this.defaultStride);
        this.downStrideInput.minimum = 1;
        this.downStrideInput.decimals = 0;
        this.downStrideInput.maximum = this.config.maxStride;
        this.downStrideInput.valueChanged.connect((newValue)=>{
            this.config.strideD = this.downStrideInput.value;
        });
        this.config.strideD = this.downStrideInput.value;
        this.updateStrideInputsEnabled();
    }


    getDefaultStride() {
        if (!this.isSelectionRectangular()) {
            return 1;
        }
        const extent = this.getSelectionExtent();
        return this.config.direction === 'd' ? extent.height : extent.width;
    }

    getMaxStride() {
        const tileset = tiled.activeAsset;
        const extent = this.getSelectionExtent();
        if (this.config.direction === 'r' || this.config.direction === 'b') {
            const numCols = this.getNumCols();
            const extentR = extent.x + extent.width;
            return numCols - extentR;
        } else {
            const numRows = this.getNumRows();
            const extentB = extent.y + extent.height;
            return numRows - extentB;
        }
    }

    addFramesInput() {
        const maxFrames = this.getMaxFrames();
        this.dialog.addHeading("Enter the number of frames in each animation. Enter 0 if the animation continues "
            + `for the remainder of the tileset`, true);
        const input = this.dialog.addNumberInput("Frames", 0);
        this.config.frames = maxFrames;
        input.decimals = 0;
        input.minimum = 0;
        input.maximum = Math.floor(maxFrames);
        input.valueChanged.connect((newValue)=>{
            this.config.frames = frames === 0 ? this.getMaxFrames() : input.value;
        });
    }

    getMaxFrames() {
        const direction = this.config.direction;
        const extent = this.config.extent;
        if (direction === 'r') {
            const numCols = this.getNumCols();
            const extentR = extent.x + extent.width;
            return 1 + Math.floor((numCols - extentR) / this.config.strideR);
        }
        else if (direction === 'b') {
            const numCols = this.getNumCols();
            const extentR = extent.x + extent.width;
            const numRows = this.getNumRows();
            const extentB = extent.y + extent.height;
            return (1 + Math.floor((numCols - extentR) / this.config.strideR))*(1 + Math.floor((numRows - extentB) / this.config.strideD));
        }
        if (direction === 'd') {
            const numRows = this.getNumRows();
            const extentB = extent.y + extent.height;
            return 1 + Math.floor((numRows - extentB) / this.config.strideD);
        }
    }

    addDurationInput() {
        this.dialog.addHeading("Enter the default duration to use for each animation frame (in milliseconds)", true);
        this.durationInput = this.dialog.addNumberInput('Duration: ', 100);
        this.config.duration = 100;
        this.durationInput.decimals = 0;
        this.durationInput.minimum = 1;
        this.durationInput.maximum = 99999;
        this.durationInput.suffix = " ms";
        this.durationInput.value = this.config.duration;
        this.durationInput.valueChanged.connect((newValue)=>{
            this.config.duration = this.durationInput.value;
        })
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
        const extent =  Qt.rect(left, top, width, height);
        return extent;
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
            if(!frameTile) continue;
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
