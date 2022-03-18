/*
 * SPDX-FileCopyrightText: Copyright (c) 2022 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

import 'regenerator-runtime/runtime'
const { audioCodesControlMessage, transcription_cb, wsServerConnection, serverMessage, wsServerClose, stateOf} = require('../modules/audiocodes');
import RivaASRClient from '../riva_client/asr';
import WebSocket from 'ws';


// beforeAll(async () => {
//     console.log("before each - start");
//     // create a WS instance, listening on port 1234 on localhost
//     const server = new WS("wss://localhost:8009");
//     console.log("before each - server");
//     await server.connected;
//     console.log("before each - connected");
//     server.send("");
//     console.log("before each - send");
// });


jest.mock('../riva_client/asr');
jest.mock('ws');

describe('audioCodes protocol impl test suite - client messages', () => {

    test('start message', () => {
        var data = {
            "type": "start",
            "language": "en-US",
            "format": "raw",
            "encoding": "LINEAR16",
            "sampleRateHz": 1600
        };

        let asr = new RivaASRClient();
        let ws = new WebSocket('wss://localhost:8009');
        audioCodesControlMessage(JSON.stringify(data), asr, ws);
        expect(ws.getMessages()[0]).toBe('{"type":"started"}');
    });


    test('stop message', async () => {
        var data = {
            "type": "stop",
        };
        let asr = new RivaASRClient();
        let ws = new WebSocket('wss://localhost:8009');
        audioCodesControlMessage(JSON.stringify(data), asr, ws);
        expect(ws.getMessages()[0]).toBe('{"type":"end","reason":"stop by client"}');
    });

    test('start message server', async () => {

        var data = {
            "type": "start",
            "language": "en-US",
            "format": "raw",
            "encoding": "LINEAR16",
            "sampleRateHz": 1600
        };

        let asr = new RivaASRClient();
        let ws = new WebSocket('wss://localhost:8009');
        let ws_state = stateOf.UNDEFINED;

        ws_state = await serverMessage(JSON.stringify(data), false, ws, ws_state, asr);
        expect(ws_state).toBe(stateOf.STARTED);

    });

     test('binary message - after start', async () => {
        var data = {
            "type": "start",
            "language": "en-US",
            "format": "raw",
            "encoding": "LINEAR16",
            "sampleRateHz": 1600
        };

        let asr = new RivaASRClient();
        let ws = new WebSocket('wss://localhost:8009');
        let ws_state = stateOf.UNDEFINED;

        ws_state = await serverMessage(JSON.stringify(data), false, ws, ws_state, asr);
        expect(ws_state).toBe(stateOf.STARTED);
        data = Buffer.alloc(4096);
        ws_state = await serverMessage(data, true, ws, ws_state, asr);
        expect(ws_state).toBe(stateOf.STARTED);

     });

    test('binary message - before start', async () => {
        let ws = new WebSocket('wss://localhost:8009') ;
        let asr = new RivaASRClient();
        let data = Buffer.alloc(4096);
        let ws_state = stateOf.UNDEFINED;
        ws_state = await serverMessage(data, true, ws, ws_state, asr);
        expect(ws_state).not.toBe(stateOf.STARTED);
    });

    test('binary message - after stop', async () => {
    var data = {
            "type": "start",
            "language": "en-US",
            "format": "raw",
            "encoding": "LINEAR16",
            "sampleRateHz": 1600
        };

        let asr = new RivaASRClient();
        let ws = new WebSocket('wss://localhost:8009');
        let ws_state = stateOf.UNDEFINED;

        ws_state = await serverMessage(JSON.stringify(data), false, ws, ws_state, asr);
        expect(ws_state).toBe(stateOf.STARTED);
        data = Buffer.alloc(4096);
        ws_state = await serverMessage(data, true, ws, ws_state, asr);
        expect(ws_state).toBe(stateOf.STARTED);
        data = { "type": "stop" };
        ws_state = await serverMessage(JSON.stringify(data), false, ws ,ws_state, asr);
        expect(ws_state).toBe(stateOf.STOPPED);
        ws_state = await serverMessage(JSON.stringify(data), true, ws, ws_state, asr);
        expect(ws_state).not.toBe(stateOf.STARTED);
    });


    test('riva transcription callback  - initial', () => {

        let ws = new WebSocket('wss://localhost:8009');
        let result = { 'transcript' : undefined};
        transcription_cb(result, ws);
        expect(ws.getMessages()[0]).toBe('{"type":"started"}');
    });

    test('riva transcription callback - started ongoing', () => {

        let ws = new WebSocket('wss://localhost:8009');
        let result = { 'transcript' : "working transcript"};
        transcription_cb(result, ws);
        let output =  { "type": "hypothesis", "alternatives": [{ "text": result.transcript }] };;
        expect(ws.getMessages()[0]).toBe(JSON.stringify(output));
    });

    test('riva transcription callback - last', () => {

        let ws = new WebSocket('wss://localhost:8009');
        let result = { 'transcript' : "working transcript", 'is_final' : true};
        transcription_cb(result, ws);
        let output =  { "type": "recognition", "alternatives": [{ "text": result.transcript }] };

        expect(ws.getMessages()[0]).toBe(JSON.stringify(output));
        expect(ws.getMessages()[1]).toBe(JSON.stringify({"type" : "end", "reason": "Recognition complete"}));
    });

});
