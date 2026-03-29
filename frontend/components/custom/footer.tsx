import React from 'react'

const NAV_LINKS = [
    { label: 'Docs', href: '/docs' },
    { label: 'GitHub', href: 'https://github.com/udaykumar-dhokia' },
    { label: 'Changelog', href: '/changelogs' },
    { label: 'Privacy', href: '#' },
    { label: 'Terms', href: '#' },
    { label: 'Support', href: 'mailto:support@tracklyai.in' },
]

export default function Footer() {
    return (
        <>
            <style>{`
        .footer-wordmark {
          font-size: clamp(80px, 18vw, 180px);
          font-weight: 900;
          letter-spacing: -0.05em;
          line-height: 1;
          color: transparent;
          -webkit-text-stroke: 1px rgba(255,255,255,0.07);
          background: linear-gradient(
            180deg,
            rgba(255,255,255,0.13) 0%,
            rgba(255,255,255,0.04) 55%,
            transparent 100%
          );
          -webkit-background-clip: text;
          background-clip: text;
          user-select: none;
          position: relative;
          z-index: 1;
        }
        .footer-wordmark-wrap::after {
          content: '';
          position: absolute;
          left: 0; right: 0; bottom: 0;
          height: 70%;
          background: linear-gradient(to top, #09090b 20%, transparent 100%);
          z-index: 2;
          pointer-events: none;
        }
        .footer-glow {
          position: absolute;
          width: 70%; height: 200px;
          background: radial-gradient(ellipse at center, rgba(167,139,250,0.08) 0%, transparent 70%);
          top: 50%; left: 50%; transform: translate(-50%, -50%);
          pointer-events: none; z-index: 0;
        }
        .footer-nav-link {
          font-size: 0.75rem;
          color: #52525b;
          text-decoration: none;
          letter-spacing: 0.02em;
          transition: color 0.15s;
        }
        .footer-nav-link:hover { color: #f4f4f5; }
        .logo-dot {
          animation: pulse-dot 2s ease-in-out infinite;
        }
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>

            <footer className="bg-[#09090b] border-t border-white/6 relative overflow-hidden">

                {/* ── Giant wordmark with fade ── */}
                <div className="footer-wordmark-wrap relative flex items-center justify-center pt-[72px] overflow-hidden">
                    <div className="footer-glow" />
                    <span className="footer-wordmark">Trackly</span>
                </div>

                {/* ── Bottom bar ── */}
                <div className="relative z-10 max-w-[1080px] mx-auto px-8 pb-9">
                    <hr className="border-none border-t border-white/6 mb-7" />

                    <div className="flex flex-wrap items-center justify-between gap-5">

                        {/* Brand */}
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 text-[.9rem] font-bold tracking-[-0.02em] text-zinc-100">
                                Trackly
                            </div>
                            <p className="text-[.72rem] text-zinc-600 tracking-[.01em]">
                                Track every call. Know your costs.
                            </p>
                        </div>

                        {/* Nav */}
                        <nav className="flex items-center flex-wrap gap-x-6 gap-y-2">
                            {NAV_LINKS.map((link, i) => (
                                <React.Fragment key={link.label}>
                                    {i > 0 && (
                                        <span className="text-[.7rem] text-zinc-700">·</span>
                                    )}
                                    <a
                                        href={link.href}
                                        target={link.href.startsWith('http') ? '_blank' : undefined}
                                        rel="noopener noreferrer"
                                        className="footer-nav-link"
                                    >
                                        {link.label}
                                    </a>
                                </React.Fragment>
                            ))}
                        </nav>

                        {/* Copyright */}
                        <p className="text-[.72rem] text-zinc-700 whitespace-nowrap">
                            © 2026 Trackly
                        </p>

                    </div>
                </div>

            </footer>
        </>
    )
}