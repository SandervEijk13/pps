document.addEventListener("DOMContentLoaded", () => {

  const params = new URLSearchParams(window.location.search);

  const profileId =
    params.get("id") ||
    sessionStorage.getItem("userId");

  const loggedInUserId =
    sessionStorage.getItem("userId");

  const profileName = document.getElementById("profileName");
  const profileHandle = document.getElementById("profileHandle");
  const profileTitleList = document.getElementById("profileTitleList");
  const profileCosmeticBadges = document.getElementById("profileCosmeticBadges");
  const profileCoins = document.getElementById("profileCoins");
  const visitorActions = document.getElementById("visitorActions");
  const profileLevelTitle = document.getElementById("profileLevelTitle");
  const profileLevel = document.getElementById("profileLevel");
  const levelXpText = document.getElementById("levelXpText");
  const levelXpFill = document.getElementById("levelXpFill");
  const nextLevelNum = document.getElementById("nextLevelNum");
  const levelReqsList = document.getElementById("levelReqsList");
  const raffleTimer = document.getElementById("raffleTimer");
  const rafflePrize = document.getElementById("rafflePrize");
  const raffleMyTickets = document.getElementById("raffleMyTickets");
  const raffleMyChance = document.getElementById("raffleMyChance");
  const rafflePool = document.getElementById("rafflePool");
  const raffleHistory = document.getElementById("raffleHistory");
  const profileHeaderCard = document.querySelector(".profile-header-card");
  const profileAvatar = document.querySelector(".profile-avatar-wrap");
  const profileActionStrip = document.getElementById("profileActionStrip");

  const API = typeof getApiBase === "function"
    ? getApiBase()
    : "http://localhost/pss/api";

  let raffleEndsIn = 0;
  let raffleTimerInterval = null;

  const isOwnProfile = String(profileId) === String(loggedInUserId);

  if (profileActionStrip) {
    profileActionStrip.hidden = !isOwnProfile;
  }

  loadProfile();
  loadAchievements();
  loadLevel();
  loadRaffle(isOwnProfile);
  loadFavorites();
  loadProfileCosmeticsShowcase();
  if (!isOwnProfile && loggedInUserId) {
    loadCollectionCompare();
  }

  async function loadCollectionCompare() {
    const card = document.getElementById('collectionCompareCard');
    const statsEl = document.getElementById('collectionCompareStats');
    if (!card || !statsEl || !profileId) return;

    try {
      const response = await fetch(
        `${API}/collection_compare.php?userId=${profileId}`,
        { credentials: 'include' }
      );
      const data = await response.json();
      if (!data.success || !data.comparison) {
        card.hidden = true;
        return;
      }

      const c = data.comparison;
      const name = data.target?.username || 'this trainer';
      statsEl.innerHTML = `
        <div class="compare-stat"><strong>${formatNumber(c.shared)}</strong><span>cards in common</span></div>
        <div class="compare-stat"><strong>${formatNumber(c.targetOnly)}</strong><span>only ${escapeHtml(name)} has</span></div>
        <div class="compare-stat"><strong>${formatNumber(c.viewerOnly)}</strong><span>only you have</span></div>
      `;
      card.hidden = false;
    } catch (err) {
      console.error('Failed to load collection comparison:', err);
      card.hidden = true;
    }
  }

  async function loadProfile() {

    if (!profileId) {
      console.error("No profile id found");
      return;
    }

    try {

      const response = await fetch(
        `${API}/users.php?action=getProfile&id=${profileId}`
      );

      const data = await response.json();

      if (!data.success) {

        console.error(data.message);

        profileName.textContent = "User not found";
        profileHandle.textContent = "";
        return;
      }

      profileName.textContent = data.user.username;
      profileHandle.textContent = `@${data.user.username}`;
      profileCoins.textContent = formatNumber(data.user.coins);

      if (String(profileId) !== String(loggedInUserId)) {
        visitorActions.style.display = "flex";
      } else {
        visitorActions.style.display = "none";
      }

    } catch (err) {
      console.error("Failed to load profile:", err);
    }
  }

  async function loadLevel() {
    if (!profileId || !profileLevel) {
      return;
    }

    try {
      const response = await fetch(
        `${API}/progression.php?action=getLevel&id=${profileId}`
      );
      const data = await response.json();

      if (!data.success || !data.level) {
        return;
      }

      const level = data.level;

      if (profileLevelTitle) {
        profileLevelTitle.textContent = level.title;
      }

      profileLevel.textContent = level.level;
      nextLevelNum.textContent = level.nextLevel;
      levelXpText.textContent = `${formatNumber(level.xp)} / ${formatNumber(level.xpRequired)}`;
      levelXpFill.style.width = `${level.xpProgress}%`;

      levelReqsList.innerHTML = level.requirements.map((req) => {
        const metClass = req.met ? " met" : "";
        const icon = req.icon || "fa-circle-check";
        const current = formatReqValue(req.current, req.type);
        const required = formatReqValue(req.required, req.type);

        return `
          <li class="level-req${metClass}">
            <i class="fas ${icon}"></i>
            <span class="level-req-label">${escapeHtml(req.label)}</span>
            <span class="level-req-value">${current} / ${required}</span>
          </li>
        `;
      }).join("");

    } catch (err) {
      console.error("Failed to load level:", err);
    }
  }

  async function loadAchievements() {
    if (!profileId || !profileTitleList) {
      return;
    }

    try {
      const response = await fetch(
        `${API}/achievements.php?action=get&id=${profileId}`,
        { credentials: "include" }
      );
      const data = await response.json();

      if (!data.success || !Array.isArray(data.achievements)) {
        profileTitleList.innerHTML = "";
        return;
      }

      const visible = data.achievements.slice(0, 6);
      profileTitleList.innerHTML = visible.map((achievement) => {
        const activeClass = achievement.isActive ? " is-active" : "";
        const icon = escapeHtml(achievement.icon || "fa-award");
        const title = escapeHtml(achievement.title || achievement.name || "Title");
        return `
          <span class="profile-title-chip${activeClass}" title="${escapeHtml(achievement.description || title)}">
            <i class="fas ${icon}"></i>
            ${title}
          </span>
        `;
      }).join("");
    } catch (err) {
      console.error("Failed to load achievements:", err);
      profileTitleList.innerHTML = "";
    }
  }

  async function loadProfileCosmeticsShowcase() {
    if (!profileId) return;
    try {
      const response = await fetch(
        `${API}/profile_cosmetics.php?action=showcase&id=${profileId}`,
        { credentials: "include" }
      );
      const data = await response.json();
      if (!data.success) return;
      const loadout = data.loadout || {};
      const items = Array.isArray(data.items) ? data.items : [];
      const itemMap = new Map(items.map((item) => [item.cosmetic_key, item]));

      const frame = loadout.frame ? itemMap.get(loadout.frame) : null;
      const banner = loadout.banner ? itemMap.get(loadout.banner) : null;
      const title = loadout.title ? itemMap.get(loadout.title) : null;
      const badges = (loadout.badges || []).map((key) => itemMap.get(key)).filter(Boolean);

      if (profileHeaderCard) {
        profileHeaderCard.classList.remove("fx-pulse", "fx-shimmer", "fx-glow", "fx-cosmic");
      }
      if (profileAvatar) {
        profileAvatar.classList.remove("fx-pulse", "fx-shimmer", "fx-glow", "fx-cosmic");
      }
      applyAnimClass(profileHeaderCard, banner?.animation);
      applyAnimClass(profileAvatar, frame?.animation);

      if (title) {
        profileLevelTitle.textContent = title.name;
      }

      if (profileCosmeticBadges) {
        profileCosmeticBadges.innerHTML = badges.map((badge) => {
          const animClass = badge.animation && badge.animation !== "none"
            ? `fx-${escapeHtml(badge.animation)}`
            : "";
          return `<span class="profile-cosmetic-badge ${animClass}">${escapeHtml(badge.name)}</span>`;
        }).join("");
      }
    } catch (err) {
      console.error("Failed to load cosmetic showcase:", err);
    }
  }

  function applyAnimClass(node, animation) {
    if (!node || !animation || animation === "none") return;
    node.classList.add(`fx-${animation}`);
  }

  async function loadRaffle(ownProfile = isOwnProfile) {
    if (!rafflePrize) {
      return;
    }

    const ticketLabel = document.querySelector(
      "#raffleCard .raffle-stat:first-child .raffle-stat-label"
    );
    if (ticketLabel) {
      ticketLabel.textContent = ownProfile ? "Your tickets" : "Tickets";
    }

    try {
      const url = ownProfile
        ? `${API}/progression.php?action=getRaffle`
        : `${API}/progression.php?action=getRaffle&userId=${profileId}`;

      const response = await fetch(url, { credentials: "include" });
      const data = await response.json();

      if (!data.success || !data.raffle) {
        return;
      }

      const raffle = data.raffle;

      rafflePrize.textContent = raffle.prizeLabel;
      raffleMyTickets.textContent = formatNumber(raffle.myTickets);
      raffleMyChance.textContent = `${raffle.myChancePercent}%`;
      rafflePool.textContent = formatNumber(raffle.totalTickets);

      raffleEndsIn = raffle.endsInSeconds;
      updateRaffleTimer();
      if (raffleTimerInterval) {
        clearInterval(raffleTimerInterval);
      }
      raffleTimerInterval = setInterval(() => {
        if (raffleEndsIn > 0) {
          raffleEndsIn -= 1;
        }
        updateRaffleTimer();
        if (raffleEndsIn <= 0) {
          loadRaffle(ownProfile);
        }
      }, 1000);

      const shortHistory = Array.isArray(raffle.history) ? raffle.history.slice(0, 3) : [];
      if (!shortHistory.length) {
        raffleHistory.innerHTML = `<li class="raffle-history-empty">No winners yet this session.</li>`;
      } else {
        raffleHistory.innerHTML = shortHistory.map((item) => `
          <li>
            <span class="raffle-winner">${escapeHtml(item.winnerName)}</span>
            <span class="raffle-win-prize">${escapeHtml(item.prizeLabel)}</span>
            <span class="raffle-win-meta">${item.winnerTickets}/${item.totalTickets} tickets</span>
          </li>
        `).join("");
      }

    } catch (err) {
      console.error("Failed to load raffle:", err);
    }
  }

  function updateRaffleTimer() {
    if (!raffleTimer) {
      return;
    }

    const mins = Math.floor(raffleEndsIn / 60);
    const secs = raffleEndsIn % 60;
    raffleTimer.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  function formatNumber(value) {
    const num = Number(value) || 0;
    return num.toLocaleString("nl-NL", { maximumFractionDigits: 2 });
  }

  function formatReqValue(value, type) {
    if (["win_count", "upgrader_wins", "battles_won"].includes(type)) {
      return String(Math.floor(Number(value) || 0));
    }
    return formatNumber(value);
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

async function loadFavorites() {

  const grid = document.getElementById("favoriteCardsGrid");

  if (!grid || !profileId) {
    return;
  }

  try {

    const response = await fetch(
      `${API}/favorite.php?action=get&user_id=${profileId}`,
      {
        credentials: "include"
      }
    );

    const favorites = await response.json();

    grid.innerHTML = "";

    for (const favorite of favorites) {

      try {

        const cardResponse = await fetch(
          `https://api.tcgdex.net/v2/en/cards/${favorite.card_id}`
        );

        const card = await cardResponse.json();

       const image = card.image
        ? `${card.image}/high.webp`
        : "/images/card-placeholder.png";

      const price =
        card.pricing?.cardmarket?.avg ??
        card.pricing?.cardmarket?.trend ??
        card.pricing?.tcgplayer?.normal?.marketPrice ??
        0;

        grid.innerHTML += `
          <div class="fav-card">
            <div class="fav-card-image">
              <img
                src="${image}"
                alt="${escapeHtml(card.name)}"
                loading="lazy"
              >
            </div>

            <div class="fav-card-info">
              <div class="fav-card-name">
                ${escapeHtml(card.name)}
              </div>

              <div class="fav-card-set">
                ${escapeHtml(card.set?.name || "Unknown Set")}
              </div>

              <div class="fav-card-value">
                <img
                  class="coin-img coin-card"
                  src="/images/pokecoin.png"
                >
                ${formatNumber(price)}
              </div>
            </div>
          </div>
        `;

      } catch (err) {
        console.error("Card load failed:", favorite.card_id, err);
      }
    }

    const emptySlots = Math.max(0, 5 - favorites.length);

    for (let i = 0; i < emptySlots; i++) {

      grid.innerHTML += `
        <div class="fav-card empty">
          <div class="fav-card-image">
            <i class="fas fa-plus"></i>
          </div>

          <div class="fav-card-info">
            <div class="fav-card-name">
              Empty Slot
            </div>

            <div class="fav-card-set">
              Add a favourite
            </div>

            <div class="fav-card-value">
              <img class="coin-img coin-card" src="/images/pokecoin.png">
              —
            </div>
          </div>
        </div>
      `;
    }

  } catch (err) {
    console.error("Failed to load favorites:", err);
  }
}

});


