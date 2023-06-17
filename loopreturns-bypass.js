// ==UserScript==
// @name         loopreturns-bypass
// @namespace    https://github.com/chris01b/loopreturns-bypass
// @version      0.1
// @description  Bypass Loop Returns Workflows
// @author       @chris01b
// @match        https://returns.aviatornation.com/*
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const assetsUrl = "https://d1nnh0c8uc313v.cloudfront.net/customer-portal/assets/";
    const baseCodeUrl = assetsUrl + "index.";
    const baseLibraryUrl = assetsUrl + "vendor.";

    // Look for the original script tag in the document head
    const observer = new MutationObserver(mutations => {
        for (let mutation of mutations) {
            for (let node of mutation.addedNodes) {
                if (node.nodeType === 1 && node.tagName === 'SCRIPT' && node.type === 'module' && node.src.startsWith(baseCodeUrl)) {
                    // Remove the original script element from the DOM before it executes
                    node.remove();
                    // Once the script is found and removed, stop the observer
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
        const getWorkflowResults_regex = /oi=async function\(e,t\){const n=await B\.post\(`api\/v1\/\$\{e\}\/workflows\/evaluate`,t\);return n==null\?void 0:n\.data}/g;
        const getLineItem_regex = /getLineItem\(e,t=\{\}\)\{const n=Ve\(\);return B\.get\(`api\/v1\/\$\{n\}\/order\/\$\{e\}\/line_item`,\{params:t\}\)\.then\(a=>a\.data\)\}/g;
        const findOrder_regex = /,t=await Pe\.lookup\(e\);/g;

        const newScript = originalScript
            // Replace relative path to library with absolute
            .replace(importsUrl_regex, document.querySelector(`link[href^="${baseLibraryUrl}"]`).href)
            // Replace relative path to components with absolute
            .replace(/import\(\"\.\/([^"]+)\"\)/g, `import("${assetsUrl}$1")`)
            // Make the client think that the workflow is going to work no matter what
            .replace(getWorkflowResults_regex,
                `getWorkflowResults = async function (shopId, data) {
                    const response = await axios.post(
                        "api/v1/" + shopId + "/workflows/evaluate",
                        data,
                    );
                    if (response !== null && response !== void 0 && response.data) {
                        for (let obj of response.data) {
                            if (obj.value && typeof obj.value === "object") {
                                obj.value = {
                                    refund: false,
                                    exchange: false,
                                    storeCredit: false,
                                    inlineExchange: true,
                                    advancedExchange: true,
                                    instantExchange: false,
                                    shopNow: true,
                                };
                            }
                        }
                    }
                    return response === null || response === void 0 ? void 0 : response.data;
                }`)
            // Make the client think that returns, refunds, and exchanges are allowed
            .replace(getLineItem_regex,
                `getLineItem(e, t = {}) {
                    const n = Ve();
                    return B.get("api/v1/" + n + "/order/" + e + "/line_item", { params: t }).then(
                        (a) => {
                            let newData = { ...a.data };
                            newData.allowed = {
                                return: true,
                                refund: true,
                                exchange: true,
                                gift: newData.allowed.gift,
                                returned: newData.allowed.returned,
                                reason: "",
                            };
                            newData.excluded = {
                                advancedExchange: false,
                                inlineExchange: false,
                                shopNow: false,
                                instantExchange: false,
                                refund: false,
                                storeCredit: false,
                            };
                            newData.return_window_active = true;
                            newData.returns = [];
                            return newData;
                        }
                    );
                }`)
            // Make the client think that the order is eligible for a refund forever even if it is a gift too
            .replace(findOrder_regex,
                `;
                let t = await Pe.lookup(e);
                t.data.eligibility.gift = true;
                t.data.eligibility.refund = true;
                t.data.eligible = "No expiration";`);

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
