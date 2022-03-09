const asr = jest.createMockFromModule('../asr');

class ASRPipe {
    setupASR(sampleRateHz = 1600,
             languageCode ='en-US',
             encoding = 2,
             maxAlts = 1,
             punctuate = true) {
    };

    mainASR(cb) {
        console.log("clean this up");
        cb({'test' : 'output'});
    }

}

module.exports = ASRPipe;
