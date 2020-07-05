## Bulk Animations Extension for [Tiled Map Editor](https://www.mapeditor.org/)

This extension allows quickly animating an entire group of tiles in a tileset image, so long as the animation frames
are arranged consistently (subsequent frames located directly to the right or below the initial frames for each tile).

Here is a demo of this extension being used to animate ocean waves:

![Demo](https://github.com/sergkr/tiled-bulk-animations/raw/master/demo.gif)

The sample tileset used in the above demo is available on opengameart.org:

https://opengameart.org/content/animated-ocean-tileset

Credit to Leonard Pabin aka (Len) and Zachariah Husiar aka (Zabin) for the artwork.

### Installation

1. Navigate to the [Releases](https://github.com/sergkr/tiled-bulk-animations/releases) in this repository and download
`bulk-animations.zip` from the latest release.
2. Extract the contents and place the `bulk-animations` directory into the extensions directory of Tiled Map Editor.
* The extensions directory depends on your operating system. You can open the extensions directory from Tiled by going to **Edit 
→ Preferences**, then switching to the **Plugins** tab and clicking on **Open** in the **Extensions** section.
* Or you can refer to the list below:

Platform | Location
------------ | -------------
Windows | `C:/Users/<USER>/AppData/Local/Tiled/extensions/`
MacOS | `~/Library/Preferences/Tiled/extensions/`
Linux | `~/.config/tiled/extensions/`

Tiled should automatically detect and load the plugin without having to restart the editor.

Once the extension is saved, the new menu entries should be available in the **Tileset** menu when editing a tileset (.tsx).
