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
function makeHighlightWorker() {
    const blob = new Blob([document.getElementById("highlightWorker").textContent], 
                { type: 'text/javascript'});
    return new Worker(window.URL.createObjectURL(blob));
}
function makeHighlighter(lang, text, onChangedLang) {
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

function makeCanvas(hlarea, width, height) {
    const w = width;
    const h = height;
    const adjWidth = (w % 2) ? w + 1 : w;
    const adjHeight = (h % 2) ? h + 1 : h;

    return html2canvas(hlarea, {
        width: adjWidth,
        height: adjHeight,
    });
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
    }
    stop() {
        this.#isRunning = false;
    }
    get isStarted() {
        return this.#isRunning;
    }
}

async function makeImageGenerator(param) {
    // fps: frames per second
    // duration: target duration (ms)
    const totalFrames = param.fps * param.duration / 1000;
    const textLen = param.text.length;
    const incPerFrame = textLen / totalFrames;
    const width = param.hlarea.clientWidth;
    const height = param.hlarea.clientHeight;
    const end = Math.round(totalFrames);
    const retSize = end + 2;
    const frameNumLength = ("" + (retSize)).length;
    const genFileNumber = function(num) {
        token = "0".repeat(frameNumLength);
        return (token + num).slice(-frameNumLength);
    }
    const fileNames = [];

    const canvasSize = await makeCanvas(param.hlarea, width, height)
        .then(canvas => {
            return { w: canvas.width, h: canvas.height }
        });

    let imgCache;
    const makeImage = async function(imgIdx, prevIdx, curIdx) {
        if (!param.interruption.isStarted)
            throw Error("Stopped.");
        await makeCanvas(param.hlarea, width, height)
            .then(canvas => canvas.toDataURL('image/png'))
            .then(imgURL => {
                fname = `image${genFileNumber(imgIdx)}.png`;
                fileNames.push(fname);
                if (imgCache !== undefined && prevIdx === curIdx) {
                    return param.ffmpeg.FS('writeFile', fname, imgCache);
                } else {
                    return fetch(imgURL)
                        .then(res => res.blob())
                        .then(blob => blob.arrayBuffer())
                        .then(buf => {
                            imgCache = new Uint8Array(buf);
                            return param.ffmpeg.FS('writeFile', fname, imgCache);
                        });
                }
            })
            ;
    }

    let textCursorEnabled = true;

    return async function() {
        let prev = 0;
        let progress = 0.0;
        let imgIdx = 0;
        param.hlarea.innerHTML = "";
        param.hlarea.width = width;
        param.hlarea.height = height;

        await makeImage(imgIdx++, prev, undefined);
        for (i = 0; i < end; i++) {
            cur = Math.round(progress);
            if (cur !== prev) {
                res = hljs.highlight(param.text.substring(0, cur), { language: param.lang, ignoreIllegals: true });
                param.hlarea.innerHTML = res.value + (textCursorEnabled ? "\u2588" : "");
            }
            await makeImage(imgIdx++, prev, cur);
            progress += incPerFrame;
            prev = cur;
        }
        // +1 final image with cursor
        res = hljs.highlight(param.text, { language: param.lang, ignoreIllegals: true });
        param.hlarea.innerHTML = res.value + (textCursorEnabled ? "\u2588" : "");
        await makeImage(imgIdx++, prev, undefined);
        // +1 final image
        res = hljs.highlight(param.text, { language: param.lang, ignoreIllegals: true });
        param.hlarea.innerHTML = res.value;
        await makeImage(imgIdx++, prev, undefined);

        return {
            width: (canvasSize.w % 2) ? canvasSize.w - 1 : canvasSize.w,
            height: (canvasSize.h % 2) ? canvasSize.h - 1 : canvasSize.h,
            fileNames: fileNames,
        }
    };
}

window.addEventListener("load", function() {
    const setToValueProperty = (x, v) => x.value = v;
    const changeStyle = function(newStyle) {
        const current = document.querySelector(".styles .current");
        const currentStyle = current.textContent;
        if (currentStyle !== newStyle) {
            const newStyleInst = document.querySelector(`link[title="${newStyle}"`);
            newStyleInst.removeAttribute("disabled");
            document.querySelector(`link[title="${currentStyle}"`)
                .setAttribute("disabled", "disabled");

            current.classList.remove("current");
            nextItem = document.querySelector(`.styles li[title="${newStyle}"]`);
            nextItem.classList.add("current");
            localStorage.setItem("selectedStyle", newStyle);
        }
    }
    let movFormat = makeMovieFormats(cur => {
        movFormat = cur;
    });
    const { createFFmpeg } = FFmpeg;
    const ffmpeg = createFFmpeg({
        corePath: new URL("./lib/ffmpeg-core.js", document.location).href,
        log: true,
    })

    const inputArea = document.getElementById("inputArea");
    const highlightArea = document.getElementById("highlightArea");
    const displayButton = document.getElementById("displayButton");
    const movieButton = document.getElementById("genMovieButton");
    const languageText = getObjectWithInitValue("specificLanguage", setToValueProperty, "");
    const viewerFontFamily = getObjectWithInitValue("viewerFontFamily", setToValueProperty, "源ノ角ゴシック Code JP");
    const fontSize = getObjectWithInitValue("fontSize", setToValueProperty, 16);
    const targetDuration = getObjectWithInitValue("targetDuration", setToValueProperty, 2000);
    const fps = getObjectWithInitValue("fps", setToValueProperty, 30);
    const viewer = document.getElementById("highlightArea");
    const refrectBackColor = function() {
        hlbg = getComputedStyle(highlightArea).backgroundColor;
        document.getElementById('highlightPre').style.background = hlbg;
    }
    const swichMutable = function(isMutable, extra) {
        isDisabled = !isMutable;
        inputArea.disabled = isDisabled;
        for (const n of [ "inputArea", "refreshButton", "prepareButton",
                          "genPngButton", "specificLanguage", "viewerFontFamily",
                          "fontSize", "targetDuration", "fps", "movieFormat" ]) {
            document.getElementById(n).disabled = isDisabled;
        }
        extra();
    }
    const interruptor = new InterruptionStatus();

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
        viewer.style.fontFamily = viewerFontFamily.value;
        storeObjectValue("viewerFontFamily", viewerFontFamily.value);
    })
    viewerFontFamily.dispatchEvent(new Event("change"));

    // font size
    fontSize.addEventListener("change", obj => {
        if (!fontSize.value) {
            fontSize.value = 16;
        }
        viewer.style.fontSize = `${fontSize.value}px`
        storeObjectValue("fontSize", fontSize.value);
    })
    fontSize.dispatchEvent(new Event("change"));

    // target duration
    targetDuration.addEventListener("input", obj => {
        document.getElementById("targetDurationValue").innerHTML = `${targetDuration.value}ms`;
    })
    targetDuration.dispatchEvent(new Event("input"));
    targetDuration.addEventListener("change", obj => {
        storeObjectValue("targetDuration", targetDuration.value);
    })

    // fps
    fps.addEventListener("input", obj => {
        document.getElementById("fpsValue").innerHTML = fps.value;
    })
    fps.dispatchEvent(new Event("input"));
    fps.addEventListener("change", obj => {
        storeObjectValue("fps", fps.value);
    })

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

    // Ready button
    document.getElementById("prepareButton").title = "Make the entire highlighted code on the view. if language is undefined, highlight.js will deduce it.";
    document.getElementById("prepareButton").addEventListener("click", obj => {
        const text = inputArea.value;
        const lang = languageText.value;
        const hilighter = makeHighlighter(lang, text, l => {
            languageText.value = l ?? "";
            languageText.dispatchEvent(new Event("change"));
        });
        const html = hilighter();
        highlightArea.innerHTML = html.value;
        refrectBackColor();
    });
    // PNG button
    document.getElementById("genPngButton").title = "Generate PNG image of current highlighted code pane.";
    document.getElementById("genPngButton").addEventListener("click", obj => {
        makeCanvas(highlightArea, highlightArea.clientWidth, highlightArea.clientHeight).then(function(canvas) {
            var link = document.getElementById("downloader");
            link.href = canvas.toDataURL("image/png");
            link.download = "highlight.png";
            link.target = '_blank';
            link.click();
        })
    });

    // movie button
    document.getElementById("genMovieButton").title = "Generate movie file of accumulating code. To run this, http server must return COOP/COEP entries in the response header";
    document.getElementById("genMovieButton").addEventListener("click", async obj => {
        if (interruptor.isStarted) {
            // cancel
            interruptor.stop();
            return;
        }
        if (!languageText.value) {
            alert("language must be specified explicitly");
            return;
        }
        refrectBackColor();
        const fpsVal = parseFloat(fps.value)
        if (!ffmpeg.isLoaded())
            await ffmpeg.load();
        try {
            swichMutable(false, () => {
                displayButton.disabled = true;
                movieButton.textContent = "Stop";
            });
            interruptor.start();
            const genImages = await makeImageGenerator({
                hlarea: highlightArea,
                fps: parseFloat(fps.value),
                duration: parseFloat(targetDuration.value),
                lang: languageText.value,
                text: inputArea.value,
                ffmpeg: ffmpeg,
                interruption: interruptor,
            });
            movieFilename = `text.${movFormat.ext}`;
            await genImages()
                .then(vals => {
                    if (!interruptor.isStarted)
                        throw Error("Stopped.");
                    movie = ffmpeg.run(
                        '-r', `${fpsVal}`,
                        '-pattern_type', 'glob', '-i', 'image*.png',
                        '-s', `${vals.width}x${vals.height}`,
                        '-pix_fmt', 'yuv420p',
                        movieFilename);
                    return [ vals, movie ];
                })
                .then(vals => {
                    if (!interruptor.isStarted)
                        throw Error("Stopped.");
                    return vals[1].then(v => {
                        return ffmpeg.FS('readFile', movieFilename);
                    })
                })
                .then(movie => {
                    const link = document.getElementById("downloader");
                    link.href = URL.createObjectURL(new Blob([movie.buffer], { type: movFormat.mime }));
                    link.download = movieFilename;
                    link.target = '_blank';
                    link.click();
                })
                .catch(alert);

        } finally {
            interruptor.stop();
            await ffmpeg.exit();
            swichMutable(true, () => {
                displayButton.disabled = false;
                movieButton.textContent = "Movie";
            });
        }


    })

    // Preview button
    displayButton.title = "You can see accumulated highlight code. Language must be specified to press";
    displayButton.addEventListener("click", obj => {
        if (interruptor.isStarted) {
            // cancel
            interruptor.stop();
            return;
        }
        const text = inputArea.value;
        const lang = languageText.value;
        if (!lang) {
            alert("language must be specified explicitly");
            return;
        }
        refrectBackColor();
        const textCount = text.length;
        const fpsVal = parseFloat(fps.value)
        const duration = parseFloat(targetDuration.value);
        const incPerFrame = textCount / (fpsVal * duration / 1000);
        const frameMS = Math.min(1000 / fpsVal, textCount / incPerFrame);
        const status = document.getElementById("status");
        const durationResult = document.getElementById("duration");

            swichMutable(false, () => {
                displayButton.textContent = "Stop";
                movieButton.disabled = true;
            });
            interruptor.start();
            const onFinal = function() {
                interruptor.stop();
                swichMutable(true, () => {
                    displayButton.textContent = "Preview";
                    movieButton.disabled = false;
                });
            }

            const worker = makeHighlightWorker();
            let wasError = false;
            let textCursorEnabled = true;
            worker.addEventListener("message", e => {
                highlightArea.innerHTML = e.data.value + (textCursorEnabled ? "\u2588" : "");
            });
            worker.addEventListener("error", e => {
                wasError = true;
                alert(e.message)
            });
            const width = highlightArea.clientWidth;
            const height = highlightArea.clientHeight;
            highlightArea.innerHTML = "";
            highlightArea.width = width;
            highlightArea.height = height;
            durationResult.value = "";
            let i = prev = 0;
            const startTime = performance.now();
            const timerId = setInterval(() => {
                if (wasError || !interruptor.isStarted) {
                    clearInterval(timerId);
                    onFinal();
                } else {
                    status.value = i + "/" + textCount
                    worker.postMessage({language: lang, text: text.substring(0, i)})
                    prev = i;
                    i += incPerFrame;
                    if (i >= textCount) {
                        clearInterval(timerId);
                        textCursorEnabled = false;
                        worker.postMessage({ language: lang, text: text });
                        const realDuration = performance.now() - startTime;
                        durationResult.value = realDuration + " ms";
                        onFinal();
                    }
                }
            }, frameMS);
    });

    // style list
    document.querySelectorAll(".styles li").forEach(elem => {
        elem.addEventListener("click", event => {
            event.preventDefault();
            changeStyle(event.target.textContent);
            /*
            const current = document.querySelector(".styles .current");
            const currentStyle = current.textContent;
            const nextStyle = event.target.textContent;
            if (currentStyle !== nextStyle) {
                document.querySelector(`link[title="${nextStyle}"`)
                    .removeAttribute("disabled");
                document.querySelector(`link[title="${currentStyle}"`)
                    .setAttribute("disabled", "disabled");

                current.classList.remove("current");
                event.target.classList.add("current");
            }
            */
        })
    })
});
