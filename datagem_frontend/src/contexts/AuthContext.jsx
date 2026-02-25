import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          const userData = await authAPI.getMe();
          setUser(userData);
          setToken(storedToken);
        } catch (error) {
          console.error('Session initialization failed:', error);
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const data = await authAPI.login(email, password);
      
      // Save session info
      localStorage.setItem('token', data.access_token);
      setToken(data.access_token);
      
      // Use user data from the response immediately
      if (data.user) {
        setUser(data.user);
      } else {
        // Fallback if backend didn't send user object
        const userData = await authAPI.getMe();
        setUser(userData);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'Login failed';
      
      if (error.response) {
        errorMessage = error.response.data?.detail || error.response.data?.message || `Server error: ${error.response.status}`;
      } else if (error.request) {
        errorMessage = 'Cannot connect to server. Please check your backend.';
      } else {
        errorMessage = error.message;
      }
      
      return { success: false, error: errorMessage };
    }
  };

  const signup = async (email, password, fullName) => {
    try {
      // Use return data from signup to log in automatically
      const data = await authAPI.signup(email, password, fullName);
      
      localStorage.setItem('token', data.access_token);
      setToken(data.access_token);
      
      if (data.user) {
        setUser(data.user);
      } else {
        const userData = await authAPI.getMe();
        setUser(userData);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Signup error:', error);
      let errorMessage = 'Signup failed';
      
      if (error.response) {
        errorMessage = error.response.data?.detail || error.response.data?.message || `Server error: ${error.response.status}`;
      } else if (error.request) {
        errorMessage = 'Cannot connect to server. Please check your backend.';
      } else {
        errorMessage = error.message;
      }
      
      return { success: false, error: errorMessage };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};