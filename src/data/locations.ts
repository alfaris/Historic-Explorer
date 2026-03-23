export type Category = 'monument' | 'coffee' | 'restaurant' | 'workshop' | 'stationary' | 'meeting';

export interface Route {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  image: string;
}

export interface Location {
  id: number;
  routeId: string;
  nameEn: string;
  nameAr: string;
  category: Category;
  descriptionEn?: string;
  descriptionAr?: string;
  lat: number;
  lng: number;
  image?: string;
}

export const routes: Route[] = [
  {
    id: 'ahl-al-bayt',
    nameEn: 'Ahl al-Bayt Route',
    nameAr: 'مسار آل البيت',
    descriptionEn: 'A journey through history and spirituality in the heart of Cairo',
    descriptionAr: 'رحلة عبر التاريخ والروحانية في قلب القاهرة',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Ibn_Tulun_Mosque_Courtyard.jpg/800px-Ibn_Tulun_Mosque_Courtyard.jpg'
  },
  {
    id: 'al-muizz',
    nameEn: 'Al-Muizz Street Route',
    nameAr: 'مسار شارع المعز',
    descriptionEn: 'The greatest concentration of medieval architectural treasures in the Islamic world',
    descriptionAr: 'أكبر تجمع للكنوز المعمارية في العالم الإسلامي',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Qalawun_Complex_Cairo.jpg/800px-Qalawun_Complex_Cairo.jpg'
  },
  {
    id: 'coptic-cairo',
    nameEn: 'Coptic Cairo (Religious Complex)',
    nameAr: 'مجمع الأديان (مصر القديمة)',
    descriptionEn: 'A unique area where Islamic, Christian, and Jewish monuments stand side by side',
    descriptionAr: 'منطقة فريدة تتعانق فيها الآثار الإسلامية والمسيحية واليهودية',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Hanging_Church_Cairo.jpg/800px-Hanging_Church_Cairo.jpg'
  },
  {
    id: 'darb-al-ahmar',
    nameEn: 'Al-Darb Al-Ahmar & Citadel',
    nameAr: 'الدرب الأحمر والقلعة',
    descriptionEn: 'Historic district featuring the majestic Citadel and stunning Mamluk architecture',
    descriptionAr: 'حي تاريخي يضم قلعة صلاح الدين الشامخة وروائع العمارة المملوكية',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Cairo_Citadel_from_Al_Azhar_Park.jpg/800px-Cairo_Citadel_from_Al_Azhar_Park.jpg'
  }
];

export const categories = [
  { id: 'monument', nameEn: 'Monuments & Historic', nameAr: 'آثار ومباني تاريخية', color: 'bg-emerald-600', icon: 'Landmark' },
  { id: 'coffee', nameEn: 'Coffee Shops', nameAr: 'مقاهي', color: 'bg-pink-600', icon: 'Coffee' },
  { id: 'restaurant', nameEn: 'Restaurants & Food', nameAr: 'مطاعم وغذاء', color: 'bg-blue-600', icon: 'Utensils' },
  { id: 'workshop', nameEn: 'Workshops & Handicrafts', nameAr: 'ورش ومنتجات يدوية', color: 'bg-orange-500', icon: 'Hammer' },
  { id: 'stationary', nameEn: 'Stationary & Toys', nameAr: 'خردوات ومكتبات', color: 'bg-cyan-500', icon: 'BookOpen' },
  { id: 'meeting', nameEn: 'Meeting Points', nameAr: 'نقاط التجمع', color: 'bg-indigo-500', icon: 'Users' },
];

export const locations: Location[] = [
  // Ahl al-Bayt Route
  { id: 1, routeId: 'ahl-al-bayt', nameEn: 'Ahmad Ibn Tulun Mosque', nameAr: 'جامع أحمد بن طولون', category: 'monument', lat: 30.0287, lng: 31.2495, image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Ibn_Tulun_Mosque_Courtyard.jpg/800px-Ibn_Tulun_Mosque_Courtyard.jpg' },
  { id: 2, routeId: 'ahl-al-bayt', nameEn: 'Sarghatmish Mosque', nameAr: 'جامع صرغتمش', category: 'monument', lat: 30.0294, lng: 31.2490, image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Mosque_of_Amir_Sarghatmish.jpg/800px-Mosque_of_Amir_Sarghatmish.jpg' },
  { id: 3, routeId: 'ahl-al-bayt', nameEn: 'Bayt Al-Kritliyya (Gayer-Anderson Museum)', nameAr: 'بيت الكريتلية', category: 'monument', lat: 30.0283, lng: 31.2498, image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Gayer-Anderson_Museum_Courtyard.jpg/800px-Gayer-Anderson_Museum_Courtyard.jpg' },
  { id: 4, routeId: 'ahl-al-bayt', nameEn: 'Sidi al-Basha Mosque', nameAr: 'مسجد سيدي الباشا', category: 'monument', lat: 30.0275, lng: 31.2505 },
  { id: 5, routeId: 'ahl-al-bayt', nameEn: 'Muhammad al-Ayyashi Mausoleum', nameAr: 'ضريح محمد العياشي', category: 'monument', lat: 30.0268, lng: 31.2510 },
  { id: 6, routeId: 'ahl-al-bayt', nameEn: 'Sakna Basha House', nameAr: 'منزل سكنة باشا', category: 'monument', lat: 30.0260, lng: 31.2515 },
  { id: 7, routeId: 'ahl-al-bayt', nameEn: 'Muhammad al-Anwar Mausoleum', nameAr: 'مقام سيدي الأنور', category: 'monument', lat: 30.0255, lng: 31.2520 },
  { id: 8, routeId: 'ahl-al-bayt', nameEn: 'Al-Sayyida Sukayna Mosque', nameAr: 'مسجد السيدة سكينة', category: 'monument', lat: 30.0248, lng: 31.2525 },
  { id: 9, routeId: 'ahl-al-bayt', nameEn: 'Shajar al-Durr Mausoleum', nameAr: 'قبة شجر الدر', category: 'monument', lat: 30.0240, lng: 31.2530 },
  { id: 10, routeId: 'ahl-al-bayt', nameEn: 'Al-Jafari and Atika Mausoleum', nameAr: 'مقام الجعفري والسيدة عاتكة', category: 'monument', lat: 30.0235, lng: 31.2535 },
  { id: 11, routeId: 'ahl-al-bayt', nameEn: 'Al-Sayyida Ruqayya Mausoleum', nameAr: 'مقام السيدة رقية', category: 'monument', lat: 30.0228, lng: 31.2540 },
  { id: 12, routeId: 'ahl-al-bayt', nameEn: 'Ibn Sirin + Al-Balasi Mausoleum', nameAr: 'مقام ابن سيرين', category: 'monument', lat: 30.0220, lng: 31.2545 },
  { id: 13, routeId: 'ahl-al-bayt', nameEn: 'Fatima Khatun Mausoleum', nameAr: 'قبة فاطمة خاتون', category: 'monument', lat: 30.0215, lng: 31.2550 },
  { id: 14, routeId: 'ahl-al-bayt', nameEn: 'Al-Ashraf Khalil Mausoleum', nameAr: 'قبة الأشرف خليل', category: 'monument', lat: 30.0208, lng: 31.2555 },
  { id: 15, routeId: 'ahl-al-bayt', nameEn: 'Sabil Al-Yazji', nameAr: 'سبيل اليازجي', category: 'monument', lat: 30.0200, lng: 31.2560 },
  { id: 16, routeId: 'ahl-al-bayt', nameEn: 'Al-Sayyida Nafisa Mosque', nameAr: 'جامع السيدة نفيسة', category: 'monument', lat: 30.0195, lng: 31.2565, image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Sayyida_Nafisa_Mosque.jpg/800px-Sayyida_Nafisa_Mosque.jpg' },
  { id: 17, routeId: 'ahl-al-bayt', nameEn: 'Mohamed Beh Al-Marawy Mausoleum', nameAr: 'ضريح محمد بيه المرعوي', category: 'monument', lat: 30.0188, lng: 31.2570 },
  { id: 18, routeId: 'ahl-al-bayt', nameEn: 'Sabil - Kuttab Mustafa Bak Tabtaby', nameAr: 'سبيل - مكتب مصطفى بك طبطباي', category: 'monument', lat: 30.0180, lng: 31.2575 },
  { id: 19, routeId: 'ahl-al-bayt', nameEn: 'Ahmad Kuhya Mosque', nameAr: 'مسجد أحمد كوهيه', category: 'monument', lat: 30.0175, lng: 31.2580 },
  { id: 20, routeId: 'ahl-al-bayt', nameEn: 'Safiyy al-Din Jawhar Mausoleum', nameAr: 'قبة سيدة الدين جوهر', category: 'monument', lat: 30.0168, lng: 31.2585 },
  
  // Additional locations from the map legend
  { id: 21, routeId: 'ahl-al-bayt', nameEn: 'Al-Fakahany', nameAr: 'الفكهاني', category: 'restaurant', lat: 30.0250, lng: 31.2510 },
  { id: 22, routeId: 'ahl-al-bayt', nameEn: 'Ibn Tulun Pie Shop', nameAr: 'فطاطري ابن طولون', category: 'restaurant', lat: 30.0280, lng: 31.2490 },
  { id: 23, routeId: 'ahl-al-bayt', nameEn: 'Am Mostafa Roastery', nameAr: 'مقلة عم مصطفى', category: 'restaurant', lat: 30.0260, lng: 31.2500 },
  { id: 24, routeId: 'ahl-al-bayt', nameEn: 'Sayyida Nafisa Roastery', nameAr: 'مقلة السيدة نفيسة', category: 'restaurant', lat: 30.0190, lng: 31.2560 },
  { id: 25, routeId: 'ahl-al-bayt', nameEn: 'Abou Amr Restaurant', nameAr: 'مطعم عبده أبو عمرو', category: 'restaurant', lat: 30.0220, lng: 31.2530 },
  { id: 26, routeId: 'ahl-al-bayt', nameEn: 'Al-Omdah Dairy', nameAr: 'ألبان العمدة', category: 'restaurant', lat: 30.0210, lng: 31.2540 },
  
  { id: 27, routeId: 'ahl-al-bayt', nameEn: 'Sayed Qasim Grocery', nameAr: 'بقالة سيد قاسم', category: 'stationary', lat: 30.0270, lng: 31.2500 },
  { id: 28, routeId: 'ahl-al-bayt', nameEn: 'Nourhan Bazaar', nameAr: 'بازار نورهان', category: 'stationary', lat: 30.0240, lng: 31.2520 },
  
  { id: 29, routeId: 'ahl-al-bayt', nameEn: 'Islamic Furniture', nameAr: 'موبيليا إسلامي', category: 'workshop', lat: 30.0230, lng: 31.2530 },
  { id: 30, routeId: 'ahl-al-bayt', nameEn: 'Ramadan Beans Workshop', nameAr: 'ورشة فوانيس رمضان', category: 'workshop', lat: 30.0200, lng: 31.2550 },
  
  { id: 31, routeId: 'ahl-al-bayt', nameEn: 'Captain Sherif Cafe', nameAr: 'قهوة كابتن شريف', category: 'coffee', lat: 30.0285, lng: 31.2485 },
  { id: 32, routeId: 'ahl-al-bayt', nameEn: 'Sayyida Sakina Cafe', nameAr: 'قهوة السيدة سكينة', category: 'coffee', lat: 30.0245, lng: 31.2520 },
  { id: 33, routeId: 'ahl-al-bayt', nameEn: 'Om Mostafa Cafe', nameAr: 'قهوة أم مصطفى', category: 'coffee', lat: 30.0215, lng: 31.2545 },
  
  { id: 34, routeId: 'ahl-al-bayt', nameEn: 'Ibn Tulun Square', nameAr: 'ميدان ابن طولون', category: 'meeting', lat: 30.0287, lng: 31.2495 },
  { id: 35, routeId: 'ahl-al-bayt', nameEn: 'Sayyida Nafisa Square', nameAr: 'ميدان السيدة نفيسة', category: 'meeting', lat: 30.0195, lng: 31.2565 },

  // Al-Muizz Street Route
  { id: 101, routeId: 'al-muizz', nameEn: 'Bab al-Futuh', nameAr: 'باب الفتوح', category: 'monument', lat: 30.0545, lng: 31.2630, image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Bab_al-Futuh_Cairo.jpg/800px-Bab_al-Futuh_Cairo.jpg' },
  { id: 102, routeId: 'al-muizz', nameEn: 'Al-Hakim Mosque', nameAr: 'جامع الحاكم بأمر الله', category: 'monument', lat: 30.0535, lng: 31.2625, image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Al-Hakim_Mosque_Cairo.jpg/800px-Al-Hakim_Mosque_Cairo.jpg' },
  { id: 103, routeId: 'al-muizz', nameEn: 'Al-Aqmar Mosque', nameAr: 'الجامع الأقمر', category: 'monument', lat: 30.0515, lng: 31.2615, image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Al-Aqmar_Mosque_Facade.jpg/800px-Al-Aqmar_Mosque_Facade.jpg' },
  { id: 104, routeId: 'al-muizz', nameEn: 'Qalawun Complex', nameAr: 'مجموعة قلاوون', category: 'monument', lat: 30.0498, lng: 31.2611, image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Qalawun_Complex_Cairo.jpg/800px-Qalawun_Complex_Cairo.jpg' },
  { id: 105, routeId: 'al-muizz', nameEn: 'Barquq Mosque', nameAr: 'مسجد ومدرسة برقوق', category: 'monument', lat: 30.0505, lng: 31.2613, image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Mosque-Madrassa_of_Sultan_Hassan_and_Al-Rifa%27i_Mosque.jpg/800px-Mosque-Madrassa_of_Sultan_Hassan_and_Al-Rifa%27i_Mosque.jpg' },
  { id: 106, routeId: 'al-muizz', nameEn: 'Al-Ghuri Complex', nameAr: 'مجموعة الغوري', category: 'monument', lat: 30.0460, lng: 31.2595, image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Al-Ghuri_Complex.jpg/800px-Al-Ghuri_Complex.jpg' },

  { id: 107, routeId: 'al-muizz', nameEn: 'Bab Zuweila', nameAr: 'باب زويلة', category: 'monument', lat: 30.0425, lng: 31.2585, image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Bab_Zuweila_Cairo.jpg/800px-Bab_Zuweila_Cairo.jpg' },
  { id: 108, routeId: 'al-muizz', nameEn: 'Khan el-Khalili', nameAr: 'خان الخليلي', category: 'workshop', lat: 30.0475, lng: 31.2620, image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Khan_el-Khalili_Cairo.jpg/800px-Khan_el-Khalili_Cairo.jpg' },
  { id: 109, routeId: 'al-muizz', nameEn: 'El Fishawy Cafe', nameAr: 'مقهى الفيشاوي', category: 'coffee', lat: 30.0478, lng: 31.2625, image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Fishawi_Cafe.jpg/800px-Fishawi_Cafe.jpg' },
  { id: 110, routeId: 'al-muizz', nameEn: 'Naguib Mahfouz Cafe', nameAr: 'مقهى نجيب محفوظ', category: 'restaurant', lat: 30.0472, lng: 31.2618 },
  { id: 111, routeId: 'al-muizz', nameEn: 'Copper Workshops', nameAr: 'ورش النحاسين', category: 'workshop', lat: 30.0510, lng: 31.2615 },
  { id: 112, routeId: 'al-muizz', nameEn: 'Tentmakers Market', nameAr: 'سوق الخيامية', category: 'workshop', lat: 30.0415, lng: 31.2580 },
  { id: 113, routeId: 'al-muizz', nameEn: 'Al-Hussein Square', nameAr: 'ميدان الحسين', category: 'meeting', lat: 30.0480, lng: 31.2635 },

  // Coptic Cairo Route
  { id: 201, routeId: 'coptic-cairo', nameEn: 'The Hanging Church', nameAr: 'الكنيسة المعلقة', category: 'monument', lat: 30.0053, lng: 31.2302, image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Hanging_Church_Cairo.jpg/800px-Hanging_Church_Cairo.jpg' },
  { id: 202, routeId: 'coptic-cairo', nameEn: 'Amr Ibn Al-Aas Mosque', nameAr: 'جامع عمرو بن العاص', category: 'monument', lat: 30.0086, lng: 31.2327, image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Amr_Ibn_Al-Aas_Mosque.jpg/800px-Amr_Ibn_Al-Aas_Mosque.jpg' },
  { id: 203, routeId: 'coptic-cairo', nameEn: 'Ben Ezra Synagogue', nameAr: 'معبد بن عزرا', category: 'monument', lat: 30.0060, lng: 31.2305, image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Ben_Ezra_Synagogue_interior.jpg/800px-Ben_Ezra_Synagogue_interior.jpg' },
  { id: 204, routeId: 'coptic-cairo', nameEn: 'Coptic Museum', nameAr: 'المتحف القبطي', category: 'monument', lat: 30.0058, lng: 31.2300, image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Coptic_Museum_Cairo.jpg/800px-Coptic_Museum_Cairo.jpg' },
  { id: 205, routeId: 'coptic-cairo', nameEn: 'Church of St. George', nameAr: 'كنيسة مارجرجس', category: 'monument', lat: 30.0055, lng: 31.2301, image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Church_of_St._George_%28Cairo%29.jpg/800px-Church_of_St._George_%28Cairo%29.jpg' },
  { id: 206, routeId: 'coptic-cairo', nameEn: 'Fustat Pottery Village', nameAr: 'قرية الفخار بالفسطاط', category: 'workshop', lat: 30.0090, lng: 31.2350 },
  { id: 207, routeId: 'coptic-cairo', nameEn: 'Fustat Park', nameAr: 'حديقة الفسطاط', category: 'meeting', lat: 30.0120, lng: 31.2380 },

  // Al-Darb Al-Ahmar & Citadel Route
  { id: 301, routeId: 'darb-al-ahmar', nameEn: 'Salah El-Din Citadel', nameAr: 'قلعة صلاح الدين الأيوبي', category: 'monument', lat: 30.0299, lng: 31.2611, image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Cairo_Citadel.jpg/800px-Cairo_Citadel.jpg' },
  { id: 302, routeId: 'darb-al-ahmar', nameEn: 'Mosque of Muhammad Ali', nameAr: 'جامع محمد علي', category: 'monument', lat: 30.0287, lng: 31.2599, image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Muhammad_Ali_Mosque_Cairo.jpg/800px-Muhammad_Ali_Mosque_Cairo.jpg' },
  { id: 303, routeId: 'darb-al-ahmar', nameEn: 'Sultan Hassan Mosque', nameAr: 'مسجد ومدرسة السلطان حسن', category: 'monument', lat: 30.0322, lng: 31.2567, image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Mosque-Madrassa_of_Sultan_Hassan_and_Al-Rifa%27i_Mosque.jpg/800px-Mosque-Madrassa_of_Sultan_Hassan_and_Al-Rifa%27i_Mosque.jpg' },
  { id: 304, routeId: 'darb-al-ahmar', nameEn: 'Al-Rifa\'i Mosque', nameAr: 'مسجد الرفاعي', category: 'monument', lat: 30.0325, lng: 31.2575, image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Al-Rifa%27i_Mosque.jpg/800px-Al-Rifa%27i_Mosque.jpg' },
  { id: 305, routeId: 'darb-al-ahmar', nameEn: 'Aqsunqur (Blue) Mosque', nameAr: 'الجامع الأزرق (آق سنقر)', category: 'monument', lat: 30.0361, lng: 31.2600, image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Aqsunqur_Mosque_Cairo.jpg/800px-Aqsunqur_Mosque_Cairo.jpg' },
  { id: 306, routeId: 'darb-al-ahmar', nameEn: 'Al-Azhar Park', nameAr: 'حديقة الأزهر', category: 'meeting', lat: 30.0400, lng: 31.2644, image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Cairo_Citadel_from_Al_Azhar_Park.jpg/800px-Cairo_Citadel_from_Al_Azhar_Park.jpg' },
  { id: 307, routeId: 'darb-al-ahmar', nameEn: 'Studio Emad Eddin', nameAr: 'استوديو عماد الدين', category: 'workshop', lat: 30.0415, lng: 31.2620 },
  { id: 308, routeId: 'darb-al-ahmar', nameEn: 'Al-Azhar Park Restaurants', nameAr: 'مطاعم حديقة الأزهر', category: 'restaurant', lat: 30.0410, lng: 31.2640 },
  { id: 309, routeId: 'darb-al-ahmar', nameEn: 'Bab al-Wazir Street', nameAr: 'شارع باب الوزير', category: 'monument', lat: 30.0375, lng: 31.2595 },
];
