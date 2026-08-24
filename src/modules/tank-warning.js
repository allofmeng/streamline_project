// When the dashboard is allowed to say "Out of water".
//
// The level-vs-threshold warning is the skin's own, separate from the DE1's
// `needsWater` machine state: that one is a hard block the firmware only raises
// once it actually tries to heat or pump, while a tablet watching the level can
// warn while the machine is still idle.
//
// It used to be applied unconditionally, which broke two ways (issue #60):
//   - it REPLACED the machine status, so mid-steam the status string stopped
//     saying "steam" and ui.updateMachineStatus tore down the steam elapsed
//     timer; when steam reappeared the counter restarted at 0 and could never
//     reach the set duration on screen.
//   - a plumbed machine's auto-refill holds the tank right around the refill
//     line, so the warning flickered on and off with every millimetre of slosh.
//
// DOM-free on purpose so node:test can import it (see test/README.md).

// How far the level must climb back above the refill line before the warning
// clears. One-directional threshold checks chatter when the level sits on it.
export const REFILL_HYSTERESIS_MM = 2;

// Latching threshold check: trip at or below the refill line, release only once
// the level is back above it by REFILL_HYSTERESIS_MM. `warning` is the previous
// answer. An unknown level or threshold means no warning.
export function nextTankWarning(warning, levelMm, refillLevelMm) {
    if (levelMm == null || refillLevelMm == null) return false;
    if (warning) return levelMm < refillLevelMm + REFILL_HYSTERESIS_MM;
    return levelMm <= refillLevelMm;
}

// States where the machine is mid-operation (or otherwise has nothing to do
// with a tank reading) and the status text belongs to that state. Overwriting
// it here is what killed the steam timer.
//
// The first row is websocket_v1.yml's MachineState enum, which is what the
// snapshot frames carry; the second is the extra names api.js MachineState
// carries for REST-sourced states. Unmatched entries simply never fire.
const BUSY_STATES = new Set([
    'espresso', 'steam', 'hotWater', 'flush', 'skipStep', 'cleaning', 'descaling', 'transportMode',
    'steamRinse', 'calibration', 'selfTest', 'airPurge', 'fwUpgrade',
]);

// A machine that refills itself from plumbing holds the tank around the refill
// line by design, so a level reading there is normal operation, not something
// to warn about -- only the DE1's own needsWater state is then worth showing.
//
// Both inputs come from the same DE1 MMR register (see machine.js): today
// refillKitPresent === true is exactly refillKitSetting === 1, and a read of
// 0/1 is the firmware's own detection result rather than a user preference.
// They are taken separately anyway so this rule still reads correctly if decaid
// ever splits presence from configuration.
//   refillKitPresent   GET /machine/info -> extra.refillKit; null until fetched
//   refillKitSetting   De1AdvancedSettings: 0 = off, 1 = on, 2 = auto
//
// A register reading 0 means no kit, so force off wins over presence: nothing
// is refilling that tank and it really can run dry. Otherwise a present kit
// suppresses the level warning. Unknowns never suppress.
export function shouldShowTankWarning({ state, tankLow, refillKitPresent, refillKitSetting }) {
    if (!tankLow) return false;
    if (state === 'needsWater') return false; // already the real machine state
    if (refillKitSetting !== 0 && (refillKitPresent === true || refillKitSetting === 1)) return false;
    return !BUSY_STATES.has(state);
}
