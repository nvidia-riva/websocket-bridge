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

require('dotenv').config({ path: 'env.txt' });

const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const https = require('https');
const express = require('express');

const ASRPipe = require('./modules/asr');

const app = express();
const port = (process.env.PORT);
var server;
var sslkey = './certificates/key.pem';
var sslcert = './certificates/cert.pem';


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

    const wss = new WebSocket.Server({ server });

    // Listener, once the client connects to the server socket
    wss.on('connection', function connection(ws, req) {
        const ip = req.socket.remoteAddress;
        console.log('Client connected from %s', ip);
        let asr = new ASRPipe();
        ws.on('message', function message(data, isBinary) {
            // console.log('Received message', data);
            // console.log('isBinary', isBinary);
            if (!isBinary) {  // non-binary data will be string start/stop control messages
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
                            // TODO: Is the below end message necessary? Confusing explanation in Audiocodecs Reference Guide 
                            // https://www.audiocodes.com/media/15479/voiceai-gateway-api-reference-guide.pdf (pg. 19):
                            // In case only a single utterance is recognized per recognition-session, an "end"
                            // message must be sent immediately after the "recognition" message."
                            ws.send(JSON.stringify({ "type": "end", "reason": "Recognition complete" }));
                        }
                    });
                    ws.send(JSON.stringify({ "type": "started" }));
                } else if (msg_data.type === 'stop') {
                    ws.send(JSON.stringify({ "type": "end", "reason": "ASR service stopped" }));
                    ws.terminate();
                }
            } else {
                asr.recognizeStream.write({ audio_content: data });
            }
        });

        ws.on('close', (reason) => {
            console.log('Client at %s disconnected.', ip);
        });
    });



    server.listen(port, () => {
        console.log('Running server on port %s', port);
    });
};

setupServer();