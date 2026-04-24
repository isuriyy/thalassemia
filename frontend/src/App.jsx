import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Login     from './pages/Login';
import Dashboard from './pages/Dashboard';
import Screen    from './pages/Screen';
import Batch     from './pages/Batch';
import History   from './pages/History';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login"     element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/screen"    element={<PrivateRoute><Screen /></PrivateRoute>} />
            <Route path="/batch"     element={<PrivateRoute><Batch /></PrivateRoute>} />
            <Route path="/history"   element={<PrivateRoute><History /></PrivateRoute>} />
            <Route path="*"          element={<Navigate to="/login" replace />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
