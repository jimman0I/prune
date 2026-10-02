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
      },
      locked: {
        scheduled: (a) => `Locked files to be deleted at the next restart: ${a}.`,
        needsAdmin: "Some locked files could not be scheduled for deletion at restart, because that needs administrator rights."
      },
      files: {
        show: (a) => `Show files in ${a}`,
        hide: (a) => `Hide files in ${a}`,
        heading: (a, b) => `Largest files first: showing ${a} of ${b}`,
        biggest: (a) => `Largest: ${a}`
      },
      custom: {
        category: "Custom",
        ruleName: "Custom locations",
        ruleDescription: "Files and folders you added yourself in Settings.",
        description: "Add files, folders or patterns, such as D:\\Games\\Cache\\*.tmp, to Deep Clean. They appear as a rule of their own, never ticked by default, and still respect your exclusions, the recent-files guard and the protected places.",
        ariaLabel: "Location to add",
        remove: (a) => `Stop cleaning ${a}`,
        empty: "No custom locations yet.",
        error: {
          empty: "Type a path first.",
          relative: "Write a full path, such as D:\\Games\\Cache, or start with a variable like %LOCALAPPDATA%.",
          climb: "A path with .. in it is not allowed.",
          protected: "That is a protected place (Windows, Program Files, a whole drive or a user profile).",
          wildcard: "Put the * lower down, inside a folder (D:\\Games\\Cache\\*), not at the top of a drive.",
          long: "That path is too long.",
          failed: (a) => `Couldn't save: ${a}`
        }
      },
      imported: {
        title: "Imported cleaners",
        description: "Import a BleachBit cleaner file (.xml). Prune brings over its delete options and tells you exactly what it skipped. Imported rules are never ticked by default and stay out of protected places.",
        button: "Import cleaner…",
        empty: "No imported cleaners.",
        meta: (a) => `Options imported: ${a}`,
        remove: (a) => `Remove ${a}`,
        badge: "Imported",
        reportDone: (a, b, c, d, e) => `Imported ${a}. Options: ${b} imported, ${c} skipped. Actions: ${d} imported, ${e} skipped.`,
        reportNothing: (a, b, c) => `Nothing was imported from ${a}. Options skipped: ${b}. Actions skipped: ${c}.`,
        skip: {
          command: (a, b) => `Unsupported command ${a}: ${b}`,
          search: (a, b) => `Unsupported search type ${a}: ${b}`,
          filter: (a, b) => `Actions with a regular-expression filter: ${b}`,
          os: (a, b) => `Meant for another system (${a}): ${b}`,
          variable: (a, b) => `Unknown variable ${a}: ${b}`,
          path: (a, b) => `Unusable or unsafe paths: ${b}`
        },
        error: {
          tooLarge: "That file is too large to be a cleaner.",
          notXml: "That is not valid XML.",
          notCleaner: "That is not a BleachBit cleaner file.",
          noId: "That cleaner has no id.",
          failed: (a) => `Couldn't import: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `Gesluite lêers wat by die volgende herbegin verwyder sal word: ${a}.`,
        needsAdmin: "Sommige gesluite lêers kon nie vir verwydering by herbegin geskeduleer word nie, omdat dit administrateurregte vereis."
      },
      files: {
        show: (a) => `Wys lêers in ${a}`,
        hide: (a) => `Versteek lêers in ${a}`,
        heading: (a, b) => `Grootste lêers eerste: toon ${a} van ${b}`,
        biggest: (a) => `Grootste: ${a}`
      },
      custom: {
        category: "Eie",
        ruleName: "Eie liggings",
        ruleDescription: "Lêers en vouers wat jy self in Instellings bygevoeg het.",
        description: "Voeg lêers, vouers of patrone, soos D:\\Games\\Cache\\*.tmp, by Diep Skoonmaak. Dit verskyn as 'n reël van sy eie, word nooit by verstek gemerk nie en respekteer steeds jou uitsluitings, die onlangse-lêers-beskerming en die beskermde plekke.",
        ariaLabel: "Ligging om by te voeg",
        remove: (a) => `Hou op om ${a} skoon te maak`,
        empty: "Nog geen eie liggings nie.",
        error: {
          empty: "Tik eers ’n pad in.",
          relative: "Skryf ’n volledige pad, soos D:\\Games\\Cache, of begin met ’n veranderlike soos %LOCALAPPDATA%.",
          climb: "’n Pad met .. daarin word nie toegelaat nie.",
          protected: "Dit is ’n beskermde plek (Windows, Program Files, ’n hele aandrywer of ’n gebruikersprofiel).",
          wildcard: "Plaas die * laer af, binne ’n vouer (D:\\Games\\Cache\\*), nie boaan ’n aandrywer nie.",
          long: "Daardie pad is te lank.",
          failed: (a) => `Kon nie stoor nie: ${a}`
        }
      },
      imported: {
        title: "Ingevoerde skoonmakers",
        description: "Voer ’n BleachBit-skoonmaakléer (.xml) in. Prune bring sy uitvee-opsies oor en vertel jou presies wat dit oorgeslaan het. Ingevoerde reëls word nooit by verstek gemerk nie en bly weg van beskermde plekke.",
        button: "Voer skoonmaker in…",
        empty: "Geen ingevoerde skoonmakers nie.",
        meta: (a) => `Opsies ingevoer: ${a}`,
        remove: (a) => `Verwyder ${a}`,
        badge: "Ingevoer",
        reportDone: (a, b, c, d, e) => `${a} ingevoer. Opsies: ${b} ingevoer, ${c} oorgeslaan. Aksies: ${d} ingevoer, ${e} oorgeslaan.`,
        reportNothing: (a, b, c) => `Niks is uit ${a} ingevoer nie. Opsies oorgeslaan: ${b}. Aksies oorgeslaan: ${c}.`,
        skip: {
          command: (a, b) => `Nie-ondersteunde opdrag ${a}: ${b}`,
          search: (a, b) => `Nie-ondersteunde soektipe ${a}: ${b}`,
          filter: (a, b) => `Aksies met ’n gewone-uitdrukking-filter: ${b}`,
          os: (a, b) => `Bedoel vir ’n ander stelsel (${a}): ${b}`,
          variable: (a, b) => `Onbekende veranderlike ${a}: ${b}`,
          path: (a, b) => `Onbruikbare of onveilige paaie: ${b}`
        },
        error: {
          tooLarge: "Daardie lêer is te groot om ’n skoonmaker te wees.",
          notXml: "Dit is nie geldige XML nie.",
          notCleaner: "Dit is nie ’n BleachBit-skoonmaakléer nie.",
          noId: "Daardie skoonmaker het geen id nie.",
          failed: (a) => `Kon nie invoer nie: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `الملفات المقفلة التي ستُحذف عند إعادة التشغيل التالية: ${a}.`,
        needsAdmin: "تعذّرت جدولة بعض الملفات المقفلة للحذف عند إعادة التشغيل لأن ذلك يتطلب صلاحيات المسؤول."
      },
      files: {
        show: (a) => `عرض الملفات في ${a}`,
        hide: (a) => `إخفاء الملفات في ${a}`,
        heading: (a, b) => `الأكبر حجمًا أولًا: عرض ${a} من ${b}`,
        biggest: (a) => `الأكبر: ${a}`
      },
      custom: {
        category: "مخصص",
        ruleName: "مواقع مخصصة",
        ruleDescription: "الملفات والمجلدات التي أضفتها بنفسك في الإعدادات.",
        description: "أضف ملفات أو مجلدات أو أنماطًا، مثل D:\\Games\\Cache\\*.tmp، إلى التنظيف العميق. تظهر كقاعدة مستقلة، ولا يتم تحديدها افتراضيًا أبدًا، وتحترم استثناءاتك وحماية الملفات الحديثة والأماكن المحمية.",
        ariaLabel: "الموقع المراد إضافته",
        remove: (a) => `إيقاف تنظيف ${a}`,
        empty: "لا توجد مواقع مخصصة بعد.",
        error: {
          empty: "اكتب مسارًا أولًا.",
          relative: "اكتب مسارًا كاملًا، مثل D:\\Games\\Cache، أو ابدأ بمتغير مثل %LOCALAPPDATA%.",
          climb: "غير مسموح بمسار يحتوي على ..",
          protected: "هذا مكان محمي (Windows أو Program Files أو قرص كامل أو ملف تعريف مستخدم).",
          wildcard: "ضع * في مستوى أدنى داخل مجلد (D:\\Games\\Cache\\*)، وليس في أعلى القرص.",
          long: "هذا المسار طويل جدًا.",
          failed: (a) => `تعذّر الحفظ: ${a}`
        }
      },
      imported: {
        title: "أدوات التنظيف المستوردة",
        description: "استورد ملف منظِّف BleachBit (‎.xml). يجلب Prune خيارات الحذف فيه ويخبرك بالضبط بما تخطّاه. القواعد المستوردة لا تُحدَّد افتراضيًا أبدًا وتبقى بعيدة عن الأماكن المحمية.",
        button: "استيراد منظِّف…",
        empty: "لا توجد أدوات تنظيف مستوردة.",
        meta: (a) => `الخيارات المستوردة: ${a}`,
        remove: (a) => `إزالة ${a}`,
        badge: "مستورد",
        reportDone: (a, b, c, d, e) => `تم استيراد ${a}. الخيارات: ${b} مستوردة، ${c} متخطاة. الإجراءات: ${d} مستوردة، ${e} متخطاة.`,
        reportNothing: (a, b, c) => `لم يتم استيراد أي شيء من ${a}. الخيارات المتخطاة: ${b}. الإجراءات المتخطاة: ${c}.`,
        skip: {
          command: (a, b) => `أمر غير مدعوم ${a}: ${b}`,
          search: (a, b) => `نوع بحث غير مدعوم ${a}: ${b}`,
          filter: (a, b) => `إجراءات بها مرشح تعبير نمطي: ${b}`,
          os: (a, b) => `مخصص لنظام آخر (${a}): ${b}`,
          variable: (a, b) => `متغير غير معروف ${a}: ${b}`,
          path: (a, b) => `مسارات غير صالحة أو غير آمنة: ${b}`
        },
        error: {
          tooLarge: "هذا الملف أكبر من أن يكون منظِّفًا.",
          notXml: "هذا ليس XML صالحًا.",
          notCleaner: "هذا ليس ملف منظِّف BleachBit.",
          noId: "هذا المنظِّف ليس له معرّف.",
          failed: (a) => `تعذّر الاستيراد: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `Fitxers bloquejats que se suprimiran en el següent reinici: ${a}.`,
        needsAdmin: "Alguns fitxers bloquejats no s'han pogut programar per suprimir-se en el reinici, perquè cal tenir permisos d'administrador."
      },
      files: {
        show: (a) => `Mostra els fitxers de ${a}`,
        hide: (a) => `Amaga els fitxers de ${a}`,
        heading: (a, b) => `Primer els fitxers més grans: se'n mostren ${a} de ${b}`,
        biggest: (a) => `Més grans: ${a}`
      },
      custom: {
        category: "Personalitzat",
        ruleName: "Ubicacions personalitzades",
        ruleDescription: "Fitxers i carpetes que has afegit tu mateix a Configuració.",
        description: "Afegeix fitxers, carpetes o patrons, com ara D:\\Games\\Cache\\*.tmp, a la Neteja profunda. Apareixen com una regla pròpia, mai marcada per defecte, i continuen respectant les teves exclusions, la protecció de fitxers recents i els llocs protegits.",
        ariaLabel: "Ubicació que s’ha d’afegir",
        remove: (a) => `Deixa de netejar ${a}`,
        empty: "Encara no hi ha ubicacions personalitzades.",
        error: {
          empty: "Escriu primer un camí.",
          relative: "Escriu un camí complet, com ara D:\\Games\\Cache, o comença amb una variable com %LOCALAPPDATA%.",
          climb: "No es permet un camí que contingui ..",
          protected: "Aquest és un lloc protegit (Windows, Program Files, una unitat sencera o un perfil d’usuari).",
          wildcard: "Posa el * més avall, dins d’una carpeta (D:\\Games\\Cache\\*), no a dalt de tot d’una unitat.",
          long: "Aquest camí és massa llarg.",
          failed: (a) => `No s’ha pogut desar: ${a}`
        }
      },
      imported: {
        title: "Netejadors importats",
        description: "Importa un fitxer de netejador de BleachBit (.xml). Prune n’aprofita les opcions d’eliminació i et diu exactament què ha omès. Les regles importades mai no estan marcades per defecte i no toquen els llocs protegits.",
        button: "Importa un netejador…",
        empty: "Cap netejador importat.",
        meta: (a) => `Opcions importades: ${a}`,
        remove: (a) => `Elimina ${a}`,
        badge: "Importat",
        reportDone: (a, b, c, d, e) => `S’ha importat ${a}. Opcions: ${b} importades, ${c} omeses. Accions: ${d} importades, ${e} omeses.`,
        reportNothing: (a, b, c) => `No s’ha importat res de ${a}. Opcions omeses: ${b}. Accions omeses: ${c}.`,
        skip: {
          command: (a, b) => `Ordre no admesa ${a}: ${b}`,
          search: (a, b) => `Tipus de cerca no admès ${a}: ${b}`,
          filter: (a, b) => `Accions amb un filtre d’expressió regular: ${b}`,
          os: (a, b) => `Pensat per a un altre sistema (${a}): ${b}`,
          variable: (a, b) => `Variable desconeguda ${a}: ${b}`,
          path: (a, b) => `Camins inutilitzables o insegurs: ${b}`
        },
        error: {
          tooLarge: "Aquest fitxer és massa gran per ser un netejador.",
          notXml: "Això no és XML vàlid.",
          notCleaner: "Aquest no és un fitxer de netejador de BleachBit.",
          noId: "Aquest netejador no té cap identificador.",
          failed: (a) => `No s’ha pogut importar: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `Uzamčené soubory, které se odstraní při příštím restartu: ${a}.`,
        needsAdmin: "Některé uzamčené soubory se nepodařilo naplánovat k odstranění při restartu, protože to vyžaduje práva správce."
      },
      files: {
        show: (a) => `Zobrazit soubory v ${a}`,
        hide: (a) => `Skrýt soubory v ${a}`,
        heading: (a, b) => `Od největších souborů: zobrazeno ${a} z ${b}`,
        biggest: (a) => `Největší: ${a}`
      },
      custom: {
        category: "Vlastní",
        ruleName: "Vlastní umístění",
        ruleDescription: "Soubory a složky, které jste sami přidali v Nastavení.",
        description: "Přidejte do Důkladného čištění soubory, složky nebo vzory, například D:\\Games\\Cache\\*.tmp. Zobrazí se jako samostatné pravidlo, které není ve výchozím stavu zaškrtnuté a stále respektuje vaše výjimky, ochranu nedávných souborů a chráněná místa.",
        ariaLabel: "Umístění k přidání",
        remove: (a) => `Přestat čistit ${a}`,
        empty: "Zatím žádná vlastní umístění.",
        error: {
          empty: "Nejprve zadejte cestu.",
          relative: "Zadejte úplnou cestu, například D:\\Games\\Cache, nebo začněte proměnnou jako %LOCALAPPDATA%.",
          climb: "Cesta obsahující .. není povolena.",
          protected: "Toto je chráněné místo (Windows, Program Files, celý disk nebo uživatelský profil).",
          wildcard: "Dejte * níže, do složky (D:\\Games\\Cache\\*), ne na začátek disku.",
          long: "Tato cesta je příliš dlouhá.",
          failed: (a) => `Nelze uložit: ${a}`
        }
      },
      imported: {
        title: "Importované čističe",
        description: "Importujte soubor čističe BleachBit (.xml). Prune převezme jeho možnosti mazání a přesně vám řekne, co přeskočil. Importovaná pravidla nejsou ve výchozím stavu zaškrtnutá a nesahají na chráněná místa.",
        button: "Importovat čistič…",
        empty: "Žádné importované čističe.",
        meta: (a) => `Importované možnosti: ${a}`,
        remove: (a) => `Odebrat ${a}`,
        badge: "Importováno",
        reportDone: (a, b, c, d, e) => `Importováno: ${a}. Možnosti: ${b} importováno, ${c} přeskočeno. Akce: ${d} importováno, ${e} přeskočeno.`,
        reportNothing: (a, b, c) => `Z ${a} nebylo nic importováno. Přeskočené možnosti: ${b}. Přeskočené akce: ${c}.`,
        skip: {
          command: (a, b) => `Nepodporovaný příkaz ${a}: ${b}`,
          search: (a, b) => `Nepodporovaný typ hledání ${a}: ${b}`,
          filter: (a, b) => `Akce s filtrem regulárním výrazem: ${b}`,
          os: (a, b) => `Určeno pro jiný systém (${a}): ${b}`,
          variable: (a, b) => `Neznámá proměnná ${a}: ${b}`,
          path: (a, b) => `Nepoužitelné nebo nebezpečné cesty: ${b}`
        },
        error: {
          tooLarge: "Tento soubor je příliš velký na to, aby to byl čistič.",
          notXml: "Toto není platný XML.",
          notCleaner: "Toto není soubor čističe BleachBit.",
          noId: "Tento čistič nemá žádné id.",
          failed: (a) => `Nelze importovat: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `Ffeiliau wedi'u cloi i'w dileu adeg yr ailgychwyn nesaf: ${a}.`,
        needsAdmin: "Ni ellid trefnu rhai ffeiliau wedi'u cloi i'w dileu adeg ailgychwyn, oherwydd bod angen hawliau gweinyddwr."
      },
      files: {
        show: (a) => `Dangos ffeiliau yn ${a}`,
        hide: (a) => `Cuddio ffeiliau yn ${a}`,
        heading: (a, b) => `Y ffeiliau mwyaf yn gyntaf: dangos ${a} o ${b}`,
        biggest: (a) => `Mwyaf: ${a}`
      },
      custom: {
        category: "Personol",
        ruleName: "Lleoliadau personol",
        ruleDescription: "Ffeiliau a ffolderi a ychwanegwyd gennych chi eich hun yn y Gosodiadau.",
        description: "Ychwanegwch ffeiliau, ffolderi neu batrymau, fel D:\\Games\\Cache\\*.tmp, at Lanhau Dwfn. Maent yn ymddangos fel rheol ar wahân, byth wedi'u ticio yn ddiofyn, ac yn dal i barchu eich eithriadau, y gwarchodwr ffeiliau diweddar a'r lleoedd gwarchodedig.",
        ariaLabel: "Lleoliad i’w ychwanegu",
        remove: (a) => `Rhoi’r gorau i lanhau ${a}`,
        empty: "Dim lleoliadau personol eto.",
        error: {
          empty: "Teipiwch lwybr yn gyntaf.",
          relative: "Ysgrifennwch lwybr llawn, fel D:\\Games\\Cache, neu dechreuwch gyda newidyn fel %LOCALAPPDATA%.",
          climb: "Ni chaniateir llwybr sy’n cynnwys ..",
          protected: "Mae hwn yn lle gwarchodedig (Windows, Program Files, gyriant cyfan neu broffil defnyddiwr).",
          wildcard: "Rhowch y * yn is i lawr, y tu mewn i ffolder (D:\\Games\\Cache\\*), nid ar frig gyriant.",
          long: "Mae’r llwybr hwnnw’n rhy hir.",
          failed: (a) => `Methwyd cadw: ${a}`
        }
      },
      imported: {
        title: "Glanhawyr wedi’u mewnforio",
        description: "Mewnforiwch ffeil glanhawr BleachBit (.xml). Mae Prune yn dod â’i opsiynau dileu drosodd ac yn dweud wrthych yn union beth a hepgorodd. Ni thicir rheolau wedi’u mewnforio yn ddiofyn a maent yn aros allan o leoedd gwarchodedig.",
        button: "Mewnforio glanhawr…",
        empty: "Dim glanhawyr wedi’u mewnforio.",
        meta: (a) => `Opsiynau wedi’u mewnforio: ${a}`,
        remove: (a) => `Tynnu ${a}`,
        badge: "Mewnforiwyd",
        reportDone: (a, b, c, d, e) => `Mewnforiwyd ${a}. Opsiynau: ${b} wedi’u mewnforio, ${c} wedi’u hepgor. Gweithredoedd: ${d} wedi’u mewnforio, ${e} wedi’u hepgor.`,
        reportNothing: (a, b, c) => `Ni fewnforiwyd dim o ${a}. Opsiynau a hepgorwyd: ${b}. Gweithredoedd a hepgorwyd: ${c}.`,
        skip: {
          command: (a, b) => `Gorchymyn heb ei gefnogi ${a}: ${b}`,
          search: (a, b) => `Math o chwiliad heb ei gefnogi ${a}: ${b}`,
          filter: (a, b) => `Gweithredoedd gyda hidlydd mynegiant rheolaidd: ${b}`,
          os: (a, b) => `Wedi’i fwriadu ar gyfer system arall (${a}): ${b}`,
          variable: (a, b) => `Newidyn anhysbys ${a}: ${b}`,
          path: (a, b) => `Llwybrau anaddas neu anniogel: ${b}`
        },
        error: {
          tooLarge: "Mae’r ffeil honno’n rhy fawr i fod yn lanhawr.",
          notXml: "Nid yw hwnnw’n XML dilys.",
          notCleaner: "Nid ffeil glanhawr BleachBit yw honno.",
          noId: "Nid oes gan y glanhawr hwnnw id.",
          failed: (a) => `Methwyd mewnforio: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `Låste filer, der slettes ved næste genstart: ${a}.`,
        needsAdmin: "Nogle låste filer kunne ikke planlægges slettet ved genstart, fordi det kræver administratorrettigheder."
      },
      files: {
        show: (a) => `Vis filer i ${a}`,
        hide: (a) => `Skjul filer i ${a}`,
        heading: (a, b) => `Største filer først: viser ${a} af ${b}`,
        biggest: (a) => `Største: ${a}`
      },
      custom: {
        category: "Brugerdefineret",
        ruleName: "Brugerdefinerede placeringer",
        ruleDescription: "Filer og mapper, du selv har tilføjet i Indstillinger.",
        description: "Føj filer, mapper eller mønstre, f.eks. D:\\Games\\Cache\\*.tmp, til Dybderensning. De vises som en regel for sig, er aldrig afkrydset som standard og respekterer stadig dine undtagelser, beskyttelsen af nylige filer og de beskyttede steder.",
        ariaLabel: "Placering, der skal tilføjes",
        remove: (a) => `Stop med at rense ${a}`,
        empty: "Ingen brugerdefinerede placeringer endnu.",
        error: {
          empty: "Skriv først en sti.",
          relative: "Skriv en fuld sti, f.eks. D:\\Games\\Cache, eller begynd med en variabel som %LOCALAPPDATA%.",
          climb: "En sti med .. er ikke tilladt.",
          protected: "Dette er et beskyttet sted (Windows, Program Files, et helt drev eller en brugerprofil).",
          wildcard: "Sæt * længere nede, inde i en mappe (D:\\Games\\Cache\\*), ikke øverst på et drev.",
          long: "Den sti er for lang.",
          failed: (a) => `Kunne ikke gemme: ${a}`
        }
      },
      imported: {
        title: "Importerede renseværktøjer",
        description: "Importér en BleachBit-renseværktøjsfil (.xml). Prune henter dens sletteindstillinger og fortæller dig præcis, hvad den sprang over. Importerede regler er aldrig afkrydset som standard og holder sig fra beskyttede steder.",
        button: "Importér renseværktøj…",
        empty: "Ingen importerede renseværktøjer.",
        meta: (a) => `Importerede indstillinger: ${a}`,
        remove: (a) => `Fjern ${a}`,
        badge: "Importeret",
        reportDone: (a, b, c, d, e) => `${a} importeret. Indstillinger: ${b} importeret, ${c} sprunget over. Handlinger: ${d} importeret, ${e} sprunget over.`,
        reportNothing: (a, b, c) => `Intet blev importeret fra ${a}. Indstillinger sprunget over: ${b}. Handlinger sprunget over: ${c}.`,
        skip: {
          command: (a, b) => `Ikke-understøttet kommando ${a}: ${b}`,
          search: (a, b) => `Ikke-understøttet søgetype ${a}: ${b}`,
          filter: (a, b) => `Handlinger med et regulært udtryk som filter: ${b}`,
          os: (a, b) => `Beregnet til et andet system (${a}): ${b}`,
          variable: (a, b) => `Ukendt variabel ${a}: ${b}`,
          path: (a, b) => `Ubrugelige eller usikre stier: ${b}`
        },
        error: {
          tooLarge: "Den fil er for stor til at være et renseværktøj.",
          notXml: "Det er ikke gyldig XML.",
          notCleaner: "Det er ikke en BleachBit-renseværktøjsfil.",
          noId: "Det renseværktøj har intet id.",
          failed: (a) => `Kunne ikke importere: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `Gesperrte Dateien, die beim nächsten Neustart gelöscht werden: ${a}.`,
        needsAdmin: "Einige gesperrte Dateien ließen sich nicht für das Löschen beim Neustart vormerken, da dafür Administratorrechte nötig sind."
      },
      files: {
        show: (a) => `Dateien in ${a} anzeigen`,
        hide: (a) => `Dateien in ${a} ausblenden`,
        heading: (a, b) => `Größte Dateien zuerst: ${a} von ${b} angezeigt`,
        biggest: (a) => `Größte: ${a}`
      },
      custom: {
        category: "Benutzerdefiniert",
        ruleName: "Eigene Speicherorte",
        ruleDescription: "Dateien und Ordner, die du selbst in den Einstellungen hinzugefügt hast.",
        description: "Füge der Gründlichen Bereinigung Dateien, Ordner oder Muster wie D:\\Games\\Cache\\*.tmp hinzu. Sie erscheinen als eigene Regel, sind nie standardmäßig angehakt und beachten weiterhin deine Ausnahmen, den Schutz kürzlich geänderter Dateien und die geschützten Orte.",
        ariaLabel: "Hinzuzufügender Speicherort",
        remove: (a) => `${a} nicht mehr bereinigen`,
        empty: "Noch keine eigenen Speicherorte.",
        error: {
          empty: "Gib zuerst einen Pfad ein.",
          relative: "Schreibe einen vollständigen Pfad wie D:\\Games\\Cache oder beginne mit einer Variablen wie %LOCALAPPDATA%.",
          climb: "Ein Pfad mit .. ist nicht erlaubt.",
          protected: "Das ist ein geschützter Ort (Windows, Programme, ein ganzes Laufwerk oder ein Benutzerprofil).",
          wildcard: "Setze das * tiefer, in einen Ordner (D:\\Games\\Cache\\*), nicht an die Spitze eines Laufwerks.",
          long: "Dieser Pfad ist zu lang.",
          failed: (a) => `Speichern nicht möglich: ${a}`
        }
      },
      imported: {
        title: "Importierte Cleaner",
        description: "Importiere eine BleachBit-Cleaner-Datei (.xml). Prune übernimmt ihre Löschoptionen und sagt dir genau, was übersprungen wurde. Importierte Regeln sind nie standardmäßig angehakt und bleiben von geschützten Orten fern.",
        button: "Cleaner importieren…",
        empty: "Keine importierten Cleaner.",
        meta: (a) => `Importierte Optionen: ${a}`,
        remove: (a) => `${a} entfernen`,
        badge: "Importiert",
        reportDone: (a, b, c, d, e) => `${a} importiert. Optionen: ${b} importiert, ${c} übersprungen. Aktionen: ${d} importiert, ${e} übersprungen.`,
        reportNothing: (a, b, c) => `Aus ${a} wurde nichts importiert. Übersprungene Optionen: ${b}. Übersprungene Aktionen: ${c}.`,
        skip: {
          command: (a, b) => `Nicht unterstützter Befehl ${a}: ${b}`,
          search: (a, b) => `Nicht unterstützte Suchart ${a}: ${b}`,
          filter: (a, b) => `Aktionen mit einem Filter aus regulärem Ausdruck: ${b}`,
          os: (a, b) => `Für ein anderes System gedacht (${a}): ${b}`,
          variable: (a, b) => `Unbekannte Variable ${a}: ${b}`,
          path: (a, b) => `Unbrauchbare oder unsichere Pfade: ${b}`
        },
        error: {
          tooLarge: "Diese Datei ist zu groß für einen Cleaner.",
          notXml: "Das ist kein gültiges XML.",
          notCleaner: "Das ist keine BleachBit-Cleaner-Datei.",
          noId: "Dieser Cleaner hat keine ID.",
          failed: (a) => `Import nicht möglich: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `Κλειδωμένα αρχεία που θα διαγραφούν στην επόμενη επανεκκίνηση: ${a}.`,
        needsAdmin: "Ορισμένα κλειδωμένα αρχεία δεν μπόρεσαν να προγραμματιστούν για διαγραφή στην επανεκκίνηση, επειδή απαιτούνται δικαιώματα διαχειριστή."
      },
      files: {
        show: (a) => `Εμφάνιση αρχείων στο ${a}`,
        hide: (a) => `Απόκρυψη αρχείων στο ${a}`,
        heading: (a, b) => `Πρώτα τα μεγαλύτερα αρχεία: εμφάνιση ${a} από ${b}`,
        biggest: (a) => `Μεγαλύτερα: ${a}`
      },
      custom: {
        category: "Προσαρμοσμένα",
        ruleName: "Προσαρμοσμένες τοποθεσίες",
        ruleDescription: "Αρχεία και φάκελοι που προσθέσατε εσείς στις Ρυθμίσεις.",
        description: "Προσθέστε αρχεία, φακέλους ή μοτίβα, όπως D:\\Games\\Cache\\*.tmp, στον Βαθύ καθαρισμό. Εμφανίζονται ως ξεχωριστός κανόνας, δεν είναι ποτέ επιλεγμένα από προεπιλογή και εξακολουθούν να σέβονται τις εξαιρέσεις σας, την προστασία πρόσφατων αρχείων και τις προστατευμένες θέσεις.",
        ariaLabel: "Τοποθεσία προς προσθήκη",
        remove: (a) => `Διακοπή καθαρισμού του ${a}`,
        empty: "Δεν υπάρχουν ακόμη προσαρμοσμένες τοποθεσίες.",
        error: {
          empty: "Πληκτρολογήστε πρώτα μια διαδρομή.",
          relative: "Γράψτε μια πλήρη διαδρομή, όπως D:\\Games\\Cache, ή ξεκινήστε με μια μεταβλητή όπως %LOCALAPPDATA%.",
          climb: "Δεν επιτρέπεται διαδρομή που περιέχει ..",
          protected: "Αυτή είναι προστατευμένη θέση (Windows, Program Files, ολόκληρη μονάδα ή προφίλ χρήστη).",
          wildcard: "Βάλτε το * πιο χαμηλά, μέσα σε έναν φάκελο (D:\\Games\\Cache\\*), όχι στην κορυφή μιας μονάδας.",
          long: "Αυτή η διαδρομή είναι πολύ μεγάλη.",
          failed: (a) => `Δεν ήταν δυνατή η αποθήκευση: ${a}`
        }
      },
      imported: {
        title: "Εισαγόμενοι καθαριστές",
        description: "Εισαγάγετε ένα αρχείο καθαριστή BleachBit (.xml). Το Prune μεταφέρει τις επιλογές διαγραφής του και σας λέει ακριβώς τι παρέλειψε. Οι εισαγόμενοι κανόνες δεν είναι ποτέ επιλεγμένοι από προεπιλογή και μένουν μακριά από προστατευμένες θέσεις.",
        button: "Εισαγωγή καθαριστή…",
        empty: "Δεν υπάρχουν εισαγόμενοι καθαριστές.",
        meta: (a) => `Εισαγόμενες επιλογές: ${a}`,
        remove: (a) => `Αφαίρεση του ${a}`,
        badge: "Εισαγόμενο",
        reportDone: (a, b, c, d, e) => `Έγινε εισαγωγή του ${a}. Επιλογές: ${b} εισήχθησαν, ${c} παραλείφθηκαν. Ενέργειες: ${d} εισήχθησαν, ${e} παραλείφθηκαν.`,
        reportNothing: (a, b, c) => `Δεν έγινε εισαγωγή τίποτα από το ${a}. Επιλογές που παραλείφθηκαν: ${b}. Ενέργειες που παραλείφθηκαν: ${c}.`,
        skip: {
          command: (a, b) => `Μη υποστηριζόμενη εντολή ${a}: ${b}`,
          search: (a, b) => `Μη υποστηριζόμενος τύπος αναζήτησης ${a}: ${b}`,
          filter: (a, b) => `Ενέργειες με φίλτρο κανονικής έκφρασης: ${b}`,
          os: (a, b) => `Προορίζεται για άλλο σύστημα (${a}): ${b}`,
          variable: (a, b) => `Άγνωστη μεταβλητή ${a}: ${b}`,
          path: (a, b) => `Μη χρησιμοποιήσιμες ή μη ασφαλείς διαδρομές: ${b}`
        },
        error: {
          tooLarge: "Αυτό το αρχείο είναι πολύ μεγάλο για να είναι καθαριστής.",
          notXml: "Αυτό δεν είναι έγκυρο XML.",
          notCleaner: "Αυτό δεν είναι αρχείο καθαριστή BleachBit.",
          noId: "Αυτός ο καθαριστής δεν έχει αναγνωριστικό.",
          failed: (a) => `Δεν ήταν δυνατή η εισαγωγή: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `Archivos bloqueados que se eliminarán en el próximo reinicio: ${a}.`,
        needsAdmin: "No se pudieron programar algunos archivos bloqueados para eliminarse al reiniciar, porque eso requiere permisos de administrador."
      },
      files: {
        show: (a) => `Mostrar los archivos de ${a}`,
        hide: (a) => `Ocultar los archivos de ${a}`,
        heading: (a, b) => `Primero los archivos más grandes: se muestran ${a} de ${b}`,
        biggest: (a) => `Más grandes: ${a}`
      },
      custom: {
        category: "Personalizado",
        ruleName: "Ubicaciones personalizadas",
        ruleDescription: "Archivos y carpetas que has añadido tú mismo en Configuración.",
        description: "Añade a la Limpieza profunda archivos, carpetas o patrones, como D:\\Games\\Cache\\*.tmp. Aparecen como una regla propia, nunca marcada por defecto, y siguen respetando tus exclusiones, la protección de archivos recientes y los lugares protegidos.",
        ariaLabel: "Ubicación que añadir",
        remove: (a) => `Dejar de limpiar ${a}`,
        empty: "Todavía no hay ubicaciones personalizadas.",
        error: {
          empty: "Escribe primero una ruta.",
          relative: "Escribe una ruta completa, como D:\\Games\\Cache, o empieza con una variable como %LOCALAPPDATA%.",
          climb: "No se permite una ruta que contenga ..",
          protected: "Es un lugar protegido (Windows, Archivos de programa, una unidad completa o un perfil de usuario).",
          wildcard: "Pon el * más abajo, dentro de una carpeta (D:\\Games\\Cache\\*), no en la raíz de una unidad.",
          long: "Esa ruta es demasiado larga.",
          failed: (a) => `No se pudo guardar: ${a}`
        }
      },
      imported: {
        title: "Limpiadores importados",
        description: "Importa un archivo de limpiador de BleachBit (.xml). Prune incorpora sus opciones de eliminación y te dice exactamente qué omitió. Las reglas importadas nunca están marcadas por defecto y se mantienen fuera de los lugares protegidos.",
        button: "Importar limpiador…",
        empty: "No hay limpiadores importados.",
        meta: (a) => `Opciones importadas: ${a}`,
        remove: (a) => `Quitar ${a}`,
        badge: "Importado",
        reportDone: (a, b, c, d, e) => `Se importó ${a}. Opciones: ${b} importadas, ${c} omitidas. Acciones: ${d} importadas, ${e} omitidas.`,
        reportNothing: (a, b, c) => `No se importó nada de ${a}. Opciones omitidas: ${b}. Acciones omitidas: ${c}.`,
        skip: {
          command: (a, b) => `Comando no compatible ${a}: ${b}`,
          search: (a, b) => `Tipo de búsqueda no compatible ${a}: ${b}`,
          filter: (a, b) => `Acciones con un filtro de expresión regular: ${b}`,
          os: (a, b) => `Pensado para otro sistema (${a}): ${b}`,
          variable: (a, b) => `Variable desconocida ${a}: ${b}`,
          path: (a, b) => `Rutas inutilizables o inseguras: ${b}`
        },
        error: {
          tooLarge: "Ese archivo es demasiado grande para ser un limpiador.",
          notXml: "Eso no es XML válido.",
          notCleaner: "Ese no es un archivo de limpiador de BleachBit.",
          noId: "Ese limpiador no tiene id.",
          failed: (a) => `No se pudo importar: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `Lukustatud failid, mis kustutatakse järgmisel taaskäivitusel: ${a}.`,
        needsAdmin: "Mõnda lukustatud faili ei saanud taaskäivitusel kustutamiseks ajastada, sest see nõuab administraatoriõigusi."
      },
      files: {
        show: (a) => `Näita ${a} faile`,
        hide: (a) => `Peida ${a} failid`,
        heading: (a, b) => `Suurimad failid esimesena: näidatud ${a} / ${b}`,
        biggest: (a) => `Suurimad: ${a}`
      },
      custom: {
        category: "Kohandatud",
        ruleName: "Kohandatud asukohad",
        ruleDescription: "Failid ja kaustad, mille lisasid ise seadetes.",
        description: "Lisa süvapuhastusele faile, kaustu või mustreid, näiteks D:\\Games\\Cache\\*.tmp. Need ilmuvad eraldi reeglina, mida ei märgita vaikimisi, ning arvestavad ikka sinu erandeid, hiljutiste failide kaitset ja kaitstud kohti.",
        ariaLabel: "Lisatav asukoht",
        remove: (a) => `Lõpeta ${a} puhastamine`,
        empty: "Kohandatud asukohti pole veel.",
        error: {
          empty: "Sisesta kõigepealt tee.",
          relative: "Kirjuta täielik tee, näiteks D:\\Games\\Cache, või alusta muutujaga, näiteks %LOCALAPPDATA%.",
          climb: "Tee, milles on .., pole lubatud.",
          protected: "See on kaitstud koht (Windows, Program Files, terve ketas või kasutajaprofiil).",
          wildcard: "Pane * madalamale, kausta sisse (D:\\Games\\Cache\\*), mitte ketta tippu.",
          long: "See tee on liiga pikk.",
          failed: (a) => `Salvestamine ebaõnnestus: ${a}`
        }
      },
      imported: {
        title: "Imporditud puhastajad",
        description: "Impordi BleachBiti puhastaja fail (.xml). Prune võtab üle selle kustutamisvalikud ja ütleb sulle täpselt, mida ta vahele jättis. Imporditud reegleid ei märgita vaikimisi ning need jäävad kaitstud kohtadest eemale.",
        button: "Impordi puhastaja…",
        empty: "Imporditud puhastajaid pole.",
        meta: (a) => `Imporditud valikuid: ${a}`,
        remove: (a) => `Eemalda ${a}`,
        badge: "Imporditud",
        reportDone: (a, b, c, d, e) => `${a} imporditud. Valikud: ${b} imporditud, ${c} vahele jäetud. Toimingud: ${d} imporditud, ${e} vahele jäetud.`,
        reportNothing: (a, b, c) => `Failist ${a} ei imporditud midagi. Vahele jäetud valikud: ${b}. Vahele jäetud toimingud: ${c}.`,
        skip: {
          command: (a, b) => `Toetamata käsk ${a}: ${b}`,
          search: (a, b) => `Toetamata otsingutüüp ${a}: ${b}`,
          filter: (a, b) => `Regulaaravaldise filtriga toimingud: ${b}`,
          os: (a, b) => `Mõeldud teisele süsteemile (${a}): ${b}`,
          variable: (a, b) => `Tundmatu muutuja ${a}: ${b}`,
          path: (a, b) => `Kasutuskõlbmatud või ebaturvalised teed: ${b}`
        },
        error: {
          tooLarge: "See fail on puhastajaks liiga suur.",
          notXml: "See ei ole kehtiv XML.",
          notCleaner: "See ei ole BleachBiti puhastaja fail.",
          noId: "Sellel puhastajal pole id-d.",
          failed: (a) => `Importimine ebaõnnestus: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `Lukitut tiedostot, jotka poistetaan seuraavassa uudelleenkäynnistyksessä: ${a}.`,
        needsAdmin: "Joitakin lukittuja tiedostoja ei voitu ajoittaa poistettavaksi uudelleenkäynnistyksessä, koska se vaatii järjestelmänvalvojan oikeudet."
      },
      files: {
        show: (a) => `Näytä kohteen ${a} tiedostot`,
        hide: (a) => `Piilota kohteen ${a} tiedostot`,
        heading: (a, b) => `Suurimmat tiedostot ensin: näytetään ${a} / ${b}`,
        biggest: (a) => `Suurimmat: ${a}`
      },
      custom: {
        category: "Omat",
        ruleName: "Omat sijainnit",
        ruleDescription: "Tiedostot ja kansiot, jotka olet itse lisännyt asetuksissa.",
        description: "Lisää syväpuhdistukseen tiedostoja, kansioita tai kuvioita, kuten D:\\Games\\Cache\\*.tmp. Ne näkyvät omana sääntönään, joita ei koskaan valita oletuksena, ja ne noudattavat edelleen poikkeuksiasi, uusien tiedostojen suojausta ja suojattuja paikkoja.",
        ariaLabel: "Lisättävä sijainti",
        remove: (a) => `Lopeta kohteen ${a} puhdistus`,
        empty: "Ei vielä omia sijainteja.",
        error: {
          empty: "Kirjoita ensin polku.",
          relative: "Kirjoita koko polku, kuten D:\\Games\\Cache, tai aloita muuttujalla, kuten %LOCALAPPDATA%.",
          climb: "Polku, jossa on .., ei ole sallittu.",
          protected: "Tämä on suojattu paikka (Windows, Program Files, koko asema tai käyttäjäprofiili).",
          wildcard: "Laita * alemmas, kansion sisään (D:\\Games\\Cache\\*), ei aseman ylätasolle.",
          long: "Polku on liian pitkä.",
          failed: (a) => `Tallennus epäonnistui: ${a}`
        }
      },
      imported: {
        title: "Tuodut puhdistimet",
        description: "Tuo BleachBit-puhdistintiedosto (.xml). Prune tuo sen poistovaihtoehdot ja kertoo tarkalleen, mitä se ohitti. Tuotuja sääntöjä ei koskaan valita oletuksena, ja ne pysyvät poissa suojatuista paikoista.",
        button: "Tuo puhdistin…",
        empty: "Ei tuotuja puhdistimia.",
        meta: (a) => `Tuodut vaihtoehdot: ${a}`,
        remove: (a) => `Poista ${a}`,
        badge: "Tuotu",
        reportDone: (a, b, c, d, e) => `${a} tuotu. Vaihtoehdot: ${b} tuotu, ${c} ohitettu. Toiminnot: ${d} tuotu, ${e} ohitettu.`,
        reportNothing: (a, b, c) => `Kohteesta ${a} ei tuotu mitään. Ohitetut vaihtoehdot: ${b}. Ohitetut toiminnot: ${c}.`,
        skip: {
          command: (a, b) => `Ei tuettu komento ${a}: ${b}`,
          search: (a, b) => `Ei tuettu hakutyyppi ${a}: ${b}`,
          filter: (a, b) => `Toiminnot, joissa on säännöllisen lausekkeen suodatin: ${b}`,
          os: (a, b) => `Tarkoitettu toiselle järjestelmälle (${a}): ${b}`,
          variable: (a, b) => `Tuntematon muuttuja ${a}: ${b}`,
          path: (a, b) => `Käyttökelvottomat tai turvattomat polut: ${b}`
        },
        error: {
          tooLarge: "Tiedosto on liian suuri ollakseen puhdistin.",
          notXml: "Tämä ei ole kelvollista XML:ää.",
          notCleaner: "Tämä ei ole BleachBit-puhdistintiedosto.",
          noId: "Tällä puhdistimella ei ole tunnusta.",
          failed: (a) => `Tuonti epäonnistui: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `Fichiers verrouillés qui seront supprimés au prochain redémarrage : ${a}.`,
        needsAdmin: "Certains fichiers verrouillés n'ont pas pu être programmés pour suppression au redémarrage, car cela exige des droits d'administrateur."
      },
      files: {
        show: (a) => `Afficher les fichiers de ${a}`,
        hide: (a) => `Masquer les fichiers de ${a}`,
        heading: (a, b) => `Plus gros fichiers d’abord : ${a} affichés sur ${b}`,
        biggest: (a) => `Plus gros : ${a}`
      },
      custom: {
        category: "Personnalisé",
        ruleName: "Emplacements personnalisés",
        ruleDescription: "Fichiers et dossiers que vous avez ajoutés vous-même dans les Paramètres.",
        description: "Ajoutez au Nettoyage approfondi des fichiers, dossiers ou motifs, comme D:\\Games\\Cache\\*.tmp. Ils apparaissent comme une règle à part, jamais cochée par défaut, et respectent toujours vos exclusions, la protection des fichiers récents et les emplacements protégés.",
        ariaLabel: "Emplacement à ajouter",
        remove: (a) => `Ne plus nettoyer ${a}`,
        empty: "Aucun emplacement personnalisé pour l’instant.",
        error: {
          empty: "Saisissez d’abord un chemin.",
          relative: "Écrivez un chemin complet, comme D:\\Games\\Cache, ou commencez par une variable comme %LOCALAPPDATA%.",
          climb: "Un chemin contenant .. n’est pas autorisé.",
          protected: "C’est un emplacement protégé (Windows, Program Files, un lecteur entier ou un profil utilisateur).",
          wildcard: "Placez le * plus bas, dans un dossier (D:\\Games\\Cache\\*), et non à la racine d’un lecteur.",
          long: "Ce chemin est trop long.",
          failed: (a) => `Enregistrement impossible : ${a}`
        }
      },
      imported: {
        title: "Nettoyeurs importés",
        description: "Importez un fichier de nettoyeur BleachBit (.xml). Prune reprend ses options de suppression et vous dit exactement ce qu’il a ignoré. Les règles importées ne sont jamais cochées par défaut et restent à l’écart des emplacements protégés.",
        button: "Importer un nettoyeur…",
        empty: "Aucun nettoyeur importé.",
        meta: (a) => `Options importées : ${a}`,
        remove: (a) => `Supprimer ${a}`,
        badge: "Importé",
        reportDone: (a, b, c, d, e) => `${a} importé. Options : ${b} importées, ${c} ignorées. Actions : ${d} importées, ${e} ignorées.`,
        reportNothing: (a, b, c) => `Rien n’a été importé de ${a}. Options ignorées : ${b}. Actions ignorées : ${c}.`,
        skip: {
          command: (a, b) => `Commande non prise en charge ${a} : ${b}`,
          search: (a, b) => `Type de recherche non pris en charge ${a} : ${b}`,
          filter: (a, b) => `Actions avec un filtre par expression régulière : ${b}`,
          os: (a, b) => `Prévu pour un autre système (${a}) : ${b}`,
          variable: (a, b) => `Variable inconnue ${a} : ${b}`,
          path: (a, b) => `Chemins inutilisables ou dangereux : ${b}`
        },
        error: {
          tooLarge: "Ce fichier est trop volumineux pour être un nettoyeur.",
          notXml: "Ce n’est pas du XML valide.",
          notCleaner: "Ce n’est pas un fichier de nettoyeur BleachBit.",
          noId: "Ce nettoyeur n’a pas d’identifiant.",
          failed: (a) => `Importation impossible : ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `קבצים נעולים שיימחקו בהפעלה מחדש הבאה: ${a}.`,
        needsAdmin: "לא ניתן היה לתזמן חלק מהקבצים הנעולים למחיקה בהפעלה מחדש, כי הדבר דורש הרשאות מנהל."
      },
      files: {
        show: (a) => `הצג קבצים ב-${a}`,
        hide: (a) => `הסתר קבצים ב-${a}`,
        heading: (a, b) => `הקבצים הגדולים ביותר קודם: מוצגים ${a} מתוך ${b}`,
        biggest: (a) => `הגדולים ביותר: ${a}`
      },
      custom: {
        category: "מותאם אישית",
        ruleName: "מיקומים מותאמים אישית",
        ruleDescription: "קבצים ותיקיות שהוספת בעצמך בהגדרות.",
        description: "הוסף לניקוי המעמיק קבצים, תיקיות או תבניות, כמו D:\\Games\\Cache\\*.tmp. הם מופיעים ככלל נפרד, אף פעם לא מסומנים כברירת מחדל, ועדיין מכבדים את ההחרגות שלך, את ההגנה על קבצים אחרונים ואת המקומות המוגנים.",
        ariaLabel: "מיקום להוספה",
        remove: (a) => `הפסק לנקות את ${a}`,
        empty: "עדיין אין מיקומים מותאמים אישית.",
        error: {
          empty: "הקלד נתיב קודם.",
          relative: "כתוב נתיב מלא, כמו D:\\Games\\Cache, או התחל במשתנה כמו %LOCALAPPDATA%.",
          climb: "נתיב שמכיל .. אינו מותר.",
          protected: "זהו מקום מוגן (Windows, Program Files, כונן שלם או פרופיל משתמש).",
          wildcard: "שים את ה-* ברמה נמוכה יותר, בתוך תיקייה (D:\\Games\\Cache\\*), ולא בראש הכונן.",
          long: "הנתיב ארוך מדי.",
          failed: (a) => `לא ניתן לשמור: ${a}`
        }
      },
      imported: {
        title: "מנקים שיובאו",
        description: "ייבא קובץ מנקה של BleachBit (‎.xml). Prune מביא את אפשרויות המחיקה שלו ואומר לך בדיוק מה דולג. כללים מיובאים לעולם אינם מסומנים כברירת מחדל ונשארים מחוץ למקומות מוגנים.",
        button: "ייבא מנקה…",
        empty: "אין מנקים מיובאים.",
        meta: (a) => `אפשרויות שיובאו: ${a}`,
        remove: (a) => `הסר את ${a}`,
        badge: "מיובא",
        reportDone: (a, b, c, d, e) => `${a} יובא. אפשרויות: ${b} יובאו, ${c} דולגו. פעולות: ${d} יובאו, ${e} דולגו.`,
        reportNothing: (a, b, c) => `לא יובא דבר מ-${a}. אפשרויות שדולגו: ${b}. פעולות שדולגו: ${c}.`,
        skip: {
          command: (a, b) => `פקודה לא נתמכת ${a}: ${b}`,
          search: (a, b) => `סוג חיפוש לא נתמך ${a}: ${b}`,
          filter: (a, b) => `פעולות עם מסנן ביטוי רגולרי: ${b}`,
          os: (a, b) => `מיועד למערכת אחרת (${a}): ${b}`,
          variable: (a, b) => `משתנה לא מוכר ${a}: ${b}`,
          path: (a, b) => `נתיבים לא שמישים או לא בטוחים: ${b}`
        },
        error: {
          tooLarge: "הקובץ גדול מדי מכדי להיות מנקה.",
          notXml: "זה אינו XML תקין.",
          notCleaner: "זה אינו קובץ מנקה של BleachBit.",
          noId: "למנקה הזה אין מזהה.",
          failed: (a) => `לא ניתן לייבא: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `A következő újraindításkor törlődő zárolt fájlok: ${a}.`,
        needsAdmin: "Néhány zárolt fájl törlését nem sikerült az újraindításra ütemezni, mert ehhez rendszergazdai jogosultság kell."
      },
      files: {
        show: (a) => `${a} fájljainak megjelenítése`,
        hide: (a) => `${a} fájljainak elrejtése`,
        heading: (a, b) => `A legnagyobb fájlok elöl: ${a} megjelenítve ${b}-ből`,
        biggest: (a) => `Legnagyobbak: ${a}`
      },
      custom: {
        category: "Egyéni",
        ruleName: "Egyéni helyek",
        ruleDescription: "A Beállításokban általad hozzáadott fájlok és mappák.",
        description: "Adj hozzá fájlokat, mappákat vagy mintákat, például D:\\Games\\Cache\\*.tmp, a Mélytisztításhoz. Önálló szabályként jelennek meg, alapértelmezetten soha nincsenek kipipálva, és továbbra is tiszteletben tartják a kivételeidet, a friss fájlok védelmét és a védett helyeket.",
        ariaLabel: "Hozzáadandó hely",
        remove: (a) => `${a} tisztításának leállítása`,
        empty: "Még nincsenek egyéni helyek.",
        error: {
          empty: "Előbb írj be egy elérési utat.",
          relative: "Írj be teljes elérési utat, például D:\\Games\\Cache, vagy kezdd változóval, például %LOCALAPPDATA%.",
          climb: "A .. tartalmazó elérési út nem engedélyezett.",
          protected: "Ez védett hely (Windows, Program Files, egy teljes meghajtó vagy egy felhasználói profil).",
          wildcard: "A *-ot tedd lejjebb, egy mappán belülre (D:\\Games\\Cache\\*), ne a meghajtó tetejére.",
          long: "Ez az elérési út túl hosszú.",
          failed: (a) => `Nem sikerült menteni: ${a}`
        }
      },
      imported: {
        title: "Importált tisztítók",
        description: "Importálj egy BleachBit-tisztítófájlt (.xml). A Prune átveszi a törlési lehetőségeit, és pontosan megmondja, mit hagyott ki. Az importált szabályok alapértelmezetten soha nincsenek kipipálva, és távol maradnak a védett helyektől.",
        button: "Tisztító importálása…",
        empty: "Nincsenek importált tisztítók.",
        meta: (a) => `Importált lehetőségek: ${a}`,
        remove: (a) => `${a} eltávolítása`,
        badge: "Importált",
        reportDone: (a, b, c, d, e) => `${a} importálva. Lehetőségek: ${b} importálva, ${c} kihagyva. Műveletek: ${d} importálva, ${e} kihagyva.`,
        reportNothing: (a, b, c) => `A(z) ${a} fájlból semmi sem lett importálva. Kihagyott lehetőségek: ${b}. Kihagyott műveletek: ${c}.`,
        skip: {
          command: (a, b) => `Nem támogatott parancs ${a}: ${b}`,
          search: (a, b) => `Nem támogatott keresési típus ${a}: ${b}`,
          filter: (a, b) => `Reguláris kifejezéses szűrővel rendelkező műveletek: ${b}`,
          os: (a, b) => `Másik rendszerre szánt (${a}): ${b}`,
          variable: (a, b) => `Ismeretlen változó ${a}: ${b}`,
          path: (a, b) => `Használhatatlan vagy nem biztonságos elérési utak: ${b}`
        },
        error: {
          tooLarge: "Ez a fájl túl nagy ahhoz, hogy tisztító legyen.",
          notXml: "Ez nem érvényes XML.",
          notCleaner: "Ez nem BleachBit-tisztítófájl.",
          noId: "Ennek a tisztítónak nincs azonosítója.",
          failed: (a) => `Nem sikerült importálni: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `File terkunci yang akan dihapus saat restart berikutnya: ${a}.`,
        needsAdmin: "Beberapa file terkunci tidak dapat dijadwalkan untuk dihapus saat restart, karena itu memerlukan hak administrator."
      },
      files: {
        show: (a) => `Tampilkan file di ${a}`,
        hide: (a) => `Sembunyikan file di ${a}`,
        heading: (a, b) => `File terbesar lebih dulu: menampilkan ${a} dari ${b}`,
        biggest: (a) => `Terbesar: ${a}`
      },
      custom: {
        category: "Kustom",
        ruleName: "Lokasi kustom",
        ruleDescription: "File dan folder yang Anda tambahkan sendiri di Pengaturan.",
        description: "Tambahkan file, folder, atau pola, seperti D:\\Games\\Cache\\*.tmp, ke Pembersihan Mendalam. Semuanya muncul sebagai aturan tersendiri, tidak pernah dicentang secara default, dan tetap menghormati pengecualian Anda, perlindungan file terbaru, dan lokasi yang dilindungi.",
        ariaLabel: "Lokasi yang akan ditambahkan",
        remove: (a) => `Berhenti membersihkan ${a}`,
        empty: "Belum ada lokasi kustom.",
        error: {
          empty: "Ketik path terlebih dahulu.",
          relative: "Tulis path lengkap, seperti D:\\Games\\Cache, atau mulai dengan variabel seperti %LOCALAPPDATA%.",
          climb: "Path yang mengandung .. tidak diizinkan.",
          protected: "Itu lokasi yang dilindungi (Windows, Program Files, seluruh drive, atau profil pengguna).",
          wildcard: "Letakkan * lebih dalam, di dalam folder (D:\\Games\\Cache\\*), bukan di bagian atas drive.",
          long: "Path itu terlalu panjang.",
          failed: (a) => `Tidak dapat menyimpan: ${a}`
        }
      },
      imported: {
        title: "Pembersih yang diimpor",
        description: "Impor file pembersih BleachBit (.xml). Prune membawa opsi hapusnya dan memberi tahu Anda persis apa yang dilewati. Aturan yang diimpor tidak pernah dicentang secara default dan tidak menyentuh lokasi yang dilindungi.",
        button: "Impor pembersih…",
        empty: "Tidak ada pembersih yang diimpor.",
        meta: (a) => `Opsi yang diimpor: ${a}`,
        remove: (a) => `Hapus ${a}`,
        badge: "Diimpor",
        reportDone: (a, b, c, d, e) => `${a} diimpor. Opsi: ${b} diimpor, ${c} dilewati. Tindakan: ${d} diimpor, ${e} dilewati.`,
        reportNothing: (a, b, c) => `Tidak ada yang diimpor dari ${a}. Opsi dilewati: ${b}. Tindakan dilewati: ${c}.`,
        skip: {
          command: (a, b) => `Perintah tidak didukung ${a}: ${b}`,
          search: (a, b) => `Jenis pencarian tidak didukung ${a}: ${b}`,
          filter: (a, b) => `Tindakan dengan filter ekspresi reguler: ${b}`,
          os: (a, b) => `Ditujukan untuk sistem lain (${a}): ${b}`,
          variable: (a, b) => `Variabel tidak dikenal ${a}: ${b}`,
          path: (a, b) => `Path yang tidak dapat digunakan atau tidak aman: ${b}`
        },
        error: {
          tooLarge: "File itu terlalu besar untuk menjadi pembersih.",
          notXml: "Itu bukan XML yang valid.",
          notCleaner: "Itu bukan file pembersih BleachBit.",
          noId: "Pembersih itu tidak memiliki id.",
          failed: (a) => `Tidak dapat mengimpor: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `Læstar skrár sem verður eytt við næstu endurræsingu: ${a}.`,
        needsAdmin: "Ekki tókst að tímasetja eyðingu sumra læstra skráa við endurræsingu því það krefst stjórnandaréttinda."
      },
      files: {
        show: (a) => `Sýna skrár í ${a}`,
        hide: (a) => `Fela skrár í ${a}`,
        heading: (a, b) => `Stærstu skrárnar fyrst: sýni ${a} af ${b}`,
        biggest: (a) => `Stærst: ${a}`
      },
      custom: {
        category: "Sérsniðið",
        ruleName: "Sérsniðnar staðsetningar",
        ruleDescription: "Skrár og möppur sem þú bættir sjálf(ur) við í Stillingum.",
        description: "Bættu skrám, möppum eða mynstrum, eins og D:\\Games\\Cache\\*.tmp, við Djúphreinsun. Þau birtast sem sérstök regla, eru aldrei hökuð sjálfgefið og virða áfram undantekningar þínar, vörnina fyrir nýlegar skrár og vernduðu staðina.",
        ariaLabel: "Staðsetning til að bæta við",
        remove: (a) => `Hætta að hreinsa ${a}`,
        empty: "Engar sérsniðnar staðsetningar enn.",
        error: {
          empty: "Sláðu fyrst inn slóð.",
          relative: "Skrifaðu fulla slóð, eins og D:\\Games\\Cache, eða byrjaðu á breytu eins og %LOCALAPPDATA%.",
          climb: "Slóð með .. er ekki leyfð.",
          protected: "Þetta er varinn staður (Windows, Program Files, heilt drif eða notandasnið).",
          wildcard: "Settu * neðar, inni í möppu (D:\\Games\\Cache\\*), ekki efst á drifi.",
          long: "Þessi slóð er of löng.",
          failed: (a) => `Ekki tókst að vista: ${a}`
        }
      },
      imported: {
        title: "Innfluttir hreinsarar",
        description: "Fluttu inn BleachBit hreinsiskrá (.xml). Prune tekur inn eyðingarvalkosti hennar og segir þér nákvæmlega hvað var sleppt. Innfluttar reglur eru aldrei hakaðar sjálfgefið og halda sig frá vernduðum stöðum.",
        button: "Flytja inn hreinsara…",
        empty: "Engir innfluttir hreinsarar.",
        meta: (a) => `Innfluttir valkostir: ${a}`,
        remove: (a) => `Fjarlægja ${a}`,
        badge: "Innflutt",
        reportDone: (a, b, c, d, e) => `${a} flutt inn. Valkostir: ${b} fluttir inn, ${c} sleppt. Aðgerðir: ${d} fluttar inn, ${e} sleppt.`,
        reportNothing: (a, b, c) => `Engu var flutt inn úr ${a}. Valkostum sleppt: ${b}. Aðgerðum sleppt: ${c}.`,
        skip: {
          command: (a, b) => `Óstudd skipun ${a}: ${b}`,
          search: (a, b) => `Óstudd leitargerð ${a}: ${b}`,
          filter: (a, b) => `Aðgerðir með reglulegri segð sem síu: ${b}`,
          os: (a, b) => `Ætlað öðru kerfi (${a}): ${b}`,
          variable: (a, b) => `Óþekkt breyta ${a}: ${b}`,
          path: (a, b) => `Ónothæfar eða óöruggar slóðir: ${b}`
        },
        error: {
          tooLarge: "Skráin er of stór til að vera hreinsari.",
          notXml: "Þetta er ekki gilt XML.",
          notCleaner: "Þetta er ekki BleachBit hreinsiskrá.",
          noId: "Þessi hreinsari er ekki með auðkenni.",
          failed: (a) => `Ekki tókst að flytja inn: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `File bloccati che verranno eliminati al prossimo riavvio: ${a}.`,
        needsAdmin: "Alcuni file bloccati non hanno potuto essere programmati per l'eliminazione al riavvio, perché servono i diritti di amministratore."
      },
      files: {
        show: (a) => `Mostra i file di ${a}`,
        hide: (a) => `Nascondi i file di ${a}`,
        heading: (a, b) => `Prima i file più grandi: ne vengono mostrati ${a} su ${b}`,
        biggest: (a) => `Più grandi: ${a}`
      },
      custom: {
        category: "Personalizzato",
        ruleName: "Posizioni personalizzate",
        ruleDescription: "File e cartelle che hai aggiunto tu stesso nelle Impostazioni.",
        description: "Aggiungi alla Pulizia approfondita file, cartelle o pattern, come D:\\Games\\Cache\\*.tmp. Compaiono come regola a sé, mai selezionata per impostazione predefinita, e rispettano comunque le tue esclusioni, la protezione dei file recenti e i percorsi protetti.",
        ariaLabel: "Posizione da aggiungere",
        remove: (a) => `Smetti di pulire ${a}`,
        empty: "Ancora nessuna posizione personalizzata.",
        error: {
          empty: "Digita prima un percorso.",
          relative: "Scrivi un percorso completo, come D:\\Games\\Cache, oppure inizia con una variabile come %LOCALAPPDATA%.",
          climb: "Un percorso che contiene .. non è consentito.",
          protected: "È un percorso protetto (Windows, Program Files, un’intera unità o un profilo utente).",
          wildcard: "Metti il * più in basso, dentro una cartella (D:\\Games\\Cache\\*), non alla radice di un’unità.",
          long: "Il percorso è troppo lungo.",
          failed: (a) => `Impossibile salvare: ${a}`
        }
      },
      imported: {
        title: "Cleaner importati",
        description: "Importa un file di cleaner BleachBit (.xml). Prune ne porta le opzioni di eliminazione e ti dice esattamente cosa ha saltato. Le regole importate non sono mai selezionate per impostazione predefinita e restano fuori dai percorsi protetti.",
        button: "Importa cleaner…",
        empty: "Nessun cleaner importato.",
        meta: (a) => `Opzioni importate: ${a}`,
        remove: (a) => `Rimuovi ${a}`,
        badge: "Importato",
        reportDone: (a, b, c, d, e) => `${a} importato. Opzioni: ${b} importate, ${c} saltate. Azioni: ${d} importate, ${e} saltate.`,
        reportNothing: (a, b, c) => `Non è stato importato nulla da ${a}. Opzioni saltate: ${b}. Azioni saltate: ${c}.`,
        skip: {
          command: (a, b) => `Comando non supportato ${a}: ${b}`,
          search: (a, b) => `Tipo di ricerca non supportato ${a}: ${b}`,
          filter: (a, b) => `Azioni con un filtro a espressione regolare: ${b}`,
          os: (a, b) => `Pensato per un altro sistema (${a}): ${b}`,
          variable: (a, b) => `Variabile sconosciuta ${a}: ${b}`,
          path: (a, b) => `Percorsi inutilizzabili o non sicuri: ${b}`
        },
        error: {
          tooLarge: "Il file è troppo grande per essere un cleaner.",
          notXml: "Non è un XML valido.",
          notCleaner: "Non è un file di cleaner BleachBit.",
          noId: "Quel cleaner non ha un id.",
          failed: (a) => `Impossibile importare: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `次回の再起動時に削除されるロック中のファイル：${a}。`,
        needsAdmin: "一部のロック中のファイルは、再起動時の削除を予約できませんでした。予約には管理者権限が必要です。"
      },
      files: {
        show: (a) => `${a} のファイルを表示`,
        hide: (a) => `${a} のファイルを非表示`,
        heading: (a, b) => `大きい順に表示：${b} 件中 ${a} 件`,
        biggest: (a) => `最大：${a}`
      },
      custom: {
        category: "カスタム",
        ruleName: "カスタムの場所",
        ruleDescription: "設定で自分で追加したファイルとフォルダー。",
        description: "D:\\Games\\Cache\\*.tmp のようなファイル、フォルダー、パターンをディープクリーンに追加します。独立したルールとして表示され、既定ではオンにならず、除外設定、最近のファイルの保護、保護された場所は引き続き守られます。",
        ariaLabel: "追加する場所",
        remove: (a) => `${a} のクリーンアップをやめる`,
        empty: "カスタムの場所はまだありません。",
        error: {
          empty: "先にパスを入力してください。",
          relative: "D:\\Games\\Cache のような完全なパスを入力するか、%LOCALAPPDATA% のような変数から始めてください。",
          climb: ".. を含むパスは使えません。",
          protected: "ここは保護された場所です（Windows、Program Files、ドライブ全体、ユーザー プロファイル）。",
          wildcard: "* はドライブの最上位ではなく、フォルダーの中（D:\\Games\\Cache\\*）に置いてください。",
          long: "パスが長すぎます。",
          failed: (a) => `保存できませんでした：${a}`
        }
      },
      imported: {
        title: "インポートしたクリーナー",
        description: "BleachBit のクリーナー ファイル（.xml）をインポートします。Prune は削除オプションを取り込み、スキップした内容を正確にお知らせします。インポートしたルールは既定ではオンにならず、保護された場所には触れません。",
        button: "クリーナーをインポート…",
        empty: "インポートしたクリーナーはありません。",
        meta: (a) => `インポートしたオプション：${a}`,
        remove: (a) => `${a} を削除`,
        badge: "インポート済み",
        reportDone: (a, b, c, d, e) => `${a} をインポートしました。オプション：${b} 件をインポート、${c} 件をスキップ。アクション：${d} 件をインポート、${e} 件をスキップ。`,
        reportNothing: (a, b, c) => `${a} からは何もインポートされませんでした。スキップしたオプション：${b} 件。スキップしたアクション：${c} 件。`,
        skip: {
          command: (a, b) => `未対応のコマンド ${a}：${b}`,
          search: (a, b) => `未対応の検索の種類 ${a}：${b}`,
          filter: (a, b) => `正規表現フィルターを使うアクション：${b}`,
          os: (a, b) => `別のシステム向け（${a}）：${b}`,
          variable: (a, b) => `不明な変数 ${a}：${b}`,
          path: (a, b) => `使用できない、または安全でないパス：${b}`
        },
        error: {
          tooLarge: "ファイルが大きすぎて、クリーナーではありません。",
          notXml: "有効な XML ではありません。",
          notCleaner: "BleachBit のクリーナー ファイルではありません。",
          noId: "このクリーナーには ID がありません。",
          failed: (a) => `インポートできませんでした：${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `다음 다시 시작할 때 삭제될 잠긴 파일: ${a}개.`,
        needsAdmin: "일부 잠긴 파일은 관리자 권한이 필요하여 다시 시작할 때 삭제하도록 예약하지 못했습니다."
      },
      files: {
        show: (a) => `${a}의 파일 보기`,
        hide: (a) => `${a}의 파일 숨기기`,
        heading: (a, b) => `큰 파일 순서: ${b}개 중 ${a}개 표시`,
        biggest: (a) => `가장 큰 항목: ${a}`
      },
      custom: {
        category: "사용자 지정",
        ruleName: "사용자 지정 위치",
        ruleDescription: "설정에서 직접 추가한 파일과 폴더입니다.",
        description: "D:\\Games\\Cache\\*.tmp 같은 파일, 폴더 또는 패턴을 딥 클린에 추가합니다. 별도의 규칙으로 표시되며 기본적으로 선택되지 않고, 제외 항목, 최근 파일 보호, 보호된 위치를 계속 따릅니다.",
        ariaLabel: "추가할 위치",
        remove: (a) => `${a} 정리 중단`,
        empty: "아직 사용자 지정 위치가 없습니다.",
        error: {
          empty: "먼저 경로를 입력하세요.",
          relative: "D:\\Games\\Cache 같은 전체 경로를 쓰거나 %LOCALAPPDATA% 같은 변수로 시작하세요.",
          climb: ".. 이 포함된 경로는 사용할 수 없습니다.",
          protected: "보호된 위치입니다(Windows, Program Files, 드라이브 전체 또는 사용자 프로필).",
          wildcard: "*는 드라이브 최상위가 아니라 폴더 안쪽(D:\\Games\\Cache\\*)에 넣으세요.",
          long: "경로가 너무 깁니다.",
          failed: (a) => `저장하지 못했습니다: ${a}`
        }
      },
      imported: {
        title: "가져온 클리너",
        description: "BleachBit 클리너 파일(.xml)을 가져옵니다. Prune은 삭제 옵션을 가져오고 건너뛴 항목을 정확히 알려 줍니다. 가져온 규칙은 기본적으로 선택되지 않으며 보호된 위치에는 접근하지 않습니다.",
        button: "클리너 가져오기…",
        empty: "가져온 클리너가 없습니다.",
        meta: (a) => `가져온 옵션: ${a}개`,
        remove: (a) => `${a} 제거`,
        badge: "가져옴",
        reportDone: (a, b, c, d, e) => `${a}을(를) 가져왔습니다. 옵션: ${b}개 가져옴, ${c}개 건너뜀. 동작: ${d}개 가져옴, ${e}개 건너뜀.`,
        reportNothing: (a, b, c) => `${a}에서 가져온 항목이 없습니다. 건너뛴 옵션: ${b}개. 건너뛴 동작: ${c}개.`,
        skip: {
          command: (a, b) => `지원하지 않는 명령 ${a}: ${b}`,
          search: (a, b) => `지원하지 않는 검색 유형 ${a}: ${b}`,
          filter: (a, b) => `정규식 필터가 있는 동작: ${b}`,
          os: (a, b) => `다른 시스템용(${a}): ${b}`,
          variable: (a, b) => `알 수 없는 변수 ${a}: ${b}`,
          path: (a, b) => `사용할 수 없거나 안전하지 않은 경로: ${b}`
        },
        error: {
          tooLarge: "파일이 너무 커서 클리너가 아닙니다.",
          notXml: "올바른 XML이 아닙니다.",
          notCleaner: "BleachBit 클리너 파일이 아닙니다.",
          noId: "이 클리너에는 id가 없습니다.",
          failed: (a) => `가져오지 못했습니다: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `Užrakinti failai, kurie bus ištrinti kitą kartą paleidus iš naujo: ${a}.`,
        needsAdmin: "Kai kurių užrakintų failų nepavyko suplanuoti ištrinti paleidus iš naujo, nes tam reikia administratoriaus teisių."
      },
      files: {
        show: (a) => `Rodyti failus: ${a}`,
        hide: (a) => `Slėpti failus: ${a}`,
        heading: (a, b) => `Pirma didžiausi failai: rodoma ${a} iš ${b}`,
        biggest: (a) => `Didžiausi: ${a}`
      },
      custom: {
        category: "Pasirinktinis",
        ruleName: "Pasirinktinės vietos",
        ruleDescription: "Failai ir aplankai, kuriuos pats pridėjote nustatymuose.",
        description: "Pridėkite prie Gilaus valymo failus, aplankus ar šablonus, pvz., D:\\Games\\Cache\\*.tmp. Jie rodomi kaip atskira taisyklė, niekada nežymima pagal numatytuosius nustatymus ir vis tiek gerbia jūsų išimtis, naujausių failų apsaugą ir saugomas vietas.",
        ariaLabel: "Pridedama vieta",
        remove: (a) => `Nebevalyti ${a}`,
        empty: "Pasirinktinių vietų dar nėra.",
        error: {
          empty: "Pirmiausia įveskite kelią.",
          relative: "Įrašykite visą kelią, pvz., D:\\Games\\Cache, arba pradėkite kintamuoju, pvz., %LOCALAPPDATA%.",
          climb: "Kelias su .. neleidžiamas.",
          protected: "Tai saugoma vieta (Windows, Program Files, visas diskas ar naudotojo profilis).",
          wildcard: "Įdėkite * giliau, į aplanko vidų (D:\\Games\\Cache\\*), o ne disko viršuje.",
          long: "Tas kelias per ilgas.",
          failed: (a) => `Nepavyko išsaugoti: ${a}`
        }
      },
      imported: {
        title: "Importuoti valikliai",
        description: "Importuokite „BleachBit“ valiklio failą (.xml). „Prune“ perima jo trynimo parinktis ir tiksliai pasako, ką praleido. Importuotos taisyklės niekada nežymimos pagal numatytuosius nustatymus ir nesiartina prie saugomų vietų.",
        button: "Importuoti valiklį…",
        empty: "Importuotų valiklių nėra.",
        meta: (a) => `Importuota parinkčių: ${a}`,
        remove: (a) => `Pašalinti ${a}`,
        badge: "Importuota",
        reportDone: (a, b, c, d, e) => `Importuota: ${a}. Parinktys: ${b} importuota, ${c} praleista. Veiksmai: ${d} importuota, ${e} praleista.`,
        reportNothing: (a, b, c) => `Iš ${a} niekas neimportuota. Praleista parinkčių: ${b}. Praleista veiksmų: ${c}.`,
        skip: {
          command: (a, b) => `Nepalaikoma komanda ${a}: ${b}`,
          search: (a, b) => `Nepalaikomas paieškos tipas ${a}: ${b}`,
          filter: (a, b) => `Veiksmai su reguliariosios išraiškos filtru: ${b}`,
          os: (a, b) => `Skirta kitai sistemai (${a}): ${b}`,
          variable: (a, b) => `Nežinomas kintamasis ${a}: ${b}`,
          path: (a, b) => `Netinkami arba nesaugūs keliai: ${b}`
        },
        error: {
          tooLarge: "Šis failas per didelis, kad būtų valiklis.",
          notXml: "Tai nėra tinkamas XML.",
          notCleaner: "Tai nėra „BleachBit“ valiklio failas.",
          noId: "Šis valiklis neturi id.",
          failed: (a) => `Nepavyko importuoti: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `Fail terkunci yang akan dipadam pada mula semula seterusnya: ${a}.`,
        needsAdmin: "Sesetengah fail terkunci tidak dapat dijadualkan untuk dipadam semasa mula semula, kerana itu memerlukan hak pentadbir."
      },
      files: {
        show: (a) => `Tunjukkan fail dalam ${a}`,
        hide: (a) => `Sembunyikan fail dalam ${a}`,
        heading: (a, b) => `Fail terbesar dahulu: menunjukkan ${a} daripada ${b}`,
        biggest: (a) => `Terbesar: ${a}`
      },
      custom: {
        category: "Tersuai",
        ruleName: "Lokasi tersuai",
        ruleDescription: "Fail dan folder yang anda tambah sendiri dalam Tetapan.",
        description: "Tambah fail, folder atau corak, seperti D:\\Games\\Cache\\*.tmp, ke Pembersihan Mendalam. Ia muncul sebagai peraturan tersendiri, tidak pernah ditanda secara lalai, dan masih menghormati pengecualian anda, perlindungan fail terkini dan tempat yang dilindungi.",
        ariaLabel: "Lokasi untuk ditambah",
        remove: (a) => `Berhenti membersihkan ${a}`,
        empty: "Belum ada lokasi tersuai.",
        error: {
          empty: "Taip laluan dahulu.",
          relative: "Tulis laluan penuh, seperti D:\\Games\\Cache, atau mulakan dengan pemboleh ubah seperti %LOCALAPPDATA%.",
          climb: "Laluan yang mengandungi .. tidak dibenarkan.",
          protected: "Itu tempat yang dilindungi (Windows, Program Files, seluruh pemacu atau profil pengguna).",
          wildcard: "Letakkan * lebih bawah, di dalam folder (D:\\Games\\Cache\\*), bukan di bahagian atas pemacu.",
          long: "Laluan itu terlalu panjang.",
          failed: (a) => `Tidak dapat menyimpan: ${a}`
        }
      },
      imported: {
        title: "Pembersih yang diimport",
        description: "Import fail pembersih BleachBit (.xml). Prune membawa masuk pilihan padamnya dan memberitahu anda dengan tepat apa yang dilangkau. Peraturan yang diimport tidak pernah ditanda secara lalai dan tidak menyentuh tempat yang dilindungi.",
        button: "Import pembersih…",
        empty: "Tiada pembersih yang diimport.",
        meta: (a) => `Pilihan diimport: ${a}`,
        remove: (a) => `Alih keluar ${a}`,
        badge: "Diimport",
        reportDone: (a, b, c, d, e) => `${a} diimport. Pilihan: ${b} diimport, ${c} dilangkau. Tindakan: ${d} diimport, ${e} dilangkau.`,
        reportNothing: (a, b, c) => `Tiada apa-apa diimport daripada ${a}. Pilihan dilangkau: ${b}. Tindakan dilangkau: ${c}.`,
        skip: {
          command: (a, b) => `Arahan tidak disokong ${a}: ${b}`,
          search: (a, b) => `Jenis carian tidak disokong ${a}: ${b}`,
          filter: (a, b) => `Tindakan dengan penapis ungkapan nalar: ${b}`,
          os: (a, b) => `Untuk sistem lain (${a}): ${b}`,
          variable: (a, b) => `Pemboleh ubah tidak diketahui ${a}: ${b}`,
          path: (a, b) => `Laluan yang tidak boleh digunakan atau tidak selamat: ${b}`
        },
        error: {
          tooLarge: "Fail itu terlalu besar untuk menjadi pembersih.",
          notXml: "Itu bukan XML yang sah.",
          notCleaner: "Itu bukan fail pembersih BleachBit.",
          noId: "Pembersih itu tiada id.",
          failed: (a) => `Tidak dapat mengimport: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `Låste filer som slettes ved neste omstart: ${a}.`,
        needsAdmin: "Noen låste filer kunne ikke planlegges slettet ved omstart, fordi det krever administratorrettigheter."
      },
      files: {
        show: (a) => `Vis filer i ${a}`,
        hide: (a) => `Skjul filer i ${a}`,
        heading: (a, b) => `Største filer først: viser ${a} av ${b}`,
        biggest: (a) => `Største: ${a}`
      },
      custom: {
        category: "Egendefinert",
        ruleName: "Egendefinerte plasseringer",
        ruleDescription: "Filer og mapper du selv la til i Innstillinger.",
        description: "Legg til filer, mapper eller mønstre, for eksempel D:\\Games\\Cache\\*.tmp, i Grundig opprydding. De vises som en egen regel, er aldri avkrysset som standard og respekterer fortsatt unntakene dine, vernet av nylige filer og de beskyttede stedene.",
        ariaLabel: "Plassering som skal legges til",
        remove: (a) => `Slutt å rydde ${a}`,
        empty: "Ingen egendefinerte plasseringer ennå.",
        error: {
          empty: "Skriv inn en sti først.",
          relative: "Skriv en full sti, for eksempel D:\\Games\\Cache, eller begynn med en variabel som %LOCALAPPDATA%.",
          climb: "En sti med .. er ikke tillatt.",
          protected: "Dette er et beskyttet sted (Windows, Program Files, en hel stasjon eller en brukerprofil).",
          wildcard: "Sett * lenger ned, inni en mappe (D:\\Games\\Cache\\*), ikke øverst på en stasjon.",
          long: "Den stien er for lang.",
          failed: (a) => `Kunne ikke lagre: ${a}`
        }
      },
      imported: {
        title: "Importerte renseverktøy",
        description: "Importer en BleachBit-renseverktøyfil (.xml). Prune henter inn slettealternativene og forteller deg nøyaktig hva som ble hoppet over. Importerte regler er aldri avkrysset som standard og holder seg unna beskyttede steder.",
        button: "Importer renseverktøy…",
        empty: "Ingen importerte renseverktøy.",
        meta: (a) => `Importerte alternativer: ${a}`,
        remove: (a) => `Fjern ${a}`,
        badge: "Importert",
        reportDone: (a, b, c, d, e) => `${a} importert. Alternativer: ${b} importert, ${c} hoppet over. Handlinger: ${d} importert, ${e} hoppet over.`,
        reportNothing: (a, b, c) => `Ingenting ble importert fra ${a}. Alternativer hoppet over: ${b}. Handlinger hoppet over: ${c}.`,
        skip: {
          command: (a, b) => `Ikke-støttet kommando ${a}: ${b}`,
          search: (a, b) => `Ikke-støttet søketype ${a}: ${b}`,
          filter: (a, b) => `Handlinger med et regulært uttrykk som filter: ${b}`,
          os: (a, b) => `Ment for et annet system (${a}): ${b}`,
          variable: (a, b) => `Ukjent variabel ${a}: ${b}`,
          path: (a, b) => `Ubrukelige eller utrygge stier: ${b}`
        },
        error: {
          tooLarge: "Den filen er for stor til å være et renseverktøy.",
          notXml: "Det er ikke gyldig XML.",
          notCleaner: "Det er ikke en BleachBit-renseverktøyfil.",
          noId: "Det renseverktøyet har ingen id.",
          failed: (a) => `Kunne ikke importere: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `Vergrendelde bestanden die bij de volgende herstart worden verwijderd: ${a}.`,
        needsAdmin: "Sommige vergrendelde bestanden konden niet worden gepland voor verwijdering bij het herstarten, omdat daarvoor beheerdersrechten nodig zijn."
      },
      files: {
        show: (a) => `Bestanden in ${a} tonen`,
        hide: (a) => `Bestanden in ${a} verbergen`,
        heading: (a, b) => `Grootste bestanden eerst: ${a} van ${b} getoond`,
        biggest: (a) => `Grootste: ${a}`
      },
      custom: {
        category: "Aangepast",
        ruleName: "Aangepaste locaties",
        ruleDescription: "Bestanden en mappen die je zelf hebt toegevoegd in Instellingen.",
        description: "Voeg bestanden, mappen of patronen, zoals D:\\Games\\Cache\\*.tmp, toe aan Grondige opschoning. Ze verschijnen als een eigen regel, nooit standaard aangevinkt, en houden rekening met je uitzonderingen, de bescherming van recente bestanden en de beschermde plaatsen.",
        ariaLabel: "Toe te voegen locatie",
        remove: (a) => `Stoppen met opschonen van ${a}`,
        empty: "Nog geen aangepaste locaties.",
        error: {
          empty: "Typ eerst een pad.",
          relative: "Schrijf een volledig pad, zoals D:\\Games\\Cache, of begin met een variabele zoals %LOCALAPPDATA%.",
          climb: "Een pad met .. is niet toegestaan.",
          protected: "Dat is een beschermde plek (Windows, Program Files, een hele schijf of een gebruikersprofiel).",
          wildcard: "Zet de * lager, in een map (D:\\Games\\Cache\\*), niet bovenaan een schijf.",
          long: "Dat pad is te lang.",
          failed: (a) => `Opslaan mislukt: ${a}`
        }
      },
      imported: {
        title: "Geïmporteerde cleaners",
        description: "Importeer een BleachBit-cleanerbestand (.xml). Prune neemt de verwijderopties over en vertelt je precies wat is overgeslagen. Geïmporteerde regels zijn nooit standaard aangevinkt en blijven weg van beschermde plaatsen.",
        button: "Cleaner importeren…",
        empty: "Geen geïmporteerde cleaners.",
        meta: (a) => `Geïmporteerde opties: ${a}`,
        remove: (a) => `${a} verwijderen`,
        badge: "Geïmporteerd",
        reportDone: (a, b, c, d, e) => `${a} geïmporteerd. Opties: ${b} geïmporteerd, ${c} overgeslagen. Acties: ${d} geïmporteerd, ${e} overgeslagen.`,
        reportNothing: (a, b, c) => `Er is niets geïmporteerd uit ${a}. Overgeslagen opties: ${b}. Overgeslagen acties: ${c}.`,
        skip: {
          command: (a, b) => `Niet-ondersteunde opdracht ${a}: ${b}`,
          search: (a, b) => `Niet-ondersteund zoektype ${a}: ${b}`,
          filter: (a, b) => `Acties met een filter met een reguliere expressie: ${b}`,
          os: (a, b) => `Bedoeld voor een ander systeem (${a}): ${b}`,
          variable: (a, b) => `Onbekende variabele ${a}: ${b}`,
          path: (a, b) => `Onbruikbare of onveilige paden: ${b}`
        },
        error: {
          tooLarge: "Dat bestand is te groot voor een cleaner.",
          notXml: "Dat is geen geldige XML.",
          notCleaner: "Dat is geen BleachBit-cleanerbestand.",
          noId: "Die cleaner heeft geen id.",
          failed: (a) => `Importeren mislukt: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `Zablokowane pliki, które zostaną usunięte przy następnym restarcie: ${a}.`,
        needsAdmin: "Nie udało się zaplanować usunięcia niektórych zablokowanych plików przy restarcie, ponieważ wymaga to uprawnień administratora."
      },
      files: {
        show: (a) => `Pokaż pliki w: ${a}`,
        hide: (a) => `Ukryj pliki w: ${a}`,
        heading: (a, b) => `Najpierw największe pliki: pokazano ${a} z ${b}`,
        biggest: (a) => `Największe: ${a}`
      },
      custom: {
        category: "Własne",
        ruleName: "Własne lokalizacje",
        ruleDescription: "Pliki i foldery dodane przez Ciebie w Ustawieniach.",
        description: "Dodaj do Głębokiego czyszczenia pliki, foldery lub wzorce, takie jak D:\\Games\\Cache\\*.tmp. Pojawią się jako osobna reguła, nigdy domyślnie zaznaczona, i nadal będą respektować Twoje wykluczenia, ochronę ostatnich plików oraz chronione miejsca.",
        ariaLabel: "Lokalizacja do dodania",
        remove: (a) => `Przestań czyścić ${a}`,
        empty: "Brak własnych lokalizacji.",
        error: {
          empty: "Najpierw wpisz ścieżkę.",
          relative: "Wpisz pełną ścieżkę, na przykład D:\\Games\\Cache, lub zacznij od zmiennej, takiej jak %LOCALAPPDATA%.",
          climb: "Ścieżka zawierająca .. jest niedozwolona.",
          protected: "To miejsce chronione (Windows, Program Files, cały dysk lub profil użytkownika).",
          wildcard: "Umieść * niżej, wewnątrz folderu (D:\\Games\\Cache\\*), a nie na szczycie dysku.",
          long: "Ta ścieżka jest za długa.",
          failed: (a) => `Nie udało się zapisać: ${a}`
        }
      },
      imported: {
        title: "Zaimportowane cleanery",
        description: "Zaimportuj plik cleanera BleachBit (.xml). Prune przenosi jego opcje usuwania i dokładnie informuje, co pominął. Zaimportowane reguły nigdy nie są domyślnie zaznaczone i omijają chronione miejsca.",
        button: "Importuj cleaner…",
        empty: "Brak zaimportowanych cleanerów.",
        meta: (a) => `Zaimportowane opcje: ${a}`,
        remove: (a) => `Usuń ${a}`,
        badge: "Zaimportowano",
        reportDone: (a, b, c, d, e) => `Zaimportowano ${a}. Opcje: ${b} zaimportowano, ${c} pominięto. Akcje: ${d} zaimportowano, ${e} pominięto.`,
        reportNothing: (a, b, c) => `Z ${a} nic nie zaimportowano. Pominięte opcje: ${b}. Pominięte akcje: ${c}.`,
        skip: {
          command: (a, b) => `Nieobsługiwane polecenie ${a}: ${b}`,
          search: (a, b) => `Nieobsługiwany typ wyszukiwania ${a}: ${b}`,
          filter: (a, b) => `Akcje z filtrem wyrażenia regularnego: ${b}`,
          os: (a, b) => `Przeznaczone dla innego systemu (${a}): ${b}`,
          variable: (a, b) => `Nieznana zmienna ${a}: ${b}`,
          path: (a, b) => `Nieużyteczne lub niebezpieczne ścieżki: ${b}`
        },
        error: {
          tooLarge: "Ten plik jest zbyt duży jak na cleaner.",
          notXml: "To nie jest prawidłowy XML.",
          notCleaner: "To nie jest plik cleanera BleachBit.",
          noId: "Ten cleaner nie ma identyfikatora.",
          failed: (a) => `Nie udało się zaimportować: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `تړل شوي فایلونه چې په راتلونکي بیا پیلولو کې ړنګیږي: ${a}.`,
        needsAdmin: "ځینې تړل شوي فایلونه د بیا پیلولو پر مهال د ړنګولو لپاره مهال ویش نشول، ځکه چې دا د مدیر حقونه غواړي."
      },
      files: {
        show: (a) => `په ${a} کې فایلونه ښکاره کړئ`,
        hide: (a) => `په ${a} کې فایلونه پټ کړئ`,
        heading: (a, b) => `لوی فایلونه لومړی: ${b} څخه ${a} ښودل کیږي`,
        biggest: (a) => `تر ټولو لوی: ${a}`
      },
      custom: {
        category: "دودیز",
        ruleName: "دودیز ځایونه",
        ruleDescription: "هغه فایلونه او پوښې چې تاسو پخپله په امستنو کې اضافه کړي.",
        description: "فایلونه، پوښې یا نمونې، لکه D:\\Games\\Cache\\*.tmp، ژور پاکولو ته اضافه کړئ. دا د جلا قاعدې په توګه ښکاري، په ډیفالټ نه نښه کیږي، او بیا هم ستاسو استثناوې، د وروستیو فایلونو ساتنه او خوندي ځایونه رعایتوي.",
        ariaLabel: "اضافه کولو لپاره ځای",
        remove: (a) => `د ${a} پاکول ودروئ`,
        empty: "تر اوسه دودیز ځایونه نشته.",
        error: {
          empty: "لومړی یوه لاره ولیکئ.",
          relative: "بشپړه لاره ولیکئ، لکه D:\\Games\\Cache، یا په یوه متغیر لکه %LOCALAPPDATA% پیل کړئ.",
          climb: "هغه لاره چې .. لري اجازه نلري.",
          protected: "دا یو خوندي ځای دی (Windows، Program Files، بشپړ ډرایو یا د کارن پروفایل).",
          wildcard: "د * نښه ښکته کې، په یوه پوښۍ کې (D:\\Games\\Cache\\*) کېږدئ، نه د ډرایو په سر کې.",
          long: "دا لاره ډېره اوږده ده.",
          failed: (a) => `خوندي نشو: ${a}`
        }
      },
      imported: {
        title: "وارد شوي پاکوونکي",
        description: "د BleachBit د پاکوونکي فایل (.xml) وارد کړئ. Prune د هغه د ړنګولو اختیارونه راوړي او تاسو ته دقیقا وايي چې څه یې پریښودل. وارد شوې قاعدې په ډیفالټ نه نښه کیږي او له خوندي ځایونو لرې پاتې کیږي.",
        button: "پاکوونکی وارد کړئ…",
        empty: "هیڅ وارد شوی پاکوونکی نشته.",
        meta: (a) => `وارد شوي اختیارونه: ${a}`,
        remove: (a) => `${a} لرې کړئ`,
        badge: "وارد شوی",
        reportDone: (a, b, c, d, e) => `${a} وارد شو. اختیارونه: ${b} وارد شول، ${c} پریښودل شول. کړنې: ${d} وارد شول، ${e} پریښودل شول.`,
        reportNothing: (a, b, c) => `له ${a} څخه هیڅ شی وارد نشو. پریښودل شوي اختیارونه: ${b}. پریښودل شوې کړنې: ${c}.`,
        skip: {
          command: (a, b) => `نامتمل قومانده ${a}: ${b}`,
          search: (a, b) => `نامتمل د لټون ډول ${a}: ${b}`,
          filter: (a, b) => `هغه کړنې چې د منظم اظهار فلټر لري: ${b}`,
          os: (a, b) => `د بل سیسټم لپاره (${a}): ${b}`,
          variable: (a, b) => `نامعلوم متغیر ${a}: ${b}`,
          path: (a, b) => `نا کارول کیدونکې یا ناامنه لارې: ${b}`
        },
        error: {
          tooLarge: "دا فایل د پاکوونکي لپاره ډېر لوی دی.",
          notXml: "دا معتبر XML نه دی.",
          notCleaner: "دا د BleachBit د پاکوونکي فایل نه دی.",
          noId: "دا پاکوونکی هیڅ id نه لري.",
          failed: (a) => `وارد نشو: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `Arquivos bloqueados que serão excluídos na próxima reinicialização: ${a}.`,
        needsAdmin: "Não foi possível agendar alguns arquivos bloqueados para exclusão na reinicialização, pois isso exige direitos de administrador."
      },
      files: {
        show: (a) => `Mostrar arquivos em ${a}`,
        hide: (a) => `Ocultar arquivos em ${a}`,
        heading: (a, b) => `Maiores arquivos primeiro: mostrando ${a} de ${b}`,
        biggest: (a) => `Maiores: ${a}`
      },
      custom: {
        category: "Personalizado",
        ruleName: "Locais personalizados",
        ruleDescription: "Arquivos e pastas que você mesmo adicionou em Configurações.",
        description: "Adicione à Limpeza profunda arquivos, pastas ou padrões, como D:\\Games\\Cache\\*.tmp. Eles aparecem como uma regra própria, nunca marcada por padrão, e continuam respeitando suas exclusões, a proteção de arquivos recentes e os locais protegidos.",
        ariaLabel: "Local a adicionar",
        remove: (a) => `Parar de limpar ${a}`,
        empty: "Ainda não há locais personalizados.",
        error: {
          empty: "Digite um caminho primeiro.",
          relative: "Escreva um caminho completo, como D:\\Games\\Cache, ou comece com uma variável como %LOCALAPPDATA%.",
          climb: "Não é permitido um caminho com ..",
          protected: "Esse é um local protegido (Windows, Arquivos de Programas, uma unidade inteira ou um perfil de usuário).",
          wildcard: "Coloque o * mais abaixo, dentro de uma pasta (D:\\Games\\Cache\\*), não no topo de uma unidade.",
          long: "Esse caminho é longo demais.",
          failed: (a) => `Não foi possível salvar: ${a}`
        }
      },
      imported: {
        title: "Limpadores importados",
        description: "Importe um arquivo de limpador do BleachBit (.xml). O Prune traz as opções de exclusão e diz exatamente o que foi ignorado. As regras importadas nunca vêm marcadas por padrão e ficam longe dos locais protegidos.",
        button: "Importar limpador…",
        empty: "Nenhum limpador importado.",
        meta: (a) => `Opções importadas: ${a}`,
        remove: (a) => `Remover ${a}`,
        badge: "Importado",
        reportDone: (a, b, c, d, e) => `${a} importado. Opções: ${b} importadas, ${c} ignoradas. Ações: ${d} importadas, ${e} ignoradas.`,
        reportNothing: (a, b, c) => `Nada foi importado de ${a}. Opções ignoradas: ${b}. Ações ignoradas: ${c}.`,
        skip: {
          command: (a, b) => `Comando sem suporte ${a}: ${b}`,
          search: (a, b) => `Tipo de busca sem suporte ${a}: ${b}`,
          filter: (a, b) => `Ações com filtro de expressão regular: ${b}`,
          os: (a, b) => `Feito para outro sistema (${a}): ${b}`,
          variable: (a, b) => `Variável desconhecida ${a}: ${b}`,
          path: (a, b) => `Caminhos inutilizáveis ou inseguros: ${b}`
        },
        error: {
          tooLarge: "Esse arquivo é grande demais para ser um limpador.",
          notXml: "Isso não é um XML válido.",
          notCleaner: "Esse não é um arquivo de limpador do BleachBit.",
          noId: "Esse limpador não tem id.",
          failed: (a) => `Não foi possível importar: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `Ficheiros bloqueados que serão eliminados no próximo reinício: ${a}.`,
        needsAdmin: "Não foi possível agendar alguns ficheiros bloqueados para eliminação no reinício, porque isso exige direitos de administrador."
      },
      files: {
        show: (a) => `Mostrar ficheiros em ${a}`,
        hide: (a) => `Ocultar ficheiros em ${a}`,
        heading: (a, b) => `Maiores ficheiros primeiro: a mostrar ${a} de ${b}`,
        biggest: (a) => `Maiores: ${a}`
      },
      custom: {
        category: "Personalizado",
        ruleName: "Localizações personalizadas",
        ruleDescription: "Ficheiros e pastas que adicionou nas Definições.",
        description: "Adicione à Limpeza profunda ficheiros, pastas ou padrões, como D:\\Games\\Cache\\*.tmp. Aparecem como uma regra própria, nunca assinalada por predefinição, e continuam a respeitar as suas exclusões, a proteção de ficheiros recentes e os locais protegidos.",
        ariaLabel: "Localização a adicionar",
        remove: (a) => `Deixar de limpar ${a}`,
        empty: "Ainda não há localizações personalizadas.",
        error: {
          empty: "Escreva primeiro um caminho.",
          relative: "Escreva um caminho completo, como D:\\Games\\Cache, ou comece com uma variável como %LOCALAPPDATA%.",
          climb: "Não é permitido um caminho com ..",
          protected: "Esse é um local protegido (Windows, Program Files, uma unidade inteira ou um perfil de utilizador).",
          wildcard: "Coloque o * mais abaixo, dentro de uma pasta (D:\\Games\\Cache\\*), não no topo de uma unidade.",
          long: "Esse caminho é demasiado longo.",
          failed: (a) => `Não foi possível guardar: ${a}`
        }
      },
      imported: {
        title: "Limpadores importados",
        description: "Importe um ficheiro de limpador do BleachBit (.xml). O Prune traz as opções de eliminação e diz exatamente o que foi ignorado. As regras importadas nunca vêm assinaladas por predefinição e ficam longe dos locais protegidos.",
        button: "Importar limpador…",
        empty: "Nenhum limpador importado.",
        meta: (a) => `Opções importadas: ${a}`,
        remove: (a) => `Remover ${a}`,
        badge: "Importado",
        reportDone: (a, b, c, d, e) => `${a} importado. Opções: ${b} importadas, ${c} ignoradas. Ações: ${d} importadas, ${e} ignoradas.`,
        reportNothing: (a, b, c) => `Nada foi importado de ${a}. Opções ignoradas: ${b}. Ações ignoradas: ${c}.`,
        skip: {
          command: (a, b) => `Comando não suportado ${a}: ${b}`,
          search: (a, b) => `Tipo de pesquisa não suportado ${a}: ${b}`,
          filter: (a, b) => `Ações com filtro de expressão regular: ${b}`,
          os: (a, b) => `Feito para outro sistema (${a}): ${b}`,
          variable: (a, b) => `Variável desconhecida ${a}: ${b}`,
          path: (a, b) => `Caminhos inutilizáveis ou inseguros: ${b}`
        },
        error: {
          tooLarge: "Esse ficheiro é demasiado grande para ser um limpador.",
          notXml: "Isso não é um XML válido.",
          notCleaner: "Esse não é um ficheiro de limpador do BleachBit.",
          noId: "Esse limpador não tem id.",
          failed: (a) => `Não foi possível importar: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `Fișiere blocate care vor fi șterse la următoarea repornire: ${a}.`,
        needsAdmin: "Unele fișiere blocate nu au putut fi programate pentru ștergere la repornire, deoarece aceasta necesită drepturi de administrator."
      },
      files: {
        show: (a) => `Afișează fișierele din ${a}`,
        hide: (a) => `Ascunde fișierele din ${a}`,
        heading: (a, b) => `Cele mai mari fișiere primele: se afișează ${a} din ${b}`,
        biggest: (a) => `Cele mai mari: ${a}`
      },
      custom: {
        category: "Personalizat",
        ruleName: "Locații personalizate",
        ruleDescription: "Fișiere și foldere pe care le-ai adăugat chiar tu în Setări.",
        description: "Adaugă la Curățarea profundă fișiere, foldere sau modele, cum ar fi D:\\Games\\Cache\\*.tmp. Apar ca o regulă separată, niciodată bifată implicit, și respectă în continuare excluderile tale, protecția fișierelor recente și locurile protejate.",
        ariaLabel: "Locația de adăugat",
        remove: (a) => `Nu mai curăța ${a}`,
        empty: "Încă nu există locații personalizate.",
        error: {
          empty: "Introdu mai întâi o cale.",
          relative: "Scrie o cale completă, cum ar fi D:\\Games\\Cache, sau începe cu o variabilă precum %LOCALAPPDATA%.",
          climb: "O cale care conține .. nu este permisă.",
          protected: "Acesta este un loc protejat (Windows, Program Files, o unitate întreagă sau un profil de utilizator).",
          wildcard: "Pune * mai jos, într-un folder (D:\\Games\\Cache\\*), nu în vârful unei unități.",
          long: "Calea este prea lungă.",
          failed: (a) => `Nu s-a putut salva: ${a}`
        }
      },
      imported: {
        title: "Curățătoare importate",
        description: "Importă un fișier de curățător BleachBit (.xml). Prune preia opțiunile lui de ștergere și îți spune exact ce a omis. Regulile importate nu sunt niciodată bifate implicit și rămân departe de locurile protejate.",
        button: "Importă curățător…",
        empty: "Niciun curățător importat.",
        meta: (a) => `Opțiuni importate: ${a}`,
        remove: (a) => `Elimină ${a}`,
        badge: "Importat",
        reportDone: (a, b, c, d, e) => `${a} importat. Opțiuni: ${b} importate, ${c} omise. Acțiuni: ${d} importate, ${e} omise.`,
        reportNothing: (a, b, c) => `Nu s-a importat nimic din ${a}. Opțiuni omise: ${b}. Acțiuni omise: ${c}.`,
        skip: {
          command: (a, b) => `Comandă neacceptată ${a}: ${b}`,
          search: (a, b) => `Tip de căutare neacceptat ${a}: ${b}`,
          filter: (a, b) => `Acțiuni cu filtru de expresie regulată: ${b}`,
          os: (a, b) => `Destinat altui sistem (${a}): ${b}`,
          variable: (a, b) => `Variabilă necunoscută ${a}: ${b}`,
          path: (a, b) => `Căi inutilizabile sau nesigure: ${b}`
        },
        error: {
          tooLarge: "Fișierul este prea mare pentru a fi un curățător.",
          notXml: "Acesta nu este XML valid.",
          notCleaner: "Acesta nu este un fișier de curățător BleachBit.",
          noId: "Acest curățător nu are id.",
          failed: (a) => `Nu s-a putut importa: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `Заблокированные файлы, которые будут удалены при следующей перезагрузке: ${a}.`,
        needsAdmin: "Некоторые заблокированные файлы не удалось запланировать на удаление при перезагрузке: для этого нужны права администратора."
      },
      files: {
        show: (a) => `Показать файлы: ${a}`,
        hide: (a) => `Скрыть файлы: ${a}`,
        heading: (a, b) => `Сначала самые большие файлы: показано ${a} из ${b}`,
        biggest: (a) => `Самые большие: ${a}`
      },
      custom: {
        category: "Свои",
        ruleName: "Свои расположения",
        ruleDescription: "Файлы и папки, которые вы сами добавили в настройках.",
        description: "Добавляйте в «Глубокую очистку» файлы, папки или шаблоны, например D:\\Games\\Cache\\*.tmp. Они появляются как отдельное правило, никогда не отмечаются по умолчанию и по-прежнему учитывают ваши исключения, защиту недавних файлов и защищённые места.",
        ariaLabel: "Добавляемое расположение",
        remove: (a) => `Больше не очищать ${a}`,
        empty: "Своих расположений пока нет.",
        error: {
          empty: "Сначала введите путь.",
          relative: "Введите полный путь, например D:\\Games\\Cache, или начните с переменной, например %LOCALAPPDATA%.",
          climb: "Путь с .. не допускается.",
          protected: "Это защищённое место (Windows, Program Files, диск целиком или профиль пользователя).",
          wildcard: "Поставьте * ниже, внутри папки (D:\\Games\\Cache\\*), а не в корне диска.",
          long: "Этот путь слишком длинный.",
          failed: (a) => `Не удалось сохранить: ${a}`
        }
      },
      imported: {
        title: "Импортированные очистители",
        description: "Импортируйте файл очистителя BleachBit (.xml). Prune переносит его параметры удаления и точно сообщает, что было пропущено. Импортированные правила никогда не отмечаются по умолчанию и не затрагивают защищённые места.",
        button: "Импортировать очиститель…",
        empty: "Импортированных очистителей нет.",
        meta: (a) => `Импортировано параметров: ${a}`,
        remove: (a) => `Удалить ${a}`,
        badge: "Импорт",
        reportDone: (a, b, c, d, e) => `Импортировано: ${a}. Параметры: импортировано ${b}, пропущено ${c}. Действия: импортировано ${d}, пропущено ${e}.`,
        reportNothing: (a, b, c) => `Из ${a} ничего не импортировано. Пропущено параметров: ${b}. Пропущено действий: ${c}.`,
        skip: {
          command: (a, b) => `Неподдерживаемая команда ${a}: ${b}`,
          search: (a, b) => `Неподдерживаемый тип поиска ${a}: ${b}`,
          filter: (a, b) => `Действия с фильтром по регулярному выражению: ${b}`,
          os: (a, b) => `Предназначено для другой системы (${a}): ${b}`,
          variable: (a, b) => `Неизвестная переменная ${a}: ${b}`,
          path: (a, b) => `Непригодные или небезопасные пути: ${b}`
        },
        error: {
          tooLarge: "Этот файл слишком велик для очистителя.",
          notXml: "Это не корректный XML.",
          notCleaner: "Это не файл очистителя BleachBit.",
          noId: "У этого очистителя нет id.",
          failed: (a) => `Не удалось импортировать: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `Uzamknuté súbory, ktoré sa odstránia pri najbližšom reštarte: ${a}.`,
        needsAdmin: "Niektoré uzamknuté súbory sa nepodarilo naplánovať na odstránenie pri reštarte, pretože to vyžaduje oprávnenia správcu."
      },
      files: {
        show: (a) => `Zobraziť súbory v ${a}`,
        hide: (a) => `Skryť súbory v ${a}`,
        heading: (a, b) => `Najväčšie súbory ako prvé: zobrazených ${a} z ${b}`,
        biggest: (a) => `Najväčšie: ${a}`
      },
      custom: {
        category: "Vlastné",
        ruleName: "Vlastné umiestnenia",
        ruleDescription: "Súbory a priečinky, ktoré ste si sami pridali v Nastaveniach.",
        description: "Pridajte do Hĺbkového čistenia súbory, priečinky alebo vzory, napríklad D:\\Games\\Cache\\*.tmp. Zobrazia sa ako samostatné pravidlo, ktoré nie je predvolene zaškrtnuté a stále rešpektuje vaše výnimky, ochranu nedávnych súborov a chránené miesta.",
        ariaLabel: "Umiestnenie na pridanie",
        remove: (a) => `Prestať čistiť ${a}`,
        empty: "Zatiaľ žiadne vlastné umiestnenia.",
        error: {
          empty: "Najprv zadajte cestu.",
          relative: "Zadajte úplnú cestu, napríklad D:\\Games\\Cache, alebo začnite premennou ako %LOCALAPPDATA%.",
          climb: "Cesta obsahujúca .. nie je povolená.",
          protected: "Toto je chránené miesto (Windows, Program Files, celý disk alebo používateľský profil).",
          wildcard: "Dajte * nižšie, do priečinka (D:\\Games\\Cache\\*), nie na začiatok disku.",
          long: "Táto cesta je príliš dlhá.",
          failed: (a) => `Nepodarilo sa uložiť: ${a}`
        }
      },
      imported: {
        title: "Importované čističe",
        description: "Importujte súbor čističa BleachBit (.xml). Prune prevezme jeho možnosti odstraňovania a presne vám povie, čo preskočil. Importované pravidlá nie sú predvolene zaškrtnuté a nesiahajú na chránené miesta.",
        button: "Importovať čistič…",
        empty: "Žiadne importované čističe.",
        meta: (a) => `Importované možnosti: ${a}`,
        remove: (a) => `Odstrániť ${a}`,
        badge: "Importované",
        reportDone: (a, b, c, d, e) => `Importované: ${a}. Možnosti: ${b} importovaných, ${c} preskočených. Akcie: ${d} importovaných, ${e} preskočených.`,
        reportNothing: (a, b, c) => `Z ${a} sa nič neimportovalo. Preskočené možnosti: ${b}. Preskočené akcie: ${c}.`,
        skip: {
          command: (a, b) => `Nepodporovaný príkaz ${a}: ${b}`,
          search: (a, b) => `Nepodporovaný typ vyhľadávania ${a}: ${b}`,
          filter: (a, b) => `Akcie s filtrom regulárneho výrazu: ${b}`,
          os: (a, b) => `Určené pre iný systém (${a}): ${b}`,
          variable: (a, b) => `Neznáma premenná ${a}: ${b}`,
          path: (a, b) => `Nepoužiteľné alebo nebezpečné cesty: ${b}`
        },
        error: {
          tooLarge: "Tento súbor je príliš veľký na to, aby bol čističom.",
          notXml: "Toto nie je platný XML.",
          notCleaner: "Toto nie je súbor čističa BleachBit.",
          noId: "Tento čistič nemá žiadne id.",
          failed: (a) => `Nepodarilo sa importovať: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `Skedarë të bllokuar që do të fshihen në rinisjen tjetër: ${a}.`,
        needsAdmin: "Disa skedarë të bllokuar nuk mund të planifikoheshin për fshirje gjatë rinisjes, sepse kjo kërkon të drejta administratori."
      },
      files: {
        show: (a) => `Shfaq skedarët në ${a}`,
        hide: (a) => `Fshih skedarët në ${a}`,
        heading: (a, b) => `Skedarët më të mëdhenj së pari: po shfaqen ${a} nga ${b}`,
        biggest: (a) => `Më të mëdhenjtë: ${a}`
      },
      custom: {
        category: "Të personalizuara",
        ruleName: "Vende të personalizuara",
        ruleDescription: "Skedarë dhe dosje që ke shtuar vetë te Cilësimet.",
        description: "Shto te Pastrimi i thellë skedarë, dosje ose modele, si D:\\Games\\Cache\\*.tmp. Shfaqen si një rregull më vete, kurrë të shënuar si parazgjedhje, dhe respektojnë përjashtimet e tua, mbrojtjen e skedarëve të fundit dhe vendet e mbrojtura.",
        ariaLabel: "Vendndodhja për t’u shtuar",
        remove: (a) => `Mos e pastro më ${a}`,
        empty: "Ende nuk ka vende të personalizuara.",
        error: {
          empty: "Shkruaj fillimisht një shteg.",
          relative: "Shkruaj një shteg të plotë, si D:\\Games\\Cache, ose fillo me një ndryshore si %LOCALAPPDATA%.",
          climb: "Një shteg me .. nuk lejohet.",
          protected: "Ky është një vend i mbrojtur (Windows, Program Files, një disk i tërë ose një profil përdoruesi).",
          wildcard: "Vendose * më poshtë, brenda një dosjeje (D:\\Games\\Cache\\*), jo në krye të një disku.",
          long: "Ai shteg është shumë i gjatë.",
          failed: (a) => `Nuk u ruajt dot: ${a}`
        }
      },
      imported: {
        title: "Pastrues të importuar",
        description: "Importo një skedar pastruesi BleachBit (.xml). Prune sjell opsionet e tij të fshirjes dhe të tregon saktësisht çfarë anashkaloi. Rregullat e importuara nuk shënohen kurrë si parazgjedhje dhe qëndrojnë larg vendeve të mbrojtura.",
        button: "Importo pastrues…",
        empty: "Asnjë pastrues i importuar.",
        meta: (a) => `Opsione të importuara: ${a}`,
        remove: (a) => `Hiq ${a}`,
        badge: "Importuar",
        reportDone: (a, b, c, d, e) => `${a} u importua. Opsione: ${b} të importuara, ${c} të anashkaluara. Veprime: ${d} të importuara, ${e} të anashkaluara.`,
        reportNothing: (a, b, c) => `Nuk u importua asgjë nga ${a}. Opsione të anashkaluara: ${b}. Veprime të anashkaluara: ${c}.`,
        skip: {
          command: (a, b) => `Komandë e pambështetur ${a}: ${b}`,
          search: (a, b) => `Lloj kërkimi i pambështetur ${a}: ${b}`,
          filter: (a, b) => `Veprime me filtër shprehjeje të rregullt: ${b}`,
          os: (a, b) => `I menduar për një sistem tjetër (${a}): ${b}`,
          variable: (a, b) => `Ndryshore e panjohur ${a}: ${b}`,
          path: (a, b) => `Shtigje të papërdorshme ose të pasigurta: ${b}`
        },
        error: {
          tooLarge: "Ai skedar është shumë i madh për të qenë pastrues.",
          notXml: "Ky nuk është XML i vlefshëm.",
          notCleaner: "Ky nuk është skedar pastruesi BleachBit.",
          noId: "Ai pastrues nuk ka id.",
          failed: (a) => `Nuk u importua dot: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `Закључане датотеке које ће бити обрисане при следећем поновном покретању: ${a}.`,
        needsAdmin: "Неке закључане датотеке није било могуће заказати за брисање при поновном покретању, јер је за то потребно администраторско право."
      },
      files: {
        show: (a) => `Прикажи датотеке у ${a}`,
        hide: (a) => `Сакриј датотеке у ${a}`,
        heading: (a, b) => `Прво највеће датотеке: приказано ${a} од ${b}`,
        biggest: (a) => `Највеће: ${a}`
      },
      custom: {
        category: "Прилагођено",
        ruleName: "Прилагођене локације",
        ruleDescription: "Датотеке и фасцикле које сте сами додали у Подешавањима.",
        description: "Додајте у Дубоко чишћење датотеке, фасцикле или обрасце, као што је D:\\Games\\Cache\\*.tmp. Појављују се као засебно правило, никад подразумевано означено, и и даље поштују ваше изузетке, заштиту недавних датотека и заштићена места.",
        ariaLabel: "Локација за додавање",
        remove: (a) => `Престани да чистиш ${a}`,
        empty: "Још нема прилагођених локација.",
        error: {
          empty: "Прво унесите путању.",
          relative: "Упишите пуну путању, на пример D:\\Games\\Cache, или почните променљивом као што је %LOCALAPPDATA%.",
          climb: "Путања која садржи .. није дозвољена.",
          protected: "Ово је заштићено место (Windows, Program Files, цео диск или кориснички профил).",
          wildcard: "Ставите * ниже, унутар фасцикле (D:\\Games\\Cache\\*), а не на врх диска.",
          long: "Та путања је предугачка.",
          failed: (a) => `Није могло да се сачува: ${a}`
        }
      },
      imported: {
        title: "Увезени чистачи",
        description: "Увезите датотеку чистача BleachBit (.xml). Prune преузима његове опције брисања и тачно вам каже шта је прескочио. Увезена правила никад нису подразумевано означена и остају ван заштићених места.",
        button: "Увези чистач…",
        empty: "Нема увезених чистача.",
        meta: (a) => `Увезене опције: ${a}`,
        remove: (a) => `Уклони ${a}`,
        badge: "Увезено",
        reportDone: (a, b, c, d, e) => `${a} је увезен. Опције: ${b} увезено, ${c} прескочено. Радње: ${d} увезено, ${e} прескочено.`,
        reportNothing: (a, b, c) => `Из ${a} ништа није увезено. Прескочене опције: ${b}. Прескочене радње: ${c}.`,
        skip: {
          command: (a, b) => `Неподржана команда ${a}: ${b}`,
          search: (a, b) => `Неподржана врста претраге ${a}: ${b}`,
          filter: (a, b) => `Радње са филтером регуларног израза: ${b}`,
          os: (a, b) => `Намењено другом систему (${a}): ${b}`,
          variable: (a, b) => `Непозната променљива ${a}: ${b}`,
          path: (a, b) => `Неупотребљиве или небезбедне путање: ${b}`
        },
        error: {
          tooLarge: "Та датотека је превелика да би била чистач.",
          notXml: "Ово није исправан XML.",
          notCleaner: "Ово није датотека чистача BleachBit.",
          noId: "Тај чистач нема id.",
          failed: (a) => `Није могло да се увезе: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `Låsta filer som raderas vid nästa omstart: ${a}.`,
        needsAdmin: "Vissa låsta filer kunde inte schemaläggas för radering vid omstart, eftersom det kräver administratörsbehörighet."
      },
      files: {
        show: (a) => `Visa filer i ${a}`,
        hide: (a) => `Dölj filer i ${a}`,
        heading: (a, b) => `Största filerna först: visar ${a} av ${b}`,
        biggest: (a) => `Störst: ${a}`
      },
      custom: {
        category: "Egna",
        ruleName: "Egna platser",
        ruleDescription: "Filer och mappar som du själv har lagt till i Inställningar.",
        description: "Lägg till filer, mappar eller mönster, till exempel D:\\Games\\Cache\\*.tmp, i Grundlig rensning. De visas som en egen regel, är aldrig förbockade som standard och respekterar fortfarande dina undantag, skyddet för nyligen ändrade filer och de skyddade platserna.",
        ariaLabel: "Plats att lägga till",
        remove: (a) => `Sluta rensa ${a}`,
        empty: "Inga egna platser ännu.",
        error: {
          empty: "Skriv först en sökväg.",
          relative: "Skriv en fullständig sökväg, till exempel D:\\Games\\Cache, eller börja med en variabel som %LOCALAPPDATA%.",
          climb: "En sökväg med .. är inte tillåten.",
          protected: "Det här är en skyddad plats (Windows, Program Files, en hel enhet eller en användarprofil).",
          wildcard: "Sätt * längre ner, inuti en mapp (D:\\Games\\Cache\\*), inte överst på en enhet.",
          long: "Sökvägen är för lång.",
          failed: (a) => `Det gick inte att spara: ${a}`
        }
      },
      imported: {
        title: "Importerade rensare",
        description: "Importera en BleachBit-rensarfil (.xml). Prune tar över dess raderingsalternativ och berättar exakt vad som hoppades över. Importerade regler är aldrig förbockade som standard och håller sig borta från skyddade platser.",
        button: "Importera rensare…",
        empty: "Inga importerade rensare.",
        meta: (a) => `Importerade alternativ: ${a}`,
        remove: (a) => `Ta bort ${a}`,
        badge: "Importerad",
        reportDone: (a, b, c, d, e) => `${a} importerad. Alternativ: ${b} importerade, ${c} överhoppade. Åtgärder: ${d} importerade, ${e} överhoppade.`,
        reportNothing: (a, b, c) => `Inget importerades från ${a}. Överhoppade alternativ: ${b}. Överhoppade åtgärder: ${c}.`,
        skip: {
          command: (a, b) => `Kommando som inte stöds ${a}: ${b}`,
          search: (a, b) => `Söktyp som inte stöds ${a}: ${b}`,
          filter: (a, b) => `Åtgärder med ett reguljärt uttryck som filter: ${b}`,
          os: (a, b) => `Avsett för ett annat system (${a}): ${b}`,
          variable: (a, b) => `Okänd variabel ${a}: ${b}`,
          path: (a, b) => `Oanvändbara eller osäkra sökvägar: ${b}`
        },
        error: {
          tooLarge: "Filen är för stor för att vara en rensare.",
          notXml: "Det är inte giltig XML.",
          notCleaner: "Det är inte en BleachBit-rensarfil.",
          noId: "Den rensaren har inget id.",
          failed: (a) => `Det gick inte att importera: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `ไฟล์ที่ถูกล็อกซึ่งจะถูกลบเมื่อรีสตาร์ตครั้งถัดไป: ${a}`,
        needsAdmin: "ไม่สามารถตั้งเวลาลบไฟล์ที่ถูกล็อกบางไฟล์เมื่อรีสตาร์ตได้ เพราะต้องใช้สิทธิ์ผู้ดูแลระบบ"
      },
      files: {
        show: (a) => `แสดงไฟล์ใน ${a}`,
        hide: (a) => `ซ่อนไฟล์ใน ${a}`,
        heading: (a, b) => `ไฟล์ใหญ่สุดก่อน: แสดง ${a} จาก ${b}`,
        biggest: (a) => `ใหญ่สุด: ${a}`
      },
      custom: {
        category: "กำหนดเอง",
        ruleName: "ตำแหน่งที่กำหนดเอง",
        ruleDescription: "ไฟล์และโฟลเดอร์ที่คุณเพิ่มเองในการตั้งค่า",
        description: "เพิ่มไฟล์ โฟลเดอร์ หรือรูปแบบ เช่น D:\\Games\\Cache\\*.tmp ลงในการทำความสะอาดเชิงลึก รายการเหล่านี้จะแสดงเป็นกฎของตัวเอง ไม่ถูกเลือกโดยค่าเริ่มต้น และยังคงเคารพข้อยกเว้นของคุณ การป้องกันไฟล์ล่าสุด และตำแหน่งที่ได้รับการป้องกัน",
        ariaLabel: "ตำแหน่งที่จะเพิ่ม",
        remove: (a) => `เลิกทำความสะอาด ${a}`,
        empty: "ยังไม่มีตำแหน่งที่กำหนดเอง",
        error: {
          empty: "พิมพ์พาธก่อน",
          relative: "เขียนพาธแบบเต็ม เช่น D:\\Games\\Cache หรือขึ้นต้นด้วยตัวแปร เช่น %LOCALAPPDATA%",
          climb: "ไม่อนุญาตพาธที่มี ..",
          protected: "นี่เป็นตำแหน่งที่ได้รับการป้องกัน (Windows, Program Files, ไดรฟ์ทั้งไดรฟ์ หรือโปรไฟล์ผู้ใช้)",
          wildcard: "ใส่ * ในระดับที่ลึกลงไป ภายในโฟลเดอร์ (D:\\Games\\Cache\\*) ไม่ใช่ที่ระดับบนสุดของไดรฟ์",
          long: "พาธนั้นยาวเกินไป",
          failed: (a) => `บันทึกไม่ได้: ${a}`
        }
      },
      imported: {
        title: "เครื่องมือล้างข้อมูลที่นำเข้า",
        description: "นำเข้าไฟล์เครื่องมือล้างข้อมูลของ BleachBit (.xml) Prune จะนำตัวเลือกการลบมา และบอกคุณอย่างชัดเจนว่าข้ามอะไรไป กฎที่นำเข้าจะไม่ถูกเลือกโดยค่าเริ่มต้น และอยู่ห่างจากตำแหน่งที่ได้รับการป้องกัน",
        button: "นำเข้าเครื่องมือล้างข้อมูล…",
        empty: "ไม่มีเครื่องมือล้างข้อมูลที่นำเข้า",
        meta: (a) => `ตัวเลือกที่นำเข้า: ${a}`,
        remove: (a) => `เอา ${a} ออก`,
        badge: "นำเข้า",
        reportDone: (a, b, c, d, e) => `นำเข้า ${a} แล้ว ตัวเลือก: นำเข้า ${b} ข้าม ${c} การกระทำ: นำเข้า ${d} ข้าม ${e}`,
        reportNothing: (a, b, c) => `ไม่มีอะไรถูกนำเข้าจาก ${a} ตัวเลือกที่ข้าม: ${b} การกระทำที่ข้าม: ${c}`,
        skip: {
          command: (a, b) => `คำสั่งที่ไม่รองรับ ${a}: ${b}`,
          search: (a, b) => `ประเภทการค้นหาที่ไม่รองรับ ${a}: ${b}`,
          filter: (a, b) => `การกระทำที่มีตัวกรองนิพจน์ปกติ: ${b}`,
          os: (a, b) => `สำหรับระบบอื่น (${a}): ${b}`,
          variable: (a, b) => `ตัวแปรที่ไม่รู้จัก ${a}: ${b}`,
          path: (a, b) => `พาธที่ใช้ไม่ได้หรือไม่ปลอดภัย: ${b}`
        },
        error: {
          tooLarge: "ไฟล์นั้นใหญ่เกินกว่าจะเป็นเครื่องมือล้างข้อมูล",
          notXml: "นั่นไม่ใช่ XML ที่ถูกต้อง",
          notCleaner: "นั่นไม่ใช่ไฟล์เครื่องมือล้างข้อมูลของ BleachBit",
          noId: "เครื่องมือล้างข้อมูลนั้นไม่มี id",
          failed: (a) => `นำเข้าไม่ได้: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `Bir sonraki yeniden başlatmada silinecek kilitli dosyalar: ${a}.`,
        needsAdmin: "Bazı kilitli dosyalar yeniden başlatmada silinmek üzere zamanlanamadı, çünkü bunun için yönetici hakları gerekir."
      },
      files: {
        show: (a) => `${a} içindeki dosyaları göster`,
        hide: (a) => `${a} içindeki dosyaları gizle`,
        heading: (a, b) => `Önce en büyük dosyalar: ${b} içinden ${a} gösteriliyor`,
        biggest: (a) => `En büyükler: ${a}`
      },
      custom: {
        category: "Özel",
        ruleName: "Özel konumlar",
        ruleDescription: "Ayarlar'da kendinizin eklediği dosya ve klasörler.",
        description: "Derin Temizlik'e D:\\Games\\Cache\\*.tmp gibi dosyalar, klasörler veya desenler ekleyin. Kendi başına bir kural olarak görünür, varsayılan olarak asla işaretlenmez ve istisnalarınıza, son dosyaları koruma önlemine ve korunan yerlere saygı göstermeye devam eder.",
        ariaLabel: "Eklenecek konum",
        remove: (a) => `${a} temizliğini bırak`,
        empty: "Henüz özel konum yok.",
        error: {
          empty: "Önce bir yol yazın.",
          relative: "D:\\Games\\Cache gibi tam bir yol yazın veya %LOCALAPPDATA% gibi bir değişkenle başlayın.",
          climb: "İçinde .. bulunan bir yola izin verilmez.",
          protected: "Burası korunan bir yer (Windows, Program Files, tüm bir sürücü veya bir kullanıcı profili).",
          wildcard: "* karakterini bir sürücünün en üstüne değil, bir klasörün içine (D:\\Games\\Cache\\*) koyun.",
          long: "Bu yol çok uzun.",
          failed: (a) => `Kaydedilemedi: ${a}`
        }
      },
      imported: {
        title: "İçe aktarılan temizleyiciler",
        description: "Bir BleachBit temizleyici dosyasını (.xml) içe aktarın. Prune silme seçeneklerini getirir ve nelerin atlandığını size tam olarak söyler. İçe aktarılan kurallar varsayılan olarak asla işaretlenmez ve korunan yerlerden uzak durur.",
        button: "Temizleyici içe aktar…",
        empty: "İçe aktarılmış temizleyici yok.",
        meta: (a) => `İçe aktarılan seçenekler: ${a}`,
        remove: (a) => `${a} öğesini kaldır`,
        badge: "İçe aktarıldı",
        reportDone: (a, b, c, d, e) => `${a} içe aktarıldı. Seçenekler: ${b} içe aktarıldı, ${c} atlandı. Eylemler: ${d} içe aktarıldı, ${e} atlandı.`,
        reportNothing: (a, b, c) => `${a} dosyasından hiçbir şey içe aktarılmadı. Atlanan seçenekler: ${b}. Atlanan eylemler: ${c}.`,
        skip: {
          command: (a, b) => `Desteklenmeyen komut ${a}: ${b}`,
          search: (a, b) => `Desteklenmeyen arama türü ${a}: ${b}`,
          filter: (a, b) => `Düzenli ifade filtresi olan eylemler: ${b}`,
          os: (a, b) => `Başka bir sistem için (${a}): ${b}`,
          variable: (a, b) => `Bilinmeyen değişken ${a}: ${b}`,
          path: (a, b) => `Kullanılamaz veya güvensiz yollar: ${b}`
        },
        error: {
          tooLarge: "Bu dosya bir temizleyici olamayacak kadar büyük.",
          notXml: "Bu geçerli bir XML değil.",
          notCleaner: "Bu bir BleachBit temizleyici dosyası değil.",
          noId: "Bu temizleyicinin kimliği yok.",
          failed: (a) => `İçe aktarılamadı: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `Заблоковані файли, які буде видалено під час наступного перезавантаження: ${a}.`,
        needsAdmin: "Деякі заблоковані файли не вдалося запланувати на видалення під час перезавантаження, бо для цього потрібні права адміністратора."
      },
      files: {
        show: (a) => `Показати файли: ${a}`,
        hide: (a) => `Сховати файли: ${a}`,
        heading: (a, b) => `Спочатку найбільші файли: показано ${a} із ${b}`,
        biggest: (a) => `Найбільші: ${a}`
      },
      custom: {
        category: "Власні",
        ruleName: "Власні розташування",
        ruleDescription: "Файли й теки, які ви самі додали в налаштуваннях.",
        description: "Додайте до «Глибокого очищення» файли, теки або шаблони, наприклад D:\\Games\\Cache\\*.tmp. Вони з'являються як окреме правило, ніколи не позначаються за замовчуванням і, як і раніше, враховують ваші винятки, захист нещодавніх файлів і захищені місця.",
        ariaLabel: "Розташування для додавання",
        remove: (a) => `Більше не очищати ${a}`,
        empty: "Власних розташувань поки немає.",
        error: {
          empty: "Спершу введіть шлях.",
          relative: "Введіть повний шлях, наприклад D:\\Games\\Cache, або почніть зі змінної, як-от %LOCALAPPDATA%.",
          climb: "Шлях із .. не допускається.",
          protected: "Це захищене місце (Windows, Program Files, диск цілком або профіль користувача).",
          wildcard: "Поставте * нижче, всередині теки (D:\\Games\\Cache\\*), а не в корені диска.",
          long: "Цей шлях задовгий.",
          failed: (a) => `Не вдалося зберегти: ${a}`
        }
      },
      imported: {
        title: "Імпортовані очисники",
        description: "Імпортуйте файл очисника BleachBit (.xml). Prune переносить його параметри видалення й точно повідомляє, що було пропущено. Імпортовані правила ніколи не позначаються за замовчуванням і не зачіпають захищені місця.",
        button: "Імпортувати очисник…",
        empty: "Імпортованих очисників немає.",
        meta: (a) => `Імпортовано параметрів: ${a}`,
        remove: (a) => `Вилучити ${a}`,
        badge: "Імпорт",
        reportDone: (a, b, c, d, e) => `Імпортовано: ${a}. Параметри: імпортовано ${b}, пропущено ${c}. Дії: імпортовано ${d}, пропущено ${e}.`,
        reportNothing: (a, b, c) => `З ${a} нічого не імпортовано. Пропущено параметрів: ${b}. Пропущено дій: ${c}.`,
        skip: {
          command: (a, b) => `Непідтримувана команда ${a}: ${b}`,
          search: (a, b) => `Непідтримуваний тип пошуку ${a}: ${b}`,
          filter: (a, b) => `Дії з фільтром за регулярним виразом: ${b}`,
          os: (a, b) => `Призначено для іншої системи (${a}): ${b}`,
          variable: (a, b) => `Невідома змінна ${a}: ${b}`,
          path: (a, b) => `Непридатні або небезпечні шляхи: ${b}`
        },
        error: {
          tooLarge: "Цей файл завеликий для очисника.",
          notXml: "Це не коректний XML.",
          notCleaner: "Це не файл очисника BleachBit.",
          noId: "У цього очисника немає id.",
          failed: (a) => `Не вдалося імпортувати: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `Các tệp bị khóa sẽ bị xóa ở lần khởi động lại tiếp theo: ${a}.`,
        needsAdmin: "Không thể lên lịch xóa một số tệp bị khóa khi khởi động lại, vì việc đó cần quyền quản trị viên."
      },
      files: {
        show: (a) => `Hiện các tệp trong ${a}`,
        hide: (a) => `Ẩn các tệp trong ${a}`,
        heading: (a, b) => `Tệp lớn nhất trước: hiển thị ${a} trên ${b}`,
        biggest: (a) => `Lớn nhất: ${a}`
      },
      custom: {
        category: "Tùy chỉnh",
        ruleName: "Vị trí tùy chỉnh",
        ruleDescription: "Các tệp và thư mục bạn tự thêm trong Cài đặt.",
        description: "Thêm tệp, thư mục hoặc mẫu, chẳng hạn D:\\Games\\Cache\\*.tmp, vào Dọn dẹp sâu. Chúng xuất hiện như một quy tắc riêng, không bao giờ được chọn mặc định, và vẫn tôn trọng các ngoại lệ của bạn, cơ chế bảo vệ tệp gần đây và các vị trí được bảo vệ.",
        ariaLabel: "Vị trí cần thêm",
        remove: (a) => `Ngừng dọn ${a}`,
        empty: "Chưa có vị trí tùy chỉnh.",
        error: {
          empty: "Hãy nhập đường dẫn trước.",
          relative: "Hãy viết đường dẫn đầy đủ, chẳng hạn D:\\Games\\Cache, hoặc bắt đầu bằng một biến như %LOCALAPPDATA%.",
          climb: "Không cho phép đường dẫn có chứa ..",
          protected: "Đó là vị trí được bảo vệ (Windows, Program Files, cả ổ đĩa hoặc hồ sơ người dùng).",
          wildcard: "Hãy đặt dấu * sâu hơn, bên trong một thư mục (D:\\Games\\Cache\\*), không phải ở đầu ổ đĩa.",
          long: "Đường dẫn đó quá dài.",
          failed: (a) => `Không thể lưu: ${a}`
        }
      },
      imported: {
        title: "Trình dọn dẹp đã nhập",
        description: "Nhập một tệp trình dọn dẹp BleachBit (.xml). Prune đưa các tùy chọn xóa của nó vào và cho bạn biết chính xác những gì đã bị bỏ qua. Các quy tắc đã nhập không bao giờ được chọn mặc định và tránh xa các vị trí được bảo vệ.",
        button: "Nhập trình dọn dẹp…",
        empty: "Chưa có trình dọn dẹp nào được nhập.",
        meta: (a) => `Tùy chọn đã nhập: ${a}`,
        remove: (a) => `Xóa ${a}`,
        badge: "Đã nhập",
        reportDone: (a, b, c, d, e) => `Đã nhập ${a}. Tùy chọn: nhập ${b}, bỏ qua ${c}. Hành động: nhập ${d}, bỏ qua ${e}.`,
        reportNothing: (a, b, c) => `Không có gì được nhập từ ${a}. Tùy chọn bị bỏ qua: ${b}. Hành động bị bỏ qua: ${c}.`,
        skip: {
          command: (a, b) => `Lệnh không được hỗ trợ ${a}: ${b}`,
          search: (a, b) => `Kiểu tìm kiếm không được hỗ trợ ${a}: ${b}`,
          filter: (a, b) => `Hành động có bộ lọc biểu thức chính quy: ${b}`,
          os: (a, b) => `Dành cho hệ thống khác (${a}): ${b}`,
          variable: (a, b) => `Biến không xác định ${a}: ${b}`,
          path: (a, b) => `Đường dẫn không dùng được hoặc không an toàn: ${b}`
        },
        error: {
          tooLarge: "Tệp đó quá lớn để là một trình dọn dẹp.",
          notXml: "Đó không phải là XML hợp lệ.",
          notCleaner: "Đó không phải là tệp trình dọn dẹp BleachBit.",
          noId: "Trình dọn dẹp đó không có id.",
          failed: (a) => `Không thể nhập: ${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `将在下次重启时删除的被锁定文件：${a}。`,
        needsAdmin: "部分被锁定的文件无法安排在重启时删除，因为这需要管理员权限。"
      },
      files: {
        show: (a) => `显示 ${a} 中的文件`,
        hide: (a) => `隐藏 ${a} 中的文件`,
        heading: (a, b) => `按大小降序：显示 ${b} 个中的 ${a} 个`,
        biggest: (a) => `最大：${a}`
      },
      custom: {
        category: "自定义",
        ruleName: "自定义位置",
        ruleDescription: "你在“设置”中自行添加的文件和文件夹。",
        description: "将文件、文件夹或模式（如 D:\\Games\\Cache\\*.tmp）添加到深度清理。它们会作为独立规则出现，默认永不勾选，并且仍会遵守你的排除项、近期文件保护和受保护的位置。",
        ariaLabel: "要添加的位置",
        remove: (a) => `不再清理 ${a}`,
        empty: "尚无自定义位置。",
        error: {
          empty: "请先输入路径。",
          relative: "请写完整路径，例如 D:\\Games\\Cache，或以 %LOCALAPPDATA% 这样的变量开头。",
          climb: "不允许包含 .. 的路径。",
          protected: "这是受保护的位置（Windows、Program Files、整个驱动器或用户配置文件）。",
          wildcard: "请把 * 放在更深的位置，即文件夹内部（D:\\Games\\Cache\\*），不要放在驱动器顶层。",
          long: "该路径太长。",
          failed: (a) => `无法保存：${a}`
        }
      },
      imported: {
        title: "已导入的清理器",
        description: "导入 BleachBit 清理器文件（.xml）。Prune 会带入其中的删除选项，并准确告诉你跳过了什么。导入的规则默认永不勾选，并且不会触及受保护的位置。",
        button: "导入清理器…",
        empty: "没有已导入的清理器。",
        meta: (a) => `已导入的选项：${a}`,
        remove: (a) => `移除 ${a}`,
        badge: "已导入",
        reportDone: (a, b, c, d, e) => `已导入 ${a}。选项：导入 ${b} 个，跳过 ${c} 个。操作：导入 ${d} 个，跳过 ${e} 个。`,
        reportNothing: (a, b, c) => `未从 ${a} 导入任何内容。跳过的选项：${b} 个。跳过的操作：${c} 个。`,
        skip: {
          command: (a, b) => `不支持的命令 ${a}：${b}`,
          search: (a, b) => `不支持的搜索类型 ${a}：${b}`,
          filter: (a, b) => `带正则表达式筛选器的操作：${b}`,
          os: (a, b) => `适用于其他系统（${a}）：${b}`,
          variable: (a, b) => `未知变量 ${a}：${b}`,
          path: (a, b) => `无法使用或不安全的路径：${b}`
        },
        error: {
          tooLarge: "该文件太大，不可能是清理器。",
          notXml: "这不是有效的 XML。",
          notCleaner: "这不是 BleachBit 清理器文件。",
          noId: "该清理器没有 id。",
          failed: (a) => `无法导入：${a}`
        }
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
      },
      locked: {
        scheduled: (a) => `將在下次重新啟動時刪除的被鎖定檔案：${a}。`,
        needsAdmin: "部分被鎖定的檔案無法安排在重新啟動時刪除，因為這需要系統管理員權限。"
      },
      files: {
        show: (a) => `顯示 ${a} 中的檔案`,
        hide: (a) => `隱藏 ${a} 中的檔案`,
        heading: (a, b) => `依大小遞減：顯示 ${b} 個中的 ${a} 個`,
        biggest: (a) => `最大：${a}`
      },
      custom: {
        category: "自訂",
        ruleName: "自訂位置",
        ruleDescription: "你在「設定」中自行新增的檔案和資料夾。",
        description: "將檔案、資料夾或模式（如 D:\\Games\\Cache\\*.tmp）加入深度清理。它們會以獨立規則顯示，預設永不勾選，並且仍會遵守你的排除項目、近期檔案保護和受保護的位置。",
        ariaLabel: "要新增的位置",
        remove: (a) => `不再清理 ${a}`,
        empty: "尚無自訂位置。",
        error: {
          empty: "請先輸入路徑。",
          relative: "請寫完整路徑，例如 D:\\Games\\Cache，或以 %LOCALAPPDATA% 這樣的變數開頭。",
          climb: "不允許包含 .. 的路徑。",
          protected: "這是受保護的位置（Windows、Program Files、整個磁碟機或使用者設定檔）。",
          wildcard: "請把 * 放在更深的位置，也就是資料夾內部（D:\\Games\\Cache\\*），不要放在磁碟機頂層。",
          long: "該路徑太長。",
          failed: (a) => `無法儲存：${a}`
        }
      },
      imported: {
        title: "已匯入的清理器",
        description: "匯入 BleachBit 清理器檔案（.xml）。Prune 會帶入其中的刪除選項，並準確告訴你略過了什麼。匯入的規則預設永不勾選，並且不會觸及受保護的位置。",
        button: "匯入清理器…",
        empty: "沒有已匯入的清理器。",
        meta: (a) => `已匯入的選項：${a}`,
        remove: (a) => `移除 ${a}`,
        badge: "已匯入",
        reportDone: (a, b, c, d, e) => `已匯入 ${a}。選項：匯入 ${b} 個，略過 ${c} 個。動作：匯入 ${d} 個，略過 ${e} 個。`,
        reportNothing: (a, b, c) => `未從 ${a} 匯入任何內容。略過的選項：${b} 個。略過的動作：${c} 個。`,
        skip: {
          command: (a, b) => `不支援的命令 ${a}：${b}`,
          search: (a, b) => `不支援的搜尋類型 ${a}：${b}`,
          filter: (a, b) => `含正規表示式篩選器的動作：${b}`,
          os: (a, b) => `適用於其他系統（${a}）：${b}`,
          variable: (a, b) => `未知變數 ${a}：${b}`,
          path: (a, b) => `無法使用或不安全的路徑：${b}`
        },
        error: {
          tooLarge: "該檔案太大，不可能是清理器。",
          notXml: "這不是有效的 XML。",
          notCleaner: "這不是 BleachBit 清理器檔案。",
          noId: "該清理器沒有 id。",
          failed: (a) => `無法匯入：${a}`
        }
      }
    }
  }
};
