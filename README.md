# [Loop Returns](https://www.shopify.com/plus/partners/loop)
> Loop is a return management app that grows with 1,800+ Shopify brands, who see 30% less refunds and 50% more retained revenue on their returns.
> To improve your returns, we provide complete returns automation, new product exchanges, a customized portal, & more.
> We understand that every Shopify merchant is unique. Need automation? Want to lower your costs? What about making more revenue? Whatever your needs may be, Loop can help make your returns profitable.
> Get better returns today, with Loop.

[![Loop Returns Product Demo](https://cdn.loom.com/sessions/thumbnails/008c4c516812427ea52d255e7854c2b1-with-play.gif)](https://www.loom.com/embed/008c4c516812427ea52d255e7854c2b1?sid=f92d3423-17a0-4456-b2cb-9a26fb3ca06e)

> Loop Returns … has announced the close of a $65 million Series B financing round. The round was led by CRV, with participation from Shopify and Renegade Partners, as well as existing investors FirstMark Capital, Ridge Ventures, Peterson Ventures and Lerer Hippeau.
> The deal values the company at $340 million post-money.

## [Workflows](https://help.loopreturns.com/article/181-workflows)
> Workflows is a feature where merchants can create and manage return rules. Workflows are intended to accommodate scenarios that fall outside of a typical return policy. 

# Vulnerability
Initially, a significant vulnerability was identified where the Loop Returns system lacked server-side validation of return requests, potentially allowing clients to bypass workflow restrictions. This vulnerability has been responsibly disclosed and **has been addressed and fixed by the Loop Returns team**.

## Update on Vulnerability (Fixed)
Loop Returns acted promptly to rectify the vulnerability, reinforcing server-side validations to prevent any misuse of the workflow rules. Clients can no longer bypass the return restrictions set by the workflow rules, safeguarding the interests of Shopify merchants.

## Vulnerability Details
When a workflow prohibits returns based on its rules, the server instructs the client not to proceed with them. However, Loop Returns does not perform server-side validation for returns requested by the client. If the client behaves as though the workflow allows the return to proceed, the server will comply.

The vulnerability can be reproduced with the proof of concept code. It overrides certain responses server which allows the client to continue as if workflows permit all return options.

# Impact
- Bypass [Policy Rules](https://help.loopreturns.com/article/54-policy-rules)
  - Bypass restrictions on gifts
  - Return all items
    - Return items outside of return window
    - Return digital items / accessory charges
    - Refund all items
      - Refund all items to original payment method
      - Refund all items to in-store credit
    - Exchange all items
      - Allow [advanced exchanges](https://help.loopreturns.com/article/91-advanced-exchanges) if the product supports it
      - Allow different priced exchanges
      - Allow converting refunds to store credit with exchanges and shop now
      - Exchange gift card to a higher-priced option without any additional cost
- Return unfulfilled items

## Proof of concept code installation
1. Install [Tampermonkey](https://www.tampermonkey.net/) in your browser.
2. Paste [this code](https://github.com/chris01b/loopreturns-bypass/blob/main/loopreturns-bypass.js) into a new Tampermonkey userscript, save it, then enable it.
3. Navigate to any Loop Returns store portal (i.e. [returns.aviatornation.com](https://returns.aviatornation.com/)) to see the effects.

Note: This proof of concept code served as a demonstration tool during the vulnerability assessment and is no longer functional due to the implemented fixes.
