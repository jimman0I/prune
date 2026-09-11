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
    },
    dashboard: {
      scheduleBadge: {
        // Windows' own status pills (healthStatus, mediaType, busType)
        // and every value formatted by formatBytes/formatRelativeTime are
        // deliberately NOT catalog keys: they are the drive or the OS
        // speaking, not Prune's own copy, the same line this app already
        // draws around an uninstaller's own error text.
        missed: (count) => `${count} scheduled ${count === 1 ? 'run was' : 'runs were'} missed while this PC was off`,
        due: 'A scheduled run is due'
      },
      driveHealth: {
        title: 'Drive Health',
        error: (message) => `Couldn't read drive health: ${message}`,
        loading: 'Reading drive health…',
        unknownStatus: 'Unknown',
        lifeRemaining: (percent) => `${percent}% life remaining`,
        poweredOn: (hours) => `${hours} h powered on`,
        reportsStatus: (status) => `Windows reports this drive ${status}.`,
        statusUnknown: 'status unknown',
        needsAdmin: "Wear, temperature and power-on hours need administrator access — Prune won't show a made-up figure instead.",
        readWear: 'Read drive wear (admin)',
        waitingApproval: 'Waiting for approval…',
        notApproved: 'Not approved — still showing what Windows reports.',
        noWearData: "This drive doesn't report wear data, even as administrator.",
        uncorrectedErrors: (read, write) => `${read} uncorrected read · ${write} uncorrected write errors`
      },
      smart: {
        header: 'Reported by the drive',
        powerOnHours: 'Power-on hours',
        powerCycles: 'Power cycles',
        dataWritten: 'Data written',
        dataRead: 'Data read',
        spareBlocks: 'Spare blocks',
        unsafeShutdowns: 'Unsafe shutdowns',
        mediaErrors: 'Media errors',
        errorLogEntries: 'Error log entries'
      },
      storage: {
        label: 'Total Storage',
        usedTotal: (used, total) => `${used} Used / ${total} Total`,
        loading: 'Loading…',
        free: 'free'
      },
      apps: {
        label: 'Installed Apps',
        broken: (count) => `${count} left behind by a failed uninstall`,
        noBroken: 'No broken entries.',
        review: 'Review',
        manage: 'Manage'
      },
      junk: {
        label: 'Junk Files',
        notMeasured: 'not measured',
        description: 'Measuring walks every cleaner path on the disk — about half a minute.',
        measure: 'Measure'
      },
      recentActivity: {
        title: 'Recent Activity',
        hide: 'Hide',
        show: 'Show',
        empty: 'No uninstalls yet.',
        freed: 'freed'
      }
    }
  },

  af: {
    nav: {
      dashboard: 'Kontroleskerm', diskMap: 'Skyfkaart', applications: 'Toepassings',
      quarantine: 'Karantyn', settings: 'Instellings', startup: 'Opstart',
      duplicates: 'Duplikate', deepClean: 'Grondige Skoonmaak'
    },
    settings: { language: { title: 'Taal', description: "Waarin Prune se eie skerms gewys word." } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `${count} geskeduleerde ${count === 1 ? 'loop' : 'lopies'} is gemis terwyl hierdie rekenaar af was`,
        due: "'n Geskeduleerde loop is nou nodig"
      },
      driveHealth: {
        title: 'Skyfgesondheid',
        error: (message) => `Kon nie skyfgesondheid lees nie: ${message}`,
        loading: 'Lees skyfgesondheid…',
        unknownStatus: 'Onbekend',
        lifeRemaining: (percent) => `${percent}% lewe oor`,
        poweredOn: (hours) => `${hours} h aan`,
        reportsStatus: (status) => `Windows rapporteer hierdie skyf as ${status}.`,
        statusUnknown: 'status onbekend',
        needsAdmin: "Slytasie, temperatuur en aan-tyd het administrateurtoegang nodig — Prune sal nie 'n opgemaakte syfer wys nie.",
        readWear: 'Lees skyfslytasie (admin)',
        waitingApproval: 'Wag vir goedkeuring…',
        notApproved: 'Nie goedgekeur nie — wys steeds wat Windows rapporteer.',
        noWearData: 'Hierdie skyf rapporteer geen slytasiedata nie, selfs as administrateur.',
        uncorrectedErrors: (read, write) => `${read} ongekorrigeerde lees- · ${write} ongekorrigeerde skryffoute`
      },
      smart: {
        header: 'Deur die skyf gerapporteer',
        powerOnHours: 'Aan-ure',
        powerCycles: 'Aan/af-siklusse',
        dataWritten: 'Data geskryf',
        dataRead: 'Data gelees',
        spareBlocks: 'Reserweblokke',
        unsafeShutdowns: 'Onveilige afskakelings',
        mediaErrors: 'Mediafoute',
        errorLogEntries: 'Foutlogboekinskrywings'
      },
      storage: {
        label: 'Totale Berging',
        usedTotal: (used, total) => `${used} Gebruik / ${total} Totaal`,
        loading: 'Laai…',
        free: 'vry'
      },
      apps: {
        label: 'Geïnstalleerde Toepassings',
        broken: (count) => `${count} agtergelaat deur 'n mislukte deïnstallasie`,
        noBroken: 'Geen stukkende inskrywings nie.',
        review: 'Hersien',
        manage: 'Bestuur'
      },
      junk: {
        label: 'Rommellêers',
        notMeasured: 'nie gemeet nie',
        description: "Om te meet loop deur elke skoonmaakpad op die skyf — omtrent 'n halwe minuut.",
        measure: 'Meet'
      },
      recentActivity: {
        title: 'Onlangse Aktiwiteit',
        hide: 'Versteek',
        show: 'Wys',
        empty: 'Nog geen deïnstallasies nie.',
        freed: 'vrygemaak'
      }
    }
  },

  ar: {
    nav: {
      dashboard: 'لوحة التحكم', diskMap: 'خريطة القرص', applications: 'التطبيقات',
      quarantine: 'الحجر', settings: 'الإعدادات', startup: 'بدء التشغيل',
      duplicates: 'الملفات المكررة', deepClean: 'تنظيف عميق'
    },
    settings: { language: { title: 'اللغة', description: 'اللغة التي تُعرض بها شاشات Prune نفسها.' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `تم تفويت ${count} ${count === 1 ? 'تشغيل مجدول' : 'عمليات تشغيل مجدولة'} أثناء إغلاق هذا الجهاز`,
        due: 'حان موعد تشغيل مجدول'
      },
      driveHealth: {
        title: 'صحة القرص',
        error: (message) => `تعذرت قراءة صحة القرص: ${message}`,
        loading: 'جارٍ قراءة صحة القرص…',
        unknownStatus: 'غير معروف',
        lifeRemaining: (percent) => `${percent}٪ من العمر المتبقي`,
        poweredOn: (hours) => `${hours} ساعة تشغيل`,
        reportsStatus: (status) => `يُبلغ Windows أن حالة هذا القرص ${status}.`,
        statusUnknown: 'الحالة غير معروفة',
        needsAdmin: 'التآكل ودرجة الحرارة وساعات التشغيل تتطلب صلاحيات المسؤول — لن يعرض Prune رقمًا وهميًا بدلاً من ذلك.',
        readWear: 'قراءة تآكل القرص (كمسؤول)',
        waitingApproval: 'بانتظار الموافقة…',
        notApproved: 'لم تتم الموافقة — ما زال يُعرض ما يُبلغ عنه Windows.',
        noWearData: 'هذا القرص لا يُبلغ عن بيانات التآكل، حتى كمسؤول.',
        uncorrectedErrors: (read, write) => `${read} أخطاء قراءة غير مصححة · ${write} أخطاء كتابة غير مصححة`
      },
      smart: {
        header: 'من تقارير القرص',
        powerOnHours: 'ساعات التشغيل',
        powerCycles: 'دورات التشغيل',
        dataWritten: 'البيانات المكتوبة',
        dataRead: 'البيانات المقروءة',
        spareBlocks: 'الكتل الاحتياطية',
        unsafeShutdowns: 'إغلاقات غير آمنة',
        mediaErrors: 'أخطاء الوسائط',
        errorLogEntries: 'إدخالات سجل الأخطاء'
      },
      storage: {
        label: 'مساحة التخزين الكلية',
        usedTotal: (used, total) => `${used} مستخدم / ${total} الإجمالي`,
        loading: 'جارٍ التحميل…',
        free: 'متاح'
      },
      apps: {
        label: 'التطبيقات المثبتة',
        broken: (count) => `${count} تُركت بعد إلغاء تثبيت فاشل`,
        noBroken: 'لا توجد إدخالات معطوبة.',
        review: 'مراجعة',
        manage: 'إدارة'
      },
      junk: {
        label: 'الملفات غير الضرورية',
        notMeasured: 'لم تُقاس',
        description: 'يمر القياس بكل مسارات التنظيف على القرص — حوالي نصف دقيقة.',
        measure: 'قياس'
      },
      recentActivity: {
        title: 'النشاط الأخير',
        hide: 'إخفاء',
        show: 'إظهار',
        empty: 'لا عمليات إلغاء تثبيت بعد.',
        freed: 'تم تحريره'
      }
    }
  },

  ca: {
    nav: {
      dashboard: 'Tauler', diskMap: 'Mapa del disc', applications: 'Aplicacions',
      quarantine: 'Quarantena', settings: 'Configuració', startup: 'Inici',
      duplicates: 'Duplicats', deepClean: 'Neteja profunda'
    },
    settings: { language: { title: 'Idioma', description: "L'idioma en què es mostren les pantalles del propi Prune." } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `${count} ${count === 1 ? 'execució programada' : 'execucions programades'} s'${count === 1 ? 'ha' : 'han'} perdut mentre aquest PC estava apagat`,
        due: 'Toca una execució programada'
      },
      driveHealth: {
        title: 'Salut del disc',
        error: (message) => `No s'ha pogut llegir la salut del disc: ${message}`,
        loading: 'Llegint la salut del disc…',
        unknownStatus: 'Desconegut',
        lifeRemaining: (percent) => `${percent}% de vida restant`,
        poweredOn: (hours) => `${hours} h engegat`,
        reportsStatus: (status) => `El Windows indica que aquest disc està ${status}.`,
        statusUnknown: 'estat desconegut',
        needsAdmin: 'El desgast, la temperatura i les hores enceses requereixen accés d\'administrador — Prune no mostrarà una xifra inventada.',
        readWear: 'Llegeix el desgast del disc (admin)',
        waitingApproval: 'Esperant aprovació…',
        notApproved: 'No aprovat — es continua mostrant el que indica el Windows.',
        noWearData: 'Aquest disc no informa de dades de desgast, ni tan sols com a administrador.',
        uncorrectedErrors: (read, write) => `${read} errors de lectura sense corregir · ${write} errors d'escriptura sense corregir`
      },
      smart: {
        header: 'Segons el disc',
        powerOnHours: 'Hores enceses',
        powerCycles: 'Cicles d\'engegada',
        dataWritten: 'Dades escrites',
        dataRead: 'Dades llegides',
        spareBlocks: 'Blocs de reserva',
        unsafeShutdowns: 'Apagades insegures',
        mediaErrors: 'Errors del suport',
        errorLogEntries: 'Entrades del registre d\'errors'
      },
      storage: {
        label: 'Emmagatzematge total',
        usedTotal: (used, total) => `${used} usat / ${total} total`,
        loading: 'Carregant…',
        free: 'lliure'
      },
      apps: {
        label: 'Aplicacions instal·lades',
        broken: (count) => `${count} deixades per una desinstal·lació fallida`,
        noBroken: 'Cap entrada trencada.',
        review: 'Revisa',
        manage: 'Gestiona'
      },
      junk: {
        label: 'Fitxers innecessaris',
        notMeasured: 'no mesurat',
        description: 'Mesurar recorre tots els camins de neteja del disc — mig minut aproximadament.',
        measure: 'Mesura'
      },
      recentActivity: {
        title: 'Activitat recent',
        hide: 'Amaga',
        show: 'Mostra',
        empty: 'Encara cap desinstal·lació.',
        freed: 'alliberat'
      }
    }
  },

  cs: {
    nav: {
      dashboard: 'Přehled', diskMap: 'Mapa disku', applications: 'Aplikace',
      quarantine: 'Karanténa', settings: 'Nastavení', startup: 'Po spuštění',
      duplicates: 'Duplicity', deepClean: 'Důkladné čištění'
    },
    settings: { language: { title: 'Jazyk', description: 'Jazyk, ve kterém se zobrazují obrazovky Prune.' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `${count} ${count === 1 ? 'naplánované spuštění bylo' : 'naplánovaná spuštění byla'} zmeškáno, protože počítač byl vypnutý`,
        due: 'Naplánované spuštění je splatné'
      },
      driveHealth: {
        title: 'Stav disku',
        error: (message) => `Stav disku se nepodařilo načíst: ${message}`,
        loading: 'Načítání stavu disku…',
        unknownStatus: 'Neznámý',
        lifeRemaining: (percent) => `${percent}% zbývající životnosti`,
        poweredOn: (hours) => `${hours} h zapnuto`,
        reportsStatus: (status) => `Windows uvádí stav tohoto disku jako ${status}.`,
        statusUnknown: 'stav neznámý',
        needsAdmin: 'Opotřebení, teplota a doba zapnutí vyžadují oprávnění správce — Prune nezobrazí vymyšlené číslo.',
        readWear: 'Načíst opotřebení disku (admin)',
        waitingApproval: 'Čeká se na schválení…',
        notApproved: 'Neschváleno — stále se zobrazuje to, co uvádí Windows.',
        noWearData: 'Tento disk neposkytuje údaje o opotřebení, ani jako správce.',
        uncorrectedErrors: (read, write) => `${read} neopravených chyb čtení · ${write} neopravených chyb zápisu`
      },
      smart: {
        header: 'Podle disku',
        powerOnHours: 'Hodiny zapnutí',
        powerCycles: 'Cykly zapnutí',
        dataWritten: 'Zapsaná data',
        dataRead: 'Přečtená data',
        spareBlocks: 'Náhradní bloky',
        unsafeShutdowns: 'Nebezpečná vypnutí',
        mediaErrors: 'Chyby média',
        errorLogEntries: 'Záznamy chybového protokolu'
      },
      storage: {
        label: 'Celkové úložiště',
        usedTotal: (used, total) => `${used} použito / ${total} celkem`,
        loading: 'Načítání…',
        free: 'volné'
      },
      apps: {
        label: 'Nainstalované aplikace',
        broken: (count) => `${count} zanechaných neúspěšnou odinstalací`,
        noBroken: 'Žádné poškozené položky.',
        review: 'Zkontrolovat',
        manage: 'Spravovat'
      },
      junk: {
        label: 'Nepotřebné soubory',
        notMeasured: 'neměřeno',
        description: 'Měření projde všechny cesty čištění na disku — asi půl minuty.',
        measure: 'Změřit'
      },
      recentActivity: {
        title: 'Nedávná aktivita',
        hide: 'Skrýt',
        show: 'Zobrazit',
        empty: 'Zatím žádné odinstalace.',
        freed: 'uvolněno'
      }
    }
  },

  cy: {
    nav: {
      dashboard: 'Dangosfwrdd', diskMap: 'Map Disg', applications: 'Rhaglenni',
      quarantine: 'Cwarantin', settings: 'Gosodiadau', startup: 'Cychwyn',
      duplicates: 'Dyblygiadau', deepClean: 'Glanhau Dwfn'
    },
    settings: { language: { title: 'Iaith', description: "Yr iaith y dangosir sgriniau Prune ei hun ynddi." } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `Collwyd ${count} rhediad ${count === 1 ? 'a drefnwyd' : 'wedi\'u trefnu'} tra roedd y cyfrifiadur hwn i ffwrdd`,
        due: 'Mae rhediad a drefnwyd yn ddyledus'
      },
      driveHealth: {
        title: 'Iechyd y Ddisg',
        error: (message) => `Methwyd darllen iechyd y ddisg: ${message}`,
        loading: 'Darllen iechyd y ddisg…',
        unknownStatus: 'Anhysbys',
        lifeRemaining: (percent) => `${percent}% o oes ar ôl`,
        poweredOn: (hours) => `${hours} awr ymlaen`,
        reportsStatus: (status) => `Mae Windows yn nodi bod y ddisg hon yn ${status}.`,
        statusUnknown: 'statws anhysbys',
        needsAdmin: 'Mae traul, tymheredd ac oriau ymlaen angen mynediad gweinyddwr — ni fydd Prune yn dangos ffigwr dyfeisiedig yn lle hynny.',
        readWear: 'Darllen traul y ddisg (gweinyddwr)',
        waitingApproval: 'Aros am gymeradwyaeth…',
        notApproved: 'Heb ei gymeradwyo — yn parhau i ddangos yr hyn mae Windows yn ei nodi.',
        noWearData: 'Nid yw\'r ddisg hon yn nodi data traul, hyd yn oed fel gweinyddwr.',
        uncorrectedErrors: (read, write) => `${read} gwall darllen heb eu cywiro · ${write} gwall ysgrifennu heb eu cywiro`
      },
      smart: {
        header: 'Yn ôl y ddisg',
        powerOnHours: 'Oriau ymlaen',
        powerCycles: 'Cylchoedd pweru',
        dataWritten: 'Data wedi\'i ysgrifennu',
        dataRead: 'Data wedi\'i ddarllen',
        spareBlocks: 'Blociau sbâr',
        unsafeShutdowns: 'Diffoddiadau anniogel',
        mediaErrors: 'Gwallau cyfrwng',
        errorLogEntries: 'Cofnodion log gwallau'
      },
      storage: {
        label: 'Cyfanswm Storfa',
        usedTotal: (used, total) => `${used} wedi'i ddefnyddio / ${total} cyfanswm`,
        loading: 'Llwytho…',
        free: 'rhydd'
      },
      apps: {
        label: 'Rhaglenni wedi\'u Gosod',
        broken: (count) => `${count} wedi'u gadael gan ddadosodiad aflwyddiannus`,
        noBroken: 'Dim cofnodion wedi torri.',
        review: 'Adolygu',
        manage: 'Rheoli'
      },
      junk: {
        label: 'Ffeiliau Sbwriel',
        notMeasured: 'heb ei fesur',
        description: 'Mae mesur yn cerdded pob llwybr glanhau ar y ddisg — tua hanner munud.',
        measure: 'Mesur'
      },
      recentActivity: {
        title: 'Gweithgaredd Diweddar',
        hide: 'Cuddio',
        show: 'Dangos',
        empty: 'Dim dadosodiadau eto.',
        freed: 'wedi\'i ryddhau'
      }
    }
  },

  da: {
    nav: {
      dashboard: 'Oversigt', diskMap: 'Diskkort', applications: 'Programmer',
      quarantine: 'Karantæne', settings: 'Indstillinger', startup: 'Opstart',
      duplicates: 'Dubletter', deepClean: 'Grundig oprydning'
    },
    settings: { language: { title: 'Sprog', description: 'Det sprog, Prunes egne skærme vises på.' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `${count} planlagt${count === 1 ? '' : 'e'} kørsel${count === 1 ? '' : 'er'} blev sprunget over, mens pc'en var slukket`,
        due: 'En planlagt kørsel er forfalden'
      },
      driveHealth: {
        title: 'Diskens tilstand',
        error: (message) => `Kunne ikke læse diskens tilstand: ${message}`,
        loading: 'Læser diskens tilstand…',
        unknownStatus: 'Ukendt',
        lifeRemaining: (percent) => `${percent}% levetid tilbage`,
        poweredOn: (hours) => `${hours} t tændt`,
        reportsStatus: (status) => `Windows rapporterer denne disk som ${status}.`,
        statusUnknown: 'status ukendt',
        needsAdmin: 'Slitage, temperatur og tændt-tid kræver administratoradgang — Prune viser ikke et opdigtet tal i stedet.',
        readWear: 'Læs diskslitage (admin)',
        waitingApproval: 'Venter på godkendelse…',
        notApproved: 'Ikke godkendt — viser stadig det, Windows rapporterer.',
        noWearData: 'Denne disk rapporterer ingen slitagedata, selv som administrator.',
        uncorrectedErrors: (read, write) => `${read} ukorrigerede læsefejl · ${write} ukorrigerede skrivefejl`
      },
      smart: {
        header: 'Rapporteret af disken',
        powerOnHours: 'Timer tændt',
        powerCycles: 'Tænd/sluk-cyklusser',
        dataWritten: 'Data skrevet',
        dataRead: 'Data læst',
        spareBlocks: 'Reserveblokke',
        unsafeShutdowns: 'Usikre nedlukninger',
        mediaErrors: 'Mediefejl',
        errorLogEntries: 'Fejlloggens poster'
      },
      storage: {
        label: 'Samlet Lagerplads',
        usedTotal: (used, total) => `${used} brugt / ${total} i alt`,
        loading: 'Indlæser…',
        free: 'fri'
      },
      apps: {
        label: 'Installerede Programmer',
        broken: (count) => `${count} efterladt af en mislykket afinstallation`,
        noBroken: 'Ingen ødelagte poster.',
        review: 'Gennemgå',
        manage: 'Administrer'
      },
      junk: {
        label: 'Overflødige Filer',
        notMeasured: 'ikke målt',
        description: 'At måle gennemgår hver oprydningssti på disken — omkring et halvt minut.',
        measure: 'Mål'
      },
      recentActivity: {
        title: 'Seneste Aktivitet',
        hide: 'Skjul',
        show: 'Vis',
        empty: 'Ingen afinstallationer endnu.',
        freed: 'frigjort'
      }
    }
  },

  de: {
    nav: {
      dashboard: 'Übersicht', diskMap: 'Festplattenkarte', applications: 'Anwendungen',
      quarantine: 'Quarantäne', settings: 'Einstellungen', startup: 'Autostart',
      duplicates: 'Duplikate', deepClean: 'Gründliche Bereinigung'
    },
    settings: { language: { title: 'Sprache', description: 'Die Sprache, in der Prunes eigene Bildschirme angezeigt werden.' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `${count} geplante${count === 1 ? 'r Lauf wurde' : ' Läufe wurden'} verpasst, während dieser PC aus war`,
        due: 'Ein geplanter Lauf steht an'
      },
      driveHealth: {
        title: 'Laufwerksstatus',
        error: (message) => `Laufwerksstatus konnte nicht gelesen werden: ${message}`,
        loading: 'Laufwerksstatus wird gelesen…',
        unknownStatus: 'Unbekannt',
        lifeRemaining: (percent) => `${percent}% Restlebensdauer`,
        poweredOn: (hours) => `${hours} Std. eingeschaltet`,
        reportsStatus: (status) => `Windows meldet diesen Laufwerksstatus als ${status}.`,
        statusUnknown: 'Status unbekannt',
        needsAdmin: 'Verschleiß, Temperatur und Betriebsstunden erfordern Administratorrechte — Prune zeigt stattdessen keinen erfundenen Wert an.',
        readWear: 'Laufwerksverschleiß lesen (Admin)',
        waitingApproval: 'Warte auf Freigabe…',
        notApproved: 'Nicht genehmigt — zeigt weiterhin an, was Windows meldet.',
        noWearData: 'Dieses Laufwerk meldet keine Verschleißdaten, selbst als Administrator nicht.',
        uncorrectedErrors: (read, write) => `${read} unkorrigierte Lese- · ${write} unkorrigierte Schreibfehler`
      },
      smart: {
        header: 'Vom Laufwerk gemeldet',
        powerOnHours: 'Betriebsstunden',
        powerCycles: 'Einschaltzyklen',
        dataWritten: 'Geschriebene Daten',
        dataRead: 'Gelesene Daten',
        spareBlocks: 'Reserveblöcke',
        unsafeShutdowns: 'Unsichere Abschaltungen',
        mediaErrors: 'Medienfehler',
        errorLogEntries: 'Fehlerprotokolleinträge'
      },
      storage: {
        label: 'Gesamtspeicher',
        usedTotal: (used, total) => `${used} belegt / ${total} gesamt`,
        loading: 'Wird geladen…',
        free: 'frei'
      },
      apps: {
        label: 'Installierte Programme',
        broken: (count) => `${count} von einer fehlgeschlagenen Deinstallation zurückgelassen`,
        noBroken: 'Keine defekten Einträge.',
        review: 'Überprüfen',
        manage: 'Verwalten'
      },
      junk: {
        label: 'Unnötige Dateien',
        notMeasured: 'nicht gemessen',
        description: 'Das Messen durchläuft jeden Bereinigungspfad auf dem Laufwerk — etwa eine halbe Minute.',
        measure: 'Messen'
      },
      recentActivity: {
        title: 'Letzte Aktivität',
        hide: 'Ausblenden',
        show: 'Anzeigen',
        empty: 'Noch keine Deinstallationen.',
        freed: 'freigegeben'
      }
    }
  },

  el: {
    nav: {
      dashboard: 'Πίνακας ελέγχου', diskMap: 'Χάρτης δίσκου', applications: 'Εφαρμογές',
      quarantine: 'Καραντίνα', settings: 'Ρυθμίσεις', startup: 'Εκκίνηση',
      duplicates: 'Διπλότυπα', deepClean: 'Βαθύς καθαρισμός'
    },
    settings: { language: { title: 'Γλώσσα', description: 'Η γλώσσα στην οποία εμφανίζονται οι δικές του οθόνες του Prune.' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `${count} προγραμματισμέν${count === 1 ? 'η εκτέλεση χάθηκε' : 'ες εκτελέσεις χάθηκαν'} όσο αυτός ο υπολογιστής ήταν κλειστός`,
        due: 'Μια προγραμματισμένη εκτέλεση εκκρεμεί'
      },
      driveHealth: {
        title: 'Υγεία Δίσκου',
        error: (message) => `Αδυναμία ανάγνωσης της υγείας του δίσκου: ${message}`,
        loading: 'Ανάγνωση υγείας δίσκου…',
        unknownStatus: 'Άγνωστο',
        lifeRemaining: (percent) => `${percent}% διάρκειας ζωής απομένει`,
        poweredOn: (hours) => `${hours} ώρες σε λειτουργία`,
        reportsStatus: (status) => `Τα Windows αναφέρουν αυτόν τον δίσκο ως ${status}.`,
        statusUnknown: 'άγνωστη κατάσταση',
        needsAdmin: 'Η φθορά, η θερμοκρασία και οι ώρες λειτουργίας απαιτούν πρόσβαση διαχειριστή — το Prune δεν θα εμφανίσει έναν κατασκευασμένο αριθμό αντ\' αυτού.',
        readWear: 'Ανάγνωση φθοράς δίσκου (διαχειριστής)',
        waitingApproval: 'Αναμονή έγκρισης…',
        notApproved: 'Δεν εγκρίθηκε — εξακολουθεί να εμφανίζει ό,τι αναφέρουν τα Windows.',
        noWearData: 'Αυτός ο δίσκος δεν αναφέρει δεδομένα φθοράς, ούτε καν ως διαχειριστής.',
        uncorrectedErrors: (read, write) => `${read} μη διορθωμένα σφάλματα ανάγνωσης · ${write} μη διορθωμένα σφάλματα εγγραφής`
      },
      smart: {
        header: 'Όπως αναφέρεται από τον δίσκο',
        powerOnHours: 'Ώρες λειτουργίας',
        powerCycles: 'Κύκλοι ενεργοποίησης',
        dataWritten: 'Δεδομένα που γράφτηκαν',
        dataRead: 'Δεδομένα που διαβάστηκαν',
        spareBlocks: 'Εφεδρικά μπλοκ',
        unsafeShutdowns: 'Μη ασφαλείς τερματισμοί',
        mediaErrors: 'Σφάλματα μέσου',
        errorLogEntries: 'Καταχωρίσεις αρχείου σφαλμάτων'
      },
      storage: {
        label: 'Συνολικός Αποθηκευτικός Χώρος',
        usedTotal: (used, total) => `${used} σε χρήση / ${total} σύνολο`,
        loading: 'Φόρτωση…',
        free: 'ελεύθερο'
      },
      apps: {
        label: 'Εγκατεστημένες Εφαρμογές',
        broken: (count) => `${count} απομεινάρια από αποτυχημένη απεγκατάσταση`,
        noBroken: 'Καμία κατεστραμμένη καταχώριση.',
        review: 'Έλεγχος',
        manage: 'Διαχείριση'
      },
      junk: {
        label: 'Άχρηστα Αρχεία',
        notMeasured: 'δεν έχει μετρηθεί',
        description: 'Η μέτρηση διατρέχει κάθε διαδρομή καθαρισμού στον δίσκο — περίπου μισό λεπτό.',
        measure: 'Μέτρηση'
      },
      recentActivity: {
        title: 'Πρόσφατη Δραστηριότητα',
        hide: 'Απόκρυψη',
        show: 'Εμφάνιση',
        empty: 'Καμία απεγκατάσταση ακόμη.',
        freed: 'ελευθερώθηκαν'
      }
    }
  },

  es: {
    nav: {
      dashboard: 'Panel', diskMap: 'Mapa del disco', applications: 'Aplicaciones',
      quarantine: 'Cuarentena', settings: 'Configuración', startup: 'Inicio',
      duplicates: 'Duplicados', deepClean: 'Limpieza profunda'
    },
    settings: { language: { title: 'Idioma', description: 'El idioma en el que se muestran las propias pantallas de Prune.' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `Se ${count === 1 ? 'omitió' : 'omitieron'} ${count} ejecución${count === 1 ? '' : 'es'} programada${count === 1 ? '' : 's'} mientras este PC estaba apagado`,
        due: 'Hay una ejecución programada pendiente'
      },
      driveHealth: {
        title: 'Salud del disco',
        error: (message) => `No se pudo leer la salud del disco: ${message}`,
        loading: 'Leyendo la salud del disco…',
        unknownStatus: 'Desconocido',
        lifeRemaining: (percent) => `${percent}% de vida restante`,
        poweredOn: (hours) => `${hours} h encendido`,
        reportsStatus: (status) => `Windows indica que este disco está ${status}.`,
        statusUnknown: 'estado desconocido',
        needsAdmin: 'El desgaste, la temperatura y las horas de encendido requieren acceso de administrador — Prune no mostrará una cifra inventada en su lugar.',
        readWear: 'Leer el desgaste del disco (admin)',
        waitingApproval: 'Esperando aprobación…',
        notApproved: 'No aprobado — se sigue mostrando lo que indica Windows.',
        noWearData: 'Este disco no informa datos de desgaste, ni siquiera como administrador.',
        uncorrectedErrors: (read, write) => `${read} errores de lectura sin corregir · ${write} errores de escritura sin corregir`
      },
      smart: {
        header: 'Según el disco',
        powerOnHours: 'Horas encendido',
        powerCycles: 'Ciclos de encendido',
        dataWritten: 'Datos escritos',
        dataRead: 'Datos leídos',
        spareBlocks: 'Bloques de repuesto',
        unsafeShutdowns: 'Apagados inseguros',
        mediaErrors: 'Errores de medio',
        errorLogEntries: 'Entradas del registro de errores'
      },
      storage: {
        label: 'Almacenamiento Total',
        usedTotal: (used, total) => `${used} usado / ${total} total`,
        loading: 'Cargando…',
        free: 'libre'
      },
      apps: {
        label: 'Aplicaciones Instaladas',
        broken: (count) => `${count} dejadas por una desinstalación fallida`,
        noBroken: 'Sin entradas rotas.',
        review: 'Revisar',
        manage: 'Gestionar'
      },
      junk: {
        label: 'Archivos Innecesarios',
        notMeasured: 'sin medir',
        description: 'Medir recorre cada ruta de limpieza del disco — medio minuto aproximadamente.',
        measure: 'Medir'
      },
      recentActivity: {
        title: 'Actividad Reciente',
        hide: 'Ocultar',
        show: 'Mostrar',
        empty: 'Aún no hay desinstalaciones.',
        freed: 'liberado'
      }
    }
  },

  et: {
    nav: {
      dashboard: 'Töölaud', diskMap: 'Kettakaart', applications: 'Rakendused',
      quarantine: 'Karantiin', settings: 'Seaded', startup: 'Käivitus',
      duplicates: 'Duplikaadid', deepClean: 'Põhjalik puhastus'
    },
    settings: { language: { title: 'Keel', description: 'Keel, milles Prune oma ekraanid kuvatakse.' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `${count} plaanitud käiku jäi vahele, kuna see arvuti oli välja lülitatud`,
        due: 'Plaanitud käik on tähtaja ületanud'
      },
      driveHealth: {
        title: 'Ketta seisund',
        error: (message) => `Ketta seisundit ei õnnestunud lugeda: ${message}`,
        loading: 'Ketta seisundi lugemine…',
        unknownStatus: 'Teadmata',
        lifeRemaining: (percent) => `${percent}% eluiga järel`,
        poweredOn: (hours) => `${hours} h sisse lülitatud`,
        reportsStatus: (status) => `Windows näitab selle ketta seisundiks ${status}.`,
        statusUnknown: 'seisund teadmata',
        needsAdmin: 'Kulumine, temperatuur ja tööajad vajavad administraatoriõigusi — Prune ei näita selle asemel väljamõeldud arvu.',
        readWear: 'Loe ketta kulumist (admin)',
        waitingApproval: 'Ootab kinnitust…',
        notApproved: 'Ei kinnitatud — näitab jätkuvalt seda, mida Windows näitab.',
        noWearData: 'See ketas ei edasta kulumisandmeid isegi administraatorina.',
        uncorrectedErrors: (read, write) => `${read} parandamata lugemisviga · ${write} parandamata kirjutamisviga`
      },
      smart: {
        header: 'Ketta enda andmetel',
        powerOnHours: 'Töötunnid',
        powerCycles: 'Sisselülitustsüklid',
        dataWritten: 'Kirjutatud andmed',
        dataRead: 'Loetud andmed',
        spareBlocks: 'Varuplokid',
        unsafeShutdowns: 'Ohtlikud väljalülitused',
        mediaErrors: 'Andmekandja vead',
        errorLogEntries: 'Vealogi kirjed'
      },
      storage: {
        label: 'Kogumaht',
        usedTotal: (used, total) => `${used} kasutusel / ${total} kokku`,
        loading: 'Laadimine…',
        free: 'vaba'
      },
      apps: {
        label: 'Installitud Rakendused',
        broken: (count) => `${count} jäänud maha ebaõnnestunud desinstallimisest`,
        noBroken: 'Rikutud kirjeid pole.',
        review: 'Vaata üle',
        manage: 'Halda'
      },
      junk: {
        label: 'Prügifailid',
        notMeasured: 'mõõtmata',
        description: 'Mõõtmine käib läbi iga puhastustee kettal — umbes pool minutit.',
        measure: 'Mõõda'
      },
      recentActivity: {
        title: 'Hiljutine Tegevus',
        hide: 'Peida',
        show: 'Näita',
        empty: 'Desinstallimisi pole veel olnud.',
        freed: 'vabastatud'
      }
    }
  },

  fi: {
    nav: {
      dashboard: 'Yhteenveto', diskMap: 'Levykartta', applications: 'Sovellukset',
      quarantine: 'Karanteeni', settings: 'Asetukset', startup: 'Käynnistys',
      duplicates: 'Kaksoiskappaleet', deepClean: 'Perusteellinen siivous'
    },
    settings: { language: { title: 'Kieli', description: 'Kieli, jolla Prunen omat näytöt näytetään.' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `${count} ajastettua ajoa jäi väliin, kun tämä tietokone oli pois päältä`,
        due: 'Ajastettu ajo on myöhässä'
      },
      driveHealth: {
        title: 'Levyn kunto',
        error: (message) => `Levyn kuntoa ei voitu lukea: ${message}`,
        loading: 'Luetaan levyn kuntoa…',
        unknownStatus: 'Tuntematon',
        lifeRemaining: (percent) => `${percent}% käyttöikää jäljellä`,
        poweredOn: (hours) => `${hours} h päällä`,
        reportsStatus: (status) => `Windows ilmoittaa tämän levyn tilaksi ${status}.`,
        statusUnknown: 'tila tuntematon',
        needsAdmin: 'Kuluminen, lämpötila ja käyttötunnit vaativat järjestelmänvalvojan oikeudet — Prune ei näytä keksittyä lukua sen sijaan.',
        readWear: 'Lue levyn kuluminen (valvoja)',
        waitingApproval: 'Odotetaan hyväksyntää…',
        notApproved: 'Ei hyväksytty — näyttää edelleen sen, mitä Windows ilmoittaa.',
        noWearData: 'Tämä levy ei ilmoita kulumistietoja edes valvojana.',
        uncorrectedErrors: (read, write) => `${read} korjaamatonta lukuvirhettä · ${write} korjaamatonta kirjoitusvirhettä`
      },
      smart: {
        header: 'Levyn oman ilmoituksen mukaan',
        powerOnHours: 'Käyttötunnit',
        powerCycles: 'Käynnistyskerrat',
        dataWritten: 'Kirjoitettu data',
        dataRead: 'Luettu data',
        spareBlocks: 'Varalohkot',
        unsafeShutdowns: 'Vaaralliset sammutukset',
        mediaErrors: 'Tallennusvälinevirheet',
        errorLogEntries: 'Virhelokin merkinnät'
      },
      storage: {
        label: 'Tallennustila Yhteensä',
        usedTotal: (used, total) => `${used} käytetty / ${total} yhteensä`,
        loading: 'Ladataan…',
        free: 'vapaana'
      },
      apps: {
        label: 'Asennetut Sovellukset',
        broken: (count) => `${count} jäänyt epäonnistuneesta poistosta`,
        noBroken: 'Ei rikkinäisiä merkintöjä.',
        review: 'Tarkista',
        manage: 'Hallitse'
      },
      junk: {
        label: 'Roskatiedostot',
        notMeasured: 'ei mitattu',
        description: 'Mittaus käy läpi jokaisen puhdistuspolun levyllä — noin puoli minuuttia.',
        measure: 'Mittaa'
      },
      recentActivity: {
        title: 'Viimeaikainen Toiminta',
        hide: 'Piilota',
        show: 'Näytä',
        empty: 'Ei vielä poistoja.',
        freed: 'vapautettu'
      }
    }
  },

  fr: {
    nav: {
      dashboard: 'Tableau de bord', diskMap: 'Carte du disque', applications: 'Applications',
      quarantine: 'Quarantaine', settings: 'Paramètres', startup: 'Démarrage',
      duplicates: 'Doublons', deepClean: 'Nettoyage approfondi'
    },
    settings: { language: { title: 'Langue', description: 'La langue dans laquelle les écrans de Prune sont affichés.' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `${count} exécution${count === 1 ? '' : 's'} programmée${count === 1 ? '' : 's'} manquée${count === 1 ? '' : 's'} pendant que ce PC était éteint`,
        due: 'Une exécution programmée est due'
      },
      driveHealth: {
        title: 'État du disque',
        error: (message) => `Impossible de lire l'état du disque : ${message}`,
        loading: 'Lecture de l\'état du disque…',
        unknownStatus: 'Inconnu',
        lifeRemaining: (percent) => `${percent}% de durée de vie restante`,
        poweredOn: (hours) => `${hours} h sous tension`,
        reportsStatus: (status) => `Windows indique que ce disque est ${status}.`,
        statusUnknown: 'état inconnu',
        needsAdmin: "L'usure, la température et les heures sous tension nécessitent un accès administrateur — Prune n'affichera pas un chiffre inventé à la place.",
        readWear: 'Lire l\'usure du disque (admin)',
        waitingApproval: 'En attente d\'approbation…',
        notApproved: 'Non approuvé — affiche toujours ce que Windows indique.',
        noWearData: "Ce disque ne fournit aucune donnée d'usure, même en tant qu'administrateur.",
        uncorrectedErrors: (read, write) => `${read} erreurs de lecture non corrigées · ${write} erreurs d'écriture non corrigées`
      },
      smart: {
        header: 'Selon le disque',
        powerOnHours: 'Heures sous tension',
        powerCycles: 'Cycles de mise sous tension',
        dataWritten: 'Données écrites',
        dataRead: 'Données lues',
        spareBlocks: 'Blocs de réserve',
        unsafeShutdowns: 'Arrêts non sécurisés',
        mediaErrors: 'Erreurs de support',
        errorLogEntries: 'Entrées du journal d\'erreurs'
      },
      storage: {
        label: 'Stockage Total',
        usedTotal: (used, total) => `${used} utilisé / ${total} au total`,
        loading: 'Chargement…',
        free: 'libre'
      },
      apps: {
        label: 'Applications Installées',
        broken: (count) => `${count} laissée${count === 1 ? '' : 's'} par une désinstallation échouée`,
        noBroken: 'Aucune entrée corrompue.',
        review: 'Vérifier',
        manage: 'Gérer'
      },
      junk: {
        label: 'Fichiers Inutiles',
        notMeasured: 'non mesuré',
        description: 'La mesure parcourt chaque chemin de nettoyage du disque — environ une demi-minute.',
        measure: 'Mesurer'
      },
      recentActivity: {
        title: 'Activité Récente',
        hide: 'Masquer',
        show: 'Afficher',
        empty: 'Aucune désinstallation pour le moment.',
        freed: 'libéré'
      }
    }
  },

  he: {
    nav: {
      dashboard: 'לוח בקרה', diskMap: 'מפת הדיסק', applications: 'יישומים',
      quarantine: 'הסגר', settings: 'הגדרות', startup: 'הפעלה',
      duplicates: 'כפילויות', deepClean: 'ניקוי מעמיק'
    },
    settings: { language: { title: 'שפה', description: 'השפה שבה מוצגים המסכים של Prune עצמו.' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `${count} ${count === 1 ? 'הרצה מתוזמנת פוספסה' : 'הרצות מתוזמנות פוספסו'} בזמן שהמחשב היה כבוי`,
        due: 'הרצה מתוזמנת ממתינה'
      },
      driveHealth: {
        title: 'תקינות הדיסק',
        error: (message) => `לא ניתן היה לקרוא את תקינות הדיסק: ${message}`,
        loading: 'קורא את תקינות הדיסק…',
        unknownStatus: 'לא ידוע',
        lifeRemaining: (percent) => `${percent}% אורך חיים נותר`,
        poweredOn: (hours) => `${hours} שעות פעולה`,
        reportsStatus: (status) => `Windows מדווח שדיסק זה במצב ${status}.`,
        statusUnknown: 'מצב לא ידוע',
        needsAdmin: 'בלאי, טמפרטורה ושעות פעולה דורשים גישת מנהל — Prune לא יציג מספר בדוי במקום זאת.',
        readWear: 'קריאת בלאי הדיסק (מנהל)',
        waitingApproval: 'ממתין לאישור…',
        notApproved: 'לא אושר — עדיין מציג את מה ש-Windows מדווח.',
        noWearData: 'דיסק זה אינו מדווח נתוני בלאי, אפילו כמנהל.',
        uncorrectedErrors: (read, write) => `${read} שגיאות קריאה שלא תוקנו · ${write} שגיאות כתיבה שלא תוקנו`
      },
      smart: {
        header: 'לפי דיווח הדיסק',
        powerOnHours: 'שעות פעולה',
        powerCycles: 'מחזורי הפעלה',
        dataWritten: 'נתונים שנכתבו',
        dataRead: 'נתונים שנקראו',
        spareBlocks: 'בלוקים רזרביים',
        unsafeShutdowns: 'כיבויים לא בטוחים',
        mediaErrors: 'שגיאות מדיה',
        errorLogEntries: 'רשומות יומן שגיאות'
      },
      storage: {
        label: 'אחסון כולל',
        usedTotal: (used, total) => `${used} בשימוש / ${total} סה"כ`,
        loading: 'טוען…',
        free: 'פנוי'
      },
      apps: {
        label: 'אפליקציות מותקנות',
        broken: (count) => `${count} נותרו מהסרה שנכשלה`,
        noBroken: 'אין רשומות פגומות.',
        review: 'סקירה',
        manage: 'ניהול'
      },
      junk: {
        label: 'קבצים מיותרים',
        notMeasured: 'לא נמדד',
        description: 'המדידה עוברת בכל נתיבי הניקוי בדיסק — כחצי דקה.',
        measure: 'מדוד'
      },
      recentActivity: {
        title: 'פעילות אחרונה',
        hide: 'הסתר',
        show: 'הצג',
        empty: 'אין עדיין הסרות התקנה.',
        freed: 'שוחרר'
      }
    }
  },

  hu: {
    nav: {
      dashboard: 'Áttekintés', diskMap: 'Lemeztérkép', applications: 'Alkalmazások',
      quarantine: 'Karantén', settings: 'Beállítások', startup: 'Indítás',
      duplicates: 'Duplikátumok', deepClean: 'Alapos tisztítás'
    },
    settings: { language: { title: 'Nyelv', description: 'A nyelv, amelyen a Prune saját képernyői megjelennek.' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `${count} ütemezett futás maradt ki, amíg ez a gép ki volt kapcsolva`,
        due: 'Egy ütemezett futás esedékes'
      },
      driveHealth: {
        title: 'Meghajtó Állapota',
        error: (message) => `A meghajtó állapota nem olvasható: ${message}`,
        loading: 'Meghajtó állapotának olvasása…',
        unknownStatus: 'Ismeretlen',
        lifeRemaining: (percent) => `${percent}% hátralévő élettartam`,
        poweredOn: (hours) => `${hours} óra bekapcsolva`,
        reportsStatus: (status) => `A Windows szerint ennek a meghajtónak az állapota ${status}.`,
        statusUnknown: 'állapot ismeretlen',
        needsAdmin: 'A kopáshoz, hőmérséklethez és üzemidőhöz rendszergazdai hozzáférés szükséges — a Prune nem fog helyette kitalált értéket mutatni.',
        readWear: 'Meghajtó kopásának olvasása (admin)',
        waitingApproval: 'Jóváhagyásra vár…',
        notApproved: 'Nincs jóváhagyva — továbbra is azt mutatja, amit a Windows jelent.',
        noWearData: 'Ez a meghajtó nem jelent kopási adatokat, még rendszergazdaként sem.',
        uncorrectedErrors: (read, write) => `${read} javítatlan olvasási · ${write} javítatlan írási hiba`
      },
      smart: {
        header: 'A meghajtó saját jelentése szerint',
        powerOnHours: 'Üzemórák',
        powerCycles: 'Bekapcsolási ciklusok',
        dataWritten: 'Írt adat',
        dataRead: 'Olvasott adat',
        spareBlocks: 'Tartalék blokkok',
        unsafeShutdowns: 'Nem biztonságos leállások',
        mediaErrors: 'Adathordozó-hibák',
        errorLogEntries: 'Hibanapló-bejegyzések'
      },
      storage: {
        label: 'Teljes Tárhely',
        usedTotal: (used, total) => `${used} felhasználva / ${total} összesen`,
        loading: 'Betöltés…',
        free: 'szabad'
      },
      apps: {
        label: 'Telepített Alkalmazások',
        broken: (count) => `${count} sikertelen eltávolítás után maradt`,
        noBroken: 'Nincsenek sérült bejegyzések.',
        review: 'Áttekintés',
        manage: 'Kezelés'
      },
      junk: {
        label: 'Felesleges Fájlok',
        notMeasured: 'nincs megmérve',
        description: 'A mérés végigmegy a lemez minden tisztítási útvonalán — kb. fél perc.',
        measure: 'Mérés'
      },
      recentActivity: {
        title: 'Legutóbbi Tevékenység',
        hide: 'Elrejtés',
        show: 'Megjelenítés',
        empty: 'Még nincs eltávolítás.',
        freed: 'felszabadítva'
      }
    }
  },

  id: {
    nav: {
      dashboard: 'Dasbor', diskMap: 'Peta Disk', applications: 'Aplikasi',
      quarantine: 'Karantina', settings: 'Pengaturan', startup: 'Mulai Otomatis',
      duplicates: 'Duplikat', deepClean: 'Pembersihan Menyeluruh'
    },
    settings: { language: { title: 'Bahasa', description: 'Bahasa yang digunakan untuk menampilkan layar Prune sendiri.' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `${count} proses terjadwal terlewat saat PC ini mati`,
        due: 'Ada proses terjadwal yang jatuh tempo'
      },
      driveHealth: {
        title: 'Kesehatan Disk',
        error: (message) => `Tidak dapat membaca kesehatan disk: ${message}`,
        loading: 'Membaca kesehatan disk…',
        unknownStatus: 'Tidak diketahui',
        lifeRemaining: (percent) => `${percent}% masa pakai tersisa`,
        poweredOn: (hours) => `${hours} jam menyala`,
        reportsStatus: (status) => `Windows melaporkan disk ini sebagai ${status}.`,
        statusUnknown: 'status tidak diketahui',
        needsAdmin: 'Keausan, suhu, dan jam menyala memerlukan akses administrator — Prune tidak akan menampilkan angka rekaan sebagai gantinya.',
        readWear: 'Baca keausan disk (admin)',
        waitingApproval: 'Menunggu persetujuan…',
        notApproved: 'Tidak disetujui — tetap menampilkan apa yang dilaporkan Windows.',
        noWearData: 'Disk ini tidak melaporkan data keausan, bahkan sebagai administrator.',
        uncorrectedErrors: (read, write) => `${read} kesalahan baca yang tidak dikoreksi · ${write} kesalahan tulis yang tidak dikoreksi`
      },
      smart: {
        header: 'Menurut laporan disk',
        powerOnHours: 'Jam menyala',
        powerCycles: 'Siklus daya',
        dataWritten: 'Data ditulis',
        dataRead: 'Data dibaca',
        spareBlocks: 'Blok cadangan',
        unsafeShutdowns: 'Mati mendadak tidak aman',
        mediaErrors: 'Kesalahan media',
        errorLogEntries: 'Entri log kesalahan'
      },
      storage: {
        label: 'Total Penyimpanan',
        usedTotal: (used, total) => `${used} Terpakai / ${total} Total`,
        loading: 'Memuat…',
        free: 'bebas'
      },
      apps: {
        label: 'Aplikasi Terpasang',
        broken: (count) => `${count} tertinggal akibat pencopotan yang gagal`,
        noBroken: 'Tidak ada entri yang rusak.',
        review: 'Tinjau',
        manage: 'Kelola'
      },
      junk: {
        label: 'File Sampah',
        notMeasured: 'belum diukur',
        description: 'Mengukur menelusuri setiap jalur pembersihan di disk — sekitar setengah menit.',
        measure: 'Ukur'
      },
      recentActivity: {
        title: 'Aktivitas Terbaru',
        hide: 'Sembunyikan',
        show: 'Tampilkan',
        empty: 'Belum ada pencopotan.',
        freed: 'dibebaskan'
      }
    }
  },

  is: {
    nav: {
      dashboard: 'Yfirlit', diskMap: 'Diskakort', applications: 'Forrit',
      quarantine: 'Sóttkví', settings: 'Stillingar', startup: 'Ræsing',
      duplicates: 'Tvítök', deepClean: 'Ítarleg hreinsun'
    },
    settings: { language: { title: 'Tungumál', description: 'Tungumálið sem skjáir Prune sjálfs birtast á.' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `${count} áætluð keyrsla var ${count === 1 ? '' : ''}misst af meðan þessi tölva var slökkt`,
        due: 'Áætluð keyrsla er á gjalddaga'
      },
      driveHealth: {
        title: 'Heilsa Disks',
        error: (message) => `Ekki tókst að lesa heilsu disksins: ${message}`,
        loading: 'Les heilsu disksins…',
        unknownStatus: 'Óþekkt',
        lifeRemaining: (percent) => `${percent}% líftíma eftir`,
        poweredOn: (hours) => `${hours} klst. í gangi`,
        reportsStatus: (status) => `Windows segir þennan disk vera ${status}.`,
        statusUnknown: 'staða óþekkt',
        needsAdmin: 'Slit, hitastig og keyrslutími krefjast kerfisstjóraaðgangs — Prune mun ekki sýna uppspunna tölu í staðinn.',
        readWear: 'Lesa slit disks (kerfisstjóri)',
        waitingApproval: 'Bíður samþykkis…',
        notApproved: 'Ekki samþykkt — sýnir enn það sem Windows greinir frá.',
        noWearData: 'Þessi diskur greinir ekki frá slitgögnum, jafnvel ekki sem kerfisstjóri.',
        uncorrectedErrors: (read, write) => `${read} óleiðréttar lestrarvillur · ${write} óleiðréttar skrifvillur`
      },
      smart: {
        header: 'Samkvæmt disknum sjálfum',
        powerOnHours: 'Klukkustundir í gangi',
        powerCycles: 'Ræsingar',
        dataWritten: 'Gögn skrifuð',
        dataRead: 'Gögn lesin',
        spareBlocks: 'Varablokkir',
        unsafeShutdowns: 'Óöruggar slökkvanir',
        mediaErrors: 'Miðilsvillur',
        errorLogEntries: 'Færslur í villuskrá'
      },
      storage: {
        label: 'Heildargeymsla',
        usedTotal: (used, total) => `${used} notað / ${total} samtals`,
        loading: 'Hleð…',
        free: 'laust'
      },
      apps: {
        label: 'Uppsett Forrit',
        broken: (count) => `${count} skilin eftir vegna mistekinnar affermingar`,
        noBroken: 'Engar skemmdar færslur.',
        review: 'Yfirfara',
        manage: 'Stjórna'
      },
      junk: {
        label: 'Óþarfa Skrár',
        notMeasured: 'ekki mælt',
        description: 'Mæling fer yfir hverja hreinsileið á disknum — um hálfa mínútu.',
        measure: 'Mæla'
      },
      recentActivity: {
        title: 'Nýleg Virkni',
        hide: 'Fela',
        show: 'Sýna',
        empty: 'Engar affermingar ennþá.',
        freed: 'losað'
      }
    }
  },

  it: {
    nav: {
      dashboard: 'Pannello', diskMap: 'Mappa del disco', applications: 'Applicazioni',
      quarantine: 'Quarantena', settings: 'Impostazioni', startup: 'Avvio',
      duplicates: 'Duplicati', deepClean: 'Pulizia approfondita'
    },
    settings: { language: { title: 'Lingua', description: 'La lingua in cui vengono mostrate le schermate di Prune.' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `${count} esecuzion${count === 1 ? 'e programmata è stata' : 'i programmate sono state'} saltate mentre questo PC era spento`,
        due: 'Un\'esecuzione programmata è in scadenza'
      },
      driveHealth: {
        title: 'Salute del Disco',
        error: (message) => `Impossibile leggere lo stato di salute del disco: ${message}`,
        loading: 'Lettura dello stato del disco…',
        unknownStatus: 'Sconosciuto',
        lifeRemaining: (percent) => `${percent}% di vita residua`,
        poweredOn: (hours) => `${hours} h di accensione`,
        reportsStatus: (status) => `Windows segnala questo disco come ${status}.`,
        statusUnknown: 'stato sconosciuto',
        needsAdmin: "Usura, temperatura e ore di accensione richiedono l'accesso come amministratore — Prune non mostrerà una cifra inventata al posto loro.",
        readWear: "Leggi l'usura del disco (admin)",
        waitingApproval: 'In attesa di approvazione…',
        notApproved: 'Non approvato — continua a mostrare ciò che segnala Windows.',
        noWearData: "Questo disco non riporta dati sull'usura, nemmeno come amministratore.",
        uncorrectedErrors: (read, write) => `${read} errori di lettura non corretti · ${write} errori di scrittura non corretti`
      },
      smart: {
        header: 'Come segnalato dal disco',
        powerOnHours: 'Ore di accensione',
        powerCycles: 'Cicli di accensione',
        dataWritten: 'Dati scritti',
        dataRead: 'Dati letti',
        spareBlocks: 'Blocchi di riserva',
        unsafeShutdowns: 'Spegnimenti non sicuri',
        mediaErrors: 'Errori del supporto',
        errorLogEntries: 'Voci del registro errori'
      },
      storage: {
        label: 'Spazio di Archiviazione Totale',
        usedTotal: (used, total) => `${used} usato / ${total} totale`,
        loading: 'Caricamento…',
        free: 'libero'
      },
      apps: {
        label: 'Applicazioni Installate',
        broken: (count) => `${count} lasciate da una disinstallazione non riuscita`,
        noBroken: 'Nessuna voce danneggiata.',
        review: 'Rivedi',
        manage: 'Gestisci'
      },
      junk: {
        label: 'File Inutili',
        notMeasured: 'non misurato',
        description: 'La misurazione percorre ogni percorso di pulizia sul disco — circa mezzo minuto.',
        measure: 'Misura'
      },
      recentActivity: {
        title: 'Attività Recente',
        hide: 'Nascondi',
        show: 'Mostra',
        empty: 'Ancora nessuna disinstallazione.',
        freed: 'liberato'
      }
    }
  },

  ja: {
    nav: {
      dashboard: 'ダッシュボード', diskMap: 'ディスクマップ', applications: 'アプリケーション',
      quarantine: '隔離', settings: '設定', startup: 'スタートアップ',
      duplicates: '重複ファイル', deepClean: 'ディープクリーン'
    },
    settings: { language: { title: '言語', description: 'Prune 自身の画面が表示される言語です。' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `このPCの電源が切れている間に、予定されていた実行が${count}回スキップされました`,
        due: '予定された実行が期限を過ぎています'
      },
      driveHealth: {
        title: 'ドライブの状態',
        error: (message) => `ドライブの状態を読み取れませんでした: ${message}`,
        loading: 'ドライブの状態を読み取っています…',
        unknownStatus: '不明',
        lifeRemaining: (percent) => `残り寿命 ${percent}%`,
        poweredOn: (hours) => `通電時間 ${hours} 時間`,
        reportsStatus: (status) => `Windows はこのドライブの状態を ${status} と報告しています。`,
        statusUnknown: '状態不明',
        needsAdmin: '摩耗、温度、通電時間を表示するには管理者権限が必要です — Prune は代わりに架空の数値を表示しません。',
        readWear: 'ドライブの摩耗を読み取る（管理者）',
        waitingApproval: '承認を待っています…',
        notApproved: '承認されませんでした — 引き続き Windows の報告どおりに表示します。',
        noWearData: 'このドライブは管理者権限でも摩耗データを報告しません。',
        uncorrectedErrors: (read, write) => `未修正の読み取りエラー ${read} 件 · 未修正の書き込みエラー ${write} 件`
      },
      smart: {
        header: 'ドライブ自身の報告による',
        powerOnHours: '通電時間',
        powerCycles: '電源投入回数',
        dataWritten: '書き込みデータ量',
        dataRead: '読み取りデータ量',
        spareBlocks: '予備ブロック',
        unsafeShutdowns: '異常なシャットダウン',
        mediaErrors: 'メディアエラー',
        errorLogEntries: 'エラーログの件数'
      },
      storage: {
        label: 'ストレージ合計',
        usedTotal: (used, total) => `${used} 使用中 / ${total} 合計`,
        loading: '読み込み中…',
        free: '空き'
      },
      apps: {
        label: 'インストール済みアプリ',
        broken: (count) => `アンインストール失敗により残された項目が${count}件`,
        noBroken: '壊れた項目はありません。',
        review: '確認',
        manage: '管理'
      },
      junk: {
        label: '不要なファイル',
        notMeasured: '未測定',
        description: '測定はディスク上のすべてのクリーンアップパスを調べます — 約30秒。',
        measure: '測定'
      },
      recentActivity: {
        title: '最近のアクティビティ',
        hide: '隠す',
        show: '表示',
        empty: 'まだアンインストールはありません。',
        freed: '解放'
      }
    }
  },

  ko: {
    nav: {
      dashboard: '대시보드', diskMap: '디스크 맵', applications: '애플리케이션',
      quarantine: '격리', settings: '설정', startup: '시작 프로그램',
      duplicates: '중복 파일', deepClean: '딥 클린'
    },
    settings: { language: { title: '언어', description: 'Prune 자체 화면이 표시되는 언어입니다.' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `이 PC가 꺼져 있는 동안 예약된 실행 ${count}건을 놓쳤습니다`,
        due: '예약된 실행이 지연되고 있습니다'
      },
      driveHealth: {
        title: '드라이브 상태',
        error: (message) => `드라이브 상태를 읽을 수 없습니다: ${message}`,
        loading: '드라이브 상태를 읽는 중…',
        unknownStatus: '알 수 없음',
        lifeRemaining: (percent) => `남은 수명 ${percent}%`,
        poweredOn: (hours) => `${hours}시간 전원 켜짐`,
        reportsStatus: (status) => `Windows에서 이 드라이브 상태를 ${status}(으)로 보고합니다.`,
        statusUnknown: '상태 알 수 없음',
        needsAdmin: '마모, 온도, 가동 시간을 보려면 관리자 권한이 필요합니다 — Prune은 대신 가상의 수치를 표시하지 않습니다.',
        readWear: '드라이브 마모 읽기 (관리자)',
        waitingApproval: '승인 대기 중…',
        notApproved: '승인되지 않음 — Windows가 보고하는 값을 계속 표시합니다.',
        noWearData: '이 드라이브는 관리자 권한으로도 마모 데이터를 보고하지 않습니다.',
        uncorrectedErrors: (read, write) => `수정되지 않은 읽기 오류 ${read}건 · 수정되지 않은 쓰기 오류 ${write}건`
      },
      smart: {
        header: '드라이브 자체 보고 기준',
        powerOnHours: '가동 시간',
        powerCycles: '전원 켜짐 횟수',
        dataWritten: '쓰기 데이터',
        dataRead: '읽기 데이터',
        spareBlocks: '예비 블록',
        unsafeShutdowns: '비정상 종료',
        mediaErrors: '미디어 오류',
        errorLogEntries: '오류 로그 항목'
      },
      storage: {
        label: '총 저장 공간',
        usedTotal: (used, total) => `${used} 사용 중 / ${total} 전체`,
        loading: '불러오는 중…',
        free: '여유 공간'
      },
      apps: {
        label: '설치된 앱',
        broken: (count) => `제거 실패로 남은 항목 ${count}개`,
        noBroken: '손상된 항목이 없습니다.',
        review: '검토',
        manage: '관리'
      },
      junk: {
        label: '불필요한 파일',
        notMeasured: '측정되지 않음',
        description: '측정은 디스크의 모든 정리 경로를 살펴봅니다 — 약 30초 소요.',
        measure: '측정'
      },
      recentActivity: {
        title: '최근 활동',
        hide: '숨기기',
        show: '표시',
        empty: '아직 제거된 항목이 없습니다.',
        freed: '확보됨'
      }
    }
  },

  lt: {
    nav: {
      dashboard: 'Valdymo skydas', diskMap: 'Disko žemėlapis', applications: 'Programos',
      quarantine: 'Karantinas', settings: 'Nustatymai', startup: 'Paleistis',
      duplicates: 'Dublikatai', deepClean: 'Kruopštus valymas'
    },
    settings: { language: { title: 'Kalba', description: 'Kalba, kuria rodomi paties „Prune“ ekranai.' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `Praleista ${count} suplanuota${count === 1 ? '' : 'i'} vykdymo${count === 1 ? '' : 'ų'}, kol šis kompiuteris buvo išjungtas`,
        due: 'Suplanuotas vykdymas jau vėluoja'
      },
      driveHealth: {
        title: 'Disko Būklė',
        error: (message) => `Nepavyko nuskaityti disko būklės: ${message}`,
        loading: 'Skaitoma disko būklė…',
        unknownStatus: 'Nežinoma',
        lifeRemaining: (percent) => `${percent}% likusio tarnavimo laiko`,
        poweredOn: (hours) => `${hours} val. įjungta`,
        reportsStatus: (status) => `„Windows“ nurodo šio disko būklę kaip ${status}.`,
        statusUnknown: 'būklė nežinoma',
        needsAdmin: 'Dėvėjimuisi, temperatūrai ir veikimo valandoms reikia administratoriaus teisių — „Prune“ vietoj to nerodys išgalvoto skaičiaus.',
        readWear: 'Skaityti disko dėvėjimąsi (administratorius)',
        waitingApproval: 'Laukiama patvirtinimo…',
        notApproved: 'Nepatvirtinta — vis dar rodoma tai, ką nurodo „Windows“.',
        noWearData: 'Šis diskas neteikia dėvėjimosi duomenų net administratoriaus teisėmis.',
        uncorrectedErrors: (read, write) => `${read} neištaisytos skaitymo klaidos · ${write} neištaisytos rašymo klaidos`
      },
      smart: {
        header: 'Paties disko duomenimis',
        powerOnHours: 'Veikimo valandos',
        powerCycles: 'Įjungimo ciklai',
        dataWritten: 'Įrašyti duomenys',
        dataRead: 'Perskaityti duomenys',
        spareBlocks: 'Atsarginiai blokai',
        unsafeShutdowns: 'Nesaugūs išjungimai',
        mediaErrors: 'Laikmenos klaidos',
        errorLogEntries: 'Klaidų žurnalo įrašai'
      },
      storage: {
        label: 'Bendra Saugykla',
        usedTotal: (used, total) => `${used} naudojama / ${total} iš viso`,
        loading: 'Įkeliama…',
        free: 'laisva'
      },
      apps: {
        label: 'Įdiegtos Programos',
        broken: (count) => `${count} liko po nepavykusio pašalinimo`,
        noBroken: 'Sugadintų įrašų nėra.',
        review: 'Peržiūrėti',
        manage: 'Tvarkyti'
      },
      junk: {
        label: 'Nereikalingi Failai',
        notMeasured: 'nematuota',
        description: 'Matavimas peržiūri kiekvieną valymo kelią diske — apie pusę minutės.',
        measure: 'Matuoti'
      },
      recentActivity: {
        title: 'Naujausia Veikla',
        hide: 'Slėpti',
        show: 'Rodyti',
        empty: 'Kol kas pašalinimų nebuvo.',
        freed: 'atlaisvinta'
      }
    }
  },

  ms: {
    nav: {
      dashboard: 'Papan Pemuka', diskMap: 'Peta Cakera', applications: 'Aplikasi',
      quarantine: 'Kuarantin', settings: 'Tetapan', startup: 'Permulaan',
      duplicates: 'Pendua', deepClean: 'Pembersihan Menyeluruh'
    },
    settings: { language: { title: 'Bahasa', description: 'Bahasa yang digunakan untuk memaparkan skrin Prune sendiri.' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `${count} larian berjadual terlepas semasa PC ini dimatikan`,
        due: 'Larian berjadual sudah tiba masanya'
      },
      driveHealth: {
        title: 'Kesihatan Cakera',
        error: (message) => `Tidak dapat membaca kesihatan cakera: ${message}`,
        loading: 'Membaca kesihatan cakera…',
        unknownStatus: 'Tidak diketahui',
        lifeRemaining: (percent) => `${percent}% jangka hayat berbaki`,
        poweredOn: (hours) => `${hours} jam dihidupkan`,
        reportsStatus: (status) => `Windows melaporkan cakera ini sebagai ${status}.`,
        statusUnknown: 'status tidak diketahui',
        needsAdmin: 'Kehausan, suhu dan jam beroperasi memerlukan akses pentadbir — Prune tidak akan memaparkan angka rekaan sebagai gantinya.',
        readWear: 'Baca kehausan cakera (pentadbir)',
        waitingApproval: 'Menunggu kelulusan…',
        notApproved: 'Tidak diluluskan — masih memaparkan apa yang dilaporkan Windows.',
        noWearData: 'Cakera ini tidak melaporkan data kehausan, walaupun sebagai pentadbir.',
        uncorrectedErrors: (read, write) => `${read} ralat bacaan tidak dibetulkan · ${write} ralat tulisan tidak dibetulkan`
      },
      smart: {
        header: 'Menurut laporan cakera',
        powerOnHours: 'Jam dihidupkan',
        powerCycles: 'Kitaran kuasa',
        dataWritten: 'Data ditulis',
        dataRead: 'Data dibaca',
        spareBlocks: 'Blok ganti',
        unsafeShutdowns: 'Penutupan tidak selamat',
        mediaErrors: 'Ralat media',
        errorLogEntries: 'Entri log ralat'
      },
      storage: {
        label: 'Jumlah Storan',
        usedTotal: (used, total) => `${used} Digunakan / ${total} Jumlah`,
        loading: 'Memuatkan…',
        free: 'bebas'
      },
      apps: {
        label: 'Aplikasi Dipasang',
        broken: (count) => `${count} ditinggalkan oleh nyahpasangan yang gagal`,
        noBroken: 'Tiada entri rosak.',
        review: 'Semak',
        manage: 'Urus'
      },
      junk: {
        label: 'Fail Tidak Berguna',
        notMeasured: 'belum diukur',
        description: 'Mengukur melalui setiap laluan pembersihan pada cakera — kira-kira setengah minit.',
        measure: 'Ukur'
      },
      recentActivity: {
        title: 'Aktiviti Terkini',
        hide: 'Sembunyi',
        show: 'Tunjuk',
        empty: 'Belum ada nyahpasangan.',
        freed: 'dibebaskan'
      }
    }
  },

  nb: {
    nav: {
      dashboard: 'Oversikt', diskMap: 'Diskkart', applications: 'Programmer',
      quarantine: 'Karantene', settings: 'Innstillinger', startup: 'Oppstart',
      duplicates: 'Duplikater', deepClean: 'Grundig opprydding'
    },
    settings: { language: { title: 'Språk', description: 'Språket Prunes egne skjermer vises på.' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `${count} planlagt${count === 1 ? ' kjøring ble' : 'e kjøringer ble'} hoppet over mens denne PC-en var av`,
        due: 'En planlagt kjøring forfaller'
      },
      driveHealth: {
        title: 'Diskhelse',
        error: (message) => `Kunne ikke lese diskhelse: ${message}`,
        loading: 'Leser diskhelse…',
        unknownStatus: 'Ukjent',
        lifeRemaining: (percent) => `${percent}% levetid igjen`,
        poweredOn: (hours) => `${hours} t på`,
        reportsStatus: (status) => `Windows rapporterer denne disken som ${status}.`,
        statusUnknown: 'status ukjent',
        needsAdmin: 'Slitasje, temperatur og driftstimer krever administratortilgang — Prune vil ikke vise et oppdiktet tall i stedet.',
        readWear: 'Les diskslitasje (admin)',
        waitingApproval: 'Venter på godkjenning…',
        notApproved: 'Ikke godkjent — viser fortsatt det Windows rapporterer.',
        noWearData: 'Denne disken rapporterer ingen slitasjedata, selv som administrator.',
        uncorrectedErrors: (read, write) => `${read} ukorrigerte lesefeil · ${write} ukorrigerte skrivefeil`
      },
      smart: {
        header: 'Ifølge disken selv',
        powerOnHours: 'Driftstimer',
        powerCycles: 'Strømsykluser',
        dataWritten: 'Data skrevet',
        dataRead: 'Data lest',
        spareBlocks: 'Reserveblokker',
        unsafeShutdowns: 'Usikre avstengninger',
        mediaErrors: 'Mediefeil',
        errorLogEntries: 'Feilloggoppføringer'
      },
      storage: {
        label: 'Total Lagringsplass',
        usedTotal: (used, total) => `${used} brukt / ${total} totalt`,
        loading: 'Laster…',
        free: 'ledig'
      },
      apps: {
        label: 'Installerte Programmer',
        broken: (count) => `${count} etterlatt av en mislykket avinstallering`,
        noBroken: 'Ingen ødelagte oppføringer.',
        review: 'Gjennomgå',
        manage: 'Administrer'
      },
      junk: {
        label: 'Unødvendige Filer',
        notMeasured: 'ikke målt',
        description: 'Måling går gjennom hver opprydningssti på disken — omtrent et halvt minutt.',
        measure: 'Mål'
      },
      recentActivity: {
        title: 'Nylig Aktivitet',
        hide: 'Skjul',
        show: 'Vis',
        empty: 'Ingen avinstalleringer ennå.',
        freed: 'frigjort'
      }
    }
  },

  nl: {
    nav: {
      dashboard: 'Dashboard', diskMap: 'Schijfkaart', applications: 'Toepassingen',
      quarantine: 'Quarantaine', settings: 'Instellingen', startup: 'Opstarten',
      duplicates: 'Duplicaten', deepClean: 'Grondige opschoning'
    },
    settings: { language: { title: 'Taal', description: 'De taal waarin Prunes eigen schermen worden getoond.' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `${count} geplande uitvoering${count === 1 ? '' : 'en'} gemist terwijl deze pc uit stond`,
        due: 'Een geplande uitvoering is verschuldigd'
      },
      driveHealth: {
        title: 'Schijfstatus',
        error: (message) => `Kan schijfstatus niet lezen: ${message}`,
        loading: 'Schijfstatus lezen…',
        unknownStatus: 'Onbekend',
        lifeRemaining: (percent) => `${percent}% levensduur resterend`,
        poweredOn: (hours) => `${hours} u ingeschakeld`,
        reportsStatus: (status) => `Windows meldt deze schijf als ${status}.`,
        statusUnknown: 'status onbekend',
        needsAdmin: 'Slijtage, temperatuur en ingeschakelde uren vereisen beheerderstoegang — Prune zal geen verzonnen cijfer tonen in plaats daarvan.',
        readWear: 'Schijfslijtage lezen (beheerder)',
        waitingApproval: 'Wachten op goedkeuring…',
        notApproved: 'Niet goedgekeurd — toont nog steeds wat Windows meldt.',
        noWearData: 'Deze schijf meldt geen slijtagegegevens, zelfs niet als beheerder.',
        uncorrectedErrors: (read, write) => `${read} ongecorrigeerde leesfouten · ${write} ongecorrigeerde schrijffouten`
      },
      smart: {
        header: 'Volgens de schijf zelf',
        powerOnHours: 'Ingeschakelde uren',
        powerCycles: 'Inschakelcycli',
        dataWritten: 'Geschreven gegevens',
        dataRead: 'Gelezen gegevens',
        spareBlocks: 'Reserveblokken',
        unsafeShutdowns: 'Onveilige afsluitingen',
        mediaErrors: 'Mediafouten',
        errorLogEntries: 'Foutlogboekvermeldingen'
      },
      storage: {
        label: 'Totale Opslag',
        usedTotal: (used, total) => `${used} gebruikt / ${total} totaal`,
        loading: 'Laden…',
        free: 'vrij'
      },
      apps: {
        label: 'Geïnstalleerde Toepassingen',
        broken: (count) => `${count} achtergelaten door een mislukte verwijdering`,
        noBroken: 'Geen kapotte items.',
        review: 'Bekijken',
        manage: 'Beheren'
      },
      junk: {
        label: 'Onnodige Bestanden',
        notMeasured: 'niet gemeten',
        description: 'Meten doorloopt elk opschoningspad op de schijf — ongeveer een halve minuut.',
        measure: 'Meten'
      },
      recentActivity: {
        title: 'Recente Activiteit',
        hide: 'Verbergen',
        show: 'Tonen',
        empty: 'Nog geen verwijderingen.',
        freed: 'vrijgemaakt'
      }
    }
  },

  pl: {
    nav: {
      dashboard: 'Panel', diskMap: 'Mapa dysku', applications: 'Aplikacje',
      quarantine: 'Kwarantanna', settings: 'Ustawienia', startup: 'Autostart',
      duplicates: 'Duplikaty', deepClean: 'Dokładne czyszczenie'
    },
    settings: { language: { title: 'Język', description: 'Język, w którym wyświetlane są własne ekrany Prune.' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `Pominięto ${count} zaplanowan${count === 1 ? 'e uruchomienie' : 'e uruchomienia'}, gdy ten komputer był wyłączony`,
        due: 'Zaplanowane uruchomienie jest zaległe'
      },
      driveHealth: {
        title: 'Stan Dysku',
        error: (message) => `Nie udało się odczytać stanu dysku: ${message}`,
        loading: 'Odczytywanie stanu dysku…',
        unknownStatus: 'Nieznany',
        lifeRemaining: (percent) => `${percent}% pozostałej żywotności`,
        poweredOn: (hours) => `${hours} godz. włączony`,
        reportsStatus: (status) => `Windows zgłasza stan tego dysku jako ${status}.`,
        statusUnknown: 'stan nieznany',
        needsAdmin: 'Zużycie, temperatura i czas pracy wymagają uprawnień administratora — Prune nie pokaże w zamian zmyślonej liczby.',
        readWear: 'Odczytaj zużycie dysku (administrator)',
        waitingApproval: 'Oczekiwanie na zatwierdzenie…',
        notApproved: 'Nie zatwierdzono — nadal pokazuje to, co zgłasza Windows.',
        noWearData: 'Ten dysk nie zgłasza danych o zużyciu, nawet jako administrator.',
        uncorrectedErrors: (read, write) => `${read} niepoprawionych błędów odczytu · ${write} niepoprawionych błędów zapisu`
      },
      smart: {
        header: 'Według samego dysku',
        powerOnHours: 'Godziny pracy',
        powerCycles: 'Cykle zasilania',
        dataWritten: 'Zapisane dane',
        dataRead: 'Odczytane dane',
        spareBlocks: 'Bloki zapasowe',
        unsafeShutdowns: 'Niebezpieczne wyłączenia',
        mediaErrors: 'Błędy nośnika',
        errorLogEntries: 'Wpisy dziennika błędów'
      },
      storage: {
        label: 'Całkowita Pamięć',
        usedTotal: (used, total) => `${used} użyto / ${total} razem`,
        loading: 'Wczytywanie…',
        free: 'wolne'
      },
      apps: {
        label: 'Zainstalowane Aplikacje',
        broken: (count) => `${count} pozostawionych po nieudanej dezinstalacji`,
        noBroken: 'Brak uszkodzonych wpisów.',
        review: 'Przejrzyj',
        manage: 'Zarządzaj'
      },
      junk: {
        label: 'Zbędne Pliki',
        notMeasured: 'niezmierzone',
        description: 'Pomiar przechodzi przez każdą ścieżkę czyszczenia na dysku — około pół minuty.',
        measure: 'Zmierz'
      },
      recentActivity: {
        title: 'Ostatnia Aktywność',
        hide: 'Ukryj',
        show: 'Pokaż',
        empty: 'Jeszcze żadnych dezinstalacji.',
        freed: 'zwolniono'
      }
    }
  },

  ps: {
    nav: {
      dashboard: 'ډشبورډ', diskMap: 'د ډیسک نقشه', applications: 'غوښتنلیکونه',
      quarantine: 'قرنطین', settings: 'تنظیمات', startup: 'پیل',
      duplicates: 'تکراري فایلونه', deepClean: 'ژور پاکول'
    },
    settings: { language: { title: 'ژبه', description: 'هغه ژبه چې د Prune خپلې پردې پرې ښودل کیږي.' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `${count} مهالويش شوي چلونه له لاسه ولاړل ځکه چې دا کمپیوټر بند و`,
        due: 'مهالويش شوی چلون اوس اړین دی'
      },
      driveHealth: {
        title: 'د ډرایو روغتیا',
        error: (message) => `د ډرایو روغتیا ونه لوستل شوه: ${message}`,
        loading: 'د ډرایو روغتیا لوستل کیږي…',
        unknownStatus: 'نامعلومه',
        lifeRemaining: (percent) => `${percent}٪ پاتې عمر`,
        poweredOn: (hours) => `${hours} ساعته روښانه`,
        reportsStatus: (status) => `Windows دا ډرایو ${status} ګڼي.`,
        statusUnknown: 'حالت نامعلوم',
        needsAdmin: 'کیندنه، تودوخه، او د روښانتیا ساعتونه د اډمین لاسرسي ته اړتیا لري — Prune به یې پر ځای جوړ شمیره ونه ښيي.',
        readWear: 'د ډرایو کیندنه ولولئ (اډمین)',
        waitingApproval: 'د تصویب په تمه…',
        notApproved: 'تصویب نشو — لاهم هغه څه ښیي چې Windows یې راپور ورکوي.',
        noWearData: 'دا ډرایو د کیندنې معلومات نه ورکوي، حتی د اډمین په توګه هم.',
        uncorrectedErrors: (read, write) => `${read} ناسم شوي لوستلو تېروتنې · ${write} ناسم شوي لیکلو تېروتنې`
      },
      smart: {
        header: 'د ډرایو خپل راپور له مخې',
        powerOnHours: 'د روښانتیا ساعتونه',
        powerCycles: 'د بریښنا دورې',
        dataWritten: 'لیکل شوي معلومات',
        dataRead: 'لوستل شوي معلومات',
        spareBlocks: 'ذخیره بلاکونه',
        unsafeShutdowns: 'ناامنه بندونه',
        mediaErrors: 'د رسنیو تېروتنې',
        errorLogEntries: 'د تېروتنو لاګ ننوتنې'
      },
      storage: {
        label: 'ټول ذخیره',
        usedTotal: (used, total) => `${used} کارول شوي / ${total} ټول`,
        loading: 'بارول کیږي…',
        free: 'خالي'
      },
      apps: {
        label: 'نصب شوي اپلیکیشنونه',
        broken: (count) => `${count} د ناکامې لرې کولو له امله پاتې شوي`,
        noBroken: 'هیڅ ماتې شوې ننوتنه نشته.',
        review: 'بیاکتنه',
        manage: 'مدیریت'
      },
      junk: {
        label: 'غیر ضروري فایلونه',
        notMeasured: 'اندازه نشوې',
        description: 'اندازه کول د ډیسک په هر پاکولو لاره کې ګرځي — شاوخوا نیم دقیقه.',
        measure: 'اندازه کول'
      },
      recentActivity: {
        title: 'وروستۍ فعالیت',
        hide: 'پټول',
        show: 'ښودل',
        empty: 'تراوسه هیڅ لرې کول نشته.',
        freed: 'خلاص شوی'
      }
    }
  },

  'pt-BR': {
    nav: {
      dashboard: 'Painel', diskMap: 'Mapa do disco', applications: 'Aplicativos',
      quarantine: 'Quarentena', settings: 'Configurações', startup: 'Inicialização',
      duplicates: 'Duplicados', deepClean: 'Limpeza profunda'
    },
    settings: { language: { title: 'Idioma', description: 'O idioma em que as próprias telas do Prune são exibidas.' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `${count} execuç${count === 1 ? 'ão agendada foi perdida' : 'ões agendadas foram perdidas'} enquanto este PC estava desligado`,
        due: 'Uma execução agendada está pendente'
      },
      driveHealth: {
        title: 'Saúde do Disco',
        error: (message) => `Não foi possível ler a saúde do disco: ${message}`,
        loading: 'Lendo a saúde do disco…',
        unknownStatus: 'Desconhecido',
        lifeRemaining: (percent) => `${percent}% de vida restante`,
        poweredOn: (hours) => `${hours} h ligado`,
        reportsStatus: (status) => `O Windows informa que este disco está ${status}.`,
        statusUnknown: 'status desconhecido',
        needsAdmin: 'Desgaste, temperatura e horas ligado exigem acesso de administrador — o Prune não mostrará um número inventado em vez disso.',
        readWear: 'Ler desgaste do disco (admin)',
        waitingApproval: 'Aguardando aprovação…',
        notApproved: 'Não aprovado — ainda mostrando o que o Windows informa.',
        noWearData: 'Este disco não informa dados de desgaste, mesmo como administrador.',
        uncorrectedErrors: (read, write) => `${read} erros de leitura não corrigidos · ${write} erros de gravação não corrigidos`
      },
      smart: {
        header: 'Segundo o próprio disco',
        powerOnHours: 'Horas ligado',
        powerCycles: 'Ciclos de energia',
        dataWritten: 'Dados gravados',
        dataRead: 'Dados lidos',
        spareBlocks: 'Blocos reserva',
        unsafeShutdowns: 'Desligamentos inseguros',
        mediaErrors: 'Erros de mídia',
        errorLogEntries: 'Entradas do log de erros'
      },
      storage: {
        label: 'Armazenamento Total',
        usedTotal: (used, total) => `${used} usado / ${total} total`,
        loading: 'Carregando…',
        free: 'livre'
      },
      apps: {
        label: 'Aplicativos Instalados',
        broken: (count) => `${count} deixados por uma desinstalação malsucedida`,
        noBroken: 'Nenhuma entrada corrompida.',
        review: 'Revisar',
        manage: 'Gerenciar'
      },
      junk: {
        label: 'Arquivos Desnecessários',
        notMeasured: 'não medido',
        description: 'Medir percorre cada caminho de limpeza no disco — cerca de meio minuto.',
        measure: 'Medir'
      },
      recentActivity: {
        title: 'Atividade Recente',
        hide: 'Ocultar',
        show: 'Mostrar',
        empty: 'Ainda nenhuma desinstalação.',
        freed: 'liberado'
      }
    }
  },

  pt: {
    nav: {
      dashboard: 'Painel', diskMap: 'Mapa do disco', applications: 'Aplicações',
      quarantine: 'Quarentena', settings: 'Definições', startup: 'Arranque',
      duplicates: 'Duplicados', deepClean: 'Limpeza profunda'
    },
    settings: { language: { title: 'Idioma', description: 'O idioma em que os próprios ecrãs do Prune são apresentados.' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `${count} execuç${count === 1 ? 'ão agendada foi perdida' : 'ões agendadas foram perdidas'} enquanto este PC esteve desligado`,
        due: 'Uma execução agendada está pendente'
      },
      driveHealth: {
        title: 'Saúde do Disco',
        error: (message) => `Não foi possível ler a saúde do disco: ${message}`,
        loading: 'A ler a saúde do disco…',
        unknownStatus: 'Desconhecido',
        lifeRemaining: (percent) => `${percent}% de vida restante`,
        poweredOn: (hours) => `${hours} h ligado`,
        reportsStatus: (status) => `O Windows indica que este disco está ${status}.`,
        statusUnknown: 'estado desconhecido',
        needsAdmin: 'Desgaste, temperatura e horas ligado exigem acesso de administrador — o Prune não mostrará um número inventado em vez disso.',
        readWear: 'Ler o desgaste do disco (admin)',
        waitingApproval: 'A aguardar aprovação…',
        notApproved: 'Não aprovado — continua a mostrar o que o Windows indica.',
        noWearData: 'Este disco não indica dados de desgaste, mesmo como administrador.',
        uncorrectedErrors: (read, write) => `${read} erros de leitura não corrigidos · ${write} erros de escrita não corrigidos`
      },
      smart: {
        header: 'Segundo o próprio disco',
        powerOnHours: 'Horas ligado',
        powerCycles: 'Ciclos de energia',
        dataWritten: 'Dados escritos',
        dataRead: 'Dados lidos',
        spareBlocks: 'Blocos de reserva',
        unsafeShutdowns: 'Encerramentos inseguros',
        mediaErrors: 'Erros de suporte',
        errorLogEntries: 'Entradas do registo de erros'
      },
      storage: {
        label: 'Armazenamento Total',
        usedTotal: (used, total) => `${used} usado / ${total} total`,
        loading: 'A carregar…',
        free: 'livre'
      },
      apps: {
        label: 'Aplicações Instaladas',
        broken: (count) => `${count} deixadas por uma desinstalação falhada`,
        noBroken: 'Nenhuma entrada danificada.',
        review: 'Rever',
        manage: 'Gerir'
      },
      junk: {
        label: 'Ficheiros Desnecessários',
        notMeasured: 'não medido',
        description: 'Medir percorre cada caminho de limpeza no disco — cerca de meio minuto.',
        measure: 'Medir'
      },
      recentActivity: {
        title: 'Atividade Recente',
        hide: 'Ocultar',
        show: 'Mostrar',
        empty: 'Ainda nenhuma desinstalação.',
        freed: 'libertado'
      }
    }
  },

  ro: {
    nav: {
      dashboard: 'Panou', diskMap: 'Harta discului', applications: 'Aplicații',
      quarantine: 'Carantină', settings: 'Setări', startup: 'Pornire',
      duplicates: 'Duplicate', deepClean: 'Curățare aprofundată'
    },
    settings: { language: { title: 'Limbă', description: 'Limba în care sunt afișate propriile ecrane ale Prune.' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `${count} rulare${count === 1 ? ' programată a fost' : 'ri programate au fost'} ratate cât timp acest PC a fost oprit`,
        due: 'O rulare programată este scadentă'
      },
      driveHealth: {
        title: 'Starea Discului',
        error: (message) => `Starea discului nu a putut fi citită: ${message}`,
        loading: 'Se citește starea discului…',
        unknownStatus: 'Necunoscută',
        lifeRemaining: (percent) => `${percent}% durată de viață rămasă`,
        poweredOn: (hours) => `${hours} h pornit`,
        reportsStatus: (status) => `Windows raportează acest disc ca fiind ${status}.`,
        statusUnknown: 'stare necunoscută',
        needsAdmin: 'Uzura, temperatura și orele de funcționare necesită acces de administrator — Prune nu va afișa o cifră inventată în schimb.',
        readWear: 'Citește uzura discului (admin)',
        waitingApproval: 'Se așteaptă aprobarea…',
        notApproved: 'Neaprobat — încă afișează ce raportează Windows.',
        noWearData: 'Acest disc nu raportează date de uzură, nici măcar ca administrator.',
        uncorrectedErrors: (read, write) => `${read} erori de citire necorectate · ${write} erori de scriere necorectate`
      },
      smart: {
        header: 'Conform propriului disc',
        powerOnHours: 'Ore de funcționare',
        powerCycles: 'Cicluri de pornire',
        dataWritten: 'Date scrise',
        dataRead: 'Date citite',
        spareBlocks: 'Blocuri de rezervă',
        unsafeShutdowns: 'Opriri nesigure',
        mediaErrors: 'Erori media',
        errorLogEntries: 'Intrări în jurnalul de erori'
      },
      storage: {
        label: 'Stocare Totală',
        usedTotal: (used, total) => `${used} utilizat / ${total} total`,
        loading: 'Se încarcă…',
        free: 'liber'
      },
      apps: {
        label: 'Aplicații Instalate',
        broken: (count) => `${count} rămase în urma unei dezinstalări eșuate`,
        noBroken: 'Nicio intrare deteriorată.',
        review: 'Revizuiește',
        manage: 'Gestionează'
      },
      junk: {
        label: 'Fișiere Inutile',
        notMeasured: 'nemăsurat',
        description: 'Măsurarea parcurge fiecare cale de curățare de pe disc — aproximativ jumătate de minut.',
        measure: 'Măsoară'
      },
      recentActivity: {
        title: 'Activitate Recentă',
        hide: 'Ascunde',
        show: 'Arată',
        empty: 'Încă nicio dezinstalare.',
        freed: 'eliberat'
      }
    }
  },

  ru: {
    nav: {
      dashboard: 'Панель', diskMap: 'Карта диска', applications: 'Приложения',
      quarantine: 'Карантин', settings: 'Настройки', startup: 'Автозагрузка',
      duplicates: 'Дубликаты', deepClean: 'Глубокая очистка'
    },
    settings: { language: { title: 'Язык', description: 'Язык, на котором отображаются собственные экраны Prune.' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `${count} запланированн${count === 1 ? 'ый запуск был' : 'ых запуска были'} пропущены, пока этот ПК был выключен`,
        due: 'Наступил срок запланированного запуска'
      },
      driveHealth: {
        title: 'Состояние Диска',
        error: (message) => `Не удалось прочитать состояние диска: ${message}`,
        loading: 'Чтение состояния диска…',
        unknownStatus: 'Неизвестно',
        lifeRemaining: (percent) => `${percent}% ресурса осталось`,
        poweredOn: (hours) => `${hours} ч во включённом состоянии`,
        reportsStatus: (status) => `Windows сообщает, что состояние этого диска — ${status}.`,
        statusUnknown: 'состояние неизвестно',
        needsAdmin: 'Для износа, температуры и времени работы требуются права администратора — Prune не станет показывать вместо этого выдуманное число.',
        readWear: 'Прочитать износ диска (администратор)',
        waitingApproval: 'Ожидание подтверждения…',
        notApproved: 'Не подтверждено — по-прежнему показывается то, что сообщает Windows.',
        noWearData: 'Этот диск не сообщает данные об износе, даже с правами администратора.',
        uncorrectedErrors: (read, write) => `${read} неисправленных ошибок чтения · ${write} неисправленных ошибок записи`
      },
      smart: {
        header: 'По данным самого диска',
        powerOnHours: 'Часы работы',
        powerCycles: 'Циклы включения',
        dataWritten: 'Записано данных',
        dataRead: 'Прочитано данных',
        spareBlocks: 'Резервные блоки',
        unsafeShutdowns: 'Небезопасные отключения',
        mediaErrors: 'Ошибки носителя',
        errorLogEntries: 'Записи журнала ошибок'
      },
      storage: {
        label: 'Всего Хранилища',
        usedTotal: (used, total) => `${used} использовано / ${total} всего`,
        loading: 'Загрузка…',
        free: 'свободно'
      },
      apps: {
        label: 'Установленные Приложения',
        broken: (count) => `${count} осталось после неудачного удаления`,
        noBroken: 'Повреждённых записей нет.',
        review: 'Проверить',
        manage: 'Управление'
      },
      junk: {
        label: 'Ненужные Файлы',
        notMeasured: 'не измерено',
        description: 'Измерение проходит по каждому пути очистки на диске — примерно полминуты.',
        measure: 'Измерить'
      },
      recentActivity: {
        title: 'Недавняя Активность',
        hide: 'Скрыть',
        show: 'Показать',
        empty: 'Пока нет удалений.',
        freed: 'освобождено'
      }
    }
  },

  sk: {
    nav: {
      dashboard: 'Prehľad', diskMap: 'Mapa disku', applications: 'Aplikácie',
      quarantine: 'Karanténa', settings: 'Nastavenia', startup: 'Po spustení',
      duplicates: 'Duplicity', deepClean: 'Dôkladné čistenie'
    },
    settings: { language: { title: 'Jazyk', description: 'Jazyk, v ktorom sa zobrazujú vlastné obrazovky Prune.' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `${count} naplánovan${count === 1 ? 'é spustenie bolo' : 'é spustenia boli'} vynechané, kým bol tento počítač vypnutý`,
        due: 'Naplánované spustenie je splatné'
      },
      driveHealth: {
        title: 'Stav Disku',
        error: (message) => `Stav disku sa nepodarilo načítať: ${message}`,
        loading: 'Načítava sa stav disku…',
        unknownStatus: 'Neznámy',
        lifeRemaining: (percent) => `${percent}% zostávajúcej životnosti`,
        poweredOn: (hours) => `${hours} h zapnuté`,
        reportsStatus: (status) => `Windows uvádza stav tohto disku ako ${status}.`,
        statusUnknown: 'stav neznámy',
        needsAdmin: 'Opotrebenie, teplota a čas zapnutia vyžadujú prístup správcu — Prune namiesto toho nezobrazí vymyslené číslo.',
        readWear: 'Načítať opotrebenie disku (správca)',
        waitingApproval: 'Čaká sa na schválenie…',
        notApproved: 'Neschválené — stále zobrazuje to, čo uvádza Windows.',
        noWearData: 'Tento disk neposkytuje údaje o opotrebení, ani ako správca.',
        uncorrectedErrors: (read, write) => `${read} neopravených chýb čítania · ${write} neopravených chýb zápisu`
      },
      smart: {
        header: 'Podľa samotného disku',
        powerOnHours: 'Hodiny zapnutia',
        powerCycles: 'Cykly zapnutia',
        dataWritten: 'Zapísané dáta',
        dataRead: 'Prečítané dáta',
        spareBlocks: 'Náhradné bloky',
        unsafeShutdowns: 'Nebezpečné vypnutia',
        mediaErrors: 'Chyby média',
        errorLogEntries: 'Záznamy denníka chýb'
      },
      storage: {
        label: 'Celkové Úložisko',
        usedTotal: (used, total) => `${used} použité / ${total} spolu`,
        loading: 'Načítava sa…',
        free: 'voľné'
      },
      apps: {
        label: 'Nainštalované Aplikácie',
        broken: (count) => `${count} zanechaných po neúspešnej odinštalácii`,
        noBroken: 'Žiadne poškodené položky.',
        review: 'Skontrolovať',
        manage: 'Spravovať'
      },
      junk: {
        label: 'Nepotrebné Súbory',
        notMeasured: 'nezmerané',
        description: 'Meranie prechádza každou cestou čistenia na disku — asi pol minúty.',
        measure: 'Zmerať'
      },
      recentActivity: {
        title: 'Nedávna Aktivita',
        hide: 'Skryť',
        show: 'Zobraziť',
        empty: 'Zatiaľ žiadne odinštalácie.',
        freed: 'uvoľnené'
      }
    }
  },

  sq: {
    nav: {
      dashboard: 'Paneli', diskMap: 'Harta e Diskut', applications: 'Aplikacionet',
      quarantine: 'Karantina', settings: 'Cilësimet', startup: 'Nisja',
      duplicates: 'Dublikatat', deepClean: 'Pastrim i thellë'
    },
    settings: { language: { title: 'Gjuha', description: 'Gjuha në të cilën shfaqen ekranet e vetë Prune.' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `${count} ekzekutim${count === 1 ? ' i planifikuar u humb' : 'e të planifikuara u humbën'} ndërsa ky kompjuter ishte i fikur`,
        due: 'Një ekzekutim i planifikuar është i vonuar'
      },
      driveHealth: {
        title: 'Shëndeti i Diskut',
        error: (message) => `Shëndeti i diskut nuk mund të lexohej: ${message}`,
        loading: 'Duke lexuar shëndetin e diskut…',
        unknownStatus: 'I panjohur',
        lifeRemaining: (percent) => `${percent}% jetëgjatësi e mbetur`,
        poweredOn: (hours) => `${hours} orë i ndezur`,
        reportsStatus: (status) => `Windows raporton këtë disk si ${status}.`,
        statusUnknown: 'gjendje e panjohur',
        needsAdmin: 'Konsumimi, temperatura dhe orët e ndezjes kërkojnë qasje administratori — Prune nuk do të shfaqë një shifër të trilluar në vend të kësaj.',
        readWear: 'Lexo konsumimin e diskut (admin)',
        waitingApproval: 'Duke pritur miratimin…',
        notApproved: 'I paaprovuar — vazhdon të shfaqë atë që raporton Windows.',
        noWearData: 'Ky disk nuk raporton të dhëna konsumimi, as si administrator.',
        uncorrectedErrors: (read, write) => `${read} gabime leximi të pakorrigjuara · ${write} gabime shkrimi të pakorrigjuara`
      },
      smart: {
        header: 'Sipas vetë diskut',
        powerOnHours: 'Orë të ndezjes',
        powerCycles: 'Cikle ndezjeje',
        dataWritten: 'Të dhëna të shkruara',
        dataRead: 'Të dhëna të lexuara',
        spareBlocks: 'Blloqe rezervë',
        unsafeShutdowns: 'Fikje jo të sigurta',
        mediaErrors: 'Gabime media',
        errorLogEntries: 'Hyrje të regjistrit të gabimeve'
      },
      storage: {
        label: 'Hapësira Totale',
        usedTotal: (used, total) => `${used} përdorur / ${total} total`,
        loading: 'Duke ngarkuar…',
        free: 'e lirë'
      },
      apps: {
        label: 'Aplikacionet e Instaluara',
        broken: (count) => `${count} të lëna nga një çinstalim i dështuar`,
        noBroken: 'Asnjë hyrje e dëmtuar.',
        review: 'Shqyrto',
        manage: 'Menaxho'
      },
      junk: {
        label: 'Skedarë të Panevojshëm',
        notMeasured: 'i pamatur',
        description: 'Matja kalon çdo shteg pastrimi në disk — rreth gjysmë minuti.',
        measure: 'Mat'
      },
      recentActivity: {
        title: 'Aktiviteti i Fundit',
        hide: 'Fshih',
        show: 'Shfaq',
        empty: 'Ende asnjë çinstalim.',
        freed: 'u lirua'
      }
    }
  },

  sr: {
    nav: {
      dashboard: 'Контролна табла', diskMap: 'Мапа диска', applications: 'Апликације',
      quarantine: 'Карантин', settings: 'Подешавања', startup: 'Покретање',
      duplicates: 'Дупликати', deepClean: 'Дубинско чишћење'
    },
    settings: { language: { title: 'Језик', description: 'Језик на којем се приказују сопствени екрани Prune-а.' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `${count} заказан${count === 1 ? 'о покретање је' : 'а покретања су'} пропуштена док је овај рачунар био искључен`,
        due: 'Заказано покретање је доспело'
      },
      driveHealth: {
        title: 'Стање Диска',
        error: (message) => `Стање диска није могло да се прочита: ${message}`,
        loading: 'Читање стања диска…',
        unknownStatus: 'Непознато',
        lifeRemaining: (percent) => `${percent}% преосталог века трајања`,
        poweredOn: (hours) => `${hours} ч укључен`,
        reportsStatus: (status) => `Windows пријављује да је овај диск ${status}.`,
        statusUnknown: 'стање непознато',
        needsAdmin: 'Хабање, температура и радни сати захтевају администраторски приступ — Prune уместо тога неће приказати измишљену цифру.',
        readWear: 'Читај хабање диска (администратор)',
        waitingApproval: 'Чека се одобрење…',
        notApproved: 'Није одобрено — и даље приказује оно што Windows пријављује.',
        noWearData: 'Овај диск не пријављује податке о хабању, чак ни као администратор.',
        uncorrectedErrors: (read, write) => `${read} неисправљених грешака читања · ${write} неисправљених грешака писања`
      },
      smart: {
        header: 'Према извештају самог диска',
        powerOnHours: 'Радни сати',
        powerCycles: 'Циклуси укључивања',
        dataWritten: 'Уписани подаци',
        dataRead: 'Прочитани подаци',
        spareBlocks: 'Резервни блокови',
        unsafeShutdowns: 'Небезбедна искључивања',
        mediaErrors: 'Грешке медија',
        errorLogEntries: 'Уноси дневника грешака'
      },
      storage: {
        label: 'Укупно Складиште',
        usedTotal: (used, total) => `${used} искоришћено / ${total} укупно`,
        loading: 'Учитавање…',
        free: 'слободно'
      },
      apps: {
        label: 'Инсталиране Апликације',
        broken: (count) => `${count} остављено неуспелом деинсталацијом`,
        noBroken: 'Нема оштећених уноса.',
        review: 'Прегледај',
        manage: 'Управљај'
      },
      junk: {
        label: 'Непотребне Датотеке',
        notMeasured: 'није измерено',
        description: 'Мерење пролази кроз сваку путању чишћења на диску — око пола минута.',
        measure: 'Измери'
      },
      recentActivity: {
        title: 'Недавна Активност',
        hide: 'Сакриј',
        show: 'Прикажи',
        empty: 'Још увек нема деинсталација.',
        freed: 'ослобођено'
      }
    }
  },

  sv: {
    nav: {
      dashboard: 'Översikt', diskMap: 'Diskkarta', applications: 'Program',
      quarantine: 'Karantän', settings: 'Inställningar', startup: 'Startprogram',
      duplicates: 'Dubbletter', deepClean: 'Grundlig rensning'
    },
    settings: { language: { title: 'Språk', description: 'Språket som Prunes egna skärmar visas på.' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `${count} schemalag${count === 1 ? 'd körning missades' : 'da körningar missades'} medan denna dator var avstängd`,
        due: 'En schemalagd körning är försenad'
      },
      driveHealth: {
        title: 'Diskhälsa',
        error: (message) => `Kunde inte läsa diskhälsa: ${message}`,
        loading: 'Läser diskhälsa…',
        unknownStatus: 'Okänd',
        lifeRemaining: (percent) => `${percent}% livslängd kvar`,
        poweredOn: (hours) => `${hours} tim påslagen`,
        reportsStatus: (status) => `Windows rapporterar denna disk som ${status}.`,
        statusUnknown: 'status okänd',
        needsAdmin: 'Slitage, temperatur och drifttimmar kräver administratörsåtkomst — Prune visar inte en hittepå-siffra istället.',
        readWear: 'Läs diskslitage (admin)',
        waitingApproval: 'Väntar på godkännande…',
        notApproved: 'Ej godkänt — visar fortfarande det Windows rapporterar.',
        noWearData: 'Denna disk rapporterar inga slitagedata, inte ens som administratör.',
        uncorrectedErrors: (read, write) => `${read} okorrigerade läsfel · ${write} okorrigerade skrivfel`
      },
      smart: {
        header: 'Enligt disken själv',
        powerOnHours: 'Drifttimmar',
        powerCycles: 'Påslagningscykler',
        dataWritten: 'Skriven data',
        dataRead: 'Läst data',
        spareBlocks: 'Reservblock',
        unsafeShutdowns: 'Osäkra avstängningar',
        mediaErrors: 'Mediefel',
        errorLogEntries: 'Felloggposter'
      },
      storage: {
        label: 'Total Lagring',
        usedTotal: (used, total) => `${used} använt / ${total} totalt`,
        loading: 'Laddar…',
        free: 'ledigt'
      },
      apps: {
        label: 'Installerade Program',
        broken: (count) => `${count} kvarlämnade av en misslyckad avinstallation`,
        noBroken: 'Inga trasiga poster.',
        review: 'Granska',
        manage: 'Hantera'
      },
      junk: {
        label: 'Onödiga Filer',
        notMeasured: 'inte uppmätt',
        description: 'Mätning går igenom varje rensningsväg på disken — ungefär en halv minut.',
        measure: 'Mät'
      },
      recentActivity: {
        title: 'Senaste Aktivitet',
        hide: 'Dölj',
        show: 'Visa',
        empty: 'Inga avinstallationer än.',
        freed: 'frigjort'
      }
    }
  },

  th: {
    nav: {
      dashboard: 'แดชบอร์ด', diskMap: 'แผนที่ดิสก์', applications: 'แอปพลิเคชัน',
      quarantine: 'กักกัน', settings: 'การตั้งค่า', startup: 'โปรแกรมเริ่มต้น',
      duplicates: 'ไฟล์ซ้ำ', deepClean: 'ทำความสะอาดเชิงลึก'
    },
    settings: { language: { title: 'ภาษา', description: 'ภาษาที่หน้าจอของ Prune เองแสดงผล' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `พลาดการทำงานตามกำหนดเวลา ${count} ครั้งขณะที่พีซีเครื่องนี้ปิดอยู่`,
        due: 'ถึงกำหนดการทำงานตามตารางเวลาแล้ว'
      },
      driveHealth: {
        title: 'สุขภาพไดรฟ์',
        error: (message) => `ไม่สามารถอ่านสุขภาพไดรฟ์ได้: ${message}`,
        loading: 'กำลังอ่านสุขภาพไดรฟ์…',
        unknownStatus: 'ไม่ทราบ',
        lifeRemaining: (percent) => `เหลืออายุการใช้งาน ${percent}%`,
        poweredOn: (hours) => `เปิดใช้งาน ${hours} ชั่วโมง`,
        reportsStatus: (status) => `Windows รายงานว่าไดรฟ์นี้อยู่ในสถานะ ${status}`,
        statusUnknown: 'ไม่ทราบสถานะ',
        needsAdmin: 'การสึกหรอ อุณหภูมิ และชั่วโมงการทำงานต้องใช้สิทธิ์ผู้ดูแลระบบ — Prune จะไม่แสดงตัวเลขที่แต่งขึ้นแทน',
        readWear: 'อ่านการสึกหรอของไดรฟ์ (ผู้ดูแลระบบ)',
        waitingApproval: 'กำลังรออนุมัติ…',
        notApproved: 'ไม่ได้รับการอนุมัติ — ยังคงแสดงสิ่งที่ Windows รายงาน',
        noWearData: 'ไดรฟ์นี้ไม่รายงานข้อมูลการสึกหรอ แม้ในฐานะผู้ดูแลระบบ',
        uncorrectedErrors: (read, write) => `ข้อผิดพลาดการอ่านที่ไม่ได้แก้ไข ${read} ครั้ง · ข้อผิดพลาดการเขียนที่ไม่ได้แก้ไข ${write} ครั้ง`
      },
      smart: {
        header: 'ตามรายงานของไดรฟ์เอง',
        powerOnHours: 'ชั่วโมงเปิดใช้งาน',
        powerCycles: 'รอบการเปิดเครื่อง',
        dataWritten: 'ข้อมูลที่เขียน',
        dataRead: 'ข้อมูลที่อ่าน',
        spareBlocks: 'บล็อกสำรอง',
        unsafeShutdowns: 'การปิดเครื่องอย่างไม่ปลอดภัย',
        mediaErrors: 'ข้อผิดพลาดของสื่อ',
        errorLogEntries: 'รายการบันทึกข้อผิดพลาด'
      },
      storage: {
        label: 'พื้นที่จัดเก็บทั้งหมด',
        usedTotal: (used, total) => `ใช้ไป ${used} / ทั้งหมด ${total}`,
        loading: 'กำลังโหลด…',
        free: 'ว่าง'
      },
      apps: {
        label: 'แอปที่ติดตั้ง',
        broken: (count) => `เหลือค้าง ${count} รายการจากการถอนการติดตั้งที่ล้มเหลว`,
        noBroken: 'ไม่มีรายการที่เสียหาย',
        review: 'ตรวจสอบ',
        manage: 'จัดการ'
      },
      junk: {
        label: 'ไฟล์ที่ไม่จำเป็น',
        notMeasured: 'ยังไม่ได้วัด',
        description: 'การวัดจะตรวจทุกเส้นทางการล้างข้อมูลบนดิสก์ — ประมาณครึ่งนาที',
        measure: 'วัด'
      },
      recentActivity: {
        title: 'กิจกรรมล่าสุด',
        hide: 'ซ่อน',
        show: 'แสดง',
        empty: 'ยังไม่มีการถอนการติดตั้ง',
        freed: 'ที่เพิ่มพื้นที่ว่าง'
      }
    }
  },

  tr: {
    nav: {
      dashboard: 'Panel', diskMap: 'Disk Haritası', applications: 'Uygulamalar',
      quarantine: 'Karantina', settings: 'Ayarlar', startup: 'Başlangıç',
      duplicates: 'Yinelenenler', deepClean: 'Derinlemesine Temizlik'
    },
    settings: { language: { title: 'Dil', description: "Prune'un kendi ekranlarının gösterildiği dil." } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `Bu PC kapalıyken ${count} zamanlanmış çalıştırma atlandı`,
        due: 'Zamanlanmış bir çalıştırmanın vakti geldi'
      },
      driveHealth: {
        title: 'Disk Sağlığı',
        error: (message) => `Disk sağlığı okunamadı: ${message}`,
        loading: 'Disk sağlığı okunuyor…',
        unknownStatus: 'Bilinmiyor',
        lifeRemaining: (percent) => `%${percent} ömür kaldı`,
        poweredOn: (hours) => `${hours} sa açık kaldı`,
        reportsStatus: (status) => `Windows bu diskin durumunu ${status} olarak bildiriyor.`,
        statusUnknown: 'durum bilinmiyor',
        needsAdmin: 'Aşınma, sıcaklık ve açık kalma süresi yönetici erişimi gerektirir — Prune bunun yerine uydurma bir rakam göstermeyecek.',
        readWear: 'Disk aşınmasını oku (yönetici)',
        waitingApproval: 'Onay bekleniyor…',
        notApproved: 'Onaylanmadı — Windows\'un bildirdiği hâliyle gösterilmeye devam ediyor.',
        noWearData: 'Bu disk, yönetici olarak bile aşınma verisi bildirmiyor.',
        uncorrectedErrors: (read, write) => `${read} düzeltilmemiş okuma hatası · ${write} düzeltilmemiş yazma hatası`
      },
      smart: {
        header: 'Diskin kendi bildirdiğine göre',
        powerOnHours: 'Açık kalma süresi',
        powerCycles: 'Güç döngüleri',
        dataWritten: 'Yazılan veri',
        dataRead: 'Okunan veri',
        spareBlocks: 'Yedek bloklar',
        unsafeShutdowns: 'Güvensiz kapanmalar',
        mediaErrors: 'Ortam hataları',
        errorLogEntries: 'Hata günlüğü kayıtları'
      },
      storage: {
        label: 'Toplam Depolama',
        usedTotal: (used, total) => `${used} Kullanılan / ${total} Toplam`,
        loading: 'Yükleniyor…',
        free: 'boş'
      },
      apps: {
        label: 'Yüklü Uygulamalar',
        broken: (count) => `Başarısız kaldırma nedeniyle kalan ${count} öğe`,
        noBroken: 'Bozuk öğe yok.',
        review: 'İncele',
        manage: 'Yönet'
      },
      junk: {
        label: 'Gereksiz Dosyalar',
        notMeasured: 'ölçülmedi',
        description: 'Ölçüm, diskteki her temizleme yolunu tarar — yaklaşık yarım dakika.',
        measure: 'Ölç'
      },
      recentActivity: {
        title: 'Son Etkinlik',
        hide: 'Gizle',
        show: 'Göster',
        empty: 'Henüz kaldırma yok.',
        freed: 'boşaltıldı'
      }
    }
  },

  uk: {
    nav: {
      dashboard: 'Панель', diskMap: 'Карта диска', applications: 'Застосунки',
      quarantine: 'Карантин', settings: 'Налаштування', startup: 'Автозавантаження',
      duplicates: 'Дублікати', deepClean: 'Глибоке очищення'
    },
    settings: { language: { title: 'Мова', description: 'Мова, якою відображаються власні екрани Prune.' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `${count} запланован${count === 1 ? 'ий запуск було' : 'их запуски було'} пропущено, поки цей ПК був вимкнений`,
        due: 'Настав час запланованого запуску'
      },
      driveHealth: {
        title: 'Стан Диска',
        error: (message) => `Не вдалося прочитати стан диска: ${message}`,
        loading: 'Читання стану диска…',
        unknownStatus: 'Невідомо',
        lifeRemaining: (percent) => `${percent}% ресурсу залишилося`,
        poweredOn: (hours) => `${hours} год у роботі`,
        reportsStatus: (status) => `Windows повідомляє, що стан цього диска — ${status}.`,
        statusUnknown: 'стан невідомий',
        needsAdmin: 'Знос, температура та години роботи потребують прав адміністратора — Prune не показуватиме вигадане число замість цього.',
        readWear: 'Прочитати знос диска (адміністратор)',
        waitingApproval: 'Очікування підтвердження…',
        notApproved: 'Не підтверджено — усе ще показує те, що повідомляє Windows.',
        noWearData: 'Цей диск не повідомляє дані про знос, навіть з правами адміністратора.',
        uncorrectedErrors: (read, write) => `${read} невиправлених помилок читання · ${write} невиправлених помилок запису`
      },
      smart: {
        header: 'За власними даними диска',
        powerOnHours: 'Години роботи',
        powerCycles: 'Цикли увімкнення',
        dataWritten: 'Записано даних',
        dataRead: 'Прочитано даних',
        spareBlocks: 'Резервні блоки',
        unsafeShutdowns: 'Небезпечні вимкнення',
        mediaErrors: 'Помилки носія',
        errorLogEntries: 'Записи журналу помилок'
      },
      storage: {
        label: 'Загальне Сховище',
        usedTotal: (used, total) => `${used} використано / ${total} всього`,
        loading: 'Завантаження…',
        free: 'вільно'
      },
      apps: {
        label: 'Встановлені Застосунки',
        broken: (count) => `${count} залишилося після невдалого видалення`,
        noBroken: 'Пошкоджених записів немає.',
        review: 'Переглянути',
        manage: 'Керувати'
      },
      junk: {
        label: 'Непотрібні Файли',
        notMeasured: 'не виміряно',
        description: 'Вимірювання проходить кожним шляхом очищення на диску — приблизно півхвилини.',
        measure: 'Виміряти'
      },
      recentActivity: {
        title: 'Остання Активність',
        hide: 'Приховати',
        show: 'Показати',
        empty: 'Ще немає видалень.',
        freed: 'звільнено'
      }
    }
  },

  vi: {
    nav: {
      dashboard: 'Bảng điều khiển', diskMap: 'Bản đồ ổ đĩa', applications: 'Ứng dụng',
      quarantine: 'Cách ly', settings: 'Cài đặt', startup: 'Khởi động cùng',
      duplicates: 'Tệp trùng lặp', deepClean: 'Dọn dẹp sâu'
    },
    settings: { language: { title: 'Ngôn ngữ', description: 'Ngôn ngữ hiển thị trên chính màn hình của Prune.' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `${count} lần chạy theo lịch đã bị bỏ lỡ khi máy tính này tắt`,
        due: 'Đã đến hạn một lần chạy theo lịch'
      },
      driveHealth: {
        title: 'Tình Trạng Ổ Đĩa',
        error: (message) => `Không thể đọc tình trạng ổ đĩa: ${message}`,
        loading: 'Đang đọc tình trạng ổ đĩa…',
        unknownStatus: 'Không xác định',
        lifeRemaining: (percent) => `Còn lại ${percent}% tuổi thọ`,
        poweredOn: (hours) => `${hours} giờ hoạt động`,
        reportsStatus: (status) => `Windows báo cáo ổ đĩa này ở trạng thái ${status}.`,
        statusUnknown: 'không rõ trạng thái',
        needsAdmin: 'Độ hao mòn, nhiệt độ và giờ hoạt động cần quyền quản trị viên — Prune sẽ không hiển thị con số bịa đặt thay vào đó.',
        readWear: 'Đọc độ hao mòn ổ đĩa (quản trị viên)',
        waitingApproval: 'Đang chờ phê duyệt…',
        notApproved: 'Không được phê duyệt — vẫn hiển thị những gì Windows báo cáo.',
        noWearData: 'Ổ đĩa này không báo cáo dữ liệu hao mòn, kể cả khi ở quyền quản trị viên.',
        uncorrectedErrors: (read, write) => `${read} lỗi đọc chưa sửa · ${write} lỗi ghi chưa sửa`
      },
      smart: {
        header: 'Theo báo cáo của chính ổ đĩa',
        powerOnHours: 'Giờ hoạt động',
        powerCycles: 'Số chu kỳ bật nguồn',
        dataWritten: 'Dữ liệu đã ghi',
        dataRead: 'Dữ liệu đã đọc',
        spareBlocks: 'Khối dự phòng',
        unsafeShutdowns: 'Tắt máy không an toàn',
        mediaErrors: 'Lỗi phương tiện lưu trữ',
        errorLogEntries: 'Mục nhật ký lỗi'
      },
      storage: {
        label: 'Tổng Dung Lượng',
        usedTotal: (used, total) => `${used} Đã dùng / ${total} Tổng`,
        loading: 'Đang tải…',
        free: 'trống'
      },
      apps: {
        label: 'Ứng Dụng Đã Cài',
        broken: (count) => `${count} mục còn sót lại do gỡ cài đặt thất bại`,
        noBroken: 'Không có mục bị hỏng.',
        review: 'Xem lại',
        manage: 'Quản lý'
      },
      junk: {
        label: 'Tệp Không Cần Thiết',
        notMeasured: 'chưa đo',
        description: 'Việc đo lường sẽ quét qua từng đường dẫn dọn dẹp trên ổ đĩa — khoảng nửa phút.',
        measure: 'Đo lường'
      },
      recentActivity: {
        title: 'Hoạt Động Gần Đây',
        hide: 'Ẩn',
        show: 'Hiện',
        empty: 'Chưa có lần gỡ cài đặt nào.',
        freed: 'đã giải phóng'
      }
    }
  },

  'zh-CN': {
    nav: {
      dashboard: '仪表盘', diskMap: '磁盘地图', applications: '应用程序',
      quarantine: '隔离区', settings: '设置', startup: '启动项',
      duplicates: '重复文件', deepClean: '深度清理'
    },
    settings: { language: { title: '语言', description: 'Prune 自身界面所使用的语言。' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `此电脑关机期间错过了 ${count} 次计划运行`,
        due: '一次计划运行已到期'
      },
      driveHealth: {
        title: '驱动器健康状况',
        error: (message) => `无法读取驱动器健康状况：${message}`,
        loading: '正在读取驱动器健康状况…',
        unknownStatus: '未知',
        lifeRemaining: (percent) => `剩余寿命 ${percent}%`,
        poweredOn: (hours) => `通电 ${hours} 小时`,
        reportsStatus: (status) => `Windows 报告该驱动器状态为${status}。`,
        statusUnknown: '状态未知',
        needsAdmin: '查看磨损度、温度和通电时长需要管理员权限 — Prune 不会用编造的数字代替显示。',
        readWear: '读取驱动器磨损度（管理员）',
        waitingApproval: '等待批准…',
        notApproved: '未获批准 — 仍显示 Windows 报告的内容。',
        noWearData: '即使以管理员身份运行，此驱动器也不会报告磨损数据。',
        uncorrectedErrors: (read, write) => `未纠正的读取错误 ${read} 个 · 未纠正的写入错误 ${write} 个`
      },
      smart: {
        header: '据驱动器自身报告',
        powerOnHours: '通电小时数',
        powerCycles: '通电次数',
        dataWritten: '已写入数据',
        dataRead: '已读取数据',
        spareBlocks: '备用块',
        unsafeShutdowns: '异常关机次数',
        mediaErrors: '介质错误',
        errorLogEntries: '错误日志条目'
      },
      storage: {
        label: '总存储空间',
        usedTotal: (used, total) => `已用 ${used} / 共 ${total}`,
        loading: '加载中…',
        free: '可用'
      },
      apps: {
        label: '已安装的应用',
        broken: (count) => `因卸载失败而残留 ${count} 项`,
        noBroken: '没有损坏的条目。',
        review: '查看',
        manage: '管理'
      },
      junk: {
        label: '垃圾文件',
        notMeasured: '尚未测量',
        description: '测量会遍历磁盘上的每条清理路径 — 大约需要半分钟。',
        measure: '测量'
      },
      recentActivity: {
        title: '最近活动',
        hide: '隐藏',
        show: '显示',
        empty: '尚无卸载记录。',
        freed: '已释放'
      }
    }
  },

  'zh-TW': {
    nav: {
      dashboard: '儀表板', diskMap: '磁碟地圖', applications: '應用程式',
      quarantine: '隔離區', settings: '設定', startup: '啟動項目',
      duplicates: '重複檔案', deepClean: '深度清理'
    },
    settings: { language: { title: '語言', description: 'Prune 本身畫面所使用的語言。' } },
    dashboard: {
      scheduleBadge: {
        missed: (count) => `此電腦關機期間錯過了 ${count} 次排程執行`,
        due: '一次排程執行已到期'
      },
      driveHealth: {
        title: '硬碟健康狀態',
        error: (message) => `無法讀取硬碟健康狀態：${message}`,
        loading: '正在讀取硬碟健康狀態…',
        unknownStatus: '未知',
        lifeRemaining: (percent) => `剩餘壽命 ${percent}%`,
        poweredOn: (hours) => `通電 ${hours} 小時`,
        reportsStatus: (status) => `Windows 回報此硬碟狀態為${status}。`,
        statusUnknown: '狀態未知',
        needsAdmin: '查看磨損度、溫度與通電時數需要系統管理員權限 — Prune 不會以捏造的數字代替顯示。',
        readWear: '讀取硬碟磨損度（系統管理員）',
        waitingApproval: '等待核准…',
        notApproved: '未獲核准 — 仍顯示 Windows 回報的內容。',
        noWearData: '即使以系統管理員身分執行，此硬碟也不會回報磨損資料。',
        uncorrectedErrors: (read, write) => `未修正的讀取錯誤 ${read} 個 · 未修正的寫入錯誤 ${write} 個`
      },
      smart: {
        header: '依硬碟自身回報',
        powerOnHours: '通電小時數',
        powerCycles: '通電次數',
        dataWritten: '已寫入資料',
        dataRead: '已讀取資料',
        spareBlocks: '備用區塊',
        unsafeShutdowns: '異常關機次數',
        mediaErrors: '媒體錯誤',
        errorLogEntries: '錯誤記錄項目'
      },
      storage: {
        label: '總儲存空間',
        usedTotal: (used, total) => `已用 ${used} / 共 ${total}`,
        loading: '載入中…',
        free: '可用'
      },
      apps: {
        label: '已安裝的應用程式',
        broken: (count) => `因解除安裝失敗而殘留 ${count} 項`,
        noBroken: '沒有損壞的項目。',
        review: '檢視',
        manage: '管理'
      },
      junk: {
        label: '垃圾檔案',
        notMeasured: '尚未測量',
        description: '測量會走訪磁碟上的每條清理路徑 — 大約需要半分鐘。',
        measure: '測量'
      },
      recentActivity: {
        title: '最近活動',
        hide: '隱藏',
        show: '顯示',
        empty: '尚無解除安裝記錄。',
        freed: '已釋放'
      }
    }
  }
};
