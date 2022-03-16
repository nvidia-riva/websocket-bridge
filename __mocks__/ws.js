/*
 * SPDX-FileCopyrightText: Copyright (c) 2022 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

//simple ws mock
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

    on(data, func) {
        if(data == "message") {
            console.log("calling " + func + "");
            func(Buffer.alloc(4096), true);
        } else if (data == 'error') {
            console.log(func);
        }
    }
    message(data) {
        console.log("server ws message is " + data);
        this.msgs.push(data);
    }
}


module.exports = WebSocket;
