/*
* Incremental Highlighted Text Movie Maker
* Copyright: 2022 yamasdais @ github
* License: MIT License
*
* TODO:
* * エラー処理きちんと
*     -> ffmpeg 使うところは改善
* * 試作的なコードをもうちょっと整理する
* PLAN:
* * 使い方を書く
*     -> ツールチップ追加
* * ffmpeg log 表示をオプションに
* * 見栄えをもうちょっと何とかする
*     -> ちょっとマシにしたつもり
*/

function getObjectWithInitValue(name, mutator, defaultValue) {
    var ret = document.getElementById(name)
    mutator(ret, localStorage.getItem(name) ?? defaultValue);
    return ret;
}
function storeObjectValue(name, value) {
    localStorage.setItem(name, value);
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
        background: bgC,
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
    constructor(name, ext, mime) {
        this.name = name;
        this.ext = ext;
        this.mime = mime;
    }
}

function* getSupportedMovieFormats() {
    yield new MovieFormatItem("mp4", "mp4", "video/mp4");
    yield new MovieFormatItem("webm", "webm", "video/webm");
    yield new MovieFormatItem("webp", "webp", "image/webp");
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
    const displayButton = document.getElementById("displayButton");
    const movieButton = document.getElementById("genMovieButton");
    const languageText = getObjectWithInitValue("specificLanguage", setToValueProperty, "");
    const viewerFontFamily = getObjectWithInitValue("viewerFontFamily", setToValueProperty, "源ノ角ゴシック Code JP");
    const fontSize = getObjectWithInitValue("fontSize", setToValueProperty, 16);
    const beginIndex = document.getElementById("beginIndex");
    const endIndex = document.getElementById("endIndex");
    const targetDuration = getObjectWithInitValue("targetDuration", setToValueProperty, 2000);
    const fps = getObjectWithInitValue("fps", setToValueProperty, 30);
    const viewer = document.getElementById("highlightArea");
    const isInsertThumbnail = getObjectWithInitValue("isInsertThumbnail", setToCheckedProperty, false);
    const isEnableLastCursor = getObjectWithInitValue("isEnableLastCursor", setToCheckedProperty, false);
    setupEventListenerForCheckbox("isInsertThumbnail");
    setupEventListenerForCheckbox("isEnableLastCursor");
    const refrectBackColor = function() {
        hlbg = getComputedStyle(highlightArea).backgroundColor;
        document.getElementById('highlightPre').style.background = hlbg;
    };
    const swichMutable = function(isMutable, extra) {
        isDisabled = !isMutable;
        inputArea.disabled = isDisabled;
        for (const n of [ "inputArea", "refreshButton", "prepareButton",
                          "genPngButton", "specificLanguage", "viewerFontFamily",
                          "fontSize", "targetDuration", "fps", "movieFormat",
                          "isInsertThumbnail", "isEnableLastCursor" ]) {
            document.getElementById(n).disabled = isDisabled;
        }
        extra();
    };
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
        document.getElementById("targetDurationValue").innerHTML = `${targetDuration.value}ms`;
    })
    targetDuration.dispatchEvent(new Event("input"));
    targetDuration.addEventListener("change", obj => {
        storeObjectValue("targetDuration", targetDuration.value);
    });

    // fps
    fps.addEventListener("input", obj => {
        document.getElementById("fpsValue").innerHTML = fps.value;
    });
    fps.dispatchEvent(new Event("input"));
    fps.addEventListener("change", obj => {
        storeObjectValue("fps", fps.value);
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
        makePng(highlightArea, highlightArea.clientWidth, highlightArea.clientHeight)
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
        const duration = parseFloat(targetDuration.value);
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
        const duration = parseFloat(targetDuration.value);
        const fpsVal = parseFloat(fps.value);
        const totalFrames = fpsVal * duration / 1000;
        const width = highlightArea.clientWidth;
        const height = highlightArea.clientHeight;
        const status = document.getElementById("status");
        const durationResult = document.getElementById("duration");
        const end = Math.round(totalFrames);
        const frameNumLength = ("" + (end + 2)).length;
        const genFileNumber = function(num) {
            token = "0".repeat(frameNumLength);
            return (token + num).slice(-frameNumLength);
        }
        const makeFfmpegCommand = function(fname) {
            const mvWidth = (width % 2) ? width - 1 : width;
            const mvHeight = (height % 2) ? height - 1 : height;
            return [
                '-r', `${fpsVal}`,
                '-pattern_type', 'glob', '-i', 'image*.png',
                '-s', `${mvWidth}x${mvHeight}`,
                '-pix_fmt', 'yuv420p',
                fname
            ];

        }
        const movieFilename = `text.${movFormat.ext}`;
    
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
                    return makePng(highlightArea, width, height)
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
                return ffmpeg.run.apply(null, makeFfmpegCommand(movieFilename));
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

    //document.getElementById("testButton").addEventListener("click", async obj => {
    //});
});
