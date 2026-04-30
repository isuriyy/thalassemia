import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider }         from './context/ThemeContext';
import Login     from './pages/Login';
import Home      from './pages/Home';
import Screen    from './pages/Screen';
import Batch     from './pages/Batch';
import History   from './pages/History';
import Analytics from './pages/Analytics';
import Status    from './pages/Status';
import Couple from './pages/Couple';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to="/home" replace /> : children;
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login"     element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/home"      element={<PrivateRoute><Home /></PrivateRoute>} />
            <Route path="/screen"    element={<PrivateRoute><Screen /></PrivateRoute>} />
            <Route path="/batch"     element={<PrivateRoute><Batch /></PrivateRoute>} />
            <Route path="/history"   element={<PrivateRoute><History /></PrivateRoute>} />
            <Route path="/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
            <Route path="/status"    element={<PrivateRoute><Status /></PrivateRoute>} />
            <Route path="/couple" element={<PrivateRoute><Couple /></PrivateRoute>} />
            {/* legacy redirect — old /dashboard bookmark still works */}
            <Route path="/dashboard" element={<Navigate to="/home" replace />} />
            <Route path="*"          element={<Navigate to="/login" replace />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
