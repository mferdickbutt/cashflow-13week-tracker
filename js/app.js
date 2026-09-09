/**
 * Optional enhancement: confirm the baked table against a live recompute.
 * First paint does not depend on this file.
 */
(function () {
  function setStatus(text) {
    var el = document.getElementById("js-status");
    if (el) {
      el.textContent = text;
    }
  }

  if (typeof Cashflow === "undefined") {
    return;
  }

  fetch("data/cashflow.json")
    .then(function (res) {
      if (!res.ok) {
        throw new Error("HTTP " + res.status);
      }
      return res.json();
    })
    .then(function (model) {
      var forecast = Cashflow.computeForecast(model);
      var cells = document.querySelectorAll("#weekly-cashflow tbody tr");
      if (cells.length !== forecast.weeks.length) {
        setStatus("Live JSON loaded (" + forecast.weeks.length + " weeks). Baked table unchanged.");
        return;
      }
      var mismatch = 0;
      for (var i = 0; i < forecast.weeks.length; i++) {
        var row = cells[i];
        var netCell = row.querySelector(".weekly-net");
        var cashCell = row.querySelector(".running-cash");
        var net = netCell && netCell.getAttribute("data-value");
        var cash = cashCell && cashCell.getAttribute("data-value");
        if (net !== forecast.weeks[i].net.toFixed(2) || cash !== forecast.weeks[i].runningCash.toFixed(2)) {
          mismatch += 1;
          if (netCell) netCell.textContent = Cashflow.formatMoney(forecast.weeks[i].net);
          if (cashCell) cashCell.textContent = Cashflow.formatMoney(forecast.weeks[i].runningCash);
        }
      }
      if (mismatch) {
        setStatus("Browser recomputed " + mismatch + " cell(s) from live JSON.");
      } else {
        setStatus("Browser module loaded: baked weekly net and running cash match live JSON.");
      }
    })
    .catch(function () {
      setStatus("Browser module loaded. Using baked weekly table (JSON fetch skipped).");
    });
})();
