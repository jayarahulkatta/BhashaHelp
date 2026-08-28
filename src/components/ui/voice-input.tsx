"use client"

import React from "react"
import { Mic, Square } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { cn } from "@/lib/utils"

interface VoiceInputProps {
  onStart?: () => void
  onStop?: () => void
  isRecording?: boolean
}

export function VoiceInput({
  className,
  onStart,
  onStop,
  isRecording = false
}: React.ComponentProps<"div"> & VoiceInputProps) {
  const [_time, _setTime] = React.useState<number>(0)

  React.useEffect(() => {
    let intervalId: NodeJS.Timeout

    if (isRecording) {
      intervalId = setInterval(() => {
        _setTime((t) => t + 1)
      }, 1000)
    } else {
      _setTime(0)
    }

    return () => clearInterval(intervalId)
  }, [isRecording])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const onClickHandler = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isRecording) {
      onStop?.()
    } else {
      onStart?.()
    }
  }

  return (
    <div className={cn("flex flex-col items-center justify-center shrink-0", className)}>
      <motion.button
        type="button"
        className={cn(
          "flex items-center justify-center border-none cursor-pointer outline-none transition-shadow",
          isRecording 
            ? "bg-red-500 text-white rounded-[24px] shadow-lg shadow-red-500/40 pl-3 pr-4 py-2 min-h-[56px]"
            : "bg-gradient-to-br from-[#FF9933] to-[#E68A2E] text-white w-14 h-14 rounded-2xl shadow-md hover:shadow-lg hover:shadow-orange-500/25 active:scale-95"
        )}
        layout
        transition={{
          layout: {
            duration: 0.3,
            ease: "easeOut"
          },
        }}
        onClick={onClickHandler}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
      >
        <motion.div layout className="flex items-center justify-center">
          {isRecording ? (
             <div className="w-10 h-10 flex items-center justify-center">
               <Square className="w-5 h-5 fill-white" />
             </div>
          ) : (
             <Mic className="w-6 h-6" />
          )}
        </motion.div>
        
        <AnimatePresence mode="wait">
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, width: 0, marginLeft: 0 }}
              animate={{ opacity: 1, width: "auto", marginLeft: 4 }}
              exit={{ opacity: 0, width: 0, marginLeft: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden flex gap-3 items-center justify-center whitespace-nowrap"
            >
              {/* Frequency Animation */}
              <div className="flex gap-[3px] items-center justify-center h-6">
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1 bg-white rounded-full opacity-90"
                    initial={{ height: 4 }}
                    animate={{
                      height: isRecording
                        ? [4, 8 + Math.random() * 12, 6 + Math.random() * 8, 4]
                        : 4,
                    }}
                    transition={{
                      duration: 0.6 + (Math.random() * 0.4),
                      repeat: Number.POSITIVE_INFINITY,
                      delay: i * 0.05,
                      ease: "easeInOut",
                    }}
                  />
                ))}
              </div>
              {/* Timer */}
              <div className="text-sm font-bold w-10 text-center tracking-wider">
                {formatTime(_time)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  )
}
