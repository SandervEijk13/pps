import TCGdex from '@tcgdex/sdk';
import MemoryCache from '@cachex/memory';
import { openPack, formatHeaderCoins } from '/scripts/card_logic.js';
import { runPackOpenAnimation, closePackOpenAnimation } from '/scripts/pack-opening-animation.js';
import { initGameInfo } from '/scripts/game-info.js';
import { notification } from '/scripts/notifications.js';

const tcgdex = new TCGdex('en');
tcgdex.setCache(new MemoryCache());

const API = window.location.port === '5173'
    ? 'http://localhost/pss/api'
    : `${window.location.origin}/pss/api`;

const shopGrid = document.getElementById('shopGrid');
const priceFilter = document.getElementById('priceFilter');
const eraFilter = document.getElementById('eraFilter');
const maxPriceFilter = document.getElementById('maxPriceFilter');
const packSearch = document.getElementById('packSearch');
const inventoryGrid = document.getElementById('inventoryGrid');
const openInventoryBtn = document.getElementById('openInventoryBtn');
const closeInventoryBtn = document.getElementById('closeInventoryBtn');
const coinsAmount = document.getElementById('coin-amount');

function ensurePackOverlay() {
    let overlay = document.getElementById('packOpenOverlay');
    if (!overlay) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div id="packOpenOverlay" class="pack-open-overlay" aria-hidden="true">
                <div class="pack-open-stage" id="packOpenStage">
                    <p id="packOpenNotice" class="pack-open-notice" hidden></p>
                    <button id="closePackOverlayBtn" class="close-pack-overlay-btn" type="button">Close</button>
                    <div class="pack-open-scene" id="packOpenScene">
                        <div class="pack-open-shell" id="packOpenShell">
                            <div class="pack-open-half pack-open-top"></div>
                            <div class="pack-open-half pack-open-bottom"></div>
                        </div>
                    </div>
                    <div id="packOpenWorkspace" class="pack-open-workspace">
                        <div id="packOpenCards" class="pack-open-cards"></div>
                        <aside id="packOpenCardTab" class="pack-open-card-tab" aria-hidden="true">
                            <span class="pack-tab-label">Card details</span>
                            <h3 id="packTabName" class="pack-tab-name">—</h3>
                            <p id="packTabRarity" class="pack-tab-rarity">—</p>
                            <p id="packTabPrice" class="pack-tab-price">—</p>
                            <p id="packTabHint" class="pack-tab-hint">Click the top card to reveal</p>
                        </aside>
                    </div>
                    <div id="packOpenReview" class="pack-open-review"></div>
                </div>
            </div>
        `;
        document.body.appendChild(wrapper.firstElementChild);
        overlay = document.getElementById('packOpenOverlay');
    }

    return {
        overlay,
        stage: document.getElementById('packOpenStage'),
        scene: document.getElementById('packOpenScene'),
        shell: document.getElementById('packOpenShell'),
        cardsContainer: document.getElementById('packOpenCards'),
        workspace: document.getElementById('packOpenWorkspace'),
        cardTab: document.getElementById('packOpenCardTab'),
        reviewContainer: document.getElementById('packOpenReview'),
        noticeEl: document.getElementById('packOpenNotice'),
        closeBtn: document.getElementById('closePackOverlayBtn')
    };
}

let allPacks = [];
let enrichedPacks = [];
let isOpeningPack = false;
let isLoadingInventory = false;
const setNameCache = new Map();
const autoOpenSetFromUrl = new URLSearchParams(window.location.search).get('openSet');
let autoOpenConsumed = false;

const eraLookup = {
    base: 'Base',
    gym: 'Gym',
    neo: 'Neo',
    lc: 'Legendary Collection',
    ecard: 'E-Card',
    ex: 'EX',
    dp: 'Diamond & Pearl',
    pl: 'Platinum',
    hgss: 'HeartGold & SoulSilver',
    col: 'Call of Legends',
    bw: 'Black & White',
    xy: 'XY',
    sm: 'Sun & Moon',
    swsh: 'Sword & Shield',
    sv: 'Scarlet & Violet',
    me: 'Mega Evolution',
};

function getEraKey(setId) {
    const id = String(setId || '').toLowerCase();
    for (const key of Object.keys(eraLookup)) {
        if (id.startsWith(key)) return key;
    }
    return 'other';
}

function populateEraFilter() {
    if (!eraFilter) return;
    const eras = new Set(enrichedPacks.map((p) => p.eraKey).filter((k) => k && k !== 'other'));
    const ordered = Object.keys(eraLookup).filter((k) => eras.has(k));
    eraFilter.innerHTML = '<option value="all">Alle eras</option>';
    ordered.forEach((key) => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = eraLookup[key];
        eraFilter.appendChild(opt);
    });
}

async function getSetName(setCode) {
    if (!setCode) return 'Unknown set';
    if (setNameCache.has(setCode)) return setNameCache.get(setCode);
    let name = setCode;
    try {
        const set = await tcgdex.set.get(setCode);
        name = set?.name || setCode;
    } catch {
        name = setCode;
    }
    setNameCache.set(setCode, name);
    return name;
}

async function enrichPacks(packs) {
    const result = [];
    for (const pack of packs) {
        const setCode = resolveSetCode(pack);
        const setName = await getSetName(setCode);
        result.push({
            ...pack,
            setCode,
            setName,
            eraKey: getEraKey(setCode),
            searchText: `${setName} ${setCode} ${pack.name || ''}`.toLowerCase(),
        });
    }
    return result;
}

async function readApiJson(response, fallbackMessage = 'Invalid API response') {
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch {
        throw new Error(`${fallbackMessage}: ${text.slice(0, 180)}`);
    }
}

function resolveSetCode(pack) {
    return pack.tcgdex_set_id || pack.set_id || pack.setCode || pack.id || '';
}

async function loadPacks() {
    const response = await fetch(`${API}/get_packs_shop.php`, {
        credentials: 'include'
    });

    const packs = await response.json();
    allPacks = packs;
    enrichedPacks = await enrichPacks(packs);
    populateEraFilter();
    renderPacks();
}

async function refreshCoins() {
    const userId = sessionStorage.getItem('userId');
    if (!userId || !coinsAmount) return;

    try {
        const res = await fetch(`${API}/users.php?action=getCoins&id=${userId}`, {
            credentials: 'include'
        });
        const data = await readApiJson(res, 'Coins API returned non-JSON');
        if (data.success) {
            coinsAmount.textContent = formatHeaderCoins(data.coins);
        }
    } catch (error) {
        console.warn('Could not refresh coins:', error);
    }
}

async function buyPack(pack, setCode, setName) {
    if (isOpeningPack) return;
    isOpeningPack = true;

    try {
        const buyRes = await fetch(`${API}/user_packs.php?action=buy`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: Number(pack.price) || 0,
                tcgdex_set_id: setCode,
                set_name: setName
            })
        });

        const data = await readApiJson(buyRes, 'Buy pack API returned non-JSON');
        if (!data.success) {
            notification({
                text: `Failed to buy pack: ${data.message}`,
                duration: 5000,
                type: 'error',
                closeable: true
            });
            return;
        }

        await refreshCoins();
        await loadInventory();
        notification({
            text: 'Pack bought and added to your inventory.',
            duration: 5000,
            type: 'success',
            closeable: true
        });
    } catch (error) {
        console.error('Pack purchase failed:', error);
        notification({
            text: 'Could not buy this pack right now.',
            duration: 5000,
            type: 'error',
            closeable: true
        });
    } finally {
        isOpeningPack = false;
    }
}

async function consumeAndOpenPack(packId) {
    if (isOpeningPack) return;
    isOpeningPack = true;

    try {
        const res = await fetch(`${API}/user_packs.php?action=consume`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id: packId })
        });
        const data = await readApiJson(res, 'Open pack API returned non-JSON');

        if (!data.success) {
            notification({
                text: `Failed to open pack: ${data.message}`,
                duration: 5000,
                type: 'error',
                closeable: true
            });
            await loadInventory();
            return;
        }

        if (data.storyProgress && window.PokeNotifications) {
            window.PokeNotifications.showStoryProgress(data.storyProgress);
        }

        const pack = data.pack;
        const setCode = pack.tcgdex_set_id || pack.set_id;
        if (!setCode) {
            notification({
                text: 'This saved pack has no set code.',
                duration: 5000,
                type: 'error',
                closeable: true
            });
            await loadInventory();
            return;
        }

        const overlayRefs = ensurePackOverlay();
        await applyPackSetImages(overlayRefs.stage, setCode);
        await runPackOpenAnimation({
            overlay: overlayRefs.overlay,
            scene: overlayRefs.scene,
            shell: overlayRefs.shell,
            cardsContainer: overlayRefs.cardsContainer,
            workspace: overlayRefs.workspace,
            cardTab: overlayRefs.cardTab,
            reviewContainer: overlayRefs.reviewContainer,
            noticeEl: overlayRefs.noticeEl,
            cardsPromise: openPack(setCode).then(async (cards) => {
                await savePulledCardsToCollection(cards);
                return cards;
            })
        });

        await loadInventory();
    } catch (error) {
        console.error('Pack opening failed:', error);
        const overlayRefs = ensurePackOverlay();
        closePackOpenAnimation({
            overlay: overlayRefs.overlay,
            scene: overlayRefs.scene,
            shell: overlayRefs.shell,
            cardsContainer: overlayRefs.cardsContainer,
            workspace: overlayRefs.workspace,
            cardTab: overlayRefs.cardTab,
            reviewContainer: overlayRefs.reviewContainer,
            noticeEl: overlayRefs.noticeEl,
            force: true
        });
        notification({
            text: 'Could not open this pack right now.',
            duration: 5000,
            type: 'error',
            closeable: true
        });
    } finally {
        isOpeningPack = false;
    }
}

function resolveSetFamily(setCode = '') {
    const normalized = String(setCode || '').trim().toLowerCase();
    const match = normalized.match(/^[a-z]+/);
    return match ? match[0] : 'default';
}

function loadImageDimensions(src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({
            width: img.naturalWidth,
            height: img.naturalHeight
        });
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

function getBaseSetCode(setCode) {
    // Extract only letters at the start (e.g., "swsh10.5" -> "swsh")
    const match = String(setCode).match(/^[a-zA-Z]+/);
    return match ? match[0].toLowerCase() : '';
}

async function applyPackSetImages(stageEl, setCode = '') {
    if (!stageEl) return;
    const normalized = String(setCode || '').trim().toLowerCase();
    if (!normalized) return;

    const baseSet = getBaseSetCode(normalized);
    if (!baseSet) return;

    // Folder = baseSet (letters only), filename = full normalized code
    const topImage = `../images/packs_top/${normalized}.png`;
    const bottomImage = `../images/packs_bottom/${normalized}.png`;

    stageEl.style.setProperty('--pack-top-image', `url("${topImage}")`);
    stageEl.style.setProperty('--pack-bottom-image', `url("${bottomImage}")`);

    const shellEl = document.getElementById('packOpenShell');
    if (!shellEl) return;

    const [topSize, bottomSize] = await Promise.all([
        loadImageDimensions(topImage),
        loadImageDimensions(bottomImage)
    ]);

    if (!topSize || !bottomSize) return;

    const totalHeight = topSize.height + bottomSize.height;
    const maxWidth = Math.max(topSize.width, bottomSize.width);
    if (!totalHeight || !maxWidth) return;

    const topPct = (topSize.height / totalHeight) * 100;
    const bottomPct = (bottomSize.height / totalHeight) * 100;

    shellEl.style.setProperty('--pack-shell-ar', `${maxWidth} / ${totalHeight}`);
    shellEl.style.setProperty('--pack-top-height-pct', `${topPct}%`);
    shellEl.style.setProperty('--pack-bottom-height-pct', `${bottomPct}%`);
}

async function savePulledCardsToCollection(cards = []) {
    const results = await Promise.all(
        cards.map(async (card) => {
            try {
                const res = await fetch(`${API}/add_card.php`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cardId: card.id })
                });
                const data = await readApiJson(res, 'Save card API returned non-JSON');
                return { card, success: Boolean(data.success) };
            } catch (error) {
                console.error('Save card failed:', card?.id, error);
                return { card, success: false };
            }
        })
    );

    const failed = results.filter((result) => !result.success);
    if (failed.length) {
        console.warn(`Could not save ${failed.length} card(s) to collection`);
    }

    return results;
}

function renderInventory(packs) {
    if (!inventoryGrid) return;
    inventoryGrid.innerHTML = '';

    if (!packs.length) {
        inventoryGrid.innerHTML = '<p class="inventory-empty">No packs yet. Buy one in the shop.</p>';
        return;
    }

    packs.forEach((pack) => {
        const item = document.createElement('article');
        item.className = 'inventory-pack';
        item.innerHTML = `
            <h3>${pack.set_name || 'Unknown set'}</h3>
            <p>Random 10-card pack</p>
            <button type="button" class="open-inventory-pack-btn">Open Pack</button>
        `;

        item.querySelector('.open-inventory-pack-btn')
            .addEventListener('click', () => consumeAndOpenPack(pack.id));

        inventoryGrid.appendChild(item);
    });
}

async function loadInventory() {
    if (isLoadingInventory) return;
    isLoadingInventory = true;

    try {
        const res = await fetch(`${API}/user_packs.php?action=list`, {
            credentials: 'include'
        });
        const data = await readApiJson(res, 'Inventory API returned non-JSON');
        if (data.success) {
            const packs = data.packs || [];
            renderInventory(packs);
            if (!autoOpenConsumed && autoOpenSetFromUrl) {
                const key = String(autoOpenSetFromUrl).trim().toLowerCase();
                const target = packs.find((pack) => {
                    const setCode = String(pack.tcgdex_set_id || pack.set_id || '').trim().toLowerCase();
                    const setName = String(pack.set_name || '').trim().toLowerCase();
                    return setCode === key || setName === key;
                });
                if (target) {
                    autoOpenConsumed = true;
                    const cleanUrl = `${window.location.pathname}`;
                    window.history.replaceState({}, '', cleanUrl);
                    document.body.classList.add('inventory-open');
                    setTimeout(() => consumeAndOpenPack(target.id), 50);
                }
            }
        } else {
            renderInventory([]);
        }
    } catch (error) {
        console.error('Failed to load inventory:', error);
        renderInventory([]);
    } finally {
        isLoadingInventory = false;
    }
}

async function renderPacks() {
    shopGrid.innerHTML = '';

    let packs = [...enrichedPacks];
    const search = packSearch?.value?.trim().toLowerCase() || '';
    const era = eraFilter?.value || 'all';
    const maxPrice = maxPriceFilter?.value || 'all';

    if (search) {
        packs = packs.filter((p) => p.searchText.includes(search));
    }
    if (era !== 'all') {
        packs = packs.filter((p) => p.eraKey === era);
    }
    if (maxPrice !== 'all') {
        const cap = Number(maxPrice);
        packs = packs.filter((p) => Number(p.price) <= cap);
    }

    switch (priceFilter.value) {
        case 'low-high':
            packs.sort((a, b) => a.price - b.price);
            break;
        case 'high-low':
            packs.sort((a, b) => b.price - a.price);
            break;
    }

    if (!packs.length) {
        shopGrid.innerHTML = '<p class="shop-empty">No packs match these filters.</p>';
        return;
    }

    for (const pack of packs) {
        const setCode = pack.setCode;
        const setName = pack.setName;

        const el = document.createElement('div');
        el.className = 'shop-pack';

        el.innerHTML = `
            <img class="pack-image" src="${pack.photo}" alt="${pack.name}">
            <div class="pack-name">${setName}</div>
            <div class="pack-era">${eraLookup[pack.eraKey] || 'Overig'}</div>
            <div class="pack-price">
                <img class="coin-icon" src="../images/pokecoin.png" alt="PokeCoin" />
                <span>${pack.price}</span>
            </div>
            <button class="buy-btn">Buy Pack</button>
        `;

        el.querySelector('.buy-btn')
            .addEventListener('click', async () => {
                if (isOpeningPack) return;
                const buyBtn = el.querySelector('.buy-btn');
                buyBtn.disabled = true;

                try {
                    await buyPack(pack, setCode, setName);
                } catch (error) {
                    console.error('Pack purchase/open failed:', error);
                    notification({
                        text: 'Could not buy this pack. Please try again.',
                        duration: 5000,
                        type: 'error',
                        closeable: true
                    });
                } finally {
                    buyBtn.disabled = false;
                }
            });

        shopGrid.appendChild(el);
    }
}

function onFilterChange() {
    renderPacks();
}

priceFilter?.addEventListener('change', onFilterChange);
eraFilter?.addEventListener('change', onFilterChange);
maxPriceFilter?.addEventListener('change', onFilterChange);
packSearch?.addEventListener('input', onFilterChange);

if (openInventoryBtn && closeInventoryBtn) {
    openInventoryBtn.addEventListener('click', () => {
        document.body.classList.add('inventory-open');
    });
    closeInventoryBtn.addEventListener('click', () => {
        document.body.classList.remove('inventory-open');
    });
}

const overlayRefs = ensurePackOverlay();

function closePackOverlay(force = false) {
    closePackOpenAnimation({
        overlay: overlayRefs.overlay,
        scene: overlayRefs.scene,
        shell: overlayRefs.shell,
        cardsContainer: overlayRefs.cardsContainer,
        workspace: overlayRefs.workspace,
        cardTab: overlayRefs.cardTab,
        reviewContainer: overlayRefs.reviewContainer,
        noticeEl: overlayRefs.noticeEl,
        isBusy: isOpeningPack,
        force
    });
}

window.addEventListener('pagehide', () => {
    closePackOverlay(true);
});

if (overlayRefs.closeBtn && overlayRefs.overlay && overlayRefs.scene && overlayRefs.shell && overlayRefs.cardsContainer) {
    overlayRefs.closeBtn.addEventListener('click', () => {
        closePackOverlay(false);
    });

    overlayRefs.overlay.addEventListener('click', (event) => {
        if (event.target === overlayRefs.overlay) {
            closePackOverlay(false);
        }
    });
}

initGameInfo();
refreshCoins();
loadInventory();
loadPacks();