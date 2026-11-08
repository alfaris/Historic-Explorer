import type { Photo } from './photos';
import type { OpeningHours } from '../lib/opening-hours';
import type { VisitorTips } from '../lib/visitor-tips';
import type { EraId } from '../lib/eras';

export type Category = 'monument' | 'coffee' | 'restaurant' | 'workshop' | 'stationary' | 'meeting';

export interface Route {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  image: string;
  highlightsEn: string[];
  highlightsAr: string[];
  /** French and Spanish (optional): shown in that language, falling back to English when empty. */
  nameFr?: string;
  descriptionFr?: string;
  highlightsFr?: string[];
  nameEs?: string;
  descriptionEs?: string;
  highlightsEs?: string[];
  /** Length of the walk, in kilometres. */
  distanceKm: number;
  /** Walking time in hours, as a range (the same number twice for a single value). */
  hoursMin: number;
  hoursMax: number;
  /** English text of the above, kept for app versions that read it. */
  distance: string;
  duration: string;
  /** Uploaded in the admin dashboard; replaces the built-in photo. */
  photo?: Photo;
  /** What the photo shows, for screen readers, in each language (optional). See photoAltOf. */
  photoAltEn?: string;
  photoAltAr?: string;
  photoAltFr?: string;
  photoAltEs?: string;
  /** Getting there (optional): the place the walk starts from, when not the first stop (a meeting point, say). */
  startId?: number;
  /** The nearest metro station to the start, in each language, and the walk from it in minutes. */
  metroEn?: string;
  metroAr?: string;
  metroFr?: string;
  metroEs?: string;
  metroMinutes?: number;
  /** A note on getting to the start, in each language ("Ask for Bab Zuweila: cars can't enter the street"). */
  gettingThereEn?: string;
  gettingThereAr?: string;
  gettingThereFr?: string;
  gettingThereEs?: string;
  /** Fields Gemini drafted that no one has checked yet (admin only). See drafted.ts. */
  drafted?: string[];
}

export interface Location {
  id: number;
  routeId: string;
  nameEn: string;
  nameAr: string;
  category: Category;
  descriptionEn?: string;
  descriptionAr?: string;
  /** French and Spanish (optional): shown in that language, falling back to English when empty. */
  nameFr?: string;
  descriptionFr?: string;
  nameEs?: string;
  descriptionEs?: string;
  lat: number;
  lng: number;
  /** Practical tips: dress, shoes, photos, access, toilets, a note. Unset: defaults for an active mosque. */
  tips?: VisitorTips;
  /** Visits pause during prayers. Unset: worked out from the name (a mosque). See isActiveMosque. */
  mosque?: boolean;
  /** "Spot it": a small find-this challenge for families, and its answer (optional, per language). See lib/spot-it. */
  spotEn?: string;
  spotAr?: string;
  spotFr?: string;
  spotEs?: string;
  spotAnswerEn?: string;
  spotAnswerAr?: string;
  spotAnswerFr?: string;
  spotAnswerEs?: string;
  /** When it was built and in which era (Through the ages); all optional. See lib/eras. */
  era?: EraId;
  builtFrom?: number;
  builtTo?: number;
  /** Weekly opening hours, in Cairo time. Optional: without them the app shows nothing rather than a guess. */
  hours?: OpeningHours;
  /** Entry fee as written for visitors, e.g. "EGP 60 · students EGP 30". Other languages fall back to English. */
  feeEn?: string;
  feeAr?: string;
  feeFr?: string;
  feeEs?: string;
  image?: string;
  /** Uploaded in the admin dashboard; replaces the built-in photo. */
  photo?: Photo;
  /** What the photo shows, for screen readers, in each language (optional). See photoAltOf. */
  photoAltEn?: string;
  photoAltAr?: string;
  photoAltFr?: string;
  photoAltEs?: string;
  /** Fields Gemini drafted that no one has checked yet (admin only). See drafted.ts. */
  drafted?: string[];
}

export const routes: Route[] = [
  {
    id: 'ahl-al-bayt',
    nameEn: 'Ahl al-Bayt Route',
    nameAr: 'مسار آل البيت',
    descriptionEn: 'A journey through history and spirituality in the heart of Cairo',
    descriptionAr: 'رحلة عبر التاريخ والروحانية في قلب القاهرة',
    image: '',
    highlightsEn: ['20+ Spiritual sites', 'Unique Spiral Minaret', 'Traditional Handicrafts'],
    highlightsAr: ['أكثر من ٢٠ موقعاً روحياً', 'مئذنة ملتوية فريدة', 'حرف يدوية تقليدية'],
    nameFr: "Parcours d'Ahl al-Bayt",
    descriptionFr: "Un voyage entre histoire et spiritualité au cœur du Caire",
    highlightsFr: ["Plus de 20 sites spirituels", "Un minaret en spirale unique", "Artisanat traditionnel"],
    nameEs: 'Ruta de Ahl al-Bayt',
    descriptionEs: 'Un viaje por la historia y la espiritualidad en el corazón de El Cairo',
    highlightsEs: ['Más de 20 lugares espirituales', 'Un minarete en espiral único', 'Artesanía tradicional'],
    distanceKm: 2.5,
    hoursMin: 2,
    hoursMax: 3,
    distance: '2.5 km',
    duration: '2-3 hours'
  },
  {
    id: 'al-muizz',
    nameEn: 'Al-Muizz Street Route',
    nameAr: 'مسار شارع المعز',
    descriptionEn: 'The greatest concentration of medieval architectural treasures in the Islamic world',
    descriptionAr: 'أكبر تجمع للكنوز المعمارية في العالم الإسلامي',
    image: '',
    highlightsEn: ['Medieval Architecture', 'Khan el-Khalili Bazaar', 'Ancient City Gates'],
    highlightsAr: ['عمارة العصور الوسطى', 'بازار خان الخليلي', 'بوابات المدينة القديمة'],
    nameFr: "Rue Al-Muizz",
    descriptionFr: "La plus grande concentration de trésors architecturaux médiévaux du monde islamique",
    highlightsFr: ["Architecture médiévale", "Le bazar de Khan el-Khalili", "Les anciennes portes de la ville"],
    nameEs: 'Calle Al-Muizz',
    descriptionEs: 'La mayor concentración de tesoros arquitectónicos medievales del mundo islámico',
    highlightsEs: ['Arquitectura medieval', 'Bazar de Jan el-Jalili', 'Antiguas puertas de la ciudad'],
    distanceKm: 1.8,
    hoursMin: 3,
    hoursMax: 4,
    distance: '1.8 km',
    duration: '3-4 hours'
  },
  {
    id: 'coptic-cairo',
    nameEn: 'Coptic Cairo (Religious Complex)',
    nameAr: 'مجمع الأديان (مصر القديمة)',
    descriptionEn: 'A compact walled quarter where ancient churches and the Ben Ezra Synagogue stand side by side',
    descriptionAr: 'حي صغير مسوّر تتجاور فيه الكنائس العريقة ومعبد بن عزرا',
    image: '',
    highlightsEn: ['The Hanging Church', 'Ben Ezra Synagogue', 'Roman Fortress Ruins'],
    highlightsAr: ['الكنيسة المعلقة', 'معبد بن عزرا', 'أنقاض الحصن الروماني'],
    nameFr: "Le Caire copte (complexe des religions)",
    descriptionFr: "Un petit quartier fortifié où les églises anciennes et la synagogue Ben Ezra se côtoient",
    highlightsFr: ["L'Église suspendue", "La synagogue Ben Ezra", "Les vestiges de la forteresse romaine"],
    nameEs: 'El Cairo copto (complejo de las religiones)',
    descriptionEs: 'Un pequeño barrio amurallado donde antiguas iglesias y la sinagoga Ben Ezra se alzan una junto a otra',
    highlightsEs: ['La Iglesia Colgante', 'Sinagoga Ben Ezra', 'Ruinas de la fortaleza romana'],
    distanceKm: 1,
    hoursMin: 1.5,
    hoursMax: 2,
    distance: '1 km',
    duration: '1.5-2 hours'
  },
  {
    id: 'darb-al-ahmar',
    nameEn: 'Al-Darb Al-Ahmar & Citadel',
    nameAr: 'الدرب الأحمر والقلعة',
    descriptionEn: 'Historic district featuring the majestic Citadel and stunning Mamluk architecture',
    descriptionAr: 'حي تاريخي يضم قلعة صلاح الدين الشامخة وروائع العمارة المملوكية',
    image: '',
    highlightsEn: ['Salah El-Din Citadel', 'Alabaster Mosque', 'Al-Azhar Park Views'],
    highlightsAr: ['قلعة صلاح الدين', 'مسجد الألبستر', 'إطلالات حديقة الأزهر'],
    nameFr: "Al-Darb Al-Ahmar et la Citadelle",
    descriptionFr: "Un quartier historique avec la majestueuse Citadelle et une superbe architecture mamelouke",
    highlightsFr: ["La Citadelle de Saladin", "La mosquée d'albâtre", "Les vues du parc Al-Azhar"],
    nameEs: 'Al-Darb Al-Ahmar y la Ciudadela',
    descriptionEs: 'Barrio histórico con la majestuosa Ciudadela y una espléndida arquitectura mameluca',
    highlightsEs: ['Ciudadela de Saladino', 'Mezquita de Alabastro', 'Vistas desde el parque Al-Azhar'],
    distanceKm: 2.2,
    hoursMin: 3,
    hoursMax: 4,
    distance: '2.2 km',
    duration: '3-4 hours'
  },
  {
    id: 'fustat-roda',
    nameEn: 'Fustat, Roda & Old Cairo',
    nameAr: 'الفسطاط والروضة ومصر القديمة',
    descriptionEn: "From the Nile palaces and Abbasid Nilometer of Roda Island to Fustat, Egypt's first Islamic capital",
    descriptionAr: 'من قصور جزيرة الروضة ومقياس النيل العباسي إلى الفسطاط، أول عاصمة إسلامية لمصر',
    image: '',
    highlightsEn: ['Abbasid Nilometer (861 AD)', 'Royal Mummies at NMEC', 'Oldest Mosque in Africa'],
    highlightsAr: ['مقياس النيل العباسي (٨٦١م)', 'المومياوات الملكية بمتحف الحضارة', 'أقدم مسجد في أفريقيا'],
    nameFr: "Fustat, Roda et le Vieux-Caire",
    descriptionFr: "Des palais du Nil et du nilomètre abbasside de l'île de Roda jusqu'à Fustat, la première capitale islamique de l'Égypte",
    highlightsFr: ["Le nilomètre abbasside (861)", "Les momies royales au NMEC", "La plus ancienne mosquée d'Afrique"],
    nameEs: 'Fustat, Roda y El Cairo Viejo',
    descriptionEs: 'De los palacios del Nilo y el nilómetro abasí de la isla de Roda a Fustat, la primera capital islámica de Egipto',
    highlightsEs: ['Nilómetro abasí (861 d. C.)', 'Momias reales en el NMEC', 'La mezquita más antigua de África'],
    distanceKm: 7,
    hoursMin: 3.5,
    hoursMax: 4.5,
    distance: '7 km',
    duration: '3.5-4.5 hours'
  }
];

export const categories = [
  { id: 'monument', nameEn: 'Monuments & Historic', nameAr: 'آثار ومباني تاريخية', nameFr: 'Monuments et patrimoine', nameEs: 'Monumentos y patrimonio', color: 'bg-nile', icon: 'Landmark' },
  { id: 'coffee', nameEn: 'Coffee Shops', nameAr: 'مقاهي', nameFr: 'Cafés', nameEs: 'Cafés', color: 'bg-stone-500', icon: 'Coffee' },
  { id: 'restaurant', nameEn: 'Restaurants & Food', nameAr: 'مطاعم وغذاء', nameFr: 'Restaurants et cuisine', nameEs: 'Restaurantes y comida', color: 'bg-gold', icon: 'Utensils' },
  { id: 'workshop', nameEn: 'Workshops & Handicrafts', nameAr: 'ورش ومنتجات يدوية', nameFr: 'Ateliers et artisanat', nameEs: 'Talleres y artesanía', color: 'bg-stone-600', icon: 'Hammer' },
  { id: 'stationary', nameEn: 'Stationery & Toys', nameAr: 'خردوات ومكتبات', nameFr: 'Papeteries et jouets', nameEs: 'Papelerías y juguetes', color: 'bg-stone-400', icon: 'BookOpen' },
  { id: 'meeting', nameEn: 'Meeting Points', nameAr: 'نقاط التجمع', nameFr: 'Points de rendez-vous', nameEs: 'Puntos de encuentro', color: 'bg-nile-light', icon: 'Users' },
];

export const locations: Location[] = [
  // Ahl al-Bayt Route
  { 
    id: 1, 
    routeId: 'ahl-al-bayt', 
    nameEn: 'Ahmad Ibn Tulun Mosque', 
    nameAr: 'جامع أحمد بن طولون', 
    category: 'monument', 
    lat: 30.02871, 
    lng: 31.25024, 
    descriptionEn: 'The oldest mosque in Cairo in its original form, and the largest in terms of land area. Famous for its unique spiral minaret, inspired by the Mosque of Samarra.',
    descriptionAr: 'أقدم مساجد القاهرة التي بقيت على حالتها الأصلية، وأكبرها مساحة. يشتهر بمئذنته الملوية الفريدة المستوحاة من ملوية سامراء.'
  },
  { id: 2, routeId: 'ahl-al-bayt', nameEn: 'Sarghatmish Mosque', nameAr: 'جامع صرغتمش', category: 'monument', lat: 30.0294, lng: 31.2490, descriptionEn: 'A stunning Mamluk-era complex featuring a mosque, madrasa, and mausoleum with an architectural style dominated by a large dome.', descriptionAr: 'مجمع مملوكي رائع يضم مسجداً ومدرسة وضريحاً، يتميز بطرازه المعماري الذي تهيمن عليه قبة ضخمة.' },
  { id: 3, routeId: 'ahl-al-bayt', nameEn: 'Bayt Al-Kritliyya (Gayer-Anderson Museum)', nameAr: 'بيت الكريتلية', category: 'monument', lat: 30.0283, lng: 31.2498, descriptionEn: 'Two historic houses joined by a bridge, housing a vast collection of oriental and egyptian artifacts collected by Major Gayer-Anderson.', descriptionAr: 'منزلان تاريخيان يربطهما جسر، يضمان مجموعة واسعة من القطع الأثرية الشرقية والمصرية التي جمعها الميجور جاير أندرسون.' },
  { id: 4, routeId: 'ahl-al-bayt', nameEn: 'Sidi al-Basha Mosque', nameAr: 'مسجد سيدي الباشا', category: 'monument', lat: 30.0275, lng: 31.2505, descriptionEn: 'A quaint historic mosque reflecting the rich spirituality of the Al-Ashraf street.', descriptionAr: 'مسجد تاريخي جذاب يعكس الروحانية الغنية لشارع الأشراف.' },
  { id: 5, routeId: 'ahl-al-bayt', nameEn: 'Muhammad al-Ayyashi Mausoleum', nameAr: 'ضريح محمد العياشي', category: 'monument', lat: 30.0268, lng: 31.2510, descriptionEn: 'A minor yet beautiful mausoleum dedicated to Muhammad al-Ayyashi.', descriptionAr: 'مقام صغير ولكنه جميل مخصص لمحمد العياشي.' },
  { id: 6, routeId: 'ahl-al-bayt', nameEn: 'Sakna Basha House', nameAr: 'منزل سكنة باشا', category: 'monument', lat: 30.0260, lng: 31.2515, descriptionEn: 'An example of domestic architecture from the Ottoman era in Cairo.', descriptionAr: 'نموذج للعمارة السكنية من العصر العثماني في القاهرة.' },
  { id: 7, routeId: 'ahl-al-bayt', nameEn: 'Muhammad al-Anwar Mausoleum', nameAr: 'مقام سيدي الأنور', category: 'monument', lat: 30.0255, lng: 31.2520, descriptionEn: 'Resting place of Sidi Al-Anwar, attracting visitors seeking blessings.', descriptionAr: 'مثوى سيدي الأنور، يتردد عليه الزوار للتبرك.' },
  { id: 8, routeId: 'ahl-al-bayt', nameEn: 'Al-Sayyida Sukayna Mosque', nameAr: 'مسجد السيدة سكينة', category: 'monument', lat: 30.02684, lng: 31.25211, descriptionEn: 'A prominent shrine dedicated to Sayyida Sukayna, a significant figure in Islamic history.', descriptionAr: 'مقام بارز مخصص للسيدة سكينة، وهي شخصية مهمة في التاريخ الإسلامي.' },
  { id: 9, routeId: 'ahl-al-bayt', nameEn: 'Shajar al-Durr Mausoleum', nameAr: 'قبة شجر الدر', category: 'monument', lat: 30.02592, lng: 31.25215, descriptionEn: 'The beautiful domed tomb of the remarkable Queen Shajar al-Durr.', descriptionAr: 'ضريح مقبب جميل للملكة الاستثنائية شجر الدر.' },
  { id: 10, routeId: 'ahl-al-bayt', nameEn: 'Al-Jafari and Atika Mausoleum', nameAr: 'مقام الجعفري والسيدة عاتكة', category: 'monument', lat: 30.0235, lng: 31.2535, descriptionEn: 'Double mausoleum commemorating two revered historical figures.', descriptionAr: 'ضريح مزدوج يحيي ذكرى شخصيتين تاريخيتين مبجلتين.' },
  { id: 11, routeId: 'ahl-al-bayt', nameEn: 'Al-Sayyida Ruqayya Mausoleum', nameAr: 'مقام السيدة رقية', category: 'monument', lat: 30.0228, lng: 31.2540, descriptionEn: 'A Fatimid-era shrine famous for its intricately carved stucco mihrab.', descriptionAr: 'مقام من العصر الفاطمي يشتهر بمحرابه الجصي المنحوت بدقة.' },
  { id: 12, routeId: 'ahl-al-bayt', nameEn: 'Ibn Sirin + Al-Balasi Mausoleum', nameAr: 'مقام ابن سيرين', category: 'monument', lat: 30.0220, lng: 31.2545, descriptionEn: 'A spiritual site located along the path connecting major Ahl Al-Bayt landmarks.', descriptionAr: 'موقع روحي يقع على طول المسار الذي يربط بين المعالم الرئيسية لآل البيت.' },
  { id: 13, routeId: 'ahl-al-bayt', nameEn: 'Fatima Khatun Mausoleum', nameAr: 'قبة فاطمة خاتون', category: 'monument', lat: 30.0215, lng: 31.2550, descriptionEn: 'An imposing Mamluk mausoleum known for its distinctive ribbed dome.', descriptionAr: 'ضريح مملوكي مهيب يُعرف بقبته المضلعة المميزة.' },
  { id: 14, routeId: 'ahl-al-bayt', nameEn: 'Al-Ashraf Khalil Mausoleum', nameAr: 'قبة الأشرف خليل', category: 'monument', lat: 30.02397, lng: 31.25211, descriptionEn: 'The mausoleum of Sultan Al-Ashraf Khalil, famous for expelling the Crusaders from Acre.', descriptionAr: 'ضريح السلطان الأشرف خليل، الذي اشتهر بطرد الصليبيين من عكا.' },
  { id: 15, routeId: 'ahl-al-bayt', nameEn: 'Sabil Al-Yazji', nameAr: 'سبيل اليازجي', category: 'monument', lat: 30.0200, lng: 31.2560, descriptionEn: 'A historic public water fountain providing free water to wayfarers.', descriptionAr: 'سبيل تاريخي كان يوفر مياه الشرب المجانية للمارة.' },
  { id: 16, routeId: 'ahl-al-bayt', nameEn: 'Al-Sayyida Nafisa Mosque', nameAr: 'جامع السيدة نفيسة', category: 'monument', lat: 30.02233, lng: 31.25242, descriptionEn: 'A highly venerated shrine dedicated to Sayyida Nafisa, a great-granddaughter of Imam Hasan.', descriptionAr: 'مقام يحظى بتبجيل كبير مخصص للسيدة نفيسة العظيمة.' },
  { id: 17, routeId: 'ahl-al-bayt', nameEn: 'Mohamed Beh Al-Marawy Mausoleum', nameAr: 'ضريح محمد بيه المرعوي', category: 'monument', lat: 30.0188, lng: 31.2570, descriptionEn: 'A unique nineteenth-century burial structure standing gracefully near the Sayyida Nafisa square.', descriptionAr: 'هيكل دفن فريد من القرن التاسع عشر يقف برشاقة بالقرب من ميدان السيدة نفيسة.' },
  { id: 18, routeId: 'ahl-al-bayt', nameEn: 'Sabil - Kuttab Mustafa Bak Tabtaby', nameAr: 'سبيل - مكتب مصطفى بك طبطباي', category: 'monument', lat: 30.0180, lng: 31.2575, descriptionEn: 'A combined water dispensary and elementary Quranic school foundation.', descriptionAr: 'مؤسسة خيرية تجمع بين سبيل للمياه وكتاب لتعليم القرآن.' },
  { id: 19, routeId: 'ahl-al-bayt', nameEn: 'Ahmad Kuhya Mosque', nameAr: 'مسجد أحمد كوهيه', category: 'monument', lat: 30.0175, lng: 31.2580, descriptionEn: 'An elegant mosque displaying intricate stonework and peaceful ambiance.', descriptionAr: 'مسجد أنيق يعرض أعمالاً حجرية دقيقة ويتمتع بأجواء هادئة.' },
  { id: 20, routeId: 'ahl-al-bayt', nameEn: 'Safiyy al-Din Jawhar Mausoleum', nameAr: 'قبة سيدة الدين جوهر', category: 'monument', lat: 30.0168, lng: 31.2585, descriptionEn: 'A lesser-known but architecturally significant tomb closing the Ahl Al-Bayt route.', descriptionAr: 'ضريح أقل شهرة ولكنه ذو أهمية معمارية في نهاية المسار.' },
  
  // Additional locations from the map legend
  { id: 21, routeId: 'ahl-al-bayt', nameEn: 'Al-Fakahany', nameAr: 'الفكهاني', category: 'restaurant', lat: 30.0250, lng: 31.2510, descriptionEn: 'A traditional local fruit vendor and juice shop offering refreshing seasonal drinks.', descriptionAr: 'بائع فواكه محلي تقليدي ومتجر عصائر يقدم مشروبات موسمية منعشة.' },
  { id: 22, routeId: 'ahl-al-bayt', nameEn: 'Ibn Tulun Pie Shop', nameAr: 'فطاطري ابن طولون', category: 'restaurant', lat: 30.0280, lng: 31.2490, descriptionEn: 'Famous local eatery serving authentic Egyptian fiteer (flaky pastry) near the great mosque.', descriptionAr: 'مطعم محلي شهير يقدم الفطير المصري الأصيل بالقرب من المسجد الكبير.' },
  { id: 23, routeId: 'ahl-al-bayt', nameEn: 'Am Mostafa Roastery', nameAr: 'مقلة عم مصطفى', category: 'restaurant', lat: 30.0260, lng: 31.2500, descriptionEn: 'A classic roastery offering freshly roasted nuts, seeds, and local snacks.', descriptionAr: 'محمصة كلاسيكية تقدم المكسرات والبذور المحمصة الطازجة والوجبات الخفيفة المحلية.' },
  { id: 24, routeId: 'ahl-al-bayt', nameEn: 'Sayyida Nafisa Roastery', nameAr: 'مقلة السيدة نفيسة', category: 'restaurant', lat: 30.0190, lng: 31.2560, descriptionEn: 'A beloved neighborhood roastery providing warm nuts and treats for pilgrims and locals.', descriptionAr: 'محمصة محبوبة في الحي توفر المكسرات الدافئة والحلويات للحجاج والمحليين.' },
  { id: 25, routeId: 'ahl-al-bayt', nameEn: 'Abou Amr Restaurant', nameAr: 'مطعم عبده أبو عمرو', category: 'restaurant', lat: 30.0220, lng: 31.2530, descriptionEn: 'A traditional spot for hearty Egyptian street food staples like foul and taameya.', descriptionAr: 'مكان تقليدي للأطعمة المصرية الشعبية الأساسية مثل الفول والطعمية.' },
  { id: 26, routeId: 'ahl-al-bayt', nameEn: 'Al-Omdah Dairy', nameAr: 'ألبان العمدة', category: 'restaurant', lat: 30.0210, lng: 31.2540, descriptionEn: 'A local dairy shop known for fresh milk, yogurt, and creamy homemade rice pudding.', descriptionAr: 'متجر ألبان محلي يُعرف بالحليب الطازج والزبادي والأرز باللبن المنزلي.' },
  
  { id: 27, routeId: 'ahl-al-bayt', nameEn: 'Sayed Qasim Grocery', nameAr: 'بقالة سيد قاسم', category: 'stationary', lat: 30.0270, lng: 31.2500, descriptionEn: 'A vintage neighborhood grocery store that has served the community for decades.', descriptionAr: 'بقالة حي قديمة خدمت المجتمع لعقود.' },
  { id: 28, routeId: 'ahl-al-bayt', nameEn: 'Nourhan Bazaar', nameAr: 'بازار نورهان', category: 'stationary', lat: 30.0240, lng: 31.2520, descriptionEn: 'A small bazaar selling Islamic souvenirs, incenses, and traditional crafts.', descriptionAr: 'بازار صغير يبيع الهدايا التذكارية الإسلامية والبخور والحرف التقليدية.' },
  
  { id: 29, routeId: 'ahl-al-bayt', nameEn: 'Islamic Furniture', nameAr: 'موبيليا إسلامي', category: 'workshop', lat: 30.0230, lng: 31.2530, descriptionEn: 'A specialized workshop crafting intricate woodwork and arabesque furniture.', descriptionAr: 'ورشة متخصصة في صناعة المشغولات الخشبية الدقيقة والأثاث الأرابيسك.' },
  { id: 30, routeId: 'ahl-al-bayt', nameEn: 'Ramadan Beans Workshop', nameAr: 'ورشة فوانيس رمضان', category: 'workshop', lat: 30.0200, lng: 31.2550, descriptionEn: 'A seasonal workshop that traditionally crafts beautiful Ramadan lanterns.', descriptionAr: 'ورشة موسمية تصنع فوانيس رمضان الجميلة تقليدياً.' },
  
  { id: 31, routeId: 'ahl-al-bayt', nameEn: 'Captain Sherif Cafe', nameAr: 'قهوة كابتن شريف', category: 'coffee', lat: 30.0285, lng: 31.2485, descriptionEn: 'A lively local ahwa (cafe) where residents gather for tea, shisha, and backgammon.', descriptionAr: 'مقهى محلي حيوي حيث يتجمع السكان لتناول الشاي والشيشة ولعب الطاولة.' },
  { id: 32, routeId: 'ahl-al-bayt', nameEn: 'Sayyida Sakina Cafe', nameAr: 'قهوة السيدة سكينة', category: 'coffee', lat: 30.0245, lng: 31.2520, descriptionEn: 'A resting spot situated near the shrine for visitors to enjoy strong Turkish coffee.', descriptionAr: 'استراحة تقع بالقرب من الضريح للزوار للاستمتاع بالقهوة التركية القوية.' },
  { id: 33, routeId: 'ahl-al-bayt', nameEn: 'Om Mostafa Cafe', nameAr: 'قهوة أم مصطفى', category: 'coffee', lat: 30.0215, lng: 31.2545, descriptionEn: 'A welcoming traditional street cafe offering a glimpse into everyday Cairo street life.', descriptionAr: 'مقهى شارع تقليدي ترحيبي يقدم لمحة عن الحياة اليومية في شوارع القاهرة.' },
  
  { id: 34, routeId: 'ahl-al-bayt', nameEn: 'Ibn Tulun Square', nameAr: 'ميدان ابن طولون', category: 'meeting', lat: 30.02984, lng: 31.24995, descriptionEn: 'The expansive gathering space in front of the Ibn Tulun Mosque.', descriptionAr: 'مساحة التجمع الواسعة أمام مسجد ابن طولون.' },
  { id: 35, routeId: 'ahl-al-bayt', nameEn: 'Sayyida Nafisa Square', nameAr: 'ميدان السيدة نفيسة', category: 'meeting', lat: 30.02247, lng: 31.25144, descriptionEn: 'A bustling square functioning as a nexus for religious pilgrims and local commerce.', descriptionAr: 'ساحة مزدحمة تعمل كحلقة وصل للحجاج الدينيين والتجارة المحلية.' },

  // Al-Muizz Street Route
  { 
    id: 101, 
    routeId: 'al-muizz', 
    nameEn: 'Bab al-Futuh', 
    nameAr: 'باب الفتوح', 
    category: 'monument', 
    lat: 30.0545, 
    lng: 31.2630, 
    descriptionEn: 'One of the three remaining city gates of Fatimid Cairo. It was built as part of the new fortification wall.',
    descriptionAr: 'أحد الأبواب الثلاثة المتبقية من أسوار القاهرة الفاطمية، بني كجزء من جبهة التحصينات الدفاعية للمدينة.'
  },
  { id: 102, routeId: 'al-muizz', nameEn: 'Al-Hakim Mosque', nameAr: 'جامع الحاكم بأمر الله', category: 'monument', lat: 30.05451, lng: 31.26434, descriptionEn: 'A major Fatimid mosque known for its unique minarets and vast courtyard, named after Caliph Al-Hakim bi-Amr Allah.', descriptionAr: 'ثاني أكبر مساجد القاهرة اتساعاً، بناه الخليفة الفاطمي الحاكم بأمر الله ويتميز بمئذنتيه الفريدتين.' },
  { id: 103, routeId: 'al-muizz', nameEn: 'Al-Aqmar Mosque', nameAr: 'الجامع الأقمر', category: 'monument', lat: 30.0515, lng: 31.2615, descriptionEn: 'A small but highly significant Fatimid mosque, famous for being the first mosque in Cairo to have an elaborately decorated stone facade.', descriptionAr: 'مسجد فاطمي صغير لكنه في غاية الأهمية، يشتهر بكونه أول مسجد في القاهرة بواجهة حجرية مزخرفة بالكامل.' },
  { id: 104, routeId: 'al-muizz', nameEn: 'Qalawun Complex', nameAr: 'مجموعة قلاوون', category: 'monument', lat: 30.0498, lng: 31.2611, descriptionEn: 'A massive complex built by Sultan Qalawun, including a mosque, a madrasa, a hospital (bimaristan), and a spectacular mausoleum.', descriptionAr: 'مجموعة معمارية ضخمة بناها السلطان قلاوون، تضم مسجداً ومدرسة وبيمارستان (مستشفى) وضريحاً فائق الروعة.' },
  { id: 105, routeId: 'al-muizz', nameEn: 'Barquq Mosque', nameAr: 'مسجد ومدرسة برقوق', category: 'monument', lat: 30.0505, lng: 31.2613, descriptionEn: 'The first major architectural commission of the Circassian Mamluk dynasty, featuring a stunning bronze-plated door and marble panels.', descriptionAr: 'أول منشأة معمارية كبرى لدولة المماليك الجراكسة، تتميز ببابها المكسو بالنحاس ولوحاتها الرخامية الرائعة.' },
  { id: 106, routeId: 'al-muizz', nameEn: 'Al-Ghuri Complex', nameAr: 'مجموعة الغوري', category: 'monument', lat: 30.0460, lng: 31.2595, descriptionEn: 'A monumental Mamluk complex straddling both sides of Al-Muizz street, consisting of a mosque, madrasa, wikala, and mausoleum.', descriptionAr: 'مجموعة مملوكية ضخمة تمتد على جانبي شارع المعز، وتتكون من مسجد ومدرسة ووكالة وضريح.' },

  { id: 107, routeId: 'al-muizz', nameEn: 'Bab Zuweila', nameAr: 'باب زويلة', category: 'monument', lat: 30.0425, lng: 31.2585, descriptionEn: 'The southern gate of the walls of Fatimid Cairo, famous for its twin minarets that offer panoramic views of the historic city.', descriptionAr: 'البوابة الجنوبية لأسوار القاهرة الفاطمية، تشتهر بمئذنتيها التوأمين اللتين توفران إطلالات بانورامية على المدينة التاريخية.' },
  { id: 108, routeId: 'al-muizz', nameEn: 'Khan el-Khalili', nameAr: 'خان الخليلي', category: 'workshop', lat: 30.0475, lng: 31.2620, descriptionEn: 'The famous historic bazaar of Cairo, filled with colorful lanterns, spices, jewelry, and traditional crafts.', descriptionAr: 'البازار التاريخي الشهير في القاهرة، المليء بالفوانيس الملونة والتوابل والمجوهرات والحرف التقليدية.' },
  { id: 109, routeId: 'al-muizz', nameEn: 'El Fishawy Cafe', nameAr: 'مقهى الفيشاوي', category: 'coffee', lat: 30.0478, lng: 31.2625, descriptionEn: 'One of Cairo\'s oldest cafes, famously frequented by writers like Naguib Mahfouz.', descriptionAr: 'أحد أقدم مقاهي القاهرة، يشتهر بكونه ملتقى للروائيين مثل نجيب محفوظ.' },
  { id: 110, routeId: 'al-muizz', nameEn: 'Naguib Mahfouz Cafe', nameAr: 'مقهى نجيب محفوظ', category: 'restaurant', lat: 30.0472, lng: 31.2618, descriptionEn: 'A high-end historic cafe named after the Nobel laureate, serving traditional Egyptian food and drinks.', descriptionAr: 'مقهى تاريخي راقٍ يحمل اسم الحائز على جائزة نوبل، ويقدم المأكولات والمشروبات المصرية التقليدية.' },
  { id: 111, routeId: 'al-muizz', nameEn: 'Copper Workshops', nameAr: 'ورش النحاسين', category: 'workshop', lat: 30.0510, lng: 31.2615, descriptionEn: 'Historic district dedicated to coppersmiths crafting intricate plates, lanterns, and household items.', descriptionAr: 'منطقة تاريخية مخصصة للعمال في صناعة النحاس لإنتاج الأطباق المعقدة والفوانيس.' },
  { id: 112, routeId: 'al-muizz', nameEn: 'Tentmakers Market', nameAr: 'سوق الخيامية', category: 'workshop', lat: 30.0415, lng: 31.2580, descriptionEn: 'The historic Street of the Tentmakers, famous for its colorful applique textile art called Khayamiya.', descriptionAr: 'شارع صناع الخيام التاريخي، المشهور بفن النسيج والتطريز الملون المسمى بالخيامية.' },
  { id: 113, routeId: 'al-muizz', nameEn: 'Al-Hussein Square', nameAr: 'ميدان الحسين', category: 'meeting', lat: 30.0480, lng: 31.2635, descriptionEn: 'A vibrant public square situated between Al-Azhar and Al-Hussein Mosques, forming the spiritual heart of the area.', descriptionAr: 'ساحة عامة نابضة بالحياة تقع بين مسجدي الأزهر والحسين، وتشكل القلب الروحي للمنطقة.' },

  // Coptic Cairo Route
  { 
    id: 201, 
    routeId: 'coptic-cairo', 
    nameEn: 'The Hanging Church', 
    nameAr: 'الكنيسة المعلقة', 
    category: 'monument', 
    lat: 30.0053, 
    lng: 31.2302, 
    descriptionEn: 'One of the oldest churches in Egypt, named for its location above a gatehouse of Babylon Fortress.',
    descriptionAr: 'واحدة من أقدم الكنائس في مصر، وسميت "المعلقة" لأنها بنيت فوق برجين من أبراج حصن بابليون الروماني.'
  },
  { id: 203, routeId: 'coptic-cairo', nameEn: 'Ben Ezra Synagogue', nameAr: 'معبد بن عزرا', category: 'monument', lat: 30.0060, lng: 31.2305, descriptionEn: 'Located on the site where baby Moses was allegedly found, it is the oldest Jewish temple in Cairo, famous for the Cairo Geniza documents.', descriptionAr: 'يقع في الموقع الذي يقال إنه عثر فيه على النبي موسى رضيعاً، وهو أقدم معبد يهودي في القاهرة، مشهور بوثائق جنيزة القاهرة.' },
  { id: 204, routeId: 'coptic-cairo', nameEn: 'Coptic Museum', nameAr: 'المتحف القبطي', category: 'monument', lat: 30.0058, lng: 31.2300, descriptionEn: 'Houses the worlds largest collection of Coptic Christian artwork and artifacts, bridging ancient Egyptian and Islamic art.', descriptionAr: 'يضم أكبر مجموعة في العالم من الفنون والقطع الأثرية المسيحية القبطية، ويشكل جسراً بين الفن المصري القديم والإسلامي.' },
  { id: 205, routeId: 'coptic-cairo', nameEn: 'Church of St. George', nameAr: 'كنيسة مارجرجس', category: 'monument', lat: 30.0055, lng: 31.2301, descriptionEn: 'A unique Greek Orthodox rotunda church built atop an ancient Roman tower of the Babylon Fortress.', descriptionAr: 'كنيسة أرثوذكسية يونانية فريدة من نوعها مبنية على طراز هندسي دائري فوق أحد أبراج حصن بابليون الروماني القديم.' },

  // Al-Darb Al-Ahmar & Citadel Route
  { 
    id: 301, 
    routeId: 'darb-al-ahmar', 
    nameEn: 'Salah El-Din Citadel', 
    nameAr: 'قلعة صلاح الدين الأيوبي', 
    category: 'monument', 
    lat: 30.0299, 
    lng: 31.2611, 
    descriptionEn: 'A medieval Islamic fortification on Mokattam hill, served as the seat of government in Egypt for 700 years.',
    descriptionAr: 'حصن إسلامي من العصور الوسطى على تلة المقطم، كانت مقراً للحكم في مصر لمدة 700 عام.'
  },
  { id: 302, routeId: 'darb-al-ahmar', nameEn: 'Mosque of Muhammad Ali', nameAr: 'جامع محمد علي', category: 'monument', lat: 30.0287, lng: 31.2599, descriptionEn: 'Known as the Alabaster Mosque due to its marble cladding, this Ottoman-style landmark dominates Cairo\'s skyline.', descriptionAr: 'يُعرف بالأبهى أو بمسجد الألبستر نظراً لكسوته المرمرية، وهو معلم عثماني الطراز يهيمن على أفق مدينة القاهرة.' },
  { id: 303, routeId: 'darb-al-ahmar', nameEn: 'Sultan Hassan Mosque', nameAr: 'مسجد ومدرسة السلطان حسن', category: 'monument', lat: 30.0322, lng: 31.2567, descriptionEn: 'A massive Mamluk-era mosque and madrasa known for its architectural grandeur and status as a masterpiece of Islamic art.', descriptionAr: 'مسجد ومدرسة مملوكية ضخمة تشتهر بعظمتها المعمارية ومكانتها كتحفة للفن الإسلامي.' },
  { id: 304, routeId: 'darb-al-ahmar', nameEn: 'Al-Rifa\'i Mosque', nameAr: 'مسجد الرفاعي', category: 'monument', lat: 30.0325, lng: 31.2575, descriptionEn: 'Located opposite Sultan Hassan Mosque, it serves as the royal mausoleum for the Muhammad Ali dynasty and the last Shah of Iran.', descriptionAr: 'يقع مقابل مسجد السلطان حسن، ويعد ضريحاً ملكياً لأسرة محمد علي، كما يضم قبر شاه إيران الأخير.' },
  { id: 305, routeId: 'darb-al-ahmar', nameEn: 'Aqsunqur (Blue) Mosque', nameAr: 'الجامع الأزرق (آق سنقر)', category: 'monument', lat: 30.0361, lng: 31.2600, descriptionEn: 'Famous for its interior decorated with blue Iznik tiles, added during an Ottoman restoration in the 17th century.', descriptionAr: 'مشهور بتصميمه الداخلي المزين بالبلاط القاشاني الأزرق، الذي أضيف خلال ترميم عثماني في القرن السابع عشر.' },
  { id: 306, routeId: 'darb-al-ahmar', nameEn: 'Al-Azhar Park', nameAr: 'حديقة الأزهر', category: 'meeting', lat: 30.0400, lng: 31.2644, descriptionEn: 'A lush oasis created on a former landfill, offering breathtaking panoramic views of Historic Cairo and the Citadel.', descriptionAr: 'واحة خضراء أقيمت على موقع كان مقلباً للمخلفات، توفر إطلالات بانورامية خلابة على القاهرة التاريخية والقلعة.' },
  { id: 307, routeId: 'darb-al-ahmar', nameEn: 'Al Darb Al Ahmar Arts School', nameAr: 'مدرسة الدرب الأحمر للفنون', category: 'workshop', lat: 30.0415, lng: 31.2620, descriptionEn: 'A vibrant community arts school teaching circus arts, music, and performing arts to local youths.', descriptionAr: 'مدرسة فنون مجتمعية نابضة بالحياة، تُعلّم فنون السيرك والموسيقى والفنون المسرحية لشباب المنطقة.' },
  { id: 308, routeId: 'darb-al-ahmar', nameEn: 'Al-Azhar Park Restaurants', nameAr: 'مطاعم حديقة الأزهر', category: 'restaurant', lat: 30.0410, lng: 31.2640, descriptionEn: 'High-end dining venues located inside the park offering lakeside views and traditional Egyptian cuisine.', descriptionAr: 'أماكن لتناول الطعام الفاخر تقع داخل الحديقة وتقدم إطلالات على البحيرة والمأكولات المصرية التقليدية.' },
  { id: 309, routeId: 'darb-al-ahmar', nameEn: 'Bab al-Wazir Street', nameAr: 'شارع باب الوزير', category: 'monument', lat: 30.0375, lng: 31.2595, descriptionEn: 'A historic street lined with Mamluk monuments, linking the Citadel approach to the heart of Darb Al-Ahmar.', descriptionAr: 'شارع تاريخي يعج بالآثار المملوكية، يربط الطريق المؤدي للقلعة بقلب منطقة الدرب الأحمر.' },

  // Fustat, Roda & Old Cairo Route
  { id: 401, routeId: 'fustat-roda', nameEn: 'Fumm al-Khalig Aqueduct Tower', nameAr: 'برج مأخذ مياه فم الخليج', category: 'monument', lat: 30.02212, lng: 31.23031, descriptionEn: "The great hexagonal intake tower of Cairo's medieval aqueduct, built under Sultan al-Ghuri in the early 16th century. Ox-driven waterwheels on its roof lifted Nile water into the aqueduct that carried it east to the Citadel.", descriptionAr: 'برج المأخذ السداسي الضخم لسور مجرى العيون، شُيّد في عهد السلطان الغوري في مطلع القرن السادس عشر. كانت السواقي التي تديرها الثيران فوق سطحه ترفع مياه النيل إلى المجرى الذي يحملها شرقاً حتى القلعة.' },
  { id: 402, routeId: 'fustat-roda', nameEn: 'Manial Palace', nameAr: 'قصر الأمير محمد علي بالمنيل', category: 'monument', lat: 30.02742, lng: 31.22905, descriptionEn: 'Built between 1899 and 1929 for Prince Mohamed Ali Tewfik, uncle of King Farouk. Its halls blend Ottoman, Moorish, Persian and European styles, set in gardens of rare trees the prince collected himself.', descriptionAr: 'شُيّد بين عامي ١٨٩٩ و١٩٢٩ للأمير محمد علي توفيق، عم الملك فاروق. تمزج قاعاته بين الطرز العثمانية والأندلسية والفارسية والأوروبية، وتحيط به حدائق من الأشجار النادرة التي جمعها الأمير بنفسه.' },
  { id: 403, routeId: 'fustat-roda', nameEn: 'Manasterly Palace & Umm Kulthum Museum', nameAr: 'قصر المانسترلي ومتحف أم كلثوم', category: 'monument', lat: 30.00762, lng: 31.22488, descriptionEn: "A mid-19th-century palace at the southern tip of Roda Island, built for Hassan Fouad al-Manasterly, a governor of Cairo. Its grounds hold a museum to Umm Kulthum, the 'Star of the East', with her famous sunglasses, scarves and recordings.", descriptionAr: 'قصر من منتصف القرن التاسع عشر عند الطرف الجنوبي لجزيرة الروضة، بُني لحسن فؤاد المانسترلي أحد حكام القاهرة. وفي حديقته متحف لأم كلثوم «كوكب الشرق» يضم نظاراتها ومناديلها الشهيرة وتسجيلاتها.' },
  { id: 404, routeId: 'fustat-roda', nameEn: 'Nilometer of Roda', nameAr: 'مقياس النيل بالروضة', category: 'monument', lat: 30.00693, lng: 31.22500, descriptionEn: "Built in 861 AD under the Abbasid caliph al-Mutawakkil, one of the oldest Islamic monuments in Cairo. A marked marble column in a deep stone well measured the Nile's annual flood, which decided the year's harvest and taxes.", descriptionAr: 'بُني عام ٨٦١م في عهد الخليفة العباسي المتوكل، وهو من أقدم الآثار الإسلامية في القاهرة. كان عمود رخامي مدرّج داخل بئر حجرية عميقة يقيس فيضان النيل السنوي الذي يحدد محصول العام وضرائبه.' },
  { id: 405, routeId: 'fustat-roda', nameEn: 'Manasterly Bridge', nameAr: 'كوبري المانسترلي', category: 'meeting', lat: 30.00957, lng: 31.22600, descriptionEn: 'The footbridge linking the southern tip of Roda Island to Old Cairo: an easy place to meet between the Nilometer and the churches and mosques of Fustat.', descriptionAr: 'كوبري المشاة الذي يربط الطرف الجنوبي لجزيرة الروضة بمصر القديمة، ومكان مناسب للقاء بين مقياس النيل وكنائس الفسطاط ومساجدها.' },
  { id: 406, routeId: 'fustat-roda', nameEn: 'Monastery of Saint Mercurius (Abu Seifein)', nameAr: 'دير أبي سيفين (القديس مرقوريوس)', category: 'monument', lat: 30.01251, lng: 31.23084, descriptionEn: "A walled monastery whose main church honours Saint Mercurius, called Abu Seifein, 'the one with two swords'. Rebuilt in the 12th century after a great fire, it was for a time the seat of the Coptic patriarchs.", descriptionAr: 'دير مسوّر تحمل كنيسته الكبرى اسم القديس مرقوريوس الملقب بأبي سيفين. أُعيد بناؤها في القرن الثاني عشر بعد حريق كبير، وكانت لفترة مقراً لبطاركة الأقباط.' },
  { id: 202, routeId: 'fustat-roda', nameEn: 'Amr Ibn Al-Aas Mosque', nameAr: 'جامع عمرو بن العاص', category: 'monument', lat: 30.0086, lng: 31.2327, descriptionEn: 'The first mosque built in Egypt and Africa (641 AD), standing as a symbol of early Islamic architecture and history.', descriptionAr: 'أول مسجد بني في مصر وأفريقيا (641م)، ويقف كرمز للعمارة والتاريخ الإسلامي المبكر.' },
  { id: 206, routeId: 'fustat-roda', nameEn: 'Fustat Pottery Village', nameAr: 'قرية الفخار بالفسطاط', category: 'workshop', lat: 30.0090, lng: 31.2350, descriptionEn: 'A bustling area dedicated to the age-old craft of pottery making, producing various clay wares.', descriptionAr: 'منطقة تعج بحركة صناعة الفخار القديمة، وتنتج مختلف الأواني الخزفية.' },
  { id: 207, routeId: 'fustat-roda', nameEn: 'Fustat Park', nameAr: 'حديقة الفسطاط', category: 'meeting', lat: 30.0120, lng: 31.2380, descriptionEn: 'A vast green park built on the ruins of Fustat, the first capital of Egypt under Islamic rule.', descriptionAr: 'حديقة خضراء شاسعة مبنية على أنقاض الفسطاط، أول عاصمة لمصر تحت الحكم الإسلامي.' },
  { id: 407, routeId: 'fustat-roda', nameEn: 'National Museum of Egyptian Civilization', nameAr: 'المتحف القومي للحضارة المصرية', category: 'monument', lat: 30.00760, lng: 31.24836, descriptionEn: "Opened on the site of ancient Fustat, overlooking Ain al-Sira lake. Since 2021 it has housed the Royal Mummies, moved from Tahrir in the Pharaohs' Golden Parade, alongside galleries spanning Egypt from prehistory to today.", descriptionAr: 'أُقيم على أرض الفسطاط القديمة مطلاً على بحيرة عين الصيرة. ومنذ عام ٢٠٢١ يضم المومياوات الملكية التي نُقلت من التحرير في موكب المومياوات الذهبي، إلى جانب قاعات تروي تاريخ مصر من عصور ما قبل التاريخ حتى اليوم.' },
];
