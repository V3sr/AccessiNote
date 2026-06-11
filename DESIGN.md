# Design

## Style Summary

AccessiNote is a restrained product workbench with a compact app shell and evidence-first workspace. It should look calm, precise, and source-aware rather than promotional. The interface uses a dark top bar, a tabbed source desk, explicit scan readiness, and readable density so repeated lecture review feels efficient.

## Color

- Shell: near-black zinc top bar for product identity and app status.
- Background: cool neutral work surface with white primary panels.
- Primary action: emerald for source intake, OCR readiness, selected states, and successful local status.
- Secondary colors are reserved for true semantic states only, not source-type decoration.
- Ink: near-black zinc for headings, dark zinc for body, and saturated semantic colors for warnings/errors.
- Warning: amber background with dark amber text for safety and review notices.

Color should remain restrained. Use accent colors for action, current state, and semantic status rather than decoration.

## Typography

- Font stack: system sans-serif through Tailwind defaults.
- Product UI scale: compact, fixed sizes; avoid fluid display type.
- Headings: semibold, tight but not cramped, with balanced wrapping where useful.
- Body text: 14-16px with comfortable line height for notes and warnings.
- Dense panels may use 12-13px metadata only when contrast remains strong.

## Layout

- App shell: header, safety band, then a two-column workbench on desktop.
- Left column: source desk, primary generate action, then output controls.
- Main column: timeline first, generated output second.
- Mobile: single-column flow with controls before results.
- Use 8px radius for product panels and controls unless a pill affordance is intentional.

## Components

- Header: compact brand mark, product name, tagline, and API status.
- Safety banner: persistent, readable, and visually distinct.
- Source desk: tabbed intake for sample, transcript, image/slide OCR, and video.
- Scan pre-flight: compact capability rows for frame extraction and OCR engine readiness.
- Timeline chunks: repeated evidence records with timestamp, concepts, transcript, OCR confidence, visual evidence, and optional keyframes.
- Mode selector: compact output builder with clear icon, label, and short description.
- Output viewer: markdown preview plus source references and export actions.

## Interaction

- Every button needs hover, disabled, and keyboard focus states.
- Async actions show inline loading via the button that triggered them.
- Local capability warnings should appear before upload, not after failure.
- Video scans should report OCR coverage and engine choice immediately after upload.
- Generated output export actions should stay close to the output title.

## Motion

Motion should be minimal and state-based: hover transitions, focus rings, and loading spinners only. Respect reduced motion and avoid decorative page-load choreography.
