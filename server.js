/*
 * SPDX-FileCopyrightText: Copyright (c) 2022 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

require('dotenv').config({ path: 'env.txt' });

const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const https = require('https');
const express = require('express');

const ASRPipe = require('./riva_client/asr');

const app = express();
const port = (process.env.PORT);
var server;
var sslkey = './certificates/key.pem';
var sslcert = './certificates/cert.pem';


/*
 * Audio codes specific messages parsing
 */
function audioCodesControlMessage(data, asr, ws) {
    msg_data = JSON.parse(data);
    console.log({msg_data});
    if (msg_data.type === "start") {

        // Initialize Riva
        console.log('Initializing Riva ASR');
        asr.setupASR(msg_data);
        asr.mainASR(function (result) {
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
        });
        ws.send(JSON.stringify({ "type": "started" }));
    } else if (msg_data.type === 'stop') {
        ws.send(JSON.stringify({ "type": "end", "reason": "ASR service stopped" }));
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
            audioCodesControlMessage(data, asr, ws);

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

/**
 * Set up Express Server with CORS and websockets ws
 */
function setupServer() {
    // set up Express
    app.use(express.static('web')); // ./web is the public dir for js, css, etc.
    app.get('/', function (req, res) {
        res.sendFile('./web/index.html', { root: __dirname });
    });
    server = https.createServer({
        key: fs.readFileSync(sslkey),
        cert: fs.readFileSync(sslcert)
    }, app);

    const wsServer = new WebSocket.Server({ server });

    // Listener, once the client connects to the server socket
    wsServer.on('connection', function connection(ws, req) {
        wsServerConnection(ws, req);
    });
    wsServer.on('close', function close(reason) {
        wsServerClose(reason)
    });


    server.listen(port, () => {
        console.log('Running server on port %s', port);
    });
};

setupServer();
