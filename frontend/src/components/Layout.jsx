import { NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Layout({ children }) {
  const { user, logout }  = useAuth();
  const { dark, toggle }  = useTheme();
  const nav               = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => { logout(); nav('/login'); };

  return (
    <div style={s.page}>
      <div style={s.modelBar}>
        <span style={s.dot}></span>
        <span style={s.modelText}>SVM model active</span>
        <span style={s.sep}></span>
        <span style={s.modelText}>
          AUC-ROC 0.829 · Recall 75.0% · Threshold 0.49 · 10 features
        </span>
      </div>

      <div style={s.topbar}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button
            style={s.menuBtn}
            onClick={() => setSidebarOpen(o => !o)}
            title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {sidebarOpen ? '✕' : '☰'}
          </button>
          <div style={s.logo}>ThalaPredict</div>
        </div>
        <div style={s.topRight}>
          <button style={s.themeBtn} onClick={toggle} title="Toggle dark mode">
            {dark ? '☀' : '☾'}
          </button>
          <span style={s.chipGreen}>Model active</span>
          <span style={s.chip}>{user?.name}</span>
          <button style={s.signOut} onClick={handleLogout}>Sign out</button>
        </div>
      </div>

      <div style={s.body}>
        <aside style={{
          ...s.sidebar,
          width:       sidebarOpen ? 180 : 0,
          minWidth:    sidebarOpen ? 180 : 0,
          padding:     sidebarOpen ? '12px 8px' : 0,
          overflow:    'hidden',
          borderRight: sidebarOpen ? '0.5px solid var(--border)' : 'none',
        }}>
          <div style={s.navSection}>Screening</div>
          <NavItem to="/dashboard" label="Dashboard"      />
          <NavItem to="/screen"    label="Patient Screening" />
          <NavItem to="/batch"     label="Batch upload"   />
          <div style={s.navSection}>Records</div>
          <NavItem to="/history"   label="History"        />
          <div style={s.sideFooter}>
            <div style={s.footerName}>{user?.name}</div>
            <div style={s.footerRole}>Clinician</div>
          </div>
        </aside>

        {sidebarOpen && window.innerWidth < 768 && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={s.overlay}
          />
        )}

        <main style={s.main}>
          {children}
        </main>
      </div>
    </div>
  );
}

function NavItem({ to, label }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        display:'block', padding:'7px 10px', borderRadius:8,
        fontSize:13, marginBottom:2, textDecoration:'none',
        transition:'background 0.15s', whiteSpace:'nowrap',
        color:      isActive ? 'var(--brand-dark)' : 'var(--text-secondary)',
        background: isActive ? 'var(--brand-light)' : 'transparent',
        fontWeight: isActive ? 500 : 400,
      })}
    >
      {label}
    </NavLink>
  );
}

const s = {
  page:       { minHeight:'100vh', display:'flex', flexDirection:'column', fontFamily:'system-ui,sans-serif', background:'var(--bg-page)' },
  modelBar:   { background:'var(--brand-light)', borderBottom:'0.5px solid var(--brand-border)', padding:'6px 16px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' },
  dot:        { width:7, height:7, borderRadius:'50%', background:'var(--brand)', display:'inline-block', flexShrink:0 },
  modelText:  { fontSize:11, color:'var(--brand-dark)' },
  sep:        { width:1, height:12, background:'var(--brand-border)', display:'inline-block', flexShrink:0 },
  topbar:     { background:'var(--bg-card)', borderBottom:'0.5px solid var(--border)', padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 },
  logo:       { fontSize:14, fontWeight:500, color:'var(--brand-dark)' },
  topRight:   { display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' },
  chip:       { fontSize:11, color:'var(--text-secondary)', background:'var(--bg-surface)', border:'0.5px solid var(--border)', borderRadius:20, padding:'3px 10px' },
  chipGreen:  { fontSize:11, color:'var(--brand-dark)', background:'var(--brand-light)', border:'0.5px solid var(--brand-border)', borderRadius:20, padding:'3px 10px' },
  signOut:    { fontSize:11, color:'var(--text-secondary)', background:'transparent', border:'0.5px solid var(--border)', borderRadius:20, padding:'3px 10px', cursor:'pointer' },
  themeBtn:   { fontSize:16, background:'transparent', border:'0.5px solid var(--border)', borderRadius:20, padding:'3px 10px', cursor:'pointer', color:'var(--text-secondary)', lineHeight:1 },
  menuBtn:    { fontSize:16, background:'transparent', border:'0.5px solid var(--border)', borderRadius:8, cursor:'pointer', color:'var(--text-secondary)', padding:'4px 8px', lineHeight:1, minWidth:32 },
  body:       { display:'flex', flex:1, position:'relative' },
  sidebar:    { background:'var(--bg-card)', display:'flex', flexDirection:'column', transition:'width 0.2s, min-width 0.2s, padding 0.2s', flexShrink:0 },
  navSection: { fontSize:10, color:'var(--text-hint)', textTransform:'uppercase', letterSpacing:'0.06em', padding:'0 8px', margin:'12px 0 4px' },
  sideFooter: { marginTop:'auto', padding:'10px 8px', borderTop:'0.5px solid var(--border)' },
  footerName: { fontSize:12, fontWeight:500, color:'var(--text-primary)' },
  footerRole: { fontSize:11, color:'var(--text-hint)', marginTop:2 },
  main:       { flex:1, padding:20, overflowY:'auto', minWidth:0 },
  overlay:    { position:'fixed', inset:0, background:'rgba(0,0,0,0.3)', zIndex:99 },
};
