import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';
import { chatAPI } from '../services/api';
import { Link } from 'react-router-dom';
import Papa from 'papaparse';
import { API_BASE_URL } from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import InteractiveChart from './InteractiveChart';
import CodeBlock from './CodeBlock';
import PromptSuggestions from './PromptSuggestions';
import { MessageSkeleton, CodeBlockSkeleton, ProgressIndicator } from './LoadingSkeleton';
import EnhancedTableViewer from './EnhancedTableViewer';
import ChatHistory from './ChatHistory';
import { parseMarkdownTable } from '../utils/parseMarkdownTable';
import { formatColumnName, getColumnAbbreviation } from '../utils/formatColumnName';
import { 
  generateDatasetId, 
  getChatSession, 
  saveChatSession, 
  getCurrentDatasetId,
  setCurrentDatasetId 
} from '../utils/chatHistory';

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
  const [backendStatus, setBackendStatus] = useState({ status: 'unknown', activeKeyIndex: null, totalKeys: null, lastQuotaError: null });
  const [copySuccess, setCopySuccess] = useState(false);
  const [expandedCodeBlocks, setExpandedCodeBlocks] = useState({});
  const [expandedOutputs, setExpandedOutputs] = useState({});
  const [executionStep, setExecutionStep] = useState(null);
  const [currentDatasetId, setCurrentDatasetIdState] = useState(null);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [datasetFilename, setDatasetFilename] = useState(null);
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
      // Try to load current dataset ID
      const savedDatasetId = getCurrentDatasetId();
      if (savedDatasetId) {
        // Load chat session for this dataset
        const session = getChatSession(savedDatasetId);
        if (session) {
          setCurrentDatasetIdState(savedDatasetId);
          setDataset(session.dataset);
          setDatasetProfile(session.datasetProfile);
          setMessages(session.messages || []);
          setDatasetFilename(session.filename || null);
          if (session.showSidebar !== undefined) {
            setShowSidebar(session.showSidebar);
          }
          return;
        }
      }

      // Fallback to old localStorage format for backward compatibility
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

  // Persist chat session when dataset, messages, or profile changes
  useEffect(() => {
    if (currentDatasetId && dataset && datasetProfile) {
      saveChatSession(currentDatasetId, {
        dataset,
        datasetProfile,
        messages,
        filename: datasetFilename,
        name: datasetFilename || `Dataset ${currentDatasetId.slice(-8)}`,
        shape: datasetProfile.shape,
        showSidebar,
      });
    }
  }, [currentDatasetId, dataset, datasetProfile, messages, datasetFilename, showSidebar]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentResponse]);

  // Periodically check backend /health endpoint to drive status pill
  useEffect(() => {
    let cancelled = false;

    const checkBackend = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/health`);
        if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setBackendStatus({
          status: 'online',
          activeKeyIndex: data.active_key_index,
          totalKeys: data.total_keys,
          lastQuotaError: data.last_quota_error || null,
        });
      } catch (err) {
        if (cancelled) return;
        console.error('Backend health check failed:', err);
        setBackendStatus((prev) => ({
          ...prev,
          status: 'offline',
        }));
      }
    };

    checkBackend();
    const intervalId = setInterval(checkBackend, 30000); // every 30s

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

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

        // Generate unique dataset ID
        const datasetId = generateDatasetId(df, file.name);
        setCurrentDatasetIdState(datasetId);
        setCurrentDatasetId(datasetId);
        setDatasetFilename(file.name);

        // Check if this dataset already has a chat session
        const existingSession = getChatSession(datasetId);
        if (existingSession) {
          // Load existing session
          setDataset(existingSession.dataset);
          setDatasetProfile(existingSession.datasetProfile);
          setMessages(existingSession.messages || []);
          setShowSidebar(existingSession.showSidebar !== undefined ? existingSession.showSidebar : true);
        } else {
          // New dataset - start fresh
          setDataset(df);
          setDatasetProfile(profile);
          setShowSidebar(true);
          const isLarge = shape.rows > 50000;
          const samplingNotice = isLarge
            ? '\n\n🔍 Note: This dataset is quite large. For performance and stability, some analyses may be run on a representative sample of the rows. Summary statistics and visualizations will still reflect the overall patterns.'
            : '';
          setMessages([{
            role: 'assistant',
            content: `✅ Dataset "${file.name}" loaded successfully!\n\nShape: ${shape.rows} rows × ${shape.cols} columns\nColumns: ${columns.join(', ')}${samplingNotice}\n\nYou can now ask me questions about your dataset!`,
          }]);
        }
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
    setCurrentDatasetIdState(null);
    setCurrentDatasetId(null);
    setDatasetFilename(null);
    // Keep old localStorage cleanup for backward compatibility
    localStorage.removeItem('datagem_dataset');
    localStorage.removeItem('datagem_dataset_profile');
    localStorage.removeItem('datagem_messages');
  };

  const handleSelectChat = (datasetId) => {
    if (!datasetId) {
      // Clear current chat
      clearDataset();
      return;
    }

    const session = getChatSession(datasetId);
    if (session) {
      setCurrentDatasetIdState(datasetId);
      setCurrentDatasetId(datasetId);
      setDataset(session.dataset);
      setDatasetProfile(session.datasetProfile);
      setMessages(session.messages || []);
      setDatasetFilename(session.filename || null);
      setShowSidebar(session.showSidebar !== undefined ? session.showSidebar : true);
    }
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
      // Wait a moment to show "Analyzing" step
      await new Promise(resolve => setTimeout(resolve, 500));
      setExecutionStep(1); // "Executing"
      
      const streamStartTime = Date.now();
      const MIN_EXECUTING_TIME = 600; // Minimum time to show "Executing" step (600ms)
      
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

      // Ensure "Executing" step is visible for minimum time
      const executingElapsed = Date.now() - streamStartTime;
      if (executingElapsed < MIN_EXECUTING_TIME) {
        await new Promise(resolve => setTimeout(resolve, MIN_EXECUTING_TIME - executingElapsed));
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
      
      // Wait a moment to show "Summarizing" step before hiding the progress indicator
      await new Promise(resolve => setTimeout(resolve, 800));
      
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
        errorMessage = '❌ Failed to connect to the backend. Please make sure:\n\n1. The backend is running on the same host as this page (port 8000)\n   - e.g., if you opened the app at http://192.168.x.x:5188, the backend should be at http://192.168.x.x:8000\n2. CORS is properly configured\n3. No firewall is blocking the connection\n\nYou can start the backend with: `cd datagem_backend && ./start_server.sh`';
      } else if (error.message?.includes('Failed to stream') || error.message?.includes('Failed to connect')) {
        errorMessage = '❌ Failed to connect to the chat service. Please make sure the backend is running on the same host (port 8000).';
      } else if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        errorMessage = '❌ Server authentication error. Please try again.';
      } else if (error.message?.includes('Network Error') || error.message?.includes('ERR_NETWORK')) {
        errorMessage = '❌ Network error. Please check if the backend server is running and accessible from this device.';
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
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 transition-colors relative overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-100/20 via-purple-100/20 to-pink-100/20 dark:from-indigo-900/10 dark:via-purple-900/10 dark:to-pink-900/10 animate-gradient-shift bg-[length:200%_200%] pointer-events-none" />

      {/* Top status bar */}
      <div className="absolute top-3 right-4 z-20 flex items-center gap-3">
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${
            backendStatus.status === 'online'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-500/60 dark:text-emerald-100'
              : backendStatus.status === 'offline'
              ? 'bg-rose-50 border-rose-300 text-rose-800 dark:bg-rose-900/30 dark:border-rose-500/60 dark:text-rose-100'
              : 'bg-gray-50 border-gray-300 text-gray-700 dark:bg-gray-800/60 dark:border-gray-600 dark:text-gray-200'
          }`}
          title={
            backendStatus.status === 'online'
              ? backendStatus.lastQuotaError
                ? `Backend online. Last quota warning: ${backendStatus.lastQuotaError}`
                : 'Backend online.'
              : backendStatus.status === 'offline'
              ? 'Backend appears offline or unreachable from this browser.'
              : 'Checking backend status...'
          }
        >
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              backendStatus.status === 'online'
                ? 'bg-emerald-500'
                : backendStatus.status === 'offline'
                ? 'bg-rose-500'
                : 'bg-amber-400'
            }`}
          />
          <span>
          {backendStatus.status === 'online'
              ? `Backend online (key ${backendStatus.activeKeyIndex}/${backendStatus.totalKeys || '?'})`
              : backendStatus.status === 'offline'
              ? 'Backend offline'
              : 'Checking backend...'}
          </span>
        </div>
      </div>
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
                          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2.5 uppercase tracking-wide">
                            Columns ({datasetProfile.columns.length})
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {datasetProfile.columns.map((col, idx) => {
                              const isNumeric = datasetProfile.numericColumns.includes(col);
                              const formattedName = formatColumnName(col);
                              // Show abbreviated version if formatted name is too long (>18 chars)
                              const displayName = formattedName.length > 18 
                                ? formattedName.substring(0, 15) + '...' 
                                : formattedName;
                              
                              return (
                                <motion.span
                                  key={idx}
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: idx * 0.03 }}
                                  whileHover={{ scale: 1.08, zIndex: 10 }}
                                  className={`group relative px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-default ${
                                    isNumeric
                                      ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-300/70 dark:border-green-700/70 hover:bg-green-100 dark:hover:bg-green-900/50 hover:border-green-400 dark:hover:border-green-600 hover:shadow-md'
                                      : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200 border border-indigo-300/70 dark:border-indigo-700/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-md'
                                  }`}
                                  title={`${formattedName}${isNumeric ? ' (Numeric)' : ' (Text)'}`}
                                >
                                  <span className="flex items-center gap-1.5">
                                    <span className={`text-[9px] ${isNumeric ? 'text-green-600 dark:text-green-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                      {isNumeric ? '🔢' : '📝'}
                                    </span>
                                    <span className="truncate max-w-[120px]">{displayName}</span>
                                  </span>
                                  {/* Full name tooltip on hover - only show if truncated */}
                                  {formattedName.length > 18 && (
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2.5 py-1.5 text-xs font-medium text-white bg-gray-900 dark:bg-gray-800 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 border border-gray-700 dark:border-gray-600">
                                      {formattedName}
                                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                                        <div className="border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                                      </div>
                                    </div>
                                  )}
                                </motion.span>
                              );
                            })}
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
      <div className="relative flex flex-col flex-1 overflow-hidden min-h-0 z-10">
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
              <div
                className="flex items-center gap-2 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80 text-xs font-medium"
                title={
                  backendStatus.status === 'online'
                    ? `Backend online (Gemini key ${backendStatus.activeKeyIndex}/${backendStatus.totalKeys}${
                        backendStatus.lastQuotaError ? ' – last quota error was a quota/rate-limit issue' : ''
                      })`
                    : 'Backend offline or unreachable from this browser. Check that the backend server/container is running and accessible.'
                }
              >
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    backendStatus.status === 'online'
                      ? 'bg-emerald-500'
                      : backendStatus.status === 'offline'
                      ? 'bg-red-500'
                      : 'bg-yellow-400'
                  }`}
                />
                <span className="text-gray-700 dark:text-gray-300">
                  {backendStatus.status === 'online'
                    ? 'Backend: Online'
                    : backendStatus.status === 'offline'
                    ? 'Backend: Offline'
                    : 'Backend: Checking...'}
                </span>
              </div>
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
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    onClick={() => setShowChatHistory(true)}
                    className="px-4 py-2 text-sm font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800 transition flex items-center gap-2"
                    title="View chat history"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Chat History
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
                    whileHover={{ scale: 1.01 }}
                    className={`max-w-3xl rounded-xl px-6 py-5 relative ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 dark:from-indigo-700 dark:to-indigo-800 text-white shadow-lg'
                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow'
                    }`}
                  >
                  {message.role === 'assistant' && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      whileHover={{ opacity: 1, scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => copyToClipboard(message.content)}
                      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 shadow-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
                      title="Copy message"
                    >
                      <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                            className="rounded-lg overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700 max-h-[60vh] flex flex-col bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900"
                          >
                            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-b border-gray-200 dark:border-gray-700 overflow-hidden flex-shrink-0">
                              <motion.button
                                whileHover={{ backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.3)' : 'rgba(243, 244, 246, 0.6)' }}
                                onClick={() => {
                                  setExpandedCodeBlocks(prev => ({
                                    ...prev,
                                    [key]: !prev[key]
                                  }));
                                }}
                                className="w-full flex items-center justify-between px-4 py-3 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                  <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                                    Executing: <span className="text-indigo-600 dark:text-indigo-400">{codeBlock.tool}</span>
                                  </span>
                                  <span className="text-xs px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 font-medium">
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
                            className="rounded-lg overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700 max-h-[60vh] flex flex-col bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20"
                          >
                            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-b border-gray-200 dark:border-gray-700 overflow-hidden flex-shrink-0">
                              <motion.button
                                whileHover={{ backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.3)' : 'rgba(243, 244, 246, 0.6)' }}
                                onClick={() => {
                                  setExpandedOutputs(prev => ({
                                    ...prev,
                                    [key]: !prev[key]
                                  }));
                                }}
                                className="w-full flex items-center justify-between px-4 py-3 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                  <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                                    Code Output <span className="text-blue-600 dark:text-blue-400">{idx + 1}</span>
                                  </span>
                                  <span className="text-xs px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 font-medium">
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
                  
                  {/* Display images from visualizations - Enhanced */}
                  {message.images && message.images.length > 0 && (
                    <div className="mb-4 space-y-4">
                      {message.images.map((imgSrc, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.1 }}
                          className="rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-shadow bg-white dark:bg-gray-800"
                        >
                          <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">📊</span>
                              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                Visualization {idx + 1}
                              </span>
                            </div>
                          </div>
                          <InteractiveChart
                            imageSrc={imgSrc}
                            data={null}
                            title={`Visualization ${idx + 1}`}
                          />
                        </motion.div>
                      ))}
                    </div>
                  )}
                  
                  {/* Display text summary - Enhanced UI */}
                  {(message.content || (message.code && message.code.length > 0) || (message.outputs && message.outputs.length > 0) || (message.images && message.images.length > 0)) && (
                  <div className={`prose prose-sm max-w-none ${message.role === 'user' ? 'prose-invert' : 'dark:prose-invert'} ${message.role === 'assistant' ? 'response-enhanced' : ''}`}>
{message.content && message.content.trim() ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-3 last:mb-0 text-gray-700 dark:text-gray-300 leading-relaxed">{children}</p>,
                        strong: ({ children }) => <strong className="font-bold text-gray-900 dark:text-gray-100">{children}</strong>,
                        em: ({ children }) => <em className="italic text-gray-600 dark:text-gray-400">{children}</em>,
                        code: ({ inline, children }) => 
                          inline ? (
                            <code className={`px-2 py-1 rounded-md text-sm font-mono ${
                              message.role === 'user' 
                                ? 'bg-indigo-500/30 text-indigo-100' 
                                : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
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
                        ul: ({ children }) => <ul className="list-disc list-outside mb-4 ml-4 space-y-2 text-gray-700 dark:text-gray-300">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-outside mb-4 ml-4 space-y-2 text-gray-700 dark:text-gray-300">{children}</ol>,
                        li: ({ children }) => <li className="pl-2">{children}</li>,
                        h1: ({ children }) => <h1 className="text-2xl font-bold mb-3 mt-4 first:mt-0 text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-xl font-bold mb-3 mt-4 first:mt-0 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                          <span className="w-1 h-6 bg-indigo-500 rounded-full"></span>
                          {children}
                        </h2>,
                        h3: ({ children }) => <h3 className="text-lg font-semibold mb-2 mt-3 first:mt-0 text-gray-800 dark:text-gray-200">{children}</h3>,
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-indigo-500 dark:border-indigo-400 pl-4 py-2 my-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-r-lg italic text-gray-700 dark:text-gray-300">
                            {children}
                          </blockquote>
                        ),
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer" className={`hover:underline font-medium ${
                            message.role === 'user' 
                              ? 'text-indigo-200' 
                              : 'text-indigo-600 dark:text-indigo-400'
                          }`}>
                            {children}
                          </a>
                        ),
                        hr: () => <hr className="my-4 border-gray-200 dark:border-gray-700" />,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                      ) : (
                        // If we have code/output/images but no text content, show a minimal completion message
                        (message.code && message.code.length > 0) || (message.outputs && message.outputs.length > 0) || (message.images && message.images.length > 0) ? (
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mt-2">
                            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-sm font-medium">Analysis completed</span>
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
                  
                  <div className="prose prose-sm dark:prose-invert max-w-none response-enhanced">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-3 last:mb-0 text-gray-700 dark:text-gray-300 leading-relaxed">{children}</p>,
                        strong: ({ children }) => <strong className="font-bold text-gray-900 dark:text-gray-100">{children}</strong>,
                        em: ({ children }) => <em className="italic text-gray-600 dark:text-gray-400">{children}</em>,
                        code: ({ inline, children }) => 
                          inline ? (
                            <code className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-1 rounded-md text-sm font-mono">
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
                        ul: ({ children }) => <ul className="list-disc list-outside mb-4 ml-4 space-y-2 text-gray-700 dark:text-gray-300">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-outside mb-4 ml-4 space-y-2 text-gray-700 dark:text-gray-300">{children}</ol>,
                        li: ({ children }) => <li className="pl-2">{children}</li>,
                        h1: ({ children }) => <h1 className="text-2xl font-bold mb-3 mt-4 first:mt-0 text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-xl font-bold mb-3 mt-4 first:mt-0 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                          <span className="w-1 h-6 bg-indigo-500 rounded-full"></span>
                          {children}
                        </h2>,
                        h3: ({ children }) => <h3 className="text-lg font-semibold mb-2 mt-3 first:mt-0 text-gray-800 dark:text-gray-200">{children}</h3>,
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-indigo-500 dark:border-indigo-400 pl-4 py-2 my-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-r-lg italic text-gray-700 dark:text-gray-300">
                            {children}
                          </blockquote>
                        ),
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                              {children}
                            </table>
                          </div>
                        ),
                        thead: ({ children }) => (
                          <thead className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30">
                            {children}
                          </thead>
                        ),
                        tbody: ({ children }) => (
                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {children}
                          </tbody>
                        ),
                        tr: ({ children }) => (
                          <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            {children}
                          </tr>
                        ),
                        th: ({ children }) => (
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                            {children}
                          </th>
                        ),
                        td: ({ children }) => (
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                            {children}
                          </td>
                        ),
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                            {children}
                          </a>
                        ),
                        hr: () => <hr className="my-4 border-gray-200 dark:border-gray-700" />,
                      }}
                    >
                      {currentResponse}
                    </ReactMarkdown>
                  </div>
                  <motion.span
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="inline-block w-2 h-4 bg-indigo-600 dark:bg-indigo-400 ml-2 rounded"
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
                  className="max-w-3xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm border border-gray-200 dark:border-gray-700 rounded-2xl px-6 py-4"
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

      {/* Chat History Sidebar */}
      <ChatHistory
        isOpen={showChatHistory}
        onClose={() => setShowChatHistory(false)}
        onSelectChat={handleSelectChat}
        currentDatasetId={currentDatasetId}
        currentDatasetName={datasetFilename || (datasetProfile ? `${datasetProfile.shape.rows} rows × ${datasetProfile.shape.cols} columns` : null)}
      />
    </div>
  );
}

