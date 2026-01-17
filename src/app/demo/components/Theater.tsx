"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Timer, Zap, Wand2, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";

interface TheaterProps {
    isLoading: boolean;
    onComplete: () => void;
    hasData: boolean;
}

export default function Theater({ isLoading, hasData }: TheaterProps) {
    const [stage, setStage] = useState(0);
    const [messages] = useState([
        "Processando imagem...",
        "Analisando ofertas...",
        "Lendo preços...",
        "Formatando dados..."
    ]);

    // Cycle messages during loading
    useEffect(() => {
        if (!isLoading) {
            setStage(0);
            return;
        }
        const interval = setInterval(() => {
            setStage((prev) => (prev + 1) % messages.length);
        }, 2000);
        return () => clearInterval(interval);
    }, [isLoading, messages.length]);

    return (
        <div className="flex flex-col items-center justify-center p-4">
            {/* Time Comparison - Always visible but changes state */}
            <div className="flex items-center gap-4 mb-6 bg-white/50 backdrop-blur-sm p-4 rounded-full shadow-sm border border-gray-100">
                <div className={`flex items-center gap-2 ${hasData ? "opacity-40 grayscale decoration-slate-400 line-through" : "text-gray-600"}`}>
                    <Timer className="w-5 h-5" />
                    <span className="font-medium">Tempo Humano: ~15min</span>
                </div>

                {hasData && (
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex items-center gap-2 text-green-600 font-bold"
                    >
                        <Zap className="w-5 h-5 fill-current" />
                        <span>Tempo AI: 12s</span>
                    </motion.div>
                )}
            </div>

            {/* Loading Overlay / Status */}
            <AnimatePresence mode="wait">
                {isLoading && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex flex-col items-center gap-3"
                    >
                        <div className="relative">
                            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Wand2 className="w-5 h-5 text-indigo-600 animate-pulse" />
                            </div>
                        </div>
                        <p className="text-gray-600 font-medium animate-pulse">
                            {messages[stage]}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
