const ANIMATION = {
    introHoldMs: 320,
    topRipMs: 1800,
    bottomSlideMs: 1800,
    settleMs: 120
};

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCardImage(card) {
    if (card?.getImageURL) {
        return card.getImageURL('high', 'webp');
    }

    if (typeof card?.image === 'string') {
        if (card.image.startsWith('http')) {
            return card.image;
        }
        return `https://assets.tcgdex.net${card.image}`;
    }

    return '';
}

function getCardPrice(card) {
    const p = card?.pricing?.cardmarket;
    if (!p) return null;
    const values = [p.low, p.trend, p.avg1, p.avg7, p.avg30]
        .filter((v) => typeof v === 'number' && v >= 0);
    if (!values.length) return null;
    return Math.max(...values);
}

function formatPrice(card) {
    const value = getCardPrice(card);
    return value == null ? 'No price' : `EUR ${value.toFixed(2)}`;
}

function showCardsLoader(cardsContainer, message = 'Loading cards...') {
    cardsContainer.classList.add('is-visible');
    cardsContainer.innerHTML = `
        <div class="pack-open-loading">
            <div class="pack-open-spinner" aria-hidden="true"></div>
            <p>${message}</p>
        </div>
    `;
}

function renderReview(reviewContainer, cards, callbacks = {}) {
    if (!reviewContainer) return;
    const rows = cards.map((card, index) => `
        <div class="pack-review-row" data-review-index="${index}">
            <img class="pack-review-thumb" src="${getCardImage(card)}" alt="${card.name || 'Card'}" />
            <div class="pack-review-meta">
                <span class="pack-review-name">${card.name || 'Unknown card'}</span>
                <span class="pack-review-rarity">${card.rarity || 'Unknown'}</span>
            </div>
            <span class="pack-review-price">${formatPrice(card)}</span>
            <div class="pack-review-actions">
                <button type="button" class="pack-review-btn btn-sell">Sell</button>
                <button type="button" class="pack-review-btn btn-keep">Keep</button>
            </div>
        </div>
    `).join('');

    reviewContainer.innerHTML = `
        <h3>Pack review</h3>
        <div class="pack-review-list">${rows}</div>
    `;
    reviewContainer.classList.add('is-visible');

    reviewContainer.querySelectorAll('.pack-review-row').forEach((rowEl) => {
        const index = Number(rowEl.dataset.reviewIndex || -1);
        const card = cards[index];
        if (!card) return;

        const sellBtn = rowEl.querySelector('.btn-sell');
        const keepBtn = rowEl.querySelector('.btn-keep');

        if (sellBtn) {
            sellBtn.addEventListener('click', async () => {
                if (!callbacks.onSellCard) return;
                sellBtn.disabled = true;
                keepBtn.disabled = true;
                const result = await callbacks.onSellCard(card);
                rowEl.classList.add(result?.success ? 'is-sold' : 'is-error');
            });
        }

        if (keepBtn) {
            keepBtn.addEventListener('click', async () => {
                if (!callbacks.onKeepCard) return;
                keepBtn.disabled = true;
                sellBtn.disabled = true;
                const result = await callbacks.onKeepCard(card);
                rowEl.classList.add(result?.success ? 'is-kept' : 'is-error');
            });
        }
    });
}

function renderCards(cardsContainer, reviewContainer, cards = [], callbacks = {}) {
    cardsContainer.innerHTML = '';
    const count = cards.length || 1;
    const center = (count - 1) / 2;
    let vanishedCount = 0;

    cards.forEach((card, index) => {
        const offsetFromCenter = index - center;
        const x = offsetFromCenter * 74;
        const rot = offsetFromCenter * 5.5;
        const y = Math.abs(offsetFromCenter) * 7;

            const image = getCardImage(card);
            const el = document.createElement('div');
            el.className = 'pack-open-card';
        el.style.setProperty('--fan-x', `${x}px`);
        el.style.setProperty('--fan-y', `${y}px`);
        el.style.setProperty('--fan-rot', `${rot}deg`);
        el.style.setProperty('--stack-order', `${100 + index}`);
            el.innerHTML = `
                <div class="pack-open-card-inner">
                    <div class="pack-open-card-face pack-open-card-back"></div>
                    <div class="pack-open-card-face pack-open-card-front">
                        <img src="${image}" alt="${card.name || 'Card'}" />
                        <h3>${card.name || 'Unknown card'}</h3>
                        <p>${card.rarity || 'Unknown rarity'}</p>
                    </div>
                </div>
            `;

        el.dataset.cardState = 'back';
        el.addEventListener('click', () => {
            const state = el.dataset.cardState || 'back';

            if (state === 'back') {
                el.classList.add('is-flipped');
                el.dataset.cardState = 'flipped';
                return;
            }

            if (state === 'flipped') {
                el.classList.add('is-vanished');
                el.dataset.cardState = 'vanished';
                vanishedCount += 1;
                if (vanishedCount >= cards.length) {
                    renderReview(reviewContainer, cards, callbacks);
                }
            }
            });

            cardsContainer.appendChild(el);

        // Deal cards out from the pack one-by-one into a rainbow fan.
        setTimeout(() => {
            el.classList.add('is-dealt');
        }, 20 + (index * 45));
        });
}

export async function runPackOpenAnimation({
    overlay,
    scene,
    shell,
    cardsContainer,
    reviewContainer,
    cards = [],
    cardsPromise,
    callbacks = {}
}) {
    if (!overlay || !scene || !shell || !cardsContainer) {
        throw new Error('Missing pack animation elements');
    }

    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    cardsContainer.classList.remove('is-visible');
    cardsContainer.innerHTML = '';
    scene.style.display = 'grid';
    shell.classList.remove('is-opening');
    if (reviewContainer) {
        reviewContainer.classList.remove('is-visible');
        reviewContainer.innerHTML = '';
    }
    showCardsLoader(cardsContainer, 'Preparing your cards...');

    const cardsTask = cardsPromise || Promise.resolve(cards);

    await sleep(ANIMATION.introHoldMs);
    shell.classList.add('is-opening');
    await sleep(ANIMATION.topRipMs + ANIMATION.bottomSlideMs + ANIMATION.settleMs);

    const finalCards = await cardsTask;
    renderCards(cardsContainer, reviewContainer, finalCards, callbacks);
    scene.style.display = 'none';
}

export function closePackOpenAnimation({ overlay, scene, shell, cardsContainer, reviewContainer, isBusy = false, force = false }) {
    if (!force && isBusy) return;
    if (!overlay || !scene || !shell || !cardsContainer) return;

    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    shell.classList.remove('is-opening');
    scene.style.display = 'grid';
    cardsContainer.classList.remove('is-visible');
    cardsContainer.innerHTML = '';
    if (reviewContainer) {
        reviewContainer.classList.remove('is-visible');
        reviewContainer.innerHTML = '';
    }
}
