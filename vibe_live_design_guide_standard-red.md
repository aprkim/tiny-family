# VibeLive Design Guide (Standard)

**Theme color:** `#BF3143`

A simplified, consistent design system for all VibeLive users. This guide is intentionally minimal so anyone can apply it quickly without design guesswork.

---

## 1. Design Principles

1. **Neutral-first UI** – backgrounds stay calm and light; color is meaningful, not decorative.
2. **One primary action per screen** – avoid competing CTAs.
3. **Soft feedback** – hover and focus states use subtle tints, never loud color jumps.
4. **Clear hierarchy** – headline → body → muted text should be instantly readable.

---

## 2. Core Design Tokens

### Layout
- Border radius: `16px`
- Max content width: `980px`
- Font stack:
  ```
  ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial
  ```

---

## 3. Color System (VibeLive Standard)

### Surfaces
| Token | Hex | Usage |
|------|-----|------|
| `--bg` | `#F7FAFC` | Page background |
| `--card` | `#FFFFFF` | Cards, panels, modals |
| `--soft` | `#F0F4F3` | Hover surfaces, subtle fills |
| `--border` | `#E2E8F0` | Borders, dividers |

### Text
| Token | Hex | Usage |
|------|-----|------|
| `--text` | `#1E293B` | Primary text |
| `--muted` | `#64748B` | Secondary text |
| `--muted2` | `#9CA3AF` | Tertiary / helper text |

### Brand Accent
| Token | Value | Usage |
|------|------|------|
| `--accent` | `#BF3143` | Primary buttons, links, active states |
| `--accentSoft` | `rgba(191,49,67,.08)` | Selected backgrounds |
| `--accentHover` | `rgba(191,49,67,.14)` | Hover feedback |
| `--accentBorder` | `rgba(191,49,67,.18)` | Accent borders |

### Status Colors
**Live / Online / Enabled**
- Background: `#E8F4ED`
- Border: `#A6C5A3`
- Text: `#324252`

**Disabled / Offline**
- Background: `#F3F4F6`
- Border: `#E5E7EB`
- Text: `#6B7280`

**Info**
- Background: `#F0F4F3`
- Border: `#E2E8F0`
- Text: `#1E293B`

---

## 4. Component Rules

### Buttons
**Primary (CTA)**
- Background: `--accent`
- Text: `#FFFFFF`
- Use for: Go Live, Start Session, Save, Confirm

**Secondary**
- Background: `--soft`
- Text: `--text`
- Border: `--border`
- Use for: Cancel, Back, Close

**Danger**
- Background: `--accentSoft`
- Border + Text: `--accent`
- Use sparingly for destructive actions

### Links
- Color: `--accent`
- Hover: underline only

### Inputs
- Background: `--card`
- Border: `--border`
- Focus ring: `rgba(191,49,67,.25)`
- Error: border + helper text use `--accent`

### Cards
- Background: `--card`
- Border: `1px solid --border`
- Hover: slightly darker border or very soft shadow

### Pills / Badges
- **Live:** green success set
- **Primary tag:** `--accentSoft` background + `--accent` text
- **Disabled:** disabled set

---

## 5. Modals, Alerts & Toasts

- Overlay: `rgba(30, 41, 59, 0.5)`
- Container: `--card` with `--border`
- Radius: `16px`

**Alert Types**
- Success: green success set
- Error: light red background + `--accent` border/text
- Info: info set

---

## 6. Iconography

- No emojis in UI
- Use simple stroke-based SVG icons (Lucide-style)
- Sizes: 20px / 24px
- Default color: `currentColor`
- Muted icons: `--muted`
- Active icons: `--accent`

---

## 7. CSS Variables (Copy & Paste)

```css
:root{
  --radius: 16px;
  --max: 980px;
  --sans: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;

  --bg: #F7FAFC;
  --card: #FFFFFF;
  --soft: #F0F4F3;
  --border: #E2E8F0;

  --text: #1E293B;
  --muted: #64748B;
  --muted2: #9CA3AF;

  --accent: #BF3143;
  --accentSoft: rgba(191,49,67,.08);
  --accentHover: rgba(191,49,67,.14);
  --accentBorder: rgba(191,49,67,.18);

  --successBg: #E8F4ED;
  --successBorder: #A6C5A3;
  --successText: #324252;

  --disabledBg: #F3F4F6;
  --disabledBorder: #E5E7EB;
  --disabledText: #6B7280;

  --overlay: rgba(30, 41, 59, 0.5);
}
```

---

## 8. Do / Don’t

**Do**
- Use red only for primary actions
- Keep layouts calm and readable
- Use green strictly for live/online states

**Don’t**
- Introduce new colors per feature
- Use multiple red CTAs on one screen
- Use emojis as UI icons

---

**Version:** 1.0.0
**Brand:** VibeLive
**Purpose:** Simple, calm, consistent live interaction UI