/**
 * Pays utilisés par les quiz prêts à jouer (drapeaux et capitales).
 * `code` : code ISO 3166-1 alpha-2, qui sert aussi de nom aux images
 * (`/quiz-images/flags/<code>.svg` et `/quiz-images/maps/<code>.svg`).
 * `of` : complément du nom en français, pour écrire « la capitale de la France ».
 *
 * Les pays dont la capitale prête à débat ou est en cours de changement ont été écartés
 * volontairement, pour qu'une seule réponse soit juste sans discussion.
 */
export type Region = 'europe' | 'afrique' | 'asie' | 'ameriques' | 'oceanie';

export interface Country {
  code: string;
  name: string;
  of: string;
  capital: string;
  region: Region;
}

export const COUNTRIES: readonly Country[] = [
  // Europe
  { code: 'fr', name: 'France', of: 'de la France', capital: 'Paris', region: 'europe' },
  { code: 'de', name: 'Allemagne', of: "de l'Allemagne", capital: 'Berlin', region: 'europe' },
  { code: 'es', name: 'Espagne', of: "de l'Espagne", capital: 'Madrid', region: 'europe' },
  { code: 'it', name: 'Italie', of: "de l'Italie", capital: 'Rome', region: 'europe' },
  { code: 'pt', name: 'Portugal', of: 'du Portugal', capital: 'Lisbonne', region: 'europe' },
  { code: 'gb', name: 'Royaume-Uni', of: 'du Royaume-Uni', capital: 'Londres', region: 'europe' },
  { code: 'ie', name: 'Irlande', of: "de l'Irlande", capital: 'Dublin', region: 'europe' },
  { code: 'be', name: 'Belgique', of: 'de la Belgique', capital: 'Bruxelles', region: 'europe' },
  { code: 'nl', name: 'Pays-Bas', of: 'des Pays-Bas', capital: 'Amsterdam', region: 'europe' },
  { code: 'lu', name: 'Luxembourg', of: 'du Luxembourg', capital: 'Luxembourg', region: 'europe' },
  { code: 'ch', name: 'Suisse', of: 'de la Suisse', capital: 'Berne', region: 'europe' },
  { code: 'at', name: 'Autriche', of: "de l'Autriche", capital: 'Vienne', region: 'europe' },
  { code: 'pl', name: 'Pologne', of: 'de la Pologne', capital: 'Varsovie', region: 'europe' },
  { code: 'cz', name: 'Tchéquie', of: 'de la Tchéquie', capital: 'Prague', region: 'europe' },
  { code: 'hu', name: 'Hongrie', of: 'de la Hongrie', capital: 'Budapest', region: 'europe' },
  { code: 'gr', name: 'Grèce', of: 'de la Grèce', capital: 'Athènes', region: 'europe' },
  { code: 'se', name: 'Suède', of: 'de la Suède', capital: 'Stockholm', region: 'europe' },
  { code: 'no', name: 'Norvège', of: 'de la Norvège', capital: 'Oslo', region: 'europe' },
  { code: 'fi', name: 'Finlande', of: 'de la Finlande', capital: 'Helsinki', region: 'europe' },
  { code: 'dk', name: 'Danemark', of: 'du Danemark', capital: 'Copenhague', region: 'europe' },
  { code: 'ro', name: 'Roumanie', of: 'de la Roumanie', capital: 'Bucarest', region: 'europe' },
  { code: 'bg', name: 'Bulgarie', of: 'de la Bulgarie', capital: 'Sofia', region: 'europe' },
  { code: 'hr', name: 'Croatie', of: 'de la Croatie', capital: 'Zagreb', region: 'europe' },
  { code: 'is', name: 'Islande', of: "de l'Islande", capital: 'Reykjavik', region: 'europe' },
  { code: 'ru', name: 'Russie', of: 'de la Russie', capital: 'Moscou', region: 'europe' },

  // Afrique
  { code: 'ma', name: 'Maroc', of: 'du Maroc', capital: 'Rabat', region: 'afrique' },
  { code: 'dz', name: 'Algérie', of: "de l'Algérie", capital: 'Alger', region: 'afrique' },
  { code: 'tn', name: 'Tunisie', of: 'de la Tunisie', capital: 'Tunis', region: 'afrique' },
  { code: 'eg', name: 'Égypte', of: "de l'Égypte", capital: 'Le Caire', region: 'afrique' },
  { code: 'sn', name: 'Sénégal', of: 'du Sénégal', capital: 'Dakar', region: 'afrique' },
  {
    code: 'ci',
    name: "Côte d'Ivoire",
    of: "de la Côte d'Ivoire",
    capital: 'Yamoussoukro',
    region: 'afrique',
  },
  { code: 'ng', name: 'Nigeria', of: 'du Nigeria', capital: 'Abuja', region: 'afrique' },
  { code: 'ke', name: 'Kenya', of: 'du Kenya', capital: 'Nairobi', region: 'afrique' },
  { code: 'et', name: 'Éthiopie', of: "de l'Éthiopie", capital: 'Addis-Abeba', region: 'afrique' },
  { code: 'cm', name: 'Cameroun', of: 'du Cameroun', capital: 'Yaoundé', region: 'afrique' },
  { code: 'ml', name: 'Mali', of: 'du Mali', capital: 'Bamako', region: 'afrique' },
  {
    code: 'mg',
    name: 'Madagascar',
    of: 'de Madagascar',
    capital: 'Antananarivo',
    region: 'afrique',
  },

  // Asie
  { code: 'jp', name: 'Japon', of: 'du Japon', capital: 'Tokyo', region: 'asie' },
  { code: 'cn', name: 'Chine', of: 'de la Chine', capital: 'Pékin', region: 'asie' },
  { code: 'kr', name: 'Corée du Sud', of: 'de la Corée du Sud', capital: 'Séoul', region: 'asie' },
  { code: 'in', name: 'Inde', of: "de l'Inde", capital: 'New Delhi', region: 'asie' },
  { code: 'th', name: 'Thaïlande', of: 'de la Thaïlande', capital: 'Bangkok', region: 'asie' },
  { code: 'vn', name: 'Viêt Nam', of: 'du Viêt Nam', capital: 'Hanoï', region: 'asie' },
  { code: 'ph', name: 'Philippines', of: 'des Philippines', capital: 'Manille', region: 'asie' },
  { code: 'tr', name: 'Turquie', of: 'de la Turquie', capital: 'Ankara', region: 'asie' },
  {
    code: 'sa',
    name: 'Arabie saoudite',
    of: "de l'Arabie saoudite",
    capital: 'Riyad',
    region: 'asie',
  },
  { code: 'ir', name: 'Iran', of: "de l'Iran", capital: 'Téhéran', region: 'asie' },
  { code: 'pk', name: 'Pakistan', of: 'du Pakistan', capital: 'Islamabad', region: 'asie' },
  { code: 'my', name: 'Malaisie', of: 'de la Malaisie', capital: 'Kuala Lumpur', region: 'asie' },
  { code: 'sg', name: 'Singapour', of: 'de Singapour', capital: 'Singapour', region: 'asie' },
  {
    code: 'ae',
    name: 'Émirats arabes unis',
    of: 'des Émirats arabes unis',
    capital: 'Abou Dabi',
    region: 'asie',
  },
  { code: 'lb', name: 'Liban', of: 'du Liban', capital: 'Beyrouth', region: 'asie' },
  { code: 'np', name: 'Népal', of: 'du Népal', capital: 'Katmandou', region: 'asie' },
  { code: 'mn', name: 'Mongolie', of: 'de la Mongolie', capital: 'Oulan-Bator', region: 'asie' },

  // Amériques
  {
    code: 'us',
    name: 'États-Unis',
    of: 'des États-Unis',
    capital: 'Washington',
    region: 'ameriques',
  },
  { code: 'ca', name: 'Canada', of: 'du Canada', capital: 'Ottawa', region: 'ameriques' },
  { code: 'mx', name: 'Mexique', of: 'du Mexique', capital: 'Mexico', region: 'ameriques' },
  { code: 'br', name: 'Brésil', of: 'du Brésil', capital: 'Brasília', region: 'ameriques' },
  {
    code: 'ar',
    name: 'Argentine',
    of: "de l'Argentine",
    capital: 'Buenos Aires',
    region: 'ameriques',
  },
  { code: 'cl', name: 'Chili', of: 'du Chili', capital: 'Santiago', region: 'ameriques' },
  { code: 'pe', name: 'Pérou', of: 'du Pérou', capital: 'Lima', region: 'ameriques' },
  { code: 'co', name: 'Colombie', of: 'de la Colombie', capital: 'Bogota', region: 'ameriques' },
  { code: 'cu', name: 'Cuba', of: 'de Cuba', capital: 'La Havane', region: 'ameriques' },
  { code: 've', name: 'Venezuela', of: 'du Venezuela', capital: 'Caracas', region: 'ameriques' },
  { code: 'uy', name: 'Uruguay', of: "de l'Uruguay", capital: 'Montevideo', region: 'ameriques' },
  { code: 'jm', name: 'Jamaïque', of: 'de la Jamaïque', capital: 'Kingston', region: 'ameriques' },
  { code: 'ec', name: 'Équateur', of: "de l'Équateur", capital: 'Quito', region: 'ameriques' },

  // Océanie
  { code: 'au', name: 'Australie', of: "de l'Australie", capital: 'Canberra', region: 'oceanie' },
  {
    code: 'nz',
    name: 'Nouvelle-Zélande',
    of: 'de la Nouvelle-Zélande',
    capital: 'Wellington',
    region: 'oceanie',
  },
  { code: 'fj', name: 'Fidji', of: 'des Fidji', capital: 'Suva', region: 'oceanie' },
  {
    code: 'pg',
    name: 'Papouasie-Nouvelle-Guinée',
    of: 'de la Papouasie-Nouvelle-Guinée',
    capital: 'Port Moresby',
    region: 'oceanie',
  },
];
