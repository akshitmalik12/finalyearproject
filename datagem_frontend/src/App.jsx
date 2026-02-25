import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext'; // 1. Import AuthProvider
import ErrorBoundary from './components/ErrorBoundary';
import Chat from './components/Chat';
import About from './components/About';
import Login from './components/Login';
import Signup from './components/Signup';
import './App.css';

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        {/* 2. Wrap everything in AuthProvider */}
        <AuthProvider> 
          <Router
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <Routes>
              {/* Auth Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              
              {/* App Routes */}
              <Route path="/chat" element={<Chat />} />
              <Route path="/about" element={<About />} />
              
              {/* Default redirect to Login */}
              <Route path="/" element={<Navigate to="/login" replace />} />
            </Routes>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;