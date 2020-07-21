/**
 * Copyright 2020 NVIDIA Corporation. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const id = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
const socketio = io();
const resampleWorker = './resampler.js';

var peer;
var peer_id;
var username = 'User ' + id.toString();
var peer_username;
var conn;
var localStream;
var peerStream;
var audioContext;
var sampleRate;
var jarvisRunning = false;
var socket;

var scrollToBottomTime = 500;
var displacy;
var ents;
var latencyTimer;

// ---------------------------------------------------------------------------------------
// Latency tracking
// ---------------------------------------------------------------------------------------
class LatencyTimer {
    constructor() {
        this.startTimes = new Array();
        this.latencies = new Array();
    }

    start(data=null) {
        return this.startTimes.push({start: performance.now(), data: data}) - 1;
    }

    end(index) {
        if (index >= this.startTimes.length) {
            return 0;
        }
        var latency = Math.round(performance.now() - this.startTimes[index].start);
        this.latencies.push(latency);
        return {latency: latency, data: this.startTimes[index].data};
    }

    average() {
        const sum = this.latencies.reduce((a, b) => a + b, 0);
        return Math.round((sum / this.latencies.length) || 0);
    }
}

function setPeerUsername(peerName) {
    peer_username = peerName;
    document.getElementById("peer_cam_label").innerHTML = peer_username;
}

// ---------------------------------------------------------------------------------------
// Start Jarvis, whether triggered locally or by a message from peer
// ---------------------------------------------------------------------------------------
function startJarvisService() {
    if (jarvisRunning) {
        return;
    }
    document.getElementById('jarvis-btn').disabled = true;
    latencyTimer = new LatencyTimer();

    console.log('Trying to start socket connection');
    if (socket == null) {
        socket = socketio.on('connect', function() {
            console.log('Connected to speech server');
        });    
    } else {
        socket.disconnect();
        socket.connect();
        console.log('Reconnected to speech server');
    }
    
    // Start ASR streaming
    let audioInput = audio_context.createMediaStreamSource(localStream);
    let bufferSize = 4096;
    let recorder = audio_context.createScriptProcessor(bufferSize, 1, 1);
    let worker = new Worker(resampleWorker);
    worker.postMessage({
	    command: 'init',
	    config: {
            sampleRate: sampleRate,
            outputSampleRate: 16000
	    }
    });
    
    // Use a worker thread to resample the audio, then send to server
    recorder.onaudioprocess =  function(audioProcessingEvent) {
        let inputBuffer = audioProcessingEvent.inputBuffer;
        worker.postMessage({
            command: 'convert',
            // We only need the first channel
            buffer: inputBuffer.getChannelData(0)
        });
        worker.onmessage = function(msg) {
            if (msg.data.command == 'newBuffer') {
                socket.emit('audio_in', msg.data.resampled.buffer);
            }
        };
    };

    // connect stream to our recorder
    audioInput.connect(recorder);
    // connect our recorder to the previous destination
    recorder.connect(audio_context.destination);
    jarvisRunning = true;

    console.log('Streaming audio to server')

    // Transcription results streaming back from Jarvis
    socket.on('transcript', function(result) {
        if (result.transcript == undefined) {
            return;
        }
        document.getElementById('input_field').value = result.transcript;
        if (result.is_final) {
            // Erase input field
            $('#input_field').val('');
            // Render the transcript locally
            // TODO: check for error in result.annotations
            showAnnotatedTranscript(username, result.annotations, result.transcript);
            // Send the transcript to the peer to render
            if (conn != undefined) {
                conn.send({from: username, type: 'transcript', annotations: result.annotations, text: result.transcript});
            }
            if (result.latencyIndex !== undefined) {
                var latencyResult = latencyTimer.end(result.latencyIndex);
                console.log(latencyResult.data.name + ': ' + latencyResult.latency.toString() + ' ms');
                console.log('Average latency (overall): ' + latencyTimer.average().toString() + ' ms');
            }
        }
    });

    document.getElementById('submit_text').removeAttribute('disabled');
    document.getElementById('input_field').setAttribute('placeholder', 'Enter some text to annotate, or start speaking');
    var connArea = document.getElementById('connection_status');
    var jarvisDiv = document.createElement('div');
    jarvisDiv.innerHTML = '<p class=\"text-info\"><strong>Jarvis is connected</strong></p>';
    connArea.appendChild(jarvisDiv);

    socket.emit('get_supported_entities');
    socket.on('supported_entities', function(response) {
        var entityHeader, entityDiv, ner;
        ents = response.split(',');
        console.log('Supported entities: ' + response);
        // Render a legend from the entity list
        entityHeader = document.createElement('div');
        entityHeader.innerHTML = '<p class=\"mb-1\">Entities being tagged:</p>';
        connArea.appendChild(entityHeader);
        entityDiv = document.createElement('div');
        ner = ents.map(function(type){ 
            return {'start': 0, 'end': 0, 'type': type};
        });
        displacy.render(entityDiv, '', ner, ents);
        connArea.append(entityDiv);
    });
}

// ---------------------------------------------------------------------------------------
// Shows NLP-annotated transcript
// ---------------------------------------------------------------------------------------
function showAnnotatedTranscript(speaker, annotations, text) {

    if(!annotations)
        return;

    var nameContainer = document.createElement('div');
    var textContainer = document.createElement('div');
    if (speaker == username) {
        nameContainer.setAttribute('class', 'd-flex justify-content-end');
        textContainer.setAttribute('class', 'row justify-content-end mx-0');
    }

    nameContainer.innerHTML = "<p class=\"text-info mb-0 mt-1\"><small><strong>" + speaker + ":</strong></small></p>";
    displacy.render(textContainer, text, annotations.ner, annotations.ents);

    $("#transcription_area").append(nameContainer);
    $("#transcription_area").append(textContainer);
    $("#transcription_card").animate({scrollTop: 100000}, scrollToBottomTime);
    $("html, body").animate({scrollTop: $(document).height()}, scrollToBottomTime);
}

/**
 * Starts the request of the camera and microphone
 *
 * @param {Object} callbacks
 */
function requestLocalVideo(callbacks) {
//    // Monkeypatch for crossbrowser getUserMedia
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

    // Request audio and video
    navigator.getUserMedia({ audio: true, video: true }, callbacks.success , callbacks.error);
}

/**
 * Attach the provided stream (video and audio) to the desired video element
 *
 * @param {*} stream
 * @param {*} element_id
 */
function onReceiveStream(stream, element_id) {
    // Retrieve the video element
    var video = document.getElementById(element_id);
    // Set the given stream as the video source
    video.srcObject = stream;
}

/**
 * Receive messages from the peer
 *
 * @param {Object} data
 */
function handleMessage(data) {
    console.log("Message: " + data);

    switch(data.type) {
        case 'startJarvis':
            startJarvisService();
            break;
        case 'transcript':
            if (data.from != peer_username) {
                setPeerUsername(data.from);
            }
            showAnnotatedTranscript(data.from, data.annotations, data.text);
            break;
        case 'username':
            setPeerUsername(data.from);
            break;
        default:
            console.log('Received unknown message from peer, of type ' + data.type);
    }
}

// ---------------------------------------------------------------------------------------
// When the document is ready
// ---------------------------------------------------------------------------------------
$(document).ready(function () {
    // Start DisplaCy for the NER rendering
    displacy = new displaCyENT('http://localhost:8000', {})

    /**
     * The iceServers on this example are public and can be used for a demo project.
     * They are intended for low-volume use; please do not abuse them.
     * They also may be discontinued without notice.
     */
    peer = new Peer(id, {
        host: document.domain,
        port: location.port,
        path: '/peerjs',
        debug: 3,
        secure: true,
        config: {
            'iceServers': [
                { url: 'stun:stun1.l.google.com:19302' },
                {
                    url: 'turn:numb.viagenie.ca',
                    credential: 'JarvisDemo',
                    username: 'cparisien@nvidia.com'
                }
            ]
        }
    });

    // Once the initialization succeeds:
    // Show the ID that allows other user to connect to your session.
    peer.on('open', function () {
        document.getElementById("your_id").innerHTML = "Your ID: <strong>" + peer.id + "</strong>";
    });

    // When someone connects to your session:
    //
    // 1. Hide the peer_id field of the connection form and set automatically its value
    // as the peer of the user that requested the connection.
    // 2. Update global variables with received values
    peer.on('connection', function (connection) {
        conn = connection;
        peer_id = connection.peer;
        setPeerUsername(conn.metadata.username);
        console.log("Received connection request from " + peer_username);

        // Use the handleMessage to callback when a message comes in
        conn.on('data', handleMessage);
    });

    peer.on('error', function(err){
        alert("An error occurred with peer: " + err);
        console.error(err);
    });

    /**
     * Handle the on receive call event
     */
    peer.on('call', function (call) {
        var acceptsCall = confirm("Video call incoming, do you want to accept it ?");

        if(acceptsCall) {
            // Answer the call with your own video/audio stream
            call.answer(localStream);
            startJarvisService();

            // Receive data
            call.on('stream', function (stream) {
                peerStream = stream;
                // Display the stream of the other user in the peer-camera video element
                onReceiveStream(stream, 'peer-camera');
            });

            // Handle when the call finishes
            call.on('close', function(){
                alert("The video call has finished");
            });
        } else {
            console.log("Call denied !");
        }
    });

    /**
     * Request browser audio and video, and show the local stream
     */
    requestLocalVideo({
        success: function(stream){
            localStream = stream;
            audio_context = new AudioContext();
            sampleRate = audio_context.sampleRate;
            console.log("Sample rate of local audio: " + sampleRate)

            onReceiveStream(stream, 'my-camera');
        },
        error: function(err){
            alert("Cannot get access to your camera and video!");
            console.error(err);
        }
    });

    // Allow us to launch Jarvis with only the local speaker
    document.getElementById('jarvis-btn').removeAttribute("disabled");
});

// ---------------------------------------------------------------------------------------
// Click on user name button
// ---------------------------------------------------------------------------------------
$(document).on("click", "#name_btn", function (e) {
    // Prevent reload of page after submitting of form
    e.preventDefault();
    username = $('#name').val();
    console.log("username: " + username);
    document.getElementById("self_cam_label").innerHTML = username;
    if (conn != undefined) {
        conn.send({from: username, type: 'username'});
    }
});

// ---------------------------------------------------------------------------------------
// Request a video call with another user
// ---------------------------------------------------------------------------------------
$(document).on("click", "#call", function (e) {
    // Prevent reload of page after submitting of form
    e.preventDefault();

    // Connect with the user
    peer_id = document.getElementById("peer_id").value;
    if (peer_id) {
        conn = peer.connect(peer_id, {
            metadata: {
                'username': username
            }
        });
        conn.on('data', handleMessage);
    } else {
        return false;
    }

    // Call the peer
    console.log('Calling peer ' + peer_id);
    var call = peer.call(peer_id, localStream);
    setPeerUsername('User ' + peer_id.toString());
    call.on('stream', function (stream) {
        peerStream = stream;
        onReceiveStream(stream, 'peer-camera');
    });
    startJarvisService();
});

/**
 * On clicking the Transcription button, start Jarvis
 */
$(document).on("click", "#jarvis-btn", function (e) {
    // Send message to peer to also connect to Jarvis, then start my own connection
    if (conn != undefined) {
        conn.send({from: username, type: 'startJarvis'});
    }
    startJarvisService();
});


// ---------------------------------------------------------------------------------------
// Click on text submit button
// ---------------------------------------------------------------------------------------
$(document).on("submit", "#input_form", function (e) {
    // Prevent reload of page after submitting of form
    e.preventDefault();
    let text = $('#input_field').val();
    console.log("text: " + text);

    socket.emit('nlp_request', {
        text: text,
        latencyIndex: latencyTimer.start({name: 'NLP request'})
    });
    // Erase input field
    $('#input_field').val("");
});
