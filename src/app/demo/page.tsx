"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import CrawlerInput from "./components/CrawlerInput";
import { PdfUploader } from "./components/PdfUploader";
import CrawlerTerminal from "./components/CrawlerTerminal";
import ValidationList from "./components/ValidationList";
import ImageViewer from "./components/ImageViewer";
import { crawlOffers } from "@/app/actions"; // Server Action

export default function DemoPage() {
    const [viewState, setViewState] = useState<'IDLE' | 'CRAWLING' | 'REVIEW'>('IDLE');
    const [logs, setLogs] = useState<string[]>([]);
    const [data, setData] = useState<any>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [elapsedTime, setElapsedTime] = useState<string | null>(null);

    const addLog = (msg: string) => {
        const now = new Date();
        const timestamp = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;
        setLogs(prev => [...prev, `${timestamp} ${msg}`]);
    };

    const processStream = async (response: Response, start: number) => {
        if (!response.body) throw new Error('ReadableStream not supported');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const chunk = JSON.parse(line);
                    if (chunk.type === 'progress') {
                        addLog(chunk.message);
                    } else if (chunk.type === 'done') {
                        const end = Date.now();
                        const diff = (end - start) / 1000;
                        const timeStr = `${diff.toFixed(1)}s`;

                        setElapsedTime(timeStr);
                        addLog(`✨ Processamento concluído em ${timeStr}!`);

                        setData(chunk.data);
                        setImageUrl(chunk.data.meta.imageUrl || null);
                    } else if (chunk.type === 'error') {
                        throw new Error(chunk.message);
                    }
                } catch (e) {
                    console.error('Error parsing stream chunk', e);
                }
            }
        }
    };

    const handleCrawl = async (url: string) => {
        const start = Date.now();
        setViewState('CRAWLING');
        setLogs([]);
        setStartTime(start);
        setElapsedTime(null);
        addLog(`Iniciando crawler para: ${url}`);

        try {
            const response = await fetch('/api/crawl', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            await processStream(response, start);
        } catch (e: any) {
            console.error(e);
            addLog(`ERRO: ${e.message || 'Erro fatal na execução.'}`);
            setTimeout(() => setViewState('IDLE'), 3000);
        }
    };

    const handleUpload = async (file: File) => {
        const start = Date.now();
        setViewState('CRAWLING');
        setLogs([]);
        setStartTime(start);
        setElapsedTime(null);
        addLog(`Enviando arquivo: ${file.name}`);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            await processStream(response, start);
        } catch (e: any) {
            console.error(e);
            addLog(`ERRO: ${e.message || 'Erro fatal na execução.'}`);
            setTimeout(() => setViewState('IDLE'), 3000);
        }
    };

    const handleApprove = (finalProducts: any[]) => {
        alert(`Sucesso! ${finalProducts.length} produtos cadastrados no banco.`);
        setViewState('IDLE');
        setData(null);
        setImageUrl(null);
    };

    return (
        <div className="h-screen w-screen bg-gray-50 flex flex-col overflow-hidden font-sans">

            {/* Header Simple */}
            <header className="bg-white border-b border-gray-100 p-4 flex justify-between items-center z-10">
                <div className="font-bold text-xl tracking-tight flex items-center gap-2">
                    🛒 PreçosMapa <span className="text-xs bg-black text-white px-2 py-0.5 rounded">CRAWLER v1</span>
                </div>
            </header>

            {/* Main Content Areas */}

            {/* 1. IDLE STATE: Large Search */}
            {viewState === 'IDLE' && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
                    <div className="mb-8 text-center">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Validação de Coleta</h1>
                        <p className="text-gray-500">Cole a URL de um encarte digital para iniciar a extração automática.</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
                        <div className="flex flex-col md:flex-row gap-8 items-center justify-center">
                            <div className="w-full md:w-2/3">
                                <CrawlerInput onCrawl={handleCrawl} isLoading={false} />
                            </div>
                            <div className="hidden md:block w-px h-12 bg-gray-200" />
                            <div className="w-full md:w-1/3">
                                <PdfUploader
                                    onFileSelected={handleUpload}
                                    isLoading={false}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. CRAWLING STATE: Terminal */}
            {viewState === 'CRAWLING' && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-900 animate-in fade-in duration-300">
                    <CrawlerTerminal logs={logs} />

                    {elapsedTime ? (
                        <div className="mt-8 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <button
                                onClick={() => setViewState('REVIEW')}
                                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 group"
                            >
                                Ver Resultados
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                            <p className="text-zinc-500 text-xs">
                                Todos os produtos foram extraídos com sucesso.
                            </p>
                        </div>
                    ) : (
                        <div className="mt-8 text-center max-w-md">
                            <p className="text-zinc-500 text-sm animate-pulse">
                                Estamos usando o GPT-4o Vision para processar as imagens em alta resolução.
                                Isso garante que até os menores textos dos produtos sejam lidos corretamente.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* 3. REVIEW STATE: Split View */}
            {viewState === 'REVIEW' && (
                <div className="flex-1 flex overflow-hidden animate-in slide-in-from-bottom-10 duration-500">
                    {/* Left: Source Image */}
                    <div className="w-1/2 bg-gray-800 p-4 border-r border-gray-700 relative">
                        <div className="absolute top-4 left-4 z-10 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur">
                            Fonte Original
                        </div>
                        <ImageViewer url={imageUrl} />
                    </div>

                    {/* Right: Validation List */}
                    <div className="w-1/2 bg-gray-50 p-6 flex flex-col">
                        <div className="mb-4">
                            <h2 className="text-lg font-bold text-gray-900">Revisar Extração</h2>
                            <p className="text-xs text-gray-500">Verifique se os preços correspondem à imagem ao lado.</p>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <ValidationList initialData={data} onApprove={handleApprove} />
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
