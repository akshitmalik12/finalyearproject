import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';
import { chatAPI } from '../services/api';
import { Link } from 'react-router-dom';
import Papa from 'papaparse';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import InteractiveChart from './InteractiveChart';
import CodeBlock from './CodeBlock';
import PromptSuggestions from './PromptSuggestions';
import { MessageSkeleton, CodeBlockSkeleton, ProgressIndicator } from './LoadingSkeleton';
import EnhancedTableViewer from './EnhancedTableViewer';
import { parseMarkdownTable } from '../utils/parseMarkdownTable';

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const [dataset, setDataset] = useState(null);
  const [datasetProfile, setDatasetProfile] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [expandedCodeBlocks, setExpandedCodeBlocks] = useState({});
  const [expandedOutputs, setExpandedOutputs] = useState({});
  const [executionStep, setExecutionStep] = useState(null);
  const messagesEndRef = useRef(null);
  const { theme, toggleTheme } = useTheme();
  
  const toggleCodeBlock = (messageIndex, codeIndex) => {
    const key = `${messageIndex}-${codeIndex}`;
    setExpandedCodeBlocks(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };
  
  const toggleOutput = (messageIndex) => {
    setExpandedOutputs(prev => ({
      ...prev,
      [messageIndex]: !prev[messageIndex]
    }));
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load persisted state from localStorage on mount
  useEffect(() => {
    try {
      const savedMessages = localStorage.getItem('datagem_messages');
      const savedDataset = localStorage.getItem('datagem_dataset');
      const savedDatasetProfile = localStorage.getItem('datagem_dataset_profile');
      const savedShowSidebar = localStorage.getItem('datagem_show_sidebar');

      if (savedMessages) {
        setMessages(JSON.parse(savedMessages));
      }
      if (savedDataset) {
        setDataset(JSON.parse(savedDataset));
      }
      if (savedDatasetProfile) {
        setDatasetProfile(JSON.parse(savedDatasetProfile));
      }
      if (savedShowSidebar === 'true') {
        setShowSidebar(true);
      }
    } catch (error) {
      console.error('Error loading persisted state:', error);
    }
  }, []);

  // Persist messages to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('datagem_messages', JSON.stringify(messages));
    } else {
      localStorage.removeItem('datagem_messages');
    }
  }, [messages]);

  // Persist dataset to localStorage
  useEffect(() => {
    if (dataset) {
      localStorage.setItem('datagem_dataset', JSON.stringify(dataset));
    } else {
      localStorage.removeItem('datagem_dataset');
    }
  }, [dataset]);

  // Persist dataset profile to localStorage
  useEffect(() => {
    if (datasetProfile) {
      localStorage.setItem('datagem_dataset_profile', JSON.stringify(datasetProfile));
    } else {
      localStorage.removeItem('datagem_dataset_profile');
    }
  }, [datasetProfile]);

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem('datagem_show_sidebar', showSidebar.toString());
  }, [showSidebar]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentResponse]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleDatasetUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      alert('Please upload a CSV file');
      return;
    }

    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const data = results.data.filter(row => {
          // Remove empty rows
          return Object.values(row).some(val => val !== '');
        });
        
        if (data.length === 0) {
          alert('CSV file appears to be empty');
          return;
        }

        // Create dataset profile
        const df = data;
        const columns = Object.keys(df[0]);
        const shape = { rows: df.length, cols: columns.length };
        
        // Calculate basic stats
        const numericColumns = columns.filter(col => {
          return df.some(row => {
            const val = row[col];
            return val !== '' && !isNaN(parseFloat(val)) && isFinite(val);
          });
        });

        // Calculate statistics for numeric columns
        const stats = {};
        numericColumns.forEach(col => {
          const values = df
            .map(row => parseFloat(row[col]))
            .filter(val => !isNaN(val) && isFinite(val));
          
          if (values.length > 0) {
            const sorted = [...values].sort((a, b) => a - b);
            stats[col] = {
              min: sorted[0],
              max: sorted[sorted.length - 1],
              mean: values.reduce((a, b) => a + b, 0) / values.length,
              median: sorted.length % 2 === 0
                ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
                : sorted[Math.floor(sorted.length / 2)],
              count: values.length,
            };
          }
        });

        const profile = {
          shape,
          columns,
          numericColumns,
          stats,
          head: df.slice(0, 5),
          sample: df.slice(0, 10),
        };

        setDataset(df);
        setDatasetProfile(profile);
        setShowSidebar(true);

        // Add welcome message about dataset
        setMessages([{
          role: 'assistant',
          content: `✅ Dataset loaded successfully!\n\nShape: ${shape.rows} rows × ${shape.cols} columns\nColumns: ${columns.join(', ')}\n\nYou can now ask me questions about your dataset!`,
        }]);
      },
      error: (error) => {
        alert(`Error parsing CSV: ${error.message}`);
      },
    });
  };

  const clearDataset = () => {
    setDataset(null);
    setDatasetProfile(null);
    setMessages([]);
    localStorage.removeItem('datagem_dataset');
    localStorage.removeItem('datagem_dataset_profile');
    localStorage.removeItem('datagem_messages');
  };

  const clearChat = () => {
    if (window.confirm('Are you sure you want to clear the chat history?')) {
      setMessages([]);
      setCurrentResponse('');
      localStorage.removeItem('datagem_messages');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  };

  // Parse response to extract images, code blocks, output, and text
  const parseResponse = (response) => {
    console.log('🔍 Parsing response, total length:', response.length);
    const images = [];
    const codeBlocks = [];
    const outputs = [];
    let text = response;
    
    // Extract PLOT_IMG_BASE64 images (can appear in code output or text)
    const imageRegex = /PLOT_IMG_BASE64:([A-Za-z0-9+/=]+)/g;
    let match;
    const imageMatches = [];
    while ((match = imageRegex.exec(response)) !== null) {
      const base64Data = match[1];
      images.push(`data:image/png;base64,${base64Data}`);
      imageMatches.push(match[0]);
    }
    
    // Remove base64 strings from text (they're displayed separately as images)
    imageMatches.forEach(imgMatch => {
      text = text.replace(imgMatch, '');
    });
    
    // Extract code blocks that were executed
    // Look for "Executing: run_python_code" followed by code blocks
    const executingRegex = /🤖 \*\*Executing:\*\* `([^`]+)`/g;
    const codeRegex = /```(?:python)?\n([\s\S]*?)```/g;
    const outputRegex = /\*\*Code Output:\*\*\n```\n([\s\S]*?)```/g;
    
    // Find all "Executing:" markers
    const executingMatches = [];
    let execMatch;
    const responseCopy = response; // Create a copy for regex
    while ((execMatch = executingRegex.exec(responseCopy)) !== null) {
      executingMatches.push({
        tool: execMatch[1],
        index: execMatch.index,
        fullMatch: execMatch[0],
      });
    }
    
    // Find all code blocks (including Python code and output)
    const codeMatches = [];
    let codeMatch;
    while ((codeMatch = codeRegex.exec(responseCopy)) !== null) {
      codeMatches.push({
        code: codeMatch[1].trim(),
        index: codeMatch.index,
        fullMatch: codeMatch[0],
        isPython: codeMatch[0].includes('```python'),
      });
    }
    
    // Extract code outputs
    let outputMatch;
    while ((outputMatch = outputRegex.exec(responseCopy)) !== null) {
      outputs.push(outputMatch[1].trim());
      // Remove from text
      text = text.replace(outputMatch[0], '');
    }
    
    // Match executing markers with their code blocks
    executingMatches.forEach(exec => {
      if (exec.tool === 'run_python_code') {
        // Find the first Python code block after this executing marker
        const followingCode = codeMatches.find(
          code => code.index > exec.index && 
                  code.index < exec.index + 2000 && 
                  code.isPython
        );
        if (followingCode) {
          codeBlocks.push({
            tool: exec.tool,
            code: followingCode.code,
          });
        }
      }
    });
    
    // Clean up text - remove code block markers but keep error messages and explanations
    // Only remove the executing markers, keep everything else including errors
    text = text.replace(/🤖 \*\*Executing:\*\* `[^`]+`/g, '');
    // Remove code blocks that are already extracted, but keep error messages
    // Only remove code blocks that were already extracted (matched with executing markers)
    const extractedCodeIndices = new Set();
    executingMatches.forEach(exec => {
      if (exec.tool === 'run_python_code') {
        const followingCode = codeMatches.find(
          code => code.index > exec.index && 
                  code.index < exec.index + 2000 && 
                  code.isPython
        );
        if (followingCode) {
          extractedCodeIndices.add(followingCode.index);
        }
      }
    });
    
    // Remove only the code blocks that were extracted, keep others (like markdown code blocks in explanations)
    codeMatches.forEach(codeMatch => {
      if (extractedCodeIndices.has(codeMatch.index)) {
        text = text.replace(codeMatch.fullMatch, '');
      }
    });
    
    // Remove code output markers (they're in separate outputs array)
    text = text.replace(/\*\*Code Output:\*\*\n```\n[\s\S]*?```/g, '');
    
    // Clean up multiple newlines but preserve structure
    text = text.replace(/\n{4,}/g, '\n\n\n'); // Max 3 consecutive newlines
    text = text.trim();
    
    // Debug: Log what's left after parsing
    console.log('📝 Text after parsing:', {
      length: text.length,
      preview: text.substring(0, 300),
      hasSummaryKeywords: /summary|dataset overview|columns|descriptive statistics/i.test(text),
    });
    
    // If text is empty or just whitespace after cleanup, but we have code/output, add a note
    if (!text || text.length < 10) {
      if (codeBlocks.length > 0 || outputs.length > 0 || images.length > 0) {
        // Text summary might be coming, or was removed - don't add placeholder here
        // The backend should handle providing a summary
        console.warn('⚠️ Text is empty after parsing but we have code/output/images');
      }
    }
    
    return { text, images, code: codeBlocks, outputs };
  };

  const exportChat = () => {
    const chatData = {
      timestamp: new Date().toISOString(),
      dataset: dataset ? {
        shape: datasetProfile?.shape,
        columns: datasetProfile?.columns,
      } : null,
      messages: messages,
    };
    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `datagem-chat-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() && !imageFile) return;

    const userMessage = {
      role: 'user',
      content: input,
      image: imagePreview,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setImageFile(null);
    setImagePreview(null);
    setLoading(true);
    setCurrentResponse('');
    setExecutionStep(0); // Start with "Analyzing"

    try {
      setExecutionStep(1); // "Executing"
      const reader = await chatAPI.streamChat(input, imageFile, dataset);
      if (!reader) {
        throw new Error('Failed to get response stream');
      }
      
      const decoder = new TextDecoder();
      const streamReader = reader.getReader();
      let accumulatedResponse = '';
      let lastChunkTime = Date.now();
      const TIMEOUT_MS = 120000; // 2 minute timeout

      // Create a timeout promise
      const createTimeout = () => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Stream timeout: No response received for 2 minutes. The request may have failed.'));
          }, TIMEOUT_MS);
        });
      };

      try {
        while (true) {
          // Race between reading and timeout
          const readPromise = streamReader.read();
          const timeoutPromise = createTimeout();
          
          let result;
          try {
            result = await Promise.race([readPromise, timeoutPromise]);
          } catch (timeoutError) {
            streamReader.cancel();
            throw timeoutError;
          }

          const { done, value } = result;
          if (done) {
            break;
          }

          if (value) {
            lastChunkTime = Date.now(); // Update last chunk time
            const chunk = decoder.decode(value, { stream: true });
            accumulatedResponse += chunk;
            setCurrentResponse(accumulatedResponse);
          }
        }
        
        // Final decode flush
        try {
          const remaining = decoder.decode(new Uint8Array(), { stream: false });
          if (remaining) {
            accumulatedResponse += remaining;
            setCurrentResponse(accumulatedResponse);
          }
        } catch (e) {
          // Ignore decode errors on final flush
        }
      } finally {
        streamReader.releaseLock();
      }

      // Parse response to extract images and code
      setExecutionStep(2); // "Summarizing"
      const parsedResponse = parseResponse(accumulatedResponse);
      
      // Debug: Log what we got
      console.log('📊 Parsed response:', {
        textLength: parsedResponse.text?.length || 0,
        textPreview: parsedResponse.text?.substring(0, 200) || '(empty)',
        hasCode: parsedResponse.code?.length > 0,
        hasOutputs: parsedResponse.outputs?.length > 0,
        hasImages: parsedResponse.images?.length > 0,
      });
      
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: parsedResponse.text,
          images: parsedResponse.images,
          code: parsedResponse.code,
          outputs: parsedResponse.outputs,
        },
      ]);
      setCurrentResponse('');
      setExecutionStep(null);
    } catch (error) {
      console.error('Chat error:', error);
      let errorMessage = 'Sorry, I encountered an error. Please try again.';
      
      if (error.message?.includes('Failed to fetch') || error.message?.includes('Failed to connect') || error.message?.includes('Cannot connect')) {
        errorMessage = '❌ Failed to connect to the backend. Please make sure:\n\n1. The backend is running on http://127.0.0.1:8000\n2. CORS is properly configured\n3. No firewall is blocking the connection\n\nYou can start the backend with: `cd datagem_backend && python main.py`';
      } else if (error.message?.includes('Failed to stream') || error.message?.includes('Failed to connect')) {
        errorMessage = '❌ Failed to connect to the chat service. Please make sure the backend is running on http://127.0.0.1:8000';
      } else if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        errorMessage = '❌ Server authentication error. Please try again.';
      } else if (error.message?.includes('Network Error') || error.message?.includes('ERR_NETWORK')) {
        errorMessage = '❌ Network error. Please check if the backend server is running and accessible.';
      } else if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
        errorMessage = '⏱️ Request timed out. The backend may be processing a large request. Please try:\n\n1. Check the backend console for errors\n2. Try a simpler question\n3. Wait a moment and try again';
      } else if (error.message?.includes('Server error')) {
        errorMessage = `❌ Server error: ${error.message}`;
      } else {
        errorMessage = `❌ Error: ${error.message || 'Unknown error occurred'}`;
      }
      
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: errorMessage,
        },
      ]);
    } finally {
      setLoading(false);
      setCurrentResponse('');
      setExecutionStep(null);
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 transition-colors">
      {/* Sidebar */}
      <AnimatePresence>
      {showSidebar && (
          <motion.div
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="w-80 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-r border-gray-200/50 dark:border-gray-700/50 overflow-y-auto transition-colors shadow-lg"
          >
          <div className="p-4">
            <h2 className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent mb-4">📂 Dataset</h2>
            
            {!dataset ? (
              <div className="space-y-4">
                <label className="block">
                  <span className="sr-only">Upload CSV</span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleDatasetUpload}
                    className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-900 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-800 cursor-pointer"
                  />
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Upload a CSV file to start analyzing your data.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900 dark:text-white">Dataset Loaded</h3>
                  <button
                    onClick={clearDataset}
                    className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                  >
                    Clear
                  </button>
                </div>
                
                    {datasetProfile && (
                      <>
                        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-750 rounded-xl p-4 space-y-2 border border-indigo-100 dark:border-gray-700 shadow-sm">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            <strong className="text-indigo-600 dark:text-indigo-400">Shape:</strong> {datasetProfile.shape.rows} rows × {datasetProfile.shape.cols} columns
                          </p>
                          {datasetProfile.numericColumns.length > 0 && (
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              <strong className="text-indigo-600 dark:text-indigo-400">Numeric Columns:</strong> {datasetProfile.numericColumns.length}
                            </p>
                          )}
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Columns</h4>
                          <div className="flex flex-wrap gap-2">
                            {datasetProfile.columns.map((col, idx) => (
                              <motion.span
                                key={idx}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: idx * 0.05 }}
                                whileHover={{ scale: 1.05 }}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg shadow-sm ${
                                  datasetProfile.numericColumns.includes(col)
                                    ? 'bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/50 dark:to-emerald-900/50 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                                    : 'bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                                }`}
                                title={datasetProfile.numericColumns.includes(col) ? 'Numeric column' : 'Text column'}
                              >
                                {col}
                              </motion.span>
                            ))}
                          </div>
                        </div>

                        {datasetProfile.numericColumns.length > 0 && datasetProfile.stats && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Statistics</h4>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {datasetProfile.numericColumns.slice(0, 3).map((col, idx) => {
                                const stat = datasetProfile.stats[col];
                                if (!stat) return null;
                                return (
                                  <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    className="bg-white dark:bg-gray-800 rounded-lg p-3 text-xs border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
                                  >
                                    <p className="font-semibold text-indigo-600 dark:text-indigo-400 mb-2">{col}</p>
                                    <div className="grid grid-cols-2 gap-2 text-gray-700 dark:text-gray-300">
                                      <div>
                                        <span className="text-gray-500 dark:text-gray-500">Min:</span> <span className="font-medium">{stat.min.toFixed(2)}</span>
                                    </div>
                                      <div>
                                        <span className="text-gray-500 dark:text-gray-500">Max:</span> <span className="font-medium">{stat.max.toFixed(2)}</span>
                                  </div>
                                      <div>
                                        <span className="text-gray-500 dark:text-gray-500">Mean:</span> <span className="font-medium">{stat.mean.toFixed(2)}</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-500 dark:text-gray-500">Median:</span> <span className="font-medium">{stat.median.toFixed(2)}</span>
                                      </div>
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Preview (First 5 rows)</h4>
                          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                            <table className="min-w-full text-xs">
                              <thead className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-750">
                                <tr>
                                  {datasetProfile.columns.slice(0, 5).map((col, idx) => (
                                    <th key={idx} className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                                      {col}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {datasetProfile.head.map((row, rowIdx) => (
                                  <tr key={rowIdx} className="hover:bg-indigo-50/30 dark:hover:bg-gray-700/50 transition-colors">
                                    {datasetProfile.columns.slice(0, 5).map((col, colIdx) => (
                                      <td key={colIdx} className="px-3 py-2 text-gray-700 dark:text-gray-300">
                                        {String(row[col] || '').slice(0, 20)}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    )}
              </div>
            )}
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex flex-col flex-1 overflow-hidden min-h-0">
        {/* Header */}
        <motion.header
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex-shrink-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-700/50 px-6 py-4 transition-colors shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">💎 DataGem</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">AI Analyst Platform</p>
              </div>
              <Link
                to="/about"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-500 dark:to-purple-500 rounded-lg hover:from-indigo-700 hover:to-purple-700 dark:hover:from-indigo-600 dark:hover:to-purple-600 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                About
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <motion.button
                whileHover={{ scale: 1.1, rotate: 15 }}
                whileTap={{ scale: 0.9 }}
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 hover:from-gray-200 hover:to-gray-300 dark:hover:from-gray-600 dark:hover:to-gray-700 transition-all shadow-sm"
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
              </motion.button>
              <AnimatePresence>
              {messages.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="flex gap-2"
                  >
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    onClick={exportChat}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                    title="Export chat history"
                  >
                    Export Chat
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    onClick={clearChat}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                    title="Clear chat history"
                  >
                    Clear Chat
                    </motion.button>
                  </motion.div>
              )}
              </AnimatePresence>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowSidebar(!showSidebar)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm hover:shadow"
              >
                {showSidebar ? 'Hide' : 'Show'} Dataset
              </motion.button>
            </div>
          </div>
        </motion.header>

        {/* Messages Area - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-8 transition-colors min-h-0" style={{ scrollBehavior: 'smooth' }}>
          <div className="max-w-4xl mx-auto space-y-6 pb-24">
            {copySuccess && (
              <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in">
                ✓ Copied to clipboard!
              </div>
            )}
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center py-12"
              >
                <div className="inline-block p-4 bg-indigo-100 dark:bg-indigo-900 rounded-full mb-4">
                  <svg
                    className="w-12 h-12 text-indigo-600 dark:text-indigo-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                  Welcome to DataGem AI Analyst
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {dataset 
                    ? 'Ask me anything about your dataset, or upload an image for analysis.'
                    : 'Upload a CSV dataset in the sidebar to get started, or ask me anything about your data.'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                  💡 Make sure the backend is running on http://127.0.0.1:8000
                </p>
                {!dataset && (
                  <div className="mt-4">
                    <label className="inline-block px-4 py-2 bg-indigo-600 dark:bg-indigo-700 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 cursor-pointer transition">
                      Upload CSV Dataset
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleDatasetUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
                {dataset && (
                  <div className="mt-6">
                    <PromptSuggestions
                      dataset={datasetProfile}
                      onSelectPrompt={(prompt) => setInput(prompt)}
                    />
                  </div>
                )}
              </motion.div>
            )}

            <AnimatePresence mode="popLayout">
            {messages.map((message, index) => (
                <motion.div
                key={index}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, x: message.role === 'user' ? 100 : -100 }}
                  transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 25,
                    delay: index * 0.05,
                  }}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} group`}
              >
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                  className={`max-w-3xl rounded-2xl px-6 py-4 relative ${
                    message.role === 'user'
                        ? 'bg-indigo-600 dark:bg-indigo-700 text-white shadow-lg'
                      : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      whileHover={{ opacity: 1, scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => copyToClipboard(message.content)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Copy message"
                    >
                      <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </motion.button>
                  )}
                  {message.image && (
                    <img
                      src={message.image}
                      alt="Uploaded"
                      className="mb-3 rounded-lg max-w-md"
                    />
                  )}
                  
                  {/* Display executed code blocks with enhanced features */}
                  {message.code && message.code.length > 0 && (
                    <div className="mb-4 space-y-3">
                      {message.code.map((codeBlock, idx) => {
                        const messageIndex = index;
                        const key = `${messageIndex}-code-${idx}`;
                        const isExpanded = expandedCodeBlocks[key] ?? false; // Default to collapsed to save space
                        return (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="rounded-xl overflow-hidden shadow-md max-h-[60vh] flex flex-col"
                          >
                            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden flex-shrink-0">
                              <motion.button
                                whileHover={{ backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.5)' : 'rgba(243, 244, 246, 0.8)' }}
                                onClick={() => {
                                  setExpandedCodeBlocks(prev => ({
                                    ...prev,
                                    [key]: !prev[key]
                                  }));
                                }}
                                className="w-full flex items-center justify-between p-3 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                                    🔧 Executing: {codeBlock.tool}
                                  </span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {codeBlock.code.split('\n').length} lines
                                  </span>
                                </div>
                                <motion.svg
                                  animate={{ rotate: isExpanded ? 180 : 0 }}
                                  className="w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </motion.svg>
                              </motion.button>
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                                    className="border-t border-gray-200 dark:border-gray-700 overflow-hidden max-h-[50vh] overflow-y-auto"
                                  >
                                    <CodeBlock
                                      code={codeBlock.code}
                                      language="python"
                                      tool={codeBlock.tool}
                                      onRunCode={() => {
                                        // Re-run code functionality can be added here
                                        console.log('Re-running code:', codeBlock.code);
                                      }}
                                    />
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Display code outputs in collapsible dropdowns */}
                  {message.outputs && message.outputs.length > 0 && (
                    <div className="mb-4 space-y-3">
                      {message.outputs.map((output, idx) => {
                        const messageIndex = index;
                        const key = `${messageIndex}-output-${idx}`;
                        const isExpanded = expandedOutputs[key] ?? false; // Default to collapsed to save space
                        // Try to parse as table
                        let tableData = null;
                        try {
                          tableData = parseMarkdownTable(output);
                        } catch (e) {
                          console.error('Error parsing table:', e);
                          tableData = null;
                        }
                        return (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="rounded-xl overflow-hidden shadow-md max-h-[60vh] flex flex-col"
                          >
                            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden flex-shrink-0">
                              <motion.button
                                whileHover={{ backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.5)' : 'rgba(243, 244, 246, 0.8)' }}
                                onClick={() => {
                                  setExpandedOutputs(prev => ({
                                    ...prev,
                                    [key]: !prev[key]
                                  }));
                                }}
                                className="w-full flex items-center justify-between p-3 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">
                                    📊 Code Output {idx + 1}
                                  </span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {output.split('\n').length} lines
                                  </span>
                                </div>
                                <motion.svg
                                  animate={{ rotate: isExpanded ? 180 : 0 }}
                                  className="w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </motion.svg>
                              </motion.button>
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                                    className="border-t border-gray-200 dark:border-gray-700 overflow-hidden max-h-[50vh] overflow-y-auto"
                                  >
                                    {tableData && tableData.rows && tableData.rows.length > 0 ? (
                                      <div className="p-4">
                                        <EnhancedTableViewer data={tableData.rows} />
                                      </div>
                                    ) : (
                                      <pre className="bg-gray-900 dark:bg-black text-gray-100 p-4 overflow-x-auto text-xs max-h-[50vh] overflow-y-auto whitespace-pre-wrap font-mono">
                                        {output}
                                      </pre>
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Display images from visualizations */}
                  {message.images && message.images.length > 0 && (
                    <div className="mb-4 space-y-3">
                      {message.images.map((imgSrc, idx) => (
                        <InteractiveChart
                          key={idx}
                          imageSrc={imgSrc}
                          data={null}
                          title={`Visualization ${idx + 1}`}
                        />
                      ))}
                    </div>
                  )}
                  
                  {/* Display text summary - always show if there's content or if we have code/output/images */}
                  {(message.content || (message.code && message.code.length > 0) || (message.outputs && message.outputs.length > 0) || (message.images && message.images.length > 0)) && (
                  <div className={`prose prose-sm max-w-none ${message.role === 'user' ? 'prose-invert' : 'dark:prose-invert'}`}>
                      {message.content && message.content.trim() ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                        em: ({ children }) => <em className="italic">{children}</em>,
                        code: ({ inline, children }) => 
                          inline ? (
                            <code className={`px-1.5 py-0.5 rounded text-sm font-mono ${
                              message.role === 'user' 
                                ? 'bg-indigo-500/30 text-indigo-100' 
                                : 'bg-gray-100 dark:bg-gray-700'
                            }`}>
                              {children}
                            </code>
                          ) : (
                            <code className={`block p-3 rounded-lg text-sm font-mono overflow-x-auto my-2 ${
                              message.role === 'user' 
                                ? 'bg-indigo-500/30 text-indigo-100' 
                                : 'bg-gray-100 dark:bg-gray-700'
                            }`}>
                              {children}
                            </code>
                          ),
                        pre: ({ children }) => (
                          <pre className={`p-3 rounded-lg overflow-x-auto my-2 ${
                            message.role === 'user' 
                              ? 'bg-indigo-500/30' 
                              : 'bg-gray-100 dark:bg-gray-700'
                          }`}>
                            {children}
                          </pre>
                        ),
                        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                        li: ({ children }) => <li className="ml-2">{children}</li>,
                        h1: ({ children }) => <h1 className="text-xl font-bold mb-2 mt-3 first:mt-0">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h3>,
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-indigo-500 pl-4 italic my-2">
                            {children}
                          </blockquote>
                        ),
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer" className={`hover:underline ${
                            message.role === 'user' 
                              ? 'text-indigo-200' 
                              : 'text-indigo-600 dark:text-indigo-400'
                          }`}>
                            {children}
                          </a>
                        ),
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-3">
                            <table className="min-w-full border border-gray-300 dark:border-gray-600 text-sm">
                              {children}
                            </table>
                          </div>
                        ),
                        thead: ({ children }) => (
                              <thead className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-750">
                            {children}
                          </thead>
                        ),
                        tbody: ({ children }) => (
                              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {children}
                          </tbody>
                        ),
                        tr: ({ children }) => (
                              <tr className="hover:bg-indigo-50/50 dark:hover:bg-gray-700/50 transition-colors">
                            {children}
                          </tr>
                        ),
                        th: ({ children }) => (
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                            {children}
                          </th>
                        ),
                        td: ({ children }) => (
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                            {children}
                          </td>
                        ),
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                      ) : (
                        // If we have code/output/images but no text content, show a placeholder
                        (message.code && message.code.length > 0) || (message.outputs && message.outputs.length > 0) || (message.images && message.images.length > 0) ? (
                          <div className="text-gray-500 dark:text-gray-400 italic space-y-2">
                            <p>Analysis completed. Review the code, output, and visualizations above.</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                              Note: A text summary should appear here. If it's missing, check the browser console for debugging information.
                            </p>
                  </div>
                        ) : null
                      )}
                </div>
                  )}
                </motion.div>
              </motion.div>
            ))}
            </AnimatePresence>

            {loading && currentResponse && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring' }}
                  className="max-w-3xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm border border-gray-200 dark:border-gray-700 rounded-2xl px-6 py-4"
                >
                  {/* Show images in streaming response */}
                  {(() => {
                    const imageRegex = /PLOT_IMG_BASE64:([A-Za-z0-9+/=]+)/g;
                    const images = [];
                    let match;
                    const responseCopy = currentResponse;
                    while ((match = imageRegex.exec(responseCopy)) !== null) {
                      images.push(`data:image/png;base64,${match[1]}`);
                    }
                    return images.length > 0 ? (
                      <div className="mb-4 space-y-3">
                        {images.map((imgSrc, idx) => (
                          <div key={idx} className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                            <img
                              src={imgSrc}
                              alt={`Visualization ${idx + 1}`}
                              className="w-full h-auto"
                            />
                          </div>
                        ))}
                      </div>
                    ) : null;
                  })()}
                  
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                        em: ({ children }) => <em className="italic">{children}</em>,
                        code: ({ inline, children }) => 
                          inline ? (
                            <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-sm font-mono">
                              {children}
                            </code>
                          ) : (
                            <code className="block bg-gray-100 dark:bg-gray-700 p-3 rounded-lg text-sm font-mono overflow-x-auto my-2">
                              {children}
                            </code>
                          ),
                        pre: ({ children }) => (
                          <pre className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg overflow-x-auto my-2">
                            {children}
                          </pre>
                        ),
                        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                        li: ({ children }) => <li className="ml-2">{children}</li>,
                        h1: ({ children }) => <h1 className="text-xl font-bold mb-2 mt-3 first:mt-0">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h3>,
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-indigo-500 pl-4 italic my-2">
                            {children}
                          </blockquote>
                        ),
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                            {children}
                          </a>
                        ),
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-3">
                            <table className="min-w-full border border-gray-300 dark:border-gray-600 text-sm">
                              {children}
                            </table>
                          </div>
                        ),
                        thead: ({ children }) => (
                          <thead className="bg-gray-100 dark:bg-gray-700">
                            {children}
                          </thead>
                        ),
                        tbody: ({ children }) => (
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                            {children}
                          </tbody>
                        ),
                        tr: ({ children }) => (
                          <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            {children}
                          </tr>
                        ),
                        th: ({ children }) => (
                          <th className="px-4 py-2 text-left font-semibold border-b border-gray-300 dark:border-gray-600">
                            {children}
                          </th>
                        ),
                        td: ({ children }) => (
                          <td className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                            {children}
                          </td>
                        ),
                      }}
                    >
                      {currentResponse}
                    </ReactMarkdown>
                  </div>
                  <motion.span
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="inline-block w-2 h-4 bg-indigo-600 dark:bg-indigo-400 ml-1"
                  />
                </motion.div>
              </motion.div>
            )}

            {loading && !currentResponse && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring' }}
                  className="max-w-3xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm text-gray-900 dark:text-gray-100 shadow-lg border border-gray-200/50 dark:border-gray-700/50 rounded-2xl px-6 py-4"
                >
                  {executionStep !== null && (
                    <div className="mb-4">
                      <ProgressIndicator
                        steps={['Analyzing', 'Executing', 'Summarizing']}
                        currentStep={executionStep}
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-2.5 h-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 rounded-full"
                        animate={{
                          y: [0, -8, 0],
                          opacity: [0.5, 1, 0.5],
                          scale: [1, 1.2, 1],
                        }}
                        transition={{
                          duration: 0.6,
                          repeat: Infinity,
                          delay: i * 0.2,
                          ease: 'easeInOut',
                        }}
                      />
                    ))}
                    <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">Thinking...</span>
                  </div>
                </motion.div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area - Fixed at Bottom */}
        <div className="flex-shrink-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200/50 dark:border-gray-700/50 shadow-2xl">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="px-6 py-4 transition-colors"
          >
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
            <AnimatePresence>
            {imagePreview && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="mb-4 relative inline-block"
                >
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-w-xs max-h-48 rounded-lg border border-gray-300 dark:border-gray-600"
                />
                  <motion.button
                  type="button"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  onClick={removeImage}
                  className="absolute top-2 right-2 bg-red-500 dark:bg-red-600 text-white rounded-full p-1 hover:bg-red-600 dark:hover:bg-red-700 transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </motion.button>
              </motion.div>
            )}
            </AnimatePresence>

            <div className="flex gap-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question or describe what you'd like to analyze..."
                  className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  disabled={loading}
                />
                <label className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    disabled={loading}
                  />
                  <svg
                    className="w-6 h-6 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </label>
              </div>
              <motion.button
                type="submit"
                disabled={loading || (!input.trim() && !imageFile)}
                whileHover={{ scale: loading || (!input.trim() && !imageFile) ? 1 : 1.05 }}
                whileTap={{ scale: loading || (!input.trim() && !imageFile) ? 1 : 0.95 }}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-500 dark:to-purple-500 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 dark:hover:from-indigo-600 dark:hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
              >
                {loading ? (
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  'Send'
                )}
              </motion.button>
            </div>
          </form>
          
          {/* Enhanced Prompt Suggestions */}
          {!loading && (
            <div className="px-6 pb-4">
              <PromptSuggestions
                dataset={datasetProfile}
                onSelectPrompt={(prompt) => setInput(prompt)}
              />
            </div>
          )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

