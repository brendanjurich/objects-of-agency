# Project Brief — Copy Deck

<!-- created: 2026-09-09 · wayfinder B08 · map: oa-command-centre/inbox/PARKED-2026-09-07-project-brief-intake-map.md -->

Every string the `/contact` brief shows or sends. `oa-brief.js` reads the on-page
copy from the Designer; the email copy lives in the Edge Function templates.
Placeholders: `{RESPONSE}` response promise ·
`{REF}` brief reference · `{NAME}` first name.

Principles: every label is a brand touchpoint; nothing is required except the
email; the duration claim must be true; no lead-time numbers anywhere.

---

## Branches

| id | Screen 1 answer | Path |
|---|---|---|
| `client` | I'm specifying for a client | 1 → 2 → 3/3b → 5 → 6 |
| `home` | It's for my own home | 1 → 2 → 3/3b → 4 → 5 → 6 |
| `venue` | It's for a venue or workplace | 1 → 2 → 3/3b → 4 → 5 → 6 |
| `looking` | I'm just looking | 1 → J → done |

Product-page entry (`?piece=`) skips screen 2, pre-sets "a piece you've seen",
opens screen 3 pre-filled.

---

## Page framing (above the steps, always visible)

**Heading** (existing): New Project Brief

**Lede:** A few short questions, about three minutes. Nothing here is required
except an email to reply to, and you can say as much or as little as you like.

**Progress line** (updates per step; also the page `<title>` prefix):
Question {n} of {N}

`{N}` is fixed once screen 1 is answered: client 5, home/venue 6, looking 2.

**Back link:** Back

**Continue button:** Continue

---

## Screen 1 — Who is this for?

**Question:** Who is this for?

**Sub:** This shapes the questions that follow.

Chips (single, auto-advance):
- I'm specifying for a client
- It's for my own home
- It's for a venue or workplace
- I'm just looking

---

## Screen J — Just looking

**Question:** Anything you'd like to hear about?

**Sub:** We send a note when something new leaves the workshop. Rarely, and
only if you want it.

Chips (multi):
- ViewFinder
- Vesper
- Terroir
- Locus
- Edition pieces
- Custom cabinetry
- No thanks, just browsing

**Email field label:** Email (optional)
**Send button:** Done

**Done state (on page):**
Thanks for looking. If you left an email, you'll hear from us when there's
something worth showing.

---

## Screen 2 — What are you after?

**Question:** What are you after?

**Sub:** Choose any that apply.

Chips (multi; "not sure" clears the others):
- A piece you've seen
- Something bespoke — cabinetry or a commission
- Not sure yet

---

## Screen 3 — Which piece? (shown if "a piece you've seen")

**Question:** Which piece?

**Sub:** Start typing a name, or list a few.

**Field label:** Piece
**Placeholder:** ViewFinder Aurum, XO Sideboard…
**Helper under field:** Press enter to add another.

Autocomplete source: catalogue names (`brief-catalogue.json`, from CMS).
Accepts free text.

---

## Screen 3b — What would it be? (shown if "bespoke")

**Question:** What would it be?

**Sub:** A rough shape is enough.

Chips (multi):
- A table
- Seating
- Storage or cabinetry
- Bed or bedroom
- Joinery for a whole room
- Something else

**Note field label:** In a few words
**Placeholder:** A 3.2 m dining table in blackbutt for a north-facing room…
(this is the flow's only open text box on the bespoke path; screen 5 then shows no note)

---

## Screen 4 — Where, and how much of it? (home and venue only)

**Question:** Where is it going, and how much of it?

**Residential space** (multi):
- Dining
- Living
- Bedroom
- Study
- Outdoor
- Other

**Commercial** (multi):
- Health
- Hospitality
- Workplace
- Retail
- Multi-Res
- Mixed Use
- Education & Science
- Cultural
- Other

**Quantity label:** How many?
Chips (single):
- One piece
- A few
- Ten or more

---

## Screen 5 — When, and a sense of scale

**Question:** When, and a sense of scale?

**Timing label:** When would you like it?
Chips (single):
- No date yet
- This year
- Within six months
- By a date → reveals a month picker, label "Which month?"

**Quantity (client branch only, since screen 4 is skipped):** How many?
- One piece
- A few
- Ten or more

**Budget (client and venue only):** Is there a budget set for this?
Chips (single):
- Yes, and it's firm
- Yes, with some room
- Not yet
- Prefer to discuss

**Materials label:** Any leanings on material?
Chips (multi):
- Timber
- Stone
- Metal
- Laminate
- Still deciding

**Note (not shown if 3b was answered):**
Label: Anything else, in your own words
Sub: As much or as little as you'd like to share.

---

## Screen 6 — You

**Question:** Where should we reply?

**Fields:**
- Name — label "Name"
- Email — label "Email", the only required field. Error: "We need an email to reply to."
- Practice or studio — label "Practice or studio" (client and venue only)

**Privacy line (small, above Send):**
What you've written is used to reply to you and for nothing else. We keep
briefs that don't become a commission for twelve months, then delete them.
[Privacy policy](/privacy)

**Send button:** Send brief

---

## Check-answers (between screen 6 fields and send)

**Heading:** Here's your brief

Each answered question as a row: question · answers · "Change" link that returns
to that screen. Unanswered questions are omitted, not shown as blank.

---

## Sent state (replaces the form)

**Heading:** Sent. Thank you, {NAME}.

**Body, by branch:**

- `client`: We'll read this properly and come back within {RESPONSE} with
  first thoughts and a time to talk. A copy is on its way to your inbox — it's
  written up so you can drop it straight into the project folder.
- `home`: We'll come back within {RESPONSE}. A copy is on its way to your
  inbox with a short note on how a commission works from here.
- `venue`: We'll come back within {RESPONSE} with first thoughts and a time to
  talk. A copy is on its way to your inbox.

**Reference line:** Your reference is {REF}.

---

## Email — sender acknowledgment

**From:** Objects of Agency <hello@objects.agency>
**Subject:** Your brief — {REF}

**Opening:**
{NAME},

Thanks for this. Here's your brief as you gave it to us, written up so it's
useful to you whether or not we go further together.

**Brief block:** the check-answers content, as a clean list under the heading
"Project brief · {REF}".

**What happens next, by branch:**

- `client`: We'll come back within {RESPONSE} with first thoughts, a couple of
  questions if we have them, and a time to talk. If a piece you've named is
  in the catalogue, the spec sheet is linked below.
- `home`: We'll come back within {RESPONSE}. Commissions with us run in three
  short stages — a conversation about the piece, a drawing and a price, then
  making. There's no obligation at any stage before the second.
- `venue`: We'll come back within {RESPONSE} with first thoughts and a time to
  talk. For quantities, we'll ask about the programme early so the making
  fits it.

**Links block (only if pieces named):** Spec sheets — {piece}: {url}

**Sign-off:**
Brendan Jurich
Objects of Agency · Perth

**Footer:** You're receiving this because you sent a brief at objects.agency.
We keep briefs for twelve months. [Privacy](https://objects.agency/privacy)

---

## Email — just looking (only if email given)

**Subject:** Noted — Objects of Agency

{NAME or "Hello"},

Thanks for looking. We'll send a note when something new leaves the workshop
— rarely, and about {series list} if you chose any. Nothing else.

Brendan

---

## Email — studio notification

**Subject:** Brief {REF} · {branch} · {first answer of screen 2}

Body: every field, raw, plus referrer and origin URL, then a link to the row.
