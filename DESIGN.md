# Design

## Style Summary

AccessiNote is a restrained product workbench. It should look calm, precise, and source-aware rather than promotional. The interface uses familiar panels, explicit controls, and readable density so repeated lecture review feels efficient.

## Color

- Background: neutral zinc surfaces, with a soft app background and white primary panels.
- Primary action: emerald for sample/start and successful local status.
- Secondary action: sky for transcript creation and informational emphasis.
- Media action: violet for video upload and scanning capability.
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
- Left column: input and mode controls, stacked by workflow.
- Main column: timeline first, generated output second.
- Mobile: single-column flow with controls before results.
- Use 8px radius for product panels and controls unless a pill affordance is intentional.

## Components

- Header: compact brand mark, product name, tagline, and API status.
- Safety banner: persistent, readable, and visually distinct.
- Input panels: task-specific sections for sample, transcript, and video.
- Timeline chunks: repeated cards with timestamp, concepts, transcript, OCR, visual evidence, and optional keyframes.
- Mode selector: button-list with clear icon, label, and short description.
- Output viewer: markdown preview plus source references and export actions.

## Interaction

- Every button needs hover, disabled, and keyboard focus states.
- Async actions show inline loading via the button that triggered them.
- Local capability warnings should appear before upload, not after failure.
- Generated output export actions should stay close to the output title.

## Motion

Motion should be minimal and state-based: hover transitions, focus rings, and loading spinners only. Respect reduced motion and avoid decorative page-load choreography.
