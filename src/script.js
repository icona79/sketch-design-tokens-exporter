import BrowserWindow from "sketch-module-web-view";
import { getWebview } from "sketch-module-web-view/remote";
import UI from "sketch/ui";
import rgbHex from "rgb-hex";
import hexRgb from "hex-rgb";
import { isDeepStrictEqual } from "util";

import { resolve } from "path";
const fs = require("@skpm/fs");
const os = require("os");
const path = require("path");
const desktopDir = path.join(os.homedir(), "Desktop");

// import config from "./config.json";

// General variables
const variablePrefix = "$";
const keyToDelete = "length";
const separator = "-";
var result = "";
var colors = [];
var externalShadows = [];
var internalShadows = [];
var gradients = [];
var fontSizes = [];

// #region Default constants
// filltType
// 0 = Fill
// 1 = Gradient
// gradientType
// 0 = Linear
// 1 = Radial
// 2 = Angular
const borderPosition = ["Inside", "Center", "Outside"];
const gradientTypeValue = [
    "linear-gradient",
    "radial-gradient",
    "angular-gradient",
];
const gradientCircleType = ["circle", "ellipse"];
const imageFillType = ["tile", "fill", "stretch", "fit"];
// #endregion

// #region Sketch Items
var sketch = require("sketch");

// Document variables
var doc = context.document;
var document = sketch.getSelectedDocument();
var artboard = sketch.Artboard;
var data = document.sketchObject.documentData();
// #endregion

let designTokensList = {};

export default function() {
    // #region Color Variables
    // Sort color swatches by name. Uses `localCompare` to sort
    // numbers properly. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare
    let colorTokens = {};
    const swatches = document.swatches; //.map((Swatch) => Swatch["name"]);
    swatches.forEach((swatch) => {
        let swatchColor = setColor(swatch.color, "rgba");
        colors.push([
            swatch.name.substring(swatch.name.lastIndexOf("/") + 1),
            swatchColor,
        ]);
        if (swatch.name.indexOf("/") > -1) {
            createNestedObject(colorTokens, swatch.name.split("/"), {
                value: swatchColor,
            });
        } else {
            colorTokens[swatch.name] = { value: swatchColor };
        }
    });
    // #endregion

    // #region Layer Styles
    const layerStyles = document.sharedLayerStyles;
    const arrayLayerStyleIDs = layerStyles.map(
        (sharedstyle) => sharedstyle["id"]
    );
    const arrayLayerStyleNames = layerStyles.map(
        (sharedstyle) => sharedstyle["name"]
    );
    const arrayLayerStyleStyles = layerStyles.map(
        (sharedstyle) => sharedstyle["style"]
    );
    const layerStylesOrdered = [...document.sharedLayerStyles].sort(
        (left, right) => left.name > right.name
    );
    var stylesString = JSON.stringify(layerStylesOrdered);

    // console.log(layerStyles);

    // Color styles checks
    let layerStylesTokensList = {};
    let layerStyleTokens = {};
    let borderPositions = {};

    let layerStylesComplete = false;

    // #region Shadow tokens
    let shadowStyles = {};
    let shadowCounter = 1;
    for (const sharedStyle of layerStyles) {
        let shadows = sharedStyle.style.shadows;

        for (const shadow of shadows) {
            let currentShadow = {};

            if (shadow.enabled === true) {
                setShadowDetails(currentShadow, shadow, "shadow");

                if (!checkTokenValue(shadowStyles, currentShadow)) {
                    let currentShadowName = "shadow-" + shadowCounter;
                    createCouples(
                        shadowStyles,
                        currentShadow,
                        currentShadowName,
                        "",
                        0
                    );
                    externalShadows.push([currentShadowName, currentShadow]);
                    shadowCounter++;
                }
            }
        }
    }
    // #endregion

    // reset generic variables
    result = "";

    // #region Inner Shadow tokens
    let innerShadowStyles = {};
    for (const sharedStyle of layerStyles) {
        let shadows = sharedStyle.style.innerShadows;
        let shadowCounter = 1;
        for (const shadow of shadows) {
            let currentShadow = {};
            if (shadow.enabled === true) {
                setShadowDetails(currentShadow, shadow, "inner-shadow");

                if (!checkTokenValue(currentShadow, innerShadowStyles)) {
                    let currentShadowName = "inner-shadow-" + shadowCounter;
                    createCouples(
                        innerShadowStyles,
                        currentShadow,
                        currentShadowName,
                        "",
                        0
                    );
                    internalShadows.push([currentShadowName, currentShadow]);
                    shadowCounter++;
                }
            }
        }
        shadowCounter = 1;
    }
    // #endregion

    // reset generic variables
    result = "";

    // #region gradients
    //  TODO: check special gradients!!!
    let gradientStyles = {};
    let counterLinear = 0;
    let counterRadial = 0;
    let counterAngular = 0;
    for (const sharedStyle of layerStyles) {
        let fills = sharedStyle.style.fills;

        let counter = 1;

        for (const fill of fills) {
            if (fill.fillType === "Gradient") {
                let currentGradient = {};
                let gradientType = fill.gradient.gradientType;
                if (gradientType === "Linear") {
                    counterLinear++;
                    counter = counterLinear;
                } else if (gradientType === "Radial") {
                    counterRadial++;
                    counter = counterRadial;
                } else {
                    counterAngular++;
                    counter = counterAngular;
                }
                let currentGradientName =
                    "Gradient-" + gradientType + separator + counter.toString();

                currentGradient = setGradientDetails(
                    currentGradient,
                    fill,
                    gradientType,
                    variablePrefix
                );
                let gradientStylesCheck = {};
                createCouples(
                    gradientStylesCheck,
                    currentGradient,
                    currentGradientName,
                    "",
                    0
                );

                if (!checkToken(currentGradient, gradientStyles)) {
                    createCouples(
                        gradientStyles,
                        currentGradient,
                        currentGradientName,
                        "",
                        0
                    );
                    gradients.push([currentGradientName, currentGradient]);
                }
            }
        }
    }
    // #endregion

    // reset generic variables
    result = "";

    for (const sharedStyle of layerStyles) {
        let currentStyle = sharedStyle.name;

        let styleColors = {};
        let styleBorderColors = {};
        let styleBorderPosition = {};
        let styleBorderSize = {};
        let styleShadowToken = false;
        let styleShadow = {};
        let styleInnerShadows = {};

        // #region Fills check
        let fills = sharedStyle.style.fills;
        let counter = 1;
        for (const fill of fills) {
            let fillType = fill.fillType;

            let fillGradientStyles = {};
            if (fill.enabled === true) {
                let fillCount = "";
                if (counter > 1) {
                    fillCount = counter.toString();
                }
                // #region fill monochrome
                if (fillType === "Color") {
                    let color = fill.color;
                    let currentColor = setColor(color, "rgba");
                    if (checkColor(colors, currentColor)) {
                        styleColors["background" + fillCount + "-color"] = {
                            value: variablePrefix + getColor(colors, currentColor),
                        };
                    } else {
                        styleColors["background" + fillCount + "-color"] = {
                            value: currentColor,
                        };
                    }
                }
                // #endregion

                // #region fill gradient
                if (fillType === "Gradient") {
                    let currentGradient = {};
                    let gradientType = fill.gradient.gradientType;
                    let gradientName = gradientTypeValue[gradientType];
                    currentGradient = setGradientDetails(
                        currentGradient,
                        fill,
                        gradientType,
                        variablePrefix
                    );

                    let currentGradientName =
                        "Gradient-" +
                        gradientType +
                        separator +
                        counter.toString();
                    for (const [key, value] of Object.entries(gradientStyles)) {
                        let gradientName = key;
                        let gradient = value;
                        if (
                            isDeepStrictEqual(currentGradient, gradient) &&
                            gradientName.includes(currentGradientName)
                        ) {
                            styleColors["background" + fillCount + "-color"] = {
                                value: variablePrefix + gradientName,
                            };
                        }
                    }
                }
                // #endregion

                // #region fill image
                if (fillType === "Pattern") {
                    // console.log(style.name)
                    // console.log(fill.image)
                    let patternType = fill.pattern.patternType;
                    let patternScale = fill.pattern.tileScale;

                    styleColors["background-position"] = { value: "center" };
                    if (patternType === "tile" && patternScale !== 1) {
                        styleColors["background-size"] = {
                            value: (patternScale * 100).toString() + "%",
                        };
                    } else if (patternType === "stretch") {
                        styleColors["background-size"] = { value: "cover" };
                    } else if (patternType === "fit") {
                        styleColors["background-size"] = { value: "contain" };
                    }
                    if (fill.patternFillType === 0) {
                        styleColors["background-repeat"] = { value: "repeat" };
                    } else {
                        styleColors["background-repeat"] = {
                            value: "no-repeat",
                        };
                    }

                    // TODO Find Image name!!!
                    styleColors["background-image"] = {
                        value: "Image",
                    };
                }
                // #endregion
                counter++;
            }
        }
        // #endregion

        // reset generic variables
        counter = 1;
        result = "";

        // #region Borders check
        let borders = sharedStyle.style.borders;
        for (const border of borders) {
            if (border.enabled === true) {
                let fillCount = "";
                if (counter > 1) {
                    fillCount = counter.toString();
                }
                // Colors
                let color = border.color;
                let currentColor = setColor(color, "rgba");

                if (checkColor(colors, currentColor)) {
                    styleBorderColors["border" + fillCount + "-color"] = {
                        value: variablePrefix + getColor(colors, currentColor),
                    };
                } else {
                    styleBorderColors["border" + fillCount + "-color"] = {
                        value: currentColor,
                    };
                }

                // Position
                let currentBorderPosition = border.position.toLowerCase();
                createCouples(
                    borderPositions, { value: currentBorderPosition },
                    "border-position",
                    currentBorderPosition
                );
                styleBorderPosition["border" + fillCount + "-position"] = {
                    value: variablePrefix +
                        "border-position-" +
                        currentBorderPosition,
                };

                // Size
                styleBorderSize["border" + fillCount + "-size"] = {
                    value: border.thickness.toString() + "px",
                };

                counter++;
            }
        }
        // #endregion

        // reset generic variables
        counter = 1;
        result = "";

        // #region Shadows check
        let shadows = sharedStyle.style.shadows;
        for (const shadow of shadows) {
            if (shadow.enabled === true) {
                let currentShadow = {};
                let shadowCount = "";
                if (counter > 1) {
                    shadowCount = "-" + counter.toString();
                }

                setShadowDetails(currentShadow, shadow, "shadow");

                if (checkShadows(externalShadows, currentShadow)) {
                    styleShadow["shadow" + shadowCount] = {
                        value: variablePrefix +
                            getShadow(externalShadows, currentShadow),
                    };
                }

                counter++;
            }
        }
        // #endregion

        // reset generic variables
        counter = 1;
        result = "";

        // #region Inner Shadows check
        let innerShadows = sharedStyle.style.innerShadows;
        for (const shadow of innerShadows) {
            if (shadow.enabled === true) {
                let currentShadow = {};
                let shadowCount = "";
                if (counter > 1) {
                    shadowCount = counter.toString();
                }

                setShadowDetails(currentShadow, shadow, "inner-shadow");

                if (checkShadows(internalShadows, currentShadow)) {
                    styleShadow["inner-shadow" + shadowCount] =
                        variablePrefix +
                        getShadow(internalShadows, currentShadow);
                }

                counter++;
            }
        }
        // #endregion

        // reset generic variables
        counter = 1;
        result = "";

        // manage the entire layer style
        layerStylesTokensList = Object.assign(
            styleColors,
            styleBorderColors,
            styleBorderPosition,
            styleBorderSize,
            styleShadow,
            styleInnerShadows
        );

        if (currentStyle.indexOf("/") > -1) {
            createNestedObject(
                layerStyleTokens,
                currentStyle.split("/"),
                layerStylesTokensList
            );
        } else {
            layerStyleTokens[currentStyle] = layerStylesTokensList;
        }
    }
    // #endregion

    // #region Text Styles
    const textStyles = document.sharedTextStyles;
    const arrayTextStyleIDs = textStyles.map(
        (sharedstyle) => sharedstyle["id"]
    );
    const arrayTextStyleNames = textStyles.map(
        (sharedstyle) => sharedstyle["name"]
    );
    const arrayTextStyleStyles = textStyles.map(
        (sharedstyle) => sharedstyle["style"]
    );
    const textStylesOrdered = [...document.sharedTextStyles].sort(
        (left, right) => left.name > right.name
    );
    const textString = JSON.stringify(textStylesOrdered);

    const textDecorationsOptions = ["none", "underline", "strikethrough"];

    const textCasesOptions = ["none", "uppercase", "lowercase", "capitalize"];

    const textAlignmentOptions = ["left", "right", "center"];

    let fonts = {};

    let fontSize = {};
    let fontWeight = {};
    let fontAlignment = {};
    let fontVAlignment = {};
    let fontKerning = {};
    let fontLineHeight = {};
    let fontParagraphSpacing = {};
    let textTransform = {};
    let fontAxes = {};

    let textStylesTokensList = {};
    let textStyleTokens = {};

    let textStylesComplete = false;

    // #region Font Sizes tokens (because of ordering)
    // future options: add XS-S-M-L-XL...as an option
    let sizeValues = [];
    for (const textStyleForSize of textStyles) {
        let size = textStyleForSize.style.fontSize;
        if (sizeValues.length > 0) {
            if (sizeValues.indexOf(size) > -1) {} else {
                sizeValues.push(size);
            }
        } else {
            sizeValues.push(size);
        }
    }
    if (sizeValues.length > 0) {
        sizeValues = sizeValues.sort(function(a, b) {
            return a - b;
        });
        for (let i = 0; i < sizeValues.length; i++) {
            let counter = i + 1;
            createCouples(
                fontSize, { value: sizeValues[i] },
                "font-size",
                counter.toString()
            );
            let fontSizeName = "font-size-" + counter.toString();
            fontSizes.push([fontSizeName, sizeValues[i]]);
        }
    }
    // #endregion

    // Check and list all the variants
    let counter = 1;
    for (const textStyle of textStyles) {
        let fontFamily = [];
        let styleFontFamily = {};
        let styleFontFamilyName = {};
        let styleFontSize = {};
        let styleFontForcedStyle;
        let styleFontColor = {};
        let styleFontWeight = {};
        let styleFontAlignment;
        let styleFontVAlignment;
        let styleFontKerning;
        let styleFontLineHeight;
        let styleFontParagraphSpacing;
        let styleTextTransform;
        let styleFontAxes;

        let currentStyle = textStyle.name;

        // #region Font Family
        let currentStyleFont = textStyle.style.fontFamily;
        let currentStyleFontKey = currentStyleFont.toLowerCase();
        if (currentStyleFont.indexOf(" ") > -1) {
            if (currentStyleFont.indexOf(separator) > -1) {
                currentStyleFontKey = currentStyleFont
                    .replaceAll(" ", "")
                    .toLowerCase();
            } else {
                currentStyleFontKey = currentStyleFont
                    .replaceAll(" ", separator)
                    .toLowerCase();
            }
        }
        fontFamily = currentStyleFont.split("-");
        createCouples(
            fonts, { value: currentStyleFont },
            "font-family",
            currentStyleFontKey
        );
        styleFontFamily["font-family"] = {
            value: variablePrefix + "font-family-" + currentStyleFontKey,
        };
        // styleFontFamilyName["font-family-name"] = { value: fontFamily[0] };
        // #endregion

        // #region Font Size
        let currentStyleFontSize = textStyle.style.fontSize;
        styleFontSize = {
            fontSize: {
                value: variablePrefix +
                    getFontSize(fontSizes, currentStyleFontSize),
            },
        };
        // #endregion

        // #region Font Color
        let currentStyleFontColor = textStyle.style.textColor;
        let currentColor = setColor(currentStyleFontColor, "rgba");
        // If the color already exist as a Color Variable, it should not be added
        if (checkColor(colors, currentColor)) {
            styleFontColor["text-color"] = {
                value: variablePrefix + getColor(colors, currentColor),
            };
        } else {
            createCouples(
                colorTokens, { value: currentColor },
                "color",
                counter.toString()
            );
            colors.push(["color" + counter.toString(), currentColor]);
            styleFontColor["text-color"] = {
                value: variablePrefix + getColor(colors, currentColor),
            };
            counter++;
        }
        // #endregion

        // #region Font Weight
        let currentStyleFontWeight = textStyle.style.fontWeight * 100;
        // if (fontFamily[1] !== undefined) {
        //     styleFontWeight["font-weight"] = { value: fontFamily[1] };
        // } else {
        //     styleFontWeight["font-weight"] = { value: currentStyleFontWeight };
        // }

        createCouples(
            fontWeight, { value: currentStyleFontWeight },
            "font-weight",
            currentStyleFontWeight.toString()
        );
        styleFontWeight["font-weight"] = {
            value: variablePrefix + "font-weight-" + currentStyleFontWeight,
        };
        // #endregion

        // #region Text Alignment
        if (textStyle.style.alignment !== undefined) {
            let currentStyleFontAlignment = textStyle.style.alignment;
            createCouples(
                fontAlignment,
                currentStyleFontAlignment,
                "text-align",
                currentStyleFontAlignment
            );
            styleFontAlignment = setStyleToken(
                fontAlignment,
                currentStyleFontAlignment,
                "text-align",
                variablePrefix
            );
        } else {
            createCouples(fontAlignment, "left", "text-align", "left");
            styleFontAlignment = setStyleToken(
                fontAlignment,
                "left",
                "text-align",
                variablePrefix
            );
        }
        // #endregion

        // #region Other text parameters
        // // Text Vertical Alignment
        // let currentStyleFontVAlignment = textStyle.verticalAlignment
        // createCouples(
        //   fontVAlignment,
        //   currentStyleFontVAlignment,
        //   'text-valign',
        //   currentStyleFontVAlignment
        // )
        // styleFontVAlignment = setStyleToken(
        //   fontVAlignment,
        //   currentStyleFontVAlignment,
        //   'text-valign'
        // )
        // // Text Kerning
        // let currentStyleFontKerning = textStyle.kerning
        // if (textStylesComplete) {
        //   createCouples(
        //     fontKerning,
        //     currentStyleFontKerning,
        //     'text-kerning',
        //     currentStyleFontKerning
        //   )
        // }
        // styleFontKerning = setStyleToken(
        //   fontKerning,
        //   currentStyleFontKerning,
        //   'text-kerning'
        // )
        // // Text Line Height
        // let currentStyleFontLineHeight = textStyle.lineHeight
        // if (textStylesComplete) {
        //   createCouples(
        //     fontLineHeight,
        //     currentStyleFontLineHeight,
        //     'text-line-height',
        //     currentStyleFontLineHeight
        //   )
        // }
        // styleFontLineHeight = setStyleToken(
        //   fontLineHeight,
        //   currentStyleFontLineHeight,
        //   'text-line-height'
        // )
        // // Text Paragraph Spacing
        // let currentStyleFontParagraphSpacing =
        //   textStyle.paragraphSpacing
        // if (textStylesComplete) {
        //   createCouples(
        //     fontParagraphSpacing,
        //     currentStyleFontParagraphSpacing,
        //     'text-paragraph',
        //     currentStyleFontParagraphSpacing
        //   )
        // }
        // styleFontParagraphSpacing = setStyleToken(
        //   fontParagraphSpacing,
        //   currentStyleFontParagraphSpacing,
        //   'text-paragraph'
        // )
        // // Text Transforma
        // let currentStyleTextTransform = textStyle.textTransform
        // if (textStylesComplete) {
        //   createCouples(
        //     textTransform,
        //     currentStyleTextTransform,
        //     'text-transform',
        //     currentStyleTextTransform
        //   )
        // }
        // styleTextTransform = setStyleToken(
        //   textTransform,
        //   currentStyleTextTransform,
        //   'text-transform'
        // )
        // // Text Font Axes
        // let currentStyleFontAxes = textStyle.fontAxes
        // if (textStylesComplete) {
        //   createCouples(
        //     fontAxes,
        //     currentStyleFontAxes,
        //     'text-axes',
        //     currentStyleFontAxes
        //   )
        // }
        // styleFontAxes = setStyleToken(fontAxes, currentStyleFontAxes, 'text-axes')
        // #endregion

        // manage the entire text style
        textStylesTokensList = Object.assign(
            styleFontFamily,
            styleFontWeight,
            styleFontSize,
            styleFontColor,
            styleFontAlignment,
            styleFontVAlignment,
            styleFontKerning,
            styleFontLineHeight,
            styleFontParagraphSpacing,
            styleTextTransform,
            styleFontAxes
        );

        if (currentStyle.indexOf("/") > -1) {
            createNestedObject(
                textStyleTokens,
                currentStyle.split("/"),
                textStylesTokensList
            );
        } else {
            textStyleTokens[currentStyle] = textStylesTokensList;
        }
    }
    // #endregion

    // #region Create the final Object to be converted in a JSON file
    // 1. Order the Gradient Styles Descending by Key
    gradientStyles = Object.keys(gradientStyles)
        .sort()
        .reduce(function(result, key) {
            result[key] = gradientStyles[key];
            return result;
        }, {});

    // 2. Create the Object
    let colorsObj = { colors: colorTokens };
    let gradientObj = { gradients: gradientStyles };
    let shadowsObj = { shadows: shadowStyles };
    let innerShadowsObj = { "inner-shadows": innerShadowStyles };
    let fontsObj = { "font-families": fonts };
    let fontSizeObj = { "font-sizes": fontSize };
    let fontWeightObj = { "font-weights": fontWeight };
    let fontAlignmentObj = { "text-alignments": fontAlignment };
    let fontVAlignmentObj = {};
    let fontKerningObj = {};
    let fontLineHeightObj = {};
    let fontParagraphSpacingObj = {};
    let textTransformObj = {};
    let fontAxesObj = {};
    let borderPositionsObj = { "border-positions": borderPositions };
    if (textStylesComplete) {
        fontKerningObj = { "text-kernings": fontKerning };
        fontLineHeightObj = { "text-line-heights": fontLineHeight };
        fontParagraphSpacingObj = {
            "text-paragraph-spacings": fontParagraphSpacing,
        };
        textTransformObj = { "text-transforms": textTransform };
        fontAxesObj = { "text-axes": fontAxes };
    }
    let layerStylesObj = { "layer-styles": layerStyleTokens };
    let textStylesObj = { "text-styles": textStyleTokens };

    designTokensList = Object.assign(
        colorsObj,
        gradientObj,
        shadowsObj,
        innerShadowsObj,
        fontsObj,
        fontSizeObj,
        fontWeightObj,
        fontAlignmentObj,
        fontVAlignmentObj,
        fontKerningObj,
        fontLineHeightObj,
        fontParagraphSpacingObj,
        textTransformObj,
        fontAxesObj,
        borderPositionsObj,
        layerStylesObj,
        textStylesObj
    );

    // #endregion

    if (Object.keys(designTokensList).length > 0) {
        //if (fonts.length > 0) {
        delete designTokensList[keyToDelete];
    }

    let json = JSON.stringify(designTokensList, null, 2);
    // Finally, store the color information in a `colors.json` file:
    try {
        fs.writeFileSync(desktopDir + "/design-tokens.json", json);
        sketch.UI.message("✅ Design Tokens extraction complete");
    } catch (error) {
        sketch.UI.message(
            "⛔️ There was an error writing your file on Desktop"
        );
    }
    // sketch.UI.message("It's alive 🙌");
}

// **************************************
// Script functions

function checkToken(object, currentItem) {
    let check = false;
    if (Object.keys(object).length > 0) {
        if (Object.values(object).indexOf(currentItem) > -1) {
            check = true;
        }
    }
    return check;
}

function checkColor(array, currentItem) {
    for (let i = 0; i < array.length; i++) {
        if (isDeepStrictEqual(array[i][1], currentItem)) {
            return true;
        }
    }
}

function getColor(array, currentItem) {
    for (let i = 0; i < array.length; i++) {
        if (isDeepStrictEqual(array[i][1], currentItem)) {
            return array[i][0];
        }
    }
}

function setColor(swatch, type = "hex") {
    if (type === "hex") {
        let swatchColorHEX = swatch;
        return swatchColorHEX;
    } else {
        let swatchColorRGBA = hexAToRGBA(swatch);
        // console.log(JSON.stringify(swatchColorRGBA, null, 1));
        return swatchColorRGBA;
    }
}

function checkShadows(array, currentItem) {
    for (let i = 0; i < array.length; i++) {
        if (isDeepStrictEqual(array[i][1], currentItem)) {
            return true;
        }
    }
}

function getShadow(array, currentItem) {
    for (let i = 0; i < array.length; i++) {
        if (isDeepStrictEqual(array[i][1], currentItem)) {
            return array[i][0];
        }
    }
}

function getFontSize(array, currentItem) {
    for (let i = 0; i < array.length; i++) {
        if (isDeepStrictEqual(array[i][1], currentItem)) {
            return array[i][0];
        }
    }
}

function checkTokenValue(object, currentItem) {
    result = "";
    let check = false;

    if (Object.keys(object).length > 0) {
        for (var i in object) {
            if (isDeepStrictEqual(object[i], currentItem)) {
                check = true;
                return check;
            }
            if (object[i] !== null && typeof object[i] == "object") {
                //going one step down in the object tree!!
                checkToken(object[i], currentItem);
            }
        }
    }
}

function getKeyByValue(object, value, discard = "") {
    if (typeof value === "string") {
        value = value.replace(discard, "");
    }
    return Object.keys(object).find((key) => object[key] === value);
}

/**
 * Returns the key of an Object recurively deeping into nested objects
 */
function getKeyByValueRecursive(object, search, discard = "", checkValue = 0) {
    result = "";
    let objectLength = Object.keys(object).length;
    if (checkValue === 1) {
        console.log(search);
    }
    if (objectLength > 0) {
        for (let i in object) {
            let key = i;
            let value = object[i];

            if (checkValue === 1) {
                console.log(key);
                console.log(value);
            }

            if (isDeepStrictEqual(value, search)) {
                result = key;
            }

            if (object[i] !== null && typeof object[i] == "object") {
                getKeyByValueRecursive(object[i], search, discard);
            }
        }
    }
}

function createCouples(
    object,
    currentItem,
    name = "",
    i = "",
    suffixNeeded = 1
) {
    // if null we need something different
    if (currentItem === null) {
        currentItem = "auto";
        i = "auto";
    }

    let suffix = "-" + i;
    if (suffixNeeded === 0) {
        suffix = "";
    }
    let keyName = name + suffix;
    if (Object.keys(object).length > 0) {
        if (Object.values(object).indexOf(currentItem) > -1) {
            // This item already exists
        } else {
            // This item is new
            object[keyName] = currentItem;
        }
    } else {
        // This item is the first one I evaluate
        object[keyName] = currentItem;
    }
}

function setStyleToken(object, currentItem, key = "", prefix = "") {
    let token = {};
    if (checkToken(object, currentItem)) {
        token[key] = { value: prefix + getKeyByValue(object, currentItem) };
    } else {
        token[key] = { value: prefix + currentItem };
    }
    return token;
}

/**
 * Generate nested Objects by splitting a sting
 * Usages:
 * createNestedObject(window, ['shapes', 'circle'])
 *   Now window.shapes.circle is an empty object, ready to be used.
 * var object = {} // Works with any object other that window too
 * createNestedObject(object, ['shapes', 'rectangle', 'width'], 300)
 *   Now we have: object.shapes.rectangle.width === 300
 * createNestedObject(object, 'shapes.rectangle.height'.split('.'), 400)
 *   Now we have: object.shapes.rectangle.height === 400
 */
function createNestedObject(object, keys, value) {
    // If a value is given, remove the last name and keep it for later:
    var lastKey = arguments.length === 3 ? keys.pop() : false;
    // Walk the hierarchy, creating new objects where needed.
    // If the lastKey was removed, then the last object is not set yet:
    for (var i = 0; i < keys.length; i++) {
        object = object[keys[i]] = object[keys[i]] || {};
    }

    // If a value was given, set it to the last name:
    if (lastKey) object = object[lastKey] = value;

    // Return the last object in the hierarchy:
    return object;
}

function getKey(object, val) {
    Object.keys(object).find((key) => object[key] === val);
}

// Internal functions
// Set Shadows
function setShadowDetails(object, currentItem, shadowType = "") {
    let color = currentItem.color;
    let currentColor = setColor(color, "rgba");

    if (checkColor(colors, currentColor)) {
        object[shadowType + "-color"] = {
            value: variablePrefix + getColor(colors, currentColor),
        };
    } else {
        object[shadowType + "-color"] = { value: currentColor };
    }

    object[shadowType + "-blur-radius"] = { value: currentItem.blur };
    object[shadowType + "-offset-x"] = { value: currentItem.x };
    object[shadowType + "-offset-y"] = { value: currentItem.y };
    object[shadowType + "-spread"] = { value: currentItem.spread };

    return object;
}

// Set Gradients
function setGradientDetails(object, currentItem, type = 0, prefix = "") {
    let currentObject = {};
    let fill = currentItem;

    if (type === "Radial") {
        if (fill.gradient.aspectRatio > 0) {
            object["type"] = gradientCircleType[1];
        } else {
            object["type"] = gradientCircleType[0];
        }
    }
    let degree = Math.round(
        getAngleDeg(
            fill.gradient.from.x,
            fill.gradient.from.y,
            fill.gradient.to.x,
            fill.gradient.to.y
        )
    ).toString();
    currentObject["degree"] = { value: degree };

    let stops = fill.gradient.stops;
    let stopCounter = 1;
    let stopList = {};
    for (const stop of stops) {
        let currentStop = {};
        let stopName = stopCounter.toString();

        let color = stop.color;
        let currentColor = setColor(color, "rgba");

        let currentPosition = Math.round(stop.position * 100) / 100;

        if (checkColor(colors, currentColor)) {
            currentStop = Object.assign(currentStop, {
                color: { value: prefix + getColor(colors, currentColor) },
            });
        } else {
            currentStop = Object.assign(currentStop, {
                color: { value: currentColor },
            });
        }

        currentStop = Object.assign(currentStop, {
            position: { value: currentPosition },
        });
        createNestedObject(stopList, [stopName], currentStop);
        stopCounter++;
    }
    createCouples(currentObject, stopList, "stops", "", 0);
    return currentObject;
}

function getAngleDeg(ax, ay, bx, by) {
    var angleRad = Math.atan((ay - by) / (ax - bx));
    var angleDeg = (angleRad * 180) / Math.PI;

    return angleDeg;
}

function hexAToRGBA(hex) {
    let r = 0,
        g = 0,
        b = 0,
        a = 1;

    if (hex.length == 5) {
        r = "0x" + hex[1] + hex[1];
        g = "0x" + hex[2] + hex[2];
        b = "0x" + hex[3] + hex[3];
        a = "0x" + hex[4] + hex[4];
    } else if (hex.length == 9) {
        r = "0x" + hex[1] + hex[2];
        g = "0x" + hex[3] + hex[4];
        b = "0x" + hex[5] + hex[6];
        a = "0x" + hex[7] + hex[8];
    }
    a = +(a / 255).toFixed(3);

    return "rgba(" + +r + ", " + +g + ", " + +b + ", " + a + ")";
}