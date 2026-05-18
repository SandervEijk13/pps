/**
 * tcgdx card.list({ set }) rows are already scoped to that set, but many rows
 * only expose localId / number — not a full id string matching "{setId}-...".
 */
export function resolveListItemCardId(entry, tcgdexSetId) {
    if (!entry || tcgdexSetId == null) return null;
    const sid = String(tcgdexSetId);
    const raw = entry.id ?? entry.cardID ?? entry.cardId;
    if (raw != null && String(raw).trim() !== "") {
        return String(raw);
    }
    const lid = entry.localId ?? entry.number;
    if (lid != null && String(lid).trim() !== "") {
        return `${sid}-${lid}`;
    }
    return null;
}

export function uniqueIdsFromCardList(list, tcgdexSetId) {
    const ids = (list || [])
        .map((c) => resolveListItemCardId(c, tcgdexSetId))
        .filter(Boolean);
    return [...new Set(ids)];
}

/**
 * One request to learn card ids in a set (no full card bodies).
 * Uses `tcgdex.set.get` first (smaller than `card.list` for many APIs); falls back to `card.list`
 * if the set payload has no resolvable ids.
 *
 * @param {*} tcgdex - TCGdex SDK instance
 * @param {string} setKey - TCGdex set id (e.g. bs1, sm3)
 * @returns {Promise<{ source: 'set.get' | 'card.list' | 'none'; ids: string[] }>}
 */
export async function fetchCardIdPoolForSet(tcgdex, setKey) {
    if (!tcgdex || setKey == null || String(setKey).trim() === '') {
        return { source: 'none', ids: [] };
    }
    const key = String(setKey).trim();

    try {
        const setData = await tcgdex.set.get(key);
        const ids = uniqueIdsFromCardList(setData?.cards, key);
        if (ids.length) {
            return { source: 'set.get', ids };
        }
    } catch {
        /* fall through */
    }

    try {
        const list = await tcgdex.card.list({ set: key });
        const ids = uniqueIdsFromCardList(list, key);
        return { source: 'card.list', ids };
    } catch {
        return { source: 'none', ids: [] };
    }
}
