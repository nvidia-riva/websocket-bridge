
var PROTO_PATH = __dirname + '/protos/riva/proto/riva_asr.proto';


//working from https://grpc.io/docs/languages/node/basics/

var grpc = require('@grpc/grpc-js');
var protoLoader = require('@grpc/proto-loader');


// Suggested options for similarity to existing grpc.load behavior
var pkgDef = protoLoader.loadSync(
    PROTO_PATH,
    {keepCase: true,
     longs: String,
     enums: String,
     defaults: true,
     oneofs: true,
     includeDirs: [
         __dirname + "/protos/riva/proto/"
     ]
    });

var hypo = {
    results: [
        {
            alternatives: [{ words: [], transcript: 'complex sample audio', confidence: 0 }],
            is_final: false,
            stability: 0.10000000149011612,
            channel_tag: 1,
            audio_processed: 8.31999683380127
        }
    ]
};
var final_msg = hypo;
final_msg.results[0].is_final=true;

var protoDef = grpc.loadPackageDefinition(pkgDef).nvidia.riva.asr;
var RivaASRServer = protoDef.RivaSpeechRecognition;
function Recognize(){
    return;
}

/*
 *  Since we response to requests, and dont know how many requests we will get?
 */

function StreamingRecognize(call){
    call.on('data', function(bits) {
        if (bits.streaming_config != undefined) {
            // do we want to do anything with this config msg?

        } else {
            call.write(hypo);
            call.write(final_msg);
        }
    });
    call.on('error', function(err) {
        console.log(err);
    });
    call.on('end', function() {
        call.end();
        console.log("request ended for :");
    });

}
function getASRServer() {

    var ASRServer = new grpc.Server();

    ASRServer.addService(RivaASRServer.service, { //RivaSpeechRecognition.service, {
        Recognize: Recognize,
        StreamingRecognize: StreamingRecognize
    });
    return ASRServer;
}

let server = getASRServer();
let uri = '0.0.0.0:50052';
server.bindAsync(uri, grpc.ServerCredentials.createInsecure(), () => {
    console.log("starting test server at " + uri);
    server.start();
});

/*
  config message looks like:

  {
  streaming_config: {
    config: {
      speech_contexts: [],
      custom_configuration: {},
      encoding: 'LINEAR_PCM',
      sample_rate_hertz: 16000,
      language_code: 'en-US',
      max_alternatives: 1,
      audio_channel_count: 0,
      enable_word_time_offsets: false,
      enable_automatic_punctuation: true,
      enable_separate_recognition_per_channel: false,
      model: '',
      verbatim_transcripts: false
    },
    interim_results: true
  },
  streaming_request: 'streaming_config'
}
*/
