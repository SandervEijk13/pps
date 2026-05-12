import TCGdex from '@tcgdex/sdk';
import MemoryCache from '@cachex/memory';

const tcgdex = new TCGdex('en');
tcgdex.setCache(new MemoryCache());

// ----------------------
// DEBUG: FETCH ALL SETS
// ----------------------

(async () => {
    try {
        const allFetchedSets = await tcgdex.set.list();

        console.log('All available TCGdex sets:');

        console.table(
            allFetchedSets.map(set => ({
                id: set.id,
                name: set.name,
                code: set.code,
                cardCount: set.cardCount?.official || 0,
                logo: set.logo
            }))
        );

        console.log('Total fetched sets:', allFetchedSets.length);

        console.debug(
            'Fetched set IDs:',
            allFetchedSets.map(set => set.id)
        );

    } catch (err) {
        console.error('Failed to fetch all sets:', err);
    }
})();

// ----------------------
// DOM ELEMENTS
// ----------------------

const setsGrid = document.getElementById('setsGrid');
const eraFilters = document.getElementById('eraFilters');

// ----------------------
// ALLOWED SET IDS
// ----------------------

const allowedSetIds = [
    'base1', 'base2', 'base3', 'base4', 'base5',
    'gym1', 'gym2',
    'neo1', 'neo2', 'neo3', 'neo4',
    'lc',
    'ecard1',
    'ex1', 'ex2', 'ex3', 'ex4', 'ex5', 'ex6', 'ex7', 'ex8', 'ex9', 'ex10', 'ex11', 'ex12', 'ex13', 'ex14', 'ex15', 'ex16',
    'dp1', 'dp2', 'dp3', 'dp5', 'dp6', 'dp7',
    'pl3', 'pl4',
    'hgss1', 'hgss2', 'hgss3', 'hgss4',
    'col1',
    'bw1', 'bw2', 'bw3', 'bw4', 'bw5', 'bw6', 'bw7', 'bw8', 'bw9', 'bw10', 'bw11',
    'xy1', 'xy2', 'xy3', 'xy4', 'xy5', 'xy6', 'xy7', 'g1', 'xy9', 'xy10', 'xy11', 'xy12',
    'sm1', 'sm3', 'sm4', 'sm5', 'sm6', 'sm7', 'sm8', 'sm9', 'sm10', 'sm11', 'sm115', 'sm12',
    'swsh1', 'swsh2', 'swsh3', 'swsh3.5', 'swsh4', 'swsh4.5', 'swsh5', 'swsh6', 'swsh7', 'swsh8', 'swsh9', 'swsh10', 'swsh10.5', 'swsh11', 'swsh12', 'swsh12.5',
    'sv01', 'sv02', 'sv03', 'sv03.5', 'sv04', 'sv04.5', 'sv05', 'sv06', 'sv06.5', 'sv07', 'sv08', 'sv08.5', 'sv09', 'sv10', 'sv10.5w', 'sv10.5b',
    'me01', 'me02', 'me02.5', 'me03'
];

const allowedSetIdsMap = new Map(
    allowedSetIds.map((id, index) => [id, index])
);

// ----------------------
// ERA LOOKUP
// ----------------------

const eraLookup = {
    base: 'Base',
    gym: 'Gym',
    neo: 'Neo',
    lc: 'Legendary Collection',
    ecard: 'E-Card',
    ex: 'EX',
    e2: 'Diamond & Pearl',
    e3: 'Diamond & Pearl',
    dp: 'Diamond & Pearl',
    pl: 'Platinum',
    hgss: 'HeartGold & SoulSilver',
    col: 'Call of Legends',
    bw: 'Black & White',
    xy: 'XY',
    g1: 'XY',
    sm: 'Sun & Moon',
    swsh: 'Sword & Shield',
    pgo: 'Sword & Shield',
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

// ----------------------
// STATE
// ----------------------

let currentEra = 'all';
let allSets = [];

// ----------------------
// HELPERS
// ----------------------

function getEraKey(setId) {
    for (const key of Object.keys(eraLookup)) {
        if (setId.startsWith(key)) {
            return key;
        }
    }

    return 'all';
}

function buildLogoUrl(set) {
    console.debug('Building logo URL for:', set.id);

    if (set.id === 'sv05') {
        console.debug('Using custom logo for sv05');

        return '/assets/img/Temporal-Forces.webp';
    }

    const logoUrl = set.logo
        ? `${set.logo}.png`
        : `https://assets.tcgdex.net/en/${set.code}/${set.id}/logo.png`;

    console.debug('Generated logo URL:', logoUrl);

    return logoUrl;
}

// ----------------------
// RENDER ERA FILTERS
// ----------------------

function renderEraFilters() {
    console.debug('Rendering era filters');

    eraFilters.innerHTML = '';

    eraOrder.forEach(({ key, label }) => {
        console.debug('Creating era filter button:', key);

        const button = document.createElement('button');

        button.type = 'button';
        button.className = `filter-btn ${currentEra === key ? 'active' : ''}`;
        button.textContent = label;

        button.addEventListener('click', () => {
            console.debug('Era filter selected:', key);

            currentEra = key;

            renderEraFilters();
            renderSets();
        });

        eraFilters.appendChild(button);
    });
}

// ----------------------
// RENDER SETS
// ----------------------

function renderSets() {
    const displayedSets = currentEra === 'all'
        ? allSets
        : allSets.filter(set => set.eraKey === currentEra);

    console.debug('Rendering sets', {
        selectedEra: currentEra,
        displayedCount: displayedSets.length,
        displayedSets
    });

    setsGrid.innerHTML = '';

    if (!displayedSets.length) {
        console.warn('No sets found for era:', currentEra);

        setsGrid.innerHTML =
            '<div class="no-sets">No sets found for this era.</div>';

        return;
    }

    displayedSets.forEach(set => {
        console.debug('Rendering set:', {
            id: set.id,
            name: set.name,
            eraKey: set.eraKey
        });

        const setEl = document.createElement('div');

        setEl.className = 'set-item';

        setEl.innerHTML = `
            <img src="${buildLogoUrl(set)}" alt="${set.name}">
            <div class="set-name">${set.name}</div>
        `;

        setEl.addEventListener('click', () => {
            console.debug('Clicked set:', set.id);

            window.location.href =
                `cards.html?set=${encodeURIComponent(set.id)}`;
        });

        setsGrid.appendChild(setEl);
    });

    console.debug('Finished rendering sets');
}

// ----------------------
// LOAD SETS
// ----------------------

async function loadSets() {
    try {
        console.debug('Fetching allowed sets from TCGdex...');

        const sets = await tcgdex.set.list();

        // RAW RESPONSE
        console.debug('RAW tcgdex.set.list() response:', sets);

        // COUNT
        console.debug('Fetched sets count:', sets.length);

        // IDS
        console.debug(
            'Fetched set IDs:',
            sets.map(set => set.id)
        );

        // TABLE
        console.table(
            sets.map(set => ({
                id: set.id,
                name: set.name,
                code: set.code,
                logo: set.logo,
                cardCount: set.cardCount?.official || 0
            }))
        );

        // FILTER
        const filteredSets = sets.filter(set =>
            allowedSetIdsMap.has(set.id)
        );

        console.debug('Filtered allowed sets:', filteredSets);

        console.debug(
            'Filtered allowed set IDs:',
            filteredSets.map(set => set.id)
        );

        // MISSING IDS
        const missingAllowed = allowedSetIds.filter(
            id => !filteredSets.some(set => set.id === id)
        );

        console.warn(
            'Allowed set IDs NOT returned by API:',
            missingAllowed
        );

        // FINAL PROCESSING
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

        console.debug('Final processed allSets:', allSets);

        console.table(
            allSets.map(set => ({
                id: set.id,
                name: set.name,
                eraKey: set.eraKey,
                code: set.code
            }))
        );

        renderEraFilters();
        renderSets();

    } catch (err) {
        console.error('Failed to load allowed sets:', err);

        setsGrid.innerHTML =
            '<div>❌ Failed to load sets</div>';
    }
}

// ----------------------
// AUTO LOAD
// ----------------------

console.debug('Starting app...');

loadSets();