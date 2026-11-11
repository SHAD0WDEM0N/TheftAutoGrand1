## Standard 800×600 display default

The browser now uses an **800×600 CSS-pixel 4:3 presentation viewport** on desktop, fitting within smaller windows and preserving 4:3 proportions in fullscreen. This is an *output* size, not a forced native VGA/SVGA mode. Every GTA and London edition retains its working DOS executable and colour depth; the browser renderer presents the original video frame at the correct outer ratio. Modern browser canvases use RGBA output internally, which does not imply that the DOS executable must run in a 32-bit video mode.

The output fix does not claim to correct all **internal** DOS pixel-aspect problems: a 320×200 VGA game can still require pixel-aspect correction at the emulator layer. If a mode still looks stretched after this update, inspect the actual native mode and capture a screenshot before changing the verified game startup. Classic DOSBox offers `[render] aspect=true` for non-square-pixel modes, but that needs testing alongside js-dos's 4:3 renderer to avoid double correction.

## Portable Save Manager — Phase 1

The in-player **Save Manager** replaces the old **Export save / backup** control. Select a game slot (**GTA 1997**, **London 1969** or **London 1961**) and use:

- **Save Progress** while that game is running: pauses the emulator, calls `ci.persist(false)` to capture the entire DOS **filesystem** as a ZIP-based `.jsdos` bundle, validates it, then stores the latest backup for that game separately in the browser's IndexedDB. Save the game in GTA's own menu first, if applicable, so its progress is actually written to disk.
- **Export Backup**: downloads the current local slot's complete `.jsdos` filesystem archive. It may contain the full copyrighted game, not just a tiny progress file; keep it private. The backup is potentially large and browser storage space may be insufficient.
- **Import Backup**: after ending any running session, choose a `.jsdos` backup and the destination game slot, validate its game executables, London files and DOSBox startup configuration, and confirm before replacing the local slot. The next **Play** uses this restored filesystem, including the save files stored inside the backup.

Each game has **one latest backup slot**, separate from the original GTA quick-start shortcut. Existing saved GTA quick-start data is preserved by the database upgrade. Browser data can be cleared and storage quotas vary, so **export a file** if you need a dependable off-device backup.

**This is not a save state**: it does not capture CPU, RAM, sound or the exact point in a running mission. It preserves only files on the emulated drive, which may include normal in-game save progress. Backups do not hot-swap into an active DOSBox session. True freeze-and-resume save states require a separate emulator-backend investigation.

## London graphics edition selection

The **Graphics edition** control is now scoped to the currently selected game. GTA 1997 still uses the original `GTA8.EXE` / `GTA24.EXE` modes (when verified); London 1969 uses `GTA8_UK.EXE` and `GTA24_UK.EXE`; London 1961 currently exposes `GTA24_61.EXE` only. Each available mode is checked against the private bundle's ZIP directory. You can switch the game edition and independently select a DOS executable for that game. Choices apply to the **next launch**; they do not hot-swap a running DOS process.

The **Default (bundled London launcher)** option preserves the exact working CleanBoot V3 launch route, especially the user-tested London 1969 8-bit startup. Choosing an explicit London graphics mode makes a temporary in-memory replacement of the DOSBox `[autoexec]` batch call, launching the chosen exe from `GTADOS` with `-nounivbe` for 24-bit modes. No game files or original batches are overwritten. 24-bit London modes need real-world browser testing and can have driver/mode compatibility problems.

**Screen mode (F11)** is not a renderer setting and cannot enable an unsupported internal DOS video mode. It is disabled for the London 1969 8-bit/default variant confirmed to lack usable F11 switching; in other modes it requests F11 but makes no guarantee that the executable will change resolutions. Website graphics presets (Original/Scale2x/Smart HD/Vibrant/CRT) continue to operate as separate presentation-only effects. 3dfx modes are not advertised without a tested Glide-capable backend.

## Upload menu and readiness fix

The **Add game files** control is a real click-to-open HTML disclosure menu, not a native select requiring the user to hold or drag the mouse. Click once to open, then click **Add GTA Data File**, **Add Mission Pack 1 Data File**, or **Add Mission Pack 2 Data File** to open that file picker.

The launcher displays each filename with **Checking**, **Verified** or a concrete **Not compatible** error. The verification summary no longer resets to generic "Not loaded" after a failed inspection; instead it displays the exact error so the user can correct the file. Files that pass structural checks are marked verified without waiting for emulator scripts to download from the CDN. js-dos itself loads only when launching, allowing readiness to remain visible even with a network error.

A verified London 1969 bundle becomes selectable once GTA is loaded; London 1961 requires the base GTA plus both mission pack bundles. These checks are structural only, not a guarantee that actual London gameplay boots. No GTA or London files are uploaded to GitHub.

## Edition-aware Add game files menu

The GTA launch screen now has a three-option **Add game files** dropdown replacing the former generic Add File button. Select **Add GTA Data File**, **Add Mission Pack 1 Data File — London 1969**, or **Add Mission Pack 2 Data File — London 1961**. Each choice opens the appropriate private file picker. A visible three-line status panel reports which slot is loaded, and a structurally verified mission pack automatically selects its playable edition when prerequisites are present.

Mission pack validation goes further than the generic ZIP check: it inspects the archive directory for the edition's DOS executables, shared London files and the appropriate batch script, then checks that the embedded DOSBox `[autoexec]` configuration calls **london.bat** (1969) or **London61.bat** (1961). Unsupported/mislabelled bundles show explicit errors and cannot unlock the edition selector. The exact converted files `GTA-London-1969_DOS.jsdos` and `GTA-London-1961_DOS.jsdos` have the expected layouts. It does **not** prove that the game launches correctly under js-dos or that a copy contains all original game resources; the user still needs to test gameplay.

London 1969 becomes selectable once the GTA 1997 bundle and structurally valid London 1969 bundle are loaded. London 1961 becomes selectable once all three have been loaded and verified. Files remain on the user's PC, and no copyrighted game files are committed to GitHub.

## Enhanced Graphics Phase 3 and GTA London uploads

**Smart HD · GPU** is a new, opt-in graphics mode available before launching and during gameplay. It applies a dependency-free WebGL1 fragment shader that analyses adjacent DOS pixels for diagonal edge reconstruction, aiming to improve sprites and scenery with less CPU work than Scale2x. It does **not** supply higher-resolution textures, change the internal GTA video mode, or perform an xBR remake. Source video modes up to 640×480 are supported, with the original sharp renderer remaining visible if WebGL is unavailable. Existing Original, Scale2x, Vibrant and CRT modes remain available. The added graphics engine is permanently in `site/gpu-upscale.js`; no external mod is installed.

**Quiet DOS startup** and **Auto-skip DOS video setup** are now always enabled on verified private `.jsdos` launches because this configuration was confirmed working on Windows. Their two launch-screen checkboxes have been removed. The guarded auto-Esc remains a one-shot action only during early DOS text-mode detection, not during normal game graphics. **Show DOS / troubleshoot** and **Skip video-mode test (Esc)** remain available during boot. Raw ISO setup sessions remain visible for manual commands.

### GTA: London 1969 and GTA: London 1961 (initial support)

The Game edition selector offers *Grand Theft Auto*, *London 1969* and *London 1961*. Under **Game setup & advanced tools → Game files**, choose your private, **prepared DOS `.jsdos` bundle** for each London expansion. Each uploaded bundle needs its own working `[autoexec]` commands and all required, lawfully obtained game data and dependencies inside it; the website checks file structure only, **not** whether the London executable will successfully boot. London 1969 requires GTA 1; London 1961 requires both GTA 1 and London 1969. The selector keeps London 1969 disabled without a ready base GTA bundle, and London 1961 disabled until both prerequisites are selected.

These London pickers do **not** merge raw expansion ISOs or Windows installers into `Datafile.jsdos`, nor do they alter the base GTA bundle. Launching a London edition currently starts its separately prepared DOS `.jsdos` in the same js-dos emulator. Expanded automatic detection and CD mounting will need hands-on testing using the user's actual London files. Expansion bundles are kept in browser memory for the current page; the existing **Remember this game** button continues to save only the primary GTA bundle. No game assets are distributed in the public repository or uploaded by the site.

## Auto-skip legacy DOS video setup during GTA launch

The launcher now offers **Auto-skip DOS video setup** beside Quiet DOS startup (enabled by default, can be disabled before Play). Some GTA DOS bundles show a SciTech/UniVBE VGA text-mode analysis prompt that waits for **Esc**. The existing visual cover does not move past this blocking prompt. During the early boot interval only, the optional helper watches for a stable DOS text-mode framebuffer at 720×400 or 640×400/350 and sends **one Esc** after at least 6.5 seconds. It stops on graphical frames, when the boot cover is dismissed, when an Esc has already been sent, or after 17 seconds. It never runs in original game graphics mode and does not change `.jsdos` assets or startup scripts. The visible **Skip video-mode test (Esc)** button remains for manual use.

**Caution:** The site cannot prove from text-mode dimensions alone that a particular screen is SciTech. An unrelated persistent DOS text screen could also receive Esc. If the boot still hangs, disable automatic skipping and use **Show DOS** to inspect the exact prompt; fixing a bundled setup utility at its source would require examining the private game's scripts and configuration. GTA uses Esc in gameplay, which is why the helper is restricted to startup. No hardcoded action is taken on the game menu.

# Theft Auto Grand · DOS Garage

A minimal, gameplay-first browser launcher for a personally owned **DOS edition of Grand Theft Auto (1997)**. No game, disc image, installer, artwork, or music is distributed here. Select a file on your device; the application reads it into browser memory rather than uploading it.

## Built-in keyboard controls reference

The website includes a collapsed **⌨ Keyboard Controls** panel immediately below the player bar. Expand it at any time to review original GTA 1 (1997) DOS default keyboard commands for **On Foot**, **Driving**, and **Menus & Shortcuts**. It adapts to mobile-width screens, and uses HTML's built-in disclosure control, so no extra downloads, JavaScript listeners or game-file modifications are needed.

Highlights: arrow keys to walk/steer, Enter to enter/exit cars and select menu items, Ctrl to fire, Space to jump or handbrake, Z/X to change weapons, Tab for horn/special, F5 radio, F6 pause, F8 frame limiter, and F11 native video mode. Esc is the game's back/quit key, though in browser fullscreen it can first exit fullscreen. Click the game picture to restore keyboard focus if key presses affect the webpage instead. Key mappings can differ if the owner customised GTA's original settings.

Controls references: [original GTA DOS manual](https://www.gamesdatabase.org/Media/SYSTEM/Microsoft_DOS/manual/Formated/Grand_Theft_Auto.pdf) and [GTA 1997 controls](https://gta.fandom.com/wiki/Controls_for_GTA_%281997_game%29).

## Boot readiness fix — auto-reveal an already-running GTA

The browser boot cover used to rely on js-dos frame callbacks to detect a colourful game frame, then show a 12-second \"taking longer than expected\" warning even if GTA was already running behind it. The player now checks occasional `ci.screenshot()` framebuffer images as an independent detection method. If two consecutive screenshots look like game graphics, it automatically reveals the display.

For a running GTA8/GTA24 executable that cannot be confirmed visually (for example a dark title screen), the cover also reveals the picture after an 18-second grace period. This fallback carries a trade-off: if GTA is still displaying its own DOS diagnostic screen, that screen may briefly become visible. When the executable cannot be confirmed at all, the cover stays up with **Show game** and **Show DOS** buttons instead of exposing an unknown installer prompt. The user's game archive and existing launch commands are unchanged.

## Boot Cleanup Phase 3 — quiet, reversible startup

The **Quiet DOS startup** checkbox on the launch screen is enabled by default for your private `.jsdos` game. It creates a **temporary in-browser copy of the archive's DOSBox startup configuration**, adding `@echo off` and `cls` as needed. This suppresses most command echo and clears the initial DOS banner, but it **does not suppress every message produced by DOSBox or a game utility**. The original bundle, executable, saved data and settings remain unchanged. Untick the box to use the exact original startup configuration.

The loading cover now starts for **every verified private `.jsdos`**, even if it launches via an indirect `GTA.BAT` or another batch script. Previously the cover applied only to bundles explicitly launching `GTA8.EXE` or `GTA24.EXE`. Raw ISO imports remain visible so DOS installation commands can be entered.

A **SciTech Display Doctor mode-analysis prompt** may still block an unattended start. The existing **Skip video-mode test (Esc)** button sends Esc only at your request, and **Show game** / **Show DOS / troubleshoot** remain available. This phase intentionally does not remove SciTech executable calls or skip unknown installation steps automatically; doing so without inspecting the personal game's startup scripts risks breaking video modes. If a prompt continues to appear, the next step is to inspect the DOSBox `[autoexec]` lines and any referenced startup batch scripts in your own bundle.

Verified with automated tests for original and compressed ZIP bundles, GTA8/GTA24 switching, line endings, exact-source preservation, and unknown batch launches. A Windows test with the real game is still necessary to confirm the visible startup improvement.

## Enhanced Graphics Phase 2 — real Scale2x + safer GTA24 boot (built in)

### Before starting GTA
A new **Enhanced graphics** selector appears on the launch screen, before **Play GTA**. It offers:

- **Original:** unchanged sharp DOS pixels
- **Enhanced HD — Scale2x:** site-bundled Scale2x neighbour-aware 2× source-pixel upscaling for suitable low-resolution modes
- **Enhanced HD + vivid colour:** the same Scale2x processing plus optional higher saturation and contrast
- **CRT Classic:** the Phase 1 lightweight CRT colour/scanline presentation

The preset is also available under the game screen while playing; both selectors stay in sync. No enhanced-graphics mod download, user-supplied add-on, separate installer, copyrighted replacement sprite, shader CDN, game backup modification or private file upload is required. The algorithm is committed as `site/scale2x.js` and runs on js-dos frame events in the browser.

**Technical limits:** Scale2x is a *real edge-aware pixel resampling algorithm*, but not an HD-remake: it computes a 2× picture from each DOS frame rather than introducing original higher-resolution sprites or textures. To avoid slowdowns, it processes frames at most 25 times/second and only when the native DOS framebuffer is at most 400×300 pixels. Higher F11 modes (for example 640×480) retain the original crisp native renderer; don't confuse the 2× output canvas with genuine HD source detail. Both windows and fullscreen remain 4:3. If the enhancement canvas fails, the normal game image stays visible.

### GTA24 startup video-mode analysis
The earlier boot splash unmasked the game about 1 second after detecting `GTA24.EXE`, even if SciTech Display Doctor was *still showing a text prompt*. Executable detection now **does not unmask DOS**. The boot cover waits for several consecutive colourful game frames before revealing the game. Dark or monochrome game menus may not be detected, so the original **Show game** and **Show DOS** buttons remain available.

For the known startup screen shown in the owner's Windows recording, a dedicated **Skip video-mode test (Esc)** control appears once the DOS emulator is ready. The user must press it deliberately; we do not automatically send Esc to every GTA24 launch because Esc can also dismiss menus or intro screens. This may shorten a video-mode analysis prompt but is not guaranteed to remove all DOSBox or game-specific startup text. If the game won't boot unattended, inspect the personal `.jsdos` configuration and game setup separately; no amount of screen masking can correct a program that's waiting for mandatory input.

This is a website-side enhancement; the original private game file is unchanged. The DOSBox game itself, its commands and proprietary content are not embedded in GitHub Pages.

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
