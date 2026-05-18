const API_BASE = window.location.port === '5173'
    ? 'http://localhost/pss/api'
    : `${window.location.origin}/pss/api`;
const COINS_KEY = 'pokemon-coins';

async function request(file, body = null) {
    const res = await fetch(`${API_BASE}/${file}`, {
        method: body ? 'POST' : 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : null
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok || data.success === false) throw new Error(data.message || 'Request failed');
    return data;
}

export function getCoins() {
    return Number(localStorage.getItem(COINS_KEY)) || 5000;
}

export function setCoins(amount) {
    localStorage.setItem(COINS_KEY, amount);
}

export async function getInventory() {
    try {
        const data = await request('packs.php');
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

    const data = await request('packs.php', pack);
    return data.pack || pack;
}

export async function removePack(packId) {
    await request('packs.php', { action: 'delete', packId });
}