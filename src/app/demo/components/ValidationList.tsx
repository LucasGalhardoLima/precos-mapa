"use client";

import { EncarteResponse } from "@/lib/schemas";
import { Edit2, Trash2, Check, X } from "lucide-react";
import { useState, useEffect } from "react";

interface ValidationListProps {
    initialData: EncarteResponse | null;
    onApprove: (data: any) => void;
}

export default function ValidationList({ initialData, onApprove }: ValidationListProps) {
    const [products, setProducts] = useState(initialData?.products || []);

    useEffect(() => {
        if (initialData?.products) setProducts(initialData.products);
    }, [initialData]);

    const handleDelete = (index: number) => {
        setProducts(products.filter((_, i) => i !== index));
    };

    if (products.length === 0) return (
        <div className="text-center py-10 text-gray-400">Nenhum produto para validar.</div>
    );

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 p-1">
                {products.map((p, i) => (
                    <div key={i} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex items-start gap-3 group hover:border-indigo-200 transition-colors">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between mb-1">
                                <h4 className="font-semibold text-gray-900 truncate pr-2" title={p.name}>{p.name}</h4>
                                <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{p.market_origin || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <span className="font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">R$ {p.price.toFixed(2)}</span>
                                <span className="text-gray-500 text-xs">/ {p.unit}</span>
                                {p.validity && <span className="text-gray-400 text-xs ml-auto">val: {p.validity}</span>}
                            </div>
                        </div>

                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-indigo-600 rounded">
                                <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(i)} className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
                <button
                    onClick={() => onApprove(products)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold shadow-md shadow-green-200 flex items-center justify-center gap-2 transition transform active:scale-95"
                >
                    <Check className="w-5 h-5" />
                    Aprovar e Cadastrar ({products.length})
                </button>
            </div>
        </div>
    );
}
