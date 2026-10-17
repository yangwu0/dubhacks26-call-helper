# Archived theme: Sift cream / teal (daisyUI)

Used before the trust-blue refresh. To restore, copy the `@plugin "daisyui/theme"` blocks below into `app/globals.css` (replace the current `light` and `dark` blocks) and revert fonts in `app/layout.tsx` to Nunito + Atkinson Hyperlegible.

## Fonts (this era)

- Headings: Nunito 700/800 (`--font-display`)
- Body: Atkinson Hyperlegible 400/700 (`--font-body`)

## Light

```css
@plugin "daisyui/theme" {
  name: "light";
  default: true;
  color-scheme: light;

  --color-base-100: #fff8e8;
  --color-base-200: #f3ecdc;
  --color-base-300: #dceef3;
  --color-base-content: #2c3437;

  --color-primary: #245a73;
  --color-primary-content: #ffffff;

  --color-secondary: #c5e4ec;
  --color-secondary-content: #19485e;

  --color-accent: #e9795b;
  --color-accent-content: #ffffff;

  --color-neutral: #626b6d;
  --color-neutral-content: #fff8e8;

  --color-info: #1676a3;
  --color-info-content: #ffffff;

  --color-success: #3f7652;
  --color-success-content: #ffffff;

  --color-warning: #80520c;
  --color-warning-content: #fff0cc;

  --color-error: #8c3030;
  --color-error-content: #ffffff;

  --radius-selector: 1rem;
  --radius-field: 0.75rem;
  --radius-box: 1.25rem;

  --size-selector: 0.25rem;
  --size-field: 0.28125rem;
  --border: 1px;
  --depth: 1;
  --noise: 0;
}
```

## Dark

```css
@plugin "daisyui/theme" {
  name: "dark";
  color-scheme: dark;

  --color-base-100: #172629;
  --color-base-200: #223438;
  --color-base-300: #2d4246;
  --color-base-content: #fff8e8;

  --color-primary: #82c5da;
  --color-primary-content: #11282f;

  --color-secondary: #29444d;
  --color-secondary-content: #fff8e8;

  --color-accent: #f29a7e;
  --color-accent-content: #11282f;

  --color-neutral: #607476;
  --color-neutral-content: #fff8e8;

  --color-info: #9adbf0;
  --color-info-content: #11282f;

  --color-success: #90c99b;
  --color-success-content: #11282f;

  --color-warning: #f1c46d;
  --color-warning-content: #11282f;

  --color-error: #f19a91;
  --color-error-content: #11282f;

  --radius-selector: 1rem;
  --radius-field: 0.75rem;
  --radius-box: 1.25rem;

  --size-selector: 0.25rem;
  --size-field: 0.28125rem;
  --border: 1px;
  --depth: 1;
  --noise: 0;
}
```
