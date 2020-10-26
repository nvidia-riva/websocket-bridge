//- ----------------------------------
//- 💥 DISPLACY ENT
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
            // span.style.position = 'relative';
            // span.style.zIndex = '9999';

            table.setAttribute('class', 'tooltip-table table-sm');
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
            // mark.setAttribute('title', 'test content');
            return span;
        }

        spans.forEach(({ type, start, end, concepts }) => {
            const entity = text.slice(start, end);
            const fragments = text.slice(offset, start).split('\n');

            fragments.forEach((fragment, i) => {
                container.appendChild(document.createTextNode(fragment));
                if(fragments.length > 1 && i != fragments.length - 1) container.appendChild(document.createElement('br'));
            });

            if(ents == undefined || ents.includes(type.toLowerCase())) {
                var mark = document.createElement('mark');
                mark.setAttribute('data-entity', type.toLowerCase());
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

        console.log(`%c💥  HTML markup\n%c<div class="entities">${container.innerHTML}</div>`, 'font: bold 16px/2 arial, sans-serif', 'font: 13px/1.5 Consolas, "Andale Mono", Menlo, Monaco, Courier, monospace');

        if(typeof this.onRender === 'function') this.onRender();
    }
}
