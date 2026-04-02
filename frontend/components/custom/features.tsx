"use client"
import { MoneyIcon, TimerIcon, TrendUpIcon, UserIcon, WarningIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { motion, Variants } from 'framer-motion'

const PROVIDERS = [
    { chip: 'OpenAI', provider: 'openai', model: 'gpt-4o' },
    { chip: 'Anthropic', provider: 'anthropic', model: 'claude-3-5-sonnet' },
    { chip: 'Groq', provider: 'groq', model: 'llama-3.3-70b-versatile' },
    { chip: 'Gemini', provider: 'google', model: 'gemini-1.5-flash' },
    { chip: 'Mistral', provider: 'mistral', model: 'mistral-large' },
    { chip: 'Ollama', provider: 'ollama', model: 'llama3.2' },
    { chip: 'Together', provider: 'together', model: 'mixtral-8x7b' },
    { chip: 'Fireworks', provider: 'fireworks', model: 'llama-v3-70b' },
    { chip: 'Bedrock', provider: 'aws-bedrock', model: 'titan-text-express' },
    { chip: 'Cohere', provider: 'cohere', model: 'command-r-plus' },
]

const BARS = [
    { label: 'summarizer', pct: 82, val: '$18.42', color: '#a78bfa' },
    { label: 'chat', pct: 61, val: '$13.71', color: '#fbbf24' },
    { label: 'rag-pipeline', pct: 38, val: '$8.53', color: '#60a5fa' },
    { label: 'onboarding', pct: 19, val: '$4.26', color: '#34d399' },
]

const SPARKLINE = [35, 45, 40, 60, 50, 70, 65, 80, 72, 88, 76, 90, 85, 95, 100, 90, 85, 92, 88, 96, 100]

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.2
        }
    }
}

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, ease: "easeOut" }
    }
}

export default function Features() {
    const [provIdx, setProvIdx] = useState(0)

    useEffect(() => {
        const id = setInterval(() => setProvIdx(i => (i + 1) % PROVIDERS.length), 1600)
        return () => clearInterval(id)
    }, [])

    const p = PROVIDERS[provIdx]

    return (
        <>
            <style>{`
        .feat-section { position: relative; overflow: hidden; }
        .feat-section::before {
          content: ''; position: absolute; inset: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(167,139,250,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(167,139,250,0.025) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse 100% 50% at 50% 100%, black 20%, transparent 80%);
        }

        .feat-card {
          background: #0f0f12; border: 1px solid rgba(255,255,255,0.06);
          padding: 28px;
          position: relative; overflow: hidden;
        }
        .feat-card::after {
          content: ''; position: absolute; inset: 0;
          opacity: 0; transition: opacity 0.3s; pointer-events: none;
        }
        .feat-card:hover::after { opacity: 1; }
        .glow-purple::after { background: radial-gradient(ellipse 60% 50% at 50% 0%, rgba(167,139,250,0.06), transparent); }
        .glow-green::after  { background: radial-gradient(ellipse 60% 50% at 50% 0%, rgba(52,211,153,0.06), transparent); }
        .glow-amber::after  { background: radial-gradient(ellipse 60% 50% at 50% 0%, rgba(251,191,36,0.05), transparent); }
        .glow-blue::after   { background: radial-gradient(ellipse 60% 50% at 50% 0%, rgba(96,165,250,0.06), transparent); }

        .meta-code {
          background: #141418; border: 1px solid rgba(255,255,255,0.06);
          padding: 12px 14px;
          line-height: 1.7; color: #a1a1aa; white-space: pre;
        }
        .spark-bar { background: rgba(167,139,250,0.12); border: 1px solid rgba(167,139,250,0.15); transition: background 0.2s; }
        .spark-bar:hover, .spark-bar.hi { background: rgba(167,139,250,0.3); border-color: rgba(167,139,250,0.4); }
      `}</style>

            <section className="feat-section bg-[#09090b] border-t border-white/6 px-6 py-24 text-zinc-100">
                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.15 }}
                    variants={containerVariants}
                    className="mx-auto max-w-[1080px]"
                >
                    {/* Header */}
                    <motion.div variants={itemVariants} className="mb-14">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="w-5 h-px bg-primary/60" />
                            <span className=" text-[11px] uppercase tracking-[.12em] text-primary">
                                Features
                            </span>
                        </div>
                        <h2 className="text-[clamp(1.9rem,3.5vw,2.8rem)] font-extrabold tracking-[-0.03em] leading-[1.1] mb-4 max-w-[660px]">
                            Everything you need to{' '}
                            <span className="text-primary">understand</span>
                            <br />your AI spend
                        </h2>
                        <p className="text-[.95rem] text-zinc-400 leading-[1.7] max-w-[480px]">
                            From zero-config provider detection to per-user cost attribution —
                            Trackly gives you{' '}
                            <strong className="text-zinc-200 font-semibold">complete visibility</strong>{' '}
                            without changing how you write code.
                        </p>
                    </motion.div>

                    {/* Bento grid */}
                    <div className="grid grid-cols-12 gap-3">

                        {/* Card 1: Zero-config */}
                        <motion.div
                            variants={itemVariants}
                            whileHover={{ y: -4, borderColor: "rgba(255,255,255,0.11)" }}
                            className="rounded-xl feat-card glow-purple col-span-12 md:col-span-5 row-span-2 transition-colors duration-200"
                        >
                            <p className="text-[1rem] font-bold tracking-[-0.02em] mb-2">
                                Zero-config <span className="text-primary">provider detection</span>
                            </p>
                            <p className="text-[.85rem] text-zinc-400 leading-[1.65]">
                                Pass your LLM to{' '}
                                <code className=" text-[.8rem] text-zinc-200">trackly.callback()</code>
                                {' '}and walk away. Provider resolved from LangChain's class namespace —{' '}
                                <strong className="text-zinc-200">not guessed from model names</strong>{' '}
                                — so Groq, Ollama, Together, and Fireworks all work out of the box.
                            </p>

                            <div className="flex flex-wrap gap-1.5 mt-5">
                                {PROVIDERS.map((prov, i) => (
                                    <span
                                        key={prov.chip}
                                        className={[
                                            ' text-[10px] px-2.5 py-1 rounded-xl border transition-all duration-300',
                                            i === provIdx
                                                ? 'border-primary/40 text-primary bg-primary/10'
                                                : 'border-white/10 text-zinc-500 bg-[#141418]',
                                        ].join(' ')}
                                    >
                                        {prov.chip}
                                    </span>
                                ))}
                            </div>

                            <div className="rounded-xl mt-6 pt-5 border-t border-white/6">
                                <p className=" text-[10px] text-zinc-500 tracking-[.04em] uppercase mb-2">
                                    Detected automatically
                                </p>
                                <div className="flex items-center gap-2  text-[11px] mb-1.5">
                                    <span className="w-[7px] h-[7px]  bg-[#34d399] shadow-[0_0_6px_#34d399] shrink-0" />
                                    <span className="text-zinc-500">provider →</span>
                                    <span className="text-primary transition-all">{p.provider}</span>
                                </div>
                                <div className="flex items-center gap-2  text-[11px]">
                                    <span className="w-[7px] h-[7px]  bg-[#34d399] shadow-[0_0_6px_#34d399] shrink-0" />
                                    <span className="text-zinc-500">model →</span>
                                    <span className="text-zinc-200 transition-all">{p.model}</span>
                                </div>
                            </div>
                        </motion.div>

                        {/* Card 2: Cost attribution */}
                        <motion.div
                            variants={itemVariants}
                            whileHover={{ y: -4, borderColor: "rgba(255,255,255,0.11)" }}
                            className="rounded-xl feat-card glow-amber col-span-12 md:col-span-7 transition-colors duration-200"
                        >
                            <p className="text-[1rem] font-bold tracking-[-0.02em] mb-1.5">
                                <span className="text-primary">Cost attribution</span> by feature
                            </p>
                            <p className="text-[.85rem] text-zinc-400 leading-[1.65] mb-4">
                                See exactly which features are driving your bill. Tag calls with{' '}
                                <code className=" text-[.8rem] text-zinc-200">feature=</code>
                                {' '}and get a live breakdown.
                            </p>
                            <div className="flex flex-col gap-2.5">
                                {BARS.map(bar => (
                                    <div key={bar.label} className="flex items-center gap-2.5">
                                        <span className=" text-[10px] text-zinc-500 w-20 shrink-0">{bar.label}</span>
                                        <div className="flex-1 h-[6px] bg-[#141418] overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                whileInView={{ width: `${bar.pct}%` }}
                                                viewport={{ once: true }}
                                                transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                                                className="h-full rounded-xl"
                                                style={{ background: bar.color }}
                                            />
                                        </div>
                                        <span className=" text-[10px] text-zinc-500 w-10 text-right">{bar.val}</span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Card 3: Latency */}
                        <motion.div
                            variants={itemVariants}
                            whileHover={{ y: -4, borderColor: "rgba(255,255,255,0.11)" }}
                            className="rounded-xl feat-card glow-green col-span-12 md:col-span-4 transition-colors duration-200"
                        >
                            <p className="text-[1rem] font-bold tracking-[-0.02em] mb-1.5">
                                Latency <span className="text-primary">per model</span>
                            </p>
                            <p className="text-[.85rem] text-zinc-400 leading-[1.65] mb-4">
                                P50 / P95 tracked per model, per feature.
                            </p>
                            <div className=" text-[2.8rem] font-light text-zinc-100 tracking-[-0.04em] leading-none">
                                312<span className="text-[1rem] text-zinc-500 ml-1">ms</span>
                            </div>
                            <p className=" text-[10px] text-[#34d399] tracking-[.04em] mt-1.5 mb-4">▲ P95 · gpt-4o · last 24h</p>
                            <div className="flex gap-2.5">
                                {[{ label: 'P50', val: '198ms', color: '#34d399' }, { label: 'P95', val: '312ms', color: '#fbbf24' }].map(m => (
                                    <div key={m.label} className="flex-1 bg-[#141418] p-2.5 border border-white/6">
                                        <p className=" text-[9.5px] text-zinc-500 tracking-[.04em] uppercase">{m.label}</p>
                                        <p className=" text-[1rem] mt-0.5" style={{ color: m.color }}>{m.val}</p>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Card 4: Per-user cost */}
                        <motion.div
                            variants={itemVariants}
                            whileHover={{ y: -4, borderColor: "rgba(255,255,255,0.11)" }}
                            className="rounded-xl feat-card glow-blue col-span-12 md:col-span-3 transition-colors duration-200"
                        >
                            <p className="text-[1rem] font-bold tracking-[-0.02em] mb-1.5">
                                <span className="text-primary">Per-user</span> cost
                            </p>
                            <p className="text-[.8rem] text-zinc-400 leading-[1.65] mb-4">
                                Know your most expensive users instantly.
                            </p>
                            <div className="flex flex-col gap-0">
                                {[['u_8821', '$4.21', '#fbbf24'], ['u_3341', '$2.87', ''], ['u_9102', '$1.44', ''], ['u_0551', '$0.93', '']].map(([uid, val, col], i) => (
                                    <div key={uid}>
                                        {i > 0 && <hr className="border-none border-t border-white/6 my-1" />}
                                        <div className="flex justify-between items-center  text-[10px] py-1">
                                            <span className="text-zinc-500">{uid}</span>
                                            <span className="font-medium" style={{ color: col || '#f4f4f5' }}>{val}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Card 5: Live pricing table */}
                        <motion.div
                            variants={itemVariants}
                            whileHover={{ y: -4, borderColor: "rgba(255,255,255,0.11)" }}
                            className="rounded-xl feat-card glow-amber col-span-12 md:col-span-6 transition-colors duration-200"
                        >
                            <p className="text-[1rem] font-bold tracking-[-0.02em] mb-1.5">
                                Live <span className="text-primary">model pricing</span>
                            </p>
                            <p className="text-[.85rem] text-zinc-400 leading-[1.65] mb-4">
                                Cost computed at ingest. Historical events stay accurate when providers change rates.
                            </p>
                            <div className="w-full">
                                {[
                                    { model: 'gpt-4o', provider: 'openai', cost: '$2.50 / 1M', green: false },
                                    { model: 'claude-3-5-sonnet', provider: 'anthropic', cost: '$3.00 / 1M', green: false },
                                    { model: 'llama-3.3-70b', provider: 'groq', cost: '$0.59 / 1M', green: true },
                                    { model: 'gemini-1.5-flash', provider: 'google', cost: '$0.075 / 1M', green: true },
                                ].map((row, i, arr) => (
                                    <div
                                        key={row.model}
                                        className={`flex items-center gap-0 py-2  text-[10.5px] ${i < arr.length - 1 ? 'border-b border-white/6' : ''}`}
                                    >
                                        <span className="flex-1 text-zinc-100">{row.model}</span>
                                        <span className="w-24 text-zinc-500 text-[9.5px]">{row.provider}</span>
                                        <span className={`w-24 text-right ${row.green ? 'text-[#34d399]' : 'text-[#fbbf24]'}`}>{row.cost}</span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Card 6: Alerts */}
                        <motion.div
                            variants={itemVariants}
                            whileHover={{ y: -4, borderColor: "rgba(255,255,255,0.11)" }}
                            className="rounded-xl feat-card glow-purple col-span-12 md:col-span-6 transition-colors duration-200"
                        >
                            <p className="text-[1rem] font-bold tracking-[-0.02em] mb-1.5">
                                <span className="text-primary">Cost alerts</span>
                            </p>
                            <p className="text-[.8rem] text-zinc-400 leading-[1.65] mb-1">
                                Get notified before you overspend.
                            </p>
                            {[
                                { dot: '#f87171', shadow: '#f87171', title: 'Budget exceeded', sub: 'summarizer hit $20 limit' },
                                { dot: '#fbbf24', shadow: '#fbbf24', title: 'Spike detected', sub: '3× usage in last hour' },
                            ].map(alert => (
                                <div key={alert.title} className="flex items-start gap-2 mt-3 p-2.5 bg-[#141418] rounded-xl border border-white/6">
                                    <span className="w-1.5 h-1.5 rounded-xl shrink-0 mt-[5px]" style={{ background: alert.dot, boxShadow: `0 0 5px ${alert.shadow}` }} />
                                    <div className=" text-[10px] leading-normal text-zinc-500">
                                        <strong className="text-zinc-200 font-medium">{alert.title}</strong><br />{alert.sub}
                                    </div>
                                </div>
                            ))}
                        </motion.div>

                        {/* Card 7: Daily trends */}
                        <motion.div
                            variants={itemVariants}
                            whileHover={{ y: -4, borderColor: "rgba(255,255,255,0.11)" }}
                            className="rounded-xl feat-card glow-green col-span-12 transition-colors duration-200"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-[1rem] font-bold tracking-[-0.02em] mb-1.5">
                                        Daily usage <span className="text-primary">trends</span>
                                    </p>
                                    <p className="text-[.82rem] text-zinc-400 leading-[1.65] max-w-[260px]">
                                        30-day rolling view. Spot spikes, monitor growth, export to CSV.
                                    </p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className=" text-[1.6rem] font-light text-zinc-100 tracking-[-0.04em]">4.8M</p>
                                    <p className=" text-[9.5px] text-[#34d399] tracking-[.04em] mt-0.5">+23% vs last month</p>
                                </div>
                            </div>
                            <div className="flex justify-end items-end gap-1 h-[52px] mt-4">
                                {SPARKLINE.map((h, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ height: 0 }}
                                        whileInView={{ height: `${h}%` }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.5, delay: 0.8 + i * 0.02 }}
                                        className={`spark-bar flex-1 ${h === 100 ? 'hi' : ''}`}
                                    />
                                ))}
                            </div>
                            <div className="flex justify-between mt-1.5  text-[9.5px] text-zinc-600">
                                <span>Mar 1</span><span>Mar 11</span><span>Mar 22</span>
                            </div>
                        </motion.div>

                    </div>
                </motion.div>
            </section>
        </>
    )
}