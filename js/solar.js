"use strict";

/*
 * love-timezone — solar + timezone helpers.
 *
 * Pure, dependency-free functions exposed on `window.MenaSolar`:
 *   - sunTimes(date, lat, lng)      -> { sunrise, solarNoon, sunset } (Date, UTC)
 *   - zonedParts(date, timeZone)    -> { year, month, day, hour, minute, second, weekday }
 *   - tzOffsetMinutes(date, zone)   -> minutes east of UTC at that instant
 *   - formatOffset(minutes)         -> "UTC+5", "UTC+3", "UTC+5:30", ...
 *
 * The sunrise/sunset math is a compact port of the well-known SunCalc
 * algorithm (NOAA-based), accurate to about a minute at these latitudes.
 */

(function (global) {
  var RAD = Math.PI / 180;
  var DAY_MS = 86400000;
  var J1970 = 2440588;
  var J2000 = 2451545;
  var OBLIQUITY = RAD * 23.4397;

  function toJulian(date) {
    return date.valueOf() / DAY_MS - 0.5 + J1970;
  }

  function fromJulian(j) {
    return new Date((j + 0.5 - J1970) * DAY_MS);
  }

  function toDays(date) {
    return toJulian(date) - J2000;
  }

  function solarMeanAnomaly(d) {
    return RAD * (357.5291 + 0.98560028 * d);
  }

  function eclipticLongitude(m) {
    var c = RAD * (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m));
    var p = RAD * 102.9372;
    return m + c + p + Math.PI;
  }

  function declination(l) {
    return Math.asin(Math.sin(OBLIQUITY) * Math.sin(l));
  }

  function julianCycle(d, lw) {
    return Math.round(d - 0.0009 - lw / (2 * Math.PI));
  }

  function approxTransit(ht, lw, n) {
    return 0.0009 + (ht + lw) / (2 * Math.PI) + n;
  }

  function solarTransitJ(ds, m, l) {
    return J2000 + ds + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * l);
  }

  function hourAngle(h, phi, dec) {
    return Math.acos(
      (Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec))
    );
  }

  function getSetJ(h, lw, phi, dec, n, m, l) {
    var w = hourAngle(h, phi, dec);
    var a = approxTransit(w, lw, n);
    return solarTransitJ(a, m, l);
  }

  function sunTimes(date, lat, lng) {
    var lw = RAD * -lng;
    var phi = RAD * lat;
    var d = toDays(date);
    var n = julianCycle(d, lw);
    var ds = approxTransit(0, lw, n);
    var m = solarMeanAnomaly(ds);
    var l = eclipticLongitude(m);
    var dec = declination(l);
    var jNoon = solarTransitJ(ds, m, l);
    var jSet = getSetJ(-0.833 * RAD, lw, phi, dec, n, m, l);
    var jRise = jNoon - (jSet - jNoon);
    if (!isFinite(jRise) || !isFinite(jSet)) {
      return null;
    }
    return {
      sunrise: fromJulian(jRise),
      solarNoon: fromJulian(jNoon),
      sunset: fromJulian(jSet)
    };
  }

  function zonedParts(date, timeZone) {
    var dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone,
      hourCycle: "h23",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    var out = {};
    var parts = dtf.formatToParts(date);
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].type !== "literal") {
        out[parts[i].type] = parts[i].value;
      }
    }
    var hour = parseInt(out.hour, 10);
    if (hour === 24) hour = 0;
    return {
      year: parseInt(out.year, 10),
      month: parseInt(out.month, 10),
      day: parseInt(out.day, 10),
      hour: hour,
      minute: parseInt(out.minute, 10),
      second: parseInt(out.second, 10),
      weekday: out.weekday
    };
  }

  function tzOffsetMinutes(date, timeZone) {
    var p = zonedParts(date, timeZone);
    var asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    var whole = Math.floor(date.valueOf() / 1000) * 1000;
    return Math.round((asUtc - whole) / 60000);
  }

  function formatOffset(minutes) {
    var sign = minutes < 0 ? "\u2212" : "+";
    var abs = Math.abs(minutes);
    var h = Math.floor(abs / 60);
    var m = abs % 60;
    return "UTC" + sign + h + (m ? ":" + String(m).padStart(2, "0") : "");
  }

  global.MenaSolar = {
    sunTimes: sunTimes,
    zonedParts: zonedParts,
    tzOffsetMinutes: tzOffsetMinutes,
    formatOffset: formatOffset
  };
})(typeof window !== "undefined" ? window : this);
