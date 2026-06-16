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

const PACK_SAVED_NOTICE = 'If there is a bug/issue, refresh. The cards have already been saved in your collection.';

function showPackSavedNotice(noticeEl) {
    if (!noticeEl) return;
    noticeEl.textContent = PACK_SAVED_NOTICE;
    noticeEl.hidden = false;
    noticeEl.classList.add('is-visible');
}

function hidePackSavedNotice(noticeEl) {
    if (!noticeEl) return;
    noticeEl.hidden = true;
    noticeEl.classList.remove('is-visible');
    noticeEl.textContent = '';
}

const STACK_OFFSET_X = 14;
const STACK_OFFSET_Y = 3;

function renderReview(reviewContainer, cards = [], overlay = null) {
    if (!reviewContainer) return;

    const rows = cards.map((card) => `
        <div class="pack-review-row is-saved">
            <img class="pack-review-thumb" src="${getCardImage(card)}" alt="${card.name || 'Card'}" />
            <div class="pack-review-meta">
                <span class="pack-review-name">${card.name || 'Unknown card'}</span>
                <span class="pack-review-rarity">${card.rarity || 'Unknown'}</span>
            </div>
            <span class="pack-review-price">${formatPrice(card)}</span>
            <span class="pack-review-choice">Saved</span>
        </div>
    `).join('');

    reviewContainer.innerHTML = `
        <h3>Your pack</h3>
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
    const hintEl = cardTab.querySelector('.pack-tab-hint');

    if (nameEl) nameEl.textContent = '—';
    if (rarityEl) rarityEl.textContent = '—';
    if (priceEl) priceEl.textContent = '—';
    if (hintEl) {
        hintEl.hidden = false;
        hintEl.textContent = 'Click the top card to reveal';
    }

    cardTab.classList.remove('is-ready');
    cardTab.setAttribute('aria-hidden', 'true');
}

function showCardInTab(cardTab, card) {
    if (!cardTab) return;

    const nameEl = cardTab.querySelector('.pack-tab-name');
    const rarityEl = cardTab.querySelector('.pack-tab-rarity');
    const priceEl = cardTab.querySelector('.pack-tab-price');
    const hintEl = cardTab.querySelector('.pack-tab-hint');

    if (nameEl) nameEl.textContent = card.name || 'Unknown card';
    if (rarityEl) rarityEl.textContent = card.rarity || 'Unknown rarity';
    if (priceEl) priceEl.textContent = formatPrice(card);
    if (hintEl) {
        hintEl.hidden = false;
        hintEl.textContent = 'Click the card again to continue';
    }

    cardTab.classList.add('is-ready');
    cardTab.setAttribute('aria-hidden', 'false');
}

function renderCards(cardsContainer, reviewContainer, cards = [], overlay = null, workspace = null, cardTab = null) {
    cardsContainer.innerHTML = '';
    workspace?.classList.add('is-visible');
    cardsContainer.classList.add('is-visible');
    resetCardTab(cardTab);

    const viewedCards = [];
    let activeIndex = 0;
    const cardElements = [];

    const advanceCard = (el, card) => {
        viewedCards.push(card);
        el.classList.add('is-vanished');
        el.dataset.cardState = 'done';
        activeIndex += 1;
        resetCardTab(cardTab);

        if (activeIndex >= cards.length) {
            workspace?.classList.remove('is-visible');
            cardsContainer.classList.remove('is-visible');
            renderReview(reviewContainer, viewedCards, overlay);
            return;
        }

        updateStackLayout(cardElements, activeIndex);
    };

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
            if (index !== activeIndex) return;

            if (el.dataset.cardState === 'back') {
                el.classList.add('is-flipped');
                el.dataset.cardState = 'flipped';
                showCardInTab(cardTab, card);
                return;
            }

            if (el.dataset.cardState === 'flipped') {
                advanceCard(el, card);
            }
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
    noticeEl,
    cards = [],
    cardsPromise
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
    hidePackSavedNotice(noticeEl);
    showCardsLoader(cardsContainer, 'Preparing your cards...');

    const cardsTask = cardsPromise || Promise.resolve(cards);

    await sleep(ANIMATION.introHoldMs);
    shell.classList.add('is-opening');
    await sleep(ANIMATION.topRipMs + ANIMATION.bottomSlideMs + ANIMATION.settleMs);

    const finalCards = await cardsTask;
    showPackSavedNotice(noticeEl);
    renderCards(cardsContainer, reviewContainer, finalCards, overlay, workspace, cardTab);
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
    noticeEl,
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
    hidePackSavedNotice(noticeEl);
}