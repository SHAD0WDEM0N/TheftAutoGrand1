# Theft Auto Grand · DOS Garage

A static, retro-themed browser launcher for a personally owned **DOS edition of Grand Theft Auto (1997)**. No game, disc image, installer, artwork, or music is distributed here. Select a file on your device; the application reads it into browser memory rather than uploading it.

## Publish on GitHub Pages

1. Open **Settings → Pages → Build and deployment → Source**, and select **GitHub Actions**.
2. Open **Actions → Validate and deploy Pages → Run workflow**, choose `main`, and run it. Future pushes to `main` deploy automatically; pull requests only run checks.
3. Wait for the `check` and `deploy` jobs to succeed. The deployment URL should be **https://shad0wdem0n.github.io/TheftAutoGrand1/**. Until a successful deployment, this is an expected address, not a verified live site.

The workflow publishes **only `site/`**, with scoped Pages permissions. No build step, package install, backend, account, or API key is required. Pages must be enabled once in repository settings; the workflow does not change that setting automatically. If your GitHub connection cannot write workflows, add the supplied `.github/workflows/pages.yml` through GitHub with workflow permission, or use the fallback below.

### Branch publishing fallback

Copy the four files inside `site/` to a `docs/` folder on `main`. In Settings → Pages choose **Deploy from a branch**, `main`, `/docs`, then Save. Keep `docs/` in sync manually. Do not publish your ISO or backup.

## When your ISO finishes downloading

### If the download contains MDF + MDS

`GrandTheftAuto.mdf` holds disc sectors; the small `GrandTheftAuto.mds` describes the disc layout. They are a pair, not two separate game discs. Keep them together and do not rename MDF to ISO. This importer does not accept MDF/MDS directly. Inspect the MDS track layout before conversion: a data-only ISO cannot preserve CD audio tracks. Convert the data track to ISO for the current loader, keeping both originals; preserving mixed-mode audio requires a BIN/CUE-capable import flow or a prepared private js-dos bundle. Also check the files inside the disc to confirm it contains a DOS executable: the filename alone does not establish the edition.

See [Alcohol's format restrictions](https://support.alcohol-soft.com/en/knowledgebase.php?postid=15034&title=Restrictions+for+creating+image+files).

1. Open the deployed page in a desktop browser, with a keyboard. First select **Try DOS without a disc**: the terminal should say `Emulator smoke test: OK`. End that session.
2. Choose your `.iso` and select **Launch local game**. A basic ISO-9660 signature check rejects renamed archives. The image is placed at `disc.iso` in the emulator filesystem and mounted read-only as **D:**; **C:** is writable session storage.
3. The default boot commands are `d:` and `dir`. Inspect the directory listing, then run the disc's **DOS installer**. Use `dir *.exe`, `dir *.bat`, and `cd DIRECTORY` as necessary. For example, run `install` only if `INSTALL.EXE` is actually listed. Install onto C:, then run the installed DOS game executable. We deliberately do not assume a particular disc layout or executable path.
4. If sound setup asks, the configured card is **Sound Blaster 16, address 220, IRQ 7, DMA 1, high DMA 5**. CPU cycles are `max`, memory is 64 MB. Adjust `site/core.js` if this edition needs different settings.
5. Click the emulator display to give it keyboard focus. Use its fullscreen controls or the site's Fullscreen button. Esc releases captured pointer input. The actual game controls depend on the game's settings/manual.
6. Save inside the game, preferably exit back to DOS, then choose **Export backup**. Confirm the download completed before closing the tab. It exports the full emulator filesystem as `dos-garage-backup.jsdos`, including installed files and potentially the ISO. Keep that copyrighted-content backup on your own device.
7. Next time, select the exported `.jsdos` instead of the ISO. It includes the original boot configuration; if that returns to D:, switch to C: and run the installed game again. To make a tailored launch configuration, use Boot settings on an ISO session or edit your private bundle with js-dos tools. Never commit the private bundle here.

## Optional one-click launch (private browser copy)

Once GTA is installed and running, you can set it up so later visits only require pressing **Play saved GTA**:

1. Launch your personal ISO or a previously exported .jsdos bundle, install GTA if necessary, and confirm the DOS game runs.
2. Under **One-click garage → Set up or update one-click launch**, type the **DOS commands that actually launch your installed game** (not the setup/installer commands). Example only, if your folder is `C:\GTA`: `c:`, `cd GTA`, `GTA.BAT`. Your actual folder and executable may differ.
3. While the session is running, choose **Save / update one-click shortcut**. The page captures your emulator filesystem as a .jsdos bundle, updates its autoexec script using the entered commands, and saves that bundle into this browser's IndexedDB. The saved copy stays private on your device.
4. On the same browser/profile/device, return to the website and press **Play saved GTA**. No ISO selection or DOS command typing is necessary if the shortcut and game files are still present.
5. After game progress is saved, choose **Save / update one-click shortcut** again to update the locally stored copy; also periodically **Export backup** to a .jsdos file as an independent recovery option.
6. **Forget local GTA shortcut** deletes this site's remembered copy from IndexedDB. It does not delete external backup downloads.

This is a local browser convenience feature, *not* a publicly playable GTA download. Browsers may reject large saved copies due to storage quota or clear private data at any time; private browsing modes are not supported. Do not rely on it as your only save. The player remains intentionally configured without automatic cloud or local incremental saves. The feature uses js-dos bundle configuration utilities to rewrite the private bundle's DOSBox autoexec section; the correct commands must be supplied by the user. GTA gameplay from the saved shortcut is not verified until tested with the actual game files.

## Compatibility and limits

- **GTA gameplay was reported working by the user with their ISO:** the local game was not available for automated regression testing. One-click replay, graphics, sound, controls, performance and save restoration on the new shortcut path still need explicit verification with the actual disc.
- Imports support `.iso` and ZIP-based `.jsdos` bundles, not ordinary ZIPs, BIN/CUE pairs, compressed disc archives, or Windows-only installers. Signature checks detect obvious wrong formats; they are not a full archive integrity check.
- Imports are capped at **900 MiB** before reading the complete file. Several copies can exist in memory during loading/export, so even smaller images can exceed browser memory. Use a prepared smaller DOS bundle if a large ISO crashes the tab. A full backup may exceed the import cap if installation adds many files; use js-dos's file tools to prepare a smaller private bundle in that case.
- ISO images normally omit audio tracks from mixed-mode CDs. Sound effects may work while CD music is absent. Preserving original CD audio requires a different image/import workflow.
- Active sessions are temporary. Automatic and cloud saves are disabled. The optional one-click shortcut is an explicit, private copy of the emulator filesystem held in browser IndexedDB; it is not automatically updated as you play. End-session and tab-close warnings help avoid accidental loss, but browser crashes cannot be intercepted. Export backups regularly and manually update the shortcut after saving.
- Emulator code is loaded on first launch from **jsDelivr**, pinned to **js-dos 8.5.3**, including its matching `dist/emulators/` assets. The one-click shortcut creator also loads the **emulators 8.5.2** bundle utilities if unavailable on the page. Google Fonts supplies the display fonts; system fallbacks work when unavailable. These providers receive normal network requests. No site analytics, game upload endpoint, or server storage is implemented. Imported bundles can contain their own DOS configuration: use trusted personal bundles.
- The page uses normal js-dos worker mode without requiring custom COOP/COEP headers, which GitHub Pages cannot configure. Fullscreen and audio are subject to browser restrictions. Desktop use is the intended experience; the layout adapts to phones but GTA play is not optimised for touch.
- js-dos is third-party software with its own licensing and UI. No upstream branding/licence notices are removed. See [upstream source/licensing](https://github.com/caiiiycuk/js-dos).

## Development and verification

Requires Node.js 24 for the dependency-free checks:

```sh
node --test tests/import.test.mjs
node --check site/app.js
node --check site/core.js
python -m http.server 8765 --directory site
```

Open `http://localhost:8765` (do not open `index.html` directly as a file). `npm test` and `npm run check` are equivalent check shortcuts. Tests cover file limits/types, ISO and bundle signatures, mount ordering, and the no-game smoke configuration.

### Manual acceptance checklist

The original implementation passed four automated tests and JavaScript syntax checks. ChatGPT Work previously tested the no-disc DOS prompt, pause/resume, smoke-test bundle import, end-session and narrow layout. The user has since confirmed GTA itself launches and plays. The new one-click launch tests and first actual shortcut replay have not yet been independently verified.

- Desktop and narrow viewport: readable layout, keyboard navigation and visible focus.
- No-disc test reaches DOS and prints the smoke message; pause/resume, fullscreen, end and restart work.
- Invalid/empty/oversized file produces a readable error and permits retry.
- Actual ISO mounts as D:, DOS installer writes to C:, GTA starts with input and audio.
- Save in game → export → end → import backup → launch → verify save survived.
- Disconnect/block the CDN before first launch: readable download error and retry.

## References

- [js-dos player API](https://js-dos.com/player-api.html)
- [Initialise local files without a bundle](https://js-dos.com/run-without-bundle.html)
- [Command interface and full filesystem export](https://js-dos.com/command-interface.html)
- [DOSBox mount and IMGMOUNT manual](https://www.dosbox.com/DOSBoxManual.html)
- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

Unofficial personal-use fan project. Grand Theft Auto and its assets belong to their respective rights holders. Owning a copy does not mean its files should be redistributed. `.gitignore` excludes common game/media archives as an accident-prevention measure, not a security boundary.
