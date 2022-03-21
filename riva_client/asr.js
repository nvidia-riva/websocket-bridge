/*
 * SPDX-FileCopyrightText: Copyright (c) 2022 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

require('dotenv').config({ path: 'env.txt' });
var grpc = require('@grpc/grpc-js');
var protoLoader = require('@grpc/proto-loader');
const { request } = require('express');


const defaultRate = 16000;
const languageCode = 'en-US';
const { Transform } = require('stream');

var protoRoot = __dirname + '/protos/riva/proto/';

var asrProto = 'riva_asr.proto';
var audioProto = 'riva_audio.proto';

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
var audioPkgDef = protoLoader.loadSync(audioProto, protoOptions);
var rAudio = grpc.loadPackageDefinition(audioPkgDef).nvidia.riva;
const Encodings = {
    ENCODING_UNSPECIFIED: rAudio.AudioEncoding.type.value[0].name,
    LINEAR_PCM : rAudio.AudioEncoding.type.value[1].name,
    FLAC : rAudio.AudioEncoding.type.value[2].name,
    MULAW: rAudio.AudioEncoding.type.value[3].name,
    ALAW: rAudio.AudioEncoding.type.value[4].name,
}

/*
 * RivaASRclient is a grpc Client implementing the Riva API for ASR - Recognize and RecognizeStreaming requests.
 *
 */

class RivaASRClient {

    setupASR(sampleRateHz = 1600,
             languageCode ='en-US',
             encoding = Encodings.LINEAR_PCM,
             maxAlts = 1,
             punctuate = true)   {
        this.asrClient = new rasr.RivaSpeechRecognition(process.env.RIVA_API_URL, grpc.credentials.createInsecure());
        this.firstRequest = {
            streaming_config: {
                config: {
                    encoding: encoding,
                    sample_rate_hertz: sampleRateHz,
                    language_code: languageCode,
                    max_alternatives: maxAlts,
                    enable_automatic_punctuation: true
                },
                interim_results: true
            }
        };
        this.numCharsPrinted = 0;
        return true;
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
                transcription_cb({
                    error: error
                });
            })
            .on('end', () => {
                console.log('StreamingRecognize end');
            });

        this.recognizeStream.write(this.firstRequest);
    }
}

module.exports = RivaASRClient;
