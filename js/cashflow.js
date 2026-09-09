/**
 * 13-week cashflow engine (browser + Node).
 *
 * Day / week conventions
 * ----------------------
 * - Each forecast week is a Monday–Sunday period (weekStartsOn = "monday").
 * - Dates are calendar dates stored as ISO 8601 YYYY-MM-DD with no time component.
 *   Arithmetic does not use JS Date, so local timezone cannot shift a week boundary.
 * - Week N is the Nth consecutive 7-day period starting at weekConvention.firstWeekStart.
 * - Inflows and outflows are attributed to the week in which they occur (not accrued daily).
 * - Running cash is the end-of-week cash position: starting cash plus the sum of weekly
 *   nets through that week.
 * - Amounts are USD rounded to the nearest cent (half-up via Math.round). Missing, null,
 *   non-numeric, NaN, and Infinity values are treated as 0 so results are always finite.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Cashflow = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var WEEK_STARTS_ON = "monday";

  var CONVENTIONS = {
    weekStartsOn: WEEK_STARTS_ON,
    dateFormat: "YYYY-MM-DD",
    timezoneNote:
      "Week bounds are calendar dates, not timestamps. Do not convert through Date#toISOString.",
    runningCashPoint: "end-of-week",
    currency: "USD",
    rounding: "nearest-cent-half-up",
  };

  function toMoney(value) {
    if (value === null || value === undefined || value === "") {
      return 0;
    }
    if (typeof value === "boolean") {
      return 0;
    }
    var n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) {
      return 0;
    }
    return Math.round(n * 100) / 100;
  }

  function isFiniteMoney(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function sumCategories(bag) {
    if (!bag || typeof bag !== "object" || Array.isArray(bag)) {
      return 0;
    }
    var total = 0;
    var keys = Object.keys(bag);
    for (var i = 0; i < keys.length; i++) {
      total = toMoney(total + toMoney(bag[keys[i]]));
    }
    return toMoney(total);
  }

  function weeklyNet(week) {
    if (!week || typeof week !== "object") {
      return 0;
    }
    return toMoney(sumCategories(week.inflows) - sumCategories(week.outflows));
  }

  function formatMoney(value) {
    var n = toMoney(value);
    var negative = n < 0;
    var abs = Math.abs(n).toFixed(2);
    var parts = abs.split(".");
    var whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (negative ? "-$" : "$") + whole + "." + parts[1];
  }

  function cloneBag(bag) {
    var out = {};
    if (!bag || typeof bag !== "object" || Array.isArray(bag)) {
      return out;
    }
    var keys = Object.keys(bag);
    for (var i = 0; i < keys.length; i++) {
      out[keys[i]] = toMoney(bag[keys[i]]);
    }
    return out;
  }

  /**
   * @param {object} model
   * @param {number} [model.startingCash]
   * @param {number} [model.cashThreshold]
   * @param {object[]} [model.weeks]
   * @returns {object} forecast with weekly net, running cash, min-cash week, below-threshold weeks
   */
  function computeForecast(model) {
    var startingCash = toMoney(model && model.startingCash);
    var cashThreshold = toMoney(model && model.cashThreshold);
    var rawWeeks = model && Array.isArray(model.weeks) ? model.weeks : [];

    var weeks = [];
    var i;
    for (i = 0; i < rawWeeks.length; i++) {
      var src = rawWeeks[i] && typeof rawWeeks[i] === "object" ? rawWeeks[i] : {};
      var inflow = sumCategories(src.inflows);
      var outflow = sumCategories(src.outflows);
      var net = toMoney(inflow - outflow);
      var weekNumber = src.week;
      if (!Number.isFinite(Number(weekNumber))) {
        weekNumber = i + 1;
      } else {
        weekNumber = Number(weekNumber);
      }
      weeks.push({
        index: i,
        week: weekNumber,
        label: src.label ? String(src.label) : "Week " + weekNumber,
        startDate: src.startDate ? String(src.startDate) : "",
        endDate: src.endDate ? String(src.endDate) : "",
        inflows: cloneBag(src.inflows),
        outflows: cloneBag(src.outflows),
        inflow: inflow,
        outflow: outflow,
        net: net,
        runningCash: 0,
        belowThreshold: false,
      });
    }

    var cash = startingCash;
    var minCash = startingCash;
    var minCashWeek = null;
    var below = [];
    var negativeNet = [];

    for (i = 0; i < weeks.length; i++) {
      cash = toMoney(cash + weeks[i].net);
      weeks[i].runningCash = cash;
      weeks[i].belowThreshold = cash < cashThreshold;
      if (weeks[i].belowThreshold) {
        below.push(weeks[i]);
      }
      if (weeks[i].net < 0) {
        negativeNet.push(weeks[i]);
      }
      if (minCashWeek === null || cash < minCash) {
        minCash = cash;
        minCashWeek = weeks[i];
      }
    }

    return {
      startingCash: startingCash,
      cashThreshold: cashThreshold,
      weeks: weeks,
      minCash: minCash,
      minCashWeek: minCashWeek,
      weeksBelowThreshold: below,
      negativeNetWeeks: negativeNet,
      endingCash: weeks.length ? weeks[weeks.length - 1].runningCash : startingCash,
      conventions: CONVENTIONS,
    };
  }

  function assertNoNonFinite(forecast) {
    var stack = [forecast];
    while (stack.length) {
      var cur = stack.pop();
      if (typeof cur === "number") {
        if (!Number.isFinite(cur)) {
          return false;
        }
      } else if (Array.isArray(cur)) {
        for (var i = 0; i < cur.length; i++) {
          stack.push(cur[i]);
        }
      } else if (cur && typeof cur === "object") {
        var keys = Object.keys(cur);
        for (var k = 0; k < keys.length; k++) {
          stack.push(cur[keys[k]]);
        }
      }
    }
    return true;
  }

  return {
    WEEK_STARTS_ON: WEEK_STARTS_ON,
    CONVENTIONS: CONVENTIONS,
    toMoney: toMoney,
    isFiniteMoney: isFiniteMoney,
    sumCategories: sumCategories,
    weeklyNet: weeklyNet,
    formatMoney: formatMoney,
    computeForecast: computeForecast,
    assertNoNonFinite: assertNoNonFinite,
  };
});
