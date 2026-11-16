<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Categoria;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CategoriaController extends Controller
{
    public function index()
    {
        return response()->json(Categoria::where('ativo', true)->orderBy('nome')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'nome'      => 'required|string|max:100',
            'descricao' => 'nullable|string',
        ]);
        $data['slug'] = Str::slug($data['nome']);

        $categoria = Categoria::create($data);
        return response()->json($categoria, 201);
    }

    public function update(Request $request, Categoria $categoria)
    {
        $data = $request->validate([
            'nome'      => 'sometimes|string|max:100',
            'descricao' => 'nullable|string',
            'ativo'     => 'sometimes|boolean',
        ]);

        if (isset($data['nome'])) {
            $data['slug'] = Str::slug($data['nome']);
        }

        $categoria->update($data);
        return response()->json($categoria);
    }

    public function destroy(Categoria $categoria)
    {
        if ($categoria->produtos()->where('ativo', true)->exists()) {
            return response()->json(['message' => 'Categoria possui produtos ativos.'], 422);
        }
        $categoria->update(['ativo' => false]);
        return response()->json(null, 204);
    }
}
