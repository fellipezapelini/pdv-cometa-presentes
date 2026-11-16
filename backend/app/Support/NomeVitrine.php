<?php

namespace App\Support;

/**
 * Transforma o nome técnico do produto (como veio da nota fiscal) num nome apresentável para a vitrine.
 * Ex.: "CAN ESF. BIC 1.0 CRISTAL- PRETA(E) CANETA BIC PRETA" → "Can Esf. Bic 1.0 Cristal Preta Caneta Bic Preta"
 *      "COLA BRANCA BIC 40G  COLA BRANCA BIC 40G"           → "Cola Branca Bic 40g"
 *      "PENTE PIOLHO TARTARUGA -MARROM- SBRISSA S/CB (C/24)" → "Pente Piolho Tartaruga Marrom Sbrissa"
 * Quando o vendedor preenche "nome na vitrine", esse nome manual é usado no lugar.
 */
class NomeVitrine
{
    private const MINUSCULAS = ['de', 'da', 'do', 'das', 'dos', 'e', 'com', 'para', 'p/', 'em', 'a', 'o', 'c/', 's/'];
    private const SIGLAS = ['PVC', 'LED', 'USB', 'AAA', 'AA', 'TV', 'MDF', 'EVA', 'A4', 'A3', 'A5', 'HD', 'PS', 'PP', 'RGB'];

    public static function limpar(?string $nome): string
    {
        $s = trim((string) $nome);
        if ($s === '') return '';

        // Códigos de fornecedor / embalagem que não interessam ao cliente
        $s = preg_replace('/\((?:C|CX)\s*\/\s*\d+\)|\(E\)|\(\s*\d+\s*UN\s*\)/iu', ' ', $s);  // (C/12) (E) (12 UN)
        $s = preg_replace('/\bC\s*\/\s*\d+\s*CX\s*\d+\b/iu', ' ', $s);                       // C/ 12 CX12
        $s = preg_replace('/\b(?:R|REF|COD)\.?\s*\d{3,}\b/iu', ' ', $s);                      // R.62116 / REF 123
        $s = preg_replace('/\bS\s*\/\s*CB\b|\bC\s*\/\s*\d+\s*CB\b/iu', ' ', $s);                // S/CB, C/ 1 CB
        $s = preg_replace('/\s+-\s*|\s*-\s+|(?<=\S)-(?=\s|$)/u', ' ', $s);                     // hífens soltos
        $s = preg_replace('/(?<=\s|^)-(?=\S)/u', '', $s);                                      // "-MARROM-" → "MARROM"
        $s = preg_replace('/\s+/u', ' ', trim($s));

        // Nome repetido (a tela antiga de notas concatenava "nome da caixa + nome da unidade")
        $t = explode(' ', $s);
        for ($k = intdiv(count($t), 2); $k >= 2; $k--) {
            $fim = array_slice($t, -$k);
            $antes = array_slice($t, -2 * $k, $k);
            if (array_map('mb_strtoupper', $fim) === array_map('mb_strtoupper', $antes)) {
                $t = array_slice($t, 0, count($t) - $k);
                break;
            }
        }

        // Title Case em português, mantendo siglas e unidades (40G → 40g, 250ML → 250ml)
        $out = [];
        foreach ($t as $i => $w) {
            $out[] = self::palavra($w, $i === 0);
        }

        return trim(preg_replace('/\s+/u', ' ', implode(' ', $out)));
    }

    private static function palavra(string $w, bool $primeira): string
    {
        $up = mb_strtoupper($w);
        $low = mb_strtolower($w);

        if (in_array($up, self::SIGLAS, true)) return $up;
        // Medidas: 40G → 40g, 90GR → 90g, 250ML → 250ml
        if (preg_match('/^(\d+(?:[.,]\d+)?)(GRS?|G)$/iu', $w, $m)) return $m[1] . 'g';
        if (preg_match('/^\d+(?:[.,]\d+)?(ML|L|KG|MG|CM|MM|M|W|V|UN|UND|CORES|FLS)$/iu', $w)) return $low;
        if (preg_match('/\d/u', $w)) return $up;
        // Abreviações com barra: P/UNHA → p/ Unha, C/BASE → c/ Base
        if (preg_match('/^([PCS])\/(.+)$/iu', $w, $m)) return mb_strtolower($m[1]) . '/ ' . self::palavra($m[2], false);
        if (!$primeira && in_array($low, self::MINUSCULAS, true)) return $low;
        // Palavras com ponto: AMAR.POP → Amar.Pop
        return implode('.', array_map(
            fn($p) => mb_strtoupper(mb_substr($p, 0, 1)) . mb_substr($p, 1),
            explode('.', $low)
        ));
    }
}
