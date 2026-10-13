import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle, ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Info, LayoutGrid, Maximize2, Menu, Search, X,
} from 'lucide-react';
import ThemeToggle from '../../components/common/ThemeToggle';
import logo from '../../assets/logo.png';
import sections from './guideData';
import './UserGuidePage.css';

/* ────────────────────────────────────────────────────────────────
   KADAL User Guideline (Banglish SOP, KADAL/SOP/INV/01 Rev 00)
   Opened from the Home / Showcase menu. Works before login.
   Bangla text renders in Nikosh (bundled), English in the UI font.
   ──────────────────────────────────────────────────────────────── */

const imageUrls = import.meta.glob('../../assets/guide/*.jpg', { eager: true, query: '?url', import: 'default' });
const imgSrc = (name) => imageUrls[`../../assets/guide/${name}.jpg`];

const STORAGE_KEY = 'kadal_user_guide_section';
const GROUPS = [
  { id: 'start', label: 'শুরু' },
  { id: 'modules', label: 'Module ভিত্তিক নির্দেশনা' },
  { id: 'end', label: 'শেষ অংশ' },
];
const ORDER = sections.map(s => s.id);
const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const bn = (n) => String(n).replace(/\d/g, d => BN_DIGITS[d]);

// ── Plain text of a section, for search ──
const blockText = (b) => {
  switch (b.t) {
    case 'steps': case 'bullets': return b.x.join(' ');
    case 'table': return [...b.head, ...b.rows.flat()].join(' ');
    case 'img': return b.cap || '';
    default: return b.x || '';
  }
};
const searchIndex = sections.map(s => ({
  id: s.id,
  text: (s.title + ' ' + s.blocks.map(blockText).join(' ')).replace(/\*\*/g, '').toLowerCase(),
}));
const countHits = (text, q) => {
  let n = 0, i = text.indexOf(q);
  while (i !== -1) { n++; i = text.indexOf(q, i + q.length); }
  return n;
};

// ── Inline rendering: **bold** + search highlight ──
const highlight = (text, q, keyBase) => {
  if (!q) return text;
  const lower = text.toLowerCase();
  const out = [];
  let from = 0, i = lower.indexOf(q);
  while (i !== -1) {
    if (i > from) out.push(text.slice(from, i));
    out.push(<mark key={`${keyBase}-${i}`} className="ug-mark">{text.slice(i, i + q.length)}</mark>);
    from = i + q.length;
    i = lower.indexOf(q, from);
  }
  if (from < text.length) out.push(text.slice(from));
  return out;
};
function Rich({ text, q }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/).filter(Boolean);
  return parts.map((p, i) => (p.startsWith('**')
    ? <strong key={i}>{highlight(p.slice(2, -2), q, i)}</strong>
    : <React.Fragment key={i}>{highlight(p, q, i)}</React.Fragment>));
}

const subHeadings = (s) => s.blocks.filter(b => b.t === 'h2').map((b, i) => ({ id: `${s.id}-h${i}`, text: b.x }));

// ── Blocks ──
function Block({ b, q, h2Id, onZoom }) {
  switch (b.t) {
    case 'h2': return <h2 id={h2Id} className="ug-h2"><Rich text={b.x} q={q} /></h2>;
    case 'p': return <p className="ug-p"><Rich text={b.x} q={q} /></p>;
    case 'note':
    case 'warn': {
      const Icon = b.t === 'warn' ? AlertTriangle : Info;
      return (
        <div className={`ug-callout ug-callout-${b.t}`} role="note">
          <Icon size={18} aria-hidden="true" className="ug-callout-icon" />
          <div><Rich text={b.x} q={q} /></div>
        </div>
      );
    }
    case 'steps':
      return (
        <ol className="ug-steps">
          {b.x.map((s, i) => (
            <li key={i}><span className="ug-step-no" aria-hidden="true">{i + 1}</span><div><Rich text={s} q={q} /></div></li>
          ))}
        </ol>
      );
    case 'bullets':
      return <ul className="ug-bullets">{b.x.map((s, i) => <li key={i}><Rich text={s} q={q} /></li>)}</ul>;
    case 'table':
      return (
        <div className="ug-table-wrap">
          <table className="ug-table">
            <thead><tr>{b.head.map((h, i) => <th key={i}><Rich text={h} q={q} /></th>)}</tr></thead>
            <tbody>{b.rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci}><Rich text={c} q={q} /></td>)}</tr>)}</tbody>
          </table>
        </div>
      );
    case 'img': {
      const src = imgSrc(b.f);
      if (!src) return null;
      return (
        <figure className="ug-figure">
          <button type="button" className="ug-figure-btn" onClick={() => onZoom({ src, cap: b.cap })} title="বড় করে দেখুন (Zoom)">
            <img src={src} width={b.w} height={b.h} alt={b.cap || 'KADAL Inventory screenshot'} loading="lazy" decoding="async" />
            <span className="ug-zoom-hint"><Maximize2 size={14} aria-hidden="true" /> Zoom</span>
          </button>
          {b.cap && <figcaption><Rich text={b.cap} q={q} /></figcaption>}
        </figure>
      );
    }
    default: return null;
  }
}

function SectionView({ section, q, onZoom, onGo }) {
  const idx = ORDER.indexOf(section.id);
  const prev = sections[idx - 1];
  const next = sections[idx + 1];
  const subs = subHeadings(section);
  const group = GROUPS.find(g => g.id === section.group);
  let h2i = -1;

  const jump = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <article className="ug-article">
      <nav className="ug-crumbs" aria-label="Breadcrumb">
        <button type="button" onClick={() => onGo('home')}>User Guideline</button>
        <ChevronRight size={13} aria-hidden="true" />
        <span>{group?.label}</span>
      </nav>
      <header className="ug-article-head">
        <span className="ug-badge ug-badge-lg">{section.badge}</span>
        <h1 className="ug-h1"><Rich text={section.title} q={q} /></h1>
      </header>

      {subs.length > 1 && (
        <div className="ug-onthis">
          <span className="ug-onthis-label">এই অংশে</span>
          {subs.map(s => <button type="button" key={s.id} className="ug-chip" onClick={() => jump(s.id)}>{s.text}</button>)}
        </div>
      )}

      <div className="ug-body">
        {section.blocks.map((b, i) => {
          if (b.t === 'h2') h2i++;
          return <Block key={i} b={b} q={q} h2Id={b.t === 'h2' ? `${section.id}-h${h2i}` : undefined} onZoom={onZoom} />;
        })}
      </div>

      <footer className="ug-pager">
        {prev ? (
          <button type="button" className="ug-pager-btn" onClick={() => onGo(prev.id)}>
            <ChevronLeft size={18} aria-hidden="true" />
            <span><small>আগের অংশ</small>{prev.title}</span>
          </button>
        ) : <span />}
        {next ? (
          <button type="button" className="ug-pager-btn ug-pager-next" onClick={() => onGo(next.id)}>
            <span><small>পরের অংশ</small>{next.title}</span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        ) : <span />}
      </footer>
    </article>
  );
}

function HomeView({ onGo }) {
  const imgCount = sections.reduce((n, s) => n + s.blocks.filter(b => b.t === 'img').length, 0);
  const moduleCount = sections.filter(s => s.group === 'modules').length;
  const howTo = sections[0].blocks.find(b => b.t === 'p');
  const demo = sections[0].blocks.find(b => b.t === 'note');

  return (
    <div className="ug-home">
      <section className="ug-hero">
        <img src={logo} alt="" className="ug-hero-logo" />
        <div>
          <span className="ug-eyebrow">KADAL Inventory · User SOP · Banglish</span>
          <h1 className="ug-hero-title">User Guideline</h1>
          <p className="ug-hero-sub">ব্যবহারকারী নির্দেশিকা: নতুন কর্মীদের জন্য Module-ভিত্তিক ধাপে ধাপে নির্দেশনা, Screenshot সহ</p>
          <div className="ug-stats">
            <span><b>{bn(moduleCount)}</b>টি Module</span>
            <span><b>{bn(imgCount)}</b>টি Screenshot</span>
            <span>KADAL/SOP/INV/01 · Rev 00</span>
          </div>
          <div className="ug-hero-actions">
            <button type="button" className="ug-btn-primary" onClick={() => onGo('part-3')}>
              শুরু করুন <ChevronRight size={17} aria-hidden="true" />
            </button>
            <button type="button" className="ug-btn-ghost" onClick={() => onGo('part-2')}>Flow Diagram দেখুন</button>
          </div>
        </div>
      </section>

      {howTo && <div className="ug-callout ug-callout-note"><Info size={18} aria-hidden="true" className="ug-callout-icon" /><div><Rich text={howTo.x} /></div></div>}
      {demo && <p className="ug-demo-line"><Rich text={demo.x} /></p>}

      {GROUPS.map(g => (
        <section key={g.id} className="ug-group">
          <h2 className="ug-group-title">{g.label}</h2>
          <div className={`ug-cards ${g.id === 'modules' ? 'ug-cards-modules' : ''}`}>
            {sections.filter(s => s.group === g.id).map(s => {
              const subs = subHeadings(s);
              return (
                <button type="button" key={s.id} className="ug-card" onClick={() => onGo(s.id)}>
                  <span className="ug-badge">{s.badge}</span>
                  <span className="ug-card-body">
                    <span className="ug-card-title">{s.label}</span>
                    {subs.length > 0 && (
                      <span className="ug-card-sub">{subs.map(x => x.text.replace(/^(M?\d+(\.\d+)?)\s+/, '')).join(' · ')}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function UserGuidePage({ onClose }) {
  const [active, setActive] = useState(() => {
    try { const v = localStorage.getItem(STORAGE_KEY); if (v && (v === 'home' || ORDER.includes(v))) return v; } catch { /* ignore */ }
    return 'home';
  });
  const [query, setQuery] = useState('');
  const [navOpen, setNavOpen] = useState(false);
  const [zoom, setZoom] = useState(null);
  const mainRef = useRef(null);
  const searchRef = useRef(null);
  const jumpToHit = useRef(false);

  const q = query.trim().toLowerCase();
  const searching = q.length >= 2;
  const hits = useMemo(() => {
    if (!searching) return null;
    const m = {};
    searchIndex.forEach(s => { const n = countHits(s.text, q); if (n) m[s.id] = n; });
    return m;
  }, [q, searching]);
  const totalHits = hits ? Object.values(hits).reduce((a, b) => a + b, 0) : 0;

  const go = useCallback((id) => {
    setActive(id);
    setNavOpen(false);
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
  }, []);

  // New section → back to top (or to the first search hit)
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    if (jumpToHit.current) {
      jumpToHit.current = false;
      requestAnimationFrame(() => {
        const m = el.querySelector('.ug-mark');
        if (m) { m.scrollIntoView({ block: 'center' }); return; }
        el.scrollTop = 0;
      });
    } else {
      el.scrollTop = 0;
    }
  }, [active]);

  // Keyboard: Esc closes zoom / clears search, ←/→ change section, "/" focuses search
  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (e.key === 'Escape') {
        if (zoom) setZoom(null);
        else if (navOpen) setNavOpen(false);
        else if (typing && query) setQuery('');
        return;
      }
      if (typing || zoom) return;
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); return; }
      const i = ORDER.indexOf(active);
      if (e.key === 'ArrowRight' && i < ORDER.length - 1) go(ORDER[i + 1]);
      if (e.key === 'ArrowLeft') go(i > 0 ? ORDER[i - 1] : 'home');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, zoom, navOpen, query, go]);

  const section = sections.find(s => s.id === active);

  const openFromNav = (id) => {
    if (searching && hits?.[id]) jumpToHit.current = true;
    go(id);
  };

  // Portal to <body> so the showcase page's own reset/styles never leak in
  return createPortal(
    <div className="user-guide" role="dialog" aria-label="KADAL User Guideline">
      {/* ── Top bar ── */}
      <header className="ug-topbar">
        <button type="button" className="ug-icon-btn ug-nav-toggle" onClick={() => setNavOpen(v => !v)} aria-label="সূচি (Contents)">
          <Menu size={19} />
        </button>
        <button type="button" className="ug-back" onClick={onClose} title="Home / Showcase-এ ফিরে যান">
          <ArrowLeft size={17} aria-hidden="true" /><span>Showcase</span>
        </button>
        <button type="button" className="ug-brand" onClick={() => go('home')}>
          <BookOpen size={18} aria-hidden="true" />
          <span className="ug-brand-text"><b>User Guideline</b><small>ব্যবহারকারী নির্দেশিকা</small></span>
        </button>
        <div className="ug-search">
          <Search size={16} aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="খুঁজুন… (যেমন: Challan, Stock IN, Backup)"
            aria-label="Guide-এ খুঁজুন"
          />
          {query && <button type="button" className="ug-search-clear" onClick={() => setQuery('')} aria-label="Clear"><X size={14} /></button>}
        </div>
        <ThemeToggle className="ug-theme" />
      </header>

      <div className="ug-layout">
        {/* ── Contents ── */}
        <aside className={`ug-sidebar ${navOpen ? 'is-open' : ''}`} aria-label="Contents">
          <button type="button" className={`ug-nav-item ug-nav-home ${active === 'home' ? 'is-active' : ''}`} onClick={() => go('home')}>
            <LayoutGrid size={16} aria-hidden="true" /><span>সূচিপত্র (সব অংশ)</span>
          </button>
          {searching && (
            <p className="ug-search-summary">
              {totalHits ? <>"{query.trim()}" পাওয়া গেছে <b>{bn(Object.keys(hits).length)}</b>টি অংশে</> : <>"{query.trim()}" কোথাও পাওয়া যায়নি</>}
            </p>
          )}
          {GROUPS.map(g => {
            const list = sections.filter(s => s.group === g.id && (!searching || hits[s.id]));
            if (!list.length) return null;
            return (
              <div key={g.id} className="ug-nav-group">
                <div className="ug-nav-group-label">{g.label}</div>
                {list.map(s => (
                  <button
                    type="button"
                    key={s.id}
                    className={`ug-nav-item ${active === s.id ? 'is-active' : ''}`}
                    onClick={() => openFromNav(s.id)}
                    aria-current={active === s.id ? 'page' : undefined}
                  >
                    <span className="ug-badge ug-badge-sm">{s.badge}</span>
                    <span className="ug-nav-label">{s.label}</span>
                    {searching && <span className="ug-hit-count">{hits[s.id]}</span>}
                  </button>
                ))}
              </div>
            );
          })}
        </aside>
        {navOpen && <div className="ug-scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />}

        {/* ── Content ── */}
        <main className="ug-main" ref={mainRef}>
          {section
            ? <SectionView key={section.id} section={section} q={searching ? q : ''} onZoom={setZoom} onGo={go} />
            : <HomeView onGo={go} />}
          <p className="ug-foot">KADAL Inventory · User SOP (Banglish) · KADAL/SOP/INV/01 · Rev 00 · IT Department, KA Design Accessories LTD</p>
        </main>
      </div>

      {/* ── Zoom ── */}
      {zoom && (
        <div className="ug-lightbox" onClick={() => setZoom(null)} role="dialog" aria-label="Screenshot zoom">
          <button type="button" className="ug-lightbox-close" onClick={() => setZoom(null)} aria-label="Close"><X size={22} /></button>
          <img src={zoom.src} alt={zoom.cap || ''} onClick={(e) => e.stopPropagation()} />
          {zoom.cap && <p>{zoom.cap}</p>}
        </div>
      )}
    </div>,
    document.body,
  );
}
