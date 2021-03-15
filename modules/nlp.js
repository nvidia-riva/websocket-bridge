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
var entityLinkingProto = 'src/entity_linking.proto';
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

// Jarvis modules
var nlpCorePkgDef = protoLoader.loadSync(nlpCoreProto, protoOptions);
var jCoreNLP = grpc.loadPackageDefinition(nlpCorePkgDef).nvidia.jarvis.nlp;
var nlpClient = new jCoreNLP.JarvisCoreNLP(process.env.JARVIS_API_URL, grpc.credentials.createInsecure());

// Entity linking module
var entityLinkingPkgDef = protoLoader.loadSync(entityLinkingProto, protoOptions);
var entityLinking = grpc.loadPackageDefinition(entityLinkingPkgDef).entitylinking;
var entityLinkingClient = new entityLinking.EntityLinking(process.env.ENTITY_LINKING_URL, grpc.credentials.createInsecure());

var supported_entities = process.env.JARVIS_NER_ENTITIES.split(',');
var supported_negations = ['absent', 'hypothetical', 'possible'];

// TODO: use async more effectively to batch over the whole utterance
function getUMLSConcepts(text, threshold=0.3) {
    var results = [];
    var top_n = 3;
    req = {
        query: [text],
        top_n: top_n,
        sim_threshold: threshold
    };

    return new Promise(function(resolve, reject) {
        entityLinkingClient.LinkEntity(req, function(err, response) {
            if (err) {
                console.log('[Entity Linking] Error during Entity Linking request: ' + err);
                reject(err);
            } else {
                // TODO: convert this to forEach
                for (let idx = 0; idx < response.results[0].result.length; idx++) {
                    results.push({
                        'cui': response.results[0].result[idx].entity_cui,
                        'term': response.results[0].result[idx].rep_sent,
                        'score': response.results[0].result[idx].sim_score
                    });
                };
                resolve(results);
            };
        });
    });
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
function computeSpansByAlignment(text, results) {
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
    return spans;
}

// Compute the entity spans from NER results on the text
// In this case, the model outputs an IOB-tagged sequence (one label per token)
// and we get the entity spans ourselves.
// This is a bit more reliable than the heuristic alignment method above
function computeSpansFromIOB(text, results, cutPrefix=true) {
    var spans = [];
    var text_lc = text.toLowerCase();
    var ind = [];
    var prefix = cutPrefix ? 2 : 0;
    var start = 0;
    var end;
    
    // get token alignments from the original string
    results.forEach(function(res, i) {
        ind.push(text_lc.indexOf(res.token, start));
        start = ind[ind.length - 1] + res.token.length;
    });

    // find entity mentions from IOB-tagged tokens
    results.forEach(function(res, i) {
        if(res.label[0].class_name == 'O') {
            return;
        }

        // merge this token with the previous entity?
        if (spans.length > 0) {
            last_ent = spans.length - 1;
            if (res.label[0].class_name[0] == 'I' && spans[last_ent]['type'] == res.label[0].class_name.substr(prefix)) {
                start = spans[last_ent]['start'];
                end = ind[i] + res.token.length;
                spans[last_ent]['text'] = text.substr(start, end - start);
                spans[last_ent]['end'] = end;
                return;
            }
        }

        // remove B- or I- prefix from the tag
        start = ind[i];
        end = start + res.token.length;
        spans.push({
            'text': text.substr(start, end - start),
            'type': res.label[0].class_name.substr(prefix),
            'start': start,
            'end': end
        });
    });

    return spans;

};

function computeSpans(text, results) {
    if (process.env.JARVIS_NER_IOB) {
        return computeSpansFromIOB(text, results);
    } else {
        return computeSpansByAlignment(text, results);
    }
};

function getJarvisNegation(text) {
    var negations;
    // Submit a Jarvis negation request -- same interface as NER
    req = {
        text: [text],
        model: {
            model_name: process.env.JARVIS_NEGATION_MODEL
        }
    };

    return new Promise(function(resolve, reject) {
        nlpClient.ClassifyTokens(req, function(err, resp_neg) {
            if (err) {
                console.log('[Jarvis NLU] Error during NLU request (jarvis_negation): ' + err);
                reject(err);
            } else {
                negations = computeSpansFromIOB(text, resp_neg.results[0].results, cutPrefix=false);
                resolve(negations);
            }
        });
    });

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
                resolve({ner: computeSpans(text, resp_ner.results[0].results),
                    ents: supported_entities});
            }
        });
    }).then(function(annotations) {
        if (annotations.ner.length == 0 || !process.env.JARVIS_NEGATION_MODEL) {
            return annotations;
        }

        // Determine if any of the entities are negated (e.g. "No evidence of X")
        return getJarvisNegation(text)
        .then(function(negations) {
            negations.forEach(function(negSpan) {
                if (!supported_negations.includes(negSpan.type)) {
                    return;
                }
                annotations.ner.forEach(function(entity, i, ents) {
                    if (entity.start <= negSpan.start && entity.end >= negSpan.end) {
                        ents[i]['assertion'] = negSpan.type;
                    }
                })
            });
            return annotations;
        }, function(error) {
            console.log('Error with negation: ' + error);
        });
    }).then(function(annotations) {
        if (annotations.ner.length == 0 || process.env.CONCEPT_MAP != 'UMLS') {
            return annotations;
        }

        // Perform entity linking on the NER results
        return Promise.map(annotations.ner, async function(entity) {
            if (entity.type == 'o') {
                entity.concepts = [];
                return entity;
            } else {
                entity.concepts = await getUMLSConcepts(entity.text);
                return entity;
            }
        }).then(function(ner) {
            annotations.ner = ner;
            return annotations;
        });

    })
};

module.exports = {getJarvisNer};