import TCGdex from '@tcgdex/sdk';
import MemoryCache from '@cachex/memory';
import { notification } from '/scripts/notifications.js';


const tcgdex = new TCGdex('en');
tcgdex.setCache(new MemoryCache());

/** Zelfde whitelist als scripts/sets.js */
export const ALLOWED_SET_IDS = [
    'base1', 'base2', 'base3', 'base4', 'base5',
    'gym1', 'gym2',
    'neo1', 'neo2', 'neo3', 'neo4',
    'lc',
    'ecard1',
    'ex1', 'ex2', 'ex3', 'ex4', 'ex5', 'ex6', 'ex7', 'ex8', 'ex9', 'ex10', 'ex11', 'ex12', 'ex13', 'ex14', 'ex15', 'ex16',
    'dp1', 'dp2', 'dp3', 'dp5', 'dp6', 'dp7',
    'pl1', 'pl3', 'pl4',
    'hgss1', 'hgss2', 'hgss3', 'hgss4',
    'col1',
    'bw1', 'bw2', 'bw3', 'bw4', 'bw5', 'bw6', 'bw7', 'bw8', 'bw9', 'bw10', 'bw11',
    'xy1', 'xy2', 'xy3', 'xy4', 'xy5', 'xy6', 'xy7', 'g1', 'xy9', 'xy10', 'xy11', 'xy12',
    'sm1', 'sm3', 'sm4', 'sm5', 'sm6', 'sm7', 'sm8', 'sm9', 'sm10', 'sm11', 'sm115', 'sm12',
    'swsh1', 'swsh2', 'swsh3', 'swsh3.5', 'swsh4', 'swsh4.5', 'swsh5', 'swsh6', 'swsh7', 'swsh8', 'swsh9', 'swsh10', 'swsh10.5', 'swsh11', 'swsh12', 'swsh12.5',
    'sv01', 'sv02', 'sv03', 'sv03.5', 'sv04', 'sv04.5', 'sv05', 'sv06', 'sv06.5', 'sv07', 'sv08', 'sv08.5', 'sv09', 'sv10', 'sv10.5w', 'sv10.5b',
    'me01', 'me02', 'me02.5', 'me03'
];

const ALLOWED_SET_IDS_SET = new Set(ALLOWED_SET_IDS);

const TCGDEX_ASSETS = 'https://assets.tcgdex.net';

const SERIE_PREFIXES = [
    ['swsh', 'swsh'],
    ['sv', 'sv'],
    ['sm', 'sm'],
    ['xy', 'xy'],
    ['g1', 'xy'],
    ['bw', 'bw'],
    ['hgss', 'hgss'],
    ['col', 'col'],
    ['dp', 'dp'],
    ['pl', 'pl'],
    ['ex', 'ex'],
    ['ecard', 'ecard'],
    ['neo', 'neo'],
    ['gym', 'gym'],
    ['base', 'base'],
    ['lc', 'lc'],
    ['me', 'me'],
].sort((a, b) => b[0].length - a[0].length);

function inferSerieFromSetId(setId) {
    const id = String(setId || '');
    for (const [prefix, serie] of SERIE_PREFIXES) {
        if (id.startsWith(prefix)) {
            return serie;
        }
    }
    return id.replace(/[\d.].*$/, '') || id;
}

function parseTcgdexCardId(cardId, setHint, localIdHint) {
    if (setHint && localIdHint) {
        const setId = typeof setHint === 'string' ? setHint : setHint.id;
        return {
            serie: inferSerieFromSetId(setId),
            setId,
            localId: String(localIdHint),
        };
    }

    const id = String(cardId || '');
    if (!id) {
        return null;
    }

    const sortedSets = [...ALLOWED_SET_IDS].sort((a, b) => b.length - a.length);
    for (const setId of sortedSets) {
        const prefix = `${setId}-`;
        if (id.startsWith(prefix)) {
            return {
                serie: inferSerieFromSetId(setId),
                setId,
                localId: id.slice(prefix.length),
            };
        }
    }

    const dash = id.lastIndexOf('-');
    if (dash > 0) {
        const setId = id.slice(0, dash);
        return {
            serie: inferSerieFromSetId(setId),
            setId,
            localId: id.slice(dash + 1),
        };
    }

    return null;
}

function finalizeTcgdexAssetUrl(url, suffix) {
    const clean = String(url).replace(/\/$/, '');
    if (/\.(webp|png|jpe?g)(\?.*)?$/i.test(clean)) {
        return clean;
    }
    if (/\/(high|low)\.(webp|png|jpe?g)$/i.test(clean)) {
        return clean;
    }
    return `${clean}/${suffix}`;
}

/**
 * Build a TCGdex card image URL: …/en/{serie}/{set}/{localId}/{quality}.{ext}
 * Accepts SDK card objects, image base paths, full URLs, or card ids (e.g. swsh3-136).
 */
export function resolveTcgdexImageUrl(input, options = {}) {
    const quality = options.quality || 'high';
    const extension = options.extension || 'webp';
    const suffix = `${quality}.${extension}`;

    if (!input) {
        return buildTcgdexUrlFromCardId(options.cardId, suffix, options);
    }

    if (typeof input === 'object') {
        if (typeof input.getImageURL === 'function') {
            return input.getImageURL(quality, extension);
        }

        return resolveTcgdexImageUrl(input.image, {
            ...options,
            cardId: options.cardId || input.id || input.cardId,
            set: options.set || input.set,
            localId: options.localId || input.localId || input.number,
        });
    }

    

    const image = String(input).trim();
    if (!image) {
        return buildTcgdexUrlFromCardId(options.cardId, suffix, options);
    }

    if (/^https?:\/\//i.test(image)) {
        return finalizeTcgdexAssetUrl(image, suffix);
    }

    if (image.startsWith('en/') || image.startsWith('fr/')) {
        return finalizeTcgdexAssetUrl(`${TCGDEX_ASSETS}/${image}`, suffix);
    }

    const path = image.startsWith('/') ? image : `/${image}`;
    return finalizeTcgdexAssetUrl(`${TCGDEX_ASSETS}${path}`, suffix);
}

function buildTcgdexUrlFromCardId(cardId, suffix, options = {}) {
    const parsed = parseTcgdexCardId(cardId, options.set, options.localId);
    if (!parsed) {
        return '';
    }

    return `${TCGDEX_ASSETS}/en/${parsed.serie}/${parsed.setId}/${parsed.localId}/${suffix}`;
}

/* -------------------------
   LOADER (overlay tot content geladen is)
--------------------------*/

export function Loader(root, defaultMessage = 'Loading…') {
    if (!root) {
        return { show() {}, hide() {}, setMessage() {}, isVisible: () => false };
    }

    let overlay = null;

    const ensureOverlay = () => {
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.className = 'pss-loader';
        overlay.setAttribute('role', 'status');
        overlay.setAttribute('aria-live', 'polite');
        overlay.innerHTML = `
            <div class="pss-loader-box">
                <div class="pss-loader-spinner" aria-hidden="true"></div>
                <p class="pss-loader-text"></p>
            </div>
        `;
        root.appendChild(overlay);
        return overlay;
    };

    return {
        show(message = defaultMessage) {
            const el = ensureOverlay();
            el.querySelector('.pss-loader-text').textContent = message;
            el.classList.add('is-visible');
            root.classList.add('is-loading');
        },
        setMessage(message) {
            if (!overlay) return;
            overlay.querySelector('.pss-loader-text').textContent = message;
        },
        hide() {
            if (!overlay) return;
            overlay.classList.remove('is-visible');
            root.classList.remove('is-loading');
        },
        isVisible() {
            return Boolean(overlay?.classList.contains('is-visible'));
        }
    };
}

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
    return resolveTcgdexImageUrl(card, {
        cardId: card?.id,
        set: card?.set?.id || setCode,
        localId: card?.localId || card?.number,
    });
}

/* -------------------------
   PRICE (verkrijgbaar / markt)
--------------------------*/

const MIN_OBTAINABLE_PRICE = 0;
const MAX_OBTAINABLE_PRICE = 1_000_000;
const PACK_POOL_SIZE = 50;
const ELITE_PACK_POOL_SIZE = 80;
/** Genoeg pool per tier; stop met laden zodra dit bereikt is */
const TIER_POOL_TARGETS = {
    basic: 70,
    rare: 70,
    elite: 100
};
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

/** Weighted pull from a reel crate pool (same logic as crate-opener). */
export function pickWeightedReelItem(items, randomFn = Math.random) {
    if (!items?.length) return null;
    const total = items.reduce((sum, it) => sum + Number(it.dropChance || 1), 0);
    let roll = randomFn() * total;
    for (const item of items) {
        roll -= Number(item.dropChance || 1);
        if (roll <= 0) return { ...item };
    }
    return { ...items[items.length - 1] };
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
const PACK_SEED_KEY = 'pss-pack-roll-seed';
const PACK_CACHE_VERSION = 9;
const GLOBAL_CATALOG_SEED = 'pss-global-v1';
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
function buildElitePackItems(allCards, seedSuffix = '', packSeedOverride = null) {
    const pool = allCards.filter(c => getReelPackTier(c) === 'elite');
    if (!pool.length) return [];

    const tierMap = groupRarePoolByTier(pool);
    const highEnd = [...tierMap.chase, ...tierMap.ultra, ...tierMap.mid];
    const filler = tierMap.rare;

    const packSeed = packSeedOverride ?? getPackSeed();
    const highPicked = pickUniqueDeterministic(
        highEnd,
        Math.min(highEnd.length, ELITE_PACK_POOL_SIZE),
        `pss-pack-elite-high-${packSeed}${seedSuffix}`
    );
    const slotsLeft = ELITE_PACK_POOL_SIZE - highPicked.length;
    const restPicked = slotsLeft > 0
        ? pickUniqueDeterministic(filler, slotsLeft, `pss-pack-elite-rest-${packSeed}${seedSuffix}`)
        : [];

    return [...highPicked, ...restPicked].map(c => cardToReelItem(c));
}

function buildFixedPackItems(allCards, packTier, seedSuffix = '', packSeedOverride = null) {
    if (packTier === 'elite') {
        return buildElitePackItems(allCards, seedSuffix, packSeedOverride);
    }

    const pool = allCards.filter(c => getReelPackTier(c) === packTier);
    const packSeed = packSeedOverride ?? getPackSeed();
    const picked = pickUniqueDeterministic(
        pool,
        PACK_POOL_SIZE,
        `pss-pack-${packTier}-${packSeed}${seedSuffix}`
    );
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

function getPackSeed() {
    let seed = localStorage.getItem(PACK_SEED_KEY);
    if (!seed) {
        seed = 'initial';
        localStorage.setItem(PACK_SEED_KEY, seed);
    }
    return seed;
}

/** Nieuwe random roll — andere kaarten in alle packs */
export function rotatePackSeed() {
    const seed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(PACK_SEED_KEY, seed);
    clearPackCache();
    return seed;
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
    { id: 'basic', name: 'Starter Pack', tier: 'basic', seedSuffix: '', imageTint: '4c1d95' },
    { id: 'basic_ii', name: 'Starter Pack II', tier: 'basic', seedSuffix: '-v2', imageTint: '5b21b6' },
    { id: 'rare', name: 'Rare Pack', tier: 'rare', seedSuffix: '', imageTint: '1d4ed8' },
    { id: 'rare_ii', name: 'Rare Pack II', tier: 'rare', seedSuffix: '-v2', imageTint: '2563eb' },
    { id: 'elite', name: 'Ultra Rare Pack', tier: 'elite', seedSuffix: '', imageTint: 'b45309' },
    { id: 'elite_ii', name: 'Chase Pack', tier: 'elite', seedSuffix: '-v2', imageTint: 'c2410c' }
];

function tierPoolsReady(counts) {
    return counts.basic >= TIER_POOL_TARGETS.basic
        && counts.rare >= TIER_POOL_TARGETS.rare
        && counts.elite >= TIER_POOL_TARGETS.elite;
}

function addCardToTierPools(card, obtainable, tierCounts) {
    const tier = getReelPackTier(card);
    if (!tier) return;

    obtainable.push(card);
    tierCounts[tier] = (tierCounts[tier] || 0) + 1;
}

/** Volledige set (voor ?set= filter) */
async function loadCardsFromSet(setId, onProgress) {
    if (!ALLOWED_SET_IDS_SET.has(setId)) {
        return [];
    }

    const set = await tcgdex.set.get(setId);
    const cards = [];
    const total = set.cards.length;

    for (let i = 0; i < total; i += CARD_BATCH_SIZE) {
        const batch = set.cards.slice(i, i + CARD_BATCH_SIZE);
        const loaded = await Promise.all(
            batch.map(c => c.getCard().catch(() => null))
        );

        for (const card of loaded) {
            if (card && isObtainable(card)) cards.push(card);
        }

        if (onProgress) {
            onProgress(`Set laden… ${Math.min(i + CARD_BATCH_SIZE, total)}/${total}`);
        }

        if (i + CARD_BATCH_SIZE < total) {
            await delay(CARD_BATCH_DELAY_MS);
        }
    }

    return cards;
}

/**
 * Alleen whitelist-sets; per set batches tot pools vol zijn.
 * Stopt midden in een set zodra genoeg basic/rare/elite kaarten zijn.
 */
async function loadObtainableCardsFromAllowedSets(onProgress, deterministic = false) {
    const setIds = deterministic
        ? [...ALLOWED_SET_IDS].sort()
        : [...ALLOWED_SET_IDS].sort(() => Math.random() - 0.5);
    const obtainable = [];
    const tierCounts = { basic: 0, rare: 0, elite: 0 };

    let setIndex = 0;

    for (const setId of setIds) {
        if (tierPoolsReady(tierCounts)) break;

        setIndex++;
        if (onProgress) {
            onProgress(`Kaarten laden… set ${setIndex}/${setIds.length}`);
        }

        try {
            const set = await tcgdex.set.get(setId);
            const briefs = deterministic
                ? [...set.cards].sort((a, b) => String(a.id).localeCompare(String(b.id)))
                : [...set.cards].sort(() => Math.random() - 0.5);

            for (let i = 0; i < briefs.length; i += CARD_BATCH_SIZE) {
                if (tierPoolsReady(tierCounts)) break;

                const batch = briefs.slice(i, i + CARD_BATCH_SIZE);
                const loaded = await Promise.all(
                    batch.map(c => c.getCard().catch(() => null))
                );

                for (const card of loaded) {
                    if (!card || !isObtainable(card)) continue;
                    addCardToTierPools(card, obtainable, tierCounts);
                }

                if (i + CARD_BATCH_SIZE < briefs.length) {
                    await delay(CARD_BATCH_DELAY_MS);
                }
            }
        } catch (e) {
            notification({
                text: 'Set overgeslagen',
                duration: 5000,
                type: 'warning',
                closeable: true,
            });
        }

        await delay(SET_LOAD_DELAY_MS);
    }

    return obtainable;
}

/**
 * 3 packs (50 kaarten, Ultra Rare 80) — localStorage cache.
 * Packprijs: basic €0,50 · rare €11,00 · elite = gem. + bonus.
 * Optioneel: ?set=sv8 of ?refresh=1 om cache te negeren.
 */
export async function buildReelCrates(onProgress, options = {}) {
    const params = new URLSearchParams(window.location.search);
    const setFilter = params.get('set');
    const forceRefresh = options.forceRefresh || params.get('refresh') === '1';
    const catalogSeed = options.catalogSeed || null;
    const deterministic = Boolean(catalogSeed);

    if (forceRefresh && !catalogSeed) clearPackCache();

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
        if (!ALLOWED_SET_IDS_SET.has(setFilter)) {
            throw new Error(`Set "${setFilter}" staat niet op de whitelist.`);
        }

        cards = await loadCardsFromSet(setFilter, onProgress);
        const set = await tcgdex.set.get(setFilter);
        setName = set.name;
        setCode = setFilter;
    } else {
        cards = await loadObtainableCardsFromAllowedSets(onProgress, deterministic);
    }

    if (onProgress) onProgress('Packs samenstellen…');

    const packSeed = catalogSeed || getPackSeed();
    const crates = REEL_PACK_DEFS.map(def => {
        const items = buildFixedPackItems(
            cards,
            def.tier,
            def.seedSuffix || '',
            packSeed
        );
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
