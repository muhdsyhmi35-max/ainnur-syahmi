# Wedding invitation

A static ivory invitation. The names, date, venue, parent lines, and quotation shipped with it are **sample content**:

- Amira Rahman & Daniel Lim
- Saturday 18 April 2027, 11:00 AM
- The Majestic Hotel Kuala Lumpur, Jalan Sultan Hishamuddin

Replace them before you share the page.

## View it

From this folder:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

- Invitation: http://127.0.0.1:8765/
- Admin: http://127.0.0.1:8765/admin/

The invitation does not link to admin. Guests are not shown the editor.

## Admin

Open http://127.0.0.1:8765/admin/ and enter the password.

The default password is `ivory-card`. Only its SHA-256 hash is stored, in `adminPasswordHash` inside [`content.js`](content.js). To change it, replace that hash with the SHA-256 of your new password:

```bash
python3 -c "import hashlib; print(hashlib.sha256(b'your-new-password').hexdigest())"
```

This lock is only for this file on this computer. It is not an account on a server.

Inside admin you can edit the guest-facing words for all six scenes, the music path, and the scene order. The preview updates as you type and is a draft in this browser. **Save** publishes that draft. After Save, http://127.0.0.1:8765/ in this browser shows the published words. **Use the file again** clears the draft and the published copy and returns to `content.js`.

A different browser still reads `content.js` until you replace that file. **Download content.js** gives you a file you can put in this folder if you want every browser to share the same wording.

RSVP replies and guestbook wishes are kept in this browser only. They are not part of Save, and nothing is sent to a server.

## Music

`music` in `content.js` starts as `""`, so nothing is loaded. The card then shows a small note that music can be added in `content.js`.

To drop in an mp3 you have the rights to use:

1. Copy the file into this folder, for example `music.mp3`.
2. Set `music` to `"music.mp3"`, either in `content.js` or in admin. A full `https://` address works as well.
3. Refresh. A play button appears and stays paused until a guest taps it.

Leave the field empty for no music. Do not add a copyrighted song you do not have rights to share.

## Opening

The first screen is a quiet ivory fade: border flowers sharpen, the page eases into focus, the monogram locks into place, and the names rise in letter by letter, then the date, the quotation, and the bottom nav. It runs for about six seconds. Continue, or any nav item, opens the next page. Each later page fades in and settles from a very small scale, and its lines rise with a short stagger.

The fixed nav is Location, Wishes, and RSVP. Location opens the venue. Wishes opens the guestbook. RSVP opens the reply.

If the guest’s device asks for reduced motion (`prefers-reduced-motion`), the wait is skipped and the full invitation is readable immediately.

## Scenes

Opening, couple introduction, wedding announcement, solemnization and reception, location and programme, and closing. The announcement includes sample parent names and a sample Qur'an quotation. The location scene links to Google Maps and Waze. Venue photographs appear only when the file names in `place.photos` exist in this folder. Otherwise a quiet placeholder is shown.

## What this page does not include

There is no guest login and no server that stores replies for other people.
