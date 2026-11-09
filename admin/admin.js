(function () {
  var base = window.WEDDING;
  var gate = document.getElementById("gate");
  var studio = document.getElementById("studio");
  var form = document.getElementById("editor");
  var preview = document.getElementById("preview");
  var DRAFT_KEY = "wedding-card-draft";
  var PUBLISHED_KEY = "wedding-card-published";
  var SESSION_KEY = "wedding-admin-open";
  var SCENE_IDS = ["opening", "couple", "celebration", "place", "closing"];
  var SCENE_NAMES = {
    opening: "Opening",
    couple: "Couple introduction",
    celebration: "Solemnization and reception",
    place: "Location and programme",
    closing: "Closing",
  };
  var activeStyles = {};
  var plainFields = { music: true, "venue.mapUrl": true, "place.wazeUrl": true, "place.photos": true };

  if (!base || !gate || !form) return;

  document.getElementById("unlock-form").addEventListener("submit", function (event) {
    event.preventDefault();
    unlock(document.getElementById("password").value);
  });

  function unlock(password) {
    var error = document.getElementById("unlock-error");
    hashText(password).then(function (digest) {
      var expected = String(base.adminPasswordHash || "").toLowerCase();
      if (!expected || !sameText(digest, expected)) {
        error.hidden = false;
        error.textContent = "That password does not match.";
        return;
      }
      sessionStorage.setItem(SESSION_KEY, "yes");
      openStudio();
    }).catch(function () {
      error.hidden = false;
      error.textContent = "This browser could not check the password.";
    });
  }

  function openStudio() {
    gate.hidden = true;
    studio.hidden = false;
    buildForm(loadDraft());
    if (form.dataset.bound === "yes") return;
    form.dataset.bound = "yes";
    form.addEventListener("input", onEdit);
    form.addEventListener("keydown", onTabBreak);
    form.addEventListener("submit", onSave);
    form.addEventListener("click", function (event) {
      if (event.target.id === "reset-card") {
        event.preventDefault();
        onReset();
      }
      if (event.target.id === "download-card") {
        event.preventDefault();
        onDownload();
      }
      if (event.target.id === "export-responses") {
        event.preventDefault();
        exportResponses();
      }
      var saveWish = event.target.getAttribute && event.target.getAttribute("data-save-wish");
      if (saveWish != null) {
        event.preventDefault();
        saveWishAt(Number(saveWish));
      }
      var deleteWish = event.target.getAttribute && event.target.getAttribute("data-delete-wish");
      if (deleteWish != null) {
        event.preventDefault();
        deleteWishAt(Number(deleteWish));
      }
      if (event.target.id === "add-contact") {
        event.preventDefault();
        var added = collect();
        added.contact.people.push({ role: "", name: "", phone: "" });
        writeStore(DRAFT_KEY, added);
        buildForm(added);
        sendPreview(added);
      }
      var removeContact = event.target.getAttribute && event.target.getAttribute("data-remove-contact");
      if (removeContact != null) {
        event.preventDefault();
        var trimmed = collect();
        var index = Number(removeContact);
        trimmed.contact.people.splice(index, 1);
        if (!trimmed.contact.people.length) trimmed.contact.people.push({ role: "", name: "", phone: "" });
        writeStore(DRAFT_KEY, trimmed);
        buildForm(trimmed);
        sendPreview(trimmed);
      }
    });
  }

  function onTabBreak(event) {
    if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;
    var box = event.target;
    var isText = box && (box.tagName === "TEXTAREA" || (box.tagName === "INPUT" && box.type === "text"));
    if (!isText) return;
    event.preventDefault();
    var start = box.selectionStart;
    var end = box.selectionEnd;
    var value = box.value;
    box.value = value.slice(0, start) + "\n" + value.slice(end);
    box.selectionStart = box.selectionEnd = start + 1;
    box.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function onEdit() {
    var draft = collect();
    writeStore(DRAFT_KEY, draft);
    sendPreview(draft);
  }

  function onSave(event) {
    event.preventDefault();
    var draft = collect();
    writeStore(DRAFT_KEY, draft);
    writeStore(PUBLISHED_KEY, draft);
    sendPreview(draft);
    var note = form.querySelector("#save-note");
    note.hidden = false;
    note.textContent = "Saved. This browser’s invitation at / now uses these words, text size, and spacing.";
  }

  function onReset() {
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(PUBLISHED_KEY);
    localStorage.removeItem("wedding-card-edits");
    buildForm(null);
    sendPreview(null);
  }

  function onDownload() {
    var merged = mergeForExport(collect());
    var blob = new Blob(["window.WEDDING = " + JSON.stringify(merged, null, 2) + ";\n"], { type: "text/javascript" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "content.js";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function sendPreview(draft) {
    if (!preview.contentWindow) return;
    preview.contentWindow.postMessage({ type: "wedding-preview", payload: draft }, window.location.origin);
  }

  function buildForm(extra) {
    var wedding = mergeView(extra);
    try {
      writeForm(wedding);
    } catch (error) {
      writeForm(mergeView(null));
    }
  }

  function writeForm(wedding) {
    ensureAdminShape(wedding);
    activeStyles = (wedding.textStyle && typeof wedding.textStyle === "object" && !Array.isArray(wedding.textStyle)) ? wedding.textStyle : {};
    var photos = Array.isArray(wedding.place.photos) ? wedding.place.photos : [];
    form.innerHTML =
      "<h1>Edit invitation</h1>" +
      '<p class="admin-note">The preview uses your draft as you type. Save is what / shows in this browser. content.js stays the file default until you replace it.</p>' +
      '<p class="admin-note" id="save-note" hidden></p>' +
      pageFields(wedding, photos) +
      orderBlock(wedding.sceneOrder) +
      block("Music", [
        field("Music file", "music", readText(wedding, "music")),
      ]) +
      contactBlock(wedding) +
      responsesBlock() +
      '<div class="admin-actions">' +
      '<button class="button" type="submit">Save</button>' +
      '<button class="text-button" id="download-card" type="button">Download content.js</button>' +
      '<button class="text-button" id="reset-card" type="button">Use the file again</button>' +
      "</div>";
    bindOrder();
    bindRanges();
  }

  function readGuestbook() {
    try {
      var parsed = JSON.parse(localStorage.getItem("wedding-card-guestbook") || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (item) {
        return item && typeof item.name === "string";
      });
    } catch (error) {
      return [];
    }
  }

  function writeGuestbook(list) {
    try {
      localStorage.setItem("wedding-card-guestbook", JSON.stringify(list));
    } catch (error) {}
  }

  function attendanceLabel(value) {
    if (value === "yes") return "Joyfully accepts";
    if (value === "no") return "Regretfully declines";
    return "";
  }

  function responsesBlock() {
    var wishes = readGuestbook();
    var accept = wishes.filter(function (w) { return w.attendance === "yes"; }).length;
    var decline = wishes.filter(function (w) { return w.attendance === "no"; }).length;
    var rows = wishes.length
      ? wishes.map(function (wish, index) {
          return (
            '<article class="response-card">' +
            '<label class="editor-field"><span>Name</span>' +
            '<input data-wish-name="' + index + '" type="text" value="' + escapeAttr(wish.name || "") + '"></label>' +
            '<label class="editor-field"><span>Attendance</span>' +
            '<select data-wish-attendance="' + index + '">' +
            '<option value="yes"' + (wish.attendance === "yes" ? " selected" : "") + ">Joyfully accepts</option>" +
            '<option value="no"' + (wish.attendance === "no" ? " selected" : "") + ">Regretfully declines</option>" +
            '<option value=""' + (!wish.attendance ? " selected" : "") + ">Not set</option>" +
            "</select></label>" +
            '<label class="editor-field"><span>Note</span>' +
            '<textarea data-wish-message="' + index + '" rows="3">' + escapeHtml(wish.message || "") + "</textarea></label>" +
            '<div class="response-actions">' +
            '<button class="button" type="button" data-save-wish="' + index + '">Save edit</button>' +
            '<button class="text-button" type="button" data-delete-wish="' + index + '">Delete</button>' +
            "</div></article>"
          );
        }).join("")
      : '<p class="admin-note">No guest responses yet.</p>';
    return (
      '<fieldset class="response-block"><legend>Guest responses</legend>' +
      '<p class="admin-note">' + wishes.length + " total · " + accept + " attending · " + decline + " declining</p>" +
      '<button class="button" id="export-responses" type="button">Download Excel sheet</button>' +
      '<div class="response-list">' + rows + "</div></fieldset>"
    );
  }

  function saveWishAt(index) {
    var wishes = readGuestbook();
    if (!wishes[index]) return;
    var nameInput = form.querySelector('[data-wish-name="' + index + '"]');
    var attendanceInput = form.querySelector('[data-wish-attendance="' + index + '"]');
    var messageInput = form.querySelector('[data-wish-message="' + index + '"]');
    var name = String(nameInput && nameInput.value || "").replace(/\s+/g, " ").trim();
    if (!name) {
      window.alert("Please keep a guest name.");
      return;
    }
    wishes[index] = {
      name: name,
      attendance: attendanceInput ? attendanceInput.value : "",
      message: String(messageInput && messageInput.value || "").trim()
    };
    writeGuestbook(wishes);
    buildForm(loadDraft());
  }

  function deleteWishAt(index) {
    var wishes = readGuestbook();
    if (!wishes[index]) return;
    if (!window.confirm("Delete this guest response?")) return;
    wishes.splice(index, 1);
    writeGuestbook(wishes);
    buildForm(loadDraft());
  }

  function exportResponses() {
    var wishes = readGuestbook();
    var lines = ["Name,Attendance,Note"];
    wishes.forEach(function (wish) {
      lines.push([
        csvCell(wish.name || ""),
        csvCell(attendanceLabel(wish.attendance)),
        csvCell(wish.message || "")
      ].join(","));
    });
    var csv = "\uFEFF" + lines.join("\r\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "guestbook-responses.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function csvCell(value) {
    var text = String(value == null ? "" : value).replace(/"/g, '""');
    return '"' + text + '"';
  }

  function escapeAttr(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function readText(root, path) {
    var value = pathValue(root, path);
    return typeof value === "string" ? value : "";
  }

  function pageFields(wedding, photos) {
    var pages = {
      opening: block("Cover", [
        field("Kicker", "opening.kicker", readText(wedding, "opening.kicker")),
        field("First partner", "partnerOne", readText(wedding, "partnerOne")),
        field("Second partner", "partnerTwo", readText(wedding, "partnerTwo")),
        field("Weekday", "date.weekday", readText(wedding, "date.weekday")),
        field("Day", "date.day", readText(wedding, "date.day")),
        field("Month", "date.month", readText(wedding, "date.month")),
        field("Year", "date.year", readText(wedding, "date.year")),
        field("Time", "date.time", readText(wedding, "date.time")),
        area("Quotation", "announcement.quotation", readText(wedding, "announcement.quotation")),
        field("Quotation source", "announcement.quotationSource", readText(wedding, "announcement.quotationSource")),
        field("Continue button", "opening.continueLabel", readText(wedding, "opening.continueLabel")),
      ]),
      couple: block("Couple", [
        field("Heading", "couple.kicker", readText(wedding, "couple.kicker")),
        area("First partner line", "couple.oneLine", readText(wedding, "couple.oneLine")),
        area("Second partner line", "couple.twoLine", readText(wedding, "couple.twoLine")),
        area("Sample note", "couple.note", readText(wedding, "couple.note")),
      ]),
      celebration: block("Solemnization and reception", [
        field("Heading", "celebration.heading", readText(wedding, "celebration.heading")),
        field("Date line", "celebration.dateLine", readText(wedding, "celebration.dateLine") || (
          readText(wedding, "date.weekday") + " " + readText(wedding, "date.day") + " " +
          readText(wedding, "date.month") + " " + readText(wedding, "date.year") + " · " +
          readText(wedding, "date.time")
        )),
        field("Solemnization heading", "celebration.ceremony.label", readText(wedding, "celebration.ceremony.label")),
        field("Solemnization time", "celebration.ceremony.time", readText(wedding, "celebration.ceremony.time")),
        field("Solemnization place", "celebration.ceremony.place", readText(wedding, "celebration.ceremony.place")),
        area("Solemnization words", "celebration.ceremony.detail", readText(wedding, "celebration.ceremony.detail")),
        field("Reception heading", "celebration.reception.label", readText(wedding, "celebration.reception.label")),
        field("Reception time", "celebration.reception.time", readText(wedding, "celebration.reception.time")),
        field("Reception place", "celebration.reception.place", readText(wedding, "celebration.reception.place")),
        area("Reception words", "celebration.reception.detail", readText(wedding, "celebration.reception.detail")),
        field("Attire label", "celebration.attire.label", readText(wedding, "celebration.attire.label")),
        area("Attire", "celebration.attire.text", readText(wedding, "celebration.attire.text")),
        area("Sample note", "celebration.note", readText(wedding, "celebration.note")),
      ]),
      place: block("Location", [
        field("Link label", "nav.location", readText(wedding, "nav.location")),
        field("Heading", "place.heading", readText(wedding, "place.heading")),
        field("Venue", "venue.name", readText(wedding, "venue.name")),
        field("Countdown label", "countdown.label", readText(wedding, "countdown.label") || "Until the day"),
        field("Street", "venue.street", readText(wedding, "venue.street")),
        area("Venue note", "place.note", readText(wedding, "place.note")),
        field("Google Maps label", "venue.mapLabel", readText(wedding, "venue.mapLabel")),
        field("Google Maps link", "venue.mapUrl", readText(wedding, "venue.mapUrl")),
        field("Waze label", "place.wazeLabel", readText(wedding, "place.wazeLabel")),
        field("Waze link", "place.wazeUrl", readText(wedding, "place.wazeUrl")),
        area("Photo file names, one per line", "place.photos", photos.join("\n")),
        field("Empty photo note", "place.photoPlaceholder", readText(wedding, "place.photoPlaceholder")),
        timelineFields(wedding.place.timeline),
      ]),
      reply: block("RSVP", [
        field("Link label", "nav.rsvp", readText(wedding, "nav.rsvp")),
        field("Heading", "rsvp.heading", readText(wedding, "rsvp.heading")),
        area("Introduction", "rsvp.intro", readText(wedding, "rsvp.intro")),
        area("Note", "rsvp.note", readText(wedding, "rsvp.note")),
      ]),
      wishes: block("Wishes", [
        field("Link label", "nav.wishes", readText(wedding, "nav.wishes")),
        field("Heading", "guestbook.heading", readText(wedding, "guestbook.heading")),
        area("Introduction", "guestbook.intro", readText(wedding, "guestbook.intro")),
      ]),
      closing: block("Closing", [
        area("Thank you", "closing.thankYou", readText(wedding, "closing.thankYou")),
        field("Prayer label", "closing.prayerLabel", readText(wedding, "closing.prayerLabel")),
        area("Closing prayer", "closing.prayer", readText(wedding, "closing.prayer")),
        field("Sign-off", "closing.closing", readText(wedding, "closing.closing")),
        area("Closing note", "closing.note", readText(wedding, "closing.note")),
      ]),
    };
    var order = guestPageIds(wedding.sceneOrder);
    var html = "";
    var seen = {};
    order.forEach(function (id) {
      if (!pages[id] || seen[id]) return;
      seen[id] = true;
      html += pages[id];
    });
    Object.keys(pages).forEach(function (id) {
      if (seen[id]) return;
      html += pages[id];
    });
    return html;
  }

  function guestPageIds(order) {
    var pages = [];
    (Array.isArray(order) ? order : SCENE_IDS).forEach(function (id) {
      if (id === "closing") pages.push("reply", "wishes", "closing");
      else if (id) pages.push(id);
    });
    var cover = pages.indexOf("opening");
    if (cover > 0) {
      pages.splice(cover, 1);
      pages.unshift("opening");
    } else if (cover < 0) {
      pages.unshift("opening");
    }
    return pages;
  }

  function block(title, parts) {
    return "<fieldset><legend>" + escapeHtml(title) + "</legend>" + parts.join("") + "</fieldset>";
  }

  function field(label, name, value) {
    return (
      '<label class="editor-field"><span>' + escapeHtml(label) + "</span>" +
      '<input name="' + escapeHtml(name) + '" value="' + escapeHtml(value) + '" autocomplete="off">' +
      tune(name) + "</label>"
    );
  }

  function tune(name) {
    if (plainFields[name]) return "";
    var spec = pathValue(activeStyles, name) || {};
    return (
      '<span class="text-tune">' +
      tuneControl("Size", "textStyle." + name + ".size", spec.size, 70, 170) +
      tuneControl("Spacing", "textStyle." + name + ".spacing", spec.spacing, 70, 180) +
      "</span>"
    );
  }

  function tuneControl(label, name, value, min, max) {
    var current = clampNumber(value, min, max, 100);
    return (
      '<span class="tune-control"><span>' + escapeHtml(label) + "</span>" +
      '<input type="range" name="' + escapeHtml(name) + '" min="' + min + '" max="' + max + '" step="1" value="' + current + '">' +
      "<output>" + current + "%</output></span>"
    );
  }

  function bindRanges() {
    form.querySelectorAll(".tune-control input").forEach(function (input) {
      input.addEventListener("input", function () {
        var output = input.parentNode.querySelector("output");
        if (output) output.textContent = input.value + "%";
      });
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

  function clampNumber(value, min, max, fallback) {
    var number = parseFloat(value);
    if (!isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, Math.round(number)));
  }

  function area(label, name, value) {
    return (
      '<label class="editor-field"><span>' + escapeHtml(label) + "</span>" +
      '<textarea name="' + escapeHtml(name) + '" rows="3">' + escapeHtml(value) + "</textarea>" +
      tune(name) + "</label>"
    );
  }

  function timelineFields(items) {
    var rows = "";
    var list = Array.isArray(items) ? items : [];
    var index;
    for (index = 0; index < 4; index += 1) {
      var item = list[index];
      if (!item || typeof item !== "object") item = { time: "", title: "", detail: "" };
      rows +=
        field("Programme " + (index + 1) + " time", "timeline." + index + ".time", item.time || "") +
        field("Programme " + (index + 1) + " title", "timeline." + index + ".title", item.title || "") +
        field("Programme " + (index + 1) + " detail", "timeline." + index + ".detail", item.detail || "");
    }
    return rows;
  }

  function orderBlock(order) {
    var list = Array.isArray(order) ? order : SCENE_IDS.slice();
    var rows = list.map(function (id, index) {
      return (
        '<div class="order-row" data-id="' + id + '"><span>' + (index + 1) + ". " + SCENE_NAMES[id] + "</span>" +
        '<span><button type="button" data-move="up">Up</button> <button type="button" data-move="down">Down</button></span></div>'
      );
    }).join("");
    return "<fieldset><legend>Scene order</legend>" + rows + "</fieldset>";
  }

  function bindOrder() {
    form.querySelectorAll("[data-move]").forEach(function (button) {
      button.addEventListener("click", function () {
        var row = button.closest(".order-row");
        var sibling = button.getAttribute("data-move") === "up" ? row.previousElementSibling : row.nextElementSibling;
        if (!sibling) return;
        if (button.getAttribute("data-move") === "up") row.parentNode.insertBefore(row, sibling);
        else row.parentNode.insertBefore(sibling, row);
        renumber();
        onEdit();
      });
    });
  }

  function renumber() {
    form.querySelectorAll(".order-row").forEach(function (row, index) {
      var id = row.getAttribute("data-id");
      row.querySelector("span").textContent = (index + 1) + ". " + SCENE_NAMES[id];
    });
  }

  function collect() {
    var data = { sceneOrder: [], place: { timeline: [{}, {}, {}, {}], photos: [] } };
    Array.prototype.forEach.call(form.elements, function (element) {
      if (!element.name) return;
      if (element.name.indexOf("timeline.") === 0) {
        var parts = element.name.split(".");
        var slot = Number(parts[1]);
        if (!isFinite(slot) || slot < 0 || slot > 3 || !parts[2]) return;
        if (!data.place.timeline[slot]) data.place.timeline[slot] = {};
        data.place.timeline[slot][parts[2]] = element.value;
        return;
      }
      if (element.name === "place.photos") {
        data.place.photos = element.value.split(/\n+/).map(function (line) { return line.trim(); }).filter(Boolean);
        return;
      }
      setPath(data, element.name, element.value);
    });
    data.sceneOrder = Array.prototype.map.call(form.querySelectorAll(".order-row"), function (row) {
      return row.getAttribute("data-id");
    });
    data.place.timeline = data.place.timeline.filter(function (item) {
      return item.time || item.title || item.detail;
    });
    if (data.contact && data.contact.people && !Array.isArray(data.contact.people)) {
      data.contact.people = Object.keys(data.contact.people).sort(function (a, b) {
        return Number(a) - Number(b);
      }).map(function (key) {
        var person = data.contact.people[key] || {};
        return {
          role: person.role || "",
          name: person.name || "",
          phone: person.phone || ""
        };
      });
    }
    if (!data.contact) data.contact = {};
    if (!Array.isArray(data.contact.people) || !data.contact.people.length) {
      data.contact.people = [{ role: "", name: "", phone: "" }];
    }
    data.contact.role = data.contact.people[0].role || "";
    data.contact.name = data.contact.people[0].name || "";
    data.contact.phone = data.contact.people[0].phone || "";
    return data;
  }

  function setPath(target, path, value) {
    var parts = path.split(".");
    var cursor = target;
    var index;
    for (index = 0; index < parts.length - 1; index += 1) {
      if (!cursor[parts[index]] || typeof cursor[parts[index]] !== "object") cursor[parts[index]] = {};
      cursor = cursor[parts[index]];
    }
    cursor[parts[parts.length - 1]] = value;
  }

  function loadDraft() {
    return readStore(DRAFT_KEY) || readStore(PUBLISHED_KEY);
  }

  function mergeView(extra) {
    var copy = JSON.parse(JSON.stringify(base));
    ensureAdminShape(copy);
    if (!extra || typeof extra !== "object" || Array.isArray(extra)) return copy;
    overlay(copy, extra);
    ensureAdminShape(copy);
    return copy;
  }

  function ensureAdminShape(wedding) {
    wedding.date = asObject(wedding.date);
    wedding.opening = asObject(wedding.opening);
    wedding.couple = asObject(wedding.couple);
    wedding.announcement = asObject(wedding.announcement);
    wedding.celebration = asObject(wedding.celebration);
    wedding.celebration.ceremony = asObject(wedding.celebration.ceremony);
    wedding.celebration.reception = asObject(wedding.celebration.reception);
    wedding.celebration.attire = asObject(wedding.celebration.attire);
    wedding.venue = asObject(wedding.venue);
    wedding.place = asObject(wedding.place);
    if (!Array.isArray(wedding.place.timeline)) wedding.place.timeline = [];
    if (!Array.isArray(wedding.place.photos)) wedding.place.photos = [];
    wedding.closing = asObject(wedding.closing);
    wedding.nav = asObject(wedding.nav);
    wedding.rsvp = asObject(wedding.rsvp);
    wedding.guestbook = asObject(wedding.guestbook);
    wedding.contact = asObject(wedding.contact);
    wedding.contact.people = contactList(wedding.contact);
    wedding.countdown = asObject(wedding.countdown);
    if (!wedding.textStyle || typeof wedding.textStyle !== "object" || Array.isArray(wedding.textStyle)) wedding.textStyle = {};
    if (!Array.isArray(wedding.sceneOrder)) wedding.sceneOrder = SCENE_IDS.slice();
  }

  function asObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value;
  }

  function copyStrings(target, extra) {
    var copy = asObject(target);
    if (!extra || typeof extra !== "object" || Array.isArray(extra)) return copy;
    Object.keys(extra).forEach(function (key) {
      if (typeof extra[key] === "string") copy[key] = extra[key];
    });
    return copy;
  }

  function contactList(contact) {
    contact = contact || {};
    if (Array.isArray(contact.people) && contact.people.length) {
      return contact.people.map(function (person) {
        person = person || {};
        return {
          role: typeof person.role === "string" ? person.role : "",
          name: typeof person.name === "string" ? person.name : "",
          phone: typeof person.phone === "string" ? person.phone : ""
        };
      });
    }
    return [{
      role: contact.role || "",
      name: contact.name || "",
      phone: contact.phone || ""
    }];
  }

  function contactBlock(wedding) {
    var people = contactList(wedding.contact);
    var parts = [];
    people.forEach(function (person, index) {
      parts.push('<p class="contact-count">Contact ' + (index + 1) + "</p>");
      parts.push(field("Role", "contact.people." + index + ".role", person.role));
      parts.push(field("Name", "contact.people." + index + ".name", person.name));
      parts.push(field("Phone", "contact.people." + index + ".phone", person.phone));
      if (people.length > 1) {
        parts.push('<button class="text-button contact-remove" type="button" data-remove-contact="' + index + '">Remove</button>');
      }
    });
    parts.push('<button class="text-button" type="button" id="add-contact">Add a contact</button>');
    return block("Contact person", parts);
  }

  function overlay(copy, extra) {
    ["partnerOne", "partnerTwo", "music"].forEach(function (key) {
      if (typeof extra[key] === "string") copy[key] = extra[key];
    });
    ["date", "opening", "couple", "announcement", "venue", "nav", "rsvp", "guestbook", "contact", "countdown"].forEach(function (group) {
      copy[group] = copyStrings(copy[group], extra[group]);
    });
    if (extra.contact && typeof extra.contact === "object" && !Array.isArray(extra.contact)) {
      if (Array.isArray(extra.contact.people)) {
        copy.contact.people = extra.contact.people.map(function (person) {
          person = person || {};
          return {
            role: typeof person.role === "string" ? person.role : "",
            name: typeof person.name === "string" ? person.name : "",
            phone: typeof person.phone === "string" ? person.phone : ""
          };
        });
      } else if (typeof extra.contact.name === "string" || typeof extra.contact.phone === "string" || typeof extra.contact.role === "string") {
        copy.contact.people = [{
          role: copy.contact.role || "",
          name: copy.contact.name || "",
          phone: copy.contact.phone || ""
        }];
      }
    }
    if (extra.celebration && typeof extra.celebration === "object" && !Array.isArray(extra.celebration)) {
      copy.celebration = copyStrings(copy.celebration, {
        heading: extra.celebration.heading,
        dateLine: extra.celebration.dateLine,
        note: extra.celebration.note
      });
      ["ceremony", "reception", "attire"].forEach(function (group) {
        copy.celebration[group] = copyStrings(copy.celebration[group], extra.celebration[group]);
      });
    }
    if (extra.place && typeof extra.place === "object" && !Array.isArray(extra.place)) {
      copy.place = copyStrings(copy.place, extra.place);
      if (Array.isArray(extra.place.timeline)) copy.place.timeline = extra.place.timeline;
      if (Array.isArray(extra.place.photos)) copy.place.photos = extra.place.photos;
    }
    if (extra.closing && typeof extra.closing === "object" && !Array.isArray(extra.closing)) {
      copy.closing = copyStrings(copy.closing, extra.closing);
    }
    if (extra.textStyle && typeof extra.textStyle === "object" && !Array.isArray(extra.textStyle)) {
      try { copy.textStyle = JSON.parse(JSON.stringify(extra.textStyle)); } catch (error) { copy.textStyle = {}; }
    }
    if (Array.isArray(extra.sceneOrder)) {
      copy.sceneOrder = extra.sceneOrder.filter(function (id, index, list) {
        return SCENE_IDS.indexOf(id) !== -1 && list.indexOf(id) === index;
      });
      SCENE_IDS.forEach(function (id) {
        if (copy.sceneOrder.indexOf(id) === -1) copy.sceneOrder.push(id);
      });
    }
  }

  function mergeForExport(extra) {
    var copy = JSON.parse(JSON.stringify(base));
    overlay(copy, extra);
    copy.adminPasswordHash = base.adminPasswordHash;
    return copy;
  }

  function readStore(key) {
    try {
      var parsed = JSON.parse(localStorage.getItem(key) || "null");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function writeStore(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
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

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  if (sessionStorage.getItem(SESSION_KEY) === "yes") openStudio();
})();
