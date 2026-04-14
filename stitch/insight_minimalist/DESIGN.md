# Design System Document: Precision Minimalism

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Digital Architect."** 

Unlike generic desktop applications that rely on heavy borders and cluttered grids, this system treats the interface as a physical, architectural space. It moves beyond "flat" design into a realm of **Tactile Sophistication**. We achieve a high-end, native Tauri/Rust feel by prioritizing structural integrity through whitespace and tonal depth rather than decorative lines. The goal is to make "Folder Insight" feel less like a tool and more like a high-precision instrument—lightweight, fast, and intellectually clear.

### Breaking the Template
*   **Intentional Asymmetry:** Use wide gutters and unbalanced columns (e.g., a slim 20% navigation rail against an expansive 80% content area) to create a modern, editorial rhythm.
*   **The "Breathing" Layout:** Every element must have at least double the standard margin you might expect. Space is not "empty"; it is a functional element that directs the eye.

---

## 2. Colors
Our palette is a study in "Warm Tech"—off-whites and cool grays punctuated by a singular, authoritative blue.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to define sections. Sectioning must be achieved through background color shifts. 
*   Use `surface` for the base window.
*   Use `surface_container_low` for secondary sidebars.
*   Use `surface_container_highest` for active content focus areas.
This creates a seamless, "milled" look characteristic of premium native hardware interfaces.

### Surface Hierarchy & Nesting
Treat the UI as layered sheets of fine vellum. 
*   **Level 0 (Base):** `surface` (#f7f9fb)
*   **Level 1 (Nesting):** `surface_container` (#e8eff3) for primary grouping.
*   **Level 2 (Interaction):** `surface_container_lowest` (#ffffff) for cards or input areas to make them "pop" forward against the gray base.

### The "Glass & Gradient" Rule
For floating elements like modals or dropdowns, use **Glassmorphism**:
*   **Background:** `surface` at 80% opacity.
*   **Effect:** `backdrop-filter: blur(12px)`.
*   **Signature Polish:** For Primary CTAs, apply a subtle linear gradient from `primary` (#0053db) to `primary_dim` (#0048c1) at 135 degrees. This adds a "jewel-like" depth that flat hex codes lack.

---

## 3. Typography
We utilize a dual-font strategy to balance character with legibility.

*   **Display & Headlines (Manrope):** Chosen for its geometric precision. Use `display-md` for empty states and `headline-sm` for folder titles. The wide aperture of Manrope conveys openness.
*   **Body & Labels (Inter):** Inter is used for technical data. It is highly legible at small sizes, crucial for file paths and metadata.
*   **Hierarchy Tip:** Always use `on_surface_variant` (#566166) for secondary metadata (like file sizes) to create a clear "read-order" against the `on_surface` (#2a3439) primary titles.

---

## 4. Elevation & Depth
Depth is communicated through **Tonal Layering**, not shadows.

*   **The Layering Principle:** To lift a card, do not reach for a shadow first. Instead, place a `surface_container_lowest` (#ffffff) shape onto a `surface_container` (#e8eff3) background. The delta in lightness provides a cleaner, more modern "lift."
*   **Ambient Shadows:** If an element must float (e.g., a context menu), use: `box-shadow: 0 12px 32px rgba(42, 52, 57, 0.08)`. Notice the shadow is a low-opacity version of `on_surface`, mimicking natural light.
*   **The "Ghost Border":** For accessibility in high-glare environments, use a 1px stroke of `outline_variant` at **15% opacity**. It should be felt, not seen.

---

## 5. Components

### Buttons
*   **Primary:** Gradient fill (`primary` to `primary_dim`), `on_primary` text. No border. `md` (0.375rem) roundedness.
*   **Secondary:** `surface_container_high` background. Text in `primary`.
*   **Tertiary:** Ghost style. No background/border until hover. On hover, use `surface_variant` at 50% opacity.

### Input Fields
*   **Form:** Forbid the "box" look. Use `surface_container_lowest` with a subtle `outline_variant` (20% opacity) bottom-border only, or a full-surround ghost border.
*   **Focus State:** Shift background to `surface_bright` and animate a 2px `primary` underline.

### Cards & Lists
*   **Rule:** **No Divider Lines.** 
*   Separate file items using `8px` of vertical whitespace. 
*   **Hover State:** Change the background of the entire row to `surface_container_high`. This is "Subtractive Design"—the UI only shows its structure when the user interacts with it.

### Specialized Component: "The Insight Rail"
For a folder analysis app, use a **Tonal Progress Bar**. Instead of a high-contrast bar, use `secondary_container` for the track and `tertiary` (#4a6552) for the fill to indicate positive "scanned" status. It’s professional, not alarming.

---

## 6. Do's and Don'ts

### Do
*   **Do** use `tertiary` for "Success" or "Complete" states—it’s a sophisticated sage green that feels more premium than a standard lime green.
*   **Do** allow the application window to have a slightly transparent `surface` background if the OS allows (vibrancy effects), emphasizing the Tauri/native feel.
*   **Do** use `label-sm` for technical metadata (e.g., "Permissions: 755") in uppercase with 0.05em letter spacing.

### Don'ts
*   **Don't** use pure black (#000000) for text. Use `on_surface` (#2a3439).
*   **Don't** use sharp 90-degree corners. Even for "clean" apps, the `sm` (0.125rem) or `md` (0.375rem) radius makes the software feel engineered rather than generic.
*   **Don't** crowd the edges of the window. Maintain a minimum "Safe Area" of 24px around all primary window boundaries.