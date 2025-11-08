import { motion } from 'framer-motion';

export function MessageSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start mb-6"
    >
      <div className="max-w-3xl bg-white dark:bg-gray-800 rounded-2xl px-6 py-4 shadow-sm border border-gray-200 dark:border-gray-700 w-full">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-full" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-5/6" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-4/6" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function CodeBlockSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-900"
    >
      <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
      <div className="p-4 space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style={{ width: `${80 + Math.random() * 20}%` }} />
        ))}
      </div>
    </motion.div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="overflow-x-auto my-3">
      <table className="min-w-full border border-gray-300 dark:border-gray-600 text-sm">
        <thead className="bg-gray-100 dark:bg-gray-700">
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-4 py-2 border-b border-gray-300 dark:border-gray-600">
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-600 rounded animate-pulse mx-auto" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx}>
              {Array.from({ length: cols }).map((_, colIdx) => (
                <td key={colIdx} className="px-4 py-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProgressIndicator({ steps, currentStep }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {steps.map((step, index) => (
        <div key={step} className="flex items-center">
          <div className="flex flex-col items-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0.5 }}
              animate={{
                scale: index <= currentStep ? 1 : 0.8,
                opacity: index <= currentStep ? 1 : 0.5,
              }}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                index < currentStep
                  ? 'bg-green-500 text-white'
                  : index === currentStep
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}
            >
              {index < currentStep ? '✓' : index + 1}
            </motion.div>
            <span className={`text-xs mt-1 ${index <= currentStep ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-600'}`}>
              {step}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div className={`w-12 h-0.5 mx-2 ${index < currentStep ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

