document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const profileId = params.get("id") || localStorage.getItem("userId");
  const loggedInUserId = localStorage.getItem("userId");
  
  const profileName = document.getElementById("profileName");
  const profileHandle = document.getElementById("profileHandle");
  const profileCoins = document.getElementById("profileCoins");
  const visitorActions = document.getElementById("visitorActions");
  const favoriteCardsGrid = document.getElementById("favoriteCardsGrid");

  loadProfile();
  loadFavoriteCards();

  async function loadProfile() {
    if (!profileId) {
      console.error("No profile id found");
      return;
    }

    try {
      const response = await fetch(
        `http://localhost/pss/api/users.php?action=getProfile&id=${profileId}`
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
      profileCoins.textContent = data.user.coins;

      if (String(profileId) !== String(loggedInUserId)) {
        visitorActions.style.display = "flex";
      } else {
        visitorActions.style.display = "none";
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
    }
  }

  async function loadFavoriteCards() {
    if (!profileId) {
      console.error("No profile id found");
      return;
    }

    try {
      const favoritesResponse = await fetch(
        `http://localhost/pss/api/favorite.php?action=get&user_id=${profileId}`
      );
      const favorites = await favoritesResponse.json();
      
      if (!favorites || favorites.length === 0) {
        renderFavoriteCards([]);
        return;
      }

      const cardIds = favorites.map(fav => fav.card_id);
      
      const cardPromises = cardIds.map(cardId => 
        fetch(`https://api.tcgdex.net/v2/en/cards/${cardId}`).then(res => res.json())
      );
      
      const cards = await Promise.all(cardPromises);
      renderFavoriteCards(cards);
      
    } catch (err) {
      console.error("Failed to load favorite cards:", err);
      favoriteCardsGrid.innerHTML = `
        <div class="fav-error">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Failed to load favourite cards</p>
        </div>
      `;
    }
  }

  function renderFavoriteCards(cards) {
    const MAX_SLOTS = 5;
    let html = '';

    // Render filled card slots
    for (let i = 0; i < Math.min(cards.length, MAX_SLOTS); i++) {
      const card = cards[i];
      const price = getCardPrice(card);
      const priceDisplay = price ? `€${price.toFixed(2)}` : 'No price';

      html += `
        <div class="fav-card" data-card-id="${card.id}">
          <div class="fav-card-image">
            ${card.image
              ? `<img src="${card.image}/high.jpg" alt="${card.name}" loading="lazy">`
              : `<i class="fas fa-image"></i>`
            }
          </div>
          <div class="fav-card-info">
            <div class="fav-card-name">${card.name}</div>
            <div class="fav-card-set">${card.set?.name || 'Unknown Set'} · #${card.localId}</div>
            <div class="fav-card-rarity">
              <i class="fas fa-gem"></i>
              <span>${card.rarity || 'Common'}</span>
            </div>
            <div class="fav-card-value">
              <img src="/images/pokecoin.png" alt="coin" class="fav-coin-img" />
              <span>${priceDisplay}</span>
            </div>
          </div>
        </div>
      `;
    }

    // Render empty slots for the remainder up to 5
    for (let i = cards.length; i < MAX_SLOTS; i++) {
      html += `
        <div class="fav-card empty">
          <div class="fav-card-image">
            <i class="fas fa-plus"></i>
          </div>
          <div class="fav-card-info">
            <div class="fav-card-name">Empty Slot</div>
            <div class="fav-card-set">No card favourited</div>
            <div class="fav-card-value fav-card-value--empty">
              <img src="/images/pokecoin.png" alt="coin" class="fav-coin-img fav-coin-img--empty" />
              <span>—</span>
            </div>
          </div>
        </div>
      `;
    }

    favoriteCardsGrid.innerHTML = html;
  }

  function isRare(card) {
    return /rare|holo|v|vmax|vstar|gx|ex|secret|gold/i
      .test((card.rarity || '').toLowerCase());
  }

  function getCardPrice(card) {
    const p = card.pricing?.cardmarket;
    if (!p) return 0;

    const values = [
      p.low,
      p.trend,
      p.avg1,
      p.avg7,
      p.avg30
    ].filter(v => typeof v === 'number' && v > 0);

    if (!values.length) return 0;

    return isRare(card)
      ? Math.max(...values)
      : Math.min(...values);
  }
});