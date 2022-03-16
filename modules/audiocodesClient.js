/*
 * Audio codes specific messages parsing,
 * start, stop
 * server returns to client
 * started, hypothesis, recognition, end, error
 */


const WebSocket = require('ws');
const fs = require('fs');

let rawWav = fs.readFileSync("./dualstream.pcm");
let ws_server = 'wss://localhost:8009';
var ws = new WebSocket(ws_server, {rejectUnauthorized: false});

var sslkey = '../certificates/key.pem';
var sslcert = '../certificates/cert.pem';

let count = 0;
ws.on('open', async function start() {
    console.log("connected to server");
    start_asr = { "type": "start", "language": "en-US", "format": "raw", "encoding": "LINEAR16", "sampleRateHz": 16000 };
    ws.send(JSON.stringify(start_asr));
});
ws.on('close', function (result) {
    console.log("WebSocket closing:" + JSON.stringify(result));
});
ws.on('error', function (result) {
    console.log("WebSocket error:" + result.message);
})
ws.on('message', function (rawmsg, isbinary) {
    msg = JSON.parse(rawmsg.toString());
    if (msg.type === "started") {
        // we can start sending file
        //let wavbuffer = wav.toBuffer();
        let wavbuffer = rawWav;
        ws.send(wavbuffer);
    } else if (msg.type == "end") {
        count += 1;
        if (count >= 10) {
            ws.close();
            return;
       }  else {
            let wavbuffer = rawWav;
            ws.send(wavbuffer);
        }
    }else if (msg.type=="recognition") {
        msg.alternatives.forEach(element => {
            console.log(element);
        });
    }
});
