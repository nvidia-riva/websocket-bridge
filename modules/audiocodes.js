/*
 * Audio codes specific messages parsing, from client->server
 * start, stop
 * returns to client
 * started, hypothesis, recognition, end, error
 */


function audioCodesControlMessage(data, asr, send) {
    msg_data = JSON.parse(data);
    if (msg_data.type === "start") {
        asr.setupASR(msg_data);
        asr.mainASR(function (result) {
            if (result.transcript == undefined) {
                send(JSON.stringify({ "type": "started" }));
                return;
            }
            // Log the transcript to console, overwriting non-final results
            process.stdout.write(''.padEnd(process.stdout.columns, ' ') + '\r')
            if (!result.is_final) {
                process.stdout.write('TRANSCRIPT: ' + result.transcript + '\r');
                send(JSON.stringify({ "type": "hypothesis", "alternatives": [{ "text": result.transcript }] }));
            } else {
                process.stdout.write('TRANSCRIPT: ' + result.transcript + '\n');
                send(JSON.stringify({ "type": "recognition", "alternatives": [{ "text": result.transcript }] }));
                send(JSON.stringify({ "type": "end", "reason": "Recognition complete" }));
            }
        });
        send(JSON.stringify({ "type": "started" }))    ;
    } else if (msg_data.type === 'stop') {
        send(JSON.stringify({ "type": "end", "reason": "ASR service stopped" }));
    }
}

/*
 * Callback for 'connection' events
 */

function wsServerConnection(ws, req) {
    const ip = req.socket.remoteAddress;
    console.log('Client connected from %s', ip);
    let asr = new ASRPipe();
    ws.on('message', function message(data, isBinary) {
        if (!isBinary) {  // non-binary data will be string start/stop control messages
            audioCodesControlMessage(data, asr, ws.send);

        } else {
            asr.recognizeStream.write({ audio_content: data });
        }
    });
};

/*
 * Callback for Close events
 */

function wsServerClose(reason) {
    console.log('closing connection %s', reason);
};

module.exports =  audioCodesControlMessage;//, wsServerConnection, wsServerClose };
