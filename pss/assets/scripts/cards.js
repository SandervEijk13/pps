import TCGdex from '@tcgdex/sdk';
import MemoryCache from '@cachex/memory';

const tcgdex = new TCGdex('en');
tcgdex.setCache(new MemoryCache());

const API = window.location.port === '5173'
    ? 'http://localhost/pss/api'
    : `${window.location.origin}/pss/api`;

const cardsGrid = document.getElementById('cardsGrid');
const setTitle = document.getElementById('setTitle');
const setInfo = document.getElementById('setInfo');

let ownedCards = [];       // expanded list (duplicates allowed)
let currentSetCode = '';
let currentCards = [];

// -------------------- LOAD OWNED CARDS --------------------
async function loadOwnedCards() {
    const res = await fetch(`${API}/get_cards.php`, {
        credentials: 'include'
    });

    const data = res.ok ? await res.json() : [];

    // expand card_amount into duplicates
    ownedCards = data.flatMap(c =>
        Array(Number(c.card_amount)).fill(c.card_id)
    );
}

// -------------------- SELL (REMOVE ONE COPY) --------------------
async function sellCard(cardId) {
    const res = await fetch(`${API}/sell_card.php`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId })
    });

    return await res.json();
}

// -------------------- IMAGE --------------------
function imageUrl(card) {
    if (typeof card.getImageURL === 'function') {
        return card.getImageURL('high', 'webp');
    }

    if (card.image) {
        return card.image.startsWith('http')
            ? card.image
            : `https://assets.tcgdex.net${card.image}`;
    }

    const setCode = card.set?.code || currentSetCode;
    const cardId = card.localId || card.number;

    return setCode && cardId
        ? `https://assets.tcgdex.net/en/${setCode}/${cardId}/high.webp`
        : '';
}

// -------------------- PRICE --------------------
function priceText(card) {
    const prices = card.pricing?.cardmarket;
    if (!prices) return 'No pricing';

    const values = [
        prices.low,
        prices.trend,
        prices.avg1,
        prices.avg7,
        prices.avg30
    ].filter(v => typeof v === 'number' && v > 0);

    if (!values.length) return 'No pricing';

    const isRareCard = isRare(card);

    const price = isRareCard
        ? Math.max(...values)   // rare → highest value
        : Math.min(...values);  // normal → lowest value

    return `€${price.toFixed(2)}`;
}

function isRare(card) {
    const r = (card.rarity || '').toLowerCase();
    return /rare|holo|v|vmax|vstar|gx|ex|shiny|illustration|ultra|secret|gold|rainbow|hyper/i.test(r);
}

// -------------------- OWNED COUNT --------------------
function getOwnedCount(cardId) {
    return ownedCards.filter(id => id === cardId).length;
}

// -------------------- RENDER CARD --------------------
function renderCard(card) {
    const ownedCount = getOwnedCount(card.id);

    const el = document.createElement('article');
    el.className = `card-item ${ownedCount > 0 ? '' : 'missing-card'}`;

    el.innerHTML = `
        <div class="card-thumb">
            <img src="${imageUrl(card)}" alt="${card.name || 'card'}">
        </div>

        <div class="card-info">
            <div class="card-name">${card.name || 'Unknown card'}</div>
            <div class="card-rarity">${card.rarity || 'No rarity'}</div>

            <div class="owned-count">
                Owned: <strong>${ownedCount}</strong>
            </div>

            <button class="sell-button" ${ownedCount === 0 ? 'disabled' : ''}>
                Sell Card
            </button>
        </div>

        <div class="card-pricing">${priceText(card)}</div>
    `;

    const button = el.querySelector('button');

    button.addEventListener('click', async () => {
        const result = await sellCard(card.id);

        if (result.status === 'success') {
            // remove ONE instance locally
            const index = ownedCards.indexOf(card.id);
            if (index !== -1) ownedCards.splice(index, 1);

            rerender();
        } else {
            alert(result.message || 'Sell failed');
        }
    });

    cardsGrid.appendChild(el);
}

// -------------------- RERENDER --------------------
function rerender() {
    cardsGrid.innerHTML = '';
    currentCards.forEach(renderCard);
    updateSetInfo();
}

// -------------------- SET INFO --------------------
function updateSetInfo() {
    const ownedSet = new Set(ownedCards);
    const ownedCount = currentCards.filter(c => ownedSet.has(c.id)).length;

    setInfo.textContent = `${ownedCount}/${currentCards.length} cards collected`;
}

// -------------------- LOAD SET --------------------
async function loadSet() {
    const setId = new URLSearchParams(window.location.search).get('set');

    if (!setId) {
        setTitle.textContent = 'No set selected';
        return;
    }

    setTitle.textContent = `Loading ${setId}...`;
    cardsGrid.innerHTML = '<div class="loading">Loading cards...</div>';

    try {
        await loadOwnedCards();

        const set = await tcgdex.fetch('sets', setId);
        currentSetCode = set.code || set.id;

        currentCards = await Promise.all(
            set.cards.map(c =>
                c.getCard ? c.getCard() : tcgdex.card.get(c.id)
            )
        );

        setTitle.textContent = set.name || setId;

        rerender();

    } catch (err) {
        console.error(err);
        setTitle.textContent = 'Unable to load cards';
        cardsGrid.innerHTML = '<div class="no-sets">Failed loading cards.</div>';
    }
}

loadSet();