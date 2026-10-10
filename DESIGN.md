---
name: Academic Workspace & Student Operating System
colors:
  surface: '#f9f9ff'
  surface-dim: '#d1daf4'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3ff'
  surface-container: '#e9edff'
  surface-container-high: '#e1e8ff'
  surface-container-highest: '#d9e2fc'
  on-surface: '#121b2e'
  on-surface-variant: '#45474c'
  inverse-surface: '#273044'
  inverse-on-surface: '#edf0ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e71'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#141b2c'
  on-primary-container: '#7c8498'
  inverse-primary: '#bfc6dc'
  secondary: '#1451d1'
  on-secondary: '#ffffff'
  secondary-container: '#3b6ceb'
  on-secondary-container: '#fefcff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#260059'
  on-tertiary-container: '#966ce6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe2f9'
  primary-fixed-dim: '#bfc6dc'
  on-primary-fixed: '#141b2c'
  on-primary-fixed-variant: '#3f4759'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c4ff'
  on-secondary-fixed: '#00174c'
  on-secondary-fixed-variant: '#003daa'
  tertiary-fixed: '#ebddff'
  tertiary-fixed-dim: '#d3bbff'
  on-tertiary-fixed: '#260059'
  on-tertiary-fixed-variant: '#5729a3'
  background: '#f9f9ff'
  on-background: '#121b2e'
  surface-variant: '#d9e2fc'
typography:
  headline-xl:
    fontFamily: Manrope
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.03em
  headline-xl-mobile:
    fontFamily: Manrope
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.025em
  headline-lg-mobile:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Manrope
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  title-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  title-sm:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  body-sm:
    fontFamily: Manrope
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  data-tabular:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-sm: 1rem
  gutter-lg: 2rem
  margin: 2rem
  margin-sm: 1rem
  margin-lg: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system establishes a focused, high-clarity academic environment engineered for modern university and college students. Balancing the analytical precision of developer tools with the editorial calm of native workspace applications, the interface serves as a cognitive multiplier rather than a source of sensory overload. 

The aesthetic is anchored in contemporary modern SaaS productivity paradigms—drawing tactile restraint and micro-border detailing from Linear, spacious structural modularity from Notion, and fluid ergonomic polish from macOS/iOS systems. Surfaces feel clean, structured, and deliberate. Micro-interactions are snappy (120–180ms easing transitions), reinforcing a sense of control, academic momentum, and mastery.

Emotional Targets:
- **Clarity over chaos:** Dense semester timetables, GPA projections, and assignment queues are articulated through modular Bento-style widgets, pristine visual hierarchy, and breathing room.
- **Academic velocity:** High-efficiency quick captures, keyboard navigability, and zero visual friction encourage daily task execution.
- **Calm authority:** The palette and type hierarchy balance institutional credibility with consumer-grade delight.

## Colors

The color architecture is built around high-contrast structure and purposeful semantic signaling. Pure `#FFFFFF` surfaces sit atop a cool, tinted canvas background (`#F5F7FC`), creating organic boundary separation without reliance on heavy shadows.

### Functional Roles & Accents
- **Deep Midnight Navy (`#101828`):** Primary brand anchor, dominant dark surfaces, primary action buttons, and active high-emphasis navigation headers.
- **Electric Cobalt (`#4776F6`):** Primary operational accent for CTAs, active states, progress indicators, link text, and selected workspace views.
- **Lavender Purple (`#A47AF5`):** Reserved for study mode, deep-work focus sessions, lab modules, syllabus analytics, and AI academic copilot interactions.
- **Emerald Teal (`#20B486`):** Denotes positive thresholds—attendance rates above 85%, completed assignments, grade point increases, and verified submissions.
- **Golden Amber (`#F5B942`):** Warning indicator for impending deadlines (<48 hours), mid-tier attendance risk (75–85%), and pending instructor feedback.
- **Crimson Red (`#F04438`):** Critical state indicator for attendance debarment warnings (<75%), overdue submissions, and conflicting exam schedules.

### Neutral Layering & Substrates
- **Canvas Base:** `#F5F7FC`
- **Surface & Cards:** `#FFFFFF`
- **Structural Borders & Separators:** `#E5EAF2`
- **Primary Typography:** `#172033` (crisp near-black for maximum contrast)
- **Secondary Typography:** `#667085` (metadata, dates, subheadings)
- **Muted Typography / Placeholder:** `#98A2B3` (inactive tabs, keyboard hints)

## Typography

The typographic pairing blends the sculpted geometric geometry of **Manrope** for macro headings, page titles, and expressive text blocks with the ultra-legible, functional discipline of **Inter** for data tables, metric tiles, status tags, and UI labels.

Key Implementation Directives:
- **Tabular Figures:** All statistical outputs (GPAs, attendance ratios, countdowns, timestamps, credit counts, schedule hours) must enforce `font-feature-settings: "tnum" 1, "cv05" 1` via Inter to prevent numerical jitter during updates.
- **Tight Letter Spacing:** Headings employ negative tracking (`-0.015em` to `-0.03em`) to mimic executive print editorial styling and high-density dashboard precision.
- **Micro Labels:** All caps tokens (status badges, course codes like `CS 301`) must employ `label-sm` with explicit letter tracking (`+0.04em`) to safeguard legibility at small sizes.

## Layout & Spacing

The interface employs a disciplined 12-column fluid grid system bounded by a maximum content container of 1440px on wide displays, flanked by dynamic canvas gutters.

### Layout Model
- **Desktop (1280px+):** Collapsible 260px primary navigation sidebar + 12-column grid. Grid columns span fluidly with a standard `gutter-lg` (2rem) and `margin-lg` (3rem). Asymmetric modular Bento structures (e.g., 8-col weekly timetable paired with 4-col pending deliverables) provide balanced density.
- **Tablet (768px – 1279px):** 8-column grid with `gutter` (1.5rem) and `margin` (2rem). The sidebar collapses into an icon dock (64px) or slide-over drawer. Multi-column cards stack to 4-column halves or 8-column full widths.
- **Mobile (< 768px):** Single-column stacked grid with `margin-sm` (1rem) and `gutter-sm` (1rem). Navigation transfers to a bottom tab dock or header flyout. Complex multi-track timetables pivot into chronological agenda views.

### Spacing Philosophy
Rhythms follow an 8pt base grid (`space-xs` = 4px, `space-sm` = 8px, `space-md` = 16px, `space-lg` = 24px, `space-xl` = 40px). Component internal paddings pair `space-md` vertically with `space-lg` horizontally for cards and containers, preserving airy breathability even within information-dense modules.

## Elevation & Depth

Depth is established via **layered containment** combined with low-opacity ambient shadows and precise micro-borders. High-elevation blur effects and dark muddy drop-shadows are strictly avoided in favor of crisp, tactile planes.

### Layering Hierarchy
1. **Base Surface (Level 0):** `#F5F7FC` background canvas. Flat, unshadowed.
2. **Card & Widget Surface (Level 1):** `#FFFFFF` layered with a solid `1px` border in `#E5EAF2`. Shadow formula: `0 1px 3px 0 rgba(16, 24, 40, 0.04), 0 1px 2px -1px rgba(16, 24, 40, 0.02)`.
3. **Interactive & Hover Cards (Level 2):** `#FFFFFF` with border transition to `#D0D9E7`. Shadow elevates to: `0 8px 16px -4px rgba(16, 24, 40, 0.06), 0 2px 6px -2px rgba(16, 24, 40, 0.03)`.
4. **Floating Overlays & Flyouts (Level 3):** Dropdown menus, command palettes (`Cmd+K`), date pickers, and context sheets utilize `#FFFFFF` backed by an ultra-fine border `#E5EAF2` and deep ambient occlusion: `0 20px 24px -4px rgba(16, 24, 40, 0.08), 0 8px 8px -4px rgba(16, 24, 40, 0.03)`.
5. **Modals & Focus Dialogs (Level 4):** Anchored atop a backdrop scrim of `rgba(16, 24, 40, 0.40)` with `backdrop-filter: blur(4px)`.

## Shapes

The design uses a refined, rounded geometric profile (`roundedness: 2`). This aesthetic softens visual density across complex administrative tables without becoming overly playful or toy-like.

### Token Applications
- **Base Components (`rounded` / 0.5rem - 8px):** Input fields, inline filter buttons, dropdown items, micro badges, and checkbox/radio indicators.
- **Medium Panels (`rounded-lg` / 1rem - 16px):** Standard dashboard widgets, schedule item blocks, lecture summary cards, and modal dialogs.
- **Large Canvas Containers (`rounded-xl` / 1.5rem - 24px):** Bento modules, calendar monthly matrix frames, persistent sidebar wrappers, and focus session hubs.
- **Pill Geometry (`rounded-full` / 9999px):** Status badges, avatar rings, filter chips, tag indicators, and persistent audio/focus floating bars.

## Components

### Buttons
- **Primary:** Background `#101828`, text `#FFFFFF`, border `1px solid transparent`. Active/Hover: `#1E293B`. Radius: `0.5rem`. Subtle transition `all 150ms ease`.
- **Secondary / Accent:** Background `#4776F6`, text `#FFFFFF`. Hover: `#3562DF`.
- **Tertiary / Subtle:** Background `#FFFFFF`, text `#172033`, border `1px solid #E5EAF2`. Hover: background `#F5F7FC`, border `#D0D9E7`.
- **Ghost / Utility:** Background transparent, text `#667085`. Hover: background `rgba(229, 234, 242, 0.5)`, text `#172033`.

### Input Fields & Selectors
- Height: 40px standard, 32px compact (data tables).
- Surface: `#FFFFFF`, border `1px solid #E5EAF2`, border-radius `0.5rem`, padding `0 12px`.
- Typography: `body-md` (`#172033`), placeholder `#98A2B3`.
- States: Focus ring is `3px solid rgba(71, 118, 246, 0.15)` paired with border `#4776F6`. Invalid state uses border `#F04438` and focus ring `rgba(240, 68, 56, 0.15)`.

### Chips & Semantic Status Badges
- Compact pill geometry (`rounded-full`), height 24px, padding `0 10px`, font `label-sm`.
- **Success (High Attendance / Completed):** Background `rgba(32, 180, 134, 0.12)`, text `#127A5B`, micro-border `rgba(32, 180, 134, 0.25)`.
- **Warning (Deadline / Attendance Risk):** Background `rgba(245, 185, 66, 0.15)`, text `#A56F0D`, micro-border `rgba(245, 185, 66, 0.3)`.
- **Danger (Missed / Low Attendance):** Background `rgba(240, 68, 56, 0.10)`, text `#D92D20`, micro-border `rgba(240, 68, 56, 0.25)`.
- **Focus / Lab:** Background `rgba(164, 122, 245, 0.14)`, text `#7038D6`, micro-border `rgba(164, 122, 245, 0.3)`.

### Selection Controls (Checkbox & Radio)
- Checkboxes: 18x18px, border `1.5px solid #D0D9E7`, radius `4px`. Checked state: background `#4776F6`, border `#4776F6` displaying an inset white stroke mark.
- Radios: 18x18px, circular, with an inner filled node (6px) on active selection.

### Cards & Bento Widgets
- Background `#FFFFFF`, border `1px solid #E5EAF2`, border-radius `1rem` (`16px`), padding `1.5rem` (`24px`).
- Card Headers: Include title (`title-md`), optional trailing badge or ghost action trigger, accompanied by a subtle bottom divider border `#E5EAF2` when enclosing data lists.

### Specialized Academic Components
- **Attendance Dial & Metric Cards:** Compact cards containing circular progress rings (using `#20B486`, `#F5B942`, or `#F04438`) centered around tabular numerical indicators (`data-tabular`), paired with minimum class-buffer counts (e.g., "3 classes can be skipped safely").
- **Timetable Period Tile:** Left-border accent (4px width) matching course color category; internal content contains Course Code (`label-md`), Room Number (`body-sm`), and Professor Tag (`label-sm`).
- **Pill View Tabs:** Segmented tab switcher enclosed in a subtle `#F5F7FC` container with an animated sliding white surface indicator, utilizing `1px solid #E5EAF2` border framing.