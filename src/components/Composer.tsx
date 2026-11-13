'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from './AppProvider';
import { Icon } from './Icon';
import { Chip } from './Chip';
import { Logo } from './Logo';
import { fileSize, uid } from '@/lib/util';
import type { Attachment } from '@/lib/types';

type PlusPos = { top?: number; bottom?: number; left: number; w: number };

function Gmail() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M1.6 21h3.8v-9.3L0 7.7v11.7C0 20.3.7 21 1.6 21z" /><path fill="#34A853" d="M18.6 21h3.8c.9 0 1.6-.7 1.6-1.6V7.7l-5.4 4z" />
      <path fill="#FBBC04" d="M18.6 3.7v8l5.4-4V5.3c0-2-2.3-3.1-3.9-1.9z" /><path fill="#EA4335" d="M5.4 11.7v-8L12 8.6l6.6-4.9v8L12 16.6z" />
      <path fill="#C5221F" d="M0 5.3v2.4l5.4 4v-8L3.9 3.4C2.3 2.2 0 3.3 0 5.3z" />
    </svg>
  );
}

/** Voice dictation: Web Speech API for text + mic RMS for the waveform, with a simulated fallback. */
function useDictation(onText: (t: string) => void, getBase: () => string) {
  const [on, setOn] = useState(false);
  const [levels, setLevels] = useState<number[]>([]);
  const [secs, setSecs] = useState(0);
  const r = useRef<{ tick?: ReturnType<typeof setInterval>; sim?: ReturnType<typeof setInterval>; rec?: any; stream?: MediaStream; ctx?: AudioContext; an?: AnalyserNode; buf?: Uint8Array<ArrayBuffer>; base: string; t0: number; live: boolean }>({ base: '', t0: 0, live: false });

  const cleanup = useCallback(() => {
    const s = r.current;
    clearInterval(s.tick); clearInterval(s.sim); s.sim = undefined;
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
    s.live = true;
    const base = getBase();
    s.base = base ? base.replace(/\s+$/, '') + ' ' : '';
    s.t0 = Date.now();
    const n = window.innerWidth < 768 ? 22 : 40;
    setOn(true); setSecs(0); setLevels(Array(n).fill(0));
    s.tick = setInterval(() => {
      let lv: number;
      if (s.an && s.buf) {
        s.an.getByteTimeDomainData(s.buf);
        let sum = 0;
        for (let i = 0; i < s.buf.length; i++) { const d = (s.buf[i] - 128) / 128; sum += d * d; }
        lv = Math.min(1, Math.sqrt(sum / s.buf.length) * 5);
      } else {
        const t = Date.now() / 1000;
        lv = Math.max(0.05, Math.min(1, 0.25 + 0.45 * Math.abs(Math.sin(t * 3.1) * Math.cos(t * 1.7)) + Math.random() * 0.3));
      }
      setLevels((p) => [...p.slice(1), lv]);
      setSecs(Math.floor((Date.now() - s.t0) / 1000));
    }, 70);

    const startSim = () => {
      if (s.sim) return;
      const words = 'How much did I spend on dining out this month compared to last month?'.split(' ');
      let i = 0;
      s.sim = setInterval(() => { if (i >= words.length) return clearInterval(s.sim); i++; onText(s.base + words.slice(0, i).join(' ')); }, 260);
    };
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    let started = false;
    if (SR) {
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
        rec.onerror = (ev: any) => { if (['not-allowed', 'service-not-allowed', 'network'].includes(ev.error)) { s.rec = undefined; startSim(); } };
        rec.onend = () => { if (s.live && s.rec === rec) { try { rec.start(); } catch {} } };
        rec.start(); s.rec = rec; started = true;
      } catch {}
    }
    if (!started) startSim();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!s.live) { stream.getTracks().forEach((t) => t.stop()); return; }
      s.stream = stream;
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const an = ctx.createAnalyser(); an.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(an);
      s.ctx = ctx; s.an = an; s.buf = new Uint8Array(an.fftSize);
    } catch { s.an = undefined; }
  }, [getBase, onText]);

  useEffect(() => cleanup, [cleanup]);
  return { on, levels, secs, start, stop };
}

export function Composer() {
  const a = useApp();
  const [draft, setDraft] = useState('');
  const [atts, setAtts] = useState<Attachment[]>([]);
  const [research, setResearch] = useState(false);
  const [memory, setMemory] = useState(true);
  const [plus, setPlus] = useState<{ view: 'main' | 'conn'; pos: PlusPos } | null>(null);
  const [linkMode, setLinkMode] = useState(false);
  const [link, setLink] = useState('');
  const [drag, setDrag] = useState(false);
  const docRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const rec = useDictation(setDraft, useCallback(() => draftRef.current, []));

  const addFiles = useCallback((files: FileList | File[] | null) => {
    Array.from(files || []).forEach((f) => {
      const img = (f.type || '').startsWith('image/');
      const at: Attachment = { id: uid(), kind: img ? 'image' : 'doc', name: f.name, meta: img ? fileSize(f.size) : `${(f.name.split('.').pop() || 'File').toUpperCase()} · ${fileSize(f.size)}` };
      setAtts((p) => [...p, at]);
      if (img && f.size < 1.5e6) {
        const fr = new FileReader();
        fr.onload = () => setAtts((p) => p.map((x) => (x.id === at.id ? { ...x, url: fr.result as string } : x)));
        fr.readAsDataURL(f);
      }
    });
  }, []);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') { e.preventDefault(); docRef.current?.click(); }
      if (e.key === 'Escape') { setPlus(null); if (rec.on) rec.stop(false); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [rec]);

  const sources = a.activeSources(research);
  const connected = a.data.connectors.filter((c) => c.connected);
  const canSend = (!!draft.trim() || atts.length > 0) && !a.pending;

  const submit = () => {
    if (rec.on) rec.stop(true);
    if (!canSend) return;
    a.send(draft, atts, { research, memory });
    setDraft(''); setAtts([]); setPlus(null);
  };

  const openPlus = (e: React.MouseEvent<HTMLElement>, view: 'main' | 'conn') => {
    if (plus && view === 'main' && plus.view === 'main') return setPlus(null);
    const rc = e.currentTarget.getBoundingClientRect();
    const w = Math.min(320, window.innerWidth - 16);
    const left = Math.max(8, Math.min(rc.left, window.innerWidth - w - 8));
    const below = window.innerHeight - rc.bottom > 380;
    setLinkMode(false);
    setPlus({ view, pos: below ? { top: rc.bottom + 8, left, w } : { bottom: window.innerHeight - rc.top + 8, left, w } });
  };

  const addLink = () => {
    let v = link.trim();
    if (!v) return;
    if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
    let u: URL | undefined;
    try { u = new URL(v); } catch {}
    if (!u || !u.hostname.includes('.')) return a.flash('Enter a valid link');
    const name = (u.hostname.replace(/^www\./, '') + u.pathname).replace(/\/$/, '');
    setAtts((p) => [...p, { id: uid(), kind: 'link', name, url: v, meta: 'Link' }]);
    setLink(''); setLinkMode(false); setPlus(null);
  };

  const mmss = `${Math.floor(rec.secs / 60)}:${String(rec.secs % 60).padStart(2, '0')}`;

  return (
    <div className="cwrap">
      <div className="tray glass">
        <div
          className={'well' + (drag ? ' drag' : '')}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
        >
          <input ref={imgRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          <input ref={docRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          {atts.length > 0 && <div className="chips">{atts.map((x) => <Chip key={x.id} a={x} onRemove={() => setAtts((p) => p.filter((y) => y.id !== x.id))} />)}</div>}
          <textarea
            ref={taRef} className="ta" rows={2} value={draft} aria-label="Message"
            placeholder={rec.on ? 'Listening…' : 'Ask about your money, taxes or investments'}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
          />
          {!rec.on ? (
            <div className="crow">
              <button className={'cb pbtn' + (plus ? ' on' : '')} title="Add files and more" aria-label="Add files and more" aria-haspopup="menu" onClick={(e) => openPlus(e, 'main')}><Icon n="plus" size="l" /></button>
              {research && <button className="tag on" title="Turn off research" onClick={() => setResearch(false)}><Icon n="globe" size="s" />Research<Icon n="x" size="s" /></button>}
              {sources.length > 0 && <button className="tag" onClick={(e) => openPlus(e, 'conn')}><Icon n="plug" size="s" />{sources.length === 1 ? sources[0] : `${sources.length} sources`}</button>}
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
            {plus.view === 'main' ? (
              <>
                <button className="pi" onClick={() => { setPlus(null); docRef.current?.click(); }}><Icon n="file" size="l" /><span className="grow">Upload or add files</span><kbd>⌘ U</kbd></button>
                <button className="pi only-m" onClick={() => { setPlus(null); imgRef.current?.click(); }}><Icon n="camera" size="l" /><span className="grow">Take a photo</span></button>
                {!linkMode ? (
                  <button className="pi" onClick={() => setLinkMode(true)}><Icon n="link" size="l" /><span className="grow">Add a link</span></button>
                ) : (
                  <div className="linkrow">
                    <input className="inp" autoFocus placeholder="example.com/statement" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addLink(); if (e.key === 'Escape') setLinkMode(false); }} />
                    <button className="btn" onClick={addLink}>Add</button>
                  </div>
                )}
                <div className="mdiv" style={{ margin: '5px 12px' }} />
                <button className="pi" onClick={() => setPlus({ ...plus, view: 'conn' })}><Icon n="plug" size="l" /><span className="grow">Connectors</span><Icon n="fwd" size="m" /></button>
                <button className="pi" onClick={() => setResearch(!research)}><Icon n="globe" size="l" /><span className="grow">Research</span>{research && <span style={{ color: 'var(--check)', display: 'inline-flex' }}><Icon n="check" size="m" /></span>}</button>
                <button className="pi" onClick={() => setMemory(!memory)}><Icon n="brain" size="l" /><span className="grow">Memory</span>{memory && <span style={{ color: 'var(--check)', display: 'inline-flex' }}><Icon n="check" size="m" /></span>}</button>
              </>
            ) : (
              <>
                <button className="pi sub" onClick={() => setPlus({ ...plus, view: 'main' })}><Icon n="back" size="m" /><span className="grow">Connectors</span></button>
                <div className="mdiv" style={{ margin: '5px 12px' }} />
                {connected.map((c) => (
                  <button key={c.id} className="pi" onClick={() => a.patch({ connectors: a.data.connectors.map((x) => (x.id === c.id ? { ...x, active: !x.active } : x)) })}>
                    {c.id === 'gmail' ? <span className="ctile w"><Gmail /></span> : <Logo size={26} radius={8} />}
                    <span className="grow">{c.name}</span>
                    <span className={'tog' + (c.active ? ' on' : '')}><i /></span>
                  </button>
                ))}
                {!connected.length && <div style={{ padding: '10px 12px', fontSize: 14, color: 'var(--muted)' }}>No connectors linked yet.</div>}
                <div className="mdiv" style={{ margin: '5px 12px' }} />
                <button className="pi" style={{ fontSize: 14 }} onClick={() => { setPlus(null); a.openSettings('connectors'); }}><Icon n="gear" size="l" /><span className="grow">Manage connectors</span></button>
              </>
            )}
          </div>
        </>
      )}
      <div className="disc">Fynro can make mistakes. Verify figures before filing or investing.</div>
    </div>
  );
}
