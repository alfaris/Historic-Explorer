// Where each photo comes from. `npm run fetch-photos` reads this list.
//
// Give either:
//   wikipedia: an English Wikipedia article title. The script uses the
//              article's main image, if it is a freely licensed Commons file.
//   file:      a specific Wikimedia Commons file name (without "File:").
//              Use this to override a poor lead image, or where there's no article.
//
// Places without an entry (most cafés, shops and workshops) keep the
// illustrated placeholder.

export type PhotoSource = { key: string } & ({ wikipedia: string } | { file: string });

export const photoSources: PhotoSource[] = [
  // Routes
  { key: 'route-ahl-al-bayt', wikipedia: 'Mosque of Ibn Tulun' },
  { key: 'route-al-muizz', wikipedia: "Al-Mu'izz Street" },
  { key: 'route-coptic-cairo', wikipedia: 'Coptic Cairo' },
  { key: 'route-darb-al-ahmar', wikipedia: 'Mosque-Madrasa of Sultan Hasan' },

  // Ahl al-Bayt route
  { key: 'place-1', wikipedia: 'Mosque of Ibn Tulun' },
  { key: 'place-2', wikipedia: 'Madrasa of Sarghatmish' },
  { key: 'place-3', wikipedia: 'Gayer-Anderson Museum' },
  { key: 'place-9', wikipedia: 'Mausoleum of Shajar al-Durr' },
  { key: 'place-11', wikipedia: 'Mashhad of Sayyida Ruqayya' },
  { key: 'place-16', wikipedia: 'Al-Sayyida Nafisa Mosque' },

  // Al-Muizz Street
  { key: 'place-102', wikipedia: 'Al-Hakim Mosque' },
  { key: 'place-103', wikipedia: 'Al-Aqmar Mosque' },
  { key: 'place-104', wikipedia: 'Qalawun complex' },
  // The article's lead image is the Barquq complex on Al-Muizz Street.
  { key: 'place-105', file: 'Barqouqy_mosque_-_Moez_street.jpg' },
  // The article's lead image is the covered street's roof; this shows the façade.
  { key: 'place-106', file: 'Al-Ghuri 2019-11-02b.jpg' },
  { key: 'place-107', wikipedia: 'Bab Zuweila' },
  { key: 'place-108', wikipedia: 'Khan el-Khalili' },
  { key: 'place-109', wikipedia: 'El Fishawy' },
  { key: 'place-112', wikipedia: 'Street of the Tentmakers' },
  { key: 'place-113', wikipedia: 'Al-Hussein Mosque' },

  // Coptic Cairo
  { key: 'place-202', wikipedia: 'Mosque of Amr ibn al-As' },
  { key: 'place-203', wikipedia: 'Ben Ezra Synagogue' },
  { key: 'place-204', wikipedia: 'Coptic Museum' },
  { key: 'place-205', wikipedia: 'Church of St. George (Cairo)' },

  // Al-Darb Al-Ahmar & the Citadel
  { key: 'place-302', wikipedia: 'Mosque of Muhammad Ali' },
  { key: 'place-303', wikipedia: 'Mosque-Madrasa of Sultan Hasan' },
  // The article's lead image has no recorded author (CC BY requires one), so
  // use a credited photo of the blue-tiled qibla wall instead.
  { key: 'place-305', file: 'Cairo Aqsunqur 1.jpg' },
];
