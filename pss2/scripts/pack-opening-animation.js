import { resolveTcgdexImageUrl } from '/scripts/card_logic.js';

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
    return resolveTcgdexImageUrl(card, {
        cardId: card?.id || card?.cardId,
        set: card?.set?.id,
        localId: card?.localId || card?.number,
    });
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

const STACK_OFFSET_X = 14;
const STACK_OFFSET_Y = 3;

function renderReview(reviewContainer, decisions = [], overlay = null) {
    if (!reviewContainer) return;

    const rows = decisions.map(({ card, action, success }) => {
        const choiceLabel = action === 'sell' ? 'Sold' : 'Kept';
        const choiceClass = action === 'sell' ? 'is-sold' : 'is-kept';
        const statusClass = success ? choiceClass : 'is-error';

        return `
        <div class="pack-review-row ${statusClass}">
            <img class="pack-review-thumb" src="${getCardImage(card)}" alt="${card.name || 'Card'}" />
            <div class="pack-review-meta">
                <span class="pack-review-name">${card.name || 'Unknown card'}</span>
                <span class="pack-review-rarity">${card.rarity || 'Unknown'}</span>
            </div>
            <span class="pack-review-price">${formatPrice(card)}</span>
            <span class="pack-review-choice">${choiceLabel}</span>
        </div>
    `;
    }).join('');

    reviewContainer.innerHTML = `
        <h3>Your picks</h3>
        <div class="pack-review-list">${rows}</div>
    `;
    reviewContainer.classList.add('is-visible');
    if (overlay) {
        overlay.classList.add('has-review');
    }
}

function updateStackLayout(cardElements, activeIndex) {
    cardElements.forEach((el, index) => {
        if (index < activeIndex) {
            el.classList.add('is-vanished');
            el.classList.remove('is-active');
            return;
        }

        const depth = index - activeIndex;
        el.classList.remove('is-vanished');
        el.style.setProperty('--stack-x', `${depth * STACK_OFFSET_X}px`);
        el.style.setProperty('--stack-y', `${depth * STACK_OFFSET_Y}px`);
        el.style.setProperty('--stack-order', `${100 - depth}`);
        el.classList.toggle('is-active', index === activeIndex);
    });
}

function resetCardTab(cardTab) {
    if (!cardTab) return;

    const nameEl = cardTab.querySelector('.pack-tab-name');
    const rarityEl = cardTab.querySelector('.pack-tab-rarity');
    const priceEl = cardTab.querySelector('.pack-tab-price');
    const actionsEl = cardTab.querySelector('.pack-tab-actions');
    const hintEl = cardTab.querySelector('.pack-tab-hint');
    const sellBtn = cardTab.querySelector('.btn-sell');
    const keepBtn = cardTab.querySelector('.btn-keep');

    if (nameEl) nameEl.textContent = '—';
    if (rarityEl) rarityEl.textContent = '—';
    if (priceEl) priceEl.textContent = '—';
    if (actionsEl) actionsEl.hidden = true;
    if (hintEl) hintEl.hidden = false;
    if (sellBtn) sellBtn.disabled = false;
    if (keepBtn) keepBtn.disabled = false;

    cardTab.classList.remove('is-ready');
    cardTab.setAttribute('aria-hidden', 'true');
}

function bindCardTab(cardTab, callbacks) {
    if (!cardTab || cardTab.dataset.bound === '1') return;

    const sellBtn = cardTab.querySelector('.btn-sell');
    const keepBtn = cardTab.querySelector('.btn-keep');
    let pendingChoice = null;

    const choose = async (action) => {
        if (!pendingChoice) return;
        sellBtn.disabled = true;
        keepBtn.disabled = true;
        const { card, onChosen } = pendingChoice;
        const result = action === 'sell'
            ? await callbacks.onSellCard?.(card)
            : await callbacks.onKeepCard?.(card);
        pendingChoice = null;
        resetCardTab(cardTab);
        onChosen({ action, success: Boolean(result?.success) });
    };

    sellBtn?.addEventListener('click', () => choose('sell'));
    keepBtn?.addEventListener('click', () => choose('keep'));
    cardTab.dataset.bound = '1';

    return (card, onChosen) => {
        pendingChoice = { card, onChosen };
        const nameEl = cardTab.querySelector('.pack-tab-name');
        const rarityEl = cardTab.querySelector('.pack-tab-rarity');
        const priceEl = cardTab.querySelector('.pack-tab-price');
        const actionsEl = cardTab.querySelector('.pack-tab-actions');
        const hintEl = cardTab.querySelector('.pack-tab-hint');

        if (nameEl) nameEl.textContent = card.name || 'Unknown card';
        if (rarityEl) rarityEl.textContent = card.rarity || 'Unknown rarity';
        if (priceEl) priceEl.textContent = formatPrice(card);
        if (actionsEl) actionsEl.hidden = false;
        if (hintEl) hintEl.hidden = true;
        if (sellBtn) sellBtn.disabled = false;
        if (keepBtn) keepBtn.disabled = false;

        cardTab.classList.add('is-ready');
        cardTab.setAttribute('aria-hidden', 'false');
    };
}

function renderCards(cardsContainer, reviewContainer, cards = [], callbacks = {}, overlay = null, workspace = null, cardTab = null) {
    cardsContainer.innerHTML = '';
    workspace?.classList.add('is-visible');
    cardsContainer.classList.add('is-visible');
    resetCardTab(cardTab);
    const revealCardTab = bindCardTab(cardTab, callbacks);

    const decisions = [];
    let activeIndex = 0;
    const cardElements = [];

    cards.forEach((card, index) => {
        const image = getCardImage(card);
        const el = document.createElement('div');
        el.className = 'pack-open-card';
        el.style.setProperty('--stack-x', `${index * STACK_OFFSET_X}px`);
        el.style.setProperty('--stack-y', `${index * STACK_OFFSET_Y}px`);
        el.style.setProperty('--stack-order', `${100 - index}`);
        el.innerHTML = `
            <div class="pack-open-card-inner">
                <div class="pack-open-card-face pack-open-card-back"></div>
                <div class="pack-open-card-face pack-open-card-front">
                    <img src="${image}" alt="${card.name || 'Card'}" />
                </div>
            </div>
        `;

        el.dataset.cardState = 'back';
        el.addEventListener('click', () => {
            if (index !== activeIndex || el.dataset.cardState !== 'back') return;

            el.classList.add('is-flipped');
            el.dataset.cardState = 'flipped';
            revealCardTab?.(card, ({ action, success }) => {
                decisions.push({ card, action, success });
                el.classList.add('is-vanished');
                el.dataset.cardState = 'done';
                activeIndex += 1;

                if (activeIndex >= cards.length) {
                    workspace?.classList.remove('is-visible');
                    cardsContainer.classList.remove('is-visible');
                    resetCardTab(cardTab);
                    renderReview(reviewContainer, decisions, overlay);
                    return;
                }

                updateStackLayout(cardElements, activeIndex);
            });
        });

        cardsContainer.appendChild(el);
        cardElements.push(el);

        setTimeout(() => {
            el.classList.add('is-dealt');
        }, 20 + (index * 45));
    });

    updateStackLayout(cardElements, activeIndex);
}

export async function runPackOpenAnimation({
    overlay,
    scene,
    shell,
    cardsContainer,
    workspace,
    cardTab,
    reviewContainer,
    cards = [],
    cardsPromise,
    callbacks = {}
}) {
    if (!overlay || !scene || !shell || !cardsContainer) {
        throw new Error('Missing pack animation elements');
    }

    overlay.classList.add('is-open');
    overlay.classList.remove('has-review');
    overlay.setAttribute('aria-hidden', 'false');
    cardsContainer.classList.remove('is-visible');
    cardsContainer.innerHTML = '';
    workspace?.classList.remove('is-visible');
    resetCardTab(cardTab);
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
    renderCards(cardsContainer, reviewContainer, finalCards, callbacks, overlay, workspace, cardTab);
    scene.style.display = 'none';
}

export function closePackOpenAnimation({
    overlay,
    scene,
    shell,
    cardsContainer,
    workspace,
    cardTab,
    reviewContainer,
    isBusy = false,
    force = false
}) {
    if (!force && isBusy) return;
    if (!overlay || !scene || !shell || !cardsContainer) return;

    overlay.classList.remove('is-open', 'has-review');
    overlay.setAttribute('aria-hidden', 'true');
    shell.classList.remove('is-opening');
    scene.style.display = 'grid';
    cardsContainer.classList.remove('is-visible');
    cardsContainer.innerHTML = '';
    workspace?.classList.remove('is-visible');
    resetCardTab(cardTab);
    if (reviewContainer) {
        reviewContainer.classList.remove('is-visible');
        reviewContainer.innerHTML = '';
    }
}
