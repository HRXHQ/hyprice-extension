const defaultTokens = {
  "HYPE": "hyperliquid/0x13ba5fea7078ab3798fbce53b4d0721c",
  "PURR": "hyperliquid/0xfc760b168211659961d1e5c0dfa67344",
  "HFUN": "hyperliquid/0x929bdfee96b790d3ff9a6cb31e96147e"
};

let refreshInterval = 15000; // 15 seconds
let refreshTimer;
let previousPrices = {};

// Load and save notification history persistently
async function loadNotificationHistory() {
  return new Promise((resolve) => {
    chrome.storage.local.get("notificationHistory", (data) => {
      resolve(data.notificationHistory ? JSON.parse(data.notificationHistory) : {});
    });
  });
}

async function saveNotificationHistory(history) {
  chrome.storage.local.set({ "notificationHistory": JSON.stringify(history) });
}

async function loadTokens() {
  return new Promise((resolve) => {
    chrome.storage.local.get("tokens", (data) => {
      resolve(data.tokens ? JSON.parse(data.tokens) : { ...defaultTokens });
    });
  });
}

async function loadFavourites() {
  return new Promise((resolve) => {
    chrome.storage.local.get("favourites", (data) => {
      resolve(data.favourites ? JSON.parse(data.favourites) : {});
    });
  });
}

async function loadNotifications() {
  return new Promise((resolve) => {
    chrome.storage.local.get("notifications", (data) => {
      resolve(data.notifications ? JSON.parse(data.notifications) : []);
    });
  });
}

async function saveTokens(tokens) {
  chrome.storage.local.set({ "tokens": JSON.stringify(tokens) });
}

async function saveFavourites(favourites) {
  chrome.storage.local.set({ "favourites": JSON.stringify(favourites) });
}

async function saveNotifications(notifications) {
  chrome.storage.local.set({ "notifications": JSON.stringify(notifications) });
}

async function addNotification(message) {
  let notifications = await loadNotifications();
  notifications.push(message);
  await saveNotifications(notifications);
  updateNotificationsUI();
}

async function clearNotifications() {
  await saveNotifications([]);
  updateNotificationsUI();
}

async function updateNotificationsUI() {
  let notifications = await loadNotifications();
  let notificationsList = document.getElementById("notificationsList");
  notificationsList.innerHTML = "";
  notifications.forEach((notification) => {
    let notificationItem = document.createElement("div");
    notificationItem.className = "notification-item";
    notificationItem.textContent = notification;
    notificationsList.appendChild(notificationItem);
  });
  updateNotificationIcon();
}

async function updateNotificationIcon() {
  let notifications = await loadNotifications();
  let iconImg = document.querySelector("#notificationsIcon img");
  if (notifications && notifications.length > 0) {
    iconImg.src = "notification-icon-active.png";
  } else {
    iconImg.src = "notification-icon-empty.png";
  }
}

async function fetchTokenPrice(tokenName, pairAddress) {
  let favourites = await loadFavourites();
  let history = await loadNotificationHistory();

  try {
    let apiUrl = `https://api.dexscreener.com/latest/dex/pairs/${pairAddress}`;
    let response = await fetch(apiUrl);
    let data = await response.json();
    if (data && data.pairs.length > 0) {
      let pairData = data.pairs[0];
      let price = parseFloat(pairData.priceUsd).toFixed(4);
      let change = pairData.priceChange.h24 ? parseFloat(pairData.priceChange.h24).toFixed(2) : "N/A";
      let tokenAddress = pairData.baseToken.address;
      let iconUrl = `https://dd.dexscreener.com/ds-data/tokens/hyperliquid/${tokenAddress}.png?size=lg`;
      let dexUrl = `https://dexscreener.com/hyperliquid/${pairAddress.split('/')[1]}`;

      let changeValue = parseFloat(change);
      if (Math.abs(changeValue) >= 5) {
        if (history[tokenName] === undefined || Math.abs(changeValue - history[tokenName]) >= 5) {
          let message = `${tokenName} price changed by ${change}%`;
          await addNotification(message);
          history[tokenName] = changeValue; // Update the history with the new change value
          await saveNotificationHistory(history); // Save the updated history
        }
      }

      previousPrices[tokenName] = change;
      let tokenDiv = document.createElement("div");
      tokenDiv.className = "token";
      tokenDiv.setAttribute("data-token", tokenName);
      tokenDiv.innerHTML = `
        <div class="token-info">
          <span class="favourite-btn ${favourites[tokenName] ? 'favourited' : ''}" data-token="${tokenName}">${favourites[tokenName] ? "★" : "☆"}</span>
          <a href="${dexUrl}" target="_blank" class="token-link">
            <img src="${iconUrl}" class="token-icon" alt="${tokenName} Icon">
            <span>${tokenName}: $${price} <span class="${changeValue >= 0 ? 'positive' : 'negative'}">(${change}%)</span></span>
          </a>
        </div>
        ${!favourites[tokenName] ? `<span class="remove-btn" data-token="${tokenName}">−</span>` : ""}
      `;
      return tokenDiv;
    } else {
      let tokenDiv = document.createElement("div");
      tokenDiv.className = "token";
      tokenDiv.setAttribute("data-token", tokenName);
      tokenDiv.innerHTML = `
        <div class="token-info">
          <span class="favourite-btn ${favourites[tokenName] ? 'favourited' : ''}" data-token="${tokenName}">${favourites[tokenName] ? "★" : "☆"}</span>
          <div class="token-link">
            <img src="https://via.placeholder.com/24" class="token-icon" alt="${tokenName} Icon">
            <span>${tokenName}: Data Unavailable</span>
          </div>
        </div>
        ${!favourites[tokenName] ? `<span class="remove-btn" data-token="${tokenName}">−</span>` : ""}
      `;
      return tokenDiv;
    }
  } catch (error) {
    console.error("Error fetching token price:", error);
    return null;
  }
}

async function fetchPrices() {
  let tokens = await loadTokens();
  let pricesDiv = document.getElementById("prices");
  pricesDiv.innerHTML = ""; // Clear the existing tokens before appending new ones

  for (let token in tokens) {
    let tokenDiv = await fetchTokenPrice(token, tokens[token]);
    if (tokenDiv) {
      pricesDiv.appendChild(tokenDiv);
    }
  }
}

async function addToken() {
  let tokenName = document.getElementById("tokenName").value.toUpperCase().trim();
  let pairAddress = document.getElementById("pairAddress").value.trim();
  let errorMessage = document.getElementById("errorMessage");

  if (!tokenName || !pairAddress) {
    // Show inline error message
    errorMessage.textContent = "Please enter a valid token name and Dexscreener pair address.";
    errorMessage.style.display = "block";
    return;
  }

  // Clear any previous error message
  errorMessage.textContent = "";
  errorMessage.style.display = "none";

  let tokens = await loadTokens();
  tokens[tokenName] = `hyperliquid/${pairAddress}`;
  await saveTokens(tokens);
  document.getElementById("tokenName").value = "";
  document.getElementById("pairAddress").value = "";

  // Fetch and display the new token's price without refreshing the entire list
  await fetchPrices();
}

async function removeToken(tokenName) {
  let tokens = await loadTokens();
  let favourites = await loadFavourites();
  if (tokens[tokenName] && !favourites[tokenName]) {
    delete tokens[tokenName];
    await saveTokens(tokens);

    // Remove the token's UI element directly
    let tokenDiv = document.querySelector(`.token[data-token="${tokenName}"]`);
    if (tokenDiv) {
      tokenDiv.remove();
    }
  }
}

async function toggleFavourite(tokenName) {
  let favourites = await loadFavourites();
  if (favourites[tokenName]) {
    delete favourites[tokenName];
  } else {
    favourites[tokenName] = true;
  }
  await saveFavourites(favourites);
  updateFavouriteUI(tokenName);
}

async function updateFavouriteUI(tokenName) {
  let favourites = await loadFavourites();
  let tokenDiv = document.querySelector(`.token[data-token="${tokenName}"]`);
  if (tokenDiv) {
    let favouriteBtn = tokenDiv.querySelector('.favourite-btn');
    let removeBtn = tokenDiv.querySelector('.remove-btn');
    if (favourites[tokenName]) {
      favouriteBtn.innerHTML = "★";
      favouriteBtn.classList.add("favourited");
      if (removeBtn) removeBtn.remove();
    } else {
      favouriteBtn.innerHTML = "☆";
      favouriteBtn.classList.remove("favourited");
      if (!removeBtn) {
        let newRemoveBtn = document.createElement("span");
        newRemoveBtn.className = "remove-btn";
        newRemoveBtn.setAttribute("data-token", tokenName);
        newRemoveBtn.innerHTML = "−";
        tokenDiv.appendChild(newRemoveBtn);
      }
    }
  }
}

// Event Listeners
document.getElementById("prices").addEventListener("click", function(e) {
  let removeBtn = e.target.closest(".remove-btn");
  if (removeBtn) {
    let token = removeBtn.getAttribute("data-token");
    removeToken(token);
  }
  let favBtn = e.target.closest(".favourite-btn");
  if (favBtn) {
    let token = favBtn.getAttribute("data-token");
    toggleFavourite(token);
  }
});

document.getElementById("addTokenBtn").addEventListener("click", addToken);
document.getElementById("clearNotificationsBtn").addEventListener("click", clearNotifications);
document.getElementById("notificationsIcon").addEventListener("click", function() {
  document.getElementById("notificationsBubble").style.display = "block";
});
document.getElementById("closeBubble").addEventListener("click", function() {
  document.getElementById("notificationsBubble").style.display = "none";
});

// Referral system
function generateRandomReferralCode() {
  const randomNumber = Math.floor(Math.random() * 10000000000000000); // Generates a 16-digit random number
  return `HP${randomNumber}`;
}

function loadReferral() {
  chrome.storage.local.get("referralCode", (result) => {
    if (result.referralCode) {
      document.getElementById("referralLink").value = "https://hyprice.xyz/?ref=" + result.referralCode;
    } else {
      let newCode = generateRandomReferralCode();
      chrome.storage.local.set({ "referralCode": newCode }, () => {
        document.getElementById("referralLink").value = "https://hyprice.xyz/?ref=" + newCode;
      });
    }
  });
}

function renewReferral() {
  let newCode = generateRandomReferralCode();
  chrome.storage.local.set({ "referralCode": newCode }, () => {
    document.getElementById("referralLink").value = "https://hyprice.xyz/?ref=" + newCode;
  });
}

document.getElementById("copyReferralBtn").addEventListener("click", function() {
  let referralLink = document.getElementById("referralLink").value;
  navigator.clipboard.writeText(referralLink).then(() => {
    let popupMessage = document.getElementById("popupMessage");
    popupMessage.textContent = "Copied.";
    popupMessage.style.display = "block";
    popupMessage.style.opacity = "1";
    // After 1 second, fade out the popup over 0.5s and then hide it
    setTimeout(() => {
      popupMessage.style.opacity = "0";
      setTimeout(() => {
        popupMessage.style.display = "none";
      }, 500);
    }, 1000);
  }, () => {
    console.error("Failed to copy referral link.");
  });
});

document.getElementById("renewReferralBtn").addEventListener("click", renewReferral);

// Draggable notifications bubble
function makeDraggable(draggableElement, handleElement) {
  let posX = 0, posY = 0, mouseX = 0, mouseY = 0;
  handleElement.addEventListener('mousedown', dragMouseDown);
  function dragMouseDown(e) {
    e.preventDefault();
    mouseX = e.clientX;
    mouseY = e.clientY;
    document.addEventListener('mousemove', elementDrag);
    document.addEventListener('mouseup', closeDragElement);
  }
  function elementDrag(e) {
    e.preventDefault();
    posX = mouseX - e.clientX;
    posY = mouseY - e.clientY;
    mouseX = e.clientX;
    mouseY = e.clientY;
    draggableElement.style.top = (draggableElement.offsetTop - posY) + "px";
    draggableElement.style.left = (draggableElement.offsetLeft - posX) + "px";
  }
  function closeDragElement() {
    document.removeEventListener('mousemove', elementDrag);
    document.removeEventListener('mouseup', closeDragElement);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  const bubble = document.getElementById("notificationsBubble");
  const header = document.getElementById("bubbleHeader");
  if (bubble && header) {
    makeDraggable(bubble, header);
  }
  loadReferral();
  fetchPrices();
  refreshTimer = setInterval(fetchPrices, refreshInterval);
});
