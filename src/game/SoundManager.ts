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
            victory: new Audio('/sounds/victory.wav'),
            timeWarning: new Audio('/sounds/warning.wav'),
            portal: new Audio('/sounds/portal.wav')  // Add portal sound
        };

        // Set volume for all sounds
        Object.values(this.sounds).forEach(sound => {
            sound.volume = 0.3;  // 30% volume by default
        });

        // Set warning sound to loop
        if (this.sounds.timeWarning) {
            this.sounds.timeWarning.loop = true;
        }
    }

    public play(soundName: string): void {
        if (this.isMuted) {
            return;
        }
        
        if (!this.sounds[soundName]) {
            console.error(`Sound ${soundName} not found in loaded sounds`);
            return;
        }

        // For looping sounds like timeWarning, don't clone
        if (soundName === 'timeWarning') {
            this.sounds[soundName].play()
                .catch(error => {
                    console.error('Error playing warning sound:', error);
                    // Try to reload the sound
                    this.sounds[soundName] = new Audio('/sounds/warning.wav');
                    this.sounds[soundName].loop = true;
                    this.sounds[soundName].volume = 0.3;
                    // Try playing again
                    this.sounds[soundName].play()
                        .catch(error => console.error('Error playing warning sound after reload:', error));
                });
            return;
        }

        // Create a new audio element for overlapping sounds
        const sound = this.sounds[soundName].cloneNode(true) as HTMLAudioElement;
        sound.play().catch(error => console.error('Error playing sound:', error));
    }

    public stop(soundName: string): void {
        if (!this.sounds[soundName]) {
            console.error(`Cannot stop sound ${soundName} - not found`);
            return;
        }
        
        try {
            this.sounds[soundName].pause();
            this.sounds[soundName].currentTime = 0;
        } catch (error) {
            console.error(`Error stopping sound ${soundName}:`, error);
        }
    }

    public toggleMute(): void {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            // Stop all sounds when muting
            Object.values(this.sounds).forEach(sound => {
                try {
                    sound.pause();
                    sound.currentTime = 0;
                } catch (error) {
                    console.error('Error stopping sound during mute:', error);
                }
            });
        }
    }

    public isSoundMuted(): boolean {
        return this.isMuted;
    }
} 