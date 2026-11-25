// BARBORKA FX — ExtendScript side for After Effects and Premiere Pro.
// ExtendScript is ES3: no let/const, no arrow functions, no built-in JSON.
// Every entry point takes one JSON string and returns one JSON string.

var BFX_TICKS = 254016000000;

function bfxStr(v) {
    if (v === null || v === undefined) return 'null';
    var t = typeof v;
    if (t === 'number') return isFinite(v) ? String(v) : 'null';
    if (t === 'boolean') return v ? 'true' : 'false';
    if (t === 'string') {
        return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '"';
    }
    var out = [], i;
    if (v instanceof Array) {
        for (i = 0; i < v.length; i++) out.push(bfxStr(v[i]));
        return '[' + out.join(',') + ']';
    }
    for (var k in v) {
        if (v.hasOwnProperty(k)) out.push(bfxStr(k) + ':' + bfxStr(v[k]));
    }
    return '{' + out.join(',') + '}';
}

function bfxParse(s) {
    // input always comes from our own panel (JSON.stringify), never from footage
    return eval('(' + s + ')');
}

function bfxOk(o) { o = o || {}; o.ok = true; return bfxStr(o); }
function bfxFail(msg) { return bfxStr({ ok: false, err: String(msg) }); }

function bfxIsAE() { return BridgeTalk.appName === 'aftereffects'; }

function bfxPing() {
    return bfxOk({ app: bfxIsAE() ? 'ae' : 'ppro', version: app.version });
}

// ------------------------------------------------------------------ After Effects

function bfxAeFootagePath(layer) {
    try {
        if (layer.source && layer.source.mainSource && layer.source.mainSource.file) {
            return layer.source.mainSource.file.fsName;
        }
    } catch (e) {}
    return null;
}

function bfxAeSrcTime(layer, compTime) {
    try {
        if (layer.timeRemapEnabled) return layer.property('ADBE Time Remapping').valueAtTime(compTime, false);
    } catch (e) {}
    return (compTime - layer.startTime) * 100 / layer.stretch;
}

function bfxAeTarget(kind) {
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) return bfxFail('Open a composition in After Effects first.');
    var base = { app: 'ae', fps: comp.frameRate, width: comp.width, height: comp.height, playhead: comp.time, track: 0 };
    var sel = comp.selectedLayers;
    var i;
    if (kind === 'title') {
        base.start = comp.time;
        base.layerIndex = sel.length ? sel[0].index : 1;
        base.name = comp.name;
        return bfxOk(base);
    }
    if (kind === 'transition') {
        var ls = [];
        for (i = 0; i < sel.length; i++) if (bfxAeFootagePath(sel[i])) ls.push(sel[i]);
        if (ls.length < 2) return bfxFail('Select the two video layers of the cut (outgoing and incoming).');
        ls.sort(function (a, b) { return a.inPoint - b.inPoint; });
        var A = ls[0], B = ls[1];
        var cut = B.inPoint;
        base.cut = cut;
        base.layerIndex = Math.min(A.index, B.index);
        base.a = { path: bfxAeFootagePath(A), cutSrc: bfxAeSrcTime(A, Math.min(cut, A.outPoint)) };
        base.b = { path: bfxAeFootagePath(B), cutSrc: bfxAeSrcTime(B, cut) };
        base.name = A.name + ' > ' + B.name;
        return bfxOk(base);
    }
    var L = null;
    for (i = 0; i < sel.length; i++) if (bfxAeFootagePath(sel[i])) { L = sel[i]; break; }
    if (!L) return bfxFail('Select a video layer in the timeline.');
    var fr = 1 / comp.frameRate;
    var start = (comp.time > L.inPoint && comp.time < L.outPoint - fr) ? comp.time : L.inPoint;
    base.path = bfxAeFootagePath(L);
    base.start = start;
    base.srcAt = bfxAeSrcTime(L, start);
    base.remaining = L.outPoint - start;
    base.layerIndex = L.index;
    base.name = L.name;
    return bfxOk(base);
}

function bfxAeFolder() {
    for (var i = 1; i <= app.project.numItems; i++) {
        var it = app.project.item(i);
        if (it instanceof FolderItem && it.name === 'Barborka FX') return it;
    }
    return app.project.items.addFolder('Barborka FX');
}

function bfxAePlace(a) {
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) return bfxFail('The composition is no longer active.');
    app.beginUndoGroup('Barborka FX');
    try {
        var io = new ImportOptions(new File(a.first));
        if (a.count > 1) { io.sequence = true; io.forceAlphabetical = true; }
        var item = app.project.importFile(io);
        if (a.count > 1) item.mainSource.conformFrameRate = a.fps;
        if (a.kind === 'title') { try { item.mainSource.alphaMode = AlphaMode.STRAIGHT; } catch (e1) {} }
        item.name = a.name;
        item.parentFolder = bfxAeFolder();
        var layer = comp.layers.add(item);
        layer.startTime = a.start;
        if (a.count === 1) layer.outPoint = a.start + a.duration;
        // the new layer sits at index 1, so the original target moved to index + 1
        if (a.layerIndex && a.layerIndex + 1 <= comp.numLayers) layer.moveBefore(comp.layer(a.layerIndex + 1));
        layer.name = a.name;
    } catch (e) {
        app.endUndoGroup();
        return bfxFail('After Effects: ' + e.toString());
    }
    app.endUndoGroup();
    return bfxOk({});
}

function bfxAeGrab(a) {
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) return bfxFail('No active composition.');
    comp.saveFrameToPng(a.time, new File(a.base + '.png'));
    return bfxOk({});
}

// ------------------------------------------------------------------ Premiere Pro

function bfxPpFps(seq) { return BFX_TICKS / Number(seq.timebase); }

function bfxPpPath(item) {
    try {
        if (item && item.projectItem && item.projectItem.getMediaPath) {
            var p = item.projectItem.getMediaPath();
            if (p && p.length) return p;
        }
    } catch (e) {}
    return null;
}

function bfxPpTarget(kind) {
    var seq = app.project.activeSequence;
    if (!seq) return bfxFail('Open a sequence in Premiere Pro first.');
    var fps = bfxPpFps(seq);
    var base = { app: 'ppro', fps: fps, width: Number(seq.frameSizeHorizontal), height: Number(seq.frameSizeVertical) };
    var cti = seq.getPlayerPosition().seconds;
    base.playhead = cti;
    var vt = seq.videoTracks;
    var t, i, j, c;
    if (kind === 'title') {
        base.start = cti;
        base.track = -1;
        base.name = seq.name;
        return bfxOk(base);
    }
    if (kind === 'transition') {
        var best = null, bestD = 1e9;
        for (t = 0; t < vt.numTracks; t++) {
            c = vt[t].clips;
            for (i = 0; i < c.numItems; i++) {
                for (j = 0; j < c.numItems; j++) {
                    if (i === j) continue;
                    if (Math.abs(c[i].end.seconds - c[j].start.seconds) < 0.5 / fps) {
                        var d = Math.abs(c[i].end.seconds - cti);
                        if (d < bestD && bfxPpPath(c[i]) && bfxPpPath(c[j])) { bestD = d; best = { A: c[i], B: c[j], t: t }; }
                    }
                }
            }
        }
        if (!best) return bfxFail('Put the playhead on a cut between two video clips.');
        if (bestD > 2) return bfxFail('Move the playhead closer to the cut you want to transition.');
        base.cut = best.B.start.seconds;
        base.track = best.t;
        base.a = { path: bfxPpPath(best.A), cutSrc: best.A.outPoint.seconds };
        base.b = { path: bfxPpPath(best.B), cutSrc: best.B.inPoint.seconds };
        base.name = best.A.name + ' > ' + best.B.name;
        return bfxOk(base);
    }
    var target = null, tIndex = -1;
    var sel = seq.getSelection ? seq.getSelection() : [];
    for (i = 0; i < sel.length; i++) {
        if (sel[i].mediaType === 'Video' && bfxPpPath(sel[i])) { target = sel[i]; break; }
    }
    for (t = vt.numTracks - 1; t >= 0 && tIndex < 0; t--) {
        c = vt[t].clips;
        for (i = 0; i < c.numItems; i++) {
            if (target) {
                if (c[i].nodeId === target.nodeId) { tIndex = t; break; }
            } else if (c[i].start.seconds <= cti && c[i].end.seconds > cti && bfxPpPath(c[i])) {
                target = c[i]; tIndex = t; break;
            }
        }
    }
    if (!target) return bfxFail('Select a video clip, or park the playhead over one.');
    var fr = 1 / fps;
    var start = (cti > target.start.seconds && cti < target.end.seconds - fr) ? cti : target.start.seconds;
    base.path = bfxPpPath(target);
    base.start = start;
    base.srcAt = target.inPoint.seconds + (start - target.start.seconds);
    base.remaining = target.end.seconds - start;
    base.track = tIndex;
    base.name = target.name;
    return bfxOk(base);
}

function bfxPpBin() {
    var root = app.project.rootItem;
    for (var i = 0; i < root.children.numItems; i++) {
        var c = root.children[i];
        if (c.type === ProjectItemType.BIN && c.name === 'Barborka FX') return c;
    }
    return root.createBin('Barborka FX');
}

function bfxPpTrackFree(track, s, e) {
    var c = track.clips;
    for (var i = 0; i < c.numItems; i++) {
        if (c[i].start.seconds < e - 1e-4 && c[i].end.seconds > s + 1e-4) return false;
    }
    return true;
}

function bfxPpPlace(a) {
    var seq = app.project.activeSequence;
    if (!seq) return bfxFail('No active sequence.');
    var bin = bfxPpBin();
    var firstName = String(a.first).replace(/\\/g, '/').split('/').pop();
    var bare = firstName.replace(/\.[^.]+$/, '');
    app.project.importFiles([a.first], true, bin, a.count > 1);
    var item = null, i;
    for (i = bin.children.numItems - 1; i >= 0; i--) {
        var n = bin.children[i].name;
        if (n === firstName || n === bare || n.indexOf(bare.replace(/_\d+$/, '')) === 0) { item = bin.children[i]; break; }
    }
    if (!item) return bfxFail('Premiere did not import the render. It is saved in: ' + a.first);
    try { if (a.count > 1 && item.setOverrideFrameRate) item.setOverrideFrameRate(a.fps); } catch (e1) {}
    try { item.name = a.name; } catch (e2) {}
    var end = a.start + a.duration;
    var ti = -1, t;
    for (t = Math.max(0, a.track + 1); t < seq.videoTracks.numTracks; t++) {
        if (bfxPpTrackFree(seq.videoTracks[t], a.start, end)) { ti = t; break; }
    }
    if (ti < 0) {
        try {
            app.enableQE();
            qe.project.getActiveSequence().addTracks(1, seq.videoTracks.numTracks, 0);
            seq = app.project.activeSequence;
            ti = seq.videoTracks.numTracks - 1;
        } catch (e3) {
            return bfxFail('No free video track above the clip. Add a track and APPLY again.');
        }
    }
    try {
        seq.videoTracks[ti].overwriteClip(item, a.start);
    } catch (e4) {
        var tm = new Time();
        tm.seconds = a.start;
        seq.videoTracks[ti].overwriteClip(item, tm.ticks);
    }
    return bfxOk({ track: ti });
}

function bfxPpGrab(a) {
    var seq = app.project.activeSequence;
    if (!seq) return bfxFail('No active sequence.');
    app.enableQE();
    var tm = new Time();
    tm.seconds = a.time;
    seq.setPlayerPosition(tm.ticks);
    var q = qe.project.getActiveSequence();
    q.exportFramePNG(q.CTI.timecode, a.base);
    return bfxOk({});
}

// ------------------------------------------------------------------ entry points

function bfxGetTarget(json) {
    try {
        var a = bfxParse(json);
        return bfxIsAE() ? bfxAeTarget(a.kind) : bfxPpTarget(a.kind);
    } catch (e) { return bfxFail(e.toString()); }
}

function bfxPlace(json) {
    try {
        var a = bfxParse(json);
        return bfxIsAE() ? bfxAePlace(a) : bfxPpPlace(a);
    } catch (e) { return bfxFail(e.toString()); }
}

function bfxGrabFrame(json) {
    try {
        var a = bfxParse(json);
        return bfxIsAE() ? bfxAeGrab(a) : bfxPpGrab(a);
    } catch (e) { return bfxFail(e.toString()); }
}
