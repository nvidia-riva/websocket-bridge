
//export { WebSocket as default } from "mock-socket";
class WebSocket {
    constructor() {
        this.msgs = new Array;
    }
    send(data) {
        this.msgs.push(data);
    }
    getMessages() {
        return this.msgs;
    }
}

module.exports = WebSocket;
