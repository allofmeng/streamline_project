# Overview of skin.tcl for HTML/JavaScript Rewrite

This document provides a breakdown of the `skin.tcl` file to guide its recreation in a modern web stack (HTML, CSS, JavaScript).

## High-Level Overview

The `skin.tcl` file defines the entire application UI for the "Streamline" skin. It acts as a monolithic file for structure (HTML), styling (CSS), and logic (JavaScript).

Its primary responsibilities are:
1.  **Theming & Styling**: Defines all colors and fonts for both light and dark modes.
2.  **Layout**: Programmatically draws every UI element, defining its position and size.
3.  **Data Binding**: Connects UI text elements to live data from the machine and application settings. When a variable changes, the UI updates.
4.  **Event Handling**: Creates buttons and clickable areas, defining actions for clicks and long-presses.
5.  **State Management**: Manages the application's state, such as the current page and machine settings.

---

## Key Sections & Functions (and their JavaScript/CSS Equivalents)

### 1. Theming and Color Definition (Lines ~15 to ~250)
*   **What it does:** This section uses `set ::variable_name #color_code` to define all UI colors. It uses an `if {$::streamline_dark_mode == 0}` block to switch between light and dark themes. It also defines colors for the shot graph (`::pressurelinecolor`, `::flow_line_color`, etc.).
*   **How to Recreate:** This is a perfect use case for **CSS Custom Properties (variables)**. Define two sets of color variables under a class or data attribute on the `<body>` tag to handle theme switching.

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

### 2. Font Loading (Lines ~255 to ~350)
*   **What it does:** Uses a custom `load_font` command to load `.ttf` font files and assign them aliases (e.g., "Inter-Bold16").
*   **How to Recreate:** This is done with the `@font-face` rule in your main CSS file.

### 3. UI Layout and Structure (Lines ~350 to ~450)
*   **What it does:** Defines the list of pages (`::all_pages`) and uses helper functions like `streamline_rectangle` to draw the main background boxes and lines of the UI.
*   **How to Recreate:** This is your core **HTML structure**. Use `<div>` elements for each box and line, and style them with CSS using **Flexbox** or **CSS Grid** to achieve the layout.

### 4. UI Components & Data Display
This is the most important part of the file, using commands like `add_de1_variable`, `add_de1_text`, and `add_de1_button`.

*   **`add_de1_variable` / `add_de1_text`**:
    *   **What it does:** Places text on the screen. The `-textvariable` option binds the displayed text to a global variable, so the text updates when the variable changes.
    *   **How to Recreate:** This is the core of a **reactive UI framework** like React, Vue, or Svelte. You create components whose rendered output depends on state or props. When the state changes, the framework re-renders the component.
      *   Tcl: `add_de1_variable ... -textvariable {$::settings(grinder_setting)}`
      *   JS (React Example): `<span>{settings.grinder_setting}</span>`

*   **`add_de1_button` / `dui add dbutton`**:
    *   **What it does:** Creates buttons. The `-command` option specifies a function to run on click, and `-longpress_cmd` for long presses.
    *   **How to Recreate:** Use standard HTML `<button>` elements with JavaScript event listeners (`onClick`, `onMouseDown`, `onMouseUp`). Use a timer within the mouse events to detect a long press.

*   **`add_de1_rich_text`**:
    *   **What it does:** Creates a single line of text from multiple parts, each with its own style and click action. Used for the main data readouts (Mix, Group, Steam, etc.).
    *   **How to Recreate:** Create a container `<div>` and fill it with multiple `<span>` elements, each with its own styles and `onClick` handler.

### 5. Key Logic Functions

*   **`update_streamline_status_message`**: A complex function that builds the status message and progress bar (e.g., "Heating: 50s remaining", "Ready"). This will be a major JavaScript function that takes in the machine state and returns the appropriate UI data.
*   **`update_datacard_from_live_data` & `update_data_card`**: These functions populate the shot data summary at the bottom. This would be a `<DataCard>` component in a JS framework.
*   **`streamline_adjust_grind`, `streamline_dosebev_select`, etc.**: Event handlers for the settings on the left panel. In JavaScript, these will be functions that update your central state object.

---

## Summary & Path Forward (Plain JavaScript Approach)

To recreate this application using plain HTML, CSS, and JavaScript without a UI framework, follow a state-driven but manual update approach:

1.  **Central State Object**: Create a single, global JavaScript object to hold all application `settings` and live `machineData`. This is the "single source of truth" for your application's state.

    ```javascript
    const appState = {
      settings: {
        grinder_setting: 10,
        espresso_temperature: 92,
        // ... all other settings
      },
      machineData: {
        pressure: 0.0,
        flow: 0.0,
        // ... live data from WebSocket
      }
    };
    ```

2.  **API Layer**: Create a dedicated JavaScript module (e.g., `api.js`) to organize all your `fetch` calls to the `reaprime` API. This keeps your API logic separate from your UI logic.

3.  **UI Update Functions**: For each part of the UI that needs to be dynamic, write a specific function that finds the correct DOM element and updates its content based on the `appState` object.

    ```javascript
    function updateSettingsUI() {
      document.getElementById('grind-value').textContent = appState.settings.grinder_setting;
      document.getElementById('temp-value').textContent = appState.settings.espresso_temperature;
    }

    function updateMachineDataUI() {
      document.getElementById('pressure-display').textContent = appState.machineData.pressure.toFixed(2);
      document.getElementById('flow-display').textContent = appState.machineData.flow.toFixed(2);
    }
    ```

4.  **Main Render Function**: Create a single main `render()` function that calls all of your individual UI update functions. This function is responsible for synchronizing the entire UI with the current `appState`.

    ```javascript
    function render() {
      updateSettingsUI();
      updateMachineDataUI();
      // ... call all other UI update functions
    }
    ```

5.  **Event Loop**: The core logic of your application will be:
    *   **Initial Load**: Fetch initial data, update `appState`, and call `render()` once.
    *   **User Interaction**: An event listener for a button click will update the relevant property in `appState` and then **immediately call `render()`**.
    *   **Data from Server**: The WebSocket `onmessage` handler will update `appState` with new data and then **immediately call `render()`**.

This "State Object + Manual Render" pattern provides a clear and manageable structure for building a reactive UI without the overhead of a framework. The key is to be disciplined about calling the main `render()` function after every single change to the `appState` object.


### 6. Font Assignments

The `skin.tcl` file uses `load_font` to create font aliases. This section maps those aliases to the font files and the UI elements they style. This is crucial for recreating the UI with correct typography in CSS.

| UI Element                             | Tcl Font Alias        | Font File                    | Weight in CSS  | Notes                                  |
| ------------------------------------ | --------------------- | ---------------------------- | -------------- | -------------------------------------- |
| Left Sidebar Labels (Grind, Dose)    | `Inter-Bold16`        | `Inter-SemiBold.ttf`         | `600`          | Font size is 14.                       |
| Left Sidebar Values (1.4, 20g)       | `Inter-Bold16`        | `Inter-SemiBold.ttf`         | `600`          | Font size is 16.                       |
| Profile Buttons (Top Favorites)      | `Inter-Bold13`        | `Inter-Bold.ttf`             | `700`          | Font size is 13.                       |
| Profile Name (Main Content)          | `Inter-HeavyBold24`   | `Inter-SemiBold.ttf`         | `600`          | Font size is 17.                       |
| Status Message (Top Right)           | `Inter-HeavyBold24`   | `Inter-SemiBold.ttf`         | `600`          | Font size is 17. Also uses `mono18`.     |
| **+/- Buttons**                      | **`Inter-Bold24`**    | **`Inter-ExtraLight.ttf`**   | **`200`**      | Font size is **29**. This is a key style. |
| Data Line Labels (Mix, Group)        | `Inter-Bold18`        | `Inter-SemiBold.ttf`         | `600`          | Font size is 13.                       |
| Data Line Values (Temperatures)      | `mono12`, `mono8`     | `NotoSansMono-SemiBold.ttf`  | `600`          | Font sizes 13 and 10 respectively.     |
| Shot Data Table (Headers & Data)     | `Inter-Bold17`, `mono10`| `Inter-SemiBold.ttf`, `NotoSansMono-SemiBold.ttf` | `600`, `600` |                                        |

### 7. Color Assignments

The `skin.tcl` file defines all colors as variables. Below is a summary of these colors for both Light and Dark modes. These should be translated into CSS Custom Properties for the rewrite.

#### Light Mode

| UI Element / Purpose                 | Tcl Variable Name                          | Color Code |
| ------------------------------------ | ------------------------------------------ | ---------- |
| **General & Text**                   |                                            |            |
| Main Background                      | `::background_color`                       | `#FFFFFF`  |
| Primary Text (Data)                  | `::data_card_text_color`                   | `#121212`  |
| Secondary Text (Labels)              | `::data_card_title_text_color`             | `#707485`  |
| Profile Title & Left Labels          | `::profile_title_color`, `::left_label_color2` | `#385a92`  |
| Disabled Text                        | `::left_label_color2_disabled`             | `#d0d8e5`  |
| Preset Value Text                    | `::preset_value_color`                     | `#AAAAAA`  |
| Selected Preset Text                 | `::preset_label_selected_color`            | `#777777`  |
| **UI Components**                    |                                            |            |
| Panel/Box Background                 | `::box_color`                              | `#f6f8fa`  |
| Line / Divider                       | `::box_line_color`                         | `#e8e8e8`  |
| +/- Button Background                | `::plus_minus_flash_off_color`             | `#ededed`  |
| Selected Profile Button BG           | `::profile_button_background_selected_color` | `#385992`  |
| +/- Button Flash (first color)       | `::plus_minus_flash_on_color`              | `#b8b8b8`  |
| +/- Button Flash (second color)      | `::plus_minus_flash_on_color2`             | `#cfcfcf`  |
| Blink Button Color                   | `::blink_button_color`                     | `#395ab9`  |
| +/- Outline Color                    | `::plus_minus_outline_color`               | `#f6f8fa`  |
| GHC Button Outline                   | `::ghc_button_outline`                     | `#f6f8fa`  |
| **Chart Colors**                     |                                            |            |
| Pressure Line                        | `::pressurelinecolor`                      | `#17c29a`  |
| Flow Line                            | `::flow_line_color`                        | `#0358cf`  |
| Temperature Line                     | `::temperature_line_color`                 | `#ff97a1`  |
| Weight Line                          | `::weightlinecolor`                        | `#e9d3c3`  |
| Grid Lines                           | `::grid_color`                             | `#E0E0E0`  |
| Chart Background                     | `::chart_background`                       | `#FFFFFF`  |

#### Dark Mode

| UI Element / Purpose                 | Tcl Variable Name                  | Color Code |
| ------------------------------------ | ---------------------------------- | ---------- |
| **General & Text**                   |                                    |            |
| Main Background                      | `::background_color`               | `#0d0e14`  |
| Primary Text (Data)                  | `::data_card_text_color`           | `#e8e8e8`  |
| Secondary Text (Labels)              | `::data_card_title_text_color`     | `#707485`  |
| Profile Title & Left Labels          | `::profile_title_color`, `::left_label_color2` | `#e8e8e8`, `#415996` |
| Disabled Text                        | `::left_label_color2_disabled`     | `#202c4c`  |
| Preset Value Text                    | `::preset_value_color`             | `#4e5559`  |
| Selected Preset Text                 | `::preset_label_selected_color`    | `#999999`  |
| **UI Components**                    |                                    |            |
| Panel/Box Background                 | `::box_color`                      | `#17191e`  |
| Line / Divider                       | `::box_line_color`                 | `#000000`  |
| +/- Button Background                | `::plus_minus_flash_off_color`     | `#101115`  |
| Selected Profile Button BG           | `::profile_button_background_selected_color` | `#415996`  |
| +/- Button Flash (first color)       | `::plus_minus_flash_on_color`      | `#272A34`  |
| +/- Button Flash (second color)      | `::plus_minus_flash_on_color2`     | `#1a1d25`  |
| +/- Outline Color                    | `::plus_minus_outline_color`       | `#17191e`  |
| GHC Button Outline                   | `::ghc_button_outline`             | `#17191e`  |
| GHC Disabled Button Outline          | `::ghc_disabled_button_outline`    | `#17191e`  |
| GHC Enabled Stop Button Outline      | `::ghc_enabled_stop_button_outline`| `#17191e`  |
| Chart Background                     | `::chart_background`               | `#0d0e14`  |
| **Chart Colors**                     |                                    |            |
| Pressure Line                        | `::pressurelinecolor`              | `#17c29a`  |
| Flow Line                            | `::flow_line_color`                | `#0358cf`  |
| Temperature Line                     | `::temperature_line_color`         | `#AE6D73`  |
| Weight Line                          | `::weightlinecolor`                | `#695f57`  |
| Grid Lines                           | `::grid_color`                     | `#212227`  |
