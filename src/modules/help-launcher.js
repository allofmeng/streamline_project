import { loadStyle } from './vendor-loader.js';
import { setupPressAndHold } from './ui.js';

const HIDE_KEY = 'streamlineHelpHidden';
const LAUNCH_KEY = 'streamlineHelpLaunches';

export function isInWebView() {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isStandalone = window.navigator.standalone === true;
    return (/Android/.test(ua) && /wv/.test(ua))
        || (isIOS && !isStandalone && !/Safari\//.test(ua))
        || ua.includes('Decent')
        || Boolean(window.__DECENT_HOST__);
}

function onHomePage() {
    const host = document.getElementById('subpage-host');
    return !host || host.style.display === 'none' || !host.children.length;
}

export function syncHelpButton() {
    const button = document.getElementById('help-overlay-btn');
    if (!button || !isInWebView() || button.style.display === 'none') return;
    if (!onHomePage()) {
        button.classList.remove('help-btn--webview');
        Object.assign(button.style, { top: '', left: '', right: '', bottom: '', width: '', height: '' });
        return;
    }
    const fullscreen = document.querySelector('#main-page #fullscreen-toggle-btn');
    const rect = fullscreen?.getBoundingClientRect();
    if (!rect?.width) return;
    button.classList.add('help-btn--webview');
    Object.assign(button.style, {
        top: `${rect.top}px`, left: `${rect.left}px`, right: 'auto', bottom: 'auto',
        width: `${rect.width}px`, height: `${rect.height}px`
    });
}

function helpHidden() {
    const preference = localStorage.getItem(HIDE_KEY);
    if (preference !== null) return preference === '1';
    return (parseInt(localStorage.getItem(LAUNCH_KEY), 10) || 0) > 2;
}

export function initHelpLauncher() {
    if (document.getElementById('help-overlay-btn')) return;
    localStorage.setItem(LAUNCH_KEY, String((parseInt(localStorage.getItem(LAUNCH_KEY), 10) || 0) + 1));
    const button = document.createElement('button');
    button.id = 'help-overlay-btn';
    button.type = 'button';
    button.setAttribute('aria-label', 'Show help for this screen');
    button.setAttribute('aria-pressed', 'false');
    button.title = 'Help (long-press to hide)';
    button.textContent = '?';
    if (helpHidden()) button.style.display = 'none';
    document.body.appendChild(button);
    loadStyle('src/css/help-overlay.css').catch(() => {});

    if (isInWebView() && !helpHidden()) {
        document.documentElement.classList.add('help-webview');
        const sync = () => requestAnimationFrame(syncHelpButton);
        sync();
        window.addEventListener('resize', sync);
        document.addEventListener('streamline:scaleupdate', sync);
        const observer = new MutationObserver(sync);
        const host = document.getElementById('subpage-host');
        const main = document.getElementById('main-page');
        if (host) observer.observe(host, { childList: true, attributes: true, attributeFilter: ['style'] });
        if (main) observer.observe(main, { attributes: true, attributeFilter: ['style'] });
    }

    let helpModule = null;
    const activate = async () => {
        try {
            helpModule ||= await import('./helpOverlay.js');
            helpModule.initializeHelpOverlay(button);
            helpModule.toggleHelpOverlay();
        } catch {}
    };
    const setHidden = hidden => {
        localStorage.setItem(HIDE_KEY, hidden ? '1' : '0');
        button.style.display = hidden ? 'none' : '';
        document.documentElement.classList.toggle('help-webview', !hidden && isInWebView());
        if (!hidden) syncHelpButton();
    };
    setupPressAndHold(button, activate, () => setHidden(true));

    window.showHelpButton = () => setHidden(false);
    window.hideHelpButton = () => setHidden(true);
    window.isHelpButtonHidden = helpHidden;
}
