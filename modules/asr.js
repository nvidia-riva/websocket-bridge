/*
 * SPDX-FileCopyrightText: Copyright (c) 2022 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

require('dotenv').config({ path: 'env.txt' });

const defaultRate = 16000;
const languageCode = 'en-US';

// Because of a quirk in proto-loader, we use static code gen to get the AudioEncoding enum,
// and dynamic loading for the rest.
const rAudio = require('./protos/riva/proto/riva_audio_pb');

const { Transform } = require('stream');

var asrProto = 'riva/proto/riva_asr.proto';
var protoRoot = __dirname + '/protos/';
var grpc = require('grpc');
var protoLoader = require('@grpc/proto-loader');
const { request } = require('express');
var protoOptions = {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [protoRoot]
};
var asrPkgDef = protoLoader.loadSync(asrProto, protoOptions);

var rasr = grpc.loadPackageDefinition(asrPkgDef).nvidia.riva.asr;

class ASRPipe {
    setupASR(config_data) {
        this.asrClient = new rasr.RivaSpeechRecognition(process.env.RIVA_API_URL, grpc.credentials.createInsecure());
        this.firstRequest = {
            streaming_config: {
                config: {
                    encoding: rAudio.AudioEncoding.LINEAR_PCM,
                    sample_rate_hertz: config_data.sampleRateHz,
                    language_code: config_data.language,
                    max_alternatives: 1,
                    enable_automatic_punctuation: true
                },
                interim_results: true
            }
        };
        this.numCharsPrinted = 0;
    }

    async mainASR(transcription_cb) {
        this.recognizeStream = this.asrClient.streamingRecognize()
            .on('data', function (data) {
                if (data.results == undefined || data.results[0] == undefined) {
                    return;
                }

                // callback sends the transcription results back through the bidirectional socket stream
                transcription_cb({
                    transcript: data.results[0].alternatives[0].transcript,
                    is_final: data.results[0].is_final
                });
            })
            .on('error', (error) => {
                console.log('Error via streamingRecognize callback');
                console.log(error);
            })
            .on('end', () => {
                console.log('StreamingRecognize end');
            });

        this.recognizeStream.write(this.firstRequest);
    }
}

module.exports = ASRPipe;