import { notification } from '/scripts/notifications.js';

document.addEventListener('DOMContentLoaded', () => {
    const API = typeof getApiBase === 'function' ? getApiBase() : 'http://localhost/pss/api';
    const grid = document.getElementById('storybookGrid');
    const modal = document.getElementById('storySetModal');
    const modalClose = document.getElementById('storyModalClose');
    const modalCloseBtn = document.getElementById('storyModalCloseBtn');
    const setTitle = document.getElementById('storySetTitle');
    const setProgress = document.getElementById('storySetProgress');
    const chapterList = document.getElementById('storyChapterList');
    const setCover = document.getElementById('storySetCover');
    const nextChapterGuideEl = document.getElementById('storyNextChapterGuide');
    const eventSpotlight = document.getElementById('storyEventSpotlight');
    let activeSetId = null;

    init();

    async function init() {
        if (!isLoggedIn()) {
            window.location.href = '/pages/login.html';
            return;
        }
        modalClose?.addEventListener('click', closeModal);
        modalCloseBtn?.addEventListener('click', closeModal);
        await loadDashboard();
    }

    async function loadDashboard() {
        const res = await fetch(`${API}/storybook.php?action=dashboard`, { credentials: 'include' });
        const data = await res.json();
        if (!data.success) {
            grid.innerHTML = `<div class="story-empty">${escapeHtml(data.message || 'Could not load Storybook')}</div>`;
            return;
        }
        renderEvent(data.eventSpotlight);
        renderSets(data.sets || []);
    }

    function renderEvent(eventData) {
        if (!eventSpotlight || !eventData) return;
        eventSpotlight.classList.remove('is-hidden');
        eventSpotlight.innerHTML = `
            <strong><i class="fas fa-star"></i> ${escapeHtml(eventData.name)}</strong>
            <span>${escapeHtml(eventData.description || '')}</span>
        `;
    }

    function renderSets(sets) {
        if (!sets.length) {
            grid.innerHTML = `<div class="story-empty">No sets available for Storybook yet.</div>`;
            return;
        }
        grid.innerHTML = sets.map((set) => {
            const chapters = set.chapters || [];
            const claimed = chapters.filter((c) => c.claimed).length;
            const completeClass = set.isComplete ? 'story-card--complete' : '';
            return `
                <article class="story-card ${completeClass}" data-open-set="${escapeHtml(set.setId)}">
                    <div class="story-card-cover-wrap">
                        ${set.coverImage
                            ? `<img class="story-card-cover" src="${escapeHtml(set.coverImage)}" alt="${escapeHtml(set.setName)} cover" loading="lazy">`
                            : `<div class="story-card-cover story-card-cover--fallback"><i class="fas fa-images"></i></div>`
                        }
                    </div>
                    <header>
                        <h3>${escapeHtml(set.setName)}</h3>
                        <span>${set.completionPct}%</span>
                    </header>
                    <div class="story-progress">
                        <div class="story-progress-fill" style="width:${Math.min(100, set.completionPct)}%"></div>
                    </div>
                    <p>${set.owned}/${set.total} cards collected</p>
                    <div class="story-meta">
                        <span>${claimed}/${chapters.length} chapters claimed</span>
                        <button type="button" class="story-open-btn">Open</button>
                    </div>
                </article>
            `;
        }).join('');

        grid.querySelectorAll('[data-open-set]').forEach((node) => {
            node.addEventListener('click', () => openSet(node.dataset.openSet));
        });
    }

    async function openSet(setId) {
        activeSetId = setId;
        const res = await fetch(`${API}/storybook.php?action=set&setId=${encodeURIComponent(setId)}`, { credentials: 'include' });
        const data = await res.json();
        if (!data.success || !data.set) {
            return;
        }
        const set = data.set;
        setTitle.textContent = set.setName;
        setProgress.textContent = `${set.owned}/${set.total} · ${set.completionPct}%`;
    renderNextChapterGuide(set.nextChapterGuide);
        if (setCover) {
            if (set.coverImage) {
                setCover.src = set.coverImage;
                setCover.alt = `${set.setName} card art`;
                setCover.classList.remove('is-hidden');
            } else {
                setCover.classList.add('is-hidden');
                setCover.removeAttribute('src');
            }
        }
        chapterList.innerHTML = (set.chapters || []).map((chapter) => {
            const lockClass = chapter.unlocked ? '' : 'is-locked';
            const secretClass = chapter.isSecret ? 'is-secret' : '';
            let action = `<span class="story-chip">Locked</span>`;
            if (chapter.claimed) {
                action = `<span class="story-chip is-claimed">Claimed</span>`;
            } else if (chapter.canClaim) {
                action = `<button type="button" class="story-claim-btn" data-claim="${chapter.chapterNo}">Claim</button>`;
            } else if (chapter.unlocked) {
                action = `<span class="story-chip">Ready</span>`;
            }
            return `
                <div class="story-chapter ${lockClass} ${secretClass}">
                    <div class="story-chapter-head">
                        <strong>Chapter ${chapter.chapterNo}: ${escapeHtml(chapter.title)}</strong>
                        <em>${chapter.unlockPct}%</em>
                    </div>
                    <p>${escapeHtml(chapter.body)}</p>
                    ${Array.isArray(chapter.questRequirements) && chapter.questRequirements.length
                        ? `<div class="story-quest-reqs">
                            <h4>Extra quest requirements (complete 1)</h4>
                            ${chapter.chapter4Claimed === false
                                ? `<p class="story-quest-note">Progress starts counting after you claim Chapter 4.</p>`
                                : ''
                            }
                            ${chapter.questRequirements.map((req) => `
                                <div class="story-quest-req ${req.done ? 'is-done' : ''}">
                                    <span>${escapeHtml(req.label)}</span>
                                    <strong>${Number(req.current)}/${Number(req.target)}</strong>
                                </div>
                            `).join('')}
                        </div>`
                        : ''
                    }
                    <div class="story-chapter-reward">
                        <span>+${chapter.rewardCoins} coins</span>
                        ${chapter.rewardCosmeticKey ? `<span>+ cosmetic</span>` : ''}
                        ${action}
                    </div>
                </div>
            `;
        }).join('');

        chapterList.querySelectorAll('[data-claim]').forEach((button) => {
            button.addEventListener('click', async (event) => {
                event.stopPropagation();
                const chapterNo = Number(button.dataset.claim);
                await claimChapter(chapterNo, button);
            });
        });

        modal.classList.remove('is-hidden');
    }

function renderNextChapterGuide(guide) {
    if (!nextChapterGuideEl) return;
    if (!guide) {
        nextChapterGuideEl.innerHTML = `
            <section class="story-next-guide">
                <h3>Next chapter</h3>
                <p>All chapter unlock percentages for this set are complete.</p>
            </section>
        `;
        return;
    }

    const missingCards = Array.isArray(guide.missingCards) ? guide.missingCards : [];
    nextChapterGuideEl.innerHTML = `
        <section class="story-next-guide">
            <h3>Next chapter: ${escapeHtml(guide.title)} (${guide.unlockPct}%)</h3>
            <p>You still need <strong>${Number(guide.cardsNeeded)}</strong> more card(s).</p>
            ${missingCards.length
                ? `<div class="story-missing-grid">
                    ${missingCards.map((card) => `
                        <article class="story-missing-card">
                            ${card.image
                                ? `<img src="${escapeHtml(card.image)}" alt="${escapeHtml(card.name)}" loading="lazy">`
                                : `<div class="story-missing-fallback"><i class="fas fa-image"></i></div>`
                            }
                            <span>${escapeHtml(card.name)}</span>
                        </article>
                    `).join('')}
                </div>`
                : '<p class="story-next-empty">No specific missing cards found.</p>'
            }
        </section>
    `;
}

    async function claimChapter(chapterNo, button) {
        if (!activeSetId) return;
        button.disabled = true;
        const res = await fetch(`${API}/storybook.php?action=claimChapter`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ setId: activeSetId, chapterNo }),
        });
        const data = await res.json();
        if (!data.success) {
            notification({
                text: `Failed to claim chapter: ${data.message}`,
                duration: 5000,
                type: 'error',
                closeable: true
            });
            button.disabled = false;
            return;
        }
        await openSet(activeSetId);
        await loadDashboard();
        if (typeof window.loadHeaderWallet === 'function') {
            window.loadHeaderWallet();
        }
    }

    function closeModal() {
        modal.classList.add('is-hidden');
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
