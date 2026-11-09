(function () {
  var base = window.WEDDING;
  var root = document.getElementById("invitation");
  var SCENE_IDS = ["opening", "couple", "celebration", "place", "closing"];
  var reduce =
    document.documentElement.classList.contains("reduce-motion") ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var preview = false;
  try {
    preview = new URLSearchParams(window.location.search).get("preview") === "draft";
  } catch (error) {
    preview = false;
  }

  if (!base || !root) {
    if (root) root.textContent = "The invitation could not be read. Check content.js.";
    return;
  }

  var keptOpen = false;

  function boot() {
    paint(currentWedding(), false);
  }

  function paint(wedding, keepOpen) {
    keptOpen = keepOpen || document.documentElement.classList.contains("is-open");
    document.title = wedding.partnerOne + " & " + wedding.partnerTwo;
    var description = document.querySelector('meta[name="description"]');
    if (description) {
      description.setAttribute(
        "content",
        "You are invited to the wedding of " + wedding.partnerOne + " and " + wedding.partnerTwo + "."
      );
    }
    root.innerHTML = renderCard(wedding);
    applyType(wedding);
    startCountdown(wedding);
    shieldNames();
    bindMusic(wedding, root);
    bindContinue(root);
    bindDock(root);
    bindContact(root);
    bindEnvelope(wedding);
    scheduleNav();
    bindRsvp(wedding, root);
    bindGuestbook(root);
    bindPhotos(root, wedding);
    bindMotion();
    if (reduce || keptOpen) document.documentElement.classList.add("is-open");
    if (reduce) document.documentElement.classList.remove("will-open");
  }

  window.addEventListener("message", function (event) {
    if (!preview || event.origin !== window.location.origin) return;
    if (!event.data || event.data.type !== "wedding-preview") return;
    paint(mergeWedding(base, event.data.payload), true);
  });

  boot();
  window.addEventListener("resize", shieldNames);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(shieldNames);
  }

  function currentWedding() {
    var extra = preview ? readStore("wedding-card-draft") : readStore("wedding-card-published");
    if (!preview && !extra) extra = readStore("wedding-card-edits");
    return mergeWedding(base, extra);
  }

  function sectionPetals(sceneId) {
    if (reduce || sceneId === "opening") return "";
    var columns = [8, 16, 24, 78, 86, 94, 12, 88];
    var html = '<div class="scene-petals" aria-hidden="true">';
    var i;
    for (i = 0; i < columns.length; i += 1) {
      var dur = 20 + ((i * 3 + sceneId.length) % 5) * 2;
      var delay = -((i * 3.2 + sceneId.length * 1.3) % 20);
      var flutter = 3.2 + (i % 4) * 0.5;
      var flutterDelay = -((i * 0.8) % 3.5);
      var turn = (i % 2 === 0 ? -24 : 16) + (i % 4) * 8;
      var drift = (i % 2 === 0 ? 1 : -1) * (12 + (i % 4) * 6);
      var soft = i % 2 === 1 ? " scene-petal-small" : "";
      html += '<span class="scene-petal' + soft + '" style="left:' + columns[i] +
        "%;--dur:" + dur.toFixed(1) + "s;animation-delay:" + delay.toFixed(1) +
        "s;--flutter:" + flutter.toFixed(1) + "s;--turn:" + turn +
        "deg;--drift:" + drift + 'px">' +
        '<span class="scene-petal-inner" style="animation-delay:' + flutterDelay.toFixed(1) +
        's"></span></span>';
    }
    return html + "</div>";
  }

  function shieldNames() {
    var section = document.getElementById("couple");
    var layer = section && section.querySelector(".scene-petals");
    if (!layer) return;
    var host = layer.getBoundingClientRect();
    if (!host.width || !host.height) return;
    var holes = "";
    Array.prototype.forEach.call(section.querySelectorAll(".script-name"), function (name) {
      var range = document.createRange();
      range.selectNodeContents(name);
      var ink = range.getBoundingClientRect();
      range.detach();
      if (!ink.width || !ink.height) return;
      var x = Math.max(0, ink.left - host.left - 18);
      var y = Math.max(0, ink.top - host.top - 14);
      var w = Math.min(host.width - x, ink.width + 36);
      var h = Math.min(host.height - y, ink.height + 28);
      holes += " M" + x.toFixed(1) + " " + y.toFixed(1) + " h" + w.toFixed(1) + " v" + h.toFixed(1) + " h" + (-w).toFixed(1) + " Z";
    });
    var path = "M0 0 H" + host.width.toFixed(1) + " V" + host.height.toFixed(1) + " H0 Z" + holes;
    layer.style.clipPath = 'path(evenodd, "' + path + '")';
  }

  function renderCard(wedding) {
    var scenes = normalizeOrder(wedding.sceneOrder).map(function (id) {
      return renderScene(id, wedding);
    }).join("");
    return (
      renderEnvelope(wedding) +
      '<div class="music-slot" id="music-slot"></div>' +
      scenes +
      '<nav class="dock" aria-label="Invitation">' +
      sectionLinks(wedding, true) +
      "</nav>" +
      contactSheet(wedding)
    );
  }

  function renderEnvelope(wedding) {
    return (
      '<div class="stage" id="envelope-stage" role="button" tabindex="0" aria-label="Tekan untuk buka">' +
      '<div class="gate-scene">' +
      '<div class="door door-top"><div class="door-inner"></div></div>' +
      '<div class="door door-bottom"><div class="door-inner"></div></div>' +
      '<div class="seam" aria-hidden="true"></div>' +
      '<div class="seal-wrap">' +
      '<span class="seal" aria-hidden="true">' +
      '<span class="seal-ring"></span>' +
      '<img class="seal-logo" src="as-logo-seal.png" alt="" width="80" height="80">' +
      "</span>" +
      '<p class="open-hint">Tekan untuk buka</p>' +
      "</div>" +
      '<div class="butterfly-field" id="butterfly-field" aria-hidden="true"></div>' +
      "</div></div>"
    );
  }

  function renderScene(id, wedding) {
    if (id === "opening") return renderOpening(wedding);
    if (id === "couple") return renderCouple(wedding);
    if (id === "celebration") return renderCelebration(wedding);
    if (id === "place") return renderPlace(wedding);
    if (id === "closing") return renderGuestbook(wedding) + renderClosing(wedding);
    return "";
  }

  function renderOpening(wedding) {
    var date = wedding.date;
    return (
      '<section class="scene scene-opening" id="opening">' +
      corners("opening") +
      '<div class="opening-zoom">' +
      '<div class="scene-copy opening-copy">' +
      monogramMark(wedding, "opening-line t-mono") +
      '<p class="kicker opening-line t-kicker" data-field="opening.kicker">' + esc(wedding.opening.kicker) + "</p>" +
      '<h1 class="opening-line t-name">' +
      '<span class="script-name" data-field="partnerOne">' + letters(wedding.partnerOne, 2.25) + "</span>" +
      '<span class="script-amp letter" style="animation-delay:2.25s" aria-hidden="true">&amp;</span>' +
      '<span class="sr-only"> and </span>' +
      '<span class="script-name" data-field="partnerTwo">' + letters(wedding.partnerTwo, 2.25) + "</span></h1>" +
      '<div class="date-block opening-line t-date">' +
      '<p class="weekday" data-field="date.weekday">' + esc(date.weekday) + "</p>" +
      '<p class="cover-date"><span data-field="date.day">' + esc(date.day) + "</span>.<span data-field=\"date.month\">" + esc(monthNumber(date.month) || date.month) + "</span>.<span data-field=\"date.year\">" + esc(date.year) + "</span></p>" +
      '<p class="clock" data-field="date.time">' + esc(date.time) + "</p></div>" +
      coverVerse(wedding) +
      '<button class="button continue" type="button" id="continue" data-field="opening.continueLabel">' + esc(wedding.opening.continueLabel) + "</button>" +
      "</div></div></section>"
    );
  }

  function renderCouple(wedding) {
    return (
      '<section class="scene scene-couple" id="couple">' +
      corners("couple") +
      sectionPetals("couple") +
      '<div class="scene-copy">' +
      '<p class="kicker line" data-field="couple.kicker">' + esc(wedding.couple.kicker) + "</p>" +
      '<h2 class="script-name line" data-field="partnerOne">' + esc(wedding.partnerOne) + "</h2>" +
      '<p class="person-line line" data-field="couple.oneLine">' + esc(wedding.couple.oneLine) + "</p>" +
      '<p class="script-amp line" aria-hidden="true">&amp;</p>' +
      '<h2 class="script-name line" data-field="partnerTwo">' + esc(wedding.partnerTwo) + "</h2>" +
      '<p class="person-line line" data-field="couple.twoLine">' + esc(wedding.couple.twoLine) + "</p>" +
      sampleLine(wedding.couple.note, "couple.note") +
      "</div></section>"
    );
  }

  function renderCelebration(wedding) {
    var item = wedding.celebration;
    var dateLine = item.dateLine || (
      wedding.date.weekday + " " + wedding.date.day + " " + wedding.date.month + " " +
      wedding.date.year + " · " + wedding.date.time
    );
    return (
      '<section class="scene scene-celebration section" id="celebration">' +
      corners("celebration") +
      sectionPetals("celebration") +
      '<div class="scene-copy">' +
      '<h2 class="line" data-field="celebration.heading">' + esc(item.heading) + "</h2>" +
      '<p class="section-sub line" data-field="celebration.dateLine">' + esc(dateLine) + "</p>" +
      '<div class="stack">' + detailBlock(item.ceremony, "celebration.ceremony") + detailBlock(item.reception, "celebration.reception") + "</div>" +
      '<p class="attire line"><span data-field="celebration.attire.label">' + esc(item.attire.label) + "</span> <span data-field=\"celebration.attire.text\">" + esc(item.attire.text) + "</span></p>" +
      sampleLine(item.note, "celebration.note") +
      "</div></section>"
    );
  }

  function renderPlace(wedding) {
    var venue = wedding.venue;
    var place = wedding.place;
    var map = safeUrl(venue.mapUrl);
    var waze = safeUrl(place.wazeUrl);
    var links = "";
    if (map) {
      links += '<a class="text-link" data-field="venue.mapLabel" href="' + esc(map) + '" target="_blank" rel="noopener noreferrer">' +
        esc(venue.mapLabel) + '<span class="sr-only"> (opens in a new tab)</span></a>';
    }
    if (waze) {
      links += '<a class="text-link" data-field="place.wazeLabel" href="' + esc(waze) + '" target="_blank" rel="noopener noreferrer">' +
        esc(place.wazeLabel) + '<span class="sr-only"> (opens in a new tab)</span></a>';
    }
    var timeline = (place.timeline || []).map(function (item, index) {
      return (
        "<li><p class=\"timeline-time\" data-field=\"timeline." + index + ".time\">" + esc(item.time) + "</p>" +
        "<p class=\"timeline-title\" data-field=\"timeline." + index + ".title\">" + esc(item.title) + "</p>" +
        "<p class=\"timeline-detail\" data-field=\"timeline." + index + ".detail\">" + esc(item.detail) + "</p></li>"
      );
    }).join("");
    return (
      '<section class="scene scene-place section" id="place">' +
      corners("place") +
      sectionPetals("place") +
      '<div class="scene-copy">' +
      '<h2 class="line" data-field="place.heading">' + esc(place.heading) + "</h2>" +
      '<p class="place-script line" data-field="venue.name">' + esc(venue.name) + "</p>" +
      '<p class="place-street line" data-field="venue.street">' + esc(venue.street) + "</p>" +
      sampleLine(place.note, "place.note") +
      '<p class="place-links line">' + links + "</p>" +
      countdownBlock(wedding) +
      '<ol class="timeline line">' + timeline + "</ol>" +
      '<div class="photo-frame" id="photo-frame"></div>' +
      '<p class="photo-placeholder" id="photo-placeholder" data-field="place.photoPlaceholder">' + esc(place.photoPlaceholder) + "</p>" +
      "</div></section>"
    );
  }

  function renderReply(wedding) {
    var rsvp = wedding.rsvp;
    return (
      '<section class="scene scene-reply section" id="reply">' +
      corners("reply") +
      sectionPetals("reply") +
      '<div class="scene-copy">' +
      '<h2 class="line" data-field="rsvp.heading">' + esc(rsvp.heading) + "</h2>" +
      '<p class="section-sub line" data-field="rsvp.intro">' + esc(rsvp.intro) + "</p>" +
      sampleLine(rsvp.note, "rsvp.note") +
      '<form id="rsvp-form" novalidate>' +
      '<p class="form-error" id="rsvp-error" role="alert" hidden></p>' +
      '<label class="field"><span>' + esc(rsvp.nameLabel) + "</span>" +
      '<input id="guest-name" name="name" type="text" autocomplete="name" maxlength="80" required placeholder="' +
      esc(rsvp.namePlaceholder) + '"></label>' +
      "<fieldset><legend>" + esc(rsvp.attendanceLabel) + "</legend>" +
      '<div class="choices">' +
      '<label class="choice"><input type="radio" name="attendance" value="yes"><span>' + esc(rsvp.acceptLabel) + "</span></label>" +
      '<label class="choice"><input type="radio" name="attendance" value="no"><span>' + esc(rsvp.declineLabel) + "</span></label>" +
      "</div></fieldset>" +
      '<label class="field"><span>' + esc(rsvp.noteLabel) + "</span>" +
      '<textarea id="guest-note" name="note" maxlength="500" placeholder="' + esc(rsvp.notePlaceholder) + '"></textarea></label>' +
      '<button class="button" type="submit">' + esc(rsvp.submitLabel) + "</button>" +
      '<p class="local-note">' + esc(rsvp.localNote) + "</p></form>" +
      '<div class="confirm" id="rsvp-confirm" hidden>' +
      '<p class="confirm-kicker">' + esc(rsvp.confirmedKicker) + "</p>" +
      '<p class="confirm-message" id="rsvp-message" tabindex="-1" role="status"></p>' +
      '<p class="echo" id="rsvp-echo" hidden></p>' +
      '<button class="text-button" id="rsvp-edit" type="button">' + esc(rsvp.editLabel) + "</button></div>" +
      "</div></section>"
    );
  }

  function renderGuestbook(wedding) {
    var book = wedding.guestbook;
    return (
      '<section class="scene scene-wishes section" id="wishes">' +
      corners("wishes") +
      sectionPetals("wishes") +
      '<div class="scene-copy">' +
      '<h2 class="line" data-field="guestbook.heading">' + esc(book.heading) + "</h2>" +
      '<p class="section-sub line" data-field="guestbook.intro">' + esc(book.intro) + "</p>" +
      '<form id="guestbook-form" novalidate>' +
      '<p class="form-error" id="book-error" role="alert" hidden></p>' +
      '<label class="field"><span>' + esc(book.nameLabel) + "</span>" +
      '<input name="name" type="text" maxlength="80" autocomplete="name" placeholder="' + esc(book.namePlaceholder) + '"></label>' +
      "<fieldset><legend>" + esc(book.attendanceLabel || "Will you attend?") + "</legend>" +
      '<div class="choices">' +
      '<label class="choice"><input type="radio" name="attendance" value="yes"><span>' +
      esc(book.acceptLabel || "Joyfully accepts") + "</span></label>" +
      '<label class="choice"><input type="radio" name="attendance" value="no"><span>' +
      esc(book.declineLabel || "Regretfully declines") + "</span></label>" +
      "</div></fieldset>" +
      '<label class="field"><span>' + esc(book.messageLabel) + "</span>" +
      '<textarea name="message" maxlength="400" placeholder="' + esc(book.messagePlaceholder) + '"></textarea></label>' +
      '<button class="button" type="submit">' + esc(book.submitLabel) + "</button></form>" +
      '<div class="wishes" id="wish-list" aria-live="polite"></div>' +
      "</div></section>"
    );
  }

  function renderClosing(wedding) {
    var item = wedding.closing;
    return (
      '<section class="scene scene-closing" id="closing">' +
      corners("closing") +
      sectionPetals("closing") +
      '<div class="scene-copy">' +
      monogramMark(wedding, "line") +
      '<p class="welcome-line line" data-field="closing.thankYou">' + esc(item.thankYou) + "</p>" +
      '<blockquote class="quotation line">' +
      '<p class="sample-label" data-field="closing.prayerLabel">' + esc(item.prayerLabel) + "</p>" +
      '<p data-field="closing.prayer">' + esc(item.prayer) + "</p></blockquote>" +
      '<p class="closing-sign line" data-field="closing.closing">' + esc(item.closing) + "</p>" +
      sampleLine(item.note, "closing.note") +
      '<p class="signature line">' + esc(firstName(wedding.partnerOne) + " & " + firstName(wedding.partnerTwo)) + "</p>" +
      "</div></section>"
    );
  }

  function sampleLine(text, field) {
    if (!text) return "";
    return '<p class="sample-note line" data-field="' + esc(field) + '">' + esc(text) + "</p>";
  }

  function detailBlock(item, field) {
    return (
      '<article class="detail line"><h3 data-field="' + field + '.label">' + esc(item.label) + "</h3>" +
      '<p class="detail-time" data-field="' + field + '.time">' + esc(item.time) + "</p>" +
      '<p class="detail-place" data-field="' + field + '.place">' + esc(item.place) + "</p>" +
      '<p class="detail-copy" data-field="' + field + '.detail">' + esc(item.detail) + "</p></article>"
    );
  }

  function sectionLinks(wedding, withIcons) {
    var nav = wedding.nav || {};
    return (
      linkItem("#contact", nav.contact || "Contact", "contact", withIcons) +
      linkItem("#place", nav.location || "Location", "place", withIcons) +
      linkItem("#wishes", nav.wishes || "Wishes", "wish", withIcons)
    );
  }

  function linkItem(href, label, icon, withIcons, title) {
    var tip = title ? ' title="' + esc(title) + '"' : "";
    var field = icon === "contact" ? "nav.contact" : icon === "place" ? "nav.location" : icon === "rsvp" ? "nav.rsvp" : "nav.wishes";
    return '<a href="' + href + '"' + tip + ">" + (withIcons ? dockIcon(icon) : "") + '<span data-field="' + field + '">' + esc(label) + "</span></a>";
  }

  function countdownBlock(wedding) {
    var label = (wedding.countdown && wedding.countdown.label) || "Ketibaan Pengantin";
    var arrival = (wedding.countdown && wedding.countdown.arrival) || (wedding.date && wedding.date.time) || "";
    var done = (wedding.countdown && wedding.countdown.done) || "Alhamdulillah, hari bahagia telah tiba.";
    return (
      '<div class="countdown line">' +
      '<p class="countdown-heading" data-field="countdown.label">' + esc(label) + "</p>" +
      (arrival ? '<p class="countdown-arrival" data-field="date.time">' + esc(arrival) + "</p>" : "") +
      '<div class="countdown-grid" id="countdown-figures" aria-live="polite">' +
      '<div class="cd-col"><span class="cd-num" data-cd="days">00</span><span class="cd-lab">Hari</span></div>' +
      '<div class="cd-col"><span class="cd-num" data-cd="hours">00</span><span class="cd-lab">Jam</span></div>' +
      '<div class="cd-col"><span class="cd-num" data-cd="mins">00</span><span class="cd-lab">Minit</span></div>' +
      '<div class="cd-col"><span class="cd-num" data-cd="secs">00</span><span class="cd-lab">Saat</span></div>' +
      "</div>" +
      '<p class="countdown-done" id="countdown-done" hidden data-field="countdown.done">' + esc(done) + "</p>" +
      "</div>"
    );
  }

  function dockLink(href, label, icon) {
    return '<a href="' + href + '">' + dockIcon(icon) + "<span>" + esc(label) + "</span></a>";
  }

  function dockIcon(icon) {
    if (icon === "wish") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6.5h12a1.5 1.5 0 0 1 1.5 1.5v6.2a1.5 1.5 0 0 1-1.5 1.5H10l-3.5 2.6v-2.6H6A1.5 1.5 0 0 1 4.5 14.2V8A1.5 1.5 0 0 1 6 6.5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    }
    if (icon === "place") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="12" cy="11" r="1.6" fill="currentColor"/></svg>';
    }
    if (icon === "contact") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 4.8h2.1l1.1 2.6-1.4 1a12 12 0 0 0 5.6 5.6l1-1.4 2.6 1.1v2.1a1.5 1.5 0 0 1-1.6 1.5A14.5 14.5 0 0 1 6.7 6.4a1.5 1.5 0 0 1 1.5-1.6z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5h16v10H4z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5 8.5 12 13l7-4.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  }

  function corners(sceneId) {
    if (sceneId === "opening") {
      return '<div class="corners corners-photo" aria-hidden="true">' +
        '<span class="cover-corner cover-tl"></span>' +
        '<span class="cover-corner cover-tr"></span>' +
        '<span class="cover-corner cover-br"></span>' +
        '<span class="cover-corner cover-bl"></span></div>';
    }
    return '<div class="corners corners-quiet" aria-hidden="true">' +
      '<span class="quiet-band"></span>' +
      '<span class="quiet-corner quiet-tl"></span>' +
      '<span class="quiet-corner quiet-tr"></span>' +
      '<span class="quiet-corner quiet-bl"></span>' +
      '<span class="quiet-corner quiet-br"></span>' +
      '<span class="quiet-sprig sprig-l1"></span>' +
      '<span class="quiet-sprig sprig-l5"></span>' +
      '<span class="quiet-sprig sprig-r1"></span>' +
      '<span class="quiet-sprig sprig-r5"></span></div>';
  }

  function openingFrame(sceneId) {
    var shadows = "";
    var flowers = "";
    function placePeony(x, y, radius, turn) {
      shadows += '<ellipse cx="' + (x + 2) + '" cy="' + (y + 6) + '" rx="' + (radius * 0.92) + '" ry="' + (radius * 0.62) + '" fill="#c9b7a4"/>';
      flowers += peony(x, y, radius, turn);
      flowers += reliefLeaf(x - radius * 0.35, y + radius * 0.45, radius * 0.55, turn + 50);
      flowers += reliefLeaf(x + radius * 0.4, y + radius * 0.2, radius * 0.48, turn - 60);
      flowers += reliefLeaf(x + radius * 0.1, y - radius * 0.35, radius * 0.42, turn + 130);
    }
    placePeony(30, 56, 52, 12);
    placePeony(360, 58, 50, -16);
    placePeony(22, 280, 20, 36);
    placePeony(368, 430, 18, -28);
    placePeony(28, 755, 44, 18);
    placePeony(362, 752, 42, -20);
    flowers = paperSprig(12, 100, 240, 176) + paperSprig(24, 250, 220, 184) + paperSprig(10, 460, 250, 172) +
      paperSprig(378, 104, 240, 184) + paperSprig(366, 270, 230, 176) + paperSprig(380, 490, 240, 188) +
      paperSprig(78, 14, 120, 94) + paperSprig(250, 16, 110, -96) +
      flowers;
    var blurId = "emboss-blur-" + sceneId;
    return (
      '<svg class="frame-svg" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' +
      "<defs>" +
      '<linearGradient id="relief-paper" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#ffffff"/><stop offset="0.48" stop-color="#f4eee6"/><stop offset="1" stop-color="#d8cdc0"/>' +
      "</linearGradient>" +
      '<linearGradient id="relief-leaf" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#fbf7f2"/><stop offset="1" stop-color="#d4c6b6"/>' +
      "</linearGradient>" +
      '<radialGradient id="relief-heart" cx="38%" cy="34%" r="68%">' +
      '<stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e4d8cb"/>' +
      "</radialGradient>" +
      '<filter id="' + blurId + '" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.4"/></filter>' +
      "</defs>" +
      '<g filter="url(#' + blurId + ')" opacity="0.4">' + shadows + "</g>" +
      "<g>" + flowers + "</g></svg>"
    );
  }

  function reliefPoint(x, y, cx, cy, radius, angle) {
    var scale = radius / 48;
    var rad = angle * Math.PI / 180;
    var px = x * scale;
    var py = y * scale;
    return (cx + px * Math.cos(rad) - py * Math.sin(rad)).toFixed(1) + " " +
      (cy + px * Math.sin(rad) + py * Math.cos(rad)).toFixed(1);
  }

  function reliefPetal(cx, cy, radius, angle, fill) {
    var p = function (x, y) { return reliefPoint(x, y, cx, cy, radius, angle); };
    return '<path fill="' + fill + '" d="M ' + p(0, 6) +
      " C " + p(24, 0) + " " + p(28, -20) + " " + p(12, -42) +
      " C " + p(5, -52) + " " + p(-5, -52) + " " + p(-12, -42) +
      " C " + p(-28, -20) + " " + p(-24, 0) + " " + p(0, 6) + ' Z"/>';
  }

  function reliefLeaf(cx, cy, radius, angle) {
    var p = function (x, y) { return reliefPoint(x, y, cx, cy, radius, angle); };
    var tip = p(0, -52);
    var base = p(0, 4);
    return '<path fill="url(#relief-leaf)" d="M ' + base + " C " + p(14, -8) + " " + p(12, -36) + " " + tip +
      " C " + p(-12, -36) + " " + p(-14, -8) + " " + base + ' Z"/>' +
      '<path d="M ' + base + " L " + tip + '" fill="none" stroke="#e7d9cb" stroke-width="0.7" stroke-linecap="round"/>';
  }

  function peony(cx, cy, radius, turn) {
    var html = "";
    var layers = [[9, 1, 0], [8, 0.7, 16], [6, 0.44, 28]];
    layers.forEach(function (layer) {
      var n = layer[0];
      var i;
      for (i = 0; i < n; i += 1) {
        var wobble = 0.9 + ((i * 3) % 5) * 0.035;
        html += reliefPetal(cx, cy, radius * layer[1] * wobble, turn + layer[2] + i * (360 / n) + (i % 2 ? 7 : -5), "url(#relief-paper)");
      }
    });
    return html + '<circle cx="' + cx + '" cy="' + cy + '" r="' + (radius * 0.1).toFixed(1) + '" fill="url(#relief-heart)"/>';
  }

  function paperSprig(x, y, len, angle) {
    var rad = angle * Math.PI / 180;
    var x2 = x + Math.sin(rad) * len;
    var y2 = y - Math.cos(rad) * len;
    var html = '<path d="M ' + x.toFixed(1) + " " + y.toFixed(1) + " Q " +
      ((x + x2) / 2 + Math.cos(rad) * 14).toFixed(1) + " " + ((y + y2) / 2).toFixed(1) + " " +
      x2.toFixed(1) + " " + y2.toFixed(1) + '" fill="none" stroke="#e4d6c8" stroke-width="1.25" stroke-linecap="round"/>';
    var steps = Math.max(6, Math.floor(len / 12));
    var i;
    for (i = 1; i < steps; i += 1) {
      var t = i / steps;
      var lx = x + (x2 - x) * t;
      var ly = y + (y2 - y) * t;
      var side = i % 2 ? 1 : -1;
      html += reliefLeaf(lx, ly, 12 + (i % 3) * 3, angle + side * 68);
      if (i % 5 === 0) html += peony(lx + side * 4, ly, 11, angle + i * 10);
      else if (i % 3 === 0) html += '<circle cx="' + lx.toFixed(1) + '" cy="' + ly.toFixed(1) + '" r="2.4" fill="#f6eee6"/>';
    }
    return html;
  }

  function cluster(sceneId, place, x, y, radius, turn) {
    return cornerSvg(
      sceneId,
      place,
      blossom(x, y, radius, turn) +
      blossom(x + 18, y + 16, radius * 0.55, turn + 22) +
      blossom(x - 14, y + 18, radius * 0.4, turn - 16) +
      leaf(x - 26, y + 8, 16, 5.5, turn) +
      leaf(x + 16, y - 18, 13, 4.4, turn - 34) +
      leaf(x - 6, y + 26, 12, 4, turn + 46) +
      leaf(x + 24, y + 4, 10, 3.5, turn + 16) +
      '<circle class="bud" cx="' + (x + 28) + '" cy="' + (y - 12) + '" r="2"/>' +
      '<circle class="bud" cx="' + (x - 16) + '" cy="' + (y - 6) + '" r="1.5"/>'
    );
  }

  function sprig(sceneId, place, x, y, radius, turn) {
    return cornerSvg(
      sceneId,
      place,
      blossom(x, y, radius, turn) +
      leaf(x - 16, y + 7, 13, 4.4, turn + 18) +
      leaf(x + 12, y + 12, 10, 3.6, turn - 24) +
      '<circle class="bud" cx="' + (x + 14) + '" cy="' + (y - 10) + '" r="1.7"/>' +
      '<circle class="bud" cx="' + (x - 10) + '" cy="' + (y - 6) + '" r="1.3"/>',
      "edge-svg edge-" + place
    );
  }

  function trail(sceneId, place, x, y, turn) {
    return cornerSvg(
      sceneId,
      place,
      leaf(x, y, 14, 4.6, turn) +
      leaf(x + 14, y + 7, 11, 3.6, turn + 28) +
      leaf(x - 12, y + 8, 9, 3.2, turn - 22) +
      '<circle class="bud" cx="' + (x + 6) + '" cy="' + (y - 8) + '" r="1.5"/>',
      "edge-svg edge-" + place
    );
  }

  function cornerSvg(sceneId, place, inner, className) {
    var filterId = "emboss-" + sceneId + "-" + place;
    return (
      '<svg class="corner-svg corner-' + place + (className ? " " + className : "") + '" viewBox="0 0 140 160" aria-hidden="true" focusable="false">' +
      '<defs><filter id="' + filterId + '" x="-40%" y="-40%" width="180%" height="180%">' +
      '<feDropShadow dx="0" dy="1.5" stdDeviation="1.3" flood-color="#a89886" flood-opacity="0.7"/>' +
      '<feDropShadow dx="0" dy="-0.5" stdDeviation="0.4" flood-color="#ffffff" flood-opacity="0.9"/>' +
      "</filter></defs>" +
      '<g filter="url(#' + filterId + ')">' + inner + "</g></svg>"
    );
  }

  function blossom(cx, cy, radius, turn) {
    var petals = "";
    var i;
    for (i = 0; i < 6; i += 1) {
      var angle = turn + i * 60;
      petals +=
        '<ellipse cx="' + cx + '" cy="' + (cy - radius * 0.58) + '" rx="' + (radius * 0.42) +
        '" ry="' + (radius * 0.62) + '" transform="rotate(' + angle + " " + cx + " " + cy + ')"/>';
    }
    return (
      '<g class="bloom">' + petals +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (radius * 0.22) + '" class="bloom-heart"/>' +
      "</g>"
    );
  }

  function leaf(x, y, w, h, turn) {
    return (
      '<ellipse class="leaf" cx="' + x + '" cy="' + y + '" rx="' + w + '" ry="' + h +
      '" transform="rotate(' + turn + " " + x + " " + y + ')"/>'
    );
  }

  function bindDock(invitation) {
    invitation.addEventListener("click", function (event) {
      var link = event.target.closest(".dock a");
      if (!link) return;
      var href = link.getAttribute("href") || "";
      if (href.charAt(0) !== "#") return;
      event.preventDefault();
      if (href === "#contact") {
        openContact(invitation);
        return;
      }
      openFromCover();
      var target = invitation.querySelector(href);
      if (!target) return;
      invitation.querySelectorAll(".dock a").forEach(function (item) {
        item.removeAttribute("aria-current");
      });
      link.setAttribute("aria-current", "page");
      target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      window.setTimeout(function () { seatUnderPill(target); }, reduce ? 40 : 520);
    });
  }

  function contactPeople(wedding) {
    var contact = wedding.contact || {};
    var list = Array.isArray(contact.people) ? contact.people : [];
    var people = list.map(function (person) {
      person = person || {};
      return {
        role: String(person.role || "").trim(),
        name: String(person.name || "").trim(),
        phone: String(person.phone || "").trim()
      };
    }).filter(function (person) {
      return person.role || person.name || person.phone;
    });
    if (people.length) return people;
    return [{
      role: String(contact.role || "").trim(),
      name: String(contact.name || wedding.partnerOne || "Contact").trim(),
      phone: String(contact.phone || "").trim()
    }];
  }

  function contactSheet(wedding) {
    var people = contactPeople(wedding);
    var cards = people.map(function (person, index) {
      var digits = person.phone.replace(/[^\d+]/g, "");
      var role = person.role
        ? '<p class="contact-role" data-field="contact.people.' + index + '.role">' + esc(person.role) + "</p>"
        : "";
      var phone = person.phone
        ? '<p class="contact-phone"><a data-field="contact.people.' + index + '.phone" href="' + (digits ? "tel:" + esc(digits) : "#") + '">' + esc(person.phone) + "</a></p>"
        : "";
      return (
        '<article class="contact-person">' +
        role +
        '<h2' + (index === 0 ? ' id="contact-person"' : "") + ' data-field="contact.people.' + index + '.name">' + esc(person.name || "Contact") + "</h2>" +
        phone +
        "</article>"
      );
    }).join("");
    return (
      '<div class="contact-sheet" id="contact-sheet" aria-hidden="true">' +
      '<button class="contact-shade" type="button" aria-label="Close contact"></button>' +
      '<div class="contact-panel" role="dialog" aria-modal="true" aria-labelledby="contact-person">' +
      '<button class="contact-close" type="button" aria-label="Close">Close</button>' +
      '<p class="contact-kicker" data-field="nav.contact">' + esc((wedding.nav && wedding.nav.contact) || "Contact") + "</p>" +
      cards +
      "</div></div>"
    );
  }

  function bindContact(invitation) {
    var sheet = invitation.querySelector("#contact-sheet");
    if (!sheet) return;
    sheet.addEventListener("click", function (event) {
      if (event.target.closest(".contact-shade, .contact-close")) closeContact(sheet);
    });
    if (bindContact.listening) return;
    bindContact.listening = true;
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      var open = document.querySelector(".contact-sheet.is-open");
      if (open) closeContact(open);
    });
    window.addEventListener("resize", function () {
      var open = document.querySelector(".contact-sheet.is-open");
      if (open) seatContact(open);
    });
  }

  function openContact(invitation) {
    var sheet = invitation.querySelector("#contact-sheet");
    if (!sheet) return;
    var scroll = window.scrollY;
    sheet.setAttribute("aria-hidden", "false");
    seatContact(sheet);
    window.requestAnimationFrame(function () {
      sheet.classList.add("is-open");
      window.scrollTo(0, scroll);
      var close = sheet.querySelector(".contact-close");
      if (close) close.focus({ preventScroll: true });
    });
  }

  function seatContact(sheet) {
    var dock = document.querySelector(".dock");
    var panel = sheet.querySelector(".contact-panel");
    if (!dock || !panel) return;
    dock.style.bottom = "0px";
    panel.style.bottom = dock.offsetHeight + "px";
  }

  function closeContact(sheet) {
    if (!sheet) return;
    var scroll = window.scrollY;
    sheet.classList.remove("is-open");
    sheet.setAttribute("aria-hidden", "true");
    var dock = document.querySelector(".dock");
    if (dock) dock.style.bottom = "";
    window.scrollTo(0, scroll);
    var tab = document.querySelector('.dock a[href="#contact"]');
    if (tab) tab.focus({ preventScroll: true });
  }

  function seatUnderPill(scene) {
    var copy = scene.querySelector(".scene-copy");
    var dock = document.querySelector(".dock");
    if (!copy || !dock) return;
    document.querySelectorAll(".scene.is-tabbed").forEach(function (el) {
      if (el !== scene) el.classList.remove("is-tabbed");
    });
    document.querySelectorAll(".scene-copy").forEach(function (el) {
      if (el !== copy) el.style.transform = "";
    });
    scene.classList.add("is-tabbed");
    copy.style.transition = reduce ? "none" : "transform 0.55s cubic-bezier(0.22, 0.61, 0.36, 1)";
    copy.style.transform = "translateY(0)";
    window.requestAnimationFrame(function () {
      var copyBox = copy.getBoundingClientRect();
      var dockBox = dock.getBoundingClientRect();
      var gap = 18;
      var delta = dockBox.top - gap - copyBox.bottom;
      copy.style.transform = "translateY(" + Math.round(delta) + "px)";
    });
  }

  function startCountdown(wedding) {
    var grid = document.getElementById("countdown-figures");
    var done = document.getElementById("countdown-done");
    if (!grid) return;
    var daysEl = grid.querySelector('[data-cd="days"]');
    var hoursEl = grid.querySelector('[data-cd="hours"]');
    var minsEl = grid.querySelector('[data-cd="mins"]');
    var secsEl = grid.querySelector('[data-cd="secs"]');
    var target = weddingDate(wedding.date || {});
    window.clearInterval(startCountdown.timer);
    function setPair(el, value) {
      if (el) el.textContent = pad2(value);
    }
    function tick() {
      if (!isFinite(target.getTime())) {
        setPair(daysEl, 0);
        setPair(hoursEl, 0);
        setPair(minsEl, 0);
        setPair(secsEl, 0);
        return;
      }
      var diff = target.getTime() - Date.now();
      if (diff <= 0) {
        setPair(daysEl, 0);
        setPair(hoursEl, 0);
        setPair(minsEl, 0);
        setPair(secsEl, 0);
        grid.hidden = true;
        if (done) done.hidden = false;
        window.clearInterval(startCountdown.timer);
        return;
      }
      grid.hidden = false;
      if (done) done.hidden = true;
      var total = Math.floor(diff / 1000);
      setPair(daysEl, Math.floor(total / 86400));
      setPair(hoursEl, Math.floor((total % 86400) / 3600));
      setPair(minsEl, Math.floor((total % 3600) / 60));
      setPair(secsEl, total % 60);
    }
    tick();
    startCountdown.timer = window.setInterval(tick, 1000);
  }

  function pad2(value) {
    var n = Math.max(0, Math.floor(Number(value) || 0));
    return n < 10 ? "0" + n : String(n);
  }

  function weddingDate(date) {
    date = date || {};
    var blob = [date.weekday, date.day, date.month, date.year, date.time].join(" ");
    var month = monthIndex(date.month);
    if (month < 0) month = monthIndex(blob);
    var day = parseInt(date.day, 10);
    var year = parseInt(date.year, 10);
    if (!day) {
      var dayMatch = String(date.day || date.month || "").match(/\d{1,2}/);
      if (dayMatch) day = parseInt(dayMatch[0], 10);
    }
    if (!year) {
      var yearMatch = blob.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) year = parseInt(yearMatch[0], 10);
    }
    var clock = parseClock(date.time || blob);
    if (month < 0 || !day || day > 31 || !year) return new Date(NaN);
    // Asia/Kuala_Lumpur = UTC+08:00
    var iso =
      year + "-" + pad2(month + 1) + "-" + pad2(day) +
      "T" + pad2(clock.hours) + ":" + pad2(clock.minutes) + ":00+08:00";
    return new Date(iso);
  }

  function bindEnvelope(wedding) {
    var stage = document.getElementById("envelope-stage");
    if (!stage) return;
    if (reduce || keptOpen) {
      stage.hidden = true;
      stage.setAttribute("aria-hidden", "true");
      document.documentElement.classList.add("is-open", "show-nav");
      document.documentElement.classList.remove("will-open");
      return;
    }
    var opened = false;
    function openEnvelope() {
      if (opened) return;
      opened = true;
      stage.classList.add("is-opening");
      stage.setAttribute("aria-hidden", "true");
      releaseButterflies();
      // Reveal invitation as top + bottom flaps part
      window.setTimeout(function () {
        document.documentElement.classList.add("envelope-open");
        window.clearTimeout(bindContinue.enableTimer);
        bindContinue.enableTimer = window.setTimeout(function () {
          var button = document.getElementById("continue");
          if (button) button.disabled = false;
        }, 4200);
      }, 650);
      window.setTimeout(function () {
        stage.classList.add("is-gone");
      }, 2700);
      window.setTimeout(function () {
        document.documentElement.classList.add("is-open", "show-nav");
        document.documentElement.classList.remove("will-open");
        window.requestAnimationFrame(shieldNames);
      }, 5600);
    }
    stage.addEventListener("click", openEnvelope);
    stage.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openEnvelope();
      }
    });
  }

  function releaseButterflies() {
    var field = document.getElementById("butterfly-field");
    if (!field || reduce) return;
    field.innerHTML = "";
    var count = 10 + Math.floor(Math.random() * 5);
    var i;
    for (i = 0; i < count; i += 1) {
      var bug = document.createElement("span");
      var goDown = i % 3 !== 0;
      var bx = (Math.random() * 56 - 28).toFixed(1);
      var by = goDown
        ? (28 + Math.random() * 52).toFixed(1)
        : (-32 - Math.random() * 46).toFixed(1);
      var midX = (parseFloat(bx) * (0.35 + Math.random() * 0.35) + (Math.random() * 18 - 9)).toFixed(1);
      var midY = (parseFloat(by) * (0.4 + Math.random() * 0.25)).toFixed(1);
      bug.className = "butterfly";
      bug.style.setProperty("--bx", bx + "vw");
      bug.style.setProperty("--by", by + "vh");
      bug.style.setProperty("--mx", midX + "vw");
      bug.style.setProperty("--my", midY + "vh");
      bug.style.setProperty("--brot", ((goDown ? 1 : -1) * (8 + Math.random() * 28)).toFixed(1) + "deg");
      bug.style.setProperty("--bscale", (0.72 + Math.random() * 0.55).toFixed(2));
      bug.style.setProperty("--bdelay", (0.12 + i * 0.07 + Math.random() * 0.22).toFixed(2) + "s");
      bug.style.setProperty("--bdur", (3.2 + Math.random() * 1.6).toFixed(2) + "s");
      bug.style.setProperty("--flap", (0.18 + Math.random() * 0.12).toFixed(2) + "s");
      bug.innerHTML =
        '<svg viewBox="0 0 88 78" aria-hidden="true" focusable="false">' +
        "<defs>" +
        '<linearGradient id="bw' + i + '" x1="0.15" y1="0" x2="0.9" y2="1">' +
        '<stop offset="0" stop-color="#ffffff" stop-opacity="0.98"/>' +
        '<stop offset="0.45" stop-color="#f8f6f2" stop-opacity="0.94"/>' +
        '<stop offset="1" stop-color="#ebe4da" stop-opacity="0.82"/>' +
        "</linearGradient>" +
        '<radialGradient id="bs' + i + '" cx="0.35" cy="0.3" r="0.75">' +
        '<stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/>' +
        '<stop offset="1" stop-color="#ffffff" stop-opacity="0"/>' +
        "</radialGradient>" +
        "</defs>" +
        '<g class="wing wing-left">' +
        '<path d="M42 40 C30 36 16 26 10 14 C8 8 14 5 22 10 C30 16 36 28 42 40 Z" fill="url(#bw' + i + ')" stroke="rgba(200,190,178,0.35)" stroke-width="0.5"/>' +
        '<path d="M42 40 C28 42 15 50 12 60 C14 66 24 62 32 52 C36 47 39 43 42 40 Z" fill="url(#bw' + i + ')" opacity="0.92" stroke="rgba(200,190,178,0.28)" stroke-width="0.45"/>' +
        '<path d="M42 40 C32 34 22 22 16 14" fill="none" stroke="rgba(180,170,158,0.35)" stroke-width="0.55"/>' +
        '<path d="M42 40 C33 44 24 52 18 58" fill="none" stroke="rgba(180,170,158,0.28)" stroke-width="0.45"/>' +
        '<ellipse cx="26" cy="24" rx="7" ry="9" fill="url(#bs' + i + ')" opacity="0.7"/>' +
        "</g>" +
        '<g class="wing wing-right">' +
        '<path d="M46 40 C58 36 72 26 78 14 C80 8 74 5 66 10 C58 16 52 28 46 40 Z" fill="url(#bw' + i + ')" stroke="rgba(200,190,178,0.35)" stroke-width="0.5"/>' +
        '<path d="M46 40 C60 42 73 50 76 60 C74 66 64 62 56 52 C52 47 49 43 46 40 Z" fill="url(#bw' + i + ')" opacity="0.92" stroke="rgba(200,190,178,0.28)" stroke-width="0.45"/>' +
        '<path d="M46 40 C56 34 66 22 72 14" fill="none" stroke="rgba(180,170,158,0.35)" stroke-width="0.55"/>' +
        '<path d="M46 40 C55 44 64 52 70 58" fill="none" stroke="rgba(180,170,158,0.28)" stroke-width="0.45"/>' +
        '<ellipse cx="62" cy="24" rx="7" ry="9" fill="url(#bs' + i + ')" opacity="0.7"/>' +
        "</g>" +
        '<ellipse cx="44" cy="41" rx="1.6" ry="9.2" fill="#cfc6ba"/>' +
        '<circle cx="44" cy="31.2" r="1.25" fill="#bdb3a6"/>' +
        '<path d="M43.2 30.2 C40 24 36.5 20.5 34 18.5" fill="none" stroke="#c4bbb0" stroke-width="0.7" stroke-linecap="round"/>' +
        '<path d="M44.8 30.2 C48 24 51.5 20.5 54 18.5" fill="none" stroke="#c4bbb0" stroke-width="0.7" stroke-linecap="round"/>' +
        '<circle cx="34" cy="18.5" r="0.7" fill="#d2c9bd"/>' +
        '<circle cx="54" cy="18.5" r="0.7" fill="#d2c9bd"/>' +
        "</svg>";
      field.appendChild(bug);
    }
  }

  function parseClock(value) {
    var match = String(value || "").trim().match(/(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i);
    if (!match) return { hours: 11, minutes: 0 };
    var hours = parseInt(match[1], 10);
    var minutes = parseInt(match[2] || "0", 10);
    var suffix = (match[3] || "").toLowerCase().replace(/\./g, "");
    if (hours > 23 || minutes > 59) return { hours: 11, minutes: 0 };
    if (suffix === "pm" && hours < 12) hours += 12;
    if (suffix === "am" && hours === 12) hours = 0;
    return { hours: hours, minutes: minutes };
  }

  function openFromCover() {
    document.documentElement.classList.add("is-open", "show-nav");
    window.requestAnimationFrame(shieldNames);
  }

  function scheduleNav() {
    if (reduce || keptOpen) {
      document.documentElement.classList.add("show-nav");
      return;
    }
    var stage = document.getElementById("envelope-stage");
    if (stage && !stage.hidden) return;
    window.clearTimeout(scheduleNav.timer);
    scheduleNav.timer = window.setTimeout(function () {
      document.documentElement.classList.add("show-nav");
    }, 3350);
  }

  function bindContinue(invitation) {
    var button = invitation.querySelector("#continue");
    if (!button) return;
    if (!reduce && !keptOpen) button.disabled = true;
    if (reduce || keptOpen) button.disabled = false;
    else {
      window.clearTimeout(bindContinue.enableTimer);
      bindContinue.enableTimer = window.setTimeout(function () {
        if (document.documentElement.classList.contains("envelope-open") ||
            document.documentElement.classList.contains("is-open")) {
          button.disabled = false;
        }
      }, 4200);
    }
    button.addEventListener("click", function () {
      openFromCover();
      var scenes = invitation.querySelectorAll(".scene");
      var opening = invitation.querySelector(".scene-opening");
      var index = Array.prototype.indexOf.call(scenes, opening);
      var target = scenes[index + 1] || scenes[0];
      window.requestAnimationFrame(function () {
        if (target) target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      });
    });
  }

  var motionWatcher = null;

  function bindMotion() {
    var scenes = root.querySelectorAll(".scene");
    if (motionWatcher) motionWatcher.disconnect();
    if (reduce || !("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(scenes, function (scene) { scene.classList.add("is-in"); });
      return;
    }
    motionWatcher = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.intersectionRatio === 0) {
          entry.target.classList.remove("is-in");
          return;
        }
        if (entry.intersectionRatio < 0.22 || entry.target.classList.contains("is-in")) return;
        var lines = entry.target.querySelectorAll(".line");
        Array.prototype.forEach.call(lines, function (line, index) {
          line.style.animationDelay = Math.min(index * 0.08, 0.64) + "s";
        });
        entry.target.classList.add("is-in");
      });
    }, { threshold: [0, 0.22] });
    Array.prototype.forEach.call(scenes, function (scene) {
      if (!scene.classList.contains("scene-opening")) motionWatcher.observe(scene);
    });
    if (!bindMotion.listening) {
      bindMotion.listening = true;
      bindSlowSectionSwipe();
    }
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function animateScrollTo(top, duration) {
    var start = window.scrollY || window.pageYOffset || 0;
    var delta = top - start;
    if (Math.abs(delta) < 2) return;
    var t0 = performance.now();
    function frame(now) {
      var t = Math.min(1, (now - t0) / duration);
      window.scrollTo(0, start + delta * easeInOutCubic(t));
      if (t < 1) window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  }

  function nearestSceneIndex(scenes) {
    var mid = window.innerHeight * 0.35;
    var best = 0;
    var bestDist = Infinity;
    Array.prototype.forEach.call(scenes, function (scene, index) {
      var dist = Math.abs(scene.getBoundingClientRect().top - mid);
      if (dist < bestDist) {
        bestDist = dist;
        best = index;
      }
    });
    return best;
  }

  function bindSlowSectionSwipe() {
    if (reduce) return;
    var coarse = false;
    try {
      coarse = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    } catch (error) {
      coarse = "ontouchstart" in window;
    }
    if (!coarse || bindSlowSectionSwipe.bound) return;
    bindSlowSectionSwipe.bound = true;
    var startY = 0;
    var startX = 0;
    var locking = false;
    document.addEventListener("touchstart", function (event) {
      if (!document.documentElement.classList.contains("is-open") || locking) return;
      if (!event.touches || !event.touches.length) return;
      startY = event.touches[0].clientY;
      startX = event.touches[0].clientX;
    }, { passive: true });
    document.addEventListener("touchend", function (event) {
      if (!document.documentElement.classList.contains("is-open") || locking) return;
      if (!event.changedTouches || !event.changedTouches.length) return;
      var endY = event.changedTouches[0].clientY;
      var endX = event.changedTouches[0].clientX;
      var dy = startY - endY;
      var dx = endX - startX;
      if (Math.abs(dy) < 56 || Math.abs(dy) < Math.abs(dx) * 1.2) return;
      var scenes = root.querySelectorAll(".scene");
      if (!scenes.length) return;
      var index = nearestSceneIndex(scenes);
      var next = dy > 0 ? Math.min(scenes.length - 1, index + 1) : Math.max(0, index - 1);
      if (next === index) return;
      locking = true;
      var top = scenes[next].getBoundingClientRect().top + (window.scrollY || window.pageYOffset || 0);
      animateScrollTo(top, 980);
      window.setTimeout(function () { locking = false; }, 1050);
    }, { passive: true });
  }

  function bindPhotos(invitation, wedding) {
    var frame = invitation.querySelector("#photo-frame");
    var placeholder = invitation.querySelector("#photo-placeholder");
    if (!frame || !placeholder) return;
    var names = wedding.place.photos || [];
    if (!names.length) {
      placeholder.hidden = false;
      return;
    }
    var pending = names.length;
    var shown = 0;
    names.forEach(function (src) {
      var image = new Image();
      image.alt = "";
      image.onload = function () {
        shown += 1;
        pending -= 1;
        frame.appendChild(image);
        placeholder.hidden = true;
      };
      image.onerror = function () {
        pending -= 1;
        if (pending === 0 && shown === 0) placeholder.hidden = false;
      };
      image.src = src;
    });
  }

  function bindRsvp(wedding, invitation) {
    var form = invitation.querySelector("#rsvp-form");
    var confirm = invitation.querySelector("#rsvp-confirm");
    var error = invitation.querySelector("#rsvp-error");
    var message = invitation.querySelector("#rsvp-message");
    var echo = invitation.querySelector("#rsvp-echo");
    var edit = invitation.querySelector("#rsvp-edit");
    if (!form || !confirm || !message || !edit) return;
    var saved = readStore("wedding-card-rsvp");
    if (saved && saved.name) showSaved(saved);

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var name = String(form.name.value || "").replace(/\s+/g, " ").trim();
      var attendance = form.attendance.value;
      var note = String(form.note.value || "").trim();
      if (!name) {
        showError(wedding.rsvp.errorName);
        form.name.focus();
        return;
      }
      if (attendance !== "yes" && attendance !== "no") {
        showError(wedding.rsvp.errorAttendance);
        var firstChoice = form.querySelector('input[name="attendance"]');
        if (firstChoice) firstChoice.focus();
        return;
      }
      var record = { name: name, attendance: attendance, note: note };
      try { localStorage.setItem("wedding-card-rsvp", JSON.stringify(record)); } catch (saveError) {}
      showSaved(record);
    });

    edit.addEventListener("click", function () {
      try { localStorage.removeItem("wedding-card-rsvp"); } catch (removeError) {}
      confirm.hidden = true;
      form.hidden = false;
      form.name.focus();
    });

    function showSaved(record) {
      error.hidden = true;
      var template = record.attendance === "yes" ? wedding.rsvp.acceptMessage : wedding.rsvp.declineMessage;
      message.textContent = String(template).replaceAll("{name}", record.name);
      if (record.note) {
        echo.hidden = false;
        echo.textContent = record.note;
      } else {
        echo.hidden = true;
        echo.textContent = "";
      }
      form.hidden = true;
      confirm.hidden = false;
    }

    function showError(text) {
      error.hidden = false;
      error.textContent = text;
    }
  }

  function bindGuestbook(invitation) {
    var form = invitation.querySelector("#guestbook-form");
    var list = invitation.querySelector("#wish-list");
    var error = invitation.querySelector("#book-error");
    var book = currentWedding().guestbook;
    if (!form || !list) return;
    renderWishes();
    window.addEventListener("storage", function (event) {
      if (event.key === "wedding-card-guestbook") renderWishes();
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var name = String(form.name.value || "").replace(/\s+/g, " ").trim();
      var attendance = form.attendance ? form.attendance.value : "";
      var message = String(form.message.value || "").trim();
      if (!name) {
        error.hidden = false;
        error.textContent = book.errorName;
        form.name.focus();
        return;
      }
      if (!attendance) {
        error.hidden = false;
        error.textContent = book.errorAttendance || "Please let us know whether you can attend.";
        return;
      }
      if (!message) {
        error.hidden = false;
        error.textContent = book.errorMessage;
        form.message.focus();
        return;
      }
      var wishes = readWishes();
      wishes.push({ name: name, attendance: attendance, message: message });
      if (wishes.length > 40) wishes = wishes.slice(wishes.length - 40);
      try { localStorage.setItem("wedding-card-guestbook", JSON.stringify(wishes)); } catch (saveError) {}
      form.reset();
      error.hidden = true;
      renderWishes();
    });

    function renderWishes() {
      var wishes = readWishes();
      list.textContent = "";
      list.classList.remove("is-scrolling");
      if (!wishes.length) {
        var empty = document.createElement("p");
        empty.className = "wish-empty";
        empty.textContent = book.empty;
        list.appendChild(empty);
        return;
      }
      var track = document.createElement("div");
      track.className = "wish-track";
      var ordered = wishes.slice().reverse();
      ordered.forEach(function (wish) {
        track.appendChild(wishCard(wish));
      });
      // Duplicate for a seamless loop when there is enough content
      if (ordered.length > 1) {
        ordered.forEach(function (wish) {
          var clone = wishCard(wish);
          clone.setAttribute("aria-hidden", "true");
          track.appendChild(clone);
        });
        list.classList.add("is-scrolling");
      }
      list.appendChild(track);
      var seconds = Math.max(12, ordered.length * 4);
      track.style.setProperty("--wish-scroll-duration", seconds + "s");
    }

    function wishCard(wish) {
      var item = document.createElement("article");
      item.className = "wish";
      var who = document.createElement("p");
      who.className = "wish-name";
      who.textContent = wish.name;
      item.appendChild(who);
      var body = document.createElement("p");
      body.className = "wish-message";
      body.textContent = wish.message;
      item.appendChild(body);
      return item;
    }
  }

  function readWishes() {
    try {
      var parsed = JSON.parse(localStorage.getItem("wedding-card-guestbook") || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (item) {
        return item && typeof item.name === "string" && typeof item.message === "string";
      });
    } catch (error) {
      return [];
    }
  }

  function bindMusic(wedding, invitation) {
    var slot = invitation.querySelector("#music-slot");
    if (!slot) return;
    var src = musicSource(wedding.music);
    if (!src) return;
    slot.classList.add("has-audio");
    var audio = document.createElement("audio");
    audio.preload = "none";
    audio.loop = true;
    var playLabel = wedding.musicPlay || "Play music";
    var pauseLabel = wedding.musicPause || "Pause music";
    var button = document.createElement("button");
    button.type = "button";
    button.className = "music-button";
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", playLabel);
    button.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h3.2L12 6.2v11.6L7.2 14H4z" fill="currentColor"/><path d="M15.2 9.2a3.4 3.4 0 0 1 0 5.6M17.6 7a6.2 6.2 0 0 1 0 10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
    function showEmpty() {
      slot.classList.remove("has-audio");
      slot.textContent = "";
    }
    button.addEventListener("click", function () {
      if (!audio.paused) {
        audio.pause();
        return;
      }
      var pending;
      try {
        pending = audio.play();
      } catch (error) {
        return;
      }
      if (pending && typeof pending.then === "function") pending.then(function () {}, function () {});
    });
    function sync() {
      var on = !audio.paused;
      button.setAttribute("aria-pressed", on ? "true" : "false");
      button.setAttribute("aria-label", on ? pauseLabel : playLabel);
    }
    audio.addEventListener("play", sync);
    audio.addEventListener("pause", sync);
    audio.addEventListener("error", showEmpty);
    try {
      audio.src = src;
    } catch (error) {
      showEmpty();
      return;
    }
    slot.appendChild(button);
    slot.appendChild(audio);
  }

  function writeStore(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function readStore(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function mergeWedding(source, extra) {
    var wedding = JSON.parse(JSON.stringify(source));
    ensureShape(wedding);
    if (!extra) return wedding;
    assignStrings(wedding, extra, ["partnerOne", "partnerTwo", "music"]);
    assignGroup(wedding.date, extra.date, ["weekday", "day", "month", "year", "time"]);
    assignGroup(wedding.opening, extra.opening, ["kicker", "continueLabel"]);
    assignGroup(wedding.couple, extra.couple, ["kicker", "oneLine", "twoLine", "note"]);
    assignGroup(wedding.announcement, extra.announcement, [
      "kicker", "parentsOneLabel", "parentsOne", "parentsTwoLabel", "parentsTwo",
      "message", "note", "quotationLabel", "quotation", "quotationSource", "announcement"
    ]);
    assignGroup(wedding.celebration, extra.celebration, ["heading", "dateLine", "note"]);
    if (extra.celebration) {
      assignGroup(wedding.celebration.ceremony, extra.celebration.ceremony, ["label", "time", "place", "detail"]);
      assignGroup(wedding.celebration.reception, extra.celebration.reception, ["label", "time", "place", "detail"]);
      assignGroup(wedding.celebration.attire, extra.celebration.attire, ["label", "text"]);
    }
    if (extra.ceremony && !extra.celebration) {
      assignGroup(wedding.celebration.ceremony, extra.ceremony, ["label", "time", "place", "detail"]);
    }
    if (extra.reception && !extra.celebration) {
      assignGroup(wedding.celebration.reception, extra.reception, ["label", "time", "place", "detail"]);
    }
    if (typeof extra.welcome === "string" && !(extra.announcement && typeof extra.announcement.message === "string")) {
      wedding.announcement.message = extra.welcome;
    }
    assignGroup(wedding.venue, extra.venue, ["name", "street", "mapLabel", "mapUrl"]);
    assignGroup(wedding.place, extra.place, ["heading", "wazeLabel", "wazeUrl", "photoPlaceholder", "note"]);
    if (extra.place && Array.isArray(extra.place.timeline)) wedding.place.timeline = sanitizeTimeline(extra.place.timeline);
    if (extra.place && Array.isArray(extra.place.photos)) wedding.place.photos = sanitizePhotos(extra.place.photos);
    assignGroup(wedding.closing, extra.closing, ["thankYou", "prayerLabel", "prayer", "closing", "note"]);
    if (typeof extra.closing === "string") wedding.closing.closing = extra.closing;
    assignGroup(wedding.nav, extra.nav, ["contact", "location", "wishes", "rsvp", "couple", "day", "venue"]);
    assignGroup(wedding.contact, extra.contact, ["role", "name", "phone", "line"]);
    if (extra.contact && Array.isArray(extra.contact.people)) {
      wedding.contact.people = extra.contact.people.map(function (person) {
        person = person || {};
        return {
          role: String(person.role || ""),
          name: String(person.name || ""),
          phone: String(person.phone || "")
        };
      }).filter(function (person) {
        return person.role || person.name || person.phone;
      });
    } else if (extra.contact && (typeof extra.contact.name === "string" || typeof extra.contact.phone === "string" || typeof extra.contact.role === "string")) {
      wedding.contact.people = [{
        role: wedding.contact.role || "",
        name: wedding.contact.name || "",
        phone: wedding.contact.phone || ""
      }];
    }
    assignGroup(wedding.countdown, extra.countdown, ["label", "arrival", "done"]);
    assignGroup(wedding.rsvp, extra.rsvp, ["heading", "intro", "note"]);
    assignGroup(wedding.guestbook, extra.guestbook, ["heading", "intro"]);
    if (extra.textStyle && typeof extra.textStyle === "object" && !Array.isArray(extra.textStyle)) {
      wedding.textStyle = cloneTree(extra.textStyle);
    }
    if (Array.isArray(extra.sceneOrder)) wedding.sceneOrder = normalizeOrder(extra.sceneOrder);
    return wedding;
  }

  function applyType(wedding) {
    var styles = wedding.textStyle || {};
    document.querySelectorAll("[data-field]").forEach(function (el) {
      var spec = pathValue(styles, el.getAttribute("data-field"));
      if (!spec || typeof spec !== "object") return;
      var size = clampNumber(spec.size, 70, 170, 100);
      var spacing = clampNumber(spec.spacing, 70, 180, 100);
      if (size === 100 && spacing === 100) return;
      var computed = window.getComputedStyle(el);
      if (size !== 100) {
        var font = parseFloat(computed.fontSize);
        if (font) el.style.fontSize = Math.round(font * size) / 100 + "px";
      }
      if (spacing !== 100) {
        var line = parseFloat(computed.lineHeight);
        if (line) el.style.lineHeight = Math.round(line * spacing) / 100 + "px";
        var top = parseFloat(computed.marginTop);
        if (top) el.style.marginTop = Math.round(top * spacing) / 100 + "px";
        var bottom = parseFloat(computed.marginBottom);
        if (bottom) el.style.marginBottom = Math.round(bottom * spacing) / 100 + "px";
      }
    });
  }

  function pathValue(root, path) {
    var cursor = root;
    var parts = String(path || "").split(".");
    var index;
    for (index = 0; index < parts.length; index += 1) {
      if (!cursor || typeof cursor !== "object") return null;
      cursor = cursor[parts[index]];
    }
    return cursor;
  }

  function cloneTree(value) {
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(cloneTree);
    var copy = {};
    Object.keys(value).forEach(function (key) { copy[key] = cloneTree(value[key]); });
    return copy;
  }

  function clampNumber(value, min, max, fallback) {
    var number = parseFloat(value);
    if (!isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function ensureShape(wedding) {
    wedding.date = wedding.date || {};
    wedding.opening = wedding.opening || {};
    wedding.couple = wedding.couple || {};
    wedding.announcement = wedding.announcement || {};
    wedding.celebration = wedding.celebration || {};
    wedding.celebration.ceremony = wedding.celebration.ceremony || {};
    wedding.celebration.reception = wedding.celebration.reception || {};
    wedding.celebration.attire = wedding.celebration.attire || {};
    wedding.venue = wedding.venue || {};
    wedding.place = wedding.place || {};
    wedding.place.timeline = wedding.place.timeline || [];
    wedding.place.photos = wedding.place.photos || [];
    wedding.closing = wedding.closing || {};
    wedding.nav = wedding.nav || {};
    wedding.rsvp = wedding.rsvp || {};
    wedding.guestbook = wedding.guestbook || {};
    wedding.contact = wedding.contact || {};
    wedding.countdown = wedding.countdown || {};
    wedding.textStyle = wedding.textStyle || {};
    wedding.sceneOrder = normalizeOrder(wedding.sceneOrder);
    if (typeof wedding.music !== "string") wedding.music = "";
  }

  function assignStrings(target, extra, keys) {
    if (!extra) return;
    keys.forEach(function (key) {
      if (typeof extra[key] === "string") target[key] = extra[key];
    });
  }

  function assignGroup(target, extra, keys) {
    if (!extra || typeof extra !== "object") return;
    keys.forEach(function (key) {
      if (typeof extra[key] === "string") target[key] = extra[key];
    });
  }

  function normalizeOrder(list) {
    var next = [];
    (list || []).forEach(function (id) {
      if (SCENE_IDS.indexOf(id) !== -1 && next.indexOf(id) === -1) next.push(id);
    });
    SCENE_IDS.forEach(function (id) {
      if (next.indexOf(id) === -1) next.push(id);
    });
    return next;
  }

  function sanitizeTimeline(list) {
    return list.map(function (item) {
      return {
        time: String(item && item.time || "").trim(),
        title: String(item && item.title || "").trim(),
        detail: String(item && item.detail || "").trim(),
      };
    }).filter(function (item) {
      return item.time || item.title || item.detail;
    }).slice(0, 8);
  }

  function sanitizePhotos(list) {
    return list.map(function (item) {
      return String(item || "").trim();
    }).filter(function (item) {
      return item && item.indexOf("..") === -1 && !/^[a-z][a-z0-9+.-]*:/i.test(item) && !/[<>"']/.test(item);
    }).slice(0, 6);
  }

  function musicSource(value) {
    var raw = String(value == null ? "" : value).trim();
    if (!raw || /[\u0000-\u001f]/.test(raw)) return "";
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return safeUrl(raw);
    if (raw.indexOf("..") !== -1 || /[<>"']/.test(raw)) return "";
    return raw;
  }

  function letters(text, start) {
    var delay = Number(start) || 0;
    return String(text || "").split("").map(function (ch) {
      if (ch === " ") {
        delay += 0.04;
        return '<span class="letter space">&nbsp;</span>';
      }
      var piece = '<span class="letter" style="animation-delay:' + delay.toFixed(2) + 's">' + esc(ch) + "</span>";
      delay += 0.07;
      return piece;
    }).join("");
  }

  function monogramMark(wedding, className) {
    var mark = initial(wedding.partnerOne) + initial(wedding.partnerTwo);
    return (
      '<p class="monogram ' + className + '" aria-label="' + esc(mark) + '">' +
      '<span class="mono-logo" role="img" aria-hidden="true"></span>' +
      "</p>"
    );
  }

  function coverDate(date) {
    var numeric = monthNumber(date.month);
    if (!numeric) return date.day + " " + date.month + " " + date.year;
    return date.day + "." + numeric + "." + date.year;
  }

  function coverVerse(wedding) {
    var item = wedding.announcement || {};
    var quote = String(item.quotation || "").trim();
    if (!quote) return "";
    var source = String(item.quotationSource || "").trim();
    return (
      '<blockquote class="cover-verse opening-line t-verse">' +
      '<p data-field="announcement.quotation">\u201C' + esc(quote) + "\u201D</p>" +
      (source ? '<cite data-field="announcement.quotationSource">' + esc(source) + "</cite>" : "") +
      "</blockquote>"
    );
  }

  function fullDate(date) {
    return date.weekday + " " + date.day + " " + date.month + " " + date.year;
  }

  function pipedDate(date) {
    var numeric = monthNumber(date.month);
    if (!numeric) return date.day + " " + date.month + " " + date.year;
    return date.day + " | " + numeric + " | " + date.year;
  }

  function monthNumber(name) {
    var index = monthIndex(name);
    if (index < 0) return "";
    var value = String(index + 1);
    return value.length === 1 ? "0" + value : value;
  }

  function monthIndex(name) {
    var raw = String(name || "").trim().toLowerCase();
    var exact = raw.replace(/[^a-z0-9]/g, "");
    if (/^\d{1,2}$/.test(exact)) {
      var number = parseInt(exact, 10);
      if (number >= 1 && number <= 12) return number - 1;
    }
    var names = [
      ["january", 0], ["januari", 0], ["jan", 0],
      ["february", 1], ["februari", 1], ["feb", 1],
      ["march", 2], ["maret", 2], ["mac", 2], ["mar", 2],
      ["april", 3], ["apr", 3],
      ["may", 4], ["mei", 4],
      ["june", 5], ["juni", 5], ["jun", 5],
      ["july", 6], ["julai", 6], ["juli", 6], ["jul", 6],
      ["august", 7], ["agustus", 7], ["ogustus", 7], ["ogos", 7], ["aug", 7],
      ["september", 8], ["sept", 8], ["sep", 8],
      ["october", 9], ["oktober", 9], ["oct", 9],
      ["november", 10], ["nov", 10],
      ["december", 11], ["disember", 11], ["desember", 11], ["dec", 11]
    ];
    var index;
    for (index = 0; index < names.length; index += 1) {
      if (exact === names[index][0]) return names[index][1];
    }
    for (index = 0; index < names.length; index += 1) {
      if (names[index][0].length > 2 && raw.indexOf(names[index][0]) !== -1) return names[index][1];
    }
    return -1;
  }

  function firstName(full) {
    var part = String(full || "").trim().split(/\s+/)[0];
    return part || String(full || "");
  }

  function initial(full) {
    var letter = firstName(full).charAt(0);
    return letter ? letter.toUpperCase() : "";
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function mountEditor() {
    if (document.querySelector(".edit-launch")) return;
    var button = document.createElement("button");
    button.type = "button";
    button.className = "edit-launch";
    button.textContent = "Edit";
    button.setAttribute("aria-haspopup", "dialog");
    button.addEventListener("click", openEditor);
    document.body.appendChild(button);
  }

  function openEditor() {
    var existing = document.getElementById("card-editor");
    if (existing) existing.remove();
    var shell = document.createElement("div");
    shell.className = "editor";
    shell.id = "card-editor";
    shell.innerHTML = '<div class="editor-card" role="dialog" aria-modal="true" aria-labelledby="edit-title"></div>';
    document.body.appendChild(shell);
    document.body.classList.add("editor-open");
    if (sessionStorage.getItem("wedding-admin-open") === "yes") showEditFields();
    else showEditGate();
  }

  function closeEditor() {
    var shell = document.getElementById("card-editor");
    if (shell) shell.remove();
    document.body.classList.remove("editor-open");
  }

  function editorCard() {
    return document.querySelector("#card-editor .editor-card");
  }

  function showEditGate() {
    var card = editorCard();
    if (!card) return;
    card.innerHTML =
      '<h2 id="edit-title">Edit invitation</h2>' +
      '<p class="editor-note">The password opens the wording. Save keeps it in this browser.</p>' +
      '<form id="edit-gate">' +
      '<label class="editor-field"><span>Password</span>' +
      '<input id="edit-password" type="password" autocomplete="current-password" required></label>' +
      '<p class="editor-error" id="edit-error" hidden></p>' +
      '<div class="editor-actions">' +
      '<button class="button" type="submit">Continue</button>' +
      '<button class="text-button" id="edit-close" type="button">Close</button>' +
      "</div></form>";
    card.querySelector("#edit-close").addEventListener("click", closeEditor);
    card.querySelector("#edit-gate").addEventListener("submit", function (event) {
      event.preventDefault();
      unlockEditor(card.querySelector("#edit-password").value);
    });
    card.querySelector("#edit-password").focus();
  }

  function unlockEditor(password) {
    var error = document.getElementById("edit-error");
    hashText(password).then(function (digest) {
      var expected = String(base.adminPasswordHash || "").toLowerCase();
      if (!expected || !sameText(digest, expected)) {
        error.hidden = false;
        error.textContent = "That password does not match.";
        return;
      }
      sessionStorage.setItem("wedding-admin-open", "yes");
      showEditFields();
    }).catch(function () {
      error.hidden = false;
      error.textContent = "This browser could not check the password.";
    });
  }

  function showEditFields() {
    var card = editorCard();
    if (!card) return;
    var wedding = currentWedding();
    card.innerHTML =
      '<h2 id="edit-title">Edit invitation</h2>' +
      '<p class="editor-note">Save keeps these words on the invitation in this browser.</p>' +
      '<p class="editor-note" id="edit-save-note" hidden></p>' +
      '<form id="edit-form">' +
      editBlock("Names and date", [
        editField("First partner", "partnerOne", wedding.partnerOne),
        editField("Second partner", "partnerTwo", wedding.partnerTwo),
        editField("Weekday", "date.weekday", wedding.date.weekday),
        editField("Day", "date.day", wedding.date.day),
        editField("Month", "date.month", wedding.date.month),
        editField("Year", "date.year", wedding.date.year),
        editField("Time", "date.time", wedding.date.time),
        editField("Opening line", "opening.kicker", wedding.opening.kicker)
      ]) +
      editBlock("Couple", [
        editField("Heading", "couple.kicker", wedding.couple.kicker),
        editArea("First partner line", "couple.oneLine", wedding.couple.oneLine),
        editArea("Second partner line", "couple.twoLine", wedding.couple.twoLine),
        editArea("Note", "couple.note", wedding.couple.note || "")
      ]) +
      editBlock("Solemnization and reception", [
        editField("Heading", "celebration.heading", wedding.celebration.heading),
        editField("Date line", "celebration.dateLine", wedding.celebration.dateLine || (
          wedding.date.weekday + " " + wedding.date.day + " " + wedding.date.month + " " +
          wedding.date.year + " · " + wedding.date.time
        )),
        editField("Solemnization", "celebration.ceremony.label", wedding.celebration.ceremony.label),
        editField("Solemnization time", "celebration.ceremony.time", wedding.celebration.ceremony.time),
        editField("Solemnization place", "celebration.ceremony.place", wedding.celebration.ceremony.place),
        editArea("Solemnization words", "celebration.ceremony.detail", wedding.celebration.ceremony.detail),
        editField("Reception", "celebration.reception.label", wedding.celebration.reception.label),
        editField("Reception time", "celebration.reception.time", wedding.celebration.reception.time),
        editField("Reception place", "celebration.reception.place", wedding.celebration.reception.place),
        editArea("Reception words", "celebration.reception.detail", wedding.celebration.reception.detail),
        editField("Attire label", "celebration.attire.label", wedding.celebration.attire.label),
        editArea("Attire", "celebration.attire.text", wedding.celebration.attire.text),
        editArea("Note", "celebration.note", wedding.celebration.note || "")
      ]) +
      editBlock("Location", [
        editField("Heading", "place.heading", wedding.place.heading),
        editField("Venue", "venue.name", wedding.venue.name),
        editField("Street", "venue.street", wedding.venue.street),
        editArea("Venue note", "place.note", wedding.place.note || ""),
        editField("Maps label", "venue.mapLabel", wedding.venue.mapLabel),
        editField("Maps link", "venue.mapUrl", wedding.venue.mapUrl),
        editField("Waze label", "place.wazeLabel", wedding.place.wazeLabel),
        editField("Waze link", "place.wazeUrl", wedding.place.wazeUrl),
        editTimeline(wedding.place.timeline)
      ]) +
      editBlock("Reply, wishes, and closing", [
        editField("Reply heading", "rsvp.heading", wedding.rsvp.heading),
        editArea("Reply introduction", "rsvp.intro", wedding.rsvp.intro),
        editArea("Reply note", "rsvp.note", wedding.rsvp.note || ""),
        editField("Wishes heading", "guestbook.heading", wedding.guestbook.heading),
        editArea("Wishes introduction", "guestbook.intro", wedding.guestbook.intro),
        editArea("Thank you", "closing.thankYou", wedding.closing.thankYou),
        editField("Prayer label", "closing.prayerLabel", wedding.closing.prayerLabel),
        editArea("Closing prayer", "closing.prayer", wedding.closing.prayer),
        editField("Sign-off", "closing.closing", wedding.closing.closing),
        editArea("Closing note", "closing.note", wedding.closing.note || ""),
        editField("Nav: location", "nav.location", wedding.nav.location),
        editField("Nav: wishes", "nav.wishes", wedding.nav.wishes),
        editField("Nav: reply", "nav.rsvp", wedding.nav.rsvp)
      ]) +
      '<div class="editor-actions">' +
      '<button class="button" type="submit">Save</button>' +
      '<button class="text-button" id="edit-reset" type="button">Use the file again</button>' +
      '<button class="text-button" id="edit-close" type="button">Close</button>' +
      "</div></form>";
    var form = card.querySelector("#edit-form");
    form.addEventListener("submit", saveEditor);
    card.querySelector("#edit-close").addEventListener("click", closeEditor);
    card.querySelector("#edit-reset").addEventListener("click", resetEditor);
    card.scrollTop = 0;
    shellScroll();
  }

  function shellScroll() {
    var shell = document.getElementById("card-editor");
    if (shell) shell.scrollTop = 0;
  }

  function saveEditor(event) {
    event.preventDefault();
    var data = collectEditor(event.target);
    writeStore("wedding-card-published", data);
    writeStore("wedding-card-draft", data);
    paint(mergeWedding(base, data), true);
    var note = document.getElementById("edit-save-note");
    if (note) {
      note.hidden = false;
      note.textContent = "Saved in this browser.";
    }
  }

  function resetEditor() {
    localStorage.removeItem("wedding-card-published");
    localStorage.removeItem("wedding-card-draft");
    localStorage.removeItem("wedding-card-edits");
    paint(mergeWedding(base, null), true);
    showEditFields();
    var note = document.getElementById("edit-save-note");
    if (note) {
      note.hidden = false;
      note.textContent = "The invitation is using content.js again.";
    }
  }

  function collectEditor(form) {
    var data = { place: { timeline: [{}, {}, {}, {}] } };
    Array.prototype.forEach.call(form.elements, function (element) {
      if (!element.name) return;
      if (element.name.indexOf("timeline.") === 0) {
        var parts = element.name.split(".");
        var row = data.place.timeline[Number(parts[1])];
        row[parts[2]] = element.value;
        return;
      }
      setEditorPath(data, element.name, element.value);
    });
    data.place.timeline = data.place.timeline.filter(function (item) {
      return item.time || item.title || item.detail;
    });
    return data;
  }

  function setEditorPath(target, path, value) {
    var parts = path.split(".");
    var cursor = target;
    var index;
    for (index = 0; index < parts.length - 1; index += 1) {
      if (!cursor[parts[index]] || typeof cursor[parts[index]] !== "object") cursor[parts[index]] = {};
      cursor = cursor[parts[index]];
    }
    cursor[parts[parts.length - 1]] = value;
  }

  function editBlock(title, parts) {
    return "<fieldset><legend>" + esc(title) + "</legend>" + parts.join("") + "</fieldset>";
  }

  function editField(label, name, value) {
    return (
      '<label class="editor-field"><span>' + esc(label) + "</span>" +
      '<input name="' + esc(name) + '" value="' + esc(value) + '" autocomplete="off"></label>'
    );
  }

  function editArea(label, name, value) {
    return (
      '<label class="editor-field"><span>' + esc(label) + "</span>" +
      '<textarea name="' + esc(name) + '" rows="3">' + esc(value) + "</textarea></label>"
    );
  }

  function editTimeline(items) {
    var rows = "";
    var index;
    for (index = 0; index < 4; index += 1) {
      var item = (items && items[index]) || { time: "", title: "", detail: "" };
      rows +=
        editField("Programme " + (index + 1) + " time", "timeline." + index + ".time", item.time || "") +
        editField("Programme " + (index + 1) + " title", "timeline." + index + ".title", item.title || "") +
        editField("Programme " + (index + 1) + " detail", "timeline." + index + ".detail", item.detail || "");
    }
    return rows;
  }

  function hashText(value) {
    var data = new TextEncoder().encode(String(value || ""));
    return crypto.subtle.digest("SHA-256", data).then(function (buffer) {
      return Array.prototype.map.call(new Uint8Array(buffer), function (byte) {
        return byte.toString(16).padStart(2, "0");
      }).join("");
    });
  }

  function sameText(left, right) {
    if (left.length !== right.length) return false;
    var diff = 0;
    var index;
    for (index = 0; index < left.length; index += 1) diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
    return diff === 0;
  }

  function safeUrl(url) {
    var value = String(url || "").trim();
    if (!/^https?:\/\//i.test(value)) return "";
    try {
      var parsed = new URL(value);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.href;
    } catch (error) {
      return "";
    }
    return "";
  }
})();
