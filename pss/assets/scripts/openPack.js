import TCGdex from '@tcgdex/sdk';
import MemoryCache from '@cachex/memory';
import { getPackData, resolveTcgdexApiSetId } from './packData.js';
import { fetchCardIdPoolForSet } from './tcgdexResolve.js';

const tcgdex = new TCGdex('en');
tcgdex.setCache(new MemoryCache());

// ======================
// PARAMS
// ======================
const params = new URLSearchParams(window.location.search);
const setId = params.get('set');

// ======================
// DOM
// ======================
const packImage = document.getElementById("packImage");
const peelImage = document.getElementById("peelImage");

// ======================
// HARD GUARD (DIT FIXT JE MAIN ISSUE)
// ======================
if (!setId || setId === "null" || setId === "undefined") {
    document.body.innerHTML = `
        <div style="
            color:white;
            font-size:24px;
            display:flex;
            justify-content:center;
            align-items:center;
            height:100vh;
            background:#0d1117;
            flex-direction:column;
            text-align:center;
        ">
            ❌ Geen setId gevonden<br><br>
            Check inventory → navigation URL
        </div>
    `;
    throw new Error("Missing setId");
}

// ======================
// PACK IMAGE
// ======================
const packData = getPackData(setId);
const tcgdexSetId = resolveTcgdexApiSetId(packData.tcgdexId || setId);

if (packImage) packImage.src = packData.image;
if (peelImage) peelImage.src = packData.image;

// ======================
// FETCH CARDS (ROBUST + DEBUG)
// ======================
async function getPackCards() {
    try {
        const { source, ids: poolIds } = await fetchCardIdPoolForSet(tcgdex, tcgdexSetId);

        if (!poolIds.length) {
            throw new Error("No cards returned for this set");
        }

        const shuffled = [...poolIds]
            .sort(() => Math.random() - 0.5)
            .slice(0, 10);

        const idsToPull = shuffled.map((id) => (typeof id === 'string' ? id : String(id)));

        const results = await Promise.allSettled(
            idsToPull.map((id) => tcgdex.card.get(id))
        );

        results.forEach((r, i) => {
            const id = idsToPull[i];
            if (r.status !== "fulfilled") {
                console.warn(`[openPack] tcgdex.card.get("${id}") rejected`, r.reason);
            }
        });

        const detailed = results
            .filter(r => r.status === "fulfilled")
            .map(r => r.value);

        return detailed;

    } catch (err) {
        console.error("PACK LOAD ERROR:", err);

        document.body.innerHTML = `
            <div style="
                color:white;
                font-size:20px;
                display:flex;
                justify-content:center;
                align-items:center;
                height:100vh;
                background:#0d1117;
                flex-direction:column;
            ">
                ❌ Failed to load cards<br><br>
                Check console
            </div>
        `;

        return [];
    }
}

// ======================
// INIT (SAFE)
// ======================
window.addEventListener("DOMContentLoaded", async () => {
    try {
        const pulledCards = await getPackCards();

        if (!pulledCards.length) {
            throw new Error("No cards loaded");
        }

        const cardElements = document.querySelectorAll('.pokemon-card');

        if (cardElements.length === 0) {
            throw new Error("No .pokemon-card elements in DOM");
        }

        pulledCards.forEach((card, index) => {

            const el = cardElements[index];
            if (!el) return;

            const back = el.querySelector('.pokemon-card-back');

            const img =
                card?.images?.high ||
                card?.images?.large ||
                card?.image ||
                null;

            if (!img) {
                console.warn("Missing image:", card);
                return;
            }

            if (back) {
                back.style.backgroundImage = `url('${img}')`;
            }
        });

    } catch (err) {
        console.error("INIT ERROR:", err);

        document.body.innerHTML = `
            <div style="
                color:white;
                font-size:20px;
                display:flex;
                justify-content:center;
                align-items:center;
                height:100vh;
                background:#0d1117;
                flex-direction:column;
                text-align:center;
            ">
                ❌ Pack failed to initialize<br><br>
                Check console (F12)
            </div>
        `;
    }
});
