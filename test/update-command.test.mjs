import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const apiSource = readFileSync(new URL('../src/modules/api.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const apiStart = apiSource.indexOf('export function connectUpdateWebSocket');
const apiEnd = apiSource.indexOf('\n\n', apiSource.indexOf('\n}', apiSource.indexOf('export function sendUpdateCommand', apiStart)) + 2);
assert.notEqual(apiStart, -1);
assert.notEqual(apiEnd, -1);
const apiFunctions = apiSource.slice(apiStart, apiEnd).replaceAll('export ', '');

const loadApi = (socket) => new Function(
    'ReconnectingWebSocket',
    'WebSocket',
    'WS_PROTOCOL',
    'reaHostname',
    'REA_PORT',
    'logger',
    `let updateWebSocket = null;
    let updateWebSocketReady = false;
    ${apiFunctions}
    return { connectUpdateWebSocket, sendUpdateCommand };`,
)(
    function ReconnectingWebSocket() { return socket; },
    { OPEN: 1 },
    'ws:',
    'decaid',
    8080,
    { error() {}, info() {}, warn() {} },
);

test('the automatic update check waits for the socket to open', () => {
    let readyState = 0;
    let payload;
    const socket = {
        get readyState() { return readyState; },
        send(value) { payload = value; },
    };
    const { connectUpdateWebSocket, sendUpdateCommand } = loadApi(socket);
    const command = { command: 'check' };

    connectUpdateWebSocket(() => {}, () => sendUpdateCommand(command));
    assert.equal(payload, undefined);

    readyState = 1;
    socket.onopen();
    assert.equal(payload, JSON.stringify(command));
});

test('update commands reject an unavailable socket', () => {
    const api = loadApi({ readyState: 0 });
    api.connectUpdateWebSocket(() => {});
    assert.throws(
        () => api.sendUpdateCommand({ command: 'install' }),
        /Update WebSocket is not connected/,
    );
});

const settingsSource = readFileSync(new URL('../src/settings/settings.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Start at the watchdog constant, not at the function: initAppUpdateSection()
// closes over it and over appUpdateCheckTimer.
const settingsStart = settingsSource.indexOf("// How long a 'check' has to produce any frame");
const settingsEnd = settingsSource.indexOf('\n\n// Render updates settings', settingsStart);
assert.notEqual(settingsStart, -1);
assert.notEqual(settingsEnd, -1);
const initSource = settingsSource.slice(settingsStart, settingsEnd);

const loadInit = () => {
    const settingsCache = { appUpdateChecked: false, appUpdateState: null };
    const commands = [];
    const toasts = [];
    const window = {};
    const state = { failSend: false, onData: null, onOpen: null };
    const connectUpdateWebSocket = (dataHandler, openHandler) => {
        state.onData = dataHandler;
        state.onOpen = openHandler;
    };
    const sendUpdateCommand = (command) => {
        if (state.failSend) throw new Error('Update WebSocket is not connected');
        commands.push(command);
    };
    new Function(
        'window', 'settingsCache', 'sendUpdateCommand', 'connectUpdateWebSocket',
        'ui', 'document', 'renderAppUpdateBlock', 'getTranslation',
        `${initSource}\ninitAppUpdateSection();`,
    )(
        window, settingsCache, sendUpdateCommand, connectUpdateWebSocket,
        { showToast: (...args) => toasts.push(args) },
        { getElementById: () => null },
        () => '',
        (key) => key,
    );
    return { settingsCache, commands, toasts, window, state };
};

// Decaid emits 'checking' at the top of UpdateCheckService.checkForUpdate(), on
// every path that gets past the macOS guard -- so that frame, not the outgoing
// command, is what proves a check ran.
test('a check counts only once Decaid reports it started one', () => {
    const { settingsCache, commands, state } = loadInit();

    assert.deepEqual(commands, []);
    assert.equal(settingsCache.appUpdateChecked, false);

    state.onOpen();
    assert.deepEqual(commands, [{ command: 'check' }]);
    // The command is out, but nothing has come back yet.
    assert.equal(settingsCache.appUpdateChecked, false);

    state.onData({ phase: 'checking' });
    assert.equal(settingsCache.appUpdateChecked, true);

    state.onData({ phase: 'available' });
    assert.equal(settingsCache.appUpdateChecked, true);
    assert.deepEqual(settingsCache.appUpdateState, { phase: 'available' });
});

// macOS returns at `if (_isMacOS)` before emitting anything, so the command is
// answered with silence. Claiming a check ran on that is what put a green
// "Up to date" over a stale version.
test('silence from Decaid never counts as a completed check', () => {
    const { settingsCache, window, state } = loadInit();
    state.onOpen();
    window.checkAppUpdate();
    assert.equal(settingsCache.appUpdateChecked, false);
    // Let the watchdog say so rather than leaving a dead button.
    state.onData({ phase: 'idle' });
});

test('a send that never left claims nothing and reports the error', () => {
    const { settingsCache, toasts, window, state } = loadInit();
    state.failSend = true;

    window.checkAppUpdate();
    assert.equal(settingsCache.appUpdateChecked, false);
    assert.deepEqual(toasts, [['Update WebSocket is not connected', 5000, 'error']]);

    toasts.length = 0;
    window.installAppUpdate();
    assert.deepEqual(toasts, [['Update WebSocket is not connected', 5000, 'error']]);
});

// ─── "Up to date" badge ──────────────────────────────────────────────────────
// The pill claims a check ran and came back clean, so it must not appear until
// decaid says it actually ran one. It used to be armed by the outgoing 'check'
// command, which is not evidence: on macOS UpdateCheckService.checkForUpdate()
// returns at its `if (_isMacOS)` guard before emitting anything (Sparkle owns
// app updates there), so nothing ever comes back and the panel still showed a
// green "Up to date" over a stale version, with its own Check button hidden.

const blockStart = settingsSource.indexOf('function renderAppUpdateBlock(state) {');
assert.notEqual(blockStart, -1, 'renderAppUpdateBlock not found in settings.js');
const blockEnd = settingsSource.indexOf('\n}', blockStart) + 2;
const renderBlockSource = settingsSource.slice(blockStart, blockEnd);

const renderAppUpdateBlock = (state, { appUpdateChecked = false } = {}) => new Function(
    'settingsCache',
    'getTranslation',
    `${renderBlockSource}\n    return renderAppUpdateBlock;`,
)({ appUpdateChecked }, (key) => key)(state);

const idle = { phase: 'idle', currentVersion: '0.8.3', latestVersion: null };

test('no "Up to date" pill until decaid reports it ran a check', () => {
    const html = renderAppUpdateBlock(idle, { appUpdateChecked: false });
    assert.ok(!html.includes('Up to date'));
    // ...and the way to run one stays on screen.
    assert.ok(html.includes('window.checkAppUpdate()'));
});

test('"Up to date" pill once a check has been reported', () => {
    const html = renderAppUpdateBlock(idle, { appUpdateChecked: true });
    assert.ok(html.includes('Up to date'));
});

test('an available update is reported whether or not a check was seen', () => {
    const html = renderAppUpdateBlock(
        { phase: 'available', currentVersion: '0.8.3', latestVersion: '0.8.4' },
        { appUpdateChecked: false },
    );
    assert.ok(html.includes('Update available'));
    assert.ok(!html.includes('Up to date'));
});

test('the checked flag is armed by the checking frame, not by sending the command', () => {
    const initStart = settingsSource.indexOf('function initAppUpdateSection() {');
    assert.notEqual(initStart, -1);
    const init = settingsSource.slice(initStart, settingsSource.indexOf('\n}', initStart));
    assert.match(init, /phase === 'checking'\) settingsCache\.appUpdateChecked = true/);
    // The old bug: armed inside send(), off the command name.
    assert.ok(!/command === 'check'\) settingsCache\.appUpdateChecked = true/.test(init));
});
