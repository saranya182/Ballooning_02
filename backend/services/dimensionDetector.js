/**
 * dimensionDetector.js
 *
 * Responsible for identifying possible dimension/characteristic
 * candidates from OCR results.
 *
 * IMPORTANT:
 * This service does NOT assign balloon numbers.
 * Balloon numbering is handled separately by balloonNumbering.js.
 */

const DIMENSION_PATTERNS = [
    // Normal dimensions
    /^\d+(?:\.\d+)?$/,

    // Dimension with tolerance
    /^\d+(?:\.\d+)?\s*[±+\-]\s*\d+(?:\.\d+)?$/,

    // Diameter
    /^Ø\s*\d+(?:\.\d+)?/i,

    // Radius
    /^R\s*\d+(?:\.\d+)?/i,

    // Angles
    /^\d+(?:\.\d+)?°/,

    // Thread dimensions
    /^M\d+(?:\.\d+)?/i,

    // Common hole/thread notation
    /^\d+\s*x\s*Ø/i,

    // Chamfer
    /^\d+(?:\.\d+)?\s*x\s*\d+(?:\.\d+)?/i,

    // Depth
    /^\d+(?:\.\d+)?\s*(?:DEEP|DEPTH)$/i
];


/**
 * Normalize OCR text.
 */
function normalizeText(text) {
    if (!text) return '';

    return String(text)
        .replace(/\s+/g, ' ')
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .trim();
}


/**
 * Check whether OCR text looks like a dimension.
 */
function looksLikeDimension(text) {
    const value = normalizeText(text);

    if (!value) return false;

    return DIMENSION_PATTERNS.some(pattern => pattern.test(value));
}


/**
 * Determine dimension type.
 */
function detectDimensionType(text) {
    const value = normalizeText(text);

    if (/^Ø/i.test(value)) {
        return 'Diameter';
    }

    if (/^R/i.test(value)) {
        return 'Radius';
    }

    if (/°/.test(value)) {
        return 'Angle';
    }

    if (/^M\d/i.test(value)) {
        return 'Thread';
    }

    if (/x/i.test(value) && /Ø/i.test(value)) {
        return 'Hole';
    }

    if (/±/.test(value) || /[+-]\s*\d/.test(value)) {
        return 'Dimension';
    }

    return 'Dimension';
}


/**
 * Convert OCR candidates into dimension candidates.
 *
 * Expected OCR input:
 *
 * [
 *   {
 *      text: "16 ±0.1",
 *      x: 120,
 *      y: 250,
 *      width: 50,
 *      height: 20,
 *      page: 1,
 *      confidence: 0.95
 *   }
 * ]
 */
function detectDimensions(ocrResults = []) {
    if (!Array.isArray(ocrResults)) {
        throw new TypeError('ocrResults must be an array');
    }

    const dimensions = [];

    for (const item of ocrResults) {
        if (!item) continue;

        const text = normalizeText(
            item.text ??
            item.value ??
            item.content ??
            ''
        );

        if (!text) continue;

        if (!looksLikeDimension(text)) {
            continue;
        }

        const confidence = Number(
            item.confidence ??
            item.score ??
            0
        );

        dimensions.push({
            text,

            type: detectDimensionType(text),

            page: Number(item.page ?? 1),

            x: Number(item.x ?? item.left ?? 0),
            y: Number(item.y ?? item.top ?? 0),

            width: Number(item.width ?? 0),
            height: Number(item.height ?? 0),

            confidence: Number.isFinite(confidence)
                ? confidence
                : 0
        });
    }

    return dimensions;
}


/**
 * Sort dimensions in a predictable drawing order.
 *
 * We use:
 *   page
 *   then Y position
 *   then X position
 *
 * This helps make balloon numbering deterministic.
 */
function sortDimensions(dimensions = []) {
    return [...dimensions].sort((a, b) => {
        if (a.page !== b.page) {
            return a.page - b.page;
        }

        const yDifference = a.y - b.y;

        if (Math.abs(yDifference) > 10) {
            return yDifference;
        }

        return a.x - b.x;
    });
}


export {
    normalizeText,
    looksLikeDimension,
    detectDimensionType,
    detectDimensions,
    sortDimensions
};