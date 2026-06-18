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
const setCompletionBar = document.getElementById('setCompletionBar');
const setCompletionPct = document.getElementById('setCompletionPct');
const setCompletionCount = document.getElementById('setCompletionCount');
const setCompletionFill = document.getElementById('setCompletionFill');
const bulkSellDuplicatesBtn = document.getElementById('bulkSellDuplicatesBtn');

let ownedCards = [];
let ownedAmounts = new Map();
let currentCards = [];
let currentSetCode = '';
let currentSetId = '';
let favoriteCardIds = new Set();
let wishlistCardIds = new Set();

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

    ownedAmounts = new Map();
    for (const row of data) {
        const id = row.card_id;
        const amt = Number(row.card_amount) || 0;
        if (!id || amt <= 0) continue;
        ownedAmounts.set(id, (ownedAmounts.get(id) || 0) + amt);
    }

    ownedCards = [];
    for (const [cardId, amount] of ownedAmounts.entries()) {
        ownedCards.push(...Array(amount).fill(cardId));
    }
}

async function loadWishlistCards() {
    try {
        const res = await fetch(`${API}/wishlist.php?action=get`, { credentials: 'include' });
        const data = res.ok ? await res.json() : { items: [] };
        const rows = Array.isArray(data.items) ? data.items : [];
        wishlistCardIds = new Set(rows.map((row) => String(row.card_id || '')));
    } catch {
        wishlistCardIds = new Set();
    }
}

async function loadFavoriteCards() {
    try {
        const res = await fetch(`${API}/favorite.php?action=get`, { credentials: 'include' });
        const rows = res.ok ? await res.json() : [];
        favoriteCardIds = new Set((Array.isArray(rows) ? rows : []).map((row) => String(row.card_id || '')));
    } catch {
        favoriteCardIds = new Set();
    }
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
    return ownedAmounts.get(id) || 0;
}

// ---------------- SELL ----------------

async function sellCard(cardId, cardValue = 0) {

    const res = await fetch(`${API}/sell_cards.php`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cardId, cardValue })
    });

    return await res.json();
}

function countDuplicatesInSet() {
    let total = 0;
    const setPrefix = currentSetId ? `${currentSetId.toLowerCase()}-` : '';

    for (const [cardId, amount] of ownedAmounts.entries()) {
        if (amount <= 1) continue;
        if (setPrefix && !cardId.toLowerCase().startsWith(setPrefix)) continue;
        total += amount - 1;
    }

    return total;
}

function buildBulkSellItems() {
    const priceById = new Map(currentCards.map((c) => [c.id, c]));
    const items = [];

    for (const [cardId, amount] of ownedAmounts.entries()) {
        if (amount <= 1) continue;
        if (currentSetId && !cardId.toLowerCase().startsWith(`${currentSetId.toLowerCase()}-`)) {
            continue;
        }

        const card = priceById.get(cardId);
        const cardValue = card ? (getCardPrice(card) || 0.5) : 0.5;

        items.push({
            cardId,
            qty: amount - 1,
            cardValue,
        });
    }

    return items;
}

function estimateBulkSellCoins(items) {
    return items.reduce((sum, item) => sum + item.cardValue * 0.8 * item.qty, 0);
}

async function readSellResponse(res) {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch {
        throw new Error(`Ongeldige server response: ${text.slice(0, 120)}`);
    }
}

async function bulkSellDuplicates() {
    const items = buildBulkSellItems();
    const duplicateCount = items.reduce((sum, item) => sum + item.qty, 0);

    if (duplicateCount <= 0) {
        alert('No duplicate cards in this set.');
        return;
    }

    const estCoins = estimateBulkSellCoins(items);
    const ok = confirm(
        `${duplicateCount} duplicate cards for ~${estCoins.toFixed(0)} coins?\n` +
        'Je houdt altijd 1 exemplaar per kaart.'
    );
    if (!ok) return;

    bulkSellDuplicatesBtn.disabled = true;

    try {
        const res = await fetch(`${API}/sell_cards.php?action=bulkDuplicates`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ setId: currentSetId, items }),
        });

        const data = await readSellResponse(res);
        if (!data.success) {
            alert(data.message || 'Bulk sell failed');
            return;
        }

        await loadOwnedCards();
        alert(`${data.cardsSold} cards sold (+${Number(data.coinsAdded || 0).toFixed(0)} coins)`);
        rerender();
    } catch (err) {
        console.error(err);
        alert(err.message || 'Bulk sell failed');
    } finally {
        bulkSellDuplicatesBtn.disabled = false;
    }
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
            ${ownedCount ? '' : '<span class="card-missing-badge"><i class="fas fa-lock" aria-hidden="true"></i> Not owned</span>'}
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

        <button
            type="button"
            class="favorite ${favoriteCardIds.has(card.id) ? 'is-active' : ''}">
            ${favoriteCardIds.has(card.id) ? 'Remove Favourite' : 'Add Favourite'}
        </button>

        <button
            type="button"
            class="wishlist ${wishlistCardIds.has(card.id) ? 'is-active' : ''}">
            ${wishlistCardIds.has(card.id) ? 'Remove from Wishlist' : 'Add to Wishlist'}
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

            const res = await sellCard(card.id, getCardPrice(card));

            if (res.success) {

                const next = (ownedAmounts.get(card.id) || 1) - 1;
                if (next > 0) ownedAmounts.set(card.id, next);
                else ownedAmounts.delete(card.id);

                ownedCards = [];
                for (const [cardId, amount] of ownedAmounts.entries()) {
                    ownedCards.push(...Array(amount).fill(cardId));
                }

                if (res.coinsAdded > 0) {
                    console.log(`+${res.coinsAdded} coins`);
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

    const favoriteBtn = el.querySelector('.favorite');
    favoriteBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        favoriteBtn.disabled = true;
        const isActive = favoriteCardIds.has(card.id);
        try {
            const res = await fetch(`${API}/favorite.php?action=${isActive ? 'remove' : 'add'}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cardId: card.id }),
            });
            const data = await res.json();
            if (!data.success) {
                alert(data.message || 'Could not update favourite.');
                return;
            }
            if (isActive) favoriteCardIds.delete(card.id);
            else favoriteCardIds.add(card.id);
            favoriteBtn.classList.toggle('is-active', !isActive);
            favoriteBtn.textContent = !isActive ? 'Remove Favourite' : 'Add Favourite';
        } catch {
            alert('Could not update favourite.');
        } finally {
            favoriteBtn.disabled = false;
        }
    });

    const wishlistBtn = el.querySelector('.wishlist');
    wishlistBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        wishlistBtn.disabled = true;
        const isActive = wishlistCardIds.has(card.id);
        try {
            const res = await fetch(`${API}/wishlist.php?action=${isActive ? 'remove' : 'add'}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cardId: card.id }),
            });
            const data = await res.json();
            if (!data.success) {
                alert(data.message || 'Could not update wishlist.');
                return;
            }
            if (isActive) wishlistCardIds.delete(card.id);
            else wishlistCardIds.add(card.id);
            wishlistBtn.classList.toggle('is-active', !isActive);
            wishlistBtn.textContent = !isActive ? 'Remove from Wishlist' : 'Add to Wishlist';
        } catch {
            alert('Could not update wishlist.');
        } finally {
            wishlistBtn.disabled = false;
        }
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
                badge.innerHTML = '<i class="fas fa-lock" aria-hidden="true"></i> Not owned';
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

    const total = currentCards.length;
    const pct = total > 0 ? Math.round((ownedCount / total) * 100) : 0;

    setInfo.textContent = `${ownedCount}/${total} unique cards · ${pct}% complete`;

    if (setCompletionBar) {
        setCompletionBar.hidden = total === 0;
        if (setCompletionPct) setCompletionPct.textContent = `${pct}%`;
        if (setCompletionCount) setCompletionCount.textContent = `${ownedCount}/${total}`;
        if (setCompletionFill) setCompletionFill.style.width = `${pct}%`;
    }

    if (bulkSellDuplicatesBtn) {
        const dupes = countDuplicatesInSet();
        bulkSellDuplicatesBtn.hidden = dupes <= 0;
        bulkSellDuplicatesBtn.title = dupes > 0
            ? `Sell ${dupes} duplicate cards (keeps 1 per card)`
            : '';
    }
}

// ---------------- LOAD SET ----------------

async function loadSet() {

    const setId = new URLSearchParams(window.location.search).get('set');

    if (!setId) return;

    currentSetId = setId;
    setTitle.textContent = 'Loading...';

    await loadOwnedCards();
    await loadFavoriteCards();
    await loadWishlistCards();

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

bulkSellDuplicatesBtn?.addEventListener('click', bulkSellDuplicates);

// ---------------- START ----------------

loadSet();