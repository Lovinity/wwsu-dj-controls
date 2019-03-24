// DJ Controls wrapper for Peer.js

class AudioWrapper {
    constructor() {
        /*
         * peer: Information regarding the audio used for Peer.js calls.
         * @type Object
         */
        this._peer = {
            /*
             * stream: The local media stream used to broadcast to peers.
             * @type MediaStream
             */
            stream: undefined,

            /*
             * device: The device ID being used to transmit audio to connected peers.
             * @type String
             */
            device: undefined,

            /*
             * host: The WWSU Host ID we are connected or trying to connect to.
             * @type String
             */
            host: undefined,

            /*
             * volume: The current volume of the peerStream, in dB.
             * @type number
             */
            volume: -100,

            /*
             * analyzer: The MediaStreamAudioSourceNode for the peerStream.
             * @type MediaStreamAudioSourceNode
             */
            analyzer: undefined,

        };

        /*
         * main: Information regarding the audio used for silence detection and audio recording.
         * @type Object
         */
        this._main = {
            /*
             * stream: The main audio stream used for silence detection and audio recording.
             * @type MediaStream
             */
            stream: undefined,

            /*
             * device: The device ID being used to stream audio to silence detection and audio recording.
             * @type String
             */
            device: undefined,

            /*
             * volume: The current volume of the mainStream, in dB.
             * @type number
             */
            volume: -100,

            /*
             * analyzer: The MediaStreamAudioSourceNode for the mainStream.
             * @type MediaStreamAudioSourceNode
             */
            analyzer: undefined,

        };

        /*
         * this._outgoingCall: The Peer.js media connection for an outgoing call.
         * @type MediaConnection
         */
        this._outgoingCall = undefined;

        /*
         * this._incomingCall: The Peer.js media connection for an incoming call.
         * @type MediaConnection
         */
        this._incomingCall = undefined;

        /*
         * this._incomingCloseIgnore: When true, closing of the incoming call is allowed and not considered an error.
         * @type boolean
         */
        this._incomingCloseIgnore = false;

        /*
         * this._outgoingCloseIgnore: When true, closing of the outgoing call is allowed and not considered an error.
         * @type boolean
         */
        this._outgoingCloseIgnore = false;

        /*
         * this._tryingCall: An object containing information about an attempted call.
         * @type Object {host: number, cb: function, friendlyname: String}
         */
        this._tryingCall = undefined;

        /*
         * this._waitingFor: An object containing information about a Peer.js host we are waiting to connect.
         * @type Object {host: number, cb: function}
         */
        this._waitingFor = undefined;

        /*
         * this._audioContext: The web audio API context used by the wrapper.
         * @type AudioContext
         */
        this._audioContext = new AudioContext();
    }

}
;

module.exports = new AudioWrapper();

