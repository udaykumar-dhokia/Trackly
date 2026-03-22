"use client"
import React, { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/button'
import { ArrowUpRightIcon } from '@phosphor-icons/react'

function useCountUp(target: number, duration = 2400, start = false) {
    const [value, setValue] = useState(0)
    useEffect(() => {
        if (!start) return
        let startTime: number | null = null
        const step = (timestamp: number) => {
            if (!startTime) startTime = timestamp
            const progress = Math.min((timestamp - startTime) / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setValue(Math.floor(eased * target))
            if (progress < 1) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
    }, [start, target, duration])
    return value
}

const PROVIDERS = ['OpenAI', 'Anthropic', 'Groq', 'Gemini', 'Mistral', 'Ollama']

export default function Hero() {
    const [mounted, setMounted] = useState(false)
    const [providerIdx, setProviderIdx] = useState(0)
    const events = useCountUp(4_812_903, 2400, mounted)
    const cost = useCountUp(29_847, 2400, mounted)

    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 100)
        return () => clearTimeout(t)
    }, [])

    useEffect(() => {
        const id = setInterval(() => setProviderIdx(i => (i + 1) % PROVIDERS.length), 1800)
        return () => clearInterval(id)
    }, [])

    return (
        <>
            <style>{`
        :root {
          --bg:#09090b; --surface:#111114; --border:rgba(255,255,255,0.07);
          --border-bright:rgba(255,255,255,0.13); --text:#f4f4f5; --muted:#71717a;
          --accent:#a78bfa; --green:#34d399;
        }
        .hero-root {
          background:var(--bg); min-height:100vh;
          color:var(--text); position:relative; overflow:hidden;
        }
        .hero-root::before {
          content:''; position:absolute; inset:0;
          background-image:linear-gradient(rgba(167,139,250,0.03) 1px,transparent 1px),
            linear-gradient(90deg,rgba(167,139,250,0.03) 1px,transparent 1px);
          background-size:48px 48px;
          mask-image:radial-gradient(ellipse 80% 60% at 50% 0%,black 30%,transparent 100%);
          pointer-events:none;
        }
        .orb { position:absolute; border-radius:50%; filter:blur(120px); pointer-events:none; }
        .orb-1 { width:600px;height:600px;background:var(--color-primary);top:-200px;left:-150px;opacity:.18; }
        .orb-2 { width:400px;height:400px;background:var(--color-secondary);top:100px;right:-100px;opacity:.1; }

        .badge {
          display:inline-flex; align-items:center; gap:6px;
          border:1px solid var(--border-bright); background:rgba(167,139,250,0.07);
          border-radius:999px; padding:4px 14px 4px 8px;
          font-family:'DM Mono',monospace; font-size:11px;
          color:var(--accent); letter-spacing:.04em; margin-bottom:28px;
        }
        .badge-dot {
          width:6px;height:6px;background:var(--green);border-radius:50%;
          box-shadow:0 0 6px var(--green); animation:pulse-dot 2s ease-in-out infinite;
        }
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:.4} }

        .hero-h1 {
          font-size:clamp(2.4rem,5.5vw,4rem); font-weight:800;
          line-height:1.08; letter-spacing:-.03em; margin-bottom:20px;
        }
        .provider-word {
          display:inline-block; min-width:160px;
          animation:cycle-fade 1.8s ease-in-out infinite;
        }
        @keyframes cycle-fade { 0%,80%{opacity:1} 90%,100%{opacity:0} }

        .hero-sub {
          font-size:clamp(.95rem,1.8vw,1.125rem); color:var(--muted);
          line-height:1.7; max-width:600px; margin:0 auto 36px;
        }
        .cta-row { display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap; }
        .btn-primary {
          display:inline-flex;align-items:center;gap:8px;background:var(--accent);
          color:#09090b;font-family:'Syne',sans-serif;font-weight:700;font-size:.9rem;
          padding:12px 24px;border-radius:8px;border:none;cursor:pointer;
          text-decoration:none;transition:transform .15s,box-shadow .15s,background .15s;
          box-shadow:0 0 24px rgba(167,139,250,.35);
        }
        .btn-primary:hover { background:#c4b5fd;transform:translateY(-1px);box-shadow:0 0 36px rgba(167,139,250,.5); }
        .btn-secondary {
          display:inline-flex;align-items:center;gap:8px;background:transparent;
          color:var(--muted);font-family:'DM Mono',monospace;font-size:.8rem;
          padding:12px 20px;border-radius:8px;border:1px solid var(--border-bright);
          cursor:pointer;text-decoration:none;transition:color .15s,border-color .15s,background .15s;
          letter-spacing:.03em;
        }
        .btn-secondary:hover { color:var(--text);border-color:rgba(255,255,255,.25);background:rgba(255,255,255,.03); }

        .code-card {
          background:var(--surface);border:1px solid var(--border);border-radius:12px;
          overflow:hidden;text-align:left;max-width:560px;margin:0 auto;
          box-shadow:0 32px 80px rgba(0,0,0,.5),0 0 0 1px var(--border);
        }
        .code-topbar {
          display:flex;align-items:center;gap:6px;padding:12px 16px;
          border-bottom:1px solid var(--border);background:rgba(255,255,255,.02);
        }
        .dot { width:10px;height:10px;border-radius:50%; }
        .dot-r{background:#ff5f57}.dot-y{background:#febc2e}.dot-g{background:#28c840}
        .code-filename { margin-left:8px;font-family:'DM Mono',monospace;font-size:11px;color:var(--muted); }
        .code-body {
          padding:20px 22px;font-family:'DM Mono',monospace;font-size:12.5px;
          line-height:1.75;color:#a1a1aa;white-space:pre;overflow-x:auto;
        }
        .c-purple{color:#c084fc}.c-green{color:#86efac}.c-amber{color:#fde68a}
        .c-blue{color:#93c5fd}.c-muted{color:#52525b}

        .stats-row {
          display:flex;border:1px solid var(--border);border-radius:12px;
          overflow:hidden;background:var(--surface);max-width:560px;margin:0 auto;
        }
        .stat-cell {
          flex:1;padding:16px 20px;text-align:center;
          border-right:1px solid var(--border);
        }
        .stat-cell:last-child{border-right:none}
        .stat-num {
          font-size:1.35rem;font-weight:700;color:var(--text);
          letter-spacing:-.02em;font-variant-numeric:tabular-nums;
        }
        .stat-label {
          font-family:'DM Mono',monospace;font-size:10px;color:var(--muted);
          letter-spacing:.06em;text-transform:uppercase;margin-top:2px;
        }

        .reveal { opacity:0;transform:translateY(16px);transition:opacity .6s ease,transform .6s ease; }
        .reveal.in { opacity:1;transform:translateY(0); }
        .d1{transition-delay:.1s}.d2{transition-delay:.2s}.d3{transition-delay:.35s}
        .d4{transition-delay:.5s}.d5{transition-delay:.65s}.d6{transition-delay:.8s}
      `}</style>

            <div className="hero-root">
                <div className="orb orb-1" />
                <div className="orb orb-2" />

                <section style={{ display: 'grid', placeContent: 'center', minHeight: '100vh', padding: '80px 24px' }}>
                    <div style={{ maxWidth: 920, margin: '0 auto', textAlign: 'center' }}>

                        {/* Badge */}
                        <div className={`reveal d1 ${mounted ? 'in' : ''}`} style={{ display: 'flex', justifyContent: 'center' }}>
                            <span className="badge text-white!">
                                <span className="badge-dot" />
                                Now tracking 6 providers · Open beta
                            </span>
                        </div>

                        {/* H1 */}
                        <h1 className={`hero-h1 reveal d2 ${mounted ? 'in' : ''}`}>
                            Track every{' '}
                            <span className="provider-word text-primary" key={providerIdx}>{PROVIDERS[providerIdx]}</span>
                            <br />
                            call. Know your costs.
                        </h1>

                        {/* Sub */}
                        <p className={`hero-sub reveal d3 ${mounted ? 'in' : ''}`}>
                            Two lines of code. Automatic token tracking, cost attribution,
                            and latency monitoring — across OpenAI, Anthropic, Groq, Gemini,
                            and more. No proxies, zero added latency.
                        </p>

                        {/* CTAs */}
                        <div className={`cta-row reveal d4 ${mounted ? 'in' : ''}`}>
                            <Button className='border-2 border-black bg-white px-5 py-3 font-semibold text-black shadow-primary shadow-[4px_4px_0_0] hover:bg-indigo-300 focus:ring-2 focus:ring-indigo-300 focus:outline-0'>Start for free <ArrowUpRightIcon /> </Button>
                            <a href="#" className="btn-secondary">$ pip install trackly</a>
                        </div>

                        {/* Code card */}
                        <div className={`reveal d5 ${mounted ? 'in' : ''}`} style={{ marginTop: 48 }}>
                            <div className="code-card">
                                <div className="code-topbar">
                                    <span className="dot dot-r" /><span className="dot dot-y" /><span className="dot dot-g" />
                                    <span className="code-filename">main.py</span>
                                </div>
                                <div className="code-body">
                                    <span className="c-purple">from</span> trackly <span className="c-purple">import</span> <span className="c-blue">Trackly</span>{'\n'}
                                    <span className="c-purple">from</span> langchain_groq <span className="c-purple">import</span> <span className="c-blue">ChatGroq</span>{'\n'}
                                    {'\n'}
                                    <span className="c-muted"># 1. Init once</span>{'\n'}
                                    trackly <span className="c-amber">=</span> <span className="c-blue">Trackly</span>(api_key<span className="c-amber">=</span><span className="c-green">"tk_live_..."</span>){'\n'}
                                    {'\n'}
                                    <span className="c-muted"># 2. Attach callback — that's it</span>{'\n'}
                                    llm <span className="c-amber">=</span> <span className="c-blue">ChatGroq</span>({'\n'}
                                    {'  '}model<span className="c-amber">=</span><span className="c-green">"llama-3.3-70b-versatile"</span>,{'\n'}
                                    {'  '}callbacks<span className="c-amber">=[</span>trackly.callback({'\n'}
                                    {'    '}feature<span className="c-amber">=</span><span className="c-green">"chat"</span>,{'\n'}
                                    {'    '}user_id<span className="c-amber">=</span>user.id,{'\n'}
                                    {'  '}<span className="c-amber">)]</span>,{'\n'}
                                    ){'\n'}
                                    <span className="c-muted"># Every Groq call is now tracked automatically ✓</span>
                                </div>
                            </div>
                        </div>

                        {/* Stats */}
                        {/* <div className={`reveal d6 ${mounted ? 'in' : ''}`} style={{ marginTop: 16 }}>
                            <div className="stats-row">
                                <div className="stat-cell">
                                    <div className="stat-num">{events.toLocaleString()}</div>
                                    <div className="stat-label">Events tracked</div>
                                </div>
                                <div className="stat-cell">
                                    <div className="stat-num" style={{ color: 'var(--green)' }}>${cost.toLocaleString()}</div>
                                    <div className="stat-label">Cost saved</div>
                                </div>
                                <div className="stat-cell">
                                    <div className="stat-num">6</div>
                                    <div className="stat-label">Providers</div>
                                </div>
                                <div className="stat-cell">
                                    <div className="stat-num" style={{ color: 'var(--accent)' }}>2</div>
                                    <div className="stat-label">Lines of code</div>
                                </div>
                            </div>
                        </div> */}

                    </div>
                </section>
            </div>
        </>
    )
}