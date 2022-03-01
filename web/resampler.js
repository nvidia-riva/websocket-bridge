/*
 * SPDX-FileCopyrightText: Copyright (c) 2022 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

var outSampleRate = 16000;
var inSampleRate;

this.onmessage = function(msg) {
    switch(msg.data.command){
      case 'init':
        init(msg.data.config);
        break;
      case 'convert':
        convert(msg.data.buffer);
        break;
    }
}

function init(config) {
    inSampleRate = config.sampleRate;
    outSampleRate = config.outSampleRate || outSampleRate;
}

function convert(data) {
    var resampled;
    var output = {};
    resampled = resample(data, inSampleRate, outSampleRate);
    output.resampled = floatTo16BitPCM(resampled);
	output.command = 'newBuffer';
	this.postMessage(output);
}

/**
* Resample an audio buffer, adapted from http://stackoverflow.com/a/28977136/552182
*/
function resample(data, inRate, outRate) {
    var fitCount = Math.round(data.length * (outRate / inRate));
    var newData = new Array();
    var springFactor = new Number((data.length - 1) / (fitCount - 1));
    newData[0] = data[0];
    for ( var i = 1; i < fitCount - 1; i++) {
        var tmp = i * springFactor;
        var before = new Number(Math.floor(tmp)).toFixed();
        var after = new Number(Math.ceil(tmp)).toFixed();
        var atPoint = tmp - before;
        newData[i] = linearInterpolate(data[before], data[after], atPoint);
    }
    newData[fitCount - 1] = data[data.length - 1];
    return newData;
}

function linearInterpolate(before, after, atPoint) {
    return before + (after - before) * atPoint;
}

/*
* Convert Float32Array from the AudioBuffer into Int16Array/PCM
*/
function floatTo16BitPCM(input) {
    let output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        let s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
}