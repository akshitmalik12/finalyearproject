import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';

const PROMPT_CATEGORIES = {
  analysis: {
    name: 'Analysis',
    icon: '📊',
    shape: 'rounded-lg', 
    size: 'px-7 py-4', 
    activeGradient: 'from-blue-500/90 to-cyan-500/90 dark:from-blue-500/30 dark:to-cyan-500/30', 
    prompts: [
      'Show me a summary of the dataset',
      'What are the correlations between columns?',
      'Find outliers in the data',
      'What insights can you find?',
      'Analyze data quality',
      'Show descriptive statistics',
    ],
  },
  visualization: {
    name: 'Visualization',
    icon: '📈',
    shape: 'rounded-3xl', 
    size: 'px-8 py-4', 
    activeGradient: 'from-purple-500/90 to-pink-500/90 dark:from-purple-500/30 dark:to-pink-500/30', 
    prompts: [
      'Create a visualization',
      'Plot a histogram',
      'Show a correlation heatmap',
      'Create a scatter plot',
      'Visualize distributions',
      'Create a box plot',
    ],
  },
  modeling: {
    name: 'Modeling',
    icon: '🤖',
    shape: 'rounded-none', 
    size: 'px-7 py-4', 
    activeGradient: 'from-green-500/90 to-emerald-500/90 dark:from-green-500/30 dark:to-emerald-500/30', 
    prompts: [
      'Build a predictive model',
      'Run a linear regression',
      'Create a classification model',
      'Perform clustering analysis',
      'Train a machine learning model',
      'Evaluate model performance',
    ],
  },
};

export default function PromptSuggestions({ dataset, onSelectPrompt }) {
  const [activeCategory, setActiveCategory] = useState('analysis');
  const [recentPrompts, setRecentPrompts] = useState([]);
  const [favoritePrompts, setFavoritePrompts] = useState([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    try {
      const savedRecent = localStorage.getItem('datagem_recent_prompts');
      const savedFavorites = localStorage.getItem('datagem_favorite_prompts');
      if (savedRecent) {
        setRecentPrompts(JSON.parse(savedRecent));
      }
      if (savedFavorites) {
        setFavoritePrompts(JSON.parse(savedFavorites));
      }
    } catch (error) {
      console.error('Error loading prompt history:', error);
    }
  }, []);

  const saveRecentPrompt = (prompt) => {
    const updated = [prompt, ...recentPrompts.filter(p => p !== prompt)].slice(0, 10);
    setRecentPrompts(updated);
    localStorage.setItem('datagem_recent_prompts', JSON.stringify(updated));
  };

  const toggleFavorite = (prompt, e) => {
    e.stopPropagation();
    const updated = favoritePrompts.includes(prompt)
      ? favoritePrompts.filter(p => p !== prompt)
      : [...favoritePrompts, prompt];
    setFavoritePrompts(updated);
    localStorage.setItem('datagem_favorite_prompts', JSON.stringify(updated));
  };

  const handlePromptClick = (prompt) => {
    saveRecentPrompt(prompt);
    onSelectPrompt(prompt);
  };

  const getContextualPrompts = () => {
    if (!dataset) return [];
    
    const contextual = [];
    const columns = dataset.columns || [];
    const numericColumns = dataset.numericColumns || [];
    
    if (numericColumns.length > 0) {
      contextual.push(`Analyze the relationship between ${numericColumns[0]} and ${numericColumns[1] || numericColumns[0]}`);
      contextual.push(`Create a histogram for ${numericColumns[0]}`);
    }
    
    if (columns.length > 0) {
      contextual.push(`What are the unique values in ${columns[0]}?`);
      contextual.push(`Show statistics for ${numericColumns[0] || columns[0]}`);
    }
    
    return contextual;
  };

  const displayPrompts = showFavorites 
    ? favoritePrompts 
    : activeCategory === 'contextual' 
      ? (dataset ? getContextualPrompts() : [])
      : PROMPT_CATEGORIES[activeCategory]?.prompts || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto mt-3"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-gray-600 dark:text-white/80 uppercase tracking-wider">
          💡 {showFavorites ? 'Favorite Prompts' : 'Suggested Prompts'}
        </p>
        <div className="flex items-center gap-2">
          {favoritePrompts.length > 0 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowFavorites(!showFavorites)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl backdrop-blur-xl transition-all duration-300 border ${
                showFavorites
                  ? 'bg-indigo-100 text-indigo-700 border-indigo-300 shadow-md dark:bg-white/20 dark:text-white dark:border-white/30'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white/80 dark:border-white/20 dark:hover:bg-white/15'
              }`}
            >
              ⭐ Favorites ({favoritePrompts.length})
            </motion.button>
          )}
        </div>
      </div>

      {!showFavorites && (
        <div className="flex flex-wrap gap-3 mb-4">
            <motion.button
            whileHover={dataset ? { scale: 1.08, y: -2 } : {}}
            whileTap={dataset ? { scale: 0.95 } : {}}
            onClick={() => dataset && setActiveCategory('contextual')}
            disabled={!dataset}
            className={`px-8 py-4 text-base font-bold rounded-full backdrop-blur-xl transition-all duration-300 border-2 ${
              !dataset
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed dark:bg-white/5 dark:text-white/40 dark:border-white/10'
                : activeCategory === 'contextual'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 dark:from-indigo-500/30 dark:to-purple-500/30 text-white border-transparent dark:border-white/40 shadow-lg scale-105'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 shadow-sm dark:bg-white/10 dark:text-white/80 dark:border-white/20 dark:hover:bg-white/15'
              }`}
            title={!dataset ? "Upload a dataset to enable contextual prompts" : "Contextual prompts based on your dataset"}
          >
            <span className="text-xl mr-2">🎯</span>
            Contextual
            {!dataset && <span className="ml-2 text-xs font-medium">(requires dataset)</span>}
            </motion.button>
          
          {Object.entries(PROMPT_CATEGORIES).map(([key, category]) => (
            <motion.button
              key={key}
              whileHover={{ scale: 1.08, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveCategory(key)}
              className={`${category.size} text-base font-bold ${category.shape} backdrop-blur-xl transition-all duration-300 border-2 ${
                activeCategory === key
                  ? `bg-gradient-to-r ${category.activeGradient} text-white border-transparent dark:border-white/40 shadow-lg scale-105`
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 shadow-sm dark:bg-white/10 dark:text-white/80 dark:border-white/20 dark:hover:bg-white/15'
              }`}
            >
              <span className="text-xl mr-2">{category.icon}</span>
              {category.name}
            </motion.button>
          ))}
        </div>
      )}

      {/* Prompts Grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeCategory + showFavorites}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="flex flex-wrap gap-2"
        >
          {activeCategory === 'contextual' && !dataset ? (
            <div className="w-full py-8 text-center">
              <p className="text-gray-500 dark:text-white/60 font-medium text-sm mb-2">
                📊 Upload a CSV dataset to see contextual prompts
              </p>
              <p className="text-gray-400 dark:text-white/40 text-xs">
                Contextual prompts are generated based on your dataset's columns and structure
              </p>
            </div>
          ) : displayPrompts.length > 0 ? (
            displayPrompts.map((prompt, idx) => (
              <motion.div
                key={prompt}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.03 }}
                whileHover={{ scale: 1.05, y: -2 }}
                className="group relative inline-block"
              >
                <button
                  onClick={() => handlePromptClick(prompt)}
                  className="px-4 py-2 text-xs font-bold backdrop-blur-xl bg-white text-gray-700 border border-gray-300 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 dark:bg-white/10 dark:text-white/90 dark:border-white/20 dark:hover:bg-white/15 dark:hover:border-white/30 rounded-xl transition-all duration-300 shadow-sm hover:shadow-md whitespace-nowrap cursor-pointer"
                >
                  {prompt}
                </button>
                <motion.button
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => toggleFavorite(prompt, e)}
                  className={`absolute -top-1 -right-1 p-1 rounded-full transition-colors border shadow-sm ${
                    favoritePrompts.includes(prompt)
                      ? 'bg-yellow-100 text-yellow-600 border-yellow-200 dark:bg-gray-800 dark:text-yellow-500 dark:border-gray-700'
                      : 'bg-white text-gray-400 border-gray-200 opacity-0 group-hover:opacity-100 dark:bg-gray-800 dark:border-gray-700'
                  }`}
                  title={favoritePrompts.includes(prompt) ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </motion.button>
              </motion.div>
            ))
          ) : (
            <p className="text-xs text-gray-500 dark:text-white/60 italic">
              {showFavorites ? 'No favorite prompts yet. Click the star icon on any prompt to add it to favorites.' : 'No prompts available.'}
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Recent Prompts */}
      {recentPrompts.length > 0 && !showFavorites && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 pt-4 border-t border-gray-200 dark:border-white/10"
        >
          <p className="text-xs font-bold text-gray-500 dark:text-white/80 mb-2 uppercase tracking-wider">
            🕒 Recent Prompts
          </p>
          <div className="flex flex-wrap gap-2">
            {recentPrompts.slice(0, 5).map((prompt, idx) => (
              <motion.button
                key={prompt + idx}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handlePromptClick(prompt)}
                className="px-3 py-1.5 text-xs font-medium backdrop-blur-xl bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white/80 rounded-xl transition-all duration-300 shadow-sm hover:shadow dark:border-white/20 dark:hover:bg-white/15 whitespace-nowrap"
              >
                {prompt}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}