<?php
// app/Http/Controllers/Api/FreteController.php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class FreteController extends Controller
{
    // Token, e-mail e CEP de origem do SuperFrete ficam no .env (SUPERFRETE_TOKEN / SUPERFRETE_EMAIL / LOJA_CEP_ORIGEM)
    public function calcular(Request $request)
    {
        $data = $request->validate([
            'cep_destino' => 'required|string|min:8',
            'itens'       => 'required|array|min:1',
            'itens.*.peso'        => 'required|numeric|min:0.01',
            'itens.*.altura'      => 'required|numeric|min:1',
            'itens.*.largura'     => 'required|numeric|min:1',
            'itens.*.comprimento' => 'required|numeric|min:1',
            'itens.*.quantidade'  => 'required|integer|min:1',
        ]);

        $cepDestino = preg_replace('/\D/', '', $data['cep_destino']);

        // Monta os volumes para a API do Superfrete
        $volumes = collect($data['itens'])->map(fn($i) => [
            'weight'   => (float) $i['peso'],
            'width'    => (int)   $i['largura'],
            'height'   => (int)   $i['altura'],
            'length'   => (int)   $i['comprimento'],
            'quantity' => (int)   $i['quantidade'],
            'insurance_value' => 0,
            'unitary_value' => 0,
        ])->values()->toArray();

        $response = Http::withHeaders([
            'Authorization' => 'Bearer ' . config('services.superfrete.token'),
            'User-Agent'    => 'Cometa Presentes v1.0 (' . config('services.superfrete.email') . ')',
            'Accept'        => 'application/json',
            'Content-Type'  => 'application/json',
        ])->post('https://api.superfrete.com/api/v0/calculator', [
            'from' => ['postal_code' => config('services.superfrete.cep_origem')],
            'to'   => ['postal_code' => $cepDestino],
            'services' => '1,2,3,4,17', // PAC, SEDEX, Mini, Jadlog, Total
            'options' => [
                'receipt'           => false,
                'own_hand'          => false,
                'reverse'           => false,
                'non_commercial'    => false,
                'insurance_value'   => 0,
            ],
            // A API do SuperFrete exige "products" (ou "package"); o antigo "volumes" é recusado com erro 400
            'products' => $volumes,
        ]);

        if (!$response->successful()) {
            return response()->json(['message' => 'Erro ao consultar frete.'], 422);
        }

        $opcoes = collect($response->json())
            ->filter(fn($s) => !isset($s['error']) && isset($s['price']))
            ->map(fn($s) => [
                'id'           => $s['id'],
                'nome'         => $s['name'],
                'empresa'      => $s['company']['name'] ?? '',
                'preco'        => (float) $s['price'],
                'prazo'        => (int) ($s['delivery_time'] ?? 0),
                'logo'         => $s['company']['picture'] ?? null,
            ])
            ->sortBy('preco')
            ->values();

        return response()->json($opcoes);
    }
}
