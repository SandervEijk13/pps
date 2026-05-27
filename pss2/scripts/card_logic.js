import TCGdex from '@tcgdex/sdk';

const tcgdex = new TCGdex('en');

/* -------------------------
   BASIC HELPERS
--------------------------*/

function random(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function pickUnique(arr, count) {
    const copy = [...arr];
    const result = [];

    for (let i = 0; i < count && copy.length; i++) {
        const index = Math.floor(Math.random() * copy.length);
        result.push(copy.splice(index, 1)[0]);
    }

    return result;
}

/* -------------------------
   CARD CLASSIFICATION
--------------------------*/

function isEnergy(card) {
    return card.supertype === 'Energy' || card.category === 'Energy';
}

function isRarePlus(card) {
    const r = (card.rarity || '').toLowerCase();
    return /rare|holo|v|vmax|vstar|ex|gx|illustration|secret|gold|rainbow|ultra/.test(r);
}

/* -------------------------
   PRICE EXTRACTOR (SAFE)
--------------------------*/

function extractPricing(card) {
    const pricing = card.pricing;

    if (!pricing) return null;

    return {
        cardmarket: pricing.cardmarket || null,
        tcgplayer: pricing.tcgplayer || null
    };
}

/* -------------------------
   CORE PACK GENERATOR
--------------------------*/

export async function openPack(setCode) {
    const set = await tcgdex.set.get(setCode);

    const cards = await Promise.all(
        set.cards.map(c => c.getCard())
    );

    /* -------------------------
       SPLIT POOLS
    --------------------------*/

    const normalPool = cards.filter(c => !isEnergy(c) && !isRarePlus(c));
    const rarePool = cards.filter(isRarePlus);
    const energyPool = cards.filter(c => isEnergy(c) && !isRarePlus(c));

    /* -------------------------
       ENERGY SLOT RULE
    --------------------------*/

    const energyCard = energyPool.length ? random(energyPool) : null;

    /* -------------------------
       MAIN SLOTS
       - 8 cards if energy exists
       - 9 cards if no energy
    --------------------------*/

    const commonCount = energyCard ? 8 : 9;
    const commons = pickUnique(normalPool, commonCount);

    /* -------------------------
       RARE SLOT (guaranteed)
    --------------------------*/

    const rareCard = rarePool.length ? random(rarePool) : random(cards);

    /* -------------------------
       FINAL PACK (FLAT ARRAY)
       ready for UI rendering
    --------------------------*/

    const pack = [
        ...commons,
        ...(energyCard ? [energyCard] : []),
        rareCard
    ].filter(Boolean);

    /* -------------------------
       ATTACH PRICING DATA
       (so UI can directly use it)
    --------------------------*/

    return pack.map(card => ({
        id: card.id,
        name: card.name,
        rarity: card.rarity || 'Unknown',
        image: card.image + "/high.webp",
        set: {
            id: card.set?.id,
            name: card.set?.name,
            code: card.set?.code
        },
        pricing: extractPricing(card)
    }));
}