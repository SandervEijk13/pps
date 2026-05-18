import TCGdex from '@tcgdex/sdk';
import MemoryCache from '@cachex/memory';
import { getPackData, getPackDataForInventory, resolveTcgdexApiSetId } from './packData.js';
import { getInventory, removePack } from './packApi.js';
import { fetchCardIdPoolForSet } from './tcgdexResolve.js';
import { getDisplayPriceLabel } from './cardPricing.js';

const tcgdex = new TCGdex('en');
tcgdex.setCache(new MemoryCache());

/** Same-origin API as pages (e.g. …/pss5/api/save_cards.php). */
function apiSaveCardsUrl() {
    if (window.location.port === '5173') {
        return 'http://localhost/pss/api/save_cards.php';
    }

    return new URL('../../api/save_cards.php', window.location.href).href;
}

/** Per-pack fetch trace in the console (no full-set dumps). */
function logPackFetch(phase, payload) {
}

const persistedPullIds = new Set();

/**
 * Add a revealed card to the same collection used on sets/cards.html (user_cards).
 * Fire-and-forget; logs status to the console.
 */
async function persistPulledCardToCollection(card) {
    if (!card?.id) return;
    if (persistedPullIds.has(card.id)) return;

    const url = apiSaveCardsUrl();
    const body = { cardId: card.id };

    try {
        logPackFetch('POST save_cards.php request', { url, body });

        const res = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const text = await res.text();
        let parsed = null;
        try {
            parsed = JSON.parse(text);
        } catch {
            /* non-JSON body */
        }

        logPackFetch('POST save_cards.php response', {
            status: res.status,
            ok: res.ok,
            bodyText: text,
            parsed
        });

        if (res.ok) {
            persistedPullIds.add(card.id);
        } else {
            console.warn('[Pack → Collection] HTTP error — card still visible; try logging in on cards page.');
        }
    } catch (err) {
        console.warn('[Pack → Collection] Network error', card.id, err);
    }
}

// ======================
// PARAMS — open via ?packId= (inventory) or legacy ?set=
// ======================
const params = new URLSearchParams(window.location.search);
const packId = params.get('packId');
const setIdFromUrl = params.get('set');

/** @type {string | null} */
let openingPackId = null;
/** @type {string[] | null} */
let preselectedCardIds = null;
/** @type {object | null} */
let inventoryPack = null;
let setId;

if (packId) {
    let inventory = [];
    try {
        inventory = await getInventory();
    } catch (err) {
        console.error('Could not load account pack inventory:', err);
    }

    inventoryPack = inventory.find((p) => p.id === packId);
    if (!inventoryPack) {
        document.body.innerHTML = `
            <div style="color:white;font-size:20px;display:flex;justify-content:center;align-items:center;height:100vh;background:#0d1117;flex-direction:column;text-align:center;padding:20px;">
                Pack not found for this account. It may have already been opened, or you may need to log in.<br><br>
                <a href="../inventory.html" style="color:#8fafff;">Back to inventory</a>
            </div>
        `;
        throw new Error('Pack not found');
    }
    openingPackId = packId;
    setId = inventoryPack.setId ?? inventoryPack.set ?? inventoryPack.setID ?? inventoryPack.tcgdexSetId;
    preselectedCardIds = inventoryPack.cardIds ?? null;
} else {
    setId = setIdFromUrl;
}

// Get tcgdex mapping (inventory: resolve by tcg id so art/name match PACK_CONFIG)
const packData = inventoryPack ? getPackDataForInventory(inventoryPack) : getPackData(setId);

const tcgdexSetId = resolveTcgdexApiSetId(packData.tcgdexId || setId);
/** TCGdex set used for list/get — frozen on sealed packs */
const sealedTcgdexSetId = resolveTcgdexApiSetId(inventoryPack?.tcgdexSetId || tcgdexSetId);

function packDisplayName() {
    if (packData?.name && packData.name !== 'Unknown Pack') return packData.name;
    return setId || sealedTcgdexSetId || 'Pack';
}

async function resolvePackDisplayName() {
    const current = packDisplayName();
    if (packData?.name && packData.name !== 'Unknown Pack') return current;

    try {
        const setData = await tcgdex.set.get(sealedTcgdexSetId);
        return setData?.name || current;
    } catch (err) {
        console.warn('Could not resolve pack display name:', sealedTcgdexSetId, err);
        return current;
    }
}

// Check if setId is valid
if (!setId || setId === "undefined" || setId === "null") {
    document.body.innerHTML = "❌ Invalid setId in URL";
    throw new Error("Invalid setId");
}

function isCardIdForSet(cardId, setKey) {
    if (cardId == null || setKey == null) return false;
    const id = String(cardId);
    const s = String(setKey);
    return id === s || id.startsWith(`${s}-`);
}

/** TCGdex may expose `set` as an object or a string; match id/code/slug. */
function normalizeCardSetRef(setField) {
    if (setField == null) return null;
    if (typeof setField === "string" && setField.trim() !== "") return setField.trim();
    if (typeof setField === "object") {
        const id = setField.id ?? setField.code ?? setField.slug;
        if (id != null && String(id).trim() !== "") return String(id).trim();
    }
    return null;
}

/** Small console summary for each pulled card (used by getPackCards logging). */
function summarizeFetchedCard(card) {
    if (!card) return null;
    return {
        id: card.id,
        name: card.name,
        rarity: card.rarity ?? '',
        setRef: normalizeCardSetRef(card.set),
        displayPrice: getDisplayPriceLabel(card) ?? null
    };
}

function isEnergyCard(card) {
    const category = String(card?.category || card?.supertype || '').toLowerCase();
    const types = Array.isArray(card?.types) ? card.types.join(' ').toLowerCase() : '';
    return category.includes('energy') || types.includes('energy') || /\benergy$/i.test(card?.name || '');
}

function isRareOrBetter(card) {
    return /rare|holo|vmax|vstar|double|ultra|secret|gold|rainbow|hyper|illustration|shiny/i
        .test(card?.rarity || '');
}

function isCommonOrUncommon(card) {
    const rarity = String(card?.rarity || '').trim().toLowerCase();
    return !isEnergyCard(card) && !isRareOrBetter(card) && (rarity === 'common' || rarity === 'uncommon');
}

function normalPackOrder(cards) {
    const commons = cards.filter(isCommonOrUncommon);
    const rare = cards.find(isRareOrBetter);
    const energy = cards.find((card) => isEnergyCard(card) && !isRareOrBetter(card));
    const lastSlot = energy || commons[8];

    if (commons.length >= 8 && rare && lastSlot) {
        return energy
            ? [...commons.slice(0, 8), rare, energy]
            : [...commons.slice(0, 8), lastSlot, rare];
    }

    return cards;
}

async function repairNormalPack(cards) {
    const commons = cards.filter(isCommonOrUncommon);
    let rare = cards.find(isRareOrBetter);
    let energy = cards.find((card) => isEnergyCard(card) && !isRareOrBetter(card));

    if (commons.length >= 8 && rare && energy) {
        return [...commons.slice(0, 8), rare, energy];
    }

    const usedIds = new Set(cards.map((card) => card.id));
    const { ids } = await fetchCardIdPoolForSet(tcgdex, sealedTcgdexSetId);
    const candidates = ids
        .filter((id) => !usedIds.has(id))
        .sort(() => Math.random() - 0.5);

    const fetched = [];
    for (const id of candidates) {
        if (commons.length >= 9 && rare && energy) break;

        const card = await tcgdex.card.get(id);
        fetched.push(card);
        if (commons.length < 9 && isCommonOrUncommon(card)) {
            commons.push(card);
        } else if (!rare && isRareOrBetter(card)) {
            rare = card;
        } else if (!energy && isEnergyCard(card) && !isRareOrBetter(card)) {
            energy = card;
        }
    }

    const ordered = energy
        ? [...commons.slice(0, 8), rare, energy]
        : [...commons.slice(0, 8), commons[8], rare];
    const filler = [...cards, ...fetched].filter((card) =>
        !ordered.some((picked) => picked.id === card.id) &&
        !isRareOrBetter(card) &&
        !isEnergyCard(card)
    );

    return [...ordered, ...filler].slice(0, 10);
}

/**
 * Slugs that identify *this* pack's set (shop id + TCGdex id, e.g. base1 + bs1).
 * Longest-first for prefix checks on `card.id`.
 */
function allowedPackSetSlugs() {
    const list = [];
    const seen = new Set();
    const add = (v) => {
        if (v == null) return;
        const s = String(v).trim();
        if (!s || seen.has(s)) return;
        seen.add(s);
        list.push(s);
    };
    add(sealedTcgdexSetId);
    add(tcgdexSetId);
    add(setId);
    if (inventoryPack?.setId) add(inventoryPack.setId);
    return list.sort((a, b) => b.length - a.length);
}

/** Only TCGdex/API set ids — used to validate `card.id` prefixes (avoids loose shop-only slugs). */
function slugKeysForCardIdStrictPrefix() {
    const list = [];
    const seen = new Set();
    const add = (v) => {
        if (v == null) return;
        const s = String(v).trim();
        if (!s || seen.has(s)) return;
        seen.add(s);
        list.push(s);
    };
    add(sealedTcgdexSetId);
    add(tcgdexSetId);
    return list.sort((a, b) => b.length - a.length);
}

/** Only cards from this pack's set: `card.id` must match a TCGdex set slug, or `set` ref matches any known slug. */
function cardBelongsToThisPack(card) {
    if (!card) return false;
    const idKeys = slugKeysForCardIdStrictPrefix();
    const cid = card.id;
    if (typeof cid === "string" && cid.trim() !== "") {
        for (const s of idKeys) {
            if (isCardIdForSet(cid, s)) return true;
        }
    }
    const setRef = normalizeCardSetRef(card.set);
    if (setRef) {
        for (const s of allowedPackSetSlugs()) {
            if (setRef === s) return true;
        }
    }
    return false;
}

// ======================
// DOM
// ======================
const pack = document.getElementById("pack");
const scene = document.querySelector(".scene");
const cardsContainer = document.getElementById("cardsContainer");

// ======================
// STATE
// ======================
let opened = false;
let cards = [];
let currentCardIndex = 0;
const removedCards = [];

// ======================
// HELPERS
// ======================
/**
 * Asset URLs use the set **code** (often same as id). `set` may be a string or only `{ id }`.
 */
function resolveAssetSetCodeFromCard(card) {
    if (!card) return null;
    if (typeof card.set === 'string' && String(card.set).trim() !== '') {
        return String(card.set).trim();
    }
    if (card.set && typeof card.set === 'object') {
        const c = card.set.code ?? card.set.id;
        if (c != null && String(c).trim() !== '') return String(c).trim();
    }
    return null;
}

/**
 * Local id for assets path; may be missing on light card payloads — parse from `card.id` (e.g. bs1-4).
 */
function resolveAssetLocalIdFromCard(card) {
    if (!card) return null;
    const lid = card.localId ?? card.number;
    if (lid !== undefined && lid !== null && String(lid).trim() !== '') {
        return String(lid).trim();
    }
    const fullId = card.id;
    if (typeof fullId !== 'string' || !fullId.includes('-')) return null;
    const setKeys = allowedPackSetSlugs();
    for (const k of setKeys) {
        const prefix = `${k}-`;
        if (fullId.startsWith(prefix)) return fullId.slice(prefix.length);
    }
    const dash = fullId.indexOf('-');
    if (dash > 0) return fullId.slice(dash + 1);
    return null;
}

function resolveAssetSetCodeForUrl(card) {
    return (
        resolveAssetSetCodeFromCard(card) ||
        sealedTcgdexSetId ||
        tcgdexSetId ||
        null
    );
}

/**
 * TCGdex v2 cards rarely expose `images.high` as a full URL.
 * Match cards.js / randomcard.js: SDK helper, assets host, or /en/{set}/{localId}/high.webp
 */
function getCardImageUrl(card) {
    if (!card) return null;

    if (typeof card.getImageURL === 'function') {
        try {
            const u = card.getImageURL('high', 'webp');
            if (u && typeof u === 'string') {
                if (/^https?:\/\//i.test(u)) return u;
                if (u.startsWith('/')) return `https://assets.tcgdex.net${u}`;
                return u;
            }
        } catch (_) {
            /* fall through */
        }
    }

    if (card.image && typeof card.image === 'string') {
        if (/^https?:\/\//i.test(card.image)) return card.image;
        const path = card.image.startsWith('/') ? card.image : `/${card.image}`;
        return `https://assets.tcgdex.net${path}`;
    }

    const setCode = resolveAssetSetCodeForUrl(card);
    const localId = resolveAssetLocalIdFromCard(card);

    if (setCode != null && localId != null && String(localId) !== '') {
        return `https://assets.tcgdex.net/en/${setCode}/${localId}/high.webp`;
    }

    return (
        card?.images?.high ||
        card?.images?.large ||
        null
    );
}

// ======================
// PACK CLICK ANIMATION (SIMPLIFIED)
// ======================
pack?.addEventListener("click", () => {
    if (opened) return;
    opened = true;

    document.getElementById("clickHint")?.style.setProperty("opacity", "0");

    const packRip = document.getElementById("packRip");
    const packLower = document.getElementById("packLower");

    pack?.style?.setProperty("pointer-events", "none");

    packRip?.classList.add("pack-anim-rip");

    const RIP_MS = 720;
    const DROP_MS = 1200;

    setTimeout(() => {
        packLower?.classList.add("pack-anim-drop");
        cardsContainer?.classList.add("show");
        scene?.classList.add("scene-pack-open");
    }, RIP_MS);

    setTimeout(() => {
        pack?.remove();
    }, RIP_MS + DROP_MS + 80);
});

// ======================
// FETCH CARDS (ROBUST + DEBUG)
// ======================
async function getPackCards() {
    try {
        logPackFetch('context (slim)', {
            setId,
            packId,
            sealedTcgdexSetId,
            tcgdexSetId,
            sealedCount: preselectedCardIds?.length ?? 0
        });

        const sealedRaw = preselectedCardIds || [];
        const sealedUnique = [...new Set(sealedRaw.filter(Boolean))];

        let idsToFetch = [];
        let poolIds = [];
        let shuffled = [];

        const usedFullSeal = sealedUnique.length >= 10;

        if (usedFullSeal) {
            const idKeys = slugKeysForCardIdStrictPrefix();
            const inSet = (id) => id && idKeys.some((s) => isCardIdForSet(String(id), s));
            const sealedForThisSet = sealedUnique.filter(inSet);
            if (sealedForThisSet.length < 10) {
                console.warn(
                    "⚠️ Sealed pack had ids outside this set; rebuilding from set id pool.",
                    { sealedTcgdexSetId, idKeys, dropped: sealedUnique.length - sealedForThisSet.length }
                );
                idsToFetch = [];
            } else {
                idsToFetch = sealedForThisSet.slice(0, 10);
                logPackFetch('sealed pack — only tcgdex.card.get × 10 (no set list)', { idsToFetch });
            }
        }

        if (!usedFullSeal || !idsToFetch.length) {
            const { source, ids } = await fetchCardIdPoolForSet(tcgdex, sealedTcgdexSetId);
            poolIds = ids;

            logPackFetch('set id pool (one lightweight call; no full card bodies)', {
                source,
                set: sealedTcgdexSetId,
                poolSize: poolIds.length
            });

            if (!poolIds.length) {
                throw new Error("No cards found for this set");
            }

            const poolSet = new Set(poolIds);
            const idSet = new Set();

            const idKeys = slugKeysForCardIdStrictPrefix();
            const sealed = sealedUnique.filter(
                (id) =>
                    id &&
                    (poolSet.has(id) || idKeys.some((s) => isCardIdForSet(String(id), s)))
            );
            for (const id of sealed) {
                if (idsToFetch.length >= 10) break;
                if (!idSet.has(id)) {
                    idSet.add(id);
                    idsToFetch.push(id);
                }
            }

            shuffled = [...poolIds].sort(() => Math.random() - 0.5);
            for (const id of shuffled) {
                if (idsToFetch.length >= 10) break;
                if (!idSet.has(id)) {
                    idSet.add(id);
                    idsToFetch.push(id);
                }
            }

            if (idsToFetch.length < 10) {
                throw new Error("Not enough unique cards in this set for a pack.");
            }

            idsToFetch = idsToFetch.slice(0, 10);
            logPackFetch('picked 10 ids for tcgdex.card.get', { idsToFetch });
        }

        logPackFetch('fetching only these 10 cards (tcgdex.card.get)', { idsToFetch });

        const detailed = [];

        const settled = await Promise.allSettled(
            idsToFetch.map((id) => tcgdex.card.get(id))
        );

        settled.forEach((r, i) => {
            const id = idsToFetch[i];
            if (r.status === "fulfilled") {
                logPackFetch(`card [${i + 1}/10]`, summarizeFetchedCard(r.value));
            } else {
                console.warn(`[Pack fetch] tcgdex.card.get("${id}") rejected`, r.reason);
            }
        });

        for (let i = 0; i < settled.length; i++) {
            const r = settled[i];
            if (r.status !== "fulfilled") continue;
            const card = r.value;
            if (cardBelongsToThisPack(card)) {
                detailed.push(card);
            } else {
                logPackFetch('dropped card (set mismatch vs this pack)', {
                    requestedId: idsToFetch[i],
                    cardId: card?.id,
                    summary: summarizeFetchedCard(card)
                });
            }
        }

        if (detailed.length < 10) {
            if (!poolIds.length) {
                const { source, ids } = await fetchCardIdPoolForSet(tcgdex, sealedTcgdexSetId);
                logPackFetch('retry: refreshed id pool', { source, poolSize: ids.length });
                poolIds = ids;
                shuffled = [...poolIds].sort(() => Math.random() - 0.5);
            }

            const have = new Set(detailed.map((c) => c.id));
            for (const id of shuffled) {
                if (detailed.length >= 10) break;
                if (have.has(id)) continue;
                const full = await tcgdex.card.get(id);
                logPackFetch(`retry card.get`, summarizeFetchedCard(full));
                if (cardBelongsToThisPack(full)) {
                    detailed.push(full);
                    have.add(id);
                }
            }
        }

        if (detailed.length < 10) {
            throw new Error("Could not load 10 cards from this set.");
        }

        const repaired = await repairNormalPack(detailed);
        const valid = repaired.slice(0, 10).map((card) => {
            const url = getCardImageUrl(card);
            if (!url) {
                console.warn("⚠️ Card missing image URL:", card?.id);
                return null;
            }
            return { ...card, _img: url };
        });

        const filtered = valid.filter(Boolean);
        if (filtered.length < 10) {
            throw new Error("Some cards failed to resolve image URLs.");
        }

        return filtered;
    } catch (err) {
        console.error("❌ PACK LOAD ERROR:", err);
        console.error("❌ Error message:", err.message);
        console.error("❌ sealedTcgdexSetId used:", sealedTcgdexSetId);
        document.body.innerHTML = `
            <div style="
                display:flex;
                justify-content:center;
                align-items:center;
                height:100vh;
                color:white;
                font-size:20px;
                background:#0d1117;
                flex-direction:column;
                text-align:center;
                padding:20px;
            ">
                ❌ Failed to load pack<br><br>
                <small style="color:#999; font-size:14px;">
                    Set ID: ${sealedTcgdexSetId}<br>
                    Error: ${err.message}<br>
                    Check console (F12) for details
                </small>
            </div>
        `;

        return [];
    }
}

// ======================
// RENDER CARDS (FIXED - NO HTML DEPENDENCY)
// ======================
function escapeAttr(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/** Human-readable set name for hover (TCGdex `set.name`, else this pack’s title). */
function getCardSetDisplayName(card) {
    if (!card) return packData?.name || "";
    const s = card.set;
    if (s && typeof s === "object" && typeof s.name === "string" && s.name.trim() !== "") {
        return s.name.trim();
    }
    return packData?.name || String(sealedTcgdexSetId || "");
}

function renderCards(cards) {
    cardsContainer.innerHTML = "";

    const fragment = document.createDocumentFragment();

    cards.forEach((card, index) => {
        const el = document.createElement("div");
        el.className = "pokemon-card";

        el.innerHTML = `
            <div class="pokemon-card-inner">
                <div class="pokemon-card-back"></div>
                <div class="pokemon-card-front">
                    <img class="real-card-img" src="${escapeAttr(card._img)}" alt="">
                </div>
            </div>
            <div class="pokemon-card-meta" aria-hidden="true">
                <span class="pokemon-card-price"></span>
                <span class="pokemon-card-rarity"></span>
            </div>
        `;
        const priceEl = el.querySelector(".pokemon-card-price");
        if (priceEl) {
            const label = getDisplayPriceLabel(card);
            priceEl.textContent = label ? `Market ≈ ${label}` : "No market price (TCGdex)";
        }
        const rarityEl = el.querySelector(".pokemon-card-rarity");
        if (rarityEl) rarityEl.textContent = card.rarity || "No rarity";

        el.style.zIndex = 100 - index;
        el.style.left = "50%";
        el.style.top = "50%";
        el.style.transform = `
            translate(calc(-50% + ${index * 3}px), calc(-50% + ${index * 2}px))
        `;

        el.style.transition = "transform 0.5s ease";

        if (index !== 0) {
            el.style.pointerEvents = "none";
        }

        fragment.appendChild(el);
    });

    cardsContainer.appendChild(fragment);

    return document.querySelectorAll(".pokemon-card");
}

function hidePackLoading() {
    const el = document.getElementById("packLoading");
    if (!el) return;
    el.classList.add("is-hidden");
    el.style.display = "none";
    el.setAttribute("aria-hidden", "true");
}

/** Visible when URL contains `?debug=1` (or `&debug=1`). */
function renderFetchDebug(fetchedCards) {
    const el = document.getElementById("packFetchDebug");
    if (!el) return;
    const on = params.get("debug") === "1" || params.get("debug") === "true";
    if (!on) {
        el.hidden = true;
        el.textContent = "";
        return;
    }

    el.hidden = false;

    const setLine = (s) => {
        if (!s) return "";
        if (typeof s === "object" && s.name) return String(s.name);
        if (typeof s === "string") return s;
        return "";
    };

    const lines = [
        "— Pack fetch debug (?debug=1) —",
        `setId (URL / inventory): ${setId ?? "(none)"}`,
        `sealedTcgdexSetId: ${sealedTcgdexSetId}`,
        `tcgdexSetId (from packData): ${tcgdexSetId}`,
        `packData.name: ${packData?.name ?? ""}`,
        packId ? `inventory row id (uuid): ${packId}` : "(not opened from inventory)",
        preselectedCardIds?.length
            ? `stored cardIds (${preselectedCardIds.length}): ${preselectedCardIds.slice(0, 18).join(", ")}${
                  preselectedCardIds.length > 18 ? " …" : ""
              }`
            : "stored cardIds: (none)",
        "",
        `Fetched (${fetchedCards.length}):`
    ];

    fetchedCards.forEach((c, i) => {
        const p = getDisplayPriceLabel(c) ?? '—';
        lines.push(
            `  [${i + 1}] id=${c.id ?? ""}  name=${c.name ?? ""}  setName=${setLine(c.set)}  setRef=${normalizeCardSetRef(c.set) ?? ""}  price=${p}`
        );
    });

    el.textContent = lines.join("\n");
}

// ======================
// INIT — modules may load after DOMContentLoaded; always run when ready
// ======================
let packPageInitStarted = false;

async function initPackPage() {
    if (packPageInitStarted) return;
    packPageInitStarted = true;

    try {
        cards = await getPackCards();

        if (!cards.length) {
            console.error("❌ ERROR at line 188: No cards loaded");
            throw new Error("No cards loaded");
        }

        hidePackLoading();

        const cardElements = renderCards(cards);

        renderFetchDebug(cards);

        const setNameTitleEl = document.getElementById('setNameTitle');
        if (setNameTitleEl) setNameTitleEl.textContent = await resolvePackDisplayName();
        pack?.style.removeProperty('display');

        document.getElementById('backBtn')?.addEventListener('click', () => {
            window.location.href = '../inventory.html';
        });

        activateCard(0);

        // ======================
        // CLICK SYSTEM
        // ======================
        cardElements.forEach((cardEl, index) => {
            let flipped = false;
            let flippedAt = 0;

            cardEl.addEventListener("click", () => {
                if (index !== currentCardIndex) return;

                if (!flipped) {
                    flipped = true;
                    flippedAt = Date.now();
                    cardEl.classList.add("flipped");
                    const pulled = cards[index];
                    if (pulled?.id && !persistedPullIds.has(pulled.id)) {
                        void persistPulledCardToCollection(pulled);
                    }
                    return;
                }

                if (Date.now() - flippedAt < 450) return;

                removeCard(cardEl, cardElements);
                currentCardIndex++;

                const next = cardElements[currentCardIndex];
                if (next) next.style.pointerEvents = "auto";
            });
        });

        if (openingPackId) {
            await removePack(openingPackId);
        }

    } catch (err) {
        console.error("❌ INIT ERROR:", err);
        console.error("❌ Error message:", err.message);

        hidePackLoading();

        document.body.innerHTML = `
            <div style="
                display:flex;
                justify-content:center;
                align-items:center;
                height:100vh;
                color:white;
                font-size:20px;
                background:#0d1117;
                flex-direction:column;
                text-align:center;
                padding:20px;
            ">
                ❌ Pack failed to initialize<br><br>
                <small style="color:#999; font-size:14px;">
                    Error: ${err.message}<br>
                    Check console (F12) for more details
                </small>
            </div>
        `;
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void initPackPage());
} else {
    void initPackPage();
}

// ======================
// STACK LOGIC
// ======================
function activateCard(index) {
    const cardsEl = document.querySelectorAll(".pokemon-card");
    if (cardsEl[index]) {
        cardsEl[index].style.pointerEvents = "auto";
    }
}

function removeCard(card, cardElements) {
    card.style.transition = "transform 0.7s ease, opacity 0.7s ease";

    card.style.transform = `
        translate(calc(-50%), calc(-50% - 120px))
        rotate(15deg)
        scale(0.7)
    `;

    card.style.opacity = "0";

    setTimeout(() => {
        card.style.display = "none";
        removedCards.push(card);

        updateStack(cardElements);

        if (removedCards.length === cards.length) {
            showReviewSpread();
        }
    }, 700);
}

function updateStack(cardElements) {
    cardElements.forEach((card, index) => {
        if (card.style.display === "none") return;

        const relative = index - currentCardIndex;

        if (relative >= 0) {
            card.style.transform = `
                translate(calc(-50% + ${relative * 4}px), calc(-50% + ${relative * 2}px))
            `;
        }
    });
}

function showReviewSpread() {
    cardsContainer.classList.add("review-mode");

    const total = removedCards.length;
    const spread = Math.min(900, window.innerWidth * 0.85);

    removedCards.forEach((card, index) => {
        card.style.display = "block";
        card.style.opacity = "1";
        card.style.left = "50%";
        card.style.top = "50%";
        card.classList.add("flipped");

        const progress = total > 1 ? index / (total - 1) : 0.5;
        const x = (progress - 0.5) * spread;
        const curve = Math.sin(progress * Math.PI) * -180;
        const rotate = (progress - 0.5) * 50;

        setTimeout(() => {
            card.style.transition = "transform 1s ease";

            card.style.transform = `
                translate(calc(-50% + ${x}px), calc(-50% + ${curve}px))
                rotate(${rotate}deg)
                scale(1)
            `;

            card.style.zIndex = index + 1;
        }, index * 120);
    });
}