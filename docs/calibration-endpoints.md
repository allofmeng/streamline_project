# Calibration endpoints

What this skin drives against Decaid's calibration routes
(`lib/src/services/webserver/de1handler.dart`, repo-local `rest_v1.yml`),
and the one knob still left on the shelf.

## 1. Load-cell wizard — `GET|PUT /api/v1/machine/scaleCalibration`

Bengle only. `calibrateScale()` in `src/modules/api.js` PUTs
`zero` / `latch` / `abort`, then polls the state register until the step
leaves `zeroing`/`calLatch`/`taring`; `classifyCalState()` in
`src/modules/loadcell-cal.js` turns a state into keep-polling / done /
failed. Note that `status` is the result of the last **latch**, not of the
step just run — it survives a zero, so it is only read back on a latch.

## 2. DE1 sensor calibration — `GET|PUT /api/v1/machine/calibration/{target}`

de1app's temperature / pressure / flow calibration page
(`de1plus/binary.tcl:calibrate_spec`, `de1_comms.tcl:de1_send_calibration`).
Lives under Calibration → Sensor Calibration
(`renderSensorCalSettings()` in `src/settings/settings.js`, arithmetic in
`src/modules/sensor-cal.js`).

The page is de1app's calibration table: one row per sensor, **Saved** and
**Factory** readable at a glance, a **Goal** the machine supplies, and one
number for the user to type. de1app takes that goal from the static espresso
setpoint (`::settings(espresso_temperature)`, `espresso_pressure` at
`de1_skin_settings.tcl:2279`); a profile-driven skin has no such single
value, so the goal is the machine's live per-step target from the snapshot
socket (`targetGroupTemperature`, `targetPressure`, `targetFlow`), repainted
at 1 Hz and frozen for that row the moment a measurement is typed — so the
pair written is the pair that was on screen.

The socket is opened by `ensureMachineSnapshotSocket()` when nothing else
has: booting straight onto a sub-page (a reload while in Settings) skips
`initMainPageOnce()`, which is the only other thing that opens it — without
that call the goal column reads `—` forever.

Note that an idle machine still holds `targetGroupTemperature` (the brew
target), while `targetPressure` and `targetFlow` read 0. Temperature can
therefore be calibrated off a flush, while pressure and flow need the
machine actually running — which is what `correctionBlocked()` enforces.

de1app drives flow through the machine's `calFlowEst` multiplier rather than
the A012 flow calibration (its flow entry field is commented out at
`:2287`); this page exposes the real per-sensor flow calibration instead.

What has to stay true of any change here:

- **A write is a correction, not a set.** Flow and pressure multiply the
  stored calibration by `measuredValue / de1ReportedValue`; temperature adds
  `measuredValue - de1ReportedValue`. The page therefore previews the result
  before writing and clears both inputs after a successful one — the two
  numbers are a single observation, and re-sending them corrects twice.
- To land on an absolute value X, read the current value C and write
  `{de1ReportedValue: C, measuredValue: X}`. That is exactly what
  "Reset to factory" does with the `?source=factory` read, and repeating it
  is a no-op — which is why that button is safe to press twice and Apply is
  not.
- Reads answer with the calibration in `measuredValue`; `de1ReportedValue`
  is 1.0 for flow/pressure and 0.0 for temperature.
- Both values are clamped to the signed **Q16.16 range,
  -32768..32767.9999**; outside it the PUT is a 400
  (`de1handler.dart:549-559`), so `parseSensorCalInput()` stops it at the
  input box.
- The PUT answers 202 only after the machine acknowledges, 504 if it does
  not. That ack is the BLE write ack, not an A012 notification
  (`unified_de1.dart:486-493`), so the page re-reads rather than painting
  its own preview as fact.
- Temperature is entered in the display unit and converted with
  `fromDisplayTemp()`; the stored **offset** is always shown in °C, because
  an offset converts by scale and not by the absolute °C↔°F conversion.
- A ratio correction divides by `de1ReportedValue` and scales the stored
  calibration by `measuredValue`, so `correctionBlocked()` refuses a zero on
  either side for flow and pressure, and a zero goal for every target — an
  idle machine targets nothing, and correcting against that is either a
  division by zero or the whole reading shoved into the offset.

## 3. The machine's flow multiplier is still not wired up

```
GET  /api/v1/machine/calibration          -> {"flowMultiplier": 1.0}
POST /api/v1/machine/calibration          {"flowMultiplier": 1.05}
```

This is de1app's `calibration_flow_multiplier`, stored on the machine (the
`calFlowEst` MMR; `de1app/de1plus/bluetooth.tcl:2096-2102`). Nothing here
calls it — de1app manages the value itself, so a second UI for it mostly
invites the two to fight.

The Quick Adjustments page that used to be called "Flow Multiplier" is now
**Flow Estimation**, because it edits `weightFlowMultiplier` /
`volumeFlowMultiplier` through `POST /api/v1/settings` — app-side settings in
Decaid's `settings_service.dart`, a different knob that was wearing the same
name.

Caveat for whoever does wire the machine-side one: that POST answers 202 for
**any** JSON object and ignores keys it does not recognise
(`de1handler.dart:481-489`). A misspelled key is a silent no-op with a
success code — read the value back to confirm a write landed.

## 4. Everything else checks out

- `getReaSettings` / `setReaSettings` → `GET|POST /api/v1/settings`
- `getDe1Settings` / `setDe1Settings` → `GET|POST /api/v1/machine/settings`
  (`fan`, `usb`, `flushTemp`, `flushFlow`, `tankTemp`, `steamPurgeMode`)
- `setDe1AdvancedSettings` → `POST /api/v1/machine/settings/advanced`
  (`heaterIdleTemp`, `heaterVoltage`, `refillKitSetting`)
- `resetDe1Settings` → `DELETE /api/v1/machine/settings/reset`
- `tareScale` → `PUT /api/v1/scale/tare`

The basic/advanced split matches which handler actually parses each key.
