
// This class manages the EAS
class WWSUeas extends WWSUdb {

    /**
     * Construct the class
     * 
     * @param {sails.io} socket Socket connection to WWSU
     * @param {WWSUreq} noReq Request with no authorization
     * @param {WWSUreq} directorReq Request with director authorization
     */
    constructor(socket, noReq, directorReq) {
        super(); // Create the db

        this.endpoints = {
            get: '/eas/get',
            test: '/eas/test',
            send: '/eas/send'
        };
        this.requests = {
            no: noReq,
            director: directorReq
        };
        this.data = {
            get: {},
            test: {},
            send: {}
        };
        this.events = new EventEmitter();

        this.displayed = [];

        this.assignSocketEvent('eas', socket);

        this.easModal = new WWSUmodal(`Active Emergency Alerts`, null, ``, true, {
            headerColor: '',
            overlayClose: true,
            zindex: 1100,
            timeout: 180000,
            timeoutProgressbar: true,
        });

        this.easSevereAlert = new WWSUmodal(
            `Severe Alert Active`,
            `bg-warning bg-flash-warning`,
            `<div style="text-align: center;">
                <i class="fas fa-bolt" style="font-size: 25vw;"></i>
            </div>
            <h3>A severe alert is in effect.</h3>
            Alert: <strong class="eas-severe-alert-alert"></strong><br />
            From <strong class="eas-severe-alert-starts"></strong> to <strong class="eas-severe-alert-expires"></strong>.<br />
            Counties: <strong class="eas-severe-alert-counties"></strong><br />`,
            true,
            {
                headerColor: '',
                overlayClose: false,
                zindex: 4000,
                timeout: (1000 * 60 * 30),
                timeoutProgressbar: true,
            }
        );

        this.easExtremeAlert = new WWSUmodal(
            `Extreme Alert Active`,
            `bg-danger bg-flash-danger`,
            `<div style="text-align: center;">
                <i class="fas fa-bolt" style="font-size: 25vw;"></i>
            </div>
            <h3>An extreme alert is in effect.</h3> <strong>Please consider ending your show and evacuating / taking shelter now, if applicable!</strong>
            Alert: <strong class="eas-extreme-alert-alert"></strong><br />
            From <strong class="eas-extreme-alert-starts"></strong> to <strong class="eas-extreme-alert-expires"></strong>.<br />
            Counties: <strong class="eas-extreme-alert-counties"></strong><br />`,
            true,
            {
                headerColor: '',
                overlayClose: false,
                zindex: 4010,
                timeout: (1000 * 60 * 30),
                timeoutProgressbar: true,
            }
        );
    }

    // Start the connection. Call this in socket connect event.
    init () {
        this.replaceData(this.requests.no, this.endpoints.get, this.data.get);
    }

    /**
     * Send an alert out through the internal Node.js EAS (but NOT the on-air EAS)
     * 
     * @param {string} dom DOM query string of the element to block while processing
     * @param {string} counties Comma separated list of counties for which this alert is in effect
     * @param {string} alert The name of the alert
     * @param {string} severity The severity of the alert. Must be Minor, Moderate, Severe, or Extreme.
     * @param {string} color Hexadecimal string of the color to use for this alert
     * @param {string} information Detailed information about the alert and what people should do.
     * @param {?string} expires ISO timestamp when this alert expires (undefined = 1 hour from now)
     * @param {string} starts ISO timestamp when this alert starts (undefined = now)
     */
    send (dom, counties, alert, severity, color, information, expires = moment().add(1, 'hour').toISOString(true), starts = moment().toISOString(true)) {
        try {
            this.requests.director.request({ dom, method: 'post', url: this.endpoints.send, data: { counties, alert, severity, color, information, expires, starts } }, (response) => {
                if (response !== 'OK') {
                    $(document).Toasts('create', {
                        class: 'bg-danger',
                        title: 'Error sending alert',
                        body: 'There was an error sending the alert. Please report this to the engineer.',
                        autoHide: true,
                        delay: 10000,
                        icon: 'fas fa-skull-crossbones fa-lg',
                    });
                    cb(false);
                } else {
                    $(document).Toasts('create', {
                        class: 'bg-success',
                        title: 'Alert Sent!',
                        autohide: true,
                        delay: 10000,
                        body: `Alert was sent!`,
                    })
                    cb(true);
                }
            })
        } catch (e) {
            $(document).Toasts('create', {
                class: 'bg-danger',
                title: 'Error sending alert',
                body: 'There was an error sending the alert. Please report this to the engineer.',
                autoHide: true,
                delay: 10000,
                icon: 'fas fa-skull-crossbones fa-lg',
            });
            console.error(e);
            cb(false);
        }
    }

    /**
     * Send a test alert through the internal EAS (but NOT the on-air EAS)
     * 
     * @param {string} dom DOM query string of the element to block while processing
     */
    test (dom) {
        try {
            this.requests.director.request({ dom, method: 'post', url: this.endpoints.test, data: {} }, (response) => {
                if (response !== 'OK') {
                    $(document).Toasts('create', {
                        class: 'bg-danger',
                        title: 'Error sending test alert',
                        body: 'There was an error sending the test alert. Please report this to the engineer.',
                        autoHide: true,
                        delay: 10000,
                        icon: 'fas fa-skull-crossbones fa-lg',
                    });
                    cb(false);
                } else {
                    $(document).Toasts('create', {
                        class: 'bg-success',
                        title: 'Test Alert Sent!',
                        autohide: true,
                        delay: 10000,
                        body: `Test alert was sent!`,
                    })
                    cb(true);
                }
            })
        } catch (e) {
            $(document).Toasts('create', {
                class: 'bg-danger',
                title: 'Error sending test alert',
                body: 'There was an error sending the test alert. Please report this to the engineer.',
                autoHide: true,
                delay: 10000,
                icon: 'fas fa-skull-crossbones fa-lg',
            });
            console.error(e);
            cb(false);
        }
    }

    /**
     * Display activated alerts.
     * 
     * @param {object} record The ID of the EAS alert record from WWSU to display (accessed from WWSUdb).
     */
    displayAlerts () {
        this.find().forEach((record) => {
            if (this.displayed.indexOf(record.ID) === -1) {
                if (record.severity === 'Severe') {
                    this.easSevereAlert.iziModal('close');
                    $('.eas-severe-alert-alert').html(record.alert);
                    $('.eas-severe-alert-starts').html(moment(record.starts).format("lll"));
                    $('.eas-severe-alert-expires').html(moment(record.expires).format("lll"));
                    $('.eas-severe-alert-counties').html(record.counties);
                    this.easSevereAlert.iziModal('open');
                    this.displayed.push(record.ID);
                } else if (record.severity === 'Extreme') {
                    this.easExtremeAlert.iziModal('close');
                    $('.eas-extreme-alert-alert').html(record.alert);
                    $('.eas-extreme-alert-starts').html(moment(record.starts).format("lll"));
                    $('.eas-extreme-alert-expires').html(moment(record.expires).format("lll"));
                    $('.eas-extreme-alert-counties').html(record.counties);
                    this.easExtremeAlert.iziModal('open');
                    this.displayed.push(record.ID);
                }
            }
        });
    }
}