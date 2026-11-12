(function () {
  var base = window.WEDDING;
  var gate = document.getElementById("gate");
  var studio = document.getElementById("studio");
  var form = document.getElementById("editor");
  var preview = document.getElementById("preview");
  var DRAFT_KEY = "wedding-card-draft";
  var PUBLISHED_KEY = "wedding-card-published";
  var SESSION_KEY = "wedding-admin-open";
  var SCENE_IDS = ["opening", "couple", "celebration", "closing"];
  var SCENE_NAMES = {
    opening: "Kulit",
    couple: "Pengenalan pengantin",
    celebration: "Akad dan majlis",
    closing: "Penutup",
  };
  var activeStyles = {};
  var plainFields = {
    music: true,
    "venue.mapLabel": true,
    "venue.mapUrl": true,
    "place.wazeLabel": true,
    "place.wazeUrl": true,
    "place.photos": true
  };

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
        error.textContent = "Kata laluan tidak sepadan.";
        return;
      }
      sessionStorage.setItem(SESSION_KEY, "yes");
      openStudio();
    }).catch(function () {
      error.hidden = false;
      error.textContent = "Pelayar ini tidak dapat menyemak kata laluan.";
    });
  }

  function openStudio() {
    gate.hidden = true;
    studio.hidden = false;
    /* Always reload preview with cache-bust so admin matches guest code */
    if (preview) {
      preview.src = "../?preview=draft&v=2.0&t=" + Date.now();
    }
    buildForm(loadDraft());
    sendPreview(loadDraft());
    if (form.dataset.bound === "yes") return;
    form.dataset.bound = "yes";
    form.addEventListener("input", onEdit);
    form.addEventListener("change", onEdit);
    form.addEventListener("submit", onSave);
    window.addEventListener("message", onPreviewMessage);
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

  function cloneStyle(value) {
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(cloneStyle);
    var copy = {};
    Object.keys(value).forEach(function (key) { copy[key] = cloneStyle(value[key]); });
    return copy;
  }

  function deepMergePatch(target, patch) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) return target;
    Object.keys(patch).forEach(function (key) {
      if (key === "textStyle") return;
      var value = patch[key];
      if (Array.isArray(value)) {
        target[key] = value.map(function (item) {
          return item && typeof item === "object" ? cloneStyle(item) : item;
        });
        return;
      }
      if (value && typeof value === "object") {
        if (!target[key] || typeof target[key] !== "object" || Array.isArray(target[key])) target[key] = {};
        deepMergePatch(target[key], value);
        return;
      }
      target[key] = value;
    });
    return target;
  }

  function commitDraft(alsoPublish) {
    var existing = readStore(DRAFT_KEY) || readStore(PUBLISHED_KEY) || {};
    var collected = collect();
    var draft = deepMergePatch(cloneStyle(existing), collected);
    draft.textStyle = mergeStyleTree(cloneStyle(existing.textStyle || {}), collected.textStyle || {});
    if (Array.isArray(existing.textBoxes)) draft.textBoxes = cloneStyle(existing.textBoxes);
    if (Array.isArray(existing.widgets)) draft.widgets = cloneStyle(existing.widgets);
    draft.sceneOrder = collected.sceneOrder && collected.sceneOrder.length ? collected.sceneOrder.slice() : draft.sceneOrder;
    if (collected.place && Array.isArray(collected.place.timeline)) {
      draft.place = draft.place || {};
      draft.place.timeline = collected.place.timeline;
    }
    if (collected.place && Array.isArray(collected.place.photos)) {
      draft.place = draft.place || {};
      draft.place.photos = collected.place.photos.slice();
    }
    if (collected.contact && Array.isArray(collected.contact.people)) {
      draft.contact = draft.contact || {};
      draft.contact.people = collected.contact.people.map(function (person) {
        return {
          role: person.role || "",
          name: person.name || "",
          phone: person.phone || ""
        };
      });
      draft.contact.role = draft.contact.people[0] ? draft.contact.people[0].role : "";
      draft.contact.name = draft.contact.people[0] ? draft.contact.people[0].name : "";
      draft.contact.phone = draft.contact.people[0] ? draft.contact.people[0].phone : "";
    }
    writeStore(DRAFT_KEY, draft);
    /* Always mirror to published so the guest page matches admin */
    writeStore(PUBLISHED_KEY, cloneStyle(draft));
    sendPreview(draft);
    return draft;
  }

  function onEdit() {
    commitDraft(false);
  }

  function onSave(event) {
    event.preventDefault();
    var draft = commitDraft(true);
    persistProjectContent(draft).then(function (saved) {
      var note = form.querySelector("#save-note");
      if (!note) return;
      note.hidden = false;
      note.textContent = saved
        ? "Disimpan ke pelayar + content.js projek. Buka jemputan (Ctrl+Shift+R), kemudian publish GitHub/Netlify."
        : "Disimpan dalam pelayar ini. Untuk telefon/hosting: Muat turun content.js dan ganti fail dalam folder projek.";
    });
  }

  function onReset() {
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(PUBLISHED_KEY);
    localStorage.removeItem("wedding-card-edits");
    buildForm(null);
    sendPreview({});
  }

  function onDownload() {
    var draft = commitDraft(true);
    var merged = mergeForExport(draft);
    var text = "window.WEDDING = " + JSON.stringify(merged, null, 2) + ";\n";
    persistProjectContent(merged);
    var blob = new Blob([text], { type: "text/javascript" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "content.js";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function persistProjectContent(draft) {
    var merged = mergeForExport(draft || {});
    var text = "window.WEDDING = " + JSON.stringify(merged, null, 2) + ";\n";
    if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//i.test(window.location.href)) {
      return Promise.resolve(false);
    }
    return fetch("/__save-content", {
      method: "POST",
      headers: { "Content-Type": "text/javascript; charset=utf-8" },
      body: text
    })
      .then(function (res) {
        return res.ok;
      })
      .catch(function () {
        return false;
      });
  }

  function sendPreview(draft) {
    if (!preview) return;
    var payload = draft || {};
    var send = function () {
      if (!preview.contentWindow) return;
      try {
        preview.contentWindow.postMessage({ type: "wedding-enable-edit" }, window.location.origin);
        preview.contentWindow.postMessage({ type: "wedding-preview", payload: payload }, window.location.origin);
      } catch (error) {}
    };
    send();
    setTimeout(send, 60);
    setTimeout(send, 250);
    preview.addEventListener("load", function onLoad() {
      preview.removeEventListener("load", onLoad);
      send();
    });
  }

  function onPreviewMessage(event) {
    if (event.origin !== window.location.origin) return;
    if (!event.data || event.data.type !== "wedding-field-saved") return;
    var payload = event.data.payload;
    if (!payload || typeof payload !== "object") return;
    writeStore(DRAFT_KEY, payload);
    writeStore(PUBLISHED_KEY, payload);
    var active = document.activeElement;
    if (active && form.contains(active)) return;
    buildForm(payload);
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
    form.innerHTML =
      "<h1>Admin jemputan</h1>" +
      '<p class="admin-note">Teks, fon, warna, dan kedudukan: klik sekali pada teks dalam pratonton di kanan. Seret untuk alih. Guna Salin / Tampal kotak teks untuk pendua dalam seksyen yang sama.</p>' +
      '<p class="admin-note">Simpan = tulis ke pelayar + fail content.js (localhost). Kemudian publish GitHub. Pratonton: <a href="../?v=2.0" target="_blank" rel="noopener">buka jemputan</a> (Ctrl+Shift+R).</p>' +
      '<p class="admin-note" id="save-note" hidden></p>' +
      block("Pautan peta", [
        field("Label Google Maps", "venue.mapLabel", readText(wedding, "venue.mapLabel")),
        field("Pautan Google Maps", "venue.mapUrl", readText(wedding, "venue.mapUrl")),
        field("Label Waze", "place.wazeLabel", readText(wedding, "place.wazeLabel")),
        field("Pautan Waze", "place.wazeUrl", readText(wedding, "place.wazeUrl"))
      ]) +
      block("Muzik", [
        field("Fail muzik / URL", "music", readText(wedding, "music"))
      ]) +
      contactBlock(wedding) +
      responsesBlock() +
      '<div class="admin-actions">' +
      '<button class="button" type="submit">Simpan</button>' +
      '<button class="text-button" id="download-card" type="button">Muat turun content.js</button>' +
      '<button class="text-button" id="reset-card" type="button">Guna fail semula</button>' +
      "</div>";
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
    if (value === "yes") return "Hadir";
    if (value === "no") return "Tidak Hadir";
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
            '<label class="editor-field"><span>Nama</span>' +
            '<input data-wish-name="' + index + '" type="text" value="' + escapeAttr(wish.name || "") + '"></label>' +
            '<label class="editor-field"><span>Kehadiran</span>' +
            '<select data-wish-attendance="' + index + '">' +
            '<option value="yes"' + (wish.attendance === "yes" ? " selected" : "") + ">Hadir</option>" +
            '<option value="no"' + (wish.attendance === "no" ? " selected" : "") + ">Tidak Hadir</option>" +
            '<option value=""' + (!wish.attendance ? " selected" : "") + ">Belum ditetapkan</option>" +
            "</select></label>" +
            '<label class="editor-field"><span>Nota</span>' +
            '<textarea data-wish-message="' + index + '" rows="3">' + escapeHtml(wish.message || "") + "</textarea></label>" +
            '<div class="response-actions">' +
            '<button class="button" type="button" data-save-wish="' + index + '">Simpan suntingan</button>' +
            '<button class="text-button" type="button" data-delete-wish="' + index + '">Padam</button>' +
            "</div></article>"
          );
        }).join("")
      : '<p class="admin-note">Belum ada balasan tetamu.</p>';
    return (
      '<fieldset class="response-block"><legend>Balasan tetamu</legend>' +
      '<p class="admin-note">' + wishes.length + " jumlah · " + accept + " hadir · " + decline + " tidak hadir</p>" +
      '<button class="button" id="export-responses" type="button">Muat turun helaian Excel</button>' +
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
      window.alert("Sila kekalkan nama tetamu.");
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
    if (!window.confirm("Padam balasan tetamu ini?")) return;
    wishes.splice(index, 1);
    writeGuestbook(wishes);
    buildForm(loadDraft());
  }

  function exportResponses() {
    var wishes = readGuestbook();
    var lines = ["Nama,Kehadiran,Nota"];
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
      opening: block("Kulit", [
        field("Baris pembuka", "opening.kicker", readText(wedding, "opening.kicker")),
        field("Nama kulit 1", "opening.nameOne", readText(wedding, "opening.nameOne") || readText(wedding, "partnerOne")),
        field("Tanda & kulit", "opening.amp", readText(wedding, "opening.amp") || "&"),
        field("Nama kulit 2", "opening.nameTwo", readText(wedding, "opening.nameTwo") || readText(wedding, "partnerTwo")),
        field("Hari", "date.weekday", readText(wedding, "date.weekday")),
        field("Tarikh", "date.day", readText(wedding, "date.day")),
        field("Bulan", "date.month", readText(wedding, "date.month")),
        field("Tahun", "date.year", readText(wedding, "date.year")),
        field("Masa", "date.time", readText(wedding, "date.time")),
        area("Petikan", "announcement.quotation", readText(wedding, "announcement.quotation")),
        field("Sumber petikan", "announcement.quotationSource", readText(wedding, "announcement.quotationSource")),
        field("Butang teruskan", "opening.continueLabel", readText(wedding, "opening.continueLabel")),
      ]),
      couple: block("Pengantin", [
        field("Tajuk", "couple.kicker", readText(wedding, "couple.kicker")),
        field("Nama halaman 2 — 1", "partnerOne", readText(wedding, "partnerOne")),
        field("Tanda & halaman 2", "couple.amp", readText(wedding, "couple.amp") || "&"),
        field("Nama halaman 2 — 2", "partnerTwo", readText(wedding, "partnerTwo")),
        area("Baris pasangan pertama", "couple.oneLine", readText(wedding, "couple.oneLine")),
        area("Baris pasangan kedua", "couple.twoLine", readText(wedding, "couple.twoLine")),
        area("Nota contoh", "couple.note", readText(wedding, "couple.note")),
      ]),
      celebration: block("Akad dan majlis", [
        field("Tajuk", "celebration.heading", readText(wedding, "celebration.heading")),
        field("Baris tarikh", "celebration.dateLine", readText(wedding, "celebration.dateLine") || (
          readText(wedding, "date.weekday") + " " + readText(wedding, "date.day") + " " +
          readText(wedding, "date.month") + " " + readText(wedding, "date.year") + " · " +
          readText(wedding, "date.time")
        )),
        field("Tajuk akad", "celebration.ceremony.label", readText(wedding, "celebration.ceremony.label")),
        field("Masa akad", "celebration.ceremony.time", readText(wedding, "celebration.ceremony.time")),
        field("Tempat akad", "celebration.ceremony.place", readText(wedding, "celebration.ceremony.place")),
        area("Butiran akad", "celebration.ceremony.detail", readText(wedding, "celebration.ceremony.detail")),
        field("Tajuk majlis", "celebration.reception.label", readText(wedding, "celebration.reception.label")),
        field("Masa majlis", "celebration.reception.time", readText(wedding, "celebration.reception.time")),
        field("Tempat majlis", "celebration.reception.place", readText(wedding, "celebration.reception.place")),
        area("Butiran majlis", "celebration.reception.detail", readText(wedding, "celebration.reception.detail")),
        field("Label pakaian", "celebration.attire.label", readText(wedding, "celebration.attire.label")),
        area("Pakaian", "celebration.attire.text", readText(wedding, "celebration.attire.text")),
        area("Nota contoh", "celebration.note", readText(wedding, "celebration.note")),
      ]),
      place: block("Lokasi", [
        field("Label pautan", "nav.location", readText(wedding, "nav.location")),
        field("Tajuk", "place.heading", readText(wedding, "place.heading")),
        field("Tempat", "venue.name", readText(wedding, "venue.name")),
        field("Label kiraan undur", "countdown.label", readText(wedding, "countdown.label") || "Ketibaan Pengantin"),
        field("Alamat", "venue.street", readText(wedding, "venue.street")),
        area("Nota tempat", "place.note", readText(wedding, "place.note")),
        field("Label Google Maps", "venue.mapLabel", readText(wedding, "venue.mapLabel")),
        field("Pautan Google Maps", "venue.mapUrl", readText(wedding, "venue.mapUrl")),
        field("Label Waze", "place.wazeLabel", readText(wedding, "place.wazeLabel")),
        field("Pautan Waze", "place.wazeUrl", readText(wedding, "place.wazeUrl")),
        area("Nama fail foto, satu setiap baris", "place.photos", photos.join("\n")),
        field("Nota foto kosong", "place.photoPlaceholder", readText(wedding, "place.photoPlaceholder")),
        timelineFields(wedding.place.timeline),
      ]),
      reply: block("RSVP", [
        field("Label pautan", "nav.rsvp", readText(wedding, "nav.rsvp")),
        field("Tajuk", "rsvp.heading", readText(wedding, "rsvp.heading")),
        area("Pengenalan", "rsvp.intro", readText(wedding, "rsvp.intro")),
        area("Nota", "rsvp.note", readText(wedding, "rsvp.note")),
        field("Label nama", "rsvp.nameLabel", readText(wedding, "rsvp.nameLabel")),
        field("Placeholder nama", "rsvp.namePlaceholder", readText(wedding, "rsvp.namePlaceholder")),
        field("Soalan kehadiran", "rsvp.attendanceLabel", readText(wedding, "rsvp.attendanceLabel")),
        field("Pilihan hadir", "rsvp.acceptLabel", readText(wedding, "rsvp.acceptLabel")),
        field("Pilihan tidak hadir", "rsvp.declineLabel", readText(wedding, "rsvp.declineLabel")),
        field("Label nota", "rsvp.noteLabel", readText(wedding, "rsvp.noteLabel")),
        field("Placeholder nota", "rsvp.notePlaceholder", readText(wedding, "rsvp.notePlaceholder")),
        field("Butang hantar", "rsvp.submitLabel", readText(wedding, "rsvp.submitLabel")),
        field("Nota tempatan", "rsvp.localNote", readText(wedding, "rsvp.localNote")),
        field("Tajuk disahkan", "rsvp.confirmedKicker", readText(wedding, "rsvp.confirmedKicker")),
        area("Mesej hadir", "rsvp.acceptMessage", readText(wedding, "rsvp.acceptMessage")),
        area("Mesej tidak hadir", "rsvp.declineMessage", readText(wedding, "rsvp.declineMessage")),
        field("Ubah balasan", "rsvp.editLabel", readText(wedding, "rsvp.editLabel")),
        field("Ralat nama", "rsvp.errorName", readText(wedding, "rsvp.errorName")),
        field("Ralat kehadiran", "rsvp.errorAttendance", readText(wedding, "rsvp.errorAttendance")),
      ]),
      wishes: block("Ucapan", [
        field("Label pautan", "nav.wishes", readText(wedding, "nav.wishes")),
        field("Tajuk", "guestbook.heading", readText(wedding, "guestbook.heading")),
        area("Pengenalan", "guestbook.intro", readText(wedding, "guestbook.intro")),
        field("Label nama", "guestbook.nameLabel", readText(wedding, "guestbook.nameLabel")),
        field("Placeholder nama", "guestbook.namePlaceholder", readText(wedding, "guestbook.namePlaceholder")),
        field("Soalan kehadiran", "guestbook.attendanceLabel", readText(wedding, "guestbook.attendanceLabel")),
        field("Pilihan hadir", "guestbook.acceptLabel", readText(wedding, "guestbook.acceptLabel")),
        field("Pilihan tidak hadir", "guestbook.declineLabel", readText(wedding, "guestbook.declineLabel")),
        field("Label nota", "guestbook.messageLabel", readText(wedding, "guestbook.messageLabel")),
        field("Placeholder nota", "guestbook.messagePlaceholder", readText(wedding, "guestbook.messagePlaceholder")),
        field("Butang hantar", "guestbook.submitLabel", readText(wedding, "guestbook.submitLabel")),
        field("Kosong", "guestbook.empty", readText(wedding, "guestbook.empty")),
        field("Ralat nama", "guestbook.errorName", readText(wedding, "guestbook.errorName")),
        field("Ralat kehadiran", "guestbook.errorAttendance", readText(wedding, "guestbook.errorAttendance")),
        field("Ralat nota", "guestbook.errorMessage", readText(wedding, "guestbook.errorMessage")),
      ]),
      closing: block("Penutup", [
        area("Ucapan terima kasih", "closing.thankYou", readText(wedding, "closing.thankYou")),
        field("Label doa", "closing.prayerLabel", readText(wedding, "closing.prayerLabel")),
        area("Doa penutup", "closing.prayer", readText(wedding, "closing.prayer")),
        field("Tandatangan", "closing.closing", readText(wedding, "closing.closing")),
        area("Nota penutup", "closing.note", readText(wedding, "closing.note")),
        field("Label hubungi", "nav.contact", readText(wedding, "nav.contact")),
        field("Mainkan muzik", "musicPlay", readText(wedding, "musicPlay")),
        field("Jeda muzik", "musicPause", readText(wedding, "musicPause")),
        field("Kiraan: hari", "countdown.daysLabel", readText(wedding, "countdown.daysLabel")),
        field("Kiraan: jam", "countdown.hoursLabel", readText(wedding, "countdown.hoursLabel")),
        field("Kiraan: minit", "countdown.minsLabel", readText(wedding, "countdown.minsLabel")),
        field("Kiraan: saat", "countdown.secsLabel", readText(wedding, "countdown.secsLabel")),
        field("Masa ketibaan", "countdown.arrival", readText(wedding, "countdown.arrival")),
        area("Mesej selesai kiraan", "countdown.done", readText(wedding, "countdown.done")),
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
      tuneControl("Saiz", "textStyle." + name + ".size", spec.size, 70, 170) +
      tuneControl("Huruf", "textStyle." + name + ".letter", spec.letter, 70, 180) +
      tuneControl("Jarak", "textStyle." + name + ".spacing", spec.spacing, 70, 180) +
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
        field("Atur cara " + (index + 1) + " masa", "timeline." + index + ".time", item.time || "") +
        field("Atur cara " + (index + 1) + " tajuk", "timeline." + index + ".title", item.title || "") +
        field("Atur cara " + (index + 1) + " butiran", "timeline." + index + ".detail", item.detail || "");
    }
    return rows;
  }

  function orderBlock(order) {
    var list = Array.isArray(order) ? order : SCENE_IDS.slice();
    var rows = list.map(function (id, index) {
      return (
        '<div class="order-row" data-id="' + id + '"><span>' + (index + 1) + ". " + SCENE_NAMES[id] + "</span>" +
        '<span><button type="button" data-move="up">Naik</button> <button type="button" data-move="down">Turun</button></span></div>'
      );
    }).join("");
    return "<fieldset><legend>Susunan babak</legend>" + rows + "</fieldset>";
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
      plainFields["contact.people." + index + ".role"] = true;
      plainFields["contact.people." + index + ".name"] = true;
      plainFields["contact.people." + index + ".phone"] = true;
      parts.push('<p class="contact-count">Hubungi ' + (index + 1) + "</p>");
      parts.push(field("Peranan", "contact.people." + index + ".role", person.role));
      parts.push(field("Nama", "contact.people." + index + ".name", person.name));
      parts.push(field("Telefon", "contact.people." + index + ".phone", person.phone));
      if (people.length > 1) {
        parts.push('<button class="text-button contact-remove" type="button" data-remove-contact="' + index + '">Buang</button>');
      }
    });
    parts.push('<button class="text-button" type="button" id="add-contact">Tambah hubungan</button>');
    return block("Orang untuk dihubungi", parts);
  }

  function overlay(copy, extra) {
    ["partnerOne", "partnerTwo", "music", "musicPlay", "musicPause", "musicEmpty"].forEach(function (key) {
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
      copy.textStyle = mergeStyleTree(cloneStyle(copy.textStyle || {}), extra.textStyle);
    }
    if (Array.isArray(extra.textBoxes)) {
      copy.textBoxes = extra.textBoxes.map(function (box) {
        if (!box || typeof box !== "object") return null;
        var next = {
          id: String(box.id || ""),
          scene: String(box.scene || "opening"),
          text: String(box.text || ""),
          size: box.size,
          letter: box.letter,
          spacing: box.spacing,
          x: box.x,
          y: box.y,
          font: box.font,
          color: box.color,
          align: box.align
        };
        if (box.fontSizePx != null && box.fontSizePx !== "") next.fontSizePx = box.fontSizePx;
        return next;
      }).filter(function (box) {
        return box && box.id;
      });
    }
    if (Array.isArray(extra.widgets)) {
      copy.widgets = extra.widgets.map(function (item) {
        if (!item || typeof item !== "object") return null;
        var type = String(item.type || "");
        if (type !== "map" && type !== "waze" && type !== "countdown") return null;
        return {
          id: String(item.id || ""),
          scene: String(item.scene || "opening"),
          type: type,
          x: item.x,
          y: item.y
        };
      }).filter(function (item) {
        return item && item.id;
      });
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
