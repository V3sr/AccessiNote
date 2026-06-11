# Design

## Style Summary

AccessiNote is a restrained product workbench with a light product-intake hero and evidence-first workspace. It should look calm, precise, and source-aware rather than promotional. The first viewport pairs a clear local source desk with a direct accessibility promise, then moves into a three-column review workbench for lecture overview, output generation, and learning insights.

## Color

- Shell: white navigation with cool neutral borders for product identity and app status.
- Background: cool neutral work surface with a very light green-to-blue intake band.
- Primary action: emerald for source intake, OCR readiness, selected states, and successful local status.
- Secondary blue is reserved for workbench entry, source coverage, and informational status.
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

- App shell: header, intake hero, safety band, then a three-column workbench on desktop.
- Hero: left promise and workflow benefits; right local upload/source desk.
- Workbench left column: lecture overview and source/OCR status.
- Workbench center column: output format selector, generate action, and generated output.
- Workbench right column: learning insights and privacy/safety reminders.
- Detailed evidence timeline follows the main workbench so users can audit every chunk.
- Mobile: single-column flow with controls before results.
- Use 8px radius for product panels and controls unless a pill affordance is intentional.

## Components

- Header: light navigation with AccessiNote brand mark, real section links, API status, and local-start CTA.
- Safety banner: persistent, readable, and visually distinct without dominating the page.
- Source desk: upload-focused intake card with supported source types and tabs for sample, transcript, image/slide OCR, and video.
- Scan pre-flight: compact capability rows for frame extraction and OCR engine readiness.
- Timeline chunks: repeated evidence records with timestamp, concepts, transcript, OCR confidence, visual evidence, and optional keyframes.
- Mode selector: compact output builder with clear icon, label, and short description.
- Output viewer: markdown preview plus source references and export actions.
- Learning insights: source coverage ring, key concept count, review time estimate, and generated format count.

## Interaction

- Every button needs hover, disabled, and keyboard focus states.
- Async actions show inline loading via the button that triggered them.
- Local capability warnings should appear before upload, not after failure.
- Video scans should report OCR coverage and engine choice immediately after upload.
- Generated output export actions should stay close to the output title.

## Motion

Motion should be minimal and state-based: hover transitions, focus rings, and loading spinners only. Respect reduced motion and avoid decorative page-load choreography.
