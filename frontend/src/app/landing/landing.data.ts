export interface PlayerPreview {
  initials: string;
  name: string;
  level: string;
  tone: string;
}

export interface MatchPreview {
  id: string;
  day: string;
  time: string;
  duration: string;
  club: string;
  image: string;
  imageAlt: string;
  address: string;
  zone: string;
  level: string;
  price: string;
  openSpots: number;
  players: PlayerPreview[];
  features: string[];
}

export const MATCHES: MatchPreview[] = [
  {
    id: 'gonnet-2030',
    day: 'Hoy',
    time: '20:30 hs',
    duration: '90 min',
    club: 'Club Universitario Gonnet',
    image: '/images/cancha-interior.jpg',
    imageAlt: 'Cancha de pádel techada del club',
    address: 'Calle 14 y 501, Gonnet',
    zone: 'Gonnet',
    level: '5ta',
    price: '$4.500',
    openSpots: 1,
    players: [
      { initials: 'JM', name: 'Juan M.', level: '5ta', tone: 'mint' },
      { initials: 'MV', name: 'Martín V.', level: '5ta', tone: 'lavender' },
      { initials: 'FC', name: 'Facundo T.', level: '6ta', tone: 'peach' },
    ],
    features: ['Techado', 'Iluminación'],
  },
  {
    id: 'cumbre-2200',
    day: 'Hoy',
    time: '22:00 hs',
    duration: '90 min',
    club: 'La Cumbre Pádel',
    image: '/images/cancha-exterior.jpg',
    imageAlt: 'Cancha de pádel exterior en La Cumbre',
    address: 'Av. 31 y 523, La Cumbre',
    zone: 'Gonnet',
    level: '6ta',
    price: '$4.800',
    openSpots: 2,
    players: [
      { initials: 'LR', name: 'Lucía R.', level: '6ta', tone: 'peach' },
      { initials: 'AG', name: 'Agustín G.', level: '6ta', tone: 'mint' },
    ],
    features: ['Aire libre', 'Iluminación'],
  },
  {
    id: 'citybell-1900',
    day: 'Mañana',
    time: '19:00 hs',
    duration: '90 min',
    club: 'Pádel City Bell',
    image: '/images/cancha-exterior.jpg',
    imageAlt: 'Cancha de pádel exterior en City Bell',
    address: 'Camino Centenario 2800',
    zone: 'City Bell',
    level: '4ta',
    price: '$5.200',
    openSpots: 1,
    players: [
      { initials: 'GC', name: 'Gonzalo C.', level: '4ta', tone: 'lavender' },
      { initials: 'EB', name: 'Esteban D.', level: '4ta', tone: 'mint' },
      { initials: 'AQ', name: 'Joaquín F.', level: '4ta', tone: 'peach' },
    ],
    features: ['Panorámica', 'Estacionamiento'],
  },
  {
    id: 'estudiantes-2100',
    day: 'Mañana',
    time: '21:00 hs',
    duration: '90 min',
    club: 'Estudiantes de La Plata',
    image: '/images/cancha-interior.jpg',
    imageAlt: 'Cancha de pádel del club Estudiantes',
    address: 'Calle 53 y 7, Casco Histórico',
    zone: 'Casco Urbano',
    level: '3ra',
    price: '$5.800',
    openSpots: 3,
    players: [{ initials: 'IG', name: 'Ignacio G.', level: '3ra', tone: 'peach' }],
    features: ['Techado', 'Iluminación'],
  },
  {
    id: 'casco-2030',
    day: 'Hoy',
    time: '20:30 hs',
    duration: '90 min',
    club: 'Círculo de Suboficiales',
    image: '/images/cancha-interior.jpg',
    imageAlt: 'Cancha de pádel techada en La Plata',
    address: 'Calle 44 y 11, La Plata',
    zone: 'Casco Urbano',
    level: '5ta',
    price: '$4.900',
    openSpots: 2,
    players: [
      { initials: 'NL', name: 'Nicolás L.', level: '5ta', tone: 'lavender' },
      { initials: 'BM', name: 'Belén M.', level: '5ta', tone: 'peach' },
    ],
    features: ['Techado', 'Iluminación'],
  },
  {
    id: 'balcon-2130',
    day: 'Hoy',
    time: '21:30 hs',
    duration: '90 min',
    club: 'El Balcón Pádel',
    image: '/images/cancha-exterior.jpg',
    imageAlt: 'Cancha de pádel al aire libre en Tolosa',
    address: 'Calle 528 y 125, Tolosa',
    zone: 'Tolosa',
    level: '7ma',
    price: '$3.800',
    openSpots: 1,
    players: [
      { initials: 'RA', name: 'Rodrigo A.', level: '7ma', tone: 'mint' },
      { initials: 'VC', name: 'Valeria C.', level: '7ma', tone: 'lavender' },
      { initials: 'TM', name: 'Tomás G.', level: '7ma', tone: 'peach' },
    ],
    features: ['Aire libre', 'Iluminación'],
  },
  {
    id: 'terraza-2000',
    day: 'Jueves',
    time: '20:00 hs',
    duration: '90 min',
    club: 'Complejo La Terraza Pádel',
    image: '/images/cancha-exterior.jpg',
    imageAlt: 'Cancha de pádel del complejo La Terraza',
    address: 'Camino Centenario 352 y 72',
    zone: 'City Bell',
    level: '4ta',
    price: '$4.800',
    openSpots: 0,
    players: [
      { initials: 'FD', name: 'Franco S.', level: '4ta', tone: 'mint' },
      { initials: 'DM', name: 'Damián L.', level: '4ta', tone: 'lavender' },
      { initials: 'AS', name: 'Agustín B.', level: '4ta', tone: 'peach' },
      { initials: 'MR', name: 'Mariano Z.', level: '4ta', tone: 'mint' },
    ],
    features: ['Techado', 'Estacionamiento'],
  },
  {
    id: 'gonnet-2230',
    day: 'Hoy',
    time: '22:30 hs',
    duration: '90 min',
    club: 'Club La Cumbre Pádel',
    image: '/images/cancha-exterior.jpg',
    imageAlt: 'Cancha panorámica de pádel en Gonnet',
    address: 'Camino Belgrano y 489',
    zone: 'Gonnet',
    level: '5ta',
    price: '$4.200',
    openSpots: 2,
    players: [
      { initials: 'NP', name: 'Nicolás P.', level: '5ta', tone: 'lavender' },
      { initials: 'SL', name: 'Sofía L.', level: '5ta', tone: 'peach' },
    ],
    features: ['Panorámica', 'Iluminación'],
  },
];

export const RECOMMENDED_MATCHES = MATCHES.slice(0, 3);
export const HOME_MATCHES = [MATCHES[4], MATCHES[2], MATCHES[0]];

export interface ClubPreview {
  /** Complejo cuya grilla de turnos abre "Explorar turnos" (HU-05). */
  complexId: string;
  name: string;
  matchSearchName?: string;
  zone: string;
  rating: string;
  availabilityLabel: string;
  openSlots: number;
  image: string;
  imagePosition: string;
}

export const FEATURED_CLUBS: ClubPreview[] = [
  {
    complexId: 'complex-cumbre',
    name: 'La Cumbre Pádel',
    matchSearchName: 'La Cumbre Pádel',
    zone: 'Calle 131 y 32 · San Carlos',
    rating: '4.9',
    availabilityLabel: '12 turnos disponibles hoy',
    openSlots: 12,
    image: '/images/cancha-interior.jpg',
    imagePosition: 'center',
  },
  {
    complexId: 'complex-citybell',
    name: 'City Bell Padel Hub',
    matchSearchName: 'Pádel City Bell',
    zone: 'Camino Centenario 4462 · City Bell',
    rating: '4.8',
    availabilityLabel: '8 turnos disponibles hoy',
    openSlots: 8,
    image: '/images/cancha-exterior.jpg',
    imagePosition: 'center 58%',
  },
  {
    complexId: 'complex-estudiantes',
    name: 'Estudiantes de La Plata',
    matchSearchName: 'Estudiantes de La Plata',
    zone: 'Calle 53 y 7 · Casco Histórico',
    rating: '4.9',
    availabilityLabel: '5 turnos disponibles hoy',
    openSlots: 5,
    image: '/images/cancha-exterior.jpg',
    imagePosition: 'right center',
  },
];

export const ZONES = ['Casco Urbano', 'City Bell', 'Gonnet', 'Tolosa', 'Villa Elisa'];
export const LEVELS = ['2da', '3ra', '4ta', '5ta', '6ta', '7ma', '8va'];
