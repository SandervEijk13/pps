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

let ownedCards = [];
let currentCards = [];
let currentSetCode = '';

// ---------------- LOAD OWNED ----------------

async function loadOwnedCards() {

    const res = await fetch(`${API}/get_cards.php`, {
        credentials: 'include'
    });

    const data = res.ok ? await res.json() : [];

    ownedCards = data.flatMap(c =>
        Array(Number(c.card_amount)).fill(c.card_id)
    );
}

// ---------------- IMAGE ----------------

function imageUrl(card) {

    if (card.getImageURL) {
        return card.getImageURL('high', 'webp');
    }

    if (card.image) {
        return card.image.startsWith('http')
            ? card.image
            : `https://assets.tcgdex.net${card.image}`;
    }

    const setCode = card.set?.code || currentSetCode;
    const cardId = card.localId || card.number;

    return `https://assets.tcgdex.net/en/${setCode}/${cardId}/high.webp`;
}

// ---------------- PRICE ----------------

function isRare(card) {
    return /rare|holo|v|vmax|vstar|gx|ex|secret|gold/i
        .test((card.rarity || '').toLowerCase());
}

function priceText(card) {

    const p = card.pricing?.cardmarket;
    if (!p) return 'No pricing';

    const values = [p.low, p.trend, p.avg1, p.avg7, p.avg30]
        .filter(v => typeof v === 'number' && v > 0);

    if (!values.length) return 'No pricing';

    const price = isRare(card)
        ? Math.max(...values)
        : Math.min(...values);

    return `€${price.toFixed(2)}`;
}

// ---------------- OWNED COUNT ----------------

function getOwnedCount(id) {
    return ownedCards.filter(x => x === id).length;
}

// ---------------- SELL ----------------

async function sellCard(cardId) {

    const res = await fetch(`${API}/sell_card.php`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId })
    });

    return await res.json();
}

// ---------------- SEND TO MARKET ----------------

window.sendToMarket = async function(cardId) {

    const res = await fetch(`${API}/send_to_market.php`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId })
    });

    const data = await res.json();

    console.log("SEND TO MARKET RESPONSE:", data);

    if (!data.success) {
        alert(data.message || "Failed");
        return;
    }

    // 🔥 DO NOT manually trust local state
    await loadOwnedCards();   // reload from DB

    rerender();
};

// ---------------- RENDER CARD ----------------

function renderCard(card) {

    const ownedCount = getOwnedCount(card.id);

    const el = document.createElement('article');

    el.className = `card-item ${ownedCount ? '' : 'missing-card'}`;

    el.innerHTML = `
        <div>
            <img src="${imageUrl(card)}" width="120">
        </div>

        <h3>${card.name}</h3>

        <p>${priceText(card)}</p>

        <p class="rarity">
            ${card.rarity ? `Rarity: ${card.rarity}` : 'Rarity: Unknown'}
        </p>


        <p>Owned: ${ownedCount}</p>

        <button ${ownedCount === 0 ? 'disabled' : ''} class="sell">
            Sell 1
        </button>

        <button ${ownedCount === 0 ? 'disabled' : ''} class="market">
            Send to Market
        </button>
    `;

    // SELL
    el.querySelector('.sell').onclick = async () => {

        const res = await sellCard(card.id);

        if (res.success) {
            const i = ownedCards.indexOf(card.id);
            if (i !== -1) ownedCards.splice(i, 1);
            rerender();
        }
    };

    // MARKET
    el.querySelector('.market').onclick = () =>
        sendToMarket(card.id);

    cardsGrid.appendChild(el);
}

// ---------------- RERENDER ----------------

function rerender() {
    cardsGrid.innerHTML = '';
    currentCards.forEach(renderCard);
    updateSetInfo();
}

// ---------------- SET INFO ----------------

function updateSetInfo() {

    const ownedSet = new Set(ownedCards);

    const ownedCount = currentCards.filter(c =>
        ownedSet.has(c.id)
    ).length;

    setInfo.textContent =
        `${ownedCount}/${currentCards.length} collected`;
}

// ---------------- LOAD SET ----------------

async function loadSet() {

    const setId = new URLSearchParams(window.location.search).get('set');

    if (!setId) return;

    setTitle.textContent = 'Loading...';

    await loadOwnedCards();

    const set = await tcgdex.fetch('sets', setId);

    currentSetCode = set.code || set.id;

    currentCards = await Promise.all(
        set.cards.map(c =>
            c.getCard ? c.getCard() : tcgdex.card.get(c.id)
        )
    );

    setTitle.textContent = set.name;

    rerender();
}

loadSet();