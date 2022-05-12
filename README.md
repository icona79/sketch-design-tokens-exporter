# Sketch Design Tokens Exporter

With this plugin you can export to your desktop a `design-tokens.json` file compatible with Amazon Style Dictionary.

The plugin extracts from your current opened Sketch document all your Color Variable, Layer Styles and Text Styles.

It also add some extra layer of Design Tokens, such as:

-   Shadows
-   Font Families
-   Font Sizes
-   Font Weights
-   Text Alignments
-   Border Positions

Each Design Token Layer is then used when requested in your Text and Layer styles.

All the references to an existent token is defined with a `$` sign:

For example:

```
"Black": {
  "background-color": {
    "value": "$Black"
  }
},
```

`$Black` refers to a previously generated Color Token defined into the `colors` section like:

```
"Black": {
  "value": "rgba(0, 0, 0, 1)"
},
```

## Aknowledgments

Thanks to [Ale Munoz](https://github.com/bomberstudios) and [Francesco Bertocci](https://github.com/fbmore) for all their support :pray:

## Installation

-   [Download](../../releases/latest/download/sketch-tokens-exporter.sketchplugin.zip) the latest release of the plugin
-   Un-zip
-   Double-click on sketch-tokens-exporter.sketchplugin

## Development Guide

_This plugin was created using `skpm`. For a detailed explanation on how things work, checkout the [skpm Readme](https://github.com/skpm/skpm/blob/master/README.md)._

## Notes

This plugin is a port of a File Format Design Tokens exporter, which permits you to perform the same action from any OS (by having a downloaded Sketch document available oon your Computer).
The File Format project is available [here](https://github.com/icona79/sketch-design-tokens-exporter-FF).
