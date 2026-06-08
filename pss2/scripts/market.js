import TCGdex from '@tcgdex/sdk';
import MemoryCache from '@cachex/memory';

const tcgdex = new TCGdex('en');
tcgdex.setCache(new MemoryCache());

const API = window.location.port === '5173'
    ? 'http://localhost/pss/api'
    : `${window.location.origin}/pss/api`;

// ── STATE ──────────────────────────────────────────────────────────────────

let marketCards = [];
let filteredCards = [];
let currentUserId = null;
let ownedCards = [];
let activeSetId = null;

let currentPage = 1;
const CARDS_PER_PAGE = 12;

const cardCache = new Map();

// ── USER ──────────────────────────────────────────────────────────────────

async function loadUser() {
    const res = await fetch(`${API}/users.php`, { credentials: 'include' });
    const data = await res.json();
    currentUserId = data.user_id;
}

// ── OWNED CARDS ───────────────────────────────────────────────────────────

async function loadOwnedCards() {
    const res = await fetch(`${API}/get_collection.php`, {
        credentials: 'include'
    });

    const data = await res.json();
    ownedCards = data.data || data || [];
}

// ── MARKET ────────────────────────────────────────────────────────────────

async function loadMarket() {
    const res = await fetch(`${API}/get_market.php`, {
        credentials: 'include'
    });

    const data = await res.json();
    marketCards = data.data || data || [];

    await renderMarketplace();
}

// ── CARD ──────────────────────────────────────────────────────────────────

async function getCard(cardId) {
    if (cardCache.has(cardId)) {
        return cardCache.get(cardId);
    }

    try {
        const card = await tcgdex.card.get(cardId);
        cardCache.set(cardId, card);
        return card;
    } catch {
        return null;
    }
}

// ── IMAGE ─────────────────────────────────────────────────────────────────

function imageUrl(card) {
    return card?.image || '';
}

// ── OWNERSHIP ─────────────────────────────────────────────────────────────

function ownsCard(cardId) {
    return ownedCards.some(c => c.card_id === cardId);
}

// ── PRICE ─────────────────────────────────────────────────────────────────

function isRare(card) {
    return /rare|holo|v|vmax|vstar|gx|ex|secret|gold/i.test(
        (card.rarity || '').toLowerCase()
    );
}

function getPrice(card) {
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

    for (const { card } of filteredCards) {
        if (card?.set) {
            uniqueSets.set(card.set.id, card.set.name);
        }
    }

    const allBtn = document.createElement('button');
    allBtn.textContent = 'All Sets';

    if (activeSetId === null) {
        allBtn.classList.add('active-set-filter');
    }

    allBtn.onclick = async () => {
        activeSetId = null;
        currentPage = 1;

        const search =
            document.getElementById('pokemonSearch')?.value.trim() || '';

        await renderMarketplace(search);
    };

    container.appendChild(allBtn);

    for (const [setId, setName] of uniqueSets) {
        const btn = document.createElement('button');

        btn.textContent = setName;

        if (activeSetId === setId) {
            btn.classList.add('active-set-filter');
        }

        btn.onclick = async () => {
            activeSetId = setId;
            currentPage = 1;

            const search =
                document.getElementById('pokemonSearch')?.value.trim() || '';

            await renderMarketplace(search);
        };

        container.appendChild(btn);
    }
}

// ── MARKETPLACE RENDER ────────────────────────────────────────────────────

async function renderMarketplace(filter = '') {
    const el = document.getElementById('marketplace');

    if (!el) return;

    el.innerHTML = '';

    if (!marketCards.length) {
        el.innerHTML = '<p>No cards listed in the marketplace yet.</p>';
        return;
    }

    filteredCards = [];

    for (const item of marketCards) {
        const card = await getCard(item.card_id);

        if (!card) continue;

        if (
            filter &&
            !card.name.toLowerCase().includes(filter.toLowerCase())
        ) {
            continue;
        }

        if (activeSetId && card.set?.id !== activeSetId) {
            continue;
        }

        filteredCards.push({ item, card });
    }

    await renderSetFilters();

    const totalPages = Math.max(
        1,
        Math.ceil(filteredCards.length / CARDS_PER_PAGE)
    );

    if (currentPage > totalPages) {
        currentPage = totalPages;
    }

    const start = (currentPage - 1) * CARDS_PER_PAGE;
    const end = start + CARDS_PER_PAGE;

    const pageCards = filteredCards.slice(start, end);

    if (!pageCards.length) {
        el.innerHTML = '<p>No cards found.</p>';
        return;
    }

    for (const { item, card } of pageCards) {
        const isOwner = item.user_id == currentUserId;

        const div = document.createElement('div');
        div.className = isOwner ? 'card own-card' : 'card';

        div.innerHTML = `
            ${
                isOwner
                    ? '<span class="own-badge">Your listing</span>'
                    : ''
            }

            <img
                src="${imageUrl(card)}/high.webp"
                alt="${card.name}"
                width="128"
            >

            <h3>${card.name}</h3>

            <p class="set-name">
                ${card.set?.name || 'Unknown set'}
            </p>

            <p class="seller">
                Listed by <strong>${item.username}</strong>
            </p>

            <p class="price">
                ${formatPrice(card)}
            </p>

            <button ${isOwner ? 'disabled' : ''}>
                ${isOwner ? 'Your listing' : 'Buy card'}
            </button>
        `;

        const button = div.querySelector('button');

        button.onclick = async () => {
            if (isOwner) return;

            try {
                const res = await fetch(`${API}/buy_from_market.php`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        marketId: item.id,
                        cardId: item.card_id,
                        sellerId: item.user_id
                    })
                });

                const data = await res.json();

                if (data.success) {
                    await loadOwnedCards();
                    await loadMarket();
                } else {
                    alert(data.error || 'Purchase failed');
                }
            } catch {
                alert('Server error');
            }
        };

        el.appendChild(div);
    }

    renderPagination(totalPages, filter);
}

// ── PAGINATION ────────────────────────────────────────────────────────────

function renderPagination(totalPages, filter = '') {
    let pagination = document.getElementById('pagination');

    if (!pagination) {
        pagination = document.createElement('div');
        pagination.id = 'pagination';

        document
            .getElementById('marketplace')
            ?.after(pagination);
    }

    pagination.innerHTML = '';

    const prev = document.createElement('button');
    prev.textContent = '← Previous';
    prev.disabled = currentPage === 1;

    prev.onclick = async () => {
        currentPage--;
        await renderMarketplace(filter);
    };

    const info = document.createElement('span');
    info.textContent = ` Page ${currentPage} of ${totalPages} `;

    const next = document.createElement('button');
    next.textContent = 'Next →';
    next.disabled = currentPage >= totalPages;

    next.onclick = async () => {
        currentPage++;
        await renderMarketplace(filter);
    };

    pagination.append(prev, info, next);
}

// ── SEARCH ────────────────────────────────────────────────────────────────

const searchInput = document.getElementById('pokemonSearch');

if (searchInput) {
    searchInput.addEventListener('input', async e => {
        currentPage = 1;
        await renderMarketplace(e.target.value.trim());
    });
}

// ── BOOT ──────────────────────────────────────────────────────────────────

(async () => {
    try {
        await loadUser();
        await loadOwnedCards();
        await loadMarket();
    } catch (err) {
        console.error(err);
    }
})();