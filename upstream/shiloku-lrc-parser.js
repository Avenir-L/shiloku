// Copied read-only from current Shiloku index.html; real LRC and translations.
function extractTimedLyricLines(text) {
    const timeExp = /\[(\d{2}):(\d{2}(?:\.\d{2,3})?)\]/g;
    const out = [];
    String(text).split('\n').forEach((line) => {
        const matches = [...line.matchAll(timeExp)];
        if (!matches.length) return;
        const content = line.replace(timeExp, '').trim();
        matches.forEach((match) => {
            const time = parseInt(match[1], 10) * 60 + parseFloat(match[2]);
            out.push({ time, text: content });
        });
    });
    return out;
}

function isLyricMetaLine(text) {
    const line = String(text || '').trim();
    if (!line || line.startsWith('{')) return true;
    if (/^(作词|作曲|编曲|制作人|演唱|词\s*[:：]|曲\s*[:：])/u.test(line)) return true;
    if (/^(lyrics?|composer|writer|producer|arrangement)\s*[:：]/i.test(line)) return true;
    return false;
}

function isLyricSkipLine(text) {
    const line = normalizeLyricLine(text);
    if (!line) return true;
    if (isLyricMetaLine(line)) return true;
    if (/\bon the (beat|track)\b/i.test(line)) return true;
    if (/^\[?(prod|beat)\]?[\s.:]/i.test(line)) return true;
    return false;
}

function normalizeLyricLine(text) {
    let line = String(text || '').trim();
    if (!line) return '';
    if (line.includes('+')) {
        const parts = line.split('+').map((part) => part.trim()).filter(Boolean);
        line = parts[parts.length - 1] || line;
    }
    return line.replace(/\*{2,}/g, '').trim();
}

function findTranslationForLine(time, index, mainCount, transLines, transByTime) {
    if (transByTime.has(time)) return transByTime.get(time);

    let best = '';
    let bestDelta = 0.6;
    transByTime.forEach((text, t) => {
        const delta = Math.abs(t - time);
        if (delta < bestDelta) {
            bestDelta = delta;
            best = text;
        }
    });
    if (best) return best;

    if (!transLines.length) return '';

    if (transLines.length === mainCount) {
        return transLines[index]?.text || '';
    }

    const ratio = mainCount > 1 ? index / (mainCount - 1) : 0;
    const transIndex = Math.min(
        transLines.length - 1,
        Math.round(ratio * (transLines.length - 1)),
    );
    return transLines[transIndex]?.text || '';
}

function mergeLyricWithTranslation(mainText, transText) {
    const mainLines = extractTimedLyricLines(mainText)
        .map((line) => ({ time: line.time, text: normalizeLyricLine(line.text) }))
        .filter((line) => !isLyricSkipLine(line.text));
    const transLines = extractTimedLyricLines(transText)
        .map((line) => ({ time: line.time, text: normalizeLyricLine(line.text) }))
        .filter((line) => !isLyricSkipLine(line.text));
    if (!mainLines.length) return [];

    const transByTime = new Map();
    transLines.forEach((line) => transByTime.set(line.time, line.text));

    return mainLines
        .map((line, index) => ({
            time: line.time,
            text: line.text,
            trans: findTranslationForLine(line.time, index, mainLines.length, transLines, transByTime),
        }))
        .sort((a, b) => a.time - b.time);
}

function parseLRCText(text, transText = '') {
    if (transText) {
        return mergeLyricWithTranslation(text, transText);
    }

    const result = [];
    const timeMap = new Map();

    extractTimedLyricLines(text).forEach(({ time, text: content }) => {
        const normalized = normalizeLyricLine(content);
        if (isLyricSkipLine(normalized)) return;
        if (timeMap.has(time)) {
            timeMap.get(time).trans = normalized;
            return;
        }
        const lyricObj = { time, text: normalized, trans: '' };
        timeMap.set(time, lyricObj);
        result.push(lyricObj);
    });

    return result.sort((a, b) => a.time - b.time);
}
