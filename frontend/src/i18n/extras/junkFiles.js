// Deep Clean's Junk files scan (components/JunkFilesDialog.jsx) and its pattern list in
// Settings -> Cleanup (components/JunkPatternsSettings.jsx), all 40 languages:
// { en: { junkFiles: {...} }, af: ... }. Merged into the catalog by ../catalog.js.
// Pattern descriptions are keyed by name (tmp, tilde, chk ...) rather than by the pattern
// itself: catalog keys cannot hold its dots and stars -- see lib/junkFiles.js.
/** English counts that read 1 as singular. Counts arrive already formatted ("1,234"). */
const one = (n) => String(n) === '1';

export default {
  en: {
    junkFiles: {
      open: 'Junk files',
      title: 'Junk files',
      intro: 'Finds leftover temporary files, caches and backups by name on the drives and folders you choose, using the patterns in Settings › Cleanup. Nothing is removed until you tick it and confirm.',
      where: 'Where to look',
      folderPlaceholder: 'Add a folder, e.g. D:\\Downloads',
      folderAria: 'Folder to search',
      addFolder: 'Add',
      foldersLabel: 'Folders to search',
      removeFolder: (path) => `Remove ${path}`,
      lookingFor: 'Looking for',
      editPatterns: 'Edit patterns',
      scan: 'Scan',
      scanAgain: 'Scan again',
      noPlaces: 'Pick a drive or add a folder.',
      progress: (entries, found) => `Searched ${entries} ${one(entries) ? 'item' : 'items'} · ${found} found`,
      idle: 'Scanning removes nothing. Files appear here as they are found.',
      empty: 'No junk files found there.',
      stoppedEmpty: 'Stopped before anything was found.',
      found: (count, size) => `${count} ${one(count) ? 'file' : 'files'} · ${size}`,
      stopped: 'Stopped: these were found before that.',
      skipped: {
        lead: (n) => `${n} more matching ${one(n) ? 'file was' : 'files were'} left alone:`,
        recent: (n, hours) => `${n} changed in the last ${hours} hours`,
        protected: (n) => `${n} in protected places`,
        excluded: (n) => `${n} excluded in Settings`,
        executable: (n) => `${n} ${one(n) ? 'program or system file' : 'programs or system files'}`,
        folders: (n) => `${n} protected or excluded ${one(n) ? 'folder was' : 'folders were'} not searched: Windows, Program Files, installed programs' own folders and your exclusions.`
      },
      truncated: 'The scan reached its limit before it finished. What it found is real; there may be more.',
      truncatedMatches: 'Only the first 20,000 matches are listed. Scan a smaller folder to see the rest.',
      unreadable: (path) => `Windows would not let Prune look inside ${path}.`,
      refusedRoot: {
        missing: (p) => `${p} is not a folder that exists, so it was skipped.`,
        relative: (p) => `${p} is not a full path, so it was skipped.`,
        climb: (p) => `${p} uses "..", so it was skipped.`,
        protected: (p) => `${p} is a protected place and is never searched.`
      },
      group: {
        tickAll: (pattern) => `Tick every ${pattern} file`,
        showAll: (n) => `Show all ${n}`,
        showFewer: 'Show fewer'
      },
      describe: {
        tmp: 'Temporary files',
        temp: 'Temporary files',
        tilde: 'Office owner files and other ~ files',
        tildeExt: 'Editor backup copies',
        chk: 'chkdsk fragments in FOUND folders',
        old: 'Old versions set aside',
        gid: 'Windows help index caches',
        dmp: 'Crash dumps',
        thumbs: 'Old thumbnail caches',
        bak: 'Backups, often kept on purpose',
        log: 'Log files'
      },
      openFolder: (name) => `Open the folder holding ${name}`,
      selected: (n, size) => `${n} selected · ${size}`,
      removeButton: { quarantine: 'Move to Quarantine', recycle: 'Move to Recycle Bin', delete: 'Delete' },
      confirm: {
        quarantine: (n, size) => `Move ${n} ${one(n) ? 'file' : 'files'} (${size}) to Quarantine? You can put ${one(n) ? 'it' : 'them'} back from Quarantine.`,
        recycle: (n, size) => `Move ${n} ${one(n) ? 'file' : 'files'} (${size}) to the Recycle Bin? You can put ${one(n) ? 'it' : 'them'} back from there.`,
        delete: (n, size) => `Delete ${n} ${one(n) ? 'file' : 'files'} (${size}) for good? This cannot be undone.`
      },
      removing: 'Removing…',
      close: 'Close',
      toast: {
        removed: (n) => `Removed ${n} junk ${one(n) ? 'file' : 'files'}.`,
        kept: (n) => `${n} ${one(n) ? 'file was left where it is' : 'files were left where they are'}.`,
        keptDetail: 'They were in use, changed since the scan, or no longer count as junk under your settings.'
      },
      errors: {
        noRoots: 'Pick a drive or add a folder.',
        noPatterns: 'No patterns are turned on. Turn some on in Settings › Cleanup.',
        noUsableRoots: 'None of those places can be searched.',
        failed: (m) => `The scan failed: ${m}`,
        removeFailed: (m) => `Nothing was removed: ${m}`
      },
      settings: {
        title: 'Junk file patterns',
        description: "What Deep Clean's Junk files scan looks for. Results of patterns marked Ticked by default start ticked, because those files are only scratch or rebuild themselves; everything else you tick yourself. Programs, libraries and desktop.ini are never offered, whatever the pattern.",
        ariaLabel: 'New junk file pattern',
        formatHint: 'A file name with * for any characters and ? for one, such as *.tmp. Letter case does not matter.',
        empty: 'No patterns. Add one, or reset to the defaults.',
        lookFor: (p) => `Look for ${p}`,
        preselected: 'Ticked by default',
        remove: (p) => `Remove ${p}`,
        reset: 'Reset to defaults',
        resetConfirm: "Replace your list with the defaults? Patterns you added are removed.",
        error: {
          empty: 'Type a pattern first.',
          long: 'That pattern is too long.',
          separator: 'A pattern is a file name, not a folder or a path.',
          invalid: 'That contains a character no file name can have.',
          everything: 'That would match every file.',
          executable: 'Programs, libraries, drivers and installers are never junk.',
          desktopIni: 'That would match desktop.ini, which gives a folder its icon and name.',
          duplicate: 'That pattern is already in the list.',
          tooMany: 'The list is full.',
          failed: (m) => `The change was not saved: ${m}`
        }
      }
    }
  },
  af: {
    junkFiles: {
      open: 'Rommellêers',
      title: 'Rommellêers',
      intro: 'Vind oorblywende tydelike lêers, kasgeheue en rugsteune volgens naam op die aandrywers en vouers wat jy kies, met die patrone in Instellings › Skoonmaak. Niks word verwyder voordat jy dit merk en bevestig nie.',
      where: 'Waar om te soek',
      folderPlaceholder: 'Voeg ’n vouer by, bv. D:\\Downloads',
      folderAria: 'Vouer om te deursoek',
      addFolder: 'Voeg by',
      foldersLabel: 'Vouers om te deursoek',
      removeFolder: (path) => `Verwyder ${path}`,
      lookingFor: 'Soek na',
      editPatterns: 'Wysig patrone',
      scan: 'Skandeer',
      scanAgain: 'Skandeer weer',
      noPlaces: 'Kies ’n aandrywer of voeg ’n vouer by.',
      progress: (entries, found) => `${entries} items deursoek · ${found} gevind`,
      idle: 'Skandering verwyder niks nie. Lêers verskyn hier soos hulle gevind word.',
      empty: 'Geen rommellêers daar gevind nie.',
      stoppedEmpty: 'Gestop voordat iets gevind is.',
      found: (count, size) => `${count} lêers · ${size}`,
      stopped: 'Gestop: hierdie is voor dit gevind.',
      skipped: {
        lead: (n) => `Nog ${n} passende lêers is met rus gelaat:`,
        recent: (n, hours) => `${n} in die afgelope ${hours} uur verander`,
        protected: (n) => `${n} op beskermde plekke`,
        excluded: (n) => `${n} in Instellings uitgesluit`,
        executable: (n) => `${n} programme of stelsellêers`,
        folders: (n) => `${n} beskermde of uitgeslote vouers is nie deursoek nie: Windows, Program Files, geïnstalleerde programme se eie vouers en jou uitsluitings.`
      },
      truncated: 'Die skandering het sy limiet bereik voordat dit klaar was. Wat dit gevind het, is eg; daar kan meer wees.',
      truncatedMatches: 'Net die eerste 20 000 treffers word gelys. Skandeer ’n kleiner vouer om die res te sien.',
      unreadable: (path) => `Windows wou Prune nie binne ${path} laat kyk nie.`,
      refusedRoot: {
        missing: (p) => `${p} is nie ’n vouer wat bestaan nie, dus is dit oorgeslaan.`,
        relative: (p) => `${p} is nie ’n volledige pad nie, dus is dit oorgeslaan.`,
        climb: (p) => `${p} gebruik "..", dus is dit oorgeslaan.`,
        protected: (p) => `${p} is ’n beskermde plek en word nooit deursoek nie.`
      },
      group: {
        tickAll: (pattern) => `Merk elke ${pattern}-lêer`,
        showAll: (n) => `Wys al ${n}`,
        showFewer: 'Wys minder'
      },
      describe: {
        tmp: 'Tydelike lêers',
        temp: 'Tydelike lêers',
        tilde: 'Office-eienaarlêers en ander ~-lêers',
        tildeExt: 'Rugsteunkopieë van redigeerders',
        chk: 'chkdsk-fragmente in FOUND-vouers',
        old: 'Ou weergawes wat opsy gesit is',
        gid: 'Windows-hulpindekskas',
        dmp: 'Omvalstortings',
        thumbs: 'Ou duimnaelkas',
        bak: 'Rugsteune, dikwels doelbewus gehou',
        log: 'Loglêers'
      },
      openFolder: (name) => `Open die vouer met ${name}`,
      selected: (n, size) => `${n} gekies · ${size}`,
      removeButton: { quarantine: 'Skuif na Karantyn', recycle: 'Skuif na die Asblik', delete: 'Skrap' },
      confirm: {
        quarantine: (n, size) => `Skuif ${n} lêers (${size}) na Karantyn? Jy kan hulle uit Karantyn terugsit.`,
        recycle: (n, size) => `Skuif ${n} lêers (${size}) na die Asblik? Jy kan hulle van daar af terugsit.`,
        delete: (n, size) => `Skrap ${n} lêers (${size}) vir altyd? Dit kan nie ontdoen word nie.`
      },
      removing: 'Verwyder tans…',
      close: 'Maak toe',
      toast: {
        removed: (n) => `${n} rommellêers verwyder.`,
        kept: (n) => `${n} lêers is gelaat waar hulle is.`,
        keptDetail: 'Hulle was in gebruik, het sedert die skandering verander, of tel nie meer as rommel volgens jou instellings nie.'
      },
      errors: {
        noRoots: 'Kies ’n aandrywer of voeg ’n vouer by.',
        noPatterns: 'Geen patrone is aangeskakel nie. Skakel sommige aan in Instellings › Skoonmaak.',
        noUsableRoots: 'Nie een van daardie plekke kan deursoek word nie.',
        failed: (m) => `Die skandering het misluk: ${m}`,
        removeFailed: (m) => `Niks is verwyder nie: ${m}`
      },
      settings: {
        title: 'Rommellêerpatrone',
        description: 'Waarna Diep Skoonmaak se Rommellêers-skandering soek. Resultate van patrone gemerk By verstek gemerk begin gemerk, want daardie lêers is net kladwerk of bou hulself weer op; alles anders merk jy self. Programme, biblioteke en desktop.ini word nooit aangebied nie, wat die patroon ook al is.',
        ariaLabel: 'Nuwe rommellêerpatroon',
        formatHint: '’n Lêernaam met * vir enige karakters en ? vir een, soos *.tmp. Hoofletters maak nie saak nie.',
        empty: 'Geen patrone nie. Voeg een by, of stel terug na die verstekke.',
        lookFor: (p) => `Soek na ${p}`,
        preselected: 'By verstek gemerk',
        remove: (p) => `Verwyder ${p}`,
        reset: 'Stel terug na verstekke',
        resetConfirm: "Vervang jou lys met die verstekke? Patrone wat jy bygevoeg het, word verwyder.",
        error: {
          empty: 'Tik eers ’n patroon.',
          long: 'Daardie patroon is te lank.',
          separator: '’n Patroon is ’n lêernaam, nie ’n vouer of pad nie.',
          invalid: 'Dit bevat ’n karakter wat geen lêernaam kan hê nie.',
          everything: 'Dit sou by elke lêer pas.',
          executable: 'Programme, biblioteke, drywers en installeerders is nooit rommel nie.',
          desktopIni: 'Dit sou by desktop.ini pas, wat ’n vouer sy ikoon en naam gee.',
          duplicate: 'Daardie patroon is reeds in die lys.',
          tooMany: 'Die lys is vol.',
          failed: (m) => `Die verandering is nie gestoor nie: ${m}`
        }
      }
    }
  },
  ar: {
    junkFiles: {
      open: 'الملفات غير الضرورية',
      title: 'الملفات غير الضرورية',
      intro: 'يعثر على الملفات المؤقتة المتبقية وذاكرات التخزين المؤقت والنسخ الاحتياطية حسب الاسم في محركات الأقراص والمجلدات التي تختارها، باستخدام الأنماط في الإعدادات › التنظيف. لا يُزال شيء حتى تحدده وتؤكد.',
      where: 'أين يبحث',
      folderPlaceholder: 'أضف مجلدًا، مثل D:\\Downloads',
      folderAria: 'مجلد للبحث فيه',
      addFolder: 'إضافة',
      foldersLabel: 'المجلدات المراد البحث فيها',
      removeFolder: (path) => `إزالة ${path}`,
      lookingFor: 'يبحث عن',
      editPatterns: 'تعديل الأنماط',
      scan: 'فحص',
      scanAgain: 'فحص مجددًا',
      noPlaces: 'اختر محرك أقراص أو أضف مجلدًا.',
      progress: (entries, found) => `تم البحث في ${entries} عنصر · عُثر على ${found}`,
      idle: 'الفحص لا يزيل شيئًا. تظهر الملفات هنا فور العثور عليها.',
      empty: 'لم يُعثر على ملفات غير ضرورية هناك.',
      stoppedEmpty: 'توقف قبل العثور على أي شيء.',
      found: (count, size) => `${count} ملف · ${size}`,
      stopped: 'توقف: هذه ما عُثر عليه قبل ذلك.',
      skipped: {
        lead: (n) => `تُرك ${n} ملفًا مطابقًا آخر دون مساس:`,
        recent: (n, hours) => `${n} تغيّرت خلال آخر ${hours} ساعة`,
        protected: (n) => `${n} في أماكن محمية`,
        excluded: (n) => `${n} مستثناة في الإعدادات`,
        executable: (n) => `${n} برامج أو ملفات نظام`,
        folders: (n) => `لم يُبحث في ${n} مجلدًا محميًا أو مستثنى: Windows وProgram Files والمجلدات الخاصة بالبرامج المثبتة واستثناءاتك.`
      },
      truncated: 'بلغ الفحص حده قبل أن ينتهي. ما عثر عليه حقيقي؛ وقد يكون هناك المزيد.',
      truncatedMatches: 'تُعرض أول 20,000 نتيجة فقط. افحص مجلدًا أصغر لرؤية الباقي.',
      unreadable: (path) => `لم يسمح Windows لـ Prune بالنظر داخل ${path}.`,
      refusedRoot: {
        missing: (p) => `${p} ليس مجلدًا موجودًا، لذا تم تخطيه.`,
        relative: (p) => `${p} ليس مسارًا كاملًا، لذا تم تخطيه.`,
        climb: (p) => `${p} يستخدم ".."، لذا تم تخطيه.`,
        protected: (p) => `${p} مكان محمي ولا يُبحث فيه أبدًا.`
      },
      group: {
        tickAll: (pattern) => `تحديد كل ملفات ${pattern}`,
        showAll: (n) => `عرض الكل (${n})`,
        showFewer: 'عرض أقل'
      },
      describe: {
        tmp: 'ملفات مؤقتة',
        temp: 'ملفات مؤقتة',
        tilde: 'ملفات مالك Office وملفات ~ أخرى',
        tildeExt: 'نسخ احتياطية من المحررات',
        chk: 'أجزاء chkdsk في مجلدات FOUND',
        old: 'إصدارات قديمة جُنّبت',
        gid: 'فهارس تعليمات Windows المؤقتة',
        dmp: 'ملفات تفريغ الأعطال',
        thumbs: 'ذاكرات الصور المصغرة القديمة',
        bak: 'نسخ احتياطية، غالبًا محفوظة عمدًا',
        log: 'ملفات السجل'
      },
      openFolder: (name) => `فتح المجلد الذي يحوي ${name}`,
      selected: (n, size) => `${n} محدد · ${size}`,
      removeButton: { quarantine: 'نقل إلى الحجر الصحي', recycle: 'نقل إلى سلة المحذوفات', delete: 'حذف' },
      confirm: {
        quarantine: (n, size) => `نقل ${n} ملف (${size}) إلى الحجر الصحي؟ يمكنك إعادتها من الحجر الصحي.`,
        recycle: (n, size) => `نقل ${n} ملف (${size}) إلى سلة المحذوفات؟ يمكنك إعادتها من هناك.`,
        delete: (n, size) => `حذف ${n} ملف (${size}) نهائيًا؟ لا يمكن التراجع عن ذلك.`
      },
      removing: 'جارٍ الإزالة…',
      close: 'إغلاق',
      toast: {
        removed: (n) => `تمت إزالة ${n} ملف غير ضروري.`,
        kept: (n) => `تُرك ${n} ملف في مكانه.`,
        keptDetail: 'كانت قيد الاستخدام، أو تغيّرت منذ الفحص، أو لم تعد تُعد غير ضرورية وفق إعداداتك.'
      },
      errors: {
        noRoots: 'اختر محرك أقراص أو أضف مجلدًا.',
        noPatterns: 'لا توجد أنماط مفعّلة. فعّل بعضها في الإعدادات › التنظيف.',
        noUsableRoots: 'لا يمكن البحث في أي من تلك الأماكن.',
        failed: (m) => `فشل الفحص: ${m}`,
        removeFailed: (m) => `لم تتم إزالة أي شيء: ${m}`
      },
      settings: {
        title: 'أنماط الملفات غير الضرورية',
        description: 'ما يبحث عنه فحص الملفات غير الضرورية في التنظيف العميق. نتائج الأنماط الموسومة بـ «محدد افتراضيًا» تبدأ محددة، لأن تلك الملفات مؤقتة فقط أو تعيد بناء نفسها؛ وكل ما عداها تحدده بنفسك. لا تُعرض البرامج والمكتبات وdesktop.ini أبدًا، أيًا كان النمط.',
        ariaLabel: 'نمط جديد للملفات غير الضرورية',
        formatHint: 'اسم ملف فيه * لأي أحرف و? لحرف واحد، مثل *.tmp. حالة الأحرف لا تهم.',
        empty: 'لا توجد أنماط. أضف نمطًا، أو أعد الضبط إلى الافتراضيات.',
        lookFor: (p) => `البحث عن ${p}`,
        preselected: 'محدد افتراضيًا',
        remove: (p) => `إزالة ${p}`,
        reset: 'إعادة الضبط إلى الافتراضيات',
        resetConfirm: "استبدال قائمتك بالافتراضيات؟ ستُزال الأنماط التي أضفتها.",
        error: {
          empty: 'اكتب نمطًا أولًا.',
          long: 'هذا النمط طويل جدًا.',
          separator: 'النمط اسم ملف، وليس مجلدًا أو مسارًا.',
          invalid: 'يحتوي على حرف لا يمكن أن يكون في اسم ملف.',
          everything: 'سيطابق ذلك كل الملفات.',
          executable: 'البرامج والمكتبات وبرامج التشغيل وملفات التثبيت ليست ملفات غير ضرورية أبدًا.',
          desktopIni: 'سيطابق ذلك desktop.ini، الذي يمنح المجلد أيقونته واسمه.',
          duplicate: 'هذا النمط موجود في القائمة بالفعل.',
          tooMany: 'القائمة ممتلئة.',
          failed: (m) => `لم يُحفظ التغيير: ${m}`
        }
      }
    }
  },
  ca: {
    junkFiles: {
      open: 'Fitxers brossa',
      title: 'Fitxers brossa',
      intro: 'Troba fitxers temporals, memòries cau i còpies de seguretat que han quedat, pel nom, a les unitats i carpetes que triïs, amb els patrons de Configuració › Neteja. No s’elimina res fins que ho marques i ho confirmes.',
      where: 'On buscar',
      folderPlaceholder: 'Afegeix una carpeta, p. ex. D:\\Downloads',
      folderAria: 'Carpeta on buscar',
      addFolder: 'Afegeix',
      foldersLabel: 'Carpetes on buscar',
      removeFolder: (path) => `Treu ${path}`,
      lookingFor: 'Es busca',
      editPatterns: 'Edita els patrons',
      scan: 'Analitza',
      scanAgain: 'Torna a analitzar',
      noPlaces: 'Tria una unitat o afegeix una carpeta.',
      progress: (entries, found) => `${entries} elements revisats · ${found} trobats`,
      idle: 'Analitzar no elimina res. Els fitxers apareixen aquí a mesura que es troben.',
      empty: 'No s’hi ha trobat cap fitxer brossa.',
      stoppedEmpty: 'S’ha aturat abans de trobar res.',
      found: (count, size) => `${count} fitxers · ${size}`,
      stopped: 'Aturat: aquests es van trobar abans.',
      skipped: {
        lead: (n) => `${n} fitxers coincidents més s’han deixat tal com estaven:`,
        recent: (n, hours) => `${n} modificats en les últimes ${hours} hores`,
        protected: (n) => `${n} en llocs protegits`,
        excluded: (n) => `${n} exclosos a Configuració`,
        executable: (n) => `${n} programes o fitxers del sistema`,
        folders: (n) => `No s’han revisat ${n} carpetes protegides o excloses: Windows, Program Files, les carpetes pròpies dels programes instal·lats i les teves exclusions.`
      },
      truncated: 'L’anàlisi ha arribat al límit abans d’acabar. El que ha trobat és real; potser n’hi ha més.',
      truncatedMatches: 'Només es mostren les primeres 20.000 coincidències. Analitza una carpeta més petita per veure la resta.',
      unreadable: (path) => `Windows no ha deixat que Prune miri dins de ${path}.`,
      refusedRoot: {
        missing: (p) => `${p} no és una carpeta que existeixi, així que s’ha omès.`,
        relative: (p) => `${p} no és un camí complet, així que s’ha omès.`,
        climb: (p) => `${p} fa servir "..", així que s’ha omès.`,
        protected: (p) => `${p} és un lloc protegit i no es revisa mai.`
      },
      group: {
        tickAll: (pattern) => `Marca tots els fitxers ${pattern}`,
        showAll: (n) => `Mostra’ls tots (${n})`,
        showFewer: 'Mostra’n menys'
      },
      describe: {
        tmp: 'Fitxers temporals',
        temp: 'Fitxers temporals',
        tilde: 'Fitxers de propietari d’Office i altres fitxers ~',
        tildeExt: 'Còpies de seguretat d’editors',
        chk: 'Fragments de chkdsk a carpetes FOUND',
        old: 'Versions antigues apartades',
        gid: 'Índexs de l’ajuda de Windows',
        dmp: 'Bolcats de fallades',
        thumbs: 'Memòries cau de miniatures antigues',
        bak: 'Còpies de seguretat, sovint guardades a propòsit',
        log: 'Fitxers de registre'
      },
      openFolder: (name) => `Obre la carpeta que conté ${name}`,
      selected: (n, size) => `${n} seleccionats · ${size}`,
      removeButton: { quarantine: 'Mou a Quarantena', recycle: 'Mou a la Paperera', delete: 'Suprimeix' },
      confirm: {
        quarantine: (n, size) => `Vols moure ${n} fitxers (${size}) a Quarantena? Els pots recuperar des de Quarantena.`,
        recycle: (n, size) => `Vols moure ${n} fitxers (${size}) a la Paperera? Els pots recuperar des d’allà.`,
        delete: (n, size) => `Vols suprimir ${n} fitxers (${size}) definitivament? No es pot desfer.`
      },
      removing: 'S’està eliminant…',
      close: 'Tanca',
      toast: {
        removed: (n) => `S’han eliminat ${n} fitxers brossa.`,
        kept: (n) => `${n} fitxers s’han deixat on eren.`,
        keptDetail: 'S’estaven fent servir, han canviat des de l’anàlisi o ja no compten com a brossa segons la teva configuració.'
      },
      errors: {
        noRoots: 'Tria una unitat o afegeix una carpeta.',
        noPatterns: 'No hi ha cap patró activat. Activa’n alguns a Configuració › Neteja.',
        noUsableRoots: 'No es pot revisar cap d’aquests llocs.',
        failed: (m) => `L’anàlisi ha fallat: ${m}`,
        removeFailed: (m) => `No s’ha eliminat res: ${m}`
      },
      settings: {
        title: 'Patrons de fitxers brossa',
        description: 'El que busca l’anàlisi de Fitxers brossa de Neteja profunda. Els resultats dels patrons marcats amb Marcat per defecte surten marcats, perquè aquests fitxers només són provisionals o es tornen a generar; la resta els marques tu. Els programes, les biblioteques i desktop.ini no s’ofereixen mai, sigui quin sigui el patró.',
        ariaLabel: 'Patró nou de fitxers brossa',
        formatHint: 'Un nom de fitxer amb * per a qualsevol caràcter i ? per a un de sol, com *.tmp. Majúscules i minúscules no importen.',
        empty: 'Cap patró. Afegeix-ne un o restableix els valors per defecte.',
        lookFor: (p) => `Busca ${p}`,
        preselected: 'Marcat per defecte',
        remove: (p) => `Treu ${p}`,
        reset: 'Restableix els valors per defecte',
        resetConfirm: "Vols substituir la llista pels valors per defecte? Els patrons que has afegit s’eliminaran.",
        error: {
          empty: 'Escriu primer un patró.',
          long: 'Aquest patró és massa llarg.',
          separator: 'Un patró és un nom de fitxer, no una carpeta ni un camí.',
          invalid: 'Conté un caràcter que cap nom de fitxer pot tenir.',
          everything: 'Coincidiria amb tots els fitxers.',
          executable: 'Els programes, les biblioteques, els controladors i els instal·ladors no són mai brossa.',
          desktopIni: 'Coincidiria amb desktop.ini, que dona a una carpeta la seva icona i el seu nom.',
          duplicate: 'Aquest patró ja és a la llista.',
          tooMany: 'La llista és plena.',
          failed: (m) => `El canvi no s’ha desat: ${m}`
        }
      }
    }
  },
  cs: {
    junkFiles: {
      open: 'Nepotřebné soubory',
      title: 'Nepotřebné soubory',
      intro: 'Najde zbylé dočasné soubory, mezipaměti a zálohy podle názvu na jednotkách a ve složkách, které vyberete, podle vzorů v Nastavení › Čištění. Nic se neodstraní, dokud to nezaškrtnete a nepotvrdíte.',
      where: 'Kde hledat',
      folderPlaceholder: 'Přidejte složku, např. D:\\Downloads',
      folderAria: 'Složka k prohledání',
      addFolder: 'Přidat',
      foldersLabel: 'Složky k prohledání',
      removeFolder: (path) => `Odebrat ${path}`,
      lookingFor: 'Hledá se',
      editPatterns: 'Upravit vzory',
      scan: 'Prohledat',
      scanAgain: 'Prohledat znovu',
      noPlaces: 'Vyberte jednotku nebo přidejte složku.',
      progress: (entries, found) => `Prohledáno položek: ${entries} · nalezeno: ${found}`,
      idle: 'Prohledání nic neodstraní. Soubory se tu objevují, jak jsou nalézány.',
      empty: 'Žádné nepotřebné soubory tam nebyly nalezeny.',
      stoppedEmpty: 'Zastaveno dřív, než se něco našlo.',
      found: (count, size) => `Souborů: ${count} · ${size}`,
      stopped: 'Zastaveno: tyto se našly předtím.',
      skipped: {
        lead: (n) => `Dalších ${n} odpovídajících souborů zůstalo nedotčeno:`,
        recent: (n, hours) => `${n} změněno za posledních ${hours} h`,
        protected: (n) => `${n} na chráněných místech`,
        excluded: (n) => `${n} vyloučeno v Nastavení`,
        executable: (n) => `${n} programů nebo systémových souborů`,
        folders: (n) => `Neprohledáno chráněných nebo vyloučených složek: ${n} – Windows, Program Files, vlastní složky nainstalovaných programů a vaše výjimky.`
      },
      truncated: 'Prohledávání dosáhlo limitu dřív, než skončilo. Co našlo, je skutečné; může toho být víc.',
      truncatedMatches: 'Zobrazuje se jen prvních 20 000 shod. Zbytek uvidíte, když prohledáte menší složku.',
      unreadable: (path) => `Windows nedovolil Prune nahlédnout do ${path}.`,
      refusedRoot: {
        missing: (p) => `${p} není existující složka, proto byla přeskočena.`,
        relative: (p) => `${p} není úplná cesta, proto byla přeskočena.`,
        climb: (p) => `${p} obsahuje „..“, proto byla přeskočena.`,
        protected: (p) => `${p} je chráněné místo a nikdy se neprohledává.`
      },
      group: {
        tickAll: (pattern) => `Zaškrtnout všechny soubory ${pattern}`,
        showAll: (n) => `Zobrazit všech ${n}`,
        showFewer: 'Zobrazit méně'
      },
      describe: {
        tmp: 'Dočasné soubory',
        temp: 'Dočasné soubory',
        tilde: 'Soubory vlastníka Office a jiné soubory ~',
        tildeExt: 'Záložní kopie editorů',
        chk: 'Fragmenty chkdsk ve složkách FOUND',
        old: 'Odložené staré verze',
        gid: 'Mezipaměti rejstříku nápovědy Windows',
        dmp: 'Výpisy pádů',
        thumbs: 'Staré mezipaměti miniatur',
        bak: 'Zálohy, často schválně uchovávané',
        log: 'Soubory protokolů'
      },
      openFolder: (name) => `Otevřít složku se souborem ${name}`,
      selected: (n, size) => `Vybráno: ${n} · ${size}`,
      removeButton: { quarantine: 'Přesunout do karantény', recycle: 'Přesunout do koše', delete: 'Smazat' },
      confirm: {
        quarantine: (n, size) => `Přesunout ${n} souborů (${size}) do karantény? Z karantény je můžete vrátit.`,
        recycle: (n, size) => `Přesunout ${n} souborů (${size}) do koše? Odtud je můžete vrátit.`,
        delete: (n, size) => `Smazat ${n} souborů (${size}) natrvalo? Tuto akci nelze vrátit.`
      },
      removing: 'Odstraňování…',
      close: 'Zavřít',
      toast: {
        removed: (n) => `Odstraněno nepotřebných souborů: ${n}.`,
        kept: (n) => `Souborů ponechaných na místě: ${n}.`,
        keptDetail: 'Byly používány, od prohledání se změnily nebo už podle vašeho nastavení nejsou nepotřebné.'
      },
      errors: {
        noRoots: 'Vyberte jednotku nebo přidejte složku.',
        noPatterns: 'Žádný vzor není zapnutý. Zapněte některé v Nastavení › Čištění.',
        noUsableRoots: 'Žádné z těch míst nelze prohledat.',
        failed: (m) => `Prohledání selhalo: ${m}`,
        removeFailed: (m) => `Nic nebylo odstraněno: ${m}`
      },
      settings: {
        title: 'Vzory nepotřebných souborů',
        description: 'Co hledá funkce Nepotřebné soubory v Důkladném čištění. Výsledky vzorů označených Ve výchozím stavu zaškrtnuto začínají zaškrtnuté, protože tyto soubory jsou jen pracovní nebo se samy obnoví; vše ostatní zaškrtnete sami. Programy, knihovny a desktop.ini se nikdy nenabízejí, ať je vzor jakýkoli.',
        ariaLabel: 'Nový vzor nepotřebných souborů',
        formatHint: 'Název souboru s * pro libovolné znaky a ? pro jeden znak, např. *.tmp. Na velikosti písmen nezáleží.',
        empty: 'Žádné vzory. Přidejte nějaký nebo obnovte výchozí.',
        lookFor: (p) => `Hledat ${p}`,
        preselected: 'Ve výchozím stavu zaškrtnuto',
        remove: (p) => `Odebrat ${p}`,
        reset: 'Obnovit výchozí',
        resetConfirm: "Nahradit seznam výchozími vzory? Vzory, které jste přidali, budou odebrány.",
        error: {
          empty: 'Nejdřív napište vzor.',
          long: 'Ten vzor je příliš dlouhý.',
          separator: 'Vzor je název souboru, ne složka ani cesta.',
          invalid: 'Obsahuje znak, který žádný název souboru mít nemůže.',
          everything: 'Odpovídal by každému souboru.',
          executable: 'Programy, knihovny, ovladače a instalátory nikdy nejsou nepotřebné soubory.',
          desktopIni: 'Odpovídal by souboru desktop.ini, který dává složce ikonu a název.',
          duplicate: 'Ten vzor už v seznamu je.',
          tooMany: 'Seznam je plný.',
          failed: (m) => `Změna nebyla uložena: ${m}`
        }
      }
    }
  },
  cy: {
    junkFiles: {
      open: 'Ffeiliau sothach',
      title: 'Ffeiliau sothach',
      intro: 'Yn dod o hyd i ffeiliau dros dro, storfeydd a chopïau wrth gefn sydd ar ôl, yn ôl enw, ar y gyriannau a’r ffolderi a ddewiswch, gan ddefnyddio’r patrymau yn Gosodiadau › Glanhau. Does dim yn cael ei dynnu nes i chi ei dicio a chadarnhau.',
      where: 'Ble i chwilio',
      folderPlaceholder: 'Ychwanegu ffolder, e.e. D:\\Downloads',
      folderAria: 'Ffolder i chwilio ynddo',
      addFolder: 'Ychwanegu',
      foldersLabel: 'Ffolderi i chwilio ynddynt',
      removeFolder: (path) => `Tynnu ${path}`,
      lookingFor: 'Chwilio am',
      editPatterns: 'Golygu patrymau',
      scan: 'Sganio',
      scanAgain: 'Sganio eto',
      noPlaces: 'Dewiswch yriant neu ychwanegwch ffolder.',
      progress: (entries, found) => `Wedi chwilio ${entries} eitem · ${found} wedi’u canfod`,
      idle: 'Dydy sganio ddim yn tynnu dim. Mae ffeiliau’n ymddangos yma wrth iddyn nhw gael eu canfod.',
      empty: 'Dim ffeiliau sothach yno.',
      stoppedEmpty: 'Wedi stopio cyn canfod dim.',
      found: (count, size) => `${count} ffeil · ${size}`,
      stopped: 'Wedi stopio: cafodd y rhain eu canfod cyn hynny.',
      skipped: {
        lead: (n) => `Cafodd ${n} ffeil arall sy’n cyfateb eu gadael:`,
        recent: (n, hours) => `${n} wedi newid yn y ${hours} awr ddiwethaf`,
        protected: (n) => `${n} mewn lleoedd gwarchodedig`,
        excluded: (n) => `${n} wedi’u heithrio yn Gosodiadau`,
        executable: (n) => `${n} rhaglen neu ffeil system`,
        folders: (n) => `Ni chwiliwyd ${n} ffolder gwarchodedig neu wedi’u heithrio: Windows, Program Files, ffolderi rhaglenni sydd wedi’u gosod a’ch eithriadau.`
      },
      truncated: 'Cyrhaeddodd y sgan ei derfyn cyn gorffen. Mae’r hyn a ganfu yn real; efallai bod mwy.',
      truncatedMatches: 'Dim ond yr 20,000 cyfatebiaeth gyntaf sydd wedi’u rhestru. Sganiwch ffolder llai i weld y gweddill.',
      unreadable: (path) => `Ni adawodd Windows i Prune edrych y tu mewn i ${path}.`,
      refusedRoot: {
        missing: (p) => `Dydy ${p} ddim yn ffolder sy’n bodoli, felly cafodd ei hepgor.`,
        relative: (p) => `Dydy ${p} ddim yn llwybr llawn, felly cafodd ei hepgor.`,
        climb: (p) => `Mae ${p} yn defnyddio "..", felly cafodd ei hepgor.`,
        protected: (p) => `Mae ${p} yn lle gwarchodedig ac ni chaiff byth ei chwilio.`
      },
      group: {
        tickAll: (pattern) => `Ticio pob ffeil ${pattern}`,
        showAll: (n) => `Dangos y cyfan (${n})`,
        showFewer: 'Dangos llai'
      },
      describe: {
        tmp: 'Ffeiliau dros dro',
        temp: 'Ffeiliau dros dro',
        tilde: 'Ffeiliau perchennog Office a ffeiliau ~ eraill',
        tildeExt: 'Copïau wrth gefn golygyddion',
        chk: 'Darnau chkdsk mewn ffolderi FOUND',
        old: 'Hen fersiynau wedi’u rhoi o’r neilltu',
        gid: 'Storfeydd mynegai cymorth Windows',
        dmp: 'Tomenni chwalu',
        thumbs: 'Hen storfeydd mân-luniau',
        bak: 'Copïau wrth gefn, yn aml wedi’u cadw’n fwriadol',
        log: 'Ffeiliau log'
      },
      openFolder: (name) => `Agor y ffolder sy’n dal ${name}`,
      selected: (n, size) => `${n} wedi’u dewis · ${size}`,
      removeButton: { quarantine: 'Symud i Cwarantin', recycle: 'Symud i’r Bin Ailgylchu', delete: 'Dileu' },
      confirm: {
        quarantine: (n, size) => `Symud ${n} ffeil (${size}) i Cwarantin? Gallwch eu rhoi yn ôl o Cwarantin.`,
        recycle: (n, size) => `Symud ${n} ffeil (${size}) i’r Bin Ailgylchu? Gallwch eu rhoi yn ôl oddi yno.`,
        delete: (n, size) => `Dileu ${n} ffeil (${size}) am byth? Does dim modd dadwneud hyn.`
      },
      removing: 'Wrthi’n tynnu…',
      close: 'Cau',
      toast: {
        removed: (n) => `Wedi tynnu ${n} ffeil sothach.`,
        kept: (n) => `Cafodd ${n} ffeil eu gadael lle maen nhw.`,
        keptDetail: 'Roedden nhw’n cael eu defnyddio, wedi newid ers y sgan, neu ddim yn cyfrif fel sothach mwyach yn ôl eich gosodiadau.'
      },
      errors: {
        noRoots: 'Dewiswch yriant neu ychwanegwch ffolder.',
        noPatterns: 'Does dim patrymau wedi’u troi ymlaen. Trowch rai ymlaen yn Gosodiadau › Glanhau.',
        noUsableRoots: 'Does dim modd chwilio yn yr un o’r lleoedd hynny.',
        failed: (m) => `Methodd y sgan: ${m}`,
        removeFailed: (m) => `Ni thynnwyd dim: ${m}`
      },
      settings: {
        title: 'Patrymau ffeiliau sothach',
        description: 'Yr hyn y mae sgan Ffeiliau sothach Glanhau Dwfn yn chwilio amdano. Mae canlyniadau patrymau sydd wedi’u marcio Wedi’i dicio’n ddiofyn yn dechrau wedi’u ticio, gan mai ffeiliau crafu yn unig yw’r rheini neu maen nhw’n ailadeiladu eu hunain; rydych chi’n ticio popeth arall eich hun. Ni chynigir rhaglenni, llyfrgelloedd na desktop.ini byth, beth bynnag fo’r patrwm.',
        ariaLabel: 'Patrwm ffeil sothach newydd',
        formatHint: 'Enw ffeil gyda * am unrhyw nodau a ? am un, fel *.tmp. Does dim ots am briflythrennau.',
        empty: 'Dim patrymau. Ychwanegwch un, neu ailosodwch i’r rhagosodiadau.',
        lookFor: (p) => `Chwilio am ${p}`,
        preselected: 'Wedi’i dicio’n ddiofyn',
        remove: (p) => `Tynnu ${p}`,
        reset: 'Ailosod i’r rhagosodiadau',
        resetConfirm: "Disodli eich rhestr gyda’r rhagosodiadau? Bydd patrymau a ychwanegoch yn cael eu tynnu.",
        error: {
          empty: 'Teipiwch batrwm yn gyntaf.',
          long: 'Mae’r patrwm hwnnw’n rhy hir.',
          separator: 'Enw ffeil yw patrwm, nid ffolder na llwybr.',
          invalid: 'Mae’n cynnwys nod na all unrhyw enw ffeil ei gael.',
          everything: 'Byddai hynny’n cyfateb i bob ffeil.',
          executable: 'Dydy rhaglenni, llyfrgelloedd, gyrwyr a gosodwyr byth yn sothach.',
          desktopIni: 'Byddai hynny’n cyfateb i desktop.ini, sy’n rhoi ei eicon a’i enw i ffolder.',
          duplicate: 'Mae’r patrwm hwnnw yn y rhestr yn barod.',
          tooMany: 'Mae’r rhestr yn llawn.',
          failed: (m) => `Ni chadwyd y newid: ${m}`
        }
      }
    }
  },
  da: {
    junkFiles: {
      open: 'Overflødige filer',
      title: 'Overflødige filer',
      intro: 'Finder efterladte midlertidige filer, cacher og sikkerhedskopier efter navn på de drev og mapper, du vælger, ud fra mønstrene i Indstillinger › Oprydning. Intet fjernes, før du markerer det og bekræfter.',
      where: 'Hvor der skal søges',
      folderPlaceholder: 'Tilføj en mappe, f.eks. D:\\Downloads',
      folderAria: 'Mappe at søge i',
      addFolder: 'Tilføj',
      foldersLabel: 'Mapper at søge i',
      removeFolder: (path) => `Fjern ${path}`,
      lookingFor: 'Søger efter',
      editPatterns: 'Rediger mønstre',
      scan: 'Søg',
      scanAgain: 'Søg igen',
      noPlaces: 'Vælg et drev, eller tilføj en mappe.',
      progress: (entries, found) => `${entries} elementer gennemsøgt · ${found} fundet`,
      idle: 'Søgningen fjerner intet. Filerne vises her, efterhånden som de findes.',
      empty: 'Ingen overflødige filer fundet der.',
      stoppedEmpty: 'Stoppet, før noget blev fundet.',
      found: (count, size) => `${count} filer · ${size}`,
      stopped: 'Stoppet: disse blev fundet inden da.',
      skipped: {
        lead: (n) => `${n} filer mere, der passer, blev ladt være:`,
        recent: (n, hours) => `${n} ændret inden for de sidste ${hours} timer`,
        protected: (n) => `${n} på beskyttede steder`,
        excluded: (n) => `${n} udeladt i Indstillinger`,
        executable: (n) => `${n} programmer eller systemfiler`,
        folders: (n) => `${n} beskyttede eller udeladte mapper blev ikke gennemsøgt: Windows, Program Files, installerede programmers egne mapper og dine undtagelser.`
      },
      truncated: 'Søgningen nåede sin grænse, før den blev færdig. Det, den fandt, er ægte; der kan være flere.',
      truncatedMatches: 'Kun de første 20.000 fund vises. Søg i en mindre mappe for at se resten.',
      unreadable: (path) => `Windows ville ikke lade Prune se ind i ${path}.`,
      refusedRoot: {
        missing: (p) => `${p} er ikke en mappe, der findes, så den blev sprunget over.`,
        relative: (p) => `${p} er ikke en fuld sti, så den blev sprunget over.`,
        climb: (p) => `${p} bruger "..", så den blev sprunget over.`,
        protected: (p) => `${p} er et beskyttet sted og gennemsøges aldrig.`
      },
      group: {
        tickAll: (pattern) => `Marker alle ${pattern}-filer`,
        showAll: (n) => `Vis alle ${n}`,
        showFewer: 'Vis færre'
      },
      describe: {
        tmp: 'Midlertidige filer',
        temp: 'Midlertidige filer',
        tilde: 'Office-ejerfiler og andre ~-filer',
        tildeExt: 'Sikkerhedskopier fra editorer',
        chk: 'chkdsk-fragmenter i FOUND-mapper',
        old: 'Gamle versioner lagt til side',
        gid: 'Indekscacher til Windows-hjælp',
        dmp: 'Nedbrudsdumps',
        thumbs: 'Gamle miniaturecacher',
        bak: 'Sikkerhedskopier, ofte gemt med vilje',
        log: 'Logfiler'
      },
      openFolder: (name) => `Åbn mappen med ${name}`,
      selected: (n, size) => `${n} valgt · ${size}`,
      removeButton: { quarantine: 'Flyt til Karantæne', recycle: 'Flyt til Papirkurven', delete: 'Slet' },
      confirm: {
        quarantine: (n, size) => `Flyt ${n} filer (${size}) til Karantæne? Du kan lægge dem tilbage fra Karantæne.`,
        recycle: (n, size) => `Flyt ${n} filer (${size}) til Papirkurven? Du kan lægge dem tilbage derfra.`,
        delete: (n, size) => `Slet ${n} filer (${size}) for altid? Det kan ikke fortrydes.`
      },
      removing: 'Fjerner…',
      close: 'Luk',
      toast: {
        removed: (n) => `${n} overflødige filer fjernet.`,
        kept: (n) => `${n} filer blev ladt ligge, hvor de er.`,
        keptDetail: 'De var i brug, er ændret siden søgningen eller tæller ikke længere som overflødige efter dine indstillinger.'
      },
      errors: {
        noRoots: 'Vælg et drev, eller tilføj en mappe.',
        noPatterns: 'Ingen mønstre er slået til. Slå nogle til i Indstillinger › Oprydning.',
        noUsableRoots: 'Ingen af de steder kan gennemsøges.',
        failed: (m) => `Søgningen mislykkedes: ${m}`,
        removeFailed: (m) => `Intet blev fjernet: ${m}`
      },
      settings: {
        title: 'Mønstre for overflødige filer',
        description: 'Det, Dybderensnings søgning efter overflødige filer leder efter. Fund fra mønstre mærket Markeret som standard starter markeret, fordi de filer kun er kladder eller genopbygger sig selv; alt andet markerer du selv. Programmer, biblioteker og desktop.ini tilbydes aldrig, uanset mønsteret.',
        ariaLabel: 'Nyt mønster for overflødige filer',
        formatHint: 'Et filnavn med * for vilkårlige tegn og ? for ét, f.eks. *.tmp. Store og små bogstaver er ligegyldige.',
        empty: 'Ingen mønstre. Tilføj et, eller nulstil til standard.',
        lookFor: (p) => `Søg efter ${p}`,
        preselected: 'Markeret som standard',
        remove: (p) => `Fjern ${p}`,
        reset: 'Nulstil til standard',
        resetConfirm: "Erstat din liste med standard? Mønstre, du har tilføjet, fjernes.",
        error: {
          empty: 'Skriv først et mønster.',
          long: 'Det mønster er for langt.',
          separator: 'Et mønster er et filnavn, ikke en mappe eller en sti.',
          invalid: 'Det indeholder et tegn, som intet filnavn kan have.',
          everything: 'Det ville passe på alle filer.',
          executable: 'Programmer, biblioteker, drivere og installationsprogrammer er aldrig overflødige.',
          desktopIni: 'Det ville passe på desktop.ini, som giver en mappe dens ikon og navn.',
          duplicate: 'Det mønster er allerede på listen.',
          tooMany: 'Listen er fuld.',
          failed: (m) => `Ændringen blev ikke gemt: ${m}`
        }
      }
    }
  },
  de: {
    junkFiles: {
      open: 'Datenmüll',
      title: 'Datenmüll',
      intro: 'Findet übrig gebliebene temporäre Dateien, Caches und Sicherungen anhand des Namens auf den Laufwerken und in den Ordnern, die du auswählst – mit den Mustern aus Einstellungen › Bereinigung. Entfernt wird erst, was du anhakst und bestätigst.',
      where: 'Wo gesucht wird',
      folderPlaceholder: 'Ordner hinzufügen, z. B. D:\\Downloads',
      folderAria: 'Zu durchsuchender Ordner',
      addFolder: 'Hinzufügen',
      foldersLabel: 'Zu durchsuchende Ordner',
      removeFolder: (path) => `${path} entfernen`,
      lookingFor: 'Gesucht wird',
      editPatterns: 'Muster bearbeiten',
      scan: 'Suchen',
      scanAgain: 'Erneut suchen',
      noPlaces: 'Wähle ein Laufwerk oder füge einen Ordner hinzu.',
      progress: (entries, found) => `${entries} Einträge durchsucht · ${found} gefunden`,
      idle: 'Die Suche entfernt nichts. Dateien erscheinen hier, sobald sie gefunden werden.',
      empty: 'Dort wurde kein Datenmüll gefunden.',
      stoppedEmpty: 'Angehalten, bevor etwas gefunden wurde.',
      found: (count, size) => `${count} Dateien · ${size}`,
      stopped: 'Angehalten: Diese wurden vorher gefunden.',
      skipped: {
        lead: (n) => `${n} weitere passende Dateien wurden nicht angetastet:`,
        recent: (n, hours) => `${n} in den letzten ${hours} Stunden geändert`,
        protected: (n) => `${n} an geschützten Orten`,
        excluded: (n) => `${n} in den Einstellungen ausgeschlossen`,
        executable: (n) => `${n} Programme oder Systemdateien`,
        folders: (n) => `${n} geschützte oder ausgeschlossene Ordner wurden nicht durchsucht: Windows, Program Files, die eigenen Ordner installierter Programme und deine Ausschlüsse.`
      },
      truncated: 'Die Suche hat ihre Grenze erreicht, bevor sie fertig war. Was sie gefunden hat, stimmt; es kann mehr geben.',
      truncatedMatches: 'Nur die ersten 20.000 Treffer werden aufgeführt. Durchsuche einen kleineren Ordner, um den Rest zu sehen.',
      unreadable: (path) => `Windows hat Prune nicht in ${path} hineinsehen lassen.`,
      refusedRoot: {
        missing: (p) => `${p} ist kein vorhandener Ordner und wurde übersprungen.`,
        relative: (p) => `${p} ist kein vollständiger Pfad und wurde übersprungen.`,
        climb: (p) => `${p} enthält „..“ und wurde übersprungen.`,
        protected: (p) => `${p} ist ein geschützter Ort und wird nie durchsucht.`
      },
      group: {
        tickAll: (pattern) => `Alle ${pattern}-Dateien anhaken`,
        showAll: (n) => `Alle ${n} anzeigen`,
        showFewer: 'Weniger anzeigen'
      },
      describe: {
        tmp: 'Temporäre Dateien',
        temp: 'Temporäre Dateien',
        tilde: 'Office-Besitzerdateien und andere ~-Dateien',
        tildeExt: 'Sicherungskopien von Editoren',
        chk: 'chkdsk-Fragmente in FOUND-Ordnern',
        old: 'Beiseitegelegte alte Versionen',
        gid: 'Indexcaches der Windows-Hilfe',
        dmp: 'Absturzabbilder',
        thumbs: 'Alte Miniaturansicht-Caches',
        bak: 'Sicherungen, oft absichtlich behalten',
        log: 'Protokolldateien'
      },
      openFolder: (name) => `Ordner mit ${name} öffnen`,
      selected: (n, size) => `${n} ausgewählt · ${size}`,
      removeButton: { quarantine: 'In die Quarantäne', recycle: 'In den Papierkorb', delete: 'Löschen' },
      confirm: {
        quarantine: (n, size) => `${n} Dateien (${size}) in die Quarantäne verschieben? Du kannst sie aus der Quarantäne zurückholen.`,
        recycle: (n, size) => `${n} Dateien (${size}) in den Papierkorb verschieben? Du kannst sie von dort zurückholen.`,
        delete: (n, size) => `${n} Dateien (${size}) endgültig löschen? Das lässt sich nicht rückgängig machen.`
      },
      removing: 'Wird entfernt…',
      close: 'Schließen',
      toast: {
        removed: (n) => `${n} Dateien Datenmüll entfernt.`,
        kept: (n) => `${n} Dateien wurden an ihrem Platz gelassen.`,
        keptDetail: 'Sie waren in Gebrauch, haben sich seit der Suche geändert oder gelten nach deinen Einstellungen nicht mehr als Datenmüll.'
      },
      errors: {
        noRoots: 'Wähle ein Laufwerk oder füge einen Ordner hinzu.',
        noPatterns: 'Kein Muster ist eingeschaltet. Schalte welche in Einstellungen › Bereinigung ein.',
        noUsableRoots: 'Keiner dieser Orte lässt sich durchsuchen.',
        failed: (m) => `Die Suche ist fehlgeschlagen: ${m}`,
        removeFailed: (m) => `Nichts wurde entfernt: ${m}`
      },
      settings: {
        title: 'Muster für Datenmüll',
        description: 'Wonach die Datenmüll-Suche der Gründlichen Bereinigung sucht. Treffer von Mustern mit der Markierung Standardmäßig angehakt beginnen angehakt, weil diese Dateien nur Zwischenstände sind oder sich selbst neu aufbauen; alles andere hakst du selbst an. Programme, Bibliotheken und desktop.ini werden nie angeboten, egal welches Muster.',
        ariaLabel: 'Neues Muster für Datenmüll',
        formatHint: 'Ein Dateiname mit * für beliebige Zeichen und ? für eines, etwa *.tmp. Groß- und Kleinschreibung spielt keine Rolle.',
        empty: 'Keine Muster. Füge eines hinzu oder setze auf die Standardwerte zurück.',
        lookFor: (p) => `Nach ${p} suchen`,
        preselected: 'Standardmäßig angehakt',
        remove: (p) => `${p} entfernen`,
        reset: 'Auf Standard zurücksetzen',
        resetConfirm: "Deine Liste durch die Standardwerte ersetzen? Selbst hinzugefügte Muster werden entfernt.",
        error: {
          empty: 'Gib zuerst ein Muster ein.',
          long: 'Dieses Muster ist zu lang.',
          separator: 'Ein Muster ist ein Dateiname, kein Ordner und kein Pfad.',
          invalid: 'Es enthält ein Zeichen, das kein Dateiname haben kann.',
          everything: 'Das würde auf jede Datei passen.',
          executable: 'Programme, Bibliotheken, Treiber und Installationsprogramme sind nie Datenmüll.',
          desktopIni: 'Das würde auf desktop.ini passen, die einem Ordner sein Symbol und seinen Namen gibt.',
          duplicate: 'Dieses Muster steht schon in der Liste.',
          tooMany: 'Die Liste ist voll.',
          failed: (m) => `Die Änderung wurde nicht gespeichert: ${m}`
        }
      }
    }
  },
  el: {
    junkFiles: {
      open: 'Άχρηστα αρχεία',
      title: 'Άχρηστα αρχεία',
      intro: 'Βρίσκει προσωρινά αρχεία, κρυφές μνήμες και αντίγραφα ασφαλείας που έμειναν, με βάση το όνομα, στις μονάδες δίσκου και τους φακέλους που επιλέγετε, με τα μοτίβα από τις Ρυθμίσεις › Καθαρισμός. Τίποτα δεν αφαιρείται πριν το επιλέξετε και επιβεβαιώσετε.',
      where: 'Πού να ψάξει',
      folderPlaceholder: 'Προσθέστε φάκελο, π.χ. D:\\Downloads',
      folderAria: 'Φάκελος για αναζήτηση',
      addFolder: 'Προσθήκη',
      foldersLabel: 'Φάκελοι για αναζήτηση',
      removeFolder: (path) => `Αφαίρεση ${path}`,
      lookingFor: 'Αναζητούνται',
      editPatterns: 'Επεξεργασία μοτίβων',
      scan: 'Σάρωση',
      scanAgain: 'Νέα σάρωση',
      noPlaces: 'Επιλέξτε μονάδα δίσκου ή προσθέστε φάκελο.',
      progress: (entries, found) => `Ελέγχθηκαν ${entries} στοιχεία · βρέθηκαν ${found}`,
      idle: 'Η σάρωση δεν αφαιρεί τίποτα. Τα αρχεία εμφανίζονται εδώ καθώς βρίσκονται.',
      empty: 'Δεν βρέθηκαν άχρηστα αρχεία εκεί.',
      stoppedEmpty: 'Σταμάτησε πριν βρεθεί οτιδήποτε.',
      found: (count, size) => `${count} αρχεία · ${size}`,
      stopped: 'Σταμάτησε: αυτά βρέθηκαν πριν από αυτό.',
      skipped: {
        lead: (n) => `Άλλα ${n} αρχεία που ταιριάζουν αφέθηκαν ανέγγιχτα:`,
        recent: (n, hours) => `${n} άλλαξαν τις τελευταίες ${hours} ώρες`,
        protected: (n) => `${n} σε προστατευμένες θέσεις`,
        excluded: (n) => `${n} εξαιρούνται στις Ρυθμίσεις`,
        executable: (n) => `${n} προγράμματα ή αρχεία συστήματος`,
        folders: (n) => `Δεν ελέγχθηκαν ${n} προστατευμένοι ή εξαιρεμένοι φάκελοι: τα Windows, το Program Files, οι φάκελοι εγκατεστημένων προγραμμάτων και οι εξαιρέσεις σας.`
      },
      truncated: 'Η σάρωση έφτασε στο όριό της πριν τελειώσει. Ό,τι βρήκε είναι πραγματικό· μπορεί να υπάρχουν κι άλλα.',
      truncatedMatches: 'Εμφανίζονται μόνο τα πρώτα 20.000 αποτελέσματα. Σαρώστε μικρότερο φάκελο για να δείτε τα υπόλοιπα.',
      unreadable: (path) => `Τα Windows δεν επέτρεψαν στο Prune να κοιτάξει μέσα στο ${path}.`,
      refusedRoot: {
        missing: (p) => `Το ${p} δεν είναι υπάρχων φάκελος, οπότε παραλείφθηκε.`,
        relative: (p) => `Το ${p} δεν είναι πλήρης διαδρομή, οπότε παραλείφθηκε.`,
        climb: (p) => `Το ${p} χρησιμοποιεί "..", οπότε παραλείφθηκε.`,
        protected: (p) => `Το ${p} είναι προστατευμένη θέση και δεν ελέγχεται ποτέ.`
      },
      group: {
        tickAll: (pattern) => `Επιλογή όλων των αρχείων ${pattern}`,
        showAll: (n) => `Εμφάνιση όλων (${n})`,
        showFewer: 'Εμφάνιση λιγότερων'
      },
      describe: {
        tmp: 'Προσωρινά αρχεία',
        temp: 'Προσωρινά αρχεία',
        tilde: 'Αρχεία κατόχου του Office και άλλα αρχεία ~',
        tildeExt: 'Αντίγραφα ασφαλείας επεξεργαστών',
        chk: 'Τμήματα chkdsk σε φακέλους FOUND',
        old: 'Παλιές εκδόσεις που φυλάχτηκαν στην άκρη',
        gid: 'Κρυφές μνήμες ευρετηρίου βοήθειας των Windows',
        dmp: 'Αρχεία ένδειξης σφαλμάτων',
        thumbs: 'Παλιές κρυφές μνήμες μικρογραφιών',
        bak: 'Αντίγραφα ασφαλείας, συχνά σκόπιμα',
        log: 'Αρχεία καταγραφής'
      },
      openFolder: (name) => `Άνοιγμα του φακέλου με το ${name}`,
      selected: (n, size) => `${n} επιλεγμένα · ${size}`,
      removeButton: { quarantine: 'Μετακίνηση στην Καραντίνα', recycle: 'Μετακίνηση στον Κάδο Ανακύκλωσης', delete: 'Διαγραφή' },
      confirm: {
        quarantine: (n, size) => `Μετακίνηση ${n} αρχείων (${size}) στην Καραντίνα; Μπορείτε να τα επαναφέρετε από την Καραντίνα.`,
        recycle: (n, size) => `Μετακίνηση ${n} αρχείων (${size}) στον Κάδο Ανακύκλωσης; Μπορείτε να τα επαναφέρετε από εκεί.`,
        delete: (n, size) => `Οριστική διαγραφή ${n} αρχείων (${size}); Δεν αναιρείται.`
      },
      removing: 'Αφαίρεση…',
      close: 'Κλείσιμο',
      toast: {
        removed: (n) => `Αφαιρέθηκαν ${n} άχρηστα αρχεία.`,
        kept: (n) => `${n} αρχεία έμειναν στη θέση τους.`,
        keptDetail: 'Ήταν σε χρήση, άλλαξαν μετά τη σάρωση ή δεν θεωρούνται πια άχρηστα σύμφωνα με τις ρυθμίσεις σας.'
      },
      errors: {
        noRoots: 'Επιλέξτε μονάδα δίσκου ή προσθέστε φάκελο.',
        noPatterns: 'Κανένα μοτίβο δεν είναι ενεργό. Ενεργοποιήστε μερικά στις Ρυθμίσεις › Καθαρισμός.',
        noUsableRoots: 'Καμία από αυτές τις θέσεις δεν μπορεί να ελεγχθεί.',
        failed: (m) => `Η σάρωση απέτυχε: ${m}`,
        removeFailed: (m) => `Δεν αφαιρέθηκε τίποτα: ${m}`
      },
      settings: {
        title: 'Μοτίβα άχρηστων αρχείων',
        description: 'Τι αναζητά η σάρωση Άχρηστων αρχείων του Βαθύ καθαρισμού. Τα αποτελέσματα μοτίβων με την ένδειξη Επιλεγμένο από προεπιλογή ξεκινούν επιλεγμένα, επειδή αυτά τα αρχεία είναι μόνο πρόχειρα ή ξαναφτιάχνονται μόνα τους· όλα τα άλλα τα επιλέγετε εσείς. Προγράμματα, βιβλιοθήκες και το desktop.ini δεν προτείνονται ποτέ, όποιο κι αν είναι το μοτίβο.',
        ariaLabel: 'Νέο μοτίβο άχρηστων αρχείων',
        formatHint: 'Ένα όνομα αρχείου με * για οποιουσδήποτε χαρακτήρες και ? για έναν, όπως *.tmp. Τα πεζά-κεφαλαία δεν έχουν σημασία.',
        empty: 'Κανένα μοτίβο. Προσθέστε ένα ή επαναφέρετε τις προεπιλογές.',
        lookFor: (p) => `Αναζήτηση ${p}`,
        preselected: 'Επιλεγμένο από προεπιλογή',
        remove: (p) => `Αφαίρεση ${p}`,
        reset: 'Επαναφορά προεπιλογών',
        resetConfirm: "Αντικατάσταση της λίστας σας με τις προεπιλογές; Τα μοτίβα που προσθέσατε θα αφαιρεθούν.",
        error: {
          empty: 'Πληκτρολογήστε πρώτα ένα μοτίβο.',
          long: 'Αυτό το μοτίβο είναι πολύ μεγάλο.',
          separator: 'Ένα μοτίβο είναι όνομα αρχείου, όχι φάκελος ή διαδρομή.',
          invalid: 'Περιέχει χαρακτήρα που δεν επιτρέπεται σε όνομα αρχείου.',
          everything: 'Αυτό θα ταίριαζε με κάθε αρχείο.',
          executable: 'Προγράμματα, βιβλιοθήκες, προγράμματα οδήγησης και προγράμματα εγκατάστασης δεν είναι ποτέ άχρηστα.',
          desktopIni: 'Αυτό θα ταίριαζε με το desktop.ini, που δίνει σε έναν φάκελο το εικονίδιο και το όνομά του.',
          duplicate: 'Αυτό το μοτίβο υπάρχει ήδη στη λίστα.',
          tooMany: 'Η λίστα είναι πλήρης.',
          failed: (m) => `Η αλλαγή δεν αποθηκεύτηκε: ${m}`
        }
      }
    }
  },
  es: {
    junkFiles: {
      open: 'Archivos basura',
      title: 'Archivos basura',
      intro: 'Encuentra archivos temporales, cachés y copias de seguridad que han quedado, por su nombre, en las unidades y carpetas que elijas, con los patrones de Configuración › Limpieza. No se quita nada hasta que lo marques y lo confirmes.',
      where: 'Dónde buscar',
      folderPlaceholder: 'Añade una carpeta, p. ej. D:\\Downloads',
      folderAria: 'Carpeta donde buscar',
      addFolder: 'Añadir',
      foldersLabel: 'Carpetas donde buscar',
      removeFolder: (path) => `Quitar ${path}`,
      lookingFor: 'Se busca',
      editPatterns: 'Editar patrones',
      scan: 'Analizar',
      scanAgain: 'Volver a analizar',
      noPlaces: 'Elige una unidad o añade una carpeta.',
      progress: (entries, found) => `${entries} elementos revisados · ${found} encontrados`,
      idle: 'Analizar no quita nada. Los archivos aparecen aquí según se encuentran.',
      empty: 'No se encontraron archivos basura ahí.',
      stoppedEmpty: 'Se detuvo antes de encontrar nada.',
      found: (count, size) => `${count} archivos · ${size}`,
      stopped: 'Detenido: estos se encontraron antes.',
      skipped: {
        lead: (n) => `Se dejaron intactos otros ${n} archivos que coinciden:`,
        recent: (n, hours) => `${n} modificados en las últimas ${hours} horas`,
        protected: (n) => `${n} en lugares protegidos`,
        excluded: (n) => `${n} excluidos en Configuración`,
        executable: (n) => `${n} programas o archivos del sistema`,
        folders: (n) => `No se revisaron ${n} carpetas protegidas o excluidas: Windows, Program Files, las carpetas propias de los programas instalados y tus exclusiones.`
      },
      truncated: 'El análisis llegó a su límite antes de terminar. Lo que encontró es real; puede haber más.',
      truncatedMatches: 'Solo se muestran las primeras 20.000 coincidencias. Analiza una carpeta más pequeña para ver el resto.',
      unreadable: (path) => `Windows no dejó que Prune mirara dentro de ${path}.`,
      refusedRoot: {
        missing: (p) => `${p} no es una carpeta que exista, así que se omitió.`,
        relative: (p) => `${p} no es una ruta completa, así que se omitió.`,
        climb: (p) => `${p} usa "..", así que se omitió.`,
        protected: (p) => `${p} es un lugar protegido y nunca se revisa.`
      },
      group: {
        tickAll: (pattern) => `Marcar todos los archivos ${pattern}`,
        showAll: (n) => `Mostrar los ${n}`,
        showFewer: 'Mostrar menos'
      },
      describe: {
        tmp: 'Archivos temporales',
        temp: 'Archivos temporales',
        tilde: 'Archivos de propietario de Office y otros archivos ~',
        tildeExt: 'Copias de seguridad de editores',
        chk: 'Fragmentos de chkdsk en carpetas FOUND',
        old: 'Versiones antiguas apartadas',
        gid: 'Índices de la ayuda de Windows',
        dmp: 'Volcados de bloqueos',
        thumbs: 'Cachés de miniaturas antiguas',
        bak: 'Copias de seguridad, a menudo guardadas a propósito',
        log: 'Archivos de registro'
      },
      openFolder: (name) => `Abrir la carpeta que contiene ${name}`,
      selected: (n, size) => `${n} seleccionados · ${size}`,
      removeButton: { quarantine: 'Mover a Cuarentena', recycle: 'Mover a la Papelera de reciclaje', delete: 'Eliminar' },
      confirm: {
        quarantine: (n, size) => `¿Mover ${n} archivos (${size}) a Cuarentena? Puedes recuperarlos desde Cuarentena.`,
        recycle: (n, size) => `¿Mover ${n} archivos (${size}) a la Papelera de reciclaje? Puedes recuperarlos desde allí.`,
        delete: (n, size) => `¿Eliminar ${n} archivos (${size}) definitivamente? No se puede deshacer.`
      },
      removing: 'Quitando…',
      close: 'Cerrar',
      toast: {
        removed: (n) => `Se quitaron ${n} archivos basura.`,
        kept: (n) => `${n} archivos se dejaron donde estaban.`,
        keptDetail: 'Estaban en uso, cambiaron desde el análisis o ya no cuentan como basura según tu configuración.'
      },
      errors: {
        noRoots: 'Elige una unidad o añade una carpeta.',
        noPatterns: 'No hay ningún patrón activado. Activa algunos en Configuración › Limpieza.',
        noUsableRoots: 'No se puede revisar ninguno de esos lugares.',
        failed: (m) => `El análisis falló: ${m}`,
        removeFailed: (m) => `No se quitó nada: ${m}`
      },
      settings: {
        title: 'Patrones de archivos basura',
        description: 'Lo que busca el análisis de Archivos basura de Limpieza profunda. Los resultados de los patrones marcados como Marcado de forma predeterminada aparecen marcados, porque esos archivos solo son provisionales o se regeneran solos; el resto lo marcas tú. Los programas, las bibliotecas y desktop.ini no se ofrecen nunca, sea cual sea el patrón.',
        ariaLabel: 'Nuevo patrón de archivos basura',
        formatHint: 'Un nombre de archivo con * para cualquier carácter y ? para uno solo, como *.tmp. Las mayúsculas no importan.',
        empty: 'Sin patrones. Añade uno o restablece los predeterminados.',
        lookFor: (p) => `Buscar ${p}`,
        preselected: 'Marcado de forma predeterminada',
        remove: (p) => `Quitar ${p}`,
        reset: 'Restablecer predeterminados',
        resetConfirm: "¿Sustituir tu lista por los predeterminados? Se quitarán los patrones que añadiste.",
        error: {
          empty: 'Escribe primero un patrón.',
          long: 'Ese patrón es demasiado largo.',
          separator: 'Un patrón es un nombre de archivo, no una carpeta ni una ruta.',
          invalid: 'Contiene un carácter que ningún nombre de archivo puede tener.',
          everything: 'Coincidiría con todos los archivos.',
          executable: 'Los programas, las bibliotecas, los controladores y los instaladores nunca son basura.',
          desktopIni: 'Coincidiría con desktop.ini, que da a una carpeta su icono y su nombre.',
          duplicate: 'Ese patrón ya está en la lista.',
          tooMany: 'La lista está llena.',
          failed: (m) => `No se guardó el cambio: ${m}`
        }
      }
    }
  },
  et: {
    junkFiles: {
      open: 'Rämpsfailid',
      title: 'Rämpsfailid',
      intro: 'Leiab maha jäänud ajutised failid, vahemälud ja varukoopiad nime järgi sinu valitud ketastelt ja kaustadest, kasutades mustreid jaotisest Seaded › Puhastamine. Midagi ei eemaldata enne, kui märgid selle ja kinnitad.',
      where: 'Kust otsida',
      folderPlaceholder: 'Lisa kaust, nt D:\\Downloads',
      folderAria: 'Otsitav kaust',
      addFolder: 'Lisa',
      foldersLabel: 'Otsitavad kaustad',
      removeFolder: (path) => `Eemalda ${path}`,
      lookingFor: 'Otsitakse',
      editPatterns: 'Muuda mustreid',
      scan: 'Otsi',
      scanAgain: 'Otsi uuesti',
      noPlaces: 'Vali ketas või lisa kaust.',
      progress: (entries, found) => `Läbi vaadatud ${entries} üksust · leitud ${found}`,
      idle: 'Otsimine ei eemalda midagi. Failid ilmuvad siia nende leidmise järel.',
      empty: 'Sealt ei leitud rämpsfaile.',
      stoppedEmpty: 'Peatati enne, kui midagi leiti.',
      found: (count, size) => `${count} faili · ${size}`,
      stopped: 'Peatatud: need leiti enne seda.',
      skipped: {
        lead: (n) => `Veel ${n} sobivat faili jäeti puutumata:`,
        recent: (n, hours) => `${n} muudetud viimase ${hours} tunni jooksul`,
        protected: (n) => `${n} kaitstud kohtades`,
        excluded: (n) => `${n} seadetes välja jäetud`,
        executable: (n) => `${n} programmi või süsteemifaili`,
        folders: (n) => `${n} kaitstud või välja jäetud kausta jäi läbi vaatamata: Windows, Program Files, paigaldatud programmide oma kaustad ja sinu erandid.`
      },
      truncated: 'Otsing jõudis piirini enne lõpetamist. Leitu on päris; neid võib olla rohkem.',
      truncatedMatches: 'Loetletakse ainult esimesed 20 000 vastet. Ülejäänu nägemiseks otsi väiksemast kaustast.',
      unreadable: (path) => `Windows ei lubanud Prune'il kausta ${path} sisse vaadata.`,
      refusedRoot: {
        missing: (p) => `${p} pole olemasolev kaust, seega jäeti see vahele.`,
        relative: (p) => `${p} pole täielik tee, seega jäeti see vahele.`,
        climb: (p) => `${p} kasutab "..", seega jäeti see vahele.`,
        protected: (p) => `${p} on kaitstud koht ja seda ei vaadata kunagi läbi.`
      },
      group: {
        tickAll: (pattern) => `Märgi kõik ${pattern}-failid`,
        showAll: (n) => `Näita kõiki ${n}`,
        showFewer: 'Näita vähem'
      },
      describe: {
        tmp: 'Ajutised failid',
        temp: 'Ajutised failid',
        tilde: 'Office’i omanikufailid ja muud ~-failid',
        tildeExt: 'Redaktorite varukoopiad',
        chk: 'chkdsk-i killud FOUND-kaustades',
        old: 'Kõrvale pandud vanad versioonid',
        gid: 'Windowsi spikri registri vahemälud',
        dmp: 'Krahhitõmmised',
        thumbs: 'Vanad pisipiltide vahemälud',
        bak: 'Varukoopiad, sageli meelega hoitud',
        log: 'Logifailid'
      },
      openFolder: (name) => `Ava kaust, kus on ${name}`,
      selected: (n, size) => `${n} valitud · ${size}`,
      removeButton: { quarantine: 'Teisalda karantiini', recycle: 'Teisalda prügikasti', delete: 'Kustuta' },
      confirm: {
        quarantine: (n, size) => `Kas teisaldada ${n} faili (${size}) karantiini? Saad need karantiinist tagasi panna.`,
        recycle: (n, size) => `Kas teisaldada ${n} faili (${size}) prügikasti? Saad need sealt tagasi panna.`,
        delete: (n, size) => `Kas kustutada ${n} faili (${size}) jäädavalt? Seda ei saa tagasi võtta.`
      },
      removing: 'Eemaldamine…',
      close: 'Sulge',
      toast: {
        removed: (n) => `Eemaldati ${n} rämpsfaili.`,
        kept: (n) => `${n} faili jäeti oma kohale.`,
        keptDetail: 'Need olid kasutusel, muutusid pärast otsingut või ei loe sinu seadete järgi enam rämpsuks.'
      },
      errors: {
        noRoots: 'Vali ketas või lisa kaust.',
        noPatterns: 'Ükski muster pole sisse lülitatud. Lülita mõni sisse jaotises Seaded › Puhastamine.',
        noUsableRoots: 'Ühtegi neist kohtadest ei saa läbi vaadata.',
        failed: (m) => `Otsing nurjus: ${m}`,
        removeFailed: (m) => `Midagi ei eemaldatud: ${m}`
      },
      settings: {
        title: 'Rämpsfailide mustrid',
        description: 'Mida süvapuhastuse rämpsfailide otsing otsib. Mustrite, mis on märgistatud Vaikimisi märgitud, tulemused on alguses märgitud, sest need failid on vaid ajutised või ehitavad end ise uuesti üles; kõik muu märgid ise. Programme, teeke ja desktop.ini-t ei pakuta kunagi, olgu muster milline tahes.',
        ariaLabel: 'Uus rämpsfailide muster',
        formatHint: 'Failinimi, kus * tähistab mis tahes märke ja ? üht märki, näiteks *.tmp. Täheregistril pole tähtsust.',
        empty: 'Mustreid pole. Lisa üks või lähtesta vaikeväärtustele.',
        lookFor: (p) => `Otsi ${p}`,
        preselected: 'Vaikimisi märgitud',
        remove: (p) => `Eemalda ${p}`,
        reset: 'Lähtesta vaikeväärtustele',
        resetConfirm: "Kas asendada loend vaikeväärtustega? Sinu lisatud mustrid eemaldatakse.",
        error: {
          empty: 'Sisesta kõigepealt muster.',
          long: 'See muster on liiga pikk.',
          separator: 'Muster on failinimi, mitte kaust ega tee.',
          invalid: 'See sisaldab märki, mida failinimes olla ei saa.',
          everything: 'See sobiks iga failiga.',
          executable: 'Programmid, teegid, draiverid ja installerid pole kunagi rämps.',
          desktopIni: 'See sobiks failiga desktop.ini, mis annab kaustale selle ikooni ja nime.',
          duplicate: 'See muster on juba loendis.',
          tooMany: 'Loend on täis.',
          failed: (m) => `Muudatust ei salvestatud: ${m}`
        }
      }
    }
  },
  fi: {
    junkFiles: {
      open: 'Roskatiedostot',
      title: 'Roskatiedostot',
      intro: 'Etsii jääneet väliaikaistiedostot, välimuistit ja varmuuskopiot nimen perusteella valitsemiltasi asemilta ja kansioista käyttäen kohdan Asetukset › Siivous malleja. Mitään ei poisteta ennen kuin valitset sen ja vahvistat.',
      where: 'Mistä etsitään',
      folderPlaceholder: 'Lisää kansio, esim. D:\\Downloads',
      folderAria: 'Etsittävä kansio',
      addFolder: 'Lisää',
      foldersLabel: 'Etsittävät kansiot',
      removeFolder: (path) => `Poista ${path}`,
      lookingFor: 'Etsitään',
      editPatterns: 'Muokkaa malleja',
      scan: 'Etsi',
      scanAgain: 'Etsi uudelleen',
      noPlaces: 'Valitse asema tai lisää kansio.',
      progress: (entries, found) => `Käyty läpi ${entries} kohdetta · löytyi ${found}`,
      idle: 'Etsiminen ei poista mitään. Tiedostot näkyvät tässä sitä mukaa kuin niitä löytyy.',
      empty: 'Sieltä ei löytynyt roskatiedostoja.',
      stoppedEmpty: 'Pysäytettiin ennen kuin mitään löytyi.',
      found: (count, size) => `${count} tiedostoa · ${size}`,
      stopped: 'Pysäytetty: nämä löytyivät sitä ennen.',
      skipped: {
        lead: (n) => `${n} muuta täsmäävää tiedostoa jätettiin rauhaan:`,
        recent: (n, hours) => `${n} muuttunut viimeisen ${hours} tunnin aikana`,
        protected: (n) => `${n} suojatuissa paikoissa`,
        excluded: (n) => `${n} rajattu pois asetuksissa`,
        executable: (n) => `${n} ohjelmaa tai järjestelmätiedostoa`,
        folders: (n) => `${n} suojattua tai pois rajattua kansiota jätettiin läpikäymättä: Windows, Program Files, asennettujen ohjelmien omat kansiot ja omat poissulkemisesi.`
      },
      truncated: 'Etsintä saavutti rajansa ennen kuin se valmistui. Löydetty on todellista; muitakin voi olla.',
      truncatedMatches: 'Vain ensimmäiset 20 000 osumaa näytetään. Etsi pienemmästä kansiosta nähdäksesi loput.',
      unreadable: (path) => `Windows ei antanut Prunen katsoa kansioon ${path}.`,
      refusedRoot: {
        missing: (p) => `${p} ei ole olemassa oleva kansio, joten se ohitettiin.`,
        relative: (p) => `${p} ei ole täydellinen polku, joten se ohitettiin.`,
        climb: (p) => `${p} käyttää merkintää "..", joten se ohitettiin.`,
        protected: (p) => `${p} on suojattu paikka, eikä sitä käydä koskaan läpi.`
      },
      group: {
        tickAll: (pattern) => `Valitse kaikki ${pattern}-tiedostot`,
        showAll: (n) => `Näytä kaikki ${n}`,
        showFewer: 'Näytä vähemmän'
      },
      describe: {
        tmp: 'Väliaikaistiedostot',
        temp: 'Väliaikaistiedostot',
        tilde: 'Officen omistajatiedostot ja muut ~-tiedostot',
        tildeExt: 'Editorien varmuuskopiot',
        chk: 'chkdsk-palaset FOUND-kansioissa',
        old: 'Sivuun siirretyt vanhat versiot',
        gid: 'Windowsin ohjeen hakemistovälimuistit',
        dmp: 'Kaatumisvedokset',
        thumbs: 'Vanhat pikkukuvavälimuistit',
        bak: 'Varmuuskopiot, usein tarkoituksella säilytetyt',
        log: 'Lokitiedostot'
      },
      openFolder: (name) => `Avaa kansio, jossa ${name} on`,
      selected: (n, size) => `${n} valittu · ${size}`,
      removeButton: { quarantine: 'Siirrä karanteeniin', recycle: 'Siirrä roskakoriin', delete: 'Poista' },
      confirm: {
        quarantine: (n, size) => `Siirretäänkö ${n} tiedostoa (${size}) karanteeniin? Voit palauttaa ne karanteenista.`,
        recycle: (n, size) => `Siirretäänkö ${n} tiedostoa (${size}) roskakoriin? Voit palauttaa ne sieltä.`,
        delete: (n, size) => `Poistetaanko ${n} tiedostoa (${size}) pysyvästi? Tätä ei voi kumota.`
      },
      removing: 'Poistetaan…',
      close: 'Sulje',
      toast: {
        removed: (n) => `Poistettiin ${n} roskatiedostoa.`,
        kept: (n) => `${n} tiedostoa jätettiin paikalleen.`,
        keptDetail: 'Ne olivat käytössä, muuttuivat etsinnän jälkeen tai eivät asetustesi mukaan enää ole roskaa.'
      },
      errors: {
        noRoots: 'Valitse asema tai lisää kansio.',
        noPatterns: 'Yhtään mallia ei ole otettu käyttöön. Ota joitakin käyttöön kohdassa Asetukset › Siivous.',
        noUsableRoots: 'Mitään näistä paikoista ei voi käydä läpi.',
        failed: (m) => `Etsintä epäonnistui: ${m}`,
        removeFailed: (m) => `Mitään ei poistettu: ${m}`
      },
      settings: {
        title: 'Roskatiedostojen mallit',
        description: 'Mitä Syväpuhdistuksen roskatiedostohaku etsii. Mallien, joissa on merkintä Valittu oletuksena, tulokset ovat valmiiksi valittuina, koska ne tiedostot ovat vain väliaikaisia tai rakentuvat itse uudelleen; kaiken muun valitset itse. Ohjelmia, kirjastoja ja desktop.ini-tiedostoa ei koskaan tarjota, oli malli mikä tahansa.',
        ariaLabel: 'Uusi roskatiedostojen malli',
        formatHint: 'Tiedostonimi, jossa * tarkoittaa mitä tahansa merkkejä ja ? yhtä merkkiä, kuten *.tmp. Kirjainkoolla ei ole väliä.',
        empty: 'Ei malleja. Lisää yksi tai palauta oletukset.',
        lookFor: (p) => `Etsi ${p}`,
        preselected: 'Valittu oletuksena',
        remove: (p) => `Poista ${p}`,
        reset: 'Palauta oletukset',
        resetConfirm: "Korvataanko luettelo oletuksilla? Lisäämäsi mallit poistetaan.",
        error: {
          empty: 'Kirjoita ensin malli.',
          long: 'Malli on liian pitkä.',
          separator: 'Malli on tiedostonimi, ei kansio tai polku.',
          invalid: 'Siinä on merkki, jota tiedostonimessä ei voi olla.',
          everything: 'Se täsmäisi jokaiseen tiedostoon.',
          executable: 'Ohjelmat, kirjastot, ajurit ja asennusohjelmat eivät ole koskaan roskaa.',
          desktopIni: 'Se täsmäisi tiedostoon desktop.ini, joka antaa kansiolle sen kuvakkeen ja nimen.',
          duplicate: 'Malli on jo luettelossa.',
          tooMany: 'Luettelo on täynnä.',
          failed: (m) => `Muutosta ei tallennettu: ${m}`
        }
      }
    }
  },
  fr: {
    junkFiles: {
      open: 'Fichiers inutiles',
      title: 'Fichiers inutiles',
      intro: 'Retrouve par leur nom les fichiers temporaires, caches et sauvegardes laissés sur les lecteurs et dossiers que vous choisissez, d’après les modèles de Paramètres › Nettoyage. Rien n’est supprimé avant que vous le cochiez et confirmiez.',
      where: 'Où chercher',
      folderPlaceholder: 'Ajoutez un dossier, p. ex. D:\\Downloads',
      folderAria: 'Dossier à parcourir',
      addFolder: 'Ajouter',
      foldersLabel: 'Dossiers à parcourir',
      removeFolder: (path) => `Retirer ${path}`,
      lookingFor: 'Recherche',
      editPatterns: 'Modifier les modèles',
      scan: 'Analyser',
      scanAgain: 'Analyser à nouveau',
      noPlaces: 'Choisissez un lecteur ou ajoutez un dossier.',
      progress: (entries, found) => `${entries} éléments parcourus · ${found} trouvés`,
      idle: 'L’analyse ne supprime rien. Les fichiers apparaissent ici au fur et à mesure.',
      empty: 'Aucun fichier inutile trouvé à cet endroit.',
      stoppedEmpty: 'Arrêté avant d’avoir trouvé quoi que ce soit.',
      found: (count, size) => `${count} fichiers · ${size}`,
      stopped: 'Arrêté : ceux-ci ont été trouvés avant.',
      skipped: {
        lead: (n) => `${n} autres fichiers correspondants ont été laissés tels quels :`,
        recent: (n, hours) => `${n} modifiés au cours des ${hours} dernières heures`,
        protected: (n) => `${n} dans des emplacements protégés`,
        excluded: (n) => `${n} exclus dans les Paramètres`,
        executable: (n) => `${n} programmes ou fichiers système`,
        folders: (n) => `${n} dossiers protégés ou exclus n’ont pas été parcourus : Windows, Program Files, les dossiers propres aux programmes installés et vos exclusions.`
      },
      truncated: 'L’analyse a atteint sa limite avant de finir. Ce qu’elle a trouvé est réel ; il peut y en avoir davantage.',
      truncatedMatches: 'Seules les 20 000 premières correspondances sont listées. Analysez un dossier plus petit pour voir le reste.',
      unreadable: (path) => `Windows n’a pas laissé Prune regarder dans ${path}.`,
      refusedRoot: {
        missing: (p) => `${p} n’est pas un dossier existant ; il a été ignoré.`,
        relative: (p) => `${p} n’est pas un chemin complet ; il a été ignoré.`,
        climb: (p) => `${p} utilise « .. » ; il a été ignoré.`,
        protected: (p) => `${p} est un emplacement protégé et n’est jamais parcouru.`
      },
      group: {
        tickAll: (pattern) => `Cocher tous les fichiers ${pattern}`,
        showAll: (n) => `Tout afficher (${n})`,
        showFewer: 'Afficher moins'
      },
      describe: {
        tmp: 'Fichiers temporaires',
        temp: 'Fichiers temporaires',
        tilde: 'Fichiers propriétaires d’Office et autres fichiers ~',
        tildeExt: 'Copies de sauvegarde d’éditeurs',
        chk: 'Fragments chkdsk dans les dossiers FOUND',
        old: 'Anciennes versions mises de côté',
        gid: 'Caches d’index de l’aide Windows',
        dmp: 'Vidages après plantage',
        thumbs: 'Anciens caches de miniatures',
        bak: 'Sauvegardes, souvent gardées exprès',
        log: 'Fichiers journaux'
      },
      openFolder: (name) => `Ouvrir le dossier contenant ${name}`,
      selected: (n, size) => `${n} sélectionnés · ${size}`,
      removeButton: { quarantine: 'Déplacer en Quarantaine', recycle: 'Déplacer vers la Corbeille', delete: 'Supprimer' },
      confirm: {
        quarantine: (n, size) => `Déplacer ${n} fichiers (${size}) en Quarantaine ? Vous pourrez les remettre en place depuis la Quarantaine.`,
        recycle: (n, size) => `Déplacer ${n} fichiers (${size}) vers la Corbeille ? Vous pourrez les remettre en place depuis celle-ci.`,
        delete: (n, size) => `Supprimer définitivement ${n} fichiers (${size}) ? C’est irréversible.`
      },
      removing: 'Suppression…',
      close: 'Fermer',
      toast: {
        removed: (n) => `${n} fichiers inutiles supprimés.`,
        kept: (n) => `${n} fichiers ont été laissés en place.`,
        keptDetail: 'Ils étaient utilisés, ont changé depuis l’analyse ou ne comptent plus comme inutiles selon vos paramètres.'
      },
      errors: {
        noRoots: 'Choisissez un lecteur ou ajoutez un dossier.',
        noPatterns: 'Aucun modèle n’est activé. Activez-en dans Paramètres › Nettoyage.',
        noUsableRoots: 'Aucun de ces emplacements ne peut être parcouru.',
        failed: (m) => `L’analyse a échoué : ${m}`,
        removeFailed: (m) => `Rien n’a été supprimé : ${m}`
      },
      settings: {
        title: 'Modèles de fichiers inutiles',
        description: 'Ce que cherche l’analyse Fichiers inutiles du Nettoyage approfondi. Les résultats des modèles marqués Coché par défaut sont cochés d’emblée, car ces fichiers ne sont que des brouillons ou se reconstruisent seuls ; le reste, vous le cochez vous-même. Les programmes, les bibliothèques et desktop.ini ne sont jamais proposés, quel que soit le modèle.',
        ariaLabel: 'Nouveau modèle de fichier inutile',
        formatHint: 'Un nom de fichier avec * pour n’importe quels caractères et ? pour un seul, comme *.tmp. La casse n’a pas d’importance.',
        empty: 'Aucun modèle. Ajoutez-en un ou rétablissez les valeurs par défaut.',
        lookFor: (p) => `Rechercher ${p}`,
        preselected: 'Coché par défaut',
        remove: (p) => `Retirer ${p}`,
        reset: 'Rétablir les valeurs par défaut',
        resetConfirm: "Remplacer votre liste par les valeurs par défaut ? Les modèles que vous avez ajoutés seront retirés.",
        error: {
          empty: 'Saisissez d’abord un modèle.',
          long: 'Ce modèle est trop long.',
          separator: 'Un modèle est un nom de fichier, pas un dossier ni un chemin.',
          invalid: 'Il contient un caractère qu’aucun nom de fichier ne peut avoir.',
          everything: 'Cela correspondrait à tous les fichiers.',
          executable: 'Les programmes, bibliothèques, pilotes et programmes d’installation ne sont jamais inutiles.',
          desktopIni: 'Cela correspondrait à desktop.ini, qui donne à un dossier son icône et son nom.',
          duplicate: 'Ce modèle est déjà dans la liste.',
          tooMany: 'La liste est pleine.',
          failed: (m) => `La modification n’a pas été enregistrée : ${m}`
        }
      }
    }
  },
  he: {
    junkFiles: {
      open: 'קובצי זבל',
      title: 'קובצי זבל',
      intro: 'מוצא לפי שם קבצים זמניים, מטמונים וגיבויים שנשארו בכוננים ובתיקיות שתבחר, לפי התבניות שבהגדרות › ניקוי. שום דבר לא מוסר לפני שתסמן ותאשר.',
      where: 'היכן לחפש',
      folderPlaceholder: 'הוסף תיקייה, למשל D:\\Downloads',
      folderAria: 'תיקייה לחיפוש',
      addFolder: 'הוסף',
      foldersLabel: 'תיקיות לחיפוש',
      removeFolder: (path) => `הסר את ${path}`,
      lookingFor: 'מחפש',
      editPatterns: 'ערוך תבניות',
      scan: 'סרוק',
      scanAgain: 'סרוק שוב',
      noPlaces: 'בחר כונן או הוסף תיקייה.',
      progress: (entries, found) => `נבדקו ${entries} פריטים · נמצאו ${found}`,
      idle: 'הסריקה לא מסירה דבר. קבצים מופיעים כאן כשהם נמצאים.',
      empty: 'לא נמצאו שם קובצי זבל.',
      stoppedEmpty: 'נעצר לפני שנמצא משהו.',
      found: (count, size) => `${count} קבצים · ${size}`,
      stopped: 'נעצר: אלה נמצאו לפני כן.',
      skipped: {
        lead: (n) => `עוד ${n} קבצים תואמים נשארו ללא שינוי:`,
        recent: (n, hours) => `${n} השתנו ב-${hours} השעות האחרונות`,
        protected: (n) => `${n} במקומות מוגנים`,
        excluded: (n) => `${n} הוחרגו בהגדרות`,
        executable: (n) => `${n} תוכניות או קובצי מערכת`,
        folders: (n) => `${n} תיקיות מוגנות או מוחרגות לא נבדקו: Windows, ‏Program Files, התיקיות של תוכניות מותקנות וההחרגות שלך.`
      },
      truncated: 'הסריקה הגיעה למגבלה שלה לפני שהסתיימה. מה שנמצא אמיתי; ייתכן שיש עוד.',
      truncatedMatches: 'מוצגות רק 20,000 ההתאמות הראשונות. סרוק תיקייה קטנה יותר כדי לראות את השאר.',
      unreadable: (path) => `Windows לא אפשר ל-Prune להציץ לתוך ${path}.`,
      refusedRoot: {
        missing: (p) => `${p} אינה תיקייה קיימת, ולכן דולגה.`,
        relative: (p) => `${p} אינו נתיב מלא, ולכן דולג.`,
        climb: (p) => `${p} משתמש ב-"..", ולכן דולג.`,
        protected: (p) => `${p} הוא מקום מוגן ולעולם אינו נבדק.`
      },
      group: {
        tickAll: (pattern) => `סמן את כל קובצי ${pattern}`,
        showAll: (n) => `הצג את כל ${n}`,
        showFewer: 'הצג פחות'
      },
      describe: {
        tmp: 'קבצים זמניים',
        temp: 'קבצים זמניים',
        tilde: 'קובצי בעלים של Office וקובצי ~ אחרים',
        tildeExt: 'עותקי גיבוי של עורכים',
        chk: 'מקטעי chkdsk בתיקיות FOUND',
        old: 'גרסאות ישנות שהונחו בצד',
        gid: 'מטמוני אינדקס של עזרת Windows',
        dmp: 'קובצי קריסה',
        thumbs: 'מטמוני תמונות ממוזערות ישנים',
        bak: 'גיבויים, לרוב נשמרים בכוונה',
        log: 'קובצי יומן'
      },
      openFolder: (name) => `פתח את התיקייה שמכילה את ${name}`,
      selected: (n, size) => `${n} נבחרו · ${size}`,
      removeButton: { quarantine: 'העבר להסגר', recycle: 'העבר לסל המיחזור', delete: 'מחק' },
      confirm: {
        quarantine: (n, size) => `להעביר ${n} קבצים (${size}) להסגר? אפשר להחזיר אותם מההסגר.`,
        recycle: (n, size) => `להעביר ${n} קבצים (${size}) לסל המיחזור? אפשר להחזיר אותם משם.`,
        delete: (n, size) => `למחוק ${n} קבצים (${size}) לצמיתות? אי אפשר לבטל זאת.`
      },
      removing: 'מסיר…',
      close: 'סגור',
      toast: {
        removed: (n) => `הוסרו ${n} קובצי זבל.`,
        kept: (n) => `${n} קבצים נשארו במקומם.`,
        keptDetail: 'הם היו בשימוש, השתנו מאז הסריקה או שלפי ההגדרות שלך כבר אינם נחשבים זבל.'
      },
      errors: {
        noRoots: 'בחר כונן או הוסף תיקייה.',
        noPatterns: 'אין תבניות פעילות. הפעל חלק מהן בהגדרות › ניקוי.',
        noUsableRoots: 'אי אפשר לחפש באף אחד מהמקומות האלה.',
        failed: (m) => `הסריקה נכשלה: ${m}`,
        removeFailed: (m) => `שום דבר לא הוסר: ${m}`
      },
      settings: {
        title: 'תבניות של קובצי זבל',
        description: 'מה סריקת קובצי הזבל של הניקוי המעמיק מחפשת. תוצאות של תבניות המסומנות "מסומן כברירת מחדל" מתחילות מסומנות, כי הקבצים האלה זמניים בלבד או נבנים מחדש מעצמם; את כל השאר אתה מסמן בעצמך. תוכניות, ספריות ו-desktop.ini לעולם אינם מוצעים, תהא התבנית אשר תהא.',
        ariaLabel: 'תבנית חדשה לקובצי זבל',
        formatHint: 'שם קובץ עם * לכל תווים ו-? לתו אחד, כמו *.tmp. אין הבדל בין אותיות גדולות לקטנות.',
        empty: 'אין תבניות. הוסף אחת או אפס לברירות המחדל.',
        lookFor: (p) => `חפש ${p}`,
        preselected: 'מסומן כברירת מחדל',
        remove: (p) => `הסר את ${p}`,
        reset: 'אפס לברירות המחדל',
        resetConfirm: "להחליף את הרשימה שלך בברירות המחדל? התבניות שהוספת יוסרו.",
        error: {
          empty: 'הקלד קודם תבנית.',
          long: 'התבנית ארוכה מדי.',
          separator: 'תבנית היא שם קובץ, לא תיקייה או נתיב.',
          invalid: 'יש בה תו ששום שם קובץ לא יכול להכיל.',
          everything: 'זה יתאים לכל קובץ.',
          executable: 'תוכניות, ספריות, מנהלי התקנים ותוכניות התקנה לעולם אינם זבל.',
          desktopIni: 'זה יתאים ל-desktop.ini, שנותן לתיקייה את הסמל והשם שלה.',
          duplicate: 'התבנית כבר ברשימה.',
          tooMany: 'הרשימה מלאה.',
          failed: (m) => `השינוי לא נשמר: ${m}`
        }
      }
    }
  },
  hu: {
    junkFiles: {
      open: 'Felesleges fájlok',
      title: 'Felesleges fájlok',
      intro: 'Név alapján megkeresi a hátramaradt ideiglenes fájlokat, gyorsítótárakat és biztonsági másolatokat a kiválasztott meghajtókon és mappákban, a Beállítások › Tisztítás mintái szerint. Semmi sem törlődik, amíg be nem jelölöd és jóvá nem hagyod.',
      where: 'Hol keressen',
      folderPlaceholder: 'Mappa hozzáadása, pl. D:\\Downloads',
      folderAria: 'Átkutatandó mappa',
      addFolder: 'Hozzáadás',
      foldersLabel: 'Átkutatandó mappák',
      removeFolder: (path) => `${path} eltávolítása`,
      lookingFor: 'Keresett minták',
      editPatterns: 'Minták szerkesztése',
      scan: 'Keresés',
      scanAgain: 'Újrakeresés',
      noPlaces: 'Válassz meghajtót, vagy adj hozzá mappát.',
      progress: (entries, found) => `${entries} elem átnézve · ${found} találat`,
      idle: 'A keresés semmit sem töröl. A fájlok itt jelennek meg, ahogy előkerülnek.',
      empty: 'Ott nincsenek felesleges fájlok.',
      stoppedEmpty: 'Leállítva, mielőtt bármi előkerült volna.',
      found: (count, size) => `${count} fájl · ${size}`,
      stopped: 'Leállítva: ezek addig kerültek elő.',
      skipped: {
        lead: (n) => `További ${n} illeszkedő fájl érintetlen maradt:`,
        recent: (n, hours) => `${n} az elmúlt ${hours} órában módosult`,
        protected: (n) => `${n} védett helyen van`,
        excluded: (n) => `${n} kizárva a Beállításokban`,
        executable: (n) => `${n} program vagy rendszerfájl`,
        folders: (n) => `${n} védett vagy kizárt mappa nem lett átnézve: a Windows, a Program Files, a telepített programok saját mappái és a kizárásaid.`
      },
      truncated: 'A keresés elérte a korlátját, mielőtt befejeződött. Amit talált, valódi; lehet még több is.',
      truncatedMatches: 'Csak az első 20 000 találat látszik. A többihez keress egy kisebb mappában.',
      unreadable: (path) => `A Windows nem engedte, hogy a Prune belenézzen ide: ${path}.`,
      refusedRoot: {
        missing: (p) => `${p} nem létező mappa, ezért kimaradt.`,
        relative: (p) => `${p} nem teljes elérési út, ezért kimaradt.`,
        climb: (p) => `${p} ".." elemet használ, ezért kimaradt.`,
        protected: (p) => `${p} védett hely, és sosem kerül átnézésre.`
      },
      group: {
        tickAll: (pattern) => `Minden ${pattern} fájl bejelölése`,
        showAll: (n) => `Mind a(z) ${n} mutatása`,
        showFewer: 'Kevesebb mutatása'
      },
      describe: {
        tmp: 'Ideiglenes fájlok',
        temp: 'Ideiglenes fájlok',
        tilde: 'Office-tulajdonosfájlok és más ~ fájlok',
        tildeExt: 'Szerkesztők biztonsági másolatai',
        chk: 'chkdsk-töredékek FOUND mappákban',
        old: 'Félretett régi verziók',
        gid: 'A Windows súgó indexgyorsítótárai',
        dmp: 'Összeomlási memóriaképek',
        thumbs: 'Régi miniatűr-gyorsítótárak',
        bak: 'Biztonsági másolatok, gyakran szándékosan megtartva',
        log: 'Naplófájlok'
      },
      openFolder: (name) => `A(z) ${name} mappájának megnyitása`,
      selected: (n, size) => `${n} kijelölve · ${size}`,
      removeButton: { quarantine: 'Áthelyezés a Karanténba', recycle: 'Áthelyezés a Lomtárba', delete: 'Törlés' },
      confirm: {
        quarantine: (n, size) => `Áthelyezel ${n} fájlt (${size}) a Karanténba? A Karanténból visszateheted őket.`,
        recycle: (n, size) => `Áthelyezel ${n} fájlt (${size}) a Lomtárba? Onnan visszateheted őket.`,
        delete: (n, size) => `Végleg törölsz ${n} fájlt (${size})? Ez nem vonható vissza.`
      },
      removing: 'Eltávolítás…',
      close: 'Bezárás',
      toast: {
        removed: (n) => `${n} felesleges fájl eltávolítva.`,
        kept: (n) => `${n} fájl a helyén maradt.`,
        keptDetail: 'Használatban voltak, a keresés óta megváltoztak, vagy a beállításaid szerint már nem számítanak feleslegesnek.'
      },
      errors: {
        noRoots: 'Válassz meghajtót, vagy adj hozzá mappát.',
        noPatterns: 'Nincs bekapcsolt minta. Kapcsolj be néhányat a Beállítások › Tisztítás alatt.',
        noUsableRoots: 'Egyik hely sem kutatható át.',
        failed: (m) => `A keresés nem sikerült: ${m}`,
        removeFailed: (m) => `Semmi sem lett eltávolítva: ${m}`
      },
      settings: {
        title: 'Felesleges fájlok mintái',
        description: 'Amit a Mélytisztítás felesleges fájlokat kereső funkciója keres. Az Alapértelmezetten bejelölve jelzésű minták találatai bejelölve indulnak, mert ezek a fájlok csak munkafájlok, vagy maguktól újraépülnek; minden mást te jelölsz be. Programokat, könyvtárakat és a desktop.ini fájlt sosem ajánl fel, bármi is a minta.',
        ariaLabel: 'Új minta felesleges fájlokhoz',
        formatHint: 'Fájlnév, amelyben a * tetszőleges karaktereket, a ? egy karaktert jelent, például *.tmp. A kis- és nagybetű nem számít.',
        empty: 'Nincsenek minták. Adj hozzá egyet, vagy állítsd vissza az alapértelmezetteket.',
        lookFor: (p) => `${p} keresése`,
        preselected: 'Alapértelmezetten bejelölve',
        remove: (p) => `${p} eltávolítása`,
        reset: 'Alapértelmezések visszaállítása',
        resetConfirm: "Lecseréled a listát az alapértelmezésekre? Az általad hozzáadott minták törlődnek.",
        error: {
          empty: 'Előbb írj be egy mintát.',
          long: 'Ez a minta túl hosszú.',
          separator: 'A minta fájlnév, nem mappa vagy elérési út.',
          invalid: 'Olyan karaktert tartalmaz, amely fájlnévben nem lehet.',
          everything: 'Ez minden fájlra illeszkedne.',
          executable: 'Programok, könyvtárak, illesztőprogramok és telepítők sosem feleslegesek.',
          desktopIni: 'Ez illeszkedne a desktop.ini fájlra, amely a mappa ikonját és nevét adja.',
          duplicate: 'Ez a minta már szerepel a listában.',
          tooMany: 'A lista megtelt.',
          failed: (m) => `A módosítás nem lett mentve: ${m}`
        }
      }
    }
  },
  id: {
    junkFiles: {
      open: 'File sampah',
      title: 'File sampah',
      intro: 'Menemukan file sementara, cache, dan cadangan yang tertinggal berdasarkan nama di drive dan folder yang Anda pilih, memakai pola di Pengaturan › Pembersihan. Tidak ada yang dihapus sampai Anda mencentangnya dan mengonfirmasi.',
      where: 'Tempat mencari',
      folderPlaceholder: 'Tambahkan folder, mis. D:\\Downloads',
      folderAria: 'Folder yang dicari',
      addFolder: 'Tambah',
      foldersLabel: 'Folder yang dicari',
      removeFolder: (path) => `Hapus ${path} dari daftar`,
      lookingFor: 'Mencari',
      editPatterns: 'Ubah pola',
      scan: 'Pindai',
      scanAgain: 'Pindai lagi',
      noPlaces: 'Pilih drive atau tambahkan folder.',
      progress: (entries, found) => `${entries} item diperiksa · ${found} ditemukan`,
      idle: 'Pemindaian tidak menghapus apa pun. File muncul di sini saat ditemukan.',
      empty: 'Tidak ada file sampah di sana.',
      stoppedEmpty: 'Dihentikan sebelum ada yang ditemukan.',
      found: (count, size) => `${count} file · ${size}`,
      stopped: 'Dihentikan: file ini ditemukan sebelumnya.',
      skipped: {
        lead: (n) => `${n} file cocok lainnya dibiarkan:`,
        recent: (n, hours) => `${n} berubah dalam ${hours} jam terakhir`,
        protected: (n) => `${n} di lokasi yang dilindungi`,
        excluded: (n) => `${n} dikecualikan di Pengaturan`,
        executable: (n) => `${n} program atau file sistem`,
        folders: (n) => `${n} folder yang dilindungi atau dikecualikan tidak diperiksa: Windows, Program Files, folder milik program yang terpasang, dan pengecualian Anda.`
      },
      truncated: 'Pemindaian mencapai batasnya sebelum selesai. Yang ditemukan itu nyata; mungkin masih ada lagi.',
      truncatedMatches: 'Hanya 20.000 kecocokan pertama yang ditampilkan. Pindai folder yang lebih kecil untuk melihat sisanya.',
      unreadable: (path) => `Windows tidak mengizinkan Prune melihat isi ${path}.`,
      refusedRoot: {
        missing: (p) => `${p} bukan folder yang ada, jadi dilewati.`,
        relative: (p) => `${p} bukan jalur lengkap, jadi dilewati.`,
        climb: (p) => `${p} memakai "..", jadi dilewati.`,
        protected: (p) => `${p} adalah lokasi yang dilindungi dan tidak pernah diperiksa.`
      },
      group: {
        tickAll: (pattern) => `Centang semua file ${pattern}`,
        showAll: (n) => `Tampilkan semua ${n}`,
        showFewer: 'Tampilkan lebih sedikit'
      },
      describe: {
        tmp: 'File sementara',
        temp: 'File sementara',
        tilde: 'File pemilik Office dan file ~ lain',
        tildeExt: 'Salinan cadangan editor',
        chk: 'Pecahan chkdsk di folder FOUND',
        old: 'Versi lama yang disisihkan',
        gid: 'Cache indeks bantuan Windows',
        dmp: 'File dump crash',
        thumbs: 'Cache thumbnail lama',
        bak: 'Cadangan, sering sengaja disimpan',
        log: 'File log'
      },
      openFolder: (name) => `Buka folder yang berisi ${name}`,
      selected: (n, size) => `${n} dipilih · ${size}`,
      removeButton: { quarantine: 'Pindahkan ke Karantina', recycle: 'Pindahkan ke Recycle Bin', delete: 'Hapus' },
      confirm: {
        quarantine: (n, size) => `Pindahkan ${n} file (${size}) ke Karantina? Anda bisa mengembalikannya dari Karantina.`,
        recycle: (n, size) => `Pindahkan ${n} file (${size}) ke Recycle Bin? Anda bisa mengembalikannya dari sana.`,
        delete: (n, size) => `Hapus ${n} file (${size}) secara permanen? Ini tidak bisa dibatalkan.`
      },
      removing: 'Menghapus…',
      close: 'Tutup',
      toast: {
        removed: (n) => `${n} file sampah dihapus.`,
        kept: (n) => `${n} file dibiarkan di tempatnya.`,
        keptDetail: 'File itu sedang dipakai, berubah sejak pemindaian, atau tidak lagi dianggap sampah menurut pengaturan Anda.'
      },
      errors: {
        noRoots: 'Pilih drive atau tambahkan folder.',
        noPatterns: 'Tidak ada pola yang aktif. Aktifkan beberapa di Pengaturan › Pembersihan.',
        noUsableRoots: 'Tidak satu pun lokasi itu bisa diperiksa.',
        failed: (m) => `Pemindaian gagal: ${m}`,
        removeFailed: (m) => `Tidak ada yang dihapus: ${m}`
      },
      settings: {
        title: 'Pola file sampah',
        description: 'Yang dicari pemindaian File sampah di Pembersihan Mendalam. Hasil dari pola bertanda Dicentang secara bawaan langsung tercentang, karena file itu hanya file kerja sementara atau terbentuk ulang sendiri; sisanya Anda centang sendiri. Program, pustaka, dan desktop.ini tidak pernah ditawarkan, apa pun polanya.',
        ariaLabel: 'Pola file sampah baru',
        formatHint: 'Nama file dengan * untuk karakter apa pun dan ? untuk satu karakter, seperti *.tmp. Huruf besar-kecil tidak berpengaruh.',
        empty: 'Belum ada pola. Tambahkan satu, atau kembalikan ke bawaan.',
        lookFor: (p) => `Cari ${p}`,
        preselected: 'Dicentang secara bawaan',
        remove: (p) => `Hapus ${p}`,
        reset: 'Kembalikan ke bawaan',
        resetConfirm: "Ganti daftar Anda dengan bawaan? Pola yang Anda tambahkan akan dihapus.",
        error: {
          empty: 'Ketik pola terlebih dulu.',
          long: 'Pola itu terlalu panjang.',
          separator: 'Pola adalah nama file, bukan folder atau jalur.',
          invalid: 'Berisi karakter yang tidak boleh ada dalam nama file.',
          everything: 'Itu akan cocok dengan semua file.',
          executable: 'Program, pustaka, driver, dan penginstal tidak pernah dianggap sampah.',
          desktopIni: 'Itu akan cocok dengan desktop.ini, yang memberi folder ikon dan namanya.',
          duplicate: 'Pola itu sudah ada di daftar.',
          tooMany: 'Daftarnya sudah penuh.',
          failed: (m) => `Perubahan tidak disimpan: ${m}`
        }
      }
    }
  },
  is: {
    junkFiles: {
      open: 'Ruslskrár',
      title: 'Ruslskrár',
      intro: 'Finnur afgangs tímabundnar skrár, skyndiminni og afrit eftir nafni á drifunum og í möppunum sem þú velur, samkvæmt mynstrunum í Stillingar › Hreinsun. Ekkert er fjarlægt fyrr en þú hakar við það og staðfestir.',
      where: 'Hvar á að leita',
      folderPlaceholder: 'Bættu við möppu, t.d. D:\\Downloads',
      folderAria: 'Mappa til að leita í',
      addFolder: 'Bæta við',
      foldersLabel: 'Möppur til að leita í',
      removeFolder: (path) => `Fjarlægja ${path}`,
      lookingFor: 'Leitað að',
      editPatterns: 'Breyta mynstrum',
      scan: 'Leita',
      scanAgain: 'Leita aftur',
      noPlaces: 'Veldu drif eða bættu við möppu.',
      progress: (entries, found) => `${entries} atriði skoðuð · ${found} fundust`,
      idle: 'Leit fjarlægir ekkert. Skrár birtast hér jafnóðum og þær finnast.',
      empty: 'Engar ruslskrár fundust þar.',
      stoppedEmpty: 'Stöðvað áður en nokkuð fannst.',
      found: (count, size) => `${count} skrár · ${size}`,
      stopped: 'Stöðvað: þessar fundust áður.',
      skipped: {
        lead: (n) => `${n} skrár til viðbótar sem passa voru látnar vera:`,
        recent: (n, hours) => `${n} breyttust á síðustu ${hours} klst.`,
        protected: (n) => `${n} á vernduðum stöðum`,
        excluded: (n) => `${n} undanskildar í Stillingum`,
        executable: (n) => `${n} forrit eða kerfisskrár`,
        folders: (n) => `${n} verndaðar eða undanskildar möppur voru ekki skoðaðar: Windows, Program Files, eigin möppur uppsettra forrita og undanþágur þínar.`
      },
      truncated: 'Leitin náði hámarki sínu áður en henni lauk. Það sem fannst er raunverulegt; það gæti verið meira.',
      truncatedMatches: 'Aðeins fyrstu 20.000 samsvaranirnar eru sýndar. Leitaðu í minni möppu til að sjá afganginn.',
      unreadable: (path) => `Windows leyfði Prune ekki að líta inn í ${path}.`,
      refusedRoot: {
        missing: (p) => `${p} er ekki mappa sem er til, svo henni var sleppt.`,
        relative: (p) => `${p} er ekki full slóð, svo henni var sleppt.`,
        climb: (p) => `${p} notar "..", svo henni var sleppt.`,
        protected: (p) => `${p} er verndaður staður og er aldrei skoðaður.`
      },
      group: {
        tickAll: (pattern) => `Haka við allar ${pattern}-skrár`,
        showAll: (n) => `Sýna allar ${n}`,
        showFewer: 'Sýna færri'
      },
      describe: {
        tmp: 'Tímabundnar skrár',
        temp: 'Tímabundnar skrár',
        tilde: 'Eigandaskrár Office og aðrar ~-skrár',
        tildeExt: 'Afrit frá ritlum',
        chk: 'chkdsk-brot í FOUND-möppum',
        old: 'Gamlar útgáfur lagðar til hliðar',
        gid: 'Atriðaskrár Windows-hjálpar',
        dmp: 'Hrunskrár',
        thumbs: 'Gömul smámyndaskyndiminni',
        bak: 'Afrit, oft geymd viljandi',
        log: 'Atvikaskrár'
      },
      openFolder: (name) => `Opna möppuna sem geymir ${name}`,
      selected: (n, size) => `${n} valdar · ${size}`,
      removeButton: { quarantine: 'Færa í sóttkví', recycle: 'Færa í ruslafötuna', delete: 'Eyða' },
      confirm: {
        quarantine: (n, size) => `Færa ${n} skrár (${size}) í sóttkví? Þú getur sett þær aftur á sinn stað úr sóttkví.`,
        recycle: (n, size) => `Færa ${n} skrár (${size}) í ruslafötuna? Þú getur sett þær aftur á sinn stað þaðan.`,
        delete: (n, size) => `Eyða ${n} skrám (${size}) endanlega? Það er ekki hægt að afturkalla.`
      },
      removing: 'Fjarlægi…',
      close: 'Loka',
      toast: {
        removed: (n) => `${n} ruslskrár fjarlægðar.`,
        kept: (n) => `${n} skrár voru látnar vera á sínum stað.`,
        keptDetail: 'Þær voru í notkun, breyttust eftir leitina eða teljast ekki lengur rusl samkvæmt stillingunum þínum.'
      },
      errors: {
        noRoots: 'Veldu drif eða bættu við möppu.',
        noPatterns: 'Ekkert mynstur er virkt. Kveiktu á einhverjum í Stillingar › Hreinsun.',
        noUsableRoots: 'Ekki er hægt að leita á neinum þessara staða.',
        failed: (m) => `Leitin mistókst: ${m}`,
        removeFailed: (m) => `Ekkert var fjarlægt: ${m}`
      },
      settings: {
        title: 'Mynstur ruslskráa',
        description: 'Það sem ruslskráaleit Djúphreinsunar leitar að. Niðurstöður mynstra merktra Hakað sjálfgefið byrja hakaðar, því þær skrár eru aðeins vinnuskrár eða endurbyggja sig sjálfar; allt annað hakar þú við sjálf(ur). Forrit, söfn og desktop.ini eru aldrei boðin fram, hvert sem mynstrið er.',
        ariaLabel: 'Nýtt mynstur ruslskráa',
        formatHint: 'Skráarheiti með * fyrir hvaða stafi sem er og ? fyrir einn, t.d. *.tmp. Hástafir skipta ekki máli.',
        empty: 'Engin mynstur. Bættu einu við eða endurstilltu á sjálfgefið.',
        lookFor: (p) => `Leita að ${p}`,
        preselected: 'Hakað sjálfgefið',
        remove: (p) => `Fjarlægja ${p}`,
        reset: 'Endurstilla á sjálfgefið',
        resetConfirm: "Skipta listanum út fyrir sjálfgefið? Mynstur sem þú bættir við verða fjarlægð.",
        error: {
          empty: 'Sláðu fyrst inn mynstur.',
          long: 'Þetta mynstur er of langt.',
          separator: 'Mynstur er skráarheiti, ekki mappa eða slóð.',
          invalid: 'Það inniheldur staf sem ekkert skráarheiti getur haft.',
          everything: 'Það myndi passa við allar skrár.',
          executable: 'Forrit, söfn, reklar og uppsetningarforrit eru aldrei rusl.',
          desktopIni: 'Það myndi passa við desktop.ini, sem gefur möppu tákn hennar og nafn.',
          duplicate: 'Þetta mynstur er þegar á listanum.',
          tooMany: 'Listinn er fullur.',
          failed: (m) => `Breytingin var ekki vistuð: ${m}`
        }
      }
    }
  },
  it: {
    junkFiles: {
      open: 'File inutili',
      title: 'File inutili',
      intro: 'Trova per nome i file temporanei, le cache e i backup rimasti sulle unità e nelle cartelle che scegli, con i modelli di Impostazioni › Pulizia. Non viene rimosso nulla finché non lo spunti e confermi.',
      where: 'Dove cercare',
      folderPlaceholder: 'Aggiungi una cartella, es. D:\\Downloads',
      folderAria: 'Cartella in cui cercare',
      addFolder: 'Aggiungi',
      foldersLabel: 'Cartelle in cui cercare',
      removeFolder: (path) => `Togli ${path}`,
      lookingFor: 'Si cerca',
      editPatterns: 'Modifica modelli',
      scan: 'Analizza',
      scanAgain: 'Analizza di nuovo',
      noPlaces: 'Scegli un’unità o aggiungi una cartella.',
      progress: (entries, found) => `${entries} elementi esaminati · ${found} trovati`,
      idle: 'L’analisi non rimuove nulla. I file compaiono qui man mano che vengono trovati.',
      empty: 'Nessun file inutile trovato lì.',
      stoppedEmpty: 'Interrotta prima di trovare qualcosa.',
      found: (count, size) => `${count} file · ${size}`,
      stopped: 'Interrotta: questi sono stati trovati prima.',
      skipped: {
        lead: (n) => `Altri ${n} file corrispondenti sono stati lasciati stare:`,
        recent: (n, hours) => `${n} modificati nelle ultime ${hours} ore`,
        protected: (n) => `${n} in posizioni protette`,
        excluded: (n) => `${n} esclusi nelle Impostazioni`,
        executable: (n) => `${n} programmi o file di sistema`,
        folders: (n) => `${n} cartelle protette o escluse non sono state esaminate: Windows, Program Files, le cartelle dei programmi installati e le tue esclusioni.`
      },
      truncated: 'L’analisi ha raggiunto il limite prima di finire. Ciò che ha trovato è reale; potrebbe essercene altro.',
      truncatedMatches: 'Sono elencate solo le prime 20.000 corrispondenze. Analizza una cartella più piccola per vedere il resto.',
      unreadable: (path) => `Windows non ha permesso a Prune di guardare dentro ${path}.`,
      refusedRoot: {
        missing: (p) => `${p} non è una cartella esistente, quindi è stata saltata.`,
        relative: (p) => `${p} non è un percorso completo, quindi è stato saltato.`,
        climb: (p) => `${p} usa "..", quindi è stato saltato.`,
        protected: (p) => `${p} è una posizione protetta e non viene mai esaminata.`
      },
      group: {
        tickAll: (pattern) => `Spunta tutti i file ${pattern}`,
        showAll: (n) => `Mostra tutti e ${n}`,
        showFewer: 'Mostra meno'
      },
      describe: {
        tmp: 'File temporanei',
        temp: 'File temporanei',
        tilde: 'File proprietario di Office e altri file ~',
        tildeExt: 'Copie di backup degli editor',
        chk: 'Frammenti di chkdsk nelle cartelle FOUND',
        old: 'Vecchie versioni messe da parte',
        gid: 'Cache degli indici della guida di Windows',
        dmp: 'Dump dei crash',
        thumbs: 'Vecchie cache delle miniature',
        bak: 'Backup, spesso tenuti di proposito',
        log: 'File di log'
      },
      openFolder: (name) => `Apri la cartella che contiene ${name}`,
      selected: (n, size) => `${n} selezionati · ${size}`,
      removeButton: { quarantine: 'Sposta in Quarantena', recycle: 'Sposta nel Cestino', delete: 'Elimina' },
      confirm: {
        quarantine: (n, size) => `Spostare ${n} file (${size}) in Quarantena? Puoi rimetterli al loro posto dalla Quarantena.`,
        recycle: (n, size) => `Spostare ${n} file (${size}) nel Cestino? Puoi rimetterli al loro posto da lì.`,
        delete: (n, size) => `Eliminare ${n} file (${size}) definitivamente? Non si può annullare.`
      },
      removing: 'Rimozione…',
      close: 'Chiudi',
      toast: {
        removed: (n) => `Rimossi ${n} file inutili.`,
        kept: (n) => `${n} file sono stati lasciati dove sono.`,
        keptDetail: 'Erano in uso, sono cambiati dopo l’analisi o secondo le tue impostazioni non contano più come inutili.'
      },
      errors: {
        noRoots: 'Scegli un’unità o aggiungi una cartella.',
        noPatterns: 'Nessun modello è attivo. Attivane qualcuno in Impostazioni › Pulizia.',
        noUsableRoots: 'Nessuna di quelle posizioni può essere esaminata.',
        failed: (m) => `L’analisi non è riuscita: ${m}`,
        removeFailed: (m) => `Non è stato rimosso nulla: ${m}`
      },
      settings: {
        title: 'Modelli di file inutili',
        description: 'Ciò che cerca l’analisi File inutili della Pulizia approfondita. I risultati dei modelli contrassegnati Spuntato per impostazione predefinita partono spuntati, perché quei file sono solo di lavoro o si ricostruiscono da soli; tutto il resto lo spunti tu. Programmi, librerie e desktop.ini non vengono mai proposti, qualunque sia il modello.',
        ariaLabel: 'Nuovo modello di file inutili',
        formatHint: 'Un nome di file con * per qualsiasi carattere e ? per uno solo, come *.tmp. Maiuscole e minuscole non contano.',
        empty: 'Nessun modello. Aggiungine uno o ripristina i predefiniti.',
        lookFor: (p) => `Cerca ${p}`,
        preselected: 'Spuntato per impostazione predefinita',
        remove: (p) => `Togli ${p}`,
        reset: 'Ripristina i predefiniti',
        resetConfirm: "Sostituire l’elenco con i predefiniti? I modelli che hai aggiunto verranno tolti.",
        error: {
          empty: 'Scrivi prima un modello.',
          long: 'Quel modello è troppo lungo.',
          separator: 'Un modello è un nome di file, non una cartella o un percorso.',
          invalid: 'Contiene un carattere che nessun nome di file può avere.',
          everything: 'Corrisponderebbe a tutti i file.',
          executable: 'Programmi, librerie, driver e programmi di installazione non sono mai inutili.',
          desktopIni: 'Corrisponderebbe a desktop.ini, che dà a una cartella la sua icona e il suo nome.',
          duplicate: 'Quel modello è già nell’elenco.',
          tooMany: 'L’elenco è pieno.',
          failed: (m) => `La modifica non è stata salvata: ${m}`
        }
      }
    }
  },
  ja: {
    junkFiles: {
      open: '不要なファイル',
      title: '不要なファイル',
      intro: '選んだドライブとフォルダーから、残った一時ファイル、キャッシュ、バックアップを名前で探します。使うパターンは［設定］›［クリーンアップ］にあります。チェックを付けて確認するまで、何も削除されません。',
      where: '探す場所',
      folderPlaceholder: 'フォルダーを追加（例: D:\\Downloads）',
      folderAria: '探すフォルダー',
      addFolder: '追加',
      foldersLabel: '探すフォルダー',
      removeFolder: (path) => `${path} を外す`,
      lookingFor: '探すもの',
      editPatterns: 'パターンを編集',
      scan: 'スキャン',
      scanAgain: 'もう一度スキャン',
      noPlaces: 'ドライブを選ぶか、フォルダーを追加してください。',
      progress: (entries, found) => `${entries} 項目を確認 · ${found} 件見つかりました`,
      idle: 'スキャンでは何も削除されません。見つかったファイルは順にここに表示されます。',
      empty: '不要なファイルは見つかりませんでした。',
      stoppedEmpty: '何か見つかる前に停止しました。',
      found: (count, size) => `${count} 個のファイル · ${size}`,
      stopped: '停止しました。表示されているのはそれまでに見つかったものです。',
      skipped: {
        lead: (n) => `ほかに一致した ${n} 個のファイルはそのままにしました:`,
        recent: (n, hours) => `${n} 個は過去 ${hours} 時間以内に変更`,
        protected: (n) => `${n} 個は保護された場所`,
        excluded: (n) => `${n} 個は設定で除外`,
        executable: (n) => `${n} 個はプログラムまたはシステム ファイル`,
        folders: (n) => `保護または除外された ${n} 個のフォルダーは調べませんでした（Windows、Program Files、インストール済みプログラムのフォルダー、除外したもの）。`
      },
      truncated: 'スキャンは完了する前に上限に達しました。見つかったものは本物ですが、ほかにもあるかもしれません。',
      truncatedMatches: '最初の 20,000 件だけを表示しています。残りを見るには、もっと小さなフォルダーをスキャンしてください。',
      unreadable: (path) => `Windows により、Prune は ${path} の中を見られませんでした。`,
      refusedRoot: {
        missing: (p) => `${p} は存在するフォルダーではないため、スキップしました。`,
        relative: (p) => `${p} は完全なパスではないため、スキップしました。`,
        climb: (p) => `${p} は ".." を使っているため、スキップしました。`,
        protected: (p) => `${p} は保護された場所なので、調べることはありません。`
      },
      group: {
        tickAll: (pattern) => `${pattern} のファイルをすべてチェック`,
        showAll: (n) => `${n} 件すべて表示`,
        showFewer: '表示を減らす'
      },
      describe: {
        tmp: '一時ファイル',
        temp: '一時ファイル',
        tilde: 'Office の所有者ファイルなどの ~ ファイル',
        tildeExt: 'エディターのバックアップ',
        chk: 'FOUND フォルダー内の chkdsk の断片',
        old: '退避された古いバージョン',
        gid: 'Windows ヘルプの索引キャッシュ',
        dmp: 'クラッシュ ダンプ',
        thumbs: '古いサムネイル キャッシュ',
        bak: 'バックアップ（意図して残すことが多い）',
        log: 'ログ ファイル'
      },
      openFolder: (name) => `${name} のあるフォルダーを開く`,
      selected: (n, size) => `${n} 個を選択 · ${size}`,
      removeButton: { quarantine: '隔離に移動', recycle: 'ごみ箱に移動', delete: '削除' },
      confirm: {
        quarantine: (n, size) => `${n} 個のファイル（${size}）を隔離に移動しますか？ 隔離から元に戻せます。`,
        recycle: (n, size) => `${n} 個のファイル（${size}）をごみ箱に移動しますか？ そこから元に戻せます。`,
        delete: (n, size) => `${n} 個のファイル（${size}）を完全に削除しますか？ 元に戻せません。`
      },
      removing: '削除しています…',
      close: '閉じる',
      toast: {
        removed: (n) => `不要なファイルを ${n} 個削除しました。`,
        kept: (n) => `${n} 個のファイルはそのまま残しました。`,
        keptDetail: '使用中だった、スキャン後に変更された、または設定上もう不要なファイルとは見なされません。'
      },
      errors: {
        noRoots: 'ドライブを選ぶか、フォルダーを追加してください。',
        noPatterns: '有効なパターンがありません。［設定］›［クリーンアップ］で有効にしてください。',
        noUsableRoots: 'どの場所も調べられません。',
        failed: (m) => `スキャンに失敗しました: ${m}`,
        removeFailed: (m) => `何も削除されませんでした: ${m}`
      },
      settings: {
        title: '不要なファイルのパターン',
        description: 'ディープクリーンの「不要なファイル」スキャンが探すもの。「既定でチェック」と表示されたパターンの結果は、作業用のファイルか自動的に作り直されるものなので、最初からチェックが付きます。それ以外は自分でチェックします。プログラム、ライブラリ、desktop.ini は、パターンにかかわらず候補に出ません。',
        ariaLabel: '新しい不要ファイルのパターン',
        formatHint: '* は任意の文字列、? は 1 文字を表すファイル名（例: *.tmp）。大文字と小文字は区別しません。',
        empty: 'パターンがありません。追加するか、既定に戻してください。',
        lookFor: (p) => `${p} を探す`,
        preselected: '既定でチェック',
        remove: (p) => `${p} を削除`,
        reset: '既定に戻す',
        resetConfirm: "一覧を既定に置き換えますか？ 追加したパターンは削除されます。",
        error: {
          empty: '先にパターンを入力してください。',
          long: 'そのパターンは長すぎます。',
          separator: 'パターンはファイル名で、フォルダーやパスではありません。',
          invalid: 'ファイル名に使えない文字が含まれています。',
          everything: 'すべてのファイルに一致してしまいます。',
          executable: 'プログラム、ライブラリ、ドライバー、インストーラーは不要なファイルではありません。',
          desktopIni: 'desktop.ini に一致してしまいます。これはフォルダーのアイコンと名前を決めるファイルです。',
          duplicate: 'そのパターンはすでに一覧にあります。',
          tooMany: '一覧がいっぱいです。',
          failed: (m) => `変更は保存されませんでした: ${m}`
        }
      }
    }
  },
  ko: {
    junkFiles: {
      open: '불필요한 파일',
      title: '불필요한 파일',
      intro: '선택한 드라이브와 폴더에서 남은 임시 파일, 캐시, 백업을 이름으로 찾습니다. 사용하는 패턴은 설정 › 정리에 있습니다. 확인란을 선택하고 확인하기 전에는 아무것도 제거되지 않습니다.',
      where: '찾을 위치',
      folderPlaceholder: '폴더 추가(예: D:\\Downloads)',
      folderAria: '검색할 폴더',
      addFolder: '추가',
      foldersLabel: '검색할 폴더',
      removeFolder: (path) => `${path} 빼기`,
      lookingFor: '찾는 대상',
      editPatterns: '패턴 편집',
      scan: '검사',
      scanAgain: '다시 검사',
      noPlaces: '드라이브를 선택하거나 폴더를 추가하세요.',
      progress: (entries, found) => `${entries}개 항목 확인 · ${found}개 발견`,
      idle: '검사는 아무것도 제거하지 않습니다. 찾은 파일이 여기에 바로 표시됩니다.',
      empty: '그곳에서 불필요한 파일을 찾지 못했습니다.',
      stoppedEmpty: '아무것도 찾기 전에 중지했습니다.',
      found: (count, size) => `파일 ${count}개 · ${size}`,
      stopped: '중지됨: 그 전에 찾은 파일입니다.',
      skipped: {
        lead: (n) => `일치하는 파일 ${n}개는 그대로 두었습니다:`,
        recent: (n, hours) => `${n}개는 최근 ${hours}시간 안에 변경됨`,
        protected: (n) => `${n}개는 보호된 위치에 있음`,
        excluded: (n) => `${n}개는 설정에서 제외됨`,
        executable: (n) => `${n}개는 프로그램 또는 시스템 파일`,
        folders: (n) => `보호되거나 제외된 폴더 ${n}개는 검사하지 않았습니다: Windows, Program Files, 설치된 프로그램의 폴더, 사용자 제외 항목.`
      },
      truncated: '검사가 끝나기 전에 한도에 도달했습니다. 찾은 것은 실제이며, 더 있을 수 있습니다.',
      truncatedMatches: '처음 20,000개 결과만 표시됩니다. 나머지를 보려면 더 작은 폴더를 검사하세요.',
      unreadable: (path) => `Windows가 Prune이 ${path} 안을 보도록 허용하지 않았습니다.`,
      refusedRoot: {
        missing: (p) => `${p}은(는) 존재하는 폴더가 아니어서 건너뛰었습니다.`,
        relative: (p) => `${p}은(는) 전체 경로가 아니어서 건너뛰었습니다.`,
        climb: (p) => `${p}에 ".."가 있어 건너뛰었습니다.`,
        protected: (p) => `${p}은(는) 보호된 위치라 검사하지 않습니다.`
      },
      group: {
        tickAll: (pattern) => `${pattern} 파일 모두 선택`,
        showAll: (n) => `${n}개 모두 표시`,
        showFewer: '간단히 표시'
      },
      describe: {
        tmp: '임시 파일',
        temp: '임시 파일',
        tilde: 'Office 소유자 파일 및 기타 ~ 파일',
        tildeExt: '편집기 백업 사본',
        chk: 'FOUND 폴더의 chkdsk 조각',
        old: '따로 둔 이전 버전',
        gid: 'Windows 도움말 색인 캐시',
        dmp: '크래시 덤프',
        thumbs: '오래된 미리 보기 캐시',
        bak: '백업(일부러 보관하는 경우가 많음)',
        log: '로그 파일'
      },
      openFolder: (name) => `${name}이(가) 있는 폴더 열기`,
      selected: (n, size) => `${n}개 선택됨 · ${size}`,
      removeButton: { quarantine: '격리로 이동', recycle: '휴지통으로 이동', delete: '삭제' },
      confirm: {
        quarantine: (n, size) => `파일 ${n}개(${size})를 격리로 이동할까요? 격리에서 되돌릴 수 있습니다.`,
        recycle: (n, size) => `파일 ${n}개(${size})를 휴지통으로 이동할까요? 그곳에서 되돌릴 수 있습니다.`,
        delete: (n, size) => `파일 ${n}개(${size})를 영구히 삭제할까요? 되돌릴 수 없습니다.`
      },
      removing: '제거하는 중…',
      close: '닫기',
      toast: {
        removed: (n) => `불필요한 파일 ${n}개를 제거했습니다.`,
        kept: (n) => `파일 ${n}개는 그대로 두었습니다.`,
        keptDetail: '사용 중이었거나, 검사 후 바뀌었거나, 설정상 더 이상 불필요한 파일이 아닙니다.'
      },
      errors: {
        noRoots: '드라이브를 선택하거나 폴더를 추가하세요.',
        noPatterns: '켜진 패턴이 없습니다. 설정 › 정리에서 몇 개를 켜세요.',
        noUsableRoots: '그 위치는 모두 검사할 수 없습니다.',
        failed: (m) => `검사하지 못했습니다: ${m}`,
        removeFailed: (m) => `아무것도 제거하지 않았습니다: ${m}`
      },
      settings: {
        title: '불필요한 파일 패턴',
        description: '딥 클린의 불필요한 파일 검사가 찾는 대상입니다. 기본으로 선택됨으로 표시된 패턴의 결과는 작업용 파일이거나 스스로 다시 만들어지므로 처음부터 선택됩니다. 나머지는 직접 선택합니다. 프로그램, 라이브러리, desktop.ini는 패턴과 관계없이 제안하지 않습니다.',
        ariaLabel: '새 불필요한 파일 패턴',
        formatHint: '*는 아무 문자, ?는 한 글자를 뜻하는 파일 이름입니다(예: *.tmp). 대소문자는 구분하지 않습니다.',
        empty: '패턴이 없습니다. 하나를 추가하거나 기본값으로 되돌리세요.',
        lookFor: (p) => `${p} 찾기`,
        preselected: '기본으로 선택됨',
        remove: (p) => `${p} 제거`,
        reset: '기본값으로 되돌리기',
        resetConfirm: "목록을 기본값으로 바꿀까요? 추가한 패턴은 제거됩니다.",
        error: {
          empty: '먼저 패턴을 입력하세요.',
          long: '패턴이 너무 깁니다.',
          separator: '패턴은 폴더나 경로가 아니라 파일 이름입니다.',
          invalid: '파일 이름에 쓸 수 없는 문자가 있습니다.',
          everything: '모든 파일과 일치하게 됩니다.',
          executable: '프로그램, 라이브러리, 드라이버, 설치 프로그램은 불필요한 파일이 아닙니다.',
          desktopIni: '폴더의 아이콘과 이름을 정하는 desktop.ini와 일치하게 됩니다.',
          duplicate: '이미 목록에 있는 패턴입니다.',
          tooMany: '목록이 가득 찼습니다.',
          failed: (m) => `변경 사항을 저장하지 못했습니다: ${m}`
        }
      }
    }
  },
  lt: {
    junkFiles: {
      open: 'Nereikalingi failai',
      title: 'Nereikalingi failai',
      intro: 'Pagal pavadinimą randa likusius laikinuosius failus, podėlius ir atsargines kopijas jūsų pasirinktuose diskuose ir aplankuose, naudodamas šablonus iš Nustatymai › Valymas. Niekas nepašalinama, kol to nepažymite ir nepatvirtinate.',
      where: 'Kur ieškoti',
      folderPlaceholder: 'Pridėkite aplanką, pvz., D:\\Downloads',
      folderAria: 'Aplankas, kuriame ieškoti',
      addFolder: 'Pridėti',
      foldersLabel: 'Aplankai, kuriuose ieškoti',
      removeFolder: (path) => `Pašalinti ${path}`,
      lookingFor: 'Ieškoma',
      editPatterns: 'Redaguoti šablonus',
      scan: 'Ieškoti',
      scanAgain: 'Ieškoti dar kartą',
      noPlaces: 'Pasirinkite diską arba pridėkite aplanką.',
      progress: (entries, found) => `Peržiūrėta elementų: ${entries} · rasta: ${found}`,
      idle: 'Paieška nieko nepašalina. Failai čia atsiranda, kai tik randami.',
      empty: 'Ten nerasta nereikalingų failų.',
      stoppedEmpty: 'Sustabdyta prieš ką nors randant.',
      found: (count, size) => `Failų: ${count} · ${size}`,
      stopped: 'Sustabdyta: šie rasti iki tol.',
      skipped: {
        lead: (n) => `Dar ${n} atitinkančių failų palikta ramybėje:`,
        recent: (n, hours) => `${n} pakeisti per paskutines ${hours} val.`,
        protected: (n) => `${n} apsaugotose vietose`,
        excluded: (n) => `${n} išskirti nustatymuose`,
        executable: (n) => `${n} programos ar sistemos failai`,
        folders: (n) => `Neperžiūrėta apsaugotų ar išskirtų aplankų: ${n} – Windows, Program Files, įdiegtų programų aplankai ir jūsų išimtys.`
      },
      truncated: 'Paieška pasiekė ribą nebaigusi. Tai, ką rado, yra tikra; gali būti ir daugiau.',
      truncatedMatches: 'Rodomi tik pirmieji 20 000 atitikmenų. Norėdami pamatyti likusius, ieškokite mažesniame aplanke.',
      unreadable: (path) => `Windows neleido Prune pažiūrėti į ${path}.`,
      refusedRoot: {
        missing: (p) => `${p} nėra esamas aplankas, todėl praleistas.`,
        relative: (p) => `${p} nėra visas kelias, todėl praleistas.`,
        climb: (p) => `${p} naudoja „..“, todėl praleistas.`,
        protected: (p) => `${p} yra apsaugota vieta ir niekada neperžiūrima.`
      },
      group: {
        tickAll: (pattern) => `Pažymėti visus ${pattern} failus`,
        showAll: (n) => `Rodyti visus (${n})`,
        showFewer: 'Rodyti mažiau'
      },
      describe: {
        tmp: 'Laikinieji failai',
        temp: 'Laikinieji failai',
        tilde: 'Office savininko failai ir kiti ~ failai',
        tildeExt: 'Redaktorių atsarginės kopijos',
        chk: 'chkdsk fragmentai FOUND aplankuose',
        old: 'Atidėtos senos versijos',
        gid: 'Windows žinyno rodyklės podėliai',
        dmp: 'Strigčių iškeltiniai failai',
        thumbs: 'Seni miniatiūrų podėliai',
        bak: 'Atsarginės kopijos, dažnai laikomos tyčia',
        log: 'Žurnalų failai'
      },
      openFolder: (name) => `Atidaryti aplanką, kuriame yra ${name}`,
      selected: (n, size) => `Pasirinkta: ${n} · ${size}`,
      removeButton: { quarantine: 'Perkelti į karantiną', recycle: 'Perkelti į šiukšlinę', delete: 'Ištrinti' },
      confirm: {
        quarantine: (n, size) => `Perkelti ${n} failus (${size}) į karantiną? Iš karantino juos galėsite grąžinti.`,
        recycle: (n, size) => `Perkelti ${n} failus (${size}) į šiukšlinę? Iš ten juos galėsite grąžinti.`,
        delete: (n, size) => `Visam laikui ištrinti ${n} failus (${size})? To atšaukti negalima.`
      },
      removing: 'Šalinama…',
      close: 'Uždaryti',
      toast: {
        removed: (n) => `Pašalinta nereikalingų failų: ${n}.`,
        kept: (n) => `Palikta vietoje failų: ${n}.`,
        keptDetail: 'Jie buvo naudojami, pasikeitė po paieškos arba pagal jūsų nustatymus nebelaikomi nereikalingais.'
      },
      errors: {
        noRoots: 'Pasirinkite diską arba pridėkite aplanką.',
        noPatterns: 'Neįjungtas joks šablonas. Įjunkite kelis skiltyje Nustatymai › Valymas.',
        noUsableRoots: 'Nė vienoje iš tų vietų negalima ieškoti.',
        failed: (m) => `Paieška nepavyko: ${m}`,
        removeFailed: (m) => `Niekas nepašalinta: ${m}`
      },
      settings: {
        title: 'Nereikalingų failų šablonai',
        description: 'Ko ieško Gilaus valymo nereikalingų failų paieška. Šablonų, pažymėtų Pažymėta pagal numatytuosius, rezultatai iš pradžių būna pažymėti, nes tie failai tik laikini arba patys atsikuria; visa kita pažymite patys. Programos, bibliotekos ir desktop.ini niekada nesiūlomi, kad ir koks būtų šablonas.',
        ariaLabel: 'Naujas nereikalingų failų šablonas',
        formatHint: 'Failo pavadinimas, kuriame * reiškia bet kokius simbolius, o ? – vieną, pvz., *.tmp. Raidžių dydis nesvarbus.',
        empty: 'Šablonų nėra. Pridėkite vieną arba atkurkite numatytuosius.',
        lookFor: (p) => `Ieškoti ${p}`,
        preselected: 'Pažymėta pagal numatytuosius',
        remove: (p) => `Pašalinti ${p}`,
        reset: 'Atkurti numatytuosius',
        resetConfirm: "Pakeisti sąrašą numatytaisiais? Jūsų pridėti šablonai bus pašalinti.",
        error: {
          empty: 'Pirmiausia įveskite šabloną.',
          long: 'Šis šablonas per ilgas.',
          separator: 'Šablonas yra failo pavadinimas, o ne aplankas ar kelias.',
          invalid: 'Jame yra simbolis, kurio failo pavadinime būti negali.',
          everything: 'Tai atitiktų kiekvieną failą.',
          executable: 'Programos, bibliotekos, tvarkyklės ir diegimo programos niekada nėra nereikalingi failai.',
          desktopIni: 'Tai atitiktų desktop.ini, kuris aplankui suteikia piktogramą ir pavadinimą.',
          duplicate: 'Šis šablonas jau yra sąraše.',
          tooMany: 'Sąrašas pilnas.',
          failed: (m) => `Pakeitimas neišsaugotas: ${m}`
        }
      }
    }
  },
  ms: {
    junkFiles: {
      open: 'Fail sampah',
      title: 'Fail sampah',
      intro: 'Mencari fail sementara, cache dan sandaran yang tertinggal mengikut nama pada pemacu dan folder yang anda pilih, menggunakan corak dalam Tetapan › Pembersihan. Tiada apa-apa dialih keluar sehingga anda menandakannya dan mengesahkan.',
      where: 'Tempat mencari',
      folderPlaceholder: 'Tambah folder, cth. D:\\Downloads',
      folderAria: 'Folder untuk dicari',
      addFolder: 'Tambah',
      foldersLabel: 'Folder untuk dicari',
      removeFolder: (path) => `Buang ${path}`,
      lookingFor: 'Mencari',
      editPatterns: 'Edit corak',
      scan: 'Imbas',
      scanAgain: 'Imbas semula',
      noPlaces: 'Pilih pemacu atau tambah folder.',
      progress: (entries, found) => `${entries} item disemak · ${found} ditemui`,
      idle: 'Imbasan tidak mengalih keluar apa-apa. Fail muncul di sini sebaik ditemui.',
      empty: 'Tiada fail sampah ditemui di situ.',
      stoppedEmpty: 'Dihentikan sebelum apa-apa ditemui.',
      found: (count, size) => `${count} fail · ${size}`,
      stopped: 'Dihentikan: fail ini ditemui sebelum itu.',
      skipped: {
        lead: (n) => `${n} lagi fail yang sepadan dibiarkan:`,
        recent: (n, hours) => `${n} berubah dalam ${hours} jam lalu`,
        protected: (n) => `${n} di tempat yang dilindungi`,
        excluded: (n) => `${n} dikecualikan dalam Tetapan`,
        executable: (n) => `${n} program atau fail sistem`,
        folders: (n) => `${n} folder yang dilindungi atau dikecualikan tidak disemak: Windows, Program Files, folder program yang dipasang dan pengecualian anda.`
      },
      truncated: 'Imbasan mencapai hadnya sebelum selesai. Apa yang ditemui adalah benar; mungkin ada lagi.',
      truncatedMatches: 'Hanya 20,000 padanan pertama disenaraikan. Imbas folder yang lebih kecil untuk melihat selebihnya.',
      unreadable: (path) => `Windows tidak membenarkan Prune melihat ke dalam ${path}.`,
      refusedRoot: {
        missing: (p) => `${p} bukan folder yang wujud, jadi ia dilangkau.`,
        relative: (p) => `${p} bukan laluan penuh, jadi ia dilangkau.`,
        climb: (p) => `${p} menggunakan "..", jadi ia dilangkau.`,
        protected: (p) => `${p} ialah tempat yang dilindungi dan tidak pernah disemak.`
      },
      group: {
        tickAll: (pattern) => `Tanda semua fail ${pattern}`,
        showAll: (n) => `Tunjukkan semua ${n}`,
        showFewer: 'Tunjukkan kurang'
      },
      describe: {
        tmp: 'Fail sementara',
        temp: 'Fail sementara',
        tilde: 'Fail pemilik Office dan fail ~ lain',
        tildeExt: 'Salinan sandaran editor',
        chk: 'Serpihan chkdsk dalam folder FOUND',
        old: 'Versi lama yang diketepikan',
        gid: 'Cache indeks bantuan Windows',
        dmp: 'Longgokan ranap',
        thumbs: 'Cache lakaran kecil lama',
        bak: 'Sandaran, selalunya disimpan dengan sengaja',
        log: 'Fail log'
      },
      openFolder: (name) => `Buka folder yang mengandungi ${name}`,
      selected: (n, size) => `${n} dipilih · ${size}`,
      removeButton: { quarantine: 'Alih ke Kuarantin', recycle: 'Alih ke Tong Kitar Semula', delete: 'Padam' },
      confirm: {
        quarantine: (n, size) => `Alihkan ${n} fail (${size}) ke Kuarantin? Anda boleh memulihkannya dari Kuarantin.`,
        recycle: (n, size) => `Alihkan ${n} fail (${size}) ke Tong Kitar Semula? Anda boleh memulihkannya dari situ.`,
        delete: (n, size) => `Padam ${n} fail (${size}) secara kekal? Ini tidak boleh dibuat asal.`
      },
      removing: 'Mengalih keluar…',
      close: 'Tutup',
      toast: {
        removed: (n) => `${n} fail sampah dialih keluar.`,
        kept: (n) => `${n} fail dibiarkan di tempatnya.`,
        keptDetail: 'Fail itu sedang digunakan, berubah sejak imbasan, atau tidak lagi dikira sampah mengikut tetapan anda.'
      },
      errors: {
        noRoots: 'Pilih pemacu atau tambah folder.',
        noPatterns: 'Tiada corak dihidupkan. Hidupkan beberapa dalam Tetapan › Pembersihan.',
        noUsableRoots: 'Tiada satu pun tempat itu boleh disemak.',
        failed: (m) => `Imbasan gagal: ${m}`,
        removeFailed: (m) => `Tiada apa-apa dialih keluar: ${m}`
      },
      settings: {
        title: 'Corak fail sampah',
        description: 'Apa yang dicari oleh imbasan Fail sampah dalam Pembersihan Mendalam. Hasil corak bertanda Ditanda secara lalai bermula dengan tanda, kerana fail itu hanya fail kerja atau dibina semula sendiri; yang lain anda tanda sendiri. Program, pustaka dan desktop.ini tidak pernah ditawarkan, walau apa pun coraknya.',
        ariaLabel: 'Corak fail sampah baharu',
        formatHint: 'Nama fail dengan * untuk sebarang aksara dan ? untuk satu, seperti *.tmp. Huruf besar atau kecil tidak penting.',
        empty: 'Tiada corak. Tambah satu, atau set semula kepada lalai.',
        lookFor: (p) => `Cari ${p}`,
        preselected: 'Ditanda secara lalai',
        remove: (p) => `Buang ${p}`,
        reset: 'Set semula kepada lalai',
        resetConfirm: "Gantikan senarai anda dengan lalai? Corak yang anda tambah akan dibuang.",
        error: {
          empty: 'Taip corak dahulu.',
          long: 'Corak itu terlalu panjang.',
          separator: 'Corak ialah nama fail, bukan folder atau laluan.',
          invalid: 'Ia mengandungi aksara yang tidak boleh ada dalam nama fail.',
          everything: 'Itu akan sepadan dengan setiap fail.',
          executable: 'Program, pustaka, pemacu peranti dan pemasang bukan sampah.',
          desktopIni: 'Itu akan sepadan dengan desktop.ini, yang memberi folder ikon dan namanya.',
          duplicate: 'Corak itu sudah ada dalam senarai.',
          tooMany: 'Senarai sudah penuh.',
          failed: (m) => `Perubahan tidak disimpan: ${m}`
        }
      }
    }
  },
  nb: {
    junkFiles: {
      open: 'Søppelfiler',
      title: 'Søppelfiler',
      intro: 'Finner gjenværende midlertidige filer, hurtigbuffere og sikkerhetskopier etter navn på stasjonene og i mappene du velger, ut fra mønstrene i Innstillinger › Opprydding. Ingenting fjernes før du huker det av og bekrefter.',
      where: 'Hvor det skal søkes',
      folderPlaceholder: 'Legg til en mappe, f.eks. D:\\Downloads',
      folderAria: 'Mappe å søke i',
      addFolder: 'Legg til',
      foldersLabel: 'Mapper å søke i',
      removeFolder: (path) => `Fjern ${path}`,
      lookingFor: 'Søker etter',
      editPatterns: 'Rediger mønstre',
      scan: 'Søk',
      scanAgain: 'Søk på nytt',
      noPlaces: 'Velg en stasjon, eller legg til en mappe.',
      progress: (entries, found) => `${entries} elementer gjennomsøkt · ${found} funnet`,
      idle: 'Søket fjerner ingenting. Filene vises her etter hvert som de blir funnet.',
      empty: 'Fant ingen søppelfiler der.',
      stoppedEmpty: 'Stoppet før noe ble funnet.',
      found: (count, size) => `${count} filer · ${size}`,
      stopped: 'Stoppet: disse ble funnet før det.',
      skipped: {
        lead: (n) => `${n} filer til som passer, ble latt være:`,
        recent: (n, hours) => `${n} endret de siste ${hours} timene`,
        protected: (n) => `${n} på beskyttede steder`,
        excluded: (n) => `${n} utelatt i Innstillinger`,
        executable: (n) => `${n} programmer eller systemfiler`,
        folders: (n) => `${n} beskyttede eller utelatte mapper ble ikke gjennomsøkt: Windows, Program Files, installerte programmers egne mapper og dine unntak.`
      },
      truncated: 'Søket nådde grensen før det ble ferdig. Det som ble funnet, er ekte; det kan være flere.',
      truncatedMatches: 'Bare de første 20 000 treffene vises. Søk i en mindre mappe for å se resten.',
      unreadable: (path) => `Windows lot ikke Prune se inn i ${path}.`,
      refusedRoot: {
        missing: (p) => `${p} er ikke en mappe som finnes, så den ble hoppet over.`,
        relative: (p) => `${p} er ikke en fullstendig bane, så den ble hoppet over.`,
        climb: (p) => `${p} bruker "..", så den ble hoppet over.`,
        protected: (p) => `${p} er et beskyttet sted og blir aldri gjennomsøkt.`
      },
      group: {
        tickAll: (pattern) => `Huk av alle ${pattern}-filer`,
        showAll: (n) => `Vis alle ${n}`,
        showFewer: 'Vis færre'
      },
      describe: {
        tmp: 'Midlertidige filer',
        temp: 'Midlertidige filer',
        tilde: 'Office-eierfiler og andre ~-filer',
        tildeExt: 'Sikkerhetskopier fra redigeringsprogrammer',
        chk: 'chkdsk-fragmenter i FOUND-mapper',
        old: 'Gamle versjoner lagt til side',
        gid: 'Indeksbuffere for Windows-hjelp',
        dmp: 'Krasjdumper',
        thumbs: 'Gamle miniatyrbuffere',
        bak: 'Sikkerhetskopier, ofte beholdt med vilje',
        log: 'Loggfiler'
      },
      openFolder: (name) => `Åpne mappen med ${name}`,
      selected: (n, size) => `${n} valgt · ${size}`,
      removeButton: { quarantine: 'Flytt til karantene', recycle: 'Flytt til papirkurven', delete: 'Slett' },
      confirm: {
        quarantine: (n, size) => `Flytte ${n} filer (${size}) til karantene? Du kan legge dem tilbake fra karantenen.`,
        recycle: (n, size) => `Flytte ${n} filer (${size}) til papirkurven? Du kan legge dem tilbake derfra.`,
        delete: (n, size) => `Slette ${n} filer (${size}) for godt? Dette kan ikke angres.`
      },
      removing: 'Fjerner…',
      close: 'Lukk',
      toast: {
        removed: (n) => `Fjernet ${n} søppelfiler.`,
        kept: (n) => `${n} filer ble latt ligge der de er.`,
        keptDetail: 'De var i bruk, er endret siden søket eller regnes ikke lenger som søppel etter innstillingene dine.'
      },
      errors: {
        noRoots: 'Velg en stasjon, eller legg til en mappe.',
        noPatterns: 'Ingen mønstre er slått på. Slå på noen i Innstillinger › Opprydding.',
        noUsableRoots: 'Ingen av de stedene kan gjennomsøkes.',
        failed: (m) => `Søket mislyktes: ${m}`,
        removeFailed: (m) => `Ingenting ble fjernet: ${m}`
      },
      settings: {
        title: 'Mønstre for søppelfiler',
        description: 'Det søppelfilsøket i Grundig opprydding leter etter. Treff fra mønstre merket Avhuket som standard starter avhuket, fordi de filene bare er kladdefiler eller bygger seg opp igjen selv; alt annet huker du av selv. Programmer, biblioteker og desktop.ini tilbys aldri, uansett mønster.',
        ariaLabel: 'Nytt mønster for søppelfiler',
        formatHint: 'Et filnavn med * for vilkårlige tegn og ? for ett tegn, for eksempel *.tmp. Store og små bokstaver spiller ingen rolle.',
        empty: 'Ingen mønstre. Legg til ett, eller tilbakestill til standard.',
        lookFor: (p) => `Søk etter ${p}`,
        preselected: 'Avhuket som standard',
        remove: (p) => `Fjern ${p}`,
        reset: 'Tilbakestill til standard',
        resetConfirm: "Erstatte listen med standard? Mønstre du har lagt til, fjernes.",
        error: {
          empty: 'Skriv inn et mønster først.',
          long: 'Det mønsteret er for langt.',
          separator: 'Et mønster er et filnavn, ikke en mappe eller en bane.',
          invalid: 'Det inneholder et tegn som ingen filnavn kan ha.',
          everything: 'Det ville passe med alle filer.',
          executable: 'Programmer, biblioteker, drivere og installasjonsprogrammer er aldri søppel.',
          desktopIni: 'Det ville passe med desktop.ini, som gir en mappe ikonet og navnet.',
          duplicate: 'Det mønsteret står allerede i listen.',
          tooMany: 'Listen er full.',
          failed: (m) => `Endringen ble ikke lagret: ${m}`
        }
      }
    }
  },
  nl: {
    junkFiles: {
      open: 'Overbodige bestanden',
      title: 'Overbodige bestanden',
      intro: 'Vindt achtergebleven tijdelijke bestanden, caches en back-ups op naam op de stations en in de mappen die je kiest, met de patronen uit Instellingen › Opschonen. Er wordt niets verwijderd tot je het aanvinkt en bevestigt.',
      where: 'Waar zoeken',
      folderPlaceholder: 'Voeg een map toe, bv. D:\\Downloads',
      folderAria: 'Map om te doorzoeken',
      addFolder: 'Toevoegen',
      foldersLabel: 'Mappen om te doorzoeken',
      removeFolder: (path) => `${path} weghalen`,
      lookingFor: 'Zoekt naar',
      editPatterns: 'Patronen bewerken',
      scan: 'Zoeken',
      scanAgain: 'Opnieuw zoeken',
      noPlaces: 'Kies een station of voeg een map toe.',
      progress: (entries, found) => `${entries} items doorzocht · ${found} gevonden`,
      idle: 'Zoeken verwijdert niets. Bestanden verschijnen hier zodra ze gevonden zijn.',
      empty: 'Daar zijn geen overbodige bestanden gevonden.',
      stoppedEmpty: 'Gestopt voordat er iets gevonden was.',
      found: (count, size) => `${count} bestanden · ${size}`,
      stopped: 'Gestopt: deze zijn daarvoor gevonden.',
      skipped: {
        lead: (n) => `Nog ${n} passende bestanden zijn met rust gelaten:`,
        recent: (n, hours) => `${n} gewijzigd in de afgelopen ${hours} uur`,
        protected: (n) => `${n} op beschermde plekken`,
        excluded: (n) => `${n} uitgesloten in Instellingen`,
        executable: (n) => `${n} programma’s of systeembestanden`,
        folders: (n) => `${n} beschermde of uitgesloten mappen zijn niet doorzocht: Windows, Program Files, de eigen mappen van geïnstalleerde programma’s en je uitzonderingen.`
      },
      truncated: 'Het zoeken bereikte de grens voordat het klaar was. Wat het vond, klopt; er kan meer zijn.',
      truncatedMatches: 'Alleen de eerste 20.000 treffers staan in de lijst. Doorzoek een kleinere map om de rest te zien.',
      unreadable: (path) => `Windows liet Prune niet in ${path} kijken.`,
      refusedRoot: {
        missing: (p) => `${p} is geen bestaande map en is overgeslagen.`,
        relative: (p) => `${p} is geen volledig pad en is overgeslagen.`,
        climb: (p) => `${p} gebruikt ".." en is overgeslagen.`,
        protected: (p) => `${p} is een beschermde plek en wordt nooit doorzocht.`
      },
      group: {
        tickAll: (pattern) => `Alle ${pattern}-bestanden aanvinken`,
        showAll: (n) => `Alle ${n} tonen`,
        showFewer: 'Minder tonen'
      },
      describe: {
        tmp: 'Tijdelijke bestanden',
        temp: 'Tijdelijke bestanden',
        tilde: 'Office-eigenaarsbestanden en andere ~-bestanden',
        tildeExt: 'Reservekopieën van editors',
        chk: 'chkdsk-fragmenten in FOUND-mappen',
        old: 'Opzijgezette oude versies',
        gid: 'Indexcaches van Windows Help',
        dmp: 'Crashdumps',
        thumbs: 'Oude miniatuurcaches',
        bak: 'Back-ups, vaak bewust bewaard',
        log: 'Logbestanden'
      },
      openFolder: (name) => `De map met ${name} openen`,
      selected: (n, size) => `${n} geselecteerd · ${size}`,
      removeButton: { quarantine: 'Naar Quarantaine', recycle: 'Naar de Prullenbak', delete: 'Verwijderen' },
      confirm: {
        quarantine: (n, size) => `${n} bestanden (${size}) naar Quarantaine verplaatsen? Je kunt ze vanuit Quarantaine terugzetten.`,
        recycle: (n, size) => `${n} bestanden (${size}) naar de Prullenbak verplaatsen? Je kunt ze daar terugzetten.`,
        delete: (n, size) => `${n} bestanden (${size}) definitief verwijderen? Dit kan niet ongedaan worden gemaakt.`
      },
      removing: 'Bezig met verwijderen…',
      close: 'Sluiten',
      toast: {
        removed: (n) => `${n} overbodige bestanden verwijderd.`,
        kept: (n) => `${n} bestanden zijn op hun plek gelaten.`,
        keptDetail: 'Ze waren in gebruik, zijn sinds het zoeken gewijzigd of gelden volgens je instellingen niet meer als overbodig.'
      },
      errors: {
        noRoots: 'Kies een station of voeg een map toe.',
        noPatterns: 'Er staan geen patronen aan. Zet er een paar aan in Instellingen › Opschonen.',
        noUsableRoots: 'Geen van die plekken kan worden doorzocht.',
        failed: (m) => `Het zoeken is mislukt: ${m}`,
        removeFailed: (m) => `Er is niets verwijderd: ${m}`
      },
      settings: {
        title: 'Patronen voor overbodige bestanden',
        description: 'Waar de zoektocht naar overbodige bestanden van Grondige opschoning naar zoekt. Resultaten van patronen met Standaard aangevinkt beginnen aangevinkt, omdat die bestanden alleen kladwerk zijn of zichzelf opnieuw opbouwen; al het andere vink je zelf aan. Programma’s, bibliotheken en desktop.ini worden nooit aangeboden, welk patroon ook.',
        ariaLabel: 'Nieuw patroon voor overbodige bestanden',
        formatHint: 'Een bestandsnaam met * voor willekeurige tekens en ? voor één teken, zoals *.tmp. Hoofdletters maken niet uit.',
        empty: 'Geen patronen. Voeg er een toe of zet de standaardwaarden terug.',
        lookFor: (p) => `Zoeken naar ${p}`,
        preselected: 'Standaard aangevinkt',
        remove: (p) => `${p} verwijderen`,
        reset: 'Standaardwaarden terugzetten',
        resetConfirm: "Je lijst vervangen door de standaardwaarden? Patronen die je zelf hebt toegevoegd, verdwijnen.",
        error: {
          empty: 'Typ eerst een patroon.',
          long: 'Dat patroon is te lang.',
          separator: 'Een patroon is een bestandsnaam, geen map of pad.',
          invalid: 'Het bevat een teken dat geen bestandsnaam kan hebben.',
          everything: 'Dat zou op elk bestand passen.',
          executable: 'Programma’s, bibliotheken, stuurprogramma’s en installatieprogramma’s zijn nooit overbodig.',
          desktopIni: 'Dat zou passen op desktop.ini, dat een map zijn pictogram en naam geeft.',
          duplicate: 'Dat patroon staat al in de lijst.',
          tooMany: 'De lijst is vol.',
          failed: (m) => `De wijziging is niet opgeslagen: ${m}`
        }
      }
    }
  },
  pl: {
    junkFiles: {
      open: 'Zbędne pliki',
      title: 'Zbędne pliki',
      intro: 'Znajduje po nazwie pozostawione pliki tymczasowe, pamięci podręczne i kopie zapasowe na wybranych dyskach i w folderach, według wzorców z Ustawienia › Czyszczenie. Nic nie zostanie usunięte, dopóki tego nie zaznaczysz i nie potwierdzisz.',
      where: 'Gdzie szukać',
      folderPlaceholder: 'Dodaj folder, np. D:\\Downloads',
      folderAria: 'Folder do przeszukania',
      addFolder: 'Dodaj',
      foldersLabel: 'Foldery do przeszukania',
      removeFolder: (path) => `Usuń ${path} z listy`,
      lookingFor: 'Szukane',
      editPatterns: 'Edytuj wzorce',
      scan: 'Skanuj',
      scanAgain: 'Skanuj ponownie',
      noPlaces: 'Wybierz dysk lub dodaj folder.',
      progress: (entries, found) => `Sprawdzono elementów: ${entries} · znaleziono: ${found}`,
      idle: 'Skanowanie niczego nie usuwa. Pliki pojawiają się tutaj na bieżąco.',
      empty: 'Nie znaleziono tam zbędnych plików.',
      stoppedEmpty: 'Zatrzymano, zanim cokolwiek znaleziono.',
      found: (count, size) => `Plików: ${count} · ${size}`,
      stopped: 'Zatrzymano: te znaleziono wcześniej.',
      skipped: {
        lead: (n) => `Kolejne pasujące pliki (${n}) pozostawiono bez zmian:`,
        recent: (n, hours) => `${n} zmienione w ciągu ostatnich ${hours} godz.`,
        protected: (n) => `${n} w chronionych miejscach`,
        excluded: (n) => `${n} wykluczone w Ustawieniach`,
        executable: (n) => `${n} programy lub pliki systemowe`,
        folders: (n) => `Nie przeszukano chronionych lub wykluczonych folderów: ${n} – Windows, Program Files, foldery zainstalowanych programów i Twoje wykluczenia.`
      },
      truncated: 'Skanowanie osiągnęło limit przed zakończeniem. To, co znalazło, jest prawdziwe; może być tego więcej.',
      truncatedMatches: 'Wyświetlono tylko pierwsze 20 000 dopasowań. Aby zobaczyć resztę, przeskanuj mniejszy folder.',
      unreadable: (path) => `Windows nie pozwolił Prune zajrzeć do ${path}.`,
      refusedRoot: {
        missing: (p) => `${p} nie jest istniejącym folderem, więc go pominięto.`,
        relative: (p) => `${p} nie jest pełną ścieżką, więc ją pominięto.`,
        climb: (p) => `${p} zawiera „..”, więc pominięto.`,
        protected: (p) => `${p} to chronione miejsce, które nigdy nie jest przeszukiwane.`
      },
      group: {
        tickAll: (pattern) => `Zaznacz wszystkie pliki ${pattern}`,
        showAll: (n) => `Pokaż wszystkie (${n})`,
        showFewer: 'Pokaż mniej'
      },
      describe: {
        tmp: 'Pliki tymczasowe',
        temp: 'Pliki tymczasowe',
        tilde: 'Pliki właściciela Office i inne pliki ~',
        tildeExt: 'Kopie zapasowe edytorów',
        chk: 'Fragmenty chkdsk w folderach FOUND',
        old: 'Odłożone stare wersje',
        gid: 'Indeksy pomocy systemu Windows',
        dmp: 'Zrzuty awarii',
        thumbs: 'Stare pamięci podręczne miniatur',
        bak: 'Kopie zapasowe, często trzymane celowo',
        log: 'Pliki dziennika'
      },
      openFolder: (name) => `Otwórz folder z plikiem ${name}`,
      selected: (n, size) => `Zaznaczono: ${n} · ${size}`,
      removeButton: { quarantine: 'Przenieś do kwarantanny', recycle: 'Przenieś do Kosza', delete: 'Usuń' },
      confirm: {
        quarantine: (n, size) => `Przenieść pliki (${n}, ${size}) do kwarantanny? Możesz je przywrócić z kwarantanny.`,
        recycle: (n, size) => `Przenieść pliki (${n}, ${size}) do Kosza? Możesz je stamtąd przywrócić.`,
        delete: (n, size) => `Trwale usunąć pliki (${n}, ${size})? Tego nie da się cofnąć.`
      },
      removing: 'Usuwanie…',
      close: 'Zamknij',
      toast: {
        removed: (n) => `Usunięto zbędne pliki: ${n}.`,
        kept: (n) => `Pliki pozostawione na miejscu: ${n}.`,
        keptDetail: 'Były w użyciu, zmieniły się od skanowania lub według Twoich ustawień nie są już zbędne.'
      },
      errors: {
        noRoots: 'Wybierz dysk lub dodaj folder.',
        noPatterns: 'Żaden wzorzec nie jest włączony. Włącz kilka w Ustawienia › Czyszczenie.',
        noUsableRoots: 'Żadnego z tych miejsc nie można przeszukać.',
        failed: (m) => `Skanowanie nie powiodło się: ${m}`,
        removeFailed: (m) => `Niczego nie usunięto: ${m}`
      },
      settings: {
        title: 'Wzorce zbędnych plików',
        description: 'Czego szuka skanowanie zbędnych plików w Głębokim czyszczeniu. Wyniki wzorców oznaczonych Zaznaczone domyślnie są od razu zaznaczone, bo te pliki są tylko robocze albo same się odtwarzają; resztę zaznaczasz sam. Programy, biblioteki i desktop.ini nigdy nie są proponowane, bez względu na wzorzec.',
        ariaLabel: 'Nowy wzorzec zbędnych plików',
        formatHint: 'Nazwa pliku z * dla dowolnych znaków i ? dla jednego, np. *.tmp. Wielkość liter nie ma znaczenia.',
        empty: 'Brak wzorców. Dodaj jakiś lub przywróć domyślne.',
        lookFor: (p) => `Szukaj ${p}`,
        preselected: 'Zaznaczone domyślnie',
        remove: (p) => `Usuń ${p}`,
        reset: 'Przywróć domyślne',
        resetConfirm: "Zastąpić listę domyślnymi? Dodane przez Ciebie wzorce zostaną usunięte.",
        error: {
          empty: 'Najpierw wpisz wzorzec.',
          long: 'Ten wzorzec jest za długi.',
          separator: 'Wzorzec to nazwa pliku, a nie folder ani ścieżka.',
          invalid: 'Zawiera znak, którego nie może mieć żadna nazwa pliku.',
          everything: 'Pasowałby do każdego pliku.',
          executable: 'Programy, biblioteki, sterowniki i instalatory nigdy nie są zbędne.',
          desktopIni: 'Pasowałby do desktop.ini, który nadaje folderowi ikonę i nazwę.',
          duplicate: 'Ten wzorzec jest już na liście.',
          tooMany: 'Lista jest pełna.',
          failed: (m) => `Zmiana nie została zapisana: ${m}`
        }
      }
    }
  },
  ps: {
    junkFiles: {
      open: 'بې ګټې فایلونه',
      title: 'بې ګټې فایلونه',
      intro: 'پاتې لنډمهاله فایلونه، کیشونه او بیک اپونه د نوم له مخې په هغو ډرایوونو او فولډرونو کې پیدا کوي چې تاسو یې ټاکئ، د تنظیمات › پاکول له نمونو سره. تر هغه چې یې په نښه او تایید نه کړئ، هېڅ نه لرې کېږي.',
      where: 'چېرته ولټول شي',
      folderPlaceholder: 'فولډر زیات کړئ، لکه D:\\Downloads',
      folderAria: 'د لټون فولډر',
      addFolder: 'زیاتول',
      foldersLabel: 'د لټون فولډرونه',
      removeFolder: (path) => `${path} لرې کول`,
      lookingFor: 'لټول کېږي',
      editPatterns: 'نمونې سمول',
      scan: 'سکن',
      scanAgain: 'بیا سکن',
      noPlaces: 'یو ډرایو وټاکئ یا فولډر زیات کړئ.',
      progress: (entries, found) => `${entries} توکي وکتل شول · ${found} وموندل شول`,
      idle: 'سکن هېڅ نه لرې کوي. فایلونه دلته ښکاري څنګه چې پیدا کېږي.',
      empty: 'هلته بې ګټې فایلونه ونه موندل شول.',
      stoppedEmpty: 'مخکې له دې چې څه پیدا شي ودرول شو.',
      found: (count, size) => `${count} فایلونه · ${size}`,
      stopped: 'ودرول شو: دا تر هغه مخکې موندل شوي وو.',
      skipped: {
        lead: (n) => `${n} نور سمون لرونکي فایلونه پرېښودل شول:`,
        recent: (n, hours) => `${n} په تېرو ${hours} ساعتونو کې بدل شوي`,
        protected: (n) => `${n} په خوندي ځایونو کې`,
        excluded: (n) => `${n} په تنظیماتو کې استثنا شوي`,
        executable: (n) => `${n} پروګرامونه یا سیسټم فایلونه`,
        folders: (n) => `${n} خوندي یا استثنا شوي فولډرونه ونه لټول شول: Windows، Program Files، د نصب شویو پروګرامونو خپل فولډرونه او ستاسو استثناوې.`
      },
      truncated: 'سکن مخکې له پای ته رسېدو خپل حد ته ورسېد. څه چې یې موندلي رښتیا دي؛ کېدای شي نور هم وي.',
      truncatedMatches: 'یوازې لومړۍ 20,000 پایلې ښودل کېږي. د پاتې لیدو لپاره کوچنی فولډر سکن کړئ.',
      unreadable: (path) => `Windows پرې نه ښود چې Prune د ${path} دننه وګوري.`,
      refusedRoot: {
        missing: (p) => `${p} موجود فولډر نه دی، نو پرېښودل شو.`,
        relative: (p) => `${p} بشپړه لار نه ده، نو پرېښودل شوه.`,
        climb: (p) => `${p} ".." کاروي، نو پرېښودل شو.`,
        protected: (p) => `${p} خوندي ځای دی او هېڅکله نه لټول کېږي.`
      },
      group: {
        tickAll: (pattern) => `ټول ${pattern} فایلونه په نښه کول`,
        showAll: (n) => `ټول ${n} ښودل`,
        showFewer: 'لږ ښودل'
      },
      describe: {
        tmp: 'لنډمهاله فایلونه',
        temp: 'لنډمهاله فایلونه',
        tilde: 'د Office د مالک فایلونه او نور ~ فایلونه',
        tildeExt: 'د اډیټرونو بیک اپ کاپي',
        chk: 'په FOUND فولډرونو کې د chkdsk ټوټې',
        old: 'یوې خوا ته ایښودل شوې زړې نسخې',
        gid: 'د Windows مرستې د فهرست کیشونه',
        dmp: 'د کرش ډمپونه',
        thumbs: 'د کوچنیو انځورونو زاړه کیشونه',
        bak: 'بیک اپونه، ډېری وخت په قصد ساتل شوي',
        log: 'لاګ فایلونه'
      },
      openFolder: (name) => `هغه فولډر پرانیستل چې ${name} لري`,
      selected: (n, size) => `${n} ټاکل شوي · ${size}`,
      removeButton: { quarantine: 'قرنطین ته لېږدول', recycle: 'ردي بکس ته لېږدول', delete: 'ړنګول' },
      confirm: {
        quarantine: (n, size) => `${n} فایلونه (${size}) قرنطین ته ولېږدول شي؟ تاسو کولای شئ له قرنطین څخه یې بېرته راوګرځوئ.`,
        recycle: (n, size) => `${n} فایلونه (${size}) ردي بکس ته ولېږدول شي؟ تاسو کولای شئ له هغه ځایه یې بېرته راوګرځوئ.`,
        delete: (n, size) => `${n} فایلونه (${size}) د تل لپاره ړنګ شي؟ دا بېرته نه شي راګرځېدای.`
      },
      removing: 'لرې کول روان دي…',
      close: 'تړل',
      toast: {
        removed: (n) => `${n} بې ګټې فایلونه لرې شول.`,
        kept: (n) => `${n} فایلونه په خپل ځای پرېښودل شول.`,
        keptDetail: 'هغوی په کار وو، له سکن وروسته بدل شوي، یا ستاسو د تنظیماتو له مخې نور بې ګټې نه ګڼل کېږي.'
      },
      errors: {
        noRoots: 'یو ډرایو وټاکئ یا فولډر زیات کړئ.',
        noPatterns: 'هېڅ نمونه فعاله نه ده. په تنظیمات › پاکول کې ځینې فعالې کړئ.',
        noUsableRoots: 'په دې ځایونو کې هېڅ یو نه شي لټول کېدای.',
        failed: (m) => `سکن ناکام شو: ${m}`,
        removeFailed: (m) => `هېڅ لرې نه شو: ${m}`
      },
      settings: {
        title: 'د بې ګټې فایلونو نمونې',
        description: 'هغه څه چې د ژور پاکول د بې ګټې فایلونو سکن یې لټوي. د هغو نمونو پایلې چې «په ډیفالټ ډول په نښه» لري په نښه شوې پیلېږي، ځکه دا فایلونه یوازې لنډمهاله دي یا ځان بیا جوړوي؛ نور ټول تاسو پخپله په نښه کوئ. پروګرامونه، کتابتونونه او desktop.ini هېڅکله نه وړاندې کېږي، نمونه هر څه چې وي.',
        ariaLabel: 'د بې ګټې فایلونو نوې نمونه',
        formatHint: 'د فایل نوم چې * د هر ډول تورو او ? د یوه توري لپاره لري، لکه *.tmp. لوی او واړه توري توپیر نه لري.',
        empty: 'هېڅ نمونه نشته. یوه زیاته کړئ، یا ډیفالټونو ته بېرته وګرځوئ.',
        lookFor: (p) => `${p} لټول`,
        preselected: 'په ډیفالټ ډول په نښه',
        remove: (p) => `${p} لرې کول`,
        reset: 'ډیفالټونو ته بېرته ګرځول',
        resetConfirm: "خپل لړ له ډیفالټونو سره بدل کړئ؟ هغه نمونې چې تاسو زیاتې کړې لرې کېږي.",
        error: {
          empty: 'لومړی یوه نمونه ولیکئ.',
          long: 'دا نمونه ډېره اوږده ده.',
          separator: 'نمونه د فایل نوم دی، نه فولډر یا لار.',
          invalid: 'داسې توری لري چې د فایل په نوم کې نه شي راتلای.',
          everything: 'دا به له هر فایل سره سمون ولري.',
          executable: 'پروګرامونه، کتابتونونه، ډرایورونه او نصبوونکي هېڅکله بې ګټې نه دي.',
          desktopIni: 'دا به له desktop.ini سره سمون ولري، چې فولډر ته یې نښه او نوم ورکوي.',
          duplicate: 'دا نمونه دمخه په لړ کې ده.',
          tooMany: 'لړ ډک دی.',
          failed: (m) => `بدلون خوندي نه شو: ${m}`
        }
      }
    }
  },
  'pt-BR': {
    junkFiles: {
      open: 'Arquivos inúteis',
      title: 'Arquivos inúteis',
      intro: 'Encontra pelo nome arquivos temporários, caches e backups que sobraram nas unidades e pastas que você escolher, usando os padrões de Configurações › Limpeza. Nada é removido até você marcar e confirmar.',
      where: 'Onde procurar',
      folderPlaceholder: 'Adicione uma pasta, ex.: D:\\Downloads',
      folderAria: 'Pasta para procurar',
      addFolder: 'Adicionar',
      foldersLabel: 'Pastas para procurar',
      removeFolder: (path) => `Tirar ${path}`,
      lookingFor: 'Procurando',
      editPatterns: 'Editar padrões',
      scan: 'Verificar',
      scanAgain: 'Verificar de novo',
      noPlaces: 'Escolha uma unidade ou adicione uma pasta.',
      progress: (entries, found) => `${entries} itens verificados · ${found} encontrados`,
      idle: 'A verificação não remove nada. Os arquivos aparecem aqui à medida que são encontrados.',
      empty: 'Nenhum arquivo inútil encontrado ali.',
      stoppedEmpty: 'Parou antes de encontrar algo.',
      found: (count, size) => `${count} arquivos · ${size}`,
      stopped: 'Parado: estes foram encontrados antes disso.',
      skipped: {
        lead: (n) => `Mais ${n} arquivos correspondentes foram deixados como estavam:`,
        recent: (n, hours) => `${n} alterados nas últimas ${hours} horas`,
        protected: (n) => `${n} em locais protegidos`,
        excluded: (n) => `${n} excluídos nas Configurações`,
        executable: (n) => `${n} programas ou arquivos do sistema`,
        folders: (n) => `${n} pastas protegidas ou excluídas não foram verificadas: Windows, Program Files, as pastas dos programas instalados e suas exclusões.`
      },
      truncated: 'A verificação atingiu o limite antes de terminar. O que ela encontrou é real; pode haver mais.',
      truncatedMatches: 'Só as primeiras 20.000 correspondências aparecem. Verifique uma pasta menor para ver o resto.',
      unreadable: (path) => `O Windows não deixou o Prune olhar dentro de ${path}.`,
      refusedRoot: {
        missing: (p) => `${p} não é uma pasta que existe, então foi ignorada.`,
        relative: (p) => `${p} não é um caminho completo, então foi ignorado.`,
        climb: (p) => `${p} usa "..", então foi ignorado.`,
        protected: (p) => `${p} é um local protegido e nunca é verificado.`
      },
      group: {
        tickAll: (pattern) => `Marcar todos os arquivos ${pattern}`,
        showAll: (n) => `Mostrar todos os ${n}`,
        showFewer: 'Mostrar menos'
      },
      describe: {
        tmp: 'Arquivos temporários',
        temp: 'Arquivos temporários',
        tilde: 'Arquivos de proprietário do Office e outros arquivos ~',
        tildeExt: 'Cópias de backup de editores',
        chk: 'Fragmentos do chkdsk em pastas FOUND',
        old: 'Versões antigas deixadas de lado',
        gid: 'Caches de índice da ajuda do Windows',
        dmp: 'Despejos de falha',
        thumbs: 'Caches antigos de miniaturas',
        bak: 'Backups, muitas vezes guardados de propósito',
        log: 'Arquivos de log'
      },
      openFolder: (name) => `Abrir a pasta que contém ${name}`,
      selected: (n, size) => `${n} selecionados · ${size}`,
      removeButton: { quarantine: 'Mover para a Quarentena', recycle: 'Mover para a Lixeira', delete: 'Excluir' },
      confirm: {
        quarantine: (n, size) => `Mover ${n} arquivos (${size}) para a Quarentena? Você pode recolocá-los a partir da Quarentena.`,
        recycle: (n, size) => `Mover ${n} arquivos (${size}) para a Lixeira? Você pode recolocá-los a partir de lá.`,
        delete: (n, size) => `Excluir ${n} arquivos (${size}) de vez? Não dá para desfazer.`
      },
      removing: 'Removendo…',
      close: 'Fechar',
      toast: {
        removed: (n) => `${n} arquivos inúteis removidos.`,
        kept: (n) => `${n} arquivos ficaram onde estavam.`,
        keptDetail: 'Estavam em uso, mudaram desde a verificação ou não contam mais como inúteis pelas suas configurações.'
      },
      errors: {
        noRoots: 'Escolha uma unidade ou adicione uma pasta.',
        noPatterns: 'Nenhum padrão está ativado. Ative alguns em Configurações › Limpeza.',
        noUsableRoots: 'Nenhum desses locais pode ser verificado.',
        failed: (m) => `A verificação falhou: ${m}`,
        removeFailed: (m) => `Nada foi removido: ${m}`
      },
      settings: {
        title: 'Padrões de arquivos inúteis',
        description: 'O que a verificação de Arquivos inúteis da Limpeza profunda procura. Os resultados dos padrões marcados como Marcado por padrão já vêm marcados, porque esses arquivos são só rascunhos ou se recriam sozinhos; o resto você marca. Programas, bibliotecas e desktop.ini nunca são oferecidos, seja qual for o padrão.',
        ariaLabel: 'Novo padrão de arquivos inúteis',
        formatHint: 'Um nome de arquivo com * para quaisquer caracteres e ? para um só, como *.tmp. Maiúsculas e minúsculas não importam.',
        empty: 'Nenhum padrão. Adicione um ou restaure os padrões de fábrica.',
        lookFor: (p) => `Procurar ${p}`,
        preselected: 'Marcado por padrão',
        remove: (p) => `Remover ${p}`,
        reset: 'Restaurar os de fábrica',
        resetConfirm: "Substituir sua lista pelos padrões de fábrica? Os padrões que você adicionou serão removidos.",
        error: {
          empty: 'Digite um padrão primeiro.',
          long: 'Esse padrão é longo demais.',
          separator: 'Um padrão é um nome de arquivo, não uma pasta nem um caminho.',
          invalid: 'Contém um caractere que nenhum nome de arquivo pode ter.',
          everything: 'Isso corresponderia a todos os arquivos.',
          executable: 'Programas, bibliotecas, drivers e instaladores nunca são inúteis.',
          desktopIni: 'Isso corresponderia a desktop.ini, que dá a uma pasta seu ícone e seu nome.',
          duplicate: 'Esse padrão já está na lista.',
          tooMany: 'A lista está cheia.',
          failed: (m) => `A alteração não foi salva: ${m}`
        }
      }
    }
  },
  pt: {
    junkFiles: {
      open: 'Ficheiros inúteis',
      title: 'Ficheiros inúteis',
      intro: 'Encontra pelo nome ficheiros temporários, caches e cópias de segurança que ficaram nas unidades e pastas que escolher, com os padrões de Definições › Limpeza. Nada é removido até o marcar e confirmar.',
      where: 'Onde procurar',
      folderPlaceholder: 'Adicione uma pasta, p. ex. D:\\Downloads',
      folderAria: 'Pasta onde procurar',
      addFolder: 'Adicionar',
      foldersLabel: 'Pastas onde procurar',
      removeFolder: (path) => `Retirar ${path}`,
      lookingFor: 'A procurar',
      editPatterns: 'Editar padrões',
      scan: 'Analisar',
      scanAgain: 'Analisar de novo',
      noPlaces: 'Escolha uma unidade ou adicione uma pasta.',
      progress: (entries, found) => `${entries} itens analisados · ${found} encontrados`,
      idle: 'A análise não remove nada. Os ficheiros aparecem aqui à medida que são encontrados.',
      empty: 'Não foram encontrados ficheiros inúteis aí.',
      stoppedEmpty: 'Parou antes de encontrar alguma coisa.',
      found: (count, size) => `${count} ficheiros · ${size}`,
      stopped: 'Parado: estes foram encontrados antes disso.',
      skipped: {
        lead: (n) => `Mais ${n} ficheiros correspondentes ficaram como estavam:`,
        recent: (n, hours) => `${n} alterados nas últimas ${hours} horas`,
        protected: (n) => `${n} em locais protegidos`,
        excluded: (n) => `${n} excluídos nas Definições`,
        executable: (n) => `${n} programas ou ficheiros de sistema`,
        folders: (n) => `${n} pastas protegidas ou excluídas não foram analisadas: Windows, Program Files, as pastas dos programas instalados e as suas exclusões.`
      },
      truncated: 'A análise atingiu o limite antes de terminar. O que encontrou é real; pode haver mais.',
      truncatedMatches: 'Só são listadas as primeiras 20 000 correspondências. Analise uma pasta mais pequena para ver o resto.',
      unreadable: (path) => `O Windows não deixou o Prune ver dentro de ${path}.`,
      refusedRoot: {
        missing: (p) => `${p} não é uma pasta existente, por isso foi ignorada.`,
        relative: (p) => `${p} não é um caminho completo, por isso foi ignorado.`,
        climb: (p) => `${p} usa "..", por isso foi ignorado.`,
        protected: (p) => `${p} é um local protegido e nunca é analisado.`
      },
      group: {
        tickAll: (pattern) => `Marcar todos os ficheiros ${pattern}`,
        showAll: (n) => `Mostrar todos os ${n}`,
        showFewer: 'Mostrar menos'
      },
      describe: {
        tmp: 'Ficheiros temporários',
        temp: 'Ficheiros temporários',
        tilde: 'Ficheiros de proprietário do Office e outros ficheiros ~',
        tildeExt: 'Cópias de segurança de editores',
        chk: 'Fragmentos do chkdsk em pastas FOUND',
        old: 'Versões antigas postas de parte',
        gid: 'Caches de índice da ajuda do Windows',
        dmp: 'Despejos de falhas',
        thumbs: 'Caches antigas de miniaturas',
        bak: 'Cópias de segurança, muitas vezes guardadas de propósito',
        log: 'Ficheiros de registo'
      },
      openFolder: (name) => `Abrir a pasta que contém ${name}`,
      selected: (n, size) => `${n} selecionados · ${size}`,
      removeButton: { quarantine: 'Mover para a Quarentena', recycle: 'Mover para a Reciclagem', delete: 'Eliminar' },
      confirm: {
        quarantine: (n, size) => `Mover ${n} ficheiros (${size}) para a Quarentena? Pode repô-los a partir da Quarentena.`,
        recycle: (n, size) => `Mover ${n} ficheiros (${size}) para a Reciclagem? Pode repô-los a partir daí.`,
        delete: (n, size) => `Eliminar ${n} ficheiros (${size}) definitivamente? Não é possível anular.`
      },
      removing: 'A remover…',
      close: 'Fechar',
      toast: {
        removed: (n) => `${n} ficheiros inúteis removidos.`,
        kept: (n) => `${n} ficheiros ficaram onde estavam.`,
        keptDetail: 'Estavam em uso, mudaram desde a análise ou já não contam como inúteis pelas suas definições.'
      },
      errors: {
        noRoots: 'Escolha uma unidade ou adicione uma pasta.',
        noPatterns: 'Nenhum padrão está ativado. Ative alguns em Definições › Limpeza.',
        noUsableRoots: 'Nenhum desses locais pode ser analisado.',
        failed: (m) => `A análise falhou: ${m}`,
        removeFailed: (m) => `Nada foi removido: ${m}`
      },
      settings: {
        title: 'Padrões de ficheiros inúteis',
        description: 'O que a análise de Ficheiros inúteis da Limpeza profunda procura. Os resultados dos padrões marcados como Marcado por predefinição já vêm marcados, porque esses ficheiros são apenas temporários ou se recriam sozinhos; o resto é o utilizador que marca. Programas, bibliotecas e desktop.ini nunca são propostos, seja qual for o padrão.',
        ariaLabel: 'Novo padrão de ficheiros inúteis',
        formatHint: 'Um nome de ficheiro com * para quaisquer carateres e ? para um só, como *.tmp. Maiúsculas e minúsculas não importam.',
        empty: 'Sem padrões. Adicione um ou reponha as predefinições.',
        lookFor: (p) => `Procurar ${p}`,
        preselected: 'Marcado por predefinição',
        remove: (p) => `Remover ${p}`,
        reset: 'Repor predefinições',
        resetConfirm: "Substituir a lista pelas predefinições? Os padrões que adicionou serão removidos.",
        error: {
          empty: 'Escreva primeiro um padrão.',
          long: 'Esse padrão é demasiado longo.',
          separator: 'Um padrão é um nome de ficheiro, não uma pasta nem um caminho.',
          invalid: 'Contém um caráter que nenhum nome de ficheiro pode ter.',
          everything: 'Isso corresponderia a todos os ficheiros.',
          executable: 'Programas, bibliotecas, controladores e instaladores nunca são inúteis.',
          desktopIni: 'Isso corresponderia a desktop.ini, que dá a uma pasta o seu ícone e o seu nome.',
          duplicate: 'Esse padrão já está na lista.',
          tooMany: 'A lista está cheia.',
          failed: (m) => `A alteração não foi guardada: ${m}`
        }
      }
    }
  },
  ro: {
    junkFiles: {
      open: 'Fișiere inutile',
      title: 'Fișiere inutile',
      intro: 'Găsește după nume fișierele temporare, memoriile cache și copiile de rezervă rămase pe unitățile și în folderele pe care le alegi, folosind modelele din Setări › Curățare. Nimic nu se elimină până nu bifezi și confirmi.',
      where: 'Unde să caute',
      folderPlaceholder: 'Adaugă un folder, de ex. D:\\Downloads',
      folderAria: 'Folder de căutat',
      addFolder: 'Adaugă',
      foldersLabel: 'Foldere de căutat',
      removeFolder: (path) => `Scoate ${path}`,
      lookingFor: 'Caută',
      editPatterns: 'Editează modelele',
      scan: 'Scanează',
      scanAgain: 'Scanează din nou',
      noPlaces: 'Alege o unitate sau adaugă un folder.',
      progress: (entries, found) => `${entries} elemente verificate · ${found} găsite`,
      idle: 'Scanarea nu elimină nimic. Fișierele apar aici pe măsură ce sunt găsite.',
      empty: 'Nu s-au găsit fișiere inutile acolo.',
      stoppedEmpty: 'Oprit înainte să se găsească ceva.',
      found: (count, size) => `${count} fișiere · ${size}`,
      stopped: 'Oprit: acestea au fost găsite înainte.',
      skipped: {
        lead: (n) => `Alte ${n} fișiere potrivite au fost lăsate neatinse:`,
        recent: (n, hours) => `${n} modificate în ultimele ${hours} ore`,
        protected: (n) => `${n} în locuri protejate`,
        excluded: (n) => `${n} excluse în Setări`,
        executable: (n) => `${n} programe sau fișiere de sistem`,
        folders: (n) => `${n} foldere protejate sau excluse nu au fost verificate: Windows, Program Files, folderele programelor instalate și excluderile tale.`
      },
      truncated: 'Scanarea și-a atins limita înainte să termine. Ce a găsit e real; s-ar putea să fie mai multe.',
      truncatedMatches: 'Sunt listate doar primele 20.000 de potriviri. Scanează un folder mai mic ca să vezi restul.',
      unreadable: (path) => `Windows nu i-a permis lui Prune să se uite în ${path}.`,
      refusedRoot: {
        missing: (p) => `${p} nu este un folder existent, așa că a fost sărit.`,
        relative: (p) => `${p} nu este o cale completă, așa că a fost sărită.`,
        climb: (p) => `${p} folosește „..”, așa că a fost sărit.`,
        protected: (p) => `${p} este un loc protejat și nu este verificat niciodată.`
      },
      group: {
        tickAll: (pattern) => `Bifează toate fișierele ${pattern}`,
        showAll: (n) => `Arată toate cele ${n}`,
        showFewer: 'Arată mai puține'
      },
      describe: {
        tmp: 'Fișiere temporare',
        temp: 'Fișiere temporare',
        tilde: 'Fișiere de proprietar Office și alte fișiere ~',
        tildeExt: 'Copii de rezervă ale editoarelor',
        chk: 'Fragmente chkdsk în foldere FOUND',
        old: 'Versiuni vechi puse deoparte',
        gid: 'Cache-uri de index pentru ajutorul Windows',
        dmp: 'Fișiere de descărcare la blocări',
        thumbs: 'Cache-uri vechi de miniaturi',
        bak: 'Copii de rezervă, adesea păstrate intenționat',
        log: 'Fișiere jurnal'
      },
      openFolder: (name) => `Deschide folderul care conține ${name}`,
      selected: (n, size) => `${n} selectate · ${size}`,
      removeButton: { quarantine: 'Mută în Carantină', recycle: 'Mută în Coșul de reciclare', delete: 'Șterge' },
      confirm: {
        quarantine: (n, size) => `Muți ${n} fișiere (${size}) în Carantină? Le poți pune la loc din Carantină.`,
        recycle: (n, size) => `Muți ${n} fișiere (${size}) în Coșul de reciclare? Le poți pune la loc de acolo.`,
        delete: (n, size) => `Ștergi definitiv ${n} fișiere (${size})? Acțiunea nu poate fi anulată.`
      },
      removing: 'Se elimină…',
      close: 'Închide',
      toast: {
        removed: (n) => `Au fost eliminate ${n} fișiere inutile.`,
        kept: (n) => `${n} fișiere au rămas la locul lor.`,
        keptDetail: 'Erau în uz, s-au schimbat de la scanare sau nu mai sunt considerate inutile după setările tale.'
      },
      errors: {
        noRoots: 'Alege o unitate sau adaugă un folder.',
        noPatterns: 'Niciun model nu este activat. Activează câteva în Setări › Curățare.',
        noUsableRoots: 'Niciunul dintre acele locuri nu poate fi verificat.',
        failed: (m) => `Scanarea a eșuat: ${m}`,
        removeFailed: (m) => `Nu s-a eliminat nimic: ${m}`
      },
      settings: {
        title: 'Modele de fișiere inutile',
        description: 'Ce caută scanarea Fișiere inutile din Curățarea profundă. Rezultatele modelelor marcate cu Bifat implicit pornesc bifate, pentru că acele fișiere sunt doar temporare sau se refac singure; restul le bifezi tu. Programele, bibliotecile și desktop.ini nu sunt oferite niciodată, indiferent de model.',
        ariaLabel: 'Model nou de fișiere inutile',
        formatHint: 'Un nume de fișier cu * pentru orice caractere și ? pentru unul singur, ca *.tmp. Literele mari sau mici nu contează.',
        empty: 'Niciun model. Adaugă unul sau revino la valorile implicite.',
        lookFor: (p) => `Caută ${p}`,
        preselected: 'Bifat implicit',
        remove: (p) => `Elimină ${p}`,
        reset: 'Revino la valorile implicite',
        resetConfirm: "Înlocuiești lista cu valorile implicite? Modelele adăugate de tine vor fi eliminate.",
        error: {
          empty: 'Scrie mai întâi un model.',
          long: 'Modelul este prea lung.',
          separator: 'Un model este un nume de fișier, nu un folder sau o cale.',
          invalid: 'Conține un caracter pe care niciun nume de fișier nu îl poate avea.',
          everything: 'S-ar potrivi cu orice fișier.',
          executable: 'Programele, bibliotecile, driverele și programele de instalare nu sunt niciodată inutile.',
          desktopIni: 'S-ar potrivi cu desktop.ini, care dă unui folder pictograma și numele.',
          duplicate: 'Modelul este deja în listă.',
          tooMany: 'Lista este plină.',
          failed: (m) => `Modificarea nu a fost salvată: ${m}`
        }
      }
    }
  },
  ru: {
    junkFiles: {
      open: 'Ненужные файлы',
      title: 'Ненужные файлы',
      intro: 'Находит по имени оставшиеся временные файлы, кэши и резервные копии на выбранных дисках и в папках по шаблонам из «Настройки › Очистка». Ничего не удаляется, пока вы не отметите и не подтвердите.',
      where: 'Где искать',
      folderPlaceholder: 'Добавьте папку, например D:\\Downloads',
      folderAria: 'Папка для поиска',
      addFolder: 'Добавить',
      foldersLabel: 'Папки для поиска',
      removeFolder: (path) => `Убрать ${path}`,
      lookingFor: 'Ищется',
      editPatterns: 'Изменить шаблоны',
      scan: 'Искать',
      scanAgain: 'Искать снова',
      noPlaces: 'Выберите диск или добавьте папку.',
      progress: (entries, found) => `Просмотрено элементов: ${entries} · найдено: ${found}`,
      idle: 'Поиск ничего не удаляет. Файлы появляются здесь по мере нахождения.',
      empty: 'Ненужных файлов там не найдено.',
      stoppedEmpty: 'Остановлено, пока ничего не найдено.',
      found: (count, size) => `Файлов: ${count} · ${size}`,
      stopped: 'Остановлено: эти были найдены до этого.',
      skipped: {
        lead: (n) => `Не тронуты ещё подходящие файлы (${n}):`,
        recent: (n, hours) => `${n} изменены за последние ${hours} ч`,
        protected: (n) => `${n} в защищённых местах`,
        excluded: (n) => `${n} исключены в настройках`,
        executable: (n) => `${n} — программы или системные файлы`,
        folders: (n) => `Не просмотрено защищённых или исключённых папок: ${n} — Windows, Program Files, папки установленных программ и ваши исключения.`
      },
      truncated: 'Поиск упёрся в ограничение, не закончив. Найденное настоящее; может быть и больше.',
      truncatedMatches: 'Показаны только первые 20 000 совпадений. Чтобы увидеть остальные, проверьте папку поменьше.',
      unreadable: (path) => `Windows не позволила Prune заглянуть в ${path}.`,
      refusedRoot: {
        missing: (p) => `${p} — не существующая папка, поэтому пропущена.`,
        relative: (p) => `${p} — не полный путь, поэтому пропущен.`,
        climb: (p) => `${p} содержит «..», поэтому пропущен.`,
        protected: (p) => `${p} — защищённое место, его никогда не просматривают.`
      },
      group: {
        tickAll: (pattern) => `Отметить все файлы ${pattern}`,
        showAll: (n) => `Показать все (${n})`,
        showFewer: 'Показать меньше'
      },
      describe: {
        tmp: 'Временные файлы',
        temp: 'Временные файлы',
        tilde: 'Файлы владельца Office и другие файлы ~',
        tildeExt: 'Резервные копии редакторов',
        chk: 'Фрагменты chkdsk в папках FOUND',
        old: 'Отложенные старые версии',
        gid: 'Кэши указателя справки Windows',
        dmp: 'Дампы сбоев',
        thumbs: 'Старые кэши эскизов',
        bak: 'Резервные копии, часто хранимые намеренно',
        log: 'Файлы журналов'
      },
      openFolder: (name) => `Открыть папку с файлом ${name}`,
      selected: (n, size) => `Выбрано: ${n} · ${size}`,
      removeButton: { quarantine: 'Переместить в Карантин', recycle: 'Переместить в Корзину', delete: 'Удалить' },
      confirm: {
        quarantine: (n, size) => `Переместить файлы (${n}, ${size}) в Карантин? Их можно вернуть из Карантина.`,
        recycle: (n, size) => `Переместить файлы (${n}, ${size}) в Корзину? Их можно вернуть оттуда.`,
        delete: (n, size) => `Удалить файлы (${n}, ${size}) навсегда? Это нельзя отменить.`
      },
      removing: 'Удаление…',
      close: 'Закрыть',
      toast: {
        removed: (n) => `Удалено ненужных файлов: ${n}.`,
        kept: (n) => `Файлов оставлено на месте: ${n}.`,
        keptDetail: 'Они использовались, изменились после поиска или по вашим настройкам больше не считаются ненужными.'
      },
      errors: {
        noRoots: 'Выберите диск или добавьте папку.',
        noPatterns: 'Ни один шаблон не включён. Включите несколько в «Настройки › Очистка».',
        noUsableRoots: 'Ни одно из этих мест нельзя просмотреть.',
        failed: (m) => `Поиск не удался: ${m}`,
        removeFailed: (m) => `Ничего не удалено: ${m}`
      },
      settings: {
        title: 'Шаблоны ненужных файлов',
        description: 'Что ищет поиск ненужных файлов в Глубокой очистке. Результаты шаблонов с пометкой «Отмечено по умолчанию» сразу отмечены, потому что такие файлы лишь черновые или восстанавливаются сами; всё остальное вы отмечаете сами. Программы, библиотеки и desktop.ini никогда не предлагаются, каким бы ни был шаблон.',
        ariaLabel: 'Новый шаблон ненужных файлов',
        formatHint: 'Имя файла, где * — любые символы, а ? — один символ, например *.tmp. Регистр букв не важен.',
        empty: 'Шаблонов нет. Добавьте шаблон или верните стандартные.',
        lookFor: (p) => `Искать ${p}`,
        preselected: 'Отмечено по умолчанию',
        remove: (p) => `Удалить ${p}`,
        reset: 'Вернуть стандартные',
        resetConfirm: "Заменить список стандартным? Добавленные вами шаблоны будут удалены.",
        error: {
          empty: 'Сначала введите шаблон.',
          long: 'Этот шаблон слишком длинный.',
          separator: 'Шаблон — это имя файла, а не папка и не путь.',
          invalid: 'В нём есть символ, недопустимый в имени файла.',
          everything: 'Под него подошёл бы любой файл.',
          executable: 'Программы, библиотеки, драйверы и установщики никогда не бывают ненужными файлами.',
          desktopIni: 'Под него подошёл бы desktop.ini, который задаёт папке значок и имя.',
          duplicate: 'Этот шаблон уже есть в списке.',
          tooMany: 'Список заполнен.',
          failed: (m) => `Изменение не сохранено: ${m}`
        }
      }
    }
  },
  sk: {
    junkFiles: {
      open: 'Nepotrebné súbory',
      title: 'Nepotrebné súbory',
      intro: 'Nájde podľa názvu zvyšné dočasné súbory, vyrovnávacie pamäte a zálohy na jednotkách a v priečinkoch, ktoré vyberiete, podľa vzorov v Nastavenia › Čistenie. Nič sa neodstráni, kým to nezačiarknete a nepotvrdíte.',
      where: 'Kde hľadať',
      folderPlaceholder: 'Pridajte priečinok, napr. D:\\Downloads',
      folderAria: 'Priečinok na prehľadanie',
      addFolder: 'Pridať',
      foldersLabel: 'Priečinky na prehľadanie',
      removeFolder: (path) => `Odobrať ${path}`,
      lookingFor: 'Hľadá sa',
      editPatterns: 'Upraviť vzory',
      scan: 'Prehľadať',
      scanAgain: 'Prehľadať znova',
      noPlaces: 'Vyberte jednotku alebo pridajte priečinok.',
      progress: (entries, found) => `Prehľadané položky: ${entries} · nájdené: ${found}`,
      idle: 'Prehľadávanie nič neodstráni. Súbory sa tu zobrazujú priebežne, ako sa nájdu.',
      empty: 'Nenašli sa tam žiadne nepotrebné súbory.',
      stoppedEmpty: 'Zastavené skôr, než sa niečo našlo.',
      found: (count, size) => `Súbory: ${count} · ${size}`,
      stopped: 'Zastavené: tieto sa našli predtým.',
      skipped: {
        lead: (n) => `Ďalších ${n} zodpovedajúcich súborov zostalo nedotknutých:`,
        recent: (n, hours) => `${n} zmenených za posledných ${hours} h`,
        protected: (n) => `${n} na chránených miestach`,
        excluded: (n) => `${n} vylúčených v Nastaveniach`,
        executable: (n) => `${n} programov alebo systémových súborov`,
        folders: (n) => `Neprehľadané chránené alebo vylúčené priečinky: ${n} – Windows, Program Files, vlastné priečinky nainštalovaných programov a vaše výnimky.`
      },
      truncated: 'Prehľadávanie dosiahlo limit skôr, než skončilo. Čo našlo, je skutočné; môže toho byť viac.',
      truncatedMatches: 'Zobrazuje sa len prvých 20 000 zhôd. Zvyšok uvidíte, keď prehľadáte menší priečinok.',
      unreadable: (path) => `Windows nedovolil Prune nahliadnuť do ${path}.`,
      refusedRoot: {
        missing: (p) => `${p} nie je existujúci priečinok, preto sa vynechal.`,
        relative: (p) => `${p} nie je úplná cesta, preto sa vynechala.`,
        climb: (p) => `${p} obsahuje „..“, preto sa vynechal.`,
        protected: (p) => `${p} je chránené miesto a nikdy sa neprehľadáva.`
      },
      group: {
        tickAll: (pattern) => `Začiarknuť všetky súbory ${pattern}`,
        showAll: (n) => `Zobraziť všetkých ${n}`,
        showFewer: 'Zobraziť menej'
      },
      describe: {
        tmp: 'Dočasné súbory',
        temp: 'Dočasné súbory',
        tilde: 'Súbory vlastníka Office a iné súbory ~',
        tildeExt: 'Záložné kópie editorov',
        chk: 'Fragmenty chkdsk v priečinkoch FOUND',
        old: 'Odložené staré verzie',
        gid: 'Vyrovnávacie pamäte indexu pomocníka Windows',
        dmp: 'Výpisy pádov',
        thumbs: 'Staré vyrovnávacie pamäte miniatúr',
        bak: 'Zálohy, často zámerne uchovávané',
        log: 'Súbory denníkov'
      },
      openFolder: (name) => `Otvoriť priečinok so súborom ${name}`,
      selected: (n, size) => `Vybrané: ${n} · ${size}`,
      removeButton: { quarantine: 'Presunúť do karantény', recycle: 'Presunúť do koša', delete: 'Odstrániť' },
      confirm: {
        quarantine: (n, size) => `Presunúť ${n} súborov (${size}) do karantény? Z karantény ich môžete vrátiť.`,
        recycle: (n, size) => `Presunúť ${n} súborov (${size}) do koša? Odtiaľ ich môžete vrátiť.`,
        delete: (n, size) => `Natrvalo odstrániť ${n} súborov (${size})? Túto akciu nemožno vrátiť.`
      },
      removing: 'Odstraňuje sa…',
      close: 'Zavrieť',
      toast: {
        removed: (n) => `Odstránené nepotrebné súbory: ${n}.`,
        kept: (n) => `Súbory ponechané na mieste: ${n}.`,
        keptDetail: 'Používali sa, od prehľadania sa zmenili alebo už podľa vašich nastavení nie sú nepotrebné.'
      },
      errors: {
        noRoots: 'Vyberte jednotku alebo pridajte priečinok.',
        noPatterns: 'Nie je zapnutý žiadny vzor. Zapnite niektoré v Nastavenia › Čistenie.',
        noUsableRoots: 'Žiadne z tých miest sa nedá prehľadať.',
        failed: (m) => `Prehľadávanie zlyhalo: ${m}`,
        removeFailed: (m) => `Nič sa neodstránilo: ${m}`
      },
      settings: {
        title: 'Vzory nepotrebných súborov',
        description: 'Čo hľadá funkcia Nepotrebné súbory v Hĺbkovom čistení. Výsledky vzorov označených Predvolene začiarknuté začínajú začiarknuté, lebo tieto súbory sú len pracovné alebo sa samy obnovia; všetko ostatné začiarknete sami. Programy, knižnice a desktop.ini sa nikdy neponúkajú, nech je vzor akýkoľvek.',
        ariaLabel: 'Nový vzor nepotrebných súborov',
        formatHint: 'Názov súboru s * pre ľubovoľné znaky a ? pre jeden znak, napr. *.tmp. Na veľkosti písmen nezáleží.',
        empty: 'Žiadne vzory. Pridajte nejaký alebo obnovte predvolené.',
        lookFor: (p) => `Hľadať ${p}`,
        preselected: 'Predvolene začiarknuté',
        remove: (p) => `Odobrať ${p}`,
        reset: 'Obnoviť predvolené',
        resetConfirm: "Nahradiť zoznam predvolenými vzormi? Vzory, ktoré ste pridali, sa odstránia.",
        error: {
          empty: 'Najprv napíšte vzor.',
          long: 'Ten vzor je príliš dlhý.',
          separator: 'Vzor je názov súboru, nie priečinok ani cesta.',
          invalid: 'Obsahuje znak, ktorý žiadny názov súboru nemôže mať.',
          everything: 'Zodpovedal by každému súboru.',
          executable: 'Programy, knižnice, ovládače a inštalátory nikdy nie sú nepotrebné súbory.',
          desktopIni: 'Zodpovedal by súboru desktop.ini, ktorý dáva priečinku ikonu a názov.',
          duplicate: 'Ten vzor už v zozname je.',
          tooMany: 'Zoznam je plný.',
          failed: (m) => `Zmena sa neuložila: ${m}`
        }
      }
    }
  },
  sq: {
    junkFiles: {
      open: 'Skedarë të panevojshëm',
      title: 'Skedarë të panevojshëm',
      intro: 'Gjen sipas emrit skedarët e përkohshëm, memoriet e përkohshme dhe kopjet rezervë të mbetura në disqet dhe dosjet që zgjedh, me modelet te Cilësimet › Pastrim. Asgjë nuk hiqet derisa ta shënosh dhe ta konfirmosh.',
      where: 'Ku të kërkohet',
      folderPlaceholder: 'Shto një dosje, p.sh. D:\\Downloads',
      folderAria: 'Dosje për kërkim',
      addFolder: 'Shto',
      foldersLabel: 'Dosjet për kërkim',
      removeFolder: (path) => `Hiq ${path}`,
      lookingFor: 'Kërkohet',
      editPatterns: 'Ndrysho modelet',
      scan: 'Skano',
      scanAgain: 'Skano sërish',
      noPlaces: 'Zgjidh një disk ose shto një dosje.',
      progress: (entries, found) => `${entries} elemente të kontrolluara · ${found} të gjetur`,
      idle: 'Skanimi nuk heq asgjë. Skedarët shfaqen këtu sapo gjenden.',
      empty: 'Nuk u gjetën skedarë të panevojshëm atje.',
      stoppedEmpty: 'U ndal para se të gjendej diçka.',
      found: (count, size) => `${count} skedarë · ${size}`,
      stopped: 'U ndal: këta u gjetën para kësaj.',
      skipped: {
        lead: (n) => `Edhe ${n} skedarë që përputhen u lanë të paprekur:`,
        recent: (n, hours) => `${n} të ndryshuar në ${hours} orët e fundit`,
        protected: (n) => `${n} në vende të mbrojtura`,
        excluded: (n) => `${n} të përjashtuar te Cilësimet`,
        executable: (n) => `${n} programe ose skedarë sistemi`,
        folders: (n) => `${n} dosje të mbrojtura ose të përjashtuara nuk u kontrolluan: Windows, Program Files, dosjet e programeve të instaluara dhe përjashtimet e tua.`
      },
      truncated: 'Skanimi arriti kufirin para se të mbaronte. Ajo që gjeti është e vërtetë; mund të ketë më shumë.',
      truncatedMatches: 'Listohen vetëm 20 000 përputhjet e para. Skano një dosje më të vogël për të parë pjesën tjetër.',
      unreadable: (path) => `Windows nuk e la Prune të shohë brenda ${path}.`,
      refusedRoot: {
        missing: (p) => `${p} nuk është dosje ekzistuese, ndaj u anashkalua.`,
        relative: (p) => `${p} nuk është shteg i plotë, ndaj u anashkalua.`,
        climb: (p) => `${p} përdor "..", ndaj u anashkalua.`,
        protected: (p) => `${p} është vend i mbrojtur dhe nuk kontrollohet kurrë.`
      },
      group: {
        tickAll: (pattern) => `Shëno të gjithë skedarët ${pattern}`,
        showAll: (n) => `Shfaqi të gjithë ${n}`,
        showFewer: 'Shfaq më pak'
      },
      describe: {
        tmp: 'Skedarë të përkohshëm',
        temp: 'Skedarë të përkohshëm',
        tilde: 'Skedarë pronari të Office dhe skedarë të tjerë ~',
        tildeExt: 'Kopje rezervë të redaktorëve',
        chk: 'Fragmente chkdsk në dosjet FOUND',
        old: 'Versione të vjetra të lëna mënjanë',
        gid: 'Memorie indeksi të ndihmës së Windows',
        dmp: 'Hedhje rrëzimesh',
        thumbs: 'Memorie të vjetra miniaturash',
        bak: 'Kopje rezervë, shpesh të mbajtura qëllimisht',
        log: 'Skedarë regjistri'
      },
      openFolder: (name) => `Hap dosjen që përmban ${name}`,
      selected: (n, size) => `${n} të zgjedhur · ${size}`,
      removeButton: { quarantine: 'Zhvendose në Karantinë', recycle: 'Zhvendose në Koshin e Riciklimit', delete: 'Fshi' },
      confirm: {
        quarantine: (n, size) => `Të zhvendosen ${n} skedarë (${size}) në Karantinë? Mund t’i kthesh nga Karantina.`,
        recycle: (n, size) => `Të zhvendosen ${n} skedarë (${size}) në Koshin e Riciklimit? Mund t’i kthesh prej andej.`,
        delete: (n, size) => `Të fshihen përgjithmonë ${n} skedarë (${size})? Kjo nuk mund të zhbëhet.`
      },
      removing: 'Po hiqen…',
      close: 'Mbyll',
      toast: {
        removed: (n) => `U hoqën ${n} skedarë të panevojshëm.`,
        kept: (n) => `${n} skedarë u lanë aty ku janë.`,
        keptDetail: 'Ishin në përdorim, ndryshuan pas skanimit ose sipas cilësimeve të tua nuk numërohen më si të panevojshëm.'
      },
      errors: {
        noRoots: 'Zgjidh një disk ose shto një dosje.',
        noPatterns: 'Asnjë model nuk është aktiv. Aktivizo disa te Cilësimet › Pastrim.',
        noUsableRoots: 'Asnjë nga ato vende nuk mund të kontrollohet.',
        failed: (m) => `Skanimi dështoi: ${m}`,
        removeFailed: (m) => `Nuk u hoq asgjë: ${m}`
      },
      settings: {
        title: 'Modelet e skedarëve të panevojshëm',
        description: 'Çfarë kërkon skanimi i skedarëve të panevojshëm te Pastrimi i thellë. Rezultatet e modeleve të shënuara Shënuar si parazgjedhje fillojnë të shënuara, sepse ata skedarë janë vetëm të përkohshëm ose rindërtohen vetë; gjithçka tjetër e shënon vetë. Programet, libraritë dhe desktop.ini nuk ofrohen kurrë, cilido qoftë modeli.',
        ariaLabel: 'Model i ri për skedarë të panevojshëm',
        formatHint: 'Një emër skedari me * për çdo karakter dhe ? për një, si *.tmp. Shkronjat e mëdha a të vogla nuk kanë rëndësi.',
        empty: 'Asnjë model. Shto një ose rikthe parazgjedhjet.',
        lookFor: (p) => `Kërko ${p}`,
        preselected: 'Shënuar si parazgjedhje',
        remove: (p) => `Hiq ${p}`,
        reset: 'Rikthe parazgjedhjet',
        resetConfirm: "Ta zëvendësosh listën me parazgjedhjet? Modelet që shtove do të hiqen.",
        error: {
          empty: 'Shkruaj fillimisht një model.',
          long: 'Ky model është shumë i gjatë.',
          separator: 'Një model është emër skedari, jo dosje ose shteg.',
          invalid: 'Përmban një karakter që asnjë emër skedari nuk mund ta ketë.',
          everything: 'Kjo do të përputhej me çdo skedar.',
          executable: 'Programet, libraritë, drejtuesit dhe instaluesit nuk janë kurrë të panevojshëm.',
          desktopIni: 'Kjo do të përputhej me desktop.ini, që i jep dosjes ikonën dhe emrin.',
          duplicate: 'Ky model është tashmë në listë.',
          tooMany: 'Lista është plot.',
          failed: (m) => `Ndryshimi nuk u ruajt: ${m}`
        }
      }
    }
  },
  sr: {
    junkFiles: {
      open: 'Непотребне датотеке',
      title: 'Непотребне датотеке',
      intro: 'Проналази по имену заостале привремене датотеке, кешеве и резервне копије на диск јединицама и у фасциклама које изаберете, према обрасцима из Подешавања › Чишћење. Ништа се не уклања док то не означите и потврдите.',
      where: 'Где тражити',
      folderPlaceholder: 'Додајте фасциклу, нпр. D:\\Downloads',
      folderAria: 'Фасцикла за претрагу',
      addFolder: 'Додај',
      foldersLabel: 'Фасцикле за претрагу',
      removeFolder: (path) => `Уклони ${path}`,
      lookingFor: 'Тражи се',
      editPatterns: 'Уреди обрасце',
      scan: 'Претражи',
      scanAgain: 'Претражи поново',
      noPlaces: 'Изаберите диск јединицу или додајте фасциклу.',
      progress: (entries, found) => `Прегледано ставки: ${entries} · пронађено: ${found}`,
      idle: 'Претрага ништа не уклања. Датотеке се овде појављују чим се пронађу.',
      empty: 'Тамо нису пронађене непотребне датотеке.',
      stoppedEmpty: 'Заустављено пре него што је било шта пронађено.',
      found: (count, size) => `Датотека: ${count} · ${size}`,
      stopped: 'Заустављено: ове су пронађене пре тога.',
      skipped: {
        lead: (n) => `Још подударних датотека остављено је нетакнуто (${n}):`,
        recent: (n, hours) => `${n} измењено у последњих ${hours} ч`,
        protected: (n) => `${n} на заштићеним местима`,
        excluded: (n) => `${n} изузето у Подешавањима`,
        executable: (n) => `${n} програма или системских датотека`,
        folders: (n) => `Непрегледаних заштићених или изузетих фасцикли: ${n} – Windows, Program Files, фасцикле инсталираних програма и ваша изузећа.`
      },
      truncated: 'Претрага је стигла до ограничења пре краја. Оно што је нашла је стварно; можда има још.',
      truncatedMatches: 'Приказује се само првих 20.000 подударања. Претражите мању фасциклу да видите остатак.',
      unreadable: (path) => `Windows није дозволио да Prune погледа у ${path}.`,
      refusedRoot: {
        missing: (p) => `${p} није постојећа фасцикла, па је прескочена.`,
        relative: (p) => `${p} није пуна путања, па је прескочена.`,
        climb: (p) => `${p} користи „..“, па је прескочено.`,
        protected: (p) => `${p} је заштићено место и никад се не претражује.`
      },
      group: {
        tickAll: (pattern) => `Означи све ${pattern} датотеке`,
        showAll: (n) => `Прикажи свих ${n}`,
        showFewer: 'Прикажи мање'
      },
      describe: {
        tmp: 'Привремене датотеке',
        temp: 'Привремене датотеке',
        tilde: 'Office датотеке власника и друге ~ датотеке',
        tildeExt: 'Резервне копије уређивача',
        chk: 'chkdsk фрагменти у FOUND фасциклама',
        old: 'Склоњене старе верзије',
        gid: 'Кешеви индекса Windows помоћи',
        dmp: 'Дампови пада',
        thumbs: 'Стари кешеви сличица',
        bak: 'Резервне копије, често намерно чуване',
        log: 'Датотеке евиденције'
      },
      openFolder: (name) => `Отвори фасциклу у којој је ${name}`,
      selected: (n, size) => `Изабрано: ${n} · ${size}`,
      removeButton: { quarantine: 'Премести у карантин', recycle: 'Премести у корпу за отпатке', delete: 'Избриши' },
      confirm: {
        quarantine: (n, size) => `Преместити датотеке (${n}, ${size}) у карантин? Можете их вратити из карантина.`,
        recycle: (n, size) => `Преместити датотеке (${n}, ${size}) у корпу за отпатке? Можете их вратити одатле.`,
        delete: (n, size) => `Трајно избрисати датотеке (${n}, ${size})? То се не може опозвати.`
      },
      removing: 'Уклањање…',
      close: 'Затвори',
      toast: {
        removed: (n) => `Уклоњено непотребних датотека: ${n}.`,
        kept: (n) => `Датотека остављено на месту: ${n}.`,
        keptDetail: 'Биле су у употреби, промениле су се после претраге или се по вашим подешавањима више не сматрају непотребним.'
      },
      errors: {
        noRoots: 'Изаберите диск јединицу или додајте фасциклу.',
        noPatterns: 'Ниједан образац није укључен. Укључите неке у Подешавања › Чишћење.',
        noUsableRoots: 'Ниједно од тих места не може да се претражи.',
        failed: (m) => `Претрага није успела: ${m}`,
        removeFailed: (m) => `Ништа није уклоњено: ${m}`
      },
      settings: {
        title: 'Обрасци непотребних датотека',
        description: 'Шта тражи претрага непотребних датотека у Дубоком чишћењу. Резултати образаца означених са Подразумевано означено почињу означени, јер су те датотеке само радне или се саме обнављају; све остало означавате сами. Програми, библиотеке и desktop.ini никад се не нуде, какав год да је образац.',
        ariaLabel: 'Нови образац непотребних датотека',
        formatHint: 'Име датотеке са * за било које знакове и ? за један, нпр. *.tmp. Величина слова није битна.',
        empty: 'Нема образаца. Додајте један или вратите подразумеване.',
        lookFor: (p) => `Тражи ${p}`,
        preselected: 'Подразумевано означено',
        remove: (p) => `Уклони ${p}`,
        reset: 'Врати подразумеване',
        resetConfirm: "Заменити листу подразумеваним? Обрасци које сте додали биће уклоњени.",
        error: {
          empty: 'Прво унесите образац.',
          long: 'Тај образац је предугачак.',
          separator: 'Образац је име датотеке, а не фасцикла или путања.',
          invalid: 'Садржи знак који ниједно име датотеке не може да има.',
          everything: 'То би одговарало свакој датотеци.',
          executable: 'Програми, библиотеке, управљачки програми и инсталатери никад нису непотребни.',
          desktopIni: 'То би одговарало датотеци desktop.ini, која фасцикли даје икону и име.',
          duplicate: 'Тај образац је већ на листи.',
          tooMany: 'Листа је пуна.',
          failed: (m) => `Промена није сачувана: ${m}`
        }
      }
    }
  },
  sv: {
    junkFiles: {
      open: 'Skräpfiler',
      title: 'Skräpfiler',
      intro: 'Hittar kvarlämnade tillfälliga filer, cacheminnen och säkerhetskopior efter namn på de enheter och i de mappar du väljer, enligt mönstren i Inställningar › Rensning. Inget tas bort förrän du bockar för det och bekräftar.',
      where: 'Var det ska sökas',
      folderPlaceholder: 'Lägg till en mapp, t.ex. D:\\Downloads',
      folderAria: 'Mapp att söka i',
      addFolder: 'Lägg till',
      foldersLabel: 'Mappar att söka i',
      removeFolder: (path) => `Ta bort ${path}`,
      lookingFor: 'Söker efter',
      editPatterns: 'Redigera mönster',
      scan: 'Sök',
      scanAgain: 'Sök igen',
      noPlaces: 'Välj en enhet eller lägg till en mapp.',
      progress: (entries, found) => `${entries} objekt genomsökta · ${found} hittade`,
      idle: 'Sökningen tar inte bort något. Filerna visas här efter hand som de hittas.',
      empty: 'Inga skräpfiler hittades där.',
      stoppedEmpty: 'Stoppades innan något hittades.',
      found: (count, size) => `${count} filer · ${size}`,
      stopped: 'Stoppad: de här hittades innan dess.',
      skipped: {
        lead: (n) => `${n} filer till som matchar lämnades orörda:`,
        recent: (n, hours) => `${n} ändrade de senaste ${hours} timmarna`,
        protected: (n) => `${n} på skyddade platser`,
        excluded: (n) => `${n} undantagna i Inställningar`,
        executable: (n) => `${n} program eller systemfiler`,
        folders: (n) => `${n} skyddade eller undantagna mappar genomsöktes inte: Windows, Program Files, installerade programs egna mappar och dina undantag.`
      },
      truncated: 'Sökningen nådde sin gräns innan den blev klar. Det den hittade är verkligt; det kan finnas fler.',
      truncatedMatches: 'Bara de första 20 000 träffarna visas. Sök i en mindre mapp för att se resten.',
      unreadable: (path) => `Windows lät inte Prune titta in i ${path}.`,
      refusedRoot: {
        missing: (p) => `${p} är ingen mapp som finns, så den hoppades över.`,
        relative: (p) => `${p} är ingen fullständig sökväg, så den hoppades över.`,
        climb: (p) => `${p} använder "..", så den hoppades över.`,
        protected: (p) => `${p} är en skyddad plats och genomsöks aldrig.`
      },
      group: {
        tickAll: (pattern) => `Bocka för alla ${pattern}-filer`,
        showAll: (n) => `Visa alla ${n}`,
        showFewer: 'Visa färre'
      },
      describe: {
        tmp: 'Tillfälliga filer',
        temp: 'Tillfälliga filer',
        tilde: 'Office-ägarfiler och andra ~-filer',
        tildeExt: 'Säkerhetskopior från redigerare',
        chk: 'chkdsk-fragment i FOUND-mappar',
        old: 'Gamla versioner som lagts undan',
        gid: 'Indexcacheminnen för Windows-hjälpen',
        dmp: 'Kraschdumpar',
        thumbs: 'Gamla miniatyrcacheminnen',
        bak: 'Säkerhetskopior, ofta sparade med flit',
        log: 'Loggfiler'
      },
      openFolder: (name) => `Öppna mappen med ${name}`,
      selected: (n, size) => `${n} valda · ${size}`,
      removeButton: { quarantine: 'Flytta till karantän', recycle: 'Flytta till papperskorgen', delete: 'Ta bort' },
      confirm: {
        quarantine: (n, size) => `Flytta ${n} filer (${size}) till karantän? Du kan lägga tillbaka dem från karantänen.`,
        recycle: (n, size) => `Flytta ${n} filer (${size}) till papperskorgen? Du kan lägga tillbaka dem därifrån.`,
        delete: (n, size) => `Ta bort ${n} filer (${size}) för gott? Det går inte att ångra.`
      },
      removing: 'Tar bort…',
      close: 'Stäng',
      toast: {
        removed: (n) => `${n} skräpfiler togs bort.`,
        kept: (n) => `${n} filer lämnades där de är.`,
        keptDetail: 'De användes, har ändrats sedan sökningen eller räknas inte längre som skräp enligt dina inställningar.'
      },
      errors: {
        noRoots: 'Välj en enhet eller lägg till en mapp.',
        noPatterns: 'Inga mönster är påslagna. Slå på några i Inställningar › Rensning.',
        noUsableRoots: 'Ingen av de platserna kan genomsökas.',
        failed: (m) => `Sökningen misslyckades: ${m}`,
        removeFailed: (m) => `Inget togs bort: ${m}`
      },
      settings: {
        title: 'Mönster för skräpfiler',
        description: 'Det som Grundlig rensnings sökning efter skräpfiler letar efter. Träffar från mönster märkta Förbockad som standard börjar förbockade, eftersom de filerna bara är tillfälliga eller bygger upp sig själva igen; allt annat bockar du för själv. Program, bibliotek och desktop.ini erbjuds aldrig, oavsett mönster.',
        ariaLabel: 'Nytt mönster för skräpfiler',
        formatHint: 'Ett filnamn med * för valfria tecken och ? för ett tecken, till exempel *.tmp. Stora och små bokstäver spelar ingen roll.',
        empty: 'Inga mönster. Lägg till ett eller återställ standardvärdena.',
        lookFor: (p) => `Sök efter ${p}`,
        preselected: 'Förbockad som standard',
        remove: (p) => `Ta bort ${p}`,
        reset: 'Återställ standard',
        resetConfirm: "Ersätta listan med standardvärdena? Mönster du har lagt till tas bort.",
        error: {
          empty: 'Skriv ett mönster först.',
          long: 'Det mönstret är för långt.',
          separator: 'Ett mönster är ett filnamn, inte en mapp eller en sökväg.',
          invalid: 'Det innehåller ett tecken som inget filnamn kan ha.',
          everything: 'Det skulle matcha alla filer.',
          executable: 'Program, bibliotek, drivrutiner och installationsprogram är aldrig skräp.',
          desktopIni: 'Det skulle matcha desktop.ini, som ger en mapp dess ikon och namn.',
          duplicate: 'Det mönstret finns redan i listan.',
          tooMany: 'Listan är full.',
          failed: (m) => `Ändringen sparades inte: ${m}`
        }
      }
    }
  },
  th: {
    junkFiles: {
      open: 'ไฟล์ขยะ',
      title: 'ไฟล์ขยะ',
      intro: 'ค้นหาไฟล์ชั่วคราว แคช และไฟล์สำรองที่หลงเหลือตามชื่อ ในไดรฟ์และโฟลเดอร์ที่คุณเลือก โดยใช้รูปแบบใน การตั้งค่า › ล้างข้อมูล จะไม่มีสิ่งใดถูกนำออกจนกว่าคุณจะทำเครื่องหมายและยืนยัน',
      where: 'ค้นหาที่ไหน',
      folderPlaceholder: 'เพิ่มโฟลเดอร์ เช่น D:\\Downloads',
      folderAria: 'โฟลเดอร์ที่จะค้นหา',
      addFolder: 'เพิ่ม',
      foldersLabel: 'โฟลเดอร์ที่จะค้นหา',
      removeFolder: (path) => `เอา ${path} ออก`,
      lookingFor: 'กำลังค้นหา',
      editPatterns: 'แก้ไขรูปแบบ',
      scan: 'สแกน',
      scanAgain: 'สแกนอีกครั้ง',
      noPlaces: 'เลือกไดรฟ์หรือเพิ่มโฟลเดอร์',
      progress: (entries, found) => `ตรวจแล้ว ${entries} รายการ · พบ ${found}`,
      idle: 'การสแกนไม่นำสิ่งใดออก ไฟล์จะปรากฏที่นี่ทันทีที่พบ',
      empty: 'ไม่พบไฟล์ขยะในที่นั้น',
      stoppedEmpty: 'หยุดก่อนที่จะพบสิ่งใด',
      found: (count, size) => `${count} ไฟล์ · ${size}`,
      stopped: 'หยุดแล้ว: รายการเหล่านี้พบก่อนหน้านั้น',
      skipped: {
        lead: (n) => `ไฟล์ที่ตรงกันอีก ${n} ไฟล์ถูกปล่อยไว้:`,
        recent: (n, hours) => `${n} ไฟล์เปลี่ยนแปลงใน ${hours} ชั่วโมงที่ผ่านมา`,
        protected: (n) => `${n} ไฟล์อยู่ในตำแหน่งที่ได้รับการป้องกัน`,
        excluded: (n) => `${n} ไฟล์ถูกยกเว้นในการตั้งค่า`,
        executable: (n) => `${n} ไฟล์เป็นโปรแกรมหรือไฟล์ระบบ`,
        folders: (n) => `ไม่ได้ตรวจโฟลเดอร์ที่ได้รับการป้องกันหรือถูกยกเว้น ${n} โฟลเดอร์: Windows, Program Files, โฟลเดอร์ของโปรแกรมที่ติดตั้ง และรายการยกเว้นของคุณ`
      },
      truncated: 'การสแกนถึงขีดจำกัดก่อนจะเสร็จ สิ่งที่พบเป็นของจริง แต่อาจมีมากกว่านี้',
      truncatedMatches: 'แสดงเฉพาะ 20,000 รายการแรก สแกนโฟลเดอร์ที่เล็กกว่าเพื่อดูส่วนที่เหลือ',
      unreadable: (path) => `Windows ไม่อนุญาตให้ Prune ดูข้างใน ${path}`,
      refusedRoot: {
        missing: (p) => `${p} ไม่ใช่โฟลเดอร์ที่มีอยู่ จึงถูกข้าม`,
        relative: (p) => `${p} ไม่ใช่เส้นทางแบบเต็ม จึงถูกข้าม`,
        climb: (p) => `${p} ใช้ ".." จึงถูกข้าม`,
        protected: (p) => `${p} เป็นตำแหน่งที่ได้รับการป้องกันและจะไม่ถูกค้นหา`
      },
      group: {
        tickAll: (pattern) => `ทำเครื่องหมายไฟล์ ${pattern} ทั้งหมด`,
        showAll: (n) => `แสดงทั้งหมด ${n}`,
        showFewer: 'แสดงน้อยลง'
      },
      describe: {
        tmp: 'ไฟล์ชั่วคราว',
        temp: 'ไฟล์ชั่วคราว',
        tilde: 'ไฟล์เจ้าของของ Office และไฟล์ ~ อื่นๆ',
        tildeExt: 'สำเนาสำรองของโปรแกรมแก้ไข',
        chk: 'ชิ้นส่วน chkdsk ในโฟลเดอร์ FOUND',
        old: 'เวอร์ชันเก่าที่เก็บไว้ข้างๆ',
        gid: 'แคชดัชนีวิธีใช้ของ Windows',
        dmp: 'ไฟล์ดัมพ์เมื่อแครช',
        thumbs: 'แคชภาพขนาดย่อเก่า',
        bak: 'ไฟล์สำรอง มักเก็บไว้โดยตั้งใจ',
        log: 'ไฟล์บันทึก'
      },
      openFolder: (name) => `เปิดโฟลเดอร์ที่มี ${name}`,
      selected: (n, size) => `เลือก ${n} · ${size}`,
      removeButton: { quarantine: 'ย้ายไปที่กักกัน', recycle: 'ย้ายไปที่ถังรีไซเคิล', delete: 'ลบ' },
      confirm: {
        quarantine: (n, size) => `ย้าย ${n} ไฟล์ (${size}) ไปที่กักกันหรือไม่ คุณนำกลับคืนได้จากกักกัน`,
        recycle: (n, size) => `ย้าย ${n} ไฟล์ (${size}) ไปที่ถังรีไซเคิลหรือไม่ คุณนำกลับคืนได้จากที่นั่น`,
        delete: (n, size) => `ลบ ${n} ไฟล์ (${size}) อย่างถาวรหรือไม่ การทำเช่นนี้ย้อนกลับไม่ได้`
      },
      removing: 'กำลังนำออก…',
      close: 'ปิด',
      toast: {
        removed: (n) => `นำไฟล์ขยะออกแล้ว ${n} ไฟล์`,
        kept: (n) => `${n} ไฟล์ถูกปล่อยไว้ที่เดิม`,
        keptDetail: 'ไฟล์เหล่านั้นกำลังใช้งาน เปลี่ยนไปหลังการสแกน หรือไม่นับเป็นขยะอีกต่อไปตามการตั้งค่าของคุณ'
      },
      errors: {
        noRoots: 'เลือกไดรฟ์หรือเพิ่มโฟลเดอร์',
        noPatterns: 'ไม่มีรูปแบบที่เปิดอยู่ เปิดบางรายการใน การตั้งค่า › ล้างข้อมูล',
        noUsableRoots: 'ไม่สามารถค้นหาในตำแหน่งใดเหล่านั้นได้',
        failed: (m) => `การสแกนล้มเหลว: ${m}`,
        removeFailed: (m) => `ไม่มีสิ่งใดถูกนำออก: ${m}`
      },
      settings: {
        title: 'รูปแบบไฟล์ขยะ',
        description: 'สิ่งที่การสแกนไฟล์ขยะของการทำความสะอาดเชิงลึกค้นหา ผลลัพธ์จากรูปแบบที่ระบุว่า ทำเครื่องหมายไว้ตามค่าเริ่มต้น จะเริ่มต้นแบบทำเครื่องหมาย เพราะไฟล์เหล่านั้นเป็นแค่ไฟล์ชั่วคราวหรือสร้างใหม่เองได้ ส่วนที่เหลือคุณทำเครื่องหมายเอง โปรแกรม ไลบรารี และ desktop.ini จะไม่ถูกเสนอเลยไม่ว่ารูปแบบจะเป็นอะไร',
        ariaLabel: 'รูปแบบไฟล์ขยะใหม่',
        formatHint: 'ชื่อไฟล์ที่ใช้ * แทนอักขระใดก็ได้และ ? แทนหนึ่งตัว เช่น *.tmp ตัวพิมพ์เล็กหรือใหญ่ไม่มีผล',
        empty: 'ไม่มีรูปแบบ เพิ่มหนึ่งรายการ หรือรีเซ็ตเป็นค่าเริ่มต้น',
        lookFor: (p) => `ค้นหา ${p}`,
        preselected: 'ทำเครื่องหมายไว้ตามค่าเริ่มต้น',
        remove: (p) => `เอา ${p} ออก`,
        reset: 'รีเซ็ตเป็นค่าเริ่มต้น',
        resetConfirm: "แทนที่รายการของคุณด้วยค่าเริ่มต้นหรือไม่ รูปแบบที่คุณเพิ่มไว้จะถูกนำออก",
        error: {
          empty: 'พิมพ์รูปแบบก่อน',
          long: 'รูปแบบนั้นยาวเกินไป',
          separator: 'รูปแบบคือชื่อไฟล์ ไม่ใช่โฟลเดอร์หรือเส้นทาง',
          invalid: 'มีอักขระที่ชื่อไฟล์ไม่สามารถมีได้',
          everything: 'รูปแบบนี้จะตรงกับทุกไฟล์',
          executable: 'โปรแกรม ไลบรารี ไดรเวอร์ และตัวติดตั้งไม่ใช่ขยะ',
          desktopIni: 'รูปแบบนี้จะตรงกับ desktop.ini ซึ่งกำหนดไอคอนและชื่อของโฟลเดอร์',
          duplicate: 'รูปแบบนั้นอยู่ในรายการแล้ว',
          tooMany: 'รายการเต็มแล้ว',
          failed: (m) => `ไม่ได้บันทึกการเปลี่ยนแปลง: ${m}`
        }
      }
    }
  },
  tr: {
    junkFiles: {
      open: 'Gereksiz dosyalar',
      title: 'Gereksiz dosyalar',
      intro: 'Seçtiğiniz sürücülerde ve klasörlerde kalan geçici dosyaları, önbellekleri ve yedekleri, Ayarlar › Temizlik’teki desenlere göre adlarından bulur. İşaretleyip onaylamadan hiçbir şey kaldırılmaz.',
      where: 'Nerede aranacak',
      folderPlaceholder: 'Klasör ekleyin, örn. D:\\Downloads',
      folderAria: 'Aranacak klasör',
      addFolder: 'Ekle',
      foldersLabel: 'Aranacak klasörler',
      removeFolder: (path) => `${path} öğesini çıkar`,
      lookingFor: 'Aranan',
      editPatterns: 'Desenleri düzenle',
      scan: 'Tara',
      scanAgain: 'Yeniden tara',
      noPlaces: 'Bir sürücü seçin veya klasör ekleyin.',
      progress: (entries, found) => `${entries} öğe tarandı · ${found} bulundu`,
      idle: 'Tarama hiçbir şeyi kaldırmaz. Dosyalar bulundukça burada görünür.',
      empty: 'Orada gereksiz dosya bulunamadı.',
      stoppedEmpty: 'Bir şey bulunmadan durduruldu.',
      found: (count, size) => `${count} dosya · ${size}`,
      stopped: 'Durduruldu: bunlar ondan önce bulundu.',
      skipped: {
        lead: (n) => `Eşleşen ${n} dosya daha olduğu gibi bırakıldı:`,
        recent: (n, hours) => `${n} tanesi son ${hours} saatte değişti`,
        protected: (n) => `${n} tanesi korumalı yerlerde`,
        excluded: (n) => `${n} tanesi Ayarlar’da hariç tutuldu`,
        executable: (n) => `${n} tanesi program veya sistem dosyası`,
        folders: (n) => `Korumalı veya hariç tutulan ${n} klasör taranmadı: Windows, Program Files, yüklü programların kendi klasörleri ve hariç tuttuklarınız.`
      },
      truncated: 'Tarama bitmeden sınırına ulaştı. Bulduğu gerçek; daha fazlası olabilir.',
      truncatedMatches: 'Yalnızca ilk 20.000 eşleşme listeleniyor. Kalanını görmek için daha küçük bir klasörü tarayın.',
      unreadable: (path) => `Windows, Prune’un ${path} içine bakmasına izin vermedi.`,
      refusedRoot: {
        missing: (p) => `${p} var olan bir klasör değil, bu yüzden atlandı.`,
        relative: (p) => `${p} tam bir yol değil, bu yüzden atlandı.`,
        climb: (p) => `${p} ".." kullanıyor, bu yüzden atlandı.`,
        protected: (p) => `${p} korumalı bir yer, asla taranmaz.`
      },
      group: {
        tickAll: (pattern) => `Tüm ${pattern} dosyalarını işaretle`,
        showAll: (n) => `Tümünü göster (${n})`,
        showFewer: 'Daha az göster'
      },
      describe: {
        tmp: 'Geçici dosyalar',
        temp: 'Geçici dosyalar',
        tilde: 'Office sahip dosyaları ve diğer ~ dosyaları',
        tildeExt: 'Düzenleyici yedek kopyaları',
        chk: 'FOUND klasörlerindeki chkdsk parçaları',
        old: 'Kenara alınmış eski sürümler',
        gid: 'Windows yardımı dizin önbellekleri',
        dmp: 'Çökme dökümleri',
        thumbs: 'Eski küçük resim önbellekleri',
        bak: 'Yedekler, çoğu zaman bilerek saklanır',
        log: 'Günlük dosyaları'
      },
      openFolder: (name) => `${name} dosyasının bulunduğu klasörü aç`,
      selected: (n, size) => `${n} seçili · ${size}`,
      removeButton: { quarantine: 'Karantinaya taşı', recycle: 'Geri Dönüşüm Kutusuna taşı', delete: 'Sil' },
      confirm: {
        quarantine: (n, size) => `${n} dosya (${size}) Karantinaya taşınsın mı? Onları Karantinadan geri koyabilirsiniz.`,
        recycle: (n, size) => `${n} dosya (${size}) Geri Dönüşüm Kutusuna taşınsın mı? Onları oradan geri koyabilirsiniz.`,
        delete: (n, size) => `${n} dosya (${size}) kalıcı olarak silinsin mi? Bu geri alınamaz.`
      },
      removing: 'Kaldırılıyor…',
      close: 'Kapat',
      toast: {
        removed: (n) => `${n} gereksiz dosya kaldırıldı.`,
        kept: (n) => `${n} dosya yerinde bırakıldı.`,
        keptDetail: 'Kullanımdaydılar, taramadan sonra değiştiler veya ayarlarınıza göre artık gereksiz sayılmıyorlar.'
      },
      errors: {
        noRoots: 'Bir sürücü seçin veya klasör ekleyin.',
        noPatterns: 'Açık desen yok. Ayarlar › Temizlik’te birkaçını açın.',
        noUsableRoots: 'Bu yerlerin hiçbiri taranamıyor.',
        failed: (m) => `Tarama başarısız oldu: ${m}`,
        removeFailed: (m) => `Hiçbir şey kaldırılmadı: ${m}`
      },
      settings: {
        title: 'Gereksiz dosya desenleri',
        description: 'Derin Temizlik’in Gereksiz dosyalar taramasının aradıkları. Varsayılan olarak işaretli diye belirtilen desenlerin sonuçları işaretli başlar, çünkü bu dosyalar yalnızca geçici çalışmalardır ya da kendilerini yeniden oluştururlar; geri kalanı siz işaretlersiniz. Programlar, kitaplıklar ve desktop.ini, desen ne olursa olsun asla önerilmez.',
        ariaLabel: 'Yeni gereksiz dosya deseni',
        formatHint: 'Herhangi karakterler için * ve tek karakter için ? içeren bir dosya adı, örneğin *.tmp. Büyük/küçük harf önemli değildir.',
        empty: 'Desen yok. Bir tane ekleyin veya varsayılanlara sıfırlayın.',
        lookFor: (p) => `${p} ara`,
        preselected: 'Varsayılan olarak işaretli',
        remove: (p) => `${p} kaldır`,
        reset: 'Varsayılanlara sıfırla',
        resetConfirm: "Listeniz varsayılanlarla değiştirilsin mi? Eklediğiniz desenler kaldırılır.",
        error: {
          empty: 'Önce bir desen yazın.',
          long: 'Bu desen çok uzun.',
          separator: 'Desen bir dosya adıdır, klasör veya yol değil.',
          invalid: 'Hiçbir dosya adında olamayacak bir karakter içeriyor.',
          everything: 'Bu her dosyayla eşleşir.',
          executable: 'Programlar, kitaplıklar, sürücüler ve yükleyiciler asla gereksiz değildir.',
          desktopIni: 'Bu, bir klasöre simgesini ve adını veren desktop.ini ile eşleşir.',
          duplicate: 'Bu desen zaten listede.',
          tooMany: 'Liste dolu.',
          failed: (m) => `Değişiklik kaydedilmedi: ${m}`
        }
      }
    }
  },
  uk: {
    junkFiles: {
      open: 'Непотрібні файли',
      title: 'Непотрібні файли',
      intro: 'Знаходить за назвою залишені тимчасові файли, кеші та резервні копії на вибраних дисках і в папках за шаблонами з «Налаштування › Очищення». Нічого не вилучається, доки ви не позначите й не підтвердите.',
      where: 'Де шукати',
      folderPlaceholder: 'Додайте папку, наприклад D:\\Downloads',
      folderAria: 'Папка для пошуку',
      addFolder: 'Додати',
      foldersLabel: 'Папки для пошуку',
      removeFolder: (path) => `Прибрати ${path}`,
      lookingFor: 'Шукається',
      editPatterns: 'Змінити шаблони',
      scan: 'Шукати',
      scanAgain: 'Шукати знову',
      noPlaces: 'Виберіть диск або додайте папку.',
      progress: (entries, found) => `Переглянуто елементів: ${entries} · знайдено: ${found}`,
      idle: 'Пошук нічого не вилучає. Файли з’являються тут, щойно їх знайдено.',
      empty: 'Непотрібних файлів там не знайдено.',
      stoppedEmpty: 'Зупинено, поки нічого не знайдено.',
      found: (count, size) => `Файлів: ${count} · ${size}`,
      stopped: 'Зупинено: ці знайдено раніше.',
      skipped: {
        lead: (n) => `Не зачеплено ще відповідні файли (${n}):`,
        recent: (n, hours) => `${n} змінено за останні ${hours} год`,
        protected: (n) => `${n} у захищених місцях`,
        excluded: (n) => `${n} виключено в налаштуваннях`,
        executable: (n) => `${n} — програми або системні файли`,
        folders: (n) => `Не переглянуто захищених або виключених папок: ${n} — Windows, Program Files, папки встановлених програм і ваші виключення.`
      },
      truncated: 'Пошук досяг обмеження, не завершившись. Знайдене справжнє; може бути й більше.',
      truncatedMatches: 'Показано лише перші 20 000 збігів. Щоб побачити решту, перегляньте меншу папку.',
      unreadable: (path) => `Windows не дозволила Prune зазирнути в ${path}.`,
      refusedRoot: {
        missing: (p) => `${p} — не наявна папка, тому її пропущено.`,
        relative: (p) => `${p} — не повний шлях, тому його пропущено.`,
        climb: (p) => `${p} містить «..», тому його пропущено.`,
        protected: (p) => `${p} — захищене місце, його ніколи не переглядають.`
      },
      group: {
        tickAll: (pattern) => `Позначити всі файли ${pattern}`,
        showAll: (n) => `Показати всі (${n})`,
        showFewer: 'Показати менше'
      },
      describe: {
        tmp: 'Тимчасові файли',
        temp: 'Тимчасові файли',
        tilde: 'Файли власника Office та інші файли ~',
        tildeExt: 'Резервні копії редакторів',
        chk: 'Фрагменти chkdsk у папках FOUND',
        old: 'Відкладені старі версії',
        gid: 'Кеші покажчика довідки Windows',
        dmp: 'Дампи збоїв',
        thumbs: 'Старі кеші ескізів',
        bak: 'Резервні копії, часто збережені навмисно',
        log: 'Файли журналів'
      },
      openFolder: (name) => `Відкрити папку з файлом ${name}`,
      selected: (n, size) => `Вибрано: ${n} · ${size}`,
      removeButton: { quarantine: 'Перемістити в Карантин', recycle: 'Перемістити в Кошик', delete: 'Видалити' },
      confirm: {
        quarantine: (n, size) => `Перемістити файли (${n}, ${size}) у Карантин? Їх можна повернути з Карантину.`,
        recycle: (n, size) => `Перемістити файли (${n}, ${size}) у Кошик? Їх можна повернути звідти.`,
        delete: (n, size) => `Видалити файли (${n}, ${size}) назавжди? Це не можна скасувати.`
      },
      removing: 'Вилучення…',
      close: 'Закрити',
      toast: {
        removed: (n) => `Вилучено непотрібних файлів: ${n}.`,
        kept: (n) => `Залишено на місці файлів: ${n}.`,
        keptDetail: 'Вони використовувалися, змінилися після пошуку або за вашими налаштуваннями більше не вважаються непотрібними.'
      },
      errors: {
        noRoots: 'Виберіть диск або додайте папку.',
        noPatterns: 'Жоден шаблон не ввімкнено. Увімкніть кілька в «Налаштування › Очищення».',
        noUsableRoots: 'Жодне з цих місць не можна переглянути.',
        failed: (m) => `Пошук не вдався: ${m}`,
        removeFailed: (m) => `Нічого не вилучено: ${m}`
      },
      settings: {
        title: 'Шаблони непотрібних файлів',
        description: 'Що шукає пошук непотрібних файлів у Глибокому очищенні. Результати шаблонів із позначкою «Позначено за замовчуванням» одразу позначені, бо такі файли лише чернеткові або відтворюються самі; решту ви позначаєте самі. Програми, бібліотеки й desktop.ini ніколи не пропонуються, хоч би який був шаблон.',
        ariaLabel: 'Новий шаблон непотрібних файлів',
        formatHint: 'Ім’я файлу, де * — будь-які символи, а ? — один символ, наприклад *.tmp. Регістр літер не важливий.',
        empty: 'Шаблонів немає. Додайте шаблон або поверніть стандартні.',
        lookFor: (p) => `Шукати ${p}`,
        preselected: 'Позначено за замовчуванням',
        remove: (p) => `Видалити ${p}`,
        reset: 'Повернути стандартні',
        resetConfirm: "Замінити список стандартним? Додані вами шаблони буде вилучено.",
        error: {
          empty: 'Спершу введіть шаблон.',
          long: 'Цей шаблон задовгий.',
          separator: 'Шаблон — це ім’я файлу, а не папка чи шлях.',
          invalid: 'У ньому є символ, неприпустимий в імені файлу.',
          everything: 'Під нього підійшов би будь-який файл.',
          executable: 'Програми, бібліотеки, драйвери та інсталятори ніколи не бувають непотрібними файлами.',
          desktopIni: 'Під нього підійшов би desktop.ini, який задає папці значок і назву.',
          duplicate: 'Цей шаблон уже є в списку.',
          tooMany: 'Список заповнено.',
          failed: (m) => `Зміну не збережено: ${m}`
        }
      }
    }
  },
  vi: {
    junkFiles: {
      open: 'Tệp rác',
      title: 'Tệp rác',
      intro: 'Tìm theo tên các tệp tạm, bộ nhớ đệm và bản sao lưu còn sót lại trên các ổ đĩa và thư mục bạn chọn, dùng các mẫu trong Cài đặt › Dọn dẹp. Không có gì bị gỡ bỏ cho đến khi bạn đánh dấu và xác nhận.',
      where: 'Tìm ở đâu',
      folderPlaceholder: 'Thêm thư mục, ví dụ D:\\Downloads',
      folderAria: 'Thư mục cần tìm',
      addFolder: 'Thêm',
      foldersLabel: 'Các thư mục cần tìm',
      removeFolder: (path) => `Bỏ ${path}`,
      lookingFor: 'Đang tìm',
      editPatterns: 'Sửa mẫu',
      scan: 'Quét',
      scanAgain: 'Quét lại',
      noPlaces: 'Chọn một ổ đĩa hoặc thêm thư mục.',
      progress: (entries, found) => `Đã xem ${entries} mục · tìm thấy ${found}`,
      idle: 'Quét không gỡ bỏ gì. Các tệp hiện ở đây ngay khi được tìm thấy.',
      empty: 'Không tìm thấy tệp rác ở đó.',
      stoppedEmpty: 'Đã dừng trước khi tìm thấy gì.',
      found: (count, size) => `${count} tệp · ${size}`,
      stopped: 'Đã dừng: những tệp này được tìm thấy trước đó.',
      skipped: {
        lead: (n) => `Thêm ${n} tệp khớp được để nguyên:`,
        recent: (n, hours) => `${n} tệp thay đổi trong ${hours} giờ qua`,
        protected: (n) => `${n} tệp ở vị trí được bảo vệ`,
        excluded: (n) => `${n} tệp bị loại trừ trong Cài đặt`,
        executable: (n) => `${n} chương trình hoặc tệp hệ thống`,
        folders: (n) => `${n} thư mục được bảo vệ hoặc bị loại trừ không được xem: Windows, Program Files, thư mục riêng của chương trình đã cài và các mục loại trừ của bạn.`
      },
      truncated: 'Quá trình quét chạm giới hạn trước khi xong. Những gì tìm thấy là thật; có thể còn nữa.',
      truncatedMatches: 'Chỉ liệt kê 20.000 kết quả đầu tiên. Quét một thư mục nhỏ hơn để xem phần còn lại.',
      unreadable: (path) => `Windows không cho Prune xem bên trong ${path}.`,
      refusedRoot: {
        missing: (p) => `${p} không phải thư mục có tồn tại nên đã bị bỏ qua.`,
        relative: (p) => `${p} không phải đường dẫn đầy đủ nên đã bị bỏ qua.`,
        climb: (p) => `${p} dùng ".." nên đã bị bỏ qua.`,
        protected: (p) => `${p} là vị trí được bảo vệ và không bao giờ được tìm.`
      },
      group: {
        tickAll: (pattern) => `Đánh dấu mọi tệp ${pattern}`,
        showAll: (n) => `Hiện cả ${n}`,
        showFewer: 'Hiện ít hơn'
      },
      describe: {
        tmp: 'Tệp tạm',
        temp: 'Tệp tạm',
        tilde: 'Tệp chủ sở hữu của Office và các tệp ~ khác',
        tildeExt: 'Bản sao lưu của trình soạn thảo',
        chk: 'Mảnh chkdsk trong thư mục FOUND',
        old: 'Phiên bản cũ được để riêng',
        gid: 'Bộ đệm chỉ mục trợ giúp Windows',
        dmp: 'Tệp kết xuất sự cố',
        thumbs: 'Bộ đệm hình thu nhỏ cũ',
        bak: 'Bản sao lưu, thường được giữ có chủ ý',
        log: 'Tệp nhật ký'
      },
      openFolder: (name) => `Mở thư mục chứa ${name}`,
      selected: (n, size) => `Đã chọn ${n} · ${size}`,
      removeButton: { quarantine: 'Chuyển vào Khu cách ly', recycle: 'Chuyển vào Thùng rác', delete: 'Xóa' },
      confirm: {
        quarantine: (n, size) => `Chuyển ${n} tệp (${size}) vào Khu cách ly? Bạn có thể đưa chúng về từ Khu cách ly.`,
        recycle: (n, size) => `Chuyển ${n} tệp (${size}) vào Thùng rác? Bạn có thể đưa chúng về từ đó.`,
        delete: (n, size) => `Xóa vĩnh viễn ${n} tệp (${size})? Không thể hoàn tác.`
      },
      removing: 'Đang gỡ bỏ…',
      close: 'Đóng',
      toast: {
        removed: (n) => `Đã gỡ bỏ ${n} tệp rác.`,
        kept: (n) => `${n} tệp được để nguyên chỗ cũ.`,
        keptDetail: 'Chúng đang được dùng, đã thay đổi sau lần quét hoặc không còn được coi là rác theo cài đặt của bạn.'
      },
      errors: {
        noRoots: 'Chọn một ổ đĩa hoặc thêm thư mục.',
        noPatterns: 'Không có mẫu nào được bật. Hãy bật vài mẫu trong Cài đặt › Dọn dẹp.',
        noUsableRoots: 'Không thể tìm ở bất kỳ vị trí nào trong số đó.',
        failed: (m) => `Quét thất bại: ${m}`,
        removeFailed: (m) => `Không có gì bị gỡ bỏ: ${m}`
      },
      settings: {
        title: 'Mẫu tệp rác',
        description: 'Những gì tính năng quét Tệp rác của Dọn dẹp sâu tìm kiếm. Kết quả của các mẫu ghi Đánh dấu sẵn theo mặc định sẽ được đánh dấu ngay, vì các tệp đó chỉ là tệp tạm hoặc tự tạo lại; mọi thứ khác bạn tự đánh dấu. Chương trình, thư viện và desktop.ini không bao giờ được đề xuất, dù mẫu là gì.',
        ariaLabel: 'Mẫu tệp rác mới',
        formatHint: 'Tên tệp với * thay cho ký tự bất kỳ và ? thay cho một ký tự, như *.tmp. Chữ hoa hay thường đều như nhau.',
        empty: 'Chưa có mẫu. Thêm một mẫu hoặc khôi phục mặc định.',
        lookFor: (p) => `Tìm ${p}`,
        preselected: 'Đánh dấu sẵn theo mặc định',
        remove: (p) => `Gỡ ${p}`,
        reset: 'Khôi phục mặc định',
        resetConfirm: "Thay danh sách của bạn bằng mặc định? Các mẫu bạn đã thêm sẽ bị gỡ.",
        error: {
          empty: 'Hãy nhập một mẫu trước.',
          long: 'Mẫu đó quá dài.',
          separator: 'Mẫu là tên tệp, không phải thư mục hay đường dẫn.',
          invalid: 'Có ký tự mà tên tệp không thể chứa.',
          everything: 'Mẫu này sẽ khớp với mọi tệp.',
          executable: 'Chương trình, thư viện, trình điều khiển và trình cài đặt không bao giờ là rác.',
          desktopIni: 'Mẫu này sẽ khớp với desktop.ini, tệp tạo biểu tượng và tên cho thư mục.',
          duplicate: 'Mẫu đó đã có trong danh sách.',
          tooMany: 'Danh sách đã đầy.',
          failed: (m) => `Chưa lưu được thay đổi: ${m}`
        }
      }
    }
  },
  'zh-CN': {
    junkFiles: {
      open: '垃圾文件',
      title: '垃圾文件',
      intro: '按名称在你选择的驱动器和文件夹中查找残留的临时文件、缓存和备份，使用“设置 › 清理”中的模式。勾选并确认之前，不会移除任何内容。',
      where: '查找位置',
      folderPlaceholder: '添加文件夹，例如 D:\\Downloads',
      folderAria: '要查找的文件夹',
      addFolder: '添加',
      foldersLabel: '要查找的文件夹',
      removeFolder: (path) => `移除 ${path}`,
      lookingFor: '查找内容',
      editPatterns: '编辑模式',
      scan: '扫描',
      scanAgain: '重新扫描',
      noPlaces: '请选择驱动器或添加文件夹。',
      progress: (entries, found) => `已检查 ${entries} 项 · 找到 ${found} 个`,
      idle: '扫描不会移除任何内容。找到的文件会立即显示在这里。',
      empty: '那里没有找到垃圾文件。',
      stoppedEmpty: '在找到任何内容之前已停止。',
      found: (count, size) => `${count} 个文件 · ${size}`,
      stopped: '已停止：以下是在此之前找到的。',
      skipped: {
        lead: (n) => `另有 ${n} 个匹配的文件未被处理：`,
        recent: (n, hours) => `${n} 个在过去 ${hours} 小时内有更改`,
        protected: (n) => `${n} 个位于受保护的位置`,
        excluded: (n) => `${n} 个已在设置中排除`,
        executable: (n) => `${n} 个是程序或系统文件`,
        folders: (n) => `未检查 ${n} 个受保护或已排除的文件夹：Windows、Program Files、已安装程序自己的文件夹以及你的排除项。`
      },
      truncated: '扫描在完成前达到了上限。找到的结果是真实的，但可能还有更多。',
      truncatedMatches: '只列出前 20,000 个匹配项。扫描更小的文件夹以查看其余部分。',
      unreadable: (path) => `Windows 不允许 Prune 查看 ${path} 的内部。`,
      refusedRoot: {
        missing: (p) => `${p} 不是存在的文件夹，已跳过。`,
        relative: (p) => `${p} 不是完整路径，已跳过。`,
        climb: (p) => `${p} 使用了“..”，已跳过。`,
        protected: (p) => `${p} 是受保护的位置，从不查找。`
      },
      group: {
        tickAll: (pattern) => `勾选所有 ${pattern} 文件`,
        showAll: (n) => `显示全部 ${n} 个`,
        showFewer: '显示更少'
      },
      describe: {
        tmp: '临时文件',
        temp: '临时文件',
        tilde: 'Office 所有者文件及其他 ~ 文件',
        tildeExt: '编辑器的备份副本',
        chk: 'FOUND 文件夹中的 chkdsk 碎片',
        old: '被搁置的旧版本',
        gid: 'Windows 帮助的索引缓存',
        dmp: '崩溃转储',
        thumbs: '旧的缩略图缓存',
        bak: '备份，常常是有意保留的',
        log: '日志文件'
      },
      openFolder: (name) => `打开包含 ${name} 的文件夹`,
      selected: (n, size) => `已选 ${n} 个 · ${size}`,
      removeButton: { quarantine: '移至隔离区', recycle: '移至回收站', delete: '删除' },
      confirm: {
        quarantine: (n, size) => `将 ${n} 个文件（${size}）移至隔离区？可以从隔离区恢复。`,
        recycle: (n, size) => `将 ${n} 个文件（${size}）移至回收站？可以从那里恢复。`,
        delete: (n, size) => `永久删除 ${n} 个文件（${size}）？此操作无法撤销。`
      },
      removing: '正在移除…',
      close: '关闭',
      toast: {
        removed: (n) => `已移除 ${n} 个垃圾文件。`,
        kept: (n) => `${n} 个文件留在原处。`,
        keptDetail: '它们正在使用、扫描后有更改，或按你的设置已不再算作垃圾。'
      },
      errors: {
        noRoots: '请选择驱动器或添加文件夹。',
        noPatterns: '没有启用任何模式。请在“设置 › 清理”中启用一些。',
        noUsableRoots: '这些位置都无法查找。',
        failed: (m) => `扫描失败：${m}`,
        removeFailed: (m) => `未移除任何内容：${m}`
      },
      settings: {
        title: '垃圾文件模式',
        description: '深度清理的“垃圾文件”扫描要查找的内容。标为“默认勾选”的模式，其结果一开始就会勾选，因为这些文件只是临时文件或会自动重建；其余的由你自己勾选。无论模式如何，都不会提供程序、库和 desktop.ini。',
        ariaLabel: '新的垃圾文件模式',
        formatHint: '文件名中 * 表示任意字符，? 表示一个字符，例如 *.tmp。不区分大小写。',
        empty: '没有模式。添加一个，或恢复默认值。',
        lookFor: (p) => `查找 ${p}`,
        preselected: '默认勾选',
        remove: (p) => `移除 ${p}`,
        reset: '恢复默认值',
        resetConfirm: "用默认值替换你的列表？你添加的模式将被移除。",
        error: {
          empty: '请先输入模式。',
          long: '该模式太长。',
          separator: '模式是文件名，不是文件夹或路径。',
          invalid: '包含文件名中不能使用的字符。',
          everything: '这会匹配所有文件。',
          executable: '程序、库、驱动程序和安装程序永远不是垃圾。',
          desktopIni: '这会匹配 desktop.ini，它决定文件夹的图标和名称。',
          duplicate: '该模式已在列表中。',
          tooMany: '列表已满。',
          failed: (m) => `更改未保存：${m}`
        }
      }
    }
  },
  'zh-TW': {
    junkFiles: {
      open: '垃圾檔案',
      title: '垃圾檔案',
      intro: '依名稱在你選擇的磁碟機和資料夾中尋找殘留的暫存檔、快取和備份，使用「設定 › 清理」中的模式。在你勾選並確認之前，不會移除任何東西。',
      where: '尋找位置',
      folderPlaceholder: '新增資料夾，例如 D:\\Downloads',
      folderAria: '要尋找的資料夾',
      addFolder: '新增',
      foldersLabel: '要尋找的資料夾',
      removeFolder: (path) => `移除 ${path}`,
      lookingFor: '尋找內容',
      editPatterns: '編輯模式',
      scan: '掃描',
      scanAgain: '重新掃描',
      noPlaces: '請選擇磁碟機或新增資料夾。',
      progress: (entries, found) => `已檢查 ${entries} 個項目 · 找到 ${found} 個`,
      idle: '掃描不會移除任何東西。找到的檔案會立即顯示在這裡。',
      empty: '那裡沒有找到垃圾檔案。',
      stoppedEmpty: '在找到任何東西之前已停止。',
      found: (count, size) => `${count} 個檔案 · ${size}`,
      stopped: '已停止：以下是在此之前找到的。',
      skipped: {
        lead: (n) => `另有 ${n} 個相符的檔案維持不動：`,
        recent: (n, hours) => `${n} 個在過去 ${hours} 小時內有變更`,
        protected: (n) => `${n} 個位於受保護的位置`,
        excluded: (n) => `${n} 個已在設定中排除`,
        executable: (n) => `${n} 個是程式或系統檔案`,
        folders: (n) => `未檢查 ${n} 個受保護或已排除的資料夾：Windows、Program Files、已安裝程式自己的資料夾，以及你的排除項目。`
      },
      truncated: '掃描在完成前達到上限。找到的結果是真的，但可能還有更多。',
      truncatedMatches: '只列出前 20,000 個相符項目。掃描較小的資料夾以查看其餘部分。',
      unreadable: (path) => `Windows 不允許 Prune 查看 ${path} 的內部。`,
      refusedRoot: {
        missing: (p) => `${p} 不是存在的資料夾，已略過。`,
        relative: (p) => `${p} 不是完整路徑，已略過。`,
        climb: (p) => `${p} 使用了「..」，已略過。`,
        protected: (p) => `${p} 是受保護的位置，從不尋找。`
      },
      group: {
        tickAll: (pattern) => `勾選所有 ${pattern} 檔案`,
        showAll: (n) => `顯示全部 ${n} 個`,
        showFewer: '顯示較少'
      },
      describe: {
        tmp: '暫存檔',
        temp: '暫存檔',
        tilde: 'Office 擁有者檔案及其他 ~ 檔案',
        tildeExt: '編輯器的備份複本',
        chk: 'FOUND 資料夾中的 chkdsk 片段',
        old: '擱置的舊版本',
        gid: 'Windows 說明的索引快取',
        dmp: '當機傾印',
        thumbs: '舊的縮圖快取',
        bak: '備份，常是刻意保留的',
        log: '記錄檔'
      },
      openFolder: (name) => `開啟含有 ${name} 的資料夾`,
      selected: (n, size) => `已選 ${n} 個 · ${size}`,
      removeButton: { quarantine: '移至隔離區', recycle: '移至資源回收筒', delete: '刪除' },
      confirm: {
        quarantine: (n, size) => `將 ${n} 個檔案（${size}）移至隔離區？可以從隔離區還原。`,
        recycle: (n, size) => `將 ${n} 個檔案（${size}）移至資源回收筒？可以從那裡還原。`,
        delete: (n, size) => `永久刪除 ${n} 個檔案（${size}）？此動作無法復原。`
      },
      removing: '正在移除…',
      close: '關閉',
      toast: {
        removed: (n) => `已移除 ${n} 個垃圾檔案。`,
        kept: (n) => `${n} 個檔案留在原處。`,
        keptDetail: '它們正在使用、掃描後有變更，或依你的設定已不再算是垃圾。'
      },
      errors: {
        noRoots: '請選擇磁碟機或新增資料夾。',
        noPatterns: '沒有啟用任何模式。請在「設定 › 清理」中啟用一些。',
        noUsableRoots: '這些位置都無法尋找。',
        failed: (m) => `掃描失敗：${m}`,
        removeFailed: (m) => `未移除任何東西：${m}`
      },
      settings: {
        title: '垃圾檔案模式',
        description: '深度清理的「垃圾檔案」掃描要尋找的內容。標示為「預設勾選」的模式，其結果一開始就會勾選，因為這些檔案只是暫存檔或會自行重建；其餘由你自己勾選。無論模式為何，都不會提供程式、程式庫和 desktop.ini。',
        ariaLabel: '新的垃圾檔案模式',
        formatHint: '檔名中 * 代表任意字元，? 代表一個字元，例如 *.tmp。不分大小寫。',
        empty: '沒有模式。新增一個，或還原預設值。',
        lookFor: (p) => `尋找 ${p}`,
        preselected: '預設勾選',
        remove: (p) => `移除 ${p}`,
        reset: '還原預設值',
        resetConfirm: "以預設值取代你的清單？你新增的模式將被移除。",
        error: {
          empty: '請先輸入模式。',
          long: '這個模式太長。',
          separator: '模式是檔名，不是資料夾或路徑。',
          invalid: '包含檔名中不能使用的字元。',
          everything: '這會符合所有檔案。',
          executable: '程式、程式庫、驅動程式和安裝程式永遠不是垃圾。',
          desktopIni: '這會符合 desktop.ini，它決定資料夾的圖示和名稱。',
          duplicate: '這個模式已在清單中。',
          tooMany: '清單已滿。',
          failed: (m) => `變更未儲存：${m}`
        }
      }
    }
  }
};
