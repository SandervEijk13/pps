/**
 * Cardmarket display price (EUR), aligned with cards.js / sets collection.
 * @param {object | null} card - TCGdex card with optional `pricing.cardmarket`
 * @returns {string | null} e.g. "€12.34" or null if no usable price
 */
export function getDisplayPriceLabel(card) {
    if (!card?.pricing?.cardmarket) return null;

    const cm = card.pricing.cardmarket;
    const candidates = [
        cm.lowPrice,
        cm.trendPrice,
        cm.avg1,
        cm.avg7,
        cm.avg30,
        cm.reverseHoloLow,
        cm.reverseHoloTrend,
        cm.reverseHoloAvg1,
        cm.reverseHoloAvg7,
        cm.reverseHoloAvg30
    ];

    const valid = candidates.filter(
        (p) => typeof p === 'number' && !Number.isNaN(p) && p > 0
    );
    if (!valid.length) return null;

    const rarity = String(card.rarity || '').toLowerCase();
    let selected;
    if (rarity.includes('common') || rarity.includes('uncommon')) {
        selected = Math.min(...valid);
    } else if (rarity.includes('rare')) {
        selected = Math.max(...valid);
    } else {
        selected = cm.trendPrice && valid.includes(cm.trendPrice) ? cm.trendPrice : valid[0];
    }

    return `€${Number(selected).toFixed(2)}`;
}
