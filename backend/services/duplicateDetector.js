/**
 * duplicateDetector.js
 *
 * Removes duplicate OCR detections.
 *
 * A drawing can contain the same dimension multiple times because:
 *
 * - OCR may detect the same text more than once
 * - PDF rendering can produce overlapping OCR regions
 * - Dimension text may be detected together with individual characters
 * - Multiple OCR passes may detect the same characteristic
 *
 * We therefore compare both:
 *
 * 1. Dimension text
 * 2. Location on the drawing
 */

function normalizeValue(value) {
    if (!value) return '';

    return String(value)
        .toUpperCase()
        .replace(/\s+/g, '')
        .replace(/[–—−]/g, '-')
        .trim();
}


/**
 * Calculate center point of a detection.
 */
function getCenter(item) {
    return {
        x: Number(item.x || 0) + Number(item.width || 0) / 2,
        y: Number(item.y || 0) + Number(item.height || 0) / 2
    };
}


/**
 * Calculate distance between two OCR boxes.
 */
function distanceBetween(a, b) {
    const p1 = getCenter(a);
    const p2 = getCenter(b);

    return Math.sqrt(
        Math.pow(p1.x - p2.x, 2) +
        Math.pow(p1.y - p2.y, 2)
    );
}


/**
 * Determine whether two detections represent the same
 * characteristic.
 */
function isDuplicate(a, b, options = {}) {
    const {
        positionTolerance = 25
    } = options;

    // Different pages cannot be duplicates.
    if (Number(a.page || 1) !== Number(b.page || 1)) {
        return false;
    }

    const valueA = normalizeValue(
        a.text ?? a.value
    );

    const valueB = normalizeValue(
        b.text ?? b.value
    );

    // Different values are normally different characteristics.
    if (!valueA || !valueB || valueA !== valueB) {
        return false;
    }

    const distance = distanceBetween(a, b);

    return distance <= positionTolerance;
}


/**
 * Remove duplicate detections.
 *
 * When two detections represent the same characteristic,
 * keep the one with the higher OCR confidence.
 */
function removeDuplicates(dimensions = [], options = {}) {
    const result = [];

    const sorted = [...dimensions].sort(
        (a, b) =>
            Number(b.confidence || 0) -
            Number(a.confidence || 0)
    );

    for (const current of sorted) {

        const duplicate = result.some(existing =>
            isDuplicate(current, existing, options)
        );

        if (!duplicate) {
            result.push(current);
        }
    }

    // Return drawing order after duplicate removal.
    return result.sort((a, b) => {

        if (Number(a.page || 1) !== Number(b.page || 1)) {
            return Number(a.page || 1) - Number(b.page || 1);
        }

        if (Math.abs(
            Number(a.y || 0) - Number(b.y || 0)
        ) > 10) {
            return Number(a.y || 0) - Number(b.y || 0);
        }

        return Number(a.x || 0) - Number(b.x || 0);
    });
}


export {
    normalizeValue,
    getCenter,
    distanceBetween,
    isDuplicate,
    removeDuplicates
};