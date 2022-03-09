/*
 * Audio codes specific messages parsing, from client->server
 * start, stop
 * returns to client
 * started, hypothesis, recognition, end, error
 */

const ASRPipe = require('../riva_client/asr');


/*
 * enum to track current state of ws based protocol
 *
 */

const stateOf = {
    UNDEFINED: 'undefined',
    STARTED: 'started',
    STOPPED: 'stopped',
};


function transcription_cb(result, ws) {
    if (result.transcript == undefined) {
        ws.send(JSON.stringify({ "type": "started" }));
        return;
    }
    // Log the transcript to console, overwriting non-final results
    process.stdout.write(''.padEnd(process.stdout.columns, ' ') + '\r')
    if (!result.is_final) {
        process.stdout.write('TRANSCRIPT: ' + result.transcript + '\r');
            ws.send(JSON.stringify({ "type": "hypothesis", "alternatives": [{ "text": result.transcript }] }));
    } else {
        process.stdout.write('TRANSCRIPT: ' + result.transcript + '\n');
        ws.send(JSON.stringify({ "type": "recognition", "alternatives": [{ "text": result.transcript }] }));
        ws.send(JSON.stringify({ "type": "end", "reason": "Recognition complete" }));
    }
}
/*
 * Audiocodes ws voice protocol is implemnted in this function.
 *
 */

async function audioCodesControlMessage(data, asr, ws) {
    let msg_data = JSON.parse(data);
    if (msg_data.type === "start") {
        asr.setupASR(msg_data.sampleRateHz, msg_data.language);

        try {
            asr.mainASR(function transcription_cbh(result) { transcription_cb(result, ws) });
        } catch (Error){
            console.log("Riva server not responding, please check configs.  Nothing to do - failing.");
            console.log(Error);
            ws.send(JSON.stringify({ "type": "end", "reason": "RIVA service unavailable" }));
            return stateOf.STOPPED;
        }

        ws.send(JSON.stringify({ "type": "started" }))    ;
        return stateOf.STARTED;
    } else if (msg_data.type === 'stop') {
        ws.send(JSON.stringify({ "type": "end", "reason": "RIVA service stopped" }));
        return stateOf.STOPPED;
    } else {
        console.log("Unknown message type : " + msg_data.type);
        ws.send(JSON.stringify({ "type": "end", "reason": "corrupted server state - please file a bug here: " }));
        return stateOf.UNDEFINED;
    }
}

/*
 * Callback for 'connection' events for websocket server support audiocodes voicegateway api
 *
 */

function wsServerConnection(ws, req) {
    const ip = req.socket.remoteAddress;
    let asr = new ASRPipe();
    let ws_state = stateOf.UNDEFINED;
    console.log('Client connected from %s', ip);

    ws.on('message', function message(data, isBinary) {
        if (!isBinary) {  // non-binary data will be string start/stop control messages
            console.log("control message received");
            ws_state = audioCodesControlMessage(data, asr, ws);
            console.log(ws_state);

        } else {
          if(ws_state == stateOf.STARTED) {
              asr.recognizeStream.write({ audio_content: data });
            } else {
                console.log("Connection in invalid state!!");
            }
        }
    });
    ws.on('error', function error(data, code) {
        console.log("error: %s", code);
        console.log(data);
    });
    ws.on('close', function close() {
        console.log("closing connection for %s", ip);
    });

};

/*
 * Callback for Close events
 */

function wsServerClose(reason) {
    console.log('closing connection %s', reason);
};

module.exports = { audioCodesControlMessage, wsServerConnection, wsServerClose } ;
