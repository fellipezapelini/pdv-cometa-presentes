<?php

/*
 * Configurações da loja.
 * Fotos de produtos: precisam ficar numa pasta que um domínio realmente serve.
 * Na hospedagem, a pasta do site é public_html; em desenvolvimento, public/ do Laravel.
 */
return [
    'fotos_dir' => env('LOJA_FOTOS_DIR', public_path('uploads/produtos')),
    'fotos_url' => env('LOJA_FOTOS_URL', rtrim(env('APP_URL', 'http://localhost'), '/') . '/uploads/produtos'),
];
