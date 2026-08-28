import { currentMachineState, MachineState, setMachineState } from '../../modules/api.js';
import { getTranslation, translatePage } from '../../modules/i18n.js';
import { logger } from '../../modules/logger.js';
import * as ui from '../../modules/ui.js';

function descaling() {
    return `
        <div class="flex flex-col gap-[60px] items-start w-full">
            <h2 class="font-semibold text-[var(--text-primary)] text-[36px] text-center w-full" data-i18n-key="Machine Descaling">Machine Descaling</h2>
            <hr class="border-t border-[#c9c9c9] w-full">
            <div class="flex flex-col gap-[30px] w-full">
                <div class="flex items-center justify-between w-full">
                    <p class="font-bold text-[#385a92] text-[30px]" data-i18n-key="Machine Descaling">Machine Descaling</p>
                    <button type="button" data-action="descale" class="bg-[#385a92] h-[72px] px-[48px] rounded-[72px] text-white text-[24px] font-bold" data-i18n-key="Start">Start</button>
                </div>
                <p class="text-[var(--text-primary)] text-[24px]" data-i18n-key="Run a descaling cycle to remove mineral buildup">Run a descaling cycle to remove mineral buildup</p>
                <a href="https://app.basecamp.com/3671212/buckets/7351439/documents/7743429669" class="font-semibold text-[#385a92] underline text-[24px]" data-i18n-key="Descaling Instruction">Descaling Instruction</a>
            </div>
        </div>`;
}

function airPurge() {
    return `
        <div class="flex flex-col gap-[60px] items-start w-full">
            <h2 class="font-semibold text-[var(--text-primary)] text-[36px] text-center w-full" data-i18n-key="Transport Mode">Transport Mode</h2>
            <hr class="border-t border-[#c9c9c9] w-full">
            <div class="flex flex-col gap-[30px] w-full">
                <div class="flex items-center justify-between w-full">
                    <p class="font-bold text-[#385a92] text-[30px]" data-i18n-key="Transport Mode">Transport Mode</p>
                    <button type="button" data-action="air-purge" class="bg-[#385a92] h-[72px] px-[48px] rounded-[72px] text-white text-[24px] font-bold" data-i18n-key="Start">Start</button>
                </div>
                <p class="text-[var(--text-primary)] text-[24px] pr-[220px]" data-i18n-key="Purges remaining water from inside the machine. Run before packing the machine to prevent leaks during transport.">Purges remaining water from inside the machine. Run before packing the machine to prevent leaks during transport.</p>
            </div>
            <dialog data-air-purge-confirm class="modal">
                <div class="modal-box bg-[var(--box-color)] max-w-2xl">
                    <h3 class="font-bold text-[28px] text-[var(--text-primary)] mb-2" data-i18n-key="Transport Mode">Transport Mode</h3>
                    <p class="text-[20px] text-[var(--text-primary)] opacity-80 mb-4" data-i18n-key="Prepare your espresso machine for transport">Prepare your espresso machine for transport</p>
                    <div class="modal-action">
                        <button type="button" data-action="cancel" class="border-[var(--mimoja-blue)] text-[var(--mimoja-blue)] h-[62px] rounded-[67.5px] border px-[32px] text-[24px] font-bold" data-i18n-key="Cancel">Cancel</button>
                        <button type="button" data-action="confirm-air-purge" class="bg-[#385a92] h-[62px] px-[32px] rounded-[67.5px] text-white text-[24px] font-bold" data-i18n-key="Start">Start</button>
                    </div>
                </div>
            </dialog>
        </div>`;
}

export async function mountSettingsCategory({ container, category }) {
    let timer = 0;
    let active = true;
    container.innerHTML = category === 'maint_airpurge' ? airPurge() : descaling();
    translatePage();

    const onClick = async event => {
        const action = event.target.closest('[data-action]')?.dataset.action;
        if (!action) return;
        if (action === 'cancel') return container.querySelector('[data-air-purge-confirm]')?.close();
        if (action === 'air-purge') {
            if (currentMachineState === MachineState.NEEDS_WATER) {
                ui.showToast(`${getTranslation('Out of water')} - ${getTranslation('Press the stop button on the group head to override, then tap Start again.')}`, 6000, 'error');
                return;
            }
            container.querySelector('[data-air-purge-confirm]')?.showModal();
            return;
        }
        if (action !== 'descale' && action !== 'confirm-air-purge') return;
        if (action === 'descale' && !window.confirm('Start descaling cycle? The machine will run the descaling program. Make sure the descaling solution is prepared.')) return;
        try {
            await setMachineState(action === 'descale' ? 'descaling' : 'airPurge');
            if (!active) return;
            if (action === 'descale') {
                ui.showToast('Descaling cycle started', 3000, 'success');
                return;
            }
            container.querySelector('[data-air-purge-confirm]')?.close();
            ui.showToast(getTranslation('Now removing water from your espresso machine.'), 0, 'info');
            let entered = false;
            const startedAt = Date.now();
            timer = setInterval(() => {
                if (currentMachineState === MachineState.AIR_PURGE) entered = true;
                if (entered && currentMachineState !== MachineState.AIR_PURGE) {
                    clearInterval(timer);
                    timer = 0;
                    ui.showToast(getTranslation('You can turn your machine off once it is out of water. It will then be ready for transport.'), 8000, 'success');
                } else if (Date.now() - startedAt > 300000) {
                    clearInterval(timer);
                    timer = 0;
                    ui.hideToast();
                }
            }, 1000);
        } catch (error) {
            logger.error('Maintenance command failed:', error);
            ui.showToast(`Failed to start: ${error.message}`, 5000, 'error');
        }
    };

    container.addEventListener('click', onClick);
    return () => {
        active = false;
        container.removeEventListener('click', onClick);
        if (timer) clearInterval(timer);
    };
}
