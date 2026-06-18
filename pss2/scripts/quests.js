const API = typeof getApiBase === 'function'
    ? getApiBase()
    : `${window.location.origin}/pss/api`;

const profileId = sessionStorage.getItem('userId');
const dailyQuestListEl = document.getElementById('dailyQuestList');
const weeklyQuestListEl = document.getElementById('weeklyQuestList');
const milestoneListEl = document.getElementById('milestoneList');

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function loadQuests() {
    if (!profileId) {
        window.location.href = '/pages/login.html';
        return;
    }

    try {
        const response = await fetch(
            `${API}/profile_features.php?action=dashboard&id=${profileId}`,
            { credentials: 'include' }
        );
        const data = await response.json();
        if (!data.success) return;

        renderQuestList(dailyQuestListEl, data.quests?.daily?.quests || [], 'daily');
        renderQuestList(weeklyQuestListEl, data.quests?.weekly?.quests || [], 'weekly');
        renderMilestones(data.collectionMilestones || []);
    } catch (err) {
        console.error('Failed to load quests:', err);
    }
}

function renderQuestList(targetEl, quests, periodType) {
    if (!targetEl) return;
    if (!quests.length) {
        targetEl.innerHTML = '<p class="quest-empty">No quests right now.</p>';
        return;
    }

    targetEl.innerHTML = quests.map((quest) => {
        const progress = Math.min(Number(quest.progress) || 0, Number(quest.target) || 0);
        const target = Number(quest.target) || 0;
        const done = Boolean(quest.completed);
        const claimed = Boolean(quest.claimed);
        const canClaimNow = done && !claimed;
        return `
            <div class="quest-row">
                <div class="quest-main">
                    <strong>${escapeHtml(quest.label)}</strong>
                    <span>${progress.toLocaleString('en-US')} / ${target.toLocaleString('en-US')} · Reward ${quest.reward} coins</span>
                </div>
                ${claimed
                    ? '<span class="quest-pill is-claimed">Claimed</span>'
                    : done
                        ? `<button class="quest-btn" data-claim-quest="${escapeHtml(quest.key)}" data-period="${periodType}" ${canClaimNow ? '' : 'disabled'}>Claim</button>`
                        : '<span class="quest-pill">In progress</span>'
                }
            </div>
        `;
    }).join('');
}

function renderMilestones(items) {
    if (!milestoneListEl) return;
    if (!items.length) {
        milestoneListEl.innerHTML = '<p class="quest-empty">No milestones configured.</p>';
        return;
    }

    milestoneListEl.innerHTML = items.map((item) => {
        const current = Number(item.current) || 0;
        const target = Number(item.target) || 0;
        const done = Boolean(item.completed);
        const claimed = Boolean(item.claimed);
        const canClaimNow = done && !claimed;
        return `
            <div class="quest-row">
                <div class="quest-main">
                    <strong>${escapeHtml(item.label)}</strong>
                    <span>${current.toLocaleString('en-US')} / ${target.toLocaleString('en-US')} · Reward ${item.reward} coins</span>
                </div>
                ${claimed
                    ? '<span class="quest-pill is-claimed">Claimed</span>'
                    : done
                        ? `<button class="quest-btn" data-claim-milestone="${escapeHtml(item.key)}" ${canClaimNow ? '' : 'disabled'}>Claim</button>`
                        : '<span class="quest-pill">Locked</span>'
                }
            </div>
        `;
    }).join('');
}

document.addEventListener('click', async (event) => {
    const questButton = event.target.closest('[data-claim-quest]');
    if (questButton) {
        const questKey = questButton.getAttribute('data-claim-quest');
        const periodType = questButton.getAttribute('data-period');
        if (!questKey || !periodType) return;
        await claimQuest(periodType, questKey);
        return;
    }

    const milestoneButton = event.target.closest('[data-claim-milestone]');
    if (milestoneButton) {
        const milestoneKey = milestoneButton.getAttribute('data-claim-milestone');
        if (!milestoneKey) return;
        await claimMilestone(milestoneKey);
    }
});

async function claimQuest(periodType, questKey) {
    try {
        const response = await fetch(`${API}/profile_features.php?action=claimQuest`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ periodType, questKey }),
        });
        const data = await response.json();
        if (!data.success) {
            alert(data.message || 'Could not claim quest.');
            return;
        }
        if (typeof window.loadHeaderWallet === 'function') {
            window.loadHeaderWallet();
        }
        await loadQuests();
    } catch (err) {
        console.error('Quest claim failed:', err);
    }
}

async function claimMilestone(milestoneKey) {
    try {
        const response = await fetch(`${API}/profile_features.php?action=claimMilestone`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ milestoneKey }),
        });
        const data = await response.json();
        if (!data.success) {
            alert(data.message || 'Could not claim milestone.');
            return;
        }
        if (typeof window.loadHeaderWallet === 'function') {
            window.loadHeaderWallet();
        }
        await loadQuests();
    } catch (err) {
        console.error('Milestone claim failed:', err);
    }
}

loadQuests();
