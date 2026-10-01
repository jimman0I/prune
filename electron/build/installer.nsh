; The installer's "Updates" page and language dialog, and what they hand
; to the app.
;
; Two questions, two different lifetimes. Neither can go into
; settings.json directly -- NSIS has no JSON, and would have to merge
; into a file it cannot read -- so the installer leaves a one-line file,
; installer-choices.json, beside it, and the app applies it on its next
; start and deletes it (backend/src/services/installerChoices.js).
;
; "Should Prune check for updates?" is asked on a fresh install only.
; Anyone who has used Prune on this Windows account already has a
; settings.json, and their choice lives there; an unticked box on a
; reinstall would otherwise quietly turn off an update check they had
; turned on. So the page skips itself, and updateCheck is left out of
; the file entirely -- change it in Settings instead.
;
; The installer's own display language, by contrast, is written on
; EVERY interactive install, fresh or upgrade: it is a real, deliberate
; choice the person just made in the wizard's own language dialog, not
; a leftover default, and the app opening in whatever language the
; installer just ran in is the whole point of shipping one. See
; customInstall below for why this is no longer tied to the same
; fresh-install-only gate updateCheck uses.
;
; Never during a silent install, which is what the updater runs: no page
; is shown, no dialog appears, and no file is written at all, so an
; update never touches either choice.
;
; Off unless ticked, as it is in the app: the check is the one request
; Prune makes beyond the machine, and it is opt-in everywhere.
;
; The page's words are below in every installer language.
; electron/installerLanguages.test.cjs fails if a language the installer
; offers has no translation here.

!ifndef BUILD_UNINSTALLER

!macro customHeader
  !include nsDialogs.nsh
  !include LogicLib.nsh

  Var updatesCheckbox
  Var updatesChoice

  ; The language this install picked, as one of languages.js's 40 short
  ; codes rather than NSIS's own LANG_* id -- written to
  ; installer-choices.json in customInstall below, alongside updateCheck,
  ; so the app opens in the same language the installer just ran in.
  ; $(appLangCode) resolves against $LANGUAGE at the point it is used,
  ; same as any other LangString reference, so no separate capture is
  ; needed. backend/src/services/installerChoices.js ignores any code it
  ; does not recognise, so a mismatch here fails safe rather than corrupt.
  LangString appLangCode ${LANG_ENGLISH} "en"
  LangString appLangCode ${LANG_AFRIKAANS} "af"
  LangString appLangCode ${LANG_ARABIC} "ar"
  LangString appLangCode ${LANG_CATALAN} "ca"
  LangString appLangCode ${LANG_CZECH} "cs"
  LangString appLangCode ${LANG_WELSH} "cy"
  LangString appLangCode ${LANG_DANISH} "da"
  LangString appLangCode ${LANG_GERMAN} "de"
  LangString appLangCode ${LANG_GREEK} "el"
  LangString appLangCode ${LANG_SPANISHINTERNATIONAL} "es"
  LangString appLangCode ${LANG_ESTONIAN} "et"
  LangString appLangCode ${LANG_FINNISH} "fi"
  LangString appLangCode ${LANG_FRENCH} "fr"
  LangString appLangCode ${LANG_HEBREW} "he"
  LangString appLangCode ${LANG_HUNGARIAN} "hu"
  LangString appLangCode ${LANG_INDONESIAN} "id"
  LangString appLangCode ${LANG_ICELANDIC} "is"
  LangString appLangCode ${LANG_ITALIAN} "it"
  LangString appLangCode ${LANG_JAPANESE} "ja"
  LangString appLangCode ${LANG_KOREAN} "ko"
  LangString appLangCode ${LANG_LITHUANIAN} "lt"
  LangString appLangCode ${LANG_MALAY} "ms"
  LangString appLangCode ${LANG_NORWEGIAN} "nb"
  LangString appLangCode ${LANG_DUTCH} "nl"
  LangString appLangCode ${LANG_POLISH} "pl"
  LangString appLangCode ${LANG_PASHTO} "ps"
  LangString appLangCode ${LANG_PORTUGUESEBR} "pt-BR"
  LangString appLangCode ${LANG_PORTUGUESE} "pt"
  LangString appLangCode ${LANG_ROMANIAN} "ro"
  LangString appLangCode ${LANG_RUSSIAN} "ru"
  LangString appLangCode ${LANG_SLOVAK} "sk"
  LangString appLangCode ${LANG_ALBANIAN} "sq"
  LangString appLangCode ${LANG_SERBIAN} "sr"
  LangString appLangCode ${LANG_SWEDISH} "sv"
  LangString appLangCode ${LANG_THAI} "th"
  LangString appLangCode ${LANG_TURKISH} "tr"
  LangString appLangCode ${LANG_UKRAINIAN} "uk"
  LangString appLangCode ${LANG_VIETNAMESE} "vi"
  LangString appLangCode ${LANG_SIMPCHINESE} "zh-CN"
  LangString appLangCode ${LANG_TRADCHINESE} "zh-TW"

  ; The stock "who should this be installed for" page (electron-builder's
  ; own MultiUser install-mode page, app-builder-lib/templates/nsis/
  ; multiUserUi.nsh) reads 17 LangStrings electron-builder ships its own
  ; translations for in assistedMessages.yml -- but only for about 20
  ; languages. Prune offers 40. The other 19 silently fell back to
  ; English on this one page, even though the person had just picked
  ; their own language on the screen before it. Reported directly: the
  ; page right after the language choice stayed in English.
  ;
  ; NSIS resolves a LangString by the LAST declaration for a given id and
  ; language, so these redeclarations -- for the 19 languages
  ; assistedMessages.yml has no entry for at all -- simply override its
  ; English fallback once this file is included (NsisTarget.js includes
  ; assistedMessages.yml first, then this file). The other ~20 languages
  ; are untouched here; they already have real translations from
  ; electron-builder itself.
  LangString whoShouldThisApplicationBeInstalledFor ${LANG_AFRIKAANS} "Vir wie moet hierdie toepassing geïnstalleer word?"
  LangString chooseInstallationOptions ${LANG_AFRIKAANS} "Kies Installasie-opsies"
  LangString chooseUninstallationOptions ${LANG_AFRIKAANS} "Kies Deïnstallasie-opsies"
  LangString selectUserMode ${LANG_AFRIKAANS} "Kies asseblief of jy hierdie sagteware vir alle gebruikers beskikbaar wil stel, of net vir jouself"
  LangString whichInstallationRemove ${LANG_AFRIKAANS} "Hierdie sagteware is beide per-masjien (alle gebruikers) en per-gebruiker geïnstalleer.$\r$\nWatter installasie wil jy verwyder?"
  LangString whichInstallationShouldBeRemoved ${LANG_AFRIKAANS} "Watter installasie moet verwyder word?"
  LangString forAll ${LANG_AFRIKAANS} "Enigeen wat hierdie rekenaar gebruik (&alle gebruikers)"
  LangString onlyForMe ${LANG_AFRIKAANS} "Net vir &my"
  LangString perMachineInstall ${LANG_AFRIKAANS} "Daar is 'n per-masjien-installasie."
  LangString perMachineInstallExists ${LANG_AFRIKAANS} "Daar is reeds 'n per-masjien-installasie."
  LangString perUserInstall ${LANG_AFRIKAANS} "Daar is 'n per-gebruiker-installasie."
  LangString perUserInstallExists ${LANG_AFRIKAANS} "Daar is reeds 'n per-gebruiker-installasie."
  LangString reinstallUpgrade ${LANG_AFRIKAANS} "Sal herinstalleer/opgradeer."
  LangString uninstall ${LANG_AFRIKAANS} "Sal deïnstalleer."
  LangString loginWithAdminAccount ${LANG_AFRIKAANS} "Jy moet aanmeld met 'n rekening wat deel is van die administrateursgroep om voort te gaan..."
  LangString freshInstallForAll ${LANG_AFRIKAANS} "Nuwe installasie vir alle gebruikers. (sal vra vir administrateur-geloofsbriewe)"
  LangString freshInstallForCurrent ${LANG_AFRIKAANS} "Nuwe installasie net vir die huidige gebruiker."

  LangString whoShouldThisApplicationBeInstalledFor ${LANG_ARABIC} "لمن يجب تثبيت هذا التطبيق؟"
  LangString chooseInstallationOptions ${LANG_ARABIC} "اختر خيارات التثبيت"
  LangString chooseUninstallationOptions ${LANG_ARABIC} "اختر خيارات إزالة التثبيت"
  LangString selectUserMode ${LANG_ARABIC} "يُرجى تحديد ما إذا كنت تريد إتاحة هذا البرنامج لجميع المستخدمين أم لك فقط"
  LangString whichInstallationRemove ${LANG_ARABIC} "تم تثبيت هذا البرنامج لكل الأجهزة (جميع المستخدمين) ولكل مستخدم على حدة.$\r$\nما التثبيت الذي تريد إزالته؟"
  LangString whichInstallationShouldBeRemoved ${LANG_ARABIC} "ما التثبيت الذي يجب إزالته؟"
  LangString forAll ${LANG_ARABIC} "أي شخص يستخدم هذا الكمبيوتر (جميع المستخدمين)"
  LangString onlyForMe ${LANG_ARABIC} "لي فقط"
  LangString perMachineInstall ${LANG_ARABIC} "يوجد تثبيت لكل الأجهزة."
  LangString perMachineInstallExists ${LANG_ARABIC} "يوجد بالفعل تثبيت لكل الأجهزة."
  LangString perUserInstall ${LANG_ARABIC} "يوجد تثبيت لكل مستخدم."
  LangString perUserInstallExists ${LANG_ARABIC} "يوجد بالفعل تثبيت لكل مستخدم."
  LangString reinstallUpgrade ${LANG_ARABIC} "ستتم إعادة التثبيت/الترقية."
  LangString uninstall ${LANG_ARABIC} "ستتم إزالة التثبيت."
  LangString loginWithAdminAccount ${LANG_ARABIC} "يجب تسجيل الدخول باستخدام حساب عضو في مجموعة المسؤولين للمتابعة..."
  LangString freshInstallForAll ${LANG_ARABIC} "تثبيت جديد لجميع المستخدمين. (سيُطلب منك إدخال بيانات اعتماد المسؤول)"
  LangString freshInstallForCurrent ${LANG_ARABIC} "تثبيت جديد للمستخدم الحالي فقط."

  LangString whoShouldThisApplicationBeInstalledFor ${LANG_CATALAN} "Per a qui s'ha d'instal·lar aquesta aplicació?"
  LangString chooseInstallationOptions ${LANG_CATALAN} "Trieu les opcions d'instal·lació"
  LangString chooseUninstallationOptions ${LANG_CATALAN} "Trieu les opcions de desinstal·lació"
  LangString selectUserMode ${LANG_CATALAN} "Seleccioneu si voleu que aquest programari estigui disponible per a tots els usuaris o només per a vós"
  LangString whichInstallationRemove ${LANG_CATALAN} "Aquest programari està instal·lat tant per equip (tots els usuaris) com per usuari.$\r$\nQuina instal·lació voleu suprimir?"
  LangString whichInstallationShouldBeRemoved ${LANG_CATALAN} "Quina instal·lació s'hauria de suprimir?"
  LangString forAll ${LANG_CATALAN} "Qualsevol persona que utilitzi aquest ordinador (&tots els usuaris)"
  LangString onlyForMe ${LANG_CATALAN} "Només per a &mi"
  LangString perMachineInstall ${LANG_CATALAN} "Hi ha una instal·lació per equip."
  LangString perMachineInstallExists ${LANG_CATALAN} "Ja hi ha una instal·lació per equip."
  LangString perUserInstall ${LANG_CATALAN} "Hi ha una instal·lació per usuari."
  LangString perUserInstallExists ${LANG_CATALAN} "Ja hi ha una instal·lació per usuari."
  LangString reinstallUpgrade ${LANG_CATALAN} "Es reinstal·larà/actualitzarà."
  LangString uninstall ${LANG_CATALAN} "Es desinstal·larà."
  LangString loginWithAdminAccount ${LANG_CATALAN} "Cal iniciar la sessió amb un compte que sigui membre del grup d'administradors per continuar..."
  LangString freshInstallForAll ${LANG_CATALAN} "Instal·lació nova per a tots els usuaris. (es demanaran credencials d'administrador)"
  LangString freshInstallForCurrent ${LANG_CATALAN} "Instal·lació nova només per a l'usuari actual."

  LangString whoShouldThisApplicationBeInstalledFor ${LANG_WELSH} "Ar gyfer pwy ddylai'r rhaglen hon gael ei gosod?"
  LangString chooseInstallationOptions ${LANG_WELSH} "Dewiswch Opsiynau Gosod"
  LangString chooseUninstallationOptions ${LANG_WELSH} "Dewiswch Opsiynau Dadosod"
  LangString selectUserMode ${LANG_WELSH} "Dewiswch a hoffech wneud y meddalwedd hwn ar gael i bawb neu i chi'ch hun yn unig"
  LangString whichInstallationRemove ${LANG_WELSH} "Mae'r meddalwedd hwn wedi'i osod fesul peiriant (pawb) a fesul defnyddiwr.$\r$\nPa osodiad hoffech chi ei dynnu?"
  LangString whichInstallationShouldBeRemoved ${LANG_WELSH} "Pa osodiad ddylid ei dynnu?"
  LangString forAll ${LANG_WELSH} "Unrhyw un sy'n defnyddio'r cyfrifiadur hwn (&pawb)"
  LangString onlyForMe ${LANG_WELSH} "I &mi yn unig"
  LangString perMachineInstall ${LANG_WELSH} "Mae gosodiad fesul peiriant yn bodoli."
  LangString perMachineInstallExists ${LANG_WELSH} "Mae gosodiad fesul peiriant eisoes yn bodoli."
  LangString perUserInstall ${LANG_WELSH} "Mae gosodiad fesul defnyddiwr yn bodoli."
  LangString perUserInstallExists ${LANG_WELSH} "Mae gosodiad fesul defnyddiwr eisoes yn bodoli."
  LangString reinstallUpgrade ${LANG_WELSH} "Bydd yn ailosod/uwchraddio."
  LangString uninstall ${LANG_WELSH} "Bydd yn dadosod."
  LangString loginWithAdminAccount ${LANG_WELSH} "Mae angen i chi fewngofnodi gyda chyfrif sy'n aelod o'r grŵp gweinyddwyr er mwyn parhau..."
  LangString freshInstallForAll ${LANG_WELSH} "Gosodiad newydd i bawb. (bydd yn gofyn am gredlythyrau gweinyddwr)"
  LangString freshInstallForCurrent ${LANG_WELSH} "Gosodiad newydd i'r defnyddiwr presennol yn unig."

  LangString whoShouldThisApplicationBeInstalledFor ${LANG_GREEK} "Για ποιον πρέπει να εγκατασταθεί αυτή η εφαρμογή;"
  LangString chooseInstallationOptions ${LANG_GREEK} "Επιλέξτε επιλογές εγκατάστασης"
  LangString chooseUninstallationOptions ${LANG_GREEK} "Επιλέξτε επιλογές κατάργησης εγκατάστασης"
  LangString selectUserMode ${LANG_GREEK} "Επιλέξτε αν θέλετε να γίνει διαθέσιμο αυτό το λογισμικό σε όλους τους χρήστες ή μόνο σε εσάς"
  LangString whichInstallationRemove ${LANG_GREEK} "Αυτό το λογισμικό είναι εγκατεστημένο τόσο ανά υπολογιστή (όλοι οι χρήστες) όσο και ανά χρήστη.$\r$\nΠοια εγκατάσταση θέλετε να καταργήσετε;"
  LangString whichInstallationShouldBeRemoved ${LANG_GREEK} "Ποια εγκατάσταση πρέπει να καταργηθεί;"
  LangString forAll ${LANG_GREEK} "Οποιοσδήποτε χρησιμοποιεί αυτόν τον υπολογιστή (ό&λοι οι χρήστες)"
  LangString onlyForMe ${LANG_GREEK} "Μόνο για ε&μένα"
  LangString perMachineInstall ${LANG_GREEK} "Υπάρχει εγκατάσταση ανά υπολογιστή."
  LangString perMachineInstallExists ${LANG_GREEK} "Υπάρχει ήδη εγκατάσταση ανά υπολογιστή."
  LangString perUserInstall ${LANG_GREEK} "Υπάρχει εγκατάσταση ανά χρήστη."
  LangString perUserInstallExists ${LANG_GREEK} "Υπάρχει ήδη εγκατάσταση ανά χρήστη."
  LangString reinstallUpgrade ${LANG_GREEK} "Θα γίνει επανεγκατάσταση/αναβάθμιση."
  LangString uninstall ${LANG_GREEK} "Θα γίνει κατάργηση εγκατάστασης."
  LangString loginWithAdminAccount ${LANG_GREEK} "Πρέπει να συνδεθείτε με λογαριασμό που είναι μέλος της ομάδας διαχειριστών για να συνεχίσετε..."
  LangString freshInstallForAll ${LANG_GREEK} "Νέα εγκατάσταση για όλους τους χρήστες. (θα ζητηθούν διαπιστευτήρια διαχειριστή)"
  LangString freshInstallForCurrent ${LANG_GREEK} "Νέα εγκατάσταση μόνο για τον τρέχοντα χρήστη."

  LangString whoShouldThisApplicationBeInstalledFor ${LANG_ESTONIAN} "Kellele see rakendus installida?"
  LangString chooseInstallationOptions ${LANG_ESTONIAN} "Valige installi suvandid"
  LangString chooseUninstallationOptions ${LANG_ESTONIAN} "Valige desinstalli suvandid"
  LangString selectUserMode ${LANG_ESTONIAN} "Valige, kas soovite teha selle tarkvara kättesaadavaks kõigile kasutajatele või ainult endale"
  LangString whichInstallationRemove ${LANG_ESTONIAN} "See tarkvara on installitud nii arvutipõhiselt (kõik kasutajad) kui ka kasutajapõhiselt.$\r$\nKumma installi soovite eemaldada?"
  LangString whichInstallationShouldBeRemoved ${LANG_ESTONIAN} "Kumb install tuleks eemaldada?"
  LangString forAll ${LANG_ESTONIAN} "Kõik, kes seda arvutit kasutavad (k&õik kasutajad)"
  LangString onlyForMe ${LANG_ESTONIAN} "Ainult &minule"
  LangString perMachineInstall ${LANG_ESTONIAN} "Olemas on arvutipõhine install."
  LangString perMachineInstallExists ${LANG_ESTONIAN} "Arvutipõhine install on juba olemas."
  LangString perUserInstall ${LANG_ESTONIAN} "Olemas on kasutajapõhine install."
  LangString perUserInstallExists ${LANG_ESTONIAN} "Kasutajapõhine install on juba olemas."
  LangString reinstallUpgrade ${LANG_ESTONIAN} "Installitakse uuesti / uuendatakse."
  LangString uninstall ${LANG_ESTONIAN} "Desinstallitakse."
  LangString loginWithAdminAccount ${LANG_ESTONIAN} "Jätkamiseks peate sisse logima kontoga, mis kuulub administraatorite rühma..."
  LangString freshInstallForAll ${LANG_ESTONIAN} "Uus install kõigile kasutajatele. (küsitakse administraatori mandaate)"
  LangString freshInstallForCurrent ${LANG_ESTONIAN} "Uus install ainult praegusele kasutajale."

  LangString whoShouldThisApplicationBeInstalledFor ${LANG_HEBREW} "עבור מי יש להתקין יישום זה?"
  LangString chooseInstallationOptions ${LANG_HEBREW} "בחר אפשרויות התקנה"
  LangString chooseUninstallationOptions ${LANG_HEBREW} "בחר אפשרויות הסרת התקנה"
  LangString selectUserMode ${LANG_HEBREW} "בחר אם ברצונך להפוך תוכנה זו לזמינה לכל המשתמשים או רק עבורך"
  LangString whichInstallationRemove ${LANG_HEBREW} "תוכנה זו מותקנת הן עבור כל המחשב (כל המשתמשים) והן עבור משתמש בודד.$\r$\nאיזו התקנה ברצונך להסיר?"
  LangString whichInstallationShouldBeRemoved ${LANG_HEBREW} "איזו התקנה יש להסיר?"
  LangString forAll ${LANG_HEBREW} "כל מי שמשתמש במחשב זה (כל המשתמשים)"
  LangString onlyForMe ${LANG_HEBREW} "רק עבורי"
  LangString perMachineInstall ${LANG_HEBREW} "קיימת התקנה לכל המחשב."
  LangString perMachineInstallExists ${LANG_HEBREW} "כבר קיימת התקנה לכל המחשב."
  LangString perUserInstall ${LANG_HEBREW} "קיימת התקנה למשתמש בודד."
  LangString perUserInstallExists ${LANG_HEBREW} "כבר קיימת התקנה למשתמש בודד."
  LangString reinstallUpgrade ${LANG_HEBREW} "תתבצע התקנה מחדש / שדרוג."
  LangString uninstall ${LANG_HEBREW} "תתבצע הסרת התקנה."
  LangString loginWithAdminAccount ${LANG_HEBREW} "כדי להמשיך, עליך להיכנס עם חשבון שהוא חבר בקבוצת המנהלים..."
  LangString freshInstallForAll ${LANG_HEBREW} "התקנה חדשה לכל המשתמשים. (תתבקש להזין פרטי הזדהות של מנהל מערכת)"
  LangString freshInstallForCurrent ${LANG_HEBREW} "התקנה חדשה למשתמש הנוכחי בלבד."

  LangString whoShouldThisApplicationBeInstalledFor ${LANG_INDONESIAN} "Untuk siapa aplikasi ini harus diinstal?"
  LangString chooseInstallationOptions ${LANG_INDONESIAN} "Pilih Opsi Penginstalan"
  LangString chooseUninstallationOptions ${LANG_INDONESIAN} "Pilih Opsi Pencopotan Pemasangan"
  LangString selectUserMode ${LANG_INDONESIAN} "Pilih apakah Anda ingin membuat perangkat lunak ini tersedia untuk semua pengguna atau hanya untuk Anda sendiri"
  LangString whichInstallationRemove ${LANG_INDONESIAN} "Perangkat lunak ini terinstal baik per komputer (semua pengguna) maupun per pengguna.$\r$\nPenginstalan mana yang ingin Anda hapus?"
  LangString whichInstallationShouldBeRemoved ${LANG_INDONESIAN} "Penginstalan mana yang harus dihapus?"
  LangString forAll ${LANG_INDONESIAN} "Siapa saja yang menggunakan komputer ini (&semua pengguna)"
  LangString onlyForMe ${LANG_INDONESIAN} "Hanya untuk sa&ya"
  LangString perMachineInstall ${LANG_INDONESIAN} "Ada penginstalan per komputer."
  LangString perMachineInstallExists ${LANG_INDONESIAN} "Sudah ada penginstalan per komputer."
  LangString perUserInstall ${LANG_INDONESIAN} "Ada penginstalan per pengguna."
  LangString perUserInstallExists ${LANG_INDONESIAN} "Sudah ada penginstalan per pengguna."
  LangString reinstallUpgrade ${LANG_INDONESIAN} "Akan menginstal ulang/memutakhirkan."
  LangString uninstall ${LANG_INDONESIAN} "Akan mencopot pemasangan."
  LangString loginWithAdminAccount ${LANG_INDONESIAN} "Anda perlu masuk dengan akun yang merupakan anggota grup admin untuk melanjutkan..."
  LangString freshInstallForAll ${LANG_INDONESIAN} "Penginstalan baru untuk semua pengguna. (akan meminta kredensial admin)"
  LangString freshInstallForCurrent ${LANG_INDONESIAN} "Penginstalan baru hanya untuk pengguna saat ini."

  LangString whoShouldThisApplicationBeInstalledFor ${LANG_ICELANDIC} "Fyrir hvern á að setja upp þetta forrit?"
  LangString chooseInstallationOptions ${LANG_ICELANDIC} "Veldu uppsetningarvalkosti"
  LangString chooseUninstallationOptions ${LANG_ICELANDIC} "Veldu valkosti fyrir fjarlægingu"
  LangString selectUserMode ${LANG_ICELANDIC} "Veldu hvort þú vilt gera þennan hugbúnað aðgengilegan öllum notendum eða aðeins þér"
  LangString whichInstallationRemove ${LANG_ICELANDIC} "Þessi hugbúnaður er uppsettur bæði fyrir alla tölvuna (alla notendur) og fyrir einstakan notanda.$\r$\nHvaða uppsetningu viltu fjarlægja?"
  LangString whichInstallationShouldBeRemoved ${LANG_ICELANDIC} "Hvaða uppsetningu á að fjarlægja?"
  LangString forAll ${LANG_ICELANDIC} "Allir sem nota þessa tölvu (&allir notendur)"
  LangString onlyForMe ${LANG_ICELANDIC} "Aðeins fyrir &mig"
  LangString perMachineInstall ${LANG_ICELANDIC} "Uppsetning fyrir alla tölvuna er til staðar."
  LangString perMachineInstallExists ${LANG_ICELANDIC} "Uppsetning fyrir alla tölvuna er þegar til staðar."
  LangString perUserInstall ${LANG_ICELANDIC} "Uppsetning fyrir notanda er til staðar."
  LangString perUserInstallExists ${LANG_ICELANDIC} "Uppsetning fyrir notanda er þegar til staðar."
  LangString reinstallUpgrade ${LANG_ICELANDIC} "Mun setja upp aftur/uppfæra."
  LangString uninstall ${LANG_ICELANDIC} "Mun fjarlægja."
  LangString loginWithAdminAccount ${LANG_ICELANDIC} "Þú þarft að skrá þig inn með reikningi sem er meðlimur í hópi kerfisstjóra til að halda áfram..."
  LangString freshInstallForAll ${LANG_ICELANDIC} "Ný uppsetning fyrir alla notendur. (beðið verður um kerfisstjóraauðkenni)"
  LangString freshInstallForCurrent ${LANG_ICELANDIC} "Ný uppsetning eingöngu fyrir núverandi notanda."

  LangString whoShouldThisApplicationBeInstalledFor ${LANG_LITHUANIAN} "Kam turėtų būti įdiegta ši programa?"
  LangString chooseInstallationOptions ${LANG_LITHUANIAN} "Pasirinkite diegimo parinktis"
  LangString chooseUninstallationOptions ${LANG_LITHUANIAN} "Pasirinkite šalinimo parinktis"
  LangString selectUserMode ${LANG_LITHUANIAN} "Pasirinkite, ar norite, kad ši programinė įranga būtų prieinama visiems naudotojams, ar tik jums"
  LangString whichInstallationRemove ${LANG_LITHUANIAN} "Ši programinė įranga įdiegta ir visam kompiuteriui (visiems naudotojams), ir konkrečiam naudotojui.$\r$\nKurį diegimą norite pašalinti?"
  LangString whichInstallationShouldBeRemoved ${LANG_LITHUANIAN} "Kurį diegimą reikėtų pašalinti?"
  LangString forAll ${LANG_LITHUANIAN} "Visi, kurie naudojasi šiuo kompiuteriu (&visi naudotojai)"
  LangString onlyForMe ${LANG_LITHUANIAN} "Tik &man"
  LangString perMachineInstall ${LANG_LITHUANIAN} "Yra visam kompiuteriui skirtas diegimas."
  LangString perMachineInstallExists ${LANG_LITHUANIAN} "Visam kompiuteriui skirtas diegimas jau yra."
  LangString perUserInstall ${LANG_LITHUANIAN} "Yra naudotojui skirtas diegimas."
  LangString perUserInstallExists ${LANG_LITHUANIAN} "Naudotojui skirtas diegimas jau yra."
  LangString reinstallUpgrade ${LANG_LITHUANIAN} "Bus iš naujo įdiegta / atnaujinta."
  LangString uninstall ${LANG_LITHUANIAN} "Bus pašalinta."
  LangString loginWithAdminAccount ${LANG_LITHUANIAN} "Norėdami tęsti, turite prisijungti prie paskyros, priklausančios administratorių grupei..."
  LangString freshInstallForAll ${LANG_LITHUANIAN} "Nauja diegimo versija visiems naudotojams. (bus paprašyta administratoriaus kredencialų)"
  LangString freshInstallForCurrent ${LANG_LITHUANIAN} "Nauja diegimo versija tik dabartiniam naudotojui."

  LangString whoShouldThisApplicationBeInstalledFor ${LANG_MALAY} "Untuk siapakah aplikasi ini perlu dipasang?"
  LangString chooseInstallationOptions ${LANG_MALAY} "Pilih Pilihan Pemasangan"
  LangString chooseUninstallationOptions ${LANG_MALAY} "Pilih Pilihan Nyahpasang"
  LangString selectUserMode ${LANG_MALAY} "Sila pilih sama ada anda mahu menjadikan perisian ini tersedia untuk semua pengguna atau hanya untuk anda sahaja"
  LangString whichInstallationRemove ${LANG_MALAY} "Perisian ini dipasang kedua-dua setiap mesin (semua pengguna) dan setiap pengguna.$\r$\nPemasangan manakah yang anda ingin alih keluar?"
  LangString whichInstallationShouldBeRemoved ${LANG_MALAY} "Pemasangan manakah yang perlu dialih keluar?"
  LangString forAll ${LANG_MALAY} "Sesiapa yang menggunakan komputer ini (&semua pengguna)"
  LangString onlyForMe ${LANG_MALAY} "Untuk sa&ya sahaja"
  LangString perMachineInstall ${LANG_MALAY} "Terdapat pemasangan setiap mesin."
  LangString perMachineInstallExists ${LANG_MALAY} "Pemasangan setiap mesin sudah wujud."
  LangString perUserInstall ${LANG_MALAY} "Terdapat pemasangan setiap pengguna."
  LangString perUserInstallExists ${LANG_MALAY} "Pemasangan setiap pengguna sudah wujud."
  LangString reinstallUpgrade ${LANG_MALAY} "Akan memasang semula/menaik taraf."
  LangString uninstall ${LANG_MALAY} "Akan menyahpasang."
  LangString loginWithAdminAccount ${LANG_MALAY} "Anda perlu log masuk dengan akaun yang merupakan ahli kumpulan pentadbir untuk meneruskan..."
  LangString freshInstallForAll ${LANG_MALAY} "Pemasangan baharu untuk semua pengguna. (akan meminta kelayakan pentadbir)"
  LangString freshInstallForCurrent ${LANG_MALAY} "Pemasangan baharu untuk pengguna semasa sahaja."

  LangString whoShouldThisApplicationBeInstalledFor ${LANG_PASHTO} "دا اپلیکیشن باید د چا لپاره نصب شي؟"
  LangString chooseInstallationOptions ${LANG_PASHTO} "د نصبولو اختیارونه وټاکئ"
  LangString chooseUninstallationOptions ${LANG_PASHTO} "د لرې کولو اختیارونه وټاکئ"
  LangString selectUserMode ${LANG_PASHTO} "وټاکئ چې ایا تاسو غواړئ دا سافټویر ټولو کاروونکو ته د لاسرسي وړ کړئ، یا یوازې تاسو ته"
  LangString whichInstallationRemove ${LANG_PASHTO} "دا سافټویر دواړه د هر ماشین (ټول کاروونکي) او د هر کاروونکي په بڼه نصب شوی دی.$\r$\nتاسو کوم نصب لرې کول غواړئ؟"
  LangString whichInstallationShouldBeRemoved ${LANG_PASHTO} "کوم نصب باید لرې شي؟"
  LangString forAll ${LANG_PASHTO} "هر هغه څوک چې دا کمپیوټر کاروي (ټول کاروونکي)"
  LangString onlyForMe ${LANG_PASHTO} "یوازې زما لپاره"
  LangString perMachineInstall ${LANG_PASHTO} "د هر ماشین لپاره نصب شتون لري."
  LangString perMachineInstallExists ${LANG_PASHTO} "د هر ماشین لپاره نصب دمخه شتون لري."
  LangString perUserInstall ${LANG_PASHTO} "د هر کاروونکي لپاره نصب شتون لري."
  LangString perUserInstallExists ${LANG_PASHTO} "د هر کاروونکي لپاره نصب دمخه شتون لري."
  LangString reinstallUpgrade ${LANG_PASHTO} "بیا به نصب / ارتقا شي."
  LangString uninstall ${LANG_PASHTO} "به لرې (ناانسټال) شي."
  LangString loginWithAdminAccount ${LANG_PASHTO} "د دوام لپاره باید د مدیرانو ډلې غړیتوب لرونکي حساب سره ننوځئ..."
  LangString freshInstallForAll ${LANG_PASHTO} "د ټولو کاروونکو لپاره نوی نصب کول. (د مدیر د اسنادو غوښتنه به وشي)"
  LangString freshInstallForCurrent ${LANG_PASHTO} "یوازې د اوسني کاروونکي لپاره نوی نصب کول."

  LangString whoShouldThisApplicationBeInstalledFor ${LANG_PORTUGUESE} "Para quem deve esta aplicação ser instalada?"
  LangString chooseInstallationOptions ${LANG_PORTUGUESE} "Escolher Opções de Instalação"
  LangString chooseUninstallationOptions ${LANG_PORTUGUESE} "Escolher Opções de Desinstalação"
  LangString selectUserMode ${LANG_PORTUGUESE} "Selecione se pretende disponibilizar este software a todos os utilizadores ou apenas a si"
  LangString whichInstallationRemove ${LANG_PORTUGUESE} "Este software está instalado tanto por computador (todos os utilizadores) como por utilizador.$\r$\nQual das instalações pretende remover?"
  LangString whichInstallationShouldBeRemoved ${LANG_PORTUGUESE} "Qual das instalações deve ser removida?"
  LangString forAll ${LANG_PORTUGUESE} "Qualquer pessoa que utilize este computador (&todos os utilizadores)"
  LangString onlyForMe ${LANG_PORTUGUESE} "Só para &mim"
  LangString perMachineInstall ${LANG_PORTUGUESE} "Existe uma instalação por computador."
  LangString perMachineInstallExists ${LANG_PORTUGUESE} "Já existe uma instalação por computador."
  LangString perUserInstall ${LANG_PORTUGUESE} "Existe uma instalação por utilizador."
  LangString perUserInstallExists ${LANG_PORTUGUESE} "Já existe uma instalação por utilizador."
  LangString reinstallUpgrade ${LANG_PORTUGUESE} "Vai reinstalar/atualizar."
  LangString uninstall ${LANG_PORTUGUESE} "Vai desinstalar."
  LangString loginWithAdminAccount ${LANG_PORTUGUESE} "Tem de iniciar sessão com uma conta que seja membro do grupo de administradores para continuar..."
  LangString freshInstallForAll ${LANG_PORTUGUESE} "Instalação nova para todos os utilizadores. (serão pedidas credenciais de administrador)"
  LangString freshInstallForCurrent ${LANG_PORTUGUESE} "Instalação nova apenas para o utilizador atual."

  LangString whoShouldThisApplicationBeInstalledFor ${LANG_ROMANIAN} "Pentru cine ar trebui instalată această aplicație?"
  LangString chooseInstallationOptions ${LANG_ROMANIAN} "Alegeți opțiunile de instalare"
  LangString chooseUninstallationOptions ${LANG_ROMANIAN} "Alegeți opțiunile de dezinstalare"
  LangString selectUserMode ${LANG_ROMANIAN} "Selectați dacă doriți ca acest software să fie disponibil pentru toți utilizatorii sau numai pentru dvs."
  LangString whichInstallationRemove ${LANG_ROMANIAN} "Acest software este instalat atât per computer (toți utilizatorii), cât și per utilizator.$\r$\nCe instalare doriți să eliminați?"
  LangString whichInstallationShouldBeRemoved ${LANG_ROMANIAN} "Ce instalare ar trebui eliminată?"
  LangString forAll ${LANG_ROMANIAN} "Oricine utilizează acest computer (&toți utilizatorii)"
  LangString onlyForMe ${LANG_ROMANIAN} "Numai pentru &mine"
  LangString perMachineInstall ${LANG_ROMANIAN} "Există o instalare per computer."
  LangString perMachineInstallExists ${LANG_ROMANIAN} "Există deja o instalare per computer."
  LangString perUserInstall ${LANG_ROMANIAN} "Există o instalare per utilizator."
  LangString perUserInstallExists ${LANG_ROMANIAN} "Există deja o instalare per utilizator."
  LangString reinstallUpgrade ${LANG_ROMANIAN} "Se va reinstala/actualiza."
  LangString uninstall ${LANG_ROMANIAN} "Se va dezinstala."
  LangString loginWithAdminAccount ${LANG_ROMANIAN} "Trebuie să vă conectați cu un cont care este membru al grupului de administratori pentru a continua..."
  LangString freshInstallForAll ${LANG_ROMANIAN} "Instalare nouă pentru toți utilizatorii. (vi se vor solicita acreditările de administrator)"
  LangString freshInstallForCurrent ${LANG_ROMANIAN} "Instalare nouă doar pentru utilizatorul curent."

  LangString whoShouldThisApplicationBeInstalledFor ${LANG_ALBANIAN} "Për kë duhet të instalohet ky aplikacion?"
  LangString chooseInstallationOptions ${LANG_ALBANIAN} "Zgjidhni opsionet e instalimit"
  LangString chooseUninstallationOptions ${LANG_ALBANIAN} "Zgjidhni opsionet e çinstalimit"
  LangString selectUserMode ${LANG_ALBANIAN} "Zgjidhni nëse dëshironi ta bëni këtë softuer të disponueshëm për të gjithë përdoruesit apo vetëm për ju"
  LangString whichInstallationRemove ${LANG_ALBANIAN} "Ky softuer është i instaluar si për çdo kompjuter (të gjithë përdoruesit), ashtu edhe për çdo përdorues.$\r$\nCilin instalim dëshironi ta hiqni?"
  LangString whichInstallationShouldBeRemoved ${LANG_ALBANIAN} "Cili instalim duhet të hiqet?"
  LangString forAll ${LANG_ALBANIAN} "Kushdo që përdor këtë kompjuter (të &gjithë përdoruesit)"
  LangString onlyForMe ${LANG_ALBANIAN} "Vetëm për &mua"
  LangString perMachineInstall ${LANG_ALBANIAN} "Ekziston një instalim për çdo kompjuter."
  LangString perMachineInstallExists ${LANG_ALBANIAN} "Ekziston tashmë një instalim për çdo kompjuter."
  LangString perUserInstall ${LANG_ALBANIAN} "Ekziston një instalim për çdo përdorues."
  LangString perUserInstallExists ${LANG_ALBANIAN} "Ekziston tashmë një instalim për çdo përdorues."
  LangString reinstallUpgrade ${LANG_ALBANIAN} "Do të riinstalohet/përditësohet."
  LangString uninstall ${LANG_ALBANIAN} "Do të çinstalohet."
  LangString loginWithAdminAccount ${LANG_ALBANIAN} "Duhet të identifikoheni me një llogari që është anëtare e grupit të administratorëve për të vazhduar..."
  LangString freshInstallForAll ${LANG_ALBANIAN} "Instalim i ri për të gjithë përdoruesit. (do t'ju kërkohen kredencialet e administratorit)"
  LangString freshInstallForCurrent ${LANG_ALBANIAN} "Instalim i ri vetëm për përdoruesin aktual."

  LangString whoShouldThisApplicationBeInstalledFor ${LANG_SERBIAN} "За кога треба да се инсталира ова апликација?"
  LangString chooseInstallationOptions ${LANG_SERBIAN} "Изаберите опције инсталације"
  LangString chooseUninstallationOptions ${LANG_SERBIAN} "Изаберите опције деинсталације"
  LangString selectUserMode ${LANG_SERBIAN} "Изаберите да ли желите да овај софтвер буде доступан свим корисницима или само вама"
  LangString whichInstallationRemove ${LANG_SERBIAN} "Овај софтвер је инсталиран и за цео рачунар (све кориснике) и по кориснику.$\r$\nКоју инсталацију желите да уклоните?"
  LangString whichInstallationShouldBeRemoved ${LANG_SERBIAN} "Коју инсталацију треба уклонити?"
  LangString forAll ${LANG_SERBIAN} "Било ко ко користи овај рачунар (&сви корисници)"
  LangString onlyForMe ${LANG_SERBIAN} "Само за &мене"
  LangString perMachineInstall ${LANG_SERBIAN} "Постоји инсталација за цео рачунар."
  LangString perMachineInstallExists ${LANG_SERBIAN} "Већ постоји инсталација за цео рачунар."
  LangString perUserInstall ${LANG_SERBIAN} "Постоји инсталација по кориснику."
  LangString perUserInstallExists ${LANG_SERBIAN} "Већ постоји инсталација по кориснику."
  LangString reinstallUpgrade ${LANG_SERBIAN} "Биће поново инсталирано/надограђено."
  LangString uninstall ${LANG_SERBIAN} "Биће деинсталирано."
  LangString loginWithAdminAccount ${LANG_SERBIAN} "Да бисте наставили, морате се пријавити налогом који је члан групе администратора..."
  LangString freshInstallForAll ${LANG_SERBIAN} "Нова инсталација за све кориснике. (биће затражени администраторски креденцијали)"
  LangString freshInstallForCurrent ${LANG_SERBIAN} "Нова инсталација само за тренутног корисника."

  LangString whoShouldThisApplicationBeInstalledFor ${LANG_THAI} "ควรติดตั้งแอปพลิเคชันนี้สำหรับใคร?"
  LangString chooseInstallationOptions ${LANG_THAI} "เลือกตัวเลือกการติดตั้ง"
  LangString chooseUninstallationOptions ${LANG_THAI} "เลือกตัวเลือกการถอนการติดตั้ง"
  LangString selectUserMode ${LANG_THAI} "โปรดเลือกว่าคุณต้องการให้ซอฟต์แวร์นี้พร้อมใช้งานสำหรับผู้ใช้ทุกคน หรือสำหรับคุณเท่านั้น"
  LangString whichInstallationRemove ${LANG_THAI} "ซอฟต์แวร์นี้ติดตั้งทั้งแบบต่อเครื่อง (ผู้ใช้ทุกคน) และแบบต่อผู้ใช้$\r$\nคุณต้องการเอาการติดตั้งใดออก?"
  LangString whichInstallationShouldBeRemoved ${LANG_THAI} "ควรเอาการติดตั้งใดออก?"
  LangString forAll ${LANG_THAI} "ทุกคนที่ใช้คอมพิวเตอร์เครื่องนี้ (ผู้ใช้ทุกคน)"
  LangString onlyForMe ${LANG_THAI} "สำหรับฉันเท่านั้น"
  LangString perMachineInstall ${LANG_THAI} "มีการติดตั้งแบบต่อเครื่อง"
  LangString perMachineInstallExists ${LANG_THAI} "มีการติดตั้งแบบต่อเครื่องอยู่แล้ว"
  LangString perUserInstall ${LANG_THAI} "มีการติดตั้งแบบต่อผู้ใช้"
  LangString perUserInstallExists ${LANG_THAI} "มีการติดตั้งแบบต่อผู้ใช้อยู่แล้ว"
  LangString reinstallUpgrade ${LANG_THAI} "จะติดตั้งใหม่/อัปเกรด"
  LangString uninstall ${LANG_THAI} "จะถอนการติดตั้ง"
  LangString loginWithAdminAccount ${LANG_THAI} "คุณต้องลงชื่อเข้าใช้ด้วยบัญชีที่เป็นสมาชิกของกลุ่มผู้ดูแลระบบเพื่อดำเนินการต่อ..."
  LangString freshInstallForAll ${LANG_THAI} "ติดตั้งใหม่สำหรับผู้ใช้ทุกคน (จะมีการขอข้อมูลประจำตัวผู้ดูแลระบบ)"
  LangString freshInstallForCurrent ${LANG_THAI} "ติดตั้งใหม่สำหรับผู้ใช้ปัจจุบันเท่านั้น"

  LangString whoShouldThisApplicationBeInstalledFor ${LANG_UKRAINIAN} "Для кого слід установити цю програму?"
  LangString chooseInstallationOptions ${LANG_UKRAINIAN} "Виберіть параметри встановлення"
  LangString chooseUninstallationOptions ${LANG_UKRAINIAN} "Виберіть параметри видалення"
  LangString selectUserMode ${LANG_UKRAINIAN} "Виберіть, чи хочете ви зробити це програмне забезпечення доступним для всіх користувачів, чи лише для себе"
  LangString whichInstallationRemove ${LANG_UKRAINIAN} "Це програмне забезпечення встановлено як для всього комп'ютера (усіх користувачів), так і для окремого користувача.$\r$\nЯке встановлення ви хочете видалити?"
  LangString whichInstallationShouldBeRemoved ${LANG_UKRAINIAN} "Яке встановлення слід видалити?"
  LangString forAll ${LANG_UKRAINIAN} "Усі, хто використовує цей комп'ютер (у&сі користувачі)"
  LangString onlyForMe ${LANG_UKRAINIAN} "Лише для &мене"
  LangString perMachineInstall ${LANG_UKRAINIAN} "Існує встановлення для всього комп'ютера."
  LangString perMachineInstallExists ${LANG_UKRAINIAN} "Встановлення для всього комп'ютера вже існує."
  LangString perUserInstall ${LANG_UKRAINIAN} "Існує встановлення для окремого користувача."
  LangString perUserInstallExists ${LANG_UKRAINIAN} "Встановлення для окремого користувача вже існує."
  LangString reinstallUpgrade ${LANG_UKRAINIAN} "Буде перевстановлено/оновлено."
  LangString uninstall ${LANG_UKRAINIAN} "Буде видалено."
  LangString loginWithAdminAccount ${LANG_UKRAINIAN} "Щоб продовжити, увійдіть за допомогою облікового запису, який є членом групи адміністраторів..."
  LangString freshInstallForAll ${LANG_UKRAINIAN} "Нове встановлення для всіх користувачів. (буде запропоновано ввести облікові дані адміністратора)"
  LangString freshInstallForCurrent ${LANG_UKRAINIAN} "Нове встановлення лише для поточного користувача."

  LangString whoShouldThisApplicationBeInstalledFor ${LANG_VIETNAMESE} "Ứng dụng này nên được cài đặt cho ai?"
  LangString chooseInstallationOptions ${LANG_VIETNAMESE} "Chọn Tùy chọn Cài đặt"
  LangString chooseUninstallationOptions ${LANG_VIETNAMESE} "Chọn Tùy chọn Gỡ cài đặt"
  LangString selectUserMode ${LANG_VIETNAMESE} "Vui lòng chọn xem bạn có muốn cung cấp phần mềm này cho tất cả người dùng hay chỉ cho riêng bạn"
  LangString whichInstallationRemove ${LANG_VIETNAMESE} "Phần mềm này được cài đặt cho cả toàn bộ máy (tất cả người dùng) và từng người dùng riêng.$\r$\nBạn muốn gỡ bỏ bản cài đặt nào?"
  LangString whichInstallationShouldBeRemoved ${LANG_VIETNAMESE} "Nên gỡ bỏ bản cài đặt nào?"
  LangString forAll ${LANG_VIETNAMESE} "Bất kỳ ai sử dụng máy tính này (tất cả &người dùng)"
  LangString onlyForMe ${LANG_VIETNAMESE} "Chỉ dành cho &tôi"
  LangString perMachineInstall ${LANG_VIETNAMESE} "Có bản cài đặt cho toàn bộ máy."
  LangString perMachineInstallExists ${LANG_VIETNAMESE} "Đã có bản cài đặt cho toàn bộ máy."
  LangString perUserInstall ${LANG_VIETNAMESE} "Có bản cài đặt cho từng người dùng."
  LangString perUserInstallExists ${LANG_VIETNAMESE} "Đã có bản cài đặt cho từng người dùng."
  LangString reinstallUpgrade ${LANG_VIETNAMESE} "Sẽ cài đặt lại/nâng cấp."
  LangString uninstall ${LANG_VIETNAMESE} "Sẽ gỡ cài đặt."
  LangString loginWithAdminAccount ${LANG_VIETNAMESE} "Bạn cần đăng nhập bằng tài khoản là thành viên của nhóm quản trị viên để tiếp tục..."
  LangString freshInstallForAll ${LANG_VIETNAMESE} "Cài đặt mới cho tất cả người dùng. (sẽ yêu cầu thông tin xác thực quản trị viên)"
  LangString freshInstallForCurrent ${LANG_VIETNAMESE} "Cài đặt mới chỉ cho người dùng hiện tại."

  LangString updatesTitle ${LANG_ENGLISH} "Updates"
  LangString updatesSubtitle ${LANG_ENGLISH} "Prune can let you know when a new version is out."
  LangString updatesCheckbox ${LANG_ENGLISH} "Check for updates once a day (you can change this later in Prune's settings)"

  LangString updatesTitle ${LANG_AFRIKAANS} "Opdaterings"
  LangString updatesSubtitle ${LANG_AFRIKAANS} "Prune kan jou laat weet wanneer ’n nuwe weergawe uitkom."
  LangString updatesCheckbox ${LANG_AFRIKAANS} "Kyk een keer per dag vir opdaterings (jy kan dit later in Prune se instellings verander)"

  LangString updatesTitle ${LANG_ARABIC} "التحديثات"
  LangString updatesSubtitle ${LANG_ARABIC} "يمكن لـ Prune إعلامك عند صدور إصدار جديد."
  LangString updatesCheckbox ${LANG_ARABIC} "التحقق من وجود تحديثات مرة واحدة يوميًا (يمكنك تغيير ذلك لاحقًا من إعدادات Prune)"

  LangString updatesTitle ${LANG_CATALAN} "Actualitzacions"
  LangString updatesSubtitle ${LANG_CATALAN} "Prune et pot avisar quan surti una versió nova."
  LangString updatesCheckbox ${LANG_CATALAN} "Cerca actualitzacions un cop al dia (ho pots canviar més endavant a la configuració de Prune)"

  LangString updatesTitle ${LANG_CZECH} "Aktualizace"
  LangString updatesSubtitle ${LANG_CZECH} "Prune vám může dát vědět, když vyjde nová verze."
  LangString updatesCheckbox ${LANG_CZECH} "Jednou denně kontrolovat aktualizace (později to můžete změnit v nastavení Prune)"

  LangString updatesTitle ${LANG_WELSH} "Diweddariadau"
  LangString updatesSubtitle ${LANG_WELSH} "Gall Prune roi gwybod i chi pan fydd fersiwn newydd ar gael."
  LangString updatesCheckbox ${LANG_WELSH} "Gwirio am ddiweddariadau unwaith y dydd (gallwch newid hyn yn nes ymlaen yng ngosodiadau Prune)"

  LangString updatesTitle ${LANG_DANISH} "Opdateringer"
  LangString updatesSubtitle ${LANG_DANISH} "Prune kan give dig besked, når der kommer en ny version."
  LangString updatesCheckbox ${LANG_DANISH} "Søg efter opdateringer én gang om dagen (du kan ændre det senere i Prunes indstillinger)"

  LangString updatesTitle ${LANG_GERMAN} "Updates"
  LangString updatesSubtitle ${LANG_GERMAN} "Prune kann Ihnen mitteilen, wenn eine neue Version erscheint."
  LangString updatesCheckbox ${LANG_GERMAN} "Einmal täglich nach Updates suchen (später in den Einstellungen von Prune änderbar)"

  LangString updatesTitle ${LANG_GREEK} "Ενημερώσεις"
  LangString updatesSubtitle ${LANG_GREEK} "Το Prune μπορεί να σας ειδοποιεί όταν κυκλοφορεί νέα έκδοση."
  LangString updatesCheckbox ${LANG_GREEK} "Έλεγχος για ενημερώσεις μία φορά την ημέρα (μπορείτε να το αλλάξετε αργότερα στις ρυθμίσεις του Prune)"

  LangString updatesTitle ${LANG_SPANISHINTERNATIONAL} "Actualizaciones"
  LangString updatesSubtitle ${LANG_SPANISHINTERNATIONAL} "Prune puede avisarte cuando salga una versión nueva."
  LangString updatesCheckbox ${LANG_SPANISHINTERNATIONAL} "Buscar actualizaciones una vez al día (puedes cambiarlo más tarde en la configuración de Prune)"

  LangString updatesTitle ${LANG_ESTONIAN} "Uuendused"
  LangString updatesSubtitle ${LANG_ESTONIAN} "Prune saab sulle teada anda, kui ilmub uus versioon."
  LangString updatesCheckbox ${LANG_ESTONIAN} "Kontrolli uuendusi kord päevas (saad seda hiljem Prune'i seadetes muuta)"

  LangString updatesTitle ${LANG_FINNISH} "Päivitykset"
  LangString updatesSubtitle ${LANG_FINNISH} "Prune voi kertoa sinulle, kun uusi versio julkaistaan."
  LangString updatesCheckbox ${LANG_FINNISH} "Tarkista päivitykset kerran päivässä (voit muuttaa tätä myöhemmin Prunen asetuksista)"

  LangString updatesTitle ${LANG_FRENCH} "Mises à jour"
  LangString updatesSubtitle ${LANG_FRENCH} "Prune peut vous prévenir lorsqu’une nouvelle version sort."
  LangString updatesCheckbox ${LANG_FRENCH} "Rechercher les mises à jour une fois par jour (modifiable plus tard dans les paramètres de Prune)"

  LangString updatesTitle ${LANG_HEBREW} "עדכונים"
  LangString updatesSubtitle ${LANG_HEBREW} "Prune יכולה להודיע לך כשיוצאת גרסה חדשה."
  LangString updatesCheckbox ${LANG_HEBREW} "בדיקת עדכונים פעם ביום (אפשר לשנות זאת מאוחר יותר בהגדרות של Prune)"

  LangString updatesTitle ${LANG_HUNGARIAN} "Frissítések"
  LangString updatesSubtitle ${LANG_HUNGARIAN} "A Prune értesíthet, ha új verzió jelenik meg."
  LangString updatesCheckbox ${LANG_HUNGARIAN} "Frissítések keresése naponta egyszer (később a Prune beállításaiban módosítható)"

  LangString updatesTitle ${LANG_INDONESIAN} "Pembaruan"
  LangString updatesSubtitle ${LANG_INDONESIAN} "Prune dapat memberi tahu Anda saat versi baru dirilis."
  LangString updatesCheckbox ${LANG_INDONESIAN} "Periksa pembaruan sekali sehari (Anda dapat mengubahnya nanti di pengaturan Prune)"

  LangString updatesTitle ${LANG_ICELANDIC} "Uppfærslur"
  LangString updatesSubtitle ${LANG_ICELANDIC} "Prune getur látið þig vita þegar ný útgáfa kemur út."
  LangString updatesCheckbox ${LANG_ICELANDIC} "Leita að uppfærslum einu sinni á dag (þú getur breytt þessu síðar í stillingum Prune)"

  LangString updatesTitle ${LANG_ITALIAN} "Aggiornamenti"
  LangString updatesSubtitle ${LANG_ITALIAN} "Prune può avvisarti quando esce una nuova versione."
  LangString updatesCheckbox ${LANG_ITALIAN} "Controlla gli aggiornamenti una volta al giorno (puoi cambiarlo in seguito nelle impostazioni di Prune)"

  LangString updatesTitle ${LANG_JAPANESE} "更新"
  LangString updatesSubtitle ${LANG_JAPANESE} "新しいバージョンが出たときに Prune がお知らせします。"
  LangString updatesCheckbox ${LANG_JAPANESE} "1 日 1 回、更新を確認する（あとで Prune の設定から変更できます）"

  LangString updatesTitle ${LANG_KOREAN} "업데이트"
  LangString updatesSubtitle ${LANG_KOREAN} "새 버전이 나오면 Prune이 알려 드릴 수 있습니다."
  LangString updatesCheckbox ${LANG_KOREAN} "하루에 한 번 업데이트 확인 (나중에 Prune 설정에서 변경할 수 있습니다)"

  LangString updatesTitle ${LANG_LITHUANIAN} "Atnaujinimai"
  LangString updatesSubtitle ${LANG_LITHUANIAN} "Prune gali jums pranešti, kai išleidžiama nauja versija."
  LangString updatesCheckbox ${LANG_LITHUANIAN} "Kartą per dieną tikrinti, ar yra atnaujinimų (vėliau tai galite pakeisti Prune nustatymuose)"

  LangString updatesTitle ${LANG_MALAY} "Kemas kini"
  LangString updatesSubtitle ${LANG_MALAY} "Prune boleh memberitahu anda apabila versi baharu dikeluarkan."
  LangString updatesCheckbox ${LANG_MALAY} "Semak kemas kini sekali sehari (anda boleh menukarnya kemudian dalam tetapan Prune)"

  LangString updatesTitle ${LANG_DUTCH} "Updates"
  LangString updatesSubtitle ${LANG_DUTCH} "Prune kan je laten weten wanneer er een nieuwe versie is."
  LangString updatesCheckbox ${LANG_DUTCH} "Eén keer per dag op updates controleren (je kunt dit later wijzigen in de instellingen van Prune)"

  LangString updatesTitle ${LANG_NORWEGIAN} "Oppdateringer"
  LangString updatesSubtitle ${LANG_NORWEGIAN} "Prune kan gi deg beskjed når en ny versjon kommer."
  LangString updatesCheckbox ${LANG_NORWEGIAN} "Se etter oppdateringer én gang om dagen (du kan endre dette senere i innstillingene til Prune)"

  LangString updatesTitle ${LANG_POLISH} "Aktualizacje"
  LangString updatesSubtitle ${LANG_POLISH} "Prune może Cię powiadomić, gdy pojawi się nowa wersja."
  LangString updatesCheckbox ${LANG_POLISH} "Sprawdzaj aktualizacje raz dziennie (możesz to później zmienić w ustawieniach Prune)"

  LangString updatesTitle ${LANG_PASHTO} "تازه کول"
  LangString updatesSubtitle ${LANG_PASHTO} "Prune کولی شي تاسو ته خبر درکړي کله چې نوې نسخه راووځي."
  LangString updatesCheckbox ${LANG_PASHTO} "په ورځ کې یو ځل د تازه کولو لپاره وګورئ (وروسته یې د Prune په ترتیباتو کې بدلولی شئ)"

  LangString updatesTitle ${LANG_PORTUGUESEBR} "Atualizações"
  LangString updatesSubtitle ${LANG_PORTUGUESEBR} "O Prune pode avisar você quando sair uma nova versão."
  LangString updatesCheckbox ${LANG_PORTUGUESEBR} "Verificar atualizações uma vez por dia (você pode mudar isso depois nas configurações do Prune)"

  LangString updatesTitle ${LANG_PORTUGUESE} "Atualizações"
  LangString updatesSubtitle ${LANG_PORTUGUESE} "O Prune pode avisá-lo quando sair uma nova versão."
  LangString updatesCheckbox ${LANG_PORTUGUESE} "Procurar atualizações uma vez por dia (pode alterar isto mais tarde nas definições do Prune)"

  LangString updatesTitle ${LANG_ROMANIAN} "Actualizări"
  LangString updatesSubtitle ${LANG_ROMANIAN} "Prune vă poate anunța când apare o versiune nouă."
  LangString updatesCheckbox ${LANG_ROMANIAN} "Caută actualizări o dată pe zi (puteți schimba asta mai târziu din setările Prune)"

  LangString updatesTitle ${LANG_RUSSIAN} "Обновления"
  LangString updatesSubtitle ${LANG_RUSSIAN} "Prune может сообщать вам о выходе новой версии."
  LangString updatesCheckbox ${LANG_RUSSIAN} "Проверять обновления раз в день (это можно изменить позже в настройках Prune)"

  LangString updatesTitle ${LANG_SLOVAK} "Aktualizácie"
  LangString updatesSubtitle ${LANG_SLOVAK} "Prune vám môže dať vedieť, keď vyjde nová verzia."
  LangString updatesCheckbox ${LANG_SLOVAK} "Raz denne kontrolovať aktualizácie (neskôr to môžete zmeniť v nastaveniach Prune)"

  LangString updatesTitle ${LANG_ALBANIAN} "Përditësime"
  LangString updatesSubtitle ${LANG_ALBANIAN} "Prune mund t’ju njoftojë kur del një version i ri."
  LangString updatesCheckbox ${LANG_ALBANIAN} "Kontrollo për përditësime një herë në ditë (mund ta ndryshoni më vonë te cilësimet e Prune)"

  LangString updatesTitle ${LANG_SERBIAN} "Ажурирања"
  LangString updatesSubtitle ${LANG_SERBIAN} "Prune може да вас обавести када изађе нова верзија."
  LangString updatesCheckbox ${LANG_SERBIAN} "Проверавај ажурирања једном дневно (касније то можете да промените у подешавањима програма Prune)"

  LangString updatesTitle ${LANG_SWEDISH} "Uppdateringar"
  LangString updatesSubtitle ${LANG_SWEDISH} "Prune kan meddela dig när en ny version kommer ut."
  LangString updatesCheckbox ${LANG_SWEDISH} "Sök efter uppdateringar en gång om dagen (du kan ändra detta senare i Prunes inställningar)"

  LangString updatesTitle ${LANG_THAI} "การอัปเดต"
  LangString updatesSubtitle ${LANG_THAI} "Prune แจ้งให้คุณทราบได้เมื่อมีเวอร์ชันใหม่"
  LangString updatesCheckbox ${LANG_THAI} "ตรวจหาการอัปเดตวันละครั้ง (คุณเปลี่ยนได้ภายหลังในการตั้งค่าของ Prune)"

  LangString updatesTitle ${LANG_TURKISH} "Güncellemeler"
  LangString updatesSubtitle ${LANG_TURKISH} "Prune yeni bir sürüm çıktığında size haber verebilir."
  LangString updatesCheckbox ${LANG_TURKISH} "Güncellemeleri günde bir kez denetle (bunu daha sonra Prune ayarlarından değiştirebilirsiniz)"

  LangString updatesTitle ${LANG_UKRAINIAN} "Оновлення"
  LangString updatesSubtitle ${LANG_UKRAINIAN} "Prune може повідомляти вас про вихід нової версії."
  LangString updatesCheckbox ${LANG_UKRAINIAN} "Перевіряти оновлення раз на день (це можна змінити пізніше в налаштуваннях Prune)"

  LangString updatesTitle ${LANG_VIETNAMESE} "Cập nhật"
  LangString updatesSubtitle ${LANG_VIETNAMESE} "Prune có thể báo cho bạn khi có phiên bản mới."
  LangString updatesCheckbox ${LANG_VIETNAMESE} "Kiểm tra cập nhật mỗi ngày một lần (bạn có thể thay đổi sau trong phần cài đặt của Prune)"

  LangString updatesTitle ${LANG_SIMPCHINESE} "更新"
  LangString updatesSubtitle ${LANG_SIMPCHINESE} "有新版本时，Prune 可以通知你。"
  LangString updatesCheckbox ${LANG_SIMPCHINESE} "每天检查一次更新（之后可在 Prune 的设置中更改）"

  LangString updatesTitle ${LANG_TRADCHINESE} "更新"
  LangString updatesSubtitle ${LANG_TRADCHINESE} "有新版本時，Prune 可以通知你。"
  LangString updatesCheckbox ${LANG_TRADCHINESE} "每天檢查一次更新（之後可在 Prune 的設定中變更）"

  Function updatesPageCreate
    ; Asked on a fresh install only -- see the top of this file.
    ${If} ${FileExists} "$APPDATA\Prune\settings.json"
      Abort
    ${EndIf}

    !insertmacro MUI_HEADER_TEXT "$(updatesTitle)" "$(updatesSubtitle)"
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}

    ${NSD_CreateCheckbox} 0 0 100% 30u "$(updatesCheckbox)"
    Pop $updatesCheckbox
    ${NSD_Uncheck} $updatesCheckbox

    nsDialogs::Show
  FunctionEnd

  Function updatesPageLeave
    ${NSD_GetState} $updatesCheckbox $0
    ${If} $0 == ${BST_CHECKED}
      StrCpy $updatesChoice "true"
    ${Else}
      StrCpy $updatesChoice "false"
    ${EndIf}
  FunctionEnd
!macroend

!macro customPageAfterChangeDir
  Page custom updatesPageCreate updatesPageLeave
!macroend

!macro customInstall
  ; The language is written on every interactive install, fresh or
  ; upgrade -- ${Silent} is the updater's own install, which shows no
  ; pages (including the language dialog) at all, so it is excluded the
  ; same way updateCheck already was.
  ;
  ; This used to be gated on $updatesChoice too (empty on an upgrade,
  ; since the Updates page skips itself there -- see updatesPageCreate).
  ; The reasoning was that a reinstall in whatever language Windows
  ; happens to default to should not silently override a language
  ; someone had deliberately picked inside Prune's own Settings. In
  ; practice that protected a rare case at the cost of the common one:
  ; someone upgrading Prune who ACTIVELY picks a language in the
  ; installer's own language dialog -- a real, deliberate choice, shown
  ; on every non-silent run regardless of fresh-install-or-not -- had it
  ; silently discarded, and the app opened in whatever language it was
  ; already in. Reported directly: an upgrade picked Greek in the
  ; installer and the app came up in English. $updatesChoice's own
  ; fresh-install-only gate is unrelated and unchanged -- that one
  ; protects against an unticked checkbox on a page nobody was shown
  ; turning off a setting silently, which is a real risk this decoupling
  ; does not touch.
  ${IfNot} ${Silent}
    CreateDirectory "$APPDATA\Prune"
    FileOpen $0 "$APPDATA\Prune\installer-choices.json" w
    ${If} $updatesChoice != ""
      FileWrite $0 '{"updateCheck":$updatesChoice,"language":"$(appLangCode)"}'
    ${Else}
      FileWrite $0 '{"language":"$(appLangCode)"}'
    ${EndIf}
    FileClose $0
  ${EndIf}
!macroend

!endif
