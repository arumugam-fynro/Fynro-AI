'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from './AppProvider';
import { Icon } from './Icon';
import { Chip } from './Chip';
import { fileSize, uid } from '@/lib/util';
import type { Attachment } from '@/lib/types';

type PlusPos = { top?: number; bottom?: number; left: number; w: number };

const IMG = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const TEXT = /\.(txt|csv|md|json|tsv)$/i;
const MAX_FILE = 4 * 1024 * 1024;      // per image / PDF
const MAX_TEXT = 200 * 1024;           // per text file (inlined into the prompt)
const MAX_FILES = 5;
const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,application/pdf,.pdf,.txt,.csv,.tsv,.md,.json';

/** Voice dictation: Web Speech API for the text, microphone level for the waveform. No simulation. */
function useDictation(onText: (t: string) => void, getBase: () => string, onUnsupported: (m: string) => void) {
  const [on, setOn] = useState(false);
  const [levels, setLevels] = useState<number[]>([]);
  const [secs, setSecs] = useState(0);
  const r = useRef<{ tick?: ReturnType<typeof setInterval>; rec?: any; stream?: MediaStream; ctx?: AudioContext; an?: AnalyserNode; buf?: Uint8Array<ArrayBuffer>; base: string; t0: number; live: boolean }>({ base: '', t0: 0, live: false });

  const cleanup = useCallback(() => {
    const s = r.current;
    clearInterval(s.tick);
    if (s.rec) { s.rec.onend = null; try { s.rec.stop(); } catch {} s.rec = undefined; }
    s.stream?.getTracks().forEach((t) => t.stop()); s.stream = undefined;
    try { s.ctx?.close(); } catch {}
    s.ctx = undefined; s.an = undefined; s.live = false;
  }, []);

  const stop = useCallback((keep: boolean) => {
    const wasOn = r.current.live;
    const base = r.current.base;
    cleanup();
    setOn(false);
    if (wasOn && !keep) onText(base.replace(/\s+$/, ''));
  }, [cleanup, onText]);

  const start = useCallback(async () => {
    const s = r.current;
    if (s.live) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return onUnsupported('Voice input is not supported in this browser. Try Chrome, Edge or Safari.');
    s.live = true;
    const base = getBase();
    s.base = base ? base.replace(/\s+$/, '') + ' ' : '';
    s.t0 = Date.now();
    const n = window.innerWidth < 768 ? 22 : 40;
    setOn(true); setSecs(0); setLevels(Array(n).fill(0));
    s.tick = setInterval(() => {
      let lv = 0;
      if (s.an && s.buf) {
        s.an.getByteTimeDomainData(s.buf);
        let sum = 0;
        for (let i = 0; i < s.buf.length; i++) { const d = (s.buf[i] - 128) / 128; sum += d * d; }
        lv = Math.min(1, Math.sqrt(sum / s.buf.length) * 5);
      }
      setLevels((p) => [...p.slice(1), lv]);
      setSecs(Math.floor((Date.now() - s.t0) / 1000));
    }, 70);

    try {
      const rec = new SR();
      rec.continuous = true; rec.interimResults = true; rec.lang = 'en-IN';
      let fin = '';
      rec.onresult = (ev: any) => {
        let interim = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const t = ev.results[i][0].transcript;
          if (ev.results[i].isFinal) fin += t + ' '; else interim += t;
        }
        onText(s.base + fin + interim);
      };
      rec.onerror = (ev: any) => {
        if (['not-allowed', 'service-not-allowed'].includes(ev.error)) { stop(false); onUnsupported('Microphone access was blocked. Allow it in your browser settings.'); }
        else if (ev.error === 'network') { stop(true); onUnsupported('Voice input needs an internet connection.'); }
      };
      rec.onend = () => { if (s.live && s.rec === rec) { try { rec.start(); } catch {} } };
      rec.start(); s.rec = rec;
    } catch { stop(false); return onUnsupported('Could not start voice input.'); }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!s.live) { stream.getTracks().forEach((t) => t.stop()); return; }
      s.stream = stream;
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const an = ctx.createAnalyser(); an.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(an);
      s.ctx = ctx; s.an = an; s.buf = new Uint8Array(an.fftSize);
    } catch { s.an = undefined; }
  }, [getBase, onText, onUnsupported, stop]);

  useEffect(() => cleanup, [cleanup]);
  return { on, levels, secs, start, stop };
}

const readB64 = (f: File) => new Promise<string>((res, rej) => {
  const fr = new FileReader();
  fr.onload = () => res(String(fr.result).split(',')[1] || '');
  fr.onerror = () => rej(fr.error);
  fr.readAsDataURL(f);
});

export function Composer() {
  const a = useApp();
  const [draft, setDraft] = useState('');
  const [atts, setAtts] = useState<Attachment[]>([]);
  const [plus, setPlus] = useState<{ pos: PlusPos } | null>(null);
  const [drag, setDrag] = useState(false);
  const docRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const attsRef = useRef(atts);
  attsRef.current = atts;

  const rec = useDictation(setDraft, useCallback(() => draftRef.current, []), a.flash);

  const addFiles = useCallback(async (files: FileList | File[] | null) => {
    for (const f of Array.from(files || [])) {
      if (attsRef.current.length >= MAX_FILES) { a.flash(`You can attach up to ${MAX_FILES} files per message.`); break; }
      const id = uid();
      try {
        if (IMG.includes(f.type)) {
          if (f.size > MAX_FILE) { a.flash(`${f.name} is over 4 MB.`); continue; }
          const data = await readB64(f);
          setAtts((p) => [...p, { id, kind: 'image', name: f.name, meta: fileSize(f.size), file: { mime: f.type, data }, url: f.size < 1.5e6 ? `data:${f.type};base64,${data}` : undefined }]);
        } else if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
          if (f.size > MAX_FILE) { a.flash(`${f.name} is over 4 MB.`); continue; }
          setAtts((p) => [...p, { id, kind: 'doc', name: f.name, meta: `PDF · ${fileSize(f.size)}`, file: { mime: 'application/pdf', data: '' } }]);
          const data = await readB64(f);
          setAtts((p) => p.map((x) => (x.id === id ? { ...x, file: { mime: 'application/pdf', data } } : x)));
        } else if (TEXT.test(f.name) || f.type.startsWith('text/')) {
          if (f.size > MAX_TEXT) { a.flash(`${f.name} is too large. Text files can be up to 200 KB.`); continue; }
          const text = await f.text();
          setAtts((p) => [...p, { id, kind: 'doc', name: f.name, meta: `${(f.name.split('.').pop() || 'TXT').toUpperCase()} · ${fileSize(f.size)}`, text }]);
        } else {
          a.flash(`${f.name}: use an image, PDF, CSV or text file.`);
        }
      } catch { a.flash(`Could not read ${f.name}.`); }
    }
  }, [a]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') { e.preventDefault(); docRef.current?.click(); }
      if (e.key === 'Escape') { setPlus(null); if (rec.on) rec.stop(false); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [rec]);

  const ready = atts.every((x) => !x.file || x.file.data);
  const canSend = (!!draft.trim() || atts.length > 0) && !a.pending && ready;

  const submit = () => {
    if (rec.on) rec.stop(true);
    if (!canSend) return;
    if (a.send(draft, atts)) { setDraft(''); setAtts([]); setPlus(null); }
  };

  const openPlus = (e: React.MouseEvent<HTMLElement>) => {
    if (plus) return setPlus(null);
    const rc = e.currentTarget.getBoundingClientRect();
    const w = Math.min(300, window.innerWidth - 16);
    const left = Math.max(8, Math.min(rc.left, window.innerWidth - w - 8));
    const below = window.innerHeight - rc.bottom > 220;
    setPlus({ pos: below ? { top: rc.bottom + 8, left, w } : { bottom: window.innerHeight - rc.top + 8, left, w } });
  };

  const mmss = `${Math.floor(rec.secs / 60)}:${String(rec.secs % 60).padStart(2, '0')}`;
  const needKey = a.keyInfo.loaded && !a.hasKey;

  return (
    <div className="cwrap">
      {needKey && (
        <button className="banner" onClick={() => a.openSettings('api')}>
          <Icon n="key" size="m" />
          <span style={{ flex: 1 }}>Add your Anthropic API key to start chatting</span>
          <Icon n="fwd" size="m" />
        </button>
      )}
      <div className="tray glass">
        <div
          className={'well' + (drag ? ' drag' : '')}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); void addFiles(e.dataTransfer.files); }}
        >
          <input ref={imgRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }} />
          <input ref={docRef} type="file" multiple accept={ACCEPT} hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }} />
          {atts.length > 0 && <div className="chips">{atts.map((x) => <Chip key={x.id} a={x} onRemove={() => setAtts((p) => p.filter((y) => y.id !== x.id))} />)}</div>}
          <textarea
            className="ta" rows={2} value={draft} aria-label="Message"
            placeholder={rec.on ? 'Listening…' : 'Ask about your money, taxes or investments'}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
          />
          {!rec.on ? (
            <div className="crow">
              <button className={'cb pbtn' + (plus ? ' on' : '')} title="Add files" aria-label="Add files" aria-haspopup="menu" onClick={openPlus}><Icon n="plus" size="l" /></button>
              <div style={{ flex: 1 }} />
              <button className="cb" title="Dictate" aria-label="Dictate" onClick={() => { setPlus(null); void rec.start(); }}><Icon n="mic" size="l" /></button>
              {a.pending ? (
                <button className="cb send" title="Stop" aria-label="Stop generating" onClick={a.stop}><Icon n="stop" /></button>
              ) : (
                <button className="cb send" title="Send" aria-label="Send" disabled={!canSend} onClick={submit}><Icon n="send" /></button>
              )}
            </div>
          ) : (
            <div className="crow">
              <button className="cb cancel" title="Cancel" aria-label="Cancel dictation" onClick={() => rec.stop(false)}><Icon n="x" /></button>
              <div className="recbar">
                <span className="recdot" />
                <span className="rectime">{mmss}</span>
                <div className="bars" aria-hidden="true">
                  {rec.levels.map((l, i) => <span key={i} style={{ height: 4 + l * 22, opacity: 0.35 + l * 0.65 }} />)}
                </div>
              </div>
              <button className="cb send" title="Done" aria-label="Finish dictation" onClick={() => rec.stop(true)}><Icon n="check" /></button>
            </div>
          )}
        </div>
      </div>

      {plus && (
        <>
          <div className="scrim" onClick={() => setPlus(null)} />
          <div className="plus pop" role="menu" style={{ top: plus.pos.top, bottom: plus.pos.bottom, left: plus.pos.left, width: plus.pos.w }}>
            <button className="pi" onClick={() => { setPlus(null); docRef.current?.click(); }}><Icon n="file" size="l" /><span className="grow">Upload or add files</span><kbd>⌘ U</kbd></button>
            <button className="pi only-m" onClick={() => { setPlus(null); imgRef.current?.click(); }}><Icon n="camera" size="l" /><span className="grow">Take a photo</span></button>
            <div className="hint" style={{ padding: '6px 12px 8px' }}>Images, PDFs, CSV and text files. Claude reads them with your message.</div>
          </div>
        </>
      )}
      <div className="disc">Fynro can make mistakes. Verify figures before filing or investing.</div>
    </div>
  );
}
