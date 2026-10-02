// Disk Map v3 UI text (drive picker, administrator scan, sizes, search, export,
// saved scans), all 40 languages: { en: { ... }, af: { ... }, ... }.
// Merged into the catalog by ../catalog.js; every key lives under diskMapV3.
export default {
  en: {
    diskMapV3: {
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
      }
    }
  },
  af: {
    diskMapV3: {
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
      }
    }
  },
  ar: {
    diskMapV3: {
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
      }
    }
  },
  ca: {
    diskMapV3: {
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
      }
    }
  },
  cs: {
    diskMapV3: {
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
      }
    }
  },
  cy: {
    diskMapV3: {
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
      }
    }
  },
  da: {
    diskMapV3: {
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
      }
    }
  },
  de: {
    diskMapV3: {
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
      }
    }
  },
  el: {
    diskMapV3: {
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
      }
    }
  },
  es: {
    diskMapV3: {
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
      }
    }
  },
  et: {
    diskMapV3: {
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
      }
    }
  },
  fi: {
    diskMapV3: {
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
      }
    }
  },
  fr: {
    diskMapV3: {
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
      }
    }
  },
  he: {
    diskMapV3: {
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
      }
    }
  },
  hu: {
    diskMapV3: {
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
      }
    }
  },
  id: {
    diskMapV3: {
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
      }
    }
  },
  is: {
    diskMapV3: {
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
      }
    }
  },
  it: {
    diskMapV3: {
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
      }
    }
  },
  ja: {
    diskMapV3: {
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
      }
    }
  },
  ko: {
    diskMapV3: {
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
      }
    }
  },
  lt: {
    diskMapV3: {
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
      }
    }
  },
  ms: {
    diskMapV3: {
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
      }
    }
  },
  nb: {
    diskMapV3: {
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
      }
    }
  },
  nl: {
    diskMapV3: {
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
      }
    }
  },
  pl: {
    diskMapV3: {
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
      }
    }
  },
  ps: {
    diskMapV3: {
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
      }
    }
  },
  "pt-BR": {
    diskMapV3: {
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
      }
    }
  },
  pt: {
    diskMapV3: {
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
      }
    }
  },
  ro: {
    diskMapV3: {
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
      }
    }
  },
  ru: {
    diskMapV3: {
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
      }
    }
  },
  sk: {
    diskMapV3: {
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
      }
    }
  },
  sq: {
    diskMapV3: {
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
      }
    }
  },
  sr: {
    diskMapV3: {
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
      }
    }
  },
  sv: {
    diskMapV3: {
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
      }
    }
  },
  th: {
    diskMapV3: {
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
      }
    }
  },
  tr: {
    diskMapV3: {
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
      }
    }
  },
  uk: {
    diskMapV3: {
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
      }
    }
  },
  vi: {
    diskMapV3: {
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
      }
    }
  },
  "zh-CN": {
    diskMapV3: {
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
      }
    }
  },
  "zh-TW": {
    diskMapV3: {
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
      }
    }
  }
};
