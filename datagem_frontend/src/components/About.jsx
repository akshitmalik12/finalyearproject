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

      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">About 💎 DataGem</h1>
        <div className="border-t border-gray-200 dark:border-gray-700 pt-8 mb-8"></div>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">What is DataGem?</h2>
          <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
            <strong>DataGem is your AI-Powered Data Analyst.</strong>
          </p>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            It's an intelligent data analysis and visualization chatbot designed to make complex data insights accessible to everyone. Powered by Google's cutting-edge <strong>Gemini 2.0 Flash</strong>, DataGem enables users to:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400 mb-4">
            <li><strong>Upload Datasets:</strong> Instantly load and profile CSV files.</li>
            <li><strong>Ask Natural Language Questions:</strong> No SQL or Python required. Just ask, "What are the sales trends?"</li>
            <li><strong>Generate Custom Code:</strong> DataGem writes and executes Python code for analysis.</li>
            <li><strong>Create Interactive Visualizations:</strong> Generate histograms, scatter plots, and more on the fly.</li>
            <li><strong>Build Predictive Models:</strong> Ask DataGem to "build a classification model" or "run a time-series forecast" using sklearn and tensorflow.</li>
          </ul>
          <p className="text-gray-600 dark:text-gray-400">
            DataGem is designed to be a powerful co-pilot for analysts, students, and anyone curious about their data.
          </p>
        </section>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-8 mb-8"></div>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">About the Creator: Akshit Malik</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Akshit developed DataGem with a vision to democratize data analytics, making powerful insights available without requiring deep technical coding knowledge. His goal was to build an intelligent assistant that not only answers questions but proactively helps users explore, visualize, and predict future trends from their data.
          </p>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            This project showcases Akshit's skills in:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400 mb-4">
            <li>Full-Stack AI Development</li>
            <li>Large Language Model (LLM) Integration with Gemini</li>
            <li>Machine Learning & Deep Learning (ML/CNN) Implementation</li>
            <li>Secure API & Backend Design</li>
            <li>Creating Intuitive User Experiences (UI/UX) for Complex Tools</li>
          </ul>
          <div className="mt-6">
            <p className="text-gray-600 dark:text-gray-400 mb-2"><strong>Connect with Akshit:</strong></p>
            <ul className="space-y-1 text-gray-600 dark:text-gray-400">
              <li>
                <strong>LinkedIn:</strong>{' '}
                <a
                  href="https://www.linkedin.com/in/akshit-malik-718b3a212/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 underline"
                >
                  https://www.linkedin.com/in/akshit-malik-718b3a212/
                </a>
              </li>
              <li>
                <strong>E-Mail:</strong>{' '}
                <a
                  href="mailto:aakshitmalik@gmail.com"
                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 underline"
                >
                  aakshitmalik@gmail.com
                </a>
              </li>
            </ul>
          </div>
        </section>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-8 mb-8"></div>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Technology Stack</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            <div className="text-center">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="text-2xl mb-2">⚡</div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">React</p>
              </div>
            </div>
            <div className="text-center">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="text-2xl mb-2">🤖</div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Gemini 2.0</p>
              </div>
            </div>
            <div className="text-center">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="text-2xl mb-2">🐍</div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Python</p>
              </div>
            </div>
            <div className="text-center">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="text-2xl mb-2">📊</div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Pandas</p>
              </div>
            </div>
            <div className="text-center">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="text-2xl mb-2">🧠</div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Scikit-learn</p>
              </div>
            </div>
            <div className="text-center">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="text-2xl mb-2">🔷</div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">TensorFlow</p>
              </div>
            </div>
          </div>
        </section>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-8 mb-8"></div>

        <section className="mb-12">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Privacy & Security Statement</h3>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              DataGem prioritizes your data security and privacy.
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
              <li>Your API key is stored securely and is never exposed to the frontend.</li>
              <li>Uploaded data is processed in an isolated environment for the duration of your session.</li>
              <li>Data is <strong>not</strong> shared, sold, or used for model training.</li>
              <li>This project is for demonstration purposes. Please do not upload highly sensitive production data.</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

