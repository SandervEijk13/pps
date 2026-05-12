import TCGdex from '@tcgdex/sdk';
import MemoryCache from '@cachex/memory';

// ─────────────────────────────────────────
//  SDK
// ─────────────────────────────────────────
const tcgdex = new TCGdex('en');
tcgdex.setCache(new MemoryCache());

// ─────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────
function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

function getImageUrl(card) {
    if (!card) return null;
    const setCode = card.set?.code;
    const localId  = card.localId || card.number;
    if (setCode && localId) {
        return `https://assets.tcgdex.net/en/${setCode}/${localId}/high.webp`;
    }
    if (card.image) {
        const img = card.image;
        if (/\.(png|jpg|jpeg|webp)$/i.test(img)) {
            return img.startsWith('http') ? img : `https://assets.tcgdex.net${img}`;
        }
        return `${img}/high.webp`;
    }
    return null;
}

function isEnergy(card) {
    return (card.category || card.supertype || '').toLowerCase() === 'energy';
}

function isRare(card) {
    return /rare|holo|v\b|vmax|vstar|gx|ex|shiny|illustration|ultra|secret|gold|rainbow|hyper/i.test(card.rarity || '');
}

function pickRandom(arr, n = 1) {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return n === 1 ? shuffled[0] : shuffled.slice(0, n);
}

// ─────────────────────────────────────────
//  CARD SLOT → INJECT REAL IMAGE
// ─────────────────────────────────────────
function injectCardImages(cards) {
    const slots = document.querySelectorAll('.pokemon-card');
    slots.forEach((slot, i) => {
        const card = cards[i];
        if (!card) return;

        const front = slot.querySelector('.pokemon-card-front');
        const imgUrl = getImageUrl(card);

        if (front && imgUrl) {
            // Use an img element so we can track load / error
            const img = document.createElement('img');
            img.src = imgUrl;
            img.alt = card.name || 'Pokémon Card';
            img.className = 'real-card-img';

            img.onerror = () => {
                // fallback to webp → png → low
                const fallbacks = [
                    imgUrl.replace('high.webp', 'high.png'),
                    imgUrl.replace('high.webp', 'low.webp'),
                    imgUrl.replace('high.webp', 'low.png'),
                ];
                let fbIdx = 0;
                const tryNext = () => {
                    if (fbIdx < fallbacks.length) {
                        img.src = fallbacks[fbIdx++];
                    }
                };
                img.onerror = tryNext;
                tryNext();
            };

            // Clear any inline background-image previously set for the front
            front.style.backgroundImage = 'none';
            front.style.backgroundColor = '#fff';
            front.appendChild(img);
        }

        // Tag the slot with rarity class for shine effects
        if (isRare(card)) slot.classList.add('is-rare');
        if (isEnergy(card)) slot.classList.add('is-energy');

        // Tooltip / title
        slot.title = `${card.name || '?'} — ${card.rarity || 'Unknown rarity'}`;
        slot.dataset.cardName   = card.name   || '';
        slot.dataset.cardRarity = card.rarity || '';
    });
}

// ─────────────────────────────────────────
//  PACK ANIMATION CONTROLLER
// ─────────────────────────────────────────
let packCards = [];       // the 10 drawn cards
let revealIndex = 0;      // which card we're showing next
let reviewMode = false;

const packEl        = document.getElementById('pack');
const topFlap       = packEl?.querySelector('.top-flap');
const bottomPart    = document.getElementById('bottomPart');
const packImage     = document.getElementById('packImage');
const peelImage     = document.querySelector('.peelImage');
const cardsContainer = document.getElementById('cardsContainer');
const packCardEls   = document.querySelectorAll('.pokemon-card');
const setNameEl     = document.getElementById('setNameTitle');
const loadingEl     = document.getElementById('packLoading');
const errorEl       = document.getElementById('packError');

// ── SPREAD CARDS IN A FAN LAYOUT ──────────────────────
function spreadCards() {
    const total = packCardEls.length;   // 10
    const containerW = window.innerWidth;
    const containerH = window.innerHeight;

    const cardW  = 180;
    const cardH  = 252;
    const cols   = Math.min(5, total);
    const rows   = Math.ceil(total / cols);
    const gapX   = Math.min(200, (containerW * 0.85) / cols);
    const gapY   = Math.min(300, (containerH * 0.72) / rows);

    const startX = containerW / 2 - ((cols - 1) * gapX) / 2 - cardW / 2;
    const startY = containerH / 2 - ((rows - 1) * gapY) / 2 - cardH / 2;

    packCardEls.forEach((card, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x   = startX + col * gapX;
        const y   = startY + row * gapY;

        card.style.left = `${x}px`;
        card.style.top  = `${y}px`;

        // Small random tilt for realism
        const tilt = (Math.random() - 0.5) * 6;
        card.style.transform = `rotate(${tilt}deg)`;
        card.dataset.tilt    = tilt;
    });
}

// ── FLIP NEXT CARD ────────────────────────────────────
function flipNextCard() {
    const card = packCardEls[revealIndex];
    if (!card) return;
    card.classList.add('flipped');
    revealIndex++;
}

let reviewAbortController = null;

// ── REVIEW MODE ───────────────────────────────────────
function enterReviewMode() {
    reviewMode = true;
    cardsContainer.classList.add('review-mode');

    const tooltip = document.getElementById('cardTooltip');

    // Cancel any prior review listeners
    if (reviewAbortController) reviewAbortController.abort();
    reviewAbortController = new AbortController();
    const { signal } = reviewAbortController;

    packCardEls.forEach(card => {
        card.style.pointerEvents = 'auto';
        card.classList.add('hoverable');

        // Show card name + rarity on hover
        card.addEventListener('mouseenter', () => {
            if (!tooltip) return;
            const name   = card.dataset.cardName   || '?';
            const rarity = card.dataset.cardRarity || 'Unknown';
            tooltip.textContent = `${name} — ${rarity}`;
            tooltip.classList.add('visible');
        }, { signal });
        card.addEventListener('mouseleave', () => {
            if (!tooltip) return;
            tooltip.classList.remove('visible');
        }, { signal });
    });

    // Hide click hint
    const hint = document.getElementById('clickHint');
    if (hint) hint.style.opacity = '0';

    // Show "open another" button
    const btn = document.getElementById('openAnotherBtn');
    if (btn) btn.style.display = 'flex';
}

// ── PACK CLICK: TEAR OPEN → SHOW CARDS ───────────────
function handlePackClick() {
    if (!packEl) return;

    // Animate tear
    if (peelImage)  peelImage.classList.add('peel-image-animate');
    if (topFlap)    topFlap.classList.add('zakkenEnVerdwijn');
    if (bottomPart) bottomPart.classList.add('zakkenEnVerdwijnOnder');
    if (packImage)  packImage.classList.add('zakkenEnVerdwijnFoto');

    packEl.style.pointerEvents = 'none';

    setTimeout(() => {
        // Hide pack completely
        packEl.style.display = 'none';

        // Show cards container
        cardsContainer.style.opacity = '1';
        cardsContainer.classList.add('show');

        spreadCards();

        // Auto-flip cards one by one, then enter review mode
        let delay = 300;
        for (let i = 0; i < packCardEls.length; i++) {
            setTimeout(flipNextCard, delay);
            delay += 280;
        }
        // After all flips, enter review mode
        setTimeout(enterReviewMode, delay + 100);
    }, 1600);
}

// ─────────────────────────────────────────
//  BUILD A PACK (10 CARDS)
// ─────────────────────────────────────────
function buildPack(fullCards) {
    const energies  = fullCards.filter(c => isEnergy(c));
    const rares     = fullCards.filter(c => !isEnergy(c) && isRare(c));
    const normals   = fullCards.filter(c => !isEnergy(c) && !isRare(c));

    // Fallbacks: if set has no energies / rares use normals
    const energyPool  = energies.length  ? energies  : normals;
    const rarePool    = rares.length     ? rares     : normals;
    const normalPool  = normals.length   ? normals   : fullCards;

    const pack = [];

    // Slot 1: guaranteed rare / holo
    const rare = pickRandom(rarePool);
    if (rare) pack.push(rare);

    // Slot 2: energy (or normal if no energy in set)
    const energy = pickRandom(energyPool);
    if (energy) pack.push(energy);

    // Fill remaining slots with normals (allow duplicates like real packs)
    while (pack.length < 10) {
        const card = pickRandom(normalPool);
        if (card) pack.push(card);
    }

    // Shuffle the full pack so rare isn't always first
    return pack.sort(() => Math.random() - 0.5);
}

// ─────────────────────────────────────────
//  FETCH SET & INITIALISE
// ─────────────────────────────────────────
async function init() {
    const setId = getQueryParam('set');

    if (!setId) {
        showError('No set selected. Go back and click a set.');
        return;
    }

    // Show loading state
    if (loadingEl) loadingEl.style.display = 'flex';
    if (packEl)    packEl.style.display    = 'none';

    try {
        // Fetch the set
        const setData = await tcgdex.fetch('sets', setId);

        if (!setData || !setData.cards || setData.cards.length === 0) {
            throw new Error(`Set "${setId}" not found or has no cards.`);
        }

        // Show set name
        if (setNameEl) setNameEl.textContent = setData.name || setId.toUpperCase();
        document.title = `Open Pack — ${setData.name || setId}`;

        // Set the pack artwork if the set has a logo
        const logoUrl = setData.logo ? `${setData.logo}.png` : null;
        if (logoUrl) {
            const packLogoImg = document.getElementById('packLogoImg');
            if (packLogoImg) {
                packLogoImg.src = logoUrl;
                packLogoImg.style.display = 'block';
            }
        }

        // Fetch full card data
        const fullCards = await Promise.all(
            setData.cards.map(async (c) => {
                if (typeof c.getCard === 'function') return c.getCard();
                if (c.id) return (await tcgdex.card.get(c.id)) || c;
                return c;
            })
        );

        packCards = buildPack(fullCards.filter(Boolean));

        // Inject real images into the card front faces
        injectCardImages(packCards);

        // Hide loading, show pack
        if (loadingEl) loadingEl.style.display = 'none';
        if (packEl)    packEl.style.display    = '';

        // Show hint
        const hint = document.getElementById('clickHint');
        if (hint) hint.style.opacity = '1';

        // Bind click
        packEl.addEventListener('click', () => {
            if (hint) hint.style.opacity = '0';
            handlePackClick();
        }, { once: true });

        console.log(`✅ Pack ready: ${setData.name} — ${packCards.length} cards drawn`);

    } catch (err) {
        console.error('Pack opener error:', err);
        showError(err.message || 'Failed to load the set. Please try again.');
    }
}

function showError(msg) {
    if (loadingEl)  loadingEl.style.display  = 'none';
    if (packEl)     packEl.style.display     = 'none';
    if (errorEl) {
        errorEl.textContent = `❌ ${msg}`;
        errorEl.style.display = 'flex';
    }
}

// ─────────────────────────────────────────
//  OPEN ANOTHER PACK (re-roll same set)
// ─────────────────────────────────────────
function resetPack() {
    // Reset reveal state
    revealIndex  = 0;
    reviewMode   = false;

    // Reset card slots
    packCardEls.forEach(card => {
        card.classList.remove('flipped', 'is-rare', 'is-energy', 'hoverable');
        card.style.transform    = '';
        card.style.pointerEvents = '';

        // Clear the injected real card image from the front face
        const front = card.querySelector('.pokemon-card-front');
        if (front) {
            const img = front.querySelector('.real-card-img');
            if (img) img.remove();
            front.style.backgroundImage  = '';
            front.style.backgroundColor = '';
        }

        // Remove tooltip attrs
        card.title = '';
        card.dataset.cardName   = '';
        card.dataset.cardRarity = '';
    });

    // Hide "open another" button & tooltip
    const btn     = document.getElementById('openAnotherBtn');
    const tooltip = document.getElementById('cardTooltip');
    if (btn)     btn.style.display = 'none';
    if (tooltip) tooltip.classList.remove('visible');

    // Hide cards, show pack
    cardsContainer.style.opacity = '0';
    cardsContainer.classList.remove('show', 'review-mode');

    if (packEl) {
        packEl.style.display    = '';
        packEl.style.pointerEvents = '';
    }
    if (topFlap)    topFlap.classList.remove('zakkenEnVerdwijn');
    if (bottomPart) bottomPart.classList.remove('zakkenEnVerdwijnOnder');
    if (packImage)  packImage.classList.remove('zakkenEnVerdwijnFoto');
    if (peelImage)  peelImage.classList.remove('peel-image-animate');

    // Re-run init for a fresh pack
    init();
}

document.getElementById('openAnotherBtn')?.addEventListener('click', resetPack);
document.getElementById('backBtn')?.addEventListener('click', () => {
    history.back();
});

// ─────────────────────────────────────────
//  BOOT
// ─────────────────────────────────────────
init();
