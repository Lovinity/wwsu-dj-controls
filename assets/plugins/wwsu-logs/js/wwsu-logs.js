/* global TAFFY */

// This class manages logs and attendance

// NOTE: unlike most other WWSU models, this does not use traditional WWSUdb extends. Otherwise, memory can be quickly eaten up by logs.
class WWSUlogs {

    /**
     * Construct the class.
     * 
     * @param {sails.io} socket WWSU socket connection
     * @param {WWSUreq} noReq Request without authorization
     * @param {WWSUreq} hostReq Request with host authorization
     * @param {WWSUreq} directorReq Request with director authorization
     */
    constructor(socket, noReq, hostReq, directorReq) {
        this.endpoints = {
            edit: '/logs/edit',
            get: '/logs/get',
        };
        this.requests = {
            no: noReq,
            host: hostReq,
            director: directorReq
        }
        this.tables = {
            issues: undefined
        }
        this.events = new EventEmitter();

        // WWSUdbs
        this.issues = new WWSUdb(TAFFY());
        this.issues.on('replace', (data, db) => {
            this.events.emitEvent('issues-replace', [ data ]);
            this.updateIssuesTable();
            console.log(`issues-replace`);
        })

        socket.on('logs', (data) => {
            console.log(`logs`);
            for (var key in data) {
                if (key === 'remove') {
                    this.events.emitEvent(`issues-remove`, [ data[ key ] ]);
                    this.updateIssuesTable();
                    console.log(`remove`);
                    continue;
                }
                if ([
                    'cancellation',
                    'updated',
                    'director-cancellation',
                    'director-updated',
                    'silence',
                    'silence-track',
                    'silence-switch',
                    'silence-terminated',
                    'absent',
                    'director-absent',
                    'unauthorized',
                    'prerecord-terminated',
                    'system-queuefail',
                    'system-frozen',
                    'system-changingstate',
                    'reboot',
                    'id',
                    'status-danger',
                    'status-reported',
                    'sign-on-early',
                    'sign-on-late',
                    'sign-off-early',
                    'sign-off-late'
                ].indexOf(data[ key ].logtype) !== -1) {
                    if (!data[ key ].acknowledged) {
                        if (this.issues.db({ ID: data[ key ].ID }).get().length > 0) {
                            this.issues.query(data, false);
                            this.events.emitEvent(`issues-${key}`, [ data[ key ] ]);
                            console.log(`issues-${key}`);
                        } else {
                            this.issues.query({ insert: data[ key ] }, false);
                            this.events.emitEvent(`issues-insert`, [ data[ key ] ]);
                            console.log(`issues-insert`);
                        }
                    } else {
                        this.events.emitEvent(`issues-remove`, [ data[ key ].ID ]);
                        this.issues.query({ remove: data[ key ].ID }, false);
                        console.log(`issues-remove`);
                    }
                    this.updateIssuesTable();
                }
            }
        })
    }

    // Initialize issues logs by fetching issues and subscribing to sockets
    initIssues (device = null) {
        this.issues.replaceData(this.requests.host, this.endpoints.get, { subtype: 'ISSUES' });
    }

    /**
     * Listen for an event.
     * 
     * @param {string} event Event to listen: issues-[insert|update|remove|replce](record|record.ID), counts(fcc, accountability, timesheets, updated)
     * @param {function} fn Function called when the event is fired
     */
    on (event, fn) {
        this.events.on(event, fn);
    }

    /**
     * Edit the log via WWSU API.
     * 
     * @param {object} data Data to pass to WWSU 
     * @param {?function} cb Callback function with true for success, false for failure
     */
    edit (data, cb) {
        try {
            this.requests.director.request({ method: 'post', url: this.endpoints.edit, data }, (response) => {
                if (response !== 'OK') {
                    $(document).Toasts('create', {
                        class: 'bg-danger',
                        title: 'Error editing log',
                        body: 'There was an error editing the log. Please report this to the engineer.',
                        icon: 'fas fa-skull-crossbones fa-lg',
                    });
                    if (typeof cb === 'function') {
                        cb(false);
                    }
                } else {
                    $(document).Toasts('create', {
                        class: 'bg-success',
                        title: 'log edited',
                        autohide: true,
                        delay: 10000,
                        body: `The log was edited.`,
                    })
                    if (typeof cb === 'function') {
                        cb(true);
                    }
                }
            })
        } catch (e) {
            $(document).Toasts('create', {
                class: 'bg-danger',
                title: 'Error editing log',
                body: 'There was an error editing the log. Please report this to the engineer.',
                icon: 'fas fa-skull-crossbones fa-lg',
            });
            if (typeof cb === 'function') {
                cb(false);
            }
            console.error(e);
        }
    }

    /**
     * Initialize the table which will be used for browsing and managing issues / accountability.
     * 
     * @param {string} table DOM query string of the div container that should contain the table.
     */
    initIssuesTable (table) {
        var util = new WWSUutil();

        // Init html
        $(table).html(`<table id="section-notifications-issues-table" class="table table-striped display responsive" style="width: 100%;"></table>`);

        util.waitForElement(`#section-notifications-issues-table`, () => {
            // Generate table
            this.tables.issues = $(`#section-notifications-issues-table`).DataTable({
                paging: false,
                data: [],
                columns: [
                    { title: "ID" },
                    { title: "Icon" },
                    { title: "Date/Time" },
                    { title: "Event" },
                    { title: "Actions" },
                ],
                columnDefs: [
                    { responsivePriority: 1, targets: 4 },
                ],
                "order": [ [ 0, "asc" ] ],
                pageLength: 25
            });

            // Update with information
            this.updateIssuesTable();
        });
    }

    /**
     * Update the issues table if it exists. Also emits count event for notifications
     */
    updateIssuesTable () {
        var util = new WWSUutil();

        if (this.tables.issues) {
            this.tables.issues.clear();
            this.issues.db().each((log) => {
                this.tables.issues.row.add([
                    log.ID,
                    `<i class="${log.logIcon} bg-${log.loglevel}" style="border-radius: 50%; font-size: 15px; height: 30px; line-height: 30px; text-align: center; width: 30px;"></i>`,
                    moment(log.createdAt).format("llll"),
                    `<strong>${log.title}</strong><br />${log.event}${log.trackArtist || log.trackTitle || log.trackAlbum || log.trackRecordLabel ? `${log.trackArtist || log.trackTitle ? `<br />Track: ${log.trackArtist ? log.trackArtist : `Unknown Artist`} - ${log.trackTitle ? log.trackTitle : `Unknown Title`}` : ``}${log.trackAlbum ? `<br />Album: ${log.trackAlbum}` : ``}${log.trackLabel ? `<br />Label: ${log.trackLabel}` : ``}` : ``}`,
                    `${[
                        'cancellation',
                        'updated',
                        'director-cancellation',
                        'director-updated',
                        'silence',
                        'absent',
                        'director-absent',
                        'unauthorized',
                        'id',
                        'sign-on-early',
                        'sign-on-late',
                        'sign-off-early',
                        'sign-off-late'
                    ].indexOf(log.logtype) !== -1 && log.attendanceID && !log.excused ? `<div class="btn-group"><button class="btn btn-sm btn-danger btn-issue-unexcused" data-id="${log.ID}" title="Mark Unexcused (counts in analytics)"><i class="fas fa-thumbs-down"></i></button><button class="btn btn-sm btn-success btn-issue-excused" data-id="${log.ID}" title="Mark Excused (does not count in analytics)"><i class="fas fa-thumbs-up"></i></button></div>` : `<button class="btn btn-sm btn-warning btn-issue-dismiss" data-id="${log.ID}" title="Acknowledge / Dismiss"><i class="fas fa-check-circle"></i></button>`}`
                ])
            });
            this.tables.issues.draw();

            // Action button click events
            $('.btn-issue-unexcused').unbind('click');
            $('.btn-issue-excused').unbind('click');
            $('.btn-issue-dismiss').unbind('click');

            $('.btn-issue-unexcused').click((e) => {
                var id = parseInt($(e.currentTarget).data('id'));
                util.confirmDialog(`Are you sure you want to mark issue ${id} as <strong>unexcused</strong>?
                <ul>
                <li><strong>This cannot be undone!</strong> Once you proceed, the issue will be marked unexcused and permanently dismissed from the todo window.</li>
                <li>Unexcused means this record <strong>will</strong> count against DJ/show reputation and show up in analytics.</li>
                </ul>
                `, null, () => {
                    this.edit({ ID: id, acknowledged: true, excused: false });
                });
            })

            $('.btn-issue-excused').click((e) => {
                var id = parseInt($(e.currentTarget).data('id'));
                util.confirmDialog(`Are you sure you want to mark issue ${id} as <strong>excused</strong>?
                <ul>
                <li><strong>This cannot be undone!</strong> Once you proceed, the issue will be marked excused and permanently dismissed from the todo window.</li>
                <li>Excused means this record <strong>will NOT</strong> count against DJ/show reputation nor analytics; excusing this means we pretend it never happened.</li>
                <li><strong>Please do not excuse issues unless the issue was caused by WWSU and not the broadcast host(s).</strong> Otherwise, issues should be unexcused.</li>
                </ul>
                `, null, () => {
                    this.edit({ ID: id, acknowledged: true, excused: true });
                });
            })

            $('.btn-issue-dismiss').click((e) => {
                var id = parseInt($(e.currentTarget).data('id'));
                console.log(`dismiss`);
                util.confirmDialog(`Are you sure you want to dismiss ${id}? <strong>This cannot be undone!</strong> Once you proceed, the issue will be permanently dismissed from the todo window. Please do not dismiss issues until they are resolved / no longer relevant.`, null, () => {
                    this.edit({ ID: id, acknowledged: true });
                });
            })

            // Notification counters
            var danger = this.issues.db({ loglevel: 'danger' }).get().length;
            var orange = this.issues.db({ loglevel: 'orange' }).get().length;
            var warning = this.issues.db({ loglevel: 'warning' }).get().length;
            var info = this.issues.db({ loglevel: 'info' }).get().length;
            this.events.emitEvent(`count`, [ danger, orange, warning, info ]);
        }
    }
}