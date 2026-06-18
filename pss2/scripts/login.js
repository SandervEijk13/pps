function getApiBase() {

  if (window.location.port === "5173") {
    return "http://localhost/pss/api";
  }

  const parts = window.location.pathname.split("/");

  const pagesIndex = parts.indexOf("pages");

  const rootParts =
    pagesIndex >= 0
      ? parts.slice(0, pagesIndex)
      : parts.slice(0, -1);

  const root = rootParts.join("/") || "";

  return `${window.location.origin}${root}/api`;
}

const API = getApiBase();

// -------------------------
// AUTH CHECK
// -------------------------
function IsLogged() {
  return sessionStorage.getItem("isLogged") === "true";
}

// -------------------------
// LOGIN
// -------------------------
async function login() {

  const username =
    document.getElementById("loginUser").value;

  const password =
    document.getElementById("loginPassword").value;

  const res = await fetch(`${API}/login.php`, {

    method: "POST",

    credentials: "include",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      username,
      password
    }),
  });

  const data = await res.json();

  if (data.success) {

    sessionStorage.setItem("isLogged", "true");

    sessionStorage.setItem("userId", data.user.id);

    sessionStorage.setItem("username", data.user.username);

    sessionStorage.removeItem("pokemon-pack-inventory");

    const params = new URLSearchParams(window.location.search);
    const returnPath = params.get("return");
    const root = typeof getAppRoot === "function" ? getAppRoot() : "";

    if (returnPath && returnPath.startsWith("/") && !returnPath.startsWith("//")) {
      window.location.href = returnPath;
    } else {
      window.location.href = `${root}/index.html`;
    }

  } else {

    notification({
      text: data.message || "Login failed",
      duration: 5000,
      type: 'error',
      closeable: true
    });
  }
}

// -------------------------
// REGISTER
// -------------------------
async function register() {

  const username =
    document.getElementById("regUser").value;

  const email =
    document.getElementById("regEmail").value;

  const password =
    document.getElementById("regPassword").value;

  const res = await fetch(`${API}/register.php`, {

    method: "POST",

    credentials: "include",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      username,
      email,
      password
    }),
  });

  const data = await res.json();

  if (data.success) {

    notification({
      text: "Registration successful! Please log in.",
      duration: 5000,
      type: 'success',
      closeable: true
    });

    window.location.href = "login.html";

  } else {

    notification({
      text: data.message || "Register failed",
      duration: 5000,
      type: 'error',
      closeable: true
    });

  }
}

// -------------------------
// NAVIGATION
// -------------------------
function goRegister() {
  window.location.href = "register.html";
}

function goLogin() {
  window.location.href = "login.html";
}

// -------------------------
// REQUIRE LOGIN
// -------------------------
function requireLogin(action) {

  if (!IsLogged()) {

    window.location.href = "/pages/login.html";

    return;
  }

  action();
}

// -------------------------
// LOAD USER COINS
// -------------------------
(async function loadUserCoins() {

  const userId = sessionStorage.getItem("userId");

  if (!userId) return;

  try {

    const response = await fetch(
      `${API}/users.php?action=getCoins&id=${userId}`
    );

    const data = await response.json();

    if (data.success) {

      const coinElement =
        document.getElementById("coin-amount");

      if (coinElement) {
        coinElement.textContent = data.coins;
      }
    }

  } catch (err) {
    notification({
      text: `Failed to load user coins: ${err.message}`,
      duration: 5000,
      type: 'error',
      closeable: true
    });
  }

})();

// -------------------------
// DROPDOWN
// -------------------------
const userProfile =
  document.getElementById("userProfile");

const profileDropdown =
  document.getElementById("profileDropdown");

if (userProfile && profileDropdown) {

  userProfile.addEventListener("click", (e) => {

    e.stopPropagation();

    profileDropdown.classList.toggle("active");

  });

  document.addEventListener("click", () => {

    profileDropdown.classList.remove("active");

  });
}

// -------------------------
// PROFILE MENU
// -------------------------
const profileAction =
  document.getElementById("profileAction");

const profileActionText =
  document.getElementById("profileActionText");

const authAction =
  document.getElementById("authAction");

const authActionText =
  document.getElementById("authActionText");

function setupProfileDropdown() {

  if (
    !profileAction ||
    !profileActionText ||
    !authAction ||
    !authActionText
  ) {
    return;
  }

  // USERNAME UI
  const username =
    sessionStorage.getItem("username");

  const userNameElement =
    document.querySelector(".user-name");

  if (userNameElement && username) {
    userNameElement.textContent = username;
  }

  // NOT LOGGED IN
  if (!IsLogged()) {

    profileActionText.textContent = "Login";

    authActionText.textContent = "Login";

    profileAction.onclick = (e) => {

      e.preventDefault();

      window.location.href = "/pages/login.html";

    };

    authAction.onclick = (e) => {

      e.preventDefault();

      window.location.href = "/pages/login.html";

    };

  }

  // LOGGED IN
  else {

    profileActionText.textContent = "Profile";

    authActionText.textContent = "Logout";

    profileAction.onclick = (e) => {

      e.preventDefault();

      window.location.href = "/pages/profile.html";

    };

    authAction.onclick = (e) => {

      e.preventDefault();

      sessionStorage.clear();

      window.location.href = "/pages/login.html";

    };
  }
}

setupProfileDropdown();