/* global Peer */

window.AudioContext = window.AudioContext || window.webkitAudioContext
var { ipcRenderer } = require('electron')
var settings = require('electron-settings')
const EventEmitter = require('events')

var Meta = { state: 'unknown', playing: false }
var peer
window.peerStream = undefined
window.peerDevice = undefined
window.peerHost = undefined
window.peerError = 0
window.peerGoodBitrate = 0
window.peerErrorBitrate = 0
window.peerErrorMajor = 0
window.peerVolume = -100
var outgoingCall
var outgoingCallMeter
var outgoingCallAudioMeter
var pendingCall
var bitRate = 128
var incomingCall
var incomingCallPending
var incomingCallMeter
var incomingCallAudioTimer
var analyserStream
var analyserStream0
var analyserDest
var callTimer
var callTimerSlot
var callDropTimer
var lastProcess = window.performance.now()
var silenceState
var silenceTimer
var silenceState0
var silenceTimer0
var outgoingCloseIgnore = false
var incomingCloseIgnore = false

var audioContext = new AudioContext()
var gain = audioContext.createGain()
var limiter = audioContext.createDynamicsCompressor()
gain.gain.value = 1.2
limiter.threshold.value = -18.0
limiter.knee.value = 18.0
limiter.ratio.value = 4.0
limiter.attack.value = 0.01
limiter.release.value = 0.05

var audioContext0 = new AudioContext()

var rtcStats = 1000
var prevPLC = 0

var tryingCall
var waitingFor
ipcRenderer.send('main-log', 'Peer renderer is ready.')
ipcRenderer.send('peer-ready', null)
sinkAudio()

ipcRenderer.on('new-meta', (event, arg) => {
  for (var key in arg) {
    if (Object.prototype.hasOwnProperty.call(arg, key)) {
      Meta[key] = arg[key]
    }
  }

  // Do stuff if the state changed
  if (typeof arg.state !== 'undefined' || typeof arg.playing !== 'undefined') {
    // Disconnect outgoing calls on automation and halftime break
    if (Meta.state === 'sportsremote_halftime' || Meta.state === 'automation_on' || Meta.state === 'automation_break' || Meta.state === 'automation_genre' || Meta.state === 'automation_playlist' || Meta.state === 'automation_prerecord' || Meta.state.startsWith('live_') || Meta.state.startsWith('sports_') || Meta.state.startsWith('prerecord_')) {
      try {
        console.log(`Closing outgoing call via meta`)
        if (Meta.state !== 'sportsremote_halftime') { window.peerHost = undefined }
        outgoingCloseIgnore = true
        if (outgoingCall) {
          outgoingCall.close()
          outgoingCall = undefined
        }
        outgoingCloseIgnore = false
      } catch (eee) {
        outgoingCloseIgnore = false
      }

      try {
        incomingCloseIgnore = true
        console.log(`Closing incoming call via meta`)
        if (incomingCall) {
          incomingCall.close()
          incomingCall = undefined
        }
        if (incomingCallMeter) {
          incomingCallMeter.shutdown()
          incomingCallMeter = undefined
        }
        var audio = document.querySelector('#remoteAudio')
        audio.srcObject = undefined
        audio.pause()
        incomingCloseIgnore = false
      } catch (eee) {
        incomingCloseIgnore = false
      }
    }

    var temp = document.querySelector(`#remoteAudio`)
    // Mute incoming audio if something is playing
    if (Meta.state.startsWith('remote_') || Meta.state.startsWith('sportsremote_')) {
      if (!Meta.playing && (Meta.state === 'remote_on' || Meta.state === 'sportsremote_on')) {
        if (temp !== null) {
          temp.muted = false
          console.log(`UNMUTED remote audio`)
          window.peerErrorMajor = 0
        }
      } else {
        if (temp !== null) {
          temp.muted = true
          console.log(`MUTED remote audio`)
        }
      }

      // Mute audio and reset bitrate if not in any sportremote nor remote state
    } else {
      if (temp !== null) {
        bitRate = 128
        temp.muted = true
        console.log(`MUTED remote audio`)
        window.peerError = 0
        window.peerErrorMajor = 0
        window.peerErrorBitrate = 0
      }
    }
  }

  // Just in case another DJ Controls resumes a remote broadcast, detect this and resume the outgoing audio call if it is disconnected
  if (typeof arg.state !== 'undefined' && (arg.state === 'remote_returning' || arg.state === 'sportsremote_returning') && window.peerHost && typeof outgoingCall === 'undefined') {
    startCall(window.peerHost, false, false, bitRate)
  }

  // Just in case another DJ Controls started a break, check for better bitrate.
  if (typeof arg.state !== 'undefined' && (arg.state === 'remote_break' || arg.state === 'sportsremote_break') && window.peerHost) {
    if (bitRate < 128 && window.peerGoodBitrate >= 300) {
      window.peerGoodBitrate = 0
      ipcRenderer.send(`peer-bad-call-send`, bitRate + 32)
    }
  }
})

ipcRenderer.on('peer-try-calls', (event, arg) => {
  console.log(`If trying a call, try again.`)
  if (tryingCall && tryingCall.host) {
    startCall(tryingCall.host, false, false, bitRate)
  }
})

ipcRenderer.on('peer-stop-trying', (event, arg) => {
  console.log(`Main wants us to abort trying the call.`)
  waitingFor = undefined
  tryingCall = undefined
})

ipcRenderer.on('peer-change-input-device', (event, arg) => {
  console.log(`Main wants us to change to audio input device ${arg}`)
  getAudio(arg)
})

ipcRenderer.on('peer-change-output-device', (event, arg) => {
  console.log(`Main wants us to change to audio output device ${arg}`)
  sinkAudio(arg)
})

ipcRenderer.on('peer-answer-call', (event, arg) => {
  console.log(`Main told us we can answer the incoming call. Answering at bitrate ${bitRate} kbps.`)
  try {
    // Close any other active incoming calls
    incomingCloseIgnore = true
    if (incomingCall) {
      incomingCall.close()
      incomingCall = undefined
    }
    if (incomingCallMeter) {
      incomingCallMeter.shutdown()
      incomingCallMeter = undefined
    }

    var audio = document.querySelector('#remoteAudio')
    audio.srcObject = undefined
    audio.pause()
    incomingCloseIgnore = false
  } catch (ee) {
    incomingCloseIgnore = false
    // Ignore errors
  }
  incomingCall = incomingCallPending
  incomingCall.answer(new MediaStream(), {
    audioBandwidth: bitRate,
    audioReceiveEnabled: true
  })
  clearTimeout(callDropTimer)
  if (!Meta.state.startsWith('remote_') && !Meta.state.startsWith('sportsremote_')) {
    console.log(`Checking for audio on stream`)
    incomingCallAudioTimer = setTimeout(() => {
      try {
        incomingCloseIgnore = true
        console.log(`Closing incoming call; no audio`)
        if (incomingCall) {
          incomingCall.close()
          incomingCall = undefined
        }
        if (incomingCallMeter) {
          incomingCallMeter.shutdown()
          incomingCallMeter = undefined
        }
        var audio = document.querySelector('#remoteAudio')
        audio.srcObject = undefined
        audio.pause()
        incomingCloseIgnore = false
      } catch (eee) {
        incomingCloseIgnore = false
      }
      ipcRenderer.send('main-log', 'Peer: Incoming call closed; no audio received.')
      ipcRenderer.send('peer-finalize-incoming', false)
    }, 3000)
  } else {
    ipcRenderer.send('main-log', 'Peer: Audio detected on incoming call.')
    ipcRenderer.send('peer-finalize-incoming', true)
  }
  incomingCall.on('stream', onReceiveStream)
  incomingCall.on(`close`, () => {
    console.log(`CALL CLOSED.`)
    if (incomingCall) {
      incomingCall = undefined
    }
    if (incomingCallMeter) {
      incomingCallMeter.shutdown()
      incomingCallMeter = undefined
    }
    var audio = document.querySelector('#remoteAudio')
    audio.srcObject = undefined
    audio.pause()

    if (!incomingCloseIgnore) {
      console.log(`This was premature!`)
      window.peerError = -1
      var callDropFn = () => {
        if (typeof incomingCall !== `undefined` && incomingCall.open) {
          console.log(`Incoming call was re-established. Stopping the checks.`)
        } else if (!Meta.playing && (Meta.state === 'sportsremote_on' || Meta.state === 'remote_on')) {
          console.log(`Since nothing else is playing, sending system into break!`)
          ipcRenderer.send('main-log', 'Peer: Incoming call prematurely terminated. Send system into break.')
          ipcRenderer.send('peer-bail-break', null)
          window.peerError = -2
        } else if (Meta.state === 'remote_on' || Meta.state === 'sportsremote_on' || Meta.state === 'automation_sportsremote' || Meta.state === 'automation_remote' || Meta.state === 'sportsremote_returning' || Meta.state === 'remote_returning' || Meta.state === 'remote_break' || Meta.state === 'sportsremote_break') {
          console.log(`Something else is playing in RadioDJ, so ignore for now and check again in 10 seconds.`)
          window.peerError = -2
          callDropTimer = setTimeout(() => {
            callDropFn()
          }, 10000)
        } else {
          console.log(`Stopping checks; we are not actually supposed to be in a call right now.`)
          window.peerError = 0
        }
        ipcRenderer.send(`peer-audio-info-incoming`, [0, false, window.peerError, typeof tryingCall !== `undefined`, typeof outgoingCall !== `undefined`, typeof incomingCall !== `undefined`])
      }
      callDropFn()
    } else {
      window.peerError = 0
      ipcRenderer.send(`peer-audio-info-incoming`, [0, false, 0, typeof tryingCall !== `undefined`, typeof outgoingCall !== `undefined`, typeof incomingCall !== `undefined`])
    }
    incomingCloseIgnore = false
  })
})

ipcRenderer.on('peer-start-call', (event, arg) => {
  console.log(`Main wants to start a call with ${arg[0]}.`)
  console.dir(arg[1])
  startCall(arg[0], arg[1] || false, !arg[1] || true, arg[2] || bitRate)
})

ipcRenderer.on('peer-check-better-bitrate', (event, arg) => {
  console.log(`Main wants peer to check if it can increase the bitrate.`)
  if (bitRate < 128 && window.peerGoodBitrate >= 300 && (Meta.state.startsWith('remote_') || Meta.state.startsWith('sportsremote_'))) {
    window.peerGoodBitrate = 0
    ipcRenderer.send(`peer-bad-call-send`, bitRate + 32)
  }
})

ipcRenderer.on('peer-set-bitrate', (event, arg) => {
  console.log(`Main wants us to set the bitrate to ${arg} kbps.`)
  bitRate = arg
})

ipcRenderer.on('peer-check-waiting', (event, arg) => {
  if (waitingFor && waitingFor.host === arg[0].host && arg[0].peer !== null && (!arg[1] || arg[1] === null || typeof arg[1].host === `undefined` || arg[1].peer !== arg[0].peer)) { startCall(waitingFor.host, true, false, bitRate) }
})

ipcRenderer.on('peer-bad-call', (event, arg) => {
  if (typeof outgoingCall !== `undefined`) {
    console.log(`Main says the connection on the other end is bad. Restarting call with bitrate ${arg} kbps.`)
    try {
      window.peerError = 0
      outgoingCloseIgnore = true
      if (outgoingCall) {
        outgoingCall.close()
        outgoingCall = undefined
      }
      outgoingCloseIgnore = false
    } catch (e) {
      outgoingCloseIgnore = false
    }
    if (typeof window.peerHost !== `undefined`) {
      window.peerError = -1
      startCall(window.peerHost, true, false, arg)
    }
  }
})

ipcRenderer.on('peer-very-bad-call', (event, arg) => {
  if (typeof outgoingCall !== `undefined`) {
    console.log(`Main says the connection on the other end is very bad. Bailing the call.`)
    try {
      window.peerError = -2
      outgoingCloseIgnore = true
      if (outgoingCall) {
        outgoingCall.close()
        outgoingCall = undefined
      }
      outgoingCloseIgnore = false
    } catch (e) {
      outgoingCloseIgnore = false
    }

    ipcRenderer.send('main-log', 'Peer: Outgoing audio call is too poor to continue. Bailed the call.')
    ipcRenderer.send('peer-very-bad-call-notify', null)

    // Reset bitRate to 96kbps as a mid-point starter for when the broadcast resumes.
    bitRate = 96
  }
})

ipcRenderer.on('peer-silent-call', (event, arg) => {
  if (typeof outgoingCall !== `undefined`) {
    console.log(`Main says the other end reported silence on the audio call. Bailing the call.`)
    try {
      window.peerError = -2
      outgoingCloseIgnore = true
      if (outgoingCall) {
        outgoingCall.close()
        outgoingCall = undefined
      }
      outgoingCloseIgnore = false
    } catch (e) {
      outgoingCloseIgnore = false
    }

    ipcRenderer.send('main-log', 'Peer: No audio on input device. Aborting the call.')
    ipcRenderer.send('peer-silent-call-notify', null)
  }
})

ipcRenderer.on('peer-finalize-call', (event, arg) => {
  if (!arg && Meta.state !== 'remote_on' && Meta.state !== 'sportsremote_on') {
    if (typeof outgoingCall !== `undefined`) {
      console.log(`Main says the other end reported silence on the audio call. Aborting the call.`)
      try {
        window.peerError = -2
        outgoingCloseIgnore = true
        if (outgoingCall) {
          outgoingCall.close()
          outgoingCall = undefined
        }
        outgoingCloseIgnore = false
      } catch (e) {
        outgoingCloseIgnore = false
      }
      ipcRenderer.send('main-log', 'Peer: Host receiving the audio call reported no audio. Bailing the call.')
      ipcRenderer.send('peer-no-audio-incoming-notify', false)
    }
  } else {
    ipcRenderer.send('main-log', 'Peer: Audio is good; the call was successfully established.')
    ipcRenderer.send(`peer-connected-call`, null)
    clearInterval(callTimer)
    tryingCall = undefined
    window.peerError = 0
  }
})

ipcRenderer.on('peer-resume-call', (event, arg) => {
  console.log(`Main wants us to resume any calls on hold.`)
  if (typeof window.peerHost !== `undefined` && typeof outgoingCall === `undefined`) {
    if (window.peerDevice) { getAudio(window.peerDevice) }
    startCall(window.peerHost, false, true, bitRate)
  } else {
    console.log(`There are no calls on hold.`)
    ipcRenderer.send('main-log', 'Peer: No pending calls to resume.')
    ipcRenderer.send('peer-no-calls', null)
  }
})

ipcRenderer.on('peer-host-info', (event, arg) => {
  console.log(`Received host information.`)
  if (pendingCall) { _startCall(pendingCall.hostID, arg[0], arg[1], pendingCall.reconnect, pendingCall.bitrate) }
  pendingCall = undefined
})

ipcRenderer.on('peer-reregister', (event, arg) => {
  console.log(`Main wants the current peer ID to be reregistered.`)
  if (peer && peer.id && peer.open) {
    ipcRenderer.send('main-log', `Peer: Re-register with the ID ${peer.id}`)
    ipcRenderer.send('peer-register', peer.id)
  } else {
    setupPeer()
  }
})

function setupPeer () {
  try {
    peer.destroy()
    peer = undefined
  } catch (ee) {
    // Ignore errors
  }

  peer = new Peer({
    key: '71595709-5af2-4cc5-ac02-12044749ae90',
    debug: 3
  })

  peer.on('open', (id) => {
    console.log(`peer opened with id ${id}`)
    // Update database with the peer ID
    ipcRenderer.send('main-log', `Peer: Register with the ID ${id}`)
    ipcRenderer.send('peer-register', id)
  })

  peer.on('error', (err) => {
    console.error(err)
    if (err.type === `peer-unavailable`) {
      ipcRenderer.send('main-log', 'Peer: Call aborted; the host being called is unavailable.')
      ipcRenderer.send('peer-unavailable', tryingCall)
      try {
        waitingFor = tryingCall
        clearInterval(callTimer)
        outgoingCloseIgnore = true
        console.log(`Closing call via peer-unavailable`)
        outgoingCall.close()
        outgoingCall = undefined
        outgoingCloseIgnore = false
      } catch (ee) {
        outgoingCloseIgnore = false
      }
    }
  })

  peer.on(`disconnected`, () => {
    setTimeout(() => {
      if (peer && !peer.destroyed) {
        peer.reconnect()
      } else {
        setupPeer()
      }
    }, 5000)
  })

  peer.on('close', () => {
    console.log(`Peer destroyed.`)
    try {
      peer = undefined
      ipcRenderer.send('main-log', 'Peer: Peer was destroyed.')
      ipcRenderer.send('peer-register', null)
    } catch (ee) {

    }
    setTimeout(() => {
      if (!peer || peer.destroyed) { setupPeer() }
    }, 5000)
  })

  peer.on('call', (connection) => {
    console.log(`Incoming call from ${connection.peer}`)
    incomingCallPending = connection
    ipcRenderer.send('main-log', `Peer: Incoming call from ${connection.peer}`)
    ipcRenderer.send('peer-incoming-call', connection.peer)
  })
}

function onReceiveStream (stream) {
  console.log(`received stream`)
  var audio = document.querySelector('#remoteAudio')
  audio.srcObject = stream
  audio.load()
  audio.oncanplay = function (e) {
    audio.play()
  }
  window.peerError = 0
  var quality = 100
  if (bitRate <= 96 && bitRate > 64) {
    quality -= 33
  } else if (bitRate <= 64) {
    quality -= 66
  }
  ipcRenderer.send(`peer-call-quality`, quality)
  incomingCallMeter = createAudioMeter(audioContext0)
  analyserStream0 = audioContext0.createMediaStreamSource(stream)
  analyserStream0.connect(incomingCallMeter)
  lastProcess = window.performance.now()
  incomingCallMeter.events.on(`volume-processed`, (volume, clipping, maxVolume) => {
    if (typeof incomingCall !== 'undefined') {
      // Silence detection
      if (maxVolume < 0.01 && (Meta.state === 'remote_on' || Meta.state === 'sportsremote_on')) {
        if (silenceState0 === 0 || silenceState0 === -1) {
          silenceState0 = 1
          silenceTimer0 = setTimeout(function () {
            if (typeof incomingCall !== 'undefined') {
              silenceState0 = 2
              ipcRenderer.send('main-log', 'Peer: Silence detected on call for 13 seconds.')
              ipcRenderer.send(`peer-silence-incoming`, true)
              try {
                incomingCloseIgnore = true
                console.log(`Closing incoming call via meta`)
                if (incomingCall) {
                  incomingCall.close()
                  incomingCall = undefined
                }
                if (incomingCallMeter) {
                  incomingCallMeter.shutdown()
                  incomingCallMeter = undefined
                }
                var audio = document.querySelector('#remoteAudio')
                audio.srcObject = undefined
                audio.pause()
                incomingCloseIgnore = false
              } catch (eee) {
                incomingCloseIgnore = false
              }
            }
          }, 13000)
        }
      } else {
        silenceState0 = 0
        clearTimeout(silenceTimer0)
      }

      if (maxVolume >= 0.01) {
        if (incomingCallAudioTimer) {
          console.log(`Audio detected.`)
          clearTimeout(incomingCallAudioTimer)
          incomingCallAudioTimer = undefined
          ipcRenderer.send('main-log', 'Peer: Audio detected on the call. Proceeding with the connection.')
          ipcRenderer.send('peer-finalize-incoming', true)
        }
      }

      // Check for glitches in audio every second; we want to send a bad-call event to restart the call if there are too many of them.
      rtcStats -= (window.performance.now() - lastProcess)
      lastProcess = window.performance.now()
      if (rtcStats <= 0) {
        rtcStats = 1000
        var connections = peer.connections
        for (var connection in connections) {
          // if (connections.hasOwnProperty(connection))
          // {
          if (connections[connection].length > 0) {
            connections[connection].map((connectionObject) => {
              // console.dir(connectionObject);
              try {
                connectionObject._negotiator._pc.getStats(function callback (connStats) {
                  var rtcStatsReports = connStats.result()
                  rtcStatsReports
                    .filter((stat) => stat.type === `ssrc`)
                    .map((stat, index) => {
                      var properties = stat.names()
                      properties
                        .filter((property) => property === `googDecodingPLC`)
                        .map((property) => {
                          var value = stat.stat(property)

                          var checkPeerError = () => {
                            // When error exceeds a certain threshold, that is a problem!
                            if (window.peerError >= 30) {
                              // Send the system into break if we are in 64kbps and still having audio issues.
                              if (window.peerErrorMajor >= 30 && (Meta.state === 'remote_on' || Meta.state === 'sportsremote_on') && !Meta.playing) {
                                window.peerErrorMajor = 0
                                console.log(`Audio call remains choppy even on the lowest allowed bitrate of 64kbps. Giving up by sending the system into break.`)
                                ipcRenderer.send('main-log', 'Peer: Call is very poor. Asking outgoing host to bail to break.')
                                ipcRenderer.send(`peer-very-bad-call-send`, 96)
                                window.peerError = -2
                                // Reset bitRate to 96kbps as a mid-point starter for when the broadcast resumes.
                                bitRate = 96
                              } else {
                                // Do not contribute to the possibility of giving up the audio call unless we are on the minimum allowed bitrate of 64kbps.
                                if (bitRate <= 64) { window.peerErrorMajor += 15 }

                                console.log(`Audio choppiness threshold exceeded! Requesting call restart.`)

                                // Reduce the bitrate by 32kbps (with a minimum allowed of 64kbps) if we reach the choppy threshold multiple times in 15-30 seconds.
                                if (window.peerErrorBitrate > 0 && bitRate >= 96) {
                                  bitRate -= 32
                                  console.log(`Also requesting a lower bitrate: ${bitRate} kbps.`)
                                  window.peerErrorBitrate = 10
                                } else {
                                  window.peerErrorBitrate = 30
                                }

                                // Reset the good bitrate counter; we are not having a good connection.
                                window.peerGoodBitrate = 0

                                ipcRenderer.send('main-log', `Peer: Call is poor. Asking outgoing host to restart the call with ${bitRate} kbps.`)
                                ipcRenderer.send(`peer-bad-call-send`, bitRate)

                                window.peerError = -1
                              }
                            }

                            // Calculate call quality
                            var quality = 100
                            if (bitRate <= 96 && bitRate > 64) {
                              quality -= 33
                            } else if (bitRate <= 64) {
                              quality -= 66
                            }
                            quality -= Math.floor((window.peerError / 30) * 33)
                            if (quality < 0) { quality = 0 }
                            ipcRenderer.send(`peer-call-quality`, quality)
                          }

                          // Choppiness was detected in the last second
                          if (value > prevPLC) {
                            // Increase error counters and decrease good bitrate counter. Generally, we want the system to trigger call restarts when packet loss averages 4%+.
                            window.peerError += (value - prevPLC) / 2
                            window.peerGoodBitrate -= (value - prevPLC) / 2
                            ipcRenderer.send('main-log', `Peer: Choppy audio on call. Threshold to call restart: ${window.peerError}/30. Cool down: 1/second.`)
                            checkPeerError()
                            console.log(`Choppiness detected! Current threshold: ${window.peerError}/30`)

                          // Dead Silence because of networking issue (only count this against call quality if on the air)
                          } else if (maxVolume <= 0 && (Meta.state === 'remote_on' || Meta.state === 'sportsremote_on') && !Meta.playing) {
                            window.peerError += 5
                            window.peerGoodBitrate -= 5
                            ipcRenderer.send('main-log', `Peer: Dead silence on call. Threshold to call restart: ${window.peerError}/30. Cool down: 1/second.`)
                            checkPeerError()
                            // Connection was good in the last second. Lower any error counters and also increase the good bitrate counter
                          } else {
                            if (window.peerError > 0 && window.peerError <= 1) {
                              window.peerError -= 1
                              checkPeerError()
                            } else {
                              window.peerError -= 1
                            }
                            if (window.peerError < 0) { window.peerError = 0 }
                            window.peerErrorMajor -= 1
                            if (window.peerErrorMajor < 0) { window.peerErrorMajor = 0 }
                            window.peerErrorBitrate -= 1
                            if (window.peerErrorBitrate < 0) { window.peerErrorBitrate = 0 }
                            window.peerGoodBitrate += 1
                          }
                          prevPLC = value
                        })
                    })
                })
              } catch (e) {
              }
            })
          }
          // }
        }
      }
    }
    ipcRenderer.send(`peer-audio-info-incoming`, [maxVolume, clipping, window.peerError, typeof tryingCall !== `undefined`, typeof outgoingCall !== `undefined`, typeof incomingCall !== `undefined`])
  })
}

function startCall (hostID, reconnect = false, checkSilence = true, bitrate = bitRate) {
  pendingCall = { hostID: hostID, reconnect: reconnect, bitrate: bitrate }
  ipcRenderer.send('main-log', `Peer: Connecting a call with ${hostID}.`)
  ipcRenderer.send(`peer-connecting-call`, null)
  if (checkSilence) {
    console.log(`Checking for audio on device`)
    ipcRenderer.send('main-log', `Peer: Checking for audio on input device.`)
    outgoingCallAudioMeter = setTimeout(() => {
      console.log(`NO AUDIO on device!`)
      pendingCall = undefined
      ipcRenderer.send('main-log', `Peer: No audio on input device. Aborting the call connection attempt.`)
      ipcRenderer.send(`peer-no-audio-outgoing`, null)
    }, 3000)
  } else {
    ipcRenderer.send('main-log', `Peer: Requesting host info for ${pendingCall.hostID}`)
    ipcRenderer.send(`peer-get-host-info`, pendingCall.hostID)
  }
}

function _startCall (hostID, friendlyName, peerID, reconnect = false, bitrate = bitRate) {
  var callFailed = (keepTrying) => {
    try {
      outgoingCloseIgnore = true
      if (outgoingCall) {
        outgoingCall.close()
        outgoingCall = undefined
      }
      outgoingCloseIgnore = false
    } catch (eee) {
      outgoingCloseIgnore = false
      // ignore errors
    }

    if (!reconnect) {
      if (!keepTrying) {
        ipcRenderer.send('main-log', `Peer: No answer from ${friendlyName || hostID}. Call aborted.`)
        ipcRenderer.send(`peer-no-answer`, friendlyName || hostID)
      } else {
        ipcRenderer.send('main-log', `Peer: No answer from ${friendlyName || hostID}. Waiting until they connect.`)
        ipcRenderer.send(`peer-waiting-answer`, friendlyName || hostID)
        waitingFor = tryingCall
        clearInterval(callTimer)
      }
    } else {
      waitingFor = { host: hostID }
      ipcRenderer.send('main-log', `Peer: Aborted call.`)
      ipcRenderer.send(`peer-dropped-call`, null)
    }
  }

  tryingCall = { host: hostID, friendlyname: friendlyName }

  if (peerID === null) {
    callFailed(true)
    return null
  }

  try {
    // Terminate any existing outgoing calls first
    waitingFor = undefined
    outgoingCloseIgnore = true
    if (outgoingCall) {
      outgoingCall.close()
      outgoingCall = undefined
    }
    outgoingCloseIgnore = false
    clearInterval(callTimer)
  } catch (ee) {
    outgoingCloseIgnore = false
    // Ignore errors
  }

  window.peerHost = hostID
  bitRate = bitrate
  outgoingCall = peer.call(peerID, window.peerStream, {
    audioBandwidth: bitRate
  })
  outgoingCall.on(`close`, () => {
    console.log(`CALL CLOSED.`)
    // Premature close if we are still in remote or sportsremote state. Try to reconnect.
    outgoingCall = undefined

    if (!outgoingCloseIgnore) {
      console.log(`This was premature!`)
      if (!Meta.state.includes('_halftime') && (Meta.state.startsWith(`remote_`) || Meta.state.startsWith(`sportsremote_`) || Meta.state === `automation_remote` || Meta.state === `automation_sportsremote`)) {
        window.peerError = -1
        console.log(`Trying to re-connect...`)
        startCall(hostID, true, false, bitRate)
      } else {
        window.peerError = 0
        console.log(`NOT reconnecting; we are not supposed to be connected to the call at this time.`)
      }
    }
    ipcRenderer.send(`peer-audio-info-outgoing`, [0, false, window.peerError, typeof tryingCall !== `undefined`, typeof outgoingCall !== `undefined`, typeof incomingCall !== `undefined`])
    outgoingCloseIgnore = false
  })

  callTimerSlot = 10

  clearInterval(callTimer)
  callTimer = setInterval(() => {
    callTimerSlot -= 1

    if (callTimerSlot <= 1) {
      clearInterval(callTimer)
      callFailed(true)
    }
  }, 1000)
}

function getAudio (device) {
  console.log(`getting audio`)
  navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: device ? { exact: device } : undefined,
      echoCancellation: false,
      channelCount: 2
    },
    video: false
  })
    .then((stream) => {
      console.log(`getUserMedia initiated`)

      // Reset stuff
      try {
        limiter.disconnect(analyserDest)
        gain.disconnect(limiter)
        analyserStream.disconnect(gain)
        analyserDest = undefined
        analyserStream = undefined
        outgoingCallMeter.shutdown()
        outgoingCallMeter = undefined
        window.peerStream.getTracks().forEach(track => track.stop())
        window.peerStream = undefined
      } catch (eee) {
        console.error(eee)
      }

      gain.gain.value = 1.2
      analyserDest = audioContext.createMediaStreamDestination()
      analyserStream = audioContext.createMediaStreamSource(stream)
      analyserStream.connect(gain)
      gain.connect(limiter)
      limiter.connect(analyserDest)

      outgoingCallMeter = createAudioMeter(audioContext)
      gain.connect(outgoingCallMeter)
      outgoingCallMeter.events.on(`volume-processed`, (volume, clipping, maxVolume) => {
        // Gain control. Immediately decrease gain when above 0.9. Slowly increase gain if volume is less than 0.5.
        /*
                if (maxVolume >= 0.98)
                {

                    var volumeAtGain1 = maxVolume / gain.gain.value;
                    gain.gain.value = 0.95 / volumeAtGain1;

                } else if (maxVolume <= 0.75) {
                    var volumeAtGain1 = volume / gain.gain.value;
                    var proportion = 0.75 / volumeAtGain1;
                    var adjustGain = proportion / 512;
                    gain.gain.value += adjustGain;
                    if (gain.gain.value > 3)
                        gain.gain.value = 3;
                } else if (maxVolume > 0.75)
                {
                    var volumeAtGain1 = volume / gain.gain.value;
                    var proportion = 0.75 / volumeAtGain1;
                    var adjustGain = proportion / 512;
                    gain.gain.value -= adjustGain;
                    if (gain.gain.value > 3)
                        gain.gain.value = 3;
                }
                */

        // console.log(`Volume: ${maxVolume}, gain: ${gain.gain.value}`);

        // Silence detection
        if (maxVolume <= 0.01 && (Meta.state === 'remote_on' || Meta.state === 'sportsremote_on')) {
          if (silenceState === 0 || silenceState === -1) {
            silenceState = 1
            silenceTimer = setTimeout(function () {
              if (typeof outgoingCall !== 'undefined') {
                silenceState = 2
                ipcRenderer.send('main-log', `Peer: Silence detected on the input device for 13 seconds. Going to break.`)
                ipcRenderer.send(`peer-silence-outgoing`, true)
                try {
                  window.peerError = -2
                  outgoingCloseIgnore = true
                  if (outgoingCall) {
                    outgoingCall.close()
                    outgoingCall = undefined
                  }
                  outgoingCloseIgnore = false
                } catch (e) {
                  outgoingCloseIgnore = false
                }
              }
            }, 13000)
          }
        } else {
          silenceState = 0
          clearTimeout(silenceTimer)
        }

        if (maxVolume >= 0.01) {
          if (outgoingCallAudioMeter) {
            console.log(`Audio detected.`)
            clearTimeout(outgoingCallAudioMeter)
            outgoingCallAudioMeter = undefined
            ipcRenderer.send('main-log', `Peer: Audio detected on input device. Getting host info for ${pendingCall.hostID}.`)
            ipcRenderer.send(`peer-get-host-info`, pendingCall.hostID)
          }
        }

        ipcRenderer.send(`peer-audio-info-outgoing`, [maxVolume, clipping, window.peerError, typeof tryingCall !== `undefined`, typeof outgoingCall !== `undefined`, typeof incomingCall !== `undefined`])
      })

      if (outgoingCall) { outgoingCall.replaceStream(stream) }

      window.peerStream = analyserDest.stream
      // window.peerStream = stream;
      window.peerDevice = device
      window.peerVolume = -100
    })
    .catch((err) => {
      console.error(err)
      ipcRenderer.send('main-log', `Peer: Input device error. ${err}`)
      ipcRenderer.send(`peer-device-input-error`, err)
    })
}

function sinkAudio (device) {
  var temp = document.querySelector(`#remoteAudio`)
  if (temp !== null) {
    if (typeof device !== 'undefined') {
      temp.setSinkId(device)
        .then(() => {
          settings.set(`audio.output.call`, device)
        })
        .catch((err) => {
          ipcRenderer.send('main-log', `Peer: Output device error. ${err}`)
          ipcRenderer.send(`peer-device-output-error`, err)
        })
    } else {
      temp.setSinkId(settings.get(`audio.output.call`))
        .catch((err) => {
          ipcRenderer.send('main-log', `Peer: Output device error. ${err}`)
          ipcRenderer.send(`peer-device-output-error`, err)
        })
    }
  }
}

function createAudioMeter (audioContext, clipLevel, averaging, clipLag) {
  var processor = audioContext.createScriptProcessor(512)
  processor.onaudioprocess = volumeAudioProcess
  processor.clipping = false
  processor.lastClip = 0
  processor.volume = 0
  processor.maxVolume = 0
  processor.clipLevel = clipLevel || 0.98
  processor.averaging = averaging || 0.95
  processor.clipLag = clipLag || 750
  processor.events = new EventEmitter()

  // this will have no effect, since we don't copy the input to the output,
  // but works around a current Chrome bug.
  processor.connect(audioContext.destination)

  processor.checkClipping =
        function () {
          if (!this.clipping) { return false }
          if ((this.lastClip + this.clipLag) < window.performance.now()) { this.clipping = false }
          return this.clipping
        }

  processor.shutdown =
        function () {
          this.disconnect()
          this.onaudioprocess = null
        }

  return processor
}

function volumeAudioProcess (event) {
  var buf = event.inputBuffer.getChannelData(0)
  var bufLength = buf.length
  var sum = 0
  var x
  var clippingNow = false
  var maxVolume = 0

  // Do a root-mean-square on the samples: sum up the squares...
  for (var i = 0; i < bufLength; i++) {
    x = buf[i]
    if (Math.abs(x) > maxVolume) { maxVolume = Math.abs(x) }
    if (Math.abs(x) >= this.clipLevel) {
      this.clipping = true
      this.lastClip = window.performance.now()
      clippingNow = true
    }
    sum += x * x
  }

  if (!clippingNow && (this.lastClip + this.clipLag) < window.performance.now()) { this.clipping = false }

  // ... then take the square root of the sum.
  var rms = Math.sqrt(sum / bufLength)

  // Now smooth this out with the averaging factor applied
  // to the previous sample - take the max here because we
  // want "fast attack, slow release."
  this.volume = Math.max(rms, this.volume * this.averaging)
  this.maxVolume = Math.max(maxVolume, this.maxVolume * this.averaging)

  this.events.emit(`volume-processed`, this.volume, this.clipping, this.maxVolume)
}
