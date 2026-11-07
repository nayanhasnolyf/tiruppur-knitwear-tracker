---
version: 1.0
name: TiruppurKnit-Ops-Design-System
inspired_by:
  - VoltAgent/awesome-design-md (design-md/cal/DESIGN.md)
  - VoltAgent/awesome-design-md (design-md/vercel/DESIGN.md)
description: >
  An operational, high-restraint light-mode design system anchored on a near-white
  canvas (#FAFAFA) with pure white hairline-bordered surfaces (#FFFFFF), solid
  carbon-black primary CTAs (#09090B), geometric sans-serif headings (Inter), and
  tabular monospace numerals (JetBrains Mono) for garment quantities, dates, and
  run-rate math. 95% of the interface is strictly monochrome; color is reserved
  exclusively for the three schedule status signals (RED, YELLOW, GREEN).

colors:
  canvas: "#FAFAFA"
  surface-primary: "#FFFFFF"
  surface-subtle: "#F4F4F5"
  hairline: "#E4E4E7"
  hairline-soft: "#F4F4F5"
  ink-primary: "#09090B"
  ink-secondary: "#52525B"
  ink-muted: "#A1A1AA"
  cta-primary-bg: "#09090B"
  cta-primary-fg: "#FFFFFF"
  status-red-dot: "#E11D48"
  status-red-bg: "#FFF1F2"
  status-red-fg: "#BE123C"
  status-red-border: "#FECDD3"
  status-yellow-dot: "#D97706"
  status-yellow-bg: "#FFFBEB"
  status-yellow-fg: "#B45309"
  status-yellow-border: "#FDE68A"
  status-green-dot: "#10B981"
  status-green-bg: "#ECFDF5"
  status-green-fg: "#047857"
  status-green-border: "#A7F3D0"

typography:
  display-lg:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "32px"
    letterSpacing: "-0.025em"
  title-md:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "24px"
    letterSpacing: "-0.015em"
  body-sm:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "20px"
  mono-metric:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: "32px"
    fontVariantNumeric: "tabular-nums"
  mono-data:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "18px"
    fontVariantNumeric: "tabular-nums"
---

# TiruppurKnit Ops — Design System & Anti-Clutter Laws (`DESIGN.md`)

> *"The client values good, minimal design: clean layouts, white space, a restrained palette and clear type, with nothing on screen that lacks a purpose. Design counts as much as features. The order board must show which orders are in trouble at a glance; the supervisor screen needs only numbers, a photo and a send button."*

## 1. Canvas & Surface Ladder (Hairline Architecture)
- **Canvas (`#FAFAFA`)**: Soft off-white background that makes `#FFFFFF` data surfaces pop without drop shadows.
- **Primary Surface (`#FFFFFF`)**: Pure white containers separated by `1px solid #E4E4E7` (`border-zinc-200`) hairlines.
- **Subtle Surface (`#F4F4F5` / `bg-zinc-100/80`)**: Used exclusively for table headers, subtle hover states, and inline formula strips.
- **Zero Box-in-Box Nesting**: Never place 4 bordered boxes inside another bordered box inside a card. Use horizontal hairline grids (`divide-x divide-zinc-200` and `divide-y divide-zinc-200`) with generous `p-6` padding.
- **No Drop Shadows or Gradients**: Depth is communicated entirely through `1px` structural borders and contrast.

## 2. Strict Chromatic Restraint (The 95% Monochrome Rule)
- **95% Monochrome**: All navigation bars, buttons, buyer labels, unit names, stage tags, and metrics use `#09090B` (`text-zinc-950`), `#52525B` (`text-zinc-600`), and `#A1A1AA` (`text-zinc-400`).
- **Ban Decorative Colored Badges**: Buyer names (`Company B (UK)`), Production Units (`Unit 1`), Stages (`STITCHING`), and Ship Weeks must **never** use colored pills. Render them as clean monochrome text or neutral `#F4F4F5` tags.
- **Color is Reserved Exclusively for Schedule Status Signals**:
  1. **`RED` (Critical Delay)**: Dot `#E11D48`, badge `#FFF1F2`, text `#BE123C`, border `#FECDD3`.
  2. **`YELLOW` (2-Week Early Warning)**: Dot `#D97706`, badge `#FFFBEB`, text `#B45309`, border `#FDE68A`.
  3. **`GREEN` (On Track)**: Dot `#10B981`, badge `#ECFDF5`, text `#047857`, border `#A7F3D0`.

## 3. Screen-Level Layout Rules
1. **Top Navigation (`56px` / `h-14`)**: Single hairline bar (`bg-white/90 backdrop-blur border-b border-zinc-200`). Brand + primary links on the left; compact user identity and sign-out on the right.
2. **Merchandiser Order Board (`/`)**:
   - **4-Column Metric Strip**: Single `border-zinc-200` horizontal strip with `divide-x divide-zinc-200`, `11px` uppercase muted labels, and `28px` `font-mono` numerals.
   - **Single-Row Filter Bar**: Search, segmented status filter (`All`, `RED`, `YELLOW`, `GREEN`), slim Buyer/Unit selects, `Export CSV`, and solid black `+ New Order` CTA.
   - **4-Column Streamlined Order Rows**: Identity | Stage & Thin Progress Bar | Run-Rate Math (`Need` vs `Actual` & variance) | Status Pill & Action Arrow.
3. **Supervisor Mobile Floor Terminal (`/supervisor`)**:
   - Strictly *"only numbers, a photo and a send button"*:
   - Centered `36px` `font-mono` numeric input + 4 quick-tap pills (`+50`, `+100`, `+250`, `Clear`), 1-row photo attachment, clean Tamil voice/text input with collapsible preset drawer, and full-width `h-12 bg-zinc-950` Send button.
4. **Order Detail (`/orders/[id]`) & Buyer Portal (`/buyer/[token]`)**:
   - Clean hairline tables and a 2-column side-by-side editorial split (`grid-cols-2 divide-x divide-zinc-200`) comparing the Original Tamil Floor Note with the AI English Translation.

