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
}

export const routes: Route[] = [
  {
    id: 'ahl-al-bayt',
    nameEn: 'Ahl al-Bayt Route',
    nameAr: 'مسار آل البيت',
    descriptionEn: 'A journey through history and spirituality in the heart of Cairo',
    descriptionAr: 'رحلة عبر التاريخ والروحانية في قلب القاهرة',
    image: 'https://picsum.photos/seed/cairo-historic/800/400'
  },
  {
    id: 'al-muizz',
    nameEn: 'Al-Muizz Street Route',
    nameAr: 'مسار شارع المعز',
    descriptionEn: 'The greatest concentration of medieval architectural treasures in the Islamic world',
    descriptionAr: 'أكبر تجمع للكنوز المعمارية في العالم الإسلامي',
    image: 'https://picsum.photos/seed/al-muizz/800/400'
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
  { id: 1, routeId: 'ahl-al-bayt', nameEn: 'Ahmad Ibn Tulun Mosque', nameAr: 'جامع أحمد بن طولون', category: 'monument' },
  { id: 2, routeId: 'ahl-al-bayt', nameEn: 'Sarghatmish Mosque', nameAr: 'جامع صرغتمش', category: 'monument' },
  { id: 3, routeId: 'ahl-al-bayt', nameEn: 'Bayt Al-Kritliyya (Gayer-Anderson Museum)', nameAr: 'بيت الكريتلية', category: 'monument' },
  { id: 4, routeId: 'ahl-al-bayt', nameEn: 'Sidi al-Basha Mosque', nameAr: 'مسجد سيدي الباشا', category: 'monument' },
  { id: 5, routeId: 'ahl-al-bayt', nameEn: 'Muhammad al-Ayyashi Mausoleum', nameAr: 'ضريح محمد العياشي', category: 'monument' },
  { id: 6, routeId: 'ahl-al-bayt', nameEn: 'Sakna Basha House', nameAr: 'منزل سكنة باشا', category: 'monument' },
  { id: 7, routeId: 'ahl-al-bayt', nameEn: 'Muhammad al-Anwar Mausoleum', nameAr: 'مقام سيدي الأنور', category: 'monument' },
  { id: 8, routeId: 'ahl-al-bayt', nameEn: 'Al-Sayyida Sukayna Mosque', nameAr: 'مسجد السيدة سكينة', category: 'monument' },
  { id: 9, routeId: 'ahl-al-bayt', nameEn: 'Shajar al-Durr Mausoleum', nameAr: 'قبة شجر الدر', category: 'monument' },
  { id: 10, routeId: 'ahl-al-bayt', nameEn: 'Al-Jafari and Atika Mausoleum', nameAr: 'مقام الجعفري والسيدة عاتكة', category: 'monument' },
  { id: 11, routeId: 'ahl-al-bayt', nameEn: 'Al-Sayyida Ruqayya Mausoleum', nameAr: 'مقام السيدة رقية', category: 'monument' },
  { id: 12, routeId: 'ahl-al-bayt', nameEn: 'Ibn Sirin + Al-Balasi Mausoleum', nameAr: 'مقام ابن سيرين', category: 'monument' },
  { id: 13, routeId: 'ahl-al-bayt', nameEn: 'Fatima Khatun Mausoleum', nameAr: 'قبة فاطمة خاتون', category: 'monument' },
  { id: 14, routeId: 'ahl-al-bayt', nameEn: 'Al-Ashraf Khalil Mausoleum', nameAr: 'قبة الأشرف خليل', category: 'monument' },
  { id: 15, routeId: 'ahl-al-bayt', nameEn: 'Sabil Al-Yazji', nameAr: 'سبيل اليازجي', category: 'monument' },
  { id: 16, routeId: 'ahl-al-bayt', nameEn: 'Al-Sayyida Nafisa Mosque', nameAr: 'جامع السيدة نفيسة', category: 'monument' },
  { id: 17, routeId: 'ahl-al-bayt', nameEn: 'Mohamed Beh Al-Marawy Mausoleum', nameAr: 'ضريح محمد بيه المرعوي', category: 'monument' },
  { id: 18, routeId: 'ahl-al-bayt', nameEn: 'Sabil - Kuttab Mustafa Bak Tabtaby', nameAr: 'سبيل - مكتب مصطفى بك طبطباي', category: 'monument' },
  { id: 19, routeId: 'ahl-al-bayt', nameEn: 'Ahmad Kuhya Mosque', nameAr: 'مسجد أحمد كوهيه', category: 'monument' },
  { id: 20, routeId: 'ahl-al-bayt', nameEn: 'Safiyy al-Din Jawhar Mausoleum', nameAr: 'قبة سيدة الدين جوهر', category: 'monument' },
  
  // Additional locations from the map legend
  { id: 21, routeId: 'ahl-al-bayt', nameEn: 'Al-Fakahany', nameAr: 'الفكهاني', category: 'restaurant' },
  { id: 22, routeId: 'ahl-al-bayt', nameEn: 'Ibn Tulun Pie Shop', nameAr: 'فطاطري ابن طولون', category: 'restaurant' },
  { id: 23, routeId: 'ahl-al-bayt', nameEn: 'Am Mostafa Roastery', nameAr: 'مقلة عم مصطفى', category: 'restaurant' },
  { id: 24, routeId: 'ahl-al-bayt', nameEn: 'Sayyida Nafisa Roastery', nameAr: 'مقلة السيدة نفيسة', category: 'restaurant' },
  { id: 25, routeId: 'ahl-al-bayt', nameEn: 'Abou Amr Restaurant', nameAr: 'مطعم عبده أبو عمرو', category: 'restaurant' },
  { id: 26, routeId: 'ahl-al-bayt', nameEn: 'Al-Omdah Dairy', nameAr: 'ألبان العمدة', category: 'restaurant' },
  
  { id: 27, routeId: 'ahl-al-bayt', nameEn: 'Sayed Qasim Grocery', nameAr: 'بقالة سيد قاسم', category: 'stationary' },
  { id: 28, routeId: 'ahl-al-bayt', nameEn: 'Nourhan Bazaar', nameAr: 'بازار نورهان', category: 'stationary' },
  
  { id: 29, routeId: 'ahl-al-bayt', nameEn: 'Islamic Furniture', nameAr: 'موبيليا إسلامي', category: 'workshop' },
  { id: 30, routeId: 'ahl-al-bayt', nameEn: 'Ramadan Beans Workshop', nameAr: 'ورشة فوانيس رمضان', category: 'workshop' },
  
  { id: 31, routeId: 'ahl-al-bayt', nameEn: 'Captain Sherif Cafe', nameAr: 'قهوة كابتن شريف', category: 'coffee' },
  { id: 32, routeId: 'ahl-al-bayt', nameEn: 'Sayyida Sakina Cafe', nameAr: 'قهوة السيدة سكينة', category: 'coffee' },
  { id: 33, routeId: 'ahl-al-bayt', nameEn: 'Om Mostafa Cafe', nameAr: 'قهوة أم مصطفى', category: 'coffee' },
  
  { id: 34, routeId: 'ahl-al-bayt', nameEn: 'Ibn Tulun Square', nameAr: 'ميدان ابن طولون', category: 'meeting' },
  { id: 35, routeId: 'ahl-al-bayt', nameEn: 'Sayyida Nafisa Square', nameAr: 'ميدان السيدة نفيسة', category: 'meeting' },

  // Al-Muizz Street Route
  { id: 101, routeId: 'al-muizz', nameEn: 'Bab al-Futuh', nameAr: 'باب الفتوح', category: 'monument' },
  { id: 102, routeId: 'al-muizz', nameEn: 'Al-Hakim Mosque', nameAr: 'جامع الحاكم بأمر الله', category: 'monument' },
  { id: 103, routeId: 'al-muizz', nameEn: 'Al-Aqmar Mosque', nameAr: 'الجامع الأقمر', category: 'monument' },
  { id: 104, routeId: 'al-muizz', nameEn: 'Qalawun Complex', nameAr: 'مجموعة قلاوون', category: 'monument' },
  { id: 105, routeId: 'al-muizz', nameEn: 'Barquq Mosque', nameAr: 'مسجد ومدرسة برقوق', category: 'monument' },
  { id: 106, routeId: 'al-muizz', nameEn: 'Al-Ghuri Complex', nameAr: 'مجموعة الغوري', category: 'monument' },
  { id: 107, routeId: 'al-muizz', nameEn: 'Bab Zuweila', nameAr: 'باب زويلة', category: 'monument' },
  { id: 108, routeId: 'al-muizz', nameEn: 'Khan el-Khalili', nameAr: 'خان الخليلي', category: 'workshop' },
  { id: 109, routeId: 'al-muizz', nameEn: 'El Fishawy Cafe', nameAr: 'مقهى الفيشاوي', category: 'coffee' },
  { id: 110, routeId: 'al-muizz', nameEn: 'Naguib Mahfouz Cafe', nameAr: 'مقهى نجيب محفوظ', category: 'restaurant' },
  { id: 111, routeId: 'al-muizz', nameEn: 'Copper Workshops', nameAr: 'ورش النحاسين', category: 'workshop' },
  { id: 112, routeId: 'al-muizz', nameEn: 'Tentmakers Market', nameAr: 'سوق الخيامية', category: 'workshop' },
  { id: 113, routeId: 'al-muizz', nameEn: 'Al-Hussein Square', nameAr: 'ميدان الحسين', category: 'meeting' },
];
