<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class RwandaLocationService
{
    private const API_URL = 'https://gis.naeb.gov.rw/server/rest/services/Hosted/Administrative_Boundaries_WFL1/FeatureServer/1/query';

    public function northernDistrictsAndSectors(): array
    {
        $fallback = $this->fallback();

        if (app()->environment('testing')) {
            return $fallback;
        }

        return Cache::remember('rwanda.northern-district-sectors', now()->addDays(7), function () use ($fallback) {
            try {
                $response = Http::connectTimeout(3)->timeout(6)->get(self::API_URL, [
                    'where' => '1=1',
                    'outFields' => 'district,sector',
                    'returnGeometry' => 'false',
                    'returnDistinctValues' => 'true',
                    'orderByFields' => 'district,sector',
                    'f' => 'json',
                ])->throw()->json('features', []);

                $locations = collect($response)
                    ->map(fn (array $feature) => $feature['attributes'] ?? [])
                    ->filter(fn (array $row) => isset($fallback[$row['district'] ?? ''], $row['sector']) && filled($row['sector']))
                    ->groupBy('district')
                    ->map(fn ($rows) => $rows->pluck('sector')->unique()->sort()->values()->all())
                    ->all();

                return count($locations) === 5 ? $locations : $fallback;
            } catch (\Throwable) {
                return $fallback;
            }
        });
    }

    private function fallback(): array
    {
        return [
            'Burera' => ['Bungwe', 'Butaro', 'Cyanika', 'Cyeru', 'Gahunga', 'Gatebe', 'Gitovu', 'Kagogo', 'Kinoni', 'Kinyababa', 'Kivuye', 'Nemba', 'Rugarama', 'Rugengabari', 'Ruhunde', 'Rusarabuye', 'Rwerere'],
            'Gakenke' => ['Busengo', 'Coko', 'Cyabingo', 'Gakenke', 'Gashenyi', 'Janja', 'Kamubuga', 'Karambo', 'Kivuruga', 'Mataba', 'Minazi', 'Mugunga', 'Muhondo', 'Muyongwe', 'Muzo', 'Nemba', 'Ruli', 'Rusasa', 'Rushashi'],
            'Gicumbi' => ['Bukure', 'Bwisige', 'Byumba', 'Cyumba', 'Giti', 'Kageyo', 'Kaniga', 'Manyagiro', 'Miyove', 'Mukarange', 'Muko', 'Mutete', 'Nyamiyaga', 'Nyankenke', 'Rubaya', 'Rukomo', 'Rushaki', 'Rutare', 'Ruvune', 'Rwamiko', 'Shangasha'],
            'Musanze' => ['Busogo', 'Cyuve', 'Gacaca', 'Gashaki', 'Gataraga', 'Kimonyi', 'Kinigi', 'Muhoza', 'Muko', 'Musanze', 'Nkotsi', 'Nyange', 'Remera', 'Rwaza', 'Shingiro'],
            'Rulindo' => ['Base', 'Burega', 'Bushoki', 'Buyoga', 'Cyinzuzi', 'Cyungo', 'Kinihira', 'Kisaro', 'Masoro', 'Mbogo', 'Murambi', 'Ngoma', 'Ntarabana', 'Rukozo', 'Rusiga', 'Shyorongi', 'Tumba'],
        ];
    }
}
