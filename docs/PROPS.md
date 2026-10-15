# Designer Knobs

> Every attribute the Webflow Designer sets to tune a `src/` script — timing,
> easing, behaviour, copy, endpoints. Set the attribute (or bind it to a
> component prop on a **DOM** element) and publish; no new tag needed.
> Maintained by `/props` — any commit that adds, renames, removes or re-defaults
> a knob updates this file in the same commit.

**Not listed:** marker hooks (an attribute that only says *this is the panel*,
e.g. `data-oa-saved-row`) and state the scripts write back (`data-*-status`,
`aria-expanded`). Those live in each file's header.

**Reading the tables:** *Default* is what the script uses when the attribute is
missing or invalid. Times are seconds unless marked ms. Eases are GSAP names
(`power2.inOut`, `expo.out`).

---

## Plus rotate — `oa-plus.js`

Newest (v1.0.246). A "+" icon turns when something happens near it: hover on a
button or card, open/close on click, or slide changes on a Lumos slider.
Rebuilt from the camillemormal.com reference
(`07-research/site-element-audits/2026-10-13-plus-symbol-rotate.md`, command
centre). Set on the element that turns, `[data-oa-plus]` — never
`display:inline`.

| Attribute | Default | Controls |
|---|---|---|
| `data-oa-plus-trigger` | `hover` | `hover` — turns on mouse enter, back on leave. `click` — open/close: turns on open, back on close; follows `aria-expanded` on the opener or the first control inside it (e.g. the Clickable in `oa Button Menu`), else alternates. `slide` — +angle per next slide, −angle per previous. |
| `data-oa-plus-angle` | `90` | Degrees per turn. Negative turns anticlockwise. |
| `data-oa-plus-duration` | `0.4` | Turn length. |
| `data-oa-plus-ease` | `power2.inOut` | Turn curve. |
| `data-oa-plus-scope` | — | Flag on an ancestor (e.g. a card, or a button component's wrap) — hover/click there drives the plus. Without it: nearest `a`/`button`, else the plus itself. |

## Line loader — `oa-loader-line.js`

The OA mark's outline draws, holds and erases along one path, looping. Set on
`[data-oa-loader="line"]`.

| Attribute | Default | Controls |
|---|---|---|
| `data-oa-loader-draw` | `1850` ms | Draw-on time. |
| `data-oa-loader-hold` | `590` ms | Hold, fully drawn. |
| `data-oa-loader-release` | `1550` ms | Erase time. |
| `data-oa-loader-gap` | `210` ms | Empty pause before the next loop. |
| `data-oa-loader-stroke` | `1.25` | Line weight in on-screen px, at any size. |
| `data-oa-loader-color` | `currentColor` | Line colour (any CSS colour). |

## Page loader + mark draw — `oa-global.js`

The loader's mark draws its outline on page load; the same draw-on runs on
scroll anywhere a `[data-mark-draw]` SVG sits. Set on the mark SVG.

| Attribute | Default | Controls |
|---|---|---|
| `data-draw-duration` | `2` | Draw-on time (loader mark and `[data-mark-draw]`). |
| `data-draw-start` | `0` | Where on the outline the draw starts (0–1 of its length). Geometry, not taste — leave unless the artwork changes. |
| `data-draw-trigger` | `20` | `[data-mark-draw]` only: how far into the viewport (%) before it plays. Higher = later. |

The ease is a named house curve, deliberately not a knob.

## Directional hover — `oa-global.js`

Tile slides in from the side the pointer entered. Set on the list container.

| Attribute | Default | Controls |
|---|---|---|
| `data-type` | `all` | Axis: `y` (stacked list), `x`, or `all`. |

## Email direct — `oa-global.js`

Builds the `mailto:` only when a person hovers, focuses or touches the link.

| Attribute | Default | Controls |
|---|---|---|
| `data-oa-email` | — | Address split on a pipe: `user\|domain`. Never put a `mailto:` in the Designer link. |

## Text reveal — `oa-text-reveal.js`

Headings and lead paragraphs blur in line by line with a short scramble. Opt in
with `data-oa-reveal`; knobs sit on the same element.

| Attribute | Default | Controls |
|---|---|---|
| `data-oa_reveal_blur` | `10` px | Starting blur. |
| `data-oa_reveal_duration` | `1` | Per-line reveal. |
| `data-oa_reveal_stagger` | `0.15` | Gap between lines. |
| `data-oa_reveal_scramble` | `0.4` | Scramble length at the front of each line. |
| `data-oa_reveal_delay` | `0` | Lead-in before the first line. |
| `data-oa_reveal_start` | `top 90%` | ScrollTrigger start (element edge, viewport line). |

## Intro hero — `oa-intro.js`

`/about` hero: video beat → blur crossfade → ABOUT scrambles in. Set on the
`• oa Intro Hero` section root, `[data-oa_intro-hero]`.

| Attribute | Default | Controls |
|---|---|---|
| `data-oa_intro_hold` | `2.3` | Clean video before anything moves. |
| `data-oa_intro_blur` | `1` | Blur crossfade. |
| `data-oa_intro_scramble` | `1` | Title resolve time. |
| `data-oa_intro_video-fallback` | — | H.264 URL, used where HEVC can't play. |

## Lumos slider — `oa-slider.js`

Every Lumos slider (product, homepage menu). Set on `.slider_element`.

| Attribute | Default | Controls |
|---|---|---|
| `data-speed` | `600` ms | Slide transition. |
| `data-speed-touch` | — | Transition on touch devices; unset = `data-speed`. |
| `data-loop` | `false` | Loop (only when there are enough slides). |
| `data-slides-per-view` | `auto` | Slides visible at once (number or `auto`). |
| `data-follow-finger` | `false` | Slides track the finger while dragging. |
| `data-free-mode` | `false` | Free scroll, no snap. |
| `data-mousewheel` | `false` | Mouse wheel moves slides. |
| `data-slide-to-clicked` | `false` | Clicking a slide makes it active. |
| `data-parallax` | `false` | Swiper parallax on. |

## Homepage hero video — `oa-homepage.js`

Bunny MP4 background. Set on `[data-bunny-background-init]`.

| Attribute | Default | Controls |
|---|---|---|
| `data-player-src` | — | **Required.** H.264 landscape. |
| `data-player-src-hevc` | — | HEVC landscape. Clear it and everything plays H.264. |
| `data-player-src-mobile` | — | H.264 portrait (phones, portrait). |
| `data-player-src-hevc-mobile` | — | HEVC portrait. |
| `data-player-mobile-max` | `767` px | Widest portrait viewport that gets the mobile files. |
| `data-player-autoplay` | `false` | Autoplay. |
| `data-player-muted` | `false` | Start muted. |
| `data-player-lazy` | `false` | `true` = no download until needed. |

On a control button: `data-player-control` = `play` / `pause` / `playpause` / `mute`.

## Legal index accordion — `oa-legal-toc.js`

The "On this page" index folds into an accordion below the Lumos medium
boundary. Set on `[data-legal-toc-accordion]`.

| Attribute | Default | Controls |
|---|---|---|
| `data-legal-toc-duration` | `0.45` | Open time. |
| `data-legal-toc-ease` | `power3.out` | Open curve. |
| `data-legal-toc-duration-close` | `0.3` | Close time. |
| `data-legal-toc-ease-close` | `power2.inOut` | Close curve. |
| `data-legal-toc-stagger` | `0.025` | Gap between links landing on open. |

## Project brief — `oa-brief.js`

`/contact` step-by-step brief. Set on the root `[data-oa-brief]`.

| Attribute | Default | Controls |
|---|---|---|
| `data-oa-brief-endpoint` | — | **Required to send.** `brief-intake` Edge Function URL. |
| `data-oa-brief-turnstile-key` | — | Cloudflare Turnstile site key. |
| `data-oa-brief-response` | `two working days` | The response promise in the copy. |
| `data-oa-brief-exit` | `0.16` | Step fade-out. |
| `data-oa-brief-enter` | `0.4` | Step fade-in. |
| `data-oa-brief-stagger` | `0.04` | Gap between items landing (total capped at 0.24; `0` = off). |
| `data-oa-brief-shift` | `6` px | Rise as items land (`0` = off). |
| `data-oa-brief-tag-fade` | `0.25` | Fade-in of a new piece tag and the Selections label (`0` = off). |
| `data-oa-brief-drawer-enter` | `0.5` | Piece drawer slide-in, and the image box growing with it. |
| `data-oa-brief-drawer-exit` | `0.35` | Piece drawer slide-out, and the image box settling back with it. |
| `data-oa-brief-drawer-stagger` | `0.03` | Gap between drawer rows landing. |

**Copy**, also on the root. `{n}`, `{N}`, `{name}` and `{ref}` are filled in.
Wording: `docs/brief-copy-deck.md`. Knobs marked *per branch* can take an
audience suffix — `-client`, `-home`, `-venue`, `-looking` (e.g.
`data-oa-brief-sent-text-looking`) — which wins over the bare one.

| Attribute | Default | Controls |
|---|---|---|
| `data-oa-brief-progress-text` | `Question {n} of {N}` | Progress line above each step. |
| `data-oa-brief-whole-series-text` | `The whole series` | First row of each series sheet in the piece drawer. |
| `data-oa-brief-drawer-done-text` | `Done` | Drawer Done bar, nothing picked. |
| `data-oa-brief-drawer-count-text` | `Done · {n}` | Drawer Done bar, pieces picked. |
| `data-oa-brief-drawer-full-text` | `Done · {n} max` | Drawer Done bar at the piece cap. |
| `data-oa-brief-sent-text` | `Sent. Thank you, {name}.` | Sent heading. *Per branch.* |
| `data-oa-brief-sent-body-text` | one per audience, in file | Sent body. *Per branch.* |
| `data-oa-brief-ref-text` | `Your reference is {ref}.` | Reference line on the sent screen (never shown to just-looking). *Per branch.* |
| `data-oa-brief-sent-title` | `Sent — New Project Brief` | Browser tab title once sent. *Per branch.* |
| `data-oa-brief-sent-status-text` | `Brief sent.` | Status line once sent. *Per branch.* |
| `data-oa-brief-error-text` | copy in file | Send failed, any reason not below. |
| `data-oa-brief-limit-text` | copy in file | Send refused: too many sends (429). |
| `data-oa-brief-link-text` | copy in file | Send refused: a web link in a short field (400). |

Step scoping (`data-oa-brief-step` / `-branch` / `-when` / `-unless`) is
structure, not tuning — see the file header.

## Saved Items — `oa-saved-items.js`

Saved configurations, nav badge, `/saved-items` list, Share and "Email me
this list".

| Attribute | Set on | Default | Controls |
|---|---|---|---|
| `data-oa-saved-share-endpoint` | Share button | `share-list` function | Where Share posts. |
| `data-oa-saved-share-title` | Share button | `Saved Items · Objects of Agency` | Title on the shared link. |
| `data-oa-saved-email-endpoint` | email panel | `selection-intake` function | Where "Email me" posts. |
| `data-oa-saved-turnstile-key` | email panel | site key in file | Turnstile site key. |
| `data-oa-saved-email-{sending\|sent\|invalid\|limit\|link\|error}-text` | email panel | copy in file | Status line for each outcome. |
| `data-oa-save-price` | product page | — | A static piece's price text (no configurator), e.g. `A$19,000`. |
| `data-oa-saved-line` | row text | — | Which option this line shows: `Sizes` / `Top-Material` / `Timber` / `Anodised-Finish`. |

## Text cursor — `oa-cursor.js`

A bubble follows the mouse and shows a label. Set on any hover target with
`data-cursor-hover`.

| Attribute | Default | Controls |
|---|---|---|
| `data-cursor-text` | — | The label shown. |

## No knobs

`oa-configurator.js`, `oa-all-products.js` (`data-filter-*` are CMS-matched
hooks), `oa-infinite-grid.js`, `oa-whatsapp.js` — their look is Designer
classes; nothing is tuned by attribute.
