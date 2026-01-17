"use client";

import { Search, Globe, ChevronRight } from "lucide-react";
import { useState } from "react";

interface CrawlerInputProps {
    onCrawl: (url: string) => void;
    isLoading: boolean;
}

const SUGGESTIONS = [
    { name: "Savegnago (Matão)", url: "https://www.savegnago.com.br/jornal-de-ofertas/matao", color: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100" },
    { name: "Amarelinha", url: "https://grupoamarelinha.com.br/nossas_ofertas/7162/", color: "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100" },
];

export default function CrawlerInput({ onCrawl, isLoading }: CrawlerInputProps) {
    const [url, setUrl] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (url) onCrawl(url);
    };

    return (
        <div className="w-full max-w-2xl mx-auto space-y-4">
            <form onSubmit={handleSubmit} className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Globe className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input
                    type="url"
                    className="block w-full pl-10 pr-24 py-4 border-2 border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-0 transition-all shadow-sm text-lg"
                    placeholder="Cole a URL do encarte ou site..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    disabled={isLoading || !url}
                    className="absolute inset-y-2 right-2 px-4 bg-black text-white rounded-lg font-medium text-sm hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {isLoading ? "..." : "Importar"}
                </button>
            </form>

            <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTIONS.map((s) => (
                    <button
                        key={s.name}
                        onClick={() => { setUrl(s.url); onCrawl(s.url); }}
                        disabled={isLoading}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1 transition ${s.color}`}
                    >
                        {s.name}
                        <ChevronRight className="w-3 h-3" />
                    </button>
                ))}
            </div>
        </div>
    );
}
