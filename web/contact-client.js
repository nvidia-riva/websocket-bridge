// Client-side Jarvis call transcription

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

var endpoint;
var host_ip;
var session = '';

var recordAudio;
var socket;

var scrollToBottomTime = 500;
var displacy;

// ---------------------------------------------------------------------------------------
// Gets parameter by name
// ---------------------------------------------------------------------------------------
function getParameterByName(name, url) {
    var arr = url.split('#');
    var match = RegExp('[?&]' + name + '=([^&]*)')
        .exec(arr[0]);
    return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
}

// ---------------------------------------------------------------------------------------
// Get service endpoint from URL parameters
// ---------------------------------------------------------------------------------------
function getEndpoint() {
    // Get endpoint from URL
    var endpoint = getParameterByName("e", window.location.href);
    // Use default, if no endpoint is present
    if (endpoint == null) {
        endpoint = window.location.protocol + "\/\/" + window.location.host + "/";
    }
    return endpoint;
}

// ---------------------------------------------------------------------------------------
// Start Jarvis, whether triggered locally or by a message from peer
// ---------------------------------------------------------------------------------------
function startJarvisService() {
    document.getElementById('jarvis-btn').disabled = true;

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
                // console.log('Emit audio');
                socket.emit('audio_in', msg.data.resampled.buffer);
            }
        };
    };

    // connect stream to our recorder
    audioInput.connect(recorder);
    // connect our recorder to the previous destination
    recorder.connect(audio_context.destination);

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
        }
    });

    document.getElementById('submit_text').removeAttribute("disabled");
}

// ---------------------------------------------------------------------------------------
// Shows NLP-annotated transcript
// ---------------------------------------------------------------------------------------
function showAnnotatedTranscript(speaker, annotations, text) {

    if(!annotations)
        return;

    var container = document.createElement('tr');
    container.setAttribute('class', 'message');
    container.setAttribute('class', 'clearfix');
    if (speaker == username) {
        container.setAttribute('style', 'text-align:right');
    }

//    console.log("showAnnotatedTranscript: " +  text);

    container.innerHTML = "<p class=\"text-info mb-1\"><small><strong>" + speaker + ":</strong></small></p>";
    displacy.render(container, text, annotations.ner);
    // displacy.render(container, text, annotations.spans, annotations.ents);

    $("#transcription_area tbody").append(container);
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
    // navigator.getUserMedia({ audio: true }, callbacks.success , callbacks.error);
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

    // Store a global reference of the stream
//        peerStream = stream;
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
            showAnnotatedTranscript(data.from, data.annotations, data.text);
            break;
        default:
            console.log('Received unknown message from peer, of type ' + data.type);
    }
}

// ---------------------------------------------------------------------------------------
// When the document is ready
// ---------------------------------------------------------------------------------------
$(document).ready(function () {
    // Get endpoint from URL address
    endpoint = getEndpoint();

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
        console.log("Received connection request from peer " + peer_id);

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

        if(acceptsCall){
            // Answer the call with your own video/audio stream
            call.answer(localStream);

            // Receive data
            call.on('stream', function (stream) {
                peerStream = stream;
                // Display the stream of the other user in the peer-camera video element
                onReceiveStream(stream, 'peer-camera');
                document.getElementById('jarvis-btn').removeAttribute("disabled");
            });

            // Handle when the call finishes
            call.on('close', function(){
                alert("The video call has finished");
            });

            // use call.close() to finish a call
        }else{
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

    // TEMP: early access to jarvis button for testing
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

    // TODO: clear the dropdown and cursor
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
    call.on('stream', function (stream) {
        peerStream = stream;
        onReceiveStream(stream, 'peer-camera');
        document.getElementById('jarvis-btn').removeAttribute("disabled");
    });
});

/**
 * On clicking the Transcription button, start Jarvis
 */
$(document).on("click", "#jarvis-btn", function (e) {
    // TODO: check if Jarvis already started. If so, pause it?

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

    socket.emit('nlp_request', text);
    // Erase input field
    $('#input_field').val("");
});
