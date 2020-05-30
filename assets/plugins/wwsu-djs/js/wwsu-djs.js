/* global WWSUdb */

// This class manages DJs from WWSU.
class WWSUdjs extends WWSUdb {

    /**
     * Construct the class
     * 
     * @param {sails.io} socket Socket connection to WWSU
     * @param {WWSUreq} noReq Request with no authorization
     * @param {WWSUreq} directorReq Request with director authorization
     * @param {WWSUreq} hostReq Request with host authorization
     * @param {WWSUlogs} logs Reference to the initialized WWSUlogs class
     */
    constructor(socket, noReq, directorReq, hostReq, logs) {
        super(); // Create the db

        this.endpoints = {
            get: '/djs/get',
            add: '/djs/add',
            edit: '/djs/edit',
            remove: '/djs/remove',
        };
        this.data = {
            get: {}
        };
        this.requests = {
            no: noReq,
            director: directorReq,
            host: hostReq
        };

        this.logs = logs;

        this.assignSocketEvent('djs', socket);

        this.table;

        this.djsModal = new WWSUmodal(`Manage DJs`, null, ``, true, {
            headerColor: '',
            overlayClose: false,
            zindex: 1100,
        });

        this.djModal = new WWSUmodal(``, null, ``, true, {
            headerColor: '',
            overlayClose: false,
            width: 800,
            zindex: 1100,
        });

        this.newDjModal = new WWSUmodal(`New DJ`, null, ``, true, {
            headerColor: '',
            overlayClose: false,
            zindex: 1110,
        });

        this.animations = new WWSUanimations();
    }

    // Initialize connection. Call this on socket connect event.
    init () {
        this.replaceData(this.requests.no, this.endpoints.get, this.data.get);
    }

    /**
     * Generate a simple DataTables.js table of the DJs in the system
     * 
     */
    showDJs () {
        this.djsModal.body = `<table id="modal-${this.djsModal.id}-table" class="table table-striped" style="min-width: 100%;"></table>`;
        this.djsModal.iziModal('open');
        $(this.djsModal.body).block({
            message: '<h1>Loading...</h1>',
            css: { border: '3px solid #a00' },
            timeout: 30000,
            onBlock: () => {
                var table = $(`#modal-${this.djsModal.id}-table`).DataTable({
                    scrollCollapse: true,
                    paging: false,
                    data: [],
                    columns: [
                        { title: "DJ Name" },
                        { title: "Full Name" },
                        { title: "Last Seen" },
                    ],
                    "order": [ [ 0, "asc" ] ],
                    pageLength: 10
                });
                this.db().each((dj) => {
                    table.rows.add([ [
                        dj.name || 'Unknown',
                        dj.fullName || 'Unknown',
                        moment(dj.lastSeen).format('LLL'),
                    ] ])
                });
                table.draw();
                $(this.djsModal.body).unblock();
            }
        });

        // Generate new DJ button
        this.djsModal.footer = `<button type="button" class="btn btn-outline-success" id="modal-${this.djsModal.id}-new" data-dismiss="modal">New DJ</button>`;
        $(`#modal-${this.djsModal.id}-new`).unbind('click');
        $(`#modal-${this.djsModal.id}-new`).click(() => {
            this.showDJForm();
        });
    }

    /**
     * Make a "New DJ" Alpaca form in a modal.
     */
    showDJForm (data) {
        this.newDjModal.body = ``;
        this.newDjModal.iziModal('open');

        var _djs = this.db().get().map((dj) => dj.name);

        $(this.newDjModal.body).alpaca({
            "schema": {
                "title": data ? "Edit DJ" : "New DJ",
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "required": true,
                        "title": "Name of DJ as used on radio",
                        "maxLength": 255
                    },
                    "realName": {
                        "type": "string",
                        "required": true,
                        "title": "Real full name of person",
                        "maxLength": 255
                    },
                    "email": {
                        "type": "string",
                        "format": "email",
                        "required": true,
                        "title": "Campus email of the DJ",
                        "maxLength": 255
                    },
                    "login": {
                        "type": "string",
                        "format": "password",
                        "required": true,
                        "title": "Login Password",
                        "maxLength": 255
                    },
                }
            },
            "options": {
                "fields": {
                    "name": {
                        "helper": "This is the name that appears publicly on shows, the website, etc. You may not use the same DJ name twice.",
                        "validator": function (callback) {
                            var value = this.getValue();
                            if ((!data || data.name !== value) && _djs.indexOf(value) !== -1) {
                                callback({
                                    "status": false,
                                    "message": "A DJ by this name already exists in the system. This is not allowed."
                                });
                                return;
                            }
                            callback({
                                "status": true
                            });
                        }
                    },
                    "realName": {
                        "helper": "Used for directors to help easily identify who this person is."
                    },
                    "email": {
                        "helper": "Plans are in the future, DJs will be emailed automatically of show changes / cancellations, analytics, and anything else pertaining to their show or WWSU."
                    },
                    "login": {
                        "helper": "DJs will use this to log in to their online DJ panel. In the future, this may be used to log in to prod / onair computers during schedule shows or bookings. You might choose to use their door PIN."
                    }
                },
                "form": {
                    "buttons": {
                        "submit": {
                            "title": data ? "Edit DJ" : "Add DJ",
                            "click": (form, e) => {
                                form.refreshValidationState(true);
                                if (!form.isValid(true)) {
                                    form.focus();
                                    return;
                                }
                                var value = form.getValue();
                                if (data) {
                                    this.editDJ(value, (success) => {
                                        if (success) {
                                            this.newDjModal.iziModal('close');
                                        }
                                    });
                                } else {
                                    this.addDJ(value, (success) => {
                                        if (success) {
                                            this.newDjModal.iziModal('close');
                                        }
                                    });
                                }
                            }
                        }
                    }
                },
            },
            "data": data ? data : []
        });
    }

    /**
     * Add a new DJ to the system via the API
     * 
     * @param {Object} data The data to send in the request to the API to add a DJ
     * @param {function} cb Callback called after the request is complete. Parameter false if unsuccessful or true if it was.
     */
    addDJ (data, cb) {
        try {
            this.requests.director.request({ dom: `#modal-${this.newDjModal.id}`, method: 'post', url: this.endpoints.add, data: data }, (response) => {
                if (response !== 'OK') {
                    $(document).Toasts('create', {
                        class: 'bg-warning',
                        title: 'Error adding',
                        body: 'There was an error adding the DJ. Please make sure you filled all fields correctly.',
                        delay: 10000,
                    });
                    cb(false);
                } else {
                    $(document).Toasts('create', {
                        class: 'bg-success',
                        title: 'DJ Added',
                        autohide: true,
                        delay: 10000,
                        body: `DJ has been created`,
                    })
                    cb(true);
                }
            })
        } catch (e) {
            $(document).Toasts('create', {
                class: 'bg-danger',
                title: 'Error adding DJ',
                body: 'There was an error adding a new DJ. Please report this to engineer@wwsu1069.org.',
                icon: 'fas fa-skull-crossbones fa-lg',
            });
            console.error(e);
            cb(false);
        }
    }

    /**
     * Edit a DJ in the system
     * 
     * @param {Object} data The data to send in the request to the API
     * @param {function} cb Callback called after the request is complete. Parameter false if unsuccessful or true if it was.
     */
    editDJ (data, cb) {
        try {
            this.requests.director.request({ dom: `#modal-${this.newDjModal.id}`, method: 'post', url: this.endpoints.edit, data: data }, (response) => {
                if (response !== 'OK') {
                    $(document).Toasts('create', {
                        class: 'bg-warning',
                        title: 'Error editing',
                        body: 'There was an error editing the DJ. Please make sure you filled all fields correctly.',
                        delay: 10000,
                    });
                    cb(false);
                } else {
                    $(document).Toasts('create', {
                        class: 'bg-success',
                        title: 'DJ Edited',
                        autohide: true,
                        delay: 10000,
                        body: `DJ has been edited`,
                    })
                    cb(true);
                }
            })
        } catch (e) {
            $(document).Toasts('create', {
                class: 'bg-danger',
                title: 'Error adding DJ',
                body: 'There was an error editing the DJ. Please report this to engineer@wwsu1069.org.',
                icon: 'fas fa-skull-crossbones fa-lg',
            });
            console.error(e);
            cb(false);
        }
    }

    /**
     * Remove a DJ from the system.
     * 
     * @param {Object} data The data to send in the request to the API
     * @param {function} cb Callback called after the request is complete. Parameter false if unsuccessful or true if it was.
     */
    removeDJ (data, cb) {
        try {
            this.requests.director.request({ dom: `#modal-${this.newDjModal.id}`, method: 'post', url: this.endpoints.remove, data: data }, (response) => {
                if (response !== 'OK') {
                    $(document).Toasts('create', {
                        class: 'bg-danger',
                        title: 'Error removing DJ',
                        body: 'There was an error removing the DJ. Please report this to engineer@wwsu1069.org.',
                        icon: 'fas fa-skull-crossbones fa-lg',
                    });
                    cb(false);
                } else {
                    $(document).Toasts('create', {
                        class: 'bg-success',
                        title: 'DJ Removed',
                        autohide: true,
                        delay: 10000,
                        body: `DJ has been removed`,
                    })
                    cb(true);
                }
            })
        } catch (e) {
            $(document).Toasts('create', {
                class: 'bg-danger',
                title: 'Error removing DJ',
                body: 'There was an error removing the DJ. Please report this to engineer@wwsu1069.org.',
                icon: 'fas fa-skull-crossbones fa-lg',
            });
            console.error(e);
            cb(false);
        }
    }

    initTable (table) {
        this.animations.add('djs-init-table', () => {
            var util = new WWSUutil();

            // Init html
            $(table).html(`<table id="section-djs-table" class="table table-striped display responsive" style="width: 100%;"></table>
        <button type="button" class="btn btn-block btn-success btn-dj-new">New DJ</button>`);

            util.waitForElement(`#section-djs-table`, () => {

                // Generate table
                this.table = $(`#section-djs-table`).DataTable({
                    paging: true,
                    data: [],
                    columns: [
                        { title: "DJ Handle" },
                        { title: "Real Name" },
                        { title: "Icon" },
                        { title: "Last Seen" },
                        { title: "Actions" },
                    ],
                    columnDefs: [
                        { responsivePriority: 1, targets: 4 },
                    ],
                    "order": [ [ 0, "asc" ], [ 1, "asc" ] ],
                    pageLength: 10,
                    drawCallback: () => {
                        // Action button click events
                        $('.btn-dj-logs').unbind('click');
                        $('.btn-dj-analytics').unbind('click');
                        $('.btn-dj-edit').unbind('click');
                        $('.btn-dj-delete').unbind('click');

                        $('.btn-dj-analytics').click((e) => {
                            var dj = this.db().get().find((dj) => dj.ID === parseInt($(e.currentTarget).data('id')));
                            this.showDJAnalytics(dj);
                        });

                        $('.btn-dj-logs').click((e) => {
                            var dj = this.db().get().find((dj) => dj.ID === parseInt($(e.currentTarget).data('id')));
                            this.showDJLogs(dj);
                        });

                        $('.btn-dj-edit').click((e) => {
                            var dj = this.db().get().find((dj) => dj.ID === parseInt($(e.currentTarget).data('id')));
                            this.showDJForm(dj);
                        });

                        $('.btn-dj-delete').click((e) => {
                            var util = new WWSUutil();
                            var dj = this.db().get().find((dj) => dj.ID === parseInt($(e.currentTarget).data('id')));
                            util.confirmDialog(`Are you sure you want to <strong>permanently</strong> remove the DJ "${dj.name}"?
                            <ul>
                            <li><strong>Do NOT permanently remove a DJ until you no longer need their analytics, and they are no longer with WWSU and will not be returning.</strong></li>
                            <li>This removes the DJ from the system. Their analyics can no longer be viewed under "Analytics", but their show logs will remain in the system.</li>
                            <li>The DJ can no longer log in with their password, such as the DJ Panel.</li>
                            <li>The DJ will be removed from all calendar events they are listed on.</li>
                            <li><strong>Any events which this DJ was the host of will also be removed</strong> (If you don't want this, please assign a new host to these events before deleting this DJ.). Subscribers of those shows will be notified it has been permanently discontinued. And analytics for those shows can no longer be viewed (but logs will remain).
                            </ul>`, dj.name, () => {
                                this.removeDJ({ ID: dj.ID });
                            });
                        });
                    }
                });

                // Add click event for new DJ button
                $('.btn-dj-new').unbind('click');
                $('.btn-dj-new').click(() => {
                    this.showDJForm();
                });

                // Update with information
                this.updateTable();
            });
        });
    }

    /**
    * Update the DJ management table if it exists
    */
    updateTable () {
        this.animations.add('djs-update-table', () => {
            if (this.table) {
                this.table.clear();
                this.db().each((dj) => {
                    var icon = `secondary`;
                    if (!dj.lastSeen || moment(dj.lastSeen).add(30, 'days').isBefore(moment())) {
                        icon = `danger`
                    } else if (moment(dj.lastSeen).add(7, 'days').isBefore(moment())) {
                        icon = `warning`
                    } else {
                        icon = `success`
                    }
                    this.table.row.add([
                        dj.name || '',
                        dj.realName || '',
                        `<i class="fas fa-dot-circle text-${icon}"></i>`,
                        dj.lastSeen ? moment(dj.lastSeen).format("llll") : 'Unknown / Long Ago',
                        `<div class="btn-group"><button class="btn btn-sm btn-primary btn-dj-analytics" data-id="${dj.ID}" title="View DJ and Show Analytics"><i class="fas fa-chart-line"></i></button><button class="btn btn-sm btn-secondary btn-dj-logs" data-id="${dj.ID}" title="View Show Logs"><i class="fas fa-clipboard-list"></i></button><button class="btn btn-sm bg-indigo btn-dj-notes" data-id="${dj.ID}" title="View/Edit Notes and Remote Credits"><i class="fas fa-sticky-note"></i></button><button class="btn btn-sm btn-warning btn-dj-edit" data-id="${dj.ID}" title="Edit DJ"><i class="fas fa-edit"></i></button><button class="btn btn-sm btn-danger btn-dj-delete" data-id="${dj.ID}" title="Remove DJ"><i class="fas fa-trash"></i></button></div>`
                    ])
                });
                this.table.draw();
            }
        });
    }

    /**
     * Display DJ analytics and analytics for their shows in a modal.
     * 
     * @param {object} dj The DJ record to get analytics
     */
    showDJAnalytics (dj) {
        this.djModal.title = `Analytics for ${dj.name} (${dj.realName || `Unknown Person`})`;
        this.djModal.body = ``;
        this.djModal.iziModal('open');

        this.logs.getShowtime(`#modal-${this.djModal.id}`, { djs: [ dj.ID ], start: moment().subtract(1, 'years').toISOString(true), end: moment().toISOString(true) }, (analytics) => {
            if (!analytics) return;
            var analytic = analytics[ 0 ][ dj.ID ];
            var html = `<div class="card card-widget widget-user-2 p-1">
            <div class="widget-user-header bg-info">
              <h3 class="widget-user-username">DJ Analytics</h3>
              <h5 class="widget-user-desc"><span class="badge bg-success">Lifetime</span> <span class="badge bg-primary">365 days</span> <span class="badge bg-warning">Semester</span> <span class="badge bg-danger">Week</span></h5>
            </div>
            <div class="card-footer p-0">
              <ul class="nav flex-column">
                <li class="nav-item">
                  <div class="nav-link">
                    Shows <span class="float-right badge bg-danger">${analytic.week.shows}</span> <span class="float-right badge bg-warning">${analytic.semester.shows}</span> <span class="float-right badge bg-primary">${analytic.range.shows}</span> <span class="float-right badge bg-success">${analytic.overall.shows}</span>
                  </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Prerecords <span class="float-right badge bg-danger">${analytic.week.prerecords}</span> <span class="float-right badge bg-warning">${analytic.semester.prerecords}</span> <span class="float-right badge bg-primary">${analytic.range.prerecords}</span> <span class="float-right badge bg-success">${analytic.overall.prerecords}</span>
                    </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Remotes <span class="float-right badge bg-danger">${analytic.week.remotes}</span> <span class="float-right badge bg-warning">${analytic.semester.remotes}</span> <span class="float-right badge bg-primary">${analytic.range.remotes}</span> <span class="float-right badge bg-success">${analytic.overall.remotes}</span>
                    </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Playlists <span class="float-right badge bg-danger">${analytic.week.playlists}</span> <span class="float-right badge bg-warning">${analytic.semester.playlists}</span> <span class="float-right badge bg-primary">${analytic.range.playlists}</span> <span class="float-right badge bg-success">${analytic.overall.playlists}</span>
                    </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Airtime (Hours) <span class="float-right badge bg-danger">${parseInt(analytic.week.showtime / 60)}</span> <span class="float-right badge bg-warning">${parseInt(analytic.semester.showtime / 60)}</span> <span class="float-right badge bg-primary">${parseInt(analytic.range.showtime / 60)}</span> <span class="float-right badge bg-success">${parseInt(analytic.overall.showtime / 60)}</span>
                    </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Online Listeners (Hours) <span class="float-right badge bg-danger">${parseInt(analytic.week.listeners / 60)}</span> <span class="float-right badge bg-warning">${parseInt(analytic.semester.listeners / 60)}</span> <span class="float-right badge bg-primary">${parseInt(analytic.range.listeners / 60)}</span> <span class="float-right badge bg-success">${parseInt(analytic.overall.listeners / 60)}</span>
                    </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Messages Sent / Received <span class="float-right badge bg-danger">${analytic.week.messages}</span> <span class="float-right badge bg-warning">${analytic.semester.messages}</span> <span class="float-right badge bg-primary">${analytic.range.messages}</span> <span class="float-right badge bg-success">${analytic.overall.messages}</span>
                    </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Remote Credits Earned <span class="float-right badge bg-danger">${analytic.week.remoteCredits}</span> <span class="float-right badge bg-warning">${analytic.semester.remoteCredits}</span> <span class="float-right badge bg-primary">${analytic.range.remoteCredits}</span> <span class="float-right badge bg-success">${analytic.overall.remoteCredits}</span>
                    </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Show Starts > 5 minutes early <span class="float-right badge bg-danger">${analytic.week.earlyStart}</span> <span class="float-right badge bg-warning">${analytic.semester.earlyStart}</span> <span class="float-right badge bg-primary">${analytic.range.earlyStart}</span> <span class="float-right badge bg-success">${analytic.overall.earlyStart}</span>
                    </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Show Starts > 10 minutes late <span class="float-right badge bg-danger">${analytic.week.lateStart}</span> <span class="float-right badge bg-warning">${analytic.semester.lateStart}</span> <span class="float-right badge bg-primary">${analytic.range.lateStart}</span> <span class="float-right badge bg-success">${analytic.overall.lateStart}</span>
                    </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Show Ends > 10 minutes early <span class="float-right badge bg-danger">${analytic.week.earlyEnd}</span> <span class="float-right badge bg-warning">${analytic.semester.earlyEnd}</span> <span class="float-right badge bg-primary">${analytic.range.earlyEnd}</span> <span class="float-right badge bg-success">${analytic.overall.earlyEnd}</span>
                    </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Show Ends > 5 minutes late <span class="float-right badge bg-danger">${analytic.week.lateEnd}</span> <span class="float-right badge bg-warning">${analytic.semester.lateEnd}</span> <span class="float-right badge bg-primary">${analytic.range.lateEnd}</span> <span class="float-right badge bg-success">${analytic.overall.lateEnd}</span>
                    </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Absences / No-Shows <span class="float-right badge bg-danger">${analytic.week.absences}</span> <span class="float-right badge bg-warning">${analytic.semester.absences}</span> <span class="float-right badge bg-primary">${analytic.range.absences}</span> <span class="float-right badge bg-success">${analytic.overall.absences}</span>
                    </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Cancellations <span class="float-right badge bg-danger">${analytic.week.cancellations}</span> <span class="float-right badge bg-warning">${analytic.semester.cancellations}</span> <span class="float-right badge bg-primary">${analytic.range.cancellations}</span> <span class="float-right badge bg-success">${analytic.overall.cancellations}</span>
                    </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Missed Top-of-hour IDs <span class="float-right badge bg-danger">${analytic.week.missedIDs}</span> <span class="float-right badge bg-warning">${analytic.semester.missedIDs}</span> <span class="float-right badge bg-primary">${analytic.range.missedIDs}</span> <span class="float-right badge bg-success">${analytic.overall.missedIDs}</span>
                    </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Silence Alarms <span class="float-right badge bg-danger">${analytic.week.silences}</span> <span class="float-right badge bg-warning">${analytic.semester.silences}</span> <span class="float-right badge bg-primary">${analytic.range.silences}</span> <span class="float-right badge bg-success">${analytic.overall.silences}</span>
                    </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Reputation Score (out of 100) <span class="float-right badge bg-danger">${parseInt(analytic.week.reputationPercent)}</span> <span class="float-right badge bg-warning">${parseInt(analytic.semester.reputationPercent)}</span> <span class="float-right badge bg-primary">${parseInt(analytic.range.reputationPercent)}</span> <span class="float-right badge bg-success">${parseInt(analytic.overall.reputationPercent)}</span>
                    </div>
                </li>
              </ul>
            </div>
          </div>`;

            for (var show in analytics[ 1 ]) {
                if (show > 0) {
                    if (Object.prototype.hasOwnProperty.call(analytics[ 1 ], show)) {
                        var analytic = analytics[ 1 ][ show ];
                        html += `<div class="card card-widget widget-user-2 p-1">
            <div class="widget-user-header bg-secondary">
              <h3 class="widget-user-username">Show Analytics (${analytic.name})</h3>
              <h5 class="widget-user-desc"><span class="badge bg-success">Lifetime</span> <span class="badge bg-primary">365 days</span> <span class="badge bg-warning">Semester</span> <span class="badge bg-danger">Week</span></h5>
            </div>
            <div class="card-footer p-0">
              <ul class="nav flex-column">
                <li class="nav-item">
                  <div class="nav-link">
                    Shows <span class="float-right badge bg-danger">${analytic.week.shows}</span> <span class="float-right badge bg-warning">${analytic.semester.shows}</span> <span class="float-right badge bg-primary">${analytic.range.shows}</span> <span class="float-right badge bg-success">${analytic.overall.shows}</span>
                  </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Prerecords <span class="float-right badge bg-danger">${analytic.week.prerecords}</span> <span class="float-right badge bg-warning">${analytic.semester.prerecords}</span> <span class="float-right badge bg-primary">${analytic.range.prerecords}</span> <span class="float-right badge bg-success">${analytic.overall.prerecords}</span>
                    </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Remotes <span class="float-right badge bg-danger">${analytic.week.remotes}</span> <span class="float-right badge bg-warning">${analytic.semester.remotes}</span> <span class="float-right badge bg-primary">${analytic.range.remotes}</span> <span class="float-right badge bg-success">${analytic.overall.remotes}</span>
                    </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Playlists <span class="float-right badge bg-danger">${analytic.week.playlists}</span> <span class="float-right badge bg-warning">${analytic.semester.playlists}</span> <span class="float-right badge bg-primary">${analytic.range.playlists}</span> <span class="float-right badge bg-success">${analytic.overall.playlists}</span>
                    </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Airtime (Hours) <span class="float-right badge bg-danger">${parseInt(analytic.week.showtime / 60)}</span> <span class="float-right badge bg-warning">${parseInt(analytic.semester.showtime / 60)}</span> <span class="float-right badge bg-primary">${parseInt(analytic.range.showtime / 60)}</span> <span class="float-right badge bg-success">${parseInt(analytic.overall.showtime / 60)}</span>
                    </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Online Listeners (Hours) <span class="float-right badge bg-danger">${parseInt(analytic.week.listeners / 60)}</span> <span class="float-right badge bg-warning">${parseInt(analytic.semester.listeners / 60)}</span> <span class="float-right badge bg-primary">${parseInt(analytic.range.listeners / 60)}</span> <span class="float-right badge bg-success">${parseInt(analytic.overall.listeners / 60)}</span>
                    </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Messages Sent / Received <span class="float-right badge bg-danger">${analytic.week.messages}</span> <span class="float-right badge bg-warning">${analytic.semester.messages}</span> <span class="float-right badge bg-primary">${analytic.range.messages}</span> <span class="float-right badge bg-success">${analytic.overall.messages}</span>
                    </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Remote Credits Earned <span class="float-right badge bg-danger">${analytic.week.remoteCredits}</span> <span class="float-right badge bg-warning">${analytic.semester.remoteCredits}</span> <span class="float-right badge bg-primary">${analytic.range.remoteCredits}</span> <span class="float-right badge bg-success">${analytic.overall.remoteCredits}</span>
                    </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Show Starts > 5 minutes early <span class="float-right badge bg-danger">${analytic.week.earlyStart}</span> <span class="float-right badge bg-warning">${analytic.semester.earlyStart}</span> <span class="float-right badge bg-primary">${analytic.range.earlyStart}</span> <span class="float-right badge bg-success">${analytic.overall.earlyStart}</span>
                    </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Show Starts > 10 minutes late <span class="float-right badge bg-danger">${analytic.week.lateStart}</span> <span class="float-right badge bg-warning">${analytic.semester.lateStart}</span> <span class="float-right badge bg-primary">${analytic.range.lateStart}</span> <span class="float-right badge bg-success">${analytic.overall.lateStart}</span>
                    </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Show Ends > 10 minutes early <span class="float-right badge bg-danger">${analytic.week.earlyEnd}</span> <span class="float-right badge bg-warning">${analytic.semester.earlyEnd}</span> <span class="float-right badge bg-primary">${analytic.range.earlyEnd}</span> <span class="float-right badge bg-success">${analytic.overall.earlyEnd}</span>
                    </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Show Ends > 5 minutes late <span class="float-right badge bg-danger">${analytic.week.lateEnd}</span> <span class="float-right badge bg-warning">${analytic.semester.lateEnd}</span> <span class="float-right badge bg-primary">${analytic.range.lateEnd}</span> <span class="float-right badge bg-success">${analytic.overall.lateEnd}</span>
                    </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Absences / No-Shows <span class="float-right badge bg-danger">${analytic.week.absences}</span> <span class="float-right badge bg-warning">${analytic.semester.absences}</span> <span class="float-right badge bg-primary">${analytic.range.absences}</span> <span class="float-right badge bg-success">${analytic.overall.absences}</span>
                    </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Cancellations <span class="float-right badge bg-danger">${analytic.week.cancellations}</span> <span class="float-right badge bg-warning">${analytic.semester.cancellations}</span> <span class="float-right badge bg-primary">${analytic.range.cancellations}</span> <span class="float-right badge bg-success">${analytic.overall.cancellations}</span>
                    </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Missed Top-of-hour IDs <span class="float-right badge bg-danger">${analytic.week.missedIDs}</span> <span class="float-right badge bg-warning">${analytic.semester.missedIDs}</span> <span class="float-right badge bg-primary">${analytic.range.missedIDs}</span> <span class="float-right badge bg-success">${analytic.overall.missedIDs}</span>
                    </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Silence Alarms <span class="float-right badge bg-danger">${analytic.week.silences}</span> <span class="float-right badge bg-warning">${analytic.semester.silences}</span> <span class="float-right badge bg-primary">${analytic.range.silences}</span> <span class="float-right badge bg-success">${analytic.overall.silences}</span>
                    </div>
                </li>
                <li class="nav-item">
                <div class="nav-link">
                    Reputation Score (out of 100) <span class="float-right badge bg-danger">${parseInt(analytic.week.reputationPercent)}</span> <span class="float-right badge bg-warning">${parseInt(analytic.semester.reputationPercent)}</span> <span class="float-right badge bg-primary">${parseInt(analytic.range.reputationPercent)}</span> <span class="float-right badge bg-success">${parseInt(analytic.overall.reputationPercent)}</span>
                    </div>
                </li>
              </ul>
            </div>
          </div>`;
                    }
                }
            }
            this.djModal.body = html;
        });
    }

    /**
     * Show attendance records for the provided DJ in a modal
     * 
     * @param {object} dj The DJ record to view attendance records
     */
    showDJLogs (dj) {
        var util = new WWSUutil();

        this.djModal.title = `Attendance Logs for ${dj.name} (${dj.realName || `Unknown Person`})`;
        this.djModal.body = `<table id="section-djs-table-logs" class="table table-striped display responsive" style="width: 100%;"></table>`;
        this.djModal.iziModal('open');

        util.waitForElement(`#section-djs-table-logs`, () => {
            this.logs.getAttendance(`#modal-${this.djModal.id}`, { dj: dj.ID }, (logs) => {
                this.tables.attendance = $(`#section-djs-table-logs`).DataTable({
                    paging: true,
                    data: logs.map((record) => {
                        var theDate
                        if (record.actualStart !== null) {
                            theDate = moment(record.actualStart)
                        } else {
                            theDate = moment(record.scheduledStart)
                        }
                        var theClass = 'secondary'
                        if (record.event.toLowerCase().startsWith('show: ') || record.event.toLowerCase().startsWith('prerecord: ')) {
                            theClass = 'danger'
                        } else if (record.event.toLowerCase().startsWith('sports: ')) {
                            theClass = 'success'
                        } else if (record.event.toLowerCase().startsWith('remote: ')) {
                            theClass = 'purple'
                        } else if (record.event.toLowerCase().startsWith('genre: ') || record.event.toLowerCase().startsWith('playlist: ')) {
                            theClass = 'primary'
                        }
                        if (record.actualStart !== null && record.actualEnd !== null && record.happened === 1) {
                            return [
                                record.ID,
                                moment(record.actualStart).format('L'),
                                `<span class="text-${theClass}"><i class="fas fa-dot-circle"></i></span>`,
                                record.event,
                                moment(record.actualStart).format('h:mm A'),
                                moment(record.actualEnd).format('h:mm A'),
                                `<button class="btn btn-sm btn-primary btn-logs-view" data-id="${record.ID}" title="View this log"><i class="fas fa-eye"></i></button>`
                            ];
                        } else if (record.actualStart !== null && record.actualEnd === null && record.happened === 1) {
                            return [
                                record.ID,
                                moment(record.actualStart).format('L'),
                                `<span class="text-${theClass}"><i class="fas fa-dot-circle"></i></span>`,
                                record.event,
                                moment(record.actualStart).format('h:mm A'),
                                `ONGOING`,
                                `<button class="btn btn-sm btn-primary btn-logs-view" data-id="${record.ID}" title="View this log"><i class="fas fa-eye"></i></button>`
                            ];
                        } else if (record.actualStart === null && record.actualEnd === null && record.happened === -1) {
                            return [
                                record.ID,
                                moment(record.scheduledStart).format('L'),
                                `<span class="text-${theClass}"><i class="fas fa-dot-circle"></i></span>`,
                                record.event,
                                `CANCELED (${moment(record.scheduledStart).format('h:mm A')})`,
                                `CANCELED (${moment(record.scheduledEnd).format('h:mm A')})`,
                                ``
                            ];
                        } else if (record.actualStart === null && record.actualEnd === null && record.happened === 0) {
                            return [
                                record.ID,
                                moment(record.scheduledStart).format('L'),
                                `<span class="text-${theClass}"><i class="fas fa-dot-circle"></i></span>`,
                                record.event,
                                `ABSENT (${moment(record.scheduledStart).format('h:mm A')})`,
                                `ABSENT (${moment(record.scheduledEnd).format('h:mm A')})`,
                                ``
                            ];
                        } else if (record.actualStart !== null && record.actualEnd !== null) {
                            return [
                                record.ID,
                                moment(record.actualStart).format('L'),
                                `<span class="text-${theClass}"><i class="fas fa-dot-circle"></i></span>`,
                                record.event,
                                moment(record.actualStart).format('h:mm A'),
                                record.actualEnd !== null ? moment(record.actualEnd).format('h:mm A') : `ONGOING`,
                                `<button class="btn btn-sm btn-primary btn-logs-view" data-id="${record.ID}" title="View this log"><i class="fas fa-eye"></i></button>`
                            ];
                        } else {
                            return [
                                record.ID,
                                moment(record.scheduledStart).format('L'),
                                `<span class="text-${theClass}"><i class="fas fa-dot-circle"></i></span>`,
                                record.event,
                                `SCHEDULED (${moment(record.scheduledStart).format('h:mm A')})`,
                                `SCHEDULED (${moment(record.scheduledEnd).format('h:mm A')})`,
                                ``
                            ];
                        }
                    }),
                    columns: [
                        { title: "ID" },
                        { title: "Date" },
                        { title: "Icon" },
                        { title: "Event" },
                        { title: "Start" },
                        { title: "End" },
                        { title: "Actions" },
                    ],
                    columnDefs: [
                        { responsivePriority: 1, targets: 6 },
                    ],
                    "order": [ [ 0, "desc" ] ],
                    pageLength: 25,
                    drawCallback: () => {
                        // Add log buttons click event
                        $('.btn-logs-view').unbind('click');
                        $('.btn-logs-view').click((e) => {
                            var id = parseInt($(e.currentTarget).data('id'));
                            this.logs.viewLog(id);
                        })
                    }
                });
            });
        });
    }
}