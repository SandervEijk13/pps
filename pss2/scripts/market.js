import TCGdex from '@tcgdex/sdk';
import MemoryCache from '@cachex/memory';
import { resolveTcgdexImageUrl } from '/scripts/card_logic.js';
import { initGameInfo } from '/scripts/game-info.js';
import { openTradeWithUserFromMarket } from '/scripts/trade.js';
import { notification } from '/scripts/notifications.js';

const tcgdex = new TCGdex('en');
tcgdex.setCache(new MemoryCache());

const API = window.location.port === '5173'
    ? 'http://localhost/pss/api'
    : `${window.location.origin}/pss/api`;

const PAGE_SIZE = 12;

// ── STATE ──────────────────────────────────────────────────────────────────

let marketCards = [];
let currentUserId = null;
let ownedCards = [];
let activeSetId = null;
let currentPage = 1;

const cardCache = new Map();
const setCache  = new Map();

// ── USER ──────────────────────────────────────────────────────────────────

async function loadUser() {
    const res  = await fetch(`${API}/users.php`, { credentials: 'include' });
    const data = await res.json();
    currentUserId = data.user_id;
}

// ── OWNED CARDS ───────────────────────────────────────────────────────────

async function loadOwnedCards() {
    const res  = await fetch(`${API}/get_collection.php`, { credentials: 'include' });
    const data = await res.json();
    ownedCards = data.data || data || [];
}

// ── MARKET ────────────────────────────────────────────────────────────────

async function loadMarket() {
    const res  = await fetch(`${API}/get_market.php`, { credentials: 'include' });
    const data = await res.json();
    marketCards = data.data || data || [];
    await renderSetFilters();
    await renderMarketplace();
}

// ── CARD ─────────────────────────────────────────────────────────────────

async function getCard(cardId) {
    if (cardCache.has(cardId)) return cardCache.get(cardId);
    try {
        const card = await tcgdex.card.get(cardId);
        cardCache.set(cardId, card);
        return card;
    } catch { return null; }
}

// ── IMAGE ─────────────────────────────────────────────────────────────────

function imageUrl(card) {
    return resolveTcgdexImageUrl(card, {
        cardId: card?.id,
        set: card?.set?.id,
        localId: card?.localId || card?.number,
    });
}

// ── OWNERSHIP ─────────────────────────────────────────────────────────────

function ownsCard(cardId) {
    return ownedCards.some(c => c.card_id === cardId);
}

// ── PRICE ─────────────────────────────────────────────────────────────────

function isRare(card) {
    return /rare|holo|v|vmax|vstar|gx|ex|secret|gold/i
        .test((card.rarity || '').toLowerCase());
}

function getPrice(card) {
    const p = card.pricing?.cardmarket;
    if (!p) return 0;
    const values = [p.low, p.trend, p.avg1, p.avg7, p.avg30]
        .filter(v => typeof v === 'number' && v > 0);
    if (!values.length) return 0;
    return isRare(card) ? Math.max(...values) : Math.min(...values);
}

function formatPrice(card) {
    const price = getPrice(card);
    return price ? `€${price.toFixed(2)}` : 'No pricing';
}

// ── SET FILTERS ───────────────────────────────────────────────────────────

async function renderSetFilters() {
    const container = document.getElementById('setFilters');
    if (!container) return;
    container.innerHTML = '';

    const uniqueSets = new Map();
    for (const item of marketCards) {
        const card = await getCard(item.card_id);
        if (card?.set) uniqueSets.set(card.set.id, card.set.name);
    }

    const allBtn = document.createElement('button');
    allBtn.textContent = 'All Sets';
    allBtn.className = activeSetId === null ? 'active-set-filter' : '';
    allBtn.onclick = async () => {
        activeSetId = null;
        currentPage = 1;
        const search = document.getElementById('pokemonSearch')?.value || '';
        await renderMarketplace(search);
        await renderSetFilters();
    };
    container.appendChild(allBtn);

    for (const [setId, setName] of uniqueSets) {
        const btn = document.createElement('button');
        btn.textContent = setName;
        btn.className = activeSetId === setId ? 'active-set-filter' : '';
        btn.onclick = async () => {
            activeSetId = setId;
            currentPage = 1;
            const search = document.getElementById('pokemonSearch')?.value || '';
            await renderMarketplace(search);
            await renderSetFilters();
        };
        container.appendChild(btn);
    }
}

// ── MARKETPLACE RENDER ────────────────────────────────────────────────────

async function renderMarketplace(filter = '') {
    const el = document.getElementById('marketplace');
    const paginationEl = document.getElementById('pagination');
    if (!el) return;

    el.innerHTML = '';
    if (paginationEl) paginationEl.innerHTML = '';

    if (!marketCards.length) {
        el.innerHTML = '<p>No cards listed in the marketplace yet.</p>';
        return;
    }

    const normalizedFilter = filter.trim().toLowerCase();
    const cardsWithItems = await Promise.all(
        marketCards.map(async (item) => ({ item, card: await getCard(item.card_id) }))
    );

    const filteredCards = cardsWithItems.filter(({ card, item }) => {
        if (!card) return false;
        const matchesFilter = !normalizedFilter || card.name.toLowerCase().includes(normalizedFilter);
        const matchesSet = !activeSetId || card.set?.id === activeSetId;
        return matchesFilter && matchesSet;
    });

    const totalPages = Math.max(1, Math.ceil(filteredCards.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;

    if (!filteredCards.length) {
        el.innerHTML = '<p>No cards match your search.</p>';
        return;
    }

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageCards = filteredCards.slice(start, start + PAGE_SIZE);

    for (const { item, card } of pageCards) {

        console.log({
    listingUser: item.user_id,
    currentUser: currentUserId,
    equalLoose: item.user_id == currentUserId,
    equalStrict: item.user_id === currentUserId
});

        const isOwner = item.user_id == currentUserId;

        const div = document.createElement('div');
        div.className = isOwner ? 'card own-card' : 'card';

        if (isOwner) {
            const badge = document.createElement('span');
            badge.className = 'own-badge';
            badge.textContent = 'Your listing';
            div.appendChild(badge);
        }

        div.innerHTML += `
            <img
                src="${imageUrl(card)}"
                alt="${card.name}"
                width="128"
                loading="lazy"
            >
            <h3>${card.name}</h3>
            <p class="set-name">${card.set?.name || 'Unknown set'}</p>
            <p class="seller">
                <a href="profile.html?id=${item.user_id}" class="seller-link">
                    Listed by <strong>${item.username}</strong>
                </a>
            </p>
            <p class="price">${formatPrice(card)}</p>
            <div class="market-card-actions">
                ${
                    isOwner
                        ? '<button type="button" class="market-remove-btn">Remove from Market</button>'
                        : `
                            <button class="market-buy-btn">Buy card</button>
                            <button type="button" class="market-trade-btn">Trade</button>
                        `
                }
            </div>
        `;

        const buyBtn = div.querySelector('.market-buy-btn');
        buyBtn.onclick = async () => {
            if (isOwner) return;
            try {
                const res  = await fetch(`${API}/buy_from_market.php`, {
                    method:  'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        marketId: item.id,
                        cardId:   item.card_id,
                        sellerId: item.user_id
                    })
                });
                const data = await res.json();
                if (data.success) {
                    await loadOwnedCards();
                    await loadMarket();
                } else {
                    notification({
                        text: data.error || 'Purchase failed',
                        duration: 5000,
                        type: 'error',
                        closeable: true
                    });
                }
            } catch {
                notification({
                    text: 'Server error',
                    duration: 5000,
                    type: 'error',
                    closeable: true
                });
            }
        };

        const removeBtn = div.querySelector('.market-remove-btn');

        removeBtn?.addEventListener('click', async () => {

            if (!confirm('Remove this card from the marketplace?')) {
                return;
            }

            try {

                const res = await fetch(`${API}/remove_from_market.php`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        marketId: item.id
                    })
                });

                const data = await res.json();

                if (data.success) {
                    await loadOwnedCards();
                    await loadMarket();
                } else {
                    notification({
                        text: data.message || 'Failed to remove listing',
                        duration: 5000,
                        type: 'error',
                        closeable: true
                    });
                }

            } catch (err) {
                
                notification({
                    text: 'Server error' || err.message,
                    duration: 5000,
                    type: 'error',
                    closeable: true
                });
            }
        });

        const tradeBtn = div.querySelector('.market-trade-btn');
        tradeBtn?.addEventListener('click', async (e) => {
            e.preventDefault();
            if (Number(item.user_id) === Number(currentUserId)) {
                notification({
                    text: 'Je kunt niet met jezelf traden',
                    duration: 5000,
                    type: 'error',
                    closeable: true
                });
                return;
            }
            try {
                await openTradeWithUserFromMarket(Number(item.user_id), item.username);
            } catch (err) {
                notification({
                    text: err.message || 'Trade kon niet gestart worden',
                    duration: 5000,
                    type: 'error',
                    closeable: true
                });
            }
        });

        el.appendChild(div);
    }

    if (paginationEl && totalPages > 1) {
        const pageLabel = document.createElement('span');
        pageLabel.className = 'page-label';
        pageLabel.textContent = `Page ${currentPage} of ${totalPages}`;
        paginationEl.appendChild(pageLabel);

        const prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.textContent = 'Previous';
        prevBtn.disabled = currentPage === 1;
        prevBtn.onclick = async () => {
            if (currentPage > 1) {
                currentPage -= 1;
                await renderMarketplace(filter);
            }
        };
        paginationEl.appendChild(prevBtn);

        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.textContent = 'Next';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.onclick = async () => {
            if (currentPage < totalPages) {
                currentPage += 1;
                await renderMarketplace(filter);
            }
        };
        paginationEl.appendChild(nextBtn);
    }
}

// ── SEARCH ────────────────────────────────────────────────────────────────

const searchInput = document.getElementById('pokemonSearch');
if (searchInput) {
    searchInput.addEventListener('input', async (e) => {
        currentPage = 1;
        await renderMarketplace(e.target.value.trim());
    });
}

// ── BOOT ──────────────────────────────────────────────────────────────────

initGameInfo();

(async () => {
    try {
        await loadUser();
        await loadOwnedCards();
        await loadMarket();
    } catch (err) {
        notification({
            text: `Failed to load marketplace: ${err.message}`,
            duration: 5000,
            type: 'error',
            closeable: true
        });
    }
})();