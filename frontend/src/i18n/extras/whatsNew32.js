// The "What's new" notice for Prune 3.2, all 40 languages: { en: { whatsNewV32: { ui, cards } } }.
// Merged into the catalog by ../catalog.js; the cards are listed in lib/whatsNew.js. The dialog's
// own words (title, intro, Got it, Show me) are each language's from the 3.1 notice. Generated
// by an out-of-tree script that writes every value with JSON.stringify.
export default {
  en: {
    whatsNewV32: {
      ui: {
        title: (a) => `What's new in Prune ${a}`,
        intro: "A few things worth knowing about, and where to find them.",
        gotIt: "Got it",
        showMe: "Show me",
        backgroundNote: "Junk files leaves backups and logs alone until you turn those patterns on."
      },
      cards: {
        junkFiles: { title: "Junk files", description: "Find temporary files, caches and crash dumps by name on the drives and folders you pick, with a pattern list you can edit." },
        windowsTools: { title: "Windows tools in one place", description: "System Restore, System File Checker, Event Viewer, Device Manager and more of Windows' own tools, each with a line on what it is for." },
        hidePrograms: { title: "Hide programs from the list", description: "Hide from list takes a program out of the rows and the totals without changing it. Show hidden brings it back." },
        properties: { title: "Properties from the program list", description: "A row's menu opens Windows' own Properties sheet for the program's executable: version, company, signatures and compatibility." },
        installTraces: { title: "Take install traces with you", description: "In Install with monitoring, export one recorded install or all of them to a file, then import it here or on another PC." },
        sizeUnits: { title: "Choose how sizes are written", description: "1024-based like File Explorer, the same with KiB and MiB, or 1000-based like a drive maker, so a 1 TB drive reads 1 TB." },
        startupDisabled: { title: "Remove every disabled entry", description: "One click removes every Run entry and Startup-folder shortcut you switched off, as one batch with one Undo." }
      }
    }
  },
  af: {
    whatsNewV32: {
      ui: {
        title: (a) => `Wat is nuut in Prune ${a}`,
        intro: "'n Paar dinge wat die moeite werd is om te ken, en waar om dit te vind.",
        gotIt: "Verstaan",
        showMe: "Wys my",
        backgroundNote: "Rommellêers laat rugsteun- en loglêers met rus totdat jy daardie patrone aanskakel."
      },
      cards: {
        junkFiles: { title: "Rommellêers", description: "Vind tydelike lêers, kasgeheue en ongelukstortings volgens naam op die aandrywers en vouers wat jy kies, met 'n patroonlys wat jy kan wysig." },
        windowsTools: { title: "Windows-hulpmiddels op een plek", description: "Stelselherstel, Stelsellêerkontroleerder, Gebeurtenisbekyker, Toestelbestuurder en meer van Windows se eie hulpmiddels, elk met 'n reël oor waarvoor dit is." },
        hidePrograms: { title: "Versteek programme uit die lys", description: "Versteek uit lys haal 'n program uit die rye en die totale sonder om dit te verander. Wys versteekte bring dit terug." },
        properties: { title: "Eienskappe uit die programlys", description: "'n Ry se kieslys maak Windows se eie Eienskappe-blad vir die program se uitvoerbare lêer oop: weergawe, maatskappy, handtekeninge en versoenbaarheid." },
        installTraces: { title: "Neem installeerspore saam", description: "In Installeer met monitering voer jy een opgeneemde installasie of almal uit na 'n lêer, en voer dit hier of op 'n ander rekenaar weer in." },
        sizeUnits: { title: "Kies hoe groottes geskryf word", description: "1024-gebaseer soos Lêerverkenner, dieselfde met KiB en MiB, of 1000-gebaseer soos 'n skyfvervaardiger, sodat 'n 1 TB-skyf 1 TB lees." },
        startupDisabled: { title: "Verwyder alle gedeaktiveerde inskrywings", description: "Een klik verwyder elke Run-inskrywing en Opstartvouer-kortpad wat jy afgeskakel het, as een bondel met een Ontdoen." }
      }
    }
  },
  ar: {
    whatsNewV32: {
      ui: {
        title: (a) => `ما الجديد في Prune ${a}`,
        intro: "بعض الأمور التي تستحق المعرفة، وأين تجدها.",
        gotIt: "حسنًا",
        showMe: "أرني",
        backgroundNote: "تترك «الملفات غير الضرورية» النسخ الاحتياطية والسجلات وشأنها حتى تشغّل تلك الأنماط."
      },
      cards: {
        junkFiles: { title: "الملفات غير الضرورية", description: "اعثر بالاسم على الملفات المؤقتة وذاكرة التخزين المؤقت وملفات تفريغ الأعطال في محركات الأقراص والمجلدات التي تختارها، بقائمة أنماط يمكنك تعديلها." },
        windowsTools: { title: "أدوات Windows في مكان واحد", description: "استعادة النظام ومدقق ملفات النظام وعارض الأحداث وإدارة الأجهزة وغيرها من أدوات Windows نفسه، ولكلٍّ منها سطر يوضح الغرض منها." },
        hidePrograms: { title: "إخفاء البرامج من القائمة", description: "يُخرج «إخفاء من القائمة» البرنامج من الصفوف والإجماليات دون أن يغيّر فيه شيئًا، ويعيده «إظهار المخفية»." },
        properties: { title: "الخصائص من قائمة البرامج", description: "تفتح قائمة الصف ورقة خصائص Windows نفسه لملف البرنامج التنفيذي: الإصدار والشركة والتواقيع والتوافق." },
        installTraces: { title: "خذ آثار التثبيت معك", description: "في «التثبيت مع المراقبة»، صدّر تثبيتًا مسجّلًا واحدًا أو جميعها إلى ملف، ثم استورده هنا أو على كمبيوتر آخر." },
        sizeUnits: { title: "اختر طريقة كتابة الأحجام", description: "على أساس 1024 مثل مستكشف الملفات، أو الأرقام نفسها بوحدتي KiB وMiB، أو على أساس 1000 مثل صانعي الأقراص، فيظهر قرص سعته 1 TB بحجم 1 TB." },
        startupDisabled: { title: "إزالة كل الإدخالات المعطّلة", description: "بنقرة واحدة تُزال كل إدخالات Run واختصارات مجلد بدء التشغيل التي أوقفتها، كدفعة واحدة بتراجع واحد." }
      }
    }
  },
  ca: {
    whatsNewV32: {
      ui: {
        title: (a) => `Novetats de Prune ${a}`,
        intro: "Algunes coses que val la pena conèixer i on trobar-les.",
        gotIt: "Entesos",
        showMe: "Mostra-m'ho",
        backgroundNote: "Fitxers brossa deixa estar les còpies de seguretat i els registres fins que activis aquests patrons."
      },
      cards: {
        junkFiles: { title: "Fitxers brossa", description: "Troba fitxers temporals, memòries cau i bolcats d'error pel nom a les unitats i carpetes que triïs, amb una llista de patrons que pots editar." },
        windowsTools: { title: "Eines de Windows en un sol lloc", description: "Restaurar el sistema, el Comprovador de fitxers del sistema, el Visor d'esdeveniments, l'Administrador de dispositius i més eines del mateix Windows, cadascuna amb una línia que explica per a què serveix." },
        hidePrograms: { title: "Amaga programes de la llista", description: "Amaga de la llista treu un programa de les files i dels totals sense canviar-lo. Mostra els amagats el torna a mostrar." },
        properties: { title: "Propietats des de la llista de programes", description: "El menú d'una fila obre el full de Propietats del mateix Windows per a l'executable del programa: versió, empresa, signatures i compatibilitat." },
        installTraces: { title: "Emporta't els rastres d'instal·lació", description: "A Instal·la amb supervisió, exporta una instal·lació enregistrada o totes a un fitxer i importa-la aquí o en un altre PC." },
        sizeUnits: { title: "Tria com s'escriuen les mides", description: "En base 1024 com l'Explorador de fitxers, les mateixes xifres amb KiB i MiB, o en base 1000 com un fabricant de discos, perquè un disc d'1 TB marqui 1 TB." },
        startupDisabled: { title: "Elimina totes les entrades desactivades", description: "Un clic elimina totes les entrades de Run i les dreceres de la carpeta d'inici que has desactivat, en un sol lot amb un sol Desfés." }
      }
    }
  },
  cs: {
    whatsNewV32: {
      ui: {
        title: (a) => `Co je nového v Prune ${a}`,
        intro: "Pár věcí, které stojí za zmínku, a kde je najdete.",
        gotIt: "Rozumím",
        showMe: "Ukázat",
        backgroundNote: "Nepotřebné soubory nechávají zálohy a protokoly být, dokud tyto vzory nezapnete."
      },
      cards: {
        junkFiles: { title: "Nepotřebné soubory", description: "Najděte dočasné soubory, mezipaměti a výpisy chyb podle názvu na jednotkách a ve složkách, které vyberete, se seznamem vzorů, který můžete upravit." },
        windowsTools: { title: "Nástroje Windows na jednom místě", description: "Obnovení systému, Kontrola systémových souborů, Prohlížeč událostí, Správce zařízení a další vlastní nástroje Windows, každý s řádkem o tom, k čemu slouží." },
        hidePrograms: { title: "Skrytí programů ze seznamu", description: "Skrýt ze seznamu odebere program z řádků i součtů, aniž by ho změnilo. Zobrazit skryté ho vrátí zpět." },
        properties: { title: "Vlastnosti přímo ze seznamu programů", description: "Nabídka řádku otevře okno Vlastnosti systému Windows pro spustitelný soubor programu: verze, společnost, podpisy a kompatibilita." },
        installTraces: { title: "Stopy instalací s sebou", description: "V okně Instalovat se sledováním exportujte jednu zaznamenanou instalaci nebo všechny do souboru a importujte ho tady nebo na jiném počítači." },
        sizeUnits: { title: "Zvolte, jak se píšou velikosti", description: "Po 1024 jako Průzkumník souborů, stejná čísla s KiB a MiB, nebo po 1000 jako výrobci disků, takže disk 1 TB ukazuje 1 TB." },
        startupDisabled: { title: "Odebrání všech vypnutých položek", description: "Jedním kliknutím odeberete všechny položky Run a zástupce ve složce Po spuštění, které jste vypnuli, jako jednu dávku s jedním Zpět." }
      }
    }
  },
  cy: {
    whatsNewV32: {
      ui: {
        title: (a) => `Beth sy'n newydd yn Prune ${a}`,
        intro: "Ychydig o bethau gwerth eu gwybod, a lle i'w cael.",
        gotIt: "Iawn",
        showMe: "Dangoswch",
        backgroundNote: "Mae Ffeiliau sothach yn gadael copïau wrth gefn a logiau'n llonydd nes i chi droi'r patrymau hynny ymlaen."
      },
      cards: {
        junkFiles: { title: "Ffeiliau sothach", description: "Dod o hyd i ffeiliau dros dro, storfeydd a dympiau chwalu yn ôl enw ar y gyriannau a'r ffolderi a ddewiswch, gyda rhestr patrymau y gallwch ei golygu." },
        windowsTools: { title: "Offer Windows mewn un lle", description: "Adfer System, Gwiriwr Ffeiliau System, Gwyliwr Digwyddiadau, Rheolwr Dyfeisiau a mwy o offer Windows ei hun, pob un gyda llinell ar beth yw ei bwrpas." },
        hidePrograms: { title: "Cuddio rhaglenni o'r rhestr", description: "Mae Cuddio o'r rhestr yn tynnu rhaglen o'r rhesi a'r cyfansymiau heb ei newid. Mae Dangos y rhai cudd yn dod â hi'n ôl." },
        properties: { title: "Priodweddau o'r rhestr raglenni", description: "Mae dewislen rhes yn agor dalen Priodweddau Windows ei hun ar gyfer ffeil weithredadwy'r rhaglen: fersiwn, cwmni, llofnodion a chydnawsedd." },
        installTraces: { title: "Ewch ag olion gosod gyda chi", description: "Yn Gosod gyda monitro, allforiwch un gosodiad a gofnodwyd neu'r cyfan i ffeil, yna mewnforiwch hi yma neu ar gyfrifiadur arall." },
        sizeUnits: { title: "Dewis sut i ysgrifennu meintiau", description: "Seiliedig ar 1024 fel File Explorer, yr un ffigurau gyda KiB a MiB, neu seiliedig ar 1000 fel gwneuthurwr gyriannau, fel bod gyriant 1 TB yn dangos 1 TB." },
        startupDisabled: { title: "Tynnu pob cofnod sydd wedi'i analluogi", description: "Mae un clic yn tynnu pob cofnod Run a llwybr byr ffolder Cychwyn a droesoch i ffwrdd, fel un swp gydag un Dadwneud." }
      }
    }
  },
  da: {
    whatsNewV32: {
      ui: {
        title: (a) => `Nyt i Prune ${a}`,
        intro: "Nogle ting, der er værd at kende, og hvor du finder dem.",
        gotIt: "Forstået",
        showMe: "Vis mig",
        backgroundNote: "Overflødige filer lader sikkerhedskopier og logfiler være, indtil du slår de mønstre til."
      },
      cards: {
        junkFiles: { title: "Overflødige filer", description: "Find midlertidige filer, cacher og nedbrudsdumps ud fra navnet på de drev og mapper, du vælger, med en mønsterliste, du kan redigere." },
        windowsTools: { title: "Windows-værktøjer samlet ét sted", description: "Systemgendannelse, Kontrol af systemfiler, Logbog, Enhedshåndtering og flere af Windows' egne værktøjer, hver med en linje om, hvad det er til." },
        hidePrograms: { title: "Skjul programmer fra listen", description: "Skjul fra listen tager et program ud af rækkerne og totalerne uden at ændre det. Vis skjulte henter det tilbage." },
        properties: { title: "Egenskaber direkte fra programlisten", description: "En rækkes menu åbner Windows' eget Egenskaber-ark for programmets eksekverbare fil: version, firma, signaturer og kompatibilitet." },
        installTraces: { title: "Tag installationsspor med dig", description: "I Installer med overvågning kan du eksportere én registreret installation eller dem alle til en fil og importere den her eller på en anden pc." },
        sizeUnits: { title: "Vælg, hvordan størrelser skrives", description: "1024-baseret som Stifinder, de samme tal med KiB og MiB, eller 1000-baseret som en drevproducent, så et drev på 1 TB viser 1 TB." },
        startupDisabled: { title: "Fjern alle deaktiverede poster", description: "Ét klik fjerner alle Run-poster og genveje i Start-mappen, du har slået fra, som én samlet handling med én Fortryd." }
      }
    }
  },
  de: {
    whatsNewV32: {
      ui: {
        title: (a) => `Neu in Prune ${a}`,
        intro: "Einiges, was Sie wissen sollten, und wo Sie es finden.",
        gotIt: "Verstanden",
        showMe: "Zeig es mir",
        backgroundNote: "Datenmüll lässt Sicherungen und Protokolle in Ruhe, bis Sie diese Muster einschalten."
      },
      cards: {
        junkFiles: { title: "Datenmüll", description: "Finden Sie temporäre Dateien, Caches und Absturzabbilder anhand des Namens auf den Laufwerken und in den Ordnern Ihrer Wahl, mit einer Musterliste, die Sie bearbeiten können." },
        windowsTools: { title: "Windows-Tools an einem Ort", description: "Systemwiederherstellung, Systemdateiprüfung, Ereignisanzeige, Geräte-Manager und weitere Tools von Windows selbst, jedes mit einer Zeile dazu, wofür es da ist." },
        hidePrograms: { title: "Programme aus der Liste ausblenden", description: "„Aus der Liste ausblenden“ nimmt ein Programm aus den Zeilen und Summen, ohne es zu verändern. „Ausgeblendete zeigen“ holt es zurück." },
        properties: { title: "Eigenschaften direkt aus der Programmliste", description: "Das Menü einer Zeile öffnet das Eigenschaften-Fenster von Windows für die ausführbare Datei des Programms: Version, Firma, Signaturen und Kompatibilität." },
        installTraces: { title: "Installationsspuren mitnehmen", description: "Unter „Mit Überwachung installieren“ exportieren Sie eine aufgezeichnete Installation oder alle in eine Datei und importieren sie hier oder auf einem anderen PC." },
        sizeUnits: { title: "Wählen, wie Größen geschrieben werden", description: "Auf Basis 1024 wie der Explorer, dieselben Zahlen mit KiB und MiB, oder auf Basis 1000 wie Laufwerkshersteller, sodass ein 1-TB-Laufwerk 1 TB anzeigt." },
        startupDisabled: { title: "Alle deaktivierten Einträge entfernen", description: "Ein Klick entfernt alle Run-Einträge und Verknüpfungen im Autostart-Ordner, die Sie ausgeschaltet haben, als einen Stapel mit einem Rückgängig." }
      }
    }
  },
  el: {
    whatsNewV32: {
      ui: {
        title: (a) => `Τι νέο υπάρχει στο Prune ${a}`,
        intro: "Μερικά πράγματα που αξίζει να γνωρίζετε και πού θα τα βρείτε.",
        gotIt: "Εντάξει",
        showMe: "Δείξε μου",
        backgroundNote: "Τα «Άχρηστα αρχεία» αφήνουν ήσυχα τα αντίγραφα ασφαλείας και τα αρχεία καταγραφής μέχρι να ενεργοποιήσετε αυτά τα μοτίβα."
      },
      cards: {
        junkFiles: { title: "Άχρηστα αρχεία", description: "Βρείτε προσωρινά αρχεία, κρυφές μνήμες και αρχεία ένδειξης σφαλμάτων με βάση το όνομα στις μονάδες και στους φακέλους που επιλέγετε, με μια λίστα μοτίβων που μπορείτε να επεξεργαστείτε." },
        windowsTools: { title: "Εργαλεία Windows σε ένα σημείο", description: "Επαναφορά Συστήματος, Έλεγχος αρχείων συστήματος, Προβολή συμβάντων, Διαχείριση συσκευών και άλλα εργαλεία των ίδιων των Windows, το καθένα με μια γραμμή για το τι κάνει." },
        hidePrograms: { title: "Απόκρυψη προγραμμάτων από τη λίστα", description: "Η «Απόκρυψη από τη λίστα» βγάζει ένα πρόγραμμα από τις γραμμές και τα σύνολα χωρίς να το αλλάξει. Η «Εμφάνιση κρυφών» το επαναφέρει." },
        properties: { title: "Ιδιότητες από τη λίστα προγραμμάτων", description: "Το μενού μιας γραμμής ανοίγει το παράθυρο Ιδιότητες των ίδιων των Windows για το εκτελέσιμο του προγράμματος: έκδοση, εταιρεία, υπογραφές και συμβατότητα." },
        installTraces: { title: "Πάρτε μαζί σας τα ίχνη εγκατάστασης", description: "Στην «Εγκατάσταση με παρακολούθηση», εξαγάγετε μία καταγεγραμμένη εγκατάσταση ή όλες σε ένα αρχείο και εισαγάγετέ το εδώ ή σε άλλον υπολογιστή." },
        sizeUnits: { title: "Επιλέξτε πώς γράφονται τα μεγέθη", description: "Με βάση το 1024 όπως η Εξερεύνηση αρχείων, τα ίδια νούμερα με KiB και MiB, ή με βάση το 1000 όπως οι κατασκευαστές δίσκων, ώστε ένας δίσκος 1 TB να δείχνει 1 TB." },
        startupDisabled: { title: "Κατάργηση όλων των απενεργοποιημένων καταχωρίσεων", description: "Ένα κλικ καταργεί κάθε καταχώριση Run και συντόμευση του φακέλου Εκκίνησης που έχετε απενεργοποιήσει, ως μία δέσμη με μία Αναίρεση." }
      }
    }
  },
  es: {
    whatsNewV32: {
      ui: {
        title: (a) => `Novedades de Prune ${a}`,
        intro: "Algunas cosas que conviene conocer y dónde encontrarlas.",
        gotIt: "Entendido",
        showMe: "Muéstramelo",
        backgroundNote: "Archivos basura deja en paz las copias de seguridad y los registros hasta que actives esos patrones."
      },
      cards: {
        junkFiles: { title: "Archivos basura", description: "Encuentra archivos temporales, cachés y volcados de errores por su nombre en las unidades y carpetas que elijas, con una lista de patrones que puedes editar." },
        windowsTools: { title: "Herramientas de Windows en un solo lugar", description: "Restaurar sistema, el Comprobador de archivos de sistema, el Visor de eventos, el Administrador de dispositivos y más herramientas del propio Windows, cada una con una línea sobre para qué sirve." },
        hidePrograms: { title: "Ocultar programas de la lista", description: "Ocultar de la lista saca un programa de las filas y los totales sin cambiarlo. Mostrar ocultos lo devuelve." },
        properties: { title: "Propiedades desde la lista de programas", description: "El menú de una fila abre la hoja de Propiedades del propio Windows para el ejecutable del programa: versión, empresa, firmas y compatibilidad." },
        installTraces: { title: "Llévate los rastros de instalación", description: "En Instalar con supervisión, exporta una instalación registrada o todas a un archivo e impórtalo aquí o en otro equipo." },
        sizeUnits: { title: "Elige cómo se escriben los tamaños", description: "En base 1024 como el Explorador de archivos, las mismas cifras con KiB y MiB, o en base 1000 como un fabricante de discos, para que un disco de 1 TB marque 1 TB." },
        startupDisabled: { title: "Quitar todas las entradas desactivadas", description: "Un clic quita todas las entradas de Run y los accesos directos de la carpeta Inicio que desactivaste, en un solo lote con un solo Deshacer." }
      }
    }
  },
  et: {
    whatsNewV32: {
      ui: {
        title: (a) => `Mis on Prune ${a} uut`,
        intro: "Mõned asjad, mida tasub teada, ja kust neid leida.",
        gotIt: "Selge",
        showMe: "Näita",
        backgroundNote: "Rämpsfailid jätab varukoopiad ja logid rahule, kuni need mustrid sisse lülitad."
      },
      cards: {
        junkFiles: { title: "Rämpsfailid", description: "Leia ajutised failid, vahemälud ja krahhitõmmised nime järgi valitud ketastelt ja kaustadest, muudetava mustriloendi abil." },
        windowsTools: { title: "Windowsi tööriistad ühes kohas", description: "Süsteemitaaste, süsteemifailide kontrollija, sündmusvaatur, seadmehaldur ja muud Windowsi enda tööriistad, igaühel rida selle kohta, milleks see on." },
        hidePrograms: { title: "Peida programmid loendist", description: "Peida loendist eemaldab programmi ridadest ja kogusummadest seda muutmata. Näita peidetuid toob selle tagasi." },
        properties: { title: "Atribuudid otse programmiloendist", description: "Rea menüü avab programmi käivitusfaili jaoks Windowsi enda atribuutide akna: versioon, ettevõte, allkirjad ja ühilduvus." },
        installTraces: { title: "Võta installijäljed kaasa", description: "Aknas Paigalda jälgimisega ekspordi üks salvestatud paigaldus või kõik faili ning impordi see siin või teises arvutis." },
        sizeUnits: { title: "Vali, kuidas suurusi kirjutatakse", description: "1024-põhiselt nagu File Explorer, samad arvud KiB ja MiB-ga või 1000-põhiselt nagu kettatootja, nii et 1 TB ketas näitab 1 TB." },
        startupDisabled: { title: "Eemalda kõik keelatud kirjed", description: "Üks klõps eemaldab kõik Run-kirjed ja käivituskausta otseteed, mille välja lülitasid, ühe partiina, mille saab ühe korraga tagasi võtta." }
      }
    }
  },
  fi: {
    whatsNewV32: {
      ui: {
        title: (a) => `Prunen ${a} uudet ominaisuudet`,
        intro: "Muutama hyvä tietää -asia ja mistä ne löytyvät.",
        gotIt: "Selvä",
        showMe: "Näytä",
        backgroundNote: "Roskatiedostot jättää varmuuskopiot ja lokit rauhaan, kunnes otat ne kuviot käyttöön."
      },
      cards: {
        junkFiles: { title: "Roskatiedostot", description: "Etsi väliaikaiset tiedostot, välimuistit ja kaatumisvedokset nimen perusteella valitsemistasi asemista ja kansioista muokattavan kuvioluettelon avulla." },
        windowsTools: { title: "Windows-työkalut yhdessä paikassa", description: "Järjestelmän palauttaminen, järjestelmätiedostojen tarkistus, Tapahtumienvalvonta, Laitehallinta ja muita Windowsin omia työkaluja, kullakin rivi siitä, mihin se on tarkoitettu." },
        hidePrograms: { title: "Piilota ohjelmia luettelosta", description: "Piilota luettelosta poistaa ohjelman riveistä ja summista muuttamatta sitä. Näytä piilotetut tuo sen takaisin." },
        properties: { title: "Ominaisuudet suoraan ohjelmaluettelosta", description: "Rivin valikko avaa Windowsin oman Ominaisuudet-ikkunan ohjelman suoritettavalle tiedostolle: versio, yritys, allekirjoitukset ja yhteensopivuus." },
        installTraces: { title: "Ota asennusjäljet mukaan", description: "Asenna seurannalla -ikkunassa voit viedä yhden tallennetun asennuksen tai kaikki tiedostoon ja tuoda sen tähän tai toiseen tietokoneeseen." },
        sizeUnits: { title: "Valitse, miten koot kirjoitetaan", description: "1024-pohjaisesti kuten Resurssienhallinta, samat luvut KiB- ja MiB-yksiköin, tai 1000-pohjaisesti kuten levyvalmistajat, jolloin 1 TB:n levy näyttää 1 TB." },
        startupDisabled: { title: "Poista kaikki käytöstä poistetut merkinnät", description: "Yksi napsautus poistaa kaikki pois kytkemäsi Run-merkinnät ja Käynnistys-kansion pikakuvakkeet yhtenä eränä, jonka voi kumota kerralla." }
      }
    }
  },
  fr: {
    whatsNewV32: {
      ui: {
        title: (a) => `Nouveautés de Prune ${a}`,
        intro: "Quelques points à connaître, et où les trouver.",
        gotIt: "Compris",
        showMe: "Montrez-moi",
        backgroundNote: "Fichiers inutiles laisse les sauvegardes et les journaux tranquilles tant que vous n'activez pas ces motifs."
      },
      cards: {
        junkFiles: { title: "Fichiers inutiles", description: "Trouvez fichiers temporaires, caches et vidages sur incident par leur nom sur les lecteurs et dossiers de votre choix, avec une liste de motifs modifiable." },
        windowsTools: { title: "Les outils Windows au même endroit", description: "Restauration du système, Vérificateur des fichiers système, Observateur d'événements, Gestionnaire de périphériques et d'autres outils de Windows lui-même, chacun avec une ligne sur son rôle." },
        hidePrograms: { title: "Masquer des programmes de la liste", description: "Masquer de la liste retire un programme des lignes et des totaux sans le modifier. Afficher les masqués le fait revenir." },
        properties: { title: "Propriétés depuis la liste des programmes", description: "Le menu d'une ligne ouvre la feuille Propriétés de Windows pour l'exécutable du programme : version, société, signatures et compatibilité." },
        installTraces: { title: "Emportez vos traces d'installation", description: "Dans Installer avec surveillance, exportez une installation enregistrée ou toutes dans un fichier, puis importez-le ici ou sur un autre PC." },
        sizeUnits: { title: "Choisissez comment écrire les tailles", description: "En base 1024 comme l'Explorateur de fichiers, les mêmes chiffres en KiB et MiB, ou en base 1000 comme un fabricant de disques, pour qu'un disque de 1 TB affiche 1 TB." },
        startupDisabled: { title: "Supprimer toutes les entrées désactivées", description: "Un clic supprime toutes les entrées Run et tous les raccourcis du dossier Démarrage que vous avez désactivés, en un seul lot avec une seule annulation." }
      }
    }
  },
  he: {
    whatsNewV32: {
      ui: {
        title: (a) => `מה חדש ב-Prune ${a}`,
        intro: "כמה דברים ששווה להכיר, ואיפה למצוא אותם.",
        gotIt: "הבנתי",
        showMe: "הראה לי",
        backgroundNote: "קובצי זבל לא נוגע בגיבויים וביומנים עד שתפעיל את התבניות האלה."
      },
      cards: {
        junkFiles: { title: "קובצי זבל", description: "מצא קבצים זמניים, מטמונים וקובצי קריסה לפי שם בכוננים ובתיקיות שתבחר, עם רשימת תבניות שאפשר לערוך." },
        windowsTools: { title: "כלי Windows במקום אחד", description: "שחזור המערכת, בודק קובצי המערכת, מציג האירועים, מנהל ההתקנים ועוד מהכלים של Windows עצמה, לכל אחד שורה שמסבירה למה הוא משמש." },
        hidePrograms: { title: "הסתרת תוכניות מהרשימה", description: "הסתר מהרשימה מוציא תוכנית מהשורות ומהסיכומים בלי לשנות אותה. הצג מוסתרים מחזיר אותה." },
        properties: { title: "מאפיינים מתוך רשימת התוכניות", description: "התפריט של שורה פותח את גיליון המאפיינים של Windows עצמה עבור קובץ ההפעלה של התוכנית: גרסה, חברה, חתימות ותאימות." },
        installTraces: { title: "קח איתך את עקבות ההתקנה", description: "בהתקנה עם ניטור, ייצא התקנה מתועדת אחת או את כולן לקובץ, וייבא אותו כאן או במחשב אחר." },
        sizeUnits: { title: "בחר איך נכתבים גדלים", description: "לפי 1024 כמו סייר הקבצים, אותם מספרים עם KiB ו-MiB, או לפי 1000 כמו יצרני כוננים, כך שכונן של 1 TB מציג 1 TB." },
        startupDisabled: { title: "הסרת כל הרשומות המושבתות", description: "לחיצה אחת מסירה כל רשומת Run וכל קיצור דרך בתיקיית ההפעלה שכיבית, כאצווה אחת עם ביטול אחד." }
      }
    }
  },
  hu: {
    whatsNewV32: {
      ui: {
        title: (a) => `Újdonságok a Prune ${a} verzióban`,
        intro: "Néhány tudnivaló, és hogy hol találod őket.",
        gotIt: "Értem",
        showMe: "Mutasd",
        backgroundNote: "A Felesleges fájlok békén hagyja a biztonsági másolatokat és a naplókat, amíg be nem kapcsolja ezeket a mintákat."
      },
      cards: {
        junkFiles: { title: "Felesleges fájlok", description: "Keresse meg név alapján az ideiglenes fájlokat, gyorsítótárakat és összeomlási memóriaképeket a kiválasztott meghajtókon és mappákban, szerkeszthető mintalistával." },
        windowsTools: { title: "Windows-eszközök egy helyen", description: "Rendszer-visszaállítás, Rendszerfájl-ellenőrző, Eseménynapló, Eszközkezelő és a Windows további saját eszközei, mindegyik egy sorral arról, mire való." },
        hidePrograms: { title: "Programok elrejtése a listából", description: "Az Elrejtés a listából kiveszi a programot a sorokból és az összesítésekből, anélkül hogy megváltoztatná. A Rejtettek megjelenítése visszahozza." },
        properties: { title: "Tulajdonságok a programlistából", description: "Egy sor menüje megnyitja a Windows saját Tulajdonságok lapját a program futtatható fájljához: verzió, cég, aláírások és kompatibilitás." },
        installTraces: { title: "Vigye magával a telepítési nyomokat", description: "A Telepítés megfigyeléssel ablakban egy rögzített telepítést vagy az összeset fájlba exportálhatja, és importálhatja itt vagy egy másik gépen." },
        sizeUnits: { title: "Válassza ki a méretek írásmódját", description: "1024 alapon, mint a Fájlkezelő, ugyanazok a számok KiB és MiB jelöléssel, vagy 1000 alapon, mint a meghajtógyártók, így egy 1 TB-os meghajtó 1 TB-ot mutat." },
        startupDisabled: { title: "Minden letiltott bejegyzés eltávolítása", description: "Egy kattintással eltávolíthat minden kikapcsolt Run-bejegyzést és Indítópult-mappabeli parancsikont, egyetlen kötegként, egyetlen visszavonással." }
      }
    }
  },
  id: {
    whatsNewV32: {
      ui: {
        title: (a) => `Yang baru di Prune ${a}`,
        intro: "Beberapa hal yang perlu diketahui dan di mana menemukannya.",
        gotIt: "Mengerti",
        showMe: "Tunjukkan",
        backgroundNote: "File sampah tidak menyentuh cadangan dan log sampai Anda menyalakan pola tersebut."
      },
      cards: {
        junkFiles: { title: "File sampah", description: "Temukan file sementara, cache, dan dump crash berdasarkan nama di drive dan folder yang Anda pilih, dengan daftar pola yang bisa Anda edit." },
        windowsTools: { title: "Alat Windows di satu tempat", description: "Pemulihan Sistem, Pemeriksa Berkas Sistem, Penampil Peristiwa, Manajer Perangkat, dan alat Windows lainnya, masing-masing dengan satu baris tentang kegunaannya." },
        hidePrograms: { title: "Sembunyikan program dari daftar", description: "Sembunyikan dari daftar mengeluarkan program dari baris dan total tanpa mengubahnya. Tampilkan yang tersembunyi mengembalikannya." },
        properties: { title: "Properti dari daftar program", description: "Menu sebuah baris membuka lembar Properti milik Windows untuk file program yang dapat dijalankan: versi, perusahaan, tanda tangan, dan kompatibilitas." },
        installTraces: { title: "Bawa jejak instalasi Anda", description: "Di Instal dengan pemantauan, ekspor satu instalasi yang terekam atau semuanya ke sebuah file, lalu impor di sini atau di PC lain." },
        sizeUnits: { title: "Pilih cara ukuran ditulis", description: "Berbasis 1024 seperti File Explorer, angka yang sama dengan KiB dan MiB, atau berbasis 1000 seperti pembuat drive, sehingga drive 1 TB terbaca 1 TB." },
        startupDisabled: { title: "Hapus semua entri yang dinonaktifkan", description: "Satu klik menghapus setiap entri Run dan pintasan folder Startup yang Anda matikan, sebagai satu kumpulan dengan satu Urungkan." }
      }
    }
  },
  is: {
    whatsNewV32: {
      ui: {
        title: (a) => `Nýjungar í Prune ${a}`,
        intro: "Nokkur atriði sem gott er að vita um og hvar þau er að finna.",
        gotIt: "Skil",
        showMe: "Sýndu mér",
        backgroundNote: "Ruslskrár láta afrit og annála í friði þar til þú kveikir á þeim mynstrum."
      },
      cards: {
        junkFiles: { title: "Ruslskrár", description: "Finndu tímabundnar skrár, skyndiminni og hrunafrit eftir nafni á drifum og í möppum sem þú velur, með mynsturlista sem þú getur breytt." },
        windowsTools: { title: "Windows-verkfæri á einum stað", description: "Kerfisendurheimt, kerfisskráaprófun, Atburðaskoðari, Tækjastjórnun og fleiri verkfæri Windows sjálfs, hvert með línu um til hvers það er." },
        hidePrograms: { title: "Fela forrit af listanum", description: "Fela af lista tekur forrit úr röðunum og samtölunum án þess að breyta því. Sýna falin færir það aftur." },
        properties: { title: "Eiginleikar beint úr forritalistanum", description: "Valmynd raðar opnar eiginleikaglugga Windows sjálfs fyrir keyrsluskrá forritsins: útgáfu, fyrirtæki, undirskriftir og samhæfni." },
        installTraces: { title: "Taktu uppsetningarspor með þér", description: "Í Setja upp með vöktun flytur þú út eina skráða uppsetningu eða allar í skrá og flytur hana inn hér eða á annarri tölvu." },
        sizeUnits: { title: "Veldu hvernig stærðir eru skrifaðar", description: "Miðað við 1024 eins og skráavafrinn, sömu tölur með KiB og MiB, eða miðað við 1000 eins og drifaframleiðendur, svo 1 TB drif sýnir 1 TB." },
        startupDisabled: { title: "Fjarlægja allar óvirkar færslur", description: "Einn smellur fjarlægir allar Run-færslur og flýtileiðir í ræsimöppunni sem þú slökktir á, sem eina lotu með einni afturköllun." }
      }
    }
  },
  it: {
    whatsNewV32: {
      ui: {
        title: (a) => `Novità di Prune ${a}`,
        intro: "Alcune cose da conoscere e dove trovarle.",
        gotIt: "Ho capito",
        showMe: "Mostrami",
        backgroundNote: "File inutili lascia stare backup e log finché non attivi quei modelli."
      },
      cards: {
        junkFiles: { title: "File inutili", description: "Trova file temporanei, cache e dump degli arresti anomali per nome sulle unità e nelle cartelle che scegli, con un elenco di modelli modificabile." },
        windowsTools: { title: "Gli strumenti di Windows in un unico posto", description: "Ripristino configurazione di sistema, Controllo file di sistema, Visualizzatore eventi, Gestione dispositivi e altri strumenti di Windows stesso, ciascuno con una riga su a cosa serve." },
        hidePrograms: { title: "Nascondi programmi dall'elenco", description: "Nascondi dall'elenco toglie un programma dalle righe e dai totali senza modificarlo. Mostra nascosti lo riporta indietro." },
        properties: { title: "Proprietà dall'elenco dei programmi", description: "Il menu di una riga apre la finestra Proprietà di Windows per l'eseguibile del programma: versione, società, firme e compatibilità." },
        installTraces: { title: "Porta con te le tracce di installazione", description: "In Installa con monitoraggio, esporta un'installazione registrata o tutte in un file, poi importalo qui o su un altro PC." },
        sizeUnits: { title: "Scegli come scrivere le dimensioni", description: "In base 1024 come Esplora file, le stesse cifre con KiB e MiB, o in base 1000 come i produttori di dischi, così un disco da 1 TB mostra 1 TB." },
        startupDisabled: { title: "Rimuovi tutte le voci disattivate", description: "Un clic rimuove tutte le voci Run e i collegamenti nella cartella Esecuzione automatica che hai disattivato, come un unico gruppo con un solo Annulla." }
      }
    }
  },
  ja: {
    whatsNewV32: {
      ui: {
        title: (a) => `Prune ${a} の新機能`,
        intro: "知っておきたい機能と、その場所をご紹介します。",
        gotIt: "了解",
        showMe: "見てみる",
        backgroundNote: "不要なファイルは、バックアップとログのパターンをオンにするまで、それらに触れません。"
      },
      cards: {
        junkFiles: { title: "不要なファイル", description: "選んだドライブとフォルダーで、一時ファイル、キャッシュ、クラッシュ ダンプを名前で探します。パターンの一覧は編集できます。" },
        windowsTools: { title: "Windows ツールをひとまとめに", description: "システムの復元、システム ファイル チェッカー、イベント ビューアー、デバイス マネージャーなど、Windows 自体のツールをそれぞれの用途の説明付きで並べます。" },
        hidePrograms: { title: "プログラムを一覧から非表示に", description: "「一覧から非表示にする」で、プログラムを変更せずに行と合計から外せます。「非表示の項目を表示」で元に戻せます。" },
        properties: { title: "プログラム一覧からプロパティ", description: "行のメニューから、プログラムの実行ファイルについて Windows 自体のプロパティ シートを開けます。バージョン、会社、署名、互換性を確認できます。" },
        installTraces: { title: "インストールの記録を持ち運ぶ", description: "「監視しながらインストール」で、記録したインストールを 1 件ずつ、またはすべてファイルにエクスポートし、この PC や別の PC でインポートできます。" },
        sizeUnits: { title: "サイズの表記を選ぶ", description: "エクスプローラーと同じ 1024 単位、同じ数値を KiB や MiB で表記、またはドライブ メーカーと同じ 1000 単位から選べます。1000 単位なら 1 TB のドライブは 1 TB と表示されます。" },
        startupDisabled: { title: "無効にした項目をまとめて削除", description: "オフにした Run の項目とスタートアップ フォルダーのショートカットを、ワンクリックで 1 つのまとまりとして削除します。元に戻すも 1 回で済みます。" }
      }
    }
  },
  ko: {
    whatsNewV32: {
      ui: {
        title: (a) => `Prune ${a}의 새로운 기능`,
        intro: "알아 두면 좋은 기능과 그 위치를 소개합니다.",
        gotIt: "확인",
        showMe: "보여 주세요",
        backgroundNote: "불필요한 파일은 백업과 로그 패턴을 켜기 전까지 해당 파일을 건드리지 않습니다."
      },
      cards: {
        junkFiles: { title: "불필요한 파일", description: "선택한 드라이브와 폴더에서 임시 파일, 캐시, 크래시 덤프를 이름으로 찾습니다. 패턴 목록은 편집할 수 있습니다." },
        windowsTools: { title: "Windows 도구를 한곳에", description: "시스템 복원, 시스템 파일 검사기, 이벤트 뷰어, 장치 관리자 등 Windows 자체 도구를 각각의 용도 설명과 함께 보여 줍니다." },
        hidePrograms: { title: "목록에서 프로그램 숨기기", description: "목록에서 숨기기는 프로그램을 바꾸지 않고 행과 합계에서 뺍니다. 숨긴 항목 표시로 다시 불러옵니다." },
        properties: { title: "프로그램 목록에서 바로 속성 보기", description: "행 메뉴에서 프로그램 실행 파일에 대한 Windows 자체 속성 창을 엽니다. 버전, 회사, 서명, 호환성을 볼 수 있습니다." },
        installTraces: { title: "설치 기록을 다른 PC로", description: "모니터링하며 설치에서 기록된 설치 하나 또는 전부를 파일로 내보내고, 이 PC나 다른 PC에서 가져올 수 있습니다." },
        sizeUnits: { title: "크기 표기 방식 선택", description: "파일 탐색기와 같은 1024 기준, 같은 수치를 KiB와 MiB로 표기, 또는 드라이브 제조사와 같은 1000 기준 중에서 고릅니다. 1000 기준이면 1 TB 드라이브가 1 TB로 표시됩니다." },
        startupDisabled: { title: "사용 안 함 항목 모두 제거", description: "끈 Run 항목과 시작 프로그램 폴더 바로 가기를 클릭 한 번으로 모두 제거합니다. 한 묶음이라 실행 취소 한 번으로 되돌릴 수 있습니다." }
      }
    }
  },
  lt: {
    whatsNewV32: {
      ui: {
        title: (a) => `Kas naujo Prune ${a}`,
        intro: "Keletas dalykų, kuriuos verta žinoti, ir kur juos rasti.",
        gotIt: "Supratau",
        showMe: "Parodyk",
        backgroundNote: "Nereikalingi failai neliečia atsarginių kopijų ir žurnalų, kol neįjungsite tų šablonų."
      },
      cards: {
        junkFiles: { title: "Nereikalingi failai", description: "Raskite laikinuosius failus, talpyklas ir strigčių išklotines pagal pavadinimą pasirinktuose diskuose ir aplankuose, naudodami redaguojamą šablonų sąrašą." },
        windowsTools: { title: "Windows įrankiai vienoje vietoje", description: "Sistemos atkūrimas, sistemos failų tikrintuvas, Įvykių peržiūros programa, Įrenginių tvarkytuvė ir kiti pačios Windows įrankiai, prie kiekvieno eilutė apie tai, kam jis skirtas." },
        hidePrograms: { title: "Slėpti programas iš sąrašo", description: "Slėpti iš sąrašo pašalina programą iš eilučių ir sumų jos nekeisdama. Rodyti paslėptas ją sugrąžina." },
        properties: { title: "Ypatybės tiesiai iš programų sąrašo", description: "Eilutės meniu atidaro pačios Windows ypatybių langą programos vykdomajam failui: versija, įmonė, parašai ir suderinamumas." },
        installTraces: { title: "Pasiimkite diegimo pėdsakus", description: "Lange Diegti su stebėjimu eksportuokite vieną įrašytą diegimą arba visus į failą ir importuokite jį čia arba kitame kompiuteryje." },
        sizeUnits: { title: "Pasirinkite, kaip rašomi dydžiai", description: "Pagal 1024 kaip failų naršyklėje, tie patys skaičiai su KiB ir MiB, arba pagal 1000 kaip diskų gamintojai, kad 1 TB diskas rodytų 1 TB." },
        startupDisabled: { title: "Pašalinti visus išjungtus įrašus", description: "Vienu spustelėjimu pašalinami visi išjungti Run įrašai ir paleisties aplanko nuorodos, kaip vienas paketas su vienu anuliavimu." }
      }
    }
  },
  ms: {
    whatsNewV32: {
      ui: {
        title: (a) => `Yang baharu dalam Prune ${a}`,
        intro: "Beberapa perkara yang berguna untuk diketahui dan di mana mencarinya.",
        gotIt: "Faham",
        showMe: "Tunjukkan",
        backgroundNote: "Fail sampah tidak menyentuh sandaran dan log sehingga anda menghidupkan corak tersebut."
      },
      cards: {
        junkFiles: { title: "Fail sampah", description: "Cari fail sementara, cache dan longgokan ranap mengikut nama pada pemacu dan folder yang anda pilih, dengan senarai corak yang boleh anda edit." },
        windowsTools: { title: "Alat Windows di satu tempat", description: "Pemulihan Sistem, Penyemak Fail Sistem, Pemapar Peristiwa, Pengurus Peranti dan alat Windows sendiri yang lain, setiap satu dengan satu baris tentang kegunaannya." },
        hidePrograms: { title: "Sembunyikan program daripada senarai", description: "Sembunyikan daripada senarai mengeluarkan program daripada baris dan jumlah tanpa mengubahnya. Tunjukkan yang tersembunyi membawanya kembali." },
        properties: { title: "Sifat terus daripada senarai program", description: "Menu baris membuka helaian Sifat Windows sendiri untuk fail boleh laku program: versi, syarikat, tandatangan dan keserasian." },
        installTraces: { title: "Bawa jejak pemasangan bersama anda", description: "Dalam Pasang dengan pemantauan, eksport satu pemasangan yang direkodkan atau semuanya ke fail, kemudian import di sini atau pada PC lain." },
        sizeUnits: { title: "Pilih cara saiz ditulis", description: "Berasaskan 1024 seperti File Explorer, angka yang sama dengan KiB dan MiB, atau berasaskan 1000 seperti pembuat pemacu, supaya pemacu 1 TB terbaca 1 TB." },
        startupDisabled: { title: "Alih keluar semua entri dinyahdayakan", description: "Satu klik mengalih keluar setiap entri Run dan pintasan folder Permulaan yang anda matikan, sebagai satu kelompok dengan satu Buat asal." }
      }
    }
  },
  nb: {
    whatsNewV32: {
      ui: {
        title: (a) => `Nytt i Prune ${a}`,
        intro: "Noen ting det er greit å vite om, og hvor du finner dem.",
        gotIt: "Greit",
        showMe: "Vis meg",
        backgroundNote: "Søppelfiler lar sikkerhetskopier og logger være til du slår på de mønstrene."
      },
      cards: {
        junkFiles: { title: "Søppelfiler", description: "Finn midlertidige filer, hurtigbuffere og krasjdumper etter navn på stasjonene og mappene du velger, med en mønsterliste du kan redigere." },
        windowsTools: { title: "Windows-verktøy samlet på ett sted", description: "Systemgjenoppretting, Systemfilkontroll, Hendelsesliste, Enhetsbehandling og flere av Windows' egne verktøy, hvert med en linje om hva det er til." },
        hidePrograms: { title: "Skjul programmer fra listen", description: "Skjul fra listen tar et program ut av radene og totalene uten å endre det. Vis skjulte henter det tilbake." },
        properties: { title: "Egenskaper rett fra programlisten", description: "Menyen på en rad åpner Windows' eget Egenskaper-vindu for programmets kjørbare fil: versjon, firma, signaturer og kompatibilitet." },
        installTraces: { title: "Ta med deg installasjonsspor", description: "I Installer med overvåking kan du eksportere én registrert installasjon eller alle til en fil, og importere den her eller på en annen PC." },
        sizeUnits: { title: "Velg hvordan størrelser skrives", description: "1024-basert som Filutforsker, de samme tallene med KiB og MiB, eller 1000-basert som en stasjonsprodusent, så en stasjon på 1 TB viser 1 TB." },
        startupDisabled: { title: "Fjern alle deaktiverte oppføringer", description: "Ett klikk fjerner alle Run-oppføringer og snarveier i oppstartsmappen du har slått av, som én samlet handling med én Angre." }
      }
    }
  },
  nl: {
    whatsNewV32: {
      ui: {
        title: (a) => `Nieuw in Prune ${a}`,
        intro: "Een paar dingen die het weten waard zijn, en waar je ze vindt.",
        gotIt: "Begrepen",
        showMe: "Laat zien",
        backgroundNote: "Overbodige bestanden laat back-ups en logbestanden met rust tot je die patronen inschakelt."
      },
      cards: {
        junkFiles: { title: "Overbodige bestanden", description: "Vind tijdelijke bestanden, caches en crashdumps op naam op de stations en mappen die je kiest, met een patroonlijst die je kunt bewerken." },
        windowsTools: { title: "Windows-hulpprogramma's op één plek", description: "Systeemherstel, Systeembestandscontrole, Logboeken, Apparaatbeheer en meer hulpprogramma's van Windows zelf, elk met een regel over waarvoor het dient." },
        hidePrograms: { title: "Programma's verbergen in de lijst", description: "Verbergen in lijst haalt een programma uit de rijen en de totalen zonder het te wijzigen. Verborgen tonen haalt het terug." },
        properties: { title: "Eigenschappen vanuit de programmalijst", description: "Het menu van een rij opent het eigen Eigenschappen-venster van Windows voor het uitvoerbare bestand van het programma: versie, bedrijf, handtekeningen en compatibiliteit." },
        installTraces: { title: "Neem installatiesporen mee", description: "Exporteer in Installeren met bewaking één vastgelegde installatie of allemaal naar een bestand, en importeer het hier of op een andere pc." },
        sizeUnits: { title: "Kies hoe groottes worden geschreven", description: "Op basis van 1024 zoals Verkenner, dezelfde getallen met KiB en MiB, of op basis van 1000 zoals schijffabrikanten, zodat een schijf van 1 TB ook 1 TB aangeeft." },
        startupDisabled: { title: "Alle uitgeschakelde items verwijderen", description: "Eén klik verwijdert elk Run-item en elke snelkoppeling in de map Opstarten die je hebt uitgeschakeld, als één batch met één keer Ongedaan maken." }
      }
    }
  },
  pl: {
    whatsNewV32: {
      ui: {
        title: (a) => `Nowości w Prune ${a}`,
        intro: "Kilka rzeczy wartych poznania i miejsca, gdzie je znaleźć.",
        gotIt: "Rozumiem",
        showMe: "Pokaż",
        backgroundNote: "Zbędne pliki nie ruszają kopii zapasowych ani dzienników, dopóki nie włączysz tych wzorców."
      },
      cards: {
        junkFiles: { title: "Zbędne pliki", description: "Znajdź pliki tymczasowe, pamięci podręczne i zrzuty awaryjne po nazwie na wybranych dyskach i w folderach, z listą wzorców, którą możesz edytować." },
        windowsTools: { title: "Narzędzia systemu Windows w jednym miejscu", description: "Przywracanie systemu, Kontroler plików systemowych, Podgląd zdarzeń, Menedżer urządzeń i inne narzędzia samego systemu Windows, każde z linijką o tym, do czego służy." },
        hidePrograms: { title: "Ukrywanie programów na liście", description: "Ukryj na liście usuwa program z wierszy i sum, nie zmieniając go. Pokaż ukryte przywraca go." },
        properties: { title: "Właściwości prosto z listy programów", description: "Menu wiersza otwiera okno Właściwości systemu Windows dla pliku wykonywalnego programu: wersja, firma, podpisy i zgodność." },
        installTraces: { title: "Zabierz ślady instalacji ze sobą", description: "W oknie Zainstaluj z monitorowaniem wyeksportuj jedną zapisaną instalację lub wszystkie do pliku, a potem zaimportuj go tutaj lub na innym komputerze." },
        sizeUnits: { title: "Wybierz zapis rozmiarów", description: "Według 1024 jak Eksplorator plików, te same liczby z KiB i MiB albo według 1000 jak producenci dysków, aby dysk 1 TB pokazywał 1 TB." },
        startupDisabled: { title: "Usuń wszystkie wyłączone wpisy", description: "Jedno kliknięcie usuwa każdy wyłączony wpis Run i skrót w folderze Autostart jako jedną partię z jednym Cofnij." }
      }
    }
  },
  ps: {
    whatsNewV32: {
      ui: {
        title: (a) => `په Prune ${a} کې نوي څه دي`,
        intro: "څو شیان چې پوهېدل یې ګټور دي، او چېرته یې موندلی شئ.",
        gotIt: "پوه شوم",
        showMe: "ما ته وښيه",
        backgroundNote: "بې ګټې فایلونه بیک اپونو او لاګونو ته لاس نه وروړي تر هغه چې تاسو هغه نمونې فعالې کړئ."
      },
      cards: {
        junkFiles: { title: "بې ګټې فایلونه", description: "په هغو ډرایوونو او فولډرونو کې چې تاسو یې ټاکئ، لنډمهاله فایلونه، زېرمې او د ټکر ډمپونه د نوم له مخې ومومئ، د داسې نمونو لېست سره چې سمولی یې شئ." },
        windowsTools: { title: "د Windows وسایل په یوه ځای کې", description: "د سیسټم بیا رغونه، د سیسټم فایل کتونکی، د پېښو لیدونکی، د وسیلو مدیر او د پخپله Windows نور وسایل، هر یو د یوې کرښې سره چې وايي د څه لپاره دی." },
        hidePrograms: { title: "پروګرامونه له لړلیک څخه پټ کړئ", description: "له لړلیک څخه پټ کړئ یو پروګرام له قطارونو او ټولټال څخه باسي پرته له دې چې بدل یې کړي. پټ شوي وښایاست یې بېرته راولي." },
        properties: { title: "ځانګړتیاوې د پروګرامونو له لړلیک څخه", description: "د یوه قطار مېنو د پروګرام د اجرا وړ فایل لپاره د پخپله Windows د ځانګړتیاوو پاڼه پرانیزي: نسخه، شرکت، لاسلیکونه او مطابقت." },
        installTraces: { title: "د نصب نښې له ځان سره یوسئ", description: "په «د څارنې سره نصب کړئ» کې، یو ثبت شوی نصب یا ټول یوه فایل ته صادر کړئ، بیا یې دلته یا په بل کمپیوټر کې وارد کړئ." },
        sizeUnits: { title: "وټاکئ چې اندازې څنګه ولیکل شي", description: "د فایل اکسپلورر په څېر پر 1024 ولاړ، همغه شمېرې د KiB او MiB سره، یا د ډرایو جوړوونکو په څېر پر 1000 ولاړ، نو یو 1 TB ډرایو 1 TB ښيي." },
        startupDisabled: { title: "ټولې بندې شوې ننوتنې لرې کړئ", description: "یو کلیک هره هغه Run ننوتنه او د پیل فولډر لنډلاره لرې کوي چې تاسو بنده کړې، د یوې ډلې په توګه چې په یوه ځل بېرته راګرځي." }
      }
    }
  },
  "pt-BR": {
    whatsNewV32: {
      ui: {
        title: (a) => `Novidades do Prune ${a}`,
        intro: "Algumas coisas que vale conhecer e onde encontrá-las.",
        gotIt: "Entendi",
        showMe: "Mostre-me",
        backgroundNote: "Arquivos inúteis deixa backups e logs em paz até você ativar esses padrões."
      },
      cards: {
        junkFiles: { title: "Arquivos inúteis", description: "Encontre arquivos temporários, caches e despejos de falhas pelo nome nas unidades e pastas que você escolher, com uma lista de padrões que você pode editar." },
        windowsTools: { title: "Ferramentas do Windows em um só lugar", description: "Restauração do Sistema, Verificador de Arquivos do Sistema, Visualizador de Eventos, Gerenciador de Dispositivos e mais ferramentas do próprio Windows, cada uma com uma linha sobre para que serve." },
        hidePrograms: { title: "Ocultar programas da lista", description: "Ocultar da lista tira um programa das linhas e dos totais sem alterá-lo. Mostrar ocultos o traz de volta." },
        properties: { title: "Propriedades direto da lista de programas", description: "O menu de uma linha abre a folha de Propriedades do próprio Windows para o executável do programa: versão, empresa, assinaturas e compatibilidade." },
        installTraces: { title: "Leve os rastros de instalação com você", description: "Em Instalar com monitoramento, exporte uma instalação registrada ou todas para um arquivo e importe-o aqui ou em outro PC." },
        sizeUnits: { title: "Escolha como os tamanhos são escritos", description: "Na base 1024 como o Explorador de Arquivos, os mesmos números com KiB e MiB, ou na base 1000 como os fabricantes de unidades, para que uma unidade de 1 TB mostre 1 TB." },
        startupDisabled: { title: "Remover todas as entradas desativadas", description: "Um clique remove todas as entradas de Run e atalhos da pasta Inicializar que você desativou, como um único lote com um único Desfazer." }
      }
    }
  },
  pt: {
    whatsNewV32: {
      ui: {
        title: (a) => `Novidades do Prune ${a}`,
        intro: "Algumas coisas que vale a pena conhecer e onde as encontrar.",
        gotIt: "Percebi",
        showMe: "Mostrar",
        backgroundNote: "Ficheiros inúteis deixa as cópias de segurança e os registos em paz até ativar esses padrões."
      },
      cards: {
        junkFiles: { title: "Ficheiros inúteis", description: "Encontre ficheiros temporários, caches e despejos de falhas pelo nome nas unidades e pastas que escolher, com uma lista de padrões que pode editar." },
        windowsTools: { title: "Ferramentas do Windows num só lugar", description: "Restauro do Sistema, Verificador de Ficheiros de Sistema, Visualizador de Eventos, Gestor de Dispositivos e mais ferramentas do próprio Windows, cada uma com uma linha sobre para que serve." },
        hidePrograms: { title: "Ocultar programas da lista", description: "Ocultar da lista retira um programa das linhas e dos totais sem o alterar. Mostrar ocultos trá-lo de volta." },
        properties: { title: "Propriedades a partir da lista de programas", description: "O menu de uma linha abre a folha de Propriedades do próprio Windows para o executável do programa: versão, empresa, assinaturas e compatibilidade." },
        installTraces: { title: "Leve os rastos de instalação consigo", description: "Em Instalar com monitorização, exporte uma instalação registada ou todas para um ficheiro e importe-o aqui ou noutro PC." },
        sizeUnits: { title: "Escolha como os tamanhos são escritos", description: "Na base 1024 como o Explorador de Ficheiros, os mesmos números com KiB e MiB, ou na base 1000 como os fabricantes de unidades, para que uma unidade de 1 TB mostre 1 TB." },
        startupDisabled: { title: "Remover todas as entradas desativadas", description: "Um clique remove todas as entradas de Run e atalhos da pasta Arranque que desativou, como um único lote com um único Anular." }
      }
    }
  },
  ro: {
    whatsNewV32: {
      ui: {
        title: (a) => `Noutăți în Prune ${a}`,
        intro: "Câteva lucruri bune de știut și unde le găsești.",
        gotIt: "Am înțeles",
        showMe: "Arată-mi",
        backgroundNote: "Fișiere inutile lasă în pace copiile de rezervă și jurnalele până activezi acele modele."
      },
      cards: {
        junkFiles: { title: "Fișiere inutile", description: "Găsește fișiere temporare, memorii cache și imagini de blocare după nume pe unitățile și în folderele pe care le alegi, cu o listă de modele pe care o poți edita." },
        windowsTools: { title: "Instrumentele Windows într-un singur loc", description: "Restaurare sistem, Verificatorul de fișiere de sistem, Vizualizatorul de evenimente, Managerul de dispozitive și alte instrumente ale Windows, fiecare cu un rând despre la ce folosește." },
        hidePrograms: { title: "Ascunde programe din listă", description: "Ascunde din listă scoate un program din rânduri și din totaluri fără să-l modifice. Afișează ascunsele îl aduce înapoi." },
        properties: { title: "Proprietăți direct din lista de programe", description: "Meniul unui rând deschide foaia Proprietăți a Windows pentru executabilul programului: versiune, companie, semnături și compatibilitate." },
        installTraces: { title: "Ia urmele instalărilor cu tine", description: "În Instalează cu monitorizare, exportă o instalare înregistrată sau pe toate într-un fișier, apoi importă-l aici sau pe alt PC." },
        sizeUnits: { title: "Alege cum se scriu dimensiunile", description: "Pe bază de 1024 ca Explorerul de fișiere, aceleași cifre cu KiB și MiB, sau pe bază de 1000 ca producătorii de unități, ca o unitate de 1 TB să arate 1 TB." },
        startupDisabled: { title: "Elimină toate intrările dezactivate", description: "Un clic elimină fiecare intrare Run și comandă rapidă din folderul Pornire pe care ai oprit-o, ca un singur lot cu o singură Anulare." }
      }
    }
  },
  ru: {
    whatsNewV32: {
      ui: {
        title: (a) => `Что нового в Prune ${a}`,
        intro: "Несколько полезных возможностей и где их найти.",
        gotIt: "Понятно",
        showMe: "Показать",
        backgroundNote: "«Ненужные файлы» не трогают резервные копии и журналы, пока вы не включите эти шаблоны."
      },
      cards: {
        junkFiles: { title: "Ненужные файлы", description: "Находите временные файлы, кэши и аварийные дампы по имени на выбранных дисках и в папках, по списку шаблонов, который можно изменить." },
        windowsTools: { title: "Средства Windows в одном месте", description: "Восстановление системы, проверка системных файлов, «Просмотр событий», «Диспетчер устройств» и другие средства самой Windows, у каждого — строка о том, для чего оно." },
        hidePrograms: { title: "Скрытие программ из списка", description: "«Скрыть из списка» убирает программу из строк и итогов, ничего в ней не меняя. «Показать скрытые» возвращает её." },
        properties: { title: "Свойства прямо из списка программ", description: "Меню строки открывает окно «Свойства» самой Windows для исполняемого файла программы: версия, компания, подписи и совместимость." },
        installTraces: { title: "Следы установки — с собой", description: "В окне «Установить с наблюдением» экспортируйте одну записанную установку или все в файл, а затем импортируйте его здесь или на другом компьютере." },
        sizeUnits: { title: "Выберите, как записывать размеры", description: "По 1024, как в Проводнике, те же числа с KiB и MiB или по 1000, как у производителей дисков, — тогда диск на 1 TB показывает 1 TB." },
        startupDisabled: { title: "Удаление всех отключённых записей", description: "Один щелчок удаляет все отключённые вами записи Run и ярлыки в папке автозагрузки одним пакетом с одной отменой." }
      }
    }
  },
  sk: {
    whatsNewV32: {
      ui: {
        title: (a) => `Čo je nové v Prune ${a}`,
        intro: "Niekoľko vecí, ktoré stoja za zmienku, a kde ich nájdete.",
        gotIt: "Rozumiem",
        showMe: "Ukázať",
        backgroundNote: "Nepotrebné súbory nechávajú zálohy a denníky na pokoji, kým tieto vzory nezapnete."
      },
      cards: {
        junkFiles: { title: "Nepotrebné súbory", description: "Nájdite dočasné súbory, vyrovnávacie pamäte a výpisy pádov podľa názvu na jednotkách a v priečinkoch, ktoré vyberiete, so zoznamom vzorov, ktorý môžete upraviť." },
        windowsTools: { title: "Nástroje Windows na jednom mieste", description: "Obnovovanie systému, Kontrola systémových súborov, Zobrazovač udalostí, Správca zariadení a ďalšie vlastné nástroje Windows, každý s riadkom o tom, na čo slúži." },
        hidePrograms: { title: "Skrytie programov zo zoznamu", description: "Skryť zo zoznamu odoberie program z riadkov aj súčtov bez toho, aby ho zmenilo. Zobraziť skryté ho vráti späť." },
        properties: { title: "Vlastnosti priamo zo zoznamu programov", description: "Ponuka riadka otvorí okno Vlastnosti systému Windows pre spustiteľný súbor programu: verzia, spoločnosť, podpisy a kompatibilita." },
        installTraces: { title: "Stopy inštalácií so sebou", description: "V okne Inštalovať so sledovaním exportujte jednu zaznamenanú inštaláciu alebo všetky do súboru a importujte ho tu alebo na inom počítači." },
        sizeUnits: { title: "Zvoľte, ako sa píšu veľkosti", description: "Po 1024 ako Prieskumník, rovnaké čísla s KiB a MiB, alebo po 1000 ako výrobcovia diskov, takže disk 1 TB ukazuje 1 TB." },
        startupDisabled: { title: "Odstránenie všetkých vypnutých položiek", description: "Jedným kliknutím odstránite všetky položky Run a odkazy v priečinku Po spustení, ktoré ste vypli, ako jednu dávku s jedným Späť." }
      }
    }
  },
  sq: {
    whatsNewV32: {
      ui: {
        title: (a) => `Çfarë ka të re në Prune ${a}`,
        intro: "Disa gjëra që vlen t'i dini dhe ku t'i gjeni.",
        gotIt: "E kuptova",
        showMe: "Më trego",
        backgroundNote: "Skedarë të panevojshëm nuk prek kopjet rezervë dhe regjistrat derisa t'i aktivizoni ato modele."
      },
      cards: {
        junkFiles: { title: "Skedarë të panevojshëm", description: "Gjeni skedarë të përkohshëm, memorie të përkohshme dhe skedarë rrëzimi sipas emrit në disqet dhe dosjet që zgjidhni, me një listë modelesh që mund ta redaktoni." },
        windowsTools: { title: "Veglat e Windows në një vend", description: "Rikthimi i sistemit, Kontrolluesi i skedarëve të sistemit, Shikuesi i ngjarjeve, Menaxheri i pajisjeve dhe vegla të tjera të vetë Windows, secila me një rresht për çfarë shërben." },
        hidePrograms: { title: "Fshihni programe nga lista", description: "Fshih nga lista e heq një program nga rreshtat dhe totalet pa e ndryshuar. Shfaq të fshehurat e kthen." },
        properties: { title: "Vetitë direkt nga lista e programeve", description: "Menyja e një rreshti hap fletën Vetitë të vetë Windows për skedarin ekzekutues të programit: versioni, kompania, nënshkrimet dhe përputhshmëria." },
        installTraces: { title: "Merrni gjurmët e instalimit me vete", description: "Te Instalo me monitorim, eksportoni një instalim të regjistruar ose të gjitha në një skedar, pastaj importojeni këtu ose në një kompjuter tjetër." },
        sizeUnits: { title: "Zgjidhni si shkruhen madhësitë", description: "Me bazë 1024 si Eksploruesi i skedarëve, të njëjtat shifra me KiB dhe MiB, ose me bazë 1000 si prodhuesit e disqeve, që një disk 1 TB të tregojë 1 TB." },
        startupDisabled: { title: "Hiqni të gjitha hyrjet e çaktivizuara", description: "Një klikim heq çdo hyrje Run dhe shkurtore të dosjes së Nisjes që keni çaktivizuar, si një grup i vetëm me një Zhbëj të vetëm." }
      }
    }
  },
  sr: {
    whatsNewV32: {
      ui: {
        title: (a) => `Шта је ново у Prune ${a}`,
        intro: "Неколико ствари које вреди знати и где их наћи.",
        gotIt: "Разумем",
        showMe: "Покажи ми",
        backgroundNote: "Непотребне датотеке не дирају резервне копије и евиденције док не укључите те обрасце."
      },
      cards: {
        junkFiles: { title: "Непотребне датотеке", description: "Пронађите привремене датотеке, кешеве и исписе рушења по имену на дисковима и у фасциклама које изаберете, уз листу образаца коју можете да мењате." },
        windowsTools: { title: "Windows алатке на једном месту", description: "Враћање система у претходно стање, провера системских датотека, Приказивач догађаја, Управљач уређајима и друге алатке самог Windows-а, свака са редом о томе чему служи." },
        hidePrograms: { title: "Скривање програма са листе", description: "Сакриј са листе уклања програм из редова и збирова, а да га не мења. Прикажи скривене га враћа." },
        properties: { title: "Својства директно са листе програма", description: "Мени реда отвара прозор Својства самог Windows-а за извршну датотеку програма: верзија, компанија, потписи и компатибилност." },
        installTraces: { title: "Понесите трагове инсталације", description: "У прозору Инсталирај уз праћење извезите једну снимљену инсталацију или све у датотеку, па је увезите овде или на другом рачунару." },
        sizeUnits: { title: "Изаберите како се пишу величине", description: "На основу 1024 као Истраживач датотека, исти бројеви са KiB и MiB, или на основу 1000 као произвођачи дискова, тако да диск од 1 TB показује 1 TB." },
        startupDisabled: { title: "Уклањање свих онемогућених ставки", description: "Један клик уклања сваку Run ставку и пречицу у фасцикли за покретање коју сте искључили, као једну групу са једним опозивом." }
      }
    }
  },
  sv: {
    whatsNewV32: {
      ui: {
        title: (a) => `Nytt i Prune ${a}`,
        intro: "Några saker som är bra att känna till, och var du hittar dem.",
        gotIt: "Uppfattat",
        showMe: "Visa mig",
        backgroundNote: "Skräpfiler låter säkerhetskopior och loggar vara tills du aktiverar de mönstren."
      },
      cards: {
        junkFiles: { title: "Skräpfiler", description: "Hitta tillfälliga filer, cacheminnen och kraschdumpar efter namn på de enheter och mappar du väljer, med en mönsterlista som du kan redigera." },
        windowsTools: { title: "Windows-verktyg på ett ställe", description: "Systemåterställning, Systemfilskontroll, Loggboken, Enhetshanteraren och fler av Windows egna verktyg, vart och ett med en rad om vad det är till för." },
        hidePrograms: { title: "Dölj program i listan", description: "Dölj i listan tar bort ett program från raderna och summorna utan att ändra det. Visa dolda tar tillbaka det." },
        properties: { title: "Egenskaper direkt från programlistan", description: "En rads meny öppnar Windows egna Egenskaper-fönster för programmets körbara fil: version, företag, signaturer och kompatibilitet." },
        installTraces: { title: "Ta med dig installationsspår", description: "I Installera med övervakning exporterar du en registrerad installation eller alla till en fil och importerar den här eller på en annan dator." },
        sizeUnits: { title: "Välj hur storlekar skrivs", description: "1024-baserat som Utforskaren, samma siffror med KiB och MiB, eller 1000-baserat som en enhetstillverkare, så att en enhet på 1 TB visar 1 TB." },
        startupDisabled: { title: "Ta bort alla inaktiverade poster", description: "Ett klick tar bort alla Run-poster och genvägar i Autostart-mappen som du har stängt av, som en enda omgång med en enda Ångra." }
      }
    }
  },
  th: {
    whatsNewV32: {
      ui: {
        title: (a) => `มีอะไรใหม่ใน Prune ${a}`,
        intro: "ไม่กี่อย่างที่ควรรู้ และจะหาได้ที่ไหน",
        gotIt: "เข้าใจแล้ว",
        showMe: "แสดงให้ดู",
        backgroundNote: "ไฟล์ขยะจะไม่แตะไฟล์สำรองและไฟล์บันทึกจนกว่าคุณจะเปิดรูปแบบเหล่านั้น"
      },
      cards: {
        junkFiles: { title: "ไฟล์ขยะ", description: "ค้นหาไฟล์ชั่วคราว แคช และไฟล์ดัมพ์จากการขัดข้องตามชื่อในไดรฟ์และโฟลเดอร์ที่คุณเลือก ด้วยรายการรูปแบบที่คุณแก้ไขได้" },
        windowsTools: { title: "เครื่องมือ Windows ในที่เดียว", description: "การคืนค่าระบบ ตัวตรวจสอบไฟล์ระบบ ตัวแสดงเหตุการณ์ ตัวจัดการอุปกรณ์ และเครื่องมืออื่นๆ ของ Windows เอง แต่ละรายการมีคำอธิบายหนึ่งบรรทัดว่าใช้ทำอะไร" },
        hidePrograms: { title: "ซ่อนโปรแกรมจากรายการ", description: "ซ่อนจากรายการจะนำโปรแกรมออกจากแถวและยอดรวมโดยไม่เปลี่ยนแปลงโปรแกรม แสดงรายการที่ซ่อนจะนำกลับมา" },
        properties: { title: "คุณสมบัติจากรายการโปรแกรม", description: "เมนูของแถวจะเปิดหน้าต่างคุณสมบัติของ Windows เองสำหรับไฟล์ปฏิบัติการของโปรแกรม: เวอร์ชัน บริษัท ลายเซ็น และความเข้ากันได้" },
        installTraces: { title: "นำร่องรอยการติดตั้งไปด้วย", description: "ในติดตั้งพร้อมการตรวจสอบ ส่งออกการติดตั้งที่บันทึกไว้หนึ่งรายการหรือทั้งหมดเป็นไฟล์ แล้วนำเข้าที่นี่หรือบนพีซีเครื่องอื่น" },
        sizeUnits: { title: "เลือกวิธีเขียนขนาด", description: "แบบฐาน 1024 เหมือน File Explorer ตัวเลขเดียวกันแต่ใช้ KiB และ MiB หรือแบบฐาน 1000 เหมือนผู้ผลิตไดรฟ์ ไดรฟ์ 1 TB จึงแสดงเป็น 1 TB" },
        startupDisabled: { title: "ลบรายการที่ปิดใช้งานทั้งหมด", description: "คลิกเดียวลบรายการ Run และทางลัดในโฟลเดอร์ Startup ทุกรายการที่คุณปิดไว้ เป็นชุดเดียวที่เลิกทำได้ในครั้งเดียว" }
      }
    }
  },
  tr: {
    whatsNewV32: {
      ui: {
        title: (a) => `Prune ${a} sürümünde yenilikler`,
        intro: "Bilmeye değer birkaç şey ve bunları nerede bulacağınız.",
        gotIt: "Anladım",
        showMe: "Göster",
        backgroundNote: "Gereksiz dosyalar, siz bu desenleri açana kadar yedeklere ve günlüklere dokunmaz."
      },
      cards: {
        junkFiles: { title: "Gereksiz dosyalar", description: "Seçtiğiniz sürücülerde ve klasörlerde geçici dosyaları, önbellekleri ve kilitlenme dökümlerini adlarına göre bulun; desen listesini düzenleyebilirsiniz." },
        windowsTools: { title: "Windows araçları tek yerde", description: "Sistem Geri Yükleme, Sistem Dosyası Denetleyicisi, Olay Görüntüleyicisi, Aygıt Yöneticisi ve Windows'un kendi diğer araçları, her biri ne işe yaradığını anlatan bir satırla." },
        hidePrograms: { title: "Programları listeden gizleyin", description: "Listeden gizle, bir programı değiştirmeden satırlardan ve toplamlardan çıkarır. Gizlileri göster onu geri getirir." },
        properties: { title: "Özellikler doğrudan program listesinden", description: "Bir satırın menüsü, programın yürütülebilir dosyası için Windows'un kendi Özellikler sayfasını açar: sürüm, şirket, imzalar ve uyumluluk." },
        installTraces: { title: "Yükleme izlerini yanınızda taşıyın", description: "İzleyerek yükle penceresinde kaydedilmiş bir yüklemeyi ya da hepsini bir dosyaya aktarın, sonra burada veya başka bir bilgisayarda içe aktarın." },
        sizeUnits: { title: "Boyutların nasıl yazılacağını seçin", description: "Dosya Gezgini gibi 1024 tabanlı, aynı sayılar KiB ve MiB ile ya da sürücü üreticileri gibi 1000 tabanlı; böylece 1 TB'lık bir sürücü 1 TB görünür." },
        startupDisabled: { title: "Tüm devre dışı girdileri kaldırın", description: "Tek tıklama, kapattığınız her Run girdisini ve Başlangıç klasörü kısayolunu tek bir toplu işlem olarak, tek bir Geri al ile kaldırır." }
      }
    }
  },
  uk: {
    whatsNewV32: {
      ui: {
        title: (a) => `Що нового в Prune ${a}`,
        intro: "Кілька речей, які варто знати, і де їх знайти.",
        gotIt: "Зрозуміло",
        showMe: "Показати",
        backgroundNote: "«Непотрібні файли» не чіпають резервні копії й журнали, доки ви не ввімкнете ці шаблони."
      },
      cards: {
        junkFiles: { title: "Непотрібні файли", description: "Знаходьте тимчасові файли, кеші та аварійні дампи за назвою на вибраних дисках і в папках, за списком шаблонів, який можна змінити." },
        windowsTools: { title: "Засоби Windows в одному місці", description: "Відновлення системи, перевірка системних файлів, «Переглядач подій», «Диспетчер пристроїв» та інші засоби самої Windows, у кожного — рядок про те, для чого він." },
        hidePrograms: { title: "Приховування програм зі списку", description: "«Приховати зі списку» прибирає програму з рядків і підсумків, нічого в ній не змінюючи. «Показати приховані» повертає її." },
        properties: { title: "Властивості просто зі списку програм", description: "Меню рядка відкриває вікно «Властивості» самої Windows для виконуваного файлу програми: версія, компанія, підписи й сумісність." },
        installTraces: { title: "Сліди встановлення — із собою", description: "У вікні «Встановити зі спостереженням» експортуйте одне записане встановлення або всі у файл, а потім імпортуйте його тут або на іншому комп'ютері." },
        sizeUnits: { title: "Виберіть, як записувати розміри", description: "За 1024, як у Провіднику, ті самі числа з KiB і MiB або за 1000, як у виробників дисків, — тоді диск на 1 TB показує 1 TB." },
        startupDisabled: { title: "Видалення всіх вимкнених записів", description: "Одне клацання видаляє всі вимкнені вами записи Run і ярлики в папці автозавантаження одним пакетом з одним скасуванням." }
      }
    }
  },
  vi: {
    whatsNewV32: {
      ui: {
        title: (a) => `Có gì mới trong Prune ${a}`,
        intro: "Một vài điều đáng biết và nơi tìm chúng.",
        gotIt: "Đã hiểu",
        showMe: "Chỉ cho tôi",
        backgroundNote: "Tệp rác không đụng đến bản sao lưu và nhật ký cho đến khi bạn bật các mẫu đó."
      },
      cards: {
        junkFiles: { title: "Tệp rác", description: "Tìm tệp tạm, bộ nhớ đệm và tệp kết xuất sự cố theo tên trên các ổ đĩa và thư mục bạn chọn, với danh sách mẫu bạn có thể chỉnh sửa." },
        windowsTools: { title: "Công cụ Windows ở một nơi", description: "Khôi phục Hệ thống, Trình kiểm tra Tệp Hệ thống, Trình xem Sự kiện, Trình quản lý Thiết bị và các công cụ khác của chính Windows, mỗi công cụ có một dòng cho biết dùng để làm gì." },
        hidePrograms: { title: "Ẩn chương trình khỏi danh sách", description: "Ẩn khỏi danh sách đưa một chương trình ra khỏi các hàng và tổng mà không thay đổi nó. Hiện mục đã ẩn đưa nó trở lại." },
        properties: { title: "Thuộc tính ngay từ danh sách chương trình", description: "Menu của một hàng mở bảng Thuộc tính của chính Windows cho tệp thực thi của chương trình: phiên bản, công ty, chữ ký và khả năng tương thích." },
        installTraces: { title: "Mang theo dấu vết cài đặt", description: "Trong Cài đặt có giám sát, xuất một lần cài đặt đã ghi hoặc tất cả ra một tệp, rồi nhập lại ở đây hoặc trên PC khác." },
        sizeUnits: { title: "Chọn cách ghi kích thước", description: "Theo cơ số 1024 như File Explorer, cùng con số đó với KiB và MiB, hoặc theo cơ số 1000 như nhà sản xuất ổ đĩa, để ổ 1 TB hiện đúng 1 TB." },
        startupDisabled: { title: "Xóa mọi mục đã tắt", description: "Một cú nhấp xóa mọi mục Run và lối tắt trong thư mục Khởi động mà bạn đã tắt, thành một lô với một lần Hoàn tác." }
      }
    }
  },
  "zh-CN": {
    whatsNewV32: {
      ui: {
        title: (a) => `Prune ${a} 新功能`,
        intro: "几项值得了解的功能，以及在哪里找到它们。",
        gotIt: "知道了",
        showMe: "带我去看",
        backgroundNote: "在你打开相应模式之前，垃圾文件不会动备份和日志文件。"
      },
      cards: {
        junkFiles: { title: "垃圾文件", description: "在你选择的驱动器和文件夹中按名称查找临时文件、缓存和崩溃转储，模式列表可以自行编辑。" },
        windowsTools: { title: "Windows 工具集中一处", description: "系统还原、系统文件检查器、事件查看器、设备管理器等 Windows 自带工具，每个都附一行用途说明。" },
        hidePrograms: { title: "从列表中隐藏程序", description: "“从列表中隐藏”会把程序移出列表行和总计，但不改动程序本身。“显示已隐藏项”可将其找回。" },
        properties: { title: "直接从程序列表打开属性", description: "行菜单可为程序的可执行文件打开 Windows 自带的属性窗口：版本、公司、签名和兼容性。" },
        installTraces: { title: "随身带走安装记录", description: "在“监控安装”中，可将一条或全部已记录的安装导出到文件，再在本机或另一台电脑上导入。" },
        sizeUnits: { title: "选择大小的写法", description: "像文件资源管理器那样以 1024 为基数，用 KiB 和 MiB 写同样的数值，或像硬盘厂商那样以 1000 为基数，让 1 TB 的硬盘显示为 1 TB。" },
        startupDisabled: { title: "删除所有已禁用项", description: "一次点击即可删除你关闭的所有 Run 项和启动文件夹快捷方式，作为一批处理，一次撤消即可恢复。" }
      }
    }
  },
  "zh-TW": {
    whatsNewV32: {
      ui: {
        title: (a) => `Prune ${a} 新功能`,
        intro: "幾項值得了解的功能，以及在哪裡找到它們。",
        gotIt: "知道了",
        showMe: "帶我去看",
        backgroundNote: "在你開啟相應樣式之前，垃圾檔案不會動備份和記錄檔。"
      },
      cards: {
        junkFiles: { title: "垃圾檔案", description: "在你選擇的磁碟機和資料夾中依名稱尋找暫存檔、快取和當機傾印，樣式清單可以自行編輯。" },
        windowsTools: { title: "Windows 工具集中一處", description: "系統還原、系統檔案檢查程式、事件檢視器、裝置管理員等 Windows 內建工具，每個都附一行用途說明。" },
        hidePrograms: { title: "從清單中隱藏程式", description: "「從清單中隱藏」會把程式移出清單列和總計，但不更動程式本身。「顯示已隱藏項目」可將其找回。" },
        properties: { title: "直接從程式清單開啟內容", description: "列的選單可為程式的執行檔開啟 Windows 內建的內容視窗：版本、公司、簽章和相容性。" },
        installTraces: { title: "隨身帶走安裝記錄", description: "在「監控安裝」中，可將一筆或全部已記錄的安裝匯出成檔案，再於本機或另一台電腦上匯入。" },
        sizeUnits: { title: "選擇大小的寫法", description: "像檔案總管那樣以 1024 為基數，用 KiB 和 MiB 寫同樣的數值，或像硬碟廠商那樣以 1000 為基數，讓 1 TB 的硬碟顯示為 1 TB。" },
        startupDisabled: { title: "移除所有已停用項目", description: "按一下即可移除你關閉的所有 Run 項目和啟動資料夾捷徑，作為一批處理，一次復原即可還原。" }
      }
    }
  }
};
