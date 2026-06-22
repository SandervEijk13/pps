import TCGdex from '@tcgdex/sdk';
import MemoryCache from '@cachex/memory';
import { ALLOWED_SET_IDS, formatHeaderCoins } from './card_logic.js';
import { notification } from '/scripts/notifications.js';

const tcgdex = new TCGdex('en');
tcgdex.setCache(new MemoryCache());

const API = window.location.port === '5173'
    ? 'http://localhost/pss/api'
    : `${window.location.origin}/pss/api`;

const setsGrid = document.getElementById('setsGrid');
const eraFilters = document.getElementById('eraFilters');
const setSearch = document.getElementById('setSearch');
const collectionStats = document.getElementById('collectionStats');
const statGlobalPct = document.getElementById('statGlobalPct');
const statGlobalCount = document.getElementById('statGlobalCount');
const statBestSetName = document.getElementById('statBestSetName');
const statBestSetPct = document.getElementById('statBestSetPct');
const statCollectionValue = document.getElementById('statCollectionValue');
const statUniqueCards = document.getElementById('statUniqueCards');
const statTotalCopies = document.getElementById('statTotalCopies');

let economyStats = {
    uniqueCards: 0,
    totalCopies: 0,
    estimatedCoins: 0,
};

const allowedSetIdsMap = new Map(
    ALLOWED_SET_IDS.map((id, index) => [id, index])
);

const eraLookup = {
    base: 'Base',
    gym: 'Gym',
    neo: 'Neo',
    lc: 'Legendary Collection',
    ecard: 'E-Card',
    ex: 'EX',
    dp: 'Diamond & Pearl',
    pl: 'Platinum',
    hgss: 'HeartGold & SoulSilver',
    col: 'Call of Legends',
    bw: 'Black & White',
    xy: 'XY',
    sm: 'Sun & Moon',
    swsh: 'Sword & Shield',
    sv: 'Scarlet & Violet',
    me: 'Mega Evolution'
};

const eraOrder = [
    { key: 'all', label: 'All eras' },
    { key: 'base', label: 'Base' },
    { key: 'gym', label: 'Gym' },
    { key: 'neo', label: 'Neo' },
    { key: 'lc', label: 'Legendary Collection' },
    { key: 'ecard', label: 'E-Card' },
    { key: 'ex', label: 'EX' },
    { key: 'dp', label: 'Diamond & Pearl' },
    { key: 'pl', label: 'Platinum' },
    { key: 'hgss', label: 'HeartGold & SoulSilver' },
    { key: 'col', label: 'Call of Legends' },
    { key: 'bw', label: 'Black & White' },
    { key: 'xy', label: 'XY' },
    { key: 'sm', label: 'Sun & Moon' },
    { key: 'swsh', label: 'Sword & Shield' },
    { key: 'sv', label: 'Scarlet & Violet' },
    { key: 'me', label: 'Mega Evolution' }
];

let currentEra = 'all';
let currentSearch = '';
let allSets = [];
let userCollectionProgress = {};
const setElements = new Map();

function isLoggedIn() {
    return sessionStorage.getItem('isLogged') === 'true';
}

// ---------------------- ERA ----------------------

function getEraKey(setId) {
    for (const key of Object.keys(eraLookup)) {
        if (setId.startsWith(key)) return key;
    }
    return 'all';
}

// ---------------------- COLLECTION (FIXED) ----------------------

async function loadUserCollectionProgress() {
    const res = await fetch(`${API}/get_cards.php`, {
        credentials: 'include'
    });

    const data = res.ok ? await res.json() : [];
    const ownedUnique = new Set();

    userCollectionProgress = {};

    for (const row of data) {
        const cardId = row.card_id;
        if (!cardId || ownedUnique.has(cardId)) continue;
        ownedUnique.add(cardId);

        const dash = cardId.lastIndexOf('-');
        const setId = dash > 0 ? cardId.slice(0, dash) : cardId;
        if (!setId) continue;

        userCollectionProgress[setId] = (userCollectionProgress[setId] || 0) + 1;
    }
}

async function loadEconomyStats() {
    try {
        const res = await fetch(`${API}/collection_stats.php`, { credentials: 'include' });
        const data = res.ok ? await res.json() : null;
        if (data?.success && data.stats) {
            economyStats = data.stats;
        }
    } catch (error) {
        console.warn('Could not load collection stats:', error);
    }
}

function renderCollectionStats() {
    if (!collectionStats || !allSets.length) return;

    let totalOwned = 0;
    let totalCards = 0;
    let bestSet = null;
    let bestPct = -1;

    for (const set of allSets) {
        const owned = userCollectionProgress[set.id] || 0;
        const total = set.cardCount?.total || 0;
        totalOwned += owned;
        totalCards += total;

        const pct = total > 0 ? (owned / total) * 100 : 0;
        if (pct > bestPct || (pct === bestPct && owned > (bestSet?.owned || 0))) {
            bestPct = pct;
            bestSet = {
                name: set.name,
                owned,
                total,
                pct: Math.round(pct),
            };
        }
    }

    const globalPct = totalCards > 0 ? Math.round((totalOwned / totalCards) * 100) : 0;

    if (statGlobalPct) statGlobalPct.textContent = `${globalPct}%`;
    if (statGlobalCount) statGlobalCount.textContent = `${totalOwned}/${totalCards} unieke kaarten`;
    if (statBestSetName) statBestSetName.textContent = bestSet?.name || '—';
    if (statBestSetPct) {
        statBestSetPct.textContent = bestSet
            ? `${bestSet.pct}% · ${bestSet.owned}/${bestSet.total}`
            : '0%';
    }
    if (statCollectionValue) {
        statCollectionValue.textContent = formatHeaderCoins(economyStats.estimatedCoins || 0);
    }
    if (statUniqueCards) statUniqueCards.textContent = String(economyStats.uniqueCards || totalOwned);
    if (statTotalCopies) {
        statTotalCopies.textContent = `${economyStats.totalCopies || 0} total copies`;
    }

    collectionStats.hidden = false;
}

// ---------------------- LOGO ----------------------

function buildLogoUrl(set) {
    if (set.id === 'sv05') {
        return '/images/Temporal-Forces.webp';
    }

    return set.logo
        ? `${set.logo}.png`
        : `https://assets.tcgdex.net/en/${set.code}/${set.id}/logo.png`;
}

// ---------------------- FILTERS ----------------------

function renderEraFilters() {
    eraFilters.innerHTML = '';

    eraOrder.forEach(({ key, label }) => {
        const button = document.createElement('button');

        button.type = 'button';
        button.className = `filter-btn ${currentEra === key ? 'active' : ''}`;
        button.textContent = label;

        button.addEventListener('click', () => {
            currentEra = key;
            renderEraFilters();
            renderSets();
        });

        eraFilters.appendChild(button);
    });
}

// ---------------------- SETS ----------------------

function renderSets() {

    let displayedSets = currentEra === 'all'
        ? allSets
        : allSets.filter(set => set.eraKey === currentEra);

    if (currentSearch.trim()) {

        const search = currentSearch.toLowerCase();

        displayedSets = displayedSets.filter(set =>
            set.name.toLowerCase().includes(search)
        );
    }

    const visibleIds = new Set(
        displayedSets.map(set => set.id)
    );

    let visibleCount = 0;

    setElements.forEach((element, setId) => {

        if (visibleIds.has(setId)) {

            element.style.display = '';

            visibleCount++;

        } else {

            element.style.display = 'none';
        }
    });

    // EMPTY STATE
    let emptyState = document.querySelector('.no-sets');

    if (visibleCount === 0) {

        if (!emptyState) {

            emptyState = document.createElement('div');

            emptyState.className = 'no-sets';

            emptyState.textContent =
                'No matching sets found.';

            setsGrid.appendChild(emptyState);
        }

    } else if (emptyState) {

        emptyState.remove();
    }
}

// ---------------------- LOAD SETS ----------------------

async function loadSets() {

    try {

        const sets = await tcgdex.set.list();

        const filteredSets = sets.filter(set =>
            allowedSetIdsMap.has(set.id)
        );

        allSets = filteredSets
            .map(set => ({
                ...set,
                eraKey: getEraKey(set.id)
            }))
            .sort(
                (a, b) =>
                    allowedSetIdsMap.get(a.id) -
                    allowedSetIdsMap.get(b.id)
            );

        renderEraFilters();

        setsGrid.innerHTML = '';

        allSets.forEach(set => {

            const setEl = document.createElement('div');

            setEl.className = 'set-item';

            const ownedCards =
                userCollectionProgress[set.id] || 0;

            const totalCards =
                set.cardCount.total || 0;

            const percentage = totalCards > 0
                ? Math.round((ownedCards / totalCards) * 100)
                : 0;

            setEl.innerHTML = `
                <img
                    src="${buildLogoUrl(set)}"
                    alt="${set.name}"
                    loading="lazy"
                    decoding="async"
                >

                <div class="set-name">${set.name}</div>

                <div class="set-progress">
                    <span class="set-progress-pct">${percentage}%</span>
                    ${ownedCards}/${totalCards}
                </div>

                <div class="progress-bar">
                    <div
                        class="progress-fill"
                        style="width:${percentage}%"
                    ></div>
                </div>
            `;

            setEl.addEventListener('click', () => {

                window.location.href =
                    `cards.html?set=${encodeURIComponent(set.id)}`;
            });

            setsGrid.appendChild(setEl);

            setElements.set(set.id, setEl);
        });

        renderSets();
        renderCollectionStats();

    } catch (err) {

        console.error(err);

        setsGrid.innerHTML =
            '<div>❌ Failed to load sets</div>';
    }
}

// ---------------------- INIT ----------------------

async function init() {
    if (!isLoggedIn()) {
        window.location.href = '/pages/login.html';
        return;
    }

    await Promise.all([
        loadUserCollectionProgress(),
        loadEconomyStats(),
    ]);

    setSearch.addEventListener('input', (e) => {
        currentSearch = e.target.value;
        renderSets();
    });

    await loadSets();
}

init();