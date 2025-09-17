# Design System

This document serves as a reference for all future design and UI related tasks for the web-based app.

## Tech Stack

- HTML
- Tailwind CSS
- daisyUI
- JavaScript
- Plotly.js

## Design Tokens

### Colors

| Name | Hex | Usage |
| --- | --- | --- |
| Mimoja Blue v2 | #385A92 | Primary accent |
| White | #FFFFFF | Default background (light mode), text (dark mode) |
| Green | #0CA581 | Success states, indicators |
| Dark Gray | #121212 | Default background (dark mode), text (light mode) |
| Button Grey Absolute | #EDEDED | Button backgrounds |
| Low contrast white | #959595 | Secondary text |
| Mimoja Blue | #3D5782 | Secondary accent |
| New Grey | #F6F8FA | Light background variant |
| Pressure Line | #17C29A | Shot graph: pressure line |
| Flow Line | (not specified) | Shot graph: flow line |

### Typography

| Name | Family | Style | Size | Weight | Line Height |
| --- | --- | --- | --- | --- | --- |
| Inter/SemiBold/26 | Inter | Semi Bold | 26 | 600 | 1.2 |
| Inter/Bold/40 | Inter | Bold | 40 | 700 | 1.2 |
| Inter/Regular/26 | Inter | Regular | 26 | 400 | 1.3 |
| Inter/Bold/32 | Inter | Bold | 32 | 700 | 1.2 |
| Inter/SemiBold/20 | Inter | Semi Bold | 20 | 600 | 1.2 |
| Inter/Regular/32 | Inter | Regular | 32 | 400 | 1.2 |
| Inter/Bold/26 | Inter | Bold | 26 | 700 | 1.2 |

*Fonts are loaded from `.ttf` files using the `@font-face` rule in the main CSS file.*

## Theming

The application supports both **light** and **dark** themes. Theme switching is managed using CSS Custom Properties (variables) on the `<body>` tag.

```css
/* Example */
:root {
  --background-color: #FFFFFF;
  --text-color: #121212;
  --pressure-line-color: #17c29a;
}

body.dark-mode {
  --background-color: #0d0e14;
  --text-color: #e8e8e8;
  /* ...and so on */
}
```

## Component Library

The UI is built from a set of core components, recreated from the original TCL implementation.

-   **Data Display Text**: A `<span>` element for displaying a single piece of data from the application state (e.g., `appState.settings.grinder_setting`). It must be updated whenever the state changes.
-   **Button**: A standard HTML `<button>` element. It should support both a standard `onClick` event and a **long-press** event. Long-press functionality can be implemented using a timer on `onMouseDown` and `onMouseUp` events.
-   **Rich Text Line**: A container `<div>` holding multiple `<span>` elements. This allows a single line of text to have different styling and click handlers for each segment. Used for primary data readouts.
-   **Status Message / Progress Bar**: A component to display system status (e.g., "Heating: 50s remaining", "Ready"). This will require a dedicated JavaScript function to manage its complex logic.
-   **Data Card**: A component that displays a summary of shot data, populated from live machine data.

## Asset Management

*Assets such as fonts and icons are stored in the `src/ui` directory. Images are referenced from a local server.*

## Icon System

*The project uses the IcoMoon icon font, which is located in the `src/ui` directory.*

## Styling Approach

*The project uses Tailwind CSS, a utility-first CSS framework, and daisyUI. The layout should be responsive to different screen sizes, using Flexbox and CSS Grid for structure.*

## Application Architecture

### UI Update Pattern: State-Driven

The application follows a "State Object + Manual Render" pattern to ensure the UI is always in sync with the application's data.

1.  **Central State Object**: A single, global JavaScript object (`appState`) acts as the "single source of truth" for all settings and live machine data.
2.  **UI Update Functions**: Specific functions are written to update specific parts of the DOM based on the data in `appState`.
3.  **Main Render Function**: A main `render()` function calls all individual UI update functions to synchronize the entire UI with the state.
4.  **Event Loop**: The `render()` function is called after any change to the `appState` object, whether from user interaction (e.g., button click) or incoming server data (e.g., WebSocket message).

### Project Structure

*The project is organized into the following directories:*
*   `src/css`: Contains the CSS files.
*   `src/modules`: Contains the JavaScript modules. A dedicated `api.js` module should be created here to organize all `fetch` calls to the `reaprime` API.
*   `src/ui`: Contains the UI assets (fonts, icons).