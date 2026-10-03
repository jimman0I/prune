// Disk Map v3 UI text (drive picker, administrator scan, sizes, search, export,
// saved scans), all 40 languages: { en: { ... }, af: { ... }, ... }.
// Merged into the catalog by ../catalog.js; every key lives under diskMapV3.
export default {
  en: {
    diskMapV3: {
      large: {
        tooLarge: "The drive has more files than Prune could hold in one scan. Use “undefined” to scan it a folder at a time, or exclude large folders in Settings.",
        foldedNote: (a, b) => `Each folder lists its ${a} largest files; the other ${b} files are summed into one row per folder. They still count toward every total and the file-type figures.`,
        foldedFloorNote: (a, b) => `This drive has so many files that only files of ${b} or larger are listed individually; the other ${a} files are summed into one row per folder. They still count toward every total and the file-type figures.`
      },
      drives: {
        label: "Drives",
        system: "System",
        removable: "Removable",
        usage: (a, b) => `${a} of ${b} used`,
        scanned: "Scanned",
        alsoScan: "Also scan these drives",
        alsoScanNote: "Drives scanned together share one administrator prompt.",
        notNtfs: "Only NTFS drives can be fast scanned.",
        failed: (a, b) => `Could not scan ${a}: ${b}`
      },
      elevation: {
        runningAsAdmin: "Prune is running as administrator, so this scan starts without a prompt.",
        why: "Windows only lets administrators read a drive’s file index directly, which is what makes this scan fast.",
        restartHint: "Restart Prune as administrator once and later fast scans need no prompt.",
        restartButton: "Restart Prune as administrator",
        restarting: "Restarting…",
        restartDeclined: "Not approved — Prune is still running as before.",
        restartFailed: (a) => `Could not restart as administrator: ${a}`
      },
      columns: {
        allocated: "Allocated",
        name: "Name"
      },
      totals: {
        line: (a, b, c) => `${a} counted · ${b} on disk · ${c} in use on the volume`,
        lineNoVolume: (a, b) => `${a} counted · ${b} on disk`,
        hardLinkNote: (a) => `${a} files with several names are counted once.`
      },
      filesView: {
        sortBy: "Sort by"
      },
      search: {
        label: "Search names",
        placeholder: "Text, * ? or /regex/",
        clear: "Clear search",
        invalid: "That pattern is not valid.",
        noMatches: (a) => `Nothing here matches "${a}".`
      },
      export: {
        csv: "Export CSV",
        png: "Save map as PNG",
        failed: (a) => `Could not export: ${a}`,
        done: (a) => `Exported ${a}`
      },
      menu: {
        properties: "Properties",
        exclude: "Exclude this folder"
      },
      props: {
        path: "Path",
        type: "Type",
        close: "Close"
      },
      toasts: {
        excluded: (a) => `${a} will be skipped by future scans.`,
        alreadyExcluded: (a) => `${a} is already excluded.`,
        excludeFailed: "Could not save that exclusion."
      },
      saved: {
        title: "Saved scans",
        nameField: "Name for this scan",
        save: "Save current scan",
        saving: "Saving…",
        saved: (a) => `Saved scan "${a}".`,
        nothingToSave: "Scan a drive first, then you can save it here.",
        empty: "No saved scans yet.",
        load: "Open",
        delete: "Delete",
        deleteConfirm: (a) => `Delete "${a}" for good?`,
        selectForCompare: (a) => `Select ${a} to compare`,
        compare: "Compare selected",
        pickTwo: "Pick two scans to compare.",
        partial: "Partial",
        viewing: (a, b) => `Viewing the saved scan "${a}" from ${b}. This is not your drive as it is now.`,
        closeView: "Back to the live scan",
        failed: (a) => `Saved scans: ${a}`
      },
      compare: {
        title: (a, b) => `From "${a}" to "${b}"`,
        total: (a) => `Total change: ${a}`,
        grew: "Grew the most",
        shrank: "Shrank the most",
        added: "New folders",
        removed: "Removed folders",
        none: "Nothing in this group.",
        back: "Back to the list",
        loading: "Comparing…"
      },
      crawl: {
        note: "Reads every folder, one at a time. A whole drive takes a while: results appear as they are found, and you can stop at any time and keep what was read.",
        limit: "Needs no permission. A whole drive takes much longer than the fast scan, but you see results as they arrive and can stop whenever you like.",
        partialNote: "Showing what has been read so far. Sizes keep growing until the scan finishes."
      }
    }
  },
  af: {
    diskMapV3: {
      large: {
        tooLarge: "Die skyf het meer lêers as wat Prune in een skandering kan hou. Gebruik “undefined” om dit een vouer op ’n slag te skandeer, of sluit groot vouers in Instellings uit.",
        foldedNote: (a, b) => `Elke vouer wys sy ${a} grootste lêers; die ander ${b} lêers word in een ry per vouer opgetel. Hulle tel steeds in elke totaal en in die lêertipe-syfers.`,
        foldedFloorNote: (a, b) => `Hierdie skyf het soveel lêers dat net lêers van ${b} of groter individueel gelys word; die ander ${a} lêers word in een ry per vouer opgetel. Hulle tel steeds in elke totaal en in die lêertipe-syfers.`
      },
      drives: {
        label: "Skywe",
        system: "Stelsel",
        removable: "Verwyderbaar",
        usage: (a, b) => `${a} van ${b} gebruik`,
        scanned: "Geskandeer",
        alsoScan: "Skandeer ook hierdie skywe",
        alsoScanNote: "Skywe wat saam geskandeer word, deel een administrateur-prompt.",
        notNtfs: "Slegs NTFS-skywe kan vinnig geskandeer word.",
        failed: (a, b) => `Kon nie ${a} skandeer nie: ${b}`
      },
      elevation: {
        runningAsAdmin: "Prune loop as administrateur, so hierdie skandering begin sonder ’n prompt.",
        why: "Windows laat slegs administrateurs toe om ’n skyf se lêerindeks direk te lees, en dit maak hierdie skandering vinnig.",
        restartHint: "Herbegin Prune een keer as administrateur, dan het latere vinnige skanderings nie ’n prompt nodig nie.",
        restartButton: "Herbegin Prune as administrateur",
        restarting: "Herbegin tans…",
        restartDeclined: "Nie goedgekeur nie — Prune loop steeds soos voorheen.",
        restartFailed: (a) => `Kon nie as administrateur herbegin nie: ${a}`
      },
      columns: {
        allocated: "Toegewys",
        name: "Naam"
      },
      totals: {
        line: (a, b, c) => `${a} getel · ${b} op skyf · ${c} in gebruik op die volume`,
        lineNoVolume: (a, b) => `${a} getel · ${b} op skyf`,
        hardLinkNote: (a) => `${a} lêers met verskeie name word een keer getel.`
      },
      filesView: {
        sortBy: "Sorteer volgens"
      },
      search: {
        label: "Soek name",
        placeholder: "Teks, * ? of /regex/",
        clear: "Maak soektog skoon",
        invalid: "Daardie patroon is nie geldig nie.",
        noMatches: (a) => `Niks hier pas by "${a}" nie.`
      },
      export: {
        csv: "Voer CSV uit",
        png: "Stoor kaart as PNG",
        failed: (a) => `Kon nie uitvoer nie: ${a}`,
        done: (a) => `Uitgevoer: ${a}`
      },
      menu: {
        properties: "Eienskappe",
        exclude: "Sluit hierdie vouer uit"
      },
      props: {
        path: "Pad",
        type: "Tipe",
        close: "Maak toe"
      },
      toasts: {
        excluded: (a) => `${a} word deur toekomstige skanderings oorgeslaan.`,
        alreadyExcluded: (a) => `${a} is reeds uitgesluit.`,
        excludeFailed: "Kon nie daardie uitsluiting stoor nie."
      },
      saved: {
        title: "Gestoorde skanderings",
        nameField: "Naam vir hierdie skandering",
        save: "Stoor huidige skandering",
        saving: "Stoor tans…",
        saved: (a) => `Skandering "${a}" gestoor.`,
        nothingToSave: "Skandeer eers ’n skyf, dan kan jy dit hier stoor.",
        empty: "Nog geen gestoorde skanderings nie.",
        load: "Maak oop",
        delete: "Verwyder",
        deleteConfirm: (a) => `Vee "${a}" vir goed uit?`,
        selectForCompare: (a) => `Kies ${a} om te vergelyk`,
        compare: "Vergelyk gekose",
        pickTwo: "Kies twee skanderings om te vergelyk.",
        partial: "Gedeeltelik",
        viewing: (a, b) => `Jy kyk na die gestoorde skandering "${a}" van ${b}. Dit is nie jou skyf soos dit nou is nie.`,
        closeView: "Terug na die lewendige skandering",
        failed: (a) => `Gestoorde skanderings: ${a}`
      },
      compare: {
        title: (a, b) => `Van "${a}" na "${b}"`,
        total: (a) => `Totale verandering: ${a}`,
        grew: "Die meeste gegroei",
        shrank: "Die meeste gekrimp",
        added: "Nuwe vouers",
        removed: "Verwyderde vouers",
        none: "Niks in hierdie groep nie.",
        back: "Terug na die lys",
        loading: "Vergelyk tans…"
      },
      crawl: {
        note: "Lees elke vouer, een op ’n slag. ’n Hele skyf neem ’n rukkie: resultate verskyn soos hulle gevind word, en jy kan enige tyd stop en behou wat gelees is.",
        limit: "Geen toestemming nodig nie. ’n Hele skyf neem baie langer as die vinnige skandering, maar jy sien resultate soos hulle aankom en kan enige tyd stop.",
        partialNote: "Wys wat tot dusver gelees is. Groottes bly groei totdat die skandering klaar is."
      }
    }
  },
  ar: {
    diskMapV3: {
      large: {
        tooLarge: "يحتوي هذا القرص على ملفات أكثر مما يستطيع Prune استيعابه في فحص واحد. استخدم “undefined” لفحصه مجلداً تلو الآخر، أو استبعد المجلدات الكبيرة من الإعدادات.",
        foldedNote: (a, b) => `يعرض كل مجلد أكبر ${a} ملف فيه؛ أما الملفات الأخرى وعددها ${b} فتُجمع في صف واحد لكل مجلد. وتبقى محسوبة في كل إجمالي وفي أرقام أنواع الملفات.`,
        foldedFloorNote: (a, b) => `يحتوي هذا القرص على عدد كبير من الملفات بحيث لا تُعرض فرادى إلا الملفات بحجم ${b} أو أكبر؛ أما الملفات الأخرى وعددها ${a} فتُجمع في صف واحد لكل مجلد. وتبقى محسوبة في كل إجمالي وفي أرقام أنواع الملفات.`
      },
      drives: {
        label: "محركات الأقراص",
        system: "النظام",
        removable: "قابل للإزالة",
        usage: (a, b) => `تم استخدام ${a} من ${b}`,
        scanned: "تم فحصه",
        alsoScan: "افحص هذه المحركات أيضًا",
        alsoScanNote: "المحركات التي تُفحص معًا تشترك في مطالبة مسؤول واحدة.",
        notNtfs: "لا يمكن إجراء الفحص السريع إلا على محركات NTFS.",
        failed: (a, b) => `تعذّر فحص ${a}: ${b}`
      },
      elevation: {
        runningAsAdmin: "يعمل Prune كمسؤول، لذا يبدأ هذا الفحص دون مطالبة.",
        why: "لا يسمح Windows بقراءة فهرس ملفات المحرك مباشرةً إلا للمسؤولين، وهذا ما يجعل هذا الفحص سريعًا.",
        restartHint: "أعد تشغيل Prune كمسؤول مرة واحدة ولن تحتاج عمليات الفحص السريع اللاحقة إلى مطالبة.",
        restartButton: "إعادة تشغيل Prune كمسؤول",
        restarting: "جارٍ إعادة التشغيل…",
        restartDeclined: "لم تتم الموافقة — ما زال Prune يعمل كما كان.",
        restartFailed: (a) => `تعذّرت إعادة التشغيل كمسؤول: ${a}`
      },
      columns: {
        allocated: "المخصص",
        name: "الاسم"
      },
      totals: {
        line: (a, b, c) => `تم احتساب ${a} · ${b} على القرص · ${c} قيد الاستخدام على وحدة التخزين`,
        lineNoVolume: (a, b) => `تم احتساب ${a} · ${b} على القرص`,
        hardLinkNote: (a) => `يُحتسب ${a} من الملفات ذات الأسماء المتعددة مرة واحدة فقط.`
      },
      filesView: {
        sortBy: "ترتيب حسب"
      },
      search: {
        label: "البحث في الأسماء",
        placeholder: "نص أو * ? أو /regex/",
        clear: "مسح البحث",
        invalid: "هذا النمط غير صالح.",
        noMatches: (a) => `لا شيء هنا يطابق "${a}".`
      },
      export: {
        csv: "تصدير CSV",
        png: "حفظ الخريطة كصورة PNG",
        failed: (a) => `تعذّر التصدير: ${a}`,
        done: (a) => `تم التصدير: ${a}`
      },
      menu: {
        properties: "خصائص",
        exclude: "استبعاد هذا المجلد"
      },
      props: {
        path: "المسار",
        type: "النوع",
        close: "إغلاق"
      },
      toasts: {
        excluded: (a) => `سيتم تخطي ${a} في عمليات الفحص القادمة.`,
        alreadyExcluded: (a) => `${a} مستبعد بالفعل.`,
        excludeFailed: "تعذّر حفظ هذا الاستبعاد."
      },
      saved: {
        title: "عمليات الفحص المحفوظة",
        nameField: "اسم لهذا الفحص",
        save: "حفظ الفحص الحالي",
        saving: "جارٍ الحفظ…",
        saved: (a) => `تم حفظ الفحص "${a}".`,
        nothingToSave: "افحص محركًا أولًا، ثم يمكنك حفظه هنا.",
        empty: "لا توجد عمليات فحص محفوظة بعد.",
        load: "فتح",
        delete: "حذف",
        deleteConfirm: (a) => `حذف "${a}" نهائيًا؟`,
        selectForCompare: (a) => `تحديد ${a} للمقارنة`,
        compare: "مقارنة المحدد",
        pickTwo: "اختر فحصين للمقارنة.",
        partial: "جزئي",
        viewing: (a, b) => `تعرض الفحص المحفوظ "${a}" من ${b}. هذا ليس محركك كما هو الآن.`,
        closeView: "العودة إلى الفحص المباشر",
        failed: (a) => `عمليات الفحص المحفوظة: ${a}`
      },
      compare: {
        title: (a, b) => `من "${a}" إلى "${b}"`,
        total: (a) => `إجمالي التغيير: ${a}`,
        grew: "الأكثر نموًا",
        shrank: "الأكثر تقلصًا",
        added: "مجلدات جديدة",
        removed: "مجلدات محذوفة",
        none: "لا شيء في هذه المجموعة.",
        back: "العودة إلى القائمة",
        loading: "جارٍ المقارنة…"
      },
      crawl: {
        note: "يقرأ كل مجلد على حدة. يستغرق محرك كامل بعض الوقت: تظهر النتائج فور العثور عليها، ويمكنك الإيقاف في أي وقت مع الاحتفاظ بما تمت قراءته.",
        limit: "لا يحتاج إلى إذن. يستغرق محرك كامل وقتًا أطول بكثير من الفحص السريع، لكنك ترى النتائج فور وصولها ويمكنك الإيقاف متى شئت.",
        partialNote: "يعرض ما تمت قراءته حتى الآن. تستمر الأحجام في الازدياد حتى ينتهي الفحص."
      }
    }
  },
  ca: {
    diskMapV3: {
      large: {
        tooLarge: "La unitat té més fitxers dels que Prune pot gestionar en una sola exploració. Feu servir “undefined” per explorar-la carpeta a carpeta, o exclogueu carpetes grans a Configuració.",
        foldedNote: (a, b) => `Cada carpeta mostra els seus ${a} fitxers més grans; els altres ${b} fitxers se sumen en una sola fila per carpeta. Continuen comptant en tots els totals i en les xifres per tipus de fitxer.`,
        foldedFloorNote: (a, b) => `Aquesta unitat té tants fitxers que només es llisten un a un els de ${b} o més; els altres ${a} fitxers se sumen en una sola fila per carpeta. Continuen comptant en tots els totals i en les xifres per tipus de fitxer.`
      },
      drives: {
        label: "Unitats",
        system: "Sistema",
        removable: "Extraïble",
        usage: (a, b) => `${a} de ${b} en ús`,
        scanned: "Escanejat",
        alsoScan: "Escaneja també aquestes unitats",
        alsoScanNote: "Les unitats que s’escanegen juntes comparteixen una sola sol·licitud d’administrador.",
        notNtfs: "Només les unitats NTFS es poden escanejar ràpidament.",
        failed: (a, b) => `No s’ha pogut escanejar ${a}: ${b}`
      },
      elevation: {
        runningAsAdmin: "Prune s’executa com a administrador, de manera que aquest escaneig comença sense cap sol·licitud.",
        why: "Windows només permet als administradors llegir directament l’índex de fitxers d’una unitat, i això és el que fa ràpid aquest escaneig.",
        restartHint: "Reinicia Prune com a administrador una vegada i els escanejos ràpids següents no necessitaran cap sol·licitud.",
        restartButton: "Reinicia Prune com a administrador",
        restarting: "Reiniciant…",
        restartDeclined: "No aprovat — Prune continua executant-se com abans.",
        restartFailed: (a) => `No s’ha pogut reiniciar com a administrador: ${a}`
      },
      columns: {
        allocated: "Assignat",
        name: "Nom"
      },
      totals: {
        line: (a, b, c) => `${a} comptats · ${b} al disc · ${c} en ús al volum`,
        lineNoVolume: (a, b) => `${a} comptats · ${b} al disc`,
        hardLinkNote: (a) => `${a} fitxers amb diversos noms es compten una sola vegada.`
      },
      filesView: {
        sortBy: "Ordena per"
      },
      search: {
        label: "Cerca noms",
        placeholder: "Text, * ? o /regex/",
        clear: "Esborra la cerca",
        invalid: "Aquest patró no és vàlid.",
        noMatches: (a) => `Res d’aquí coincideix amb "${a}".`
      },
      export: {
        csv: "Exporta a CSV",
        png: "Desa el mapa com a PNG",
        failed: (a) => `No s’ha pogut exportar: ${a}`,
        done: (a) => `Exportat: ${a}`
      },
      menu: {
        properties: "Propietats",
        exclude: "Exclou aquesta carpeta"
      },
      props: {
        path: "Camí",
        type: "Tipus",
        close: "Tanca"
      },
      toasts: {
        excluded: (a) => `${a} s’ometrà en els escanejos futurs.`,
        alreadyExcluded: (a) => `${a} ja està exclòs.`,
        excludeFailed: "No s’ha pogut desar aquesta exclusió."
      },
      saved: {
        title: "Escanejos desats",
        nameField: "Nom d’aquest escaneig",
        save: "Desa l’escaneig actual",
        saving: "Desant…",
        saved: (a) => `S’ha desat l’escaneig "${a}".`,
        nothingToSave: "Escaneja primer una unitat i després podràs desar-la aquí.",
        empty: "Encara no hi ha escanejos desats.",
        load: "Obre",
        delete: "Suprimeix",
        deleteConfirm: (a) => `Voleu suprimir "${a}" definitivament?`,
        selectForCompare: (a) => `Selecciona ${a} per comparar`,
        compare: "Compara la selecció",
        pickTwo: "Tria dos escanejos per comparar.",
        partial: "Parcial",
        viewing: (a, b) => `Esteu veient l’escaneig desat "${a}" del ${b}. Això no és la unitat tal com és ara.`,
        closeView: "Torna a l’escaneig en directe",
        failed: (a) => `Escanejos desats: ${a}`
      },
      compare: {
        title: (a, b) => `De "${a}" a "${b}"`,
        total: (a) => `Canvi total: ${a}`,
        grew: "Han crescut més",
        shrank: "Han minvat més",
        added: "Carpetes noves",
        removed: "Carpetes eliminades",
        none: "Res en aquest grup.",
        back: "Torna a la llista",
        loading: "Comparant…"
      },
      crawl: {
        note: "Llegeix cada carpeta, una per una. Una unitat sencera triga una estona: els resultats apareixen a mesura que es troben i pots aturar-ho en qualsevol moment i conservar el que s’ha llegit.",
        limit: "No cal cap permís. Una unitat sencera triga molt més que l’escaneig ràpid, però veus els resultats a mesura que arriben i pots aturar-ho quan vulguis.",
        partialNote: "Es mostra el que s’ha llegit fins ara. Les mides continuen creixent fins que acaba l’escaneig."
      }
    }
  },
  cs: {
    diskMapV3: {
      large: {
        tooLarge: "Jednotka obsahuje více souborů, než kolik Prune dokáže zpracovat v jednom skenování. Použijte „undefined“ a skenujte ji složku po složce, nebo v Nastavení vyloučte velké složky.",
        foldedNote: (a, b) => `Každá složka uvádí svých ${a} největších souborů; ostatních ${b} souborů je sečteno do jednoho řádku na složku. Do všech součtů a přehledů podle typu souboru se stále počítají.`,
        foldedFloorNote: (a, b) => `Tato jednotka má tolik souborů, že se jednotlivě uvádějí jen soubory o velikosti ${b} a větší; ostatních ${a} souborů je sečteno do jednoho řádku na složku. Do všech součtů a přehledů podle typu souboru se stále počítají.`
      },
      drives: {
        label: "Disky",
        system: "Systémový",
        removable: "Vyměnitelný",
        usage: (a, b) => `Využito ${a} z ${b}`,
        scanned: "Naskenováno",
        alsoScan: "Skenovat také tyto disky",
        alsoScanNote: "Disky skenované společně sdílejí jedno potvrzení správce.",
        notNtfs: "Rychle skenovat lze pouze disky NTFS.",
        failed: (a, b) => `Disk ${a} se nepodařilo naskenovat: ${b}`
      },
      elevation: {
        runningAsAdmin: "Prune běží jako správce, takže toto skenování začne bez potvrzení.",
        why: "Windows dovoluje přímo číst index souborů disku jen správcům, a právě to dělá toto skenování rychlým.",
        restartHint: "Jednou restartujte Prune jako správce a další rychlá skenování už potvrzení nebudou potřebovat.",
        restartButton: "Restartovat Prune jako správce",
        restarting: "Restartuje se…",
        restartDeclined: "Nepotvrzeno — Prune běží dál jako dřív.",
        restartFailed: (a) => `Restart jako správce se nezdařil: ${a}`
      },
      columns: {
        allocated: "Přidělené",
        name: "Název"
      },
      totals: {
        line: (a, b, c) => `${a} započítáno · ${b} na disku · ${c} využito na svazku`,
        lineNoVolume: (a, b) => `${a} započítáno · ${b} na disku`,
        hardLinkNote: (a) => `${a} souborů s více názvy se počítá jen jednou.`
      },
      filesView: {
        sortBy: "Seřadit podle"
      },
      search: {
        label: "Hledat názvy",
        placeholder: "Text, * ? nebo /regex/",
        clear: "Vymazat hledání",
        invalid: "Tento vzor není platný.",
        noMatches: (a) => `Nic zde neodpovídá výrazu "${a}".`
      },
      export: {
        csv: "Exportovat CSV",
        png: "Uložit mapu jako PNG",
        failed: (a) => `Export se nezdařil: ${a}`,
        done: (a) => `Exportováno: ${a}`
      },
      menu: {
        properties: "Vlastnosti",
        exclude: "Vyloučit tuto složku"
      },
      props: {
        path: "Cesta",
        type: "Typ",
        close: "Zavřít"
      },
      toasts: {
        excluded: (a) => `${a} budou budoucí skeny přeskakovat.`,
        alreadyExcluded: (a) => `${a} už je vyloučeno.`,
        excludeFailed: "Toto vyloučení se nepodařilo uložit."
      },
      saved: {
        title: "Uložená skenování",
        nameField: "Název tohoto skenování",
        save: "Uložit aktuální skenování",
        saving: "Ukládá se…",
        saved: (a) => `Skenování "${a}" bylo uloženo.`,
        nothingToSave: "Nejprve naskenujte disk, pak ho zde můžete uložit.",
        empty: "Zatím žádná uložená skenování.",
        load: "Otevřít",
        delete: "Odstranit",
        deleteConfirm: (a) => `Odstranit "${a}" natrvalo?`,
        selectForCompare: (a) => `Vybrat ${a} k porovnání`,
        compare: "Porovnat vybrané",
        pickTwo: "Vyberte dvě skenování k porovnání.",
        partial: "Částečné",
        viewing: (a, b) => `Prohlížíte uložené skenování "${a}" z ${b}. Nejde o aktuální stav disku.`,
        closeView: "Zpět k aktuálnímu skenování",
        failed: (a) => `Uložená skenování: ${a}`
      },
      compare: {
        title: (a, b) => `Od "${a}" k "${b}"`,
        total: (a) => `Celková změna: ${a}`,
        grew: "Nejvíce vzrostlo",
        shrank: "Nejvíce kleslo",
        added: "Nové složky",
        removed: "Odstraněné složky",
        none: "V této skupině nic není.",
        back: "Zpět na seznam",
        loading: "Porovnává se…"
      },
      crawl: {
        note: "Čte každou složku postupně. Celý disk chvíli trvá: výsledky se objevují průběžně a kdykoli můžete skenování zastavit a ponechat si, co se přečetlo.",
        limit: "Nevyžaduje oprávnění. Celý disk trvá mnohem déle než rychlé skenování, ale výsledky vidíte průběžně a můžete kdykoli zastavit.",
        partialNote: "Zobrazuje se, co se zatím přečetlo. Velikosti rostou, dokud skenování neskončí."
      }
    }
  },
  cy: {
    diskMapV3: {
      large: {
        tooLarge: "Mae mwy o ffeiliau ar y gyriant nag y gall Prune eu dal mewn un sgan. Defnyddiwch “undefined” i'w sganio un ffolder ar y tro, neu eithriwch ffolderi mawr yn y Gosodiadau.",
        foldedNote: (a, b) => `Mae pob ffolder yn rhestru ei ${a} ffeil fwyaf; mae'r ${b} ffeil arall wedi'u cyfuno'n un rhes ar gyfer pob ffolder. Maen nhw'n dal i gyfrif ym mhob cyfanswm ac yn y ffigurau math o ffeil.`,
        foldedFloorNote: (a, b) => `Mae cymaint o ffeiliau ar y gyriant hwn fel mai dim ond ffeiliau o ${b} neu fwy sy'n cael eu rhestru'n unigol; mae'r ${a} ffeil arall wedi'u cyfuno'n un rhes ar gyfer pob ffolder. Maen nhw'n dal i gyfrif ym mhob cyfanswm ac yn y ffigurau math o ffeil.`
      },
      drives: {
        label: "Gyriannau",
        system: "System",
        removable: "Symudadwy",
        usage: (a, b) => `${a} o ${b} wedi’u defnyddio`,
        scanned: "Wedi’i sganio",
        alsoScan: "Sganio’r gyriannau hyn hefyd",
        alsoScanNote: "Mae gyriannau a sganir gyda’i gilydd yn rhannu un anogwr gweinyddwr.",
        notNtfs: "Dim ond gyriannau NTFS y gellir eu sganio’n gyflym.",
        failed: (a, b) => `Methwyd sganio ${a}: ${b}`
      },
      elevation: {
        runningAsAdmin: "Mae Prune yn rhedeg fel gweinyddwr, felly mae’r sgan hwn yn dechrau heb anogwr.",
        why: "Dim ond gweinyddwyr y mae Windows yn caniatáu iddynt ddarllen mynegai ffeiliau gyriant yn uniongyrchol, a dyna sy’n gwneud y sgan hwn yn gyflym.",
        restartHint: "Ailgychwynnwch Prune fel gweinyddwr unwaith ac ni fydd angen anogwr ar sganiau cyflym diweddarach.",
        restartButton: "Ailgychwyn Prune fel gweinyddwr",
        restarting: "Yn ailgychwyn…",
        restartDeclined: "Heb ei gymeradwyo — mae Prune yn dal i redeg fel o’r blaen.",
        restartFailed: (a) => `Methwyd ailgychwyn fel gweinyddwr: ${a}`
      },
      columns: {
        allocated: "Dyrannwyd",
        name: "Enw"
      },
      totals: {
        line: (a, b, c) => `${a} wedi’u cyfrif · ${b} ar y ddisg · ${c} yn cael eu defnyddio ar y gyfrol`,
        lineNoVolume: (a, b) => `${a} wedi’u cyfrif · ${b} ar y ddisg`,
        hardLinkNote: (a) => `Mae ${a} ffeil â sawl enw yn cael eu cyfrif unwaith.`
      },
      filesView: {
        sortBy: "Trefnu yn ôl"
      },
      search: {
        label: "Chwilio enwau",
        placeholder: "Testun, * ? neu /regex/",
        clear: "Clirio’r chwiliad",
        invalid: "Nid yw’r patrwm hwnnw’n ddilys.",
        noMatches: (a) => `Nid oes dim yma’n cyfateb i "${a}".`
      },
      export: {
        csv: "Allforio CSV",
        png: "Cadw’r map fel PNG",
        failed: (a) => `Methwyd allforio: ${a}`,
        done: (a) => `Allforiwyd: ${a}`
      },
      menu: {
        properties: "Priodweddau",
        exclude: "Eithrio’r ffolder hon"
      },
      props: {
        path: "Llwybr",
        type: "Math",
        close: "Cau"
      },
      toasts: {
        excluded: (a) => `Bydd sganiau yn y dyfodol yn hepgor ${a}.`,
        alreadyExcluded: (a) => `Mae ${a} eisoes wedi’i eithrio.`,
        excludeFailed: "Methwyd cadw’r eithriad hwnnw."
      },
      saved: {
        title: "Sganiau wedi’u cadw",
        nameField: "Enw ar gyfer y sgan hwn",
        save: "Cadw’r sgan presennol",
        saving: "Yn cadw…",
        saved: (a) => `Cadwyd y sgan "${a}".`,
        nothingToSave: "Sganiwch yriant yn gyntaf, yna gallwch ei gadw yma.",
        empty: "Dim sganiau wedi’u cadw eto.",
        load: "Agor",
        delete: "Dileu",
        deleteConfirm: (a) => `Dileu "${a}" am byth?`,
        selectForCompare: (a) => `Dewis ${a} i gymharu`,
        compare: "Cymharu’r rhai a ddewiswyd",
        pickTwo: "Dewiswch ddau sgan i’w cymharu.",
        partial: "Rhannol",
        viewing: (a, b) => `Rydych yn gweld y sgan "${a}" a gadwyd ar ${b}. Nid dyma’ch gyriant fel y mae nawr.`,
        closeView: "Yn ôl i’r sgan byw",
        failed: (a) => `Sganiau wedi’u cadw: ${a}`
      },
      compare: {
        title: (a, b) => `O "${a}" i "${b}"`,
        total: (a) => `Cyfanswm y newid: ${a}`,
        grew: "Tyfodd fwyaf",
        shrank: "Crebachodd fwyaf",
        added: "Ffolderi newydd",
        removed: "Ffolderi a dynnwyd",
        none: "Dim byd yn y grŵp hwn.",
        back: "Yn ôl i’r rhestr",
        loading: "Yn cymharu…"
      },
      crawl: {
        note: "Yn darllen pob ffolder, un ar y tro. Mae gyriant cyfan yn cymryd amser: mae canlyniadau’n ymddangos wrth iddynt gael eu canfod, a gallwch stopio unrhyw bryd a chadw’r hyn a ddarllenwyd.",
        limit: "Dim angen caniatâd. Mae gyriant cyfan yn cymryd llawer mwy o amser na’r sgan cyflym, ond gwelwch ganlyniadau wrth iddynt gyrraedd a gallwch stopio pryd bynnag y dymunwch.",
        partialNote: "Yn dangos yr hyn a ddarllenwyd hyd yma. Mae meintiau’n parhau i dyfu nes bod y sgan wedi gorffen."
      }
    }
  },
  da: {
    diskMapV3: {
      large: {
        tooLarge: "Drevet har flere filer, end Prune kan rumme i én scanning. Brug “undefined” for at scanne det mappe for mappe, eller udeluk store mapper i Indstillinger.",
        foldedNote: (a, b) => `Hver mappe viser sine ${a} største filer; de øvrige ${b} filer er lagt sammen i én række pr. mappe. De tæller stadig med i alle totaler og i filtypetallene.`,
        foldedFloorNote: (a, b) => `Dette drev har så mange filer, at kun filer på ${b} eller derover vises enkeltvis; de øvrige ${a} filer er lagt sammen i én række pr. mappe. De tæller stadig med i alle totaler og i filtypetallene.`
      },
      drives: {
        label: "Drev",
        system: "System",
        removable: "Flytbart",
        usage: (a, b) => `${a} af ${b} brugt`,
        scanned: "Scannet",
        alsoScan: "Scan også disse drev",
        alsoScanNote: "Drev, der scannes sammen, deler én administratorprompt.",
        notNtfs: "Kun NTFS-drev kan hurtigscannes.",
        failed: (a, b) => `Kunne ikke scanne ${a}: ${b}`
      },
      elevation: {
        runningAsAdmin: "Prune kører som administrator, så denne scanning starter uden en prompt.",
        why: "Windows lader kun administratorer læse et drevs filindeks direkte, og det er det, der gør denne scanning hurtig.",
        restartHint: "Genstart Prune som administrator én gang, så kræver senere hurtigscanninger ingen prompt.",
        restartButton: "Genstart Prune som administrator",
        restarting: "Genstarter…",
        restartDeclined: "Ikke godkendt — Prune kører stadig som før.",
        restartFailed: (a) => `Kunne ikke genstarte som administrator: ${a}`
      },
      columns: {
        allocated: "Allokeret",
        name: "Navn"
      },
      totals: {
        line: (a, b, c) => `${a} talt med · ${b} på disken · ${c} i brug på volumen`,
        lineNoVolume: (a, b) => `${a} talt med · ${b} på disken`,
        hardLinkNote: (a) => `${a} filer med flere navne tælles kun én gang.`
      },
      filesView: {
        sortBy: "Sortér efter"
      },
      search: {
        label: "Søg i navne",
        placeholder: "Tekst, * ? eller /regex/",
        clear: "Ryd søgning",
        invalid: "Det mønster er ikke gyldigt.",
        noMatches: (a) => `Intet her matcher "${a}".`
      },
      export: {
        csv: "Eksportér CSV",
        png: "Gem kort som PNG",
        failed: (a) => `Kunne ikke eksportere: ${a}`,
        done: (a) => `Eksporteret: ${a}`
      },
      menu: {
        properties: "Egenskaber",
        exclude: "Udeluk denne mappe"
      },
      props: {
        path: "Sti",
        type: "Type",
        close: "Luk"
      },
      toasts: {
        excluded: (a) => `${a} springes over ved fremtidige scanninger.`,
        alreadyExcluded: (a) => `${a} er allerede udeladt.`,
        excludeFailed: "Kunne ikke gemme den udeladelse."
      },
      saved: {
        title: "Gemte scanninger",
        nameField: "Navn til denne scanning",
        save: "Gem nuværende scanning",
        saving: "Gemmer…",
        saved: (a) => `Scanningen "${a}" er gemt.`,
        nothingToSave: "Scan først et drev, så kan du gemme det her.",
        empty: "Ingen gemte scanninger endnu.",
        load: "Åbn",
        delete: "Slet",
        deleteConfirm: (a) => `Slet "${a}" for altid?`,
        selectForCompare: (a) => `Vælg ${a} til sammenligning`,
        compare: "Sammenlign valgte",
        pickTwo: "Vælg to scanninger at sammenligne.",
        partial: "Delvis",
        viewing: (a, b) => `Du ser den gemte scanning "${a}" fra ${b}. Det er ikke dit drev, som det er nu.`,
        closeView: "Tilbage til den aktuelle scanning",
        failed: (a) => `Gemte scanninger: ${a}`
      },
      compare: {
        title: (a, b) => `Fra "${a}" til "${b}"`,
        total: (a) => `Samlet ændring: ${a}`,
        grew: "Voksede mest",
        shrank: "Faldt mest",
        added: "Nye mapper",
        removed: "Fjernede mapper",
        none: "Intet i denne gruppe.",
        back: "Tilbage til listen",
        loading: "Sammenligner…"
      },
      crawl: {
        note: "Læser hver mappe, én ad gangen. Et helt drev tager et stykke tid: resultaterne vises, efterhånden som de findes, og du kan stoppe når som helst og beholde det, der er læst.",
        limit: "Kræver ingen tilladelse. Et helt drev tager meget længere end hurtigscanning, men du ser resultaterne, mens de kommer, og kan stoppe, når du vil.",
        partialNote: "Viser det, der er læst indtil nu. Størrelserne vokser, indtil scanningen er færdig."
      }
    }
  },
  de: {
    diskMapV3: {
      large: {
        tooLarge: "Das Laufwerk enthält mehr Dateien, als Prune in einem Scan verarbeiten kann. Mit „undefined“ lässt es sich Ordner für Ordner scannen, oder Sie schließen große Ordner in den Einstellungen aus.",
        foldedNote: (a, b) => `Jeder Ordner listet seine ${a} größten Dateien auf; die übrigen ${b} Dateien sind pro Ordner in einer Zeile zusammengefasst. Sie zählen weiterhin in allen Summen und in den Dateityp-Zahlen mit.`,
        foldedFloorNote: (a, b) => `Dieses Laufwerk hat so viele Dateien, dass nur Dateien ab ${b} einzeln aufgeführt werden; die übrigen ${a} Dateien sind pro Ordner in einer Zeile zusammengefasst. Sie zählen weiterhin in allen Summen und in den Dateityp-Zahlen mit.`
      },
      drives: {
        label: "Laufwerke",
        system: "System",
        removable: "Wechseldatenträger",
        usage: (a, b) => `${a} von ${b} belegt`,
        scanned: "Gescannt",
        alsoScan: "Diese Laufwerke ebenfalls scannen",
        alsoScanNote: "Gemeinsam gescannte Laufwerke teilen sich eine Administrator-Abfrage.",
        notNtfs: "Nur NTFS-Laufwerke lassen sich per Schnellscan prüfen.",
        failed: (a, b) => `${a} konnte nicht gescannt werden: ${b}`
      },
      elevation: {
        runningAsAdmin: "Prune läuft als Administrator, daher startet dieser Scan ohne Abfrage.",
        why: "Windows erlaubt nur Administratoren, den Dateiindex eines Laufwerks direkt zu lesen – genau das macht diesen Scan schnell.",
        restartHint: "Starten Sie Prune einmal als Administrator neu, dann brauchen spätere Schnellscans keine Abfrage mehr.",
        restartButton: "Prune als Administrator neu starten",
        restarting: "Wird neu gestartet …",
        restartDeclined: "Nicht genehmigt — Prune läuft weiter wie bisher.",
        restartFailed: (a) => `Neustart als Administrator nicht möglich: ${a}`
      },
      columns: {
        allocated: "Belegt",
        name: "Name"
      },
      totals: {
        line: (a, b, c) => `${a} gezählt · ${b} auf dem Datenträger · ${c} belegt auf dem Volume`,
        lineNoVolume: (a, b) => `${a} gezählt · ${b} auf dem Datenträger`,
        hardLinkNote: (a) => `${a} Dateien mit mehreren Namen werden nur einmal gezählt.`
      },
      filesView: {
        sortBy: "Sortieren nach"
      },
      search: {
        label: "Namen durchsuchen",
        placeholder: "Text, * ? oder /regex/",
        clear: "Suche löschen",
        invalid: "Dieses Muster ist ungültig.",
        noMatches: (a) => `Hier passt nichts zu "${a}".`
      },
      export: {
        csv: "CSV exportieren",
        png: "Karte als PNG speichern",
        failed: (a) => `Export nicht möglich: ${a}`,
        done: (a) => `Exportiert: ${a}`
      },
      menu: {
        properties: "Eigenschaften",
        exclude: "Diesen Ordner ausschließen"
      },
      props: {
        path: "Pfad",
        type: "Typ",
        close: "Schließen"
      },
      toasts: {
        excluded: (a) => `${a} wird bei künftigen Scans übersprungen.`,
        alreadyExcluded: (a) => `${a} ist bereits ausgeschlossen.`,
        excludeFailed: "Der Ausschluss konnte nicht gespeichert werden."
      },
      saved: {
        title: "Gespeicherte Scans",
        nameField: "Name für diesen Scan",
        save: "Aktuellen Scan speichern",
        saving: "Wird gespeichert …",
        saved: (a) => `Scan "${a}" gespeichert.`,
        nothingToSave: "Scannen Sie zuerst ein Laufwerk, dann können Sie es hier speichern.",
        empty: "Noch keine gespeicherten Scans.",
        load: "Öffnen",
        delete: "Löschen",
        deleteConfirm: (a) => `"${a}" endgültig löschen?`,
        selectForCompare: (a) => `${a} zum Vergleichen auswählen`,
        compare: "Auswahl vergleichen",
        pickTwo: "Wählen Sie zwei Scans zum Vergleichen aus.",
        partial: "Unvollständig",
        viewing: (a, b) => `Sie sehen den gespeicherten Scan "${a}" vom ${b}. Das ist nicht der aktuelle Stand des Laufwerks.`,
        closeView: "Zurück zum aktuellen Scan",
        failed: (a) => `Gespeicherte Scans: ${a}`
      },
      compare: {
        title: (a, b) => `Von "${a}" zu "${b}"`,
        total: (a) => `Gesamtänderung: ${a}`,
        grew: "Am stärksten gewachsen",
        shrank: "Am stärksten geschrumpft",
        added: "Neue Ordner",
        removed: "Entfernte Ordner",
        none: "Nichts in dieser Gruppe.",
        back: "Zurück zur Liste",
        loading: "Wird verglichen …"
      },
      crawl: {
        note: "Liest jeden Ordner einzeln. Ein ganzes Laufwerk dauert eine Weile: Ergebnisse erscheinen, sobald sie gefunden werden, und Sie können jederzeit stoppen und das Gelesene behalten.",
        limit: "Braucht keine Berechtigung. Ein ganzes Laufwerk dauert viel länger als der Schnellscan, aber Sie sehen die Ergebnisse laufend und können jederzeit stoppen.",
        partialNote: "Zeigt, was bisher gelesen wurde. Die Größen wachsen weiter, bis der Scan fertig ist."
      }
    }
  },
  el: {
    diskMapV3: {
      large: {
        tooLarge: "Ο δίσκος έχει περισσότερα αρχεία από όσα μπορεί να χειριστεί το Prune σε μία σάρωση. Χρησιμοποιήστε το «undefined» για να τον σαρώσετε φάκελο προς φάκελο ή εξαιρέστε μεγάλους φακέλους από τις Ρυθμίσεις.",
        foldedNote: (a, b) => `Κάθε φάκελος εμφανίζει τα ${a} μεγαλύτερα αρχεία του· τα υπόλοιπα ${b} αρχεία αθροίζονται σε μία γραμμή ανά φάκελο. Εξακολουθούν να υπολογίζονται σε όλα τα σύνολα και στα στοιχεία ανά τύπο αρχείου.`,
        foldedFloorNote: (a, b) => `Αυτός ο δίσκος έχει τόσα πολλά αρχεία που μόνο όσα έχουν μέγεθος ${b} ή μεγαλύτερο εμφανίζονται ξεχωριστά· τα υπόλοιπα ${a} αρχεία αθροίζονται σε μία γραμμή ανά φάκελο. Εξακολουθούν να υπολογίζονται σε όλα τα σύνολα και στα στοιχεία ανά τύπο αρχείου.`
      },
      drives: {
        label: "Μονάδες δίσκου",
        system: "Σύστημα",
        removable: "Αφαιρούμενο",
        usage: (a, b) => `${a} από ${b} σε χρήση`,
        scanned: "Σαρώθηκε",
        alsoScan: "Σάρωση και αυτών των μονάδων",
        alsoScanNote: "Οι μονάδες που σαρώνονται μαζί μοιράζονται ένα μόνο αίτημα διαχειριστή.",
        notNtfs: "Μόνο οι μονάδες NTFS μπορούν να σαρωθούν γρήγορα.",
        failed: (a, b) => `Δεν ήταν δυνατή η σάρωση του ${a}: ${b}`
      },
      elevation: {
        runningAsAdmin: "Το Prune εκτελείται ως διαχειριστής, επομένως αυτή η σάρωση ξεκινά χωρίς αίτημα.",
        why: "Τα Windows επιτρέπουν μόνο στους διαχειριστές να διαβάζουν απευθείας το ευρετήριο αρχείων μιας μονάδας, και αυτό κάνει τη σάρωση γρήγορη.",
        restartHint: "Κάντε μία φορά επανεκκίνηση του Prune ως διαχειριστής και οι επόμενες γρήγορες σαρώσεις δεν θα χρειάζονται αίτημα.",
        restartButton: "Επανεκκίνηση του Prune ως διαχειριστής",
        restarting: "Επανεκκίνηση…",
        restartDeclined: "Δεν εγκρίθηκε — το Prune εξακολουθεί να εκτελείται όπως πριν.",
        restartFailed: (a) => `Δεν ήταν δυνατή η επανεκκίνηση ως διαχειριστής: ${a}`
      },
      columns: {
        allocated: "Εκχωρημένο",
        name: "Όνομα"
      },
      totals: {
        line: (a, b, c) => `${a} καταμετρημένα · ${b} στον δίσκο · ${c} σε χρήση στον τόμο`,
        lineNoVolume: (a, b) => `${a} καταμετρημένα · ${b} στον δίσκο`,
        hardLinkNote: (a) => `${a} αρχεία με πολλά ονόματα μετρώνται μία φορά.`
      },
      filesView: {
        sortBy: "Ταξινόμηση κατά"
      },
      search: {
        label: "Αναζήτηση ονομάτων",
        placeholder: "Κείμενο, * ? ή /regex/",
        clear: "Εκκαθάριση αναζήτησης",
        invalid: "Αυτό το μοτίβο δεν είναι έγκυρο.",
        noMatches: (a) => `Τίποτα εδώ δεν ταιριάζει με "${a}".`
      },
      export: {
        csv: "Εξαγωγή CSV",
        png: "Αποθήκευση χάρτη ως PNG",
        failed: (a) => `Η εξαγωγή απέτυχε: ${a}`,
        done: (a) => `Έγινε εξαγωγή: ${a}`
      },
      menu: {
        properties: "Ιδιότητες",
        exclude: "Εξαίρεση αυτού του φακέλου"
      },
      props: {
        path: "Διαδρομή",
        type: "Τύπος",
        close: "Κλείσιμο"
      },
      toasts: {
        excluded: (a) => `Το ${a} θα παραλείπεται στις επόμενες σαρώσεις.`,
        alreadyExcluded: (a) => `Το ${a} έχει ήδη εξαιρεθεί.`,
        excludeFailed: "Δεν ήταν δυνατή η αποθήκευση της εξαίρεσης."
      },
      saved: {
        title: "Αποθηκευμένες σαρώσεις",
        nameField: "Όνομα για αυτήν τη σάρωση",
        save: "Αποθήκευση τρέχουσας σάρωσης",
        saving: "Αποθήκευση…",
        saved: (a) => `Η σάρωση "${a}" αποθηκεύτηκε.`,
        nothingToSave: "Σαρώστε πρώτα μια μονάδα και μετά μπορείτε να την αποθηκεύσετε εδώ.",
        empty: "Δεν υπάρχουν ακόμη αποθηκευμένες σαρώσεις.",
        load: "Άνοιγμα",
        delete: "Διαγραφή",
        deleteConfirm: (a) => `Να διαγραφεί οριστικά το "${a}";`,
        selectForCompare: (a) => `Επιλογή του ${a} για σύγκριση`,
        compare: "Σύγκριση επιλεγμένων",
        pickTwo: "Επιλέξτε δύο σαρώσεις για σύγκριση.",
        partial: "Μερική",
        viewing: (a, b) => `Βλέπετε την αποθηκευμένη σάρωση "${a}" από ${b}. Δεν είναι η τρέχουσα κατάσταση της μονάδας.`,
        closeView: "Επιστροφή στην τρέχουσα σάρωση",
        failed: (a) => `Αποθηκευμένες σαρώσεις: ${a}`
      },
      compare: {
        title: (a, b) => `Από "${a}" σε "${b}"`,
        total: (a) => `Συνολική αλλαγή: ${a}`,
        grew: "Αυξήθηκαν περισσότερο",
        shrank: "Μειώθηκαν περισσότερο",
        added: "Νέοι φάκελοι",
        removed: "Φάκελοι που αφαιρέθηκαν",
        none: "Τίποτα σε αυτήν την ομάδα.",
        back: "Επιστροφή στη λίστα",
        loading: "Σύγκριση…"
      },
      crawl: {
        note: "Διαβάζει κάθε φάκελο, έναν-έναν. Μια ολόκληρη μονάδα παίρνει χρόνο: τα αποτελέσματα εμφανίζονται όπως βρίσκονται και μπορείτε να σταματήσετε ανά πάσα στιγμή κρατώντας ό,τι διαβάστηκε.",
        limit: "Δεν χρειάζεται άδεια. Μια ολόκληρη μονάδα παίρνει πολύ περισσότερο από τη γρήγορη σάρωση, αλλά βλέπετε τα αποτελέσματα όπως φτάνουν και μπορείτε να σταματήσετε όποτε θέλετε.",
        partialNote: "Εμφανίζεται ό,τι έχει διαβαστεί μέχρι τώρα. Τα μεγέθη συνεχίζουν να αυξάνονται μέχρι να ολοκληρωθεί η σάρωση."
      }
    }
  },
  es: {
    diskMapV3: {
      large: {
        tooLarge: "La unidad tiene más archivos de los que Prune puede manejar en un solo análisis. Usa “undefined” para analizarla carpeta por carpeta, o excluye carpetas grandes en Ajustes.",
        foldedNote: (a, b) => `Cada carpeta muestra sus ${a} archivos más grandes; los otros ${b} archivos se suman en una sola fila por carpeta. Siguen contando en todos los totales y en las cifras por tipo de archivo.`,
        foldedFloorNote: (a, b) => `Esta unidad tiene tantos archivos que solo se muestran uno a uno los de ${b} o más; los otros ${a} archivos se suman en una sola fila por carpeta. Siguen contando en todos los totales y en las cifras por tipo de archivo.`
      },
      drives: {
        label: "Unidades",
        system: "Sistema",
        removable: "Extraíble",
        usage: (a, b) => `${a} de ${b} usados`,
        scanned: "Escaneado",
        alsoScan: "Escanear también estas unidades",
        alsoScanNote: "Las unidades que se escanean juntas comparten una sola solicitud de administrador.",
        notNtfs: "Solo las unidades NTFS admiten el escaneo rápido.",
        failed: (a, b) => `No se pudo escanear ${a}: ${b}`
      },
      elevation: {
        runningAsAdmin: "Prune se ejecuta como administrador, así que este escaneo empieza sin solicitud.",
        why: "Windows solo permite a los administradores leer directamente el índice de archivos de una unidad, y eso es lo que hace rápido este escaneo.",
        restartHint: "Reinicia Prune como administrador una vez y los siguientes escaneos rápidos no necesitarán solicitud.",
        restartButton: "Reiniciar Prune como administrador",
        restarting: "Reiniciando…",
        restartDeclined: "No aprobado: Prune sigue ejecutándose como antes.",
        restartFailed: (a) => `No se pudo reiniciar como administrador: ${a}`
      },
      columns: {
        allocated: "Asignado",
        name: "Nombre"
      },
      totals: {
        line: (a, b, c) => `${a} contados · ${b} en disco · ${c} en uso en el volumen`,
        lineNoVolume: (a, b) => `${a} contados · ${b} en disco`,
        hardLinkNote: (a) => `${a} archivos con varios nombres se cuentan una sola vez.`
      },
      filesView: {
        sortBy: "Ordenar por"
      },
      search: {
        label: "Buscar nombres",
        placeholder: "Texto, * ? o /regex/",
        clear: "Borrar búsqueda",
        invalid: "Ese patrón no es válido.",
        noMatches: (a) => `Nada aquí coincide con "${a}".`
      },
      export: {
        csv: "Exportar CSV",
        png: "Guardar mapa como PNG",
        failed: (a) => `No se pudo exportar: ${a}`,
        done: (a) => `Exportado: ${a}`
      },
      menu: {
        properties: "Propiedades",
        exclude: "Excluir esta carpeta"
      },
      props: {
        path: "Ruta",
        type: "Tipo",
        close: "Cerrar"
      },
      toasts: {
        excluded: (a) => `${a} se omitirá en los próximos escaneos.`,
        alreadyExcluded: (a) => `${a} ya está excluido.`,
        excludeFailed: "No se pudo guardar esa exclusión."
      },
      saved: {
        title: "Escaneos guardados",
        nameField: "Nombre de este escaneo",
        save: "Guardar el escaneo actual",
        saving: "Guardando…",
        saved: (a) => `Escaneo "${a}" guardado.`,
        nothingToSave: "Primero escanea una unidad y después podrás guardarla aquí.",
        empty: "Aún no hay escaneos guardados.",
        load: "Abrir",
        delete: "Eliminar",
        deleteConfirm: (a) => `¿Eliminar "${a}" definitivamente?`,
        selectForCompare: (a) => `Seleccionar ${a} para comparar`,
        compare: "Comparar selección",
        pickTwo: "Elige dos escaneos para comparar.",
        partial: "Parcial",
        viewing: (a, b) => `Estás viendo el escaneo guardado "${a}" del ${b}. No es la unidad tal como está ahora.`,
        closeView: "Volver al escaneo actual",
        failed: (a) => `Escaneos guardados: ${a}`
      },
      compare: {
        title: (a, b) => `De "${a}" a "${b}"`,
        total: (a) => `Cambio total: ${a}`,
        grew: "Los que más crecieron",
        shrank: "Los que más se redujeron",
        added: "Carpetas nuevas",
        removed: "Carpetas eliminadas",
        none: "Nada en este grupo.",
        back: "Volver a la lista",
        loading: "Comparando…"
      },
      crawl: {
        note: "Lee cada carpeta, una a una. Una unidad entera tarda un rato: los resultados aparecen a medida que se encuentran y puedes detenerlo cuando quieras y conservar lo leído.",
        limit: "No necesita permiso. Una unidad entera tarda mucho más que el escaneo rápido, pero ves los resultados a medida que llegan y puedes detenerlo cuando quieras.",
        partialNote: "Se muestra lo leído hasta ahora. Los tamaños siguen creciendo hasta que termine el escaneo."
      }
    }
  },
  et: {
    diskMapV3: {
      large: {
        tooLarge: "Draivil on rohkem faile, kui Prune ühe skannimisega suudab käsitleda. Kasuta valikut „undefined“, et skannida seda kaust kausta kaupa, või jäta seadetes suured kaustad välja.",
        foldedNote: (a, b) => `Iga kaust loetleb oma ${a} suurimat faili; ülejäänud ${b} faili on kausta kohta liidetud üheks reaks. Need lähevad endiselt arvesse kõigis kogusummades ja failitüüpide arvudes.`,
        foldedFloorNote: (a, b) => `Sellel draivil on nii palju faile, et eraldi loetletakse vaid vähemalt ${b} suurused failid; ülejäänud ${a} faili on kausta kohta liidetud üheks reaks. Need lähevad endiselt arvesse kõigis kogusummades ja failitüüpide arvudes.`
      },
      drives: {
        label: "Draivid",
        system: "Süsteem",
        removable: "Eemaldatav",
        usage: (a, b) => `Kasutusel ${a} / ${b}`,
        scanned: "Skannitud",
        alsoScan: "Skanni ka need draivid",
        alsoScanNote: "Koos skannitavad draivid jagavad ühte administraatoriluba.",
        notNtfs: "Kiirskannida saab ainult NTFS-draive.",
        failed: (a, b) => `Draivi ${a} skannimine ebaõnnestus: ${b}`
      },
      elevation: {
        runningAsAdmin: "Prune töötab administraatorina, nii et see skannimine algab ilma luba küsimata.",
        why: "Windows lubab draivi failiindeksit otse lugeda ainult administraatoritel – just see teebki skannimise kiireks.",
        restartHint: "Taaskäivitage Prune üks kord administraatorina ja järgmised kiirskannid ei vaja luba.",
        restartButton: "Taaskäivita Prune administraatorina",
        restarting: "Taaskäivitamine…",
        restartDeclined: "Pole heaks kiidetud — Prune töötab edasi nagu varem.",
        restartFailed: (a) => `Administraatorina taaskäivitamine ebaõnnestus: ${a}`
      },
      columns: {
        allocated: "Eraldatud",
        name: "Nimi"
      },
      totals: {
        line: (a, b, c) => `${a} loetud · ${b} kettal · ${c} köites kasutusel`,
        lineNoVolume: (a, b) => `${a} loetud · ${b} kettal`,
        hardLinkNote: (a) => `${a} mitme nimega faili loetakse ainult üks kord.`
      },
      filesView: {
        sortBy: "Sorteeri"
      },
      search: {
        label: "Otsi nimesid",
        placeholder: "Tekst, * ? või /regex/",
        clear: "Tühjenda otsing",
        invalid: "See muster ei ole kehtiv.",
        noMatches: (a) => `Siin pole midagi, mis vastaks päringule "${a}".`
      },
      export: {
        csv: "Ekspordi CSV",
        png: "Salvesta kaart PNG-na",
        failed: (a) => `Eksport ebaõnnestus: ${a}`,
        done: (a) => `Eksporditud: ${a}`
      },
      menu: {
        properties: "Atribuudid",
        exclude: "Välista see kaust"
      },
      props: {
        path: "Asukoht",
        type: "Tüüp",
        close: "Sulge"
      },
      toasts: {
        excluded: (a) => `${a} jäetakse edasistel skannimistel vahele.`,
        alreadyExcluded: (a) => `${a} on juba välistatud.`,
        excludeFailed: "Välistust ei õnnestunud salvestada."
      },
      saved: {
        title: "Salvestatud skannimised",
        nameField: "Selle skannimise nimi",
        save: "Salvesta praegune skannimine",
        saving: "Salvestamine…",
        saved: (a) => `Skannimine "${a}" salvestati.`,
        nothingToSave: "Skannige esmalt draiv, siis saate selle siia salvestada.",
        empty: "Salvestatud skannimisi veel pole.",
        load: "Ava",
        delete: "Kustuta",
        deleteConfirm: (a) => `Kas kustutada "${a}" jäädavalt?`,
        selectForCompare: (a) => `Vali ${a} võrdlemiseks`,
        compare: "Võrdle valitud",
        pickTwo: "Valige võrdlemiseks kaks skannimist.",
        partial: "Osaline",
        viewing: (a, b) => `Vaatate salvestatud skannimist "${a}" kuupäevast ${b}. See ei ole draivi praegune seis.`,
        closeView: "Tagasi praeguse skannimise juurde",
        failed: (a) => `Salvestatud skannimised: ${a}`
      },
      compare: {
        title: (a, b) => `Skannimiselt "${a}" skannimiseni "${b}"`,
        total: (a) => `Kogumuutus: ${a}`,
        grew: "Kasvas enim",
        shrank: "Vähenes enim",
        added: "Uued kaustad",
        removed: "Eemaldatud kaustad",
        none: "Selles rühmas pole midagi.",
        back: "Tagasi loendisse",
        loading: "Võrdlemine…"
      },
      crawl: {
        note: "Loeb iga kausta ükshaaval. Terve draiv võtab aega: tulemused ilmuvad leidmise järel ning saate igal ajal peatada ja säilitada loetu.",
        limit: "Luba pole vaja. Terve draiv võtab palju kauem kui kiirskann, kuid näete tulemusi jooksvalt ja saate peatada millal tahes.",
        partialNote: "Näidatakse seni loetut. Suurused kasvavad, kuni skannimine lõpeb."
      }
    }
  },
  fi: {
    diskMapV3: {
      large: {
        tooLarge: "Asemassa on enemmän tiedostoja kuin Prune pystyy käsittelemään yhdellä skannauksella. Käytä toimintoa “undefined” skannataksesi sen kansio kerrallaan, tai sulje suuret kansiot pois Asetuksissa.",
        foldedNote: (a, b) => `Jokainen kansio luettelee ${a} suurinta tiedostoaan; muut ${b} tiedostoa on laskettu yhteen yhdelle riville kansiota kohti. Ne lasketaan edelleen mukaan kaikkiin summiin ja tiedostotyyppilukuihin.`,
        foldedFloorNote: (a, b) => `Tässä asemassa on niin paljon tiedostoja, että vain ${b} tai suuremmat tiedostot luetellaan erikseen; muut ${a} tiedostoa on laskettu yhteen yhdelle riville kansiota kohti. Ne lasketaan edelleen mukaan kaikkiin summiin ja tiedostotyyppilukuihin.`
      },
      drives: {
        label: "Asemat",
        system: "Järjestelmä",
        removable: "Irrotettava",
        usage: (a, b) => `${a} / ${b} käytössä`,
        scanned: "Skannattu",
        alsoScan: "Skannaa myös nämä asemat",
        alsoScanNote: "Yhdessä skannattavat asemat jakavat yhden järjestelmänvalvojan kehotteen.",
        notNtfs: "Vain NTFS-asemat voi skannata pikaskannauksella.",
        failed: (a, b) => `Aseman ${a} skannaus epäonnistui: ${b}`
      },
      elevation: {
        runningAsAdmin: "Prune toimii järjestelmänvalvojana, joten tämä skannaus alkaa ilman kehotetta.",
        why: "Windows sallii aseman tiedostoindeksin suoran lukemisen vain järjestelmänvalvojille, ja juuri se tekee tästä skannauksesta nopean.",
        restartHint: "Käynnistä Prune kerran uudelleen järjestelmänvalvojana, niin myöhemmät pikaskannaukset eivät tarvitse kehotetta.",
        restartButton: "Käynnistä Prune uudelleen järjestelmänvalvojana",
        restarting: "Käynnistetään uudelleen…",
        restartDeclined: "Ei hyväksytty — Prune toimii edelleen entiseen tapaan.",
        restartFailed: (a) => `Uudelleenkäynnistys järjestelmänvalvojana epäonnistui: ${a}`
      },
      columns: {
        allocated: "Varattu",
        name: "Nimi"
      },
      totals: {
        line: (a, b, c) => `${a} laskettu · ${b} levyllä · ${c} käytössä taltiolla`,
        lineNoVolume: (a, b) => `${a} laskettu · ${b} levyllä`,
        hardLinkNote: (a) => `${a} useamman nimen tiedostoa lasketaan vain kerran.`
      },
      filesView: {
        sortBy: "Lajittelu"
      },
      search: {
        label: "Hae nimiä",
        placeholder: "Teksti, * ? tai /regex/",
        clear: "Tyhjennä haku",
        invalid: "Tämä lauseke ei kelpaa.",
        noMatches: (a) => `Mikään täällä ei vastaa hakua "${a}".`
      },
      export: {
        csv: "Vie CSV",
        png: "Tallenna kartta PNG-kuvana",
        failed: (a) => `Vienti epäonnistui: ${a}`,
        done: (a) => `Viety: ${a}`
      },
      menu: {
        properties: "Ominaisuudet",
        exclude: "Sulje tämä kansio pois"
      },
      props: {
        path: "Polku",
        type: "Tyyppi",
        close: "Sulje"
      },
      toasts: {
        excluded: (a) => `${a} ohitetaan tulevissa skannauksissa.`,
        alreadyExcluded: (a) => `${a} on jo suljettu pois.`,
        excludeFailed: "Poissulkemisen tallennus epäonnistui."
      },
      saved: {
        title: "Tallennetut skannaukset",
        nameField: "Tämän skannauksen nimi",
        save: "Tallenna nykyinen skannaus",
        saving: "Tallennetaan…",
        saved: (a) => `Skannaus "${a}" tallennettu.`,
        nothingToSave: "Skannaa ensin asema, niin voit tallentaa sen tähän.",
        empty: "Ei vielä tallennettuja skannauksia.",
        load: "Avaa",
        delete: "Poista",
        deleteConfirm: (a) => `Poistetaanko "${a}" lopullisesti?`,
        selectForCompare: (a) => `Valitse ${a} vertailuun`,
        compare: "Vertaa valittuja",
        pickTwo: "Valitse kaksi vertailtavaa skannausta.",
        partial: "Osittainen",
        viewing: (a, b) => `Katselet tallennettua skannausta "${a}" ajalta ${b}. Tämä ei ole aseman nykytila.`,
        closeView: "Takaisin nykyiseen skannaukseen",
        failed: (a) => `Tallennetut skannaukset: ${a}`
      },
      compare: {
        title: (a, b) => `"${a}" → "${b}"`,
        total: (a) => `Kokonaismuutos: ${a}`,
        grew: "Kasvoi eniten",
        shrank: "Pieneni eniten",
        added: "Uudet kansiot",
        removed: "Poistetut kansiot",
        none: "Tässä ryhmässä ei ole mitään.",
        back: "Takaisin luetteloon",
        loading: "Verrataan…"
      },
      crawl: {
        note: "Lukee jokaisen kansion yksi kerrallaan. Koko asema vie aikansa: tulokset näkyvät sitä mukaa kuin niitä löytyy, ja voit pysäyttää milloin tahansa ja säilyttää luetun.",
        limit: "Ei vaadi lupaa. Koko asema kestää paljon pidempään kuin pikaskannaus, mutta näet tulokset sitä mukaa kuin ne saapuvat ja voit pysäyttää milloin haluat.",
        partialNote: "Näytetään tähän mennessä luettu. Koot kasvavat, kunnes skannaus on valmis."
      }
    }
  },
  fr: {
    diskMapV3: {
      large: {
        tooLarge: "Le lecteur contient plus de fichiers que Prune n’en peut gérer en une seule analyse. Utilisez « undefined » pour l’analyser dossier par dossier, ou excluez les gros dossiers dans les Paramètres.",
        foldedNote: (a, b) => `Chaque dossier liste ses ${a} plus gros fichiers ; les ${b} autres fichiers sont additionnés sur une seule ligne par dossier. Ils comptent toujours dans tous les totaux et dans les chiffres par type de fichier.`,
        foldedFloorNote: (a, b) => `Ce lecteur contient tant de fichiers que seuls ceux de ${b} ou plus sont listés individuellement ; les ${a} autres fichiers sont additionnés sur une seule ligne par dossier. Ils comptent toujours dans tous les totaux et dans les chiffres par type de fichier.`
      },
      drives: {
        label: "Lecteurs",
        system: "Système",
        removable: "Amovible",
        usage: (a, b) => `${a} utilisés sur ${b}`,
        scanned: "Analysé",
        alsoScan: "Analyser aussi ces lecteurs",
        alsoScanNote: "Les lecteurs analysés ensemble partagent une seule demande d’administrateur.",
        notNtfs: "Seuls les lecteurs NTFS peuvent faire l’objet d’une analyse rapide.",
        failed: (a, b) => `Impossible d’analyser ${a} : ${b}`
      },
      elevation: {
        runningAsAdmin: "Prune s’exécute en tant qu’administrateur : cette analyse démarre sans demande de confirmation.",
        why: "Windows ne laisse lire directement l’index des fichiers d’un lecteur qu’aux administrateurs, et c’est ce qui rend cette analyse rapide.",
        restartHint: "Redémarrez Prune une fois en tant qu’administrateur : les analyses rapides suivantes n’auront plus besoin de confirmation.",
        restartButton: "Redémarrer Prune en administrateur",
        restarting: "Redémarrage…",
        restartDeclined: "Non approuvé : Prune continue de fonctionner comme avant.",
        restartFailed: (a) => `Impossible de redémarrer en administrateur : ${a}`
      },
      columns: {
        allocated: "Alloué",
        name: "Nom"
      },
      totals: {
        line: (a, b, c) => `${a} comptabilisés · ${b} sur le disque · ${c} utilisés sur le volume`,
        lineNoVolume: (a, b) => `${a} comptabilisés · ${b} sur le disque`,
        hardLinkNote: (a) => `${a} fichiers portant plusieurs noms ne sont comptés qu’une fois.`
      },
      filesView: {
        sortBy: "Trier par"
      },
      search: {
        label: "Rechercher des noms",
        placeholder: "Texte, * ? ou /regex/",
        clear: "Effacer la recherche",
        invalid: "Ce motif n’est pas valide.",
        noMatches: (a) => `Rien ici ne correspond à "${a}".`
      },
      export: {
        csv: "Exporter en CSV",
        png: "Enregistrer la carte en PNG",
        failed: (a) => `Échec de l’exportation : ${a}`,
        done: (a) => `Exporté : ${a}`
      },
      menu: {
        properties: "Propriétés",
        exclude: "Exclure ce dossier"
      },
      props: {
        path: "Chemin",
        type: "Type",
        close: "Fermer"
      },
      toasts: {
        excluded: (a) => `${a} sera ignoré lors des prochaines analyses.`,
        alreadyExcluded: (a) => `${a} est déjà exclu.`,
        excludeFailed: "Impossible d’enregistrer cette exclusion."
      },
      saved: {
        title: "Analyses enregistrées",
        nameField: "Nom de cette analyse",
        save: "Enregistrer l’analyse actuelle",
        saving: "Enregistrement…",
        saved: (a) => `Analyse "${a}" enregistrée.`,
        nothingToSave: "Analysez d’abord un lecteur, puis vous pourrez l’enregistrer ici.",
        empty: "Aucune analyse enregistrée pour le moment.",
        load: "Ouvrir",
        delete: "Supprimer",
        deleteConfirm: (a) => `Supprimer définitivement "${a}" ?`,
        selectForCompare: (a) => `Sélectionner ${a} pour comparer`,
        compare: "Comparer la sélection",
        pickTwo: "Choisissez deux analyses à comparer.",
        partial: "Partielle",
        viewing: (a, b) => `Vous consultez l’analyse enregistrée "${a}" du ${b}. Ce n’est pas l’état actuel du lecteur.`,
        closeView: "Retour à l’analyse en cours",
        failed: (a) => `Analyses enregistrées : ${a}`
      },
      compare: {
        title: (a, b) => `De "${a}" à "${b}"`,
        total: (a) => `Variation totale : ${a}`,
        grew: "Plus fortes hausses",
        shrank: "Plus fortes baisses",
        added: "Nouveaux dossiers",
        removed: "Dossiers supprimés",
        none: "Rien dans ce groupe.",
        back: "Retour à la liste",
        loading: "Comparaison…"
      },
      crawl: {
        note: "Lit chaque dossier, un à la fois. Un lecteur entier prend du temps : les résultats apparaissent au fur et à mesure et vous pouvez arrêter à tout moment en gardant ce qui a été lu.",
        limit: "Ne demande aucune autorisation. Un lecteur entier prend bien plus de temps que l’analyse rapide, mais vous voyez les résultats au fur et à mesure et pouvez arrêter quand vous voulez.",
        partialNote: "Affichage de ce qui a été lu jusqu’ici. Les tailles continuent de croître jusqu’à la fin de l’analyse."
      }
    }
  },
  he: {
    diskMapV3: {
      large: {
        tooLarge: "בכונן יש יותר קבצים ממה ש-Prune יכול להכיל בסריקה אחת. השתמשו ב“undefined” כדי לסרוק אותו תיקייה אחר תיקייה, או החריגו תיקיות גדולות בהגדרות.",
        foldedNote: (a, b) => `כל תיקייה מציגה את ${a} הקבצים הגדולים ביותר שלה; ${b} הקבצים האחרים מסוכמים בשורה אחת לכל תיקייה. הם עדיין נספרים בכל הסכומים ובנתוני סוגי הקבצים.`,
        foldedFloorNote: (a, b) => `בכונן הזה יש כל כך הרבה קבצים שרק קבצים בגודל ${b} ומעלה מוצגים בנפרד; ${a} הקבצים האחרים מסוכמים בשורה אחת לכל תיקייה. הם עדיין נספרים בכל הסכומים ובנתוני סוגי הקבצים.`
      },
      drives: {
        label: "כוננים",
        system: "מערכת",
        removable: "נשלף",
        usage: (a, b) => `${a} מתוך ${b} בשימוש`,
        scanned: "נסרק",
        alsoScan: "סרוק גם את הכוננים האלה",
        alsoScanNote: "כוננים שנסרקים יחד חולקים בקשת מנהל אחת.",
        notNtfs: "סריקה מהירה אפשרית רק בכוננים עם NTFS.",
        failed: (a, b) => `לא ניתן לסרוק את ${a}: ${b}`
      },
      elevation: {
        runningAsAdmin: "Prune פועל כמנהל, ולכן הסריקה הזו מתחילה בלי בקשת אישור.",
        why: "Windows מאפשר רק למנהלים לקרוא ישירות את אינדקס הקבצים של כונן, וזה מה שהופך את הסריקה למהירה.",
        restartHint: "הפעל מחדש את Prune כמנהל פעם אחת, והסריקות המהירות הבאות לא יצטרכו בקשת אישור.",
        restartButton: "הפעל מחדש את Prune כמנהל",
        restarting: "מופעל מחדש…",
        restartDeclined: "לא אושר — Prune ממשיך לפעול כמו קודם.",
        restartFailed: (a) => `לא ניתן להפעיל מחדש כמנהל: ${a}`
      },
      columns: {
        allocated: "מוקצה",
        name: "שם"
      },
      totals: {
        line: (a, b, c) => `${a} נספרו · ${b} בדיסק · ${c} בשימוש בנפח`,
        lineNoVolume: (a, b) => `${a} נספרו · ${b} בדיסק`,
        hardLinkNote: (a) => `${a} קבצים עם כמה שמות נספרים פעם אחת בלבד.`
      },
      filesView: {
        sortBy: "מיין לפי"
      },
      search: {
        label: "חיפוש שמות",
        placeholder: "טקסט, * ? או /regex/",
        clear: "נקה חיפוש",
        invalid: "התבנית הזו אינה תקינה.",
        noMatches: (a) => `שום דבר כאן לא תואם ל-"${a}".`
      },
      export: {
        csv: "ייצוא CSV",
        png: "שמור מפה כ-PNG",
        failed: (a) => `הייצוא נכשל: ${a}`,
        done: (a) => `יוצא: ${a}`
      },
      menu: {
        properties: "מאפיינים",
        exclude: "החרג תיקייה זו"
      },
      props: {
        path: "נתיב",
        type: "סוג",
        close: "סגור"
      },
      toasts: {
        excluded: (a) => `${a} ידולג בסריקות עתידיות.`,
        alreadyExcluded: (a) => `${a} כבר מוחרג.`,
        excludeFailed: "לא ניתן לשמור את ההחרגה."
      },
      saved: {
        title: "סריקות שמורות",
        nameField: "שם לסריקה זו",
        save: "שמור את הסריקה הנוכחית",
        saving: "שומר…",
        saved: (a) => `הסריקה "${a}" נשמרה.`,
        nothingToSave: "סרקו כונן קודם, ואז אפשר לשמור אותו כאן.",
        empty: "עדיין אין סריקות שמורות.",
        load: "פתח",
        delete: "מחק",
        deleteConfirm: (a) => `למחוק את "${a}" לצמיתות?`,
        selectForCompare: (a) => `בחר את ${a} להשוואה`,
        compare: "השווה את הנבחרים",
        pickTwo: "בחרו שתי סריקות להשוואה.",
        partial: "חלקית",
        viewing: (a, b) => `אתם צופים בסריקה השמורה "${a}" מתאריך ${b}. זה לא מצב הכונן כעת.`,
        closeView: "חזרה לסריקה הנוכחית",
        failed: (a) => `סריקות שמורות: ${a}`
      },
      compare: {
        title: (a, b) => `מ-"${a}" אל "${b}"`,
        total: (a) => `שינוי כולל: ${a}`,
        grew: "הגדלה הגדולה ביותר",
        shrank: "הקטנה הגדולה ביותר",
        added: "תיקיות חדשות",
        removed: "תיקיות שהוסרו",
        none: "אין דבר בקבוצה זו.",
        back: "חזרה לרשימה",
        loading: "משווה…"
      },
      crawl: {
        note: "קורא כל תיקייה, אחת אחת. כונן שלם לוקח זמן: התוצאות מופיעות תוך כדי מציאתן, ואפשר לעצור בכל רגע ולשמור את מה שנקרא.",
        limit: "לא דורש הרשאה. כונן שלם לוקח הרבה יותר זמן מהסריקה המהירה, אבל התוצאות מופיעות תוך כדי ואפשר לעצור מתי שרוצים.",
        partialNote: "מוצג מה שנקרא עד כה. הגדלים ממשיכים לגדול עד שהסריקה מסתיימת."
      }
    }
  },
  hu: {
    diskMapV3: {
      large: {
        tooLarge: "A meghajtón több fájl van, mint amennyit a Prune egyetlen vizsgálatban kezelni tud. A „undefined” használatával mappánként végigjárhatja, vagy a Beállításokban kizárhatja a nagy mappákat.",
        foldedNote: (a, b) => `Minden mappa a ${a} legnagyobb fájlját sorolja fel; a többi ${b} fájl mappánként egyetlen sorba van összegezve. Ezek továbbra is beleszámítanak minden összegbe és a fájltípus-adatokba.`,
        foldedFloorNote: (a, b) => `Ezen a meghajtón annyi fájl van, hogy csak a ${b} vagy annál nagyobb fájlok szerepelnek külön-külön; a többi ${a} fájl mappánként egyetlen sorba van összegezve. Ezek továbbra is beleszámítanak minden összegbe és a fájltípus-adatokba.`
      },
      drives: {
        label: "Meghajtók",
        system: "Rendszer",
        removable: "Cserélhető",
        usage: (a, b) => `${a} / ${b} használatban`,
        scanned: "Vizsgálva",
        alsoScan: "Ezeket a meghajtókat is vizsgálja",
        alsoScanNote: "Az együtt vizsgált meghajtók egyetlen rendszergazdai jóváhagyáson osztoznak.",
        notNtfs: "Gyors vizsgálat csak NTFS meghajtókon lehetséges.",
        failed: (a, b) => `A(z) ${a} vizsgálata nem sikerült: ${b}`
      },
      elevation: {
        runningAsAdmin: "A Prune rendszergazdaként fut, ezért ez a vizsgálat jóváhagyás nélkül indul.",
        why: "A Windows csak rendszergazdáknak engedi a meghajtó fájlindexének közvetlen olvasását, és ettől gyors ez a vizsgálat.",
        restartHint: "Indítsa újra egyszer a Prune-t rendszergazdaként, és a későbbi gyors vizsgálatokhoz nem kell jóváhagyás.",
        restartButton: "Prune újraindítása rendszergazdaként",
        restarting: "Újraindítás…",
        restartDeclined: "Nincs jóváhagyva — a Prune tovább fut, ahogy eddig.",
        restartFailed: (a) => `A rendszergazdai újraindítás nem sikerült: ${a}`
      },
      columns: {
        allocated: "Lefoglalt",
        name: "Név"
      },
      totals: {
        line: (a, b, c) => `${a} megszámolva · ${b} lemezen · ${c} használatban a köteten`,
        lineNoVolume: (a, b) => `${a} megszámolva · ${b} lemezen`,
        hardLinkNote: (a) => `${a} több névvel rendelkező fájlt csak egyszer számol.`
      },
      filesView: {
        sortBy: "Rendezés"
      },
      search: {
        label: "Nevek keresése",
        placeholder: "Szöveg, * ? vagy /regex/",
        clear: "Keresés törlése",
        invalid: "Ez a minta érvénytelen.",
        noMatches: (a) => `Itt semmi sem egyezik ezzel: "${a}".`
      },
      export: {
        csv: "CSV exportálása",
        png: "Térkép mentése PNG-ként",
        failed: (a) => `Az exportálás nem sikerült: ${a}`,
        done: (a) => `Exportálva: ${a}`
      },
      menu: {
        properties: "Tulajdonságok",
        exclude: "Mappa kizárása"
      },
      props: {
        path: "Elérési út",
        type: "Típus",
        close: "Bezárás"
      },
      toasts: {
        excluded: (a) => `A(z) ${a} kimarad a következő vizsgálatokból.`,
        alreadyExcluded: (a) => `A(z) ${a} már ki van zárva.`,
        excludeFailed: "A kizárást nem sikerült menteni."
      },
      saved: {
        title: "Mentett vizsgálatok",
        nameField: "A vizsgálat neve",
        save: "Jelenlegi vizsgálat mentése",
        saving: "Mentés…",
        saved: (a) => `A(z) "${a}" vizsgálat elmentve.`,
        nothingToSave: "Előbb vizsgáljon meg egy meghajtót, utána itt mentheti.",
        empty: "Még nincs mentett vizsgálat.",
        load: "Megnyitás",
        delete: "Törlés",
        deleteConfirm: (a) => `Véglegesen törli a(z) "${a}" elemet?`,
        selectForCompare: (a) => `${a} kijelölése összehasonlításhoz`,
        compare: "Kijelöltek összehasonlítása",
        pickTwo: "Válasszon ki két vizsgálatot az összehasonlításhoz.",
        partial: "Részleges",
        viewing: (a, b) => `A mentett "${a}" vizsgálatot látja (${b}). Ez nem a meghajtó jelenlegi állapota.`,
        closeView: "Vissza az élő vizsgálathoz",
        failed: (a) => `Mentett vizsgálatok: ${a}`
      },
      compare: {
        title: (a, b) => `"${a}" → "${b}"`,
        total: (a) => `Teljes változás: ${a}`,
        grew: "Legtöbbet nőtt",
        shrank: "Legtöbbet csökkent",
        added: "Új mappák",
        removed: "Eltávolított mappák",
        none: "Ebben a csoportban nincs semmi.",
        back: "Vissza a listához",
        loading: "Összehasonlítás…"
      },
      crawl: {
        note: "Egyesével olvassa be az összes mappát. Egy teljes meghajtó eltart egy ideig: az eredmények megjelennek, ahogy előkerülnek, és bármikor leállíthatja, megtartva az addig beolvasottakat.",
        limit: "Nem kér engedélyt. Egy teljes meghajtó sokkal tovább tart, mint a gyors vizsgálat, de az eredményeket menet közben látja, és bármikor leállíthatja.",
        partialNote: "A eddig beolvasottakat mutatja. A méretek a vizsgálat végéig tovább nőnek."
      }
    }
  },
  id: {
    diskMapV3: {
      large: {
        tooLarge: "Drive ini memiliki lebih banyak file daripada yang bisa ditampung Prune dalam satu pemindaian. Gunakan “undefined” untuk memindainya folder demi folder, atau kecualikan folder besar di Pengaturan.",
        foldedNote: (a, b) => `Setiap folder menampilkan ${a} file terbesarnya; ${b} file lainnya dijumlahkan dalam satu baris per folder. File-file itu tetap dihitung dalam semua total dan angka jenis file.`,
        foldedFloorNote: (a, b) => `Drive ini memiliki begitu banyak file sehingga hanya file berukuran ${b} atau lebih yang ditampilkan satu per satu; ${a} file lainnya dijumlahkan dalam satu baris per folder. File-file itu tetap dihitung dalam semua total dan angka jenis file.`
      },
      drives: {
        label: "Drive",
        system: "Sistem",
        removable: "Portabel",
        usage: (a, b) => `${a} dari ${b} terpakai`,
        scanned: "Dipindai",
        alsoScan: "Pindai juga drive ini",
        alsoScanNote: "Drive yang dipindai bersamaan berbagi satu permintaan administrator.",
        notNtfs: "Hanya drive NTFS yang dapat dipindai cepat.",
        failed: (a, b) => `Tidak dapat memindai ${a}: ${b}`
      },
      elevation: {
        runningAsAdmin: "Prune berjalan sebagai administrator, jadi pemindaian ini dimulai tanpa permintaan.",
        why: "Windows hanya mengizinkan administrator membaca indeks file drive secara langsung, dan itulah yang membuat pemindaian ini cepat.",
        restartHint: "Mulai ulang Prune sebagai administrator sekali, dan pemindaian cepat berikutnya tidak memerlukan permintaan.",
        restartButton: "Mulai ulang Prune sebagai administrator",
        restarting: "Memulai ulang…",
        restartDeclined: "Tidak disetujui — Prune tetap berjalan seperti sebelumnya.",
        restartFailed: (a) => `Tidak dapat memulai ulang sebagai administrator: ${a}`
      },
      columns: {
        allocated: "Dialokasikan",
        name: "Nama"
      },
      totals: {
        line: (a, b, c) => `${a} dihitung · ${b} di disk · ${c} terpakai pada volume`,
        lineNoVolume: (a, b) => `${a} dihitung · ${b} di disk`,
        hardLinkNote: (a) => `${a} file dengan beberapa nama dihitung sekali saja.`
      },
      filesView: {
        sortBy: "Urutkan menurut"
      },
      search: {
        label: "Cari nama",
        placeholder: "Teks, * ? atau /regex/",
        clear: "Hapus pencarian",
        invalid: "Pola itu tidak valid.",
        noMatches: (a) => `Tidak ada yang cocok dengan "${a}" di sini.`
      },
      export: {
        csv: "Ekspor CSV",
        png: "Simpan peta sebagai PNG",
        failed: (a) => `Gagal mengekspor: ${a}`,
        done: (a) => `Diekspor: ${a}`
      },
      menu: {
        properties: "Properti",
        exclude: "Kecualikan folder ini"
      },
      props: {
        path: "Jalur",
        type: "Jenis",
        close: "Tutup"
      },
      toasts: {
        excluded: (a) => `${a} akan dilewati pada pemindaian berikutnya.`,
        alreadyExcluded: (a) => `${a} sudah dikecualikan.`,
        excludeFailed: "Tidak dapat menyimpan pengecualian itu."
      },
      saved: {
        title: "Pemindaian tersimpan",
        nameField: "Nama untuk pemindaian ini",
        save: "Simpan pemindaian saat ini",
        saving: "Menyimpan…",
        saved: (a) => `Pemindaian "${a}" disimpan.`,
        nothingToSave: "Pindai drive terlebih dahulu, lalu Anda dapat menyimpannya di sini.",
        empty: "Belum ada pemindaian tersimpan.",
        load: "Buka",
        delete: "Hapus",
        deleteConfirm: (a) => `Hapus "${a}" secara permanen?`,
        selectForCompare: (a) => `Pilih ${a} untuk dibandingkan`,
        compare: "Bandingkan yang dipilih",
        pickTwo: "Pilih dua pemindaian untuk dibandingkan.",
        partial: "Sebagian",
        viewing: (a, b) => `Anda melihat pemindaian tersimpan "${a}" dari ${b}. Ini bukan kondisi drive saat ini.`,
        closeView: "Kembali ke pemindaian langsung",
        failed: (a) => `Pemindaian tersimpan: ${a}`
      },
      compare: {
        title: (a, b) => `Dari "${a}" ke "${b}"`,
        total: (a) => `Perubahan total: ${a}`,
        grew: "Paling bertambah",
        shrank: "Paling berkurang",
        added: "Folder baru",
        removed: "Folder dihapus",
        none: "Tidak ada apa pun di grup ini.",
        back: "Kembali ke daftar",
        loading: "Membandingkan…"
      },
      crawl: {
        note: "Membaca setiap folder, satu per satu. Satu drive penuh butuh waktu: hasil muncul saat ditemukan, dan Anda dapat berhenti kapan saja serta menyimpan yang sudah dibaca.",
        limit: "Tidak memerlukan izin. Satu drive penuh jauh lebih lama daripada pemindaian cepat, tetapi hasil terlihat saat tiba dan Anda dapat berhenti kapan saja.",
        partialNote: "Menampilkan yang sudah dibaca sejauh ini. Ukuran terus bertambah hingga pemindaian selesai."
      }
    }
  },
  is: {
    diskMapV3: {
      large: {
        tooLarge: "Drifið inniheldur fleiri skrár en Prune getur haldið utan um í einni skönnun. Notaðu „undefined“ til að skanna það eina möppu í einu, eða útilokaðu stórar möppur í Stillingum.",
        foldedNote: (a, b) => `Hver mappa sýnir ${a} stærstu skrárnar sínar; hinar ${b} skrárnar eru lagðar saman í eina línu fyrir hverja möppu. Þær teljast enn með í öllum heildartölum og tölum eftir skráartegund.`,
        foldedFloorNote: (a, b) => `Þetta drif inniheldur svo margar skrár að aðeins skrár sem eru ${b} eða stærri eru sýndar hver fyrir sig; hinar ${a} skrárnar eru lagðar saman í eina línu fyrir hverja möppu. Þær teljast enn með í öllum heildartölum og tölum eftir skráartegund.`
      },
      drives: {
        label: "Drif",
        system: "Kerfi",
        removable: "Færanlegt",
        usage: (a, b) => `${a} af ${b} notuð`,
        scanned: "Skannað",
        alsoScan: "Skanna líka þessi drif",
        alsoScanNote: "Drif sem eru skönnuð saman deila einni kerfisstjórabeiðni.",
        notNtfs: "Aðeins er hægt að hraðskanna NTFS-drif.",
        failed: (a, b) => `Ekki tókst að skanna ${a}: ${b}`
      },
      elevation: {
        runningAsAdmin: "Prune keyrir sem kerfisstjóri, þannig að þessi skönnun hefst án beiðni.",
        why: "Windows leyfir aðeins kerfisstjórum að lesa skráaskrá drifs beint, og það er það sem gerir þessa skönnun hraða.",
        restartHint: "Endurræstu Prune einu sinni sem kerfisstjóri og síðari hraðskannanir þurfa enga beiðni.",
        restartButton: "Endurræsa Prune sem kerfisstjóri",
        restarting: "Endurræsir…",
        restartDeclined: "Ekki samþykkt — Prune keyrir áfram eins og áður.",
        restartFailed: (a) => `Ekki tókst að endurræsa sem kerfisstjóri: ${a}`
      },
      columns: {
        allocated: "Úthlutað",
        name: "Heiti"
      },
      totals: {
        line: (a, b, c) => `${a} talið · ${b} á disknum · ${c} í notkun á bindinu`,
        lineNoVolume: (a, b) => `${a} talið · ${b} á disknum`,
        hardLinkNote: (a) => `${a} skrár með mörg nöfn eru aðeins talin einu sinni.`
      },
      filesView: {
        sortBy: "Raða eftir"
      },
      search: {
        label: "Leita að heitum",
        placeholder: "Texti, * ? eða /regex/",
        clear: "Hreinsa leit",
        invalid: "Þetta mynstur er ekki gilt.",
        noMatches: (a) => `Ekkert hér passar við "${a}".`
      },
      export: {
        csv: "Flytja út CSV",
        png: "Vista kort sem PNG",
        failed: (a) => `Útflutningur mistókst: ${a}`,
        done: (a) => `Flutt út: ${a}`
      },
      menu: {
        properties: "Eiginleikar",
        exclude: "Útiloka þessa möppu"
      },
      props: {
        path: "Slóð",
        type: "Gerð",
        close: "Loka"
      },
      toasts: {
        excluded: (a) => `${a} verður sleppt í framtíðarskönnunum.`,
        alreadyExcluded: (a) => `${a} er þegar útilokað.`,
        excludeFailed: "Ekki tókst að vista þessa útilokun."
      },
      saved: {
        title: "Vistaðar skannanir",
        nameField: "Nafn á þessari skönnun",
        save: "Vista núverandi skönnun",
        saving: "Vistar…",
        saved: (a) => `Skönnunin "${a}" var vistuð.`,
        nothingToSave: "Skannaðu fyrst drif, þá geturðu vistað það hér.",
        empty: "Engar vistaðar skannanir enn.",
        load: "Opna",
        delete: "Eyða",
        deleteConfirm: (a) => `Eyða "${a}" fyrir fullt og allt?`,
        selectForCompare: (a) => `Velja ${a} til samanburðar`,
        compare: "Bera saman valið",
        pickTwo: "Veldu tvær skannanir til að bera saman.",
        partial: "Að hluta",
        viewing: (a, b) => `Þú ert að skoða vistuðu skönnunina "${a}" frá ${b}. Þetta er ekki drifið eins og það er núna.`,
        closeView: "Aftur í núverandi skönnun",
        failed: (a) => `Vistaðar skannanir: ${a}`
      },
      compare: {
        title: (a, b) => `Frá "${a}" til "${b}"`,
        total: (a) => `Heildarbreyting: ${a}`,
        grew: "Stækkaði mest",
        shrank: "Minnkaði mest",
        added: "Nýjar möppur",
        removed: "Fjarlægðar möppur",
        none: "Ekkert í þessum hópi.",
        back: "Aftur á listann",
        loading: "Ber saman…"
      },
      crawl: {
        note: "Les hverja möppu, eina í einu. Heilt drif tekur tíma: niðurstöður birtast jafnóðum og þú getur stöðvað hvenær sem er og haldið því sem var lesið.",
        limit: "Krefst einskis leyfis. Heilt drif tekur mun lengri tíma en hraðskönnun, en þú sérð niðurstöður jafnóðum og getur stöðvað hvenær sem þú vilt.",
        partialNote: "Sýnir það sem hefur verið lesið hingað til. Stærðir halda áfram að vaxa þar til skönnuninni lýkur."
      }
    }
  },
  it: {
    diskMapV3: {
      large: {
        tooLarge: "L’unità contiene più file di quanti Prune ne possa gestire in una sola scansione. Usa “undefined” per analizzarla cartella per cartella, oppure escludi le cartelle grandi dalle Impostazioni.",
        foldedNote: (a, b) => `Ogni cartella elenca i suoi ${a} file più grandi; gli altri ${b} file sono sommati in un’unica riga per cartella. Continuano a contare in tutti i totali e nelle cifre per tipo di file.`,
        foldedFloorNote: (a, b) => `Questa unità contiene così tanti file che solo quelli di ${b} o più sono elencati singolarmente; gli altri ${a} file sono sommati in un’unica riga per cartella. Continuano a contare in tutti i totali e nelle cifre per tipo di file.`
      },
      drives: {
        label: "Unità",
        system: "Sistema",
        removable: "Rimovibile",
        usage: (a, b) => `${a} usati su ${b}`,
        scanned: "Scansionato",
        alsoScan: "Scansiona anche queste unità",
        alsoScanNote: "Le unità scansionate insieme condividono una sola richiesta di amministratore.",
        notNtfs: "Solo le unità NTFS supportano la scansione rapida.",
        failed: (a, b) => `Impossibile scansionare ${a}: ${b}`
      },
      elevation: {
        runningAsAdmin: "Prune è in esecuzione come amministratore, quindi questa scansione parte senza richieste.",
        why: "Windows consente solo agli amministratori di leggere direttamente l’indice dei file di un’unità, ed è ciò che rende rapida questa scansione.",
        restartHint: "Riavvia Prune come amministratore una volta e le scansioni rapide successive non richiederanno alcuna conferma.",
        restartButton: "Riavvia Prune come amministratore",
        restarting: "Riavvio…",
        restartDeclined: "Non approvato: Prune continua a funzionare come prima.",
        restartFailed: (a) => `Impossibile riavviare come amministratore: ${a}`
      },
      columns: {
        allocated: "Allocato",
        name: "Nome"
      },
      totals: {
        line: (a, b, c) => `${a} conteggiati · ${b} su disco · ${c} in uso sul volume`,
        lineNoVolume: (a, b) => `${a} conteggiati · ${b} su disco`,
        hardLinkNote: (a) => `${a} file con più nomi vengono conteggiati una sola volta.`
      },
      filesView: {
        sortBy: "Ordina per"
      },
      search: {
        label: "Cerca nei nomi",
        placeholder: "Testo, * ? o /regex/",
        clear: "Cancella ricerca",
        invalid: "Questo schema non è valido.",
        noMatches: (a) => `Nulla qui corrisponde a "${a}".`
      },
      export: {
        csv: "Esporta CSV",
        png: "Salva la mappa come PNG",
        failed: (a) => `Esportazione non riuscita: ${a}`,
        done: (a) => `Esportato: ${a}`
      },
      menu: {
        properties: "Proprietà",
        exclude: "Escludi questa cartella"
      },
      props: {
        path: "Percorso",
        type: "Tipo",
        close: "Chiudi"
      },
      toasts: {
        excluded: (a) => `${a} verrà ignorata nelle prossime scansioni.`,
        alreadyExcluded: (a) => `${a} è già esclusa.`,
        excludeFailed: "Impossibile salvare l’esclusione."
      },
      saved: {
        title: "Scansioni salvate",
        nameField: "Nome di questa scansione",
        save: "Salva la scansione corrente",
        saving: "Salvataggio…",
        saved: (a) => `Scansione "${a}" salvata.`,
        nothingToSave: "Scansiona prima un’unità, poi potrai salvarla qui.",
        empty: "Nessuna scansione salvata finora.",
        load: "Apri",
        delete: "Elimina",
        deleteConfirm: (a) => `Eliminare definitivamente "${a}"?`,
        selectForCompare: (a) => `Seleziona ${a} per confrontare`,
        compare: "Confronta selezione",
        pickTwo: "Scegli due scansioni da confrontare.",
        partial: "Parziale",
        viewing: (a, b) => `Stai visualizzando la scansione salvata "${a}" del ${b}. Non è lo stato attuale dell’unità.`,
        closeView: "Torna alla scansione corrente",
        failed: (a) => `Scansioni salvate: ${a}`
      },
      compare: {
        title: (a, b) => `Da "${a}" a "${b}"`,
        total: (a) => `Variazione totale: ${a}`,
        grew: "Cresciute di più",
        shrank: "Diminuite di più",
        added: "Cartelle nuove",
        removed: "Cartelle rimosse",
        none: "Niente in questo gruppo.",
        back: "Torna all’elenco",
        loading: "Confronto…"
      },
      crawl: {
        note: "Legge ogni cartella, una alla volta. Un’unità intera richiede un po’ di tempo: i risultati compaiono man mano e puoi fermarti in qualsiasi momento conservando quanto letto.",
        limit: "Non richiede autorizzazioni. Un’unità intera richiede molto più tempo della scansione rapida, ma vedi i risultati man mano che arrivano e puoi fermarti quando vuoi.",
        partialNote: "Mostra quanto letto finora. Le dimensioni continuano a crescere fino al termine della scansione."
      }
    }
  },
  ja: {
    diskMapV3: {
      large: {
        tooLarge: "このドライブには、Prune が1回のスキャンで扱える数を超えるファイルがあります。「undefined」でフォルダーごとにスキャンするか、設定で大きなフォルダーを除外してください。",
        foldedNote: (a, b) => `各フォルダーには大きい順に ${a} 個のファイルを表示し、残りの ${b} 個のファイルはフォルダーごとに1行にまとめています。すべての合計とファイルの種類別の数値には引き続き含まれます。`,
        foldedFloorNote: (a, b) => `このドライブはファイル数が非常に多いため、${b} 以上のファイルのみ個別に表示しています。残りの ${a} 個のファイルはフォルダーごとに1行にまとめています。すべての合計とファイルの種類別の数値には引き続き含まれます。`
      },
      drives: {
        label: "ドライブ",
        system: "システム",
        removable: "リムーバブル",
        usage: (a, b) => `${b} 中 ${a} 使用中`,
        scanned: "スキャン済み",
        alsoScan: "これらのドライブもスキャン",
        alsoScanNote: "まとめてスキャンしたドライブは、管理者の確認が1回で済みます。",
        notNtfs: "高速スキャンできるのは NTFS ドライブだけです。",
        failed: (a, b) => `${a} をスキャンできませんでした: ${b}`
      },
      elevation: {
        runningAsAdmin: "Prune は管理者として実行されているため、このスキャンは確認なしで始まります。",
        why: "Windows では、ドライブのファイルインデックスを直接読み取れるのは管理者だけです。これがこのスキャンを高速にしています。",
        restartHint: "Prune を一度管理者として再起動すれば、以降の高速スキャンでは確認が不要になります。",
        restartButton: "Prune を管理者として再起動",
        restarting: "再起動しています…",
        restartDeclined: "承認されませんでした。Prune はこれまでどおり実行されています。",
        restartFailed: (a) => `管理者として再起動できませんでした: ${a}`
      },
      columns: {
        allocated: "割り当て済み",
        name: "名前"
      },
      totals: {
        line: (a, b, c) => `カウント ${a} · ディスク上 ${b} · ボリューム使用中 ${c}`,
        lineNoVolume: (a, b) => `カウント ${a} · ディスク上 ${b}`,
        hardLinkNote: (a) => `複数の名前を持つ ${a} 個のファイルは 1 回だけ数えています。`
      },
      filesView: {
        sortBy: "並べ替え"
      },
      search: {
        label: "名前を検索",
        placeholder: "テキスト、* ?、または /regex/",
        clear: "検索をクリア",
        invalid: "このパターンは無効です。",
        noMatches: (a) => `ここには "${a}" に一致するものがありません。`
      },
      export: {
        csv: "CSV を書き出し",
        png: "マップを PNG で保存",
        failed: (a) => `書き出せませんでした: ${a}`,
        done: (a) => `書き出しました: ${a}`
      },
      menu: {
        properties: "プロパティ",
        exclude: "このフォルダーを除外"
      },
      props: {
        path: "パス",
        type: "種類",
        close: "閉じる"
      },
      toasts: {
        excluded: (a) => `${a} は今後のスキャンでスキップされます。`,
        alreadyExcluded: (a) => `${a} はすでに除外されています。`,
        excludeFailed: "除外を保存できませんでした。"
      },
      saved: {
        title: "保存したスキャン",
        nameField: "このスキャンの名前",
        save: "現在のスキャンを保存",
        saving: "保存しています…",
        saved: (a) => `スキャン "${a}" を保存しました。`,
        nothingToSave: "先にドライブをスキャンすると、ここに保存できます。",
        empty: "保存したスキャンはまだありません。",
        load: "開く",
        delete: "削除",
        deleteConfirm: (a) => `"${a}" を完全に削除しますか？`,
        selectForCompare: (a) => `比較する ${a} を選択`,
        compare: "選択したものを比較",
        pickTwo: "比較するスキャンを 2 つ選んでください。",
        partial: "一部のみ",
        viewing: (a, b) => `${b} に保存したスキャン "${a}" を表示しています。ドライブの現在の状態ではありません。`,
        closeView: "現在のスキャンに戻る",
        failed: (a) => `保存したスキャン: ${a}`
      },
      compare: {
        title: (a, b) => `"${a}" から "${b}" へ`,
        total: (a) => `合計の変化: ${a}`,
        grew: "最も増加",
        shrank: "最も減少",
        added: "新しいフォルダー",
        removed: "削除されたフォルダー",
        none: "このグループには何もありません。",
        back: "一覧に戻る",
        loading: "比較しています…"
      },
      crawl: {
        note: "フォルダーを 1 つずつ読み取ります。ドライブ全体には時間がかかりますが、結果は見つかるたびに表示され、いつでも停止して読み取り済みの内容を残せます。",
        limit: "権限は不要です。ドライブ全体は高速スキャンよりずっと時間がかかりますが、結果は届いた順に表示され、好きなときに停止できます。",
        partialNote: "ここまでに読み取った内容を表示しています。サイズはスキャンが終わるまで増え続けます。"
      }
    }
  },
  ko: {
    diskMapV3: {
      large: {
        tooLarge: "이 드라이브에는 Prune이 한 번의 검사로 처리할 수 있는 것보다 많은 파일이 있습니다. “undefined”을(를) 사용해 폴더 단위로 검사하거나, 설정에서 큰 폴더를 제외하세요.",
        foldedNote: (a, b) => `각 폴더에는 가장 큰 ${a}개의 파일을 표시하고, 나머지 ${b}개의 파일은 폴더당 한 줄로 합산합니다. 모든 합계와 파일 형식별 수치에는 그대로 포함됩니다.`,
        foldedFloorNote: (a, b) => `이 드라이브는 파일이 매우 많아 ${b} 이상인 파일만 개별로 표시합니다. 나머지 ${a}개의 파일은 폴더당 한 줄로 합산합니다. 모든 합계와 파일 형식별 수치에는 그대로 포함됩니다.`
      },
      drives: {
        label: "드라이브",
        system: "시스템",
        removable: "이동식",
        usage: (a, b) => `${b} 중 ${a} 사용 중`,
        scanned: "검사됨",
        alsoScan: "이 드라이브도 검사",
        alsoScanNote: "함께 검사하는 드라이브는 관리자 승인 요청을 한 번만 거칩니다.",
        notNtfs: "빠른 검사는 NTFS 드라이브에서만 사용할 수 있습니다.",
        failed: (a, b) => `${a}을(를) 검사할 수 없습니다: ${b}`
      },
      elevation: {
        runningAsAdmin: "Prune이 관리자 권한으로 실행 중이므로 이 검사는 승인 요청 없이 시작됩니다.",
        why: "Windows에서는 관리자만 드라이브의 파일 인덱스를 직접 읽을 수 있으며, 이것이 이 검사를 빠르게 만듭니다.",
        restartHint: "Prune을 관리자 권한으로 한 번 다시 시작하면 이후 빠른 검사에는 승인 요청이 필요 없습니다.",
        restartButton: "Prune을 관리자 권한으로 다시 시작",
        restarting: "다시 시작하는 중…",
        restartDeclined: "승인되지 않았습니다. Prune은 이전과 같이 계속 실행 중입니다.",
        restartFailed: (a) => `관리자 권한으로 다시 시작할 수 없습니다: ${a}`
      },
      columns: {
        allocated: "할당됨",
        name: "이름"
      },
      totals: {
        line: (a, b, c) => `집계 ${a} · 디스크 ${b} · 볼륨 사용 중 ${c}`,
        lineNoVolume: (a, b) => `집계 ${a} · 디스크 ${b}`,
        hardLinkNote: (a) => `이름이 여러 개인 파일 ${a}개는 한 번만 집계됩니다.`
      },
      filesView: {
        sortBy: "정렬 기준"
      },
      search: {
        label: "이름 검색",
        placeholder: "텍스트, * ? 또는 /regex/",
        clear: "검색 지우기",
        invalid: "이 패턴은 올바르지 않습니다.",
        noMatches: (a) => `여기에는 "${a}"와(과) 일치하는 항목이 없습니다.`
      },
      export: {
        csv: "CSV 내보내기",
        png: "맵을 PNG로 저장",
        failed: (a) => `내보낼 수 없습니다: ${a}`,
        done: (a) => `내보냄: ${a}`
      },
      menu: {
        properties: "속성",
        exclude: "이 폴더 제외"
      },
      props: {
        path: "경로",
        type: "형식",
        close: "닫기"
      },
      toasts: {
        excluded: (a) => `${a}은(는) 이후 검사에서 건너뜁니다.`,
        alreadyExcluded: (a) => `${a}은(는) 이미 제외되었습니다.`,
        excludeFailed: "제외 항목을 저장할 수 없습니다."
      },
      saved: {
        title: "저장된 검사",
        nameField: "이 검사의 이름",
        save: "현재 검사 저장",
        saving: "저장하는 중…",
        saved: (a) => `검사 "${a}"을(를) 저장했습니다.`,
        nothingToSave: "먼저 드라이브를 검사하면 여기에 저장할 수 있습니다.",
        empty: "저장된 검사가 아직 없습니다.",
        load: "열기",
        delete: "삭제",
        deleteConfirm: (a) => `"${a}"을(를) 완전히 삭제할까요?`,
        selectForCompare: (a) => `비교할 ${a} 선택`,
        compare: "선택 항목 비교",
        pickTwo: "비교할 검사를 두 개 선택하세요.",
        partial: "부분",
        viewing: (a, b) => `${b}에 저장된 검사 "${a}"을(를) 보고 있습니다. 드라이브의 현재 상태가 아닙니다.`,
        closeView: "현재 검사로 돌아가기",
        failed: (a) => `저장된 검사: ${a}`
      },
      compare: {
        title: (a, b) => `"${a}"에서 "${b}"(으)로`,
        total: (a) => `전체 변화: ${a}`,
        grew: "가장 많이 늘어남",
        shrank: "가장 많이 줄어듦",
        added: "새 폴더",
        removed: "삭제된 폴더",
        none: "이 그룹에는 항목이 없습니다.",
        back: "목록으로 돌아가기",
        loading: "비교하는 중…"
      },
      crawl: {
        note: "폴더를 하나씩 읽습니다. 드라이브 전체는 시간이 걸리지만 결과는 찾는 대로 표시되며, 언제든 중지하고 읽은 내용을 유지할 수 있습니다.",
        limit: "권한이 필요 없습니다. 드라이브 전체는 빠른 검사보다 훨씬 오래 걸리지만 결과가 도착하는 대로 표시되며 원할 때 언제든 중지할 수 있습니다.",
        partialNote: "지금까지 읽은 내용을 표시하고 있습니다. 검사가 끝날 때까지 크기가 계속 늘어납니다."
      }
    }
  },
  lt: {
    diskMapV3: {
      large: {
        tooLarge: "Diske yra daugiau failų, nei „Prune“ gali apdoroti per vieną nuskaitymą. Naudokite „undefined“, kad nuskaitytumėte aplankas po aplanko, arba nustatymuose neįtraukite didelių aplankų.",
        foldedNote: (a, b) => `Kiekvienas aplankas rodo ${a} didžiausių savo failų; likę ${b} failų sudėti į vieną eilutę kiekvienam aplankui. Jie vis tiek įskaičiuojami į visas sumas ir failų tipų skaičius.`,
        foldedFloorNote: (a, b) => `Šiame diske tiek daug failų, kad pavieniui rodomi tik ${b} ar didesni failai; likę ${a} failų sudėti į vieną eilutę kiekvienam aplankui. Jie vis tiek įskaičiuojami į visas sumas ir failų tipų skaičius.`
      },
      drives: {
        label: "Diskai",
        system: "Sistemos",
        removable: "Keičiamas",
        usage: (a, b) => `Naudojama ${a} iš ${b}`,
        scanned: "Nuskaityta",
        alsoScan: "Taip pat nuskaityti šiuos diskus",
        alsoScanNote: "Kartu nuskaitomi diskai dalijasi vienu administratoriaus patvirtinimu.",
        notNtfs: "Greituoju būdu galima nuskaityti tik NTFS diskus.",
        failed: (a, b) => `Nepavyko nuskaityti ${a}: ${b}`
      },
      elevation: {
        runningAsAdmin: "„Prune“ veikia kaip administratorius, todėl šis nuskaitymas prasideda be patvirtinimo.",
        why: "„Windows“ tiesiogiai skaityti disko failų rodyklę leidžia tik administratoriams – būtent tai pagreitina šį nuskaitymą.",
        restartHint: "Vieną kartą iš naujo paleiskite „Prune“ kaip administratorių, ir vėlesniems greitiesiems nuskaitymams patvirtinimo nebereikės.",
        restartButton: "Iš naujo paleisti „Prune“ kaip administratorių",
        restarting: "Paleidžiama iš naujo…",
        restartDeclined: "Nepatvirtinta — „Prune“ ir toliau veikia kaip anksčiau.",
        restartFailed: (a) => `Nepavyko paleisti iš naujo kaip administratoriaus: ${a}`
      },
      columns: {
        allocated: "Priskirta",
        name: "Pavadinimas"
      },
      totals: {
        line: (a, b, c) => `${a} suskaičiuota · ${b} diske · ${c} naudojama tome`,
        lineNoVolume: (a, b) => `${a} suskaičiuota · ${b} diske`,
        hardLinkNote: (a) => `${a} failai su keliais pavadinimais skaičiuojami tik vieną kartą.`
      },
      filesView: {
        sortBy: "Rikiuoti pagal"
      },
      search: {
        label: "Ieškoti pavadinimų",
        placeholder: "Tekstas, * ? arba /regex/",
        clear: "Išvalyti paiešką",
        invalid: "Šis šablonas netinkamas.",
        noMatches: (a) => `Čia nieko, kas atitiktų "${a}".`
      },
      export: {
        csv: "Eksportuoti CSV",
        png: "Įrašyti žemėlapį kaip PNG",
        failed: (a) => `Eksportuoti nepavyko: ${a}`,
        done: (a) => `Eksportuota: ${a}`
      },
      menu: {
        properties: "Ypatybės",
        exclude: "Neįtraukti šio aplanko"
      },
      props: {
        path: "Kelias",
        type: "Tipas",
        close: "Uždaryti"
      },
      toasts: {
        excluded: (a) => `${a} bus praleista būsimuose nuskaitymuose.`,
        alreadyExcluded: (a) => `${a} jau neįtraukta.`,
        excludeFailed: "Nepavyko išsaugoti šios išimties."
      },
      saved: {
        title: "Įrašyti nuskaitymai",
        nameField: "Šio nuskaitymo pavadinimas",
        save: "Įrašyti dabartinį nuskaitymą",
        saving: "Įrašoma…",
        saved: (a) => `Nuskaitymas "${a}" įrašytas.`,
        nothingToSave: "Pirmiausia nuskaitykite diską, tada galėsite jį čia įrašyti.",
        empty: "Įrašytų nuskaitymų dar nėra.",
        load: "Atverti",
        delete: "Ištrinti",
        deleteConfirm: (a) => `Ištrinti "${a}" visam laikui?`,
        selectForCompare: (a) => `Pasirinkti ${a} palyginimui`,
        compare: "Palyginti pasirinktus",
        pickTwo: "Pasirinkite du nuskaitymus palyginimui.",
        partial: "Dalinis",
        viewing: (a, b) => `Žiūrite įrašytą nuskaitymą "${a}" iš ${b}. Tai ne dabartinė disko būsena.`,
        closeView: "Grįžti prie dabartinio nuskaitymo",
        failed: (a) => `Įrašyti nuskaitymai: ${a}`
      },
      compare: {
        title: (a, b) => `Nuo "${a}" iki "${b}"`,
        total: (a) => `Bendras pokytis: ${a}`,
        grew: "Labiausiai išaugo",
        shrank: "Labiausiai sumažėjo",
        added: "Nauji aplankai",
        removed: "Pašalinti aplankai",
        none: "Šioje grupėje nieko nėra.",
        back: "Grįžti į sąrašą",
        loading: "Lyginama…"
      },
      crawl: {
        note: "Skaito kiekvieną aplanką po vieną. Visas diskas užtrunka: rezultatai rodomi, kai randami, o sustabdyti galite bet kada, išsaugodami perskaitytą dalį.",
        limit: "Leidimo nereikia. Visas diskas užtrunka daug ilgiau nei greitasis nuskaitymas, bet rezultatus matote iškart ir galite sustabdyti, kada norite.",
        partialNote: "Rodoma tai, kas perskaityta iki šiol. Dydžiai auga, kol nuskaitymas baigsis."
      }
    }
  },
  ms: {
    diskMapV3: {
      large: {
        tooLarge: "Pemacu ini mempunyai lebih banyak fail daripada yang boleh dikendalikan Prune dalam satu imbasan. Gunakan “undefined” untuk mengimbasnya folder demi folder, atau kecualikan folder besar dalam Tetapan.",
        foldedNote: (a, b) => `Setiap folder menyenaraikan ${a} fail terbesarnya; ${b} fail lain dijumlahkan dalam satu baris setiap folder. Fail-fail itu masih dikira dalam semua jumlah dan angka jenis fail.`,
        foldedFloorNote: (a, b) => `Pemacu ini mempunyai begitu banyak fail sehingga hanya fail bersaiz ${b} atau lebih disenaraikan satu persatu; ${a} fail lain dijumlahkan dalam satu baris setiap folder. Fail-fail itu masih dikira dalam semua jumlah dan angka jenis fail.`
      },
      drives: {
        label: "Pemacu",
        system: "Sistem",
        removable: "Boleh alih keluar",
        usage: (a, b) => `${a} daripada ${b} digunakan`,
        scanned: "Diimbas",
        alsoScan: "Imbas pemacu ini juga",
        alsoScanNote: "Pemacu yang diimbas bersama berkongsi satu gesaan pentadbir.",
        notNtfs: "Hanya pemacu NTFS yang boleh diimbas dengan pantas.",
        failed: (a, b) => `Tidak dapat mengimbas ${a}: ${b}`
      },
      elevation: {
        runningAsAdmin: "Prune dijalankan sebagai pentadbir, jadi imbasan ini bermula tanpa gesaan.",
        why: "Windows hanya membenarkan pentadbir membaca indeks fail pemacu secara terus, dan itulah yang menjadikan imbasan ini pantas.",
        restartHint: "Mulakan semula Prune sebagai pentadbir sekali dan imbasan pantas seterusnya tidak memerlukan gesaan.",
        restartButton: "Mulakan semula Prune sebagai pentadbir",
        restarting: "Memulakan semula…",
        restartDeclined: "Tidak diluluskan — Prune masih berjalan seperti sebelumnya.",
        restartFailed: (a) => `Tidak dapat memulakan semula sebagai pentadbir: ${a}`
      },
      columns: {
        allocated: "Diperuntukkan",
        name: "Nama"
      },
      totals: {
        line: (a, b, c) => `${a} dikira · ${b} pada cakera · ${c} digunakan pada volum`,
        lineNoVolume: (a, b) => `${a} dikira · ${b} pada cakera`,
        hardLinkNote: (a) => `${a} fail dengan beberapa nama dikira sekali sahaja.`
      },
      filesView: {
        sortBy: "Isih mengikut"
      },
      search: {
        label: "Cari nama",
        placeholder: "Teks, * ? atau /regex/",
        clear: "Kosongkan carian",
        invalid: "Corak itu tidak sah.",
        noMatches: (a) => `Tiada yang sepadan dengan "${a}" di sini.`
      },
      export: {
        csv: "Eksport CSV",
        png: "Simpan peta sebagai PNG",
        failed: (a) => `Eksport gagal: ${a}`,
        done: (a) => `Dieksport: ${a}`
      },
      menu: {
        properties: "Sifat",
        exclude: "Kecualikan folder ini"
      },
      props: {
        path: "Laluan",
        type: "Jenis",
        close: "Tutup"
      },
      toasts: {
        excluded: (a) => `${a} akan dilangkau dalam imbasan akan datang.`,
        alreadyExcluded: (a) => `${a} sudah dikecualikan.`,
        excludeFailed: "Tidak dapat menyimpan pengecualian itu."
      },
      saved: {
        title: "Imbasan tersimpan",
        nameField: "Nama untuk imbasan ini",
        save: "Simpan imbasan semasa",
        saving: "Menyimpan…",
        saved: (a) => `Imbasan "${a}" disimpan.`,
        nothingToSave: "Imbas pemacu dahulu, kemudian anda boleh menyimpannya di sini.",
        empty: "Belum ada imbasan tersimpan.",
        load: "Buka",
        delete: "Padam",
        deleteConfirm: (a) => `Padam "${a}" selama-lamanya?`,
        selectForCompare: (a) => `Pilih ${a} untuk dibandingkan`,
        compare: "Bandingkan yang dipilih",
        pickTwo: "Pilih dua imbasan untuk dibandingkan.",
        partial: "Separa",
        viewing: (a, b) => `Anda melihat imbasan tersimpan "${a}" dari ${b}. Ini bukan keadaan pemacu sekarang.`,
        closeView: "Kembali ke imbasan semasa",
        failed: (a) => `Imbasan tersimpan: ${a}`
      },
      compare: {
        title: (a, b) => `Daripada "${a}" kepada "${b}"`,
        total: (a) => `Jumlah perubahan: ${a}`,
        grew: "Paling bertambah",
        shrank: "Paling berkurang",
        added: "Folder baharu",
        removed: "Folder dialih keluar",
        none: "Tiada apa-apa dalam kumpulan ini.",
        back: "Kembali ke senarai",
        loading: "Membandingkan…"
      },
      crawl: {
        note: "Membaca setiap folder, satu demi satu. Seluruh pemacu mengambil masa: hasil muncul semasa ditemui, dan anda boleh berhenti bila-bila masa serta mengekalkan yang telah dibaca.",
        limit: "Tidak memerlukan kebenaran. Seluruh pemacu mengambil masa jauh lebih lama daripada imbasan pantas, tetapi anda melihat hasil semasa ia tiba dan boleh berhenti bila-bila masa.",
        partialNote: "Memaparkan yang telah dibaca setakat ini. Saiz terus bertambah sehingga imbasan selesai."
      }
    }
  },
  nb: {
    diskMapV3: {
      large: {
        tooLarge: "Stasjonen har flere filer enn Prune kan håndtere i én skanning. Bruk «undefined» for å skanne den mappe for mappe, eller ekskluder store mapper i Innstillinger.",
        foldedNote: (a, b) => `Hver mappe viser de ${a} største filene sine; de øvrige ${b} filene er slått sammen i én rad per mappe. De teller fortsatt med i alle summer og i filtypetallene.`,
        foldedFloorNote: (a, b) => `Denne stasjonen har så mange filer at bare filer på ${b} eller større vises enkeltvis; de øvrige ${a} filene er slått sammen i én rad per mappe. De teller fortsatt med i alle summer og i filtypetallene.`
      },
      drives: {
        label: "Stasjoner",
        system: "System",
        removable: "Flyttbar",
        usage: (a, b) => `${a} av ${b} brukt`,
        scanned: "Skannet",
        alsoScan: "Skann også disse stasjonene",
        alsoScanNote: "Stasjoner som skannes sammen, deler én administratorforespørsel.",
        notNtfs: "Bare NTFS-stasjoner kan hurtigskannes.",
        failed: (a, b) => `Kunne ikke skanne ${a}: ${b}`
      },
      elevation: {
        runningAsAdmin: "Prune kjører som administrator, så denne skanningen starter uten forespørsel.",
        why: "Windows lar bare administratorer lese en stasjons filindeks direkte, og det er det som gjør denne skanningen rask.",
        restartHint: "Start Prune på nytt som administrator én gang, så trenger senere hurtigskanninger ingen forespørsel.",
        restartButton: "Start Prune på nytt som administrator",
        restarting: "Starter på nytt…",
        restartDeclined: "Ikke godkjent — Prune kjører fortsatt som før.",
        restartFailed: (a) => `Kunne ikke starte på nytt som administrator: ${a}`
      },
      columns: {
        allocated: "Allokert",
        name: "Navn"
      },
      totals: {
        line: (a, b, c) => `${a} talt · ${b} på disken · ${c} i bruk på volumet`,
        lineNoVolume: (a, b) => `${a} talt · ${b} på disken`,
        hardLinkNote: (a) => `${a} filer med flere navn telles bare én gang.`
      },
      filesView: {
        sortBy: "Sorter etter"
      },
      search: {
        label: "Søk i navn",
        placeholder: "Tekst, * ? eller /regex/",
        clear: "Tøm søk",
        invalid: "Det mønsteret er ikke gyldig.",
        noMatches: (a) => `Ingenting her samsvarer med "${a}".`
      },
      export: {
        csv: "Eksporter CSV",
        png: "Lagre kartet som PNG",
        failed: (a) => `Eksport mislyktes: ${a}`,
        done: (a) => `Eksportert: ${a}`
      },
      menu: {
        properties: "Egenskaper",
        exclude: "Ekskluder denne mappen"
      },
      props: {
        path: "Sti",
        type: "Type",
        close: "Lukk"
      },
      toasts: {
        excluded: (a) => `${a} hoppes over i fremtidige skanninger.`,
        alreadyExcluded: (a) => `${a} er allerede ekskludert.`,
        excludeFailed: "Kunne ikke lagre ekskluderingen."
      },
      saved: {
        title: "Lagrede skanninger",
        nameField: "Navn på denne skanningen",
        save: "Lagre gjeldende skanning",
        saving: "Lagrer…",
        saved: (a) => `Skanningen "${a}" er lagret.`,
        nothingToSave: "Skann en stasjon først, så kan du lagre den her.",
        empty: "Ingen lagrede skanninger ennå.",
        load: "Åpne",
        delete: "Slett",
        deleteConfirm: (a) => `Slette "${a}" for godt?`,
        selectForCompare: (a) => `Velg ${a} for sammenligning`,
        compare: "Sammenlign valgte",
        pickTwo: "Velg to skanninger å sammenligne.",
        partial: "Delvis",
        viewing: (a, b) => `Du ser på den lagrede skanningen "${a}" fra ${b}. Dette er ikke stasjonen slik den er nå.`,
        closeView: "Tilbake til gjeldende skanning",
        failed: (a) => `Lagrede skanninger: ${a}`
      },
      compare: {
        title: (a, b) => `Fra "${a}" til "${b}"`,
        total: (a) => `Total endring: ${a}`,
        grew: "Vokste mest",
        shrank: "Krympet mest",
        added: "Nye mapper",
        removed: "Fjernede mapper",
        none: "Ingenting i denne gruppen.",
        back: "Tilbake til listen",
        loading: "Sammenligner…"
      },
      crawl: {
        note: "Leser hver mappe, én om gangen. En hel stasjon tar en stund: resultatene vises etter hvert som de finnes, og du kan stoppe når som helst og beholde det som er lest.",
        limit: "Krever ingen tillatelse. En hel stasjon tar mye lengre tid enn hurtigskanning, men du ser resultatene etter hvert og kan stoppe når du vil.",
        partialNote: "Viser det som er lest så langt. Størrelsene vokser til skanningen er ferdig."
      }
    }
  },
  nl: {
    diskMapV3: {
      large: {
        tooLarge: "De schijf bevat meer bestanden dan Prune in één scan kan verwerken. Gebruik “undefined” om hem map voor map te scannen, of sluit grote mappen uit in Instellingen.",
        foldedNote: (a, b) => `Elke map toont zijn ${a} grootste bestanden; de overige ${b} bestanden zijn samengevoegd in één rij per map. Ze tellen nog steeds mee in alle totalen en in de cijfers per bestandstype.`,
        foldedFloorNote: (a, b) => `Deze schijf bevat zoveel bestanden dat alleen bestanden van ${b} of groter afzonderlijk worden getoond; de overige ${a} bestanden zijn samengevoegd in één rij per map. Ze tellen nog steeds mee in alle totalen en in de cijfers per bestandstype.`
      },
      drives: {
        label: "Schijven",
        system: "Systeem",
        removable: "Verwijderbaar",
        usage: (a, b) => `${a} van ${b} in gebruik`,
        scanned: "Gescand",
        alsoScan: "Ook deze schijven scannen",
        alsoScanNote: "Schijven die samen worden gescand delen één beheerdersprompt.",
        notNtfs: "Alleen NTFS-schijven kunnen snel worden gescand.",
        failed: (a, b) => `Kan ${a} niet scannen: ${b}`
      },
      elevation: {
        runningAsAdmin: "Prune draait als beheerder, dus deze scan start zonder prompt.",
        why: "Windows staat alleen beheerders toe de bestandsindex van een schijf rechtstreeks te lezen, en dat maakt deze scan snel.",
        restartHint: "Start Prune één keer opnieuw als beheerder en latere snelle scans hebben geen prompt meer nodig.",
        restartButton: "Prune opnieuw starten als beheerder",
        restarting: "Opnieuw starten…",
        restartDeclined: "Niet goedgekeurd — Prune draait nog steeds zoals eerder.",
        restartFailed: (a) => `Opnieuw starten als beheerder is mislukt: ${a}`
      },
      columns: {
        allocated: "Toegewezen",
        name: "Naam"
      },
      totals: {
        line: (a, b, c) => `${a} geteld · ${b} op schijf · ${c} in gebruik op het volume`,
        lineNoVolume: (a, b) => `${a} geteld · ${b} op schijf`,
        hardLinkNote: (a) => `${a} bestanden met meerdere namen worden maar één keer geteld.`
      },
      filesView: {
        sortBy: "Sorteren op"
      },
      search: {
        label: "Namen zoeken",
        placeholder: "Tekst, * ? of /regex/",
        clear: "Zoekopdracht wissen",
        invalid: "Dat patroon is ongeldig.",
        noMatches: (a) => `Niets hier komt overeen met "${a}".`
      },
      export: {
        csv: "CSV exporteren",
        png: "Kaart opslaan als PNG",
        failed: (a) => `Exporteren mislukt: ${a}`,
        done: (a) => `Geëxporteerd: ${a}`
      },
      menu: {
        properties: "Eigenschappen",
        exclude: "Deze map uitsluiten"
      },
      props: {
        path: "Pad",
        type: "Type",
        close: "Sluiten"
      },
      toasts: {
        excluded: (a) => `${a} wordt bij toekomstige scans overgeslagen.`,
        alreadyExcluded: (a) => `${a} is al uitgesloten.`,
        excludeFailed: "De uitsluiting kon niet worden opgeslagen."
      },
      saved: {
        title: "Opgeslagen scans",
        nameField: "Naam voor deze scan",
        save: "Huidige scan opslaan",
        saving: "Opslaan…",
        saved: (a) => `Scan "${a}" opgeslagen.`,
        nothingToSave: "Scan eerst een schijf, dan kunt u die hier opslaan.",
        empty: "Nog geen opgeslagen scans.",
        load: "Openen",
        delete: "Verwijderen",
        deleteConfirm: (a) => `"${a}" definitief verwijderen?`,
        selectForCompare: (a) => `${a} selecteren om te vergelijken`,
        compare: "Selectie vergelijken",
        pickTwo: "Kies twee scans om te vergelijken.",
        partial: "Onvolledig",
        viewing: (a, b) => `U bekijkt de opgeslagen scan "${a}" van ${b}. Dit is niet de schijf zoals die nu is.`,
        closeView: "Terug naar de huidige scan",
        failed: (a) => `Opgeslagen scans: ${a}`
      },
      compare: {
        title: (a, b) => `Van "${a}" naar "${b}"`,
        total: (a) => `Totale wijziging: ${a}`,
        grew: "Meest gegroeid",
        shrank: "Meest gekrompen",
        added: "Nieuwe mappen",
        removed: "Verwijderde mappen",
        none: "Niets in deze groep.",
        back: "Terug naar de lijst",
        loading: "Vergelijken…"
      },
      crawl: {
        note: "Leest elke map, één voor één. Een hele schijf kost tijd: resultaten verschijnen zodra ze gevonden zijn, en u kunt op elk moment stoppen en behouden wat gelezen is.",
        limit: "Vereist geen toestemming. Een hele schijf duurt veel langer dan de snelle scan, maar u ziet resultaten zodra ze binnenkomen en kunt stoppen wanneer u wilt.",
        partialNote: "Toont wat tot nu toe is gelezen. De groottes blijven groeien tot de scan klaar is."
      }
    }
  },
  pl: {
    diskMapV3: {
      large: {
        tooLarge: "Dysk zawiera więcej plików, niż Prune może obsłużyć w jednym skanowaniu. Użyj „undefined”, aby skanować go folder po folderze, lub wyklucz duże foldery w Ustawieniach.",
        foldedNote: (a, b) => `Każdy folder wyświetla swoje ${a} największych plików; pozostałe ${b} plików zsumowano w jednym wierszu na folder. Nadal są wliczane do wszystkich sum i zestawień według typu pliku.`,
        foldedFloorNote: (a, b) => `Ten dysk zawiera tak wiele plików, że osobno wyświetlane są tylko pliki o rozmiarze ${b} lub większe; pozostałe ${a} plików zsumowano w jednym wierszu na folder. Nadal są wliczane do wszystkich sum i zestawień według typu pliku.`
      },
      drives: {
        label: "Dyski",
        system: "Systemowy",
        removable: "Wymienny",
        usage: (a, b) => `Użyto ${a} z ${b}`,
        scanned: "Przeskanowano",
        alsoScan: "Skanuj także te dyski",
        alsoScanNote: "Dyski skanowane razem korzystają z jednego monitu administratora.",
        notNtfs: "Szybko skanować można tylko dyski NTFS.",
        failed: (a, b) => `Nie udało się przeskanować ${a}: ${b}`
      },
      elevation: {
        runningAsAdmin: "Prune działa jako administrator, więc to skanowanie startuje bez monitu.",
        why: "Windows pozwala bezpośrednio czytać indeks plików dysku tylko administratorom i to właśnie sprawia, że to skanowanie jest szybkie.",
        restartHint: "Uruchom Prune ponownie jako administrator raz, a kolejne szybkie skanowania nie będą wymagały monitu.",
        restartButton: "Uruchom Prune ponownie jako administrator",
        restarting: "Ponowne uruchamianie…",
        restartDeclined: "Nie zatwierdzono — Prune działa nadal jak wcześniej.",
        restartFailed: (a) => `Nie udało się uruchomić ponownie jako administrator: ${a}`
      },
      columns: {
        allocated: "Przydzielone",
        name: "Nazwa"
      },
      totals: {
        line: (a, b, c) => `${a} policzone · ${b} na dysku · ${c} zajęte na woluminie`,
        lineNoVolume: (a, b) => `${a} policzone · ${b} na dysku`,
        hardLinkNote: (a) => `${a} plików z wieloma nazwami jest liczonych tylko raz.`
      },
      filesView: {
        sortBy: "Sortuj według"
      },
      search: {
        label: "Szukaj nazw",
        placeholder: "Tekst, * ? lub /regex/",
        clear: "Wyczyść wyszukiwanie",
        invalid: "Ten wzorzec jest nieprawidłowy.",
        noMatches: (a) => `Nic tutaj nie pasuje do "${a}".`
      },
      export: {
        csv: "Eksportuj CSV",
        png: "Zapisz mapę jako PNG",
        failed: (a) => `Eksport się nie powiódł: ${a}`,
        done: (a) => `Wyeksportowano: ${a}`
      },
      menu: {
        properties: "Właściwości",
        exclude: "Wyklucz ten folder"
      },
      props: {
        path: "Ścieżka",
        type: "Typ",
        close: "Zamknij"
      },
      toasts: {
        excluded: (a) => `${a} będzie pomijany w przyszłych skanowaniach.`,
        alreadyExcluded: (a) => `${a} jest już wykluczony.`,
        excludeFailed: "Nie udało się zapisać wykluczenia."
      },
      saved: {
        title: "Zapisane skany",
        nameField: "Nazwa tego skanu",
        save: "Zapisz bieżący skan",
        saving: "Zapisywanie…",
        saved: (a) => `Zapisano skan "${a}".`,
        nothingToSave: "Najpierw przeskanuj dysk, a potem zapiszesz go tutaj.",
        empty: "Brak zapisanych skanów.",
        load: "Otwórz",
        delete: "Usuń",
        deleteConfirm: (a) => `Usunąć "${a}" na stałe?`,
        selectForCompare: (a) => `Wybierz ${a} do porównania`,
        compare: "Porównaj zaznaczone",
        pickTwo: "Wybierz dwa skany do porównania.",
        partial: "Częściowy",
        viewing: (a, b) => `Przeglądasz zapisany skan "${a}" z dnia ${b}. To nie jest obecny stan dysku.`,
        closeView: "Wróć do bieżącego skanu",
        failed: (a) => `Zapisane skany: ${a}`
      },
      compare: {
        title: (a, b) => `Od "${a}" do "${b}"`,
        total: (a) => `Łączna zmiana: ${a}`,
        grew: "Najbardziej urosły",
        shrank: "Najbardziej zmalały",
        added: "Nowe foldery",
        removed: "Usunięte foldery",
        none: "Nic w tej grupie.",
        back: "Wróć do listy",
        loading: "Porównywanie…"
      },
      crawl: {
        note: "Czyta każdy folder po kolei. Cały dysk zajmuje chwilę: wyniki pojawiają się na bieżąco, a w dowolnym momencie możesz przerwać i zachować to, co odczytano.",
        limit: "Nie wymaga uprawnień. Cały dysk trwa znacznie dłużej niż szybkie skanowanie, ale wyniki widać na bieżąco i można przerwać w dowolnej chwili.",
        partialNote: "Pokazuje to, co dotąd odczytano. Rozmiary rosną do zakończenia skanowania."
      }
    }
  },
  ps: {
    diskMapV3: {
      large: {
        tooLarge: "په دې ډرایو کې له هغه ډېر فایلونه دي چې Prune یې په یوه سکین کې سمبالولی شي. د فولډر په فولډر سکین لپاره “undefined” وکاروئ، یا په تنظیماتو کې لوی فولډرونه ګوښه کړئ.",
        foldedNote: (a, b) => `هر فولډر خپل ${a} تر ټولو لوی فایلونه ښیي؛ نور ${b} فایلونه د هر فولډر لپاره په یوه کتار کې راټول شوي دي. دوی لاهم په ټولو مجموعو او د فایل ډول په شمېرو کې حسابېږي.`,
        foldedFloorNote: (a, b) => `په دې ډرایو کې دومره ډېر فایلونه دي چې یوازې ${b} یا له هغه لوی فایلونه جلا جلا ښودل کېږي؛ نور ${a} فایلونه د هر فولډر لپاره په یوه کتار کې راټول شوي دي. دوی لاهم په ټولو مجموعو او د فایل ډول په شمېرو کې حسابېږي.`
      },
      drives: {
        label: "ډرایونه",
        system: "سیسټم",
        removable: "ایستل کیدونکی",
        usage: (a, b) => `${a} له ${b} څخه کارول شوي`,
        scanned: "سکین شوی",
        alsoScan: "دا ډرایونه هم سکین کړئ",
        alsoScanNote: "هغه ډرایونه چې یو ځای سکین کیږي، یو اډمین پوښتنه شریکوي.",
        notNtfs: "یواځې د NTFS ډرایونه چټک سکین کیدی شي.",
        failed: (a, b) => `${a} سکین نشو: ${b}`
      },
      elevation: {
        runningAsAdmin: "Prune د اډمین په توګه چلیږي، نو دا سکین پرته له پوښتنې پیلیږي.",
        why: "وینډوز یوازې اډمینانو ته اجازه ورکوي چې د ډرایو د فایل انډیکس مستقیم ولولي، او همدا دا سکین چټک کوي.",
        restartHint: "Prune یو ځل د اډمین په توګه بیا پیل کړئ او وروسته چټک سکینونه به پوښتنې ته اړتیا ونلري.",
        restartButton: "Prune د اډمین په توګه بیا پیل کړئ",
        restarting: "بیا پیلیږي…",
        restartDeclined: "ونه منل شو — Prune لا هم پخوا په څیر چلیږي.",
        restartFailed: (a) => `د اډمین په توګه بیا پیل نشو: ${a}`
      },
      columns: {
        allocated: "ځانګړی شوی",
        name: "نوم"
      },
      totals: {
        line: (a, b, c) => `${a} شمیرل شوي · ${b} په ډیسک کې · ${c} په حجم کې کارول شوي`,
        lineNoVolume: (a, b) => `${a} شمیرل شوي · ${b} په ډیسک کې`,
        hardLinkNote: (a) => `${a} فایلونه چې څو نومونه لري یوازې یو ځل شمیرل کیږي.`
      },
      filesView: {
        sortBy: "ترتیب د مخې"
      },
      search: {
        label: "نومونه ولټوئ",
        placeholder: "متن، * ? یا /regex/",
        clear: "لټون پاک کړئ",
        invalid: "دا نمونه سمه نه ده.",
        noMatches: (a) => `دلته هیڅ شی له "${a}" سره سمون نه لري.`
      },
      export: {
        csv: "CSV صادر کړئ",
        png: "نقشه د PNG په توګه خوندي کړئ",
        failed: (a) => `صادرول ونه شول: ${a}`,
        done: (a) => `صادر شو: ${a}`
      },
      menu: {
        properties: "ځانګړتیاوې",
        exclude: "دا فولډر وباسئ"
      },
      props: {
        path: "لاره",
        type: "ډول",
        close: "بندول"
      },
      toasts: {
        excluded: (a) => `${a} به په راتلونکو سکینونو کې پریښودل شي.`,
        alreadyExcluded: (a) => `${a} دمخه وایستل شوی.`,
        excludeFailed: "دا استثنا خوندي نشوه."
      },
      saved: {
        title: "خوندي شوي سکینونه",
        nameField: "د دې سکین نوم",
        save: "اوسنی سکین خوندي کړئ",
        saving: "خوندي کیږي…",
        saved: (a) => `سکین "${a}" خوندي شو.`,
        nothingToSave: "لومړی یو ډرایو سکین کړئ، بیا یې دلته خوندي کولی شئ.",
        empty: "تر اوسه خوندي شوي سکینونه نشته.",
        load: "خلاصول",
        delete: "ړنګول",
        deleteConfirm: (a) => `"${a}" تل لپاره ړنګ کړئ؟`,
        selectForCompare: (a) => `${a} د پرتله کولو لپاره وټاکئ`,
        compare: "ټاکل شوي پرتله کړئ",
        pickTwo: "د پرتله کولو لپاره دوه سکینونه وټاکئ.",
        partial: "نیمګړی",
        viewing: (a, b) => `تاسو خوندي شوی سکین "${a}" له ${b} څخه ګورئ. دا ستاسو د ډرایو اوسنی حالت نه دی.`,
        closeView: "اوسني سکین ته ستنیدل",
        failed: (a) => `خوندي شوي سکینونه: ${a}`
      },
      compare: {
        title: (a, b) => `له "${a}" څخه تر "${b}" پورې`,
        total: (a) => `ټول بدلون: ${a}`,
        grew: "ډېر ډېر وده",
        shrank: "ډېر ډېر کمښت",
        added: "نوي فولډرونه",
        removed: "لرې شوي فولډرونه",
        none: "پدې ګروپ کې هیڅ نشته.",
        back: "لیست ته ستنیدل",
        loading: "پرتله کیږي…"
      },
      crawl: {
        note: "هر فولډر یو په یو لولي. بشپړ ډرایو یو څه وخت نیسي: پایلې د موندلو سره سم ښکاره کیږي، او تاسو کولی شئ هر وخت ودروئ او هغه څه وساتئ چې لوستل شوي.",
        limit: "اجازې ته اړتیا نشته. بشپړ ډرایو د چټک سکین په پرتله ډېر وخت نیسي، خو تاسو پایلې د رارسېدو سره سم ګورئ او هر وخت ودرولی شئ.",
        partialNote: "هغه څه ښیي چې تر اوسه لوستل شوي. اندازې تر هغه وخته وده کوي چې سکین پای ته ورسیږي."
      }
    }
  },
  "pt-BR": {
    diskMapV3: {
      large: {
        tooLarge: "A unidade tem mais arquivos do que o Prune consegue manter em uma única verificação. Use “undefined” para verificá-la pasta por pasta ou exclua pastas grandes em Configurações.",
        foldedNote: (a, b) => `Cada pasta lista seus ${a} maiores arquivos; os outros ${b} arquivos são somados em uma única linha por pasta. Eles continuam contando em todos os totais e nos números por tipo de arquivo.`,
        foldedFloorNote: (a, b) => `Esta unidade tem tantos arquivos que só os de ${b} ou mais são listados individualmente; os outros ${a} arquivos são somados em uma única linha por pasta. Eles continuam contando em todos os totais e nos números por tipo de arquivo.`
      },
      drives: {
        label: "Unidades",
        system: "Sistema",
        removable: "Removível",
        usage: (a, b) => `${a} de ${b} em uso`,
        scanned: "Verificado",
        alsoScan: "Verificar também estas unidades",
        alsoScanNote: "Unidades verificadas juntas compartilham uma única solicitação de administrador.",
        notNtfs: "Somente unidades NTFS podem passar pela verificação rápida.",
        failed: (a, b) => `Não foi possível verificar ${a}: ${b}`
      },
      elevation: {
        runningAsAdmin: "O Prune está em execução como administrador, então esta verificação começa sem solicitação.",
        why: "O Windows só permite que administradores leiam diretamente o índice de arquivos de uma unidade, e é isso que torna esta verificação rápida.",
        restartHint: "Reinicie o Prune como administrador uma vez e as próximas verificações rápidas não precisarão de solicitação.",
        restartButton: "Reiniciar o Prune como administrador",
        restarting: "Reiniciando…",
        restartDeclined: "Não aprovado — o Prune continua em execução como antes.",
        restartFailed: (a) => `Não foi possível reiniciar como administrador: ${a}`
      },
      columns: {
        allocated: "Alocado",
        name: "Nome"
      },
      totals: {
        line: (a, b, c) => `${a} contados · ${b} em disco · ${c} em uso no volume`,
        lineNoVolume: (a, b) => `${a} contados · ${b} em disco`,
        hardLinkNote: (a) => `${a} arquivos com vários nomes são contados uma única vez.`
      },
      filesView: {
        sortBy: "Ordenar por"
      },
      search: {
        label: "Pesquisar nomes",
        placeholder: "Texto, * ? ou /regex/",
        clear: "Limpar pesquisa",
        invalid: "Esse padrão não é válido.",
        noMatches: (a) => `Nada aqui corresponde a "${a}".`
      },
      export: {
        csv: "Exportar CSV",
        png: "Salvar mapa como PNG",
        failed: (a) => `Falha ao exportar: ${a}`,
        done: (a) => `Exportado: ${a}`
      },
      menu: {
        properties: "Propriedades",
        exclude: "Excluir esta pasta"
      },
      props: {
        path: "Caminho",
        type: "Tipo",
        close: "Fechar"
      },
      toasts: {
        excluded: (a) => `${a} será ignorado nas próximas verificações.`,
        alreadyExcluded: (a) => `${a} já está excluído.`,
        excludeFailed: "Não foi possível salvar essa exclusão."
      },
      saved: {
        title: "Verificações salvas",
        nameField: "Nome desta verificação",
        save: "Salvar a verificação atual",
        saving: "Salvando…",
        saved: (a) => `Verificação "${a}" salva.`,
        nothingToSave: "Verifique uma unidade primeiro; depois você poderá salvá-la aqui.",
        empty: "Ainda não há verificações salvas.",
        load: "Abrir",
        delete: "Excluir",
        deleteConfirm: (a) => `Excluir "${a}" definitivamente?`,
        selectForCompare: (a) => `Selecionar ${a} para comparar`,
        compare: "Comparar selecionadas",
        pickTwo: "Escolha duas verificações para comparar.",
        partial: "Parcial",
        viewing: (a, b) => `Você está vendo a verificação salva "${a}" de ${b}. Esta não é a unidade como está agora.`,
        closeView: "Voltar à verificação atual",
        failed: (a) => `Verificações salvas: ${a}`
      },
      compare: {
        title: (a, b) => `De "${a}" para "${b}"`,
        total: (a) => `Alteração total: ${a}`,
        grew: "Mais cresceram",
        shrank: "Mais diminuíram",
        added: "Pastas novas",
        removed: "Pastas removidas",
        none: "Nada neste grupo.",
        back: "Voltar à lista",
        loading: "Comparando…"
      },
      crawl: {
        note: "Lê cada pasta, uma de cada vez. Uma unidade inteira leva um tempo: os resultados aparecem à medida que são encontrados, e você pode parar a qualquer momento e manter o que foi lido.",
        limit: "Não precisa de permissão. Uma unidade inteira leva muito mais tempo do que a verificação rápida, mas você vê os resultados conforme chegam e pode parar quando quiser.",
        partialNote: "Mostrando o que foi lido até agora. Os tamanhos continuam crescendo até a verificação terminar."
      }
    }
  },
  pt: {
    diskMapV3: {
      large: {
        tooLarge: "A unidade tem mais ficheiros do que o Prune consegue manter numa única análise. Utilize “undefined” para a analisar pasta a pasta ou exclua pastas grandes nas Definições.",
        foldedNote: (a, b) => `Cada pasta lista os seus ${a} maiores ficheiros; os outros ${b} ficheiros são somados numa única linha por pasta. Continuam a contar em todos os totais e nos números por tipo de ficheiro.`,
        foldedFloorNote: (a, b) => `Esta unidade tem tantos ficheiros que só os de ${b} ou mais são listados individualmente; os outros ${a} ficheiros são somados numa única linha por pasta. Continuam a contar em todos os totais e nos números por tipo de ficheiro.`
      },
      drives: {
        label: "Unidades",
        system: "Sistema",
        removable: "Amovível",
        usage: (a, b) => `${a} de ${b} em utilização`,
        scanned: "Analisado",
        alsoScan: "Analisar também estas unidades",
        alsoScanNote: "As unidades analisadas em conjunto partilham um único pedido de administrador.",
        notNtfs: "Apenas as unidades NTFS podem ser analisadas rapidamente.",
        failed: (a, b) => `Não foi possível analisar ${a}: ${b}`
      },
      elevation: {
        runningAsAdmin: "O Prune está a ser executado como administrador, por isso esta análise começa sem pedido.",
        why: "O Windows só permite que os administradores leiam diretamente o índice de ficheiros de uma unidade, e é isso que torna esta análise rápida.",
        restartHint: "Reinicie o Prune como administrador uma vez e as análises rápidas seguintes não precisarão de pedido.",
        restartButton: "Reiniciar o Prune como administrador",
        restarting: "A reiniciar…",
        restartDeclined: "Não aprovado — o Prune continua a ser executado como antes.",
        restartFailed: (a) => `Não foi possível reiniciar como administrador: ${a}`
      },
      columns: {
        allocated: "Alocado",
        name: "Nome"
      },
      totals: {
        line: (a, b, c) => `${a} contabilizados · ${b} em disco · ${c} em utilização no volume`,
        lineNoVolume: (a, b) => `${a} contabilizados · ${b} em disco`,
        hardLinkNote: (a) => `${a} ficheiros com vários nomes são contabilizados uma única vez.`
      },
      filesView: {
        sortBy: "Ordenar por"
      },
      search: {
        label: "Pesquisar nomes",
        placeholder: "Texto, * ? ou /regex/",
        clear: "Limpar pesquisa",
        invalid: "Esse padrão não é válido.",
        noMatches: (a) => `Nada aqui corresponde a "${a}".`
      },
      export: {
        csv: "Exportar CSV",
        png: "Guardar mapa como PNG",
        failed: (a) => `Falha ao exportar: ${a}`,
        done: (a) => `Exportado: ${a}`
      },
      menu: {
        properties: "Propriedades",
        exclude: "Excluir esta pasta"
      },
      props: {
        path: "Caminho",
        type: "Tipo",
        close: "Fechar"
      },
      toasts: {
        excluded: (a) => `${a} será ignorado nas próximas análises.`,
        alreadyExcluded: (a) => `${a} já está excluído.`,
        excludeFailed: "Não foi possível guardar essa exclusão."
      },
      saved: {
        title: "Análises guardadas",
        nameField: "Nome desta análise",
        save: "Guardar a análise atual",
        saving: "A guardar…",
        saved: (a) => `Análise "${a}" guardada.`,
        nothingToSave: "Analise primeiro uma unidade; depois poderá guardá-la aqui.",
        empty: "Ainda não há análises guardadas.",
        load: "Abrir",
        delete: "Eliminar",
        deleteConfirm: (a) => `Eliminar "${a}" definitivamente?`,
        selectForCompare: (a) => `Selecionar ${a} para comparar`,
        compare: "Comparar selecionadas",
        pickTwo: "Escolha duas análises para comparar.",
        partial: "Parcial",
        viewing: (a, b) => `Está a ver a análise guardada "${a}" de ${b}. Este não é o estado atual da unidade.`,
        closeView: "Voltar à análise atual",
        failed: (a) => `Análises guardadas: ${a}`
      },
      compare: {
        title: (a, b) => `De "${a}" para "${b}"`,
        total: (a) => `Alteração total: ${a}`,
        grew: "Mais cresceram",
        shrank: "Mais diminuíram",
        added: "Pastas novas",
        removed: "Pastas removidas",
        none: "Nada neste grupo.",
        back: "Voltar à lista",
        loading: "A comparar…"
      },
      crawl: {
        note: "Lê cada pasta, uma de cada vez. Uma unidade inteira demora algum tempo: os resultados aparecem à medida que são encontrados e pode parar a qualquer momento, mantendo o que foi lido.",
        limit: "Não precisa de permissão. Uma unidade inteira demora muito mais do que a análise rápida, mas vê os resultados à medida que chegam e pode parar quando quiser.",
        partialNote: "A mostrar o que foi lido até agora. Os tamanhos continuam a crescer até a análise terminar."
      }
    }
  },
  ro: {
    diskMapV3: {
      large: {
        tooLarge: "Unitatea are mai multe fișiere decât poate gestiona Prune într-o singură scanare. Folosiți „undefined” pentru a o scana folder cu folder sau excludeți folderele mari din Setări.",
        foldedNote: (a, b) => `Fiecare folder listează cele mai mari ${a} fișiere ale sale; celelalte ${b} fișiere sunt însumate într-un singur rând per folder. Ele continuă să conteze în toate totalurile și în cifrele pe tipuri de fișiere.`,
        foldedFloorNote: (a, b) => `Această unitate are atât de multe fișiere încât doar cele de ${b} sau mai mari sunt listate individual; celelalte ${a} fișiere sunt însumate într-un singur rând per folder. Ele continuă să conteze în toate totalurile și în cifrele pe tipuri de fișiere.`
      },
      drives: {
        label: "Unități",
        system: "Sistem",
        removable: "Amovibil",
        usage: (a, b) => `${a} din ${b} utilizați`,
        scanned: "Scanat",
        alsoScan: "Scanează și aceste unități",
        alsoScanNote: "Unitățile scanate împreună folosesc o singură solicitare de administrator.",
        notNtfs: "Doar unitățile NTFS pot fi scanate rapid.",
        failed: (a, b) => `Nu s-a putut scana ${a}: ${b}`
      },
      elevation: {
        runningAsAdmin: "Prune rulează ca administrator, deci această scanare începe fără solicitare.",
        why: "Windows permite doar administratorilor să citească direct indexul de fișiere al unei unități, iar asta face scanarea rapidă.",
        restartHint: "Repornește Prune ca administrator o dată și scanările rapide ulterioare nu vor mai avea nevoie de solicitare.",
        restartButton: "Repornește Prune ca administrator",
        restarting: "Se repornește…",
        restartDeclined: "Neaprobat — Prune rulează în continuare ca înainte.",
        restartFailed: (a) => `Nu s-a putut reporni ca administrator: ${a}`
      },
      columns: {
        allocated: "Alocat",
        name: "Nume"
      },
      totals: {
        line: (a, b, c) => `${a} contorizați · ${b} pe disc · ${c} utilizați pe volum`,
        lineNoVolume: (a, b) => `${a} contorizați · ${b} pe disc`,
        hardLinkNote: (a) => `${a} fișiere cu mai multe nume sunt numărate o singură dată.`
      },
      filesView: {
        sortBy: "Sortează după"
      },
      search: {
        label: "Caută nume",
        placeholder: "Text, * ? sau /regex/",
        clear: "Șterge căutarea",
        invalid: "Acest model nu este valid.",
        noMatches: (a) => `Nimic de aici nu se potrivește cu "${a}".`
      },
      export: {
        csv: "Exportă CSV",
        png: "Salvează harta ca PNG",
        failed: (a) => `Exportul a eșuat: ${a}`,
        done: (a) => `Exportat: ${a}`
      },
      menu: {
        properties: "Proprietăți",
        exclude: "Exclude acest folder"
      },
      props: {
        path: "Cale",
        type: "Tip",
        close: "Închide"
      },
      toasts: {
        excluded: (a) => `${a} va fi omis la scanările viitoare.`,
        alreadyExcluded: (a) => `${a} este deja exclus.`,
        excludeFailed: "Nu s-a putut salva excluderea."
      },
      saved: {
        title: "Scanări salvate",
        nameField: "Numele acestei scanări",
        save: "Salvează scanarea curentă",
        saving: "Se salvează…",
        saved: (a) => `Scanarea "${a}" a fost salvată.`,
        nothingToSave: "Scanați mai întâi o unitate, apoi o puteți salva aici.",
        empty: "Nu există încă scanări salvate.",
        load: "Deschide",
        delete: "Șterge",
        deleteConfirm: (a) => `Ștergeți definitiv "${a}"?`,
        selectForCompare: (a) => `Selectează ${a} pentru comparare`,
        compare: "Compară selecția",
        pickTwo: "Alegeți două scanări de comparat.",
        partial: "Parțială",
        viewing: (a, b) => `Vizualizați scanarea salvată "${a}" din ${b}. Aceasta nu este starea actuală a unității.`,
        closeView: "Înapoi la scanarea curentă",
        failed: (a) => `Scanări salvate: ${a}`
      },
      compare: {
        title: (a, b) => `De la "${a}" la "${b}"`,
        total: (a) => `Modificare totală: ${a}`,
        grew: "Cele mai mari creșteri",
        shrank: "Cele mai mari scăderi",
        added: "Foldere noi",
        removed: "Foldere eliminate",
        none: "Nimic în acest grup.",
        back: "Înapoi la listă",
        loading: "Se compară…"
      },
      crawl: {
        note: "Citește fiecare folder, pe rând. O unitate întreagă durează: rezultatele apar pe măsură ce sunt găsite, iar puteți opri oricând și păstra ce s-a citit.",
        limit: "Nu necesită permisiune. O unitate întreagă durează mult mai mult decât scanarea rapidă, dar vedeți rezultatele pe măsură ce sosesc și puteți opri oricând.",
        partialNote: "Se afișează ce s-a citit până acum. Dimensiunile continuă să crească până se termină scanarea."
      }
    }
  },
  ru: {
    diskMapV3: {
      large: {
        tooLarge: "На диске больше файлов, чем Prune может обработать за одно сканирование. Используйте «undefined», чтобы сканировать его папка за папкой, или исключите большие папки в Настройках.",
        foldedNote: (a, b) => `Каждая папка показывает ${a} самых больших файлов; остальные ${b} файлов объединены в одну строку на папку. Они по-прежнему учитываются во всех итогах и в данных по типам файлов.`,
        foldedFloorNote: (a, b) => `На этом диске так много файлов, что по отдельности показаны только файлы размером ${b} и больше; остальные ${a} файлов объединены в одну строку на папку. Они по-прежнему учитываются во всех итогах и в данных по типам файлов.`
      },
      drives: {
        label: "Диски",
        system: "Системный",
        removable: "Съёмный",
        usage: (a, b) => `Занято ${a} из ${b}`,
        scanned: "Просканировано",
        alsoScan: "Также сканировать эти диски",
        alsoScanNote: "Диски, сканируемые вместе, используют один запрос прав администратора.",
        notNtfs: "Быстрое сканирование доступно только для дисков NTFS.",
        failed: (a, b) => `Не удалось просканировать ${a}: ${b}`
      },
      elevation: {
        runningAsAdmin: "Prune запущен от имени администратора, поэтому это сканирование начинается без запроса.",
        why: "Windows разрешает напрямую читать файловый индекс диска только администраторам — именно это делает сканирование быстрым.",
        restartHint: "Один раз перезапустите Prune от имени администратора — и последующие быстрые сканирования обойдутся без запроса.",
        restartButton: "Перезапустить Prune от имени администратора",
        restarting: "Перезапуск…",
        restartDeclined: "Не подтверждено — Prune продолжает работать как раньше.",
        restartFailed: (a) => `Не удалось перезапустить от имени администратора: ${a}`
      },
      columns: {
        allocated: "Выделено",
        name: "Имя"
      },
      totals: {
        line: (a, b, c) => `${a} учтено · ${b} на диске · ${c} занято на томе`,
        lineNoVolume: (a, b) => `${a} учтено · ${b} на диске`,
        hardLinkNote: (a) => `${a} файлов с несколькими именами учтены один раз.`
      },
      filesView: {
        sortBy: "Сортировка"
      },
      search: {
        label: "Поиск по именам",
        placeholder: "Текст, * ? или /regex/",
        clear: "Очистить поиск",
        invalid: "Недопустимый шаблон.",
        noMatches: (a) => `Здесь нет совпадений с "${a}".`
      },
      export: {
        csv: "Экспорт в CSV",
        png: "Сохранить карту как PNG",
        failed: (a) => `Не удалось экспортировать: ${a}`,
        done: (a) => `Экспортировано: ${a}`
      },
      menu: {
        properties: "Свойства",
        exclude: "Исключить эту папку"
      },
      props: {
        path: "Путь",
        type: "Тип",
        close: "Закрыть"
      },
      toasts: {
        excluded: (a) => `${a} будет пропускаться при следующих сканированиях.`,
        alreadyExcluded: (a) => `${a} уже исключено.`,
        excludeFailed: "Не удалось сохранить исключение."
      },
      saved: {
        title: "Сохранённые сканирования",
        nameField: "Название сканирования",
        save: "Сохранить текущее сканирование",
        saving: "Сохранение…",
        saved: (a) => `Сканирование "${a}" сохранено.`,
        nothingToSave: "Сначала просканируйте диск — потом его можно будет сохранить здесь.",
        empty: "Сохранённых сканирований пока нет.",
        load: "Открыть",
        delete: "Удалить",
        deleteConfirm: (a) => `Удалить "${a}" навсегда?`,
        selectForCompare: (a) => `Выбрать ${a} для сравнения`,
        compare: "Сравнить выбранные",
        pickTwo: "Выберите два сканирования для сравнения.",
        partial: "Частичное",
        viewing: (a, b) => `Вы просматриваете сохранённое сканирование "${a}" от ${b}. Это не текущее состояние диска.`,
        closeView: "Вернуться к текущему сканированию",
        failed: (a) => `Сохранённые сканирования: ${a}`
      },
      compare: {
        title: (a, b) => `От "${a}" к "${b}"`,
        total: (a) => `Общее изменение: ${a}`,
        grew: "Выросли сильнее всего",
        shrank: "Уменьшились сильнее всего",
        added: "Новые папки",
        removed: "Удалённые папки",
        none: "В этой группе ничего нет.",
        back: "Назад к списку",
        loading: "Сравнение…"
      },
      crawl: {
        note: "Читает папки по одной. Целый диск занимает время: результаты появляются по мере обнаружения, а остановить сканирование можно в любой момент, сохранив прочитанное.",
        limit: "Права не нужны. Целый диск занимает намного больше времени, чем быстрое сканирование, но результаты видны по мере поступления, а остановить можно в любой момент.",
        partialNote: "Показано то, что прочитано к этому моменту. Размеры растут, пока сканирование не завершится."
      }
    }
  },
  sk: {
    diskMapV3: {
      large: {
        tooLarge: "Jednotka obsahuje viac súborov, než dokáže Prune spracovať v jednom skenovaní. Použite „undefined“ a skenujte ju priečinok po priečinku, alebo v Nastaveniach vylúčte veľké priečinky.",
        foldedNote: (a, b) => `Každý priečinok uvádza svojich ${a} najväčších súborov; ostatných ${b} súborov je zrátaných do jedného riadka na priečinok. Do všetkých súčtov a prehľadov podľa typu súboru sa stále počítajú.`,
        foldedFloorNote: (a, b) => `Táto jednotka má toľko súborov, že samostatne sa uvádzajú iba súbory s veľkosťou ${b} a viac; ostatných ${a} súborov je zrátaných do jedného riadka na priečinok. Do všetkých súčtov a prehľadov podľa typu súboru sa stále počítajú.`
      },
      drives: {
        label: "Disky",
        system: "Systémový",
        removable: "Vymeniteľný",
        usage: (a, b) => `Použité ${a} z ${b}`,
        scanned: "Naskenované",
        alsoScan: "Skenovať aj tieto disky",
        alsoScanNote: "Disky skenované spolu zdieľajú jednu výzvu správcu.",
        notNtfs: "Rýchlo skenovať možno iba disky NTFS.",
        failed: (a, b) => `Disk ${a} sa nepodarilo naskenovať: ${b}`
      },
      elevation: {
        runningAsAdmin: "Prune beží ako správca, takže toto skenovanie sa spustí bez výzvy.",
        why: "Windows dovoľuje čítať index súborov disku priamo iba správcom a práve to robí toto skenovanie rýchlym.",
        restartHint: "Raz reštartujte Prune ako správca a ďalšie rýchle skenovania už výzvu nebudú potrebovať.",
        restartButton: "Reštartovať Prune ako správca",
        restarting: "Reštartuje sa…",
        restartDeclined: "Nepotvrdené — Prune beží naďalej ako predtým.",
        restartFailed: (a) => `Reštart ako správca sa nepodaril: ${a}`
      },
      columns: {
        allocated: "Pridelené",
        name: "Názov"
      },
      totals: {
        line: (a, b, c) => `${a} započítané · ${b} na disku · ${c} využité na zväzku`,
        lineNoVolume: (a, b) => `${a} započítané · ${b} na disku`,
        hardLinkNote: (a) => `${a} súborov s viacerými názvami sa počíta iba raz.`
      },
      filesView: {
        sortBy: "Zoradiť podľa"
      },
      search: {
        label: "Hľadať názvy",
        placeholder: "Text, * ? alebo /regex/",
        clear: "Vymazať hľadanie",
        invalid: "Tento vzor nie je platný.",
        noMatches: (a) => `Nič tu nezodpovedá výrazu "${a}".`
      },
      export: {
        csv: "Exportovať CSV",
        png: "Uložiť mapu ako PNG",
        failed: (a) => `Export zlyhal: ${a}`,
        done: (a) => `Exportované: ${a}`
      },
      menu: {
        properties: "Vlastnosti",
        exclude: "Vylúčiť tento priečinok"
      },
      props: {
        path: "Cesta",
        type: "Typ",
        close: "Zavrieť"
      },
      toasts: {
        excluded: (a) => `${a} sa pri budúcich skenovaniach preskočí.`,
        alreadyExcluded: (a) => `${a} už je vylúčené.`,
        excludeFailed: "Výnimku sa nepodarilo uložiť."
      },
      saved: {
        title: "Uložené skenovania",
        nameField: "Názov tohto skenovania",
        save: "Uložiť aktuálne skenovanie",
        saving: "Ukladá sa…",
        saved: (a) => `Skenovanie "${a}" bolo uložené.`,
        nothingToSave: "Najprv naskenujte disk, potom ho tu môžete uložiť.",
        empty: "Zatiaľ žiadne uložené skenovania.",
        load: "Otvoriť",
        delete: "Odstrániť",
        deleteConfirm: (a) => `Odstrániť "${a}" natrvalo?`,
        selectForCompare: (a) => `Vybrať ${a} na porovnanie`,
        compare: "Porovnať vybrané",
        pickTwo: "Vyberte dve skenovania na porovnanie.",
        partial: "Čiastočné",
        viewing: (a, b) => `Prezeráte si uložené skenovanie "${a}" z ${b}. Nie je to aktuálny stav disku.`,
        closeView: "Späť na aktuálne skenovanie",
        failed: (a) => `Uložené skenovania: ${a}`
      },
      compare: {
        title: (a, b) => `Od "${a}" po "${b}"`,
        total: (a) => `Celková zmena: ${a}`,
        grew: "Najviac vzrástlo",
        shrank: "Najviac kleslo",
        added: "Nové priečinky",
        removed: "Odstránené priečinky",
        none: "V tejto skupine nič nie je.",
        back: "Späť na zoznam",
        loading: "Porovnáva sa…"
      },
      crawl: {
        note: "Číta každý priečinok postupne. Celý disk chvíľu trvá: výsledky sa objavujú priebežne a kedykoľvek môžete skenovanie zastaviť a ponechať si prečítané.",
        limit: "Nevyžaduje oprávnenie. Celý disk trvá oveľa dlhšie než rýchle skenovanie, ale výsledky vidíte priebežne a môžete kedykoľvek zastaviť.",
        partialNote: "Zobrazuje sa, čo sa doteraz prečítalo. Veľkosti rastú, kým skenovanie neskončí."
      }
    }
  },
  sq: {
    diskMapV3: {
      large: {
        tooLarge: "Disku ka më shumë skedarë nga sa mund të mbajë Prune në një skanim të vetëm. Përdorni “undefined” për ta skanuar dosje pas dosjeje, ose përjashtoni dosjet e mëdha te Cilësimet.",
        foldedNote: (a, b) => `Çdo dosje liston ${a} skedarët e saj më të mëdhenj; ${b} skedarët e tjerë mblidhen në një rresht të vetëm për dosje. Ata vazhdojnë të llogariten në të gjitha totalet dhe në shifrat sipas llojit të skedarit.`,
        foldedFloorNote: (a, b) => `Ky disk ka kaq shumë skedarë sa vetëm skedarët me madhësi ${b} ose më të mëdhenj listohen një nga një; ${a} skedarët e tjerë mblidhen në një rresht të vetëm për dosje. Ata vazhdojnë të llogariten në të gjitha totalet dhe në shifrat sipas llojit të skedarit.`
      },
      drives: {
        label: "Disqet",
        system: "Sistemi",
        removable: "I lëvizshëm",
        usage: (a, b) => `${a} nga ${b} të përdorura`,
        scanned: "Skanuar",
        alsoScan: "Skano edhe këto disqe",
        alsoScanNote: "Disqet e skanuara së bashku ndajnë një kërkesë administratori.",
        notNtfs: "Vetëm disqet NTFS mund të skanohen shpejt.",
        failed: (a, b) => `Nuk u skanua dot ${a}: ${b}`
      },
      elevation: {
        runningAsAdmin: "Prune po ekzekutohet si administrator, ndaj ky skanim fillon pa kërkesë.",
        why: "Windows lejon vetëm administratorët të lexojnë drejtpërdrejt indeksin e skedarëve të një disku, dhe kjo e bën këtë skanim të shpejtë.",
        restartHint: "Rindiz Prune si administrator një herë dhe skanimet e shpejta të mëvonshme nuk do të kërkojnë asnjë kërkesë.",
        restartButton: "Rindiz Prune si administrator",
        restarting: "Po rindizet…",
        restartDeclined: "Nuk u miratua — Prune vazhdon të ekzekutohet si më parë.",
        restartFailed: (a) => `Nuk u rindez dot si administrator: ${a}`
      },
      columns: {
        allocated: "Të alokuara",
        name: "Emri"
      },
      totals: {
        line: (a, b, c) => `${a} të numëruara · ${b} në disk · ${c} në përdorim në vëllim`,
        lineNoVolume: (a, b) => `${a} të numëruara · ${b} në disk`,
        hardLinkNote: (a) => `${a} skedarë me disa emra numërohen vetëm një herë.`
      },
      filesView: {
        sortBy: "Rendit sipas"
      },
      search: {
        label: "Kërko emra",
        placeholder: "Tekst, * ? ose /regex/",
        clear: "Pastro kërkimin",
        invalid: "Ky model nuk është i vlefshëm.",
        noMatches: (a) => `Asgjë këtu nuk përputhet me "${a}".`
      },
      export: {
        csv: "Eksporto CSV",
        png: "Ruaj hartën si PNG",
        failed: (a) => `Eksportimi dështoi: ${a}`,
        done: (a) => `U eksportua: ${a}`
      },
      menu: {
        properties: "Vetitë",
        exclude: "Përjashto këtë dosje"
      },
      props: {
        path: "Shtegu",
        type: "Lloji",
        close: "Mbyll"
      },
      toasts: {
        excluded: (a) => `${a} do të anashkalohet në skanimet e ardhshme.`,
        alreadyExcluded: (a) => `${a} është tashmë i përjashtuar.`,
        excludeFailed: "Përjashtimi nuk u ruajt dot."
      },
      saved: {
        title: "Skanime të ruajtura",
        nameField: "Emri i këtij skanimi",
        save: "Ruaj skanimin aktual",
        saving: "Po ruhet…",
        saved: (a) => `Skanimi "${a}" u ruajt.`,
        nothingToSave: "Skanoni fillimisht një disk, pastaj mund ta ruani këtu.",
        empty: "Ende nuk ka skanime të ruajtura.",
        load: "Hap",
        delete: "Fshi",
        deleteConfirm: (a) => `Ta fshini "${a}" përgjithmonë?`,
        selectForCompare: (a) => `Zgjidh ${a} për krahasim`,
        compare: "Krahaso të zgjedhurat",
        pickTwo: "Zgjidhni dy skanime për t’i krahasuar.",
        partial: "I pjesshëm",
        viewing: (a, b) => `Po shihni skanimin e ruajtur "${a}" nga ${b}. Ky nuk është disku siç është tani.`,
        closeView: "Kthehu te skanimi aktual",
        failed: (a) => `Skanime të ruajtura: ${a}`
      },
      compare: {
        title: (a, b) => `Nga "${a}" te "${b}"`,
        total: (a) => `Ndryshimi total: ${a}`,
        grew: "U rritën më shumë",
        shrank: "U ulën më shumë",
        added: "Dosje të reja",
        removed: "Dosje të hequra",
        none: "Asgjë në këtë grup.",
        back: "Kthehu te lista",
        loading: "Po krahasohet…"
      },
      crawl: {
        note: "Lexon çdo dosje, një nga një. Një disk i tërë kërkon kohë: rezultatet shfaqen sa gjenden dhe mund të ndaloni kurdo, duke mbajtur çfarë u lexua.",
        limit: "Nuk kërkon leje. Një disk i tërë zgjat shumë më shumë se skanimi i shpejtë, por i shihni rezultatet sa vijnë dhe mund të ndaloni kurdo.",
        partialNote: "Po shfaqet çfarë është lexuar deri tani. Madhësitë vazhdojnë të rriten deri sa skanimi të përfundojë."
      }
    }
  },
  sr: {
    diskMapV3: {
      large: {
        tooLarge: "Диск има више датотека него што Prune може да обради у једном скенирању. Користите „undefined“ да га скенирате фасциклу по фасциклу или изузмите велике фасцикле у Подешавањима.",
        foldedNote: (a, b) => `Свака фасцикла приказује својих ${a} највећих датотека; осталих ${b} датотека је сабрано у један ред по фасцикли. И даље се рачунају у све збирове и у бројеве по врсти датотеке.`,
        foldedFloorNote: (a, b) => `Овај диск има толико датотека да се појединачно приказују само оне од ${b} или веће; осталих ${a} датотека је сабрано у један ред по фасцикли. И даље се рачунају у све збирове и у бројеве по врсти датотеке.`
      },
      drives: {
        label: "Дискови",
        system: "Системски",
        removable: "Преносиви",
        usage: (a, b) => `Искоришћено ${a} од ${b}`,
        scanned: "Скенирано",
        alsoScan: "Скенирај и ове дискове",
        alsoScanNote: "Дискови који се скенирају заједно деле један администраторски упит.",
        notNtfs: "Брзо скенирање је могуће само за NTFS дискове.",
        failed: (a, b) => `Није могуће скенирати ${a}: ${b}`
      },
      elevation: {
        runningAsAdmin: "Prune ради као администратор, па ово скенирање почиње без упита.",
        why: "Windows дозвољава само администраторима да директно читају индекс датотека диска, а управо то ово скенирање чини брзим.",
        restartHint: "Једном поново покрените Prune као администратор и наредна брза скенирања неће тражити упит.",
        restartButton: "Поново покрени Prune као администратор",
        restarting: "Поновно покретање…",
        restartDeclined: "Није одобрено — Prune и даље ради као раније.",
        restartFailed: (a) => `Није могуће поново покренути као администратор: ${a}`
      },
      columns: {
        allocated: "Додељено",
        name: "Назив"
      },
      totals: {
        line: (a, b, c) => `${a} урачунато · ${b} на диску · ${c} у употреби на волумену`,
        lineNoVolume: (a, b) => `${a} урачунато · ${b} на диску`,
        hardLinkNote: (a) => `${a} датотека са више имена рачуна се само једном.`
      },
      filesView: {
        sortBy: "Сортирај по"
      },
      search: {
        label: "Претражи називе",
        placeholder: "Текст, * ? или /regex/",
        clear: "Обриши претрагу",
        invalid: "Тај образац није исправан.",
        noMatches: (a) => `Овде ништа не одговара изразу "${a}".`
      },
      export: {
        csv: "Извези CSV",
        png: "Сачувај мапу као PNG",
        failed: (a) => `Извоз није успео: ${a}`,
        done: (a) => `Извезено: ${a}`
      },
      menu: {
        properties: "Својства",
        exclude: "Искључи ову фасциклу"
      },
      props: {
        path: "Путања",
        type: "Врста",
        close: "Затвори"
      },
      toasts: {
        excluded: (a) => `${a} ће бити прескочено у будућим скенирањима.`,
        alreadyExcluded: (a) => `${a} је већ искључено.`,
        excludeFailed: "Није могуће сачувати изузетак."
      },
      saved: {
        title: "Сачувана скенирања",
        nameField: "Назив овог скенирања",
        save: "Сачувај тренутно скенирање",
        saving: "Чување…",
        saved: (a) => `Скенирање "${a}" је сачувано.`,
        nothingToSave: "Прво скенирајте диск, па га можете сачувати овде.",
        empty: "Још нема сачуваних скенирања.",
        load: "Отвори",
        delete: "Обриши",
        deleteConfirm: (a) => `Обрисати "${a}" заувек?`,
        selectForCompare: (a) => `Изабери ${a} за поређење`,
        compare: "Упореди изабрано",
        pickTwo: "Изаберите два скенирања за поређење.",
        partial: "Делимично",
        viewing: (a, b) => `Гледате сачувано скенирање "${a}" од ${b}. Ово није тренутно стање диска.`,
        closeView: "Назад на тренутно скенирање",
        failed: (a) => `Сачувана скенирања: ${a}`
      },
      compare: {
        title: (a, b) => `Од "${a}" до "${b}"`,
        total: (a) => `Укупна промена: ${a}`,
        grew: "Највише порасло",
        shrank: "Највише смањено",
        added: "Нове фасцикле",
        removed: "Уклоњене фасцикле",
        none: "Нема ничега у овој групи.",
        back: "Назад на листу",
        loading: "Поређење…"
      },
      crawl: {
        note: "Чита сваку фасциклу, једну по једну. Цео диск траје: резултати се појављују како се проналазе, а можете да станете у било ком тренутку и задржите прочитано.",
        limit: "Не тражи дозволу. Цео диск траје много дуже од брзог скенирања, али резултате видите како стижу и можете стати кад желите.",
        partialNote: "Приказује се оно што је до сада прочитано. Величине расту док се скенирање не заврши."
      }
    }
  },
  sv: {
    diskMapV3: {
      large: {
        tooLarge: "Enheten har fler filer än Prune kan hantera i en enda skanning. Använd ”undefined” för att skanna den mapp för mapp, eller undanta stora mappar i Inställningar.",
        foldedNote: (a, b) => `Varje mapp visar sina ${a} största filer; de övriga ${b} filerna är sammanräknade på en rad per mapp. De räknas fortfarande med i alla summor och i filtypssiffrorna.`,
        foldedFloorNote: (a, b) => `Den här enheten har så många filer att bara filer på ${b} eller större visas enskilt; de övriga ${a} filerna är sammanräknade på en rad per mapp. De räknas fortfarande med i alla summor och i filtypssiffrorna.`
      },
      drives: {
        label: "Enheter",
        system: "System",
        removable: "Flyttbar",
        usage: (a, b) => `${a} av ${b} används`,
        scanned: "Skannad",
        alsoScan: "Skanna även dessa enheter",
        alsoScanNote: "Enheter som skannas tillsammans delar på en administratörsfråga.",
        notNtfs: "Bara NTFS-enheter kan snabbskannas.",
        failed: (a, b) => `Det gick inte att skanna ${a}: ${b}`
      },
      elevation: {
        runningAsAdmin: "Prune körs som administratör, så den här skanningen startar utan fråga.",
        why: "Windows låter bara administratörer läsa en enhets filindex direkt, och det är det som gör den här skanningen snabb.",
        restartHint: "Starta om Prune som administratör en gång, så behöver senare snabbskanningar ingen fråga.",
        restartButton: "Starta om Prune som administratör",
        restarting: "Startar om…",
        restartDeclined: "Inte godkänt — Prune körs fortfarande som förut.",
        restartFailed: (a) => `Det gick inte att starta om som administratör: ${a}`
      },
      columns: {
        allocated: "Allokerat",
        name: "Namn"
      },
      totals: {
        line: (a, b, c) => `${a} räknade · ${b} på disken · ${c} används på volymen`,
        lineNoVolume: (a, b) => `${a} räknade · ${b} på disken`,
        hardLinkNote: (a) => `${a} filer med flera namn räknas bara en gång.`
      },
      filesView: {
        sortBy: "Sortera efter"
      },
      search: {
        label: "Sök bland namn",
        placeholder: "Text, * ? eller /regex/",
        clear: "Rensa sökning",
        invalid: "Det mönstret är inte giltigt.",
        noMatches: (a) => `Inget här matchar "${a}".`
      },
      export: {
        csv: "Exportera CSV",
        png: "Spara kartan som PNG",
        failed: (a) => `Exporten misslyckades: ${a}`,
        done: (a) => `Exporterat: ${a}`
      },
      menu: {
        properties: "Egenskaper",
        exclude: "Exkludera den här mappen"
      },
      props: {
        path: "Sökväg",
        type: "Typ",
        close: "Stäng"
      },
      toasts: {
        excluded: (a) => `${a} hoppas över vid framtida skanningar.`,
        alreadyExcluded: (a) => `${a} är redan exkluderad.`,
        excludeFailed: "Det gick inte att spara undantaget."
      },
      saved: {
        title: "Sparade skanningar",
        nameField: "Namn på den här skanningen",
        save: "Spara nuvarande skanning",
        saving: "Sparar…",
        saved: (a) => `Skanningen "${a}" sparades.`,
        nothingToSave: "Skanna först en enhet, så kan du spara den här.",
        empty: "Inga sparade skanningar ännu.",
        load: "Öppna",
        delete: "Ta bort",
        deleteConfirm: (a) => `Ta bort "${a}" för alltid?`,
        selectForCompare: (a) => `Välj ${a} för jämförelse`,
        compare: "Jämför valda",
        pickTwo: "Välj två skanningar att jämföra.",
        partial: "Ofullständig",
        viewing: (a, b) => `Du tittar på den sparade skanningen "${a}" från ${b}. Det är inte enheten som den ser ut nu.`,
        closeView: "Tillbaka till den aktuella skanningen",
        failed: (a) => `Sparade skanningar: ${a}`
      },
      compare: {
        title: (a, b) => `Från "${a}" till "${b}"`,
        total: (a) => `Total förändring: ${a}`,
        grew: "Ökade mest",
        shrank: "Minskade mest",
        added: "Nya mappar",
        removed: "Borttagna mappar",
        none: "Inget i den här gruppen.",
        back: "Tillbaka till listan",
        loading: "Jämför…"
      },
      crawl: {
        note: "Läser varje mapp, en i taget. En hel enhet tar en stund: resultaten visas allt eftersom de hittas, och du kan stoppa när som helst och behålla det som lästs.",
        limit: "Kräver ingen behörighet. En hel enhet tar mycket längre tid än snabbskanning, men du ser resultaten allt eftersom och kan stoppa när du vill.",
        partialNote: "Visar det som lästs hittills. Storlekarna växer tills skanningen är klar."
      }
    }
  },
  th: {
    diskMapV3: {
      large: {
        tooLarge: "ไดรฟ์นี้มีไฟล์มากกว่าที่ Prune จะรับได้ในการสแกนครั้งเดียว ใช้ “undefined” เพื่อสแกนทีละโฟลเดอร์ หรือยกเว้นโฟลเดอร์ขนาดใหญ่ในการตั้งค่า",
        foldedNote: (a, b) => `แต่ละโฟลเดอร์แสดงไฟล์ที่ใหญ่ที่สุด ${a} ไฟล์ ส่วนไฟล์อื่นอีก ${b} ไฟล์ถูกรวมเป็นหนึ่งแถวต่อโฟลเดอร์ และยังคงนับรวมอยู่ในยอดรวมทุกรายการและตัวเลขตามประเภทไฟล์`,
        foldedFloorNote: (a, b) => `ไดรฟ์นี้มีไฟล์จำนวนมากจนแสดงแยกเฉพาะไฟล์ขนาด ${b} ขึ้นไป ส่วนไฟล์อื่นอีก ${a} ไฟล์ถูกรวมเป็นหนึ่งแถวต่อโฟลเดอร์ และยังคงนับรวมอยู่ในยอดรวมทุกรายการและตัวเลขตามประเภทไฟล์`
      },
      drives: {
        label: "ไดรฟ์",
        system: "ระบบ",
        removable: "ถอดได้",
        usage: (a, b) => `ใช้ไปแล้ว ${a} จาก ${b}`,
        scanned: "สแกนแล้ว",
        alsoScan: "สแกนไดรฟ์เหล่านี้ด้วย",
        alsoScanNote: "ไดรฟ์ที่สแกนพร้อมกันใช้การขอสิทธิ์ผู้ดูแลระบบครั้งเดียวร่วมกัน",
        notNtfs: "สแกนแบบเร็วได้เฉพาะไดรฟ์ NTFS เท่านั้น",
        failed: (a, b) => `สแกน ${a} ไม่ได้: ${b}`
      },
      elevation: {
        runningAsAdmin: "Prune ทำงานในฐานะผู้ดูแลระบบ การสแกนนี้จึงเริ่มโดยไม่ต้องขอสิทธิ์",
        why: "Windows อนุญาตให้เฉพาะผู้ดูแลระบบอ่านดัชนีไฟล์ของไดรฟ์โดยตรง ซึ่งเป็นสิ่งที่ทำให้การสแกนนี้เร็ว",
        restartHint: "รีสตาร์ท Prune ในฐานะผู้ดูแลระบบหนึ่งครั้ง การสแกนแบบเร็วครั้งต่อไปจะไม่ต้องขอสิทธิ์อีก",
        restartButton: "รีสตาร์ท Prune ในฐานะผู้ดูแลระบบ",
        restarting: "กำลังรีสตาร์ท…",
        restartDeclined: "ไม่ได้รับอนุมัติ — Prune ยังทำงานเหมือนเดิม",
        restartFailed: (a) => `รีสตาร์ทในฐานะผู้ดูแลระบบไม่ได้: ${a}`
      },
      columns: {
        allocated: "จัดสรรแล้ว",
        name: "ชื่อ"
      },
      totals: {
        line: (a, b, c) => `นับได้ ${a} · บนดิสก์ ${b} · ใช้อยู่บนวอลุ่ม ${c}`,
        lineNoVolume: (a, b) => `นับได้ ${a} · บนดิสก์ ${b}`,
        hardLinkNote: (a) => `ไฟล์ ${a} ไฟล์ที่มีหลายชื่อจะนับเพียงครั้งเดียว`
      },
      filesView: {
        sortBy: "เรียงตาม"
      },
      search: {
        label: "ค้นหาชื่อ",
        placeholder: "ข้อความ, * ? หรือ /regex/",
        clear: "ล้างการค้นหา",
        invalid: "รูปแบบนี้ไม่ถูกต้อง",
        noMatches: (a) => `ไม่มีรายการที่ตรงกับ "${a}" ที่นี่`
      },
      export: {
        csv: "ส่งออก CSV",
        png: "บันทึกแผนที่เป็น PNG",
        failed: (a) => `ส่งออกไม่สำเร็จ: ${a}`,
        done: (a) => `ส่งออกแล้ว: ${a}`
      },
      menu: {
        properties: "คุณสมบัติ",
        exclude: "ยกเว้นโฟลเดอร์นี้"
      },
      props: {
        path: "เส้นทาง",
        type: "ประเภท",
        close: "ปิด"
      },
      toasts: {
        excluded: (a) => `${a} จะถูกข้ามในการสแกนครั้งต่อไป`,
        alreadyExcluded: (a) => `${a} ถูกยกเว้นอยู่แล้ว`,
        excludeFailed: "บันทึกการยกเว้นไม่ได้"
      },
      saved: {
        title: "การสแกนที่บันทึกไว้",
        nameField: "ชื่อของการสแกนนี้",
        save: "บันทึกการสแกนปัจจุบัน",
        saving: "กำลังบันทึก…",
        saved: (a) => `บันทึกการสแกน "${a}" แล้ว`,
        nothingToSave: "สแกนไดรฟ์ก่อน แล้วจึงบันทึกที่นี่ได้",
        empty: "ยังไม่มีการสแกนที่บันทึกไว้",
        load: "เปิด",
        delete: "ลบ",
        deleteConfirm: (a) => `ลบ "${a}" ถาวรหรือไม่`,
        selectForCompare: (a) => `เลือก ${a} เพื่อเปรียบเทียบ`,
        compare: "เปรียบเทียบที่เลือก",
        pickTwo: "เลือกการสแกนสองรายการเพื่อเปรียบเทียบ",
        partial: "บางส่วน",
        viewing: (a, b) => `คุณกำลังดูการสแกน "${a}" ที่บันทึกไว้เมื่อ ${b} นี่ไม่ใช่สถานะปัจจุบันของไดรฟ์`,
        closeView: "กลับไปที่การสแกนปัจจุบัน",
        failed: (a) => `การสแกนที่บันทึกไว้: ${a}`
      },
      compare: {
        title: (a, b) => `จาก "${a}" ไปยัง "${b}"`,
        total: (a) => `การเปลี่ยนแปลงรวม: ${a}`,
        grew: "เพิ่มขึ้นมากที่สุด",
        shrank: "ลดลงมากที่สุด",
        added: "โฟลเดอร์ใหม่",
        removed: "โฟลเดอร์ที่ถูกลบ",
        none: "ไม่มีรายการในกลุ่มนี้",
        back: "กลับไปที่รายการ",
        loading: "กำลังเปรียบเทียบ…"
      },
      crawl: {
        note: "อ่านทีละโฟลเดอร์ ทั้งไดรฟ์ใช้เวลาสักพัก ผลลัพธ์จะแสดงทันทีที่พบ และคุณหยุดได้ทุกเมื่อโดยเก็บสิ่งที่อ่านไปแล้วไว้",
        limit: "ไม่ต้องใช้สิทธิ์ ทั้งไดรฟ์ใช้เวลานานกว่าการสแกนแบบเร็วมาก แต่คุณเห็นผลลัพธ์ทันทีที่มาถึงและหยุดได้ตามต้องการ",
        partialNote: "แสดงสิ่งที่อ่านได้จนถึงตอนนี้ ขนาดจะเพิ่มขึ้นเรื่อย ๆ จนกว่าการสแกนจะเสร็จ"
      }
    }
  },
  tr: {
    diskMapV3: {
      large: {
        tooLarge: "Sürücüde, Prune'un tek taramada işleyebileceğinden fazla dosya var. Klasör klasör taramak için “undefined” seçeneğini kullanın veya Ayarlar'da büyük klasörleri hariç tutun.",
        foldedNote: (a, b) => `Her klasör en büyük ${a} dosyasını listeler; diğer ${b} dosya klasör başına tek satırda toplanır. Bunlar yine de tüm toplamlara ve dosya türü rakamlarına dahildir.`,
        foldedFloorNote: (a, b) => `Bu sürücüde o kadar çok dosya var ki yalnızca ${b} ve üzeri boyuttaki dosyalar tek tek listelenir; diğer ${a} dosya klasör başına tek satırda toplanır. Bunlar yine de tüm toplamlara ve dosya türü rakamlarına dahildir.`
      },
      drives: {
        label: "Sürücüler",
        system: "Sistem",
        removable: "Çıkarılabilir",
        usage: (a, b) => `${b} içinde ${a} kullanılıyor`,
        scanned: "Tarandı",
        alsoScan: "Şu sürücüleri de tara",
        alsoScanNote: "Birlikte taranan sürücüler tek bir yönetici isteğini paylaşır.",
        notNtfs: "Yalnızca NTFS sürücüler hızlı taranabilir.",
        failed: (a, b) => `${a} taranamadı: ${b}`
      },
      elevation: {
        runningAsAdmin: "Prune yönetici olarak çalışıyor, bu yüzden bu tarama istek olmadan başlar.",
        why: "Windows, bir sürücünün dosya dizinini doğrudan yalnızca yöneticilerin okumasına izin verir; bu tarama da bu sayede hızlıdır.",
        restartHint: "Prune’u bir kez yönetici olarak yeniden başlatın; sonraki hızlı taramalar istek gerektirmez.",
        restartButton: "Prune’u yönetici olarak yeniden başlat",
        restarting: "Yeniden başlatılıyor…",
        restartDeclined: "Onaylanmadı — Prune eskisi gibi çalışmaya devam ediyor.",
        restartFailed: (a) => `Yönetici olarak yeniden başlatılamadı: ${a}`
      },
      columns: {
        allocated: "Ayrılan",
        name: "Ad"
      },
      totals: {
        line: (a, b, c) => `${a} sayıldı · ${b} diskte · ${c} birimde kullanımda`,
        lineNoVolume: (a, b) => `${a} sayıldı · ${b} diskte`,
        hardLinkNote: (a) => `Birden fazla adı olan ${a} dosya yalnızca bir kez sayılır.`
      },
      filesView: {
        sortBy: "Sırala"
      },
      search: {
        label: "Adlarda ara",
        placeholder: "Metin, * ? veya /regex/",
        clear: "Aramayı temizle",
        invalid: "Bu desen geçerli değil.",
        noMatches: (a) => `Burada "${a}" ile eşleşen bir şey yok.`
      },
      export: {
        csv: "CSV olarak dışa aktar",
        png: "Haritayı PNG olarak kaydet",
        failed: (a) => `Dışa aktarılamadı: ${a}`,
        done: (a) => `Dışa aktarıldı: ${a}`
      },
      menu: {
        properties: "Özellikler",
        exclude: "Bu klasörü hariç tut"
      },
      props: {
        path: "Yol",
        type: "Tür",
        close: "Kapat"
      },
      toasts: {
        excluded: (a) => `${a} sonraki taramalarda atlanacak.`,
        alreadyExcluded: (a) => `${a} zaten hariç tutuluyor.`,
        excludeFailed: "Bu hariç tutma kaydedilemedi."
      },
      saved: {
        title: "Kayıtlı taramalar",
        nameField: "Bu taramanın adı",
        save: "Geçerli taramayı kaydet",
        saving: "Kaydediliyor…",
        saved: (a) => `"${a}" taraması kaydedildi.`,
        nothingToSave: "Önce bir sürücüyü tarayın, sonra burada kaydedebilirsiniz.",
        empty: "Henüz kayıtlı tarama yok.",
        load: "Aç",
        delete: "Sil",
        deleteConfirm: (a) => `"${a}" kalıcı olarak silinsin mi?`,
        selectForCompare: (a) => `Karşılaştırmak için ${a} öğesini seç`,
        compare: "Seçilenleri karşılaştır",
        pickTwo: "Karşılaştırmak için iki tarama seçin.",
        partial: "Kısmi",
        viewing: (a, b) => `${b} tarihli kayıtlı "${a}" taramasını görüntülüyorsunuz. Bu, sürücünün şu anki hali değil.`,
        closeView: "Geçerli taramaya dön",
        failed: (a) => `Kayıtlı taramalar: ${a}`
      },
      compare: {
        title: (a, b) => `"${a}" taramasından "${b}" taramasına`,
        total: (a) => `Toplam değişim: ${a}`,
        grew: "En çok büyüyenler",
        shrank: "En çok küçülenler",
        added: "Yeni klasörler",
        removed: "Kaldırılan klasörler",
        none: "Bu grupta hiçbir şey yok.",
        back: "Listeye dön",
        loading: "Karşılaştırılıyor…"
      },
      crawl: {
        note: "Her klasörü tek tek okur. Tüm bir sürücü biraz zaman alır: sonuçlar bulundukça görünür ve istediğiniz zaman durdurup okunanları koruyabilirsiniz.",
        limit: "İzin gerektirmez. Tüm bir sürücü hızlı taramadan çok daha uzun sürer, ancak sonuçları geldikçe görürsünüz ve istediğiniz an durdurabilirsiniz.",
        partialNote: "Şimdiye kadar okunanlar gösteriliyor. Tarama bitene kadar boyutlar artmaya devam eder."
      }
    }
  },
  uk: {
    diskMapV3: {
      large: {
        tooLarge: "На диску більше файлів, ніж Prune може обробити за одне сканування. Скористайтеся «undefined», щоб сканувати його папка за папкою, або виключіть великі папки в Налаштуваннях.",
        foldedNote: (a, b) => `Кожна папка показує ${a} найбільших файлів; решту ${b} файлів об’єднано в один рядок на папку. Вони й надалі враховуються в усіх підсумках і в даних за типами файлів.`,
        foldedFloorNote: (a, b) => `На цьому диску так багато файлів, що окремо показано лише файли розміром ${b} і більше; решту ${a} файлів об’єднано в один рядок на папку. Вони й надалі враховуються в усіх підсумках і в даних за типами файлів.`
      },
      drives: {
        label: "Диски",
        system: "Системний",
        removable: "Знімний",
        usage: (a, b) => `Використано ${a} із ${b}`,
        scanned: "Проскановано",
        alsoScan: "Також сканувати ці диски",
        alsoScanNote: "Диски, що скануються разом, використовують один запит адміністратора.",
        notNtfs: "Швидке сканування доступне лише для дисків NTFS.",
        failed: (a, b) => `Не вдалося просканувати ${a}: ${b}`
      },
      elevation: {
        runningAsAdmin: "Prune працює від імені адміністратора, тож це сканування починається без запиту.",
        why: "Windows дозволяє безпосередньо читати файловий індекс диска лише адміністраторам — саме це робить сканування швидким.",
        restartHint: "Один раз перезапустіть Prune від імені адміністратора — і наступні швидкі сканування не потребуватимуть запиту.",
        restartButton: "Перезапустити Prune від імені адміністратора",
        restarting: "Перезапуск…",
        restartDeclined: "Не підтверджено — Prune працює як і раніше.",
        restartFailed: (a) => `Не вдалося перезапустити від імені адміністратора: ${a}`
      },
      columns: {
        allocated: "Виділено",
        name: "Назва"
      },
      totals: {
        line: (a, b, c) => `${a} враховано · ${b} на диску · ${c} зайнято на томі`,
        lineNoVolume: (a, b) => `${a} враховано · ${b} на диску`,
        hardLinkNote: (a) => `${a} файлів із кількома іменами враховано лише раз.`
      },
      filesView: {
        sortBy: "Сортувати за"
      },
      search: {
        label: "Пошук за назвами",
        placeholder: "Текст, * ? або /regex/",
        clear: "Очистити пошук",
        invalid: "Недійсний шаблон.",
        noMatches: (a) => `Тут немає збігів із "${a}".`
      },
      export: {
        csv: "Експортувати в CSV",
        png: "Зберегти карту як PNG",
        failed: (a) => `Не вдалося експортувати: ${a}`,
        done: (a) => `Експортовано: ${a}`
      },
      menu: {
        properties: "Властивості",
        exclude: "Виключити цю папку"
      },
      props: {
        path: "Шлях",
        type: "Тип",
        close: "Закрити"
      },
      toasts: {
        excluded: (a) => `${a} буде пропущено під час наступних сканувань.`,
        alreadyExcluded: (a) => `${a} уже виключено.`,
        excludeFailed: "Не вдалося зберегти виняток."
      },
      saved: {
        title: "Збережені сканування",
        nameField: "Назва цього сканування",
        save: "Зберегти поточне сканування",
        saving: "Збереження…",
        saved: (a) => `Сканування "${a}" збережено.`,
        nothingToSave: "Спершу просканіруйте диск — потім його можна буде зберегти тут.",
        empty: "Збережених сканувань ще немає.",
        load: "Відкрити",
        delete: "Видалити",
        deleteConfirm: (a) => `Видалити "${a}" назавжди?`,
        selectForCompare: (a) => `Вибрати ${a} для порівняння`,
        compare: "Порівняти вибране",
        pickTwo: "Виберіть два сканування для порівняння.",
        partial: "Часткове",
        viewing: (a, b) => `Ви переглядаєте збережене сканування "${a}" від ${b}. Це не поточний стан диска.`,
        closeView: "Назад до поточного сканування",
        failed: (a) => `Збережені сканування: ${a}`
      },
      compare: {
        title: (a, b) => `Від "${a}" до "${b}"`,
        total: (a) => `Загальна зміна: ${a}`,
        grew: "Зросли найбільше",
        shrank: "Зменшилися найбільше",
        added: "Нові папки",
        removed: "Видалені папки",
        none: "У цій групі нічого немає.",
        back: "Назад до списку",
        loading: "Порівняння…"
      },
      crawl: {
        note: "Читає папки по одній. Цілий диск потребує часу: результати з’являються в міру знаходження, а зупинити можна будь-коли, зберігши прочитане.",
        limit: "Прав не потрібно. Цілий диск займає значно більше часу, ніж швидке сканування, але результати видно в міру надходження, а зупинити можна будь-коли.",
        partialNote: "Показано те, що прочитано на цей момент. Розміри зростають, доки сканування не завершиться."
      }
    }
  },
  vi: {
    diskMapV3: {
      large: {
        tooLarge: "Ổ đĩa có nhiều tệp hơn mức Prune có thể xử lý trong một lần quét. Hãy dùng “undefined” để quét từng thư mục một, hoặc loại trừ các thư mục lớn trong Cài đặt.",
        foldedNote: (a, b) => `Mỗi thư mục liệt kê ${a} tệp lớn nhất; ${b} tệp còn lại được cộng gộp thành một dòng cho mỗi thư mục. Chúng vẫn được tính vào mọi tổng số và số liệu theo loại tệp.`,
        foldedFloorNote: (a, b) => `Ổ đĩa này có nhiều tệp đến mức chỉ các tệp từ ${b} trở lên được liệt kê riêng; ${a} tệp còn lại được cộng gộp thành một dòng cho mỗi thư mục. Chúng vẫn được tính vào mọi tổng số và số liệu theo loại tệp.`
      },
      drives: {
        label: "Ổ đĩa",
        system: "Hệ thống",
        removable: "Di động",
        usage: (a, b) => `Đã dùng ${a} / ${b}`,
        scanned: "Đã quét",
        alsoScan: "Quét cả các ổ đĩa này",
        alsoScanNote: "Các ổ đĩa quét cùng nhau dùng chung một lần yêu cầu quyền quản trị.",
        notNtfs: "Chỉ ổ đĩa NTFS mới quét nhanh được.",
        failed: (a, b) => `Không quét được ${a}: ${b}`
      },
      elevation: {
        runningAsAdmin: "Prune đang chạy với quyền quản trị nên lần quét này bắt đầu mà không cần yêu cầu.",
        why: "Windows chỉ cho phép quản trị viên đọc trực tiếp chỉ mục tệp của ổ đĩa, và đó là điều làm cho lần quét này nhanh.",
        restartHint: "Hãy khởi động lại Prune với quyền quản trị một lần, các lần quét nhanh sau sẽ không cần yêu cầu nữa.",
        restartButton: "Khởi động lại Prune với quyền quản trị",
        restarting: "Đang khởi động lại…",
        restartDeclined: "Chưa được chấp thuận — Prune vẫn chạy như trước.",
        restartFailed: (a) => `Không thể khởi động lại với quyền quản trị: ${a}`
      },
      columns: {
        allocated: "Đã cấp phát",
        name: "Tên"
      },
      totals: {
        line: (a, b, c) => `${a} đã tính · ${b} trên đĩa · ${c} đang dùng trên ổ`,
        lineNoVolume: (a, b) => `${a} đã tính · ${b} trên đĩa`,
        hardLinkNote: (a) => `${a} tệp có nhiều tên chỉ được tính một lần.`
      },
      filesView: {
        sortBy: "Sắp xếp theo"
      },
      search: {
        label: "Tìm theo tên",
        placeholder: "Văn bản, * ? hoặc /regex/",
        clear: "Xóa tìm kiếm",
        invalid: "Mẫu này không hợp lệ.",
        noMatches: (a) => `Không có mục nào ở đây khớp với "${a}".`
      },
      export: {
        csv: "Xuất CSV",
        png: "Lưu bản đồ dạng PNG",
        failed: (a) => `Xuất không thành công: ${a}`,
        done: (a) => `Đã xuất: ${a}`
      },
      menu: {
        properties: "Thuộc tính",
        exclude: "Loại trừ thư mục này"
      },
      props: {
        path: "Đường dẫn",
        type: "Loại",
        close: "Đóng"
      },
      toasts: {
        excluded: (a) => `${a} sẽ bị bỏ qua trong các lần quét sau.`,
        alreadyExcluded: (a) => `${a} đã được loại trừ.`,
        excludeFailed: "Không thể lưu mục loại trừ đó."
      },
      saved: {
        title: "Các lần quét đã lưu",
        nameField: "Tên cho lần quét này",
        save: "Lưu lần quét hiện tại",
        saving: "Đang lưu…",
        saved: (a) => `Đã lưu lần quét "${a}".`,
        nothingToSave: "Hãy quét một ổ đĩa trước, rồi bạn có thể lưu tại đây.",
        empty: "Chưa có lần quét nào được lưu.",
        load: "Mở",
        delete: "Xóa",
        deleteConfirm: (a) => `Xóa vĩnh viễn "${a}"?`,
        selectForCompare: (a) => `Chọn ${a} để so sánh`,
        compare: "So sánh mục đã chọn",
        pickTwo: "Chọn hai lần quét để so sánh.",
        partial: "Một phần",
        viewing: (a, b) => `Bạn đang xem lần quét đã lưu "${a}" từ ${b}. Đây không phải trạng thái hiện tại của ổ đĩa.`,
        closeView: "Quay lại lần quét hiện tại",
        failed: (a) => `Các lần quét đã lưu: ${a}`
      },
      compare: {
        title: (a, b) => `Từ "${a}" đến "${b}"`,
        total: (a) => `Tổng thay đổi: ${a}`,
        grew: "Tăng nhiều nhất",
        shrank: "Giảm nhiều nhất",
        added: "Thư mục mới",
        removed: "Thư mục đã xóa",
        none: "Không có gì trong nhóm này.",
        back: "Quay lại danh sách",
        loading: "Đang so sánh…"
      },
      crawl: {
        note: "Đọc từng thư mục một. Cả ổ đĩa cần một lúc: kết quả hiện ra ngay khi tìm thấy, và bạn có thể dừng bất cứ lúc nào để giữ phần đã đọc.",
        limit: "Không cần cấp quyền. Cả ổ đĩa mất nhiều thời gian hơn quét nhanh rất nhiều, nhưng bạn thấy kết quả ngay khi có và có thể dừng bất cứ lúc nào.",
        partialNote: "Đang hiển thị phần đã đọc đến lúc này. Kích thước tiếp tục tăng cho đến khi quét xong."
      }
    }
  },
  "zh-CN": {
    diskMapV3: {
      large: {
        tooLarge: "此驱动器上的文件数量超过了 Prune 一次扫描所能容纳的上限。请使用“undefined”逐个文件夹扫描，或在设置中排除较大的文件夹。",
        foldedNote: (a, b) => `每个文件夹列出其最大的 ${a} 个文件；其余 ${b} 个文件按文件夹合并为一行。它们仍计入所有合计和文件类型数据。`,
        foldedFloorNote: (a, b) => `此驱动器上的文件太多，只有 ${b} 及以上的文件会单独列出；其余 ${a} 个文件按文件夹合并为一行。它们仍计入所有合计和文件类型数据。`
      },
      drives: {
        label: "驱动器",
        system: "系统",
        removable: "可移动",
        usage: (a, b) => `已用 ${a}，共 ${b}`,
        scanned: "已扫描",
        alsoScan: "同时扫描这些驱动器",
        alsoScanNote: "一起扫描的驱动器只需一次管理员授权。",
        notNtfs: "只有 NTFS 驱动器可以快速扫描。",
        failed: (a, b) => `无法扫描 ${a}：${b}`
      },
      elevation: {
        runningAsAdmin: "Prune 正以管理员身份运行，因此此次扫描无需授权即可开始。",
        why: "Windows 只允许管理员直接读取驱动器的文件索引，这正是此次扫描速度很快的原因。",
        restartHint: "以管理员身份重启一次 Prune，之后的快速扫描就无需授权了。",
        restartButton: "以管理员身份重启 Prune",
        restarting: "正在重启…",
        restartDeclined: "未获批准 — Prune 仍照常运行。",
        restartFailed: (a) => `无法以管理员身份重启：${a}`
      },
      columns: {
        allocated: "已分配",
        name: "名称"
      },
      totals: {
        line: (a, b, c) => `已统计 ${a} · 磁盘占用 ${b} · 卷已用 ${c}`,
        lineNoVolume: (a, b) => `已统计 ${a} · 磁盘占用 ${b}`,
        hardLinkNote: (a) => `${a} 个有多个名称的文件只计算一次。`
      },
      filesView: {
        sortBy: "排序方式"
      },
      search: {
        label: "搜索名称",
        placeholder: "文本、* ? 或 /regex/",
        clear: "清除搜索",
        invalid: "此模式无效。",
        noMatches: (a) => `这里没有与 "${a}" 匹配的内容。`
      },
      export: {
        csv: "导出 CSV",
        png: "将地图另存为 PNG",
        failed: (a) => `导出失败：${a}`,
        done: (a) => `已导出：${a}`
      },
      menu: {
        properties: "属性",
        exclude: "排除此文件夹"
      },
      props: {
        path: "路径",
        type: "类型",
        close: "关闭"
      },
      toasts: {
        excluded: (a) => `后续扫描将跳过 ${a}。`,
        alreadyExcluded: (a) => `${a} 已被排除。`,
        excludeFailed: "无法保存该排除项。"
      },
      saved: {
        title: "已保存的扫描",
        nameField: "此次扫描的名称",
        save: "保存当前扫描",
        saving: "正在保存…",
        saved: (a) => `已保存扫描 "${a}"。`,
        nothingToSave: "请先扫描一个驱动器，然后即可在此保存。",
        empty: "还没有已保存的扫描。",
        load: "打开",
        delete: "删除",
        deleteConfirm: (a) => `要永久删除 "${a}" 吗？`,
        selectForCompare: (a) => `选择 ${a} 进行比较`,
        compare: "比较所选项",
        pickTwo: "请选择两个要比较的扫描。",
        partial: "部分",
        viewing: (a, b) => `您正在查看 ${b} 保存的扫描 "${a}"。这不是驱动器当前的状态。`,
        closeView: "返回当前扫描",
        failed: (a) => `已保存的扫描：${a}`
      },
      compare: {
        title: (a, b) => `从 "${a}" 到 "${b}"`,
        total: (a) => `总变化：${a}`,
        grew: "增长最多",
        shrank: "减少最多",
        added: "新文件夹",
        removed: "已删除的文件夹",
        none: "此组中没有内容。",
        back: "返回列表",
        loading: "正在比较…"
      },
      crawl: {
        note: "逐个读取文件夹。整个驱动器需要一些时间：结果会边找到边显示，您可随时停止并保留已读取的内容。",
        limit: "无需权限。整个驱动器比快速扫描慢得多，但结果会实时显示，您可随时停止。",
        partialNote: "显示目前已读取的内容。在扫描完成之前，大小会持续增长。"
      }
    }
  },
  "zh-TW": {
    diskMapV3: {
      large: {
        tooLarge: "此磁碟機上的檔案數量超過 Prune 一次掃描所能容納的上限。請使用「undefined」逐一資料夾掃描，或在設定中排除較大的資料夾。",
        foldedNote: (a, b) => `每個資料夾列出其最大的 ${a} 個檔案；其餘 ${b} 個檔案依資料夾合併為一列。它們仍計入所有總計和檔案類型數據。`,
        foldedFloorNote: (a, b) => `此磁碟機上的檔案太多，只有 ${b} 以上的檔案會個別列出；其餘 ${a} 個檔案依資料夾合併為一列。它們仍計入所有總計和檔案類型數據。`
      },
      drives: {
        label: "磁碟機",
        system: "系統",
        removable: "卸除式",
        usage: (a, b) => `已使用 ${a}，共 ${b}`,
        scanned: "已掃描",
        alsoScan: "同時掃描這些磁碟機",
        alsoScanNote: "一起掃描的磁碟機只需一次系統管理員授權。",
        notNtfs: "只有 NTFS 磁碟機可以快速掃描。",
        failed: (a, b) => `無法掃描 ${a}：${b}`
      },
      elevation: {
        runningAsAdmin: "Prune 正以系統管理員身分執行，因此這次掃描不需授權即可開始。",
        why: "Windows 只允許系統管理員直接讀取磁碟機的檔案索引，這正是這次掃描很快的原因。",
        restartHint: "以系統管理員身分重新啟動一次 Prune，之後的快速掃描就不需授權了。",
        restartButton: "以系統管理員身分重新啟動 Prune",
        restarting: "正在重新啟動…",
        restartDeclined: "未獲核准 — Prune 仍照常執行。",
        restartFailed: (a) => `無法以系統管理員身分重新啟動：${a}`
      },
      columns: {
        allocated: "已配置",
        name: "名稱"
      },
      totals: {
        line: (a, b, c) => `已統計 ${a} · 磁碟占用 ${b} · 磁碟區已使用 ${c}`,
        lineNoVolume: (a, b) => `已統計 ${a} · 磁碟占用 ${b}`,
        hardLinkNote: (a) => `${a} 個有多個名稱的檔案只計算一次。`
      },
      filesView: {
        sortBy: "排序方式"
      },
      search: {
        label: "搜尋名稱",
        placeholder: "文字、* ? 或 /regex/",
        clear: "清除搜尋",
        invalid: "此模式無效。",
        noMatches: (a) => `這裡沒有符合 "${a}" 的項目。`
      },
      export: {
        csv: "匯出 CSV",
        png: "將地圖另存為 PNG",
        failed: (a) => `匯出失敗：${a}`,
        done: (a) => `已匯出：${a}`
      },
      menu: {
        properties: "內容",
        exclude: "排除此資料夾"
      },
      props: {
        path: "路徑",
        type: "類型",
        close: "關閉"
      },
      toasts: {
        excluded: (a) => `後續掃描將略過 ${a}。`,
        alreadyExcluded: (a) => `${a} 已被排除。`,
        excludeFailed: "無法儲存該排除項目。"
      },
      saved: {
        title: "已儲存的掃描",
        nameField: "此次掃描的名稱",
        save: "儲存目前的掃描",
        saving: "正在儲存…",
        saved: (a) => `已儲存掃描 "${a}"。`,
        nothingToSave: "請先掃描一個磁碟機，之後即可在此儲存。",
        empty: "尚無已儲存的掃描。",
        load: "開啟",
        delete: "刪除",
        deleteConfirm: (a) => `要永久刪除 "${a}" 嗎？`,
        selectForCompare: (a) => `選擇 ${a} 進行比較`,
        compare: "比較所選項目",
        pickTwo: "請選擇兩個要比較的掃描。",
        partial: "部分",
        viewing: (a, b) => `您正在檢視 ${b} 儲存的掃描 "${a}"。這不是磁碟機目前的狀態。`,
        closeView: "返回目前的掃描",
        failed: (a) => `已儲存的掃描：${a}`
      },
      compare: {
        title: (a, b) => `從 "${a}" 到 "${b}"`,
        total: (a) => `總變化：${a}`,
        grew: "增加最多",
        shrank: "減少最多",
        added: "新資料夾",
        removed: "已移除的資料夾",
        none: "此群組中沒有內容。",
        back: "返回清單",
        loading: "正在比較…"
      },
      crawl: {
        note: "逐一讀取資料夾。整個磁碟機需要一些時間：結果會邊找到邊顯示，您可隨時停止並保留已讀取的內容。",
        limit: "不需要權限。整個磁碟機比快速掃描慢得多，但結果會即時顯示，您可隨時停止。",
        partialNote: "顯示目前已讀取的內容。在掃描完成前，大小會持續增加。"
      }
    }
  }
};
