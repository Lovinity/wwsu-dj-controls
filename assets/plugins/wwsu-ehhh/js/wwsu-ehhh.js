// Only the best error sound in the world!

// REQUIRES these WWSU modules: WWSUhosts
// REQUIRES these libraries: Howl (Howler.js)

class WWSUehhh extends Howl {
	/**
	 * Construct the class
	 *
	 * @param {WWSUmodules} manager The modules class which initiated this module
	 * @param {object} options Options to be passed to Howler
	 */
	constructor(manager, options) {
		super(options);
		this.manager = manager;
	}

	// Intercept the play command to prevent playing when this DJ Controls might be on the air
	play() {
		// Do not play if this DJ Controls started the current broadcast (we don't want "ehhhs" going on the air).
		if (this.manager.get("WWSUhosts").isHost) return;

		// Do not play if this DJ Controls is on a computer that might be on the air with automation (judged by the answerCalls permission)
		// (We don't want "ehhhs" going on the air)
		if (this.manager.get("WWSUhosts").client.answerCalls) return;

		// Else, we can play the error sound.
		super.play();
	}
}
