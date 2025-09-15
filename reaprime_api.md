# v1 API Documentation

## Overview

This API provides endpoints to retrieve a list of Bluetooth devices, trigger a scan for new devices, manage DE1 espresso machine state and settings, and interact with a connected scale.

## Base URL

```
http://localhost:8080
```
*Note: The API port to communicate with the Decent Espresso machine is `localhost:8080`.*

## Endpoints

### 1. Get Available Devices

**Endpoint:**

```
GET /api/v1/devices
```

**Description:**
Retrieves a list of available Bluetooth devices with their connection states.

**Response:**

- **200 OK**: Returns an array of devices with their IDs and connection states.
- **500 Internal Server Error**: Returns an error message if something goes wrong.

**Response Example:**

```json
[
  {
    "name": "DE1",
    "id": "<de1-bt-mac>",
    "state": "connected"
  },
  {
    "name": "Decent Scale",
    "id": "<decent-scale-mac>",
    "state": "disconnected"
  }
]
```

### 2. Scan for Devices

**Endpoint:**

```
GET /api/v1/devices/scan
```

**Description:**
Triggers a Bluetooth device scan. The scanning operation does not return discovered devices immediately, only triggers the scan process. Upon scanning, if a missing scale is detected, it will be connected automatically.

**Response:**

- **200 OK**: Returns an empty response body upon successful scan initiation.
- **500 Internal Server Error**: Returns an error message if scanning fails.

### 3. Get DE1 State

**Endpoint:**

```
GET /api/v1/de1/state
```

**Description:**
Retrieves the current DE1 machine state.

**Response:**
- **200 OK**: Returns a `MachineSnapshot` object.

**Response Example:**

```json
{
  "timestamp": "2025-02-01T12:34:56.789Z",
  "state": { "state": "espresso", "substate": "pouring" },
  "flow": 2.5,
  "pressure": 9.0,
  "targetFlow": 2.0,
  "targetPressure": 9.0,
  "mixTemperature": 93.5,
  "groupTemperature": 94.0,
  "targetMixTemperature": 93.0,
  "targetGroupTemperature": 94.0,
  "profileFrame": 3,
  "steamTemperature": 135.0
}
```

### 4. Request DE1 State Change

**Endpoint:**

```
PUT /api/v1/de1/state/{newState}
```

**Description:**
Requests a state change for the DE1 espresso machine.

**Parameters:**
- `newState` (path, required): The new state to transition to. See `MachineState` model for possible values.

**Response:**

- **200 OK**: If the request is successful.
- **400 Bad Request**: If the provided state is invalid.

### 5. Set DE1 Profile

**Endpoint:**

```
POST /api/v1/de1/profile
```

**Description:**
Uploads a new brewing profile to the DE1 machine. Currently supports upload of v2 json profiles, that are present in the de1app.

**Request Body:**
A `Profile` object.

**Request Body Example:**

```json
{
  "title": "Espresso Shot",
  "steps": [ ... ]
}
```

### 6. Update Shot Settings

**Endpoint:**

```
POST /api/v1/de1/shotSettings
```

**Description:**
Updates shot settings on the DE1 espresso machine.

**Request Body:**
A `ShotSettings` object.

**Request Body Example:**

```json
{
  "targetHotWaterTemp": 93.0,
  "targetSteamTemp": 9.0
}
```

### 7. Get DE1 Settings

**Endpoint:**
```
GET /api/v1/de1/settings
```
**Description:**
Pulls additional settings from the DE1.

**Response:**
- **200 OK**: Returns a `De1SettingsResponse` object.

### 8. Set DE1 Settings

**Endpoint:**
```
POST /api/v1/de1/settings
```
**Description:**
Set additional settings on the DE1, each setting can be set individually.

**Request Body:**
A `De1SettingsRequest` object.

**Response:**
- **200 OK**: Settings update successful.

### 9. Get Advanced DE1 Settings

**Endpoint:**
```
GET /api/v1/de1/settings/advanced
```
**Description:**
Get additional advanced DE1 settings.

**Response:**
- **200 OK**: Returns a `De1AdvancedSettingsResponse` object.

### 10. Set Advanced DE1 Settings

**Endpoint:**
```
POST /api/v1/de1/settings/advanced
```
**Description:**
Set advanced settings on the DE1, each setting can be sent separately.

**Request Body:**
A `De1AdvancedSettingsRequest` object.

**Response:**
- **200 OK**: Advanced settings updated successfully.

### 11. Toggle USB Charger Mode

**Endpoint:**

```
PUT /api/v1/de1/usb/{state}
```

**Description:**
Enables or disables the USB charger mode on the DE1 machine.

**Parameters:**
- `state` (path, required): `enable` or `disable`.

**Response:**

- **200 OK**: If the setting was successfully updated.
- **500 Internal Server Error**: If an error occurs.

### 12. Push Firmware to DE1

**Endpoint:**
```
POST /api/v1/de1/firmware
```
**Description:**
Send a firmware file to DE1. The call will wait until the firmware upgrade is complete (which might be a long time).

**Request Body:**
The firmware file as `application/octet-stream`.

**Response:**
- **200 OK**: Firmware update successful. Need to restart DE1 to load new firmware.
- **500 Internal Server Error**: Something went wrong during the firmware upgrade process.

### 13. Tare Scale

**Endpoint:**
```
PUT /api/v1/scale/tare
```

**Description:**
Tares the connected scale.

**Response:**

- **200 OK**: If the scale was successfully tared.
- **404 Not Found**: If the scale is not found.

### 14. Get Sensors

**Endpoint:**
```
GET /api/v1/sensors
```
**Description:**
Get a list of sensor devices connected to Rea. Will show all the sensors and their ids, that are currently connected and available through Rea.

**Response:**
- **200 OK**: List of available sensors. Each item contains `name` and `info` (`SensorManifest`).

### 15. Get Sensor Manifest

**Endpoint:**
```
GET /api/v1/sensors/{id}
```
**Description:**
Get full manifest for a sensor.

**Parameters:**
- `id` (path, required): The ID of the sensor.

**Response:**
- **200 OK**: Full sensor manifest (`SensorManifest`).
- **404 Not Found**: Sensor not found.

### 16. Get Rea Settings

**Endpoint:**
```
GET /api/v1/settings
```
**Description:**
Get Rea settings.

**Response:**
- **200 OK**: Returns `ReaSettings` object.

### 17. Update Rea Settings

**Endpoint:**
```
POST /api/v1/settings
```
**Description:**
Update Rea settings.

**Request Body:**
A `ReaSettingsRequest` object.

**Response:**
- **200 OK**: Rea settings updated successfully.

### 18. Get Sensor Snapshot

**Endpoint:**
```
GET /api/v1/sensors/{id}/snapshot
```
**Description:**
Get latest snapshot of all data channels for a sensor.

**Parameters:**
- `id` (path, required): The ID of the sensor.

**Response:**
- **200 OK**: Snapshot of current sensor values (`SensorSnapshot`).
- **404 Not Found**: Sensor not found.

### 19. Get Workflow

**Endpoint:**
```
GET /api/v1/workflow
```
**Description:**
Get info about current workflow.

**Response:**
- **200 OK**: Returns `WorkflowRequest` object.

### 20. Set/Update Workflow

**Endpoint:**
```
PUT /api/v1/workflow 
```
**Description:**
Set or update current workflow. You can update only specific fields, like `doseData` or `grinderData`, or `profile` etc.
Use this end point to update profiles for espresso making. see below example request body. 

{ "profile": 
{
  "title": "D-Flow default",
  "author": "Damian",
  "notes": "A simple",
  "beverage_type": "espresso",
  "steps": [
    {
      "name": "Filling",
      "temperature": "88",
      "sensor": "coffee",
      "pump": "pressure",
      "transition": "fast",
      "pressure": "3.0",
      "flow": "8",
      "seconds": "25.00",
      "volume": "100",
      "weight": "5.00",
      "exit": {
        "type": "pressure",
        "condition": "over",
        "value": "1.5"
      },
      "limiter": {
        "value": "0",
        "range": "0.2"
      }
    },
    {
      "name": "Infusing",
      "temperature": "88",
      "sensor": "coffee",
      "pump": "pressure",
      "transition": "fast",
      "pressure": "3.0",
      "flow": "8",
      "seconds": "60.0",
      "volume": "100.00",
      "weight": "4.00",
      "limiter": {
        "value": "0",
        "range": "0.2"
      }
    },
    {
      "name": "Pouring",
      "temperature": "88",
      "sensor": "coffee",
      "pump": "flow",
      "transition": "fast",
      "pressure": "4.8",
      "flow": "1.7",
      "seconds": "127",
      "volume": "0",
      "weight": "0.00",
      "limiter": {
        "value": "8.5",
        "range": "0.2"
      }
    }
  ],
  "tank_temperature": "0",
  "target_weight": "50",
  "target_volume": "0",
  "target_volume_count_start": "2",
  "legacy_profile_type": "settings_2c",
  "type": "advanced",
  "lang": "en",
  "hidden": "0",
  "reference_file": "D-Flow",
  "changes_since_last_espresso": "",
  "version": "2"
}
}
**Request Body:**
A `WorkflowRequest` object.

**Response:**
- **200 OK**: Returns the new workflow object (`WorkflowRequest`).

---

## WebSocket Endpoints

#### Snapshot Updates

```
GET /ws/v1/de1/snapshot
```

Receives real-time `MachineSnapshot` data from the DE1 machine.

#### Shot Settings Updates

```
GET /ws/v1/de1/shotSettings
```

Receives real-time `ShotSettings` updates.

#### Water Levels Updates

```
GET /ws/v1/de1/waterLevels
```

Receives real-time `WaterLevels` updates.

#### Scale Snapshot

```
GET /ws/v1/scale/snapshot
```

Receives real-time `ScaleSnapshot` data from the scale.

#### DE1 Raw BLE Data

```
GET /ws/v1/de1/raw
```
Receives real-time BLE data from DE1. Use this to send and receive BLE messages (`De1RawMessage`).

---

## Models

### Error
```json
{
  "e": "Error message",
  "st": "Stack trace"
}
```

### ScaleSnapshot

```json
{
  "timestamp": "2025-02-01T12:34:56.789Z",
  "weight": 15.2,
  "batteryLevel": 80
}
```

### MachineSnapshot

```json
{
  "timestamp": "2025-02-01T12:34:56.789Z",
  "state": {
    "state": "espresso",
    "substate": "pouring"
  },
  "flow": 2.5,
  "pressure": 9.0,
  "targetFlow": 2.0,
  "targetPressure": 9.0,
  "mixTemperature": 93.5,
  "groupTemperature": 94.0,
  "targetMixTemperature": 93.0,
  "targetGroupTemperature": 94.0,
  "profileFrame": 3,
  "steamTemperature": 135.0
}
```

### MachineState
A string enum with possible values: `idle`, `booting`, `sleeping`, `heating`, `preheating`, `espresso`, `hotWater`, `flush`, `steam`, `skipStep`, `cleaning`, `descaling`, `transportMode`, `needsWater`, `error`.

### MachineSubstate
A string enum with possible values: `idle`, `preparingForShot`, `preinfusion`, `pouring`, `pouringDone`, `cleaningStart`, `cleaingGroup`, `cleanSoaking`, `cleaningSteam`.

### Profile

```json
{
  "version": "1.0",
  "title": "Espresso Shot",
  "notes": "A classic espresso shot profile",
  "author": "John Doe",
  "beverage_type": "espresso",
  "steps": [
    {
      "type": "pressure",
      "value": 9.0,
      "duration": 30
    },
    {
      "type": "flow",
      "value": 2.5,
      "duration": 20
    }
  ],
  "target_volume": 30.0,
  "target_weight": 25.0,
  "target_volume_count_start": 0,
  "tank_temperature": 90.0
}
```

### ShotSettings

```json
{
  "steamSetting": 1,
  "targetSteamTemp": 150,
  "targetSteamDuration": 30,
  "targetHotWaterTemp": 90,
  "targetHotWaterVolume": 250,
  "targetHotWaterDuration": 15,
  "targetShotVolume": 30,
  "groupTemp": 93.0
}
```

### WaterLevels

```json
{
  "currentPercentage": 80,
  "warningThresholdPercentage": 20
}
```

### De1SettingsRequest
```json
{
  "usb": true,
  "fan": 0,
  "flushTemp": 90,
  "flushFlow": 6.0,
  "flushTimeout": 30,
  "hotWaterFlow": 6.0,
  "steamFlow": 1.5,
  "tankTemp": 90
}
```

### De1SettingsResponse
```json
{
  "usb": true,
  "fan": 0,
  "flushTemp": 90,
  "flushFlow": 6.0,
  "flushTimeout": 30,
  "hotWaterFlow": 6.0,
  "steamFlow": 1.5,
  "tankTemp": 90
}
```

### De1AdvancedSettingsRequest
```json
{
  "heaterPh1Flow": 2.5,
  "heaterPh2Flow": 1.5,
  "heaterIdleTemp": 95.0,
  "heaterPh2Timeout": 10
}
```

### De1AdvancedSettingsResponse
```json
{
  "heaterPh1Flow": 2.5,
  "heaterPh2Flow": 1.5,
  "heaterIdleTemp": 95.0,
  "heaterPh2Timeout": 10
}
```

### De1RawMessage
```json
{
  "type": "request",
  "operation": "write",
  "characteristicUUID": "...",
  "payload": "..."
}
```

### De1RawMessageType
A string enum with possible values: `request`, `response`.

### De1RawOperationType
A string enum with possible values: `read`, `write`, `notify`.

### ReaSettingsRequest
```json
{
  "gatewayMode": "full"
}
```

### ReaSettings
```json
{
  "gatewayMode": "full"
}
```

### SensorManifest
```json
{
  "id": "sensor:acme:tempflow:001",
  "name": "Acme Temp+Flow v1",
  "vendor": "Acme",
  "dataChannels": [
    {
      "key": "temperature",
      "type": "number",
      "unit": "°C"
    }
  ],
  "commands": [
    {
      "id": "calibrate",
      "name": "Calibrate sensor",
      "description": "Run auto-calibration routine.",
      "paramsSchema": {
        "type": "object",
        "properties": {
          "mode": {
            "type": "string",
            "enum": ["quick", "full"]
          }
        },
        "required": ["mode"]
      },
      "resultSchema": {
        "type": "object",
        "properties": {
          "success": { "type": "boolean" },
          "message": { "type": "string" }
        }
      }
    }
  ]
}
```

### DataChannel
```json
{
  "key": "temperature",
  "type": "number",
  "unit": "°C"
}
```

### CommandDescriptor
```json
{
  "id": "calibrate",
  "name": "Calibrate sensor",
  "description": "Run auto-calibration routine.",
  "paramsSchema": { "...": "..." },
  "resultSchema": { "...": "..." }
}
```

### SensorSnapshot
```json
{
  "values": {
    "temperature": 25.5
  }
}
```

### WorkflowRequest
```json
{
  "name": "My Workflow",
  "description": "...",
  "profile": { "...": "..." },
  "doseData": { "...": "..." },
  "grinderData": { "...": "..." },
  "coffeeData": { "...": "..." }
}
```

### DoseData
```json
{
  "doseIn": 18.0,
  "doseOut": 36.0
}
```

### GrinderData
```json
{
  "setting": "10",
  "manufacturer": "Comandante",
  "model": "C40"
}
```

### CoffeeData
```json
{
  "name": "Ethiopian Yirgacheffe",
  "roaster": "Local Roaster"
}
```

---

## Error Handling

- The API returns HTTP status code **500** when an internal error occurs.
- Error responses include details in the format:
  ```json
  {
    "e": "Error message",
    "st": "Stack trace"
  }
  ```
- The API returns HTTP status code **400** for bad requests, such as invalid state transitions.
- The API returns HTTP status code **404** for invalid commands or not found resources.
