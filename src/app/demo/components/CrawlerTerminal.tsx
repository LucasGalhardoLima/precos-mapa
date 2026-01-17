"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Terminal as TerminalIcon } from "lucide-react";
import { useEffect, useRef } from "react";

interface CrawlerTerminalProps {
    logs: string[];
}

export default function CrawlerTerminal({ logs }: CrawlerTerminalProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div className="bg-gray-900 rounded-lg shadow-xl overflow-hidden font-mono text-xs md:text-sm text-green-400 p-4 w-full max-w-2xl mx-auto border border-gray-800">
            <div className="flex items-center gap-2 mb-3 border-b border-gray-800 pb-2">
                <TerminalIcon className="w-4 h-4 text-gray-500" />
                <span className="text-gray-500">crawler.exe</span>
                <div className="ml-auto flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/50"></div>
                </div>
            </div>
            <div
                ref={scrollContainerRef}
                className="flex flex-col gap-1 h-64 overflow-y-auto scroll-smooth"
            >
                <AnimatePresence initial={false}>
                    {logs.map((log, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="break-words"
                        >
                            <span className="text-gray-500 mr-2">[{new Date().toLocaleTimeString()}]</span>
                            {log}
                        </motion.div>
                    ))}
                </AnimatePresence>
                <div className="animate-pulse">_</div>
            </div>
        </div>
    );
}
