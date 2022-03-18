/*
 * SPDX-FileCopyrightText: Copyright (c) 2022 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

// simple mock of asr grpc client.

const asr = jest.createMockFromModule('../asr');

class RivaASRClient {

    recognizeStream = {
        write: function(data) {
            return true;
        }
    }
    setupASR(sampleRateHz = 1600,
             languageCode ='en-US',
             encoding = 2,
             maxAlts = 1,
             punctuate = true) {
    };

    mainASR(cb) {
        cb({'test' : 'output'});
    }


}

module.exports = RivaASRClient;
