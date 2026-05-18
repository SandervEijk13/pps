const API_BASE = window.location.port === '5173'
    ? 'http://localhost/pss/api'
    : `${window.location.origin}/pss/api`;

async function packRequest(body = null) {
    const res = await fetch(`${API_BASE}/packs.php`, {
        method: body ? 'POST' : 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : null
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : {};

    if (!res.ok || data.success === false) {
        throw new Error(data.message || 'Pack request failed');
    }

    return data;
}

export async function getInventory() {
    try {
        const data = await packRequest();
        return data.packs || [];
    } catch (err) {
        if (err.message === 'Not logged in') return [];
        throw err;
    }
}

export async function addPackToInventory(setId, cardIds = null, tcgdexSetId = null, metadata = null) {
    const pack = {
        id: crypto.randomUUID(),
        setId,
        cardIds: cardIds || [],
        tcgdexSetId,
        setName: metadata?.setName || metadata?.name || null
    };

    const data = await packRequest(pack);
    return data.pack || pack;
}

export async function removePack(packId) {
    await packRequest({ action: 'delete', packId });
}
