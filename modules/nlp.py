# ==============================================================================
# Copyright 2020 NVIDIA Corporation. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# ==============================================================================
import modules.client.src.jarvis_proto.jarvis_nlp_core_pb2 as jcnlp
import modules.client.src.jarvis_proto.jarvis_nlp_core_pb2_grpc as jcnlp_srv
import modules.client.src.jarvis_proto.jarvis_nlp_pb2 as jnlp
import modules.client.src.jarvis_proto.jarvis_nlp_pb2_grpc as jnlp_srv
import grpc
from config import jarvis_config
import requests
import json
from difflib import SequenceMatcher

channel = grpc.insecure_channel(jarvis_config["JARVIS_API_URL"])
jarvis_nlp = jnlp_srv.JarvisNLPStub(channel)
jarvis_cnlp = jcnlp_srv.JarvisCoreNLPStub(channel)

# TODO: parameterize NER entity types
ner_entity_dict = {'LOC': 'loc', 'PER': 'person', 'ORG': 'org',
                   'problem': 'problem', 'treatment': 'treatment', 'test': 'test'}


# Compute the entity spans from NER results on the text
# Spans are only the first instance of the token
def compute_spans(text, results):
    spans = []
    for mention in results:
        # TODO: get proper spans from the token classification API. This workaround is imperfect
        # find the longest common subsequence that begins at the start of the mention,
        # since the NER tagger may produce unintended non-contiguous spans
        seq = SequenceMatcher(None, mention.token, text.lower())
        max_seq = 0
        start = 0
        for m_start, t_start, len_seq in seq.get_matching_blocks():
            if m_start > 0:
                break
            if len_seq > max_seq:
                max_seq = len_seq
                start = t_start

        end = start + max_seq
        spans.append({'start': start, 'end': end, 'type': ner_entity_dict[mention.label[0].class_name]})

    return spans


def get_jarvis_output_ner_only(text):
    # Submit a Jarvis NER request, no attempt to retrieve intent/slots
    entities = {}
    try:
        req = jcnlp.TokenClassRequest()
        req.model.model_name = "jarvis_ner_i2b2"
        req.text.append(text)
        resp_ner = jarvis_cnlp.ClassifyTokens(req)
        entities['intent'] = 'output_annotation'
        entities['annotations'] = {
            'spans': compute_spans(text, resp_ner.results[0].results),
            'ents': list(ner_entity_dict.values())
        }
    except Exception as err:
        # An exception occurred
        print("[Jarvis NLU] Error during NLU request (jarvis_ner): {0}".format(err))
        return {'jarvis_error': 'jarvis_error'}

    print(f"[Jarvis NLU] NER response results - \n {resp_ner.results}\n")
    return entities


def get_jarvis_text_classify(text):
    # Submit a Jarvis text classification request, e.g. emotion classification
    response = {}
    try:
        req = jcnlp.TextClassRequest()
        req.model.model_name = "jarvis_emotion_empush"
        req.text.append(text)
        resp_classify = jarvis_cnlp.ClassifyText(req)
        response['annotations'] = {
            'class_name': resp_classify.results[0].labels[0].class_name,
            'class_score': resp_classify.results[0].labels[0].score
        }
    except Exception as err:
        # An exception occurred
        print("[Jarvis NLU] Error during NLU request (jarvis_text_classify): {0}".format(err))
        return {'jarvis_error': 'jarvis_error'}

    print(f"[Jarvis NLU] Text classification response results - \n {resp_classify}\n")
    return response


def nlp_analyze(text):
    ent_out = {}
    jarvis_ner = get_jarvis_output_ner_only(text)
    jarvis_classify = get_jarvis_text_classify(text)
    ent_out.update(jarvis_ner)
    ent_out['annotations'].update(jarvis_classify['annotations'])

    return ent_out
