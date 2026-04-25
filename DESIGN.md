# Design System

## Colors

### Strategy
**Committed** - One saturated color (primary) carries 30-60% of the surface with arcade energy.

### Palette (OKLCH)
- **Primary:** `oklch(0.65 0.25 280)` - Vibrant purple/blue, arcade neon feel
- **Accent:** `oklch(0.75 0.20 160)` - Cyan/teal for secondary actions
- **Background:** `oklch(0.12 0.01 280)` - Deep near-black with purple tint
- **Surface:** `oklch(0.18 0.015 280)` - Elevated surfaces
- **Border:** `oklch(0.25 0.02 280)` - Subtle borders
- **Foreground:** `oklch(0.95 0.005 280)` - Near-white text with warmth
- **Muted:** `oklch(0.50 0.01 280)` - Secondary text

### Usage
- Primary: CTAs, active states, key interactive elements
- Accent: Highlights, success states, secondary actions
- Never use pure black (#000) or white (#fff)

## Typography

### Fonts
- **Display:** Satoshi (Black 900, Bold 700) - Headings, CTAs, arcade feel
- **Body:** Satoshi (Regular 400, Medium 500) - Content, UI text
- **Mono:** Space Mono - Code blocks, invite codes, technical content

### Scale
- Hero: 4rem (64px) - Landing page titles
- H1: 3rem (48px) - Page titles
- H2: 2rem (32px) - Section headings
- H3: 1.5rem (24px) - Subsection headings
- Body: 1rem (16px) - Default text
- Small: 0.875rem (14px) - Captions, labels
- Tiny: 0.75rem (12px) - Metadata

### Hierarchy
- Weight contrast: 900 for display, 700 for emphasis, 400 for body
- Line height: 1.2 for headings, 1.6 for body
- Letter spacing: Tight (-0.02em) for large display, normal for body

## Spacing

### Scale (Tailwind)
- 1: 0.25rem (4px)
- 2: 0.5rem (8px)
- 3: 0.75rem (12px)
- 4: 1rem (16px)
- 6: 1.5rem (24px)
- 8: 2rem (32px)
- 12: 3rem (48px)
- 16: 4rem (64px)
- 24: 6rem (96px)

### Rhythm
- Vary spacing for visual interest
- Larger gaps between major sections (12-24)
- Medium gaps within sections (6-8)
- Tight gaps for related items (2-4)

## Elevation

### Shadows
- Subtle: `0 2px 4px rgba(0,0,0,0.1)`
- Medium: `0 4px 12px rgba(0,0,0,0.15)`
- High: `0 8px 24px rgba(0,0,0,0.2)`
- Glow: `0 0 20px var(--primary)` for interactive elements

### Borders
- Default: 2px solid
- Emphasis: 4px solid
- Rounded corners: 12px (small), 24px (medium), 32px (large)

## Motion

### Timing
- Fast: 150ms - Hover states, small transitions
- Medium: 300ms - Page transitions, reveals
- Slow: 500ms - Complex animations

### Easing
- Default: ease-out (cubic-bezier(0.25, 0.46, 0.45, 0.94))
- Emphasis: ease-out-quart (cubic-bezier(0.165, 0.84, 0.44, 1))

### Principles
- Never animate layout properties (width, height, top, left)
- Use transform and opacity
- Reduce motion for accessibility

## Components

### Buttons
- Primary: Bold, high contrast, glow effect on hover
- Secondary: Outlined, subtle hover
- Ghost: Transparent, text-only
- Press-down effect: translate-y on active state

### Cards
- Elevated surface with subtle border
- Rounded corners (24px)
- Hover: lift effect with increased shadow
- Avoid nested cards

### Forms
- Large touch targets (min 44px)
- Clear focus states with ring
- Inline validation
- Accessible labels

### Arcade Elements
- Scanline overlays for CRT effect
- Neon glow on interactive elements
- Pixelated corners for retro feel
- Bold, uppercase labels for emphasis

## Accessibility

- WCAG 2.1 AA minimum
- 4.5:1 contrast for body text
- 3:1 contrast for large text
- Focus indicators on all interactive elements
- Keyboard navigation support
- Screen reader friendly markup
