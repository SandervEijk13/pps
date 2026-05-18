function getApiBase() {
  if (window.location.port === "5173") {
    return "http://localhost/pss/api";
  }

  const parts = window.location.pathname.split("/");
  const pagesIndex = parts.indexOf("pages");
  const rootParts = pagesIndex >= 0 ? parts.slice(0, pagesIndex) : parts.slice(0, -1);
  const root = rootParts.join("/") || "";
  return `${window.location.origin}${root}/api`;
}

const API = getApiBase();

// -------------------------
// AUTH CHECK (runs always first)
// -------------------------
function IsLogged() {
  return localStorage.getItem("isLogged") === "true";
}

// auto-check when page loads
(function () {
  const page = window.location.pathname;

  // if user is NOT logged in and tries to access protected page
  if (!IsLogged() && page.includes("index.html")) {
    // allow index normally (change if you want protection)
  }

  // optional: protect pages like "buy" or "trade"
})();

function authUIController() {
    const loginIcon = document.getElementById("loginIcon");
}


// -------------------------
// LOGIN
// -------------------------
async function login() {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  const res = await fetch(`${API}/login.php`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

if (data.success) {
  localStorage.setItem("isLogged", "true");
  localStorage.setItem("userId", data.user.id);
  localStorage.removeItem("pokemon-pack-inventory");

  console.log("LOGGED IN USER ID:", data.user.id);

  window.location.href = "/index.html";
} else {
    alert(data.message || "Login failed");
  }
}


// -------------------------
// REGISTER
// -------------------------
async function register() {
  const email = document.getElementById("regEmail").value;
  const password = document.getElementById("regPassword").value;

  const res = await fetch(`${API}/register.php`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (data.success) {
    alert("Account created! You can now login.");
    window.location.href = "login.html";
  } else {
    alert(data.message || "Register failed");
  }
}

// -------------------------
// NAV HELPERS
// -------------------------
function goRegister() {
  window.location.href = "register.html";
}

function goLogin() {
  window.location.href = "login.html";
}


// -------------------------
// PROTECTED ACTION WRAPPER
// (use this for Buy Now / Trade buttons)
// -------------------------
function requireLogin(action) {
  if (!IsLogged()) {
    window.location.href = "login.html";
    return;
  }

  action(); // run real function if logged in
}

// Helper function to get the coins amount of the user

(async function loadUserCoins() {

    const userId = localStorage.getItem("userId");
    if (!userId) {
        console.log("No UserId found");
        return;
    }
    try {
        const response = await fetch(
            `${API}/users.php?action=getCoins&id=${userId}`
        );

        const data = await response.json();

        if (data.success) {
            const coinElement = document.getElementById("user-coins");
            if (coinElement) {
                coinElement.textContent = data.coins;
            }
        } else {
            console.log(data.message);
        }
    } catch (err) {
        console.error("Failed to load coins:", err);
    }

})();

// ==================== HEADER / NAV ====================

(function headerNavSetup() {

    const loginIcon = document.getElementById("loginIcon");

    // -------------------------
    // COIN HOVER EFFECT
    // -------------------------

    const coinContainer = document.querySelector('.coin-badge');
    const coinAmount = document.querySelector('.coin-amount');

    if (coinContainer && coinAmount) {
        coinContainer.addEventListener('mouseenter', () => {
            coinAmount.style.textShadow = '0 0 6px #ffbc3c';
        });

        coinContainer.addEventListener('mouseleave', () => {
            coinAmount.style.textShadow = 'none';
        });
    }

    // -------------------------
    // LOGIN ICON RENDER
    // -------------------------

    function renderIcon() {
        if (!loginIcon) return;

        if (IsLogged()) {
            loginIcon.innerHTML = `<i class="fa-solid fa-right-from-bracket"></i>`;
        } else {
            loginIcon.innerHTML = `<i class="fa-solid fa-user"></i>`;
        }
    }

    // -------------------------
    // LOGIN ICON CLICK
    // -------------------------

    async function handleClick() {

        if (IsLogged()) {

            const confirmLogout = confirm("Logout?");
            if (!confirmLogout) return;

            try {
                await fetch(`${getApiBase()}/logout.php`, {
                    method: "POST",
                    credentials: "include"
                });

            } catch (err) {
                console.error("Failed to logout on server:", err);
            }

            localStorage.clear();

            renderIcon();
            window.location.reload();

        } else {

            window.location.href = "pages/login.html";
        }
    }

    // -------------------------
    // INIT
    // -------------------------

    renderIcon();

    loginIcon?.addEventListener("click", handleClick);

})();