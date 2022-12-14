/*
* Incremental Highlighted Text Movie Maker
* Copyright: 2022 yamasdais @ github
* License: MIT License
*
*/

function getObjectWithInitValue(name, mutator, defaultValue) {
    var ret = document.getElementById(name)
    mutator(ret, localStorage.getItem(name) ?? defaultValue);
    return ret;
}
function storeObjectValue(name, value) {
    localStorage.setItem(name, value);
}

function makePreferenceItem(dict, name, value) {
    dict[name] = value;
}
function loadPreferenceItem(dict, name, e) {
    const value = dict[name];
    e(value);
}

function makeHilighter(lang, text, onChangedLang) {
    const hilighter = lang
        ? () => hljs.highlight(text, { language: lang, ignoreIllegals: true })
        : () => {
            const h = hljs.highlightAuto(text);
            if (h.language !== lang && onChangedLang) {
                onChangedLang(h.language);
            }
            return h;
        };
    return hilighter;
}

/* sample code
auto i = 0;

// foo
template <class T>
auto foo(T&& v) {
    return other(std::forward<T>(v));
}
*/

function makeCanvas(hlarea, width, height, isTransparent) {
    bgC = isTransparent
        ? "transparent"
        : getComputedStyle(hlarea).getPropertyValue('background');
    return htmlToImage.toCanvas(hlarea, {
        width: width,
        height: height,
    });
}

function makePng(elem, width, height, isTransparent) {
    bgC = isTransparent
        ? "transparent"
        : getComputedStyle(elem).getPropertyValue('background');
    return htmlToImage.toPng(elem, {
        width: width,
        height: height,
        backgroundColor: bgC,
    })
}

const makeCursor = function(hlElem, trailingCodeTxt, defaultCursor = ' ') {
    const trail = document.createElement("code");
    trail.innerHTML = trailingCodeTxt || defaultCursor;

    const cursorChar = (trail.textContent.length) > 0 ? trail.textContent.charAt(0) : defaultCursor;
    const canvas = makeCursor.canvas || (makeCursor.canvas = document.createElement("canvas"));
    const context = canvas.getContext("2d");
    context.font = getComputedStyle(hlElem).getPropertyValue('font');
    const metrics = context.measureText(cursorChar);
    const cursorWidth = `${metrics.width}px`;
    const bg = getComputedStyle(hlElem).getPropertyValue('color');
    const cursor = document.createElement("span");
    cursor.textContent = cursorChar;
    cursor.style.background = bg;
    cursor.style.marginRight = `-${cursorWidth}`;
    cursor.style.width = cursorWidth;
    cursor.classList.add("mulavieg-cursor");

    return cursor;
}

/*
 * Movie format selection stuff
 */
class MovieFormatItem {
    makeCmdFFmpegRun; 
    constructor(name, ext, mime, cmdFFmpegRun) {
        this.name = name;
        this.ext = ext;
        this.mime = mime;
        this.makeCmdFFmpegRun = cmdFFmpegRun || function(fname, width, height, fps) {
            return [
                '-r', `${fps}`,
                '-pattern_type', 'glob', '-i', 'image*.png',
                '-s', `${width}x${height}`,
                '-pix_fmt', 'yuva420p',
                fname
            ];
        };
    }
}

function* getSupportedMovieFormats() {
    yield new MovieFormatItem("mp4", "mp4", "video/mp4",
        (fname, width, height, fps) => {
            const mvWidth = (width % 2) ? width - 1 : width;
            const mvHeight = (height % 2) ? height - 1 : height;
            let ret = [
                '-r', `${fps}`,
                '-pattern_type', 'glob', '-i', 'image*.png',
                '-vf', `scale=${mvWidth}:-2`, "-sws_flags", "lanczos+accurate_rnd",
                '-pix_fmt', 'yuva420p',
                '-c:v', 'libx264', '-crf', '8',
                fname
            ];

            return ret;
        });
    yield new MovieFormatItem("webm", "webm", "video/webm",
        (fname, width, height, fps) => {
            let ret = [
                '-r', `${fps}`,
                '-pattern_type', 'glob', '-i', 'image*.png',
                '-s', `${width}x${height}`,
                '-pix_fmt', 'yuva420p', '-auto-alt-ref', '0',
                '-c:v', 'libvpx', '-lossless', '1',
                fname
            ];

            return ret;
        });
    yield new MovieFormatItem("webp", "webp", "image/webp",
        (fname, width, height, fps) => {
            let ret = [
                '-r', `${fps}`,
                '-pattern_type', 'glob', '-i', 'image*.png',
                '-s', `${width}x${height}`,
                '-vcodec', 'libwebp', '-lossless', '1',
                '-pix_fmt', 'yuva420p',
                fname
            ];

            return ret;
        });
}

function makeMovieFormats(onChange) {
    const formatDict = {}
    selector = document.getElementById("movieFormat");
    initVal = localStorage.getItem("movieFormat");
    for (format of getSupportedMovieFormats()) {
        formatDict[format.name] = format;
        opt = document.createElement("option")
        opt.value = format.name;
        opt.textContent = format.name;
        if (initVal === format.name) {
            opt.selected = true;
        }
        selector.appendChild(opt);
    }

    selector.addEventListener("change", obj => {
        const cur = selector.options[selector.selectedIndex].value;
        onChange(formatDict[cur]);
        localStorage.setItem("movieFormat", cur);
    });

    return formatDict[selector.options[selector.selectedIndex].value];
}

function setupMenu(makePreference, reflectPreference) {
    const menu = document.getElementById("menuArea");
    const menuList = document.getElementById("menuList");
    menu.addEventListener("mouseenter", obj => {
        menuList.classList.add("visibleDropdown");
    })
    menu.addEventListener("mouseleave", obj => {
        menuList.classList.remove("visibleDropdown");
    })
    for (const item of menuList.querySelectorAll("a")) {
        const name = new URL(item.href).hash;
        const dialog = document.querySelector(name);
        const cancel = dialog.querySelector(".cancelBtn");
        if (cancel !== undefined) {
            cancel.addEventListener("click", obj => {
                dialog.close();
            });
        }
        item.addEventListener("click", obj => {
            menuList.classList.remove("visibleDropdown");
            if (name === "#callTemplate") {
                updateTemplateList();
            }
            dialog.showModal();
        })
    }

    const loadTemplate = function() {
        const storedText = localStorage.getItem("templatePrefs");
        return storedText !== null ? JSON.parse(storedText) : {};
    };
    // callTemplate
    const selector = document.getElementById("templateSelector");
    const callButton = document.getElementById("doCallTemplate");
    var tmpls = null;
    const updateTemplateList = function() {
        tmpls = loadTemplate();
        const keys = Object.keys(tmpls);
        while (selector.lastChild) {
            selector.removeChild(selector.lastChild);
        }
        if (keys && keys.length) {
            selector.disabled = false;
            callButton.disabled = false;
            for (const key of keys) {
                selector.add(new Option(tmpls[key].name, key));
            }
        } else {
            const item = new Option("No template available", "", true, true);
            item.disabled = true;
            selector.disabled = true;
            callButton.disabled = true;
            selector.add(item);
        }
    }
    callButton.addEventListener("click", obj => {
        var cur = selector.options[selector.selectedIndex];
        var pref = tmpls[cur.value];
        reflectPreference(pref);
        document.getElementById("callTemplate").close();
    })

    // storeTemplate
    const templateName = document.getElementById("storeTemplateName");
    const storeButton = document.getElementById("doStoreTemplate");
    templateName.addEventListener("input", obj => {
        storeButton.disabled = templateName.value.length == 0;
    });
    storeButton.addEventListener("click", obj => {
        const pref = makePreference(templateName.value);
        const dict = loadTemplate();
        const uuid = UUID.generate();

        dict[uuid] = pref;
        localStorage.setItem("templatePrefs", JSON.stringify(dict));
        document.getElementById("storeTemplate").close();
    });
}

/*
 * Interruption support stuff
 */
class InterruptionStatus {
    #isRunning;
    constructor() {
        this.#isRunning = false;
    }

    start() {
        this.#isRunning = true;
        document.body.classList.add('waiting');
    }
    stop() {
        document.body.classList.remove('waiting');
        this.#isRunning = false;
    }
    get isStarted() {
        return this.#isRunning;
    }
}

async function makeCodeHighlighter(param) {
    const text = param.text;
    const textLen = param.text.length;
    const beginAt = param.beginAt;
    const endAt = param.endAt;
    const fps = param.fps;
    const duration = param.duration;
    const totalCycles = Math.abs(endAt - beginAt);
    const totalFrames = fps * duration / 1000;
    const incPerFrame = Math.max(totalCycles / totalFrames, 1);
    const onHighlited = param.onHighlited;
    const isReversed = beginAt > endAt;
    if (!param.lang) {
        throw Error("Language is not specified");
    }
    const highlighter = text => text
        ? hljs.highlight(text, { language: param.lang, ignoreIllegals: true }).value
        : "";
    const range = function*() {
        let cur = beginAt;
        const next = isReversed
            ? v => v - incPerFrame
            : v => v + incPerFrame;
        const cond = isReversed
            ? (c, e) => e < c
            : (c, e) => c < e;
        while (cond(cur, endAt)) {
            yield Math.round(cur);
            cur = next(cur);
        }
        //yield cur;
    }
    let prevCache, trailCache, cursorCache;
    
    const makePrecede = isReversed
        ? cur => {
            return prevCache == undefined || cur == undefined
                ? (prevCache = text.substring(0, beginAt))
                : (prevCache = text.substring(0, cur - 1));
        }
        : cur => {
            return (prevCache = (cur == undefined ? text.substring(0, beginAt) : text.substring(0, cur + 1)))
        };
    const makeTrailing =  isReversed
        ? cur => {
            return trailCache == undefined || cur == undefined
                ? (trailCache = text.substring(beginAt, textLen))
                : trailCache
        }
        : cur => {
            return trailCache == undefined || cur == undefined
                ? (trailCache = text.substring(endAt, textLen))
                : trailCache;
        };
    const makeCurrentCursor =
        cur => {
            return cursorCache == undefined
                ? (cursorCache= makeCursor(param.hlElem, makeTrailing()))
                : cursorCache;
        }

    let curCycle = 0;
    const makeHilighted = async function(enableCursor, cur) {
        if (!param.interruption.isStarted)
            throw Error("Stopped.");
        let codeText;
        if (enableCursor) {
            codeText = highlighter(makePrecede(cur))
                + makeCurrentCursor(cur).outerHTML
                + highlighter(makeTrailing(cur));
        } else {
            codeText = highlighter(makePrecede(cur))
                + highlighter(makeTrailing(cur));
        }
        param.hlElem.innerHTML = codeText;
    }
    const hilightText = async function(curTxt) {
        param.hlElem.innerHTML = highlighter(curTxt);
    }

    const totalPos = totalCycles + 2;
    const forwardTask = async function(cur) {
        if (onHighlited) {
            return onHighlited({
                totalFrames: totalFrames,
                curPos: curCycle,
                totalPos: totalPos,
            });
        }
    }

    await makeHilighted(true)
        .then(forwardTask);

    for (i of range()) {
        curCycle = Math.abs(i - beginAt) + 1;
        await makeHilighted(true, i)
            .then(forwardTask);
    }

    curCycle = totalPos;
    if (isReversed) {
        await hilightText(prevCache + trailCache)
            .then(forwardTask);
    } else {
        await hilightText(text)
            .then(forwardTask);
    }
}

window.addEventListener("load", function() {
    const setToValueProperty = (x, v) => x.value = v;
    const setToCheckedProperty = (x, v) => x.checked = Boolean(parseInt(v, 10));
    const setupEventListenerForCheckbox = (name, extra) => {
        const e = document.getElementById(name);
        e.addEventListener("change", obj => {
            localStorage.setItem(name, e.checked ? "1" : "0");
            if (extra) {
                extra(e.checked);
            }
        })
    }
    const changeStyle = function(newStyle) {
        const current = document.querySelector(".styles .current");
        const currentStyle = current.textContent;
        if (currentStyle !== newStyle) {
            const newStyleInst = document.querySelector(`link[title="${newStyle}"`);
            newStyleInst.removeAttribute("disabled");
            const curStyleInst = document.querySelector(`link[title="${currentStyle}"`);
            curStyleInst.setAttribute("disabled", "disabled");

            newStyleInst.setAttribute('rel', 'stylesheet');
            curStyleInst.setAttribute('rel', 'alternate stylesheet');

            current.classList.remove("current");
            nextItem = document.querySelector(`.styles li[title="${newStyle}"]`);
            nextItem.classList.add("current");
            localStorage.setItem("selectedStyle", newStyle);
        }
    };
    let movFormat = makeMovieFormats(cur => {
        movFormat = cur;
    });
    const { createFFmpeg } = FFmpeg;
    const ffmpeg = createFFmpeg({
        corePath: new URL("./lib/ffmpeg-core.js", document.location).href,
        log: true,
    });

    const inputArea = document.getElementById("inputArea");
    const highlightArea = document.getElementById("highlightArea");
    const hilightPre = document.getElementById("highlightPre")
    const displayButton = document.getElementById("displayButton");
    const movieButton = document.getElementById("genMovieButton");
    const languageText = getObjectWithInitValue("specificLanguage", setToValueProperty, "");
    const viewerFontFamily = getObjectWithInitValue("viewerFontFamily", setToValueProperty, "????????????????????? Code JP");
    const fontSize = getObjectWithInitValue("fontSize", setToValueProperty, 16);
    const beginIndex = document.getElementById("beginIndex");
    const endIndex = document.getElementById("endIndex");
    const targetDuration = getObjectWithInitValue("targetDuration", setToValueProperty, 2000);
    const fps = getObjectWithInitValue("fps", setToValueProperty, 30);
    const viewer = document.getElementById("highlightArea");
    const isTransparent = getObjectWithInitValue("isTransparent", setToCheckedProperty, false);
    const isEnableLastCursor = getObjectWithInitValue("isEnableLastCursor", setToCheckedProperty, false);
    setupEventListenerForCheckbox("isTransparent");
    setupEventListenerForCheckbox("isEnableLastCursor");
    const calcImageSize = () => {
        const dpr = window.devicePixelRatio;
        return {
            width: Math.floor(hilightPre.scrollWidth * dpr),
            height: Math.floor(hilightPre.scrollHeight * dpr)
        };
    };
    const calcMilSecPerFrame = () =>
        1000.0 / fps.value;
    const calcDuration = () =>
        targetDuration.value * calcMilSecPerFrame();

    const updateSizeInfo = function() {
        const ss = { width: Math.round(hilightPre.scrollWidth), height: Math.round(hilightPre.scrollHeight) };
        const sp = { left: Math.round(hilightPre.scrollLeft), top: Math.round(hilightPre.scrollTop) }
        const cs = { width: Math.round(hilightPre.clientWidth), height: Math.round(hilightPre.clientHeight) };
        const imgs = calcImageSize();
        document.getElementById("sizeInfo").textContent =
         `scroll: (${sp.left}, ${sp.top}) ${ss.width}x${ss.height}, client: ${cs.width}x${cs.height}, Image: ${imgs.width}x${imgs.height}`;
    }
    const resizeObserver = new ResizeObserver(entries => {
        for (const e of entries) {
            updateSizeInfo();
        }
        const isDisabled = highlightArea.scrollWidth == 0 || highlightArea.scrollHeight == 0;
        document.getElementById("genPngButton").disabled = isDisabled;
        movieButton.disabled = isDisabled;
    });
    resizeObserver.observe(hilightPre);
    hilightPre.addEventListener('scroll', obj => {
        updateSizeInfo();
    })
    const refrectBackColor = function() {
        hlbg = getComputedStyle(highlightArea).backgroundColor;
        hilightPre.style.background = hlbg;
    };
    const swichMutable = function(isMutable, extra) {
        isDisabled = !isMutable;
        inputArea.disabled = isDisabled;
        for (const n of [ "inputArea", "refreshButton", "prepareButton",
                          "genPngButton", "specificLanguage", "viewerFontFamily",
                          "fontSize", "targetDuration", "fps", "movieFormat",
                          "isTransparent", "isEnableLastCursor" ]) {
            document.getElementById(n).disabled = isDisabled;
        }
        extra();
    };
    const makePreference = function(name) {
        var dict = {};
        makePreferenceItem(dict, "specificLanguage", languageText.value);
        makePreferenceItem(dict, "viewerFontFamily", viewerFontFamily.value);
        makePreferenceItem(dict, "fontSize", fontSize.value);
        makePreferenceItem(dict, "targetDuration", targetDuration.value);
        makePreferenceItem(dict, "fps", fps.value);

        const currentStyle = document.querySelector(".styles .current");
        const currentStyleType = currentStyle.textContent;
        makePreferenceItem(dict, "selectedStyle", currentStyleType);
        makePreferenceItem(dict, "movieFormat", movFormat.name);
        makePreferenceItem(dict, "name", name);
        return dict;
    }
    const reflectPreference = function(prefs) {
        loadPreferenceItem(prefs, "specificLanguage", v => {
            languageText.value = v;
            languageText.dispatchEvent(new Event("change"))
        });
        loadPreferenceItem(prefs, "viewerFontFamily", v => {
            viewerFontFamily.value = v;
            viewerFontFamily.dispatchEvent(new Event("change"));
        });
        loadPreferenceItem(prefs, "fontSize", v => {
            fontSize.value = v;
            fontSize.dispatchEvent(new Event("change"));
        });
        loadPreferenceItem(prefs, "targetDuration", v => {
            targetDuration.value = v;
            targetDuration.dispatchEvent(new Event("change"));
        });
        loadPreferenceItem(prefs, "fps", v => {
            fps.value = v;
            fps.dispatchEvent(new Event("change"));
        });
        loadPreferenceItem(prefs, "selectedStyle", changeStyle);
        loadPreferenceItem(prefs, "movieFormat", v => {
            const movFormat = document.getElementById("movieFormat");
            movFormat.value = v;
            movFormat.dispatchEvent(new Event("change"));
        });

    }
    const interruptor = new InterruptionStatus();
    // input text area
    inputArea.addEventListener("change", obj => {
        var len = inputArea.value.length;
        if (beginIndex.max != len) {
            beginIndex.max = len;
            beginIndex.dispatchEvent(new Event("change"));
        }
        if (endIndex.max != len) {
            endIndex.max = len;
            endIndex.dispatchEvent(new Event("change"));
        }
        pre = this.preStat
        if (!pre || pre.len == pre.endIndex) {
            endIndex.value = endIndex.max;
            endIndex.dispatchEvent(new Event("change"));
        }
        this.preStat = { len: len, endIndex: endIndex.value, };
    })

    // language text input
    languageText.addEventListener("change", obj => {
        const isEmpty = !obj.target.value;
        if (displayButton.disabled != isEmpty)
            displayButton.disabled = isEmpty;
        if (movieButton.disabled != isEmpty)
            movieButton.disabled = isEmpty;
        storeObjectValue("specificLanguage", languageText.value);
    });
    languageText.addEventListener("keyup", obj => {
        languageText.dispatchEvent(new Event("change"));
    });
    languageText.dispatchEvent(new Event("change"));
    
    // font family
    viewerFontFamily.addEventListener("change", obj => {
        const fontName = viewerFontFamily.value;
        viewerFontFamily.style.fontFamily = fontName;
        viewer.style.fontFamily = fontName;
        storeObjectValue("viewerFontFamily", fontName);
    });
    viewerFontFamily.dispatchEvent(new Event("change"));

    // font size
    fontSize.addEventListener("change", obj => {
        if (!fontSize.value) {
            fontSize.value = 16;
        }
        viewer.style.fontSize = `${fontSize.value}px`
        storeObjectValue("fontSize", fontSize.value);
    });
    fontSize.dispatchEvent(new Event("change"));

    // begin index
    beginIndex.addEventListener("change", obj => {
        this.document.getElementById("beginIndexValue").innerHTML = beginIndex.value;
    });
    beginIndex.addEventListener("input", obj => {
        this.document.getElementById("beginIndexValue").innerHTML = beginIndex.value;
    });

    // end index
    endIndex.addEventListener("change", obj => {
        this.document.getElementById("endIndexValue").innerHTML = endIndex.value;
    });
    endIndex.addEventListener("input", obj => {
        this.document.getElementById("endIndexValue").innerHTML = endIndex.value;
    });

    // target duration
    targetDuration.addEventListener("input", obj => {
        document.getElementById("targetDurationValue").innerHTML = `${Math.round(calcDuration())}ms`;
    })
    targetDuration.dispatchEvent(new Event("input"));
    targetDuration.addEventListener("change", obj => {
        storeObjectValue("targetDuration", targetDuration.value);
        targetDuration.title = `${targetDuration.value}frm x ${calcMilSecPerFrame()}ms/frm = ${Math.round(calcDuration())}`;
    });

    // fps
    fps.addEventListener("input", obj => {
        document.getElementById("fpsValue").innerHTML = fps.value;
    });
    fps.dispatchEvent(new Event("input"));
    fps.addEventListener("change", obj => {
        storeObjectValue("fps", fps.value);
        targetDuration.dispatchEvent(new Event("input"));
    });

    // highlight style
    changeStyle(localStorage.getItem("selectedStyle") ?? "Default");

    // Refresh button
    document.getElementById("refreshButton").title = "Press before changing the code";
    document.getElementById("refreshButton").addEventListener("click", obj => {
        inputArea.select();
        languageText.value = "";
        languageText.dispatchEvent(new Event("change"));
        highlightArea.innerHTML = "";
    })

    // Prepare button
    document.getElementById("prepareButton").title = "Make the entire highlighted code on the view. if language is undefined, highlight.js will deduce it.";
    document.getElementById("prepareButton").addEventListener("click", obj => {
        const text = inputArea.value;
        const lang = languageText.value;
        const beginAt = parseInt(beginIndex.value);
        const endAt = parseInt(endIndex.value);
        const hilighter = content => makeHilighter(lang, content, l => {
            // code language is deduced
            languageText.value = l ?? "";
            languageText.dispatchEvent(new Event("change"));
        })().value;
        const isReversed = beginAt > endAt;
        const preceding = text.substring(0, endAt);
        const trailing = isReversed
            ? text.substring(beginAt, text.length)
            : text.substring(endAt, text.length);
        if (isEnableLastCursor.checked) {
            highlightArea.innerHTML = hilighter(preceding)
                + makeCursor(highlightArea, trailing).outerHTML
                + hilighter(trailing);
        } else {
            highlightArea.innerHTML = hilighter(preceding + trailing);
        }
        refrectBackColor();
    });

    // PNG button
    document.getElementById("genPngButton").title = "Generate PNG image of current highlighted code pane.";
    document.getElementById("genPngButton").addEventListener("click", obj => {
        makePng(highlightArea, hilightPre.scrollWidth, hilightPre.scrollHeight, isTransparent.checked)
            .then(dUrl => {
                var link = document.getElementById("downloader");
                link.href = dUrl;
                link.download = "highlight.png";
                link.target = '_blank';
                link.click();
            })
    });

    // Preview button
    displayButton.title = "You can see accumulated highlight code. Language must be specified to press";
    displayButton.addEventListener("click", async obj => {
        if (interruptor.isStarted) {
            // cancel
            interruptor.stop();
            return;
        }
        const duration = calcDuration();
        const status = document.getElementById("status");
        const durationResult = document.getElementById("duration");
        try {
            swichMutable(false, () => {
                displayButton.textContent = "Stop";
                movieButton.disabled = true;
            });
            interruptor.start();
            refrectBackColor();
            const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
            const startTime = performance.now();
            await makeCodeHighlighter({
                hlElem: highlightArea,
                lang: languageText.value,
                text: inputArea.value,
                fps: parseFloat(fps.value),
                duration: duration,
                interruption: interruptor,
                beginAt: parseInt(beginIndex.value),
                endAt: parseInt(endIndex.value),
                onHighlited: obj => {
                    const remains = obj.totalPos - obj.curPos;
                    const currentTime = performance.now();
                    const realDuration = currentTime - startTime;
                    durationResult.value = realDuration + " ms";
                    const timeRemain = duration - realDuration;
                    if (remains > 1 && timeRemain > 0) {
                        const waitMs = timeRemain / (remains - 1);
                        return sleep(waitMs);
                    }
                },
            });
        } finally {
            interruptor.stop();
            swichMutable(true, () => {
                displayButton.textContent = "Preview";
                movieButton.disabled = false;
            });
        }
    });

    // movie button
    document.getElementById("genMovieButton").title = "Generate movie file of accumulating code. To run this, http server must return COOP/COEP entries in the response header";
    document.getElementById("genMovieButton").addEventListener("click", async obj => {
        if (interruptor.isStarted) {
            // cancel
            interruptor.stop();
            return;
        }
        const duration = calcDuration();
        const fpsVal = parseFloat(fps.value);
        const totalFrames = fpsVal * duration / 1000;
        const img = calcImageSize();
        const width = img.width;
        const height = img.height;
        const pngWidth = hilightPre.scrollWidth;
        const pngHeight = hilightPre.scrollHeight;
        const status = document.getElementById("status");
        const durationResult = document.getElementById("duration");
        const end = Math.round(totalFrames);
        const frameNumLength = ("" + (end + 2)).length;
        const genFileNumber = function(num) {
            token = "0".repeat(frameNumLength);
            return (token + num).slice(-frameNumLength);
        }
        const movieFilename = `text.${movFormat.ext}`;
        const makeFfmpegCommand = function() {
            return movFormat.makeCmdFFmpegRun(movieFilename, width, height, fpsVal);
        }
    
        if (!ffmpeg.isLoaded())
            await ffmpeg.load();

        try {
            swichMutable(false, () => {
                displayButton.disabled = true;
                movieButton.textContent = "Stop";
            });
            interruptor.start();
            refrectBackColor();
            let fileIndex = 0;
            const beginAt = parseInt(beginIndex.value);
            const endAt = parseInt(endIndex.value);
            const totalImages = Math.abs(endAt - beginAt) + 2;
            const frameProgress = function() {
                return fileIndex / totalFrames;
            }
            await makeCodeHighlighter({
                hlElem: highlightArea,
                lang: languageText.value,
                text: inputArea.value,
                fps: parseFloat(fps.value),
                duration: duration,
                interruption: interruptor,
                beginAt: beginAt,
                endAt: endAt,
                onHighlited: obj => {
                    return makePng(highlightArea, pngWidth, pngHeight, isTransparent.checked)
                        .then(imgURL => fetch(imgURL))
                        .then(img => img.blob())
                        .then(blob => blob.arrayBuffer())
                        .then(async buf => {
                            const outBuf = new Uint8Array(buf);
                            const imgProgress = obj.curPos / obj.totalPos;
                            do {
                                const fname = `image${genFileNumber(fileIndex++)}.png`;
                                await ffmpeg.FS('writeFile', fname, outBuf);
                            } while (frameProgress() < imgProgress);
                        })
                },
            }).then(obj => {
                if (!interruptor.isStarted)
                    throw Error("Stopped.");
                return ffmpeg.run.apply(null, makeFfmpegCommand());
            }).then(obj => {
                if (!interruptor.isStarted)
                    throw Error("Stopped.");
                return ffmpeg.FS('readFile', movieFilename);
            }).then(movie => {
                const link = document.getElementById('downloader');
                link.href = URL.createObjectURL(new Blob([movie.buffer], { type: movFormat.mime }));
                link.download = movieFilename;
                link.target = '_blank';
                link.click();
            }).catch(err => alert(err.message));
        } finally {
            interruptor.stop();
            await ffmpeg.exit();
            swichMutable(true, () => {
                displayButton.disabled = false;
                movieButton.textContent = "Movie";
            });
        }
    });

    // style list
    document.querySelectorAll(".styles li").forEach(elem => {
        elem.addEventListener("click", event => {
            event.preventDefault();
            changeStyle(event.target.textContent);
        })
    });

    setupMenu(makePreference, reflectPreference);
    //document.getElementById("testButton").addEventListener("click", async obj => {
    //});
});
