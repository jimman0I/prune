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
      }
    }
  }
};
