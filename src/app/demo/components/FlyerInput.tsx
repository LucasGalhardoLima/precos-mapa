"use client";

import { useState } from "react";

interface FlyerInputProps {
    onExtract: (url: string) => void;
    isLoading: boolean;
}

export default function FlyerInput({ onExtract, isLoading }: FlyerInputProps) {
    const [url, setUrl] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (url) onExtract(url);
    };

    return (
        <div className="p-6 bg-white shadow rounded-lg">
            <h2 className="text-xl font-bold mb-4 text-gray-800">1. Upload / URL</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">
                        URL do Encarte
                    </label>
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://exemplo.com/encarte.jpg"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                        required
                    />
                </div>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:bg-gray-400 transition"
                >
                    {isLoading ? "Processando..." : "Extrair Produtos"}
                </button>
            </form>
            <p className="text-xs text-gray-500 mt-2">
                * Para teste, use qualquer URL e o sistema usará o mock se sem API Key.
            </p>
        </div>
    );
}
