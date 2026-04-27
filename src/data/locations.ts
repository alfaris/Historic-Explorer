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
    image: ''
  },
  {
    id: 'al-muizz',
    nameEn: 'Al-Muizz Street Route',
    nameAr: 'مسار شارع المعز',
    descriptionEn: 'The greatest concentration of medieval architectural treasures in the Islamic world',
    descriptionAr: 'أكبر تجمع للكنوز المعمارية في العالم الإسلامي',
    image: ''
  },
  {
    id: 'coptic-cairo',
    nameEn: 'Coptic Cairo (Religious Complex)',
    nameAr: 'مجمع الأديان (مصر القديمة)',
    descriptionEn: 'A unique area where Islamic, Christian, and Jewish monuments stand side by side',
    descriptionAr: 'منطقة فريدة تتعانق فيها الآثار الإسلامية والمسيحية واليهودية',
    image: ''
  },
  {
    id: 'darb-al-ahmar',
    nameEn: 'Al-Darb Al-Ahmar & Citadel',
    nameAr: 'الدرب الأحمر والقلعة',
    descriptionEn: 'Historic district featuring the majestic Citadel and stunning Mamluk architecture',
    descriptionAr: 'حي تاريخي يضم قلعة صلاح الدين الشامخة وروائع العمارة المملوكية',
    image: ''
  }
];

export const categories = [
  { id: 'monument', nameEn: 'Monuments & Historic', nameAr: 'آثار ومباني تاريخية', color: 'bg-nile', icon: 'Landmark' },
  { id: 'coffee', nameEn: 'Coffee Shops', nameAr: 'مقاهي', color: 'bg-stone-500', icon: 'Coffee' },
  { id: 'restaurant', nameEn: 'Restaurants & Food', nameAr: 'مطاعم وغذاء', color: 'bg-gold', icon: 'Utensils' },
  { id: 'workshop', nameEn: 'Workshops & Handicrafts', nameAr: 'ورش ومنتجات يدوية', color: 'bg-stone-600', icon: 'Hammer' },
  { id: 'stationary', nameEn: 'Stationary & Toys', nameAr: 'خردوات ومكتبات', color: 'bg-stone-400', icon: 'BookOpen' },
  { id: 'meeting', nameEn: 'Meeting Points', nameAr: 'نقاط التجمع', color: 'bg-nile-light', icon: 'Users' },
];

export const locations: Location[] = [
  // Ahl al-Bayt Route
  { 
    id: 1, 
    routeId: 'ahl-al-bayt', 
    nameEn: 'Ahmad Ibn Tulun Mosque', 
    nameAr: 'جامع أحمد بن طولون', 
    category: 'monument', 
    lat: 30.0287, 
    lng: 31.2495, 
    descriptionEn: 'The oldest mosque in Cairo in its original form, and the largest in terms of land area. Famous for its unique spiral minaret, inspired by the Mosque of Samarra.',
    descriptionAr: 'أقدم مساجد القاهرة التي بقيت على حالتها الأصلية، وأكبرها مساحة. يشتهر بمئذنته الملوية الفريدة المستوحاة من ملوية سامراء.'
  },
  { id: 2, routeId: 'ahl-al-bayt', nameEn: 'Sarghatmish Mosque', nameAr: 'جامع صرغتمش', category: 'monument', lat: 30.0294, lng: 31.2490, descriptionEn: 'A stunning Mamluk-era complex featuring a mosque, madrasa, and mausoleum with an architectural style dominated by a large dome.', descriptionAr: 'مجمع مملوكي رائع يضم مسجداً ومدرسة وضريحاً، يتميز بطرازه المعماري الذي تهيمن عليه قبة ضخمة.' },
  { id: 3, routeId: 'ahl-al-bayt', nameEn: 'Bayt Al-Kritliyya (Gayer-Anderson Museum)', nameAr: 'بيت الكريتلية', category: 'monument', lat: 30.0283, lng: 31.2498, descriptionEn: 'Two historic houses joined by a bridge, housing a vast collection of oriental and egyptian artifacts collected by Major Gayer-Anderson.', descriptionAr: 'منزلان تاريخيان يربطهما جسر، يضمان مجموعة واسعة من القطع الأثرية الشرقية والمصرية التي جمعها الميجور جاير أندرسون.' },
  { id: 4, routeId: 'ahl-al-bayt', nameEn: 'Sidi al-Basha Mosque', nameAr: 'مسجد سيدي الباشا', category: 'monument', lat: 30.0275, lng: 31.2505, descriptionEn: 'A quaint historic mosque reflecting the rich spirituality of the Al-Ashraf street.', descriptionAr: 'مسجد تاريخي جذاب يعكس الروحانية الغنية لشارع الأشراف.' },
  { id: 5, routeId: 'ahl-al-bayt', nameEn: 'Muhammad al-Ayyashi Mausoleum', nameAr: 'ضريح محمد العياشي', category: 'monument', lat: 30.0268, lng: 31.2510, descriptionEn: 'A minor yet beautiful mausoleum dedicated to Muhammad al-Ayyashi.', descriptionAr: 'مقام صغير ولكنه جميل مخصص لمحمد العياشي.' },
  { id: 6, routeId: 'ahl-al-bayt', nameEn: 'Sakna Basha House', nameAr: 'منزل سكنة باشا', category: 'monument', lat: 30.0260, lng: 31.2515, descriptionEn: 'An example of domestic architecture from the Ottoman era in Cairo.', descriptionAr: 'نموذج للعمارة السكنية من العصر العثماني في القاهرة.' },
  { id: 7, routeId: 'ahl-al-bayt', nameEn: 'Muhammad al-Anwar Mausoleum', nameAr: 'مقام سيدي الأنور', category: 'monument', lat: 30.0255, lng: 31.2520, descriptionEn: 'Resting place of Sidi Al-Anwar, attracting visitors seeking blessings.', descriptionAr: 'مثوى سيدي الأنور، يتردد عليه الزوار للتبرك.' },
  { id: 8, routeId: 'ahl-al-bayt', nameEn: 'Al-Sayyida Sukayna Mosque', nameAr: 'مسجد السيدة سكينة', category: 'monument', lat: 30.0248, lng: 31.2525, descriptionEn: 'A prominent shrine dedicated to Sayyida Sukayna, a significant figure in Islamic history.', descriptionAr: 'مقام بارز مخصص للسيدة سكينة، وهي شخصية مهمة في التاريخ الإسلامي.' },
  { id: 9, routeId: 'ahl-al-bayt', nameEn: 'Shajar al-Durr Mausoleum', nameAr: 'قبة شجر الدر', category: 'monument', lat: 30.0240, lng: 31.2530, descriptionEn: 'The beautiful domed tomb of the remarkable Queen Shajar al-Durr.', descriptionAr: 'ضريح مقبب جميل للملكة الاستثنائية شجر الدر.' },
  { id: 10, routeId: 'ahl-al-bayt', nameEn: 'Al-Jafari and Atika Mausoleum', nameAr: 'مقام الجعفري والسيدة عاتكة', category: 'monument', lat: 30.0235, lng: 31.2535, descriptionEn: 'Double mausoleum commemorating two revered historical figures.', descriptionAr: 'ضريح مزدوج يحيي ذكرى شخصيتين تاريخيتين مبجلتين.' },
  { id: 11, routeId: 'ahl-al-bayt', nameEn: 'Al-Sayyida Ruqayya Mausoleum', nameAr: 'مقام السيدة رقية', category: 'monument', lat: 30.0228, lng: 31.2540, descriptionEn: 'A Fatimid-era shrine famous for its intricately carved stucco mihrab.', descriptionAr: 'مقام من العصر الفاطمي يشتهر بمحرابه الجصي المنحوت بدقة.' },
  { id: 12, routeId: 'ahl-al-bayt', nameEn: 'Ibn Sirin + Al-Balasi Mausoleum', nameAr: 'مقام ابن سيرين', category: 'monument', lat: 30.0220, lng: 31.2545, descriptionEn: 'A spiritual site located along the path connecting major Ahl Al-Bayt landmarks.', descriptionAr: 'موقع روحي يقع على طول المسار الذي يربط بين المعالم الرئيسية لآل البيت.' },
  { id: 13, routeId: 'ahl-al-bayt', nameEn: 'Fatima Khatun Mausoleum', nameAr: 'قبة فاطمة خاتون', category: 'monument', lat: 30.0215, lng: 31.2550, descriptionEn: 'An imposing Mamluk mausoleum known for its distinctive ribbed dome.', descriptionAr: 'ضريح مملوكي مهيب يُعرف بقبته المضلعة المميزة.' },
  { id: 14, routeId: 'ahl-al-bayt', nameEn: 'Al-Ashraf Khalil Mausoleum', nameAr: 'قبة الأشرف خليل', category: 'monument', lat: 30.0208, lng: 31.2555, descriptionEn: 'The mausoleum of Sultan Al-Ashraf Khalil, famous for expelling the Crusaders from Acre.', descriptionAr: 'ضريح السلطان الأشرف خليل، الذي اشتهر بطرد الصليبيين من عكا.' },
  { id: 15, routeId: 'ahl-al-bayt', nameEn: 'Sabil Al-Yazji', nameAr: 'سبيل اليازجي', category: 'monument', lat: 30.0200, lng: 31.2560, descriptionEn: 'A historic public water fountain providing free water to wayfarers.', descriptionAr: 'سبيل تاريخي كان يوفر مياه الشرب المجانية للمارة.' },
  { id: 16, routeId: 'ahl-al-bayt', nameEn: 'Al-Sayyida Nafisa Mosque', nameAr: 'جامع السيدة نفيسة', category: 'monument', lat: 30.0195, lng: 31.2565, descriptionEn: 'A highly venerated shrine dedicated to Sayyida Nafisa, a great-granddaughter of Imam Hasan.', descriptionAr: 'مقام يحظى بتبجيل كبير مخصص للسيدة نفيسة العظيمة.' },
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
  
  { id: 34, routeId: 'ahl-al-bayt', nameEn: 'Ibn Tulun Square', nameAr: 'ميدان ابن طولون', category: 'meeting', lat: 30.0287, lng: 31.2495, descriptionEn: 'The expansive gathering space in front of the Ibn Tulun Mosque.', descriptionAr: 'مساحة التجمع الواسعة أمام مسجد ابن طولون.' },
  { id: 35, routeId: 'ahl-al-bayt', nameEn: 'Sayyida Nafisa Square', nameAr: 'ميدان السيدة نفيسة', category: 'meeting', lat: 30.0195, lng: 31.2565, descriptionEn: 'A bustling square functioning as a nexus for religious pilgrims and local commerce.', descriptionAr: 'ساحة مزدحمة تعمل كحلقة وصل للحجاج الدينيين والتجارة المحلية.' },

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
  { id: 102, routeId: 'al-muizz', nameEn: 'Al-Hakim Mosque', nameAr: 'جامع الحاكم بأمر الله', category: 'monument', lat: 30.0535, lng: 31.2625, descriptionEn: 'A major Fatimid mosque known for its unique minarets and vast courtyard, named after Caliph Al-Hakim bi-Amr Allah.', descriptionAr: 'ثاني أكبر مساجد القاهرة اتساعاً، بناه الخليفة الفاطمي الحاكم بأمر الله ويتميز بمئذنتيه الفريدتين.' },
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
  { id: 202, routeId: 'coptic-cairo', nameEn: 'Amr Ibn Al-Aas Mosque', nameAr: 'جامع عمرو بن العاص', category: 'monument', lat: 30.0086, lng: 31.2327, descriptionEn: 'The first mosque built in Egypt and Africa (641 AD), standing as a symbol of early Islamic architecture and history.', descriptionAr: 'أول مسجد بني في مصر وأفريقيا (641م)، ويقف كرمز للعمارة والتاريخ الإسلامي المبكر.' },
  { id: 203, routeId: 'coptic-cairo', nameEn: 'Ben Ezra Synagogue', nameAr: 'معبد بن عزرا', category: 'monument', lat: 30.0060, lng: 31.2305, descriptionEn: 'Located on the site where baby Moses was allegedly found, it is the oldest Jewish temple in Cairo, famous for the Cairo Geniza documents.', descriptionAr: 'يقع في الموقع الذي يقال إنه عثر فيه على النبي موسى رضيعاً، وهو أقدم معبد يهودي في القاهرة، مشهور بوثائق جنيزة القاهرة.' },
  { id: 204, routeId: 'coptic-cairo', nameEn: 'Coptic Museum', nameAr: 'المتحف القبطي', category: 'monument', lat: 30.0058, lng: 31.2300, descriptionEn: 'Houses the worlds largest collection of Coptic Christian artwork and artifacts, bridging ancient Egyptian and Islamic art.', descriptionAr: 'يضم أكبر مجموعة في العالم من الفنون والقطع الأثرية المسيحية القبطية، ويشكل جسراً بين الفن المصري القديم والإسلامي.' },
  { id: 205, routeId: 'coptic-cairo', nameEn: 'Church of St. George', nameAr: 'كنيسة مارجرجس', category: 'monument', lat: 30.0055, lng: 31.2301, descriptionEn: 'A unique Greek Orthodox rotunda church built atop an ancient Roman tower of the Babylon Fortress.', descriptionAr: 'كنيسة أرثوذكسية يونانية فريدة من نوعها مبنية على طراز هندسي دائري فوق أحد أبراج حصن بابليون الروماني القديم.' },
  { id: 206, routeId: 'coptic-cairo', nameEn: 'Fustat Pottery Village', nameAr: 'قرية الفخار بالفسطاط', category: 'workshop', lat: 30.0090, lng: 31.2350, descriptionEn: 'A bustling area dedicated to the age-old craft of pottery making, producing various clay wares.', descriptionAr: 'منطقة تعج بحركة صناعة الفخار القديمة، وتنتج مختلف الأواني الخزفية.' },
  { id: 207, routeId: 'coptic-cairo', nameEn: 'Fustat Park', nameAr: 'حديقة الفسطاط', category: 'meeting', lat: 30.0120, lng: 31.2380, descriptionEn: 'A vast green park built on the ruins of Fustat, the first capital of Egypt under Islamic rule.', descriptionAr: 'حديقة خضراء شاسعة مبنية على أنقاض الفسطاط، أول عاصمة لمصر تحت الحكم الإسلامي.' },

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
];
