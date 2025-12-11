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
*   **What it does:** This section uses `set ::variable_name #color_code` to define all UI colors. It uses an `if {$::streamline_dark_mode == 0}` block to switch between light and dark themes.
 It also defines colors for the shot graph (`::pressurelinecolor`, `::flow_line_color`, etc.).                                                                                                  
*   **How to Recreate:** This is a perfect use case for **CSS Custom Properties (variables)**. Define two sets of color variables under a class or data attribute on the `<body>` tag to handle 
theme switching.                                                                                                                                                                                
                                                                                                                                                                                                
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
                                                                                                                                                                                                
#### Key UI Element Dimensions                                                                                                                                                                  
*   **Favorite Button:** Height = 12.5% of device width and 7.5% of device height.                                                                                                                
*   **Left Hand Side Control Panel:** Width = 25% of screen width, Height = 85% of device height.                                                                                                
*   **Top Header Container:** Height = 13.8% of device height, Full screen width.                                                                                                                 
     
                                                                                                                                                                                                
### 4. UI Components & Data Display                                                                                                                                                             
This is the most important part of the file, using commands like `add_de1_variable`, `add_de1_text`, and `add_de1_button`.                                                                      
                                                                                                                                                                                                
*   **`add_de1_variable` / `add_de1_text`**:                                                                                                                                                    
    *   **What it does:** Places text on the screen. The `-textvariable` option binds the displayed text to a global variable, so the text updates when the variable changes.                   
    *   **How to Recreate:** This is the core of a **reactive UI framework** like React, Vue, or Svelte. You create components whose rendered output depends on state or props. When the state c
hanges, the framework re-renders the component.                                                                                                                                                 
      *   Tcl: `add_de1_variable ... -textvariable {$::settings(grinder_setting)}`                                                                                                              
      *   JS (React Example): `<span>{settings.grinder_setting}</span>`                                                                                                                         
                                                                                                                                                                                                
*   **`add_de1_button` / `dui add dbutton`**:                                                                                                                                                   
    *   **What it does:** Creates buttons. The `-command` option specifies a function to run on click, and `-longpress_cmd` for long presses.                                                   
    *   **How to Recreate:** Use standard HTML `<button>` elements with JavaScript event listeners (`onClick`, `onMouseDown`, `onMouseUp`). Use a timer within the mouse events to detect a long
 press.                                                                                                                                                                                         
                                                                                                                                                                                                
*   **`add_de1_rich_text`**:                                                                                                                                                                    
    *   **What it does:** Creates a single line of text from multiple parts, each with its own style and click action. Used for the main data readouts (Mix, Group, Steam, etc.).               
    *   **How to Recreate:** Create a container `<div>` and fill it with multiple `<span>` elements, each with its own styles and `onClick` handler.                                            
                                                                                                                                                                                                
### 5. Key Logic Functions                                                                                                                                                                      
                                                                                                                                                                                                
*   **`update_streamline_status_message`**: A complex function that builds the status message and progress bar (e.g., "Heating: 50s remaining", "Ready"). This will be a major JavaScript functi
on that takes in the machine state and returns the appropriate UI data.                                                                                                                         
*   **`update_datacard_from_live_data` & `update_data_card`**: These functions populate the shot data summary at the bottom. This would be a `<DataCard>` component in a JS framework.          
*   **`streamline_adjust_grind`, `streamline_dosebev_select`, etc.**: Event handlers for the settings on the left panel. In JavaScript, these will be functions that update your central state o
bject.                                                                                                                                                                                          
                                                                                                                                                                                                
---                                                                                                                                                                                             
                                                                                                                                                                                                
## Summary & Path Forward (Plain JavaScript Approach)                                                                                                                                           
                                                                                                                                                                                                
To recreate this application using plain HTML, CSS, and JavaScript without a UI framework, follow a state-driven but manual update approach:                                                    
                                                                                                                                                                                                
1.  **Central State Object**: Create a single, global JavaScript object to hold all application `settings` and live `machineData`. This is the "single source of truth" for your application's s
tate.                                                                                                                                                                                           
                                                                                                                                                                                                
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
                                                                                                                                                                                                
3.  **UI Update Functions**: For each part of the UI that needs to be dynamic, write a specific function that finds the correct DOM element and updates its content based on the `appState` obje
ct.                                                                                                                                                                                             
                                                                                                                                                                                                
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
                                                                                                                                                                                                
4.  **Main Render Function**: Create a single main `render()` function that calls all of your individual UI update functions. This function is responsible for synchronizing the entire UI with 
the current `appState`.                                                                                                                                                                         
                                                                                                                                                                                                
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
                                                                                                                                                                                                
This "State Object + Manual Render" pattern provides a clear and manageable structure for building a reactive UI without the overhead of a framework. The key is to be disciplined about calling
 the main `render()` function after every single change to the `appState` object.                                                                                                               
                                                                                                                                                                                                
                                                                                                                                                                                                
### 6. Font Assignments                                                                                                                                                                         
                                                                                                                                                                                                
The `skin.tcl` file uses `load_font` to create font aliases. This section maps those aliases to the font files and the UI elements they style. This is crucial for recreating the UI with correc
t typography in CSS.                                                                                                                                                                            
                                                                                                                                                                                                
| UI Element                             | Tcl Font Alias        | Font File                    | Weight in CSS  | Notes                                  |                                     
| ------------------------------------ | --------------------- | ---------------------------- | -------------- | -------------------------------------- |                                       
| Left Sidebar Labels (Grind, Dose)    | `Inter-Bold16`        | `Inter-SemiBold.ttf`         | `600`          | Font size is 14.                       |                                       
| Left Sidebar Values (1.4, 20g)       | `Inter-Bold16`        | `Inter-SemiBold.ttf`         | `600`          | Font size is 16.                       |                                       
| Profile Buttons (Top Favorites)      | `Inter-Bold13`        | `Inter-Bold.ttf`             | `Bold (700)`   | Font size is 13. Used for dbutton elements. |                                       
| Profile Name (Main Content)          | `Inter-HeavyBold24`   | `Inter-SemiBold.ttf`         | `600`          | Font size is 17.                       |                                       
| Status Message (Top Right)           | `Inter-HeavyBold24`   | `Inter-SemiBold.ttf`         | `600`          | Font size is 17. Also uses `mono18`.     |                                     
| **+/- Buttons**                      | **`Inter-Bold24`**    | **`Inter-ExtraLight.ttf`**   | **`200`**      | Font size is **29**. This is a key style. |                                    
| Data Line Labels (Mix, Group)        | `Inter-Bold18`        | `Inter-SemiBold.ttf`         | `600`          | Font size is 13.                       |                                       
| Data Line Values (Temperatures)      | `mono12`, `mono8`     | `NotoSansMono-SemiBold.ttf`  | `600`          | Font sizes 13 and 10 respectively.     |                                       
| Shot Data Row Labels (Preinfusion, Extraction, Total) | `Inter-Bold17` | `Inter-SemiBold.ttf` | `600` | Font size is 12. |
| Shot Data Column Headers (Time, Grams, mL, °C, mL/s, Pressure) | `Inter-Bold17` | `Inter-SemiBold.ttf` | `600` | Font size is 12. |
| Shot Data Values     | `mono10`| `NotoSansMono-SemiBold.ttf` | `600` | Font size is 12. |                  
                                                                                                                                                                                                
### 7. Color Assignments                                                                                                                                                                        
                                                                                                                                                                                                
The `skin.tcl` file defines all colors as variables. Below is a summary of these colors for both Light and Dark modes. These should be translated into CSS Custom Properties for the rewrite.   
                                                                                                                                                                                                
#### Light Mode                                                                                                                                                                                 
                                                                                                                                                                                                
| UI Element / Purpose                 | Tcl Variable Name                          | Color Code |                                                                                              
| ------------------------------------ | ------------------------------------------ | ---------- |                                                                                              
| **General & Text**                   |                                            |            |                                                                                              
| Main Background                      | `::background_color`                       | `#FFFFFF`  |                                                                                              
| Primary Text (Data)                  | `::data_card_text_color` , `::datacard_number_text_color`, `::plus_minus_text_color`, `::plus_minus_value_text_color`, `::dataline_data_color` | `#121212`  |                                                                                              
| Secondary Text (Labels)              | `::data_card_title_text_color`, `::dataline_label_color`| `#707485`  |                                                                                              
| Profile Title & Left Labels          | `::profile_title_color`, `::left_label_color2` | `#385a92`  |                                                                                          
| Disabled Text                        | `::left_label_color2_disabled`             | `#d0d8e5`  |                                                                                              
| Disabled +/- Value Text              | `::plus_minus_value_text_color_disabled`  | `#c8cacc`  |                                                                                              
| Preset Value Text                    | `::preset_value_color`                     | `#AAAAAA`  |                                                                                              
| Disabled Preset Value Text           | `::preset_value_color_disabled`            | `#e3e4e6`  |                                                                                              
| Selected Preset Text                 | `::preset_label_selected_color`            | `#777777`  |                                                                                              
| Status Clickable Text                | `::status_clickable_text`                  | `#1967d4`  |                                                                                              
| Button Inverted Text                 | `::button_inverted_text_color`             | `#FFFFFF`  |                                                                                              
| **UI Components**                    |                                            |            |                                                                                              
| Panel/Box Background                 | `::box_color`                              | `#f6f8fa`  |                                                                                              
| Data Card Background                 | `::data_card_background_color`             | `#FFFFFF`  |                                                                                              
| Line / Divider                       | `::box_line_color`                         | `#e8e8e8`  |                                                                                              
| Data Card Line / Divider             | `::datacard_box_line_color`                | `#A5A5A5`  |                                                                                              
| Data Entry Box                       | `::datacard_entry_box_color`               | `#1867D6`  |                                                                                              
| Data Entry Favorites Border          | `::dataentry_favorites_border_color`       | `#888888`  |                                                                                              
| Data Card Previous                   | `::data_card_previous_color`               | `#ffffff`  |                                                                                              
| Data Card Previous Outline           | `::data_card_previous_outline_color`       | `#121212`  |                                                                                              
| **Buttons**                          |                                            |            |                                                                                              
| +/- Button Background                | `::plus_minus_flash_off_color`             | `#ededed`  |                                                                                              
| +/- Button Background (Disabled)     | `::plus_minus_flash_off_color_disabled`    | `#f4f6f7`  |                                                                                              
| +/- Button Flash (first color)       | `::plus_minus_flash_on_color`              | `#b8b8b8`  |                                                                                              
| +/- Button Flash (second color)      | `::plus_minus_flash_on_color2`             | `#cfcfcf`  |                                                                                              
| +/- Button Refused Flash             | `::plus_minus_flash_refused_color`         | `#e34e4e`  |                                                                                              
| +/- Outline Color                    | `::plus_minus_outline_color`               | `#f6f8fa`  |                                                                                              
| Data Entry Button                    | `::dataentry_button_color`                 | `#C9C9C9`  |                                                                                              
| Data Entry Button Flash 1            | `::dataentry_button_color_flash1`          | `#888888`  |                                                                                              
| Data Entry Button Flash 2            | `::dataentry_button_color_flash2`          | `#666666`  |                                                                                              
| Data Card Confirm Button             | `::data_card_confirm_button`               | `#385A92`  |                                                                                              
| Data Card Confirm Button Text        | `::data_card_confirm_button_text`          | `#FFFFFF`  |                                                                                              
| Profile Button Background            | `::profile_button_background_color`        | `#FFFFFF`  |                                                                                              
| Profile Button Outline               | `::profile_button_outline_color`           | `#c5cdda`  |                                                                                              
| Selected Profile Button BG           | `::profile_button_background_selected_color` | `#385992`  |                                                                                            
| Unused Profile Button BG             | `::profile_button_background_unused_color` | `#f3f4f6`  |                                                                                              
| Profile Button Text                  | `::profile_button_button_color`            | `#5f7ba8`  |                                                                                              
| Selected Profile Button Text         | `::profile_button_button_selected_color`   | `#e8e8e8`  |                                                                                              
| Not Selected Profile Button Text     | `::profile_button_not_selected_color`      | `#607aa7`  |                                                                                              
| Settings/Sleep Button BG             | `::settings_sleep_button_color`            | `#f6f8fa`  |                                                                                              
| Settings/Sleep Button Outline        | `::settings_sleep_button_outline_color`    | `#3d5782`  |                                                                                              
| Settings/Sleep Button Text           | `::settings_sleep_button_text_color`       | `#385a92`  |                                                                                              
| Blink Button Color                   | `::blink_button_color`                     | `#395ab9`  |                                                                                              
| **GHC Buttons**                      |                                            |            |                                                                                              
| GHC Button Color                     | `::ghc_button_color`                       | `#375a92`  |                                                                                              
| GHC Button Background                | `::ghc_button_background_color`            | `#FFFFFF`  |                                                                                              
| GHC Button Outline                   | `::ghc_button_outline`                     | `#f6f8fa`  |                                                                                              
| GHC Disabled Button Fill             | `::ghc_disabled_button_fill`               | `#f8fafb`  |                                                                                              
| GHC Disabled Button Outline          | `::ghc_disabled_button_outline`            | `#c5d0df`  |                                                                                              
| GHC Disabled Button Text             | `::ghc_disabled_button_text`               | `#c5d0df`  |                                                                                              
| GHC Enabled Button Fill              | `::ghc_enabled_button_fill`                | `#f8fafb`  |                                                                                              
| GHC Enabled Stop Button Fill         | `::ghc_enabled_stop_button_fill`           | `#efd7db`  |                                                                                              
| GHC Enabled Stop Button Outline      | `::ghc_enabled_stop_button_outline`        | `#efd7db`  |                                                                                              
| GHC Enabled Stop Button Fill Color   | `::ghc_enabled_stop_button_fill_color`     | `#da515e`  |                                                                                              
| GHC Enabled Stop Button Text         | `::ghc_enabled_stop_button_text_color`     | `#f9f8fc`  |                                                                                              
| GHC Disabled Stop Button Text        | `::ghc_disabled_stop_button_text_color`    | `#f9f8fc`  |                                                                                              
| **Progress Bar**                     |                                            |            |                                                                                              
| Progress Bar Red                     | `::progress_bar_red`                       | `#DA515E`  |                                                                                              
| Progress Bar Green                   | `::progress_bar_green`                     | `#0CA581`  |                                                                                              
| Progress Bar Grey                    | `::progress_bar_grey`                      | `#c2c2c2`  |                                                                                              
| **Chart Colors**                     |                                            |            |                                                                                              
| Pressure Line                        | `::pressurelinecolor`                      | `#17c29a`  |                                                                                              
| Flow Line                            | `::flow_line_color`                        | `#0358cf`  |                                                                                              
| Temperature Line                     | `::temperature_line_color`                 | `#ff97a1`  |                                                                                              
| Weight Line                          | `::weightlinecolor`                        | `#e9d3c3`  |                                                                                              
| Pressure Goal Line                   | `::pressurelinecolor_goal`                 | `#a0e0d1`  |                                                                                              
| Flow Goal Line                       | `::flow_line_color_goal`                   | `#bed9ff`  |                                                                                              
| Temperature Goal Line                | `::temperature_line_color_goal`            | `#ffd1d5`  |                                                                                              
| State Change Line                    | `::state_change_color`                     | `#7c7c7c`  |                                                                                              
| Grid Lines                           | `::grid_color`                             | `#E0E0E0`  |                                                                                              
| Chart Background                     | `::chart_background`                       | `#FFFFFF`  |                                                                                              
| Pressure Label                       | `::pressurelabelcolor`                     | `#959595`  |                                                                                              
| Temperature Label                    | `::temperature_label_color`                | `#959595`  |                                                                                              
| Flow Label                           | `::flow_label_color`                       | `#1767d4`  |
# TCL Font Usage Guide

This document outlines the font styles, weights, and their associated elements found in the `skin.tcl` file. This guide should be used as a reference when rewriting the UI in HTML/CSS.

## Font Families

The two primary font families used are `Inter` and a monospace font `mono`.

### Inter Font Family

| Font Style          | Weight    | Size | Element/Usage                                                                 |
| ------------------- | --------- | ---- | ----------------------------------------------------------------------------- |
| `Inter-HeavyBold24` | HeavyBold | 24   | Status messages (`status_msg_text_green`, `status_msg_text_red`)                |
| `Inter-HeavyBold30` | HeavyBold | 30   | Data entry page cancel/confirm buttons                                        |
| `Inter-HeavyBold35` | HeavyBold | 35   | Data entry page previous value buttons                                        |
| `Inter-HeavyBold40` | HeavyBold | 40   | Data entry page title                                                           |
| `Inter-HeavyBold50` | HeavyBold | 50   | Data entry page value                                                           |
| `Inter-Bold18`      | Bold      | 18   | Dataline labels (Mix, Group, Steam, Tank, Clock, Calib, Weight, Temp, Flow, etc.) |
| `Inter-Bold16`      | Bold      | 16   | Dataline separators                                                             |
| `Inter-Bold30`      | Bold      | 30   | Data entry page numpad buttons                                                  |
| `Inter-Bold40`      | Bold      | 40   | Data entry page numpad buttons                                                  |
| `Inter-SemiBold18`  | SemiBold  | 18   | Dataline separators and labels                                                  |
| `Inter-Regular6`    | Regular   | 6    | Progress bar text (commented out)                                               |
| `Inter-Regular20`   | Regular   | 20   | Data entry hint, "Previous Values" label                                        |

### Mono Font Family

| Font Style | Weight  | Size | Element/Usage                                            |
| ---------- | ------- | ---- | -------------------------------------------------------- |
| `mono18`   | Regular | 18   | Clickable status messages (`status_msg_text_clickable`)  |
| `mono12`   | Regular | 12   | Dataline data (temperature, time, flow, weight, etc.)    |
| `mono8`    | Regular | 8    | Dataline units (ml/s, bar, g, etc.)                      |

### 8. Button Sizing

Button sizes in `skin.tcl` are defined by absolute coordinates. For the HTML/CSS rewrite, these should be treated as guidelines for responsive design.

| Button Type                          | Typical Dimensions (Width x Height in px on 2560*1600) | Notes                                                                            |
| ------------------------------------ | ----------------------------------------- | -------------------------------------------------------------------------------- |
| **Top Profile Favorites Buttons** |  320*120 px 
| **Large Control Buttons** (Header/Footer actions) | ~630px x ~80px (e.g., settings button area)     | Buttons like the large settings/off page button.                                 |
| **History Navigation Buttons**       | ~54px x ~54px                           | Left/Right arrows for shot history.                                              |
| **Left Sidebar Setting Buttons**     | ~96px x ~96px                            | Buttons for adjusting Grind, Dose, Temp, Steam, Flush, Hot Water values.         |
| **Left Sidebar Preset Buttons**      | ~148px x ~62px                            | Smaller buttons for quick selection of presets (e.g., 18:36, 75°c).              |
| **Mode Toggle Areas** (Hot Water/Steam) | 176px x ~31px                       | Area for toggling between Time/Flow or Temp/Vol display/control.                 |                                                                                              
                                                                                                                                                                                                
#### Dark Mode                                                                                                                                                                                  
                                                                                                                                                                                                
| UI Element / Purpose                 | Tcl Variable Name                  | Color Code |                                                                                                      
| ------------------------------------ | ---------------------------------- | ---------- |                                                                                                      
| **General & Text**                   |                                    |            |                                                                                                      
| Main Background                      | `::background_color`               | `#0d0e14`  |                                                                                                      
| Primary Text (Data)                  | `::data_card_text_color`, `::datacard_number_text_color`, `::plus_minus_value_text_color`, `::dataline_data_color`, `::ghc_button_color` | `#e8e8e8`  |                                                                                                      
| Secondary Text (Labels)              | `::data_card_title_text_color`, `::dataline_label_color`| `#707485`  |                                                                                                      
| +/- Text Color                       | `::plus_minus_text_color`          | `#959595`  |                                                                                                      
| Profile Title                        | `::profile_title_color`            | `#e8e8e8`  |                                                                                                      
| Left Labels                          | `::left_label_color2`              | `#415996`  |                                                                                                      
| Disabled Text                        | `::left_label_color2_disabled`     | `#202c4c`  |                                                                                                      
| Disabled +/- Value Text              | `::plus_minus_value_text_color_disabled`| `#4a4a4a`  |                                                                                                      
| Preset Value Text                    | `::preset_value_color`             | `#4e5559`  |                                                                                                      
| Disabled Preset Value Text           | `::preset_value_color_disabled`    | `#262a2c`  |                                                                                                      
| Selected Preset Text                 | `::preset_label_selected_color`    | `#999999`  |                                                                                                      
| Status Clickable Text                | `::status_clickable_text`          | `#415996`  |                                                                                                      
| Button Inverted Text                 | `::button_inverted_text_color`     | `#FFFFFF`  |                                                                                                      
| **UI Components**                    |                                    |            |                                                                                                      
| Panel/Box Background                 | `::box_color`                      | `#17191e`  |                                                                                                      
| Data Card Background                 | `::data_card_background_color`     | `#17191E`  |                                                                                                      
| Line / Divider                       | `::box_line_color`                 | `#000000`  |                                                                                                      
| Data Card Line / Divider             | `::datacard_box_line_color`        | `#3D4255`  |                                                                                                      
| Data Entry Box                       | `::datacard_entry_box_color`       | `#415996`  |                                                                                                      
| Data Entry Favorites Border          | `::dataentry_favorites_border_color`| `#666666`  |                                                                                                      
| Data Card Previous                   | `::data_card_previous_color`       | `#101117`  |                                                                                                      
| Data Card Previous Outline           | `::data_card_previous_outline_color`| `#121212`  |                                                                                                      
| **Buttons**                          |                                    |            |                                                                                                      
| +/- Button Background                | `::plus_minus_flash_off_color`     | `#101115`  |                                                                                                      
| +/- Button Background (Disabled)     | `::plus_minus_flash_off_color_disabled`| `#14151b`  |                                                                                                      
| +/- Button Flash (first color)       | `::plus_minus_flash_on_color`      | `#272A34`  |                                                                                                      
| +/- Button Flash (second color)      | `::plus_minus_flash_on_color2`     | `#1a1d25`  |                                                                                                      
| +/- Button Refused Flash             | `::plus_minus_flash_refused_color` | `#e34e4e`  |                                                                                                      
| +/- Outline Color                    | `::plus_minus_outline_color`       | `#17191e`  |                                                                                                      
| Data Entry Button                    | `::dataentry_button_color`         | `#292C38`  |                                                                                                      
| Data Entry Button Flash 1            | `::dataentry_button_color_flash1`  | `#333333`  |                                                                                                      
| Data Entry Button Flash 2            | `::dataentry_button_color_flash2`  | `#444444`  |                                                                                                      
| Data Card Confirm Button             | `::data_card_confirm_button`       | `#385A92`  |                                                                                                      
| Data Card Confirm Button Text        | `::data_card_confirm_button_text`  | `#FFFFFF`  |                                                                                                      
| Profile Button Background            | `::profile_button_background_color`| `#292c38`  |                                                                                                      
| Profile Button Outline               | `::profile_button_outline_color`   | `#17191e`  |                                                                                                      
| Selected Profile Button BG           | `::profile_button_background_selected_color` | `#415996`  |                                                                                            
| Unused Profile Button BG             | `::profile_button_background_unused_color` | `#1d1f2b`  |                                                                                              
| Profile Button Text                  | `::profile_button_button_color`    | `#e8e8e8`  |                                                                                                      
| Selected Profile Button Text         | `::profile_button_button_selected_color`| `#e8e8e8`  |                                                                                                      
| Not Selected Profile Button Text     | `::profile_button_not_selected_color` | `#e8e8e8`  |                                                                                                      
| Settings/Sleep Button BG             | `::settings_sleep_button_color`    | `#101117`  |                                                                                                      
| Settings/Sleep Button Outline        | `::settings_sleep_button_outline_color` | `#17191e`  |                                                                                                      
| Settings/Sleep Button Text           | `::settings_sleep_button_text_color`| `#e8e8e8`  |                                                                                                      
| Blink Button Color                   | `::blink_button_color`             | `#395ab9`  |                                                                                                      
| **GHC Buttons**                      |                                    |            |                                                                                                      
| GHC Button Background                | `::ghc_button_background_color`    | `#6576a0`  |                                                                                                      
| GHC Button Outline                   | `::ghc_button_outline`             | `#17191e`  |                                                                                                      
| GHC Disabled Button Fill             | `::ghc_disabled_button_fill`       | `#101115`  |                                                                                                      
| GHC Disabled Button Outline          | `::ghc_disabled_button_outline`    | `#17191e`  |                                                                                                      
| GHC Disabled Button Text             | `::ghc_disabled_button_text`       | `#202635`  |                                                                                                      
| GHC Enabled Button Fill              | `::ghc_enabled_button_fill`        | `#f8fafb`  |                                                                                                      
| GHC Enabled Stop Button Fill         | `::ghc_enabled_stop_button_fill`   | `#3a252b`  |                                                                                                      
g| GHC Enabled Stop Button Outline      | `::ghc_enabled_stop_button_outline`| `#17191e`  |                                                                                                      
| GHC Enabled Stop Button Fill Color   | `::ghc_enabled_stop_button_fill_color` | `#db515d`  |                                                                                                      
| GHC Enabled Stop Button Text         | `::ghc_enabled_stop_button_text_color`| `#e8e8e8`  |                                                                                                      
| GHC Disabled Stop Button Text        | `::ghc_disabled_stop_button_text_color`| `#5d5050`  |                                                                                                      
| **Progress Bar**                     |                                    |            |                                                                                                      
| Progress Bar Red                     | `::progress_bar_red`               | `#DA515E`  |                                                                                                      
| Progress Bar Green                   | `::progress_bar_green`             | `#0CA581`  |                                                                                                      
| Progress Bar Grey                    | `::progress_bar_grey`              | `#c2c2c2`  |                                                                                                      
| **Chart Colors**                     |                                    |            |                                                                                                      
| Pressure Line                        | `::pressurelinecolor`              | `#17c29a`  |                                                                                                      
| Flow Line                            | `::flow_line_color`                | `#0358cf`  |                                                                                                      
| Temperature Line                     | `::temperature_line_color`         | `#AE6D73`  |                                                                                                      
| Weight Line                          | `::weightlinecolor`                | `#695f57`  |                                                                                                      
| Pressure Goal Line                   | `::pressurelinecolor_goal`         | `#374d47`  |                                                                                                      
| Flow Goal Line                       | `::flow_line_color_goal`           | `#23416c`  |                                                                                                      
| Temperature Goal Line                | `::temperature_line_color_goal`    | `#3e3233`  |                                                                                                      
| State Change Line                    | `::state_change_color`             | `#7f8bbb`  |                                                                                                      
| Grid Lines                           | `::grid_color`                     | `#212227`  |                                                                                                      
| Chart Background                     | `::chart_background`               | `#0d0e14`  |                                                                                                      
| Pressure Label                       | `::pressurelabelcolor`             | `#606579`  |                                                                                                      
| Temperature Label                    | `::temperature_label_color`        | `#959595`  |                                                                                                      
| Flow Label                           | `::flow_label_color`               | `#1767d4`  |
# TCL Font Usage Guide

This document outlines the font styles, weights, and their associated elements found in the `skin.tcl` file. This guide should be used as a reference when rewriting the UI in HTML/CSS.

## Font Families

The two primary font families used are `Inter` and a monospace font `mono`.

### Inter Font Family

| Font Style          | Weight    | Size | Element/Usage                                                                 |
| ------------------- | --------- | ---- | ----------------------------------------------------------------------------- |
| `Inter-HeavyBold24` | HeavyBold | 24   | Status messages (`status_msg_text_green`, `status_msg_text_red`)                |
| `Inter-HeavyBold30` | HeavyBold | 30   | Data entry page cancel/confirm buttons                                        |
| `Inter-HeavyBold35` | HeavyBold | 35   | Data entry page previous value buttons                                        |
| `Inter-HeavyBold40` | HeavyBold | 40   | Data entry page title                                                           |
| `Inter-HeavyBold50` | HeavyBold | 50   | Data entry page value                                                           |
| `Inter-Bold18`      | Bold      | 18   | Dataline labels (Mix, Group, Steam, Tank, Clock, Calib, Weight, Temp, Flow, etc.) |
| `Inter-Bold16`      | Bold      | 16   | Dataline separators                                                             |
| `Inter-Bold30`      | Bold      | 30   | Data entry page numpad buttons                                                  |
| `Inter-Bold40`      | Bold      | 40   | Data entry page numpad buttons                                                  |
| `Inter-SemiBold18`  | SemiBold  | 18   | Dataline separators and labels                                                  |
| `Inter-Regular6`    | Regular   | 6    | Progress bar text (commented out)                                               |
| `Inter-Regular20`   | Regular   | 20   | Data entry hint, "Previous Values" label                                        |

### Mono Font Family

| Font Style | Weight  | Size | Element/Usage                                            |
| ---------- | ------- | ---- | -------------------------------------------------------- |
| `mono18`   | Regular | 18   | Clickable status messages (`status_msg_text_clickable`)  |
| `mono12`   | Regular | 12   | Dataline data (temperature, time, flow, weight, etc.)    |
| `mono8`    | Regular | 8    | Dataline units (ml/s, bar, g, etc.)                      |