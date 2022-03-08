import WS from 'ws';
import WebSocket from 'ws';

//import 'regenerator-runtime/runtime'


describe('server intergration tests', () => {

    test('start message', (done) => {

        var data = {
            "type": "start",
            "language": "en-US",
            "format": "raw",
            "encoding": "LINEAR16",
            "sampleRateHz": 1600
        };
        console.log("start message");
        var wsc = new WebSocket('ws://localhost:8009');
        console.log(wsc);
        wsc.on('connect', function open() {
            const array = new Float32Array(5);

            for (var i = 0; i < array.length; ++i) {
                array[i] = i / 2;
            }
            ws.send(array);
        });

        wsc.on('message', function message(data) {
            console.log('received %s', data);
        });

        wsc.connect('ws://localhost:8009')
    });
});

// test('stop message', async () => {
//     var data = {
//         "type": "stop",
//     };
//     let asr = new ASRPipe();
//     let ws = new WebSocket();
//     await audioCodesControlMessage(JSON.stringify(data), asr, ws);s
// })
