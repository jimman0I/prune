/** The two captions File Explorer's right-click menu shows for Prune, in the 40
 * languages Prune is offered in.
 *
 * They live in the registry, not in the app: Explorer reads the verb's text
 * from the key (services/explorerMenu.js writes it when the Settings switch is
 * turned on, and rewrites it when the app's language changes), so they cannot
 * come from the frontend's catalog. They are a table of their own, here, for
 * just these two strings. explorerMenuCaptions.test.js checks that it has every
 * language in frontend/src/i18n/languages.js and that every caption is fit to
 * be written as a menu caption.
 *
 *   shred   "Shred with Prune"            on any file or folder
 *   find    "Find in Prune (uninstall)"   on a program (.exe) or a shortcut (.lnk)
 *
 * The verbs follow each language's existing wording for Shred and Uninstall in
 * the app (the Deep Clean and Applications screens). No caption may hold a
 * double quote or an ampersand: the first would end the registry argument, the
 * second would underline the next letter as a menu accelerator. */
export const CAPTIONS = {
  en: { shred: 'Shred with Prune', find: 'Find in Prune (uninstall)' },
  af: { shred: 'Versnipper met Prune', find: 'Vind in Prune (deïnstalleer)' },
  ar: { shred: 'تمزيق باستخدام Prune', find: 'بحث في Prune (إلغاء التثبيت)' },
  ca: { shred: 'Tritura amb Prune', find: 'Cerca a Prune (desinstal·la)' },
  cs: { shred: 'Skartovat pomocí Prune', find: 'Najít v Prune (odinstalovat)' },
  cy: { shred: 'Rhwygo gyda Prune', find: 'Canfod yn Prune (dadosod)' },
  da: { shred: 'Makulér med Prune', find: 'Find i Prune (afinstaller)' },
  de: { shred: 'Mit Prune schreddern', find: 'In Prune suchen (deinstallieren)' },
  el: { shred: 'Τεμαχισμός με το Prune', find: 'Εύρεση στο Prune (απεγκατάσταση)' },
  es: { shred: 'Triturar con Prune', find: 'Buscar en Prune (desinstalar)' },
  et: { shred: "Hävita Prune'iga", find: "Otsi Prune'ist (desinstalli)" },
  fi: { shred: 'Murskaa Prunella', find: 'Etsi Prunesta (poista)' },
  fr: { shred: 'Détruire avec Prune', find: 'Rechercher dans Prune (désinstaller)' },
  he: { shred: 'מחיקה מאובטחת עם Prune', find: 'חיפוש ב-Prune (הסרה)' },
  hu: { shred: 'Megsemmisítés a Prune-nal', find: 'Keresés a Prune-ban (eltávolítás)' },
  id: { shred: 'Hancurkan dengan Prune', find: 'Cari di Prune (uninstal)' },
  is: { shred: 'Tæta með Prune', find: 'Finna í Prune (fjarlægja)' },
  it: { shred: 'Distruggi con Prune', find: 'Trova in Prune (disinstalla)' },
  ja: { shred: 'Prune でシュレッダー処理', find: 'Prune で検索 (アンインストール)' },
  ko: { shred: 'Prune으로 완전 삭제', find: 'Prune에서 찾기 (제거)' },
  lt: { shred: 'Sunaikinti naudojant Prune', find: 'Rasti programoje Prune (pašalinti)' },
  ms: { shred: 'Carik dengan Prune', find: 'Cari dalam Prune (nyahpasang)' },
  nb: { shred: 'Makuler med Prune', find: 'Finn i Prune (avinstaller)' },
  nl: { shred: 'Versnipperen met Prune', find: 'Zoeken in Prune (verwijderen)' },
  pl: { shred: 'Zniszcz za pomocą Prune', find: 'Znajdź w Prune (odinstaluj)' },
  ps: { shred: 'د Prune سره ټوټه کړئ', find: 'په Prune کې ومومئ (لرې کول)' },
  'pt-BR': { shred: 'Triturar com o Prune', find: 'Localizar no Prune (desinstalar)' },
  pt: { shred: 'Triturar com o Prune', find: 'Procurar no Prune (desinstalar)' },
  ro: { shred: 'Distruge cu Prune', find: 'Găsește în Prune (dezinstalează)' },
  ru: { shred: 'Уничтожить с помощью Prune', find: 'Найти в Prune (удалить)' },
  sk: { shred: 'Skartovať pomocou Prune', find: 'Nájsť v Prune (odinštalovať)' },
  sq: { shred: 'Shkatërro me Prune', find: 'Gjej në Prune (çinstalo)' },
  sr: { shred: 'Уништи помоћу Prune', find: 'Пронађи у Prune (деинсталирај)' },
  sv: { shred: 'Strimla med Prune', find: 'Hitta i Prune (avinstallera)' },
  th: { shred: 'ทำลายด้วย Prune', find: 'ค้นหาใน Prune (ถอนการติดตั้ง)' },
  tr: { shred: 'Prune ile parçala', find: "Prune'da bul (kaldır)" },
  uk: { shred: 'Знищити за допомогою Prune', find: 'Знайти в Prune (видалити)' },
  vi: { shred: 'Hủy bằng Prune', find: 'Tìm trong Prune (gỡ cài đặt)' },
  'zh-CN': { shred: '使用 Prune 粉碎', find: '在 Prune 中查找（卸载）' },
  'zh-TW': { shred: '使用 Prune 粉碎', find: '在 Prune 中尋找（解除安裝）' }
};

/** The captions for a language code, English for anything Prune has no words
 * for (a damaged settings file, a code added later). */
export function captionsFor(language) {
  return Object.hasOwn(CAPTIONS, language) ? CAPTIONS[language] : CAPTIONS.en;
}
