// Install traces as a portable file: export one or all to a .prunetraces file, import them back
// (components/InstallMonitorDialog.jsx, backend/src/services/installTraceFile.js). All 40 languages:
// { en: { uninstallerV3: { monitor: { traceFile: { ... } } } }, af: ... }. Merged into the catalog by
// ../catalog.js. Each language keeps its own existing words for "install trace", "record", Export and
// Import (uninstaller.js, the Startup export, Deep Clean's cleaner import). The import summary is written
// as "label: n" so no language needs a plural rule for it.
export default {
  en: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "Import…",
          exportAll: "Export all",
          export: "Export",
          exportFor: (n) => `Export the record of ${n}`,
          hint: "Export saves these records to a .prunetraces file. Import brings them back, on this PC or on another one with the same programs.",
          empty: "No installs recorded yet.",
          notInstalled: "Not installed here",
          importedToast: (i, s, r) => `Install traces imported: ${i}. Already here, skipped: ${s}. Rejected: ${r}.`,
          importFailed: (m) => `Couldn't import the file: ${m}`,
          exportFailed: (m) => `Couldn't export: ${m}`,
          error: {
            tooLarge: "That file is too large to be an install trace file (the limit is 16 MB).",
            notJson: "That file isn't an install trace file: it isn't readable JSON.",
            notTraceFile: "That file isn't an install trace file exported by Prune.",
            newerVersion: "That file was exported by a newer version of Prune. Update Prune to import it.",
            tooMany: "That file holds more than 1000 install traces, more than Prune imports at once."
          }
        }
      }
    }
  },
  af: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "Voer in…",
          exportAll: "Voer alles uit",
          export: "Voer uit",
          exportFor: (n) => `Voer die rekord van ${n} uit`,
          hint: "Voer uit stoor hierdie rekords in 'n .prunetraces-lêer. Voer in bring hulle terug, op hierdie rekenaar of op 'n ander een met dieselfde programme.",
          empty: "Nog geen installasies opgeteken nie.",
          notInstalled: "Nie hier geïnstalleer nie",
          importedToast: (i, s, r) => `Installasiespore ingevoer: ${i}. Reeds hier, oorgeslaan: ${s}. Verwerp: ${r}.`,
          importFailed: (m) => `Kon nie die lêer invoer nie: ${m}`,
          exportFailed: (m) => `Kon nie uitvoer nie: ${m}`,
          error: {
            tooLarge: "Daardie lêer is te groot om 'n installasiespoorlêer te wees (die limiet is 16 MB).",
            notJson: "Daardie lêer is nie 'n installasiespoorlêer nie: dit is nie leesbare JSON nie.",
            notTraceFile: "Daardie lêer is nie 'n installasiespoorlêer wat deur Prune uitgevoer is nie.",
            newerVersion: "Daardie lêer is deur 'n nuwer weergawe van Prune uitgevoer. Werk Prune by om dit in te voer.",
            tooMany: "Daardie lêer bevat meer as 1000 installasiespore, meer as wat Prune op een slag invoer."
          }
        }
      }
    }
  },
  ar: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "استيراد…",
          exportAll: "تصدير الكل",
          export: "تصدير",
          exportFor: (n) => `تصدير سجل ${n}`,
          hint: "يحفظ التصدير هذه السجلات في ملف ‎.prunetraces. ويعيدها الاستيراد، على هذا الكمبيوتر أو على كمبيوتر آخر مثبَّتة عليه البرامج نفسها.",
          empty: "لم تُسجَّل أي عمليات تثبيت بعد.",
          notInstalled: "غير مثبَّت هنا",
          importedToast: (i, s, r) => `آثار التثبيت المستوردة: ${i}. موجودة هنا مسبقًا وتم تخطيها: ${s}. المرفوضة: ${r}.`,
          importFailed: (m) => `تعذّر استيراد الملف: ${m}`,
          exportFailed: (m) => `تعذّر التصدير: ${m}`,
          error: {
            tooLarge: "هذا الملف أكبر من أن يكون ملف آثار تثبيت (الحد 16 ميغابايت).",
            notJson: "هذا الملف ليس ملف آثار تثبيت: إنه ليس JSON قابلًا للقراءة.",
            notTraceFile: "هذا الملف ليس ملف آثار تثبيت صدّره Prune.",
            newerVersion: "صُدِّر هذا الملف بإصدار أحدث من Prune. حدِّث Prune لاستيراده.",
            tooMany: "يحتوي هذا الملف على أكثر من 1000 أثر تثبيت، وهو أكثر مما يستورده Prune دفعة واحدة."
          }
        }
      }
    }
  },
  ca: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "Importa…",
          exportAll: "Exporta-ho tot",
          export: "Exporta",
          exportFor: (n) => `Exporta el registre de ${n}`,
          hint: "Exporta desa aquests registres en un fitxer .prunetraces. Importa els torna a portar, en aquest PC o en un altre amb els mateixos programes.",
          empty: "Encara no s'ha registrat cap instal·lació.",
          notInstalled: "No instal·lat aquí",
          importedToast: (i, s, r) => `Rastres d'instal·lació importats: ${i}. Ja hi eren, omesos: ${s}. Rebutjats: ${r}.`,
          importFailed: (m) => `No s'ha pogut importar el fitxer: ${m}`,
          exportFailed: (m) => `No s'ha pogut exportar: ${m}`,
          error: {
            tooLarge: "Aquest fitxer és massa gran per ser un fitxer de rastres d'instal·lació (el límit és de 16 MB).",
            notJson: "Aquest fitxer no és un fitxer de rastres d'instal·lació: no és JSON llegible.",
            notTraceFile: "Aquest fitxer no és un fitxer de rastres d'instal·lació exportat per Prune.",
            newerVersion: "Aquest fitxer s'ha exportat amb una versió més nova de Prune. Actualitza Prune per importar-lo.",
            tooMany: "Aquest fitxer conté més de 1000 rastres d'instal·lació, més dels que Prune importa de cop."
          }
        }
      }
    }
  },
  cs: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "Importovat…",
          exportAll: "Exportovat vše",
          export: "Exportovat",
          exportFor: (n) => `Exportovat záznam o ${n}`,
          hint: "Export uloží tyto záznamy do souboru .prunetraces. Import je vrátí zpět, na tomto počítači nebo na jiném se stejnými programy.",
          empty: "Zatím nejsou zaznamenány žádné instalace.",
          notInstalled: "Zde nenainstalováno",
          importedToast: (i, s, r) => `Importované záznamy instalací: ${i}. Už zde, přeskočeno: ${s}. Odmítnuto: ${r}.`,
          importFailed: (m) => `Soubor se nepodařilo importovat: ${m}`,
          exportFailed: (m) => `Export se nezdařil: ${m}`,
          error: {
            tooLarge: "Tento soubor je příliš velký na to, aby byl souborem záznamů instalací (limit je 16 MB).",
            notJson: "Tento soubor není souborem záznamů instalací: nejde o čitelný JSON.",
            notTraceFile: "Tento soubor není souborem záznamů instalací exportovaným z Prune.",
            newerVersion: "Tento soubor byl exportován novější verzí Prune. Pro import Prune aktualizujte.",
            tooMany: "Tento soubor obsahuje více než 1000 záznamů instalací, víc, než Prune naimportuje najednou."
          }
        }
      }
    }
  },
  cy: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "Mewnforio…",
          exportAll: "Allforio'r cyfan",
          export: "Allforio",
          exportFor: (n) => `Allforio cofnod ${n}`,
          hint: "Mae Allforio yn cadw'r cofnodion hyn mewn ffeil .prunetraces. Mae Mewnforio yn dod â nhw'n ôl, ar y cyfrifiadur hwn neu ar un arall gyda'r un rhaglenni.",
          empty: "Dim gosodiadau wedi'u cofnodi eto.",
          notInstalled: "Heb ei osod yma",
          importedToast: (i, s, r) => `Olrheinion gosod a fewnforiwyd: ${i}. Yma eisoes, wedi'u hepgor: ${s}. Wedi'u gwrthod: ${r}.`,
          importFailed: (m) => `Methu mewnforio'r ffeil: ${m}`,
          exportFailed: (m) => `Methu allforio: ${m}`,
          error: {
            tooLarge: "Mae'r ffeil honno'n rhy fawr i fod yn ffeil olrhain gosod (y terfyn yw 16 MB).",
            notJson: "Nid ffeil olrhain gosod yw'r ffeil honno: nid yw'n JSON darllenadwy.",
            notTraceFile: "Nid ffeil olrhain gosod a allforiwyd gan Prune yw'r ffeil honno.",
            newerVersion: "Cafodd y ffeil honno ei hallforio gan fersiwn mwy newydd o Prune. Diweddarwch Prune i'w mewnforio.",
            tooMany: "Mae'r ffeil honno'n dal mwy na 1000 o olrheinion gosod, mwy nag y mae Prune yn ei fewnforio ar unwaith."
          }
        }
      }
    }
  },
  da: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "Importér…",
          exportAll: "Eksportér alle",
          export: "Eksportér",
          exportFor: (n) => `Eksportér registreringen af ${n}`,
          hint: "Eksportér gemmer disse registreringer i en .prunetraces-fil. Importér henter dem tilbage, på denne pc eller på en anden med de samme programmer.",
          empty: "Ingen installationer registreret endnu.",
          notInstalled: "Ikke installeret her",
          importedToast: (i, s, r) => `Installationssporinger importeret: ${i}. Allerede her, sprunget over: ${s}. Afvist: ${r}.`,
          importFailed: (m) => `Filen kunne ikke importeres: ${m}`,
          exportFailed: (m) => `Kunne ikke eksportere: ${m}`,
          error: {
            tooLarge: "Den fil er for stor til at være en installationssporingsfil (grænsen er 16 MB).",
            notJson: "Den fil er ikke en installationssporingsfil: den er ikke læsbar JSON.",
            notTraceFile: "Den fil er ikke en installationssporingsfil eksporteret af Prune.",
            newerVersion: "Den fil blev eksporteret af en nyere version af Prune. Opdatér Prune for at importere den.",
            tooMany: "Den fil indeholder mere end 1000 installationssporinger, flere end Prune importerer på én gang."
          }
        }
      }
    }
  },
  de: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "Importieren…",
          exportAll: "Alle exportieren",
          export: "Exportieren",
          exportFor: (n) => `Aufzeichnung von ${n} exportieren`,
          hint: "Exportieren speichert diese Aufzeichnungen in einer .prunetraces-Datei. Importieren holt sie zurück, auf diesem PC oder auf einem anderen mit denselben Programmen.",
          empty: "Noch keine Installationen aufgezeichnet.",
          notInstalled: "Hier nicht installiert",
          importedToast: (i, s, r) => `Installationsaufzeichnungen importiert: ${i}. Schon vorhanden, übersprungen: ${s}. Abgelehnt: ${r}.`,
          importFailed: (m) => `Die Datei konnte nicht importiert werden: ${m}`,
          exportFailed: (m) => `Export fehlgeschlagen: ${m}`,
          error: {
            tooLarge: "Diese Datei ist zu groß für eine Datei mit Installationsaufzeichnungen (die Grenze liegt bei 16 MB).",
            notJson: "Diese Datei enthält keine Installationsaufzeichnungen: Sie ist kein lesbares JSON.",
            notTraceFile: "Diese Datei ist keine von Prune exportierte Datei mit Installationsaufzeichnungen.",
            newerVersion: "Diese Datei wurde von einer neueren Version von Prune exportiert. Aktualisieren Sie Prune, um sie zu importieren.",
            tooMany: "Diese Datei enthält mehr als 1000 Installationsaufzeichnungen, mehr als Prune auf einmal importiert."
          }
        }
      }
    }
  },
  el: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "Εισαγωγή…",
          exportAll: "Εξαγωγή όλων",
          export: "Εξαγωγή",
          exportFor: (n) => `Εξαγωγή της καταγραφής του ${n}`,
          hint: "Η εξαγωγή αποθηκεύει αυτές τις καταγραφές σε αρχείο .prunetraces. Η εισαγωγή τις επαναφέρει, σε αυτόν τον υπολογιστή ή σε άλλον με τα ίδια προγράμματα.",
          empty: "Δεν έχουν καταγραφεί ακόμη εγκαταστάσεις.",
          notInstalled: "Δεν είναι εγκατεστημένο εδώ",
          importedToast: (i, s, r) => `Ίχνη εγκατάστασης που εισήχθησαν: ${i}. Υπήρχαν ήδη, παραλείφθηκαν: ${s}. Απορρίφθηκαν: ${r}.`,
          importFailed: (m) => `Δεν ήταν δυνατή η εισαγωγή του αρχείου: ${m}`,
          exportFailed: (m) => `Δεν ήταν δυνατή η εξαγωγή: ${m}`,
          error: {
            tooLarge: "Αυτό το αρχείο είναι πολύ μεγάλο για αρχείο ιχνών εγκατάστασης (το όριο είναι 16 MB).",
            notJson: "Αυτό το αρχείο δεν είναι αρχείο ιχνών εγκατάστασης: δεν είναι αναγνώσιμο JSON.",
            notTraceFile: "Αυτό το αρχείο δεν είναι αρχείο ιχνών εγκατάστασης που εξήχθη από το Prune.",
            newerVersion: "Αυτό το αρχείο εξήχθη από νεότερη έκδοση του Prune. Ενημερώστε το Prune για να το εισαγάγετε.",
            tooMany: "Αυτό το αρχείο περιέχει περισσότερα από 1000 ίχνη εγκατάστασης, περισσότερα από όσα εισάγει το Prune με τη μία."
          }
        }
      }
    }
  },
  es: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "Importar…",
          exportAll: "Exportar todo",
          export: "Exportar",
          exportFor: (n) => `Exportar el registro de ${n}`,
          hint: "Exportar guarda estos registros en un archivo .prunetraces. Importar los recupera, en este equipo o en otro con los mismos programas.",
          empty: "Aún no hay instalaciones registradas.",
          notInstalled: "No instalado aquí",
          importedToast: (i, s, r) => `Rastros de instalación importados: ${i}. Ya estaban, omitidos: ${s}. Rechazados: ${r}.`,
          importFailed: (m) => `No se pudo importar el archivo: ${m}`,
          exportFailed: (m) => `No se pudo exportar: ${m}`,
          error: {
            tooLarge: "Ese archivo es demasiado grande para ser un archivo de rastros de instalación (el límite es de 16 MB).",
            notJson: "Ese archivo no es un archivo de rastros de instalación: no es JSON legible.",
            notTraceFile: "Ese archivo no es un archivo de rastros de instalación exportado por Prune.",
            newerVersion: "Ese archivo se exportó con una versión más reciente de Prune. Actualiza Prune para importarlo.",
            tooMany: "Ese archivo contiene más de 1000 rastros de instalación, más de los que Prune importa de una vez."
          }
        }
      }
    }
  },
  et: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "Impordi…",
          exportAll: "Ekspordi kõik",
          export: "Ekspordi",
          exportFor: (n) => `Ekspordi ${n} salvestus`,
          hint: "Eksport salvestab need kirjed .prunetraces-faili. Import toob need tagasi, sellesse arvutisse või teise, kus on samad programmid.",
          empty: "Paigaldusi pole veel salvestatud.",
          notInstalled: "Siin pole paigaldatud",
          importedToast: (i, s, r) => `Imporditud paigalduse jälgi: ${i}. Juba olemas, vahele jäetud: ${s}. Tagasi lükatud: ${r}.`,
          importFailed: (m) => `Faili ei saanud importida: ${m}`,
          exportFailed: (m) => `Eksportimine ebaõnnestus: ${m}`,
          error: {
            tooLarge: "See fail on paigalduse jälgede faili jaoks liiga suur (piirang on 16 MB).",
            notJson: "See fail ei ole paigalduse jälgede fail: see pole loetav JSON.",
            notTraceFile: "See fail ei ole Prune'i eksporditud paigalduse jälgede fail.",
            newerVersion: "See fail eksporditi Prune'i uuema versiooniga. Selle importimiseks värskenda Prune'i.",
            tooMany: "Selles failis on üle 1000 paigalduse jälje, rohkem kui Prune korraga impordib."
          }
        }
      }
    }
  },
  fi: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "Tuo…",
          exportAll: "Vie kaikki",
          export: "Vie",
          exportFor: (n) => `Vie ${n}: tallenne`,
          hint: "Vienti tallentaa nämä tallenteet .prunetraces-tiedostoon. Tuonti palauttaa ne, tähän tietokoneeseen tai toiseen, jossa on samat ohjelmat.",
          empty: "Asennuksia ei ole vielä tallennettu.",
          notInstalled: "Ei asennettu tähän koneeseen",
          importedToast: (i, s, r) => `Tuodut asennusjäljet: ${i}. Jo täällä, ohitettu: ${s}. Hylätty: ${r}.`,
          importFailed: (m) => `Tiedostoa ei voitu tuoda: ${m}`,
          exportFailed: (m) => `Vienti epäonnistui: ${m}`,
          error: {
            tooLarge: "Tiedosto on liian suuri asennusjälkitiedostoksi (raja on 16 Mt).",
            notJson: "Tiedosto ei ole asennusjälkitiedosto: se ei ole luettavaa JSONia.",
            notTraceFile: "Tiedosto ei ole Prunen viemä asennusjälkitiedosto.",
            newerVersion: "Tiedosto on viety Prunen uudemmalla versiolla. Päivitä Prune tuodaksesi sen.",
            tooMany: "Tiedostossa on yli 1000 asennusjälkeä, enemmän kuin Prune tuo kerralla."
          }
        }
      }
    }
  },
  fr: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "Importer…",
          exportAll: "Tout exporter",
          export: "Exporter",
          exportFor: (n) => `Exporter l'enregistrement de ${n}`,
          hint: "Exporter enregistre ces traces dans un fichier .prunetraces. Importer les ramène, sur ce PC ou sur un autre doté des mêmes programmes.",
          empty: "Aucune installation enregistrée pour l'instant.",
          notInstalled: "Non installé ici",
          importedToast: (i, s, r) => `Traces d'installation importées : ${i}. Déjà présentes, ignorées : ${s}. Refusées : ${r}.`,
          importFailed: (m) => `Impossible d'importer le fichier : ${m}`,
          exportFailed: (m) => `Impossible d'exporter : ${m}`,
          error: {
            tooLarge: "Ce fichier est trop volumineux pour être un fichier de traces d'installation (la limite est de 16 Mo).",
            notJson: "Ce fichier n'est pas un fichier de traces d'installation : ce n'est pas du JSON lisible.",
            notTraceFile: "Ce fichier n'est pas un fichier de traces d'installation exporté par Prune.",
            newerVersion: "Ce fichier a été exporté par une version plus récente de Prune. Mettez Prune à jour pour l'importer.",
            tooMany: "Ce fichier contient plus de 1000 traces d'installation, plus que ce que Prune importe en une fois."
          }
        }
      }
    }
  },
  he: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "ייבוא…",
          exportAll: "ייצוא הכול",
          export: "ייצוא",
          exportFor: (n) => `ייצוא התיעוד של ${n}`,
          hint: "ייצוא שומר את התיעודים האלה בקובץ ‎.prunetraces. ייבוא מחזיר אותם, במחשב הזה או במחשב אחר עם אותן תוכנות.",
          empty: "עדיין לא תועדו התקנות.",
          notInstalled: "לא מותקן כאן",
          importedToast: (i, s, r) => `עקבות התקנה שיובאו: ${i}. כבר קיימים, דולגו: ${s}. נדחו: ${r}.`,
          importFailed: (m) => `לא ניתן לייבא את הקובץ: ${m}`,
          exportFailed: (m) => `לא ניתן לייצא: ${m}`,
          error: {
            tooLarge: "הקובץ גדול מדי מכדי להיות קובץ עקבות התקנה (המגבלה היא 16 MB).",
            notJson: "הקובץ אינו קובץ עקבות התקנה: הוא אינו JSON קריא.",
            notTraceFile: "הקובץ אינו קובץ עקבות התקנה שיוצא מ-Prune.",
            newerVersion: "הקובץ יוצא מגרסה חדשה יותר של Prune. יש לעדכן את Prune כדי לייבא אותו.",
            tooMany: "הקובץ מכיל יותר מ-1000 עקבות התקנה, יותר ממה ש-Prune מייבא בבת אחת."
          }
        }
      }
    }
  },
  hu: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "Importálás…",
          exportAll: "Összes exportálása",
          export: "Exportálás",
          exportFor: (n) => `${n} rögzítésének exportálása`,
          hint: "Az exportálás .prunetraces fájlba menti ezeket a rögzítéseket. Az importálás visszahozza őket, ezen a gépen vagy egy másikon, amelyen ugyanazok a programok vannak.",
          empty: "Még nincs rögzített telepítés.",
          notInstalled: "Itt nincs telepítve",
          importedToast: (i, s, r) => `Importált telepítési naplók: ${i}. Már itt volt, kihagyva: ${s}. Elutasítva: ${r}.`,
          importFailed: (m) => `A fájl nem importálható: ${m}`,
          exportFailed: (m) => `Az exportálás sikertelen: ${m}`,
          error: {
            tooLarge: "Ez a fájl túl nagy ahhoz, hogy telepítési naplófájl legyen (a korlát 16 MB).",
            notJson: "Ez a fájl nem telepítési naplófájl: nem olvasható JSON.",
            notTraceFile: "Ez a fájl nem a Prune által exportált telepítési naplófájl.",
            newerVersion: "Ezt a fájlt a Prune egy újabb verziója exportálta. Az importáláshoz frissítse a Prune-t.",
            tooMany: "Ez a fájl több mint 1000 telepítési naplót tartalmaz, többet, mint amennyit a Prune egyszerre importál."
          }
        }
      }
    }
  },
  id: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "Impor…",
          exportAll: "Ekspor semua",
          export: "Ekspor",
          exportFor: (n) => `Ekspor catatan ${n}`,
          hint: "Ekspor menyimpan catatan ini ke berkas .prunetraces. Impor mengembalikannya, di PC ini atau di PC lain dengan program yang sama.",
          empty: "Belum ada instalasi yang dicatat.",
          notInstalled: "Tidak terpasang di sini",
          importedToast: (i, s, r) => `Jejak instalasi diimpor: ${i}. Sudah ada, dilewati: ${s}. Ditolak: ${r}.`,
          importFailed: (m) => `Tidak dapat mengimpor berkas: ${m}`,
          exportFailed: (m) => `Tidak dapat mengekspor: ${m}`,
          error: {
            tooLarge: "Berkas itu terlalu besar untuk menjadi berkas jejak instalasi (batasnya 16 MB).",
            notJson: "Berkas itu bukan berkas jejak instalasi: isinya bukan JSON yang dapat dibaca.",
            notTraceFile: "Berkas itu bukan berkas jejak instalasi yang diekspor oleh Prune.",
            newerVersion: "Berkas itu diekspor oleh versi Prune yang lebih baru. Perbarui Prune untuk mengimpornya.",
            tooMany: "Berkas itu berisi lebih dari 1000 jejak instalasi, lebih banyak dari yang diimpor Prune sekaligus."
          }
        }
      }
    }
  },
  is: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "Flytja inn…",
          exportAll: "Flytja allt út",
          export: "Flytja út",
          exportFor: (n) => `Flytja út skráningu ${n}`,
          hint: "Útflutningur vistar þessar skráningar í .prunetraces-skrá. Innflutningur sækir þær aftur, á þessa tölvu eða aðra með sömu forritum.",
          empty: "Engar uppsetningar skráðar enn.",
          notInstalled: "Ekki uppsett hér",
          importedToast: (i, s, r) => `Uppsetningarslóðir fluttar inn: ${i}. Þegar hér, sleppt: ${s}. Hafnað: ${r}.`,
          importFailed: (m) => `Ekki tókst að flytja skrána inn: ${m}`,
          exportFailed: (m) => `Ekki tókst að flytja út: ${m}`,
          error: {
            tooLarge: "Þessi skrá er of stór til að vera uppsetningarslóðaskrá (hámarkið er 16 MB).",
            notJson: "Þessi skrá er ekki uppsetningarslóðaskrá: hún er ekki læsilegt JSON.",
            notTraceFile: "Þessi skrá er ekki uppsetningarslóðaskrá sem Prune flutti út.",
            newerVersion: "Þessi skrá var flutt út með nýrri útgáfu af Prune. Uppfærðu Prune til að flytja hana inn.",
            tooMany: "Þessi skrá geymir fleiri en 1000 uppsetningarslóðir, fleiri en Prune flytur inn í einu."
          }
        }
      }
    }
  },
  it: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "Importa…",
          exportAll: "Esporta tutto",
          export: "Esporta",
          exportFor: (n) => `Esporta la registrazione di ${n}`,
          hint: "Esporta salva queste registrazioni in un file .prunetraces. Importa le riporta indietro, su questo PC o su un altro con gli stessi programmi.",
          empty: "Nessuna installazione ancora registrata.",
          notInstalled: "Non installato qui",
          importedToast: (i, s, r) => `Tracce di installazione importate: ${i}. Già presenti, saltate: ${s}. Rifiutate: ${r}.`,
          importFailed: (m) => `Impossibile importare il file: ${m}`,
          exportFailed: (m) => `Impossibile esportare: ${m}`,
          error: {
            tooLarge: "Il file è troppo grande per essere un file di tracce di installazione (il limite è 16 MB).",
            notJson: "Il file non è un file di tracce di installazione: non è JSON leggibile.",
            notTraceFile: "Il file non è un file di tracce di installazione esportato da Prune.",
            newerVersion: "Il file è stato esportato da una versione più recente di Prune. Aggiorna Prune per importarlo.",
            tooMany: "Il file contiene più di 1000 tracce di installazione, più di quante Prune ne importi in una volta."
          }
        }
      }
    }
  },
  ja: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "インポート…",
          exportAll: "すべてエクスポート",
          export: "エクスポート",
          exportFor: (n) => `${n} の記録をエクスポート`,
          hint: "エクスポートすると、これらの記録が .prunetraces ファイルに保存されます。インポートすると、この PC や同じプログラムがある別の PC に戻せます。",
          empty: "まだ記録されたインストールはありません。",
          notInstalled: "この PC には未インストール",
          importedToast: (i, s, r) => `インポートしたインストールの記録: ${i} 件。既にあるためスキップ: ${s} 件。拒否: ${r} 件。`,
          importFailed: (m) => `ファイルをインポートできませんでした: ${m}`,
          exportFailed: (m) => `エクスポートできませんでした: ${m}`,
          error: {
            tooLarge: "このファイルはインストール記録ファイルとしては大きすぎます (上限は 16 MB)。",
            notJson: "このファイルはインストール記録ファイルではありません。読み取れる JSON ではありません。",
            notTraceFile: "このファイルは Prune がエクスポートしたインストール記録ファイルではありません。",
            newerVersion: "このファイルは新しいバージョンの Prune でエクスポートされました。インポートするには Prune を更新してください。",
            tooMany: "このファイルには 1000 件を超えるインストールの記録があり、Prune が一度にインポートできる数を超えています。"
          }
        }
      }
    }
  },
  ko: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "가져오기…",
          exportAll: "모두 내보내기",
          export: "내보내기",
          exportFor: (n) => `${n}의 기록 내보내기`,
          hint: "내보내기는 이 기록을 .prunetraces 파일에 저장합니다. 가져오기는 이 PC나 같은 프로그램이 있는 다른 PC로 기록을 되돌립니다.",
          empty: "아직 기록된 설치가 없습니다.",
          notInstalled: "이 PC에 설치되지 않음",
          importedToast: (i, s, r) => `가져온 설치 기록: ${i}개. 이미 있어 건너뜀: ${s}개. 거부됨: ${r}개.`,
          importFailed: (m) => `파일을 가져올 수 없습니다: ${m}`,
          exportFailed: (m) => `내보낼 수 없습니다: ${m}`,
          error: {
            tooLarge: "이 파일은 설치 기록 파일이라기엔 너무 큽니다(한도는 16MB).",
            notJson: "이 파일은 설치 기록 파일이 아닙니다. 읽을 수 있는 JSON이 아닙니다.",
            notTraceFile: "이 파일은 Prune에서 내보낸 설치 기록 파일이 아닙니다.",
            newerVersion: "이 파일은 더 새로운 버전의 Prune에서 내보냈습니다. 가져오려면 Prune을 업데이트하세요.",
            tooMany: "이 파일에는 설치 기록이 1000개 넘게 있어 Prune이 한 번에 가져올 수 있는 양을 넘습니다."
          }
        }
      }
    }
  },
  lt: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "Importuoti…",
          exportAll: "Eksportuoti viską",
          export: "Eksportuoti",
          exportFor: (n) => `Eksportuoti ${n} įrašą`,
          hint: "Eksportuojant šie įrašai išsaugomi .prunetraces faile. Importuojant jie grąžinami, į šį kompiuterį arba į kitą su tomis pačiomis programomis.",
          empty: "Kol kas neįrašyta jokių diegimų.",
          notInstalled: "Čia neįdiegta",
          importedToast: (i, s, r) => `Importuota diegimo pėdsakų: ${i}. Jau yra, praleista: ${s}. Atmesta: ${r}.`,
          importFailed: (m) => `Nepavyko importuoti failo: ${m}`,
          exportFailed: (m) => `Nepavyko eksportuoti: ${m}`,
          error: {
            tooLarge: "Šis failas per didelis, kad būtų diegimo pėdsakų failas (riba – 16 MB).",
            notJson: "Šis failas nėra diegimo pėdsakų failas: tai nėra skaitomas JSON.",
            notTraceFile: "Šis failas nėra Prune eksportuotas diegimo pėdsakų failas.",
            newerVersion: "Šis failas eksportuotas naujesne Prune versija. Norėdami jį importuoti, atnaujinkite Prune.",
            tooMany: "Šiame faile yra daugiau nei 1000 diegimo pėdsakų – daugiau, nei Prune importuoja vienu kartu."
          }
        }
      }
    }
  },
  ms: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "Import…",
          exportAll: "Eksport semua",
          export: "Eksport",
          exportFor: (n) => `Eksport rekod ${n}`,
          hint: "Eksport menyimpan rekod ini ke fail .prunetraces. Import membawanya kembali, pada PC ini atau pada PC lain yang mempunyai program yang sama.",
          empty: "Belum ada pemasangan yang direkodkan.",
          notInstalled: "Tidak dipasang di sini",
          importedToast: (i, s, r) => `Jejak pemasangan diimport: ${i}. Sudah ada, dilangkau: ${s}. Ditolak: ${r}.`,
          importFailed: (m) => `Tidak dapat mengimport fail: ${m}`,
          exportFailed: (m) => `Tidak dapat mengeksport: ${m}`,
          error: {
            tooLarge: "Fail itu terlalu besar untuk menjadi fail jejak pemasangan (hadnya 16 MB).",
            notJson: "Fail itu bukan fail jejak pemasangan: ia bukan JSON yang boleh dibaca.",
            notTraceFile: "Fail itu bukan fail jejak pemasangan yang dieksport oleh Prune.",
            newerVersion: "Fail itu dieksport oleh versi Prune yang lebih baharu. Kemas kini Prune untuk mengimportnya.",
            tooMany: "Fail itu mengandungi lebih daripada 1000 jejak pemasangan, lebih banyak daripada yang diimport Prune sekali gus."
          }
        }
      }
    }
  },
  nb: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "Importer…",
          exportAll: "Eksporter alle",
          export: "Eksporter",
          exportFor: (n) => `Eksporter registreringen av ${n}`,
          hint: "Eksporter lagrer disse registreringene i en .prunetraces-fil. Importer henter dem tilbake, på denne PC-en eller på en annen med de samme programmene.",
          empty: "Ingen installasjoner registrert ennå.",
          notInstalled: "Ikke installert her",
          importedToast: (i, s, r) => `Installasjonsspor importert: ${i}. Allerede her, hoppet over: ${s}. Avvist: ${r}.`,
          importFailed: (m) => `Kunne ikke importere filen: ${m}`,
          exportFailed: (m) => `Kunne ikke eksportere: ${m}`,
          error: {
            tooLarge: "Den filen er for stor til å være en installasjonssporfil (grensen er 16 MB).",
            notJson: "Den filen er ikke en installasjonssporfil: den er ikke lesbar JSON.",
            notTraceFile: "Den filen er ikke en installasjonssporfil eksportert av Prune.",
            newerVersion: "Den filen ble eksportert av en nyere versjon av Prune. Oppdater Prune for å importere den.",
            tooMany: "Den filen inneholder mer enn 1000 installasjonsspor, flere enn Prune importerer på én gang."
          }
        }
      }
    }
  },
  nl: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "Importeren…",
          exportAll: "Alles exporteren",
          export: "Exporteren",
          exportFor: (n) => `Vastlegging van ${n} exporteren`,
          hint: "Exporteren slaat deze vastleggingen op in een .prunetraces-bestand. Importeren haalt ze terug, op deze pc of op een andere met dezelfde programma's.",
          empty: "Nog geen installaties vastgelegd.",
          notInstalled: "Hier niet geïnstalleerd",
          importedToast: (i, s, r) => `Installatiesporen geïmporteerd: ${i}. Al aanwezig, overgeslagen: ${s}. Geweigerd: ${r}.`,
          importFailed: (m) => `Het bestand kon niet worden geïmporteerd: ${m}`,
          exportFailed: (m) => `Exporteren mislukt: ${m}`,
          error: {
            tooLarge: "Dat bestand is te groot voor een bestand met installatiesporen (de limiet is 16 MB).",
            notJson: "Dat bestand is geen bestand met installatiesporen: het is geen leesbare JSON.",
            notTraceFile: "Dat bestand is geen door Prune geëxporteerd bestand met installatiesporen.",
            newerVersion: "Dat bestand is geëxporteerd door een nieuwere versie van Prune. Werk Prune bij om het te importeren.",
            tooMany: "Dat bestand bevat meer dan 1000 installatiesporen, meer dan Prune in één keer importeert."
          }
        }
      }
    }
  },
  pl: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "Importuj…",
          exportAll: "Eksportuj wszystko",
          export: "Eksportuj",
          exportFor: (n) => `Eksportuj zapis programu ${n}`,
          hint: "Eksport zapisuje te zapisy w pliku .prunetraces. Import przywraca je na tym komputerze albo na innym z tymi samymi programami.",
          empty: "Nie zapisano jeszcze żadnych instalacji.",
          notInstalled: "Nie zainstalowano tutaj",
          importedToast: (i, s, r) => `Zaimportowane ślady instalacji: ${i}. Już tu były, pominięte: ${s}. Odrzucone: ${r}.`,
          importFailed: (m) => `Nie można zaimportować pliku: ${m}`,
          exportFailed: (m) => `Nie można wyeksportować: ${m}`,
          error: {
            tooLarge: "Ten plik jest za duży, by był plikiem śladów instalacji (limit to 16 MB).",
            notJson: "Ten plik nie jest plikiem śladów instalacji: nie jest czytelnym JSON-em.",
            notTraceFile: "Ten plik nie jest plikiem śladów instalacji wyeksportowanym przez Prune.",
            newerVersion: "Ten plik wyeksportowała nowsza wersja Prune. Zaktualizuj Prune, aby go zaimportować.",
            tooMany: "Ten plik zawiera ponad 1000 śladów instalacji, więcej, niż Prune importuje naraz."
          }
        }
      }
    }
  },
  ps: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "واردول…",
          exportAll: "ټول صادرول",
          export: "صادرول",
          exportFor: (n) => `د ${n} ثبت صادر کړئ`,
          hint: "صادرول دا ثبتونه په یوه ‎.prunetraces دوتنه کې ساتي. واردول یې بېرته راوړي، په دې کمپیوټر یا په بل کمپیوټر چې همدا برامج ولري.",
          empty: "تر اوسه هېڅ نصب نه دی ثبت شوی.",
          notInstalled: "دلته نه دی نصب شوی",
          importedToast: (i, s, r) => `وارد شوي د نصب پلونه: ${i}. دمخه دلته وو، پرېښودل شول: ${s}. رد شول: ${r}.`,
          importFailed: (m) => `دوتنه وارد نه شوه: ${m}`,
          exportFailed: (m) => `صادرول ونه شول: ${m}`,
          error: {
            tooLarge: "دا دوتنه د نصب پلونو دوتنې لپاره ډېره لویه ده (حد یې 16 MB دی).",
            notJson: "دا دوتنه د نصب پلونو دوتنه نه ده: د لوستلو وړ JSON نه دی.",
            notTraceFile: "دا دوتنه د Prune له خوا صادره شوې د نصب پلونو دوتنه نه ده.",
            newerVersion: "دا دوتنه د Prune د نوې نسخې له خوا صادره شوې. د واردولو لپاره Prune تازه کړئ.",
            tooMany: "په دې دوتنه کې له 1000 ډېر د نصب پلونه دي، له هغه ډېر چې Prune یې په یو ځل واردوي."
          }
        }
      }
    }
  },
  'pt-BR': {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "Importar…",
          exportAll: "Exportar tudo",
          export: "Exportar",
          exportFor: (n) => `Exportar o registro de ${n}`,
          hint: "Exportar salva esses registros em um arquivo .prunetraces. Importar os traz de volta, neste PC ou em outro com os mesmos programas.",
          empty: "Nenhuma instalação registrada ainda.",
          notInstalled: "Não instalado aqui",
          importedToast: (i, s, r) => `Rastros de instalação importados: ${i}. Já estavam aqui, ignorados: ${s}. Recusados: ${r}.`,
          importFailed: (m) => `Não foi possível importar o arquivo: ${m}`,
          exportFailed: (m) => `Não foi possível exportar: ${m}`,
          error: {
            tooLarge: "Esse arquivo é grande demais para ser um arquivo de rastros de instalação (o limite é 16 MB).",
            notJson: "Esse arquivo não é um arquivo de rastros de instalação: não é um JSON legível.",
            notTraceFile: "Esse arquivo não é um arquivo de rastros de instalação exportado pelo Prune.",
            newerVersion: "Esse arquivo foi exportado por uma versão mais nova do Prune. Atualize o Prune para importá-lo.",
            tooMany: "Esse arquivo tem mais de 1000 rastros de instalação, mais do que o Prune importa de uma vez."
          }
        }
      }
    }
  },
  pt: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "Importar…",
          exportAll: "Exportar tudo",
          export: "Exportar",
          exportFor: (n) => `Exportar o registo de ${n}`,
          hint: "Exportar guarda estes registos num ficheiro .prunetraces. Importar trá-los de volta, neste PC ou noutro com os mesmos programas.",
          empty: "Ainda não há instalações registadas.",
          notInstalled: "Não instalado aqui",
          importedToast: (i, s, r) => `Rastos de instalação importados: ${i}. Já existiam, ignorados: ${s}. Recusados: ${r}.`,
          importFailed: (m) => `Não foi possível importar o ficheiro: ${m}`,
          exportFailed: (m) => `Não foi possível exportar: ${m}`,
          error: {
            tooLarge: "Esse ficheiro é demasiado grande para ser um ficheiro de rastos de instalação (o limite é 16 MB).",
            notJson: "Esse ficheiro não é um ficheiro de rastos de instalação: não é JSON legível.",
            notTraceFile: "Esse ficheiro não é um ficheiro de rastos de instalação exportado pelo Prune.",
            newerVersion: "Esse ficheiro foi exportado por uma versão mais recente do Prune. Atualize o Prune para o importar.",
            tooMany: "Esse ficheiro contém mais de 1000 rastos de instalação, mais do que o Prune importa de uma vez."
          }
        }
      }
    }
  },
  ro: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "Importă…",
          exportAll: "Exportă tot",
          export: "Exportă",
          exportFor: (n) => `Exportă înregistrarea pentru ${n}`,
          hint: "Exportul salvează aceste înregistrări într-un fișier .prunetraces. Importul le aduce înapoi, pe acest PC sau pe altul cu aceleași programe.",
          empty: "Nicio instalare înregistrată încă.",
          notInstalled: "Neinstalat aici",
          importedToast: (i, s, r) => `Urme de instalare importate: ${i}. Deja aici, omise: ${s}. Respinse: ${r}.`,
          importFailed: (m) => `Fișierul nu a putut fi importat: ${m}`,
          exportFailed: (m) => `Nu s-a putut exporta: ${m}`,
          error: {
            tooLarge: "Fișierul este prea mare pentru a fi un fișier cu urme de instalare (limita este de 16 MB).",
            notJson: "Fișierul nu este un fișier cu urme de instalare: nu este JSON lizibil.",
            notTraceFile: "Fișierul nu este un fișier cu urme de instalare exportat de Prune.",
            newerVersion: "Fișierul a fost exportat de o versiune mai nouă de Prune. Actualizează Prune pentru a-l importa.",
            tooMany: "Fișierul conține peste 1000 de urme de instalare, mai multe decât importă Prune odată."
          }
        }
      }
    }
  },
  ru: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "Импорт…",
          exportAll: "Экспортировать все",
          export: "Экспорт",
          exportFor: (n) => `Экспортировать запись о ${n}`,
          hint: "Экспорт сохраняет эти записи в файл .prunetraces. Импорт возвращает их, на этот ПК или на другой с теми же программами.",
          empty: "Записанных установок пока нет.",
          notInstalled: "Здесь не установлено",
          importedToast: (i, s, r) => `Импортировано записей об установке: ${i}. Уже есть, пропущено: ${s}. Отклонено: ${r}.`,
          importFailed: (m) => `Не удалось импортировать файл: ${m}`,
          exportFailed: (m) => `Не удалось экспортировать: ${m}`,
          error: {
            tooLarge: "Этот файл слишком велик для файла записей об установке (предел — 16 МБ).",
            notJson: "Это не файл записей об установке: он не является читаемым JSON.",
            notTraceFile: "Это не файл записей об установке, экспортированный Prune.",
            newerVersion: "Этот файл экспортирован более новой версией Prune. Обновите Prune, чтобы импортировать его.",
            tooMany: "В этом файле больше 1000 записей об установке — больше, чем Prune импортирует за раз."
          }
        }
      }
    }
  },
  sk: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "Importovať…",
          exportAll: "Exportovať všetko",
          export: "Exportovať",
          exportFor: (n) => `Exportovať záznam o ${n}`,
          hint: "Export uloží tieto záznamy do súboru .prunetraces. Import ich vráti späť, na tento počítač alebo na iný s rovnakými programami.",
          empty: "Zatiaľ nie sú zaznamenané žiadne inštalácie.",
          notInstalled: "Tu nenainštalované",
          importedToast: (i, s, r) => `Importované záznamy inštalácií: ${i}. Už tu, preskočené: ${s}. Odmietnuté: ${r}.`,
          importFailed: (m) => `Súbor sa nepodarilo importovať: ${m}`,
          exportFailed: (m) => `Export sa nepodaril: ${m}`,
          error: {
            tooLarge: "Tento súbor je príliš veľký na to, aby bol súborom záznamov inštalácií (limit je 16 MB).",
            notJson: "Tento súbor nie je súborom záznamov inštalácií: nejde o čitateľný JSON.",
            notTraceFile: "Tento súbor nie je súborom záznamov inštalácií exportovaným z Prune.",
            newerVersion: "Tento súbor bol exportovaný novšou verziou Prune. Na import Prune aktualizujte.",
            tooMany: "Tento súbor obsahuje viac ako 1000 záznamov inštalácií, viac, než Prune naimportuje naraz."
          }
        }
      }
    }
  },
  sq: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "Importo…",
          exportAll: "Eksporto të gjitha",
          export: "Eksporto",
          exportFor: (n) => `Eksporto regjistrimin e ${n}`,
          hint: "Eksportimi i ruan këto regjistrime në një skedar .prunetraces. Importimi i rikthen, në këtë kompjuter ose në një tjetër me të njëjtat programe.",
          empty: "Ende nuk është regjistruar asnjë instalim.",
          notInstalled: "Nuk është instaluar këtu",
          importedToast: (i, s, r) => `Gjurmë instalimi të importuara: ${i}. Ishin këtu, u anashkaluan: ${s}. U refuzuan: ${r}.`,
          importFailed: (m) => `Skedari nuk u importua dot: ${m}`,
          exportFailed: (m) => `Eksportimi nuk u krye: ${m}`,
          error: {
            tooLarge: "Ky skedar është shumë i madh për të qenë skedar gjurmësh instalimi (kufiri është 16 MB).",
            notJson: "Ky skedar nuk është skedar gjurmësh instalimi: nuk është JSON i lexueshëm.",
            notTraceFile: "Ky skedar nuk është skedar gjurmësh instalimi i eksportuar nga Prune.",
            newerVersion: "Ky skedar u eksportua nga një version më i ri i Prune. Përditëso Prune për ta importuar.",
            tooMany: "Ky skedar ka më shumë se 1000 gjurmë instalimi, më shumë sesa importon Prune njëherësh."
          }
        }
      }
    }
  },
  sr: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "Увези…",
          exportAll: "Извези све",
          export: "Извези",
          exportFor: (n) => `Извези запис за ${n}`,
          hint: "Извоз чува ове записе у датотеку .prunetraces. Увоз их враћа, на овај рачунар или на други са истим програмима.",
          empty: "Још нема снимљених инсталација.",
          notInstalled: "Није инсталирано овде",
          importedToast: (i, s, r) => `Увезени трагови инсталације: ${i}. Већ постоје, прескочено: ${s}. Одбијено: ${r}.`,
          importFailed: (m) => `Није могуће увести датотеку: ${m}`,
          exportFailed: (m) => `Није могуће извести: ${m}`,
          error: {
            tooLarge: "Ова датотека је превелика да би била датотека трагова инсталације (ограничење је 16 MB).",
            notJson: "Ова датотека није датотека трагова инсталације: није читљив JSON.",
            notTraceFile: "Ова датотека није датотека трагова инсталације коју је извезао Prune.",
            newerVersion: "Ову датотеку је извезла новија верзија Prune-а. Ажурирајте Prune да бисте је увезли.",
            tooMany: "Ова датотека садржи више од 1000 трагова инсталације, више него што Prune увози одједном."
          }
        }
      }
    }
  },
  sv: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "Importera…",
          exportAll: "Exportera alla",
          export: "Exportera",
          exportFor: (n) => `Exportera registreringen av ${n}`,
          hint: "Exportera sparar de här registreringarna i en .prunetraces-fil. Importera hämtar tillbaka dem, på den här datorn eller på en annan med samma program.",
          empty: "Inga installationer registrerade ännu.",
          notInstalled: "Inte installerat här",
          importedToast: (i, s, r) => `Installationsspår importerade: ${i}. Fanns redan, hoppades över: ${s}. Avvisade: ${r}.`,
          importFailed: (m) => `Det gick inte att importera filen: ${m}`,
          exportFailed: (m) => `Det gick inte att exportera: ${m}`,
          error: {
            tooLarge: "Den filen är för stor för att vara en fil med installationsspår (gränsen är 16 MB).",
            notJson: "Den filen är inte en fil med installationsspår: den är inte läsbar JSON.",
            notTraceFile: "Den filen är inte en fil med installationsspår som exporterats av Prune.",
            newerVersion: "Den filen exporterades av en nyare version av Prune. Uppdatera Prune för att importera den.",
            tooMany: "Den filen innehåller fler än 1000 installationsspår, fler än Prune importerar på en gång."
          }
        }
      }
    }
  },
  th: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "นำเข้า…",
          exportAll: "ส่งออกทั้งหมด",
          export: "ส่งออก",
          exportFor: (n) => `ส่งออกบันทึกของ ${n}`,
          hint: "ส่งออกจะบันทึกรายการเหล่านี้ลงในไฟล์ .prunetraces ส่วนนำเข้าจะนำกลับมา บนพีซีเครื่องนี้หรือเครื่องอื่นที่มีโปรแกรมเดียวกัน",
          empty: "ยังไม่มีการติดตั้งที่บันทึกไว้",
          notInstalled: "ไม่ได้ติดตั้งในเครื่องนี้",
          importedToast: (i, s, r) => `นำเข้าร่องรอยการติดตั้ง: ${i} รายการ มีอยู่แล้วจึงข้าม: ${s} รายการ ถูกปฏิเสธ: ${r} รายการ`,
          importFailed: (m) => `นำเข้าไฟล์ไม่ได้: ${m}`,
          exportFailed: (m) => `ส่งออกไม่ได้: ${m}`,
          error: {
            tooLarge: "ไฟล์นี้ใหญ่เกินกว่าจะเป็นไฟล์ร่องรอยการติดตั้ง (จำกัดที่ 16 MB)",
            notJson: "ไฟล์นี้ไม่ใช่ไฟล์ร่องรอยการติดตั้ง: ไม่ใช่ JSON ที่อ่านได้",
            notTraceFile: "ไฟล์นี้ไม่ใช่ไฟล์ร่องรอยการติดตั้งที่ส่งออกจาก Prune",
            newerVersion: "ไฟล์นี้ส่งออกจาก Prune รุ่นที่ใหม่กว่า อัปเดต Prune เพื่อนำเข้า",
            tooMany: "ไฟล์นี้มีร่องรอยการติดตั้งมากกว่า 1000 รายการ เกินกว่าที่ Prune นำเข้าได้ในครั้งเดียว"
          }
        }
      }
    }
  },
  tr: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "İçe aktar…",
          exportAll: "Tümünü dışa aktar",
          export: "Dışa aktar",
          exportFor: (n) => `${n} kaydını dışa aktar`,
          hint: "Dışa aktar bu kayıtları bir .prunetraces dosyasına kaydeder. İçe aktar onları geri getirir; bu bilgisayarda ya da aynı programların olduğu başka bir bilgisayarda.",
          empty: "Henüz kaydedilen yükleme yok.",
          notInstalled: "Burada yüklü değil",
          importedToast: (i, s, r) => `İçe aktarılan yükleme izleri: ${i}. Zaten vardı, atlandı: ${s}. Reddedildi: ${r}.`,
          importFailed: (m) => `Dosya içe aktarılamadı: ${m}`,
          exportFailed: (m) => `Dışa aktarılamadı: ${m}`,
          error: {
            tooLarge: "Bu dosya bir yükleme izi dosyası olamayacak kadar büyük (sınır 16 MB).",
            notJson: "Bu dosya bir yükleme izi dosyası değil: okunabilir JSON değil.",
            notTraceFile: "Bu dosya Prune tarafından dışa aktarılmış bir yükleme izi dosyası değil.",
            newerVersion: "Bu dosya Prune'un daha yeni bir sürümüyle dışa aktarılmış. İçe aktarmak için Prune'u güncelleyin.",
            tooMany: "Bu dosyada 1000'den fazla yükleme izi var; Prune'un tek seferde içe aktardığından fazla."
          }
        }
      }
    }
  },
  uk: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "Імпорт…",
          exportAll: "Експортувати все",
          export: "Експорт",
          exportFor: (n) => `Експортувати запис про ${n}`,
          hint: "Експорт зберігає ці записи у файл .prunetraces. Імпорт повертає їх, на цей ПК або на інший із тими самими програмами.",
          empty: "Записаних встановлень поки немає.",
          notInstalled: "Тут не встановлено",
          importedToast: (i, s, r) => `Імпортовано записів про встановлення: ${i}. Уже є, пропущено: ${s}. Відхилено: ${r}.`,
          importFailed: (m) => `Не вдалося імпортувати файл: ${m}`,
          exportFailed: (m) => `Не вдалося експортувати: ${m}`,
          error: {
            tooLarge: "Цей файл завеликий для файлу записів про встановлення (межа — 16 МБ).",
            notJson: "Це не файл записів про встановлення: він не є читабельним JSON.",
            notTraceFile: "Це не файл записів про встановлення, експортований Prune.",
            newerVersion: "Цей файл експортовано новішою версією Prune. Оновіть Prune, щоб імпортувати його.",
            tooMany: "У цьому файлі понад 1000 записів про встановлення — більше, ніж Prune імпортує за раз."
          }
        }
      }
    }
  },
  vi: {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "Nhập…",
          exportAll: "Xuất tất cả",
          export: "Xuất",
          exportFor: (n) => `Xuất bản ghi của ${n}`,
          hint: "Xuất lưu các bản ghi này vào tệp .prunetraces. Nhập đưa chúng trở lại, trên PC này hoặc trên PC khác có cùng chương trình.",
          empty: "Chưa ghi lại lần cài đặt nào.",
          notInstalled: "Chưa cài trên máy này",
          importedToast: (i, s, r) => `Dấu vết cài đặt đã nhập: ${i}. Đã có, bỏ qua: ${s}. Bị từ chối: ${r}.`,
          importFailed: (m) => `Không nhập được tệp: ${m}`,
          exportFailed: (m) => `Không xuất được: ${m}`,
          error: {
            tooLarge: "Tệp đó quá lớn để là tệp dấu vết cài đặt (giới hạn là 16 MB).",
            notJson: "Tệp đó không phải tệp dấu vết cài đặt: không phải JSON đọc được.",
            notTraceFile: "Tệp đó không phải tệp dấu vết cài đặt do Prune xuất.",
            newerVersion: "Tệp đó được xuất bởi phiên bản Prune mới hơn. Hãy cập nhật Prune để nhập.",
            tooMany: "Tệp đó chứa hơn 1000 dấu vết cài đặt, nhiều hơn số Prune nhập một lần."
          }
        }
      }
    }
  },
  'zh-CN': {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "导入…",
          exportAll: "全部导出",
          export: "导出",
          exportFor: (n) => `导出 ${n} 的记录`,
          hint: "导出会把这些记录保存到 .prunetraces 文件。导入会把它们恢复到这台电脑，或装有相同程序的另一台电脑。",
          empty: "还没有记录的安装。",
          notInstalled: "此电脑未安装",
          importedToast: (i, s, r) => `已导入安装记录：${i} 条。已存在，已跳过：${s} 条。已拒绝：${r} 条。`,
          importFailed: (m) => `无法导入文件：${m}`,
          exportFailed: (m) => `无法导出：${m}`,
          error: {
            tooLarge: "该文件太大，不可能是安装记录文件（上限为 16 MB）。",
            notJson: "该文件不是安装记录文件：不是可读取的 JSON。",
            notTraceFile: "该文件不是 Prune 导出的安装记录文件。",
            newerVersion: "该文件由更新版本的 Prune 导出。请更新 Prune 后再导入。",
            tooMany: "该文件包含超过 1000 条安装记录，超出 Prune 一次能导入的数量。"
          }
        }
      }
    }
  },
  'zh-TW': {
    uninstallerV3: {
      monitor: {
        traceFile: {
          import: "匯入…",
          exportAll: "全部匯出",
          export: "匯出",
          exportFor: (n) => `匯出 ${n} 的記錄`,
          hint: "匯出會將這些記錄儲存到 .prunetraces 檔案。匯入會將它們還原到這台電腦，或裝有相同程式的另一台電腦。",
          empty: "尚無記錄的安裝。",
          notInstalled: "此電腦未安裝",
          importedToast: (i, s, r) => `已匯入安裝記錄：${i} 筆。已存在，已略過：${s} 筆。已拒絕：${r} 筆。`,
          importFailed: (m) => `無法匯入檔案：${m}`,
          exportFailed: (m) => `無法匯出：${m}`,
          error: {
            tooLarge: "此檔案太大，不可能是安裝記錄檔（上限為 16 MB）。",
            notJson: "此檔案不是安裝記錄檔：不是可讀取的 JSON。",
            notTraceFile: "此檔案不是 Prune 匯出的安裝記錄檔。",
            newerVersion: "此檔案由較新版本的 Prune 匯出。請更新 Prune 後再匯入。",
            tooMany: "此檔案包含超過 1000 筆安裝記錄，超出 Prune 一次能匯入的數量。"
          }
        }
      }
    }
  }
};
