/**
 * Copyright 2020 NVIDIA Corporation. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

require('dotenv').config({path: 'env.txt'});

var nlpCoreProto = 'src/jarvis_proto/jarvis_nlp_core.proto';
var protoRoot = __dirname + '/protos/';
var grpc = require('grpc');
var protoLoader = require('@grpc/proto-loader');
var Promise = require('bluebird');
const { request } = require('express');
var protoOptions = {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [protoRoot]
};
var nlpCorePkgDef = protoLoader.loadSync(nlpCoreProto, protoOptions);

var jCoreNLP = grpc.loadPackageDefinition(nlpCorePkgDef).nvidia.jarvis.nlp;
var nlpClient = new jCoreNLP.JarvisCoreNLP(process.env.JARVIS_API_URL, grpc.credentials.createInsecure());

var supported_entities = process.env.JARVIS_NER_ENTITIES.split(',');

const pythonBridge = require('python-bridge');
const python = pythonBridge();
var umlsReady = false;
python.ex`
    from quickumls import get_quickumls_client
    import json
    `;

async function getUMLSConcepts(text, threshold = 0.9) {
    var results;
    if (!umlsReady) {
        setupUMLS()
        .catch(e => { console.log('Error when initializing UMLS interface: ' + e.message); });    
    }
    try {
        results = JSON.parse(await python`json.dumps(getUMLSResult(${text}, ${threshold}))`);
        console.log(results);
        return results;
    } catch(e) {
        console.log(e);
    }
}

// set up UMLS concept mapper
async function setupUMLS() {
    try {
        python.ex`umls_matcher = get_quickumls_client()`;
        python.ex`
            def getUMLSResult(text, threshold=0.7):
                results = []
                for l1 in umls_matcher.match(text, best_match=True, ignore_syntax=False):
                    for l2 in l1:
                        l2['semtypes'] = sorted(l2['semtypes'])
                        if l2['similarity'] > threshold:
                            results.append(l2)
                return results
            `
        umlsReady = true;
        getUMLSConcepts('metformin')
        .then(results => {
            if (results[0]['cui'] == 'C0025598') {
                console.log('UMLS is ready');
            } else {
                console.log('ERROR: unexpected UMLS result in post-initialization check.');
            }
        })
        .catch(e => { console.log('Error accessing UMLS: ' + e.message); });
    } catch(e) {
        console.log(e);
    }
};

// Find the longest common subsequence that begins at the start of the mention,
// since the NER tagger may produce unintended non-contiguous spans
findMentionMatch = function(text, start, mention) {
	var comparisons = []; // 2D Array; longest common subsequence ending at this i-j index
	var maxSubStrLength = 0;
	var lastMaxSubStrIndex = -1;
    var i, j, char1, char2, startIndex;

	for (i = start; i < text.length; ++i) {
		comparisons[i] = new Array();

		for (j = 0; j < mention.length; ++j) {
			char1 = text.charAt(i);
			char2 = mention.charAt(j);

			if (char1 === char2) {
				if (i > start && j > 0) {
					comparisons[i][j] = comparisons[i - 1][j - 1] + 1;
				} else {
					comparisons[i][j] = 1;
				}
			} else {
				comparisons[i][j] = 0;
			}

            // We only keep track of the matches that begin at char 0 of mention
			if (comparisons[i][j] > maxSubStrLength && comparisons[i][j] === j + 1) {
				maxSubStrLength = comparisons[i][j];
				lastMaxSubStrIndex = i;
			}
		}
	}

	if (maxSubStrLength > 0) {
		startIndex = lastMaxSubStrIndex - maxSubStrLength + 1;
		return {substr: text.substr(startIndex, maxSubStrLength), start: startIndex};
	}

	return null;
}

// Compute the entity spans from NER results on the text
// We use heuristics to align the entity text with start/end character spans
// Start/end character spans from the Jarvis API are forthcoming in a later release
function computeSpans(text, results) {
    var spans = [];
    var searchStart = 0;
    var match, prefix;

    results.forEach(mention => {
        match = findMentionMatch(text.toLowerCase(), searchStart, mention.token);
        if (match == null) {
            return;
        }
        prefix = match.substr.trim();
        searchStart = match.start + prefix.length;
        spans.push({
            'start': match.start,
            'end': searchStart,
            'type': mention.label[0].class_name.toLowerCase(),
            'text': text.substr(match.start, searchStart - match.start)
        });
    });
    if (process.env.CONCEPT_MAP != 'UMLS') {
        return Promise.resolve(spans);
    } else {
        return Promise.map(spans, async function(span) {
            span.concepts = await getUMLSConcepts(span.text);
            return span;
        })
    }
};

function getJarvisNer(text) {
    // Submit a Jarvis NER request
    var entities;
    req = {
        text: [text],
        model: {
            model_name: process.env.JARVIS_NER_MODEL
        }
    };

    return new Promise(function(resolve, reject) {
        nlpClient.ClassifyTokens(req, function(err, resp_ner) {
            if (err) {
                console.log('[Jarvis NLU] Error during NLU request (jarvis_ner): ' + err);
                reject(err);
            } else {
                computeSpans(text, resp_ner.results[0].results)
                .then(entities => {
                    if (entities.length > 0) {
                        console.log('[Jarvis NLU] NER response results');
                        console.log(entities);
                    }
                    resolve({ner: entities, ents: supported_entities});
                });
            }
        });
    });
};

function cleanUp() {
    // Terminate the python-node bridge. This is supposed to clear all the processing queues and such,
    // but it currently still causes a BrokenPipeError that I haven't been able to catch (yet)
    python.end();
}

if (process.env.CONCEPT_MAP == 'UMLS') {
    setupUMLS()
    .catch(e => {
        console.log('Error when initializing UMLS interface: ' + e.message);
    });
}

module.exports = {getJarvisNer, cleanUp};