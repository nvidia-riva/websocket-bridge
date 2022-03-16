/*
 * SPDX-FileCopyrightText: Copyright (c) 2022 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: MIT
 */


/*
 * Audio codes specific messages parsing, from client->server
 * start, stop
 * returns to client
 * started, hypothesis, recognition, end, error
 */

const RivaASRClient = require('../riva_client/asr');


/*
 * enum to track current state of ws based protocol
 *
 */

const stateOf = Object.freeze({
    UNDEFINED: 'undefined', //
    INITIAL: 'initial',
    STARTED: 'started',
    STOPPED: 'stopped',
});

/*
 * Callback for capturiong the transciprt from ASR
 */

function transcription_cb(result, ws) {
    if(result.error) {
        console.log("endpoint failure");
        //These are generally fatal - shut down the ws.
        ws.close();
        return;
    }

    if (result.transcript == undefined) {
        ws.send(JSON.stringify({ "type": "started" }));
        return;
    }
    // Log the transcript to console, overwriting non-final results
    process.stdout.write(''.padEnd(process.stdout.columns, ' ') + '\r')
    if (!result.is_final) {
        //process.stdout.write('TRANSCRIPT: ' + result.transcript + '\r');
        ws.send(JSON.stringify({ "type": "hypothesis", "alternatives": [{ "text": result.transcript }] }));
    } else {
        //process.stdout.write('TRANSCRIPT: ' + result.transcript + '\n');
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
        ws.send(JSON.stringify({ "type": "end", "reason": "stop by client" }));
        return stateOf.STOPPED;
    } else {
        console.log("Unknown message type : " + msg_data.type);
        ws.send(JSON.stringify({ "type": "end", "reason": "corrupted server state" }));
        return stateOf.UNDEFINED;
    }
}

/*
 * Callback for 'connection' events for websocket server support audiocodes voicegateway api
 *
 */
const fs = require('fs');
async function serverMessage(data, isBinary, ws, ws_state, asr) {

    if (!isBinary) {  // non-binary data will be string start/stop control messages
        ws_state = await  audioCodesControlMessage(data, asr, ws);
        console.log("ws_socket->state : " + ws_state);
        return ws_state;
    } else {
        if(ws_state == stateOf.STARTED) {
            asr.recognizeStream.write({ audio_content: data });
            // may want to put this behind a feature flag to capture audio through bridge
            // fs.appendFile('sampleaudio', data, err => {
            //     if(err) {
            //         console.log("bad capture from mic");
            //         return
            //         }
            // });
            return ws_state;
        } else {
            console.log("Received binary stream on connection in invalid state " + ws_state + "  - send start message to begin stream");
            return ws_state;
        }
    }
}

function wsServerConnection(ws, req) {
    const ip = req.socket.remoteAddress;
    let ws_state = stateOf.UNDEFINED;
    let asr = new RivaASRClient();

    console.log('Client connected from %s', ip);

    ws.on('message', async function serverMessage_cl(data, isBinary) {
        ws_state = await serverMessage(data, isBinary, ws, ws_state, asr);
    });
    // ws.on('message', async function serverMessage(data, isBinary) {

    //     if (!isBinary) {  // non-binary data will be string start/stop control messages
    //         ws_state = await  audioCodesControlMessage(data, asr, ws);
    //         console.log("ws_socket->state : " + ws_state);
    //         return ws_state;
    //     } else {
    //         if(ws_state == stateOf.STARTED) {
    //             asr.recognizeStream.write({ audio_content: data });
    //             // may want to put this behind a feature flag to capture audio through bridge
    //             // fs.appendFile('sampleaudio', data, err => {
    //             //     if(err) {
    //             //         console.log("bad capture from mic");
    //             //         return
    //             //         }
    //             // });
    //         } else {
    //             console.log("Received binary stream on connection in invalid state " + ws_state + "  - send start message to begin stream");

    //         }

    //     }
    // });

    ws.on('error', function error(data, code) {
        console.log("error: %s", code);
        console.log(data);
    });
    ws.on('close', function close() {
        console.log("closing connection for %s", ip);
        ws.close();
    });

};

/*
 * Callback for Close events
 */

function wsServerClose(reason) {
    console.log('closing connection %s', reason);
};

module.exports = { audioCodesControlMessage, transcription_cb, serverMessage, wsServerConnection, wsServerClose, stateOf } ;
