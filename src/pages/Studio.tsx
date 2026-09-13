import { useEffect, useMemo, useRef, useState } from 'react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { onValue, push, ref, remove, set } from 'firebase/database'
import { useAuth } from '../auth/AuthContext'
import { db } from '../lib/firebase'
import { DEFAULT_VOICE, FISH_DIRECT, PLAYGROUND, curlSnippet, generateSpeech } from '../lib/openrouter'
import { runPool } from '../lib/queue'

type Item = {
  id: string
  text: string
  voiceId: string
  status: 'queued' | 'generating' | 'done' | 'error'
  blobUrl?: string
  blob?: Blob
  sizeKb?: string
  error?: string
  isFishDown?: boolean
}
type Voice = { id: string; voiceId: string; label: string }
type Hist = { textSnippet: string; voiceRef: string; status: string; at: string }

const SEEDS: { label: string; text: string }[] = [
  { label: 'Mon Odipoyava', text: '[sad] ఓడిపోయావా? [break] జీవితం చాలా కష్టంగా ఉందా? [worried] ఉద్యోగం రాలేదా? [empathetic] నీ కన్నీళ్లను దేవుడు చూశాడు. [calm] యెషయా 41:10 — భయపడకు, నేను నీతో ఉన్నాను. [hopeful] నీ సమయం వస్తుంది! ఆమేన్.' },
  { label: 'Tue Bhayapadakandi', text: '[worried] భయపడుతున్నావా? [break] టెన్షన్‌తో నిద్ర రావడం లేదా? [empathetic] దేవుడు నీ భయాన్ని అర్థం చేసుకున్నాడు. [calm] 2 తిమోతి 1:7 — భయం గల ఆత్మను ఇవ్వలేదు. [confident] ధైర్యంగా ముందుకు వెళ్ళు! ఆమేన్.' },
  { label: 'Thu Yavanasthulu', text: '[worried] యవ్వనస్తులారా! భవిష్యత్తు గురించి భయమా? [empathetic] దేవుడు నీ ఆందోళనను చూస్తున్నాడు. [calm] యిర్మీయా 29:11 — ప్రణాళికలు క్షేమకరమైనవి. [hopeful] నీ భవిష్యత్తు సురక్షితం. ఆమేన్.' },
  { label: 'Fri Kutumbam', text: '[sad] కుటుంబ బాధ్యత మోస్తున్నావా? [empathetic] దేవుడు నీ కష్టాన్ని చూశాడు. [calm] యెహోషువ 24:15 — నేను నా కుటుంబం యెహోవానే సేవిస్తాం. [hopeful] నీ ఇంటికి సమాధానం వస్తుంది. ఆమేన్.' },
]

let n = 0
const nid = () => `${Date.now()}-${n++}-${Math.random().toString(36).slice(2, 7)}`

export default function Studio() {
  const { user } = useAuth()
  const uid = user!.uid
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('or_key') || '')
  const [showKey, setShowKey] = useState(false)
  const [voices, setVoices] = useState<Voice[]>([{ id: 'seed', voiceId: DEFAULT_VOICE, label: 'Default Fish voice' }])
  const [newVoice, setNewVoice] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [bulk, setBulk] = useState('')
  const [concurrency, setConcurrency] = useState(3)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [history, setHistory] = useState<Hist[]>([])
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => { localStorage.setItem('or_key', apiKey) }, [apiKey])

  useEffect(() => {
    const vRef = ref(db, `users/${uid}/voices`)
    const hRef = ref(db, `users/${uid}/history`)
    const off1 = onValue(vRef, (s) => {
      const v = s.val()
      if (v) setVoices(Object.entries(v).map(([id, x]) => ({ id, ...(x as Omit<Voice, 'id'>) })))
    })
    const off2 = onValue(hRef, (s) => {
      const v = s.val()
      if (v) setHistory(Object.values(v as Record<string, Hist>).slice(-50).reverse())
    })
    return () => { off1(); off2() }
  }, [uid])

  const patch = (id: string, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)))
  const defaultVoice = voices[0]?.voiceId || DEFAULT_VOICE

  const addItem = (text: string, voiceId?: string) => {
    const t = text.trim()
    if (!t) return
    const item: Item = { id: nid(), text: t, voiceId: voiceId || defaultVoice, status: 'queued' }
    setItems((xs) => [...xs, item])
    push(ref(db, `users/${uid}/texts`), { text: t.slice(0, 2000), voiceRef: item.voiceId, createdAt: new Date().toISOString() })
  }

  const logHist = (text: string, voiceRef: string, status: string) => {
    push(ref(db, `users/${uid}/history`), { textSnippet: text.slice(0, 120), voiceRef, status, at: new Date().toISOString() })
  }

  const genOne = async (it: Item, signal?: AbortSignal) => {
    patch(it.id, { status: 'generating', error: undefined })
    try {
      const blob = await generateSpeech({ apiKey: apiKey.trim(), text: it.text, voice: it.voiceId, signal })
      const url = URL.createObjectURL(blob)
      patch(it.id, { status: 'done', blobUrl: url, blob, sizeKb: `${(blob.size / 1024).toFixed(1)} KB` })
      logHist(it.text, it.voiceId, 'done')
    } catch (e: unknown) {
      const err = e as { message?: string; isFishDown?: boolean }
      patch(it.id, { status: 'error', error: err?.message || 'Failed', isFishDown: err?.isFishDown })
      logHist(it.text, it.voiceId, 'error')
    }
  }

  const generateAll = async () => {
    if (!apiKey.trim()) { setProgress('⚠️ Paste OpenRouter API key first (sk-or-...)'); return }
    const targets = items.filter((x) => x.status === 'queued' || x.status === 'error')
    if (!targets.length) { setProgress('Nothing to generate — add texts first.'); return }
    setBusy(true)
    abortRef.current = new AbortController()
    await runPool(targets, Math.max(1, Math.min(5, concurrency)), (it) => genOne(it, abortRef.current!.signal), (d, t) =>
      setProgress(`Generating ${d}/${t}…`),
    )
    setProgress(`✓ Done: ${items.length} rows processed.`)
    setBusy(false)
  }

  const retryFailed = () => {
    setItems((xs) => xs.map((x) => (x.status === 'error' ? { ...x, status: 'queued' as const, error: undefined } : x)))
  }

  const downloadZip = async () => {
    const done = items.filter((x) => x.blob && x.status === 'done')
    if (!done.length) { setProgress('No audio yet — Generate first.'); return }
    const zip = new JSZip()
    done.forEach((x, i) => zip.file(`voice_${i + 1}_${x.voiceId.slice(0, 8)}.mp3`, x.blob!))
    const out = await zip.generateAsync({ type: 'blob' })
    saveAs(out, `voices_${new Date().toISOString().slice(0, 10)}.zip`)
  }

  const addVoice = async () => {
    const v = newVoice.trim()
    if (!v) return
    const r = push(ref(db, `users/${uid}/voices`), { voiceId: v, label: newLabel.trim() || v.slice(0, 12), createdAt: new Date().toISOString() })
    setVoices((xs) => [...xs, { id: r.key || nid(), voiceId: v, label: newLabel.trim() || v.slice(0, 12) }])
    setNewVoice(''); setNewLabel('')
  }

  const done = useMemo(() => items.filter((x) => x.status === 'done').length, [items])

  return (
    <div className="wrap">
      <div className="grid2">
        <div className="glass">
          <div className="pill">Model fish-audio/s2.1-pro-free:free · <a href={PLAYGROUND} target="_blank" rel="noreferrer">Playground ↗</a></div>
          <label className="lbl">🔑 OpenRouter API key (stored in this browser only)</label>
          <div className="row">
            <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-or-v1-..." style={{ flex: 1 }} />
            <button className="btn btn-ghost btn-sm" onClick={() => setShowKey((s) => !s)}>{showKey ? '🙈' : '👁️'}</button>
          </div>

          <label className="lbl">🎙️ Voices (reference codes saved to RTDB)</label>
          <div className="row">
            <input value={newVoice} onChange={(e) => setNewVoice(e.target.value)} placeholder="voice id e.g. b2cf0387…" style={{ flex: 1 }} />
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="label" style={{ flex: '0 0 130px' }} />
            <button className="btn btn-ghost btn-sm" onClick={addVoice}>+ Add</button>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            {voices.map((v) => (
              <span key={v.id} className="pill" title={v.voiceId}>{v.label} · {v.voiceId.slice(0, 8)}…</span>
            ))}
          </div>

          <label className="lbl">📝 Add texts (one per row — unlimited, Telugu + [emotion] tags OK)</label>
          <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder="Paste one text, or many separated by --- on its own line" />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { bulk.split(/\n---\n/).forEach((t) => addItem(t)); setBulk('') }}>+ Add to queue</button>
            <button className="btn btn-ghost btn-sm" onClick={() => SEEDS.forEach((s) => addItem(s.text))}>+ Load 4 Telugu seeds</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setItems([])}>Clear</button>
          </div>

          <label className="lbl">📋 Queue ({items.length} · {done} done)</label>
          <div className="cards">
            {items.map((it, i) => (
              <div key={it.id} className="glass" style={{ padding: 10 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: 12 }}>#{i + 1}</strong>
                  <span className={`st st-${it.status}`}>{it.status}</span>
                </div>
                <p style={{ fontSize: 13, margin: '6px 0', wordBreak: 'break-word' }}>{it.text.slice(0, 160)}{it.text.length > 160 ? '…' : ''}</p>
                <select value={it.voiceId} onChange={(e) => patch(it.id, { voiceId: e.target.value })} aria-label="voice">
                  {voices.map((v) => <option key={v.id} value={v.voiceId}>{v.label}</option>)}
                </select>
                {it.blobUrl && <audio controls src={it.blobUrl} style={{ marginTop: 6 }} />}
                {it.error && <p className="err">{it.error}</p>}
                <div className="row" style={{ marginTop: 6 }}>
                  <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => genOne(it)}>Generate</button>
                  {it.blobUrl && <a className="btn btn-ghost btn-sm" href={it.blobUrl} download={`voice_${i + 1}.mp3`} style={{ textDecoration: 'none' }}>⬇ MP3</a>}
                  {it.isFishDown && <a className="btn btn-ghost btn-sm" href={FISH_DIRECT} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>🐟 Fish Direct</a>}
                  <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard.writeText(curlSnippet('sk-or-...', it.text, it.voiceId)) }}>curl</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setItems((xs) => xs.filter((x) => x.id !== it.id))}>✕</button>
                </div>
              </div>
            ))}
          </div>
          {!items.length && <p className="kbd">Queue is empty — add texts above. Every text + voice ref is saved to your Realtime Database.</p>}
        </div>

        <div>
          <div className="glass">
            <strong>🎧 Batch + Preview</strong>
            <div className="row" style={{ marginTop: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 12 }}>Parallel <input type="number" min={1} max={5} value={concurrency} onChange={(e) => setConcurrency(Number(e.target.value))} style={{ width: 64 }} /></label>
              <span className="pill">{done}/{items.length} done</span>
            </div>
            {progress && <p className="kbd">{progress}</p>}
            <div className="stickybar" style={{ position: 'static', border: 'none', background: 'transparent', padding: '10px 0 0' }}>
              <div className="wrap2">
                <button className="btn btn-gold" disabled={busy} onClick={generateAll}>{busy ? '⏳ Generating…' : '✨ Generate All'}</button>
                <button className="btn btn-ghost" onClick={() => abortRef.current?.abort()} disabled={!busy}>⏹ Stop</button>
                <button className="btn btn-ghost" onClick={retryFailed}>↻ Retry failed</button>
                <button className="btn btn-ghost" onClick={downloadZip}>⬇ Zip all</button>
              </div>
            </div>
            <p className="kbd">Tip: if 503/CLERK error → use 🐟 Fish Direct per row or Playground. Key never leaves your browser except to OpenRouter.</p>
          </div>

          <div className="glass" style={{ marginTop: 12 }}>
            <strong>🕘 History (RTDB, last 50)</strong>
            {!history.length && <p className="kbd">No history yet — generate something.</p>}
            {history.map((h, i) => (
              <div key={i} style={{ fontSize: 12, borderTop: '1px solid var(--glass-brd)', padding: '6px 0' }}>
                <span className={`st st-${h.status === 'done' ? 'done' : 'error'}`}>{h.status}</span>{' '}
                {h.textSnippet} <span style={{ opacity: 0.6 }}>· {h.voiceRef.slice(0, 8)} · {h.at.slice(0, 16).replace('T', ' ')}</span>
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => remove(ref(db, `users/${uid}/history`)).then(() => setHistory([]))}>Clear history</button>
            <div style={{ marginTop: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => set(ref(db, `users/${uid}/profile/theme`), document.documentElement.dataset.theme || 'dark')}>💾 Save theme to profile</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
