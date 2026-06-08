import { pickWeightedReelItem, preloadImageUrls } from '/scripts/card_logic.js';

export const REEL_TOTAL = 55;
export const REEL_WIN_INDEX = 48;
export const REEL_SPIN_MS = 5500;
export const REEL_OPEN_DELAY_MS = 600;

const RARITY_LABELS = {
    common: 'Common',
    rare: 'Rare',
    epic: 'Epic',
    legendary: 'Legendary'
};

function pickFiller(items) {
    return { ...items[Math.floor(Math.random() * items.length)] };
}

export function buildReelStrip(crateItems, winner, winIndex = REEL_WIN_INDEX, total = REEL_TOTAL) {
    const strip = [];
    for (let i = 0; i < total; i++) {
        strip.push(i === winIndex ? { ...winner } : pickFiller(crateItems));
    }
    return strip;
}

function createCardElement(item, isWinner) {
    const el = document.createElement('div');
    el.className = `item-card rarity-${item.rarity || 'common'}`;
    if (isWinner) el.dataset.winner = '1';
    el.innerHTML = `
        <img src="${item.image}" alt="${item.name}" loading="eager" decoding="async" />
        <span class="iname">${item.name}</span>
        <span class="irarity">${item.rarityLabel || RARITY_LABELS[item.rarity] || item.rarity || ''}</span>
    `;
    return el;
}

export class CrateReel {
    constructor({ trackEl, wrapEl, markerEl }) {
        this.trackEl = trackEl;
        this.wrapEl = wrapEl;
        this.markerEl = markerEl;
    }

    measureCardStep() {
        const first = this.trackEl?.querySelector('.item-card');
        if (!first) return 216;
        const gap = parseFloat(getComputedStyle(this.trackEl).gap) || 16;
        return first.getBoundingClientRect().width + gap;
    }

    show() {
        this.wrapEl?.classList.remove('is-hidden');
        this.markerEl?.classList.add('is-visible');
    }

    hide() {
        this.wrapEl?.classList.add('is-hidden');
        this.markerEl?.classList.remove('is-visible');
    }

    render(strip) {
        if (!this.trackEl) return;
        this.trackEl.innerHTML = '';
        this.trackEl.classList.remove('spinning');

        const lead = document.createElement('div');
        lead.className = 'reel-spacer';
        lead.setAttribute('aria-hidden', 'true');
        this.trackEl.appendChild(lead);

        strip.forEach((item, i) => {
            this.trackEl.appendChild(createCardElement(item, i === REEL_WIN_INDEX));
        });

        const trail = document.createElement('div');
        trail.className = 'reel-spacer';
        trail.setAttribute('aria-hidden', 'true');
        this.trackEl.appendChild(trail);

        this.trackEl.style.transform = 'translateX(0)';
    }

    getTranslateX() {
        const m = new DOMMatrixReadOnly(getComputedStyle(this.trackEl).transform);
        return m.m41;
    }

    getOffsetToCenterWinner() {
        const winnerEl = this.trackEl.querySelector("[data-winner='1']");
        const viewport = this.wrapEl?.querySelector('.reel-viewport');
        if (!winnerEl || !viewport) {
            return -(REEL_WIN_INDEX * this.measureCardStep());
        }

        const viewRect = viewport.getBoundingClientRect();
        const cardRect = winnerEl.getBoundingClientRect();
        const viewCenter = viewRect.left + viewRect.width / 2;
        const cardCenter = cardRect.left + cardRect.width / 2;
        return this.getTranslateX() + (viewCenter - cardCenter);
    }

    spin() {
        return new Promise((resolve) => {
            let finished = false;
            const done = () => {
                if (finished) return;
                finished = true;
                this.trackEl.removeEventListener('transitionend', onEnd);
                this.trackEl.classList.remove('spinning');
                resolve();
            };

            const onEnd = (e) => {
                if (e.target !== this.trackEl || e.propertyName !== 'transform') return;
                done();
            };

            this.trackEl.classList.remove('spinning');
            this.trackEl.style.transform = 'translateX(0)';
            this.trackEl.offsetHeight;

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    const offset = this.getOffsetToCenterWinner();
                    this.trackEl.classList.add('spinning');
                    this.trackEl.style.transform = `translateX(${offset}px)`;
                    this.trackEl.addEventListener('transitionend', onEnd);
                    setTimeout(done, REEL_SPIN_MS + 400);
                });
            });
        });
    }
}

export async function spinCrate(crate, reel, fixedWinner = null) {
    const winner = fixedWinner || pickWeightedReelItem(crate.items || []);
    if (!winner) return null;

    const strip = buildReelStrip(crate.items, winner);
    reel.show();
    reel.render(strip);
    await preloadImageUrls(strip.map((item) => item.image));
    await new Promise((r) => setTimeout(r, REEL_OPEN_DELAY_MS));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await reel.spin();
    return winner;
}
