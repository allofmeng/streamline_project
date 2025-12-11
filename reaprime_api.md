# Rea Prime API Documentation v1.0.0

## Overview

This document provides combined documentation for the Rea Prime REST and WebSocket APIs.

- **REST API**: For request-response actions like changing settings or retrieving device lists.
- **WebSocket API**: For receiving real-time data streams from the DE1 machine, scale, and other sensors.

---

## REST API (OpenAPI)

### Base URL

`http://localhost:8080`

### Endpoints

#### **GET /api/v1/devices**

*Get Available Devices*

Retrieves a list of available Bluetooth devices with their connection states.

**Responses:**
- `200 OK`: A JSON array of device objects.
- `500 Internal Server Error`
Example responses body 
[
  {
    "name": "Decent Scale",
    "id": "C812E23B-A946-0B9B-42D9-9196B794B9EF",
    "state": "connected",
    "type": "scale"
  },
  {
    "name": "DE1",
    "id": "D127E7B0-1239-68FB-196E-F0B4B420653D",
    "state": "connected",
    "type": "machine"
  }
]
---

#### **GET /api/v1/devices/scan**

*Scan for Devices*

Triggers a Bluetooth device scan.
      summary: Scan for Devices
      description: Triggers a device scan.
      parameters:
        - name: connect
          description: whether REA should automatically connect to discovered devices while scanning (applies for scales). Default is 'false'
          in: query
          schema:
            type: boolean
        - name: quick
          description: If this flag is set to true, REA will return immediately after calling this function, returning an empty array. Useful if you want to poll for new devices manually
          in: query
          schema:
            type: boolean
      responses:
        "200":
          description: Scan started successfully
        "500":
          description: Internal Server Error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
payload example : 
/api/v1/devices/scan?connect=true&quick=true

---
#### **PUT /api/v1/devices/connect** 
connect to specified device
The id of the device, previously discovered with /api/v1/devices/scan request

example request URL: http://localhost:8080/api/v1/devices/connect?deviceId=D127E7B0-1239-68FB-196E-F0B4B420653D




### DE1 Endpoints

#### **GET /api/v1/de1/state**

*Get DE1 State*

Retrieves the current DE1 machine state.

**Responses:**
- `200 OK`: Returns a `MachineSnapshot` object.

---

#### **PUT /api/v1/de1/state/{newState}**

*Request DE1 State Change*

Requests a state change for the DE1 espresso machine.

**Parameters:**
- `newState` (path, required): The target state. Must be a valid `MachineState` enum.

**Responses:**
- `200 OK`: State change successful.
- `400 Bad Request`

---

#### **POST /api/v1/de1/profile**

*Set DE1 Profile*

Uploads a new brewing profile to the DE1 machine.

**Request Body:**
- `application/json`: A `Profile` object.

**Responses:**
- `200 OK`: Profile updated successfully.

---

#### **POST /api/v1/de1/shotSettings**

*Update Shot Settings*

Updates shot settings on the DE1 espresso machine.

**Request Body:**
- `application/json`: A `ShotSettings` object.
example : 
all field below has to be present. 
example : 
ShotSettings{
steamSetting	integer
targetSteamTemp	integer
targetSteamDuration	integer
targetHotWaterTemp	integer
targetHotWaterVolume	integer
targetHotWaterDuration	integer
targetShotVolume	integer
groupTemp	number
}
**Responses:**
- `200 OK`: Shot settings updated successfully.

---

#### **GET /api/v1/de1/settings**

*Get De1 settings*

Pulls additional settings from the De1.

**Responses:**
- `200 OK`: Returns a `De1SettingsResponse` object.

---

#### **POST /api/v1/de1/settings**

*Set De1 settings*

Set additional settings on the De1, each setting can be set individually.

**Request Body:**
- `application/json`: A `De1SettingsRequest` object.
Example : 
{
  "usb": true,
  "fan": 0,
  "flushTemp": 0,
  "flushFlow": 0,
  "flushTimeout": 0,
  "hotWaterFlow": 0,
  "steamFlow": 0,
  "tankTemp": 0
}
**Responses:**
- `200 OK`: Settings update successful.

---

#### **GET /api/v1/de1/settings/advanced**

*Get advanced De1 settings*

Get additional advanced De1 settings.

**Responses:**
- `200 OK`: Returns a `De1AdvancedSettingsResponse` object.

---

#### **POST /api/v1/de1/settings/advanced**

*Set advanced De1 settings*

Set advanced settings on the De1, each setting can be sent separately.

**Request Body:**
- `application/json`: A `De1AdvancedSettingsRequest` object.

**Responses:**
- `200 OK`: Advanced settings updated successfully.

---

#### **PUT /api/v1/de1/usb/{state}**

*Toggle USB Charger Mode*

Enables or disables the USB charger mode on the DE1 machine.

**Parameters:**
- `state` (path, required): `enable` or `disable`.

**Responses:**
- `200 OK`: USB mode updated successfully.
- `500 Internal Server Error`

---

#### **POST /api/v1/de1/waterLevels**

*Set Water Level Threshold*

Sets the water level warning threshold. Only the `warningThresholdPercentage` field from the request body is used.

**Request Body:**
- `application/json`: A `WaterLevels` object. Example: `{"warningThresholdPercentage": 20}`

**Responses:**
- `202 Accepted`: Levels updated.

---

#### **POST /api/v1/de1/firmware**

*Push new firmware to the De1*

Send a firmware file to De1. The call will wait until the firmware upgrade is complete.

**Request Body:**
- `application/octet-stream`: The firmware file.

**Responses:**
- `200 OK`: Firmware update successful.
- `500 Internal Server Error`

---

### Scale Endpoints

#### **PUT /api/v1/scale/tare**

*Tare Scale*

Tares the connected scale.

**Responses:**
- `200 OK`: Scale tared successfully.
- `404 Not Found`: Scale not found.

---

### Sensor Endpoints

#### **GET /api/v1/sensors**

*Get a list of sensor devices connected to Rea*

Shows all sensors and their IDs that are currently connected.

**Responses:**
- `200 OK`: Returns a list of available sensors, each with `name` and `info` (`SensorManifest`).

---

#### **GET /api/v1/sensors/{id}**

*Get full manifest for a sensor*

**Parameters:**
- `id` (path, required): The ID of the sensor.

**Responses:**
- `200 OK`: Returns a full `SensorManifest`.
- `404 Not Found`: Sensor not found.

---

#### **POST /api/v1/sensors/{id}/execute**

*Execute a sensor command*

**Parameters:**
- `id` (path, required): The ID of the sensor.

**Request Body:**
- `application/json`: An object with `commandId` and optional `params`.

**Responses:**
- `200 OK`: Returns the command result.
- `404 Not Found`: Sensor not found.

---

### Rea Settings & Workflow

#### **GET /api/v1/settings**

*Get Rea settings*

**Responses:**
- `200 OK`: Returns `ReaSettings` object.

---

#### **POST /api/v1/settings**

*Update Rea settings*

**Request Body:**
- `application/json`: A `ReaSettingsRequest` object.

**Responses:**
- `200 OK`: Rea settings updated successfully.

---

#### **GET /api/v1/workflow**

*Get info about current workflow*

**Responses:**
- `200 OK`: Returns the current `WorkflowRequest` object.

---

#### **PUT /api/v1/workflow**

*Set or update current workflow*

You can update only specific fields, like `doseData` or `grinderData`, or `profile` etc.

**Request Body:**
- `application/json`: A `WorkflowRequest` object.

**Example Payload:**
```json
{
  "id": "837d3a26-ba22-4638-8b46-5708a5e75290",
  "name": "Workflow",
  "description": "Description",
  "profile": {
    "version": "2",
    "title": "Rao Allongé  DA Earthworld o.bourbon",
    "notes": "An amazing long espresso for light roasts, this is the biggest fruit bomb of any brewing method we know.  5:1 ratio, 35-40 seconds, coarse espresso grind. If close to the right pressure, make 0.5g dose adjustments to get to an 8-9 bar peak. The very high flow rate means small grind adjustments cause big pressure changes. An advanced technique, allongé averages 24% extraction.",
    "author": "Decent",
    "beverage_type": "espresso",
    "steps": [
      {
        "name": "hold at 4.5 ml/s",
        "pump": "flow",
        "transition": "fast",
        "exit": null,
        "volume": 500,
        "seconds": 60,
        "weight": 0,
        "temperature": 81,
        "sensor": "coffee",
        "flow": 4.5,
        "limiter": {
          "value": 8.6,
          "range": 0.6
        }
      }
    ],
    "target_volume": 0,
    "target_weight": 67,
    "target_volume_count_start": 0,
    "tank_temperature": 0
  },
  "doseData": {
    "doseIn": 18,
    "doseOut": 67
  },
  "coffeeData": null,
  "grinderData": {"setting":"10"}
}
```

**Responses:**
- `200 OK`: Returns the new workflow object.

---

### Key-Value Store

Provides a simple key-value store for clients, organized by namespace.

#### **GET /api/v1/store/{namespace}**

*List Keys in Namespace*

Retrieves a list of all keys within a specified namespace.

**Parameters:**
- `namespace` (path, required): The namespace to query.

**Responses:**
- `200 OK`: An array of key strings.

---

#### **GET /api/v1/store/{namespace}/{key}**

*Get Value by Key*

Retrieves the JSON value for a given key in a namespace.

**Parameters:**
- `namespace` (path, required): The namespace.
- `key` (path, required): The key.

**Responses:**
- `200 OK`: The JSON value.
- `404 Not Found`: Key not found.

---

#### **POST /api/v1/store/{namespace}/{key}**

*Set Key-Value Pair*

Sets or updates a key with a JSON value within a namespace.

**Parameters:**
- `namespace` (path, required): The namespace.
- `key` (path, required): The key.

**Request Body:**
- `application/json`: Any valid JSON object.

**Responses:**
- `204 No Content`: Successfully stored.

---

#### **DELETE /api/v1/store/{namespace}/{key}**

*Delete Key*

Deletes a key-value pair from a namespace.

**Parameters:**
- `namespace` (path, required): The namespace.
- `key` (path, required): The key to delete.

**Responses:**
- `200 OK`: Key deleted.
- `404 Not Found`: Key not found.

---

#### **GET /api/v1/shots**

*Get a list of shots stored by REA*

Retrieves a list of shots. Can be filtered by a list of shot IDs.

**Query Parameters:**
- `ids` (optional): A comma-separated list of shot identifiers to retrieve.

**Example:**
`http://localhost:8080/api/v1/shots?ids=2025-09-17T11%3A48%3A55.863366`

**Responses:**
- `200 OK`: Returns an array of `ShotRecord` objects.

---


#### **GET /api/v1/shots/ids**

*Get a list of identifiers of all the shots stored by REA*

**Responses:**
- `200 OK`: Returns an array of shot ID strings.

---

## WebSocket API (AsyncAPI)

### Base URL

`ws://localhost:8080`

### Channels

#### **ws/v1/de1/snapshot**

*De1Snapshot Channel*

Real-time snapshot data from the DE1 machine.

**Messages Received:**
- `MachineSnapshot`: Contains the current state, pressure, flow, temperatures, etc.
see exmaple below 
{
timestamp	string($date-time)
state	{
state	MachineStateMachineStatestring
example: espresso
Enum:
[ booting, busy, idle, sleeping, heating, preheating, espresso, hotWater, flush, steam, steamRinse, skipStep, cleaning, descaling, calibration, selfTest, airPurge, needsWater, error, fwUpgrade ]
substate	MachineSubstate string
example: preparingForShot
Enum:
[ idle, preparingForShot, preinfusion, pouring, pouringDone, cleaningStart, cleaingGroup, cleanSoaking, cleaningSteam, errorNaN, errorInf, errorGeneric, errorAcc, errorTSensor, errorPSensor, errorWLevel, errorDip, errorAssertion, errorUnsafe, errorInvalidParam, errorFlash, errorOOM, errorDeadline, errorHiCurrent, errorLoCurrent, errorBootFill, errorNoAC ]
}
flow	number
pressure	number
example: 6.2
targetFlow	number
targetPressure	number
mixTemperature	number
groupTemperature	number
targetMixTemperature	number
targetGroupTemperature	number
profileFrame	integer
steamTemperature	number
}
---

#### **ws/v1/de1/shotSettings**

*ShotSettings Channel*

Real-time shot settings updates.

**Messages Received:**
- `ShotSettings`: Contains target temperatures, volumes, etc.

---

#### **ws/v1/de1/waterLevels**

*WaterLevels Channel*

Real-time water level updates.

**Messages Received:**
- `WaterLevels`: Contains the current water percentage.

---

#### **ws/v1/scale/snapshot**

*ScaleSnapshot Channel*

Real-time scale weight and battery data.

**Messages Received:**
- `ScaleSnapshot`: Contains weight and battery level.

---

#### **ws/v1/de1/raw**

*De1Raw Channel*

Real-time raw BLE data from DE1 (read/write/notify).

**Messages Received:**
- `De1RawMessage`: Contains the raw BLE message data.

---

#### **ws/v1/sensors/{id}/snapshot**

*SensorSnapshot Channel*

Real-time sensor snapshot updates for a specific sensor.

**Parameters:**
- `id` (path, required): Unique sensor identifier.

**Messages Received:**
- `SensorSnapshot`: Contains a timestamp, sensor ID, and a `values` object.

---

## Models (Schemas)

This section defines the structure of the data objects used in the REST and WebSocket APIs.

<details>
<summary>Click to expand Models</summary>

### `MachineSnapshot`
```json
{
  "timestamp": "string (date-time)",
  "state": {
    "state": "string (MachineState enum)",
    "substate": "string (MachineSubstate enum)"
  },
  "flow": "number",
  "pressure": "number",
  "targetFlow": "number",
  "targetPressure": "number",
  "mixTemperature": "number",
  "groupTemperature": "number",
  "targetMixTemperature": "number",
  "targetGroupTemperature": "number",
  "profileFrame": "integer",
  "steamTemperature": "number"
}
```

### `Profile`
```json
{
  "version": "string",
  "title": "string",
  "notes": "string",
  "author": "string",
  "beverage_type": "string",
  "steps": "array",
  "target_volume": "number",
  "target_weight": "number",
  "target_volume_count_start": "integer",
  "tank_temperature": "number"
}
```

### `DoseData`
```json
{
  "doseIn": "number",
  "doseOut": "number"
}
```

### `GrinderData`
```json
{
  "setting": "string",
  "manufacturer": "string",
  "model": "string"
}
```

### `CoffeeData`
```json
{
  "name": "string",
  "roaster": "string"
}
```

### `WorkflowRequest`
```json
{
  "name": "string",
  "description": "string",
  "profile": "Profile object",
  "doseData": "DoseData object",
  "grinderData": "GrinderData object",
  "coffeeData": "CoffeeData object"
}
```

### `ShotRecord`
```json
{
    "id": "string",
    "timestamp": "string",
    "measurements": [
        "ShotSnapshot object"
    ],
    "workflow": "WorkflowRequest object"
}
```

... and other models such as `ScaleSnapshot`, `ShotSettings`, `WaterLevels`, `De1SettingsRequest`, `SensorManifest`, etc.

</details>