    import TCGdex from '@tcgdex/sdk';
    import MemoryCache from '@cachex/memory';

import { getCoins, setCoins, addPackToInventory } from './packStorage.js';
    import { getPackData, resolveTcgdexApiSetId } from './packData.js';
    import { uniqueIdsFromCardList } from './tcgdexResolve.js';

    const tcgdex = new TCGdex('en');
    tcgdex.setCache(new MemoryCache());

    const marketGrid = document.getElementById('marketGrid');
    const coinsEl = document.getElementById('coins');

    function updateCoinsUI() {
        if (!coinsEl) return;
        coinsEl.textContent = getCoins();
    }

function showPurchaseToast(amount, packName) {
    let toast = document.getElementById('purchaseToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'purchaseToast';
        toast.className = 'purchase-toast';
        document.body.appendChild(toast);
    }

    toast.textContent = `You have bought ${amount}x ${packName}`;
    toast.classList.add('show');
    clearTimeout(showPurchaseToast.timer);
    showPurchaseToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

    function shuffle(cards) {
        return [...cards].sort(() => Math.random() - 0.5);
    }

    function isEnergy(card) {
        const category = String(card?.category || card?.supertype || '').toLowerCase();
        const types = Array.isArray(card?.types) ? card.types.join(' ').toLowerCase() : '';
        return category.includes('energy') || types.includes('energy') || /\benergy$/i.test(card?.name || '');
    }

    function isRareOrBetter(card) {
        return /rare|holo|vmax|vstar|double|ultra|secret|gold|rainbow|hyper|illustration|shiny/i
            .test(card?.rarity || '');
    }

    function isCommonOrUncommon(card) {
        const rarity = String(card?.rarity || '').trim().toLowerCase();
        return !isEnergy(card) && !isRareOrBetter(card) && (rarity.includes('common') || rarity.includes('uncommon'));
    }

async function buildCardPools(tcgdexSetId, amount) {
    const list = await tcgdex.card.list({ set: tcgdexSetId });
    const ids = shuffle(uniqueIdsFromCardList(list, tcgdexSetId));

    const commons = [];
    const rares = [];
    const energies = [];

    const canBuildAmount = () => {
        const normalSlots = amount * 8;
        const fallbackCommons = Math.max(0, amount - energies.length);
        return rares.length >= amount && commons.length >= normalSlots + fallbackCommons;
    };

    for (const id of ids) {
        if (canBuildAmount()) break;

        let card;
        try {
            card = await tcgdex.card.get(id);
        } catch {
            continue;
        }

        if (isCommonOrUncommon(card)) {
            commons.push(card);
        } else if (isRareOrBetter(card)) {
            rares.push(card);
        } else if (isEnergy(card)) {
            energies.push(card);
        }
    }

    return { commons, rares, energies };
}

function take(cards) {
    return cards.shift() || null;
}

function buildPackFromPools(pools) {
    const commons = pools.commons.splice(0, 8);
    const rare = take(pools.rares);
    const energy = take(pools.energies);

    if (commons.length < 8 || !rare) return [];
    return energy ? [...commons, rare, energy] : [...commons, take(pools.commons), rare].filter(Boolean);
}

function buildPacksFromPools(pools, amount) {
    const packs = [];
    for (let i = 0; i < amount; i++) {
        const pack = buildPackFromPools(pools);
        if (pack.length < 10) return [];
        packs.push(pack);
    }
    return packs;
}

    const allowedSetIds = [
        'base1', 'base2', 'base3', 'base4', 'base5',
        'gym1', 'gym2',
        'neo1', 'neo2', 'neo3', 'neo4',
        'lc',
        'ecard1',
        'ex1', 'ex2', 'ex3', 'ex4', 'ex5', 'ex6', 'ex7', 'ex8', 'ex9', 'ex10', 'ex11', 'ex12', 'ex13', 'ex14', 'ex15', 'ex16',
        'dp1', 'dp2', 'dp3', 'dp5', 'dp6', 'dp7',
        'pl3', 'pl4',
        'hgss1', 'hgss2', 'hgss3', 'hgss4',
        'col1',
        'bw1', 'bw2', 'bw3', 'bw4', 'bw5', 'bw6', 'bw7', 'bw8', 'bw9', 'bw10', 'bw11',
        'xy1', 'xy2', 'xy3', 'xy4', 'xy5', 'xy6', 'xy7', 'g1', 'xy9', 'xy10', 'xy11', 'xy12',
        'sm1', 'sm3', 'sm4', 'sm5', 'sm6', 'sm7', 'sm8', 'sm9', 'sm10', 'sm11', 'sm115', 'sm12',
        'swsh1', 'swsh2', 'swsh3', 'swsh3.5', 'swsh4', 'swsh4.5', 'swsh5', 'swsh6', 'swsh7', 'swsh8', 'swsh9', 'swsh10', 'swsh10.5', 'swsh11', 'swsh12', 'swsh12.5',
        'sv01', 'sv02', 'sv03', 'sv03.5', 'sv04', 'sv04.5', 'sv05', 'sv06', 'sv06.5', 'sv07', 'sv08', 'sv08.5', 'sv09', 'sv10', 'sv10.5w', 'sv10.5b',
        'me01', 'me02', 'me02.5', 'me03'
    ];

    async function buyPack(set, packData, amount, selector) {
        const coins = getCoins();
        const totalPrice = packData.price * amount;
        if (coins < totalPrice) return alert('Not enough coins');

        selector.querySelectorAll('button').forEach(button => button.disabled = true);
        try {
            const tcgdexSetId = resolveTcgdexApiSetId(packData.tcgdexId || set.id);
            const packs = buildPacksFromPools(await buildCardPools(tcgdexSetId, amount), amount);

            if (packs.length < amount) {
                alert('This set does not have enough commons and rares to build that many packs.');
                return;
            }

            for (const packCards of packs) {
                await addPackToInventory(
                    set.id,
                    packCards.map(card => card.id),
                    tcgdexSetId,
                    { setName: set.name }
                );
            }

            setCoins(coins - totalPrice);
            updateCoinsUI();
            showPurchaseToast(amount, set.name);
        } catch (err) {
            alert(err.message === 'Not logged in' ? 'Please log in first.' : 'Purchase failed.');
        } finally {
            selector.querySelectorAll('button').forEach(button => button.disabled = false);
        }
    }

function showAmountSelector(container, set, packData) {
    let amount = 1;
    container.innerHTML = `
        <div class="amount-selector">
            <button type="button" class="amount-minus">-</button>
            <span class="amount-value">1</span>
            <button type="button" class="amount-plus">+</button>
            <button type="button" class="amount-buy">Buy</button>
        </div>
    `;

    const selector = container.querySelector('.amount-selector');
    const value = selector.querySelector('.amount-value');
    const update = () => {
        value.textContent = amount;
    };

    selector.querySelector('.amount-minus').addEventListener('click', () => {
        amount = Math.max(1, amount - 1);
        update();
    });
    selector.querySelector('.amount-plus').addEventListener('click', () => {
        amount = Math.min(5, amount + 1);
        update();
    });
    selector.querySelector('.amount-buy').addEventListener('click', () => {
        buyPack(set, packData, amount, selector);
    });
}

    function renderPack(set) {
        const packData = getPackData(set.id);
        const packRow = document.createElement('div');
        packRow.className = 'market-pack';
        packRow.innerHTML = `
            <img src="${packData.image}" alt="${set.name}">
            <h3>${set.name}</h3>
            <p>${packData.price} coins</p>
            <div class="market-actions">
                <button type="button">Buy</button>
            </div>
        `;

        const actions = packRow.querySelector('.market-actions');
        actions.querySelector('button').addEventListener('click', () => showAmountSelector(actions, set, packData));
        marketGrid.appendChild(packRow);
    }

    async function loadMarket() {
        const sets = await tcgdex.set.list();
        sets.filter(set => allowedSetIds.includes(set.id)).forEach(renderPack);
    }

    updateCoinsUI();
    loadMarket();