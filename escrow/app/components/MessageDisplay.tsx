import { useEffect } from 'react'

interface MessageDisplayProps {
  message: string
  type?: 'info' | 'success' | 'error' | 'warning'
  className?: string
  onDismiss?: () => void
}

export default function MessageDisplay({
  message,
  type = 'info',
  className = '',
  onDismiss
}: MessageDisplayProps) {
  useEffect(() => {
    // Auto-dismiss success messages after 10 seconds
    if (message && type === 'success' && onDismiss) {
      const timer = setTimeout(() => {
        onDismiss()
      }, 10000)
      return () => clearTimeout(timer)
    }
  }, [message, type, onDismiss])

  if (!message) return null

  const getStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-900 border-green-500 text-green-200'
      case 'error':
        return 'bg-red-900 border-red-500 text-red-200'
      case 'warning':
        return 'bg-yellow-900 border-yellow-500 text-yellow-200'
      default:
        return 'bg-blue-900 border-blue-500 text-blue-200'
    }
  }

  return (
    <div className={`border-l-4 p-4 rounded ${getStyles()} ${className} relative`}>
      <p className="text-sm text-white pr-8">{message}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 text-white hover:text-gray-300 text-xl leading-none"
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  )
}