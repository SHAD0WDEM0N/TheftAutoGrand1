# Theft Auto Grand · DOS Garage

A minimal, gameplay-first browser launcher for a personally owned **DOS edition of Grand Theft Auto (1997)**. No game, disc image, installer, artwork, or music is distributed here. Select a file on your device; the application reads it into browser memory rather than uploading it.

## Enhanced Graphics — Phase 1 (built into the website)

**No mod download, separate installer, game file modification, or third-party graphics assets.** Phase 1's own source is committed in `site/graphics.js`, `site/style.css`, `site/index.html` and `site/app.js`, so it ships automatically with GitHub Pages. It works with GTA8.EXE and GTA24.EXE because it affects the rendered browser picture, not the DOS game's own files.

The **Graphics** dropdown below the player has four presets:

| Preset | Rendering effect | Notes |
| --- | --- | --- |
| **Original** | Sharp pixels, no additional colour filters. | Recommended baseline for comparison and troubleshooting. |
| **Enhanced Pixels** | Slightly more contrast and saturation with sharp pixels. | Phase 1 colour correction only, *not* xBR or true edge-aware enlargement. |
| **Vibrant Classic** | More noticeable saturation and contrast. | Optional more colourful GTA look. |
| **CRT Classic** | Light colour adjustment and subtle, static scanlines. | Transparent overlay never catches game input. |

Presets switch instantly without ending the DOSBox session. The preferred preset is saved as a small local browser setting; if storage is disabled or invalid, the launcher falls back to Original. The graphics code is small and has **no per-frame JavaScript image processing**. It preserves the sharp, non-blurry js-dos interpolation and the existing **4:3 letterbox** in windowed and fullscreen modes.

**Limitations:** Phase 1 is intentionally a lightweight visual foundation. It does **not** add higher-resolution game art, replacement sprites, textures, shadows, xBR, Scale2x, a new native GTA engine, or a higher internal video mode. The F11 setting still controls the real GTA framebuffer size. These effects do not modify a screenshot exported using the native js-dos framebuffer capture; to show the visible filter effects in a picture, use the operating system's screen capture. No GTA data is distributed or hosted.

**Phase 1 test on Windows:** Open the deployed Pages site, add your existing private `.jsdos` bundle, play GTA8 and GTA24 and switch all four Graphics presets. Verify that it remains sharp and 4:3 in windowed/fullscreen, that CRT lines are subtle, that performance is stable, and that Original restores the original presentation. Real-game visual quality still requires your feedback because CI doesn't contain the licensed GTA files.

## Direct-to-game startup (hide DOS boot text)

For a verified `.jsdos` bundle with a **direct GTA8.EXE or GTA24.EXE startup**, the player now shows a minimal **Starting GTA…** cover while DOSBox runs the original commands in the background. It polls js-dos's `getRunningProgram()` to detect GTA8 or GTA24, then reveals the game's own title/menu after a brief rendering delay. The existing one-button **Add File → Play GTA** flow and the version selector are unchanged. No Rockstar game assets are added or uploaded, and **the original `.jsdos` file does not need rebuilding**.

This is a **visual startup cover**, not a hack that removes DOSBox or modifies GTA itself. It skips visible command-line text; the operating system/emulator still needs to boot normally. It also does not skip the game's copyright screens, intro, or title menu.

**Improved detection:** The player now watches both the running DOS executable and the emulator's graphical frames. This helps when the backend doesn't report GTA8/GTA24 reliably. The cover no longer drops you into DOS automatically after a timeout. At 12 seconds it offers troubleshooting advice, and you can always select **Show game** to reveal a dark title screen or **Show DOS / troubleshoot** if startup actually needs input. Unknown/batch-file-only startup sequences and raw ISOs remain visible by default, because those may require manual DOS commands.

The automated tests cover GTA executable detection, conditional masking, and both fallback paths. A final Windows browser test with an owned GTA8/GTA24 bundle is still needed before confirming the menu-reveal timing.

## Optional: install your personal GTA bundle in this browser

To make the site behave more like an installed web game, use **Add File** to choose a working private `.jsdos` archive, wait for local verification, then click **Remember this game on this PC**. This saves the entire bundle inside your browser's **IndexedDB storage**, not the publicly hosted GitHub Pages files or an external server. Future visits to the same browser/profile can use **Play GTA** without opening Windows Explorer. GTA8/GTA24 remains selectable when the relevant executables are present.

This is optional: existing **Add File → Play GTA** works without permanent storage, and you can keep using your original `.jsdos` file. The install action asks before replacing an existing browser-saved GTA copy, to avoid overwriting saved progress. Save inside GTA and periodically export a separate `.jsdos` backup: the browser can clear its private storage, or refuse to store a ~750 MiB game when disk quota is insufficient. The installed copy is local to this browser profile and isn't synced to other PCs.

It is **not a native JavaScript port of Rockstar's GTA engine**: DOSBox still emulates the original game in the background. Building a true web-native GTA 1 implementation would require a different game port or compatible engine and separately licensed game resources. We will not redistribute GTA binaries in this public repo.

## Multiple GTA 1 graphics editions (Windows)

This player can now inspect **your own local** `.jsdos` archive for the original GTA DOS executables and show the options that are actually present. Add File → choose your backup → **Graphics edition** appears beneath the Play GTA button. Nothing is uploaded or changed in your original archive.

| Option | Availability | Behavior |
| --- | --- | --- |
| **Original (bundle default)** | Always | Launches the .jsdos using its existing `dosbox.conf` without modifying it. |
| **Standard · GTA8.EXE** | Only when detected and safely switchable | Rewrites a temporary private archive's startup command to the 8-bit GTA DOS executable. |
| **High Colour · GTA24.EXE** | Only when detected in the **same directory** as the configured GTA executable and safely switchable | Uses the alternative 24-bit DOS executable. Actual available resolution and performance depend on the GTA copy. |
| **3dfx Glide (experimental)** | Listed, but disabled pending separate test | The js-dos project advertises WebGL-backed 3dfx emulation, and GTA has a DOS Glide release. However, launching it requires the correct game assets, Glide libraries and DOSBox/DOSBox-X configuration, not merely renaming GTA24.EXE. We will not claim this is ready until explicitly implemented and tested. |

The archive inspection reads only the ZIP directory and the small `.jsdos/dosbox.conf`, not the entire disc. It **does not recursively inspect files inside a `disc.iso` member**. If your imported .jsdos starts via `GTA.BAT` or another indirect script instead of an explicit `GTA8.EXE` or `GTA24.EXE` command, the selector keeps the original profile available but disables speculative automatic switching. This protects a known-working game from an incorrect boot script.

When you select Standard or High Colour, the site constructs a **temporary local ZIP view**: the original large bundle is reused as a Blob, and a replacement DOSBox configuration and central directory are appended. This avoids reading the full game disc into a huge JavaScript ArrayBuffer merely to switch modes. The source `Datafile.jsdos` remains untouched. After verifying a preferred mode in gameplay, export a new private `.jsdos` backup if you'd like that executable to become the default.

**Specific to this project:** The currently confirmed baseline is `GTA8.EXE`, as tested by the owner. The local Windows path to their personal `Datafile.jsdos` does not give GitHub Pages or ChatGPT access to its files; available profiles are discovered when they add that bundle in the browser. High Colour appearing as available only confirms the relevant executable's presence and a patchable startup script, not that gameplay will work.

Sources: <https://www.dosgamesarchive.com/download/grand-theft-auto/> (separate 8-bit, 24-bit and 3dfx DOS versions), <https://js-dos.com/overview.html> (modern js-dos 3dfx support), and <https://js-dos.com/player-api.html> (bundle options). No game files are committed to this repo.

## Add File → Check → Play GTA

The desktop launcher now has **one Play GTA button**, with **+ Add File** directly beneath it. Opening Windows Explorer and choosing a file does not start the emulator or require a second grey Launch button.

After a file is selected, the page checks it **locally**:
- For an `.iso`, it reads the ISO-9660 primary volume descriptor and root-directory structure.
- For a `.jsdos`, it reads the ZIP central directory and checks for the required `.jsdos/dosbox.conf` plus at least one game or disc file.
- It then fetches/initializes the js-dos frontend scripts so Play GTA is only enabled after the initial file checks and required player code are ready.

The checks read small slices of the selected file, not an entire CD-sized image. They check **archive and filesystem structure**, not executable integrity, GTA licensing, complete archive CRCs, game identity, or actual DOSBox gameplay compatibility. The only way to confirm that a particular copy boots and runs correctly is to press Play and test it. A verified ISO may still require DOS installation and manual boot commands. When a browser-local shortcut exists, Play GTA reopens it after its bundle passes the same structural check. No file is uploaded.

**Graphics:** Smooth scaling has been removed from the UI because it blurred GTA's sprites badly. Sharp pixel-art rendering is now always used, with the native F11 options, CRT aspect comparison and WebGL/Canvas fallback still available. These don't create higher-resolution game assets.

The restrained palette now uses orange for Play, teal for file checks and gold for advanced controls rather than any landing-page promotional sections.

## Original DOS GTA screen modes: confirmed details

**F11 is documented** as a screen-mode key in the original GTA DOS documentation, but it does not guarantee an options menu in every game state or executable. In particular, some game discs ship separate `GTADOS/GTA8.EXE` (8-bit/VGA) and `GTADOS/GTA24.EXE` (24-bit DOS) launch targets. The 24-bit variant is the first to investigate for higher-colour/higher-resolution output. The latest launcher adds **Check GTA version** to query the running DOS executable using js-dos's `getRunningProgram()`, and displays the current framebuffer size next to it. It still does not automatically replace the executable or force an unverified high-resolution mode.

A GTA settings file called `GTADATA/PLAYER_A.DAT` holds an option corresponding to display mode. Retail DOS and Classics/Steam files have different structures and should **not** be patched by guessing values. We should first establish the exact executable, version and best working resolution, then save/export a private `.jsdos` archive containing the confirmed settings. A new download of the game's original ISO is not automatically required: a new configured copy of the existing browser backup should be sufficient if the game data and writable settings are present. Keep your old backup.

Original DOS versions do **not** gain native 1080p by changing browser canvas size or DOSBox's `fullresolution` parameter. If F11 does nothing, try the original game during actual gameplay and inspect the `Check GTA version` output rather than automatically forcing unsupported settings. References: [DOS game controls](https://gta.fandom.com/wiki/Controls_for_GTA_%281997_game%29), [GTA DOS executable variants](https://www.abandonware-france.org/ltf_abandon/ltf_jeu.php?id=803), and [GTA settings file format](https://misc.daniel-marschall.de/spiele/gta1/savegame.html).

## 4:3-only display (desktop and fullscreen)

The game display is now **locked to a classic 4:3 presentation** for **both GTA8.EXE and GTA24.EXE**, on the webpage and in fullscreen. The raw/unadjusted pixel-aspect toggle has been removed to avoid accidental squashing or stretching. Fullscreen now uses the browser's native Fullscreen API on the surrounding **4:3 stage**, not the js-dos fullscreen sizing path. On a widescreen Windows monitor (16:9 or ultrawide), the extra space stays **black on the left and right**. Press **Esc** to leave browser fullscreen.

Both DOSBox render options and the outer game viewport are constrained to 4:3. Older VGA modes, especially 320×200 or 640×400, can have non-square original pixels; rendering those in a 4:3 presentation is intentional and does not change the game data or resolution. F11 still controls which internal GTA video mode is active, but the frontend **cannot remove native modes from the game's own list** without modifying its executable. What this change guarantees is that their **displayed proportions** remain 4:3. The native frame-size readout continues to report actual DOS framebuffer dimensions even when they are not numerically 4:3.

No new .jsdos backup or ISO is needed for this 4:3 frontend correction. Game files and existing saves are unchanged. The behaviour should be checked on Windows Chrome/Edge with both GTA8 and GTA24, entering/exiting fullscreen and cycling F11 modes.

## Windows desktop player and display modes

The default screen now shows the game first. There is **no promotional hero, ticker, side advertisement, or permanently open setup panel**. The `Game setup & advanced tools` drawer stays collapsed unless you need to import a personal file, edit DOS launch commands, or save/update your private one-click shortcut. No Rockstar game data is hosted by this site.

Desktop graphics diagnostics (added in the next quality pass):
- **Aspect ratio: 4:3 locked**: DOS and browser fullscreen both display GTA at 4:3. 16:9 stretching and the optional raw-pixel ratio have been removed; widescreen monitors get black side bars.
- **Browser graphics renderer** under advanced settings: **WebGL** (default) or **Canvas** (fallback). Choose before launching. The renderer cannot be changed once an emulator session is running; end and relaunch to compare. This is intended for compatibility testing, not a guaranteed speed/quality improvement.
- **Save screenshot**: export an unmodified native-frame PNG via the js-dos Command Interface. The file is generated locally and is not uploaded to the public repository or a backend. Share it in chat when diagnosing a visual issue. A screenshot size such as 640×480 describes the emulator's output; it is not proof of 1080p native game rendering.
- **Screen mode (F11)** sends the original GTA DOS screen-mode key during gameplay; the exact behavior is edition-dependent, and the version can be checked with the new running-program diagnostic. Certain choices can fail depending on the edition or emulation. Keep a backup before experimenting. <https://www.gamesdatabase.org/Media/SYSTEM/Microsoft_DOS/manual/Formated/Grand_Theft_Auto.pdf>

Desktop controls:
- **+ Add File** opens the local file picker. After the file structure and js-dos frontend load successfully, **Play GTA** becomes active. If you have a private saved shortcut, it can become ready without selecting another file.
- **Picture: Sharp pixels** stays enabled to avoid the excessive blur from smooth interpolation. Aspect and backend preferences can still be remembered locally.
- **GTA display menu (F11)** sends F11 into the running DOS game. This opens the game's own video mode selection (when supported by the edition). The `Native` readout displays the current emulator framebuffer dimensions as reported by js-dos.
- **Fullscreen** uses the browser's fullscreen on the 4:3 game stage, rather than expanding the emulator root to 16:9. Black side bars on a widescreen monitor are expected. Press Esc to exit.
- **Pause**, **End game**, and **Export save / backup** are always outside the hidden emulator UI. The embedded js-dos player runs in kiosk mode; its own sidebar is hidden to make gameplay the main surface.

**Important:** Scaling a 320×200 or 640×480 frame to 1080p/1440p does not increase original art resolution. F11's available modes depend on GTA's DOS edition. Smooth filtering may look softer rather than sharper. No arbitrary 1080p DOS-mode patch, widescreen game modification or new high-resolution textures are included. Validate F11 and all gameplay controls on the actual installed game before calling it a game-quality improvement.

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

## Make a smaller private mobile bundle

**iPhone test result (10 Nov 2026):** Safari reported a page crash while importing a 751.9 MiB `.jsdos` backup, at about 255 MiB / 33.9% of the loading progress. This is consistent with a mobile WebKit memory limit. The site now warns and blocks large mobile imports **by default**, with an explicit opt-in to attempt them anyway. This does not guarantee that smaller bundles will play.

The new layout is a compact DOS utility: the player comes first, desktop settings live in the side panel, and touch screens get hold-to-steer arrow buttons plus GTA's default Enter, Ctrl, Space, Tab, Z, X and Esc controls. Touch controls are not a cure for an out-of-memory crash.

### Create a smaller private copy on Windows

The repo includes `scripts/create_mobile_bundle.py`. It reads and rewrites a **local** .jsdos backup, streaming file-by-file to avoid allocating the full CD image in RAM. It does not upload any game files. You need a *fully installed* game inside the backup. It removes only the disc image you name and preserves the other contents, including installed files and saves.

First export a `.jsdos` backup from a **working desktop GTA session**. Keep the original safe. From PowerShell inside this repository:

```powershell
py .\scripts\create_mobile_bundle.py "C:\path\to\Datafile.jsdos" --list
```

Inspect the list. If it contains a `disc.iso` member and GTA can run from the installed C: files, create a private mobile candidate. Replace the example command with the exact DOS commands that *you* used to start GTA; these may differ by edition and installation path:

```powershell
py .\scripts\create_mobile_bundle.py "C:\path\to\Datafile.jsdos" --boot "c:;cd GTA;GTA.BAT"
```

The tool writes `Datafile-mobile.jsdos` beside the original, reports the removed data and new size, and refuses to overwrite either file. If the disc filename is different, use `--drop "actual/archive/path.iso"` matching the `--list` output. Use `--output "C:\path\to\GTA-Mobile.jsdos"` to choose a different new filename.

**Important:** Some versions of GTA read executable/data/audio content from the CD while running. If the game fails without `disc.iso`, removing it is **not** a valid solution for that edition. Return to the original backup; next we would investigate a correctly prepared, more efficient CD image or a streaming drive. A plain ISO also cannot contain the original CD-audio tracks. Test the compact candidate on **desktop first**, then import it into the iPhone's browser using Files. Keeping the candidate smaller than about 160 MiB avoids the site's mobile warning, but is *not* a guaranteed WebKit memory threshold. Do not publish the ISO, backup, compact copy, or Rockstar assets in this public repository.

If you use the one-click feature on an iPhone, its saved copy is local to the **iPhone browser**; the desktop copy is not automatically synced. Save/export backups regularly.

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
