import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth(); // Matches your AuthContext function name
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) return setError('Passwords do not match');

    setLoading(true);
    const result = await signup(email, password, name);
    setLoading(false);

    if (result.success) {
      navigate('/chat');
    } else {
      setError(result.error || 'Failed to create account');
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white dark:bg-gray-950 transition-colors font-sans">
      {/* LEFT SIDE - Hero Section (Same as Login for consistency) */}
      <div className="hidden md:flex md:w-1/2 relative overflow-hidden bg-gradient-to-br from-indigo-700 via-purple-700 to-pink-700 p-12 flex-col justify-between">
        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 20, repeat: Infinity }} className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-500 rounded-full blur-3xl opacity-50" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <span className="text-4xl">💎</span>
            <h1 className="text-3xl font-black text-white">DataGem</h1>
          </div>
          <h2 className="text-5xl font-black text-white leading-tight mb-6">Start finding <br/><span className="text-pink-200">hidden insights</span> today.</h2>
          <p className="text-lg text-indigo-100 font-medium">Join DataGem to analyze datasets and chat with your data instantly.</p>
        </div>
        <div className="relative z-10 text-indigo-200 text-sm">Built by Akshit Malik</div>
      </div>

      {/* RIGHT SIDE - Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 dark:bg-gray-950">
        <button onClick={toggleTheme} className="absolute top-6 right-6 p-2 rounded-xl bg-gray-100 dark:bg-gray-800">{theme === 'dark' ? '☀️' : '🌙'}</button>
        <div className="max-w-md w-full">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Create an account</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">Let's get you set up with your AI analyst.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} required className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 rounded-xl outline-none focus:border-indigo-500 dark:text-white" />
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 rounded-xl outline-none focus:border-indigo-500 dark:text-white" />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 rounded-xl outline-none focus:border-indigo-500 dark:text-white" />
            <input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 rounded-xl outline-none focus:border-indigo-500 dark:text-white" />
            
            {error && <div className="text-red-600 text-sm">⚠️ {error}</div>}

            <motion.button type="submit" disabled={loading} className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold">
              {loading ? 'Creating account...' : 'Sign Up'}
            </motion.button>
          </form>
          <p className="mt-8 text-center dark:text-gray-400">Already have an account? <Link to="/login" className="text-indigo-600 font-bold">Log in here</Link></p>
        </div>
      </div>
    </div>
  );
}