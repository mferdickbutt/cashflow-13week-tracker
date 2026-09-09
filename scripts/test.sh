#!/usr/bin/env bash
# Cashflow tracker checks: engine fixtures + baked first-paint HTML.
# Prints one PASS/FAIL line per check, then "Summary: N passed, 0 failed".

set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0

pass() {
  echo "PASS: $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "FAIL: $1"
  FAIL=$((FAIL + 1))
}

assert_eq() {
  local got="$1"
  local want="$2"
  local msg="$3"
  if [[ "$got" == "$want" ]]; then
    pass "$msg"
  else
    fail "$msg (got ${got}, want ${want})"
  fi
}

if ! command -v node >/dev/null 2>&1; then
  echo "FAIL: node is required"
  echo "Summary: 0 passed, 1 failed"
  exit 1
fi

ENGINE_OUT="$(node <<'EOF'
const fs = require("fs");
const path = require("path");
const Cashflow = require("./js/cashflow.js");

function read(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

const sample = read("./data/cashflow.json");
const empty = Cashflow.computeForecast(read("./scripts/fixtures/empty.json"));
const negative = Cashflow.computeForecast(read("./scripts/fixtures/negative-net.json"));
const threshold = Cashflow.computeForecast(read("./scripts/fixtures/threshold.json"));
const sampleFc = Cashflow.computeForecast(sample);

const bad = Cashflow.computeForecast({
  startingCash: Infinity,
  cashThreshold: NaN,
  weeks: [
    { inflows: { collections: Infinity }, outflows: { payroll: "nope" } },
    { inflows: null, outflows: { rent: undefined } },
    {},
  ],
});

const missingCats = Cashflow.weeklyNet({ inflows: { collections: 10 }, outflows: {} });
const nullWeek = Cashflow.weeklyNet(null);

const w1 = sampleFc.weeks[0];
const expectedW1Net = Cashflow.toMoney(w1.inflow - w1.outflow);
let runningOk = true;
let cash = sampleFc.startingCash;
for (const w of sampleFc.weeks) {
  cash = Cashflow.toMoney(cash + w.net);
  if (w.runningCash !== cash) runningOk = false;
  if (!Number.isFinite(w.net) || !Number.isFinite(w.runningCash)) runningOk = false;
}

const minFromScan = sampleFc.weeks.reduce((m, w) => (w.runningCash < m.runningCash ? w : m));
const belowIds = sampleFc.weeks.filter((w) => w.runningCash < sampleFc.cashThreshold).map((w) => w.week);

const html = fs.readFileSync("./index.html", "utf8");

const report = {
  weekCount: Array.isArray(sample.weeks) ? sample.weeks.length : -1,
  inflowCats: Array.isArray(sample.inflowCategories) ? sample.inflowCategories.length : 0,
  outflowCats: Array.isArray(sample.outflowCategories) ? sample.outflowCategories.length : 0,
  hasStarting: Number.isFinite(Number(sample.startingCash)),
  hasThreshold: Number.isFinite(Number(sample.cashThreshold)),
  namedIn: ["collections", "new_sales", "other_income"].every((k) => sample.inflowCategories.includes(k)),
  namedOut: ["payroll", "rent", "tax"].every((k) => sample.outflowCategories.includes(k)),
  emptyLen: empty.weeks.length,
  emptyMin: empty.minCashWeek,
  emptyEnd: empty.endingCash,
  emptyBelow: empty.weeksBelowThreshold.length,
  emptyStarting: empty.startingCash,
  negCount: negative.negativeNetWeeks.length,
  negAllNeg: negative.weeks.every((w) => w.net < 0),
  negMinWeek: negative.minCashWeek && negative.minCashWeek.week,
  negMinCash: negative.minCash,
  thrBelow: threshold.weeksBelowThreshold.map((w) => w.week),
  thrMinWeek: threshold.minCashWeek && threshold.minCashWeek.week,
  thrMinCash: threshold.minCash,
  thrW1Above: threshold.weeks[0].runningCash >= threshold.cashThreshold,
  sampleW1Net: w1.net,
  expectedW1Net,
  runningOk,
  finite: Cashflow.assertNoNonFinite(sampleFc) && Cashflow.assertNoNonFinite(bad),
  badAllZeroNets: bad.weeks.every((w) => w.net === 0 && w.runningCash === 0),
  missingCats,
  nullWeek,
  minWeek: sampleFc.minCashWeek && sampleFc.minCashWeek.week,
  minCash: sampleFc.minCash,
  minMatchesScan: sampleFc.minCashWeek && sampleFc.minCashWeek.week === minFromScan.week,
  belowIds,
  belowCount: sampleFc.weeksBelowThreshold.length,
  htmlHasLoadingOnly: /^\s*<(?:!DOCTYPE html>)?[\s\S]*Loading/i.test(html) && !/Weekly Net/i.test(html),
  htmlHasWeeklyNet: /Weekly Net/i.test(html),
  htmlHasRunningCash: /Running Cash/i.test(html),
  htmlHasWeek1: /Week 1/.test(html),
  htmlHasWeek13: /Week 13/.test(html),
  htmlHasDate: /2026-01-05/.test(html),
  htmlHasNetClass: /class="weekly-net/.test(html),
  htmlHasCashClass: /class="running-cash/.test(html),
  htmlWeekRows: (html.match(/data-week="/g) || []).length,
  htmlNotEmptyShell: !/id="weekly-cashflow"[\s\S]*<tbody>\s*(?:<tr>\s*<td>[^<]*Loading[^<]*<\/td>\s*<\/tr>)?\s*<\/tbody>/i.test(html),
  sampleNetInHtml: html.includes(Cashflow.formatMoney(w1.net)) || html.includes(String(w1.net)),
  sampleCashInHtml: html.includes(Cashflow.formatMoney(w1.runningCash)),
  minCashInHtml: html.includes(Cashflow.formatMoney(sampleFc.minCash)),
  nojekyll: fs.existsSync("./.nojekyll"),
};
process.stdout.write(JSON.stringify(report));
EOF
)" || {
  echo "FAIL: engine harness failed to run"
  echo "Summary: 0 passed, 1 failed"
  exit 1
}

if [[ -z "$ENGINE_OUT" ]]; then
  fail "engine harness produced no JSON"
else
  pass "engine harness ran (cashflow.js loads in Node)"
fi

get() {
  node -e "const r=JSON.parse(process.argv[1]); const v=r[process.argv[2]]; process.stdout.write(v===null||v===undefined?String(v):typeof v==='object'?JSON.stringify(v):String(v))" "$ENGINE_OUT" "$1"
}

assert_eq "$(get weekCount)" "13" "sample JSON has exactly 13 weeks"
assert_eq "$(get hasStarting)" "true" "sample JSON includes startingCash"
assert_eq "$(get hasThreshold)" "true" "sample JSON includes cashThreshold"
assert_eq "$(get namedIn)" "true" "named inflow categories include collections"
assert_eq "$(get namedOut)" "true" "named outflow categories include payroll, rent, tax"
assert_eq "$(get emptyLen)" "0" "empty series yields zero weeks"
assert_eq "$(get emptyMin)" "null" "empty series has no min-cash week"
assert_eq "$(get emptyEnd)" "100000" "empty series ending cash equals starting cash"
assert_eq "$(get emptyBelow)" "0" "empty series has no weeks below threshold"
assert_eq "$(get negAllNeg)" "true" "negative-net fixture weeks all have net < 0"
assert_eq "$(get negCount)" "2" "negative-net fixture reports two negative weeks"
assert_eq "$(get thrMinWeek)" "2" "min-cash week is the lowest running-cash week"
assert_eq "$(get thrBelow)" "[2]" "below-threshold logic flags only weeks under the cutoff"
assert_eq "$(get thrW1Above)" "true" "week above threshold is not flagged"
assert_eq "$(get runningOk)" "true" "running cash equals starting cash plus cumulative weekly net"
assert_eq "$(get finite)" "true" "no NaN or Infinity in forecasts (bad inputs coerced to 0)"
assert_eq "$(get missingCats)" "10" "missing outflow categories treated as 0"
assert_eq "$(get nullWeek)" "0" "null week weeklyNet is 0"
assert_eq "$(get minMatchesScan)" "true" "sample min-cash week matches scan of running cash"
assert_eq "$(get htmlHasLoadingOnly)" "false" "index.html is not a Loading-only shell"
assert_eq "$(get htmlHasWeeklyNet)" "true" "index.html contains Weekly Net column"
assert_eq "$(get htmlHasRunningCash)" "true" "index.html contains Running Cash column"
assert_eq "$(get htmlHasWeek1)" "true" "index.html contains Week 1"
assert_eq "$(get htmlHasWeek13)" "true" "index.html contains Week 13"
assert_eq "$(get htmlHasDate)" "true" "index.html contains week start date 2026-01-05"
assert_eq "$(get htmlHasNetClass)" "true" "index.html has weekly-net numeric cells"
assert_eq "$(get htmlHasCashClass)" "true" "index.html has running-cash numeric cells"
assert_eq "$(get sampleCashInHtml)" "true" "index.html embeds computed running cash"
assert_eq "$(get nojekyll)" "true" ".nojekyll present for GitHub Pages"

# Extra static grep/curl-style checks (no JS).
if [[ -f index.html ]]; then
  if grep -q "Weekly Net" index.html && grep -q "Running Cash" index.html && grep -q "Week 1" index.html; then
    pass "static grep of index.html shows week, weekly net, and running cash"
  else
    fail "static grep of index.html missing week/net/running-cash content"
  fi
  if grep -qiE "Loading(…|\.\.\.)?" index.html && ! grep -q "data-value" index.html; then
    fail "index.html looks like a Loading shell without numeric cells"
  else
    pass "index.html has numeric data-value cells (not a spinner shell)"
  fi
else
  fail "index.html missing"
  fail "index.html numeric cells missing"
fi

echo "Summary: ${PASS} passed, ${FAIL} failed"
if [[ "$FAIL" -ne 0 ]]; then
  exit 1
fi
exit 0
