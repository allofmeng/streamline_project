# Calibration endpoints: audit against Decaid

Audit of every calibration path this skin drives, checked against Decaid's
route table (`lib/src/services/webserver/de1handler.dart`) and
`assets/api/rest_v1.yml`, plus the de1app features that have no counterpart
here yet.

## 1. Load-cell wizard pointed at a route that does not exist (fixed)

`calibrateScale()` posted to `POST /api/v1/machine/scale/calibrate`. Decaid
has never served that path — not on `main`, not anywhere in its history — so
every step of the Bengle load-cell wizard 404'd. The real endpoint differs in
method, command set, body key, and response shape:

| was sent / expected | Decaid |
| --- | --- |
| `POST /api/v1/machine/scale/calibrate` | `PUT /api/v1/machine/scaleCalibration` |
| `command: 'zero' \| 'left' \| 'right' \| 'abort'` | `'zero' \| 'latch' \| 'abort'` — one `latch`, run once per cell |
| `grams` | `weightGrams` (1–10000, required only for `latch`) |
| `200 {success, finalStep, pointStatus, message}` | `202 {status: 'accepted', state}` / `409 {status: 'rejected', reason, state}` |
| abort → 202 with no body | abort → 202 with the new state |
| call blocks for the ~15 s step | call returns as soon as the command is staged |

`success` is not a field Decaid ever returns, so the wizard could not have
read a result even with the path corrected. The last row matters most: the
PUT only stages the command, so completion has to come from polling
`GET /api/v1/machine/scaleCalibration`, which decodes the firmware's packed
state register into `{step, detectedCell, subState, secondsRemaining, status}`.

**Fix in this PR:** `calibrateScale()` PUTs the correct body, treats 409 as a
rejection with its reason, and (for `zero`/`latch`) polls the state endpoint
every 500 ms until the step leaves `zeroing`/`calLatch`/`taring`, returning
`{success, message, state}` — the same promise shape the wizard already
awaits, so `settings.js` only had to stop sending `left`/`right`.
`classifyCalState()` in `loadcell-cal.js` maps a state to keep-polling /
done / failed and turns firmware status codes (`noZero`, `notSettled`,
`badWeight`, `badDelta`, `illConditioned`, `outOfRange`, `notIsolated`) into
messages a user can act on. `incomplete` is treated as success: it is what
the firmware reports after the first latch of the ordered pair.

Abort is tracked with a client-side flag rather than inferred from the state,
because an aborted step drops back to `idle` — indistinguishable from a clean
finish.

## 2. DE1 sensor calibration is not wired up at all

de1app's calibration page adjusts three sensors — temperature, pressure and
flow (`de1plus/binary.tcl:calibrate_spec`,
`de1_comms.tcl:de1_send_calibration`). Decaid exposes all three:

```
GET /api/v1/machine/calibration/{flow|pressure|temperature}?source=current|factory
PUT /api/v1/machine/calibration/{flow|pressure|temperature}
    {"de1ReportedValue": <number>, "measuredValue": <number>}
```

Nothing in this skin calls them. The Calibration menu (`settings.js`,
`settingsTree.calibration`) covers default load, refill kit, voltage, fan,
steam and load cells only.

Worth knowing before building the UI: **a write is a correction, not a set.**
Flow and pressure multiply the stored calibration by
`measuredValue / de1ReportedValue`; temperature adds
`measuredValue - de1ReportedValue`. To set an absolute value X, read the
current value C first, then write `{de1ReportedValue: C, measuredValue: X}`.
Reads answer with the calibration in `measuredValue` (`de1ReportedValue` is
1.0 for flow/pressure, 0.0 for temperature). `?source=factory` reads the
factory values, which gives a natural "reset to factory" affordance.
`PUT` answers 202 only after the machine acknowledges, 504 if it does not.

## 3. The machine's flow multiplier is not wired up either

The "Flow Multiplier" page under Quick Adjustments edits
`weightFlowMultiplier` and `volumeFlowMultiplier` through
`POST /api/v1/settings`. Those are app-side skin settings and the calls are
correct — but they are not de1app's `calibration_flow_multiplier`, which is a
value stored on the machine (the `calFlowEst` MMR). Decaid serves that one
separately:

```
GET  /api/v1/machine/calibration          -> {"flowMultiplier": 1.0}
POST /api/v1/machine/calibration          {"flowMultiplier": 1.05}
```

Two different knobs share one label in the UI today. If the machine-side one
is added, both need names that say which is which.

## 4. Everything else checks out

- `getReaSettings` / `setReaSettings` → `GET|POST /api/v1/settings`
- `getDe1Settings` / `setDe1Settings` → `GET|POST /api/v1/machine/settings`
  (`fan`, `usb`, `flushTemp`, `flushFlow`, `tankTemp`, `steamPurgeMode`)
- `setDe1AdvancedSettings` → `POST /api/v1/machine/settings/advanced`
  (`heaterIdleTemp`, `heaterVoltage`, `refillKitSetting`)
- `resetDe1Settings` → `DELETE /api/v1/machine/settings/reset`
- `tareScale` → `PUT /api/v1/scale/tare`

The basic/advanced split matches which handler actually parses each key.
