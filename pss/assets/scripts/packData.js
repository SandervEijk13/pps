/** TCGdex v2 `/sets/{id}` ids (legacy shop/slug aliases → API id). */
const TCGDEX_SET_API_ALIASES = {
    bs1: 'base1',
    bs2: 'base2',
    bs3: 'base3',
    sv045pt: 'sv05'
};

/**
 * @param {string | null | undefined} id
 * @returns {string}
 */
export function resolveTcgdexApiSetId(id) {
    if (id == null || String(id).trim() === '') return '';
    const s = String(id).trim();
    return TCGDEX_SET_API_ALIASES[s] || s;
}

export const PACK_CONFIG = {
    base1: {
        price: 120,
        image: '/assets/images/packs/base/base1.png',
        tcgdexId: 'base1',
        name: 'Base Set 1'
    },

    base2: {
        price: 140,
        image: '/assets/images/packs/base/base2.png',
        tcgdexId: 'base2',
        name: 'Base Set 2'
    },

    base3: {
        price: 140,
        image: '/assets/images/packs/base/base3.png',
        tcgdexId: 'base3',
        name: 'Base Set 3'
    },

    sv05: {
        price: 320,
        image: '/assets/images/packs/sv3.5.png',
        tcgdexId: 'sv05',
        name: 'Temporal Forces'
    },

    neo1: {
        price: 150,
        image: '/assets/images/packs/neo/neo1.png',
        tcgdexId: 'neo1',
        name: 'Neo Genesis'
    },

    gym1: {
        price: 150,
        image: '/assets/images/packs/gym/gym1.png',
        tcgdexId: 'gym1',
        name: 'Gym Heroes'
    }
};

function resolvePackConfigKey(id) {
    if (id == null || String(id).trim() === '') return null;

    const raw = String(id).trim();
    const resolved = resolveTcgdexApiSetId(raw);

    if (PACK_CONFIG[raw]) return raw;
    if (PACK_CONFIG[resolved]) return resolved;

    for (const key of Object.keys(PACK_CONFIG)) {
        const cfg = PACK_CONFIG[key];
        if (key === raw || key === resolved) return key;
        if (cfg.tcgdexId === raw || cfg.tcgdexId === resolved) return key;
    }

    return null;
}

export function getPackData(setId) {
    const key = resolvePackConfigKey(setId);
    if (key) return PACK_CONFIG[key];

    const fallbackId = setId ? resolveTcgdexApiSetId(setId) : 'unknown';
    return {
        price: 250,
        image: '/assets/images/packs/default.png',
        tcgdexId: fallbackId,
        name: 'Unknown Pack'
    };
}

/**
 * Resolve shop / inventory pack row to the same config as images in PACK_CONFIG.
 * Matches config key, or any entry whose `tcgdexId` equals `pack.setId` or `pack.tcgdexSetId`.
 */
export function getPackDataForInventory(pack) {
    const setId = pack?.setId ?? pack?.set ?? pack?.setID ?? null;
    const tcg = pack?.tcgdexSetId ?? null;
    const storedName = pack?.name ?? pack?.setName ?? pack?.title ?? null;

    const configKey = resolvePackConfigKey(setId) || resolvePackConfigKey(tcg);
    const data = configKey ? getPackData(configKey) : getPackData(setId || tcg || 'unknown');

    if (storedName && data.name === 'Unknown Pack') {
        return { ...data, name: storedName };
    }

    return data;
}