import TCGdex from '@tcgdex/sdk';
import MemoryCache from '@cachex/memory';

const tcgdex = new TCGdex('en');
tcgdex.setCache(new MemoryCache());

const API = window.location.port === '5173'
    ? 'http://localhost/pss/api'
    : `${window.location.origin}/pss/api`;

// ---------------- STATE ----------------

let marketCards = [];
let currentUserId = null;
let ownedCards = [];

const cardCache = new Map();
const setCache = new Map();

// ---------------- DEBUG ----------------

function log(...args) {
    console.log("🟡 MARKET:", ...args);
}

// ---------------- USER ----------------

async function loadUser() {

    const res = await fetch(`${API}/users.php`, {
        credentials: 'include'
    });

    const data = await res.json();

    log("USER:", data);

    currentUserId = data.user_id;
}

// ---------------- OWNED CARDS ----------------

async function loadOwnedCards() {

    const res = await fetch(`${API}/get_collection.php`, {
        credentials: 'include'
    });

    const data = await res.json();

    log("OWNED CARDS:", data);

    ownedCards = data.data || data || [];
}

// ---------------- MARKET DATA ----------------

async function loadMarket() {

    const res = await fetch(`${API}/get_market.php`, {
        credentials: 'include'
    });

    const data = await res.json();

    log("RAW MARKET:", data);

    marketCards = data.data || data || [];

    log("PARSED MARKET:", marketCards);

    await renderMarketplace();
}

// ---------------- CARD FETCH ----------------

async function getCard(cardId) {

    if (cardCache.has(cardId)) {
        return cardCache.get(cardId);
    }

    try {

        const card = await tcgdex.card.get(cardId);

        cardCache.set(cardId, card);

        return card;

    } catch (err) {

        console.error("❌ CARD FETCH FAIL:", cardId, err);

        return null;
    }
}

// ---------------- SET CACHE ----------------

async function getSetData(setId) {

    if (setCache.has(setId)) {
        return setCache.get(setId);
    }

    try {

        const data = await tcgdex.set.get(setId);

        setCache.set(setId, data);

        return data;

    } catch (err) {

        console.error("❌ SET FETCH FAIL:", setId, err);

        return null;
    }
}

// ---------------- IMAGE ----------------

function imageUrl(card) {

    if (!card) return '';

    if (card.image) {

        return card.image.startsWith('http')
            ? card.image
            : card.image;
    }

    return '';
}

// ---------------- OWNERSHIP ----------------

function ownsCard(cardId) {

    return ownedCards.some(c => c.card_id === cardId);
}

// ---------------- SET PROGRESS ----------------

async function getSetProgress(card) {

    if (!card?.set?.id) {
        return null;
    }

    try {

        const setData = await getSetData(card.set.id);

        if (!setData) {
            return null;
        }

        const totalCards = setData.cardCount?.total || 0;

        const ownedInSet = ownedCards.filter(c =>
            c.card_id.startsWith(card.set.id)
        ).length;

        const percentage = totalCards > 0
            ? Math.round((ownedInSet / totalCards) * 100)
            : 0;

        return {
            total: totalCards,
            owned: ownedInSet,
            percentage
        };

    } catch (err) {

        console.error("❌ SET PROGRESS ERROR:", err);

        return null;
    }
}

// ---------------- PRICE ----------------

function isRare(card) {

    return /rare|holo|v|vmax|vstar|gx|ex|secret|gold/i
        .test((card.rarity || '').toLowerCase());
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

    if (!price) return "No pricing";

    return `€${price.toFixed(2)}`;
}

// ---------------- RENDER MARKET ----------------

async function renderMarketplace() {

    const el = document.getElementById('marketplace');

    el.innerHTML = '';

    log("RENDER START");

    if (!marketCards.length) {

        el.innerHTML = '<p>No cards in market</p>';

        return;
    }

    for (const item of marketCards) {

        log("ITEM:", item);

        const card = await getCard(item.card_id);

        if (!card) {

            log("SKIP MISSING CARD:", item.card_id);

            continue;
        }

        const isOwner = item.user_id == currentUserId;

        const alreadyOwned = ownsCard(item.card_id);

        const setProgress = await getSetProgress(card);

        const div = document.createElement('div');

        div.className = isOwner
            ? 'card own-card'
            : 'card';

        div.innerHTML = `
            <img 
                src="${imageUrl(card)}/high.webp" 
                width="120" 
                style="border-radius:8px;"
            >

            <h3>${card.name || 'Unknown'}</h3>

            <p class="seller">
                Listed by: ${item.username || 'Unknown'}
            </p>

            <p class="price">
                ${formatPrice(card)}
            </p>

            <p class="owned-status">
                ${alreadyOwned
                    ? '✅ Already owned'
                    : '❌ Missing'}
            </p>

            <p class="set-name">
                Set: ${card.set?.name || 'Unknown'}
            </p>

            <p class="set-progress">
                ${
                    setProgress
                        ? `Set Progress: ${setProgress.owned}/${setProgress.total} (${setProgress.percentage}%)`
                        : 'Set Progress: Unknown'
                }
            </p>

            <button ${isOwner ? 'disabled' : ''}>
                ${isOwner ? 'Your listing' : 'Buy'}
            </button>
        `;

        const button = div.querySelector('button');

        button.onclick = async () => {

            if (isOwner) {

                log("BLOCKED OWN BUY");

                return;
            }

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

                log("BUY RESULT:", data);

                if (data.success) {

                    await loadOwnedCards();
                    await loadMarket();

                } else {

                    alert(data.error || 'Purchase failed');
                }

            } catch (err) {

                console.error("❌ BUY ERROR:", err);

                alert('Server error');
            }
        };

        el.appendChild(div);
    }
}

// ---------------- START ----------------

(async () => {

    try {

        log("START");

        await loadUser();

        await loadOwnedCards();

        await loadMarket();

        log("READY");

    } catch (err) {

        console.error("❌ MARKET ERROR:", err);
    }

})();