    import TCGdex from '@tcgdex/sdk';
    import MemoryCache from '@cachex/memory';
    import { openPack, formatHeaderCoins } from '/scripts/card_logic.js';
    import { runPackOpenAnimation, closePackOpenAnimation } from '/scripts/pack-opening-animation.js';
    import { initGameInfo } from '/scripts/game-info.js';

    const tcgdex = new TCGdex('en');
    tcgdex.setCache(new MemoryCache());

    const API = window.location.port === '5173'
        ? 'http://localhost/pss/api'
        : `${window.location.origin}/pss/api`;

    const shopGrid = document.getElementById('shopGrid');
    const priceFilter = document.getElementById('priceFilter');
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
                                <div id="packTabActions" class="pack-tab-actions" hidden>
                                    <button type="button" class="pack-tab-btn btn-sell" id="packTabSell">Sell</button>
                                    <button type="button" class="pack-tab-btn btn-keep" id="packTabKeep">Keep</button>
                                </div>
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
            closeBtn: document.getElementById('closePackOverlayBtn')
        };
    }

    let allPacks = [];
    let isOpeningPack = false;
    let isLoadingInventory = false;

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

        renderPacks();
    }

    async function refreshCoins() {
        const userId = localStorage.getItem('userId');
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
                alert(data.message || 'Could not buy this pack');
                return;
            }

            await refreshCoins();
            await loadInventory();
            alert('Pack bought and added to your inventory.');
        } catch (error) {
            console.error('Pack purchase failed:', error);
            alert('Could not buy this pack right now.');
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
                alert(data.message || 'Could not open pack');
                await loadInventory();
                return;
            }

            const pack = data.pack;
            const setCode = pack.tcgdex_set_id || pack.set_id;
            if (!setCode) {
                alert('This saved pack has no set code.');
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
                cardsPromise: openPack(setCode),
                callbacks: {
                    onSellCard: sellPulledCard,
                    onKeepCard: keepPulledCard
                }
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
                force: true
            });
            alert('Could not open this pack right now.');
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

    async function applyPackSetImages(stageEl, setCode = '') {
        if (!stageEl) return;
        const normalized = String(setCode || '').trim().toLowerCase();
        if (!normalized) return;

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

    async function sellPulledCard(card) {
        try {
            const amount = Number(card?.pricing?.cardmarket?.trend ?? 0);
            const res = await fetch(`${API}/users.php?action=instaSell`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cardValue: amount })
            });
            const data = await readApiJson(res, 'InstaSell API returned non-JSON');
            if (data.success) {
                await refreshCoins();
            }
            return data;
        } catch (error) {
            console.error('Sell failed:', error);
            return { success: false };
        }
    }

    async function keepPulledCard(card) {
        try {
            const res = await fetch(`${API}/add_card.php`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cardId: card.id })
            });
            return await readApiJson(res, 'Keep card API returned non-JSON');
        } catch (error) {
            console.error('Keep failed:', error);
            return { success: false };
        }
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
                renderInventory(data.packs || []);
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

        let packs = [...allPacks];

        // FILTERS
        switch (priceFilter.value) {

            case 'low-high':
                packs.sort((a, b) => a.price - b.price);
                break;

            case 'high-low':
                packs.sort((a, b) => b.price - a.price);
                break;
        }

        for (const pack of packs) {

            const setCode = resolveSetCode(pack);
            let setName = pack.name || setCode || 'Unknown set';

            try {
                if (setCode) {
                    const set = await tcgdex.set.get(setCode);
                    setName = set?.name || setName;
                }
            } catch (error) {
                console.warn('Could not load set details for pack:', pack, error);
            }

            const el = document.createElement('div');

            el.className = 'shop-pack';

            el.innerHTML = `
                <img class="pack-image" src="${pack.photo}" alt="${pack.name}">

                <div class="pack-name">${setName}</div>

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
                        alert('Could not buy this pack. Please try again.');
                    } finally {
                        buyBtn.disabled = false;
                    }
                });

            shopGrid.appendChild(el);
        }
    }

    priceFilter.addEventListener('change', renderPacks);

    if (openInventoryBtn && closeInventoryBtn) {
        openInventoryBtn.addEventListener('click', () => {
            document.body.classList.add('inventory-open');
        });
        closeInventoryBtn.addEventListener('click', () => {
            document.body.classList.remove('inventory-open');
        });
    }

    const overlayRefs = ensurePackOverlay();
    if (overlayRefs.closeBtn && overlayRefs.overlay && overlayRefs.scene && overlayRefs.shell && overlayRefs.cardsContainer) {
        overlayRefs.closeBtn.addEventListener('click', () => {
            closePackOpenAnimation({
                overlay: overlayRefs.overlay,
                scene: overlayRefs.scene,
                shell: overlayRefs.shell,
                cardsContainer: overlayRefs.cardsContainer,
                workspace: overlayRefs.workspace,
                cardTab: overlayRefs.cardTab,
                reviewContainer: overlayRefs.reviewContainer,
                isBusy: isOpeningPack
            });
        });

        overlayRefs.overlay.addEventListener('click', (event) => {
            if (event.target === overlayRefs.overlay) {
                closePackOpenAnimation({
                    overlay: overlayRefs.overlay,
                    scene: overlayRefs.scene,
                    shell: overlayRefs.shell,
                    cardsContainer: overlayRefs.cardsContainer,
                    workspace: overlayRefs.workspace,
                    cardTab: overlayRefs.cardTab,
                    reviewContainer: overlayRefs.reviewContainer,
                    isBusy: isOpeningPack
                });
            }
        });
    }

    initGameInfo();
    refreshCoins();
    loadInventory();
    loadPacks();