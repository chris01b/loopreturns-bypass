// ==UserScript==
// @name         loopreturns-bypass
// @namespace    https://github.com/chris01b/loopreturns-bypass
// @version      0.1
// @description  Bypass Loop Returns Workflows
// @author       @chris01b
// @match        https://*.loopreturns.com/*
// @match        https://returns.aviatornation.com/*
// @exclude      https://www.loopreturns.com/*
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const assetsUrl = "https://d1nnh0c8uc313v.cloudfront.net/customer-portal/assets/";
    const baseCodeUrl = assetsUrl + "index.";
    const baseLibraryUrl = assetsUrl + "vendor.";

    // Look for the original script tag in the document head
    // Handles cases where the original script may be dynamically added to the document head at an unpredictable time
    const observer = new MutationObserver(mutations => {
        for (let mutation of mutations) {
            for (let node of mutation.addedNodes) {
                if (node.nodeType === 1 && node.tagName === 'SCRIPT' && node.type === 'module' && node.src.startsWith(baseCodeUrl)) {
                    // Once the script is found and removed, stop the observer, and modify the code
                    observer.disconnect();
                    modifyScript(node.src);
                }
            }
        }
    });
    observer.observe(document.head, { childList: true });

    // Fetch the original script, modify it, and inject the modified script into the page
    async function modifyScript(originalScriptUrl) {
        // Fetch the original script
        const response = await fetch(originalScriptUrl);
        const originalScript = await response.text();

        // Define the regex patterns for the portions of the script to be replaced
        const importsUrl_regex = /\.\/vendor\.e9cd2c58\.js/g;
        const getLineItem_regex = /getLineItem\(e,t=\{\}\)\{const n=Ve\(\);return B\.get\(`api\/v1\/\$\{n\}\/order\/\$\{e\}\/line_item`,\{params:t\}\)\.then\(a=>a\.data\)\}/g;
        const findOrder_regex = /,t=await Pe\.lookup\(e\);/g;
        const diffPricedExchanges_regex = /differentPricedExchangesEnabled:e\.diff_priced_exchanges==="yes"/g;

        const newScript = originalScript
            // Replace relative path to library with absolute
            .replace(importsUrl_regex, document.querySelector(`link[href^="${baseLibraryUrl}"]`).href)
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
                // May make lineItem overrides unnecessary
                t.data.allowlisted = true;`);

        // Create a blob from the modified script and an object URL from the blob
        const blob = new Blob([newScript], {type: 'application/javascript; charset=UTF-8'});
        const url = URL.createObjectURL(blob);

        // Create a new script element using the object URL and inject it into the document head
        const script = document.createElement('script');
        script.type = 'module';
        script.src = url;
        document.head.appendChild(script);
    }
})();
