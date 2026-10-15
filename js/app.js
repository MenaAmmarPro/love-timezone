"use strict";

/*
 * love-timezone — page logic.
 *
 * Two live clocks (Pakistan ⇄ Romania), today's sunrise/sunset in each city,
 * and a single-day timeline that marks the hours we are both awake.
 */

(function () {
  var SOLAR = window.MenaSolar;

  var CITIES = {
    you: { name: "Ammar", city: "Karachi, Pakistan", tz: "Asia/Karachi", lat: 24.8607, lng: 67.0011, wake: [8, 23] },
    her: { name: "Mena", city: "Bucharest, Romania", tz: "Europe/Bucharest", lat: 44.4268, lng: 26.1025, wake: [9, 22] }
  };

  var STORE_KEY = "mena-timezone-details";
  var MIN = 60000;
  var DAY = 86400000;

  var WEEKDAYS = {
    Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday",
    Fri: "Friday", Sat: "Saturday", Sun: "Sunday"
  };
  var MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  var PHASE_LABEL = { dawn: "Sunrise", day: "Daytime", dusk: "Sunset", night: "Night" };

  var state = {
    you: clone(CITIES.you),
    her: clone(CITIES.her)
  };

  var cells = [];
  var els = {};

  function clone(o) {
    return {
      name: o.name, city: o.city, tz: o.tz, lat: o.lat, lng: o.lng,
      wake: [o.wake[0], o.wake[1]]
    };
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function clampHour(value, lo, hi) {
    var v = parseInt(value, 10);
    if (!isFinite(v)) v = lo;
    return Math.max(lo, Math.min(hi, v));
  }

  /* ---------------- storage ---------------- */

  function loadDetails() {
    var raw = null;
    try { raw = localStorage.getItem(STORE_KEY); } catch (e) { return; }
    if (!raw) return;
    var saved;
    try { saved = JSON.parse(raw); } catch (e) { return; }
    if (!saved || typeof saved !== "object") return;
    ["you", "her"].forEach(function (key) {
      var s = saved[key];
      if (!s) return;
      if (typeof s.name === "string" && s.name.trim()) {
        state[key].name = s.name.trim().slice(0, 40);
      }
      if (Array.isArray(s.wake) && s.wake.length === 2) {
        var start = clampHour(s.wake[0], 0, 23);
        var end = clampHour(s.wake[1], 1, 24);
        state[key].wake = [start, Math.max(start + 1, end)];
      }
    });
  }

  function saveDetails() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        you: { name: state.you.name, wake: state.you.wake },
        her: { name: state.her.name, wake: state.her.wake }
      }));
    } catch (e) { /* storage unavailable — page still works */ }
  }

  /* ---------------- time / solar ---------------- */

  function timeLabel(ms, tz) {
    var p = SOLAR.zonedParts(new Date(ms), tz);
    return pad2(p.hour) + ":" + pad2(p.minute);
  }

  function dateLabel(p) {
    var day = WEEKDAYS[p.weekday] || "";
    return day + ", " + p.day + " " + MONTHS[p.month - 1];
  }

  function sunFor(person, now) {
    if (!SOLAR || typeof SOLAR.sunTimes !== "function") return null;
    var off = SOLAR.tzOffsetMinutes(now, person.tz);
    var p = SOLAR.zonedParts(now, person.tz);
    var localNoon = new Date(Date.UTC(p.year, p.month - 1, p.day, 12) - off * MIN);
    return SOLAR.sunTimes(localNoon, person.lat, person.lng);
  }

  function phaseFrom(sun, now) {
    if (!sun) return "night";
    var t = now.getTime();
    var rise = sun.sunrise.getTime();
    var set = sun.sunset.getTime();
    var band = 45 * MIN;
    if (t < rise - band) return "night";
    if (t < rise + band) return "dawn";
    if (t < set - band) return "day";
    if (t < set + band) return "dusk";
    return "night";
  }

  function awakeWindowUtc(now, person) {
    var off = SOLAR.tzOffsetMinutes(now, person.tz);
    var p = SOLAR.zonedParts(now, person.tz);
    var start = Date.UTC(p.year, p.month - 1, p.day, person.wake[0], 0, 0) - off * MIN;
    var end = Date.UTC(p.year, p.month - 1, p.day, person.wake[1], 0, 0) - off * MIN;
    return [start, end];
  }

  function overlapFor(now) {
    var a = awakeWindowUtc(now, state.you);
    var b = awakeWindowUtc(now, state.her);
    return { start: Math.max(a[0], b[0]), end: Math.min(a[1], b[1]) };
  }

  function nextOpen(now) {
    var t = now.getTime();
    var o = overlapFor(now);
    if (o.start < o.end && o.end > t) return o;
    for (var d = 1; d <= 2; d += 1) {
      var shifted = new Date(t + d * DAY);
      o = overlapFor(shifted);
      if (o.start < o.end) return o;
    }
    return null;
  }

  function humanDuration(mins) {
    if (mins <= 0) return "0 minutes";
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    if (h && m) return h + "h " + m + "m";
    if (h) return h + (h === 1 ? " hour" : " hours");
    return m + (m === 1 ? " minute" : " minutes");
  }

  /* ---------------- rendering ---------------- */

  function renderPerson(key, now) {
    var person = state[key];
    var p = SOLAR.zonedParts(now, person.tz);
    setText(key + "-name", person.name);
    setText(key + "-city", person.city);
    setText(key + "-hm", pad2(p.hour) + ":" + pad2(p.minute));
    setText(key + "-ss", pad2(p.second));
    setText(key + "-date", dateLabel(p));
    setText(key + "-offset", SOLAR.formatOffset(SOLAR.tzOffsetMinutes(now, person.tz)));

    var sun = sunFor(person, now);
    var phase;
    if (sun) {
      setText(key + "-sun",
        "Sunrise " + timeLabel(sun.sunrise.getTime(), person.tz) +
        " \u00b7 Sunset " + timeLabel(sun.sunset.getTime(), person.tz));
      phase = phaseFrom(sun, now);
    } else {
      setText(key + "-sun", "Sunrise \u2014 \u00b7 Sunset \u2014");
      phase = "night";
    }
    setText(key + "-phase", PHASE_LABEL[phase] || "\u2014");

    var card = byId("card-" + key);
    if (card) card.dataset.phase = phase;
    return sun;
  }

  function setText(id, value) {
    var el = byId(id);
    if (el) el.textContent = value;
  }

  function renderTogether(now) {
    var card = byId("call-card");
    var status = byId("call-status");
    var next = byId("call-next");
    if (!card || !status || !next) return;

    var t = now.getTime();
    var o = overlapFor(now);
    var open = o.start < o.end && t >= o.start && t < o.end;

    if (open) {
      card.dataset.state = "open";
      status.textContent = "You are both awake right now \u2014 call her \u2665";
      next.textContent = "About " + humanDuration(Math.round((o.end - t) / MIN)) +
        " left in this little window.";
      return;
    }

    card.dataset.state = "waiting";
    var no = nextOpen(now);
    if (no) {
      status.textContent = "Not both awake just yet.";
      next.textContent = "Next good time: " +
        timeLabel(no.start, state.you.tz) + " \u2013 " + timeLabel(no.end, state.you.tz) +
        " your time (" +
        timeLabel(no.start, state.her.tz) + " \u2013 " + timeLabel(no.end, state.her.tz) +
        " her time).";
    } else {
      status.textContent = "Our awake hours barely overlap right now.";
      next.textContent = "Try a small hello anyway \u2014 a message still counts.";
    }
  }

  function buildTimeline() {
    var tl = byId("timeline");
    if (!tl) return;
    tl.textContent = "";
    cells = [];
    for (var i = 0; i < 24; i += 1) {
      var cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.hour = String(i);
      tl.appendChild(cell);
      cells.push(cell);
    }
  }

  function renderTimeline(now) {
    if (!cells.length) return;
    var yp = SOLAR.zonedParts(now, state.you.tz);
    var youOff = SOLAR.tzOffsetMinutes(now, state.you.tz);
    var herOff = SOLAR.tzOffsetMinutes(now, state.her.tz);
    var youAwakeStart = state.you.wake[0];
    var youAwakeEnd = state.you.wake[1];
    var herAwakeStart = state.her.wake[0];
    var herAwakeEnd = state.her.wake[1];

    for (var i = 0; i < 24; i += 1) {
      var youAwake = i >= youAwakeStart && i < youAwakeEnd;
      var cellUtc = Date.UTC(yp.year, yp.month - 1, yp.day, i, 0, 0) - youOff * MIN;
      var herHour = SOLAR.zonedParts(new Date(cellUtc), state.her.tz).hour;
      var herAwake = herHour >= herAwakeStart && herHour < herAwakeEnd;

      var cls = "cell";
      if (youAwake && herAwake) cls += " is-awake";
      else if (youAwake || herAwake) cls += " is-her";
      else cls += " is-asleep";
      if (i === yp.hour) cls += " is-now";
      cells[i].className = cls;
    }

    void herOff;
    var note = byId("timeline-note");
    if (note) {
      note.textContent = "Hours 00\u201323 in " + state.you.city +
        ". The bright hours are when we are both awake.";
    }
  }

  /* ---------------- settings ---------------- */

  function fillSettings() {
    setValue("you-name-input", state.you.name);
    setValue("her-name-input", state.her.name);
    setValue("you-wake-start", state.you.wake[0]);
    setValue("you-wake-end", state.you.wake[1]);
    setValue("her-wake-start", state.her.wake[0]);
    setValue("her-wake-end", state.her.wake[1]);
  }

  function setValue(id, value) {
    var el = byId(id);
    if (el) el.value = String(value);
  }

  function readWake(startId, endId) {
    var start = clampHour(byId(startId) ? byId(startId).value : 0, 0, 23);
    var end = clampHour(byId(endId) ? byId(endId).value : 24, 1, 24);
    return [start, Math.max(start + 1, end)];
  }

  function wireSettings() {
    var save = byId("save-details");
    var reset = byId("reset-details");

    if (save) {
      save.addEventListener("click", function () {
        var youName = byId("you-name-input");
        var herName = byId("her-name-input");
        if (youName && youName.value.trim()) state.you.name = youName.value.trim().slice(0, 40);
        if (herName && herName.value.trim()) state.her.name = herName.value.trim().slice(0, 40);
        state.you.wake = readWake("you-wake-start", "you-wake-end");
        state.her.wake = readWake("her-wake-start", "her-wake-end");
        saveDetails();
        fillSettings();
        tick();
        note("Saved \u2014 just for the two of us \u2665");
      });
    }

    if (reset) {
      reset.addEventListener("click", function () {
        state.you = clone(CITIES.you);
        state.her = clone(CITIES.her);
        saveDetails();
        fillSettings();
        tick();
        note("Back to our defaults.");
      });
    }

    var share = byId("share-button");
    if (share) {
      share.addEventListener("click", function () {
        var url = window.location.href;
        if (navigator.share) {
          navigator.share({ title: document.title, url: url }).catch(function () {});
          return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () {
            note("Link copied \u2665");
          }).catch(function () {
            note(url);
          });
          return;
        }
        note(url);
      });
    }
  }

  function note(message) {
    var el = byId("save-note");
    if (el) el.textContent = message;
  }

  /* ---------------- boot ---------------- */

  function tick() {
    var now = new Date();
    renderPerson("you", now);
    renderPerson("her", now);
    renderTogether(now);
    renderTimeline(now);
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!SOLAR) return;
    loadDetails();
    buildTimeline();
    fillSettings();
    wireSettings();
    tick();
    window.setInterval(tick, 1000);

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("sw.js").catch(function () {});
      });
    }
  });
})();
