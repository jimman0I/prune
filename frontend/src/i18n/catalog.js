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
    },
    diskMap: {
      title: 'Disk Usage',
      aggregateCell: (count) => `${count} smaller items`,
      subtitle: 'What is using the space on this drive, and where.',
      fastIndexSummary: (count) => `${count} files and folders read from the drive's own index.`,
      browsingInstant: 'Browsing is instant from here.',
      indexIncomplete: "Part of the index couldn't be read, so totals are a lower bound.",
      scanningDrive: 'Scanning drive…',
      readingDrive: 'Reading the drive…',
      rescanButton: 'Rescan drive (admin)',
      fastScanButton: 'Fast scan (admin)',
      loading: {
        heading: 'Reading every folder under',
        note: 'One directory at a time, which is the only way to do it without administrator access. A whole drive can take a minute and may not finish.',
        indexButton: 'Read the drive index instead (admin)'
      },
      driveRootPrompt: {
        heading: 'Read the whole drive',
        fastExplain: (path) => `A fast scan reads the drive's own file index — every file on ${path} in a few seconds, which is how WizTree does it. Windows only lets a program read that index with administrator access, so this raises a UAC prompt.`,
        crawlExplain: "The alternative walks folders one at a time. It needs no permission and is the right tool for a single folder, but it cannot finish a volume: on this drive it reached 4% of what's in use before running out of time, and the other 96% shows as unscanned rather than as anything useful.",
        crawlButton: 'Walk folders instead'
      },
      scanFailure: (path, error) => `Couldn't scan "${path}": ${error}`,
      fastScanDeclined: 'Not approved — still using the folder-by-folder scan.',
      truncated: {
        withCoverage: (measured, used, percent) => `This scan ran out of time: it measured ${measured} of the ${used} in use (${percent}%). What it measured is real; the rest is shown as unscanned, not as empty.`,
        withoutCoverage: "This scan ran out of time before it finished the drive. Everything it did measure is real, but folders it never reached are shown as unscanned rather than as empty — don't read this as a full picture of what's using your space.",
        rescanLink: 'Run a fast scan instead'
      },
      view: { tree: 'Tree', files: 'Files' },
      folderTable: {
        empty: 'Nothing to list inside this folder.',
        notScanned: 'not scanned',
        columns: { folder: 'Folder', size: 'Size', items: 'Items', files: 'Files', folders: 'Folders', modified: 'Modified' }
      },
      extensionPanel: {
        header: 'By file type',
        typeCount: (n) => `${n} types`,
        noType: 'no type',
        footer: (bytes, count) => `${bytes} across ${count} files`,
        unopenedFolders: (bytes) => ` · ${bytes} in folders the scan did not open`
      },
      largestFiles: { empty: 'The scan found no files to list.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} not measured`,
        aggregated: 'The smallest entries in this folder, grouped together.',
        unscanned: 'The scan stopped before reaching this. Its real size is unknown.'
      },
      cellOpenLabel: (name) => `Open ${name}`,
      contextMenu: {
        openInExplorer: 'Open in Explorer',
        copyPath: 'Copy path',
        moveToQuarantineMenu: 'Move to quarantine…'
      },
      toasts: {
        moved: (name) => `Moved to quarantine: ${name}`,
        restoreHint: 'Restore it from the Quarantine screen.',
        pathCopied: 'Path copied.',
        copyFailed: 'Could not copy that path.',
        moveFailed: 'That could not be moved.'
      },
      removeModal: {
        label: 'Move to quarantine',
        heading: 'Move this to quarantine?',
        note: 'It is moved, not deleted — restore it from the Quarantine screen at any time.',
        folder: 'Folder',
        file: 'File',
        cancel: 'Cancel'
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
    },
    diskMap: {
      title: 'Skyfgebruik',
      aggregateCell: (count) => `${count} kleiner items`,
      subtitle: "Wat gebruik die spasie op hierdie skyf, en waar.",
      fastIndexSummary: (count) => `${count} lêers en gidse gelees vanaf die skyf se eie indeks.`,
      browsingInstant: 'Blaai is onmiddellik vanaf hier.',
      indexIncomplete: "'n Deel van die indeks kon nie gelees word nie, dus is totale 'n ondergrens.",
      scanningDrive: 'Deurskandeer skyf…',
      readingDrive: 'Lees die skyf…',
      rescanButton: 'Skandeer skyf weer (admin)',
      fastScanButton: 'Vinnige skandering (admin)',
      loading: {
        heading: 'Lees elke gids onder',
        note: "Een gids op 'n slag, wat die enigste manier is om dit sonder administrateurtoegang te doen. 'n Hele skyf kan 'n minuut neem en dalk nie klaarmaak nie.",
        indexButton: 'Lees eerder die skyfindeks (admin)'
      },
      driveRootPrompt: {
        heading: 'Lees die hele skyf',
        fastExplain: (path) => `'n Vinnige skandering lees die skyf se eie lêerindeks — elke lêer op ${path} in 'n paar sekondes, soos WizTree dit doen. Windows laat 'n program slegs met administrateurtoegang daardie indeks lees, dus veroorsaak dit 'n UAC-versoek.`,
        crawlExplain: "Die alternatief loop deur gidse een op 'n slag. Dit benodig geen toestemming nie en is die regte manier vir 'n enkele gids, maar dit kan nie 'n hele volume voltooi nie: op hierdie skyf het dit 4% van wat in gebruik is, bereik voor tyd opgeraak het, en die ander 96% word as ongeskandeer gewys eerder as iets bruikbaars.",
        crawlButton: 'Loop eerder deur gidse'
      },
      scanFailure: (path, error) => `Kon nie "${path}" skandeer nie: ${error}`,
      fastScanDeclined: 'Nie goedgekeur nie — gebruik steeds die gids-vir-gids-skandering.',
      truncated: {
        withCoverage: (measured, used, percent) => `Hierdie skandering het uitgeloop: dit het ${measured} van die ${used} in gebruik gemeet (${percent}%). Wat dit gemeet het, is werklik; die res word as ongeskandeer gewys, nie as leeg nie.`,
        withoutCoverage: "Hierdie skandering het uitgeloop voordat dit die skyf voltooi het. Alles wat dit wel gemeet het, is werklik, maar gidse wat dit nooit bereik het nie, word as ongeskandeer gewys eerder as leeg — moenie dit as 'n volledige prentjie van wat jou spasie gebruik, lees nie.",
        rescanLink: "Doen eerder 'n vinnige skandering"
      },
      view: { tree: 'Boom', files: 'Lêers' },
      folderTable: {
        empty: 'Niks om binne hierdie gids te lys nie.',
        notScanned: 'nie geskandeer nie',
        columns: { folder: 'Gids', size: 'Grootte', items: 'Items', files: 'Lêers', folders: 'Gidse', modified: 'Gewysig' }
      },
      extensionPanel: {
        header: 'Volgens lêertipe',
        typeCount: (n) => `${n} tipes`,
        noType: 'geen tipe',
        footer: (bytes, count) => `${bytes} oor ${count} lêers`,
        unopenedFolders: (bytes) => ` · ${bytes} in gidse wat die skandering nie oopgemaak het nie`
      },
      largestFiles: { empty: 'Die skandering het geen lêers gevind om te lys nie.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} nie gemeet nie`,
        aggregated: 'Die kleinste inskrywings in hierdie gids, saam gegroepeer.',
        unscanned: 'Die skandering het gestop voor dit hier uitgekom het. Die werklike grootte is onbekend.'
      },
      cellOpenLabel: (name) => `Maak ${name} oop`,
      contextMenu: {
        openInExplorer: 'Maak oop in Verkenner',
        copyPath: 'Kopieer pad',
        moveToQuarantineMenu: 'Skuif na karantyn…'
      },
      toasts: {
        moved: (name) => `Na karantyn geskuif: ${name}`,
        restoreHint: 'Herstel dit vanaf die Karantyn-skerm.',
        pathCopied: 'Pad gekopieer.',
        copyFailed: 'Kon nie daardie pad kopieer nie.',
        moveFailed: 'Dit kon nie geskuif word nie.'
      },
      removeModal: {
        label: 'Skuif na karantyn',
        heading: 'Skuif dit na karantyn?',
        note: 'Dit word geskuif, nie verwyder nie — herstel dit enige tyd vanaf die Karantyn-skerm.',
        folder: 'Gids',
        file: 'Lêer',
        cancel: 'Kanselleer'
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
    },
    diskMap: {
      title: 'استخدام القرص',
      aggregateCell: (count) => `${count} عناصر أصغر`,
      subtitle: 'ما الذي يستخدم المساحة على هذا القرص، وأين.',
      fastIndexSummary: (count) => `تمت قراءة ${count} من الملفات والمجلدات من فهرس القرص نفسه.`,
      browsingInstant: 'التصفح فوري من هنا.',
      indexIncomplete: 'تعذّرت قراءة جزء من الفهرس، لذا فإن الإجماليات هي حد أدنى.',
      scanningDrive: 'جارٍ فحص القرص…',
      readingDrive: 'جارٍ قراءة القرص…',
      rescanButton: 'إعادة فحص القرص (كمسؤول)',
      fastScanButton: 'فحص سريع (كمسؤول)',
      loading: {
        heading: 'قراءة كل مجلد تحت',
        note: 'مجلد واحد في كل مرة، وهي الطريقة الوحيدة للقيام بذلك دون صلاحيات المسؤول. قد يستغرق فحص القرص بأكمله دقيقة وقد لا يكتمل.',
        indexButton: 'قراءة فهرس القرص بدلاً من ذلك (كمسؤول)'
      },
      driveRootPrompt: {
        heading: 'قراءة القرص بأكمله',
        fastExplain: (path) => `يقرأ الفحص السريع فهرس ملفات القرص نفسه — كل ملف على ${path} في ثوانٍ معدودة، بنفس طريقة WizTree. لا يسمح Windows لأي برنامج بقراءة ذلك الفهرس إلا بصلاحيات المسؤول، لذا يظهر طلب UAC.`,
        crawlExplain: 'البديل يمر عبر المجلدات واحدًا تلو الآخر. لا يحتاج إلى أي إذن وهو الأداة المناسبة لمجلد واحد، لكنه لا يستطيع إنهاء مجلد كامل: على هذا القرص وصل إلى 4% مما هو مستخدم قبل نفاد الوقت، وتظهر النسبة الأخرى 96% كغير مفحوصة بدلاً من أي شيء مفيد.',
        crawlButton: 'المرور عبر المجلدات بدلاً من ذلك'
      },
      scanFailure: (path, error) => `تعذّر فحص "${path}": ${error}`,
      fastScanDeclined: 'لم تتم الموافقة — لا يزال يُستخدم الفحص مجلدًا تلو الآخر.',
      truncated: {
        withCoverage: (measured, used, percent) => `نفد وقت هذا الفحص: قاس ${measured} من أصل ${used} المستخدمة (${percent}٪). ما تم قياسه حقيقي؛ ويظهر الباقي كغير مفحوص، لا كفارغ.`,
        withoutCoverage: 'نفد وقت هذا الفحص قبل أن ينهي القرص. كل ما تم قياسه فعليًا حقيقي، لكن المجلدات التي لم يصلها تظهر كغير مفحوصة وليست فارغة — لا تعتبر هذا صورة كاملة لما يستخدم مساحتك.',
        rescanLink: 'تشغيل فحص سريع بدلاً من ذلك'
      },
      view: { tree: 'الشجرة', files: 'الملفات' },
      folderTable: {
        empty: 'لا يوجد شيء لعرضه داخل هذا المجلد.',
        notScanned: 'لم يُفحص',
        columns: { folder: 'المجلد', size: 'الحجم', items: 'العناصر', files: 'الملفات', folders: 'المجلدات', modified: 'التعديل' }
      },
      extensionPanel: {
        header: 'حسب نوع الملف',
        typeCount: (n) => `${n} أنواع`,
        noType: 'بلا نوع',
        footer: (bytes, count) => `${bytes} عبر ${count} ملف`,
        unopenedFolders: (bytes) => ` · ${bytes} في مجلدات لم يفتحها الفحص`
      },
      largestFiles: { empty: 'لم يعثر الفحص على ملفات لعرضها.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} غير مقاس`,
        aggregated: 'أصغر العناصر في هذا المجلد، مجمّعة معًا.',
        unscanned: 'توقف الفحص قبل الوصول إلى هذا. حجمه الحقيقي غير معروف.'
      },
      cellOpenLabel: (name) => `فتح ${name}`,
      contextMenu: {
        openInExplorer: 'فتح في مستكشف الملفات',
        copyPath: 'نسخ المسار',
        moveToQuarantineMenu: 'نقل إلى الحجر…'
      },
      toasts: {
        moved: (name) => `تم النقل إلى الحجر: ${name}`,
        restoreHint: 'استعده من شاشة الحجر.',
        pathCopied: 'تم نسخ المسار.',
        copyFailed: 'تعذّر نسخ هذا المسار.',
        moveFailed: 'تعذّر نقل هذا.'
      },
      removeModal: {
        label: 'نقل إلى الحجر',
        heading: 'هل تريد نقل هذا إلى الحجر؟',
        note: 'يُنقل ولا يُحذف — استعده في أي وقت من شاشة الحجر.',
        folder: 'مجلد',
        file: 'ملف',
        cancel: 'إلغاء'
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
    },
    diskMap: {
      title: 'Ús del disc',
      aggregateCell: (count) => `${count} elements més petits`,
      subtitle: "Què utilitza l'espai en aquest disc, i on.",
      fastIndexSummary: (count) => `${count} fitxers i carpetes llegits des de l'índex propi del disc.`,
      browsingInstant: "La navegació és instantània des d'aquí.",
      indexIncomplete: "No s'ha pogut llegir part de l'índex, per la qual cosa els totals són un límit inferior.",
      scanningDrive: 'Escanejant el disc…',
      readingDrive: 'Llegint el disc…',
      rescanButton: 'Torna a escanejar el disc (admin)',
      fastScanButton: 'Escaneig ràpid (admin)',
      loading: {
        heading: 'Llegint cada carpeta dins de',
        note: "Una carpeta cada vegada, que és l'única manera de fer-ho sense accés d'administrador. Un disc sencer pot trigar un minut i potser no acabi.",
        indexButton: "Llegeix l'índex del disc en lloc d'això (admin)"
      },
      driveRootPrompt: {
        heading: 'Llegeix tot el disc',
        fastExplain: (path) => `Un escaneig ràpid llegeix l'índex de fitxers propi del disc — cada fitxer de ${path} en pocs segons, tal com fa WizTree. El Windows només deixa a un programa llegir aquest índex amb accés d'administrador, per això apareix un avís UAC.`,
        crawlExplain: "L'alternativa recorre les carpetes d'una en una. No necessita cap permís i és l'eina adequada per a una sola carpeta, però no pot acabar un volum sencer: en aquest disc va arribar al 4% del que s'utilitza abans d'esgotar el temps, i l'altre 96% es mostra com a no escanejat en lloc de com a res útil.",
        crawlButton: "Recorre les carpetes en lloc d'això"
      },
      scanFailure: (path, error) => `No s'ha pogut escanejar "${path}": ${error}`,
      fastScanDeclined: "No aprovat — es continua utilitzant l'escaneig carpeta per carpeta.",
      truncated: {
        withCoverage: (measured, used, percent) => `Aquest escaneig s'ha esgotat: ha mesurat ${measured} dels ${used} en ús (${percent}%). El que ha mesurat és real; la resta es mostra com a no escanejat, no com a buit.`,
        withoutCoverage: "Aquest escaneig s'ha esgotat abans d'acabar el disc. Tot el que ha mesurat és real, però les carpetes a les quals no ha arribat es mostren com a no escanejades en lloc de buides — no ho llegeixis com una imatge completa del que utilitza el teu espai.",
        rescanLink: "Fes un escaneig ràpid en lloc d'això"
      },
      view: { tree: 'Arbre', files: 'Fitxers' },
      folderTable: {
        empty: "Res per llistar dins d'aquesta carpeta.",
        notScanned: 'no escanejat',
        columns: { folder: 'Carpeta', size: 'Mida', items: 'Elements', files: 'Fitxers', folders: 'Carpetes', modified: 'Modificat' }
      },
      extensionPanel: {
        header: 'Per tipus de fitxer',
        typeCount: (n) => `${n} tipus`,
        noType: 'sense tipus',
        footer: (bytes, count) => `${bytes} en ${count} fitxers`,
        unopenedFolders: (bytes) => ` · ${bytes} en carpetes que l'escaneig no ha obert`
      },
      largestFiles: { empty: "L'escaneig no ha trobat cap fitxer per llistar." },
      tooltip: {
        notMeasured: (bytes) => `${bytes} no mesurat`,
        aggregated: "Les entrades més petites d'aquesta carpeta, agrupades.",
        unscanned: "L'escaneig s'ha aturat abans d'arribar aquí. La mida real és desconeguda."
      },
      cellOpenLabel: (name) => `Obre ${name}`,
      contextMenu: {
        openInExplorer: "Obre a l'Explorador",
        copyPath: 'Copia el camí',
        moveToQuarantineMenu: 'Mou a la quarantena…'
      },
      toasts: {
        moved: (name) => `Mogut a la quarantena: ${name}`,
        restoreHint: "Restaura'l des de la pantalla de Quarantena.",
        pathCopied: 'Camí copiat.',
        copyFailed: "No s'ha pogut copiar aquest camí.",
        moveFailed: "No s'ha pogut moure."
      },
      removeModal: {
        label: 'Mou a la quarantena',
        heading: 'Vols moure això a la quarantena?',
        note: "Es mou, no s'elimina — restaura'l en qualsevol moment des de la pantalla de Quarantena.",
        folder: 'Carpeta',
        file: 'Fitxer',
        cancel: "Cancel·la"
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
    },
    diskMap: {
      title: 'Využití disku',
      aggregateCell: (count) => `${count} menších položek`,
      subtitle: 'Co využívá místo na tomto disku a kde.',
      fastIndexSummary: (count) => `${count} souborů a složek načteno z vlastního indexu disku.`,
      browsingInstant: 'Procházení je odtud okamžité.',
      indexIncomplete: 'Část indexu se nepodařilo načíst, takže součty jsou dolní odhad.',
      scanningDrive: 'Prohledávání disku…',
      readingDrive: 'Čtení disku…',
      rescanButton: 'Znovu prohledat disk (admin)',
      fastScanButton: 'Rychlé prohledání (admin)',
      loading: {
        heading: 'Čtení každé složky pod',
        note: 'Jedna složka po druhé, což je jediný způsob, jak to udělat bez oprávnění správce. Celý disk může trvat minutu a nemusí skončit.',
        indexButton: 'Místo toho načíst index disku (admin)'
      },
      driveRootPrompt: {
        heading: 'Načíst celý disk',
        fastExplain: (path) => `Rychlé prohledání načte vlastní souborový index disku — každý soubor na ${path} za pár sekund, stejně jako to dělá WizTree. Windows umožňuje programu číst tento index pouze s oprávněním správce, takže se zobrazí výzva UAC.`,
        crawlExplain: 'Alternativa prochází složky jednu po druhé. Nevyžaduje žádné oprávnění a je vhodná pro jednu složku, ale nedokáže dokončit celý svazek: na tomto disku dosáhla 4 % využitého místa, než jí došel čas, a zbylých 96 % se zobrazuje jako neprohledáno místo jako cokoli užitečného.',
        crawlButton: 'Místo toho procházet složky'
      },
      scanFailure: (path, error) => `Nepodařilo se prohledat „${path}“: ${error}`,
      fastScanDeclined: 'Neschváleno — stále se používá prohledávání složka po složce.',
      truncated: {
        withCoverage: (measured, used, percent) => `Toto prohledání vypršelo: změřilo ${measured} z ${used} využitého místa (${percent} %). Co změřilo, je skutečné; zbytek se zobrazuje jako neprohledaný, nikoli jako prázdný.`,
        withoutCoverage: 'Toto prohledání vypršelo, než dokončilo disk. Vše, co skutečně změřilo, je skutečné, ale složky, ke kterým se nedostalo, se zobrazují jako neprohledané, nikoli jako prázdné — neberte to jako úplný obraz toho, co využívá vaše místo.',
        rescanLink: 'Místo toho spustit rychlé prohledání'
      },
      view: { tree: 'Strom', files: 'Soubory' },
      folderTable: {
        empty: 'V této složce není nic k zobrazení.',
        notScanned: 'neprohledáno',
        columns: { folder: 'Složka', size: 'Velikost', items: 'Položky', files: 'Soubory', folders: 'Složky', modified: 'Změněno' }
      },
      extensionPanel: {
        header: 'Podle typu souboru',
        typeCount: (n) => `${n} typů`,
        noType: 'bez typu',
        footer: (bytes, count) => `${bytes} napříč ${count} soubory`,
        unopenedFolders: (bytes) => ` · ${bytes} ve složkách, které prohledání neotevřelo`
      },
      largestFiles: { empty: 'Prohledání nenašlo žádné soubory k zobrazení.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} nezměřeno`,
        aggregated: 'Nejmenší položky v této složce, seskupené dohromady.',
        unscanned: 'Prohledání se zastavilo, než se sem dostalo. Skutečná velikost není známa.'
      },
      cellOpenLabel: (name) => `Otevřít ${name}`,
      contextMenu: {
        openInExplorer: 'Otevřít v Průzkumníkovi',
        copyPath: 'Kopírovat cestu',
        moveToQuarantineMenu: 'Přesunout do karantény…'
      },
      toasts: {
        moved: (name) => `Přesunuto do karantény: ${name}`,
        restoreHint: 'Obnovte to z obrazovky Karanténa.',
        pathCopied: 'Cesta zkopírována.',
        copyFailed: 'Tuto cestu se nepodařilo zkopírovat.',
        moveFailed: 'Toto se nepodařilo přesunout.'
      },
      removeModal: {
        label: 'Přesunout do karantény',
        heading: 'Přesunout toto do karantény?',
        note: 'Přesune se, nesmaže se — kdykoli to obnovte z obrazovky Karanténa.',
        folder: 'Složka',
        file: 'Soubor',
        cancel: 'Zrušit'
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
    },
    diskMap: {
      title: 'Defnydd Disg',
      aggregateCell: (count) => `${count} eitem llai`,
      subtitle: "Beth sy'n defnyddio'r lle ar y ddisg hon, a ble.",
      fastIndexSummary: (count) => `${count} ffeil a ffolder wedi'u darllen o fynegai ei hun y ddisg.`,
      browsingInstant: "Mae pori yn syth o fan hyn.",
      indexIncomplete: "Ni ellid darllen rhan o'r mynegai, felly mae'r cyfansymiau'n isafswm.",
      scanningDrive: "Sganio'r ddisg…",
      readingDrive: 'Darllen y ddisg…',
      rescanButton: "Ailsganio'r ddisg (gweinyddwr)",
      fastScanButton: 'Sgan cyflym (gweinyddwr)',
      loading: {
        heading: 'Darllen pob ffolder o dan',
        note: "Un cyfeiriadur ar y tro, sef yr unig ffordd o'i wneud heb fynediad gweinyddwr. Gall disg gyfan gymryd munud ac efallai na fydd yn gorffen.",
        indexButton: "Darllen mynegai'r ddisg yn lle hynny (gweinyddwr)"
      },
      driveRootPrompt: {
        heading: 'Darllen y ddisg gyfan',
        fastExplain: (path) => `Mae sgan cyflym yn darllen mynegai ffeiliau ei hun y ddisg — pob ffeil ar ${path} mewn ychydig eiliadau, yr un ffordd ag y mae WizTree yn ei wneud. Dim ond gyda mynediad gweinyddwr y mae Windows yn gadael i raglen ddarllen y mynegai hwnnw, felly mae hyn yn codi cais UAC.`,
        crawlExplain: "Mae'r dewis arall yn cerdded drwy ffolderi fesul un. Nid oes angen unrhyw ganiatâd arno ac mae'n arf priodol ar gyfer un ffolder, ond ni all orffen cyfrol gyfan: ar y ddisg hon fe gyrhaeddodd 4% o'r hyn sydd mewn defnydd cyn i amser redeg allan, ac mae'r 96% arall yn dangos fel heb ei sganio yn hytrach nag unrhyw beth defnyddiol.",
        crawlButton: "Cerdded drwy ffolderi yn lle hynny"
      },
      scanFailure: (path, error) => `Methwyd sganio "${path}": ${error}`,
      fastScanDeclined: "Heb ei gymeradwyo — yn dal i ddefnyddio'r sgan fesul ffolder.",
      truncated: {
        withCoverage: (measured, used, percent) => `Rhedodd y sgan hwn allan o amser: mesurodd ${measured} o'r ${used} sydd mewn defnydd (${percent}%). Mae'r hyn a fesurwyd yn real; dangosir y gweddill fel heb ei sganio, nid fel gwag.`,
        withoutCoverage: "Rhedodd y sgan hwn allan o amser cyn gorffen y ddisg. Mae popeth a fesurwyd yn real, ond dangosir ffolderi na chyrhaeddwyd fel heb eu sganio yn hytrach na gwag — peidiwch â darllen hyn fel darlun cyflawn o'r hyn sy'n defnyddio'ch lle.",
        rescanLink: "Rhedeg sgan cyflym yn lle hynny"
      },
      view: { tree: 'Coeden', files: 'Ffeiliau' },
      folderTable: {
        empty: "Dim byd i'w restru y tu mewn i'r ffolder hon.",
        notScanned: "heb ei sganio",
        columns: { folder: 'Ffolder', size: 'Maint', items: 'Eitemau', files: 'Ffeiliau', folders: 'Ffolderi', modified: 'Diwygiwyd' }
      },
      extensionPanel: {
        header: 'Yn ôl math o ffeil',
        typeCount: (n) => `${n} math`,
        noType: 'dim math',
        footer: (bytes, count) => `${bytes} ar draws ${count} ffeil`,
        unopenedFolders: (bytes) => ` · ${bytes} mewn ffolderi na agorodd y sgan`
      },
      largestFiles: { empty: "Ni ddaeth y sgan o hyd i unrhyw ffeiliau i'w rhestru." },
      tooltip: {
        notMeasured: (bytes) => `${bytes} heb ei fesur`,
        aggregated: "Y cofnodion lleiaf yn y ffolder hon, wedi'u grwpio gyda'i gilydd.",
        unscanned: "Stopiodd y sgan cyn cyrraedd hyn. Mae ei faint gwirioneddol yn anhysbys."
      },
      cellOpenLabel: (name) => `Agor ${name}`,
      contextMenu: {
        openInExplorer: 'Agor yn yr Explorer',
        copyPath: "Copïo'r llwybr",
        moveToQuarantineMenu: 'Symud i gwarantin…'
      },
      toasts: {
        moved: (name) => `Wedi symud i gwarantin: ${name}`,
        restoreHint: "Adferwch o'r sgrin Cwarantin.",
        pathCopied: "Llwybr wedi'i gopïo.",
        copyFailed: "Methwyd copïo'r llwybr hwnnw.",
        moveFailed: 'Methwyd symud hwn.'
      },
      removeModal: {
        label: 'Symud i gwarantin',
        heading: 'Symud hwn i gwarantin?',
        note: "Caiff ei symud, nid ei ddileu — ei adfer unrhyw bryd o'r sgrin Cwarantin.",
        folder: 'Ffolder',
        file: 'Ffeil',
        cancel: 'Diddymu'
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
    },
    diskMap: {
      title: 'Diskforbrug',
      aggregateCell: (count) => `${count} mindre elementer`,
      subtitle: 'Hvad der bruger pladsen på denne disk, og hvor.',
      fastIndexSummary: (count) => `${count} filer og mapper læst fra diskens eget indeks.`,
      browsingInstant: 'Gennemsyn er øjeblikkeligt herfra.',
      indexIncomplete: 'En del af indekset kunne ikke læses, så totalerne er et minimum.',
      scanningDrive: 'Scanner disk…',
      readingDrive: 'Læser disken…',
      rescanButton: 'Genscan disk (admin)',
      fastScanButton: 'Hurtig scanning (admin)',
      loading: {
        heading: 'Læser hver mappe under',
        note: 'Én mappe ad gangen, hvilket er den eneste måde at gøre det på uden administratoradgang. En hel disk kan tage et minut og bliver måske ikke færdig.',
        indexButton: 'Læs i stedet diskindekset (admin)'
      },
      driveRootPrompt: {
        heading: 'Læs hele disken',
        fastExplain: (path) => `En hurtig scanning læser diskens eget filindeks — hver fil på ${path} på få sekunder, ligesom WizTree gør det. Windows tillader kun et program at læse dette indeks med administratoradgang, så dette udløser en UAC-anmodning.`,
        crawlExplain: 'Alternativet gennemgår mapper én ad gangen. Det kræver ingen tilladelse og er det rette redskab til en enkelt mappe, men kan ikke gennemføre en hel diskenhed: på denne disk nåede den 4% af det brugte, før tiden løb ud, og de resterende 96% vises som uscannet i stedet for noget nyttigt.',
        crawlButton: 'Gennemgå mapper i stedet'
      },
      scanFailure: (path, error) => `Kunne ikke scanne "${path}": ${error}`,
      fastScanDeclined: 'Ikke godkendt — bruger stadig mappe-for-mappe-scanningen.',
      truncated: {
        withCoverage: (measured, used, percent) => `Denne scanning løb tør for tid: den målte ${measured} af de ${used} i brug (${percent}%). Det, den målte, er reelt; resten vises som uscannet, ikke som tomt.`,
        withoutCoverage: 'Denne scanning løb tør for tid, før den blev færdig med disken. Alt, den faktisk målte, er reelt, men mapper, den aldrig nåede, vises som uscannet frem for tomt — læs ikke dette som et fuldstændigt billede af, hvad der bruger din plads.',
        rescanLink: 'Kør i stedet en hurtig scanning'
      },
      view: { tree: 'Træ', files: 'Filer' },
      folderTable: {
        empty: 'Intet at vise i denne mappe.',
        notScanned: 'ikke scannet',
        columns: { folder: 'Mappe', size: 'Størrelse', items: 'Elementer', files: 'Filer', folders: 'Mapper', modified: 'Ændret' }
      },
      extensionPanel: {
        header: 'Efter filtype',
        typeCount: (n) => `${n} typer`,
        noType: 'ingen type',
        footer: (bytes, count) => `${bytes} fordelt på ${count} filer`,
        unopenedFolders: (bytes) => ` · ${bytes} i mapper, scanningen ikke åbnede`
      },
      largestFiles: { empty: 'Scanningen fandt ingen filer at vise.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} ikke målt`,
        aggregated: 'De mindste elementer i denne mappe, grupperet sammen.',
        unscanned: 'Scanningen stoppede, før den nåede hertil. Den reelle størrelse er ukendt.'
      },
      cellOpenLabel: (name) => `Åbn ${name}`,
      contextMenu: {
        openInExplorer: 'Åbn i Stifinder',
        copyPath: 'Kopiér sti',
        moveToQuarantineMenu: 'Flyt til karantæne…'
      },
      toasts: {
        moved: (name) => `Flyttet til karantæne: ${name}`,
        restoreHint: 'Gendan det fra skærmen Karantæne.',
        pathCopied: 'Sti kopieret.',
        copyFailed: 'Kunne ikke kopiere den sti.',
        moveFailed: 'Dette kunne ikke flyttes.'
      },
      removeModal: {
        label: 'Flyt til karantæne',
        heading: 'Flyt dette til karantæne?',
        note: 'Det bliver flyttet, ikke slettet — gendan det når som helst fra skærmen Karantæne.',
        folder: 'Mappe',
        file: 'Fil',
        cancel: 'Annuller'
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
    },
    diskMap: {
      title: 'Speicherplatznutzung',
      aggregateCell: (count) => `${count} kleinere Elemente`,
      subtitle: 'Was den Speicherplatz auf diesem Laufwerk belegt, und wo.',
      fastIndexSummary: (count) => `${count} Dateien und Ordner aus dem eigenen Index des Laufwerks gelesen.`,
      browsingInstant: 'Das Durchsuchen ist von hier aus sofort möglich.',
      indexIncomplete: 'Ein Teil des Index konnte nicht gelesen werden, daher sind die Summen eine Untergrenze.',
      scanningDrive: 'Laufwerk wird gescannt…',
      readingDrive: 'Laufwerk wird gelesen…',
      rescanButton: 'Laufwerk erneut scannen (Admin)',
      fastScanButton: 'Schnellscan (Admin)',
      loading: {
        heading: 'Jeder Ordner wird gelesen unter',
        note: 'Ein Verzeichnis nach dem anderen — das ist die einzige Möglichkeit, dies ohne Administratorrechte zu tun. Ein ganzes Laufwerk kann eine Minute dauern und wird möglicherweise nicht fertig.',
        indexButton: 'Stattdessen den Laufwerksindex lesen (Admin)'
      },
      driveRootPrompt: {
        heading: 'Das ganze Laufwerk lesen',
        fastExplain: (path) => `Ein Schnellscan liest den eigenen Dateiindex des Laufwerks — jede Datei auf ${path} in wenigen Sekunden, genau wie WizTree es macht. Windows erlaubt einem Programm nur mit Administratorrechten, diesen Index zu lesen, daher erscheint eine UAC-Aufforderung.`,
        crawlExplain: 'Die Alternative durchläuft Ordner einzeln nacheinander. Sie benötigt keine Berechtigung und ist das richtige Werkzeug für einen einzelnen Ordner, kann aber kein ganzes Volume abschließen: Auf diesem Laufwerk erreichte sie 4 % des belegten Speicherplatzes, bevor die Zeit ablief, und die restlichen 96 % werden als nicht gescannt angezeigt statt als etwas Brauchbares.',
        crawlButton: 'Stattdessen Ordner durchlaufen'
      },
      scanFailure: (path, error) => `„${path}“ konnte nicht gescannt werden: ${error}`,
      fastScanDeclined: 'Nicht genehmigt — verwendet weiterhin den Ordner-für-Ordner-Scan.',
      truncated: {
        withCoverage: (measured, used, percent) => `Diesem Scan ist die Zeit ausgegangen: Er hat ${measured} der ${used} genutzten gemessen (${percent} %). Was er gemessen hat, ist real; der Rest wird als nicht gescannt angezeigt, nicht als leer.`,
        withoutCoverage: 'Diesem Scan ist die Zeit ausgegangen, bevor er das Laufwerk fertig durchsucht hat. Alles, was er tatsächlich gemessen hat, ist real, aber Ordner, die er nie erreicht hat, werden als nicht gescannt angezeigt statt als leer — lesen Sie dies nicht als vollständiges Bild dessen, was Ihren Speicherplatz belegt.',
        rescanLink: 'Stattdessen einen Schnellscan ausführen'
      },
      view: { tree: 'Baum', files: 'Dateien' },
      folderTable: {
        empty: 'In diesem Ordner gibt es nichts aufzulisten.',
        notScanned: 'nicht gescannt',
        columns: { folder: 'Ordner', size: 'Größe', items: 'Elemente', files: 'Dateien', folders: 'Ordner', modified: 'Geändert' }
      },
      extensionPanel: {
        header: 'Nach Dateityp',
        typeCount: (n) => `${n} Typen`,
        noType: 'kein Typ',
        footer: (bytes, count) => `${bytes} auf ${count} Dateien verteilt`,
        unopenedFolders: (bytes) => ` · ${bytes} in Ordnern, die der Scan nicht geöffnet hat`
      },
      largestFiles: { empty: 'Der Scan hat keine Dateien zum Auflisten gefunden.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} nicht gemessen`,
        aggregated: 'Die kleinsten Einträge in diesem Ordner, zusammengefasst.',
        unscanned: 'Der Scan wurde gestoppt, bevor er dies erreicht hat. Die tatsächliche Größe ist unbekannt.'
      },
      cellOpenLabel: (name) => `${name} öffnen`,
      contextMenu: {
        openInExplorer: 'Im Explorer öffnen',
        copyPath: 'Pfad kopieren',
        moveToQuarantineMenu: 'In Quarantäne verschieben…'
      },
      toasts: {
        moved: (name) => `In Quarantäne verschoben: ${name}`,
        restoreHint: 'Über den Bildschirm Quarantäne wiederherstellen.',
        pathCopied: 'Pfad kopiert.',
        copyFailed: 'Dieser Pfad konnte nicht kopiert werden.',
        moveFailed: 'Dies konnte nicht verschoben werden.'
      },
      removeModal: {
        label: 'In Quarantäne verschieben',
        heading: 'Dies in Quarantäne verschieben?',
        note: 'Es wird verschoben, nicht gelöscht — jederzeit über den Bildschirm Quarantäne wiederherstellbar.',
        folder: 'Ordner',
        file: 'Datei',
        cancel: 'Abbrechen'
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
    },
    diskMap: {
      title: 'Χρήση Δίσκου',
      aggregateCell: (count) => `${count} μικρότερα στοιχεία`,
      subtitle: 'Τι χρησιμοποιεί τον χώρο σε αυτόν τον δίσκο, και πού.',
      fastIndexSummary: (count) => `${count} αρχεία και φάκελοι διαβάστηκαν από το ευρετήριο του ίδιου του δίσκου.`,
      browsingInstant: 'Η περιήγηση είναι άμεση από εδώ.',
      indexIncomplete: 'Μέρος του ευρετηρίου δεν μπόρεσε να διαβαστεί, οπότε τα σύνολα είναι κατώτερο όριο.',
      scanningDrive: 'Σάρωση δίσκου…',
      readingDrive: 'Ανάγνωση δίσκου…',
      rescanButton: 'Επανασάρωση δίσκου (διαχειριστής)',
      fastScanButton: 'Γρήγορη σάρωση (διαχειριστής)',
      loading: {
        heading: 'Ανάγνωση κάθε φακέλου μέσα στο',
        note: 'Έναν κατάλογο τη φορά, που είναι ο μόνος τρόπος να γίνει αυτό χωρίς πρόσβαση διαχειριστή. Ένας ολόκληρος δίσκος μπορεί να χρειαστεί ένα λεπτό και ίσως να μην ολοκληρωθεί.',
        indexButton: "Ανάγνωση του ευρετηρίου δίσκου αντ' αυτού (διαχειριστής)"
      },
      driveRootPrompt: {
        heading: 'Ανάγνωση ολόκληρου του δίσκου',
        fastExplain: (path) => `Μια γρήγορη σάρωση διαβάζει το δικό του ευρετήριο αρχείων του δίσκου — κάθε αρχείο στο ${path} μέσα σε λίγα δευτερόλεπτα, όπως ακριβώς το κάνει το WizTree. Τα Windows επιτρέπουν σε ένα πρόγραμμα να διαβάσει αυτό το ευρετήριο μόνο με πρόσβαση διαχειριστή, οπότε αυτό προκαλεί ένα αίτημα UAC.`,
        crawlExplain: 'Η εναλλακτική διατρέχει τους φακέλους έναν προς έναν. Δεν χρειάζεται καμία άδεια και είναι το σωστό εργαλείο για έναν μόνο φάκελο, αλλά δεν μπορεί να ολοκληρώσει έναν ολόκληρο τόμο: σε αυτόν τον δίσκο έφτασε στο 4% του χώρου που χρησιμοποιείται πριν εξαντληθεί ο χρόνος, και το υπόλοιπο 96% εμφανίζεται ως μη σαρωμένο αντί για κάτι χρήσιμο.',
        crawlButton: "Διάτρεξε τους φακέλους αντ' αυτού"
      },
      scanFailure: (path, error) => `Αδυναμία σάρωσης του «${path}»: ${error}`,
      fastScanDeclined: 'Δεν εγκρίθηκε — εξακολουθεί να χρησιμοποιείται η σάρωση φάκελο προς φάκελο.',
      truncated: {
        withCoverage: (measured, used, percent) => `Αυτή η σάρωση εξάντλησε τον χρόνο της: μέτρησε ${measured} από τα ${used} που χρησιμοποιούνται (${percent}%). Ό,τι μέτρησε είναι πραγματικό· το υπόλοιπο εμφανίζεται ως μη σαρωμένο, όχι ως κενό.`,
        withoutCoverage: 'Αυτή η σάρωση εξάντλησε τον χρόνο της πριν ολοκληρώσει τον δίσκο. Ό,τι πράγματι μέτρησε είναι πραγματικό, αλλά οι φάκελοι που δεν προλάβαμε να φτάσουμε εμφανίζονται ως μη σαρωμένοι αντί για κενοί — μην το διαβάσετε ως πλήρη εικόνα του τι χρησιμοποιεί τον χώρο σας.',
        rescanLink: "Εκτέλεσε αντ' αυτού μια γρήγορη σάρωση"
      },
      view: { tree: 'Δέντρο', files: 'Αρχεία' },
      folderTable: {
        empty: 'Τίποτα για εμφάνιση μέσα σε αυτόν τον φάκελο.',
        notScanned: 'μη σαρωμένο',
        columns: { folder: 'Φάκελος', size: 'Μέγεθος', items: 'Στοιχεία', files: 'Αρχεία', folders: 'Φάκελοι', modified: 'Τροποποιήθηκε' }
      },
      extensionPanel: {
        header: 'Κατά τύπο αρχείου',
        typeCount: (n) => `${n} τύποι`,
        noType: 'χωρίς τύπο',
        footer: (bytes, count) => `${bytes} σε ${count} αρχεία`,
        unopenedFolders: (bytes) => ` · ${bytes} σε φακέλους που δεν άνοιξε η σάρωση`
      },
      largestFiles: { empty: 'Η σάρωση δεν βρήκε αρχεία για εμφάνιση.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} δεν έχει μετρηθεί`,
        aggregated: 'Οι μικρότερες καταχωρίσεις σε αυτόν τον φάκελο, ομαδοποιημένες.',
        unscanned: 'Η σάρωση σταμάτησε πριν φτάσει εδώ. Το πραγματικό μέγεθος είναι άγνωστο.'
      },
      cellOpenLabel: (name) => `Άνοιγμα ${name}`,
      contextMenu: {
        openInExplorer: 'Άνοιγμα στην Εξερεύνηση αρχείων',
        copyPath: 'Αντιγραφή διαδρομής',
        moveToQuarantineMenu: 'Μετακίνηση σε καραντίνα…'
      },
      toasts: {
        moved: (name) => `Μετακινήθηκε σε καραντίνα: ${name}`,
        restoreHint: 'Επαναφέρετέ το από την οθόνη Καραντίνα.',
        pathCopied: 'Η διαδρομή αντιγράφηκε.',
        copyFailed: 'Αδυναμία αντιγραφής αυτής της διαδρομής.',
        moveFailed: 'Αυτό δεν μπόρεσε να μετακινηθεί.'
      },
      removeModal: {
        label: 'Μετακίνηση σε καραντίνα',
        heading: 'Μετακίνηση αυτού σε καραντίνα;',
        note: 'Μετακινείται, δεν διαγράφεται — επαναφέρετέ το οποιαδήποτε στιγμή από την οθόνη Καραντίνα.',
        folder: 'Φάκελος',
        file: 'Αρχείο',
        cancel: 'Ακύρωση'
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
    },
    diskMap: {
      title: 'Uso del Disco',
      aggregateCell: (count) => `${count} elementos más pequeños`,
      subtitle: 'Qué está usando el espacio en este disco, y dónde.',
      fastIndexSummary: (count) => `${count} archivos y carpetas leídos desde el propio índice del disco.`,
      browsingInstant: 'La navegación es instantánea desde aquí.',
      indexIncomplete: 'No se pudo leer parte del índice, por lo que los totales son un límite inferior.',
      scanningDrive: 'Escaneando el disco…',
      readingDrive: 'Leyendo el disco…',
      rescanButton: 'Reescanear disco (admin)',
      fastScanButton: 'Escaneo rápido (admin)',
      loading: {
        heading: 'Leyendo cada carpeta dentro de',
        note: 'Una carpeta a la vez, que es la única forma de hacerlo sin acceso de administrador. Todo un disco puede tardar un minuto y quizá no termine.',
        indexButton: 'Leer el índice del disco en su lugar (admin)'
      },
      driveRootPrompt: {
        heading: 'Leer todo el disco',
        fastExplain: (path) => `Un escaneo rápido lee el propio índice de archivos del disco — cada archivo en ${path} en unos segundos, tal como lo hace WizTree. Windows solo permite a un programa leer ese índice con acceso de administrador, por lo que esto genera una solicitud de UAC.`,
        crawlExplain: 'La alternativa recorre las carpetas una a una. No necesita ningún permiso y es la herramienta adecuada para una sola carpeta, pero no puede terminar un volumen entero: en este disco alcanzó el 4% de lo que está en uso antes de agotarse el tiempo, y el otro 96% se muestra como no escaneado en lugar de algo útil.',
        crawlButton: 'Recorrer carpetas en su lugar'
      },
      scanFailure: (path, error) => `No se pudo escanear "${path}": ${error}`,
      fastScanDeclined: 'No aprobado — se sigue usando el escaneo carpeta por carpeta.',
      truncated: {
        withCoverage: (measured, used, percent) => `A este escaneo se le agotó el tiempo: midió ${measured} de los ${used} en uso (${percent}%). Lo que midió es real; el resto se muestra como no escaneado, no como vacío.`,
        withoutCoverage: 'A este escaneo se le agotó el tiempo antes de terminar el disco. Todo lo que realmente midió es real, pero las carpetas a las que nunca llegó se muestran como no escaneadas en lugar de vacías — no lo interprete como una imagen completa de lo que usa su espacio.',
        rescanLink: 'Ejecutar un escaneo rápido en su lugar'
      },
      view: { tree: 'Árbol', files: 'Archivos' },
      folderTable: {
        empty: 'Nada que listar dentro de esta carpeta.',
        notScanned: 'no escaneado',
        columns: { folder: 'Carpeta', size: 'Tamaño', items: 'Elementos', files: 'Archivos', folders: 'Carpetas', modified: 'Modificado' }
      },
      extensionPanel: {
        header: 'Por tipo de archivo',
        typeCount: (n) => `${n} tipos`,
        noType: 'sin tipo',
        footer: (bytes, count) => `${bytes} en ${count} archivos`,
        unopenedFolders: (bytes) => ` · ${bytes} en carpetas que el escaneo no abrió`
      },
      largestFiles: { empty: 'El escaneo no encontró archivos para listar.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} sin medir`,
        aggregated: 'Las entradas más pequeñas de esta carpeta, agrupadas.',
        unscanned: 'El escaneo se detuvo antes de llegar aquí. Su tamaño real es desconocido.'
      },
      cellOpenLabel: (name) => `Abrir ${name}`,
      contextMenu: {
        openInExplorer: 'Abrir en el Explorador',
        copyPath: 'Copiar ruta',
        moveToQuarantineMenu: 'Mover a cuarentena…'
      },
      toasts: {
        moved: (name) => `Movido a cuarentena: ${name}`,
        restoreHint: 'Restáurelo desde la pantalla Cuarentena.',
        pathCopied: 'Ruta copiada.',
        copyFailed: 'No se pudo copiar esa ruta.',
        moveFailed: 'Esto no se pudo mover.'
      },
      removeModal: {
        label: 'Mover a cuarentena',
        heading: '¿Mover esto a cuarentena?',
        note: 'Se mueve, no se elimina — restáurelo en cualquier momento desde la pantalla Cuarentena.',
        folder: 'Carpeta',
        file: 'Archivo',
        cancel: 'Cancelar'
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
    },
    diskMap: {
      title: 'Kettakasutus',
      aggregateCell: (count) => `${count} väiksemat üksust`,
      subtitle: 'Mis kasutab ruumi sellel kettal ja kus.',
      fastIndexSummary: (count) => `${count} faili ja kausta loetud ketta enda registrist.`,
      browsingInstant: 'Sirvimine on siit alates hetkeline.',
      indexIncomplete: 'Osa registrist ei õnnestunud lugeda, seega on kogusummad alammäär.',
      scanningDrive: 'Ketta skannimine…',
      readingDrive: 'Ketta lugemine…',
      rescanButton: 'Skanni ketas uuesti (admin)',
      fastScanButton: 'Kiirskann (admin)',
      loading: {
        heading: 'Iga kausta lugemine asukohas',
        note: 'Üks kaust korraga, mis on ainus viis seda teha ilma administraatoriõigusteta. Terve ketas võib võtta minuti ja ei pruugi lõpuni jõuda.',
        indexButton: 'Loe selle asemel ketta registrit (admin)'
      },
      driveRootPrompt: {
        heading: 'Loe kogu ketas',
        fastExplain: (path) => `Kiirskann loeb ketta enda failiregistrit — iga faili asukohas ${path} mõne sekundiga, samamoodi nagu seda teeb WizTree. Windows lubab programmil seda registrit lugeda ainult administraatoriõigustega, seega kuvatakse UAC-taotlus.`,
        crawlExplain: 'Alternatiiv käib kaustadest läbi ühekaupa. See ei vaja luba ja sobib ühe kausta jaoks, kuid ei suuda lõpetada tervet köidet: sellel kettal jõudis see 4%-ni kasutusel olevast enne aja lõppemist ja ülejäänud 96% kuvatakse skannimata, mitte millegi kasulikuna.',
        crawlButton: 'Käi selle asemel kaustadest läbi'
      },
      scanFailure: (path, error) => `„${path}" skannimine ebaõnnestus: ${error}`,
      fastScanDeclined: 'Ei kinnitatud — kasutatakse jätkuvalt kausta-kaustalt skannimist.',
      truncated: {
        withCoverage: (measured, used, percent) => `Sellel skannimisel sai aeg otsa: see mõõtis ${measured} kasutusel olevast ${used} (${percent}%). Mõõdetu on tõeline; ülejäänu kuvatakse skannimata, mitte tühjana.`,
        withoutCoverage: 'Sellel skannimisel sai aeg otsa enne ketta lõpetamist. Kõik, mida see tegelikult mõõtis, on tõeline, kuid kaustad, milleni ei jõutud, kuvatakse skannimata, mitte tühjana — ärge lugege seda täielikuks pildiks sellest, mis teie ruumi kasutab.',
        rescanLink: 'Käivita selle asemel kiirskann'
      },
      view: { tree: 'Puu', files: 'Failid' },
      folderTable: {
        empty: 'Selles kaustas pole midagi loetleda.',
        notScanned: 'skannimata',
        columns: { folder: 'Kaust', size: 'Suurus', items: 'Üksused', files: 'Failid', folders: 'Kaustad', modified: 'Muudetud' }
      },
      extensionPanel: {
        header: 'Failitüübi järgi',
        typeCount: (n) => `${n} tüüpi`,
        noType: 'tüüp puudub',
        footer: (bytes, count) => `${bytes} ${count} faili peale`,
        unopenedFolders: (bytes) => ` · ${bytes} kaustades, mida skannimine ei avanud`
      },
      largestFiles: { empty: 'Skannimine ei leidnud loetlemiseks ühtegi faili.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} mõõtmata`,
        aggregated: 'Selle kausta väikseimad kirjed, kokku rühmitatud.',
        unscanned: 'Skannimine peatus enne siia jõudmist. Tegelik suurus on teadmata.'
      },
      cellOpenLabel: (name) => `Ava ${name}`,
      contextMenu: {
        openInExplorer: 'Ava failihalduris',
        copyPath: 'Kopeeri asukoht',
        moveToQuarantineMenu: 'Teisalda karantiini…'
      },
      toasts: {
        moved: (name) => `Teisaldatud karantiini: ${name}`,
        restoreHint: 'Taasta see Karantiini ekraanilt.',
        pathCopied: 'Asukoht kopeeritud.',
        copyFailed: 'Selle asukoha kopeerimine ebaõnnestus.',
        moveFailed: 'Seda ei õnnestunud teisaldada.'
      },
      removeModal: {
        label: 'Teisalda karantiini',
        heading: 'Teisaldada see karantiini?',
        note: 'See teisaldatakse, mitte ei kustutata — taastage see igal ajal Karantiini ekraanilt.',
        folder: 'Kaust',
        file: 'Fail',
        cancel: 'Tühista'
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
    },
    diskMap: {
      title: 'Levyn käyttö',
      aggregateCell: (count) => `${count} pienempää kohdetta`,
      subtitle: 'Mikä käyttää tilaa tällä levyllä, ja missä.',
      fastIndexSummary: (count) => `${count} tiedostoa ja kansiota luettu levyn omasta hakemistosta.`,
      browsingInstant: 'Selaaminen on välitöntä täältä alkaen.',
      indexIncomplete: 'Osaa hakemistosta ei voitu lukea, joten summat ovat alaraja.',
      scanningDrive: 'Skannataan levyä…',
      readingDrive: 'Luetaan levyä…',
      rescanButton: 'Skannaa levy uudelleen (valvoja)',
      fastScanButton: 'Pikaskannaus (valvoja)',
      loading: {
        heading: 'Luetaan jokaista kansiota kohteessa',
        note: 'Yksi hakemisto kerrallaan, mikä on ainoa tapa tehdä se ilman järjestelmänvalvojan oikeuksia. Koko levy voi kestää minuutin eikä välttämättä valmistu.',
        indexButton: 'Lue sen sijaan levyn hakemisto (valvoja)'
      },
      driveRootPrompt: {
        heading: 'Lue koko levy',
        fastExplain: (path) => `Pikaskannaus lukee levyn oman tiedostohakemiston — jokaisen tiedoston kohteessa ${path} muutamassa sekunnissa, aivan kuten WizTree tekee. Windows sallii ohjelman lukea tämän hakemiston vain järjestelmänvalvojan oikeuksilla, joten tämä käynnistää UAC-kehotteen.`,
        crawlExplain: 'Vaihtoehto käy kansiot läpi yksitellen. Se ei vaadi mitään oikeuksia ja on oikea työkalu yhdelle kansiolle, mutta se ei pysty saattamaan koko taltiota loppuun: tällä levyllä se saavutti 4 % käytössä olevasta ennen ajan loppumista, ja loput 96 % näkyy skannaamattomana eikä minään hyödyllisenä.',
        crawlButton: 'Käy sen sijaan kansiot läpi'
      },
      scanFailure: (path, error) => `Kohteen "${path}" skannaus epäonnistui: ${error}`,
      fastScanDeclined: 'Ei hyväksytty — käytetään edelleen kansio kerrallaan -skannausta.',
      truncated: {
        withCoverage: (measured, used, percent) => `Tältä skannaukselta loppui aika: se mittasi ${measured} käytössä olevasta ${used} (${percent} %). Se, minkä se mittasi, on todellista; loput näkyy skannaamattomana, ei tyhjänä.`,
        withoutCoverage: 'Tältä skannaukselta loppui aika ennen levyn valmistumista. Kaikki, minkä se todella mittasi, on todellista, mutta kansiot, joihin se ei koskaan päässyt, näkyvät skannaamattomina eikä tyhjinä — älä lue tätä täydelliseksi kuvaksi siitä, mikä käyttää tilaasi.',
        rescanLink: 'Suorita sen sijaan pikaskannaus'
      },
      view: { tree: 'Puu', files: 'Tiedostot' },
      folderTable: {
        empty: 'Tässä kansiossa ei ole mitään lueteltavaa.',
        notScanned: 'ei skannattu',
        columns: { folder: 'Kansio', size: 'Koko', items: 'Kohteet', files: 'Tiedostot', folders: 'Kansiot', modified: 'Muokattu' }
      },
      extensionPanel: {
        header: 'Tiedostotyypin mukaan',
        typeCount: (n) => `${n} tyyppiä`,
        noType: 'ei tyyppiä',
        footer: (bytes, count) => `${bytes} ${count} tiedostossa`,
        unopenedFolders: (bytes) => ` · ${bytes} kansioissa, joita skannaus ei avannut`
      },
      largestFiles: { empty: 'Skannaus ei löytänyt lueteltavia tiedostoja.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} ei mitattu`,
        aggregated: 'Tämän kansion pienimmät kohteet, ryhmiteltynä yhteen.',
        unscanned: 'Skannaus pysähtyi ennen tähän pääsyä. Todellinen koko on tuntematon.'
      },
      cellOpenLabel: (name) => `Avaa ${name}`,
      contextMenu: {
        openInExplorer: 'Avaa Resurssienhallinnassa',
        copyPath: 'Kopioi polku',
        moveToQuarantineMenu: 'Siirrä karanteeniin…'
      },
      toasts: {
        moved: (name) => `Siirretty karanteeniin: ${name}`,
        restoreHint: 'Palauta se Karanteeni-näytöltä.',
        pathCopied: 'Polku kopioitu.',
        copyFailed: 'Tätä polkua ei voitu kopioida.',
        moveFailed: 'Tätä ei voitu siirtää.'
      },
      removeModal: {
        label: 'Siirrä karanteeniin',
        heading: 'Siirretäänkö tämä karanteeniin?',
        note: 'Se siirretään, ei poisteta — palauta se milloin tahansa Karanteeni-näytöltä.',
        folder: 'Kansio',
        file: 'Tiedosto',
        cancel: 'Peruuta'
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
    },
    diskMap: {
      title: 'Utilisation du disque',
      aggregateCell: (count) => `${count} éléments plus petits`,
      subtitle: "Ce qui utilise l'espace sur ce disque, et où.",
      fastIndexSummary: (count) => `${count} fichiers et dossiers lus depuis l'index propre du disque.`,
      browsingInstant: "La navigation est instantanée à partir d'ici.",
      indexIncomplete: "Une partie de l'index n'a pas pu être lue, donc les totaux sont un minimum.",
      scanningDrive: 'Analyse du disque…',
      readingDrive: 'Lecture du disque…',
      rescanButton: 'Réanalyser le disque (admin)',
      fastScanButton: 'Analyse rapide (admin)',
      loading: {
        heading: 'Lecture de chaque dossier sous',
        note: "Un répertoire à la fois, ce qui est la seule façon de le faire sans accès administrateur. Un disque entier peut prendre une minute et pourrait ne pas se terminer.",
        indexButton: "Lire plutôt l'index du disque (admin)"
      },
      driveRootPrompt: {
        heading: 'Lire tout le disque',
        fastExplain: (path) => `Une analyse rapide lit l'index de fichiers propre du disque — chaque fichier sur ${path} en quelques secondes, comme le fait WizTree. Windows ne laisse un programme lire cet index qu'avec un accès administrateur, ce qui déclenche une invite UAC.`,
        crawlExplain: "L'alternative parcourt les dossiers un par un. Elle ne nécessite aucune permission et est l'outil adapté à un seul dossier, mais elle ne peut pas terminer un volume entier : sur ce disque, elle a atteint 4 % de ce qui est utilisé avant que le temps ne s'épuise, et les 96 % restants s'affichent comme non analysés plutôt que comme quelque chose d'utile.",
        crawlButton: 'Parcourir les dossiers à la place'
      },
      scanFailure: (path, error) => `Impossible d'analyser « ${path} » : ${error}`,
      fastScanDeclined: "Non approuvé — utilise toujours l'analyse dossier par dossier.",
      truncated: {
        withCoverage: (measured, used, percent) => `Cette analyse a manqué de temps : elle a mesuré ${measured} sur les ${used} utilisés (${percent} %). Ce qu'elle a mesuré est réel ; le reste s'affiche comme non analysé, pas comme vide.`,
        withoutCoverage: "Cette analyse a manqué de temps avant de terminer le disque. Tout ce qu'elle a réellement mesuré est réel, mais les dossiers qu'elle n'a jamais atteints s'affichent comme non analysés plutôt que vides — ne lisez pas ceci comme une image complète de ce qui utilise votre espace.",
        rescanLink: 'Lancer plutôt une analyse rapide'
      },
      view: { tree: 'Arborescence', files: 'Fichiers' },
      folderTable: {
        empty: 'Rien à lister dans ce dossier.',
        notScanned: 'non analysé',
        columns: { folder: 'Dossier', size: 'Taille', items: 'Éléments', files: 'Fichiers', folders: 'Dossiers', modified: 'Modifié' }
      },
      extensionPanel: {
        header: 'Par type de fichier',
        typeCount: (n) => `${n} types`,
        noType: 'sans type',
        footer: (bytes, count) => `${bytes} sur ${count} fichiers`,
        unopenedFolders: (bytes) => ` · ${bytes} dans des dossiers que l'analyse n'a pas ouverts`
      },
      largestFiles: { empty: "L'analyse n'a trouvé aucun fichier à lister." },
      tooltip: {
        notMeasured: (bytes) => `${bytes} non mesuré`,
        aggregated: 'Les plus petites entrées de ce dossier, regroupées.',
        unscanned: "L'analyse s'est arrêtée avant d'atteindre ceci. Sa taille réelle est inconnue."
      },
      cellOpenLabel: (name) => `Ouvrir ${name}`,
      contextMenu: {
        openInExplorer: "Ouvrir dans l'Explorateur",
        copyPath: 'Copier le chemin',
        moveToQuarantineMenu: 'Déplacer vers la quarantaine…'
      },
      toasts: {
        moved: (name) => `Déplacé vers la quarantaine : ${name}`,
        restoreHint: "Restaurez-le depuis l'écran Quarantaine.",
        pathCopied: 'Chemin copié.',
        copyFailed: "Ce chemin n'a pas pu être copié.",
        moveFailed: "Ceci n'a pas pu être déplacé."
      },
      removeModal: {
        label: 'Déplacer vers la quarantaine',
        heading: 'Déplacer ceci vers la quarantaine ?',
        note: "Il est déplacé, pas supprimé — restaurez-le à tout moment depuis l'écran Quarantaine.",
        folder: 'Dossier',
        file: 'Fichier',
        cancel: 'Annuler'
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
    },
    diskMap: {
      title: 'שימוש בדיסק',
      aggregateCell: (count) => `${count} פריטים קטנים יותר`,
      subtitle: 'מה משתמש במקום בדיסק הזה, והיכן.',
      fastIndexSummary: (count) => `${count} קבצים ותיקיות נקראו מהאינדקס של הדיסק עצמו.`,
      browsingInstant: 'הדפדוף מיידי מכאן.',
      indexIncomplete: 'לא ניתן היה לקרוא חלק מהאינדקס, לכן הסכומים הם גבול תחתון.',
      scanningDrive: 'סורק את הדיסק…',
      readingDrive: 'קורא את הדיסק…',
      rescanButton: 'סרוק את הדיסק שוב (מנהל)',
      fastScanButton: 'סריקה מהירה (מנהל)',
      loading: {
        heading: 'קורא כל תיקייה תחת',
        note: 'תיקייה אחת בכל פעם, וזו הדרך היחידה לעשות זאת ללא הרשאות מנהל. כל הדיסק עשוי לקחת דקה וייתכן שלא יסתיים.',
        indexButton: 'קרא במקום זאת את אינדקס הדיסק (מנהל)'
      },
      driveRootPrompt: {
        heading: 'קרא את כל הדיסק',
        fastExplain: (path) => `סריקה מהירה קוראת את אינדקס הקבצים של הדיסק עצמו — כל קובץ ב-${path} תוך שניות ספורות, בדיוק כפי ש-WizTree עושה זאת. Windows מאפשר לתוכנית לקרוא את האינדקס הזה רק עם הרשאות מנהל, ולכן זה מציג בקשת UAC.`,
        crawlExplain: 'החלופה עוברת בין תיקיות אחת אחרי השנייה. היא אינה דורשת הרשאה כלשהי והיא הכלי הנכון לתיקייה בודדת, אך אינה יכולה לסיים כרך שלם: בדיסק הזה היא הגיעה ל-4% מהמשמש לפני שנגמר הזמן, ו-96% הנותרים מוצגים כלא נסרקו במקום כמשהו שימושי.',
        crawlButton: 'עבור בין תיקיות במקום זאת'
      },
      scanFailure: (path, error) => `לא ניתן היה לסרוק את "${path}": ${error}`,
      fastScanDeclined: 'לא אושר — עדיין נעשה שימוש בסריקה תיקייה אחר תיקייה.',
      truncated: {
        withCoverage: (measured, used, percent) => `לסריקה זו נגמר הזמן: היא מדדה ${measured} מתוך ${used} בשימוש (${percent}%). מה שנמדד הוא אמיתי; השאר מוצג כלא נסרק, לא כריק.`,
        withoutCoverage: 'לסריקה זו נגמר הזמן לפני שסיימה את הדיסק. כל מה שנמדד בפועל הוא אמיתי, אך תיקיות שלא הגיעה אליהן מוצגות כלא נסרקות ולא כריקות — אל תקרא זאת כתמונה מלאה של מה שמשתמש במקום שלך.',
        rescanLink: 'הרץ במקום זאת סריקה מהירה'
      },
      view: { tree: 'עץ', files: 'קבצים' },
      folderTable: {
        empty: 'אין מה לרשום בתוך תיקייה זו.',
        notScanned: 'לא נסרק',
        columns: { folder: 'תיקייה', size: 'גודל', items: 'פריטים', files: 'קבצים', folders: 'תיקיות', modified: 'שונה' }
      },
      extensionPanel: {
        header: 'לפי סוג קובץ',
        typeCount: (n) => `${n} סוגים`,
        noType: 'ללא סוג',
        footer: (bytes, count) => `${bytes} על פני ${count} קבצים`,
        unopenedFolders: (bytes) => ` · ${bytes} בתיקיות שהסריקה לא פתחה`
      },
      largestFiles: { empty: 'הסריקה לא מצאה קבצים לרישום.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} לא נמדד`,
        aggregated: 'הרשומות הקטנות ביותר בתיקייה זו, מקובצות יחד.',
        unscanned: 'הסריקה נעצרה לפני שהגיעה לכאן. הגודל האמיתי אינו ידוע.'
      },
      cellOpenLabel: (name) => `פתח ${name}`,
      contextMenu: {
        openInExplorer: 'פתח בסייר הקבצים',
        copyPath: 'העתק נתיב',
        moveToQuarantineMenu: 'העבר להסגר…'
      },
      toasts: {
        moved: (name) => `הועבר להסגר: ${name}`,
        restoreHint: 'שחזר אותו ממסך ההסגר.',
        pathCopied: 'הנתיב הועתק.',
        copyFailed: 'לא ניתן היה להעתיק את הנתיב הזה.',
        moveFailed: 'לא ניתן היה להעביר את זה.'
      },
      removeModal: {
        label: 'העבר להסגר',
        heading: 'להעביר את זה להסגר?',
        note: 'הוא מועבר, לא נמחק — שחזר אותו בכל עת ממסך ההסגר.',
        folder: 'תיקייה',
        file: 'קובץ',
        cancel: 'ביטול'
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
    },
    diskMap: {
      title: 'Lemezhasználat',
      aggregateCell: (count) => `${count} kisebb elem`,
      subtitle: 'Mi használja a helyet ezen a lemezen, és hol.',
      fastIndexSummary: (count) => `${count} fájl és mappa beolvasva a lemez saját indexéből.`,
      browsingInstant: 'A böngészés innentől azonnali.',
      indexIncomplete: 'Az index egy részét nem sikerült beolvasni, ezért az összegek alsó becslést jelentenek.',
      scanningDrive: 'Lemez vizsgálata…',
      readingDrive: 'Lemez olvasása…',
      rescanButton: 'Lemez újravizsgálata (admin)',
      fastScanButton: 'Gyors vizsgálat (admin)',
      loading: {
        heading: 'Minden mappa olvasása itt:',
        note: 'Egyszerre egy könyvtár, ami az egyetlen módja annak, hogy rendszergazdai hozzáférés nélkül végezze el ezt. Egy teljes lemez akár egy percig is eltarthat, és lehet, hogy nem fejeződik be.',
        indexButton: 'Inkább a lemezindex olvasása (admin)'
      },
      driveRootPrompt: {
        heading: 'Az egész lemez olvasása',
        fastExplain: (path) => `A gyors vizsgálat a lemez saját fájlindexét olvassa — minden fájlt a(z) ${path} helyen néhány másodperc alatt, pontosan úgy, ahogy a WizTree teszi. A Windows csak rendszergazdai hozzáféréssel engedi egy programnak az index olvasását, ezért ez UAC-kérést jelenít meg.`,
        crawlExplain: 'Az alternatíva egyenként járja végig a mappákat. Nem igényel semmilyen jogosultságot, és a megfelelő eszköz egyetlen mappához, de nem tud befejezni egy teljes kötetet: ezen a lemezen a használt hely 4%-át érte el, mielőtt lejárt az idő, a fennmaradó 96% pedig nem vizsgáltként jelenik meg, nem pedig valami hasznosként.',
        crawlButton: 'Inkább a mappák bejárása'
      },
      scanFailure: (path, error) => `Nem sikerült megvizsgálni: „${path}”: ${error}`,
      fastScanDeclined: 'Nincs jóváhagyva — továbbra is a mappánkénti vizsgálatot használja.',
      truncated: {
        withCoverage: (measured, used, percent) => `Ennek a vizsgálatnak lejárt az ideje: ${measured} adatot mért a használt ${used} adatból (${percent}%). Amit mért, az valós; a többi nem vizsgáltként jelenik meg, nem üresként.`,
        withoutCoverage: 'Ennek a vizsgálatnak lejárt az ideje, mielőtt befejezte volna a lemezt. Minden, amit ténylegesen mért, valós, de azok a mappák, amelyeket sosem ért el, nem vizsgáltként jelennek meg, nem üresként — ezt ne tekintse a helyét használó dolgok teljes képének.',
        rescanLink: 'Inkább gyors vizsgálat futtatása'
      },
      view: { tree: 'Fa', files: 'Fájlok' },
      folderTable: {
        empty: 'Nincs mit listázni ebben a mappában.',
        notScanned: 'nincs megvizsgálva',
        columns: { folder: 'Mappa', size: 'Méret', items: 'Elemek', files: 'Fájlok', folders: 'Mappák', modified: 'Módosítva' }
      },
      extensionPanel: {
        header: 'Fájltípus szerint',
        typeCount: (n) => `${n} típus`,
        noType: 'nincs típus',
        footer: (bytes, count) => `${bytes} ${count} fájlban`,
        unopenedFolders: (bytes) => ` · ${bytes} olyan mappákban, amelyeket a vizsgálat nem nyitott meg`
      },
      largestFiles: { empty: 'A vizsgálat nem talált listázandó fájlokat.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} nincs megmérve`,
        aggregated: 'Ennek a mappának a legkisebb bejegyzései, csoportosítva.',
        unscanned: 'A vizsgálat leállt, mielőtt ideért volna. A valós mérete ismeretlen.'
      },
      cellOpenLabel: (name) => `${name} megnyitása`,
      contextMenu: {
        openInExplorer: 'Megnyitás a Intézőben',
        copyPath: 'Elérési út másolása',
        moveToQuarantineMenu: 'Áthelyezés karanténba…'
      },
      toasts: {
        moved: (name) => `Karanténba helyezve: ${name}`,
        restoreHint: 'Állítsa vissza a Karantén képernyőről.',
        pathCopied: 'Elérési út másolva.',
        copyFailed: 'Ezt az elérési utat nem sikerült másolni.',
        moveFailed: 'Ezt nem sikerült áthelyezni.'
      },
      removeModal: {
        label: 'Áthelyezés karanténba',
        heading: 'Áthelyezi ezt karanténba?',
        note: 'Áthelyezésre kerül, nem törlődik — bármikor visszaállítható a Karantén képernyőről.',
        folder: 'Mappa',
        file: 'Fájl',
        cancel: 'Mégse'
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
    },
    diskMap: {
      title: 'Penggunaan Disk',
      aggregateCell: (count) => `${count} item yang lebih kecil`,
      subtitle: 'Apa yang menggunakan ruang di disk ini, dan di mana.',
      fastIndexSummary: (count) => `${count} file dan folder dibaca dari indeks disk itu sendiri.`,
      browsingInstant: 'Penjelajahan langsung dari sini.',
      indexIncomplete: 'Sebagian indeks tidak dapat dibaca, jadi total adalah batas bawah.',
      scanningDrive: 'Memindai disk…',
      readingDrive: 'Membaca disk…',
      rescanButton: 'Pindai ulang disk (admin)',
      fastScanButton: 'Pemindaian cepat (admin)',
      loading: {
        heading: 'Membaca setiap folder di bawah',
        note: 'Satu direktori pada satu waktu, yang merupakan satu-satunya cara melakukannya tanpa akses administrator. Seluruh disk bisa memakan waktu satu menit dan mungkin tidak selesai.',
        indexButton: 'Baca indeks disk sebagai gantinya (admin)'
      },
      driveRootPrompt: {
        heading: 'Baca seluruh disk',
        fastExplain: (path) => `Pemindaian cepat membaca indeks file milik disk itu sendiri — setiap file di ${path} dalam hitungan detik, sama seperti yang dilakukan WizTree. Windows hanya mengizinkan program membaca indeks itu dengan akses administrator, sehingga ini memicu permintaan UAC.`,
        crawlExplain: 'Alternatifnya menelusuri folder satu per satu. Ini tidak memerlukan izin apa pun dan merupakan alat yang tepat untuk satu folder, tetapi tidak dapat menyelesaikan seluruh volume: pada disk ini prosesnya mencapai 4% dari yang digunakan sebelum waktu habis, dan 96% sisanya ditampilkan sebagai belum dipindai, bukan sebagai sesuatu yang berguna.',
        crawlButton: 'Telusuri folder sebagai gantinya'
      },
      scanFailure: (path, error) => `Gagal memindai "${path}": ${error}`,
      fastScanDeclined: 'Tidak disetujui — masih menggunakan pemindaian folder demi folder.',
      truncated: {
        withCoverage: (measured, used, percent) => `Pemindaian ini kehabisan waktu: mengukur ${measured} dari ${used} yang digunakan (${percent}%). Apa yang diukur adalah nyata; sisanya ditampilkan sebagai belum dipindai, bukan sebagai kosong.`,
        withoutCoverage: 'Pemindaian ini kehabisan waktu sebelum menyelesaikan disk. Semua yang benar-benar diukur adalah nyata, tetapi folder yang tidak pernah dijangkau ditampilkan sebagai belum dipindai, bukan kosong — jangan anggap ini sebagai gambaran lengkap tentang apa yang menggunakan ruang Anda.',
        rescanLink: 'Jalankan pemindaian cepat sebagai gantinya'
      },
      view: { tree: 'Pohon', files: 'File' },
      folderTable: {
        empty: 'Tidak ada yang bisa ditampilkan di dalam folder ini.',
        notScanned: 'belum dipindai',
        columns: { folder: 'Folder', size: 'Ukuran', items: 'Item', files: 'File', folders: 'Folder', modified: 'Diubah' }
      },
      extensionPanel: {
        header: 'Berdasarkan jenis file',
        typeCount: (n) => `${n} jenis`,
        noType: 'tanpa jenis',
        footer: (bytes, count) => `${bytes} pada ${count} file`,
        unopenedFolders: (bytes) => ` · ${bytes} dalam folder yang tidak dibuka pemindaian`
      },
      largestFiles: { empty: 'Pemindaian tidak menemukan file untuk ditampilkan.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} belum diukur`,
        aggregated: 'Entri terkecil di folder ini, dikelompokkan bersama.',
        unscanned: 'Pemindaian berhenti sebelum mencapai ini. Ukuran sebenarnya tidak diketahui.'
      },
      cellOpenLabel: (name) => `Buka ${name}`,
      contextMenu: {
        openInExplorer: 'Buka di Explorer',
        copyPath: 'Salin jalur',
        moveToQuarantineMenu: 'Pindahkan ke karantina…'
      },
      toasts: {
        moved: (name) => `Dipindahkan ke karantina: ${name}`,
        restoreHint: 'Pulihkan dari layar Karantina.',
        pathCopied: 'Jalur disalin.',
        copyFailed: 'Jalur itu tidak dapat disalin.',
        moveFailed: 'Ini tidak dapat dipindahkan.'
      },
      removeModal: {
        label: 'Pindahkan ke karantina',
        heading: 'Pindahkan ini ke karantina?',
        note: 'Ini dipindahkan, bukan dihapus — pulihkan kapan saja dari layar Karantina.',
        folder: 'Folder',
        file: 'File',
        cancel: 'Batal'
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
    },
    diskMap: {
      title: 'Diskanotkun',
      aggregateCell: (count) => `${count} minni atriði`,
      subtitle: 'Hvað notar plássið á þessum diski, og hvar.',
      fastIndexSummary: (count) => `${count} skrár og möppur lesnar úr eigin skrá disksins.`,
      browsingInstant: 'Skoðun er samstundis héðan.',
      indexIncomplete: 'Ekki tókst að lesa hluta skrárinnar, svo heildartölur eru lágmark.',
      scanningDrive: 'Skannar disk…',
      readingDrive: 'Les diskinn…',
      rescanButton: 'Endurskanna disk (kerfisstjóri)',
      fastScanButton: 'Hraðskönnun (kerfisstjóri)',
      loading: {
        heading: 'Les hverja möppu undir',
        note: 'Ein mappa í einu, sem er eina leiðin til að gera þetta án kerfisstjóraaðgangs. Heill diskur getur tekið mínútu og gæti ekki lokið.',
        indexButton: 'Lesa frekar skrá disksins (kerfisstjóri)'
      },
      driveRootPrompt: {
        heading: 'Lesa allan diskinn',
        fastExplain: (path) => `Hraðskönnun les eigin skráaskrá disksins — hverja skrá á ${path} á fáeinum sekúndum, nákvæmlega eins og WizTree gerir. Windows leyfir forriti aðeins að lesa þá skrá með kerfisstjóraaðgangi, svo þetta veldur UAC-beiðni.`,
        crawlExplain: 'Valkosturinn fer í gegnum möppur eina í einu. Hann krefst engrar heimildar og er rétta tólið fyrir eina möppu, en getur ekki lokið heilu bindi: á þessum diski náði hann 4% af því sem er í notkun áður en tíminn rann út, og hin 96% birtast sem óskönnuð frekar en eitthvað gagnlegt.',
        crawlButton: 'Fara frekar í gegnum möppur'
      },
      scanFailure: (path, error) => `Ekki tókst að skanna „${path}“: ${error}`,
      fastScanDeclined: 'Ekki samþykkt — notar enn möppu-fyrir-möppu skönnun.',
      truncated: {
        withCoverage: (measured, used, percent) => `Þessi skönnun kláraði tímann: hún mældi ${measured} af ${used} í notkun (${percent}%). Það sem hún mældi er raunverulegt; afgangurinn birtist sem óskannaður, ekki tómur.`,
        withoutCoverage: 'Þessi skönnun kláraði tímann áður en hún lauk við diskinn. Allt sem hún raunverulega mældi er raunverulegt, en möppur sem hún náði aldrei til birtast sem óskannaðar frekar en tómar — ekki lesa þetta sem heildarmynd af því sem notar plássið þitt.',
        rescanLink: 'Keyra frekar hraðskönnun'
      },
      view: { tree: 'Tré', files: 'Skrár' },
      folderTable: {
        empty: 'Ekkert til að telja upp í þessari möppu.',
        notScanned: 'óskannað',
        columns: { folder: 'Mappa', size: 'Stærð', items: 'Hlutir', files: 'Skrár', folders: 'Möppur', modified: 'Breytt' }
      },
      extensionPanel: {
        header: 'Eftir skráartegund',
        typeCount: (n) => `${n} tegundir`,
        noType: 'engin tegund',
        footer: (bytes, count) => `${bytes} á ${count} skrár`,
        unopenedFolders: (bytes) => ` · ${bytes} í möppum sem skönnunin opnaði ekki`
      },
      largestFiles: { empty: 'Skönnunin fann engar skrár til að telja upp.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} ekki mælt`,
        aggregated: 'Minnstu færslurnar í þessari möppu, flokkaðar saman.',
        unscanned: 'Skönnunin stöðvaðist áður en hún náði hingað. Raunveruleg stærð er óþekkt.'
      },
      cellOpenLabel: (name) => `Opna ${name}`,
      contextMenu: {
        openInExplorer: 'Opna í Skráasafni',
        copyPath: 'Afrita slóð',
        moveToQuarantineMenu: 'Færa í sóttkví…'
      },
      toasts: {
        moved: (name) => `Fært í sóttkví: ${name}`,
        restoreHint: 'Endurheimtu það af Sóttkví-skjánum.',
        pathCopied: 'Slóð afrituð.',
        copyFailed: 'Ekki tókst að afrita þá slóð.',
        moveFailed: 'Ekki tókst að færa þetta.'
      },
      removeModal: {
        label: 'Færa í sóttkví',
        heading: 'Færa þetta í sóttkví?',
        note: 'Það er fært, ekki eytt — endurheimtu það hvenær sem er af Sóttkví-skjánum.',
        folder: 'Mappa',
        file: 'Skrá',
        cancel: 'Hætta við'
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
    },
    diskMap: {
      title: 'Utilizzo del Disco',
      aggregateCell: (count) => `${count} elementi più piccoli`,
      subtitle: 'Cosa sta usando lo spazio su questo disco, e dove.',
      fastIndexSummary: (count) => `${count} file e cartelle letti dall'indice del disco stesso.`,
      browsingInstant: 'La navigazione è istantanea da qui.',
      indexIncomplete: "Non è stato possibile leggere parte dell'indice, quindi i totali sono un limite inferiore.",
      scanningDrive: 'Scansione del disco…',
      readingDrive: 'Lettura del disco…',
      rescanButton: 'Riesegui scansione disco (admin)',
      fastScanButton: 'Scansione rapida (admin)',
      loading: {
        heading: 'Lettura di ogni cartella sotto',
        note: "Una directory alla volta, che è l'unico modo per farlo senza accesso come amministratore. Un intero disco può richiedere un minuto e potrebbe non terminare.",
        indexButton: "Leggi invece l'indice del disco (admin)"
      },
      driveRootPrompt: {
        heading: "Leggi l'intero disco",
        fastExplain: (path) => `Una scansione rapida legge l'indice dei file proprio del disco — ogni file su ${path} in pochi secondi, proprio come fa WizTree. Windows permette a un programma di leggere quell'indice solo con accesso come amministratore, quindi questo genera una richiesta UAC.`,
        crawlExplain: "L'alternativa attraversa le cartelle una alla volta. Non richiede alcun permesso ed è lo strumento giusto per una singola cartella, ma non può completare un intero volume: su questo disco ha raggiunto il 4% di ciò che è in uso prima che il tempo scadesse, e l'altro 96% viene mostrato come non scansionato piuttosto che come qualcosa di utile.",
        crawlButton: 'Attraversa invece le cartelle'
      },
      scanFailure: (path, error) => `Impossibile scansionare "${path}": ${error}`,
      fastScanDeclined: 'Non approvato — continua a usare la scansione cartella per cartella.',
      truncated: {
        withCoverage: (measured, used, percent) => `Questa scansione ha esaurito il tempo: ha misurato ${measured} dei ${used} in uso (${percent}%). Ciò che ha misurato è reale; il resto è mostrato come non scansionato, non come vuoto.`,
        withoutCoverage: "Questa scansione ha esaurito il tempo prima di completare il disco. Tutto ciò che ha effettivamente misurato è reale, ma le cartelle mai raggiunte sono mostrate come non scansionate piuttosto che vuote — non leggerlo come un quadro completo di ciò che occupa il tuo spazio.",
        rescanLink: 'Esegui invece una scansione rapida'
      },
      view: { tree: 'Albero', files: 'File' },
      folderTable: {
        empty: 'Niente da elencare in questa cartella.',
        notScanned: 'non scansionato',
        columns: { folder: 'Cartella', size: 'Dimensione', items: 'Elementi', files: 'File', folders: 'Cartelle', modified: 'Modificato' }
      },
      extensionPanel: {
        header: 'Per tipo di file',
        typeCount: (n) => `${n} tipi`,
        noType: 'nessun tipo',
        footer: (bytes, count) => `${bytes} su ${count} file`,
        unopenedFolders: (bytes) => ` · ${bytes} in cartelle che la scansione non ha aperto`
      },
      largestFiles: { empty: 'La scansione non ha trovato file da elencare.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} non misurato`,
        aggregated: 'Le voci più piccole di questa cartella, raggruppate.',
        unscanned: 'La scansione si è fermata prima di raggiungere questo. La sua dimensione reale è sconosciuta.'
      },
      cellOpenLabel: (name) => `Apri ${name}`,
      contextMenu: {
        openInExplorer: 'Apri in Esplora File',
        copyPath: 'Copia percorso',
        moveToQuarantineMenu: 'Sposta in quarantena…'
      },
      toasts: {
        moved: (name) => `Spostato in quarantena: ${name}`,
        restoreHint: 'Ripristinalo dalla schermata Quarantena.',
        pathCopied: 'Percorso copiato.',
        copyFailed: 'Impossibile copiare quel percorso.',
        moveFailed: 'Non è stato possibile spostarlo.'
      },
      removeModal: {
        label: 'Sposta in quarantena',
        heading: 'Spostare questo in quarantena?',
        note: 'Viene spostato, non eliminato — ripristinalo in qualsiasi momento dalla schermata Quarantena.',
        folder: 'Cartella',
        file: 'File',
        cancel: 'Annulla'
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
    },
    diskMap: {
      title: 'ディスク使用状況',
      aggregateCell: (count) => `${count} 件の小さな項目`,
      subtitle: '何がこのディスクの容量を使っているか、どこで。',
      fastIndexSummary: (count) => `ドライブ自身のインデックスから ${count} 件のファイルとフォルダーを読み取りました。`,
      browsingInstant: 'ここからの閲覧は即座に行われます。',
      indexIncomplete: 'インデックスの一部を読み取れなかったため、合計は下限値です。',
      scanningDrive: 'ドライブをスキャンしています…',
      readingDrive: 'ドライブを読み取っています…',
      rescanButton: 'ドライブを再スキャン（管理者）',
      fastScanButton: '高速スキャン（管理者）',
      loading: {
        heading: '以下のすべてのフォルダーを読み取っています',
        note: '一度に1つのディレクトリずつです。これは管理者権限なしで行える唯一の方法です。ドライブ全体では1分ほどかかることがあり、完了しない場合もあります。',
        indexButton: '代わりにドライブのインデックスを読み取る（管理者）'
      },
      driveRootPrompt: {
        heading: 'ドライブ全体を読み取る',
        fastExplain: (path) => `高速スキャンはドライブ自身のファイルインデックスを読み取ります — WizTree と同じ方法で、${path} 上のすべてのファイルを数秒で読み取ります。Windows は管理者権限を持つプログラムにしかそのインデックスの読み取りを許可しないため、UAC の確認が表示されます。`,
        crawlExplain: '代替方法はフォルダーを1つずつたどっていきます。権限は不要で単一のフォルダーには適していますが、ボリューム全体を終えることはできません。このドライブでは、時間切れになるまでに使用領域の4%に到達し、残りの96%は何か有用な情報としてではなく未スキャンとして表示されます。',
        crawlButton: '代わりにフォルダーをたどる'
      },
      scanFailure: (path, error) => `「${path}」をスキャンできませんでした: ${error}`,
      fastScanDeclined: '承認されませんでした — フォルダーごとのスキャンを引き続き使用します。',
      truncated: {
        withCoverage: (measured, used, percent) => `このスキャンは時間切れになりました。使用中の ${used} のうち ${measured} を測定しました（${percent}%）。測定できた部分は正確です。残りは空ではなく未スキャンとして表示されます。`,
        withoutCoverage: 'このスキャンはドライブを完了する前に時間切れになりました。実際に測定できた部分はすべて正確ですが、到達できなかったフォルダーは空ではなく未スキャンとして表示されます — これを容量を使用しているものの完全な情報として読まないでください。',
        rescanLink: '代わりに高速スキャンを実行'
      },
      view: { tree: 'ツリー', files: 'ファイル' },
      folderTable: {
        empty: 'このフォルダー内に表示するものがありません。',
        notScanned: '未スキャン',
        columns: { folder: 'フォルダー', size: 'サイズ', items: '項目', files: 'ファイル', folders: 'フォルダー', modified: '更新日時' }
      },
      extensionPanel: {
        header: 'ファイルの種類別',
        typeCount: (n) => `${n} 種類`,
        noType: '種類なし',
        footer: (bytes, count) => `${count} ファイルで ${bytes}`,
        unopenedFolders: (bytes) => ` · スキャンが開かなかったフォルダー内に ${bytes}`
      },
      largestFiles: { empty: 'スキャンでは表示するファイルが見つかりませんでした。' },
      tooltip: {
        notMeasured: (bytes) => `${bytes}（未測定）`,
        aggregated: 'このフォルダー内の最小の項目をまとめたものです。',
        unscanned: 'ここに到達する前にスキャンが停止しました。実際のサイズは不明です。'
      },
      cellOpenLabel: (name) => `${name} を開く`,
      contextMenu: {
        openInExplorer: 'エクスプローラーで開く',
        copyPath: 'パスをコピー',
        moveToQuarantineMenu: '隔離に移動…'
      },
      toasts: {
        moved: (name) => `隔離に移動しました: ${name}`,
        restoreHint: '隔離画面から復元してください。',
        pathCopied: 'パスをコピーしました。',
        copyFailed: 'そのパスをコピーできませんでした。',
        moveFailed: 'これを移動できませんでした。'
      },
      removeModal: {
        label: '隔離に移動',
        heading: 'これを隔離に移動しますか？',
        note: '削除ではなく移動されます — いつでも隔離画面から復元できます。',
        folder: 'フォルダー',
        file: 'ファイル',
        cancel: 'キャンセル'
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
    },
    diskMap: {
      title: '디스크 사용량',
      aggregateCell: (count) => `${count}개의 더 작은 항목`,
      subtitle: '이 디스크에서 공간을 사용하는 항목과 위치.',
      fastIndexSummary: (count) => `드라이브 자체 색인에서 파일 및 폴더 ${count}개를 읽었습니다.`,
      browsingInstant: '여기서부터의 탐색은 즉시 이루어집니다.',
      indexIncomplete: '색인 일부를 읽을 수 없어 합계는 하한값입니다.',
      scanningDrive: '드라이브 검사 중…',
      readingDrive: '드라이브 읽는 중…',
      rescanButton: '드라이브 다시 검사 (관리자)',
      fastScanButton: '빠른 검사 (관리자)',
      loading: {
        heading: '아래의 모든 폴더 읽는 중',
        note: '한 번에 하나의 디렉터리씩입니다. 이는 관리자 권한 없이 이 작업을 수행하는 유일한 방법입니다. 전체 드라이브는 1분 정도 걸릴 수 있으며 완료되지 않을 수도 있습니다.',
        indexButton: '대신 드라이브 색인 읽기 (관리자)'
      },
      driveRootPrompt: {
        heading: '전체 드라이브 읽기',
        fastExplain: (path) => `빠른 검사는 드라이브 자체 파일 색인을 읽습니다 — WizTree가 하는 방식과 마찬가지로 ${path}의 모든 파일을 몇 초 만에 읽습니다. Windows는 관리자 권한이 있는 프로그램만 해당 색인을 읽을 수 있게 하므로 UAC 요청이 표시됩니다.`,
        crawlExplain: '대안은 폴더를 하나씩 살펴봅니다. 권한이 필요 없으며 단일 폴더에 적합한 도구이지만 전체 볼륨을 완료할 수는 없습니다. 이 드라이브에서는 시간이 다 되기 전에 사용 중인 공간의 4%에 도달했으며, 나머지 96%는 유용한 정보가 아니라 검사되지 않음으로 표시됩니다.',
        crawlButton: '대신 폴더 살펴보기'
      },
      scanFailure: (path, error) => `"${path}"을(를) 검사할 수 없습니다: ${error}`,
      fastScanDeclined: '승인되지 않음 — 여전히 폴더별 검사를 사용합니다.',
      truncated: {
        withCoverage: (measured, used, percent) => `이 검사는 시간이 초과되었습니다: 사용 중인 ${used} 중 ${measured}을(를) 측정했습니다(${percent}%). 측정된 부분은 실제 값이며, 나머지는 비어 있는 것이 아니라 검사되지 않음으로 표시됩니다.`,
        withoutCoverage: '이 검사는 드라이브를 완료하기 전에 시간이 초과되었습니다. 실제로 측정된 모든 것은 정확하지만, 도달하지 못한 폴더는 비어 있는 것이 아니라 검사되지 않음으로 표시됩니다 — 이를 공간을 사용하는 항목의 완전한 그림으로 받아들이지 마세요.',
        rescanLink: '대신 빠른 검사 실행'
      },
      view: { tree: '트리', files: '파일' },
      folderTable: {
        empty: '이 폴더 안에 나열할 항목이 없습니다.',
        notScanned: '검사되지 않음',
        columns: { folder: '폴더', size: '크기', items: '항목', files: '파일', folders: '폴더', modified: '수정됨' }
      },
      extensionPanel: {
        header: '파일 형식별',
        typeCount: (n) => `${n}개 유형`,
        noType: '유형 없음',
        footer: (bytes, count) => `${count}개 파일에 걸쳐 ${bytes}`,
        unopenedFolders: (bytes) => ` · 검사가 열지 않은 폴더에 ${bytes}`
      },
      largestFiles: { empty: '검사에서 나열할 파일을 찾지 못했습니다.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes}(측정되지 않음)`,
        aggregated: '이 폴더의 가장 작은 항목들을 묶은 것입니다.',
        unscanned: '이곳에 도달하기 전에 검사가 중단되었습니다. 실제 크기는 알 수 없습니다.'
      },
      cellOpenLabel: (name) => `${name} 열기`,
      contextMenu: {
        openInExplorer: '탐색기에서 열기',
        copyPath: '경로 복사',
        moveToQuarantineMenu: '격리로 이동…'
      },
      toasts: {
        moved: (name) => `격리로 이동됨: ${name}`,
        restoreHint: '격리 화면에서 복원하세요.',
        pathCopied: '경로가 복사되었습니다.',
        copyFailed: '해당 경로를 복사할 수 없습니다.',
        moveFailed: '이것을 이동할 수 없습니다.'
      },
      removeModal: {
        label: '격리로 이동',
        heading: '이것을 격리로 이동할까요?',
        note: '삭제가 아니라 이동됩니다 — 언제든지 격리 화면에서 복원할 수 있습니다.',
        folder: '폴더',
        file: '파일',
        cancel: '취소'
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
    },
    diskMap: {
      title: 'Disko naudojimas',
      aggregateCell: (count) => `${count} mažesni elementai`,
      subtitle: 'Kas naudoja vietą šiame diske ir kur.',
      fastIndexSummary: (count) => `${count} failų ir aplankų nuskaityta iš paties disko indekso.`,
      browsingInstant: 'Naršymas nuo čia yra akimirksniu.',
      indexIncomplete: 'Dalies indekso nepavyko nuskaityti, todėl bendros sumos yra apatinė riba.',
      scanningDrive: 'Skenuojamas diskas…',
      readingDrive: 'Skaitomas diskas…',
      rescanButton: 'Skenuoti diską iš naujo (administratorius)',
      fastScanButton: 'Greitasis skenavimas (administratorius)',
      loading: {
        heading: 'Skaitomas kiekvienas aplankas po',
        note: 'Po vieną katalogą kartu — tai vienintelis būdas tai padaryti be administratoriaus teisių. Visas diskas gali užtrukti minutę ir gali nepavykti baigti.',
        indexButton: 'Vietoj to skaityti disko indeksą (administratorius)'
      },
      driveRootPrompt: {
        heading: 'Skaityti visą diską',
        fastExplain: (path) => `Greitasis skenavimas skaito paties disko failų indeksą — kiekvieną failą ${path} per kelias sekundes, lygiai taip pat, kaip tai daro WizTree. „Windows“ leidžia programai skaityti tą indeksą tik su administratoriaus teisėmis, todėl tai sukelia UAC užklausą.`,
        crawlExplain: 'Alternatyva pereina aplankus po vieną. Jai nereikia jokio leidimo ir ji tinka vienam aplankui, tačiau ji negali užbaigti viso tomo: šiame diske ji pasiekė 4% naudojamos vietos, kol baigėsi laikas, o likę 96% rodomi kaip neskenuoti, o ne kaip kažkas naudingo.',
        crawlButton: 'Vietoj to pereiti aplankus'
      },
      scanFailure: (path, error) => `Nepavyko nuskenuoti „${path}“: ${error}`,
      fastScanDeclined: 'Nepatvirtinta — vis dar naudojamas aplanko po aplanko skenavimas.',
      truncated: {
        withCoverage: (measured, used, percent) => `Šiam skenavimui baigėsi laikas: jis išmatavo ${measured} iš ${used} naudojamų (${percent}%). Tai, kas išmatuota, yra tikra; likusi dalis rodoma kaip neskenuota, o ne tuščia.`,
        withoutCoverage: 'Šiam skenavimui baigėsi laikas prieš baigiant diską. Viskas, kas iš tikrųjų buvo išmatuota, yra tikra, tačiau aplankai, kurių jis niekada nepasiekė, rodomi kaip neskenuoti, o ne tušti — nelaikykite to pilnu vaizdu apie tai, kas naudoja jūsų vietą.',
        rescanLink: 'Vietoj to paleisti greitąjį skenavimą'
      },
      view: { tree: 'Medis', files: 'Failai' },
      folderTable: {
        empty: 'Šiame aplanke nėra ko išvardyti.',
        notScanned: 'neskenuota',
        columns: { folder: 'Aplankas', size: 'Dydis', items: 'Elementai', files: 'Failai', folders: 'Aplankai', modified: 'Pakeista' }
      },
      extensionPanel: {
        header: 'Pagal failo tipą',
        typeCount: (n) => `${n} tipai`,
        noType: 'be tipo',
        footer: (bytes, count) => `${bytes} ${count} failuose`,
        unopenedFolders: (bytes) => ` · ${bytes} aplankuose, kurių skenavimas neatidarė`
      },
      largestFiles: { empty: 'Skenavimas nerado failų, kuriuos būtų galima išvardyti.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} neišmatuota`,
        aggregated: 'Mažiausi šio aplanko įrašai, sugrupuoti kartu.',
        unscanned: 'Skenavimas sustojo prieš pasiekiant šį. Tikras dydis nežinomas.'
      },
      cellOpenLabel: (name) => `Atverti ${name}`,
      contextMenu: {
        openInExplorer: 'Atverti naršyklėje',
        copyPath: 'Kopijuoti kelią',
        moveToQuarantineMenu: 'Perkelti į karantiną…'
      },
      toasts: {
        moved: (name) => `Perkelta į karantiną: ${name}`,
        restoreHint: 'Atkurkite jį iš Karantino ekrano.',
        pathCopied: 'Kelias nukopijuotas.',
        copyFailed: 'Nepavyko nukopijuoti šio kelio.',
        moveFailed: 'Nepavyko to perkelti.'
      },
      removeModal: {
        label: 'Perkelti į karantiną',
        heading: 'Perkelti tai į karantiną?',
        note: 'Tai perkeliama, o ne ištrinama — atkurkite bet kada iš Karantino ekrano.',
        folder: 'Aplankas',
        file: 'Failas',
        cancel: 'Atšaukti'
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
    },
    diskMap: {
      title: 'Penggunaan Cakera',
      aggregateCell: (count) => `${count} item yang lebih kecil`,
      subtitle: 'Apa yang menggunakan ruang pada cakera ini, dan di mana.',
      fastIndexSummary: (count) => `${count} fail dan folder dibaca daripada indeks cakera itu sendiri.`,
      browsingInstant: 'Penyemakan imbas adalah serta-merta dari sini.',
      indexIncomplete: 'Sebahagian indeks tidak dapat dibaca, jadi jumlah adalah had bawah.',
      scanningDrive: 'Mengimbas cakera…',
      readingDrive: 'Membaca cakera…',
      rescanButton: 'Imbas semula cakera (pentadbir)',
      fastScanButton: 'Imbasan pantas (pentadbir)',
      loading: {
        heading: 'Membaca setiap folder di bawah',
        note: 'Satu direktori pada satu masa, yang merupakan satu-satunya cara untuk melakukannya tanpa akses pentadbir. Keseluruhan cakera boleh mengambil masa seminit dan mungkin tidak selesai.',
        indexButton: 'Baca indeks cakera sebagai gantinya (pentadbir)'
      },
      driveRootPrompt: {
        heading: 'Baca keseluruhan cakera',
        fastExplain: (path) => `Imbasan pantas membaca indeks fail cakera itu sendiri — setiap fail pada ${path} dalam beberapa saat, sama seperti yang dilakukan oleh WizTree. Windows hanya membenarkan program membaca indeks itu dengan akses pentadbir, jadi ini mencetuskan permintaan UAC.`,
        crawlExplain: 'Alternatifnya melalui folder satu demi satu. Ia tidak memerlukan sebarang kebenaran dan merupakan alat yang sesuai untuk satu folder, tetapi ia tidak dapat menyelesaikan keseluruhan volum: pada cakera ini ia mencapai 4% daripada yang digunakan sebelum masa tamat, dan baki 96% dipaparkan sebagai tidak diimbas dan bukannya sesuatu yang berguna.',
        crawlButton: 'Melalui folder sebagai gantinya'
      },
      scanFailure: (path, error) => `Gagal mengimbas "${path}": ${error}`,
      fastScanDeclined: 'Tidak diluluskan — masih menggunakan imbasan folder demi folder.',
      truncated: {
        withCoverage: (measured, used, percent) => `Imbasan ini kehabisan masa: ia mengukur ${measured} daripada ${used} yang digunakan (${percent}%). Apa yang diukur adalah benar; bakinya dipaparkan sebagai tidak diimbas, bukan sebagai kosong.`,
        withoutCoverage: 'Imbasan ini kehabisan masa sebelum menyelesaikan cakera. Segala yang benar-benar diukur adalah benar, tetapi folder yang tidak pernah sampai dipaparkan sebagai tidak diimbas dan bukannya kosong — jangan anggap ini sebagai gambaran lengkap tentang apa yang menggunakan ruang anda.',
        rescanLink: 'Jalankan imbasan pantas sebagai gantinya'
      },
      view: { tree: 'Pokok', files: 'Fail' },
      folderTable: {
        empty: 'Tiada apa untuk disenaraikan di dalam folder ini.',
        notScanned: 'tidak diimbas',
        columns: { folder: 'Folder', size: 'Saiz', items: 'Item', files: 'Fail', folders: 'Folder', modified: 'Diubah suai' }
      },
      extensionPanel: {
        header: 'Mengikut jenis fail',
        typeCount: (n) => `${n} jenis`,
        noType: 'tiada jenis',
        footer: (bytes, count) => `${bytes} merentasi ${count} fail`,
        unopenedFolders: (bytes) => ` · ${bytes} dalam folder yang tidak dibuka oleh imbasan`
      },
      largestFiles: { empty: 'Imbasan tidak menemui fail untuk disenaraikan.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} tidak diukur`,
        aggregated: 'Entri terkecil dalam folder ini, dikumpulkan bersama.',
        unscanned: 'Imbasan berhenti sebelum sampai ke sini. Saiz sebenarnya tidak diketahui.'
      },
      cellOpenLabel: (name) => `Buka ${name}`,
      contextMenu: {
        openInExplorer: 'Buka dalam Explorer',
        copyPath: 'Salin laluan',
        moveToQuarantineMenu: 'Alih ke kuarantin…'
      },
      toasts: {
        moved: (name) => `Dialih ke kuarantin: ${name}`,
        restoreHint: 'Pulihkan daripada skrin Kuarantin.',
        pathCopied: 'Laluan disalin.',
        copyFailed: 'Laluan itu tidak dapat disalin.',
        moveFailed: 'Ini tidak dapat dialihkan.'
      },
      removeModal: {
        label: 'Alih ke kuarantin',
        heading: 'Alih ini ke kuarantin?',
        note: 'Ia dialihkan, bukan dipadamkan — pulihkan bila-bila masa daripada skrin Kuarantin.',
        folder: 'Folder',
        file: 'Fail',
        cancel: 'Batal'
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
    },
    diskMap: {
      title: 'Diskbruk',
      aggregateCell: (count) => `${count} mindre elementer`,
      subtitle: 'Hva som bruker plassen på denne disken, og hvor.',
      fastIndexSummary: (count) => `${count} filer og mapper lest fra diskens eget register.`,
      browsingInstant: 'Utforsking er øyeblikkelig herfra.',
      indexIncomplete: 'En del av registeret kunne ikke leses, så totalene er et minimum.',
      scanningDrive: 'Skanner disk…',
      readingDrive: 'Leser disken…',
      rescanButton: 'Skann disk på nytt (admin)',
      fastScanButton: 'Hurtigskann (admin)',
      loading: {
        heading: 'Leser hver mappe under',
        note: 'Én mappe om gangen, som er den eneste måten å gjøre det på uten administratortilgang. En hel disk kan ta et minutt og fullfører kanskje ikke.',
        indexButton: 'Les diskregisteret i stedet (admin)'
      },
      driveRootPrompt: {
        heading: 'Les hele disken',
        fastExplain: (path) => `Et hurtigskann leser diskens eget filregister — hver fil på ${path} på noen sekunder, akkurat slik WizTree gjør det. Windows lar bare et program lese det registeret med administratortilgang, så dette utløser en UAC-forespørsel.`,
        crawlExplain: 'Alternativet går gjennom mapper én om gangen. Det krever ingen tillatelse og er riktig verktøy for én enkelt mappe, men kan ikke fullføre et helt volum: på denne disken nådde den 4 % av det som er i bruk før tiden gikk ut, og de resterende 96 % vises som uskannet i stedet for noe nyttig.',
        crawlButton: 'Gå gjennom mapper i stedet'
      },
      scanFailure: (path, error) => `Kunne ikke skanne «${path}»: ${error}`,
      fastScanDeclined: 'Ikke godkjent — bruker fortsatt skanning mappe for mappe.',
      truncated: {
        withCoverage: (measured, used, percent) => `Dette skannet gikk tom for tid: det målte ${measured} av de ${used} i bruk (${percent} %). Det som ble målt, er reelt; resten vises som uskannet, ikke som tomt.`,
        withoutCoverage: 'Dette skannet gikk tom for tid før det fullførte disken. Alt det faktisk målte, er reelt, men mapper det aldri nådde, vises som uskannet i stedet for tomt — ikke les dette som et fullstendig bilde av hva som bruker plassen din.',
        rescanLink: 'Kjør et hurtigskann i stedet'
      },
      view: { tree: 'Tre', files: 'Filer' },
      folderTable: {
        empty: 'Ingenting å vise i denne mappen.',
        notScanned: 'ikke skannet',
        columns: { folder: 'Mappe', size: 'Størrelse', items: 'Elementer', files: 'Filer', folders: 'Mapper', modified: 'Endret' }
      },
      extensionPanel: {
        header: 'Etter filtype',
        typeCount: (n) => `${n} typer`,
        noType: 'ingen type',
        footer: (bytes, count) => `${bytes} fordelt på ${count} filer`,
        unopenedFolders: (bytes) => ` · ${bytes} i mapper skanningen ikke åpnet`
      },
      largestFiles: { empty: 'Skanningen fant ingen filer å vise.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} ikke målt`,
        aggregated: 'De minste oppføringene i denne mappen, gruppert sammen.',
        unscanned: 'Skanningen stoppet før den nådde hit. Den reelle størrelsen er ukjent.'
      },
      cellOpenLabel: (name) => `Åpne ${name}`,
      contextMenu: {
        openInExplorer: 'Åpne i Utforsker',
        copyPath: 'Kopier sti',
        moveToQuarantineMenu: 'Flytt til karantene…'
      },
      toasts: {
        moved: (name) => `Flyttet til karantene: ${name}`,
        restoreHint: 'Gjenopprett det fra Karantene-skjermen.',
        pathCopied: 'Sti kopiert.',
        copyFailed: 'Kunne ikke kopiere den stien.',
        moveFailed: 'Dette kunne ikke flyttes.'
      },
      removeModal: {
        label: 'Flytt til karantene',
        heading: 'Flytte dette til karantene?',
        note: 'Det flyttes, ikke slettes — gjenopprett det når som helst fra Karantene-skjermen.',
        folder: 'Mappe',
        file: 'Fil',
        cancel: 'Avbryt'
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
    },
    diskMap: {
      title: 'Schijfgebruik',
      aggregateCell: (count) => `${count} kleinere items`,
      subtitle: 'Wat gebruikt de ruimte op deze schijf, en waar.',
      fastIndexSummary: (count) => `${count} bestanden en mappen gelezen uit de eigen index van de schijf.`,
      browsingInstant: 'Bladeren is vanaf hier direct.',
      indexIncomplete: 'Een deel van de index kon niet worden gelezen, dus de totalen zijn een ondergrens.',
      scanningDrive: 'Schijf wordt gescand…',
      readingDrive: 'Schijf wordt gelezen…',
      rescanButton: 'Schijf opnieuw scannen (beheerder)',
      fastScanButton: 'Snelle scan (beheerder)',
      loading: {
        heading: 'Elke map onder',
        note: 'Eén map tegelijk, wat de enige manier is om dit zonder beheerdersrechten te doen. Een hele schijf kan een minuut duren en wordt mogelijk niet voltooid.',
        indexButton: 'Lees in plaats daarvan de schijfindex (beheerder)'
      },
      driveRootPrompt: {
        heading: 'Lees de hele schijf',
        fastExplain: (path) => `Een snelle scan leest de eigen bestandsindex van de schijf — elk bestand op ${path} in enkele seconden, precies zoals WizTree dat doet. Windows laat een programma die index alleen lezen met beheerderstoegang, dus dit veroorzaakt een UAC-melding.`,
        crawlExplain: 'Het alternatief doorloopt mappen één voor één. Het vereist geen toestemming en is het juiste hulpmiddel voor één map, maar kan geen heel volume voltooien: op deze schijf bereikte het 4% van wat in gebruik is voordat de tijd om was, en de overige 96% wordt getoond als niet-gescand in plaats van als iets nuttigs.',
        crawlButton: 'Doorloop in plaats daarvan mappen'
      },
      scanFailure: (path, error) => `Kan "${path}" niet scannen: ${error}`,
      fastScanDeclined: 'Niet goedgekeurd — gebruikt nog steeds de map-voor-map-scan.',
      truncated: {
        withCoverage: (measured, used, percent) => `Deze scan heeft geen tijd meer: er is ${measured} gemeten van de ${used} in gebruik (${percent}%). Wat is gemeten, is echt; de rest wordt getoond als niet-gescand, niet als leeg.`,
        withoutCoverage: 'Deze scan heeft geen tijd meer voordat de schijf werd voltooid. Alles wat daadwerkelijk is gemeten, is echt, maar mappen die nooit zijn bereikt, worden getoond als niet-gescand in plaats van leeg — lees dit niet als een volledig beeld van wat uw ruimte gebruikt.',
        rescanLink: 'Voer in plaats daarvan een snelle scan uit'
      },
      view: { tree: 'Boom', files: 'Bestanden' },
      folderTable: {
        empty: 'Niets om weer te geven in deze map.',
        notScanned: 'niet gescand',
        columns: { folder: 'Map', size: 'Grootte', items: 'Items', files: 'Bestanden', folders: 'Mappen', modified: 'Gewijzigd' }
      },
      extensionPanel: {
        header: 'Op bestandstype',
        typeCount: (n) => `${n} typen`,
        noType: 'geen type',
        footer: (bytes, count) => `${bytes} verdeeld over ${count} bestanden`,
        unopenedFolders: (bytes) => ` · ${bytes} in mappen die de scan niet heeft geopend`
      },
      largestFiles: { empty: 'De scan heeft geen bestanden gevonden om weer te geven.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} niet gemeten`,
        aggregated: 'De kleinste items in deze map, gegroepeerd.',
        unscanned: 'De scan is gestopt voordat dit werd bereikt. De werkelijke grootte is onbekend.'
      },
      cellOpenLabel: (name) => `${name} openen`,
      contextMenu: {
        openInExplorer: 'Openen in Verkenner',
        copyPath: 'Pad kopiëren',
        moveToQuarantineMenu: 'Verplaatsen naar quarantaine…'
      },
      toasts: {
        moved: (name) => `Verplaatst naar quarantaine: ${name}`,
        restoreHint: 'Herstel het vanaf het scherm Quarantaine.',
        pathCopied: 'Pad gekopieerd.',
        copyFailed: 'Dat pad kon niet worden gekopieerd.',
        moveFailed: 'Dit kon niet worden verplaatst.'
      },
      removeModal: {
        label: 'Verplaatsen naar quarantaine',
        heading: 'Dit naar quarantaine verplaatsen?',
        note: 'Het wordt verplaatst, niet verwijderd — herstel het op elk moment vanaf het scherm Quarantaine.',
        folder: 'Map',
        file: 'Bestand',
        cancel: 'Annuleren'
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
    },
    diskMap: {
      title: 'Wykorzystanie Dysku',
      aggregateCell: (count) => `${count} mniejszych elementów`,
      subtitle: 'Co zajmuje miejsce na tym dysku i gdzie.',
      fastIndexSummary: (count) => `${count} plików i folderów odczytanych z własnego indeksu dysku.`,
      browsingInstant: 'Przeglądanie stąd jest natychmiastowe.',
      indexIncomplete: 'Nie udało się odczytać części indeksu, więc sumy są dolną granicą.',
      scanningDrive: 'Skanowanie dysku…',
      readingDrive: 'Odczytywanie dysku…',
      rescanButton: 'Skanuj dysk ponownie (administrator)',
      fastScanButton: 'Szybkie skanowanie (administrator)',
      loading: {
        heading: 'Odczytywanie każdego folderu w',
        note: 'Jeden katalog naraz, co jest jedynym sposobem, by zrobić to bez uprawnień administratora. Cały dysk może zająć minutę i może się nie zakończyć.',
        indexButton: 'Zamiast tego odczytaj indeks dysku (administrator)'
      },
      driveRootPrompt: {
        heading: 'Odczytaj cały dysk',
        fastExplain: (path) => `Szybkie skanowanie odczytuje własny indeks plików dysku — każdy plik na ${path} w ciągu kilku sekund, dokładnie tak, jak robi to WizTree. Windows pozwala programowi odczytać ten indeks tylko z uprawnieniami administratora, więc powoduje to monit UAC.`,
        crawlExplain: 'Alternatywa przechodzi przez foldery jeden po drugim. Nie wymaga żadnych uprawnień i jest odpowiednim narzędziem dla pojedynczego folderu, ale nie może ukończyć całego woluminu: na tym dysku dotarła do 4% wykorzystanego miejsca, zanim skończył się czas, a pozostałe 96% jest pokazywane jako niezeskanowane, a nie jako coś przydatnego.',
        crawlButton: 'Zamiast tego przejdź przez foldery'
      },
      scanFailure: (path, error) => `Nie udało się zeskanować „${path}”: ${error}`,
      fastScanDeclined: 'Nie zatwierdzono — nadal używane jest skanowanie folder po folderze.',
      truncated: {
        withCoverage: (measured, used, percent) => `Temu skanowaniu zabrakło czasu: zmierzyło ${measured} z ${used} wykorzystanych (${percent}%). To, co zmierzyło, jest prawdziwe; reszta jest pokazywana jako niezeskanowana, a nie jako pusta.`,
        withoutCoverage: 'Temu skanowaniu zabrakło czasu, zanim ukończyło dysk. Wszystko, co faktycznie zmierzyło, jest prawdziwe, ale foldery, do których nigdy nie dotarło, są pokazywane jako niezeskanowane, a nie puste — nie odczytuj tego jako pełnego obrazu tego, co zajmuje twoje miejsce.',
        rescanLink: 'Zamiast tego uruchom szybkie skanowanie'
      },
      view: { tree: 'Drzewo', files: 'Pliki' },
      folderTable: {
        empty: 'Nic do wyświetlenia w tym folderze.',
        notScanned: 'niezeskanowane',
        columns: { folder: 'Folder', size: 'Rozmiar', items: 'Elementy', files: 'Pliki', folders: 'Foldery', modified: 'Zmodyfikowano' }
      },
      extensionPanel: {
        header: 'Według typu pliku',
        typeCount: (n) => `${n} typów`,
        noType: 'brak typu',
        footer: (bytes, count) => `${bytes} w ${count} plikach`,
        unopenedFolders: (bytes) => ` · ${bytes} w folderach, których skanowanie nie otworzyło`
      },
      largestFiles: { empty: 'Skanowanie nie znalazło plików do wyświetlenia.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} niezmierzone`,
        aggregated: 'Najmniejsze wpisy w tym folderze, pogrupowane razem.',
        unscanned: 'Skanowanie zatrzymało się, zanim dotarło tutaj. Rzeczywisty rozmiar jest nieznany.'
      },
      cellOpenLabel: (name) => `Otwórz ${name}`,
      contextMenu: {
        openInExplorer: 'Otwórz w Eksploratorze',
        copyPath: 'Kopiuj ścieżkę',
        moveToQuarantineMenu: 'Przenieś do kwarantanny…'
      },
      toasts: {
        moved: (name) => `Przeniesiono do kwarantanny: ${name}`,
        restoreHint: 'Przywróć to z ekranu Kwarantanna.',
        pathCopied: 'Ścieżka skopiowana.',
        copyFailed: 'Nie udało się skopiować tej ścieżki.',
        moveFailed: 'Nie udało się tego przenieść.'
      },
      removeModal: {
        label: 'Przenieś do kwarantanny',
        heading: 'Przenieść to do kwarantanny?',
        note: 'Zostaje przeniesione, a nie usunięte — przywróć to w dowolnym momencie z ekranu Kwarantanna.',
        folder: 'Folder',
        file: 'Plik',
        cancel: 'Anuluj'
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
    },
    diskMap: {
      title: 'د ډیسک کارول',
      aggregateCell: (count) => `${count} کوچني توکي`,
      subtitle: 'دا ډیسک کې ځای څه شی کاروي، او چیرته.',
      fastIndexSummary: (count) => `${count} فایلونه او فولډرونه د ډرایو له خپل شاخص څخه ولوستل شول.`,
      browsingInstant: 'له دې ځایه لټون سمدلاسه دی.',
      indexIncomplete: 'د شاخص یوه برخه نه شوه لوستل، نو ټولې اندازې یو ټیټ حد دی.',
      scanningDrive: 'ډرایو سکن کیږي…',
      readingDrive: 'ډرایو لوستل کیږي…',
      rescanButton: 'ډرایو بیا سکن کړئ (اډمین)',
      fastScanButton: 'چټک سکن (اډمین)',
      loading: {
        heading: 'هر فولډر لوستل کیږي لاندې',
        note: 'یو وخت یو ډایرکتوري، چې د اډمین لاسرسي پرته دا کار کولو یوازینۍ لاره ده. یو بشپړ ډرایو ممکن یوه دقیقه ونیسي او بشپړ نشي.',
        indexButton: 'پرځای یې د ډرایو شاخص ولولئ (اډمین)'
      },
      driveRootPrompt: {
        heading: 'ټول ډرایو ولولئ',
        fastExplain: (path) => `چټک سکن د ډرایو خپل د فایل شاخص لولي — هر فایل په ${path} کې څو ثانیو کې، لکه څنګه چې WizTree دا کوي. Windows یوازې د اډمین لاسرسي سره پروګرام ته اجازه ورکوي چې دا شاخص ولولي، نو دا یو UAC غوښتنه رامینځته کوي.`,
        crawlExplain: 'بدیل فولډرونه یو په یو تیروي. دې ته هیڅ اجازه ته اړتیا نشته او دا د یوه فولډر لپاره سم وسیله ده، خو دا نشي کولی یو بشپړ حجم بشپړ کړي: پدې ډرایو کې دا کارول شوي 4٪ ته ورسید مخکې لدې چې وخت پای ته ورسیږي، او پاتې 96٪ د یو ګټور شی پر ځای د نه سکن شوي په توګه ښودل کیږي.',
        crawlButton: 'پرځای یې فولډرونه تیروئ'
      },
      scanFailure: (path, error) => `"${path}" سکن نشو: ${error}`,
      fastScanDeclined: 'تصویب نشو — لاهم د فولډر پر فولډر سکن کارول کیږي.',
      truncated: {
        withCoverage: (measured, used, percent) => `دا سکن یې وخت پای ته ورسید: دا یې کارول شوي ${used} څخه ${measured} اندازه کړل (${percent}٪). هغه څه چې اندازه شوي واقعي دي؛ پاتې برخه د تشو پر ځای د نه سکن شوي په توګه ښودل کیږي.`,
        withoutCoverage: 'دا سکن یې وخت پای ته ورسید مخکې لدې چې ډرایو بشپړ کړي. هر هغه څه چې واقعیا اندازه شوي واقعي دي، خو هغه فولډرونه چې دا هیڅکله ورته نه دی رسیدلی د تشو پر ځای د نه سکن شوي په توګه ښودل کیږي — دا د خپل ځای کارونکي شیانو د بشپړ انځور په توګه مه لولئ.',
        rescanLink: 'پرځای یې یو چټک سکن پیل کړئ'
      },
      view: { tree: 'ونه', files: 'فایلونه' },
      folderTable: {
        empty: 'د دې فولډر دننه لیست کولو لپاره هیڅ شی نشته.',
        notScanned: 'نه دی سکن شوی',
        columns: { folder: 'فولډر', size: 'اندازه', items: 'توکي', files: 'فایلونه', folders: 'فولډرونه', modified: 'بدل شوی' }
      },
      extensionPanel: {
        header: 'د فایل ډول له مخې',
        typeCount: (n) => `${n} ډولونه`,
        noType: 'هیڅ ډول نشته',
        footer: (bytes, count) => `${bytes} په ${count} فایلونو کې`,
        unopenedFolders: (bytes) => ` · ${bytes} په هغو فولډرونو کې چې سکن یې نه دی خلاص کړی`
      },
      largestFiles: { empty: 'سکن هیڅ فایل ونه موند چې ولیست شي.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} اندازه نشوې`,
        aggregated: 'د دې فولډر ترټولو کوچني ننوتنې، سره یوځای شوي.',
        unscanned: 'سکن دې ته رسیدو مخکې ودریدل. اصلي اندازه نامعلومه ده.'
      },
      cellOpenLabel: (name) => `${name} خلاص کړئ`,
      contextMenu: {
        openInExplorer: 'په اکسپلورر کې خلاص کړئ',
        copyPath: 'لاره کاپي کړئ',
        moveToQuarantineMenu: 'قرنطین ته لیږدول…'
      },
      toasts: {
        moved: (name) => `قرنطین ته لیږدول شو: ${name}`,
        restoreHint: 'دا د قرنطین پرده څخه بیا رغول کړئ.',
        pathCopied: 'لاره کاپي شوه.',
        copyFailed: 'هغه لاره کاپي نشوه.',
        moveFailed: 'دا نشو لیږدول کیدلی.'
      },
      removeModal: {
        label: 'قرنطین ته لیږدول',
        heading: 'دا قرنطین ته ولیږدول شي؟',
        note: 'دا لیږدول کیږي، نه ړنګول کیږي — دا هر وخت د قرنطین پردې څخه بیا رغولی شئ.',
        folder: 'فولډر',
        file: 'فایل',
        cancel: 'لغوه کول'
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
    },
    diskMap: {
      title: 'Uso do Disco',
      aggregateCell: (count) => `${count} itens menores`,
      subtitle: 'O que está usando o espaço neste disco, e onde.',
      fastIndexSummary: (count) => `${count} arquivos e pastas lidos do próprio índice do disco.`,
      browsingInstant: 'A navegação é instantânea a partir daqui.',
      indexIncomplete: 'Parte do índice não pôde ser lida, então os totais são um limite inferior.',
      scanningDrive: 'Escaneando o disco…',
      readingDrive: 'Lendo o disco…',
      rescanButton: 'Reescanear disco (admin)',
      fastScanButton: 'Escaneamento rápido (admin)',
      loading: {
        heading: 'Lendo cada pasta dentro de',
        note: 'Um diretório de cada vez, que é a única forma de fazer isso sem acesso de administrador. Um disco inteiro pode levar um minuto e talvez não termine.',
        indexButton: 'Ler o índice do disco em vez disso (admin)'
      },
      driveRootPrompt: {
        heading: 'Ler o disco inteiro',
        fastExplain: (path) => `Um escaneamento rápido lê o próprio índice de arquivos do disco — cada arquivo em ${path} em poucos segundos, exatamente como o WizTree faz. O Windows só permite que um programa leia esse índice com acesso de administrador, então isso gera uma solicitação UAC.`,
        crawlExplain: 'A alternativa percorre as pastas uma de cada vez. Não precisa de nenhuma permissão e é a ferramenta certa para uma única pasta, mas não consegue terminar um volume inteiro: neste disco ela alcançou 4% do que está em uso antes de o tempo acabar, e os outros 96% aparecem como não escaneados em vez de algo útil.',
        crawlButton: 'Percorrer pastas em vez disso'
      },
      scanFailure: (path, error) => `Não foi possível escanear "${path}": ${error}`,
      fastScanDeclined: 'Não aprovado — ainda usando o escaneamento pasta por pasta.',
      truncated: {
        withCoverage: (measured, used, percent) => `Este escaneamento ficou sem tempo: mediu ${measured} dos ${used} em uso (${percent}%). O que foi medido é real; o resto aparece como não escaneado, não como vazio.`,
        withoutCoverage: 'Este escaneamento ficou sem tempo antes de terminar o disco. Tudo o que realmente mediu é real, mas as pastas que nunca alcançou aparecem como não escaneadas em vez de vazias — não interprete isso como uma imagem completa do que está usando seu espaço.',
        rescanLink: 'Executar um escaneamento rápido em vez disso'
      },
      view: { tree: 'Árvore', files: 'Arquivos' },
      folderTable: {
        empty: 'Nada para listar dentro desta pasta.',
        notScanned: 'não escaneado',
        columns: { folder: 'Pasta', size: 'Tamanho', items: 'Itens', files: 'Arquivos', folders: 'Pastas', modified: 'Modificado' }
      },
      extensionPanel: {
        header: 'Por tipo de arquivo',
        typeCount: (n) => `${n} tipos`,
        noType: 'sem tipo',
        footer: (bytes, count) => `${bytes} em ${count} arquivos`,
        unopenedFolders: (bytes) => ` · ${bytes} em pastas que o escaneamento não abriu`
      },
      largestFiles: { empty: 'O escaneamento não encontrou arquivos para listar.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} não medido`,
        aggregated: 'As menores entradas desta pasta, agrupadas.',
        unscanned: 'O escaneamento parou antes de chegar aqui. O tamanho real é desconhecido.'
      },
      cellOpenLabel: (name) => `Abrir ${name}`,
      contextMenu: {
        openInExplorer: 'Abrir no Explorador de Arquivos',
        copyPath: 'Copiar caminho',
        moveToQuarantineMenu: 'Mover para quarentena…'
      },
      toasts: {
        moved: (name) => `Movido para quarentena: ${name}`,
        restoreHint: 'Restaure a partir da tela Quarentena.',
        pathCopied: 'Caminho copiado.',
        copyFailed: 'Não foi possível copiar esse caminho.',
        moveFailed: 'Isso não pôde ser movido.'
      },
      removeModal: {
        label: 'Mover para quarentena',
        heading: 'Mover isto para quarentena?',
        note: 'É movido, não excluído — restaure a qualquer momento pela tela Quarentena.',
        folder: 'Pasta',
        file: 'Arquivo',
        cancel: 'Cancelar'
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
    },
    diskMap: {
      title: 'Utilização do Disco',
      aggregateCell: (count) => `${count} itens mais pequenos`,
      subtitle: 'O que está a usar o espaço neste disco, e onde.',
      fastIndexSummary: (count) => `${count} ficheiros e pastas lidos a partir do próprio índice do disco.`,
      browsingInstant: 'A navegação é instantânea a partir daqui.',
      indexIncomplete: 'Parte do índice não pôde ser lida, pelo que os totais são um limite inferior.',
      scanningDrive: 'A analisar o disco…',
      readingDrive: 'A ler o disco…',
      rescanButton: 'Analisar novamente o disco (admin)',
      fastScanButton: 'Análise rápida (admin)',
      loading: {
        heading: 'A ler cada pasta dentro de',
        note: 'Um diretório de cada vez, que é a única forma de o fazer sem acesso de administrador. Um disco inteiro pode demorar um minuto e pode não terminar.',
        indexButton: 'Ler antes o índice do disco (admin)'
      },
      driveRootPrompt: {
        heading: 'Ler o disco inteiro',
        fastExplain: (path) => `Uma análise rápida lê o próprio índice de ficheiros do disco — cada ficheiro em ${path} em poucos segundos, tal como o WizTree faz. O Windows só permite que um programa leia esse índice com acesso de administrador, pelo que isto gera um pedido UAC.`,
        crawlExplain: 'A alternativa percorre as pastas uma de cada vez. Não necessita de qualquer permissão e é a ferramenta certa para uma única pasta, mas não consegue concluir um volume inteiro: neste disco atingiu 4% do que está em uso antes de o tempo se esgotar, e os restantes 96% aparecem como não analisados em vez de algo útil.',
        crawlButton: 'Percorrer as pastas em vez disso'
      },
      scanFailure: (path, error) => `Não foi possível analisar "${path}": ${error}`,
      fastScanDeclined: 'Não aprovado — continua a usar a análise pasta a pasta.',
      truncated: {
        withCoverage: (measured, used, percent) => `Esta análise ficou sem tempo: mediu ${measured} dos ${used} em uso (${percent}%). O que mediu é real; o resto aparece como não analisado, não como vazio.`,
        withoutCoverage: 'Esta análise ficou sem tempo antes de concluir o disco. Tudo o que realmente mediu é real, mas as pastas que nunca alcançou aparecem como não analisadas em vez de vazias — não leia isto como uma imagem completa do que está a usar o seu espaço.',
        rescanLink: 'Executar antes uma análise rápida'
      },
      view: { tree: 'Árvore', files: 'Ficheiros' },
      folderTable: {
        empty: 'Nada para listar dentro desta pasta.',
        notScanned: 'não analisado',
        columns: { folder: 'Pasta', size: 'Tamanho', items: 'Itens', files: 'Ficheiros', folders: 'Pastas', modified: 'Modificado' }
      },
      extensionPanel: {
        header: 'Por tipo de ficheiro',
        typeCount: (n) => `${n} tipos`,
        noType: 'sem tipo',
        footer: (bytes, count) => `${bytes} em ${count} ficheiros`,
        unopenedFolders: (bytes) => ` · ${bytes} em pastas que a análise não abriu`
      },
      largestFiles: { empty: 'A análise não encontrou ficheiros para listar.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} não medido`,
        aggregated: 'As entradas mais pequenas desta pasta, agrupadas.',
        unscanned: 'A análise parou antes de chegar aqui. O tamanho real é desconhecido.'
      },
      cellOpenLabel: (name) => `Abrir ${name}`,
      contextMenu: {
        openInExplorer: 'Abrir no Explorador',
        copyPath: 'Copiar caminho',
        moveToQuarantineMenu: 'Mover para quarentena…'
      },
      toasts: {
        moved: (name) => `Movido para quarentena: ${name}`,
        restoreHint: 'Restaure a partir do ecrã Quarentena.',
        pathCopied: 'Caminho copiado.',
        copyFailed: 'Não foi possível copiar esse caminho.',
        moveFailed: 'Não foi possível mover isto.'
      },
      removeModal: {
        label: 'Mover para quarentena',
        heading: 'Mover isto para quarentena?',
        note: 'É movido, não eliminado — restaure a qualquer momento a partir do ecrã Quarentena.',
        folder: 'Pasta',
        file: 'Ficheiro',
        cancel: 'Cancelar'
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
    },
    diskMap: {
      title: 'Utilizarea Discului',
      aggregateCell: (count) => `${count} elemente mai mici`,
      subtitle: 'Ce utilizează spațiul pe acest disc, și unde.',
      fastIndexSummary: (count) => `${count} fișiere și foldere citite din propriul index al discului.`,
      browsingInstant: 'Navigarea este instantanee de aici.',
      indexIncomplete: 'O parte din index nu a putut fi citită, deci totalurile sunt o limită inferioară.',
      scanningDrive: 'Se scanează discul…',
      readingDrive: 'Se citește discul…',
      rescanButton: 'Rescanează discul (admin)',
      fastScanButton: 'Scanare rapidă (admin)',
      loading: {
        heading: 'Se citește fiecare folder din',
        note: 'Câte un director pe rând, care este singura modalitate de a face asta fără acces de administrator. Un întreg disc poate dura un minut și s-ar putea să nu se termine.',
        indexButton: 'Citește în schimb indexul discului (admin)'
      },
      driveRootPrompt: {
        heading: 'Citește întregul disc',
        fastExplain: (path) => `O scanare rapidă citește propriul index de fișiere al discului — fiecare fișier de pe ${path} în câteva secunde, exact cum face WizTree. Windows permite unui program să citească acel index doar cu acces de administrator, deci acest lucru generează o solicitare UAC.`,
        crawlExplain: 'Alternativa parcurge folderele unul câte unul. Nu necesită nicio permisiune și este instrumentul potrivit pentru un singur folder, dar nu poate finaliza un volum întreg: pe acest disc a ajuns la 4% din ce este utilizat înainte de a se termina timpul, iar celelalte 96% apar ca nescanate, nu ca ceva util.',
        crawlButton: 'Parcurge folderele în schimb'
      },
      scanFailure: (path, error) => `Nu s-a putut scana „${path}”: ${error}`,
      fastScanDeclined: 'Neaprobat — încă se folosește scanarea folder cu folder.',
      truncated: {
        withCoverage: (measured, used, percent) => `Această scanare a rămas fără timp: a măsurat ${measured} din cei ${used} utilizați (${percent}%). Ceea ce a măsurat este real; restul apare ca nescanat, nu ca gol.`,
        withoutCoverage: 'Această scanare a rămas fără timp înainte de a finaliza discul. Tot ce a măsurat efectiv este real, dar folderele la care nu a ajuns niciodată apar ca nescanate, nu ca goale — nu citiți asta ca o imagine completă a ceea ce vă utilizează spațiul.',
        rescanLink: 'Rulează în schimb o scanare rapidă'
      },
      view: { tree: 'Arbore', files: 'Fișiere' },
      folderTable: {
        empty: 'Nimic de listat în acest folder.',
        notScanned: 'nescanat',
        columns: { folder: 'Folder', size: 'Dimensiune', items: 'Elemente', files: 'Fișiere', folders: 'Foldere', modified: 'Modificat' }
      },
      extensionPanel: {
        header: 'După tipul de fișier',
        typeCount: (n) => `${n} tipuri`,
        noType: 'fără tip',
        footer: (bytes, count) => `${bytes} în ${count} fișiere`,
        unopenedFolders: (bytes) => ` · ${bytes} în foldere pe care scanarea nu le-a deschis`
      },
      largestFiles: { empty: 'Scanarea nu a găsit fișiere de listat.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} nemăsurat`,
        aggregated: 'Cele mai mici intrări din acest folder, grupate împreună.',
        unscanned: 'Scanarea s-a oprit înainte de a ajunge aici. Dimensiunea reală este necunoscută.'
      },
      cellOpenLabel: (name) => `Deschide ${name}`,
      contextMenu: {
        openInExplorer: 'Deschide în Explorer',
        copyPath: 'Copiază calea',
        moveToQuarantineMenu: 'Mută în carantină…'
      },
      toasts: {
        moved: (name) => `Mutat în carantină: ${name}`,
        restoreHint: 'Restaurați-l din ecranul Carantină.',
        pathCopied: 'Cale copiată.',
        copyFailed: 'Această cale nu a putut fi copiată.',
        moveFailed: 'Aceasta nu a putut fi mutată.'
      },
      removeModal: {
        label: 'Mută în carantină',
        heading: 'Mutați acest lucru în carantină?',
        note: 'Este mutat, nu șters — restaurați-l oricând din ecranul Carantină.',
        folder: 'Folder',
        file: 'Fișier',
        cancel: 'Anulează'
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
    },
    diskMap: {
      title: 'Использование Диска',
      aggregateCell: (count) => `${count} меньших элементов`,
      subtitle: 'Что использует место на этом диске, и где.',
      fastIndexSummary: (count) => `${count} файлов и папок прочитано из собственного индекса диска.`,
      browsingInstant: 'Просмотр отсюда мгновенный.',
      indexIncomplete: 'Часть индекса не удалось прочитать, поэтому итоги — это нижняя граница.',
      scanningDrive: 'Сканирование диска…',
      readingDrive: 'Чтение диска…',
      rescanButton: 'Пересканировать диск (администратор)',
      fastScanButton: 'Быстрое сканирование (администратор)',
      loading: {
        heading: 'Чтение каждой папки в',
        note: 'По одному каталогу за раз — это единственный способ сделать это без прав администратора. Весь диск может занять минуту и может не завершиться.',
        indexButton: 'Прочитать вместо этого индекс диска (администратор)'
      },
      driveRootPrompt: {
        heading: 'Прочитать весь диск',
        fastExplain: (path) => `Быстрое сканирование читает собственный файловый индекс диска — каждый файл на ${path} за несколько секунд, точно так же, как это делает WizTree. Windows позволяет программе читать этот индекс только с правами администратора, поэтому это вызывает запрос UAC.`,
        crawlExplain: 'Альтернатива обходит папки по одной. Она не требует никаких разрешений и является правильным инструментом для одной папки, но не может завершить весь том: на этом диске она достигла 4% используемого пространства до истечения времени, а остальные 96% отображаются как несканированные, а не как что-то полезное.',
        crawlButton: 'Вместо этого обойти папки'
      },
      scanFailure: (path, error) => `Не удалось просканировать «${path}»: ${error}`,
      fastScanDeclined: 'Не подтверждено — по-прежнему используется сканирование папка за папкой.',
      truncated: {
        withCoverage: (measured, used, percent) => `У этого сканирования закончилось время: измерено ${measured} из ${used} используемых (${percent}%). То, что измерено, реально; остальное отображается как несканированное, а не как пустое.`,
        withoutCoverage: 'У этого сканирования закончилось время до завершения диска. Всё, что было фактически измерено, реально, но папки, которых оно так и не достигло, отображаются как несканированные, а не пустые — не воспринимайте это как полную картину того, что занимает ваше место.',
        rescanLink: 'Вместо этого запустить быстрое сканирование'
      },
      view: { tree: 'Дерево', files: 'Файлы' },
      folderTable: {
        empty: 'В этой папке нечего перечислять.',
        notScanned: 'не сканировано',
        columns: { folder: 'Папка', size: 'Размер', items: 'Элементы', files: 'Файлы', folders: 'Папки', modified: 'Изменено' }
      },
      extensionPanel: {
        header: 'По типу файла',
        typeCount: (n) => `${n} типов`,
        noType: 'без типа',
        footer: (bytes, count) => `${bytes} в ${count} файлах`,
        unopenedFolders: (bytes) => ` · ${bytes} в папках, которые сканирование не открыло`
      },
      largestFiles: { empty: 'Сканирование не нашло файлов для отображения.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} не измерено`,
        aggregated: 'Самые маленькие записи в этой папке, сгруппированные вместе.',
        unscanned: 'Сканирование остановилось до достижения этого места. Реальный размер неизвестен.'
      },
      cellOpenLabel: (name) => `Открыть ${name}`,
      contextMenu: {
        openInExplorer: 'Открыть в проводнике',
        copyPath: 'Копировать путь',
        moveToQuarantineMenu: 'Переместить в карантин…'
      },
      toasts: {
        moved: (name) => `Перемещено в карантин: ${name}`,
        restoreHint: 'Восстановите его с экрана Карантин.',
        pathCopied: 'Путь скопирован.',
        copyFailed: 'Не удалось скопировать этот путь.',
        moveFailed: 'Не удалось переместить это.'
      },
      removeModal: {
        label: 'Переместить в карантин',
        heading: 'Переместить это в карантин?',
        note: 'Это перемещается, а не удаляется — восстановите в любое время с экрана Карантин.',
        folder: 'Папка',
        file: 'Файл',
        cancel: 'Отмена'
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
    },
    diskMap: {
      title: 'Využitie Disku',
      aggregateCell: (count) => `${count} menších položiek`,
      subtitle: 'Čo využíva miesto na tomto disku a kde.',
      fastIndexSummary: (count) => `${count} súborov a priečinkov načítaných z vlastného indexu disku.`,
      browsingInstant: 'Prehliadanie je odtiaľto okamžité.',
      indexIncomplete: 'Časť indexu sa nepodarilo načítať, takže súčty sú dolný odhad.',
      scanningDrive: 'Prehľadávanie disku…',
      readingDrive: 'Čítanie disku…',
      rescanButton: 'Znova prehľadať disk (správca)',
      fastScanButton: 'Rýchle prehľadanie (správca)',
      loading: {
        heading: 'Čítanie každého priečinka v',
        note: 'Jeden adresár po druhom, čo je jediný spôsob, ako to urobiť bez oprávnení správcu. Celý disk môže trvať minútu a nemusí sa skončiť.',
        indexButton: 'Namiesto toho načítať index disku (správca)'
      },
      driveRootPrompt: {
        heading: 'Načítať celý disk',
        fastExplain: (path) => `Rýchle prehľadanie načíta vlastný súborový index disku — každý súbor na ${path} za pár sekúnd, presne tak, ako to robí WizTree. Windows umožňuje programu čítať tento index iba s oprávneniami správcu, takže sa zobrazí výzva UAC.`,
        crawlExplain: 'Alternatíva prechádza priečinky jeden po druhom. Nevyžaduje žiadne povolenie a je vhodná pre jeden priečinok, ale nedokáže dokončiť celý zväzok: na tomto disku dosiahla 4 % využitého miesta, kým sa minul čas, a zvyšných 96 % sa zobrazuje ako neprehľadané namiesto niečoho užitočného.',
        crawlButton: 'Namiesto toho prechádzať priečinky'
      },
      scanFailure: (path, error) => `Nepodarilo sa prehľadať „${path}“: ${error}`,
      fastScanDeclined: 'Neschválené — stále sa používa prehľadávanie priečinok po priečinku.',
      truncated: {
        withCoverage: (measured, used, percent) => `Tomuto prehľadaniu vypršal čas: zmeralo ${measured} z ${used} využitého miesta (${percent} %). To, čo zmeralo, je skutočné; zvyšok sa zobrazuje ako neprehľadaný, nie ako prázdny.`,
        withoutCoverage: 'Tomuto prehľadaniu vypršal čas skôr, ako dokončilo disk. Všetko, čo skutočne zmeralo, je skutočné, ale priečinky, ku ktorým sa nikdy nedostalo, sa zobrazujú ako neprehľadané, nie ako prázdne — neberte to ako úplný obraz toho, čo využíva vaše miesto.',
        rescanLink: 'Namiesto toho spustiť rýchle prehľadanie'
      },
      view: { tree: 'Strom', files: 'Súbory' },
      folderTable: {
        empty: 'V tomto priečinku nie je nič na zobrazenie.',
        notScanned: 'neprehľadané',
        columns: { folder: 'Priečinok', size: 'Veľkosť', items: 'Položky', files: 'Súbory', folders: 'Priečinky', modified: 'Zmenené' }
      },
      extensionPanel: {
        header: 'Podľa typu súboru',
        typeCount: (n) => `${n} typov`,
        noType: 'bez typu',
        footer: (bytes, count) => `${bytes} v ${count} súboroch`,
        unopenedFolders: (bytes) => ` · ${bytes} v priečinkoch, ktoré prehľadanie neotvorilo`
      },
      largestFiles: { empty: 'Prehľadanie nenašlo žiadne súbory na zobrazenie.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} nezmerané`,
        aggregated: 'Najmenšie položky v tomto priečinku, zoskupené spolu.',
        unscanned: 'Prehľadanie sa zastavilo, kým sa sem dostalo. Skutočná veľkosť nie je známa.'
      },
      cellOpenLabel: (name) => `Otvoriť ${name}`,
      contextMenu: {
        openInExplorer: 'Otvoriť v Prieskumníkovi',
        copyPath: 'Kopírovať cestu',
        moveToQuarantineMenu: 'Presunúť do karantény…'
      },
      toasts: {
        moved: (name) => `Presunuté do karantény: ${name}`,
        restoreHint: 'Obnovte to z obrazovky Karanténa.',
        pathCopied: 'Cesta skopírovaná.',
        copyFailed: 'Túto cestu sa nepodarilo skopírovať.',
        moveFailed: 'Toto sa nepodarilo presunúť.'
      },
      removeModal: {
        label: 'Presunúť do karantény',
        heading: 'Presunúť toto do karantény?',
        note: 'Presunie sa, nezmaže sa — kedykoľvek to obnovte z obrazovky Karanténa.',
        folder: 'Priečinok',
        file: 'Súbor',
        cancel: 'Zrušiť'
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
    },
    diskMap: {
      title: 'Përdorimi i Diskut',
      aggregateCell: (count) => `${count} elemente më të vogla`,
      subtitle: 'Çfarë po përdor hapësirën në këtë disk, dhe ku.',
      fastIndexSummary: (count) => `${count} skedarë dhe dosje u lexuan nga vetë indeksi i diskut.`,
      browsingInstant: 'Shfletimi është i menjëhershëm nga këtu.',
      indexIncomplete: 'Një pjesë e indeksit nuk mund të lexohej, kështu që totalet janë një kufi i poshtëm.',
      scanningDrive: 'Duke skanuar diskun…',
      readingDrive: 'Duke lexuar diskun…',
      rescanButton: 'Riskano diskun (admin)',
      fastScanButton: 'Skanim i shpejtë (admin)',
      loading: {
        heading: 'Duke lexuar çdo dosje nën',
        note: 'Një drejtori në një kohë, që është mënyra e vetme për ta bërë këtë pa qasje administratori. Një disk i tërë mund të zgjasë një minutë dhe mund të mos përfundojë.',
        indexButton: 'Lexo indeksin e diskut në vend të kësaj (admin)'
      },
      driveRootPrompt: {
        heading: 'Lexo të gjithë diskun',
        fastExplain: (path) => `Një skanim i shpejtë lexon vetë indeksin e skedarëve të diskut — çdo skedar në ${path} brenda pak sekondash, saktësisht ashtu siç bën WizTree. Windows lejon një program të lexojë atë indeks vetëm me qasje administratori, kështu që kjo shkakton një kërkesë UAC.`,
        crawlExplain: 'Alternativa kalon nëpër dosje një nga një. Nuk kërkon asnjë leje dhe është mjeti i duhur për një dosje të vetme, por nuk mund të përfundojë një vëllim të tërë: në këtë disk arriti në 4% të asaj që përdoret para se koha të mbaronte, dhe 96% e mbetur shfaqet si e paskanuar në vend të diçkaje të dobishme.',
        crawlButton: 'Kalo nëpër dosje në vend të kësaj'
      },
      scanFailure: (path, error) => `Nuk u skanua dot "${path}": ${error}`,
      fastScanDeclined: 'I paaprovuar — ende po përdor skanimin dosje pas dosjeje.',
      truncated: {
        withCoverage: (measured, used, percent) => `Këtij skanimi i mbaroi koha: matëi ${measured} nga ${used} në përdorim (${percent}%). Ajo që u mat është reale; pjesa tjetër shfaqet si e paskanuar, jo si bosh.`,
        withoutCoverage: 'Këtij skanimi i mbaroi koha para se të përfundonte diskun. Gjithçka që u mat në fakt është reale, por dosjet ku nuk arriti kurrë shfaqen si të paskanuara në vend të bosh — mos e lexoni këtë si një pamje të plotë të asaj që po përdor hapësirën tuaj.',
        rescanLink: 'Ekzekuto në vend të kësaj një skanim të shpejtë'
      },
      view: { tree: 'Pema', files: 'Skedarët' },
      folderTable: {
        empty: 'Asgjë për të listuar brenda kësaj dosjeje.',
        notScanned: 'e paskanuar',
        columns: { folder: 'Dosja', size: 'Madhësia', items: 'Elementet', files: 'Skedarët', folders: 'Dosjet', modified: 'Modifikuar' }
      },
      extensionPanel: {
        header: 'Sipas llojit të skedarit',
        typeCount: (n) => `${n} lloje`,
        noType: 'pa lloj',
        footer: (bytes, count) => `${bytes} në ${count} skedarë`,
        unopenedFolders: (bytes) => ` · ${bytes} në dosje që skanimi nuk i hapi`
      },
      largestFiles: { empty: 'Skanimi nuk gjeti skedarë për të listuar.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} i pamatur`,
        aggregated: 'Hyrjet më të vogla në këtë dosje, të grupuara së bashku.',
        unscanned: 'Skanimi u ndal para se të arrinte këtu. Madhësia reale është e panjohur.'
      },
      cellOpenLabel: (name) => `Hap ${name}`,
      contextMenu: {
        openInExplorer: 'Hap në Explorer',
        copyPath: 'Kopjo shtegun',
        moveToQuarantineMenu: 'Zhvendos në karantinë…'
      },
      toasts: {
        moved: (name) => `U zhvendos në karantinë: ${name}`,
        restoreHint: 'Rikthejeni nga ekrani Karantina.',
        pathCopied: 'Shtegu u kopjua.',
        copyFailed: 'Ai shteg nuk mund të kopjohej.',
        moveFailed: 'Kjo nuk mund të zhvendosej.'
      },
      removeModal: {
        label: 'Zhvendos në karantinë',
        heading: 'Ta zhvendos këtë në karantinë?',
        note: 'Zhvendoset, nuk fshihet — rikthejeni në çdo kohë nga ekrani Karantina.',
        folder: 'Dosja',
        file: 'Skedari',
        cancel: 'Anulo'
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
    },
    diskMap: {
      title: 'Искоришћеност Диска',
      aggregateCell: (count) => `${count} мањих ставки`,
      subtitle: 'Шта користи простор на овом диску, и где.',
      fastIndexSummary: (count) => `${count} датотека и фасцикли прочитано из сопственог индекса диска.`,
      browsingInstant: 'Прегледање одавде је тренутно.',
      indexIncomplete: 'Део индекса није могао да се прочита, па су укупни износи доња граница.',
      scanningDrive: 'Скенирање диска…',
      readingDrive: 'Читање диска…',
      rescanButton: 'Поново скенирај диск (администратор)',
      fastScanButton: 'Брзо скенирање (администратор)',
      loading: {
        heading: 'Читање сваке фасцикле у',
        note: 'По један директоријум одједном, што је једини начин да се то уради без администраторског приступа. Цео диск може потрајати минут и можда се не заврши.',
        indexButton: 'Уместо тога прочитај индекс диска (администратор)'
      },
      driveRootPrompt: {
        heading: 'Прочитај цео диск',
        fastExplain: (path) => `Брзо скенирање чита сопствени индекс датотека диска — сваку датотеку на ${path} за неколико секунди, потпуно исто као што то ради WizTree. Windows дозвољава програму да прочита тај индекс само са администраторским приступом, па се приказује UAC захтев.`,
        crawlExplain: 'Алтернатива пролази кроз фасцикле једну по једну. Не захтева никакву дозволу и права је алатка за једну фасциклу, али не може да заврши читав волумен: на овом диску је досегла 4% онога што се користи пре него што је истекло време, а преосталих 96% се приказује као нескенирано уместо нечег корисног.',
        crawlButton: 'Уместо тога пролази кроз фасцикле'
      },
      scanFailure: (path, error) => `Скенирање „${path}” није успело: ${error}`,
      fastScanDeclined: 'Није одобрено — и даље се користи скенирање фасцикла по фасцикла.',
      truncated: {
        withCoverage: (measured, used, percent) => `Овом скенирању је истекло време: измерило је ${measured} од ${used} који се користе (${percent}%). Оно што је измерено је стварно; остатак се приказује као нескениран, не као празан.`,
        withoutCoverage: 'Овом скенирању је истекло време пре него што је завршило диск. Све што је заиста измерено је стварно, али фасцикле до којих никада није стигло приказују се као нескениране, а не као празне — не читајте ово као потпуну слику онога што користи ваш простор.',
        rescanLink: 'Уместо тога покрени брзо скенирање'
      },
      view: { tree: 'Стабло', files: 'Датотеке' },
      folderTable: {
        empty: 'Нема ништа за приказ у овој фасцикли.',
        notScanned: 'није скенирано',
        columns: { folder: 'Фасцикла', size: 'Величина', items: 'Ставке', files: 'Датотеке', folders: 'Фасцикле', modified: 'Измењено' }
      },
      extensionPanel: {
        header: 'По типу датотеке',
        typeCount: (n) => `${n} типова`,
        noType: 'без типа',
        footer: (bytes, count) => `${bytes} у ${count} датотека`,
        unopenedFolders: (bytes) => ` · ${bytes} у фасциклама које скенирање није отворило`
      },
      largestFiles: { empty: 'Скенирање није пронашло датотеке за приказ.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} није измерено`,
        aggregated: 'Најмање ставке у овој фасцикли, груписане заједно.',
        unscanned: 'Скенирање се зауставило пре него што је стигло овде. Стварна величина је непозната.'
      },
      cellOpenLabel: (name) => `Отвори ${name}`,
      contextMenu: {
        openInExplorer: 'Отвори у Истраживачу',
        copyPath: 'Копирај путању',
        moveToQuarantineMenu: 'Премести у карантин…'
      },
      toasts: {
        moved: (name) => `Премештено у карантин: ${name}`,
        restoreHint: 'Вратите га са екрана Карантин.',
        pathCopied: 'Путања копирана.',
        copyFailed: 'Та путања није могла да се копира.',
        moveFailed: 'Ово није могло да се премести.'
      },
      removeModal: {
        label: 'Премести у карантин',
        heading: 'Преместити ово у карантин?',
        note: 'Премешта се, не брише се — вратите га у било ком тренутку са екрана Карантин.',
        folder: 'Фасцикла',
        file: 'Датотека',
        cancel: 'Откажи'
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
    },
    diskMap: {
      title: 'Diskanvändning',
      aggregateCell: (count) => `${count} mindre objekt`,
      subtitle: 'Vad som använder utrymmet på den här disken, och var.',
      fastIndexSummary: (count) => `${count} filer och mappar lästa från diskens eget register.`,
      browsingInstant: 'Bläddring är direkt härifrån.',
      indexIncomplete: 'En del av registret kunde inte läsas, så totalerna är en undre gräns.',
      scanningDrive: 'Skannar disken…',
      readingDrive: 'Läser disken…',
      rescanButton: 'Skanna disken igen (admin)',
      fastScanButton: 'Snabbskanning (admin)',
      loading: {
        heading: 'Läser varje mapp under',
        note: 'En katalog i taget, vilket är det enda sättet att göra det utan administratörsåtkomst. En hel disk kan ta en minut och kanske inte blir klar.',
        indexButton: 'Läs diskregistret istället (admin)'
      },
      driveRootPrompt: {
        heading: 'Läs hela disken',
        fastExplain: (path) => `En snabbskanning läser diskens eget filregister — varje fil på ${path} på några sekunder, precis som WizTree gör. Windows låter bara ett program läsa det registret med administratörsåtkomst, så detta utlöser en UAC-fråga.`,
        crawlExplain: 'Alternativet går igenom mappar en i taget. Det kräver ingen behörighet och är rätt verktyg för en enda mapp, men kan inte slutföra en hel volym: på den här disken nådde den 4 % av det som används innan tiden tog slut, och de återstående 96 % visas som oskannat i stället för något användbart.',
        crawlButton: 'Gå igenom mappar istället'
      },
      scanFailure: (path, error) => `Kunde inte skanna "${path}": ${error}`,
      fastScanDeclined: 'Ej godkänt — använder fortfarande mapp-för-mapp-skanning.',
      truncated: {
        withCoverage: (measured, used, percent) => `Denna skanning fick slut på tid: den mätte ${measured} av de ${used} som används (${percent} %). Det som mättes är verkligt; resten visas som oskannat, inte som tomt.`,
        withoutCoverage: 'Denna skanning fick slut på tid innan den slutförde disken. Allt den faktiskt mätte är verkligt, men mappar den aldrig nådde visas som oskannade i stället för tomma — läs inte detta som en fullständig bild av vad som använder ditt utrymme.',
        rescanLink: 'Kör en snabbskanning istället'
      },
      view: { tree: 'Träd', files: 'Filer' },
      folderTable: {
        empty: 'Inget att visa i den här mappen.',
        notScanned: 'ej skannad',
        columns: { folder: 'Mapp', size: 'Storlek', items: 'Objekt', files: 'Filer', folders: 'Mappar', modified: 'Ändrad' }
      },
      extensionPanel: {
        header: 'Efter filtyp',
        typeCount: (n) => `${n} typer`,
        noType: 'ingen typ',
        footer: (bytes, count) => `${bytes} fördelat på ${count} filer`,
        unopenedFolders: (bytes) => ` · ${bytes} i mappar skanningen inte öppnade`
      },
      largestFiles: { empty: 'Skanningen hittade inga filer att visa.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} ej uppmätt`,
        aggregated: 'De minsta posterna i den här mappen, grupperade.',
        unscanned: 'Skanningen stoppade innan den nådde hit. Den verkliga storleken är okänd.'
      },
      cellOpenLabel: (name) => `Öppna ${name}`,
      contextMenu: {
        openInExplorer: 'Öppna i Utforskaren',
        copyPath: 'Kopiera sökväg',
        moveToQuarantineMenu: 'Flytta till karantän…'
      },
      toasts: {
        moved: (name) => `Flyttad till karantän: ${name}`,
        restoreHint: 'Återställ den från skärmen Karantän.',
        pathCopied: 'Sökväg kopierad.',
        copyFailed: 'Den sökvägen kunde inte kopieras.',
        moveFailed: 'Detta kunde inte flyttas.'
      },
      removeModal: {
        label: 'Flytta till karantän',
        heading: 'Flytta detta till karantän?',
        note: 'Den flyttas, tas inte bort — återställ den när som helst från skärmen Karantän.',
        folder: 'Mapp',
        file: 'Fil',
        cancel: 'Avbryt'
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
    },
    diskMap: {
      title: 'การใช้งานดิสก์',
      aggregateCell: (count) => `${count} รายการที่เล็กกว่า`,
      subtitle: 'อะไรกำลังใช้พื้นที่ในดิสก์นี้ และที่ไหน',
      fastIndexSummary: (count) => `อ่านไฟล์และโฟลเดอร์ ${count} รายการจากดัชนีของไดรฟ์เอง`,
      browsingInstant: 'การเรียกดูจากที่นี่จะทำได้ทันที',
      indexIncomplete: 'ไม่สามารถอ่านดัชนีบางส่วนได้ ดังนั้นตัวเลขรวมจึงเป็นค่าต่ำสุด',
      scanningDrive: 'กำลังสแกนไดรฟ์…',
      readingDrive: 'กำลังอ่านไดรฟ์…',
      rescanButton: 'สแกนไดรฟ์อีกครั้ง (ผู้ดูแลระบบ)',
      fastScanButton: 'สแกนแบบเร็ว (ผู้ดูแลระบบ)',
      loading: {
        heading: 'กำลังอ่านทุกโฟลเดอร์ภายใต้',
        note: 'ทีละไดเรกทอรี ซึ่งเป็นวิธีเดียวที่ทำได้โดยไม่ต้องใช้สิทธิ์ผู้ดูแลระบบ ไดรฟ์ทั้งหมดอาจใช้เวลาหนึ่งนาทีและอาจไม่เสร็จสมบูรณ์',
        indexButton: 'อ่านดัชนีไดรฟ์แทน (ผู้ดูแลระบบ)'
      },
      driveRootPrompt: {
        heading: 'อ่านทั้งไดรฟ์',
        fastExplain: (path) => `การสแกนแบบเร็วจะอ่านดัชนีไฟล์ของไดรฟ์เอง — ทุกไฟล์ใน ${path} ภายในไม่กี่วินาที เช่นเดียวกับที่ WizTree ทำ Windows อนุญาตให้โปรแกรมอ่านดัชนีนั้นได้ก็ต่อเมื่อมีสิทธิ์ผู้ดูแลระบบเท่านั้น จึงทำให้เกิดการแจ้งเตือน UAC`,
        crawlExplain: 'อีกวิธีหนึ่งคือไล่ดูโฟลเดอร์ทีละรายการ ไม่ต้องขออนุญาตใด ๆ และเหมาะสำหรับโฟลเดอร์เดียว แต่ไม่สามารถสแกนไดรฟ์ทั้งหมดให้เสร็จได้ — บนไดรฟ์นี้มันเข้าถึงได้เพียง 4% ของพื้นที่ที่ใช้งานก่อนที่เวลาจะหมด และอีก 96% ที่เหลือจะแสดงเป็นยังไม่ได้สแกนแทนที่จะเป็นข้อมูลที่มีประโยชน์',
        crawlButton: 'ไล่ดูโฟลเดอร์แทน'
      },
      scanFailure: (path, error) => `ไม่สามารถสแกน "${path}" ได้: ${error}`,
      fastScanDeclined: 'ไม่ได้รับการอนุมัติ — ยังคงใช้การสแกนแบบทีละโฟลเดอร์',
      truncated: {
        withCoverage: (measured, used, percent) => `การสแกนนี้หมดเวลา: วัดได้ ${measured} จากทั้งหมด ${used} ที่ใช้งาน (${percent}%) สิ่งที่วัดได้นั้นเป็นจริง ส่วนที่เหลือแสดงเป็นยังไม่ได้สแกน ไม่ใช่ว่างเปล่า`,
        withoutCoverage: 'การสแกนนี้หมดเวลาก่อนที่จะสแกนดิสก์เสร็จสมบูรณ์ สิ่งที่วัดได้จริงทั้งหมดเป็นข้อมูลจริง แต่โฟลเดอร์ที่ไม่เคยเข้าถึงจะแสดงเป็นยังไม่ได้สแกนแทนที่จะเป็นว่างเปล่า — อย่าตีความสิ่งนี้ว่าเป็นภาพรวมที่สมบูรณ์ของสิ่งที่ใช้พื้นที่ของคุณ',
        rescanLink: 'เรียกใช้การสแกนแบบเร็วแทน'
      },
      view: { tree: 'ผังต้นไม้', files: 'ไฟล์' },
      folderTable: {
        empty: 'ไม่มีอะไรให้แสดงในโฟลเดอร์นี้',
        notScanned: 'ยังไม่ได้สแกน',
        columns: { folder: 'โฟลเดอร์', size: 'ขนาด', items: 'รายการ', files: 'ไฟล์', folders: 'โฟลเดอร์', modified: 'แก้ไขล่าสุด' }
      },
      extensionPanel: {
        header: 'ตามประเภทไฟล์',
        typeCount: (n) => `${n} ประเภท`,
        noType: 'ไม่มีประเภท',
        footer: (bytes, count) => `${bytes} ใน ${count} ไฟล์`,
        unopenedFolders: (bytes) => ` · ${bytes} ในโฟลเดอร์ที่การสแกนไม่ได้เปิด`
      },
      largestFiles: { empty: 'การสแกนไม่พบไฟล์ให้แสดง' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} ยังไม่ได้วัด`,
        aggregated: 'รายการที่เล็กที่สุดในโฟลเดอร์นี้ ถูกจัดกลุ่มเข้าด้วยกัน',
        unscanned: 'การสแกนหยุดก่อนที่จะไปถึงจุดนี้ ขนาดจริงไม่ทราบแน่ชัด'
      },
      cellOpenLabel: (name) => `เปิด ${name}`,
      contextMenu: {
        openInExplorer: 'เปิดใน File Explorer',
        copyPath: 'คัดลอกเส้นทาง',
        moveToQuarantineMenu: 'ย้ายไปยังกักกัน…'
      },
      toasts: {
        moved: (name) => `ย้ายไปยังกักกันแล้ว: ${name}`,
        restoreHint: 'กู้คืนได้จากหน้าจอกักกัน',
        pathCopied: 'คัดลอกเส้นทางแล้ว',
        copyFailed: 'ไม่สามารถคัดลอกเส้นทางนั้นได้',
        moveFailed: 'ไม่สามารถย้ายรายการนี้ได้'
      },
      removeModal: {
        label: 'ย้ายไปยังกักกัน',
        heading: 'ย้ายรายการนี้ไปยังกักกันหรือไม่?',
        note: 'รายการจะถูกย้าย ไม่ใช่ลบ — กู้คืนได้ทุกเมื่อจากหน้าจอกักกัน',
        folder: 'โฟลเดอร์',
        file: 'ไฟล์',
        cancel: 'ยกเลิก'
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
    },
    diskMap: {
      title: 'Disk Kullanımı',
      aggregateCell: (count) => `${count} daha küçük öğe`,
      subtitle: 'Bu diskte alanı neyin kullandığı ve nerede.',
      fastIndexSummary: (count) => `Diskin kendi dizininden ${count} dosya ve klasör okundu.`,
      browsingInstant: 'Buradan itibaren gezinme aninde gerçekleşir.',
      indexIncomplete: 'Dizinin bir kısmı okunamadı, bu nedenle toplamlar bir alt sınırdır.',
      scanningDrive: 'Disk taranıyor…',
      readingDrive: 'Disk okunuyor…',
      rescanButton: 'Diski yeniden tara (yönetici)',
      fastScanButton: 'Hızlı tarama (yönetici)',
      loading: {
        heading: 'Altındaki her klasör okunuyor',
        note: 'Yönetici erişimi olmadan bunu yapmanın tek yolu olan, seferde bir dizin. Tüm bir disk bir dakika sürebilir ve tamamlanmayabilir.',
        indexButton: 'Bunun yerine disk dizinini oku (yönetici)'
      },
      driveRootPrompt: {
        heading: 'Tüm diski oku',
        fastExplain: (path) => `Hızlı tarama, diskin kendi dosya dizinini okur — WizTree'nin yaptığı gibi, ${path} üzerindeki her dosyayı birkaç saniyede. Windows, bir programın bu dizini okumasına yalnızca yönetici erişimiyle izin verir, bu yüzden bu bir UAC istemi tetikler.`,
        crawlExplain: "Alternatif, klasörleri tek tek gezer. Herhangi bir izin gerektirmez ve tek bir klasör için doğru araçtır, ancak tüm bir birimi tamamlayamaz: bu diskte, süre dolmadan önce kullanılan alanın %4'üne ulaştı ve kalan %96 kullanışlı bir şey yerine taranmamış olarak gösterilir.",
        crawlButton: 'Bunun yerine klasörleri gez'
      },
      scanFailure: (path, error) => `"${path}" taranamadı: ${error}`,
      fastScanDeclined: 'Onaylanmadı — hâlâ klasör klasör tarama kullanılıyor.',
      truncated: {
        withCoverage: (measured, used, percent) => `Bu taramanın süresi doldu: kullanılan ${used} miktarının ${measured} kadarını ölçtü (%${percent}). Ölçülen kısım gerçek; geri kalanı boş yerine taranmamış olarak gösterilir.`,
        withoutCoverage: 'Bu taramanın süresi diski tamamlamadan doldu. Gerçekten ölçtüğü her şey gerçek, ancak hiç ulaşamadığı klasörler boş yerine taranmamış olarak gösterilir — bunu alanınızı neyin kullandığının eksiksiz bir görüntüsü olarak okumayın.',
        rescanLink: 'Bunun yerine hızlı bir tarama çalıştır'
      },
      view: { tree: 'Ağaç', files: 'Dosyalar' },
      folderTable: {
        empty: 'Bu klasörün içinde listelenecek bir şey yok.',
        notScanned: 'taranmadı',
        columns: { folder: 'Klasör', size: 'Boyut', items: 'Öğeler', files: 'Dosyalar', folders: 'Klasörler', modified: 'Değiştirildi' }
      },
      extensionPanel: {
        header: 'Dosya türüne göre',
        typeCount: (n) => `${n} tür`,
        noType: 'tür yok',
        footer: (bytes, count) => `${count} dosyada ${bytes}`,
        unopenedFolders: (bytes) => ` · taramanın açmadığı klasörlerde ${bytes}`
      },
      largestFiles: { empty: 'Tarama listelenecek dosya bulamadı.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} ölçülmedi`,
        aggregated: 'Bu klasördeki en küçük girdiler, bir araya toplanmış.',
        unscanned: 'Tarama buraya ulaşmadan önce durdu. Gerçek boyutu bilinmiyor.'
      },
      cellOpenLabel: (name) => `${name} öğesini aç`,
      contextMenu: {
        openInExplorer: "Explorer'da Aç",
        copyPath: 'Yolu kopyala',
        moveToQuarantineMenu: 'Karantinaya taşı…'
      },
      toasts: {
        moved: (name) => `Karantinaya taşındı: ${name}`,
        restoreHint: 'Karantina ekranından geri yükleyin.',
        pathCopied: 'Yol kopyalandı.',
        copyFailed: 'Bu yol kopyalanamadı.',
        moveFailed: 'Bu taşınamadı.'
      },
      removeModal: {
        label: 'Karantinaya taşı',
        heading: 'Bu karantinaya taşınsın mı?',
        note: 'Silinmez, taşınır — istediğiniz zaman Karantina ekranından geri yükleyebilirsiniz.',
        folder: 'Klasör',
        file: 'Dosya',
        cancel: 'İptal'
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
    },
    diskMap: {
      title: 'Використання Диска',
      aggregateCell: (count) => `${count} менших елементів`,
      subtitle: 'Що використовує місце на цьому диску, і де.',
      fastIndexSummary: (count) => `${count} файлів і папок прочитано з власного індексу диска.`,
      browsingInstant: 'Перегляд звідси відбувається миттєво.',
      indexIncomplete: 'Частину індексу не вдалося прочитати, тому підсумки є нижньою межею.',
      scanningDrive: 'Сканування диска…',
      readingDrive: 'Читання диска…',
      rescanButton: 'Повторно сканувати диск (адміністратор)',
      fastScanButton: 'Швидке сканування (адміністратор)',
      loading: {
        heading: 'Читання кожної папки в',
        note: 'По одному каталогу за раз — це єдиний спосіб зробити це без прав адміністратора. Весь диск може зайняти хвилину і може не завершитися.',
        indexButton: 'Замість цього прочитати індекс диска (адміністратор)'
      },
      driveRootPrompt: {
        heading: 'Прочитати весь диск',
        fastExplain: (path) => `Швидке сканування читає власний файловий індекс диска — кожен файл у ${path} за кілька секунд, так само як це робить WizTree. Windows дозволяє програмі читати цей індекс лише з правами адміністратора, тому це викликає запит UAC.`,
        crawlExplain: 'Альтернатива обходить папки по одній. Вона не потребує жодного дозволу і є правильним інструментом для однієї папки, але не може завершити весь том: на цьому диску вона досягла 4% використаного простору до закінчення часу, а решта 96% відображаються як несканований, а не як щось корисне.',
        crawlButton: 'Замість цього обійти папки'
      },
      scanFailure: (path, error) => `Не вдалося сканувати «${path}»: ${error}`,
      fastScanDeclined: 'Не підтверджено — досі використовується сканування папка за папкою.',
      truncated: {
        withCoverage: (measured, used, percent) => `У цього сканування закінчився час: воно виміряло ${measured} з ${used} використаних (${percent}%). Те, що виміряно, реальне; решта відображається як несканована, а не як порожня.`,
        withoutCoverage: 'У цього сканування закінчився час до завершення диска. Усе, що фактично виміряно, реальне, але папки, яких воно так і не досягло, відображаються як несканований, а не порожні — не сприймайте це як повну картину того, що займає ваш простір.',
        rescanLink: 'Замість цього запустити швидке сканування'
      },
      view: { tree: 'Дерево', files: 'Файли' },
      folderTable: {
        empty: 'У цій папці немає чого перелічувати.',
        notScanned: 'не скановано',
        columns: { folder: 'Папка', size: 'Розмір', items: 'Елементи', files: 'Файли', folders: 'Папки', modified: 'Змінено' }
      },
      extensionPanel: {
        header: 'За типом файлу',
        typeCount: (n) => `${n} типів`,
        noType: 'без типу',
        footer: (bytes, count) => `${bytes} у ${count} файлах`,
        unopenedFolders: (bytes) => ` · ${bytes} у папках, які сканування не відкрило`
      },
      largestFiles: { empty: 'Сканування не знайшло файлів для відображення.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} не виміряно`,
        aggregated: 'Найменші записи цієї папки, згруповані разом.',
        unscanned: 'Сканування зупинилося до досягнення цього місця. Реальний розмір невідомий.'
      },
      cellOpenLabel: (name) => `Відкрити ${name}`,
      contextMenu: {
        openInExplorer: 'Відкрити в Провіднику',
        copyPath: 'Копіювати шлях',
        moveToQuarantineMenu: 'Перемістити в карантин…'
      },
      toasts: {
        moved: (name) => `Переміщено в карантин: ${name}`,
        restoreHint: 'Відновіть його з екрана Карантин.',
        pathCopied: 'Шлях скопійовано.',
        copyFailed: 'Не вдалося скопіювати цей шлях.',
        moveFailed: 'Не вдалося перемістити це.'
      },
      removeModal: {
        label: 'Перемістити в карантин',
        heading: 'Перемістити це в карантин?',
        note: 'Це переміщується, а не видаляється — відновіть у будь-який час з екрана Карантин.',
        folder: 'Папка',
        file: 'Файл',
        cancel: 'Скасувати'
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
    },
    diskMap: {
      title: 'Mức Sử Dụng Ổ Đĩa',
      aggregateCell: (count) => `${count} mục nhỏ hơn`,
      subtitle: 'Cái gì đang chiếm dụng không gian trên ổ đĩa này, và ở đâu.',
      fastIndexSummary: (count) => `${count} tệp và thư mục đã được đọc từ chỉ mục riêng của ổ đĩa.`,
      browsingInstant: 'Việc duyệt từ đây diễn ra tức thì.',
      indexIncomplete: 'Một phần chỉ mục không thể đọc được, vì vậy tổng số là mức tối thiểu.',
      scanningDrive: 'Đang quét ổ đĩa…',
      readingDrive: 'Đang đọc ổ đĩa…',
      rescanButton: 'Quét lại ổ đĩa (quản trị viên)',
      fastScanButton: 'Quét nhanh (quản trị viên)',
      loading: {
        heading: 'Đang đọc mọi thư mục bên dưới',
        note: 'Mỗi lần một thư mục, đây là cách duy nhất để thực hiện việc này mà không cần quyền quản trị viên. Toàn bộ ổ đĩa có thể mất một phút và có thể không hoàn tất.',
        indexButton: 'Thay vào đó, đọc chỉ mục ổ đĩa (quản trị viên)'
      },
      driveRootPrompt: {
        heading: 'Đọc toàn bộ ổ đĩa',
        fastExplain: (path) => `Quét nhanh sẽ đọc chỉ mục tệp riêng của ổ đĩa — mọi tệp trên ${path} chỉ trong vài giây, giống hệt như cách WizTree thực hiện. Windows chỉ cho phép chương trình đọc chỉ mục đó với quyền quản trị viên, do đó việc này sẽ kích hoạt yêu cầu UAC.`,
        crawlExplain: 'Phương án thay thế sẽ duyệt qua từng thư mục một. Nó không cần bất kỳ quyền nào và là công cụ phù hợp cho một thư mục đơn lẻ, nhưng không thể hoàn tất toàn bộ một ổ đĩa: trên ổ đĩa này, nó đạt tới 4% dung lượng đang sử dụng trước khi hết thời gian, và 96% còn lại được hiển thị là chưa quét thay vì một điều gì đó hữu ích.',
        crawlButton: 'Thay vào đó, duyệt qua các thư mục'
      },
      scanFailure: (path, error) => `Không thể quét "${path}": ${error}`,
      fastScanDeclined: 'Không được phê duyệt — vẫn đang sử dụng phương pháp quét từng thư mục.',
      truncated: {
        withCoverage: (measured, used, percent) => `Lần quét này đã hết thời gian: đã đo được ${measured} trong tổng số ${used} đang sử dụng (${percent}%). Những gì đã đo được là thật; phần còn lại được hiển thị là chưa quét, chứ không phải trống.`,
        withoutCoverage: 'Lần quét này đã hết thời gian trước khi hoàn tất ổ đĩa. Mọi thứ nó thực sự đo được đều là thật, nhưng các thư mục nó chưa từng chạm tới được hiển thị là chưa quét thay vì trống — đừng coi đây là bức tranh đầy đủ về những gì đang chiếm dụng không gian của bạn.',
        rescanLink: 'Thay vào đó, chạy một lần quét nhanh'
      },
      view: { tree: 'Cây', files: 'Tệp' },
      folderTable: {
        empty: 'Không có gì để liệt kê trong thư mục này.',
        notScanned: 'chưa quét',
        columns: { folder: 'Thư mục', size: 'Kích thước', items: 'Mục', files: 'Tệp', folders: 'Thư mục', modified: 'Đã sửa đổi' }
      },
      extensionPanel: {
        header: 'Theo loại tệp',
        typeCount: (n) => `${n} loại`,
        noType: 'không có loại',
        footer: (bytes, count) => `${bytes} trên ${count} tệp`,
        unopenedFolders: (bytes) => ` · ${bytes} trong các thư mục mà quá trình quét chưa mở`
      },
      largestFiles: { empty: 'Quá trình quét không tìm thấy tệp nào để liệt kê.' },
      tooltip: {
        notMeasured: (bytes) => `${bytes} chưa đo`,
        aggregated: 'Các mục nhỏ nhất trong thư mục này, được nhóm lại với nhau.',
        unscanned: 'Quá trình quét đã dừng trước khi đến đây. Kích thước thực tế không xác định.'
      },
      cellOpenLabel: (name) => `Mở ${name}`,
      contextMenu: {
        openInExplorer: 'Mở trong Explorer',
        copyPath: 'Sao chép đường dẫn',
        moveToQuarantineMenu: 'Chuyển vào khu cách ly…'
      },
      toasts: {
        moved: (name) => `Đã chuyển vào khu cách ly: ${name}`,
        restoreHint: 'Khôi phục từ màn hình Cách ly.',
        pathCopied: 'Đã sao chép đường dẫn.',
        copyFailed: 'Không thể sao chép đường dẫn đó.',
        moveFailed: 'Không thể di chuyển mục này.'
      },
      removeModal: {
        label: 'Chuyển vào khu cách ly',
        heading: 'Chuyển mục này vào khu cách ly?',
        note: 'Mục này được di chuyển, không bị xóa — khôi phục bất cứ lúc nào từ màn hình Cách ly.',
        folder: 'Thư mục',
        file: 'Tệp',
        cancel: 'Hủy'
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
    },
    diskMap: {
      title: '磁盘使用情况',
      aggregateCell: (count) => `${count} 个较小的项目`,
      subtitle: '什么在占用此磁盘上的空间，以及在哪里。',
      fastIndexSummary: (count) => `已从驱动器自身的索引中读取 ${count} 个文件和文件夹。`,
      browsingInstant: '从这里浏览是即时的。',
      indexIncomplete: '部分索引无法读取，因此总计为下限值。',
      scanningDrive: '正在扫描驱动器…',
      readingDrive: '正在读取驱动器…',
      rescanButton: '重新扫描驱动器（管理员）',
      fastScanButton: '快速扫描（管理员）',
      loading: {
        heading: '正在读取以下路径中的每个文件夹',
        note: '一次读取一个目录，这是在没有管理员权限的情况下完成此操作的唯一方法。整个驱动器可能需要一分钟，也可能无法完成。',
        indexButton: '改为读取驱动器索引（管理员）'
      },
      driveRootPrompt: {
        heading: '读取整个驱动器',
        fastExplain: (path) => `快速扫描会读取驱动器自身的文件索引 — 几秒钟内读取 ${path} 上的每个文件，方式与 WizTree 完全相同。Windows 只允许具有管理员权限的程序读取该索引，因此这会触发 UAC 提示。`,
        crawlExplain: '另一种方式是逐个遍历文件夹。它不需要任何权限，是处理单个文件夹的正确工具，但无法完成整个卷的扫描：在此驱动器上，它在时间耗尽前只处理了已用空间的 4%，其余 96% 显示为未扫描，而不是任何有用的信息。',
        crawlButton: '改为遍历文件夹'
      },
      scanFailure: (path, error) => `无法扫描"${path}"：${error}`,
      fastScanDeclined: '未获批准 — 仍在使用逐个文件夹扫描。',
      truncated: {
        withCoverage: (measured, used, percent) => `此次扫描已超时：已测量已用 ${used} 中的 ${measured}（${percent}%）。已测量的部分是真实的；其余部分显示为未扫描，而不是空的。`,
        withoutCoverage: '此次扫描在完成整个驱动器之前已超时。实际测量到的所有内容都是真实的，但从未到达的文件夹显示为未扫描，而不是空的 — 请勿将此视为占用空间情况的完整画面。',
        rescanLink: '改为运行快速扫描'
      },
      view: { tree: '树状图', files: '文件' },
      folderTable: {
        empty: '此文件夹内没有可列出的内容。',
        notScanned: '未扫描',
        columns: { folder: '文件夹', size: '大小', items: '项目', files: '文件', folders: '文件夹', modified: '修改日期' }
      },
      extensionPanel: {
        header: '按文件类型',
        typeCount: (n) => `${n} 种类型`,
        noType: '无类型',
        footer: (bytes, count) => `共 ${count} 个文件，${bytes}`,
        unopenedFolders: (bytes) => ` · 扫描未打开的文件夹中有 ${bytes}`
      },
      largestFiles: { empty: '扫描未找到可列出的文件。' },
      tooltip: {
        notMeasured: (bytes) => `${bytes}（未测量）`,
        aggregated: '此文件夹中最小的条目，已归为一组。',
        unscanned: '扫描在到达此处之前已停止。实际大小未知。'
      },
      cellOpenLabel: (name) => `打开 ${name}`,
      contextMenu: {
        openInExplorer: '在资源管理器中打开',
        copyPath: '复制路径',
        moveToQuarantineMenu: '移至隔离区…'
      },
      toasts: {
        moved: (name) => `已移至隔离区：${name}`,
        restoreHint: '请从隔离区界面还原。',
        pathCopied: '路径已复制。',
        copyFailed: '无法复制该路径。',
        moveFailed: '无法移动此项。'
      },
      removeModal: {
        label: '移至隔离区',
        heading: '要将其移至隔离区吗？',
        note: '此操作是移动而非删除 — 可随时从隔离区界面还原。',
        folder: '文件夹',
        file: '文件',
        cancel: '取消'
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
    },
    diskMap: {
      title: '磁碟使用狀況',
      aggregateCell: (count) => `${count} 個較小的項目`,
      subtitle: '什麼正在佔用這個磁碟上的空間，以及在哪裡。',
      fastIndexSummary: (count) => `已從硬碟自身的索引中讀取 ${count} 個檔案與資料夾。`,
      browsingInstant: '從這裡瀏覽是即時的。',
      indexIncomplete: '部分索引無法讀取，因此總計為下限值。',
      scanningDrive: '正在掃描硬碟…',
      readingDrive: '正在讀取硬碟…',
      rescanButton: '重新掃描硬碟（系統管理員）',
      fastScanButton: '快速掃描（系統管理員）',
      loading: {
        heading: '正在讀取以下路徑中的每個資料夾',
        note: '一次讀取一個目錄，這是在沒有系統管理員權限的情況下完成此作業的唯一方法。整個硬碟可能需要一分鐘，也可能無法完成。',
        indexButton: '改為讀取硬碟索引（系統管理員）'
      },
      driveRootPrompt: {
        heading: '讀取整個硬碟',
        fastExplain: (path) => `快速掃描會讀取硬碟自身的檔案索引 — 幾秒鐘內讀取 ${path} 上的每個檔案，方式與 WizTree 完全相同。Windows 只允許具有系統管理員權限的程式讀取該索引，因此這會觸發 UAC 提示。`,
        crawlExplain: '另一種方式是逐一走訪資料夾。它不需要任何權限，是處理單一資料夾的正確工具，但無法完成整個磁碟區的掃描：在這個硬碟上，它在時間耗盡前只處理了已用空間的 4%，其餘 96% 顯示為未掃描，而不是任何有用的資訊。',
        crawlButton: '改為走訪資料夾'
      },
      scanFailure: (path, error) => `無法掃描「${path}」：${error}`,
      fastScanDeclined: '未獲核准 — 仍在使用逐一資料夾掃描。',
      truncated: {
        withCoverage: (measured, used, percent) => `這次掃描已逾時：已測量已用 ${used} 中的 ${measured}（${percent}%）。已測量的部分是真實的；其餘部分顯示為未掃描，而非空白。`,
        withoutCoverage: '這次掃描在完成整個硬碟之前已逾時。實際測量到的所有內容都是真實的，但從未到達的資料夾顯示為未掃描，而非空白 — 請勿將此視為佔用空間狀況的完整畫面。',
        rescanLink: '改為執行快速掃描'
      },
      view: { tree: '樹狀圖', files: '檔案' },
      folderTable: {
        empty: '此資料夾內沒有可列出的內容。',
        notScanned: '未掃描',
        columns: { folder: '資料夾', size: '大小', items: '項目', files: '檔案', folders: '資料夾', modified: '修改日期' }
      },
      extensionPanel: {
        header: '依檔案類型',
        typeCount: (n) => `${n} 種類型`,
        noType: '無類型',
        footer: (bytes, count) => `共 ${count} 個檔案，${bytes}`,
        unopenedFolders: (bytes) => ` · 掃描未開啟的資料夾中有 ${bytes}`
      },
      largestFiles: { empty: '掃描未找到可列出的檔案。' },
      tooltip: {
        notMeasured: (bytes) => `${bytes}（未測量）`,
        aggregated: '此資料夾中最小的項目，已歸為一組。',
        unscanned: '掃描在到達此處之前已停止。實際大小未知。'
      },
      cellOpenLabel: (name) => `開啟 ${name}`,
      contextMenu: {
        openInExplorer: '在檔案總管中開啟',
        copyPath: '複製路徑',
        moveToQuarantineMenu: '移至隔離區…'
      },
      toasts: {
        moved: (name) => `已移至隔離區：${name}`,
        restoreHint: '請從隔離區畫面還原。',
        pathCopied: '路徑已複製。',
        copyFailed: '無法複製該路徑。',
        moveFailed: '無法移動此項目。'
      },
      removeModal: {
        label: '移至隔離區',
        heading: '要將此項目移至隔離區嗎？',
        note: '此操作是移動而非刪除 — 可隨時從隔離區畫面還原。',
        folder: '資料夾',
        file: '檔案',
        cancel: '取消'
      }
    }
  }
};
