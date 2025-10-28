# Trayve Color Conversion Reference

## OKLCH to HSL Conversion for Shopify App

Since OKLCH color values don't work correctly in the Shopify/Remix environment, all colors from the main Trayve app (`app/globals.css`) have been converted to HSL format for use in the Shopify app.

### Light Mode Colors

| Variable | Trayve (OKLCH) | Shopify (HSL) | Description |
|----------|----------------|---------------|-------------|
| `--background` | `oklch(0.994 0 0)` | `0 0% 99.4%` | Nearly white background |
| `--foreground` | `oklch(0 0 0)` | `0 0% 0%` | Black text |
| `--primary` | `oklch(0.5393 0.2713 286.7462)` | `287 69% 45%` | Purple/violet primary |
| `--primary-foreground` | `oklch(1 0 0)` | `0 0% 100%` | White on primary |
| `--secondary` | `oklch(0.954 0.0063 255.4755)` | `255 23% 94%` | Light purple secondary |
| `--muted` | `oklch(0.9702 0 0)` | `0 0% 97%` | Light gray |
| `--accent` | `oklch(0.9393 0.0288 266.368)` | `266 57% 88%` | Light purple accent |
| `--destructive` | `oklch(0.629 0.1902 23.0704)` | `23 76% 63%` | Orange-red destructive |
| `--border` | `oklch(0.93 0.0094 286.2156)` | `286 48% 91%` | Light purple border |

### Dark Mode Colors

| Variable | Trayve (OKLCH) | Shopify (HSL) | Description |
|----------|----------------|---------------|-------------|
| `--background` | `oklch(0.2223 0.006 271.1393)` | `271 21% 22%` | Dark purple background |
| `--foreground` | `oklch(0.9551 0 0)` | `0 0% 95.5%` | Off-white text |
| `--primary` | `oklch(0.6132 0.2294 291.7437)` | `292 64% 52%` | Bright purple primary |
| `--card` | `oklch(0.2568 0.0076 274.6528)` | `275 22% 26%` | Dark card background |
| `--muted` | `oklch(0.294 0.013 272.9312)` | `273 25% 29%` | Muted dark purple |
| `--accent` | `oklch(0.2795 0.0368 260.031)` | `260 45% 30%` | Dark accent purple |
| `--destructive` | `oklch(0.7106 0.1661 22.2162)` | `22 68% 71%` | Light orange destructive |

### Key Design Tokens

- **Border Radius**: `1.4rem` (matches Trayve exactly)
- **Font Families**: Geist (sans), Lora (serif), IBM Plex Mono (mono)
- **Color Scheme**: Purple/violet-based with high contrast

### Usage in Components

The Shopify app's `tailwind.config.js` references these CSS variables:

```javascript
colors: {
  primary: {
    DEFAULT: "hsl(var(--primary))",
    foreground: "hsl(var(--primary-foreground))",
  },
  // ... etc
}
```

This allows all Tailwind utilities like `bg-primary`, `text-primary-foreground`, etc. to work exactly as they do in the main Trayve app.

### Conversion Notes

- OKLCH values provide better perceptual uniformity but require modern browser support
- HSL conversion maintains visual similarity while ensuring broad compatibility
- Purple hue (~287°) is the primary brand color
- Dark mode uses deeper purples with adjusted lightness for proper contrast
