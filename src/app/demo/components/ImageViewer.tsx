"use client";

import { useState } from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

interface ImageViewerProps {
    images: string[];
}

export default function ImageViewer({ images }: ImageViewerProps) {
    const [zoom, setZoom] = useState(1);

    return (
        <div className="relative h-full w-full bg-gray-900 flex flex-col overflow-hidden rounded-lg shadow-inner group">
            {images.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                    <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md border border-white/10">
                        <Maximize2 className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-400 font-medium">Extraindo dados do encarte...</p>
                    <p className="text-gray-600 text-sm mt-1">Aguarde o processamento visual</p>
                </div>
            )}

            {images.length > 0 && (
                <>
                    {/* Scrollable Container for all pages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                        <div
                            className="transition-transform duration-200 ease-out origin-top flex flex-col gap-4 items-center"
                            style={{ transform: `scale(${zoom})` }}
                        >
                            {images.map((url, index) => (
                                <div key={index} className="relative w-full flex justify-center">
                                    <div className="absolute -left-10 top-2 bg-black/40 text-[10px] text-zinc-400 px-2 py-0.5 rounded-full border border-white/5 pointer-events-none">
                                        Pág {index + 1}
                                    </div>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={url}
                                        alt={`Página ${index + 1}`}
                                        className="max-w-full h-auto object-contain shadow-2xl rounded"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/80 backdrop-blur-lg p-2 rounded-full border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                        <button
                            onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                            className="p-2 hover:bg-white/20 rounded-full text-white transition"
                            title="Zoom Out"
                        >
                            <ZoomOut className="w-4 h-4" />
                        </button>
                        <span className="text-xs text-white font-mono min-w-[3ch] text-center">{Math.round(zoom * 100)}%</span>
                        <button
                            onClick={() => setZoom(Math.min(3, zoom + 0.25))}
                            className="p-2 hover:bg-white/20 rounded-full text-white transition"
                            title="Zoom In"
                        >
                            <ZoomIn className="w-4 h-4" />
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
