import TCGdex from '@tcgdex/sdk';
import MemoryCache from '@cachex/memory';
import { getInventory } from './packApi.js';
import { getPackDataForInventory, resolveTcgdexApiSetId } from './packData.js';

const tcgdex = new TCGdex('en');
tcgdex.setCache(new MemoryCache());

const inventoryGrid = document.getElementById('inventoryGrid');

function inventorySetId(pack) {
    return pack.setId || pack.tcgdexSetId;
}

async function resolveSetName(setId) {
    try {
        const setData = await tcgdex.set.get(resolveTcgdexApiSetId(setId));
        return setData?.name;
    } catch {
        return null;
    }
}

function message(text) {
    inventoryGrid.innerHTML = `<div style="color:white;opacity:0.7;">${text}</div>`;
}

function openPack(packId) {
    window.location.href = new URL(
        `./Packs/packs.html?packId=${encodeURIComponent(packId)}`,
        window.location.href
    ).href;
}

function renderPack(pack) {
    const setId = inventorySetId(pack);
    if (!setId) return;

    const data = getPackDataForInventory(pack);
    const el = document.createElement('div');
    el.className = 'inventory-pack';
    el.innerHTML = `
        <img class="inventory-pack-art" src="${data.image || ''}" alt="${data.name || 'Pack'}">
        <h3 class="inventory-pack-name">${data.name !== 'Unknown Pack' ? data.name : setId}</h3>
        <button type="button">Open</button>
    `;

    el.querySelector('button').addEventListener('click', () => openPack(pack.id));
    inventoryGrid.appendChild(el);

    if (data.name === 'Unknown Pack') {
        resolveSetName(setId).then(name => {
            if (name) el.querySelector('h3').textContent = name;
        });
    }
}

async function renderInventory() {
    message('Loading packs...');

    try {
        const packs = await getInventory();
        inventoryGrid.innerHTML = '';
        packs.length ? packs.forEach(renderPack) : message('No packs in inventory');
    } catch {
        message('Could not load packs. Please log in again.');
    }
}

void renderInventory();