
document.addEventListener('DOMContentLoaded', () => {
    const API = typeof getApiBase === 'function' ? getApiBase() : 'http://localhost/pss/api';
    const inventoryEl = document.getElementById('pcInventory');
    const slotsEl = document.getElementById('pcSlots');
    const previewName = document.getElementById('pcPreviewName');
    const previewTitle = document.getElementById('pcPreviewTitle');
    const bannerFx = document.getElementById('pcBannerFx');
    const frameFx = document.getElementById('pcFrameFx');
    const badgeSlots = document.getElementById('pcBadgeSlots');

    let cosmetics = [];
    let loadout = {};
    const currentSelection = {
        title: null,
        banner: null,
        frame: null,
        cardback: null,
        badge1: null,
        badge2: null,
        badge3: null,
    };
    const previewSelection = {
        title: null,
        banner: null,
        frame: null,
        cardback: null,
        badge1: null,
        badge2: null,
        badge3: null,
    };

    init();

    async function init() {
        if (!isLoggedIn()) {
            window.location.href = '/pages/login.html';
            return;
        }
        previewName.textContent = sessionStorage.getItem('username') || 'Trainer';
        await loadInventory();
    }

    async function loadInventory() {
        const res = await fetch(`${API}/profile_cosmetics.php?action=inventory`, { credentials: 'include' });
        const data = await res.json();
        if (!data.success) {
            inventoryEl.innerHTML = `<div class="pc-empty">${escapeHtml(data.message || 'Kon cosmetics niet laden')}</div>`;
            return;
        }
        cosmetics = data.owned || [];
        loadout = data.loadout || {};
        hydrateSelectionFromLoadout();
        renderSlots();
        renderInventory();
        applyPreview();
    }

    function hydrateSelectionFromLoadout() {
        currentSelection.title = loadout.title || null;
        currentSelection.banner = loadout.banner || null;
        currentSelection.frame = loadout.frame || null;
        currentSelection.cardback = loadout.cardback || null;
        const badges = loadout.badges || [];
        currentSelection.badge1 = badges[0] || null;
        currentSelection.badge2 = badges[1] || null;
        currentSelection.badge3 = badges[2] || null;
    }

    function renderSlots() {
        const slotConfig = [
            { slot: 'title', label: 'Title' },
            { slot: 'banner', label: 'Banner' },
            { slot: 'frame', label: 'Frame' },
            { slot: 'cardback', label: 'Cardback' },
            { slot: 'badge1', label: 'Badge Slot 1' },
            { slot: 'badge2', label: 'Badge Slot 2' },
            { slot: 'badge3', label: 'Badge Slot 3' },
        ];
        slotsEl.innerHTML = slotConfig.map((cfg) => {
            const item = getItemByKey(currentSelection[cfg.slot]);
            return `
                <button type="button" class="pc-slot-btn" data-slot="${cfg.slot}">
                    <strong>${cfg.label}</strong>
                    <span>${item ? escapeHtml(item.name) : 'None'}</span>
                </button>
            `;
        }).join('');
        slotsEl.querySelectorAll('[data-slot]').forEach((btn) => {
            btn.addEventListener('click', () => {
                slotsEl.querySelectorAll('.pc-slot-btn').forEach((b) => b.classList.remove('is-selected'));
                btn.classList.add('is-selected');
                renderInventory(btn.dataset.slot);
            });
        });
        slotsEl.querySelector('[data-slot="title"]')?.classList.add('is-selected');
    }

    function renderInventory(activeSlot = 'title') {
        const allowedType = getSlotType(activeSlot);
        const candidates = cosmetics.filter((item) => item.type === allowedType);
        inventoryEl.innerHTML = `
            <button type="button" class="pc-item pc-item--none" data-equip-slot="${activeSlot}" data-equip-key="">
                <strong>Unequip</strong><span>Remove current item</span>
            </button>
            ${candidates.map((item) => `
                <button
                    type="button"
                    class="pc-item pc-rarity-${escapeHtml(item.rarity)} fxv-${variantIndexForKey(item.cosmetic_key)} ${currentSelection[activeSlot] === item.cosmetic_key ? 'is-equipped' : ''} ${previewSelection[activeSlot] === item.cosmetic_key ? 'is-preview' : ''} ${item.unlocked ? '' : 'is-locked'}"
                    data-equip-slot="${activeSlot}"
                    data-equip-key="${escapeHtml(item.cosmetic_key)}"
                    data-animation="${escapeHtml(item.animation)}"
                >
                    <strong>${escapeHtml(item.name)}</strong>
                    <span>${escapeHtml(item.description || item.rarity)}</span>
                    <em>${escapeHtml(item.rarity)}${item.unlocked ? '' : ' · locked'}</em>
                <em>${escapeHtml(item.source_label || formatSourceLabel(item))}</em>
                </button>
            `).join('')}
        `;

        inventoryEl.querySelectorAll('[data-equip-slot]').forEach((button) => {
            button.addEventListener('click', async () => {
                const slot = button.dataset.equipSlot;
                const key = button.dataset.equipKey || null;
                if (!key) {
                    await equip(slot, null);
                    previewSelection[slot] = null;
                    renderSlots();
                    renderInventory(slot);
                    return;
                }

                const item = getItemByKey(key);
                if (item && !item.unlocked) {
                    previewSelection[slot] = key;
                    applyPreview();
                    renderInventory(slot);
                    return;
                }

                await equip(slot, key);
                previewSelection[slot] = null;
                renderSlots();
                renderInventory(slot);
            });
        });
    }

    async function equip(slot, cosmeticKey) {
        const res = await fetch(`${API}/profile_cosmetics.php?action=equip`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slot, cosmeticKey }),
        });
        const data = await res.json();
        if (!data.success) {
            console.log('Failed to equip item:', data.message);
            return;
        }
        loadout = data.loadout || {};
        hydrateSelectionFromLoadout();
        applyPreview();
    }

    function applyPreview() {
        const titleItem = getItemByKey(previewSelection.title || currentSelection.title);
        previewTitle.textContent = titleItem ? titleItem.name : 'No title equipped';

        bannerFx.className = 'pc-banner';
        frameFx.className = 'pc-avatar-wrap';
        badgeSlots.innerHTML = '';

        applyAnimationClass(bannerFx, getItemByKey(previewSelection.banner || currentSelection.banner));
        applyAnimationClass(frameFx, getItemByKey(previewSelection.frame || currentSelection.frame));

        [
            previewSelection.badge1 || currentSelection.badge1,
            previewSelection.badge2 || currentSelection.badge2,
            previewSelection.badge3 || currentSelection.badge3,
        ]
            .map((key) => getItemByKey(key))
            .filter(Boolean)
            .forEach((badge) => {
                const chip = document.createElement('span');
                chip.className = 'pc-badge-chip';
                chip.textContent = badge.name;
                applyAnimationClass(chip, badge);
                badgeSlots.appendChild(chip);
            });
    }

    function applyAnimationClass(node, item) {
        if (!node || !item) return;
        node.classList.remove('fxv-0', 'fxv-1', 'fxv-2', 'fxv-3', 'fxv-4', 'fxv-5', 'fxv-6', 'fxv-7');
        if (item.animation && item.animation !== 'none') node.classList.add(`anim-${item.animation}`);
        node.classList.add(`fxv-${variantIndexForKey(item.cosmetic_key)}`);
    }

    function getSlotType(slot) {
        if (slot.startsWith('badge')) return 'badge';
        return slot;
    }

    function getItemByKey(key) {
        if (!key) return null;
        return cosmetics.find((item) => item.cosmetic_key === key) || null;
    }

    function variantIndexForKey(key) {
        const raw = String(key || '');
        let hash = 0;
        for (let i = 0; i < raw.length; i += 1) {
            hash = ((hash << 5) - hash) + raw.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash) % 8;
    }

    function formatSourceLabel(item) {
        if (!item || item.source_type !== 'storybook') {
            return 'Source: profile cosmetics';
        }
        const ref = String(item.source_ref || '');
        if (ref === 'chapter_1') {
            return 'Source: Storybook Chapter 1 (25% set completion)';
        }
        if (ref === 'chapter_2') {
            return 'Source: Storybook Chapter 2 (50% set completion)';
        }
        if (ref === 'chapter_3') {
            return 'Source: Storybook Chapter 3 (75% set completion)';
        }
        if (ref === 'chapter_4') {
            return 'Source: Storybook Chapter 4 (100% set completion)';
        }
        if (ref === 'chapter_5') {
            return 'Source: Storybook Chapter 5 (100% + 1 extra quest objective)';
        }
        return 'Source: Storybook quest';
    }

    function isLoggedIn() {
        return sessionStorage.getItem('isLogged') === 'true' && sessionStorage.getItem('userId');
    }

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
});
