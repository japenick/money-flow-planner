# Money flow planner

## Scope
This is the standalone v4 app, separate from the older Data-runtime HTML builds in the parent work record. Keep the reusable planner generic and its default template free of personal data.

## Development
- Use dependency-free browser ES modules and the existing authored model and style system.
- Run `npm test` and `npm run build` after changes.
- Keep current behavior in README. Put proposed features in a separate future-work section.
- New visits must start fresh. Do not add persistent browser storage, a backend, analytics or network access for setups without an explicit request.
- Export/import must preserve complete account, income, CSP, rule and review definitions.
- Preserve money conservation, integer-cent calculations, monthly cap rollover and distinct overflow versus funding shortages.
- The repository is public by explicit user request. Keep source generic and do not publish surrounding workspace files or personal setups.
