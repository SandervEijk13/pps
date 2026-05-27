import TCGdex from '@tcgdex/sdk';
import MemoryCache from '@cachex/memory';

const tcgdex = new TCGdex('en');
tcgdex.setCache(new MemoryCache());

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

export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/** Wacht tot afbeeldingen geladen zijn (voor reel/preview) */
export function preloadImageUrls(urls) {
    const unique = [...new Set((urls || []).filter(Boolean))];

    return Promise.all(unique.map(url => new Promise(resolve => {
        const img = new Image();
        let done = false;

        const finish = () => {
            if (done) return;
            done = true;
            resolve();
        };

        img.onload = finish;
        img.onerror = finish;
        img.src = url;
        setTimeout(finish, 8000);
    })));
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
   RARITY TIER CLASSIFICATION
   (for weighted rare selection)
--------------------------*/

function getRarityTier(rarity) {
    if (!rarity) return null;
    const r = rarity.toLowerCase();

    // Chase tier (rarest)
    if (r.includes('special illustration rare') ||
        r.includes('secret rare') ||
        r.includes('mega hyper rare')) {
        return 'chase';
    }

    // Ultra tier
    if (r.includes('rare holo lv.x') ||
        r.includes('legend') ||
        r.includes('rare prime') ||
        r.includes('rainbow rare') ||
        r.includes('amazing rare') ||
        r.includes('gold rare') ||
        r.includes('radiant rare')) {
        return 'ultra';
    }

    // Mid tier (moderne hoge rarities — vóór generieke "rare" check)
    if (r.includes('vmax') ||
        r.includes('vstar') ||
        r.includes('double rare') ||
        r.includes('illustration rare') ||
        r.includes('ultra rare') ||
        r.includes('hyper rare') ||
        r.includes('shiny rare') ||
        r.includes('ace spec')) {
        return 'mid';
    }

    // Rare tier (standaard rare holo's)
    if (r.includes('holo rare v') ||
        r.includes('rare holo') ||
        r.includes('holo rare') ||
        r.includes('rare')) {
        return 'rare';
    }

    // Fallback for any other rarity that somehow passed isRarePlus
    return 'rare';
}

/* -------------------------
   WEIGHTED RANDOM SELECTOR
--------------------------*/

const TIER_WEIGHTS = {
    rare: 100,
    mid: 30,
    ultra: 10,
    chase: 3
};

function weightedRandomPick(tierMap) {
    const availableTiers = [];

    for (const [tier, cards] of Object.entries(tierMap)) {
        if (cards.length > 0) {
            availableTiers.push(tier);
        }
    }

    if (availableTiers.length === 0) return null;

    let totalWeight = 0;
    for (const tier of availableTiers) {
        totalWeight += TIER_WEIGHTS[tier];
    }

    let randomWeight = Math.random() * totalWeight;
    let selectedTier = null;

    for (const tier of availableTiers) {
        randomWeight -= TIER_WEIGHTS[tier];
        if (randomWeight <= 0) {
            selectedTier = tier;
            break;
        }
    }

    const tierCards = tierMap[selectedTier];
    return random(tierCards);
}

function groupRarePoolByTier(cards) {
    const tierMap = { rare: [], mid: [], ultra: [], chase: [] };

    for (const card of cards) {
        const tier = getRarityTier(card.rarity);
        if (tierMap[tier]) {
            tierMap[tier].push(card);
        } else {
            tierMap.rare.push(card);
        }
    }

    return tierMap;
}

function pickWeightedRare(cards) {
    if (!cards.length) return null;

    const tierMap = groupRarePoolByTier(cards);
    const picked = weightedRandomPick(tierMap);

    return picked || random(cards);
}

/* -------------------------
   REEL OPENER HELPERS
--------------------------*/

function getReelPackTier(card) {
    if (isEnergy(card)) return null;
    if (!isRarePlus(card)) return 'basic';

    const tier = getRarityTier(card.rarity);

    if (tier === 'rare') return 'rare';
    if (tier === 'mid' || tier === 'ultra' || tier === 'chase') return 'elite';

    return 'rare';
}

function reelRarityClass(card) {
    const tier = getRarityTier(card.rarity);

    if (tier === 'chase' || tier === 'ultra') return 'legendary';
    if (tier === 'mid') return 'epic';
    if (tier === 'rare') return 'rare';
    if (/uncommon/i.test(card.rarity || '')) return 'rare';

    return 'common';
}

function getCardImage(card, setCode) {
    if (card.getImageURL) {
        return card.getImageURL('high', 'webp');
    }

    if (card.image) {
        if (card.image.startsWith('http')) {
            return card.image.includes('.webp') ? card.image : `${card.image}/high.webp`;
        }
        return `https://assets.tcgdex.net${card.image}/high.webp`;
    }

    const code = card.set?.id || setCode;
    const localId = card.localId || card.number;
    return `https://assets.tcgdex.net/en/${code}/${localId}/high.webp`;
}

/* -------------------------
   PRICE (verkrijgbaar / markt)
--------------------------*/

const MIN_OBTAINABLE_PRICE = 0;
const MAX_OBTAINABLE_PRICE = 1_000_000;
const PACK_POOL_SIZE = 50;
const ELITE_PACK_POOL_SIZE = 80;
const MAX_SETS_TO_SCAN = 36;
const SET_LOAD_DELAY_MS = 300;
const CARD_BATCH_SIZE = 15;
const CARD_BATCH_DELAY_MS = 120;

function extractPricing(card) {
    const pricing = card.pricing;

    if (!pricing) return null;

    return {
        cardmarket: pricing.cardmarket || null,
        tcgplayer: pricing.tcgplayer || null
    };
}

/** Euro prijs voor loot/filter (zelfde logica als cards.js) */
export function getCardMarketPrice(card) {
    const p = card.pricing?.cardmarket;
    if (!p) return null;

    const values = [p.low, p.trend, p.avg1, p.avg7, p.avg30]
        .filter(v => typeof v === 'number' && v >= 0);

    if (!values.length) return null;

    return isRarePlus(card) ? Math.max(...values) : Math.min(...values);
}

/** Altijd 2 decimalen voor prijzen/coins */
export function roundTo2(value) {
    return Math.round(Number(value) * 100) / 100;
}

export function formatCardPrice(cardOrItem) {
    const price = typeof cardOrItem?.price === 'number'
        ? cardOrItem.price
        : getCardMarketPrice(cardOrItem);

    if (price === null || price === undefined) return 'Geen prijs';
    return `€${roundTo2(price).toFixed(2)}`;
}

/** Verkoopbedrag: 80% van kaartwaarde, afgerond op 2 decimalen */
export function getSellCoinsAmount(cardPrice) {
    if (cardPrice == null || cardPrice <= 0) return 0;
    return roundTo2(cardPrice * 0.8);
}

export function formatCoinsAmount(amount) {
    if (amount == null || !Number.isFinite(Number(amount))) return '0.00 coins';
    return `${roundTo2(amount).toFixed(2)} coins`;
}

/** Header coin-widget */
export function formatHeaderCoins(amount) {
    if (amount == null || !Number.isFinite(Number(amount))) return '0.00';
    return roundTo2(amount).toFixed(2);
}

function isObtainable(card) {
    if (isEnergy(card)) return false;

    const price = getCardMarketPrice(card);
    if (price === null) return false;

    return price >= MIN_OBTAINABLE_PRICE && price <= MAX_OBTAINABLE_PRICE;
}

function cardToReelItem(card) {
    const setCode = card.set?.id || '';
    const tier = getRarityTier(card.rarity);
    const dropChance = tier && TIER_WEIGHTS[tier] ? TIER_WEIGHTS[tier] : 1;
    const rawPrice = getCardMarketPrice(card);
    const price = rawPrice != null ? roundTo2(rawPrice) : null;

    return {
        id: card.id,
        name: card.name,
        image: getCardImage(card, setCode),
        rarity: reelRarityClass(card),
        rarityLabel: card.rarity || 'Unknown',
        setName: card.set?.name || '',
        dropChance,
        price,
        priceLabel: formatCardPrice({ price })
    };
}

const PACK_CACHE_KEY = 'pss-fixed-crate-packs';
const PACK_CACHE_VERSION = 7;
/** Vaste packprijzen (coins) */
const PACK_PRICE_BY_TIER = {
    basic: 0.5,
    rare: 11
};
/** Ultra Rare: nog steeds gem. kaartprijs + bonus */
const PACK_BONUS_BY_TIER = {
    elite: 5
};

function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function seededRandom(seed) {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(1664525, s) + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

/** Zelfde 50 kaarten elke keer (vaste seed per pack-type) */
function pickUniqueDeterministic(pool, count, seedKey) {
    if (!pool.length) return [];

    const sorted = [...pool].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const rng = seededRandom(hashSeed(seedKey));
    const copy = [...sorted];

    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy.slice(0, Math.min(count, copy.length));
}

function getPackPoolSize(packTier) {
    return packTier === 'elite' ? ELITE_PACK_POOL_SIZE : PACK_POOL_SIZE;
}

/** Ultra Rare pack: eerst chase/ultra/mid, daarna overige elite-kaarten tot 80 */
function buildElitePackItems(allCards) {
    const pool = allCards.filter(c => getReelPackTier(c) === 'elite');
    if (!pool.length) return [];

    const tierMap = groupRarePoolByTier(pool);
    const highEnd = [...tierMap.chase, ...tierMap.ultra, ...tierMap.mid];
    const filler = tierMap.rare;

    const highPicked = pickUniqueDeterministic(
        highEnd,
        Math.min(highEnd.length, ELITE_PACK_POOL_SIZE),
        'pss-pack-elite-high-v2'
    );
    const slotsLeft = ELITE_PACK_POOL_SIZE - highPicked.length;
    const restPicked = slotsLeft > 0
        ? pickUniqueDeterministic(filler, slotsLeft, 'pss-pack-elite-rest-v2')
        : [];

    return [...highPicked, ...restPicked].map(c => cardToReelItem(c));
}

function buildFixedPackItems(allCards, packTier) {
    if (packTier === 'elite') return buildElitePackItems(allCards);

    const pool = allCards.filter(c => getReelPackTier(c) === packTier);
    const picked = pickUniqueDeterministic(pool, PACK_POOL_SIZE, `pss-pack-${packTier}-v1`);
    return picked.map(c => cardToReelItem(c));
}

/** Gemiddelde kaartprijs + bonus (alleen elite), afgerond op €X.00 */
export function packPriceFromItems(items, tier) {
    if (!items.length) return 0;

    const avg = items.reduce((sum, item) => sum + (item.price || 0), 0) / items.length;
    const bonus = PACK_BONUS_BY_TIER[tier] ?? 5;
    return roundTo2(Math.round(avg + bonus));
}

/** Packprijs in coins: vast voor basic/rare, berekend voor elite */
export function getPackPriceForTier(tier, items = []) {
    const fixed = PACK_PRICE_BY_TIER[tier];
    if (fixed != null) return roundTo2(fixed);
    return packPriceFromItems(items, tier);
}

function applyPackPricesToCrates(crates) {
    return crates.map((c) => ({
        ...c,
        price: getPackPriceForTier(c.tier, c.items)
    }));
}

function loadPackCache() {
    try {
        const raw = localStorage.getItem(PACK_CACHE_KEY);
        if (!raw) return null;

        const data = JSON.parse(raw);
        if (data.version !== PACK_CACHE_VERSION || !data.crates?.length) return null;

        return data;
    } catch {
        return null;
    }
}

function savePackCache(data) {
    localStorage.setItem(PACK_CACHE_KEY, JSON.stringify(data));
}

/** Wis cache om packs opnieuw te laten samenstellen */
export function clearPackCache() {
    localStorage.removeItem(PACK_CACHE_KEY);
}

function formatPackCard(card, setCode) {
    return {
        id: card.id,
        name: card.name,
        rarity: card.rarity || 'Unknown',
        image: getCardImage(card, setCode),
        set: {
            id: card.set?.id,
            name: card.set?.name,
            code: card.set?.code
        },
        pricing: extractPricing(card)
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

    const normalPool = cards.filter(c => !isEnergy(c) && !isRarePlus(c));
    const rarePool = cards.filter(isRarePlus);
    const energyPool = cards.filter(c => isEnergy(c) && !isRarePlus(c));

    const energyCard = energyPool.length ? random(energyPool) : null;

    const commonCount = energyCard ? 8 : 9;
    const commons = pickUnique(normalPool, commonCount);

    let rareCard = null;

    if (rarePool.length) {
        rareCard = pickWeightedRare(rarePool);
    } else {
        rareCard = random(cards);
    }

    const pack = [
        ...commons,
        ...(energyCard ? [energyCard] : []),
        rareCard
    ].filter(Boolean);

    return pack.map(card => formatPackCard(card, setCode));
}

/* -------------------------
   REEL CRATE OPENER — 3 packs uit TCGdex set
--------------------------*/

const REEL_PACK_DEFS = [
    { id: 'basic', name: 'Common & Uncommon Pack', tier: 'basic', imageTint: '4c1d95' },
    { id: 'rare', name: 'Rare Pack', tier: 'rare', imageTint: '1d4ed8' },
    { id: 'elite', name: 'Ultra Rare Pack', tier: 'elite', imageTint: 'b45309' }
];

async function loadCardsFromSet(setId) {
    const set = await tcgdex.set.get(setId);
    const cards = [];

    for (let i = 0; i < set.cards.length; i += CARD_BATCH_SIZE) {
        const batch = set.cards.slice(i, i + CARD_BATCH_SIZE);
        const loaded = await Promise.all(
            batch.map(c => c.getCard().catch(() => null))
        );
        cards.push(...loaded.filter(Boolean));

        if (i + CARD_BATCH_SIZE < set.cards.length) {
            await delay(CARD_BATCH_DELAY_MS);
        }
    }

    return cards.filter(isObtainable);
}

/** Kaarten uit willekeurige sets — alleen met marktprijs €0 – €1.000.000 */
async function loadObtainableCardsFromManySets(onProgress) {
    const allSets = await tcgdex.set.list();
    const shuffled = [...allSets].sort(() => Math.random() - 0.5);
    const obtainable = [];

    let scanned = 0;

    for (const brief of shuffled) {
        if (scanned >= MAX_SETS_TO_SCAN) break;

        scanned++;
        if (onProgress) {
            onProgress(`Kaarten zoeken… set ${scanned}/${MAX_SETS_TO_SCAN}`);
        }

        try {
            const fromSet = await loadCardsFromSet(brief.id);
            obtainable.push(...fromSet);
        } catch (e) {
            console.warn('Set overgeslagen:', brief.id, e);
        }

        await delay(SET_LOAD_DELAY_MS);

        if (obtainable.length >= ELITE_PACK_POOL_SIZE * 6) break;
    }

    return obtainable;
}

/**
 * 3 packs (50 kaarten, Ultra Rare 80) — localStorage cache.
 * Packprijs: basic €0,50 · rare €11,00 · elite = gem. + bonus.
 * Optioneel: ?set=sv8 of ?refresh=1 om cache te negeren.
 */
export async function buildReelCrates(onProgress) {
    const params = new URLSearchParams(window.location.search);
    const setFilter = params.get('set');
    const forceRefresh = params.get('refresh') === '1';

    if (forceRefresh) clearPackCache();

    if (!forceRefresh) {
        const cached = loadPackCache();
        if (cached) {
            if (onProgress) onProgress('Vaste packs geladen uit cache');
            cached.crates = applyPackPricesToCrates(cached.crates);
            return cached;
        }
    }

    let cards;
    let setName = 'Alle sets';
    let setCode = 'multi';

    if (setFilter) {
        if (onProgress) onProgress(`Set ${setFilter} laden…`);
        cards = await loadCardsFromSet(setFilter);
        const set = await tcgdex.set.get(setFilter);
        setName = set.name;
        setCode = setFilter;
    } else {
        cards = await loadObtainableCardsFromManySets(onProgress);
    }

    if (onProgress) onProgress('Packs samenstellen…');

    const crates = REEL_PACK_DEFS.map(def => {
        const items = buildFixedPackItems(cards, def.tier);
        const price = getPackPriceForTier(def.tier, items);
        const cover = items.length
            ? items[0].image
            : `https://placehold.co/88x88/${def.imageTint}/fff?text=${def.tier}`;

        return {
            id: def.id,
            name: def.name,
            price,
            image: cover,
            tier: def.tier,
            items
        };
    });

    const result = {
        version: PACK_CACHE_VERSION,
        setCode,
        setName,
        crates,
        totalObtainable: cards.length,
        fixedPoolSize: PACK_POOL_SIZE,
        elitePoolSize: ELITE_PACK_POOL_SIZE
    };

    savePackCache(result);
    return result;
}
