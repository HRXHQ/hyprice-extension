async function checkAlerts() {
    let tokens = await chrome.storage.local.get("tokens");
    for (let token in tokens) {
        let apiUrl = `https://api.dexscreener.com/latest/dex/pairs/${tokens[token]}`;
        let response = await fetch(apiUrl);
        let data = await response.json();

        if (data && data.pairs.length > 0) {
            let currentPrice = parseFloat(data.pairs[0].priceUsd);
            chrome.storage.local.get([`last_price_${token}`], function(result) {
                let lastPrice = result[`last_price_${token}`];
                if (lastPrice && Math.abs((currentPrice - lastPrice) / lastPrice) * 100 >= 5) {
                    chrome.notifications.create({ title: "Hyprice Alert", message: `${token} moved 5%+!` });
                    chrome.storage.local.set({ [`last_price_${token}`]: currentPrice });
                }
            });
        }
    }
}

setInterval(checkAlerts, 30000);
