import TCGdex from '@tcgdex/sdk';

const setCodeInput = document.getElementById('setCodeInput');
const openBtn = document.getElementById('openPackBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const cardsContainer = document.getElementById('cardsContainer');
const packInfoDiv = document.getElementById('packInfo');
const boosterContainer = document.getElementById('boosterContainer');

const tcgdex = new TCGdex('en');

function setLoading(state) {
    openBtn.disabled = state;
    loadingIndicator.style.display = state ? 'flex' : 'none';
}

function escapeHtml(str = '') {
    return String(str).replace(/[&<>]/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;'
    }[c]));
}

function getImageUrl(card, quality = 'high', extension = 'webp') {
    if (!card) return null;

    const setCode = card.set?.code;
    const localId = card.localId;

    if (setCode && localId) {
        return `https://assets.tcgdex.net/en/${setCode}/${localId}/${quality}.${extension}`;
    }

    if (card.image && typeof card.image === 'string') {
        if (card.image.match(/\.(png|jpg|jpeg|webp)$/i)) {
            if (card.image.startsWith('http')) return card.image;
            return `https://assets.tcgdex.net${card.image}`;
        }

        return `${card.image}/high.webp`;
    }

    return null;
}

// ---------------- BOOSTER DISPLAY ----------------

function renderBoosters(boosters = []) {
    boosterContainer.innerHTML = '';

    if (!boosters.length) {
        boosterContainer.innerHTML = `
            <div class="no-booster">
                No booster artwork available
            </div>
        `;
        return;
    }

    boosters.forEach(booster => {
        const wrapper = document.createElement('div');
        wrapper.className = 'booster-card';

        const title = document.createElement('h2');
        title.className = 'booster-title';
        title.textContent = booster.name || booster.id;

        const img = document.createElement('img');
        img.className = 'booster-image';
        img.src = booster.artwork_front;
        img.alt = booster.name || 'Booster Pack';

        wrapper.appendChild(title);
        wrapper.appendChild(img);

        // Optional logo
        if (booster.logo) {
            const logo = document.createElement('img');
            logo.src = booster.logo;
            logo.className = 'booster-logo';
            wrapper.appendChild(logo);
        }

        boosterContainer.appendChild(wrapper);
    });
}

// ---------------- PRICE DISPLAY ----------------

function buildVerticalPriceElement(card) {
    const container = document.createElement('div');
    container.className = 'price-vertical';

    const pricing = card.pricing;

    if (!pricing || (!pricing.tcgplayer && !pricing.cardmarket)) {
        container.textContent = '💰 No pricing data available';
        return container;
    }

    // Cardmarket
    if (pricing.cardmarket) {
        const cm = pricing.cardmarket;

        const section = document.createElement('section');

        const title = document.createElement('h4');
        title.textContent = '💶 Cardmarket (EUR)';
        section.appendChild(title);

        const list = document.createElement('div');
        list.className = 'price-list';

        const keys = Object.keys(cm)
            .filter(k => k !== 'idProduct')
            .sort();

        for (const key of keys) {
            const value = cm[key];

            if (value === undefined || value === null) continue;

            let display = value;

            if (typeof value === 'number') {
                display = `€${value.toFixed(2)}`;
            }

            if (key === 'updated') {
                try {
                    display = new Date(value).toLocaleString();
                } catch {}
            }

            const row = document.createElement('div');
            row.className = 'price-item';

            row.innerHTML = `
                <span class="price-key">${escapeHtml(key)}:</span>
                <span class="price-value">${escapeHtml(String(display))}</span>
            `;

            list.appendChild(row);
        }

        section.appendChild(list);
        container.appendChild(section);
    }

    // TCGPLAYER
    if (pricing.tcgplayer) {
        const tcg = pricing.tcgplayer;

        const section = document.createElement('section');

        const title = document.createElement('h4');
        title.textContent = '🃏 TCGplayer (USD)';
        section.appendChild(title);

        const variants = [
            'normal',
            'holofoil',
            'reverse',
            '1st-edition',
            '1st-edition-holofoil',
            'unlimited',
            'unlimited-holofoil'
        ];

        variants.forEach(name => {
            const variant = tcg[name];

            if (!variant) return;

            const block = document.createElement('div');
            block.className = 'variant-group';

            const header = document.createElement('div');
            header.className = 'variant-name';
            header.textContent = name;

            block.appendChild(header);

            const list = document.createElement('div');
            list.className = 'price-list';

            const fields = [
                'lowPrice',
                'midPrice',
                'highPrice',
                'marketPrice',
                'directLowPrice'
            ];

            fields.forEach(field => {
                const value = variant[field];

                if (typeof value !== 'number') return;

                const row = document.createElement('div');
                row.className = 'price-item';

                row.innerHTML = `
                    <span class="price-key">${escapeHtml(field)}:</span>
                    <span class="price-value">$${value.toFixed(2)}</span>
                `;

                list.appendChild(row);
            });

            block.appendChild(list);
            section.appendChild(block);
        });

        container.appendChild(section);
    }

    return container;
}

// ---------------- PACK HELPERS ----------------

function isEnergy(card) {
    return card.category === 'Energy' || card.supertype === 'Energy';
}

function isRare(card) {
    const r = (card.rarity || '').toLowerCase();

    return /rare|holo|v|vmax|vstar|gx|ex|shiny|illustration|ultra|secret|gold|rainbow|hyper/i.test(r);
}

function isSecretEnergy(card) {
    if (!isEnergy(card)) return false;

    const r = (card.rarity || '').toLowerCase();

    return /secret|gold|hyper|rainbow|ultra/.test(r);
}

function random(arr) {
    if (!arr.length) return null;

    return arr[Math.floor(Math.random() * arr.length)];
}

function pick(arr, n) {
    const out = [];

    for (let i = 0; i < n; i++) {
        if (!arr.length) break;

        out.push(random(arr));
    }

    return out;
}

// ---------------- CARD UI ----------------

function createCardElement(card) {
    const wrapper = document.createElement('div');
    wrapper.className = 'card';

    const imgWrap = document.createElement('div');
    imgWrap.className = 'card-img';

    const imgUrl = getImageUrl(card);

    if (imgUrl) {
        const img = document.createElement('img');
        img.src = imgUrl;
        img.alt = card.name || 'Pokemon Card';

        imgWrap.appendChild(img);
    } else {
        imgWrap.textContent = '🃟';
    }

    const info = document.createElement('div');
    info.className = 'card-info';

    const name = document.createElement('div');
    name.textContent = card.name || '???';

    const rarity = document.createElement('div');
    rarity.textContent = `✨ ${card.rarity || '—'}`;

    info.appendChild(name);
    info.appendChild(rarity);

    const prices = buildVerticalPriceElement(card);

    info.appendChild(prices);

    wrapper.appendChild(imgWrap);
    wrapper.appendChild(info);

    return wrapper;
}

function createSection(title, cards) {
    const section = document.createElement('div');

    const heading = document.createElement('h3');
    heading.textContent = title;

    const grid = document.createElement('div');
    grid.className = 'pack-grid';

    cards.forEach(card => {
        grid.appendChild(createCardElement(card));
    });

    section.appendChild(heading);
    section.appendChild(grid);

    return section;
}

// ---------------- MAIN PACK OPENER ----------------

async function openPack() {
    const setCode = setCodeInput.value.trim().toLowerCase();

    if (!setCode) return;

    setLoading(true);

    cardsContainer.innerHTML = '';
    boosterContainer.innerHTML = '';

    packInfoDiv.innerHTML = `
        📦 Loading set: ${setCode.toUpperCase()} ...
    `;

    try {
        const setData = await tcgdex.set.get(setCode);

        if (!setData || !setData.cards) {
            throw new Error(`Set "${setCode}" not found`);
        }

        // RANDOM BOOSTER ART
        const boosters = setData.boosters || [];

        if (boosters.length) {
            const randomBooster =
                boosters[Math.floor(Math.random() * boosters.length)];

            renderBoosters([randomBooster]);
        } else {
            renderBoosters([]);
        }

        // LOAD FULL CARD DATA
        const full = await Promise.all(
            setData.cards.map(card => card.getCard())
        );

        const normals = full.filter(c => !isEnergy(c) && !isRare(c));

        const energyAll = full.filter(isEnergy);

        const energyNormal = energyAll.filter(c => !isSecretEnergy(c));

        const energyRare = energyAll.filter(isSecretEnergy);

        const rares = [
            ...full.filter(isRare),
            ...energyRare
        ];

        const packNormals = pick(normals, 8);

        const packRare = random(rares);

        const packEnergy = random(energyNormal);

        if (packNormals.length) {
            cardsContainer.appendChild(
                createSection('📘 Normal Cards (8)', packNormals)
            );
        }

        if (packRare) {
            cardsContainer.appendChild(
                createSection('⭐ Rare / Holo Slot', [packRare])
            );
        }

        if (packEnergy) {
            cardsContainer.appendChild(
                createSection('⚡ Energy Slot', [packEnergy])
            );
        }

        packInfoDiv.innerHTML = `
            ✅ Opened ${setData.name} (${setCode})
            • ${packNormals.length} normal
            • ${packRare ? 1 : 0} rare
            • ${packEnergy ? 1 : 0} energy
        `;
    } catch (err) {
        console.error(err);

        packInfoDiv.innerHTML = `
            ❌ Error: ${err.message || 'Invalid set code'}
        `;

        cardsContainer.innerHTML = `
            <div style="padding:20px;background:#fee;border-radius:20px;">
                ⚠️ Could not load set.
            </div>
        `;
    } finally {
        setLoading(false);
    }
}

// EVENTS
openBtn.addEventListener('click', openPack);

// AUTO LOAD
openPack();
