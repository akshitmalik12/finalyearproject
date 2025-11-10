import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

export default function About() {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 transition-colors">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">💎 DataGem</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">AI Analyst Platform</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <Link
              to="/chat"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all duration-200 hover:scale-105"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Chat
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            💎 DataGem
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
            AI-Powered Data Analyst Platform
          </p>
          <div className="w-24 h-1 bg-indigo-600 dark:bg-indigo-400 mx-auto rounded-full"></div>
        </div>

        {/* Main Content */}
        <div className="space-y-12">
          {/* What is DataGem */}
          <section className="text-center">
            <h2 className="text-3xl font-semibold text-gray-900 dark:text-white mb-6">
              What is DataGem?
            </h2>
            <p className="text-lg text-gray-700 dark:text-gray-300 mb-6 max-w-3xl mx-auto leading-relaxed">
              <strong className="text-indigo-600 dark:text-indigo-400">DataGem</strong> is an intelligent data analysis and visualization platform powered by Google's <strong>Gemini 2.0 Flash</strong>. 
              It makes complex data insights accessible to everyone through natural language conversations.
            </p>
            <div className="grid md:grid-cols-2 gap-6 mt-8 max-w-2xl mx-auto">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="text-3xl mb-3">📊</div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Data Analysis</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Upload datasets and ask questions in plain English. No SQL or Python required.
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="text-3xl mb-3">📈</div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Visualizations</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Generate interactive charts, plots, and graphs automatically from your data.
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="text-3xl mb-3">🤖</div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">AI-Powered</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Built with cutting-edge AI to understand context and provide intelligent insights.
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="text-3xl mb-3">🔮</div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Predictive Models</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Build machine learning models for classification, regression, and forecasting.
                </p>
              </div>
            </div>
          </section>

          {/* Technology Stack */}
          <section className="text-center">
            <h2 className="text-3xl font-semibold text-gray-900 dark:text-white mb-8">
              Technology Stack
            </h2>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-6 max-w-3xl mx-auto">
              {[
                { icon: '⚡', name: 'React' },
                { icon: '🤖', name: 'Gemini 2.0' },
                { icon: '🐍', name: 'Python' },
                { icon: '📊', name: 'Pandas' },
                { icon: '🧠', name: 'Scikit-learn' },
                { icon: '🔷', name: 'TensorFlow' }
              ].map((tech, idx) => (
                <div key={idx} className="text-center">
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
                    <div className="text-3xl mb-2">{tech.icon}</div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{tech.name}</p>
              </div>
            </div>
              ))}
          </div>
        </section>

          {/* Creator */}
          <section className="text-center">
            <h2 className="text-3xl font-semibold text-gray-900 dark:text-white mb-6">
              About the Creator
            </h2>
            <p className="text-lg text-gray-700 dark:text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed">
              Developed by <strong className="text-indigo-600 dark:text-indigo-400">Akshit Malik</strong> with a vision to democratize data analytics, 
              making powerful insights available without requiring deep technical knowledge.
            </p>
            <div className="flex justify-center gap-6 mt-8">
              <a
                href="https://www.linkedin.com/in/akshit-malik-718b3a212/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                LinkedIn
              </a>
              <a
                href="mailto:aakshitmalik@gmail.com"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email
              </a>
            </div>
          </section>

          {/* Privacy */}
          <section className="text-center">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8 max-w-2xl mx-auto">
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                Privacy & Security
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Your data security and privacy are our top priorities.
            </p>
              <ul className="text-left text-gray-600 dark:text-gray-400 space-y-2 max-w-md mx-auto">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
                  <span>API keys stored securely and never exposed</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
                  <span>Data processed in isolated environments</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
                  <span>No data sharing, selling, or model training</span>
                </li>
            </ul>
          </div>
        </section>
        </div>
      </div>
    </div>
  );
}
