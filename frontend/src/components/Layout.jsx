import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect }               from 'react';
import { useAuth }                           from '../context/AuthContext';
import { useTheme }                          from '../context/ThemeContext';

// ── Inline SVG icons ──────────────────────────────────────────────────────────
const Icons = {
  home: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  screen: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  batch: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  history: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="12 8 12 12 14 14"/><path d="M3.05 11a9 9 0 1 0 .5-4.5"/><polyline points="3 3 3 9 9 9"/></svg>,
  analytics: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  status: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  menu: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  close: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  sun: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  moon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  couple: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
};

// ── Navigation structure ───────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    section: 'Workspace',
    hint:    'Daily tasks',
    items: [
      { to:'/home',   label:'Home',          icon:'home',    desc:'Overview & quick start' },
      { to:'/screen', label:'New Screening', icon:'screen',  desc:'Screen a single patient' },
      { to:'/batch',  label:'Batch Upload',  icon:'batch',   desc:'Upload multiple patients' },
      { to:'/couple', label:'Couple Screening', icon:'couple', desc:'Screen two partners together' },
    ],
  },
  {
    section: 'Records',
    hint:    'Patient data',
    items: [
      { to:'/history', label:'History', icon:'history', desc:'All past screenings' },
    ],
  },
  {
    section: 'Analytics',
    hint:    'Trends',
    items: [
      { to:'/analytics', label:'Overview', icon:'analytics', desc:'Charts & statistics' },
    ],
  },
];

const SYSTEM_ITEMS = [
  { to:'/status', label:'System Status', icon:'status', desc:'Service health check' },
];

// Page title lookup for breadcrumb
const ALL_ITEMS = [
  ...NAV_GROUPS.flatMap(g => g.items),
  ...SYSTEM_ITEMS,
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const nav              = useNavigate();
  const location         = useLocation();
  const [open, setOpen]  = useState(true);

  useEffect(() => {
    const onResize = () => setOpen(window.innerWidth >= 768);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const pageTitle = ALL_ITEMS.find(i => location.pathname === i.to)?.label || '';
  const handleLogout = () => { logout(); nav('/login'); };

  return (
    <div style={s.page}>

      {/* Model status bar */}
      <div style={s.modelBar}>
        <span style={s.dot} />
        <span style={s.modelText}>SVM model active</span>
        <span style={s.sep} />
        <span style={s.modelText}>
          AUC-ROC 0.829 · Recall 75.0% · Threshold 0.49 · 10 features
        </span>
      </div>

      {/* Top bar */}
      <div style={s.topbar}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button style={s.iconBtn} onClick={() => setOpen(o => !o)}>
            {open ? Icons.close : Icons.menu}
          </button>
          <span style={s.logo}>ThalaPredict</span>
          {pageTitle && <>
            <span style={s.breadSep}>/</span>
            <span style={s.breadPage}>{pageTitle}</span>
          </>}
        </div>
        <div style={s.topRight}>
          <button style={s.iconBtn} onClick={toggle} title="Toggle theme">
            {dark ? Icons.sun : Icons.moon}
          </button>
          <span style={s.chipGreen}>Model active</span>
          <span style={s.chip}>{user?.name}</span>
          <button style={s.signOut} onClick={handleLogout}>Sign out</button>
        </div>
      </div>

      {/* Body */}
      <div style={s.body}>

        {/* Sidebar */}
        <aside style={{
          ...s.sidebar,
          width:       open ? 204 : 0,
          minWidth:    open ? 204 : 0,
          padding:     open ? '14px 10px' : 0,
          borderRight: open ? '0.5px solid var(--border)' : 'none',
          overflow:    'hidden',
        }}>

          {/* Main nav groups */}
          {NAV_GROUPS.map(group => (
            <div key={group.section} style={{ marginBottom:4 }}>
              <div style={s.sectionLabel}>
                <span>{group.section}</span>
                <span style={s.sectionHint}>{group.hint}</span>
              </div>
              {group.items.map(item => (
                <NavItem key={item.to} {...item} icon={Icons[item.icon]} />
              ))}
            </div>
          ))}

          {/* System divider + section */}
          <div style={s.systemDivider} />
          <div style={s.sectionLabel}>
            <span>System</span>
            <span style={s.sectionHint}>Technical</span>
          </div>
          {SYSTEM_ITEMS.map(item => (
            <NavItem key={item.to} {...item} icon={Icons[item.icon]} muted />
          ))}

          {/* User footer */}
          <div style={s.sideFooter}>
            <div style={s.avatar}>
              {user?.name?.charAt(0)?.toUpperCase() || 'D'}
            </div>
            <div>
              <div style={s.footerName}>{user?.name}</div>
              <div style={s.footerRole}>Clinician</div>
            </div>
          </div>

        </aside>

        {/* Mobile overlay */}
        {open && window.innerWidth < 768 && (
          <div style={s.overlay} onClick={() => setOpen(false)} />
        )}

        {/* Main content */}
        <main style={s.main}>{children}</main>

      </div>
    </div>
  );
}

// ── NavItem ───────────────────────────────────────────────────────────────────
function NavItem({ to, label, icon, desc, muted }) {
  return (
    <NavLink
      to={to}
      title={desc}
      style={({ isActive }) => ({
        display:        'flex',
        alignItems:     'center',
        gap:            9,
        padding:        '8px 10px',
        borderRadius:   8,
        fontSize:       13,
        marginBottom:   2,
        textDecoration: 'none',
        whiteSpace:     'nowrap',
        transition:     'background 0.15s',
        color:          isActive ? 'var(--brand-dark)'
                      : muted    ? 'var(--text-hint)'
                      :            'var(--text-secondary)',
        background:     isActive ? 'var(--brand-light)' : 'transparent',
        fontWeight:     isActive ? 500 : 400,
      })}
    >
      {({ isActive }) => (
        <>
          <span style={{ display:'flex', alignItems:'center', opacity: isActive ? 1 : 0.55, flexShrink:0 }}>
            {icon}
          </span>
          {label}
        </>
      )}
    </NavLink>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  page:         { minHeight:'100vh', display:'flex', flexDirection:'column', background:'var(--bg-page)' },
  modelBar:     { background:'var(--brand-light)', borderBottom:'0.5px solid var(--brand-border)', padding:'5px 16px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' },
  dot:          { width:6, height:6, borderRadius:'50%', background:'var(--brand)', display:'inline-block', flexShrink:0 },
  modelText:    { fontSize:10.5, color:'var(--brand-dark)' },
  sep:          { width:1, height:10, background:'var(--brand-border)', display:'inline-block', flexShrink:0 },
  topbar:       { background:'var(--bg-card)', borderBottom:'0.5px solid var(--border)', padding:'9px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap' },
  logo:         { fontSize:14, fontWeight:600, color:'var(--brand-dark)', letterSpacing:'-0.01em' },
  breadSep:     { fontSize:13, color:'var(--text-hint)', margin:'0 2px' },
  breadPage:    { fontSize:13, color:'var(--text-secondary)' },
  topRight:     { display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' },
  chip:         { fontSize:11, color:'var(--text-secondary)', background:'var(--bg-surface)', border:'0.5px solid var(--border)', borderRadius:20, padding:'3px 10px' },
  chipGreen:    { fontSize:11, color:'var(--brand-dark)', background:'var(--brand-light)', border:'0.5px solid var(--brand-border)', borderRadius:20, padding:'3px 10px' },
  signOut:      { fontSize:11, color:'var(--text-secondary)', background:'transparent', border:'0.5px solid var(--border)', borderRadius:20, padding:'3px 10px', cursor:'pointer' },
  iconBtn:      { display:'flex', alignItems:'center', justifyContent:'center', padding:'5px 8px', background:'transparent', border:'0.5px solid var(--border)', borderRadius:8, cursor:'pointer', color:'var(--text-secondary)' },
  body:         { display:'flex', flex:1, position:'relative' },
  sidebar:      { background:'var(--bg-card)', display:'flex', flexDirection:'column', transition:'width 0.2s, min-width 0.2s, padding 0.2s', flexShrink:0 },
  sectionLabel: { display:'flex', justifyContent:'space-between', alignItems:'baseline', fontSize:10, fontWeight:600, color:'var(--text-hint)', textTransform:'uppercase', letterSpacing:'0.07em', padding:'0 8px', margin:'12px 0 5px' },
  sectionHint:  { fontSize:9, color:'var(--text-hint)', textTransform:'none', letterSpacing:0, fontWeight:400, opacity:0.75 },
  systemDivider:{ height:'0.5px', background:'var(--border)', margin:'12px 0 0' },
  sideFooter:   { marginTop:'auto', paddingTop:12, borderTop:'0.5px solid var(--border)', display:'flex', alignItems:'center', gap:9 },
  avatar:       { width:28, height:28, borderRadius:'50%', background:'var(--brand)', color:'#fff', fontSize:12, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  footerName:   { fontSize:12, fontWeight:500, color:'var(--text-primary)' },
  footerRole:   { fontSize:10, color:'var(--text-hint)', marginTop:1 },
  main:         { flex:1, padding:20, overflowY:'auto', minWidth:0 },
  overlay:      { position:'fixed', inset:0, background:'rgba(0,0,0,0.3)', zIndex:99 },
};
