import TCGdex from '@tcgdex/sdk';
import MemoryCache from '@cachex/memory';
import { resolveTcgdexImageUrl } from '/scripts/card_logic.js';
import { openTradePartnerPicker } from '/scripts/trade.js';

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

// DEBUG RELOAD DETECTION
window.addEventListener('beforeunload', () => {
    console.log('PAGE IS RELOADING');
});

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
    return resolveTcgdexImageUrl(card, {
        cardId: card?.id,
        set: card?.set?.id || currentSetCode,
        localId: card?.localId || card?.number,
    });
}

// ---------------- PRICE ----------------

function isRare(card) {

    return /rare|holo|v|vmax|vstar|gx|ex|secret|gold/i
        .test((card.rarity || '').toLowerCase());
}

function getCardPrice(card) {

    const p = card.pricing?.cardmarket;

    if (!p) return 0;

    const values = [
        p.low,
        p.trend,
        p.avg1,
        p.avg7,
        p.avg30
    ].filter(v => typeof v === 'number' && v > 0);

    if (!values.length) return 0;

    return isRare(card)
        ? Math.max(...values)
        : Math.min(...values);
}

function priceText(card) {

    const price = getCardPrice(card);

    if (!price) return 'No pricing';

    return `€${price.toFixed(2)}`;
}

// ---------------- OWNED COUNT ----------------

function getOwnedCount(id) {

    return ownedCards.filter(x => x === id).length;
}

// ---------------- SELL ----------------

async function sellCard(cardId) {

    const res = await fetch(`${API}/sell_cards.php`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cardId })
    });

    return await res.json();
}

// ---------------- SEND TO MARKET ----------------

async function sendToMarket(card) {

    const cardPrice = getCardPrice(card);

    const res = await fetch(`${API}/send_to_market.php`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            cardId: card.id,
            cardprice: cardPrice
        })
    });

    const data = await res.json();

    console.log("SEND TO MARKET RESPONSE:", data);

    if (!data.success) {

        alert(data.message || "Failed");

        return;
    }

    const i = ownedCards.indexOf(card.id);

    if (i !== -1) {
        ownedCards.splice(i, 1);
    }

    updateCardUI(card.id);
}

// ---------------- RENDER CARD ----------------

function renderCard(card) {

    const ownedCount = getOwnedCount(card.id);

    const el = document.createElement('article');

    el.className = `card-item ${ownedCount ? '' : 'missing-card'}`;

    el.innerHTML = `
        <div class="card-thumb-wrap">
            ${ownedCount ? '' : '<span class="card-missing-badge"><i class="fas fa-lock" aria-hidden="true"></i> Niet in bezit</span>'}
            <div class="card-thumb">
                <img src="${imageUrl(card)}" width="120" alt="">
            </div>
        </div>

        <h3>${card.name}</h3>

        <p>${priceText(card)}</p>

        <p class="rarity">
            ${card.rarity ? `Rarity: ${card.rarity}` : 'Rarity: Unknown'}
        </p>

        <p>Owned: ${ownedCount}</p>

        <button
            type="button"
            ${ownedCount === 0 ? 'disabled' : ''}
            class="sell">
            Sell 1
        </button>

        <button
            type="button"
            ${ownedCount === 0 ? 'disabled' : ''}
            class="market">
            Send to Market
        </button>

        <button
            type="button"
            ${ownedCount === 0 ? 'disabled' : ''}
            class="trade">
            Trade
        </button>
    `;

    // ---------------- SELL BUTTON ----------------

    try{
        const sellBtn = el.querySelector('.sell');

         sellBtn.addEventListener('click', async (e) => {

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        try {

            sellBtn.disabled = true;

            const res = await sellCard(card.id);

            if (res.success) {

                const i = ownedCards.indexOf(card.id);

                if (i !== -1) {
                    ownedCards.splice(i, 1);
                }

                rerender();
            }

            } catch (err) {

            console.error(err);

            } finally {

            sellBtn.disabled = false;
            }

            }, true);
    }
    catch{
        console.log("warning geen sell button")
    }
    

   

    // ---------------- MARKET BUTTON ----------------

    const marketBtn = el.querySelector('.market');

    marketBtn.addEventListener('click', async (e) => {

        e.preventDefault();

        try {

            marketBtn.disabled = true;

            await sendToMarket(card);

        } catch (err) {

            console.error(err);

        } finally {

            marketBtn.disabled = false;
        }

    });

    const tradeBtn = el.querySelector('.trade');
    tradeBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        openTradePartnerPicker(card.id);
    });

    cardsGrid.appendChild(el);
}

// ---------------- RERENDER ----------------

function rerender() {

    cardsGrid.innerHTML = '';

    currentCards.forEach(renderCard);

    updateSetInfo();
}

function updateCardUI(cardId) {

    const cardEls = document.querySelectorAll('.card-item');

    cardEls.forEach(el => {

        const title = el.querySelector('h3');

        const card = currentCards.find(c => c.name === title.textContent);

        if (!card || card.id !== cardId) {
            return;
        }

        const ownedCount = getOwnedCount(card.id);

        const ownedText = el.querySelector('p:nth-of-type(3)');
        ownedText.textContent = `Owned: ${ownedCount}`;

        const sellBtn = el.querySelector('.sell');
        const marketBtn = el.querySelector('.market');
        const tradeBtn = el.querySelector('.trade');

        const disabled = ownedCount === 0;

        sellBtn.disabled = disabled;
        marketBtn.disabled = disabled;
        if (tradeBtn) tradeBtn.disabled = disabled;

        const thumbWrap = el.querySelector('.card-thumb-wrap');
        let badge = el.querySelector('.card-missing-badge');

        if (disabled) {
            el.classList.add('missing-card');
            if (thumbWrap && !badge) {
                badge = document.createElement('span');
                badge.className = 'card-missing-badge';
                badge.innerHTML = '<i class="fas fa-lock" aria-hidden="true"></i> Niet in bezit';
                thumbWrap.prepend(badge);
            }
        } else {
            el.classList.remove('missing-card');
            badge?.remove();
        }
    });

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
            c.getCard
                ? c.getCard()
                : tcgdex.card.get(c.id)
        )
    );

    setTitle.textContent = set.name;

    rerender();
}

// ---------------- START ----------------

loadSet();