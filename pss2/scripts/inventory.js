const API = typeof getApiBase === 'function'
    ? getApiBase()
    : (window.location.port === '5173' ? 'http://localhost/pss/api' : `${window.location.origin}/pss/api`);

const inventoryTotal = document.getElementById('inventoryTotal');
const inventoryGrid = document.getElementById('inventoryGroupedGrid');

function getBaseSetCode(setCode = '') {
    const match = String(setCode || '').match(/^[a-zA-Z]+/);
    return match ? match[0].toLowerCase() : '';
}

function getPackImage(setCode = '') {
    const normalized = String(setCode || '').trim().toLowerCase();
    const base = getBaseSetCode(normalized);
    if (!normalized || !base) {
        return '/images/packs_top/base/base1.png';
    }
    return `/images/packs_top/${base}/${normalized}.png`;
}

function groupPacks(packs = []) {
    const map = new Map();
    for (const pack of packs) {
        const name = String(pack?.set_name || pack?.tcgdex_set_id || pack?.set_id || 'Unknown set');
        const setCode = String(pack?.tcgdex_set_id || pack?.set_id || '').trim().toLowerCase();
        const key = `${name}__${setCode}`;
        if (!map.has(key)) {
            map.set(key, { name, setCode, qty: 0 });
        }
        map.get(key).qty += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name));
}

function renderInventory(grouped = [], totalCount = 0) {
    inventoryTotal.textContent = `${totalCount} pack${totalCount === 1 ? '' : 's'}`;
    if (!grouped.length) {
        inventoryGrid.innerHTML = '<p class="inventory-empty">No packs in inventory.</p>';
        return;
    }

    inventoryGrid.innerHTML = grouped.map((entry) => `
        <article class="inventory-card">
            <img class="inventory-pack-image" src="${getPackImage(entry.setCode)}" alt="${entry.name}" onerror="this.onerror=null;this.src='/images/packs_top/base/base1.png';">
            <div class="inventory-pack-meta">
                <span class="inventory-pack-name">${entry.name}</span>
                <span class="inventory-pack-count">x${entry.qty}</span>
                <span class="inventory-pack-code">${entry.setCode || 'no set code'}</span>
                <a class="inventory-open-btn" href="/pages/shop.html?openSet=${encodeURIComponent(entry.setCode || entry.name)}">Open Pack</a>
            </div>
        </article>
    `).join('');
}

async function loadInventory() {
    try {
        const res = await fetch(`${API}/user_packs.php?action=list`, { credentials: 'include' });
        const data = await res.json();
        if (!data.success) {
            inventoryGrid.innerHTML = `<p class="inventory-empty">${data.message || 'Could not load inventory.'}</p>`;
            return;
        }

        const packs = Array.isArray(data.packs) ? data.packs : [];
        const grouped = groupPacks(packs);
        renderInventory(grouped, packs.length);
    } catch (error) {
        inventoryGrid.innerHTML = '<p class="inventory-empty">Could not load inventory.</p>';
    }
}

loadInventory();
