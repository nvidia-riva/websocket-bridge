
// const { audioCodesControlMessage, wsServerConnection, wsServerClose } = require('../modules/audiocodes');
// const ASRPipe = require('../riva_client/asr');
// import WS from 'ws';
// import WebSocket from 'ws';
// import 'regenerator-runtime/runtime'

// beforeAll(async () => {
//     console.log("before each - start");
//     // create a WS instance, listening on port 1234 on localhost
//     const server = new WS("ws://localhost:1234");
//     console.log("before each - server");
//     await server.connected;
//     console.log("before each - connected");
//     server.send("");
//     console.log("before each - send");
// });


// describe('audioCodes', () => {

//     test('start message', (done) => {
//         var data = {
//             "type": "start",
//             "language": "en-US",
//             "format": "raw",
//             "encoding": "LINEAR16",
//             "sampleRateHz": 1600
//         };
//         console.log("start message");
//         let asr = new ASRPipe();
//         audioCodesControlMessage(JSON.stringify(data), asr, ws);


//     })
// });

// test('stop message', async () => {
//     var data = {
//         "type": "stop",
//     };
//     let asr = new ASRPipe();
//     let ws = new WebSocket();
//     await audioCodesControlMessage(JSON.stringify(data), asr, ws);s
// })
