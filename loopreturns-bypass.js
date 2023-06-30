// ==UserScript==
// @name         loopreturns-bypass
// @namespace    https://github.com/chris01b/loopreturns-bypass
// @version      1.0
// @description  Return everything without exception on Loop Returns for Shopify
// @author       @chris01b
// @match        https://*.loopreturns.com/*
// @match        https://returns.aviatornation.com/*
// @match        https://returns.stussy.com/*
// @exclude      https://www.loopreturns.com/*
// @exclude      https://docs.loopreturns.com/*
// @exclude      https://help.loopreturns.com/*
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // After page load, check localStorage for 'init' and adjust page title and console logs
    window.addEventListener('load', function() {
        const init = JSON.parse(localStorage.getItem('init'));
        const feature = init?.feature_flags?.find(f => f.id === 'happy-returns-partial-return');
        const active = feature?.active;
        const enforce = init?.enforce_product_rules;

        console.log('happy-returns-partial-return:', !!active);
        console.log('enforce_product_rules:', !!enforce);

        if (active) {
            document.title = 'Happy! ' + document.title;
            new MutationObserver(mutations => {
                mutations.forEach(m => {
                    if (m.type === 'childList' && !document.title.startsWith('Happy! ')) {
                        document.title = 'Happy! ' + document.title;
                    }
                });
            }).observe(document.querySelector('title'), { childList: true });
        }
    });

    const assetsUrl = "https://d1nnh0c8uc313v.cloudfront.net/customer-portal/assets/";

    // Look for the original code in the document head
    // Handles cases where the original script may be dynamically added to the document head at an unpredictable time
    new MutationObserver(function(mutations) {
        for (let { addedNodes } of mutations) {
            const scriptNode = Array.from(addedNodes).find(
                node => node.nodeType === 1 && node.tagName === 'SCRIPT' && node.src.startsWith(assetsUrl + "index.")
            );
            if (scriptNode) {
                this.disconnect(); // Once the script is found, stop the observer
                modifyCode(scriptNode.src).then(injectScript); // Fetch, modify, and inject the script
            }
        }
    }).observe(document.head, { childList: true });

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
