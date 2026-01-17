"use client";

import { useState } from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

interface ImageViewerProps {
    url: string | null;
}

export default function ImageViewer({ url }: ImageViewerProps) {
    const [zoom, setZoom] = useState(1);

    return (
        <div className="relative h-full w-full bg-gray-900 flex items-center justify-center overflow-hidden rounded-lg shadow-inner group">
            {!url && (
                <div className="text-center p-6">
                    <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md border border-white/10">
                        <Maximize2 className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-400 font-medium">Arraste um encarte aqui</p>
                    <p className="text-gray-600 text-sm mt-1">ou cole a URL ao lado</p>
                </div>
            )}

            {url && (
                <>
                    <div
                        className="transition-transform duration-200 ease-out"
                        style={{ transform: `scale(${zoom})` }}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={url}
                            alt="Encarte"
                            className="max-w-full max-h-screen object-contain shadow-2xl"
                        />
                    </div>

                    {/* Controls */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-md p-2 rounded-full border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                            className="p-2 hover:bg-white/20 rounded-full text-white transition"
                        >
                            <ZoomOut className="w-4 h-4" />
                        </button>
                        <span className="text-xs text-white font-mono min-w-[3ch] text-center">{Math.round(zoom * 100)}%</span>
                        <button
                            onClick={() => setZoom(Math.min(3, zoom + 0.25))}
                            className="p-2 hover:bg-white/20 rounded-full text-white transition"
                        >
                            <ZoomIn className="w-4 h-4" />
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
