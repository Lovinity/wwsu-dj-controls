/* global EventEmitter */

// This class handles states and operations.
class WWSUstate {

    /**
     * Construct the class
     * 
     * @param {sails.io} socket Socket connection to WWSU
     * @param {WWSUreq} hostReq Request with host authorization
     */
    constructor(socket, hostReq) {
        this.endpoints = {
            get: '/status/get',
            report: '/status/report'
        };
        this.requests = {
            host: hostReq,
        };
        this.data = {
            get: {}
        };
        this.events = new EventEmitter();
    }

    // Initialize function; should be called in socket.on('connect').
    init () {
        this.request.request({ method: 'POST', url: this.endpoint, data: {} }, (body) => {
            try {
                for (var key in body) {
                    if (Object.prototype.hasOwnProperty.call(body, key)) {
                        this._meta[ key ] = body[ key ]
                        if (key === 'time') {
                            this.timeOffset = moment().diff(moment(body[ key ]));
                            this.resetTick();
                        }
                        if (key === 'trackFinish') {
                            this.resetTick();
                        }
                    }
                }
                this.events.emitEvent('newMeta', [ body, this._meta ]);
            } catch (e) {
                console.error(e);
                setTimeout(this.init, 10000);
            }
        });
    }

    /**
     * Listen to an event.
     * 
     * @param {string} event Name of event: newMeta([updatedMeta, entireMeta]), metaTick([entireMeta])
     * @param {function} fn Function to call when the event is fired
     */
    on (event, fn) {
        this.events.on(event, fn);
    }
}