import TCGdex from '@tcgdex/sdk';
import MemoryCache from '@cachex/memory';

const tcgdex = new TCGdex('en');
tcgdex.setCache(new MemoryCache());

const API = window.location.port === '5173'
    ? 'http://localhost/pss/api'
    : `${window.location.origin}/pss/api`;

const shopGrid = document.getElementById('shopGrid');
const priceFilter = document.getElementById('priceFilter');

let allPacks = [];

async function loadPacks() {

    const response = await fetch(`${API}/get_packs_shop.php`, {
        credentials: 'include'
    });

    const packs = await response.json();

    allPacks = packs;

    renderPacks();
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

        const set = await tcgdex.set.get(pack.id);

        const el = document.createElement('div');

        el.className = 'shop-pack';

        el.innerHTML = `
            <img class="pack-image" src="${pack.photo}" alt="${pack.name}">

            <div class="pack-name">${set.name}</div>

            <div class="pack-price">
                <img class="coin-icon" src="../images/pokecoin.png" alt="PokeCoin" />
                <span>${pack.price}</span>
            </div>

            <button class="buy-btn">Buy Pack</button>
        `;

        el.querySelector('.buy-btn')
            .addEventListener('click', async () => {

                const buyRes = await fetch(`${API}/buy_pack.php`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        setId: pack.set_id
                    })
                });

                const data = await buyRes.json();

                if (data.success) {
                    alert('Pack purchased!');
                } else {
                    alert(data.message);
                }
            });

        shopGrid.appendChild(el);
    }
}

priceFilter.addEventListener('change', renderPacks);

loadPacks();