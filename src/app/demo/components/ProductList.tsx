import { EncarteResponse } from "@/lib/schemas";

interface ProductListProps {
    data: EncarteResponse | null;
    meta?: any;
}

export default function ProductList({ data, meta }: ProductListProps) {
    if (!data) {
        return (
            <div className="p-6 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center h-full text-gray-400">
                Nenhum dado extraído ainda.
            </div>
        );
    }

    return (
        <div className="p-6 bg-white shadow rounded-lg overflow-auto">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">Resultado da Extração</h2>
                {meta?.isMock && (
                    <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded">
                        MOCK DATA
                    </span>
                )}
            </div>

            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Produto
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Preço
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Unidade
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Validade
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {data.products.map((product, idx) => (
                        <tr key={idx}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {product.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                R$ {product.price.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {product.unit}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {product.validity || '-'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
