import { useState, useEffect } from 'react'

interface TimeDisplayProps {
  countdownTarget?: Date
  timestamp?: number
}

export default function TimeDisplay({ countdownTarget, timestamp }: TimeDisplayProps) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [countdown, setCountdown] = useState<string>('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [mounted])

  useEffect(() => {
    if (!countdownTarget || !mounted) return

    const countdownTimer = setInterval(() => {
      const now = new Date().getTime()
      const target = countdownTarget.getTime()
      const distance = target - now

      if (distance > 0) {
        const days = Math.floor(distance / (1000 * 60 * 60 * 24))
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((distance % (1000 * 60)) / 1000)

        setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`)
      } else {
        setCountdown('EXPIRED')
      }
    }, 1000)

    return () => clearInterval(countdownTimer)
  }, [countdownTarget, mounted])

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  if (!mounted) {
    return (
      <div className="text-center text-gray-300">
        {timestamp ? (
          <div className="text-sm font-mono text-white">
            {new Date(timestamp * 1000).toLocaleString()}
          </div>
        ) : (
          <>
            <div className="text-sm mb-1 text-gray-400">--:--:--</div>
            <div className="text-2xl font-mono font-bold text-white mb-2">--:--:--</div>
          </>
        )}
        {countdownTarget && (
          <div className="text-sm">
            <span className="text-gray-400">Countdown: </span>
            <span className="font-mono text-green-400">--:--:--</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="text-center text-gray-300">
      {timestamp ? (
        <div className="text-sm font-mono text-white">
          {new Date(timestamp * 1000).toLocaleString()}
        </div>
      ) : (
        <>
          <div className="text-sm mb-1 text-gray-400">{formatDate(currentTime)}</div>
          <div className="text-2xl font-mono font-bold text-white mb-2">{formatTime(currentTime)}</div>
        </>
      )}
      {countdownTarget && (
        <div className="text-sm">
          <span className="text-gray-400">Countdown: </span>
          <span className={`font-mono ${countdown === 'EXPIRED' ? 'text-red-400' : 'text-green-400'}`}>
            {countdown}
          </span>
        </div>
      )}
    </div>
  )
}