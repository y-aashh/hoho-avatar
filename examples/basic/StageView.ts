import { MouthState, MOUTH_STATES } from '../../src';
import type { ReactionName, Avatar } from '../../src';
import { element } from './studioDom';

const hints: Record<MouthState, string> = {
  [MouthState.Closed]: 'waiting for signal',
  [MouthState.Small]: 'soft articulation',
  [MouthState.Large]: 'high energy',
  [MouthState.Wide]: 'bright frequencies',
  [MouthState.Round]: 'low vowel shape',
};
const mouthLabels: Record<MouthState, string> = {
  [MouthState.Closed]: 'Rest',
  [MouthState.Small]: 'Small',
  [MouthState.Large]: 'Open',
  [MouthState.Wide]: 'Wide',
  [MouthState.Round]: 'Round',
};

/** Expressions, telemetry and viewport presentation for the current avatar. */
export class StageView {
  private readonly wrap = element('.stage-wrap');
  private readonly mouthState = element('#mouthState');
  private readonly stateHint = element('#stateHint');
  private readonly dbValue = element('#dbValue');
  private readonly bars = element('#bars');
  private readonly tools = element('#modelTools');
  private readonly viewHint = element('#viewHint');
  private readonly resetView = element<HTMLButtonElement>('#resetView');
  private readonly blink = element<HTMLButtonElement>('#blinkPreview');
  private readonly events = new AbortController();
  private readonly barElements = Array.from({ length: 32 }, () => {
    const bar = document.createElement('i');
    this.bars.append(bar);
    return bar;
  });
  private readonly mouthButtons = MOUTH_STATES.map((state) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.mouth = state;
    button.textContent = mouthLabels[state];
    button.setAttribute('aria-pressed', 'false');
    this.blink.before(button);
    return { state, button };
  });
  private avatar?: Avatar;
  private selectedMouth?: MouthState;
  private blinkTimer?: ReturnType<typeof setTimeout>;
  private unsubscribe?: () => void;

  constructor() {
    const duration = element<HTMLInputElement>('#reactionDuration');
    const intensity = element<HTMLInputElement>('#reactionIntensity');
    const idle = element<HTMLInputElement>('#idleSway');
    const reactionEvents = { signal: this.events.signal };
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-reaction]')) {
      button.addEventListener('click', () => {
        if (!duration.reportValidity() || !intensity.reportValidity()) return;
        this.avatar?.triggerReaction(button.dataset.reaction as ReactionName, {
          duration: duration.value ? Number(duration.value) : undefined, intensity: Number(intensity.value),
        });
      }, reactionEvents);
    }
    element('#resetReaction').addEventListener('click', () => this.avatar?.resetReaction(), reactionEvents);
    idle.addEventListener('change', () => this.avatar?.setIdleMotion(idle.checked), reactionEvents);
    const options = { signal: this.events.signal };
    const updateViewport = () => document.documentElement.style.setProperty(
      '--studio-viewport-height', `${window.visualViewport?.height ?? window.innerHeight}px`,
    );
    updateViewport();
    window.visualViewport?.addEventListener('resize', updateViewport, options);
    window.addEventListener('resize', updateViewport, options);
    this.resetView.addEventListener('click', () => this.avatar?.resetView(), options);
    for (const { state, button } of this.mouthButtons) {
      button.addEventListener('click', () => {
        this.selectedMouth = this.selectedMouth === state ? undefined : state;
        this.avatar?.previewMouth(this.selectedMouth);
        for (const item of this.mouthButtons) {
          item.button.setAttribute('aria-pressed', String(item.state === this.selectedMouth));
        }
      }, options);
    }
    this.blink.addEventListener('click', () => {
      clearTimeout(this.blinkTimer);
      this.avatar?.previewBlink(true);
      this.blink.setAttribute('aria-pressed', 'true');
      this.blinkTimer = setTimeout(() => {
        this.avatar?.previewBlink(false);
        this.blink.setAttribute('aria-pressed', 'false');
      }, 250);
    }, options);
  }

  show(avatar: Avatar, live2d: boolean): void {
    this.unsubscribe?.();
    this.avatar = avatar;
    element<HTMLFieldSetElement>('#reactionControls').disabled = !avatar.capabilities.reactions?.length;
    const idle = element<HTMLInputElement>('#idleSway');
    idle.checked = false;
    avatar.setIdleMotion(false);
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-reaction]')) {
      button.disabled = !avatar.capabilities.reactions?.includes(button.dataset.reaction as ReactionName);
    }
    this.selectedMouth = undefined;
    clearTimeout(this.blinkTimer);
    this.blink.setAttribute('aria-pressed', 'false');
    this.wrap.dataset.loaded = 'true';
    this.tools.hidden = false;
    this.viewHint.textContent = avatar.capabilities.viewControl
      ? (live2d ? 'Scroll to zoom' : 'Drag to orbit, scroll to zoom') : 'Preview expressions';
    this.resetView.hidden = !avatar.capabilities.viewControl;
    for (const { state, button } of this.mouthButtons) {
      button.disabled = !avatar.capabilities.mouth.includes(state);
      button.setAttribute('aria-pressed', 'false');
    }
    this.blink.disabled = !avatar.capabilities.blink;
    this.unsubscribe = avatar.onMotion((frame) => {
      this.mouthState.textContent = frame.mouth.toUpperCase();
      this.stateHint.textContent = hints[frame.mouth];
      this.updateMeter(frame.energy);
    });
  }

  clear(): void {
    this.unsubscribe?.(); this.unsubscribe = undefined;
    this.avatar = undefined;
    clearTimeout(this.blinkTimer);
    element<HTMLFieldSetElement>('#reactionControls').disabled = true;
    this.blink.disabled = true;
    for (const { button } of this.mouthButtons) button.disabled = true;
  }

  private updateMeter(energy: number): void {
    const active = Math.round(energy * this.barElements.length);
    this.barElements.forEach((bar, index) => bar.classList.toggle('active', index < active));
    this.bars.setAttribute('aria-valuenow', Math.round(energy * 100).toString());
    const db = energy > 0 ? 20 * Math.log10(Math.max(energy * 0.28, 0.0001)) : -Infinity;
    this.dbValue.textContent = Number.isFinite(db) ? `${db.toFixed(1)} dB` : '−∞ dB';
  }

  dispose(): void {
    this.events.abort();
    this.clear();
  }
}
