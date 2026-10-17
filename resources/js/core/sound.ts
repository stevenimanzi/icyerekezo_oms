const STORAGE_KEY = 'notification-sound';

let context: AudioContext | null = null;

const audio = () => {
    if (!context) {
        const Constructor =
            window.AudioContext ??
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Constructor) return null;
        context = new Constructor();
    }

    return context;
};

/** Browsers only allow sound after the person has touched the page once, so the first click or key press unlocks it. */
export function unlockSound() {
    const unlock = () => {
        audio()
            ?.resume()
            .catch(() => {});
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    return () => {
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
    };
}

export function soundEnabled(): boolean {
    try {
        return window.localStorage.getItem(STORAGE_KEY) !== 'off';
    } catch {
        return true;
    }
}

export function saveSoundEnabled(enabled: boolean) {
    try {
        window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
    } catch {
        /* the choice just is not remembered */
    }
}

/** A short two-note chime made in the browser, so no sound file has to be loaded. */
export function playChime() {
    const ctx = audio();
    if (!ctx || ctx.state !== 'running') return;

    const notes: [number, number][] = [
        [880, 0],
        [1318.5, 0.14],
    ];

    for (const [frequency, delay] of notes) {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + delay;

        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
        oscillator.connect(gain).connect(ctx.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.5);
    }
}
