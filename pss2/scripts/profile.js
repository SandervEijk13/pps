document.addEventListener("DOMContentLoaded", () => {

  const params =
    new URLSearchParams(window.location.search);

  const profileId =
    params.get("id") ||
    localStorage.getItem("userId");

  const loggedInUserId =
    localStorage.getItem("userId");

  const profileName =
    document.getElementById("profileName");

  const profileHandle =
    document.getElementById("profileHandle");

  const profileCoins =
    document.getElementById("profileCoins");

  const visitorActions =
    document.getElementById("visitorActions");

  loadProfile();

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

      profileName.textContent =
        data.user.username;

      profileHandle.textContent =
        `@${data.user.username}`;

      profileCoins.textContent =
        data.user.coins;

      if (
        String(profileId) !==
        String(loggedInUserId)
      ) {

        visitorActions.style.display = "flex";

      } else {

        visitorActions.style.display = "none";

      }

    } catch (err) {

      console.error(
        "Failed to load profile:",
        err,
      );
    }
  }
});