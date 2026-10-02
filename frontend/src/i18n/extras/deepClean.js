// New UI text for Deep Clean, all 40 languages: { en: { ... }, af: { ... }, ... }.
// See the note at the bottom of ../catalog.js. Generated from the per-feature
// translation tables; if you edit it by hand, keep all 40 languages.
export default {
  en: {
    deepCleanV3: {
      overwrite: {
        title: "Overwrite files before deleting",
        description: "When Prune deletes something for good (Delete now, or Delete permanently after an uninstall), it first writes over the file's contents. This is slower, and it is not reliable on SSDs, copy-on-write or journaling file systems, or in synced or backed-up folders. It does not apply to Quarantine or the Recycle Bin.",
        passes: "Overwrite passes",
        pass1: "1 pass (zeros)",
        pass3: "3 passes (random data)"
      },
      shred: {
        open: "Shred files…",
        title: "Shred files and folders",
        intro: "Choose files or folders to overwrite and delete. Shredded items cannot be recovered, and they skip Quarantine and the Recycle Bin.",
        chooseFiles: "Choose files…",
        chooseFolders: "Choose folders…",
        dropHint: "Or drop files and folders here",
        typeLabel: "Paths, one per line",
        add: "Add to list",
        remove: (a) => `Remove ${a} from the list`,
        empty: "Nothing chosen yet.",
        continue: "Continue",
        ssdNote: "Overwriting is not reliable on SSDs, copy-on-write or journaling file systems, or in synced or backed-up folders.",
        confirmTitle: "Shred these permanently?",
        confirmBody: (a, b) => `Files to shred: ${a} (${b}). Their contents cannot be recovered, and nothing goes to Quarantine or the Recycle Bin.`,
        truncated: "There are so many files that the count stopped early. The real total is larger.",
        refusedHeading: (a) => `Left alone because they are protected: ${a}`,
        confirmButton: "Shred permanently",
        running: "Shredding…",
        progress: (a, b) => `Files shredded: ${a} (${b})`,
        resultDone: (a, b) => `Done. Files shredded: ${a} (${b}).`,
        resultStopped: (a, b) => `Stopped. Files shredded: ${a} (${b}).`,
        failedHeading: (a) => `Could not be shredded: ${a}`,
        done: "Done",
        error: (a) => `Shredding failed: ${a}`
      },
      wipe: {
        body: "This overwrites the free space on the drive you choose, then deletes the filler, so files you deleted earlier can't be recovered. It frees no space.",
        driveLabel: "Drive to wipe",
        driveOption: (a, b, c) => `${a} · ${b} free of ${c}`,
        progressPass: (a, b, c, d) => `Pass ${a} of ${b}: writing random data… ${c} of ${d}`,
        resultRandom: (a, b) => `Wrote ${a} of random data over the free space in ${b} passes, then deleted it. No space was freed.`,
        resultRandomStopped: (a) => `Stopped after writing ${a} of random data over the free space. The filler was deleted.`
      }
    }
  },
  af: {
    deepCleanV3: {
      overwrite: {
        title: "Oorskryf lêers voor verwydering",
        description: "Wanneer Prune iets vir goed verwyder (Verwyder nou, of Verwyder permanent ná 'n deïnstallasie), skryf dit eers oor die lêer se inhoud. Dit is stadiger, en dit is nie betroubaar op SSD's, kopieer-met-skryf- of joernaliserende lêerstelsels, of in gesinkroniseerde of gerugsteunde vouers nie. Dit geld nie vir Karantyn of die Asblik nie.",
        passes: "Oorskryf-deurgange",
        pass1: "1 deurgang (nulle)",
        pass3: "3 deurgange (ewekansige data)"
      },
      shred: {
        open: "Versnipper lêers…",
        title: "Versnipper lêers en vouers",
        intro: "Kies lêers of vouers om oor te skryf en te verwyder. Versnipperde items kan nie herstel word nie en slaan Karantyn en die Asblik oor.",
        chooseFiles: "Kies lêers…",
        chooseFolders: "Kies vouers…",
        dropHint: "Of los lêers en vouers hier",
        typeLabel: "Paaie, een per reël",
        add: "Voeg by lys",
        remove: (a) => `Verwyder ${a} van die lys`,
        empty: "Niks gekies nie.",
        continue: "Gaan voort",
        ssdNote: "Oorskryf is nie betroubaar op SSD's, kopieer-met-skryf- of joernaliserende lêerstelsels, of in gesinkroniseerde of gerugsteunde vouers nie.",
        confirmTitle: "Hierdie permanent versnipper?",
        confirmBody: (a, b) => `Lêers om te versnipper: ${a} (${b}). Hul inhoud kan nie herstel word nie, en niks gaan na Karantyn of die Asblik nie.`,
        truncated: "Daar is so baie lêers dat die telling vroeg gestop het. Die werklike totaal is groter.",
        refusedHeading: (a) => `Met rus gelaat omdat hulle beskerm is: ${a}`,
        confirmButton: "Versnipper permanent",
        running: "Besig om te versnipper…",
        progress: (a, b) => `Lêers versnipper: ${a} (${b})`,
        resultDone: (a, b) => `Klaar. Lêers versnipper: ${a} (${b}).`,
        resultStopped: (a, b) => `Gestop. Lêers versnipper: ${a} (${b}).`,
        failedHeading: (a) => `Kon nie versnipper word nie: ${a}`,
        done: "Klaar",
        error: (a) => `Versnippering het misluk: ${a}`
      },
      wipe: {
        body: "Dit oorskryf die vrye spasie op die aandrywer wat jy kies en verwyder dan die vullêer, sodat lêers wat jy vroeër verwyder het nie herstel kan word nie. Dit maak geen spasie vry nie.",
        driveLabel: "Aandrywer om te wis",
        driveOption: (a, b, c) => `${a} · ${b} vry van ${c}`,
        progressPass: (a, b, c, d) => `Deurgang ${a} van ${b}: skryf ewekansige data… ${c} van ${d}`,
        resultRandom: (a, b) => `${a} ewekansige data in ${b} deurgange oor die vrye spasie geskryf en dit daarna verwyder. Geen spasie is vrygemaak nie.`,
        resultRandomStopped: (a) => `Gestop nadat ${a} ewekansige data oor die vrye spasie geskryf is. Die vullêer is verwyder.`
      }
    }
  },
  ar: {
    deepCleanV3: {
      overwrite: {
        title: "الكتابة فوق الملفات قبل حذفها",
        description: "عندما يحذف Prune شيئًا نهائيًا (الحذف الآن، أو الحذف نهائيًا بعد إلغاء التثبيت)، فإنه يكتب أولًا فوق محتويات الملف. هذا أبطأ، وهو غير موثوق على أقراص SSD وأنظمة الملفات ذات النسخ عند الكتابة أو التسجيل في السجل، ولا في المجلدات المتزامنة أو المنسوخة احتياطيًا. ولا ينطبق على الحجر الصحي أو سلة المحذوفات.",
        passes: "عدد مرات الكتابة فوق الملفات",
        pass1: "مرة واحدة (أصفار)",
        pass3: "3 مرات (بيانات عشوائية)"
      },
      shred: {
        open: "تمزيق الملفات…",
        title: "تمزيق الملفات والمجلدات",
        intro: "اختر ملفات أو مجلدات لكتابة بيانات فوقها ثم حذفها. لا يمكن استرداد العناصر التي تم تمزيقها، وهي لا تمر عبر الحجر الصحي ولا سلة المحذوفات.",
        chooseFiles: "اختيار ملفات…",
        chooseFolders: "اختيار مجلدات…",
        dropHint: "أو أفلت الملفات والمجلدات هنا",
        typeLabel: "المسارات، مسار واحد في كل سطر",
        add: "إضافة إلى القائمة",
        remove: (a) => `إزالة ${a} من القائمة`,
        empty: "لم يتم اختيار شيء بعد.",
        continue: "متابعة",
        ssdNote: "الكتابة فوق البيانات غير موثوقة على أقراص SSD وأنظمة الملفات ذات النسخ عند الكتابة أو التسجيل في السجل، ولا في المجلدات المتزامنة أو المنسوخة احتياطيًا.",
        confirmTitle: "تمزيق هذه العناصر نهائيًا؟",
        confirmBody: (a, b) => `الملفات المراد تمزيقها: ${a} (${b}). لا يمكن استرداد محتوياتها، ولن يُنقل شيء إلى الحجر الصحي أو سلة المحذوفات.`,
        truncated: "عدد الملفات كبير جدًا لدرجة أن العد توقف مبكرًا. الإجمالي الفعلي أكبر.",
        refusedHeading: (a) => `تُركت دون مساس لأنها محمية: ${a}`,
        confirmButton: "تمزيق نهائي",
        running: "جارٍ التمزيق…",
        progress: (a, b) => `الملفات التي تم تمزيقها: ${a} (${b})`,
        resultDone: (a, b) => `تم. الملفات التي تم تمزيقها: ${a} (${b}).`,
        resultStopped: (a, b) => `تم الإيقاف. الملفات التي تم تمزيقها: ${a} (${b}).`,
        failedHeading: (a) => `تعذّر تمزيقها: ${a}`,
        done: "تم",
        error: (a) => `فشل التمزيق: ${a}`
      },
      wipe: {
        body: "يكتب هذا فوق المساحة الفارغة في القرص الذي تختاره ثم يحذف ملف التعبئة، فلا يمكن استرداد الملفات التي حذفتها سابقًا. ولا يحرر أي مساحة.",
        driveLabel: "القرص المراد مسحه",
        driveOption: (a, b, c) => `${a} · ${b} فارغة من أصل ${c}`,
        progressPass: (a, b, c, d) => `المرة ${a} من ${b}: جارٍ كتابة بيانات عشوائية… ${c} من ${d}`,
        resultRandom: (a, b) => `تمت كتابة ${a} من البيانات العشوائية فوق المساحة الفارغة على ${b} مرات ثم حُذفت. لم تتحرر أي مساحة.`,
        resultRandomStopped: (a) => `توقفت العملية بعد كتابة ${a} من البيانات العشوائية فوق المساحة الفارغة. وقد حُذف ملف التعبئة.`
      }
    }
  },
  ca: {
    deepCleanV3: {
      overwrite: {
        title: "Sobreescriu els fitxers abans d'eliminar-los",
        description: "Quan Prune elimina alguna cosa per sempre (Elimina ara, o Elimina permanentment després d'una desinstal·lació), primer sobreescriu el contingut del fitxer. Això és més lent i no és fiable en SSD, sistemes de fitxers de còpia en escriure o amb registre per diari, ni en carpetes sincronitzades o amb còpia de seguretat. No s'aplica a la Quarantena ni a la Paperera.",
        passes: "Passades de sobreescriptura",
        pass1: "1 passada (zeros)",
        pass3: "3 passades (dades aleatòries)"
      },
      shred: {
        open: "Tritura fitxers…",
        title: "Tritura fitxers i carpetes",
        intro: "Tria els fitxers o carpetes que vols sobreescriure i eliminar. Els elements triturats no es poden recuperar i no passen per la Quarantena ni per la Paperera.",
        chooseFiles: "Tria fitxers…",
        chooseFolders: "Tria carpetes…",
        dropHint: "O deixa anar aquí fitxers i carpetes",
        typeLabel: "Camins, un per línia",
        add: "Afegeix a la llista",
        remove: (a) => `Treu ${a} de la llista`,
        empty: "Encara no has triat res.",
        continue: "Continua",
        ssdNote: "La sobreescriptura no és fiable en SSD, sistemes de fitxers de còpia en escriure o amb registre per diari, ni en carpetes sincronitzades o amb còpia de seguretat.",
        confirmTitle: "Vols triturar-ho de manera permanent?",
        confirmBody: (a, b) => `Fitxers per triturar: ${a} (${b}). El seu contingut no es pot recuperar i no va res a la Quarantena ni a la Paperera.`,
        truncated: "Hi ha tants fitxers que el recompte s'ha aturat abans d'hora. El total real és més gran.",
        refusedHeading: (a) => `No s'hi toca perquè estan protegits: ${a}`,
        confirmButton: "Tritura permanentment",
        running: "S’està triturant…",
        progress: (a, b) => `Fitxers triturats: ${a} (${b})`,
        resultDone: (a, b) => `Fet. Fitxers triturats: ${a} (${b}).`,
        resultStopped: (a, b) => `Aturat. Fitxers triturats: ${a} (${b}).`,
        failedHeading: (a) => `No s’han pogut triturar: ${a}`,
        done: "Fet",
        error: (a) => `La trituració ha fallat: ${a}`
      },
      wipe: {
        body: "Sobreescriu l'espai lliure de la unitat que triïs i després elimina el fitxer de farciment, de manera que els fitxers que hagis eliminat abans no es puguin recuperar. No allibera espai.",
        driveLabel: "Unitat que s’ha de netejar",
        driveOption: (a, b, c) => `${a} · ${b} lliures de ${c}`,
        progressPass: (a, b, c, d) => `Passada ${a} de ${b}: escrivint dades aleatòries… ${c} de ${d}`,
        resultRandom: (a, b) => `S'han escrit ${a} de dades aleatòries sobre l'espai lliure en ${b} passades i després s'han eliminat. No s'ha alliberat cap espai.`,
        resultRandomStopped: (a) => `Aturat després d'escriure ${a} de dades aleatòries sobre l'espai lliure. El fitxer de farciment s'ha eliminat.`
      }
    }
  },
  cs: {
    deepCleanV3: {
      overwrite: {
        title: "Přepsat soubory před smazáním",
        description: "Když Prune něco smaže natrvalo (Smazat hned, nebo Trvale odstranit po odinstalaci), nejprve přepíše obsah souboru. Je to pomalejší a nelze se na to spolehnout u SSD, souborových systémů s kopírováním při zápisu nebo žurnálováním ani ve složkách, které se synchronizují nebo zálohují. Netýká se karantény ani koše.",
        passes: "Počet přepisů",
        pass1: "1 přepis (nuly)",
        pass3: "3 přepisy (náhodná data)"
      },
      shred: {
        open: "Skartovat soubory…",
        title: "Skartovat soubory a složky",
        intro: "Vyberte soubory nebo složky, které se mají přepsat a smazat. Skartované položky nelze obnovit a obcházejí karanténu i koš.",
        chooseFiles: "Vybrat soubory…",
        chooseFolders: "Vybrat složky…",
        dropHint: "Nebo sem přetáhněte soubory a složky",
        typeLabel: "Cesty, jedna na řádek",
        add: "Přidat do seznamu",
        remove: (a) => `Odebrat ${a} ze seznamu`,
        empty: "Zatím nic nevybráno.",
        continue: "Pokračovat",
        ssdNote: "Přepisování není spolehlivé u SSD, souborových systémů s kopírováním při zápisu nebo žurnálováním ani ve složkách, které se synchronizují nebo zálohují.",
        confirmTitle: "Trvale to skartovat?",
        confirmBody: (a, b) => `Soubory ke skartování: ${a} (${b}). Jejich obsah nelze obnovit a nic se nepřesune do karantény ani do koše.`,
        truncated: "Souborů je tolik, že se počítání předčasně zastavilo. Skutečný počet je vyšší.",
        refusedHeading: (a) => `Ponecháno, protože jsou chráněné: ${a}`,
        confirmButton: "Trvale skartovat",
        running: "Skartuje se…",
        progress: (a, b) => `Skartované soubory: ${a} (${b})`,
        resultDone: (a, b) => `Hotovo. Skartované soubory: ${a} (${b}).`,
        resultStopped: (a, b) => `Zastaveno. Skartované soubory: ${a} (${b}).`,
        failedHeading: (a) => `Nelze skartovat: ${a}`,
        done: "Hotovo",
        error: (a) => `Skartování se nezdařilo: ${a}`
      },
      wipe: {
        body: "Přepíše volné místo na zvolené jednotce a poté smaže vyplňovací soubor, takže dříve smazané soubory nelze obnovit. Neuvolní žádné místo.",
        driveLabel: "Jednotka k vymazání",
        driveOption: (a, b, c) => `${a} · ${b} volných z ${c}`,
        progressPass: (a, b, c, d) => `Přepis ${a} z ${b}: zapisování náhodných dat… ${c} z ${d}`,
        resultRandom: (a, b) => `Volné místo bylo přepsáno náhodnými daty (${a}) ve ${b} přepisech a vyplňovací soubor byl smazán. Žádné místo se neuvolnilo.`,
        resultRandomStopped: (a) => `Zastaveno po zapsání náhodných dat (${a}) do volného místa. Vyplňovací soubor byl smazán.`
      }
    }
  },
  cy: {
    deepCleanV3: {
      overwrite: {
        title: "Trosysgrifo ffeiliau cyn eu dileu",
        description: "Pan fydd Prune yn dileu rhywbeth am byth (Dileu nawr, neu Dileu'n barhaol ar ôl dadosod), mae'n trosysgrifo cynnwys y ffeil yn gyntaf. Mae hyn yn arafach, ac nid yw'n ddibynadwy ar SSDau, systemau ffeiliau copi-wrth-ysgrifennu neu newyddiadurol, nac mewn ffolderi wedi'u cydweddu neu eu hategu. Nid yw'n berthnasol i Gwarantin na'r Bin Ailgylchu.",
        passes: "Pasiau trosysgrifo",
        pass1: "1 pas (sero)",
        pass3: "3 pas (data ar hap)"
      },
      shred: {
        open: "Rhwygo ffeiliau…",
        title: "Rhwygo ffeiliau a ffolderi",
        intro: "Dewiswch ffeiliau neu ffolderi i'w trosysgrifo a'u dileu. Ni ellir adfer eitemau wedi'u rhwygo, ac maent yn hepgor Cwarantin a'r Bin Ailgylchu.",
        chooseFiles: "Dewis ffeiliau…",
        chooseFolders: "Dewis ffolderi…",
        dropHint: "Neu gollyngwch ffeiliau a ffolderi yma",
        typeLabel: "Llwybrau, un i bob llinell",
        add: "Ychwanegu at y rhestr",
        remove: (a) => `Tynnu ${a} o'r rhestr`,
        empty: "Dim wedi ei ddewis eto.",
        continue: "Parhau",
        ssdNote: "Nid yw trosysgrifo yn ddibynadwy ar SSDau, systemau ffeiliau copi-wrth-ysgrifennu neu newyddiadurol, nac mewn ffolderi wedi'u cydweddu neu eu hategu.",
        confirmTitle: "Rhwygo'r rhain yn barhaol?",
        confirmBody: (a, b) => `Ffeiliau i'w rhwygo: ${a} (${b}). Ni ellir adfer eu cynnwys, ac nid oes dim yn mynd i Gwarantin na'r Bin Ailgylchu.`,
        truncated: "Mae cymaint o ffeiliau nes i'r cyfrif stopio'n gynnar. Mae'r cyfanswm go iawn yn fwy.",
        refusedHeading: (a) => `Heb eu cyffwrdd oherwydd eu bod wedi'u diogelu: ${a}`,
        confirmButton: "Rhwygo'n barhaol",
        running: "Rhwygo…",
        progress: (a, b) => `Ffeiliau wedi'u rhwygo: ${a} (${b})`,
        resultDone: (a, b) => `Wedi gorffen. Ffeiliau wedi'u rhwygo: ${a} (${b}).`,
        resultStopped: (a, b) => `Stopiwyd. Ffeiliau wedi'u rhwygo: ${a} (${b}).`,
        failedHeading: (a) => `Methwyd â'u rhwygo: ${a}`,
        done: "Wedi gorffen",
        error: (a) => `Methodd y rhwygo: ${a}`
      },
      wipe: {
        body: "Mae hyn yn trosysgrifo'r lle rhydd ar y gyriant a ddewiswch, yna'n dileu'r ffeil llenwi, fel na ellir adfer ffeiliau y gwnaethoch eu dileu'n gynt. Nid yw'n rhyddhau unrhyw le.",
        driveLabel: "Gyriant i’w sychu",
        driveOption: (a, b, c) => `${a} · ${b} yn rhydd o ${c}`,
        progressPass: (a, b, c, d) => `Pas ${a} o ${b}: ysgrifennu data ar hap… ${c} o ${d}`,
        resultRandom: (a, b) => `Ysgrifennwyd ${a} o ddata ar hap dros y lle rhydd mewn ${b} pas, yna cawsant eu dileu. Ni ryddhawyd unrhyw le.`,
        resultRandomStopped: (a) => `Stopiwyd ar ôl ysgrifennu ${a} o ddata ar hap dros y lle rhydd. Dilëwyd y ffeil llenwi.`
      }
    }
  },
  da: {
    deepCleanV3: {
      overwrite: {
        title: "Overskriv filer før sletning",
        description: "Når Prune sletter noget for altid (Slet nu, eller Slet permanent efter en afinstallation), skriver det først over filens indhold. Det er langsommere, og det er ikke pålideligt på SSD'er, copy-on-write- eller journalførende filsystemer eller i synkroniserede eller sikkerhedskopierede mapper. Det gælder ikke Karantæne eller Papirkurven.",
        passes: "Overskrivningspas",
        pass1: "1 pas (nuller)",
        pass3: "3 pas (tilfældige data)"
      },
      shred: {
        open: "Makulér filer…",
        title: "Makulér filer og mapper",
        intro: "Vælg filer eller mapper, der skal overskrives og slettes. Makulerede elementer kan ikke gendannes, og de springer Karantæne og Papirkurven over.",
        chooseFiles: "Vælg filer…",
        chooseFolders: "Vælg mapper…",
        dropHint: "Eller slip filer og mapper her",
        typeLabel: "Stier, én pr. linje",
        add: "Føj til listen",
        remove: (a) => `Fjern ${a} fra listen`,
        empty: "Intet valgt endnu.",
        continue: "Fortsæt",
        ssdNote: "Overskrivning er ikke pålidelig på SSD'er, copy-on-write- eller journalførende filsystemer eller i synkroniserede eller sikkerhedskopierede mapper.",
        confirmTitle: "Makulér disse permanent?",
        confirmBody: (a, b) => `Filer, der skal makuleres: ${a} (${b}). Deres indhold kan ikke gendannes, og intet havner i Karantæne eller Papirkurven.`,
        truncated: "Der er så mange filer, at optællingen stoppede tidligt. Det reelle antal er større.",
        refusedHeading: (a) => `Efterladt, fordi de er beskyttet: ${a}`,
        confirmButton: "Makulér permanent",
        running: "Makulerer…",
        progress: (a, b) => `Makulerede filer: ${a} (${b})`,
        resultDone: (a, b) => `Færdig. Makulerede filer: ${a} (${b}).`,
        resultStopped: (a, b) => `Stoppet. Makulerede filer: ${a} (${b}).`,
        failedHeading: (a) => `Kunne ikke makuleres: ${a}`,
        done: "Færdig",
        error: (a) => `Makuleringen mislykkedes: ${a}`
      },
      wipe: {
        body: "Dette overskriver den ledige plads på det drev, du vælger, og sletter derefter fyldfilen, så filer, du tidligere har slettet, ikke kan gendannes. Det frigør ingen plads.",
        driveLabel: "Drev, der skal overskrives",
        driveOption: (a, b, c) => `${a} · ${b} ledig af ${c}`,
        progressPass: (a, b, c, d) => `Pas ${a} af ${b}: skriver tilfældige data… ${c} af ${d}`,
        resultRandom: (a, b) => `Skrev ${a} tilfældige data over den ledige plads i ${b} pas og slettede dem derefter. Der blev ikke frigjort plads.`,
        resultRandomStopped: (a) => `Stoppet efter at have skrevet ${a} tilfældige data over den ledige plads. Fyldfilen blev slettet.`
      }
    }
  },
  de: {
    deepCleanV3: {
      overwrite: {
        title: "Dateien vor dem Löschen überschreiben",
        description: "Wenn Prune etwas endgültig löscht (Sofort löschen oder Dauerhaft löschen nach einer Deinstallation), überschreibt es zuvor den Inhalt der Datei. Das ist langsamer und auf SSDs, Dateisystemen mit Copy-on-Write oder Journaling sowie in synchronisierten oder gesicherten Ordnern nicht zuverlässig. Für die Quarantäne und den Papierkorb gilt es nicht.",
        passes: "Überschreibdurchgänge",
        pass1: "1 Durchgang (Nullen)",
        pass3: "3 Durchgänge (Zufallsdaten)"
      },
      shred: {
        open: "Dateien schreddern…",
        title: "Dateien und Ordner schreddern",
        intro: "Wähle Dateien oder Ordner, die überschrieben und gelöscht werden sollen. Geschredderte Elemente lassen sich nicht wiederherstellen und umgehen Quarantäne und Papierkorb.",
        chooseFiles: "Dateien wählen…",
        chooseFolders: "Ordner wählen…",
        dropHint: "Oder Dateien und Ordner hierher ziehen",
        typeLabel: "Pfade, einer pro Zeile",
        add: "Zur Liste hinzufügen",
        remove: (a) => `${a} aus der Liste entfernen`,
        empty: "Noch nichts ausgewählt.",
        continue: "Weiter",
        ssdNote: "Überschreiben ist auf SSDs, Dateisystemen mit Copy-on-Write oder Journaling sowie in synchronisierten oder gesicherten Ordnern nicht zuverlässig.",
        confirmTitle: "Diese endgültig schreddern?",
        confirmBody: (a, b) => `Zu schreddernde Dateien: ${a} (${b}). Der Inhalt lässt sich nicht wiederherstellen, und nichts landet in Quarantäne oder Papierkorb.`,
        truncated: "Es sind so viele Dateien, dass die Zählung vorzeitig abgebrochen wurde. Die tatsächliche Zahl ist größer.",
        refusedHeading: (a) => `Unberührt gelassen, weil geschützt: ${a}`,
        confirmButton: "Endgültig schreddern",
        running: "Wird geschreddert…",
        progress: (a, b) => `Geschredderte Dateien: ${a} (${b})`,
        resultDone: (a, b) => `Fertig. Geschredderte Dateien: ${a} (${b}).`,
        resultStopped: (a, b) => `Gestoppt. Geschredderte Dateien: ${a} (${b}).`,
        failedHeading: (a) => `Konnten nicht geschreddert werden: ${a}`,
        done: "Fertig",
        error: (a) => `Schreddern fehlgeschlagen: ${a}`
      },
      wipe: {
        body: "Dabei wird der freie Speicherplatz auf dem gewählten Laufwerk überschrieben und die Fülldatei anschließend gelöscht, sodass früher gelöschte Dateien nicht mehr wiederhergestellt werden können. Es wird kein Speicherplatz freigegeben.",
        driveLabel: "Zu überschreibendes Laufwerk",
        driveOption: (a, b, c) => `${a} · ${b} frei von ${c}`,
        progressPass: (a, b, c, d) => `Durchgang ${a} von ${b}: Zufallsdaten werden geschrieben… ${c} von ${d}`,
        resultRandom: (a, b) => `${a} an Zufallsdaten in ${b} Durchgängen über den freien Speicherplatz geschrieben und anschließend gelöscht. Es wurde kein Speicherplatz freigegeben.`,
        resultRandomStopped: (a) => `Abgebrochen, nachdem ${a} an Zufallsdaten in den freien Speicherplatz geschrieben wurden. Die Fülldatei wurde gelöscht.`
      }
    }
  },
  el: {
    deepCleanV3: {
      overwrite: {
        title: "Αντικατάσταση αρχείων πριν τη διαγραφή",
        description: "Όταν το Prune διαγράφει κάτι οριστικά (Διαγραφή τώρα ή Οριστική διαγραφή μετά από μια απεγκατάσταση), γράφει πρώτα πάνω από το περιεχόμενο του αρχείου. Αυτό είναι πιο αργό και δεν είναι αξιόπιστο σε SSD, σε συστήματα αρχείων copy-on-write ή με ημερολόγιο, ή σε φακέλους που συγχρονίζονται ή έχουν αντίγραφο ασφαλείας. Δεν ισχύει για την Καραντίνα ή τον Κάδο Ανακύκλωσης.",
        passes: "Περάσματα αντικατάστασης",
        pass1: "1 πέρασμα (μηδενικά)",
        pass3: "3 περάσματα (τυχαία δεδομένα)"
      },
      shred: {
        open: "Τεμαχισμός αρχείων…",
        title: "Τεμαχισμός αρχείων και φακέλων",
        intro: "Επιλέξτε αρχεία ή φακέλους για αντικατάσταση και διαγραφή. Τα στοιχεία που τεμαχίζονται δεν μπορούν να ανακτηθούν και παρακάμπτουν την Καραντίνα και τον Κάδο Ανακύκλωσης.",
        chooseFiles: "Επιλογή αρχείων…",
        chooseFolders: "Επιλογή φακέλων…",
        dropHint: "Ή σύρετε αρχεία και φακέλους εδώ",
        typeLabel: "Διαδρομές, μία ανά γραμμή",
        add: "Προσθήκη στη λίστα",
        remove: (a) => `Αφαίρεση του ${a} από τη λίστα`,
        empty: "Δεν έχει επιλεγεί τίποτα ακόμη.",
        continue: "Συνέχεια",
        ssdNote: "Η αντικατάσταση δεν είναι αξιόπιστη σε SSD, σε συστήματα αρχείων copy-on-write ή με ημερολόγιο, ή σε φακέλους που συγχρονίζονται ή έχουν αντίγραφο ασφαλείας.",
        confirmTitle: "Οριστικός τεμαχισμός αυτών;",
        confirmBody: (a, b) => `Αρχεία προς τεμαχισμό: ${a} (${b}). Το περιεχόμενό τους δεν μπορεί να ανακτηθεί και τίποτα δεν πηγαίνει στην Καραντίνα ή στον Κάδο Ανακύκλωσης.`,
        truncated: "Υπάρχουν τόσα πολλά αρχεία που η καταμέτρηση σταμάτησε νωρίς. Το πραγματικό σύνολο είναι μεγαλύτερο.",
        refusedHeading: (a) => `Δεν θα αγγιχτούν επειδή είναι προστατευμένα: ${a}`,
        confirmButton: "Οριστικός τεμαχισμός",
        running: "Τεμαχισμός…",
        progress: (a, b) => `Αρχεία που τεμαχίστηκαν: ${a} (${b})`,
        resultDone: (a, b) => `Ολοκληρώθηκε. Αρχεία που τεμαχίστηκαν: ${a} (${b}).`,
        resultStopped: (a, b) => `Διακόπηκε. Αρχεία που τεμαχίστηκαν: ${a} (${b}).`,
        failedHeading: (a) => `Δεν ήταν δυνατός ο τεμαχισμός: ${a}`,
        done: "Ολοκληρώθηκε",
        error: (a) => `Ο τεμαχισμός απέτυχε: ${a}`
      },
      wipe: {
        body: "Αντικαθιστά τον ελεύθερο χώρο της μονάδας που επιλέγετε και μετά διαγράφει το αρχείο πλήρωσης, ώστε τα αρχεία που έχετε διαγράψει παλαιότερα να μην μπορούν να ανακτηθούν. Δεν ελευθερώνει χώρο.",
        driveLabel: "Μονάδα προς αντικατάσταση",
        driveOption: (a, b, c) => `${a} · ${b} ελεύθερα από ${c}`,
        progressPass: (a, b, c, d) => `Πέρασμα ${a} από ${b}: εγγραφή τυχαίων δεδομένων… ${c} από ${d}`,
        resultRandom: (a, b) => `Γράφτηκαν τυχαία δεδομένα συνολικού μεγέθους ${a} πάνω από τον ελεύθερο χώρο σε ${b} περάσματα και στη συνέχεια διαγράφηκαν. Δεν ελευθερώθηκε χώρος.`,
        resultRandomStopped: (a) => `Διακόπηκε μετά την εγγραφή τυχαίων δεδομένων συνολικού μεγέθους ${a} πάνω από τον ελεύθερο χώρο. Το αρχείο πλήρωσης διαγράφηκε.`
      }
    }
  },
  es: {
    deepCleanV3: {
      overwrite: {
        title: "Sobrescribir los archivos antes de eliminarlos",
        description: "Cuando Prune elimina algo de forma definitiva (Eliminar ahora, o Eliminar permanentemente tras una desinstalación), primero sobrescribe el contenido del archivo. Es más lento y no es fiable en SSD, en sistemas de archivos de copia en escritura o con registro por diario, ni en carpetas sincronizadas o con copia de seguridad. No se aplica a la Cuarentena ni a la Papelera de Reciclaje.",
        passes: "Pasadas de sobrescritura",
        pass1: "1 pasada (ceros)",
        pass3: "3 pasadas (datos aleatorios)"
      },
      shred: {
        open: "Triturar archivos…",
        title: "Triturar archivos y carpetas",
        intro: "Elige los archivos o carpetas que quieras sobrescribir y eliminar. Los elementos triturados no se pueden recuperar y no pasan por la Cuarentena ni por la Papelera de Reciclaje.",
        chooseFiles: "Elegir archivos…",
        chooseFolders: "Elegir carpetas…",
        dropHint: "O suelta aquí archivos y carpetas",
        typeLabel: "Rutas, una por línea",
        add: "Añadir a la lista",
        remove: (a) => `Quitar ${a} de la lista`,
        empty: "Todavía no has elegido nada.",
        continue: "Continuar",
        ssdNote: "La sobrescritura no es fiable en SSD, en sistemas de archivos de copia en escritura o con registro por diario, ni en carpetas sincronizadas o con copia de seguridad.",
        confirmTitle: "¿Triturar esto de forma permanente?",
        confirmBody: (a, b) => `Archivos que se triturarán: ${a} (${b}). Su contenido no se puede recuperar y nada va a la Cuarentena ni a la Papelera de Reciclaje.`,
        truncated: "Hay tantos archivos que el recuento se detuvo antes de tiempo. El total real es mayor.",
        refusedHeading: (a) => `Se dejan intactos por estar protegidos: ${a}`,
        confirmButton: "Triturar permanentemente",
        running: "Triturando…",
        progress: (a, b) => `Archivos triturados: ${a} (${b})`,
        resultDone: (a, b) => `Listo. Archivos triturados: ${a} (${b}).`,
        resultStopped: (a, b) => `Detenido. Archivos triturados: ${a} (${b}).`,
        failedHeading: (a) => `No se pudieron triturar: ${a}`,
        done: "Listo",
        error: (a) => `Error al triturar: ${a}`
      },
      wipe: {
        body: "Esto sobrescribe el espacio libre de la unidad que elijas y luego elimina el archivo de relleno, de modo que los archivos que eliminaste antes no se puedan recuperar. No libera espacio.",
        driveLabel: "Unidad que se sobrescribirá",
        driveOption: (a, b, c) => `${a} · ${b} libres de ${c}`,
        progressPass: (a, b, c, d) => `Pasada ${a} de ${b}: escribiendo datos aleatorios… ${c} de ${d}`,
        resultRandom: (a, b) => `Se escribieron ${a} de datos aleatorios sobre el espacio libre en ${b} pasadas y luego se eliminaron. No se liberó espacio.`,
        resultRandomStopped: (a) => `Detenido tras escribir ${a} de datos aleatorios sobre el espacio libre. El archivo de relleno se eliminó.`
      }
    }
  },
  et: {
    deepCleanV3: {
      overwrite: {
        title: "Kirjuta failid enne kustutamist üle",
        description: "Kui Prune kustutab midagi jäädavalt (Kustuta kohe või Kustuta jäädavalt pärast eemaldamist), kirjutab ta esmalt faili sisu üle. See on aeglasem ning ei ole töökindel SSD-del, kirjutamisel kopeerivates või žurnaalitavates failisüsteemides ega sünkroonitud või varundatud kaustades. See ei kehti karantiini ega prügikasti kohta.",
        passes: "Ülekirjutuse käigud",
        pass1: "1 käik (nullid)",
        pass3: "3 käiku (juhuslikud andmed)"
      },
      shred: {
        open: "Hävita faile…",
        title: "Failide ja kaustade hävitamine",
        intro: "Vali failid või kaustad, mis üle kirjutada ja kustutada. Hävitatud üksusi ei saa taastada ning need jätavad karantiini ja prügikasti vahele.",
        chooseFiles: "Vali failid…",
        chooseFolders: "Vali kaustad…",
        dropHint: "Või lohista failid ja kaustad siia",
        typeLabel: "Teekonnad, üks rea kohta",
        add: "Lisa loendisse",
        remove: (a) => `Eemalda ${a} loendist`,
        empty: "Midagi pole veel valitud.",
        continue: "Jätka",
        ssdNote: "Ülekirjutamine ei ole töökindel SSD-del, kirjutamisel kopeerivates või žurnaalitavates failisüsteemides ega sünkroonitud või varundatud kaustades.",
        confirmTitle: "Kas hävitada need jäädavalt?",
        confirmBody: (a, b) => `Hävitatavad failid: ${a} (${b}). Nende sisu ei saa taastada ja midagi ei lähe karantiini ega prügikasti.`,
        truncated: "Faile on nii palju, et loendus lõpetati varakult. Tegelik kogusumma on suurem.",
        refusedHeading: (a) => `Jäetakse puutumata, sest need on kaitstud: ${a}`,
        confirmButton: "Hävita jäädavalt",
        running: "Hävitamine…",
        progress: (a, b) => `Hävitatud faile: ${a} (${b})`,
        resultDone: (a, b) => `Valmis. Hävitatud faile: ${a} (${b}).`,
        resultStopped: (a, b) => `Peatatud. Hävitatud faile: ${a} (${b}).`,
        failedHeading: (a) => `Ei õnnestunud hävitada: ${a}`,
        done: "Valmis",
        error: (a) => `Hävitamine ebaõnnestus: ${a}`
      },
      wipe: {
        body: "See kirjutab valitud ketta vaba ruumi üle ja kustutab seejärel täitefaili, nii et varem kustutatud faile ei saa taastada. See ei vabasta ruumi.",
        driveLabel: "Ülekirjutatav ketas",
        driveOption: (a, b, c) => `${a} · ${b} vaba, kokku ${c}`,
        progressPass: (a, b, c, d) => `Käik ${a} / ${b}: kirjutatakse juhuslikke andmeid… ${c} / ${d}`,
        resultRandom: (a, b) => `Vabale ruumile kirjutati ${b} käiguga ${a} juhuslikke andmeid ja need kustutati seejärel. Ruumi ei vabanenud.`,
        resultRandomStopped: (a) => `Peatati pärast seda, kui vabale ruumile oli kirjutatud ${a} juhuslikke andmeid. Täitefail kustutati.`
      }
    }
  },
  fi: {
    deepCleanV3: {
      overwrite: {
        title: "Korvaa tiedostot ennen poistamista",
        description: "Kun Prune poistaa jotakin pysyvästi (Poista heti tai Poista pysyvästi ohjelman poiston jälkeen), se kirjoittaa ensin tiedoston sisällön päälle. Tämä on hitaampaa, eikä se ole luotettava SSD-levyillä, kirjoitettaessa kopioivissa tai päiväkirjaavissa tiedostojärjestelmissä eikä synkronoiduissa tai varmuuskopioiduissa kansioissa. Se ei koske karanteenia tai roskakoria.",
        passes: "Korvauskierrokset",
        pass1: "1 kierros (nollat)",
        pass3: "3 kierrosta (satunnaisdata)"
      },
      shred: {
        open: "Murskaa tiedostoja…",
        title: "Murskaa tiedostoja ja kansioita",
        intro: "Valitse tiedostot tai kansiot, jotka korvataan ja poistetaan. Murskattuja kohteita ei voi palauttaa, eivätkä ne kulje karanteenin tai roskakorin kautta.",
        chooseFiles: "Valitse tiedostot…",
        chooseFolders: "Valitse kansiot…",
        dropHint: "Tai pudota tiedostoja ja kansioita tähän",
        typeLabel: "Polut, yksi riville",
        add: "Lisää luetteloon",
        remove: (a) => `Poista ${a} luettelosta`,
        empty: "Mitään ei ole vielä valittu.",
        continue: "Jatka",
        ssdNote: "Päälle kirjoittaminen ei ole luotettavaa SSD-levyillä, kirjoitettaessa kopioivissa tai päiväkirjaavissa tiedostojärjestelmissä eikä synkronoiduissa tai varmuuskopioiduissa kansioissa.",
        confirmTitle: "Murskataanko nämä pysyvästi?",
        confirmBody: (a, b) => `Murskattavat tiedostot: ${a} (${b}). Niiden sisältöä ei voi palauttaa, eikä mitään siirretä karanteeniin tai roskakoriin.`,
        truncated: "Tiedostoja on niin paljon, että laskenta pysähtyi ennen aikaa. Todellinen määrä on suurempi.",
        refusedHeading: (a) => `Jätetään rauhaan, koska ne on suojattu: ${a}`,
        confirmButton: "Murskaa pysyvästi",
        running: "Murskataan…",
        progress: (a, b) => `Murskatut tiedostot: ${a} (${b})`,
        resultDone: (a, b) => `Valmis. Murskatut tiedostot: ${a} (${b}).`,
        resultStopped: (a, b) => `Pysäytetty. Murskatut tiedostot: ${a} (${b}).`,
        failedHeading: (a) => `Murskaus epäonnistui: ${a}`,
        done: "Valmis",
        error: (a) => `Murskaus epäonnistui: ${a}`
      },
      wipe: {
        body: "Tämä ylikirjoittaa valitsemasi aseman vapaan tilan ja poistaa sitten täytetiedoston, jotta aiemmin poistettuja tiedostoja ei voi palauttaa. Se ei vapauta tilaa.",
        driveLabel: "Pyyhittävä asema",
        driveOption: (a, b, c) => `${a} · ${b} vapaana, yhteensä ${c}`,
        progressPass: (a, b, c, d) => `Kierros ${a} / ${b}: kirjoitetaan satunnaisdataa… ${c} / ${d}`,
        resultRandom: (a, b) => `Vapaan tilan päälle kirjoitettiin ${a} satunnaisdataa ${b} kierroksella, minkä jälkeen ne poistettiin. Tilaa ei vapautunut.`,
        resultRandomStopped: (a) => `Pysäytettiin, kun vapaan tilan päälle oli kirjoitettu ${a} satunnaisdataa. Täytetiedosto poistettiin.`
      }
    }
  },
  fr: {
    deepCleanV3: {
      overwrite: {
        title: "Écraser les fichiers avant de les supprimer",
        description: "Quand Prune supprime quelque chose pour de bon (Supprimer maintenant, ou Supprimer définitivement après une désinstallation), il écrase d'abord le contenu du fichier. C'est plus lent, et ce n'est pas fiable sur les SSD, les systèmes de fichiers à copie sur écriture ou avec journal, ni dans les dossiers synchronisés ou sauvegardés. Cela ne s'applique pas à la Quarantaine ni à la Corbeille.",
        passes: "Passes d'écrasement",
        pass1: "1 passe (zéros)",
        pass3: "3 passes (données aléatoires)"
      },
      shred: {
        open: "Détruire des fichiers…",
        title: "Détruire des fichiers et des dossiers",
        intro: "Choisissez les fichiers ou dossiers à écraser puis supprimer. Les éléments détruits sont irrécupérables et ne passent ni par la Quarantaine ni par la Corbeille.",
        chooseFiles: "Choisir des fichiers…",
        chooseFolders: "Choisir des dossiers…",
        dropHint: "Ou déposez ici des fichiers et des dossiers",
        typeLabel: "Chemins, un par ligne",
        add: "Ajouter à la liste",
        remove: (a) => `Retirer ${a} de la liste`,
        empty: "Rien n'est encore choisi.",
        continue: "Continuer",
        ssdNote: "L'écrasement n'est pas fiable sur les SSD, les systèmes de fichiers à copie sur écriture ou avec journal, ni dans les dossiers synchronisés ou sauvegardés.",
        confirmTitle: "Détruire ces éléments définitivement ?",
        confirmBody: (a, b) => `Fichiers à détruire : ${a} (${b}). Leur contenu est irrécupérable et rien ne va dans la Quarantaine ni dans la Corbeille.`,
        truncated: "Il y a tant de fichiers que le décompte s'est arrêté trop tôt. Le total réel est plus élevé.",
        refusedHeading: (a) => `Laissés intacts car protégés : ${a}`,
        confirmButton: "Détruire définitivement",
        running: "Destruction en cours…",
        progress: (a, b) => `Fichiers détruits : ${a} (${b})`,
        resultDone: (a, b) => `Terminé. Fichiers détruits : ${a} (${b}).`,
        resultStopped: (a, b) => `Arrêté. Fichiers détruits : ${a} (${b}).`,
        failedHeading: (a) => `Impossible à détruire : ${a}`,
        done: "Terminé",
        error: (a) => `Échec de la destruction : ${a}`
      },
      wipe: {
        body: "Cela écrase l'espace libre du lecteur que vous choisissez, puis supprime le fichier de remplissage, de sorte que les fichiers que vous avez supprimés auparavant ne puissent pas être récupérés. Aucun espace n'est libéré.",
        driveLabel: "Lecteur à écraser",
        driveOption: (a, b, c) => `${a} · ${b} libres sur ${c}`,
        progressPass: (a, b, c, d) => `Passe ${a} sur ${b} : écriture de données aléatoires… ${c} sur ${d}`,
        resultRandom: (a, b) => `${a} de données aléatoires écrits sur l’espace libre en ${b} passes, puis supprimés. Aucun espace n’a été libéré.`,
        resultRandomStopped: (a) => `Arrêté après l’écriture de ${a} de données aléatoires sur l’espace libre. Le fichier de remplissage a été supprimé.`
      }
    }
  },
  he: {
    deepCleanV3: {
      overwrite: {
        title: "דריסת קבצים לפני המחיקה",
        description: "כש-Prune מוחק משהו לצמיתות (מחיקה מיידית, או מחק לצמיתות לאחר הסרת התקנה), הוא כותב קודם על תוכן הקובץ. זה איטי יותר, ואינו אמין בכונני SSD, במערכות קבצים עם העתקה בעת כתיבה או עם יומן, או בתיקיות מסונכרנות או מגובות. זה לא חל על ההסגר או על סל המיחזור.",
        passes: "מעברי דריסה",
        pass1: "מעבר אחד (אפסים)",
        pass3: "3 מעברים (נתונים אקראיים)"
      },
      shred: {
        open: "מחיקה מאובטחת של קבצים…",
        title: "מחיקה מאובטחת של קבצים ותיקיות",
        intro: "בחר קבצים או תיקיות לדריסה ולמחיקה. פריטים שנמחקו כך אינם ניתנים לשחזור, והם עוקפים את ההסגר ואת סל המיחזור.",
        chooseFiles: "בחר קבצים…",
        chooseFolders: "בחר תיקיות…",
        dropHint: "או גררו לכאן קבצים ותיקיות",
        typeLabel: "נתיבים, אחד בכל שורה",
        add: "הוסף לרשימה",
        remove: (a) => `הסר את ${a} מהרשימה`,
        empty: "עדיין לא נבחר דבר.",
        continue: "המשך",
        ssdNote: "דריסה אינה אמינה בכונני SSD, במערכות קבצים עם העתקה בעת כתיבה או עם יומן, או בתיקיות מסונכרנות או מגובות.",
        confirmTitle: "למחוק את אלה לצמיתות?",
        confirmBody: (a, b) => `קבצים למחיקה: ${a} (${b}). לא ניתן לשחזר את תוכנם, ושום דבר לא עובר להסגר או לסל המיחזור.`,
        truncated: "יש כל כך הרבה קבצים שהספירה נעצרה מוקדם. הסכום האמיתי גדול יותר.",
        refusedHeading: (a) => `לא ייגעו בהם כי הם מוגנים: ${a}`,
        confirmButton: "מחק לצמיתות",
        running: "מוחק…",
        progress: (a, b) => `קבצים שנמחקו: ${a} (${b})`,
        resultDone: (a, b) => `הסתיים. קבצים שנמחקו: ${a} (${b}).`,
        resultStopped: (a, b) => `נעצר. קבצים שנמחקו: ${a} (${b}).`,
        failedHeading: (a) => `לא ניתן היה למחוק: ${a}`,
        done: "סיום",
        error: (a) => `המחיקה נכשלה: ${a}`
      },
      wipe: {
        body: "הפעולה כותבת על השטח הפנוי בכונן שבחרת ואז מוחקת את קובץ המילוי, כך שאי אפשר לשחזר קבצים שמחקת קודם. היא לא משחררת מקום.",
        driveLabel: "כונן למחיקה",
        driveOption: (a, b, c) => `${a} · ${b} פנויים מתוך ${c}`,
        progressPass: (a, b, c, d) => `מעבר ${a} מתוך ${b}: כותב נתונים אקראיים… ${c} מתוך ${d}`,
        resultRandom: (a, b) => `נכתבו נתונים אקראיים בנפח ${a} על השטח הפנוי ב-${b} מעברים, ואז נמחקו. לא שוחרר מקום.`,
        resultRandomStopped: (a) => `נעצר אחרי שנכתבו נתונים אקראיים בנפח ${a} על השטח הפנוי. קובץ המילוי נמחק.`
      }
    }
  },
  hu: {
    deepCleanV3: {
      overwrite: {
        title: "Fájlok felülírása törlés előtt",
        description: "Amikor a Prune véglegesen töröl valamit (Törlés azonnal, vagy Végleges törlés eltávolítás után), előbb felülírja a fájl tartalmát. Ez lassabb, és nem megbízható SSD-ken, másolás-íráskor vagy naplózó fájlrendszereken, illetve szinkronizált vagy mentett mappákban. A Karanténra és a Lomtárra nem vonatkozik.",
        passes: "Felülírási menetek",
        pass1: "1 menet (nullák)",
        pass3: "3 menet (véletlen adatok)"
      },
      shred: {
        open: "Fájlok megsemmisítése…",
        title: "Fájlok és mappák megsemmisítése",
        intro: "Válaszd ki a felülírandó és törlendő fájlokat vagy mappákat. A megsemmisített elemek nem állíthatók helyre, és kihagyják a Karantént és a Lomtárat.",
        chooseFiles: "Fájlok kiválasztása…",
        chooseFolders: "Mappák kiválasztása…",
        dropHint: "Vagy húzz ide fájlokat és mappákat",
        typeLabel: "Elérési utak, soronként egy",
        add: "Hozzáadás a listához",
        remove: (a) => `${a} eltávolítása a listáról`,
        empty: "Még nincs semmi kiválasztva.",
        continue: "Tovább",
        ssdNote: "A felülírás nem megbízható SSD-ken, másolás-íráskor vagy naplózó fájlrendszereken, illetve szinkronizált vagy mentett mappákban.",
        confirmTitle: "Véglegesen megsemmisíted ezeket?",
        confirmBody: (a, b) => `Megsemmisítendő fájlok: ${a} (${b}). A tartalmuk nem állítható helyre, és semmi sem kerül a Karanténba vagy a Lomtárba.`,
        truncated: "Annyi fájl van, hogy a számlálás idő előtt leállt. A valódi összeg ennél nagyobb.",
        refusedHeading: (a) => `Érintetlenül hagyva, mert védettek: ${a}`,
        confirmButton: "Végleges megsemmisítés",
        running: "Megsemmisítés…",
        progress: (a, b) => `Megsemmisített fájlok: ${a} (${b})`,
        resultDone: (a, b) => `Kész. Megsemmisített fájlok: ${a} (${b}).`,
        resultStopped: (a, b) => `Leállítva. Megsemmisített fájlok: ${a} (${b}).`,
        failedHeading: (a) => `Nem sikerült megsemmisíteni: ${a}`,
        done: "Kész",
        error: (a) => `A megsemmisítés nem sikerült: ${a}`
      },
      wipe: {
        body: "Ez felülírja a kiválasztott meghajtó szabad területét, majd törli a kitöltőfájlt, így a korábban törölt fájlok nem állíthatók helyre. Nem szabadít fel helyet.",
        driveLabel: "Felülírandó meghajtó",
        driveOption: (a, b, c) => `${a} · ${b} szabad, összesen ${c}`,
        progressPass: (a, b, c, d) => `${a}. menet / ${b}: véletlen adatok írása… ${c} / ${d}`,
        resultRandom: (a, b) => `A szabad terület felülírva ${a} véletlen adattal ${b} menetben, majd a kitöltőfájl törlődött. Nem szabadult fel hely.`,
        resultRandomStopped: (a) => `Leállítva ${a} véletlen adat kiírása után. A kitöltőfájl törlődött.`
      }
    }
  },
  id: {
    deepCleanV3: {
      overwrite: {
        title: "Timpa file sebelum dihapus",
        description: "Saat Prune menghapus sesuatu secara permanen (Hapus sekarang, atau Hapus permanen setelah pencopotan), file itu lebih dulu ditimpa isinya. Ini lebih lambat, dan tidak andal pada SSD, sistem file copy-on-write atau berjurnal, maupun folder yang disinkronkan atau dicadangkan. Ini tidak berlaku untuk Karantina atau Recycle Bin.",
        passes: "Jumlah penimpaan",
        pass1: "1 kali (nol)",
        pass3: "3 kali (data acak)"
      },
      shred: {
        open: "Hancurkan file…",
        title: "Hancurkan file dan folder",
        intro: "Pilih file atau folder untuk ditimpa lalu dihapus. Item yang dihancurkan tidak dapat dipulihkan dan melewati Karantina serta Recycle Bin.",
        chooseFiles: "Pilih file…",
        chooseFolders: "Pilih folder…",
        dropHint: "Atau jatuhkan file dan folder di sini",
        typeLabel: "Path, satu per baris",
        add: "Tambahkan ke daftar",
        remove: (a) => `Hapus ${a} dari daftar`,
        empty: "Belum ada yang dipilih.",
        continue: "Lanjutkan",
        ssdNote: "Penimpaan tidak andal pada SSD, sistem file copy-on-write atau berjurnal, maupun folder yang disinkronkan atau dicadangkan.",
        confirmTitle: "Hancurkan ini secara permanen?",
        confirmBody: (a, b) => `File yang akan dihancurkan: ${a} (${b}). Isinya tidak dapat dipulihkan, dan tidak ada yang masuk ke Karantina atau Recycle Bin.`,
        truncated: "File begitu banyak sehingga penghitungan berhenti lebih awal. Total sebenarnya lebih besar.",
        refusedHeading: (a) => `Dibiarkan karena dilindungi: ${a}`,
        confirmButton: "Hancurkan permanen",
        running: "Menghancurkan…",
        progress: (a, b) => `File dihancurkan: ${a} (${b})`,
        resultDone: (a, b) => `Selesai. File dihancurkan: ${a} (${b}).`,
        resultStopped: (a, b) => `Dihentikan. File dihancurkan: ${a} (${b}).`,
        failedHeading: (a) => `Tidak dapat dihancurkan: ${a}`,
        done: "Selesai",
        error: (a) => `Penghancuran gagal: ${a}`
      },
      wipe: {
        body: "Ini menimpa ruang kosong di drive yang Anda pilih, lalu menghapus file pengisinya, sehingga file yang sudah Anda hapus sebelumnya tidak bisa dipulihkan. Ini tidak membebaskan ruang.",
        driveLabel: "Drive yang ditimpa",
        driveOption: (a, b, c) => `${a} · ${b} kosong dari ${c}`,
        progressPass: (a, b, c, d) => `Lintasan ${a} dari ${b}: menulis data acak… ${c} dari ${d}`,
        resultRandom: (a, b) => `${a} data acak ditulis menimpa ruang kosong dalam ${b} lintasan, lalu dihapus. Tidak ada ruang yang dibebaskan.`,
        resultRandomStopped: (a) => `Dihentikan setelah menulis ${a} data acak menimpa ruang kosong. File pengisi sudah dihapus.`
      }
    }
  },
  is: {
    deepCleanV3: {
      overwrite: {
        title: "Skrifa yfir skrár áður en þeim er eytt",
        description: "Þegar Prune eyðir einhverju fyrir fullt og allt (Eyða núna, eða Eyða varanlega eftir fjarlægingu) skrifar það fyrst yfir innihald skrárinnar. Þetta er hægara og er ekki áreiðanlegt á SSD-drifum, skráakerfum með afritun við skrif eða færsluskrá, né í möppum sem eru samstilltar eða afritaðar. Það á ekki við um Sóttkví eða Ruslafötuna.",
        passes: "Yfirskriftarumferðir",
        pass1: "1 umferð (núll)",
        pass3: "3 umferðir (handahófskennd gögn)"
      },
      shred: {
        open: "Tæta skrár…",
        title: "Tæta skrár og möppur",
        intro: "Veldu skrár eða möppur til að skrifa yfir og eyða. Ekki er hægt að endurheimta tætt atriði og þau fara framhjá Sóttkví og Ruslafötunni.",
        chooseFiles: "Velja skrár…",
        chooseFolders: "Velja möppur…",
        dropHint: "Eða slepptu skrám og möppum hér",
        typeLabel: "Slóðir, ein í hverri línu",
        add: "Bæta á listann",
        remove: (a) => `Fjarlægja ${a} af listanum`,
        empty: "Ekkert valið enn.",
        continue: "Halda áfram",
        ssdNote: "Yfirskrift er ekki áreiðanleg á SSD-drifum, skráakerfum með afritun við skrif eða færsluskrá, né í möppum sem eru samstilltar eða afritaðar.",
        confirmTitle: "Tæta þetta varanlega?",
        confirmBody: (a, b) => `Skrár sem verða tættar: ${a} (${b}). Ekki er hægt að endurheimta innihald þeirra og ekkert fer í Sóttkví eða Ruslafötuna.`,
        truncated: "Skrárnar eru svo margar að talningin stöðvaðist snemma. Raunverulegur fjöldi er meiri.",
        refusedHeading: (a) => `Látið í friði því þau eru vernduð: ${a}`,
        confirmButton: "Tæta varanlega",
        running: "Tæti…",
        progress: (a, b) => `Tættar skrár: ${a} (${b})`,
        resultDone: (a, b) => `Lokið. Tættar skrár: ${a} (${b}).`,
        resultStopped: (a, b) => `Stöðvað. Tættar skrár: ${a} (${b}).`,
        failedHeading: (a) => `Tókst ekki að tæta: ${a}`,
        done: "Lokið",
        error: (a) => `Tæting mistókst: ${a}`
      },
      wipe: {
        body: "Þetta skrifar yfir laust pláss á drifinu sem þú velur og eyðir síðan fyllingarskránni, þannig að ekki sé hægt að endurheimta skrár sem þú eyddir áður. Það losar ekkert pláss.",
        driveLabel: "Drif til að skrifa yfir",
        driveOption: (a, b, c) => `${a} · ${b} laust af ${c}`,
        progressPass: (a, b, c, d) => `Umferð ${a} af ${b}: skrifa handahófskennd gögn… ${c} af ${d}`,
        resultRandom: (a, b) => `Skrifaði ${a} af handahófskenndum gögnum yfir laust pláss í ${b} umferðum og eyddi þeim síðan. Ekkert pláss losnaði.`,
        resultRandomStopped: (a) => `Stöðvað eftir að ${a} af handahófskenndum gögnum voru skrifuð yfir laust pláss. Fyllingarskránni var eytt.`
      }
    }
  },
  it: {
    deepCleanV3: {
      overwrite: {
        title: "Sovrascrivi i file prima di eliminarli",
        description: "Quando Prune elimina qualcosa in modo definitivo (Elimina subito, o Elimina definitivamente dopo una disinstallazione), prima sovrascrive il contenuto del file. È più lento e non è affidabile su SSD, file system con copy-on-write o journaling, né in cartelle sincronizzate o con backup. Non si applica alla Quarantena né al Cestino.",
        passes: "Passaggi di sovrascrittura",
        pass1: "1 passaggio (zeri)",
        pass3: "3 passaggi (dati casuali)"
      },
      shred: {
        open: "Distruggi file…",
        title: "Distruggi file e cartelle",
        intro: "Scegli i file o le cartelle da sovrascrivere ed eliminare. Gli elementi distrutti non si possono recuperare e non passano dalla Quarantena né dal Cestino.",
        chooseFiles: "Scegli file…",
        chooseFolders: "Scegli cartelle…",
        dropHint: "Oppure trascina qui file e cartelle",
        typeLabel: "Percorsi, uno per riga",
        add: "Aggiungi all'elenco",
        remove: (a) => `Rimuovi ${a} dall'elenco`,
        empty: "Non hai ancora scelto nulla.",
        continue: "Continua",
        ssdNote: "La sovrascrittura non è affidabile su SSD, file system con copy-on-write o journaling, né in cartelle sincronizzate o con backup.",
        confirmTitle: "Distruggere questi elementi definitivamente?",
        confirmBody: (a, b) => `File da distruggere: ${a} (${b}). Il loro contenuto non può essere recuperato e nulla finisce nella Quarantena o nel Cestino.`,
        truncated: "I file sono così tanti che il conteggio si è fermato in anticipo. Il totale reale è maggiore.",
        refusedHeading: (a) => `Lasciati intatti perché protetti: ${a}`,
        confirmButton: "Distruggi definitivamente",
        running: "Distruzione in corso…",
        progress: (a, b) => `File distrutti: ${a} (${b})`,
        resultDone: (a, b) => `Fatto. File distrutti: ${a} (${b}).`,
        resultStopped: (a, b) => `Interrotto. File distrutti: ${a} (${b}).`,
        failedHeading: (a) => `Impossibile distruggere: ${a}`,
        done: "Fatto",
        error: (a) => `Distruzione non riuscita: ${a}`
      },
      wipe: {
        body: "Sovrascrive lo spazio libero dell'unità scelta e poi elimina il file di riempimento, così i file eliminati in precedenza non possono essere recuperati. Non libera spazio.",
        driveLabel: "Unità da sovrascrivere",
        driveOption: (a, b, c) => `${a} · ${b} liberi su ${c}`,
        progressPass: (a, b, c, d) => `Passaggio ${a} di ${b}: scrittura di dati casuali… ${c} di ${d}`,
        resultRandom: (a, b) => `Scritti ${a} di dati casuali sullo spazio libero in ${b} passaggi, poi eliminati. Non è stato liberato spazio.`,
        resultRandomStopped: (a) => `Interrotto dopo aver scritto ${a} di dati casuali sullo spazio libero. Il file di riempimento è stato eliminato.`
      }
    }
  },
  ja: {
    deepCleanV3: {
      overwrite: {
        title: "削除する前にファイルを上書きする",
        description: "Prune がファイルを完全に削除するとき（今すぐ削除、またはアンインストール後の完全に削除）、先にファイルの内容を上書きします。処理は遅くなり、SSD、コピーオンライトやジャーナリング方式のファイルシステム、同期またはバックアップされるフォルダーでは確実ではありません。隔離やごみ箱には適用されません。",
        passes: "上書きの回数",
        pass1: "1 回（ゼロ）",
        pass3: "3 回（ランダムデータ）"
      },
      shred: {
        open: "ファイルをシュレッダー処理…",
        title: "ファイルとフォルダーをシュレッダー処理",
        intro: "上書きして削除するファイルまたはフォルダーを選びます。シュレッダー処理したものは復元できず、隔離やごみ箱も経由しません。",
        chooseFiles: "ファイルを選択…",
        chooseFolders: "フォルダーを選択…",
        dropHint: "または、ファイルやフォルダーをここにドロップ",
        typeLabel: "パス（1 行に 1 つ）",
        add: "リストに追加",
        remove: (a) => `${a} をリストから削除`,
        empty: "まだ何も選択されていません。",
        continue: "続行",
        ssdNote: "上書きは、SSD、コピーオンライトやジャーナリング方式のファイルシステム、同期またはバックアップされるフォルダーでは確実ではありません。",
        confirmTitle: "これらを完全にシュレッダー処理しますか？",
        confirmBody: (a, b) => `シュレッダー処理するファイル：${a}（${b}）。内容は復元できず、隔離やごみ箱には移動されません。`,
        truncated: "ファイル数が多すぎて、カウントが途中で止まりました。実際の合計はこれより多くなります。",
        refusedHeading: (a) => `保護されているため対象外：${a}`,
        confirmButton: "完全にシュレッダー処理",
        running: "シュレッダー処理中…",
        progress: (a, b) => `シュレッダー処理済みファイル：${a}（${b}）`,
        resultDone: (a, b) => `完了しました。シュレッダー処理したファイル：${a}（${b}）。`,
        resultStopped: (a, b) => `停止しました。シュレッダー処理したファイル：${a}（${b}）。`,
        failedHeading: (a) => `シュレッダー処理できなかった項目：${a}`,
        done: "完了",
        error: (a) => `シュレッダー処理に失敗しました：${a}`
      },
      wipe: {
        body: "選択したドライブの空き領域を上書きしてから、書き込みに使った一時ファイルを削除します。これにより、以前に削除したファイルは復元できなくなります。空き容量は増えません。",
        driveLabel: "消去するドライブ",
        driveOption: (a, b, c) => `${a} · 空き ${b} / ${c}`,
        progressPass: (a, b, c, d) => `${b} 回中 ${a} 回目：ランダムデータを書き込み中… ${c} / ${d}`,
        resultRandom: (a, b) => `空き領域に ${a} のランダムデータを ${b} 回に分けて書き込み、書き込みに使った一時ファイルを削除しました。解放された容量はありません。`,
        resultRandomStopped: (a) => `空き領域への ${a} のランダムデータの書き込み後に停止しました。書き込みに使った一時ファイルは削除されました。`
      }
    }
  },
  ko: {
    deepCleanV3: {
      overwrite: {
        title: "삭제하기 전에 파일 덮어쓰기",
        description: "Prune이 항목을 완전히 삭제할 때(지금 삭제 또는 제거 후 영구 삭제) 먼저 파일 내용을 덮어씁니다. 속도가 느려지며, SSD, 쓰기 시 복사 또는 저널링 파일 시스템, 동기화되거나 백업되는 폴더에서는 신뢰할 수 없습니다. 격리 및 휴지통에는 적용되지 않습니다.",
        passes: "덮어쓰기 횟수",
        pass1: "1회 (0으로 채우기)",
        pass3: "3회 (무작위 데이터)"
      },
      shred: {
        open: "파일 완전 삭제…",
        title: "파일 및 폴더 완전 삭제",
        intro: "덮어쓴 뒤 삭제할 파일이나 폴더를 선택하세요. 완전 삭제한 항목은 복구할 수 없으며 격리와 휴지통을 거치지 않습니다.",
        chooseFiles: "파일 선택…",
        chooseFolders: "폴더 선택…",
        dropHint: "또는 파일과 폴더를 여기에 끌어다 놓으세요",
        typeLabel: "경로 (한 줄에 하나)",
        add: "목록에 추가",
        remove: (a) => `목록에서 ${a} 제거`,
        empty: "아직 선택한 항목이 없습니다.",
        continue: "계속",
        ssdNote: "덮어쓰기는 SSD, 쓰기 시 복사 또는 저널링 파일 시스템, 동기화되거나 백업되는 폴더에서는 신뢰할 수 없습니다.",
        confirmTitle: "이 항목들을 영구적으로 완전 삭제할까요?",
        confirmBody: (a, b) => `완전 삭제할 파일: ${a}개(${b}). 내용은 복구할 수 없으며 격리나 휴지통으로 이동하지 않습니다.`,
        truncated: "파일이 너무 많아 집계가 중간에 멈췄습니다. 실제 합계는 더 큽니다.",
        refusedHeading: (a) => `보호되어 있어 건드리지 않음: ${a}`,
        confirmButton: "영구 완전 삭제",
        running: "완전 삭제 중…",
        progress: (a, b) => `완전 삭제한 파일: ${a}개(${b})`,
        resultDone: (a, b) => `완료되었습니다. 완전 삭제한 파일: ${a}개(${b}).`,
        resultStopped: (a, b) => `중지되었습니다. 완전 삭제한 파일: ${a}개(${b}).`,
        failedHeading: (a) => `완전 삭제하지 못한 항목: ${a}`,
        done: "완료",
        error: (a) => `완전 삭제에 실패했습니다: ${a}`
      },
      wipe: {
        body: "선택한 드라이브의 빈 공간을 덮어쓴 뒤 채우기용 파일을 삭제하므로, 이전에 삭제한 파일을 복구할 수 없게 됩니다. 공간은 확보되지 않습니다.",
        driveLabel: "지울 드라이브",
        driveOption: (a, b, c) => `${a} · ${c} 중 ${b} 사용 가능`,
        progressPass: (a, b, c, d) => `${b}회 중 ${a}회차: 무작위 데이터를 기록하는 중… ${c} / ${d}`,
        resultRandom: (a, b) => `빈 공간에 무작위 데이터를 ${b}회에 걸쳐 ${a}만큼 기록한 뒤 삭제했습니다. 확보된 공간은 없습니다.`,
        resultRandomStopped: (a) => `빈 공간에 무작위 데이터를 ${a}만큼 기록한 뒤 중지했습니다. 채우기용 파일은 삭제되었습니다.`
      }
    }
  },
  lt: {
    deepCleanV3: {
      overwrite: {
        title: "Perrašyti failus prieš ištrinant",
        description: "Kai „Prune“ ką nors ištrina visam laikui (Ištrinti dabar arba Ištrinti negrįžtamai po pašalinimo), jis pirmiausia perrašo failo turinį. Tai lėčiau ir nėra patikima SSD diskuose, kopijavimo rašant ar žurnalinėse failų sistemose, taip pat sinchronizuojamuose ar atsarginėmis kopijomis saugomuose aplankuose. Tai netaikoma karantinui ar šiukšlinei.",
        passes: "Perrašymo ciklai",
        pass1: "1 ciklas (nuliai)",
        pass3: "3 ciklai (atsitiktiniai duomenys)"
      },
      shred: {
        open: "Sunaikinti failus…",
        title: "Failų ir aplankų sunaikinimas",
        intro: "Pasirinkite failus ar aplankus, kuriuos reikia perrašyti ir ištrinti. Sunaikintų elementų atkurti neįmanoma, jie aplenkia karantiną ir šiukšlinę.",
        chooseFiles: "Pasirinkti failus…",
        chooseFolders: "Pasirinkti aplankus…",
        dropHint: "Arba nuvilkite failus ir aplankus čia",
        typeLabel: "Keliai, po vieną eilutėje",
        add: "Pridėti prie sąrašo",
        remove: (a) => `Pašalinti ${a} iš sąrašo`,
        empty: "Dar nieko nepasirinkta.",
        continue: "Tęsti",
        ssdNote: "Perrašymas nėra patikimas SSD diskuose, kopijavimo rašant ar žurnalinėse failų sistemose, taip pat sinchronizuojamuose ar atsarginėmis kopijomis saugomuose aplankuose.",
        confirmTitle: "Sunaikinti juos negrįžtamai?",
        confirmBody: (a, b) => `Sunaikintini failai: ${a} (${b}). Jų turinio atkurti neįmanoma, ir nieko nebus perkelta į karantiną ar šiukšlinę.`,
        truncated: "Failų tiek daug, kad skaičiavimas sustojo anksčiau laiko. Tikroji suma didesnė.",
        refusedHeading: (a) => `Paliekama, nes apsaugoti: ${a}`,
        confirmButton: "Sunaikinti negrįžtamai",
        running: "Naikinama…",
        progress: (a, b) => `Sunaikinta failų: ${a} (${b})`,
        resultDone: (a, b) => `Baigta. Sunaikinta failų: ${a} (${b}).`,
        resultStopped: (a, b) => `Sustabdyta. Sunaikinta failų: ${a} (${b}).`,
        failedHeading: (a) => `Nepavyko sunaikinti: ${a}`,
        done: "Baigta",
        error: (a) => `Sunaikinti nepavyko: ${a}`
      },
      wipe: {
        body: "Tai perrašo pasirinkto disko laisvą vietą, po to ištrina užpildymo failą, todėl anksčiau ištrintų failų atkurti nebeįmanoma. Vietos neatlaisvina.",
        driveLabel: "Perrašomas diskas",
        driveOption: (a, b, c) => `${a} · ${b} laisva iš ${c}`,
        progressPass: (a, b, c, d) => `Ciklas ${a} iš ${b}: rašomi atsitiktiniai duomenys… ${c} iš ${d}`,
        resultRandom: (a, b) => `Laisva vieta perrašyta atsitiktiniais duomenimis (${a}) per ${b} ciklus, po to užpildymo failas ištrintas. Vieta neatlaisvinta.`,
        resultRandomStopped: (a) => `Sustabdyta po to, kai laisva vieta perrašyta atsitiktiniais duomenimis (${a}). Užpildymo failas ištrintas.`
      }
    }
  },
  ms: {
    deepCleanV3: {
      overwrite: {
        title: "Timpa fail sebelum memadam",
        description: "Apabila Prune memadam sesuatu secara kekal (Padam sekarang, atau Padam secara kekal selepas nyahpasang), ia menimpa kandungan fail terlebih dahulu. Ini lebih perlahan, dan tidak boleh dipercayai pada SSD, sistem fail salin-semasa-tulis atau berjurnal, atau dalam folder yang disegerakkan atau disandarkan. Ia tidak terpakai untuk Kuarantin atau Tong Kitar Semula.",
        passes: "Bilangan laluan penimpaan",
        pass1: "1 laluan (sifar)",
        pass3: "3 laluan (data rawak)"
      },
      shred: {
        open: "Carik fail…",
        title: "Carik fail dan folder",
        intro: "Pilih fail atau folder untuk ditimpa dan dipadam. Item yang dicarik tidak boleh dipulihkan dan melangkau Kuarantin serta Tong Kitar Semula.",
        chooseFiles: "Pilih fail…",
        chooseFolders: "Pilih folder…",
        dropHint: "Atau lepaskan fail dan folder di sini",
        typeLabel: "Laluan, satu setiap baris",
        add: "Tambah ke senarai",
        remove: (a) => `Alih keluar ${a} daripada senarai`,
        empty: "Belum ada yang dipilih.",
        continue: "Teruskan",
        ssdNote: "Penimpaan tidak boleh dipercayai pada SSD, sistem fail salin-semasa-tulis atau berjurnal, atau dalam folder yang disegerakkan atau disandarkan.",
        confirmTitle: "Carik ini secara kekal?",
        confirmBody: (a, b) => `Fail untuk dicarik: ${a} (${b}). Kandungannya tidak boleh dipulihkan, dan tiada apa-apa dihantar ke Kuarantin atau Tong Kitar Semula.`,
        truncated: "Terdapat begitu banyak fail sehingga pengiraan berhenti awal. Jumlah sebenar lebih besar.",
        refusedHeading: (a) => `Dibiarkan kerana dilindungi: ${a}`,
        confirmButton: "Carik secara kekal",
        running: "Sedang mencarik…",
        progress: (a, b) => `Fail dicarik: ${a} (${b})`,
        resultDone: (a, b) => `Selesai. Fail dicarik: ${a} (${b}).`,
        resultStopped: (a, b) => `Dihentikan. Fail dicarik: ${a} (${b}).`,
        failedHeading: (a) => `Tidak dapat dicarik: ${a}`,
        done: "Selesai",
        error: (a) => `Pencarikan gagal: ${a}`
      },
      wipe: {
        body: "Ini menimpa ruang kosong pada pemacu yang anda pilih, kemudian memadam fail pengisi, supaya fail yang anda padam sebelum ini tidak boleh dipulihkan. Ia tidak membebaskan ruang.",
        driveLabel: "Pemacu untuk ditimpa",
        driveOption: (a, b, c) => `${a} · ${b} bebas daripada ${c}`,
        progressPass: (a, b, c, d) => `Laluan ${a} daripada ${b}: menulis data rawak… ${c} daripada ${d}`,
        resultRandom: (a, b) => `${a} data rawak ditulis ke atas ruang kosong dalam ${b} laluan, kemudian dipadam. Tiada ruang dibebaskan.`,
        resultRandomStopped: (a) => `Dihentikan selepas menulis ${a} data rawak ke atas ruang kosong. Fail pengisi telah dipadam.`
      }
    }
  },
  nb: {
    deepCleanV3: {
      overwrite: {
        title: "Skriv over filer før sletting",
        description: "Når Prune sletter noe for godt (Slett nå, eller Slett permanent etter en avinstallering), skriver det først over filens innhold. Dette er tregere, og det er ikke pålitelig på SSD-er, filsystemer med kopi-ved-skriving eller journalføring, eller i synkroniserte eller sikkerhetskopierte mapper. Det gjelder ikke Karantene eller Papirkurven.",
        passes: "Overskrivingspass",
        pass1: "1 pass (nuller)",
        pass3: "3 pass (tilfeldige data)"
      },
      shred: {
        open: "Makuler filer…",
        title: "Makuler filer og mapper",
        intro: "Velg filer eller mapper som skal skrives over og slettes. Makulerte elementer kan ikke gjenopprettes, og de hopper over Karantene og Papirkurven.",
        chooseFiles: "Velg filer…",
        chooseFolders: "Velg mapper…",
        dropHint: "Eller slipp filer og mapper her",
        typeLabel: "Stier, én per linje",
        add: "Legg til i listen",
        remove: (a) => `Fjern ${a} fra listen`,
        empty: "Ingenting valgt ennå.",
        continue: "Fortsett",
        ssdNote: "Overskriving er ikke pålitelig på SSD-er, filsystemer med kopi-ved-skriving eller journalføring, eller i synkroniserte eller sikkerhetskopierte mapper.",
        confirmTitle: "Makulere disse permanent?",
        confirmBody: (a, b) => `Filer som skal makuleres: ${a} (${b}). Innholdet kan ikke gjenopprettes, og ingenting havner i Karantene eller Papirkurven.`,
        truncated: "Det er så mange filer at tellingen stoppet tidlig. Det faktiske antallet er større.",
        refusedHeading: (a) => `Latt i fred fordi de er beskyttet: ${a}`,
        confirmButton: "Makuler permanent",
        running: "Makulerer…",
        progress: (a, b) => `Makulerte filer: ${a} (${b})`,
        resultDone: (a, b) => `Ferdig. Makulerte filer: ${a} (${b}).`,
        resultStopped: (a, b) => `Stoppet. Makulerte filer: ${a} (${b}).`,
        failedHeading: (a) => `Kunne ikke makuleres: ${a}`,
        done: "Ferdig",
        error: (a) => `Makuleringen mislyktes: ${a}`
      },
      wipe: {
        body: "Dette skriver over den ledige plassen på stasjonen du velger og sletter deretter fyllfilen, slik at filer du slettet tidligere ikke kan gjenopprettes. Det frigjør ingen plass.",
        driveLabel: "Stasjon som skal skrives over",
        driveOption: (a, b, c) => `${a} · ${b} ledig av ${c}`,
        progressPass: (a, b, c, d) => `Pass ${a} av ${b}: skriver tilfeldige data… ${c} av ${d}`,
        resultRandom: (a, b) => `Skrev ${a} tilfeldige data over den ledige plassen i ${b} pass og slettet dem deretter. Ingen plass ble frigjort.`,
        resultRandomStopped: (a) => `Stoppet etter å ha skrevet ${a} tilfeldige data over den ledige plassen. Fyllfilen ble slettet.`
      }
    }
  },
  nl: {
    deepCleanV3: {
      overwrite: {
        title: "Bestanden overschrijven vóór het verwijderen",
        description: "Wanneer Prune iets definitief verwijdert (Nu verwijderen, of Permanent verwijderen na een verwijdering van een programma), overschrijft het eerst de inhoud van het bestand. Dat is langzamer en niet betrouwbaar op SSD's, bestandssystemen met copy-on-write of journaling, of in gesynchroniseerde of gebackupte mappen. Het geldt niet voor Quarantaine of de Prullenbak.",
        passes: "Overschrijfrondes",
        pass1: "1 ronde (nullen)",
        pass3: "3 rondes (willekeurige gegevens)"
      },
      shred: {
        open: "Bestanden versnipperen…",
        title: "Bestanden en mappen versnipperen",
        intro: "Kies bestanden of mappen om te overschrijven en te verwijderen. Versnipperde items kunnen niet worden hersteld en gaan niet via Quarantaine of de Prullenbak.",
        chooseFiles: "Bestanden kiezen…",
        chooseFolders: "Mappen kiezen…",
        dropHint: "Of sleep bestanden en mappen hierheen",
        typeLabel: "Paden, één per regel",
        add: "Aan lijst toevoegen",
        remove: (a) => `${a} uit de lijst verwijderen`,
        empty: "Nog niets gekozen.",
        continue: "Doorgaan",
        ssdNote: "Overschrijven is niet betrouwbaar op SSD's, bestandssystemen met copy-on-write of journaling, of in gesynchroniseerde of gebackupte mappen.",
        confirmTitle: "Deze definitief versnipperen?",
        confirmBody: (a, b) => `Te versnipperen bestanden: ${a} (${b}). De inhoud kan niet worden hersteld en er gaat niets naar Quarantaine of de Prullenbak.`,
        truncated: "Er zijn zoveel bestanden dat het tellen voortijdig is gestopt. Het werkelijke totaal is groter.",
        refusedHeading: (a) => `Met rust gelaten omdat ze beschermd zijn: ${a}`,
        confirmButton: "Definitief versnipperen",
        running: "Bezig met versnipperen…",
        progress: (a, b) => `Versnipperde bestanden: ${a} (${b})`,
        resultDone: (a, b) => `Klaar. Versnipperde bestanden: ${a} (${b}).`,
        resultStopped: (a, b) => `Gestopt. Versnipperde bestanden: ${a} (${b}).`,
        failedHeading: (a) => `Kon niet worden versnipperd: ${a}`,
        done: "Klaar",
        error: (a) => `Versnipperen mislukt: ${a}`
      },
      wipe: {
        body: "Dit overschrijft de vrije ruimte op de schijf die je kiest en verwijdert daarna het opvulbestand, zodat eerder verwijderde bestanden niet kunnen worden hersteld. Het maakt geen ruimte vrij.",
        driveLabel: "Schijf om te overschrijven",
        driveOption: (a, b, c) => `${a} · ${b} vrij van ${c}`,
        progressPass: (a, b, c, d) => `Ronde ${a} van ${b}: willekeurige gegevens schrijven… ${c} van ${d}`,
        resultRandom: (a, b) => `${a} aan willekeurige gegevens in ${b} rondes over de vrije ruimte geschreven en daarna verwijderd. Er is geen ruimte vrijgemaakt.`,
        resultRandomStopped: (a) => `Gestopt na het schrijven van ${a} aan willekeurige gegevens over de vrije ruimte. Het opvulbestand is verwijderd.`
      }
    }
  },
  pl: {
    deepCleanV3: {
      overwrite: {
        title: "Nadpisz pliki przed usunięciem",
        description: "Gdy Prune usuwa coś bezpowrotnie (Usuń od razu lub Usuń trwale po odinstalowaniu), najpierw nadpisuje zawartość pliku. Jest to wolniejsze i niewiarygodne na dyskach SSD, w systemach plików z kopiowaniem przy zapisie lub księgowaniem oraz w folderach synchronizowanych lub objętych kopią zapasową. Nie dotyczy kwarantanny ani kosza.",
        passes: "Liczba przebiegów nadpisywania",
        pass1: "1 przebieg (zera)",
        pass3: "3 przebiegi (dane losowe)"
      },
      shred: {
        open: "Niszcz pliki…",
        title: "Niszczenie plików i folderów",
        intro: "Wybierz pliki lub foldery do nadpisania i usunięcia. Zniszczonych elementów nie można odzyskać, a omijają one kwarantannę i kosz.",
        chooseFiles: "Wybierz pliki…",
        chooseFolders: "Wybierz foldery…",
        dropHint: "Lub upuść tutaj pliki i foldery",
        typeLabel: "Ścieżki, po jednej w wierszu",
        add: "Dodaj do listy",
        remove: (a) => `Usuń ${a} z listy`,
        empty: "Nic jeszcze nie wybrano.",
        continue: "Dalej",
        ssdNote: "Nadpisywanie jest zawodne na dyskach SSD, w systemach plików z kopiowaniem przy zapisie lub księgowaniem oraz w folderach synchronizowanych lub objętych kopią zapasową.",
        confirmTitle: "Zniszczyć je trwale?",
        confirmBody: (a, b) => `Pliki do zniszczenia: ${a} (${b}). Ich zawartości nie da się odzyskać i nic nie trafia do kwarantanny ani kosza.`,
        truncated: "Plików jest tak dużo, że liczenie zatrzymało się wcześniej. Rzeczywista liczba jest większa.",
        refusedHeading: (a) => `Pominięto, bo są chronione: ${a}`,
        confirmButton: "Zniszcz trwale",
        running: "Niszczenie…",
        progress: (a, b) => `Zniszczone pliki: ${a} (${b})`,
        resultDone: (a, b) => `Gotowe. Zniszczone pliki: ${a} (${b}).`,
        resultStopped: (a, b) => `Zatrzymano. Zniszczone pliki: ${a} (${b}).`,
        failedHeading: (a) => `Nie udało się zniszczyć: ${a}`,
        done: "Gotowe",
        error: (a) => `Niszczenie nie powiodło się: ${a}`
      },
      wipe: {
        body: "Nadpisuje wolne miejsce na wybranym dysku, a potem usuwa plik wypełniający, dzięki czemu wcześniej usuniętych plików nie da się odzyskać. Nie zwalnia miejsca.",
        driveLabel: "Dysk do nadpisania",
        driveOption: (a, b, c) => `${a} · ${b} wolne z ${c}`,
        progressPass: (a, b, c, d) => `Przebieg ${a} z ${b}: zapisywanie danych losowych… ${c} z ${d}`,
        resultRandom: (a, b) => `Wolne miejsce nadpisano danymi losowymi (${a}) w ${b} przebiegach, po czym plik wypełniający usunięto. Nie zwolniono miejsca.`,
        resultRandomStopped: (a) => `Zatrzymano po zapisaniu danych losowych (${a}) w wolnym miejscu. Plik wypełniający usunięto.`
      }
    }
  },
  ps: {
    deepCleanV3: {
      overwrite: {
        title: "د ړنګولو دمخه فایلونه بیا لیکل",
        description: "کله چې Prune یو څه د تل لپاره ړنګوي (همدا اوس ړنګول، یا له لرې کولو وروسته د تل لپاره ړنګول)، لومړی د فایل منځپانګه بیا لیکي. دا ورو دی، او په SSD، د لیکلو پر مهال کاپي یا ژورنالي فایل سیسټمونو، یا همغږي شویو یا بیک اپ شویو پوښو کې باوري نه دی. دا په قرنطین یا ردي بکس نه تطبیقیږي.",
        passes: "د بیا لیکلو پړاوونه",
        pass1: "۱ پړاو (صفرونه)",
        pass3: "۳ پړاوونه (تصادفي معلومات)"
      },
      shred: {
        open: "فایلونه ټوټه کول…",
        title: "فایلونه او پوښې ټوټه کول",
        intro: "هغه فایلونه یا پوښې وټاکئ چې باید بیا ولیکل شي او ړنګ شي. ټوټه شوي توکي بیرته نشي راتلی او قرنطین او ردي بکس پرېږدي.",
        chooseFiles: "فایلونه وټاکئ…",
        chooseFolders: "پوښې وټاکئ…",
        dropHint: "یا فایلونه او پوښې دلته پرېږدئ",
        typeLabel: "لارې، په هره کرښه کې یوه",
        add: "لیست ته اضافه کړئ",
        remove: (a) => `${a} له لیست څخه لرې کړئ`,
        empty: "تر اوسه هیڅ نه دي ټاکل شوي.",
        continue: "ادامه",
        ssdNote: "بیا لیکل په SSD، د لیکلو پر مهال کاپي یا ژورنالي فایل سیسټمونو، یا همغږي شویو یا بیک اپ شویو پوښو کې باوري نه دي.",
        confirmTitle: "دا د تل لپاره ټوټه کړئ؟",
        confirmBody: (a, b) => `د ټوټه کولو فایلونه: ${a} (${b}). منځپانګه یې بیرته نشي راتلی، او هیڅ شی قرنطین یا ردي بکس ته نه ځي.`,
        truncated: "فایلونه دومره ډېر دي چې شمېرنه وختي ودرېده. اصلي ټولټال لوی دی.",
        refusedHeading: (a) => `نه لمس کیږي ځکه چې خوندي دي: ${a}`,
        confirmButton: "د تل لپاره ټوټه کړئ",
        running: "ټوټه کول روان دي…",
        progress: (a, b) => `ټوټه شوي فایلونه: ${a} (${b})`,
        resultDone: (a, b) => `بشپړ شو. ټوټه شوي فایلونه: ${a} (${b}).`,
        resultStopped: (a, b) => `ودرول شو. ټوټه شوي فایلونه: ${a} (${b}).`,
        failedHeading: (a) => `ټوټه نشول: ${a}`,
        done: "بشپړ شو",
        error: (a) => `ټوټه کول ناکام شول: ${a}`
      },
      wipe: {
        body: "دا د هغه ډرایو وړیا ځای بیا لیکي چې تاسو یې غوره کوئ، بیا ډکوونکی فایل ړنګوي، نو هغه فایلونه چې تاسو مخکې ړنګ کړي بیرته نشي ترلاسه کیدی. دا هیڅ ځای نه خلاصوي.",
        driveLabel: "ډرایو چې باید پاک شي",
        driveOption: (a, b, c) => `${a} · له ${c} څخه ${b} وړیا`,
        progressPass: (a, b, c, d) => `${a} پړاو له ${b} څخه: تصادفي معلومات لیکل کیږي… ${c} له ${d} څخه`,
        resultRandom: (a, b) => `په وړیا ځای کې ${a} تصادفي معلومات په ${b} پړاوونو کې ولیکل شول او بیا ړنګ شول. هیڅ ځای نه دی خلاص شوی.`,
        resultRandomStopped: (a) => `په وړیا ځای کې د ${a} تصادفي معلوماتو لیکلو وروسته ودرول شو. ډکوونکی فایل ړنګ شو.`
      }
    }
  },
  "pt-BR": {
    deepCleanV3: {
      overwrite: {
        title: "Sobrescrever os arquivos antes de excluir",
        description: "Quando o Prune exclui algo de vez (Excluir agora, ou Excluir permanentemente após uma desinstalação), ele primeiro sobrescreve o conteúdo do arquivo. Isso é mais lento e não é confiável em SSDs, em sistemas de arquivos com cópia na gravação ou com journaling, nem em pastas sincronizadas ou com backup. Não se aplica à Quarentena nem à Lixeira.",
        passes: "Passagens de sobrescrita",
        pass1: "1 passagem (zeros)",
        pass3: "3 passagens (dados aleatórios)"
      },
      shred: {
        open: "Triturar arquivos…",
        title: "Triturar arquivos e pastas",
        intro: "Escolha os arquivos ou pastas a sobrescrever e excluir. Os itens triturados não podem ser recuperados e não passam pela Quarentena nem pela Lixeira.",
        chooseFiles: "Escolher arquivos…",
        chooseFolders: "Escolher pastas…",
        dropHint: "Ou solte arquivos e pastas aqui",
        typeLabel: "Caminhos, um por linha",
        add: "Adicionar à lista",
        remove: (a) => `Remover ${a} da lista`,
        empty: "Nada escolhido ainda.",
        continue: "Continuar",
        ssdNote: "A sobrescrita não é confiável em SSDs, em sistemas de arquivos com cópia na gravação ou com journaling, nem em pastas sincronizadas ou com backup.",
        confirmTitle: "Triturar isto permanentemente?",
        confirmBody: (a, b) => `Arquivos a triturar: ${a} (${b}). O conteúdo não pode ser recuperado e nada vai para a Quarentena nem para a Lixeira.`,
        truncated: "Há tantos arquivos que a contagem parou antes do fim. O total real é maior.",
        refusedHeading: (a) => `Deixados intactos por estarem protegidos: ${a}`,
        confirmButton: "Triturar permanentemente",
        running: "Triturando…",
        progress: (a, b) => `Arquivos triturados: ${a} (${b})`,
        resultDone: (a, b) => `Concluído. Arquivos triturados: ${a} (${b}).`,
        resultStopped: (a, b) => `Interrompido. Arquivos triturados: ${a} (${b}).`,
        failedHeading: (a) => `Não foi possível triturar: ${a}`,
        done: "Concluído",
        error: (a) => `Falha ao triturar: ${a}`
      },
      wipe: {
        body: "Isso grava sobre o espaço livre da unidade escolhida e depois exclui o arquivo de preenchimento, para que arquivos excluídos antes não possam ser recuperados. Não libera espaço.",
        driveLabel: "Unidade a sobrescrever",
        driveOption: (a, b, c) => `${a} · ${b} livres de ${c}`,
        progressPass: (a, b, c, d) => `Passagem ${a} de ${b}: gravando dados aleatórios… ${c} de ${d}`,
        resultRandom: (a, b) => `Foram gravados ${a} de dados aleatórios sobre o espaço livre em ${b} passagens e depois excluídos. Nenhum espaço foi liberado.`,
        resultRandomStopped: (a) => `Interrompido após gravar ${a} de dados aleatórios sobre o espaço livre. O arquivo de preenchimento foi excluído.`
      }
    }
  },
  pt: {
    deepCleanV3: {
      overwrite: {
        title: "Sobrescrever os ficheiros antes de eliminar",
        description: "Quando o Prune elimina algo em definitivo (Eliminar agora, ou Eliminar permanentemente após uma desinstalação), primeiro sobrescreve o conteúdo do ficheiro. Isto é mais lento e não é fiável em SSD, em sistemas de ficheiros com cópia na escrita ou com registo em diário, nem em pastas sincronizadas ou com cópia de segurança. Não se aplica à Quarentena nem à Reciclagem.",
        passes: "Passagens de sobrescrita",
        pass1: "1 passagem (zeros)",
        pass3: "3 passagens (dados aleatórios)"
      },
      shred: {
        open: "Triturar ficheiros…",
        title: "Triturar ficheiros e pastas",
        intro: "Escolha os ficheiros ou pastas a sobrescrever e eliminar. Os itens triturados não podem ser recuperados e não passam pela Quarentena nem pela Reciclagem.",
        chooseFiles: "Escolher ficheiros…",
        chooseFolders: "Escolher pastas…",
        dropHint: "Ou largue aqui ficheiros e pastas",
        typeLabel: "Caminhos, um por linha",
        add: "Adicionar à lista",
        remove: (a) => `Remover ${a} da lista`,
        empty: "Ainda não escolheu nada.",
        continue: "Continuar",
        ssdNote: "A sobrescrita não é fiável em SSD, em sistemas de ficheiros com cópia na escrita ou com registo em diário, nem em pastas sincronizadas ou com cópia de segurança.",
        confirmTitle: "Triturar isto de forma permanente?",
        confirmBody: (a, b) => `Ficheiros a triturar: ${a} (${b}). O conteúdo não pode ser recuperado e nada vai para a Quarentena nem para a Reciclagem.`,
        truncated: "Há tantos ficheiros que a contagem parou antes do fim. O total real é maior.",
        refusedHeading: (a) => `Deixados intactos por estarem protegidos: ${a}`,
        confirmButton: "Triturar permanentemente",
        running: "A triturar…",
        progress: (a, b) => `Ficheiros triturados: ${a} (${b})`,
        resultDone: (a, b) => `Concluído. Ficheiros triturados: ${a} (${b}).`,
        resultStopped: (a, b) => `Interrompido. Ficheiros triturados: ${a} (${b}).`,
        failedHeading: (a) => `Não foi possível triturar: ${a}`,
        done: "Concluído",
        error: (a) => `Falha ao triturar: ${a}`
      },
      wipe: {
        body: "Isto escreve sobre o espaço livre da unidade escolhida e depois elimina o ficheiro de preenchimento, para que os ficheiros eliminados anteriormente não possam ser recuperados. Não liberta espaço.",
        driveLabel: "Unidade a sobrescrever",
        driveOption: (a, b, c) => `${a} · ${b} livres de ${c}`,
        progressPass: (a, b, c, d) => `Passagem ${a} de ${b}: a escrever dados aleatórios… ${c} de ${d}`,
        resultRandom: (a, b) => `Foram escritos ${a} de dados aleatórios sobre o espaço livre em ${b} passagens e depois eliminados. Não foi libertado espaço.`,
        resultRandomStopped: (a) => `Interrompido depois de escrever ${a} de dados aleatórios sobre o espaço livre. O ficheiro de preenchimento foi eliminado.`
      }
    }
  },
  ro: {
    deepCleanV3: {
      overwrite: {
        title: "Suprascrie fișierele înainte de ștergere",
        description: "Când Prune șterge ceva definitiv (Șterge acum sau Șterge definitiv după o dezinstalare), mai întâi suprascrie conținutul fișierului. Este mai lent și nu este fiabil pe SSD-uri, pe sisteme de fișiere cu copiere la scriere sau cu jurnal, nici în foldere sincronizate sau cu copie de rezervă. Nu se aplică Carantinei sau Coșului de reciclare.",
        passes: "Treceri de suprascriere",
        pass1: "1 trecere (zerouri)",
        pass3: "3 treceri (date aleatorii)"
      },
      shred: {
        open: "Distruge fișiere…",
        title: "Distruge fișiere și foldere",
        intro: "Alege fișierele sau folderele de suprascris și de șters. Elementele distruse nu pot fi recuperate și ocolesc Carantina și Coșul de reciclare.",
        chooseFiles: "Alege fișiere…",
        chooseFolders: "Alege foldere…",
        dropHint: "Sau trage aici fișiere și foldere",
        typeLabel: "Căi, câte una pe rând",
        add: "Adaugă în listă",
        remove: (a) => `Elimină ${a} din listă`,
        empty: "Încă nu ai ales nimic.",
        continue: "Continuă",
        ssdNote: "Suprascrierea nu este fiabilă pe SSD-uri, pe sisteme de fișiere cu copiere la scriere sau cu jurnal, nici în foldere sincronizate sau cu copie de rezervă.",
        confirmTitle: "Le distrugi definitiv?",
        confirmBody: (a, b) => `Fișiere de distrus: ${a} (${b}). Conținutul lor nu poate fi recuperat și nimic nu ajunge în Carantină sau în Coșul de reciclare.`,
        truncated: "Sunt atât de multe fișiere încât numărătoarea s-a oprit mai devreme. Totalul real este mai mare.",
        refusedHeading: (a) => `Lăsate neatinse pentru că sunt protejate: ${a}`,
        confirmButton: "Distruge definitiv",
        running: "Se distruge…",
        progress: (a, b) => `Fișiere distruse: ${a} (${b})`,
        resultDone: (a, b) => `Gata. Fișiere distruse: ${a} (${b}).`,
        resultStopped: (a, b) => `Oprit. Fișiere distruse: ${a} (${b}).`,
        failedHeading: (a) => `Nu au putut fi distruse: ${a}`,
        done: "Gata",
        error: (a) => `Distrugerea a eșuat: ${a}`
      },
      wipe: {
        body: "Aceasta scrie peste spațiul liber de pe unitatea aleasă, apoi șterge fișierul de umplere, astfel încât fișierele șterse mai devreme să nu mai poată fi recuperate. Nu eliberează spațiu.",
        driveLabel: "Unitatea de suprascris",
        driveOption: (a, b, c) => `${a} · ${b} liberi din ${c}`,
        progressPass: (a, b, c, d) => `Trecerea ${a} din ${b}: se scriu date aleatorii… ${c} din ${d}`,
        resultRandom: (a, b) => `S-au scris ${a} de date aleatorii peste spațiul liber în ${b} treceri, apoi au fost șterse. Nu s-a eliberat spațiu.`,
        resultRandomStopped: (a) => `Oprit după ce s-au scris ${a} de date aleatorii peste spațiul liber. Fișierul de umplere a fost șters.`
      }
    }
  },
  ru: {
    deepCleanV3: {
      overwrite: {
        title: "Перезаписывать файлы перед удалением",
        description: "Когда Prune удаляет что-то безвозвратно (Удалить сразу или Удалить навсегда после удаления программы), он сначала перезаписывает содержимое файла. Это медленнее и ненадёжно на SSD, в файловых системах с копированием при записи или журналированием, а также в синхронизируемых или резервируемых папках. К карантину и корзине это не относится.",
        passes: "Проходы перезаписи",
        pass1: "1 проход (нули)",
        pass3: "3 прохода (случайные данные)"
      },
      shred: {
        open: "Уничтожить файлы…",
        title: "Уничтожение файлов и папок",
        intro: "Выберите файлы или папки, которые нужно перезаписать и удалить. Уничтоженные элементы восстановить нельзя, они минуют карантин и корзину.",
        chooseFiles: "Выбрать файлы…",
        chooseFolders: "Выбрать папки…",
        dropHint: "Или перетащите сюда файлы и папки",
        typeLabel: "Пути, по одному в строке",
        add: "Добавить в список",
        remove: (a) => `Убрать ${a} из списка`,
        empty: "Пока ничего не выбрано.",
        continue: "Продолжить",
        ssdNote: "Перезапись ненадёжна на SSD, в файловых системах с копированием при записи или журналированием, а также в синхронизируемых или резервируемых папках.",
        confirmTitle: "Уничтожить это безвозвратно?",
        confirmBody: (a, b) => `Файлов к уничтожению: ${a} (${b}). Их содержимое восстановить невозможно, ничего не попадёт в карантин или корзину.`,
        truncated: "Файлов так много, что подсчёт остановился раньше времени. Реальный итог больше.",
        refusedHeading: (a) => `Не тронуты, так как защищены: ${a}`,
        confirmButton: "Уничтожить безвозвратно",
        running: "Уничтожение…",
        progress: (a, b) => `Уничтожено файлов: ${a} (${b})`,
        resultDone: (a, b) => `Готово. Уничтожено файлов: ${a} (${b}).`,
        resultStopped: (a, b) => `Остановлено. Уничтожено файлов: ${a} (${b}).`,
        failedHeading: (a) => `Не удалось уничтожить: ${a}`,
        done: "Готово",
        error: (a) => `Не удалось уничтожить: ${a}`
      },
      wipe: {
        body: "Свободное место на выбранном диске перезаписывается, после чего файл-заполнитель удаляется, чтобы ранее удалённые файлы нельзя было восстановить. Место при этом не освобождается.",
        driveLabel: "Диск для затирания",
        driveOption: (a, b, c) => `${a} · свободно ${b} из ${c}`,
        progressPass: (a, b, c, d) => `Проход ${a} из ${b}: запись случайных данных… ${c} из ${d}`,
        resultRandom: (a, b) => `Свободное место перезаписано случайными данными (${a}) за ${b} прохода, после чего файл-заполнитель удалён. Место не освобождено.`,
        resultRandomStopped: (a) => `Остановлено после записи случайных данных (${a}) в свободное место. Файл-заполнитель удалён.`
      }
    }
  },
  sk: {
    deepCleanV3: {
      overwrite: {
        title: "Prepísať súbory pred odstránením",
        description: "Keď Prune niečo odstráni natrvalo (Odstrániť hneď alebo Trvalo odstrániť po odinštalovaní), najprv prepíše obsah súboru. Je to pomalšie a nie je to spoľahlivé na SSD, v súborových systémoch s kopírovaním pri zápise alebo žurnálovaním ani v synchronizovaných či zálohovaných priečinkoch. Netýka sa karantény ani koša.",
        passes: "Počet prepisov",
        pass1: "1 prepis (nuly)",
        pass3: "3 prepisy (náhodné údaje)"
      },
      shred: {
        open: "Skartovať súbory…",
        title: "Skartovať súbory a priečinky",
        intro: "Vyberte súbory alebo priečinky, ktoré sa majú prepísať a odstrániť. Skartované položky sa nedajú obnoviť a obchádzajú karanténu aj kôš.",
        chooseFiles: "Vybrať súbory…",
        chooseFolders: "Vybrať priečinky…",
        dropHint: "Alebo sem pretiahnite súbory a priečinky",
        typeLabel: "Cesty, jedna na riadok",
        add: "Pridať do zoznamu",
        remove: (a) => `Odstrániť ${a} zo zoznamu`,
        empty: "Zatiaľ nie je nič vybrané.",
        continue: "Pokračovať",
        ssdNote: "Prepisovanie nie je spoľahlivé na SSD, v súborových systémoch s kopírovaním pri zápise alebo žurnálovaním ani v synchronizovaných či zálohovaných priečinkoch.",
        confirmTitle: "Natrvalo ich skartovať?",
        confirmBody: (a, b) => `Súbory na skartovanie: ${a} (${b}). Ich obsah sa nedá obnoviť a nič sa nepresunie do karantény ani do koša.`,
        truncated: "Súborov je tak veľa, že sa počítanie predčasne zastavilo. Skutočný počet je vyšší.",
        refusedHeading: (a) => `Ponechané, pretože sú chránené: ${a}`,
        confirmButton: "Natrvalo skartovať",
        running: "Skartuje sa…",
        progress: (a, b) => `Skartované súbory: ${a} (${b})`,
        resultDone: (a, b) => `Hotovo. Skartované súbory: ${a} (${b}).`,
        resultStopped: (a, b) => `Zastavené. Skartované súbory: ${a} (${b}).`,
        failedHeading: (a) => `Nepodarilo sa skartovať: ${a}`,
        done: "Hotovo",
        error: (a) => `Skartovanie zlyhalo: ${a}`
      },
      wipe: {
        body: "Prepíše voľné miesto na zvolenej jednotke a potom odstráni vypĺňací súbor, takže skôr odstránené súbory nemožno obnoviť. Neuvoľní žiadne miesto.",
        driveLabel: "Jednotka na prepísanie",
        driveOption: (a, b, c) => `${a} · ${b} voľných z ${c}`,
        progressPass: (a, b, c, d) => `Prepis ${a} z ${b}: zapisovanie náhodných údajov… ${c} z ${d}`,
        resultRandom: (a, b) => `Voľné miesto bolo prepísané náhodnými údajmi (${a}) v ${b} prepisoch a vypĺňací súbor bol odstránený. Žiadne miesto sa neuvoľnilo.`,
        resultRandomStopped: (a) => `Zastavené po zapísaní náhodných údajov (${a}) do voľného miesta. Vypĺňací súbor bol odstránený.`
      }
    }
  },
  sq: {
    deepCleanV3: {
      overwrite: {
        title: "Mbishkruaj skedarët para fshirjes",
        description: "Kur Prune fshin diçka përgjithmonë (Fshi tani, ose Fshi përgjithmonë pas një çinstalimi), fillimisht shkruan mbi përmbajtjen e skedarit. Kjo është më e ngadaltë dhe nuk është e besueshme në SSD, në sisteme skedarësh me kopjim-gjatë-shkrimit ose me regjistër, as në dosje të sinkronizuara ose me kopje rezervë. Nuk vlen për Karantinën ose Koshin e Riciklimit.",
        passes: "Kalime mbishkrimi",
        pass1: "1 kalim (zero)",
        pass3: "3 kalime (të dhëna të rastësishme)"
      },
      shred: {
        open: "Shkatërro skedarë…",
        title: "Shkatërro skedarë dhe dosje",
        intro: "Zgjidh skedarët ose dosjet që do të mbishkruhen dhe fshihen. Elementët e shkatërruar nuk mund të rikuperohen dhe anashkalojnë Karantinën dhe Koshin e Riciklimit.",
        chooseFiles: "Zgjidh skedarë…",
        chooseFolders: "Zgjidh dosje…",
        dropHint: "Ose lëshoji skedarët dhe dosjet këtu",
        typeLabel: "Shtigje, një për rresht",
        add: "Shto në listë",
        remove: (a) => `Hiq ${a} nga lista`,
        empty: "Ende nuk është zgjedhur asgjë.",
        continue: "Vazhdo",
        ssdNote: "Mbishkrimi nuk është i besueshëm në SSD, në sisteme skedarësh me kopjim-gjatë-shkrimit ose me regjistër, as në dosje të sinkronizuara ose me kopje rezervë.",
        confirmTitle: "T’i shkatërrosh përgjithmonë?",
        confirmBody: (a, b) => `Skedarë për t’u shkatërruar: ${a} (${b}). Përmbajtja e tyre nuk mund të rikuperohet dhe asgjë nuk shkon në Karantinë ose në Koshin e Riciklimit.`,
        truncated: "Ka kaq shumë skedarë sa numërimi u ndal herët. Totali real është më i madh.",
        refusedHeading: (a) => `Lihen të paprekura sepse janë të mbrojtura: ${a}`,
        confirmButton: "Shkatërro përgjithmonë",
        running: "Po shkatërrohet…",
        progress: (a, b) => `Skedarë të shkatërruar: ${a} (${b})`,
        resultDone: (a, b) => `U krye. Skedarë të shkatërruar: ${a} (${b}).`,
        resultStopped: (a, b) => `U ndalua. Skedarë të shkatërruar: ${a} (${b}).`,
        failedHeading: (a) => `Nuk u shkatërruan dot: ${a}`,
        done: "U krye",
        error: (a) => `Shkatërrimi dështoi: ${a}`
      },
      wipe: {
        body: "Kjo mbishkruan hapësirën e lirë të diskut që zgjedh, pastaj fshin skedarin mbushës, që skedarët që ke fshirë më parë të mos mund të rikthehen. Nuk liron hapësirë.",
        driveLabel: "Disku që do të mbishkruhet",
        driveOption: (a, b, c) => `${a} · ${b} të lira nga ${c}`,
        progressPass: (a, b, c, d) => `Kalimi ${a} nga ${b}: po shkruhen të dhëna të rastësishme… ${c} nga ${d}`,
        resultRandom: (a, b) => `U shkruan ${a} të dhëna të rastësishme mbi hapësirën e lirë në ${b} kalime, pastaj u fshinë. Nuk u lirua hapësirë.`,
        resultRandomStopped: (a) => `U ndal pasi u shkruan ${a} të dhëna të rastësishme mbi hapësirën e lirë. Skedari mbushës u fshi.`
      }
    }
  },
  sr: {
    deepCleanV3: {
      overwrite: {
        title: "Препиши датотеке пре брисања",
        description: "Када Prune нешто трајно брише (Обриши одмах или Трајно обриши након деинсталације), прво препише садржај датотеке. Ово је спорије и није поуздано на SSD-овима, у фајл системима са копирањем при писању или журналисањем, нити у синхронизованим или резервно копираним фасциклама. Не односи се на Карантин нити на Корпу за отпатке.",
        passes: "Пролази преписивања",
        pass1: "1 пролаз (нуле)",
        pass3: "3 пролаза (насумични подаци)"
      },
      shred: {
        open: "Уништи датотеке…",
        title: "Уништавање датотека и фасцикли",
        intro: "Изаберите датотеке или фасцикле које треба преписати и обрисати. Уништене ставке се не могу вратити и заобилазе Карантин и Корпу за отпатке.",
        chooseFiles: "Изабери датотеке…",
        chooseFolders: "Изабери фасцикле…",
        dropHint: "Или превуците датотеке и фасцикле овде",
        typeLabel: "Путање, једна по реду",
        add: "Додај на листу",
        remove: (a) => `Уклони ${a} са листе`,
        empty: "Још ништа није изабрано.",
        continue: "Настави",
        ssdNote: "Преписивање није поуздано на SSD-овима, у фајл системима са копирањем при писању или журналисањем, нити у синхронизованим или резервно копираним фасциклама.",
        confirmTitle: "Трајно уништити ово?",
        confirmBody: (a, b) => `Датотеке за уништавање: ${a} (${b}). Њихов садржај се не може вратити и ништа не иде у Карантин или Корпу за отпатке.`,
        truncated: "Датотека има толико да се бројање раније зауставило. Стварни збир је већи.",
        refusedHeading: (a) => `Остављено јер је заштићено: ${a}`,
        confirmButton: "Трајно уништи",
        running: "Уништавање…",
        progress: (a, b) => `Уништене датотеке: ${a} (${b})`,
        resultDone: (a, b) => `Готово. Уништене датотеке: ${a} (${b}).`,
        resultStopped: (a, b) => `Заустављено. Уништене датотеке: ${a} (${b}).`,
        failedHeading: (a) => `Није могло да се уништи: ${a}`,
        done: "Готово",
        error: (a) => `Уништавање није успело: ${a}`
      },
      wipe: {
        body: "Ово преписује слободан простор на изабраном диску, а затим брише датотеку за попуну, па се раније обрисане датотеке не могу повратити. Не ослобађа простор.",
        driveLabel: "Диск за преписивање",
        driveOption: (a, b, c) => `${a} · ${b} слободно од ${c}`,
        progressPass: (a, b, c, d) => `Пролаз ${a} од ${b}: уписују се насумични подаци… ${c} од ${d}`,
        resultRandom: (a, b) => `Слободан простор је преписан насумичним подацима (${a}) у ${b} пролаза, а затим је датотека за попуну обрисана. Простор није ослобођен.`,
        resultRandomStopped: (a) => `Заустављено након што је слободан простор преписан насумичним подацима (${a}). Датотека за попуну је обрисана.`
      }
    }
  },
  sv: {
    deepCleanV3: {
      overwrite: {
        title: "Skriv över filer före radering",
        description: "När Prune raderar något för gott (Radera nu, eller Radera permanent efter en avinstallation) skriver det först över filens innehåll. Det är långsammare och inte pålitligt på SSD:er, filsystem med copy-on-write eller journalföring, eller i synkade eller säkerhetskopierade mappar. Det gäller inte Karantän eller Papperskorgen.",
        passes: "Överskrivningspass",
        pass1: "1 pass (nollor)",
        pass3: "3 pass (slumpmässiga data)"
      },
      shred: {
        open: "Strimla filer…",
        title: "Strimla filer och mappar",
        intro: "Välj filer eller mappar som ska skrivas över och raderas. Strimlade objekt kan inte återställas och hoppar över Karantän och Papperskorgen.",
        chooseFiles: "Välj filer…",
        chooseFolders: "Välj mappar…",
        dropHint: "Eller släpp filer och mappar här",
        typeLabel: "Sökvägar, en per rad",
        add: "Lägg till i listan",
        remove: (a) => `Ta bort ${a} från listan`,
        empty: "Inget valt ännu.",
        continue: "Fortsätt",
        ssdNote: "Överskrivning är inte pålitlig på SSD:er, filsystem med copy-on-write eller journalföring, eller i synkade eller säkerhetskopierade mappar.",
        confirmTitle: "Strimla dessa permanent?",
        confirmBody: (a, b) => `Filer som ska strimlas: ${a} (${b}). Innehållet kan inte återställas och inget hamnar i Karantän eller Papperskorgen.`,
        truncated: "Det finns så många filer att räkningen avbröts i förtid. Det verkliga antalet är större.",
        refusedHeading: (a) => `Lämnas orörda eftersom de är skyddade: ${a}`,
        confirmButton: "Strimla permanent",
        running: "Strimlar…",
        progress: (a, b) => `Strimlade filer: ${a} (${b})`,
        resultDone: (a, b) => `Klart. Strimlade filer: ${a} (${b}).`,
        resultStopped: (a, b) => `Stoppad. Strimlade filer: ${a} (${b}).`,
        failedHeading: (a) => `Kunde inte strimlas: ${a}`,
        done: "Klart",
        error: (a) => `Strimlingen misslyckades: ${a}`
      },
      wipe: {
        body: "Detta skriver över det lediga utrymmet på enheten du väljer och raderar sedan fyllnadsfilen, så att filer du raderat tidigare inte kan återställas. Det frigör inget utrymme.",
        driveLabel: "Enhet att skriva över",
        driveOption: (a, b, c) => `${a} · ${b} ledigt av ${c}`,
        progressPass: (a, b, c, d) => `Pass ${a} av ${b}: skriver slumpmässiga data… ${c} av ${d}`,
        resultRandom: (a, b) => `Skrev ${a} slumpmässiga data över det lediga utrymmet i ${b} pass och raderade dem sedan. Inget utrymme frigjordes.`,
        resultRandomStopped: (a) => `Stoppade efter att ha skrivit ${a} slumpmässiga data över det lediga utrymmet. Fyllnadsfilen raderades.`
      }
    }
  },
  th: {
    deepCleanV3: {
      overwrite: {
        title: "เขียนทับไฟล์ก่อนลบ",
        description: "เมื่อ Prune ลบบางสิ่งอย่างถาวร (ลบทันที หรือลบถาวรหลังการถอนการติดตั้ง) โปรแกรมจะเขียนทับเนื้อหาของไฟล์ก่อน วิธีนี้ช้ากว่า และไม่น่าเชื่อถือบน SSD ระบบไฟล์แบบ copy-on-write หรือแบบ journaling หรือในโฟลเดอร์ที่ซิงค์หรือสำรองข้อมูลไว้ ไม่มีผลกับการกักกันหรือถังรีไซเคิล",
        passes: "จำนวนรอบการเขียนทับ",
        pass1: "1 รอบ (ศูนย์)",
        pass3: "3 รอบ (ข้อมูลสุ่ม)"
      },
      shred: {
        open: "ทำลายไฟล์…",
        title: "ทำลายไฟล์และโฟลเดอร์",
        intro: "เลือกไฟล์หรือโฟลเดอร์ที่จะเขียนทับแล้วลบ รายการที่ถูกทำลายจะกู้คืนไม่ได้ และจะไม่ผ่านการกักกันหรือถังรีไซเคิล",
        chooseFiles: "เลือกไฟล์…",
        chooseFolders: "เลือกโฟลเดอร์…",
        dropHint: "หรือลากไฟล์และโฟลเดอร์มาวางที่นี่",
        typeLabel: "พาธ บรรทัดละหนึ่งรายการ",
        add: "เพิ่มในรายการ",
        remove: (a) => `เอา ${a} ออกจากรายการ`,
        empty: "ยังไม่ได้เลือกอะไร",
        continue: "ดำเนินการต่อ",
        ssdNote: "การเขียนทับไม่น่าเชื่อถือบน SSD ระบบไฟล์แบบ copy-on-write หรือแบบ journaling หรือในโฟลเดอร์ที่ซิงค์หรือสำรองข้อมูลไว้",
        confirmTitle: "ทำลายรายการเหล่านี้อย่างถาวรหรือไม่",
        confirmBody: (a, b) => `ไฟล์ที่จะทำลาย: ${a} (${b}) ไม่สามารถกู้คืนเนื้อหาได้ และจะไม่มีอะไรถูกย้ายไปยังการกักกันหรือถังรีไซเคิล`,
        truncated: "มีไฟล์จำนวนมากจนการนับหยุดก่อนเวลา จำนวนจริงมากกว่านี้",
        refusedHeading: (a) => `ไม่แตะต้องเพราะได้รับการป้องกัน: ${a}`,
        confirmButton: "ทำลายอย่างถาวร",
        running: "กำลังทำลาย…",
        progress: (a, b) => `ไฟล์ที่ทำลายแล้ว: ${a} (${b})`,
        resultDone: (a, b) => `เสร็จสิ้น ไฟล์ที่ทำลายแล้ว: ${a} (${b})`,
        resultStopped: (a, b) => `หยุดแล้ว ไฟล์ที่ทำลายแล้ว: ${a} (${b})`,
        failedHeading: (a) => `ทำลายไม่ได้: ${a}`,
        done: "เสร็จสิ้น",
        error: (a) => `การทำลายล้มเหลว: ${a}`
      },
      wipe: {
        body: "การทำงานนี้จะเขียนทับพื้นที่ว่างบนไดรฟ์ที่คุณเลือก แล้วลบไฟล์ที่ใช้เติมพื้นที่ทิ้ง ทำให้กู้คืนไฟล์ที่ลบไปก่อนหน้านี้ไม่ได้ และไม่ได้เพิ่มพื้นที่ว่าง",
        driveLabel: "ไดรฟ์ที่จะเขียนทับ",
        driveOption: (a, b, c) => `${a} · ว่าง ${b} จาก ${c}`,
        progressPass: (a, b, c, d) => `รอบที่ ${a} จาก ${b}: กำลังเขียนข้อมูลสุ่ม… ${c} จาก ${d}`,
        resultRandom: (a, b) => `เขียนข้อมูลสุ่ม ${a} ทับพื้นที่ว่างใน ${b} รอบแล้วลบทิ้ง ไม่ได้เพิ่มพื้นที่ว่างแต่อย่างใด`,
        resultRandomStopped: (a) => `หยุดหลังจากเขียนข้อมูลสุ่ม ${a} ทับพื้นที่ว่าง ไฟล์ที่ใช้เติมพื้นที่ถูกลบแล้ว`
      }
    }
  },
  tr: {
    deepCleanV3: {
      overwrite: {
        title: "Silmeden önce dosyaların üzerine yaz",
        description: "Prune bir şeyi kalıcı olarak sildiğinde (Şimdi sil veya kaldırmadan sonra Kalıcı olarak sil) önce dosyanın içeriğinin üzerine yazar. Bu daha yavaştır ve SSD'lerde, yazarken kopyalama veya günlüklü dosya sistemlerinde ya da eşitlenen veya yedeklenen klasörlerde güvenilir değildir. Karantina veya Geri Dönüşüm Kutusu için geçerli değildir.",
        passes: "Üzerine yazma geçişleri",
        pass1: "1 geçiş (sıfırlar)",
        pass3: "3 geçiş (rastgele veri)"
      },
      shred: {
        open: "Dosyaları parçala…",
        title: "Dosyaları ve klasörleri parçala",
        intro: "Üzerine yazılıp silinecek dosya veya klasörleri seçin. Parçalanan öğeler geri alınamaz ve Karantina ile Geri Dönüşüm Kutusu'nu atlar.",
        chooseFiles: "Dosya seç…",
        chooseFolders: "Klasör seç…",
        dropHint: "Veya dosyaları ve klasörleri buraya bırakın",
        typeLabel: "Yollar, her satıra bir tane",
        add: "Listeye ekle",
        remove: (a) => `${a} öğesini listeden kaldır`,
        empty: "Henüz hiçbir şey seçilmedi.",
        continue: "Devam",
        ssdNote: "Üzerine yazma; SSD'lerde, yazarken kopyalama veya günlüklü dosya sistemlerinde ya da eşitlenen veya yedeklenen klasörlerde güvenilir değildir.",
        confirmTitle: "Bunlar kalıcı olarak parçalansın mı?",
        confirmBody: (a, b) => `Parçalanacak dosyalar: ${a} (${b}). İçerikleri geri alınamaz ve hiçbir şey Karantina veya Geri Dönüşüm Kutusu'na gitmez.`,
        truncated: "O kadar çok dosya var ki sayım erken durdu. Gerçek toplam daha büyük.",
        refusedHeading: (a) => `Korumalı oldukları için dokunulmadı: ${a}`,
        confirmButton: "Kalıcı olarak parçala",
        running: "Parçalanıyor…",
        progress: (a, b) => `Parçalanan dosyalar: ${a} (${b})`,
        resultDone: (a, b) => `Bitti. Parçalanan dosyalar: ${a} (${b}).`,
        resultStopped: (a, b) => `Durduruldu. Parçalanan dosyalar: ${a} (${b}).`,
        failedHeading: (a) => `Parçalanamadı: ${a}`,
        done: "Bitti",
        error: (a) => `Parçalama başarısız oldu: ${a}`
      },
      wipe: {
        body: "Bu, seçtiğiniz sürücüdeki boş alanın üzerine yazar, ardından dolgu dosyasını siler; böylece daha önce sildiğiniz dosyalar kurtarılamaz. Hiç alan boşaltmaz.",
        driveLabel: "Üzerine yazılacak sürücü",
        driveOption: (a, b, c) => `${a} · ${c} içinde ${b} boş`,
        progressPass: (a, b, c, d) => `Geçiş ${a} / ${b}: rastgele veri yazılıyor… ${c} / ${d}`,
        resultRandom: (a, b) => `Boş alanın üzerine ${b} geçişte ${a} rastgele veri yazıldı, ardından silindi. Hiç alan boşaltılmadı.`,
        resultRandomStopped: (a) => `Boş alanın üzerine ${a} rastgele veri yazıldıktan sonra durduruldu. Dolgu dosyası silindi.`
      }
    }
  },
  uk: {
    deepCleanV3: {
      overwrite: {
        title: "Перезаписувати файли перед видаленням",
        description: "Коли Prune видаляє щось остаточно (Видалити одразу або Видалити назавжди після видалення програми), він спершу перезаписує вміст файлу. Це повільніше й ненадійно на SSD, у файлових системах із копіюванням під час запису чи журналюванням, а також у синхронізованих або резервованих теках. До карантину й кошика це не стосується.",
        passes: "Проходи перезапису",
        pass1: "1 прохід (нулі)",
        pass3: "3 проходи (випадкові дані)"
      },
      shred: {
        open: "Знищити файли…",
        title: "Знищення файлів і тек",
        intro: "Виберіть файли або теки, які потрібно перезаписати й видалити. Знищені елементи відновити неможливо, вони оминають карантин і кошик.",
        chooseFiles: "Вибрати файли…",
        chooseFolders: "Вибрати теки…",
        dropHint: "Або перетягніть сюди файли й теки",
        typeLabel: "Шляхи, по одному в рядку",
        add: "Додати до списку",
        remove: (a) => `Прибрати ${a} зі списку`,
        empty: "Ще нічого не вибрано.",
        continue: "Продовжити",
        ssdNote: "Перезапис ненадійний на SSD, у файлових системах із копіюванням під час запису чи журналюванням, а також у синхронізованих або резервованих теках.",
        confirmTitle: "Знищити це назавжди?",
        confirmBody: (a, b) => `Файлів до знищення: ${a} (${b}). Їхній вміст відновити неможливо, і нічого не потрапить до карантину чи кошика.`,
        truncated: "Файлів так багато, що підрахунок зупинився раніше. Реальна кількість більша.",
        refusedHeading: (a) => `Не чіпаємо, бо вони захищені: ${a}`,
        confirmButton: "Знищити назавжди",
        running: "Знищення…",
        progress: (a, b) => `Знищено файлів: ${a} (${b})`,
        resultDone: (a, b) => `Готово. Знищено файлів: ${a} (${b}).`,
        resultStopped: (a, b) => `Зупинено. Знищено файлів: ${a} (${b}).`,
        failedHeading: (a) => `Не вдалося знищити: ${a}`,
        done: "Готово",
        error: (a) => `Не вдалося знищити: ${a}`
      },
      wipe: {
        body: "Вільне місце на вибраному диску перезаписується, після чого файл-заповнювач видаляється, щоб раніше видалені файли не можна було відновити. Місце при цьому не звільняється.",
        driveLabel: "Диск для затирання",
        driveOption: (a, b, c) => `${a} · вільно ${b} із ${c}`,
        progressPass: (a, b, c, d) => `Прохід ${a} із ${b}: запис випадкових даних… ${c} із ${d}`,
        resultRandom: (a, b) => `Вільне місце перезаписано випадковими даними (${a}) за ${b} проходи, після чого файл-заповнювач видалено. Місце не звільнено.`,
        resultRandomStopped: (a) => `Зупинено після запису випадкових даних (${a}) у вільне місце. Файл-заповнювач видалено.`
      }
    }
  },
  vi: {
    deepCleanV3: {
      overwrite: {
        title: "Ghi đè tệp trước khi xóa",
        description: "Khi Prune xóa thứ gì đó vĩnh viễn (Xóa ngay, hoặc Xóa vĩnh viễn sau khi gỡ cài đặt), trước tiên nó ghi đè nội dung của tệp. Cách này chậm hơn và không đáng tin cậy trên SSD, hệ thống tệp sao chép khi ghi hoặc có nhật ký, cũng như trong các thư mục được đồng bộ hoặc sao lưu. Không áp dụng cho Khu cách ly hoặc Thùng rác.",
        passes: "Số lượt ghi đè",
        pass1: "1 lượt (số 0)",
        pass3: "3 lượt (dữ liệu ngẫu nhiên)"
      },
      shred: {
        open: "Hủy tệp…",
        title: "Hủy tệp và thư mục",
        intro: "Chọn tệp hoặc thư mục để ghi đè rồi xóa. Các mục đã hủy không thể khôi phục và không đi qua Khu cách ly hay Thùng rác.",
        chooseFiles: "Chọn tệp…",
        chooseFolders: "Chọn thư mục…",
        dropHint: "Hoặc thả tệp và thư mục vào đây",
        typeLabel: "Đường dẫn, mỗi dòng một đường dẫn",
        add: "Thêm vào danh sách",
        remove: (a) => `Xóa ${a} khỏi danh sách`,
        empty: "Chưa chọn gì.",
        continue: "Tiếp tục",
        ssdNote: "Ghi đè không đáng tin cậy trên SSD, hệ thống tệp sao chép khi ghi hoặc có nhật ký, cũng như trong các thư mục được đồng bộ hoặc sao lưu.",
        confirmTitle: "Hủy vĩnh viễn những mục này?",
        confirmBody: (a, b) => `Số tệp sẽ bị hủy: ${a} (${b}). Không thể khôi phục nội dung của chúng, và không có gì được chuyển vào Khu cách ly hay Thùng rác.`,
        truncated: "Có quá nhiều tệp nên việc đếm dừng sớm. Tổng số thực tế lớn hơn.",
        refusedHeading: (a) => `Được giữ nguyên vì đã được bảo vệ: ${a}`,
        confirmButton: "Hủy vĩnh viễn",
        running: "Đang hủy…",
        progress: (a, b) => `Số tệp đã hủy: ${a} (${b})`,
        resultDone: (a, b) => `Xong. Số tệp đã hủy: ${a} (${b}).`,
        resultStopped: (a, b) => `Đã dừng. Số tệp đã hủy: ${a} (${b}).`,
        failedHeading: (a) => `Không thể hủy: ${a}`,
        done: "Xong",
        error: (a) => `Hủy thất bại: ${a}`
      },
      wipe: {
        body: "Thao tác này ghi đè dung lượng trống trên ổ đĩa bạn chọn, rồi xóa tệp đệm, để các tệp bạn đã xóa trước đó không thể khôi phục. Nó không giải phóng thêm dung lượng.",
        driveLabel: "Ổ đĩa cần ghi đè",
        driveOption: (a, b, c) => `${a} · còn trống ${b} trên ${c}`,
        progressPass: (a, b, c, d) => `Lượt ${a}/${b}: đang ghi dữ liệu ngẫu nhiên… ${c} / ${d}`,
        resultRandom: (a, b) => `Đã ghi ${a} dữ liệu ngẫu nhiên đè lên dung lượng trống qua ${b} lượt, rồi xóa tệp đệm. Không có dung lượng nào được giải phóng.`,
        resultRandomStopped: (a) => `Đã dừng sau khi ghi ${a} dữ liệu ngẫu nhiên đè lên dung lượng trống. Tệp đệm đã được xóa.`
      }
    }
  },
  "zh-CN": {
    deepCleanV3: {
      overwrite: {
        title: "删除前覆盖文件",
        description: "Prune 永久删除内容时（立即删除，或卸载后的永久删除），会先覆盖文件内容。这样更慢，而且在 SSD、写时复制或日志式文件系统，以及同步或备份的文件夹中并不可靠。不适用于隔离区或回收站。",
        passes: "覆盖次数",
        pass1: "1 次（填充零）",
        pass3: "3 次（随机数据）"
      },
      shred: {
        open: "粉碎文件…",
        title: "粉碎文件和文件夹",
        intro: "选择要覆盖并删除的文件或文件夹。被粉碎的项目无法恢复，也不会经过隔离区或回收站。",
        chooseFiles: "选择文件…",
        chooseFolders: "选择文件夹…",
        dropHint: "或将文件和文件夹拖放到此处",
        typeLabel: "路径，每行一个",
        add: "添加到列表",
        remove: (a) => `从列表中移除 ${a}`,
        empty: "尚未选择任何内容。",
        continue: "继续",
        ssdNote: "覆盖在 SSD、写时复制或日志式文件系统，以及同步或备份的文件夹中并不可靠。",
        confirmTitle: "要永久粉碎这些内容吗？",
        confirmBody: (a, b) => `要粉碎的文件：${a}（${b}）。其内容无法恢复，也不会移入隔离区或回收站。`,
        truncated: "文件数量太多，统计提前停止了。实际总数更大。",
        refusedHeading: (a) => `因受保护而未处理：${a}`,
        confirmButton: "永久粉碎",
        running: "正在粉碎…",
        progress: (a, b) => `已粉碎的文件：${a}（${b}）`,
        resultDone: (a, b) => `完成。已粉碎的文件：${a}（${b}）。`,
        resultStopped: (a, b) => `已停止。已粉碎的文件：${a}（${b}）。`,
        failedHeading: (a) => `无法粉碎：${a}`,
        done: "完成",
        error: (a) => `粉碎失败：${a}`
      },
      wipe: {
        body: "这会覆盖你所选驱动器上的可用空间，然后删除填充文件，使你之前删除的文件无法恢复。它不会释放任何空间。",
        driveLabel: "要擦除的驱动器",
        driveOption: (a, b, c) => `${a} · 可用 ${b}，共 ${c}`,
        progressPass: (a, b, c, d) => `第 ${a} 次，共 ${b} 次：正在写入随机数据… ${c} / ${d}`,
        resultRandom: (a, b) => `已用随机数据覆盖可用空间（共写入 ${a}，分 ${b} 次），随后删除了填充文件。未释放任何空间。`,
        resultRandomStopped: (a) => `已在向可用空间写入 ${a} 的随机数据后停止，填充文件已删除。`
      }
    }
  },
  "zh-TW": {
    deepCleanV3: {
      overwrite: {
        title: "刪除前覆寫檔案",
        description: "Prune 永久刪除內容時（立即刪除，或解除安裝後的永久刪除），會先覆寫檔案內容。這樣較慢，而且在 SSD、寫入時複製或日誌式檔案系統，以及同步或備份的資料夾中並不可靠。不適用於隔離區或資源回收筒。",
        passes: "覆寫次數",
        pass1: "1 次（填入零）",
        pass3: "3 次（隨機資料）"
      },
      shred: {
        open: "粉碎檔案…",
        title: "粉碎檔案和資料夾",
        intro: "選擇要覆寫並刪除的檔案或資料夾。被粉碎的項目無法復原，也不會經過隔離區或資源回收筒。",
        chooseFiles: "選擇檔案…",
        chooseFolders: "選擇資料夾…",
        dropHint: "或將檔案和資料夾拖放到此處",
        typeLabel: "路徑，每行一個",
        add: "加入清單",
        remove: (a) => `從清單中移除 ${a}`,
        empty: "尚未選擇任何項目。",
        continue: "繼續",
        ssdNote: "覆寫在 SSD、寫入時複製或日誌式檔案系統，以及同步或備份的資料夾中並不可靠。",
        confirmTitle: "要永久粉碎這些項目嗎？",
        confirmBody: (a, b) => `要粉碎的檔案：${a}（${b}）。其內容無法復原，也不會移入隔離區或資源回收筒。`,
        truncated: "檔案數量太多，統計提前停止了。實際總數更大。",
        refusedHeading: (a) => `因受保護而未處理：${a}`,
        confirmButton: "永久粉碎",
        running: "正在粉碎…",
        progress: (a, b) => `已粉碎的檔案：${a}（${b}）`,
        resultDone: (a, b) => `完成。已粉碎的檔案：${a}（${b}）。`,
        resultStopped: (a, b) => `已停止。已粉碎的檔案：${a}（${b}）。`,
        failedHeading: (a) => `無法粉碎：${a}`,
        done: "完成",
        error: (a) => `粉碎失敗：${a}`
      },
      wipe: {
        body: "這會覆寫你所選磁碟機上的可用空間，然後刪除填充檔案，讓你先前刪除的檔案無法還原。它不會釋放任何空間。",
        driveLabel: "要清除的磁碟機",
        driveOption: (a, b, c) => `${a} · 可用 ${b}，共 ${c}`,
        progressPass: (a, b, c, d) => `第 ${a} 次，共 ${b} 次：正在寫入隨機資料… ${c} / ${d}`,
        resultRandom: (a, b) => `已用隨機資料覆寫可用空間（共寫入 ${a}，分 ${b} 次），隨後刪除了填充檔案。未釋放任何空間。`,
        resultRandomStopped: (a) => `已在向可用空間寫入 ${a} 的隨機資料後停止，填充檔案已刪除。`
      }
    }
  }
};
