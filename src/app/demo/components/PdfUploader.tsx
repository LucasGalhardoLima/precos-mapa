'use client';

import { useState } from 'react';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { extractFromPdf } from '@/app/actions';

interface PdfUploaderProps {
    onFileSelected: (file: File) => void;
    isLoading?: boolean;
}

export function PdfUploader({ onFileSelected, isLoading }: PdfUploaderProps) {
    async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            alert('Por favor, envie apenas arquivos PDF.');
            return;
        }

        onFileSelected(file);
        // Reset input
        event.target.value = '';
    }

    return (
        <div className="relative group cursor-pointer">
            <input
                type="file"
                accept=".pdf"
                disabled={isLoading}
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
            />
            <div className={`
        flex items-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed
        transition-all duration-200
        ${isLoading
                    ? 'border-indigo-500/50 bg-indigo-500/10'
                    : 'border-white/20 hover:border-indigo-500/50 hover:bg-white/5'
                }
      `}>
                {isLoading ? (
                    <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                ) : (
                    <Upload className="w-5 h-5 text-zinc-400 group-hover:text-indigo-400 transition-colors" />
                )}

                <div className="flex flex-col text-left">
                    <span className={`text-sm font-medium ${isLoading ? 'text-indigo-300' : 'text-zinc-200'}`}>
                        {isLoading ? 'Processando PDF...' : 'Upload PDF'}
                    </span>
                    {!isLoading && (
                        <span className="text-xs text-zinc-500">Arraste ou clique</span>
                    )}
                </div>
            </div>
        </div>
    );
}
