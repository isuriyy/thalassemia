import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/api';

const AuthContext = createContext(null);
const SESSION_DURATION = 8 * 60 * 60 * 1000;
const WARN_BEFORE     = 5 * 60 * 1000;

export function AuthProvider({ children }) {
  const [user,        setUser]        = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));
  const [showTimeout, setShowTimeout] = useState(false);
  const [countdown,   setCountdown]   = useState(300);
  const warnTimer   = useRef(null);
  const logoutTimer = useRef(null);
  const countTimer  = useRef(null);

  const clearTimers = () => {
    clearTimeout(warnTimer.current);
    clearTimeout(logoutTimer.current);
    clearInterval(countTimer.current);
  };

  const logout = useCallback(() => {
    clearTimers();
    localStorage.clear();
    setUser(null);
    setShowTimeout(false);
  }, []);

  const startSessionTimers = useCallback(() => {
    clearTimers();
    warnTimer.current = setTimeout(() => {
      setShowTimeout(true);
      setCountdown(300);
      countTimer.current = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) { clearInterval(countTimer.current); logout(); return 0; }
          return c - 1;
        });
      }, 1000);
    }, SESSION_DURATION - WARN_BEFORE);
    logoutTimer.current = setTimeout(logout, SESSION_DURATION);
  }, [logout]);

  const continueSession = () => {
    setShowTimeout(false);
    clearTimers();
    startSessionTimers();
  };

  const login = async (email, password) => {
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user',  JSON.stringify(data.user));
      setUser(data.user);
      startSessionTimers();
      return data.user;
    } catch (err) {
      console.error('Login error:', err.response?.data || err.message || err);
      throw err;
    }
  };

  const register = async (name, email, password) => {
    try {
      const { data } = await api.post('/auth/register', { name, email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user',  JSON.stringify(data.user));
      setUser(data.user);
      startSessionTimers();
      return data.user;
    } catch (err) {
      console.error('Register error:', err.response?.data || err.message || err);
      throw err;
    }
  };

  useEffect(() => {
    if (user) startSessionTimers();
    return clearTimers;
  }, []);

  const fmt = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

  return (
    <AuthContext.Provider value={{ user, login, register, logout, continueSession }}>
      {children}
      {showTimeout && (
        <div style={ov}>
          <div style={modal}>
            <div style={mt}>Session expiring soon</div>
            <div style={ms}>Your session expires in <span style={{fontWeight:500,color:'#A32D2D'}}>{fmt(countdown)}</span>. Continue to stay signed in.</div>
            <div style={{display:'flex',gap:8}}>
              <button style={btnP} onClick={continueSession}>Continue session</button>
              <button style={btnS} onClick={logout}>Sign out</button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

const ov    = {position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999};
const modal = {background:'#fff',borderRadius:12,border:'0.5px solid #e5e5e5',padding:'24px 28px',width:300};
const mt    = {fontSize:14,fontWeight:500,marginBottom:6,color:'#1a1a1a'};
const ms    = {fontSize:13,color:'#666',marginBottom:16,lineHeight:1.5};
const btnP  = {flex:1,padding:'8px 0',background:'#1D9E75',color:'#fff',border:'none',borderRadius:8,fontSize:13,cursor:'pointer'};
const btnS  = {flex:1,padding:'8px 0',background:'transparent',border:'1px solid #ddd',borderRadius:8,fontSize:13,cursor:'pointer'};

export const useAuth = () => useContext(AuthContext);
