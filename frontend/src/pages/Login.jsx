import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, register } = useAuth();
  const nav = useNavigate();
  const [mode,    setMode]    = useState('login');
  const [form,    setForm]    = useState({ name:'', email:'', password:'' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        if (!form.name) {
          setError('Full name is required');
          setLoading(false);
          return;
        }
        await register(form.name, form.email, form.password);
      }
      nav('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message
               || err.message
               || 'Request failed — check backend is running';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.mark}></div>
        <div style={s.title}>β-Thalassemia screening</div>
        <div style={s.sub}>
          {mode === 'login' ? 'Sign in to your clinician account' : 'Create a clinician account'}
        </div>
        {error && <div style={s.err}>{error}</div>}
        <form onSubmit={submit}>
          {mode === 'register' && (
            <Field label="Full name" type="text" value={form.name}
              onChange={v => set('name', v)} required />
          )}
          <Field label="Email address" type="email" value={form.email}
            onChange={v => set('email', v)} required />
          <Field label="Password" type="password" value={form.password}
            onChange={v => set('password', v)} required />
          <button style={s.btn} disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <div style={s.toggle}>
          {mode === 'login' ? (
            <>No account? <span style={s.link} onClick={() => { setMode('register'); setError(''); }}>Register</span></>
          ) : (
            <>Already have an account? <span style={s.link} onClick={() => { setMode('login'); setError(''); }}>Sign in</span></>
          )}
        </div>
        <div style={s.notice}>
          Patient data is handled securely and used solely for screening purposes
        </div>
      </div>
    </div>
  );
}

function Field({ label, type, value, onChange, required }) {
  return (
    <div style={{ marginBottom:12 }}>
      <label style={{ fontSize:12, color:'#666', display:'block', marginBottom:4 }}>{label}</label>
      <input style={inp} type={type} value={value} required={required}
        onChange={e => onChange(e.target.value)} />
    </div>
  );
}

const inp = {
  width:'100%', padding:'8px 10px', border:'1px solid #ddd',
  borderRadius:8, fontSize:13, boxSizing:'border-box', outline:'none'
};

const s = {
  wrap:   { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f5f3', fontFamily:'system-ui,sans-serif' },
  card:   { background:'#fff', border:'0.5px solid #e5e5e5', borderRadius:12, padding:'28px 32px', width:320 },
  mark:   { width:36, height:36, background:'#1D9E75', borderRadius:8, marginBottom:14 },
  title:  { fontSize:16, fontWeight:500, marginBottom:4, color:'#1a1a1a' },
  sub:    { fontSize:13, color:'#888', marginBottom:18 },
  err:    { background:'#fef2f2', color:'#b91c1c', border:'1px solid #fecaca', borderRadius:8, padding:'8px 12px', fontSize:12, marginBottom:12 },
  btn:    { width:'100%', padding:10, background:'#1D9E75', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', marginTop:4 },
  toggle: { textAlign:'center', marginTop:12, fontSize:12, color:'#888' },
  link:   { color:'#0F6E56', cursor:'pointer' },
  notice: { fontSize:11, color:'#aaa', textAlign:'center', marginTop:12, lineHeight:1.5, borderTop:'0.5px solid #f0f0f0', paddingTop:10 },
};
