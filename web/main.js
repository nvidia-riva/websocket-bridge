// Client-side Jarvis call transcription
// Peer-to-peer video chat graciously adapted from https://github.com/ourcodeworld/videochat-peerjs-example

// TODO: get port from config somehow?
// use something like socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port + namespace);
//const JARVIS_APP_URL = 'https://192.168.2.44:8009';
const id = Math.floor(Math.random() * 10000).toString().padStart(4, '0');

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
// Connect to the Jarvis speech service
// ---------------------------------------------------------------------------------------
function initJarvis() {
    console.log("Initializing Jarvis connection");

    $.ajax({
        url: endpoint + 'request',
        type: 'post',
        processData: false,
        data: JSON.stringify({
            "text": '',
            "session": session,
            "payload": {}
        }),
        contentType: "application/json; charset=utf-8",
        dataType: "json",

        success: function (data, textStatus, jqXhr) {
            if (!data)
                return;
            session = data["session"];
        },
        error: function (jqXhr, textStatus, errorThrown) {
            console.log(errorThrown);
            // If server doesn't respond, wait and retry
            setTimeout(initJarvis(), 3000);
        }
    });
}

// ---------------------------------------------------------------------------------------
// Start Jarvis, whether triggered locally or by a message from peer
// ---------------------------------------------------------------------------------------
function startJarvisService() {
    let namespace = '/';

    document.getElementById('jarvis-btn').disabled = true;

    initJarvis();

    if(socket == null){
        socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port + namespace);
        socket.on('connect', function() {
            console.log('Connected to speech server')
        });
    }
    else {
        socket.disconnect();
        socket.connect();
    }

    // Start ASR streaming
    let audioInput = audio_context.createMediaStreamSource(localStream);
    let bufferSize = 4096;
    // record only 1 channel
    let recorder = audio_context.createScriptProcessor(bufferSize, 1, 1);
    // specify the processing function
    recorder.onaudioprocess =  function(audioProcessingEvent) {
        let inputBuffer = audioProcessingEvent.inputBuffer;
        // We only need the first channel
        let inputData = inputBuffer.getChannelData(0);
        let resampled = resampleAudio(inputData, 16000, sampleRate);
        outputData = floatTo16BitPCM(resampled);
        socket.emit('audio_in', outputData.buffer);
    };

    // connect stream to our recorder
    audioInput.connect(recorder);
    // connect our recorder to the previous destination
    recorder.connect(audio_context.destination);


/*      // This is an earlier attempt to use a recording stream. Might revisit this soon.
    recordAudio = RecordRTC(localStream, {
        type: 'audio',
        mimeType: 'audio/webm',
        sampleRate: sampleRate, // sample rate of the local source
        desiredSampRate: 16000, // resample to what we want to send Jarvis
        recorderType: StereoAudioRecorder,
        numberOfAudioChannels: 1, // mono recording
        timeSlice: 200, // audio chunk length (in ms)
        // as soon as the chunk is available
        ondataavailable: function(blob) {
            blob.arrayBuffer().then(function(buffer) {
                console.log("Blob size = " + blob.size);
                var output = new Int16Array(buffer);
                socket.emit('audio_in', output);
            });
//                var stream = ss.createStream();
////                // stream directly to server
////                // it will be temporarily stored on server
////                ss(socket).emit('audio_in', stream, {
////                    name: 'stream.wav',
////                    size: blob.size
////                });
//                // pipe the audio blob into the stream that's going to the server
////                ss.createBlobReadStream(blob).pipe(stream);
//                ss(socket).emit('audio_in', ss.createBlobReadStream(blob))
        }
    });
    recordAudio.startRecording();
*/

    console.log('Streaming audio to server')

    listenASR();

}

// ---------------------------------------------------------------------------------------
// send message to Jarvis
// ---------------------------------------------------------------------------------------
function sendInput(text) {
    // escape html tags
    text = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    console.log("sendInput:" + text);

    $.ajax({
        url: endpoint + 'request',
        dataType: 'json',
        type: 'post',
        contentType: 'application/json; charset=utf-8',
        data: JSON.stringify({
            "text": text,
            "session": session,
            "payload": {}
        }),
        processData: false,

        success: function (data, textStatus, jQxhr) {
            session = data["session"];
            payload = {};
            // Render the transcript locally
            showAnnotatedTranscript(username, data["annotations"], data["input"]);
            // Send the transcript to the peer to render
            conn.send({from: username, type: 'transcript', annotations: data['annotations'], text: data['input']});
        },
        error: function (jqXhr, textStatus, errorThrown) {
            console.log(errorThrown);
        }
    });
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

    console.log("showAnnotatedTranscript: " +  text)

    // TODO: find/create better CSS style for this
    container.innerHTML = "<p class=\"text-info mb-1\"><small><strong>" + speaker + ":</strong></small></p>";
    displacy.render(container, text, annotations.spans, annotations.ents);

    setTimeout(function () {
        $("#transcription_area tbody").append(container);
        // scroll to bottom of page
        setTimeout(function () {
            $("html, body").animate({scrollTop: $(document).height()}, scrollToBottomTime);
        }, 1);
    }, 1000);
}

// ---------------------------------------------------------------------------------------
//
// ---------------------------------------------------------------------------------------
function listenASR() {
    let eventSource = new EventSource("/transcript_stream");

    eventSource.addEventListener('intermediate-transcript', function (e) {
        document.getElementById("input_field").value = e.data;
        }, false
    );

    eventSource.addEventListener('finished-speaking', function (e) {
        document.getElementById("input_field").value = e.data;
        if (document.getElementById("autosubmitcheck").checked == true) {
            document.getElementById("submit_text").click();
        }
        }, false
    );
}

/**
 * Starts the request of the camera and microphone
 *
 * @param {Object} callbacks
 */
function requestLocalVideo(callbacks) {
    // Monkeypatch for crossbrowser getUserMedia
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
//        var orientation = "text-left";
//
//        // If the message is yours, set text to right !
//        if(data.from == username){
//            orientation = "text-right"
//        }
//
//        var messageHTML =  '<a href="javascript:void(0);" class="list-group-item' + orientation + '">';
//                messageHTML += '<h4 class="list-group-item-heading">'+ data.from +'</h4>';
//                messageHTML += '<p class="list-group-item-text">'+ data.text +'</p>';
//            messageHTML += '</a>';
//
//        document.getElementById("messages").innerHTML += messageHTML;
}

/**
* Resample an audio buffer, adapted from http://stackoverflow.com/a/28977136/552182
*/
function resampleAudio(data, newSampleRate, oldSampleRate) {
    var fitCount = Math.round(data.length * (newSampleRate / oldSampleRate));
    var newData = new Array();
    var springFactor = new Number((data.length - 1) / (fitCount - 1));
    newData[0] = data[0];
    for ( var i = 1; i < fitCount - 1; i++) {
        var tmp = i * springFactor;
        var before = new Number(Math.floor(tmp)).toFixed();
        var after = new Number(Math.ceil(tmp)).toFixed();
        var atPoint = tmp - before;
        newData[i] = linearInterpolate(data[before], data[after], atPoint);
    }
    newData[fitCount - 1] = data[data.length - 1];
    return newData;
}

function linearInterpolate(before, after, atPoint) {
    return before + (after - before) * atPoint;
}

/*
* Convert Float32Array from the AudioBuffer into Int16Array/PCM
*/
function floatTo16BitPCM(input) {
    let output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        let s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
}

// ---------------------------------------------------------------------------------------
// When the document is ready
// ---------------------------------------------------------------------------------------
$(document).ready(function () {
    // Get endpoint from URL address
    endpoint = getEndpoint();
//    host_ip = window.location.host.split(':')[0];
//    console.log('Endpoint: ' + endpoint);
//    console.log('Domain: ' + document.domain);

    // Start DisplaCy for the NER rendering
    displacy = new displaCyENT('http://localhost:8000', {})

    /**
     * The iceServers on this example are public and can be used for a demo project.
     * They are intended for low-volume use; please do not abuse them.
     * They also may be discontinued without notice.
     */
    peer = new Peer(id, {
        host: document.domain,
        port: 9000,
        path: '/peerjs',
        debug: 3,
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

        // Hide peer_id field and set the incoming peer id as value
//        document.getElementById("peer_id").className += " hidden";
//        document.getElementById("peer_id").value = peer_id;
//        document.getElementById("connected_peer").innerHTML = connection.metadata.username;
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



//    /**
//     * Handle the send message button
//     TODO: might not need the text messaging
//     */
//    document.getElementById("send-message").addEventListener("click", function(){
//        // Get the text to send
//        var text = document.getElementById("message").value;
//
//        // Prepare the data to send
//        var data = {
//            from: username,
//            text: text
//        };
//
//        // Send the message with Peer
//        conn.send(data);
//
//        // Handle the message on the UI
//        handleMessage(data);
//
//        document.getElementById("message").value = "";
//    }, false);

//    /**
//     *  Request a video call with another user
//     */
//    document.getElementById("call").addEventListener("click", function(){
//        // Connect with the user
//        peer_id = document.getElementById("peer_id").value;
//        if (peer_id) {
//            conn = peer.connect(peer_id, {
//                metadata: {
//                    'username': username
//                }
//            });
//            conn.on('data', handleMessage);
//        } else {
//            return false;
//        }
//
//        // Call the peer
//        console.log('Calling peer ' + peer_id);
////        console.log(peer);
//        var call = peer.call(peer_id, localStream);
//        call.on('stream', function (stream) {
//            peerStream = stream;
//            onReceiveStream(stream, 'peer-camera');
//            document.getElementById('jarvis-btn').removeAttr("disabled");
//        });
//    }, false);

//    /**
//     * On clicking the connect button, initialize connection with peer
//     */
//    document.getElementById("connect-to-peer-btn").addEventListener("click", function(){
//        username = document.getElementById("name").value;
//        peer_id = document.getElementById("peer_id").value;
//
//        if (peer_id) {
//            conn = peer.connect(peer_id, {
//                metadata: {
//                    'username': username
//                }
//            });
//
//            conn.on('data', handleMessage);
//        }else{
//            alert("You need to provide a peer to connect with !");
//            return false;
//        }
//
//        document.getElementById("chat").className = "";
//        document.getElementById("connection-form").className += " hidden";
//    }, false);

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
            alert("Cannot get access to your camera and video !");
            console.error(err);
        }
    });

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
//    // Erase input field
//    $('#input_field').val("");
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
//        console.log(peer);
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
    conn.send({from: username, type: 'startJarvis'});

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

    sendInput(text);
    // Erase input field
    $('#input_field').val("");
});
