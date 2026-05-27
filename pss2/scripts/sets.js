import TCGdex from '@tcgdex/sdk';
import MemoryCache from '@cachex/memory';

const tcgdex = new TCGdex('en');
tcgdex.setCache(new MemoryCache());

const API = window.location.port === '5173'
    ? 'http://localhost/pss/api'
    : `${window.location.origin}/pss/api`;

const setsGrid = document.getElementById('setsGrid');
const eraFilters = document.getElementById('eraFilters');
const setSearch = document.getElementById('setSearch');

const allowedSetIds = [
    'base1', 'base2', 'base3', 'base4', 'base5',
    'gym1', 'gym2',
    'neo1', 'neo2', 'neo3', 'neo4',
    'lc',
    'ecard1',
    'ex1', 'ex2', 'ex3', 'ex4', 'ex5', 'ex6', 'ex7', 'ex8', 'ex9', 'ex10', 'ex11', 'ex12', 'ex13', 'ex14', 'ex15', 'ex16',
    'dp1', 'dp2', 'dp3', 'dp5', 'dp6', 'dp7',
    'pl1','pl3', 'pl4',
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

    userCollectionProgress = {};

    // track unique card ids globally
    const uniqueCardIds = new Set();

    for (const cardEntry of data) {

        // skip duplicates
        if (uniqueCardIds.has(cardEntry.card_id)) {
            continue;
        }

        uniqueCardIds.add(cardEntry.card_id);

        try {

            const card = await tcgdex.card.get(cardEntry.card_id);

            const setId = card?.set?.id;

            if (!setId) continue;

            userCollectionProgress[setId] =
                (userCollectionProgress[setId] || 0) + 1;

        } catch (e) {

            // ignore missing cards
        }
    }
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
                set.cardCount?.official || 0;

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

    } catch (err) {

        console.error(err);

        setsGrid.innerHTML =
            '<div>❌ Failed to load sets</div>';
    }
}

// ---------------------- INIT ----------------------

async function init() {
    await loadUserCollectionProgress();

    setSearch.addEventListener('input', (e) => {
        currentSearch = e.target.value;
        renderSets();
    });

    await loadSets();
}

init();