import 'regenerator-runtime/runtime'
const { audioCodesControlMessage, wsServerConnection, wsServerClose } = require('../modules/audiocodes');
import ASRPipe from '../riva_client/asr';
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

        let asr = new ASRPipe();
        let ws = new WebSocket('wss://localhost:8009');
        audioCodesControlMessage(JSON.stringify(data), asr, ws);
        expect(ws.getMessages()[0]).toBe('{"type":"started"}', '{"type":"started"}f');
    });


    test('stop message', async () => {
        var data = {
            "type": "stop",
        };
        let asr = new ASRPipe();
        let ws = new WebSocket('wss://localhost:8009');
        audioCodesControlMessage(JSON.stringify(data), asr, ws);
        expect(ws.getMessages()[0]).toBe('{"type":"end","reason":"RIVA service stopped"}');
    });

    test('binary message - after start', async () => {
        // send a binary frame.

    }

    test('binary message - before start', async () => {
        // send a binary frame.

    }

    test('binary message - after stop', async () => {
        // send a binary frame.
    }

});
