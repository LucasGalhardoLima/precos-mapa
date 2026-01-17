"use client";

import { EncarteResponse } from "@/lib/schemas";
import { useState, useEffect } from "react";

interface EditableTableProps {
    initialData: EncarteResponse | null;
}

export default function EditableTable({ initialData }: EditableTableProps) {
    const [products, setProducts] = useState(initialData?.products || []);

    useEffect(() => {
        if (initialData?.products) {
            setProducts(initialData.products);
        }
    }, [initialData]);

    if (!initialData) return (
        <div className="h-full flex flex-col items-center justify-center text-gray-400 p-10 border-2 border-dashed rounded-lg bg-gray-50/50">
            <p>Nenhum dado importado.</p>
            <p className="text-sm">Cole uma URL ou use o botão 'Importar' na lateral.</p>
        </div>
    );

    const handleChange = (index: number, field: string, value: string | number) => {
        const newProducts = [...products];
        // @ts-ignore
        newProducts[index] = { ...newProducts[index], [field]: value };
        setProducts(newProducts);
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 overflow-auto bg-white rounded-lg shadow-sm border border-gray-200">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-700 font-semibold sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-4 py-3 border-b">Produto</th>
                            <th className="px-4 py-3 border-b w-24">Preço (R$)</th>
                            <th className="px-4 py-3 border-b w-20">Un.</th>
                            <th className="px-4 py-3 border-b w-32">Validade</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {products.map((p, i) => (
                            <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                <td className="p-2 border-b">
                                    <input
                                        type="text"
                                        value={p.name}
                                        onChange={(e) => handleChange(i, 'name', e.target.value)}
                                        className="w-full bg-transparent border-none focus:ring-0 p-1 font-medium text-gray-900"
                                    />
                                </td>
                                <td className="p-2 border-b">
                                    <input
                                        type="number"
                                        value={p.price}
                                        step="0.01"
                                        onChange={(e) => handleChange(i, 'price', parseFloat(e.target.value))}
                                        className="w-full bg-transparent border-none focus:ring-0 p-1 text-gray-600 font-mono"
                                    />
                                </td>
                                <td className="p-2 border-b">
                                    <select
                                        value={p.unit}
                                        onChange={(e) => handleChange(i, 'unit', e.target.value)}
                                        className="w-full bg-transparent border-none focus:ring-0 p-1 text-gray-500"
                                    >
                                        {['un', 'kg', 'g', 'l', 'ml', 'pack'].map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </td>
                                <td className="p-2 border-b">
                                    <input
                                        type="date"
                                        value={p.validity || ''}
                                        onChange={(e) => handleChange(i, 'validity', e.target.value)}
                                        className="w-full bg-transparent border-none focus:ring-0 p-1 text-gray-500"
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg flex justify-between items-center border border-gray-200">
                <span className="text-sm text-gray-500">Total: {products.length} ofertas encontradas</span>
                <button className="px-4 py-2 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800 transition shadow-sm">
                    Exportar CSV
                </button>
            </div>
        </div>
    );
}
