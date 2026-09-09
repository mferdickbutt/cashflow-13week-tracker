# cashflow-13week-tracker

Public 13-week cashflow tracker. **First paint is complete HTML**: the weekly table (week labels, inflow, outflow, weekly net, running cash) is baked into committed `index.html`. Static verifiers that `curl` GitHub Pages and do not run JavaScript still see real numbers.

## Schema (`data/cashflow.json`)

| Field | Type | Meaning |
| --- | --- | --- |
| `startingCash` | number | Cash on hand before week 1 |
| `cashThreshold` | number | Warning cutoff compared to **end-of-week** running cash |
| `currency` | string | ISO code; sample data is `USD` |
| `weekConvention.weekStartsOn` | string | Always `monday` |
| `weekConvention.firstWeekStart` | `YYYY-MM-DD` | Monday of week 1 |
| `weekConvention.runningCashPoint` | string | `end-of-week` |
| `inflowCategories` | string[] | Named inflow keys (sample: `collections`, `new_sales`, `other_income`) |
| `outflowCategories` | string[] | Named outflow keys (sample: `payroll`, `rent`, `tax`, `vendors`, `utilities`) |
| `weeks` | object[] | Exactly 13 weeks in the sample file |

Each week:

| Field | Type | Meaning |
| --- | --- | --- |
| `week` | number | 1–13 |
| `label` | string | Display label, e.g. `Week 4` |
| `startDate` / `endDate` | `YYYY-MM-DD` | Monday–Sunday inclusive |
| `inflows` | object | Category → amount |
| `outflows` | object | Category → amount |

Sample file: **13 weeks**, **3 inflow categories**, **5 outflow categories** (8 named categories). Starting cash `$85,000`. Threshold `$50,000`. Horizon `2026-01-05` through `2026-04-05`.

## Formulas (`js/cashflow.js`)

```
weekly_net(w)     = sum(inflows) − sum(outflows)
running_cash(1)   = startingCash + weekly_net(1)
running_cash(n)   = running_cash(n−1) + weekly_net(n)
min_cash_week     = first week with the lowest running_cash
below_threshold   = weeks where running_cash < cashThreshold
```

Missing, null, non-numeric, `NaN`, and `Infinity` amounts become `0`. Every returned number is finite. Ties for min-cash keep the **earliest** week.

### Day / week conventions

- Weeks are **Monday–Sunday** calendar ranges, stored as `YYYY-MM-DD` with no time component.
- The engine does not use `Date`, so local timezone cannot slide a week across midnight.
- Inflows and outflows are attributed to the week they occur in (not spread across days).
- Running cash is the position **after** that week’s net, not a mid-week average.
- Amounts are USD rounded to the nearest cent (`Math.round` on cents).

The same module loads in the browser (`Cashflow`) and in Node (`require("./js/cashflow.js")`).

## Re-render static HTML

After editing `data/cashflow.json` or the renderer:

```bash
node scripts/render-static.js
```

That reads JSON + `js/cashflow.js` and overwrites `index.html`. Commit the generated file so Pages first paint stays complete. Optional `js/app.js` may confirm figures in a browser; it is not required for the table.

```bash
bash scripts/test.sh
```

Expect `Summary: N passed, 0 failed` and exit `0`.

GitHub Pages: `.nojekyll` is in the repo root so the site is served as static files.

## Suggested next improvements

- Scenario columns (base / downside / upside) on the same 13-week grid
- CSV or bank-export import mapped onto the named categories
- Persist in-browser edits and re-bake via a small Node watch script
- Email or Slack alert when any projected week falls below the cash threshold
- Multi-entity rollup with intercompany eliminations
- Daily actuals vs weekly forecast variance after week close
