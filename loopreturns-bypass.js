// ==UserScript==
// @name         loopreturns-bypass
// @namespace    https://github.com/chris01b/loopreturns-bypass
// @version      1.0
// @description  Return everything without exception on Loop Returns for Shopify
// @author       @chris01b
// @match        https://*.loopreturns.com/*
// @match        https://returns.aviatornation.com/*
// @exclude      https://www.loopreturns.com/*
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const assetsUrl = "https://d1nnh0c8uc313v.cloudfront.net/customer-portal/assets/";

    // Look for the original code in the document head
    // Handles cases where the original script may be dynamically added to the document head at an unpredictable time
    const observer = new MutationObserver(async mutations => {
        for (let mutation of mutations) {
            for (let node of mutation.addedNodes) {
                if (node.nodeType === 1 && node.tagName === 'SCRIPT' && node.src.startsWith(assetsUrl + "index.")) {
                    // Once the script is found, stop the observer
                    observer.disconnect();
                    // Fetch the original code and modify it
                    const newCode = await modifyCode(node.src);
                    // Create the new script element and inject it into the document head
                    injectScript(newCode);
                }
            }
        }
    });
    observer.observe(document.head, { childList: true });

    async function modifyCode(codeUrl) {
        // Fetch the original code
        const response = await fetch(codeUrl);
        const originalCode = await response.text();

        // Define the regex patterns for the portions of the code to be replaced
        const importsUrl_regex = /\.\/vendor\.e9cd2c58\.js/g;
        const getLineItem_regex = /getLineItem\(e,t=\{\}\)\{const n=Ve\(\);return B\.get\(`api\/v1\/\$\{n\}\/order\/\$\{e\}\/line_item`,\{params:t\}\)\.then\(a=>a\.data\)\}/g;
        const findOrder_regex = /,t=await Pe\.lookup\(e\);/g;
        const diffPricedExchanges_regex = /differentPricedExchangesEnabled:e\.diff_priced_exchanges==="yes"/g;

        return originalCode
            // Replace relative path to library with absolute
            .replace(importsUrl_regex, document.querySelector(`link[href^="${assetsUrl + "vendor."}"]`).href)
            // Replace relative path to components with absolute
            .replace(/import\(\"\.\/([^"]+)\"\)/g, `import("${assetsUrl}$1")`)
            // Allow different priced exchanges
            .replace(diffPricedExchanges_regex, "differentPricedExchangesEnabled: true")
            // Make the client think that returns, refunds, and exchanges are allowed
            .replace(getLineItem_regex,
                `getLineItem(lineItemId, params = {}) {
                    const shopId = Ve();
                    return B.get("api/v1/" + shopId + "/order/" + lineItemId + "/line_item", { params }).then(
                        (res) => {
                            res.data.allowed = {
                                return: true,
                                refund: true,
                                exchange: true,
                                gift: true,
                                returned: res.data.allowed.returned,
                                reason: "",
                            };
                            res.data.excluded = {
                                advancedExchange: false,
                                inlineExchange: false,
                                shopNow: false,
                                instantExchange: false,
                                refund: false,
                                storeCredit: false,
                            };

                            // Always show return destination name for products
                            res.data.destinations.forEach(destination => {
                                destination.display_name_in_portal = true;
                            });
                            return res.data;
                        }
                    );
                }`)
            // Make the client think that the order is eligible for a refund forever even if it is a gift too
            .replace(findOrder_regex,
                `;
                let t = await Pe.lookup(e);
                // Override workflow exclusions
                // Override return window and type restrictions
                t.data.allowlisted = true;`);
    }

    function injectScript(code) {
        const script = document.createElement('script');
        script.type = 'module';
        // Browsers do not support the inline ES6 syntax of codeUrl so link the code as a Blob
        const blob = new Blob([code], {type: 'application/javascript; charset=UTF-8'});
        script.src = URL.createObjectURL(blob);

        document.head.appendChild(script);
    }
})();
