//- ----------------------------------
//- 💥 DISPLACY ENT
//- ----------------------------------

//- ----------------------------------
//- Copyright (c) 2020, NVIDIA CORPORATION.  All rights reserved.
//- 
//- Licensed under the Apache License, Version 2.0 (the "License");
//- you may not use this file except in compliance with the License.
//- You may obtain a copy of the License at
//- 
//-     http://www.apache.org/licenses/LICENSE-2.0
//- 
//- Unless required by applicable law or agreed to in writing, software
//- distributed under the License is distributed on an "AS IS" BASIS,
//- WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//- See the License for the specific language governing permissions and
//- limitations under the License.
//- ----------------------------------


//- ----------------------------------
//- The MIT License (MIT)
//- 
//- Copyright (C) 2016 ExplosionAI UG (haftungsbeschränkt)
//- 
//- Permission is hereby granted, free of charge, to any person obtaining a copy
//- of this software and associated documentation files (the "Software"), to deal
//- in the Software without restriction, including without limitation the rights
//- to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//- copies of the Software, and to permit persons to whom the Software is
//- furnished to do so, subject to the following conditions:
//- 
//- The above copyright notice and this permission notice shall be included in
//- all copies or substantial portions of the Software.
//- 
//- THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//- IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//- FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//- AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//- LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//- OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
//- THE SOFTWARE.
//- ----------------------------------

'use strict';

class displaCyENT {
    constructor (api, options) {
        this.api = api;
        this.container = document.querySelector(options.container || '#displacy');

        this.defaultText = options.defaultText || 'When Sebastian Thrun started working on self-driving cars at Google in 2007, few people outside of the company took him seriously.';
        this.defaultModel = options.defaultModel || 'en';
        this.defaultEnts = options.defaultEnts || ['person', 'org', 'gpe', 'loc', 'product'];

        this.onStart = options.onStart || false;
        this.onSuccess = options.onSuccess || false;
        this.onError = options.onError || false;
        this.onRender = options.onRender || false;

    }

    parse(text = this.defaultText, model = this.defaultModel, ents = this.defaultEnts) {
        if(typeof this.onStart === 'function') this.onStart();

        let xhr = new XMLHttpRequest();
        xhr.open('POST', this.api, true);
        xhr.setRequestHeader('Content-type', 'text/plain');
        xhr.onreadystatechange = () => {
            if(xhr.readyState === 4 && xhr.status === 200) {
                if(typeof this.onSuccess === 'function') this.onSuccess();
                this.render(text, JSON.parse(xhr.responseText), ents);
            }

            else if(xhr.status !== 200) {
                if(typeof this.onError === 'function') this.onError(xhr.statusText);
            }
        }

        xhr.onerror = () => {
            xhr.abort();
            if(typeof this.onError === 'function') this.onError();
        }

        xhr.send(JSON.stringify({ text, model }));
    }

    render(container, text, spans, ents = null) {
        let offset = 0;

        function conceptTooltip(concepts) {
            var span = document.createElement('span');
            var table = document.createElement('table');
            var thead = document.createElement('thead');
            var tbody = document.createElement('tbody');
            var trow, th, td;

            span.setAttribute('data-toggle', 'tooltip');
            span.setAttribute('data-html', 'true');

            table.setAttribute('class', 'tooltip-table table-sm table-borderless');
            trow = document.createElement('tr');
            th = document.createElement('th');
            th.appendChild(document.createTextNode('Concept'));
            trow.appendChild(th);
            th = document.createElement('th');
            th.appendChild(document.createTextNode('CUI'));
            trow.appendChild(th);
            thead.appendChild(trow);
            table.appendChild(thead);
            concepts.forEach(concept => {
                trow = document.createElement('tr');
                td = document.createElement('td');
                td.appendChild(document.createTextNode(concept.term));
                trow.appendChild(td);
                td = document.createElement('td');
                td.appendChild(document.createTextNode(concept.cui));
                trow.appendChild(td);
                tbody.appendChild(trow);
            });
            table.appendChild(tbody);
            span.setAttribute('title', table.outerHTML);
            return span;
        }

        spans.forEach(({ type, start, end, assertion, concepts }) => {
            const entity = text.slice(start, end);
            const fragments = text.slice(offset, start).split('\n');

            fragments.forEach((fragment, i) => {
                container.appendChild(document.createTextNode(fragment));
                if(fragments.length > 1 && i != fragments.length - 1) container.appendChild(document.createElement('br'));
            });

            if(ents == undefined || ents.includes(type.toLowerCase())) {
                var mark = document.createElement('mark');
                mark.setAttribute('data-entity', type.toLowerCase());
                if (assertion != undefined) {
                    mark.setAttribute('negation', assertion);
                }
                mark.appendChild(document.createTextNode(entity));
                if (concepts != undefined && concepts.length > 0) {
                    var span = conceptTooltip(concepts);
                    span.appendChild(mark);
                    container.appendChild(span);
                } else {
                    container.appendChild(mark);
                }
            } else {
                container.appendChild(document.createTextNode(entity));
            }

            offset = end;
        });

        container.appendChild(document.createTextNode(text.slice(offset, text.length)));
        if(typeof this.onRender === 'function') this.onRender();
    }
}
