(function () {
  var base = window.WEDDING;
  var root = document.getElementById("invitation");
  var SCENE_IDS = ["opening", "couple", "celebration", "closing"];
  /* Admin preview canvas — all saved text x/y gaps are authored in this space */
  var DESIGN_W = 390;
  var DESIGN_H = 844;
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
    if (root) root.textContent = "Jemputan tidak dapat dibaca. Semak content.js.";
    return;
  }

  var keptOpen = false;

  function boot() {
    paint(currentWedding(), false);
  }

  function paint(wedding, keepOpen) {
    keptOpen = keepOpen || document.documentElement.classList.contains("is-open");
    if (wedding.textBoxes && !Array.isArray(wedding.textBoxes)) wedding.textBoxes = [];
    if (wedding.widgets && !Array.isArray(wedding.widgets)) wedding.widgets = [];
    var storeDirty = false;
    if (resetBrokenPositions(wedding)) storeDirty = true;
    if (fixCardCopy(wedding)) storeDirty = true;
    if (storeDirty) {
      try {
        writeStore("wedding-card-draft", wedding);
        writeStore("wedding-card-published", wedding);
      } catch (error) {}
    }
    document.title = wedding.partnerOne + " & " + wedding.partnerTwo;
    var description = document.querySelector('meta[name="description"]');
    if (description) {
      description.setAttribute(
        "content",
        "Anda dijemput ke walimatul urus " + wedding.partnerOne + " dan " + wedding.partnerTwo + "."
      );
    }
    root.innerHTML = renderCard(wedding);
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
    bindFieldEdit();
    if (reduce || keptOpen) document.documentElement.classList.add("is-open");
    if (reduce) document.documentElement.classList.remove("will-open");
    /* Apply sizes/positions after layout — zero-size scenes were corrupting x/y clamps */
    window.requestAnimationFrame(function () {
      applyType(wedding);
      window.requestAnimationFrame(function () {
        applyType(wedding);
      });
    });
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== window.location.origin) return;
    if (!event.data || typeof event.data !== "object") return;
    if (event.data.type === "wedding-enable-edit") {
      try { sessionStorage.setItem("wedding-admin-open", "yes"); } catch (error) {}
      document.documentElement.classList.add("is-field-edit");
      paint(currentWedding(), true);
      bindFieldEdit();
      return;
    }
    if (!preview || event.data.type !== "wedding-preview") return;
    var payload = event.data.payload;
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      payload = syncDraftPayload(payload);
      try {
        writeStore("wedding-card-draft", payload);
        writeStore("wedding-card-published", payload);
      } catch (error) {}
      paint(mergeWedding(base, payload), true);
      return;
    }
    paint(currentWedding(), true);
  });

  window.addEventListener("storage", function (event) {
    if (!event.key) return;
    if (
      event.key !== "wedding-card-draft" &&
      event.key !== "wedding-card-published"
    ) return;
    var adminOpen = false;
    try {
      adminOpen = sessionStorage.getItem("wedding-admin-open") === "yes";
    } catch (error) {}
    /* Only admin/preview should hot-reload from browser draft */
    if (preview || adminOpen) paint(currentWedding(), true);
  });

  boot();
  window.addEventListener("resize", function () {
    shieldNames();
    /* Re-apply saved gaps after rotate / viewport changes */
    window.requestAnimationFrame(function () {
      applyType(currentWedding());
    });
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      shieldNames();
      applyType(currentWedding());
    });
  }

  function syncDraftPayload(payload) {
    var existing = readStore("wedding-card-draft") || readStore("wedding-card-published") || {};
    if (!Array.isArray(payload.textBoxes) && Array.isArray(existing.textBoxes)) {
      payload.textBoxes = existing.textBoxes;
    }
    if (!Array.isArray(payload.widgets) && Array.isArray(existing.widgets)) {
      payload.widgets = existing.widgets;
    }
    if (!payload.textStyle && existing.textStyle) {
      payload.textStyle = existing.textStyle;
    } else if (payload.textStyle && existing.textStyle) {
      payload.textStyle = mergeStyleTree(cloneTree(existing.textStyle), payload.textStyle);
    }
    return payload;
  }

  function currentWedding() {
    var adminOpen = false;
    try {
      adminOpen = sessionStorage.getItem("wedding-admin-open") === "yes";
    } catch (error) {}
    /* Admin / iframe preview: use browser draft so live edits show. */
    if (preview || adminOpen) {
      var extra =
        readStore("wedding-card-draft") ||
        readStore("wedding-card-published") ||
        readStore("wedding-card-edits");
      return mergeWedding(base, extra);
    }
    /* Guests (localhost + GitHub): content.js only — publish matches this view */
    return mergeWedding(base, null);
  }

  function sectionPetals(sceneId) {
    if (reduce || sceneId === "opening") return "";
    var mobile = false;
    try {
      mobile = window.matchMedia("(max-width: 720px), (pointer: coarse)").matches;
    } catch (error) {
      mobile = false;
    }
    var columns = mobile ? [12, 84, 20, 88] : [8, 16, 24, 78, 86, 94, 12, 88];
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
      '<nav class="dock" aria-label="Jemputan">' +
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
    if (id === "place") return "";
    if (id === "closing") return renderGuestbook(wedding) + renderClosing(wedding);
    return "";
  }

  function renderTextBoxes(wedding, sceneId) {
    var list = Array.isArray(wedding.textBoxes) ? wedding.textBoxes : [];
    var boxes = list.filter(function (box) {
      return box && box.scene === sceneId && box.id;
    });
    if (!boxes.length) return "";
    /* In-flow so left / center / right align won't stack over other text */
    return boxes.map(function (box) {
      return (
        '<p class="user-text-box line" data-field="textbox.' + esc(box.id) + '">' +
        esc(box.text || "Teks baharu") +
        "</p>"
      );
    }).join("");
  }

  function renderWidgets(wedding, sceneId) {
    var list = Array.isArray(wedding.widgets) ? wedding.widgets : [];
    var items = list.filter(function (item) {
      if (!item || !item.id || item.scene !== sceneId || !item.type) return false;
      /* Celebration already has native Maps / Waze / countdown — skip duplicates */
      if (
        sceneId === "celebration" &&
        (item.type === "map" || item.type === "waze" || item.type === "countdown")
      ) {
        return false;
      }
      return true;
    });
    if (!items.length) return "";
    return (
      '<div class="widget-layer">' +
      items.map(function (item) {
        return renderWidgetItem(wedding, item);
      }).join("") +
      "</div>"
    );
  }

  function renderWidgetItem(wedding, item) {
    var id = esc(item.id);
    var type = String(item.type || "");
    if (type === "map") {
      var map = safeUrl(wedding.venue && wedding.venue.mapUrl);
      var mapLabel = (wedding.venue && wedding.venue.mapLabel) || "Google Maps";
      if (!map) {
        return '<p class="user-widget user-widget-link line" data-field="widget.' + id + '">' + esc(mapLabel) + "</p>";
      }
      return (
        '<a class="user-widget user-widget-link text-link line" data-field="widget.' + id + '" href="' + esc(map) +
        '" target="_blank" rel="noopener noreferrer">' + esc(mapLabel) + "</a>"
      );
    }
    if (type === "waze") {
      var waze = safeUrl(wedding.place && wedding.place.wazeUrl);
      var wazeLabel = (wedding.place && wedding.place.wazeLabel) || "Waze";
      if (!waze) {
        return '<p class="user-widget user-widget-link line" data-field="widget.' + id + '">' + esc(wazeLabel) + "</p>";
      }
      return (
        '<a class="user-widget user-widget-link text-link line" data-field="widget.' + id + '" href="' + esc(waze) +
        '" target="_blank" rel="noopener noreferrer">' + esc(wazeLabel) + "</a>"
      );
    }
    if (type === "countdown") {
      return (
        '<div class="user-widget user-widget-countdown line" data-field="widget.' + id + '">' +
        countdownBlock(wedding, true) +
        "</div>"
      );
    }
    return "";
  }

  function withTextBoxes(html, wedding, sceneId) {
    if (!html) return html;
    var flowBoxes = renderTextBoxes(wedding, sceneId);
    var widgets = renderWidgets(wedding, sceneId);
    if (flowBoxes) {
      /* Place custom text after the first block in scene-copy (under the heading) */
      var copyMatch = html.match(/<div class="scene-copy[^"]*">/);
      if (copyMatch) {
        var start = copyMatch.index + copyMatch[0].length;
        var afterFirst = html.indexOf("</", start);
        if (afterFirst !== -1) {
          var firstEnd = html.indexOf(">", afterFirst);
          if (firstEnd !== -1) {
            html = html.slice(0, firstEnd + 1) + flowBoxes + html.slice(firstEnd + 1);
          } else {
            html = html.slice(0, start) + flowBoxes + html.slice(start);
          }
        } else {
          html = html.slice(0, start) + flowBoxes + html.slice(start);
        }
      } else {
        html += flowBoxes;
      }
    }
    if (!widgets) return html;
    var sectionClose = html.lastIndexOf("</section>");
    if (sectionClose === -1) return html + widgets;
    return html.slice(0, sectionClose) + widgets + html.slice(sectionClose);
  }

  function renderOpening(wedding) {
    var date = wedding.date;
    var open = wedding.opening || {};
    var nameOne = open.nameOne || wedding.partnerOne;
    var nameTwo = open.nameTwo || wedding.partnerTwo;
    var amp = open.amp || "&";
    /* edit25h cover: name one → & → name two (letter-by-letter). Admin: plain text. */
    var editNames = canLiveEdit();
    var nameOneHtml = editNames ? esc(nameOne) : letters(nameOne, 2.25);
    var nameTwoHtml = editNames
      ? esc(nameTwo)
      : letters(nameTwo, ampDelay(nameOne, 2.25) + 0.12);
    var ampHtml = editNames
      ? esc(amp)
      : (
        '<span class="letter" style="animation-delay:' +
        ampDelay(nameOne, 2.25).toFixed(2) +
        's">' + esc(amp) + "</span>"
      );
    return withTextBoxes(
      '<section class="scene scene-opening" id="opening">' +
      corners("opening") +
      '<div class="opening-zoom">' +
      '<div class="scene-copy opening-copy">' +
      monogramMark(wedding, "opening-line t-mono") +
      '<p class="kicker opening-line t-kicker" data-field="opening.kicker">' + esc(open.kicker) + "</p>" +
      '<h1 class="opening-line t-name">' +
      '<span class="script-name" data-field="opening.nameOne">' + nameOneHtml + "</span>" +
      /* Same data-field on guest + admin so amp font/size follow admin styles */
      '<span class="script-amp" data-field="opening.amp">' + ampHtml + "</span>" +
      '<span class="sr-only"> and </span>' +
      '<span class="script-name" data-field="opening.nameTwo">' + nameTwoHtml + "</span></h1>" +
      '<div class="date-block opening-line t-date">' +
      '<p class="weekday" data-field="date.weekday">' + esc(date.weekday) + "</p>" +
      '<p class="cover-date" data-field="opening.dateLine">' +
      esc(open.dateLine || [date.day, date.month, date.year].filter(Boolean).join(".")) +
      "</p>" +
      '<p class="clock" data-field="date.time">' + esc(date.time) + "</p></div>" +
      coverVerse(wedding) +
      '<button class="button continue" type="button" id="continue" data-field="opening.continueLabel">' + esc(wedding.opening.continueLabel) + "</button>" +
      "</div></div></section>",
      wedding,
      "opening"
    );
  }

  function renderCouple(wedding) {
    return withTextBoxes(
      '<section class="scene scene-couple" id="couple">' +
      corners("couple") +
      sectionPetals("couple") +
      '<div class="scene-copy">' +
      '<p class="kicker line" data-field="couple.kicker">' + esc(wedding.couple.kicker) + "</p>" +
      '<h2 class="script-name line" data-field="partnerOne">' + esc(wedding.partnerOne) + "</h2>" +
      '<p class="person-line line" data-field="couple.oneLine">' + esc(wedding.couple.oneLine) + "</p>" +
      '<p class="script-amp line" data-field="couple.amp">' + esc((wedding.couple && wedding.couple.amp) || "&") + "</p>" +
      '<h2 class="script-name line" data-field="partnerTwo">' + esc(wedding.partnerTwo) + "</h2>" +
      '<p class="person-line line" data-field="couple.twoLine">' + esc(wedding.couple.twoLine) + "</p>" +
      sampleLine(wedding.couple.note, "couple.note") +
      "</div></section>",
      wedding,
      "couple"
    );
  }

  function mapWazeLinks(wedding) {
    var venue = wedding.venue || {};
    var place = wedding.place || {};
    var map = safeUrl(venue.mapUrl);
    var waze = safeUrl(place.wazeUrl);
    var links = "";
    if (map) {
      links += '<a class="text-link" data-field="venue.mapLabel" href="' + esc(map) + '" target="_blank" rel="noopener noreferrer">' +
        esc(venue.mapLabel || "Google Maps") + '<span class="sr-only"> (dibuka dalam tab baharu)</span></a>';
    }
    if (waze) {
      links += '<a class="text-link" data-field="place.wazeLabel" href="' + esc(waze) + '" target="_blank" rel="noopener noreferrer">' +
        esc(place.wazeLabel || "Waze") + '<span class="sr-only"> (dibuka dalam tab baharu)</span></a>';
    }
    return links ? '<div class="place-links line">' + links + "</div>" : "";
  }

  function renderCelebration(wedding) {
    var item = wedding.celebration;
    var dateLine = item.dateLine || (
      wedding.date.weekday + " " + wedding.date.day + " " + wedding.date.month + " " +
      wedding.date.year + " · " + wedding.date.time
    );
    return withTextBoxes(
      '<section class="scene scene-celebration section" id="celebration">' +
      corners("celebration") +
      sectionPetals("celebration") +
      '<div class="scene-copy">' +
      '<h2 class="line" data-field="celebration.heading">' + esc(item.heading) + "</h2>" +
      '<p class="section-sub line" data-field="celebration.dateLine">' + esc(dateLine) + "</p>" +
      '<div class="stack">' + detailBlock(item.ceremony, "celebration.ceremony") + detailBlock(item.reception, "celebration.reception") + "</div>" +
      attireBlock(item.attire) +
      '<div class="celebration-tools">' +
      mapWazeLinks(wedding) +
      countdownBlock(wedding) +
      "</div>" +
      sampleLine(item.note, "celebration.note") +
      "</div></section>",
      wedding,
      "celebration"
    );
  }

  function renderPlace(wedding) {
    var place = wedding.place;
    var timeline = (place.timeline || []).map(function (item, index) {
      return (
        "<li><p class=\"timeline-time\" data-field=\"timeline." + index + ".time\">" + esc(item.time) + "</p>" +
        "<p class=\"timeline-title\" data-field=\"timeline." + index + ".title\">" + esc(item.title) + "</p>" +
        "<p class=\"timeline-detail\" data-field=\"timeline." + index + ".detail\">" + esc(item.detail) + "</p></li>"
      );
    }).join("");
    return withTextBoxes(
      '<section class="scene scene-place section" id="place">' +
      corners("place") +
      sectionPetals("place") +
      '<div class="scene-copy">' +
      (timeline ? '<ol class="timeline line">' + timeline + "</ol>" : "") +
      '<div class="photo-frame" id="photo-frame"></div>' +
      '<p class="photo-placeholder" id="photo-placeholder" data-field="place.photoPlaceholder">' + esc(place.photoPlaceholder || "") + "</p>" +
      "</div></section>",
      wedding,
      "place"
    );
  }

  function renderReply(wedding) {
    var rsvp = wedding.rsvp;
    return withTextBoxes(
      '<section class="scene scene-reply section" id="reply">' +
      corners("reply") +
      sectionPetals("reply") +
      '<div class="scene-copy">' +
      '<h2 class="line" data-field="rsvp.heading">' + esc(rsvp.heading) + "</h2>" +
      '<p class="section-sub line" data-field="rsvp.intro">' + esc(rsvp.intro) + "</p>" +
      sampleLine(rsvp.note, "rsvp.note") +
      '<form id="rsvp-form" novalidate>' +
      '<p class="form-error" id="rsvp-error" role="alert" hidden></p>' +
      '<label class="field"><span data-field="rsvp.nameLabel">' + esc(rsvp.nameLabel) + "</span>" +
      '<input id="guest-name" name="name" type="text" autocomplete="name" maxlength="80" required placeholder="' +
      esc(rsvp.namePlaceholder || "") + '" data-field="rsvp.namePlaceholder"></label>' +
      '<fieldset><legend data-field="rsvp.attendanceLabel">' + esc(rsvp.attendanceLabel) + "</legend>" +
      '<div class="choices">' +
      '<label class="choice"><input type="radio" name="attendance" value="yes"><span data-field="rsvp.acceptLabel">' + esc(rsvp.acceptLabel) + "</span></label>" +
      '<label class="choice"><input type="radio" name="attendance" value="no"><span data-field="rsvp.declineLabel">' + esc(rsvp.declineLabel) + "</span></label>" +
      "</div></fieldset>" +
      '<label class="field"><span data-field="rsvp.noteLabel">' + esc(rsvp.noteLabel) + "</span>" +
      '<textarea id="guest-note" name="note" maxlength="500" placeholder="' + esc(rsvp.notePlaceholder || "") + '" data-field="rsvp.notePlaceholder"></textarea></label>' +
      '<button class="button" type="submit" data-field="rsvp.submitLabel">' + esc(rsvp.submitLabel) + "</button>" +
      '<p class="local-note" data-field="rsvp.localNote">' + esc(rsvp.localNote) + "</p></form>" +
      '<div class="confirm" id="rsvp-confirm" hidden>' +
      '<p class="confirm-kicker" data-field="rsvp.confirmedKicker">' + esc(rsvp.confirmedKicker) + "</p>" +
      '<p class="confirm-message" id="rsvp-message" tabindex="-1" role="status"></p>' +
      '<p class="echo" id="rsvp-echo" hidden></p>' +
      '<button class="text-button" id="rsvp-edit" type="button" data-field="rsvp.editLabel">' + esc(rsvp.editLabel) + "</button></div>" +
      "</div></section>",
      wedding,
      "reply"
    );
  }

  function renderGuestbook(wedding) {
    var book = wedding.guestbook;
    return withTextBoxes(
      '<section class="scene scene-wishes section" id="wishes">' +
      corners("wishes") +
      sectionPetals("wishes") +
      '<div class="scene-copy">' +
      '<h2 class="line" data-field="guestbook.heading">' + esc(book.heading) + "</h2>" +
      '<p class="section-sub line" data-field="guestbook.intro">' + esc(book.intro) + "</p>" +
      '<form id="guestbook-form" novalidate>' +
      '<p class="form-error" id="book-error" role="alert" hidden></p>' +
      '<label class="field line"><span data-field="guestbook.nameLabel">' + esc(book.nameLabel) + "</span>" +
      '<input name="name" type="text" maxlength="80" autocomplete="name" placeholder="' + esc(book.namePlaceholder || "") + '" data-field="guestbook.namePlaceholder"></label>' +
      '<fieldset class="line"><legend data-field="guestbook.attendanceLabel">' + esc(book.attendanceLabel || "Adakah anda akan hadir?") + "</legend>" +
      '<div class="choices">' +
      '<label class="choice"><input type="radio" name="attendance" value="yes"><span data-field="guestbook.acceptLabel">' +
      esc(book.acceptLabel || "Hadir") + "</span></label>" +
      '<label class="choice"><input type="radio" name="attendance" value="no"><span data-field="guestbook.declineLabel">' +
      esc(book.declineLabel || "Tidak Hadir") + "</span></label>" +
      "</div></fieldset>" +
      '<label class="field line"><span data-field="guestbook.messageLabel">' + esc(book.messageLabel) + "</span>" +
      '<textarea name="message" maxlength="400" placeholder="' + esc(book.messagePlaceholder || "") + '" data-field="guestbook.messagePlaceholder"></textarea></label>' +
      '<button class="button line" type="submit" data-field="guestbook.submitLabel">' + esc(book.submitLabel) + "</button></form>" +
      '<div class="wishes" id="wish-list" aria-live="polite"></div>' +
      "</div></section>",
      wedding,
      "wishes"
    );
  }

  function renderClosing(wedding) {
    var item = wedding.closing || {};
    var signature = String(item.signature || "").trim() ||
      (firstName(wedding.partnerOne) + " & " + firstName(wedding.partnerTwo));
    return withTextBoxes(
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
      '<p class="signature line" data-field="closing.signature">' + esc(signature) + "</p>" +
      "</div></section>",
      wedding,
      "closing"
    );
  }

  function sampleLine(text, field) {
    if (!text) return "";
    return '<p class="sample-note line" data-field="' + esc(field) + '">' + esc(text) + "</p>";
  }

  function attireBlock(attire) {
    attire = attire || {};
    var label = String(attire.label || "").trim();
    var text = String(attire.text || "").trim();
    if (!label && !text) return "";
    return (
      '<p class="attire line">' +
      (label ? '<span data-field="celebration.attire.label">' + esc(label) + "</span>" : "") +
      (text ? ' <span data-field="celebration.attire.text">' + esc(text) + "</span>" : "") +
      "</p>"
    );
  }

  function detailBlock(item, field) {
    item = item || {};
    var parts = "";
    if (String(item.label || "").trim()) {
      parts += '<h3 class="line" data-field="' + field + '.label">' + esc(item.label) + "</h3>";
    }
    if (String(item.time || "").trim()) {
      parts += '<p class="detail-time line" data-field="' + field + '.time">' + esc(item.time) + "</p>";
    }
    if (String(item.place || "").trim()) {
      parts += '<p class="detail-place line" data-field="' + field + '.place">' + esc(item.place) + "</p>";
    }
    if (String(item.detail || "").trim()) {
      parts += '<p class="detail-copy line" data-field="' + field + '.detail">' + esc(item.detail) + "</p>";
    }
    if (!parts) return "";
    return '<article class="detail">' + parts + "</article>";
  }

  function sectionLinks(wedding, withIcons) {
    var nav = wedding.nav || {};
    return (
      linkItem("#contact", nav.contact || "Hubungi", "contact", withIcons) +
      linkItem("#celebration", nav.location || "Lokasi", "place", withIcons) +
      linkItem("#wishes", nav.wishes || "Ucapan", "wish", withIcons)
    );
  }

  function linkItem(href, label, icon, withIcons, title) {
    var tip = title ? ' title="' + esc(title) + '"' : "";
    var field = icon === "contact" ? "nav.contact" : icon === "place" ? "nav.location" : icon === "rsvp" ? "nav.rsvp" : "nav.wishes";
    return '<a href="' + href + '"' + tip + ">" + (withIcons ? dockIcon(icon) : "") + '<span data-field="' + field + '">' + esc(label) + "</span></a>";
  }

  function countdownBlock(wedding, asClone) {
    var cd = wedding.countdown || {};
    var done = cd.done || "Alhamdulillah, hari bahagia telah tiba.";
    var fieldAttr = asClone
      ? function () { return ""; }
      : function (path) { return ' data-field="' + path + '"'; };
    return (
      '<div class="countdown' + (asClone ? "" : " line") + '"' +
      (asClone ? "" : ' data-field="countdown.box"') +
      ">" +
      '<div class="countdown-grid" aria-live="polite">' +
      '<div class="cd-col"><span class="cd-num" data-cd="days">00</span><span class="cd-lab"' + fieldAttr("countdown.daysLabel") + ">" + esc(cd.daysLabel || "Hari") + "</span></div>" +
      '<div class="cd-col"><span class="cd-num" data-cd="hours">00</span><span class="cd-lab"' + fieldAttr("countdown.hoursLabel") + ">" + esc(cd.hoursLabel || "Jam") + "</span></div>" +
      '<div class="cd-col"><span class="cd-num" data-cd="mins">00</span><span class="cd-lab"' + fieldAttr("countdown.minsLabel") + ">" + esc(cd.minsLabel || "Minit") + "</span></div>" +
      '<div class="cd-col"><span class="cd-num" data-cd="secs">00</span><span class="cd-lab"' + fieldAttr("countdown.secsLabel") + ">" + esc(cd.secsLabel || "Saat") + "</span></div>" +
      "</div>" +
      '<p class="countdown-done"' + (asClone ? "" : ' id="countdown-done"') + " hidden" + fieldAttr("countdown.done") + ">" + esc(done) + "</p>" +
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
      name: String(contact.name || wedding.partnerOne || "Hubungi").trim(),
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
        '<h2' + (index === 0 ? ' id="contact-person"' : "") + ' data-field="contact.people.' + index + '.name">' + esc(person.name || "Hubungi") + "</h2>" +
        phone +
        "</article>"
      );
    }).join("");
    return (
      '<div class="contact-sheet" id="contact-sheet" aria-hidden="true">' +
      '<button class="contact-shade" type="button" aria-label="Close contact"></button>' +
      '<div class="contact-panel" role="dialog" aria-modal="true" aria-labelledby="contact-person">' +
      '<button class="contact-close" type="button" aria-label="Close">Close</button>' +
      '<p class="contact-kicker" data-field="nav.contact">' + esc((wedding.nav && wedding.nav.contact) || "Hubungi") + "</p>" +
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
    /* Disabled: translating the scene made guest layout diverge from admin positions */
    clearSceneSeat();
    if (scene) scene.classList.add("is-tabbed");
  }

  function clearSceneSeat() {
    document.querySelectorAll(".scene.is-tabbed").forEach(function (el) {
      el.classList.remove("is-tabbed");
    });
    document.querySelectorAll(".scene-copy, .text-box-layer, .widget-layer").forEach(function (el) {
      el.style.transform = "";
      el.style.transition = "";
    });
  }

  function startCountdown(wedding) {
    var grids = document.querySelectorAll(".countdown-grid");
    if (!grids.length) return;
    var target = weddingDate(wedding.date || {});
    window.clearInterval(startCountdown.timer);
    function setPair(root, key, value) {
      var el = root.querySelector('[data-cd="' + key + '"]');
      if (el) el.textContent = pad2(value);
    }
    function paintAll(days, hours, mins, secs, finished) {
      Array.prototype.forEach.call(grids, function (grid) {
        setPair(grid, "days", days);
        setPair(grid, "hours", hours);
        setPair(grid, "mins", mins);
        setPair(grid, "secs", secs);
        grid.hidden = !!finished;
        var host = grid.closest(".countdown") || grid.parentElement;
        var done = host && host.querySelector(".countdown-done");
        if (done) done.hidden = !finished;
      });
    }
    function tick() {
      if (!isFinite(target.getTime())) {
        paintAll(0, 0, 0, 0, false);
        return;
      }
      var diff = target.getTime() - Date.now();
      if (diff <= 0) {
        paintAll(0, 0, 0, 0, true);
        window.clearInterval(startCountdown.timer);
        return;
      }
      var total = Math.floor(diff / 1000);
      paintAll(
        Math.floor(total / 86400),
        Math.floor((total % 86400) / 3600),
        Math.floor((total % 3600) / 60),
        total % 60,
        false
      );
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
      /* Seal softens first, then flaps part — reveal card as the split opens */
      window.setTimeout(function () {
        document.documentElement.classList.add("envelope-open");
        window.clearTimeout(bindContinue.enableTimer);
        bindContinue.enableTimer = window.setTimeout(function () {
          var button = document.getElementById("continue");
          if (button) button.disabled = false;
        }, 4200);
      }, 420);
      window.setTimeout(function () {
        stage.classList.add("is-gone");
      }, 3100);
      window.clearTimeout(openFromCover.finalizeTimer);
      openFromCover.finalizeTimer = window.setTimeout(function () {
        openFromCover.finalizeTimer = null;
        finishCoverReveal(true);
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

  function finishCoverReveal(pinIfStillOnCover) {
    document.documentElement.classList.add("is-open", "show-nav");
    document.documentElement.classList.remove("will-open");
    if (pinIfStillOnCover) {
      var opening = document.getElementById("opening");
      var onCover = opening && opening.getBoundingClientRect().top > -40 && window.scrollY < 60;
      if (onCover) window.scrollTo(0, 0);
    }
    window.requestAnimationFrame(shieldNames);
  }

  function openFromCover() {
    /* Cancel delayed cover finalize — its scrollTo(0,0) was yanking users back after TERUSKAN */
    window.clearTimeout(openFromCover.finalizeTimer);
    openFromCover.finalizeTimer = null;
    finishCoverReveal(false);
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
        var scene = entry.target;
        var visible = entry.isIntersecting && entry.intersectionRatio >= 0.28;
        if (!visible) {
          scene.classList.remove("is-in");
          return;
        }
        if (scene.classList.contains("is-in")) return;
        playSceneLines(scene);
      });
    }, { threshold: [0, 0.28, 0.55, 0.85] });
    Array.prototype.forEach.call(scenes, function (scene) {
      if (!scene.classList.contains("scene-opening")) motionWatcher.observe(scene);
    });
  }

  function sceneLineNodes(scene) {
    return Array.prototype.filter.call(scene.querySelectorAll(".line"), function (el) {
      if (el.getAttribute("aria-hidden") === "true") return false;
      /* Skip nested .line inside another .line */
      var parent = el.parentElement;
      while (parent && parent !== scene) {
        if (parent.classList && parent.classList.contains("line")) return false;
        parent = parent.parentElement;
      }
      return true;
    });
  }

  function staggerSceneLines(scene) {
    var lines = sceneLineNodes(scene);
    /* Visual top → bottom (offsetTop breaks across nested tools / absolute widgets) */
    lines.sort(function (a, b) {
      var ar = a.getBoundingClientRect();
      var br = b.getBoundingClientRect();
      var top = ar.top - br.top;
      if (Math.abs(top) > 1) return top;
      return ar.left - br.left;
    });
    lines.forEach(function (line, index) {
      line.style.animationDelay = (0.12 + index * 0.22) + "s";
    });
    return lines;
  }

  function playSceneLines(scene) {
    if (!scene) return;
    staggerSceneLines(scene);
    scene.classList.remove("is-in");
    void scene.offsetWidth;
    scene.classList.add("is-in");
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
        error.textContent = book.errorAttendance || "Sila maklumkan sama ada anda dapat hadir.";
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

    var wishScrollTimer = null;

    function renderWishes() {
      window.clearTimeout(wishScrollTimer);
      var wishes = readWishes();
      list.textContent = "";
      list.classList.remove("is-scrolling");
      if (!wishes.length) {
        var empty = document.createElement("p");
        empty.className = "wish-empty line";
        empty.textContent = book.empty;
        list.appendChild(empty);
        replayWishesScene();
        return;
      }
      var ordered = wishes.slice().reverse();
      var track = document.createElement("div");
      track.className = "wish-track";
      ordered.forEach(function (wish) {
        track.appendChild(wishCard(wish, true));
      });
      list.appendChild(track);
      replayWishesScene();
      /* Auto-scroll after the top→bottom entrance finishes */
      if (ordered.length > 1 && !reduce) {
        var scene = invitation.querySelector("#wishes");
        var count = scene ? sceneLineNodes(scene).length : ordered.length;
        var delayMs = Math.round((0.12 + count * 0.22 + 1.45) * 1000);
        wishScrollTimer = window.setTimeout(function () {
          enableWishMarquee(ordered);
        }, Math.max(2000, delayMs));
      }
    }

    function enableWishMarquee(ordered) {
      if (!list || !ordered || ordered.length < 2) return;
      list.textContent = "";
      list.classList.add("is-scrolling");
      var track = document.createElement("div");
      track.className = "wish-track";
      function appendCard(wish, hidden) {
        var card = wishCard(wish, false);
        card.style.opacity = "1";
        card.style.animation = "none";
        if (hidden) card.setAttribute("aria-hidden", "true");
        track.appendChild(card);
      }
      ordered.forEach(function (wish) { appendCard(wish, false); });
      ordered.forEach(function (wish) { appendCard(wish, true); });
      list.appendChild(track);
      track.style.setProperty("--wish-scroll-duration", Math.max(14, ordered.length * 4) + "s");
    }

    function replayWishesScene() {
      var scene = invitation.querySelector("#wishes");
      if (!scene) return;
      if (scene.classList.contains("is-in")) playSceneLines(scene);
      else staggerSceneLines(scene);
    }

    function wishCard(wish, animateIn) {
      var item = document.createElement("article");
      item.className = animateIn ? "wish line" : "wish";
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
    var playLabel = wedding.musicPlay || "Mainkan muzik";
    var pauseLabel = wedding.musicPause || "Jeda muzik";
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
    assignStrings(wedding, extra, ["partnerOne", "partnerTwo", "music", "musicPlay", "musicPause", "musicEmpty"]);
    assignGroup(wedding.date, extra.date, ["weekday", "day", "month", "year", "time"]);
    assignGroup(wedding.opening, extra.opening, ["kicker", "nameOne", "nameTwo", "amp", "dateLine", "continueLabel"]);
    assignGroup(wedding.couple, extra.couple, ["kicker", "amp", "oneLine", "twoLine", "note"]);
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
    assignGroup(wedding.closing, extra.closing, ["thankYou", "prayerLabel", "prayer", "closing", "note", "signature"]);
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
    assignGroup(wedding.countdown, extra.countdown, [
      "label", "arrival", "done", "daysLabel", "hoursLabel", "minsLabel", "secsLabel"
    ]);
    assignGroup(wedding.rsvp, extra.rsvp, [
      "heading", "intro", "note", "nameLabel", "namePlaceholder", "attendanceLabel",
      "acceptLabel", "declineLabel", "noteLabel", "notePlaceholder", "submitLabel",
      "localNote", "confirmedKicker", "acceptMessage", "declineMessage", "editLabel",
      "errorName", "errorAttendance"
    ]);
    assignGroup(wedding.guestbook, extra.guestbook, [
      "heading", "intro", "nameLabel", "namePlaceholder", "attendanceLabel",
      "acceptLabel", "declineLabel", "messageLabel", "messagePlaceholder", "submitLabel",
      "empty", "errorName", "errorAttendance", "errorMessage"
    ]);
    if (extra.textStyle && typeof extra.textStyle === "object" && !Array.isArray(extra.textStyle)) {
      wedding.textStyle = mergeStyleTree(cloneTree(wedding.textStyle || {}), extra.textStyle);
    }
    if (Array.isArray(extra.textBoxes)) {
      wedding.textBoxes = extra.textBoxes.map(function (box) {
        if (!box || typeof box !== "object") return null;
        var style = normalizeFieldStyle(box);
        var next = {
          id: String(box.id || ""),
          scene: String(box.scene || "opening"),
          text: String(box.text || ""),
          size: style.size,
          letter: style.letter,
          spacing: style.spacing,
          x: style.x,
          y: style.y,
          font: style.font,
          color: style.color,
          align: style.align
        };
        if (style.fontSizePx) next.fontSizePx = style.fontSizePx;
        return next;
      }).filter(function (box) {
        return box && box.id;
      });
    }
    if (Array.isArray(extra.widgets)) {
      wedding.widgets = extra.widgets.map(function (item) {
        if (!item || typeof item !== "object") return null;
        var type = String(item.type || "");
        if (type !== "map" && type !== "waze" && type !== "countdown") return null;
        return {
          id: String(item.id || ""),
          scene: String(item.scene || "opening"),
          type: type,
          x: String(clampNumber(item.x, -280, 280, 0)),
          y: String(clampNumber(item.y, -280, 280, 0))
        };
      }).filter(function (item) {
        return item && item.id;
      });
    }
    if (Array.isArray(extra.sceneOrder)) wedding.sceneOrder = normalizeOrder(extra.sceneOrder);
    return wedding;
  }

  function isStyleLeaf(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    return (
      "size" in value || "letter" in value || "spacing" in value ||
      "x" in value || "y" in value || "font" in value || "color" in value || "align" in value
    );
  }

  function mergeStyleTree(target, extra) {
    if (!target || typeof target !== "object") target = {};
    if (!extra || typeof extra !== "object" || Array.isArray(extra)) return target;
    Object.keys(extra).forEach(function (key) {
      var value = extra[key];
      if (!value || typeof value !== "object" || Array.isArray(value)) return;
      if (isStyleLeaf(value)) {
        target[key] = Object.assign({}, target[key] || {}, value);
        return;
      }
      if (!target[key] || typeof target[key] !== "object" || Array.isArray(target[key]) || isStyleLeaf(target[key])) {
        target[key] = {};
      }
      mergeStyleTree(target[key], value);
    });
    return target;
  }

  var FONT_CHOICES = [
    { id: "", label: "Asal seksyen" },
    { id: "script", label: "Script (Italianno)" },
    { id: "brush", label: "Brush (Alex Brush)" },
    { id: "display", label: "Display (Marcellus)" },
    { id: "quote", label: "Quote (Cormorant)" },
    { id: "sans", label: "Sans (Manrope)" }
  ];

  function fontFamilyValue(id) {
    if (id === "script") return "var(--script)";
    if (id === "brush") return "var(--brush)";
    if (id === "display") return "var(--display)";
    if (id === "quote") return "var(--quote)";
    if (id === "sans") return "var(--sans)";
    return "";
  }

  function guessFontId(family) {
    var raw = String(family || "").toLowerCase();
    if (raw.indexOf("italianno") !== -1) return "script";
    if (raw.indexOf("alex brush") !== -1) return "brush";
    if (raw.indexOf("marcellus") !== -1) return "display";
    if (raw.indexOf("cormorant") !== -1) return "quote";
    if (raw.indexOf("manrope") !== -1) return "sans";
    return "";
  }

  function cssColorToHex(value) {
    var raw = String(value || "").trim();
    if (!raw) return "";
    if (raw.charAt(0) === "#") {
      if (raw.length === 4) {
        return ("#" + raw.charAt(1) + raw.charAt(1) + raw.charAt(2) + raw.charAt(2) + raw.charAt(3) + raw.charAt(3)).toLowerCase();
      }
      return raw.slice(0, 7).toLowerCase();
    }
    var match = raw.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!match) return "";
    return "#" + [match[1], match[2], match[3]].map(function (part) {
      var hex = Number(part).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    }).join("");
  }

  function captureElementLook(el, style) {
    style = normalizeFieldStyle(style || {});
    var look = {
      size: style.size,
      letter: style.letter,
      spacing: style.spacing,
      font: style.font,
      color: style.color,
      align: style.align || "center",
      x: style.x,
      y: style.y,
      fontSizePx: ""
    };
    if (!el || !window.getComputedStyle) return look;
    var computed = window.getComputedStyle(el);
    var sizePct = clampNumber(style.size, 70, 170, 100);
    var rendered = parseFloat(computed.fontSize);
    if (isFinite(rendered) && rendered > 0) {
      look.fontSizePx = String(Math.round((rendered * 100) / sizePct * 10) / 10);
    }
    if (!look.font) look.font = guessFontId(computed.fontFamily);
    if (!look.color) look.color = cssColorToHex(computed.color);
    if (!look.align || look.align === "") {
      var align = String(computed.textAlign || "");
      if (align === "left" || align === "center" || align === "right") look.align = align;
    }
    return look;
  }

  function normalizeFieldStyle(spec) {
    spec = spec || {};
    var out = {
      size: String(clampNumber(spec.size, 70, 170, 100)),
      letter: String(clampNumber(spec.letter, 70, 180, 100)),
      spacing: String(clampNumber(spec.spacing, 70, 180, 100)),
      x: String(Math.round(clampNumber(spec.x, -600, 600, 0))),
      y: String(Math.round(clampNumber(spec.y, -100, 1200, 0))),
      font: String(spec.font || ""),
      color: String(spec.color || ""),
      align: String(spec.align || "")
    };
    if (spec.fontSizePx != null && spec.fontSizePx !== "") {
      var px = Number(spec.fontSizePx);
      if (isFinite(px) && px > 0) out.fontSizePx = String(Math.round(px * 10) / 10);
    }
    return out;
  }

  function designOnlyStyle(spec) {
    var full = normalizeFieldStyle(spec);
    return {
      size: full.size,
      letter: full.letter,
      spacing: full.spacing,
      font: full.font,
      color: full.color,
      align: full.align,
      x: "0",
      y: "0"
    };
  }

  function textBoxId(path) {
    if (!path || path.indexOf("textbox.") !== 0) return "";
    return path.slice(8);
  }

  function widgetId(path) {
    if (!path || path.indexOf("widget.") !== 0) return "";
    return path.slice(7);
  }

  function findTextBox(wedding, id) {
    var list = Array.isArray(wedding.textBoxes) ? wedding.textBoxes : [];
    var index;
    for (index = 0; index < list.length; index += 1) {
      if (list[index] && list[index].id === id) return list[index];
    }
    return null;
  }

  function findWidget(wedding, id) {
    var list = Array.isArray(wedding.widgets) ? wedding.widgets : [];
    var index;
    for (index = 0; index < list.length; index += 1) {
      if (list[index] && list[index].id === id) return list[index];
    }
    return null;
  }

  function widgetTypeFromPath(path, wedding) {
    if (!path) return "";
    if (path === "venue.mapLabel") return "map";
    if (path === "place.wazeLabel") return "waze";
    if (path.indexOf("countdown.") === 0) return "countdown";
    var id = widgetId(path);
    if (!id) return "";
    var item = findWidget(wedding || currentWedding(), id);
    return item ? String(item.type || "") : "";
  }

  function fieldStyleFor(wedding, path) {
    var boxId = textBoxId(path);
    if (boxId) {
      var box = findTextBox(wedding, boxId);
      return box ? normalizeFieldStyle(box) : normalizeFieldStyle({});
    }
    var wid = widgetId(path);
    if (wid) {
      var widget = findWidget(wedding, wid);
      return widget ? normalizeFieldStyle(widget) : normalizeFieldStyle({});
    }
    return normalizeFieldStyle(pathValue(wedding.textStyle || {}, path) || {});
  }

  function isLayerPath(path) {
    /* Text boxes are in-flow now — only widgets / countdown stay floating */
    return !!widgetId(path) || path === "countdown.box";
  }

  function isPlaceLinkPath(path) {
    return path === "venue.mapLabel" || path === "place.wazeLabel";
  }

  function fixCardCopy(wedding) {
    var dirty = false;
    wedding.opening = wedding.opening || {};
    var cont = String(wedding.opening.continueLabel || "").trim();
    if (!cont || /^click$/i.test(cont)) {
      wedding.opening.continueLabel = "TERUSKAN";
      dirty = true;
    }
    /* Keep Maps + Waze side by side — clear old drag offsets on those labels */
    function clearXY(node) {
      if (!node || typeof node !== "object") return;
      if (Number(node.x) || Number(node.y)) {
        node.x = "0";
        node.y = "0";
        dirty = true;
      }
    }
    wedding.textStyle = wedding.textStyle || {};
    wedding.textStyle.venue = wedding.textStyle.venue || {};
    wedding.textStyle.place = wedding.textStyle.place || {};
    clearXY(wedding.textStyle.venue.mapLabel);
    clearXY(wedding.textStyle.place.wazeLabel);
    return dirty;
  }

  function resetBrokenPositions(wedding) {
    /* Cleanup old absolute offsets that break center / right align */
    try {
      if (localStorage.getItem("wedding-pos-reset-v24") === "1") return false;
    } catch (error) {}
    var dirty = false;
    function walk(node) {
      if (!node || typeof node !== "object" || Array.isArray(node)) return;
      if (node.size != null || node.x != null || node.y != null || node.spacing != null) {
        if (Number(node.x) || Number(node.y)) {
          node.x = "0";
          node.y = "0";
          dirty = true;
        }
        return;
      }
      Object.keys(node).forEach(function (key) { walk(node[key]); });
    }
    walk(wedding.textStyle || {});
    (Array.isArray(wedding.textBoxes) ? wedding.textBoxes : []).forEach(function (box) {
      if (!box) return;
      if (Number(box.x) || Number(box.y)) {
        box.x = "0";
        box.y = "0";
        dirty = true;
      }
    });
    (Array.isArray(wedding.widgets) ? wedding.widgets : []).forEach(function (item) {
      if (!item) return;
      if (Number(item.x) || Number(item.y)) {
        item.x = "0";
        item.y = "0";
        dirty = true;
      }
    });
    try { localStorage.setItem("wedding-pos-reset-v24", "1"); } catch (error) {}
    return dirty || true;
  }

  function applyType(wedding) {
    document.querySelectorAll("[data-field]").forEach(function (el) {
      var path = el.getAttribute("data-field");
      if (!path) return;
      var spec = fieldStyleFor(wedding, path);
      var size = clampNumber(spec.size, 70, 170, 100);
      var spacing = clampNumber(spec.spacing, 70, 180, 100);
      var letter = clampNumber(spec.letter, 70, 180, 100);
      /* Use stored offsets as-is — scene clamping happens only in applyDragOffset */
      var x = Math.round(clampNumber(spec.x, -600, 600, 0));
      var y = Math.round(clampNumber(spec.y, -100, 1200, 0));
      var font = String(spec.font || "");
      var color = String(spec.color || "");
      var align = String(spec.align || "");
      var isBox = !!textBoxId(path);
      var isWidget = !!widgetId(path);
      var isCountdownBox = path === "countdown.box";
      var isPlaceLink = isPlaceLinkPath(path);
      var layer = isLayerPath(path);
      var basePx = Number(spec.fontSizePx);
      /* Maps / Waze stay in one row — never nudge with transforms */
      if (isPlaceLink) {
        x = 0;
        y = 0;
      }
      if (
        !layer &&
        size === 100 && spacing === 100 && letter === 100 &&
        x === 0 && y === 0 && !font && !color && !align
      ) {
        /* Still clear any stale drag transform left from a prior bad paint */
        if (el.dataset.dragPos === "1" || (el.style && el.style.transform)) {
          applyDragOffset(el, 0, 0, false);
        }
        return;
      }
      if (isCountdownBox) {
        applyDragOffset(el, x, y, true);
        return;
      }
      var computed = window.getComputedStyle(el);
      if (isBox && isFinite(basePx) && basePx > 0) {
        el.style.fontSize = Math.round(basePx * size) / 100 + "px";
      } else if (!isWidget && size !== 100) {
        var base = parseFloat(computed.fontSize) || 18;
        el.style.fontSize = Math.round(base * size) / 100 + "px";
      }
      if (!isWidget && letter !== 100) {
        var ls = parseFloat(computed.letterSpacing);
        if (!isFinite(ls) || ls === 0) ls = (parseFloat(computed.fontSize) || 18) * 0.02;
        if (ls) el.style.letterSpacing = Math.round(ls * letter) / 100 + "px";
      }
      if (!isWidget && spacing !== 100) {
        var line = parseFloat(computed.lineHeight);
        if (line) el.style.lineHeight = Math.round(line * spacing) / 100 + "px";
      }
      if (!isWidget) {
        var family = fontFamilyValue(font);
        if (family) {
          el.style.fontFamily = family;
          el.style.fontStyle = font === "quote" ? "italic" : "";
        }
        if (color) el.style.color = color;
        if (align && !isPlaceLink) {
          el.style.textAlign = align;
          /* Full width so center / right align inside the column, not a shrink-wrapped box */
          if (!layer) {
            el.style.display = "block";
            el.style.width = "100%";
            el.style.maxWidth = "100%";
            el.style.boxSizing = "border-box";
            el.style.marginLeft = "0";
            el.style.marginRight = "0";
          }
        }
      }
      applyDragOffset(el, x, y, layer);
    });
  }

  function posLimits(el) {
    var scene = el && el.closest ? el.closest(".scene") : null;
    var box = scene ? scene.getBoundingClientRect() : { width: 0, height: 0 };
    /* Prefer live scene; fall back to admin design canvas so limits stay stable */
    var width = box.width >= 120 ? box.width : DESIGN_W;
    var height = box.height >= 200 ? box.height : DESIGN_H;
    var minX = -Math.round(width / 2 - 20);
    var maxX = Math.round(width / 2 - 20);
    var minY = -Math.round(height * 0.35);
    var maxY = Math.round(height - 100);
    if (minX > maxX) {
      minX = -Math.round(DESIGN_W / 2 - 20);
      maxX = Math.round(DESIGN_W / 2 - 20);
    }
    if (minY > maxY) {
      minY = -Math.round(DESIGN_H * 0.35);
      maxY = Math.round(DESIGN_H - 100);
    }
    return { minX: minX, maxX: maxX, minY: minY, maxY: maxY };
  }

  function applyDragOffset(el, x, y, asLayer, clampToScene) {
    var lim = posLimits(el);
    var rawX = Number(x);
    var rawY = Number(y);
    if (!isFinite(rawX)) rawX = 0;
    if (!isFinite(rawY)) rawY = 0;
    /* Keep true zeros — never let a broken clamp invent offsets */
    if (rawX === 0 && rawY === 0) {
      el.style.left = "";
      el.style.top = "";
      el.style.right = "";
      el.style.transform = "";
      el.style.zIndex = "";
      if (el.dataset.dragPos === "1") {
        if (!asLayer) el.style.position = "";
        delete el.dataset.dragPos;
      }
      if (asLayer && el.classList.contains("user-widget")) {
        el.style.left = "50%";
        el.style.top = "4.2rem";
        el.style.transform = "translateX(-50%)";
        el.style.position = "absolute";
      }
      return;
    }
    /*
      Guests: keep saved admin offsets exactly (design canvas).
      Admin drag only: clamp to the live scene so text stays on-card while moving.
    */
    if (clampToScene) {
      x = Math.round(clampNumber(rawX, lim.minX, lim.maxX, rawX));
      y = Math.round(clampNumber(rawY, lim.minY, lim.maxY, rawY));
    } else {
      x = Math.round(rawX);
      y = Math.round(rawY);
    }
    el.dataset.dragPos = "1";
    if (asLayer) {
      el.style.position = "absolute";
      el.style.left = "calc(50% + " + x + "px)";
      el.style.top = Math.max(8, 48 + y) + "px";
      el.style.right = "auto";
      el.style.transform = "translateX(-50%)";
      el.style.zIndex = "8";
      el.style.margin = "0";
      return;
    }
    /* Nudge with transform — keeps text-align left/center/right working */
    el.style.position = "relative";
    el.style.left = "";
    el.style.top = "";
    el.style.right = "";
    el.style.transform = "translate(" + x + "px, " + y + "px)";
    el.style.zIndex = "6";
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
    if (!(min <= max)) return number;
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
    if (!Array.isArray(wedding.textBoxes)) wedding.textBoxes = [];
    if (!Array.isArray(wedding.widgets)) wedding.widgets = [];
    /* Corrupt {} from older saves broke pasted boxes on guest */
    if (wedding.textBoxes && !Array.isArray(wedding.textBoxes)) wedding.textBoxes = [];
    if (wedding.widgets && !Array.isArray(wedding.widgets)) wedding.widgets = [];
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
        return '<span class="letter space" style="animation-delay:' + delay.toFixed(2) + 's">&nbsp;</span>';
      }
      var piece = '<span class="letter" style="animation-delay:' + delay.toFixed(2) + 's">' + esc(ch) + "</span>";
      delay += 0.07;
      return piece;
    }).join("");
  }

  function ampDelay(text, start) {
    var delay = Number(start) || 0;
    String(text || "").split("").forEach(function (ch) {
      delay += ch === " " ? 0.04 : 0.07;
    });
    return delay + 0.08;
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

  var fieldEditBound = false;
  var fieldPressTimer = null;
  var fieldPressTarget = null;
  var fieldDrag = null;

  function canLiveEdit() {
    /* Edit chrome only when admin parent enables it — NOT merely preview=draft */
    try {
      return sessionStorage.getItem("wedding-admin-open") === "yes";
    } catch (error) {
      return false;
    }
  }

  function bindFieldEdit() {
    closeFieldEditor();
    endFieldDrag(false);
    if (canLiveEdit()) document.documentElement.classList.add("is-field-edit");
    else document.documentElement.classList.remove("is-field-edit");
    if (fieldEditBound) return;
    fieldEditBound = true;
    document.addEventListener("click", onFieldClick, true);
    document.addEventListener("pointerdown", onFieldPointerDown, true);
    document.addEventListener("pointermove", onFieldPointerMove, true);
    document.addEventListener("pointerup", onFieldPointerUp, true);
    document.addEventListener("pointercancel", onFieldPointerUp, true);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeFieldEditor();
        endFieldDrag(false);
      }
    });
  }

  function fieldEditTarget(event) {
    if (!canLiveEdit()) return null;
    var el = event.target.closest("[data-field]");
    if (!el || el.closest("#field-editor")) return null;
    if (el.matches("input, textarea, select, button") || el.closest("input, textarea, select, button")) {
      return null;
    }
    var path = el.getAttribute("data-field") || "";
    var editableLink =
      path === "venue.mapLabel" ||
      path === "place.wazeLabel" ||
      path.indexOf("widget.") === 0;
    if (el.matches("a") || el.closest("a")) {
      if (!editableLink) return null;
      if (!el.matches("a") && el.closest("a[data-field]")) el = el.closest("a[data-field]");
    }
    return el;
  }

  function onFieldClick(event) {
    var el = fieldEditTarget(event);
    if (!el) return;
    if (fieldDrag && fieldDrag.moved) return;
    event.preventDefault();
    event.stopPropagation();
    openFieldEditor(el);
  }

  function fieldPoint(event) {
    return { x: event.clientX, y: event.clientY };
  }

  function onFieldPointerDown(event) {
    if (!canLiveEdit() || event.button > 0) return;
    var el = fieldEditTarget(event);
    if (!el) return;
    /* Move the whole live-counter box, not its inner labels */
    var countdownBox = el.closest('[data-field="countdown.box"]');
    if (countdownBox) el = countdownBox;
    var path = el.getAttribute("data-field");
    if (!path) return;
    var styles = fieldStyleFor(currentWedding(), path);
    var point = fieldPoint(event);
    if (el.matches("a")) event.preventDefault();
    var lim = posLimits(el);
    var origX = Math.round(clampNumber(styles.x, lim.minX, lim.maxX, 0));
    var origY = Math.round(clampNumber(styles.y, lim.minY, lim.maxY, 0));
    fieldDrag = {
      el: el,
      path: path,
      asLayer: isLayerPath(path),
      lim: lim,
      startX: point.x,
      startY: point.y,
      origX: origX,
      origY: origY,
      curX: origX,
      curY: origY,
      moved: false,
      ready: true,
      pointerId: event.pointerId
    };
    fieldPressTarget = el;
    clearTimeout(fieldPressTimer);
    el.classList.add("is-drag-ready");
  }

  function onFieldPointerMove(event) {
    if (!fieldDrag || fieldDrag.pointerId !== event.pointerId) return;
    var point = fieldPoint(event);
    var dx = point.x - fieldDrag.startX;
    var dy = point.y - fieldDrag.startY;
    var dist = Math.hypot(dx, dy);
    if (!fieldDrag.moved) {
      if (!fieldDrag.ready || dist < 10) return;
      /* Mostly vertical = page scroll, not text drag */
      if (Math.abs(dy) > Math.abs(dx) * 1.2) {
        endFieldDrag(false);
        return;
      }
      fieldDrag.moved = true;
      clearTimeout(fieldPressTimer);
      fieldPressTimer = null;
      fieldPressTarget = null;
      closeFieldEditor();
      fieldDrag.el.classList.remove("is-drag-ready");
      fieldDrag.el.classList.add("is-dragging");
      document.documentElement.classList.add("is-field-dragging");
      try { fieldDrag.el.setPointerCapture(event.pointerId); } catch (error) {}
    }
    var lim = fieldDrag.lim || posLimits(fieldDrag.el);
    fieldDrag.curX = Math.round(clampNumber(fieldDrag.origX + dx, lim.minX, lim.maxX, 0));
    fieldDrag.curY = Math.round(clampNumber(fieldDrag.origY + dy, lim.minY, lim.maxY, 0));
    applyDragOffset(fieldDrag.el, fieldDrag.curX, fieldDrag.curY, fieldDrag.asLayer, true);
    event.preventDefault();
  }

  function onFieldPointerUp(event) {
    if (!fieldDrag || (event && fieldDrag.pointerId !== event.pointerId)) return;
    var moved = fieldDrag.moved;
    var path = fieldDrag.path;
    var x = fieldDrag.curX;
    var y = fieldDrag.curY;
    if (fieldDrag.el) fieldDrag.el.classList.remove("is-drag-ready");
    endFieldDrag(false);
    if (moved) saveFieldOffset(path, x, y);
  }

  function endFieldDrag(save) {
    clearTimeout(fieldPressTimer);
    fieldPressTimer = null;
    fieldPressTarget = null;
    if (!fieldDrag) return;
    if (fieldDrag.el) {
      fieldDrag.el.classList.remove("is-dragging");
      fieldDrag.el.classList.remove("is-drag-ready");
    }
    document.documentElement.classList.remove("is-field-dragging");
    if (save && fieldDrag.moved) saveFieldOffset(fieldDrag.path, fieldDrag.curX, fieldDrag.curY);
    fieldDrag = null;
  }

  function saveFieldOffset(path, x, y) {
    var prev = fieldStyleFor(currentWedding(), path);
    prev.x = String(Math.round(x));
    prev.y = String(Math.round(y));
    persistFieldPatch(path, null, prev);
  }

  function persistFieldPatch(path, text, styleSpec) {
    var draft = cloneTree(readStore("wedding-card-draft") || readStore("wedding-card-published") || {});
    var current = currentWedding();
    draft.textStyle = mergeStyleTree(cloneTree(current.textStyle || {}), draft.textStyle || {});
    draft.textBoxes = cloneTree(current.textBoxes || []);
    draft.widgets = cloneTree(current.widgets || []);
    var style = normalizeFieldStyle(styleSpec || {});
    var boxId = textBoxId(path);
    var wid = widgetId(path);
    if (boxId) {
      var box = findTextBox(draft, boxId);
      if (!box) {
        box = { id: boxId, scene: "opening", text: "" };
        draft.textBoxes.push(box);
      }
      var keptPx = box.fontSizePx;
      if (text != null) box.text = String(text);
      Object.assign(box, style);
      if (style.fontSizePx) box.fontSizePx = style.fontSizePx;
      else if (keptPx) box.fontSizePx = keptPx;
    } else if (wid) {
      var widget = findWidget(draft, wid);
      if (!widget) {
        widget = { id: wid, scene: "opening", type: "map" };
        draft.widgets.push(widget);
      }
      widget.x = style.x;
      widget.y = style.y;
      if (text != null) {
        if (widget.type === "map") {
          draft.venue = draft.venue || {};
          draft.venue.mapLabel = String(text);
        } else if (widget.type === "waze") {
          draft.place = draft.place || {};
          draft.place.wazeLabel = String(text);
        }
      }
    } else {
      if (text != null) writeFieldValue(draft, path, text);
      if (!draft.textStyle || typeof draft.textStyle !== "object") draft.textStyle = {};
      setDeep(draft.textStyle, path, style);
    }
    writeStore("wedding-card-draft", draft);
    writeStore("wedding-card-published", draft);
    paint(mergeWedding(base, draft), true);
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({ type: "wedding-field-saved", payload: draft }, window.location.origin);
      } catch (error) {}
    }
  }

  function pasteTextBox(sceneId, clip) {
    if (!clip) return;
    if (clip.kind === "widget" && clip.widgetType) {
      pasteWidget(sceneId, clip);
      return;
    }
    var draft = cloneTree(readStore("wedding-card-draft") || readStore("wedding-card-published") || {});
    var current = currentWedding();
    draft.textStyle = mergeStyleTree(cloneTree(current.textStyle || {}), draft.textStyle || {});
    draft.textBoxes = cloneTree(current.textBoxes || []);
    draft.widgets = cloneTree(current.widgets || []);
    var style = normalizeFieldStyle(clip);
    var box = {
      id: newTextBoxId(),
      scene: sceneId || clip.scene || "opening",
      text: String(clip.text || "Teks baharu"),
      size: style.size,
      letter: style.letter,
      spacing: style.spacing,
      font: style.font,
      color: style.color,
      align: style.align || "center",
      x: String(clampNumber(Number(style.x) + 12, -280, 280, 12)),
      y: String(clampNumber(Number(style.y) + 36, -280, 280, 36))
    };
    if (style.fontSizePx) box.fontSizePx = style.fontSizePx;
    else if (clip.fontSizePx) box.fontSizePx = String(clip.fontSizePx);
    draft.textBoxes.push(box);
    writeStore("wedding-card-draft", draft);
    writeStore("wedding-card-published", draft);
    closeFieldEditor();
    paint(mergeWedding(base, draft), true);
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({ type: "wedding-field-saved", payload: draft }, window.location.origin);
      } catch (error) {}
    }
  }

  function pasteWidget(sceneId, clip) {
    if (!clip || !clip.widgetType) return;
    var draft = cloneTree(readStore("wedding-card-draft") || readStore("wedding-card-published") || {});
    var current = currentWedding();
    draft.textStyle = mergeStyleTree(cloneTree(current.textStyle || {}), draft.textStyle || {});
    draft.textBoxes = cloneTree(current.textBoxes || []);
    draft.widgets = cloneTree(current.widgets || []);
    var style = normalizeFieldStyle(clip);
    draft.widgets.push({
      id: newTextBoxId(),
      scene: sceneId || clip.scene || "opening",
      type: String(clip.widgetType),
      x: String(clampNumber(Number(style.x) + 12, -280, 280, 12)),
      y: String(clampNumber(Number(style.y) + 36, -280, 280, 36))
    });
    writeStore("wedding-card-draft", draft);
    writeStore("wedding-card-published", draft);
    closeFieldEditor();
    paint(mergeWedding(base, draft), true);
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({ type: "wedding-field-saved", payload: draft }, window.location.origin);
      } catch (error) {}
    }
  }

  function deleteTextBox(path) {
    var boxId = textBoxId(path);
    if (!boxId) return;
    var draft = cloneTree(readStore("wedding-card-draft") || readStore("wedding-card-published") || {});
    var current = currentWedding();
    draft.textStyle = mergeStyleTree(cloneTree(current.textStyle || {}), draft.textStyle || {});
    draft.textBoxes = (current.textBoxes || []).filter(function (box) {
      return box && box.id !== boxId;
    });
    draft.widgets = cloneTree(current.widgets || []);
    writeStore("wedding-card-draft", draft);
    writeStore("wedding-card-published", draft);
    closeFieldEditor();
    paint(mergeWedding(base, draft), true);
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({ type: "wedding-field-saved", payload: draft }, window.location.origin);
      } catch (error) {}
    }
  }

  function deleteWidget(path) {
    var id = widgetId(path);
    if (!id) return;
    var draft = cloneTree(readStore("wedding-card-draft") || readStore("wedding-card-published") || {});
    var current = currentWedding();
    draft.textStyle = mergeStyleTree(cloneTree(current.textStyle || {}), draft.textStyle || {});
    draft.textBoxes = cloneTree(current.textBoxes || []);
    draft.widgets = (current.widgets || []).filter(function (item) {
      return item && item.id !== id;
    });
    writeStore("wedding-card-draft", draft);
    writeStore("wedding-card-published", draft);
    closeFieldEditor();
    paint(mergeWedding(base, draft), true);
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({ type: "wedding-field-saved", payload: draft }, window.location.origin);
      } catch (error) {}
    }
  }

  function readStyleClipboard() {
    try {
      var parsed = JSON.parse(sessionStorage.getItem("wedding-style-clipboard") || "null");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      return normalizeFieldStyle(parsed);
    } catch (error) {
      return null;
    }
  }

  function writeStyleClipboard(spec) {
    try {
      sessionStorage.setItem("wedding-style-clipboard", JSON.stringify(normalizeFieldStyle(spec)));
    } catch (error) {}
  }

  function readFieldValue(wedding, path) {
    var boxId = textBoxId(path);
    if (boxId) {
      var box = findTextBox(wedding, boxId);
      return box ? String(box.text || "") : "";
    }
    var wid = widgetId(path);
    if (wid) {
      var widget = findWidget(wedding, wid);
      if (!widget) return "";
      if (widget.type === "map") return String((wedding.venue && wedding.venue.mapLabel) || "Google Maps");
      if (widget.type === "waze") return String((wedding.place && wedding.place.wazeLabel) || "Waze");
      if (widget.type === "countdown") return String((wedding.countdown && wedding.countdown.label) || "Kiraan undur");
      return widget.type;
    }
    if (path === "countdown.box") {
      return String((wedding.countdown && wedding.countdown.label) || "Kiraan undur");
    }
    if (path.indexOf("timeline.") === 0) {
      var parts = path.split(".");
      var item = (wedding.place && wedding.place.timeline && wedding.place.timeline[Number(parts[1])]) || {};
      return String(item[parts[2]] || "");
    }
    var value = pathValue(wedding, path);
    return value == null ? "" : String(value);
  }

  function writeFieldValue(wedding, path, text) {
    if (path === "countdown.box") {
      wedding.countdown = wedding.countdown || {};
      if (text != null && String(text).trim()) wedding.countdown.label = String(text);
      return;
    }
    var boxId = textBoxId(path);
    if (boxId) {
      var box = findTextBox(wedding, boxId);
      if (box) box.text = String(text || "");
      return;
    }
    if (path.indexOf("timeline.") === 0) {
      var parts = path.split(".");
      var index = Number(parts[1]);
      var key = parts[2];
      if (!wedding.place) wedding.place = {};
      if (!Array.isArray(wedding.place.timeline)) wedding.place.timeline = [];
      while (wedding.place.timeline.length <= index) {
        wedding.place.timeline.push({ time: "", title: "", detail: "" });
      }
      if (!wedding.place.timeline[index] || typeof wedding.place.timeline[index] !== "object") {
        wedding.place.timeline[index] = { time: "", title: "", detail: "" };
      }
      wedding.place.timeline[index][key] = text;
      return;
    }
    setDeep(wedding, path, text);
  }

  function sceneIdFromElement(el) {
    var scene = el && el.closest ? el.closest(".scene") : null;
    return scene && scene.id ? scene.id : "opening";
  }

  function newTextBoxId() {
    return "tb_" + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
  }

  function readBoxClipboard() {
    try {
      var parsed = JSON.parse(sessionStorage.getItem("wedding-textbox-clipboard") || "null");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function writeBoxClipboard(payload) {
    try {
      sessionStorage.setItem("wedding-textbox-clipboard", JSON.stringify(payload));
    } catch (error) {}
  }

  function setDeep(target, path, value) {
    var parts = String(path || "").split(".");
    var cursor = target;
    var i;
    for (i = 0; i < parts.length - 1; i += 1) {
      var key = parts[i];
      var nextIsIndex = /^\d+$/.test(parts[i + 1]);
      if (!cursor[key] || typeof cursor[key] !== "object") cursor[key] = nextIsIndex ? [] : {};
      cursor = cursor[key];
    }
    cursor[parts[parts.length - 1]] = value;
  }

  function openFieldEditor(el) {
    var path = el.getAttribute("data-field");
    if (!path) return;
    closeFieldEditor();
    var wedding = currentWedding();
    var styles = fieldStyleFor(wedding, path);
    var size = clampNumber(styles.size, 70, 170, 100);
    var spacing = clampNumber(styles.spacing, 70, 180, 100);
    var letter = clampNumber(styles.letter, 70, 180, 100);
    var x = Math.round(clampNumber(styles.x, -400, 400, 0));
    var y = Math.round(clampNumber(styles.y, -400, 400, 0));
    var font = styles.font || "";
    var color = styles.color || "#2e2a27";
    var align = styles.align || "";
    var text = readFieldValue(wedding, path);
    var isPlaceholder = /Placeholder$/.test(path);
    var isCustomBox = !!textBoxId(path);
    var isWidget = !!widgetId(path);
    var isCountdownBox = path === "countdown.box";
    var copyWidgetType = widgetTypeFromPath(path, wedding);
    var sceneId = sceneIdFromElement(el);
    var clipNow = readBoxClipboard();
    var hasBoxClip = !!clipNow;
    var copyLabel = copyWidgetType === "map"
      ? "Salin Google Maps"
      : copyWidgetType === "waze"
        ? "Salin Waze"
        : copyWidgetType === "countdown"
          ? "Salin kiraan undur"
          : "Salin kotak teks";
    var pasteLabel = clipNow && clipNow.kind === "widget"
      ? (clipNow.widgetType === "map"
        ? "Tampal Google Maps"
        : clipNow.widgetType === "waze"
          ? "Tampal Waze"
          : clipNow.widgetType === "countdown"
            ? "Tampal kiraan undur"
            : "Tampal widget")
      : "Tampal kotak teks";
    var deleteLabel = isCountdownBox
      ? "Reset kedudukan"
      : isWidget
        ? "Padam widget"
        : isCustomBox
          ? "Padam kotak teks"
          : "Padam teks";
    var fontOptions = FONT_CHOICES.map(function (item) {
      return '<option value="' + esc(item.id) + '"' + (font === item.id ? " selected" : "") + ">" +
        esc(item.label) + "</option>";
    }).join("");
    var panel = document.createElement("div");
    panel.id = "field-editor";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Sunting teks");
    panel.innerHTML =
      '<p class="field-editor-path">' + esc(isCountdownBox ? "kiraan undur" : path) + "</p>" +
      '<p class="field-editor-hint">Seret teks untuk gerakkan. Ketik untuk sunting. Tetamu akan nampak kedudukan yang sama.</p>' +
      (copyWidgetType === "countdown" && isWidget
        ? '<p class="field-editor-hint">Salinan kiraan undur — teks dikongsi dengan kiraan utama. Seret atau Padam di sini.</p>'
        : "") +
      '<label class="field-editor-label"><span>' + (isCountdownBox ? "Tajuk kiraan" : "Teks / perenggan") + "</span>" +
      '<textarea id="field-editor-text" rows="3"' + (copyWidgetType === "countdown" && isWidget ? " readonly" : "") + "></textarea></label>" +
      ((isWidget && copyWidgetType === "countdown") || isCountdownBox
        ? ""
        : (
          '<label class="field-editor-label"><span>Fon</span>' +
          '<select id="field-editor-font">' + fontOptions + "</select></label>" +
          '<label class="field-editor-label"><span>Warna</span>' +
          '<span class="field-editor-color-row">' +
          '<input id="field-editor-color" type="color" value="' + esc(color) + '">' +
          '<button type="button" class="text-button" id="field-editor-color-reset">Asal</button>' +
          "</span></label>" +
          '<label class="field-editor-label"><span>Jajaran</span>' +
          '<select id="field-editor-align">' +
          '<option value=""' + (align === "" ? " selected" : "") + ">Asal</option>" +
          '<option value="left"' + (align === "left" ? " selected" : "") + ">Kiri</option>" +
          '<option value="center"' + (align === "center" ? " selected" : "") + ">Tengah</option>" +
          '<option value="right"' + (align === "right" ? " selected" : "") + ">Kanan</option>" +
          "</select></label>" +
          '<label class="field-editor-label"><span>Saiz teks <output id="field-size-out">' + size + "%</output></span>" +
          '<input id="field-editor-size" type="range" min="70" max="170" step="1" value="' + size + '"></label>' +
          '<label class="field-editor-label"><span>Jarak huruf <output id="field-letter-out">' + letter + "%</output></span>" +
          '<input id="field-editor-letter" type="range" min="70" max="180" step="1" value="' + letter + '"></label>' +
          '<label class="field-editor-label"><span>Ketinggian baris <output id="field-spacing-out">' + spacing + "%</output></span>" +
          '<input id="field-editor-spacing" type="range" min="70" max="180" step="1" value="' + spacing + '"></label>'
        )) +
      '<div class="field-editor-actions field-editor-copy">' +
      '<button type="button" class="button" id="field-editor-copy-box">' + esc(copyLabel) + "</button>" +
      '<button type="button" class="button" id="field-editor-paste-box"' + (hasBoxClip ? "" : " disabled") + ">" + esc(pasteLabel) + "</button>" +
      "</div>" +
      '<p class="field-editor-hint">Salin Google Maps / Waze / kiraan undur, buka seksyen lain, kemudian Tampal.</p>' +
      (isPlaceholder ? '<p class="field-editor-hint">Ini teks placeholder medan.</p>' : "") +
      '<div class="field-editor-actions">' +
      '<button type="button" class="button field-editor-delete" id="field-editor-delete">' + esc(deleteLabel) + "</button>" +
      "</div>" +
      '<div class="field-editor-actions">' +
      '<button type="button" class="button" id="field-editor-save">Simpan</button>' +
      '<button type="button" class="text-button" id="field-editor-close">Tutup</button>' +
      "</div>";
    document.body.appendChild(panel);
    var box = panel.querySelector("#field-editor-text");
    var colorInput = panel.querySelector("#field-editor-color");
    var colorReset = false;
    box.value = text;
    if (colorInput && !styles.color) {
      colorReset = true;
      colorInput.value = "#2e2a27";
    }
    function bindRange(id, outId, unit) {
      var input = panel.querySelector("#" + id);
      var out = panel.querySelector("#" + outId);
      if (!input || !out) return;
      input.addEventListener("input", function () { out.textContent = input.value + unit; });
    }
    bindRange("field-editor-size", "field-size-out", "%");
    bindRange("field-editor-letter", "field-letter-out", "%");
    bindRange("field-editor-spacing", "field-spacing-out", "%");
    if (colorInput) colorInput.addEventListener("input", function () { colorReset = false; });
    var colorResetBtn = panel.querySelector("#field-editor-color-reset");
    if (colorResetBtn) {
      colorResetBtn.addEventListener("click", function () {
        colorReset = true;
        colorInput.value = "#2e2a27";
      });
    }
    function collectStyleFromPanel(keepPosition) {
      var sizeEl = panel.querySelector("#field-editor-size");
      var letterEl = panel.querySelector("#field-editor-letter");
      var spacingEl = panel.querySelector("#field-editor-spacing");
      var fontEl = panel.querySelector("#field-editor-font");
      var alignEl = panel.querySelector("#field-editor-align");
      var style = {
        size: sizeEl ? sizeEl.value : "100",
        letter: letterEl ? letterEl.value : "100",
        spacing: spacingEl ? spacingEl.value : "100",
        font: fontEl ? fontEl.value : "",
        color: !colorInput || colorReset ? "" : colorInput.value,
        align: alignEl ? alignEl.value : "",
        /* Position only via drag on the page — keep current offsets when saving */
        x: keepPosition ? String(Math.round(clampNumber(x, -400, 400, 0))) : "0",
        y: keepPosition ? String(Math.round(clampNumber(y, -400, 400, 0))) : "0"
      };
      return keepPosition ? normalizeFieldStyle(style) : designOnlyStyle(style);
    }
    panel.querySelector("#field-editor-copy-box").addEventListener("click", function () {
      var style = collectStyleFromPanel(true);
      var payload;
      if (copyWidgetType) {
        payload = {
          kind: "widget",
          widgetType: copyWidgetType,
          scene: sceneId,
          x: style.x,
          y: style.y
        };
      } else {
        var look = captureElementLook(el, style);
        if (isCustomBox) {
          var existing = findTextBox(currentWedding(), textBoxId(path));
          if (existing && existing.fontSizePx) look.fontSizePx = String(existing.fontSizePx);
        }
        payload = {
          kind: "textbox",
          scene: sceneId,
          text: box.value,
          size: look.size,
          letter: look.letter,
          spacing: look.spacing,
          font: look.font,
          color: look.color,
          align: look.align || "center",
          x: look.x,
          y: look.y,
          fontSizePx: look.fontSizePx || ""
        };
      }
      writeBoxClipboard(payload);
      var pasteBtn = panel.querySelector("#field-editor-paste-box");
      pasteBtn.disabled = false;
      pasteBtn.textContent = (payload.kind === "widget"
        ? (payload.widgetType === "map" ? "Tampal Google Maps"
          : payload.widgetType === "waze" ? "Tampal Waze"
            : "Tampal kiraan undur")
        : "Tampal kotak teks") + " ✓";
    });
    panel.querySelector("#field-editor-paste-box").addEventListener("click", function () {
      var clip = readBoxClipboard();
      if (!clip) return;
      pasteTextBox(sceneId, clip);
    });
    panel.querySelector("#field-editor-close").addEventListener("click", closeFieldEditor);
    panel.querySelector("#field-editor-save").addEventListener("click", function () {
      var style = collectStyleFromPanel(true);
      if (isCustomBox) {
        var currentBox = findTextBox(currentWedding(), textBoxId(path));
        if (currentBox && currentBox.fontSizePx) style.fontSizePx = String(currentBox.fontSizePx);
        else {
          var look = captureElementLook(el, style);
          if (look.fontSizePx) style.fontSizePx = look.fontSizePx;
        }
      }
      saveFieldEditor(path, box.value, style);
    });
    panel.querySelector("#field-editor-delete").addEventListener("click", function () {
      if (isCountdownBox) {
        saveFieldEditor(path, box.value, normalizeFieldStyle({
          size: "100",
          letter: "100",
          spacing: "100",
          font: "",
          color: "",
          align: "",
          x: "0",
          y: "0"
        }));
        return;
      }
      if (isWidget) {
        if (window.confirm("Padam salinan widget ini?")) deleteWidget(path);
        return;
      }
      if (isCustomBox) {
        if (window.confirm("Padam kotak teks ini?")) deleteTextBox(path);
        return;
      }
      if (window.confirm("Padam teks ini? Ruang akan dikosongkan.")) {
        saveFieldEditor(path, "", collectStyleFromPanel(true));
      }
    });
    box.addEventListener("keydown", function (event) {
      if (event.key !== "Tab") return;
      /* Tab moves to the next control — use Enter for a new line */
      event.preventDefault();
      var focusables = panel.querySelectorAll(
        "textarea, select, input, button:not([disabled])"
      );
      var list = Array.prototype.filter.call(focusables, function (node) {
        return !node.disabled && node.offsetParent !== null;
      });
      var index = list.indexOf(box);
      if (index === -1) return;
      var next = event.shiftKey
        ? list[(index - 1 + list.length) % list.length]
        : list[(index + 1) % list.length];
      if (next) next.focus();
    });
    placeFieldEditor(panel, el);
    box.focus();
    box.select();
  }

  function placeFieldEditor(panel, el) {
    var rect = el.getBoundingClientRect();
    var width = Math.min(340, window.innerWidth - 24);
    var left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    var top = rect.bottom + 10;
    panel.style.width = width + "px";
    panel.style.left = left + "px";
    panel.style.top = top + "px";
    requestAnimationFrame(function () {
      var box = panel.getBoundingClientRect();
      if (box.bottom > window.innerHeight - 12) {
        panel.style.top = Math.max(12, rect.top - box.height - 10) + "px";
      }
    });
  }

  function saveFieldEditor(path, text, styleSpec) {
    closeFieldEditor();
    persistFieldPatch(path, text, styleSpec);
  }

  function closeFieldEditor() {
    var panel = document.getElementById("field-editor");
    if (panel) panel.remove();
  }

  function mountEditor() {
    if (document.querySelector(".edit-launch")) return;
    var button = document.createElement("button");
    button.type = "button";
    button.className = "edit-launch";
    button.textContent = "Sunting";
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
      '<h2 id="edit-title">Sunting jemputan</h2>' +
      '<p class="editor-note">Kata laluan membuka teks. Simpan kekal dalam pelayar ini.</p>' +
      '<form id="edit-gate">' +
      '<label class="editor-field"><span>Kata laluan</span>' +
      '<input id="edit-password" type="password" autocomplete="current-password" required></label>' +
      '<p class="editor-error" id="edit-error" hidden></p>' +
      '<div class="editor-actions">' +
      '<button class="button" type="submit">Teruskan</button>' +
      '<button class="text-button" id="edit-close" type="button">Tutup</button>' +
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
        error.textContent = "Kata laluan tidak sepadan.";
        return;
      }
      sessionStorage.setItem("wedding-admin-open", "yes");
      document.documentElement.classList.add("is-field-edit");
      showEditFields();
    }).catch(function () {
      error.hidden = false;
      error.textContent = "Pelayar ini tidak dapat menyemak kata laluan.";
    });
  }

  function showEditFields() {
    var card = editorCard();
    if (!card) return;
    var wedding = currentWedding();
    card.innerHTML =
      '<h2 id="edit-title">Sunting jemputan</h2>' +
      '<p class="editor-note">Simpan kekalkan teks jemputan dalam pelayar ini.</p>' +
      '<p class="editor-note">Pada kad: klik teks untuk sunting. Seret untuk alih kedudukan.</p>' +
      '<p class="editor-note" id="edit-save-note" hidden></p>' +
      '<form id="edit-form">' +
      editBlock("Nama dan tarikh", [
        editField("Nama kulit 1", "opening.nameOne", wedding.opening.nameOne || wedding.partnerOne),
        editField("Tanda & kulit", "opening.amp", wedding.opening.amp || "&"),
        editField("Nama kulit 2", "opening.nameTwo", wedding.opening.nameTwo || wedding.partnerTwo),
        editField("Hari", "date.weekday", wedding.date.weekday),
        editField("Tarikh", "date.day", wedding.date.day),
        editField("Bulan", "date.month", wedding.date.month),
        editField("Tahun", "date.year", wedding.date.year),
        editField("Masa", "date.time", wedding.date.time),
        editField("Baris pembuka", "opening.kicker", wedding.opening.kicker)
      ]) +
      editBlock("Pengantin", [
        editField("Tajuk", "couple.kicker", wedding.couple.kicker),
        editField("Nama halaman 2 — 1", "partnerOne", wedding.partnerOne),
        editField("Tanda & halaman 2", "couple.amp", wedding.couple.amp || "&"),
        editField("Nama halaman 2 — 2", "partnerTwo", wedding.partnerTwo),
        editArea("Baris pasangan pertama", "couple.oneLine", wedding.couple.oneLine),
        editArea("Baris pasangan kedua", "couple.twoLine", wedding.couple.twoLine),
        editArea("Nota", "couple.note", wedding.couple.note || "")
      ]) +
      editBlock("Akad dan majlis", [
        editField("Tajuk", "celebration.heading", wedding.celebration.heading),
        editField("Baris tarikh", "celebration.dateLine", wedding.celebration.dateLine || (
          wedding.date.weekday + " " + wedding.date.day + " " + wedding.date.month + " " +
          wedding.date.year + " · " + wedding.date.time
        )),
        editField("Akad", "celebration.ceremony.label", wedding.celebration.ceremony.label),
        editField("Masa akad", "celebration.ceremony.time", wedding.celebration.ceremony.time),
        editField("Tempat akad", "celebration.ceremony.place", wedding.celebration.ceremony.place),
        editArea("Butiran akad", "celebration.ceremony.detail", wedding.celebration.ceremony.detail),
        editField("Majlis", "celebration.reception.label", wedding.celebration.reception.label),
        editField("Masa majlis", "celebration.reception.time", wedding.celebration.reception.time),
        editField("Tempat majlis", "celebration.reception.place", wedding.celebration.reception.place),
        editArea("Butiran majlis", "celebration.reception.detail", wedding.celebration.reception.detail),
        editField("Label pakaian", "celebration.attire.label", wedding.celebration.attire.label),
        editArea("Pakaian", "celebration.attire.text", wedding.celebration.attire.text),
        editArea("Nota", "celebration.note", wedding.celebration.note || "")
      ]) +
      editBlock("Lokasi", [
        editField("Tajuk", "place.heading", wedding.place.heading),
        editField("Tempat", "venue.name", wedding.venue.name),
        editField("Alamat", "venue.street", wedding.venue.street),
        editArea("Nota tempat", "place.note", wedding.place.note || ""),
        editField("Label peta", "venue.mapLabel", wedding.venue.mapLabel),
        editField("Pautan peta", "venue.mapUrl", wedding.venue.mapUrl),
        editField("Label Waze", "place.wazeLabel", wedding.place.wazeLabel),
        editField("Pautan Waze", "place.wazeUrl", wedding.place.wazeUrl),
        editTimeline(wedding.place.timeline)
      ]) +
      editBlock("Balasan, ucapan, dan penutup", [
        editField("Tajuk balasan", "rsvp.heading", wedding.rsvp.heading),
        editArea("Pengenalan balasan", "rsvp.intro", wedding.rsvp.intro),
        editArea("Nota balasan", "rsvp.note", wedding.rsvp.note || ""),
        editField("Tajuk ucapan", "guestbook.heading", wedding.guestbook.heading),
        editArea("Pengenalan ucapan", "guestbook.intro", wedding.guestbook.intro),
        editArea("Ucapan terima kasih", "closing.thankYou", wedding.closing.thankYou),
        editField("Label doa", "closing.prayerLabel", wedding.closing.prayerLabel),
        editArea("Doa penutup", "closing.prayer", wedding.closing.prayer),
        editField("Penutup", "closing.closing", wedding.closing.closing),
        editArea("Nota penutup", "closing.note", wedding.closing.note || ""),
        editField("Tandatangan nama", "closing.signature", wedding.closing.signature || (
          firstName(wedding.partnerOne) + " & " + firstName(wedding.partnerTwo)
        )),
        editField("Nav: lokasi", "nav.location", wedding.nav.location),
        editField("Nav: ucapan", "nav.wishes", wedding.nav.wishes),
        editField("Nav: balasan", "nav.rsvp", wedding.nav.rsvp)
      ]) +
      '<div class="editor-actions">' +
      '<button class="button" type="submit">Simpan</button>' +
      '<button class="text-button" id="edit-reset" type="button">Guna fail semula</button>' +
      '<button class="text-button" id="edit-close" type="button">Tutup</button>' +
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
    var current = currentWedding();
    data.textStyle = cloneTree(current.textStyle || {});
    writeStore("wedding-card-published", data);
    writeStore("wedding-card-draft", data);
    paint(mergeWedding(base, data), true);
    var note = document.getElementById("edit-save-note");
    if (note) {
      note.hidden = false;
      note.textContent = "Disimpan dalam pelayar ini.";
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
      note.textContent = "Jemputan menggunakan content.js semula.";
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
        editField("Atur cara " + (index + 1) + " masa", "timeline." + index + ".time", item.time || "") +
        editField("Atur cara " + (index + 1) + " tajuk", "timeline." + index + ".title", item.title || "") +
        editField("Atur cara " + (index + 1) + " butiran", "timeline." + index + ".detail", item.detail || "");
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
