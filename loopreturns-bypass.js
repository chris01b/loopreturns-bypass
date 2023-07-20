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

        const importsUrl = document.querySelector(`link[href^="${assetsUrl + "vendor."}"]`).href;

        // Define the regex patterns for the portions of the code to be replaced
        const assetsTempUrl_regex = /[^\/\.]{8}(?=\.js)/;
        const getLineItem_regex = /getLineItem\([\w\d]+,[\w\d]+=\{\}\)\{const [\w\d]+=([\w\d]+)\(\);return ([\w\d]+)\.get\(`api\/v1\/\$\{[\w\d]+\}\/order\/\$\{[\w\d]+\}\/line_item`,\{params:[\w\d]+\}\)\.then\([\w\d]+=>[\w\d]+\.data\)\}/i; 
        const findOrder_regex = /,([\w\d]+)=await ([\w\d]+)\.lookup\(([\w\d]+)\);/i;
        const diffPricedExchanges_regex = /differentPricedExchangesEnabled:e\.diff_priced_exchanges==="yes"/g;

        // 1st Capture Group: shopId
        // 2nd Capture Group: axios
        const getLineItem_matches = originalCode.match(getLineItem_regex);

        // 1st Capture Group: res
        // 2nd Capture Group: Order
        // 2nd Capture Group: payload
        const findOrder_matches = originalCode.match(findOrder_regex);

        return originalCode
            // Replace relative path to vendor library with absolute path
            .replace("./vendor." + importsUrl.match(assetsTempUrl_regex)[0] + ".js", importsUrl)
            // Replace relative path to components with absolute
            .replace(/import\(\"\.\/([^"]+)\"\)/g, `import("${assetsUrl}$1")`)
            // Allow different priced exchanges
            .replace(diffPricedExchanges_regex, "differentPricedExchangesEnabled: true")
            // Make the client think that returns, refunds, and exchanges are allowed
            .replace(getLineItem_regex,
                `getLineItem(lineItemId, params = {}) {
                    const shopId = ${getLineItem_matches[1]}();
                    return ${getLineItem_matches[2]}.get("api/v1/" + shopId + "/order/" + lineItemId + "/line_item", { params }).then(
                        (res) => {
                            res.data.allowed = {
                                return: true,
                                refund: true,
                                exchange: true,
                                gift: true,
                                shopNow: true,
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
                let ${findOrder_matches[1]} = await ${findOrder_matches[2]}.lookup(${findOrder_matches[3]});
                // Override workflow exclusions
                // Override return window and type restrictions
                ${findOrder_matches[1]}.data.allowlisted = true;`);
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
