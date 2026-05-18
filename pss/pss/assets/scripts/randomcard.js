import TCGdex from '@tcgdex/sdk';

const setCodeInput = document.getElementById('setCodeInput');
const openBtn = document.getElementById('openPackBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const cardsContainer = document.getElementById('cardsContainer');
const packInfoDiv = document.getElementById('packInfo');

const tcgdex = new TCGdex('en');
console.log('🚀 SDK ready — vertical price display (all fields except idProduct)');

function setLoading(state) {
    openBtn.disabled = state;
    loadingIndicator.style.display = state ? 'flex' : 'none';
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

// ------------------ VERTICAL PRICE BUILDER (excludes idProduct, shows every field nicely) ------------------
function buildVerticalPriceElement(card) {
    const container = document.createElement('div');
    container.className = 'price-vertical';
    
    const pricing = card.pricing;
    if (!pricing || (!pricing.tcgplayer && !pricing.cardmarket)) {
        container.textContent = '💰 No pricing data available';
        return container;
    }
    
    // 1) Cardmarket section: display all keys except idProduct
    if (pricing.cardmarket) {
        const cm = pricing.cardmarket;
        const cmSection = document.createElement('section');
        const title = document.createElement('h4');
        title.textContent = '💶 Cardmarket (EUR)';
        cmSection.appendChild(title);
        
        const listDiv = document.createElement('div');
        listDiv.className = 'price-list';
        
        // get all own property names, exclude idProduct
        const allKeys = Object.keys(cm).filter(k => k !== 'idProduct');
        // sort for readability (optional)
        allKeys.sort();
        
        for (const key of allKeys) {
            const val = cm[key];
            // skip undefined, null, or functions
            if (val === undefined || val === null) continue;
            // show numeric values and strings (like 'updated' timestamp or 'unit')
            let displayValue = val;
            if (typeof val === 'number') {
                // format currency numbers nicely with 2 decimals if it's a price field
                if (key === 'updated' || key === 'id' || key === 'unit') {
                    displayValue = val;
                } else {
                    // price fields: format with two decimals
                    displayValue = `€${val.toFixed(2)}`;
                }
            } else if (typeof val === 'string') {
                if (key === 'updated') {
                    // format date for readability
                    try {
                        const dateObj = new Date(val);
                        if (!isNaN(dateObj.getTime())) {
                            displayValue = dateObj.toLocaleString();
                        }
                    } catch(e) {}
                }
                displayValue = val;
            }
            
            const row = document.createElement('div');
            row.className = 'price-item';
            row.innerHTML = `<span class="price-key">${escapeHtml(key)}:</span> <span class="price-value">${escapeHtml(String(displayValue))}</span>`;
            listDiv.appendChild(row);
        }
        
        if (listDiv.children.length === 0) {
            listDiv.innerHTML = '<div class="price-item">— no price fields —</div>';
        }
        cmSection.appendChild(listDiv);
        container.appendChild(cmSection);
    }
    
    // 2) TCGplayer section: show each variant with its fields (lowPrice, marketPrice, etc.)
    if (pricing.tcgplayer) {
        const tcg = pricing.tcgplayer;
        const tcgSection = document.createElement('section');
        const title = document.createElement('h4');
        title.textContent = '🃏 TCGplayer (USD)';
        tcgSection.appendChild(title);
        
        // collect variant objects: normal, holofoil, reverse, 1st-edition, 1st-edition-holofoil, unlimited, unlimited-holofoil
        const variantNames = ['normal', 'holofoil', 'reverse', '1st-edition', '1st-edition-holofoil', 'unlimited', 'unlimited-holofoil'];
        let hasAny = false;
        
        for (const vName of variantNames) {
            const variant = tcg[vName];
            if (variant && typeof variant === 'object' && Object.keys(variant).some(k => variant[k] !== undefined && variant[k] !== null)) {
                hasAny = true;
                const variantBlock = document.createElement('div');
                variantBlock.className = 'variant-group';
                const variantHeader = document.createElement('div');
                variantHeader.className = 'variant-name';
                variantHeader.textContent = vName;
                variantBlock.appendChild(variantHeader);
                
                const subList = document.createElement('div');
                subList.className = 'price-list';
                // fields typically: lowPrice, midPrice, highPrice, marketPrice, directLowPrice
                const priceFields = ['lowPrice', 'midPrice', 'highPrice', 'marketPrice', 'directLowPrice'];
                for (const field of priceFields) {
                    const val = variant[field];
                    if (val !== undefined && val !== null && typeof val === 'number') {
                        const row = document.createElement('div');
                        row.className = 'price-item';
                        row.innerHTML = `<span class="price-key">${escapeHtml(field)}:</span> <span class="price-value">$${val.toFixed(2)}</span>`;
                        subList.appendChild(row);
                    }
                }
                if (subList.children.length === 0) {
                    subList.innerHTML = '<div class="price-item">— no numeric prices —</div>';
                }
                variantBlock.appendChild(subList);
                tcgSection.appendChild(variantBlock);
            }
        }
        
        // also show global TCGplayer 'updated' and 'unit'
        if (tcg.updated !== undefined && tcg.updated !== null) {
            const updateRow = document.createElement('div');
            updateRow.className = 'price-item';
            let updatedDisplay = tcg.updated;
            if (typeof tcg.updated === 'number') updatedDisplay = new Date(tcg.updated).toLocaleString();
            if (typeof tcg.updated === 'string') updatedDisplay = new Date(tcg.updated).toLocaleString();
            updateRow.innerHTML = `<span class="price-key">updated:</span> <span class="price-value">${escapeHtml(String(updatedDisplay))}</span>`;
            const wrapper = document.createElement('div');
            wrapper.className = 'price-list';
            wrapper.appendChild(updateRow);
            if (tcg.unit) {
                const unitRow = document.createElement('div');
                unitRow.className = 'price-item';
                unitRow.innerHTML = `<span class="price-key">unit:</span> <span class="price-value">${escapeHtml(tcg.unit)}</span>`;
                wrapper.appendChild(unitRow);
            }
            tcgSection.appendChild(wrapper);
        } else if (tcg.unit) {
            const unitOnly = document.createElement('div');
            unitOnly.className = 'price-list';
            unitOnly.innerHTML = `<div class="price-item"><span class="price-key">unit:</span> <span class="price-value">${escapeHtml(tcg.unit)}</span></div>`;
            tcgSection.appendChild(unitOnly);
        }
        
        if (!hasAny && !tcg.updated && !tcg.unit) {
            const emptyMsg = document.createElement('div');
            emptyMsg.textContent = '⚠️ No variant price data';
            emptyMsg.style.padding = '4px';
            tcgSection.appendChild(emptyMsg);
        }
        container.appendChild(tcgSection);
    }
    
    return container;
}

function escapeHtml(str = '') {
    return String(str).replace(/[&<>]/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;'
    }[c]));
}

// Pack logic helpers
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

function toPlainObject(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    const seen = new WeakSet();
    function safe(value) {
        if (value === null || typeof value !== 'object') return value;
        if (seen.has(value)) return '[Circular Reference]';
        seen.add(value);
        if (Array.isArray(value)) return value.map(safe);
        const out = {};
        for (const k of Object.keys(value)) {
            if (k.startsWith('_') || typeof value[k] === 'function') continue;
            if (k === 'sdk') continue;
            out[k] = safe(value[k]);
        }
        return out;
    }
    return safe(obj);
}

// Card UI with vertical price block
function createCardElement(card) {
    const wrapper = document.createElement('div');
    wrapper.className = 'card';
    
    const imgWrap = document.createElement('div');
    imgWrap.className = 'card-img';
    const imgUrl = getImageUrl(card, 'high', 'webp');
    const lowUrl = getImageUrl(card, 'low', 'webp');
    if (imgUrl) {
        const img = document.createElement('img');
        img.src = imgUrl;
        img.alt = card.name || 'Pokémon';
        img.onerror = () => { if (lowUrl) img.src = lowUrl; };
        imgWrap.appendChild(img);
    } else {
        imgWrap.textContent = '🃟';
    }
    
    const info = document.createElement('div');
    info.className = 'card-info';
    
    const nameDiv = document.createElement('div');
    nameDiv.textContent = card.name || '???';
    const rarityDiv = document.createElement('div');
    rarityDiv.textContent = `✨ ${card.rarity || '—'}`;
    
    info.appendChild(nameDiv);
    info.appendChild(rarityDiv);
    
    // Append the VERTICAL price display (all fields except idProduct)
    const priceBlock = buildVerticalPriceElement(card);
    info.appendChild(priceBlock);
    
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
    cards.forEach(c => grid.appendChild(createCardElement(c)));
    section.appendChild(heading);
    section.appendChild(grid);
    return section;
}

function logRawCardData(arr, name) {
    console.group(`📄 RAW — ${name}`);
    arr.forEach((c, i) => console.log(i + 1, c.name, toPlainObject(c)));
    console.groupEnd();
}

// Main pack opener
async function openPack() {
    const setCode = setCodeInput.value.trim().toLowerCase();
    if (!setCode) return;
    
    setLoading(true);
    cardsContainer.innerHTML = '';
    packInfoDiv.innerHTML = `📦 Loading set: ${setCode.toUpperCase()} ...`;
    
    try {
        const setData = await tcgdex.set.get(setCode);
        if (!setData || !setData.cards) throw new Error(`Set "${setCode}" not found`);
        
        const full = await Promise.all(setData.cards.map(c => c.getCard()));
        
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
        
        logRawCardData(packNormals, 'NORMALS');
        if (packRare) logRawCardData([packRare], 'RARE');
        if (packEnergy) logRawCardData([packEnergy], 'ENERGY');
        
        if (packNormals.length) cardsContainer.appendChild(createSection('📘 Normal Cards (8)', packNormals));
        if (packRare) cardsContainer.appendChild(createSection('⭐ Rare / Holo Slot', [packRare]));
        if (packEnergy) cardsContainer.appendChild(createSection('⚡ Energy Slot', [packEnergy]));
        
        packInfoDiv.innerHTML = `✅ Opened ${setData.name} (${setCode}) • ${packNormals.length} normal, ${packRare ? 1 : 0} rare, ${packEnergy ? 1 : 0} energy • <strong>All prices vertically listed (no idProduct)</strong>`;
    } catch (err) {
        console.error(err);
        packInfoDiv.innerHTML = `❌ Error: ${err.message || 'Invalid set code'}`;
        cardsContainer.innerHTML = `<div style="padding: 20px; background:#fee; border-radius: 20px;">⚠️ Could not load set. Try "bw1", "xy1", "sm1", "swsh3", "sv1" etc.</div>`;
    } finally {
        setLoading(false);
    }
}

openBtn.addEventListener('click', openPack);
console.log('✅ Ready — each card shows vertical price list (excludes idProduct)');
openPack();