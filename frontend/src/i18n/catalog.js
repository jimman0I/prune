/** Every piece of text Prune's own UI shows, in all 40 languages.
 *
 * One key set, `en`'s, is the source of truth -- catalog.test.js fails if
 * any other language is missing a key `en` has, or has one `en` doesn't,
 * so a screen can never end up with an untranslated hole in the middle of
 * another language. New UI text is added here FIRST, in English, and
 * translated into the other 39 before it ships, not after -- the same
 * rule the installer's own languages already keep.
 *
 * A value is either a plain string, or a function for a string built
 * around something dynamic (a version number, a count). Every language
 * must give the SAME key the same kind of value: a function where `en`
 * has a function, a string where `en` has a string. LanguageContext.jsx
 * calls it with whatever arguments `t()` was given.
 *
 * One file rather than 40, and no code-splitting: even at full size this
 * is plain short text, not an asset a desktop app need economise on the
 * way a web page would its network payload. */
export const CATALOG = {
  en: {
    nav: {
      dashboard: 'Dashboard',
      diskMap: 'Disk Map',
      applications: 'Applications',
      quarantine: 'Quarantine',
      settings: 'Settings',
      startup: 'Startup',
      duplicates: 'Duplicates',
      deepClean: 'Deep Clean'
    },
    settings: {
      language: {
        title: 'Language',
        description: "What Prune's own screens are shown in."
      }
    }
  },

  af: {
    nav: {
      dashboard: 'Kontroleskerm', diskMap: 'Skyfkaart', applications: 'Toepassings',
      quarantine: 'Karantyn', settings: 'Instellings', startup: 'Opstart',
      duplicates: 'Duplikate', deepClean: 'Grondige Skoonmaak'
    },
    settings: { language: { title: 'Taal', description: "Waarin Prune se eie skerms gewys word." } }
  },

  ar: {
    nav: {
      dashboard: 'لوحة التحكم', diskMap: 'خريطة القرص', applications: 'التطبيقات',
      quarantine: 'الحجر', settings: 'الإعدادات', startup: 'بدء التشغيل',
      duplicates: 'الملفات المكررة', deepClean: 'تنظيف عميق'
    },
    settings: { language: { title: 'اللغة', description: 'اللغة التي تُعرض بها شاشات Prune نفسها.' } }
  },

  ca: {
    nav: {
      dashboard: 'Tauler', diskMap: 'Mapa del disc', applications: 'Aplicacions',
      quarantine: 'Quarantena', settings: 'Configuració', startup: 'Inici',
      duplicates: 'Duplicats', deepClean: 'Neteja profunda'
    },
    settings: { language: { title: 'Idioma', description: "L'idioma en què es mostren les pantalles del propi Prune." } }
  },

  cs: {
    nav: {
      dashboard: 'Přehled', diskMap: 'Mapa disku', applications: 'Aplikace',
      quarantine: 'Karanténa', settings: 'Nastavení', startup: 'Po spuštění',
      duplicates: 'Duplicity', deepClean: 'Důkladné čištění'
    },
    settings: { language: { title: 'Jazyk', description: 'Jazyk, ve kterém se zobrazují obrazovky Prune.' } }
  },

  cy: {
    nav: {
      dashboard: 'Dangosfwrdd', diskMap: 'Map Disg', applications: 'Rhaglenni',
      quarantine: 'Cwarantin', settings: 'Gosodiadau', startup: 'Cychwyn',
      duplicates: 'Dyblygiadau', deepClean: 'Glanhau Dwfn'
    },
    settings: { language: { title: 'Iaith', description: "Yr iaith y dangosir sgriniau Prune ei hun ynddi." } }
  },

  da: {
    nav: {
      dashboard: 'Oversigt', diskMap: 'Diskkort', applications: 'Programmer',
      quarantine: 'Karantæne', settings: 'Indstillinger', startup: 'Opstart',
      duplicates: 'Dubletter', deepClean: 'Grundig oprydning'
    },
    settings: { language: { title: 'Sprog', description: 'Det sprog, Prunes egne skærme vises på.' } }
  },

  de: {
    nav: {
      dashboard: 'Übersicht', diskMap: 'Festplattenkarte', applications: 'Anwendungen',
      quarantine: 'Quarantäne', settings: 'Einstellungen', startup: 'Autostart',
      duplicates: 'Duplikate', deepClean: 'Gründliche Bereinigung'
    },
    settings: { language: { title: 'Sprache', description: 'Die Sprache, in der Prunes eigene Bildschirme angezeigt werden.' } }
  },

  el: {
    nav: {
      dashboard: 'Πίνακας ελέγχου', diskMap: 'Χάρτης δίσκου', applications: 'Εφαρμογές',
      quarantine: 'Καραντίνα', settings: 'Ρυθμίσεις', startup: 'Εκκίνηση',
      duplicates: 'Διπλότυπα', deepClean: 'Βαθύς καθαρισμός'
    },
    settings: { language: { title: 'Γλώσσα', description: 'Η γλώσσα στην οποία εμφανίζονται οι δικές του οθόνες του Prune.' } }
  },

  es: {
    nav: {
      dashboard: 'Panel', diskMap: 'Mapa del disco', applications: 'Aplicaciones',
      quarantine: 'Cuarentena', settings: 'Configuración', startup: 'Inicio',
      duplicates: 'Duplicados', deepClean: 'Limpieza profunda'
    },
    settings: { language: { title: 'Idioma', description: 'El idioma en el que se muestran las propias pantallas de Prune.' } }
  },

  et: {
    nav: {
      dashboard: 'Töölaud', diskMap: 'Kettakaart', applications: 'Rakendused',
      quarantine: 'Karantiin', settings: 'Seaded', startup: 'Käivitus',
      duplicates: 'Duplikaadid', deepClean: 'Põhjalik puhastus'
    },
    settings: { language: { title: 'Keel', description: 'Keel, milles Prune oma ekraanid kuvatakse.' } }
  },

  fi: {
    nav: {
      dashboard: 'Yhteenveto', diskMap: 'Levykartta', applications: 'Sovellukset',
      quarantine: 'Karanteeni', settings: 'Asetukset', startup: 'Käynnistys',
      duplicates: 'Kaksoiskappaleet', deepClean: 'Perusteellinen siivous'
    },
    settings: { language: { title: 'Kieli', description: 'Kieli, jolla Prunen omat näytöt näytetään.' } }
  },

  fr: {
    nav: {
      dashboard: 'Tableau de bord', diskMap: 'Carte du disque', applications: 'Applications',
      quarantine: 'Quarantaine', settings: 'Paramètres', startup: 'Démarrage',
      duplicates: 'Doublons', deepClean: 'Nettoyage approfondi'
    },
    settings: { language: { title: 'Langue', description: 'La langue dans laquelle les écrans de Prune sont affichés.' } }
  },

  he: {
    nav: {
      dashboard: 'לוח בקרה', diskMap: 'מפת הדיסק', applications: 'יישומים',
      quarantine: 'הסגר', settings: 'הגדרות', startup: 'הפעלה',
      duplicates: 'כפילויות', deepClean: 'ניקוי מעמיק'
    },
    settings: { language: { title: 'שפה', description: 'השפה שבה מוצגים המסכים של Prune עצמו.' } }
  },

  hu: {
    nav: {
      dashboard: 'Áttekintés', diskMap: 'Lemeztérkép', applications: 'Alkalmazások',
      quarantine: 'Karantén', settings: 'Beállítások', startup: 'Indítás',
      duplicates: 'Duplikátumok', deepClean: 'Alapos tisztítás'
    },
    settings: { language: { title: 'Nyelv', description: 'A nyelv, amelyen a Prune saját képernyői megjelennek.' } }
  },

  id: {
    nav: {
      dashboard: 'Dasbor', diskMap: 'Peta Disk', applications: 'Aplikasi',
      quarantine: 'Karantina', settings: 'Pengaturan', startup: 'Mulai Otomatis',
      duplicates: 'Duplikat', deepClean: 'Pembersihan Menyeluruh'
    },
    settings: { language: { title: 'Bahasa', description: 'Bahasa yang digunakan untuk menampilkan layar Prune sendiri.' } }
  },

  is: {
    nav: {
      dashboard: 'Yfirlit', diskMap: 'Diskakort', applications: 'Forrit',
      quarantine: 'Sóttkví', settings: 'Stillingar', startup: 'Ræsing',
      duplicates: 'Tvítök', deepClean: 'Ítarleg hreinsun'
    },
    settings: { language: { title: 'Tungumál', description: 'Tungumálið sem skjáir Prune sjálfs birtast á.' } }
  },

  it: {
    nav: {
      dashboard: 'Pannello', diskMap: 'Mappa del disco', applications: 'Applicazioni',
      quarantine: 'Quarantena', settings: 'Impostazioni', startup: 'Avvio',
      duplicates: 'Duplicati', deepClean: 'Pulizia approfondita'
    },
    settings: { language: { title: 'Lingua', description: 'La lingua in cui vengono mostrate le schermate di Prune.' } }
  },

  ja: {
    nav: {
      dashboard: 'ダッシュボード', diskMap: 'ディスクマップ', applications: 'アプリケーション',
      quarantine: '隔離', settings: '設定', startup: 'スタートアップ',
      duplicates: '重複ファイル', deepClean: 'ディープクリーン'
    },
    settings: { language: { title: '言語', description: 'Prune 自身の画面が表示される言語です。' } }
  },

  ko: {
    nav: {
      dashboard: '대시보드', diskMap: '디스크 맵', applications: '애플리케이션',
      quarantine: '격리', settings: '설정', startup: '시작 프로그램',
      duplicates: '중복 파일', deepClean: '딥 클린'
    },
    settings: { language: { title: '언어', description: 'Prune 자체 화면이 표시되는 언어입니다.' } }
  },

  lt: {
    nav: {
      dashboard: 'Valdymo skydas', diskMap: 'Disko žemėlapis', applications: 'Programos',
      quarantine: 'Karantinas', settings: 'Nustatymai', startup: 'Paleistis',
      duplicates: 'Dublikatai', deepClean: 'Kruopštus valymas'
    },
    settings: { language: { title: 'Kalba', description: 'Kalba, kuria rodomi paties „Prune“ ekranai.' } }
  },

  ms: {
    nav: {
      dashboard: 'Papan Pemuka', diskMap: 'Peta Cakera', applications: 'Aplikasi',
      quarantine: 'Kuarantin', settings: 'Tetapan', startup: 'Permulaan',
      duplicates: 'Pendua', deepClean: 'Pembersihan Menyeluruh'
    },
    settings: { language: { title: 'Bahasa', description: 'Bahasa yang digunakan untuk memaparkan skrin Prune sendiri.' } }
  },

  nb: {
    nav: {
      dashboard: 'Oversikt', diskMap: 'Diskkart', applications: 'Programmer',
      quarantine: 'Karantene', settings: 'Innstillinger', startup: 'Oppstart',
      duplicates: 'Duplikater', deepClean: 'Grundig opprydding'
    },
    settings: { language: { title: 'Språk', description: 'Språket Prunes egne skjermer vises på.' } }
  },

  nl: {
    nav: {
      dashboard: 'Dashboard', diskMap: 'Schijfkaart', applications: 'Toepassingen',
      quarantine: 'Quarantaine', settings: 'Instellingen', startup: 'Opstarten',
      duplicates: 'Duplicaten', deepClean: 'Grondige opschoning'
    },
    settings: { language: { title: 'Taal', description: 'De taal waarin Prunes eigen schermen worden getoond.' } }
  },

  pl: {
    nav: {
      dashboard: 'Panel', diskMap: 'Mapa dysku', applications: 'Aplikacje',
      quarantine: 'Kwarantanna', settings: 'Ustawienia', startup: 'Autostart',
      duplicates: 'Duplikaty', deepClean: 'Dokładne czyszczenie'
    },
    settings: { language: { title: 'Język', description: 'Język, w którym wyświetlane są własne ekrany Prune.' } }
  },

  ps: {
    nav: {
      dashboard: 'ډشبورډ', diskMap: 'د ډیسک نقشه', applications: 'غوښتنلیکونه',
      quarantine: 'قرنطین', settings: 'تنظیمات', startup: 'پیل',
      duplicates: 'تکراري فایلونه', deepClean: 'ژور پاکول'
    },
    settings: { language: { title: 'ژبه', description: 'هغه ژبه چې د Prune خپلې پردې پرې ښودل کیږي.' } }
  },

  'pt-BR': {
    nav: {
      dashboard: 'Painel', diskMap: 'Mapa do disco', applications: 'Aplicativos',
      quarantine: 'Quarentena', settings: 'Configurações', startup: 'Inicialização',
      duplicates: 'Duplicados', deepClean: 'Limpeza profunda'
    },
    settings: { language: { title: 'Idioma', description: 'O idioma em que as próprias telas do Prune são exibidas.' } }
  },

  pt: {
    nav: {
      dashboard: 'Painel', diskMap: 'Mapa do disco', applications: 'Aplicações',
      quarantine: 'Quarentena', settings: 'Definições', startup: 'Arranque',
      duplicates: 'Duplicados', deepClean: 'Limpeza profunda'
    },
    settings: { language: { title: 'Idioma', description: 'O idioma em que os próprios ecrãs do Prune são apresentados.' } }
  },

  ro: {
    nav: {
      dashboard: 'Panou', diskMap: 'Harta discului', applications: 'Aplicații',
      quarantine: 'Carantină', settings: 'Setări', startup: 'Pornire',
      duplicates: 'Duplicate', deepClean: 'Curățare aprofundată'
    },
    settings: { language: { title: 'Limbă', description: 'Limba în care sunt afișate propriile ecrane ale Prune.' } }
  },

  ru: {
    nav: {
      dashboard: 'Панель', diskMap: 'Карта диска', applications: 'Приложения',
      quarantine: 'Карантин', settings: 'Настройки', startup: 'Автозагрузка',
      duplicates: 'Дубликаты', deepClean: 'Глубокая очистка'
    },
    settings: { language: { title: 'Язык', description: 'Язык, на котором отображаются собственные экраны Prune.' } }
  },

  sk: {
    nav: {
      dashboard: 'Prehľad', diskMap: 'Mapa disku', applications: 'Aplikácie',
      quarantine: 'Karanténa', settings: 'Nastavenia', startup: 'Po spustení',
      duplicates: 'Duplicity', deepClean: 'Dôkladné čistenie'
    },
    settings: { language: { title: 'Jazyk', description: 'Jazyk, v ktorom sa zobrazujú vlastné obrazovky Prune.' } }
  },

  sq: {
    nav: {
      dashboard: 'Paneli', diskMap: 'Harta e Diskut', applications: 'Aplikacionet',
      quarantine: 'Karantina', settings: 'Cilësimet', startup: 'Nisja',
      duplicates: 'Dublikatat', deepClean: 'Pastrim i thellë'
    },
    settings: { language: { title: 'Gjuha', description: 'Gjuha në të cilën shfaqen ekranet e vetë Prune.' } }
  },

  sr: {
    nav: {
      dashboard: 'Контролна табла', diskMap: 'Мапа диска', applications: 'Апликације',
      quarantine: 'Карантин', settings: 'Подешавања', startup: 'Покретање',
      duplicates: 'Дупликати', deepClean: 'Дубинско чишћење'
    },
    settings: { language: { title: 'Језик', description: 'Језик на којем се приказују сопствени екрани Prune-а.' } }
  },

  sv: {
    nav: {
      dashboard: 'Översikt', diskMap: 'Diskkarta', applications: 'Program',
      quarantine: 'Karantän', settings: 'Inställningar', startup: 'Startprogram',
      duplicates: 'Dubbletter', deepClean: 'Grundlig rensning'
    },
    settings: { language: { title: 'Språk', description: 'Språket som Prunes egna skärmar visas på.' } }
  },

  th: {
    nav: {
      dashboard: 'แดชบอร์ด', diskMap: 'แผนที่ดิสก์', applications: 'แอปพลิเคชัน',
      quarantine: 'กักกัน', settings: 'การตั้งค่า', startup: 'โปรแกรมเริ่มต้น',
      duplicates: 'ไฟล์ซ้ำ', deepClean: 'ทำความสะอาดเชิงลึก'
    },
    settings: { language: { title: 'ภาษา', description: 'ภาษาที่หน้าจอของ Prune เองแสดงผล' } }
  },

  tr: {
    nav: {
      dashboard: 'Panel', diskMap: 'Disk Haritası', applications: 'Uygulamalar',
      quarantine: 'Karantina', settings: 'Ayarlar', startup: 'Başlangıç',
      duplicates: 'Yinelenenler', deepClean: 'Derinlemesine Temizlik'
    },
    settings: { language: { title: 'Dil', description: "Prune'un kendi ekranlarının gösterildiği dil." } }
  },

  uk: {
    nav: {
      dashboard: 'Панель', diskMap: 'Карта диска', applications: 'Застосунки',
      quarantine: 'Карантин', settings: 'Налаштування', startup: 'Автозавантаження',
      duplicates: 'Дублікати', deepClean: 'Глибоке очищення'
    },
    settings: { language: { title: 'Мова', description: 'Мова, якою відображаються власні екрани Prune.' } }
  },

  vi: {
    nav: {
      dashboard: 'Bảng điều khiển', diskMap: 'Bản đồ ổ đĩa', applications: 'Ứng dụng',
      quarantine: 'Cách ly', settings: 'Cài đặt', startup: 'Khởi động cùng',
      duplicates: 'Tệp trùng lặp', deepClean: 'Dọn dẹp sâu'
    },
    settings: { language: { title: 'Ngôn ngữ', description: 'Ngôn ngữ hiển thị trên chính màn hình của Prune.' } }
  },

  'zh-CN': {
    nav: {
      dashboard: '仪表盘', diskMap: '磁盘地图', applications: '应用程序',
      quarantine: '隔离区', settings: '设置', startup: '启动项',
      duplicates: '重复文件', deepClean: '深度清理'
    },
    settings: { language: { title: '语言', description: 'Prune 自身界面所使用的语言。' } }
  },

  'zh-TW': {
    nav: {
      dashboard: '儀表板', diskMap: '磁碟地圖', applications: '應用程式',
      quarantine: '隔離區', settings: '設定', startup: '啟動項目',
      duplicates: '重複檔案', deepClean: '深度清理'
    },
    settings: { language: { title: '語言', description: 'Prune 本身畫面所使用的語言。' } }
  }
};
