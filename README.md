# Money flow planner

A static web app for household take-home income, a Conscious Spending Plan, conditional money flows, monthly projections and household reviews.

## Use it

1. Enter income streams in **Income**. Each amount is take-home pay per selected pay period, after payroll taxes and deductions.
2. Define receiving accounts, starting balances and cash buffers in **Accounts**.
3. Set four editable buckets in **Conscious spending plan**: fixed costs, investments, savings and guilt-free spending. Fixed costs may use monthly line items.
4. Define **Money flows** using a percentage, fixed amount or remaining CSP bucket allocation. Each flow has a source, destination, optional balance condition, monthly ceiling, balance target and overflow destination.
5. Inspect **Monthly projection**, then use **Monthly review** with actual records.
6. **Export setup** before leaving. **Load setup** restores exported v1, v2 or v3 JSON files. Older account-level income settings become explicit monthly income streams.

Every visit starts with a basic template, including returns through the back/forward cache. No setup is read from or written to browser persistent storage. Closing or reloading loses unexported edits. A leave-page warning is shown after edits where the browser supports it.

## Percentage bases

- **Total household take-home income:** sum of all active income streams' normalized monthly take-home pay.
- **Selected income stream:** one stream's normalized monthly amount.
- **Source incoming:** external income plus transfers received earlier in the rule list that month.
- **Cash above buffer:** current simulated source balance minus its protected minimum.

Weekly income uses 52 pay periods, every two weeks 26, twice monthly 24, monthly 12 and yearly 1, divided by 12. These are planning averages, not a calendar of actual deposit dates. Payroll investments already withheld are not added as spendable income or counted twice.

## CSP integration

The four budget buckets can use income percentages or fixed amounts; fixed costs can instead sum monthly line items. The default 55 / 10 / 10 / 25 split is editable.

A **CSP bucket remainder** flow requests the planned bucket amount minus amounts already classified in that bucket by preceding flows in that month. Classify final allocations only. Intermediate transfers should remain unclassified; the app cannot infer whether a routing leg represents consumption. Routed classifications are planned transfers, not transaction-verified spending.

Framework reference: [Ramit Sethi's Conscious Spending Basics](https://www.iwillteachyoutoberich.com/conscious-spending-basics/). This tool is independent and is not affiliated with Ramit Sethi.

## Ceilings and conditions

Rules run once each calendar month in listed order. Source cash and buffers always constrain transfers. The monthly contribution cap resets monthly; the destination balance target carries forward. When both apply, the smaller remaining allowance wins. The capped, affordable portion can go to the overflow account. A funding shortage is reported separately and is not overflow.

The **Already sent** field reduces first-month contribution-cap headroom only and does not add funds to opening balances again. Caps are per rule, not shared automatically across rules targeting the same account. Debt destinations cannot be overpaid. Investment accounts are destination only.

For multiple hops, put funding rules first. Conditions see balances after monthly income and previous rules. The simulator adds no returns, interest, taxes, market changes, new card charges or unlisted spending.

## Develop and verify

Node 20+; no dependencies or installation step.

```sh
npm test
npm run build
npm start
```

The preview server binds only to 127.0.0.1:4173 and serves `dist/`. The build copies only five allowlisted application assets. No data from the surrounding workspace enters the deployment.

- `src/model.mjs`: current v3 income, budget, validation and simulation model.
- `src/legacy.mjs`: isolated older plan parsing and migration support.
- `src/app.mjs`: browser state and interactive views.
- `styles.css`: responsive, keyboard-visible light/dark UI using local assets.
- `tests/`: model and non-browser UI smoke tests.
- `.github/workflows/pages.yml`: tests, static build and Pages deployment.

## GitHub deployment

The source repository is [japenick/money-flow-planner](https://github.com/japenick/money-flow-planner) and is public by the owner's request. Do not upload the parent AI OS folder or any older personal finance snapshots.

The workflow targets the `main` branch. Enable **Settings > Pages > Build and deployment > Source: GitHub Actions**. A push runs tests, builds the static files and deploys the resulting artifact to Pages. A pull request runs checks without deploying.

The owner chose public source to use free GitHub Pages hosting. Only the generic template and application code belong in this repository. Visitor setups remain in memory until explicitly exported and are never sent to GitHub.

GitHub documentation: [custom Pages workflows and plan availability](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Privacy and limitations

No bank credentials, financial accounts, personal balances, analytics, external scripts or backend are included. The app makes no network calls for setup data. Exported JSON contains whatever the user entered, including account labels, hypothetical balances and meeting notes.

No live bank access, transfers, trades, financial/tax advice, automatic sync or server-side account storage. Currency labels are supported, but currency conversion is not.
