#!/usr/bin/env node
/**
 * Bake the weekly cashflow table into index.html so first paint
 * (curl, GitHub Pages static verifiers) shows week labels, nets, and running cash
 * with no JavaScript required.
 *
 * Usage (from repo root): node scripts/render-static.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var Cashflow = require(path.join(root, "js", "cashflow.js"));

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function moneyCell(amount, extraClass) {
  var n = Cashflow.toMoney(amount);
  var cls = extraClass || "";
  if (n < 0) {
    cls = (cls + " neg").trim();
  } else if (n > 0 && extraClass === "weekly-net") {
    cls = (cls + " ok").trim();
  }
  return (
    '<td class="' +
    escapeHtml(cls) +
    '" data-value="' +
    n.toFixed(2) +
    '">' +
    escapeHtml(Cashflow.formatMoney(n)) +
    "</td>"
  );
}

function period(week) {
  if (week.startDate && week.endDate) {
    return week.startDate + " – " + week.endDate;
  }
  return week.startDate || week.endDate || "";
}

function buildHtml(model, forecast) {
  var weeks = forecast.weeks;
  var minWeekNum = forecast.minCashWeek ? forecast.minCashWeek.week : null;
  var belowLabels = forecast.weeksBelowThreshold
    .map(function (w) {
      return w.label;
    })
    .join(", ");

  var rows = weeks
    .map(function (w) {
      var classes = [];
      if (w.belowThreshold) classes.push("below");
      if (minWeekNum !== null && w.week === minWeekNum) classes.push("min-cash");
      return (
        "<tr class=\"" +
        classes.join(" ") +
        "\" data-week=\"" +
        escapeHtml(w.week) +
        "\">" +
        "<td>" +
        escapeHtml(w.label) +
        "</td>" +
        "<td>" +
        escapeHtml(period(w)) +
        "</td>" +
        moneyCell(w.inflow, "inflow") +
        moneyCell(w.outflow, "outflow") +
        moneyCell(w.net, "weekly-net") +
        moneyCell(w.runningCash, "running-cash") +
        "</tr>"
      );
    })
    .join("\n");

  var categoryRows = weeks
    .map(function (w) {
      return (
        "<tr data-week=\"" +
        escapeHtml(w.week) +
        "\">" +
        "<td>" +
        escapeHtml(w.label) +
        "</td>" +
        moneyCell(w.inflows.collections) +
        moneyCell(w.inflows.new_sales) +
        moneyCell(w.inflows.other_income) +
        moneyCell(w.outflows.payroll) +
        moneyCell(w.outflows.rent) +
        moneyCell(w.outflows.tax) +
        moneyCell(w.outflows.vendors) +
        moneyCell(w.outflows.utilities) +
        "</tr>"
      );
    })
    .join("\n");

  var minCashText = forecast.minCashWeek
    ? forecast.minCashWeek.label +
      " (" +
      Cashflow.formatMoney(forecast.minCash) +
      ")"
    : "n/a (empty series)";

  var title = model.title || "13-week cashflow tracker";
  var range =
    weeks.length && weeks[0].startDate && weeks[weeks.length - 1].endDate
      ? weeks[0].startDate + " through " + weeks[weeks.length - 1].endDate
      : "";

  return (
    "<!DOCTYPE html>\n" +
    '<html lang="en">\n' +
    "<head>\n" +
    '  <meta charset="utf-8">\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    "  <title>" +
    escapeHtml(title) +
    "</title>\n" +
    '  <link rel="stylesheet" href="css/styles.css">\n' +
    "</head>\n" +
    "<body>\n" +
    '  <main class="wrap">\n' +
    "    <header>\n" +
    "      <h1>" +
    escapeHtml(title) +
    "</h1>\n" +
    '      <p class="lede">Thirteen-week cash forecast with weekly net and running cash baked into first-paint HTML (no JavaScript required).</p>\n' +
    (range
      ? '      <p class="meta">Weeks start Monday. Horizon: ' +
        escapeHtml(range) +
        ". Cash threshold: " +
        escapeHtml(Cashflow.formatMoney(forecast.cashThreshold)) +
        ".</p>\n"
      : "") +
    "    </header>\n" +
    '    <ul class="kpis">\n' +
    "      <li><span class=\"label\">Starting cash</span><span class=\"value\">" +
    escapeHtml(Cashflow.formatMoney(forecast.startingCash)) +
    "</span></li>\n" +
    "      <li><span class=\"label\">Cash threshold</span><span class=\"value\">" +
    escapeHtml(Cashflow.formatMoney(forecast.cashThreshold)) +
    "</span></li>\n" +
    "      <li><span class=\"label\">Ending cash</span><span class=\"value\">" +
    escapeHtml(Cashflow.formatMoney(forecast.endingCash)) +
    "</span></li>\n" +
    "      <li><span class=\"label\">Min-cash week</span><span class=\"value\">" +
    escapeHtml(minCashText) +
    "</span></li>\n" +
    "      <li><span class=\"label\">Weeks below threshold</span><span class=\"value\">" +
    escapeHtml(String(forecast.weeksBelowThreshold.length)) +
    "</span></li>\n" +
    "    </ul>\n" +
    '    <div class="table-wrap">\n' +
    '      <table id="weekly-cashflow">\n' +
    "        <caption>Weekly net and running cash (13 weeks)</caption>\n" +
    "        <thead>\n" +
    "          <tr>\n" +
    "            <th scope=\"col\">Week</th>\n" +
    "            <th scope=\"col\">Period</th>\n" +
    "            <th scope=\"col\">Inflow</th>\n" +
    "            <th scope=\"col\">Outflow</th>\n" +
    "            <th scope=\"col\">Weekly Net</th>\n" +
    "            <th scope=\"col\">Running Cash</th>\n" +
    "          </tr>\n" +
    "        </thead>\n" +
    "        <tbody>\n" +
    rows +
    "\n        </tbody>\n" +
    "      </table>\n" +
    "    </div>\n" +
    '    <section class="insights">\n' +
    "      <h2>Insights</h2>\n" +
    "      <ul>\n" +
    "        <li>Min-cash week: " +
    escapeHtml(minCashText) +
    "</li>\n" +
    "        <li>Weeks below threshold (" +
    escapeHtml(Cashflow.formatMoney(forecast.cashThreshold)) +
    "): " +
    escapeHtml(belowLabels || "none") +
    "</li>\n" +
    "        <li>Negative weekly net weeks: " +
    escapeHtml(
      forecast.negativeNetWeeks
        .map(function (w) {
          return w.label;
        })
        .join(", ") || "none"
    ) +
    "</li>\n" +
    "      </ul>\n" +
    "    </section>\n" +
    '    <h2>Category detail</h2>\n' +
    '    <p class="note">Named inflows: collections, new_sales, other_income. Named outflows: payroll, rent, tax, vendors, utilities.</p>\n' +
    '    <div class="table-wrap">\n' +
    '      <table id="category-detail">\n' +
    "        <caption>Inflow and outflow categories by week</caption>\n" +
    "        <thead>\n" +
    "          <tr>\n" +
    "            <th scope=\"col\">Week</th>\n" +
    "            <th scope=\"col\">Collections</th>\n" +
    "            <th scope=\"col\">New sales</th>\n" +
    "            <th scope=\"col\">Other income</th>\n" +
    "            <th scope=\"col\">Payroll</th>\n" +
    "            <th scope=\"col\">Rent</th>\n" +
    "            <th scope=\"col\">Tax</th>\n" +
    "            <th scope=\"col\">Vendors</th>\n" +
    "            <th scope=\"col\">Utilities</th>\n" +
    "          </tr>\n" +
    "        </thead>\n" +
    "        <tbody>\n" +
    categoryRows +
    "\n        </tbody>\n" +
    "      </table>\n" +
    "    </div>\n" +
    "    <footer>\n" +
    "      <p>Formulas: weekly net = inflow − outflow; running cash = previous cash + weekly net (week 1 starts from starting cash). Re-render with <code>node scripts/render-static.js</code>.</p>\n" +
    "      <p id=\"js-status\">JavaScript is optional. This table is complete in the committed HTML.</p>\n" +
    "    </footer>\n" +
    "  </main>\n" +
    '  <script src="js/cashflow.js"></script>\n' +
    '  <script src="js/app.js"></script>\n' +
    "</body>\n" +
    "</html>\n"
  );
}

function main() {
  var dataPath = path.join(root, "data", "cashflow.json");
  var outPath = path.join(root, "index.html");
  var model = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  var forecast = Cashflow.computeForecast(model);
  if (!Cashflow.assertNoNonFinite(forecast)) {
    throw new Error("Forecast contained NaN or Infinity");
  }
  fs.writeFileSync(outPath, buildHtml(model, forecast), "utf8");
  process.stdout.write("Wrote " + outPath + " (" + forecast.weeks.length + " weeks)\n");
}

main();
