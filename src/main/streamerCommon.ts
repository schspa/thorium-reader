// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import * as debug_ from "debug";
import * as path from "path";
import { computeReadiumCssJsonMessage } from "readium-desktop/common/computeReadiumCssJsonMessage";
import { ReaderConfig } from "readium-desktop/common/models/reader";
import { diMainGet } from "readium-desktop/main/di";
import { _NODE_MODULE_RELATIVE_URL, _PACKAGING } from "readium-desktop/preprocessor-directives";

import { IEventPayload_R2_EVENT_READIUMCSS } from "@r2-navigator-js/electron/common/events";
import { Publication as R2Publication } from "@r2-shared-js/models/publication";
import { Link } from "@r2-shared-js/models/publication-link";
import { Transformers } from "@r2-shared-js/transform/transformer";
import { TransformerHTML } from "@r2-shared-js/transform/transformer-html";

const debug = debug_("readium-desktop:main#streamerCommon");

export function computeReadiumCssJsonMessageInStreamer(
    _r2Publication: R2Publication,
    _link: Link | undefined,
    sessionInfo: string | undefined,
): IEventPayload_R2_EVENT_READIUMCSS {

    const winId = Buffer.from(sessionInfo || "", "base64").toString("utf-8");
    debug("winId:", winId);

    let settings: ReaderConfig;
    if (winId) {

        const store = diMainGet("store");
        const state = store.getState();

        try {
            settings = state.win.session.reader[winId].reduxState.config;

            debug("PAGED: ", settings.paged, "colCount:", settings.colCount);

        } catch (err) {
            settings = state.reader.defaultConfig;

            debug("settings from default config");
            debug("ERROR", err);
        }
    } else {

        const store = diMainGet("store");
        settings = store.getState().reader.defaultConfig;
    }

    return computeReadiumCssJsonMessage(settings);
}

let mathJaxPath = "MathJax";
if (_PACKAGING === "1") {
    mathJaxPath = path.normalize(path.join(__dirname, mathJaxPath));
} else {
    mathJaxPath = "mathjax";
    mathJaxPath = path.normalize(path.join(__dirname, _NODE_MODULE_RELATIVE_URL, mathJaxPath));
}
mathJaxPath = mathJaxPath.replace(/\\/g, "/");
debug("MathJax path:", mathJaxPath);

export const MATHJAX_FILE_PATH = mathJaxPath;
export const MATHJAX_URL_PATH = "math-jax";

let rcssPath = "ReadiumCSS";
if (_PACKAGING === "1") {
    rcssPath = path.normalize(path.join(__dirname, rcssPath));
} else {
    rcssPath = "r2-navigator-js/dist/ReadiumCSS";
    rcssPath = path.normalize(path.join(__dirname, _NODE_MODULE_RELATIVE_URL, rcssPath));
}

rcssPath = rcssPath.replace(/\\/g, "/");
debug("readium css path:", rcssPath);

export const READIUMCSS_FILE_PATH = rcssPath;

export function setupMathJaxTransformer(getUrl: () => string) {

    const transformerMathJax = (
        _publication: R2Publication, _link: Link, _url: string | undefined, str: string): string => {

        // TODO: extract this drag logic somewhere else ...
        const cssElectronMouseDrag =
            `
    <style type="text/css">
    *,
    *::after,
    *::before {
        -webkit-user-drag: none !important;
        -webkit-app-region: no-drag !important;
    }
    </style>
    `;
        str = str.replace(/<\/head>/, `${cssElectronMouseDrag}</head>`);

        const scriptTextDrag =
            `
    <script type="text/javascript">
    // document.addEventListener("DOMContentLoaded", () => {
    // });
    window.addEventListener("load", () => {
        setTimeout(() => {
            document.addEventListener("dragstart", (e) => {
                const sel = document.getSelection();
                if (sel &amp;&amp; !sel.isCollapsed) {
                    // e.dataTransfer.setData("Text", "_");
                    e.preventDefault();
                }
            });
        }, 100);
    });
    </script>
    `;
        str = str.replace(/<\/head>/, `${scriptTextDrag}</head>`);

        const store = diMainGet("store");
        // TODO
        // Same comment that above
        const settings = store.getState().reader.defaultConfig;

        if (settings.enableMathJax) {
            const thorium_mathJax_script = "thorium_mathJax_script";
            const script = `
<script id='${thorium_mathJax_script}' type="text/javascript">
// document.addEventListener("DOMContentLoaded", () => {
// });
window.addEventListener("load", () => {
    setTimeout(() => {
        var thisEl = document.getElementById('${thorium_mathJax_script}');

        if (window.MathJax) {
            var msg = 'window.MathJax already exist, SKIP.';
            if (thisEl) {
                thisEl.setAttribute('data-msg', msg);
            }
            console.log(msg);
            return;
        }

        if (document.getElementById('__${thorium_mathJax_script}')) {
            var msg = '${thorium_mathJax_script} already exist, SKIP.';
            if (thisEl) {
                thisEl.setAttribute('data-msg', msg);
            }
            console.log(msg);
            return;
        }

        window.MathJax = {
            startup: {
                ready: () => {

                    var msg = 'MathJax is loaded, but not yet initialized';
                    if (thisEl) {
                        thisEl.setAttribute('data-msg', msg);
                    }
                    console.log(msg);

                    window.MathJax.startup.defaultReady();

                    msg = 'MathJax is initialized, and the initial typeset is queued';
                    if (thisEl) {
                        thisEl.setAttribute('data-msg', msg);
                    }
                    console.log(msg);

                    window.MathJax.startup.promise.then(() => {
                        var msg = 'MathJax initial typesetting complete';
                        if (thisEl) {
                            thisEl.setAttribute('data-msg', msg);
                        }
                        console.log(msg);
                    });
                }
            }
        };

        var msg = 'Thorium MathJax ...';
        if (thisEl) {
            thisEl.setAttribute('data-msg', msg);
        }
        console.log(msg);

        var scriptEl = document.createElement('script');
        scriptEl.setAttribute('id', '__${thorium_mathJax_script}');
        // scriptEl.setAttribute('async', 'async');
        scriptEl.setAttribute('onload', 'javascript:console.log("Thorium MathJax LOADED.")');
        scriptEl.setAttribute('src', '${getUrl()}');
        document.head.appendChild(scriptEl);
    }, 500);
});
</script>
`;
            // <script type="text/javascript" async="async" src="${getUrl()}"> </script>
            return str.replace(/<\/head>/, `${script}</head>`);
        } else {
            return str;
        }
    };
    Transformers.instance().add(new TransformerHTML(transformerMathJax));
}
