export class SoundManager {
    private sounds: { [key: string]: HTMLAudioElement } = {};
    private isMuted: boolean = false;

    constructor() {
        this.loadSounds();
    }

    private loadSounds(): void {
        // Load all sound effects
        this.sounds = {
            diamond: new Audio('/sounds/diamond.wav'),
            boulder: new Audio('/sounds/boulder.wav'),
            walk: new Audio('/sounds/walk.wav'),
            explosion: new Audio('/sounds/explosion.wav'),
            victory: new Audio('/sounds/victory.wav')
        };

        // Set volume for all sounds
        Object.values(this.sounds).forEach(sound => {
            sound.volume = 0.3;  // 30% volume by default
        });
    }

    public play(soundName: string): void {
        if (this.isMuted || !this.sounds[soundName]) return;

        // Create a new audio element for overlapping sounds
        const sound = this.sounds[soundName].cloneNode(true) as HTMLAudioElement;
        sound.play().catch(error => console.log('Error playing sound:', error));
    }

    public toggleMute(): void {
        this.isMuted = !this.isMuted;
    }

    public isSoundMuted(): boolean {
        return this.isMuted;
    }
} 