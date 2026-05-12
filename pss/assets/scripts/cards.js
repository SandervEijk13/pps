import TCGdex from '@tcgdex/sdk';
import MemoryCache from '@cachex/memory';

const tcgdex = new TCGdex('en');
tcgdex.setCache(new MemoryCache());

// ----------------------
// DEBUG STARTUP
// ----------------------

console.debug('TCGdex initialized:', tcgdex);

const cardsGrid = document.getElementById('cardsGrid');
const setTitle = document.getElementById('setTitle');
const setInfo = document.getElementById('setInfo');

console.debug('DOM Elements:', {
    cardsGrid,
    setTitle,
    setInfo
});

let currentSetCode = null;

// ----------------------
// QUERY PARAM
// ----------------------

function getQueryParam(name) {
    const value = new URLSearchParams(window.location.search).get(name);

    console.debug('Query param:', {
        name,
        value
    });

    return value;
}

// ----------------------
// IMAGE URL
// ----------------------

function getImageUrl(card, quality = 'high', extension = 'webp') {
    console.debug('Generating image URL for card:', {
        card,
        quality,
        extension
    });

    if (!card) {
        console.warn('No card provided to getImageUrl');
        return null;
    }

    if (typeof card.getImageURL === 'function') {
        const generated = card.getImageURL(quality, extension);

        console.debug('Using getImageURL():', generated);

        return generated;
    }

    if (card.image && typeof card.image === 'string') {
        const imageUrl = card.image.startsWith('http')
            ? card.image
            : `https://assets.tcgdex.net${card.image}`;

        console.debug('Using card.image:', imageUrl);

        return imageUrl;
    }

    const setCode = card.set?.code || currentSetCode;
    const cardId = card.localId || card.number;

    if (setCode && cardId) {
        const fallback =
            `https://assets.tcgdex.net/en/${setCode}/${cardId}/${quality}.${extension}`;

        console.debug('Using fallback image URL:', fallback);

        return fallback;
    }

    console.warn('Unable to generate image URL for card:', card);

    return null;
}

// ----------------------
// PRICE FORMAT
// ----------------------

function formatPriceValue(value) {
    console.debug('Formatting price:', value);

    if (typeof value !== 'number') {
        return String(value);
    }

    return `€${value.toFixed(2)}`;
}

// ----------------------
// BUILD PRICING
// ----------------------

function buildPriceElement(card) {
    console.debug('Building price element for card:', card.name);

    const pricing = card.pricing;

    console.debug('Raw pricing object:', pricing);

    const container = document.createElement('div');
    container.className = 'card-pricing';

    // ----------------------
    // NO PRICING CHECK
    // ----------------------

    if (
        !pricing ||
        !pricing.cardmarket
    ) {
        console.warn('No Cardmarket pricing available for card:', card.name);

        const message = document.createElement('div');
        message.className = 'price-empty';
        message.textContent = '💰 No pricing data available';

        container.appendChild(message);

        return container;
    }

    // ----------------------
    // CARDMARKET DATA
    // ----------------------

    const cardmarket = pricing.cardmarket;

    console.debug('Cardmarket pricing:', cardmarket);

    // ----------------------
    // PRICE FIELDS
    // ----------------------

    const possiblePrices = [
        cardmarket.lowPrice,
        cardmarket.trendPrice,
        cardmarket.avg1,
        cardmarket.avg7,
        cardmarket.avg30,
        cardmarket.reverseHoloLow,
        cardmarket.reverseHoloTrend,
        cardmarket.reverseHoloAvg1,
        cardmarket.reverseHoloAvg7,
        cardmarket.reverseHoloAvg30
    ];

    console.debug('Raw possible prices:', possiblePrices);

    // Remove invalid values and 0
    const validPrices = possiblePrices.filter(price =>
        typeof price === 'number' &&
        !isNaN(price) &&
        price > 0
    );

    console.debug('Valid prices:', validPrices);

    if (!validPrices.length) {
        console.warn('No valid prices found for:', card.name);

        const message = document.createElement('div');
        message.className = 'price-empty';
        message.textContent = '💰 No valid pricing available';

        container.appendChild(message);

        return container;
    }

    // ----------------------
    // DETERMINE RARITY TYPE
    // ----------------------

    const rarity = (card.rarity || '').toLowerCase();

    console.debug('Card rarity:', rarity);

    let selectedPrice = null;

    // Common / Uncommon = lowest price
    if (
        rarity.includes('common') ||
        rarity.includes('uncommon')
    ) {
        selectedPrice = Math.min(...validPrices);

        console.debug(
            'Using LOWEST price for common/uncommon:',
            selectedPrice
        );
    }

    // Rare = highest price
    else if (
        rarity.includes('rare')
    ) {
        selectedPrice = Math.max(...validPrices);

        console.debug(
            'Using HIGHEST price for rare:',
            selectedPrice
        );
    }

    // Fallback
    else {
        selectedPrice =
            cardmarket.trendPrice ||
            validPrices[0];

        console.debug(
            'Using fallback price:',
            selectedPrice
        );
    }

    // ----------------------
    // RENDER PRICE
    // ----------------------

    const priceText = document.createElement('div');
    priceText.className = 'price-value-main';
    priceText.textContent = formatPriceValue(selectedPrice);

    container.appendChild(priceText);

    console.debug(
        'Finished building pricing element for:',
        card.name,
        {
            rarity,
            selectedPrice
        }
    );

    return container;
}

// ----------------------
// IMAGE SOURCES
// ----------------------

function getCardImageSources(card) {
    const sources = [
        getImageUrl(card, 'high', 'webp'),
        getImageUrl(card, 'low', 'webp'),
        getImageUrl(card, 'high', 'png'),
        getImageUrl(card, 'low', 'png')
    ].filter(Boolean);

    console.debug('Card image sources:', {
        card: card.name,
        sources
    });

    return sources;
}

// ----------------------
// CARD ELEMENT
// ----------------------

function createCardElement(card) {
    console.debug('Creating card element:', {
        id: card.id,
        name: card.name
    });

    const cardEl = document.createElement('article');
    cardEl.className = 'card-item';

    const imageWrapper = document.createElement('div');
    imageWrapper.className = 'card-thumb';

    const img = document.createElement('img');

    img.alt = card.name || 'Pokémon card';

    const sources = getCardImageSources(card);

    let sourceIndex = 0;

    if (sources.length) {
        img.src = sources[sourceIndex];

        console.debug('Initial image source:', img.src);
    }

    img.onerror = () => {
        console.warn('Image failed to load:', img.src);

        sourceIndex += 1;

        if (sourceIndex < sources.length) {
            console.debug('Trying fallback image:', sources[sourceIndex]);

            img.src = sources[sourceIndex];
            return;
        }

        console.error('All image sources failed:', card.name);

        img.src =
            'https://via.placeholder.com/300x420?text=No+image';

        img.alt = `${card.name || 'Card'} image unavailable`;
    };

    imageWrapper.appendChild(img);

    const info = document.createElement('div');
    info.className = 'card-info';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'card-name';
    nameDiv.textContent = card.name || 'Unknown card';

    const rarityDiv = document.createElement('div');
    rarityDiv.className = 'card-rarity';
    rarityDiv.textContent = card.rarity || 'No rarity';

    info.appendChild(nameDiv);
    info.appendChild(rarityDiv);

    cardEl.appendChild(imageWrapper);
    cardEl.appendChild(info);
    cardEl.appendChild(buildPriceElement(card));

    return cardEl;
}

// ----------------------
// ERROR
// ----------------------

function showError(message) {
    console.error('Showing error:', message);

    setTitle.textContent = 'Unable to load cards';
    setInfo.textContent = message;

    cardsGrid.innerHTML =
        `<div class="no-sets">${message}</div>`;
}

// ----------------------
// LOAD SET
// ----------------------

async function loadSet() {
    const setId = getQueryParam('set');

    console.debug('Loading set:', setId);

    if (!setId) {
        showError(
            'No set selected. Go back to the sets page and click a set.'
        );

        return;
    }

    setTitle.textContent =
        `Loading ${setId.toUpperCase()}...`;

    setInfo.textContent =
        'Fetching cards from the TCGdex API.';

    cardsGrid.innerHTML =
        '<div class="loading">Loading cards…</div>';

    try {
        console.debug('Fetching set data from API:', setId);

        const setData = await tcgdex.fetch('sets', setId);

        console.debug('Fetched setData:', setData);

        if (!setData || !setData.cards) {
            throw new Error('Set data unavailable.');
        }

        currentSetCode =
            setData.code ||
            setData.id ||
            currentSetCode;

        console.debug('Current set code:', currentSetCode);

        console.debug(
            'Cards in set:',
            setData.cards.length
        );

        console.table(
            setData.cards.map(card => ({
                id: card.id,
                name: card.name
            }))
        );

        const cards = await Promise.all(
            setData.cards.map(async card => {
                console.debug('Processing card:', card);

                if (
                    card &&
                    typeof card.getCard === 'function'
                ) {
                    console.debug(
                        'Using getCard() for:',
                        card.id
                    );

                    return card.getCard();
                }

                if (card && card.id) {
                    console.debug(
                        'Fetching full card data for:',
                        card.id
                    );

                    const fullCard =
                        await tcgdex.card.get(card.id);

                    console.debug(
                        'Fetched full card:',
                        fullCard
                    );

                    return fullCard || card;
                }

                console.warn(
                    'Returning raw card object:',
                    card
                );

                return card;
            })
        );

        console.debug('Final loaded cards:', cards);

        console.table(
            cards.map(card => ({
                id: card.id,
                name: card.name,
                rarity: card.rarity,
                hasPricing: !!card.pricing,
                hasCardmarket: !!card.pricing?.cardmarket
            }))
        );

        setTitle.textContent =
            `${setData.name || setId}`;

        setInfo.textContent =
            `${cards.length} cards loaded from ${setId.toUpperCase()}.`;

        cardsGrid.innerHTML = '';

        cards.forEach(card => {
            console.debug(
                'Appending card to DOM:',
                card.name
            );

            cardsGrid.appendChild(
                createCardElement(card)
            );
        });

        console.debug(
            'Finished rendering all cards'
        );

    } catch (err) {
        console.error('Failed to load set:', err);

        showError(
            err.message ||
            'Failed to load cards for this set.'
        );
    }
}

// ----------------------
// START
// ----------------------

console.debug('Starting card loader...');

loadSet();