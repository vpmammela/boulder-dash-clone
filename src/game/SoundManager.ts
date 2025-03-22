export class SoundManager {
    private sounds: { [key: string]: HTMLAudioElement } = {};
    private isMuted: boolean = false;
    private initialized: boolean = false;

    constructor() {
        // Don't load sounds immediately
        this.setupInitialization();
    }

    private setupInitialization(): void {
        // List of events that indicate user interaction
        const interactionEvents = ['click', 'keydown', 'touchstart'];
        
        const initializeOnce = () => {
            if (!this.initialized) {
                this.loadSounds();
                this.initialized = true;
                // Remove event listeners after initialization
                interactionEvents.forEach(event => {
                    document.removeEventListener(event, initializeOnce);
                });
            }
        };

        // Add event listeners for user interaction
        interactionEvents.forEach(event => {
            document.addEventListener(event, initializeOnce);
        });
    }

    private loadSounds(): void {
        try {
            // Load all sound effects
            this.sounds = {
                diamond: new Audio('/sounds/diamond.wav'),
                boulder: new Audio('/sounds/boulder.wav'),
                walk: new Audio('/sounds/walk.wav'),
                explosion: new Audio('/sounds/explosion.wav'),
                victory: new Audio('/sounds/victory.wav'),
                timeWarning: new Audio('/sounds/warning.wav'),
                portal: new Audio('/sounds/portal.wav')
            };

            // Set volume for all sounds
            Object.values(this.sounds).forEach(sound => {
                sound.volume = 0.3;  // 30% volume by default
            });

            // Set warning sound to loop
            if (this.sounds.timeWarning) {
                this.sounds.timeWarning.loop = true;
            }

            // Preload sounds
            Object.values(this.sounds).forEach(sound => {
                sound.load();
            });

            console.log('Sounds loaded successfully');
        } catch (error) {
            console.error('Error loading sounds:', error);
        }
    }

    public play(soundName: string): void {
        if (this.isMuted || !this.initialized) {
            return;
        }
        
        if (!this.sounds[soundName]) {
            console.error(`Sound ${soundName} not found in loaded sounds`);
            return;
        }

        try {
            // For looping sounds like timeWarning, don't clone
            if (soundName === 'timeWarning') {
                const promise = this.sounds[soundName].play();
                if (promise !== undefined) {
                    promise.catch(error => {
                        console.error('Error playing warning sound:', error);
                        // Try to reload the sound
                        this.sounds[soundName] = new Audio('/sounds/warning.wav');
                        this.sounds[soundName].loop = true;
                        this.sounds[soundName].volume = 0.3;
                        // Try playing again
                        this.sounds[soundName].play()
                            .catch(error => console.error('Error playing warning sound after reload:', error));
                    });
                }
                return;
            }

            // Create a new audio element for overlapping sounds
            const sound = this.sounds[soundName].cloneNode(true) as HTMLAudioElement;
            const promise = sound.play();
            if (promise !== undefined) {
                promise.catch(error => {
                    console.error('Error playing sound:', error);
                });
            }
        } catch (error) {
            console.error(`Error playing sound ${soundName}:`, error);
        }
    }

    public stop(soundName: string): void {
        if (!this.initialized || !this.sounds[soundName]) {
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
        if (this.isMuted && this.initialized) {
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