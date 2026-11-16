<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use App\Models\Produto; // Ajuste se seu model estiver em outro namespace
use Illuminate\Support\Facades\Validator;

class ImportacaoProdutoController extends Controller
{
    public function importarLote(Request $request)
    {
        $request->validate([
            'produtos' => 'required|array',
            'estrategia' => 'required|in:pular,atualizar'
        ]);

        $produtos = $request->input('produtos');
        $estrategia = $request->input('estrategia');

        $sucesso = 0;
        $atualizados = 0;
        $erros = [];

        foreach ($produtos as $index => $item) {
            // 1. Validar campos obrigatórios básicos do loop
            $validator = Validator::make($item, [
                'nome' => 'required|string|max:255',
                'sku' => 'required|string|max:255',
                'preco_venda' => 'required|numeric',
                'categoria_id' => 'required|integer',
            ]);

            if ($validator->fails()) {
                $erros[] = "Linha " . ($index + 1) . " (" . ($item['nome'] ?? 'Sem nome') . "): Dados inválidos ou incompletos.";
                continue;
            }

            // 2. Verificar duplicidade de SKU e Nome
            $produtoPorSku = Produto::where('sku', $item['sku'])->first();
            $produtoPorNome = Produto::where('nome', $item['nome'])->first();

            // Se já existe por SKU
            if ($produtoPorSku) {
                if ($estrategia === 'pular') {
                    $erros[] = "SKU '" . $item['sku'] . "': Produto já cadastrado com esse sku.";
                    continue;
                } else {
                    // Atualizar
                    $produtoPorSku->update([
                        'descricao' => $item['descricao'] ?? $produtoPorSku->descricao,
                        'categoria_id' => $item['categoria_id'],
                        'preco_custo' => $item['preco_custo'] ?? $produtoPorSku->preco_custo,
                        'preco_venda' => $item['preco_venda'],
                        'quantidade' => $item['quantidade'] ?? $produtoPorSku->quantidade,
                        'estoque_minimo' => $item['estoque_minimo'] ?? $produtoPorSku->estoque_minimo,
                    ]);
                    $atualizados++;
                    continue;
                }
            }

            // Se já existe por Nome (e não é o mesmo SKU de cima)
            if ($produtoPorNome) {
                $erros[] = "Nome '" . $item['nome'] . "': Produto já cadastrado com esse nome.";
                continue;
            }

            // 3. Se passou em tudo, cadastra um novo
            Produto::create([
                'nome' => $item['nome'],
                'descricao' => $item['descricao'] ?? null,
                'sku' => $item['sku'],
                'categoria_id' => $item['categoria_id'],
                'preco_custo' => $item['preco_custo'] ?? 0,
                'preco_venda' => $item['preco_venda'],
                'quantidade' => $item['quantidade'] ?? 0,
                'estoque_minimo' => $item['estoque_minimo'] ?? 5,
                'ativo' => true,
                'visivel_vitrine' => true
            ]);
            $sucesso++;
        }

        return response()->json([
            'sucesso' => $sucesso,
            'atualizados' => $atualizados,
            'erros' => $erros
        ]);
    }
}